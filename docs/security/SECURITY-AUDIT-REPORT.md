# Security audit report: Syllabus CMS Plus

Date: 2026-11-12. Branch: `New-Regression-Rulling` at `90ef87e`. Sections 1 to 7 are phases 1 (inspect) and 2 (find), written before any code was changed, and are kept as they were found. **Section 8 records phase 3: batches A to D were implemented the same day, and says which findings are now fixed.**

## 1. Scope and method

### Read

- `server/index.js`, every file in `server/middleware/`, and these route files in full: `auth`, `users`, `students`, `syllabi`, `syllabusContent`, `reviewChain`, `comments`, `messages`, `notifications`, `logs`, `usage`, `settings`, `deadlines`, `pdfImport`, `syllabusCheck`, `health`, and `compliance` from line 100.
- Libraries in full: `hostConfig`, `sessionSecret`, `rateLimit`, `passwords`, `mailer`, `decisionEmail`, `accountStatus`, `avatar`, `googleProfile`, `catalogFileCleanup`, `roles`, `syllabusRules`, `reviewComments`, `adminSettings`, `emailDomain`, `corOcr`, `pdfImport`, `notify`, `http`. In part: `academicYear`, `assignments`, `deadlines`, `compliance/upload`, `syllabuscheck/gemini` (budget and prompt header only).
- `server/db/schema.sql` (foreign keys and cascade rules), `server/db/init.js` (seed guard), `.gitignore` against `git ls-files`, both `package.json` files, `.github/workflows/ci.yml`.
- Frontend: every `dangerouslySetInnerHTML`, `localStorage`, `window.open`, `target="_blank"` and `import.meta.env` use in `src/`; `src/lib/api.js`; `renderMarkup` / `esc` in `src/lib/syllabusModel.js`.
- `docs/deployment/ENGINEERING-REPORT.md` sections 3 and 13.

### Ran (all local, loopback only)

- A throwaway harness (outside the repository, in the session scratch folder) that builds an Express app with the same middleware order as `server/index.js` lines 25 to 98, mounts the 22 real routers, and uses an in-memory fake database, a temporary upload folder, and four test accounts created in the harness. It never calls `dotenv`, never opens MySQL, and makes no outbound request. Run three times: development, `NODE_ENV=staging`, `NODE_ENV=production`.
- `mysql2.format()` on sample statements to see how the installed driver (3.24.4) formats object and array parameters.
- `git log` / `git grep` for secret patterns, reporting commit, file and count only.

### Not done, and why

| Not done | Why |
|---|---|
| `server/.env` and any `.env.*` other than `.env.example` | Hard rule 2. The two exposed credentials in the earlier report were not re-checked. |
| `npm audit` | It contacts the npm registry. Needs your go-ahead. |
| Any test against real MySQL: races, `FOR UPDATE` behaviour, concurrent approve and withdraw, real SQL errors | No throwaway database was available without reading `.env`. Transactions were reviewed in code only. |
| Live Google sign-in, SMTP, Anthropic, Gemini | Hard rule 3. |
| Browser round trip of XSS payloads through the editor and the exports | Code review only. |
| Line review of handler bodies in `programs`, `courses`, `academicYears`, `institution`, `programPoReference`, `curriculum`, and `compliance` lines 1 to 99 | Time. Their middleware and request-input use were checked; all write routes there are admin-only. |
| The AI pipeline beyond the budget object, the prompt header and where status is written | Size. See SEC-20. |
| `STAGING-ARCHITECTURE.md`, `RUNBOOK.md`, `CREDENTIAL-READINESS.md` | Not read in full; only the engineering report's summary of them was used. |

## 2. Route and trust-boundary inventory

### Middleware order (`server/index.js`)

| Order | Line | What | Reachable without a session |
|---|---|---|---|
| 1 | 25 | `applyHostSecurity`: trust proxy, CORS allow-list, Origin / Sec-Fetch-Site guard on POST, PUT, PATCH, DELETE | yes |
| 2 | 27-28 | `express.json()` (default 100 kb), `express.urlencoded({ extended: true })` | yes |
| 3 | 29-36 | `express-session`, MemoryStore | yes |
| 4 | 40 | `/uploads/avatars` answers 404 | yes |
| 5 | 41 | `express.static` on `/uploads` | **yes (SEC-01)** |
| 6 | 65 | `/api/health` | yes, by design |
| 7 | 67 | `restoreSession` (remember-me cookie) | |
| 8 | 70-74 | student gate: a student session may call only `/api/auth` and `/api/students` | |
| 9 | 76-98 | routers | |
| none | | **no error-handling middleware, no 404 handler** | SEC-06 |

### Routes

121 route handlers. The unauthenticated sweep (section 7, T1) confirmed that every one answers 401 without a session except the six marked public. "Owner" means the `syllabi.user_id` check in `lib/syllabusRules.js`; "canView" means owner, or a reviewer when the syllabus is not a draft.

| Router file | Method and path (under the mount) | Auth | Role / ownership | Inputs | Side effects |
|---|---|---|---|---|---|
| `health` | GET `/api/health` | public | none | none | DB ping |
| `auth` | POST `/login` | public | none | body email, password, remember | session, remember token, activity row |
| | POST `/google` | public | allowlist + domain + `email_verified` | body token | session, JWT |
| | POST `/logout` | public | none | cookie | destroys session, deletes token |
| | POST `/forgot-password` | public, limited 5 per 15 min per IP and per email | none | body email | temp password row, email |
| | POST `/change-password` | signed in (allowed while change is due) | self | body | password hash, deletes remember tokens |
| | GET `/me` | session | self | none | refreshes session user |
| `students` | POST `/scan` | public, 15 per hour per IP | none | multipart image | OCR, file in `private/cor`, session data |
| | POST `/register` | public, same limiter | scan held in session | body password | user + profile rows |
| | GET `/me` | requireAuth | student, self | none | none |
| | GET `/pending`, GET `/:id/cor`, POST `/:id/verify` | requireAdmin | admin | params, body | profile update, file delete |
| `users` | PATCH `/me/profile`, PATCH `/me/preferences`, GET `/me/assignments` | requireAuth | self | body | user row |
| | POST `/me/avatar`, POST `/me/avatar/google`, DELETE `/me/avatar` | requireAuth | self | multipart / body token | file write, outbound fetch to Google |
| | GET `/:id/avatar` | requireAuth | reviewer, self, or message partner; else 404 | params | file read |
| | GET `/`, POST `/`, POST `/:id/resend-credentials`, GET `/subject-holders`, GET and PUT `/:id/assignments`, DELETE `/:id/avatar`, POST `/:id/disable`, POST `/:id/enable`, DELETE `/:id` | requireAdmin | admin | body, params | user rows, emails, notifications |
| `settings` | GET `/policy` | requireAuth | any staff | none | none |
| | GET `/`, PUT `/` | requireAdmin | admin | body (whitelisted keys) | settings row |
| `syllabi` | GET `/` | requireAuth | own rows; reviewers also non-drafts | query | none |
| | POST `/` | requireAuth | always refused (409) | multipart | upload written then deleted |
| | PUT `/:id` | requireAuth | status change: reviewer rules in `syllabusRules`; content: always refused | body, multipart | status, logs, comment, notifications, email |
| | DELETE `/:id` | requireAuth | admin (not approved) or owner's draft | params | row delete (cascades) |
| | GET `/:id/versions` | requireAuth | canView | params | none |
| `syllabusContent` | POST `/drafts` | requireAuthor | faculty with an assignment, or admin | none | draft row |
| | GET `/:id/content`, GET `/:id/po-review`, GET `/:id/review` | requireAuth | canView | params, query | none |
| | PUT `/:id/content`, POST `/:id/po-review/adopt`, POST `/:id/submit` | requireAuthor | owner + editable status + assignment, row locked | body | content, version, run, notifications |
| | POST `/:id/prepare-check`, `/:id/publish`, `/:id/resume-draft` | requireAdmin | owner (dean's own syllabus) | body | status, version, stage clear |
| `pdfImport` | GET `/pdf-import/config` | requireAuth | any | none | none |
| | POST `/:id/import-pdf` | requireAuth | owner + editable; 5 per 10 min per user; one at a time | multipart PDF (memory) | worker thread parse, no write |
| `comments` | GET `/:id/comments`, GET `/comment-summary`, POST `/:id/comments/read` | requireAuth | canView / owner | params | read marker |
| | POST `/:id/comments` | requireAuth | reviewer + canView | body text | comment, notification |
| `reviewChain` | POST `/:id/stage-clear` | requireAuth | dean, Asst. VPAA or LIC Director; not own; AI check or recorded choice first; row locked | body note | stage row, log, status |
| | POST `/:id/review-without-ai` | requireAuth | reviewer; not own | body note | choice row, log |
| | GET `/:id/stages` | requireAuth | canView | params | none |
| `compliance` | GET `/syllabi/:id/compliance`, GET `/compliance` | requireAuth | canView / own list | params, query | none |
| | POST `/syllabi/:id/compliance/recheck` | requireAuth | owner or reviewer; 10 per minute per user; one at a time server-wide | params | **paid AI call**, run row |
| | GET `/compliance/program-approvals`, `/compliance/history`, `/compliance/runs/:runId` | requireAuth | reviewer | query, params | none |
| `syllabusCheck` | GET `/status` | requireAuth | any | none | none |
| | POST `/syllabi/:id/academic-v2-preview` | requireAuth | canView; inert unless an offline replay is installed | params | none |
| | GET, POST `/references`; POST `/references/:id/approve`, `/retire` | requireAdmin | admin | body | reference rows |
| | GET `/runs/:id/decisions`, GET `/runs/:id/improvement-plan` | requireAuth | canView | params | none |
| | POST `/runs/:id/decisions`, POST `/runs/:id/improvement-plan/apply` | requireAuth | owner + editable | body | decision rows, content |
| | POST `/runs/:id/suggestions/:suggestionId/refine` | requireAuth | owner + editable; 12 per 10 min per user; one at a time | body | **paid AI call** |
| `institution` | GET `/outcomes`; PUT `/outcomes` | requireAuth; admin for PUT | | body | master rows |
| `programs`, `programPoReference` | GET `/`, GET `/:id/outcomes`; all writes | requireAuth; admin for writes and for all PO-reference routes | | body, params | catalog rows |
| `courses` | GET `/`, GET `/:id`; all writes | requireAuth; admin for writes | | body, query | catalog rows |
| `academicYears` | GET `/`; all writes | requireAuth; admin for writes | | body | year rows, catalog copy |
| `curriculum` | GET `/` | requireAuth | any | none | none |
| `logs` | GET `/` | requireAuth | own rows; `scope=all` admin only | query | none |
| `messages` | GET `/partners`, GET `/`, GET `/:syllabusId`, POST `/:syllabusId`, PUT `/read/:syllabusId` | requireAuth | owner or admin of a non-draft; receiver chosen by the server | body text | message, notification |
| `notifications` | GET `/`, GET `/summary`, PUT `/read-all`, PUT `/:id/read` | requireAuth | `user_id = me` in the SQL | params | read flags |
| `usage` | POST `/heartbeat`, GET `/summary` | requireAuth | self | query | usage counters |
| `deadlines` | GET `/mine` | requireAuth | self | none | none |
| | all others | requireAdmin | admin | body, params | deadline rows, notices, emails |

### Data and files at rest

| Item | Finding |
|---|---|
| Credentials and tokens | `users.password_hash` (bcrypt cost 10), `password_temp.temp_hash` (30 minutes), `remember_tokens.token_hash` (sha256 of 32 random bytes, single use, rotated). No plaintext secret column seen. |
| Personal data | users (name, email), `student_profiles` and `student_enrollments` (student number, name, section), COR images in `server/private/cor`, avatars in `server/private/avatars` (3 files on this machine). |
| Cascades | Deleting a user cascades to their syllabi, versions they created, comments, messages, `account_activity` and stage rows. Deleting a syllabus cascades to its `submission_logs`. See SEC-15. |
| `server/uploads/` | Ignored by git. On this machine it holds one empty `avatars` folder and no PDF. |
| `server/private/`, `tmp/`, `dist/`, `*.log` | Ignored by git; none tracked (0 paths under `tmp/` or `dist/` in `git ls-files`). The two `server/dev-api*.log` files hold stack traces and the word "password" in route names; no email address and no key pattern. |
| `.env` | `server/.env` and `.env` have **never** been committed (`git log --all -- server/.env .env` is empty). Only `server/.env.example` has history. |
| Secret patterns in tracked files and history | Google (`AIza…`), Anthropic, OpenRouter and Groq key shapes, private-key headers: every match in tracked files is a test placeholder. No real-length Google key appears in any commit that mentions the prefix. |
| `docs/ai-check-request-audit.json`, `pdf-import-api-audit.json`, `pdf-layout-extraction-audit.json` | Tracked; 223 to 3,078 bytes; no email address or key pattern. |
| `reference-data/` | **Tracked**: three syllabus PDFs and eight curriculum JPEG scans. See SEC-18. |
| `server/db/seed.sql` | Tracked; one `INSERT INTO users` with the demo accounts. `init.js` skips it for staging and production. |
| `big.json` | Untracked, 200 KB, one top-level key `a`. Not ignored, so `git add -A` would stage it. |

## 3. Findings

Verdicts: VULNERABLE (reproduced), WEAK (real gap, limited or conditional impact), OK, NOT VERIFIED. Effort: S under half a day, M one to two days, L more.

| ID | Sev | Title | CWE / OWASP | Where | Affected | Verdict |
|---|---|---|---|---|---|---|
| SEC-01 | HIGH | Uploaded files are served without sign-in | CWE-306, A01 | `server/index.js:41`; `routes/syllabi.js:27-29` | anyone on the network | VULNERABLE |
| SEC-02 | HIGH | No rate limit or lockout on password and Google sign-in | CWE-307, A07 | `routes/auth.js:39, 88` | every account | VULNERABLE |
| SEC-03 | MEDIUM | The `/uploads/avatars` block can be bypassed five ways | CWE-22 / CWE-178, A01 | `server/index.js:40` | anyone | VULNERABLE (latent) |
| SEC-04 | MEDIUM | Sign-in reveals which emails are registered | CWE-204, A07 | `routes/auth.js:98, 108` | every account | VULNERABLE |
| SEC-05 | MEDIUM | The session id is not replaced at sign-in | CWE-384, A07 | `routes/auth.js:78, 122`; `middleware/auth.js:81` | every account | VULNERABLE |
| SEC-06 | MEDIUM | Other sessions stay signed in after a password change | CWE-613, A07 | `routes/auth.js:189-192` | every account | VULNERABLE |
| SEC-07 | MEDIUM | Errors leak stack traces, file paths and SQL text | CWE-209, A05 | `server/index.js` (no error handler); `lib/http.js:26`; 500 branches in `messages`, `notifications`, `logs`, `usage`, `users`, `syllabi` | anyone | VULNERABLE |
| SEC-08 | MEDIUM | No security headers; `X-Powered-By: Express` | CWE-693, A05 | `server/index.js` | all | VULNERABLE (known) |
| SEC-09 | MEDIUM | MemoryStore sessions, and a public route that creates them | CWE-400, A05 | `server/index.js:29-36`; `routes/students.js:58` | availability | WEAK (known) |
| SEC-10 | MEDIUM | Public OCR route is cheap to abuse and leaves COR photos behind | CWE-400 / CWE-770, A04 | `routes/students.js:24-61`; `lib/corOcr.js:22-53` | availability, student data | WEAK |
| SEC-11 | MEDIUM | No per-user or per-day ceiling on paid AI checks; one check blocks everyone | CWE-770, A04 | `routes/compliance.js:37, 43, 149-165`; `routes/syllabusCheck.js:163-195` | cost, availability | WEAK |
| SEC-12 | LOW | A generated password never expires, and Google sign-in skips the forced change | CWE-262 / CWE-620, A07 | `routes/auth.js:68`; `routes/users.js:105-110` | staff accounts | WEAK |
| SEC-13 | LOW | Temporary password is reusable for 30 minutes; student password rule is weaker | CWE-521, A07 | `routes/auth.js:103-113`; `routes/students.js:77-78` | accounts | WEAK |
| SEC-14 | LOW | `adminComment` reaches SQL without a type check | CWE-20, A03 | `routes/syllabi.js:201, 250` | reviewers | WEAK |
| SEC-15 | LOW | Audit trail has no IP, misses unknown-email attempts, and is deleted with the user or syllabus | CWE-778, A09 | `db/schema.sql:129-141, 441`; `routes/auth.js:98` | forensics | WEAK |
| SEC-16 | LOW | A JWT is issued and kept in `localStorage` but authorizes nothing; unused `canEditSyllabus` | CWE-1164 / CWE-922, A04 | `middleware/jwt.js`; `middleware/canEditSyllabus.js`; `src/lib/api.js:7-19` | none today | WEAK |
| SEC-17 | LOW | Authenticated JSON has no `Cache-Control: no-store` | CWE-525, A05 | all routers | shared computers | WEAK |
| SEC-18 | LOW | Real syllabus PDFs and curriculum scans are tracked in git | CWE-538, A05 | `reference-data/` | document confidentiality | OWNER DECISION |
| SEC-19 | LOW | `multer` 1.x and caret ranges on every server dependency | CWE-1104, A06 | `server/package.json` | supply chain | NOT VERIFIED |
| SEC-20 | INFO | Prompt injection can bias the AI result that gates submission | LLM01 | `lib/syllabuscheck/gemini.js:116` | review quality | NOT VERIFIED live |
| SEC-21 | INFO | 100 kb JSON limit against a 512 KB content cap; unused urlencoded parser | CWE-20 | `server/index.js:27-28`; `routes/syllabusContent.js:24` | functional | WEAK |
| SEC-22 | INFO | Rate limiters are in memory and per process; `students` limiter map is never pruned | CWE-770 | `lib/rateLimit.js`; `routes/students.js:31-39` | multi-instance | WEAK |
| SEC-23 | INFO | Database pool has no TLS option | CWE-319 | `server/index.js:43-50` | remote DB only | OWNER DECISION |
| SEC-24 | INFO | CI actions pinned by tag, not commit | CWE-829 | `.github/workflows/ci.yml` | supply chain | WEAK |

### Detail

**SEC-01 Uploaded files are served without sign-in.** `express.static` is mounted at line 41, before `restoreSession` at line 67, so no session is ever looked at. T2: `GET /uploads/1791000000000-123456789.pdf` with no cookie returned 200 `application/pdf`. Names are `Date.now()` plus `Math.random() * 1e9`, which is not a secret. The frontend links to these URLs directly (`SyllabusViewModal.jsx:86`, `VersionHistoryModal.jsx:57`). Current exposure on this machine is nil, because both upload routes now refuse with 409 and delete the file, and the folder holds no PDF. Any database that still has file-backed syllabi from before the builder exposes each one to anyone who can reach the server, including another faculty member's draft. Scenario: a signed-out visitor requests a known or guessed file name and reads an unapproved syllabus. Fix: remove the static mount; add `GET /api/syllabi/:id/file` (and a version variant) that checks `canView`, resolves the stored name with the existing `uploadFile()` guard in `catalogFileCleanup.js`, and sends it with `Content-Disposition`, `nosniff` and `private, no-store`; switch the two frontend links. Effort S to M. Risk: legacy file links break until the frontend is switched in the same batch.

**SEC-02 No rate limit or lockout on sign-in.** T5: 40 wrong passwords in a row for one account all returned 401, none 429, and the correct password worked straight after. `POST /google` has no limiter either (each call makes the server verify a token). `POST /students/register` shares the 15-per-hour per-IP limiter with `/scan`. Scenario: a script tries the common-password list against a known staff email at about 15 attempts a second (bcrypt cost 10 took 66 ms each here). Fix: `createLimiter` keyed by IP and by account on `/login` and `/google`, with a growing delay per account rather than a hard lock (a hard lock lets anyone lock out the dean); configurable, fail closed in hardened modes. Effort S. Risk: low; tests that sign in many times need the limiter reset hook that `forgotLimiter` already has.

**SEC-03 Avatar block bypass.** Line 40 matches the literal path only; `express.static` then decodes and normalizes. T2: `/uploads/avatars/u1-test.webp` returned 404, but `/uploads/%61vatars/…`, `/uploads//avatars/…`, `/uploads/./avatars/…`, `/uploads/x/../avatars/…` and `/uploads/avatars%2f…` all returned 200. Avatars now live in `server/private/avatars`, and `server/uploads/avatars` is empty here, so nothing leaks today. A server that still has old photos in `uploads/avatars` exposes them. Fixed by SEC-01 (no static mount). Effort: none beyond SEC-01.

**SEC-04 Account enumeration.** T5: a registered email with a wrong password gets `401 Invalid email or password` after 66 ms; an unregistered one gets `403 Access Denied. Account not registered.` in under 1 ms. `forgot-password` already answers uniformly. Fix: one message and status for both, and a dummy bcrypt compare when the account is missing. Effort S. Risk: the UI text for "not registered" changes; the Google path keeps its own message because Google has already proven the identity.

**SEC-05 Session fixation.** There is no `req.session.regenerate` anywhere in `server/`. T6: signing in as the admin and then, with the same cookie, as a faculty member kept the same session id, and that cookie then belonged to the faculty account. An attacker who can plant a cookie in the victim's browser (a shared computer, a sibling subdomain) keeps a valid session after the victim signs in. Fix: regenerate in `/login`, `/google` and `restoreSession`, carrying over `corScan` only where needed. Effort S. Risk: low.

**SEC-06 Sessions survive a password change.** T7: with two sessions for one account, changing the password in one returned 200, issued no new cookie, and the other session still got 200 on `/api/notifications`. Remember tokens are deleted, but live sessions are not, and MemoryStore cannot list sessions by user. A stolen session therefore outlives the password change meant to end it. Disabling an account does end sessions at their next request, because `requireAuth` re-reads the row. Fix: a `sessions_valid_after` timestamp (or a counter) on `users`, stamped into the session at sign-in and compared in `requireAuth`, bumped on password change and resend-credentials; regenerate the current session. Effort M (one small migration). Risk: low.

**SEC-07 Error leakage.** There is no error-handling middleware, so Express's default runs. T4 and T13, in development **and with `NODE_ENV=staging`**: malformed JSON to `/api/auth/login` returned a `text/html` page with the stack trace and absolute file paths; a database error passed to `next()` from `requireAuth` returned the stack and the database name. With `NODE_ENV=production` the stack is hidden. Separately, in every mode, route 500 branches return `err.message`: T13 returned `{"error":"Unknown column 'm.secret_col' in 'field list'"}`. Fix: one final JSON error handler (400 for parse errors, 413 for size, a generic 500 with a request id, full detail to the server log only), and change `sendError` and the hand-written 500 branches to a generic message. Effort S to M. Risk: tests that assert on a 500 message text need updating.

**SEC-08 Security headers.** T3: no HSTS, CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` or `Permissions-Policy` on any response, and `X-Powered-By: Express` on all. The API returns JSON, so a small middleware in `applyHostSecurity` covers it without a new dependency: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` for the API, HSTS in hardened modes, and `app.disable('x-powered-by')`. The CSP for the React app itself belongs to whatever serves `dist/` (owner action). Effort S. Risk: low.

**SEC-09 MemoryStore.** Known and still open. New detail: `POST /api/students/scan` is public and stores the parsed scan in the session, so each new visitor creates a server-side session that MemoryStore does not sweep. Decision needed: a MySQL-backed store (new dependency) or a single-instance deployment with a restart policy.

**SEC-10 OCR abuse.** `/scan` accepts 10 MB by declared MIME type only, runs `sharp` with no `limitInputPixels`, then Tesseract on up to four rotations plus three header passes. The only limit is 15 per hour per IP, with no cap on scans running at once, so a handful of addresses can keep every core busy. The saved JPEG in `private/cor` is deleted only on a later scan in the same session, on auto-verification, or on an admin decision: a visitor who scans and leaves, or whose session expires, leaves a student's COR photo on disk indefinitely. Fix: magic-byte check (reuse `detectImageExt`), `limitInputPixels`, a concurrency cap of one or two, and a periodic sweep of `private/cor` files not referenced by `student_profiles`. Effort M. Risk: low.

**SEC-11 AI cost and availability.** A faculty member may run `recheck` on their own draft 10 times a minute, and the budget object in `gemini.js` is per check. I found no per-user-per-day or server-wide daily ceiling on the production path; the `$10` register lives in the evaluation scripts. The single-flight lock (`activeChecks`, keyed by the app) means one person re-checking in a loop also blocks every reviewer's check. Not verified against a live provider. Fix: a per-user daily count and a server-wide daily cost ceiling, both configurable and fail closed, plus fairness for the lock (for example reviewers before authors). Effort M. Risk: medium; this touches the checker path, so it must not change scoring.

**SEC-12 Generated passwords.** `POST /users` and resend-credentials email a 12-character password that stays valid until changed. `POST /google` builds the session from a query that omits `must_change_password` (line 68), so a user who only ever signs in with Google is never asked to change it and the emailed password remains valid for good. (`GET /auth/me` re-reads the flag, so the UI may still prompt; the API calls in between are not gated.) Fix: select the column in the Google query, and give generated passwords a lifetime. Effort S. Risk: users who never changed a generated password would need new credentials.

**SEC-13 Temporary password.** A temp password can be used any number of times within its 30 minutes; it is deleted only when a new password is chosen. Student registration accepts any 8 or more characters with no upper bound and no letter-and-digit rule, unlike `validatePassword`. Fix: delete the temp row on first successful use; use `validatePassword` in `/register`. Effort S.

**SEC-14 `adminComment` type.** `validateReason` cleans the comment, but line 250 stores the raw `adminComment`. With status `under_review` or `approved`, where no reason is required, a non-string passes validation. On the installed driver (mysql2 3.24.4) an object is formatted as `'[object Object]'` and an array as `'x', 'y'`, so the worst case is a SQL syntax error whose text is returned (SEC-07), or a junk comment. I checked this with `mysql2.format()`. Older `mysqljs`-style escaping expands an object into `col = value` pairs, which here would have allowed setting other columns, including `status`; `server/package.json` allows `^3.11.0`. Fix: store the cleaned string, reject non-strings with 400. Effort S. Risk: none.

**SEC-15 Audit trail.** No table records the IP address or user agent. A failed sign-in for an unknown email records nothing. `account_activity` rows are deleted with the user (`ON DELETE CASCADE`), and `submission_logs` rows with the syllabus, which an administrator may delete while it is not approved. No retention policy exists (known). Fix: record IP and user agent, log unknown-email failures to a table not tied to a user, and change the two cascades to `SET NULL` with the name kept in the row. Effort M (migration).

**SEC-16 JWT.** `signAccessToken` runs on every sign-in and the browser stores the token in `localStorage` and sends it as `Authorization: Bearer`. No mounted route verifies it; `canEditSyllabus` is imported nowhere. If it were ever mounted it would not check `disabled_at` or `must_change_password`. The token is HS256 with `algorithms` pinned and an 8-hour expiry, with no `iss` or `aud`. Fix: stop issuing and storing it, and delete the unused middleware, or finish it properly. Effort S. Risk: `poReferenceApi.js` and `api.js` read the token; they work without it because the cookie authorizes.

**SEC-18 Tracked documents.** `reference-data/` holds three syllabus PDFs and eight curriculum page scans, tracked and therefore on the GitHub fork. Your notes say these PDFs are local-only. If the fork is public, they are public. I did not open them. Owner decision: keep, or remove from the tree (history would still hold them unless rewritten, which hard rule 4 forbids me from doing).

**SEC-19 Dependencies.** Installed: express 4.22.3, multer 1.4.5-lts.2, express-session 1.19.0, jsonwebtoken 9.0.3, bcryptjs 2.4.3, mysql2 3.24.4, nodemailer 10.1.1, cors 2.8.6, google-auth-library 11.2.0, pdfjs-dist 6.4.299, tesseract.js 7.0.0, @napi-rs/canvas 1.0.13. All server dependencies except the Anthropic SDK use `^` ranges (the lockfile pins them for `npm ci`). The multer 1.x line is deprecated in favour of 2.x, which carries fixes for denial-of-service advisories; I have not confirmed which apply to this exact build. `npm audit` was not run.

**SEC-20 Prompt injection.** The alignment prompt states that document text is untrusted data, the Anthropic schema requires `additionalProperties: false`, and every `UPDATE syllabi SET status` is in a route handler behind role checks, so model output cannot change a status, approve, or send anything. What it can do is produce a more favourable judgment, and that judgment feeds the gate in `compliance.requireHybrid`. Human review by three stages and the VPAA still follows. Not tested against a live model.

### Reviewed and found sound

- **Authorization on every route.** T1: 115 protected handlers all return 401 unauthenticated. T9: a student gets 403 everywhere outside `/auth` and `/students`; a faculty account gets 403 on ten admin and reviewer routes; a session with a password change due gets 403 on everything except `/auth/me`. Ownership is checked on the server with `canView` / `isOwner` on a locked row, and misses answer 404.
- **Review chain.** Status changes run in one transaction on `SELECT … FOR UPDATE`; `canSetStatus` limits approve and reject to the VPAA; approval requires all three stages on the newest version and the AI check or a recorded choice; owners cannot clear their own stage; approved is final in both the read and the `DELETE` statement. I found no request field that sets `user_id`, `status`, `stage` or `version` outside these rules. Concurrency was reviewed in code, not exercised.
- **SQL.** No string-built SQL from request data. Interpolated fragments are constants (`LABEL_SQL`, `TEMP_MINUTES`, limit constants, fixed column lists).
- **XSS.** `renderMarkup` escapes `& < > "` first and then adds only `<strong>`, `<ul>`, `<li>`, `<div>`; there is no link, image or attribute path. The only `dangerouslySetInnerHTML` sinks use it. Email bodies are escaped by `mailer.esc`; subjects are built from stored course codes and titles (nodemailer encodes headers).
- **CSRF and CORS.** T8: a foreign `Origin` and a `Sec-Fetch-Site: cross-site` request are both refused with 403; no CORS header is sent to a foreign origin; wildcard origins are refused at startup.
- **Path handling.** Avatar, COR and upload-check paths all use `path.basename`; `catalogFileCleanup.uploadFile` validates with a strict pattern and a resolved-directory check. T12: a `../../evil.pdf` file name wrote nothing outside the folder, wrong extensions were refused, and no file was left behind.
- **Secrets at startup.** Session and JWT secrets, CORS origins, cookie flags and `TRUST_PROXY` fail closed in staging and production.
- **Passwords.** bcrypt cost 10, 72-character cap on chosen passwords, generated passwords from `crypto.randomInt`, never returned in a response; the only log lines name the recipient address, not the password.
- **PDF import.** Magic bytes checked, parsed in a worker thread with a 256 MB heap cap and a 120-second kill, per-user limiter, no file written.
- **Health endpoint.** Status and database state only, `no-store`.

## 4. Previously known findings

| Earlier item | Status now | Proof |
|---|---|---|
| Login has no rate limit | **Open** (SEC-02) | T5; `/google` and `/students/register` also confirmed |
| Exposed Gmail app password and Gemini key | **Not re-verified** | `.env` not opened; no key in tracked files or history by pattern |
| MemoryStore sessions | **Open** (SEC-09) | `server/index.js:29-36` |
| No security headers | **Open** (SEC-08) | T3 |
| Demo seeds and UAT reviewer accounts (ids 38 to 40) in dev databases | **Not re-verified** | no database access; `init.js:29` guard confirmed in code |
| Least-privilege DB user, HTTPS and HSTS at the proxy, audit-log retention | **Open, owner action** | not configurable from the repository |
| "SQL parameterization … XSS … VERIFIED" | **Confirmed**, with the SEC-14 caveat | section 3 |
| Fresh suspicion: `/uploads` before `restoreSession` | **Confirmed** (SEC-01), plus the block bypass (SEC-03) | T2 |

## 5. Items that need owner action

1. Rotate the Gmail app password, the Gemini key and the database password noted in earlier reports; I did not and cannot verify them.
2. Decide whether `reference-data/` stays in the repository (SEC-18), and whether the GitHub fork is private.
3. Remove the demo accounts and UAT reviewer accounts (ids 38 to 40) from every database that will hold real data.
4. Choose the session store (SEC-09).
5. At the proxy and static host: HTTPS redirect, HSTS, the CSP for the React app, and a request-rate limit in front of `/api/auth` and `/api/students`.
6. Create the least-privilege MySQL user; decide on TLS to the database if it is not on the same host (SEC-23).
7. Set an audit-log retention period.
8. Say whether I may run `npm audit --omit=dev` in the root and in `server/` (it contacts the npm registry).
9. Check on each real server whether `server/uploads/` holds any file, and whether any `syllabi.file_path` or `syllabus_versions.file_path` is not null. That decides how urgent SEC-01 is for you.
10. Add `big.json` to `.gitignore` or delete it.

## 6. Proposed implementation plan

Each batch: failing test first in the route-test harness, smallest fix, full `npm test` and `npm run build`, then CHANGELOG, engineering report and this file.

| Batch | Fixes | Files | Tests to add | Dependency or migration |
|---|---|---|---|---|
| A | SEC-01, SEC-03: authorized file route, remove the static mount | `server/index.js`, `routes/syllabi.js` (or a new `routes/files.js`), `src/components/SyllabusViewModal.jsx`, `VersionHistoryModal.jsx` | signed-out 401; other faculty 404; owner and reviewer 200 with `nosniff`; the five bypass paths 404 | none |
| B | SEC-02, SEC-04: sign-in limiter and uniform answer | `routes/auth.js`, `lib/rateLimit.js`, env templates | 429 after N per account and per IP; reset on success; same body and status for unknown email | none |
| C | SEC-05, SEC-06, SEC-12, SEC-13: session regeneration, revocation on password change, Google flag, single-use temp password | `routes/auth.js`, `middleware/auth.js`, `routes/users.js`, `routes/students.js`, one migration | new sid after login; second session 401 after change; Google session carries the flag; temp password refused the second time | migration for `users.sessions_valid_after` |
| D | SEC-07, SEC-08, SEC-17, SEC-21: error handler, headers, `no-store`, body limits | `lib/hostConfig.js`, `server/index.js`, `lib/http.js`, 500 branches | malformed JSON gives JSON 400 with no stack in every mode; headers present; 500 body is generic | none |
| E | SEC-14, SEC-16 | `routes/syllabi.js`, `middleware/`, `src/lib/api.js`, `poReferenceApi.js` | non-string `adminComment` 400; sign-in works with no token | none |
| F | SEC-10, SEC-22: OCR hardening and COR sweep | `routes/students.js`, `lib/corOcr.js` | spoofed MIME refused; third concurrent scan 429; orphan file removed | none |
| G | SEC-11: AI ceilings | `routes/compliance.js`, `routes/syllabusCheck.js`, env templates | daily count refused with 429; scoring unchanged | needs your decision on the numbers |
| H | SEC-15 | migration, `lib/accountActivity.js` | IP recorded; trail survives user delete | migration |
| later | SEC-09, SEC-19 | session store, `multer` 2.x | | new dependency, needs approval |

Recommended first: A, B, C, D. They are small, independent, and close both HIGH findings.

## 7. Test evidence and residual risk

Harness results (development mode unless stated; session ids shown as hash fingerprints, test passwords random and never printed).

| Test | Result |
|---|---|
| T1 unauthenticated sweep, 121 handlers | every protected handler 401; no exception in development, staging or production mode |
| T2 `/uploads` with no cookie | PDF 200; `/uploads/avatars/…` 404; `%61vatars`, `//avatars`, `./avatars`, `x/../avatars`, `avatars%2f` all 200 |
| T3 headers on `/api/health` and an upload | `x-powered-by: Express`; all six security headers absent; upload `cache-control: public, max-age=0` |
| T4 malformed JSON | 400 `text/html` with stack in development and staging; no stack in production. 150 kb body: 413 with stack |
| T5 40 wrong passwords | 40 × 401, then correct password 200. Known email 401 in 66 ms; unknown email 403 in 0 ms |
| T6 two sign-ins on one cookie | same session id; cookie now belongs to the second account |
| T7 password change | 200, no new cookie; the other session still 200 |
| T8 origin guard | foreign `Origin` 403; `Sec-Fetch-Site: cross-site` 403; no `Origin` 200; no CORS header for a foreign origin |
| T9 role gates | student 5 of 5 refused; password-change-due 3 of 3 refused and `/auth/me` 200; faculty 10 of 10 admin and reviewer routes 403 |
| T12 legacy upload | `.exe` and `.html` names 400; `../../evil.pdf` wrote nothing outside; 0 files left behind |
| T13 database error | via `next()`: 500 `text/html` with stack and database name (development, staging); route 500: raw SQL error text in JSON (all modes) |
| `mysql2.format` | object parameter outside `SET ?` becomes `'[object Object]'`; array becomes `'x', 'y'` |

The harness copies the middleware lines of `server/index.js` rather than starting `index.js` itself (which would load `.env` and connect to the configured database), so T2 to T4 hold only as long as that copy matches; it matched lines 25 to 41 and 65 to 74 when written.

**Residual risk, stated plainly.** Not verified: anything that needs a real MySQL (races between approve, withdraw and resubmit; the exact text of real SQL errors); live Google, SMTP and AI behaviour; whether the earlier exposed credentials were rotated; the demo and UAT accounts in real databases; `npm audit` results; browser-level XSS and export round trips; the unread handler bodies listed in section 1; and the AI pipeline beyond the points in SEC-20. The two HIGH findings and SEC-03 to SEC-07 are reproduced. SEC-10, SEC-11 and SEC-14 are from code review and are conditional as described.

## 8. Phase 3: batches A to D (implemented 2026-11-12, not committed)

Each fix was written test-first: the new test file was run and failed, then the change was made, then it passed.

| Finding | Status | What changed | Test that failed before and passes now |
|---|---|---|---|
| SEC-01 public uploads | **FIXED** | `server/index.js` serves no folder; `/uploads/*` answers 404. New `server/routes/syllabusFiles.js`: `GET /api/syllabi/:id/file` for the owner, or a reviewer of a non-draft. Frontend links switched (`src/lib/api.js`, `SyllabusViewModal.jsx`, `VersionHistoryModal.jsx`) | `syllabusFiles.routes.test.js` (8 tests): signed-out 401; other faculty 404; reviewer on a draft 404; `nosniff`, `private, no-store`; version of another syllabus 404 |
| SEC-03 avatar block bypass | **FIXED** | removed with the static mount; the stored-path resolver refuses `avatars`, `..`, `%`, backslashes and anything that is not a PDF | same file: the resolver test and the stored-path test |
| SEC-02 no sign-in limit | **FIXED** | `server/lib/signInLimits.js` (three settings, validated at startup, cannot be turned off); `routes/auth.js` counts failures per account and per address; `lib/rateLimit.js` gained `give` | `signin-security.routes.test.js`: 429 after the limit even with the right password; a correct sign-in never counted; per-address limit; Google limit; settings validation |
| SEC-04 account enumeration | **FIXED** | unknown email answers 401 "Invalid email or password" after a dummy bcrypt compare | same file: identical status and body |
| SEC-05 session fixation | **FIXED** | `startSession` in `middleware/auth.js` regenerates the session at password sign-in, Google sign-in and remembered-device restore | same file: three tests; the planted cookie gets 401 afterwards |
| SEC-06 sessions survive a password change | **FIXED** | `endSessionsOf` on password change and on resend-credentials; checked in `requireAuth`, `restoreSession` and `/auth/me`; the changing session continues on a new id | same file: the other session and the old id both get 401 |
| SEC-07 error leakage | **FIXED** | `applyErrorHandling` in `lib/hostConfig.js`; `serverError` / `SERVER_ERROR` in `lib/http.js`; 500 branches in `messages`, `notifications`, `logs`, `usage`, `curriculum`, `users`, `syllabi` | `error-and-headers.routes.test.js`: malformed JSON 400 JSON in development and staging; 20 routes with a failing database return the generic message and no SQL text |
| SEC-08 security headers | **FIXED for the API** | `securityHeaders` in `applyHostSecurity`; `x-powered-by` disabled; HSTS in hardened modes | same file. The CSP of the React app is still owner action |
| SEC-12 generated password and Google | **PARTLY FIXED** | the Google query now reads `must_change_password`. Generated passwords still have no expiry | `signin-security.routes.test.js` |
| SEC-13 temporary password, student rule | **FIXED** | the temp row is deleted at its first successful use; student registration uses `validatePassword` | same file |
| SEC-17 `no-store` | **FIXED** | set for every `/api` path; a route may set its own (profile photo) | `error-and-headers.routes.test.js` |
| SEC-21 body limit | **FIXED** | `JSON_BODY_LIMIT` 700 kb. The urlencoded parser was left as it is | same file |

Still open, unchanged: SEC-09, SEC-10, SEC-11, SEC-14, SEC-15, SEC-16, SEC-18, SEC-19, SEC-20, SEC-22, SEC-23, SEC-24, and every item in section 5.

### Behaviour that changed on purpose

1. An unknown email at password sign-in now gets 401 "Invalid email or password", not 403 "Access Denied. Account not registered." Two assertions in `server/routes/passwords.routes.test.js` and one in `scripts/e2e/scenarios.cjs` expected the old answer and were updated.
2. Student registration refuses a password with no letter or no digit, or longer than 72 characters.
3. A temporary password works once. A second "Forgot password" request gives a new one.
4. After 10 wrong passwords in 15 minutes, password sign-in for that account answers 429 until the window ends, to anyone. Google sign-in and a remembered device still work for the owner.
5. A route's unexpected failure now reads "Something went wrong on the server. Please try again." in the UI; the reason is in the server log.
6. Old `/uploads/...` links stop working. Files are reached through the new route.

### Design notes and limits

- Session ending is held in process memory, as the sessions are. A restart ends every session anyway. With more than one server process, or a shared session store later, it must move to the store or the database (this is part of SEC-09).
- The sign-in counters are per process too. Behind a proxy they key on `req.ip`, so `TRUST_PROXY` must be correct; it is already required in staging and production.
- The uploaded-file response allows framing only by the configured application origins, because the review window shows the PDF in a frame.
- No dependency was added and no migration is needed.

### Verification

| Check | Result |
|---|---|
| New tests | 33 of 33 pass (8 + 14 + 11) |
| `npm test` | 2,357 of 2,364 pass. The 7 failures are in the AI evaluation scripts (`anthropic-harness.test.js`, `live-pipeline-eval` and related): their assertions are on prompt-version labels in printed plans, and their output mentions none of the changed files. Your notes record 7 failing tests before this work; I did not re-run the suite on an untouched tree to prove they are the same 7 |
| Conformance suites (`server/lib/syllabuscheck/vpaa-conformance/*.test.js`) | 276 of 276 pass |
| `npm run build` | passes |
| Not run | the browser E2E (`npm run test:e2e`, needs a local MariaDB and Chromium), `node scripts/test-vpaa-ui.mjs`, any real MySQL, any live provider. The PDF frame in the review window and the download link were not checked in a browser |

## 9. Second pass: database and remaining API routes, by attack type (2026-11-12, read-only)

Scope of this pass: `server/db/schema.sql`, `init.js`, `create-admin.js`, every `createPool` / `createConnection` call, `seed.sql` (shape only), `docs/deployment/DATABASE-REQUIREMENTS.md`, the privilege and backup lines of `RUNBOOK.md`, and a pattern search for built SQL and bulk-parameter forms across the catalog routers (`programs`, `courses`, `academicYears`, `institution`, `programPoReference`, `curriculum`) and their libraries. No database was connected to, `.env` was not opened, and nothing was changed except this section. The catalog handler bodies were searched, not read line by line.

### 9.1 New database findings

| ID | Sev | Finding | Where | Solution | Effort |
|---|---|---|---|---|---|
| DB-01 | MEDIUM | One database account does everything. The running server, `init.js` and all 32 migration scripts read the same `DB_USER`. `RUNBOOK.md` line 27 asks for a least-privilege user, but nothing in the code supports or checks it, so the server in practice runs with whatever the migrations needed (CREATE, ALTER, DROP, often root on XAMPP). If any injection or stolen-credential bug appears, the attacker can drop or alter tables | `server/index.js:43-50`, `server/db/*.js` | Two accounts: `app` with SELECT, INSERT, UPDATE, DELETE on this schema only, and `migrate` with DDL, used only by the scripts through `DB_MIGRATE_USER` / `DB_MIGRATE_PASS`. At startup in staging and production, run `SHOW GRANTS` and refuse to start if the app account holds `ALL PRIVILEGES`, `DROP`, `ALTER`, `FILE`, `SUPER` or `GRANT OPTION` | M |
| DB-02 | MEDIUM | No TLS and no port setting for the database connection. The pool takes host, user, password and name only. If the database is ever on another machine, credentials and all syllabus and student data cross the network in clear text | `server/index.js:43-50` | Add `DB_PORT` and `DB_SSL` (`required` / `off`, with an optional CA file). Require `DB_SSL=required` in staging and production whenever `DB_HOST` is not loopback; fail closed | S |
| DB-03 | MEDIUM | The database is not in strict mode. A comment in `routes/syllabi.js:170` says so, and the code works around it by hand in a few places. Outside those places an over-long or wrongly typed value is silently cut or coerced instead of refused, which can corrupt stored text and turns a type-confusion bug into bad data rather than an error | database server setting; `server/index.js` | Set the session mode on every pooled connection (`STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION,ERROR_FOR_DIVISION_BY_ZERO`) with a pool `connection` hook, and set the same in `my.ini`. Run the full suite and the E2E against a strict database first: some existing writes may rely on truncation | M, some risk |
| DB-04 | MEDIUM | Reviewer and audit history can be erased through cascades. Deleting a user removes their syllabi, the versions they created, comments, messages, stage clearances and `account_activity`; deleting a syllabus removes its `submission_logs`, runs and decisions. The application blocks this only for approved records. Foreign-key cascades also ignore table privileges, so DB-01 does not stop it | `server/db/schema.sql` lines 117, 129-141, 197-216, 411-427, 441 | For the audit tables (`submission_logs`, `account_activity`, `syllabus_review_stages`, `comments`) change the user and syllabus keys to `ON DELETE SET NULL` and keep the person's name and the course code in the row. Prefer disabling an account to deleting it (the disable feature already exists): refuse `DELETE /api/users/:id` when the account has any submitted syllabus or review action | M, one migration |
| DB-05 | LOW | The pool has no bounds on waiting. `connectionLimit` is 10 with the default unlimited queue and no connect or query timeout. One slow query pattern (the 500-row list endpoints, or a locked row) makes every other request wait without limit | `server/index.js:43-50` | `queueLimit` (for example 100, then 503), `connectTimeout` 10 s, and a per-query `timeout` on the list endpoints | S |
| DB-06 | LOW | `init.js` puts `DB_NAME` into `CREATE DATABASE` and `USE` without quoting. It comes from the environment, not from a request, so this is an operator-error risk, not a remote one | `server/db/init.js:16-17` | Validate against `^[A-Za-z0-9_]{1,64}$` and quote with backticks | S |
| DB-07 | LOW | Demo account password hashes are tracked in `seed.sql` (two bcrypt cost-10 hashes of publicly known passwords). `init.js` skips them in staging and production, but any database created in development mode and later promoted carries them | `server/db/seed.sql` | Keep the guard. Add a startup check in staging and production that refuses to start when a user row matches a seeded email, and remove the accounts from existing databases (owner action, section 5 item 3) | S |
| DB-08 | LOW | Sensitive data is stored unencrypted: names, emails, student numbers and sections in tables; COR photos and profile photos as plain files | tables `users`, `student_profiles`, `student_enrollments`; `server/private/` | Full-disk or volume encryption on the database and application hosts; encrypted backups (already stated in `RUNBOOK.md` line 25); the COR sweep proposed in SEC-10 so photos are not kept longer than needed | owner |
| DB-09 | LOW | No backup or restore script is in the repository and no restore has been exercised (the engineering report says "prepared, not exercised") | `docs/deployment/RUNBOOK.md` | A scripted `mysqldump --single-transaction` with encryption and a retention count, a scheduled run, and one restore drill into a scratch database before go-live | owner, S to script |
| DB-10 | INFO | Sound: every query uses placeholders; `multipleStatements` is off (the driver default, never enabled); `users.email` and `remember_tokens.token_hash` are unique; one faculty member per subject is enforced by a unique key; passwords and tokens are stored only as hashes | | none | |

### 9.2 Remaining API routes

The catalog routers were searched for built SQL, `SET ?`, `VALUES ?` and request values passed straight to a query.

- Every write route in `programs`, `courses`, `academicYears`, `institution`, `programPoReference` and `deadlines` carries `requireAdmin`. Reads need a signed-in staff account.
- The only interpolated SQL fragments are code constants: the table names `syllabi`, `programs`, `courses` in `academicYears.js:57`, the year clause in `programManagement.js:34`, and `LABEL_SQL`. No request value reaches SQL text.
- Bulk inserts (`VALUES ?`) receive lists built by `parseEgas`, `parsePos`, `normalizeAssignments` and the checker, not raw request arrays.
- `DELETE /api/academic-years/:label` and `findProgram` take a string from the URL and pass it as a parameter only.

No new route-level vulnerability was found in this pass. What stays unverified is the business logic inside those handlers (for example whether a catalog edit can alter what an already approved syllabus displays); that needs a line-by-line read or tests.

### 9.3 Attack-by-attack summary and solutions

| Attack | Is the system exposed? | Status | Solution still needed |
|---|---|---|---|
| Password guessing, credential stuffing | Was fully exposed | **Fixed** (SEC-02): 10 failures per account, 50 per address, per 15 minutes | A rate limit at the reverse proxy as a second layer; move counters to a shared store if more than one server process runs |
| Finding out which emails are registered | Was exposed | **Fixed** (SEC-04) | none |
| Session fixation, stolen session surviving a password change | Was exposed | **Fixed** (SEC-05, SEC-06) | A shared session store (SEC-09) so sessions and their revocation survive restarts and several processes |
| Reading other people's uploaded files without signing in | Was exposed | **Fixed** (SEC-01, SEC-03) | On each real server, check `server/uploads/` and the `file_path` columns for old files |
| SQL injection | Not found | Sound | Type-check `adminComment` (SEC-14); strict mode (DB-03); least-privilege account (DB-01) to limit damage if one is ever introduced |
| Cross-site scripting | Not found in code review | Sound, not browser-tested | A browser round-trip test with script payloads in every syllabus field and comment; a Content-Security-Policy on the static site that serves the React app (owner) |
| Cross-site request forgery | Not exposed | Sound: origin guard on every state-changing request, verified | none |
| Clickjacking, MIME sniffing | Was exposed | **Fixed for the API** (SEC-08) | The same headers on the static site (owner) |
| Broken access control (one user reading or changing another's data, a lower role acting as a higher one) | Not found | Sound: 121 handlers swept, ownership and role checked on locked rows | Add route tests for the catalog routers' dangerous cases; they have fewer than the syllabus routes |
| Skipping the review chain, approving without the VPAA | Not found | Sound in code; concurrency not exercised | A real-database test that fires approve, return and resubmit at the same moment |
| Malicious file upload | Low exposure | Sound: extension and type checked, upload routes refuse, PDF import parses in a killed-on-timeout worker | `multer` 2.x (SEC-19); magic-byte and pixel limits on the COR photo (SEC-10) |
| Denial of service | Exposed | **Open** | SEC-10 (public OCR route: concurrency cap, pixel limit), DB-05 (pool queue and timeouts), SEC-09 (session memory), proxy rate limits and request-size limits |
| Running up the AI bill | Exposed to any signed-in author | **Open** (SEC-11) | A per-user daily count and a server-wide daily cost ceiling that fail closed |
| Prompt injection through syllabus text | Limited: the model cannot change a status or approve | **Open**, not live-tested (SEC-20) | Keep human review mandatory; add adversarial syllabi to the offline evaluation set; flag instruction-like text in a syllabus to the reviewer |
| Eavesdropping in transit | Depends on deployment | **Owner action** | HTTPS and redirect at the proxy (HSTS is now sent in staging and production); TLS to the database when it is remote (DB-02) |
| Leaked or stolen credentials | Two credentials were exposed in chats; rotation unconfirmed | **Owner action** | Rotate the Gmail app password, the Gemini key and the database password; keep `.env` out of git (it is); least-privilege database account (DB-01) |
| Database takeover after an application bug | Exposed: the app account can alter and drop | **Open** (DB-01) | Split app and migration accounts, check grants at startup |
| Destroying evidence (insider or compromised admin) | Exposed | **Open** (SEC-15, DB-04) | Audit rows that survive deletion, IP address and user agent recorded, a retention period, backups the application account cannot reach |
| Data theft from disk or backups | Depends on host | **Owner action** (DB-08, DB-09) | Disk encryption, encrypted off-host backups, one restore drill |
| Supply chain (a compromised or vulnerable package) | Unknown | **Not verified** (SEC-19, SEC-24) | Run `npm audit` (needs your go-ahead: it contacts the npm registry); move to `multer` 2.x; pin CI actions to commit hashes |
| Leaking internals through errors | Was exposed | **Fixed** (SEC-07) | none |
| Demo and test accounts with known passwords | Exposed on any database that has them | **Owner action** (DB-07) | Remove the seeded accounts and the UAT reviewer accounts (ids 38 to 40); add the startup check |

### 9.4 Recommended next batches

| Batch | Contents | Needs |
|---|---|---|
| E | SEC-14 (`adminComment` type), SEC-16 (remove the unused JWT and `canEditSyllabus`), DB-06 | nothing new |
| F | SEC-10: COR photo checks, OCR concurrency cap, sweep of orphaned COR photos | nothing new |
| G | SEC-11: AI daily ceilings | your numbers for the ceilings |
| H | SEC-15 and DB-04: audit rows that survive deletion, IP and user agent | one migration |
| I | DB-01, DB-02, DB-05, DB-07: second database account, grant check at startup, `DB_PORT` and `DB_SSL`, pool bounds, seeded-account check | new settings; you create the database accounts |
| J | DB-03: strict SQL mode | a full regression run on a strict database first |
| later | SEC-09 session store, SEC-19 `multer` 2.x | new dependencies, your approval |

Order by risk reduced per effort: I, then F and G, then H, then E, then J.

## 10. Phase 3: batch I, database hardening (implemented 2026-11-12, not committed)

Written test-first: `server/lib/dbConfig.test.js` was run and failed (module missing), then `server/lib/dbConfig.js` was written and wired into `server/index.js`.

| Finding | Status | What changed | Test |
|---|---|---|---|
| DB-01 one over-privileged account | **FIXED in code; needs owner action to take effect** | `assertDatabaseSafe` reads `SHOW GRANTS FOR CURRENT_USER()` before the server listens. Staging and production refuse to start if the account holds anything outside SELECT, INSERT, UPDATE, DELETE (plus USAGE, CREATE TEMPORARY TABLES, LOCK TABLES, SHOW VIEW). Roles are refused. `DB_USER=root` is refused there too. Development warns | allow-list parsing of nine grant shapes; refusal names the privileges; development returns warnings |
| DB-02 no TLS or port setting | **FIXED in code; needs owner action to take effect** | `DB_PORT`, `DB_SSL`, `DB_SSL_CA`. A non-local `DB_HOST` in staging or production must have `DB_SSL=required` (TLS 1.2 or newer, certificate verified) | TLS options; remote host refused without TLS; unreadable CA file refused |
| DB-05 unbounded pool | **PARTLY FIXED** | queue limit 200 (was unlimited), connect timeout 10 s, `DB_POOL_SIZE`, `DB_POOL_QUEUE`. Per-query timeouts on the list endpoints were not added | pool options and their bounds |
| DB-06 unquoted database name in `init.js` | **FIXED** | the name is checked against letters, digits and underscores, and quoted | none: `init.js` runs on load and has no test harness; checked with `node --check` only |
| DB-07 demo accounts | **FIXED in code; needs owner action on existing databases** | staging and production refuse to start while any `users.password_hash` equals a hash in `db/seed.sql` | refusal counts the accounts and never prints a hash |

Still open from section 9: DB-03 (strict SQL mode), DB-04 (audit rows deleted by cascades), DB-08, DB-09, and the rest of DB-05.

### What you must do for these to protect a real server

1. Create two database accounts. The application account: `GRANT SELECT, INSERT, UPDATE, DELETE ON <database>.* TO <app account>`. The migration account: the same plus CREATE, ALTER, INDEX, DROP, REFERENCES on that database.
2. Put the application account in the server's `DB_USER` and `DB_PASS`. Run `init.js`, the `migrate-*.js` scripts and `create-admin.js` with the migration account by setting `DB_USER` and `DB_PASS` for that command only.
3. If the database is on another machine, set `DB_SSL=required` (and `DB_SSL_CA` if its certificate is not from a public CA).
4. Remove the two seeded accounts, and the UAT reviewer accounts (ids 38 to 40), from any database that will hold real data. The seeded ones now block startup in staging and production; the UAT ones are not detectable by the server.

### Behaviour that changed on purpose

- A staging or production server that used to start with `root`, an empty database password, or an account with ALL PRIVILEGES will now refuse to start and say why. Development is unchanged except for warnings in the log.
- A staging or production server now refuses to start when the database is unreachable at startup, instead of starting and reporting it through `/api/health`. A process manager should restart it.
- When 200 requests are already waiting for a database connection, the next one fails at once with a generic 500 instead of waiting.

### The E2E exception

The local browser E2E starts the real server as `NODE_ENV=staging` against a throwaway database as local `root` with no password, which the new rules would refuse. `DB_E2E_SCRATCH=1` (set by `scripts/e2e/stack.cjs`) turns the account rules into warnings, and is honoured only when `DB_HOST` is this machine and `DB_NAME` contains "e2e"; with any other host or name it stops the server. TLS, the port and the pool bounds are not relaxed. This is tested, but the E2E itself was not run.

### Verification

| Check | Result |
|---|---|
| `server/lib/dbConfig.test.js` | 14 of 14 pass |
| `npm test` | 2,371 of 2,378 pass. The 7 failures are the same tests as before batch I, in `anthropic-harness.test.js` (4), `stage-c3-eval.test.js` (2) and `stage-e8-canary.test.js` (1) |
| Conformance suites | 276 of 276 pass |
| `npm run build` | passes |
| Not run | any real MySQL or MariaDB: the grant check was exercised against a fake that returns `SHOW GRANTS` rows, so the exact wording of grants on your server version is unverified; a real TLS connection; the server actually starting through the new startup path (`node --check` only, because starting it loads `.env` and connects to the configured database); the browser E2E |

## 11. Phase 3: batches E, F, G, H, J (implemented 2026-11-12, not committed)

Each batch was written test-first: its new tests were run and failed, then the change was made.

| Finding | Status | What changed | Test |
|---|---|---|---|
| SEC-14 `adminComment` type | **FIXED** | `checkTypes` in `routes/syllabi.js` for title, course code, note, status, comment and curriculum, before any query | `input-types.routes.test.js` (2): objects, lists, numbers, booleans and null refused with 400; no query runs |
| SEC-16 unused JWT | **PARTLY FIXED** | the browser neither keeps nor sends the token (`src/lib/api.js`, `src/lib/poReferenceApi.js`); `canEditSyllabus.js` marked unused. The server still signs and returns the token, because scripts and conformance suites read it and `JWT_SECRET` is a required secret; removing it is a separate decision | build only (the client modules are not covered by node tests) |
| SEC-10 public OCR route | **FIXED** | magic bytes, 40-megapixel limit read from the header, 2 scans at once, JSON reasons for multer refusals, `limitInputPixels` on every `sharp` call of the scan, COR photo sweep (`lib/corCleanup.js`) | `cor-scan.routes.test.js` (9) |
| SEC-22 students limiter map | **FIXED** | the scan and register limiter is `createLimiter`, which prunes old keys | same file |
| SEC-11 AI cost | **FIXED for counts** | `lib/aiQuota.js`: per-person and server-wide daily check ceilings, a per-person daily refine ceiling, validated at startup. A dollar ceiling per day was not added; the per-check budget in `gemini.js` still bounds each request. The single-flight lock was left as it is | `lib/aiQuota.test.js` (5), one test each in `compliance.routes.test.js` and `syllabusCheck.refine.routes.test.js` |
| SEC-15, DB-04 audit trail | **FIXED in code; needs the migration** | `db/migrate-audit-retention.js` (idempotent, dry run, refuses odd constraint names); `schema.sql` and `account-activity-ddl.js` in the new shape; `accountActivity.record` writes address and browser and falls back to the old table; names stamped before an account or syllabus is deleted; `logs.js` and `listFor` read rows whose account or syllabus is gone | `lib/auditRetention.test.js` (10) |
| DB-03 strict SQL mode | **AVAILABLE, OFF** | `DB_SQL_STRICT=on` sets `STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION` on each connection; staging and production check it took effect | 2 tests in `lib/dbConfig.test.js` |

### Behaviour that changed on purpose

- A COR scan of a file that is not really an image, or over 40 megapixels, is refused before OCR; a third scan at the same moment waits with 503.
- Past the daily ceilings, AI checks and "Check & improve" answer 429 until midnight (Philippine time). Editing and saving are unaffected.
- A failed sign-in on an unregistered email now appears in the administrator's view of everyone's activity, as "Unknown account" with what was typed (after the migration).
- Once the migration has run, deleting an account no longer deletes its review history and activity; they stay under the account's name. Its syllabi, versions and comments are still deleted with it, as before.

### What you must do

1. Back up the database, then run `npm run migrate-audit-retention -- --dry-run` in `server/` and read the statements, then run it without `--dry-run`, with the migration account.
2. Decide the AI ceilings if the defaults (40 checks per person, 400 in all, 60 refinements per person, per day) do not suit you, and set them in `.env`.
3. Run the browser E2E against a strict database before setting `DB_SQL_STRICT=on` anywhere.

### Not done in this round, and why

| Item | Why |
|---|---|
| SEC-09 session store | needs a new dependency (a MySQL-backed store); your approval |
| SEC-19 `multer` 2.x, `npm audit` | changes the lockfile and contacts the npm registry; your approval |
| SEC-24 pin CI actions by commit | needs the commit hashes from GitHub; a network lookup |
| SEC-12 expiry of generated passwords | needs a column and a migration; not started |
| SEC-18, SEC-23, DB-08, DB-09 | owner decisions and host settings |
| SEC-20 prompt injection | needs adversarial cases in the offline evaluation set; not started |
| Removing the server-issued JWT | scripts and conformance suites depend on it |

### Verification

npm test 2,401 of 2,408 pass; the 7 failures are the same evaluation-script tests as before (anthropic-harness 4, stage-c3-eval 2, stage-e8-canary 1). Conformance suites 276 of 276. npm run build passes.

Not run: any real database (the migration was tested against a fake that answers information_schema; the exact output of your MariaDB or MySQL version is unverified), real OCR (replaced by a fake in the tests), any live provider, and the browser E2E.

## 12. Phase 3: the last six findings (implemented 2026-11-12, not committed)

| Finding | Status | What changed | Test |
|---|---|---|---|
| SEC-12 generated passwords never expired | **FIXED in code; needs the migration** | `lib/passwordExpiry.js`, `db/migrate-password-expiry.js`; expiry set on create, resend and `create-admin.js`; checked at sign-in after the password is proven; `GENERATED_PASSWORD_DAYS` validated at startup | `password-expiry.routes.test.js` (9) |
| SEC-20 prompt injection | **WARNING ADDED; model behaviour not tested** | `lib/aiInstructions.js` finds instruction-like text; `GET /api/syllabi/:id/review` returns it to reviewers; the review window shows it | `lib/aiInstructions.test.js` (6): detection, no false positives on the sample syllabi, content unchanged, `pairsOf` (what the AI is sent) and `svc.check` (score, findings, recommendations) identical, only the review route uses it; one test in `review.routes.test.js` |
| SEC-16 unused JWT | **FIXED** | token no longer made or returned; `jwt.js`, `canEditSyllabus.js` and `jsonwebtoken` removed; `JWT_SECRET` not required | `signin-security.routes.test.js`, `sessionSecret.test.js`, conformance suite |
| SEC-19 dependencies | **FIXED** | 3 server advisories fixed by `npm audit fix`; `multer` 2.5.0; `jsonwebtoken` removed | `npm audit --omit=dev`: 0 in both folders; upload route tests (70) pass on multer 2 |
| SEC-24 CI actions by tag | **FIXED** | pinned to `11d5960a326750d5838078e36cf38b85af677262` (checkout v4.4.0) and `49933ea5288caeca8642d1e84afbd3f7d6820020` (setup-node v4.4.0), read from GitHub with `git ls-remote`; `.github/dependabot.yml` | not run on GitHub |
| SEC-09 MemoryStore | **FIXED in code; needs the migration** | `lib/sessionStore.js` (a store on the existing pool, chosen over `express-mysql-session` because that package pins its own mysql2 3.10.2); sessions keyed by SHA-256 of the id; `endSessionsOf` deletes the account's rows; `SESSION_STORE` validated, memory refused in staging and production; table checked before listening | `lib/sessionStore.test.js` (10): restart, second process, revocation across processes, expiry, hashing |

### Behaviour that changed on purpose

- Sign-in no longer returns `token`, `tokenType` or `expiresIn`. Any outside script that read them will get `undefined`; the session cookie is what signs in.
- A generated password unused for 7 days stops working (after the migration).
- In staging and production the server will not start until the `sessions` table exists, and sessions now survive restarts there.
- Reviewers may see a new warning above a syllabus. Nothing else changes for them.

### What you must do

1. Back up, then run with the migration account: `npm run migrate-password-expiry`, `npm run migrate-session-store`, and `npm run migrate-audit-retention` from batch H (each has `--dry-run`).
2. Delete `JWT_SECRET` from your `.env` files (it is ignored now).
3. In development, set `SESSION_STORE=mysql` once the table exists if you want sessions to survive restarts there too.
4. On GitHub, Dependabot starts once `.github/dependabot.yml` is pushed; review its pull requests before merging.

### Verification

npm test 2,427 of 2,434 pass; the 7 failures are the same evaluation-script tests as before (anthropic-harness 4, stage-c3-eval 2, stage-e8-canary 1). Conformance suites 276 of 276. npm run build passes. npm audit --omit=dev: 0 vulnerabilities in the root and in server/.

Not run: any real database (the three migrations and the session store were tested against fakes), the CI workflow on GitHub, the browser E2E (which now needs the `sessions` table in its scratch database; `init.js` creates it from `schema.sql`), and a live AI model against the injection examples.
