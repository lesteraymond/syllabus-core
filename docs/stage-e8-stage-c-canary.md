# Stage E.8: controlled Stage C canary

Status: canary completed and stopped on 2026-10-26. Structural validation passed; academic review identified a false rejection, an unnecessary correction and an unconfirmed laboratory-resource assumption. **The canary does not pass the academic continuation check.** No full Stage C run was executed, and no approval to continue is requested here.

This follows [the E.7 offline follow-up](stage-e7-academic-reliability-follow-up.md) and [the Stage C evaluation plan](stage-c-evaluation-plan.md). Existing uncommitted work, the 28-item `stage-c-2` dataset, and historical D1/D2 evaluations remain in place. The canary selects existing items without changing their source, target, provisional expected label or expected structured fields.

## Authorized scope and settings

- One canary run of eight existing `stage-c-2` development examples, listed below: four Activity-fit and four Assessment-fit relationships across programming, systems engineering and mixed signals/sensors.
- OpenRouter `minimax/minimax-m3.1-flash`; full C1/C2 r7 prompt; temperature 0; strict JSON schema; prompt trimming and optional `minItems` disabled. Only process-local C1/C2 configuration is enabled for this evaluation; production settings are not changed.
- At most **15 HTTP requests**, counting the key-status preflight, price lookup, every model request and retry; at most **$0.03 USD** charged under the existing conservative reservation/reconciliation guard.
- Stop after this canary, even if it succeeds. No full-dataset run, other dataset evaluation or Phase 3 is included.

## Selected live cases

| ID | Type and course | Canary purpose | Provisional expectation |
|---|---|---|---|
| `af-prog1-good` | Activity-fit, IT 202 | Correct instructional activity: demonstration, pair coding, execution and scaffold support the practical ILO. | ALIGNED; teaching sound, learner support adequate |
| `af-prog1-irrelevant` | Activity-fit, IT 202 | Incorrect activity: computer-history discussion/video does not practise developing and testing conditional programs. | NOT_ALIGNED; teaching weak |
| `af-sensors-passive` | Activity-fit, CPE 304 | Practical design-and-test ILO taught only by lecture. | PARTIALLY_ALIGNED or NOT_ALIGNED; teaching weak |
| `af-prog1-conceptual-lecture-ok` | Activity-fit, IT 202 | Positive conceptual control: lecture-discussion and worked examples fit explaining the difference between two conditional constructs. | ALIGNED; teaching sound |
| `as-prog1-good` | Assessment-fit, IT 202 | Correct assessment: write/test a program and submit code, test cases and results. | ALIGNED; measures yes, evidence observable, level matches |
| `as-syseng-essay` | Assessment-fit, IE 402 | Wrong competency: an engineering-history essay does not measure writing verifiable requirements. | NOT_ALIGNED; measures no |
| `as-prog1-recall-quiz` | Assessment-fit, IT 202 | Cognitive level too low: syntax recall does not demonstrate developing and testing a program. | PARTIALLY_ALIGNED or NOT_ALIGNED; measures no or partly, level too_low |
| `as-prog1-too-high` | Assessment-fit, IT 202 | Cognitive level too high: a complete database/UI application exceeds the conceptual ILO and lesson practice. | PARTIALLY_ALIGNED or NOT_ALIGNED; level too_high |

All expectations are synthetic, developer-authored and unreviewed by faculty. Agreement is provisional-label agreement, never faculty-verified academic accuracy. The selected set contains three expected approvals and five cases that must not be approved.

## Two coverage distinctions

**Unsupported recommendations are an output property.** The original dataset has no item whose unseen future draft can be preclassified as unsupported. Review the returned explanations and every draft for the five negative cases, including drafts already withheld by the heuristic module. Do not count a lack of a warning as proof of a safe recommendation. A justified proposal to replace an unsuitable activity is different from an unsupported claim that an activity or resource already exists; any proposed replacement still needs faculty confirmation.

**Missing upstream evidence is not an existing live dataset case.** The dataset explicitly excludes missing/unverified upstream content and ILO decisions from its model items. Every selected source includes course content and an ILO; assessment sources also include learning activities. No thin assessment description is relabeled as missing upstream evidence. Cover this requirement separately through the existing offline regression in `server/lib/syllabuscheck/stage-c.test.js`: `a lesson whose content and ILO have not been verified (Stage B off) gets its Stage C findings but no rewrite, and the report says why`. The result of that regression is an engine-behavior check, not an additional paid relationship or live academic result.

## Academic review rubric

Read each response against its own source/target and course context, separately from structural validation:

1. **Activity and competency:** Does what students actually do practise the ILO's action? Shared topic words are insufficient. Practical development/testing needs a practical experience; explaining a distinction may validly use lecture-discussion and examples.
2. **Assessment and evidence:** Does the task elicit the intended competency and say what observable evidence is marked? Recall of syntax is different from developing/testing code; an essay about another topic is not evidence of writing requirements.
3. **Difficulty:** Is the demand proportionate to the current ILO and stated practice? Identify both too-low recall and excessive implementation scope without assuming every lesson in a laboratory-bearing course must use a practical assessment.
4. **Explanation grounding:** Every claim about an existing activity, participant, resource, week, product or requirement must be supported by this relationship. A literal valid quote does not prove the surrounding reasoning. Compare sibling relationships for possible carry-over and inspect every advisory explanation warning for a false positive.
5. **Recommendation quality:** Does a proposed correction preserve the faculty's subject, ILO, level and instructional intent, make the smallest justified change, and remain feasible? Flag invented laboratories, equipment/software, external participants, fieldwork, budgets, compulsory platforms, institutional policies or new graded obligations. For the sensors lecture-only case, laboratory zero is stated: a recommendation must not silently assert access to a physical lab or specific simulator. For the requirements essay, do not invent live stakeholder interviews or external site visits. For the conceptual Java assessment, do not retain the excessive database/UI project.
6. **Advisory independence:** Compare the stored label/aspects with the raw verified answer. Explanation warnings must decorate the judgment without silently changing it. A withheld draft remains an unverified proposal, and a withholding heuristic may itself be a false positive.

Classify each questionable claim or correction as **supported**, **unsupported**, or **uncertain and needing faculty review**, with the exact phrase and source basis. Do not transform uncertainty into an automatic academic rejection.

## Operational preflight and stopping controls

Before any paid request, retain the working-tree status, verify isolation through the runner's loaded-module checks, run the targeted offline safety/invariant checks, and confirm the printed plan names the selected eight IDs, MiniMax, C1/C2 only, full r7 prompt and disabled trim/minItems. The key-status request must pass inside the counted ledger before model requests; only redacted status fields may be retained. Current endpoint prices must be available before reserving a model request's worst case.

Use the existing request/timeouts, worst-case reservation, reliable-cost reconciliation, provider-error and unresolved-relationship safeguards. Access failures (401/402/403), another model-request 4xx except 429, cap exhaustion, violated price/token bounds, repeated transient/unproductive answers, and an excessive final unresolved rate stop the run. A canary with systematic validation failures, unsupported approvals or serious recommendation issues does not pass the academic review even if its JSON and quotes verify.

The evaluation runner does not load application repositories, routes, database clients or compliance services. It does not write production data or alter official scoring, deductions, the 79 passing mark, readiness, submission gates, title policy or production feature flags. No migration, commit, push, merge, deployment or Phase 3 work is included.

## Ledger continuity for a separately approved continuation

Retain the canary ledger and result as historical evidence. A later approved run of the complete 28-item dataset must keep cumulative usage under **65 HTTP requests and $0.09 total**, including this canary and any repeated items, preflight calls or retries.

Prefer continuing the **same open ledger** with the larger cumulative ceilings only after separate approval. This keeps its existing request/charge counters directly inside the enforced guard limits. If a stopped ledger is closed and a successor ledger is linked, the current guard's `previous` record preserves historical totals but does not by itself add them to the successor's local cap comparison. In that case explicitly subtract all predecessor usage from the new local allowance, or implement and verify cumulative enforcement before running; linking alone is not permission to reset the available budget. Never overwrite, truncate or silently replace the original ledger.

## Recorded results

Saved artifacts: [initial preflight result](ai-eval-stage-e8-c-canary.json), [completed canary result](ai-eval-stage-e8-c-canary-resume.json), [offline review record](ai-eval-stage-e8-c-canary-review.json), and the [same cumulative ledger](ai-eval-stage-e8-c-ledger.json). The first key-status attempt failed at the sandbox network boundary before a response; it remains request 1 in the ledger and incurred no model charge. The resumed invocation used that same ledger. Its key check returned HTTP 200 before prices were fetched or paid model calls began. The completed result records no loaded application data modules and the intended MiniMax/C1/C2/full-r7 configuration, with trimming and `minItems` disabled.

### Structural response validity and provisional agreement

| Measure | Result and unit |
|---|---|
| Planned / attempted relationships | 8 / 8 |
| Verified relationships | 8 of 8, all on their first model answer |
| First-answer validation failures | 0 of 8 relationships; the earlier key-check network failure is operational preflight, not an academic answer failure |
| Recovered relationships | 0; no model retry was needed |
| Final unresolved / never attempted | 0 / 0 |
| Exact quotation verification | 16 of 16: source and target quotes are exact for each verified answer |
| Required structured fields | 20 of 20 assessed; none missing, malformed, unassessed or internally contradicted |
| Provisional-label agreement | 7 of 8 (87.5%) |
| False approvals | 0 of 5 provisionally negative cases |
| False rejections | 1 of 3 provisionally positive cases: `af-prog1-conceptual-lecture-ok` |
| Structural completion | Complete; no systematic response-validation failure |

The stored result uses legacy metric names: `counts.falsePositive` counts rejection of a provisionally aligned case, while `counts.falseNegative` counts approval of a provisionally negative case. The table above uses the user's behavioral terms explicitly. Neither the labels nor agreement are faculty-verified accuracy. Exact quotes and assessed enum fields establish response validity, not correctness of the explanation or educational judgment.

### Manual academic review of all eight responses

| Case | Stored answer and explanation review | Draft review |
|---|---|---|
| `af-prog1-good` | ALIGNED; the described demonstration, pair coding, execution and scaffold support the practical ILO. No definite unsupported explanation claim found. | No draft. |
| `af-prog1-irrelevant` | NOT_ALIGNED; the history activity does not practise conditional programming. Calling its level "far below" Apply is a cognitive inference from an underspecified discussion, not separately verified evidence; the subject/competency mismatch stands. | The replacement is pedagogically plausible for the same ILO and stated laboratory provision, but repeats a sibling's pair/starter-file scaffold wording. The optional starter file is a proposed resource requiring faculty confirmation, not evidence of an existing resource. Withheld by `copies_other_relationship`. |
| `af-prog1-conceptual-lecture-ok` | PARTIALLY_ALIGNED, contrary to the provisional ALIGNED expectation and the prompt's conceptual/practical distinction. **Definite unsupported reasoning:** course-wide laboratory 1 is attributed to "this lesson"; hands-on coding is treated as required for an Explain ILO; the response says there is no demonstration/scaffolding despite explicit worked examples. The first sentence itself acknowledges that the activity develops the conceptual skill. No explanation warning was raised. | **Definitely inappropriate/unnecessary expansion:** adds pair laboratory programming, two implementations and a written note to remedy a conceptual lecture that already fits the stated ILO. No draft warning was raised. Preserve the faculty's conceptual instructional intent. |
| `as-prog1-good` | ALIGNED; source code and test cases/results are observable evidence of the develop-and-test ILO. No definite unsupported explanation claim found. | No draft. |
| `as-syseng-essay` | NOT_ALIGNED; engineering history does not measure writing verifiable requirements for the case. No definite unsupported explanation claim found. | A requirements list, traceability and a statement of verifiability fit the existing scenario, course content and ILO. The individual format and identifiers are proposals for faculty review, not institutional requirements. No external interviews, participants or site visits are invented. |
| `as-prog1-recall-quiz` | NOT_ALIGNED, within the provisional alternatives; the described syntax quiz does not demonstrate developing and testing programs. Calling it "only" Remember-level is a cognitive inference because the actual questions are unseen; multiple-choice format alone does not establish cognitive level. This caution does not erase the competency gap or add to the definite unsupported-claim count. | The programming task is a plausible direct assessment of the same ILO, but copies the sibling positive task including its exam-score scenario. Withheld by `copies_other_relationship`; copying does not by itself prove the educational task is unsound. |
| `as-prog1-too-high` | NOT_ALIGNED, within the provisional alternatives; a complete database/UI application is beyond the conceptual comparison ILO and current practice. "Not feasible within a single lesson" is an educational inference rather than a verified schedule fact. | A short written answer or optional oral comparison tied to the existing worked examples is a plausible minimal correction. The proposed five-minute format needs faculty confirmation; it is not an existing academic policy. |
| `af-sensors-passive` | NOT_ALIGNED, within the provisional alternatives; lecture alone does not give practice designing and testing the amplifier. No definite invented explanation fact found. Collaboration is not established as a mandatory requirement. | **Unconfirmed feasibility/resource concern:** proposes "laboratory testing" and gain measurement although the source states laboratory 0 and establishes no laboratory/equipment access. Laboratory 0 does not prove practical work is impossible; the problem is the unconfirmed arrangement. The pedagogical direction is plausible, but the proposed setting/resources need confirmation. No draft warning was raised. |

### Review counts and advisory limitations

These units are kept separate so a phrase match is not counted as an academically incorrect answer:

- **Explanations:** eight reviewed; one affected explanation has definite unsupported/contradictory reasoning, with the three concerns listed for the conceptual-lecture case. Three further answers contain bounded cognitive/feasibility inferences noted for review; they are not added to the definite-claim count. No model explanation was relabeled or removed.
- **Drafts:** six reviewed, including the unexpected draft for the provisionally positive conceptual-lecture case. One is definitely inappropriate/unnecessary; one unflagged draft has an unconfirmed laboratory-resource assumption; two copied but pedagogically plausible drafts are withheld; two further drafts are plausible corrections requiring normal faculty confirmation. These are six draft-level classifications, not six verified academic errors.
- **Static withholding:** two of six raw drafts carry `copies_other_relationship`, naming `af-prog1-good` or `as-prog1-good` as the sibling. Neither draft is an eligible applicable suggestion under that review rule. Four raw drafts have no review code; absence of a code is not a safety guarantee. The relationship runner records draft review, not a production faculty workflow.
- **Warning false positives:** both of the two flagged drafts really repeat sibling wording: zero confirmed false textual matches out of two warnings. Both could nevertheless be useful pedagogical corrections, so there are **two potential over-withholding concerns** for faculty review. This is not a measured heuristic precision estimate or a claim of zero academic false positives.
- **Missed warnings:** no explanation warning was emitted, and the inappropriate conceptual rewrite and sensors resource concern have no draft warning. Activity/assessment review does not run the values-only added-activity/resource patterns. The module remains advisory and leaves every original label and structured aspect unchanged.

### Requests, tokens, charge and continuation boundary

| Measure | Recorded result |
|---|---:|
| Cumulative counted HTTP attempts | 7 of 15 allowed |
| Completed HTTP responses | 6: one successful key check, one price lookup and four model responses |
| Retained failed preflight attempt | 1 failed key-status network attempt; no model call or charge |
| Model requests / retries | 4 / 0 |
| Prompt tokens / cached prompt tokens | 14,472 / 384 |
| Completion / reasoning tokens | 1,712 / 0 |
| Provider-reported and reconciled charged cost | **$0.00294347** |
| Conservative comparison charge | $0.006396 |
| Canary limits | 15 HTTP attempts / $0.03 |
| Remaining arithmetic ceiling across any later authorized Stage C work | 58 HTTP attempts / $0.08705653, before future key/price requests or retries |

All four paid responses reconciled within their reserved bounds. The retained failed preflight counts toward the total request authorization and transient-error counter. No historical count was reset. The remaining ceiling is accounting information, not approval to spend it.

### Final offline verification

- **103 targeted offline tests passed:** 79 preflight safety/invariant tests and 24 selector/evaluation regressions. These use injected model/transport fixtures and do not add paid calls. The separate missing-upstream regression passed: with Stage B upstream evidence unverified, the engine retains its Stage C finding but withholds the rewrite and explains `upstream_unverified`. This is not a ninth live relationship.
- SHA-256 checks for nine protected files, including `server/.env`, confirm they are unchanged across the canary. Production flags, title policy, official scoring/deductions, passing mark, readiness and submission gates were not changed.
- A secret scan of five evaluation/report artifacts found no API key or authorization-header disclosure. Eight raw model JSON judgments retain their original labels and structured fields exactly in the verified records; advisory metadata does not silently revise an AI judgment.
- The [offline review record](ai-eval-stage-e8-c-canary-review.json) retains the review evidence separately from the original result. The [full-run plan](stage-c-evaluation-plan.md) now points to this same open ledger and a new full-result path; its command is conditional documentation, not authorization. A later all-28 run would repeat the canary eight and consume the retained cumulative allowance.

### Disposition

**Stop after the canary.** Structural response validity is good, but the conceptual-lecture false rejection and its unflagged unnecessary correction are serious academic/recommendation findings. The sensors recommendation also needs resource-feasibility confirmation, and both copied-draft warnings show why heuristic withholding needs faculty review. The current evidence does not support automatically moving to the full dataset. Any follow-up should first review these saved cases offline; prompt, rule, dataset or production changes are outside this canary authorization. No further model call or request for continuation approval is made in this report.
