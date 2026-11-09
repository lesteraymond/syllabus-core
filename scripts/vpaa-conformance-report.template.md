# VPAA Rule Conformance Testing: final report

Generated {{GENERATED}} on Node {{NODE}} by `scripts/vpaa-conformance-report.cjs`. Companion documents in this folder: [`POLICY-V2-ACTIVATION.md`](POLICY-V2-ACTIVATION.md) (staging and activation procedure), [`test-matrix.md`](test-matrix.md) (35 scenarios), [`coded-rules-coverage.md`](coded-rules-coverage.md) (47 rules), [`traceability-matrix.md`](traceability-matrix.md), [`results.json`](results.json) (every test result). How to run and how to read this: [`README.md`](README.md).

## Read this first: what these results do and do not show

This is **software conformance testing**, not an academic validation study. The tests run the production checking code against **controlled synthetic syllabi** with a **scripted model**: the model is a test double that returns whatever a scenario tells it to. A passing test therefore shows that *the software* builds each VPAA relationship from the correct fields, validates and refuses bad model answers, maps answers to the right disposition, keeps its evidence, never auto-applies a recommendation, fails safe when the AI is unavailable, and leaves the official score alone. **It does not show that Claude judges real syllabi correctly, and no accuracy percentage is claimed or implied.** No paid or live model call was made; any attempt at a non-loopback network call fails the suite. Software tests alone do not establish university-wide academic accuracy.

## Architecture decision implemented

**Policy V2 is the primary semantic path for all seven VPAA relationships, and it is advisory-only.** It adds no points, no deductions and no gate. It is **prepared but not activated**: it is OFF by default (`SYLLABUS_CHECK_ACADEMIC_V2`), no environment variable was changed, and the exact staging procedure is in [`POLICY-V2-ACTIVATION.md`](POLICY-V2-ACTIVATION.md). Outside the comprehensive testing profile, the shared service holds legacy Stage B and C3 off while V2 is on. The opt-in `comprehensive-testing` profile retains distinct Stage B plan-sequence checks and routes overlapping advisory relationships through V2. See [the comprehensive activation matrix](../checker-comprehensive/activation-matrix.md) for actual execution receipts; implementation or activation alone is not evidence of completed evaluation.

## Headline

| | |
|---|---|
| Conformance tests executed | **{{TOTAL}}** |
| Passed | **{{PASS}}** |
| Failed | **{{FAIL}}** |
| Open known issues (`todo`) | **{{KNOWN}}** |
| Regression run | {{REGRESSION}} |

Failed tests:

{{FAILED_LIST}}

{{KNOWN_TABLE}}

## 1. Coverage of the seven VPAA relationships

All seven are covered by five scenarios each (aligned, misaligned, partially aligned, insufficient evidence, adversarial): **{{REL_N}} scenarios, {{REL_PASS}} passed**. Beyond the scenarios the suite verifies, for **every lesson** of the sample under Policy V2: the exact source and target fields (Title ↔ Content uses the course code, title, program, year level, week and adjacent weeks, **never the description**), the relationship identifier format, one relationship per ILO or assigned CLO with unique ids, examination rows carrying no weekly obligation, that the direct ILO ↔ Assessment diagnostic is not an eighth required relationship, that CLO ↔ Course Description does not exist, independence (one failing link never changes another), that an empty or invisible-only side is never sent to the model, and that a V2 report is saved and read back whole.

**Activation is a configuration fact, measured in the tests (`VPAA-ACTIVATION`, `VPAA-V2-COVERAGE-REPORT`).** In today's default production configuration only ILO ↔ CLO and ILO ↔ Activities run (2 of 7). Policy V2 runs all seven by itself. With V2 off and Stage B and C3 on, the legacy stages also cover all seven. A report now says which of these it is (section 3).

## 2. Coverage of the 47 deterministic rules

All 47 rules of `standard-v4.json` were tested in isolation (valid, invalid and missing-field) and inside the full standard: **{{RULE_N}} rule tests, {{RULE_PASS}} passed**. Of the 47: {{CLASS_COUNTS}}. The following {{UNNAMED}} rules were not named by any pre-existing automated test (they may have been exercised indirectly); each now has explicit tests. In Hybrid-2 **44 of the 47** rules apply: C-04, R-02 and R-03 are replaced by link checks.

## 3. Reporting an incomplete check accurately

Every stored report carries `hybrid.semanticCoverage` (advisory data, never a score input) and the card shows a warning chip "VPAA relationships checked: N of 7", with the reason, only when the check is incomplete, in English and Filipino. Verified by `VPAA-V2-OFFLINE`, `VPAA-V2-COVERAGE-REPORT` and `VPAA-V2-UI-COVERAGE`: Policy V2 off gives 2 of 7 (`policy_v2_off`); Policy V2 on with the AI unavailable, refused, unapproved or out of budget gives 0 of 7 (`v2_not_evaluated`); some unverifiable answers give a partial count (`v2_partial`); an empty syllabus field names the affected relationships (`missing_evidence`). In every case the coded checks still run, no judgment is invented, and no official score is issued from an incomplete AI check.

## 4. Defects and gaps: resolution

| ID | Was | Resolution | Regression test |
|---|---|---|---|
| **DEF-05** | Enabling any `SYLLABUS_CHECK_STAGE_*` flag made the whole AI step fail through Re-Check (`history.get is not a function`, 0/N verified). | `gemini.js judgeBatch` uses `options.history` as the per-relationship map only when it is one. | `VPAA-T5-STAGES-VIA-SERVICE` |
| **DEF-01** | Text made only of zero-width or other invisible characters counted as written. | `shared/contentPresence.cjs` ignores those characters when deciding presence (authored text is never altered; real text containing one is still text; literal markers such as `**` still count). | `VPAA-PRESENCE-INVISIBLE`, `VPAA-PRESENCE-INVISIBLE-RULES` |
| **DEF-02** | A CLO with no saved classification silently skipped its classification check. | **Fail-safe kept**: it is still not judged and no classification is assumed. It is now reported with a specific reason (`clo_classification_missing`), names the CLO and the field, tells the author what to do, and is localized. CLO-08 still reports the missing label. | `VPAA-R8-BLANK-LABEL`, `VPAA-V2-UI-BLANK-CLO` |
| **DEF-03** | V2 reported live model calls that were never sent (budget 0 reported 1; budget 1 reported 2). | The count is the requests this evaluation sent, from the budget's own record relative to its start (the legacy run shares the budget). | `VPAA-R12-LIVECALLS`, `VPAA-R12-LIVECALLS-SHARED` |
| **DEF-04** | Verification tokens fell back to a hard-coded public signing secret. | Only a configured `SESSION_SECRET` of at least 16 characters signs or verifies a token; the old constant is refused even when supplied; with none, Check & Improve and a Policy V2 acceptance fail closed (503) before any AI request is spent. | `VPAA-R13-SECRET`, `VPAA-R13-SECRET-ROUTES` |
| **GAP-01** | The default path sent the course description with CLO relationships. **Determination:** it never created an excluded CLO ↔ Description *relationship* (no such pair exists); it was shared request context. | `SYLLABUS_CHECK_CLO_DESCRIPTION=off` withholds it from any request that carries a CLO relationship (and from their reuse key); the service sets it while Policy V2 is on. It is **unset by default**, so legacy-only requests are byte for byte unchanged (the existing alignment-10 pins prove it). | `VPAA-DESCRIPTION-EXCLUSION-LEGACY`, `-DEFAULT`, `-V2`, `-REUSE` |
| Duplicate evaluation | With V2 and Stage B/C3 both on, all seven relationships were asked twice (39 requests, not 29) and the same relationship was recommended twice. | While V2 is on the service holds Stage B and C3 off for the legacy run, and the merged recommendation list drops a V2 suggestion when the legacy path already offers one for that relationship. | `VPAA-V2-NO-DUPLICATES` |

**Deliberate design choice, not a defect.** ILO ↔ CLO and ILO ↔ Activities are asked by both paths: the legacy path scores them (official deductions, which must not change) and V2 judges them advisorily with the CLO classification context. They are reported in separate sections, and the recommendation list keeps one recommendation per relationship.

## 5. Test results by suite

{{BY_FILE}}

Suites by purpose: relationships and scenarios → `relationships.conformance.test.js`; CLO classifications → `clo-classification.conformance.test.js`; the 47 rules and scoring → `coded-rules.conformance.test.js`; pipeline, quotations, context → `hybrid-pipeline.conformance.test.js`; workflow, persistence, gates → `workflow.conformance.test.js`; AI failure → `ai-failure.conformance.test.js`; recommendation actions and tokens → `recommendation-actions.conformance.test.js`; Policy V2 primary path, duplicates, parity, coverage, budget, gates, staging configuration → `v2-primary.conformance.test.js`; saved-report rendering → `tests/vpaa-conformance-ui.test.jsx`.

## 6. Official scoring parity

Policy V2 and these fixes changed no score, threshold, deduction, rule or gate. Evidence:

- `VPAA-V2-SCORE-PARITY`: with V2 off versus V2 on (and Stage B and C3 on), the official result is identical for five scripted situations (all aligned; a scored ILO ↔ CLO failure; a scored ILO ↔ Activities partial; an advisory Title ↔ Content failure; everything failing): score, overall, status, pass, pass mark, base score, deductions with their points, readiness, conformance, area scores and findings. The test requires real deductions in at least three cases, so it cannot pass vacuously.
- `VPAA-V2-BASELINE-PARITY`: the official deterministic result of the **six recorded real-syllabus baselines** (IT 202, IE 402 and CpE 304, two scenarios each) is identical field by field to what was recorded before these changes (base score, findings, checks, no official score issued).
- `VPAA-V2-GATES`: the submit gate (hard gates, critical course code, advisory pass) behaves identically with V2 on and off.
- `VPAA-R10-*`: the pass mark of 79, the three bands, the six weighted areas, "a blocking failure overrides the score", and the authorized deductions (alignment 3, partial 1, link 2, value 1, advisory relationships 0) are asserted unchanged.
- The one change that touches an input to the model is GAP-01, and by design it applies only when `SYLLABUS_CHECK_CLO_DESCRIPTION=off`, which the service sets while V2 is on. With V2 off the requests are byte for byte unchanged.

## 7. Files changed in this phase

Production code: `server/lib/syllabuscheck/gemini.js` (DEF-05; GAP-01 switch), `server/lib/syllabuscheck/refine.js` (DEF-04), `server/routes/syllabusCheck.js` (DEF-04 fail-closed responses), `server/lib/syllabuscheck/academicPolicyV2.js` (DEF-03; DEF-02 reason text and criterion note), `server/lib/syllabuscheck/academicV2Plan.js` (DEF-02 reason), `server/lib/compliance/service.js` (duplicate prevention, GAP-01 switch while V2 is on, coverage), `shared/contentPresence.cjs` (DEF-01), `src/views/ComplianceCard.jsx` (coverage chip), `src/components/AcademicEvaluationPanel.jsx` (localized missing-classification message), `src/i18n/hybrid.js` and `src/i18n/academicV2.js` (English and Filipino strings). New: `server/lib/syllabuscheck/semanticCoverage.js`.

Phase 3 (staging preparation) added: `server/lib/sessionSecret.js` (new), `server/index.js` (the session secret), `server/lib/syllabuscheck/refine.js` (uses the shared secret rule), `scripts/credential-readiness.cjs` and `scripts/vpaa-v2-preflight.cjs` (read-only), `server/lib/sessionSecret.test.js`, the suites `security`, `staging-config` and `staging-rehearsal` under `vpaa-conformance/`, `docs/vpaa-conformance/POLICY-V2-ACTIVATION.md` (corrected), `CREDENTIAL-READINESS.md` and `STAGING-TEST-PLAN.md`.

Not changed: the 47 rules and their weights, the pass mark, the areas, the deductions, any prompt text or prompt version, any schema, the database, the environment files, the Re-Check API shape, authorization, and the institutional CLO classifications.

Tests and tooling: the conformance suites under `server/lib/syllabuscheck/vpaa-conformance/`, `tests/vpaa-conformance-ui.test.jsx`, `scripts/test-vpaa-ui.mjs`, `scripts/vpaa-conformance-report.cjs` (+ template), `scripts/vpaa-v2-preflight.cjs` (read-only), `package.json` (test registration), and five existing suites that sign verification tokens now configure a `SESSION_SECRET` as a real server has (`provider-safety`, `system-e2e`, `v2-recommendation-actions`, `v2-recommendation-safety`, `syllabusCheck.refine.routes`).

## 8. Regression results

{{REGRESSION}}.

## 9. Unverified semantic behavior

Not tested, by design: whether Claude Sonnet 5.5 labels real syllabus text correctly for any of the seven relationships; whether its recommended rewrites are good; how it behaves on adversarial text beyond the scripted cases; and whether faculty agree with its judgments. The 35 scenarios fix what the *software* does with an answer, not what the *model* answers. Seven scenarios (the "partially aligned" case of each relationship) have **no official expected label** and are marked *requires rubric clarification*. A live Claude run needs explicit authorization and a paid budget and was not done.

## 10. Staging preparation, security, risks and decisions

**The four levels.** SOFTWARE CONFORMANCE VERIFIED: yes. STAGING CONFIGURATION READY: the configuration is documented and verified against the code; the environment it describes still needs manual steps (credentials, a staging database, `NODE_ENV=staging`, host settings). LIVE PROVIDER TESTED: no. PRODUCTION APPROVED: no. Details: [`STAGING-TEST-PLAN.md`](STAGING-TEST-PLAN.md), [`CREDENTIAL-READINESS.md`](CREDENTIAL-READINESS.md).

**Security work in this phase.** The session secret no longer falls back to a public constant: with `NODE_ENV=staging` or `production` `server/index.js` refuses to start (before it opens a database connection or a port) when `SESSION_SECRET` or `JWT_SECRET` is missing or not acceptable, and never prints what was configured; otherwise a random per-process secret is used. The verification-token secret follows the same single rule. A read-only credential report lists what must be rotated by hand and never prints a value. Tests: `VPAA-SEC-*` (the real server is started and must exit; the reports are run against sentinel secrets and must leak no fragment) and `server/lib/sessionSecret.test.js`.

**Staging configuration verified against the code (`VPAA-STG-*`).** The tests parse the configuration block out of `POLICY-V2-ACTIVATION.md` and run on exactly that. Found and corrected while doing so: the documented cost cap (`1.50`) would have stopped a check after 7 of its requests (the cap reserves the maximum possible output per request, about $4.5 for the 20-request check of the synthetic sample at the default output limit, measured; it is now documented with an explanation and set to `10`); the request counts in the document were measured under test-speed settings (they are now the measured 20 requests, 9 legacy and 11 V2, under the documented environment); the retry and failure behavior is documented as measured (for example `ANTHROPIC_MAX_RETRIES` outside 0 to 3 is ignored, not clamped; a failing provider costs 9 requests at concurrency 1, 15 at the default 3).

**Host configuration (`VPAA-HOST-*`, VR-20).** The API used to allow one hardcoded origin (`http://localhost:5173`), set no `Secure` flag on the session cookie, set it on the remember-me cookie only when `NODE_ENV=production` (so never in staging), trusted no proxy, and had no cross-site request protection. It now reads `CORS_ALLOWED_ORIGINS`, `TRUST_PROXY`, `SESSION_COOKIE_SAMESITE` and `SESSION_COOKIE_SECURE` through `server/lib/hostConfig.js`. Development keeps `http://localhost:5173`; staging and production require an explicit https origin list and a proxy hop count, refuse a wildcard, `null`, a path, or a trailing slash, force `Secure`, and stop the server with a message that names the setting (never a secret). Both cookies are `HttpOnly`. State-changing requests from an origin that is not allowed (including `Origin: null` and a browser-declared cross-site request with no `Origin`) are refused with HTTP 403 before the session or body parsers run, which also closes cross-site form posts that CORS alone does not stop. The tests run the real middleware, the real `express-session`, the real remember-me issuing code and the real syllabus-check router on a real HTTP listener, with the scripted provider and the in-memory database. No staging domain is invented anywhere.

**Staging readiness of the environment.** The read-only checks exit non-zero on the current development `server/.env`, correctly: `NODE_ENV=staging` and the Policy V2 flag are unset, `DB_PASS` is empty, and two credentials known to have been shared in chats are still live. What staging must still show, and these tests cannot: real cost per check, real Claude behavior, a real database.

**Staging readiness: ready for an authorized test.** The code path is implemented and verified offline; the configuration is documented exactly in `POLICY-V2-ACTIVATION.md`; `node scripts/vpaa-v2-preflight.cjs --env-file <file>` checks it without printing a secret or sending a request. Against the current `server/.env` the only missing required item is the Policy V2 flag itself (plus two recommended spending caps). What staging must still show, and these tests cannot: the real cost per check (estimated at roughly twice a legacy check), real Claude behavior, and a real database.

**Remaining production risks.**

1. **Policy V2 is unvalidated against real Claude output.** All evidence is scripted. Activating it without a staging run risks surprises in cost and in verdicts.
2. **Cost doubles** when V2 is on (the legacy path still runs for the official score). The per-check request and cost caps are not set in the current environment (the default is 512 requests and no cost cap).
3. **GAP-01 in legacy-only mode.** With V2 off the description is still sent with CLO relationships, by design, because changing it would alter the input to Claude for scored relationships without a validation.
4. **Host settings.** `server/index.js` allows only the CORS origin `http://localhost:5173` and does not set the cookie `secure` flag; a real https staging host needs both adjusted first. (The session-secret fallback that used to be here is fixed.)
5. **Replay protection is per-process memory**; a restart forgets used tokens (the 15-minute expiry bounds it).
6. **Credentials shared earlier must be rotated by a person:** the Gmail app password and the Gemini key (the latter still sits in a commented-out line), and the development database has an empty password and an administrative user. Nothing was rotated by this work.

**Decisions that are not the software's to make.** (1) Authorization to activate Policy V2, and where first. (2) A rubric for "partially aligned" per relationship. (3) Whether legacy-only mode should also withhold the description. (4) C-04, R-02 and R-03 replaced by link checks in Hybrid-2: is a minimum reference count still required? (5) CLAR-01: should Accept outside Policy V2 also require a Check & Improve token? (6) LIM-01: should placeholder text lose presence credit (this would change official scoring)? (7) The spending caps for staging and production.
