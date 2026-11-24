# Pre-Deployment Readiness Report — 2026-11-24

**Repository:** `Syllabus-Repository` (branch `Updated-Repo`, audited read-only on 2026-11-24)  
**Scope:** React 19 + Vite 8 frontend (`src/`), Node/Express API (`server/`), MariaDB/MySQL schema & migrations (`server/db/`), AI Syllabus Checker & Generator (`server/lib/syllabuscheck/`).  
**Throwaway DB used:** New empty schemas `syllabus_e2e_audit_20261124` and `syllabus_e2e_audit_schema_20261124` (dropped immediately after verification; dev schema `syllabus_cms_plus` was never touched; Docker daemon was not running).

---

## 1. Verdict

**NOT READY**

The core application security, authorization invariants, fail-closed startup guards, and main test suite (`npm test` 1,747/1,747 assertions, `npm run test:vpaa` 37/37, `npm run test:db-bootstrap` 38 migrations / 48 tables) are in strong shape, proving the core product logic is solid. However, deploying from git today would immediately break because **145 uncommitted changes (including 11 untracked runtime/migration files imported by tracked code)** exist on `Updated-Repo`, while production operations still lack a verified CI run, a `start` script / process manager, TLS/port support in 34+ migration scripts, and a tested backup/restore drill. In addition, root production dependencies carry 1 **critical** `jspdf` ReDoS vulnerability, credentials in local `server/.env` (including a chat-exposed Gmail app password) must be rotated into fresh environment-specific secrets, and `schema.sql`/DDLs omit explicit `ENGINE=InnoDB` and `DEFAULT CHARSET=utf8mb4`.

---

## 2. Blockers (Must Fix Before Deploy)

| # | Area | Finding | Evidence | Suggested Fix |
|---|---|---|---|---|
| B1 | Git / Release Hygiene | **145 uncommitted items on `Updated-Repo` (123 modified/staged, 22 untracked), including 11 untracked runtime/migration files imported by tracked files.** A deploy from git will fail at build and runtime. | `git status --porcelain`: 123 modified, 22 untracked. Tracked files import untracked `server/lib/corPrograms.js` (`corClaude.js`, `corParser.js`, `students.js`), `server/lib/pdfImportJobs.js` (`routes/pdfImport.js`), `shared/corTerms.cjs` (`students.js`, `StudentRegister.jsx`), `src/components/CorTermsModal.jsx`, `LoginConstellation.jsx`, `ReviewProgress.jsx`, `src/lib/builderRoute.js`, `corTerms.js`, `passwordRule.js`, `pdfImportResume.js`, and `server/db/migrate-version-labels.js` (`syllabusRules.js`). | Review, commit, and tag a clean release commit on `main` (or release branch) before deploying; verify `git status` is clean. |
| B2 | Credentials & Secrets | **Credentials require rotation and fresh production provisioning** (`SMTP_PASS` flagged `EXPOSED` in project notes; `DB_PASS` empty in dev; `DB_USER=root` in dev; `ANTHROPIC_API_KEY` is dev key). | `node scripts/credential-readiness.cjs --env-file server/.env` → exit `1` (3 manual actions: `DB_PASS` EMPTY, `SMTP_PASS` EXPOSED, plus `DB_USER` is admin account); `docs/security/SECURITY-AUDIT-REPORT.md:374`. | Generate fresh unique `SESSION_SECRET` (32+ chars), least-privilege non-root `DB_USER`/`DB_PASS`, new prod `ANTHROPIC_API_KEY` with workspace spend limit, and new `SMTP_PASS` (revoke old Gmail app password and Gemini key). Never copy `server/.env` to prod. |
| B3 | Dependencies | **1 Critical vulnerability in production frontend dependencies: `jspdf` Regular Expression Denial of Service (ReDoS)** (plus 1 moderate). | `npm audit --omit=dev` (root) → `critical: 1, moderate: 1` (`jspdf@2.5.2`). `server/` has `0` vulnerabilities. | Upgrade `jspdf` to a patched version (or evaluate replacing PDF export path) and re-run `npm audit --omit=dev` + `npm run build`. |
| B4 | Database Migrations | **`init.js` and 34 of 38 `migrate-*.js` scripts do not read `DB_SSL` / `DB_SSL_CA` (and 34 do not read `DB_PORT`).** Remote cloud MySQL/MariaDB requiring TLS or a custom port will fail during provisioning/migration. | `server/db/init.js:8-12` uses only `DB_HOST/DB_USER/DB_PASS/DB_NAME`; only 4 of 38 `migrate-*.js` scripts read `DB_PORT`, and 0 of 38 read `DB_SSL`. Meanwhile `server/lib/dbConfig.js:77-80` mandates `DB_SSL=required` for non-loopback production DBs. | Update `init.js` and all `migrate-*.js` to share a connection helper from `server/lib/dbConfig.js` (supporting `DB_PORT`, `DB_SSL`, `DB_SSL_CA`) or document an SSH/TLS tunnel requirement for migrations. |
| B5 | Database Schema | **`init.js`, `schema.sql` (42 tables), all 13 `*-ddl.js`, and all 38 `migrate-*.js` omit explicit `ENGINE=InnoDB` and `DEFAULT CHARSET=utf8mb4`.** Relies entirely on server defaults. | `server/db/init.js:18`, `server/db/schema.sql:1-493`. (Throwaway schema `syllabus_e2e_audit_schema_20261124` inherited InnoDB + utf8mb4 from local server defaults, but a differently configured host would silently break Unicode/en-dashes `2026–2027` or FKs.) | Verify production DB defaults (`character_set_server=utf8mb4`, `default_storage_engine=InnoDB`) **and** add `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` to `init.js` and `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4` to `schema.sql`/DDLs. |
| B6 | Operations / Process Mgmt | **No production `start` script, no process manager config (PM2/systemd/Docker), no backup/restore test, and no monitoring/alerting configured.** | `server/package.json:12` has only `"dev": "node --watch index.js"` (no `"start"` script); `docs/deployment/RUNBOOK.md:3,25` ("No backup or restore has been performed"); `docs/deployment/MONITORING.md:3` ("no metrics endpoint, no request-logging middleware and no alerting"). | Add `"start": "node index.js"` in `server/package.json`, configure systemd/PM2/Docker restart policy (never `--watch`), set up uptime monitor on `/api/health` + proxy 5xx/401 alerts + Anthropic spend alerts, and execute a real backup + restore drill before G3. |
| B7 | Frontend Build Config | **`VITE_NEW_BUILDER=true` is required at build time** — without it, production builds silently ship the legacy builder instead of `builder2`! | `src/App.jsx:51` (`VITE_NEW_BUILDER === 'true'`); `scripts/e2e/stack.cjs:36-38` notes a clean checkout without root `.env` builds the legacy builder; `production.env.template:25` only mentions `VITE_API_URL`, omitting `VITE_NEW_BUILDER`. | Document `VITE_NEW_BUILDER=true` in `production.env.template`, `RUNBOOK.md`, and CI build env (or make `builder2` the default in `src/App.jsx`). |

---

## 3. High / Medium / Low Findings

### High

| # | Area | Finding | Evidence | Suggested Fix |
|---|---|---|---|---|
| H1 | Database Integrity | **Destructive `ON DELETE CASCADE` on `syllabi.user_id`, `syllabus_versions.created_by`, `comments.user_id`, `syllabus_review_stages.reviewer_id`, `syllabus_review_ai_choices.reviewer_id`, `syllabus_check_decisions.user_id`, `subject_deadlines.created_by`.** Direct DB deletion of a user/reviewer would wipe approved syllabi, versions, review clearances, and comments (app routes block deleting accounts tied to approved syllabi, but DB schema does not). | `server/db/schema.sql:118, 156, 231, 366, 412, 427, 442`; verified via `information_schema.REFERENTIAL_CONSTRAINTS` on throwaway schema (62 FKs). | Never hard-delete staff accounts in production (use `POST /api/users/:id/disable`); consider migrating reviewer/creator FKs to `ON DELETE RESTRICT` or `SET NULL`. |
| H2 | AI Cost Control | **`pipeline/judge.js` does not short-circuit remaining question groups on `provider_budget` ("credit balance too low") or 401/403.** Remaining groups (~15–20 requests) still fire before returning an incomplete report, and no 300s cooldown exists despite `MONITORING.md` claiming one. | `server/lib/syllabuscheck/pipeline/judge.js:110-164`; `server/lib/syllabuscheck/anthropicClient.js:113-116, 138, 194`; `docs/deployment/MONITORING.md:15, 28`. | Abort remaining judge groups immediately on `provider_budget` / auth errors (`401/402/403`), and either implement or remove the documented 300s cooldown claim. |
| H3 | Backups | **Uploaded files (`UPLOAD_DIR` = `server/uploads/` and `PRIVATE_DIR` = `server/private/` for avatars & CORs) have no documented backup/restore procedure.** | `docs/deployment/RUNBOOK.md:25` covers `mysqldump` only; `docs/deployment/STAGING-ARCHITECTURE.md:21` mentions persistent disk for `uploads/` and omits `server/private/`. | Add encrypted off-host daily sync/backup of both `UPLOAD_DIR` and `PRIVATE_DIR` to `RUNBOOK.md` and mount both on persistent storage. |
| H4 | CI / Testing | **`.github/workflows/ci.yml` has never been verified on a GitHub runner, and 21 test files are not wired into `npm test` (6 of 37 assertions in offline `scripts/` tests currently fail).** | `.github/workflows/ci.yml:1`; `audit_part1.cjs` found 21 unreached test files (13 app/server tests passed: 66 pass / 3 skipped / 0 fail; 5 offline script tests had 31 pass / 6 fail: `baseline.test.mjs:19` `46 !== 47`, 3 `ENOENT` in `fixture.test.mjs` for missing `docs/academic-references/*.pdf`, `verification.test.mjs:37` `'Apply to form'` vs `'Apply and AI CHECK'`, `source.test.mjs:46` missing throw). | Run CI on GitHub before staging; add the 13 app/server tests (including `src/i18n/i18n.test.js`, `reportCsv.test.js`, `syllabusDocx.test.js`, `preferences.routes.test.js`, `students.syllabi.routes.test.js`) to `npm test`, and update or archive stale `scripts/` tests. |
| H5 | Security / Repo Hygiene | **Tracked files include `big.json` (200 KB), `conversation-export.md`, `sample_syllabus/`, `docs/lcup-academic-benchmark/package/cases.json` (5.55 MB), and real syllabus PDFs/scans under `reference-data/` (`SEC-18`).** | `git ls-files`: `big.json`, `conversation-export.md`, `sample_syllabus/`, `docs/lcup-academic-benchmark/package/cases.json` (5.55 MB); `docs/security/SECURITY-AUDIT-REPORT.md:192`. | Remove scratch files (`big.json`, `conversation-export.md`) from git, add `big.json` to `.gitignore`, and confirm institutional approval for any tracked reference PDFs. |

### Medium

| # | Area | Finding | Evidence | Suggested Fix |
|---|---|---|---|---|
| M1 | Docs Drift | **Deployment docs contradict current code in several places.** | `STAGING-ARCHITECTURE.md:11,20,41-46` says MemoryStore is used & DB sessions "Not implemented" (actually `MySqlSessionStore` is mandatory in `server/index.js:22,41-52`); `RUNBOOK.md:20,28,52` references removed `scripts/vpaa-v2-preflight.cjs`, Policy V2, `JWT_SECRET`, and "24 migrations / 39 tables" (actually 38 migrations / 48 tables); `MONITORING.md:14,15,30,32` references removed `hybrid.academicV2` and 300s cooldown; `HOW-TO-RUN.md:51` lists retired `JWT_SECRET`. | Update `RUNBOOK.md`, `STAGING-ARCHITECTURE.md`, `MONITORING.md`, and `HOW-TO-RUN.md` to match the current codebase before handoff. |
| M2 | Env Templates | **Key runtime env vars are missing from `staging.env.template` & `production.env.template`.** | Missing from both: `UPLOAD_DIR`, `PRIVATE_DIR`, `SMTP_SECURE`, `SYLLABUS_PDF_IMPORT`, `SYLLABUS_PDF_IMPORT_CONCURRENCY`, `ALLOWED_EMAIL_DOMAIN`, `AI_CHECKS_PER_MINUTE_PER_USER`, `SYLLABUS_CHECK_GENERATE*`, `SYLLABUS_CHECK_REFINE_*`, `VITE_NEW_BUILDER`. | Document all production-configurable env vars in `production.env.template` and `staging.env.template`. |
| M3 | Feature Flag Default | **`SYLLABUS_CHECK_GENERATE_PER_USER_PER_DAY` defaults to `null` (unlimited).** If `SYLLABUS_CHECK_GENERATE=on` is enabled in prod, one user could run repeated generations up to the Anthropic workspace cap. | `server/routes/syllabusCheck.js:173`. | Set `SYLLABUS_CHECK_GENERATE_PER_USER_PER_DAY` (e.g., `5`) whenever `SYLLABUS_CHECK_GENERATE=on` is enabled. |
| M4 | Authorization Consistency | **Two read endpoints omit `reviewStages.assertReviewerMayOpen()`** (unlike `GET /:id/review`, `GET /:id/content`, `GET /:id/stages`, `GET /:id/comments`). | `server/routes/syllabi.js:392` (`GET /:id/versions`) and `server/routes/syllabusFiles.js:42` (`GET /:id/file`) check `canReadApproved` without `assertReviewerMayOpen()`. | Add `reviewStages.assertReviewerMayOpen()` to both endpoints for uniform stage-turn visibility. |
| M5 | Environment Parity | **Local Node is `v26.12.1` vs CI `node-version: 22`; no `engines` field in `package.json`/`server/package.json` and no `.nvmrc`.** | `node -v` → `v26.12.1`; `.github/workflows/ci.yml:23,56` → `22`; `package.json` & `server/package.json` have no `engines` field. | Pin `.nvmrc` (`22`) and `"engines": { "node": ">=22 <27" }` and run `npm test` on Node 22 before release. |
| M6 | Rate Limiting / Quotas | **Login rate limits (`signInLimits.js`) and daily AI quotas (`aiQuota.js`) are in-memory per process** (reset on restart and not shared across multiple instances). | `server/lib/signInLimits.js`, `server/lib/aiQuota.js:12-68`. | Keep a single API instance (per `STAGING-ARCHITECTURE.md`) and add reverse-proxy / Cloudflare rate limiting on `/api/auth/*`. |
| M7 | Seed Safety | **`seed-student-demo.js` and `seed-student-demo-syllabi.js` have no `NODE_ENV` guard** (unlike `init.js` which skips `seed.sql` in staging/prod). | `server/db/seed-student-demo.js:1-36`, `server/db/seed-student-demo-syllabi.js:1-100`. | Add a `NODE_ENV === 'production'` refusal guard to both demo seed scripts. |
| M8 | Graceful Shutdown | **`SIGINT`/`SIGTERM` handler does not close the HTTP server or MySQL pool cleanly before `process.exit(0)`.** | `server/index.js:69` calls `usage.stop()` and `deadlineNotices.stop()` then `process.exit(0)` without `server.close()` or `pool.end()`. | Close HTTP listener and `pool.end()` during graceful shutdown to avoid mid-flight request drops on deploy. |

### Low

| # | Area | Finding | Evidence | Suggested Fix |
|---|---|---|---|---|
| L1 | Bundle Size | **Main frontend JS chunk is 1,874.88 kB (554.97 kB gzip)**, triggering Vite's >500 kB warning. | `npm run build` output: `dist/assets/index-0JApxyfZ.js 1,874.88 kB │ gzip: 554.97 kB`; `index-DdnmkS0k.css 366.75 kB`; `jspdf.es.min 341.69 kB`. | Lazy-load heavy views (`SyllabusBuilder`, `Analytics`, `Reports`, `AIChecker`) with `React.lazy()`. |
| L2 | Code Hygiene | **Commented-out demo credentials (`admin123` / `faculty123`) remain in `Login.jsx` source.** | `src/components/Login.jsx:55-58`. | Delete the commented-out demo login buttons. |
| L3 | Hardcodes | **Institution/program hardcodes exist in runtime code** (`BSIT-CYBERSECURITY` inheritance, `BSIT/BSCPE/BSIE` in COR parser, `/cite-logo.png`, `email.lcup.edu.ph` default). | `server/lib/programs.js:75,88,102`, `server/routes/programs.js:50-54`, `server/lib/corPrograms.js:8-10`, `server/lib/programPoReferences.js:89`, `server/lib/emailDomain.js:3`. | Acceptable for LCUP CITE deployment; document if ever reused for other colleges/schools. |
| L4 | Schema FKs | **Minor missing FKs**: `syllabus_review_stages.version_id`, `syllabus_review_ai_choices.version_id`, `users.disabled_by`, `deadline_notices.sent_by`, `syllabus_check_curricula.created_by`. | `server/db/schema.sql:13, 374, 391, 419, 434`. | Add optional FKs in a future non-breaking migration. |
| L5 | Logging | **Plain `console.log`/`console.error` only, no structured JSON logs or rotation; startup prints `http://localhost:${PORT}`.** | `server/index.js:117-124`, `server/lib/http.js:28-31`. | Configure log rotation at the host/process-manager level and reverse-proxy access logs omitting `Cookie`/`Authorization`/bodies. |
| L6 | Dev-only flag | **`COMPLIANCE_AI_PROVIDER=mock` has no `NODE_ENV` guard.** | `server/lib/compliance/service.js:159-160`. | Ensure `COMPLIANCE_AI_PROVIDER` is unset in production (or refuse `mock` when `NODE_ENV=production`). |

---

## 4. Command Log

| Command | Exit Code | Pass / Fail / Skipped | Duration | Notes |
|---|---:|---|---:|---|
| `node -v` | 0 | `v26.12.1` | <1s | Local Node 26 vs CI Node 22 |
| `git status --porcelain` | 0 | 145 items (123 mod, 22 untracked) | <1s | Branch `Updated-Repo` |
| `npm ls --depth=0` (root) | 0 | Clean (0 missing/extraneous) | <2s | Lockfile in sync |
| `npm --prefix server ls --depth=0` | 0 | Clean (0 missing/extraneous) | <2s | Lockfile in sync |
| `npm test` (offline, AI env cleared) | 0 | **1,747 pass, 0 fail** (`1613` unit/route/security + `24+55+5` localization + `20` PDF-import UI + `30` VPAA UI) | 84.58s | All suites green |
| `npm run test:vpaa` | 0 | **37 pass, 0 fail** (7 server + 30 UI) | 45.29s | All VPAA conformance checks green |
| `VITE_API_URL=https://api.invalid/api npm run build` | 0 | Built cleanly (382 modules) | 10.81s (6.64s Vite) | Warning: `index-*.js` 1,874.88 kB (>500 kB) |
| `npm run audit:i18n` | 0 | 3,002 bilingual keys, 1,614 refs, 0 hardcoded | 3.45s | Clean |
| `npm audit --omit=dev` (root) | 0 (parsed) | **1 critical (`jspdf`), 1 moderate** | <3s | **Blocker B3** |
| `npm --prefix server audit --omit=dev` | 0 | **0 vulnerabilities** | <3s | Clean |
| `node scripts/credential-readiness.cjs --env-file server/.env` | 1 | 3 manual actions (`DB_PASS`, `SMTP_PASS`, test placeholder in `security.conformance.test.js`) | ~3s | No secret values printed |
| `E2E_DB_NAME=syllabus_e2e_audit_20261124 npm run test:db-bootstrap` | 0 | **38 migrations, 48 tables, 0 missing, 0 problems** | 21.32s | Throwaway schema created & dropped |
| Throwaway schema `SHOW TABLES`/FK inspection (`syllabus_e2e_audit_schema_20261124`) | 0 | 48 InnoDB, 48 utf8mb4, 0 non-utf8mb4 cols, 62 FKs | ~22s | Throwaway schema dropped after check |
| 13 unreached app/server tests (`node --test ...`) | 0 | **66 pass, 0 fail, 3 skipped** (missing optional PDF fixtures) | 3.00s | All runnable tests passed |
| 5 unreached offline `scripts/` tests (`node --test ...`) | 1 | **31 pass, 6 fail** | 2.34s | Failures: `baseline.test.mjs:19` (`46!==47`), `fixture.test.mjs:109,118,125` (`ENOENT` PDF), `verification.test.mjs:37` (label drift), `source.test.mjs:46` |
| `npm run test:e2e` | **SKIPPED** | — | — | **SKIPPED — Rule 1:** `scripts/e2e/run-e2e.cjs:54,83` deletes/rewrites `docs/vpaa-conformance/e2e/` in the repo working tree, violating the read-only ground rule. |
| 3 remaining `scripts/` tests (`lcup-po-correction/migration.test.cjs`, `po-controlled-activation/migration.test.cjs`, `browser.test.mjs`) | **SKIPPED** | — | — | **SKIPPED — Rules 1 & 4:** DB migration / browser scripts not verified safe from dev DB or working-tree writes. |

---

## 5. Environment Parity Matrix

| Dimension | Local Dev (Audited) | GitHub CI (`ci.yml`) | Staging (`STAGING-ARCHITECTURE.md` / `staging.env.template`) | Production (`RUNBOOK.md` / `production.env.template`) |
|---|---|---|---|---|
| **OS** | Windows | `ubuntu-latest` | Linux (glibc required for `@napi-rs/canvas`, `sharp`, `tesseract.js`) | Linux (glibc required; avoid musl/alpine) |
| **Node.js** | `v26.12.1` | `22` | `22+` (no `.nvmrc` / `engines` pinned) | `22+` (pin to 22 LTS to match CI) |
| **Database** | XAMPP MariaDB (local `root`, empty pass, no TLS, `max_allowed_packet` default 1M) | `mariadb:10.11` (Docker service, root) | Dedicated MySQL 8 / MariaDB 10.11+, non-root least-privilege user, `DB_SSL=required`, `max_allowed_packet >= 16M` | Dedicated MySQL 8 / MariaDB 10.11+, non-root least-privilege user, `DB_SSL=required`, `max_allowed_packet >= 16M` (64M recommended) |
| **Session Store** | `mysql` (in `server/.env`) | In-memory (unit tests) | `SESSION_STORE=mysql` (enforced; `memory` refused) | `SESSION_STORE=mysql` (enforced; `memory` refused) |
| **Frontend Build** | `vite` dev server (`apply: 'serve'` CJS shim) | `npm run build` (`VITE_API_URL=https://api.invalid/api`; **note:** `VITE_NEW_BUILDER` not set in `ci.yml`!) | Static `dist/` built with `VITE_API_URL` + `VITE_NEW_BUILDER=true` | Static `dist/` (e.g., Cloudflare Pages) built with `VITE_API_URL` + `VITE_NEW_BUILDER=true` |
| **API Process** | `npm run dev` (`node --watch index.js`) | Ephemeral test harnesses | Single long-running `node index.js` (PM2 / systemd / Docker — **not yet configured**) | Single long-running `node index.js` (never `--watch`; **not yet configured**) |
| **Reverse Proxy** | None (`localhost:3001`) | None | TLS-terminating proxy (`TRUST_PROXY=<hops>`, >=10 min read timeout on AI check routes) | Cloudflare (Full strict, Bypass Cache on `/api/*`, watch 100s timeout on sync AI checks) + TLS origin proxy (`TRUST_PROXY=<hops>`) |
| **AI & SMTP** | Live Anthropic key + live Gmail SMTP in `server/.env` | Offline scripted provider, no SMTP | Dedicated staging Anthropic key + spend cap; SMTP optional | AI **OFF** until G2/G3 approval; dedicated prod Anthropic key + caps; fresh prod SMTP relay |

---

## 6. Pre-Deploy Checklist (Owner Sign-Off)

- [ ] **Git & Release:** Commit all 22 untracked runtime/test files and 123 modified files on a clean release branch/tag; remove `big.json`, `conversation-export.md`, and commented-out demo logins in `src/components/Login.jsx:55-58`.
- [ ] **Dependency Fix:** Patch critical `jspdf` vulnerability (`npm audit --omit=dev` = 0 high/critical in both root and `server/`).
- [ ] **CI Verification:** Run `.github/workflows/ci.yml` on GitHub and confirm green (`test` + `database-bootstrap`).
- [ ] **Credential Rotation:** Rotate/provision fresh production values for `SESSION_SECRET` (32+ chars), `DB_USER`/`DB_PASS` (least privilege, non-root), `SMTP_PASS` (revoke exposed Gmail app password), `ANTHROPIC_API_KEY` (own workspace + spend cap), and revoke unused `GEMINI_API_KEY`.
- [ ] **Database Provisioning:** Verify `max_allowed_packet >= 16777216` (16 MB), `character_set_server=utf8mb4`, `default_storage_engine=InnoDB`, `DB_SSL=required`.
- [ ] **Migrations:** Run `NODE_ENV=production node server/db/init.js` (skips `seed.sql`) + all required migrations (`migrate-students`, `migrate-subject-term`, `migrate-academic-year-scope`, `migrate-catalog-year`, `migrate-po-reference-publication`, plus `migrate-version-labels` if upgrading an existing DB). Confirm 0 demo/UAT accounts exist.
- [ ] **First Real Admin:** Create initial production admin via `CREATE_ADMIN_EMAIL=... CREATE_ADMIN_PASSWORD=... node server/db/create-admin.js` (must change password on first login).
- [ ] **Feature Flags & Env:** Set `NODE_ENV=production`, `SESSION_STORE=mysql`, `TRUST_PROXY=<hops>`, `CORS_ALLOWED_ORIGINS=https://<frontend>`, `SESSION_COOKIE_SAMESITE=lax` (same-site domain), `SYLLABUS_CHECK_GENERATE=off` (or set `SYLLABUS_CHECK_GENERATE_PER_USER_PER_DAY` if on), `SYLLABUS_CHECK_REPLAN_MAX_COST_USD` (if AI on), `COMPLIANCE_AI_PROVIDER` unset.
- [ ] **Frontend Build:** Build with `VITE_API_URL=https://<api>/api` AND `VITE_NEW_BUILDER=true` (and `VITE_GOOGLE_CLIENT_ID` if Google Sign-In enabled); register production origin in Google Cloud Console.
- [ ] **Storage, Process Manager & Backups:** Mount persistent volumes for `UPLOAD_DIR` and `PRIVATE_DIR`; add `"start": "node index.js"` + systemd/PM2/Docker restart policy; configure automated encrypted DB + upload backups and **verify a restore** into a scratch DB.
- [ ] **Monitoring & Proxy:** Configure uptime check on `GET /api/health`, proxy 5xx/401 alerts, Cloudflare SSL = Full (strict), Bypass Cache on `/api/*`, and Anthropic spend alerts (50%/80%).

---

## 7. Rollback Procedure & Post-Deploy Smoke Test

### Step-by-Step Rollback Procedure
*(Note: No automated down-migrations exist; schema rollback requires restoring the pre-deployment dump. Additive migrations are generally backward-compatible, but `migrate-version-labels.js` and `migrate-catalog-year.js` are NOT backward-compatible.)*

1. **Contain immediately (no authorization needed for safe shutoff):**
   - To disable AI immediately: set `SYLLABUS_CHECK_AI_PROVIDER=` (empty) and `SYLLABUS_CHECK_GENERATE=off`, then restart the API; if runaway spend is suspected, disable the API key in the Anthropic workspace.
2. **Capture incident evidence:** Copy API logs and take a fresh `mysqldump` of the current state before reverting.
3. **Application-only rollback (when schema changes were additive):**
   - Re-deploy the previous known-good frontend `dist/` bundle to Cloudflare Pages (Pages → Deployments → Rollback).
   - Check out the previous git release tag on the API host, run `npm ci` in `server/`, restore the previous env file if changed, and restart the Node process.
4. **Database rollback (destructive — requires explicit owner authorization):**
   - Put the frontend in maintenance mode (or pause API traffic at Cloudflare/proxy) and stop the Node API process.
   - Restore the pre-deployment dump: `mysql -u <migration_user> -p <db_name> < <pre-deploy-dump>.sql` (typically < 1–5 minutes for institutional syllabus volumes).
   - Restore `UPLOAD_DIR` / `PRIVATE_DIR` snapshot if file layout changed.
   - Start the previous API release and verify `GET /api/health` returns HTTP 200 `{"status":"ok","database":"ok"}`.
5. **Credential compromise rollback:** Rotate `SESSION_SECRET` (invalidates all sessions), revoke compromised SMTP/Anthropic/DB credentials, restart API.

### 10-Step Post-Deploy Manual Smoke Test
1. **Health check:** `curl -i https://<api>/api/health` → HTTP `200`, `{"status":"ok","database":"ok"}`, `Cache-Control: no-store`, no `X-Powered-By`, no secrets.
2. **Auth & headers:** Sign in as each role (Admin/Dean, Faculty, Asst. VPAA, LIC Director, VPAA, Student); verify `Set-Cookie` has `HttpOnly; Secure; SameSite=Lax`, refresh persists session, and each role sees only its authorized menu.
3. **Create draft (Faculty):** Open Syllabus Builder (`builder2` UI must load — proves `VITE_NEW_BUILDER=true`), select an assigned subject, edit Step 1 & Step 2, save draft, reload page, and confirm draft persists in **Syllabi**.
4. **PDF Upload / Import:** Upload a sample PDF syllabus in the Builder import flow; verify extraction completes without 500/524 timeout and `/uploads/...` direct URL returns `404`.
5. **Submit syllabus:** Complete required steps and submit; confirm status locks (`Edit` disabled) and reviewer queue updates.
6. **Review chain stages:** Sign in sequentially as **Dean**, **Asst. VPAA**, and **LIC Director**; verify each can clear only their own stage (out-of-order attempt returns 409) and cannot finalize approval.
7. **VPAA final approval:** Sign in as **VPAA**, approve the syllabus after all 3 stages are cleared; verify it appears in **Repository**, becomes immutable (cannot be edited/re-checked/deleted), and printed sign-off block shows all 4 names.
8. **Student view:** Sign in as a **Student**; verify only approved syllabi are visible and calling any non-student API (e.g., `GET /api/users`) returns `403`.
9. **Password reset (test inbox):** Trigger **Forgot Password** for a test account; confirm email arrives from `MAIL_FROM`, temporary password signs in once, is rejected on reuse, and forces password change.
10. **CORS & CSRF check:** Send a cross-origin `POST` from a foreign `Origin` header to `/api/auth/logout` or `/api/syllabi/drafts` → confirm HTTP `403` (`origin_not_allowed`).

---

## 8. What Could Not Be Verified

- **GitHub Actions CI:** `.github/workflows/ci.yml` has never been executed on a GitHub runner.
- **Docker `mariadb:10.11`:** Docker CLI is installed (`29.6.2`), but the Docker daemon was not running; DB bootstrap and schema checks ran against isolated throwaway schemas (`syllabus_e2e_audit_20261124` and `syllabus_e2e_audit_schema_20261124`) on the local MariaDB instance and were dropped immediately afterward.
- **Browser E2E (`npm run test:e2e`):** Skipped per Ground Rule 1 because `scripts/e2e/run-e2e.cjs` deletes and rewrites `docs/vpaa-conformance/e2e/` in the working tree.
- **3 legacy migration/browser script tests** (`scripts/lcup-po-correction/migration.test.cjs`, `scripts/po-controlled-activation/migration.test.cjs`, `browser.test.mjs`): Skipped to avoid any risk of mutating dev DB or working tree.
- **Real AI provider (Anthropic) & real SMTP:** Not tested per Ground Rules 2 & 3 (no paid AI calls, no live emails).
- **Production host, reverse proxy / Cloudflare timeout behavior, TLS certificates, and backup/restore drill:** No staging or production host is provisioned yet.
