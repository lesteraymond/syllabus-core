# Stage E.8: six-case resource regression, stopped at the first model answer

> **Update (2026-10-26, 10:31 UTC):** the controlled recovery has run and completed; see the [recovery report](stage-e8-resource-recovery.md). **Correction to option A below:** the ledger carries `invalid` 1 and `unproductive` 1 from request 19. So `--max-invalid 2 --max-unproductive 2` would have stopped at the first empty answer again and refused its retry. The offline proof shows this (`tmp/stage-e8-resource-recovery-dryrun.log`, scenario A). The smallest safe setting, used by the recovery, is `--max-invalid 3 --max-unproductive 3 --warn-invalid 2`.

Executed once on 2026-10-26 (09:49 UTC). **The run stopped automatically after its first model request: the OpenRouter endpoint returned an empty judgements list (`{"judgements":[]}`), and the prescribed first-invalid-answer limit stopped the run.** No judgment, quotation or draft was returned, so none of the six academic verification objectives could be assessed live. The stop was enforced locally: the batch retry was refused without an HTTP request, and batches 2 and 3 were never sent. Unspent allowance does not authorize a rerun.

## Evidence

- [Raw result](ai-eval-stage-e8-c-resource-regression.json): configuration, the model's raw reply, refusal reasons, usage, key-check status and stop reason.
- [Cumulative ledger](ai-eval-stage-e8-c-ledger.json), with its [byte snapshot taken before the run](ai-eval-stage-e8-c-ledger-before-resource-regression.json).
- Logs: `tmp/stage-e8-resource-regression-run.log` (run console), `-plan.log` (free plan), `-preflight-full-test.log` (offline suite), `-preservation.json` (165 pre-run SHA-256 hashes).
- The plan this run executed: [resource-grounding fix report](stage-e8-resource-grounding-fix.md), "Limitations and proposed targeted live regression".

## Authorization and preflight

The user authorized only this planned regression, subject to preflight. The authorized cases were `af-prog1-single-format`, `af-prog1-passive`, `af-prog1-alternatives`, `af-prog1-conceptual-lecture-ok`, `af-sensors-passive` and `as-prog1-recall-quiz`, in one run of three initial batches, with at most 8 additional HTTP requests and $0.03 additional cost. The ledger was reused unchanged with cumulative ceilings of **24 requests/$0.03669119**. The full r8 prompt was kept, and trimming, optional `minItems` and label changes were excluded.

| Preflight check | Result |
|---|---|
| Authorization unconsumed | Ledger at 16 requests/$0.00669119, last entry n=16 (08:41:58 UTC, the stopped remaining-case run); no output or progress file for this regression |
| Offline suite, network blocked | 1,296 main + 22 localization + 55 UI + 12 PDF-import UI = **1,385 passed**, 0 failed or skipped |
| Localization audits | 2,213 bilingual keys, 1,164 interface references, no hardcoded strings; verdict panel 0/55 sentences untranslated |
| Free plan (no HTTP) | Byte-identical after decoding to the plan prepared with the fix: 6 items, 3 batches, `alignment-12c1c2-r8`, C1/C2 only, trim and `minItems` off, 90-second timeout |
| Configuration (no HTTP, no key shown) | OpenRouter `minimax/minimax-m3.1-flash`, batch size 4; key present, read by the runner from `server/.env` |
| Changes since the last paid run | 42 of the 45 hashes recorded before the remaining-case run are unchanged, including `server/.env`, the dataset, the guard, the runner, `stages.js`, policy and compliance. The changed files are `gemini.js`, `engine.js` and `recommendationReview.js`, which the fix report lists. |
| Preservation baseline | 165 SHA-256 hashes: all checker, compliance and scoring code, `server/.env`, the dataset, the runner, all `docs/ai-eval-*.json` results and E.8 reports |
| In-run checks (counted) | Key check HTTP 200 (accepted; expires 2026-11-25). Prices: highest of 12 endpoints $0.30/M input, $1.20/M output, $0 per request (the historical rates). No database, route or repository module loaded. |

The command was the planned one with `--confirm-paid --check-key` added:

```text
node scripts/eval-alignment.cjs --confirm-paid --check-key --dataset stage-c --runs 1
  --ids af-prog1-single-format,af-prog1-passive,af-prog1-alternatives,af-prog1-conceptual-lecture-ok,af-sensors-passive,as-prog1-recall-quiz
  --budget 24 --max-cost 0.03669119 --accounting reconcile --max-transient 3 --max-invalid 1 --max-unproductive 1 --warn-invalid 1
  --max-unresolved 0.2 --min-sample 4 --ledger docs/ai-eval-stage-e8-c-ledger.json --out docs/ai-eval-stage-e8-c-resource-regression.json --review-between-batches
```

Its child-process environment set OpenRouter and `minimax/minimax-m3.1-flash`, stages A, B, B3, B4, D1 and D2 off, C1 and C2 on, trim off, variant `current`, `minItems` off and a 90-second timeout. `server/.env` and the shell environment were not changed. An evaluation-only driver forwarded operator decisions to the batch checkpoint from a file; no checkpoint was reached.

## What happened

| Request | Content |
|---|---|
| 17 | Key check, HTTP 200 |
| 18 | Price lookup, HTTP 200 |
| 19 | Batch 1 (`af-prog1-passive`, `af-prog1-single-format`, `af-prog1-alternatives`, `as-prog1-recall-quiz`). Served by the endpoint **ModelRun**: HTTP 200 in 1,076 ms, `finish_reason: stop`, reply `{"judgements":[]}`. 4,387 prompt tokens (128 cached), 6 completion tokens, 0 reasoning tokens. Reported cost $0.00064437, reconciled; $0.0013233 at the highest listed rates; worst-case reservation $0.0165453. |

All four relationships were refused as `empty_answer` ("not answered: the judgements list is empty"). With `--max-invalid 1` (and `--max-unproductive 1`), the guard stopped. The staged retry of batch 1 was refused locally ("not sent"), with no HTTP request. Batch 2 (`af-prog1-conceptual-lecture-ok`) and batch 3 (`af-sensors-passive`) were never attempted. The operator checkpoint follows a batch only when the run is not stopped, so none was reached.

### Interpretation

This is a provider-level non-answer, not an academic, quotation, prompt or reviewer failure. No judgment, quotation or draft exists to be wrong.

- The nine earlier E.8 Stage C model requests were all served by other endpoints (Wafer 2, InferenceNet 4, Nebius 2, Together 1), and none of them returned an empty list.
- Requests use a strict `json_schema` with `require_parameters: true`, so OpenRouter routes only to endpoints that declare structured-output support. With `minItems` off, `{"judgements":[]}` is the shortest output the schema allows; Stage E.6 added the optional `minItems` for this case.
- Empty lists also occurred in E.4, E.5 and the E.7 D1 run. In E.7 D1 one retry recovered all four relationships. In E.5 a corrective retry recovered three of four; the fourth then failed a quotation case check. Here the strict first-invalid limit allowed no retry.
- The reported charge is about half the charge at the highest listed rates, consistent with a lower-priced endpoint. OpenRouter's default routing favours lower prices, so a rerun may reach this endpoint again. This is one observation, not a measured failure rate for the endpoint.

## Results requested for the completion report

| Measure | Result |
|---|---:|
| Cases planned / attempted / verified | 6 / 4 / 0 |
| Never attempted | 2 (`af-prog1-conceptual-lecture-ok`, `af-sensors-passive`) |
| Provisional-label agreement | Not measurable (0 answers) |
| Exact quotations | None returned |
| Generated / unsupported drafts | 0 / 0 |
| Correctly withheld recommendations | 0 |
| Reviewer bypasses | 0 (no draft existed to review) |
| Possible false-positive withholding | 0 (no draft existed) |
| Faculty-usable recommendations | 0 |
| HTTP requests: key check / price lookup / model | 3: 1 / 1 / 1 |
| Model retries sent / refused locally | 0 / 1 |
| New transient errors | 0 |
| Tokens | 4,387 prompt (128 cached), 6 completion, 0 reasoning |
| Cost, reported and reconciled | **$0.00064437** (conservative comparison $0.0013233) |
| Cumulative ledger | **19 requests/$0.00733556** of 24/$0.03669119 (conservative $0.0174831) |
| Unused allowance | 5 requests/$0.02935563, not an authorization to resume |

**Academic judgment accuracy and recommendation quality are both unmeasured by this run.** The table below separates that from the offline evidence that already existed. The replay is a software-safeguard result on saved r8 responses; it is not new model evidence.

| Verification objective | Live result | Offline status, from the resource replay |
|---|---|---|
| 1. `af-prog1-single-format` notes assumption does not reach faculty | Not assessed | The saved notes draft is now withheld (`assumes_resource`: "syntax notes", "the notes") |
| 2. Unsupported laboratory, simulator and handout claims detected | Not assessed | `af-prog1-passive` (laboratory) and `af-sensors-passive` (simulator, handout) remain withheld |
| 3. Legitimate faculty-created resources not withheld | Not assessed | "Annotated code samples" that the instructor proposes providing is advisory `proposed_resource`, not withheld |
| 4. Conditional resource recommendations | Not assessed | Offline regressions only; no live conditional draft has been returned in any Stage C run |
| 5. Shared terminology does not cause withholding | Not assessed | `as-prog1-recall-quiz` keeps advisory `borrowed_wording` only |
| 6. Judgments independent of draft-review warnings | Not assessed | 16/16 saved judgments, fields and quotations preserved |

## Preservation and integrity

- The ledger's 16 historical entries are identical to the byte snapshot. Entries 17–19 were appended, and the totals reconcile ($0.00669119 + $0.00064437 = $0.00733556). The ledger stays open.
- The ledger now carries `transient` 1, `invalid` 1 and `unproductive` 1. A later run on this ledger with `--max-invalid 1` would still stop at its first invalid answer.
- All 165 protected hashes are unchanged after the run.
- No key, 12-character key fragment or key label appears in the result, the ledgers or the logs.
- The 56 modified tracked files are the same as before the run. New files: the result, the ledger snapshot, this report and the `tmp/stage-e8-resource-regression-*` logs. The only edit to an existing file is the execution notice at the top of the fix report.
- No migration, `server/.env` change, score, deduction, pass-mark, readiness, gate or title-policy change, Phase 3 work, commit, push, merge or deployment occurred. The twelve unseen Stage C cases remain unattempted.

## Decision needed (nothing scheduled)

*Superseded: the recovery ran with corrected thresholds (3/3, not the 2/2 in option A); see the update at the top.*

| Option | What changes | Assessment |
|---|---|---|
| **A. Rerun with one retry for an invalid answer (recommended)** | Same six cases, prompt, schema and limits, except `--max-invalid 2 --max-unproductive 2`. Needs a new allowance, e.g. 8 more requests/$0.03 (cumulative 27/$0.03733556). | Keeps r8 byte-identical, with no code change. An empty list is always refused, so it cannot become a verdict or a draft, and a retry recovered empty lists before. |
| B. Rerun unchanged | First invalid answer still stops. | May hit the same endpoint again. The remaining 5 requests fit only the key check, the price lookup and three batches, with no retry. |
| C. Enable E.6 `minItems` | Schema asks for at least one judgement; prompt version becomes `alignment-12c1c2-r8-mi1`. | You excluded it for this run; provider compatibility has never been measured live. |
| D. Evaluation-only provider exclusion | Code change to the request's provider options. | Needs approval and offline tests first, and departs from production routing. |

The six live verification objectives therefore remain open. The provisional labels remain developer-authored and unreviewed by faculty. The `af-prog1-single-format` teaching-field disagreement and the explanation overstatement remain academic-review items. The reviewer remains a conservative English heuristic.
