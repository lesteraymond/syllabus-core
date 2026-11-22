# Local Security Review — Syllabus Management System

**Date:** 2026-11-22
**Scope:** Authorized black-box + code-assisted test of the locally running API (`http://localhost:3001`), plus a code audit of the frontend for XSS and the server for CSRF/headers. Own-application testing on the developer machine.
**Method:** Claude-BugHunter approach, API-level. Seeded six throwaway role accounts and three test syllabi directly in the dev database; disabled live email and AI (originals restored); ran the probes through the live API; deleted every artifact and verified the real data and settings were unchanged.
**Result:** **No vulnerabilities found.** ~146 probes across authorization, IDOR, privilege escalation, mass assignment, parameter tampering, record immutability, CSRF, security headers, cookies, login rate-limiting, file upload, injection, XSS, the PDF-import parser, and the student registration/enrolment flow.

> Safety note: the dev `.env` has **live Gmail SMTP and a live paid Anthropic key**. Both were disabled for the test and restored afterward. No email was sent and no AI credit spent.

---

## What was tested and the outcome

### 1. Authorization / IDOR (49 checks — all pass)
- A second faculty account reading another faculty's **draft/submitted** content, review, versions, comments, compliance, stages, file, PO-review → all `404` (the API does not even confirm the record exists to a non-participant).
- The same account trying to **edit, submit, delete, change status, clear a stage, or comment** on another's syllabus → all blocked.
- By design: any signed-in user can read an **approved** syllabus (the shared Repository) — not a finding.

### 2. Privilege escalation (part of the 49)
- Faculty approving / setting under-review → `403`.
- Dean, Asst. VPAA, LIC Director approving (only the VPAA may) → `403`.
- VPAA approving **before the three stages are cleared** → `409 STAGES_PENDING`.
- A reviewer editing the author's content → `403`.
- Faculty reaching admin-only routes (`/users`, `/settings`, `/academic-years`, `/courses`, `/programs`, `institution/outcomes`, disable user, resend-credentials) → all `403`.

### 3. Mass assignment (part of the 49)
- Faculty sending `role: "admin"` in profile and preferences updates → rejected `400`; role stayed `faculty`.

### 4. Parameter tampering & record immutability (27 checks — all pass)
- Syllabus id as `0`, `-1`, `135abc`, `' OR 1=1`, `%27`, arrays, objects → `400`/`404`, no injection, no `500`.
- Deleting / editing / re-approving an **approved** syllabus → `409` "protected academic record".
- Drafts invisible to reviewers (not in the list, `404` on direct read).
- Positive controls: legitimate reviewer access to submitted syllabi works (`200`).
- Horizontal IDOR on notifications / messages → `403`/`404`; `notifications` mark-read is scoped `WHERE id = ? AND user_id = ?`.

### 5. CSRF & transport (live + code)
- **Origin guard** on all state-changing methods: cross-site `Origin` and `Sec-Fetch-Site: cross-site` → `403 origin_not_allowed`; same-origin passes.
- Session cookie is **HttpOnly** and **SameSite=Lax** (and `Secure` in staging/production; off only on dev http).
- Three-layer CSRF defense: explicit CORS allowlist (no wildcard) + SameSite + the Origin guard.

### 6. Security headers (live — all present)
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `Permissions-Policy` locking camera/mic/geolocation/payment, `Cache-Control: no-store` on `/api`, `Strict-Transport-Security` in production, and `X-Powered-By` removed.

### 7. Login rate-limiting (live)
- Brute-forcing one account returned `429` at **attempt 11** (after 10 failures, matching `SIGNIN_MAX_FAILURES_PER_ACCOUNT`), with `Retry-After`. The limiter cannot be disabled (the server refuses to start on a bad value).

### 8. File upload
- Avatar: PNG accepted; **SVG rejected** (an XSS vector) and `.txt` rejected — image types only.
- PDF import to another user's syllabus → `404` (authorization).
- The PDF route also gates on "choose a subject first" before the file is parsed (defense in depth). The file-type filter itself (`ext === .pdf && mimetype === application/pdf`, 10 MB cap, server-generated storage filename so a path-traversal filename is ignored) is confirmed by code review; the live magic-byte parser path was not reached because the subject gate fires first.

### 9. XSS (code audit + payload test)
- Two `dangerouslySetInnerHTML` sinks render syllabus plan text via `renderMarkup()`. That helper **HTML-escapes first** (`esc()` on `& < > "`) and only then applies a fixed `**bold**`→`<strong>` and `-`→`<li>` transform. Payloads (`<script>`, `<img onerror>`, `"><svg onload>`) all come out escaped. React escapes everything else by default. No stored-XSS path found.
- Query-param injection (`?syllabus=1 OR 1=1`, `135;DROP TABLE users`, `?year=' OR '1'='1`) → validated/parameterized, `400`/`403`, never a `500` or a leak.

### 10. PDF-import parser (live fuzzing — 7 checks, all pass)
Reached via `POST /syllabi/pdf-import/extract` with a faculty account that has a course assignment.
- Empty file → `400`; PNG bytes renamed `.pdf` → `422`; truncated (`%PDF-` but no `%%EOF`) → `422` (strict envelope check before parsing).
- Valid envelope + garbage body, and valid envelope + 2 MB of junk → parsed in an isolated **worker thread** (120 s kill) and handled with `422`, no crash.
- Oversized (>10 MB) → `413` (multer cap).
- Server healthy (`200`) immediately after the fuzzing run — no crash or hang.
- Defenses confirmed: `multer` memory storage with a 10 MB cap, a 30 s receive timeout (slow-loris), `%PDF-`/`%%EOF` validation, a worker with a 120 s timeout, one-import-at-a-time server-wide, and 5 imports / 10 min / user.

### 11. Student registration & enrolment flow (live — 27 checks, all pass)
- **Student gate** (`index.js`): a `student` account is confined to `/api/auth/*` and `/api/students/*`; `/syllabi`, `/users`, `/compliance`, `/programs`, `/settings`, `/academic-years`, `/logs`, `/notifications` all → `403` "Not available for student accounts".
- **Reads:** a student sees only **approved** syllabi (the Repository model — any approved one, enrolled or not, is by design). A **submitted** or **draft** syllabus, and a submitted file, → `404`.
- **Admin-only student routes** reached by a student → `403`: `/students/pending`, `POST /students/:id/verify` (incl. self-verify), `GET /students/:id/cor`.
- **Isolation:** a faculty account hitting `/students/me` or `/students/syllabi` → `403` "Students only".
- **Registration abuse** (`POST /students/register`, public): no COR scan in session → `400`; `role`/`verification_status` injection ignored (role is hard-coded `'student'` in the INSERT) and still `400` without a scan; weak password → `400`.
- **COR upload** (`POST /students/scan`, public): rejects missing consent, non-image MIME, and `image/png` MIME with non-PNG bytes (magic-byte check) — all `400`, all *before* the paid Claude scan runs. (A successful scan was deliberately not triggered, since every scan is a paid provider call.)

---

## Not covered (suggested next)
- **PDF parser — adversarial corpus:** encrypted PDFs, and crafted object/xref loops designed to exhaust the worker before the 120 s kill (the worker + timeout contain this, but a dedicated corpus would confirm).
- **A successful COR scan path** and **Google OAuth** sign-in (both involve live paid/credentialed providers; test with the reader/provider stubbed).
- **Password-reset flow** (skipped to avoid live email) — verify no account enumeration and token strength.
- **Frontend runtime XSS** in a real browser (rendered pages), and **clickjacking** of the SPA host (the API sets `frame-ancestors 'none'`, but the Vite/static host serving the app sets its own headers).
- **Session lifecycle:** fixation, logout invalidation across devices, idle expiry.
- **Dependency / supply-chain** audit (`npm audit`) and secret-scanning of the repo.

---

## Overall
The authorization model is the system's strongest area: consistent `404` to non-participants, a correctly enforced VPAA-only approval chain, immutable approved records, strict input typing that also defeats mass assignment, parameterized queries, a solid header/cookie/CSRF posture, and an un-disableable login limiter. Nothing in this round needs fixing.
