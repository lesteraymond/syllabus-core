# LCUP Hybrid-2 academic evaluation readiness

2026-10-28. Verification and isolated testing completed. No live Claude evaluation was started. No existing application/source file, academic reference, PO, verified fixture, scoring rule, gate or historical evaluation result was changed.

## Current Program Outcomes

The configured database was inspected in a **session explicitly set read-only**, inside a consistent transaction. The session read-only flag was verified as1; all54 data queries were SELECT, followed by rollback and disconnect. No faculty syllabus rows were read or written. The source seed/transcription files and all five requested reports were reviewed.

| Question | Current result |
|---|---|
| BSIT count | **10**, not9. `src/data/outcomesSeed.js` matches the current database rows exactly. |
| Match with IT202 reference | **No.** IT202 prints9 POs on pages2–3. None of its nine numbered statements matches the current statement at the same number. All19 tagged CLO–PO relationships therefore change meaning under the current numbering. |
| Cyber Security inheritance | **Still a separate copied 10-PO set**, identical to BSIT today. `program_outcome_sources` does not exist in the current database; no inheritance link is implemented there. Source code supports resolving such a link when one exists. |
| BSIE count | **13**, matching the IE402 baseline numbered wording, including its incomplete PO12. |
| BSCpE count | **13**, matching the CpE304 baseline numbered wording, including its incomplete PO12. |
| Complete engineering PO12 in database | **Absent in both programs.** Both end after “and in”. |

`server/db/local-outcome-data.cjs` preserves a nine-PO BSIT PDF transcription and thirteen engineering POs. That nine-item transcription is a supporting source, not the current BSIT database master. Its engineering rows mark PO12 `sourceIncomplete`; the database resolver does not carry that flag into the current master objects. A passing PO-EXACT against the same baseline transcription remains circular evidence.

IE403 page3 and CPE404 page3 both supply the full PO12:

> Knowledge and understanding of engineering and management principles as a member and leader in a team, to manage projects and in multidisciplinary environments.

The complete supporting text was verified against the existing source/page evidence and original PDF hashes. It was **not** substituted into the database, source references or baseline fixtures. Differences beyond PO12 remain punctuation: IE402/IE403 at PO2/4/5/7/10/11; CpE304/CPE404 at PO4/7; the two baselines at PO11; the supporting documents at PO2/5/7/10.

See [numbered current PO comparison with source wording/pages](program-outcomes.md) and [read-only snapshot/query ledger](current-pos.json). No PO was edited or renumbered.

## Decisions and changes requiring authorization

| Decision/change | Required authority/action |
|---|---|
| Adopt the BSIT nine-item list, retain/correct the ten-item list, or use another authoritative list; assign official numbering | VPAA/Dean, L1. This includes incomplete BSIT PO9 and proposed wording corrections. Any official replacement/renumbering and recheck/remapping policy needs versioned approval. |
| Adopt the now-evidenced full engineering PO12 | VPAA/Dean, L2. Supporting evidence resolves the missing-source-text question, not official adoption/versioning. No developer completion is authorized. |
| Engineering shared/separate PO lists, PO11 punctuation and BSCpE PO13 applicability | VPAA/Dean, L2. The identical printed PO13 is evidence, not confirmation that it belongs to BSCpE. |
| PO–EGA crosswalks and intended/full EGA definitions | VPAA/Dean, L3. Engineering crosswalks are absent; BSIT's links still need a supporting authority. |
| Apply the Cyber→BSIT inheritance mechanism | The policy that Cyber uses BSIT POs is already specified by the user. It does not need to be re-decided. Creating/linking the missing database mechanism requires separately authorized technical/database work; none was done here. Its source PO version depends on L1. Cyber's own2025–2026 curriculum must remain separate. |
| Vision/mission version, reference categories/form edition, weekly values, ILO completeness/tagging/coverage | Institutional decisions L15–L18. Any changes to enforcement, gates or deductions need their own approval; approved syllabi are not automatically 100-point or false-rejection oracles. |
| Curriculum/cohort year, accepted code/title/prerequisite equivalents, total-unit interpretation | Registrar/VPAA, L19/L20. No reference versions or prerequisites were changed. |
| Missing/ambiguous faculty mappings and expected alignment labels | Discipline faculty, F1–F10. No missing relationship or expected judgment may be invented by software. |
| External transmission/redaction, consent, approved evaluation scope/model/budget | Separate authorization under L21/privacy and cost review before any live Claude call. |

## Complete PDF workflow testing

An appropriate isolated environment was available: XAMPP MariaDB10.4.32, matching the version reported by the configured database. A new database process was bootstrapped in:

`tmp/lcup-evaluation-readiness-db/data`

It listened only on `127.0.0.1:43307`. **Before any test DDL/DML**, the harness asserted the server's actual `@@datadir` and `@@port` against that workspace-owned directory/port. It never loaded the production connection configuration. A fresh process-specific test schema was created from the relevant existing schema definitions, with synthetic users/assignments/drafts and reference copies. No migration script or existing-database schema change ran.

The tests exercised:

**Actual PDF file → React file input → multipart HTTP upload → production import route/worker → preview → prerequisite choice/review → production builder Apply → production content PUT transaction → MariaDB JSON persistence → component unmount → new builder mount → production content GET → hydration/reopen.**

Authentication used a synthetic test session. Auxiliary catalog/status endpoints were simulated. AI endpoints returned a deliberately unscored mocked response; no semantic label was fabricated. The upload/content routes, PDF worker, mapper, Apply guard, save/hydration code and database persistence were real. This is integrated testing in a simulated DOM, not a test of a deployed browser/login/session-cookie stack.

| Coverage | Executed result |
|---|---|
| Three syllabi × English/Filipino × Keep/Replace prerequisite | **12 round trips passed** |
| BSIT IT202 PDF into Cyber IT-202, both languages | **2 tests blocked before any save or check** |
| No prerequisite decision, both languages | **2 tests blocked before any save or check** |
| CLO–PO links after save/reopen | IT20219; IE40213; CpE30411; all43 retained |
| CLO–EGA links after save/reopen | IT20211; IE4025; CpE3044; all20 retained |
| ILO–CLO links after save/reopen | IT20230; IE40229; CpE3046; all65 retained |
| Prerequisites | Keep preserves the synthetic existing value; Replace preserves the exact source prerequisite, including IE402 `4th Year Standing` |
| Identity | Program, selected catalog code/title and chosen curriculum year preserved across save/reopen; Cyber collision rejected |
| Stable references | CLO IDs and ILO IDs retained through hydration; stored content/mappings match after reopening |
| Existing-record protection | An unrelated synthetic approved record was byte-identical before/after. Production faculty records were never test targets. |
| Language behavior | Both locale flows executed; exact distinct English/Filipino review, Apply and prerequisite wording also verified |

The request ledger contains12 real PUT saves and12 mocked AI-check requests. Preview itself performed no save/check. All blocked cases performed neither. [Workflow results and request ledger](workflow-results.json), [database identity guard](disposable-database.json), [workflow test log](workflow.log).

The initial disposable-server startup hit a Windows native-AIO assertion; restarting **only this test process** with `--innodb-use-native-aio=0` resolved it. A first workflow assertion also incorrectly prohibited `hydrateContent` from creating unused default IDs; it was corrected to check that actual persisted IDs survive. The final16 workflow tests passed. The initial assertion log is retained separately; no production fix was needed for that test-harness assumption.

The disposable server was shut down after testing. Its data files are retained for review; no production service/configuration was changed. See [shutdown record](disposable-shutdown.json) and the retained server log under the new temporary directory.

## Executed tests and logs

| Suite | Result | Evidence |
|---|---|---|
| New full workflow tests | **16 passed**,0 failed/skipped | [workflow.log](workflow.log) |
| New PO/readiness/workflow-evidence/localization assertions | **4 passed**,0 failed/skipped | [verification-tests.log](verification-tests.log) |
| Existing offline/importer/API/identity/i18n tests | **74 passed**,0 failed/skipped | [regression74.log](regression74.log) |
| Existing importer React UI tests | **16 passed**,0 failed/skipped | [importer-ui16.log](importer-ui16.log) |

**110 distinct passing tests**, including a fresh successful rerun of the previously reported90. No full npm test run was used. PDF.js font warnings and React test-timing warnings appeared in the simulated-DOM workflow log; they did not produce failed or skipped assertions. No paid provider or live checker transport was called.

## Academic evaluation readiness

The three verified fixtures remain unchanged. Existing production `pairsOf` was used only to inventory relationships; `engine.run`, `align`, reference link fetching and provider transports were not called. All eight additional stage switches remain off. [Detailed inventory](academic-readiness.json), [faculty-review readiness summary](academic-readiness.md).

“Ready” below means the available evidence can be given to faculty for labeling. It is not an ALIGNED verdict, an authorization to send data externally, or a released benchmark expectation.

| Relationship family | Ready for faculty labeling | Held/absent |
|---|---|---|
| Tagged CLO–PO | **22/43**: IE40213, CpE3049 | IT20219: incompatible PO list/numbering. CpE304 CLO2–PO12: incomplete adopted master. CpE304 CLO4–PO13: applicability decision. |
| CLO–EGA | **20/20**, using available EGA names | Full EGA descriptions/crosswalk authority still need institutional/faculty confirmation. |
| Explicit ILO–CLO | **65/65**, as printed |15 additional untagged lesson outcomes have no inferable target: IT2024, CpE30411. CpE304 week1 has no ILO to evaluate. |
| ILO–content/activity/assessment | **50 each**,150 total | Evidence available even for untagged ILOs; faculty expectations are still null. Missing source ILOs cannot be supplied. |
| Module–value | **24/24** source lesson rows | Faculty must distinguish named values, actual integration and the institution's weekly-value requirement. Exam rows remain exempt under current rules. |
| Description–plan | **3/3** | Faculty relevance/coverage judgments pending. |
| CLO-anyEGA | **12/12**, conditionally on intended EGA meaning | Same definition/authority caveat as CLO–EGA. |
| CLO-anyPO | **0/12 released** | IT202 four use the disputed list; eight engineering pairs inspect a full list containing incomplete PO12, with BSCpE PO13 also unresolved. |

Overall:329 current candidate relationships;296 have evidence available for faculty labeling,33 are held for PO-reference decisions. **Every expected label remains null.** The fifteen untagged outcomes are preserved separately, with empty targets. No source tags or faculty judgments were fabricated.

These holds exist in this evaluation inventory; they are **not new production gates**. The current checker would still construct conflicting BSIT or partial-PO12 pairs if invoked normally. A future authorized evaluation must honor the reviewed relationship scope and reference versions rather than feeding all329 to a live provider.

Faculty confirmation remains necessary for IT202's unlabelled value-webbing boundary and intended missing CLO targets; repeated/skipped ILO numbering; IT202's overlapping week4 and C-language exercise in a Java course; IE402 spirituality/engineering mappings and reference relevance; CpE304's missing week1 ILO, PO12/PO13 mappings, apparently swapped week12 cells, exam wording and laboratory/project/grading questions. See existing F1–F10; none was silently corrected.

Remaining technical issues include the unapplied inheritance mechanism; lack of a production PO completeness guard; absent engineering PO–EGA links; exact comparisons affected by EGA display metadata/wrapping; reference-category/citation segmentation limitations; and unprinted curriculum/year-level/credit-split context. These are distinct from academic suitability or policy decisions. The four corrected importer defects did not reappear in this round-trip testing.

## Exact files changed and preservation

**No pre-existing file changed or disappeared.** All973 pre-existing inventoried files, including `server/.env`, the five requested reports, source/reference files, original PDFs, verified fixture/source/master/report artifacts, protected evaluation results and held-out/faculty packages, have unchanged hashes. Branch and HEAD remain unchanged. [Before inventory](before.json), [final integrity manifest](integrity.json).

New verification/test files only:

- `scripts/lcup-evaluation-readiness/verify-pos.cjs`
- `scripts/lcup-evaluation-readiness/workflow.test.jsx`
- `scripts/lcup-evaluation-readiness/run-workflow.mjs`
- `scripts/lcup-evaluation-readiness/workflow.bundle.mjs` (generated test bundle)
- `scripts/lcup-evaluation-readiness/readiness.mjs`
- `scripts/lcup-evaluation-readiness/verification.test.mjs`
- `scripts/lcup-evaluation-readiness/stop-disposable.cjs`
- `scripts/lcup-evaluation-readiness/report.mjs`

New reports, snapshots and logs are confined to `docs/lcup-evaluation-readiness/`; the retained disposable database files/log/configuration are confined to `tmp/lcup-evaluation-readiness-db/`. The integrity manifest enumerates the complete new-file list. No existing faculty record, PO or academic reference was a write target.

## Recommended next step

Obtain VPAA/Dean decisions on the authoritative BSIT PO version/numbering, official engineering PO12 adoption and BSCpE PO13 applicability, then have discipline faculty label the cleared relationships against explicit criteria. Record privacy/redaction consent, reference versions and an approved model/scope/budget before authorizing any paid Claude evaluation. A reference-safe evaluation run must hold the33 disputed candidate pairs and preserve missing mappings until those decisions are resolved.

The technical import/save/reopen path is ready for that faculty review; academic ground truth and full reference readiness are still conditional. Verification stops here. No migrations, production database writes, paid AI requests, scoring/gate changes, commits, pushes, merges or deployments were performed.
