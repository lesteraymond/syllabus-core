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
