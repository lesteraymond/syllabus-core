# Real-Claude single-request smoke test: plan (NOT executed)

**Status: prepared only. No request has been sent to Anthropic, no key was read, nothing was spent.** The runner is `scripts/live-claude/live.cjs smoke`; this plan describes exactly what it will do, collect and refuse. Running it needs the written G2 authorization described in `docs/deployment/RUNBOOK.md` section 0 and the phrase printed by `--plan`.

## 1. What the one request is

* **Model:** `claude-sonnet-5-5` only. The guard refuses any other model and stops the run if the answer comes from another.
* **Input:** `docs/checker-comprehensive/live/fixtures/case-e.json`, a **new** fixture: the *course identity* `IT 202 COMPUTER PROGRAMMING 1 (FUNDAMENTALS OF PROGRAMMING)`, BSIT, curriculum 2022-2023, 2 lecture + 1 lab, prerequisite IT 101, year level 2, copied from the approved curriculum reference; **all syllabus text is invented** (description, CLO 1, week 1). No faculty or student data, no real PO or institutional text is in the request (the smoke sends no CLO-PO pair; the institution and POs in the fixture remain fictional).
* **Relationships (one request, 8 relationships):** week 1's seven VPAA relationships (Content-course, Content-ILO, ILO-CLO, Content-activity, ILO-activity, Content-assessment, Activity-assessment) and the classification of CLO 1 (`Introductory`). These are real academic relationships with checkable text: every quotation the model returns is compared with the exact source and target text it was given (`evidence.cjs quoteCheck`), and an invented quotation is reported `NOT FOUND`.
* **Configuration:** the Policy V2 recommendation contract (`lcup-v2-recommendation-2`), CLO classification contract, all advisory stages off, concurrency 1, the staging cost flags `CACHE_WARMUP=on`, `OUTPUT_PLAN=on`, `OUTPUT_FIELDS=scoped`. With a single Policy V2 request these flags change nothing observable (no second request to warm, no Stage C/D fields in a V2 answer, the planned ceiling equals the configured 16,000) and are recorded in the result so the run states what was in effect.
* **Offline rehearsal done:** `smoke --dry-run` against the scripted provider passes all 9 checks and `live-claude.test.js` passes 9/9.

## 2. What it collects (all written to `docs/checker-comprehensive/live/runs/smoke-case-e/`)

`result.json` -> `usage` (provider-reported, and labelled `SCRIPTED DOUBLE CONSTANTS` in a dry run), `SMOKE-REPORT.md`, `provider-ledger.json`:

| Required datum | Where |
|---|---|
| Actual `input_tokens` | `usage.inputTokens` |
| Actual `output_tokens` | `usage.outputTokens` (thinking included; `usage.thinkingTokens` if reported) |
| Cache creation tokens | `usage.cacheCreationInputTokens` (and `cacheCreation1hTokens`) |
| Cache read tokens | `usage.cacheReadInputTokens` (expected 0 on this first request: it writes the cache) |
| Model identifier | `usage.modelRequested`, `usage.modelReturned`, `messageId`, `requestId` |
| Actual request cost from verified usage and pricing | `usage.cost.calculatedAtListPricesUsd`, `calculatedWithGeoUsd`, `calculatedAtBundledReferencePricesUsd`, `chargedByGuardAgainstCapsUsd` (see section 4 for why there are several) |
| Response schema validity | checks 3 and 4 (one judgment per relationship asked, none refused as invalid, all verified) |
| Academic evidence | check 6 and the table in `SMOKE-REPORT.md` (source, target, quoted spans with verbatim status, label, explanation, recommendation) |
| Evaluation status | each relationship's label and verified/unverified; the run's pass/fail |
| Error or truncation behavior | check 8 (`stop_reason == end_turn`, not `max_tokens`, not `refusal`), `usage.truncated`, `usage.stopReason`, `usage.errorType`; check 5 proves a second request is refused **locally** with nothing sent |

The provider's own Console usage page is the check afterwards: compare the request's token counts with `result.json`. The Anthropic invoice, not this file, is the bill.

## 3. Hard limits (enforced before the request leaves the process)

| Limit | Value |
|---|---|
| Requests | **1** (a second is refused locally; check 5) |
| Real spend, worst case of every request in flight counted | **$0.30** (proposed guard; the single request's worst-case reservation is $0.247) |
| Output tokens | at most 20,000 (the request's `max_tokens` is 16,000) |
| Project spend register | $10 total, **$2.92 used, $7.08 remaining**; this run is at most $0.30 of it |
| Timeout / retries | per-question deadline 180 s; `ANTHROPIC_MAX_RETRIES=0`; a timed-out question is never re-sent |
| Stops | any non-200, any refusal, a model other than the guarded one, a service tier or geography the pinned prices do not cover, usage above the request's bound, a charge above its worst case |

The $0.30 guard is a **proposal**, valid only if the model prices in section 4 are confirmed on Anthropic's pricing page by the person authorizing the spend, and only if a provider-side hard limit is set (below). The in-app per-check cap (`SYLLABUS_CHECK_AI_MAX_COST_USD=10`, `..._MAX_REQUESTS=120`) is a *reservation* ceiling and is **not** what bounds this run: the guard is.

## 4. Pricing verification

| Item, claude-sonnet-5-5, per million tokens | Value | Source |
|---|---|---|
| Input | $2.00 | repo table (`anthropicClient.js`, as of 2026-10-27) = bundled Claude API reference (cached 2026-10-06) |
| Output (thinking is output) | $10.00 | same |
| Cache write, 5 min / 1 h | $2.50 (1.25x) / $4.00 (2x) | published multipliers, as implemented in `estimateUsd` |
| Cache read | **$0.10 in the repo table, $0.20 in the bundled reference** | unresolved discrepancy; the guard charges the higher ($0.20 = 0.1x input) |
| Long-context premium | none listed for Sonnet 5.5 (only Haiku 5.5 has one) | bundled reference |
| Regional / data-residency | `inference_geo: "us"` costs 1.1x every token (repo constant); the guard stops the run on any geography other than `global`/`us` | `anthropicClient.js`; not independently re-verified |
| Minimum cacheable prefix | 512 tokens for this model (the system prompt is ~4,600 tokens, so it is cacheable) | bundled prompt-caching reference, "check the prompt caching docs before relying on their values" |

These were checked against the bundled reference, **not** the live pricing page. Before the run the person must confirm them (especially cache read and the regional multiplier) at the Anthropic pricing page. Expect on this first, cold request: cache write ~4.6k tokens at $2.50, uncached input ~4.6k at $2, output ~6.1k (8 x ~758 measured) at $10 -> **~$0.08**, plausible range $0.05 to $0.12.

## 5. Preconditions (the runner refuses to start without each)

1. `--confirm-paid` and `--authorization "I AUTHORIZE LIVE CLAUDE TEST smoke-case-e model=claude-sonnet-5-5 max-requests=1 max-real-spend-usd=0.30"` (exact; printed by `--plan`).
2. `--provider-limit-usd <N>`: the person's statement that the staging workspace has a hard monthly limit of N. Recommended: **N = $5** for the workspace, with alerts at 50 % and 80 %.
3. `--env-file <file>` holding a **staging-only** `ANTHROPIC_API_KEY` of the right form (parsed, never printed, never loaded into the environment); not a stand-in; `ANTHROPIC_MODEL`, if present, must be `claude-sonnet-5-5`.
4. An empty evidence directory (a paid run is never repeated into old evidence).
5. Room in the spend register. Nothing in the run raises a cap.

Procedure (when authorized):
```
node scripts/live-claude/live.cjs smoke --plan
node scripts/live-claude/live.cjs smoke --dry-run
node scripts/live-claude/live.cjs smoke --live --confirm-paid --provider-limit-usd <N> --env-file <staging env> ^
     --authorization "I AUTHORIZE LIVE CLAUDE TEST smoke-case-e model=claude-sonnet-5-5 max-requests=1 max-real-spend-usd=0.30"
```
Any failed check or error: stop, review `SMOKE-REPORT.md`, `provider-ledger.json` and the Console usage page; do not retry blindly.

## 6. What one request does NOT prove

One request with eight relationships proves transport, authentication, the pinned model, schema acceptance (structured outputs), JSON parsing, evidence attribution and error handling, and gives the first real token and cache numbers. It does **not** prove: the other 39 weekly relationships and the other three CLO classifications, the CLO-PO and CLO-EGA contexts, the legacy scored relationships, batching/concurrency behaviour, cache reuse across requests (this request only *writes* the cache), the cache warm-up gate (needs >= 2 requests), `OUTPUT_FIELDS` savings (needs a legacy request with Stage C/D fields), real output length at scale, truncation at higher batch sizes, budget behaviour under a real cap, report storage of a real result, or academic accuracy (that is a human review of the table, not a pass/fail). Each of those needs its own authorization (the Tier-2 `full` runs in `LIVE-TEST-PLAN.md`), and none is implied by a passing smoke test.

## 7. After the run

A reviewer reads `SMOKE-REPORT.md` for academic reasonableness (provisional expectations are in `case-e.json`; a model that disagrees is not necessarily wrong). Record the Console-reported tokens next to `result.json`. Update the spend register (the runner does). Only then decide on Tier 2.
