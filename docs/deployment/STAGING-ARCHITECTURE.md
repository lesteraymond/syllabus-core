# Staging architecture and hosting compatibility

Hand-written from the repository as it is. Nothing here was provisioned; no host, domain or paid service exists yet. It tells the system owner what the application needs, so a hosting choice can be checked against it before anything is bought or deployed.

## 1. What the repository actually contains

| Part | Reality in the repository |
|---|---|
| Frontend | React 19 + Vite 8 single-page app. `npm run build` produces static files in `dist/`. It calls the API directly from the browser at `VITE_API_URL` (build-time, default `http://localhost:3001/api`) with `credentials: 'include'`. There is **no** dev proxy and no server-side rendering. |
| Backend | One long-running Express process (`server/index.js`, `PORT`, default 3001). It owns timers (usage flush about once a minute, deadline notices, catalog file cleanup), a MySQL connection pool, and local disk (`uploads/`, profile photos, imported PDFs, an OCR language file). |
| Sessions | `express-session` with its **default MemoryStore** plus a database-backed `remember_token` cookie. Sessions live in the memory of one process and end when it restarts. |
| Database | MySQL/MariaDB. No ORM; parameterized queries. Bootstrap: `server/db/init.js` (schema + seed) then each `migrate-*` script of `server/package.json`. |
| AI | Calls `https://api.anthropic.com` from the server only (never from the browser), inside the HTTP request of a check. A check is up to dozens of sequential/batched requests with a 180 s per-request timeout. |

## 2. Hosting compatibility (verify before choosing)

| Requirement | Why | Consequence |
|---|---|---|
| A **long-running Node process** (Node 22 or later; the development machine runs 26) | timers, in-memory sessions, one connection pool | A serverless/function platform **cannot run the API unchanged**: functions are stateless and short-lived, so sessions would vanish between requests, timers would not run, and a check (minutes) would exceed typical function limits. |
| **One instance**, or a shared session store | MemoryStore is per process | Do not run two API instances behind a load balancer without first replacing the session store (section 4). A restart logs everyone out. |
| **Persistent disk or object storage** for `uploads/` | uploads, avatars, PDF import | An ephemeral container filesystem loses them on each deploy. Mount a persistent volume (or change the storage code, which is out of scope here). |
| **Proxy read timeout of 10 minutes or more** on `/api/syllabus-check` and `/api/syllabi/*/compliance` | a real check is long | Default 30–60 s proxy timeouts would cut a check off while the server keeps spending provider money. |
| **TLS-terminating reverse proxy** sending `X-Forwarded-Proto: https` and `X-Forwarded-For` | Secure cookies; the server speaks plain HTTP | Set `TRUST_PROXY` to the number of proxy hops. `true` and `*` are refused on purpose. |
| **Outbound HTTPS** from the API host to `api.anthropic.com` only | provider calls | Egress should be limited to that host (and the SMTP relay if mail is on). |
| A native-module-capable build (`@napi-rs/canvas`, Tesseract data) | PDF import and OCR | A minimal "alpine/musl" image or a build without native modules breaks PDF import; test it. |

**Frontend hosting:** any static host works (the build is plain files; configure single-page fallback to `index.html` and HTTPS). A static/serverless **frontend** is fine; only the **API** has the constraints above.

**Topology and cookies:** the browser sends the session cookie to the API origin. Same registrable domain (for example `app.<domain>` and `api.<domain>`) → `SESSION_COOKIE_SAMESITE=lax`. Different registrable domains → `none` (needs https; the server forces Secure) and the server's origin guard refuses state-changing requests from any other origin. Third-party-cookie restrictions in some browsers make the different-site layout fragile: **prefer the same-site layout.**

## 3. Staging layout

```
browser ──https──► static frontend  (VITE_API_URL = https://<staging api>/api)
browser ──https──► TLS reverse proxy ──http──► Node API (NODE_ENV=staging, one instance) ──► staging MySQL (own database and user)
                                                  └─► https://api.anthropic.com (staging key, provider-side spend limit)
```

Separate staging environment, database, credentials and Anthropic workspace; no production data; no hardcoded credential or domain. Configuration files: [`staging.env.template`](staging.env.template) and [`production.env.template`](production.env.template). This layout is what the local E2E rehearsed (a TLS proxy in front of the server running as `NODE_ENV=staging`); see `docs/vpaa-conformance/e2e/E2E-REPORT.md`. That rehearsal is **not** a staging verification.

## 4. Session storage: decision for the owner

| Option | When it is enough |
|---|---|
| Keep MemoryStore | One API instance, brief logouts on each deploy/restart are acceptable (staging). |
| Database-backed session store (a new dependency such as `express-mysql-session`, plus a table) | A production deployment where a restart must not log users out, or where two instances are wanted. **Not implemented**: it adds a dependency and a table, so it needs the owner's decision. |

Remember-me (`remember_token`) already survives restarts: it is stored in the database, so a returning user is signed in again without a MemoryStore session.

## 5. Deployment and rollback (preparation only)

Deploy: provision (owner) → build the frontend with the staging `VITE_API_URL` → create the staging database with `init.js` and the migrations (no `seed.sql` demo accounts: see the runbook) → start the API with the staging environment → `node scripts/smoke-test.cjs` → checklist section G of `docs/vpaa-conformance/STAGING-SETUP-CHECKLIST.md`. Rollback, step by step, is in [`RUNBOOK.md`](RUNBOOK.md). No step is automated and nothing deploys without separate authorization.
