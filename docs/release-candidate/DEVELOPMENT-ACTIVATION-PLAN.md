# Controlled development activation plan: additive PO reference publication migration

Date 2026-11-06. **This is a plan. Nothing in it has been executed against development, staging or production.** Activating needs separate explicit written authorization naming the database below. The one thing run against development so far is the **read-only dry run** (`po-publication-dry-run-development.json`: COMPATIBLE, 0 writes).

## 0. What activating changes, and what it does not

Adds (migration `server/db/migrate-po-reference-publication.js`, `npm run migrate-po-reference-publication`): table `program_po_reference_audit`; six columns on `program_po_reference_versions` (`status` default `published`, `academic_year`, `published_by`, `published_at`, `supersedes_reference_id`, `created_by`); four columns on `program_po_reference_active` (`association` default `owner`, `associated_by`, `associated_at`, `association_note`). It changes no existing row and creates no version.

**Effect after the migration (the policy in `ADMIN-PO-REFERENCE-UI.md`):** each Admin save of Program Outcomes immediately makes a new version in force for that program and academic year, and saves of EGAs and Vision/Mission are logged. There is no approval step. BSIT, BSIE and BSCpE become editable, and a save supersedes their source version.

## 1. Exact target

| Item | Value (read-only, 2026-11-06) |
|---|---|
| Database | `syllabus_cms_plus` on `localhost:3306`, server host `JpDelRosario`, datadir `C:\xampp\mysql\data\`, MariaDB 10.4.32 |
| Identity hash (from the earlier controlled PO activation) | `f7fbc8b43dce865b2c95eb7ea0718238e40455a93c0aa25dac2930ec9e124fd3` |
| Existing reference rows | 3 versions (BSIT, BSIE, BSCPE `lcup-po-2026-10-29`), 3 active pointers (Cyber has no pointer of its own: it inherits BSIT through `program_outcome_sources` 17 -> 1), 8 `needs_review` rows (syllabus 43, 93, 97, 99, 100, 101, 102 PO mappings; 110 curriculum) |
| `max_allowed_packet` | **1,048,576 (1 MB)**. Not needed by the migration, but a full comprehensive check report (~0.8 MB, larger for long syllabi) is refused with HTTP 507 `report_too_large`. Raise to >= 16 MB (`docs/deployment/DATABASE-REQUIREMENTS.md`) before comprehensive checking in development, as a separate change to the shared server that its owner must approve |
| Policy V2 / comprehensive profile in the development runtime | unset (off); the migration does not change this |
| Connecting user | `root` (ALL PRIVILEGES) is enough; for a least-privilege account grant CREATE, ALTER, INDEX, REFERENCES only for the migration window |

## 2. Before the window (no change to development)

1. Source frozen and verified: a snapshot hash recorded, `npm test`, `npm run test:vpaa`, `npm run build`, E01-E24 (flags off and on), K01-K10, B01, the four-program PO browser workflow and `scripts/release/dynamic-reference.integration.test.cjs` all passing on that exact hash (see the final report for the hash and results).
2. Rehearsal on a synthetic old-schema database passes (`node scripts/po-reference-publication/rehearsal.cjs`, evidence `po-publication-rehearsal.json`: dry run, apply, verify, idempotent re-apply, rollback, rollback refusal after a publication).
3. Dry run against the real target is COMPATIBLE: `node scripts/po-reference-publication/check.cjs dry-run --host localhost --port 3306 --user root --database syllabus_cms_plus --expect-database syllabus_cms_plus --out <file>` (read-only; the password, if any, comes from the environment variable named by `--password-env`).
4. The authorization to apply the migration exists in writing: the exact database, the migration, the date and the person. (This authorizes the database change. It is not an academic approval: the policy has none.)

## 3. Backup and restore verification (in the window, before the migration)

1. Stop writers (application API in maintenance, or confirm no editing session); record `SELECT NOW()`.
2. Full logical backup including routines, triggers and events: `mysqldump --single-transaction --routines --triggers --events syllabus_cms_plus > <private dir>\development-full-before.sql`; record size and SHA-256. Keep it outside version control (it contains personal data).
3. Restore it into a **separate loopback MariaDB instance** (own datadir, own port, events off) and compare table list, row counts and per-table hashes with the live database (the earlier activation proved 48 tables / 8,311 rows this way). Abort if they differ.
4. `node scripts/po-reference-publication/check.cjs snapshot ... --out before.json` against the live database (fingerprints of the reference tables, programs, outcomes, EGAs, syllabi, versions, saved reports, AI runs, curricula, institution settings; the four programs' resolved PO counts 9 / 13 / 13 / 9; the eight review rows).
5. Rehearse the migration and the rollback on the restored copy: apply, `verify --before`, roll back, `verify --before` again. All must report no preservation problem.

## 4. Applying the migration (only after steps 2-3)

1. `cd server && npm run migrate-po-reference-publication` against `syllabus_cms_plus` (about a second; additive `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN` guarded by `SHOW COLUMNS`; safe to repeat).
2. Immediately: `check.cjs verify ... --before before.json --out after.json` must print `VERIFIED`: every old row and column unchanged, new columns hold their defaults, no adoption, empty audit table, the four programs still resolve 9 / 13 / 13 / 9 with the same references, and the eight reviews intact.
3. Keep `before.json`, `after.json`, the backup hash and the authorization with the activation record.

## 5. Verification after activation

* **Existing programs:** read-only: `mastersFor` for BSIT/BSIE/BSCpE/Cyber (done by `verify`); a check of a synthetic syllabus on the application still produces the same official score and threshold 79 (scripted provider, Policy V2 and the profile off for ordinary users, exactly as now).
* **Admin save (on a synthetic program only):** an Admin creates a **throwaway synthetic program** (not one of the four, with a name that says so), confirms version 1 is in force, edits one Program Outcome, saves, and confirms version 2 is in force, version 1 is kept, and the change log shows who, when, and both versions.
* **New-program Policy V2 (scripted):** with the synthetic program, Policy V2 enabled only in an isolated test process (not the shared runtime), a scripted provider evaluates its CLO-PO relationships against the published version and the saved report names the version, hash and program year; before publication they are NOT_CHECKED.
* **Cache and history:** a new version re-asks only CLO-PO relationships; saved reports are unchanged.

## 6. Rollback and recovery

* **Nothing saved yet since the migration:** `node scripts/po-reference-publication/rollback.cjs --database syllabus_cms_plus --expect-database syllabus_cms_plus --confirm-authorized` removes exactly the added columns and the audit table, then `check.cjs verify` must show no preservation problem (the new structure is reported absent). It refuses, and changes nothing, if the audit table has rows or any administrator-published version, draft or adoption exists.
* **After any Admin save of a PO, EGA, Vision or Mission:** the rollback tool refuses, because the audit trail and versions would be lost. The structure is then data. Recover from the verified backup only under separate authorization (the earlier controlled activation's guarded rollback pattern: stop writes, re-verify identity and backup hash, prefer a selective recovery over replacing the live database, never overwrite later faculty work).
* **Code rollback:** redeploy the previous backend; the previous code reads the old columns and ignores the new ones. The extra columns are harmless to it.

## 7. Authorization still required, and what stays out of scope

* Separate written authorization to apply the migration to `syllabus_cms_plus` (this plan is not that authorization).
* Separate authorization for staging and production; neither exists.
* Raising the shared server's `max_allowed_packet` (its owner's decision).
* Changing any real program's references after activation is ordinary Admin work and needs no further authorization here. Testing it on real programs during this activation is out of scope: use the synthetic program.
* Vision/Mission/EGA history (`INSTITUTIONAL-REFERENCE-VERSIONING-AUDIT.md`). The Admin panel is mounted and stays inert until the migration is applied (`ADMIN-PO-REFERENCE-UI.md`).

## 8. Operator sequence (prepared, not executed)

Prepared 2026-11-06. Every step below that changes something needs its own authorization (section 9). The verified source for this sequence is RC9 (`b11c15c8…`, `RC9-REGRESSION-REPORT.md`), which closes the implicit-adoption gap.

1. Freeze: confirm the deployed source hash equals the verified candidate. Stop the dev API and Vite (no editing session).
2. Read-only: `check.cjs dry-run` must say COMPATIBLE, and `scripts/po-controlled-activation/development-safety.cjs` identity must match.
3. Backup: `node scripts/po-controlled-activation/development-backup.cjs` (private temp folder, never the repository; contains real records). Record size and SHA-256.
4. Restore verification: restore into a separate loopback instance with `--max_allowed_packet=16M`, compare tables, row counts and per-table checksums. Abort on any difference.
5. Baseline: `check.cjs snapshot ... --out before.json`.
6. Rehearse on the restored copy: migrate, `verify --before`, roll back, `verify --before`.
7. **Packet change** (`DEV-DATABASE-PACKET-CONFIG.md`), then verify 16777216 and rerun step 2.
8. **Migration:** `cd server && npm run migrate-po-reference-publication`.
9. Integrity: `check.cjs verify --before before.json --out after.json` must print VERIFIED.
10. Post-activation validation (section 5). Admin record for the one unversioned program: see section 10.
11. Keep the backup hash, before.json, after.json and the authorization with the activation record.

## 9. What needs separate explicit authorization

| Operation | Changes | Reversible |
|---|---|---|
| Stopping the dev API and Vite for the window | service availability only | yes |
| Real backup of `syllabus_cms_plus` (copies real records to a private folder) | no database change | delete the files |
| `max_allowed_packet` 1 MB to 16 MB (`my.ini` plus a MariaDB restart) | server configuration, restart affects everything on that server | restore `my.ini`, restart |
| `npm run migrate-po-reference-publication` on `syllabus_cms_plus` | adds 1 table and 10 columns | rollback tool until the first Admin save; afterwards backup only |
| Synthetic-program validation on the real database (section 5) | creates a throwaway program | needs its own cleanup decision |

## 10. Development data notes (read-only, 2026-11-06)

Identity matches the reviewed target (`f7fbc8b43dce865b…`). 53 tables, about 30 MB; a backup needs little disk (35 GB free). 12 syllabi, 202 saved reports, 3 versions, 3 pointers, 8 `needs_review` rows. The event scheduler is off and no session was connected to the database at the check.

Program `DFSFASDA` (2026–2027, 1 PO) has no version. After the migration its CLO-PO stays NOT_CHECKED until an Admin records it or removes it. The name looks like test data, but that is the owner's decision.
