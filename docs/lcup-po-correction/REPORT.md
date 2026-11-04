# Official PO correction: isolated implementation and verification

Date: 2026-10-29. Reference version: `lcup-po-2026-10-29`.

The correction is implemented and tested in isolation. The existing database was accessed through SELECT-only, read-only transactions and remains unchanged. No migration was run against faculty records. The disposable database was migrated, verified, rolled back and shut down. No paid AI request, commit, push or deployment occurred.

## Official data

The user's instruction establishes the authority of these documents; no additional documents or repeat curriculum audit is needed.

| Program | Resolved POs after isolated migration | Official reference | Physical PO rows |
|---|---:|---|---:|
| BSIT | 9 | IT-101-Introduction-to-Computing-.pdf, pages 2–3 | 9 |
| BSIT–Cyber Security | 9 | Inherits BSIT through `program_outcome_sources` | 0 |
| BSIE | 13 | IE-403-Operation-Management.pdf, pages 2–3 | 13 |
| BSCpE | 13 | CPE-404-Digital-Signal-Processing.pdf, pages 2–3 | 13 |

[Exact corrected wording and numbering](exact-program-outcomes.md) lists all 35 source statements, source pages and SHA-256 hashes. [Canonical machine-readable data](../../src/data/officialProgramOutcomes.json) also retains raw extracted lines. Whitespace and line wraps are normalized; spelling and punctuation are preserved. Cyber has a source link rather than an independently editable copy. Its program ID, subjects and separate 2025–2026 curriculum remain unchanged.

Both engineering programs now resolve this complete PO12 in the isolated corrected state:

> Knowledge and understanding of engineering and management principles as a member and leader in a team, to manage projects and in multidisciplinary environments.

The source PO columns do not establish an authoritative PO–EGA crosswalk. New references therefore contain empty crosswalk arrays. Historical crosswalks are preserved in the original syllabus/catalog data and migration backup; none were assigned to different PO meanings. Direct CLO–EGA mappings remain unchanged.

## Existing database and historical impact

Before and after read-only verification found 10 own BSIT POs, 10 own Cyber POs, 13 BSIE POs and 13 BSCpE POs. The existing database still has those original values and no new official active reference assignments. Applying this correction there requires separate explicit approval.

Seven current syllabus records have PO-linked CLOs under a previous, partial or unknown reference basis:

| Syllabus ID | Program | Status | Required handling |
|---|---|---|---|
| 43 | BSIT | draft | Authored PO basis is unknown; recover/confirm meanings before adoption |
| 93 | BSIT | for_revision | Review mappings from the old ten-PO basis |
| 97 | BSIE | draft | Review mappings from a partial PO snapshot |
| 99 | BSIT | draft | Review CLO mappings and 30 direct ILO–PO mapping entries |
| 100 | BSIE | draft | Review mappings from a partial PO snapshot |
| 101 | BSIE | for_revision | Review mappings from the previous engineering basis |
| 102 | BSIT | draft | Review mappings from the old ten-PO basis |

No mapped current Cyber/BSCpE syllabus or catalog CLO row was identified in this snapshot. This does not establish that their historical versions contain no mappings. Historical versions and checker reports are preserved, rather than rewritten or relabelled as current-reference results.

[Remediation worksheets](remediation-worksheets.json) retain old PO text, current number tags and content hashes. All proposed replacement numbers, faculty decisions, reviewer identities and adoption confirmations are blank. They are review inputs, not an executable crosswalk. After a future approved rollout, corresponding sidecar queue records prevent a text-only replacement of the PO list from falsely confirming the old CLO mappings. Direct ILO–PO tags receive the same reference protection.

Faculty must explicitly compare meanings and confirm each affected relationship. For an approved or historical version, preserve the original and use a separately authorized new revision. This implementation does not include a faculty decision writer or silently mark any queue item resolved. A reviewed remediation operation and its evidence are still needed before those records can be checked against the corrected reference. Old saved reports remain readable.

Read-only before/after hashes match for all protected database tables:

| Table | Rows |
|---|---:|
| syllabi | 15 |
| syllabus_versions | 18 |
| syllabus_check_reports | 197 |
| ai_check_runs | 288 |
| syllabus_check_decisions | 780 |
| syllabus_check_curricula | 4 |
| curriculum | 39 |
| courses | 243 |
| course_clos | 0 |
| program_egas | 20 |
| institution_egas | 4 |
| institution_settings | 1 |

Evidence: [initial read-only plan and complete 62-FK inventory](live-readonly-plan.json), [final read-only plan](live-readonly-final-plan.json), [verification log](live-verification.log), and [record/FK impact assessment](database-impact.md). The impact report covers direct program/course dependencies. `course_clos.po_nos`, syllabus JSON tags, `curriculum.learning_outcomes` and course standards snapshots have semantic PO dependencies without a foreign key to PO numbering. Those stored values are not rewritten.

## Tables, resolution paths and APIs

The migration changes only `program_outcomes`, `programs.pos_version`, the intended `program_outcome_sources` link, and the four new support tables below. All stable program/course IDs and existing foreign keys remain in place.

| Table | Purpose and handling |
|---|---|
| program_outcomes | Replace the three canonical current lists; remove the competing Cyber copy; preserve all previous rows in the required backup |
| programs | Increment `pos_version` for all four programs, invalidating stale catalog editors |
| program_outcome_sources | Link Cyber to BSIT using the existing intended mechanism |
| program_po_reference_versions | Add three source-attributed versions containing exact PO JSON, PDF hashes and source paths |
| program_po_reference_active | Activate canonical versions; Cyber resolves the parent's assignment |
| program_po_reference_migrations | Record migration ID, backup hash, applied snapshot and rollback status |
| program_po_reference_remediation | Sidecar review queue; no update to faculty content |

New foreign keys bind source links/versions/active assignments to stable program IDs, active assignments to reference IDs and remediation entries to the migration audit. Immutable version FKs restrict deletion rather than discarding reference history. Program deletion UX was not redesigned or tested; an attempted deletion may surface an FK refusal. The migration does not delete programs.

Shared `loadResolvedProgram` and subject `inheritStandards` resolution now supply the same official reference to the Builder and Hybrid-2 `mastersFor`. Program API lists report nine inherited Cyber outcomes even though it has zero own rows. New reference IDs/source hashes enter the existing checker master fingerprint. Existing report JSON is unchanged; reuse must satisfy the normal fingerprint checks.

Affected API/service paths:

- `GET /programs`, `GET /programs/:id/outcomes`: resolved counts, source/version metadata and inherited POs.
- `PUT /programs/:id/outcomes`: active official PO sets reject in-place edits; a new approved reference version is required.
- Course GET/detail/standards and `PUT /courses/:id/standards`: resolve current official POs; refuse in-place official PO edits and adoption of catalog CLO mappings with conflicting stored PO context.
- Syllabus content save/legacy adoption: preserve known authored snapshots; refuse implicit adoption of unknown PO meanings.
- Hybrid-2 checking through the shared compliance service and refinement route: carry the syllabus ID to the pending-remediation guard and validate authored PO context before evaluation.
- Source seeders: use official canonical text only for missing canonical sets, skip a copied Cyber set, and skip the historical IT204 CLO seed that lacks a verified mapping crosswalk. Existing populated records are not overwritten by seeders.

`catalogUse`, program-management/delete dependencies, program EGA handling, institution APIs, Builder read-only outcome views, submission snapshots and checker fingerprints were inspected as dependencies. They continue to use stable IDs or the shared resolver; no separate checker or PO-number conversion engine was added. The archived `server/db/local-outcome-data.cjs` remains historical evidence and is no longer the current PO seed authority; it still supplies existing EGA defaults in the local seeder. Ordinary seeders are not a repair command for an existing database. Fresh installations need the explicit versioned migration to establish the active assignments and Cyber link.

The existing inheritance implementation also shares EGAs. The migration refuses to proceed if Cyber and BSIT EGA rows differ, and the disposable test proves those rows remain unchanged. It does not broaden inheritance to subjects or curricula.

## Migration and rollback

Implementation: [official-po-migration.cjs](../../server/db/official-po-migration.cjs). Transport: [disposable-only CLI](../../scripts/lcup-po-correction/migrate.cjs). Neither automatically loads `server/.env` or runs on application startup. The CLI requires localhost port 43308, a database named `lcupo_test_<digits>`, and the exact workspace-owned `tmp/lcup-po-correction-db/data` server directory before any migration action. There is deliberately no existing-database apply command in this deliverable.

Preconditions and backup requirements:

1. Use a disposable database and a controlled maintenance window with no application writes.
2. Verify official PDF hashes, expected counts and contiguous numbering. All four stable programs must exist. Refuse conflicting inheritance, pre-existing active target references or mismatched Cyber/BSIT EGAs.
3. Create a new, non-overwriting JSON reference backup containing all mutation-target rows, historical impact details and protected-table digests. Supply its exact precondition hash on apply/rollback. The code checks the live snapshot and source data against it. Retain backups securely: they include historical syllabus excerpts.
4. Before any separately authorized existing-database rollout, additionally take and verify a recoverable full database backup. The JSON reference backup is sufficient for this migration's own mutations, but is not a full disaster-recovery dump. No production backup/restore exercise was performed here.

Support DDL is additive and executes before the data transaction because MySQL DDL commits implicitly. A failed data transaction leaves the old functional state and possibly empty support tables. Actual PO/link/version/queue changes are atomic under a serializable transaction with target program row locks, a repeated precondition check, exact post-update PO verification and protected-data digest verification. An injected mid-migration failure was tested successfully. Idempotent replay requires the same backup and unchanged post-state.

Rollback requires the same backup, maintenance confirmation and unchanged post-migration snapshot. It restores previous PO rows, version counters and source links; removes active assignments; marks the migration/queue rolled back; and retains inactive source-version and audit tables. It does not drop tables or erase audit history. New/edited protected records or reference drift cause rollback to refuse, avoiding reinterpretation of records created under the corrected basis. Such a refusal needs a separately reviewed forward correction or recovery plan. A rolled-back migration ID cannot be reapplied; use a reviewed new version rather than erasing its audit record.

Reproduce the real disposable test on this machine (XAMPP MariaDB is installed at `C:\xampp\mysql\bin`):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/lcup-po-correction/start-disposable.ps1
node --test scripts/lcup-po-correction/migration.test.cjs
node scripts/lcup-po-correction/stop-disposable.cjs
```

The start script was executed successfully. `-ExecutionPolicy Bypass` applies only to that child process; the host blocks `.ps1` execution by default. The script starts the existing isolated data directory, refuses an occupied port and uses a hidden window. The test independently verifies the actual server directory/port before creating a new synthetic database. It never imports faculty rows. All previous disposable databases/backups are retained; no cleanup deletion is performed.

For a new workspace only, initialize a **new empty** isolated data directory with `mysql_install_db.exe`, `--datadir=<workspace>\tmp\lcup-po-correction-db\data`, `--port=43308` and the test-only password `lcup-po-isolated-only`. Never initialize over existing database files. This initialization was executed only for the new disposable directory used here.

For manual exercises on a prepared fresh synthetic schema, the guarded CLI sequence is:

```powershell
node scripts/lcup-po-correction/migrate.cjs backup --config <disposable-json> --backup <new-backup-json>
node scripts/lcup-po-correction/migrate.cjs apply --config <disposable-json> --backup <same-backup-json> --expected <beforeHash> --maintenance
node scripts/lcup-po-correction/migrate.cjs rollback --config <disposable-json> --backup <same-backup-json> --expected <beforeHash> --maintenance
```

These are syntax templates, not commands to run against the existing database. The latest `disposable-config.json` points to a test schema that has already been rolled back. The test runner creates a new schema for a new exercise. The migration module and integration test were executed; separate manual CLI apply/rollback invocations were not counted as additional tests.

## Tests executed

Final successful runs: **225 tests passed, zero failed**, across five disjoint targeted groups. AI/provider tests use existing mocks. No full `npm test` was run because it can rewrite evaluation artifacts.

| Group | Command | Passed | Log |
|---|---|---:|---|
| Real disposable DB migration/API/rollback | `node --test scripts/lcup-po-correction/migration.test.cjs` | 8 | [migration](migration-tests.log) |
| Official sources, seed/model, resolver and historical context | `node --test scripts/lcup-po-correction/source.test.mjs src/lib/syllabusModel.test.js server/lib/syllabuscheck/outcome-source.test.js server/lib/syllabuscheck/outcome-sharing.test.js` | 59 | [references](reference-regression.log) |
| Existing gates, scoring and compliance/refinement routes | `node --test server/lib/syllabuscheck/gates.test.js server/lib/syllabuscheck/scoring.test.js server/routes/compliance.routes.test.js server/routes/syllabusCheck.refine.routes.test.js` | 68 | [gates/scoring](gates-regression.log) |
| Approved offline fixtures + importer + i18n | Command below | 74 | [importer/offline](importer74-verified-copies.log) |
| React PDF preview/application/prerequisite and language behavior | `node scripts/test-pdf-import-ui.mjs` | 16 | [UI](ui-regression.log) |

```powershell
node --import ./scripts/lcup-po-correction/baseline-source-copies.mjs --test scripts/lcup-approved-offline/importer-regression.test.mjs scripts/lcup-approved-offline/fixture.test.mjs scripts/lcup-approved-offline/baseline.test.mjs server/lib/pdfImport.test.js server/lib/pdfLayout.test.js src/lib/pdfImport.test.js src/lib/pdfImport.fixes.test.js server/lib/pdfImportIdentity.test.js server/routes/pdfImport.routes.test.js src/i18n/i18n.test.js
```

The first default 74-test invocation passed 68 and failed 6 with `ENOENT`: the three older baseline PDF paths under `docs/academic-references/` were already absent when this task began. [That failed run is retained](importer74.log). The PDFs have byte-identical copies in `reference-data/`. A test-only read adapter uses those copies only for the three missing paths and verifies each SHA-256 against its frozen fixture before returning bytes. The successful complete 74-test run used that adapter. No PDF, fixture, source hash, production importer path or protected dataset was changed to accommodate the environment.

New coverage proves exact 9/9/13/13 resolution, full engineering PO12, source hashes/numbering/punctuation, inherited counts through HTTP, identical Builder/checker basis, separate Cyber curriculum, refusal of in-place official edits, historical mapping protection including direct ILO–PO tags, unchanged saved reports, transaction failure recovery, idempotence, reference drift detection, refusal of unsafe rollback after a newly created record and complete logical rollback. No new live-Claude judgment was made.

Integration evidence: [program verification and protected row hashes](migration-results.json), [server identity](disposable-identity.json), [guarded shutdown](disposable-shutdown.json). Test scope uses synthetic records on the installed MariaDB engine, not a production MySQL clone or a full browser session backed by that database. Existing React UI tests mock the server and cover both languages; new reference-safety error messages currently use the existing server English error mechanism. A dedicated faculty-remediation UI and translation work are not included.

## Exact files changed in this task

The repository already had extensive uncommitted work. The baseline HEAD is `68926cb392756c07bb0b999538d098d1038be368`; no commit was created. [before.json](before.json) records original hashes for 1,133 existing files. [integrity.json](integrity.json) confirms 1,118 unchanged files, the 15 intended modifications below, no missing baseline files and no unexpected modifications. Existing uncommitted work was preserved.

Modified pre-existing files:

```text
src/data/outcomesSeed.js
server/db/seed-outcomes.js
server/db/seed-local-references.js
server/lib/programs.js
server/lib/courses.js
server/lib/syllabusOutcomes.js
server/lib/syllabuscheck/repository.js
server/lib/compliance/service.js
server/routes/programs.js
server/routes/courses.js
server/routes/syllabusContent.js
server/routes/syllabusCheck.js
src/lib/syllabusModel.test.js
server/lib/syllabuscheck/outcome-sharing.test.js
server/routes/compliance.routes.test.js
```

New implementation/test/support files:

```text
src/data/officialProgramOutcomes.json
server/lib/programPoReferences.js
server/db/official-po-migration.cjs
scripts/lcup-po-correction/extract.mjs
scripts/lcup-po-correction/preflight.cjs
scripts/lcup-po-correction/verify-live.cjs
scripts/lcup-po-correction/migrate.cjs
scripts/lcup-po-correction/migration.test.cjs
scripts/lcup-po-correction/source.test.mjs
scripts/lcup-po-correction/baseline-source-copies.mjs
scripts/lcup-po-correction/start-disposable.ps1
scripts/lcup-po-correction/stop-disposable.cjs
scripts/lcup-po-correction/report.mjs
scripts/lcup-po-correction/integrity.mjs
```

New generated evidence is confined to `docs/lcup-po-correction/` (this report, exact data, source renders, plans, impact/worksheets, hashes, disposable configuration/identity/backups and test logs) and `tmp/lcup-po-correction-db/` (retained disposable database files/log). `server/.env`, the 47 deterministic-rule and scoring implementations, official passing mark 79, gate implementations, existing academic-reference versions/PDFs, approved fixtures, protected 42-case held-out data, A1/A2/A3/B1/B2 results, align-1 data, Faculty Review Packages V1/V2, response-importer outputs and historical evaluation reports retain their original hashes. Compliance service changes only pass the syllabus ID to reference safety checks; no gate or scoring condition was edited.

## Source ambiguities and remaining work

All 35 numbered PO statements are legible as printed. The following wording issues are preserved and would need an authorized source amendment to change:

- IT101 PO5: `Preserve and promote “Filipino historical and cultural heritage;` has an unmatched opening quotation mark.
- IT101 PO6: `design and appropriate solution;` prints “and”; it has not been corrected to “an”.
- Engineering PO13: `people materials, implementation, equipment and energy.` has unusual punctuation/wording; no comma or replacement noun was invented.
- IE403 and CPE404 punctuation differs in POs 2, 5, 7 and 10; each program retains its own exact source.

No authorization remains outstanding for choosing the official source sets: that was supplied in the task. Faculty mapping decisions and any wording amendment remain separate from implementing the reference correction. No EGA crosswalk is inferred from these PO columns.

Next step is review of this correction, rollback evidence and the seven blank remediation worksheets. Applying the versioned migration to the existing database, resolving faculty mappings, and any later paid Claude evaluation each remain unperformed. Existing-database application requires explicit approval and a controlled rollout with a verified backup. Work stops here for review.
