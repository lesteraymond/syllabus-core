# Controlled real-Claude test: plan, configuration, estimates and required authorization

**Status: prepared offline. NO paid request has been made.** Nothing below has been run against the real Claude model. Everything that was verified so far used a scripted
provider, which proves the software handles responses correctly, not that Claude judges text well. Real Claude integration is **not** verified until the steps below succeed.

Regenerate the figures with `node scripts/live-claude/plan.cjs` (offline), the readiness audit with `node scripts/live-claude/readiness.cjs`, and the fixtures with
`node scripts/live-claude/fixtures.cjs`. Machine-readable estimates: `estimates.json`.

## 1. What is being tested, and what is not

| Level | Established by | Status |
|---|---|---|
| Scripted-provider software verification | the existing test suites and browser runs | done |
| Real Claude **transport and schema**: connectivity, response compatibility, JSON parsing, schema validation, error handling, evidence attribution | the smoke test (Tier 1) | **not run** |
| Real Claude **academic judgments** on synthetic text, flowing through findings, recommendations, the saved report and the faculty UI | one full evaluation (Tier 2), then targeted runs (Tier 3) | **not run** |
| **Academic accuracy** | faculty / VPAA review of the evidence documents | not established by any of this; needs people |

A valid, schema-conforming response is **not** evidence that a judgment is right. The evidence documents lay the model's words next to the source and target text so a person can
decide. The developer's "provisional expectations" in each fixture are a reading of the synthetic text, not the truth; a model that disagrees may be right.

## 2. Exact model and configuration

| Item | Value | Where it is enforced |
|---|---|---|
| Model | `claude-sonnet-5-5` (the only model the guard will send to; prices $2 / $10 / $0.10 per million tokens in / out / cache read, pinned in `anthropicClient.js`, as of 2026-10-27) | `providerGuard.js` (any other model, or an answer from another model, stops the run); `SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL` lock |
| Provider | `anthropic` direct API through the official SDK, fixed base URL, no custom headers, thinking adaptive (0 thinking tokens measured earlier) | `anthropicClient.js` |
| Profile | `SYLLABUS_CHECK_PROFILE=comprehensive-testing` resolves Policy V2 **on**, stages A, B, B3, B4, C1, C2, C3, D1, D2 **on**, requirements advice **on**; never enables Crossref lookups, a provider, a budget or a gate | `checkingProfile.js` (verified by `readiness.cjs`) |
| AI gate | `advisory`: the AI never blocks, approves, scores or rewrites | `policy.js` |
| In-app per-check cap | `SYLLABUS_CHECK_AI_MAX_COST_USD=17`, `SYLLABUS_CHECK_AI_MAX_REQUESTS=120` for the comprehensive scope (6 and 60 for V2 only). This is a **reservation ceiling**: each request is reserved at its worst case (16,000 output tokens) and never reconciled downward. It is **not** dollars spent | `createRequestBudget` (priority-planned: required work first) |
| Real-dollar cap | the evaluation guard's `max-real-spend-usd` (below) | `eval/providerGuard.js`, checked **before** each request leaves the process |
| Total Claude cap | the spend register, $10 for all Claude work of this project; **$2.92 already used, $7.08 remaining** | `spend-register.json` (a lock prevents two runs spending at once) |
| Provider-side limit | **you** must set a hard monthly limit in the Anthropic console for the key's workspace; `live.cjs` requires you to state its amount | cannot be verified from here |
| Concurrency | 1 (the shared cap is enforced serially) | `SYLLABUS_CHECK_AI_CONCURRENCY=1` |
| Database | none for Tiers 1 to 3 (in-memory); an isolated MariaDB with `max_allowed_packet` of at least 16 MB for any run that stores a report (Tier 4) | `docs/deployment/DATABASE-REQUIREMENTS.md` |

Official scoring (six weighted areas, pass line 79), the submission and approval gates, the seven VPAA relationship definitions and the four CLO classifications are code, not
configuration; nothing in this plan can change them.

## 3. Synthetic fixtures (no faculty or student data; a fictional course)

`fixtures/case-{a,b,c,d}.json`: a fictional "IT 204 Computer Programming 2" (object-oriented Java) with coherent weekly content, ILOs, activities and assessments, four CLOs at the four required
classifications, a fictional institution and five fictional program outcomes. Deterministic; a test fails if the committed files drift from the builder.

| Case | Purpose | What differs from Case A |
|---|---|---|
| A | well aligned | (baseline) |
| B | misaligned | weeks 2, 4, 7, 9, 13: catering content in a Java course, a bakery field trip for polymorphism, a poem as an ILO, a history essay for exception handling, a quiz on the wrong topic |
| C | CLO classification problems | only the four CLO statements: an expert-level statement labelled Introductory, a recall statement labelled Enabling, a definition labelled Demonstrating, a purely technical statement labelled Integration of Values |
| D | insufficient evidence | weeks 3, 8, 11, 16 ("Various topics", "Class activities", "Understand the lesson") and CLO 2 ("Appreciate programming") |

All four pass every deterministic gate offline, so the model really is asked.

## 4. Counted and estimated requests, tokens and cost

Request counts are **exact** (the real client path run offline). Tokens and dollars are **calibrated estimates** from earlier authorized runs (output per relationship: 309 for the
legacy staged contract, 758 for the V2 recommendation contract; 7.3 s per request), stated in `plan.cjs`. They are not limits.

| Run | Requests | Relationships | Input / output tokens (expected) | Real cost low / **expected** / high | In-app reservation |
|---|---|---|---|---|---|
| Smoke (1 request, 8 relationships) | 1 | 8 | about 9,200 / 6,100 (measured request: 32 KB) | $0.05 / **$0.08** / $0.12 | $0.25 |
| Full comprehensive, one case | 51 (19 scored, 11 V2, 21 optional); up to 66 | 151 legacy + 129 V2 | 561,960 / 158,182 (high 730,548 / 333,658) | $1.32 / **$2.07** / $5.28 | $13.3 (cap >= $17) |
| V2-only, one case (scored + 7 VPAA + 4 CLO, no optional stages) | 20; up to 26 | 98 legacy + 129 V2 | 144,434 / 136,982 | $0.95 / **$1.49** / $3.51 | $4.63 (cap >= $6) |

Duration: sent one at a time, about 6 to 8 minutes for a full comprehensive case, about 3 minutes for V2 only. The HIGH column is a pessimistic case (no prompt caching, 1.1 US-only factor,
30 % more requests); if reality approaches it, the **hard cap stops the run** and the unfinished relationships are reported NOT_CHECKED, never invented.

## 5. Proposed live-test sequence (each tier needs its own authorization)

| Tier | Run | Hard cap (real $) / requests | Expected | Stop rule |
|---|---|---|---|---|
| 0 | Clear the readiness blockers (section 7). Free. | | | `readiness.cjs` shows no FAIL/ACTION for the scope |
| 1 | **Smoke**, Case A, week 1 | $0.30 / 1 | $0.08 | any failed check, any error: stop and review |
| 2 | **One full comprehensive evaluation**, Case A | $3.50 / 80 | $2.07 | the guard stops at the cap or after 8 unproductive answers in a row |
| 3 | V2-only, Case B, then C, then D (one authorization each, after reviewing Tier 2) | $2.00 / 40 each | $1.49 each | as above |
| 4 | Real responses to the faculty UI and recommendations: render the stored run offline (free); Check & Improve / Accept / Edit / Reject / Undo with real answers needs a live app stack and about 6 requests (about $0.30) | to be set when authorized | | after Tier 2 |

Hard-cap total if Tiers 1 and 2 only: **$3.80** (expected $2.15). Tiers 1 to 3 hard caps would sum to $9.80, more than the **$7.08** left in the register: authorizing all of them needs the owner to
raise the register cap (a decision I will not make), or to authorize fewer. The expected total of Tiers 1 to 3 is about $5.13.

## 6. Exact commands

The runner refuses `--live` unless **every** one of these holds: `--confirm-paid`; `--authorization` equal to the phrase `--plan` prints for that exact run (model, request cap, dollar cap); `--provider-limit-usd`;
an Anthropic key in `--env-file` (parsed, never printed, never loaded into the environment); the approved model; empty evidence directory; room in the register. Tests prove each refusal.

```
node scripts/live-claude/live.cjs smoke --plan                                  # prints the exact phrase; no network, no key
node scripts/live-claude/live.cjs smoke --dry-run                               # whole path against a scripted provider
node scripts/live-claude/live.cjs smoke --live --confirm-paid --provider-limit-usd <your console limit> --env-file <env with the key> ^
     --authorization "I AUTHORIZE LIVE CLAUDE TEST smoke-case-a model=claude-sonnet-5-5 max-requests=1 max-real-spend-usd=0.30"

node scripts/live-claude/live.cjs full --case a --scope comprehensive --plan    # then --live ... with the printed phrase (max-requests=80, $3.50)
node scripts/live-claude/live.cjs full --case b --scope v2only --plan           # Tier 3
node scripts/live-claude/render-ui.mjs docs/checker-comprehensive/live/runs/<run>/stored-run.json    # the real run, as the faculty UI shows it (English and Filipino)
```

Evidence of a run: `docs/checker-comprehensive/live/runs/<run>/`: `result.json`, `provider-ledger.json` (every request, tokens, charge; no headers or key), `report.json`, `stored-run.json`, `EVIDENCE.md`
(or `SMOKE-REPORT.md`). `EVIDENCE.md` lists, for every VPAA instance and CLO classification, the source and target text the model saw, its label, cited quotations, explanation, recommendation and
status, and independently re-checks that each quotation appears **verbatim** in the text it was given (a quotation found nowhere is reported as possibly invented).

## 7. Staging readiness (audited against the real configuration, not assumed)

`node scripts/live-claude/readiness.cjs` against the current `server/.env` (the only environment that exists; there is no staging env file): **NOT READY, 4 failing and 11 needing a manual action.**

| Area | Finding |
|---|---|
| Provider, model, key form, approval lock, pinned prices | pass |
| Comprehensive profile (resolved) | pass: V2 on, 9 stages on, Crossref off, gate advisory. `SYLLABUS_CHECK_PROFILE` itself is unset in the dev file |
| In-app caps | unset (default 512 requests, no cost cap): the comprehensive scope needs **>= $17** reservation cap and about 80 requests |
| Database | the configured DB is the **development** database, user `root`, **empty password**; its `max_allowed_packet` is **1,048,576 (needs >= 16,777,216)**: a checking report is rejected. `report_json` is LONGTEXT (fine) |
| Host and auth | `NODE_ENV` unset; `CORS_ALLOWED_ORIGINS`, `TRUST_PROXY` and cookie settings not set for staging; `SYLLABUS_CHECK_ACADEMIC_V2` unset (the profile makes this unnecessary) |
| Credentials needing rotation or care | `DB_PASS` empty (never for staging); `SMTP_PASS` (Gmail app password pasted into a chat: revoke); `GEMINI_API_KEY` (pasted into a chat; a commented-out line still holds it: revoke and delete); the Anthropic key should be a **separate staging key** in its own workspace with a hard monthly limit |
| Saved-report compatibility | verified in the browser suites (older reports, and reports without the coverage manifest, still open) |
| Existing recommendation workflows | verified with the scripted provider (Check & Improve, Accept, Edit, Reject, Undo, stale-tab protection); with real answers: Tier 4 |
| Verified offline that a correct staging-shaped file passes | yes: a throwaway file with random secrets and a fake key reads READY (database skipped); a $10 cap with the profile is flagged |

## 8. What real Claude will be judged on (Phases 5 and 6)

* **Seven VPAA relationships**, 15 weekly instances each (105 per full run): VPAA-01 title and content, VPAA-02 content and ILO, VPAA-03 ILO and CLO, VPAA-04 content and activities, VPAA-05 ILO and activities, VPAA-06 content and assessment, VPAA-07 activities and assessment. Per instance a reviewer sees the source and target text, the label, the cited evidence, the explanation, the recommendation and the status, and whether anything was invented.
* **Four CLO classifications**: CLO1 Introductory, CLO2 Enabling, CLO3 Demonstrating, CLO4 Integration of Values. The structural check (stored label) is deterministic; the **semantic** check asks Claude whether the statement's meaning and expected competency fit the label. Case C is built to make a keyword- or verb-matching shortcut fail. The checker never rewrites a CLO.
* **Insufficient evidence**: Case D must come back as INSUFFICIENT_EVIDENCE / Not checked, not as invented support.
* **Official result**: score and 79 pass line unchanged by the advisory layer; no automatic approval or rewriting.

## 9. Remaining institutional dependencies (unchanged by any of this)

The eleven reserved rules (STR-07, ADM-04, ADM-05, CUR-10, CLO-05, CLO-10, PLAN-05, PLAN-06, ALN-03, ALN-04, ALN-10) stay **Not checked**, pending the VPAA's and Registrar's definitions. Value
definitions, the PO-EGA crosswalks for programs that lack one, APA/librarian confirmation, the 18-week calendar version and the partial-alignment rubric remain open items
(`docs/lcup-academic-decisions-for-vpaa.md`). Real-model academic accuracy needs faculty review of the evidence documents.

## 10. Blockers to paid testing, and the authorization needed

Blockers (all outside the code): a staging-grade database (or an isolated one) with `max_allowed_packet` >= 16 MB if reports are to be stored; a separate Anthropic key with a **provider-side hard
spending limit already set**; the in-app cap raised to 17 (a reservation ceiling) in the staging environment; rotation of the exposed credentials. For Tiers 1 to 3 as run by `live.cjs` the
database is not needed.

**Authorization required before the first paid request** (nothing is sent until you give it):

1. The model: `claude-sonnet-5-5`.
2. The tier, case and scope (recommended first: Tier 1 smoke, Case A).
3. The hard real-dollar cap and request cap for that run (the phrase `--plan` prints: $0.30 / 1 request for the smoke).
4. Confirmation that the provider-side limit is set, and its amount.
5. Which env file holds the key (a separate staging key is recommended; the development key exists in `server/.env`).
6. Whether the spend register cap ($10, $7.08 left) stays as it is.

After execution, a separate evidence-based report will be produced from `runs/<run>/`.
