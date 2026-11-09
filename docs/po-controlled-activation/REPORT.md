# Controlled corrected PO activation: implementation and impact report

Generated 2026-11-05T10:44:12.678Z. [PO/source comparison](comparison.md), [historical impact](impact.md), [activation and recovery](ACTIVATION.md), [exact task file changes](files.json), [test results](test-results.json).

## Operational status

| State | Evidence |
| --- | --- |
| IMPLEMENTED IN CODE | Existing resolver, shared checker and versioned migration enhanced |
| TESTED AGAINST SYNTHETIC DATABASE | 10 isolated MySQL tests; apply/failure injection/idempotency/rollback verified |
| PREPARED FOR ACTIVATION | Explicit target IDs, backup/hash/identity guards, unconfirmed authorization template and procedure |
| ACTIVE IN DEVELOPMENT DATABASE | NO corrected source assignments; before/after reference and protected-table hashes match |
| ACTIVE IN STAGING | Not activated by this task; external environment state not inspected |
| ACTIVE IN PRODUCTION | Not activated by this task; external environment state not inspected |

No existing-environment DDL/DML, faculty record changes, paid AI call, environment edit, commit, push, reset or deployment was performed. The raw historical Cyber PO copy is still stored in the existing database. New code reports missing inheritance rather than accepting that copy as authoritative; this is not a corrected-reference database activation.

## Scope and current audit

Exactly four supported selections: BSIT, BSCpE, BSIE and BSIT–Cyber Security. Three distinct masters: BSIT (9), BSIE (13), BSCpE (13); Cyber inherits BSIT POs and approved BSIT curriculum. No unrelated legacy program is a rollout target or acceptance requirement; preservation is verified using non-target hashes and a generic sentinel fixture.

[SELECT-only before](live-before.json) and [after](live-after.json) audits confirm the original discrepancy: counts 10/10/13/13, no active corrected versions, and missing Cyber inheritance. BSIE wording differs at seven numbers and BSCpE at three. Existing database data unchanged: **true**. Resolver output for unlinked Cyber is now empty/unavailable while its physical historical copy remains untouched.

## Root cause and implementation

The canonical JSON/seed correction did not activate a database reference version. Existing populated seeds intentionally never overwrite records; program resolution therefore returned the old rows, and no Cyber inheritance link was installed. The older checker intentionally selected a separate Cyber curriculum. No cache clear can substitute for a source activation.

- Enhanced the existing resolver to resolve the parent before reading child outcomes, so a copied/drifting specialization list cannot displace its BSIT source. Missing or wrong Cyber inheritance exposes unavailable references through existing checks. Separate Cyber master editing is refused. Program identity is retained.
- Shared checker and Builder subject standards now agree on PO source. For linked Cyber, checking selects only approved BSIT curricula, respecting the explicitly selected curriculum year and preserving all old curriculum rows. Wrong/obsolete years/course identities remain review issues; no synthetic equivalence or automatic year conversion is introduced.
- Existing active-reference lookup checks assignment ownership; physical PO rows must match the selected immutable version. Provenance retains source hash/version and the existing user authorization, while formal institutional approval remains `not_recorded`.
- New Builder selections copy small reference-provenance metadata; reopening a selected historical subject preserves its faculty-owned outcomes and mappings. Saved reports carry program identity, PO source/version/authorization and curriculum source/reference IDs. Existing report UI adds a bilingual source/version label; it is not redesigned.
- Policy V2 uses the same resolved program context and active version. No academic relationship, CLO classification, extra deduction, threshold change or new submission/approval gate was introduced. Existing costPlan, packing, prompt trimming, request budgets, cache validation, cooldown and recommendation actions remain intact.

## Migration and historical safeguards

The existing `server/db/official-po-migration.cjs` is the single migration implementation. It now accepts four explicit stable IDs from one academic-year catalog, refuses non-target codes/mixed years and requires an approved BSIT curriculum before activating inheritance. Additive support DDL precedes the serializable DML transaction; all mutations and audit/queue insertion roll back on injected DML failure. Backups preserve old PO rows, versions and links; unrelated program and protected-table hashes guard against accidental scope expansion. No academic-year or other existing database migration was executed.

Historical PO mappings requiring review: **7** syllabi. Curriculum-only review: **1** Cyber syllabus. Syllabus 99 retains its obsolete PO10 tag. Direct ILO–PO mappings and invalid tags beside a copied current reference are also detected. Review proposals retain previous/proposed reference versions and null proposed mappings. Original content, historical versions, saved checking reports and approval history remain unchanged. Exact affected IDs and reasons are in [impact.md](impact.md).

The prepared transport `scripts/po-controlled-activation/rollout.cjs` loads no environment file. Existing-environment writes are guarded by explicit maintenance confirmation and a separate authorization receipt tied to the exact database identity, target IDs and reviewed backup hash. The example receipt is intentionally unconfirmed. This task exercised mutation only on identity-verified workspace MySQL at port 43308 with fresh synthetic schemas.

## Cross-system verification

The isolated database tests verify all four selections; counts/ordering/exact statements; absence of a competing Cyber master; BSIT curriculum inheritance; program/course APIs; Builder standards; obsolete PO10 rejection; T-12/P-01/P-02; current PO-MASTER/PO-EXACT/CLO-MAP; actual source quotations supplied to scripted CLO–PO and whole-list checks; Policy V2's seven relationships; the comprehensive profile; saved report reference context; historical review gates; immutable active versions; drift refusal; idempotency; rollback; and preservation of non-target catalogs. P-03 remains unverified without an authorized crosswalk; its existing numeric behavior is not silently changed.

The local Edge component-browser E2E mounts the existing InfoStep/ClosStep/ComplianceCard with output from the isolated MySQL service run. All four program selections show the required counts, exact PO wording and CLO mapping choices. Faculty/admin source labels and Filipino rendering pass. It is not a claim of a deployed staging/production full-stack test. [Browser results](browser-results.json), [screenshot](browser-reference-review.png).

## Tests and scoring

| Suite | Tests | Pass | Fail | Skipped | Todo | Cancelled | Exit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| regression | 2139 | 2139 | 0 | 0 | 0 | 0 | 0 |
| vpaa | 294 | 294 | 0 | 0 | 0 | 0 | 0 |
| isolatedMySQL | 10 | 10 | 0 | 0 | 0 | 0 | 0 |
| focused | 25 | 25 | 0 | 0 | 0 | 0 | 0 |
| sourceAndGuards | 10 | 10 | 0 | 0 | 0 | 0 | 0 |

Browser program cases: 4 passed, 0 failed; English and Filipino verified. Build exit 0. Suite counts overlap and must not be added as unique tests. Existing chunk-size warnings remain non-fatal. Scripted judgments establish software behavior, never real Claude academic accuracy.

Threshold remains 79. The 47 registered/44 direct Hybrid-2 rules, six weights (20/20/20/15/10/15), existing scored semantic deductions/secondary tags, seven VPAA relationships, four classifications, advisory scope and submission/approval policies are preserved. Isolated comparisons give identical legacy and comprehensive official scores/deductions for the same scripted judgments. No paid request was made.

## Institutional dependencies

Source verification is complete for the three designated PO PDFs, including preserved printed typos and completed engineering PO12. The original user authorization classification remains unchanged; a formal VPAA approval record/effective-version decision is not recorded in the canonical reference. Resolve and record that institutional dependency before an existing-environment activation decision. No formal approval was invented.

Vision and Mission still use the existing prototype/version-1 database master. The designated syllabi show institutional wording differences, including a six-item mission, but this PO rollout has no authority to choose or replace institutional statements. Four EGAs remain unchanged. Approved PO–EGA crosswalks are not supplied by these PO columns and are not fabricated. Registrar/faculty must confirm applicability of BSIT curriculum versions to historical Cyber selections.

## Requested authorization

Review [ACTIVATION.md](ACTIVATION.md), source authorization, affected-record worksheets and backup requirements. Explicit authorization is still required for any activation in an existing development, staging or production database. No activation is scheduled or executed by these deliverables.

## Concrete plan for authorization

The [reviewed read-only plan](reviewed-plan.json) records the exact target IDs, database identity hash and before-state hash. A private reference backup was prepared at `tmp/po-controlled-activation/reference-backup-review.json`; its digest is recorded in that plan. It is not an activation or a replacement for a full physical database backup before a maintenance window. The authorization receipt remains unconfirmed.

[Numeric scoring parity](scoring-parity.json): all four aligned synthetic selections scored **100** in both legacy and comprehensive paths, with identical deductions and threshold **79**. Unavailable crosswalks remain explicitly unverified.
