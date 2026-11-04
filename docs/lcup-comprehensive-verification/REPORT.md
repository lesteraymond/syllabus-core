# Consolidated Hybrid-2 / Academic Policy V2 verification

Verification date: 2026-10-29. Policy: `academic-evaluation-v2-preview-1`. Repository HEAD before and after: `68926cb392756c07bb0b999538d098d1038be368`. Node: v26.12.1. This report records executed offline software tests, a fresh disposable SQL workflow, and the academic evaluation work that remains blocked. It is not an activation, scoring-policy change, or academic certification.

**Final selected automated result: 1,188 distinct assertions executed; 1,184 passed; 4 failed; 0 skipped or cancelled.** The failures represent two implementation gaps: markup-only required content and unvalidated malformed V2 arrays. All 811 selected existing checker/compatibility assertions passed; another 36 existing benchmark assertions passed. Initial fixture/harness failures and diagnostic reruns are retained separately and do not inflate the distinct-test total.

**ACADEMIC ACCURACY: NOT YET MEASURED.** This task made no paid requests. The existing V2 benchmark contains zero faculty-confirmed adjudicated labels paired with genuine V2 Claude judgments. Historical Claude evaluations under earlier policies do exist; they are not evidence of V2 academic accuracy.

No pre-existing source, test, verified fixture, academic reference, historical evaluation, protected dataset, or environment file was changed. All 1,205 files captured before this task have identical SHA256 values afterward. Production database connections, migrations, flag activation, commits, pushes, merges, and deployments: none. New artifacts are isolated to this report directory, `scripts/lcup-comprehensive-verification/`, and task-owned `tmp/` paths. See [integrity.json](integrity.json), [before.json](before.json), [after-status.txt](after-status.txt), and the exact [new-file manifest](FILES.md).

The working tree was already dirty: 303 short-status entries before testing and 305 afterward. The two added entries are the new documentation and script directories. All prior tracked and untracked status entries are preserved; the existing `tmp/` entry also contains the task-owned disposable files.

## A. Requirements inventory and complete test matrix

The [complete requirements matrix](requirements-matrix.md), also available as [structured JSON](requirements-matrix.json), contains 60 verification objectives. Every row identifies the requirement, responsible implementation, test case, expected behavior, actual result, status, evidence and limitation. It expands into the [47-rule matrix](deterministic-matrix.md) and [98-case relationship matrix](relationship-matrix.md).

Matrix status totals are **47 PASS, 2 FAIL, 8 BLOCKED and 3 NOT_TESTED**. These are verification objectives, not automated assertion totals. The two failing objectives produce four automated assertion failures. Blocked and untested objectives are not counted as passed tests.

Before execution, the inventory identified these gaps in the previous evidence: independent boundary examples for all 47 predicates; the requested seven-by-fourteen relationship conditions; a fresh real HTTP/SQL/bilingual-UI workflow; explicit multiclass metrics; and measured offline relationship/request scale. Those gaps were exercised here. Actual academic truth, faculty recommendation ratings, production reference rollout and a live V2 integration path remain outside demonstrated coverage.

Read and hashed the ten requested documents: the requirements matrix/report; Policy V2 report, proposal and shadow comparison; implementation report, requirements matrix and comparison; C3 addendum; and ILO-assessment review. Their file identities/headings, the previous 604-test manifest, rule metadata, existing checker test inventory and candidate artifact writers are in [coverage-before.json](coverage-before.json).

Inspected the production path and reused its functions:

- Compliance: `server/lib/compliance/{standard-v4.json,rules.js,service.js}`, frontend parity rules, coded identity/mapping/schedule checks and `verdict.js`.
- Claude and existing capabilities: `server/lib/syllabuscheck/{gemini.js,anthropic.js,requirementsAdvice.js,lessonfit.js,references.js,values.js,aspects.js,quality.js,scoring.js,policy.js}` and their existing stage/provider tests. Stage A, B, C1, C2, C3, D1 and D2 remain in their existing pipeline.
- V2: `academicPolicyV2.js`, `academicV2Plan.js`, `academicV2Replay.js`, `src/data/academicPolicyV2.json`, shared service/repository storage guards and policy-scoped prompts.
- Workflow: Builder PlanStep/lesson authoring helpers, content and compliance routes, `server/routes/syllabusCheck.js`, stored report readers, `AcademicEvaluationPanel`, `HybridCheckPanel`, `VerdictPanel` and English/Filipino strings.
- References/evaluation: official PO JSON and resolution/inheritance code; approved offline fixtures and source evidence; existing benchmark, measurement module and faculty forms; fresh-schema/test infrastructure. Protected files were preservation-checked. Protected holdout answers were not inspected to tune prompts or construct new expected labels.

No second checker, academic stage or policy was implemented. New code is testing infrastructure, a descriptive metric adapter and evidence/report generation only.

## B. Test execution and reproducibility

[execution.json](execution.json) is the machine-readable ledger with exact commands, log names and counts for every selected group. The following table summarizes those executed groups.

| Executed group | Tests | Pass | Fail | Evidence |
|---|---:|---:|---:|---|
| Consolidated requirements | 21 | 21 | 0 | [log](existing-regression-requirements-tests-final.log) |
| Bilingual content-first authoring | 6 | 6 | 0 | [log](existing-regression-lesson-ui-final.log) |
| Existing C3, verdict and model | 80 | 80 | 0 | [log](existing-regression-core-regressions.log) |
| Alignment/stages/scoring/provider regressions | 223 | 223 | 0 | [log](existing-regression-alignment-regressions.log) |
| Rules, parity, routes/gates, findings/save/i18n | 161 | 161 | 0 | [log](existing-regression-workflow-regressions.log) |
| Existing importer preview/apply UI | 16 | 16 | 0 | [log](existing-regression-importer-ui-regressions.log) |
| Catalog/content HTTP persistence | 22 | 22 | 0 | [log](existing-regression-catalog-regressions.log) |
| Prompt variants and translation compatibility | 9 | 9 | 0 | [log](existing-compatibility-final.log) |
| C3 addendum | 8 | 8 | 0 | [log](existing-c3-addendum-tests.log) |
| Existing V2 policy | 36 | 36 | 0 | [log](policy-tests-final.log) |
| Existing V2 API/persistence guard | 5 | 5 | 0 | [log](api-tests-final.log) |
| Existing V2 bilingual UI | 7 | 7 | 0 | [log](ui-tests-final.log) |
| Existing V2 context/reference/CLI/comparison contracts | 10 | 10 | 0 | [log](robustness-tests-final.log) |
| Additional Anthropic schema contracts | 7 | 7 | 0 | [log](existing-additional.log) |
| Additional provider/reliability/mapping/cache/recommendation suites | 200 | 200 | 0 | [log](additional-regressions.log) |
| Seven independent relationships x fourteen conditions | 98 | 98 | 0 | [log](relationships-initial.log) |
| New deterministic/course/metrics/three initial safety tests | 211 | 208 | 3 | [log](new-targeted-final.log) |
| Additional below-79 advisory-gate observation | 1 | 1 | 0 | [log](gate-threshold-verified.log) |
| Fresh disposable SQL/HTTP/bilingual DOM integration | 9 | 8 | 1 | [log](integration-final.log) |
| Existing benchmark source/form/metrics/preservation tests | 36 | 36 | 0 | [log](benchmark-preservation.log) |
| Fresh execution of existing legacy/V2 comparison scenarios | 22 | 22 | 0 | [log](comparison-tests.log) |
| **Total distinct selected assertions** | **1,188** | **1,184** | **4** | |

The 211-test group comprises 147 deterministic assertions, 59 course/reference/status assertions, two metric assertions and three safety assertions. A fourth safety test was added and executed separately afterward. A repeat of that unfiltered four-file command now runs 212 assertions; omit the separate gate-pattern run when calculating a fresh total. No diagnostic reruns are counted as additional distinct cases. There are zero blocked assertions inside these executed groups; eight broader verification objectives are blocked and three are not tested, as explicitly listed in the requirements matrix. No finite count is invented for every conceivable unexecuted repository test.

Reproduce from the repository root in PowerShell:

```powershell
node scripts/lcup-comprehensive-verification/run-existing.cjs
node scripts/lcup-comprehensive-verification/run-additional.cjs
node --test scripts/lcup-comprehensive-verification/relationships.test.cjs
node --test scripts/lcup-comprehensive-verification/deterministic.test.cjs scripts/lcup-comprehensive-verification/course.test.cjs scripts/lcup-comprehensive-verification/metrics.test.cjs scripts/lcup-comprehensive-verification/safety.test.cjs
node --test scripts/lcup-academic-benchmark/benchmark.test.cjs
node --test scripts/lcup-comprehensive-verification/comparison.test.cjs
node --expose-gc scripts/lcup-comprehensive-verification/performance.cjs
node scripts/lcup-comprehensive-verification/probes.cjs
```

The targeted command deliberately remains nonzero while D1/D2 are unresolved. Do not change its assertions to make the report green. The comparison imports the existing `compare()` implementation; it writes only the new [comparison.json](comparison.json), preserving both earlier comparison artifacts. The performance/probe/inventory commands succeeded but are not counted as Node tests.

For the SQL integration, create a **new** disposable instance with the task script, run the integration, then shut it down:

```powershell
powershell -NoProfile -File scripts/lcup-comprehensive-verification/start-disposable.ps1
node scripts/lcup-comprehensive-verification/run-integration.mjs
node scripts/lcup-comprehensive-verification/stop-disposable.cjs
```

The starter uses locally installed `C:\xampp\mysql\bin` tools, refuses an occupied port or pre-existing target, launches hidden and binds to localhost port 43309. Both the harness and shutdown script verify exact `@@datadir` and port before proceeding. The run completed on MariaDB 10.4.32, a fresh datadir under `tmp/lcup-comprehensive-verification-db-639288232597480271/data`, and a fresh database per invocation. It executed 36 `CREATE TABLE` statements from the existing schema against empty test databases; **no migration scripts** or existing faculty databases were used. The instance is shut down and all disposable data is retained. [SQL evidence](sql-integration-evidence.json), [shutdown receipt](disposable-shutdown.json).

The reporting command `node scripts/lcup-comprehensive-verification/evidence.cjs` verifies captured existing-file hashes and summarizes the retained logs; it does not run tests or regenerate old packages. [FILES.md](FILES.md) enumerates the exact additions.

Intentionally did not run full `npm test`, old report exporters, faculty-response imports, paid runners, migration tests, or scripts that regenerate frozen fixtures. Some test filenames containing `writeFile` were inspected and safely selected because their writes are confined to fresh temporary paths; others remained excluded. The inventory lists candidates, not blanket assertions that every such test is unsafe. No historical export was regenerated to obtain a passing result.

### Exact final failing assertions

| Failure | Expected | Actual | Classification |
|---|---|---|---|
| `markup/whitespace-only content is incomplete: "** **"` | T-02/T-16 identify visibly empty content | Trim-only presence accepts markup as populated | D1, confirmed implementation gap |
| `markup/whitespace-only content is incomplete: "- ** **"` | Same | Same | D1, second input reproduction |
| `malformed V2 top-level arrays are rejected as controlled validation errors rather than unhandled TypeErrors` | Typed controlled 4xx error | `(content.plan || []).map is not a function` | D2, defensive validation gap |
| `a malformed saved structured record receives a controlled 4xx preview response instead of an unhandled server failure` | Controlled client error | HTTP 500 with the TypeError message | D2, actual HTTP/SQL reproduction |

D1 root: server/client compliance `blank`/presence predicates rely on `trim()`, while Builder authoring already removes markup for its content prerequisite. V2 planner/record presence checks also treat nonempty markup as evidence. A controlled probe with markup-only weekly content, compliant remaining fields and scripted positive semantic responses produces compliance 100 and `SUPPORTED_BY_SUPPLIED_EVIDENCE`. This is an **objective missing-content guard gap**, not an observed real Claude false approval. [Probe](markup-only-evidence.json).

D2 root: `server/lib/syllabuscheck/academicV2Plan.js:37` calls `.map` before validating that `content.plan` is an array. Direct evaluation throws; the existing HTTP wrapper catches it and returns 500. It does not crash the server, approve the syllabus, write a V2 report, or bypass access control. Normal structured-save validation rejects malformed shapes; the reproduction uses a deliberately corrupted test-owned saved record and restores it afterward. The new test imposes a defensive controlled-error requirement; it does not propose new academic policy. [HTTP evidence](malformed-api-response.json).

Initial diagnostic failures were not hidden. The first deterministic boundary test used an insufficient grading formula; its test fixture was corrected to existing accepted wording. Initial integrated Happy DOM execution made the server SDK detect a browser; the harness now runs the actual backend in a separate Node child process. An initial administrator assertion incorrectly expected access to a faculty-private draft check; the final test respects existing version-bound visibility, creates the administrator's own check and verifies historical reading. Initial below-threshold synthetic data computed exactly 79; additional legitimate nonblocking findings lowered it to 76 without altering gate assertions. Initial logs remain alongside the final evidence. None required modifying production behavior or weakening an established assertion.

## C. Academic relationship coverage

All seven required identifiers remain available and independently evaluated:

| Original requirement | Existing identifier | Executed conditions | Result |
|---|---|---:|---|
| Course Title <-> Course Content | `Content-course` | 14 | 14 PASS, software contract |
| Course Content <-> ILO | `Content-ILO` | 14 | 14 PASS, software contract |
| ILO <-> assigned CLO | `ILO-CLO` | 14 | 14 PASS, software contract |
| Course Content <-> Activities | `Content-activity` | 14 | 14 PASS, software contract |
| ILO <-> Activities | `ILO-activity` | 14 | 14 PASS, software contract |
| Course Content <-> Assessment | `Content-assessment` | 14 | 14 PASS, software contract |
| Activities <-> Assessment | `Activity-assessment` | 14 | 14 PASS, software contract |

For each type the cases cover scripted ALIGNED, PARTIALLY_ALIGNED, NOT_ALIGNED, omitted/unassessed result, empty source, empty target, ambiguity, a keyword trap, equivalent meaning with different wording, incorrect evidence quote, incorrect recommendation, multiple ILOs, grouped weeks and provider unavailable. Each selected failure remains visible while the other required links are supplied as supported. Source and target text, raw judgment, verified-quote status, explanation, correction/review information and policy/input/reference provenance remain attached.

`NOT_CHECKED` denotes missing/unusable evaluation at the findings/coverage boundary; it is not injected as a valid Claude academic label. Omitted, invalid or unverifiable responses become unresolved/`NOT_EVALUATED` evidence, never supported alignment. PARTIALLY_ALIGNED normally requires faculty review. The ambiguous examples use supplied partial/insufficient judgments; tests do not establish that Claude will recognize ambiguity correctly.

Matching-keyword and equivalent-wording inputs are explicitly synthetic. The tests establish that the software honors independent evidence and the supplied label. They **cannot establish NLP discrimination** between Java programming and Java the island, synonymous learning performances or unrelated disciplines. That requires independently reviewed real responses.

Course-level tests distinguish four-CLO count from statement quality and label completeness from classification meaning. Duplicate statements do not become a fifth deterministic rule; a four-item list can satisfy count while a semantic classification/quality review remains unresolved. Out-of-range PO/EGA tags, missing and disputed mappings are retained rather than remapped. Approved text is unchanged. All six count cases, classification variants, independent title/description/plan/CLO/PO/EGA/C1/D1 failures and missing/stale-master scenarios are recorded in the targeted log.

Week coverage/range/examination predicates passed their named rule scenarios. Grouped weeks retain one shared lesson context. A supported Week 1-2 introduction still requires timing review rather than inventing certainty about Week 1. Objectives use supplied CLO/course context; no new official course-objectives field was invented. Generic-orientation adequacy and whether an activity can demonstrate a competence remain faculty/model evaluation questions.

## D. Policy V2 verification and legacy comparison

V2 is a versioned branch of the existing `engine.run` through the shared checking service. Its compliance profile calls the unchanged deterministic implementation. Its academic profile uses categorical evidence dispositions and **does not subtract legacy AI penalties**. Official top-level grade/overall remain null, `passed` and `hybrid.ready` remain false, `official` and `active` remain false, and `hybrid.deductions` is empty. The compliance profile retains its own score, threshold 79 and findings. A compliance score is not academic approval.

| Scenario | Executed result |
|---|---|
| A: compliance100, substantiated required academic mismatch | `REQUIRES_REVISION` with compliance100 |
| B: required supplied evidence supported | `SUPPORTED_BY_SUPPLIED_EVIDENCE`; no faculty-approval or grade claim |
| C: semantic provider unavailable | `NOT_EVALUATED`; if a separate objective four-CLO failure is established, revision remains |
| D: some required evidence missing | `PARTIALLY_EVALUATED`, unless a stronger revision/review issue exists |
| E: ambiguous mapping/partial judgment | `FACULTY_REVIEW`, unless a required revision dominates |
| F: optional direct ILO-assessment alone fails | Diagnostic retained; required disposition unchanged; C2 eligibility preserved |
| G: confirmed common academic cause | All relationship findings retained; one grouped action only with matching confirmation receipt |

Exact aggregate behavior: any required `REQUIRES_REVISION` dominates; otherwise any `FACULTY_REVIEW` dominates; no records/all `NOT_EVALUATED` gives `NOT_EVALUATED`; a mix of supported and unevaluated/partial records gives `PARTIALLY_EVALUATED`; otherwise supported. At the whole-profile boundary, when no required semantic record was evaluated, the evaluator returns `NOT_EVALUATED` unless an independently established required objective failure already requires revision. A missing or pending institutional master is never fabricated as faculty semantic error.

The old CLO-PO, CLO-EGA, ILO-CLO, ILO-activity and Module-value relationships remain academic evidence under V2; their old point penalties are not used. Content is the source of the required value relationship. Direct ILO-assessment and deeper C2 `Assessment-fit` remain optional diagnostics, including existing eligibility dependencies. They do not become an eighth required weekly relationship or independently change the required disposition. Legacy mode retains the old deductions for rollback/comparison.

The existing comparison implementation was executed anew on all 22 original scenarios, including the three immutable approved fixtures with frozen master references. Selected results are below; full outputs and hashes are in [comparison.json](comparison.json).

| Existing case | Legacy provisional candidate | V2 compliance | V2 academic result |
|---|---:|---:|---|
| Complete off-course content | 100 | 100 | REQUIRES_REVISION; 60 failed required weekly cells retained |
| Only direct ILO-assessment diagnostic fails | 97 | 100 | SUPPORTED_BY_SUPPLIED_EVIDENCE for required scope |
| Provider unavailable | Provisional only | Structural score retained separately | NOT_EVALUATED |
| Three verified approved source fixtures | See JSON; not official grades | See JSON | Weekly semantics NOT_EVALUATED; objective criteria reported separately |

The off-course result demonstrates the replacement policy's handling of supplied misalignment evidence. It does not demonstrate that real Claude reliably detects 60 misalignments. In approved-fixture rows, any overall revision comes from existing objective identity/classification-label/schedule/APA-text criteria; it is not a new Claude or faculty academic judgment.

The normal Re-Check route still invokes legacy behavior even if a caller supplies a V2 policy field. Existing Stage flags do not activate V2. The preview route is 404 unless an isolated app installs a static `Map` of matching replays; it accepts no live-provider options. Policy, syllabus and reference hashes must match. CLI preview, storage guards, report versioning, legacy equality and historical-reader tests passed.

No production submission gate consumes V2. Existing submission logic checks its coded blocking findings and configured AI requirement/freshness. **79 is the compliance passing mark, not a universal numeric submission gate.** A specific executed advisory-gate test accepted a synthetic compliance score of 76 with zero coded blocking findings. Required-mode cache/reference/staleness guards remain covered by existing tests. This task did not query or change production gate configuration. [Gate evidence](gate-threshold-evidence.json).

## E. Recommendation and evidence quality readiness

Automated tests verify schema, relationship/path binding, actual quote containment, duplicate/unsupported-ID handling, missing-response safety, source/reference hashes, unsafe-draft review/withholding, explicit provenance and immutable faculty input. They verify that a mapping problem does not authorize invented PO/CLO/EGA text. Recommendations cannot automatically rewrite a syllabus. All V2 remediation actions require human review and expose `canAutoApply:false`.

Shared-root grouping requires explicit evidence-bound confirmation with reviewer, receipt, basis, hashes and allowed provenance. A four-link synthetic confirmed root retains all four findings but yields one action. Merely referencing the same field does not merge separate causes. No point deductions are accumulated.

These safeguards do not guarantee that a well-formed explanation is academically sound or that a plausible recommendation targets the best field. The incorrect-recommendation tests verify review/no-auto-apply contracts; they do not assert that every bad recommendation is detected or removed. Faculty must independently rate whether evidence supports the explanation, the suspected field/cause is correct, the proposed correction is minimal/actionable, correct content is preserved, recommendations do not conflict, and the remedy fits actual learners and assessment performance.

The eight existing synthetic Part B proposals remain proposals, not Claude outputs or approved answers. Independent evidence/recommendation forms are reusable. No faculty identification, review status, expected label or adjudication was fabricated.

## F. Institutional reference readiness

The [reference verification snapshot](reference-readiness.json) reuses existing source verification and stores hashes, source pages, literal authored-vs-canonical comparisons and course/reference conflicts. No production database was connected. The last verified rollout evidence remains unapplied; a fresh synthetic SQL inheritance test does not establish rollout completion.

| Program | Designated source data | Verified local context | Remaining reference limitation |
|---|---|---|---|
| BSIT | 9 POs; IT101 official PDF, pp2-3 | Numbering/text available in version `lcup-po-2026-10-29`; IT202's authored nine match | Frozen master contains ten different POs; historical basis cannot be silently converted |
| BSIT-Cyber Security | Inherits BSIT's9; own 2025-2026 curriculum | Isolated SQL resolver returns inherited9; IT-202 is System Integration and Architecture1 | No verified real Cyber syllabus in this benchmark; production inheritance rollout unconfirmed/unapplied |
| BSIE | 13 POs; IE403 complete reference, pp2-3 | Complete engineering PO12 available, source hash verified | IE402 authored wording, including incomplete PO12, conflicts with designated complete reference and frozen master |
| BSCpE | 13 POs; CPE404 complete reference, pp2-3 | Complete engineering PO12 available, source hash verified | CpE304 authored wording, including incomplete PO12, conflicts with designated complete reference and frozen master |

Source wording was preserved, including awkward punctuation/phrasing. The engineering comparison extends beyond PO12; per-number exact wording differences are in the reference JSON. The complete engineering PO12 is present in canonical source records; original approved fixtures remain faithful to their own incomplete printed PO12. No official record or old CLO-PO relationship was remapped.

Curricula retained: BSIT, BSIE and BSCpE 2022-2023; Cyber2025-2026. BSIT IT202 Programming1 and Cyber IT-202 are not equivalent. Wrong program/course, missing master, stale-hash and inheritance-isolation tests passed. Real fixture conflicts remain: the BSIT curriculum title includes a parenthetical suffix; IE402 title capitalization differs under the unchanged exact title policy; the CpE304 authored code differs from its hyphenated curriculum code; source PDFs do not supply curriculum year/year level. These are reference/identity-policy issues to review, not proof that approved faculty academic content is wrong.

All 43 real CLO-PO benchmark observations remain held where the frozen reference basis conflicts. The authored meanings are displayed independently of the frozen planner text. EGA names exist but richer approved definitions are limited; no absent crosswalk is invented. Value-name matching remains separate from meaning. Current LCUP value-definition file is explicitly `pending_approval`; configured definitions used to exercise fully supported synthetic profiles are mock-only. Authentic value integration therefore remains faculty/reference review in real contexts.

Before existing-record academic evaluation, establish an explicitly reviewed isolated reference snapshot and record-by-record historical mapping basis, or separately authorize the already implemented rollout/remediation process. This task did neither. Academic reviewers may review original source relationships now while marking affected institutional mapping judgments as held.

## G. Reliability, integration, security and performance

### Fresh SQL / API / Builder / UI path

The isolated app used actual Express content, compliance and checker routes, the actual shared checking service and SQL report persistence/readers, real master resolution and React components in Happy DOM. Backend execution was separated from the DOM process. Session identities and ancillary assignment/course-list endpoints were test adapters; legacy provider responses and links were mocked. Thus this is a real local HTTP/SQL integration with simulated identity provisioning, DOM and provider, not a deployed-browser/full-authentication certification.

Executed both languages: load Builder; edit description; autosave; unmount/reopen; preserve CLO-PO/CLO-EGA/ILO-CLO tags, all plan cells and references; normal Re-Check; persist/read a legacy report; render faculty evidence/results. Admin historical reading used its own version-bound stored check. Existing authoring tests cover new-lesson content prerequisite, activity/assessment dependencies, existing/duplicated lessons, populated-field clearing, grouped/exam rows and printed heading order. Six bilingual authoring tests and16 importer preview/apply tests passed. A full fresh original-PDF upload/import SQL workflow was not rerun; prior importer/E2E reports remain historical evidence.

V2 was separately exercised via the existing isolated read-only route. Its SQL snapshot showed no official report/content/version/decision writes; its displayed axes were nonofficial and grade null. No V2 official persistence path was added or bypassed. Two simultaneously requested normal checks returned200 and409 under the existing single-check gate. A different faculty identity could not read content/reports, request Re-Check or preview the owner's syllabus. A synthetic unrelated approved sentinel record was identical before/after. SQL creates and normal saves occurred only in newly created task databases. [UI evidence](ui-integration-evidence.json), [SQL evidence](sql-integration-evidence.json), [English preview](sql-v2-en.json), [Filipino preview](sql-v2-tl.json).

Real browser visual quality/accessibility, full login/session/CSRF behavior, reverse-proxy controls and deployed infrastructure were not exercised. The current offline-only architecture intentionally prevents a true official V2 production-path E2E test. This boundary is retained as a blocker rather than bypassed.

### Provider/response safety

Mocked provider suites cover unconfigured/unapproved providers and absent credentials; HTTP failures, timeouts, rate limits, credit exhaustion; bounded retries/cooldown/locks; malformed JSON and missing fields; unsupported/duplicate relationship IDs; bad quotes/path mismatches; contradictory aspects; incomplete batches; stale inputs/reference hashes; cache/reuse keys and revision limits. No failure was promoted into supported semantic evidence in these tested paths. Valid independent results survive missing batches. Long-context omissions are explicit. No paid network transport was used.

Adversarial faculty instructions were captured inside untrusted document data, separate from system instructions. They could not directly set policy/score/program fields, replace source references or auto-apply content through the API response contract. This is a request/data-isolation test. **Actual Claude prompt-injection resilience is not measured**; a real model could still misjudge embedded instructions and requires separate bounded evaluation.

The confirmed defensive failure is malformed V2 stored-array handling (D2). It causes a caught500, not academic approval. Authorization, read-only persistence boundaries and the normal legacy workflow remained intact in its reproduction.

### Measured offline scale

Run: `node --expose-gc scripts/lcup-comprehensive-verification/performance.cjs`. These are single-machine mocked measurements, not repeated statistical benchmarks or actual Claude latency/capacity. [Raw measurements](performance.json), [log](performance.log).

| Synthetic workload | Planned primary pairs | Required weekly cells | Retained relationship records | Mock adapter requests | Elapsed ms | Observed result |
|---|---:|---:|---:|---:|---:|---|
| Small partial syllabus | 56 | 14 | 58 | 15 | 531.36 | Revision for incomplete schedule; includes cold-start overhead |
| Full18-week syllabus,15 instructional rows | 217 | 105 | 232 | 59 | 96.19 | Supported scripted evidence |
| Six ILOs per instructional row | 592 | 105 | 607 | 152 | 151.02 | Supported scripted evidence |
| Grouped Week1-2 | 205 | 98 | 219 | 56 | 56.75 | Faculty timing review |
| Long academic cell | 217 | 105 | 231 | 55 | 52.69 | Partially evaluated;13 context-limited pairs |

The primary plan includes course-level and optional diagnostics, not only seven weekly cells. More ILOs increase individual evidence pairs within the same105 grouped weekly requirement cells. Retained records also include eligible C2 diagnostics. These counts must not be interpreted as217 required weekly relationships or as152 simultaneous paid requests.

Four independent offline previews completed in236.88ms wall time, with236 total mock adapter requests. Peak process RSS across the script was146,452KiB (about143MiB); per-workload heap differences include GC noise. The ordinary Re-Check HTTP path separately refused overlapping requests with409. These results do not establish multi-user production throughput.

The actual existing Anthropic request builder was also exercised with a blocked/mock transport:55 main-pass request bodies,2,656,334 aggregate serialized bytes, estimated15,421 input tokens/request. The repository's pinned `2026-10-27` planning prices produced illustrative main-pass low/high estimates of aboutUSD1.41/7.59 and a guard worst bound ofUSD26.43; largest-request bound aboutUSD0.50. Model identifier in this replay is `claude-sonnet-4-6`. These are **heuristic repository-pinned estimates**, not current price verification, actual billing, an approved model/run budget or spending authorization. Conditional C2 and retries add calls. No live pricing/provider endpoint was contacted.

Request multiplication is an operational concern: the existing small batches and repeated course context can lead to59 requests for a normal synthetic syllabus and152 with six ILOs/row. Optional legacy diagnostics are still present for compatibility. Distinct relationship checks are not redundant merely because they share fields; do not remove them on that basis. Before a paid run, review the selected scope, optional diagnostics, repeated prompt payload and request/token caps through the existing guarded harness. No speculative optimization or feature activation was made. Existing cache/reuse regression tests passed; preview intentionally avoids historical judgment reuse. Actual hit rates and paid retry behavior remain unmeasured.

## H. Actual AI accuracy and faculty evaluation readiness

**ACADEMIC ACCURACY: NOT YET MEASURED.** Actual per-relationship accuracy, false approval/rejection rate, precision, recall, F1, evidence accuracy and recommendation acceptance rate are **null**, not0% or100%. [Actual metric output](actual-accuracy-unavailable.json).

Existing reusable materials:812 benchmark cases (504 real-source,308 synthetic), with751 semantic/diagnostic observations and61 objective-review cases;76 proposed coverage selections, including17 reference-held selections; blank faculty labels/identities and independent Part A/Part B/evidence/adjudication materials. All four programs and all seven links are represented. Cyber material is synthetic/reference-based, not an invented approved syllabus. Three baseline PDFs retain source/page/hash bindings, untagged ILOs, grouped/exam rows and literal mapping evidence.

The new [controlled selection](controlled-evaluation-selection.json) references the existing case IDs/hashes for categories A-J and adds14 clearly synthetic keyword-trap/equivalent-wording software contexts. Faculty expectations remain null. `softwareReplayExpectedStatus` is explicitly a test stimulus, never a faculty-approved answer. Incorrect recommendation proposals remain separately reviewable; no Claude authorship is invented.

The new descriptive metrics module reuses the existing benchmark measurement/provenance validator rather than generating judgments or evaluating policy. It adds a four-label confusion matrix, per-class precision/recall/F1, accuracy, per-program/per-relationship groups and incomplete-rate denominators. ALIGNED means an approval for binary interpretation; the other labels are preserved independently. Missing, invalid or NOT_CHECKED outcomes are excluded from agreement/confusion counts and reported separately as missing coverage. Ambiguous/multiple-acceptable faculty judgments retain the existing agreement analysis and are excluded from single-label confusion. Reference-held/objective/optional cases are excluded from required semantic accuracy according to the existing adapter.

False approvals use independently adjudicated clear NOT_ALIGNED cases judged ALIGNED; the reused false-rejection report tracks clear ALIGNED cases judged otherwise and reports label detail. Partial/insufficient results are not silently collapsed into a definitive semantic rejection. Every future report must show the corresponding denominator. Recommendation acceptance means bound independent faculty appropriateness ratings, not UI acceptance clicks; quote containment remains separate from independent evidence-support ratings. All actual denominators are zero until eligible labels/responses exist. Arithmetic-only tests use explicit synthetic test records and do not populate any faculty template.

The guarded existing paid evaluation scripts can be reused, but their fixed dataset aliases and V2's data-only preview do not yet constitute an authorized live V2 benchmark runner. A separately reviewed thin adapter/run plan must bind selected case IDs, approved reference snapshots, policy-scoped prompts, raw transcripts, budgets and response provenance through the existing safeguards. No provider loop was added here. No institutional accuracy acceptance threshold is invented.

Minimum prerequisites for a meaningful controlled evaluation:

1. Assign independent faculty reviewers with recorded program expertise; collect source-grounded judgments and adjudicate disagreements without model-answer priming. Keep raw returns and the frozen blank package separate.
2. Explicitly select a manageable, eligible scope from existing cases; preserve real/synthetic distinctions and reference holds. Review Cyber synthetic cases as such; do not describe them as real-syllabus evidence.
3. Resolve or explicitly hold conflicting PO/curriculum/mapping-basis items. Do not apply an unapplied migration or renumber historical faculty tags to manufacture readiness. Confirm pending value definitions/classification interpretations where they affect judgments.
4. Review the two software defects and obtain authorization for minimal corrections before certifying the corresponding guardrails. Rerun only affected regressions after a correction.
5. Authorize the specific future model, adapter, selected cases, request/token limits, retry/cooldown policy and budget. Retain raw V2 responses/source hashes; freeze prompts before touching protected holdout evaluation. This report authorizes no paid call.
6. Measure academic outcomes only on genuine version-matched responses paired with independently reviewed labels. Review whole-syllabus disposition separately from selected relationship accuracy; incomplete-scope results cannot establish whole-syllabus false approval rates.

## I. Remaining issues and recommended corrections

No CRITICAL issue was demonstrated in the permitted offline scope. Lack of observed critical failures is not a production security or academic-accuracy certification.

| ID / severity | Affected requirement and evidence | Recommended action; current state |
|---|---|---|
| **D1 HIGH** | Objective completeness, empty cells and false-support prevention. Two failing markup probes; scripted positive replay can support visibly blank weekly content. | Unify visible-text presence handling at checker/input boundaries while preserving47 rule IDs/weights and faculty text; add both client/server/V2 regressions. **Not implemented** because this task must not change existing compliance behavior. |
| **D2 MEDIUM** | Malformed V2 input reliability. Direct TypeError and real preview500. | Validate structured array/object shape before planning; return controlled typed client error without modifying stored content. Preserve identity and read-only guards. **Not implemented** in this verification task. |
| **O1 HIGH** | Controlled-evaluation budget/scalability.59/152 simulated requests per full workload and repeated context. | Review measured request/token plan, optional diagnostic scope and existing budget caps before any paid batch. Do not drop independent required links or add a stage. No optimization change made. |
| **R1 REFERENCE_BLOCKED** | Production PO inheritance/version rollout and historical mapping meanings. Correct local9/9/13/13 is not deployed proof; frozen masters conflict. | Review existing source-bound rollout/remediation plan separately, or approve an isolated reference context for selected cases. No migration or production write performed. |
| **R2 REFERENCE_BLOCKED** | Exact curriculum code/title/year conflicts, richer EGA basis, absent PO-EGA crosswalk and pending value definitions. | Record institutional interpretation/version decisions; retain authored source and hold affected judgments. Do not classify missing masters as faculty error. |
| **F1 FACULTY_DECISION_REQUIRED** | Academic truth, CLO classification/performance, activity/assessment appropriateness, values, mapping disputes, causal grouping and recommendations. | Obtain independent reviews and identified adjudication; no synthetic or old developer label becomes gold. |
| **F2 FACULTY_DECISION_REQUIRED** | Meaningful program coverage: real Cyber syllabus evidence absent in current benchmark. | Keep synthetic Cyber results separate and explicitly limited; do not claim all four programs have real-syllabus accuracy evidence. |
| **L1 MEDIUM** | No genuine V2 Claude run/ground-truth pairing or authorized live adapter/budget. | Complete reviewer/reference/run-plan prerequisites before separately authorized bounded live testing. |
| **U1 LOW** | Happy DOM checks establish text contracts, not visual/accessibility or deployed-login correctness. | Add real-browser/accessibility/deployed-auth testing during authorized integration, preserving current production gates. |
| **A1 LOW** | APA visual formatting/authenticity and unsupported types exceed text-parser scope. | Show explicit limits; use faculty/rendered-document review and separately authorized metadata verification where necessary. |

## J. Readiness decisions

| Scope | Decision | Basis and blockers |
|---|---|---|
| Offline software correctness against the complete requested scope | **NOT_READY** for full certification | 1,184 assertions pass, including legacy compatibility; four assertions remain failing across two real guardrail gaps. Eight verification objectives blocked and three untested. |
| Independent faculty academic evaluation | **READY_WITH_CONDITIONS** | Source-bound cases and blank review materials are usable now. Assign reviewers/adjudication, separate synthetic/real and keep reference-held judgments held; Cyber real-source coverage remains absent. |
| Controlled live Claude academic evaluation | **NOT_READY** | No authorization, adjudicated V2 benchmark pairings, approved run adapter/budget or resolved eligible reference scope. Do not start paid testing. |
| Policy V2 production integration | **NOT_READY** | Intentionally offline/nonofficial, persistence/gate integration absent by design; academic accuracy unmeasured and guardrail defects unresolved. |
| Production deployment | **NOT_READY** | No production-path certification, rollout authorization, academic acceptance evidence or deployment authorization. |

The next permitted work is review of this evidence and the recommended minimal corrections/reference/reviewer decisions. No paid evaluation, migration, activation or deployment was initiated. Work stops here for user review.
