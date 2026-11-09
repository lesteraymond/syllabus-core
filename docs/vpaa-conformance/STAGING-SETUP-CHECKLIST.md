# Staging setup checklist (for the system owner)

Hand-written. It contains **no secret, no real credential and no invented domain**: every `<…>` below is a value only you can supply. Nothing here was done for you, and no environment file was changed. This checklist prepares a staging environment; it does **not** authorize a live provider test (see [`STAGING-TEST-PLAN.md`](STAGING-TEST-PLAN.md)).

Two different things are being separated on purpose:

- **Code readiness** is what the repository proves offline (`npm run test:vpaa`, `npm test`, `npm run build`). It is in the report.
- **Environment readiness** is what only the real staging host can show. Until every box below is ticked and both read-only reports exit 0, the staging environment is **not ready**, whatever the tests say.

## A. Credentials (by hand; never paste one into a chat, a ticket or a commit)

- [ ] Revoke the `SMTP_PASS` (Gmail app password) and the Gemini key that were pasted into chats; delete the commented-out Gemini line from `server/.env`.
- [ ] Create a **new** Anthropic API key for staging, in its **own workspace**.
- [ ] In that workspace, set a **hard monthly spend limit** (see section E). This is the only authoritative cost control.
- [ ] Generate a new `SESSION_SECRET` and a new `JWT_SECRET`, each 32 or more random characters, different from each other and from development. (Any password manager or `openssl rand -base64 32` will do.)
- [ ] Create a **dedicated staging database** and a least-privilege user with a **non-empty** password. Do not point staging at the development or production database. No migration is run by this preparation.
- [ ] Store the values only in the staging host's secret store or its private `.env`. Do not copy the development `.env`.

## B. The staging environment file (names only; supply the values)

```
NODE_ENV=staging
SYLLABUS_CHECK_ACADEMIC_V2=on
SYLLABUS_CHECK_AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=<new staging key>
ANTHROPIC_MODEL=claude-sonnet-5-5
SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL=claude-sonnet-5-5
SESSION_SECRET=<new>
JWT_SECRET=<new>
SYLLABUS_CHECK_AI_GATE=advisory
SYLLABUS_CHECK_AI_MAX_REQUESTS=120
SYLLABUS_CHECK_AI_MAX_COST_USD=10
CORS_ALLOWED_ORIGINS=<staging frontend origin, for example https://… with no path and no trailing slash>
TRUST_PROXY=<reverse-proxy hops, usually 1>
SESSION_COOKIE_SAMESITE=<lax or none, from section C>
DB_HOST=<…>  DB_NAME=<…>  DB_USER=<…>  DB_PASS=<…>
APP_URL=<staging frontend URL>
```

- [ ] Each of these keys appears **once** (with two lines the last wins silently).
- [ ] `SYLLABUS_CHECK_STAGE_B` and `SYLLABUS_CHECK_STAGE_C3` are unset.
- [ ] `NODE_ENV` is `staging`, never `production` and never unset. With `staging` or `production` the server **refuses to start** on a missing or publicly known secret, a missing or wildcard origin, a non-https origin, a missing proxy setting, or an insecure cookie setting. That refusal is intended.

## C. Frontend and API topology: decide `SESSION_COOKIE_SAMESITE`

The browser calls the API directly (`VITE_API_URL`, with credentials), so the cookie travels cross-origin. What counts is whether the two hosts share a **site** (the registrable domain), not whether they share a host name.

| Your staging layout | `CORS_ALLOWED_ORIGINS` | `SESSION_COOKIE_SAMESITE` | Notes |
|---|---|---|---|
| Frontend and API on the same site (for example two subdomains of one domain, or one host with the API under a path) | the frontend origin | `lax` (default) | Safest. Cookies are Secure and HttpOnly; Lax blocks cross-site form posts. |
| Frontend and API on different sites | the frontend origin | `none` | Requires https (the server forces Secure). The server's origin check then refuses state-changing requests from any other origin, because `none` would otherwise let a foreign page ride the cookie. |
| Same origin (the proxy serves both) | the same origin | `lax` or `strict` | `strict` also works if no cross-site link into the app must stay logged in. |

- [ ] Layout decided; value of `SESSION_COOKIE_SAMESITE` chosen from the table.
- [ ] `CORS_ALLOWED_ORIGINS` lists **only** the real staging frontend origin(s). No `*`, no `null`, no http (except localhost), no path.
- [ ] The frontend is built with `VITE_API_URL=<the staging API URL>/api` (a build-time setting; the default points at localhost).

## D. TLS-terminating reverse proxy

The Node server speaks plain HTTP behind the proxy, so it must be told to trust it, or it will not set the Secure session cookie.

- [ ] The proxy terminates TLS (https only for browsers).
- [ ] The proxy sends `X-Forwarded-Proto: https` and `X-Forwarded-For`.
- [ ] `TRUST_PROXY` equals the number of proxy hops in front of the server (`1` for a single proxy). `true` and `*` are refused on purpose: they would let any client forge its address and protocol.
- [ ] The Node port is **not** reachable from the internet except through the proxy.

## E. Provider-side spending limit (the real cost control)

The in-app `SYLLABUS_CHECK_AI_MAX_COST_USD` is a **reservation guard**, not a spend meter. It reserves each request's input plus the maximum output and never releases it. It stops a check early, and it cannot stop spend that happens elsewhere. Measured with the scripted model, the 20-request synthetic check reserves about $4.5, so the documented cap of 10 completes it; a cap of 1.50 stops it after 7 requests.

- [ ] A **hard** spend limit is set in the Anthropic workspace of the staging key, lower than the amount you are willing to lose (the earlier measured cost of one real legacy check was about $0.92; a Policy V2 check is expected at about twice that, an estimate and not a measurement).
- [ ] Usage alerts are on, if the workspace offers them.
- [ ] The request budget `SYLLABUS_CHECK_AI_MAX_REQUESTS=120` is set (a check of the synthetic sample sends 20).
- [ ] `ANTHROPIC_MAX_TOKENS` is left at its default (16,000) unless evidence says otherwise: a low value risks truncated answers.

## F. Read-only verification before anything is authorized

Neither command prints a secret, changes a file or sends a request.

- [ ] `node scripts/credential-readiness.cjs --env-file <staging env file>` exits 0.
- [ ] `node scripts/vpaa-v2-preflight.cjs --env-file <staging env file>` exits 0 with no warning. It now also validates the origins, proxy and cookie settings with the same code the server runs at startup.
- [ ] `npm run test:vpaa`, `npm test` and `npm run build` are green at the exact commit being deployed.

## G. After deploying (still before any live provider request)

Run these against the staging URL with a test account. They send no model request.

- [ ] The server starts. Its log has a `HOST:` line showing the origin count and source, `Secure=true`, the `SameSite` value and the trust-proxy setting. (It prints counts, never a secret.)
- [ ] Logging in over https sets `connect.sid` and `remember_token`, both **HttpOnly** and **Secure**, with the `SameSite` you chose (browser developer tools, Application, Cookies).
- [ ] A request from the staging frontend succeeds with credentials, and the response carries `Access-Control-Allow-Origin: <the frontend origin>` (never `*`) and `Access-Control-Allow-Credentials: true`.
- [ ] A state-changing request sent with `Origin: https://example.invalid` is refused with HTTP 403 `origin_not_allowed`.
- [ ] Admin and faculty roles still see only what they should (the integration tests prove it offline; confirm once on the real host).

## H. What this checklist does not do

It does not run or authorize the live smoke test, create or rotate any credential, change a database, or approve production. The four levels stay separate: **software conformance verified** (offline), **staging configuration ready** (this checklist, both reports exit 0, section G done), **live provider tested** (only after separate written authorization), **production approved** (not before the production blockers in the report are closed).
