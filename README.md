# Syllabus CMS Plus

A comprehensive syllabus content management system for institutional undergraduate programs. Built with React + Vite, Node.js + Express, and MySQL.

## Features

- **Role-based access** — Faculty and Admin roles with different views
- **Session authentication** — Secure login with MySQL-backed sessions and show/hide password toggle
- **Syllabus Builder** — 7-step guided wizard with file upload drag-drop (Faculty only)
- **My Syllabi** — Faculty view for managing own submissions (edit, delete, version history, messaging)
- **Review & Approval** — Admin queue with approve/reject/revision workflow
- **AI Syllabus Checker** — Simulated compliance scoring with recommendations
- **CO-PO Mapping** — Interactive curriculum outcome matrix using I (Introduced), R (Reinforced), M (Mastered) alignment levels
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

See [CHANGELOG.md](CHANGELOG.md) for the full release history (v1.0.0 to v1.12.0).


# Hello Vscode