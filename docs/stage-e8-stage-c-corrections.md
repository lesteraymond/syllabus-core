# Stage E.8: offline Stage C academic recommendation corrections

Status: implemented offline for review on 2026-10-26; no provider call or new live evaluation. The original [r7 canary report](stage-e8-stage-c-canary.md), [raw result](ai-eval-stage-e8-c-canary-resume.json), [offline review](ai-eval-stage-e8-c-canary-review.json), and [ledger](ai-eval-stage-e8-c-ledger.json) remain the baseline. Their labels, explanations, drafts, expected dataset labels and usage records are not rewritten to make the corrections appear successful.

## Causes established before editing

### Conceptual lesson rejected as insufficiently practical

`af-prog1-conceptual-lecture-ok` requires explaining a difference. Its activity already contains lecture-discussion, worked examples and a discussion of when the constructs are used. The r7 answer first acknowledges that these develop the skill, then demands coding because it reads the course's laboratory unit as a requirement for this lesson. It also discounts the written worked examples as instructional support.

The C1 wording contributed to this interpretation: it broadly said a lecture alone does not develop an Apply-or-higher ILO, emphasized laboratory units, and described support through alternatives/scaffolding/collaboration without stating as explicitly as C2 that a conceptual lesson may legitimately use lecture and guided explanation. `lessonfit.js` placed course-level contact units in each lesson snippet without an explicit scope qualifier. The static reviewer had no conceptual-to-practical competency expansion check, so the unnecessary pair coding/laboratory rewrite escaped.

The correction assesses an ILO's action, object and required evidence together. Knowledge/understanding, application, analysis, evaluation, design/creation and practical demonstration describe distinct demands; none alone establishes a physical venue. A conceptual explanation may use lecture, discussion, demonstrations or guided explanation. Genuine practical performance still requires appropriate learner practice. Neither a technical program nor course-wide laboratory units makes every lesson practical.

### Laboratory resource assumption was not reviewed

`af-sensors-passive` has a design-and-test ILO with only a lecture, so a practical learning opportunity is an academically plausible correction. Its draft nevertheless proposes laboratory testing and measurement without established facilities or equipment. Laboratory zero does not prove that practical work is impossible; it also does not establish access.

The r7 prompt prohibited invented resources in general but gave no clear conditional-resource alternative or separation between resource uncertainty and competency misalignment. In `answerReview.js`, added activity/resource checks applied only to values drafts. Stage C drafts received copied-wording, participant and week checks, leaving these resource and competency assumptions unreviewed.

The correction distinguishes the pedagogical need from feasibility. A justified practical activity may be proposed conditionally when resources are unknown; the reviewer does not invent equipment, software, facilities, external participants or institutional requirements, and an unconfirmed arrangement is not silently treated as a proven academic failure.

### Both copy warnings were real matches, not proof of bad pedagogy

`af-prog1-irrelevant` copied the sibling positive activity's pair/starter-file arrangement. `as-prog1-recall-quiz` copied the sibling positive programming assessment. Their shared ILO makes both replacements pedagogically plausible; the starter file and exam-score scenario still need scrutiny as particular details. The previous four-word sequence rule established wording overlap and immediately withheld the draft, without distinguishing relevant terminology or same-competency correction from an imported unsupported detail.

New recommendation review keeps inconclusive similarity advisory. Withholding needs a supported concern such as imported unsupported circumstances, an assumed resource, or an unnecessary expansion of the required competency. A match does not change the academic label or become a speculative academic finding.

## Prompt, recommendation and compatibility behavior

- Prompts containing C1 or C2 now use **r8**: C1/C2 only is `alignment-12c1c2-r8`. D1/D2-only prompts retain r7, and all advisory flags off retains the byte-for-byte `alignment-10` prompt. Old r7 Stage C answers are not reused under the new wording; saved reports remain readable as their historical records.
- Stage C explicitly distinguishes cognitive demand from practical performance, treats worked examples as support, and preserves the original lesson's subject, ILO and justified demand. Unknown feasibility is described as uncertainty rather than silently becoming misalignment.
- Recommendation quality is separate from the finding. `draftReview` identifies drafts withheld from application; optional `draftWarnings` carries advisory uncertainties that do not alone withhold a usable suggestion. Matched evidence remains explainable and no heuristic relabels, refuses or retries a structurally valid answer.
- Unnecessary practical work for a clearly conceptual ILO, unverified resources/facilities or participants, and unsupported competency expansion receive conservative review. Conditional proposals must actually condition the relevant resource; a generic reassuring phrase is not proof of availability.
- Resource evidence is checked for the particular named item: a stated multimeter does not establish an oscilloscope, and known MATLAB access does not establish LTspice. Negation is scoped to the referenced resource, so ruling out a simulator does not silently establish a breadboard, while unrelated wording such as "no calculation errors" does not make a stated laboratory unavailable. An ILO's technical demand and course-topic terminology are not a resource inventory.
- Faculty-authored content changes only through the existing explicit author approval flow. Official scores, deductions, the 79 pass mark, readiness, submission gates, curriculum references, provider abstraction and default-off advisory flags are preserved. Normalized title matching is not activated.

| Review code | Effect on an otherwise valid answer |
|---|---|
| `practical_requirement`, `resource_assumption` | Advisory explanation cautions; no label, field, score or retry changes. |
| `unnecessary_practical`, `assumes_resource`, `expands_competency`, `adds_participant` | Withhold the suspect draft for faculty review, with matched wording; retain the original judgment and faculty text. |
| `copies_other_relationship` | Retains the established values-draft protection. For a Stage C draft, withholding requires an independently identified unsupported detail, not similarity alone. |
| `borrowed_wording`, `conditional_resource` | Advisory `draftWarnings`; do not alone withhold a legitimate proposal. |

The rules remain conservative English text heuristics, not a validated academic classifier. Mixed or ambiguous ILOs need faculty review. A resource recorded as stated means the supplied lesson text names it, not that an external inventory verified it. Conditional wording does not prove feasibility. Same-ILO similarity can still hide an unsuitable borrowed detail, while legitimate shared terminology must not alone be called contamination. No new model measurement demonstrates that r8 will produce better academic judgments; the prepared canary must test that separately.

## Offline replay of the original request batches

The [separate replay record](ai-eval-stage-e8-c-corrections-replay.json) applies the new pure validation/review code to each saved response with its **original request's pairs**. It does not create a model response, ask another question or broaden sibling context to unrelated dataset items. All eight labels and structured aspect records remain identical to the baseline; 11 protected baseline files remain unchanged, with zero new paid requests or provider cost.

| Saved case | New static review behavior |
|---|---|
| `af-prog1-conceptual-lecture-ok` | Explanation caution for the practical requirement; the unnecessary practical/resource-dependent draft is withheld. The saved PARTIALLY_ALIGNED label is retained rather than silently converted to ALIGNED. |
| `af-sensors-passive` | The unqualified laboratory-testing assumption now withholds the draft; its original academic judgment remains available. |
| `af-prog1-irrelevant` | The imported laboratory/starter-file assumptions independently justify withholding, with the sibling match retained as supporting review evidence. |
| `as-prog1-recall-quiz` | Similarity is now only `borrowed_wording` in `draftWarnings`; it no longer withholds the pedagogically plausible same-ILO correction by itself. |

This establishes the safeguards' behavior on historical r7 text. It does **not** change the historical canary's 7/8 provisional agreement or establish r8 model accuracy. The live conceptual false rejection remains an unresolved model-behavior question for the separately approved regression canary.

## Focused regression canary prepared, not run

The [updated Stage C plan](stage-c-evaluation-plan.md) selects **12 unchanged `stage-c-2` cases**: the original eight plus practical positive controls, a genuine lack-of-practice case, and a conceptual assessment control. It keeps all provisional expected labels. Missing/unverified upstream evidence and broader Analysis/Evaluate distinctions remain separately exercised offline because the current live dataset is not a benchmark covering every such condition.

Proposed additional allowance: at most **15 HTTP attempts and $0.03**, including key check, price lookup, retries and uncertain charges. The same open ledger already holds **7 attempts/$0.00294347**, so the enforced command uses **22 cumulative attempts/$0.03294347**. This remains inside the overall **65/$0.09** ceiling. The existing transient count of one is retained. Nothing in this document grants paid-run approval or authorizes the complete 28-item evaluation.

Offline capture of the r8 request bodies, with global network access blocked and an injected transport, gives four initial model batches, approximately 19,983 input tokens by characters/4, and 20,611–22,282 bytes per request. At the historical E.8 highest endpoint prices of $0.30/$1.20 per million input/output tokens, reservation is approximately $0.01609–$0.01659 per initial request with 8192 maximum output tokens. The planning bill estimate is **$0.004–$0.012**, not a current price quote or completion guarantee. A timeout can consume its entire reservation and stop the canary before completion.

## Verification and files

| Check | Final result |
|---|---|
| Targeted Stage C/E.8 regressions | **54/54 passed**, covering the existing Stage C suite, corrections, prompt/cache behavior, verdict separation and evaluation datasets |
| Full `npm.cmd test` | **1,279 core + 22 localization + 54 rendered UI + 12 PDF UI = 1,367 passed**, zero failures/skips |
| `npm.cmd run audit:i18n` | 2,211 bilingual keys, 1,164 interface references; no hardcoded display strings |
| Verdict localization audit | Zero missing Tagalog entries among 55 sampled server sentences |
| Production build | Passed, 208 modules; the existing >500 kB bundle-size warning remains (approximately 1,026.99 kB JavaScript) |
| Offline replay and preservation | All eight original labels/aspect records preserved; 11 protected baseline files unchanged; zero new provider requests/cost |
| Rules export and whitespace | Offline export completed with outbound network APIs blocked; syntax and whitespace checks passed |

Regression coverage includes conceptual explanation with lecture/worked examples; genuine practical skill with practice or insufficient practice; course-level units without lesson-level obligation; correct/incorrect assessment demand; unavailable/unknown/stated individual resources and conditional alternatives; negated resource or scope references; external participants; legitimate same-competency language; actual imported details; draft withholding without label/scoring changes; missing upstream evidence; offline AI behavior; cache invalidation and legacy report reading. All tests use local fixtures or injected transports; none proves faculty-verified academic accuracy or live r8 behavior.

These are this correction's files, separate from pre-existing uncommitted work:

| Group | Files |
|---|---|
| Checker and recommendation review | `server/lib/syllabuscheck/stages.js`, `lessonfit.js`, `answerReview.js`, new `recommendationReview.js`, `gemini.js`, `engine.js`, `verdict.js` |
| Evaluation reporting | `server/lib/syllabuscheck/eval/answerReviews.js`, `scripts/eval-alignment.cjs` |
| New regression suites | `server/lib/syllabuscheck/stage-e8-corrections.test.js`, `stage-e8-prompt.test.js`, `stage-e8-verdict.test.js` |
| Existing regression updates | `server/lib/syllabuscheck/stage-c.test.js`, `stage-e4.test.js`, `stage-e5.test.js`, `stage-e6.test.js`, `stage-e8-canary.test.js`, `stage-e7-datasets.test.js` |
| English/Tagalog verdict UI | `src/components/VerdictPanel.jsx`, `src/i18n/hybrid.js`, `src/lib/complianceView.js`, `src/lib/complianceView.test.js`, `tests/i18n-ui.test.jsx` |
| Documentation and replay | `docs/stage-e8-stage-c-corrections.md`, `docs/stage-c-evaluation-plan.md`, `scripts/export-checker-rules.cjs`, generated `docs/ai-checker-rules.md`, new `docs/ai-eval-stage-e8-c-corrections-replay.json` |

Existing test fixtures that were meant to exercise learner support now use a conditional starter resource or a minimal teacher-feedback correction, so they test support without silently assuming an unprovided resource. No expected live dataset label was changed. No `.env` edit, migration, production write, commit, push, merge or deployment is included. The corrected prompt and safeguards are ready for review; no regression canary or full Stage C evaluation has been executed.

## Resumed verification and cleanup

The final full-suite log was checked after resuming: all 1,367 tests passed with zero failures/skips. Its timestamp follows the final checker/test edits; the successful production build follows the final UI edits. The 54 targeted tests, both localization audits and `git diff --check` were also rerun successfully without implementation changes. The offline replay was repeated against the original request batches and produced a byte-identical replay artifact; all 11 preservation hashes still match. The original ledger remains at seven attempts and $0.00294347, and no paid r8 regression result exists.

Removed only the unreferenced, disposable helpers `tmp/stage-e8-review.cjs` and `tmp/stage-e8-corrections-replay.cjs`, after inspecting them and retaining their generated reports. All baseline evaluations, ledgers, source snapshots, verification logs and preservation-hash records were kept. No checker reimplementation or additional provider call was needed.
