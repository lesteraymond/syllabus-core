# MariaDB live repair report

Date 2026-11-06. Scope: system-table repair only. RC9 activation was not resumed.

**Live repair status: SUCCESS.** MariaDB is running as pid 3904. `mysql.db`, `mysql.proxies_priv` and `mysql.roles_mapping` are repaired and verified across one clean restart. `syllabus_cms_plus` equals its established inventory.

The packet size is unchanged at 1 MB. `my.ini` is unchanged (`e83d7ba5…`). The RC9 migration did not run. RC9 source remains `b11c15c8…`.

## Backups

All in `C:\Users\JP Del Rosario\LCUP-DB-Recovery-2026-11-06\live-repair`, restricted to your account and SYSTEM. They hold real records and are not encrypted.

| Item | Verification |
|---|---|
| `syllabus_cms_plus` logical backup, 34,679,779 bytes, `e1fab666…` | Restored to an isolated server: 53 tables, 8,027 rows, no differences |
| Readable privilege tables, 5,942 bytes, `e7115941…` | Restored: `global_priv` 4 rows, equal |
| `SHOW GRANTS` for all 4 accounts | Saved before repair |
| Cold copy of the data directory | 489 files, 0 hash mismatches |
| Corrupted table files | 9 files preserved separately |

Earlier recovery evidence was not changed.

## Repair

1. Clean stop, 2 s.
2. `db.MAD` and `db.MAI` restored from the preserved copy; hashes confirmed.
3. Started with real output handles (`Start-Process` with stdout and stderr redirected to files).
4. `REPAIR TABLE` on the three tables, one at a time.

| Table | Result | `CHECK ... EXTENDED` | Files |
|---|---|---|---|
| `mysql.db` | OK, 3 rows | OK | Index 225,329 to 24,576 |
| `mysql.proxies_priv` | OK, 1 row | OK | 79,004 / 186,764 to 16,384 / 24,576 |
| `mysql.roles_mapping` | OK, 0 rows | OK | 67,047 / 30,026 to 8,192 / 8,192 |

No row-count warning. The `Wrong CRC` notes on `proxies_priv` also appeared in the rehearsal, where the pages in question held appended log text. The whole `mysql` database was not rebuilt, and no XAMPP recovery script was used.

The first repair script stopped itself before any repair, because it could not open the error log while the server held it. That was a fault in the script's file read, not a server fault.

## Privilege integrity

| Account | Before | After |
|---|---|---|
| `root@localhost` | ALL | ALL, plus `GRANT PROXY ON ''@'%'` restored |
| `root@127.0.0.1`, `root@::1` | ALL | Unchanged |
| `pma@localhost` | USAGE | USAGE, plus SELECT, INSERT, UPDATE, DELETE on `phpmyadmin` restored |
| `global_priv` (accounts, hashes, global privileges) | 4 accounts | Identical by hash |

No grant was lost. Two were restored. The `test` database grants for anonymous users are back as the XAMPP default. Login as `pma` and phpMyAdmin itself were not exercised.

## Restart

Clean stop in 1 s, restarted with the same method. All checks passed again. The error log since the repair has 2 "ready for connections", 2 "Shutdown complete", and 0 `[ERROR]` lines. This is the first time the live log has shown either "ready" since 2026-09-21.

## Logging

**Under the tested startup method, across 2 live starts and 1 clean shutdown, no log line since the repair landed in any `mysql`, `phpmyadmin` or `performance_schema` table file.** Log output reached `mysql_error.log`.

This is not a permanent fix. Nothing about MariaDB or XAMPP changed; only the way this process was started. A start from the Control Panel, a reboot or another tool is a different case. The earlier log fragments remain in the header area of a few `.MAI` files that were not rebuilt, and their tables read normally.

## Application database

Inventory hash equal to both the established and the fresh inventory: 53 tables, 8,027 rows. 12 syllabi, 202 reports, 36 Program Outcomes, 17 EGAs, institution records, reference versions and pointers, and the 8 remediation rows are all equal. Syllabus content, which holds the CLO mappings, is covered by the `syllabi` comparison. No RC9 migration object exists. Every table in every database reads. `mysql` reads 30 of 30, up from 28.

## Remaining risks and open questions

* **Why the log output misdirects is not known.** The test shows which start works, not the cause. That no-handles start is the reason is a hypothesis.
* **The original Aria startup failure is unexplained.** The failed log held no log text. Two clean live restarts passed, which is encouraging, not proof.
* **Who made the roughly 15 start attempts at about 17:15 to 17:30** is unknown.
* **The XAMPP Control Panel was not tested.** It may show MariaDB as stopped, and pressing Start would try a second server.
* **MariaDB does not start by itself after a reboot.** It is held by one PowerShell-launched process, with stdout and stderr going to files in the recovery folder. `CHECK` was run on the three repaired tables only; the other system tables read normally but were checked in the lab, not live.

## Recommended permanent startup and logging

1. Use one saved start script, outside the repository, with the Start-Process call used here. Point stdout and stderr at `C:\xampp\mysql\data\mysqld-stdout.txt`-style files, not the recovery folder.
2. Stop with `mysqladmin shutdown`.
3. Do not use the Control Panel for MySQL until it is tested on a copy.
4. Test a Windows service on a copy, as the long-term option, and check it with the same log-text scan.
5. After any start, confirm "ready for connections" appears in `mysql_error.log`. Its absence means the defect is back.
6. Rotate or archive `mysql_error.log`; it holds months of output.

## RC9 development activation

**GO to request authorization, under conditions:**

1. Start the window from the saved start script, not the panel.
2. Take a fresh backup and restore-verify it.
3. Set the packet size: edit `my.ini` and restart with the verified method, or use `SET GLOBAL` to avoid a restart.
4. Run the migration only with the "ready" line confirmed in the error log.
5. Resolve the start method for reboots first if development depends on this server surviving one.

This is a recommendation only. RC9 activation needs its own authorization.
