# Syllabus CMS Plus — System Documentation

**Capstone Project Documentation**

| | |
|---|---|
| **System name** | Syllabus CMS Plus |
| **Type** | Web-based syllabus management and compliance-checking system |
| **Stack** | React 19 + Vite (frontend) · Node.js + Express (API) · MySQL (database) |
| **Version** | 1.0.0 (see [CHANGELOG.md](../CHANGELOG.md)) |
| **Proponents** | _[Add team member names]_ |
| **Adviser** | _[Add adviser name]_ |
| **Institution / Program** | _[Add school, program and academic year]_ |

> Sections marked _[Add …]_ are for the team to complete. Everything else describes the system as implemented in this repository.

---

## 1. Introduction

### 1.1 Background
A syllabus is the contract between a course and its program. It must state the course description, the course learning outcomes (CLOs), the weekly plan, the assessments and the references, and each of these must align with the institution's Vision, Mission, Expected Graduate Attributes (EGAs) and the program outcomes (POs). In many schools this is done with word-processor files that are emailed around, checked by eye by an administrator, and stored in folders. That approach makes it hard to enforce a standard format, to track who submitted what and when, and to catch misalignment before a syllabus is approved.

### 1.2 Statement of the problem
- Syllabi are prepared in inconsistent formats, so reviewers spend time on structure instead of substance.
- Alignment between CLOs, POs and EGAs, and between lessons and CLOs, is checked manually and unevenly.
- There is no single place to see submission status, deadlines, review comments and version history.
- Faculty and administrators communicate by email, outside the document being reviewed.

### 1.3 Objectives
**General objective:** to develop a web-based system that standardizes how syllabi are prepared, checked, reviewed and stored.

**Specific objectives**
1. Provide a structured Syllabus Builder that follows the institution's standard syllabus form, plus PDF import for existing documents.
2. Check each syllabus against a coded compliance standard and report a score, findings and fix recommendations.
3. Provide an optional AI-assisted check of meaning and alignment that is advisory only; a human always makes the approval decision.
4. Support a review workflow (submit, approve, reject, return for revision) with comments, notifications and version history.
5. Manage programs, subjects, outcomes, faculty assignments and per-subject deadlines.
6. Provide role-based access for Faculty, Administrators and Students, in English and Tagalog.

### 1.4 Scope and limitations
**In scope:** authentication, role-based access, syllabus building and import, compliance and AI checking, review and approval, repository, analytics and reports, messaging, notifications, activity log, program and subject management, deadlines, localization.

**Limitations**
- The AI check depends on an external model provider (Gemini or OpenRouter). It is advisory, can be unavailable or rate-limited, and is not claimed to be universally accurate. Unavailable evidence blocks verification rather than producing a pass.
- Reference-link verification can only report what the remote server answers; restricted or timed-out links are reported as *unverifiable*, not *broken*.
- PDF import extracts text for preview and prefill; it is not guaranteed to reproduce every layout.
- The system is built around one institution's curriculum and standard (`server/lib/compliance/standard-v4.json`); adopting another institution means supplying its own master data.
- The development configuration (localhost, XAMPP MySQL) is not a hardened production deployment. See §10.

---

## 2. Users and Roles

| Role | Who | Main capabilities |
|---|---|---|
| **Faculty** | Instructors assigned to subjects | Build and edit syllabi for **assigned subjects only**, run the compliance/AI check, submit, respond to comments, view their deadlines, message the administrator |
| **Administrator** | Program heads / reviewers | Manage programs, subjects, outcomes, users and assignments; set deadlines; run the AI Checker; review, approve, reject or return syllabi; analytics, reports, compliance monitoring, settings |
| **Student** | Registered BSIT students | Student home: read approved syllabi. Registration requires uploading a Certificate of Registration (COR) which is read by OCR to confirm the student is in the program |

Sign-in options: email and password (bcrypt-hashed), Google sign-in restricted to an allow-listed email domain, and "Remember me" (30-day cookie token, stored hashed). A user given a generated temporary password must choose their own before anything else opens.

---

## 3. System Architecture

### 3.1 Overview

```
┌────────────────────────┐   HTTPS/JSON    ┌───────────────────────────┐    SQL     ┌──────────┐
│  React SPA (Vite)      │ ──────────────▶ │  Express API (Node.js)    │ ─────────▶ │  MySQL   │
│  src/  · port 5173     │ ◀────────────── │  server/ · port 3001      │ ◀───────── │          │
└────────────────────────┘  session cookie └──────┬─────────┬──────────┘            └──────────┘
                            / Bearer JWT          │         │
                                                  │         ├── Uploads (PDFs, avatars) on disk
                                                  │         ├── SMTP (temp passwords, deadline notices)
                                                  │         └── OCR (Tesseract) for COR reading
                                                  ▼
                                   External AI provider (Gemini / OpenRouter)
                                   — optional, advisory, called only on explicit action
```

### 3.2 Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS 4 plus project CSS, Phosphor icons |
| Backend | Node.js (v18+), Express 4, express-session, jsonwebtoken, bcryptjs, multer, nodemailer, cors |
| Database | MySQL (via `mysql2`); XAMPP for local development |
| Document processing | `pdfjs-dist` (PDF text and layout), `@napi-rs/canvas`, `sharp`, `tesseract.js` (OCR of CORs) |
| Identity | `google-auth-library` |
| Testing | Node's built-in test runner (`node --test`), `happy-dom` for rendered-component tests |

### 3.3 Repository layout

| Path | Contents |
|---|---|
| `src/views/` | Page-level screens (Dashboard, Syllabus Builder, My Syllabi, AI Checker, Review & Approval, Repository, Analytics, Reports, Users & Roles, Program & Subjects, Settings, Student Home) |
| `src/views/builder2/` | The 7-step structured builder (Info, CLOs, Plan, Requirements, Grading, References, Review) plus upload panel and compliance hooks |
| `src/components/` | Shared UI (Login, Sidebar, MobileNav, chat, modals, date picker, Program Management, hybrid-check panels) |
| `src/lib/` | Client logic and its tests (API client, syllabus model, rule mirror, view models, polling) |
| `src/i18n/` | English/Tagalog dictionaries and the language store |
| `server/index.js` | API entry point; mounts all routes |
| `server/routes/` | One file per resource (auth, syllabi, syllabusContent, pdfImport, comments, compliance, syllabusCheck, programs, courses, curriculum, institution, users, students, messages, notifications, logs, deadlines, usage, settings) |
| `server/lib/` | Business logic (assignments, deadlines, mailer, passwords, PDF import, versioning, subject locking, program management …) |
| `server/lib/compliance/` | Deterministic rule engine and the `standard-v4.json` rule set |
| `server/lib/syllabuscheck/` | Hybrid (coded + AI) checker: engine, scoring, evidence, model clients, staged advisory checks |
| `server/db/` | `schema.sql`, seed data, and idempotent `migrate-*.js` scripts |
| `server/middleware/` | Authentication (session, remember-me, JWT) and edit-permission guards |
| `docs/` | Feature design notes, evaluation reports and the academic validation package |

---

## 4. Functional Description

### 4.1 Syllabus Builder
A seven-step form that mirrors the institution's standard syllabus: course information, CLOs, weekly plan with intended learning outcomes (ILOs), requirements, grading, references and a final review step. Faculty can choose only subjects assigned to them. Course code, title, units and CLOs come from the official curriculum so they cannot be invented. Drafts autosave; submitted syllabi are locked from editing.

An alternative path lets faculty **upload a PDF**; the server extracts text and layout in memory for a preview that prefills the form. Imports are private, and the AI check remains an explicit action.

### 4.2 Compliance check (deterministic)
`server/lib/compliance/rules.js` evaluates a syllabus against `standard-v4.json`, where each rule is data (`id, area, step, severity, weight, check, params, message`). A rule's score is the share of its items that pass; an area's score is the weighted mean of its rules; the overall score is the weighted mean of areas. Findings are one per failed item, graded **blocking / major / minor**; only blocking findings stop a submit. The engine is pure and deterministic (no database, network or clock), so the same content always yields the same score. A browser copy of the rules runs live in the builder, and a parity test keeps both in sync.

### 4.3 Hybrid AI check (advisory)
The administrator and faculty can run a deeper check through `POST /api/syllabi/:id/compliance/recheck`. It follows a fixed rule hierarchy:

1. **Official curriculum integrity** — the course code, title, units, year level and prerequisites must match the approved curriculum row. A confirmed absent course code scores 0 before any network call.
2. **Master constants** — Vision, Mission, EGAs and POs must exactly match the institution/program masters, with replacement drafts shown for differences.
3. **Structure** — all ten standard sections present; ILO gaps, duplicate week assignments and grading totals other than 100 block submission.
4. **Reference links** — each HTTP(S) URL is checked (no redirect following, 8 s timeout, max four at once, 60-URL cap); redirects and confirmed 404/410 deduct 2 points per URL; unreachable or restricted links are reported as unverifiable.
5. **Semantic alignment** — an AI model judges each CLO–PO/EGA and ILO–CLO relationship, and activity/assessment fit, quoting evidence that must exist verbatim in the supplied texts. Unsupported or malformed answers are rejected by server-side validation.
6. **Value webbing** — each lesson should name at least one of the institution's core values (Compassion, Courage, Community-orientedness, Humility, Interiority, Missionary Spirit); a missing one deducts 1 point.

Scoring: `final = max(0, baseScore − Σ deductions)`; `NOT_ALIGNED` = −3 per relationship, `PARTIALLY_ALIGNED` = −1. An incomplete check returns `score: null` and never a pass band. The pass label requires 79% with no blockers.

**Design principles (important for the defense):**
- The AI **never approves** a syllabus. It reports findings and draft suggestions; the author or administrator chooses **Accept, Edit or Reject** for each, and each decision is logged.
- Scores and reports supplied by the client are never trusted; the server verifies against the persisted report for the exact saved content.
- Submission gating is configurable: `SYLLABUS_CHECK_AI_GATE=advisory` (default; only coded hard gates block) or `required` (a completed current AI check is also needed).
- Additional advisory stages (course/CLO/PO alignment, weekly content, ILO–CLO mapping, CLO coverage, activities, assessments, values, APA 7 references) are off by default and never change the official score.
- Re-checks reuse earlier verified judgements for unchanged relationships to reduce cost and variance.

### 4.4 Review and approval workflow

```
 draft ──▶ submitted ──▶ under_review ──┬──▶ approved  ──▶ Repository
   ▲                                    ├──▶ rejected
   └──────── for_revision ◀─────────────┘
```

Submitting locks the syllabus. The administrator runs the AI check, then reviews in **Review & Approval**, where comments are threaded per syllabus with read tracking. Approval endpoints independently re-enforce the checks. Every status change creates a version record (`syllabus_versions`) and an entry in the submission log.

### 4.5 Program and subject management
Administrators maintain programs, EGAs, program outcomes, subjects (courses) with their CLOs, and the mapping of CLOs to EGAs/POs. Faculty are assigned to programs and then subjects (a subject has at most one faculty owner). Reassigning a subject **archives** the previous owner's syllabus as read-only. Program aliases and a catalog event log support renames and cleanup.

### 4.6 Deadlines
An administrator sets a per-subject, per-term deadline (Philippine Time). Each assigned faculty member has their own requirement, derived from assignments and submission history: *Pending*, *Submitted*, *Submitted late* or *Failed to submit*. Faculty are told through the notification bell and email; the administrator can send manual reminders. See [deadlines.md](deadlines.md).

### 4.7 Other features
- **Repository** of approved syllabi · **Analytics** and **Reports** (compliance report, accreditation summary, exports)
- **Compliance monitoring** per faculty
- **Messaging** (per-syllabus chat with read receipts) and **notifications** (polling)
- **Activity log** with role-scoped clearing
- **Time-in-app usage** tracking (`usage_daily`)
- **Localization** — English and Tagalog, per-account, applied instantly ([localization.md](localization.md))
- **Responsive UI** with a mobile navigation drawer

---

## 5. Database Design

MySQL schema defined in `server/db/schema.sql`, with additive `migrate-*.js` scripts for upgrades (each safe to re-run).

### 5.1 Entity groups

| Group | Tables |
|---|---|
| **Identity** | `users`, `remember_tokens`, `password_temp`, `app_settings` |
| **Academic catalog** | `programs`, `program_egas`, `program_outcomes`, `courses`, `course_clos`, `curriculum`, `institution_settings`, `institution_egas`, `program_outcome_sources`, `program_code_aliases`, `program_name_aliases`, `catalog_events`, `catalog_file_cleanup` |
| **Assignments** | `faculty_programs`, `faculty_courses`, `course_assignments` |
| **Syllabus lifecycle** | `syllabi`, `syllabus_versions`, `submission_logs`, `comments`, `comment_reads`, `messages`, `notifications` |
| **Compliance and AI** | `ai_check_runs`, `ai_check_area_scores`, `ai_findings`, `syllabus_check_curricula`, `syllabus_check_reports`, `syllabus_check_decisions` |
| **Deadlines and usage** | `subject_deadlines`, `deadline_notices`, `usage_daily` |

### 5.2 Key relationships
- `programs` 1—N `courses` 1—N `course_clos`; programs own their `program_egas` and `program_outcomes`.
- A CLO maps to EGAs and POs (`ega_nos`, `po_nos`); the chain **EGA / PO → CLO → ILO** is the alignment model the checker verifies.
- `users` N—M `courses` via `faculty_courses` (unique per course); a faculty member may create syllabi only for their assigned courses.
- `syllabi` belongs to a user and a course, holds the structured `content` (JSON) and a `status` of `draft | submitted | under_review | approved | rejected | for_revision`.
- `syllabus_versions`, `submission_logs`, `comments` and check reports all cascade from `syllabi`.

> _[Add the ERD image generated from the schema here, for the formal document.]_

---

## 6. Security

| Concern | Measure |
|---|---|
| Passwords | bcrypt-hashed; temporary passwords force a change on first sign-in |
| Sessions | `httpOnly`, `sameSite=lax` cookies (`secure` in production); remember-me tokens stored as SHA-256 hashes, 30-day expiry |
| API tokens | JWT bearer tokens for API clients |
| Authorization | Server-side role checks (`requireAuth`, `requireAdmin`) and per-syllabus edit guards; the UI hides, but never solely enforces, access |
| Domain restriction | Google sign-in and registration limited to the institution's email domain |
| Brute force | Rate limiting on authentication routes |
| Uploads | PDF-only upload filters; avatars are served privately; student CORs processed for verification |
| AI safety | AI output is untrusted: validated against schema, evidence must be verbatim; server never accepts client-supplied scores; links to private/unsafe destinations are not fetched |
| Secrets | Kept in `server/.env` (git-ignored); `.env.example` documents the variables |

---

## 7. Installation and Deployment

Full instructions: [HOW-TO-RUN.md](../HOW-TO-RUN.md). Summary:

1. Install Node.js 18+ and start MySQL (XAMPP).
2. `cd server && cp .env.example .env` and fill in DB credentials, `SESSION_SECRET`, `JWT_SECRET`, and optionally `GOOGLE_CLIENT_ID`, SMTP and AI provider keys.
3. `npm install && npm run init-db && npm run migrate-students && npm run dev` (API on `http://localhost:3001`).
4. From the repository root: `npm install && npm run dev` (frontend on `http://localhost:5173`).
5. For an existing database, run the `migrate-*` scripts you are missing, then restart the API.

Key environment switches: `SYLLABUS_CHECK_AI_PROVIDER`, `SYLLABUS_CHECK_AI_GATE`, `COMPLIANCE_AI_PROVIDER`, `DEADLINE_NOTICES`, `SYLLABUS_PDF_IMPORT`, `SMTP_*`.

> **Before real use:** remove the demo seed accounts, rotate every secret that was shared during development (database, SMTP app password, AI keys), and serve the app over HTTPS.

---

## 8. Testing and Evaluation

### 8.1 Automated tests
`npm test` runs the unit, API-route and rendered-component suites with Node's test runner: rule engine and parity tests, compliance recommendations, the checker engine and every advisory stage, review/approval, comments, assignments and enforcement, catalog and program management, passwords and mailer, deadlines, usage, PDF import and layout, messaging, avatars, activity log, plus localization and PDF-import UI checks. Route tests run against fake databases so they need no live MySQL.

### 8.2 AI checker evaluation
The AI checker was evaluated iteratively against faculty-reviewed samples. Outputs are in `docs/`:
- Evaluation plans, baselines and per-stage reports (`stage-*.md`, `ai-eval-*.json`)
- Faculty review sheets (`docs/faculty-review/`) and the academic validation package (`docs/academic-validation-package/`)
- Reliability, cost and provider-efficiency analyses

Cite these for validity and reliability evidence rather than restating figures; check the latest report for current numbers.

### 8.3 Usability and user acceptance
> _[Add the instrument used (e.g. SUS or ISO/IEC 25010 questionnaire), respondent counts and results here.]_

---

## 9. Software Process
The project was developed in iterations on Git (feature branches merged by pull request). Releases and feature history are in [CHANGELOG.md](../CHANGELOG.md). Individual features have design notes in `docs/` (e.g. [syllabus-checker.md](syllabus-checker.md), [deadlines.md](deadlines.md), [program-management.md](program-management.md), [pdf-syllabus-import.md](pdf-syllabus-import.md), [localization.md](localization.md)).

---

## 10. Limitations and Recommendations

**Known limitations** are listed in §1.4. In addition:
- Notifications and message refresh use polling rather than WebSockets.
- Free-tier AI models have rate limits and may be retired by the provider; the model is configurable by environment variable.
- Browser-backed visual regression testing is manual.

**Recommendations for future work**
1. Deploy behind HTTPS with a managed MySQL instance and a process manager.
2. Add push-based notifications (WebSockets or server-sent events).
3. Extend the curriculum and standard to additional programs and institutions.
4. Expand AI evaluation with a larger faculty-labelled dataset before enabling advisory stages by default.
5. Add export of approved syllabi to the institution's official printable format in bulk.

---

## 11. Appendices
- **A.** API route summary — all routes are mounted under `/api` in `server/index.js`: `auth`, `students`, `users`, `settings`, `syllabi` (content, PDF import, comments), `compliance`, `syllabus-check`, `institution`, `programs`, `courses`, `curriculum`, `logs`, `messages`, `notifications`, `usage`, `deadlines`.
- **B.** Environment variables — `server/.env.example`.
- **C.** Screenshots — _[Add screenshots of each role's main screens.]_
- **D.** User manual — _[Add step-by-step guides for Faculty, Administrator and Student.]_
