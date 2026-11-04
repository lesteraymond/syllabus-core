# Direct Anthropic Claude API: integration and evaluation plan

Hybrid-2 AI Checker. Prepared 2026-10-27.

**Status: plan only, awaiting approval.** No paid request was made, no configuration was changed, nothing was committed, and no historical evaluation file was touched. This file is the only change to the repository.

**Tags used below**

| Tag | Meaning |
|---|---|
| **[V]** | Verified in this repository (file:line), read-only |
| **[M]** | Measured offline in this session, with the network blocked |
| **[D]** | Verified in Anthropic's official documentation on 2026-10-27 (sources in Appendix A) |
| **[E]** | Estimate. The assumptions are stated next to it |
| **[P]** | Proposal, not implemented |

The numbered sections 1–12 are the twelve deliverables, in the order the request lists them.

---

## 0. Summary

- **Candidate model:** `claude-sonnet-5-5` with adaptive thinking at effort `high`, structured outputs and `max_tokens` 16,000. It is evaluated beside MiniMax M3.1 Flash, never instead of it.
- **Existing work:** an offline Anthropic adapter was built earlier today. It is in the working tree, uncommitted and not live. This plan hardens it; it does not redesign the checking service.
- **Conflicts:** two current conflicts with "disabled in production until approved" must be resolved first (section 0.1).
- **Cost:** the paid evaluation is estimated at about $4–11 for the Claude arm, optional phases included, under hard caps that add up to $20. The paired MiniMax runs come to under $0.50 in total.
- **Approval:** every stage before the first paid request is offline and can be tested on its own. Each paid phase needs its own written authorization.

### 0.1 Two conflicts to resolve first

**1. `server/.env` selects Anthropic today [V].**
- It sets `SYLLABUS_CHECK_AI_PROVIDER=anthropic` and `ANTHROPIC_MODEL=claude-sonnet-4-6`.
- Its `ANTHROPIC_API_KEY` value is not in Anthropic's key format (it lacks the `sk-ant-` prefix). So `providerConfig` reports the provider as not configured (`anthropicClient.js:26`, `gemini.js:24`).
- With the file as it is, the application makes no AI check at all:
  - every check returns `not_evaluated` (`gemini.js:729`);
  - that means an `AI-REQUIRED` finding, no score and `ready: false` (`engine.js:429, 437, 453`);
  - MiniMax is not used.
- Submission is still possible only because the gate is advisory (`policy.js:19-21`; `SYLLABUS_CHECK_AI_GATE` is not set).
- A valid key plus a backend restart would immediately make every check and every AI rewrite a paid Claude request.
- **Recommendation:** set `SYLLABUS_CHECK_AI_PROVIDER=openrouter` again and clear the Anthropic key line. I have not changed the file, because the request forbids changes to production configuration.

**2. Claude verdicts would count officially if Anthropic were selected [V].**
- `verifiedAlignment` (`gemini.js:32-34`) accepts `provider: 'anthropic'` with any `claude-*` model.
- `requireHybrid` relies on it for the gate in required mode (`compliance/service.js:46`).
- This widening came with the offline adapter.
- **[P]** Stage S1 puts it behind an explicit approval switch that is off by default. That restores the gate to how it behaved before the adapter.

---

## 1. Architecture assessment

### 1.1 Request path [V]

| Step | Where | What it does |
|---|---|---|
| Re-Check API | `server/routes/compliance.js:118` (`POST /syllabi/:id/compliance/recheck`) | Starts a check |
| Shared checking service | `server/lib/compliance/service.js:24` `checkHybrid` → `engine.run` (`:30`), with this syllabus's earlier verdicts for reuse | Runs the 47 coded rules, then the AI |
| AI alignment | `server/lib/syllabuscheck/gemini.js:726` `align` | Builds the pairs, batches them, asks the provider and verifies every answer |
| Saved report | `service.js:79` `storeRun` → `ai_check_runs` (provider and model saved at `:90`), `ai_check_area_scores`, `ai_findings` | The report the UI shows |
| Submission gate | `service.js:34` `requireHybrid` | Advisory by default (`:42`). Required mode needs a fresh verified run (`:46`) |
| Builder and Admin UI | Reads saved runs (`compliance.js:104`) | No provider names appear in `src/`, so the UI is provider-neutral |
| AI rewrite (refine) | `server/routes/syllabusCheck.js:87` → `modelClient.js` `askJson` | Uses the same provider choice |
| Status | `syllabusCheck.js:17-18` | Reports the provider, the model and whether it is configured |

### 1.2 The ten areas named in the request

**1. The OpenRouter integration [V]**
- `requestOpenRouter` (`gemini.js:473-509`) sends a chat completion with `temperature: 0`, `max_tokens: 8192`, a strict `json_schema` (`:489`), and `provider.require_parameters` for paid models (`:492`).
- The model named in the reply must match (`:505`), and `finish_reason` must be `stop` (`:507`).
- No `reasoning` parameter is sent for MiniMax (`:490` sets one only for two free models), so MiniMax runs with its provider's default.
- Paid models time out after 90 s (`:551`).

**2. Provider-specific dependencies [V]**
- In `gemini.js`:
  - `providerConfig` (`:21-28`), `supportedRouterModel` (`:20`), `verifiedAlignment` (`:32-34`);
  - `minItemsOn`, which applies to OpenRouter only (`:78`);
  - `promptVersionOf` (`:538-541`);
  - `pairKey`, which includes the provider and the model (`:555-557`).
- `scripts/eval-alignment.cjs`:
  - `:99` picks only OpenRouter or Gemini;
  - `:159` refuses a paid run unless the provider is OpenRouter;
  - `:258-269` checks the OpenRouter key and looks up OpenRouter prices.
- `eval/providerGuard.js` accepts OpenRouter addresses only (`:31-32, :128`). It reads prices from OpenRouter (`:199-211`) and reconciles against the cost OpenRouter reports (`:47, :168`).
- `live-smoke-eval.cjs` and `live-pipeline-eval.cjs`: paid mode means OpenRouter.
- `eval/phase3/oracle.js` is an offline OpenRouter mock.
- The UI has no provider-specific code.

**3. AI request construction [V]**
- The system prompt is `systemPromptOf` (`:561`).
- The user message is `userMessageOf`, which gives `{course, document_data, corrections?}` (`:454-457`).
- The schema is `alignmentSchema` (`:66-75`).
- `requestAnthropic` (`:513-523`) sends exactly these three. `anthropic.test.js` checks that they match the OpenRouter request.

**4. Prompt-generation architecture [V]**
- `PROMPT` (`:79-103`) is combined with the stage texts (`stages.js`) and the wording variants (`variants.js`).
- With every stage off, the version is `alignment-10`, which is the production prompt [M, from the evaluation planner].

**5. Structured response validation [V]**
- `verifyAnswer` (`:434`) calls `validate`, `salvage` and `rejections` (`:385-433`), and `checkOne` (`:298`).
- It checks that each id appears exactly once, the label is in the enum, the Bloom levels are valid, and the drafts and recommendations are acceptable.
- Refusal codes fall into four classes: contract, evidence, coverage and output (`:222, :611-615`).

**6. Evidence quotation verification [V]**
- `evidenceQuote` (`:187`), `quoteOrigin` (`:239`) and `quoteProblems` (`:245`) apply.
- A quote must be an exact substring of its own side of the pair. A quote from the wrong side, from another pair, or not found at all is refused.
- The check runs after the transport, so it is the same for every provider.

**7. Recommendation safeguards [V]**
- The prompt forbids approving or scoring (`:79`) and says drafts are proposals that need human acceptance (`:102`).
- Explanations and drafts are reviewed (`answerReview.js`, `recommendationReview.js`, `draftReviewOf` at `:286`).
- The engine withholds drafts in several cases (`engine.js:307-309`).
- Each user's decision on a suggestion is recorded (`syllabusCheck.js:66-78`).

**8. Provider timeout handling [V]**
- `timeoutOf` gives 90 s for paid models and 240 s for free ones; `SYLLABUS_CHECK_AI_TIMEOUT_SEC` accepts 10–900 (`:551`).
- Up to 2 batches that time out or hit a server error become "not checked", and the rest carry on (`:794-801`).
- After an HTTP 401, 402 or 403, a breaker sends nothing for 300 s (`:565-569, :804`).
- Failures are classified by `classifyFailure` (`:715-725`).
- The Anthropic adapter has its own deadline (180 s by default) and never retries a request that timed out (`anthropicClient.js:91`).

**9. Token usage and cost accounting [V]**
- Production OpenRouter checks record no usage.
- Anthropic checks add `result.usage` (`gemini.js:527-535, :840-841`), with an estimate from list prices (`anthropicClient.js:30-41`).
- Evaluations keep `providerGuard.js` ledgers: request count, dollars charged and worst-case reservations.

**10. Evaluation datasets and historical result storage [V, M]**
- There are 11 datasets in `server/lib/syllabuscheck/eval/` (table in section 9). All are marked `reviewStatus: unreviewed`.
- Results and ledgers are kept in 56 `docs/ai-eval-*` files.
- `docs/ai-eval-heldout-log.jsonl` does not exist. Every held-out run appends to it, so no held-out run is on record.
- The DRAFT Phase 3 faculty records are in `docs/faculty-review/phase3/`.

### 1.3 What this plan keeps unchanged [V]

| Invariant | Where it lives |
|---|---|
| The 47 coded rules | `server/lib/compliance/standard-v4.json`, `rules` (47 entries) |
| Passing mark 79 | `standard-v4.json:50` `passThreshold`; `engine.js:459` |
| Deductions: NOT_ALIGNED 3, PARTIALLY_ALIGNED 1, scored types only | `policy.js:6`; `engine.js:301-305` |
| Six scored types: CLO-PO, CLO-EGA, ILO-CLO, ILO-activity, ILO-assessment, Module-value | `eval/phase3/score.js:16-23`, consistent with `policy.js:10` and `gemini.js:113-114` |
| A check completes only when every scored relationship is verified | `gemini.js:834-835` |
| AI unavailable means `AI-REQUIRED`, no score, not ready | `engine.js:429, 437, 453, 458` |
| Gate advisory by default; required mode needs a verified, fresh run | `policy.js:19-21`; `service.js:42-46` |
| Verdicts are never reused across providers or models | `gemini.js:555-557` |
| Evaluations never change process.env or server/.env, and never load data modules | `eval-alignment.cjs:29-30, :83-96, :255-256` |

Bilingual functionality and the faculty and administrator workflows live in `src/`, which the provider never reaches [V]. They stay unaffected as long as the provider choice stays on the server.

### 1.4 The offline adapter built earlier today [V]

**Files**
- New: `anthropicClient.js` (105 lines) and `anthropic.test.js` (19 tests).
- Changed: `gemini.js`, `modelClient.js`, `server/scripts/syllabus-check.cjs`, `server/.env.example`, and `server/package.json` with its lockfile (`@anthropic-ai/sdk` ^1.3.0).
- The checker folder is untracked in git, so `git diff` does not show these changes.

**Behaviour**
- It is selected only by name. It counts as configured only with an `sk-ant-` key and a `claude-*` model.
- The base URL is fixed to `https://api.anthropic.com`. The SDK's own retries, logging and tracing are off.
- No temperature is sent; the API has rejected it since version 2026-10-21 [D]. No thinking parameter is sent, so each model runs its default.
- The system prompt is cached (`cache_control: ephemeral`). Structured outputs go through `output_config.format`.
- Retries and deadline:
  - the deadline is 180 s, and a request that timed out is never sent again;
  - up to 2 retries for 429, 500, 502, 503, 504, 529 and dropped connections, within that deadline.
- Any `stop_reason` other than `end_turn` gives an unverified `incomplete_output`. A reply from a different model is refused. Errors are redacted and clipped.
- Usage is recorded per request and per check, with a list-price estimate dated 2026-10-06.
- 1,453 tests passed after it was built [M, earlier today].

**Gaps against today's documentation**

| Gap | Evidence |
|---|---|
| Thinking is implicit and not recorded: Sonnet 5.5, Haiku 5.5 and Opus 5.5 think by default; Sonnet 4.6 does not | [D] thinking table; `anthropicClient.js:18-19` |
| Thinking tokens, latency and request id are not recorded for each request | `anthropicClient.js:45-48, 98-102` |
| The Sonnet 5.5 cache-read price is listed as $0.20 per million tokens; the current price is $0.10 | `anthropicClient.js:33`; [D] pricing |
| Haiku 5.5 has no price entry | `anthropicClient.js:28-35` |
| A spend limit you set returns HTTP 400 (`invalid_request_error`, "You have reached your specified … API usage limits"). It is classified `provider_rejected` and starts no cooldown | [D] rate limits; `gemini.js:722` |
| The tier's monthly cap returns 429 with `error.details.error_code: enforced_spend_limit_reached` and no `retry-after`. It is retried twice for nothing | [D]; `anthropicClient.js:15, 93-95` |
| HTTP 504 (`timeout_error`) is retried, although the documentation does not say whether it is billed | `anthropicClient.js:15`; [D] errors |
| A refusal (`stop_reason: refusal` with `stop_details.category`) and a `max_tokens` stop both show only as `incomplete_output` | `anthropicClient.js:101`; [D] |
| `verifiedAlignment` accepts Claude verdicts | `gemini.js:33` |
| The reuse fingerprint does not include the thinking mode or the effort | `gemini.js:555-557` |
| The SDK range `^1.3.0` allows minor upgrades | `server/package.json` |
| The SDK reads `ANTHROPIC_CUSTOM_HEADERS` from the environment (seen in the SDK 1.3.0 source earlier today) | — |

---

## 2. Proposed adapter [P]

The adapter changes only how a question travels and what is recorded about it. The prompt, the schema and the verification stay shared and unchanged.

**Request.** Only the thinking and effort lines differ from today's request:

```json
{
  "model": "claude-sonnet-5-5",
  "max_tokens": 16000,
  "thinking": { "type": "adaptive" },
  "output_config": { "effort": "high", "format": { "type": "json_schema", "schema": "<alignmentSchema(...)>" } },
  "system": [{ "type": "text", "text": "<systemPromptOf(...)>", "cache_control": { "type": "ephemeral" } }],
  "messages": [{ "role": "user", "content": "<userMessageOf(...)>" }]
}
```

The request carries no `temperature`, `top_p`, `top_k`, `stream`, tools, server-side fallbacks or beta headers.

**Normalised result**

```text
anthropicMessage(question, options) -> {
  text,                      // text blocks only; thinking blocks are skipped (their text is empty by default) and never stored
  stopReason, stopCategory,  // end_turn | max_tokens | refusal, and stop_details.category for a refusal
  model, requestId, latencyMs,
  usage: { attempts, inputTokens, outputTokens, thinkingTokens, cacheCreationInputTokens,
           cacheReadInputTokens, estimatedUsd, priceAsOf, timedOut }
}
```

- `text` goes to the unchanged `verifyAnswer` (`gemini.js:434`).
- Errors keep today's messages and gain a `kind`:
  - `provider_timeout`;
  - `provider_quota` (a rate limit);
  - `provider_budget` (a spend limit; this kind is new);
  - `provider_access` (401, 402 or 403);
  - `provider_error` (500, 529 or a dropped connection);
  - `provider_rejected` (any other 4xx).
- Refusals and `max_tokens` stops keep the existing code `incomplete_output`, so the retry policy does not change. `stopReason` and `stopCategory` are added for the report only.

**Settings**

| Setting | Values | Default | Notes |
|---|---|---|---|
| `ANTHROPIC_THINKING` | `adaptive`, `off` | `adaptive` | `off` becomes `between_tools` on Sonnet 5.5, and `disabled` on Haiku 5.5, Sonnet 5, Opus 5 and Sonnet 4.6 [D]. Opus 5.5 and Fable 5.1 cannot turn thinking off, so with `off` they count as not configured rather than sending a request that returns 400 |
| `ANTHROPIC_EFFORT` | `low` to `max` | The model's default, sent explicitly | `xhigh` and `max` are refused locally when thinking is off, because the API would return 400 [D] |
| `ANTHROPIC_TIMEOUT_SEC`, `ANTHROPIC_MAX_RETRIES`, `ANTHROPIC_MAX_TOKENS`, `ANTHROPIC_PROMPT_CACHE` | — | As today | Existing settings |

For Anthropic, the model, thinking mode and effort join the reuse fingerprint. A verdict made under one configuration is never reused under another.

---

## 3. Recommended model

### Recommendation

**`claude-sonnet-5-5`.** The exact ID appears in the models overview, the pricing page, the structured-outputs model list and the deprecations table [D]. It is a pinned snapshot ID, so there is no dated variant to choose between.

**Configuration:** adaptive thinking (the model's default) at effort `high` (also its default). Both are sent explicitly so every result records them. Structured outputs, and `max_tokens` 16,000.

### Comparison [D]

| Model and ID | Input / output per million tokens | Cache read | Thinking | Default effort | Relative latency | Retirement not before | Role in the plan |
|---|---|---|---|---|---|---|---|
| Sonnet 5.5 `claude-sonnet-5-5` | $2 / $10 | $0.10 | Adaptive by default; `between_tools` turns up-front thinking off | high | fast | 2027-09-28 | **Recommended** |
| Haiku 5.5 `claude-haiku-5-5` | $0.10 / $0.50 (prompts up to 100K tokens) | $0.01 | Adaptive by default; `disabled` allowed at effort `high` or below | medium | fastest | 2027-10-07 | Optional low-cost arm |
| Opus 5.5 `claude-opus-5-5` | $4 / $20 | $0.20 | Always on | medium | moderate | 2027-09-22 | Escalation test only |
| Fable 5.1 `claude-fable-5-1` | $10 / $50 | $0.25 | Always on | high | slower | 2027-09-01 | Not justified |
| Sonnet 4.6 `claude-sonnet-4-6` (named in server/.env today) | $3 / $15 | $0.30 | Off unless requested | high | — | 2027-02-17 | Superseded |
| Haiku 4.5 `claude-haiku-4-5-20251001` | $1 / $5 | $0.10 | Off; no effort setting | — | — | Not before 2026-10-15 (that date has passed) | No |

Fable 5.1, Opus 5.5, Sonnet 5.5 and Haiku 5.5 all have a 1M-token context and a 128K maximum output [D]. Our requests are about 2,600–4,900 tokens (characters / 4) [M], so context size never matters here.

### Why Sonnet 5.5

- **Quality.**
  - The task is rule application: three tests per pair type, exact quotes, and rewrites that must pass the same tests.
  - Anthropic's Sonnet 5.5 guidance says that for JSON answers to tasks that apply a rule, adaptive thinking is more accurate than answering without thinking.
  - It also says that at `high` effort a structured-output answer almost never runs into `max_tokens`, while at `low` or `medium` it occasionally does [D].
  - That is guidance, not a measurement on our task. The evaluation measures it.
  - The same guidance suggests adding "Think the problem through before you answer." to the system prompt. This plan does not add it, because the prompt must stay identical for both models and the academic prompt stays unchanged.
- **Cost.**
  - A production check of 100 relationships is estimated at $0.24–0.51 (section 4).
  - Per token it costs half as much as Opus 5.5 and a fifth of Fable 5.1.
  - Sonnet 4.6, the model in server/.env today, costs more per token and is older.
- **Latency.** Anthropic lists Sonnet as fast, Opus as moderate and Fable as slower [D].
- **Support horizon.** It will not be retired before 2027-09-28. Anthropic names it as the replacement for its retired Sonnet models [D].

### Why not the more expensive models

- Opus 5.5 and Fable 5.1 always think, cost 2–5 times as much and are slower.
- Nothing measured so far shows that this task needs more than a Sonnet.
- They become a targeted test only if Sonnet 5.5 shows reasoning failures.

### Why Haiku 5.5 is worth one cheap test

It is 20 times cheaper than Sonnet 5.5 and the fastest. It may be enough for some relationship types. An optional arm on the development data tests that for about $0.35, reported separately.

---

## 4. Pricing and estimated evaluation costs

### List prices per million tokens [D]

| Model | Input | 5-minute cache write | Cache read | Output | Batch input / output |
|---|---|---|---|---|---|
| Sonnet 5.5 | $2 | $2.50 | $0.10 | $10 | $1 / $5 |
| Haiku 5.5 (prompts up to 100K tokens) | $0.10 | $0.125 | $0.01 | $0.50 | $0.05 / $0.25 |
| Opus 5.5 | $4 | $5 | $0.20 | $20 | $2 / $10 |
| Fable 5.1 | $10 | $12.50 | $0.25 | $50 | $5 / $25 |
| Sonnet 4.6 | $3 | $3.75 | $0.30 | $15 | $1.50 / $7.50 |

- Thinking tokens are billed as output tokens and count toward `max_tokens`. `usage.output_tokens_details.thinking_tokens` reports them [D].
- Claude 4.7 and later models, which include every 5.x model, produce about 30% more tokens than Sonnet 4.6 for the same text [D].
- Anthropic publishes no price endpoint, so the evaluation pins these prices with their date and prints them for confirmation. The Console usage page is the check afterwards.

### What was measured [M]

- **Production prompt** (`alignment-10`, 12 relationships per request): about 2,600–2,700 input tokens per request by characters / 4, from the evaluation planner on the `general` and `alignment` datasets.
- **Staged prompts** (4 relationships per request): about 4,000–4,900 by the same measure. MiniMax's recorded prompt tokens, 3,500–4,570 per request, agree.
- **The sample syllabus** (100 relationships): 9 requests (8 of 12 and 1 of 4). The system prompt is 9,049 characters; the user messages total 23,934 characters.
- **MiniMax output, as recorded:**
  - 290–830 output tokens per staged request of 4;
  - median latency 0.7–2.3 s, slowest 5.1 s, timeouts excluded;
  - source: `docs/ai-eval-stage-e7-*`, `-e8-c-*` and `-e9-*`.

### Assumptions behind the estimates [E]

- Tokens are characters / 4 × 1.3 on the 5.x models.
- Structured outputs add up to about 600 input tokens per request. Anthropic says it adds a system prompt but does not give its size.
- 150–200 output tokens per relationship.
- 500–3,000 thinking tokens per request.
- In production, the first three requests run at the same time and each writes the cache; the rest read it.

### Estimated cost of one production check (100 relationships, 9 requests) [E]

| Model | Input | Output (text and thinking) | Total |
|---|---|---|---|
| Sonnet 5.5, adaptive thinking, effort high | $0.044 | $0.20–0.47 | **$0.24–0.51** |
| Sonnet 5.5 with thinking off (for reference) | $0.044 | $0.15–0.20 | $0.19–0.24 |
| Haiku 5.5, adaptive thinking | $0.002 | $0.010–0.024 | $0.012–0.026 |
| Opus 5.5 (always thinks) | $0.089 | $0.39–0.94 | $0.48–1.03 |
| Fable 5.1 | $0.216 | $0.98–2.35 | $1.19–2.57 |
| Sonnet 4.6 (no thinking) | $0.055 | $0.17–0.23 | $0.23–0.29 |
| MiniMax M3.1 Flash (extrapolated from recorded staged requests) | — | — | About $0.01–0.02 |

### Estimated cost of the evaluation, Claude arm [E]

This assumes Sonnet 5.5 with adaptive thinking at effort high, at about $0.025–0.056 per production-prompt request.

| Phase | Requests (base, then with retries) | Expected | Hard cap |
|---|---|---|---|
| P1 smoke test: one batch; confirms the schema is accepted, the usage fields and the cache | 1–3 | Under $0.20 | $0.50 |
| P2 calibration (E1, development data, 2 runs) | 28, then 42–126 | About $1–3 | $6 |
| P3 held-out confirmation (E2, 2 runs, once) | 16, then 24–72 | About $0.6–2 | $4 |
| P4 shadow scoring (E3, 6 synthetic syllabi, production settings) | About 54, then about 81 | About $2–4 | $6 |
| P5 reliability probe (E4, D1 follow-up; optional) | 16, then 24–72 | About $0.4–1.5 | $3 |
| Optional Haiku 5.5 arm on E1 | 28, then 42–126 | Under $0.35 | $0.50 |
| **Claude total** | | **About $4–11** | **$20** |
| MiniMax paired runs (same phases) | | Under $0.50 | Caps per run |

- On Sonnet 5.5 the worst case for one request is about $0.20: 16,000 output tokens plus its input at the cache-write price. The guard reserves that amount before the request is sent.
- After P1, the estimates are redone from measured tokens before P2 is requested.
- The Batch API halves every price [D] but returns results within 24 hours. It is therefore kept for later repeat-stability runs, not for measuring latency or timeouts.

### Spending safeguard in the Anthropic Console [D, P]

Create a dedicated workspace for the evaluation with its own key and a monthly spend limit of $25.
- A limit you set returns HTTP 400 and stops further requests.
- The Default Workspace cannot have a spend limit.
- Archiving the workspace later archives its keys.

---

## 5. Structured JSON compatibility

### The current schema [V]

`alignmentSchema` (`gemini.js:66-75`) returns:

```text
{ judgements: [ { id, label, explanation, sourceQuote, targetQuote, sourceBloom, targetBloom, draft,
                  (+ recommendation and stage fields when those stages are on) } ] }
```

- Every property is required.
- Every object has `additionalProperties: false`.
- The label, the recommendation and the stage fields are string enums.
- `minItems: 1` is optional and sent to OpenRouter only.

### Checked against Anthropic's limits [D]

| Anthropic rule | Our schema | Result |
|---|---|---|
| `additionalProperties` must be `false` | Set on every object | Compatible |
| At most 24 optional and 16 union-typed parameters per request | None optional, no unions | Compatible |
| `enum` values must be strings, numbers, booleans or null | String enums only | Compatible |
| `minItems` only 0 or 1 | Not sent to Anthropic | Compatible. It stays off for comparability with MiniMax |
| No `minLength`, `maxLength` or numeric limits | None used; the server checks draft length | Compatible |
| Property order is kept, with required properties first | All properties required, so the order is kept and the explanation-first variant still works | Compatible |
| Enum capitalisation is not guaranteed | Labels are upper-case words joined by underscores. Some stage enums contain spaces, for example `Missionary Spirit` | The strict check stays. Case-only mismatches are counted separately [P]. Any normalisation needs your approval |
| A refusal returns HTTP 200, is billed, and may not match the schema | — | Stays unverified and is counted by category [P] |
| A `max_tokens` stop may leave the JSON incomplete | — | Stays unverified, as Anthropic advises treating it as failed |
| A property that asks for reasoning may cause a `reasoning_extraction` refusal; Anthropic advises asking for a short explanation instead | `explanation` asks for the gaps found, not step-by-step reasoning | Low risk; counted |
| A schema's first use compiles a grammar (cached for 24 hours); compilation times out after 180 s; a schema that is too complex returns 400 | The largest schema is every stage on, with 22 fields per relationship | Confirmed in P1 (a 400 is not billed). First-request latency is reported apart |
| Changing `output_config.format` invalidates the prompt cache | One schema per check | No effect within a check |

**No schema change is proposed.** The normalising step works only on the response envelope (section 2). `verifyAnswer` and its evidence checks are not changed, relaxed or bypassed.

---

## 6. Files requiring modification [P]

| File | Change | Stage |
|---|---|---|
| `server/lib/syllabuscheck/gemini.js` | **Production lock** in `providerConfig` and `verifiedAlignment`: an approval switch, off by default. **Failure handling:** `classifyFailure` reads `error.kind`, so `provider_budget` is never retried and starts the cooldown. **Reuse:** the Anthropic configuration joins the reuse fingerprint. **Diagnostics:** `requestAnthropic` passes the new fields through | S1, S2 |
| `server/lib/syllabuscheck/anthropicClient.js` | **Settings:** thinking and effort, mapped per model. **Errors:** spend-limit detection; 504 is not retried. **Diagnostics:** refusal and `max_tokens` stops, thinking tokens, request id, latency. **Prices:** table dated 2026-10-27 (Sonnet 5.5 cache read $0.10; both Haiku 5.5 tiers) | S2 |
| `server/lib/syllabuscheck/modelClient.js` | No change expected, because it reads `providerConfig`. Tests confirm that the lock also covers AI rewrites | S1 |
| `server/lib/syllabuscheck/eval/providerGuard.js` | **An Anthropic mode.** Only `https://api.anthropic.com/v1/messages` is allowed. **Worst case:** the body bytes plus an allowance, at the cache-write price, plus `max_tokens` at the output price. **Prices:** pinned and printed for confirmation. **Reconciliation:** from the usage tokens. Budget errors stop the run at once | S6 |
| `scripts/eval-alignment.cjs` | **New flags:** `--provider anthropic --model --thinking --effort`, never taken from the provider line in server/.env. **Safety:** refuses an existing `--out` file. **Recording:** latency, thinking tokens and stop reasons per request; the held-out log entry records the provider and configuration | S7 |
| `scripts/live-pipeline-eval.cjs` | `--legacy` (every stage off, the production settings) and `--provider anthropic`. Keeps each syllabus's engine result for the scoring comparison | S7 |
| New `scripts/report-provider-drift.cjs` | Offline. Compares two result files with `comparePairedOfficial` (`eval/phase3/score.js:106`) | S7 |
| New `server/lib/syllabuscheck/eval/anthropicReplay.js` | An offline Anthropic transport that replays recorded or scripted answers, as `oracle.js` does for OpenRouter | S4 |
| Tests: `anthropic.test.js`, plus `eval/eval.test.js` or a new `eval/anthropicGuard.test.js` | See section 11 | Every stage |
| `server/.env.example` | Documents the approval switch and the thinking setting | S1, S2 |
| `server/package.json` and its lockfile | Pin `@anthropic-ai/sdk` to exactly `1.3.0` | S2 |

**Not modified:**
- `engine.js`, `policy.js`, `standard-v4.json` and `compliance/service.js`;
- the routes, and everything in `src/` (UI and i18n);
- the datasets, `docs/ai-eval-*` and `docs/faculty-review/*`;
- the database schema.

---

## 7. Architecture risks

| # | Risk | Mitigation |
|---|---|---|
| A1 | Activation by configuration alone: a valid key plus a restart makes every check and rewrite a paid Claude request whose verdicts count | The approval switch (S1). You restore the provider line. The key is kept for the evaluation only |
| A2 | Claude takes no temperature, so answers vary between runs. Code comments assume "at temperature 0 the same question gets the same answer" (`gemini.js:220-221, 604`) | 2 runs in every phase, and repeatability reported. The retry policy stays identical so the comparison is fair |
| A3 | Thinking adds an unknown number of output tokens and some latency. With a 180 s deadline and 3 requests at a time, a check could take minutes | Effort `high`, `max_tokens` 16,000, thinking tokens recorded, cost caps. Latency is measured before any production decision |
| A4 | A request that timed out may still be billed | Never retried; charged at its worst case in the ledger |
| A5 | New organisations may start in a lower rate tier ("Evaluation tier") | Evaluation requests are sequential. A 429 gets bounded waits |
| A6 | Spend-limit replies are misclassified today | `provider_budget` (S2) |
| A7 | The first concurrent requests of a check each write the cache | Included in the estimates |
| A8 | A schema's first use is slower while its grammar compiles | The first request is reported apart |
| A9 | Safety classifiers may refuse, for example `cyber` on a security course | Counted by `stop_details.category`; never reported as verified |
| A10 | An SDK upgrade could change behaviour | Exact version pin |
| A11 | Syllabus text would go to a new data processor | Repository and synthetic datasets first. Real syllabi only with your approval |
| A12 | Exposure of the API key | The key stays only in server/.env (ignored by git, `.gitignore:8`) or in the evaluation process. Never in a `VITE_` variable. The adapter and the guard redact it |
| A13 | Saved reports could mix providers | The lock (S1). `ai_check_runs` records the provider and model (`service.js:90`) |
| A14 | The comparison has limits: no faculty-approved labels, and few items for three of the scored types | Results are labelled "against developer-written expectations, not faculty-verified", as `score.js:14` does. Small types are reported as counts, not percentages |

---

## 8. Scoring-drift risks

### How a verdict becomes a score [V]

- On the six scored types only, NOT_ALIGNED deducts 3 points and PARTIALLY_ALIGNED deducts 1.
- An unverified scored relationship leaves the check incomplete, so it gets no score.
- The pass mark is 79.

### Where drift would come from if Claude ever replaced MiniMax

1. **Label distribution.** A stricter or more lenient model moves points. The prompt says "When in doubt between ALIGNED and PARTIALLY_ALIGNED, choose PARTIALLY_ALIGNED" (`gemini.js:100`), and models apply such a rule differently.
2. **Completion rate.** More or fewer unverified answers mean more or fewer checks without a score.
3. **Reuse reset.** Verdicts are reused only for the same provider and model (`gemini.js:555-557`). The first check after a switch asks everything again, so an unchanged syllabus could change its score.
4. **The second look on re-check.** It compares with earlier verdicts (`gemini.js:818-830`), and after a switch those came from another model.
5. **Re-tag advice that costs no points.** `SEM-TAG` (`score.js:100`) depends on patterns in the verdicts.
6. **Drafts and recommendations.** They carry no points, but they change what faculty are told to edit.

### How to evaluate Claude without touching official scoring [P]

- Every Claude request happens in an evaluation process:
  - it uses a local copy of the environment;
  - it refuses to run if data modules are loaded;
  - the global `fetch` is blocked so every request goes through the guard.
- Nothing is written to `ai_check_runs`.
- **Shadow scoring.**
  - The same synthetic syllabi go through `engine.run` twice under production settings, once with each model.
  - `comparePairedOfficial` then reports, for each syllabus, one of: no scoring drift, advisory-only changes, score-only drift, pass/fail-changing drift, or submission-gate differences (`score.js:48-54`).
  - It also lists every scored relationship that differs.
- **Noise floor.** Each model runs twice, so a difference between the models can be told apart from run-to-run variation.
- **No automatic substitution.**
  - There is no fallback from MiniMax to Claude or back.
  - Production stays on MiniMax until a separate approval after academic validation.

---

## 9. Recommended initial evaluation dataset

### Available datasets [M]

All of them are marked `unreviewed`: the expectations are written by the developer, not approved by faculty.

| File | Version | Items | Relationship types | Split |
|---|---|---|---|---|
| `dataset.json` (general) | eval-1.1 | 41 | CLO-PO 10, CLO-EGA 2, CLO-anyPO 2, ILO-CLO 4, ILO-activity 4, ILO-assessment 5, ILO-content 4, Module-value 3, Description-plan 4, REF-plan 3 | none |
| `alignment-dataset.json` | align-1 | 100 | CLO-PO 39, CLO-EGA 18, ILO-CLO 33, CLO-anyPO 6, CLO-anyEGA 4 | 58 development, 42 held-out |
| `stage-a-dataset.json` | stage-a-2 | 28 | Course-CLO 14, CLO-set 5, CLO-PO 9 | development |
| `stage-b-dataset.json` | stage-b-1 | 36 | Content-course 16, Content-ILO 13, Plan-sequence 7 | development |
| `stage-b3-dataset.json` | stage-b3-1 | 22 | ILO-CLO 14, ILO-anyCLO 8 | development |
| `stage-b4-dataset.json` | stage-b4-1 | 15 | CLO-coverage 15 | development |
| `stage-c-dataset.json` | stage-c-2 | 28 | Activity-fit 13, Assessment-fit 15 | development |
| `stage-d1-dataset.json` | stage-d1-1 | 17 | Value-use 12, Value-map 5 | development |
| `stage-d1-followup-dataset.json` | stage-d1-2 | 29 | Value-use 24, Value-map 5 | development |
| `stage-d2-dataset.json` | stage-d2-1 | 9 | Ref-relevance 9 | development |
| `stage-d2-followup-dataset.json` | stage-d2-2 | 13 (1 excluded from agreement) | Ref-relevance 13 | development |

### Proposed sets

- **E1, calibration on development data, production prompt `alignment-10`.**
  - `dataset.json` eval-1.1: all six scored types (CLO-PO 10, CLO-EGA 2, ILO-CLO 4, ILO-activity 4, ILO-assessment 5, Module-value 3) plus advisory types.
  - The development split of `alignment-dataset.json` (58 items).
  - 2 runs each, for both models.
- **E2, confirmation on held-out data.**
  - The held-out split of `alignment-dataset.json` (42 items), never run before.
  - Aggregates only, logged, both models, used once.
- **E3, shadow scoring under production settings.**
  - The six synthetic 18-week syllabi from `eval/programSyllabi.js`: BSIT, BSIE and BSCpE, each aligned and with planted errors.
  - The three real sample syllabi only if you approve sending their text.
- **E4, reliability probe (advisory, optional).**
  - `stage-d1-followup` (29 items), including the four Systems Engineering items where MiniMax timed out.
  - It compares timeouts and completion. Advisory relationships only, so it can never affect official scoring.

Together, E1 and E2 cover CLO-PO 49, CLO-EGA 20 and ILO-CLO 37 under the production prompt, but ILO-activity only 4, ILO-assessment 5 and Module-value 3. E3 adds many relationships of those three types, judged against the planted errors. Adding dataset items would need your separate approval; the existing expectations stay as they are.

### Baseline on record [M]

- MiniMax M3.1 Flash, prompt `alignment-10`, on eval-1 (the previous version of the general dataset), 2026-10-23:
  - agreement 97.5%;
  - false approvals 0 of 66; false rejections 3 of 40;
  - repeatability 94.9%; invalid answers 3.3%.
- The dataset is now eval-1.1 and the harness has changed since, so a fresh paired MiniMax run is made on identical inputs. The historical file stays as it is.
- D1 follow-up as you reported it: 27 of 29 verified and 25 of 27 strict agreement, with two unresolved Systems Engineering items.

### Comparison rules [P]

- **Same inputs.** Both models get the same dataset version, prompt version, schema, harness version and day.
- **Native settings.** Only each provider's native settings differ, and they are recorded: MiniMax uses temperature 0 and `max_tokens` 8,192; Claude uses adaptive thinking at effort `high` and `max_tokens` 16,000.
- **Separate results.**
  - Each model and phase gets its own result file and ledger. Nothing is pooled.
  - The comparison report shows the two models side by side, plus paired counts per item (both right, only MiniMax right, only Claude right, both wrong).
  - It never gives a combined accuracy.
- **Expectations are read-only.** A disagreement is reported, not corrected.
- **No tuning on held-out data.** The configuration is chosen on E1 only, and E2 is used once to confirm it.

### Metrics, reported for each model separately

| Metric | Source |
|---|---|
| Agreement, false approvals, false rejections, partial-alignment accuracy, repeatability, confusion matrix, per relationship type and per discipline | `eval/metrics.js` `scoreEval` [V] |
| Exact quotes | Evidence refusal codes (`quote_*`) and `evidenceMatching` in each answer [V] |
| JSON validity | Invalid answers and their codes (`invalid_json`, `schema`, …); first-attempt rate [V] |
| Unsupported explanations | Answers flagged by the answer review (`answerReview.js`) [V] |
| Recommendation quality | Draft reviews and cautions [V]; a sample read by faculty later [P] |
| Latency and timeouts | The guard's log for each request (Anthropic mode [P]) |
| Input, output and thinking tokens, and cost | Usage per request; thinking tokens [P] |
| Possible changes to scored relationships | Agreement per scored type (E1, E2) and shadow scoring (E3) [P] |

---

## 10. Reliability safeguards

| Safeguard | Today [V] | Proposed [P] |
|---|---|---|
| Timeouts | 180 s deadline, never retried. Production tolerates 2 failed batches | Evaluations charge a timed-out request its worst case. 504 is handled as a timeout |
| Rate limits | Bounded retries that honour `retry-after` up to 30 s | The evaluation stops after 3 transient errors (`--max-transient`) |
| Outages | 500, 529 and dropped connections are retried within the deadline | Unchanged |
| Invalid JSON | Refused, then corrective retries: at most 3 attempts per relationship (staged), or the legacy cascade | Unchanged |
| Excessive output | `max_tokens` cap; a `max_tokens` stop counts as a failure | Thinking tokens recorded; token totals per run in the ledger |
| Bounded retries | The SDK's retries are off; the adapter retries at most twice | No retry on a spend limit or a 504 |
| Token monitoring | Usage per request and per check | Thinking tokens, latency and request id; Console usage by workspace |
| Spending limits | — | **Guard:** a cap with worst-case reservation (Anthropic mode). **Console:** a workspace limit of $25 a month. **Production:** the approval switch keeps Claude spending at $0 |
| Error classification | `classifyFailure` | `provider_budget`, plus refusal categories |
| Incomplete evaluations | A completion state, and a stop on the unresolved rate (`evalMetrics.js`) | Unchanged |
| AI unavailable | `not_evaluated` → `AI-REQUIRED` and no score; the breaker | Under the lock, an unapproved Claude provider is "not configured", which takes this same path |
| Nothing unverified reported as verified | `unverifiedOf` and `notChecked` mark the relationship INSUFFICIENT_EVIDENCE (`gemini.js:572-574, :787-788`) | Unchanged |

---

## 11. Testing and rollback plan

### Offline unit tests [P]

These run with the network blocked, as `anthropic.test.js` already does.

- **Settings.**
  - Thinking and effort are mapped correctly for each model.
  - Combinations that would return 400 are refused locally: Opus 5.5 with thinking off, and `between_tools` with `xhigh`.
- **Request body.**
  - Thinking and effort are explicit, and there is no temperature.
  - The system prompt, user message and schema still match the OpenRouter request (an existing test).
- **Spend limits.**
  - HTTP 400 with "specified API usage limits" or "specified workspace API usage limits" gives `provider_budget`, no retry, and a cooldown.
  - 429 with `enforced_spend_limit_reached` gives the same.
- **Server errors and timeouts.** A 504 is a timeout and is not retried. 500 and 529 are retried within the deadline.
- **Refusals and truncation.** A refusal (with its category) and a `max_tokens` stop are unverified `incomplete_output`, with `stopReason` and `stopCategory` recorded.
- **Thinking blocks.** A thinking block before the text: the text is extracted, and the thinking text is never stored.
- **Usage.** Thinking tokens, cache fields, the two Haiku 5.5 price tiers and the Sonnet 5.5 cache-read price.
- **The lock.**
  - With the switch off, an Anthropic provider is not configured: zero requests, `/status` reports not configured, `askJson` refuses, and `verifiedAlignment` is false for Anthropic runs.
  - With the switch on, behaviour is as today.
- **Redaction.** The key is redacted from every error and log line, in the adapter (an existing test) and in the guard.

### Mock API tests [P]

- **Engine replay.**
  - The Anthropic replay transport runs `engine.run` on the Phase 3 fixtures.
  - Identical verdict texts must give identical official results, whether the reply is shaped like OpenRouter's or Anthropic's.
  - This extends the existing test that the official result is the same across providers.
- **The guard's Anthropic mode.**
  - The reservation is made before sending; the run stops at the cap; the ledger continues across invocations.
  - A budget error stops the run; transient errors are counted.
  - An unexpected address is refused, and a timeout is charged its worst case.
- **The evaluation harness.**
  - `eval-alignment.cjs --provider anthropic --plan` works offline.
  - A full `--confirm-paid` run against a mock transport works with no network.
  - The result file has the expected shape, and an existing `--out` file is refused.
- **The drift report.** `report-provider-drift.cjs` on two scripted result files produces every drift category.

### Regression [P]

- The full `npm test` suite passes (1,453 tests passed after the adapter was built).
- A hash snapshot taken before and after shows that only the intended files changed:
  - `docs/ai-eval-*`, the datasets and the faculty-review files are unchanged;
  - `npm test` rewrites the Phase 3 files with identical bytes, so only their timestamps change.
- The output of `report-phase3-scoring-drift.cjs` is unchanged.
- The OpenRouter and Gemini tests are unchanged.

### Paid tests

Only after your written authorization, one phase at a time, each with its caps.

### Rollback [P]

- **At runtime (seconds).**
  - Set the provider line back to `openrouter`, or leave the switch off, and restart.
  - MiniMax resumes and Claude cannot be configured.
  - There is no data migration to undo, and saved reports are untouched.
- **In the code.**
  - The Anthropic code sits in new files plus small, listed changes in `gemini.js`, `modelClient.js` and the scripts.
  - Removing those changes and the SDK dependency returns the checker to its state before the adapter.
  - The implementation report will list every change, because the checker is uncommitted.
- **Credentials.** Revoke the key. Archiving the evaluation workspace archives all its keys [D].
- **Evaluation data.** The evaluation only creates new files, so there is nothing in the history to roll back.

---

## 12. Incremental roadmap

Each stage can be tested on its own. S1–S8 are offline. Each of P1–P5 needs its own written authorization.

| Stage | What | Done when |
|---|---|---|
| S0 | This plan | You approve it, or ask for changes. **Current stop** |
| S1 | Production lock: the approval switch, `verifiedAlignment`, `.env.example` | The lock tests pass and the rest of the suite is unchanged |
| S2 | Adapter hardening: thinking and effort, diagnostics, `provider_budget`, 504, prices, SDK pin | The adapter unit tests pass |
| S3 | Normalisation and schema compatibility: the envelope normaliser, a schema lint for every stage combination against Anthropic's limits, the enum-case diagnostic | The lint passes for every combination, with no schema change |
| S4 | Evidence-validation parity: the replay transport; identical answers verify identically | Parity tests pass, including a thinking block placed first |
| S5 | Timeout and error handling: mock tests for 400, 429, 500, 504, 529, timeouts, refusals and `max_tokens` | All classifications as specified |
| S6 | Token and cost accounting: the guard's Anthropic mode, ledgers, worst-case reservation | Guard tests pass with no network |
| S7 | Harness: provider flags, `--legacy` for the whole pipeline, the provider-drift report | The offline end-to-end test passes and `--plan` works |
| S8 | Full regression and snapshot | Everything passes and only the intended files changed |
| P1 | Paid smoke test (cap $0.50) | The schema is accepted; usage, cache and latency are recorded; costs are re-estimated |
| P2 | E1 calibration, both models, plus the optional Haiku 5.5 arm (caps $6 and $0.50) | Separate result files; the configuration is chosen |
| P3 | E2 held-out confirmation, once (cap $4) | Aggregates logged |
| P4 | E3 shadow scoring (cap $6) | Drift report per syllabus |
| P5 | E4 reliability probe, optional (cap $3) | Timeout and completion comparison |
| R | Report and decision memo | Results kept separate for each model, with no combined score. Any production use is a separate decision after faculty validation |

---

## 13. Decisions needed

1. Approve stages S1–S8, which are offline only.
2. Set `SYLLABUS_CHECK_AI_PROVIDER=openrouter` again and clear the Anthropic key line in server/.env. You can do it, or ask me to.
3. Confirm the candidate, Sonnet 5.5 with adaptive thinking at effort `high`, and decide whether to add the optional Haiku 5.5 arm.
4. Create a dedicated evaluation workspace in the Anthropic Console with a $25 monthly limit and its own key.
5. Authorize the paid phases P1–P5 and their caps, one at a time, whenever you are ready.
6. Decide whether the three real sample syllabi may be sent to Anthropic for shadow scoring.

---

## Appendix A. Official sources (read 2026-10-27)

- Models overview: https://platform.claude.com/docs/en/about-claude/models/overview
- Pricing: https://platform.claude.com/docs/en/about-claude/pricing
- Model deprecations: https://platform.claude.com/docs/en/about-claude/model-deprecations
- Structured outputs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Thinking: https://platform.claude.com/docs/en/build-with-claude/thinking
- Steering thinking and its cost: https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost
- Effort: https://platform.claude.com/docs/en/build-with-claude/effort
- Prompting Claude Sonnet 5.5: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5
- Prompt caching: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- Rate limits and spend limits: https://platform.claude.com/docs/en/api/rate-limits
- Errors: https://platform.claude.com/docs/en/api/errors
- Workspaces: https://platform.claude.com/docs/en/manage-claude/workspaces
- Batch processing: https://platform.claude.com/docs/en/build-with-claude/batch-processing
- Token counting: https://platform.claude.com/docs/en/build-with-claude/token-counting

## Appendix B. Commands the paid phases would run

**Not run.** The flags marked [P] do not exist yet. Every command also takes `--confirm-paid`, its own `--ledger` and `--out` files, and the caps from section 4. The key is read from the environment and never printed.

```text
P1  node scripts/eval-alignment.cjs --provider anthropic [P] --model claude-sonnet-5-5 [P] --thinking adaptive [P] --effort high [P]
        --dataset general --legacy --ids <4 ids> --runs 1 --budget 3 --max-cost 0.5
P2  the same with --dataset general --legacy --runs 2 (then --dataset alignment --split dev --legacy --runs 2), --budget 130 --max-cost 6
    MiniMax arm: the same commands with --provider openrouter [P] and its own ledger and output files
P3  --dataset alignment --split heldout --legacy --runs 2 --budget 75 --max-cost 4      (both models, once)
P4  node scripts/live-pipeline-eval.cjs --live --legacy [P] --provider anthropic [P] --syllabi <the 6 synthetic syllabi> --max-cost 6
    then: node scripts/report-provider-drift.cjs [P] --baseline <MiniMax result> --candidate <Claude result>     (offline)
P5  --dataset stage-d1-followup --runs 2 --budget 75 --max-cost 3
```
