# Development activation preflight report: RC9

Date 2026-11-06. Target: `syllabus_cms_plus`.

**Recommendation: GO for a separately authorized activation, under the conditions in section 8. Nothing has been activated.**

During this preflight the development database was only read. The migration did not run on it, MySQL configuration did not change, no service was stopped, no real record changed, and no paid request was made. Nothing was committed, pushed or deployed. After all the work, the database inventory hash still equalled the backup's, and no migration object exists on it.

| Status | State |
|---|---|
| Offline implementation | Verified on RC9 |
| Backup and restore | Verified with a real backup on an isolated copy |
| Development activation | **Not done** |
| Staging readiness | **Not ready:** not assessed |
| Production readiness | **Not ready:** not claimed |
| Real Claude verification | **Not done** |

## 1. Source integrity

| Check | Result |
|---|---|
| Source hash | `b11c15c8713e44f4065ad28c8e4a6d288c5fb97ad51a46f5cddf2fe48cf1ceba`, equal to snapshot `rc9`; the supplied 49-character value is a correct prefix |
| Unrelated source changes | None: source and tree both unchanged against the snapshot, after all preflight work too |
| Branch and base | `New-Regression-Rulling`, `4d30dcb`; all RC work is uncommitted |
| Other Claude sessions | None. Codex processes exist on this machine; no source changed during the preflight |

## 2. Database compatibility

| Check | Result |
|---|---|
| Identity | `syllabus_cms_plus`, port 3306, `C:\xampp\mysql\data\`, MariaDB 10.4.32; hash `f7fbc8b43dce865b…` matches the reviewed target |
| Dry run | COMPATIBLE, zero writes |
| Disk | 35 GB free; backup is 34.7 MB |
| Connectivity | Connected; no session on this database at the check |
| Contents | 53 tables, 8,027 rows; 12 syllabi (9 draft, 2 for revision, 1 approved); 202 saved reports; 3 versions, 3 pointers, 8 `needs_review` rows |

**Schema drift against a fresh RC9 database.** Every table and column RC9 expects is present. Development also has items a fresh database lacks: 11 tables (`chk_decisions`, `chk_documents`, `chk_examples`, `chk_reference_events`, `chk_reference_sets`, `chk_runs`, `course_prerequisites`, `co_po_mapping`, `program_po_reference_migrations`, `program_po_reference_remediation`, `standard_changes`) and 2 columns (`courses.lecture_units`, `courses.lab_units`). None is a blocker: the two remediation-related tables come from the earlier controlled activation, a search found no application use of the others, and the migration does not touch them. Their origin was not traced further.

**Affected services.** MariaDB (pid 10312, started by the XAMPP Control Panel, not a Windows service), which also hosts `phpmyadmin` and three old `syllabus_e2e_*` databases. Apache (XAMPP). The dev API and Vite, which were not running at this check and must not be running during the window.

## 3. Backup and recovery readiness

A real full backup was taken read-only, with the options of `development-backup.cjs`.

| Item | Result |
|---|---|
| Size and hash | 34,679,779 bytes, SHA-256 `e1fab66620023bfc54ce3c0b57efb0470e6b44f38db2531cb7e954e0e77e20dd` |
| Consistency | Inventory identical before and after the dump |
| Restore into an isolated server | 53 tables, 8,027 rows; data hashes and table definitions all equal |
| Recovery drill | After a simulated failed window, restoring from the backup alone returned exactly the original |

The dump is at `C:\Users\JPDELR~1\AppData\Local\Temp\lcup-dev-rc9-activation-JIynvr\development-full-before.sql`. It **holds real records**, is outside the repository and contains no password. The restored copy was deleted. This backup is a verified preflight artifact, and its value ends once data changes: take a fresh one in the window.

## 4. Packet configuration plan

Confirmed: `C:\xampp\mysql\bin\my.ini`, section `[mysqld]`, line 37, `max_allowed_packet=1M`. `[mysqldump]` line 163 is already 16M. Live value 1,048,576. Largest saved report 914,798 bytes, 87% of the limit.

Requires a MariaDB restart from the XAMPP Control Panel, dropping every connection on that server, including phpMyAdmin. Data is not touched.

```powershell
Copy-Item C:\xampp\mysql\bin\my.ini C:\xampp\mysql\bin\my.ini.before-packet-16M
# edit [mysqld] line 37 to: max_allowed_packet=16M
# XAMPP Control Panel: MySQL Stop, then Start
& C:\xampp\mysql\bin\mysql.exe --host=127.0.0.1 --port=3306 --user=root -N -e "SELECT @@global.max_allowed_packet"
# must print 16777216
```

Rollback: copy the backup file back over `my.ini` and restart.

## 5. Migration execution plan

Rehearsed on the isolated copy of real data:

| Requirement | Result on the copy |
|---|---|
| Effect | Adds `program_po_reference_audit`; adds 6 columns to `program_po_reference_versions` and 4 to `program_po_reference_active` |
| Other tables | All 51 unchanged in data and definition |
| Integrity | `check.cjs verify`: VERIFIED; every old row and column unchanged |
| Faculty CLO mappings, syllabi, saved reports | Unchanged, by table hash |
| Historical PO versions | 3 versions and 3 pointers kept; new columns hold defaults |
| Inheritance | BSIT 9, BSIE 13, BSCpE 13, Cyber Security 9 from BSIT, through RC9 code |
| Repeat run | Changes nothing |
| Rollback before any save | Returned the copy exactly to the backup |

Exact commands for the window. **Do not run without authorization.**

```powershell
cd "C:\Users\JP Del Rosario\Syllabus-Repository"
node scripts/release/snapshot.cjs verify rc9                 # must say sourceUnchanged true
node scripts/po-reference-publication/check.cjs dry-run --host localhost --port 3306 --user root --database syllabus_cms_plus --expect-database syllabus_cms_plus --out <private>\dry.json
# fresh backup and restore verification, as in section 3
node scripts/po-reference-publication/check.cjs snapshot --host localhost --port 3306 --user root --database syllabus_cms_plus --expect-database syllabus_cms_plus --out <private>\before.json
cd server; npm run migrate-po-reference-publication; cd ..
node scripts/po-reference-publication/check.cjs verify --host localhost --port 3306 --user root --database syllabus_cms_plus --expect-database syllabus_cms_plus --before <private>\before.json --out <private>\after.json   # must print VERIFIED
```

Then start the API (`cd server; npm run dev`) and Vite (`npm run dev`), and confirm the login page, `/api/health`, and that an Admin outcomes dialog shows the reference panel and no "not set up" message.

## 6. Post-activation verification plan

Validation creates data, so it is split by where it runs. Recommended: run the full list on a restored copy with the scripted provider, then only read-only checks on development. Any run on `syllabus_cms_plus` itself creates throwaway records that need a cleanup decision.

| # | Check | Existing evidence on RC9 | After activation |
|---|---|---|---|
| 1 | Admin creates a program | Integration, E22/E23 | Copy |
| 2 | Applicable curriculum | Integration (**API only, no screen**) | Copy |
| 3 | Admin saves POs ("publish" no longer exists) | Integration, E23 | Copy |
| 4 | Faculty syllabus on the new program | Integration, E25 | Copy |
| 5 | Checker recognizes it | Integration | Copy |
| 6 | Correct PO count | Integration (5, 4, 3 POs) | Copy |
| 7 | Admin updates POs | Integration, E23, E25 | Copy |
| 8 | Syllabi keep old references | Integration, E25 | Copy |
| 9 | Review notice | E25 | Copy; development read-only: open syllabus 101 |
| 10 | Explicit adoption | Integration, E25 | Copy |
| 11 | CLO mappings unchanged | Integration, E25 | Copy |
| 12 | Alignment re-evaluated | Integration | Copy |
| 13 | Cyber Security inheritance | Integration, PO workflow | Development read-only (`check.cjs verify`) |
| 14 | Historical reports unchanged | Integration; hash on the copy | Development read-only (`check.cjs verify`) |
| 15 | Scoring and gates | K08, PO workflow, byte-identical rule files | Copy |

All with the scripted provider. Paid Claude testing needs separate authorization.

## 7. Risks and rollback

**Findings on real data, through RC9 code (ids only):**

| Syllabi | State | Meaning |
|---|---|---|
| 101, 102 | Editable, mapped | Show the review notice at once, and the check is refused with `po_mapping_remediation_required` |
| 110 | Editable, no mappings | Check refused, `curriculum_reference_review_required` |
| 43, 93, 97, 99, 100 | Subject no longer exists | Could not be evaluated against a subject |
| 40, 41, 74 | No subject chosen | Not affected |
| 16 | No structured content | Not affected |

**Main limitation, predating RC9.** All 8 `needs_review` rows belong to these syllabi, and **no application code clears such a row**. Adopting on 101 or 102 updates the statements, but the check stays refused until someone decides how those reviews close. These 8 syllabi stay blocked from checking after activation exactly as they are today.

**Other risks**
* `DFSFASDA` (1 PO, no version) stays CLO-PO NOT_CHECKED until an Admin records or removes it.
* After the migration, an Admin save immediately creates a live version of BSIT, BSIE or BSCpE.
* The window's first Admin save ends the rollback tool's use.
* The adopt path has run only on synthetic data.
* No Curriculum Management screen yet. RC9's unverified browser items remain (RC9 report, section 5).
* Staging, production and real Claude remain unverified.

**Reference-version consistency:** no inconsistency found. All versions resolve, and the check tool reported no drift.

**Rollback**

| Situation | Action |
|---|---|
| Before any save since the migration | `node scripts/po-reference-publication/rollback.cjs --database syllabus_cms_plus --expect-database syllabus_cms_plus --confirm-authorized`, then `check.cjs verify --before` |
| After any Admin save | The rollback tool refuses (rehearsed). Restore the fresh backup, under separate authorization |
| Restore procedure | Stop writers; `mysql --binary-mode --default-character-set=utf8mb4 --max-allowed-packet=128M syllabus_cms_plus < backup`, after confirming the SHA-256; compare the inventory |
| Packet | Section 4 |
| Code | RC9 report, section 8 |

Restoring replaces all data since the backup, so it needs its own explicit decision.

## 8. GO / NO-GO

**GO**, conditional on all of these:

1. Your written authorization for the window, naming `syllabus_cms_plus`: dev services kept stopped, the packet change, the migration.
2. A fresh backup taken and restore-verified in the window.
3. Source still `b11c15c8…`.
4. No editing session during the window.

**Decisions for you (not blockers):** how the 8 `needs_review` rows are closed; `DFSFASDA`; whether validation runs on a copy (recommended) or on `syllabus_cms_plus`; how long to keep the private backup.

This is a recommendation for development only.
