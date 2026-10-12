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
