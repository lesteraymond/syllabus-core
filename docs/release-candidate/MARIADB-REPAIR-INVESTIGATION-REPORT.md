# MariaDB repair investigation report

Date 2026-11-06. Isolated testing only. The live server (pid 15544) was not stopped, restarted, repaired or reconfigured. Its database files were read, and read-only queries were sent in the first phase. No repair ran on a live table, and the RC9 migration did not run.

**Recommendation: GO to request authorization for the live repair. NO-GO for RC9 activation until that repair is done and verified.**

## 1. Corruption findings

**Root defect: MariaDB's own log output is being written into system-table files.** This is the main finding.

* Log text (`Aborted connection`, InnoDB monitor output, `ready for connections`) sits inside `.MAD` and `.MAI` files.
* It explains the abnormal sizes: the extra bytes in `db.MAI`, both `proxies_priv` files and both `roles_mapping` files are log text.
* `mysql_error.log` has held no "ready for connections" line since 2026-09-21, because that output went elsewhere.
* The target file changes per start: `db.MAD`, `proxies_priv.MAI`, `roles_mapping.MAI` and `proxies_priv.MAD` were all seen.
* **Reproduced in isolation with the real `my.ini`:** 3 starts, 3 different table files hit. A fresh error log did not help.
* **Prevented in isolation:** starting with real output handles sent everything to the error log, and no system-table file changed (1 start) and across a further 3 starts in the verification below.

| Table | Engine | Finding |
|---|---|---|
| `mysql.db` | Aria | Expected index 24,576 bytes, actual 225,329. Page checksum fails |
| `mysql.proxies_priv` | Aria | Index 186,764, data 79,004, expected 24,576 and 16,384. Page checksum fails |
| `mysql.roles_mapping` | Aria | Index 30,026, data 67,047, expected 8,192 each. 0 rows. "Usable but should be fixed" |
| Index-header log fragments | Aria | Also in `global_priv.MAI` and `procs_priv.MAI`, sizes normal, `CHECK` OK |

All of `syllabus_cms_plus` is InnoDB. No log text was found in an InnoDB file.

**Live state, worse than the preserved copy.** The live `db.MAD` data page at byte 8192 has been overwritten by log text since the recovery start at 17:34:47, and writes continue as the server logs. On that file the 3 rows are gone; a repair of it returns 0 rows. They survive in the preserved copies. The live server's memory holds no database-level grants, so `pma` has lost its `phpmyadmin` grant and root its proxy grant until the repair.

**Corrections to `MARIADB-RECOVERY-REPORT.md`.** That report said `db.MAD` changed harmlessly at startup. It was overwritten. It also said row counts worked: `COUNT(*)` reads metadata and did not prove the rows were readable. "`COUNT(*)` works" was not evidence of health.

## 2. Recommended repair method

Do **not** use index-only repair: `aria_chk --recover --quick` reported 0 records and left the tables unreadable.

Use online `REPAIR TABLE` on a server started with real output handles, after restoring `db.MAD` and `db.MAI` from the preserved copy, because the live `db.MAD` no longer holds the rows.

| Method on a lab copy | Result |
|---|---|
| `aria_chk --recover --quick` | **Failed:** 0 records, unreadable |
| `aria_chk --recover` | Rows recovered; `CHECK TABLE` then reports "from another system" |
| `aria_chk --safe-recover` | Same |
| **`REPAIR TABLE` online** | **All rows recovered; `CHECK ... EXTENDED` OK** |
| `REPAIR TABLE` on the live-state `db.MAD` | **Rows changed 3 to 0.** This must never be run without restoring the file first |

## 3. Isolated repair results

Rows are as expected, `CHECK TABLE ... EXTENDED` is OK on all three tables, and `mysqlcheck --all-databases` has no non-OK line. File sizes return to the expected values.

## 4. Privilege integrity

| Item | Live memory today | After repair (lab) |
|---|---|---|
| `mysql.db` rows | Not loaded | 3: `%`/`test`, `%`/`test\_%`, `localhost`/`phpmyadmin`/`pma` |
| `pma` grants | USAGE only | USAGE and SELECT, INSERT, UPDATE, DELETE on `phpmyadmin` |
| Root global grants | ALL | ALL, unchanged |
| Root proxy grant | Missing | `GRANT PROXY ON ''@'%'` restored |
| `global_priv` | 4 | 4 |
| `roles_mapping` | 0 | 0 |

**Nothing identified as lost.** `proxies_priv` holds 1 row. The name `ec2amaz-mo1l50m` in its page is not a lost row: the XAMPP original has the same text and a header count of 1, so it is a leftover from the build machine.

Authentication: root connected throughout. Login as `pma` was not tested, so its grants are shown, not exercised. The live database-level grants were compared by memory, not from a healthy table.

`syllabus_cms_plus` after repair: inventory hash equal to the verified backup, 53 tables, 8,027 rows. All other databases are readable.

## 5. Clean restart verification

On lab copies, with the real `my.ini` with paths rewritten (lines 138 and 140 hard-code live InnoDB paths, and the lab refused to run if any live path remained):

| Step | Result |
|---|---|
| Start, repair, clean shutdown | Clean stop in 1 s |
| Restart 1 | Up; rows, `CHECK` and grants correct |
| Clean shutdown, restart 2 | Up; same; inventory equal |
| Error log | 3 "ready" lines; 1 `[ERROR]`, the expected moved-file notice |
| Live-state rehearsal, including a restart | Same result; inventory equal |

Pre-existing log fragments stay in five `.MAI` files, inside the header area; `CHECK` passes. No check was made of whether those specific bytes are unused by Aria.

## 6. Remaining risks

* **The Control Panel start is unproven and presumed unsafe.** The old panel-started server had the defect. The panel itself could not be tested. The hypothesis is that it gives mysqld no usable output handles.
* **The exact internal cause is not established.** The test shows the working start method, not why the other fails.
* **The original Aria startup failure remains unexplained.** The failed Aria log holds no log text, so this mechanism does not directly explain it. A further occurrence is possible.
* **Until the repair, the live server keeps writing log text into `db.MAD`.** Each logged event adds to it. It is bounded to that file so far, but the target is set at start.
* The console-window start (like `mysql_start.bat`) was inconclusive: that test's server did not start.
* The redirected start was exercised from PowerShell, not as a Windows service or at reboot. It will not start by itself.
* A stale recovery step: `data-before-recovery` has pre-recovery `aria_log_control`. Do not restore that file.
* Real records live in `C:\Users\JP Del Rosario\LCUP-DB-Recovery-2026-11-06`, restricted to your account and SYSTEM, not encrypted.

## 7. Proposed live repair procedure

**Needs your authorization. Do not press Start in XAMPP at any point.** Dev API and Vite must be stopped.

```powershell
# Paths
$Rec='C:\Users\JP Del Rosario\LCUP-DB-Recovery-2026-11-06'
$Data='C:\xampp\mysql\data'; $Bin='C:\xampp\mysql\bin'

# 1. Fresh logical backup (read-only), then restore-verify it on an isolated instance. Stop on any difference.

# 2. Stop the live server cleanly; confirm no mysqld remains
& "$Bin\mysqladmin.exe" --host=127.0.0.1 --port=3306 --user=root shutdown

# 3. Cold copy of the whole data folder; verify by hash
Copy-Item -LiteralPath $Data -Destination "$Rec\data-before-live-repair" -Recurse

# 4. Restore only the two mysql.db files from the preserved copy
Copy-Item "$Rec\data-before-recovery\mysql\db.MAD","$Rec\data-before-recovery\mysql\db.MAI" "$Data\mysql\" -Force

# 5. Start with real output handles
$Out="$Rec\recovery-evidence"
Start-Process -FilePath "$Bin\mysqld.exe" -ArgumentList '--defaults-file="C:\xampp\mysql\bin\my.ini"','--standalone' -WorkingDirectory 'C:\xampp' -WindowStyle Hidden -RedirectStandardOutput "$Out\mysqld-stdout.txt" -RedirectStandardError "$Out\mysqld-stderr.txt"

# 6. Repair exactly these three tables
& "$Bin\mysql.exe" --host=127.0.0.1 --port=3306 --user=root -e "REPAIR TABLE mysql.db; REPAIR TABLE mysql.proxies_priv; REPAIR TABLE mysql.roles_mapping; FLUSH PRIVILEGES;"
```

7. Verify: `mysql.db` 3 rows, `CHECK TABLE ... EXTENDED` OK on all three, grants as in section 4, inventory equal to the fresh backup, `ready for connections` in `mysql_error.log`, no change in other system-table files.
8. One clean restart by the step 5 method, and verify again.
9. **Stop conditions:** a `REPAIR` row-count warning, any inventory difference, or a failed start. Nothing further runs; report.
10. **Rollback:** stop the server, restore the step 3 copy of the changed `mysql\db.*`, `proxies_priv.*` and `roles_mapping.*` files. A whole-folder restore needs its own decision.

**Start method going forward:** step 5 from a saved script, not the Control Panel, until the panel is proven safe on a copy.

## Packet size and activation

`SET GLOBAL max_allowed_packet = 16777216` can avoid a restart. **Evaluated on a lab server:** the value took effect at once, new connections used 16 MB, a 2 MB value stored, and it reverted to 1 MB after restart, so `my.ini` must be edited too.

Limits: existing connections keep their old value (documented MariaDB behavior, not tested here), so the API must start afterwards. My 1 MB comparison insert did not prove rejection, because `REPEAT()` runs on the server.

**Recommended:** since the repair needs a restart anyway, edit `my.ini` to 16M before step 5, and fall back to `SET GLOBAL` only if a restart is refused.

**Proposed sequence, each step separately authorized:**

1. Live system-table repair (section 7).
2. Packet size, in the same restart.
3. Fresh backup and restore verification.
4. `snapshot`, migration, `verify` (`DEVELOPMENT-ACTIVATION-PLAN.md`, section 8).
5. Post-migration validation, read-only on development, write-based on a restored copy.

## 8. GO / NO-GO

* **Live repair: GO to request authorization.** Rehearsed on the live state, including restart.
* **RC9 activation: NO-GO** until the repair is verified live.
* **Do not use the XAMPP Control Panel to start MariaDB** until proven safe.
