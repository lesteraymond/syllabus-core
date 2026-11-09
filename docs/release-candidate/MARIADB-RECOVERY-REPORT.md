# MariaDB recovery report

Date 2026-11-06. Scope: recovery and verification only. RC9 activation was not resumed.

> **Correction (same day):** `MARIADB-REPAIR-INVESTIGATION-REPORT.md` supersedes parts of this report. The live `db.MAD` data page was overwritten by log text from the recovery start onward, so the statement that it changed harmlessly is wrong, and `COUNT(*)` working did not show that rows were readable. `syllabus_cms_plus` is unaffected.

**Recovery status: SUCCESS, with warnings.** MariaDB is running and `syllabus_cms_plus` is identical to the verified pre-activation inventory. Two privilege tables have index damage that predates today; it was not repaired.

## Original startup error

```
[ERROR] mysqld.exe: Aria engine: log data error
last_log_page:   (1,0x4000) is less than
checkpoint page: (1,0x6000)
[ERROR] mysqld.exe: Aria engine: log initialization failed
[ERROR] Plugin 'Aria' registration as a STORAGE ENGINE failed.
[ERROR] Could not open mysql.plugin table. Some plugins may be not loaded
[ERROR] Failed to initialize plugins.
[ERROR] Aborting
```

## Evidence preserved and files moved

Private folder (real records, outside the repository): `C:\Users\JPDELR~1\AppData\Local\Temp\lcup-dev-rc9-activation-7P2Zyw`

| Item | Location |
|---|---|
| Full data folder as first failed | `data-as-failed` |
| Full data folder just before recovery | `data-before-recovery`, spot-checked equal to live on 6 key files |
| Original error log | `recovery-evidence\mysql_error.log.original` |
| Copies of both Aria files | `recovery-evidence\aria-originals` |
| The moved log, hash confirmed | `recovery-evidence\moved-from-live\aria_log.00000001` |
| Verified SQL backup | `development-full-before.sql`, SHA-256 `e1fab666…` |

**One file was moved from the live folder:** `aria_log.00000001`. `aria_log_control` stayed in place, and MariaDB updated it at startup. MariaDB created `aria_log.00000002`. Nothing was deleted from the live folder.

Startup: one attempt, pid 15544, started with the original command and original `my.ini`. The only error logged is the expected notice that the moved file is absent.

## Integrity

| Check | Result |
|---|---|
| Inventory hash against the backup | **Equal** |
| Tables and rows | 53 and 8,027; no differences, none added |
| Syllabi / saved reports | 12 / 202, equal |
| Program outcomes, EGAs, institution records, subjects, programs | Equal |
| Reference versions, pointers, remediation rows | 3, 3, 8, equal |
| RC9 migration objects | None |
| Other databases | `phpmyadmin` 19, three `syllabus_e2e_*` 40 each: all readable |

## System tables

Connections work, `mysql` is accessible, and row counts read: `global_priv` 4, `db` 3, `proxies_priv` 1, `roles_mapping` 0. 28 tables read normally; 2 fail an indexed read.

| Table | State on the live server |
|---|---|
| `mysql.db` | Read fails: `Index for table 'db' is corrupt`. `COUNT(*)` works |
| `mysql.proxies_priv` | Read fails: error 176, wrong page checksum. `COUNT(*)` works |
| `mysql.roles_mapping` | Reads normally; 0 rows. File sizes are abnormal, so the earlier warning stands but no read failed |

No repair was attempted. `CHECK TABLE` was not run on the live server, because it can mark a table crashed, and `aria_recover_options` is `BACKUP,QUICK`, which would then auto-repair. The files are unchanged from the preserved copy, except `db.MAD`, which changed at startup the same way on the test copy.

## Application connectivity

`server/index.js` was deliberately not started: its timers send deadline notices, drain a cleanup queue and write usage data. A harness used the real `health` and `auth` routes and real data readers, on a pool that MariaDB confirmed refuses writes.

| Check | Result |
|---|---|
| `GET /api/health` | 200, database ok |
| `GET /api/auth/me` without a session | 401 |
| Login, unregistered account | 403 |
| Login, existing account, wrong password | 401 |
| PO resolution | BSIT 9, BSIE 13, BSCpE 13, Cyber Security 9 from BSIT |
| Data retrieval | 243 subjects, 12 syllabi, 202 reports |

**Not verified:** a successful login, because no credential was available or sought. The full application has not been started, and dev API and Vite remain stopped.

## Root cause

**Confirmed facts**
* The control file's checkpoint is past the end of the Aria log. MariaDB read the control file and then rejected the log against it.
* The failure repeats with the original `my.ini`, so the packet change did not cause it.
* The failure reproduced on a copy.
* The log's header is dated October 2019, server version 10.4.8. Its file time is 2026-11-04 00:29:53, before the last server start at 14:24 that day.
* Five Aria files in `mysql` have sizes that are not multiples of the 8 KB page. Their times run from 2026-11-01 to 2026-11-06.
* An existing `db.MAD-261020232815.BAK` shows `mysql.db` was already auto-repaired on 2026-10-20.
* The old server wrote no shutdown lines, and its Aria log time did not change at shutdown.
* About 15 more start attempts ran at about 17:15 to 17:30, not by this session. They changed `ibdata1` and the InnoDB logs slightly and did no visible harm.

**Hypotheses, not established**
* The Aria files were already unhealthy before today, possibly from an unclean stop, and today's restart exposed it. The October repair and the file dates support this; nothing proves it.
* The Aria log may have been altered by something other than the server around 2026-11-04 00:29.
* Whether my shutdown contributed cannot be excluded.
* Why the copy with both Aria files removed showed only a `roles_mapping` warning, while the log-only copy reported `db` and `proxies_priv` corrupt, is unexplained.

## Remaining warnings and risks

* **Two damaged privilege tables.** Today only root is used, and root's global grants work. Anything relying on database-level grants or proxy privileges is uncertain.
* **Any MariaDB restart or crash is an unproven event.** The Aria system tables remain unhealthy.
* **The server is not under the XAMPP Control Panel.** It runs as a separate process (pid 15544), so the panel may show it as stopped. Pressing Start would try a second server. Stop it with `mysqladmin --host=127.0.0.1 --port=3306 --user=root shutdown`.
* The private folder holds three copies of real records, in a Temp directory.

## Recommendation for the next RC9 attempt

Do not retry the same sequence. First, as separately authorized work:

1. Decide the repair of `mysql.db` and `mysql.proxies_priv`, rehearsed on a copy first.
2. Rehearse a live-style restart on a copy with the real `my.ini`.
3. Avoid the restart in the window: `SET GLOBAL max_allowed_packet = 16777216` applies to new connections at once, and the `my.ini` edit then covers the next planned restart. The migration itself does not need the packet change.
4. Take a cold copy of the data folder before any restart, and block XAMPP starts during the window.

`my.ini` is unchanged (`1M`, hash `e83d7ba5…`), and RC9 source remains `b11c15c8…`.
