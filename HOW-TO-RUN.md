# How to Run Syllabus Management System

Step-by-step guide to run the full system (frontend + backend + database).

---

## Prerequisites

Install these first:

- [Node.js](https://nodejs.org/) (v18 or higher, includes npm)
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
| `SESSION_SECRET` | any long random string |
| `JWT_SECRET` | any long random string. If missing, login and Google sign-in return 500 |
| `GOOGLE_CLIENT_ID` | must match the frontend `VITE_GOOGLE_CLIENT_ID` (only needed for Google sign-in) |
| `PORT`, `UPLOAD_DIR` | API port (default 3001) and upload folder |
| `CURRENT_TERM`, `ALLOWED_EMAIL_DOMAIN` | optional (domain defaults to `email.lcup.edu.ph`) |
| `COMPLIANCE_AI_PROVIDER` | optional: `mock` shows AI-labelled recommendations in development; unset = plain rule-based check |
| `SCHOOL_YEAR_START` | optional, default `2026` (used to measure reference age) |

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
```

- `migrate-avatars-private`, `migrate-assignments`, `migrate-program-egas` and `migrate-subject-owner` support `--dry-run` (e.g. `npm run migrate-assignments -- --dry-run`)
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
| `VITE_NEW_BUILDER` | `true` switches to the rebuilt syllabus builder (`src/views/builder2`) |

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
- **Register (for Students)**: upload a photo of your Certificate of Registration (JPG, PNG or WebP, up to 10MB) and choose a password. The server reads the COR with OCR; confirm the details in the "Is this your COR?" window. Your student ID (with or without dashes) is your username. A clearly readable BSIT COR is verified automatically; anything doubtful stays **pending** for an administrator, and pending or rejected students cannot sign in yet.

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
`JWT_SECRET` is missing in `server/.env`. Add it and restart the API server.

### Google sign-in says 404 or "Access Denied"
Restart the API server (an old process has no `/api/auth/google`). "Access Denied" means the email is not in Users & Roles.

### "Table ... doesn't exist" or a missing column
Your database is behind. Run the migrations in *Upgrading an existing database*, then restart the API server.

### Student registration cannot read the COR
Make sure `npm install` was run in `server/` (OCR needs `tesseract.js` and `sharp`) and that `server/eng.traineddata` exists. Test the reader on its own with `node scripts/ocr-cor-test.js [image]`. Small or tilted photos may not yield the subject list; the registration then goes to an administrator.

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
| `npm run init-db` | Create the database, tables and seed data |
| `npm run seed-outcomes` | Load the institution's vision, mission, EGAs, programs and the BSIT program outcomes. Only inserts what is missing; run it after `migrate-builder`. Supports `--dry-run` |
| `node scripts/ocr-cor-test.js [image]` | Try the COR reader on the images in `server/sample_cor/` (git-ignored) or on a given image; prints the fields it read |

### Database migrations (`server/`)
Each one upgrades an older database, is safe to run again, and touches no existing data. Run the ones you are missing, in this order, then restart the API server.

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
| GET | /api/students/pending | Registrations waiting for review (admin) |
| GET | /api/students/:id/cor | The COR photo of a pending student (admin) |
| POST | /api/students/:id/verify | Approve or reject a pending student (admin) |
| POST | /api/auth/google | Google sign-in |
| GET | /api/syllabi/:id/review | Read-only view of a submitted version |
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
