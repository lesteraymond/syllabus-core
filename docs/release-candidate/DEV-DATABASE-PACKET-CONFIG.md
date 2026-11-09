# Development database `max_allowed_packet`: prepared change (NOT applied)

Date 2026-11-06. **Nothing here has been executed.** The shared development server (XAMPP MariaDB 10.4.32, pid 10312, datadir `C:\xampp\mysql\data\`) is not changed by this document, and its owner decides whether and when to change it.

## Finding (read-only)

| Item | Value |
|---|---|
| Live value (`SELECT @@global.max_allowed_packet`, from the read-only dry run) | 1,048,576 bytes (1 MB) |
| Where it comes from | `C:\xampp\mysql\bin\my.ini`, section `[mysqld]`, line 37: `max_allowed_packet=1M` (the `[mysqldump]` section, line 163, already has `16M`) |
| Requirement | at least 16 MB (`docs/deployment/DATABASE-REQUIREMENTS.md`): a comprehensive check report is about 0.8 MB and grows with the syllabus; a larger report is refused with HTTP 507 `report_too_large`, so a 1 MB server cannot store comprehensive reports reliably |
| Effect on the PO publication migration | none; the migration statements are small. The packet size matters for saving comprehensive reports, not for activation |
| Effect on the ordinary checker | none while the comprehensive profile and Policy V2 stay off (reports are small) |

**Largest saved report on the development database (read-only, 2026-11-06): 914,798 bytes, 87% of the limit.** A slightly longer syllabus would be refused. Make this change before relying on comprehensive reports.

## Prepared change (for the server owner)

1. Back up `my.ini` (copy to `my.ini.before-packet-16M`).
2. In `[mysqld]` change line 37 from `max_allowed_packet=1M` to `max_allowed_packet=16M`.
3. Restart MariaDB from the XAMPP control panel (a service restart; no data is touched). No application session should be mid-save: choose a quiet moment.
4. Verify: `SELECT @@global.max_allowed_packet;` returns `16777216`, and open a new connection (the session value follows the global one for new connections).
5. Re-run the read-only dry run: `node scripts/po-reference-publication/check.cjs dry-run --host localhost --port 3306 --user root --database syllabus_cms_plus --expect-database syllabus_cms_plus --out <file>`; it must now report `maxAllowedPacketBytes` 16777216 and still say COMPATIBLE.

Alternative without a restart: `SET GLOBAL max_allowed_packet = 16777216;` applies to new connections only and is lost on the next restart, so it is not a substitute for the file change.

## Rollback

Restore the `my.ini` copy and restart the server. Raising the limit stores nothing and changes no data.

## Not authorized

This document is not an authorization to alter the server. Raising the limit, applying the PO publication migration and any publication each need the owner's explicit decision (`DEVELOPMENT-ACTIVATION-PLAN.md`, section 7).
