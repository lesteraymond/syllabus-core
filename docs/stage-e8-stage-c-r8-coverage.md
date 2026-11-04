# Stage E.8: remaining Stage C r8 coverage, stopped at the safety checkpoint

Executed on 2026-10-26. **Four of the 16 approved remaining cases were evaluated; the run stopped before its second model request because an unsupported resource assumption bypassed the draft reviewer.** Twelve cases were never sent. The safety stop prevents completing the requested 28-case exploratory coverage in this authorization. No further model request was made after the checkpoint.

In `af-prog1-single-format`, the proposed activity ends with **"with the notes available"**, although the relationship does not establish syntax notes or other reference material. Neither `draftReview` nor `draftWarnings` contains a code. This fails the approved resource-grounding requirement. It does not establish that notes are unavailable or that faculty could not prepare them. The finding and original model output remain unchanged; the draft is classified as unusable in this evaluation review.

## Retained evidence

- [Final raw remaining-case result](ai-eval-stage-e8-c-r8-remaining.json): original provider response, four verified judgments, configuration, usage and explicit operator stop.
- [Per-case offline review](ai-eval-stage-e8-c-r8-remaining-review.json): all 16 selected cases, including 12 marked `not_attempted`, with decisions, exact quotations, fields, full generated drafts and separate recommendation-quality classifications.
- [Exploratory coverage artifact](ai-eval-stage-e8-c-r8-exploratory-summary.json): all 28 dataset cases, with observed results only for the 16 that have r8 responses.
- [Cumulative ledger](ai-eval-stage-e8-c-ledger.json) and [unchanged pre-run ledger snapshot](ai-eval-stage-e8-c-ledger-before-remaining.json).
- [Prior 12-case r8 report](stage-e8-stage-c-r8-regression.md), [raw responses](ai-eval-stage-e8-c-r8-regression.json) and [review](ai-eval-stage-e8-c-r8-regression-review.json), preserved unchanged.

The remaining result's `.progress.json` is the last pre-stop checkpoint, not an active job. Its final result and recorded stop decision are authoritative. No previous result was overwritten or relabeled.

## Authorization, preflight and isolation

The exact complement of the earlier 12 r8 cases was selected from the unchanged `stage-c-2` dataset: seven Activity-fit and nine Assessment-fit cases, comprising 12 programming, three systems-engineering and one sensors case. One run was planned, using five initial model batches in dataset order. No earlier r8 case was rerun.

The resumed ledger began at **13 HTTP attempts/$0.00583426**. This authorization allowed at most 20 additional attempts/$0.05, enforced as cumulative ceilings of **33 attempts/$0.05583426**. Its original 13 entries, charges and historical transient-error counter were retained. Each authentication, price and model request used the existing request reservation and reconciliation guard. The operator checkpoint ran after the first batch and stopped the process before another request could be sent.

The key check returned HTTP 200, and current endpoint prices were fetched inside the counted ledger. No credential or authorization header was printed or saved. The highest endpoint rates obtained were $0.30 per million input tokens and $1.20 per million output tokens.

The isolated child process used OpenRouter `minimax/minimax-m3.1-flash`, full **`alignment-12c1c2-r8`**, C1/C2 only, temperature zero, strict JSON schema, 8192 maximum output tokens and a 90-second timeout. Prompt trimming and optional `minItems` were off. The run retained stricter first-invalid/unproductive stop limits, the existing transient/provider-error limits, budget checks and between-batch operator review.

Seventy targeted offline tests passed before the paid requests, covering prompt/cache separation, advisory recommendation review, score/gate invariants, case selection, batch checkpoints and provider accounting. Runner syntax and `git diff --check` also passed. The final offline artifact audit verified exact scope, raw-response preservation, quote matches, aggregate arithmetic, cumulative limits and historical ledger entries.

The evaluation loaded no DB, route, repository, compliance-service or DB-driver modules. Forty-five protected-file hashes still match the pre-run snapshot, including production environment settings, scoring/gates, checker/prompt/reviewer/guard/runner code, dataset and retained evaluation evidence. No source code, rule, prompt, provisional expectation, curriculum record, production setting or existing report was changed. D1/D2-only r7 and legacy scoring remain unchanged. No migration, commit, push, merge, deployment, normalized-title activation or Phase 3 work occurred.

## New remaining-case cohort

These are observed results from the first four cases, not a completed 16-case result. The runner correctly records `completion.state=incomplete` and `usableForAgreement=false`; its raw agreement value must not be interpreted using a denominator of 16.

| Measure | Observed result |
|---|---:|
| Planned / attempted / verified | 16 / 4 / 4 |
| Activity-fit / Assessment-fit attempted | 4 / 0 |
| Never attempted after safety stop | 12 |
| First-attempt validation failures / recovered | 0 / 0 |
| Final unresolved attempted relationships | 0 |
| Exact source and target quotations | 8 / 8 |
| Required structured fields assessed | 8 / 8 |
| Missing / malformed / internally contradictory fields | 0 / 0 / 0 |
| Agreement with unchanged provisional labels | 4 / 4 observed |
| False approvals among provisionally negative cases | 0 / 2 |
| False rejections among provisionally positive cases | 0 / 2 |
| Provisional field expectations matched | 6 / 7 |
| Generated / unsupported drafts | 2 / 2 |
| Correctly withheld unsupported drafts | 1 |
| Unsupported drafts bypassing review | 1 |
| Faculty-review-ready proposals / all generated drafts | 0 / 2 (0%) |
| New similarity advisories / confirmed unwarranted hard withholding | 0 / 0 |

All expectations remain developer-authored, provisional and unreviewed by faculty. Software validity and label agreement do not establish academic correctness. Withheld drafts do not count as accepted recommendations. Here, "faculty-review-ready" means a plausible proposal surviving both automatic and manual review, still requiring faculty approval and feasibility confirmation; it does not mean automatically applied or institutionally approved.

### Review of each attempted relationship

| Case | Model decision and provisional comparison | Academic finding and draft review |
|---|---|---|
| `af-prog1-passive` | NOT_ALIGNED; accepted provisional labels include this result. `teaching=weak`, `learnerSupport=limited`. | Listening and copying syntax do not demonstrate the stated develop-and-test competency. The proposed laboratory practice is directionally relevant but assumes laboratory access; course units alone do not verify facilities. `assumes_resource` with evidence `Laboratory` correctly withholds the draft. Annotated samples also require faculty provision. No usable draft remains. |
| `af-prog1-single-format` | PARTIALLY_ALIGNED; provisional label agrees. `learnerSupport=limited` agrees; `teaching=weak` differs from provisional `sound`. | The coding task supports part of the competency and offers limited support. The explanation treats omitted testing detail as "no opportunity" to run/test; that is stronger than the text establishes and needs faculty review. Its correction adds syntax notes and says they are available, without own-lesson support. No warning or withholding code appears. This reviewer bypass triggered the mandatory stop. The finding remains intact; the draft is not counted as usable. |
| `af-prog1-alternatives` | ALIGNED; provisional label and both fields agree (`sound`, `adequate`). | The supplied activity explicitly includes demonstration, laboratory pair programming, recorded demonstration, annotated samples and an individual/pair choice. The positive judgment is supported by its own lesson text. No correction is generated. These stated plans are not independent confirmation of institutional inventory. |
| `af-prog1-week1` | ALIGNED; provisional label and fields agree (`sound`, `not_applicable`). | The orientation activities support describing objectives, requirements and grading. No unnecessary coding or laboratory activity is demanded despite course-wide laboratory units. No correction is generated. |

Both quotes for each relationship match the supplied text, and both required Activity-fit fields are assessed. No schema failure or altered academic label explains the safety stop. The `single-format` field disagreement is an academic-review item, not a structural response error; the dataset was not adjusted to remove it.

The two generated drafts are retained verbatim in the raw result and per-case review:

**`af-prog1-passive` — correctly withheld:**

> - Lecture on Java conditional statements using slides, showing worked examples of if, if-else, nested if and switch.
> - Laboratory practice in which each student writes, runs and tests small Java programs that use if-else and switch to make decisions, with the instructor demonstrating one program first and providing annotated code samples for review.

**`af-prog1-single-format` — unflagged bypass, manually classified unusable:**

> - Individual coding exercise in which students write if-else and switch programs from worked examples and syntax notes, then run and test each program against several inputs and correct any faulty logic; students who prefer not to work under time pressure may complete the same exercise untimed with the notes available.

The current conservative resource reviewer enumerates resources such as laboratories, simulators, starter files and handouts. **Syntax notes are outside that vocabulary**, so the availability assertion above produces no resource finding. No fix was made during this evaluation. The pedagogical choice of supplying notes may be reasonable, but their availability is not established here and the recommendation is not conditional on faculty provision.

No new external participant, unrelated competency or clearly unnecessary practical expansion was identified in the four reviewed outputs. One explanation contains the omission-based overstatement described above; no separate invented facility or participant claim was identified in the explanations. Absence of an automatic warning is not evidence that an explanation or draft is academically sound.

The runner records snippets and review codes rather than executing a faculty approval workflow. The unflagged draft passes recommendation-quality review and could remain eligible if upstream application checks permitted it. It was **not displayed in production, applied to faculty content or stored as a production report**. The laboratory draft's withholding does not change its NOT_ALIGNED finding.

### Cases never attempted

The following 12 are explicitly marked `not_attempted` with null academic decisions and no inferred results in the coverage artifact. They are not false rejections, failed validations or unresolved attempted answers:

- `af-syseng-good`
- `af-syseng-irrelevant`
- `as-prog1-essay`
- `as-prog1-bare-name`
- `as-prog1-keywords`
- `as-prog1-accessible`
- `as-prog1-week1`
- `as-syseng-good`
- `as-sensors-quiz`
- `af-prog1-multiweek`
- `as-prog1-vague-evidence`
- `as-prog1-multiweek`

## Combined exploratory r8 coverage

The prior 12-case cohort and these four new responses cover **16 distinct cases out of 28**, comprising ten Activity-fit and six Assessment-fit cases. Three Activity-fit and nine Assessment-fit cases remain unattempted. The earlier r7 evaluation is excluded from these r8 academic and token totals, while remaining included in the historical ledger.

| Measure | Prior 12-case r8 cohort | New stopped cohort | Combined observed r8 |
|---|---:|---:|---:|
| Attempted / verified | 12 / 12 | 4 / 4 | 16 / 16 |
| Label agreement | 12 / 12 | 4 / 4 | 16 / 16 |
| False approvals / provisionally negative | 0 / 6 | 0 / 2 | 0 / 8 |
| False rejections / provisionally positive | 0 / 6 | 0 / 2 | 0 / 8 |
| Exact quotations | 24 / 24 | 8 / 8 | 32 / 32 |
| Required fields assessed | 30 / 30 | 8 / 8 | 38 / 38 |
| Matched provisional field expectations | 17 / 17 | 6 / 7 | 23 / 24 |
| First-attempt failures / recovered / final unresolved | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| Generated drafts | 6 | 2 | 8 |
| Unsupported generated drafts | 2 | 2 | 4 |
| Correctly withheld unsupported drafts | 2 | 1 | 3 |
| Unsupported reviewer bypasses | 0 | 1 | 1 |
| Faculty-review-ready proposals / generated drafts | 4 / 6 | 0 / 2 | 4 / 8 (50%) |
| Benign similarity advisories, without withholding | 2 | 0 | 2 |

The four remaining plausible proposals are the earlier `as-prog1-recall-quiz`, `as-prog1-too-high`, `as-syseng-essay` and `af-prog1-lab-unused` drafts, subject to the cautions in their retained review. The three withheld resource-dependent drafts are `af-prog1-irrelevant`, `af-sensors-passive` and the new `af-prog1-passive`. Each is counted once even when it has multiple codes.

No definite unwarranted hard withholding was found among the reviewed outputs. The two earlier shared-wording advisories concern useful same-competency recommendations; they neither withhold those drafts nor establish contamination. They should not be interpreted as confirmed academic defects. This small manual review is not an estimate of reviewer precision. The syntax-quiz recall inference from the earlier cohort and the new categorical testing inference remain two explanation cautions requiring faculty review.

**These observations are not a controlled single-run full-dataset benchmark.** They combine separately authorized cohorts with different batch composition and possible provider routing/cache differences, and the second cohort stopped for quality. The twelve unseen cases create substantial coverage and selection limits. Perfect agreement on observed provisional labels cannot be generalized to all 28, faculty accuracy, repeatability or production readiness.

## Requests, tokens and reconciled cost

| Measure | New stopped cohort | All r8 cohorts | Historical Stage C ledger, including r7 |
|---|---:|---:|---:|
| HTTP attempts | 3 | 9 | 16 |
| Key checks / price lookups / model requests | 1 / 1 / 1 | 2 / 2 / 5 | Historical entries preserved |
| New model retries / new provider errors | 0 / 0 | 0 / 0 | One historical transient count retained |
| Prompt tokens | 4,367 | 21,454 | Retained in request entries |
| Cached prompt tokens, included in prompt totals | 128 | 4,224 | Retained in request entries |
| Completion / reasoning tokens | 785 / 0 | 2,773 / 0 | Retained in request entries |
| Provider-reported, reconciled charge | **$0.00085693** | **$0.00374772** | **$0.00669119** |
| Conservative comparison charge | $0.00225210 | Not the reconciled bill | $0.01615980 |

The original 13 requests/$0.00583426 are fully accounted for; the ledger now has 16 requests/$0.00669119. No pending request reservation remained after reconciliation. The new usage stayed below both the additional 20/$0.05 limits and cumulative 33/$0.05583426 ceilings. The stop was caused by recommendation quality, not budget exhaustion. Unspent allowance does not authorize resumption after the safety stop.

## Review status

The observed conceptual lesson remains supported without unnecessary laboratory work, and the practical ILO is still treated as requiring practical opportunities. The model continues to generate unconditional resource assumptions. The existing reviewer catches some but misses the syntax-notes availability assertion; resource vocabulary alone does not guarantee grounding. Feasibility uncertainty must remain separate from the academic alignment finding, and lack of stated testing detail must not automatically establish the absence of testing.

The new artifacts and accounting are complete for the four attempted cases. The 16-case evaluation and full 28-case r8 coverage are incomplete. No prompt, rule, label or result was changed to improve agreement. Work is stopped for review; correcting the reviewer or evaluating the remaining twelve cases requires a separate instruction. No additional paid evaluation is scheduled or running.
