# Syllabus CMS Plus

Syllabus management system for undergraduate programs. React + Vite, Node.js + Express, MySQL.

## Features

- **Roles** — Faculty, Admin and Student
- **Sign-in** — Email and password, Google (allowlist), Remember me
- **Syllabus Builder** — 7-step form, or upload a PDF instead (with preview)
- **Student registration** — Upload a COR; an AI vision model reads it and the server checks the student is BSIT
- **My Syllabi** — Edit, delete, version history, messaging
- **Review & Approval** — Approve, reject or return for revision, with comments
- **Compliance check** — Rule-based scoring on the v10 standard, with AI-written recommendations; admins can read the standard (Settings, View standard); after a check, faculty get automatic suggested fixes (some written by the AI) to accept or reject
- **Programs and subjects** — loaded from the curricula (BSIT, BSIT Cyber Security, BSCPE, BSIE); a subject's prerequisites are linked and fill the syllabus form
- **Repository**, **Analytics** (from the stored checks), **Reports** (PDF: analytics, faculty compliance, past terms)
- **Search** — top bar search across syllabi, faculty and subjects
- **Developer rule editor** — `/dev/rules`, behind a developer password (see HOW-TO-RUN.md)
- **Messaging**, **Notifications**, **Activity log**

## How to Run

See **[HOW-TO-RUN.md](HOW-TO-RUN.md)** for setup, environment variables, database migrations, scripts and troubleshooting.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
