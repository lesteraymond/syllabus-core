# AI Checker offline audit, 2026-11-12

Read-only audit of the AI Checker pipeline and its evaluation scripts, offline only: no provider request, no database, no paid run, no `.env` value read (setting names only). It re-checks the 13 findings of the 2026-10-30 audit (F-01 to F-13) against the current code and adds what this session found. Two defects found during the audit were fixed earlier the same day with the owner's approval (section 3); nothing else was changed.

## 1. Verdict

**Not ready to call finished, and no critical defect found.** The plumbing is sound and well tested offline: a failed or missing AI answer never becomes a pass, the AI cannot approve or change a status, reused answers are keyed to the exact prompt, model and text, and model output is schema-checked. What remains open is one conflict with the owner's alignment rules (A-1), a cost exposure (A-2), the Policy V2 decision (A-3), and the fact that the real model has never run the full pipeline end to end.

## 2. Open findings

| ID | Severity | Finding | Evidence | Recommended action |
|---|---|---|---|---|
| A-1 (was F-05) | **HIGH (rule conformance)** | **CLO judgments are sent the course description by default**, which the owner's rule M14 forbids ("CLO judgments never use the course description"). The description is removed from CLO questions only when Policy V2 is on, `SYLLABUS_CHECK_CLO_DESCRIPTION=off`, the `rules-aligned` prompt variant is chosen, or `SYLLABUS_CHECK_COURSE_CONTEXT=scoped`. The default variant is `current` and none of those is set by default. | `server/lib/syllabuscheck/gemini.js` lines 538-551 (`cloDescriptionOff`, `userMessageOf`); `variants.js` line 42 (default `current`) | Make "no description in CLO questions" the default. This changes what the AI is asked and so its verdicts and the prompt version: it needs the owner's approval and an offline replay plus a small paid evaluation before release. Your `server/.env` names `SYLLABUS_CHECK_COURSE_CONTEXT`; if its value is `scoped`, this machine already complies, a fresh install does not. |
| A-2 (was F-09) | **MEDIUM-HIGH (cost)** | **No per-check spending limit by default.** `SYLLABUS_CHECK_AI_MAX_COST_USD` is unset in `server/.env`, not in `.env.example`, and only in a comment in `production.env.template` (the staging template sets $10). Without it one check is bounded only by 512 requests and an 8,000,000-token reservation: at Claude Sonnet 5.5 prices, about $16 if all input and up to about $80 if all output. The daily ceilings added today (40 checks per person, 400 in all) bound the count, not the cost of each. | `gemini.js` lines 728-731 (`createRequestBudget`); `docs/deployment/production.env.template` line 25 | Give the per-check cost cap a default (for example $2) that cannot be turned off in staging and production, and put it in `.env.example` and both templates. No change to what the AI is asked. |
| A-3 (was F-03) | MEDIUM (owner decision) | **Policy V2 is off**, so of the seven VPAA relationships, four are not evaluated and one is advisory in the default configuration. V2 has no approved model and has never had a live staging test. | `SYLLABUS_CHECK_ACADEMIC_V2` absent from `server/.env`; `=off` in `production.env.template` | Decide whether V2 is the target; if so, re-prepare its evaluation data (stale since the 2026-10-29 CLO-classification change) and run the authorized staging test. |
| A-4 (was F-04) | MEDIUM | A course description longer than 3,000 characters turns every Content-course and Description-plan relationship into NOT_CHECKED in Policy V2. | `academicV2Plan.js` line 98 | Send a bounded excerpt instead of skipping, or tell the author why the check was skipped. |
| A-5 (was F-08) | LOW-MEDIUM | One AI check at a time for the whole server (and one "Check & improve"): a person re-checking in a loop delays every reviewer. | `server/routes/compliance.js` line 44; `syllabusCheck.js` line 164 | A per-user lock plus a small server-wide concurrency limit. |
| A-6 (was F-07) | LOW (by design) | Under the advisory gate (the default), a submission stores the coded v4 check, not the hybrid AI result. | `server/routes/syllabusContent.js` line 404 | Keep, or store the latest hybrid result alongside; owner decision. |
| A-7 (was F-06) | not re-checked | Mixed CLO mappings softened. | (2026-10-30 audit) | Re-check when A-1 is worked on. |
| A-8 | **unverified** | **The real model has never run the full pipeline.** The 2026-11-09 real-Claude test stopped early (now fixed: `max_tokens` defaults to 16,000) and Policy V2 never ran; the suggestion-order and whole-syllabus plan changes were never tried with real Claude. All tests use scripted or replayed answers. | `anthropicClient.js` line 41 | One authorized paid run on synthetic syllabi only, with a budget you set. |

## 3. Resolved

| ID | Finding | Status | Evidence |
|---|---|---|---|
| F-01 | A 240-relationship refusal for the whole check | **Gone.** The check is now bounded by the per-check budget (512 requests, 8M tokens); a refused scored relationship is reported not evaluated, never a pass. Not exercised with a very large syllabus. | `gemini.js` lines 728-790 |
| F-02 | Policy V2 recommendations could not be accepted | **Fixed.** The decisions and refine routes accept V2 suggestions. | `server/routes/syllabusCheck.js` lines 96-101, 171-176 |
| F-11, F-13 | Session, CORS, demo-account hardening | **Fixed** in the security batches (`docs/security/SECURITY-AUDIT-REPORT.md`). | |
| F-12 | `official-po-migration.cjs` untracked | **Tracked** now. | `git ls-files server/db/official-po-migration.cjs` |
| N-1 | Improvement plan proposed Logic Circuits topics for every course | **Fixed today** (v1.82.2): built from the syllabus's own title and CLOs, marked for faculty review. Off unless `SYLLABUS_CHECK_COORDINATED_PLAN=on`. | `coordinatedPlanEngine.js` `onTopicDraft`; 3 new tests |
| N-2 | Evaluation `--legacy` was not the legacy request on a machine whose env file switches on the requirements advice or the scoped course context; 7 tests failed for the same reason | **Fixed today** (v1.82.1). | `scripts/eval-alignment.cjs`, `scripts/live-pipeline-eval.cjs`, `eval/neutralCheckerEnv.js` |
| N-3 | Claude Sonnet 5.5 cache-read price possibly wrong ($0.10 vs $0.20) | **Not a defect.** Anthropic's reference lists Sonnet 5.5 at $2 input, $10 output, cache reads $0.10, as the code has. | `anthropicClient.js` line 77 |

## 4. Checked and sound

- **Failures never pass.** Tests pin it: a provider failure gives no verdict, deduction or suggestion and leaves the check incomplete; INSUFFICIENT_EVIDENCE costs no points and gives no rewrite; timeouts, rate limits, invalid replies and an unconfigured provider are reported as not evaluated (for example `stage-e8.test.js`, `reliability.test.js`, `anthropic.test.js`).
- **The AI cannot approve or change a status.** Every status write is in a route behind role checks (`syllabi.js`, `syllabusContent.js`, `reviewChain.js`); model output is data.
- **Reuse is exact.** A reused answer is keyed by provider, model, prompt version, course context and the relationship text (`gemini.js` line 1112); answers marked unverified or INSUFFICIENT_EVIDENCE are never reused (`repository.js` line 119).
- **Output is validated.** Strict JSON schema with `additionalProperties: false` (`gemini.js` line 106), `validate` and `salvage` (lines 452, 472).
- **Scores.** The official score is the engine's; the AI Alignment Score in `scoring.js` is a shadow score and never replaces it.
- **Prompt injection.** Text addressed to the AI is flagged to reviewers (SEC-20) without changing what is sent or scored.
- **Paid evaluations are guarded.** `--confirm-paid`, a request budget, a cost cap, a ledger and a $10 total register (currently $2.92 charged); the guard charges cache reads at no less than 0.1x the input price.

## 5. Offline runs

| Suite | Result |
|---|---|
| `npm test` | 2,438 of 2,438 |
| VPAA conformance (`server/lib/syllabuscheck/vpaa-conformance`) | 276 of 276 |
| `scripts/test-vpaa-ui.mjs` | 28 of 28 |
| `scripts/test-pdf-import-ui.mjs` | 16 of 16 |
| `scripts/test-po-reference-ui.mjs` | 5 of 5 |
| `scripts/test-localization.mjs`, `scripts/audit-i18n.mjs` | passed: 2,839 bilingual keys, no hard-coded display strings |
| `npm run build` | passes |

## 6. Not examined

Whether the AI's alignment judgments are accurate, whether the scoring follows the VPAA rules item by item, and whether recommendations are academically sound: these need faculty review of real cases and paid runs. F-06 was not re-checked. No live provider, database or browser E2E was used.

## 7. Recommended order

1. **A-2 per-check cost cap** (small, no change to what the AI is asked).
2. **A-1 CLO questions without the course description** (owner approval; offline replay, then a small paid evaluation).
3. **A-8 one authorized paid end-to-end run** on synthetic syllabi.
4. **A-3 the Policy V2 decision**, then A-4 and A-5.
