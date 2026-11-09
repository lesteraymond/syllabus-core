# Development activation report: RC9

Date 2026-11-06. Target `syllabus_cms_plus`. Source `b11c15c8713e44f4065ad28c8e4a6d288c5fb97ad51a46f5cddf2fe48cf1ceba`.

**Activation status: FAILED, halted before the migration.** MariaDB was later recovered under separate authorization: see `MARIADB-RECOVERY-REPORT.md`. RC9 remains not activated.

| Step | Result |
|---|---|
| Pre-activation checks | Passed |
| Dev API and Vite | Already stopped; nothing to stop |
| Fresh backup and restore verification | Passed |
| Packet change | **Not applied:** `my.ini` restored to its original bytes |
| MariaDB restart | **FAILED:** the server does not start |
| Migration | **Not run** |
| Post-migration verification and smoke tests | **Not run** |

## What happened

1. A clean `mysqladmin shutdown` stopped pid 10312, up since 2026-11-04.
2. Starting MariaDB with its original command failed: `Aria engine: log data error`, `last_log_page: (1,0x4000) is less than checkpoint page: (1,0x6000)`, then `Could not open mysql.plugin table`, then `Aborting`.
3. The effective value could not be verified, so the original `my.ini` was restored and a second start attempted. It failed the same way with the 1M setting.

**The packet change is not the cause:** the failure repeats with the original configuration.

**Root cause: not established.** The Aria control file names a checkpoint past the end of the Aria log. Whether that state existed before this window or came from the shutdown is unknown: the old server wrote no shutdown lines to the log. The shutdown I issued is what exposed it. A live restart was never rehearsed in preflight, and the preflight's "data is not touched" statement did not consider that the restart might fail.

## Data state

| Item | State |
|---|---|
| `syllabus_cms_plus` | Not migrated. All 53 tables are InnoDB, a separate engine from the failure |
| Live data directory | Not altered by me; MariaDB's own startup attempts wrote to its log and control files |
| Verified backup | 34,679,779 bytes, SHA-256 `e1fab666…`; restored: 53 tables, 8,027 rows, no differences |
| Failed data directory | Preserved as a full file copy, 212 MB |

Private folder (real records, outside the repository): `C:\Users\JPDELR~1\AppData\Local\Temp\lcup-dev-rc9-activation-7P2Zyw`

The live folder still has its `aria_log` files. `my.ini.before-packet-16M` remains beside `my.ini`.

## Recovery rehearsal, on a copy only

| Test on a copy of the failed data directory | Result |
|---|---|
| Start with no change | Failed the same way: reproduced |
| Remove `aria_log.00000001` and `aria_log_control`, then start | Started |
| `syllabus_cms_plus` against the verified inventory | **Identical: 53 tables, 8,027 rows, no differences** |
| `mysql` system tables, `phpmyadmin` and others | Present and readable |
| `mysqlcheck --all-databases` | All OK except a size warning on `mysql.roles_mapping` |

Limits: the copy ran with test options, not the live `my.ini`. Removing Aria logs discards any unflushed Aria recovery data, which concerns only the system tables here. The `mysql.roles_mapping` warning has not been compared with its state before the failure.

## Recovery options

| Option | Effect |
|---|---|
| **A. Remove the two Aria log files on the live folder, then start** (recommended, rehearsed) | No academic data loss on the copy. Touches only Aria recovery files |
| B. Restore `syllabus_cms_plus` from the backup into a rebuilt server | Heavier; the backup covers only that database, so `phpmyadmin` and the old test databases are not covered by it |
| C. Leave the server down and investigate further | No risk to data; development stays unavailable |

Each option needs separate authorization: repairing server files was outside the activation scope.

## Preserved records

Syllabi 101, 102, 110, 43, 93, 97, 99, 100 and program `DFSFASDA` were not touched.

## Not claimed

No application smoke test ran, no reference was verified on a migrated database, and staging, production and real Claude remain unverified. **Do not begin staging preparation from this activation.**
