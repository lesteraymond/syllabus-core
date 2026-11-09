# Cost optimization of the Comprehensive Hybrid AI Checker

**Superseded in part by FINAL-COST-REPORT.md (re-run benchmark, output-fields flag, browser results).**

Status: implemented behind flags (all **off** by default), verified offline. **No live Anthropic request was made, no budget was raised, nothing was committed, pushed or deployed.**
Date: 2026-11-05. Everything below that is a cost number is **modeled** (scripted provider, see F) unless it says "reported by the provider"; none of it is billed usage.

**Short answer.** The expensive part of a check is *output tokens* (79 % of the modeled charge of a full comprehensive check; the system prompt is already one cached block, 81 % of request bytes but billed at the cache-read rate). So there is little cost left to remove from a *first* check without changing what is asked, and the honest result is modest: about **−3 % to −5 %** on first checks and revisions (cache warm-up), **−11 % to −15 % on the reservation** (planned output ceiling), and **−84 % on a course-description edit** (scoped context). Unchanged re-checks already cost **0 requests**. Consolidating Policy V2 requests by week saves at most 1.7 % and puts week x3 within 1 % of the output ceiling, so it stays experimental. Nothing here changes a rule, a prompt's academic wording, the official score, the 79 threshold or a gate.

---

## A. Architecture report

Nothing was rebuilt. The request path is unchanged: `service.checkHybrid` → `engine.run` → `gemini.align` (batching, reuse, budget) → `requestAnthropic` → `anthropicMessage`. Policy V2 runs through the same `align` with `integratedAcademic`.

| Piece | Where | What it does now |
|---|---|---|
| Control module (new) | `server/lib/syllabuscheck/costPlan.js` | the four flags, `planBatches`, `plannedMaxTokens`, `partitionByContext`, the cache warm-up gate |
| Scoped context (F1) | `gemini.js` `userMessageOf` (6th parameter), `pairKey` call, `promptVersion` suffix `-cc1`, run-splitting in `align` | the course description goes only to requests that carry a type that reads it |
| Output ceiling (F2) | `gemini.js` `requestAnthropic` → `anthropicClient.js` `maxTokens` option | `max_tokens` (and so the reservation) sized from the request; can only lower `ANTHROPIC_MAX_TOKENS`, never below 1024 |
| Batch planner (F3) | `gemini.js` `align`, `academicPolicyV2.plannedRequests` | the existing fixed slices by default; optional week grouping for Policy V2; the planning hold counts the same batches |
| Cache warm-up (F4) | `gemini.js` `requestAnthropic` + `costPlan.throughGate` | first request of each distinct system prompt runs alone; one gate per check (keyed by the shared budget) |
| Usage accounting (F5, always on, reporting only) | `gemini.js` `createRequestBudget.reconcileUsage/summary`, `budgetReport.js` | `providerReported` token counts and `calculatedUsd` kept apart from `reservedCostUsd` (see F) |

Defaults are byte-identical to before: a comprehensive check of the synthetic course A still sends **51 requests, 1,966,860 bytes, `max_tokens` 16000** (measured before and after; pinned by `optimization.test.js`).

Flags (documented in `server/.env.example`; the original strategy stays available for rollback or comparison by leaving them unset):

| Flag | Value | Risk | Recommendation |
|---|---|---|---|
| `SYLLABUS_CHECK_CACHE_WARMUP` | `on` | adds up to one request latency (≈7 s) at the start of a check; changes nothing else | safe to enable after one authorised real run confirms `cache_read_input_tokens` > 0 |
| `SYLLABUS_CHECK_OUTPUT_PLAN` | `on` | a ceiling too small for a real answer costs a retry in halves (billed), never a wrong verdict; adaptive thinking gets a fixed allowance | enable after a real run shows no `max_tokens` stops |
| `SYLLABUS_CHECK_COURSE_CONTEXT` | `scoped` | new prompt version (`-cc1`): one-time re-ask of the legacy relationships; the model sees less context for description-free types (needs the faculty/academic review below); +1 small request on a first check | enable if description edits are common |
| `SYLLABUS_CHECK_V2_GROUPING` | `week1/2/3/adaptive` | week3 ≈ 21 relationships × 758 output tokens ≈ 15.9 k of 16 k | experimental, do not enable |

## B. Prompt and context optimization report

What the prompts and requests contain (measured on the comprehensive profile, 51 requests): system prompt **81.1 %** of request bytes (4 distinct prompts: 34,407 / 36,614 / 21,465 / 18,283 bytes; 39 of 51 requests share one), relationship pairs 6.7 %, output schema 4.9 %, recommendation context 3.2 %, course context 2.1 %, corrections 0.0 %.

Static (system prompt, schema) / course-level / week-level split already exists: the system block is static and cached; the course context is one small object; week data travels inside the pairs. Findings:

* **Implemented, F1 scoped course context.** Only `Content-course`, `Ref-relevance`, `Title-description`, `Description-plan` read the course description (checked against the prompt text). With the flag, other legacy requests carry the course with an empty description, are never mixed with description-reading ones, and their reuse key no longer contains the description. Policy V2 requests already carry no description. Prompt version gains `-cc1`, so verdicts made under one context are never reused under the other.
* **Already present, not changed.** `SYLLABUS_CHECK_CLO_DESCRIPTION=off` (CLO relationships never see the description); `SYLLABUS_CHECK_PROMPT_TRIM=on` (existing stage-gated trim of the system prompt). **Measured**: trim cuts request bytes 56 % (1,966,860 → 857,965) but the *modeled charge rises 2 %* (1.7614 → 1.7974) because the four prompts become many cache prefixes and each is written once at 1.25×. It also changes the wording the model sees (an academic-review matter). **Not recommended as a cost measure.**
* **Not implemented (and why).** Dropping the `outcomes` (CLO statements) list or the program/year/code from the course context: a title edit re-asks **100 %** of relationships (274/274) because title/program/year are context in every key; but they are legitimate context for several relationships and shrinking them changes what the model sees without a measured saving of more than ~1 % of bytes. Candidate for a later, reviewed change.
* **Prompt versioning.** `promptVersionOf` + policy id + recommendation contract version + `-cc1`; any change of prompt, model, thinking/effort (`configKeyOf`) or contract is a new question and a reuse miss (test F).

## C. Request consolidation report (strategies A–E)

Implemented as one planner (`costPlan.planBatches`) behind `SYLLABUS_CHECK_V2_GROUPING`; each relationship still has its own result, the server verifies each id/quote against the exact text, and a relationship missing from a grouped answer is asked again alone and, if still missing, reported **NOT_CHECKED** (test G, also with `week3`).

| Strategy | Setting | Requests | Request bytes | Modeled charge | Reservation | Output / ceiling | Verdicts |
|---|---|---:|---:|---:|---:|---|---|
| A existing | unset | 20 | 505,520 | $1.4154 | $4.632 | 16000 | reference |
| B one week | `week1` | 28 | 703,087 | $1.4171 | $6.475 | 16000 | identical |
| C two weeks | `week2` | 21 | 524,816 | $1.3994 | $4.851 | 16000 | identical |
| D three weeks | `week3` | 18 | 446,657 | $1.3909 | $4.151 | ≈15.9k of 16k | identical |
| E adaptive | `adaptive` | 21 | 524,816 | $1.3994 | $4.851 | 16000 | identical |

(First check, Policy V2 on, modeled output = relationships × 758.) Reading it: B costs more requests and reservation for no saving; C/E save 1.1 %; D saves 1.7 % but sits at the output ceiling, so real Claude (adaptive thinking, longer explanations) would truncate and pay for the retry. **A stays the default; D is not recommended.** The planning hold (`plannedRequests`) uses the same planner so the held room always matches what is actually sent (11 / 19 / 12 / 9 / 12 requests for A–E).

## D. Caching strategy

**Anthropic prompt cache (provider side).** The system prompt is the one cached block (`cache_control: ephemeral`, default on, `ANTHROPIC_PROMPT_CACHE=off` disables). Concurrent first requests each *write* it (1.25×) because an entry is readable only after the writing request has answered. F4 serialises only the first request per distinct prompt (modeled: cache-write tokens 32,032 → 12,201 on a first check, 60,203 → 27,694 comprehensive; charge −3.4 % / −4.4 %). Captured per request and aggregated: `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens` (`usageOf`, `reconcileUsage`, `summary().providerReported`). **No saving is assumed**: the real hit rate is unknown until one authorised run.

**Exact-result cache (application side; already existed, verified, not changed).**

| Property | Behaviour |
|---|---|
| Key | `sha256([promptVersion, provider, model+thinking+effort, type, source text, target text, course key, CLO-classification context])`; V2 adds the contract version and a `contextHash` |
| Prompt/reference version | prompt version (stage label, variant, trim, policy id, recommendation contract, `-cc1`); institutional reference changes alter the pair text (PO test E) |
| Scope / access control | per syllabus only (`reusableJudgements(db, syllabusId)`); a second syllabus with identical text misses (test F); no cross-user sharing |
| What is stored | only verified judgements of completed relationships; incomplete, invalid, stale, `NOT_CHECKED` and budget-deferred results are never reused |
| Invalidation | any change of the key components; `SYLLABUS_CHECK_REUSE=off` disables; section revisions (428 `revision_required` / 409 `revision_conflict`) are untouched |
| Expiry | none by time: a verdict is valid exactly as long as its key is unchanged; the provider prompt cache expires on Anthropic's 5-minute TTL |
| Cost controls that do **not** change the key | output plan, warm-up, grouping (still a hit; test F) |

## E. Incremental checking report

No paid check runs on a keystroke or autosave: a check is started only by the existing authorised actions (Validate / Re-Check / Draft Review). Re-checks ask only the relationships whose key changed. **Measured dependency matrix** (`scripts/optimization/dependency-graph.cjs`, synthetic course A, full check = 274 relationships / 51 requests; `dependency-matrix.md` and `dependency-matrix-scoped.md`):

| Edit | Re-asked (default) | Re-asked (`scoped`) | Reason |
|---|---:|---:|---|
| Unchanged | 0 | 0 | every key unchanged |
| Course title | 274 (100 %) | 274 | title is context in every key (**over-invalidation**, see K) |
| Course description | 112 (40.9 %), 32 requests | **7 (2.6 %)**, 4 requests | only types that read it (+ `Plan-sequence` whose pair text embeds it) |
| CLO 1 / CLO 2 statement | 28 / 32 | same | its mappings, coverage, and the ILO-CLO of every week tagged to it (necessary cross-week dependency) |
| CLO level / PO mapping | 1 / 1 | same | only the dependent coverage / CLO-PO |
| Week 5 content | 21 | same | the week's relationships + whole-plan ones (coverage, sequence, references) |
| Week 5 ILO | 15 | same | CLO tag mapping + week relationships |
| Week 5 activities | 8 | same | ILO-activity, activity-fit/assessment, value, content-activity |
| Week 5 tasks | 6 | same | |
| Week 5 values | 2 | same | |
| A reference | 1 | same | `Ref-relevance` of that item |
| Institutional PO 1 wording | 6 | same | `CLO-PO` / `CLO-anyPO` only |

Dependency graph (what each field feeds): CLO statement → Course-CLO, CLO-PO/EGA, CLO-set, coverage, classification, **ILO-CLO of every week tagged to it**; ILO text → ILO-CLO/content/activity/assessment, Content-ILO, Activity-fit, Assessment-fit, Value-map; weekly content/activities/tasks/values → their own week's relationships plus whole-plan relationships; description → Content-course (V1 only), Ref-relevance, Title-description, Description-plan, Plan-sequence; institutional reference → the relationships that quote it. The graph is **not week-only**.

## F. Cost benchmark

Method: real application, real request bodies, scripted provider; tokens modeled (input = bytes/4; output = relationships × 309 legacy / 758 V2 contract; cache entry readable only after its writing request answers; every check starts cold; list prices from `anthropicClient.PRICES`, no regional factor). Full machine-readable data: `benchmark-results.json`. "Reservation" is the in-app upper bound against the cap (`reservedCostUsd`), **not** dollars spent. Baseline = all flags unset; Safe set = scoped context + output plan + warm-up. Reproduce: `node scripts/optimization/benchmark.cjs --strategies`.

| Scenario | Config | Requests | Request bytes | Output tok | Cache W / R tok | Modeled charge | Reservation | Verdicts |
|---|---|---:|---:|---:|---|---:|---:|---|
| 1 First check (V2) | baseline | 20 | 505,520 | 122,758 | 32,032 / 42,596 | $1.4154 | $4.632 | |
| | safe set | 21 | 515,749 | 122,758 | 12,201 / 64,690 | $1.3687 (−3.3 %) | $4.659 | identical |
| 2 Unchanged re-check | both | **0** | 0 | 0 | | $0 | $0 | identical |
| 3 One-week revision | baseline | 2 | 35,706 | 2,892 | 6,834 / 0 | $0.0502 | $0.431 | |
| | safe set | 2 | 35,259 | 2,892 | 6,834 / 0 | $0.0500 (−0.4 %) | $0.365 (−15 %) | identical |
| 4 CLO revision | baseline | 3 | 107,507 | 17,492 | 12,997 / 0 | $0.2352 | $0.765 | |
| | safe set | 4 | 118,202 | 17,492 | 7,630 / 7,630 | $0.2233 (−5.1 %) | $0.899 (+18 %) | identical |
| 5 Full comprehensive | baseline | 51 | 1,966,860 | 139,135 | 60,203 / 338,690 | $1.7614 | $13.303 | |
| | safe set | 52 | 1,997,360 | 139,135 | 27,694 / 379,801 | $1.6823 (−4.5 %) | $11.844 (−11 %) | identical |
| 6a Tight: $6 cap, comprehensive | baseline | 22 | 863,722 | 50,772 | | $0.6991 | $5.772 | 36 relationships NOT_CHECKED beyond |
| | safe set | 25 | 968,929 | 77,442 | | $0.9332 | $5.813 | same verdicts, **+34 more checked** |
| 6b Tight: $4.4 cap, V2 | baseline | 18 | 478,021 | 118,432 | | $1.3670 | $4.220 | |
| | safe set | 19 | 485,682 | 115,651 | | $1.2912 | $4.241 | same verdicts, **9 fewer optional checks** |
| 7 Description edited | baseline | 8 | 130,791 | 20,365 | 11,360 / 11,360 | $0.2531 | $1.696 | |
| | safe set | **3** | 55,818 | 1,825 | 6,834 / 4,571 | $0.0409 (**−84 %**) | $0.451 (−73 %) | identical |

Single flags: output plan changes the reservation only (comprehensive −12 %, week −15 %, description −12 %) and leaves the modeled charge unchanged; warm-up alone gives −3.4 % (scenario 1), −5.5 % (4), −4.4 % (5), −4.3 % (7); scoped context alone is neutral on first checks (+1 request, +$0.0009), **+2.8 % on a CLO revision** (the type-homogeneous split adds a small batch), and −84 % on a description edit.

Where there is **no benefit**: unchanged re-checks (already 0); week/tasks/values/reference edits (already 2–8 relationships); the output side (79 % of the charge) cannot be reduced without asking fewer or shorter answers, which would change what is asked. Measured **drawback**: with scoped context a very tight reservation (6b) reaches 9–10 fewer *optional* checks (batch boundaries move); required work is unchanged.

Accounting (`budgetReport(...).accounting`, `summary().providerReported`) now separates four things and never adds them: **estimated** (before sending), **reserved** (`reservedCostUsd`, upper bound against the cap), **provider-reported usage** (token counts), **calculated charges** (reported tokens at list prices, not an invoice). A scripted provider's numbers are not billing; nothing in this report is presented as a billed saving.

## G. Academic evaluation coverage report

* Same relationships are sent in every configuration (`new Set(asked)` equal, test A); 47 deterministic rules, the 7 VPAA weekly links, the 4 CLO classifications, EN/TL, and the 11 reserved rules (pending) are untouched; no rule or required evaluation was added or removed.
* Required work is protected under a tight budget: every planned required request is sent (test I); only optional supporting checks may differ, always reported **NOT_CHECKED** (`budget_deferred`), never invented.
* A missing/duplicate/invalid answer, a cut-off answer (`max_tokens`), a provider outage → relationship **NOT_CHECKED**, check stays incomplete (tests G, H, "output plan").
* No embedding-based approval, no automatic model change, no academic evidence removed (scoped context only omits the description from requests whose type does not read it, and says so in the prompt version).

## H. Scoring parity report

`passThreshold` 79, six areas, `overall`, `status`, `passed` and **every relationship's verdict** are identical to baseline for: scoped, output plan, warm-up, safe set, safe set + `week2`, `adaptive`, on two synthetic courses (test J: 2 courses × 6 configurations); score 84 / status `scored` in every benchmark row. Submission and approval gates are not touched (no file under routes/review/submission changed).

## I. Test report

| Run | Result |
|---|---|
| `node --test server/lib/syllabuscheck/optimization.test.js` (new) | **17 / 17 pass** |
| `npm run test:vpaa` | conformance **276 / 276**, UI **18 / 18** |
| `npm test` | **2,120 / 2,120 pass** (2017 + 22 + 47 + 16 + 18), 0 failed, 0 skipped |
| `npm run build` | passes (exit 0) |
| Browser comprehensive / legacy E2E | **NOT RUN**: free memory ≈850 MB with other processes active; the change set touches no UI, route or report schema except one added reporting key (`hybrid.budget.accounting`), which the panels ignore. Run `scripts/e2e/run-comprehensive-ui.cjs` when memory permits |
| Real Claude | **NOT RUN** (not authorised): smoke/full tiers of `docs/checker-comprehensive/live/LIVE-TEST-PLAN.md` still await explicit authorisation |

The new tests cover Tests **A** first check, **B** unchanged, **C** one week, **D** CLO, **E** reference version, **F** cache miss/hit (prompt version, effort, other syllabus, cost-only flags), **G** incomplete grouped response, **H** provider unavailable, **I** budget limit, **J** scoring parity; plus planner invariants (nothing dropped/duplicated, bounds, default == old slicing), ceiling bounds, warm-up gate semantics, default-request identity, scoped-context homogeneity, truncation recovery. Multi-tab revision conflicts (428/409) are covered by `contentRevision.routes.test.js` (unchanged, passing). Phase B (structured output) needed no change: strict JSON schema, stable relationship ids, unknown/duplicate ids refused (`gemini.js` `unknown_id`), quotes verified against the exact text, correction fields limited to the field a relationship owns (`unauthorized-field` withheld), Accept/Edit/Reject/Undo covered by `v2-recommendation-actions.test.js` and `-safety.test.js`; making the answer shorter would change the verification contract, so it was not done.

## J. Changed files (this task; all uncommitted)

New: `server/lib/syllabuscheck/costPlan.js`, `server/lib/syllabuscheck/optimization.test.js`, `scripts/optimization/benchmark.cjs`, `scripts/optimization/dependency-graph.cjs`, `docs/checker-comprehensive/optimization/{OPTIMIZATION-REPORT.md, benchmark-results.json, dependency-matrix.md/.json, dependency-matrix-scoped.md/.json}`.
Modified: `server/lib/syllabuscheck/gemini.js` (scoped context, output ceiling, warm-up, planner, accounting), `anthropicClient.js` (`maxTokens` option), `academicPolicyV2.js` (`plannedRequests` uses the planner), `budgetReport.js` (`accounting`), `server/.env.example` (flag documentation). No database migration, no environment variable of any deployment changed.

## K. Remaining risks

1. **Real output tokens.** Output is 79 % of the charge and is modeled from earlier calibrations; adaptive thinking and longer real explanations can move it either way. All percentages here are directional until one authorised real run.
2. **Cache semantics.** The prompt-cache model (readable only after the writer answers, 5-minute TTL, minimum cacheable size) is Anthropic's documented behaviour but unverified here; warm-up could show no gain.
3. **Output ceiling.** A planned ceiling is 4× the measured per-relationship output; a real answer that does not fit is billed, refused and retried in halves. Enable only after a real run reports no `max_tokens` stops.
4. **Scoped context quality.** Verdicts for description-free types were never evaluated by Claude with the description removed; the existing live tiers (not run) and an academic reviewer should confirm before enabling in production. It also adds one small request on some checks and can reach fewer optional checks under a very tight reservation.
5. **Title/program edits re-ask everything** (274/274) — measured over-invalidation, left as is because those fields are real context.
6. **Browser E2E not re-run** after this change (resources); server tests and UI conformance pass.
7. **Prompt trim** (existing) shows a modeled cost *increase*; do not enable it for cost.
8. The in-app cap remains a reservation ceiling; real dollars are bounded by the evaluation guard, the spend register and the provider-side limit, none of which changed.
