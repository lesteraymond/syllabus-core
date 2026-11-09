# Final cost report: verification of the Comprehensive Hybrid AI Checker optimizations

Date 2026-11-05. **No live Anthropic request was made; no budget was raised; nothing was committed, pushed or deployed.** Every cost figure is **modeled** (scripted provider, real request bodies, modeled tokens) unless it says "provider-reported"; no figure here is billed usage and **no actual Anthropic saving is claimed**. This report supersedes the figures in `OPTIMIZATION-REPORT.md` where they differ (the benchmark was re-run with the corrected output model below).

**Status: NOT declared production-ready.** Browser regression E01-E17 and the comprehensive/budget suites pass with the flags on, but E18-E20 (subject term / academic-year scenarios) fail, for reasons outside this work (section 9).

## 1. Exact feature flags (all default OFF; documented in `server/.env.example`)

| Flag | Value | Effect |
|---|---|---|
| `SYLLABUS_CHECK_COURSE_CONTEXT` | `scoped` | course description sent only with the 4 types that read it; prompt version `-cc1` |
| `SYLLABUS_CHECK_OUTPUT_PLAN` | `on` | `max_tokens` and the budget reservation sized per request (never above `ANTHROPIC_MAX_TOKENS`, never below 1024) |
| `SYLLABUS_CHECK_CACHE_WARMUP` | `on` | first request of each distinct prompt runs alone so later ones read the prompt cache |
| `SYLLABUS_CHECK_V2_GROUPING` | `week1`/`week2`/`week3`/`adaptive` | Policy V2 relationships batched by week |
| `SYLLABUS_CHECK_OUTPUT_FIELDS` | `scoped` | **new this round.** A legacy request asks only for the Stage C/D structured fields its relationship types use (Activity-fit/Assessment-fit: 6; Value-use/Value-map: 6; Ref-relevance: 2). The prompts already said "answer not_assessed in these fields for every other type"; the strict schema made the model write all 13 anyway. Prompt version `-of1`; Policy V2 untouched |

Always on, reporting only: `summary().providerReported` / `budgetReport().accounting` (estimated vs reserved vs provider-reported vs calculated charge).

**All flags OFF preserves the original behavior** (Task 1). Verified by running the code from before this work (copied from scratch, since removed) and the current code over 4 synthetic courses x comprehensive and V2-only: request bodies are **byte-identical** (sha256 of every body), request count and bytes equal (51 requests / 1,967,367 bytes comprehensive; 20 / 505,520 V2), official outcome, six areas, every relationship verdict and the budget summary identical, with the flags unset and with every flag set explicitly to off. The only difference is the added reporting key `providerReported`.

## 2. Benchmark method and what is measured

`node scripts/optimization/benchmark.cjs --strategies` (data: `benchmark-results.json`). Identical fixtures (synthetic course A; a second course in the tests). Per run: requests, request bytes, estimated input tokens (bytes/4), cache-write/read tokens (modeled cache: entry readable only after its writer answered; assumed 1024-token minimum), max_tokens ceilings summed, **estimated** output tokens, reservation, modeled charge (list prices), cache eligibility and hit indicators, runtime (scripted latency, so only relative), relationships verified/not-checked, parity with baseline. Output model: V2 = 758 tokens per relationship (measured earlier); legacy = 309 measured with all 13 fields, split as 205 + 8 per Stage C/D field asked for (**assumption**, needs one real run). Provider-reported usage in these runs is the scripted double's constant (100/100 per answer) and is kept separate in the accounting.

## 3. Results versus baseline (modeled; negative = cheaper)

| Scenario / flag | Requests | Input tok (incl. cache) | Output tok (est.) | Reservation | Modeled charge | Verified / NOT_CHECKED |
|---|---|---|---|---|---|---|
| **First check, V2** (20 req, $1.3135 baseline) | | | | | | 220/7 all |
| scoped context | 21 | +2.0% | 0 | +4.3% | +0.1% | same |
| output plan | 20 | 0 | 0 | -2.0% | 0 | same |
| cache warm-up | 20 | 0 | 0 | 0 | **-3.6%** | same |
| week1 / week2 / week3 / adaptive | 28/21/18/21 | +39%/+3.8%/-11.6%/+3.8% | 0 | +39.8%/+4.7%/-10.4%/+4.7% | +0.1%/-1.2%/-1.9%/-1.2% | same |
| output fields | 20 | 0 | 0 | 0 | 0 (no Stage C/D field in a V2-only check) | same |
| all flags (week2) | 22 | +5.8% | 0 | +3.3% | -3.9% | same |
| **Full comprehensive** (51 req, $1.7614, reservation $13.30) | | | | | | 273/7 all |
| scoped context | 52 | +1.6% | 0 | +1.8% | -0.1% | same |
| output plan | 51 | 0 | 0 | **-12.1%** | 0 | same |
| cache warm-up | 51 | 0 | 0 | 0 | **-4.4%** | same |
| week2 / week3 | 52/49 | +1.0%/-3.0% | 0 | +1.6%/-3.6% | -0.9%/-1.4% | same |
| output fields | 51 | -2.5% | **-9.8%** | -0.8% | **-9.1%** | same |
| safe set (scoped+plan+warm-up) | 52 | +1.6% | 0 | -11.0% | -4.5% | same |
| safe set + output fields | 52 | -1.1% | -9.8% | -11.8% | **-13.7%** | same |
| all flags (week2) | 53 | -0.1% | -9.8% | -10.9% | -13.9% | same |
| existing `PROMPT_TRIM` (reference) | 51 | bytes -56% | 0 | -18.3% | **+2.0%** | same |
| **Unchanged re-check** | **0** under every configuration (already optimal) | | | | $0 | reused |
| **One-week revision** (2 req) | 2 | scoped -1.3% | 0 | plan **-15.1%** | warm-up 0; safe -0.4% | same |
| **CLO revision** (3 req) | scoped 4; week1/2/3: **17/10/7** | scoped +9.9% | 0 | scoped +26%; week grouping **+120% to +420%** | warm-up -5.7%, safe -5.3%, scoped +2.9%, week grouping **+8.9% to +18.1%** | same |
| **Description edited** (8 req, $0.2531) | scoped **3** | scoped -57% | **-87.7%** | scoped -61.6%, safe -73.4% | scoped / safe **-79.0%** | same |
| CLO revision, cache still warm (previous check < 5 min) | unchanged | | | | warm-up 0 (nothing to gain) | same |

Budget behavior (reservation caps; verdicts that exist in both runs are always identical, official result 84/scored in every row):

| Cap | Baseline verified / NOT_CHECKED | With output plan | Safe set | Notes |
|---|---:|---:|---:|---|
| $10, comprehensive (35 req) | 218 / 62 | 239 / 41 (+21) | 237 / 43 (+19) | smaller reservations let more fit; same cap |
| $6, comprehensive | 112 / 168 | 148 / 132 (+36) | 146 / 134 (+34) | |
| $4.4, V2 only | 206 / 21 | 206 / 21 | 197 / 30 (-9) | scoped context moves batch boundaries: 9-10 fewer optional checks |
| $4.4, V2, week1 | 161 / 66 (-45) | | | week1 reserves more per check |

In every capped run the reservation stayed under the cap and every planned required request was sent (test I, `optimization.test.js`). Skipped items stay `NOT_CHECKED`/`budget_deferred`.

## 4. Request, input, output, reservation, billing reduction (summary)

* **Requests:** none of the flags reduces requests on a first check (scoped context adds one; week3 saves 2-3 of 20-51). Unchanged re-check is already 0; a description edit drops 8 -> 3 with `scoped`.
* **Input tokens:** noise (+/-2%) except `scoped` on a description edit (-57%) and `week3` (-3% to -12%, at the cost of the output-ceiling margin).
* **Output tokens (estimated):** only `SYLLABUS_CHECK_OUTPUT_FIELDS` reduces them (-9.8% on the comprehensive check) and `scoped` on a description edit (-87.7%, fewer relationships asked). Output is ~79% of the modeled charge, so this is the lever with the largest effect and the least certainty.
* **Reservation:** `output plan` -11% to -15%; it is also what lets 19-36 more relationships fit under $6-$10.
* **Estimated billing (modeled):** warm-up -3.6% to -5.7%; output fields -9.1%; together with scoped + plan -13.7% on a comprehensive check; description edit -79%. **Not measured on Anthropic's invoice.**

## 5. Academic coverage (Task 3), verified by tests

* Seven VPAA relationships (Content-course, Content-ILO, ILO-CLO, Content-activity, ILO-activity, Content-assessment, Activity-assessment) and four CLO-classification instances are each present exactly once and evaluated as often as in the baseline, with the same verdict, under every flag and grouping (`coverage:` test; also browser K02/K03).
* Grouped requests: for a damaged answer to one relationship (duplicate, unknown id, malformed JSON, invalid label, quote not in the text, missing field) under default and `week3` grouping, the relationship is asked again alone and then reported `NOT_CHECKED` with no verdict; an unrequested id never reaches the report; every expected id appears exactly once; the check is `incomplete` with no score, identical to the baseline behavior. **Pre-existing conservative behavior (same on the code before this work):** an unknown id in a batch reply discards that reply, and 1-2 neighbouring relationships can end up `NOT_CHECKED` rather than getting a verdict; nothing is invented. Reported, not changed.
* Output efficiency (Task 4): compact output by omitting unused structured fields (F6) is the one safe reduction found. Verification still checks the same list the schema asked for (a field not asked for is refused). Not done, deliberately: shortening explanations or quotes, removing `draft`/`correctionReason`, changing wording or output limits below the measured need: they alter the evidence contract or risk truncation. Output ceilings: `max_tokens` is 4x the measured answer per relationship; a cut-off answer is refused and re-asked in halves (test).
* 47 deterministic rules, rule coverage counts, the 11 reserved rules, EN/TL, 79 threshold and the gates are unchanged (rule-coverage counts compared flag-on vs off in tests; browser K03/E13).
* Structured-output contracts (Phase B) were already strict (ids, enums, exact quotes, field ownership for recommendations, unauthorized-field withheld); Accept/Edit/Reject/Undo covered by existing tests and browser K06/E08.

## 6. Scoring parity

`overall`, `status`, `passed`, `passThreshold` (79), six `areas`, `ruleChecks`, findings and every relationship verdict identical to baseline for scoped, plan, warm-up, safe set, safe + week2, adaptive, and flags-on vs off (test J on two courses; browser K08 profile-on vs profile-off vs V2-only; E15 V2 on vs off).

## 7. Test results (exact)

| Run | Result |
|---|---|
| `node --test server/lib/syllabuscheck/optimization.test.js` | **21 / 21 pass** (A-J, version/reference invalidation, coverage, grouped faults x6, output fields x2, truncation) |
| `npm run test:vpaa` | conformance **276 / 276**, UI **18 / 18** |
| `npm test` | **2,124 / 2,124 pass** (2021 + 22 + 47 + 16 + 18), 0 failed, 0 skipped |
| `npm run build` | passes |
| Browser, comprehensive profile, **flags ON** (scoped, plan, warm-up, output fields; isolated MariaDB, 16 MB packet) | **K01-K10 all PASS** (score, 7 VPAA, 4 CLO classes, saved report audit, stale report, submission, recommendations, provider down, scoring parity across 3 servers, no network, two-tab 409) |
| Browser, tight budget **B01** ($6), flags ON | **PASS** |
| Browser regression, flags ON | E01-E17 **PASS** (E15 after fixing the runner, see below); E18, E19, E20 **FAIL** |
| Browser regression, flags OFF (control) | E01-E17 **PASS**; E18, E19 **FAIL** identically |
| Real Claude | **not run** (not authorised) |

Test-infrastructure fixes made (tests only): second servers started by K08 and E15 did not inherit the isolated database port (`E2E_DB_PORT`), so they could not connect; they now do. `run-comprehensive-ui.cjs` accepts `E2E_EXTRA_ENV` (JSON) to add the cost flags to the server under test. The isolated database server and its data directory were removed afterwards.

## 8. Which optimizations deliver, which do not

| Flag | Measurable benefit (modeled) | Cost / risk | Recommendation for controlled staging |
|---|---|---|---|
| `CACHE_WARMUP=on` | -3.6% to -5.7% charge on cold checks; 0 when cache already warm | +one request latency (~7 s); depends on real cache behavior | **Enable** (lowest risk) |
| `OUTPUT_PLAN=on` | reservation -11% to -15%; +19 to +36 relationships checked under $6-$10 caps; no charge change | too-small ceiling costs a billed retry | **Enable** after one real run shows no `max_tokens` stops |
| `OUTPUT_FIELDS=scoped` | output -9.8%, charge -9.1% on comprehensive (assumes 8 tokens/field) | one-time re-ask of legacy relationships (new prompt version); saving unverified | **Enable in staging, measure** `output_tokens` before/after; keep if the drop is real |
| `COURSE_CONTEXT=scoped` | -79% on a description edit; ~0 elsewhere | +1 small request on first/CLO checks (+2.9% on CLO revision); model sees less context for description-free types (needs academic review); 9-10 fewer optional checks at a very tight cap | **Optional**; enable only if description edits are frequent and a reviewer accepts the context change |
| `V2_GROUPING=*` | at best -1.9% on a first check | **worse for incremental checks** (CLO revision 3 -> 7-17 requests, +9% to +18% charge); week3 leaves ~1% output headroom; week1 reserves +40% | **Leave disabled** (complexity without meaningful savings) |
| `PROMPT_TRIM` (existing) | request bytes -56% | modeled charge +2% | keep disabled |

Suggested staging set: `CACHE_WARMUP=on`, `OUTPUT_PLAN=on`, `OUTPUT_FIELDS=scoped`; optionally `COURSE_CONTEXT=scoped`. The cap stays a reservation ceiling; do not raise it.

## 9. Remaining risks and limitations

1. **E18-E20 fail** (subject academic-year / term scenarios: "the subjects table shows the new subject with its term", academic-year filters and scope). They fail with every cost flag off, and with different symptoms between runs, while the working tree contains another session's uncommitted academic-year and subject-term work (`server/lib/academicYear.js`, `subjectTerm.js`, `routes/academicYears.js`, `db/migrate-subject-term.js`, modified `SubjectActions.jsx`). The isolated scratch database was built by the existing bootstrap and the migration was not run (not authorised). They are unrelated to the checker but mean **full regression is not green, so the optimized checker is not declared production-ready.** Re-run `--suite=regression` once that work is settled and its migration is authorised.
2. All savings are modeled. Real output length (adaptive thinking), the per-field token cost behind `OUTPUT_FIELDS`, cache hit rates and TTL, and scoped-context answer quality can only be confirmed by a real, explicitly authorised run (`docs/checker-comprehensive/live/LIVE-TEST-PLAN.md`).
3. Title/program/year edits re-ask 100% of relationships (they are context in every key); left as is.
4. Pre-existing: an unknown id in a batch reply can leave 1-2 neighbouring relationships NOT_CHECKED.
5. A ceiling that proves too small for a real answer costs a billed retry (never a wrong verdict).
6. Comprehensive-suite flags-off control run in the browser was not repeated after the flags were added; flags-off equivalence rests on the byte-identical request comparison and the unit tests.

## 10. Files changed this round (uncommitted)

`server/lib/syllabuscheck/costPlan.js` (F6), `gemini.js` (F6 hooks), `optimization.test.js` (21 tests), `scripts/optimization/benchmark.cjs` (new configs, cache-hit/runtime/coverage columns, $10/warm scenarios), `scripts/e2e/run-comprehensive-ui.cjs` (`E2E_EXTRA_ENV`), `scripts/e2e/scenarios-comprehensive.cjs` and `scripts/e2e/scenarios.cjs` (second-server database port), `docs/checker-comprehensive/optimization/{FINAL-COST-REPORT.md, benchmark-results.json}`, UI evidence under `docs/checker-comprehensive/ui-verification/*-flags-on` and `*-flags-off`.
