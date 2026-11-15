# Security audit and hardening prompt: Syllabus CMS Plus

Paste everything below the line into a new Claude Code session opened at the repository root. It is written from what the repository contains as of 2026-11-12 (stack and prior findings are cited, not assumed).

---

## ROLE

You are a senior application-security engineer working on **Syllabus CMS Plus**, a syllabus management system for a Philippine university (roles: admin, faculty, dean / Asst. VPAA / LIC Director reviewers, VPAA approver, secretary, student). You work in three strictly separated phases: **(1) inspect, (2) report, (3) fix**. You do not start a phase until the owner says so, except phase 1 and 2, which you run now.

## SYSTEM FACTS (verify each one; do not trust this list blindly)

- Frontend: React 19 + Vite 8 + Tailwind 4 in `src/`. Built output in `dist/`.
- Backend: Node.js + Express 4 (CommonJS) in `server/`: `index.js`, `routes/`, `middleware/` (`auth.js`, `jwt.js`, `canEditSyllabus.js`), `lib/`, `db/` (MySQL via `mysql2`, `schema.sql`, many `migrate-*.js`).
- Auth: `express-session` (MemoryStore), session cookie, a 30-day single-use `remember_token` cookie (sha256 in DB), Google sign-in (`google-auth-library`), JWT (`jsonwebtoken`, HS256), `bcryptjs` cost 10, forced password change for generated passwords, temporary passwords, SMTP emails (`nodemailer`).
- Host layer: `server/lib/hostConfig.js` (CORS allow-list, cookie flags, `TRUST_PROXY`, an Origin / Sec-Fetch-Site guard on unsafe methods) and `server/lib/sessionSecret.js` (fail-closed secrets in staging/production).
- Uploads: `multer` in `routes/syllabi.js` (disk, PDF, 10 MB), `routes/pdfImport.js` (memory), `routes/students.js` (COR scan with OCR via `tesseract.js`), `routes/users.js` (avatar via `sharp`). `server/index.js` serves `/uploads` with `express.static`; `/uploads/avatars` is blocked and avatars are served by an authorized route.
- AI: Anthropic (`@anthropic-ai/sdk`), Gemini, DeepSeek/Groq paths under `server/lib/syllabuscheck/`; a cost-cap reservation guard; syllabus text is sent to providers. PDFs and syllabus text must never leave the machine except through the sanctioned checker path.
- Frontend renders user text with `dangerouslySetInnerHTML` in `src/views/builder2/FormPaper.jsx` and `PlanStep.jsx`, relying on `renderMarkup` / `esc` in `src/lib/syllabusModel.js`.
- Known open items from `docs/deployment/ENGINEERING-REPORT.md` (re-verify, some may have changed): login has **no rate limit** (`routes/auth.js` only limits forgot-password; confirm `POST /login`, `/google` and `POST /api/students/register` are still unlimited); exposed Gmail app password and Gemini key (owner rotation pending); MemoryStore sessions; no security headers (no helmet); demo seeds (`admin123`, `faculty123`) and UAT reviewer accounts (user ids 38–40) in dev DBs; least-privilege DB user; HTTPS/HSTS at the proxy; audit-log retention.
- Fresh suspicion to confirm or refute: `app.use("/uploads", express.static(uploadsDir))` is mounted **before** `restoreSession`, so uploaded syllabus PDFs may be readable without signing in, with guessable or enumerable names.

## HARD RULES

1. **Read-only first.** Phases 1 and 2 change no file except the one report file named below.
2. **Never print, copy, log or commit a secret.** Do not open `server/.env` or any `.env.*` except `.env.example` and the `docs/deployment/*.env.template` files. If you must know whether a key is set, check only its presence (a boolean), never its value. If you find a secret anywhere else (a doc, a log, a commented line, git history), report its **location and type only**, never the value.
3. **No live calls.** No request to Anthropic, Gemini, SMTP, Google, or any external host. No production or shared database. No paid or networked action. Any dynamic test runs against a local server and a **throwaway test database or the repo's fake-DB test harness** only, with test credentials you create for that purpose.
4. **No destructive actions:** no deleting accounts, rows, files, branches, or backups; no `git push`, no history rewrite, no `git add -A` (the tree has many unrelated uncommitted paths and a `tmp/` folder that is not ignored). Commit only the hunks you wrote, and only when asked.
5. **Do not weaken existing behavior.** The review chain rules (submit locks, VPAA is the only approver, AI never approves, per-version AI choice) and the alignment model rules are fixed. A security fix must not change them.
6. **Report faithfully.** State what you ran, what passed, what you did not verify, and what needs owner action. Do not call something fixed without a test or reproduction that fails before and passes after.
7. Keep the repo's style: tabs/CRLF as the existing file uses (Edit on a mixed-EOL file rewrites it as CRLF, so copy untracked files before editing; never `sed -i` on CRLF files), no backticks inside shell strings, tests in `*.test.js` next to the code and wired into `npm test` in `package.json`.

## PHASE 1: INSPECT THE SYSTEM FOLDER (before judging anything)

Read the repository as it is now. Produce an inventory first:

1. **Entry points and trust boundaries.** Enumerate every Express route (method, path, router file) by reading `server/index.js` and each file in `server/routes/`. For each, record: authentication required? role/ownership check? input sources (body, query, params, multipart, cookies, headers)? side effects (DB write, file write, email, AI call, notification)? Put this in a table.
2. **Middleware order** in `server/index.js`: what runs before `restoreSession` (health, static `/uploads`, CORS, origin guard, body parsers) and what that exposes.
3. **Data stores.** `server/db/schema.sql` and the migration files: tables holding credentials, tokens, PII (names, emails, student numbers, COR scans, avatars), audit data (`account_activity`, logs, usage, comments, messages). Check column types, indexes, uniqueness, foreign keys, and cascade rules that affect security.
4. **Files at rest.** What is in `server/uploads/`, `server/private/`, `server/db/*.sql`, `docs/`, `tmp/`, `sample_syllabus/`, `reference-data/`, `scripts/`, `*.log`, `dist/`: anything that holds real syllabus text, personal data, credentials, or AI request audits and is tracked by git or served over HTTP. Check `.gitignore` against what `git ls-files` actually tracks.
5. **Dependencies.** `package.json` and `server/package.json` (both lockfiles): list direct dependencies with versions, flag unpinned ranges (`^`), unmaintained or deprecated packages (notably `multer` 1.x, `express` 4, `express-session` MemoryStore, `jsonwebtoken`, `bcryptjs`, `tesseract.js`, `pdfjs-dist`, `sharp`, `@napi-rs/canvas`). Run `npm audit --omit=dev` in the root and in `server/` **only if it works offline-safely with the registry** (it contacts the npm registry; ask the owner before running it, and report if you skipped it).
6. **Frontend.** All uses of `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `window.open`, `postMessage`, `target="_blank"` without `rel`, `localStorage`/`sessionStorage` for anything sensitive, tokens in URLs, `VITE_*` variables that could leak a secret into the bundle, and `src/lib/api*` for how credentials and CSRF are handled.
7. **Docs already written.** Read `docs/deployment/ENGINEERING-REPORT.md`, `RUNBOOK.md`, `STAGING-ARCHITECTURE.md`, `docs/vpaa-conformance/CREDENTIAL-READINESS.md` (if present) and `CLAUDE.md`, so you do not re-report accepted risks as new, and so you can mark each earlier finding **still open / fixed / changed**.

## PHASE 2: FIND VULNERABILITIES (code review, then local dynamic checks)

Review against OWASP ASVS / Top 10 and the specific risks of this system. For every item, give a verdict (**VULNERABLE / WEAK / OK / NOT VERIFIED**), the file and line, and evidence (the code, or the local request and response you observed).

**A. Authentication and sessions**
- Brute force and credential stuffing on `POST /api/auth/login`, `/google`, `/forgot-password`, `/api/students/register`, `/api/students/scan`; account enumeration through different messages, status codes, or timing; lockout design.
- Password policy and storage (bcrypt cost 10, length cap to avoid bcrypt 72-byte truncation and DoS, temporary-password lifetime and single use, comparison of generated passwords, whether a generated password is ever returned in an API response or logged).
- Session fixation (is the session regenerated on login, on password change, on role change?), logout invalidating server-side state, MemoryStore (memory growth, restart loses sessions, multi-instance), idle and absolute timeouts, cookie flags (`httpOnly`, `Secure`, `SameSite`, name, `path`), remember-me rotation and theft detection, revocation of all sessions and remember tokens on password change and on account disable.
- JWT: secret strength and source, `algorithms` pinned, `exp`/`iss`/`aud`, whether the token is actually used for authorization anywhere (the host layer says the cookie is what authorizes), token storage and leakage.
- Google sign-in: ID-token audience check, `email_verified`, hosted-domain enforcement (`lib/emailDomain.js`), account linking and takeover risk.

**B. Authorization (the most likely place for real bugs)**
- For every route in the inventory, test **horizontal** access (faculty A reading or writing faculty B's syllabus, comments, messages, notifications, deadlines, usage, avatars, uploads) and **vertical** access (faculty calling admin APIs, a dean or Asst. VPAA calling the approval route, a student calling anything other than `/auth` and `/students`, a disabled account, an unauthenticated caller). Look for IDOR on `:id` params, routes that trust `userId`, `role`, `owner_id`, `status`, `stage` or `version` from the request body, mass assignment through spread of `req.body` into SQL `SET`, and routes missing `requireAuth` / role middleware.
- Review-chain integrity: can a request skip a stage, approve before the AI check when the rule says it cannot, edit a submitted (locked) syllabus, edit an approved record, or move a syllabus to another subject/program/academic year? Is each state transition enforced **on the server** and atomic (transaction, `SELECT ... FOR UPDATE`), or only in the UI? Check race conditions (double submit, concurrent approve and withdraw).
- `mustChangePassword` really gates every route, including ones mounted before or outside `requireAuth`.

**C. Injection and unsafe input handling**
- SQL: every `db.query` / `execute` call; string-built SQL (template literals, concatenated `ORDER BY`, `LIMIT`, `IN (...)`, column names from the request); the report says dynamic fragments are constants, so verify rather than trust.
- Stored and reflected XSS: every sink that renders stored text (syllabus fields, comments, messages, notification text, program/subject names, filenames, emails sent by `mailer.js`). Confirm `renderMarkup` escapes before adding markup in all code paths, including links, images, nested lists, `javascript:` and `data:` URLs, and attribute contexts; check the HTML email templates for header and HTML injection (`\r\n` in subject or addresses).
- Path traversal and file handling: upload filename and extension handling (`path.extname(file.originalname)`), MIME spoofing (check magic bytes, not just `mimetype`), polyglot or malformed PDFs, zip/decompression bombs, image-pixel bombs (`sharp`, `@napi-rs/canvas`), OCR (`tesseract.js`) resource use, unbounded `pdfjs-dist` parsing, and deleting files by a DB-stored path (`catalogFileCleanup.js`): can a stored path escape `UPLOAD_DIR`?
- Prompt injection into the AI checker: syllabus text, comments and uploaded PDFs are untrusted data that is placed into LLM prompts. Check that model output cannot change a stored status, approve a syllabus, change a score the owner treats as official, trigger a send, or exceed the cost cap; that the AI response schema is validated before use; and that AI request audit logs (`docs/ai-check-request-audit.json`, `pdf-import-api-audit.json`) hold no secrets or personal data.
- SSRF, open redirect, header injection, regex DoS (ReDoS) in the PDF parser and COR parser regexes, JSON body size limits (`express.json()` has the default 100 kb limit; confirm), prototype pollution in object merges and `clone`.

**D. Exposure of data and configuration**
- `/uploads` static mount: is it served **before authentication**? Can a signed-out caller fetch a syllabus PDF, a COR scan, or anything under `server/uploads` by URL, and are the names guessable? Can a faculty member fetch another faculty's draft? Decide the correct design (authorized download route that checks ownership and review state, files stored outside the web root, random names, `Content-Disposition`, `X-Content-Type-Options: nosniff`).
- Security headers: HSTS, CSP (the app uses inline styles in `renderMarkup`), `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cache-Control: no-store` on authenticated responses; `X-Powered-By` removal; error handlers that leak stack traces, SQL text or file paths to the client; `server/dev-api*.log` and `test-localization.log` content.
- Secrets: hardcoded keys or passwords in source, scripts, docs, tests, `promo-video/`, `etc/`, `tmp/`, and git history (`git log -p -S` for patterns like `AIza`, `sk-ant`, `app password`, `DB_PASS`, `Bearer`; report location only). Confirm `.env` was never committed.
- Logging: PII or tokens in logs, `account_activity` completeness (login, failed login, password change, role change, approval, disable), tamper-resistance and retention.
- Health endpoint reveals only status and DB state; confirm.

**E. Denial of service and abuse**
- Rate limits and quotas on every expensive or emailing route (AI check, refine, PDF import, OCR scan, password emails, notifications, messages, bulk user creation), how `createLimiter` keys requests (per IP behind a proxy needs a correct `trust proxy`; per user; memory growth of the limiter map), upload size and field/file counts, concurrency limits on `sharp`/OCR/PDF workers, unbounded list endpoints without pagination.
- Cost abuse: can a signed-in low-privilege user cause paid AI calls beyond the cap? Is the reservation guard atomic and does it fail closed?

**F. Infrastructure and process**
- Database account privileges (documented least-privilege user), connection over TLS, default `connectionLimit`, `schema.sql` and `seed.sql` demo accounts, `init.js` guard for staging/production, `db/create-admin.js`.
- CORS and cookies in the staging/production topology (frontend and API on different sites needs `SameSite=None` plus the Origin guard), `TRUST_PROXY`, HTTPS redirect, `dist/` served with correct headers by the static host.
- CI/CD (`.github/` if present): secrets handling, `npm ci`, pinned actions, test gating.

**Dynamic checks (local only).** Start the server against a throwaway database or use the existing fake-DB route tests as a model (`server/routes/*.routes.test.js`). Using test accounts you create, run: unauthenticated and cross-role request sweeps over the full route table, login/ID-token abuse, upload abuse (wrong type, renamed `.pdf`, oversize, path-like filenames, many files), XSS payload round trips through the editor and the Word/PDF export, concurrent state-transition requests, and a header check with `curl -I`. Save request/response evidence for each finding. **Do not run a scanner against anything but `http://localhost`.**

## PHASE 2 OUTPUT: write `docs/security/SECURITY-AUDIT-REPORT.md`

Structure:

1. **Scope and method**: what you read, what you ran, what you did not (and why).
2. **Route and trust-boundary inventory table.**
3. **Findings table**, sorted by severity (CRITICAL / HIGH / MEDIUM / LOW / INFO) with: ID (`SEC-01`…), title, CWE / OWASP category, file:line, affected roles, evidence, exploit scenario in one or two sentences, **recommended fix**, effort (S/M/L), and risk of the fix breaking existing behavior.
4. **Previously known findings**: each earlier item with its current status (open / fixed / changed) and proof.
5. **Items that need owner action** (credential rotation, host/proxy/header configuration, MySQL user, backups, demo and UAT account removal, session store decision). You never perform these yourself.
6. **Proposed implementation plan**: ordered batches, each with the files to change, the tests to add, and how to verify. Put the critical, small, high-value fixes first (typically: authorized file downloads instead of public `/uploads`, login/Google/register rate limiting with per-account and per-IP keys, session regeneration and revocation on password change, security headers via `helmet` or a small middleware, body-size and upload hardening, error-message scrubbing).
7. **Test evidence** and a **residual-risk statement** that says plainly what is still unverified.

Then **stop and wait for the owner to approve which batches to implement.** Do not begin Phase 3 on your own.

## PHASE 3: IMPLEMENT (only after approval, one batch at a time)

For each approved batch:

1. Write the **failing test first** (reproduce the vulnerability using the repo's route-test harness), show it fails, then make the smallest change that fixes it, then show it passes.
2. Prefer the existing modules over new ones: extend `server/lib/rateLimit.js` (`createLimiter`), `server/lib/hostConfig.js` (`applyHostSecurity`), `server/middleware/auth.js`, `server/lib/passwords.js`. Add a new dependency only with a written justification and the owner's approval (it changes `package.json` and the lockfile).
3. Make new protections **configurable and fail closed in staging/production**, with a safe development default, following the `sessionSecret` / `hostConfig` pattern (validate at startup, name the setting in the error, never print a value). Add each new env variable to `server/.env.example`, `docs/deployment/staging.env.template` and `production.env.template` with a comment (no real values).
4. Wire every new test file into the `npm test` script in the root `package.json`, then run the **full** suite (`npm test`) and the build (`npm run build`). All previously passing tests must still pass. Report the totals. If an unrelated test fails, say so; do not hide it or edit it to pass.
5. Update `CHANGELOG.md` (use the Edit tool, not a shell command with backticks), `docs/deployment/ENGINEERING-REPORT.md` section 3 and 13 statuses, and the audit report with **FIXED + evidence** per finding.
6. Do not commit unless asked. If asked, stage only the files you changed by explicit path, and end the message with the required co-author line.

## DEFINITION OF DONE

- Every route in the inventory has a recorded auth, role and ownership decision, and a test for the dangerous cases.
- No CRITICAL or HIGH finding remains open except those that strictly need owner action, each of which is listed with exact steps.
- Signed-out callers get 401 on every protected API and on every uploaded file; cross-user and cross-role requests get 403/404 as designed.
- Login, Google sign-in, registration, password reset, OCR and AI endpoints are rate limited; limits are configurable and tested.
- Session, cookie, header and upload hardening are in place and covered by tests; the build and the full test suite pass.
- The audit report states what was verified, what was not, and what remains.

Begin with Phase 1 now. Show me the inventory summary and your Phase 2 findings before changing any code.
