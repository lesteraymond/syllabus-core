# Syllabus CMS Plus

Syllabus management system for undergraduate programs. React + Vite, Node.js + Express, MySQL.

## Features

- **Roles** — Faculty, Admin (dean), Asst. VPAA, LIC Director, VPAA and Student. The dean, then the Asst. VPAA, then the LIC Director check and review in order; only the VPAA approves (`docs/review-chain.md`)
- **Sign-in** — Email and password, Google (allowlist), Remember me
- **Syllabus Builder** — 7-step form, or upload a PDF instead (template check and preview; a refresh does not lose the scan, `docs/pdf-syllabus-import.md`)
- **AI Checker** and **AI Syllabus Generator** — alignment checking and first drafts with Claude (off unless configured)
- **Student registration** — Upload a COR of the active academic year and agree to the Terms and Conditions; BSIT, BSCPE and BSIE students
- **Versions** — numbered v1, v2, v3; a past academic year's syllabus is view only
- **My Syllabi** — Edit, delete, version history, messaging
- **Review & Approval** — Approve, reject or return for revision, with comments
- **Compliance check** — Rule-based scoring with recommendations
- **Repository**, **Analytics**, **Reports**
- **Messaging**, **Notifications**, **Activity log**

## How to Run

See **[HOW-TO-RUN.md](HOW-TO-RUN.md)** for setup, environment variables, database migrations, scripts and troubleshooting.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
