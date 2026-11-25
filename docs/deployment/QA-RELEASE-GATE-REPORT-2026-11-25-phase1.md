# QA Release Gate Report — Phase 1 (Local Gate)

- **Date:** `2026-11-25`
- **Phase Executed:** `Phase 1 — Local Gate (Sections 1A, 1B, 1C, 1D, 1E)`
- **Candidate Branch / SHA:** `Updated-Repo` @ `c7c4b018041bb6b01aec4a16e03b1d5c98065f63`
- **Isolated QA Workspace:** `C:\Users\JP Del Rosario\Syllabus-QA\2026-11-25\` (`repo\` detached checkout + `evidence\` raw logs & screenshots)
- **Staging / Production URLs:** `NONE` (Phase 2 and Phase 3 not requested in this run)

---

## 1. Verdict

- **Phase 1 Verdict:** **FAIL**
- **Candidate SHA:** `c7c4b018041bb6b01aec4a16e03b1d5c98065f63`
- **Summary Reason (3 sentences):**
  Core functional, security, database-bootstrap, concurrency, and cross-browser workflows on commit `c7c4b018041bb6b01aec4a16e03b1d5c98065f63` are strong — `1,764/1,764` unit/route/UI tests pass, two consecutive full 25-scenario E2E runs (`457/457` checks each) pass with zero flakes, Edge + Chrome full review lifecycles pass, all 9 `NODE_ENV=production` fail-closed startup guards pass, and all 30 real defects from `BUG-001`–`BUG-031` remain fixed.
  However, **8 checks fail (`A07`, `B05`, `B09`, `C10`, `D01`, `D07`, `E03`, `E04`)** and **3 checks are blocked (`A11`, `A12`, `D02`)**, including unauthorized API calls on direct URL hash navigation (`src/App.jsx:254,490-491`), two server-side Admin assignment parity gaps (`server/routes/syllabusContent.js:143` and `server/routes/pdfImport.js:68,74`), 5 broken unreached `scripts/*.test.mjs` tests, 60 non-shipping artifacts/backups/PDFs tracked in git, missing graceful HTTP/DB shutdown on `SIGTERM` (`server/index.js:69,116`), and staging checklist drift that crashes server startup (`STAGING-SETUP-CHECKLIST.md:36-45`).
  Per the Phase 1 release gate rules (zero `FAIL`, zero `FLAKY`, zero unresolved `BLOCKED`), this commit cannot advance to Phase 2 (Staging) until these blockers are resolved or explicitly waived by the owner and `HUMAN` sign-offs (`A13`, `D03`, `E01`, `E02`) are completed.

---

## 2. Scoreboard per Section

| Section | Scope | PASS | FAIL | FLAKY | BLOCKED | HUMAN | Total |
|---|---|---:|---:|---:|---:|---:|---:|
| **1A** | Automated Suites, Clean Build & CI Parity (`A01`–`A13`) | 9 | 1 | 0 | 2 | 1 | **13** |
| **1B** | Functional, Role, Concurrency, Browser & Regression (`B01`–`B16`) | 14 | 2 | 0 | 0 | 0 | **16** |
| **1C** | Security, Secrets, RBAC/IDOR, Uploads, Headers & Tree Hygiene (`C01`–`C10`) | 9 | 1 | 0 | 0 | 0 | **10** |
| **1D** | Database, Idempotency, Storage, Env Parity & Process Shutdown (`D01`–`D07`) | 3 | 2 | 0 | 1 | 1 | **7** |
| **1E** | Operational Readiness, Runbook Accuracy & Failure Playbooks (`E01`–`E04`) | 0 | 2 | 0 | 0 | 2 | **4** |
| **TOTAL** | **All Phase 1 Gate Checks (`A01`–`E04`)** | **35** | **8** | **0** | **3** | **4** | **50** |

---

## 3. Blockers (Worst First)

1. **`E03` / `D01` (High — Deployment Crash & Env Template Drift):**
   - **User/Ops Impact:** Following `docs/vpaa-conformance/STAGING-SETUP-CHECKLIST.md` verbatim causes the staging/production API to crash immediately on boot (`FATAL: SYLLABUS_CHECK_REPLAN_MAX_COST_USD must be set...`) because lines `36-45` instruct setting retired `SYLLABUS_CHECK_AI_MAX_COST_USD`, retired `SYLLABUS_CHECK_ACADEMIC_V2=true`, and retired `JWT_SECRET`, and line `70` runs deleted `scripts/vpaa-v2-preflight.cjs`. Separately, ~20 runtime env vars read in `server/` and `src/` are missing from `docs/deployment/staging.env.template` and `production.env.template`.
   - **Evidence:** `evidence/E03.log`, `evidence/D01.log`, `evidence/C08.log`.
   - **Code/Doc Locations:** `docs/vpaa-conformance/STAGING-SETUP-CHECKLIST.md:36-45,70`, `docs/deployment/staging.env.template:1-95`, `docs/deployment/production.env.template:1-102`, `docs/deployment/DATABASE-REQUIREMENTS.md:49,55`, `docs/deployment/RUNBOOK.md:30`, `HOW-TO-RUN.md:53`.
   - **Suggested Fix (Not Applied):** Update `STAGING-SETUP-CHECKLIST.md` to reference `SYLLABUS_CHECK_REPLAN=official`, `SYLLABUS_CHECK_REPLAN_MAX_COST_USD`, `SESSION_SECRET`, and `npm run test:vpaa`; add all ~20 missing runtime variables (with safe defaults) to `staging.env.template`, `production.env.template`, and `server/.env.example`; remove dead `CURRENT_TERM` from `HOW-TO-RUN.md:53` and stale `DB_PORT`/`DB_SSL` caveats from `RUNBOOK.md:30` and `DATABASE-REQUIREMENTS.md:49,55`.
   - **Who Must Act:** Engineering.

2. **`D07` (High — Ungraceful Process Shutdown & Proxy Timeout Gap):**
   - **User/Ops Impact:** Restarting or redeploying the Node API while faculty are saving syllabus sections or running 30–180s AI checks terminates open HTTP sockets immediately and leaves MySQL pool connections unclosed; if deployed behind a default Cloudflare orange-cloud proxy (100s timeout), long AI checks/generations fail with `HTTP 524`.
   - **Evidence:** `evidence/D07.log`.
   - **Code/Doc Locations:** `server/index.js:69,116`, `docs/deployment/RUNBOOK.md:1-120`, `docs/deployment/STAGING-ARCHITECTURE.md:22`.
   - **Suggested Fix (Not Applied):** Capture `const server = app.listen(PORT, ...)` at `server/index.js:116`; in the `SIGINT`/`SIGTERM` handler (`server/index.js:69`), call `server.close()`, await `Promise.all([usage.stop(), deadlineNotices.stop()])`, call `await pool.end()`, and enforce a bounded timeout (e.g., 15s) before `process.exit(0)`. Commit an ecosystem/systemd unit template and document Cloudflare's 100s timeout vs polling/proxy configuration in `RUNBOOK.md`.
   - **Who Must Act:** Engineering / DevOps.

3. **`A11` & `A12` (High — Unverified GitHub Actions CI & Node 22 Runtime Parity Blocked):**
   - **User/Ops Impact:** `.github/workflows/ci.yml` targets Ubuntu + Node 22 + MariaDB 10.11, whereas local testing ran on Windows + Node `v26.12.1` + MariaDB `10.4.32`. Commit `c7c4b018` is 6 commits ahead of `origin/Updated-Repo` (not pushed), has never run on GitHub Actions, and neither `.nvmrc` nor `"engines"` pins the Node version in `package.json` or `server/package.json`.
   - **Evidence:** `evidence/A11.log`, `evidence/A12.log`.
   - **Code Locations:** `.github/workflows/ci.yml:1-95`, `package.json:1-45`, `server/package.json:1-45`.
   - **Suggested Fix (Not Applied):** Add `.nvmrc` (`22`) and `"engines": { "node": ">=22 <23" }` (or supported LTS range) to `package.json` and `server/package.json`, push `Updated-Repo` after fixing Phase 1 defects, verify a green GitHub Actions CI run on the release SHA, and test locally under Node 22 LTS.
   - **Who Must Act:** Engineering / Owner.

4. **`B05` (Medium — Unauthorized API Calls & Transient View Mount on Forbidden URL Hashes):**
   - **User/Ops Impact:** When a signed-in `student` navigates to `#generator` or `#my-syllabi`, `App.jsx` fires `GET /api/syllabi`, producing `HTTP 403` and a browser console error before redirecting to `#dashboard` (instead of `#student-dashboard`). When `asst_vpaa`, `lic_director`, or `vpaa` navigates to `#analytics` or `#reports`, `<Analytics>` / `<Reports>` mounts for 1 render frame and fires `GET /api/compliance?syllabus=all` twice before redirecting.
   - **Evidence:** `evidence/B05_run1.log`, `evidence/B05_run2.log`, `evidence/B04_B05.log` (reproduced twice).
   - **Code Locations:** `src/App.jsx:120-122,254,490-491`.
   - **Suggested Fix (Not Applied):** Guard `src/App.jsx:254` with `canAuthor(user.role) && !user.mustChangePassword`; guard `src/App.jsx:490-491` (`#analytics` and `#reports`) with `canAuthor(user.role)`; in `src/App.jsx:121`, redirect disallowed `student` hashes to `'student-dashboard'` instead of `'dashboard'`.
   - **Who Must Act:** Engineering.

5. **`B09` (Medium — Incomplete Admin Assignment Parity in `GET /:id/content` and `pdfImport.js`):**
   - **User/Ops Impact:** (a) When an Admin's previously drafted subject is unassigned or reassigned, `GET /api/syllabi/:id/content` still returns `editable: true, lockedReason: null` while `PUT /api/syllabi/:id/content` fails `403`. (b) During PDF import, an Admin assigned to one program's copy of a shared course code (e.g., `GE - PC`) hits a false `409 pdfImport.chooseSubject` conflict because `pdfImport.js` still treats `admin` as `assigned = null`.
   - **Evidence:** `evidence/B09_content_flag_run1.log`, `evidence/B09_content_flag_run2.log`, `evidence/B09_api.log` (reproduced twice).
   - **Code Locations:** `server/routes/syllabusContent.js:143`, `server/routes/pdfImport.js:68,74`.
   - **Suggested Fix (Not Applied):** Remove `&& !rules.isAdmin(req.session.user)` at `server/routes/syllabusContent.js:143` so `editable` and `lockedReason` reflect `writeBlockedReason` for `admin` just like `faculty`; remove the `me.role === 'admin'` special cases at `server/routes/pdfImport.js:68,74` so `subjectsForCode` and `existsUnassigned` scope to `assignments.loadAssignments(db, me.id)` for `admin` too.
   - **Who Must Act:** Engineering.

6. **`C10` (Medium — 60 Non-Shipping Files, Backups, Transcripts & Institutional PDFs Tracked in Git):**
   - **User/Ops Impact:** Deploying from git ships `big.json`, `conversation-export.md`, `sample_syllabus/*`, 23 `test-backup-*.json` / `backup-*.json` files, and institutional syllabus PDFs (`docs/academic-references/*.pdf`, `reference-data/*.pdf`) onto production servers unless excluded or removed.
   - **Evidence:** `evidence/C10.log`.
   - **Code Locations:** `.gitignore:1-45`, root `big.json`, `conversation-export.md`, `sample_syllabus/*`, `docs/**/test-backup-*.json`, `docs/academic-references/*.pdf`, `reference-data/*.pdf`.
   - **Suggested Fix (Not Applied):** `git rm --cached` non-shipping scratch exports, backup JSONs, and unapproved syllabus PDFs (or record explicit owner sign-off for intentional reference fixtures) and add matching patterns to `.gitignore`.
   - **Who Must Act:** Engineering + Owner.

7. **`A07` (Medium — 5 Unreached `scripts/*.test.mjs` Files Fail & 14 Valid Tests Omitted from `npm test`):**
   - **User/Ops Impact:** 5 historical verification tests under `scripts/` fail reproducibly against current code/fixtures, and 12 valid unit/route tests in `src/`/`server/` plus 2 UI tests in `tests/` are never executed by `npm test` (which also contains a dead glob `server/lib/syllabuscheck/eval/*.test.js`).
   - **Evidence:** `evidence/A07.log`, `evidence/A07_src_server.log`, `evidence/A07_scripts_run1.log`, `evidence/A07_scripts_run2.log`, `evidence/A07_po_browser.log` (reproduced twice).
   - **Code Locations:** `package.json:10-16`, `scripts/lcup-approved-offline/baseline.test.mjs:19`, `scripts/lcup-approved-offline/fixture.test.mjs:109`, `scripts/lcup-evaluation-readiness/verification.test.mjs:37`, `scripts/lcup-po-correction/source.test.mjs:46`, `scripts/po-controlled-activation/browser.test.mjs:38`.
   - **Suggested Fix (Not Applied):** Wire the 12 unreached `src/` + `server/` tests and 2 `tests/*.test.jsx` files into `npm test`, remove the dead `eval/*.test.js` glob, and either update or archive the 5 superseded phase-milestone tests under `scripts/`.
   - **Who Must Act:** Engineering.

8. **`E04` (Medium — Missing Operational Failure Playbooks in Runbook):**
   - **User/Ops Impact:** On-call administrators have no step-by-step diagnosis and recovery commands in `RUNBOOK.md` / `MONITORING.md` for Disk full, SMTP failing, Stuck PDF import, Login fails for everyone, DB down, Slow pages, or API won't start.
   - **Evidence:** `evidence/E04.log`.
   - **Code/Doc Locations:** `docs/deployment/RUNBOOK.md`, `docs/deployment/MONITORING.md`.
   - **Suggested Fix (Not Applied):** Add a dedicated Troubleshooting & Incident Recovery section in `docs/deployment/RUNBOOK.md` covering symptom, verification command, root-cause check, and safe recovery for all 7 failure scenarios.
   - **Who Must Act:** Engineering / Ops.

9. **`D02` (Blocked — Live Staging/Production `.env` Inspection Pending):**
   - **User/Ops Impact:** Staging and production `.env` files do not exist yet (`NONE`), so live variable validation could not be run in Phase 1.
   - **Evidence:** `evidence/D02.log`.
   - **Suggested Fix (Not Applied):** Provide the staging `.env` path during Phase 2 setup and verify variable names/presence (without printing values) before starting the staging stack.
   - **Who Must Act:** DevOps / Owner.

---

## 4. All Findings by Severity

### Critical
*None found on candidate commit `c7c4b018041bb6b01aec4a16e03b1d5c98065f63`.*

### High

#### F-01 (`E03` / `D01`) — Staging Checklist & Deployment Env Templates Drift (Startup Crash if Followed Verbatim)
- **Severity:** High
- **Reproduced Count:** 2 / 2 (deterministic static diff + live `NODE_ENV=production` boot refusal in `C08.log`)
- **Steps to Reproduce:**
  1. Compare `docs/vpaa-conformance/STAGING-SETUP-CHECKLIST.md:36-45,70` against `server/index.js:14-22` and `server/lib/aiQuota.js`.
  2. Start `node server/index.js` with `NODE_ENV=production`, `SYLLABUS_CHECK_AI_PROVIDER=anthropic`, and `SYLLABUS_CHECK_AI_MAX_COST_USD=2` (as written in `STAGING-SETUP-CHECKLIST.md:41`) instead of `SYLLABUS_CHECK_REPLAN_MAX_COST_USD`.
  3. Diff all `process.env.*` / `import.meta.env.*` reads in `server/` and `src/` against `docs/deployment/staging.env.template` and `production.env.template`.
- **Expected:** Setup checklists and env templates match current code and start cleanly.
- **Actual:** Server exits `1` with `FATAL: SYLLABUS_CHECK_REPLAN_MAX_COST_USD must be set...`; `scripts/vpaa-v2-preflight.cjs` and `scripts/e2e/run-comprehensive-ui.cjs` (`DATABASE-REQUIREMENTS.md:55`) do not exist; ~20 runtime env vars (`VITE_GOOGLE_CLIENT_ID`, `ALLOWED_EMAIL_DOMAIN`, `SMTP_SECURE`, `SCHOOL_YEAR_START`, `SYLLABUS_PDF_IMPORT`, `SYLLABUS_PDF_IMPORT_CONCURRENCY`, `SYLLABUS_CHECK_GENERATE*`, `SYLLABUS_CHECK_REFINE_*`, `COR_SCAN_MODEL`, `AI_CHECKS_PER_MINUTE_PER_USER`, `SESSION_COOKIE_SECURE`, `USAGE_TRACKING`, `DEADLINE_NOTICES`) are missing from staging/production templates; `HOW-TO-RUN.md:53` documents dead `CURRENT_TERM`.

#### F-02 (`D07`) — Missing Graceful HTTP & MySQL Pool Shutdown on `SIGINT`/`SIGTERM`
- **Severity:** High
- **Reproduced Count:** 2 / 2 (deterministic inspection of `server/index.js:69,116`)
- **Steps to Reproduce:**
  1. Inspect `server/index.js:69` and `server/index.js:116`.
- **Expected:** `app.listen()` handle is stored; `SIGTERM`/`SIGINT` stops accepting new connections via `server.close()`, drains active HTTP requests, flushes `usage` and `deadlineNotices`, closes `pool.end()`, and exits cleanly.
- **Actual:** `server/index.js:69` calls `Promise.all([usage.stop(), deadlineNotices.stop()]).finally(() => process.exit(0))` immediately without closing `http.Server` or `pool.end()`, severing in-flight saves/AI checks. Additionally, Cloudflare's 100-second origin read timeout (`HTTP 524`) is not documented alongside `STAGING-ARCHITECTURE.md:22`'s `>= 10 min` proxy timeout requirement.

### Medium

#### F-03 (`B05`) — Direct Forbidden URL Hashes Fire Unauthorized Staff/Compliance API Calls Before Redirect
- **Severity:** Medium
- **Reproduced Count:** 2 / 2 (`evidence/B05_run1.log`, `evidence/B05_run2.log`, plus initial `evidence/B04_B05.log`)
- **Steps to Reproduce:**
  1. Sign in as a verified `student` (`24-7701-303`) and set `window.location.hash = '#generator'`, then `'#my-syllabi'`.
  2. Sign in as `vpaa` (or `asst_vpaa` / `lic_director`) and set `window.location.hash = '#analytics'`, then `'#reports'`.
- **Expected:** Forbidden hashes redirect cleanly (`#student-dashboard` for students, `#dashboard` for staff) without mounting forbidden components or firing unauthorized API calls.
- **Actual:**
  - `src/App.jsx:254` runs `fetchSyllabi()` (`GET /api/syllabi`) for `student` on `#generator` and `#my-syllabi`, returning `HTTP 403` and logging `Failed to fetch syllabi` in console; `src/App.jsx:121` also sets `#dashboard` instead of `#student-dashboard`.
  - `src/App.jsx:490-491` lacks `canAuthor(user.role)` on `<Analytics>` and `<Reports>`, mounting them for 1 frame and firing `GET /api/compliance?syllabus=all` twice before redirecting.

#### F-04 (`B09`) — Admin Subject-Assignment Parity Omitted in `GET /api/syllabi/:id/content` and `pdfImport.js`
- **Severity:** Medium
- **Reproduced Count:** 2 / 2 (`evidence/B09_content_flag_run1.log`, `evidence/B09_content_flag_run2.log`)
- **Steps to Reproduce:**
  1. As `admin`, assign `BSIT` + `IT 206` (`course 13`), create a draft, save `IT 206` content, then unassign `IT 206` from `admin`.
  2. Call `GET /api/syllabi/:id/content` and `PUT /api/syllabi/:id/content` as `admin`.
  3. Inspect `server/routes/pdfImport.js:68,74` for an `admin` assigned to one program's copy of a shared course code (e.g., `GE - PC`).
- **Expected:** `GET /api/syllabi/:id/content` returns `editable: false` with `lockedReason` matching `PUT /content`'s `403`, and `pdfImport.js` narrows shared course codes to the Admin's assigned courses.
- **Actual:** `server/routes/syllabusContent.js:143` skips `writeBlockedReason` when `rules.isAdmin(req.session.user)` is true (`editable: true, lockedReason: null` while `PUT /content` returns `403`); `server/routes/pdfImport.js:68,74` hardcodes `assigned = me.role === 'admin' ? null : ...` and `existsUnassigned = false`.

#### F-05 (`C10`) — 60 Tracked Non-Shipping Files, Backups, Exports & Syllabus PDFs in Repository
- **Severity:** Medium
- **Reproduced Count:** 2 / 2 (`evidence/C10.log` via `git ls-tree -r HEAD`)
- **Steps to Reproduce:** Run `git ls-tree -r --name-only c7c4b018` and filter for root exports, backups, samples, and PDFs.
- **Expected:** Only shipping source, tests, migrations, and approved documentation are tracked in git.
- **Actual:** 60 tracked files include `big.json`, `conversation-export.md`, `sample_syllabus/*` (6 files), 23 `test-backup-*.json` / `backup-*.json` snapshots under `docs/`, and institutional syllabus PDFs under `docs/academic-references/*.pdf` and `reference-data/*.pdf`.

#### F-06 (`A07`) — 5 Unreached `scripts/*.test.mjs` Tests Fail & 14 Valid Tests Not Wired Into `npm test`
- **Severity:** Medium
- **Reproduced Count:** 2 / 2 (`evidence/A07_scripts_run1.log`, `evidence/A07_scripts_run2.log`, `evidence/A07_po_browser.log`)
- **Steps to Reproduce:** Run `node --test` on the 6 DB-free `scripts/**/*.test.mjs` files and compare `package.json` test globs against all `*.test.*` files in the repo.
- **Expected:** All active tests are wired into `npm test` or dedicated CI scripts and pass offline.
- **Actual:**
  - 5 `scripts/*.test.mjs` files fail reproducibly (`baseline.test.mjs:19` `46 !== 47`, `fixture.test.mjs:109` `ENOENT: IT-202-Programming-1.pdf`, `verification.test.mjs:37` `'Apply to form' !== 'Apply and AI CHECK'`, `source.test.mjs:46`, `po-controlled-activation/browser.test.mjs:38`).
  - 12 passing `src/` + `server/` test files (`66` passing assertions) + `tests/lesson-authoring.test.jsx` + `tests/po-reference-panel.test.jsx` are not included in `npm test`, and `server/lib/syllabuscheck/eval/*.test.js` matches 0 files.

#### F-07 (`D03` / Cost Control) — Unlimited Default Per-User Generator Daily Quota & Implicit COR Claude Activation
- **Severity:** Medium
- **Reproduced Count:** 2 / 2 (code audit in `evidence/D03.log`)
- **Steps to Reproduce:** Inspect `server/routes/syllabusCheck.js:173` and `server/lib/corClaude.js:10,55`.
- **Expected:** All paid AI endpoints have safe bounded defaults and respect a unified AI enablement switch.
- **Actual:** When `SYLLABUS_CHECK_GENERATE=on` and `SYLLABUS_CHECK_GENERATE_MAX_COST_USD` is set, omitting `SYLLABUS_CHECK_GENERATE_PER_USER_PER_DAY` defaults `perDay` to `null` (no per-user daily cap at `syllabusCheck.js:173`). Separately, `corClaude.js:10,55` invokes `claude-haiku-5-5` whenever `ANTHROPIC_API_KEY` is present in env, even if `SYLLABUS_CHECK_AI_PROVIDER=off`.

#### F-08 (`D04` / Schema Portability) — Implicit `ENGINE`/`CHARSET` in DDL & `ON DELETE CASCADE` on `syllabi.user_id`
- **Severity:** Medium
- **Reproduced Count:** 2 / 2 (`evidence/D04.log`)
- **Steps to Reproduce:** Inspect `server/db/schema.sql` and all 38 `server/db/migrate-*.js` files.
- **Expected:** Explicit `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` on every `CREATE TABLE`, and `RESTRICT` (not `CASCADE`) on `syllabi.user_id`.
- **Actual:** 0 of 63 files in `server/db/` specify `ENGINE=InnoDB` or `CHARSET=utf8mb4` (relying on MariaDB server defaults — risky if a target server defaults to `latin1` or MyISAM/Aria). While the API (`users.js`) refuses deleting users who own approved syllabi (`409`), the DB foreign key on `syllabi.user_id` (`schema.sql:40`) is `ON DELETE CASCADE`, so a direct SQL user delete would cascade-delete syllabi and versions.

#### F-09 (`E04`) — Missing Step-by-Step Incident Recovery Playbooks
- **Severity:** Medium
- **Reproduced Count:** 2 / 2 (`evidence/E04.log`)
- **Steps to Reproduce:** Search `docs/deployment/RUNBOOK.md` and `docs/deployment/MONITORING.md` for recovery steps for the 7 required operational failure modes.
- **Expected:** Concrete diagnosis and recovery steps for Disk full, SMTP failing, Stuck import, Login fails for everyone, DB down, Slow pages, and API won't start.
- **Actual:** Partial SQL checks exist in `MONITORING.md`, but actionable step-by-step recovery procedures are absent for those 7 scenarios.

### Low

#### F-10 (`B01` / `B02` Prompt vs Spec Note) — Stage Carry-Forward on VPAA Return/Reject (`carryForward`)
- **Severity:** Low (Specification / Prompt Wording Alignment)
- **Reproduced Count:** Verified in `evidence/B01_B02_api.log:28,32`
- **Details:** `server/lib/reviewStages.js:49-92` (`carryForward`) implements `docs/review-chain.md` ("stages cleared *before* the reviewer who returned/rejected stay cleared on the resubmitted version"). Thus, when **Dean** returns `v1`, `v2` starts with `0` clears (all 3 stages must clear again); when **VPAA** returns or rejects `v2`, `v3` carries forward the `3` prior stage clears (`status: 'under_review'`) and routes directly back to VPAA. Note that `QA-RELEASE-GATE-PROMPT.md` `B01`/`B02` states *"A resubmitted version needs all three clears again"* — owner should confirm that `docs/review-chain.md`'s `carryForward` behavior for VPAA returns/rejects remains the intended institutional rule.

#### F-11 (`A12`) — Missing `.nvmrc` and `engines` Field in `package.json` / `server/package.json`
- **Severity:** Low
- **Details:** Neither `package.json` nor `server/package.json` declares `"engines"` or `.nvmrc`, allowing accidental startup or builds under mismatched Node versions (`evidence/A12.log`).

#### F-12 (`B06` / `App.jsx:127-131`) — In-Session `hashchange` to `#builder?id=<id>` Does Not Load Draft `id`
- **Severity:** Low
- **Details:** `routeOnLoad(window.location.hash)` is evaluated only on initial document load (`src/App.jsx:110`). Normal UI buttons call `setEditing(...)` directly and full page reloads of `/#builder?id=<id>` work (`evidence/B12_B16_extra_ui.log`), but manually typing `#builder?id=<id>` into the URL bar while the SPA is already mounted switches `page` to `'builder'` without updating `editing`.

#### F-13 (`C09` Hygiene) — `seed-student-demo*.js` Lack `NODE_ENV=production` Refusal Guard
- **Severity:** Low
- **Details:** `server/db/init.js` properly skips `seed.sql` in staging/production and `assertDatabaseSafe` blocks `seed.sql` password hashes at startup (`evidence/C08.log`, `evidence/C09.log`), but `server/db/seed-student-demo.js` and `seed-student-demo-syllabi.js` do not check `NODE_ENV` if invoked manually via `node`. Also `src/views/Login.jsx:56-57` retains JSX-commented demo emails (stripped from `dist/`, verified `0` matches in `C09_static.log`).

---

## 5. Full Check Table (`A01`–`E04`)

Every Phase 1 check ID is accounted for below with its status, backing evidence file in `C:\Users\JP Del Rosario\Syllabus-QA\2026-11-25\evidence\`, and measured duration.

| ID | Section | Description | Status | Evidence File(s) | Duration |
|---|---|---|---|---|---:|
| `A01` | 1A | Clean owner `git status --porcelain` & exact candidate SHA `c7c4b018` | **PASS** | `evidence/A01.log` | `0.20s` |
| `A02` | 1A | `npm ls --depth=0` clean & lockfiles tracked in root and `server/` | **PASS** | `evidence/A02.log` | `3.44s` |
| `A03` | 1A | `npm test` main suite (`1,764` passed, `0` failed, `0` skipped) | **PASS** | `evidence/A03.log` | `44.31s` |
| `A04` | 1A | `npm run test:vpaa` (`37` passed, `0` failed) | **PASS** | `evidence/A04.log` | `26.08s` |
| `A05` | 1A | `npm run test:po-reference-ui` (`5` passed, `0` failed) | **PASS** | `evidence/A05.log` | `1.07s` |
| `A06` | 1A | `npm run audit:i18n` (`3,040` keys, `0` hardcoded strings) | **PASS** | `evidence/A06.log` | `0.94s` |
| `A07` | 1A | Unreached test files (`13` `src`/`server` pass; `5/6` `scripts/*.test.mjs` fail 2x) | **FAIL** | `evidence/A07.log`, `A07_src_server.log`, `A07_scripts_run1.log`, `A07_scripts_run2.log` | `12.83s` |
| `A08` | 1A | `VITE_API_URL=https://api.invalid/api npm run build` (`VITE_NEW_BUILDER` unset) | **PASS** | `evidence/A08.log` | `5.13s` |
| `A09` | 1A | `npm run test:db-bootstrap` on scratch DB (`38` migrations, `48` tables, `0` issues) | **PASS** | `evidence/A09.log` | `13.91s` |
| `A10` | 1A | `npm run test:e2e` run **twice** (`25/25` scenarios, `457/457` checks both runs) | **PASS** | `evidence/A10_run1.log`, `evidence/A10_run2.log` | `832.23s` |
| `A11` | 1A | GitHub Actions CI run on candidate SHA (`c7c4b018` unpushed; `gh` absent) | **BLOCKED** | `evidence/A11.log` | `0.17s` |
| `A12` | 1A | Node version parity (`v26.12.1` local vs CI Node 22; Node 22 not installed) | **BLOCKED** | `evidence/A12.log` | `0.01s` |
| `A13` | 1A | Review last 30 commits on `Updated-Repo` (`25` direct commits since PR `#57`) | **HUMAN** | `evidence/A13.log` | `0.13s` |
| `B01` | 1B | Full 4-stage review chain, role `403`s, out-of-order `409`s, approved immutability | **PASS** | `evidence/B01_B02_api.log`, `evidence/B15.log` | `0.75s` |
| `B02` | 1B | Return, reject & resubmit whole-number version labels (`v1`, `v2`, `v3`) | **PASS** | `evidence/B01_B02_api.log` | `0.75s` |
| `B03` | 1B | Settings switches (`strictValidation`, `aiChecking=false`, `emailNotifications`) & AI gate | **PASS** | `evidence/B03_api.log`, `evidence/B01_B02_api.log` | `0.07s` |
| `B04` | 1B | Every allowed page opened as each of the 6 roles + `NotFound` (`0` console/page errors) | **PASS** | `evidence/B04.log` | `47.36s` |
| `B05` | 1B | Direct URL hash gating (`student` `#generator`/`#my-syllabi` 403; reviewer `#analytics`/`#reports` call) | **FAIL** | `evidence/B05_run1.log`, `evidence/B05_run2.log`, `evidence/B04_B05.log` | `23.94s` |
| `B06` | 1B | Syllabus Builder V2 default, autosave, refresh recovery, CLO lock, PO panel, PDF/DOCX export | **PASS** | `evidence/B06_B07_ui.log`, `evidence/A10_run1.log` | `11.70s` |
| `B07` | 1B | PDF import extraction, oversized/non-PDF/wrong-template refusals & UI recovery | **PASS** | `evidence/B06_B07_ui.log`, `evidence/C06.log`, `evidence/A03.log` | `11.70s` |
| `B08` | 1B | AI Checker, Check & improve, Generator jobs/cap, unchanged-submit retention, failure modes | **PASS** | `evidence/B08_api.log` | `31.04s` |
| `B09` | 1B | Admin assignment parity (`syllabusContent.js:143` `editable:true` & `pdfImport.js:68` gap) | **FAIL** | `evidence/B09_api.log`, `B09_content_flag_run1.log`, `B09_content_flag_run2.log` | `5.00s` |
| `B10` | 1B | Student COR registration, `422 cor_unclear`, approved-only syllabi, 4-stage signoffs, `0` 403s | **PASS** | `evidence/B10_api.log`, `evidence/B10_C01_pdf.log` | `7.55s` |
| `B11` | 1B | Temp password expiry, `mustChangePassword`, remember-me rotation, logout, lockout `429` | **PASS** | `evidence/B11_api.log` | `0.56s` |
| `B12` | 1B | Comments, messages, unread counts, self-chat `409`, notifications & per-user DND mode | **PASS** | `evidence/B12_api.log`, `evidence/B12_B16_extra_ui.log` | `9.90s` |
| `B13` | 1B | Concurrency races: 2-tab `baseRevisions`, double-submit, parallel stage-clear, double-approve | **PASS** | `evidence/B13_api.log` | `0.15s` |
| `B14` | 1B | 4 viewports (`375`–`1440`), Light/Dark/AMOLED contrast `>= 4.5:1`, Filipino scan, keyboard nav | **PASS** | `evidence/B14.log` | `43.63s` |
| `B15` | 1B | Cross-browser E2E workflow in Microsoft Edge `158` and Google Chrome `157` | **PASS** | `evidence/B15.log` | `81.90s` |
| `B16` | 1B | Individual regression verification of all 31 prior defects (`BUG-001`–`BUG-031`) | **PASS** | `evidence/B16_api.log`, `B15.log`, `B10_C01_pdf.log`, `B12_B16_extra_ui.log` | `0.12s` |
| `C01` | 1C | `npm audit --omit=dev` (`0` vulns in root & `server/`) + real browser `jspdf 4.2.1` PDF download | **PASS** | `evidence/C01.log`, `evidence/C01_audit.log` | `11.94s` |
| `C02` | 1C | Tracked tree (`2,272` files) + full `441`-commit git history secret scan (`0` leaked live keys) | **PASS** | `evidence/C02.log` | `213.76s` |
| `C03` | 1C | Live 60-route × 7-role RBAC matrix, 11 IDOR probes & 11 SQLi/type/oversized fuzz probes | **PASS** | `evidence/C03.log`, `evidence/C03_matrix.md` | `1.08s` |
| `C04` | 1C | Stored/reflected XSS DOM escaping & CSV/DOCX/PDF formula/markup neutralization | **PASS** | `evidence/C04.log` | `10.51s` |
| `C05` | 1C | Cookie flags (`HttpOnly`, `Secure`, `SameSite=Lax`), CORS, foreign-Origin `403`, `/uploads` `404`, CSP | **PASS** | `evidence/C05.log` | `0.03s` |
| `C06` | 1C | File upload size limits, magic-byte validation, private avatar/COR isolation & traversal `404` | **PASS** | `evidence/C06.log` | `0.09s` |
| `C07` | 1C | Server-side login lockout (`429`) & AI recheck rate limit (`429` + `Retry-After`) | **PASS** | `evidence/C07.log`, `evidence/B11_api.log` | `1.87s` |
| `C08` | 1C | All 9 `NODE_ENV=production` fail-closed startup refusals (`exit 1`, `0` leaked secret values) | **PASS** | `evidence/C08.log` | `6.14s` |
| `C09` | 1C | Zero demo/test accounts in `NODE_ENV=production` bootstrap, `dist/` bundle, or runtime DB | **PASS** | `evidence/C09.log`, `evidence/C09_static.log` | `7.11s` |
| `C10` | 1C | Non-shipping files tracked in git (`60` files: `big.json`, `conversation-export.md`, backups, PDFs) | **FAIL** | `evidence/C10.log` | `0.01s` |
| `D01` | 1D | Environment variable parity across code, `.env.example`, staging & production templates | **FAIL** | `evidence/D01.log` | `1.07s` |
| `D02` | 1D | Staging/production `.env` inspection (`NONE` provided yet) | **BLOCKED** | `evidence/D02.log` | `0.07s` |
| `D03` | 1D | Credentials rotation & AI daily/monthly spending caps sign-off | **HUMAN** | `evidence/D03.log` | `0.01s` |
| `D04` | 1D | MariaDB `InnoDB`, `utf8mb4` Filipino/Baybayin/en-dash round-trip, `max_allowed_packet`, monitoring SQL | **PASS** | `evidence/D04.log` | `0.08s` |
| `D05` | 1D | Migration idempotency (`0` checksum diffs on 2nd pass), `DB_PORT`/`DB_SSL` support, rollback notes | **PASS** | `evidence/D05.log` | `8.45s` |
| `D06` | 1D | Absolute `UPLOAD_DIR` & `PRIVATE_DIR` outside `server/` (`0` files written inside `server/`) | **PASS** | `evidence/D06.log` | `0.22s` |
| `D07` | 1D | Production start script, proxy timeouts & graceful `SIGINT`/`SIGTERM` shutdown (`server.close` missing) | **FAIL** | `evidence/D07.log` | `0.01s` |
| `E01` | 1E | Named owners for deploy, DB backup, smoke test, VPAA UAT & go/no-go | **HUMAN** | `evidence/E01.log` | `0.01s` |
| `E02` | 1E | Faculty/reviewer rollout notice, maintenance window, support contact & known-limitations note | **HUMAN** | `evidence/E02.log` | `0.01s` |
| `E03` | 1E | Runbook & staging checklist accuracy against real files, commands & env vars (`9` drifts found) | **FAIL** | `evidence/E03.log` | `0.01s` |
| `E04` | 1E | Step-by-step incident playbooks for 7 operational failure scenarios | **FAIL** | `evidence/E04.log` | `0.01s` |

---

## 6. Regression Table (`BUG-001` to `BUG-031`)

Every defect from `tmp/antigravity-e2e/E2E-REPORT.md` was re-tested on `c7c4b018041bb6b01aec4a16e03b1d5c98065f63`:

| Bug ID | Original Summary | Status | Evidence on `c7c4b018` |
|---|---|---|---|
| `BUG-001` | VPAA could `PUT /api/syllabi/:id` `status=under_review` before 3 stage clears | **FIXED** | `B16_api.log` (`HTTP 409` before 3 clears) |
| `BUG-002` | VPAA could read/comment/inspect syllabus sub-routes before 3 stage clears | **FIXED** | `B16_api.log` (`409` on `/comments`, `POST /comments`, `/review`, `/compliance`, `/versions`, `/stages`) |
| `BUG-003` | Dean unsent syllabus (`prepare-check`) visible to other reviewers before `publish` | **FIXED** | `B09_api.log` (`GET /review` and `GET /content` return `409` to `asst_vpaa` before `publish`) |
| `BUG-004` | `GlobalSearch` crashed with `TypeError: syllabi.filter is not a function` | **FIXED** | `B09_B12_B13_B16_ui.log` (`GlobalSearch` returns 2 matches, `0` `pageErrors`) |
| `BUG-005` | Stale step-7 builder copy on AI Checker / Builder handoff | **FIXED** | `A10_run1.log`, `B09_B12_B13_B16_ui.log` |
| `BUG-006` | Misleading client-only "Delete conversation" button in `ChatModal` | **FIXED** | `B09_B12_B13_B16_ui.log` (`0` delete buttons in `.chat-modal`) |
| `BUG-007` | Removed student manual-verify route returned `500` on invalid id | **FIXED** | `B16_api.log` (`POST /api/students/abc/verify` returns `404`) |
| `BUG-008` | Double-clicking `Clear my check` wrote duplicate `submission_logs` entries | **FIXED** | `B13_api.log` (parallel `stage-clear` writes `1` stage row and `1` log row) |
| `BUG-009` | Dead `GET /api/students/:id/cor` route crashed or exposed stale handler | **FIXED** | `B16_api.log` (`GET /api/students/abc/cor` returns `404`) |
| `BUG-010` | Past academic year draft remained editable in API and Builder | **FIXED** | `B16_api.log` (`editable=false`, `PUT /content -> 409`), `B12_B16_extra_ui.log` (read-only banner) |
| `BUG-011` | Admin could read faculty's private draft AI check decisions (`GET /runs/:id/decisions`) | **FIXED** | `B16_api.log` (`HTTP 404` for Admin on faculty run) |
| `BUG-012` | `SyllabusPicker` offered out-of-turn submissions to later stage reviewers | **FIXED** | `A10_run1.log` (`S12`), `B15.log` |
| `BUG-013` | `SyllabusGenerator` showed broken form instead of unavailable notice when disabled | **FIXED** | `B09_B12_B13_B16_ui.log` (`[data-testid="generator-unavailable"]` rendered) |
| `BUG-014` | Reviewer could approve/return without AI check or explicit `review-without-ai` | **FIXED** | `B01_B02_api.log`, `A10_run1.log` (`409` until checked or `review-without-ai`) |
| `BUG-015` | Author's pre-submit hybrid AI check lost on unchanged `POST /submit` | **FIXED** | `B08_api.log` (`pre=6, post=6`, hybrid report preserved; `adminRun=null`) |
| `BUG-016` | Student `Topbar` showed staff search, messages, and notifications icons | **FIXED** | `B10_C01_pdf.log` (`0` `.topbar .search` elements; `0` `403`s) |
| `BUG-017` | Student view of approved syllabus omitted reviewer/VPAA sign-off names | **FIXED** | `B10_C01_pdf.log` (`Test Faculty`, `Test Administrator`, `Test AsstVpaa`, `Test LicDirector`, `Test Vpaa` all rendered) |
| `BUG-018` | Open `SyllabusViewModal` did not refresh `FormPaper` sign-off upon `Clear my check` | **FIXED** | `B15.log` (`Test AsstVpaa` appears immediately in `.svm-modal` after clearing) |
| `BUG-019` | Reviewer `Dashboard` pending count stayed stale after clearing stage | **FIXED** | `B15.log` (`dean`, `asst`, `lic` dashboards update immediately after stage clear) |
| `BUG-020` | Admin could set new submission deadlines on past-academic-year subjects | **FIXED** | `B09_api.log` (`HTTP 403`), `B09_B12_B13_B16_ui.log` (past-year deadline chips disabled) |
| `BUG-021` | `GET /api/syllabi/comment-summary` ignored comments on Dean-authored syllabi | **FIXED** | `B12_api.log` (`before=1, after=0` unread count on Dean-authored syllabus) |
| `BUG-022` | Mobile drawer (`375px`) overflowed or failed to close on navigation | **FIXED** | `B14.log`, `A10_run1.log` (`S24` `375px` `scrollWidth === clientWidth`) |
| `BUG-023` | Past-year draft `Edit` button showed misleading "no longer assigned" tooltip | **FIXED** | `B09_B12_B13_B16_ui.log` (`title="This syllabus belongs to a past academic year (2025–2026)..."`) |
| `BUG-024` | Unassigned faculty reading `GET /api/courses/:id` or `/programs/:id/outcomes` (`200`) | **NOT A BUG (BY DESIGN)** | `C03.log` (read-only institutional catalog metadata; authoring/saving unassigned courses blocked `403`) |
| `BUG-025` | `Users & Roles` left `Disable`/`Remove` enabled on signed-in Admin's own row | **FIXED** | `B09_B12_B13_B16_ui.log` (`disabled=[true, true]`), `B09_api.log` (`400` on self-disable/delete) |
| `BUG-026` | Empty `Repository` with no active filters claimed "No syllabi match your filters" | **FIXED** | `B15.log` (`"No approved syllabi"` rendered when repository is empty) |
| `BUG-027` | Raw lowercase `"student"` role badge shown in `Topbar` and `Users & Roles` | **FIXED** | `B10_C01_pdf.log`, `B09_B12_B13_B16_ui.log` (`"Student"` capitalized) |
| `BUG-028` | Faculty `Dashboard` Quick Actions referenced removed Builder Step 7 checker | **FIXED** | `B09_B12_B13_B16_ui.log` (no Step 7 reference) |
| `BUG-029` | `POST /api/auth/google` returned `500` instead of `503` when `GOOGLE_CLIENT_ID` unset | **FIXED** | `B16_api.log`, `C03_matrix.md` (`HTTP 503`) |
| `BUG-030` | Tagalog UI leaked untranslated English or raw i18n keys on new review/PO screens | **FIXED** | `A06.log`, `B14.log` (`0` raw keys across all 14 Filipino screens) |
| `BUG-031` | Deleting a draft erased its subject name from `submission_logs` / `Recent Activity` | **FIXED** | `server/routes/syllabi.js:363-365`, `A03.log`, `A10_run1.log` |

---

## 7. `Role × Page` and `Role × Route` Matrices

### 7.1 `Role × Page` Matrix (`B04` & `B05`)

> `ALLOW (OK)` = renders cleanly with 0 console/page/API errors (`B04.log`).
> `REDIRECT*` = redirects to `#dashboard`, **but** fires unauthorized/unintended API call on transient render (`B05_run1.log` / `B05_run2.log` — see Finding **F-03**).

| Page / Hash | Signed Out | Faculty | Admin (Dean) | Asst. VPAA | LIC Director | VPAA | Student |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `#dashboard` | Login | `ALLOW (OK)` | `ALLOW (OK)` | `ALLOW (OK)` | `ALLOW (OK)` | `ALLOW (OK)` | `REDIRECT (#dashboard)` |
| `#builder` | Login | `ALLOW (OK)` | `ALLOW (OK)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` |
| `#ai` | Login | `ALLOW (OK)` | `ALLOW (OK)` | `ALLOW (OK)` | `ALLOW (OK)` | `ALLOW (OK)` | `REDIRECT (#dashboard)` |
| `#generator` | Login | `ALLOW (OK)` | `ALLOW (OK)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` | **`REDIRECT* (403 /api/syllabi)`** |
| `#my-syllabi` | Login | `ALLOW (OK)` | `ALLOW (OK)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` | **`REDIRECT* (403 /api/syllabi)`** |
| `#review` | Login | `REDIRECT (#dashboard)` | `ALLOW (OK)` | `ALLOW (OK)` | `ALLOW (OK)` | `ALLOW (OK)` | `REDIRECT (#dashboard)` |
| `#courses` | Login | `REDIRECT (#dashboard)` | `ALLOW (OK)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` |
| `#repository` | Login | `ALLOW (OK)` | `ALLOW (OK)` | `ALLOW (OK)` | `ALLOW (OK)` | `ALLOW (OK)` | `REDIRECT (#dashboard)` |
| `#compliance` | Login | `REDIRECT (#dashboard)` | `ALLOW (OK)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` |
| `#analytics` | Login | `ALLOW (OK)` | `ALLOW (OK)` | **`REDIRECT* (/api/compliance)`** | **`REDIRECT* (/api/compliance)`** | **`REDIRECT* (/api/compliance)`** | `REDIRECT (#dashboard)` |
| `#reports` | Login | `ALLOW (OK)` | `ALLOW (OK)` | **`REDIRECT* (/api/compliance)`** | **`REDIRECT* (/api/compliance)`** | **`REDIRECT* (/api/compliance)`** | `REDIRECT (#dashboard)` |
| `#users` | Login | `REDIRECT (#dashboard)` | `ALLOW (OK)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` |
| `#audit-log` | Login | `REDIRECT (#dashboard)` | `ALLOW (OK)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` |
| `#settings` | Login | `ALLOW (OK)` | `ALLOW (OK)` | `ALLOW (OK)` | `ALLOW (OK)` | `ALLOW (OK)` | `REDIRECT (#dashboard)` |
| `#student-dashboard` | Login | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` | `ALLOW (OK)` |
| `#student-syllabi` | Login | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` | `REDIRECT (#dashboard)` | `ALLOW (OK)` |

### 7.2 `Role × Route` Live HTTP Status Matrix (`C03`, `B01`, `B09`, `B10`)

*(Syllabus `#2` = approved syllabus of `facultyA`; Syllabus `#7` = private draft of `facultyB`; User `#3` = `facultyA`.)*

| Method | Path | Anon | Faculty | Admin | Asst. VPAA | LIC Dir. | VPAA | Student |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| `GET` | `/api/health` | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET` | `/api/auth/me` | 401 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST` | `/api/auth/google` *(unset)* | 503 | 503 | 503 | 503 | 503 | 503 | 503 |
| `GET` | `/api/students/me` | 401 | 403 | 403 | 403 | 403 | 403 | 200 |
| `GET` | `/api/students/syllabi` | 401 | 403 | 403 | 403 | 403 | 403 | 200 |
| `GET` | `/api/students/syllabi/2` *(approved)* | 401 | 403 | 403 | 403 | 403 | 403 | 200 |
| `GET` | `/api/students/syllabi/7` *(draft)* | 401 | 403 | 403 | 403 | 403 | 403 | 404 |
| `GET` | `/api/users` | 401 | 403 | 200 | 403 | 403 | 403 | 403 |
| `POST` | `/api/users` | 401 | 403 | 201 | 403 | 403 | 403 | 403 |
| `GET` | `/api/users/me/assignments` | 401 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET` | `/api/users/subject-holders` | 401 | 403 | 200 | 403 | 403 | 403 | 403 |
| `GET` | `/api/users/3/assignments` | 401 | 403 | 200 | 403 | 403 | 403 | 403 |
| `PUT` | `/api/users/3/assignments` | 401 | 403 | 200 | 403 | 403 | 403 | 403 |
| `GET` | `/api/users/3/avatar` *(facultyB: 404)* | 401 | 200 | 200 | 200 | 200 | 200 | 403 |
| `PATCH` | `/api/users/me/profile` | 401 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET` | `/api/settings/policy` | 401 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET` | `/api/settings` | 401 | 403 | 200 | 403 | 403 | 403 | 403 |
| `PUT` | `/api/settings` *(valid body)* | 401 | 403 | 200 | 403 | 403 | 403 | 403 |
| `GET` | `/api/syllabi` | 401 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET` | `/api/syllabi?scope=repository` | 401 | 200 | 200 | 200 | 200 | 200 | 403 |
| `POST` | `/api/syllabi/drafts` *(assigned)* | 401 | 200 | 200 | 403 | 403 | 403 | 403 |
| `GET` | `/api/syllabi/7/content` *(other's draft)* | 401 | 404 | 404 | 404 | 404 | 404 | 403 |
| `PUT` | `/api/syllabi/7/content` *(other's draft)* | 401 | 404 | 404 | 403 | 403 | 403 | 403 |
| `POST` | `/api/syllabi/:id/stage-clear` *(in turn)* | 401 | 403 | 200 | 200 | 200 | 403 | 403 |
| `PUT` | `/api/syllabi/:id` `status=approved` *(3 clears)* | 401 | 403 | 403 | 403 | 403 | 200 | 403 |
| `PUT` | `/api/syllabi/:id` `status=rejected` *(3 clears)* | 401 | 403 | 403 | 403 | 403 | 200 | 403 |
| `GET` | `/api/syllabi/2/versions` | 401 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET` | `/api/syllabi/2/review` | 401 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET` | `/api/syllabi/2/comments` | 401 | 200 | 200 | 200 | 200 | 200 | 403 |
| `POST` | `/api/syllabi/:id/comments` | 401 | 403 | 201 | 201 | 201 | 201 | 403 |
| `GET` | `/api/syllabi/comment-summary` | 401 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET` | `/api/syllabi/2/stages` | 401 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET` | `/api/syllabi/2/compliance` | 401 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET` | `/api/compliance?syllabus=all` | 401 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET` | `/api/compliance/program-approvals` | 401 | 403 | 200 | 200 | 200 | 200 | 403 |
| `GET` | `/api/compliance/history` | 401 | 403 | 200 | 200 | 200 | 200 | 403 |
| `GET` | `/api/syllabus-check/status` | 401 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET` | `/api/syllabus-check/references` | 401 | 403 | 200 | 403 | 403 | 403 | 403 |
| `GET` | `/api/syllabus-check/runs/1/decisions` *(facultyA's run)* | 401 | 200 | 404 | 404 | 404 | 404 | 403 |
| `GET` | `/api/institution/outcomes` | 401 | 200 | 200 | 200 | 200 | 200 | 403 |
| `PUT` | `/api/institution/outcomes` | 401 | 403 | 400 | 403 | 403 | 403 | 403 |
| `GET` | `/api/programs` | 401 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET` | `/api/programs/1/po-reference` | 401 | 403 | 200 | 403 | 403 | 403 | 403 |
| `GET` | `/api/courses` | 401 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET` | `/api/academic-years` | 401 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET` | `/api/deadlines` | 401 | 403 | 200 | 403 | 403 | 403 | 403 |
| `GET` | `/api/deadlines/mine` | 401 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET` | `/api/messages` | 401 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET` | `/api/messages/2` *(owner + Dean only)* | 401 | 200 | 200 | 403 | 403 | 403 | 403 |
| `GET` | `/api/notifications` | 401 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET` | `/api/logs` *(own activity, no IP)* | 401 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET` | `/api/logs?scope=all` *(Admin audit + IP)* | 401 | 403 | 200 | 403 | 403 | 403 | 403 |
| `POST` | `/api/usage/heartbeat` | 401 | 200 | 200 | 200 | 200 | 200 | 403 |

---

## 8. Human Sign-Off Sheet

Every `HUMAN` gate item requires explicit owner review and signature before advancing to production:

| Check ID | Item Requiring Human Decision / Sign-Off | Name | Date | Decision (`APPROVED` / `HOLD`) |
|---|---|---|---|---|
| `A13` | **Direct Commit Review:** Confirm the 25 direct commits on `Updated-Repo` since merged PR `#57` (`bd48551b` .. `c7c4b018`, listed in `evidence/A13.log`) have been reviewed for unintended changes. | `____________________` | `____-__-__` | `____________` |
| `D03` | **Credentials Rotation & AI Cost Caps:** Confirm fresh production credentials (never shared with local `server/.env`) are generated for `SESSION_SECRET`, `DB_PASS` (least-privilege user), `SMTP_PASS`, and `ANTHROPIC_API_KEY`/`GEMINI_API_KEY`, and approve hard USD/request caps (`SYLLABUS_CHECK_REPLAN_MAX_COST_USD`, `SYLLABUS_CHECK_GENERATE_MAX_COST_USD`, `SYLLABUS_CHECK_GENERATE_PER_USER_PER_DAY`, `AI_CHECKS_PER_DAY`, provider console monthly billing ceiling). | `____________________` | `____-__-__` | `____________` |
| `E01` | **Named Release & Gate Owners:**<br>• Deployment Owner: `____________________`<br>• Database Backup/Restore Owner: `____________________`<br>• Post-Deploy Smoke Test Owner: `____________________`<br>• VPAA UAT Sign-Off Owner: `____________________`<br>• Go / No-Go Decision Owner: `____________________` | `____________________` | `____-__-__` | `____________` |
| `E02` | **User Communication Plan:** Confirm faculty & reviewer announcement date, maintenance window, support contact channel, and first-release known-limitations note. | `____________________` | `____-__-__` | `____________` |

---

## 9. What Was Not Tested and Why

1. **GitHub Actions Hosted Runner Execution (`A11` — `BLOCKED`):** Candidate commit `c7c4b018` is 6 commits ahead of `origin/Updated-Repo` (not pushed), `gh` CLI is not installed locally, and contacting `api.github.com` requires owner permission under Hard Rule 10.
2. **Node 22 Runtime Execution (`A12` — `BLOCKED`):** Only Node `v26.12.1` is installed on this Windows host (`nvm`, `fnm`, and Node 22 binaries are absent).
3. **Live Staging & Production `.env` Files (`D02` — `BLOCKED`) and Phases 2 & 3 (`S01`–`S15`, `P01`–`P09`):** Staging URLs, Production URLs, and `.env` paths were specified as `NONE`; this invocation scoped strictly to **Phase 1**.
4. **Live Paid AI Provider Calls & Live Outbound SMTP Delivery:** Intentionally replaced with deterministic offline stand-ins (`scripts/e2e/offline-provider.cjs` + `qa-preload.cjs` and `SMTP_HOST=''`) per Hard Rules 4 and 5; real provider smoke tests belong to Phase 2 (`S09`, `S06`) with owner-approved staging keys and test mailboxes.
5. **Mozilla Firefox Browser Run (`B15` optional):** Microsoft Edge (`158.0.4370.33`) and Google Chrome (`157.0.8103.79`) were both executed end-to-end; Firefox is not installed on this machine (marked optional in `B15`).
6. **3 DB-Dependent Historical Scripts under `scripts/` (`A07`):** `scripts/lcup-po-correction/workflow.test.jsx`, `scripts/po-controlled-activation/migration.test.cjs`, and `scripts/po-development-activation/migration.test.cjs` open raw DB connections without scratch-DB guards and were skipped per `A07`'s explicit safety rule.

---

## 10. Cleanup Record

Verified in `C:\Users\JP Del Rosario\Syllabus-QA\2026-11-25\evidence\CLEANUP.log`:

- **Scratch Databases Created & Dropped (every name verified to contain both `e2e` and `qa` before `DROP DATABASE`):**
  - `syllabus_e2e_qa_bootstrap` (`A09` — dropped automatically by `db-bootstrap-check.cjs`)
  - `syllabus_e2e_qa_carbon` (`A10`, `D04`, `D05`, `C08`, `C09` — dropped during final cleanup)
  - `syllabus_e2e_qa_api` (`D06`, `B01`–`B03`, `B08`–`B13`, `B16_api`, `C03`, `C05`–`C07` — dropped by `run-api-security-qa.cjs`)
  - `syllabus_e2e_qa_browser` (`B14`, `B15`, `B06`, `B07`, `C04` — dropped by `run-browser-qa.cjs`)
  - `syllabus_e2e_qa_verify` (`B05`, `B09`, `B10`, `B12`, `C01` — dropped by `run-targeted-verify.cjs`)
  - `syllabus_e2e_qa_b04` (`B04` — dropped during final cleanup)
- **Development Database Safety:** `syllabus_cms_plus` was **never** connected to, queried, migrated, or modified (`syllabus_cms_plus intact and untouched: true`). XAMPP MariaDB (`3306`) and owner dev processes (`3001`, `5173`) were never stopped or restarted.
- **Processes & Scratch Ports:** All QA child servers and headless browser instances terminated cleanly; ports `3201`, `3231`, `3239`, `3241`, `3245`, `3247`, `3643`, `3644`, `3672`, `3681`, `3682`, `3685`, `3686`, `3687`, `3688` verified free (`true`).
- **Owner Repository State:** `git status --porcelain` of `C:\Users\JP Del Rosario\Syllabus-Repository` had `0` modified/untracked entries before writing this report, and contains **only** `?? docs/deployment/QA-RELEASE-GATE-REPORT-2026-11-25-phase1.md` afterward. All 72 raw logs, matrices, exports, and screenshots remain in `C:\Users\JP Del Rosario\Syllabus-QA\2026-11-25\evidence\`.
