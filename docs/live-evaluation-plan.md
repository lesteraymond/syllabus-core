# Bounded live evaluation plan (prepared in Stage E.2, **not run**)

No paid provider call has been made. Every phase below needs your separate approval before it starts. The estimates are offline measurements (`--plan` modes, no network). Cost is estimated at the blended rate earlier runs were billed at ($0.089 per million tokens, input and output together). That is an estimate, not a quote: the provider-reported cost is recorded on every request, and the runs stop on the limits below.

**Provider and model:** whatever `server/.env` configures. It was last known to be OpenRouter with `minimax/minimax-m3.1-flash`. Confirm it, and that credits are available, before Phase 1. Do not switch providers without approval.

**Prompt:** the full prompt is the baseline. The trimmed prompt (`SYLLABUS_CHECK_PROMPT_TRIM=on`) is only compared in Phase 4 and is not enabled anywhere.

## Phases

| Phase | Command | Requests (minimum - with retries) | Input tokens (est.) | Est. cost | Hard cap |
|---|---|---|---|---|---|
| 1. Smoke: provider, credits, schema | `node scripts/eval-alignment.cjs --dataset stage-d2 --runs 1 --budget 10` | 3 - 14 | about 14k - 43k | under $0.005 | 10 requests |
| 2. Datasets, full prompt (A, B1-B2, B3, B4, C, D1, D2; 2 runs each) | `node scripts/eval-alignment.cjs --dataset <name> --runs 2 --budget 60 --out docs/ai-eval-<name>-e2.json` | 46 - 207 in all | about 274k - 821k | $0.024 - $0.073 | 60 per dataset |
| 3. Whole pipeline, full prompt, every stage on: 3 representative syllabi aligned + 3 with planted errors + 3 real syllabi | `node scripts/live-pipeline-eval.cjs --live --confirm-paid --budget 334 --max-cost 0.50 --out docs/ai-eval-live-pipeline.json` | 167 - 334 | about 1.57M | about $0.14 (up to $0.28 with retries) | 334 requests, $0.50 |
| 4. Trimmed prompt, same items (comparison only) | Phase 2 with `SYLLABUS_CHECK_PROMPT_TRIM=on`; Phase 3 with `--trim` | same counts | about 40-60% of Phases 2-3 | about $0.08 - $0.18 | as above |

**Total if every phase runs:** about $0.25 - $0.55 estimated. Each phase is capped separately, so the worst case is bounded by the caps.

Per check in production with every stage on, using the full prompt, the representative 18-week syllabi need 19-20 requests and about 175k-183k input tokens, about $0.016 each (`docs/stage-e-provider-efficiency.md`).

## Stop conditions

These are enforced by the scripts where marked, and otherwise by the operator.

1. **HTTP 401, 402 or 403** (credits, key, access): the provider circuit breaker stops every further request at once, with no retry (tested). The phase ends. Do not retry until the cause is fixed. *(enforced)*
2. **Request budget reached:** further requests are refused locally. *(enforced: `--budget`)*
3. **Provider-reported cost above the phase cap:** Phase 3 stops before the next syllabus. *(enforced: `--max-cost`; Phase 2: operator checks the printed cost after each dataset)*
4. **Three or more rate limits (HTTP 429), timeouts or server errors** in a phase: stop and wait. *(Phase 3 enforced; Phase 2 operator)*
5. **More than 20% of one syllabus's or dataset's answers fail validation** (quotes not found, schema broken): stop and inspect the prompt or model. *(Phase 3 enforced: `--stop-invalid`; Phase 2 operator, from the printed retry and unverified rates)*
6. **Any contradiction between recommendations** (the same definition as the automated tests, `server/lib/syllabuscheck/eval/contradictions.js`): stop and report. *(Phase 3 enforced)*
7. **Any official score, pass or gate that changes with the advisory stages:** stop. This cannot happen in the offline tests; a live occurrence would be a defect.

## What to record and how to read it (proposed, not institutional thresholds)

- **Planted errors found:** the seven planted errors on each representative syllabus (content, tag, activity, assessment, value named only, supporting value without evidence, unrelated book). Expect all of them to be flagged. Each one missed is a false negative against the synthetic expectation.
- **Flags in untouched parts** of the aligned syllabi: each is either a model false positive or a weakness in the synthetic text. Both need a faculty look.
- **Dataset agreement and the stability of two runs**, compared with the earlier baselines in `docs/ai-eval-*.json`.
- **Retry rate, invalid-answer rate, seconds per syllabus, provider-reported cost.**
- **Full versus trimmed prompt:** agreement on the same items and the quality of the recommendations. The trimmed prompt is recommended only if it is not worse on any stage.

None of these numbers is faculty-verified. The expectations are the assistant's own, and an agreement rate on them is not an accuracy figure for academic approval. That requires the faculty review of `docs/academic-validation-package/`.
