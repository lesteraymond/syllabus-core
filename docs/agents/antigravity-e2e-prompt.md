# Full E2E bug hunt: Syllabus CMS (every role, every button, every route)

You are a senior QA engineer and full-stack debugger. Your job is to test this whole application end to end, as every role, and find every broken button, broken API route, broken logic and hidden bug. Work carefully and prove each finding with evidence. **This phase is find-and-report only: do not fix code until I approve the report.**

## 0. The project (read before testing)

- Repo: `C:\Users\JP Del Rosario\Syllabus-Repository` (Windows 11, PowerShell; Git Bash also exists).
- Frontend: React 19 + Vite 8 in `src/` (`npm run dev` → http://localhost:5173). Views in `src/views/`, components in `src/components/`, nav in `src/data/initialData.js`, roles in `src/lib/roles.js`.
- Backend: Express in `server/` (`cd server; npm run dev` → http://localhost:3001). Routes are mounted in `server/index.js` (`/api/auth`, `/api/users`, `/api/settings`, `/api/syllabi` [syllabi, syllabusFiles, syllabusContent, pdfImport, comments, reviewChain], `/api` [compliance], `/api/syllabus-check`, `/api/institution`, `/api/programs` [+ programPoReference], `/api/courses`, `/api/academic-years`, `/api/curriculum`, `/api/logs`, `/api/messages`, `/api/notifications`, `/api/usage`, `/api/deadlines`, `/api/students`, `/api/health`). About 127 route handlers in `server/routes/*.js`.
- Database: MySQL/MariaDB via XAMPP, DB `syllabus_cms_plus`.
- Read first: `HOW-TO-RUN.md`, `docs/review-chain.md`, `server/lib/roles.js`, `server/lib/reviewStages.js`, `server/routes/syllabi.js` (the status PUT), `server/routes/reviewChain.js`, `src/views/ReviewApproval.jsx`, `src/views/ReviewPanel.jsx`, `src/views/CommentsThread.jsx`, `src/components/SyllabusCommentsModal.jsx`, `src/lib/reviewView.js`.
- There is already a local E2E harness: `npm run test:e2e` (`scripts/e2e/run-e2e.cjs`). It builds the app, runs it against an **isolated scratch database** (`syllabus_e2e_local`) with synthetic data and an **offline fake AI provider**. Reuse its approach (`scripts/e2e/stack.cjs`, `seed-e2e.cjs`, `lib.cjs`, `scenarios.cjs`) instead of inventing a new one.

## 1. Safety rules (hard rules, never break them)

1. **Do not touch my real data.** Test against a scratch database (copy the `scripts/e2e` approach, or create `syllabus_e2e_antigravity` from `server/db` init + every migration). Never run DROP, TRUNCATE, DELETE or a migration on `syllabus_cms_plus`. If you must read it, read only. Before anything else, take a `mysqldump` backup of `syllabus_cms_plus` to a folder outside the repo.
2. **No real email.** SMTP is live in my `server/.env`. For your test server, run with an explicit environment where `SMTP_HOST` is empty (or point it at a local catch-all) so approvals, returns and new-account mails go nowhere real.
3. **No paid AI.** Never call Anthropic, Gemini, OpenRouter, DeepSeek or Groq. Use the offline stand-in from `scripts/e2e/fake-anthropic.cjs` / `offline-provider.cjs` or `COMPLIANCE_AI_PROVIDER=mock`. If a feature can only be tested with a paid provider, mark it "NOT TESTED: needs paid AI" and move on.
4. **Do not stop, restart or kill MySQL / XAMPP**, and never force-kill `mysqld`. The dev database has crashed twice from that.
5. The API runs with `node --watch`: **do not create temp files inside `server/`** (it restarts the API mid-test). Put scratch files, screenshots and logs in a new folder outside `server/`, e.g. `tmp/antigravity-e2e/`.
6. **Git:** do not commit, push, stash, reset or switch branches. Never `git add -A`. Do not edit tracked source files in this phase.
7. Do not put secrets from `.env` files in your report, logs or screenshots.
8. Windows notes: Git Bash `sed -i` converts CRLF files to LF, so do not use it on source files. Do not put Markdown backticks inside `node -e "..."` strings.

## 2. Accounts to create (scratch DB only)

Create one test account per role (directly in the scratch DB, the way `scripts/e2e/seed-e2e.cjs` does), and keep their credentials only in a local untracked file in `tmp/antigravity-e2e/`:

| Role (`users.role`) | Meaning | Can do |
|---|---|---|
| `faculty` (make 2: Faculty A, Faculty B) | writes and submits syllabi | Builder, AI Syllabus Generator, My Syllabi, AI Checker, Repository, Analytics, Reports, Settings |
| `admin` | Dean / administrator: stage **dean** + manages users, curriculum, compliance, deadlines, settings | everything incl. Curriculum, Compliance, Users & Roles; can also author |
| `asst_vpaa` | stage **asst_vpaa** | Review & Approval, AI Checker, no authoring |
| `lic_director` | stage **lic_director** (references/citations) | Review & Approval, AI Checker, no authoring |
| `vpaa` | **only** role that approves or rejects | Review & Approval |
| `student` | read-only student pages | Student Dashboard, Syllabi |

Also seed: an active academic year, an inactive one, at least two programs with POs/EGAs, subjects, faculty assignments (program + subject) so Faculty A can author, and one subject Faculty B is NOT assigned to.

## 3. The core business flow you must prove works

```
Faculty submits  ->  (optional) AI check by a reviewer
                 ->  Dean (admin), Asst. VPAA, LIC Director each clear their stage (any order, in parallel)
                 ->  VPAA approves (or rejects)  ->  syllabus appears in the Repository
```

Test each rule, through the UI **and** directly against the API (with each role's session cookie):

- [ ] Submit locks the syllabus: faculty can no longer edit it while it is under review.
- [ ] Reviewers never see drafts; only submitted versions.
- [ ] Each of the three stages can be cleared in any order; clearing is recorded per (syllabus, version, stage) and shown in the stage strip of the Review panel.
- [ ] Nobody can clear a stage on their own syllabus.
- [ ] The same person cannot clear a stage twice, and cannot clear someone else's stage (e.g. `lic_director` calling `POST /api/syllabi/:id/stage-clear` for the dean stage).
- [ ] `faculty`, `admin`, `asst_vpaa`, `lic_director` trying to approve/reject (status PUT) get **403**.
- [ ] VPAA approving before all three stages are cleared on the **newest version** gets **409 STAGES_PENDING**, and the UI shows a clear message, not a crash.
- [ ] VPAA approving when the required AI check is missing gets **409**, handled in the UI.
- [ ] Any reviewer can **Return for revision**; a reason shorter than 5 characters is refused (UI and API). Faculty sees the reason, edits, resubmits; the new version **starts all three checks again** (old clears do not carry over).
- [ ] VPAA **Reject** works and the faculty sees it with the reason.
- [ ] A syllabus written by the dean (admin): **Send for review** marks the dean stage as cleared by authoring; Asst. VPAA, LIC Director, then VPAA finish it. The dean cannot approve it.
- [ ] After approval: status `approved`, visible in Repository, visible to the student, the printed/PDF form's sign-off block ("Checked and Reviewed by", "Approved by") shows the right names and dates.
- [ ] Settings switches (Admin → Settings): **strict step order** ON vs OFF, **AI off**, **decision emails** (with SMTP blank: no crash, sensible message). Each reviewer may choose "check with AI" or "review without AI" per version; verify both paths.
- [ ] Statuses stay consistent everywhere (`draft`, `submitted`, `under_review`, `for_revision`, `rejected`, `approved`): My Syllabi tags, Review & Approval queues, Dashboard counts, Analytics, Reports, notifications.
- [ ] Late submission after a deadline shows on the status tag and the deadline in the meta line (My Syllabi).
- [ ] Concurrency: two reviewers acting on the same syllabus at the same moment; VPAA approving while faculty resubmits; double-clicking Submit / Approve / Clear (no duplicate rows, no double version).

## 4. Comment panel and Review panel (test for every role)

- [ ] Open the comments panel (`SyllabusCommentsModal`, `CommentsThread`) as faculty, admin, asst_vpaa, lic_director, vpaa: add, reply, edit/delete if offered, long text, emoji, HTML/script text (must render as text: XSS check), empty comment (refused).
- [ ] Unread counts and badges update for the other side and clear after reading; faculty comment counts on My Syllabi are right.
- [ ] Comments are tied to the right syllabus and version; a returned-then-resubmitted syllabus keeps its history.
- [ ] Faculty B cannot read or post comments on Faculty A's syllabus (UI and API: expect 403/404). Students cannot comment.
- [ ] Review panel (`ReviewPanel`, `ReviewDocument`, `ReviewBoard`): each role sees only the buttons it is allowed (Clear stage, Return for revision, Approve, Reject, AI check, view document, version history). Every visible button works; no button is visible that returns 403 when clicked.
- [ ] Version History modal: compare versions, open old version, nothing editable that should not be.

## 5. Every page, every button, every role

For each role, open every page it can reach, and click **every** button, link, tab, toggle, dropdown, date picker, modal open/close (X, Esc, backdrop), pagination, search box, filter and sort. Pages (from `src/data/initialData.js`):

Dashboard · Syllabus Builder (`src/views/builder2`) · AI Checker · AI Syllabus Generator · My Syllabi · Review & Approval · Curriculum · Repository · Compliance · Analytics · Reports · Users & Roles (incl. Assignments panel) · Settings · Student Dashboard · Student Syllabi · plus Login, Forgot password, Change password (first sign-in forced change), Student register (COR upload), Topbar (global search, notifications, messages/chat, avatar upload, theme/language), Sidebar collapse, Mobile nav, NotFound page.

For each, check:

- [ ] Button does what its label says; loading state; success and error toast; no silent failure.
- [ ] Forms: required fields, wrong types, very long input, special characters, leading/trailing spaces, duplicate names, past/future dates, empty submit.
- [ ] Syllabus Builder: every step, add/remove rows (weeks, CLOs, ILOs, assessments, references), autosave/draft save, step gate, leave-page warning, resume draft, PDF import (`/api/syllabi` pdfImport: good PDF, wrong template, scanned image, huge file, non-PDF renamed `.pdf`), file upload limits.
- [ ] Downloads/exports (Reports, PDF print) open real files that are not empty or broken.
- [ ] Role gating: open each page's URL/route directly as a role that should NOT see it (e.g. faculty → Users & Roles, student → Review & Approval, asst_vpaa → Syllabus Builder). Expect redirect or "not allowed", never a crash or data leak.
- [ ] Academic year scope: inactive year shows the notice and blocks edits.
- [ ] Browser console: zero uncaught errors and zero React key/prop warnings on each page. Network tab: no unexpected 4xx/5xx, no request to an outside host.
- [ ] Responsive: 375px (phone), 768px, desktop. Light and dark theme. Each available language (`src/i18n`): no raw translation keys like `ui.something_abc123` shown on screen.
- [ ] Refresh (F5) on each page keeps you on the right page and logged in; Back/Forward buttons behave.

## 6. API route audit (every route in `server/routes/*.js`)

Build a table of every route (method + path + handler file:line). For each route, call it:

- [ ] signed out (expect 401),
- [ ] as each role (expect the right 200/403),
- [ ] with another user's resource id (IDOR: Faculty B reading/editing/deleting Faculty A's syllabus, files, comments, messages, notifications),
- [ ] with missing fields, wrong types, negative/huge ids, non-numeric ids, SQL-like strings, oversized JSON body,
- [ ] repeated twice fast (duplicates, race conditions).

Flag: 500 errors, stack traces or SQL text in responses, missing `await`, unhandled promise rejections in the server log, routes with no auth/role check, routes the UI calls that do not exist (grep `src/lib/*api*` / `fetch(` calls vs server routes) and server routes nothing calls (dead code), mismatched field names between client and server.

## 7. Hidden-bug hunt (code reading)

Read the code for these classes of bugs and confirm each one by reproducing it:

- Role checks done only on the client but not on the server (and the reverse).
- `src/lib/roles.js` vs `server/lib/roles.js` disagreeing.
- Status transitions the server allows that the flow forbids (e.g. `draft` → `approved`, `approved` → `submitted`, editing an approved syllabus).
- Version mismatch: stage clears counted on an older version; approval of an old version.
- Off-by-one/timezone bugs in deadlines and "late" (Philippine time, `src/lib/phTime.js`).
- Stale UI state after an action (list not refreshed, badge counts wrong until reload, polling bugs).
- Memory leaks / effects without cleanup, double fetches, infinite re-render loops.
- Uncaught errors in modals, empty states (no syllabi, no programs, no comments), and null fields in old data.
- Files: path traversal in uploads/downloads, private avatars/files reachable without login.
- Session: logout really ends the session; password-change-required users cannot use the API until they change it.

## 8. Existing tests (baseline, run once)

Run and record results (do not fix): `npm test` (root), `npm run test:e2e`, and `cd server; npm test` if it exists. Note which failures were already there before your testing.

## 9. Deliverable

Write `tmp/antigravity-e2e/E2E-REPORT.md` containing:

1. **Summary**: totals (tested / passed / failed / not tested), the 5 worst problems first.
2. **Bug list**, one row per bug: ID · Severity (Critical / High / Medium / Low) · Role · Page or route · Steps to reproduce · Expected · Actual · Evidence (screenshot path, console/network/server log excerpt) · Suspected cause (`file:line`) · Suggested fix (described, not applied).
3. **Review-chain matrix**: every rule in section 3 with PASS/FAIL and evidence.
4. **Role × page × button matrix**: every button clicked, per role, PASS/FAIL.
5. **API route table** from section 6 with results per role.
6. **Not tested**, and why (e.g. needs paid AI, needs Google sign-in).

Severity guide: **Critical** = wrong person can approve/see/edit data, data loss, or the approval chain can be skipped. **High** = a main flow is blocked or a button does nothing. **Medium** = wrong count/status/message, works after reload. **Low** = cosmetic, translation, layout.

Rules for the report: only report bugs you reproduced; mark anything uncertain as "SUSPECTED". Do not guess. When finished, stop and wait for my approval before changing any code. When I approve, fix one bug at a time with a test for each, and never weaken a permission check to make a test pass.
