# Academic Evaluation Policy V2: design and isolated verification

Date: 2026-10-29. Status: **proposal only; not active**.

The three reported compatibility failures were reproduced and fixed. Current scoring was reviewed, Policy V2 alternatives were designed, and an isolated comparison was executed. No official policy, score, passing mark, submission decision, database record or feature flag was changed.

## Deliverables

- [Policy V2 proposal, alternatives, legacy-check recommendation and validation requirements](PROPOSAL.md).
- [Readable shadow comparison](shadow-comparison.md) and [complete evidence/result JSON](shadow-comparison.json).
- [Test commands](test-commands.json), logs linked below and [integrity verification](integrity.json).

This report preserves earlier reports, including `docs/lcup-requirements/REPORT.md`, the C3 addendum and `docs/ilo-assessment-scoring-review.md`. The older scoring review's reference to six relationships predates the final consolidated requirements. The new proposal uses the final **seven** and does not rewrite historical documentation.

## Compatibility stabilization

All three failures remained reproducible at task start:

| Failure | Reproduction | Root cause | Minimal fix |
|---|---|---|---|
| Prompt variant configuration mismatch | Existing variants suite: 5 pass, 1 fail | The assembled PROMPT includes the requirements-advice segments, but the full-prompt helper's default flags omitted `requirements:true`, so `promptFor(PROMPT, 'current')` no longer returned the full prompt | Add that missing property to the helper's default full-prompt configuration |
| Missing Filipino CLO explanation | Localization audit and new exact-output regression | No dictionary template for `Required CLO classifications are missing: ...` | Add an English/Filipino template, using the existing list-aware `{fields}` interpolation |
| Missing Filipino CLO recommendation | Same audit and exact-output regression | No template for the faculty-review recommendation | Add its English/Filipino template; preserve academic labels and faculty text |

The combined new reproducer initially failed **3/3**: [before log](compatibility-before.log). Existing failure evidence is also retained in [variants-before.log](variants-before.log) and [translations-before.log](translations-before.log).

The first translation fix covered a single classification but the strengthened list assertion exposed untranslated comma-separated labels. The final templates use the existing `{fields}` path to translate each classification. No generic translator behavior or test expectation was weakened. Final compatibility results: **9 passed** (three regressions plus six existing variant tests). Final audit: **0 of 57** sampled server-authored sentences untranslated, down from 2 of 57. This is a sampled audit, not a claim that every possible generated or model-written sentence is translated.

Production provider requests pass explicit flags to the prompt helper. The default-helper correction does not activate any stage, change configured prompt wording, alter cache identities for explicit configurations or approve a model. Existing all-off/C3 prompt hashes and stage tests pass. Raw enum values, stored CLOs, Program Outcomes and faculty text are unchanged.

## Current scoring-policy assessment

Production sources inspected: `syllabuscheck/engine`, `policy`, `scoring`, `gemini`, `stages`, `variants`, `lessonfit`, `acceptance`, `validation`, `verdict`, `suggestions`, shared compliance service, content/approval routes, finding/recommendation presentation and existing test/evaluation reports. The prior consolidated requirements, approved-fixture, PO-correction, C3 addendum and ILO–Assessment review were reused.

**Objective compliance:** the 47-rule engine computes item pass fractions, weighted rule averages within areas, then a rounded area-weighted overall baseline. That baseline covers observable form/reference requirements; it is not an academic-alignment score. Its weights and rules are unchanged.

**Current semantic subtraction:** six AI types can deduct points: CLO-PO, CLO-EGA, ILO-CLO, ILO-activity, ILO-assessment and Module-value. NOT_ALIGNED costs 3; PARTIALLY_ALIGNED costs 1. Broken/unusable reference-link findings cost 2 under the existing checks; a lesson missing an approved core-value name adds 1. Deductions are summed and the candidate is clamped at zero. No course-length normalization or general root-cause de-duplication is applied.

Current grouping already reduces some mapping noise: one supported PO/EGA/CLO within the applicable group can make unsuitable additional tags advisory. If no tag is supported, multiple failed tag relationships can still each deduct. The controlled example with two failed CLO–PO links costs six points. The value example receives one coded name charge plus one semantic partial charge. These are observable overlapping charges, not proof that every such pair has one cause or should automatically receive a refund.

Only two of the final seven required weekly types are currently scored: **ILO–CLO and ILO–Activity**. Title–Content, Content–ILO, Content–Activity, Content–Assessment and Activity–Assessment are advisory. Several are behind disabled optional switches. Core reverse ILO-content also advises without costing points. Required relationships can therefore fail without lowering the numeric candidate. Four-CLO count/classification findings and much of the quality profile are advisory too.

The current numeric result **can be misleading if interpreted as comprehensive academic approval**. The controlled off-course-content case retains a candidate of 100 even while core ILO-content reports the mismatch and the proposed seven-link profile contains sixty unsupported cells. All other scored relationships are scripted as supported. This demonstrates a policy/accounting gap; it does not measure how Claude would actually judge that syllabus or how often the gap occurs in practice.

**Availability:** a candidate is not automatically a published grade. The engine publishes `score:null` when the pipeline is incomplete or synthetic, retaining a real critical curriculum zero separately. The structural baseline and nested provisional arithmetic can remain numeric. Consumers must not relabel those as completed AI approval. No academic alignment is inferred from provider unavailability.

**Advisory verdict:** the typed academic verdict has its own alignment/overall labels and an unapproved descriptive rubric. It can flag academic problems while the official numeric candidate remains high. Nothing in the submit path treats that advisory verdict as the official decision. The earlier `shadow-1` per-field capped score is another existing experiment, not Policy V2.

**Gates:** `compliance/service.requireHybrid` retains deterministic blocking checks. Its default `advisory` mode does not require a completed AI result; `required` mode requires a fresh, reference/content-consistent, verified, nonsynthetic result with `ready:true`. The inspected code does **not** make every advisory relationship a gate or directly require `report.passed`/a score of at least 79 in `requireHybrid`. The existing content submission path also checks conformance and author/catalog access. The pass mark 79 remains the numeric `passed`/band criterion; it must not be described as a universal hard submission gate. These behaviors were inspected and tested, not changed.

**Recommendations:** existing source/target quotation validation, schema checks, retag/rewrite distinctions, static proposal review, one-field conflict handling, upstream dependency ordering and human acceptance remain intact. A sound ILO with a wrong tag must not be rewritten into a different competence. C3 advice has no rewrite target. A grounded quotation does not establish that a proposed correction is academically sound or feasible; that remains a faculty-validation requirement.

## Proposed policy and legacy checks

[PROPOSAL.md](PROPOSAL.md) recommends a dual-axis evidence profile now: retain compliance separately, require visible coverage for all seven relationships and other original criteria, preserve unknowns, retain independent judgments, and group confirmed remediation roots without accumulating academic point penalties. No new official academic grade is assigned.

It also presents a separate bounded academic index and root-based deductions as alternatives. Their weights, partial-credit factors, severity thresholds, exclusions and academic cutoffs are explicitly unapproved. No arbitrary numbers are presented as institutional policy. Original CLO, week, learner-support, values, APA, field-completeness and recommendation requirements remain part of the full profile; seven-link support alone is insufficient.

Recommended future treatment of direct **ILO–Assessment**: advisory-only, retaining the diagnostic and its C2 input. Keeping it scored preserves useful direct evidence but adds a scored obligation outside the final seven and can multiply assessment charges. Retirement reduces cost/output but loses a useful non-transitive check and affects C2 eligibility. No production deduction was modified.

The controlled legacy-only example has current arithmetic 97. Holding all other answers fixed, keeping it scored gives 97, advisory gives 100 and retirement gives 100. Those are arithmetic counterfactuals, not Policy V2 grades or a simulation of C2 after retirement. The complete proposal explains why the two unscored options have different academic/technical implications despite the same refund.

## Isolated comparison and limitations

Executed **22 cases: three verified PDF-derived fixtures and nineteen controlled synthetic cases**. Current arithmetic comes from the existing engine. New projection code consumes existing pair definitions and answer/evidence validation; it never judges academic meaning, calls a provider, changes policy, monkeypatches production modules or writes a report to the database. The current six scored types and all optional runtime flags remain unchanged.

| Example | Current deterministic base | Current provisional candidate | Proposed weekly profile |
|---|---:|---:|---|
| Controlled supported assumption | 100 | 100 | 105 supported cells; scoped support only |
| Complete but off-course content | 100 | 100 | 60 unsupported / 45 supported; revision required |
| All seven unsupported | 100 | 10 | 105 unsupported; revision required |
| One independent required relationship fails | 100 | 97 for ILO–CLO/ILO–Activity; otherwise 100 | One unsupported cell; revision required despite 99.05% descriptive support |
| AI unavailable | 100 | 100 arithmetic only | Zero semantic coverage; no academic score |
| Shared content root affecting four links | 100 | 100 | Four independent failures, one declared remediation root, no point subtraction |
| Legacy ILO–Assessment only | 100 | 97 | Seven required links supported; legacy diagnostic retained separately |
| Two failed PO links on one CLO | 100 | 94 | Course-level PO criterion still requires review even though weekly links are supported |

Controlled masters remain `synthetic:true`; their published official scores remain null. No existing or real syllabus received those synthetic grades. The support proportions/ranges in the comparison are descriptive counts, never grades, confidence intervals or pass decisions. Unknown observations stay in denominators; no partial-credit weight is invented.

The frozen IT202/IE402/CpE304 source fixtures retain deterministic baselines **96/96/93** respectively and their existing source/reference issues. Their semantic observations are absent, so all **70/42/56** expected weekly cells remain NOT_CHECKED. The source-form critical CpE code result, where present, is a deterministic identity issue. Source and frozen masters were not corrected, normalized into a new Builder projection, remapped or relabelled for this experiment.

Controlled transcripts preserve quotes, recommendations, context hashes and provenance. They are author-scripted assumptions, not actual Claude responses, faculty judgments or accuracy labels. Shared roots are explicitly declared by the controlled scenario; unknown causes are not merged just because two findings share a field. Duplicate/stale/unquoted observations are not accepted as current evidence. Approved-source reference conflicts are not automatically attributed to faculty mistakes.

No real academic accuracy, inter-reviewer agreement, calibrated partial credit, institutional weighting, actual pass/fail transition rate or recommendation acceptance rate can be measured from this run. The original-requirements profile reuses existing typed findings; unasked C1/D2/new-advice criteria stay incomplete. Plain-text APA limits, conditional learner-support review, orientation/CLO policy and grouped-week timing still need the review specified in the proposal.

## Regression verification

Final targeted results: **568 tests passed, zero failed**. Full `npm test` and evaluation exporters were avoided because they can rewrite protected artifacts. No paid-mode evaluation command was run.

| Group | Passed | Log |
|---|---:|---|
| New compatibility regressions + existing variants | 9 | [compatibility](compatibility-final.log) |
| Isolated projection, accounting and preservation | 22 | [projection](projection-tests.log) |
| Existing consolidated requirements | 21 | [requirements](regression-requirements-tests-final.log) |
| Bilingual lesson authoring | 6 | [lesson UI](regression-lesson-ui-final.log) |
| Existing C3, verdict and model | 80 | [core](regression-core-regressions.log) |
| Existing academic stages, scoring, evidence and providers | 223 | [alignment](regression-alignment-regressions.log) |
| Rules/parity, gates, findings and save workflow | 161 | [workflow](regression-workflow-regressions.log) |
| Existing importer UI | 16 | [importer](regression-importer-ui-regressions.log) |
| Catalog and content HTTP integration | 22 | [catalog](regression-catalog-regressions.log) |
| Existing C3 addendum contracts | 8 | [C3 contracts](c3-addendum-tests.log) |

These cover all seven available relationships, independent failures, missing/partial evidence, exams/grouped weeks, ambiguous/missing mappings, provider failures, unchanged 47 rules/79/policy/gate source hashes, retained historical score bytes, unchanged recommendations and both UI languages. The projection tests read an existing saved report and verify its score/object bytes/file bytes are unchanged.

The sampled [localization audit](translations-final.log) reports zero missing translations among 57 sentences. The initial failed logs and intermediate list-translation assertion are retained for traceability. Final assertions were executed successfully; no protected package or historical output was regenerated.

Reproduction, from the repository root:

```powershell
node scripts/lcup-policy-v2/run-tests.mjs
node scripts/lcup-policy-v2/compare.cjs
node scripts/lcup-policy-v2/report.mjs
node scripts/audit-verdict-i18n.mjs > docs/lcup-policy-v2/translations-final.log
node scripts/lcup-policy-v2/verify.mjs
```

The audit is run **without** `--write`; its output is redirected only to this new folder. Test arguments and output paths are also recorded in [test-commands.json](test-commands.json).

## Exact files changed

Only two pre-existing files changed:

1. `server/lib/syllabuscheck/variants.js` — one default-configuration property; no prompt text, policy or runtime flags changed.
2. `src/i18n/lessonAuthoring.js` — two English/Filipino message templates with list-aware placeholders.

New isolated support files:

```text
scripts/lcup-policy-v2/compatibility.test.mjs
scripts/lcup-policy-v2/projection.cjs
scripts/lcup-policy-v2/compare.cjs
scripts/lcup-policy-v2/projection.test.cjs
scripts/lcup-policy-v2/run-tests.mjs
scripts/lcup-policy-v2/report.mjs
scripts/lcup-policy-v2/verify.mjs
```

All new design/evidence files are under `docs/lcup-policy-v2/`: this report, proposal, comparison JSON/Markdown, before/after state, integrity data, test commands and logs. Nothing in production `server/` or `src/` imports the projection. It creates no new checker, AI stage, database table or official policy implementation.

[Integrity results](integrity.json): **1,102 pre-existing files checked; 1,100 unchanged; two intended modifications; zero missing files; zero unexpected modifications.** HEAD remains `68926cb392756c07bb0b999538d098d1038be368`. All pre-existing uncommitted work was preserved, including the other agent's C3 missing-text improvement, addendum, dataset and legacy-check review/tool.

The 47-rule data/engines, passing mark 79, current policy and deduction implementation, scoring aggregation, submission gates, Stage C3 execution, official PO/curriculum references, environment files, faculty source PDFs/fixtures, prior reports, A1/A2/A3/B1/B2, align-1, Faculty Review Packages, faculty-response importer outputs and protected held-out data retain their task-start hashes. No database access, writes, migrations, commit, push, merge or deployment occurred.

## Decision and next work

Review Alternative A and the recommended advisory treatment of direct ILO–Assessment. Faculty validation must establish criterion boundaries, expected scope, missing/partial handling, causal grouping, recommendation quality and any numeric calibration. The proposal lists implementation/version/cache and rollout requirements for a later authorization.

Policy V2 is **not activated**. Production scoring, deductions, mark 79, gates and disabled flags remain unchanged. No live Claude evaluation was started. Work stops for review.
