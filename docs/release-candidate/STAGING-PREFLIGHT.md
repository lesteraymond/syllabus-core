# Staging security preflight (audit only)

Date 2026-11-05. **Nothing was created, deployed, migrated or sent.** No staging infrastructure exists yet; this audits what the repository can prove offline and lists what only the owner can supply. No production credential or environment was touched. Evidence commands are read-only and print names and statuses, never values.

Legend: **OFFLINE-VERIFIED** (proved here with tests or the repo's own scripts, on synthetic data or stand-in values), **OWNER-REQUIRED** (cannot be seen or done from the repository), **GAP** (a missing control in the code or documents).

| # | Requirement | Status | Evidence | What is missing |
|---|---|---|---|---|
| 1 | Separate staging database | OWNER-REQUIRED | `docs/deployment/staging.env.template` requires its own `DB_HOST/NAME/USER` (least-privilege, non-empty password); that it is a different database from development is a convention, no code checks it; `scripts/e2e/db-bootstrap-check.cjs` rehearses `init.js` + all 27 `migrate-*` scripts on a scratch DB (staging mode inserts no demo accounts). Development holds the corrected POs (`syllabus_cms_plus`); staging has none | Provision the DB, a least-privilege user, run init + migrations **with separate authorization**, then load the corrected PO references through the guarded rollout (`scripts/po-controlled-activation`), which the current activation authorization does **not** cover |
| 2 | Separate Claude credentials | OWNER-REQUIRED | `credential-readiness.cjs`: the development `server/.env` holds an Anthropic key (present, 32+); the staging template demands a NEW key in its own workspace | Create a staging-only key in its own Anthropic workspace; never reuse the development key |
| 3 | No exposed secrets | PARTIAL | repo scan: 0 real-looking keys in tracked or untracked source (17 distinct test placeholders, all containing "test", "stand-in" or "not-a-real"); `server/.env` and `.env` are git-ignored; the preflight prints no value. **Development `.env` still holds live secrets** (SMTP app password, a commented Gemini key line, a weak 16-31-char session secret) | Rotate the credentials already flagged (SMTP app password, Gemini key, development DB password); create fresh 32+ character `SESSION_SECRET`/`JWT_SECRET` for staging (`credential-readiness.cjs` flags 3 manual actions on the template) |
| 4 | CORS and cookies | OFFLINE-VERIFIED | `vpaa-v2-preflight.cjs` on a correctly filled stand-in file: `1 frontend origin(s) (https), trust proxy 1, cookies Secure=true SameSite=lax HttpOnly`; the server refuses to start on a missing or weak setting (host-layer tests); browser E01 checks cookie flags; K10/E04 cover cross-session access | Real origins, and a live check that a foreign-origin POST is refused (RUNBOOK section 3 step 7) |
| 5 | HTTPS and trusted proxy | PARTIAL | the E2E stack is a staging-like topology (NODE_ENV=staging behind a throwaway TLS proxy, `TRUST_PROXY=1`); E17 runs `smoke-test.cjs` against it | Certificate, DNS and the real reverse proxy; confirmation of the hop count |
| 6 | Backup and recovery | PARTIAL | RUNBOOK section 2 gives `mysqldump --single-transaction --routines --triggers`, encryption, 7-day retention; the PO activation proved a **full backup (34.8 MB, 48 tables) restored and verified on an isolated server** and a tested rollback; this release candidate adds no schema change | A scheduled, encrypted, off-host staging backup and one restore rehearsal on the staging host; the dump must be taken **before** any real syllabus text is stored |
| 7 | `max_allowed_packet` >= 16 MB | OFFLINE-VERIFIED, host UNVERIFIED | `repository.js saveReport` refuses a report larger than the server allows with HTTP 507 `report_too_large` (never a partial save; `report-size.test.js`); `scripts/live-claude/readiness.cjs` reads `@@global/@@session.max_allowed_packet` and fails below 16,777,216; E2E ran on an isolated 16 MB server (B01 passes). The shared development server is 1 MB and **would fail** large reports | Set 16M on the staging server and run `readiness.cjs` **without** `--skip-db` against it; hosted databases need the parameter-group setting |
| 8 | Report storage capacity | OFFLINE-VERIFIED (sizing) | `report_json` is LONGTEXT; a full comprehensive report is ~0.8 MB (DATABASE-REQUIREMENTS.md); development holds 202 saved reports | Provision ~1 MB per stored check (100 checks/day is ~100 MB/day) plus the dump; set a retention decision |
| 9 | Provider-side spending limits | OWNER-REQUIRED (unverifiable here) | `live.cjs --live` refuses without `--provider-limit-usd`, recorded as the person's statement; the spend register caps all project Claude work at $10 ($2.92 used, $7.08 left) | Set a hard monthly limit and 50/80 % alerts in the staging workspace **before** the first paid request. This is the only aggregate control (see 10) |
| 10 | Application request and cost guards | PARTIAL, one GAP | per check: `SYLLABUS_CHECK_AI_MAX_REQUESTS=120`, `..._MAX_COST_USD=10` (a RESERVATION ceiling, deliberately above real spend; ~$4.63 per V2 check), token budget, scored/V2-before-optional ordering, `NOT_CHECKED` on exhaustion, provider cooldown after 401/402/403, no retry after a timeout; the compliance route is limited to 10 checks/min/user; unchanged re-checks send 0 requests. The live-test runner adds the hard dollar guard (`providerGuard.js`) | **GAP:** the application has no daily or aggregate spend cap and the provider guard is used by the test runner, not by the server. Real dollars in a deployed staging are bounded only by the provider-side limit (item 9). Do not raise the in-app caps; consider a daily cap as a later change |
| 11 | Secure logging | OFFLINE-VERIFIED (code) | no request-logger middleware; a search found no `console.*` of request bodies, headers, cookies or keys in `server/`; `anthropicClient.js` redacts the key and `sk-ant-*` text from every error; leak tests (`LEAKCHECK` key) pass; evidence files print no key | The reverse-proxy access log must omit `Cookie`, `Authorization` and query strings (MONITORING.md section 3); nothing is configured yet |
| 12 | Monitoring and failure reporting | GAP | `GET /api/health` (liveness + DB), per-check outcome in `ai_check_runs`, coverage and budget in each report, the SQL queries in MONITORING.md | The application has no metrics endpoint and **no alerting**: an uptime monitor, a scheduled job running the three monitoring queries, proxy access logs and provider spend alerts are all still "to add" |

## Read-only commands used

```
node scripts/vpaa-v2-preflight.cjs   --env-file <stand-in staging file>     -> READY (16 of 16 PASS)
node scripts/vpaa-v2-preflight.cjs   --env-file docs/deployment/staging.env.template  -> placeholders flagged (expected)
node scripts/credential-readiness.cjs --env-file <stand-in staging file>    -> no manual action; repository hygiene ok
node scripts/live-claude/readiness.cjs --env-file <stand-in> --scope v2only --skip-db -> 0 failing, 1 manual action (PROFILE flag is for the comprehensive scope)
```
The stand-in file (random secrets generated for the check, `*.example.invalid` hosts, a clearly fake key) was kept in the session scratch area and is not part of the repository.

## Missing requirements, in order

1. Owner provisions the staging database and credentials (items 1, 2, 3, 7) and authorizes migrations and the PO reference rollout for staging.
2. Anthropic staging workspace with its own key and a hard spend limit and alerts (items 2, 9).
3. Proxy, TLS, DNS and log configuration (items 4, 5, 11).
4. Backup job and one restore rehearsal (item 6).
5. Monitoring and alerts (item 12).
6. Decision on a daily application spend cap (item 10).

Until 1-3 exist no paid request may be made.
