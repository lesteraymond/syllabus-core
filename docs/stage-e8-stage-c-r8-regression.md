# Stage E.8: targeted Stage C r8 regression canary

Status: executed once on 2026-10-26 and **stopped for academic review**. All 12 relationships passed software validation and matched their unchanged provisional labels. The conceptual-lecture failure was not reproduced. The model's resource-feasibility failure persisted in the sensors draft, and the reviewer correctly flagged that draft for withholding. No complete 28-item evaluation, extra canary, or Phase 3 work followed.

## Evidence and authorization

- [Raw r8 result](ai-eval-stage-e8-c-r8-regression.json), including original model responses, structured fields, review codes, usage and four operator checkpoint decisions.
- [Independent offline artifact audit and academic review](ai-eval-stage-e8-c-r8-regression-review.json).
- [Existing cumulative ledger](ai-eval-stage-e8-c-ledger.json) and its [byte-preserving pre-r8 snapshot](ai-eval-stage-e8-c-ledger-before-r8.json).
- [Earlier r7 canary](ai-eval-stage-e8-c-canary-resume.json) and [its academic review](stage-e8-stage-c-canary.md), retained unchanged.
- The `.progress.json` beside the r8 result is the last pre-stop checkpoint, not an active job; the final result and its stop decision are authoritative.

The user authorized one run of 12 unchanged `stage-c-2` development cases, at most 15 additional HTTP attempts/$0.03, with cumulative ceilings of 22 attempts/$0.03294347. The existing ledger was open, reconciled and resumable at seven attempts/$0.00294347. It was reused without resetting any count. The first seven ledger entries still exactly match the retained snapshot.

## Preflight and controls

The working tree and both preparation documents were inspected. Seventy targeted offline tests passed before paid requests: recommendation safeguards, prompt/cache separation, score/gate invariants, exact case selection, provider guard and the new batch-review checkpoint. Syntax and whitespace checks also passed. Twenty-seven runner/evaluation regression tests passed afterwards; these overlap some preflight coverage and are not a second model evaluation.

The live configuration was OpenRouter `minimax/minimax-m3.1-flash`, full `alignment-12c1c2-r8`, C1/C2 only, temperature zero, strict JSON schema, 8192 output-token ceiling and 90-second timeout. Trimming and optional `minItems` were disabled. D1/D2-only prompts remain r7; the all-off legacy prompt and scoring remain unchanged. The key check returned HTTP 200 before current prices were obtained or any model request was sent. Key labels/credentials were not printed or retained.

All HTTP went through the existing reservation/reconciliation guard, with redirects refused to avoid hidden HTTP hops. The command retained the existing transient-error count of one and cumulative budget. In addition to the prepared controls, this run used stricter `--max-invalid 1 --max-unproductive 1 --warn-invalid 1`: the first response-validation failure would stop further paid requests. No such failure occurred.

An evaluation-only `--review-between-batches` checkpoint was added and tested before the run. Each batch paused after its response, before another request. The first three reviews explicitly continued; the fourth stopped because the sensors draft still assumed resources. No model request followed that decision. No production checker rule, prompt, dataset expectation or application gate was changed during the evaluation.

## Software validity and provisional-label results

| Measure | r8 result |
|---|---:|
| Planned / attempted / verified relationships | 12 / 12 / 12 |
| Activity-fit / Assessment-fit | 6 / 6 |
| First-attempt validation failures / recovered relationships | 0 / 0 |
| Final unresolved / never attempted | 0 / 0 |
| Exact source and target quotations | 24 / 24 |
| Required structured fields assessed | 30 / 30 |
| Missing / malformed / internally contradictory fields | 0 / 0 / 0 |
| Compared provisional field expectations | 17 / 17 agree |
| Agreement with unchanged provisional labels | 12 / 12 (100%) |
| False approvals among provisionally negative cases | 0 / 6 |
| False rejections among provisionally positive cases | 0 / 6 |
| Raw judgments compared / labels or aspects changed by review | 12 / 0 |

The runner reports structural completion `complete` and usable label-agreement denominators because all planned relationships verified before the operator stop. This is **not an academic continuation approval**. Its top-level `stopped` reason records the persistent resource problem. Developer-authored labels are unreviewed proposals, not faculty-verified accuracy. A verified quote or enum does not establish the surrounding academic reasoning.

## Academic review of every case

| Case | Judgment | Explanation and recommendation review |
|---|---|---|
| `af-prog1-good` | ALIGNED | Demonstration followed by students writing/running programs supports the practical ILO. No draft or definite invented explanation fact found. |
| `af-prog1-irrelevant` | NOT_ALIGNED | Computer history does not practise the stated programming competency. The correction is directionally relevant but unconditionally adds a laboratory and a starter file, borrowing the positive sibling's arrangement. Both resource assumptions are unestablished for this lesson; draft withheld. |
| `as-prog1-good` | ALIGNED | Source code and test cases/results directly evidence development/testing. No draft or definite unsupported explanation found. |
| `as-prog1-recall-quiz` | NOT_ALIGNED | The task does not establish development/testing performance. Calling unseen syntax questions “only” recall remains an inference caution. The copied same-ILO programming assessment is a plausible correction; `borrowed_wording` is advisory and does not withhold it. |
| `as-prog1-conceptual-ok` | ALIGNED | Written comparison/examples fit explanation at the stated conceptual level. No practical assessment is demanded. |
| `af-prog1-conceptual-lecture-ok` | ALIGNED | Worked examples and discussion now count as support for the explanation ILO. No coding/laboratory rewrite is proposed; the known r7 false rejection is not reproduced. |
| `af-prog1-lab-unused` | PARTIALLY_ALIGNED | The explicit write-and-test ILO still needs learner practice. Its own target names an unused laboratory period. The proposed guided loop-programming/testing activity addresses the stated performance without adding named specialist tools or external participants. Feasibility remains for faculty confirmation. |
| `as-prog1-too-high` | NOT_ALIGNED | A complete database/UI application exceeds the conceptual comparison ILO. The short comparison task is a plausible minimal correction; similarity to the positive conceptual assessment is advisory, not withholding. The earlier unsupported single-lesson feasibility assertion is absent. |
| `as-syseng-essay` | NOT_ALIGNED | Engineering history does not measure writing verifiable requirements. The requirements/acceptance-criterion/traceability correction stays within the supplied workshop case; no real stakeholder interview or external participant is invented. |
| `af-sensors-good` | ALIGNED | The lesson itself states simulator use and design/gain comparison. The practical ILO remains supported despite course-wide laboratory zero. No new availability claim is needed. |
| `af-sensors-passive` | NOT_ALIGNED | The need for design-and-test practice remains supported, but the draft unconditionally prescribes a circuit simulator and states that a handout is provided. These details come from `af-sensors-good`, not this lecture-only lesson. `assumes_resource` and `copies_other_relationship` flag the draft for withholding. **This prior resource-feasibility failure persists in the model output.** |
| `as-sensors-good` | ALIGNED | Gain measurement/comparison supplies observable evidence in the stated practical/simulation context. No new draft or definite invented explanation fact found. The supplied lesson text is not external verification of facilities. |

### Recommendation and warning counts

- Twelve explanations were read. No definite invented factual explanation was identified in this review. The syntax-quiz statement about “only” recall is one separately recorded inference caution; unseen questions do not prove an exact cognitive level.
- Six drafts were returned. Two have unsupported, unqualified resource assumptions (`af-prog1-irrelevant`, `af-sensors-passive`); four are otherwise plausible corrections for faculty confirmation. No unnecessary conceptual-to-practical expansion remains in the conceptual control.
- Two drafts carry withholding codes. `assumes_resource` and `copies_other_relationship` each affect those same two answers; this is not four withheld drafts. Evidence names four resources across them: laboratory, starter file, circuit simulator and handout.
- Two other drafts carry advisory `borrowed_wording` only (`as-prog1-recall-quiz`, `as-prog1-too-high`). Both are useful same-competency formulations; neither is withheld solely for similarity. No false textual match or definite unwarranted hard withholding was found among the four flagged answers. This small manual review does not estimate heuristic precision or academic accuracy.
- No conditional-resource draft was returned. The model therefore did not demonstrate live compliance with the conditional-resource instruction. Conditional handling passed offline regressions, but that does not substitute for model compliance.
- The isolated snippet runner records review codes, not a faculty approval workflow. Existing application policy withholds these coded drafts if otherwise eligible; no draft was applied, no production report was stored, and upstream gating was not bypassed.

## Comparison with r7 on the eight overlapping cases

| Case | r7 label | r8 label | Relevant change |
|---|---|---|---|
| `af-prog1-good` | ALIGNED | ALIGNED | Practical positive retained. |
| `af-prog1-irrelevant` | NOT_ALIGNED | NOT_ALIGNED | Resource-dependent copied correction still occurs; now independently checked for resource assumptions. |
| `as-prog1-good` | ALIGNED | ALIGNED | Correct assessment retained. |
| `as-prog1-recall-quiz` | NOT_ALIGNED | NOT_ALIGNED | Legitimate copied correction is now advisory-only rather than withheld solely for wording. |
| `af-prog1-conceptual-lecture-ok` | PARTIALLY_ALIGNED | ALIGNED | False rejection removed; unnecessary laboratory draft gone. |
| `as-prog1-too-high` | NOT_ALIGNED | NOT_ALIGNED | Minimal conceptual correction; new same-ILO similarity caution does not block it. |
| `as-syseng-essay` | NOT_ALIGNED | NOT_ALIGNED | Competency mismatch retained; scenario-based correction remains plausible. |
| `af-sensors-passive` | NOT_ALIGNED | NOT_ALIGNED | Unconfirmed physical laboratory assumption changes to unconfirmed simulator/handout assumptions. The reviewer catches the imported details; the model-level feasibility failure remains. |

Overlapping provisional-label agreement changes from **7/8 to 8/8**; false approvals remain **0/5**, and false rejections change from **1/3 to 0/3**. Quotes are exact in both versions (16/16 for the common eight). Both runs had zero model-response validation failures, retries or unresolved relationships. These are observed comparisons, not proof that the prompt alone caused them: cohort/batch composition, routing and caching also differ, and there is only one run per version.

## Requests, tokens and provider cost

| Measure | r8 increment | Cumulative Stage C ledger |
|---|---:|---:|
| Counted HTTP attempts | 6 | 13 |
| Key checks / price lookups / model requests | 1 / 1 / 4 | Historical entries retained |
| Model retries / new provider errors | 0 / 0 | Historical transient count remains 1 |
| Provider-reported and reconciled charged cost | **$0.00289079** | **$0.00583426** |
| Conservative comparison charge | $0.00751170 | $0.01390770 |
| Approved caps | 15 / $0.03 | 22 / $0.03294347 |

R8 used **17,087 prompt tokens**, including **4,096 cached**, **1,988 completion tokens** and **zero reasoning tokens**. All four paid responses reconciled within their reservations. The key and price requests billed no model charge but count toward the HTTP cap. No historical count or charge was reset. The original blocked key-status attempt remains in the prior seven entries. The r7 four-model-request bill was $0.00294347 for eight cases; pricing/cache/routing and cohort differences prevent a controlled efficiency conclusion.

The overall 65-attempt/$0.09 envelope is not permission to run anything else. This one-canary authorization ended with the operator stop; unused headroom does not authorize another canary or the remaining dataset.

## Preservation and disposition

Eighteen protected source/configuration/baseline hashes match their preflight values, including `.env`, scoring policy, the grading standard, curriculum/title and gate code, Stage C prompt/review code, the unchanged Stage C dataset and previous evaluation results. The seven historical ledger entries exactly match the retained snapshot. Four saved artifacts passed credential/credential-fragment scans. Loaded database/route/repository/service modules were empty. No migrations, production writes, official score/deduction/pass-mark/readiness/gate changes, normalized title activation, commits, pushes, merges or deployments occurred.

Supporting changes were limited to the evaluation-only batch checkpoint (`eval/batchReview.js`, `stage-e8-batch-review.test.js`, and the optional runner flag), the ledger snapshot/appended entries, new r8 result/progress/review/report artifacts, and the plan's execution-status notice. Existing uncommitted work was retained.

**Stop for review.** The conceptual objective improved and the draft safeguard worked, but the resource-feasibility objective is not satisfied at the model-output level. The complete 28-item evaluation has not started. No further provider call, automatic continuation or request to approve the full evaluation is included.
