# Hybrid-2 AI Checker: P1 review and P2 preparation (Claude Sonnet 5.5)

**Status: prepared offline on 2026-10-28. P2 has not started.** No paid call was made, `server/.env` was not changed, nothing was committed, and no dataset, faculty-review file or earlier result was modified. Every paid command below needs separate written authorization.

The earlier plan, `docs/anthropic-direct-api-plan.md`, stays unchanged. This document updates its P2 for the two modes you asked for.

## 1. Offline fixes completed

| Area | What changed | Where |
|---|---|---|
| Model identity | Each request keeps the exact model id Anthropic returned (`modelReturned`, redacted, at most 80 characters). It appears in each ledger entry, the ledger head (`modelsReturned`), the guard summary, each result request, the result's top level and the live-pipeline report. A dated snapshot of the evaluated model counts as the same model. Any other model stops the run before anything more is sent, because the pinned prices cover only the evaluated model. The P1 files are not touched. | `anthropicClient.js`, `eval/providerGuard.js`, `scripts/eval-alignment.cjs`, `scripts/live-pipeline-eval.cjs` |
| Thinking tokens | Each request records one of three states: a nonzero count, an explicit zero, or **unavailable**. A missing field is never taken for zero. Totals give `thinkingReports: {nonzero, zero, unavailable}` and count thinking blocks (never their text). Output billing is unchanged, and thinking stays inside output tokens. | `anthropicClient.js` (`usageOf`), `gemini.js` (`usageTotal`), `eval/providerGuard.js` |
| Pricing | The normal estimate now uses the published prices: cache read $0.10 per million, and ×1.1 only when an answer reports `inference_geo: "us"`. The guard keeps its conservative charge (cache read at $0.20, ×1.1 unless "global") and its worst-case reservation, so no limit was weakened. The console and the results show both figures, labelled. | `anthropicClient.js` (`estimateUsd`, `US_ONLY_FACTOR`), `eval/providerGuard.js` (`describeClaudePrices`, `describeClaudeUsage`) |
| P2 measures | A new pure module computes the P2 quality measures (section 5). Each plan and run prints its mode. Each result carries `quality`, and each recorded answer keeps its two Bloom levels. | `eval/qualityMetrics.js` (new), `eval/answerReviews.js`, `scripts/eval-alignment.cjs` |

**Tests.** The full offline suite (`npm test`) passes: 1,433 + 22 + 55 + 12 = 1,522 tests, 0 failures. A network logger was preloaded, and no external connection was attempted. New and updated tests:

- `eval-quality-metrics.test.js` (new): 8 tests.
- `anthropic.test.js`: thinking states and the published-price estimate.
- `anthropic-guard.test.js`: the estimate never exceeds the charge, and the charge never exceeds the worst case, over an 18-case grid. Also tests for model identity and thinking states through the ledger.
- `anthropic-harness.test.js`: model identity and thinking modes end to end, mode and quality lines, and a mode A versus mode B run on the same items.

A file snapshot taken before and after shows only the 13 intended files changed. HEAD, the `server/.env` hash and every protected file are unchanged.

## 2. Corrections to the P1 report

1. **Thinking.** P1's answer explicitly reported `thinking_tokens: 0`. Sonnet 5.5 did not think on that request. It was not a case of missing information.
2. **Cache-read price.** The official price is **$0.10** per million tokens (0.05× input). My P1 report wrongly called $0.20 "the figure in the API reference". That figure came from a reference file I used, not from Anthropic's page. P1 read nothing from the cache, so its charge of $0.019372 is unaffected.

## 3. Token and cost accounting

**Thinking states.** `thinkingTokens` holds a number (including 0) only when Anthropic reports one, and `null` otherwise. `thinkingReports` counts requests by state. Output tokens, which already include thinking, are billed and capped exactly as before.

**Cost figures, side by side:**

| Figure | What it is | Used for |
|---|---|---|
| `estimatedCost` | Published prices: input $2, output $10, 5-minute cache write $2.50, 1-hour write $4, cache read $0.10 per million; ×1.1 only for `inference_geo: "us"` | The normal estimate. It is not a limit. |
| `charged` | The guard's own count: the cache read is charged at no less than 0.1× input ($0.20), ×1.1 unless the answer reports "global" | `--max-cost` and the $10 total cap |
| `worst` | Reserved before each request is sent: every byte of the request body (and its schema once more) counted as an input token at the cache-write rate, plus `max_tokens` at the output rate, ×1.1 | Refusing a request that could pass a cap |

Tests prove `estimatedCost ≤ charged ≤ worst` for every combination of cache, geography and write duration. **On P1:** estimate = charge = $0.019372 (global, no cache reads), the conservative rule $0.02156, and the reservation $0.2143. Anthropic's invoice is what counts.

## 4. Configuration security (read-only inspection)

- **The duplicate.** `server/.env` sets `SYLLABUS_CHECK_AI_PROVIDER` twice: line 23 = `openrouter` and line 27 = `anthropic`. No value other than these two was printed.
- **What the server reads.** The server (dotenv) takes the last value, `anthropic`. Without `SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL`, which is unset, the server's official check reports **configured: false**. The production approval lock holds: a key alone activates nothing.
- **What the evaluation scripts read.** Their own parser takes the first value, `openrouter`. It does not matter for a paid run, which must name `--provider`; a Claude run sets everything in its own local object.
- **Git.** `server/.env` is ignored by the committed `.gitignore`. It has never been tracked or committed and is not staged. `server/.env.example` holds no secret.
- **Recommendation, not applied:** delete line 23 so that both readers agree. The server is unaffected. This needs your separate authorization to edit `server/.env`.

## 5. Legacy versus staged evaluation plan

### The two modes, reported apart

| Mode | What it measures | Prompt | Answer contract |
|---|---|---|---|
| **A. Legacy academic alignment benchmark** | The wording the application uses today | `alignment-10`, no stage on | No recommendation field. A failing CLO-PO, CLO-EGA or ILO-CLO answer must include a rewrite (`missing_draft`). |
| **B. Enhanced staged semantic evaluation** | The staged wording (Stage A, and B3 for ILO-CLO) | `alignment-12a-r7`, `alignment-12a3-r7`, `alignment-123-r7` | A recommendation field. `RETAG_OUTCOME` keeps a sound text and changes only its tag, with an empty draft. |

**How the modes are kept apart:**

- The mode follows the wording a run actually uses (its stage flags). It is printed in the plan and the run, stored in `result.quality.mode`, and added to any held-out log line.
- Each command has its own ledger and result file in `docs/ai-eval-anthropic/`. Nothing is pooled, and no combined accuracy is reported.
- Prompt versions, response validation and the official scoring are unchanged.
- Only development data is used. **The 42-item held-out split is not part of P2**, and no held-out log exists yet.

### The measures (`result.quality`, from `eval/qualityMetrics.js`)

| Measure | Definition |
|---|---|
| Strict agreement | Items with exactly one accepted verdict and not ambiguous: answers giving that verdict |
| Permissive agreement | Answers giving any accepted verdict (equal to the existing `agreement`) |
| False approvals | Clear not-aligned items judged ALIGNED, with item ids on development data |
| False rejections | Clear ALIGNED items judged otherwise, broken down by the label given |
| Insufficient evidence | INSUFFICIENT_EVIDENCE answers, split by whether the item accepts it. The prompt allows it only for a missing or unreadable text. |
| Bloom disagreements | No dataset states a Bloom level, so these use the answer's own levels: (a) an ALIGNED answer that breaks the current wording's level rule (a CLO below its PO/EGA; an ILO above its CLO); (b) level-gap items whose levels do not show the gap; (c) the same statement given different levels in one run; (d) changes between runs; (e) answers refused for an invalid level |
| Unsupported recommendations | A rewrite for a clear-ALIGNED item; a rewrite where a re-tag is expected; a draft the static review held back; refusals of the recommendation contract (`missing_draft`, `retag_with_rewrite` and the others) |
| Mapping remedy | Section 8 |
| Evidence quotation accuracy | Each quote side matched exactly or after whitespace normalization, plus every judgement refused for its quotes across attempts (`quote_not_found`, `quote_wrong_side`, `quotes_swapped`, `quote_from_other_pair`, `quote_missing`) |
| Latency, tokens, cost | Median, p90 and max latency; input, cache and output tokens; thinking count and states; estimated cost; guard charge; estimated cost per verified relationship |

A held-out run, if one is ever authorized, keeps only counts: no ids, statements or drafts.

### Paired comparisons

- **A2 ↔ B2:** the same 58 development items, legacy versus Stage A + B3.
- **A3 ↔ the CLO-PO part of B1:** the same 9 stage-a CLO-PO items, including the 3 `wrong-po-mapping` items.

The comparison is paired by item: both right, only A right, only B right, both wrong. A1 is the eval-1.1 legacy benchmark.

## 6. Expected P2 request count and cost

The plans are offline `--plan` output. In plan mode the adapter builds every first request and nothing is sent; the network logger recorded no connection. The P1-calibrated column uses P1's measured usage (3,728 system tokens, 228.5 output tokens per relationship, no thinking), one cache write per run, and 0 or 1,500 thinking tokens per request. Each command runs twice (`--runs 2`).

| Command | Items | Requests (no retries) | Reserved worst case | Plan estimate | P1-calibrated | `--budget` | `--max-cost` |
|---|---|---|---|---|---|---|---|
| A1 general, legacy | 41 | 10 | $2.18 | $0.21–0.80 | $0.23–0.38 | 25 | $1.00 |
| A2 alignment dev, legacy | 58 | 18 | $3.89 | $0.32–1.30 | $0.32–0.59 | 40 | $1.40 |
| A3 stage-a CLO-PO, legacy | 9 | 6 | $1.29 | $0.08–0.34 | $0.07–0.16 | 15 | $0.55 |
| B1 stage-a, Stage A | 28 | 16 | $3.69 | $0.23–1.02 | $0.19–0.43 | 40 | $1.10 |
| B2 alignment dev, Stage A + B3 | 58 | 34 | $7.81 | $0.44–2.14 | $0.32–0.83 | 75 | $1.90 |
| **Core P2 (A1–A3, B1–B2)** | | **84** | — | $1.28–5.60 | **$1.12–2.38** | 195 | **$5.95** |
| B3 stage-b3, B3 (optional) | 22 | 14 | $3.14 | $0.18–0.84 | $0.15–0.36 | 35 | $0.95 |

**How to read the cost columns:**

- **Reserved worst case** is not spending. The guard holds each request's worst case (about $0.22–0.23) only until the answer settles. A run therefore needs `--max-cost` of at least its spend plus one worst case.
- **Retries come on top.** The budgets allow about 2.2× the requests without retries.
- **Caps are not estimates, and estimates are not limits.**
- **The $10 total.** The spend register holds $0.019372. Core P2 caps of $5.95 would leave about $4.03 of the authorized $10 for P3–P5. The earlier plan's caps for those phases ($4 + $6 + $3) exceed that, so later phases will need lower caps or a separate decision. Expected spending is far below the caps.
- **Against the earlier proposal.** The S1–S8 report proposed $3.00 for a legacy-only P2. Adding mode B (B1 and B2) roughly doubles the requests. The core P2's expected cost ($1.12–2.38) still fits within about $3.50. To spend less, set a lower overall ceiling and re-estimate at the two checkpoints: a run that reaches its cap stops safely and keeps what it completed.
- **Not included:**
  - The MiniMax arm of the earlier plan: OpenRouter stays inactive as you asked, and its earlier results are compared read-only.
  - The Haiku 5.5 arm: only Sonnet 5.5 is approved for evaluation.

## 7. Recommended P2 execution order

Every command has this form:

```text
node scripts/eval-alignment.cjs --provider anthropic --confirm-paid --model claude-sonnet-5-5 --thinking adaptive --effort high --runs 2 \
  <dataset flags> --budget N --max-cost D --ledger docs/ai-eval-anthropic/p2-<id>-ledger.json --out docs/ai-eval-anthropic/p2-<id>-result.json
```

1. **A3** (`--dataset stage-a --types CLO-PO --legacy`), then **B1** (`--dataset stage-a`). This is the smallest pair (22 requests). It exercises both modes and the new quality block, and it answers the re-tag question on the three wrong-PO items first.
   **Checkpoint 1.** Continue only if all of the following hold:
   - every answer came from `claude-sonnet-5-5` or a dated snapshot of it;
   - completion is `complete`;
   - no `refusal` or `max_tokens` stop occurred;
   - the measured cost per request is within twice the calibrated estimate.

   Then re-estimate the remaining commands from the measured tokens, including thinking.
2. **A1** (`--dataset general --legacy`). This is the eval-1.1 legacy benchmark, the closest to the MiniMax `alignment-10` baseline on record (eval-1: 97.5% agreement, false approvals 0 of 66, false rejections 3 of 40).
3. **A2** (`--dataset alignment --split dev --legacy`), then **checkpoint 2**, then **B2** (`--dataset alignment --split dev --stage-a --stage-b3`): the paired 58-item comparison.
4. **B3** (`--dataset stage-b3`), optional: the ILO-CLO re-tag items.

**If a run stops** (a cap, the academic stop, another model, a refusal), do not start the next command until the stop has been reviewed. No command uses `--split heldout`.

## 8. Remap versus rewrite: what was found, and how P2 measures it

**Structural finding.**

- **Mode A cannot recommend removing or changing a CLO–PO mapping.** A failing CLO-PO answer has no recommendation field and must carry a rewrite, or it is refused with `missing_draft`.
- **The application uses mode A today, because Stage A is off.** A failing CLO-PO draft becomes an AI "Suggested alignment revision" of the CLO statement (`engine.js`, around line 313). This happens even when the CLO is sound and only the PO choice is wrong.
- **Mode B adds `RETAG_OUTCOME`.** Its prompt tells the model: "If the CLO is a sound outcome for the course but the PO … named here is not the one it develops … set recommendation to RETAG_OUTCOME and leave the draft empty". Stage A's mapping advice can then point to a better PO from the approved list.

**Evidence so far.**

- **P1 (Claude, mode A), `clo-po-calc-unrelated`.** The calculus CLO "Evaluate limits of rational functions" was mapped to the PO "Communicate effectively with a range of audiences". Claude judged it NOT_ALIGNED, correctly, but the only valid answer was a rewrite: "Communicate the results of limit and derivative analyses of engineering problems clearly to technical and non-technical audiences …". That rewrite turns a mathematics outcome into a communication outcome. Removing or re-tagging the mapping would keep a sound CLO.
- **P1, `clo-po-calc-lower-level`.** "Define the derivative of a function" was rewritten into "Design solutions to engineering problems that meet specified needs …". This raises the CLO from Remember to Create, using the PO's own wording. Faculty should decide whether raising the CLO, or mapping it to a lower-level PO, is right.
- **MiniMax history (read-only).**
  - Under the Stage A wording before the E.4 contract, the sound-but-mis-tagged `cp-bsit-wrongpo` was refused 4 times for `missing_draft`.
  - After the E.4 contract it was answered NOT_ALIGNED with `RETAG_OUTCOME` and an empty draft.
  - On `stage-a`, MiniMax's CLO-PO agreement was 17 of 18 with `alignment-12a`. That figure counts verdicts only, not remedies.

**What P2 measures** (`result.quality.mappingRemedy`):

- On the items where a re-tag is expected (stage-a `cp-bscpe-wrongpo`, `cp-bsit-wrongpo`, `cp-bsie-wrongpo`), whether mode A rewrites and whether mode B re-tags.
- On the **remap candidates**, which are CLO-PO or CLO-EGA development items, clear-negative or wrong-program, whose CLO may be sound:
  - `clo-po-calc-unrelated`, `clo-po-nurs-unrelated`, `d-po-06`, `d-po-12`;
  - `clo-ega-unrelated`, `d-ega-02`, `d-ega-04`, `d-ega-06`.

  These are reported apart and never scored. Some may legitimately need a rewrite (for example, "Recite the multiplication table" is weak in itself), so each needs faculty confirmation.
- Every rewrite of a failing CLO-PO, CLO-EGA or ILO-CLO is counted as "toward the source" when it brings in at least two content words of the PO, EGA or CLO that the rewritten text lacked. This is an English-only heuristic for review, not a verdict.
- On development data, each answer's draft is listed so faculty can read it.

**Proposed for faculty, not applied.** Confirm the remedy for the 8 remap candidates and the 8 level-gap items (remap, rewrite, or either). Until then, the datasets and their provisional expectations stay unchanged.

## 9. Remaining academic validation risks

1. **No faculty validation.** Every expectation is developer-written and unreviewed: the datasets say `reviewStatus: unreviewed`. Agreement is with provisional verdicts, not with faculty.
2. **No Bloom ground truth.** The Bloom measures show internal disagreement and conflicts with the prompt's own rule. They do not show whether a level is correct.
3. **Remedy expectations are thin and partly heuristic.**
   - Only 3 development items (plus 3 in stage-b3) expect a re-tag.
   - The remap candidates come from a category rule and need confirmation.
   - The "toward the source" count can flag a legitimate rewrite, such as raising a level-gap CLO, and can miss a paraphrase.
4. **Small samples.** Two runs, and 1–9 items per category, so differences of one or two answers are within noise. No confidence interval supports a strong claim.
5. **Comparison with MiniMax is indicative only.** Its baselines used other dataset versions (eval-1, not eval-1.1) and other prompt revisions (`alignment-11`/`12a`/`123`, not `-r7`). The development alignment split has no MiniMax result.
6. **Thinking varies.** P1 used no thinking. Adaptive thinking may think on harder batches, which changes cost, latency and possibly answers. P2 records it per request.
7. **Model drift.** A dated snapshot is accepted as the same model, and the id is recorded. A later snapshot could still answer differently.
8. **The held-out split must stay untouched** until the configuration is chosen on development data. It is then used once (P3), with aggregates only.
9. **Production is unchanged.** Claude stays evaluation-only behind the approval lock. Stage A is still off, so faculty would still see CLO rewrites where a re-tag fits. Changing that is a separate decision after P2.
10. **Cost.** Estimates are not limits; Anthropic's invoice is what counts. The Console spend limit for the workspace is still unconfirmed.

## 10. Not done (by instruction)

- No paid Anthropic call, and P2 not started.
- No change to `server/.env`.
- No commit, push, merge, deploy or migration.
- No change to official scoring or submission gates, prompt versions or validation.
- No change to datasets, provisional expectations, faculty-review files, MiniMax results or P1 files.
