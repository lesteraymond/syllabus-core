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

### v1.54.0 — AI Checker, Student Role, Real Analytics, PDF Reports, Search and the Developer Rule Editor
**By:** Sean Mahinay  
**Date:** October 22, 2026

**AI Checker and compliance standard:**
- The compliance check runs on the "Undergraduate Syllabus v7" standard (61 rules in `server/lib/compliance/standard-v4.json`: pass mark 79, six scored areas). The AI step judges whether the text means something (`meaning.js`, rules J-01 to J-05) and writes the recommendations. Providers: OpenRouter (default model `minimax/minimax-m3.1-flash:free`) and Gemini (`gemini-3.1-flash-lite`), chosen from the keys in `.env`; masked names and emails only leave the server. Verdicts are cached by text so an unchanged field keeps its score.
- Each AI check is written to Recent Activity ("ran an AI check on ..., AI check score NN%").
- The compliance dialog: the score ring counts up from 0, the five area bars fill smoothly, the priority chip is a small circle, and the row and week numbers in a recommendation are buttons that open the Learning Plan step and flash that row.
- Administrators can read the standard: Settings, Institutional Standard, **View standard** (`GET /api/settings/standard`, admin only). It shows the pass mark, the bands, how the score works, the areas with their weights, all 61 rules (message, explanation, severity, points, a search box, total points) and a legend for the rule codes (T-, C-, P-, A-, H-, R-, J-), plus the values still waiting for the curriculum office.
- Settings: the standard and the department are read-only (the standard always names the checker's own standard; the department is the College of Information Technology and Engineering). The academic year is the only editable value and is typed as two consecutive years (for example 2026-2027).

**Developer rule editor (new, hidden):**
- `http://localhost:3001/dev/rules` is a page of its own, not linked from the app, behind `DEV_EDITOR_PASSWORD` in `server/.env` (at least 8 characters; with none set the editor is off). A correct password opens it for 30 minutes; five wrong ones lock that address for ten minutes.
- It edits the pass mark, score bands, area weights, eight numeric limits, and per rule the points, severity, message, explanation, numeric parameters and whether the rule counts. A save applies at once (no restart) and gives the standard a new version label (v7.1, v7.2, ...) so stored checks of older rules are never reused as current. "Reset to file" removes the edits. Every change is kept in a history (`standard_changes` table, created on first use and in `schema.sql`).
- Edits live in the database (`app_settings` key `standard_overrides`) on top of the standard file: `server/lib/compliance/overrides.js` and `overridesStore.js`, route `server/routes/devRules.js`, page `server/views/rule-editor.html`. New rules and new kinds of check still need code.

**Students and the COR scan:**
- New **student** role: students register with a COR photo, wait for approval, and then see their enrolled subjects. A student can open every approved syllabus (not only those of their own subjects), read-only, from Syllabi.
- The COR is read by an AI vision model instead of OCR (`server/lib/corAi.js`): it first decides whether the image is a COR, reads the fields, and the server checks them (ID format, BSIT program, subject codes). It retries a busy provider once and tries a second Gemini model. There is no silent fallback to OCR. `COR_READER=ocr` brings the Tesseract reader back for testing.
- Sections no longer show "/TBA" (a printed "BSIT4B/TBA" is stored as "BSIT4B").

**Dashboard and Analytics:**
- Both are built from the stored compliance checks instead of sample numbers: average score, trend, score bands, scores by program (or by subject for faculty), quality by area, reference currency and the insights. Tooltips appear straight away, the donuts are clickable (the tooltip follows the colour you pick) and the average counts up.
- The chart that showed program scores was titled "Submission Completion"; it is now "Average Compliance Score".
- The actionable insights are buttons that take you to the AI Checker, Reviews or My Syllabi, and the subtitle says they come from the stored checks.

**Reports (PDF):**
- **Download report** on Analytics builds a PDF: summary, submission status, score bands, scores by area, scores by month, scores by program, the syllabi below the pass mark (code and title in separate columns), insights and signature lines, with the syllabus header (LCUP and Testmark logos, school year, College of Information Technology and Engineering).
- The Faculty Compliance Report downloads a PDF (summary, per-faculty table, who is not compliant, each faculty member's syllabi). The Compliance page, the Reports card and the PDF share one counting rule (`src/lib/facultyCompliance.js`): a syllabus counts once it is submitted or approved; drafts and returned ones do not. 2 are required per faculty member.
- **Historical Exports** lists the school terms that have checks (`GET /api/compliance/terms`) with a Download PDF button each; `GET /api/compliance?schoolYear=2026-2027&semester=1st Semester` returns each syllabus's newest check inside that term. Terms follow Philippine time: the school year starts in June (Summer June-July, 1st Semester August-December, 2nd Semester January-May). The status table of a past term is as of the date generated.
- The PDF library (`jspdf`, `jspdf-autotable`) loads only when a download is pressed.

**Search, navigation and the builder:**
- The top bar search works: syllabi (code, title, faculty, program), and for administrators also faculty (opens Compliance filtered to that person) and subjects. Faculty search their own syllabi; students search the approved ones. Arrow keys, Enter and Escape work.
- The page you are on survives a reload (kept per browser tab; the builder is not restored). Reloading or closing the tab in the Syllabus Builder asks first once anything was typed.
- "Save and continue to AI Checker" / "Submit" explains why it cannot go yet (a note above the button, not only a short toast). On phones the seven steps are a swipeable row that keeps the open step in view.
- Timestamps in the activity feed use a lighter separator dot.

**Mobile:**
- Student subjects and the student repository, the syllabus preview and the compliance dialog (floating windows, not full screen), Program & Subjects, the repository, check history (a date filter that fits) and the notifications list were reworked for phone widths. A horizontal line separates notifications.

**Validation and deployment:**
- 747 passing automated tests (681 domain/API/helper checks, 22 localization/preference checks and 44 rendered UI checks); the localization audit and the production build pass.
- New tests: `analyticsView`, `reportView`, `facultyCompliance`, `searchView`, `terms`, `corAi`, `overrides`, the rule editor routes, and the settings and standard routes.
- Not checked in a real browser or on a phone: the PDFs were drawn and viewed from Node, the rule editor page was checked against a stand-in DOM, and the layout changes were not reviewed on a device.
- New dependencies: `jspdf`, `jspdf-autotable`. New environment variables: `DEV_EDITOR_PASSWORD`, `COR_READER`, `COR_AI_MODEL` (see `server/.env.example`). New table: `standard_changes` (created on first use; also in `schema.sql`).

---

### v1.55.0 — Automatic AI Suggestions for Everything the Check Found
**By:** Sean Mahinay  
**Date:** October 22, 2026

**Review & Check step (faculty):**
- When a check finishes and found something, a **Suggested changes** card appears under it on its own (no button): the server works out a fix for every finding that can be fixed. Each suggestion shows where it is, the rule codes it answers, why, and the text now beside the suggested text, with **Accept suggestion** and **Reject suggestion**. **Accept all N suggestions** and **Reject all suggestions** do the whole list; **Refresh suggestions** asks again.
- The card says what the rule-based score would be with every suggestion applied ("from 81% to 97%"); the AI's meaning check runs again at the next re-check.
- Accepting writes the change into the form (the normal autosave follows). **Undo this change** puts it back. A suggestion is not applied when the author edited that part meanwhile. Rejections are remembered per syllabus in this browser and are not offered again until that part of the form changes.
- **Still needs you** lists the findings no suggestion can fix, with a link to the step.

**What is fixed, and how:**
- Without AI (always, even with no AI key): grading that does not total 100% is scaled to 100 (T-24); a typed requirement number is removed (T-20); a missing Prelim, Midterm or Final examination row is added at week 6, 12 or 18 (A-03); an empty ILO before a filled one is removed (T-17); Learning Plan rows are put in week order (T-18). The vision, mission and graduate attributes are set to the LCUP wording the standard holds (T-28, T-29, T-30).
- With the AI, from what the syllabus already says (its title, outcomes, ILOs, contents and grading): a missing or thin description (T-04, C-01, J-01), ILO wording (C-02, J-04), requirements (J-02), content, activities or assessment tasks that do not match their ILO (A-05, A-06, A-07, J-05), empty lesson cells (T-16, A-01), a lesson that names no core value (C-05), and missing requirements (T-19, drafted from the grading components).
- Not fixable by a suggestion, so a full score is not always reachable: references (a rewritten or invented citation would be false), course details, outcomes, tags, a stored copy of the catalog's vision, mission, EGAs and POs that differs from the live catalog (T-09 to T-12, resubmit to refresh it), the sign-off, credit units, missing grading components and weeks the plan does not cover. These are listed under "Still needs you".

**Server:**
- `POST /api/syllabi/:id/suggestions` (the owner only; 404 for anyone else, 409 on an approved syllabus). It needs a current check (`no_check`, or `stale` when the form changed since it) and answers with `{ suggestions, ai, score: { now, after }, remaining }`. `ai` is `ok`, `none` (nothing needed words), `unavailable` (no provider) or `failed`. Limited to 10 requests a minute per person.
- A suggestion is a list of small edits (`formOps.js`: set, insert, remove, reorder, sort by week) addressed by item ids, so accepting one does not break the others. The same code is in `server/lib/compliance/formOps.js` and `src/lib/formOps.js`, and `formOps.parity.test.js` keeps them the same. The server applies all suggestions to a copy and re-runs the rules to give the score above.
- `fixes.js` holds the fixes that need no AI; `suggest.js` asks the AI in batches of 10 items (at most 40 items per request), checks what comes back (a known item, a sensible length, at least the words the standard asks of a description or ILO, a real core value) and masks names and emails first. Answers are remembered by the text and problem they answered, so asking again costs no tokens.

**LCUP wording:**
- The mission the standard compares a syllabus with (T-29) is now the LCUP's current text ("LCUP commits to generate and make available to all persons and communities programs and services that will enable them to: ...", six items); the vision is unchanged. The seed data (`src/data/outcomesSeed.js`) carries the same vision and mission, so a fresh database starts with the wording the checker expects.
- The Syllabus Builder puts the LCUP vision and mission in by itself: choosing a subject fills them with the LCUP wording (not the subject's older starting values), and opening an editable draft that carries different text replaces it and saves the correction on its own (no "unsaved changes" warning, since the author typed nothing). Submitted versions, and read-only previews of them, are not rewritten. In step 2 (Learning Outcomes) the vision, the mission introduction and the mission statements are shown greyed out and cannot be edited; the "add" and "remove statement" controls for the mission are gone, and a note says the LCUP vision and mission are fixed and added for you.

**Validation and deployment:**
- 778 passing automated tests (712 domain/API/helper checks, 22 localization/preference checks and 44 rendered UI checks); the localization audit and the production build pass. New: `formOps` and its parity test, `fixes`, `suggest` (with stand-in AI replies that, once applied, clear the findings they answer), `suggestionView` and four route tests.
- Not tried against a real AI provider or in a browser. In a trial with a stand-in provider a deliberately weak syllabus went from 88 to 97 by the rules, with only a reference and two alignment findings left; a real model may need a second round for alignment.
- No database change.

---

### v1.56.0 — Programs and Subjects from the Curriculum, with Linked Prerequisites
**By:** Sean Mahinay  
**Date:** October 22, 2026

**Programs and subjects (the `curriculum/` photos):**
- The registrar's "Courses Curriculum" print-outs in `curriculum/` (BSIT 2022-2023, BSIT with Specialization in Cyber Security 2025-2026, BSCPE and BSIE 2022-2023) were read and typed into `server/db/curriculum-data.js`. `npm run seed-curriculum` (from `server/`) loads them: **four programs** for the program dropdown (BSIT, BSIT-CS, BSCPE and BSIE; the existing BSIT and BSIE keep their names) and **every program's own subjects**, each belonging to its program: BSIT 31, BSIT-CS 40, BSCPE 42, BSIE 40 (these include the sample subjects that were already there).
- **A subject code is now unique within its program, not across the catalog** (`npm run migrate-course-code-per-program` replaces the unique key on `courses(code)` with one on `courses(program_id, code)`; `schema.sql` and the subject routes follow). So the same ENGEC, ENGBOHS, CAD, TECHPREN-CITE or IS-CITE exists in each program that prints it, each with its own prerequisites and syllabi, and IT 204 can be a different subject in BSIT and in Cyber Security. Subjects an earlier import added with a suffix (IT 202-CS, IT 302-IT) were given their printed code back. Adding a subject whose code another program uses is allowed; the same code twice in one program is still refused ("IT 101 already exists in BSIT").
- General education (GE, PATHFit, NSTP, TH) is not imported: a prerequisite that names one is kept as its printed label. The math and science subjects (MA 7, MA 8, MA 9DE, CHEMENG, PHYENG) are imported for BSCPE and BSIE. Codes are written one way ("IT-204" is "IT 204"); a few typos in the print-out are corrected in the titles.
- An existing subject with the same code in the same program but another title is retitled (IT102 "Computer Programming 1" became "Discrete Mathematics"); its CLOs, standards and syllabi are untouched. `--dry-run` only reports and `--no-updates` leaves existing titles and codes alone. The script adds, never deletes, and a second run changes nothing.
- A COR line that matches a code used in several programs is matched to the subject listed first (the lowest id).
- The old sample subjects that are not in any curriculum (IT103 and IT104 in BSIT, "IT 302 History of IE" in BSIE) were removed from the database on request, so the catalog is exactly the 150 curriculum subjects. Syllabi #3, #4, #5, #6 and #8 stayed (with their saved content) but lost their link to a subject, and the 3 faculty assignments and 6 CLOs of those subjects went with them.
- New programs and subjects start with no graduate attributes, program outcomes or CLOs: an administrator sets those up in Program & Subjects before faculty can use a subject, as for any new subject.

**Prerequisites linked to the subject:**
- New table `course_prerequisites` (`npm run migrate-prerequisites`; also in `schema.sql`): one row per printed prerequisite, in order, either a link to another subject of the same program or, when it is not a subject of the catalog (3rd Yr, PATHFit 1 ...), its printed label. A subject with no prerequisite says "None".
- `GET /api/courses/:id` now returns `prerequisites` and `prerequisiteText` (for example "IT 202 – Computer Programming 1 (Fundamentals of Programming); 3rd Yr": each linked subject as its current code and name, a year standing as printed, separated by "; " because a subject's name can contain commas; null when nothing is set).
- The Syllabus Builder fills **Pre-requisite (IV)** with it when the subject is chosen, or when the field is still empty, and a catalog with nothing set leaves it as typed. The field is a **dropdown with checkboxes and a search box**: "None", the year standings (2nd Yr, 3rd Yr, 4th Yr) and every other subject of the chosen program (code and title), several at once. The syllabus still keeps plain text ("IT 202 – Computer Programming 1; 3rd Yr"), so the finished form, the checker and older syllabi are unchanged; text an author wrote that is not in the list stays selected under "As already written" until it is unticked, and older text with bare codes and commas ("IT 202, 3rd Yr") is still read. `GET /api/courses/:id` also returns `programSubjects` (id, code and title of the program's other subjects) for it.
- Prerequisite links are not editable in the app yet: they come from the curriculum import.

**Credit units filled in by the subject:**
- Each subject carries the lecture and laboratory units the curriculum prints (new columns `courses.lecture_units` and `lab_units`; `npm run migrate-credit-units`; loaded by `npm run seed-curriculum` for all 150 subjects of the four curricula). The rows were placed using each semester's printed total as a check, so the units match the photos' totals; the same subject can have different units in different programs (for example IT-ELEC1 is 2/1 in BSIT and 0/1 in Cyber Security).
- `GET /api/courses/:id` returns `units: { lecture, lab }` (null when not loaded). The Syllabus Builder fills **Credit Units (V)** with them when the subject is chosen, or for a box that is still empty; the author can still change them, and a subject without units leaves the boxes as typed. A zero is a real value (OFFTOOLS is 0 lecture, 1 laboratory).

**Validation and deployment:**
- 798 passing automated tests (732 domain/API/helper checks, 22 localization/preference checks and 44 rendered UI checks); the localization audit and the production build pass. New: the import planner (per-program codes, retitling, suffix repair, idempotence, and checks of the real curricula, including that every BSIE subject asked about is in BSIE), the prerequisite loader and the builder fill.
- The photos are phone pictures taken at an angle, so a prerequisite was placed on the row it lines up with. Please check these against the printed curriculum: BSIE COMPRO (shown with PHYENG while FUNELC-IE has none), BSIE STATIE1 (none) and ADEMAIE (MA 7), and BSCPE CpE 304 and CpE 305 (CpE 305 Operating System shows ENGDA).
- New scripts `npm run migrate-prerequisites`, `npm run migrate-course-code-per-program`, `npm run migrate-credit-units` and `npm run seed-curriculum`, in that order; restart the API server after the migrations.

---

### v1.57.0 — Student Views Read the Catalog
**By:** Sean Mahinay  
**Date:** October 22, 2026

**Student view (Syllabi and Dashboard):**
- A student's **Syllabi** list and the **Repository** show each syllabus's subject as the catalog has it now: the subject's current code and title and its program (code and full name), with the syllabus's faculty member (already read live). A renamed or recoded subject reads the same everywhere. A syllabus with no catalog subject keeps its own text; the faculty and admin working lists are unchanged (`GET /api/syllabi` for a student, or `?scope=repository`, now returns `programName` too).
- A student's **enrolled subjects** (read from the COR) are tied to the catalog. `GET /api/students/me` links subjects that were not in the catalog when the COR was read (the curriculum import added them) and returns, for each, the catalog's `code`, `title`, `program`, `programName` and `faculty` (the faculty member who holds the subject) next to what the COR printed (`subject_code`, `subject_title`). A COR code is matched ignoring spaces, hyphens and case ("IT-401" is "IT 401"); when a code exists in several programs the student's own program wins (the section tells it: BSIT4B is BSIT, BSITCS4A is BSIT-CS). The new COR registration uses the same matching.
- The student **Dashboard** lists each enrolled subject with the catalog's code and title (not the COR's capitals), its program and its faculty, and finds the approved syllabus through the linked subject instead of comparing code text ("IT-401" did not match "IT 401" before, so the View button never showed).
- Run on your database: the 7 enrolled subjects of the one student were linked to BSIT's subjects (CAPSPRO 2, IT 401 to 404, IT-ELEC3, IT-ELEC4).
- Note: the Syllabi tab is empty until a syllabus is approved, because all syllabi were cleared.

**Validation and deployment:**
- 801 passing automated tests (737 domain/API/helper checks, 22 localization/preference checks and 44 rendered UI checks); the localization audit and the production build pass. New: `server/lib/enrollments.js` tests (matching, program preference, linking, faculty) and a list test for the live catalog values.
- No schema change. Not checked in a browser.

---

### v1.58.0 — Sample Syllabi from Four Programs
**By:** Sean Mahinay  
**Date:** October 22, 2026

- New developer script `server/scripts/sample-syllabi.js` (data in `sample-syllabi-data.js`; `node scripts/sample-syllabi.js` from `server/`). It makes five sample syllabi through the application's own API routes, run in the script's process against your database with a supplied session, so no password is needed: IT 204 Computer Programming 2 and IT 302 Information Management 1 (BSIT), CS 303 Essential Security Principles (BSIT-CS), CpE 301 Logic Circuit and Design (BSCPE) and IE 302 Quality Management System (BSIE). Each has its subject's CLOs, units and pre-requisite, 15 weekly lessons with tagged ILOs, Prelim, Midterm and Final rows, requirements, real textbook references from the last ten years and a grading of 100%.
- Before that it fills what the catalog lacked for those subjects: the school vision, mission and EGAs where missing, each program's EGAs and program outcomes (BSIT uses the seed's ten; BSIT-CS, BSCPE and BSIE get six each), and each subject's setup and three CLOs. Nothing that already existed is changed.
- Statuses: IT 204, CS 303 and CpE 301 are approved after the administrator's check (scores 99%, 100% and 100%), IE 302 is submitted and waits in Review & Approval, IT 302 stays a draft. The AI step uses the offline provider, so it costs no tokens.
- A subject that already has a syllabus of that faculty member is skipped, so the script can be run again.
- No application code changed. 801 passing automated tests.

---

### v1.58.1 — Opening Review & Check No Longer Re-checks
**By:** Sean Mahinay  
**Date:** October 22, 2026

- The Review & Check step (step 7 of the Syllabus Builder) used to run the compliance check by itself every time it was opened, which could mean a new check (and AI tokens) each time. It now only shows the stored check. A syllabus that has not been checked says "Not checked yet"; **Re-check** (in the check card and in the footer) runs a new one. Suggested changes appear once a current check exists.
- Coming back to Review & Check from another step also re-checked: the step remembered "first run" with a flag that React's double-run of effects in development turned into a press of Re-check. It now compares the footer button's counter with the one it was opened with, so only a real press of Re-check runs a new check.

---

### v1.59.0 — Duplicate-Data Rules (Standard v8)
**By:** Sean Mahinay  
**Date:** October 22, 2026

- The AI Checker's standard is now **v8**, with seven new rules (D-01 to D-07) that find data repeated inside one syllabus. They compare text after ignoring case, punctuation, bullets and bold markers, and treat a text sharing about 85% of another's words as a copy. Very short text (under 4 words) only counts as a copy when it is the same, and examination rows are left alone, so "- Quiz" in two lessons is not flagged.
  - **D-01** (major, 2 points): the same ILO in two weeks.
  - **D-02** (minor): the same course content, learning activities or assessment task in two lessons.
  - **D-03** (minor): a lesson whose columns are the same text as each other.
  - **D-04** (minor): a requirement listed twice. **D-05** (minor): a reference listed twice. **D-06** (minor): a grading component named twice.
  - **D-07** (minor): a course description that repeats a sentence or copies a CLO word for word.
- They belong to Content Completeness, never block a submit, and each finding names the item it repeats.
- Suggested changes: a repeated requirement or reference is offered for removal (the first stays). The others need rewording, so the author writes them.
- English and Filipino texts for all seven rules. Stored scores stay as they were until a syllabus is checked again.
- New tests for each rule (`duplicates.test.js`) and for the removal suggestion. Copying between syllabi (part 2) is not built.


### v1.59.1 — Less Repetition in the Check Result
**By:** Sean Mahinay  
**Date:** October 22, 2026

- A repeated requirement, reference or grading component (D-04 to D-06) used to appear three times: as an AI/rule recommendation, as a finding, and under "Still needs you". The recommendation that cited only those findings is now left out; the finding stays (it carries the score).
- New suggested change for D-06: a grading component named twice is merged into one, with the percentages added, so the total stays 100%. (A repeated requirement or reference already had a removal suggestion.) These three no longer fall under "Still needs you".

---

### v1.60.0 — Rule I-01: Support for Diverse Learners (Standard v9)
**By:** Sean Mahinay  
**Date:** October 22, 2026

- New rule **I-01** (Content Completeness, minor, 2 points, never blocks a submit): the syllabus must say how the course supports diverse learners, including students with disabilities. It passes when the description, a requirement or any lesson's content, activities or task mentions accommodations, accessibility, disability, inclusion, diverse learners, special needs or education, assistive tools, PWD, learning differences or reasonable adjustments (the word list is in `standard-v4.json` and editable in the developer rule editor).
- Suggested change: when it fails, the author is offered a standard requirement ("Students who need learning accommodations ... tell the instructor early so that accessible formats and reasonable adjustments can be arranged") to add, which they can accept, reject or replace with their own wording.
- The standard is now **v9** (69 rules). Scores stored earlier stay until a syllabus is checked again. The sample syllabi script's requirements include the statement; the five syllabi already in the database were made before it and will show this finding until re-checked and fixed.
- English and Filipino texts; tests for the rule and its suggestion.

### v1.60.1 — Red Score Ring Below the Pass Line
**By:** Sean Mahinay  
**Date:** October 22, 2026

- The score ring in the AI Checker and Review & Check is now red when the score is below the pass line (it stayed blue for every score). At or above the line it is still blue. The Analytics band donut already showed Low in red.


---

### v1.61.0 — Updated Rules from the Curriculum Office (Standard v10)
**By:** Raymond  
**Date:** October 25, 2026

- The AI Checker's standard is now **v10** (70 rules), written from the updated rules in `txt-files/updated-rules`. `txt-files/syllabus_rules.txt` is rewritten as the new rule list, each rule tagged with the checks that enforce it.
- New rules: **W-01** (week 1 is the course orientation), **W-02** (week 2 starts the first topic), **P-07** (each CLO relates to the course title) and **R-05** (each reference is in APA 7th edition format, `Author. (Year). Title.`). The AI reference check is also told to flag references that are clearly not APA 7th edition.
- Changed: **A-05** (course content relates to the course title or its ILO), **A-06** (activities relate to the ILO or the course content) and **A-07** (the assessment task relates to the course content or the activities, no longer the ILO). The AI check now also flags expected core values that clearly do not fit the week's ILO.
- Removed **T-09**, **T-10** and **T-11** (stored vision, mission and EGAs against the catalog); **T-28** to **T-30** check the LCUP constants. A vision changed after a submit no longer blocks a re-check. T-12 still compares program outcomes with the catalog.
- The rule points now add up to **100** (they were 145): 1 point stays 1, 2 becomes 1 (blocking and major ones keep 2 until the total is 100), 3 becomes 2, 4 becomes 3. A conforming syllabus still scores 100; other scores can move by a few points. The standard's title reads "Undergraduate Syllabus v10".
- English and Filipino texts for the new and reworded rules; tests for W-01, W-02, P-07, R-05 and the new alignment checks. Stored scores stay until a syllabus is checked again.

### v1.61.1 — Recommendation Labels
**By:** Raymond  
**Date:** October 25, 2026

- A recommendation's badge no longer reads High, Medium or Low. It reads "For revision", "For minor revision" or "For improvement" (English and Filipino). The stored level is unchanged.
- The badge is a wider rounded box whose text wraps between words, so long labels no longer overlap the recommendation text.

### v1.61.2 — Groq, Skeletons and Passing Grade
**By:** Raymond  
**Date:** October 23, 2026

- Groq is a new AI provider for the compliance check (`GROQ_API_KEY`, `GROQ_MODEL`; see HOW-TO-RUN.md and `server/.env.example`). Provider order is Groq, then OpenRouter, then Gemini; `COMPLIANCE_AI_PROVIDER` can pick one. The OpenRouter model id (`OPENROUTER_MODEL`) is now required.
- Suggested changes are written at the same time as the recommendations, and skeleton placeholders show while the AI writes. Clicking Refresh while they load does not send a second request.
- Rule I-01 is AI-only: the system no longer supplies a fixed accommodation wording, and the AI's wordings differ from each other.
- Findings and recommendations link to the exact field in the plan, and the step button and editor card flash when a link is followed.
- Grading step: a passing grade field and a clearer layout of the grade components; the field stays empty, not 0%, until a value is typed.
- Analytics: the Average Compliance Score bars share the card width so the end bars are not cut off.
- The old sample syllabi and their scripts were removed.
