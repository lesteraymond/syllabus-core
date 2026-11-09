# Engineering report: staging and production readiness (phases 1–6)

Date of the evidence: 2026-11-05. Nothing is committed, pushed or deployed. No paid or external model request was made. The baseline figures from the earlier report were treated as claims and re-measured below.

**Status labels:** VERIFIED · IMPLEMENTED BUT NOT VERIFIED · BLOCKED · NOT STARTED · REQUIRES OWNER ACTION · REQUIRES AUTHORIZATION

## Readiness decisions

| Decision | Status | Why |
|---|---|---|
| CODE READY | **VERIFIED**, one open defect | 1,949 repository tests, 222 conformance tests, build, and a 17-scenario real-browser run all pass; the open defect is the missing Undo control (section 7) |
| SECURITY READY | **REQUIRES OWNER ACTION** | login is not rate limited; sessions use MemoryStore; two credentials exposed in chats are still live; no security headers set by the app (section 3, 13) |
| STAGING CONFIGURATION READY | **REQUIRES OWNER ACTION** | templates, validation and preflight are done; the real staging file does not exist, and the preflight on the development file reports 3 missing items, as it should |
| STAGING HOST READY | **NOT STARTED** | no staging host, domain, proxy or database exists |
| STAGING E2E VERIFIED | **NOT STARTED** (LOCAL E2E VERIFIED) | the browser run used a local staging-like stack, labeled LOCAL E2E |
| LIVE CLAUDE TEST READY | **REQUIRES OWNER ACTION** | the code and the plan are ready; the environment, key, provider spend limit and written authorization are not |
| LIVE CLAUDE TESTED | **REQUIRES AUTHORIZATION** — LIVE TEST PENDING AUTHORIZATION | no request has been sent to Anthropic |
| PRODUCTION READY | **NOT READY** | section 16 |
| INSTITUTIONALLY APPROVED | **REQUIRES AUTHORIZATION** | technical verification is not academic accuracy or institutional approval |

## 1. System architecture assessment (phase 1) — VERIFIED

The workflow Faculty authentication → Syllabus Builder → save → AI Checker → findings and recommendations → corrections → submission → administrator review → approval → Repository was driven in a real browser (E01–E11) and works as designed. The browser calls the API directly (cross-origin, credentials included) at `VITE_API_URL`; the API authorizes from the session cookie. Components confirmed working: authentication and remember-me, builder Step 1 and save/reload persistence, the shared hybrid checking service, Policy V2 panel, recommendations, review chain (Dean → Asst. VPAA → LIC Director → VPAA), repository, English/Filipino. Risks: a single-process API with in-memory sessions, local-disk uploads, long synchronous checks. Details: `STAGING-ARCHITECTURE.md`.

## 2. VPAA conformance results (phase 2) — VERIFIED

`npm run test:vpaa`: **222 passed, 0 failed, 0 skipped, 0 todo** (212 server suites + 10 UI). The 47 deterministic rules (`standard-v4.json`: 47 rules, `passThreshold` 79; the file is unmodified) and the six weighted areas are unchanged. Official scoring parity with Policy V2 on and off was re-proved through the real application (E15): identical overall score, areas and findings, threshold 79 in both. Policy V2 stays advisory ("has no effect on the official score, deductions, passing mark or submission gate" is shown in the UI and asserted by E03/E05). All seven relationships were evaluated and rendered (E03/E05). Failure handling through the real endpoint (E12): provider outage, 401, 429 and an invalid answer each left the official result unchanged and reported coverage `0 of 7` with a reason; a first-ever check with the AI down shows "Verification incomplete / no final AI score yet / AI unavailable", never a pass.

## 3. Security verification (phase 3)

| Severity | Finding | Evidence | Status |
|---|---|---|---|
| HIGH (production) | **Login has no rate limit**; only forgot-password, compliance, PDF import, refine and resend are limited | `server/routes/auth.js` uses `createLimiter` only for `forgot` | REQUIRES OWNER ACTION (decision: per-IP/per-account limiter, or proxy-level limiting) |
| HIGH (production) | Exposed credentials (Gmail app password, a Gemini key still in a commented line) | `node scripts/credential-readiness.cjs`: 3 manual actions | REQUIRES OWNER ACTION (revoke; nothing was rotated) |
| MEDIUM | MemoryStore sessions | `server/index.js` | REQUIRES OWNER ACTION (decision in `STAGING-ARCHITECTURE.md` section 4) |
| MEDIUM | No security headers (HSTS, CSP, frame options) from the app | no helmet; static site served elsewhere | set at the proxy/static host; REQUIRES OWNER ACTION |
| FIXED | `init.js` inserted demo accounts with known passwords into any database | `seed.sql`; now skipped for `NODE_ENV=staging|production`, plus `db/create-admin.js` | VERIFIED (`npm run test:db-bootstrap`) |
| OK | secrets fail closed, no printing, token forging/replay, ownership, role checks, SQL parameterization (dynamic fragments are constants), XSS (`renderMarkup` escapes before markup) | conformance suites, E04, E11, code review | VERIFIED |

Cross-user and cross-role checks in the browser run: another faculty member gets 404 on a syllabus and cannot write; signed-out callers get 401 on every protected API; a faculty account gets 403 on administrator APIs; a Dean cannot approve (403); the VPAA cannot approve before the AI check (409) or before the three stages clear (409). Manual steps to revoke the Gmail and Gemini credentials: `docs/vpaa-conformance/CREDENTIAL-READINESS.md`.

## 4. Staging host configuration (phase 4) — VERIFIED offline

Re-verified by `host.conformance.test.js`, the fail-closed matrix, E01 (cookies HttpOnly + Secure + SameSite=Lax over https; CORS answers only the configured origin with credentials) and the smoke test (E17). No domain is hardcoded. Hosting topology: the repository contains no hosting configuration; the "selected hosting providers" are not named anywhere, so compatibility with a specific provider **could not be verified**. The requirements to check a provider against are in `STAGING-ARCHITECTURE.md` section 2 (the API cannot run unchanged on serverless platforms).

## 5. Staging infrastructure status — NOT STARTED / REQUIRES OWNER ACTION

Prepared: `docs/deployment/STAGING-ARCHITECTURE.md`, `staging.env.template`, `production.env.template`, `RUNBOOK.md`, the setup checklist, `scripts/smoke-test.cjs`. Not provisioned: host, proxy, certificate, domain, database, secrets.

## 6. Credential readiness

`node scripts/vpaa-v2-preflight.cjs --env-file server/.env` → NOT READY, 3 required items (Policy V2 flag, `NODE_ENV=staging`, host settings) — correct for a development file. `credential-readiness.cjs` → 3 manual actions. Environment files (`server/.env`, `.env`) were not written by any command of this work; nothing was printed or rotated.

## 7. Browser E2E results — LOCAL E2E, VERIFIED

`npm run test:e2e`: **17 scenarios passed, 0 failed; 233 of 234 checks passed; 1 known application defect recorded; 153 requests, all answered by the scripted double; 0 requests left the machine.** Real Edge, the production React build over https, a TLS proxy, the real server as `NODE_ENV=staging`, a scratch database built from `init.js` + 24 migrations, synthetic data. Covered: authentication and cookies (E01); builder Step 1 form validation and save/reload (E02; Steps 2–6 saved through the real API); checker, score, seven relationships (E03, E05); submit and locking, authorization (E04); administrator read-only content and return for revision (E05–E06); recommendation actions and re-check and resubmit (E07–E09); full review chain to VPAA approval and repository (E10–E11); AI offline (E12); English/Filipino (E13); 375/768/1024/1440 px, no horizontal overflow (E14); scoring parity (E15); no network (E16); smoke test (E17). Report and screenshots: `docs/vpaa-conformance/e2e/`.

**Defects found by the browser run.** Fixed: **(a)** *Accept* on the AI Checker page sent the whole stored content and was refused by the server with HTTP 400 `Unknown section "schemaVersion"`, so no recommendation could be applied from that page (`src/lib/draftSave.js` `sectionsOf`, `src/views/AIChecker.jsx`; tests added). **(b)** With Policy V2 integrated, the recommendation card enabled *Accept* before *Check & improve*, saved the draft and then had the decision refused (HTTP 409), leaving a changed draft with no recorded decision (`HybridCheckPanel.jsx` now waits for verification, as the Policy V2 panel does). Open: **E2E-02** — no *Undo* control is rendered for an applied recommendation (`undoSuggestion` and the API support it; no panel calls it; the committed HEAD has none either). Restoring the text and recording the undo works through the API (asserted). Adding the control is a UI addition, so it is left for the owner's decision.

## 8. Policy V2 integration results — VERIFIED (scripted provider)

Through the real Re-Check API and shared service: seven relationships evaluated with the right source/target fields and rendered; findings and one correctable recommendation with Check & improve, Accept, Reject; saved-report persistence across reload; no duplicated recommendation cards; legacy scored checks operational; missing evidence reported; AI-unavailable never reported as verified; parity with V2 off. Per relationship detail: `docs/vpaa-conformance/test-matrix.md`, `traceability-matrix.md`.

## 9. Live Claude testing status — LIVE TEST PENDING AUTHORIZATION

Phase 5E preconditions: (1) staging environment exists — **BLOCKED**; (2) HTTPS connectivity — **BLOCKED** (local https verified only); (3) authentication — VERIFIED locally; (4) database isolation — VERIFIED locally (scratch database refusals), **BLOCKED** for staging; (5) staging credentials — **REQUIRES OWNER ACTION**; (6) Anthropic staging key — **REQUIRES OWNER ACTION**; (7) provider-side spend limit — **REQUIRES OWNER ACTION**; (8) preflight passes on the staging file — **BLOCKED** (file missing; the documented block passes); (9) synthetic cases approved for transmission — **REQUIRES AUTHORIZATION**; (10) request and retry budgets — VERIFIED in tests (120 requests, 20 for the synthetic check; retry facts measured); (11) rollback — prepared (`RUNBOOK.md`); (12) written authorization — **REQUIRES AUTHORIZATION**. The in-app cost cap is a reservation guard (reserves about $4.5 for the 20-request check) and is not a billing ceiling. When run, record request count, tokens, cost, schema validity, coverage, evidence quotes, missing-evidence handling, recommendations, score parity and saved-report correctness, and report API-integration success separately from academic accuracy (`STAGING-TEST-PLAN.md`).

## 10. Official scoring parity — VERIFIED

E15 plus `VPAA-V2-SCORE-PARITY`, `VPAA-V2-BASELINE-PARITY`: identical official result with Policy V2 on and off; threshold 79; submission and approval gates unchanged (E10 gates asserted).

## 11. Database readiness

`npm run test:db-bootstrap` — VERIFIED on a scratch database: `init.js` (after fixing a `;` inside a comment of `schema.sql` that made `npm run init-db` fail on every new database) plus 24 migrations produce 39 tables and all 18 required ones; re-running the migrations is safe (23 of 24 exit 0; the 24th correctly reports an empty-database condition). The development database has 9 unused tables and 2 unused columns that a new database does not need. Backup, restore test, least-privilege users, staging/production isolation: prepared in `RUNBOOK.md`, **REQUIRES OWNER ACTION**. No production migration was run; development data was never read or changed (the development database name appears nowhere in the E2E path).

## 12. CI/CD readiness — IMPLEMENTED BUT NOT VERIFIED

`.github/workflows/ci.yml`: install, `npm test`, `npm run test:vpaa`, `npm run build`, and a MariaDB-backed database bootstrap job. It was never run on GitHub; it deploys nothing. The browser E2E is not in CI (it needs a Chromium and parameterized database settings). Staging and production approval gates are procedural (`RUNBOOK.md` section 0), not configured in a CI system. No automatic production deployment exists.

## 13. Production security assessment — NOT READY

Open: login rate limiting; exposed credentials; session store decision; security headers; first administrator (now `db/create-admin.js`, VERIFIED); demo accounts (no longer inserted by `init.js` in staging/production; **remove them from any existing database** by hand); least-privilege database user; HTTPS enforcement and HSTS at the proxy; audit-log retention policy.

## 14. Monitoring plan — IMPLEMENTED BUT NOT VERIFIED

`GET /api/health` added and tested (public, reveals only status and database state); the rest is a plan using existing tables and the provider workspace: `MONITORING.md`. Nothing is configured on a host.

## 15. Backup and rollback procedures — prepared, not exercised

`RUNBOOK.md`: Policy V2 flag, application, environment, database restore (explicit authorization), credential revocation, provider shutdown. No backup was taken and no restore was tested: **REQUIRES OWNER ACTION**.

## 16. Remaining risks and blockers

1. No staging environment, host, certificate or database. 2. Exposed Gmail/Gemini credentials not revoked. 3. Login not rate limited. 4. MemoryStore sessions. 5. No live Claude test, so real model behavior, real cost and schema validity on real answers are unknown; academic accuracy is unvalidated. 6. Undo control missing (E2E-02). 7. CI never run. 8. Hosting provider unnamed, compatibility unverified. 9. Backup/restore untested. 10. Institutional open items (partial-alignment rubric, legacy-only CLO description default, placeholder text earns presence credit, Accept outside V2 needs no token). 11. 64 uncommitted paths in the working tree (git status entries; nothing committed).

## 17. Exact files modified in this phase

**New:** `server/routes/health.js` (+`.test.js`), `server/db/create-admin.js` (+`.test.js`), `server/db/schema.test.js`, `scripts/smoke-test.cjs`, `scripts/e2e/{lib,stack,seed-e2e,offline-provider,run-e2e,scenarios,report,db-bootstrap-check}.cjs`, `.github/workflows/ci.yml`, `docs/deployment/{STAGING-ARCHITECTURE,RUNBOOK,MONITORING,ENGINEERING-REPORT}.md`, `docs/deployment/{staging,production}.env.template`, `docs/vpaa-conformance/e2e/` (report, results, 16 screenshots).
**Changed:** `server/index.js` (mounts `/api/health`), `server/db/init.js` (no demo seed in staging/production), `server/db/schema.sql` (one comment: two semicolons), `src/lib/draftSave.js` (+test), `src/views/AIChecker.jsx`, `src/components/HybridCheckPanel.jsx`, `package.json` (scripts `test:e2e`, `test:db-bootstrap`; new tests registered; devDependency `playwright-core` 1.64.1, no browser download), `package-lock.json`, the generated conformance documents.
Not changed: the 47 rules, scoring, threshold 79, VPAA rules, Policy V2, the UI design, `server/.env`, `.env`, any real database.

## 18. Test execution evidence

| Run | Result |
|---|---|
| `npm test` | 1,949 passed, 0 failed, 0 skipped, 0 todo |
| `npm run test:vpaa` | 222 passed (212 server + 10 UI), 0 failed, 0 skipped, 0 todo |
| `npm run build` | exit 0 |
| `npm run test:e2e` (LOCAL) | 17/17 scenarios; 233/234 checks; 1 known defect; 153 scripted requests; 0 blocked |
| `npm run test:db-bootstrap` | 24 migrations, 39 tables, 0 problems |
| `scripts/smoke-test.cjs` against the local https stack | passed (E17) |
| preflight on `server/.env` | NOT READY, 3 items (correct) |
| credential report | 3 manual actions |
| CI workflow | not run |

## 19. Required manual actions

Revoke the Gmail app password and the Gemini key (and delete the commented line); provision the staging host, proxy, certificate, database and user; generate staging secrets; create the staging Anthropic key in its own workspace with a hard spend limit; fill `staging.env.template`; choose the session-store and rate-limit approach; name the hosting provider so compatibility can be checked; run a backup and a restore test; decide on the Undo control; authorize (in writing) the live smoke test and, later, any deployment.

## 20. Final deployment readiness verdict

**Code: ready for a controlled staging trial. Staging environment: not ready (does not exist). Live Claude test: not run, not yet authorizable. Production: NO-GO.** Software conformance and the local browser run are verified; they do not establish how Claude judges academic text, nor institutional approval.
