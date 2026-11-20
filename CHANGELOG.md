# Changelog

All notable changes to Syllabus CMS Plus are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

### v1.0.0 — Initial Setup
**By:** Raymond  
**Date:** September 12, 2026

- Copied base project from `syllabus-cms-react`
- Added `vite.config.js` with React plugin
- Updated `package.json` to `syllabus-cms-plus`

---

### v1.1.0 — Port Features from Syllabus Core
**By:** Raymond  
**Date:** September 12, 2026

**Authentication & Access:**
- Added two-role system (Admin + Faculty) with credential validation
- Added session persistence via localStorage
- Added demo account hints on login page
- Added role-gated navigation (Faculty vs Admin views)

**Faculty Features:**
- Added My Syllabi page — card grid with edit, delete, version history, messaging
- Added file upload drag-drop zone in Syllabus Builder
- Added Syllabus Builder restricted to Faculty only

**Admin Features:**
- Added Review & Approval queue with approve/reject/revision workflow
- Added Compliance Monitoring — per-faculty compliance cards with progress bars
- Added Reports page — faculty compliance report with download, accreditation summary, historical exports

**Messaging:**
- Added per-syllabus threaded chat modal with unread badges
- Added messages dropdown in topbar with thread preview
- Added read receipts (Read/Sent) in chat

**Version Control:**
- Added Version History modal with reverse-chronological timeline
- Added version tracking on all status changes

**Activity Logging:**
- Added dynamic activity log from all actions
- Added Clear Logs with role-scoped deletion (Admin clears all, Faculty clears own)

**Other:**
- Added Reject status support
- Added delete confirmation modals
- Added Toast notification system
- Added live stats in Dashboard and Repository

---

### v1.2.0 — Animations
**By:** Raymond  
**Date:** September 13, 2026

- Added fadeInUp animation for stat cards with staggered delays
- Added donutSpin animation for pie/donut charts
- Added ringGrow animation for compliance and quality rings
- Added growBar animation for progress bars
- Added drawLine animation for SVG line chart
- Added growBar animation for bar chart columns with stagger
- Added slideInRight animation for check rows and queue items
- Added fadeInUp animation for activity items, workflow steps, comments, insights
- Added hover lift effects on cards
- Added hover slide effects on buttons and queue items
- Added scaleIn animation for modals
- Added pulse shimmer on toast notifications

---

### v1.3.0 — Project Reorganization
**By:** Raymond  
**Date:** September 13, 2026

**Restructured from single-file (526 lines) to modular architecture (22 files):**

```
src/
├── App.jsx              ← slim orchestrator (~130 lines)
├── main.jsx
├── styles.css
├── components/
│   ├── ui.jsx           ← Card, Legend, Progress, Field, Toggle, etc.
│   ├── Sidebar.jsx
│   ├── Topbar.jsx
│   ├── Login.jsx
│   ├── ChatModal.jsx
│   ├── ConfirmModal.jsx
│   └── VersionHistoryModal.jsx
├── data/
│   └── initialData.js   ← all constants & seed data
├── lib/
│   └── utils.js         ← load(), fmt(), bumpVer()
└── views/
    ├── DashboardView.jsx
    ├── SyllabusBuilder.jsx
    ├── AIChecker.jsx
    ├── COPOMapping.jsx
    ├── ReviewApproval.jsx
    ├── MySyllabi.jsx
    ├── Repository.jsx
    ├── Compliance.jsx
    ├── Analytics.jsx
    ├── Reports.jsx
    ├── UsersRoles.jsx
    └── Settings.jsx
```

---

### v1.4.0 — Bug Fixes & UI Tweaks
**By:** Raymond  
**Date:** September 15, 2026

- Fixed `ReferenceError: m is not defined` in threads useMemo (variable scope bug)
- Fixed priority badge text centering (changed to inline-flex)
- Fixed report-row alignment (changed to grid layout)
- Fixed report-row text alignment (left-aligned with proper spacing)
- Removed Syllabus Builder from Admin nav (Faculty-only)
- Updated Repository to show only Faculty's own syllabi when logged in as Faculty
- Updated Reports to show only Faculty's own compliance data when logged in as Faculty
- Updated Analytics to show only Faculty's own data (compliance, submissions, quality scores) when logged in as Faculty
- Confirmed CO–PO Mapping uses correct I/R/M terminology (Introduced, Reinforced, Mastered)

---

### v1.5.0 — Font Size Increase
**By:** Raymond  
**Date:** September 17, 2026

- Increased all font sizes by 2–3px for better readability
- 8px → 10px, 9px → 11px, 10px → 12px, 11px → 13px, 12px → 14px, 13px → 15px, 15px → 17px, 16px → 18px, 17px → 20px, 28px → 30px

---

### v1.6.0 — Backend API Integration
**By:** Raymond  
**Date:** September 17, 2026

**Backend Setup:**
- Created Express.js server with MySQL (mysql2 driver)
- Implemented three-tier architecture: React.js → Node.js/Express → MySQL
- Created database schema: users, syllabi, curriculum, submission_logs, comments, messages, co_po_mapping
- Added session-based authentication with express-session
- Added file upload with multer (syllabus documents)
- Added CORS configuration for frontend–backend communication

**API Routes:**
- POST /api/auth/login — authenticate user, create session
- POST /api/auth/logout — destroy session
- GET /api/auth/me — check current session
- GET /api/syllabi — list syllabi (faculty: own, admin: all)
- POST /api/syllabi — create syllabus with file upload
- PUT /api/syllabi/:id — update syllabus status/details
- DELETE /api/syllabi/:id — delete syllabus
- GET /api/curriculum — list curriculum programs
- GET /api/logs — list submission logs
- GET /api/messages/:syllabusId — get messages for syllabus
- POST /api/messages/:syllabusId — send message
- PUT /api/messages/read/:syllabusId — mark messages as read
- GET /api/users — list users (admin only)
- POST /api/users — create user (admin only)
- DELETE /api/users/:id — delete user (admin only)
- GET /api/mapping/:curriculumId — get CO–PO mapping
- PUT /api/mapping/:curriculumId — save CO–PO mapping

**Frontend Changes:**
- Created src/lib/api.js — fetch helpers for all API endpoints
- Updated App.jsx — removed localStorage/mock data, now uses real API calls
- Added loading screen with spinner while checking session
- All CRUD operations now persist to MySQL database

---

### v1.7.0 — Login Improvements
**By:** Raymond  
**Date:** September 17, 2026

- Added show/hide password toggle button (eye icon) on login form
- Added CSS styling for password field and eye button

---

### v1.8.0 — Mock Data Cleanup & DB Status Fix
**By:** Raymond  
**Date:** September 17, 2026

- Removed all mock data from frontend (USERS, INITIAL_SYLLABI, INITIAL_LOGS, INITIAL_MESSAGES, complianceSeed)
- Removed `pending` status from database ENUM and all frontend references
- Database status values now: submitted, under_review, approved, rejected, for_revision
- Fixed ChatModal to derive partner from messages instead of hardcoded USERS
- Fixed MySyllabi to use `userId` instead of `ownerId`
- Fixed Repository to use `courseCode` instead of `code`, lowercase status filters
- Fixed ReviewApproval to use lowercase status values
- Fixed Compliance to use lowercase status values

---

### v1.9.0 — CO–PO Mapping Persistence
**By:** Raymond  
**Date:** September 17, 2026

- Added `co_po_mapping` table to MySQL schema
- Added GET/PUT `/api/mapping/:curriculumId` routes
- Added `mapping.get()` and `mapping.save()` to frontend API
- Updated COPOMapping component to load/save from database
- Added curriculum selector dropdown

---

### v1.10.0 — Dynamic AI Checker & Dashboard
**By:** Raymond  
**Date:** September 17, 2026

- AI Checker now computes compliance scores from actual syllabi data
- Recommendations are dynamic based on which checks are weak
- Dashboard stats computed from real syllabi (no hardcoded 128/72/24/18/8/6)
- Dashboard Program Compliance computed from syllabi grouped by program
- AI Quality Snapshot derived from compliance rate
- Fixed all NaN% issues (division by zero when no syllabi)
- Fixed negative compliance scores (clamped to 0 minimum)

---

### v1.11.0 — UI Fixes
**By:** Raymond  
**Date:** September 17, 2026

- Changed department name from "College of Information and Communications Technology" to "CITE"
- Fixed AI Recommendations priority badges to circular 44px shape with 8px uppercase text
- Fixed AI Checker to show 0% for all scores when no syllabi exist

---

### v1.12.0 — Users & Roles from Database
**By:** Raymond  
**Date:** September 17, 2026

- Users & Roles page now fetches real users from MySQL database via API
- Added "+ Add User" form with email, password, name, and role fields
- Added delete button per user
- Removed all hardcoded mock user data

---

### v1.13.0 — Student Registration (UI)
**By:** Raymond  
**Date:** October 12, 2026

**Login Page:**
- Added "Register (for Students)" button below the Sign In form
- Added login/register mode toggle within the login page (no separate route)

**Student Registration Form (`StudentRegister.jsx`):**
- Added username field (student ID format)
- Added password field with show/hide toggle
- Added Certificate of Registration (COR) drag-and-drop upload zone
- COR upload restricted to image files (enables camera capture on mobile devices)
- Added form validation — username, password, and COR file are all required
- Added registration success state with "Registration Received" confirmation and back-to-sign-in button

**Animations & Styling:**
- Added cardIn entrance animation (fade + slide-up) on the registration form
- Added popIn bounce animation on the success checkmark
- Added hover lift effect on the register button
- Added compact dropzone variant (`.dropzone.compact`) for the COR upload

**Notes:**
- Frontend-only for now — no backend wiring; COR file is held in component state, ready for FormData integration
- Mobile-responsive layout for login/register was prototyped and removed (desktop layout remains as-is)

---

### v1.14.0 — Remember Me (Persistent Login)
**By:** Raymond  
**Date:** October 12, 2026

**Backend:**
- Added `remember_tokens` table (`token_hash`, `expires_at`, cascades on user delete) — run `npm run init-db` to create it
- `POST /api/auth/login` now accepts `remember`; when true, issues a 30-day `remember_token` cookie (httpOnly, SameSite=Lax, secure in production) and extends the session cookie to 30 days
- Tokens are random 32-byte values; only the SHA-256 hash is stored in the database
- Added `restoreSession` middleware — restores the session from a valid remember cookie after a browser restart or server restart, and rotates the token on every use (single-use tokens)
- Expired tokens are purged automatically when a remember cookie is checked
- When "Remember me" is unchecked, the session is a browser-session cookie and any existing remember token is revoked
- `POST /api/auth/logout` now deletes the remember token and clears the cookie

**Frontend:**
- Wired the "Remember me" checkbox on the login page and passed the value through `App.jsx` and `lib/api.js`

**Fixes:**
- Fixed Login submit handler not awaiting the async `onLogin`, which would have tried to render a Promise as the error message on failed login

**Notes:**
- The API server must be restarted after pulling this change (`npm run dev` does not auto-reload)

---

### v1.14.1 — Environment Template
**By:** Raymond  
**Date:** October 12, 2026

- Added `server/.env.example` with placeholder values for `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, `SESSION_SECRET`, `PORT`, and `UPLOAD_DIR`
- Cleared the values in the local `server/.env` (still gitignored) so no credentials or secrets remain in the working copy

**Notes:**
- To set up, copy `server/.env.example` to `server/.env` and fill in real values.

---

### v1.15.0 — Google Sign-In & Allowlist Authentication
**By:** JP Del Rosario  
**Date:** October 12, 2026

**Backend — Authentication:**
- Added `POST /api/auth/google` — verifies a Google ID token (`token` in body) with `google-auth-library` against `GOOGLE_CLIENT_ID`, requires a verified `@email.lcup.edu.ph` address, then looks the email up in `users` (case-insensitive)
- Allowlist model: if the email is not in `users`, returns `403` "Access Denied. Your account is not registered in the system."; offboarding is done by deleting the user row (there is no `status` column)
- On success returns `{ token, user }` with an 8-hour HS256 JWT containing `{ userId, email, role }`, and also starts the cookie session so existing session-based routes keep working
- `POST /api/auth/login` now looks users up case-insensitively, returns `403` "Access Denied. Account not registered." for unknown emails, `401` for a wrong password, and returns `{ token, user }` on success (accounts without a usable password hash fail as wrong password instead of crashing)
- All auth failures return `{ message, error }`; unexpected errors are logged (`GOOGLE AUTH ERROR:`, `LOGIN ERROR:`) and return a clear `500`
- Server startup now logs the mounted auth endpoints and warns if `GOOGLE_CLIENT_ID` or `JWT_SECRET` is missing
- Added `middleware/jwt.js` — signs and verifies the JWTs (`JWT_SECRET`)

**Backend — Authorization:**
- Added `middleware/canEditSyllabus.js` (RBAC + ABAC) — verifies the Bearer JWT, confirms the user row still exists, requires role `faculty` (teacher) or `admin` (Dean / Administrator), and requires teachers to hold an `ACTIVE` `course_assignments` row for the syllabus (and the term in `CURRENT_TERM`, if set); admins bypass the assignment check
- `requireAuth` / `requireAdmin` now confirm the user row still exists, so a deleted user's live session stops working immediately
- `restoreSession` (Remember Me) only restores sessions for users that still exist

**Database:**
- Added `course_assignments` table (`teacher_id`, `syllabus_id`, `term`, `status`)
- Added `db/migrate-google-auth.js` for existing databases — run `npm run migrate-google-auth` (creates `course_assignments`)

**Frontend:**
- Added `GoogleSignInButton.jsx` — loads the Google Identity Services SDK on demand and renders Google's official button on the login page
- `Login.jsx` shows the Google button below the password form, with backend errors shown in the existing error banner
- `lib/api.js`: stores the JWT in localStorage (`sms_jwt`), sends `Authorization: Bearer <token>` on all requests, clears the token on 401 and logout, shows the server's `message` on errors (and a clear message when the server is unreachable), and reads the API URL from `VITE_API_URL`
- `App.jsx`: added `handleGoogleLogin`

**Configuration:**
- Frontend: `VITE_GOOGLE_CLIENT_ID` in the root `.env` (template in `.env.example`)
- Backend: `GOOGLE_CLIENT_ID` (must match the frontend value) and `JWT_SECRET` in `server/.env`; optional `CURRENT_TERM` and `ALLOWED_EMAIL_DOMAIN` (defaults to `email.lcup.edu.ph`)

**Notes:**
- Restart the API server after pulling this change (an old server process returns `404` for `/api/auth/google`)
- `canEditSyllabus` is not yet attached to any route, and no `course_assignments` rows are created automatically

---

### v1.15.1 — Google Button Styling
**By:** JP Del Rosario  
**Date:** October 12, 2026

- Google sign-in button now matches the Sign In button's size, rounded corners, font and text ("Sign in with Google" with the Google logo)
- Implemented as our own styled button with Google's official button rendered invisibly on top, scaled to cover it, so clicks still use the real Google flow
- Added `.google-btn-*` styles with the same hover lift as the Register button

---

### v1.16.0 — Users & Roles Provisioning
**By:** JP Del Rosario  
**Date:** October 12, 2026

**Backend (`/api/users`, admin only):**
- `GET /api/users` lists registered users (the sign-in allowlist)
- `POST /api/users` registers a user from `first_name`, `last_name`, `email`, `role` and a password; emails are lowercased and validated, duplicates return `409`, roles are limited to `faculty` and `admin`; if no password is sent a random unusable hash is stored (`password_hash` is NOT NULL)
- `DELETE /api/users/:id` removes the user and their access; admins cannot delete themselves
- Errors return `{ message, error }`

**Frontend (`UsersRoles.jsx`):**
- Form fields: First Name, Last Name, Institutional Email, Initial Password, Role
- Merged Dean and Admin into one role: the dropdown has **Faculty** and **Dean / Administrator** (`admin`), and the table shows "Dean / Administrator"
- Added a Remove button with a confirmation prompt per user
- Redesigned the provision form as a responsive grid (1 / 2 / 3 columns), with labels above inputs, consistent input and select styling with a blue focus ring, and a full-width Save button; the table is wrapped in a horizontally scrollable container
- Styles are plain CSS (`.user-form-grid`, `.user-field`, `.user-input`, `.user-save-btn`) at the end of `styles.css` because the project does not use Tailwind

---

### v1.17.0 — Collapsible Sidebar
**By:** JP Del Rosario  
**Date:** October 12, 2026

**Sidebar (`Sidebar.jsx`):**
- Sidebar collapses to an icon-only mode (260px expanded, 80px collapsed) and expands back
- Added a hamburger menu toggle (inline SVG) at the left of the sidebar header, with `aria-expanded`, `aria-label` and a title; the logo and "SMS" title sit to its right and fade out when collapsed
- The hamburger rotates a full 360° in sync with the width transition
- Nav items keep their `aria-label`; when collapsed they also get a `title` tooltip with the page name, and `aria-current` marks the active page
- Removed the bottom-left profile widget (the user's details already appear in the top bar) along with its unused props and CSS

**State & layout (`App.jsx`):**
- Added `sidebarCollapsed` state, read from `localStorage` (`sms_sidebar_collapsed`) on first render so the saved state shows with no layout flash; wrapped in try/catch for blocked storage
- The layout container owns the state and exposes it as `data-sidebar-collapsed`; the sidebar only reacts through its own `data-collapsed` attribute

**Styles (`styles.css`):**
- Layout variables: `--sidebar-width-expanded`, `--sidebar-width-collapsed`, `--sidebar-width`, `--sidebar-duration` (300ms) and `--sidebar-ease` (`cubic-bezier(0.4, 0, 0.2, 1)`), shared by the sidebar width, the content's left margin and the hamburger rotation
- Labels stay mounted and fade out with `opacity` while the sidebar clips them (`overflow: hidden`, `white-space: nowrap`); no padding, gap or max-width is animated, so there is no per-row layout work
- Icons sit in a fixed 48px column that is already centered when collapsed, so they never shift; icons scale to 1.15 on hover when collapsed
- Sidebar uses `will-change: width`, the hamburger uses `will-change: transform` and `translateZ(0)`
- `prefers-reduced-motion` disables the animations
- Visible keyboard focus outlines on the toggle and nav items

---

### v1.17.1 — Stable Dashboard Layout When Toggling the Sidebar
**By:** JP Del Rosario  
**Date:** October 12, 2026

- Fixed dashboard rows moving up and down while the sidebar resizes: card text re-wrapped as the content width changed, so row heights (and everything below them) shifted by 30–40px
- Stat cards now share the full row (`repeat(auto-fit, minmax(140px, 1fr))`) instead of leaving an empty sixth column, with a 120px minimum height
- The Recent Activity / Submission Status / Quick Actions row has a 290px minimum height
- Verified in headless Chrome: row heights are identical expanded and collapsed at viewport widths from 1280px to 1920px

**Notes:**
- Stat cards are taller on wide screens than before (about 91px before, 120px now)
- Around 1100px wide the bottom row can still change height slightly; only the dashboard page was checked
- Tried and reverted: animating only the sidebar with the content snapping to its final width, and sliding the content with a transform (content laid out once at its final width); both felt worse than the content gliding with the sidebar

---

### v1.18.0 — Accessibility, Typography & Icon System
**By:** JP Del Rosario  
**Date:** October 13, 2026

**Accessibility & color (`styles.css`):**
- Darkened `--muted` to `#5f6b82` and replaced four light-grey text colors with it; input borders are now about 3:1 on white
- Darkened status text (green, gold/amber, draft, for-revision, priority-high) so every badge, priority pill, map cell and warning meets 4.5:1 on its tint; `.btn.success` is now `#1c8250`
- Added a global keyboard focus ring for buttons, `role="button"` elements and links

**Typography:**
- Self-hosted Inter and Manrope (latin woff2 in `public/fonts/`, `font-display: swap`); removed the Google Fonts `@import`
- Added `--font-body` / `--font-display` and a type scale (`--text-xs` 12 → `--text-hero`); no text is smaller than 12px, tables, forms and body text are 14px
- Weights: page, modal and card titles 700; item titles, table headers, labels, buttons and badges 600; descriptions 400; 800 only for the large stat numbers. Bold `strong` / `th` text that relied on browser defaults now declares its weight
- Added `font-variant-numeric: tabular-nums` to tables, matrix cells, progress values, score rings and stat numbers; heading line-height 1.3, body 1.5
- Widened the AI-checker priority circle to 56px so "MEDIUM" fits at 12px

**Icons:**
- Added `@phosphor-icons/react` and an `Icon` component in `ui.jsx` (duotone by default; decorative icons are `aria-hidden`, meaningful ones take a `label`); icons are imported one by one
- Replaced the text glyphs in the sidebar nav, stat cards, Quick Actions, topbar (search, messages, notifications), login feature pills and the password show/hide buttons (Login and Student Register); `navItems` now holds icon names
- Show/hide password buttons have `aria-label`s

**Notes:**
- The JS bundle grew by about 90 KB (24 KB gzipped) because each Phosphor icon ships every weight
- Brand-color tokens and recoloring the stat tiles were proposed but not applied

---

### v1.19.0 — Profile Pictures
**By:** JP Del Rosario  
**Date:** October 13, 2026

**Topbar:**
- Fixed the avatar / name / role alignment: one merged `.avatar` rule (circular, `flex: none`, `object-fit: cover`), flex row with a 10px gap, text block centered with `line-height: 1.25`; verified at 1280px and 1920px
- Clicking the profile opens a menu with Change photo and Remove photo (hidden when there is no photo); `aria-haspopup` / `aria-expanded`, Escape closes it and returns focus, outside click closes it

**Client:**
- `src/lib/avatar.js`: crops to a square, resizes to 256×256 and exports WebP (JPEG fallback); rejects files over 5 MB; errors show in the toast
- `Avatar` component (`ui.jsx`): shows the photo, or initials when there is none or it fails to load; `api.js` gets `users.uploadAvatar` / `users.removeAvatar`; `App.jsx` updates the topbar without a reload

**Server:**
- `users.avatar_path` (nullable) in `schema.sql` plus `db/migrate-avatar.js` (`npm run migrate-avatar`)
- `POST /api/users/me/avatar` (multer, one `avatar` file, 2 MB) and `DELETE /api/users/me/avatar`: the file type is checked from the first bytes (JPEG, PNG, WebP only; SVG and renamed files are rejected), saved as `u<id>-<timestamp>.<ext>`, and the old file is deleted after the new one is saved; there is no user id in the URL, so only your own photo can change
- `toSessionUser(row)` builds the user object for `/google`, `/login` and session restore, so `avatarUrl` is everywhere

---

### v1.19.1 — Profile Photo Visibility & Moderation
**By:** JP Del Rosario  
**Date:** October 13, 2026

- Photos are stored in `server/private/avatars/` (gitignored), outside the public `/uploads` folder, and `/uploads/avatars/*` now returns 404
- `GET /api/users/:id/avatar` requires login and allows an admin, the owner, or someone who shares a message thread with that user; everyone else gets 404. Sent with `Cache-Control: private, max-age=86400`, an ETag and `nosniff`
- Added `avatarUrl` to `GET /api/users`, `ownerAvatarUrl` to `GET /api/syllabi` and `senderAvatarUrl` to the messages responses (one shared `avatarUrlFor` helper in `server/lib/avatar.js`)
- Photos now show in the Users & Roles table, Review & Approval queue, Repository, chat thread list and chat header; the thread list now gets a real `partner`
- `DELETE /api/users/:id/avatar` (admin only) removes any photo and is recorded in the server log
- `db/migrate-avatars-private.js` (`npm run migrate-avatars-private`, supports `--dry-run`) moves existing files into the private folder and makes `avatar_path` relative; run it once and restart the API

**Notes:**
- `<img>` sends the session cookie when the front end and API share a site (as in dev); on different sites photos would fall back to initials
- Moderation is not written to `submission_logs`, which needs a syllabus and has a fixed action list

---

### v1.20.0 — Server-Enforced Chat Rules
**By:** JP Del Rosario  
**Date:** October 13, 2026

- Chat is per syllabus and only between the syllabus owner and an admin; this is now enforced on the server (`loadThread` helper in `routes/messages.js`)
- `GET /:syllabusId` and `PUT /read/:syllabusId` return 404 for a missing syllabus and 403 for non-participants
- `POST /:syllabusId` ignores any `receiverId` from the client: an admin writes to the owner; the owner writes to the admin already in the thread, otherwise the first admin account; text is trimmed, required and limited to 2000 characters
- `App.jsx` no longer hard-codes receivers (admin → owner or id 2, faculty → id 1); `messages.send` still accepts the old three-argument call and ignores the receiver

---

### v1.21.0 — Notifications & Live Refresh
**By:** JP Del Rosario  
**Date:** October 13, 2026

**Messages:**
- `GET /api/messages` returns every message I sent or received in one request; `App.jsx` loads messages with it instead of one request per syllabus, and no longer waits for syllabi to load
- Fixed the blank "Syllabus: • title" line in the chat header (`syl.code` → `syl.courseCode`)

**Notifications:**
- New `notifications` table (`schema.sql`, `db/migrate-notifications.js`, `npm run migrate-notifications`) with an index on `(user_id, is_read, created_at)`
- `server/lib/notify.js`: `createNotification` and `notifyAdmins` never throw, so a failed notification can't break a message, status change or submission
- Created on: a new message (to the receiver), Approved / For Revision / Rejected (to the syllabus owner, including the reviewer comment), and a new submission (to every admin)
- Endpoints: `GET /api/notifications`, `GET /api/notifications/summary`, `PUT /api/notifications/:id/read` (mine only) and `PUT /api/notifications/read-all`
- The topbar bell shows a real unread badge and a dropdown (reuses `.msg-drop` / `.thread`) with Mark all read; clicking an item marks it read and opens the chat, or My Syllabi / Review & Approval

**Live refresh:**
- `useNotificationPolling` checks `/notifications/summary` every 25 seconds, only while the tab is visible, and refetches messages, notifications and syllabi when something changed; it stops on logout and unmount

**Notes:**
- Messages and notifications live in the database, so they stay after logout; the chat's Delete button only hides a conversation on screen
- Run `npm run migrate-avatar`, `npm run migrate-avatars-private` and `npm run migrate-notifications` (in `server/`) on any database that doesn't have them yet
- Syllabus version history and owner edit rules were reviewed but not built

---

### v1.22.0 — Faculty Program & Subject Assignments
**By:** JP Del Rosario  
**Date:** October 13, 2026

An admin assigns programs, then subjects, to each faculty member. A faculty member can create and edit syllabi only for assigned subjects. In this school a "course" is the program, so the catalog item the app used to call a course (IT 204, Programming 2) is now called a **subject** everywhere users see it (the sidebar item is now "Subjects & CLOs"). Code, tables and API paths keep their old names (`courses`, `courseId`, `faculty_courses`).

**Database:**
- New tables `faculty_programs(user_id, program_id)` and `faculty_courses(user_id, course_id)` (pair is the primary key, both cascade on delete), in `schema.sql` and `db/migrate-assignments.js` (`npm run migrate-assignments`, supports `--dry-run`). The older `course_assignments` table is untouched

**Rules (`server/lib/assignments.js`, pure and unit-tested):**
- A subject can be assigned only if its program is assigned to the same user; removing a program drops that program's subjects in the same save; only faculty are assignable; admins are never restricted; lists are capped at 20 programs and 200 subjects
- Guards `requireCourseAccess` (builder syllabi, by subject id) and `requireCourseCodeAccess` (legacy syllabi, by subject code)
- Three states with their own messages: nothing assigned, a program but no subject yet ("A program is assigned to you, but no subject yet. Ask an administrator."), and subject not assigned

**Admin API (`routes/users.js`):**
- `GET` / `PUT /api/users/:id/assignments` (admin only, faculty targets only, `{ programs, courses }` replaced in one transaction; the response adds `dropped`, `changed` and `emptyPrograms`; saving a program that has no subjects yet is allowed)
- `GET /api/users/me/assignments` (an admin gets `unrestricted: true`); registered before the `/:id` routes
- The faculty member gets an `assignment` notification when their assignments change

**Enforcement:**
- `GET /api/courses` and `GET /api/programs` return only assigned items to faculty; admins still see everything. `GET /courses/:id` and `/programs/:id/outcomes` stay open
- `POST /api/syllabi/drafts`, `PUT /:id/content`, `POST /:id/submit` and the legacy `POST /api/syllabi` and owner `PUT /:id` return 403 for an unassigned subject. A syllabus whose subject is later un-assigned becomes read-only for its owner (`GET /:id/content` returns `editable: false` and `lockedReason`) and is editable again when re-assigned. Non-owners still get 404
- `GET /api/syllabi` now also returns `courseId`

**UI:**
- Users & Roles: an **Assignments** button per faculty member opens a modal (programs on the left with tick-to-assign and counts, the focused program's subjects on the right with search, Select all and Clear). Navy header with a gold rule; only assigns, it does not create subjects
- Faculty: banners and disabled actions in My Syllabi ("+ New Syllabus", Edit with the reason), the builder and the previous builder when nothing is assigned or only a program is
- The rebuilt builder (`src/views/builder2`) is now behind `VITE_NEW_BUILDER=true` in `.env`; the previous builder is the default again

**Tests:**
- `npm test` now also runs `server/lib/assignments.test.js`, `server/routes/assignments.routes.test.js`, `server/routes/enforcement.routes.test.js` and `src/lib/syllabusRules.test.js` (fake-database route tests, no MySQL needed)

**Notes:**
- Run `npm run migrate-assignments` (in `server/`), then restart the API server
- On release every faculty member is locked out of creating and editing until an admin assigns them a program and a subject: assign first, then announce
- Not built: terms or school years on assignments, backfilling assignments from existing syllabi, removing `course_assignments`

---

### v1.23.0 — Admin-Managed Catalog Per Program, Subject Modal
**By:** JP Del Rosario  
**Date:** October 13, 2026

Each program has its own expected graduate attributes (EGAs) and program outcomes (POs); each subject has its own course learning outcomes (CLOs), tagged only with its program's EGAs and POs. Vision and mission stay school-wide. Faculty see all of it read-only in the syllabus builder, with no lock icons or "set by an administrator" labels.

**Database:**
- New table `program_egas(program_id, ega_no, name, short_name)`; `db/migrate-program-egas.js` (`npm run migrate-program-egas`, supports `--dry-run`) copies the school-wide EGAs into every program that has none and adds version counters (`programs.egas_version`, `programs.pos_version`, `courses.clos_version`, `institution_settings.version`). `schema.sql` and `db/seed-outcomes.js` do the same for fresh installs. A program without its own EGAs falls back to the school-wide list

**API:**
- `GET /api/programs/:id/outcomes` also returns the program's `egas`, its `versions` and the `subjects` that share them; new `PUT /api/programs/:id/egas`; `PUT .../outcomes` allows a PO to map only to its own program's EGAs; `PUT /api/courses/:id/clos` checks CLO tags against the subject's own program; `PUT /api/institution/outcomes` carries a version
- Stale saves: every save sends the version it loaded; a save from an out-of-date screen gets 409 "This was changed by someone else. Reload to see the latest." and changes nothing (optional for older callers)
- Removing an EGA or PO that a CLO of that program's subjects (or a PO) still uses gets 409 naming what uses it (`lib/catalogUse.js`); nothing outside the program is affected
- A submitted syllabus stores a snapshot of the vision, mission, program EGAs and POs (`content.catalog`); a syllabus that can no longer be edited shows those saved texts instead of the live ones. Clients cannot send that key
- Shared code moved to `lib/institution.js`, `lib/programs.js` and `lib/programEgas.js`

**Subjects & CLOs (admin):**
- The Institution and Program outcomes tabs are replaced by a **subject modal**: click a subject to manage, in independent cards that each save on their own, its CLOs (with the "+ EGA" suggestion from the chosen POs), its program's EGAs, its program's POs, the school's vision and mission, and the subject details with Delete. Each card says what it affects ("BSIT, all subjects" or "School-wide") and which other subjects share it; a stale save keeps what was typed and offers Reload; closing with unsaved changes asks first
- The list has a program filter. **+ Add subject** now takes a typed program code and full name: an existing code is used as it is (its name is filled in), a new code creates the program together with its first subject in one transaction (`createProgram`), starting with the default EGAs; a name already used by another code is 409 and a failed subject leaves no program behind
- The Assignments modal only assigns: its create-subject features were removed. It reloads programs and subjects when the browser tab regains focus without losing unsaved ticks (`src/lib/assignmentSync.js`), and an empty program offers "Go to Subjects & CLOs"

**Syllabus builder:**
- The rules module resolves EGA tags from the syllabus's program (`createModel`, `egaList`); the tag picker, Learning Outcomes table and finished form follow
- The vision, mission, EGAs, POs and the subject's CLOs are re-fetched when the Learning Outcomes step opens and when the browser tab regains focus (`useCatalog`)

**Notes:**
- Run `npm run migrate-program-egas` (in `server/`) before restarting the API server
- Not built: renumbering EGAs or POs, a delete-program route, bulk import of subjects

---

### v1.24.0 — Builder Blocks Next on Missing Required or Admin Data
**By:** JP Del Rosario  
**Date:** October 13, 2026

- Every issue from `model.issues` now says whether it **blocks** and who must fix it (`source: 'form'` or `'admin'`); new `model.blockers` and `model.firstBlocked`. Advice never blocks: fewer than 18 weeks, a CLO not covered by any ILO, fewer than 3 exam rows
- Blocking: an empty program, subject, prerequisite, units or description; no lesson with an ILO, a blank week, an ILO without a CLO tag or an unresolved tag; fewer than 3 requirements; an empty reference group; no grading components, a total other than 100 or an empty override; and, as admin data in step 2, a missing vision, mission, program EGAs or POs, a subject without CLOs, or a CLO without a statement or EGA/PO tag (or tagged with one that no longer exists)
- Builder: **Next** is disabled while the step has a blocker, with a "To continue:" list; admin items read "...has not been added yet. Please ask your administrator." with a **Check again** button; the stepper blocks jumping forward past the first incomplete step (going back is always allowed); blockers are recomputed live, so a step locks again if an admin removes data. A step counts as done when nothing blocks it, and Check with AI and Submit unlock once steps 1 to 6 have no blockers. Read-only syllabi are never gated
- `POST /api/syllabi/:id/submit` returns 409 when the vision, mission, the program's EGAs or POs, or the subject's CLOs are missing (`lib/catalogReady.js`)
- Admins: the Subjects & CLOs list shows a **Setup incomplete** badge (hover for what is missing; `GET /api/courses` adds `gaps` for admins only), and the subject modal lists what faculty are waiting for

**Notes:**
- In the current database several subjects have no learning outcomes yet, so faculty working on them are held at step 2 until an admin adds them
- `npm test` runs 105 tests

---

### v1.25.0 — Compliance Check Merged Into the Syllabus Builder
**By:** JP Del Rosario  
**Date:** October 14, 2026

**Standard and rules:**
- The Undergraduate Syllabus v4 form is data: `server/lib/compliance/standard-v4.json` holds 47 rules (`id`, `area`, `step`, `severity` blocking / major / minor, `weight`, `check`, `params`, `message`, `fix`), sections I–X, the six Learning Plan columns, six areas (Format Compliance 20, Content Completeness 20, CO–PO Alignment 20, Assessment Alignment 15, Contact Hours 10, Reference Currency 15) and a pass line of 79. What the IT 204 sample syllabus does not state (weights, pass line, 18 weeks, 1 lecture unit = 1 hour and 1 lab unit = 3 hours a week, 10-year reference age) is listed under `assumptions` for the curriculum office to confirm
- Pure rule engine `server/lib/compliance/rules.js` (19 check kinds) with a browser copy `src/lib/complianceRules.js` and a parity test that runs both on the same fixtures. A rule's score is the share of its items that pass, an area is the weighted mean of its rules, the overall the weighted mean of the areas. A nearly empty syllabus reports **not enough content**, never 0%. Reference age is measured from the school year (`SCHOOL_YEAR_START`, default 2026), never from the clock, so the same content always scores the same
- Blocking rules: required fields, tags that resolve, an ILO without a CLO tag, grading that does not total 100, fewer than 3 requirements, an empty reference group, CLOs without EGA or PO tags, and the vision, mission, EGAs and POs of a submitted syllabus differing from the catalog. Everything else only warns

**Gate and storage:**
- `POST /api/syllabi/:id/submit` returns 409 with `failed: [{ id, ruleId, step, path, message }]` when a blocking rule fails; warnings never block (the builder offers **Submit anyway**)
- The run is stored with the version in the same transaction (`ai_check_runs`, `ai_check_area_scores`, `ai_findings`); until the migration is run, submit still works and nothing is stored
- Recommendations: `AiProvider` interface, `MockProvider`, and an `LlmProvider` stub that is never called. Output must cite real findings, is capped at 7, its priority is the area score gap × weight (never the model's), and a failing provider falls back to rule-based text. The AI step runs as a background job after the commit. Names, emails and phone numbers are masked and the sign-off is never sent. `COMPLIANCE_AI_PROVIDER=mock|llm` selects the provider; unset means a plain **Rule-based check**

**Routes:**
- `GET /api/syllabi/:id/compliance` (latest stored run with a `stale` flag), `POST /api/syllabi/:id/compliance/recheck` (the owner on the saved draft, an administrator on the latest submitted version, stored with that version; an unchanged syllabus returns its stored run; 10 new runs a minute per user) and `GET /api/compliance?syllabus=all|<id>` (admins see every submitted syllabus, faculty their own, each with faculty member, program and subject)
- Administrators read the run stored with the submitted version, not a check the author ran afterwards, and are not told it is out of date by edits in progress

**Screens:**
- Builder step 7 is now **Review & Check**: a compliance card (ring, six areas, what blocks a submit, recommendations marked Rule or AI, the findings behind them, a stale badge, an **AI unavailable** state), a check that runs when the step opens, and an in-place **Re-check**; nothing navigates to another tab
- Faculty no longer have an AI Checker tab; an old `ai` link sends them to the builder. For administrators it is a read-only overview: the average and per-area averages, and every submitted syllabus listed by faculty member, then program, then subject, with **Check**, **Re-check** and **Check unchecked** and a search. Syllabi submitted as an uploaded file have no builder form and show as **Uploaded file**
- The same card is shared by the builder, the admin overview and Review & Approval

**Notes:**
- Run `npm run migrate-compliance` (in `server/`) before using it; it is idempotent and touches no data
- Not built: a real language model (the provider is a stub), a delete for stored runs

---

### v1.26.0 — Review & Approval Board, Syllabus Window and Reviewer Comments
**By:** JP Del Rosario  
**Date:** October 14, 2026

**Review & Approval:**
- The page is a board of cards, one for each syllabus waiting for a decision. A card shows only the program, the subject and who submitted it; the program decides its color. A search finds a syllabus by faculty member, program or subject
- Clicking a card opens a window with the submitted syllabus in the same table format as builder step 7 (a version picker opens earlier versions; an uploaded file shows an Open link), a Compliance Check tab, and a panel beside it with **Decision**, **Comments** and **Messages** tabs. The panel stacks under the syllabus on narrow screens
- Decisions keep the existing `handleStatus`; each asks for a second click to confirm, and returning for revision or rejecting needs a written reason of at least 5 characters (checked in the panel and by the server). When a decision goes through the window closes

**Comments:**
- `GET` and `POST /api/syllabi/:id/comments` use the existing `comments` table (no migration): an administrator writes, the owner reads, everyone else gets 404, and the faculty member is notified. The reason given with a decision is saved as a typed comment (revision, rejection, approval) in the same transaction as the status change
- Messages and comments are separate: messages are the two-way chat, comments are the reviewer's notes. The chat thread was extracted from `ChatModal` into a shared `ChatThread`

**Server:**
- `GET /api/syllabi/:id/review[?version=]` is a read-only view of the submitted version, with who wrote it and for which program and subject; a version that is not the syllabus's own is 404. The syllabus list gains `programCode` and `courseTitle` as new fields. Program and subject naming moved into `server/lib/syllabusLabels.js`, shared with the compliance routes

**Windows:**
- A modal stack (`src/lib/modalStack.js`, `useModalLayer`) fixes Revision History opening behind the syllabus window: the newest modal is on top, the ones beneath are inert, Esc closes only the top one (not while text is typed in a field), Tab stays inside it, focus returns to what opened it, and the page does not scroll until the last one closes. The confirm popup is above all of them
- The form's table styling now also applies inside the window, so it looks exactly like step 7

**Notes:**
- The old summary, tabs and workflow card on the page are gone; their actions live in the window's panel

---

### v1.27.0 — Faculty Comments With Unread Tracking
**By:** JP Del Rosario  
**Date:** October 14, 2026

- Faculty have a **Comments** button on each My Syllabi card, beside Message and History: a red number for new comments, a grey total when none are new. It opens a read-only window with the thread, **New** markers and **Reply by message** (replies go through the chat). The yellow decision note on the card opens it too
- A comment or decision notification now opens that syllabus's comments directly (`notificationTarget`), and reading them settles the matching bell notifications
- `GET /api/syllabi/comment-summary` and `POST /api/syllabi/:id/comments/read` (owner only, only ever moves forward); `GET /:id/comments` also returns `lastReadId`
- New table `comment_reads` (`server/db/comment-reads-ddl.js`, also in `schema.sql`) remembers the last comment each faculty member has read

**Notes:**
- Run `npm run migrate-comment-reads` (in `server/`) for exact unread counts. Until then faculty still see their comments and the button shows the total instead

---

### v1.28.0 — Interface Polish: Background, Dashboard Icons and Typeface
**By:** JP Del Rosario  
**Date:** October 14, 2026

- **Background:** the page background is `#f8faf9` (the `--bg` variable, now also used by the review and comments windows) and the review board cards use the same color, flat; their colored top bar, border and program pill still set them apart. The sidebar is untouched (all 19 sidebar rules are identical to the previous commit)
- **Dashboard icons** are black (`--icon-black`) and use the solid icon weight; the tinted tiles behind them keep their colors. Only the stat tiles and the quick actions are affected
- **Typeface:** `--font-body` and `--font-display` are `"SF Pro Rounded", ui-rounded, "Nunito", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`. Nunito (a rounded font, SIL Open Font License) is hosted in `public/fonts` with its license so Windows, Android and Chrome on Mac get a rounded font too, while Safari and iPhone keep SF Pro Rounded. The Inter and Manrope files are kept but no longer used; the printed syllabus form stays Arial

**Notes:**
- `npm test` runs 242 tests
- To set up a copy of this branch: run `npm run migrate-compliance` and `npm run migrate-comment-reads` in `server/` (both optional features degrade gracefully until then), set `COMPLIANCE_AI_PROVIDER=mock` to see AI-labelled recommendations in development, and restart the API server

---

### v1.29.0 — Student Registration From the COR, Upload a File Tab, Logos
**By:** Raymond  
**Date:** October 14, 2026

**Student registration (verified from the Certificate of Registration):**
- Register (for Students) asks for a photo of the COR and a password. The student ID read from the COR is the username; it can be typed with or without its dashes (`244233624` = `24-4233-624`)
- The server reads the photo with OCR (`tesseract.js`, `sharp`) and parses the student ID, name, program, year level, section, term and school year, and the enrolled subjects when the table is readable (`server/lib/corOcr.js`, `corParser.js`). A photo that is sideways or upside down is turned upright by reading it in each direction and keeping the one that yields the most usable fields
- A read-only **Is this your COR?** window shows what was read. Nothing in it can be edited; the client only ever sends the password, and the student ID, name and program come from the server's own scan. The student confirms, retakes the photo or closes the window (Esc and the ✕ button)
- **Verified automatically** when the program reads as Information Technology (or a BSIT section is on the subject rows), the name and the term are readable. Anything doubtful becomes **pending** instead of being rejected, with the COR kept privately (`server/private/cor`) for an administrator; a verified student's photo is deleted and only the extracted fields are kept
- New `student` role, plus `student_profiles` and `student_enrollments` (enrolled subjects, linked to the course catalog when the code or title matches). Students can sign in only when verified; pending and rejected students get a clear message
- Students are shut out of every API except `/api/auth` and `/api/students`. A signed-in student sees a simple home page with their profile and enrolled subjects
- Admin endpoints for the pending queue exist (`GET /api/students/pending`, `GET /:id/cor`, `POST /:id/verify`); the review page for them is not built yet
- 15 scans per address per hour; photos up to 10MB (JPG, PNG or WebP)

**Syllabus builder: Upload a file instead:**
- Two tabs above the editor: **Fill in the form** and **Upload a file instead**. The editor slides out and the upload tab slides in (no animation with reduced motion). The form draft and the current step are kept when switching
- The upload tab takes a PDF (up to 10MB), shows a preview before anything is sent, and submits it as the syllabus with an optional note for the reviewer. It needs the subject chosen in step 1 first
- **Syllabus files are PDF only** (server and both builders). A rejected upload now returns a readable JSON message instead of an HTML error page
- A draft submitted as a file is `v1.0` (it was `v1.1`), is logged as an upload, and notifies the administrators
- The review window shows an uploaded PDF inline, not just a link

**Interface:**
- The syllabus header shows the LCUP logo on the left and the Testmark logo on the right, beside the school name (`public/lcup-logo.png`, `testmark-logo.png`, resized from `sample_syllabus`). It is in the shared `FormPaper`, so the builder's review step and the reviewer's window both get it
- **Esc** closes every modal. The delete-confirm popup and the COR window were the two that did not
- Removed the "Waiting for your decision" line from the Decision tab of Review & Approval

**Fixes:**
- A missing `JWT_SECRET` made Google sign-in and login return 500; `server/.env.example` now lists `GOOGLE_CLIENT_ID` and `JWT_SECRET`
- Merge leftovers after PR #4: duplicate imports in `App.jsx` and conflict markers in `styles.css`

**Notes:**
- In `server/`: `npm install`, then `npm run migrate-students` (and run the earlier migrations first on an older database: `migrate-builder`, `migrate-assignments`, `migrate-program-egas`, `migrate-syllabus-versions`, `migrate-notifications`), then restart the API server
- To try the COR reader on its own, run `node scripts/ocr-cor-test.js [image]` in `server/`; it prints what is read from the images in `server/sample_cor/` (git-ignored; it holds real student data)
- OCR cannot read the subject table on small or tilted photos, so subjects are best-effort and never decide a registration. A COR that cannot be confirmed goes to an administrator
- `server/uploads/` is still served publicly; uploaded PDFs have unguessable names, but are not yet behind a permission check

---

### v1.30.0 — Typography Tokens and a Redesigned AI Checker
**By:** JP Del Rosario
**Date:** October 14, 2026

**Typography (CSS only):**
- Added font-weight (`--fw-*`) and letter-spacing (`--tracking-label`) tokens; shared primitives, page blocks and chips use them (no value change), and a clear type hierarchy applies to cards, tables and headings
- Removed the duplicate `@font-face` blocks and the unused Inter and Manrope fonts

**AI Checker (admin):**
- The page is now a **picker plus a result dialog**: **SyllabusPicker** (Faculty, then Program, then Subject) and **ComplianceModal** (one stored check, with its date and time). The overview, bulk check and tree were removed
- A syllabus is **checked once**. After the administrator's check it leaves the queue and goes to the **history**, one card per syllabus showing its latest check; clicking a card opens the exact stored scoring. Approved syllabi are locked and cannot be checked again
- **Date filter** on the history (from inclusive, to exclusive; an open end is allowed). It is remembered until the administrator changes it or goes back to all dates
- The queue offers only syllabi that still need a check (`needsCheck`, `canCheckNow`); the picker card fills the page width
- Server: `GET` history with a date range and a single-run read; approved syllabi cannot be re-checked
- The page scrollbar's space is reserved (`scrollbar-gutter: stable`) so the layout no longer jumps when a page gets long

**Notes:**
- No migration needed for this version

---

### v1.31.0 — Generated Passwords, Email and Forgot Password
**By:** JP Del Rosario
**Date:** October 14, 2026

**Registering users:**
- Adding a user no longer asks for a password: the system **generates one and emails it** (with the username) to the registered address. **Resend credentials** is on each user in Users & Roles
- Resend sends the email **first** and saves the new password only if it was sent, so a failed email never locks anyone out
- Only institutional addresses (**@email.lcup.edu.ph**) can be registered; the domain is checked on the server
- When an email cannot be sent, the administrator is told why (sign-in refused, server unreachable, other)

**Signing in:**
- A generated password is **temporary**: the first sign-in forces a **change-password** screen, and nothing else in the app opens until it is changed (the API answers `403 password_change_required`)
- **Forgot password** on the login page emails a 30-minute temporary password. It is kept separate (`password_temp`), so asking for one never locks out the real password
- Passwords are generated and validated by one module with tests

**Mail:**
- Sent with `nodemailer` over SMTP (Gmail app password works). It never throws into a request, and the server warns at startup when no mail settings exist

**Notes:**
- In `server/`: `npm run migrate-passwords` (adds `must_change_password` and `password_temp`)
- Fill `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` and `MAIL_FROM` in `server/.env` (see `.env.example`); with `SMTP_HOST` empty nothing is sent
- The demo accounts (`admin123` / `faculty123`) should be removed or given new passwords before real use

---

### v1.32.0 — Staged Review: AI Check First, Then the Administrator Decides
**By:** JP Del Rosario
**Date:** October 14, 2026

**The flow:**
- A faculty member **submits**, and the syllabus is **locked** (no editing) until the administrator returns it for revision. The builder and the My Syllabi card explain why (dimmed Edit and the reason)
- The administrator **checks it in the AI Checker first**; only a syllabus the administrator has checked appears in **Review & Approval**, where the decision (approve, revision, reject) is made. The AI never approves anything
- Review & Approval no longer has a compliance tab. A new version goes back to the checker queue
- Only an **administrator's own check** counts as the administrator's check

**Uploaded files:**
- An uploaded PDF is **checked by the rules** like any syllabus (template matching is skipped until the corrected template and the AI key exist) and is labelled as an upload in Review & Approval
- The review window's side panel keeps one size on every tab

**Notes:**
- AI template matching for uploaded files is deferred to the final stage

---

### v1.33.0 — Version Rules and Version History
**By:** JP Del Rosario
**Date:** October 14, 2026

- **A version is saved only when the faculty member changed something**, and a **note is required** (at least 10 characters). Saving with no change says so and creates nothing
- A syllabus returned for revision must change; the check of a new version is per version, so an unchanged or reverted syllabus never reuses an older version's check
- The version history says **what changed** (by section, with word counts) and **what was decided** on each version, names the check of each version, and each version can be **opened and read**
- Server: `versionChange` module (`changedSections`, `describeChanges`, `wordDelta`) with tests

---

### v1.34.0 — Philippine Time, Renames and Cleanups
**By:** JP Del Rosario
**Date:** October 14, 2026

- **Every date and time is shown in Philippine time (Asia/Manila)**, in one module (`phTime.js`); times stored without a zone are read as Philippine time
- **Subjects & CLOs** is now **Program & Subjects**
- The **Version** column is removed from the repository table (the version history is beside it)
- The step 7 **Re-check** button in the builder stays on one line
- The unread number on the topbar icons is centered, larger and readable (the Messages icon's label says how many are unread; counts above 99 show `99+`)

---

### v1.35.0 — Chat Shows Who You Are Talking To
**By:** JP Del Rosario
**Date:** October 14, 2026

- A conversation shows **who it is with from the first message**: real name, picture and role; a faculty member also shows program and subject, an administrator shows only the role. Role chip and subject line in the chat header and the message list
- Server: `GET /api/messages/partners` names who each conversation is with
- A faculty member can see the **picture of the administrator** they would message before any message is sent (narrow permission: only for a faculty member who owns a submitted syllabus)
- A **draft has no conversation**: no Message button on drafts, and the chat window explains why if it is opened on one
- Fix: an administrator in a chat no longer shows the faculty member's program and subject

---

### v1.36.0 — Dashboard: Recent Activity Is Your Own
**By:** JP Del Rosario
**Date:** October 14, 2026

**Recent Activity:**
- A timeline of sentences replaces the dots and pills: an icon tile (colored for decisions, grey for routine events), "**You approved FM 202**" with the course title beneath, the time on the right, grouped under **Today / Yesterday / a date**, in Philippine time (`activityView.js`, tested)
- **Each account sees only its own activity.** `GET /api/logs` returns only the signed-in user's rows (up to 30), so no browser receives what someone else did. The dashboard reads it again each time it is opened
- Empty states say what will appear. **Clear Logs** hides what was done up to now for that account, remembered per account, and deletes nothing
- Fix: a first submission from the builder was logged as an upload; it is now logged as a submission (older rows are read correctly too)

**Layout:**
- The dashboard rows have a **fixed height** (320px and 250px) and the body of each card scrolls, so a long activity list never resizes its box or the others. The shared `Card` now wraps its content in a `card-body`
- An earlier attempt (boxes at their own height) was reverted in favor of this

**Notes:**
- Restart the server after pulling. `npm test` now runs 352 tests


---

### v1.37.0 — Account Settings, Localization, Catalog Management and Administrator Authoring
**Date:** October 15, 2026

**Settings and Google Workspace photo sync:**
- Shared faculty/admin profile settings place Edit Profile and Save Profile beside the profile name, using consistent system buttons and responsive layout.
- Faculty Settings contains profile and language preferences. Institutional Standard and AI & Notifications are administrator-only; GET/PUT /api/settings enforce administrator authorization.
- The profile menu starts Google Workspace photo access directly, replacing the expanding inline verification panel. Access tokens remain in memory, pending requests are shared, and cancelled/failed imports keep the current photo. Google may still require its own account/consent popup.
- The server verifies the Google account and imports the authenticated user's photo without accepting another account's identity.

**English and Tagalog:**
- Added centralized dictionaries, stable keys, interpolation, English fallback, and locale-aware formatting in Philippine time. Interface labels across both roles include navigation, forms, dialogs, validation, notifications, loading/empty states, and generated report headings.
- Language changes apply immediately, persist to the authenticated account, and restore on sign-in/refresh. Existing accounts default to English. Failed preference saves visibly roll back; stale responses cannot change another account's language.
- Language changes use a short presentation transition without remounting editors or resetting focus; reduced motion, logout, and account changes cancel motion appropriately.
- Shared buttons reserve space for both language labels. Sidebar collapse, navigation labels, topbar slots, and dashboard grids retain stable geometry with longer Tagalog labels.
- Academic content, stored program/subject names, messages, reviewer notes, uploaded files, and the official syllabus document retain their original text. Arbitrary free-text AI output and unknown third-party/server messages use source-language fallback.

**Program and subject management:**
- Administrators can rename program names and codes while keeping numeric IDs, subject relationships, and faculty assignments stable. Historical name/code aliases preserve older references; submitted snapshots remain unchanged.
- Program deletion previews subjects, syllabi, versions, assignments, and files, including approved syllabi. Stage one requires an acknowledgement checkbox before Delete Program; stage two requires the exact code and final acknowledgement. Preview tokens, administrator authorization, expiry, impact checks, and transaction locks are enforced server-side.
- Cascading deletion retains unrelated programs and accounts. Uploaded PDF cleanup runs only after commit, checks remaining references and storage boundaries, and retries failures through a persistent cleanup queue.
- Program dialogs, count alignment, add-subject cancellation, and row movement use coordinated motion and cleanup to avoid flashes and closing glitches. Reduced-motion preferences are respected.
- Faculty still need an assigned subject inside an assigned program; program-only assignment cannot create a syllabus.

**Subject-specific learning-outcome setup:**
- Each subject stores separate vision, mission, EGA and PO values in courses.standards_json; CLOs remain in course_clos with stable IDs. Newly created subjects start with blank setup rather than inheriting unrelated defaults.
- Additive migration copies existing setup into independent subject records. Section version checks reject stale saves and prevent removal of referenced outcomes.
- Learning Outcomes and preview content require program and subject selection and complete subject setup. Catalog edits never rewrite previously saved submission snapshots.

**Administrator syllabus workflow and version history:**
- Admin My Syllabi stores personal drafts; other users' drafts remain private. Administrators may navigate builder steps in any order, but the server requires a complete form before handoff to AI Checker.
- Removed the embedded AI checker from the administrator builder and the My checked drafts card from AI Checker. Incomplete admin drafts cannot be checked or published.
- Save and continue hands a completed admin syllabus to the AI Checker tab in under_review status. An AI check does not approve it automatically: the owner explicitly chooses Approve & Add to Repository or Edit Syllabus.
- Returning to edit restores draft status and removes the item from the checker queue. A server-managed review cycle invalidates earlier checks; pending, failed, stale, mismatched, or another administrator's checks cannot approve the current revision.
- Completed administrator revisions are preserved as immutable version snapshots. A changed form handed back to AI Checker gets the next version; autosaves, unchanged forms and approval do not create duplicate content versions. Older completed records are snapshotted before returning to draft for editing.
- Admin My Syllabi hides faculty-only Comments, reviewer-feedback banners, Message and unread badges. History remains available, including while editing a returned draft.

**Repository and messaging:**
- Faculty and administrator Repository use the same table/filter layout, show approved syllabi only, and omit the redundant status filter. Program cells and filters use current catalog labels with legacy fallbacks.
- Shared chat eligibility, Repository actions, message dropdown filtering and chat guards prevent administrators from messaging themselves about their own syllabi. The API rejects those threads, omits self-partners and hides historical self-messages from the message list.
- Bidirectional administrator/faculty messaging on faculty-owned submitted syllabi remains available. Version History remains independent of messaging.

**Scrolling:**
- Sidebar, Quick Actions and Upcoming Deadlines hide scrollbar tracks while preserving native overflow scrolling. The two dashboard panels are keyboard-focusable, labelled regions with visible focus.
- Scoped native scroll-behavior: smooth applies to these areas, with an automatic reduced-motion fallback. Mouse-wheel and touch motion remain browser-controlled; no global wheel interception was introduced.

**Validation and deployment:**
- Current automated verification: 459 passing tests (414 domain/API/motion checks, 22 localization/preference checks and 23 rendered UI checks). Translation audit passes with 1,602 bilingual keys. Production build passes with the existing large-bundle warning.
- Live localhost:5173 checks confirmed the app entry and transformed/direct stylesheet return HTTP 200 after the scrolling update. This does not constitute visual browser verification.
- An explicit local BSFM administrator workflow test completed the form, saved it and verified handoff/checker availability without running an AI check or approving it. This was API/MySQL verification, not browser form filling; the local demonstration record is not a production seed.
- Before starting the updated API on an existing database, run from server/: npm run migrate-preferences, npm run migrate-program-management, and npm run migrate-subject-standards. Earlier migrations remain prerequisites for older installations. Restart the API after deployment; server development mode uses Node watch mode.
- Architecture and migration details are in docs/localization.md, docs/program-management.md and docs/admin-authoring-and-subject-standards.md.

**Planned work, not implemented:**
- Program-wide submission deadlines scoped to school year and semester, assignment-aware progress, and faculty notifications/reminders are planned only. Upcoming Deadlines still contains fixed sample entries; no deadline API, persistence or scheduler exists yet.
- docs/claude-program-deadlines-ui.md contains the UI-first Claude handoff for System-Improvement. It requires isolated mock data and preserves the existing system architecture; it does not authorize real deadline delivery or backend work.

---

### v1.38.0 — Brand Theme, Time Usage, Profile Picture Sync, Custom Dropdowns and Dashboard Redesign
**Date:** October 16, 2026

**Brand theme and density (src/theme.css):**
- Added src/theme.css, imported after styles.css, as a separate layer: removing the one import line in main.jsx switches the redesign off. It re-values the existing design tokens (--blue, --gold, --bg, --line, --text, --muted and others) so components needed no changes.
- Palette taken from the two logos in /public: cobalt blue, deep navy, gold, copper and crimson, plus one added forest green for approved and success. Page background is rgb(248, 250, 249); card, table and divider borders are a light neutral gray; the topbar uses the page background.
- Sidebar uses a gradient from the logo's cobalt at the top to deep navy, with a gold marker and gold icon on the active item. Menu text stays at 4.5:1 or better on every stop.
- Tighter type scale (12 / 13 / 13 / 15 / 17 / 22 px) and smaller boxes: stat cards, dashboard rows, topbar, sidebar width and nav items, page and card padding.
- Text hierarchy: near-black headings (--ink), dark body text, and a lighter gray (--muted, still 4.5:1) for secondary text. Card h3 headings and stat card titles share one size token (--title-size) and weight 800; stat numbers use weight 600.
- Buttons, inputs, tables, tabs and the Log out button (light red on hover, solid red while pressed) use the brand colors. 132 leftover hard-coded cool-gray and old-blue colors in styles.css were replaced with brand equivalents; the printed syllabus paper, print rules and the dark-theme block were left as they were.
- Scrollbars are hidden everywhere (scrollbar-width: none with !important, so per-element thin scrollbars no longer show). Wheel, touch and keyboard scrolling are unchanged.
- The old black-icon test was rewritten for the new icon colors; new brandTheme tests check text, badge, tint, sidebar-gradient and chart contrast, that the theme sets no typeface, and that the type scale only grows with 12px as its floor.

**Dashboard:**
- Stat cards: a large number, a title in sentence case (new sentenceCase helper that keeps acronyms such as AI; works on translated labels), and the icon on a 28px tile with the sidebar gradient, white icon, level with the title. The colored left strip and the gold tick before card titles were removed.
- Administrator dashboard has its own five cards: Programs, Subjects, Under Review (submitted and under-review faculty syllabi), Approved and For Revision. Programs and Subjects are counted from the existing /programs and /courses calls; the syllabus cards update with the existing refresh. The AI compliance, Total Courses and Submitted Syllabi cards were removed for administrators; faculty keep their own five cards.
- Five custom SVG icons (program, subject, under review, approved, revise) were added in components/customIcons.jsx and registered in the Icon registry, drawn in currentColor.
- Quick Actions: the icon lines up with the title however many lines the description takes, the arrow stays centered, the height follows the text (the fixed 86px minimum and the reserved second-language copy are gone in this card), and words break only when they cannot fit.
- The Submission Status donut card and its code were removed. Donut and Legend remain for Analytics.

**Time Usage card (replaces Submission Status):**
- New usage_daily table (one row per user per Philippine day) and POST /api/usage/heartbeat and GET /api/usage/summary?days=7|30; no existing endpoint changed. Each user reads and adds only their own time; student accounts are never tracked.
- The browser sends a heartbeat every 30 seconds only while the tab is visible and there was input in the last 5 minutes (src/lib/activity.js, useActiveTime.js). The server credits the time since that user's previous beat (capped at 90 seconds, per user so two tabs count once, 120-second silence starts a new session, beats under 10 seconds apart ignored), keeps it in memory, and writes every user in one batched statement about once a minute and at shutdown. A crash loses at most the last minute.
- The card shows today's active time, a 7/30-day bar chart (today highlighted), average session, active days and busiest day, with empty, loading, error and not-set-up states in English and Tagalog.
- Kill switch: USAGE_TRACKING=off in server/.env. Until the migration has run the endpoints answer enabled: false and the card says tracking is not set up. Details in docs/time-usage.md.

**Profile pictures stay in sync:**
- New avatar store (src/lib/avatarStore.js): every picture of a user reads the newest known photo, compared by upload time, so a new or removed photo shows at once in the topbar, Settings, Repository, Review board, syllabus dialog, chat header and message list. A stale list response cannot undo a newer upload.
- Avatar accepts an optional userId (otherwise read from the URL). The chat partner now carries the user id. The syllabus list and message partners are read into the store each time they load, and refreshed every 60 seconds while the tab is visible and when it becomes visible again, so other people's changes appear without a reload.
- The Compliance tab shows each faculty member's photo (or initials) with the shared Avatar, and groups cards by account instead of by name, so two people with the same name are no longer merged.

**Custom dropdowns:**
- New Select component (components/Select.jsx) replaces all 20 native selects in 14 files with the same props and option children; onChange still receives event.target.value as a string. The open list is a rounded panel with hover, a check on the chosen option, disabled options, opening upward when there is no room and rendering above modals.
- Keyboard and accessibility: combobox button with a listbox, aria-activedescendant, Up/Down/Home/End/PageUp/PageDown, Enter or Space, Escape closes only the list (not the dialog around it), Tab leaves, type-ahead on short lists and filter-as-you-type with a hint on lists longer than 10. Touch screens keep the native picker. Widths set for the old tag selectors were carried over in the theme.
- Option reading and the keyboard/filter rules are unit-tested (selectModel.test.js); five existing UI tests were updated to the new markup while still checking each option's stored value and language.

**AI Checker and Subjects and Programs:**
- Check History is a compact list: one row per check with a colored score circle, course, faculty, status and checked-by tags, date and a chevron, replacing the tall cards with a colored left stripe; below 640px the row wraps to two lines. The markup, spoken labels, filter and Show more are unchanged.
- Status tags are small rounded labels with an icon (check, up arrow, clock, circular arrow, x, dashed circle): Approved and Rejected are solid, the working states are light with a matching border. Fixed a bug where Under Review and For Revision tags had no color on My Syllabi, Check History, the syllabus picker and the builder, because those screens pass under_review and for_revision while the CSS only styled the hyphenated names; both spellings are styled now.
- Program Management: Rename and Delete are icon buttons (pencil and trash, blue and red with 2px borders) centered under a centered Actions header.
- The Subjects table toolbar label now reads Subjects by program (English and Tagalog), with the same size and weight as the stat titles, and the toolbar no longer adds its own padding so the label lines up with the Programs title.

**Validation and deployment:**
- Current automated verification: 539 passing tests (484 domain/API/helper checks, 22 localization/preference checks and 33 rendered UI checks), including the new server tests for time counting and the usage routes. The translation audit passes. Production build passes.
- No visual browser verification was performed for these changes, and the open dropdown list, the Time Usage chart and heartbeat against a live database were not exercised in a browser; the project has no browser test tooling.
- Before using Time Usage on an existing database, run from server/: npm run migrate-usage, then restart the API. Fresh installs get the table from schema.sql.

---

### v1.39.0 — Subject Deadlines, Subject Actions in the Table and Subject Modal Updates
**Date:** October 16, 2026

**Subject deadlines (docs/deadlines.md):**
- An administrator sets a submission deadline for a subject and term (school year and semester chosen from lists, due date and time in Philippine Time, optional instructions). It applies to every faculty member assigned to the subject, each against their own submission; a person assigned later has it too. Late submissions stay allowed and nothing about permissions, the builder, the AI check or approval changed.
- A requirement is worked out each time, never stored: Upcoming, Due today, Failed to submit (past due, nothing submitted), Submitted, or Submitted late. A submission is the first non-draft version the faculty member saved for that subject at or after the deadline's start date (the moment it was set by default), so last term's syllabus does not satisfy this term. A subject nobody is assigned to shows as "no faculty assigned", not as failures.
- New tables subject_deadlines and deadline_notices, and new routes under /api/deadlines (list, set, change, cancel, progress, remind, and a faculty member's own). Times are TIMESTAMPs read as epoch seconds, so the database server's time zone cannot shift a deadline. Until npm run migrate-deadlines has run, the routes answer enabled: false and the screens stay as they were.
- Subjects and Programs gets a Deadline column: a chip with the due date and how many have submitted (red if someone failed to submit, green when all have). Clicking it opens a dialog to set, change or cancel the deadline and to see each assigned faculty member's status.
- The dashboard's Upcoming Deadlines card shows real deadlines instead of fixed sample entries, most urgent first: a faculty member's own status per subject, the administrator's submitted and failed counts. My Syllabi cards show the deadline of their subject and its status.
- Faculty who have not submitted are told on the notification bell and by email when a deadline is set, changed or cancelled, when the administrator presses Remind (per person or everyone; once per person every 6 hours), and automatically when it is due within 3 days, due today, and missed. Each automatic notice is sent once per person and deadline, and moving the due time starts them over. Emails follow the Email notifications setting and use the existing SMTP settings; the bell always works. A failed notice never undoes the save. DEADLINE_NOTICES=off turns notices off; the automatic check runs in the API process every 15 minutes.
- New status tags for the deadline states, a new email type (never carries a password), and a notification type that opens My Syllabi (faculty) or Subjects and Programs (administrator).
- Not built: a deadline banner inside the syllabus builder, and choosing a deadline while creating a subject.

**Subject management:**
- Edit and delete a subject moved from the Subject Details card in the subject modal to a last Actions column in the Subjects table (pencil and trash, with edit and delete dialogs built like the Programs ones). The Subject Details card is gone from the modal; Vision and Mission takes the full width.
- The Programs and Subjects tables share one Actions column definition: the same width, left-aligned header and icons, so the two columns line up.
- Subject modal: the title in the dark header is white again (the theme's heading color had reached it, and the Assignments modal header); Course Learning Outcomes sits below the Expected Graduate Attributes and Program Outcomes row; cards in a row share one height; card titles capitalize each word.
- The five dashboard icon SVGs are kept in docs/icons with a README (the app reads the copies in customIcons.jsx, not these files).

**Validation and deployment:**
- Current automated verification: 614 passing tests (551 domain/API/helper checks, 22 localization/preference checks and 41 rendered UI checks), including new tests for the deadline rules, the notices and their timing, the routes, and the screens in both languages. The translation audit passes. Production build passes.
- No visual browser verification was performed, and no email was sent through a real SMTP server: the notices are tested with a fake bell and a fake mailer.
- Before using deadlines on an existing database, run from server/: npm run migrate-deadlines, then restart the API. Fresh installs get the tables from schema.sql.


### Unreleased — Remove CO–PO Mapping Page
**Date:** October 16, 2026

- Removed the CO–PO Mapping page and its sidebar item for faculty and administrators, the dashboard Curriculum Mapping shortcut, and the login feature label.
- Removed the dedicated view, matrix demo data, mapping API client, Express route/mount, mapping-only metric component, styles and unused bilingual strings. Removed the legacy mapping table definition from the fresh-install schema and its active API documentation.
- Existing database mapping records were not dropped. Subject CLO/PO relationships, learning-plan alignment, printed syllabus content and AI compliance rules remain available to their existing workflows.
- Added rendered regressions for faculty/admin navigation, dashboard shortcuts and login labels in English and Tagalog.
- Validation: domain/API regressions, English/Tagalog rendered UI checks, localization audit and production build pass.

---

### v1.40.0 — Settled Deadlines
**Date:** October 16, 2026

- A deadline is now settled automatically when every faculty member assigned to the subject has submitted (on time or late). The chip and the dashboard row say Settled, the dialog explains it, and the API returns `settled`.
- It is computed from the progress numbers, so nothing is stored or migrated; a faculty member assigned later reopens it by themselves. Cancel stays for deadlines set by mistake.
- Validation: rule, API and rendered UI tests (English/Tagalog), and the production build pass.

---

### v1.41.0 — One Subject, One Faculty Member
**Date:** October 16, 2026

- A subject can now be assigned to only one faculty member. Programs can still be assigned to many.
- The Assignments screen shows a subject held by another faculty member as disabled with the holder's name; the administrator removes it from them first. Select all skips those subjects.
- The server refuses a save that would take a held subject (409 `subject_taken`, naming the subject and holder) and changes nothing; a new `GET /api/users/subject-holders` feeds the screen.
- New unique key `unique_course_owner` on `faculty_courses.course_id` (schema.sql and `npm run migrate-subject-owner`, which stops and lists any subject that is still shared, and changes no data), so two administrators saving at once cannot both take a subject.
- Validation: library, API, concurrency and migration dry-run checks, and the production build pass.

---

### v1.42.0 — Reminder Button and Toast
**Date:** October 16, 2026

- The deadline dialog's "Remind everyone pending" button is now called **Reminder** (**Paalala** in Tagalog). It still reminds only the faculty on that one subject's deadline who have not submitted.
- Clicking Reminder, or the bell next to a faculty member, now shows a toast: "Reminder sent to Fay Cruz.", "Reminder sent to 3 faculty.", or why nobody was reminded (already reminded recently, already submitted, or nobody needs one). The toast shows above the open dialog, in English and Tagalog.
- Validation: toast wording rules covered by tests, and the production build passes.

---

### v1.43.0 — Review & Approval Matches the System's Cards, Buttons and Page Action
**Date:** October 16, 2026

**Board cards:**
- A card is now the same tile as the dashboard stat cards: white surface, 1px line, 12px radius, the shared shadow, a 35px avatar chip on the left, the program as an uppercase muted label in the brand blue, the subject as a bold black title, and the faculty member as a small muted note. The program colour stays on the chip. The coloured top bar, the dashed divider, the 18px radius and the avatar ring are gone.
- Hover deepens the shadow, as on every other card; the corner arrow is always faintly visible and fully visible on hover or keyboard focus.

**Review window and decision panel:**
- The window header no longer has the coloured strip along its top or a coloured ring around the avatar; the title is black.
- Approve, Return for revision and Reject use the system buttons (`btn success`, `btn outline`, `btn danger`) with their icon, label and one-line hint. The second-click confirmation is a quiet white sheet with an accent edge in the decision's colour; Confirm is its only filled control.
- The pending count in the page header is a stat-style tile (bold number, muted uppercase label) instead of a gold badge.

**Not changed:** the component props and handlers, the review flow, and the `--rv-*` decision colours that a test checks for contrast. The cards' hover lift has never moved the card since this restyle: the fade-in animation's fill mode overrides the hover `transform`. It was left as it is.

**Validation and deployment:**
- Build and tests pass. No visual browser verification by eye was performed.

---

### v1.44.0 — Themed Date Picker
**Date:** October 16, 2026

- The browser's own calendar, which cannot be styled, is replaced by a `DatePicker` built like the custom dropdown: the same props and the same `event.target.value` string as `<input type="date">` and `datetime-local`, so call sites changed by one tag. It is used for the deadline dialog's due date and time and "opens on" date, and for Check History's From and To dates.
- A month grid of six Sunday-first weeks (the panel never changes height), previous and next month, today ringed and the chosen day filled, days outside `min` and `max` disabled, Today and Clear buttons, and a time field with a Done button on the date-and-time version. A day chosen before any time uses 17:00. "Today" is the Philippine day whatever the computer's zone is.
- Keyboard: arrows, Home, End, Page Up and Page Down move between days; Esc closes only the calendar, not the dialog behind it; Tab stays inside it. A required field still blocks form submission. Touch screens keep the native control.
- The calendar rules (reading and writing the values, the month grid, the keys, the limits, Philippine today) are in `src/lib/datePickerModel.js` with 8 tests. English and Tagalog labels are in `src/i18n/extra.js`. The field exposes `data-type` and `data-value` so the server-rendered deadline dialog test still sees the type and value.

**Validation and deployment:**
- Build and tests pass. The calendar popup was not opened in a browser by eye.

---

### v1.45.0 — One Syllabus per Subject per Faculty Member
**Date:** October 16, 2026

**The rule:**
- A faculty member can have only one syllabus on a subject, in any state (draft, submitted, under review, returned for revision, approved or rejected); a second draft on the same subject is refused. A subject is assigned to one faculty member, so a syllabus written by someone else does not count: a subject an administrator reassigns is free for its new faculty member.
- The server enforces it where a draft takes its subject (`PUT /api/syllabi/:id/content`, inside the save's transaction after the subject row is locked, so two tabs cannot both claim it) and in the legacy `POST /api/syllabi` (it resolves the course code to the catalog subject, checks it and now stores `course_id`). A refusal is 409 with code `syllabus_exists`, `existingId` and `existingStatus` (the assignment screen's `subject_taken` keeps its own meaning). New `server/lib/subjectLock.js`.
- Drafts that already share a subject are left alone: the rule applies when a subject is chosen, not to existing rows.

**Syllabus Builder:**
- The subject list marks subjects the person already has a syllabus on: greyed out with "you already have a syllabus (Approved)" or "you already have a draft" (`GET /api/courses?taken=1&except=<syllabus id>`; the subject being edited is never greyed by itself).
- If the server still refuses a pick, the subject is taken off the form and a toast explains it with an "Open My Syllabi" button.
- "Save now" is now **Save as draft** (Tagalog "I-save bilang draft"): it saves, shows "Draft saved. You can continue it from My Syllabi.", and opens My Syllabi, where the draft already appears. With no subject chosen it stays and asks for one; it is disabled when the syllabus cannot be edited.

**Rejected syllabi can be edited:**
- A syllabus the administrator rejects is edited and submitted again like one returned for revision, because a rejected syllabus can no longer be replaced by a new draft on its subject. A resubmission must change something and say what changed. New shared rule `isReturned` on the server (`server/lib/syllabusRules.js`) and client (`src/lib/syllabusRules.js`); the builder banner reads "Rejected: edit and submit again."; Reject's hint is now "Sent back; it can still be edited". Approved remains final.

**My Syllabi:**
- A draft card no longer shows the subject's "Submitted" deadline chip. That chip is worked out for the subject from any non-draft version the faculty member ever sent for it, so a new draft beside an earlier submission carried it next to its own Draft badge. `deadlineForCard` leaves Submitted and Submitted late off a draft card; the date-based states still show.

**Validation and deployment:**
- 590 passing domain/API/helper tests at this commit, including new tests for the rule, the messages, the subject list marking, the legacy route and the rejected state. The new SQL was also run read-only against the development database.
- No visual browser verification was performed.

---

### v1.46.0 — Archive and Restore When a Subject Is Reassigned
**Date:** October 16, 2026

- When an administrator gives a subject to a faculty member, the syllabi other faculty members wrote for it are archived in the same save: they keep their owner (the former faculty member's name stays on them), versions and logs, become read-only, and leave every working list (Review & Approval, the AI Checker, the dashboards, the Repository). Administrators' own syllabi are not archived. It happens when a subject is given, not when it is taken away, so removing a subject from someone and adding it back loses nothing.
- When a subject is given back to a faculty member whose syllabus was archived, exactly one of their archived syllabi on it returns to active: a submitted-or-later one before a draft, then the most recently changed. The rest stay archived as history, and a subject on which the person already has an active syllabus restores nothing. The new holder's syllabus is archived in the same save, so a subject always has one active syllabus.
- An archived syllabus cannot be edited or decided on (409), does not count toward the one-syllabus rule, and carries no deadline chip.
- `GET /api/syllabi` leaves archived syllabi out and adds `archived` to each row; `?archived=1` returns only those. My Syllabi and the Repository get a "Show archived (n)" checkbox; archived cards are tagged Archived and offer History only. A former faculty member sees all of theirs; an administrator sees archived approved syllabi in the Repository.
- **Migration:** new nullable column `syllabi.archived_at`. Run from `server/`: `npm run migrate-archive` (idempotent; fresh installs get it from `schema.sql`). Run it before restarting the API, because every syllabus list reads the column.
- Not built: no notification to the former faculty member; an archived syllabus that was not approved is visible only to its former owner.

**Validation and deployment:**
- Tests for the archive and restore queries, the choice of which syllabus returns, and a full round trip (A holds it, B is given it, it returns to A). Run against the development database inside a rolled-back transaction, giving FM 202 to another faculty member archived four syllabi and left the administrator's untouched; giving it back restored one.
- No visual browser verification was performed.

---

### v1.47.0 — Stylesheet Cleanup
**Date:** October 16, 2026

- `src/styles.css` shrank from 7,411 to 6,007 lines (188 KB to 157 KB): 1,020 declarations and 291 emptied rules that a later rule with the identical selector and at-rule context fully overrides are removed, most of them from a superseded copy of the Review & Approval styles. `!important` declarations and fallback pairs inside one rule were left alone, and `theme.css` had nothing to remove.
- The cascade is unchanged: all 4,572 selector-and-property winners and their order are identical, and a headless-browser comparison of the computed style of 1,295 elements at 1400px and 600px wide shows no difference.
- The file was not split by feature: rules for one feature are scattered across layers, and reordering them can change which rule wins.

**Validation and deployment:**
- Build and tests pass.

---

### v1.48.0 — Tailwind CSS: Setup, Review Board Pilot and styles.css in @apply
**Date:** October 16, 2026

**Setup (no visual change):**
- Added `tailwindcss` and `@tailwindcss/vite` 4.3.3 (exact versions) and pinned `vite` 8.3.4, `react` and `react-dom` 19.3.0 and `@vitejs/plugin-react` 6.1.2, which were `latest`.
- `src/main.jsx` loads one entry, `src/tailwind.css`: layer order `theme < base < legacy < components < utilities`, with `styles.css` and `theme.css` in the `legacy` layer, in the same order as before. No Tailwind reset (Preflight) and no Tailwind default theme are loaded; `src/tw-theme.css` maps a small set of utilities onto the existing design tokens, and every Tailwind class is prefixed `tw:` so none can collide with an existing class name or variable. With no `tw:` class in the code the bundle contains no Tailwind CSS.
- Tailwind's compiler adds an `@supports (color: color-mix(in lab, red, red))` fallback around each existing `color-mix()` declaration (10 in the built CSS). Browsers that support `color-mix` are unaffected.

**Pilot — the Review & Approval cards in utilities:**
- `ReviewBoard`'s cards use `tw:` utilities in place of the `.rb-card`, `.rb-subject`, `.rb-who`, `.rb-name` and `.rb-go` rules (`.rb-pill` stays, the review window uses it). The program colour still arrives as `--tone` and `--tone-soft` from `toneStyle()`.
- Compared in a real browser against the original (server-rendered, 1400px and 600px wide, with and without reduced motion, at rest, hovered and keyboard-focused): identical in every element's box and computed style over 344 checks; only a dead `flex-direction` on a grid container was ignored.
- It cost more than it saved: 91 classes, 46 of them arbitrary values; the markup for six cards grew from 1.1 KB to 1.9 KB gzipped and the CSS by about 1 KB gzipped. Converting bespoke components to utilities in their markup is therefore not planned; Tailwind is for new components and for components that are being rewritten anyway.

**Migration of `styles.css` to `@apply`:**
- Each rule keeps its class name, selector and place in the file; its declarations become `@apply` statements: a real utility when one emits exactly that declaration (`tw:grid`), otherwise an arbitrary property with the identical text (`tw:[padding:14px]`). 1,349 of 1,429 rules and 4,308 declarations were converted (1,186 as real utilities, 3,122 as arbitrary properties). Custom properties, `!important`, vendor prefixes, quoted and `url()` values, fallback pairs, the six rules that use `color-mix()`, the printed syllabus form (`.paper`) and the base element rules stay plain. `theme.css` is not converted. No markup changed; the file went from 6,006 to 4,201 lines and the bundle stayed 149 KB.
- Two properties of one family (`border` and `border-color`, `padding` and `padding-right`, `font` and `line-height`) never share an `@apply`, because Tailwind reorders the utilities inside one statement; no variants (`hover:`, `md:`) are used, because `hover:` adds a `(hover: hover)` media wrapper.
- Proven equivalent: compiled by Tailwind, all 1,662 rules match in selector, context and position, 5,341 declarations match in value and 614 interacting pairs keep their order; the two builds give identical computed styles for 1,289 elements at 1400px and 600px wide.
- New tooling: `scripts/css-to-apply.mjs` (deterministic and idempotent), `scripts/css-equivalence.mjs` and `scripts/css-browser-compare.mjs`, as `npm run css:to-apply`, `css:equivalence` and `css:browser-compare`; `docs/css-conventions.md` explains how the file is written and how to change it. A test that read `styles.css` as text now reads the compiled CSS through `src/lib/compiledCss.js`, and the i18n preview page loads the stylesheet through `tailwind.css`.

**Validation and deployment:**
- 590 passing domain/API/helper tests at these commits. The dev server was started and compiles the converted stylesheet.
- No visual browser verification by eye was performed. Restart a running dev server after pulling.

---

### v1.49.0 — No Draft Until a Subject Is Chosen
**Date:** October 16, 2026

- A new syllabus no longer gets a row on the server until it has a subject, so opening "New Syllabus" and leaving, or picking only a program, leaves no empty draft in My Syllabi. What was typed before the subject is kept in the form and goes up with the first save.
- If that first save is refused because the person already has a syllabus on the subject, the row it just created is deleted again. A draft that already existed, or any other failure, keeps its row, so a retry reuses it instead of creating a second one.
- The one pass of the autosave moved out of the hook into `src/lib/draftSave.js` so its rules are tested on their own (10 tests); `useDraft.js` keeps the timing and the screen state.
- Existing subject-less drafts in a database (four near-empty ones in the development database) are not removed by this change.

**Validation and deployment:**
- Current automated verification: 676 passing tests (610 domain/API/helper checks, 22 localization/preference checks and 44 rendered UI checks); the production build passes.
- No visual browser verification by eye was performed for the changes in v1.43.0 to v1.49.0; the layout comparisons above were made with a headless browser. Before using v1.46.0 on an existing database, run from `server/`: `npm run migrate-archive`, then restart the API.

---

### v1.50.0 — Learning Plan: Full Column Headings and Text Aligned Under Them
**Date:** October 16, 2026

- The Learning Plan step's column headings were shortened versions of the institutional form's, in sentence case ("Learning activities", "Values to integrate"). They now read as the form does, with every word capitalised: **Intended Learning Outcomes (ILO)**, **Course Contents**, **Suggested Learning Activities**, **Suggested Assessment Tasks** and **Expected Value/s To Be Integrated**, in English and Tagalog (new `plan.heading.*` keys). The first column stays "Week", because it holds the week number; the printed form prints "SCHEDULE" and "Week N".
- The wording has one source, `PLAN_HEADINGS` in `src/lib/syllabusModel.js`. The printed form builds its capital-letter headings from it (its header row is unchanged), and a test keeps the English translations equal to it.
- The text in every cell started 8px to the right of its column heading (7px in the Formatted view), because each cell is an input with its own 1px border and 7px of padding. The field is now pulled back by that inset, so the text starts under its heading in every column and row, in the edit and Formatted views, at 1000px and 1400px wide. The ILO lesson rows already lined up and are untouched.
- Tagalog headings capitalise each word except the connectors "ng" and "sa".

**Validation and deployment:**
- 604 passing domain/API/helper tests at this commit, including four new tests (the printed headings, the English wording, the Tagalog translations and the alignment rule). The alignment was measured in a real browser: the distance from each heading's text to its cell's text went from 8px to 0 in every cell.
- No visual browser verification by eye was performed on the live builder.

---

### v1.51.0 — Typed Text Keeps Its Line Breaks and Wraps in the Formatted View and the Finished Form
**Date:** October 16, 2026

- A line break typed into an ILO (or a course description paragraph) showed in the text box but collapsed into one run-on sentence in the Learning Plan's Formatted view and in the Review step's printed table, because that text was rendered as plain text. The other cells keep their lines because they go through the markup renderer.
- A very long word ran out of its cell and across the next column (about 290px in a test, over the next column's text in the Formatted view and across the cell border in the printed form). The text box wraps only because browsers wrap textareas natively; table cells had no wrapping rule.
- A `typed-text` class now marks text a person typed (the ILO in the Formatted view; the lesson and exam ILOs and the description paragraphs in the printed form) and keeps its line breaks (`white-space: pre-line`); long words break inside the printed form and the plan's cells (`overflow-wrap: anywhere`). The text stays literal, so asterisks and dashes typed in an ILO are not turned into bold or bullets. The reviewer's window uses the same printed form and is fixed too.
- Not audited: other screens that show typed text outside the Learning Plan and the printed form.

**Validation and deployment:**
- 607 passing domain/API/helper tests at this commit, including three new tests (the wrapping and line-break rules in the compiled CSS, for the finished form and the Formatted view, and that the components mark typed text). Reproduced and checked in a real browser by typing a line break and a 100-character word into an ILO, pressing Formatted and opening the printed form: two lines and a wrapped word, with no content running past a cell.
- No visual browser verification by eye was performed on the live builder.

---

### v1.52.0 — Responsive Layout for Phone, Tablet and Desktop
**Date:** October 18, 2026

**Navigation:**
- Below 768px the left sidebar is replaced by a top bar (logo, "CITE" and the message, bell, avatar and Log out buttons) with an accordion card under it. The card shows the current page and a chevron; tapping it opens the full list of links in the sidebar's blue styling and pushes the content down. It starts closed, and closes on picking a page, on Esc and when the window grows past 768px. New `MobileNav` component; `App.jsx` owns its open state and shows either `Sidebar` or `MobileNav` (`useMediaQuery`), both fed by the same `nav` list, so menu items go to the same pages on every screen.
- At 768px and wider the sidebar and topbar are unchanged.
- The brand text in that top bar is "CITE" (new `ui.cite_brand_5b2e91` key, English and Tagalog); the desktop sidebar title uses the same key, so the brand reads "CITE" on every screen size (logo and CITE in the sidebar on desktop, in the top bar on phones).

**Layout:**
- `body { min-width: 1100px }` made phones and tablets lay the page out 1100px wide, so no responsive rule could apply. It is lifted below 1100px.
- Dashboard cards size to their content below 1024px (they were cut off at fixed 320px and 250px rows) and stack to one column on phones. Stat cards, the activity feed and the time-usage card reflow.
- Tables scroll sideways inside their card with a 640px minimum width. The syllabus table (`.syllabus-table`), the builder's ledgers and the form paper are excluded and keep their own layout.
- Form grids, Reports, Analytics, the compliance summary and the builder's wizard (step list becomes a swipeable row on phones, course strip reflows) go to one or two columns. Modals become full-screen sheets on phones; confirm dialogs stay centred. The messages dropdown anchors to the full-width bar. Touch devices get 44px targets and 16px field text (no iOS zoom).
- Dashboard stat cards no longer leave an empty gap on the right: below 1250px the row is a wrapping flex row, so a short last row (for example 3 + 2 cards, or 2 + 2 + 1 on a phone) stretches to the full width.
- The same fix for the other card grids: an odd last card in the dashboard's lower row, My Syllabi, Compliance and the checker's picker now takes the whole row below 1250px (1024px for the picker) instead of leaving an empty half. The dashboard's lower row was still three columns at 1024-1250px and is now two.
- All of it is in a new `src/responsive.css`, imported last in the legacy layer, so `styles.css` and `theme.css` are untouched and desktop rules do not change.

**Login:**
- The logo above the sign-in form is removed (the brand panel keeps its own logo on wide screens). The logo on the Forgot password, Change password, Student register and Student home screens is unchanged.
- The "Welcome back" label, the "Sign in to SMS" heading and the line under it are centred on the sign-in form. It uses a new `login-card-signin` class on that form only, so Forgot password, Change password and Student register keep their alignment.
- The sign-in heading reads "Sign in to Login" (new `ui.sign_in_to_login_7c41d8` key, English and Tagalog).
- Forgot password: the logo and the "Forgot password" label are removed, and the line under the heading reads "Type your email address you were registered with." (new `ui.type_your_registered_email_address_4e92a6` key, English and Tagalog). The sent-confirmation state is unchanged.
- Forgot password: the visible "Email" label above the field is removed. The field keeps an `aria-label` and its placeholder, so screen readers still announce it.
- Forgot password: the line under the heading no longer has a bottom margin, so it sits closer to the email field (a new `login-card-forgot` class on that form only).
- Forgot password: the grey placeholder text in the email field is removed; the field keeps its `aria-label`.
- Sign-in form: the placeholder text in the username/email and password fields is removed; both keep their visible labels.
- Top bar: the page heading ("Dashboard") next to the "Syllabus Management System" label is removed; `Topbar.jsx` no longer looks up the page title.
- Top bar: the messages and notifications buttons use a soft grey for their icons (the same grey as the search box) instead of near-black, with a light blue tint on hover and keyboard focus. Only `.top-actions .icon-btn` is affected, so the icon buttons in tables and dialogs keep their colours.
- Top bar: the Log out button has a sign-out icon before its label (new `signOut` entry in the `Icon` registry). The button still reserves room for the longest language's label, so it does not change width when the language switches.
- Top bar: below 768px the Log out button shows only its icon (a 40px square like the message and bell buttons). The button has an `aria-label` at every size, so screen readers still announce "Log out".
- The phone accordion menu now uses the desktop sidebar's own gradient (the `--side-top`, `--side-mid` and `--side-bottom` theme tokens) instead of its own hard-coded blues, so the two are the same colour and follow any theme change.
- Between 1100px and 1280px the brand text was cut off by the large logo circle; the circle and spacing now shrink and the text wraps. Below 1100px the blue brand side is dropped and only the sign-in form shows (also Register, Forgot password and the first-login screens, which share the page). The brand banner's decorative circles no longer widen the phone page.

**Validation and deployment:**
- 683 passing automated tests (617 domain/API/helper checks, 22 localization/preference checks and 44 rendered UI checks); the localization audit and the production build pass. No new test file was added for the responsive layer.
- Checked in a headless Edge browser, not by eye on a real device: all 12 admin pages and the 7 faculty pages at 360px (and the admin pages at 768px) with no horizontal overflow, live resizing while logged in, the accordion open and closed, the login at 360 to 1440px, and the Assignments and chat modals and the messages dropdown at 360px. Student Home and Change Password were not run live (no student account), the Program dialog did not open in the check, and the builder's paper view was deliberately left as is.
- No server, API, route or database change.

---

### v1.53.0 — Time-of-Day Greeting, New Action Icons and Cleaner Comment Cards
**Date:** October 18, 2026

**Dashboard:**
- The heading greets by the Manila time of day instead of "Welcome back": "Good morning, {name}!" (5:00-11:59), "Good afternoon, {name}!" (12:00-17:59) and "Good evening, {name}!" (18:00-4:59), with Tagalog versions. Without a name it reads "Good morning!" and so on. Six new `dashboard.good*` keys.
- The period comes from two new pure functions in `src/lib/phTime.js` (`phHour`, `dayPeriod`), so it follows Philippine time whatever the viewer's computer clock says. The dashboard checks again every minute and changes at 12:00 and 18:00 while it stays open. `TypewriterText` is unchanged.
- Time Usage card: the chart is 56px high (was 84px) and the gaps between its blocks are tighter, so the whole card fits without scrolling in the dashboard's fixed-height row. Nothing was removed from the card. Only the `.usage-*` rules in `theme.css` changed.

**Icons:**
- New `bin` (delete), `pencilSquare` (rename/edit) and `denied` (rejected) icons, drawn from `docs/icons/bin-svgrepo-com.svg`, `pencil-square-svgrepo-com.svg` and `denied-svgrepo-com.svg` in `customIcons.jsx` with `currentColor`, and registered in the `Icon` list in `ui.jsx`. The app still does not read the SVG files themselves. SVG Repo icons carry their own licences, so check these three allow use in this project.
- The rename/edit and delete buttons in Program Management and Subject Actions, the delete-conversation button in the chat (it was a 🗑 emoji and now has an `aria-label`), and the delete buttons on outcome and plan rows in the new builder use the new icons. The unused Phosphor `Trash` icon and the builder's own trash path are removed.
- The rename/edit and delete buttons use soft grey icons and a light border; Delete turns red only on hover and keyboard focus.
- Recent Activity: approved entries use the Approved stat card's icon, returned-for-revision entries use the For Revision stat card's icon, rejected entries use `denied` and deleted entries use `bin`.
- Review panel: the Approve, Return for revision and Reject decision buttons (and their confirmation line) use the `approved`, `revise` and `denied` icons.
- The one-line hint under each decision button in the review panel is no longer shown (the confirmation sentence is unchanged).

**Login and top bar:**
- The sign-in screen's blue brand panel and the form are two equal columns (they were 1.15 : 0.85). The brand panel's padding is smaller and, below 1600px, its logo circle and heading shrink so "Management" is not cut off. `StudentHome`, which shares `.login-page`, is unchanged apart from the equal grid.
- The Log out button is text only on normal screens. Its icon shows only below 768px, where the button is an icon-only square, as before. The label text is centred in its box.

**My Syllabi:**
- The delete button on each card was a 🗑 emoji and now uses the `bin` icon. In the old builder's reference rows the text ✎ and × are the `pencilSquare` and `bin` icons, with "Edit" and "Delete" labels from existing translations.
- The Edit, History, Check in AI Checker and Delete buttons are soft white-grey at rest and take their colour only on hover and keyboard focus (blue for Edit, History and Check in AI Checker; red for Delete). New `syl-quiet` and `syl-delete` classes in `theme.css`, used only on those buttons; the Comments and Message buttons are unchanged.

**Student registration:**
- The registration form (`StudentRegister.jsx`) no longer shows the college logo or the "Student Registration" label above its "Create your account" heading. The logo on Change password and Student home, and the other `eyebrow` labels, are unchanged.

**Review comments:**
- A reviewer comment card (`CommentsThread`) no longer picks up the old comment list's `.comment` grid layout (a plain comment carried the class `comment`), which squeezed the name and date into a 34px column. A plain comment now has no type class.
- The coloured left strip and the tinted backgrounds for revision, rejection and approval comments are removed: every comment is the same white card with a thin border. The name sits on the left, the date on the right, and the type and "New" chips next to the name, all vertically centred.

**Validation and deployment:**
- 684 passing automated tests (618 domain/API/helper checks, 22 localization/preference checks and 44 rendered UI checks); the localization audit and the production build pass. Updated assertions that pinned the old icon names, the old "Welcome back" heading and the red delete colour; added a test for the greeting's boundaries (4:59, 5:00, 11:59, 12:00, 17:59, 18:00 and a non-Manila clock).
- `scripts/fill-it301-api.cjs` can sign in from `FILL_EMAIL` and `FILL_PASSWORD` (never printed or saved) and reports why a sign-in fails. It is a developer script, not part of the app.
- Checked in a headless Chrome with sample data (icons, login at 1100-1920px, Time Usage in English and Filipino at four widths, top bar, activity feed). Not checked by eye on the live signed-in pages (review panel, comments, dashboard).
- No server, API, route or database change.

---

### v1.54.0 — Quick Actions Customization and Dashboard Viewport Stability
**Date:** October 31, 2026

**Dashboard Quick Actions:**
- Added `CustomizeQuickActionsModal.jsx` allowing users (Faculty and Admin) to customize which navigation action shortcuts appear on their Dashboard Quick Actions card.
- Synchronized shortcuts with sidebar navigation items, honoring user roles and permissions, and persisted selections in `localStorage` under a user-scoped key (`quick_actions_{userId}`).
- Updated Quick Action shortcut buttons: icon container background changed to soft white-gray (`bg-slate-100`), icon foreground changed to black (`text-slate-900` / `#0f172a`), providing high contrast and visual hierarchy.
- Removed the numeric syllabus count badge from the "My Syllabi" shortcut button while preserving the descriptive subtitle ("Syllabi in your account" in English, "Silabus sa iyong account" in Tagalog).
- Resolved text overlapping and layout breakage when switching to Tagalog by enforcing 2-line text clamping (`-webkit-line-clamp: 2`), flexible container heights (`min-height: 52px; max-height: 72px`), and text truncation without spilling into adjacent buttons.

**Dashboard Viewport & Scroll Stability:**
- Refined desktop single-viewport layout in `src/responsive.css` so the dashboard remains static, clean, and unfragmented without unwanted card-level scrollbars, while maintaining responsive fluid scaling across device breakpoints.
- Eliminated vertical overflow scrolling inside the Quick Actions card and the Time Usage stat card across both English and Tagalog by constraining `.card:has(.usage-host) > .card-body` with `overflow-y: hidden` and tightening `<dt>` typography line heights.

**Validation and deployment:**
- Automated test suite passed with 100% success rate (`npm test`).
- Localization audit passed with 0 missing translations and 0 hardcoded strings (`npm run test:localization`).
- Production Vite build compiled cleanly into `dist/` with 0 errors (`npm run build`).

---

### v1.55.0 — Review Chain: VPAA, Asst. VPAA and LIC Director
**Date:** November 4, 2026

**New roles:**
- `vpaa` (Vice President for Academic Affairs), `asst_vpaa` (Asst. Vice President for Academic Affairs) and `lic_director` (LIC Director). The dean creates them in Users & Roles.

**The flow:**
- Faculty submit → the dean (admin), the Asst. VPAA and the LIC Director each check and review (any order) → the VPAA reviews and approves → the Repository.
- **Only the VPAA approves or rejects.** The dean, the Asst. VPAA and the LIC Director clear their own check, or return the syllabus for revision with a reason. The VPAA can approve only after all three have cleared the newest version and the AI check has been made. A new version starts the three checks again.
- A dean who writes a syllabus now **sends it for review** instead of approving it; their stage is cleared by authoring and the others follow.
- The printed form's "Checked and Reviewed by" and "Approved by" show the names and dates.
- Review & Approval shows each role what needs them (a reviewer's open checks, the VPAA's approvals); the panel shows the three stages and only the buttons that role has. Faculty see a small review-progress line on a submitted syllabus. Notifications reach all three reviewers on a submission, and the VPAA when the third check clears.

**Server:**
- New `syllabus_review_stages` table and the three roles in `users.role` (`npm run migrate-review-stages`, with `--dry-run`). `syllabi.status` is unchanged.
- New `POST /api/syllabi/:id/stage-clear` and `GET /api/syllabi/:id/stages`; the status `PUT` enforces who may set which status and the chain before `approved` (`403` for anyone but the VPAA, `409 STAGES_PENDING` before all three have cleared, `503` before the migration). The admin-only checks that meant "may look at and check a syllabus" (comments, AI check, check history, program and subject lists, avatars) now accept every reviewer; user, catalog, deadline and settings management stay with the dean.
- Upgrade notes: syllabi already approved stay approved; syllabi still submitted or under review need the three checks again. See `docs/review-chain.md`.

**Tests:** new `server/lib/roles.test.js`, `server/lib/reviewStages.test.js`, `server/routes/reviewChain.routes.test.js`, `src/lib/roles.test.js`; the stage, enforcement, comments, compliance and password route tests, the review, notification and navigation tests were updated for "only the VPAA approves".

---

### v1.56.0 — Academic Years: Term per Subject, Year-Scoped Lists, a Catalog per Year and Setting Up Outcomes in Add Subject
**Date:** November 5, 2026

**Subject term (Program & Subjects):**
- An administrator sets each subject's **semester, year level (1–4) and pre-requisite**; the academic year of a subject is the year of the catalog it is in. Faculty see these filled in when they pick the subject in the syllabus builder and cannot change them; the server stores the administrator's values even if a client sends others.
- The subjects table has Program, Semester and Year level filters that combine and clear.
- A difference from the approved curriculum is shown as a warning only; it never blocks.

**Current academic year and year-scoped lists:**
- One academic year is **current**. Syllabi, the AI Checker queue, Compliance, Analytics, Reports, Repository, Dashboard and My Syllabi are listed by academic year. Faculty and reviewers see the current and the previous year; an administrator sees every year. A syllabus is stamped with the year it was created in, and the one-syllabus-per-subject rule is per year.
- One academic-year control in the Program & Subjects header replaces the separate "Current academic year" card and the top-bar year chip: the year dropdown, **Make current** (confirmed first, only while another year is shown), **+ Add year** (a small popover under its button) and **Copy from {year}**. Every other year filter is a dropdown only, with the current year tagged "· current" (and "· current: {year}" on the "all years" choices). Their "Academic year" caption was removed; the accessible name stays.

**A catalog per academic year:**
- Programs and subjects belong to an academic year, so a **new year starts with no programs and no subjects**, even for the administrator. An earlier year's catalog is **view only**: every change is refused with `403 catalog_year_read_only`. The same program code can exist in two years, each with its own EGAs, Program Outcomes and CLOs.
- **Copy from last year** is optional, never automatic, and only fills an empty current year: it copies programs, their EGAs and POs, specializations and subjects with their CLOs as new records. Faculty assignments, deadlines, syllabi and aliases are not copied. Done in one transaction (`POST /api/academic-years/copy-catalog`: `409` when the year already has programs or no earlier year has a catalog).
- The AI Checker resolves a syllabus's program by id, so an older year's syllabus is still checked against its own year's program outcomes. Assignments, deadlines and student lists follow the current year's catalog.

**EGAs, Program Outcomes, vision and mission in Add subject:**
- The Add subject form has an **Outcomes, vision and mission** section. For a **new program** the administrator types its EGAs and Program Outcomes; they are created together with the program and the subject in one step (`POST /api/courses` accepts `outcomes` for a new program only). For an existing program the saved ones are shown for editing (version-checked, so a stale screen is refused). The school vision and mission have their own **Save vision and mission** button and are one school-wide record for every program and year.
- A **new subject starts with a copy** of its program's EGAs and Program Outcomes and the school vision and mission, so the faculty builder shows them (Step 2) when faculty pick the program and subject. The subject keeps its own copy afterwards; a draft whose Step 2 was already edited keeps its own text, and a submitted syllabus keeps its snapshot.
- Each program has an **Outcomes** dialog (EGAs and POs, read-only for a past year, a specialization or POs from an official reference) and an **Apply to subjects** button that copies the saved setup into its existing subjects (a subject whose CLOs still use something removed is skipped and listed). A program with no EGAs or POs shows a "Set up EGAs and POs" badge and the page lists it.
- The AI Checker, its 47 rules, the 79 threshold and the scoring are unchanged: the checker still compares with the program's EGAs and POs and the school vision and mission.

**Server:**
- New migrations for an existing database: `npm run migrate-academic-year-scope` and `npm run migrate-catalog-year` (both idempotent; either sets up the academic years itself, so their order does not matter; the subject term columns come from the existing `migrate-subject-term`). Before they run, the application behaves as before.
- New `server/lib/catalogCopy.js`, `server/lib/programMasters.js` (`loadMasters`, `syncSubjects`), `server/lib/programOutcomesInput.js` (one set of EGA/PO validation rules shared by the program routes and the new-program path); `server/lib/subjectStandards.js` gains `standardsFromMasters` and `applyMasters`.
- New `POST /api/programs/:id/sync-subjects`; `GET /api/programs` returns `egaCount` and `inheritedFrom`; `GET /api/academic-years` returns each year's program and subject counts to an administrator.

**Client:**
- New `AcademicYearControl`, `ProgramOutcomesEditor`, `OutcomesFields`, `VisionMissionFields`, `SubjectSetup`; `CurrentAcademicYear`, the standalone vision/mission card, the top-bar year chip and unused strings and styles were removed. English and Filipino pairs for every new text.

**Tests and validation:**
- New `server/lib/catalogCopy.test.js`, `server/lib/programMasters.test.js`, `src/lib/outcomesSetup.test.js`; extended the catalog-year, academic-year, enforcement and UI tests. `npm test` 2,048 tests, `npm run test:vpaa`, the localization audit and `npm run build` pass; the database bootstrap check builds a scratch database with every migration.
- Browser E2E (isolated database and ports, scripted provider, no live AI request): 24 scenarios, 395 checks. New E21–E24 cover the empty new year, Copy from last year, the view-only past year, setting up a new program's outcomes, the faculty builder receiving them, and every closed year filter naming the current year.
- Not run: any live Claude request, any real development or staging database.

**Upgrade notes:** existing programs and subjects are stamped with the year that is current when `migrate-catalog-year` runs. Subjects created before this change keep their own EGAs, POs, vision and mission until the administrator uses **Apply to subjects** on their program.

---

### v1.57.0 — Administrator Owns a Subject's Vision, Mission, EGA, PO and Term
**Date:** November 6, 2026

- Added **Edit Vision, Mission, EGA and PO of this subject** to the subject edit dialog (Program & Subjects). It saves each section with `PUT /api/courses/:id/standards`, which was already on the server but had no screen.
- In the faculty builder, year level, semester and pre-requisite (Step 1) and Vision, Mission, EGA and PO (Step 2) are now always read-only for faculty. A subject the administrator has not filled in shows a note instead of an editable box. Year level accepts 1 to 4, as the server does.
- No server or database change: `applyTerm` and `forceStandards` already forced these values on every faculty save.

---

### v1.58.0 — Add Program Button; Add Subject Picks a Program
**Date:** November 6, 2026

- Added an **Add program** button beside **Add subject** on Program & Subjects. Its form takes the program code and name, and holds the Vision, Mission, EGA and Program Outcomes form (the Vision and Mission are the school's one record; the EGAs and POs belong to the program). The outcomes are optional and can be set later with the program's Outcomes button.
- Added `POST /api/programs` (administrator only, current academic year, one transaction). The checks and the EGA/PO insert are shared with `POST /api/courses` (`server/lib/programCreate.js`), which still creates a program implicitly for existing API callers.
- **Add subject** now picks the program from a list instead of asking for a typed code and name, and no longer shows the outcomes section.
- Tests: two new route tests in `server/routes/catalogYear.routes.test.js`. The browser scenarios E22 and E23 were updated to the new flow and were not run.

**Update (same day):** the per-subject "Edit Vision, Mission, EGA and PO of this subject" dialog from v1.57.0 was removed again at the administrator's request. Vision, Mission, EGAs and POs are set through the program (Add program form and the program's Outcomes button) and reach existing subjects with **Apply to subjects**. The server route `PUT /api/courses/:id/standards` is unchanged.

---

### v1.59.0 — Edit Subject Is Code and Title Only
**Date:** November 6, 2026

- The subject **edit** dialog now has only the subject code and title (semester, year level and pre-requisite are set when the subject is added).

---

### v1.60.0 — Program Outcome Reference Versions and Faculty Review and Adopt
**Date:** November 6–7, 2026

**Reference versions:**
- Program Outcomes are now database-driven reference versions. Each administrator save of a program's POs records an immutable version (for example `lcup-po-2026-10-29`, `DFSFASDA-2026–2027-v3`), and the AI Checker uses the version in force. The administrator's save is the reference: there is no separate approval or publish step, and faculty see versions read-only.
- A specialization (BSIT-Cyber Security) uses the POs of the program it inherits from in the same academic year. Copying a catalog into a new year links each new program to the same version instead of copying it.
- The Outcomes dialog has a **Program Outcome reference** panel: the version in force, its history, and a comparison of any two versions (`GET /api/programs/:id/po-reference`, `.../compare`, `.../candidates`; `POST .../record`, `POST .../adopt`).
- Every saved AI Checker report records the exact references it used: program, academic year, PO version and content hashes.

**Faculty Review and Adopt:**
- When the administrator applies changed POs to a subject, a syllabus written against the earlier POs shows a review of current versus updated statements. It changes only when its author adopts the update (`GET /api/syllabi/:id/po-review`, `POST /api/syllabi/:id/po-review/adopt`, `PoReviewNotice`). Saving or opening a draft no longer adopts new POs silently.
- A PO that the update removes but a CLO still maps blocks adoption until that mapping is changed.
- Historical syllabi whose PO mappings need academic review are marked `needs_review`. A new AI check on them is refused (`po_mapping_remediation_required`) until the review is resolved; their saved reports stay readable.

**Database:** additive migration `npm run migrate-po-reference-publication`. Applied to the development database on November 7, 2026, after raising `max_allowed_packet` to 16M.

**Unchanged:** the 47 deterministic rules, the seven VPAA relationships, the four CLO classifications, the official scoring and the passing threshold of 79.

---

### v1.61.0 — Saved Reports Open for Syllabi Under Academic Review
**Date:** November 7, 2026

- Fixed: a syllabus with an open `needs_review` record could not open its saved AI Checker report, because opening it re-resolved today's references and was refused. The saved report now opens as it was saved (score, threshold and references), marked as a saved report, and nothing is re-checked.
- Server: `mastersFor(..., { historicalRead })` and `recordReviewOf`; `loadDetail` marks the run with `recordReview`. Client: a saved-report notice in the compliance card, in English and Filipino.
- Tests: `server/lib/syllabuscheck/historical-report-retrieval.test.js` and `scripts/release/report-retrieval.integration.test.cjs` (65 checks on a restored copy of the development database).

---

### v1.62.0 — Approval Decisions Follow the Review Chain
**Date:** November 7, 2026

- Closed five ways a syllabus could be approved without the required state. A syllabus is approved only from Under Review, after the dean, the Asst. VPAA and the LIC Director have cleared its newest version. Approved is final, and a returned or rejected syllabus must be resubmitted first. Refusals carry the codes `approval_requires_review`, `approved_final`, `resubmission_required` and `not_awaiting_decision`.
- Accepting or rejecting a recommendation is refused while the syllabus has an open academic review.
- The compliance list and check history mark runs of syllabi under academic review; these never count as passed. The AI Checker picker shows a note and disables the check for them.
- Tests: `server/routes/record-review-decisions.routes.test.js`, plus an approval security audit on a restored copy with no bypass found.

---

### v1.63.0 — Approved Syllabi Are Protected Records
**Date:** November 7, 2026

- Nobody, including an administrator, can delete an approved syllabus through the application.
- Deleting a program, a subject or an account that an approved syllabus depends on is refused too, with the number of affected syllabi (`409 approved_records_protected`). The program deletion preview explains this and offers no way to continue.
- The check runs on locked rows inside the deleting transaction, so a deletion racing an approval never removes an approved syllabus.
- New `server/lib/approvedRecords.js`; refusal messages in English and Filipino. Tests: `server/routes/approved-records.routes.test.js`, program-management tests, and concurrency rounds on a restored copy.

---

### v1.64.0 — A Valid Subject Is Required; Accounts Can Be Disabled
**Date:** November 7, 2026

**Subject validation:**
- Submitting a syllabus (faculty submit, administrator send to AI Checker and send for review) and VPAA approval now require a valid subject. The subject must exist, be the one the form names, and belong to the syllabus's program and academic year. Refusals return `409 subject_required` or `subject_mismatch`. Drafts still save without a subject.
- A subject deleted while a syllabus is under review stops its approval. After the syllabus is returned for revision, the author can choose an existing subject and resubmit.
- Deleting a subject now locks its syllabi first, so it no longer deadlocks with a submission running at the same time.

**Account disabling:**
- Users & Roles has **Disable** and **Enable** buttons and shows a **Disabled** badge.
- A disabled account cannot sign in with a password or Google, and its remembered devices and temporary password are removed. An open session ends at its next request, "Forgot password" sends nothing, and an administrator cannot resend its credentials. Everything the account authored or reviewed is kept.
- An administrator cannot disable their own account, and the last active administrator cannot be disabled.
- New `server/lib/subjectValidation.js` and `server/lib/accountStatus.js`; messages in English and Filipino.

**Database:** additive migration `npm run migrate-account-status`, which adds `users.disabled_at` and `users.disabled_by`. Applied to the development database on November 7, 2026. Before the migration, every account counts as active.

---

### v1.65.0 — AI Checking Only for the Active Academic Year
**Date:** November 7, 2026

- Institutional policy: a new AI check is performed only for syllabi of the active academic year, which the administrator chooses. This covers a check or re-check, AI refinement of a recommendation, the V2 preview, and submission (which stores a check run); anything else is refused with `409 inactive_academic_year`.
- The active year is read before any AI request, and again under a lock in the transaction that stores the result. A year switch during a check therefore never stores a result for a year that is no longer active.
- Old-year syllabi and their saved reports stay readable, and nothing is re-checked or regenerated. A syllabus keeps its own academic year.
- Fixed: a syllabus whose subject link was gone was resolved against the current year's program, so it could borrow another year's Program Outcomes. It now resolves only in its own academic year.
- Client: for a syllabus of another academic year, the AI Check button is hidden and a notice explains why, in English and Filipino (builder, AI Checker and reviewer picker).
- Note: an old-year syllabus cannot be submitted until its academic year is active again.
- New `server/lib/activeYearGate.js` and `src/components/InactiveYearNotice.jsx`.

**Verification (v1.60.0–v1.65.0):** on isolated restored copies of the development database with scripted AI responses and no paid AI request:
- `npm test` 2,255 tests and VPAA conformance 304.
- Dynamic references 24, four-program PO workflow 4 of 4, report retrieval 65.
- Browser suites E01–E25 (optimizations off and on), K01–K10 and B01.
- Isolated end-to-end UAT, 34 of 34 scenarios.

Release candidate RC14b (source hash `f0c2a9e1…`) runs on the development server with AI requests, email delivery, deadline notices and usage tracking turned off.

---

### v1.66.0 — Subject Curriculum Year
**Date:** November 8, 2026

- Subjects now have a **curriculum year** (for example 2022-2023): the curriculum a subject is taught under. It is separate from the academic year, so one academic year's catalog can hold subjects of different curricula.
- **Add subject** asks for the curriculum year (required in the form) from a dropdown: the curricula of the last 20 years and next year, the years already in use, and the program's approved curriculum references, marked "approved curriculum on file". A hint says whether the AI Checker has an approved curriculum for that program and year.
- **Edit subject** can change or clear it. Program & Subjects has a **Curriculum** column and a **Curriculum year** filter (with "Not set"), combinable with the program, semester and year level filters.
- Copying a catalog into a new academic year keeps each subject's curriculum year. The curriculum warning on the subject list now compares a subject only with its own curriculum when it has one.
- Server: new `server/lib/curriculumYear.js` (YYYY-YYYY, two consecutive years, stored with a plain hyphen; `400` when invalid). `POST /api/courses` accepts `curriculumYear` (optional for API compatibility); `PUT /api/courses/:id` changes it, clears it when sent empty and leaves it alone when not sent. Subject reads return `curriculumYear`.
- Without the migration, reads work as before (not set) and setting a curriculum year answers `503` naming the migration.

**Database:** additive migration `npm run migrate-curriculum-year`, which adds the nullable `courses.curriculum_year`. Applied to the development database on November 8, 2026, after a backup; no row changed.

**Tests:** `server/lib/curriculumYear.test.js`, route tests in `server/routes/catalogYear.routes.test.js`, filter tests in `src/lib/subjectTerm.test.js`; one structural assertion in `src/lib/brandTheme.test.js` updated for the added column. `npm test` passes (2,152 tests plus the localization and UI suites). Real-SQL routes verified against a temporary copy of the table, rolled back.

- A subject's semester can now also be **Summer** (as deadlines already allowed): the official BSIT-Cyber Security 2025-2026 curriculum has a 3rd-year summer term. Summer is shown with its own label (Tag-init in Filipino) on the subject list and the builder. The route test that refused Summer now refuses an invalid value instead, and the semester list test expects three values.

**Data (development database, November 8, 2026):** the 2026–2027 catalog was filled with the 243 subjects of the four official curricula (BSIT 53, BSIE 63, BSCPE 66 from 2022-2023; BSIT-Cyber Security 61 from 2025-2026) through the subject route, each with its curriculum year, semester, year level and pre-requisite, after checking every row against the approved curriculum reference. A blank pre-requisite cell keeps the reference's wording, so the submit check matches. Backup before: `2026-11-08-pre-curriculum-import`.

**Not changed:** the syllabus form's own Curriculum year field, the AI Checker's rules and scoring.

---

### v1.67.0 — Reviewers Choose: Check with AI or Review Without It
**Date:** November 8, 2026

- The dean (administrator), the Asst. VPAA, the LIC Director and the VPAA each choose, per submitted version, to **check it with AI** (as before) or to **review it without an AI check**. The AI Checker's syllabus picker has a **Review without AI check** button next to **Check compliance**, with a confirmation. After confirming, the syllabus is in that reviewer's Review & Approval.
- The choice is the reviewer's own: it opens their stage clear (`POST /api/syllabi/:id/stage-clear`) or the VPAA's decision (`PUT /api/syllabi/:id`) and nobody else's. A resubmission is a new version, so the choice is asked again. The AI check stays available after choosing.
- Every choice is logged in the syllabus's activity ("Chose to review v1.0 without an AI check"), with an optional reason. Choosing changes no status and clears no stage.
- Unchanged: the review chain (all three stages before the VPAA), the coded hard gates at approval, approved records. When the institution sets `SYLLABUS_CHECK_AI_GATE=required` the choice is not offered and a stored one does not count. If a choice cannot be read, the gate fails closed.
- Server: `POST /api/syllabi/:id/review-without-ai` (reviewers only; not their own syllabus; submitted or under review), `server/lib/reviewAiChoice.js`; the lists report `awaitingAiCheck` per reviewer and `reviewedWithoutAi`. The refusal now says "…or choose to review it without an AI check" (`code: ai_check_or_choice_required`).
- Fixed: the builder's CLO/EGA/PO **Tag** picker opened far from its button. A card keeps a transform after its entry animation, which made the fixed picker position against the card; it is now drawn on the page body, placed under (or above) its button and kept next to it while scrolling (`src/lib/pickerPosition.js`).

**Database:** additive migration `npm run migrate-review-ai-choice` (table `syllabus_review_ai_choices`, one row per syllabus, version and reviewer). Applied to the development database on November 8, 2026, after a backup; no other table changed.

**Tests:** `server/lib/reviewAiChoice.test.js`, four route tests in `server/routes/stages.routes.test.js`, `src/lib/pickerPosition.test.js`. `npm test` passes (2,167 tests plus the localization and UI suites). Real-SQL check of the choice in a rolled-back transaction.

---

### v1.68.0 — A Syllabus Reaches the VPAA After the Three Stages
**Date:** November 8, 2026

- A submitted syllabus reaches the VPAA only once the dean (administrator), the Asst. VPAA and the LIC Director have all cleared its newest version (or once it is approved). Before that it is not in the VPAA's Review & Approval, dashboard or syllabus lists, the AI Checker's queue or its check history, and the VPAA cannot check it, choose to review it without AI, return it or reject it (`409 STAGES_PENDING`).
- The VPAA is notified when the third stage clears (unchanged); the submission notifications go to the administrator, the Asst. VPAA and the LIC Director only (unchanged). A resubmission is a new version, so it leaves the VPAA until the three clear it again. What the VPAA returned for revision stays in the VPAA's list until it is resubmitted; approved syllabi stay visible.
- The VPAA's AI Checker says so: "Syllabi appear here for you once the dean, the Asst. VPAA and the LIC Director have all cleared them." Nothing changes for the other reviewers or for faculty.
- Server: one rule in `server/lib/reviewStages.js` (`readyForApprover`, `approverVisible`, `assertReadyForApprover`) used by `GET /api/syllabi`, `PUT /api/syllabi/:id`, `GET /api/compliance`, `GET /api/compliance/history`, `POST /api/syllabi/:id/compliance/recheck` and `POST /api/syllabi/:id/review-without-ai`. When the chain cannot be read nothing unfinished reaches the VPAA. No database change.

**Tests:** rule tests in `server/lib/reviewStages.test.js`; route tests in `server/routes/stages.routes.test.js` and `server/routes/compliance.routes.test.js`. One test from v1.67.0 that let the VPAA choose before the chain was done now proves the refusal. `npm test` passes (2,172 tests plus the localization and UI suites).

---

### v1.68.1 — No Message Button in the Repository
**Date:** November 8, 2026

- The Repository tab no longer shows a message button on any row, for any user: everything there is approved, and an approved syllabus is final. Each row keeps its history button. Earlier conversations stay readable in Messages; messaging on syllabi that are not yet approved (My Syllabi, Review & Approval) is unchanged.
- `src/views/Repository.jsx`, `src/App.jsx` (the Repository no longer receives the chat opener). The UI test that expected a message button for faculty-owned rows in the administrator's Repository now checks that no reviewer role sees one and that the history button stays (`tests/i18n-ui.test.jsx`).

---

### v1.68.2 — Only Faculty and the Administrator Write Syllabi
**Date:** November 8, 2026

- The Asst. VPAA, the LIC Director and the VPAA no longer have the Syllabus Builder or My Syllabi, by any path: the menu, the dashboard shortcuts, a notification link or a page left open all lead them to the Dashboard. They review in the AI Checker and Review & Approval as before.
- The server enforces it: creating a draft (`POST /api/syllabi/drafts`), saving content (`PUT /api/syllabi/:id/content`), adopting a Program Outcome update (`POST /api/syllabi/:id/po-review/adopt`) and submitting (`POST /api/syllabi/:id/submit`) answer `403 authors_only` for those roles, before anything is read or written. The administrator-only routes (prepare check, send for review, resume draft) and the refused legacy upload are unchanged.
- The dashboard's **New syllabus** button is shown to faculty and the administrator only (it was shown to every non-faculty role, and for a reviewer it only led back to the dashboard). It now always starts a new syllabus: like My Syllabi, it clears whatever was being edited before opening the builder.
- One rule, `AUTHOR_ROLES = [faculty, admin]` / `canAuthor`, in `server/lib/roles.js` and `src/lib/roles.js` (a test keeps them equal), used by `requireAuthor` (`server/middleware/auth.js`), the menu (`src/data/initialData.js`) and the page guard (`src/App.jsx`).

**Tests:** role parity and menu tests in `src/lib/roles.test.js`; refusal test in `server/routes/compliance.routes.test.js`. `npm test` passes (2,175 tests plus the localization and UI suites).

---

### v1.68.3 — The Academic Year Filter Lists the Years Only
**Date:** November 8, 2026

- The academic year filter offers only the years: the current academic year (tagged "current") and the earlier years the person may see. The combined choices "Previous and current year" (faculty and reviewers) and "All academic years" (administrator) are gone.
- Every screen, the work queues included (Review & Approval, AI Checker), starts on the current academic year; a submission still waiting from an earlier year is found by choosing that year. A remembered "all" choice falls back to the current year. Which years a person may see is unchanged (the server decides: an administrator every year, everyone else the current and the previous one).
- `src/lib/academicYearScope.js`, `src/components/AcademicYearScope.jsx`; the tests in `src/lib/academicYearScope.test.js` now expect the years only.

---

### v1.68.4 — The VPAA's Decision Reaches the Whole Review Chain
**Date:** November 8, 2026

- When the VPAA approves a syllabus, the faculty member who submitted it still gets their own notice. Now every administrator (the dean), the Asst. VPAA and the LIC Director (and any other VPAA account) are notified as well: "Syllabus approved: <code>", "Approved by the VPAA (<name>). It is now in the Repository." Clicking it opens the Repository. The VPAA who approved is not notified of their own decision.
- A VPAA rejection reaches the same people, with its reason. A return for revision still tells only the owner.
- The status itself was already shared: every role's lists and the Repository read it from the database. Only the notifications were missing.
- `server/routes/syllabi.js` (after the commit, never affecting the result), `server/lib/notify.js` (`notifyRoles` takes one user or a list to leave out), `src/lib/notificationRoute.js` (type `approval` opens the Repository). New tests in `server/routes/stages.routes.test.js` and `src/lib/notificationRoute.test.js`. No database change.

---

### v1.68.5 — Approved Syllabi Leave the AI Checker
**Date:** November 8, 2026

- An approved syllabus no longer appears anywhere in the AI Checker. It is gone from the reviewers' Check History (Admin, Asst. VPAA, LIC Director, VPAA) and from the faculty member's subject list. The "to check" picker already left it out. Approved syllabi are in the Repository.
- Its stored checks are kept and can still be read (`GET /compliance/runs/:id`). The Dashboard and Analytics still count it, since they read `GET /compliance`, which is unchanged.
- `server/routes/compliance.js` (history: `syllabus_status NOT IN ('draft', 'approved')`), `src/views/AIChecker.jsx` (faculty list). New test in `server/routes/compliance.routes.test.js`. No database change.

---

### v1.68.6 — Recent Activity Cannot Be Cleared
**Date:** November 8, 2026

- The **Clear Logs** button is removed from the Dashboard's Recent Activity card for every role. The activity list is the account's audit trail, kept for transparency.
- Clear Logs never deleted anything (the server has no route that deletes logs). It only hid entries in that browser. A hide saved in a browser from before is no longer applied, so those entries show again.
- `src/views/DashboardView.jsx`, `src/App.jsx`. New test in `tests/i18n-ui.test.jsx`. The unused helpers in `src/lib/activityView.js` (`readClearedAt`, `writeClearedAt`, `afterCleared`) and their test are left in place. No server or database change.

---

### v1.69.0 — Recent Activity Records Everything the Account Does
**Date:** November 8, 2026

- Recent Activity now records what each person does, for transparency: **signing in** (with a password, Google or a temporary password) and **signing out**; **changing the password** (and whether it was the required change after a generated one); **changing the name** (old → new); **changing the profile photo** (uploaded, Google photo, removed; an administrator removing someone else's photo is recorded for the administrator, naming whose); **changing the language**; **starting a draft**; **editing** a syllabus (one line per editing session of 30 minutes, since autosave saves every few seconds, saying whether it was a draft); and **deleting** a syllabus (named by its subject and status, kept even though the syllabus is gone). AI checks, submissions and review decisions were already recorded and still are.
- Nothing that is not the account's own is shown, and no password is ever recorded. Nothing is recorded for a failed sign-in, a refused save or deletion, or saving the same name or language again.
- New table `account_activity` (`server/db/account-activity-ddl.js`, `npm run migrate-account-activity` with `--dry-run`, also in `schema.sql`). Rows are only added. A deleted syllabus keeps its rows (`syllabus_id` becomes NULL; `subject` still names it). Until the migration runs, nothing new is recorded and Recent Activity shows the review history as before. Recording never makes the action fail.
- `server/lib/accountActivity.js` (new); hooks in `server/routes/auth.js`, `users.js`, `syllabusContent.js`, `syllabi.js`; `GET /api/logs` merges both sources, newest first, up to 50 rows (was 30). Client: `src/lib/activityView.js` (new kinds, notes), `src/views/DashboardView.jsx`, icons in `src/components/ui.jsx`, English and Tagalog in `src/i18n/accountActivity.js`.
- Tests: new `server/lib/accountActivity.test.js`; new cases in `logs`, `passwords`, `avatar`, `preferences`, `contentRevision` and `enforcement` route tests, `src/lib/activityView.test.js` and `tests/i18n-ui.test.jsx`. The logs test cap check now expects 50 (its fixture has more rows and dates that rise with the id, as real ones do).

---

### v1.70.0 — Failed Sign-ins, Remembered Devices, Account Management, and the Admin's View of Everyone
**Date:** November 8, 2026

- **Failed sign-ins** are recorded on the account they were for: a wrong password, or a disabled account (also from a remembered device). An unknown email has no account to record it on. What the person signing in is told is unchanged. Never the password typed.
- **"Remember me" sign-ins**: a session restored from a remembered device is recorded as a sign-in "on a remembered device".
- **The Admin's management of accounts** is recorded on the Admin, naming the account: registering an account (with its role), sending new sign-in details (only when the email went out), disabling and enabling (only when it changed), removing an account, and changing a faculty member's assignments (only when they changed, with the number of subjects).
- **The Admin's view of everyone**: the Recent Activity card has a selector, for the Admin only, with "My activity", "Everyone", or one person (up to 100 entries, newest first). `GET /api/logs?scope=all[&userId=]` refuses anyone else (403). Everyone else still sees only their own.
- `lib/accountStatus.js` `setDisabled` also says whether it changed anything (kept out of the response). No database change: the actions are new values in the existing `account_activity.action` column.
- Removing an account also removes that account's own activity rows (`account_activity.user_id ON DELETE CASCADE`). The Admin's line recording the removal stays.
- Tests: new cases in `server/lib/accountActivity.test.js` (remembered device), `logs`, `passwords`, `account-status`, `approved-records` and `assignments` route tests, `src/lib/activityView.test.js` and `tests/i18n-ui.test.jsx`. The two v1.69.0 tests that said a failed sign-in records nothing, and that listed the actions, now expect the new rules.

---

### v1.70.1 — Recent Activity Is Now the Audit Log
**Date:** November 8, 2026

- The Dashboard card titled "Recent Activity" is now **Audit Log** (Tagalog: "Talaan ng Audit"), for every role. What it shows is unchanged.
- `src/views/DashboardView.jsx` uses the new key `accountActivity.title` (`src/i18n/accountActivity.js`). The old `ui.recent_activity_8aebf3` string is left in place, unused. `tests/i18n-ui.test.jsx` now checks the new title and that the old one is gone.

---

### v1.71.0 — The AI & Notifications Switches Now Work
**Date:** November 8, 2026

Before this version the three switches on Settings > AI & Notifications were saved but mostly did nothing: AI Compliance Checking and Strict Format Validation were read nowhere, and Email Notifications controlled only the deadline reminder emails.

- **Strict Format Validation** ON: faculty complete builder steps 1–7 in order (step N before N+1), as before. OFF: faculty open any step; what is still missing stays listed ("Complete before submitting:") and a note says the steps are open. Submitting still needs every step complete either way (the Submit button and the server's submit checks are unchanged). The Admin is never held to the order. Until the setting is read, or if it cannot be read, the strict order applies.
- **AI Compliance Checking** OFF: an AI check runs the coded format rules and score only, with no AI provider request; the result says "AI compliance checking is turned off in Settings…". "Check and improve a recommendation" (an AI request) is refused (409 `ai_checking_off`). The AI Checker and the builder's Review step show a note. If the server requires an AI check before submit or approval (`SYLLABUS_CHECK_AI_GATE=required`), that requirement is lifted while AI is off, since no AI check can be made; the coded hard gates always apply. ON: as configured.
- **Email Notifications** ON: besides the deadline reminders, the faculty member is emailed when their syllabus is approved, returned for revision or rejected (sent in the background; a mail problem never affects the decision). OFF: no emails. The in-app notifications are sent either way.
- New `GET /api/settings/policy` (any signed-in person) returns only the three switches. The Settings page describes what each switch does.
- New `server/lib/adminSettings.js`, `server/lib/decisionEmail.js`, `src/lib/adminPolicy.js`, `src/lib/stepGate.js`, `src/i18n/adminPolicy.js` (English and Tagalog). Changed: `server/routes/settings.js`, `compliance.js`, `syllabusCheck.js`, `syllabi.js`, `syllabusContent.js`, `server/lib/compliance/service.js` (`requireHybrid` `aiOff`), `server/lib/syllabuscheck/gemini.js` (the reason text only), `src/views/builder2/index.jsx`, `src/views/AIChecker.jsx`, `src/components/AdministrativeSettings.jsx`, `src/lib/api.js`. No database change.
- Tests: new `server/lib/adminSettings.test.js` (including that no request is sent with AI off), `server/lib/decisionEmail.test.js` and `src/lib/stepGate.test.js`; new cases in the compliance, refine, preferences (settings) and stages route tests. A fake mail transport only: no real email was sent.

---

### v1.71.1 — The Admin Checks Their Own Syllabi in the AI Checker
**Date:** November 8, 2026

- The Admin's AI Checker has a new **Check my syllabus** card above the list of submissions. It lists the Admin's own drafts and their syllabi returned for revision or rejected (not archived). **Check my syllabus** sends the chosen one to the AI Checker exactly as the builder's "Continue to check" does (a saved version, status Under Review; an incomplete form is refused with what is missing), runs the check and opens the result, where the Admin sends it for review. **Open in builder** opens it for editing. Before this the Admin could only reach the check from the builder.
- Only the Admin gets the card (the Asst. VPAA, LIC Director and VPAA do not write syllabi). No server or database change: it uses the existing prepare-check, check and send-for-review routes.
- New `src/components/OwnSyllabusPicker.jsx`, `src/i18n/ownCheck.js` (English and Tagalog); `src/views/AIChecker.jsx`, `src/App.jsx` (`onChanged` refreshes the list). New case in `tests/i18n-ui.test.jsx`.

---

### v1.71.2 — The Admin's Own Syllabus Reaches the Other Reviewers Only When Sent for Review
**Date:** November 8, 2026

- When the Admin (the dean) checks their own syllabus ("Continue to check" in the builder, or "Check my syllabus" in the AI Checker) it becomes Under Review. Until now the Asst. VPAA and the LIC Director could already see it then, check it and clear their stage, before the Admin sent it. Now it stays with the Admin until they press **Send for review**.
- Send for review (unchanged) clears the dean stage automatically, with the Admin as its author, and notifies the Asst. VPAA and the LIC Director, who review in any order. The VPAA gets it once all three stages are cleared, then approves.
- Before it is sent, other reviewers (Asst. VPAA, LIC Director, VPAA, any other administrator) do not see it in Review & Approval, the Dashboard, the AI Checker queue or its history. They also cannot check it, clear a stage on it, choose to review it without AI, or decide it (409 `not_sent_for_review`). A faculty member's syllabus is not affected. A new version the Admin prepares after editing is held back again until sent.
- `server/lib/reviewStages.js` (`awaitingAuthor`, `hiddenFromReviewers`, `assertSentForReview`), applied in `server/routes/syllabi.js` (list, decisions), `compliance.js` (queue, history, check) and `reviewChain.js` (stage clear, review without AI). No database change. Tests: new cases in `server/lib/reviewStages.test.js`, `stages.routes.test.js` and `compliance.routes.test.js` (including the whole flow: check, hidden, send, notified, visible).

---

### v1.71.3 — AI Checker Spacing and Footer Note
**Date:** November 8, 2026

- A 20px gap between the Admin's "Check my syllabus" card and the "Choose a syllabus" card, the same as above the check history (`src/styles.css`, `.pick-card + .pick-card`).
- The always-shown note at the bottom of the AI Checker ("The check supports but does not replace…") is removed, for reviewers and faculty (`src/views/AIChecker.jsx`). The notes that appear only when they apply stay: AI checking turned off, an AI check required by the server, and the VPAA's queue note.

---

### v1.71.4 — Lighter Blue Primary Buttons
**Date:** November 8, 2026

- Primary buttons (New syllabus, Next, Check, Save, Send for review, …) use a lighter, brighter blue, **#0866ff**, instead of the navy brand blue (#1a2196); hover is a step darker (#0656d6). The white label stays readable (4.8:1, above the 4.5:1 minimum). The assignment screen's navy primary button uses it too.
- Only the primary buttons change: links, tabs, outline buttons and the sidebar keep the brand blue. New tokens `--btn-primary` and `--btn-primary-hover` in `src/theme.css`; a contrast test in `src/lib/brandTheme.test.js`.

---

### v1.71.5 — White-Grey Selected Item in the Sidebar
**Date:** November 8, 2026

- The selected sidebar item is no longer navy with white text: it is white-grey (#e4e8ee) with dark text, a step deeper than the hover grey (#eceff2) so the two can be told apart; hovering the selected item deepens it slightly (#dde2e9).
- Its side marker and icon change from gold to the brand blue, which stays visible on grey (gold would be about 1.8:1).
- `src/theme.css` (`--side-active`, `--side-active-hover`); a readability test in `src/lib/brandTheme.test.js`.

---

### v1.71.6 — No Side Strip on the Selected Sidebar Item
**Date:** November 8, 2026

- The colored strip on the left of the selected sidebar item is removed. The selected item is marked by its white-grey background and blue icon (`src/theme.css`; the test in `src/lib/brandTheme.test.js` now checks there is no strip).

---

### v1.71.7 — Grey Secondary Buttons
**Date:** November 8, 2026

- Outline buttons (white with blue text and a blue border, e.g. Open in builder, Edit draft, Cancel, Export list, ← previous step) now have a light grey fill **#e2e5e9**, **black bold** text and no blue border; hover is a step darker (#d4d8de). The quieter list buttons (`syl-quiet`) use the same grey on hover.
- Not changed: the solid blue primary buttons, and the deadline list's bell icon button (Remind).
- `src/theme.css` (`--btn-secondary`, `--btn-secondary-hover`); a test in `src/lib/brandTheme.test.js`.

---

### v1.71.8 — Dashboard Card Labels Keep Their Capitals
**Date:** November 8, 2026

- The Dashboard's summary cards showed their labels lowercased after the first word ("My submissions", "Pending review", "Under review", "For revision", "AI compliance score"; in Tagalog "Aking mga naipasa", "Mga programa"). They now show the label as written: **My Submissions, Pending Review, Under Review, For Revision, AI Compliance Score**, and in Tagalog **Aking mga Naipasa, Mga Programa, Mga Asignatura**.
- `src/views/DashboardView.jsx` no longer passes these labels through `sentenceCase` (the helper itself is unchanged). `tests/i18n-ui.test.jsx` now expects the capitals.

---

### v1.72.0 — Program Compliance Counts Approved Subjects
**Date:** November 8, 2026

- On the Admin's Dashboard (and the Asst. VPAA's, LIC Director's and VPAA's), **Program Compliance** now shows, for each program, how many of its **subjects** have an approved syllabus out of all the subjects the program has in the catalog: "3 of 12 subjects approved", and the bar fills to 100% when every subject has one. An approved syllabus counts whether or not it was checked by AI. Before, the bar was the average AI score (a dash when nothing was AI-checked) and the note counted syllabi ("1 of 1 approved").
- Every program in the catalog is listed, including one with no approved syllabus yet (0%) or no subjects yet. A subject with several approved syllabi counts once; an archived syllabus does not count. Same academic year as the screen.
- Faculty keep their own view (their syllabi's AI average and approvals).
- New `programCoverage` in `src/lib/complianceStats.js` (tested in `complianceStats.test.js`); `src/views/DashboardView.jsx`; English and Tagalog notes in `src/i18n/dashboardStats.js`. No server change.

---

### v1.72.1 — Faculty Program Compliance Follows Their Assigned Subjects
**Date:** November 8, 2026

- On a faculty member's Dashboard, **Program Compliance** now shows, for each program assigned to them, how many of their **assigned subjects** they have submitted a syllabus for, out of all their assigned subjects in that program: "3 of 5 assigned subjects submitted" (60%), reaching 100% when every assigned subject is submitted. It updates as they submit.
- Counted: Submitted, Under Review and Approved. Not counted: a draft, or a syllabus returned for revision or rejected (it must be submitted again). A program assigned with no subject yet says so.
- Before, the faculty bar was the average AI score of their syllabi. The administrator's side is unchanged from v1.72.0 (subjects with an approved syllabus).
- `src/lib/complianceStats.js` (`programCoverage` takes the statuses to count; `FACULTY_SUBMITTED`), `src/views/DashboardView.jsx` (faculty read their assigned programs and subjects; the unused AI-average program list is removed), English and Tagalog in `src/i18n/dashboardStats.js`, a test in `complianceStats.test.js`. No server change.

---

### v1.72.2 — The Compliance Tab Follows Each Faculty Member's Assigned Subjects
**Date:** November 8, 2026

- The Admin's **Compliance** tab measured every faculty member against a fixed "2 required" syllabi. It now measures each one against **the subjects the Admin assigned to them** for the academic year on screen, so it can be used as PACUCOA evidence: "3 of 5 assigned subjects submitted", the bar to 100% when all are submitted, how many are approved, the programs, and **what is still missing by subject code** (a syllabus returned for revision or rejected is named with its status).
- **Compliant** only when every assigned subject is submitted (Submitted, Under Review or Approved). A faculty member with nothing assigned this year shows "No subjects assigned" and is listed last. Every active faculty account is shown, not only those who already submitted something. Disabled accounts are left out.
- Reads the faculty accounts, who holds each subject (`GET /api/users/subject-holders`) and the year's subjects; no server change. New `src/lib/facultyCompliance.js` (+ tests), `src/i18n/facultyCompliance.js` (English and Tagalog); `src/views/Compliance.jsx` rewritten. The existing photo test in `tests/i18n-ui.test.jsx` now passes the faculty accounts, and a new test checks the assigned-subject numbers.
- Not yet changed: the **Reports** page's Faculty Compliance Report still uses the fixed "2 required".

---

### v1.72.3 — AI Quality Snapshot Shows the Final Score and Where It Was Lost
**Date:** November 8, 2026

- The Dashboard's **AI Quality Snapshot** now shows the **final AI check score** on top: the coded rules' score minus the AI check's deductions, averaged over the latest check of each syllabus.
- The four rings (Format, Content Completeness, CO–PO Alignment, Assessment Alignment) now show each area **after the AI deductions**, and the **lowest one is marked in red and named** ("Lowest: CO–PO Alignment at 70%"). Before, the rings showed only the rules' area scores, which could all read 100% while the AI had taken points off the final score.
- Each AI deduction is charged to the area it is about: CLO, ILO and outcome alignment to CO–PO; activities, tasks and assessment to Assessment; broken reference links to Reference Currency; a missing core value to Completeness. An area loses its share of the points by its weight, so the weighted areas add back up to the final score. Display only: the official score and the stored area scores are unchanged.
- New `server/lib/compliance/finalAreas.js` (+ tests); `GET /api/compliance` adds each run's `areasFinal` and each summary area's `final` (the deductions are read from the stored reports with JSON_EXTRACT); `snapshotOf` in `src/lib/complianceStats.js` (+ test); `src/views/DashboardView.jsx`, `QualityMini` `low`, styles in `src/theme.css`, English and Tagalog in `src/i18n/dashboardStats.js`. No database change.

---

### v1.72.4 — A Cleaner AI Quality Snapshot
**Date:** November 8, 2026

- The note beside the final AI check score is removed; its meaning is now the score's tooltip. The final score is centered above the rings.
- The four rings are centered in one row.
- The two small notes under the rings ("Lowest: … at …%" and the explanation) are removed. The lowest area is still marked: its ring is red, and its tooltip says "Lowest: … at …%".
- `src/views/DashboardView.jsx`, `QualityMini` `title`, `src/theme.css` (`.quality-row`, `.snap-final` centered); the two unused texts removed from `src/i18n/dashboardStats.js`; the UI test updated.

---

### v1.72.5 — AI Quality Snapshot: Rings Only
**Date:** November 8, 2026

- The final AI check score line above the rings is removed. The card shows only the four rings, centered, each area after the AI deductions, with the lowest in red (its tooltip names it).
- `src/views/DashboardView.jsx`, `src/theme.css` (`.snap-final` removed), the unused text removed from `src/i18n/dashboardStats.js`, the UI test updated.

---

### v1.72.6 — AI Quality Snapshot Rings Centered
**Date:** November 8, 2026

- The four rings sit in the middle of the card (vertically and horizontally) instead of at its top, in four equal columns with each ring and its label centered (`src/theme.css`).

---

### v1.73.0 — Deadlines and Assignments for the Admin
**Date:** November 8, 2026

- **The Admin can be assigned subjects**, like faculty (Users & Roles → Assignments on an Admin row). The rule stays: one person per subject. Assigning a subject to the Admin archives other faculty members' syllabi for it, as with faculty; the Admin's own syllabi are never archived. An assignment never restricts the Admin: they can still write any subject. The Asst. VPAA, LIC Director and VPAA are still not assignable (they do not write syllabi).
- **Deadlines count the Admin**: a subject's deadline now applies to whoever the subject is assigned to (faculty or the Admin), and also to an **Admin who is writing a syllabus for it** without having it assigned. They appear in the deadline's progress, get its notices and reminders (and emails while Email notifications is on), and can show as failed to submit.
- **For the Admin, "submitted" means sent for review** (the first "submit" in their syllabus log), not a saved version: checking their own syllabus in the AI Checker saves a version before they send it. Faculty are counted as before.
- **The Admin's Upcoming Deadlines card** now shows **My deadlines** (their own, with their own status; a row opens My Syllabi) above **All faculty deadlines** (the overview, as before).
- **The Compliance tab** also lists an Admin who has been assigned subjects.
- Server: `server/lib/deadlines.js` (`peopleOf`, `adminSubmissions`, `mine(..., { admin })`), `GET /api/deadlines/mine` answers the Admin too, `server/routes/users.js` (faculty and admins assignable). Client: `UpcomingDeadlines.jsx`, `UsersRoles.jsx`, `Compliance.jsx`, `DashboardView.jsx`; texts in `src/i18n/extra.js`; styles in `src/theme.css`. No database change.
- Tests: a new Admin case in `server/lib/deadlines.test.js` (assigned, writing, submitted only when sent, their own list); the test fake answers the new queries. Two tests that encoded the old rules now expect the new ones: `/mine` returns the Admin's own deadlines (still never another person's), and an Admin can be assigned (a reviewer target is still 400).

---

### v1.73.1 — Set Deadline Uses the Subject's Own Term
**Date:** November 8, 2026

- The Set deadline dialog no longer asks for the **school year** and **semester**. A subject's academic year and semester are set when it is added and cannot be changed afterwards, so the deadline is for that term: the dialog shows it read-only ("Term: 2026-2027 · 1st Semester (from the subject)").
- Editing an existing deadline keeps its own term. "New term" is no longer offered once the subject's term already has a deadline (a second one for the same term is refused anyway).
- An older subject that has no academic year or semester still shows the two pickers, so a deadline can still be set for it.
- `src/components/DeadlineDialog.jsx` (`subjectTermOf`), the text in `src/i18n/extra.js`, a style in `src/theme.css`, a test in `tests/i18n-ui.test.jsx`. No server change.

---

### v1.73.2 — One Remind Button in the Deadline Dialog
**Date:** November 8, 2026

- The small bell button on each person's row in the deadline's Faculty progress list is removed, since it repeated the **Remind all** button above the list. Remind all still reminds everyone who has not submitted (notification and email), and each row still says when that person was last reminded.
- `src/components/DeadlineDialog.jsx`; `src/theme.css` (the list has two columns, the unused `.dl-remind` styles removed); the two tests that checked the per-person button now check that it is gone.

---

### v1.73.3 — The Pre-requisite Is Optional When Adding a Subject
**Date:** November 8, 2026

- On the Admin's **Add Subject** form (and the subject's edit dialog) the **Pre-requisite** is now optional, marked "(optional)": many subjects have none. The academic year, semester and year level are still required. Before, a pre-requisite had to be typed ("None").
- A subject saved without one stores nothing; the subject list shows **None** in its pre-requisite column, and a syllabus for it shows **None** in step 1, locked for faculty like the other values the Admin sets (so faculty are never stuck on an empty pre-requisite). The curriculum check does not warn about an empty pre-requisite.
- `server/lib/subjectTerm.js` (`parseTerm` optional pre-requisite, `applyTerm` "None"), `src/lib/subjectTerm.js` (`termComplete`, `lockedFields`), `src/lib/syllabusModel.js` (`applyCourse`), `src/components/SubjectTermFields.jsx`, `src/views/CourseOutcomes.jsx`, texts in `src/i18n/extra.js`. New `server/lib/subjectTerm.test.js`; the client and route tests that required a pre-requisite now expect it to be optional. No database change.

---

### v1.73.4 — Users Listed by Role
**Date:** November 8, 2026

- **Users & Roles** lists people by role, in a fixed order: **VPAA, Asst. VPAA, LIC Director, Admin, Faculty**, then by last and first name. Before, they were listed newest account first, with the roles mixed.
- The Role choice in the Add User form follows the same order (Faculty is still preselected).
- `ROLE_ORDER` and `byRoleOrder` in `src/lib/roles.js` (+ a test in `roles.test.js`); `src/views/UsersRoles.jsx`. No server change.

---

### v1.73.5 — Blue Stat Icons on the Dashboard
**Date:** November 8, 2026

- The icons on the Dashboard's summary cards use the same blue as the primary buttons such as **New syllabus** (#0866ff), with a white icon, instead of the navy gradient (`src/theme.css`; a test in `src/lib/brandTheme.test.js`).

---

### v1.73.6 — Sidebar: Grey at Rest, Blue Icon on Hover and Selected
**Date:** November 8, 2026

- Sidebar items at rest now have a **grey** label and icon (#6b7280, the lightest grey that stays readable on the near-white sidebar: 4.6:1; a lighter "white-grey" would be about 1.7:1 and hard to read).
- **Hovered or selected**, the label is dark and the **icon turns the primary blue** (#0866ff), the same blue as the Dashboard's stat icons and the New syllabus button. The white-grey hover and selected backgrounds are unchanged.
- `src/theme.css`; the sidebar test in `src/lib/brandTheme.test.js` now checks the grey label and the blue icon.

---

### v1.73.7 — Sidebar: Only the Icon Is Grey at Rest
**Date:** November 8, 2026

- Correction to v1.73.6: the sidebar **labels stay dark** at all times. Only the **icon** is grey at rest: a light grey (#8b919c, the lightest that stays visible on the near-white sidebar at 3:1, which the collapsed sidebar needs since it shows only icons). Hovered or selected, the icon is the primary blue (#0866ff), as before.
- `src/theme.css` (`--side-icon`); the sidebar test in `src/lib/brandTheme.test.js` checks the dark label and the grey icon.

---

### v1.74.0 — Program Compliance Over Time (View Analytics)
**Date:** November 8, 2026

- On the Dashboard's **Program Compliance** card, **View analytics** is now a button for the Admin (and the Asst. VPAA, LIC Director and VPAA). It opens **Program compliance over time**: a modal that starts with the definition ("Program compliance for syllabus analytics refers to the automated, data-driven process of evaluating university syllabi to ensure they adhere to institutional policies, governmental mandates, and accreditation standards.") and shows a **trend line per program**: the share of the program's subjects with an approved syllabus (AI check or not), week by week up to today, for the academic year on screen.
- The chart: a line per program in a fixed colour (the reference palette, validated for colour-blind separation), a legend, the current value at each line end, a crosshair with each program's value on hover (or with the left and right arrow keys), and a **Table** view with each program's approved subjects out of its subjects (programs with no subjects listed too). Up to eight lines; more programs are in the table.
- New `GET /api/compliance/program-approvals` (reviewers only): when each subject's approved syllabus was first approved (its approval log; its last change when an older one has none), for the academic year asked for.
- New `src/lib/programTrend.js` (+ tests), `src/components/ProgramTrendModal.jsx` (`TrendChart`, `TrendTable`), `src/i18n/programTrend.js` (English and Tagalog), styles in `src/theme.css`; `src/views/DashboardView.jsx`, `src/lib/api.js`, `server/routes/compliance.js`. Tests: `programTrend.test.js`, a route test in `compliance.routes.test.js`, a UI test in `tests/i18n-ui.test.jsx`. Faculty keep their card unchanged. No database change.

---

### v1.74.1 — A Larger Program Compliance Modal
**Date:** November 8, 2026

- The Program compliance over time modal is now large: up to 1080px wide (it still fits smaller screens), and the chart is drawn for that room (a wider, taller plot with the text kept at its size) (`src/theme.css`, `src/components/ProgramTrendModal.jsx`).

---

### v1.75.0 — A Professional Program Compliance Trend: Daily, Weekly, Monthly
**Date:** November 8, 2026

- The Program compliance over time modal now reads **by day, week or month** (Daily / Weekly / Monthly). By day the lines are step lines that rise on the day a subject's syllabus is approved; by month there is a point at the end of each month (Philippine time) and today.
- **Summary tiles** above the chart: overall compliance across all programs with its change over the period ("▲ +18 pts since Sep 2", in words and with an arrow, not colour alone), approved subjects ("14 / 36"), and programs fully compliant (every subject approved).
- **A cleaner chart**: a white chart panel, recessive gridlines with a firmer baseline, value labels at the line ends with the value in bold, and pill-shaped legend entries that **hide or show** a program on click and **highlight** it on hover (its line thickens with a soft fill, the others fade). The **tooltip** lists the programs sorted by value with "approved / total" for each. The colours are unchanged: the validated reference palette, each program keeping its colour.
- The **table** shows a key colour, a progress bar and the percentage for each program.
- `src/lib/programTrend.js` (granularity, overall), `src/components/ProgramTrendModal.jsx` (`TrendSummary`, `TrendChart`, `TrendTable`), `src/i18n/programTrend.js` (English and Tagalog), styles in `src/theme.css`. Tests: day, month and overall cases in `programTrend.test.js`; summary and day/month views in `tests/i18n-ui.test.jsx`. Checked in headless Chrome: each view, the legend highlight, the tooltip and the table. No server or database change.

---

### v1.75.1 — Time Usage Bars in the Button Blue
**Date:** November 8, 2026

- The Dashboard's **Time Usage** bars use the same blue as the primary buttons such as **New syllabus** (#0866ff) instead of the navy blue; today's bar stays gold so it still stands out (`src/theme.css`; the theme test checks the new colour).

---

### v1.75.2 — Builder Steps in the Button Blue
**Date:** November 8, 2026

- The selected step (1-7) in the Syllabus Builder no longer uses the navy blue: its number badge is the primary button blue (#0866ff, like **New syllabus**) with a white number, its label the darker shade of that blue (#0656d6), on a light blue tint (#e8f0ff). The button blue itself is too light for small text on a tint, so the label uses its darker shade (5.5:1). Done, attention and locked steps keep their marks.
- `src/theme.css` (`--btn-primary-tint`); a readability test in `src/lib/brandTheme.test.js`.

---

### v1.75.3 — Time Usage Range Buttons in the Button Blue
**Date:** November 9, 2026

- The selected range button on the Dashboard's **Time Usage** card now uses the primary button blue (#0866ff, like **New syllabus**) instead of the navy blue, and the hover highlight on each day uses the same blue (`src/theme.css`). No server or database change.

---

### v1.75.4 — AI Quality Snapshot Rings in the Button Blue
**Date:** November 9, 2026

- The Dashboard's **AI Quality Snapshot** rings (Format, Completeness, CO–PO, Assessment) are now the primary button blue (#0866ff, like **New syllabus**) instead of gold. The ring of the lowest area stays red so it still shows where the final score was lost (`src/theme.css`; a check in `src/lib/brandTheme.test.js`). No server or database change.

---

### v1.75.5 — Program & Subjects Renamed to Curriculum
**Date:** November 9, 2026

- The administrator's **Program & Subjects** tab is now **Curriculum** (Tagalog: **Kurikulum**) in the sidebar, the mobile menu and the page title. The help texts that pointed to the old name (the empty deadlines card, the Assignments panel note, the incomplete-subject message in Learning Outcomes) now say Curriculum.
- The **+ Add subject** button on that page is now **+ Add Curriculum** (Tagalog: **+ Magdagdag ng Kurikulum**). It still opens the same form.
- `src/data/initialData.js`, `src/i18n/messages.js`, `src/i18n/extra.js`. The page key and the routes are unchanged. No server or database change.

---

### v1.76.0 — A Specialization Is Checked Against Its Own Curriculum
**Date:** November 9, 2026

- **The AI Checker now picks the curriculum reference by the syllabus's own program**, separately from where its Program Outcomes come from. Before, a fixed rule for **BSIT–Cyber Security** made the checker ignore Cyber Security's own approved curriculum. It used BSIT's curriculum instead (or none when the BSIT link was missing), so Cyber Security's specialization subjects were reported as not in the curriculum.
- A BSIT–Cyber Security syllabus now uses **its own approved curriculum** (core and specialization subjects) and **the BSIT Program Outcomes** through the existing inheritance link, with no duplicate POs. Its academic year and its identity as Cyber Security are kept. The report records the curriculum source as Cyber Security and the PO source as BSIT.
- No program code is singled out for the curriculum any more. Every program, including any future specialization, is matched against its own approved references (and the curriculum year when one is given).
- Unchanged:
  - the 47 rules, the 7 VPAA relationships, the scoring and the threshold of 79;
  - PO inheritance and the rule that Cyber Security cannot keep a separate PO master;
  - historical reports.
- `server/lib/syllabuscheck/repository.js` (curriculum selection) and `server/lib/programs.js` (the unused `curriculumSource` marker removed from PO inheritance).
- Tests:
  - `server/lib/syllabuscheck/outcome-source.test.js` replaces the test that encoded the old rule, and adds tests for the curriculum year, a made-up second specialization, and recognition of specialization subjects;
  - the release and rehearsal scripts that asserted the old rule were updated.
- Proved on an isolated copy of the database with a scripted AI: a Cyber Security specialization subject matched its own reference with the CUR-CODE rule passing, its POs came from BSIT, and a BSIT subject was unchanged. No live database change.

---

### v1.76.1 — No Pre-requisite Means the Same Thing Everywhere
**Date:** November 9, 2026

- **Root cause of the release integration test failure** (a check on a new program): v1.73.3 made the syllabus show **None** for any subject with a term. Every subject of a catalog year is stamped with that year automatically, so a subject whose term the Admin never set up also got **None**, replacing its real pre-requisite. The curriculum check then reported a mismatch. The application was wrong; the test expectation was right.
  - Now **None** is shown only for a subject the Admin set up (a semester, year level or pre-requisite entered) without a pre-requisite.
  - A subject whose term was never set keeps the pre-requisite as typed, as before v1.73.3.
  - Server: `server/lib/subjectTerm.js` (`setUp`). Client, the same rule: `src/lib/subjectTerm.js` (`subjectSetUp`, `prerequisiteOf`, locking) and `src/lib/syllabusModel.js` (pre-fill).
  - The builder's Step 1 now also shows **None** for a set-up subject without a pre-requisite, as the server saves it (`InfoStep.jsx`).
- **Second defect found while checking, which would have hit the catalog rebuild:** the official curriculum references record a blank pre-requisite cell as *"Not specified in the source curriculum (blank prerequisite cell)."* The curriculum check compared pre-requisites exactly, so a subject the Admin added without a pre-requisite (**None**) failed against that sentence with a **blocking** CUR-FIELD finding.
  - The check now treats the ways of writing "no pre-requisite" as one value: empty, **None**, **N/A**, and the blank-cell sentence (`server/lib/syllabuscheck/prerequisite.js`, used by `engine.js`).
  - The data is not reinterpreted.
  - A real pre-requisite is still compared exactly, so genuine mismatches are still found and still block: **None** against **IT 101**, **IT 101** against a blank cell, **IT 101** against **IT 102**.
- Unchanged: the 47 rules (the CUR-07 rule, its severity and the other curriculum fields, lecture, lab, year level and title, stay as they were), the 7 VPAA relationships, the threshold of 79, the scoring, dynamic program and PO references, the active-year restriction and historical reports.
- Tests:
  - new `server/lib/syllabuscheck/prerequisite.test.js` (recognized forms; matches; genuine mismatches still blocking; lecture hours not loosened);
  - `server/lib/subjectTerm.test.js` and `src/lib/subjectTerm.test.js` (the year stamp alone invents nothing and locks nothing).
- Results:
  - the release integration test passes 24 of 24 on an isolated server;
  - an isolated regression run on a copy of the database passed all its checks: no pre-requisite, a valid one, a mismatch, a new program, BSIT, Cyber Security with BSIT POs, the active-year block, and earlier runs and reports unchanged;
  - the full suite passes (2,261 tests plus the localization and UI suites) and the build is clean.
- No live database change, migration, paid AI request or deployment.

---

### v1.76.2 — A Clear Recommendation for a Blank Curriculum Pre-requisite
**Date:** November 9, 2026

- When a syllabus names a pre-requisite but the approved curriculum's pre-requisite cell is blank, the AI Checker no longer suggests copying the internal placeholder *"Not specified in the source curriculum (blank prerequisite cell)."* into the syllabus. It offers no replacement text and says instead:
  - no pre-requisite is listed in the approved curriculum, but the syllabus names one;
  - a blank cell does not prove the subject has none, so verify it against the official curriculum or with the program chair;
  - if the subject has none, its pre-requisite can be left empty; if it has one, the curriculum reference should be corrected.
- Unchanged:
  - the check itself: same result, still blocking, same score;
  - a real official pre-requisite is still offered as the correction;
  - no pre-requisite against a blank cell is still valid;
  - the stored evidence still records the reference exactly as it is.
- `server/lib/syllabuscheck/prerequisite.js` (`isBlankCell`, `notListedMessage`), `server/lib/syllabuscheck/engine.js` (the pre-requisite check's wording and suggestion), tests in `server/lib/syllabuscheck/prerequisite.test.js`.

---

### v1.77.0 — One Consistent Recommendation per Lesson, and the Faculty's Core Value Kept
**Date:** November 9, 2026

- **Off-topic lessons (Policy V2 on):** when Policy V2 finds a week's content is not about the course (Course Title ↔ Course Content NOT_ALIGNED), the other rewrites proposed for that week are no longer offered. These are the ILO, activity, assessment, values and content-to-ILO drafts, all written for the current topic, so they would keep it (for example "use Excel formulas to build truth tables").
  - The lesson's recommendation is the Policy V2 finding: review the week's topic. Its explanation and evidence are unchanged, and a Title ↔ Content rewrite of the topic toward the course is still offered.
  - Withheld drafts are recorded in the report (`suggestionsWithheld`, reason `off_topic_lesson`).
  - Partly aligned weeks, other weeks, CLOs and the description are untouched.
  - Nothing is rewritten automatically.
  - `server/lib/syllabuscheck/offTopicLessons.js`, applied in `server/lib/compliance/service.js`.
- **Faculty-selected core values:** a proposed values rewrite that names none of the core values the faculty wrote for that lesson is no longer offered as a replacement. It is held for review (`replaces_core_value`). The verdict says why (`value_replaced`) and asks the faculty member to keep their value and show what students do that expresses it, or to review the choice if it does not fit.
  - Rewrites that keep the selected value are offered as before.
  - A lesson with no value yet can still be offered one.
  - A value that does not fit the lesson is still judged and listed as NOT_ALIGNED.
  - Deterministic; the prompt is unchanged (its alignment-10 identity is kept).
  - `server/lib/syllabuscheck/engine.js`, `server/lib/syllabuscheck/verdict.js`, `src/i18n/hybrid.js` (English and Tagalog).
- **Unchanged:** judgements, findings, deductions, official scores, the 47 rules, the 7 VPAA relationships, the threshold of 79, Policy V2 (advisory, off in production), dynamic programs and references, PO inheritance, the active-year rule, Faculty Review and Adopt, and historical reports.
- **Tests:**
  - new `server/lib/syllabuscheck/recommendation-quality.test.js` (6 tests);
  - updated to the new policy: one assertion in `vpaa-conformance/staging-rehearsal.conformance.test.js` and one expectation (in three places) in `eval/phase3/manifest-phase3-1.json`, for the week 13 Compassion case, now review-required with `value_replaced`;
  - the generated `docs/faculty-review/phase3` files changed for that one record.
- **Offline replay of the final real Claude run through this code:**
  - identical official scores (0 and 69), deductions, seven-relationship coverage and Policy V2 labels;
  - weak syllabus: suggestions on the off-topic weeks went from 27 to 1 (23 withheld), and value-replacing drafts from 6 to 0 (held for review);
  - strong syllabus: value-replacing drafts went from 3 to 0, and nothing else changed.


---

### v1.78.0 — Whole-Syllabus Coordinated Improvement Plan & Candidate Pre-Validation
**Date:** November 9, 2026

- **Whole-Syllabus Improvement Plan (Flag: `SYLLABUS_CHECK_COORDINATED_PLAN`, off by default):**
  - Consolidates all root causes, affected weeks, and pedagogical adjustments into ONE unified, academically coordinated improvement plan after a single "Check with AI" action.
  - Cross-relationship root-cause analysis: coordinates Course Content, ILOs, Teaching-Learning Activities (TLAs), Assessment Tasks, and CLO mappings so changes never introduce predictable downstream mismatches.
  - Conflict reconciliation: Policy V2 authoritative suggestions supersede piecemeal legacy drafts, eliminating contradictory replacements for the same path.
  - Off-topic lesson coordination: replaces entire weekly modules (Content, ILO, TLA, and Assessment) with official curriculum topics, purging off-topic material coherently.
  - Full CLO mapping coverage: detects unmapped Course Learning Outcomes across all 18 weeks and coordinates mapping restorations.
- **Institutional Core-Value Immutability:**
  - Strictly protects faculty-selected LCUP core values against AI substitution drafts; records preserved values in `plan.preservations`.
- **Pre-Application Candidate Validation:**
  - Assembles the candidate syllabus in-memory and evaluates it against all 47 deterministic compliance rules and cross-week coverage metrics before faculty apply changes.
  - Classifies package status honestly as `VERIFIED`, `NEEDS_FACULTY_REVIEW`, `UNRESOLVED`, or `NOT_CHECKED`. Zero fabricated semantic validations.
- **Atomic Concurrency & Stale-Version Gate:**
  - Applies approved changes in a single SQL transaction protected by row locks and `sourceHash` verification (`POST /runs/:id/improvement-plan/apply`).
  - Rejects concurrent edits with HTTP 409 `stale_syllabus_version`. Rejects non-owners with 403. Approved syllabi remain strictly immutable.
  - Automatically records audit decisions in `syllabus_check_decisions` and logs activity. Never automatically submits or approves a syllabus.
- **Faculty Interface & Localization:**
  - Added `CoordinatedPlanPanel.jsx` with root causes breakdown, Original vs. Proposed diff view, validation badge, selective approval checkboxes, and "Apply All Approved Changes" action.
  - Full English and Tagalog localization in `hybrid.js`.
- **Unchanged:**
  - 47 deterministic compliance rules, 7 VPAA relationships, passing threshold 79, official scoring and deductions, dynamic programs and references, PO inheritance, and active-year restrictions.
- **Tests & Verification:**
  - `server/lib/syllabuscheck/coordinated-plan.test.js` (11/11 tests passing, verifying Scenarios A through J and feature flag isolation).
  - `server/routes/syllabusCheck.coordinatedPlan.routes.test.js` (5/5 tests passing, verifying routes, concurrency rejection, and atomic DB application).
  - Zero real AI API calls, zero cost, and zero live database modifications.


---

### v1.78.1 — Controlled Faculty Acceptance Testing & Staging Walkthrough
**Date:** November 9, 2026

- **Controlled Faculty Acceptance Testing (Isolated Staging):**
  - Verified Whole-Syllabus Coordinated Recommendation Engine across multi-week synthetic conflicts (Weak ILO, mismatched TLAs, unaligned assessments, and unmapped CLOs).
  - Passed all 12/12 staging academic acceptance criteria with 0 paid API spend and 0 live database modifications.
  - Verified atomic cross-field recommendation synthesis: modifying upstream learning outcomes automatically aligns connected activities, assessments, and mappings in ONE plan.
- **End-to-End Practical Faculty Walkthrough:**
  - Validated complete 10-step faculty workflow in isolated staging: Check with AI -> Review Coordinated Plan -> Side-by-Side Diff Inspection -> Selective Approval -> Atomic Apply All -> Re-check Conformance.
  - Confirmed already-correct syllabus components remain untouched, and institutional core values are strictly preserved against replacement.
  - Rejection and concurrency gates confirmed: stale version edits return HTTP 409, non-owner modifications return HTTP 403, and approved syllabi remain permanently immutable.
- **Full Offline Regression & Conformance Verification:**
  - 108/108 offline unit, route, and UI acceptance tests passing (including 6/6 Anthropic model lock, 12/12 OpenRouter legacy, 11/11 Coordinated Engine, 5/5 API routes, 8/8 Coordinated Plan UI, 28/28 VPAA UI, and 38/38 verdict/compliance tests).
  - Client production build (`npm run build`) passing with zero errors.
- **Production Safety Status:**
  - Live settings remain strictly protected (`SYLLABUS_CHECK_AI_PROVIDER=anthropic`, `SYLLABUS_CHECK_COORDINATED_PLAN=off`).
  - Production database `syllabus_cms_plus` (MySQL 3306) and Syllabus #111 (`approved`) remain untouched and pristine.

---

### v1.79.0 — Security Hardening: Private Uploads, Sign-in Limits, Session Renewal, Safe Errors
**Date:** November 12, 2026

From the security audit in `docs/security/SECURITY-AUDIT-REPORT.md` (batches A to D). No review-chain or alignment rule changed.

- **Uploaded files are private (SEC-01, SEC-03):**
  - The server no longer serves a public `/uploads` folder; every path under it answers 404, signed in or not.
  - New `GET /api/syllabi/:id/file` (`?version=<id>`, `&download=1`) sends an uploaded syllabus PDF only to its owner, or to a reviewer once the syllabus is not a draft. Signed-out callers get 401, everyone else 404.
  - The stored path is resolved inside the upload folder only, never the old avatars folder, and only for a PDF. The review window and the version history now link to this route.
- **Failed sign-ins are limited (SEC-02):**
  - Password sign-in: 10 failures per account and 50 per address in 15 minutes, then 429 with `Retry-After`. Google sign-in: 50 failed verifications per address. A correct sign-in is never counted.
  - New settings `SIGNIN_MAX_FAILURES_PER_ACCOUNT`, `SIGNIN_MAX_FAILURES_PER_IP`, `SIGNIN_WINDOW_MINUTES` (`server/lib/signInLimits.js`). They cannot be turned off; a bad value stops the server at startup, by name.
- **Sign-in no longer says which emails are registered (SEC-04):** an unknown email gets the same 401 "Invalid email or password" as a wrong password, after the same work. **Changed behaviour:** it used to answer 403 "Access Denied. Account not registered." (Google sign-in keeps its own message.)
- **Sessions (SEC-05, SEC-06):**
  - Every sign-in (password, Google, remembered device) starts a new session id.
  - Changing the password, or an administrator sending new credentials, ends the account's other open sessions; the session that changed the password continues on a new id.
- **Generated and temporary passwords (SEC-12, SEC-13):** a Google sign-in on an account that still has its generated password must choose its own first; a temporary password from "Forgot password" signs in once; a student registration password follows the same rule as every other chosen password (8 to 72 characters, a letter and a number). **Changed behaviour** for student registration: letters-only or digits-only passwords are refused.
- **Errors and headers (SEC-07, SEC-08, SEC-17, SEC-21):**
  - A final JSON error handler: malformed JSON 400, oversized body 413, unknown API path 404, anything else a generic 500. No stack trace, file path or SQL text reaches the client in any mode; the detail is in the server log.
  - Every route's own 500 answer is now "Something went wrong on the server. Please try again." instead of the error's message.
  - Every response carries `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Content-Security-Policy` and `Permissions-Policy`; `Strict-Transport-Security` in staging and production; no `X-Powered-By`. API answers are `Cache-Control: no-store`.
  - The JSON body limit is 700 KB, so a full syllabus save (512 KB of content) is no longer cut off at the 100 KB default.
- **Tests:** 33 new tests in `server/routes/syllabusFiles.routes.test.js`, `signin-security.routes.test.js` and `error-and-headers.routes.test.js`, wired into `npm test`. Two assertions in `passwords.routes.test.js` and one in `scripts/e2e/scenarios.cjs` were updated for the changed unknown-email answer.
- **Verification:** `npm test` 2,357 of 2,364 pass; the 7 failures are in the AI evaluation scripts (prompt-version labels) and touch none of the changed files. Conformance suites 276 of 276. `npm run build` passes. The browser E2E was not run.

---

### v1.80.0 — Database Hardening: Checked Connection Settings, a Least-Privilege Account, No Demo Passwords
**Date:** November 12, 2026

From the security audit in `docs/security/SECURITY-AUDIT-REPORT.md` (batch I: DB-01, DB-02, DB-05, DB-06, DB-07). No review-chain or alignment rule changed.

- **The database connection is configured and checked in one place (`server/lib/dbConfig.js`):**
  - New settings `DB_PORT`, `DB_SSL` (`off` or `required`), `DB_SSL_CA`, `DB_POOL_SIZE`, `DB_POOL_QUEUE`. The pool now has a connect timeout of 10 seconds and a queue of 200 waiting requests instead of an unlimited one.
  - In staging and production: `DB_HOST`, `DB_USER`, `DB_PASS` and `DB_NAME` are all required, `DB_USER` may not be `root`, and a database on another machine must use `DB_SSL=required`. A bad value stops the server at startup, by name.
- **The server checks its own database account before it listens:** it reads `SHOW GRANTS`, and in staging and production it does not start if the account can do more than SELECT, INSERT, UPDATE and DELETE (for example CREATE, ALTER, DROP, ALL PRIVILEGES or GRANT OPTION). Development only warns. Run the scripts in `server/db/` with a separate account by setting `DB_USER` and `DB_PASS` for that command only.
- **No demo passwords:** in staging and production the server does not start while any account still has a password hash from `db/seed.sql`. Development only warns.
- **If the database cannot be reached or checked at startup,** staging and production now refuse to start (before, the server started and `/api/health` reported the database as unreachable). **Changed behaviour.**
- **`db/init.js`** checks and quotes the database name before `CREATE DATABASE`.
- **Local browser E2E:** `scripts/e2e/stack.cjs` sets `DB_E2E_SCRATCH=1`, which turns the account rules into warnings only for a local database whose name contains "e2e"; it is refused anywhere else.
- **Tests:** 14 new tests in `server/lib/dbConfig.test.js`, wired into `npm test`.
- **Verification:** `npm test` 2,371 of 2,378 pass (the same 7 failures in the AI evaluation scripts as before). Conformance suites 276 of 276. `npm run build` passes. Not run: any real database (the grant check was tested against a fake that answers `SHOW GRANTS`), a TLS connection, and the browser E2E.

---

### v1.81.0 — Security Hardening: Input Types, COR Scan Limits, Daily AI Ceilings, a Lasting Audit Trail, Strict SQL Mode
**Date:** November 12, 2026

From the security audit in `docs/security/SECURITY-AUDIT-REPORT.md` (batches E, F, G, H, J). No review-chain or alignment rule changed.

- **Input types (SEC-14):** `PUT /api/syllabi/:id` and `POST /api/syllabi` refuse with 400 a title, course code, note, status or reviewer comment that is not text, and a curriculum that is not an id, before anything is read.
- **No sign-in token in the browser (SEC-16):** the browser no longer keeps the sign-in token in localStorage (it removes one an older version left) and no longer sends it; the session cookie authorizes everything, as before. The server still returns the token for older scripts. `middleware/canEditSyllabus.js` is marked as unused and unsafe to mount.
- **The public COR scan (SEC-10, SEC-22):** an upload must really be a JPG, PNG or WebP by its bytes and at most 40 megapixels (413 otherwise), checked before any OCR; at most 2 scans are read at once (503 with Retry-After); the per-address limit now uses the shared limiter that cleans up after itself; a refused upload gets a JSON reason. COR photos of registrations that were never finished are removed after an hour (`server/lib/corCleanup.js`, every 15 minutes).
- **Daily AI ceilings (SEC-11):** `AI_CHECKS_PER_USER_PER_DAY` (default 40), `AI_CHECKS_PER_DAY` (default 400) and `AI_REFINES_PER_USER_PER_DAY` (default 60), per calendar day in the Philippines (`server/lib/aiQuota.js`). Past them a check or a "Check & improve" is 429 and nothing is sent to the provider. Checks with AI checking off, and uploaded files, are not counted. The ceilings cannot be turned off; a bad value stops the server.
- **A lasting audit trail (SEC-15, DB-04):** new migration `npm run migrate-audit-retention` (with `--dry-run`). After it, deleting an account or a syllabus keeps its review history (`submission_logs`) and account activity, under the name it had; each sign-in line records the address and browser; a failed sign-in on an unregistered email is recorded with no account. Before the migration the app behaves as before. **The migration has not been run on any database.**
- **Strict SQL mode (DB-03):** `DB_SQL_STRICT=on` sets a strict sql_mode on every connection and is checked at startup. Off by default: turn it on only after the browser E2E has passed against a strict database.
- **Tests:** new `input-types.routes.test.js`, `cor-scan.routes.test.js`, `lib/aiQuota.test.js`, `lib/auditRetention.test.js`, and more in `lib/dbConfig.test.js`, `compliance.routes.test.js`, `syllabusCheck.refine.routes.test.js`. Assertions in `passwords.routes.test.js` and `enforcement.routes.test.js` were updated for the recorded unknown-email attempt and the two new activity columns.
- **Verification:** npm test 2,401 of 2,408 pass; the 7 failures are the same evaluation-script tests as before (anthropic-harness 4, stage-c3-eval 2, stage-e8-canary 1). Conformance suites 276 of 276. npm run build passes.

---

### v1.82.0 — Security Hardening: Expiring Generated Passwords, AI-Instruction Warning, No Sign-in Token, Patched Packages, Pinned CI, Sessions in the Database
**Date:** November 12, 2026

The last six open findings of `docs/security/SECURITY-AUDIT-REPORT.md` (SEC-12, SEC-20, SEC-16, SEC-19, SEC-24, SEC-09). No review-chain or alignment rule, score, finding or recommendation changed.

- **Generated passwords expire (SEC-12):** a password the system makes (new account, "Resend credentials", `db/create-admin.js`) works for `GENERATED_PASSWORD_DAYS` days (default 7) if it is not replaced; after that sign-in answers 403 `password_expired` with a way forward. Chosen passwords never expire. Needs `npm run migrate-password-expiry`; before it, nothing expires.
- **AI-instruction warning (SEC-20):** reviewers reading a syllabus see a warning listing places whose text reads like an instruction to the AI checker (`server/lib/aiInstructions.js`). Advisory only: what is sent to the AI, the coded check, the official score, the findings and the recommendations are unchanged, and nothing is blocked; a test proves each of these.
- **No sign-in token (SEC-16):** sign-in answers `{ user }` only; `middleware/jwt.js` and `middleware/canEditSyllabus.js` are deleted; `JWT_SECRET` is no longer required or read (the credential report and the Policy V2 preflight say it can be deleted); `jsonwebtoken` is removed.
- **Packages (SEC-19):** `npm audit --omit=dev` found 0 issues in the app and 3 in the server (body-parser high, nodemailer and qs moderate); all fixed by non-breaking updates. `multer` upgraded from 1.4.5 to 2.5.0. Both folders now report 0 vulnerabilities.
- **Pinned CI (SEC-24):** `actions/checkout` and `actions/setup-node` are pinned to the commits of v4.4.0; new `.github/dependabot.yml` proposes updates for the actions and both npm folders weekly.
- **Sessions in the database (SEC-09):** `SESSION_STORE=mysql` keeps sessions in the table `sessions` (`server/lib/sessionStore.js`, no new dependency): they survive a restart, are shared by every server process, end on the server, are stored under a hash of their id, and ending an account's sessions deletes them for every process. Always on in staging and production (memory is refused); development keeps memory by default. Needs `npm run migrate-session-store`.
- **Tests:** new `password-expiry.routes.test.js`, `lib/aiInstructions.test.js`, `lib/sessionStore.test.js`, and tests added to `signin-security.routes.test.js` and `review.routes.test.js`. `sessionSecret.test.js` and the VPAA security conformance test were updated because `JWT_SECRET` is no longer required.
- **Verification:** npm test 2,427 of 2,434 pass; the 7 failures are the same evaluation-script tests as before (anthropic-harness 4, stage-c3-eval 2, stage-e8-canary 1). Conformance suites 276 of 276. npm run build passes. npm audit --omit=dev: 0 vulnerabilities in the root and in server/.

---

### v1.82.1 — Evaluation Scripts: --legacy Is the Legacy Request Again; Tests Independent of a Local .env
**Date:** November 12, 2026

- **Cause of the 7 failing tests:** `scripts/eval-alignment.cjs` and `scripts/live-pipeline-eval.cjs` take every setting the environment does not name from a local env file (`.env`, `server/.env`). The tests named most settings but not `SYLLABUS_CHECK_REQUIREMENTS_ADVICE` or `SYLLABUS_CHECK_COURSE_CONTEXT`, so on a machine whose `server/.env` switched those on, the scripts printed a different prompt label, stage list, batch size and request count, and the tests failed. On a machine with no env file (CI) they passed.
- **A real defect behind it:** `--legacy` did not turn those switches off, so on such a machine a "legacy" (alignment-10) evaluation was not the alignment-10 request. Both scripts now turn off the requirements advice, the scoped course context and the scoped output fields with `--legacy`, and `live-pipeline-eval.cjs` also turns off Stage C3, whatever the env file says.
- **Tests:** a new helper (`server/lib/syllabuscheck/eval/neutralCheckerEnv.js`) names every `SYLLABUS_CHECK_*` setting the checker reads, read from the checker's own source, so no env file can fill one. A new test shows `--legacy` holds when those switches are on; it failed against the previous scripts.
- **The live checker is unchanged:** no file the application runs was edited; only the two evaluation scripts and their tests.
- **Verification:** `npm test` 2,435 of 2,435 pass. Conformance suites 276 of 276. `npm run build` passes.

---

### v1.82.2 — Improvement Plan: Off-Topic Weeks Are Replaced from the Syllabus Itself
**Date:** November 12, 2026

- **The defect:** when the whole-syllabus improvement plan (`SYLLABUS_CHECK_COORDINATED_PLAN=on`, off by default) found an off-topic week, it proposed a hard-coded Logic Circuits package for every course: Karnaugh maps, adders and subtractors, flip-flops and finite state machines as the topic, "Analyze and solve logic circuit problems" as the ILO, and circuit simulation as the activity. Applying it would have written another course's content into any syllabus.
- **The fix (`server/lib/syllabuscheck/coordinatedPlanEngine.js`):** the replacement is built only from the syllabus itself: its course title and the CLO the week supports (from the week's ILO tags, else the CLOs in turn), or the course description when there is no CLO. Each of the four fields is marked as a draft for the faculty member to finish (`semanticUnverified`), so the package is shown as NEEDS_FACULTY_REVIEW and never as verified, and its explanation says the plan does not know the course's real weekly topics. "Official curriculum content" is no longer claimed.
- **Unchanged:** every other part of the plan, the AI check, scoring, findings, recommendations outside this package, and the review chain.
- **Tests:** three new tests in `coordinated-plan.test.js` (a Programming syllabus gets nothing from another course and quotes its own CLOs; no title or CLO gives a "this course" draft; the engine holds no course-specific text). They failed against the previous engine.
- **Verification:** `npm test` 2,438 of 2,438 pass. Conformance suites 276 of 276. `npm run build` passes.

---

### v1.83.0 — AI Checker: Content First Everywhere
**Date:** November 12, 2026

The owner's decision of 12 November 2026: VPAA rule VR-14 (Course Content → ILO → Learning Activities → Assessment Tasks) applies everywhere. A week's course contents are the anchor; the ILO is fitted to them, never the contents to the ILO. Analysis: `docs/ai-checker-accuracy-review-2026-11-12.md` (cause C-6).

- **The check (`server/lib/syllabuscheck/engine.js`):** with Stage B off, an ILO-content answer no longer offers to rewrite the week's course contents; its finding stays as advice. A real check of IT 202 on 5 November 2026 (Stage B off) had rewritten the contents of 10 weeks to fit their ILOs. With Stage B on nothing changes: the rewrite was already withheld while the contents fit the course, and the contents are still rewritten when Content-course finds them off-course.
- **The whole-syllabus plan (`wholeSyllabusPlan.js`):** when the plan rewrites an ILO and it no longer fits its week's content, the plan re-fits the ILO with one rewrite for its CLO and its content together, and holds that week's activities, tasks and values until it settles. It never rewrites the content to suit the ILO. Before, it rewrote the ILO, then the content, activity and task to match the new ILO.
- **Unchanged:** every score, deduction, finding and gate (ILO-content is advisory and costs no points), the prompt and its version, and the review chain.
- **Tests:** `content-first.test.js` (5 tests). The fake rewriter in `wholeSyllabusPlan.test.js` now keeps the week's content, as the real rewrite prompt does, and three of its expectations now describe the content-first plan. Two tests in `revision-cycles.test.js` and `suggestionOrder.test.js` used an ILO-content rewrite of the contents only as an example; they now use the course description and a Content-course rewrite.
- **Rules document:** `scripts/export-checker-rules.cjs` now states the content-first rule (section 5b). `docs/ai-checker-rules.md` itself was **not** regenerated: its content is pinned by hash in the Stage C3 addendum and Phase 3 tests, so it changes only with an owner-approved re-freeze. (Corrected in v1.84.0; this line first said the document had been regenerated.)
- **Verification:** `npm test` 2,443 of 2,443; conformance 276 of 276; VPAA UI 28 of 28; `npm run build` passes. Not run: any real AI model.

---

### v1.84.0 — AI Checker: Reliability Refactor (Rules Unchanged)
**Date:** November 12, 2026

Changes to how the AI Checker sends its questions and protects its budget. The rules, the relationships asked, the prompt wording, every score, deduction, finding and gate, and the review chain are unchanged. Analysis: `docs/ai-checker-accuracy-review-2026-11-12.md` (section 9).

- **CLO questions and the course description (`server/lib/syllabuscheck/gemini.js`):** when CLO relationships are sent without the course description (`SYLLABUS_CHECK_CLO_DESCRIPTION=off`, rule M14), a request no longer mixes a CLO relationship with one that reads the description. Before, a mixed request had the description removed for all of its relationships, so Content-course, Ref-relevance, Title-description or Description-plan could be judged without the text they are about, and the answer was reused later as if the description had been sent. The default (switch unset: the description travels with every request) is unchanged. A check with the switch off may send a few more requests (the offline benchmark went from 51 to 53).
- **Per-check spending limit (`server/lib/aiQuota.js`, `server/index.js`):** `SYLLABUS_CHECK_AI_MAX_COST_USD` is now required in staging and production whenever an AI provider is configured, and a malformed value stops the server in any mode, naming the setting. Without it one check was bounded only by 512 requests and 8,000,000 reserved tokens. Development is unchanged (optional). Added to `server/.env.example` and `docs/deployment/production.env.template`.
- **Replay of the recorded real run (`real-run-replay.test.js`, 4 tests):** the 143 answers Claude Sonnet 5.5 gave for IT 202 on 5 November 2026 are fed back through today's engine by relationship id, offline. It pins that the same relationships are asked, that the 85 deductions and 118 points are exactly the recorded ones, that no ILO-content answer rewrites the contents (the run had proposed 10), and that every other rewrite the run proposed is still offered or listed as waiting for the field above it. Two of the four tests fail on the engine before v1.83.0.
- **Not changed, on purpose:** the M14 default (an earlier owner decision, pinned by the VPAA-DESCRIPTION-EXCLUSION-DEFAULT conformance test); the prompt wording of ILO-content and ILO-CLO (needs approval and a paid comparison, review R-3); the scoring (R-4); the stages switched on in `server/.env` (R-1); Policy V2 (R-5).
- **Tests:** `clo-description.test.js` (4; the mixed-request case failed before the fix), three new cases in `aiQuota.test.js`, `real-run-replay.test.js` (4). `optimization.test.js` request counts updated (51 to 53) with the reason.
- **Verification:** `npm test` 2,454 of 2,454 plus the UI suites; conformance 276 of 276; VPAA UI 28 of 28; `npm run build` passes. Not run: any real AI model.

### v1.85.0 — AI Checker Re-plan, Phase 1: Owner Rules as Data, Extraction and Fixed Rules

Start of the re-planned checker (`docs/ai-checker-replan.md`), built offline in `server/lib/syllabuscheck/pipeline/`. **Not wired into the running server; `engine.js`, the prompt and the official score are unchanged.** No AI model was called.

- **`rules.js`:** the owner's rules and the six answers of 2026-11-12 as data. It holds:
  - the dependency chain (EGA/PO, then CLO 1-4, Content, ILO, Activities, Tasks, Values; references on the side);
  - the four fixed CLO classifications;
  - Week 1 orientation and Week 2 first topic;
  - at least 2 activity options per topic week;
  - a core value every week, including orientation and exam weeks;
  - references within 5 years (older ones go to review);
  - the AI checklists per relationship;
  - `verdictOf`, where code sets the verdict from yes/no/unclear answers and an incomplete answer is never a pass;
  - `deductions`, with per-area caps that are still null because the cap values are not chosen.
- **`extract.js`:** turns a syllabus and its masters into one map (course, EGAs/POs, CLOs with their required level, weeks with kind, ILOs, activity and task items, named values, references). Each field has a text fingerprint.
- **`fixedRules.js`:** the rules that need no AI. It checks CLO count and fixed level (with a mechanical fix), at least one PO and one EGA per CLO, unknown tags, CLO coverage by ILOs, Week 1 orientation, Week 2 first topic, content first, ILO-to-CLO tags, activity options, tasks, weekly values, APA 7th format, and recency (review only). Findings are ordered top-down.
- **Offline result on the real IT 202 syllabus:** 21 findings and 2 review items (CLO 2-4 saved as Introductory, CLO 4 reached by no ILO, 4 untagged ILOs, 4 weeks with values not among the six, 9 references not in APA 7th format, 2 references from 2019).
- **Tests:** `pipeline/rules.test.js` (6), `pipeline/extract.test.js` (5), `pipeline/fixedRules.test.js` (8), added to `npm test`.

### v1.86.0 — AI Checker Re-plan, Phase 2: Checklist Judging, One Verified Repair Plan, Reference Lookups

Built and tested offline with scripted model answers only (`docs/ai-checker-replan.md` section 6). **Not wired into the running server; no real AI model was called; `engine.js`, the prompt in use and the official score are unchanged.**

- **`pipeline/prompt.js`:** one system prompt with the owner's rules, identical for every request. The AI answers yes/no/unclear per checklist item with a quote and an explanation. An answer is refused when an item is missing, invented or invalid, when the question is answered twice, or when the quote is not in the texts. Texts used by several questions are sent once per request. The rewrite prompt sends the field, its parents, the failed items and its children.
- **`pipeline/judge.js`:** the questions of the whole syllabus, grouped into one request for the CLOs, one per week and one for the syllabus (sequence, references). The course description is never sent.
  - Answers are stored by exact text, model, prompt and rules version, so a re-check asks only what changed.
  - A refused answer is asked once more. A provider failure is not retried and never passes.
  - Code sets the statuses: ok, failing (root), waiting (parent failing), review (an extra tag that does not fit; no penalty), advice, not_checked.
- **`pipeline/plan.js`:** one repair plan, built top-down.
  - Mechanical fixes come first (fixed CLO classification, APA repairs from the reference's own characters).
  - Then root fields are rewritten against settled parents, and the copy is re-checked. Content is never rewritten to suit an ILO.
  - Limits: 3 rounds, and at most 2 rewrites per field.
  - Each change is marked VERIFIED, NEEDS_FACULTY_REVIEW or NOT_CHECKED. The plan also lists what is unresolved, what only the author can fix, and any regression. `applyPlan` applies all changes or only the accepted ones.
- **`pipeline/lookup.js`:** reference existence checks, run only when asked.
  - Crossref for DOIs (title compared), Open Library for ISBNs and for book titles, and the existing safe link checker for links.
  - A broken link is a finding. A source not found, or a DOI/ISBN that belongs to another work, goes to faculty review, never "fake".
  - Only the reference text is sent.
- **`rules.js`:** added CONTENT-SEQUENCE (advice), and ILO-CLO now counts the best of an ILO's CLO tags.
- **Measured offline:**
  - 18-week test syllabus: 142 questions in 20 requests.
  - Real IT 202 syllabus: 153 questions in 13 requests (the recorded real run used 22).
  - Convergence test: a syllabus with 13 misalignments is repaired with 5 AI rewrites and 1 mechanical fix. The re-check after `applyPlan` asks 0 questions and shows 0 misalignments.
- **Tests:** `pipeline/judge.test.js` (11), `pipeline/plan.test.js` (10), `pipeline/lookup.test.js` (5); `rules.test.js` updated. 45 pipeline tests in all.
- **Next (Phase 3, needs approval):** a provider adapter with a cost cap, shadow mode in the server, and one small paid run on synthetic syllabi.

### v1.87.0 — AI Checker Re-plan, Phase 3: Claude Provider with a Cost Cap, Shadow Mode, Guarded Paid-Run Script (Not Run)

Built and tested offline (`docs/ai-checker-replan.md` section 7). **No real AI model was called. The shadow is off by default; the official check, findings, score and suggestions are unchanged.**

- **`pipeline/provider.js`:** the pipeline's `ask` and `rewrite` on the existing direct Claude transport (`anthropicClient.js`).
  - A cost cap is required: nothing is sent without it.
  - Every request is reserved against the per-run budget before sending and settled at the tokens reported. The request that would pass the cap is refused before it is sent.
  - Usage is recorded.
  - The reuse key includes the model's thinking mode and effort.
- **Answer format:** checklist items are now a list of `{id, answer}`, because Anthropic structured outputs need `additionalProperties: false` on every object. Both schemas pass `anthropicSchema.js`.
- **`pipeline/shadow.js` + 11 lines in `server/lib/compliance/service.js`:**
  - `SYLLABUS_CHECK_REPLAN=shadow|plan` (default `off`) runs the new pipeline after the official result is built and attaches `hybrid.replanShadow` for comparison only.
  - The shadow has its own required cap (`SYLLABUS_CHECK_REPLAN_MAX_COST_USD`) and runs on the direct Anthropic provider only.
  - Answers are kept in a bounded in-memory store. A failure is caught and recorded.
  - Documented in `server/.env.example`; `production.env.template` sets it to `off`.
- **`scripts/replan-paid-run.cjs` + `pipeline/eval/synthetic.js`:** the first paid run, prepared and NOT run.
  - It uses one synthetic syllabus (SYN 101 Introduction to Python Programming, invented outcomes and masters) with 8 planted problems.
  - It checks the syllabus, builds the repair plan, re-checks with the plan applied, and reports what was found, fixed and left.
  - Dry run by default. A live run needs `--live --confirm-paid --max-cost <usd>` (at most $5).
  - It refuses before reading `server/.env` when the confirmation or cap is missing, and refuses to overwrite an earlier result.
  - It runs behind the evaluation guard, the $10 spend register (currently $2.92 charged), the pipeline's own cap, and a blocked global fetch.
  - Dry run: 138 questions in 20 requests, schemas accepted.
- **Tests:** `pipeline/phase3.test.js` (11). It covers the cost cap stopping before send, provider failures, shadow off, skipped and untouched-official cases, the service hook, the script's refusals, and the synthetic syllabus end to end (all 8 planted problems found, plan converges, re-check asks nothing).
- **Not done:** the paid run (needs the owner's approval of a budget, and the Anthropic balance checked first); faculty review and answer key; area caps; persisting shadow answers; shadow in the UI.

### v1.88.0 — AI Checker Re-plan: Cached Prompt Layout and a Spend-Based Cost Cap

Offline; no AI model was called. Prompt version `replan-prompt-3` (`docs/ai-checker-replan.md`, "Prompt caching layout and the cost cap").

- **Checklists once:** every relationship's checklist is written once in the cached rules block instead of with each question, and requests are compact JSON.
- **Shared SYLLABUS CONTEXT:** a second cached system block, identical for every request of a check. It holds the course title, POs, EGAs, fixed CLO classifications, CLOs and the weekly topic list (never the course description). Questions refer to those texts by label.
- **`anthropicClient.js`:** `system` may be a list of up to 4 texts, each with its own cache marker. A single text is sent exactly as before (test added).
- **Estimated input cost of one check (offline):**
  - IT 202: $0.0622 to $0.0377.
  - Synthetic course: $0.0503 to $0.0309.
  - About 39% less input, almost all from the checklists and compact JSON. The context block on its own is about cost-neutral, and is kept so every request sees the whole syllabus.
  - Input was about 12% of the last real run's cost (output about 86%), so the whole check is about 5% cheaper.
- **Cost cap fixed (`pipeline/provider.js` `spendCap`):** the Phase 3 provider reused a reservation budget that never released worst cases, so a $2 cap stopped after about 10 requests that cost a cent each. A request is now sent only while the amount already spent plus its own worst case fits the cap. The reservation is released when the answer settles, and a timeout settles at its worst case.
- **Tests:** judge (2 rewritten, 2 new) and phase3 (4 new: two cached system blocks through the real client, the single-text form unchanged, spend-based cap, timeout settling). `npm test` 2,516 of 2,516.

### v1.89.0 — AI Checker Re-plan: Five Prompt Fixes (replan-prompt-4)

Offline; no AI model was called. Details in `docs/ai-checker-replan.md`, "Prompt fixes".

- **Values in orientation and examination weeks:** VALUE-ILO now accepts the orientation or the examination itself, so the owner's every-week rule no longer fails those weeks by construction.
- **Bloom levels:** the prompt gives the Bloom scale with typical verbs, and the Bloom levels of each CLO classification (`rules.js` `BLOOM_ORDER`). The mapping is a working one inferred from the labels and marked not yet confirmed (`BLOOM_SOURCE`). Owner confirmation is needed before the paid run.
- **Answer calibration:** "no" means the text is there and lacks it; "unclear" only for a missing, cut-short or ambiguous text.
- **Rewrite format:**
  - A FIELD FORMAT per field, the checklists in the rewrite prompt, and an instruction not to copy a parent's wording.
  - `validateRewrite` refuses multi-line outcomes, teacher-centred ILOs, and a CLO or ILO that copies its parent word for word.
- **Worked examples:** five invented calibration examples and an answer-format example, in the cached rules block.
- **Cost:** estimated input cost of one IT 202 check $0.0377 to $0.0402 (the original was $0.0622).
- **Tests:** `pipeline/prompt.test.js` (8). `npm test` 2,524 of 2,524.

### v1.89.1 — AI Checker Re-plan: Bloom Mapping Confirmed by the Owner

- The owner confirmed the Bloom levels of the CLO classifications on 2026-11-12: CLO 1 remember, understand; CLO 2 apply, analyze, evaluate; CLO 3 apply, create; CLO 4 evaluate, create.
- `pipeline/rules.js` `BLOOM_SOURCE` records the confirmation, and `prompt.test.js` pins the mapping. The prompt text is unchanged (`replan-prompt-4`).

### v1.90.0 — AI Checker Re-plan: Shadow Mode On in Development, and a Read-Only Shadow Report

- **Development `server/.env`** (not in git): `SYLLABUS_CHECK_REPLAN=shadow` and `SYLLABUS_CHECK_REPLAN_MAX_COST_USD=2`, at the owner's request. A dry check confirmed the shadow is ready on claude-sonnet-5-5. It takes effect after a server restart. Official results still come from the old checker.
- **`scripts/replan-shadow-report.cjs`:** lists stored checks with a shadow result next to their official score and deductions. `--run <id>` shows everything the new checker found. It runs only SELECT statements inside a read-only transaction, sends nothing to any AI provider, and prints no setting.
- **`pipeline/shadowReport.js`:** the formatting, tested by `pipeline/shadowReport.test.js` (4 tests).
- **Not verified:** a run against the development database (MySQL refused the connection on 2026-11-15), and any shadow result from a real check.

### v1.90.1 — AI Checker Re-plan: Judge Requests Three at a Time

- **`pipeline/judge.js`:** the new checker sent its requests one at a time. With real answers taking 20-30 s each, that would have added about 7-10 minutes to every AI check in shadow mode, and the server runs one AI check at a time.
  - The first request is now sent alone, so it writes the prompt cache.
  - The rest go 3 at a time, like the live checker (option `concurrency`, 1-6).
  - Results do not depend on the order answers arrive.
  - The spend cap and the evaluation guard already count requests in flight.
- **Test:** `judge.test.js` checks at most 3 in flight, the first request alone, and the same verdicts as sending one at a time. `npm test` passes.
- **Still expected:** a shadow check adds roughly 4 minutes (estimate) to an AI check, because the shadow runs after the official result within the same request.

### v1.90.2 — AI Checker Re-plan: First Paid Run, and Regressions Counted per Change

- **First paid run** (by the owner, 2026-11-15; `docs/ai-checker-replan-run/synthetic-1/`). Synthetic course only.
  - 50 requests, about $0.37 at list prices ($0.39 by the guard); spend register $3.31 of $10.
  - All 8 planted problems found. The plan made 1 mechanical fix and 13 AI rewrites in 2 rounds, and nothing was left unresolved.
  - The re-check after the plan asked 0 questions and found 0 misalignments.
- **Bug fixed (`pipeline/plan.js`):** a single advice-only relationship that slipped (Week 2 TASK-ILO, which costs no points) had marked all 13 AI changes NEEDS_FACULTY_REVIEW.
  - Now only SCORED relationships count as `regressions`, and a regression holds back only the changes it involves (the field it judges, or a field it is judged against or depends on).
  - Advice relationships that slip are listed apart as `adviceRegressions` (also in the shadow result and the paid-run summary).
  - Re-scored offline, the paid run's 13 AI changes would all be VERIFIED. The saved run files are left as recorded.
- **Tests:** `plan.test.js` adds 2 (the paid run's advice slip; a scored regression holding back only its own change). `npm test` passes.
- **Owner question from the run:** with the CLO 1 Bloom mapping (remember, understand), the model turned "Write and run a simple Python program" into "Describe the steps for installing Python...". This is correct by the rule, but debatable for an introductory programming week.

### v1.90.3 — AI Checker Re-plan: CLO 1 Also Takes "Apply" (replan-prompt-5)

- The owner added **apply** to the Bloom levels of CLO 1 (Introductory) on 2026-11-15, after the first paid run turned "Write and run a simple Python program" into "Describe the steps for installing Python...". CLO 1 is now remember, understand, apply; CLOs 2-4 are unchanged.
- `pipeline/rules.js` `CLO_LEVELS` and `BLOOM_SOURCE` record the change.
- The prompt version is now `replan-prompt-5`, so no answer stored under the old mapping is reused.
- `prompt.test.js` pins the new mapping. `npm test` passes.

### v1.90.4 — AI Checker Re-plan: First Shadow Check, and Review, Unchecked and Advice Items Kept

- **First shadow check in the app** (2026-11-15, check 444, CAPSPRO1 Capstone Project 1).
  - Old checker (official): score 69, 27 deductions (31 points), 13 suggestions, 37 requests, about $0.52.
  - New checker: 7 misalignments (7 points), 9 for review, 2 not checked, 18 requests, 52 s, about $0.27.
  - The new checker's findings: 5 activity sets that list sequential steps rather than alternatives for diverse learners; CLO 4 at the apply level; a Week 1 ILO slightly beyond its content.
- **`pipeline/shadow.js`:** the shadow result now also keeps the items that went to faculty review (extra tags; fixed rules a person must confirm), the items not checked, and advice, each with what it was judged against and why.
- **`pipeline/shadowReport.js`:** `--run` shows them in three sections. A check stored before this change says the lists were not kept.
- **Test:** `shadowReport.test.js` adds 1. `npm test` passes.

### v1.91.0 — AI Checker Re-plan: Answers Kept in the Database (replan_answers)

- **Why:** the second shadow check of CAPSPRO1 (check 445) repeated the 5 main findings of check 444, but 3 borderline findings flipped, because the stored answers lived only in server memory and a reload had cleared them.
- **New table `replan_answers`** (`server/db/replan-answers-ddl.js`, `schema.sql`).
  - Keyed by a SHA-256 of the rules version, prompt version, model, course and the exact texts; it holds the verified answer.
  - Not linked to a syllabus, and not read by the live checker or the official score.
  - Migration: `npm run migrate-replan-answers` (additive, idempotent, `--dry-run`). Rollback: `DROP TABLE replan_answers;`.
- **Applied to the development database on 2026-11-15** after a full backup (`LCUP-DB-Backups/2026-11-15-pre-replan-answers-migration`, sha256 835fdcdf, 56 tables, 958 rows, unchanged during the backup). Afterwards: 57 tables, `replan_answers` added, no existing table changed.
- **`pipeline/answerStore.js`:** memory in front of the database. One read and one write per check. A missing table or database error falls back to memory and says why. `pruneUnused(db, days)` exists but never runs automatically.
- **`pipeline/judge.js`:** waits for an asynchronous store. Reuse keys are now full SHA-256 values.
- **`pipeline/shadow.js` + `compliance/service.js`:** the shadow gets the server's database. `shadowReport.js` shows where the answers were kept.
- **Tests:** `pipeline/answerStore.test.js` (7), including a simulated restart that reuses all 142 answers and asks the AI nothing. `npm test` 2,539 of 2,539.

### v1.92.0 — AI Checker Re-plan: Official Mode Behind a Switch; 5-Point Area Caps

Owner decisions of 2026-11-15: make the new checker official behind a switch (to cut the cost of running both), and lose at most 5 points per area. Built and tested offline. The development server still runs `SYLLABUS_CHECK_REPLAN=shadow` until the setting is changed.

- **`SYLLABUS_CHECK_REPLAN=official`** (`pipeline/official.js`, hooked into `compliance/service.js`).
  - The old engine runs with its AI step off: no-AI rules, base score and links, at no AI cost.
  - The new checker then fills the AI part of the same report: `alignment`, its points in `deductions`, and its verified repair plan as drafts in `suggestions`. Score, ready, status, band, conformance and summary are recomputed.
  - Used only with the direct Anthropic provider, AI checking on, and `SYLLABUS_CHECK_REPLAN_MAX_COST_USD` set. Otherwise, and with Policy V2 on, the old checker runs as before.
  - A failure never makes a score.
  - The old whole-syllabus and coordinated plans are skipped in official mode.
- **Area caps:** `pipeline/rules.js` `AREA_CAPS` is now 5 per area (it was null).
- **No points:** extra tags, advice and the new checker's no-AI rules are advisory and cost no points. A draft that fixes a rule is linked to it.
- **Known limit:** "Check & improve" on a new-checker draft still uses the old checker's refine step.
- **Tests:** `pipeline/official.test.js` (7: the real old engine with AI off plus the new checker on a scripted model; the app's `hybridView.js` shows the problems, links the drafts and can apply each one; caps; extra tags; provider failure; the service hook). `rules.test.js` updated for the caps. `npm test` 2,546 of 2,546.

### v1.92.1 — AI Checker: First Official Check, the DSP Test, and Three Fixes

- **First official check** (2026-11-15, #446, CAPSPRO1).
  - Score 93 (the old checker gave 69); 8 misalignments, 7 points (activities reached the 5-point cap).
  - 8 drafts: 7 verified, plus CLO 4 held for faculty review because the rewrite dropped "collaborative" and with it the link to PO 3.
  - $0.40, 105 s, 166 answers stored.
  - The dashboard's AI Quality Snapshot reads it unchanged (final 93; Assessment 67 is the lowest area).
  - The owner kept the activities rule strict, capstone weeks included.
- **DSP test** (CpE-404 #111, BSCPE; new `scripts/replan-syllabus-run.cjs`).
  - It exports one syllabus read-only, then runs official mode outside the app under the evaluation guard. Owner-approved $1 cap; $0.58 spent ($0.61 by the guard); spend register $3.92 of $10.
  - The output in `docs/ai-checker-replan-run/syllabus-111/` holds real syllabus text: keep it local.
  - The official check worked: 125 of 125 answered, score 72, 56 findings (CLO 3 and CLO 4 levels, value-webbing ILOs in technical weeks, single-lecture activities, values outside the six).
- **Fixed: the test script built the repair plan twice.** The second round of rewrites ran into the cap and 81 requests were refused. `officialize` now hands back the plan it made (`out`), and the script re-checks with it.
- **Fixed: unknown answers were counted as regressions.** An answer that could not be had after the plan (refused, failed or "unclear") is now listed under `notRechecked` and holds back only its own field's change.
- **Fixed: two ILOs of the same week were rewritten into near copies** ("Compare FIR and IIR filters ..." twice).
  - Rewrites now see the current text of the other ILOs of the same week, or of the other CLOs (`plan.js` `siblingsOf`), under `keepDistinctFrom`.
  - `validateRewrite` refuses a near copy: 80% of words shared, or the same leading verb with 45% and at least 5 words shared.
  - The rewrite prompt has its own version (`replan-rewrite-2`), so stored judge answers (`replan-prompt-5`) stay valid.
- **Tests:** plan (2), official (1), prompt (1). Two existing plan tests first caught an over-eager near-copy rule ("Explain ..." CLOs), corrected before release. `npm test` passes.

### v1.92.2 — AI Checker: DSP Re-run, Fixes Keep Working Links, and a Rule for Copied ILOs

- **DSP re-run** (2026-11-15, owner-approved $1 cap, one request at a time; `docs/ai-checker-replan-run/syllabus-111/rerun-1/`, real syllabus text, keep local).
  - The official check was the same as the first run: 125 of 125 answered, score 72.
  - The plan wrote 30 fixes and verified 24 (the first run: 3 of 22). No near-copy rewrites, and no unknown answer counted as a regression.
  - It stopped at the cap with 8 fields waiting. $0.74 estimated ($0.77 by the guard); spend register $4.69 of $10.
  - Three CLO rewrites dropped a PO link the faculty had tagged and were held for review.
  - `scripts/replan-syllabus-run.cjs` gains `--label` (a later run in its own subfolder) and `--concurrency` (1 under a tight cap, so worst cases reserved for requests in flight do not crowd out the budget). `officialize` and `buildPlan` pass `concurrency` through.
- **Fixes keep working links** (`plan.js` `jobOf` `keep`, prompt `mustKeep`, rewrite prompt `replan-rewrite-3`). A rewrite is told which of its field's relationships fit now (a PO or EGA the CLO already supports) and must keep them. The judge prompt (`replan-prompt-5`) is unchanged, so stored answers stay valid.
- **New no-AI rule ILO-DUPLICATE** (`fixedRules.js`).
  - It flags a near copy of an earlier ILO in the same week, and the same text as an ILO of an earlier week (case and punctuation ignored). The first occurrence stays.
  - The plan rewrites the copy (`judge.js` FIXED_TEXT_RULES).
  - On DSP it finds 20 copied ILOs (the same three ILOs across 8 weeks), which neither checker had flagged before.
  - `nearCopy` moved to `extract.js` (shared).
- **Tests:** fixedRules (1), plan (1), prompt updated. `npm test` passes.
- **Note:** DSP now has 20 more fields to rewrite, so a full plan for it may approach the $2 per-check cap in the app.

### v1.92.3 — AI Checker: UI Check of the First Official Run

- **UI check** (2026-11-15, offline, read-only).
  - The real AI Checker card (`src/views/ComplianceCard`) was rendered from stored run #446 in the shape GET /api/compliance returns, for the author and the admin view.
  - Both rendered with no React errors or warnings: score 93% shown, all 8 suggestions shown with their buttons, points on screen equal to points deducted, every suggestion applyable and linked to its problem.
  - The frontend build passes.
  - The live page in the browser pane was not checked (it was not signed in).
- **Fixed (`pipeline/official.js`):** a question the AI answered "unclear" showed as a red "fix first" problem, though it costs no points and is not a problem in the syllabus. It now shows as an advisory "<relationship> (not checked)" note. This applies to new checks; #446 keeps its stored form.
- **Test:** `official.test.js` (1). `npm test` 2,553 of 2,553.

### v1.92.4 — Dashboard: the AI Quality Snapshot Counts Only AI-Checked Syllabi

- **Problem:** the snapshot and the "Average of your latest AI checks" stat averaged every syllabus's latest score, including checks made with AI checking off. Those scores come from the no-AI rules alone. On the development database, DSP's rules-only 95 (check #439) stood beside CAPSPRO1's AI-checked 93 (#446), and the admin view showed only DSP's 95.
- **`server/routes/compliance.js`** (GET /api/compliance?syllabus=all): the summary adds `aiChecked`, `notAiChecked`, `aiAverage` and, per area, `aiRules` and `aiFinal`, counting only checks whose AI step completed (`aiStatus` ok). The existing `average`, `passed` and `areas[].average` / `final` are unchanged (the Analytics page uses them).
- **`src/lib/complianceStats.js`:**
  - `snapshotOf` uses the AI-only numbers when the server sends them, and returns `notAiChecked`.
  - `aiAverage` leaves out runs whose `aiStatus` is not ok. A run without `aiStatus`, from an older server, counts as before.
- **`src/views/DashboardView.jsx` + `src/theme.css` + `src/i18n/dashboardStats.js`:** under the rings, "1 syllabus is not included: its latest check ran without AI." (or "{count} syllabi ..."), in English and Filipino.
- **Tests:** `complianceStats.test.js` (2, including the real dev numbers) and `compliance.routes.test.js` (the new summary fields).
- **Verification:** `npm test` 2,554 of 2,555 in the full run. The one failure was a Windows file lock writing `docs/lcup-approved-offline/deterministic-baseline.json` in a conformance test, which passes on its own (10 of 10). `npm run build` passes.

### v1.92.5 — Dashboard: What the Assessment Ring Covers

- The AI Quality Snapshot charges the AI Checker's learning-activity findings to the standard's Assessment Alignment area (`finalAreas.js` `areaOf`). On CAPSPRO1, the Assessment ring's 67 came from activities, not from assessment tasks.
- The six institutional areas and the scoring are unchanged. The Assessment ring's tooltip now says what it covers: "Assessment covers the assessment tasks, grading and requirements, and the learning activities." It is joined to the "Lowest: ..." tooltip when that ring is the lowest, in English and Filipino.
- Moving activity findings to another area was offered as an alternative and not made (owner decision).
- **Verification:** `npm run build` passes, the localization audit passes (2,842 bilingual keys), `npm test` 2,555 of 2,555.

### v1.92.6 — Faculty AI Checker: Only Editable Syllabi Can Be Checked

Owner decision of 2026-11-15: on the faculty side, the AI Checker lists and checks only a syllabus the faculty can still edit (a draft, or one returned for revision or rejected). A submitted syllabus is with the reviewers, and an approved one is final; neither is offered or checked. Administrators and reviewers are unchanged.

- **`src/views/AIChecker.jsx` (faculty view):**
  - The subject dropdown lists only the faculty's own, not archived syllabi in `EDITABLE_STATUSES` (the shared list: draft, for_revision, rejected). Before, it was every status except approved.
  - A syllabus opened from the builder that has since been submitted is no longer kept selected.
  - With nothing to check but submitted or approved syllabi, the page says why (new key `aiChecker.nothingToCheck`, English and Filipino) instead of "No syllabi yet".
- **`server/routes/compliance.js`:** POST /syllabi/:id/compliance/recheck refuses a faculty owner's check of a syllabus outside `EDITABLE_STATUSES` (409, code `submitted`, "...with the reviewers..."), so the rule holds even without the page. Approved keeps its own refusal. A reviewer's own syllabus keeps its flow.
- **Tests:** `compliance.routes.test.js` adds a status matrix (draft, for_revision and rejected checked; submitted and under_review refused; approved refused). Three tests that had an owner re-check a submitted syllabus now make that check while it is still a draft, and assert that the re-check is refused. `npm test` 2,556 of 2,556; build and localization pass.

### v1.92.7 — Dashboard: Minimalist View Analytics Window

A visual redesign of the View analytics window on the dashboard's Program Compliance card, and faculty no longer see its label. No number is counted differently. The Analytics page, the Program Compliance rows and the AI Quality Snapshot are unchanged (a redesign of them was tried and reverted at the owner's request).

- **View analytics (`src/components/ProgramTrendModal.jsx`, `src/theme.css`):** the three summary figures sit in one row split by hairlines (no boxes), the chart has no second frame, the legend entries are flat (no pill borders), the eyebrow is muted, the close button is quiet, the tooltip is the card colour with a lighter shadow, and the hover fill is a 12% wash. The chart's right margin is 170 (was 130), so a long end label such as "BSIT-CYBERSECURITY 0%" stays inside the window. At phone width the table no longer scrolls sideways (tighter cells, each compliance bar over its value). Markup, controls and numbers are unchanged.
- **Faculty dashboard (`src/views/DashboardView.jsx`):** the Program Compliance card no longer shows a "View analytics" label; the overall trend is the reviewers' view (admin, dean, Asst. VPAA, LIC Director, VPAA), who keep the button.
- **Tests:** `tests/i18n-ui.test.jsx` also asserts that the faculty dashboard has no "View analytics" label.

### v1.92.8 — Analytics Page: Minimalist Charts and Tables

A visual redesign of the Analytics page for every role (faculty see "My Analytics"; admin, dean, Asst. VPAA, LIC Director and VPAA see the program view). No number is counted differently: every value still comes from `complianceStats.js` (`aiAverage`, `scoreBands`, `programScores`) and the stored checks, as before. The dashboard is not touched.

- **How syllabi scored (`src/views/Analytics.jsx`):** the donut filled to the average while its legend showed band shares. It is replaced by the average AI score as one large number, a thin bar split into the high, medium and low bands (the green, gold and red status colours, each named in the legend with its share), and "Shares of N scored syllabi". With no AI-completed check, the average shows "—" (before: "null%").
- **Average AI score by program / AI score of each syllabus:** horizontal bars in one colour (the primary button blue) with the value at the tip and a hairline 0–100 scale, instead of gradient columns. Long course codes wrap instead of crowding. Hovering a program bar gives its checked count.
- **Chart / Table:** both charts have a switch (`ViewSwitch` in `src/components/ui.jsx`, the same control and keys as the View analytics window). The tables give every value. `ChartCard` takes an optional `action` beside its title.
- **Quality Dimensions:** names and values in ink with tabular figures, a 6px solid bar on a hairline-grey track (scoped to `.radar-like`, so the dashboard's Program Compliance rows keep their look).
- **Actionable Insights:** a plain numbered list split by hairlines instead of boxed tiles with tinted badges; one column at phone width.
- **Styles:** one block at the end of `src/theme.css`, colours as tokens only. The app has no dark theme yet, so dark mode could not be viewed.
- **Strings:** 11 new keys in `src/i18n/dashboardStats.js`, English and Filipino.
- **Checked in the browser** with the demo admin and faculty accounts, at desktop and phone width (no horizontal scroll at 375px).

### v1.92.9 — View Analytics: Fits the Screen, New Line Colours

The admin's (and other reviewers') View analytics window on the dashboard's Program Compliance card. No number is counted differently.

- **Fits without scrolling:** the chart takes the height the screen has left (`.trend-chart`: between 200px and 420px) and is drawn at that measured size (`ProgramTrendModal.jsx`: a layout effect plus a ResizeObserver, so text keeps its size). Header, summary figures and spacing are tighter. Checked in the browser: the whole window fits at 1366×768 (698px tall) and 1366×900 (770px), chart and table. The table view scrolls inside its own box under a sticky header when a catalog has many programs; the window itself does not.
- **Line colours (`src/lib/programTrend.js` `SERIES_COLORS`):** a new fixed eight starting from the primary button blue: `#0866ff`, `#e07320`, `#16a37f`, `#b0413e`, `#0f9fb8`, `#a87a00`, `#8b5cf6`, `#d6457a`. Validated with the dataviz palette checks on white: all eight at least 3:1, adjacent colour-blind separation >= 11.2 and normal >= 22; the first four (the usual catalog) also pass every pair. A program still keeps its slot by code order.
- **Y-axis:** it reaches the smallest of 5, 10, 20, 25, 50 or 100% that holds the highest share shown, so shares near 0% are readable (the axis is labelled, and starts at 0).
- **Hover line:** a quiet ink hairline instead of mid-grey. **Table:** each program's compliance bar wears its line colour; tabular figures; tighter rows.
- **Legend:** program codes only, in one row; the full program name is in the tooltip and the table.
- **End labels:** when several programs sit at 0%, the stacked labels now move up from the baseline instead of running into the dates. On a phone the end labels are left out (the legend and tooltip name the lines) and the plot takes the full width.
- **Focus ring:** the dialog box itself no longer shows the browser's focus outline when it opens; its controls keep theirs.

### v1.92.10 — Dashboard: Program Compliance Bar Colours

- The Program Compliance bars on the dashboard (every role) are a meter in the primary button blue (`--btn-primary`, like the AI Quality Snapshot rings, the time-usage bars and the first line of View analytics) on a light track of the same blue (`--btn-primary-tint`), instead of a navy gradient on grey. Only the colours change; the rows, notes and numbers are as before.
- `src/theme.css` (scoped to `.dashboard-grid`); `src/lib/brandTheme.test.js` pins both rules and checks the fill is at least 3:1 on the white card and on its track.

### v1.92.11 — Phone and Tablet Menu Matches the Sidebar

- On narrow screens (where the sidebar folds into the page menu, `.mnav` in `src/responsive.css`), the menu was still the old navy gradient with a gold selected item, while the desktop sidebar had moved to the light look. It now matches the sidebar: a white card with a hairline border and the card shadow, dark labels, grey icons (`--side-icon`), the hover and selected item in the sidebar's white-greys (`--side-hover`, `--side-active`) with a primary-blue icon, the current page's icon on a light-blue tile, and a muted subtitle and chevron. Tokens only; the markup and behaviour are unchanged.
- Checked in the browser at 375px (closed and open) with the demo admin account.

### v1.92.12 — AI Checker: Minimalist Score Rings

Only the look and motion change; scores, bands and the score shown are as before.

- **Score ring of a check** (`.big-ring.cmp-ring`, Check my syllabus and the builder's step 7): the water-bottle ring (two sliding wave layers, a glass gradient, a coloured glow, an outer bezel, and two counter-rotating orbit rings while checking) is replaced by one 9px arc on a grey track with a flat white centre. Colours by state: green (meets the standard), amber `#a8740f` (below the pass line; 4.1:1 on white, 3.3:1 on the track, instead of the 2.2:1 gold), the primary button blue (provisional, checking). Motion: the arc sweeps once to the new score from the last one (0.9s, ease-out); while checking, one blue quarter arc turns around the track (1.1s). Not checked: the empty grey track instead of a dashed outline.
- **Report ring** (a check opened from the history, `.cm-ring`): an 8px arc instead of 22px, the same colours, sweeping to the score when the report opens.
- **Check history badges:** a ring in the state's colour on white, without the tinted fill.
- **Reduced motion:** none of the rings move.
- `src/theme.css` (the ring block replaced; `ComplianceCard.jsx` still sets `--water`, now unused and harmless); `src/lib/brandTheme.test.js` checks the ring colours on white and on the track, that no water or orbit animation is left, and that the checking arc stops with reduced motion.
- Checked in the browser as the demo admin: a preview of the five ring states with the real classes (no paid AI check was run), the report ring, and the history badge.

### v1.93.0 — AI Checker: Official Mode No Longer Uses the Old Checker for Check & Improve

An audit of official mode (SYLLABUS_CHECK_REPLAN=official) for places still wired to the old checker, and for bugs in the new one. No score, deduction, rule or prompt changes; no paid AI run.

- **Fixed: Check & improve refused every new-checker draft.** `routes/syllabusCheck.js` compared the report's prompt version (`replan-prompt-5`) with the old checker's and answered 409 "This check was made by an older checker version"; past that check it would have used the old checker's refine step (`refine.js`, `gemini.js` align).
  - New `pipeline/refine.js`: a new-checker draft (or the author's edit) is checked with the new checker's rules, prompt and stored answers. It passes when its field has no misalignment left (AI or no-AI rule), no scored relationship touching the field got worse, and every touched question was answered; an advice relationship that slips never blocks (the plan's rule). Otherwise the new rewriter gets one try with the repair plan's own job (parents, failures, what to keep, sibling ILOs). Same answer shape as before, so the app is unchanged.
  - Its own cap: `SYLLABUS_CHECK_REFINE_MAX_COST_USD` (default the smaller of $0.50 and the check's cap; never above it) and `SYLLABUS_CHECK_REFINE_MAX_REQUESTS` (1-60, default 12). A provider failure is a 502, never a pass.
  - The route sends a report to it only when `hybrid.alignment.engine` is `re-planned`; it refuses (409, before any AI request) when the new checker is not active or the report is from an older new-checker prompt. Old-checker reports go to the old step as before.
- **Fixed: the old whole-syllabus plan routes** (`/runs/:id/improvement-plan`, `/apply`) could build the old coordinated plan from a new-checker report when SYLLABUS_CHECK_COORDINATED_PLAN was on. They no longer do.
- **Fixed: VPAA coverage pill** (`semanticCoverage.js`) read only the old relationship names, so every new-checker report showed 0 of 7 with "Policy V2 is off". It now maps the new checklists to the seven (ACTIVITY-FIT covers Content-activity and ILO-activity; TASK-FIT covers Content-assessment and Activity-assessment). New reasons `replan_partial` and `replan_not_evaluated`, in English and Filipino.
- **Fixed: rule coverage** (`ruleCoverage.js`) listed every old AI relationship rule as NOT_CHECKED. They are now marked superseded (`replaced_by_replan`), and the relationship instances are the new checker's own questions. Each new-checker judgement records `attempted` and `reused`.
- **Fixed: fields the plan could not fix were invisible.** They stayed in `hybrid.replan` only. They now join `hybrid.unresolved` (waiting for a failing parent, with `waitsFor`, or needing review), so the app's "waiting" list shows them and the summary count matches the list.
- **Fixed: settings bounds** (`pipeline/official.js`). `SYLLABUS_CHECK_REPLAN_MAX_REQUESTS` is 1-300 (default 80); before, "-5" made every request refused and "abc" silently became 80. `SYLLABUS_CHECK_REPLAN_MAX_COST_USD` above 1000 is refused, as for the main AI cap.
- **Stored runs say which checker made them:** `storeRun` writes `ai_check_runs.prompt_version` (e.g. `replan-prompt-5`). The column is VARCHAR(20) and the old checker's versions are about 32 characters, so those stay NULL as before rather than fail the insert.
- **Tests:** `pipeline/refine.test.js` (9), `pipeline/refine.route.test.js` (6; four of them fail against the old route with the 409 above), `pipeline/coverage.test.js` (4), `official.test.js` (+4); `vpaa-conformance/memdb.js` accepts the new UPDATE. `npm test` 2,581 of 2,581 plus the UI suites; `npm run build` passes.
- **Not changed:** the old AI Alignment Score shadow has no data in official mode (its panel hides itself).
- **Limits:** scripted model answers only; Check & improve on a new-checker draft has not been run against the real model.

### v1.93.1 — Check & improve Tested Live; Development Database Repaired

- **Live test of v1.93.0** (2026-11-17, owner-approved, $0.50 cap; CPE 101, check #450, the Week 3 ILO draft that turned "The instructor will discuss De Morgan's laws..." into a student outcome). Same code the button runs (`pipeline/refine.js`), real Claude Sonnet 5.5, the app's answer store.
  - The draft as proposed: verified from stored answers alone (148 of 148), no request, $0. Of the 5 relationships it touches, 2 improved, none got worse (2 points fewer).
  - An author's edit of it: verified with 1 request to Claude, 7 seconds, about $0.022; 5 new answers stored. Same 2 improved, none worse.
  - Not exercised live: the blocked path and the one-time rewrite (they are covered by the scripted tests).
- **Development database repaired** (no code change). MariaDB crashed while reading `institution_settings`. Offline `innochecksum` found two damaged table files, both written at a server start from the XAMPP Control Panel button: `institution_settings` (page 0) and `standard_changes` (page 1). A DROP TABLE crashed the server again (InnoDB must read page 0), so both files were replaced, with the server stopped, by the good copies from the 2026-11-15 backup (same tablespace ids 34 and 91). Afterwards: all 200 table files pass `innochecksum`, all 57 tables pass CHECK TABLE, the institution row equals the 2026-11-15 dump in every column, `standard_changes` is empty as it was, and the health script reports healthy. The damaged files are kept in `LCUP-DB-Backups/2026-11-17-pre-crash-check-datadir`. Start MariaDB with `LCUP-MariaDB-Tools/Start-MariaDB.ps1`, not the XAMPP button.

### v1.94.0 — AI Checker: Constructive Alignment (Outcome Verb Matches Activities and Assessment Tasks)

Owner decision of 2026-11-17, citing the CHED Handbook on Typology, Outcomes-Based Education, and Institutional Sustainability Assessment: an outcome's verb must match its teaching-learning activities (TLAs) and its assessment tasks (ATs). If an outcome says "apply", students must solve problems, perform tasks or use concepts in real scenarios, and be assessed doing so, not only take memorization quizzes. "Apply" stays allowed for CLO 1 (Introductory). The owner chose: checked each week and each CLO; both the TLAs and the ATs must match; a mismatch is partly aligned (-1).

- **Each week** (`pipeline/rules.js`, `judge.js`):
  - ACTIVITY-FIT gains the item `level`: the activities make students work at the cognitive level of the ILO's verb.
  - TASK-FIT gains the item `level` and is now judged against the week's ILOs too: the tasks assess at the ILO's verb level. Whether the tasks fully measure the ILO stays advice (TASK-ILO). This refines the 2026-11-12 decision that tasks are scored against content and activities only.
- **Each CLO** (new relationship CLO-EVIDENCE, scored, CLO area): the CLO's own verb level is reached by the activities AND the tasks of at least one week whose ILO is mapped to it. One question per mapped CLO, with the whole-syllabus request; it waits while one of those weeks' activities or tasks is still failing (fix the weeks first). An unmapped CLO gets no question (the CLO-COVERAGE rule covers it).
- **Scoring:** a level mismatch is partly aligned, -1, inside the existing 5-point area caps. No item of the new rule is critical.
- **Repair plan** (`plan.js`): the tasks now depend on the week's ILOs. A CLO-EVIDENCE finding never makes the plan rewrite the CLO (that would lower its verb); it is listed for the faculty ("raise an ILO with its activities and tasks"), no draft claims to fix it, and it never holds back another rewrite of the CLO. The weekly level items drive drafts of activities and tasks.
- **Prompt** (`prompt.js`): the rules text states constructive alignment; worked example F (an "apply" ILO under lectures and a definition quiz); the rewrite formats for activities and tasks ask for the ILO's verb level.
- **Versions:** rules `replan-rules-2`, judge prompt `replan-prompt-6`, rewrite prompt `replan-rewrite-4`. No stored answer is reused under the new rules, so the next AI check of each syllabus asks every question again (one full check, about $0.40 to $0.65 on the syllabi checked so far). Earlier reports (for example #446, #450) now ask for a new check before Check & improve.
- **Tests:** new `pipeline/constructive.test.js` (8: the rule as data, the prompt, the questions, -1 for activities, tasks and a CLO, waiting, the plan leaving the CLO verb alone, official mode). Existing tests updated for the new questions (146 instead of 142 on the test syllabus; an edited ILO also re-asks its CLO's evidence question). With the plan's CLO guard switched off, the plan test sees 2 CLO rewrites. `npm test` 2,589 of 2,589 plus the UI suites.
- **Not run with the real model yet.**

### v1.94.1 — AI Checker: An ILO Is Judged Against Its CLO's Own Verb

Owner decision of 2026-11-17. The ILO-CLO `level` item asked whether an ILO is "at or below the CLO's level", which could be read as the highest level the CLO's classification allows (apply, for CLO 1 Introductory) or as the CLO's own verb. It now says the CLO's own main verb, as written.

- **Effect:** under a CLO 1 that says "Define and explain ...", an "apply" ILO such as "Write and run a simple program" is above its CLO: partly aligned, -1 in the ILO area, and the plan's draft brings the ILO to the CLO's level. Under a CLO 1 that says "Apply ...", the same ILO fits. The CLO's own check (CLO-LEVEL) is unchanged: Introductory allows remember, understand and apply.
- `pipeline/rules.js` (the item's wording), `pipeline/prompt.js` (rule 4 of the rules text, the ILO rewrite format, worked example G; the examples are in order A to G again).
- **Versions unchanged** (`replan-rules-2`, `replan-prompt-6`): v1.94.0 had not been used yet, and no answer is stored under those versions (`replan_answers` holds only `replan-prompt-5` answers).
- **Tests:** `constructive.test.js` adds 1 (the wording, the rules text, example G, the example order). `npm test` passes.
- Not run with the real model yet.

### v1.94.2 — AI Checker: Weeks With Several ILOs

Owner decision of 2026-11-17. A week can have two or three ILOs tagged to different CLOs, but it has one activities field and one tasks field. The activity and task questions were worded for one ILO ("the ILO's verb") while being asked against all of the week's ILOs, so it was not stated whether every ILO had to be covered, or whether "at least two alternatives" meant per ILO.

- **Now explicit** (`pipeline/rules.js`):
  - ACTIVITY-FIT `ilo`: EVERY ILO of the week has at least one activity that lets students practise it. `level`: each ILO is practised by at least one activity at the level of that ILO's own verb. `diverse`: two alternatives for the week as a whole, not two per ILO.
  - TASK-FIT `level`: each ILO of the week is assessed by at least one task at the level of that ILO's own verb; one task may cover several ILOs.
  - TASK-ILO (advice): whether the tasks show that students reached each of the week's ILOs.
- **Prompt** (`pipeline/prompt.js`): rules 5 and 6 of the rules text; the rewrite formats for activities and tasks (every ILO, at its own level; two alternatives per week); worked example H (a week with an ILO under CLO 1 and an ILO under CLO 4, activities and tasks covering only the first).
- Unchanged: each ILO keeps its own CLO question (an extra tag that does not fit goes to review); the week counts as evidence for every CLO an ILO of it is tagged to; a repair draft is one activities list and one tasks list written with every ILO of the week under dependsOn (already the case, now tested).
- **Versions unchanged** (`replan-rules-2`, `replan-prompt-6`): still no answer stored under them.
- **Tests:** `constructive.test.js` adds 2 (the wording and example H; a week with an ILO under CLO 3 and one under CLO 4: both ILOs in the activity and task questions and in their rewrite jobs, each ILO's own CLO question, the CLO 4 evidence quoting the new ILO). `npm test` passes.
- Not run with the real model yet.

### v1.94.3 — AI Checker: CLO 3 (Demonstrating) Takes Analyze and Evaluate

Owner decision of 2026-11-17, after reading the CHED Implementation Handbook for OBE and ISA (2014). CHED defines a course as "I (introductory course to an outcome), E (enabling course or a course that strengthens the outcome), or D (demonstrative course or a course that demonstrates an outcome)", with a second legend "Introduce, Practice skills with supervision, Demonstrate skills without supervision". It ties no verb range to a stage, and its examples of demonstrated outcomes (projects, portfolios, reflection papers, designing a product) span analyzing, evaluating and creating. CLO 3 had only apply and create.

- **`pipeline/rules.js`:** CLO 3 (Demonstrating) takes apply, analyze, evaluate and create. A CLO 3 such as "Evaluate network designs for ..." no longer loses a point on its verb. `BLOOM_SOURCE` records the change and its source. New `CHED_STAGES`: the CHED meaning of Introductory, Enabling and Demonstrating (Integration of Values is LCUP's own classification, not a CHED stage).
- **`pipeline/prompt.js`:** each CLO line of the rules text carries its CHED meaning (for example CLO 3: "students demonstrate the outcome independently, without supervision, in a product, performance or solution"), so the CLO's focus is judged by it.
- CLO 1, 2 and 4 are unchanged.
- **Versions unchanged** (`replan-rules-2`, `replan-prompt-6`): still no answer stored under them.
- **Tests:** `prompt.test.js` (the mapping, its source, the CHED meanings in the rules text, none for CLO 4). `npm test` passes.
- Not run with the real model yet.

### v1.94.4 — AI Checker: One Observable Verb per Outcome (CHED)

Owner request of 2026-11-17. The CHED Implementation Handbook for OBE and ISA (2014), rule 7 of writing learning outcomes: "Choose only one observable verb/behavior in a statement of outcome; choose the behavior that is of a higher dimension of complexity."

- **New no-AI rule OUTCOME-ONE-VERB** (`pipeline/fixedRules.js`): a CLO or ILO that opens with two or more joined verbs ("Define and explain ...", "Design, implement, and test ...", "Analyze/evaluate ...", "Students will be able to identify and correct ...") is a finding on its own field. A verb later in the sentence does not count ("Apply De Morgan's laws and ..." is one verb). The message names the verb of higher complexity to keep when every verb has a Bloom level ("here \"explain\""); otherwise it leaves the choice open.
- **Detection** (`pipeline/extract.js` `leadingVerbs`, `OUTCOME_VERBS`): the first word after an optional preamble ("At the end of the course, the student will be able to") and every verb joined to it by "and", "or", ",", "/" or "&". Only words on the verb list count (revised Bloom verbs and the CHED handbook's Annex 4).
- **Scoring:** none. Like the new checker's other no-AI rules, it is advisory in official mode.
- **Repair** (`judge.js` FIXED_TEXT_RULES, `prompt.js`): the plan drafts a one-verb rewrite of the field; the rewrite formats for CLOs and ILOs ask for ONE measurable verb; `validateRewrite` refuses a rewrite that still opens with two (after the more specific copy checks). Worked examples A and G now use one verb.
- **On the development database:** none of the three syllabi (CpE-404, CAPSPRO1, CPE 101; 68 outcomes) opens an outcome with two verbs, so their results do not change.
- **Test fixtures:** the conforming test syllabus's CLOs ("Explain and apply Java programming outcome n") and the synthetic syllabus's Week 2 ILO ("Write and run ...") now use one verb; the synthetic test's scripted CLO fix too.
- **Versions unchanged** (`replan-rules-2`, `replan-prompt-6`, `replan-rewrite-4`).
- **Tests:** new `pipeline/onever.test.js` (4: detection, the finding and its field, rewrite refusal and format, the plan's one-verb draft). `npm test` passes.

### v1.94.5 — AI Checker: CLO 4 (Integration of Values) Takes Affective Verbs

Owner decision of 2026-11-17. The CHED Implementation Handbook for OBE and ISA (2014) tells faculty to "consider the three domains of learning" (cognitive, psychomotor, affective) and lists affective verbs in Annex 4. A values outcome such as "Advocate the responsible use of computing" or "Practice honesty and accountability in engineering work" lost a point because CLO 4 took only evaluate and create.

- **`pipeline/rules.js`:**
  - New `AFFECTIVE_ORDER`: receive, respond, value, organize, internalize, each with its meaning and the CHED handbook's sample verbs; `AFFECTIVE_SOURCE` records the decision.
  - CLO 4 takes the affective levels value, organize and internalize, besides evaluate and create. CLOs 1 to 3 take none.
  - CLO-LEVEL `verb` accepts the affective levels for CLO 4. ILO-CLO `level`: under an affective CLO, an affective ILO at or below its level fits, and so does a cognitive ILO.
- **`pipeline/prompt.js`:** the CLO 4 line lists its affective levels; a new AFFECTIVE LEVELS block (the scale, the verbs, and how an affective outcome is practised and assessed: role-plays, case discussions, service or group work; observed behavior with a rubric, a reflection on one's own conduct, a defended position; a written quiz about the value alone does not assess it); worked example I (an "Advocate ..." CLO 4, a cognitive and an affective ILO under it, and its evidence). The CLO rewrite format allows an affective verb for CLO 4.
- **`pipeline/extract.js`:** the one-verb rule knows the remaining affective verbs of Annex 4 ("Advocate and practice ..." is two verbs).
- **Versions unchanged** (`replan-rules-2`, `replan-prompt-6`): still no answer stored under them.
- **Tests:** `constructive.test.js` adds 1 (the scale and its verbs, CLO 4 only, the checklist wording, what the AI is told, the one-verb rule with affective verbs); `prompt.test.js` updated. `npm test` passes.
- Not run with the real model yet.

### v1.94.6 — AI Checker: First Real-Model Run of the New Rules (CPE 101)

Owner-approved paid run of 2026-11-17 (cap $1.50), `scripts/replan-syllabus-run.cjs --run 114 --live --confirm-paid --max-cost 1.5 --label new-rules`. No code change. Output in `docs/ai-checker-replan-run/syllabus-114/new-rules/` (a dev syllabus with planted problems; keep local, not committed).

- **Cost and stop:** 65 requests, $0.72 charged ($0.67 estimated). The evaluation guard stopped the run before the re-check because its conservative total ($0.70 charged + the $0.27 worst case of the next request) passed the $1.50 cap; the app's own cap (`SYLLABUS_CHECK_REPLAN_MAX_COST_USD`) has no such accounting. 7 requests were refused, so one task field and four fields waiting on a failing week were left unresolved.
- **Official check:** completed, 142 of 147 answered (5 "unclear", all on weeks whose ILO is written for the teacher), score 67 (the same as check #450 under the old rules), 52 misalignments, every area at its 5-point cap except content (3) and references (3).
- **Constructive alignment works as designed:** TASK-FIT went from 10 aligned / 0 partial to 4 aligned / 4 partial (the tasks are now judged against the week's ILO); ACTIVITY-FIT is about the same; ILO-CLO against the CLO's own verb went from 5 aligned / 8 not to 8 aligned / 6 not.
- **CLO-EVIDENCE:** CLO 1, 3 and 4 aligned, CLO 2 partial ("no mapped task reaches analyze"). After the plan rewrote Week 10 (a floral design project, the only design-level work), CLO 3 lost its evidence and became partial, which held back the changes of the weeks it involves.
- **No outcome draft opens with two verbs** (0 of 7). Of 21 drafts, 16 verified, 2 need faculty review, 3 not checked.
- **Not exercised:** a clean syllabus with a verb-level mismatch (CPE 101's planted problems dominate); the re-check after the plan.

### v1.94.7 — AI Checker: Real-Model Run of the New Rules on a Clean Syllabus (CAPSPRO1)

Owner-approved paid run of 2026-11-17 (`--run 113 --live --confirm-paid --max-cost 1 --concurrency 1 --label new-rules`). No code change. Output in `docs/ai-checker-replan-run/syllabus-113/new-rules/` (keep local, not committed).

- **Cost:** 18 requests, $0.36 charged ($0.33 estimated); completed, not stopped.
- **Result:** score 100 (the same as check #449 under the old rules), 141 of 141 answered, 0 misalignments, plan clean, the re-check asked nothing.
- **No false positives from the new rules on a good syllabus:** ACTIVITY-FIT 11/11 and TASK-FIT 11/11 aligned (the level items included), CLO-EVIDENCE 4/4 aligned with reasons naming the work at each CLO's level (problem-tree analysis for CLO 1, feasibility justification for CLO 2, designs graded by rubric for CLO 3, consent-form validation for CLO 4), CLO-LEVEL 4/4.
- **Review items (no points):** 9 extra tags that do not fit beside a tag that does: 6 CLO-PO and 1 CLO-EGA, and 3 ILO-CLO where the AI applied the CLO's own verb (for example "develop" is create level, above CLO 2's "evaluate"; the ILO fits its other tag, so it costs nothing).

### v1.94.8 — AI Checker: The Values Question Sees the Week's Activities; Clearer "Incomplete" Message

Found 2026-11-17 when CPE 101 re-checks #451 and #452 showed no score and no suggestions.

- **Bug:** VALUE-ILO's checklist asks whether the week's value can be practised through its ILO **and activities**, but the question carried only the ILO. In Week 17 the ILO is written for the teacher, so the value (Missionary Spirit) is carried by the "case-study discussion on ethical reliability". Claude quoted the activities, the quote was not in the question's texts, the answer was rejected twice, the question stayed unanswered, and one unanswered question makes the whole check incomplete: no score, no repair plan, no suggestions, on every re-check.
- **Fix** (`pipeline/judge.js`): the values question now carries the week's activities as well as its ILOs (its ILOs only when the week has no activities). The repair order still follows the ILO only. `rules.js` CHAIN: values align to the ILO and the activities.
- **Message** (`pipeline/official.js` `incompleteReason`): an incomplete check counts only the questions with NO valid answer and names up to three ("1 question of the new AI Checker had no valid answer: Week 17 values (VALUE-ILO): the quote is not in the texts. Run the check again."). An "unclear" answer is a valid answer and never made a check incomplete, but the old message counted it ("3 questions" meant one).
- **Versions unchanged:** the values questions now carry other texts, so their stored answers do not match and they are asked again once; nothing else is.
- **Tests:** new `pipeline/values-activities.test.js` (3; the first fails against the old question). `npm test` passes.
- Not yet re-checked with the real model: re-check CPE 101 in the app.

---

### v1.94.9 — AI Checker: CPE 101 Re-Check Shows Suggestions Again; No "AI Provider Unavailable" Findings
**Date:** November 17, 2026

- **Symptom:** CPE 101 check #458 completed with score 85 and six deductions but no suggestion (plan rounds 0), and three findings said "This original-requirement relationship was not checked; the course identity or AI provider is unavailable".
- **Cause 1, a deadlock** (`pipeline/judge.js` setStatuses): CLO-EVIDENCE (a manual relationship, fixed in its weeks, never by rewriting the CLO) made CLO 3 "failing". The Week 10 ILO tagged to CLO 3 then waited on its CLO, the week's activities and tasks waited on the ILO, and CLO-EVIDENCE waited on the activities and tasks: nothing was a rewrite root, so the plan rewrote nothing. A failing manual relationship no longer makes its field a parent that others wait on; the same rule applies to `official.js` unresolvedOf.
- **Cause 2** (`pipeline/plan.js`): a reference the AI flagged was listed as "waits for a field above it". The AI never rewrites a reference, so it now reads "for the faculty: the AI never rewrites a reference; replace or remove this source".
- **Cause 3** (`compliance/service.js`, `pipeline/official.js` noAiEnv): official mode ran the old engine with its AI off but its original-requirements advice still on (`SYLLABUS_CHECK_REQUIREMENTS_ADVICE=on`), so each of its questions was recorded as "not checked". Official mode now turns that advice off too; the no-AI rules and the base score are unchanged.
- **Versions unchanged:** no question or prompt changed; stored answers are reused.
- **Verified offline:** a read-only replay of CPE 101 with the stored answers (no AI request) gives 0 "not checked" findings, the Week 10 ILO as a rewrite root, the reference reason above, score 85. New `pipeline/cpe101-458.test.js` (3 tests); `npm test` passes (2,603 server + 127).
- Not yet re-checked with the real model: re-check CPE 101 in the app.

---

### v1.95.0 — AI Checker: The Old AI Checker Is Retired
**Date:** November 17, 2026

- **Owner decision:** "don't use the old AI Checker anymore". AI judgements, deductions, drafts and Check & improve come only from the new AI Checker.
- **Check** (`compliance/service.js`): the old engine always runs with its AI off and gives only its no-AI rules (required sections, format, week structure, links, base score). When an AI check is asked for, an AI provider is set and the new checker is not ready (for example `SYLLABUS_CHECK_REPLAN` is not `official`, or its cost cap is missing), the check is incomplete with the reason ("The new AI Checker is not ready on this server: ...") and sends nothing to any AI. Before, it fell back to the old checker with its AI stages, Policy V2 and the whole-syllabus plan.
- Policy V2, the old whole-syllabus plan and the old coordinated plan no longer run from a check.
- **Routes** (`routes/syllabusCheck.js`): Check & improve and the improvement plan refuse a report the old checker made (409 `old_checker_retired`: "This check was made by the old AI Checker, which is no longer used. Run Check with AI again ...").
- **The old code is kept, not deleted:** its no-AI rules are the same engine, and its own tests still run. It runs its AI only with `SYLLABUS_CHECK_LEGACY_AI=on` (`pipeline/official.js` `legacyAiOn`), which no setup sets. The old checker's test files and the UI fixture builder set it in their own process; evaluation scripts of the old checker need it too.
- **No change for the dev server:** it already ran the new checker (official mode, ready).
- **Tests:** new `pipeline/retired-old-checker.test.js` (4, through the real check service: no AI request when the new checker is not ready, with every old AI path switched on; a control shows the old AI is seen when opted in); `refine.route.test.js` updated (old-checker report refused). `npm test` passes (2,608 server + 127).

---

### v1.96.0 — AI Checker: Old Checker Parts Not Connected to the New AI Checker Removed
**Date:** November 17, 2026

- **Owner decision:** remove what of the old checker is not connected to the new AI Checker. The old engine's no-AI rules (required sections, format, week structure, links, base score) stay: the new checker's score starts from them.
- **Removed:** `wholeSyllabusPlan.js` (old whole-syllabus plan) and `coordinatedPlanEngine.js` (old coordinated plan), their calls in `compliance/service.js`, their tests (`wholeSyllabusPlan.test.js`, `coordinated-plan.test.js`, `routes/syllabusCheck.coordinatedPlan.routes.test.js`) and `scripts/staging-coordinated-plan-validation.cjs`. The new checker never made an improvement plan; its drafts are its suggestions.
- **Routes** (`routes/syllabusCheck.js`): the improvement-plan routes now answer `{ plan: null }` and 409 `old_checker_retired` (so a page still showing an old report's plan gets a clear reply). Check & improve takes only the new checker's drafts; the old checker's branch (`refine.js` `refineSuggestion`) is gone even with `SYLLABUS_CHECK_LEGACY_AI=on`.
- **Kept, because other code still uses it:** `refine.js` (token signing, field helpers used by the new Check & improve route and scripts), Policy V2 and the old AI inside `engine.js`/`gemini.js` (loaded by the engine, the repository, coverage and about 40 evaluation scripts). They stay switched off (v1.95.0).
- **Tests:** `routes/syllabusCheck.refine.routes.test.js` rewritten for new-checker drafts (daily limit, author-only, locked, unknown/older/old-checker refused, 502, Settings switch); R13 and the staging rehearsal authorization test now run on a new-checker report (token only when verified, forged and replayed tokens refused, author-only, fail closed without the secret); four tests that only repeated covered rules through the removed path deleted. `npm test` passes (2,576 server + 127).
- **Dev `server/.env`** (not in git; backup taken): removed the old-only settings `SYLLABUS_CHECK_STAGE_A/B/C1/C2/C3/D2`, `SYLLABUS_CHECK_WHOLE_PLAN`, `SYLLABUS_CHECK_REQUIREMENTS_ADVICE`, `SYLLABUS_CHECK_CACHE_WARMUP`, `SYLLABUS_CHECK_COURSE_CONTEXT`, `SYLLABUS_CHECK_OUTPUT_FIELDS`. The new checker's settings are unchanged and it is ready.
- The interface panel `CoordinatedPlanPanel.jsx` is left as it is (it shows only for an old report that carries a plan); `ComplianceCard.jsx` has another contributor's uncommitted edits.

---

### v1.97.0 — AI Checker: The Old AI Checker Code Is Removed
**Date:** November 17, 2026

- **Owner decision:** back up, then delete or refactor every part of the old AI Checker that the new AI Checker does not use; leave what it uses untouched. Backup: git tag `backup/old-ai-checker-2026-11-17` (6163ad7) and a verified bundle, zip and `.env` copies outside the repository.
- **Removed (about 290 files):** the old AI client `gemini.js` and its providers (Gemini, OpenRouter, DeepSeek, Groq), `modelClient.js`, `costPlan.js`, `checkingProfile.js`, `budgetReport.js`; Policy V2 (`academicPolicyV2.js`, `academicV2*.js`, `cloClassification.js`, `offTopicLessons.js`); the old engine's AI stages and their helpers (`mapping.js`, `coverage.js`, `valueClassification.js`, `suggestionOrder.js`, `acceptance.js`, `alignmentScore.js`, `scoring.js`, `reportSafety.js`, `verdict.js`, `pendingRules.js` and others); the old evaluation folder `eval/` with its datasets (except `providerGuard.js`, used by the new checker's paid-run scripts); the old checker's tests and its evaluation, benchmark, Policy V2 and faculty-review export scripts; the unused LLM recommendation stub; the interface panels `AcademicEvaluationPanel`, `CoordinatedPlanPanel`, `AlignmentScorePanel`, their helpers and the Policy V2 strings; the improvement-plan API calls and routes.
- **Refactored:** `engine.js` runs only the fixed (no-AI) rules (557 to about 200 lines) and says why a report has no AI part yet (AI off in Settings, off on the server, a check without AI, or the new checker still to answer). `compliance/service.js` runs those rules and then the new checker; no fallback. New `aiConfig.js` (Claude only, approved model only) replaces what was still used of `gemini.js`. `refine.js` keeps the shared helpers; its related-context hash is built from the new checker's questions. `ruleCatalog.js`, `ruleCoverage.js` and `semanticCoverage.js` cover the fixed rules and the new checker's questions only. `repository.js` drops the old answer reuse and correction history.
- **Kept, because the new checker loads them:** `values.js`, `lessonfit.js`, `stages.js`, `aspects.js`, `references.js`, `requirementsAdvice.js`, `planrows.js`, `anthropicClient.js`, `anthropicSchema.js`.
- **Behaviour changes:** the submission gate accepts only a completed check of the new AI Checker (an old-checker report needs a re-check); decisions on old-checker reports are refused (`old_checker_retired`); the "verify first" step that only Policy V2 drafts had is gone (new-checker drafts never had it).
- **Tests:** old-checker tests deleted; mixed files trimmed to their connected parts; new `aiConfig.test.js`; the gate, decision-route, coverage and UI conformance tests now use new-checker reports (the UI fixtures run the real engine and the new checker with its scripted judge). All suites pass, except six avatar/file-route tests that need a `.env` (unaffected files).
- **Not done:** the browser E2E suite (`scripts/e2e`) still scripts the old checker's answers and needs a scripted provider for the new checker.

---

### v1.97.1 — AI Checker: Problems With No Draft Are Shown Again; No False "Every Check Passed"
**Date:** November 18, 2026

- **Symptom (CPE 101 check #461):** 96%, "Nothing to improve: every check passed", and no recommendation, although five problems were left (CLO 3 without evidence in its weeks, an off-topic reference, Week 1 not the orientation, a reference not in APA 7, CLO 4's classification). The old-checker removal did not cause it: check #460, made before, was the same.
- **Page** (`HybridCheckPanel.jsx`): the "Needs your decision" list is back (the 2026-11-04 panel rework had removed it, so a problem with no draft was invisible). Each item shows where it is, the field's text, the reason and what to do. `ComplianceCard.jsx`: "Nothing to improve: every check passed" only when there is no recommendation, no deduction and nothing left for the author (it looked only at the fixed-rule findings, which the new checker does not use for its problems).
- **Report** (`pipeline/official.js`): a problem only the author can fix (a manual relationship such as CLO-EVIDENCE, or a reference, which the AI never rewrites) has the new reason `faculty_fix` with the instruction; one with no verified rewrite this check has `no_verified_rewrite`. Both were `draft_needs_review`, which the page reads as "copied wording in the proposed rewrite". The rule findings only the author can fix (Week 1 orientation, an APA reference that could not be repaired, ...) are listed too; they were only in `hybrid.replan.plan.manual`. Each item carries an `excerpt` of its field.
- **The plan's mechanical fixes** (a CLO's fixed classification, an APA 7 repair built from the reference's own characters) become rule recommendations the author can accept (`source: 'rule'`, never "Check & improve"); they were dropped. `src/lib/hybridCheck.js` applySuggestion accepts `clos[n].level` and `refs.<group>.items[n].t`.
- **Strings:** `hybrid.unresolved.faculty_fix`, `hybrid.unresolved.no_verified_rewrite`, a new `hybrid.unresolvedNote` (English and Filipino).
- **Versions unchanged:** no question or prompt changed; stored answers are reused, so a re-check of an unchanged syllabus costs nothing.
- **Tests:** new `pipeline/cpe101-461.test.js` (3) and `[UI-NEEDS-DECISION-en/tl]` in the UI conformance test; `official.test.js` updated. `npm test` passes (1,376 server + 127).
- **Reference labels:** an item or recommendation on a reference is labelled by its group and number ("References · Books, no. 3" / "Mga aklat, blg. 3"), not "Draft" (`hybridView.js` suggestionKind `ref`; new strings `hybrid.kind.ref` and `hybrid.refGroup.*`). Verified on CPE 101: check #462 offered the CLO 4 classification, it was accepted (decision recorded, syllabus saved), and check #463 lists the four items for the author; both checks sent no AI request.

---

### v1.97.2 — AI Checker: A Quote Copied With a Plain Dash or "..." Is No Longer Rejected
**Date:** November 18, 2026

- **Found in a review of the new AI Checker:** every AI answer must quote the syllabus text it rests on, and the quote was compared ignoring case, spacing and curly quotes only. A dash or a non-breaking hyphen copied as "-", an ellipsis copied as "...", or a soft hyphen or zero-width character in the text made a correct answer "the quote is not in the texts". Asked again and rejected again, the question stayed unanswered and the whole check incomplete (no score, no recommendations), the same failure as CPE 101 #451/#452. All three syllabi in the development database contain en or em dashes.
- **Fix** (`pipeline/prompt.js` squash, used only by this comparison): hyphen and dash variants, the minus sign, the ellipsis character, curly and low quote marks, primes, soft hyphens and zero-width characters are compared as their plain forms. Nothing is sent differently and the stored quote is the model's own; a quote that is really not in the texts is still refused.
- **Versions unchanged:** no question or prompt changed; stored answers are reused.
- **Tests:** new `pipeline/quote-match.test.js` (2; the old comparison rejects all five legitimate variants). `npm test` passes (1,378 server + 127).
- **Also found, not changed (owner's choice):** a syllabus with missing or duplicate row, ILO or CLO ids never completes and says "Run the check again" (not reachable through the form or PDF import, which always assign unique ids); Check & improve can return its own rewrite with `usedRewrite: false` when neither candidate passes (not shown by the page).

---

### v1.97.3 — E2E: The Browser Suite Runs on the New AI Checker
**Date:** November 18, 2026

- **Why:** the browser E2E suite (`npm run test:e2e`, `scripts/e2e/`) still scripted the old AI Checker's answers (the conformance harness's `scriptedTransport`, `document_data` pairs, `judgements`) and expected old reports (Policy V2 panel, coordinated plan, old drafts). That code was removed in v1.97.0, so the suite could not run.
- **Offline stand-in for Anthropic** (new `scripts/e2e/fake-anthropic.cjs`): answers the new checker's two requests in their own format (`pipeline/prompt.js`): JUDGE (`{ answers }`, every checklist item yes/no/unclear with a quote from the texts, via `pipeline/testSyllabus.js` `scriptedAnswer`) and REWRITE (`{ text, explanation }`). One deliberate, repeatable gap gives every report something to act on: the Week 2 activities do not practise their ILO at its level (ACTIVITY-FIT, item "level": partly aligned, -1 point). The rewriter repairs it and the judge accepts the repair, so the repair plan offers a VERIFIED draft. Modes for the failure tests: ok, down (503), auth (401), rate (429), invalid (an HTTP 200 body that is not a message), garbage (a message whose text is not the answer JSON). Nothing leaves the machine; it proves how the software handles answers, not how Claude judges.
- **Preload** (`offline-provider.cjs`): answers `https://api.anthropic.com/` with the stand-in instead of the old scripted transport, logs each request's kind (judge or rewrite), and still blocks every other non-loopback fetch, socket and DNS lookup.
- **Stack** (`stack.cjs`): the server runs the new checker as the official AI check (`SYLLABUS_CHECK_REPLAN=official`, `SYLLABUS_CHECK_AI_PROVIDER=anthropic`, approved model `claude-sonnet-5-5`, `SYLLABUS_CHECK_REPLAN_MAX_COST_USD=20`, `SYLLABUS_CHECK_REFINE_MAX_COST_USD=5`, the staging start-up cost limit). Policy V2 settings removed. The build sets `VITE_NEW_BUILDER=true` itself, so a checkout without a private `.env` (a worktree) no longer builds the legacy builder.
- **Synthetic syllabus** (new `scripts/e2e/syllabus-fixture.cjs`): the new checker's conforming syllabus (`testSyllabus.js` `conforming`, every fixed rule passes) with the shared synthetic masters and their vision/mission/EGA/PO snapshot. The seed uses it and clears the stored answers (`replan_answers`) so every run asks the stand-in itself.
- **Scenarios updated to the new report:** E03/E05 check the score (base score minus the gap's point, against 79), the new engine, provider and model, the seven VPAA relationships evaluated, the gap with its verdict and points, the verified draft, and that the spend cap counted every request; the administrator reads the finding but cannot accept it. E07-E09 use the draft for the Week 2 activities; Check & improve is checked by its result ("It is safe to accept"; answers the plan already got are reused, so it may send no request). E10 expects no AI points left after the fix. E12 adds the garbage mode, re-tags IT 205's ILOs to the CLOs its subject gave it, and checks that a re-check while the AI is down asks no judge question. E13 checks the new report in Filipino. E15 (was Policy V2 on/off parity) now checks stored answers and determinism: a second fresh server process asks no judge question and gets the identical official result. E16 checks that every provider request was a judge or rewrite request the stand-in answered.
- **Scenarios fixed for UI changes made after the last green run (2026-11-05), not the checker:** the "Program & Subjects" menu is "Curriculum" and its header button "+ Add Curriculum"; the add-subject form requires a curriculum year; Builder Step 1 lists missing fields under "Complete before submitting:" when strict step order is off; Review & Approval starts on the current year (no combined "Previous and current year" choice, owner 2026-11-08).
- **Harness** (`vpaa-conformance/harness.js`): the old scripted transport (`scriptedTransport`, `answerFor`, `fitToSchema`, `message`) and the unused `coded` and `syllabus` helpers are removed; `envFor` keeps only the Anthropic settings. `retired-old-checker.test.js` uses a recording transport instead.
- **Not changed:** `scripts/e2e/run-comprehensive-ui.cjs` (K01-K10), `scenarios-budget.cjs` (B01) and the `scripts/release/run-suite*.cjs` and `stability-*` scripts drive the removed `comprehensive-testing` profile and old optimization flags; they are not part of `npm run test:e2e` and were left for a separate decision. So were `scripts/po-controlled-activation/development-integration.test.cjs`, `migration.test.cjs` and `checker-browser-seed.cjs` (not in `npm test`), which still call the removed scripted transport, Policy V2 profile and `POLICY`.
- **Tests:** `npm run test:e2e` passes offline on a freshly built scratch database: 25/25 scenarios, 457/457 checks, 178 provider requests all answered by the stand-in, no attempt to leave the machine. `npm test`: 1,370 of 1,376 server and library tests pass; the 6 that fail (avatar and syllabus-file routes) use no changed file and fail only because this git worktree lives under a `.claude` folder and those routes send files with `dotfiles: 'deny'` (they pass from a path without a dot-folder). The localization, PDF-import UI and VPAA UI stages pass (28/28 UI conformance).

---

### v1.97.4 — AI Checker: The Last Old-Checker Code Is Removed
**Date:** November 18, 2026

- **Owner decision:** remove what of the old AI Checker is not related or connected to the new one.
- **Modules the new checker loads, trimmed to what it uses:** `values.js` (the six core values and namedValues; the old Stage D1 definitions file, value questions and values profile removed), `references.js` (parseReference and crossrefFetch; the old Stage D2 report, DOI check and relevance pairs removed), `planrows.js` (examLike, ORIENTATION, weeksIn), `stewardship.js` (isTrivialRewrite, summarize; the old correction history removed), `identity.js` (identityOf). About 420 lines to 247.
- **Deleted, used only by the old parts of those modules:** `lessonfit.js`, `stages.js`, `aspects.js`, `requirementsAdvice.js`.
- **Old checker tooling deleted (21 scripts):** the comprehensive-profile and Policy V2 browser suites (`run-comprehensive-ui.cjs`, `scenarios-comprehensive.cjs`, `scenarios-budget.cjs`), the stability run/report/audit and their helpers, the release-candidate runners (`run-suite.cjs`, `run-suite-fresh.cjs`, `dynamic-reference-audit.cjs`, `report-retrieval.integration.test.cjs`) and the PO activation's checker-integration checks (`checker-browser*.cjs`, `checker-integration-*.cjs`, `checker-isolated-setup.cjs`, `development-integration.test.cjs`). `migration.test.cjs` loses its one old-checker test; `source-compare.cjs` its Policy V2 category; `development-report.cjs` no longer lists the deleted test. Kept: `npm run test:e2e` and its helpers (`stability-no-ddl.cjs` is used by its stack), the PO activation itself (activate, backup, restore, rollout, safety, audit) and `credential-readiness.cjs` (it flags leftover Gemini and OpenRouter keys).
- **Translation strings:** the 65 keys only the deleted panels used (`alignmentScore.*`, `coordinatedPlan.*`), English and Filipino. Kept: every string an old stored report can still show (for example the "Needs your decision" reasons).
- **Tests:** `npm test` passes (1,389 server + 127); the frontend builds.

---

### v1.97.5 — AI Checker: Settings Template, Messages and Comments Describe the New AI Checker
**Date:** November 18, 2026

- **`server/.env.example`:** the AI Checker section now sets up the new AI Checker (`SYLLABUS_CHECK_AI_PROVIDER=anthropic`, `SYLLABUS_CHECK_REPLAN=official`, a $2 cost cap, 120 requests, Claude with its approved model) and says what it needs to run. Before, it set up the old checker (OpenRouter as the provider) and listed 26 settings nothing reads any more (Gemini, OpenRouter, the old stages, Policy V2, batch and old cost flags); a server set up from it could not run the new checker. Verified: read as a `.env`, the template is ready once an API key and the model approval are filled in.
- **Messages users see:** the submission refusals (`routes/syllabi.js`, `routes/syllabusContent.js`) said "mandatory Gemini alignment"; they now name the AI Checker's alignment check. The "verification signing is not configured" message no longer mentions Policy V2.
- **`server/scripts/syllabus-check.cjs`:** runs the fixed (no-AI) rules; its `--ai gemini|openrouter` options did nothing and are refused with a pointer to `scripts/replan-syllabus-run.cjs`, the AI check.
- **Comments** in `HybridCheckPanel.jsx`, `aiQuota.js`, `anthropicClient.js` and `quality.js` no longer describe gemini.js, modelClient.js, OpenRouter or Policy V2.
- **Found, not changed:** `SYLLABUS_CHECK_AI_MAX_COST_USD` is still required at startup in staging and production, but since the old checker's request budget was removed nothing applies it to a check; the AI Checker's per-check cap is `SYLLABUS_CHECK_REPLAN_MAX_COST_USD`. Left for the owner's decision.
- **Tests:** `npm test` passes (1,389 server + 127).

---

### v1.97.6 — AI Checker: The Startup Cost Guard Checks the Cap That Is Applied
**Date:** November 18, 2026

- **Problem:** in staging and production the server refused to start without `SYLLABUS_CHECK_AI_MAX_COST_USD`, but since the old checker was removed nothing applied that value to a check; the cap the AI Checker applies is `SYLLABUS_CHECK_REPLAN_MAX_COST_USD`. A server had to set a value that limited nothing.
- **Change** (`server/lib/aiQuota.js` resolveCheckCostCap): the startup guard now checks `SYLLABUS_CHECK_REPLAN_MAX_COST_USD` with the same rules (any mode: a value that is not a dollar amount above 0 and at most 1000 stops the server, naming the setting; staging and production: required once an AI provider is configured). `SYLLABUS_CHECK_AI_MAX_COST_USD` is ignored. Development is unchanged.
- **Templates:** `server/.env.example`, `docs/deployment/staging.env.template` and `docs/deployment/production.env.template` set up the AI Checker (provider, official mode, $2 cap, 120 requests, approved Claude model); the old setting, Policy V2, the comprehensive profile and the stage settings are gone from them. Production keeps the AI Checker off until the owner approves it after a staging test, and lists what to set when it is approved. Before, the production template set `SYLLABUS_CHECK_REPLAN=off`, so turning the AI on from it would not have run the new checker.
- **Also:** `scripts/e2e/stack.cjs` drops the old setting (it already sets the real cap); comments in `index.js` and `pipeline/official.js` name the real cap.
- **Not changed:** the historical test reports and the old Policy V2 staging guides under `docs/` (records of past runs).
- **Tests:** `aiQuota.test.js` checks the real cap and that the old setting no longer satisfies the guard; the staging template passes the guard and fails it without the cap. `npm test` passes (1,391 server + 127).

---

### v1.97.7 — AI Checker Report: One "Close" Button
**Date:** November 18, 2026

- **Problem:** the ✕ added to the report window's header (6d13cf5) was also named "Close", so the window had two buttons with the same name next to the footer's Close; screen readers announced two identical buttons and the browser tests could not tell them apart (E10, E11, E20 failed). It also sat inside the title block, so it showed under the date line instead of at the top right where the header styles place it.
- **Change** (`src/components/ComplianceModal.jsx`, `src/i18n/messages.js`): the ✕ is named "Close report" (Filipino "Isara ang ulat", also its tooltip) and is the header's right-hand item.
- **Tests:** `npm test` passes (1,391 server + the client suites); `npm run test:e2e` passes 25/25 scenarios, 457/457 checks.

---

### v1.97.8 — AI Checker: Repeated or Missing Item IDs No Longer Stall or Mix Up a Check
**Date:** November 18, 2026

- **Problem:** every question of the AI Checker is named after the hidden id of the item it judges (`ILO-CONTENT|ilo:<id>`). Two CLOs, ILOs, week rows or references with one id (or two without one) made two questions with one name. In one request the reply was refused as "answered more than once", the retry was refused the same way, and the check stayed incomplete on every run (reproduced: a repeated ILO id in one week, a repeated CLO id, a repeated week-row id). In two requests the later answer was given to both: in a test, a good Week 3 ILO got the off-topic Week 4 ILO's NOT_ALIGNED, and the deduction and the draft went to the wrong ILO.
- **Change** (`pipeline/extract.js` `uniqueIds`): the checker works on a copy in which every id is unique. The first item with an id keeps it; a repeated, missing or numeric id is renamed (`<id>~<n>`), the same way every time. Only ids change, and only in the copy: the saved syllabus is never changed. ILO tags still name the CLO that kept the id, as the editor shows them. `check`, `buildPlan`, `officialize`, `refineDraft` (Check & improve) and `relatedContextHash` (decisions) all use it, so the report, the plan, Check & improve and the decision check agree. Report paths are by position (`plan[3].ilos[0].text`), so they hold for the saved syllabus.
- **Found in the data:** no syllabus or saved version in the dev database has a repeated or missing id (4 syllabi, 2 versions scanned read-only). The editor makes random ids, so this comes from imported, copied or older content.
- **Tests:** `pipeline/unique-ids.test.js` (6): the copy rules; one week, two weeks, CLOs, week rows, missing ILO, CLO and reference ids; numeric ids keep their tags; the official report, Check & improve and the decision context point at the right ILO. `npm test` passes (1,397 server + the client suites); `npm run test:e2e` passes 25/25 scenarios, 457/457 checks.


### v1.98.0 — AI Syllabus Generator (off by default)
**Date:** November 18, 2026

- **New:** the **AI Syllabus Generator** sidebar tab (below AI Checker; faculty and administrators) writes a first draft of the CLOs, the 18-week learning plan, requirements and grading for the chosen subject, built to pass the AI Checker. It follows the checker's own dependency chain (CLOs, then content, then ILOs, activities, tasks and values), uses the checker's own rules text, then checks the result with the checker's no-AI rules and the AI judge and makes ONE repair plan; only a change the plan verified is applied. Nothing is saved by the server: the sections come back and the builder fills them into the author's draft, where the author reviews, edits and saves them like any other change. The AI never submits or approves.
- **Fixed by code, not the AI:** the schedule (18 weeks; Prelim, Midterm and Final examinations in Weeks 6, 12 and 18), the Week 1 orientation row, the examination rows and their value, and each CLO's classification label. CLOs the author already wrote (all four) are kept and the plan is written against them. **References are not generated:** the checker's rule is that a source is looked up, never invented, and a model cannot look one up, so the author adds them (the checker reports the empty list).
- **Safety:** off unless `SYLLABUS_CHECK_GENERATE=on`, the direct Anthropic provider and its OWN cost cap `SYLLABUS_CHECK_GENERATE_MAX_COST_USD` (covers generation, check and repair together, through the existing cost-capped provider) are set; author-only, active academic year, the administrator's AI switch, one generation at a time, and 5 per person per day (`SYLLABUS_CHECK_GENERATE_PER_USER_PER_DAY`). An answer that fails validation is asked for once more with the problems named, then refused: nothing partial is returned.
- **Files:** `pipeline/generate.js`, `POST /api/syllabus-check/syllabi/:id/generate` and `generator` in `GET /api/syllabus-check/status` (`routes/syllabusCheck.js`), `views/builder2/GeneratePanel.jsx`, `generate.*` strings in English and Filipino, `RULES_FOR_REWRITE` exported from `pipeline/prompt.js` (no prompt text or version changed).
- **Tests:** `pipeline/generate.test.js` (15) and `routes/syllabusCheck.generate.routes.test.js` (7), all offline with a scripted model. **Run for real (2026-11-18, owner-approved, cap $2):** a test subject through the real Claude client ($0.44, 25 requests, 214 s, no AI misalignment on the generated plan), then the sidebar tab in the browser for CENGDIS (about 5.5 minutes, saved, 1 flagged item: the references). The first real run showed that the grading could leave out the Prelim examination; the grading now must count all three examinations (one periodic component, or each term named). Each generation prints one cost line in the API console.


### v1.98.1 — AI Syllabus Generator: Better Context, Background Job With Progress, Undo
**Date:** November 18, 2026

- **Quality:** the generator now knows the subject's units (laboratory work is added when the subject has lab units), its semester, its prerequisite subjects and the subjects the approved curriculum puts before it, so a topic is built on and not taught again. The curriculum lists no course description or topics, so the page has an optional "Notes for the AI" box (up to 1500 characters, sent as data, never in the system prompt) for topics, emphasis or the textbook. Every CLO must now be built by at least two weeks (CLO 4 was built by one in the first real run), and CLOs that end with the course title ("... in Data Structures") are sent back. The fixed rows are in `pipeline/generate-defaults.json` (aligned to the approved syllabus #111: the orientation week and the examination weeks), readable and editable without touching code. The repair pass is now tested end to end: a planted flaw is rewritten, verified by the checker and applied.
- **Process:** a generation runs as a background job (`pipeline/generateJobs.js`): `POST /api/syllabus-check/syllabi/:id/generate` answers 202 at once, `GET` reads its progress (six steps) and, when done, its result, `DELETE` removes a finished job. The screen shows the step and a progress bar, finds the job again if the author leaves the page and comes back (kept 30 minutes in memory; a server restart forgets it), and applies the result. One generation at a time on the server. After a generation the author can **Undo** to restore the sections as they were; the administrator also sees the run's estimated cost. A finished generation is a line in Recent Activity ("generated an AI draft of ...").
- **Not done, on purpose:** more than one ILO or CLO per week (each week is judged and repaired cleanly with one; more raises the check cost); reference suggestions (needs a source search the checker does not have); the Filipino strings are still my own translation.
- **Tests:** generator tests 21, route tests 11 (job flow), `generateJobs.test.js` 3, activity view and account activity updated. `npm test` passes (1,434). **Not run:** a paid generation with the new job screen in the browser.


### v1.98.2 — AI Syllabus Generator: Second ILO, Reference Suggestions, Jobs That Survive a Restart
**Date:** November 18, 2026

- **Second ILO:** the outline may give a week a second CLO (`alsoClo`, in at most 4 weeks), for example a CLO 4 values outcome in a topic with an ethical side. That week then has two ILOs, tagged to two CLOs, each with an activity and a task; it counts toward both CLOs' two-week minimum. Other weeks keep one ILO.
- **References:** a new step (7 steps now) asks the AI to NAME up to 8 candidate books; only a book the Open Library catalogue confirms is kept (the title and the first author's surname are the only things sent), and its APA 7 text is built from the catalogue's record (authors, newest English edition with a year and a publisher, "(4th ed.)"), never from the AI's words, and must pass the checker's own APA rule. At most 5 go into Books, the groups with no source are marked not applicable, and the checker then judges them. A real run of the lookup rejected an invented book and a translated edition. The author's own references are never replaced; a failed lookup only means no reference is added. `SYLLABUS_CHECK_GENERATE_REFERENCES=off` skips the step.
- **Jobs and the daily limit survive a restart:** new table `syllabus_generate_jobs` (`db/generate-jobs-ddl.js`, `npm run migrate-generate-jobs`, also in `schema.sql`). A finished result waits there until the screen applies it; a job that was running when the server stopped is reported as interrupted instead of running forever; the 5-per-day count is read from the table. Without the table everything still works in memory, as before, and the console says so once. Applied on the dev database 2026-11-18 (additive; rollback `DROP TABLE syllabus_generate_jobs;`), and the SQL was run against the real table (restart, count, applied, interrupted).
- **Filipino:** the strings now use the app's own terms (Tagasuri ng AI, silabus, Tagabuo ng Silabus, ipasa, baguhin, plano ng pagkatuto, mga kinakailangan sa kurso, sistema ng pagmamarka, mga sanggunian), the page title is "Tagalikha ng Silabus ng AI", and the messages the server writes in English (warnings, limits, interruptions) have Filipino keys too. Still written by me, not by a native speaker: please have a Filipino speaker read them.
- **Tests:** generator 27, reference suggestions 9, jobs 7, routes 13. `npm test` passes (1,456). **Not run:** a paid generation through the new reference step and screen in the browser.


### v1.98.3 — AI Syllabus Generator: No Daily Limit Per Person By Default
**Date:** November 18, 2026

- **Change (owner decision):** the 5-per-person-per-day limit is off. It applies only when `SYLLABUS_CHECK_GENERATE_PER_USER_PER_DAY` is set (a whole number of 1 or more); the count is then read from the jobs table. What still bounds the spend: the cost cap (`SYLLABUS_CHECK_GENERATE_MAX_COST_USD`) and the request cap of every run, one generation at a time on the server, and the administrator's AI switch.
- **Tests:** route tests 15 (no limit by default, and the opt-in limit still works).


### v1.98.4 — AI Checker and AI Syllabus Generator: Everyone Can Run At the Same Time
**Date:** November 18, 2026

- **Change (owner decision):** there is no server-wide lock any more. Before, one AI check at a time ran on the whole server (`activeChecks`, scoped to the app, although `docs/syllabus-checker.md` described a per-syllabus lock) and one generation at a time ran on the whole server; anyone else got "already running". Now every faculty member and reviewer can run an AI check and an AI generation at the same moment, with no waiting. The only lock left is per syllabus: the same syllabus is not checked or generated twice at once, whoever asks (`409 ai_check_in_progress` / `generate_busy`). Reading a report while it runs still shows "checking".
- **Still bounds the spend and the load:** the cost cap and request cap of every run; the daily AI check ceilings (`AI_CHECKS_PER_USER_PER_DAY` default 40 and `AI_CHECKS_PER_DAY` default 400, which cannot be turned off and now matter more: raise them to fit the number of faculty); 10 checks a minute per person; the Anthropic client retries a 429 or 529 after the wait the API asks for; the database pool (`DB_POOL_SIZE`, default 10) queues requests rather than failing them.
- **Not removable by code:** if the Anthropic account runs out of credit or its rate limit is lower than the load, runs fail with the AI's message and save nothing.
- **Tests:** the test that pinned the server-wide lock now checks the new rule (a different syllabus runs alongside, the same one is refused, the slot is released after success and failure); new tests: six faculty check at once and none is refused; seven syllabi generate at once; twelve jobs run side by side, each private to its author. `npm test` passes (1,459).


### v1.98.5 — Sized for 19 Faculty Running Everything At Once
**Date:** November 18, 2026

- **Settings:** `AI_CHECKS_PER_USER_PER_DAY=100`, `AI_CHECKS_PER_DAY=1000`, `AI_REFINES_PER_USER_PER_DAY=200` (were 40, 400, 60: 19 faculty at 40 would have run past 400) and `DB_POOL_SIZE=30` (was 10), set in the development `server/.env`, shown as the recommended values in `server/.env.example`, and listed in the staging checklist (`docs/vpaa-conformance/STAGING-SETUP-CHECKLIST.md`, with the generator's two settings and its migration). A staging or production host must set them itself: it does not read the development file.
- **New setting:** `AI_CHECKS_PER_MINUTE_PER_USER` (1 to 600, default 10, unchanged) for the per-person guard against a double click on "Check with AI"; 30 in development.
- **Tests:** compliance routes and AI quota tests pass (68), conformance tests pass (7).


### v1.98.6 — AI Syllabus Generator: The Course Description Is Written From the Finished Plan
**Date:** November 18, 2026

- **Change (owner):** the course description is not an official text; it is created from the Learning Plan, which makes the whole syllabus. The generator used to write it first, together with the CLOs and before any week existed, so it could describe topics the plan never covers, and it was left out when the author kept their own CLOs. Now the CLO request writes only the CLOs, and the description is written in the step after the weekly plan, from the finished plan: the CLOs, the topics of every week, and the tasks. It must say only what the plan contains, 30 to 250 words (the compliance standard asks for 30), and it is always written for the new plan, even when the author kept their CLOs, because an old description would describe the old plan.
- **Screen:** the progress step and the "replace" note name the description (English and Filipino).
- **Tests:** generator tests 30 (the description is never in the CLO request, it comes after the weekly plan with the CLOs and every week's topics, it is regenerated when CLOs are kept, too short and too long are sent back). `npm test` passes (1,462).


### v1.98.7 — AI Syllabus Generator: Better References (Newest Edition, Sentence Case, Journal Articles)
**Date:** November 18, 2026

- **Newest edition:** the book's own list of editions on Open Library is read (one request) and the newest English edition with a year and a publisher is used (a translation, or a year in the future, never). Before, only up to 8 ISBNs from the search were tried, so an older edition could win. Live check: Introduction to Algorithms comes out as the 4th edition, 2022.
- **APA sentence case:** the AI puts the titles in sentence case in one more request, accepted only when it changed capital letters and nothing else (letters and numbers must be identical to the catalogue's title, otherwise the catalogue's spelling stays).
- **Journal articles:** the AI may also name up to 5 articles; only one that Crossref confirms is kept (title and first author's surname match, and the record has a year, a journal, authors with given names and a DOI), written in APA 7 from Crossref's record with its DOI link (live check: LeCun, Bengio and Hinton, 2015, Nature). Up to 5 books and 3 articles are kept; books go to Books, articles to Internet References, the other groups are marked not applicable. Websites are NOT suggested: nothing can confirm a page's title, author and date.
- **Only these addresses are called:** Open Library search, one work's editions, one edition by ISBN, and Crossref's work search (allowlist in `referenceSuggest.js`).
- **Phone width:** checked at 375 px in the browser: the generator page has no sideways scrolling and the card and its button fit; the hint now has space above the button.
- **Tests:** reference suggestions 14, generator 31; `npm test` passes (1,467).


### v1.98.8 — AI Syllabus Generator: Quality Guards (Level, Packed Weeks, Template Counts, Quiz Share)
**Date:** November 19, 2026

- **What was checked first:** the first real run (Data Structures and Algorithms) was replayed through the new rules. Findings: every one of the 14 lesson weeks had exactly 3 activities (a template: now caught); 35% of the tasks were quizzes or tests (now the limit is 30% per chunk of weeks); no ILO below apply level sat in a CLO 2, 3 or 4 week (low verbs were only in CLO 1 weeks, which is right), and no week was packed. So the level and packing rules are safeguards, not repairs of a seen failure.
- **Rules in code** (`pipeline/generate.js`, each sent back once with the problem named, as every other check): an ILO of a week that builds CLO 2, 3 or 4 (also a second ILO) is at apply level or above, not a recall or understanding verb; a week's content is at most 4 topic groups (separated by semicolons) and 260 characters; 2 to 4 activities and 1 to 3 tasks, and a chunk of 5 or more weeks may not give every week the same number of 3 or more activities; a week's tasks are not only quizzes or tests; at most 30% of the tasks of a chunk are quizzes or tests.
- **Told to the AI first:** the same rules are in the system prompt and in the outline and weekly requests, so the first answer is usually right and the retry (which costs a request) is rare.
- **Tests:** generator tests 37. `npm test` passes.


### v1.98.9 — AI Syllabus Generator: Assigned Subjects With No Draft Yet Can Be Generated
**Date:** November 19, 2026

- **Change (owner):** the generator page lists the subjects assigned to the faculty member (the same list the builder uses: `GET /api/courses?taken=1`; an administrator sees every subject) that have no draft yet, marked "no draft yet", next to their existing editable drafts. Choosing one and pressing Generate creates the draft the way the builder does when a subject is chosen (the subject's vision, mission, EGAs, POs and CLOs are copied in, `saveOnce`, and a refused subject, for example one the person already has a syllabus on, leaves no empty row behind), then generates into it. The page moves onto the new draft, the app's list of syllabi is read again, and the progress screen is not reset by the draft getting its id. A subject that already has a draft (or was just started) is no longer offered as new. When nothing is assigned, the page says so.
- **Checked in the browser** (demo faculty, one temporarily assigned subject, generator cost cap set to $0.01 so the run was refused before any AI request, then restored to $2): the picker showed "CENGDIS — … · no draft yet" and the note that a draft is created; Generate created draft 119 with the subject's 13 POs and 4 EGAs; the run failed at step 1 with the cost-cap message and nothing was spent; the page then showed the new draft. The draft, the assignment and the temporary cap were removed afterwards. **Not checked:** a successful run from a subject with no draft (needs a paid generation).


### v1.98.10 — AI Syllabus Generator: Quality Guards No Longer Stop a Run
**Date:** November 19, 2026

- **Found in the first general-education run** (Mathematics in the Modern World, BSIT, syllabus 120, run by the owner): the run stopped at the course outline with "The AI could not write a usable course outline (Week 2, Week 3 and Week 5 have more than 4 topic groups)". The v1.98.8 packed-week rule was applied as a hard rule, so after the retry the whole generation was refused and nothing was written (the CLO and outline requests had been spent).
- **Change:** the quality guards are now SOFT: the level of an ILO in a CLO 2-4 week, a packed week, a week of only quizzes, more than 4 activities or 3 tasks, the same number of activities in every week, and too many quizzes. They are sent back once with the problem named (as before); if the second answer still has them, the run goes on and the author gets a warning naming the weeks to review ("The AI did not fully follow these quality guidelines after two tries ..."). Only structure still stops a run: invalid JSON, a missing week, a copied ILO, a teacher-led ILO, two verbs, a missing core value, too few activities or tasks, a missing CLO. The packed-week limit is now 5 topic groups and 320 characters (the prompt says "3 to 5").
- **Cost of a stopped run:** the error now carries what the run spent, and the server prints one line for a stopped run as it already did for a finished one ("AI Syllabus Generator STOPPED: ..., N requests, estimated $X").
- **Filipino:** the new warning has a Filipino version.
- **Tests:** generator 41. `npm test` passes (1,477).


### v1.98.11 — AI Syllabus Generator: Older References Get a Second Look and a Warning
**Date:** November 19, 2026

- **Found in the MMW run (syllabus 120):** the five suggested books were real but dated 2016, 2016, 2010, 2010 and 2007; three were over the school standard's 10-year limit, so Reference Currency scored 70 (the whole syllabus scored 96, "Excellent").
- **Change:** when the newest edition Open Library knows is more than 5 years old, Crossref (`filter=type:book`) is asked once for a newer record of the same book: same title, same first author, a later year that is not in the future, a publisher and authors with given names. If one exists it replaces the old one and its DOI link is written in the reference (live check: a Springer book came out as 2023 with its DOI). If Crossref has nothing newer, or fails, the catalogue edition stays and the author is told: "N reference(s) are more than 10 years old, the limit of the school's standard ... Replace them with the newer editions you use" (English and Filipino).
- **Live check, honest result:** for the MMW textbooks (Triola, Tannenbaum, Miller; Pearson and Prentice Hall) Crossref holds no newer record, so they stay 2010, 2010 and 2007 and the warning names them. Crossref only helps for publishers that register DOIs (Springer, Wiley, OUP, ...). A third source with newer editions (for example Google Books) would be needed to improve those.
- **Found live, fixed:** asking Crossref for the field `edition-number` makes it refuse the whole request (HTTP 400), so the lookup would have silently found nothing; the fields are now a fixed list and a test pins that every field is one Crossref knows. Also: a catalogue publisher "McGraw-Hill Companies, The" is written "McGraw-Hill Companies", and a Crossref publisher with the place glued on ("Oxford University PressOxford") is skipped.
- **Tests:** reference suggestions 19, generator 41. `npm test` passes.

---

### v1.98.12 — AI Checker: The 5-Year Reference Note Counts From the Syllabus's School Year
**Date:** November 19, 2026

- **Problem:** the AI Checker's "older than 5 years" note on a reference (REF-RECENCY, review only, no points) counted from today's calendar year: neither the official check (`compliance/service.js`) nor Check & improve (`routes/syllabusCheck.js`) passed a year. A 2023–2024 syllabus checked in 2026 had its 2019 book flagged, although it was recent enough for that syllabus.
- **Change** (`pipeline/check.js` `yearOfSyllabus`): when no year is passed, the check uses the start year of the syllabus's own academic year (`meta.academicYear`, "2026–2027", which the server sets from the subject on every save); without one, the server's school year (`lib/schoolYear.js`, what the builder's compliance check uses), never today's date. The official check, the repair plan and Check & improve all go through it. A year the caller passes still wins.
- **Not changed:** the builder's compliance check (rule R-03, 10 years, server-side `compliance/service.js` and the builder) still counts from the server's school year (`SCHOOL_YEAR_START`), not each syllabus's own year; the AI Checker's score does not use R-03 (`engine.js` leaves it out). Every syllabus in the dev database is 2026–2027, so nothing changes for them today.
- **Tests:** `pipeline/reference-year.test.js` (3): the year from "2023–2024", "2023-2024" and "S.Y. 2025 - 2026"; a 2019 book is fine for 2023–2024 and 2024–2025 and noted for 2025–2026 and 2026–2027; the fallback and a passed year. All 1,486 server tests pass. `npm run test:e2e`: the checker scenarios pass (E03, E05, E12, E15); E09, E10, E11, E14 and E20 failed on the report drawer and AI Checker screens being reworked at the same time (uncommitted `ReportDrawer.jsx`, `AIChecker.jsx`, `scenarios.cjs`), not on reference years. `test:localization` and `test:pdf-import-ui` fail on the student and builder screens (commit 097e1169 and uncommitted builder edits), not on this change.

---

### v1.98.13 — Tests: Student Screens Translated; PDF Import Screen Tests Follow the New Import Flow
**Date:** November 19, 2026

- **Problem:** `npm test` stopped at the localization audit, so its last two suites never ran. Four texts on the student screens were in English only: the COR consent ("I agree to AI reading of my COR." and its explanation) in `StudentRegister.jsx`, and "Download PDF" twice in `StudentViews.jsx` (commit 097e1169). Behind it, `test:pdf-import-ui` failed 12 of 16 on the committed code: its tests still expected the old flow. Since 686a8512 the subject comes from the PDF (no subject needs to be chosen first), and since e0f22b56 the button is "Apply to form", which only fills and saves the form; AI CHECK is a separate step from the Review step.
- **Change:** the four texts use new keys `studentView.downloadPdf`, `studentView.consentTitle` and `studentView.consentBody`, in English and Filipino (`src/i18n/extra.js`). `tests/pdf-import-ui.test.jsx` follows the current flow: with no subject the scan goes ahead; every Apply is "Apply to form"; in the builder, Apply saves once (or again after a failed save, without a second scan), never runs AI CHECK, says to run it from the Review step and returns to Step 1. The old "check failed after Apply" case is gone, because Apply no longer checks. The app's behaviour is unchanged.
- **Tests:** the localization audit passes (no hardcoded display strings); `test:pdf-import-ui` passes 15/15 here and on a clean copy of the committed code; the whole `npm test` chain passes (1,486 server tests; the VPAA screens 28/28).

---

### v1.98.14 — AI Checker: The Report Slides In From the Right
**Date:** November 19, 2026

- **Change** (`src/components/ReportDrawer.jsx`, new): the AI Checker report is a panel that slides in from the right edge and back out when it is closed. It opens at a reading width; an arrow button widens it to the whole window and back. Esc, the backdrop and ✕ ("Close report") close it; focus stays inside while it is open and returns to the button that opened it (the same `useModalLayer` the dialogs use). Reduced-motion settings turn the animation off.
- **AI Checker tab** (`src/views/AIChecker.jsx`, `src/views/builder2/ComplianceSection.jsx` `layout="panel"`): one slim row holds the subject, Edit Syllabus, the score of the saved check ("View report") and the check button ("Run AI Checker", then "Re-Check again"). A check that has just finished opens its report; a saved report opens from the score. Until a check has run, a hint under the form says to run the AI Checker before submitting. The builder's Review step keeps the report inline as before.
- **Administrator's check report** (`src/components/ComplianceModal.jsx`): the same drawer instead of the centred dialog; Edit draft, Approve and Close are in its footer.
- **Fixed before commit:** the drawer's check button said "Check again" while the row and the rest of the page say "Re-Check again"; it uses the same label now (the unused `aiChecker.recheck` key is removed). The row did not wrap between 600 px and about 1,100 px, so the AI Checker page was wider than a tablet or a small laptop (768 px: 1,056 px wide); it wraps at every width now.
- **E2E** (`scripts/e2e/scenarios.cjs`): the scenarios open the report from the score when it is not already open, use the drawer's footer button to check again, close it before using the page behind it, and press "Run AI Checker".
- **Not in this commit:** the AI Syllabus Generator's redesigned panel (`GeneratePanel.jsx`, `SyllabusGenerator.jsx`, its texts and styles) and the notification links in `App.jsx`, which are separate work in progress.
- **Tests:** `npm test` passes (1,486 server tests, localization, PDF import 15/15, VPAA screens 28/28); `npm run test:e2e` passes 25/25 scenarios, 457/457 checks. Both ran with the generator and notification work also in the working tree.

---

### v1.98.15 — Builder Opens Again; 404 and Error Pages Translated
**Date:** November 20, 2026

- **Problem:** the screen-in-the-address feature merged this morning (PR #56, `App.jsx`: `#reports`, `#ai`, so a refresh stays on the screen) turned `#builder` into My Syllabi on every address change, not only on a page load. Opening the builder sets `#builder` itself, so "New syllabus" and "Edit" closed the builder the moment it opened: nobody could create or edit a syllabus. E2E failed 15 of 25 (E02 first: the builder's "Choose a program" never appeared; the rest had no draft to check, submit or review).
- **Change** (`src/App.jsx` `pageFromHash`): only a page load turns `#builder` into My Syllabi (a refreshed builder would open a blank draft, as the comment says); a hash change to `#builder` keeps the builder open. Every other screen was already in the menu list and was not affected.
- **Also:** the new 404 page (`NotFound.jsx`) and error page (`ErrorBoundary.jsx`) were English only and stopped `npm test` at the localization audit; their texts now use translation keys in English and Filipino ("Reload" reuses the existing key). E2E E13 expected the dashboard greeting after a reload; a reload now stays on the AI Checker page, so it checks the Filipino text of that page instead.
- **Tests:** `npm test` passes (1,491 server tests, localization, PDF import 15/15, VPAA screens 30/30); `npm run test:e2e` passes 25/25 scenarios, 457/457 checks.

---

### v1.98.16 — AI Checker: Check Coverage Shows the New AI Checker's Rules and AI Questions
**Date:** November 20, 2026

- **Problem:** the "Check coverage" list in the AI Checker report showed only the 81 fixed checks of `ruleCatalog.js` (the form standard, the institutional rules, the quality notes). 19 of the new AI Checker's 20 fixed rules were missing (only ILO-MISSING shares an id), and its AI questions (152 on the sample syllabus, 14 kinds) were in the report data but counted nowhere a person reads. A code comment said its rules were "already counted"; they were not. The explanation still spoke of "Hybrid-2" and "reference subchecks".
- **Change:** the new checker records each fixed rule it ran and what it found (`hybrid.replan.fixedRules`; `pipeline/fixedRules.js` `RULE_IDS` names all 20). `ruleCoverage.js` lists them (namespace `new_ai_checker`): no finding is checked and passed, a finding needs revision, a review item needs faculty review, each with where it was found. It also counts the AI questions by kind (`aiQuestions`: asked, aligned, partly aligned, not aligned, not answered). The panel heading counts both ("Check coverage: 89 of 101 rules checked · AI questions: 152 of 152 answered"), the list ends with the AI questions by kind, and the explanation is rewritten, in English and Filipino. A report the new checker did not make shows neither (no invented coverage). The budget notices stay: only a saved report of the old checker carries a budget, and for it they are still accurate.
- **Not changed:** the score, the findings and submission; check coverage is information only.
- **Tests:** `pipeline/coverage.test.js` (+5): every rule `fixedRules.js` can report is in `RULE_IDS`; each new-checker row agrees with its findings; the AI questions are each counted once, by kind; unanswered questions are not checked, never passed; a no-AI report has neither. `tests/vpaa-conformance-ui.test.jsx` (+2, English and Filipino): the 20 rules, the heading and every kind of AI question are shown, with no translation key or "Hybrid-2" leaking. `npm test` passes (1,491 server tests, localization, PDF import 15/15, VPAA screens 30/30); `npm run test:e2e` passes 25/25 scenarios, 457/457 checks.

---

### v1.98.17 — Every Program Outcome Must Be Linked to an EGA
**Date:** November 20, 2026

- **Owner decision:** the link from each Program Outcome to the EGAs it serves is required, not optional. The fixed rule P-03 (CLO tagged with a PO must also carry that PO's EGAs, major, weight 2) can only check against it; without it P-03 passes with nothing to compare. In the dev database no PO of BSIT (9) or BSCPE (13) was linked.
- **Admin saving** (`server/lib/programOutcomesInput.js` `parsePos`, used by the program's Outcomes and by "Add program" with its first subject; `src/lib/outcomesSetup.js` `checkPos`, the same check before the request): a PO without at least one EGA is refused with "PO {n} must be linked to at least one EGA", in English and Filipino.
- **Programs to fix:** `GET /programs` reports `unlinkedPoCount`; the Curriculum list shows "Link POs to EGAs" on such a program and a banner names them with how many POs are unlinked, and says how to fix it (tick the EGAs each PO serves, save, apply to the subjects). A specialization is linked in the program it inherits from.
- **AI Checker report:** when the syllabus's POs are not all linked, a notice at the top names them and says to ask the administrator (`ruleCoverage.posWithoutEga`, `RuleCoveragePanel`). Owner choice: it warns and blocks nothing; P-03 stays Not checked until the links exist.
- **Not changed:** the new AI Checker's AI questions and its own fixed rules do not read the links (stored answers stay valid). The AI Syllabus Generator already uses them to fill a CLO's EGAs from its POs.
- **Tests:** `parsePos` refuses a PO without an EGA; `checkPos`, `needsEgaLinks` and the program count; coverage lists the unlinked POs ([] when linked, null without POs); the report notice in English and Filipino. `npm test` passes (1,493 server tests, localization, PDF import 15/15, VPAA screens 32/32); `npm run test:e2e` passes 25/25 scenarios, 457/457 checks.

---

### v1.98.18 — Builder: Ticking a PO on a CLO Ticks the EGAs It Serves
**Date:** November 20, 2026

- **Problem:** in Step 2 of the builder the EGA and PO checkboxes of a CLO did not know about each other. The PO-to-EGA links (required since v1.98.17) were shown only in the Program Outcomes card above, so an author had to remember them, and a CLO missing an EGA of its PO was found only after the AI Checker ran (P-03, which takes points).
- **Change** (`src/views/builder2/ClosStep.jsx`; helpers `linkedEgas`, `tickPo`, `missingPoEgas` in `src/lib/outcomesSetup.js`): ticking a PO on a CLO also ticks the EGAs it is linked to; unticking a PO leaves the EGAs (another PO may need them, or the author chose them). Each PO chip shows its EGAs ("PO 1 · EGA 1, 4"). When a linked EGA is not ticked, a note under the chips names it ("PO 1 serves EGA 4: tick it on this CLO too.") with an "Add the EGAs of its POs" button. English and Filipino.
- **Not changed:** the author can still tick any EGA and PO; scoring, P-03 and the AI Checker are as before. A PO without links adds nothing (BSIT and BSCPE until an administrator links them).
- **Tests:** the helpers (ticking, unticking, a PO without links, missing EGAs per PO); the CLO row rendered with a synthetic program in English and Filipino (chip, note, button). `npm test` passes (1,494 server tests, localization, PDF import 15/15, VPAA screens 32/32); `npm run test:e2e` passes 25/25 scenarios, 457/457 checks.

---

### v1.98.19 — AI Syllabus Generator: A Generated CLO Carries the EGAs of Its POs
**Date:** November 20, 2026

- **Problem:** the generator added the EGAs a CLO's POs are linked to only when the model gave that CLO no EGA at all. When the model chose some EGAs, a linked one could be missing, so once the POs are linked (required since v1.98.17) a generated draft could fail P-03 and lose points on its first check, unlike a CLO ticked in the builder (v1.98.18).
- **Change** (`pipeline/generate.js` `readClos`): the linked EGAs of each CLO's POs are always added to the ones the model chose (none twice; a PO without links adds nothing). The model still writes the statements and picks the POs; the AI Checker still checks that each EGA fits the CLO.
- **Not changed:** with no links (BSIT and BSCPE today) generation is as before.
- **Tests:** `generate.test.js` (+1): linked EGAs added to the model's, none twice, nothing for a PO without links. `npm test` passes (1,495 server tests, localization, PDF import 15/15, VPAA screens 32/32); `npm run test:e2e` passes 25/25 scenarios, 457/457 checks.

---

### v1.98.20 — AI Checker: Check Coverage Counts the Rules That Apply and Says Why the Others Do Not
**Date:** November 20, 2026

- **Problem:** the heading counted every catalogued rule, including the 12 that cannot apply to a syllabus (9 not applicable, 3 retired): syllabus 120 read "89 of 101" although every rule that applies had run. Six of those rows (T-09 to T-12, T-25, T-27) gave no reason; the rest gave English-only technical text ("Superseded by link verification…", "Missing-reference branch…"), also in Filipino.
- **Change:** `ruleCoverage.js` gives every row that does not apply, and every retired one, a reason code (`replaced`, `checked_by_exact`, `no_override`, `signoff_by_system`, `master_present`, `no_reference_urls`, `identity_stopped`, `not_applicable`). `RuleCoveragePanel` words each one in plain English or Filipino, and its heading counts the rules that apply and says how many do not ("89 of 89 rules that apply checked (12 do not apply to this syllabus) · AI questions: 166 of 166 answered"). The old heading keys are removed.
- **Not changed:** which rules run, the score and the findings.
- **Tests:** `pipeline/coverage.test.js` (+1): every not-applicable and retired row has a known code, worded in both languages; a rule that ran has none. `tests/vpaa-conformance-ui.test.jsx` (+2, English and Filipino): the heading, a reason on every row that does not apply, and none of the old technical text. `npm test` passes (1,496 server tests, localization, PDF import 15/15, VPAA screens 34/34); `npm run test:e2e` passes 25/25 scenarios, 457/457 checks.

---

### v1.98.21 — AI Checker: Check Coverage Lists Only the AI Questions by Kind
**Date:** November 20, 2026

- **Owner decision:** the Check coverage list at the end of the AI Checker report shows only the AI questions the AI Checker asked, counted by kind (how many were aligned, partly aligned, not aligned or not answered). The 101 rule-by-rule rows (form standard, institutional rules, quality notes and the AI Checker's own rules) are no longer listed.
- **Change** (`src/components/RuleCoveragePanel.jsx`): the collapsed list reads "AI questions: {answered} of {asked} answered", with a short explanation and one line per kind. A report without AI questions shows no list. The notices at the top stay: Program Outcomes not linked to an EGA, and the budget notices of a saved old-checker report. The rule receipts stay in the saved report (`ruleCoverage.rules`, with their reason codes) for audit; only the screen no longer lists them. The 21 texts that only the rule rows used are removed in both languages.
- **Not changed:** what is checked, the score, the findings and the AI questions themselves.
- **Tests:** `tests/vpaa-conformance-ui.test.jsx`: an incomplete report counts its questions as not answered and never as aligned; a scored report lists every kind and no rule rows; a report without AI questions shows no list (English and Filipino). The rule-row screen tests are removed. `npm test` passes (1,496 server tests, localization, PDF import 15/15, VPAA screens 30/30); `npm run test:e2e` passes 25/25 scenarios, 457/457 checks.
