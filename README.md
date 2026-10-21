# Syllabus CMS Plus

A comprehensive syllabus content management system for institutional undergraduate programs. Built with React + Vite, Node.js + Express, and MySQL.

## Features

- **Role-based access** — Faculty, Admin and Student roles with different views
- **Session authentication** — Secure login with MySQL-backed sessions and show/hide password toggle
- **Syllabus Builder** — 7-step guided wizard, or upload a finished PDF instead, with a preview before submitting (Faculty only)
- **Student registration** — students register with a photo of their COR; the system reads it (OCR) to confirm they are BSIT students, and anything it cannot confirm waits for an administrator
- **My Syllabi** — Faculty view for managing own submissions (edit, delete, version history, messaging)
- **Review & Approval** — Admin queue with approve/reject/revision workflow
- **AI Syllabus Checker** — Simulated compliance scoring with recommendations
- **Repository** — Search and filter (Faculty sees own, Admin sees all)
- **Compliance Monitoring** — Per-faculty compliance tracking
- **Analytics** — Hand-rolled charts and quality metrics with animations (role-scoped: Faculty sees own, Admin sees all)
- **Reports** — Faculty compliance (role-scoped), accreditation, and historical exports
- **Messaging** — Per-syllabus threaded chat with unread badges and read receipts
- **Version History** — Timeline of submission versions with feedback
- **Activity Logging** — Audit trail of all actions with clear logs
- **RESTful API** — Express.js backend with MySQL database persistence

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin (Dean) | admin@university.edu.ph | admin123 |
| Faculty | faculty@university.edu.ph | faculty123 |

## Run

**Backend (requires XAMPP MySQL running):**
```bash
cd server
npm install
npm run init-db    # first time only — creates DB + seeds data
npm run dev        # starts API on http://localhost:3001
```

**Upgrading an existing database** (in `server/`), run once each, then restart the API:
```bash
npm run migrate-builder
npm run migrate-assignments
npm run migrate-subject-owner
npm run migrate-program-egas
npm run migrate-syllabus-versions
npm run migrate-notifications
npm run migrate-students      # student role and COR tables
```
`server/.env` also needs `GOOGLE_CLIENT_ID` and `JWT_SECRET` (see `server/.env.example`).

**Frontend:**
```bash
npm install
npm run dev        # starts UI on http://localhost:5173
```

## Build

```bash
npm run build
```

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full release history (v1.0.0 to v1.29.0).
