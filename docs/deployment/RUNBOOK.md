# Deployment runbook, rollback and recovery (staging first, then production)

Hand-written preparation. **Nothing in it has been executed against a real environment.** No step deploys, migrates or changes a database by itself; each one needs a named person and written authorization. Commands that touch a real database are marked **[OWNER]**.

## 0. Roles and approval gates

| Gate | Who approves | Evidence they need |
|---|---|---|
| G1 Staging deployment | system owner | CI green (`npm test`, `npm run test:vpaa`, `npm run build`, db-bootstrap) at the exact commit; both read-only preflights exit 0 on the staging file |
| G2 Live Claude smoke test | the person who owns the spend decision, in writing: environment, configuration, maximum spend, date, operator | `docs/vpaa-conformance/STAGING-TEST-PLAN.md` section 3 (nine conditions) |
| G3 Production deployment | institution decision-maker (not the engineer) | a verified staging run, a tested backup restore, production security items closed (`ENGINEERING-REPORT.md` section 16) |

Nothing is auto-deployed. The CI workflow has no deploy job on purpose.

## 1. Pre-deployment checks (read-only)

1. `git status` is clean and the deployed commit is the tested one.
2. `npm test`, `npm run test:vpaa`, `npm run build` pass; `npm run test:db-bootstrap` passes; `npm run test:e2e` passes locally (it needs a local Edge/Chromium and MariaDB).
3. The database allows packets of at least 16 MB: `SELECT @@global.max_allowed_packet, @@session.max_allowed_packet;` as the application's user returns >= 16777216 (`docs/deployment/DATABASE-REQUIREMENTS.md`). A smaller value makes large checking reports fail to save.
3. `node scripts/vpaa-v2-preflight.cjs --env-file <env>` and `node scripts/credential-readiness.cjs --env-file <env>` exit 0. Both print names and statuses only.
4. The environment file is the environment's own (`docs/deployment/staging.env.template`), `NODE_ENV` is `staging` or `production`, and `SYLLABUS_CHECK_ACADEMIC_V2` matches the plan (on for staging; **off** for production until approved).

## 2. Database: backup, provisioning, migration

**Backup before every deployment [OWNER]:** `mysqldump --single-transaction --routines --triggers <db> > <db>-<UTC timestamp>.sql`, stored off the database host and **encrypted**; keep at least the last 7 daily and the pre-deployment dump. A backup is only real after a restore test: restore the newest dump into a scratch database and run `SELECT COUNT(*)` on `users`, `syllabi`, `syllabus_check_reports`. (No backup or restore has been performed by this preparation.)

**New database:** create the database and a least-privilege user (SELECT, INSERT, UPDATE, DELETE, plus CREATE/ALTER/INDEX only for the migration window). Run with `NODE_ENV=staging|production` so `init.js` does **not** insert the demo accounts:
`node server/db/init.js`, then every `migrate-*` script in the order of `server/package.json` (`npm run test:db-bootstrap` rehearses exactly this on a scratch database: 24 migrations, 39 tables). `migrate-program-outcome-sources` printing "program not found" on an empty database is expected. Then create the first administrator:
`CREATE_ADMIN_EMAIL=<email> CREATE_ADMIN_PASSWORD=<temporary> node server/db/create-admin.js` (the password is read from the environment, hashed, never printed, and must be changed at first sign-in).

**Existing database:** run only the migrations the release notes name, after the backup. Re-running all 24 migrations on an already migrated scratch database exited 0 for 23 of them (the 24th is the expected empty-database report above), so a repeated run is safe; this was verified on a scratch database only. There is no automated down-migration: **rollback of a schema change is a restore from the pre-deployment dump.**

**Known gap:** the development database has 9 tables that no code uses (`chk_*`, `course_prerequisites`, `co_po_mapping`, `standard_changes`) and two unused `courses` columns (`lecture_units`, `lab_units`). They are not needed on a new database. Do not copy them forward.

## 3. Deployment sequence

1. Back up (section 2). Note the previous release identifier.
2. Build the frontend with the target `VITE_API_URL`; upload `dist/` to the static host (keep the previous `dist/` for rollback).
3. Stop the API (a restart ends in-memory sessions; users sign in again, remember-me users continue).
4. Deploy the backend files and `server/node_modules` (`npm ci` in `server/`), apply the named migrations.
5. Start the API with the environment file; the log must show `HOST: CORS allows 1 origin(s) (configured); cookies Secure=true SameSite=<value>; trust proxy <n>` and no `FATAL`. A missing or weak secret, a missing origin, or a missing proxy setting stops the process by design.
6. Smoke test: `node scripts/smoke-test.cjs --api https://<api> --origin https://<frontend>` must exit 0.
7. Manual checks with a test account (checklist section G of `docs/vpaa-conformance/STAGING-SETUP-CHECKLIST.md`): cookies HttpOnly + Secure, CORS header equals the frontend origin, a foreign origin POST is refused (403), roles see only their menus.
8. Watch monitoring (`MONITORING.md`) for 30 minutes before announcing.

## 4. Rollback conditions and steps

Roll back immediately if: the API does not start; the smoke test fails; login fails for everyone; a 5xx rate above 5 % for 5 minutes; the provider spend or request count exceeds the authorized maximum; any real institutional text appears in a provider request; official scores change for an unchanged syllabus.

| What | Rollback | Needs authorization |
|---|---|---|
| **Policy V2** | unset `SYLLABUS_CHECK_ACADEMIC_V2` (or set `off`), restart. The checker returns to the legacy path; official scores are unchanged by design (E2E scenario E15 proves parity). | no (it is the safe direction) |
| **Application** | redeploy the previous backend files and previous `dist/`; restart | owner |
| **Environment configuration** | restore the previous environment file from the secret store; restart | owner |
| **Database** | restore the pre-deployment dump into the database (destructive: it replaces newer data; stop the API first, record what is lost) | **yes, explicit** |
| **Credentials** | revoke the Anthropic key in its workspace; rotate `SESSION_SECRET` (signs every session out) and `JWT_SECRET`; revoke any key that appeared in a log or chat | owner |
| **Provider access shutdown** | in the Anthropic workspace, disable the key or lower its spend limit to zero. This is the only control that also stops a runaway outside the application | owner |

Destructive rollback steps are never executed without authorization.

## 5. Recovery after an incident

1. Contain: disable the Anthropic key; set `SYLLABUS_CHECK_ACADEMIC_V2=off`; take the API out of rotation if data is at risk.
2. Preserve: copy the API log and a fresh database dump before changing anything.
3. Diagnose with `MONITORING.md` (what failed, since when, which provider status).
4. Restore from the last good dump only if data was damaged; replay nothing automatically.
5. Rotate credentials that could have been exposed; record who approved each step.

## 6. Post-deployment

Re-run the smoke test after any proxy or DNS change. Keep the deployment record: commit id, migrations applied, the person who approved G1/G2/G3, the backup file name, the smoke test output.
