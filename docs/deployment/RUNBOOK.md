# Deployment runbook, rollback and recovery (staging first, then production)

Hand-written preparation. **Nothing in it has been executed against a real environment.** No step deploys, migrates or changes a database by itself; each one needs a named person and written authorization. Commands that touch a real database are marked **[OWNER]**.

## 0. Roles and approval gates

| Gate | Who approves | Evidence they need |
|---|---|---|
| G1 Staging deployment | system owner | CI green (`npm test`, `npm run test:vpaa`, `npm run build`, db-bootstrap) at the exact commit; the read-only credential preflight exits 0 on the staging file |
| G2 Live Claude smoke test | the person who owns the spend decision, in writing: environment, configuration, maximum spend, date, operator | `docs/vpaa-conformance/STAGING-TEST-PLAN.md` section 3 (nine conditions) |
| G3 Production deployment | institution decision-maker (not the engineer) | a verified staging run, a tested backup restore, production security items closed (`ENGINEERING-REPORT.md` section 16) |

Nothing is auto-deployed. The CI workflow has no deploy job on purpose.

## 1. Pre-deployment checks (read-only)

1. `git status` is clean and the deployed commit is the tested one.
2. `npm test`, `npm run test:vpaa`, `npm run build` pass; `npm run test:db-bootstrap` passes; `npm run test:e2e` passes locally (it needs a local Edge/Chromium and MariaDB).
3. The database allows packets of at least 16 MB: `SELECT @@global.max_allowed_packet, @@session.max_allowed_packet;` as the application's user returns >= 16777216 (`docs/deployment/DATABASE-REQUIREMENTS.md`). A smaller value makes large checking reports fail to save.
4. `node scripts/credential-readiness.cjs --env-file <env>` exits 0. It prints names and statuses only. (The former `scripts/vpaa-v2-preflight.cjs` and Policy V2 setting `SYLLABUS_CHECK_ACADEMIC_V2` no longer exist.)
5. The environment file is the environment's own (`docs/deployment/staging.env.template`), `NODE_ENV` is `staging` or `production`, `SESSION_STORE=mysql` (the server refuses to start otherwise; run `migrate-session-store` first), and the AI settings match the plan: `SYLLABUS_CHECK_AI_PROVIDER` (`off` until paid AI checking is approved), a cost cap `SYLLABUS_CHECK_REPLAN_MAX_COST_USD`, and `SYLLABUS_CHECK_GENERATE` (`off`, or a per-person daily limit when on).

## 2. Database: backup, provisioning, migration

**Backup before every deployment [OWNER]:** `mysqldump --single-transaction --routines --triggers <db> > <db>-<UTC timestamp>.sql`, stored off the database host and **encrypted**; keep at least the last 7 daily and the pre-deployment dump. A backup is only real after a restore test: restore the newest dump into a scratch database and run `SELECT COUNT(*)` on `users`, `syllabi`, `syllabus_check_reports`. (No backup or restore has been performed by this preparation.)

**Back up the files too [OWNER]:** the database dump does not hold the uploaded files. Copy both `UPLOAD_DIR` (default `server/uploads/`, syllabus files) and `PRIVATE_DIR` (default `server/private/`, profile photos) off the host, encrypted, on the same schedule, and keep both on persistent storage (pre-deploy report 2026-11-24, H3).

**New database:** create the database and a least-privilege user (SELECT, INSERT, UPDATE, DELETE, plus CREATE/ALTER/INDEX only for the migration window). Run with `NODE_ENV=staging|production` so `init.js` does **not** insert the demo accounts:
`node server/db/init.js`, then every `migrate-*` script in the order of `server/package.json` (`npm run test:db-bootstrap` rehearses exactly this on a scratch database: 38 migrations, 48 tables). Both `init.js` and every `migrate-*.js` script read `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_SSL`, and `DB_SSL_CA` via `server/lib/dbConfig.js` (`resolveConnectionConfig`). `migrate-program-outcome-sources` printing "program not found" on an empty database is expected. Then create the first administrator:
`CREATE_ADMIN_EMAIL=<email> CREATE_ADMIN_PASSWORD=<temporary> node server/db/create-admin.js` (the password is read from the environment, hashed, never printed, and must be changed at first sign-in).

**Existing database:** run only the migrations the release notes name (`CHANGELOG.md`), after the backup. When there were 24 migrations, re-running all of them on an already migrated scratch database exited 0 for 23 (the 24th is the expected empty-database report above); this was verified on a scratch database only. Two migrations change existing data and cannot be undone by running anything: `migrate-version-labels` (renumbers syllabus versions v1.0, v1.1 to v1, v2; preview with `--dry-run`) and `migrate-catalog-year`. There is no automated down-migration: **rollback of a schema change is a restore from the pre-deployment dump.**

**Known gap:** the development database has 9 tables that no code uses (`chk_*`, `course_prerequisites`, `co_po_mapping`, `standard_changes`) and two unused `courses` columns (`lecture_units`, `lab_units`). They are not needed on a new database. Do not copy them forward.

## 3. Deployment sequence

1. Back up (section 2). Note the previous release identifier.
2. Build the frontend with the target `VITE_API_URL`; upload `dist/` to the static host (keep the previous `dist/` for rollback).
3. Stop the API (`SIGTERM` / `systemctl stop`). `server/index.js` stops accepting new connections via `httpServer.close()`, waits up to 15 seconds for in-flight HTTP saves/checks to finish, flushes `usage` and `deadlineNotices`, and closes the MySQL pool. Sessions are kept in the database (`SESSION_STORE=mysql`), so users stay signed in; an unfinished in-memory PDF import job or rate-limit window resets on restart.
4. Deploy only the shipping backend files (`server/`, `shared/`, `src/lib/pdfImportReview.js`, `src/data/officialProgramOutcomes.json`; exclude `docs/`, `reference-data/`, `scripts/`, `tests/`) and install `server/node_modules` (`npm ci --omit=dev` in `server/`), then apply the named migrations.
5. Start the API with the environment file (`npm start` in `server/`, under `systemd` or PM2 with `kill_timeout >= 20000`; never `npm run dev`, which runs `node --watch`); the log must show `HOST: CORS allows 1 origin(s) (configured); cookies Secure=true SameSite=<value>; trust proxy <n>` and no `FATAL`. Ensure the reverse proxy upstream read timeout is at least `600s` (`STAGING-ARCHITECTURE.md` section 3); note that a free/Pro Cloudflare orange-cloud proxy enforces a fixed 100-second origin read timeout (`HTTP 524`), so either route the API subdomain DNS-only with TLS at Nginx/Caddy (`proxy_read_timeout 600s`) or keep per-check `ANTHROPIC_TIMEOUT_SEC` and `SYLLABUS_CHECK_REPLAN_MAX_REQUESTS` within the proxy budget (AI Syllabus Generator already uses background `202` polling).
6. Smoke test: `node scripts/smoke-test.cjs --api https://<api> --origin https://<frontend>` must exit 0.
7. Manual checks with a test account (checklist section G of `docs/vpaa-conformance/STAGING-SETUP-CHECKLIST.md`): cookies HttpOnly + Secure, CORS header equals the frontend origin, a foreign origin POST is refused (403), roles see only their menus.
8. Watch monitoring (`MONITORING.md`) for 30 minutes before announcing.

## 4. Rollback conditions and steps

Roll back immediately if: the API does not start; the smoke test fails; login fails for everyone; a 5xx rate above 5 % for 5 minutes; the provider spend or request count exceeds the authorized maximum; any real institutional text appears in a provider request; official scores change for an unchanged syllabus.

| What | Rollback | Needs authorization |
|---|---|---|
| **AI checking** | set `SYLLABUS_CHECK_AI_PROVIDER=off` (and `SYLLABUS_CHECK_GENERATE=off`), restart. No AI request is sent; the fixed rules still run and each check reports its AI part as not done. Administrators can also turn AI checking off in Settings. | no (it is the safe direction) |
| **Application** | redeploy the previous backend files and previous `dist/`; restart | owner |
| **Environment configuration** | restore the previous environment file from the secret store; restart | owner |
| **Database** | restore the pre-deployment dump into the database (destructive: it replaces newer data; stop the API first, record what is lost) | **yes, explicit** |
| **Credentials** | revoke the Anthropic key in its workspace; rotate `SESSION_SECRET` (signs every session out; `JWT_SECRET` is no longer used); rotate the SMTP app password and the database password; revoke any key that appeared in a log or chat | owner |
| **Provider access shutdown** | in the Anthropic workspace, disable the key or lower its spend limit to zero. This is the only control that also stops a runaway outside the application | owner |

Destructive rollback steps are never executed without authorization.

## 5. Recovery after an incident

1. Contain: disable the Anthropic key; set `SYLLABUS_CHECK_AI_PROVIDER=off`; take the API out of rotation if data is at risk.
2. Preserve: copy the API log and a fresh database dump before changing anything.
3. Diagnose with `MONITORING.md` (what failed, since when, which provider status).
4. Restore from the last good dump only if data was damaged; replay nothing automatically.
5. Rotate credentials that could have been exposed; record who approved each step.

## 6. Post-deployment

Re-run the smoke test after any proxy or DNS change. Keep the deployment record: commit id, migrations applied, the person who approved G1/G2/G3, the backup file name, the smoke test output.

## 7. Operational troubleshooting playbooks

| Failure scenario | Symptom | Immediate diagnosis | Safe recovery |
|---|---|---|---|
| **1. API won't start** | Process exits `1` immediately on start | Inspect service logs (`journalctl -u syllabus-api -n 50`) for the `FATAL:` message and run `node scripts/credential-readiness.cjs --env-file <env>` | Fix the named setting (`SESSION_SECRET`, `CORS_ALLOWED_ORIGINS`, `TRUST_PROXY`, `SESSION_STORE=mysql`, `SYLLABUS_CHECK_REPLAN_MAX_COST_USD`, `DB_SSL=required`, excess DB grants, or demo password hash), or run the missing migration (`migrate-session-store`), then restart |
| **2. Database down or packet limit error** | `GET /api/health` returns `503`, or AI check save returns `507 report_too_large` | Check MariaDB status (`systemctl status mariadb`), test connection with `mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p $DB_NAME -e "SELECT 1, @@max_allowed_packet;"` | Restore DB connectivity or restart MariaDB cleanly; if `@@max_allowed_packet < 16777216`, set `max_allowed_packet=16M` in `[mysqld]` (`DATABASE-REQUIREMENTS.md`) and reconnect |
| **3. Login fails for everyone** | Valid credentials return `401`/`403`, or sign-in loops back to Login | Check `HOST:` startup log, browser DevTools cookie attributes (`Secure`, `SameSite`), reverse-proxy `X-Forwarded-Proto: https`, `CORS_ALLOWED_ORIGINS`, system clock (`date -u`), and `SELECT COUNT(*) FROM user_sessions;` | Ensure proxy sends `X-Forwarded-Proto: https` with matching `TRUST_PROXY=1`, `CORS_ALLOWED_ORIGINS` matches the exact `https://` frontend origin (no trailing slash), and `user_sessions` table exists (`npm run migrate-session-store`) |
| **4. Disk full** | Avatar/PDF uploads or MySQL writes fail (`ENOSPC` / `ER_ERROR_ON_WRITE`) | Run `df -h` and `du -sh $UPLOAD_DIR $PRIVATE_DIR /var/log /var/lib/mysql` | Rotate/truncate old system logs, move old encrypted DB backups to off-host storage, expand the volume (`UPLOAD_DIR` and `PRIVATE_DIR` never delete syllabus or avatar files automatically), then verify `GET /api/health` |
| **5. Outbound email / SMTP failing** | Account creation, credential resend, or forgot-password succeeds in DB (`200`) but no email arrives | Grep API logs for `MAIL` / `SMTP` errors; verify `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `MAIL_FROM` | Rotate or unlock the relay credential (`SMTP_PASS`), verify outbound port `587`/`465` firewall rules, restart the API, and use **Users & Roles → Resend credentials** for affected new accounts |
| **6. Stuck PDF import** | Faculty sees `409` ("import already running" / `pdfImport.busy`) | Check active worker CPU and memory (`ps aux` / `top`) and server logs around `/api/syllabi/pdf-import` | Wait up to `RECEIVE_MS` (30s) for stalled uploads to self-abort; if a worker thread wedged on a malformed PDF, perform a graceful API restart (`systemctl restart syllabus-api`, which clears in-memory `active` slots while preserving DB sessions) and ask the user to re-upload |
| **7. Slow pages or hung checks** | High API latency, timeouts (`504`/`524`), or queued requests | Run `SHOW FULL PROCESSLIST;` in MariaDB, check `DB_POOL_SIZE` / `DB_POOL_QUEUE`, and check Anthropic status / `AI Syllabus Generator` & `compliance` logs | If the AI provider is degraded or timing out, toggle **Settings → AI compliance checking → Off** (or set `SYLLABUS_CHECK_AI_PROVIDER=off` and restart) so deterministic rules run instantaneously; kill any runaway read query and tune `DB_POOL_SIZE` if needed |
