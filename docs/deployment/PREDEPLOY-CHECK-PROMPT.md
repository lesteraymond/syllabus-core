# Pre-deployment readiness check — prompt for an AI agent

Paste everything below the line into the agent (Antigravity). It is written for this repository.

---

You are doing a **pre-deployment readiness audit** of the Syllabus Repository (React + Vite front end in `src/`, Node/Express API in `server/`, MariaDB/MySQL, AI syllabus checker in `server/lib/syllabuscheck/`). The repo is on branch `Updated-Repo` with many uncommitted changes. Your job is to **find and prove problems, not to fix them**. Produce one written report at the end.

## Ground rules (read before running anything)

1. **Read-only on the code.** Do not edit, stage, commit, push, stash, reset, or switch branches. Do not run `git add -A`, `git clean`, or `git checkout -- .`. If you want to propose a fix, write it in the report.
2. **No paid AI calls.** Do not send any request to Anthropic, Gemini, OpenRouter, DeepSeek, Groq or any model API. The test suites use a scripted provider and an offline network guard; keep it that way. Never set `SYLLABUS_CHECK_AI_PROVIDER` to a real provider or export `ANTHROPIC_API_KEY` in a shell you run tests from.
3. **No real email.** `server/.env` on this machine has live Gmail SMTP. Do not start the API with that `.env` and then trigger password resets, account creation, review decisions or deadline notices. If you need a running stack, use a copy of the env with `SMTP_HOST` blank.
4. **Do not touch the dev database.** The local MariaDB (XAMPP) holds the dev data and has crashed twice from unclean starts. Do not run migrations, seeds, `init-db`, `DROP`, `TRUNCATE`, or `CHECK/REPAIR TABLE` against it. Do not start or stop the XAMPP MariaDB service. For any database test use a **throwaway** database (Docker `mariadb:10.11` or a new empty schema with its own name) and say which one you used.
5. **Never print secrets.** When you inspect `.env` files, report only variable *names* and whether a value is present, weak, or a placeholder — never the value.
6. **Commands that take more than ~2 minutes**: run them in the background and keep going.
7. If any step would break a rule above, skip it and write "SKIPPED — reason" in the report.

## Context to read first (10 minutes, then start)

- `README.md`, `HOW-TO-RUN.md`
- `docs/deployment/RUNBOOK.md`, `STAGING-ARCHITECTURE.md`, `DATABASE-REQUIREMENTS.md`, `MONITORING.md`, `production.env.template`, `staging.env.template`
- `docs/security/SECURITY-AUDIT-REPORT.md`, `docs/security-review-local-2026-11-22.md`
- `.github/workflows/ci.yml` (note: it says it has never been verified on a GitHub runner)
- `package.json` and `server/package.json` scripts
- `CHANGELOG.md` (last ~10 entries)

## Part 1 — Code, Testing, and Environment Parity

Run each command from the repo root and record pass/fail counts, duration and the names of failing tests (with the first error line):

1. `npm ci --dry-run` is not needed; instead check that `package-lock.json` and `server/package-lock.json` are in sync with their `package.json` (`npm ls --depth=0` in both folders; report missing/extraneous/invalid).
2. `npm test` — the main suite (unit, route, security, localization, PDF-import UI, VPAA UI).
3. `npm run test:vpaa`
4. `npm run build` with `VITE_API_URL=https://api.invalid/api` — report warnings, bundle size of the largest chunks, and any build error.
5. `npm run audit:i18n` — report untranslated strings.
6. `npm run test:db-bootstrap` **only against a throwaway MariaDB** (see rule 4). Read `scripts/e2e/db-bootstrap-check.cjs` first to confirm what it connects to.
7. `npm run test:e2e` **only if** after reading `scripts/e2e/run-e2e.cjs` and `scripts/e2e/stack.cjs` you can confirm it uses its own throwaway database, no SMTP, and no real AI provider. Otherwise SKIP.

Then check:

- **Tests not in the suite**: list every `*.test.js` / `*.test.cjs` / `*.test.mjs` file under `src/`, `server/`, `scripts/` that is *not* reached by the `npm test` script glob or list. Run those separately (offline) and report results.
- **CI parity**: compare what `ci.yml` runs (Node 22, Ubuntu, MariaDB 10.11) with what the runbook says production runs (Node version, OS, DB engine/version, process manager, reverse proxy). Flag every difference.
- **Node version**: what `node -v` is locally vs. any `engines` field / `.nvmrc` / CI version.
- **Dev-only code paths reaching production**: search for `apply: 'serve'` in `vite.config.js`, `NODE_ENV` checks, `--watch`, `console.log` of request bodies, hardcoded `localhost` URLs, hardcoded course/program names (for example "Logic Circuits" in `coordinatedPlanEngine`, a Cyber curriculum hardcode), and leftover debug routes.
- **Uncommitted state**: summarise `git status` — how many modified/untracked files, and whether any untracked file is *required* at runtime (e.g. something under `server/lib/syllabuscheck/` imported by a tracked file). A deploy from git would miss it.
- **Large/odd files in the repo root** that should not ship: `big.json`, `conversation-export.md`, `tmp/`, `dist/`, `server/uploads/`, `server/private/`, `eng.traineddata`, `sample_syllabus/`. Check `.gitignore` covers what it should.

## Part 2 — Security and Configuration

- **Secrets in the tree**: scan tracked *and* untracked files for API keys, passwords, SMTP app passwords, session secrets, private keys, `.env` copies, DB dumps (`*.sql` with real data). Use `git ls-files` + a regex scan; also scan `git log -p` for the last 50 commits for leaked keys. Report file + line + key type, never the value.
- **`.env` hygiene**: compare variable names in `server/.env.example`, `docs/deployment/production.env.template`, `staging.env.template`, and the names actually read in code (`process.env.X` across `server/`). Report: variables read in code but missing from the templates, template variables no code reads, and variables with no safe default.
- **Fail-closed checks**: confirm the server refuses to start in production when `SESSION_SECRET` is missing/weak, when CORS origin is unset, and when the AI cost cap is missing while the hardened mode is on. Find the code (`server/lib/sessionSecret.js`, `hostConfig.js`, `dbConfig.js`) and cite the lines.
- **Auth and sessions**: cookie flags (`httpOnly`, `secure`, `sameSite`), session store (DB, not memory), login rate limiting / lockout, password policy and expiry, password reset token single-use and expiry, Google sign-in audience check against `GOOGLE_CLIENT_ID`.
- **Authorization**: for every route file in `server/routes/`, list the endpoints and the role check each one uses. Flag any endpoint that changes data without a role check, and any route where a faculty user can read or change another faculty's syllabus by changing an id (IDOR). Pay special attention to `syllabi.js`, `syllabusFiles.js`, `reviewChain.js`, `users.js`, `students.js`, `comments.js`, `pdfImport.js`.
- **Review workflow invariants** (business rules): the VPAA is the only final approver; dean / Asst. VPAA / LIC Director only clear stages; a submitted syllabus is locked; the AI checker never approves anything; approved records cannot be edited. Find where each is enforced on the **server** (not just hidden in the UI) and cite it.
- **File uploads**: size limit, MIME/extension check, storage path outside the web root, filename sanitisation, PDF import job limits, avatar privacy.
- **Headers**: Helmet/CSP, `X-Powered-By` removed, error responses don't leak stack traces (`error-and-headers.routes.test.js` covers some of this — confirm).
- **Dependencies**: `npm audit --omit=dev` in root and `server/`. Report high/critical only, with the package and whether it is reachable at runtime.
- **Demo/test accounts**: search seeds and migrations for default credentials (`admin123`, `faculty123`, UAT reviewer accounts). Report which would be created on a fresh production database.
- **Feature flags**: list every `SYLLABUS_CHECK_*` / `SYLLABUS_*` flag, its default, and whether the default is safe for production (AI features should default off; the legacy AI checker must stay retired).
- **Credentials that need rotation before go-live**: SMTP app password, Gemini key, Anthropic key, DB password, session secret. You cannot rotate them; list them as a blocking checklist item.

## Part 3 — Data and Database Readiness

All of this is **read-only analysis of files**, plus one run against a throwaway database.

- **Schema source of truth**: does `server/db/init.js` + `schema.sql` + every `migrate-*.js` produce the same schema the code expects? Run the bootstrap on a throwaway DB, then dump its schema (`SHOW CREATE TABLE` for every table) and compare against the columns the code queries (grep SQL in `server/`). Report missing columns/tables/indexes.
- **Migration order and idempotency**: list every migration, whether it is safe to run twice (`IF NOT EXISTS` / existence checks), whether it is destructive (drops, renames, data rewrites), and whether it has a down/rollback path. `migrate-version-labels.js` rewrites version labels — confirm it was tested (`migrate-version-labels.test.js`).
- **Which migrations a production DB still needs**: from the runbook and changelog, list migrations applied to dev but not necessarily anywhere else (e.g. version labels, review AI choice, account activity, session store, password expiry, audit retention, generate jobs, replan answers).
- **Character set and collation**: utf8mb4 everywhere? Filipino names and special characters in syllabus text.
- **Engine and crash safety**: InnoDB for all tables (flag any Aria/MyISAM — the dev DB had Aria log damage). Foreign keys and `ON DELETE` behaviour for syllabi, versions, comments, review decisions, files.
- **Seed data**: what `seed.sql`, `seed-outcomes.js`, `seed-local-references.js`, `seed-student-demo*.js` insert. Which are required for production (Vision/Mission/EGA/PO masters, reference data) and which are demo-only and must NOT run in production.
- **Backups**: is there a documented backup + restore procedure, has a restore ever been tested, where do uploaded files (`UPLOAD_DIR`, `server/private/`) get backed up — they are not in the DB.
- **Data retention**: audit log / account activity retention (`auditRetention.js`), and that Recent Activity is non-clearable as designed.

## Part 4 — Monitoring, Alerting, and Rollback

- **Health checks**: what `server/routes/health.js` reports (liveness vs. readiness, DB check, no secrets in output). Is it wired into the runbook / reverse proxy?
- **Logging**: structured or plain? Do logs contain passwords, tokens, session ids, full syllabus text, or email bodies? Where do they go and are they rotated?
- **Error tracking and alerting**: is anything configured (Sentry, uptime monitor, email on crash)? What does `MONITORING.md` promise vs. what exists in code? List the gaps as concrete alerts that should exist: API down, DB down, 5xx rate, login failure spike, AI cost cap reached, SMTP failures, disk full in `UPLOAD_DIR`, PDF import job stuck.
- **AI cost control**: confirm a hard per-check and per-period cost cap exists and is enforced before the request is sent (reservation), and that a provider error ("credit balance too low") degrades gracefully instead of breaking submission.
- **Process management**: how the API restarts on crash in production (pm2 / systemd / Docker); `node --watch` must not be used in production.
- **Rollback plan**: can the previous version be redeployed from a git tag/commit? Are the migrations backward-compatible so old code runs on the new schema? If not, what is the DB restore step and how long does it take? Is there a maintenance mode? Write a step-by-step rollback procedure if the runbook lacks one.
- **Smoke test after deploy**: write a 10-step manual smoke test (login per role, create draft, upload PDF, submit, each review stage, VPAA approve, student view, password reset to a test inbox, health endpoint).

## Report format

Write the report to `docs/deployment/PREDEPLOY-READINESS-REPORT-<YYYY-MM-DD>.md` (this one new file is the only file you may create). Structure:

1. **Verdict** — one of: `READY`, `READY WITH CONDITIONS`, `NOT READY`, with a 3-sentence reason.
2. **Blockers** — must fix before deploy. Table: `# | Area | Finding | Evidence (file:line or command output) | Suggested fix`.
3. **High / Medium / Low** findings — same table.
4. **Command log** — every command you ran, exit code, pass/fail counts, duration. Mark SKIPPED ones with the reason.
5. **Environment parity matrix** — local vs. CI vs. staging vs. production (Node, OS, DB, env vars, build mode).
6. **Pre-deploy checklist** — checkboxes the owner must tick (credential rotation, demo accounts removed, migrations list, backup taken, flags set).
7. **Rollback procedure** and **post-deploy smoke test**.
8. **What you could not verify** — be explicit (e.g. "CI never ran on GitHub", "real AI provider not tested", "production host not available").

Rules for the report: every finding needs evidence you actually saw (a file path with line number, or command output). Do not report something as passing unless you ran it. Do not guess; if unsure, put it under "could not verify". Do not paste secret values.
