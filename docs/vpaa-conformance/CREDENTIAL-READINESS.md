# Credential readiness for a staging evaluation

**Nothing was rotated, created, changed or exposed while preparing this.** This document says what a person with access must do by hand before a staging evaluation of Policy V2, and how to check it. It contains no secret, no key fragment and no exact length.

## How the inspection was done

`node scripts/credential-readiness.cjs [--env-file path]` is read-only. It prints variable **names**, a status word and the action each needs. It never prints a value, a prefix, a suffix or an exact length (only a bucket such as "32 or more"), it makes no network or model request, and it exits 0 only when no manual action is blocking. A regression test (`VPAA-SEC-READINESS-NO-LEAK`) runs it and the Policy V2 preflight on a file full of marked sentinel secrets and fails if any 8-character fragment of any secret appears in the output.

The repository was also scanned, reporting locations only: **no real-looking provider key exists in any committed tree** (the only matches are the tests' own placeholders), and `.env` and `server/.env` are git-ignored and untracked.

## What the current development file needs (before staging)

| Variable | Finding | Manual action |
|---|---|---|
| `SMTP_PASS` | The Gmail app password was pasted into a chat earlier (project notes). | **Revoke it** in the Google account and create a new one, or leave mail unconfigured in staging. |
| `GEMINI_API_KEY` | A **commented-out line still holds the key**, which was also pasted into a chat earlier. | **Revoke the key** with its provider, then delete the commented line. Commenting out does not protect a secret. |
| `DB_PASS` | **Empty** (local development database with no password). | Staging needs its **own database user** with a real password and least privilege (`DB_USER` is currently the administrative account). |
| `ANTHROPIC_API_KEY` | Present. Whether it was ever shared is not recorded. | Create a **separate staging key** in its own Anthropic workspace with a **hard monthly spend limit**; do not reuse the development key. Revoke the development key if it was ever pasted anywhere. |
| `OPENROUTER_API_KEY` | Present but **not used** while the provider is `anthropic`. | Do not put it in the staging environment. Revoke it if it was ever shared. |
| `SESSION_SECRET`, `JWT_SECRET` | Present and acceptable (varied, at least 16 characters, not a known default). | Generate **new, different** values for staging. Never reuse the development values, and never use the same value for both. |

A credential is **exposed** if it was ever pasted into a chat, ticket, document, log or screenshot, whatever its current status. Treat the two noted above as exposed. Rotate them yourself; this project does not do it for you.

## Generating the staging secrets (without writing one down in a chat)

Run on the staging host, and put the output only in the staging environment file or secret store:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use one run for `SESSION_SECRET` and another for `JWT_SECRET`. Do not paste either into a chat, a ticket or a log.

## What the server now enforces

With `NODE_ENV=staging` or `production`, `server/index.js` **refuses to start** (exit status 1, before it opens a database connection or a port) if `SESSION_SECRET` or `JWT_SECRET` is missing, shorter than 16 characters, too repetitive, or a publicly known default such as the constant the project used to ship. The message names the variable and never prints what was configured. In any other mode (local development, tests) a missing or weak session secret is replaced by a **random per-process secret**, never a constant, and a warning says sessions end when the server restarts. Recommendation verification tokens follow the same rule and fail closed (HTTP 503) without an acceptable secret.

## Remaining blockers before a staging run (all manual)

1. Revoke the exposed `SMTP_PASS` and Gemini key; remove the commented line.
2. Create the staging database and user (non-empty password, least privilege).
3. Create the staging Anthropic key with a hard spend limit, in its own workspace.
4. Generate new staging `SESSION_SECRET` and `JWT_SECRET`.
5. Set `NODE_ENV=staging` in the staging environment.
6. Run `node scripts/credential-readiness.cjs --env-file <staging env>` and `node scripts/vpaa-v2-preflight.cjs --env-file <staging env>`; both must exit 0.
7. Set the host settings for the staging address (the server now reads them from the environment and refuses to start without them; nothing is hardcoded and no domain is assumed): `CORS_ALLOWED_ORIGINS` (the staging frontend origin, https), `TRUST_PROXY` (reverse-proxy hops), `SESSION_COOKIE_SAMESITE` (`lax` for same-site frontend and API, `none` otherwise). The full procedure is [`STAGING-SETUP-CHECKLIST.md`](STAGING-SETUP-CHECKLIST.md).
