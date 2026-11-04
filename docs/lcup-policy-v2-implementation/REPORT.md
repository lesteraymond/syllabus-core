# Academic Evaluation Policy V2 — implementation for review

Date: 2026-10-29. Policy ID: **`academic-evaluation-v2-preview-1`**. Implemented as an actual versioned branch of the existing shared Hybrid-2 service. **Inactive in production; offline replay only; not an official grade or submission authority.**

The user's original requirements are the V2 authority. The branch does not run legacy academic penalty arithmetic and does not append an advisory verdict to a legacy academic score. It computes the unchanged deterministic baseline separately and constructs the required academic evidence profile from existing relationship factories and the existing Claude response validator. No numerical academic weights, deductions, percentages or threshold were introduced.

## Completed work and evidence

- [Complete original-requirements mapping](requirements-matrix.md).
- [Actual legacy-versus-V2 comparison](comparison.md), [machine-readable results](comparison.json), [execution log](comparison-run.log).
- [Executed test commands and outcomes](test-results.json), [integrity verification](integrity.json), [exact task file inventory](FILES.md).
- [Before state and file hashes](before.json), [before gate/checker function hashes](gate-functions-before.json), [after Git status](after-status.txt).

Reviewed the completed requirements matrix/report, Policy V2 report/proposal/shadow comparison, C3 addendum and direct ILO–Assessment scoring review before extending their work. Inspected the Builder, `engine`, legacy `policy`/`scoring`, `gemini` provider/prompt/validation path, stage flags, `lessonfit`, `requirementsAdvice`, `values`, `references`, `verdict`, master resolver, shared service, report repository, checking routes, findings/recommendation UI and submission guards. Their prior reports, fixtures and historical evaluations were not regenerated.

## What replaces the old academic policy in V2

| Legacy AI type | Legacy behavior retained for legacy mode | V2 academic role |
|---|---|---|
| CLO-PO | −3 NOT_ALIGNED, −1 PARTIALLY_ALIGNED; original mapping grouping | Required approved-PO evidence, exact historical/reference basis review, no deductions |
| CLO-EGA | Same legacy −3/−1 policy | Required institutional-EGA evidence, no deductions |
| ILO-CLO | Same legacy −3/−1 and grouping | Required third weekly relationship; all explicit mappings retained, ambiguity reviewed; no deductions |
| ILO-activity | Same legacy −3/−1 | Required fifth weekly relationship; no deductions |
| ILO-assessment | Same legacy −3/−1; retains C2 dependency | Optional advisory diagnostic; no effect on required disposition, no −3/−1, not an eighth requirement |
| Module-value | Same legacy −3/−1 plus existing coded name handling | Required meaning evidence against **Course Content**, together with D1 integration/name/reference evidence; no deductions |

Five previously advisory weekly types become required V2 evidence: Content-course, Content-ILO, Content-activity, Content-assessment and Activity-assessment. The two remaining required weekly types above are preserved independently. Course title/description, description/plan, Course-CLO, four-CLO count, four classification labels and classification meaning, PO/EGA mappings, Weeks 1–18, Week 1 introduction, learner support, values, APA-text checks and required fields also contribute to V2's required scope.

Only one previously absent semantic type was added: **CLO-classification**, within the existing Stage A request/schema/answer path. Its interpretation is kept separate from label completeness; it offers review, never automatic retagging. No AI stage, second provider pipeline or parallel checking engine was created. Existing C3 source/target contracts remain intact.

The reverse ILO-content, whole-set/coverage/sequence and reference-relevance observations are retained as diagnostic records rather than duplicate required obligations. Existing direct ILO–Assessment and C2 evidence are explicitly available under `academic.diagnostics` with `affectsDisposition:false`.

Legacy link/value-name/AI charges do not enter V2 academic arithmetic. The existing 47-rule compliance calculation and existing coded findings remain intact; the V2 compliance number is that deterministic baseline, with coded conformance separately exposed. It is not the legacy hybrid candidate after link/name/semantic deductions and is not academic approval.

## Dual-axis report and disposition

`compliance` identifies its existing policy, 47 rules, baseline score, passing mark **79**, findings, coded conformance and rule conformance. It does not certify academic correctness.

`academic` identifies the V2 policy, required criteria, individual relationship evidence, coverage counts, reference status, full original structured content, remediation actions and provenance. It has **no academic score, percentage, deductions, passing mark or faculty-approved label**.

Disposition uses the following order, retaining every independent finding:

1. **REQUIRES_REVISION** when an evaluated required criterion has a substantiated failure, including a known objective requirement such as four CLOs or schedule validity. A high compliance baseline cannot cancel it.
2. **FACULTY_REVIEW** for ambiguous/partial evidence, disputed additional mappings or unavailable/conflicting institutional references.
3. **PARTIALLY_EVALUATED** when some required evidence is unevaluated.
4. **NOT_EVALUATED** when required semantic evaluation did not run or no usable semantic observation exists, unless a known required objective failure already establishes revision.
5. **SUPPORTED_BY_SUPPLIED_EVIDENCE** only when the evaluated required scope has no open issue. This is not faculty approval.

A record retains relationship ID/type/path, actual source and target, raw judgment, verified quotation evidence, explanation, correction or review requirement, context hash and policy/input/reference/prompt provenance. Validation reuses the existing evidence matching, aspect consistency and draft-review safeguards. Missing, unsupported, duplicate or invalid answers never become supported evidence. Context limits explicitly withhold certification of an unseen remainder, while original source content remains in the preview.

For ILO–CLO and CLO–PO/EGA groups, one supported mapping with unsupported additional tags yields faculty review rather than silently removing tags or rewriting valid outcomes. Missing tags are not invented. When the master PO basis or historical authored numbering is incompatible, PO judgments are withheld for reference review. Cyber inherits BSIT's nine POs only when that relationship is established in the supplied resolved master; its own approved curriculum remains separate. Engineering bases retain thirteen outcomes each. No reference/migration/data correction was performed.

Institutional value definitions currently remain `pending_approval`. A semantically positive result does not resolve that approval gap. Test-only configured definitions are explicitly marked synthetic and are not installed into institutional configuration.

Shared-root grouping requires a reviewer, receipt, explanation of the cause, exact input/reference hashes, provenance and a concrete correction. A mock receipt is labeled as a mock. Each affected relationship remains visible. Unconfirmed/stale groups are withheld, and independent errors remain separate. Actions require human review and cannot auto-apply changes.

## Safe preview and compatibility

Normal Builder → Re-Check API → shared checking service → saved report → faculty/admin display remains the legacy path. No normal route supplies the V2 selector. Existing Stage A/B/C/C3/D switches cannot select V2. No production flag or environment value was enabled.

The explicit opt-in entry is:

```text
node scripts/lcup-policy-v2-implementation/preview.cjs --input <content-masters-replay.json>
```

The input contains `content`, `masters` and `offlineReplay`. The replay must contain the exact policy version, source hash, reference hash and raw judgment records. `plan(content,masters)` exposes the matching hashes/pairs for an offline harness. An optional `availability:"unavailable"` represents no provider evaluation. Unknown policy versions, stale input/reference hashes and absent replay data are rejected. Optional `--output <new-file.json>` uses exclusive creation and refuses to overwrite an existing file.

The preview uses a closed data-only transport inside the existing Claude Messages adapter, not an injected live fetch. It does not read `.env`, accept credentials/URLs, use global network fetch or fall back to a paid provider. Test-local flag objects assemble existing prompts/contracts; they do not change `process.env` or enable production stages. Supplying live `env`, `transport`, `useAi`, link or reference-fetch options to the V2 evaluator is refused. Replay prompt/cache identities include the V2 namespace; historical results are not reused.

A read-only HTTP integration hook exists at `POST /syllabus-check/syllabi/:id/academic-v2-preview`. It returns 404 unless an isolated application harness installs `app.locals.academicV2OfflinePreviews` as a static replay Map. No production bootstrap installs it. Request bodies cannot enable it. Existing authentication/visibility checks remain in force. The hook uses SELECTs and shared `service.checkHybrid`, returning versioned preview JSON without storing a run, report, decision or activity entry.

V2 previews deliberately carry top-level `score:null`, `overall:null`, `passed:false`, `hybrid.ready:false`, `evaluationOnly:true`, `official:false` and `active:false`. Both official persistence functions reject them before SQL. Legacy reusable judgments/correction history exclude them. Existing saved JSON remains readable without reinterpretation. The required-AI submission gate rejects a preview; the unchanged advisory gate continues applying its existing coded conformance policy. V2 creates no new submission gate.

The faculty/admin report components recognize only the explicit V2 version. They show the compliance number/79 separately from the academic disposition, identify the offline/nonofficial status and suppress legacy grade rings, decision/refinement requests and apply buttons for previews. English and Filipino labels are provided; faculty and evidence text remains verbatim. The existing Builder content-first workflow and printed column order were not edited.

## Legacy-versus-V2 execution

All **22 existing shadow-case IDs** were reused, without changing the historical comparison or fixtures. The new comparison executes the actual engine's legacy branch and V2 branch. Synthetic scenarios supply the same scripted labels; each branch receives its own contract fields and verbatim quotations from its actual pair payload. V2 adds required classification/learner/value evidence absent from the legacy scope. Synthetic PO and value contexts are explicitly test-only. Results do not estimate model accuracy.

| Controlled case | Legacy provisional candidate | V2 compliance | V2 academic disposition |
|---|---:|---:|---|
| Complete off-course content; 60 failed required weekly cells | 100 | 100 | REQUIRES_REVISION |
| Each of the seven relationships fails independently | 100 or 97 depending on legacy scored type | 100 | REQUIRES_REVISION in every case |
| All seven fail | 10 | 100 | REQUIRES_REVISION |
| Partial supplied responses | 100 | 100 | PARTIALLY_EVALUATED |
| Provider unavailable | 100 | 100 | NOT_EVALUATED |
| One ambiguous relationship | 100 | 100 | FACULTY_REVIEW |
| Direct ILO–Assessment alone fails | 97 | 100 | SUPPORTED_BY_SUPPLIED_EVIDENCE for the required scope; diagnostic failure retained |

Candidates above are provisional, not published grades. No historical result was changed.

The approved IT202/IE402/CpE304 fixtures were consumed byte-for-byte with their frozen masters and **no supplied semantic judgments**. Compliance baselines remain 96/96/93; weekly academic alignment remains **NOT_EVALUATED for all three**. The broader required profile records existing objective/reference discrepancies: exact title/curriculum identity differences, missing classification-label coverage, IT202 schedule coverage and text APA issues where present. Its overall revision disposition must not be reported as a new Claude or faculty misalignment judgment. `objectiveRevisionCriteria` and `referenceIssues` in the new comparison JSON preserve the exact distinction. No PDF wording or fixture was corrected to make it pass. The existing CpE304 frozen curriculum-code conflict still exists; no curriculum change was authorized here.

## Executed regression results

Final targeted result: **604 passed, 0 failed, 0 skipped**, across 13 groups: **546 existing regressions and 58 new V2 tests**.

| Executed group | Passed | Log |
|---|---:|---|
| Consolidated requirements | 21 | [log](regression-requirements-tests-final.log) |
| Existing bilingual lesson authoring | 6 | [log](regression-lesson-ui-final.log) |
| C3, verdict and syllabus model | 80 | [log](regression-core-regressions.log) |
| Alignment, stages, scoring, providers and prompts | 223 | [log](regression-alignment-regressions.log) |
| 47-rule parity, routes, gates, findings, save and localization | 161 | [log](regression-workflow-regressions.log) |
| Existing importer UI | 16 | [log](regression-importer-ui-regressions.log) |
| Catalog and content HTTP persistence | 22 | [log](regression-catalog-regressions.log) |
| Prior compatibility fixes and prompt variants | 9 | [log](compatibility-final.log) |
| C3 addendum contracts | 8 | [log](c3-addendum-tests.log) |
| V2 replacement policy | 36 | [log](policy-tests-final.log) |
| V2 HTTP/persistence isolation | 5 | [log](api-tests-final.log) |
| V2 English/Filipino UI and old-report rendering | 7 | [log](ui-tests-final.log) |
| Context, references, missing data, identity, CLI and comparison | 10 | [log](robustness-tests-final.log) |

Commands are recorded in `test-results.json`; `run-regressions.cjs` reruns this targeted set, and `--v2-only` reruns the four new groups while preserving recorded existing-group outcomes. The comparison command must run before its artifact assertions. No full `npm test`, dataset exporter, migration or production process was run.

Initial failures were retained, not hidden: the first policy suite had two failures (explicit `legacy` selector reaching the prompt extension; an untagged-ILO test expecting partial evaluation despite an existing required mapping-review finding). The selector is removed before the unchanged legacy path; the untagged test now verifies the actual faculty-review status, missing evidence and unchanged tags. Initial API tests omitted the existing authentication SELECT from their fake database; the read-only adapter was corrected. One historical UI assertion expected a grade ring although that old report has no `ready` field and the existing view treats it as incomplete; it now verifies the unchanged legacy display path and score data. Final assertions do not convert unknown or invalid evidence into a pass. Initial and final logs remain separate.

The **old design-only 22-test projection suite** was not rerun or modified. It pins source hashes to the pre-V2 engine/service as proof that the earlier design task had no production edits; those immutability assertions are obsolete for this explicitly authorized implementation. Its artifacts and test file remain unchanged. The actual replacement, prior shadow scenarios, legacy equality and preservation guarantees are covered by the new tests. This exclusion is not reported as a passing or skipped executed test.

## Exact source changes and repository integrity

Nine existing files were edited incrementally over the captured dirty tree:

| File | Change |
|---|---|
| `server/lib/syllabuscheck/engine.js` | Explicit versioned policy dispatch before the untouched legacy run; explicit legacy option normalized away |
| `server/lib/syllabuscheck/gemini.js` | Optional V2 prompt suffix/cache namespace and classification no-rewrite type; existing default prompt/scoring preserved |
| `server/lib/compliance/service.js` | Shared V2 branch without legacy reuse/history; official storage rejection before SQL |
| `server/lib/syllabuscheck/repository.js` | Preview storage rejection; exclude preview data from legacy reuse/history; generic read behavior retained |
| `server/routes/syllabusCheck.js` | Inactive-by-default read-only replay hook |
| `src/components/VerdictPanel.jsx` | Explicit V2 report display selection |
| `src/components/HybridCheckPanel.jsx` | Suppress legacy decisions/refinement UI and calls for V2 |
| `src/views/ComplianceCard.jsx` | Select separate-axis view for V2; preserve legacy rendering |
| `src/i18n/index.js` | Register new English/Filipino dictionary |

Seven production support files were added: `server/lib/syllabuscheck/academicPolicyV2.js`, `academicV2Plan.js`, `academicV2Replay.js`; `src/data/academicPolicyV2.json`; `src/lib/academicEvaluation.js`; `src/i18n/academicV2.js`; `src/components/AcademicEvaluationPanel.jsx`.

Ten isolated supporting/test scripts are under `scripts/lcup-policy-v2-implementation/`: `fixtures.cjs`, `policy.test.cjs`, `api.test.cjs`, `robustness.test.cjs`, `ui.test.jsx`, `test-ui.mjs`, `preview.cjs`, `compare.cjs`, `run-regressions.cjs`, `verify.cjs`. Reports/logs/manifests are isolated in this documentation directory. Generated UI bundle/replay examples are under `tmp/lcup-policy-v2-implementation/`. [FILES.md](FILES.md) inventories every task file, including artifacts.

The task began with extensive Codex/Claude uncommitted work. HEAD remains `68926cb392756c07bb0b999538d098d1038be368`. Of **1,134 captured existing project files**, only the nine intended files changed; **1,125 remain byte-identical**, none are missing and there are no unexpected modifications. Prior temporary directories were excluded from that baseline and are not claimed as new task files. The unchanged baseline includes deterministic rules/standard, legacy scoring policy, gate sources, Stage C3 functionality, Builder authoring/layout, seeds/references, PDFs, verified fixtures, historical reports, protected datasets and `server/.env`. `coded` and `requireHybrid` function-body hashes are identical to their before values. All pre-existing dirty changes outside the nine incremental edits are preserved.

## Limits, faculty decisions and readiness

Implementation and offline integration are complete for this preview policy. **Academic accuracy is not established.** No Claude/faculty label set or genuine root-cause judgment was fabricated. Three approved-source documents remain unevaluated semantically, and approval does not entitle them to 100 or erase their institutional-reference conflicts.

Faculty/institutional validation remains necessary for classification interpretations, diverse-learner adequacy, value-definition approval, ambiguous/extra outcome mappings, exact-title/reference differences, curriculum coverage, APA parser scope, recommendation usefulness and confirmed shared causes. EGA judgments use the supplied resolved institutional master and its reference hash; this task does not certify a new institutional reference version. Existing historical PO-remediation guards can refuse master resolution; that refusal must be resolved through its authorized review path, not bypassed by this preview.

Tests used local HTTP and fake read-only database adapters, serialization and existing report-reader/UI code. They did **not** test a deployed browser against production/MySQL records or persist a V2 report to a real database. Official V2 persistence and gate integration are intentionally unavailable. Exported layout, reference authenticity, all APA visual rules, factual correctness and model calibration remain outside these software-test claims.

Ready for review of the implemented replacement policy and a separately authorized controlled Claude evaluation. That future work must use the V2 prompt/reference namespace through the existing provider adapter, explicit budget and evaluation-only controls; collect independent faculty judgments, assess each relationship and recommendation, and resolve reference gaps first. No live-evaluation transport or activation flag is exposed by this preview. Production activation, official report persistence and any submission-policy adoption require explicit later authorization and regression verification. Legacy remains the production default and rollback path.

**Executed paid AI calls: 0. Database writes/migrations: 0. Production feature flags enabled: 0. Commits/pushes/merges/deployments: 0. Stopped for review.**
