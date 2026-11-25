# How to Run Syllabus Management System

Step-by-step guide to run the full system (frontend + backend + database).

---

## Prerequisites

Install these first:

- [Node.js](https://nodejs.org/) (v22.13 or higher, includes npm; PDF import's PDF.js needs it, and CI runs Node 22)
- [XAMPP](https://www.apachefriends.org/) (for MySQL)

---

## Step 1: Start MySQL (XAMPP)

1. Open **XAMPP Control Panel**
2. Click **Start** next to **MySQL**
3. Make sure it shows green/running

> MySQL must be running before starting the backend.

---

## Step 2: Setup Backend

Open a terminal:

```bash
cd server
cp .env.example .env     # then fill in the values (see below)
npm install
npm run init-db
npm run migrate-students
npm run dev
```

- `cp .env.example .env` — creates your local config (`.env` is git-ignored; on Windows use `copy`)
- `npm install` — installs backend dependencies (includes `tesseract.js` and `sharp` for the COR reader)
- `npm run init-db` — creates the database, tables, and seed data (run once)
- `npm run migrate-students` — adds the student role and the COR tables (`schema.sql` does not create them, so run it on fresh installs too)
- `npm run dev` — starts the API server on **http://localhost:3001**

Fill in `server/.env`:

| Variable | Notes |
|----------|-------|
| `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` | MySQL connection (XAMPP defaults: `localhost`, `root`, empty, `syllabus_cms_plus`) |
| `SESSION_SECRET` | any long random string (the only signing secret; `JWT_SECRET` is no longer used, so delete it from older `.env` files) |
| `GOOGLE_CLIENT_ID` | must match the frontend `VITE_GOOGLE_CLIENT_ID` (only needed for Google sign-in) |
| `PORT`, `UPLOAD_DIR` | API port (default 3001) and upload folder (relative: under `server/`; an absolute path is used as it is) |
| `CURRENT_TERM`, `ALLOWED_EMAIL_DOMAIN` | optional (domain defaults to `email.lcup.edu.ph`) |
| `SMTP_*`, `MAIL_FROM`, `APP_URL` | email for credentials, temporary passwords and decisions. Leave `SMTP_HOST` empty to send nothing |
| `SYLLABUS_CHECK_AI_PROVIDER`, `SYLLABUS_CHECK_REPLAN`, `SYLLABUS_CHECK_REPLAN_MAX_COST_USD`, `SYLLABUS_CHECK_REPLAN_MAX_REQUESTS`, `SYLLABUS_CHECK_AI_GATE` | the AI Checker. Nothing is sent without a cost cap; `SYLLABUS_CHECK_AI_GATE` is `advisory` (default) or `required` |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL` | Claude for the AI Checker. Nothing is sent until the approved model names the same model as `ANTHROPIC_MODEL` |
| `COR_SCAN_MODEL` | optional: the model that reads a student's COR (default `claude-haiku-5-5`; it does not follow `ANTHROPIC_MODEL`) |
| `SYLLABUS_PDF_IMPORT`, `SYLLABUS_PDF_IMPORT_CONCURRENCY` | optional: PDF import on/off (default on) and how many imports run at once (default 2, at most 8) |
| `COMPLIANCE_AI_PROVIDER` | optional: `mock` shows AI-labelled recommendations in development; unset = plain rule-based check |
| `SCHOOL_YEAR_START` | optional, default `2026` (used to measure reference age) |

`server/.env.example` lists only the core settings (trimmed 2026-11-24). Every other setting is described under **Server settings reference** below. For staging and production start from `docs/deployment/staging.env.template` or `docs/deployment/production.env.template`, which also hold the host settings (`CORS_ALLOWED_ORIGINS`, `TRUST_PROXY`, `SESSION_COOKIE_SAMESITE`).

> `npm run dev` restarts the API on file changes. After running a migration, restart it by hand.

You should see:
```
Server running on http://localhost:3001
```

### Upgrading an existing database

If your database was created before the latest changes, run the migrations you are missing (each is safe to run again), then restart the API server:

```bash
cd server
npm run migrate-google-auth
npm run migrate-preferences
npm run migrate-avatar
npm run migrate-avatars-private
npm run migrate-notifications
npm run migrate-syllabus-versions
npm run migrate-builder
npm run migrate-assignments
npm run migrate-program-egas
npm run migrate-compliance
npm run migrate-comment-reads
npm run migrate-students
npm run migrate-passwords
npm run migrate-program-management
npm run migrate-subject-standards
npm run migrate-usage
npm run migrate-deadlines
npm run migrate-subject-owner
npm run migrate-activity-log
npm run migrate-review-stages
npm run migrate-archive
npm run migrate-subject-term
npm run migrate-academic-year-scope
npm run migrate-catalog-year
npm run migrate-curriculum-year
npm run migrate-course-program-codes
npm run migrate-po-reference-publication
npm run migrate-program-outcome-sources
npm run migrate-account-status
npm run migrate-review-ai-choice
npm run migrate-account-activity
npm run migrate-audit-retention
npm run migrate-password-expiry
npm run migrate-session-store
npm run migrate-syllabuscheck
npm run migrate-replan-answers
npm run migrate-generate-jobs
npm run migrate-version-labels
```

- `migrate-version-labels` renumbers syllabus versions as whole numbers (v1.0, v1.1, v1.2 become v1, v2, v3). It **changes existing data** and the old labels are not kept: take a database backup first and preview with `npm run migrate-version-labels -- --dry-run`. A fresh database made with `init-db` already uses whole numbers.
- `migrate-review-stages` adds the VPAA, Asst. VPAA and LIC Director roles and the table that records who cleared which review stage (see `docs/review-chain.md`); until it is run nothing can be approved
- `migrate-avatars-private`, `migrate-assignments`, `migrate-program-egas`, `migrate-subject-owner` and `migrate-review-stages` support `--dry-run` (e.g. `npm run migrate-assignments -- --dry-run`)
- `migrate-activity-log` lets Recent Activity record AI checks and answers to recommendations. Without it everything still works; those two kinds of activity are just not written (the server console says so once).
- `migrate-compliance` and `migrate-comment-reads` are optional: the features degrade gracefully (submit still works, unread counts show totals) until they are run
- After `migrate-assignments`, faculty cannot create or edit syllabi until an admin assigns them a program and a subject (Users & Roles, Assignments button)

---

## Step 3: Setup Frontend

Open another terminal:

```bash
npm install
npm run dev
```

- `npm install` — installs frontend dependencies
- `npm run dev` — starts the Vite dev server on **http://localhost:5173**

Optional settings go in the root `.env`:

| Variable | Notes |
|----------|-------|
| `VITE_GOOGLE_CLIENT_ID` | enables the Google sign-in button (same value as the backend `GOOGLE_CLIENT_ID`) |
| `VITE_API_URL` | API base URL if it is not `http://localhost:3001/api` |
| `VITE_NEW_BUILDER` | The rebuilt syllabus builder (`src/views/builder2`) is the default, also when this is not set. `false` goes back to the previous builder |

Restart `npm run dev` after changing `.env`.

You should see:
```
Local: http://localhost:5173/
```

---

## Step 4: Login

1. Open **http://localhost:5173** in your browser
2. Use one of the demo accounts:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@university.edu.ph | admin123 |
| Faculty | faculty@university.edu.ph | faculty123 |

Other ways in:

- **Remember me** keeps you signed in for 30 days.
- **Sign in with Google** works only for `@email.lcup.edu.ph` addresses that an admin has already added in Users & Roles.
- **Register (for Students)**: upload a photo of your Certificate of Registration (JPG, PNG or WebP, up to 10MB), choose a password, and agree to the **Terms and Conditions** (opened from the consent box). The server reads the COR; confirm the details in the "Is this your COR?" window. Your student ID (with or without dashes) is your username. BSIT, BSCPE and BSIE students can register, with a COR of the **active** academic year. A COR whose program, name, or school year and term cannot be confirmed creates no account: there is no administrator review, so retake a clearer photo and register again. The accepted terms version is recorded on the account.

---

## Troubleshooting

### "Invalid email or password"
```bash
cd server
npm run init-db
```
This re-seeds the database with correct password hashes.

### "Failed to fetch" or CORS error
Make sure the backend is running on port 3001:
```bash
cd server
npm run dev
```

### MySQL connection error
Make sure XAMPP MySQL is started and the credentials in `server/.env` match:
```
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=syllabus_cms_plus
```

### Login or Google sign-in returns 500
Check that `SESSION_SECRET` is set in `server/.env` and that the database is reachable, then restart the API server. `JWT_SECRET` is no longer used. Google sign-in answers 503 when `GOOGLE_CLIENT_ID` is not set.

### Google sign-in says 404 or "Access Denied"
Restart the API server (an old process has no `/api/auth/google`). "Access Denied" means the email is not in Users & Roles.

### "Table ... doesn't exist" or a missing column
Your database is behind. Run the migrations in *Upgrading an existing database*, then restart the API server.

### Student registration cannot read the COR
Make sure `npm install` was run in `server/` (OCR needs `tesseract.js` and `sharp`) and that `server/eng.traineddata` exists. Test the reader on its own with `node scripts/ocr-cor-test.js [image]`. The scan also uses Claude when `ANTHROPIC_API_KEY` is set (model `COR_SCAN_MODEL`). Small or tilted photos may not yield the program, name or term; the student then retakes the photo (nothing goes to an administrator). A COR of another school year than the active one is refused.

### Port already in use
Change the port in `server/.env`:
```
PORT=3002
```
Then update `src/lib/api.js`:
```js
const API = 'http://localhost:3002/api';
```

---

## Project Structure

```
syllabus-cms-plus/
├── src/                ← Frontend (React + Vite)
│   ├── App.jsx
│   ├── components/
│   ├── views/
│   ├── data/
│   └── lib/
├── server/             ← Backend (Node.js + Express)
│   ├── index.js
│   ├── routes/
│   ├── middleware/
│   ├── lib/            ← rules, compliance engine, COR OCR
│   ├── scripts/        ← ocr-cor-test.js
│   ├── db/             ← schema, seed, migrations
│   ├── private/        ← avatars and COR photos (git-ignored, not public)
│   └── uploads/        ← syllabus PDFs
├── public/
└── package.json
```

---

## Available Scripts

### Frontend (project root)
| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Vite dev server (http://localhost:5173) |
| `npm run build` | Build for production (`dist/`) |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the test suite: syllabus model and rules, compliance engine, review and comment routes, assignments, modal stack and more (no MySQL needed) |

### Backend (`server/`)
| Command | Description |
|---------|-------------|
| `npm run dev` | Start the API server (http://localhost:3001). It restarts when files change |
| `npm start` | Start the API server for staging or production: no restart on file changes |
| `npm run init-db` | Create the database, tables and seed data |
| `npm run seed-outcomes` | Load the institution's vision, mission, EGAs, programs and the BSIT program outcomes. Only inserts what is missing; run it after `migrate-builder`. Supports `--dry-run` |
| `node scripts/ocr-cor-test.js [image]` | Try the COR reader on the images in `server/sample_cor/` (git-ignored) or on a given image; prints the fields it read |

### Database migrations (`server/`)
Each one upgrades an older database and is safe to run again. Run the ones you are missing, in this order, then restart the API server. Most touch no existing data; the exceptions are listed under *Upgrading an existing database* (`migrate-version-labels` renumbers versions, `migrate-catalog-year` and `migrate-academic-year-scope` stamp existing rows with the current year). The table below covers the older ones; the newer ones describe themselves in the header of their file in `server/db/`.

| Command | What it adds |
|---------|--------------|
| `npm run migrate-google-auth` | `course_assignments` table |
| `npm run migrate-preferences` | Language preferences and administrator settings |
| `npm run migrate-avatar` | `users.avatar_path` for profile photos |
| `npm run migrate-avatars-private` | Moves existing profile photos into the private folder and makes `avatar_path` relative. Supports `--dry-run` |
| `npm run migrate-notifications` | `notifications` table |
| `npm run migrate-syllabus-versions` | `syllabus_versions` table, filled in for existing syllabi |
| `npm run migrate-builder` | Syllabus builder: `draft` status, `content` columns, `courses` and `course_clos`, `syllabi.course_id`. Supports `--dry-run` |
| `npm run migrate-assignments` | `faculty_programs` and `faculty_courses` (needs `migrate-builder`). Supports `--dry-run` |
| `npm run migrate-program-egas` | Per-program EGAs and the version columns (needs `migrate-builder`). Supports `--dry-run` |
| `npm run migrate-compliance` | Compliance check tables (optional: submit still works without it) |
| `npm run migrate-comment-reads` | `comment_reads` for unread comment counts (optional: faculty see totals until it is run) |
| `npm run migrate-students` | The `student` role, `student_profiles` and `student_enrollments` for COR registration (needs `migrate-builder`). Supports `--dry-run` |
| `npm run migrate-passwords` | `users.must_change_password` and the `password_temp` table |
| `npm run migrate-program-management` | Program management tables; existing records are kept |
| `npm run migrate-subject-standards` | `courses.standards_json`; existing standards are kept as independent copies |
| `npm run migrate-usage` | `usage_daily` table for the dashboard time card |
| `npm run migrate-deadlines` | `subject_deadlines` and `deadline_notices` tables |
| `npm run migrate-subject-owner` | Unique key on `faculty_courses.course_id` (one subject, one faculty member). Stops and lists any subject held by more than one faculty. Supports `--dry-run` |

Where a script says it supports `--dry-run`, add it after `--` to only report what would change, e.g. `npm run migrate-assignments -- --dry-run`.

---

## Server settings reference

Optional settings for `server/.env`. Leave a setting out to use its default. Restart the API server after a change.

### AI Checker

The AI Checker runs only when **all** of these are set: `SYLLABUS_CHECK_AI_PROVIDER=anthropic`, `SYLLABUS_CHECK_REPLAN=official`, `SYLLABUS_CHECK_REPLAN_MAX_COST_USD`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, and the same model in `SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL`. With a provider set but something missing, a check is reported incomplete with the reason and nothing is sent. The fixed (no-AI) rules run on every check.

| Variable | Default | What it does |
|---|---|---|
| `SYLLABUS_CHECK_AI_PROVIDER` | — | `anthropic`, or `off` to turn the AI off whatever keys are set (each check then says the AI is off) |
| `SYLLABUS_CHECK_REPLAN` | — | `official`: the AI Checker makes the official AI findings, points (at most 5 per area) and drafts. `shadow` and `plan` only attach a comparison |
| `SYLLABUS_CHECK_REPLAN_MAX_COST_USD` | — (required) | the most one check may spend, in US dollars (at most 1000). Nothing is sent without it, and in staging and production the server does not start without it once a provider is set |
| `SYLLABUS_CHECK_REPLAN_MAX_REQUESTS` | 80 | requests per check (1–300). A full repair plan on a long syllabus can need more; 120 is suggested |
| `SYLLABUS_CHECK_REFINE_MAX_COST_USD` | smaller of 0.50 and the check's cap | "Check & improve" on a draft: its own cost cap, never above the check's |
| `SYLLABUS_CHECK_REFINE_MAX_REQUESTS` | 12 | "Check & improve" request limit (1–60) |
| `SYLLABUS_CHECK_AI_GATE` | `advisory` | `advisory`: the AI result is advice, and only the coded hard gates (course in the curriculum, grading total, standard sections) stop a submit. `required`: a completed, current AI check is also needed first |
| `SYLLABUS_CHECK_TITLE_POLICY` | `shadow` | course-title comparison: `shadow` (official stays exact; the normalised decision is reported beside it), `exact`, or `normalized` (capitalisation, Unicode form and spacing only, never fuzzy). `normalized` is official and changes submission: activate it only with approval, following `docs/title-policy-activation.md` |
| `SYLLABUS_CHECK_VALUE_SUGGESTION` | `review` | a lesson naming no core value: the checker no longer picks one. `legacy` restores the old template suggestion (rollback only) |

### AI Syllabus Generator

Off unless `SYLLABUS_CHECK_GENERATE=on`, the direct Anthropic provider above is set, **and** its own cost cap is set. It writes a first draft of the CLOs, the 18-week plan, requirements and grading for the chosen subject, checks it with the AI Checker's rules and makes one repair plan. Every generation is a paid request. The request saves nothing: the page puts the sections into the author's syllabus for review.

| Variable | Default | What it does |
|---|---|---|
| `SYLLABUS_CHECK_GENERATE` | off | `on` turns the generator on |
| `SYLLABUS_CHECK_GENERATE_MAX_COST_USD` | — (required) | the most one whole run (generation, check and repair) may spend, at most 1000 |
| `SYLLABUS_CHECK_GENERATE_MAX_REQUESTS` | 40 | request limit for one run (1–300) |
| `SYLLABUS_CHECK_GENERATE_PER_USER_PER_DAY` | none | optional daily limit per person |
| `SYLLABUS_CHECK_GENERATE_REFERENCES` | `on` | the reference step keeps only books the Open Library catalogue confirms; `off` skips it and the lookups |

Run `npm run migrate-generate-jobs` once so jobs and the daily count survive a restart (without it they live in memory).

### Claude (direct Anthropic API, paid)

`ANTHROPIC_API_KEY` must be an `sk-ant-` key (any other format is never sent). `ANTHROPIC_MODEL` must be a verified id: `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-opus-5-5`, `claude-fable-5-1`, `claude-opus-5`, `claude-sonnet-5` or `claude-sonnet-4-6`; any other id sends nothing. Nothing is sent until `SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL` names that same model, so adding a key alone turns nothing on. The key stays on the server: never put it in a `VITE_` variable or commit it.

| Variable | Default | What it does |
|---|---|---|
| `ANTHROPIC_TIMEOUT_SEC` | 180 | deadline of one request in seconds (10–300). A request that timed out, or was answered with 504, is never sent again (it may already be billed) |
| `ANTHROPIC_MAX_RETRIES` | 2 | retries after a rate limit (429), an overload (529), a server error (500, 502, 503) or a dropped connection (0–3), within the deadline. A spend limit or an exhausted credit balance is never retried |
| `ANTHROPIC_MAX_TOKENS` | 16000 | longest answer in tokens (1024–16000). Thinking counts against it and is billed as output |
| `ANTHROPIC_THINKING` | `adaptive` | `adaptive` or `off`. `claude-opus-5-5` and `claude-fable-5-1` cannot turn thinking off, so with `off` they send nothing |
| `ANTHROPIC_EFFORT` | the model's default | `low`, `medium`, `high`, `xhigh` or `max`. `xhigh` and `max` need thinking on, and `claude-sonnet-4-6` has no `xhigh`; a combination the API would refuse sends nothing |
| `ANTHROPIC_PROMPT_CACHE` | `on` | caches the system prompt for 5 minutes so a check's later requests cost less; `off` turns that off |
| `COR_SCAN_MODEL` | `claude-haiku-5-5` | the model that reads a student's COR (it does not follow `ANTHROPIC_MODEL`) |

### PDF import

| Variable | Default | What it does |
|---|---|---|
| `SYLLABUS_PDF_IMPORT` | `on` | `off` turns PDF import off. PDFs are read in memory only |
| `SYLLABUS_PDF_IMPORT_CONCURRENCY` | 2 | how many imports run at once (1–8); each person runs one at a time |

### Sign-in limits

These cannot be turned off: `0`, `off` or a value out of range stops the server at startup. A correct sign-in is never counted. The address counted is the one the reverse proxy reports, so `TRUST_PROXY` must be right.

| Variable | Default | What it does |
|---|---|---|
| `SIGNIN_MAX_FAILURES_PER_ACCOUNT` | 10 | failed password sign-ins for one account in one window (3–100) |
| `SIGNIN_MAX_FAILURES_PER_IP` | 50 | failed password sign-ins, and separately failed Google sign-ins, from one address in one window (5–10000) |
| `SIGNIN_WINDOW_MINUTES` | 15 | the length of the window in minutes (1–1440) |

### AI daily ceilings

Counted per calendar day in the Philippines. They cannot be turned off; a bad value stops the server. For 19 faculty who all run checks and generations at the same time, use 100, 1000 and 200 (the whole-school number must be at least the per-person one).

| Variable | Default | What it does |
|---|---|---|
| `AI_CHECKS_PER_USER_PER_DAY` | 40 | AI checks by one person |
| `AI_CHECKS_PER_DAY` | 400 | AI checks by everyone together |
| `AI_REFINES_PER_USER_PER_DAY` | 60 | "Check & improve" requests by one person |
| `AI_CHECKS_PER_MINUTE_PER_USER` | 10 | checks one person may start per minute (1–600): only a guard against a double click |

### Database

In staging and production `DB_HOST`, `DB_USER`, `DB_PASS` and `DB_NAME` are all required, `DB_USER` may not be `root`, and the server reads its own grants before it listens: the application account may only SELECT, INSERT, UPDATE and DELETE on its own database, or the server does not start. Run the scripts in `server/db/` (`init.js`, `migrate-*.js`, `create-admin.js`) with a separate account that may also CREATE and ALTER, by setting `DB_USER` and `DB_PASS` for that command only. The server also refuses to start while any account still has a demo password from `db/seed.sql`.

| Variable | Default | What it does |
|---|---|---|
| `DB_PORT` | 3306 | the database port |
| `DB_SSL` | `off` | `required` encrypts the connection and verifies the database server. Required in staging and production when `DB_HOST` is another machine |
| `DB_SSL_CA` | — | the CA certificate file that signed the database server's certificate (only with `DB_SSL=required`; leave unset for a public CA) |
| `DB_POOL_SIZE` | 10 | connections kept open (1–100). 30 is enough for 19 faculty running AI checks and generations at the same time |
| `DB_POOL_QUEUE` | 200 | requests that may wait for a connection (1–10000) |
| `DB_SQL_STRICT` | `off` | `on` refuses a value that is too long or of the wrong type instead of cutting it. Turn it on only after the full browser E2E has passed against a strict database; the server then checks at startup that it took effect |

The server reads `DB_PORT`, `DB_SSL` and `DB_SSL_CA`; most scripts in `server/db/` do not yet (pre-deploy report 2026-11-24, B4).

### Accounts and sessions

| Variable | Default | What it does |
|---|---|---|
| `GENERATED_PASSWORD_DAYS` | 7 | how many days a password the system generates (new account, "Resend credentials", `db/create-admin.js`) works if it is not replaced (1–90) |
| `SESSION_STORE` | `memory` in development | `memory` or `mysql`. Staging and production always use `mysql` (memory is refused); run `npm run migrate-session-store` first |
| `PRIVATE_DIR` | `private` | folder for profile photos and COR photos (relative: under `server/`; an absolute path is used as it is) |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Check session |
| GET | /api/syllabi | List syllabi |
| POST | /api/syllabi | Create syllabus |
| PUT | /api/syllabi/:id | Update syllabus |
| DELETE | /api/syllabi/:id | Delete syllabus |
| GET | /api/curriculum | List curricula |
| GET | /api/logs | List activity logs |
| GET | /api/messages/:id | Get messages |
| POST | /api/messages/:id | Send message |
| PUT | /api/messages/read/:id | Mark as read |
| POST | /api/students/scan | Read a COR photo (public) |
| POST | /api/students/register | Create the student account from the scan (public) |
| GET | /api/students/me | A student's profile and subjects |
| GET | /api/students/syllabi | Approved syllabi a student can read |
| POST | /api/auth/google | Google sign-in |
| GET | /api/syllabi/:id/review | Read-only view of a submitted version |
| POST | /api/syllabi/:id/stage-clear | Clear the reviewer's stage, on their turn (see `docs/review-chain.md`) |
| GET | /api/syllabi/:id/stages | Review stages, turn, last decision and sign-off dates |
| POST | /api/syllabi/pdf-import/extract | Preview a PDF before a subject is chosen (see `docs/pdf-syllabus-import.md`) |
| POST | /api/syllabi/:id/import-pdf | Preview a PDF into a draft |
| GET | /api/syllabi/pdf-import/job/:job | Pick up a PDF scan again after a refresh |
| GET/POST | /api/syllabi/:id/comments | Reviewer comments |
| GET | /api/syllabi/:id/compliance | Stored compliance check |
| POST | /api/syllabi/:id/compliance/recheck | Re-run the compliance check |
| GET | /api/compliance | Compliance overview (admin: all, faculty: own) |
| GET | /api/messages | All my messages |
| GET | /api/notifications | My notifications |
| PUT | /api/notifications/read-all | Mark all read |
| GET | /api/programs | Programs (faculty: assigned only) |
| GET | /api/courses | Subjects (faculty: assigned only) |
| GET/PUT | /api/users/:id/assignments | Faculty program and subject assignments (admin) |
| POST/DELETE | /api/users/me/avatar | Set or remove my profile photo |
| GET | /api/users | List users (admin) |
| POST | /api/users | Create user (admin) |
| DELETE | /api/users/:id | Delete user (admin) |
