# Policy V2: configuration for an authorized staging test, and for future institutional activation

**Status: Policy V2 is prepared, NOT activated.** Nothing in this repository turns it on. The production environment variables, official scoring, authorization and gates were not changed, and no paid model request was made while preparing it. This document is the exact procedure for someone who is authorized to do the next step.

Policy V2 is the **primary semantic evaluation path for all seven VPAA relationships** and is **advisory-only**: it adds no points, no deductions and no gate. The 47 deterministic rules, the pass mark of 79, the six weighted areas, the authorized deductions (alignment 3, partial 1, link 2, value 1), the submission and approval gates, the Re-Check API, the recommendation workflows and the English/Filipino localization are unchanged.

## 1. The seven relationships (what V2 evaluates)

| # | VPAA relationship | Policy V2 type | Source field → target field |
|---|---|---|---|
| 1 | Course Title ↔ Course Content | `Content-course` | course code, title, program, year level, week and adjacent weeks (never the description) → the week's Course Content |
| 2 | Course Content ↔ ILO | `Content-ILO` | the week's Course Content → one ILO |
| 3 | ILO ↔ CLO | `ILO-CLO` | the faculty-authored statement of an assigned CLO (with its fixed LCUP classification as context) → one ILO |
| 4 | Course Content ↔ Learning Activities | `Content-activity` | the week's Course Content → its Learning Activities |
| 5 | ILO ↔ Learning Activities | `ILO-activity` | one ILO → the week's Learning Activities |
| 6 | Course Content ↔ Assessment | `Content-assessment` | the week's Course Content → its Assessment Tasks |
| 7 | Learning Activities ↔ Assessment | `Activity-assessment` | the week's Learning Activities → its Assessment Tasks |

CLO ↔ Course Description is **not** a relationship and does not exist in either path. Examination rows carry no weekly obligation. The direct ILO ↔ Assessment relationship stays an optional diagnostic, not an eighth required one.

## 2. Exact configuration for a staging test

Set these in the **staging** server environment only (a `.env` file for the staging API process). Do not set them in production.

```
NODE_ENV=staging                                    # REQUIRED: a missing or publicly known secret then stops the server instead of being replaced
SYLLABUS_CHECK_ACADEMIC_V2=on                       # the only value that activates it; "true" or "1" do not
SYLLABUS_CHECK_AI_PROVIDER=anthropic                # defined ONCE (with two lines, the last wins silently)
ANTHROPIC_API_KEY=<a NEW staging key with a hard spend limit>
ANTHROPIC_MODEL=claude-sonnet-5-5
SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL=claude-sonnet-5-5   # must equal ANTHROPIC_MODEL, or no request is sent
SESSION_SECRET=<32+ NEW random characters>          # REQUIRED: signs session cookies and recommendation tokens; no default exists
JWT_SECRET=<32+ NEW random characters>              # REQUIRED: signs login tokens
CORS_ALLOWED_ORIGINS=<the staging FRONTEND origin: https://host[:port], no path, no trailing slash>   # REQUIRED: the server refuses to start without it
TRUST_PROXY=<number of reverse-proxy hops in front of this server, usually 1>   # REQUIRED: needed so the Secure session cookie can be set behind TLS termination
SESSION_COOKIE_SAMESITE=<lax if the frontend and the API share a site; none only if they do not>   # see section 2a
SYLLABUS_CHECK_AI_GATE=advisory                     # the default; keep it
SYLLABUS_CHECK_AI_MAX_REQUESTS=120                  # request cap for ONE check, all retries included (default 512)
SYLLABUS_CHECK_AI_MAX_COST_USD=10                   # a RESERVATION guard, not spend: read the next paragraph before changing it
```

### 2a. Origins, cookies and the proxy (the host layer)

The frontend calls the API **directly** from the browser (`VITE_API_URL`, `credentials: 'include'`), so the server must name the frontend origin it trusts. Nothing is invented here: the staging frontend origin is a deployment fact the system owner supplies.

| Setting | Rule |
|---|---|
| `CORS_ALLOWED_ORIGINS` | comma-separated explicit origins (`https://host[:port]`). No `*`, no `null`, no path, no trailing slash. In staging and production it is required and must be https. Development default: `http://localhost:5173` only. An explicit list **replaces** the default. |
| `TRUST_PROXY` | hops (1 to 5) or a proxy address list. `true` and `*` are refused. Required in staging and production. The proxy must terminate TLS and send `X-Forwarded-Proto: https`. |
| `SESSION_COOKIE_SAMESITE` | `lax` (default) when the frontend and the API are the same **site** (for example `app.example.org` and `api.example.org`); `none` only when they are different sites, which requires Secure cookies; `strict` is allowed. |
| `SESSION_COOKIE_SECURE` | forced on in staging and production; `false` there stops the server. |

Both cookies (`connect.sid`, `remember_token`) are `HttpOnly`, and `Secure` in staging and production. Unsafe requests (POST, PUT, PATCH, DELETE) whose `Origin` is not allowed are refused with HTTP 403 `origin_not_allowed`, including `Origin: null` and cross-site requests with no `Origin`, so a cross-site form post cannot ride on the session cookie. Any invalid value stops the server at startup with a message that names the setting and never prints a secret.

Also needed, but not Policy V2 settings: a **dedicated staging database** (`DB_HOST`, `DB_NAME`, a least-privilege `DB_USER` and a non-empty `DB_PASS`) and the staging `APP_URL`. Do not copy the development `.env`.

**Why the cost cap is 10, not a small number.** `SYLLABUS_CHECK_AI_MAX_COST_USD` does not measure what is spent. Before each request it **reserves** the request's input size plus the **maximum** possible output (`ANTHROPIC_MAX_TOKENS`, default 16,000) at the output price, and it never releases the reservation. A full 20-request Policy V2 check of the synthetic sample reserves about **$4.5** at the default output limit (measured under exactly this configuration), while real spend is a fraction of that. A cap below the reservation does not overspend: the check stops early and the report says it is incomplete (measured: `1.50` stops after 7 of 20 requests with 0 of 7 relationships evaluated; `3` stops after 13, 2 of 7; `4` after 17, 4 of 7; `5` and above complete all 7). `10` leaves headroom for a longer syllabus. The **authoritative spending limit is the one you set in the Anthropic workspace of the staging key**. Do not lower `ANTHROPIC_MAX_TOKENS` to shrink the reservation without evidence: a live legacy check averaged about 5,900 output tokens per request including thinking, so a low limit risks truncated answers (reported as incomplete output).

Leave `SYLLABUS_CHECK_STAGE_B` and `SYLLABUS_CHECK_STAGE_C3` **unset**. If they are set, the service holds them off for a check while V2 is on, so no relationship is asked twice. The service also sets `SYLLABUS_CHECK_CLO_DESCRIPTION=off` for the legacy run while V2 is on. The other stage flags (A, B3, B4, C1, C2, D1, D2) are independent and are not touched.

**Check it before using it (read-only, prints no secret, sends no request):**

```
node scripts/vpaa-v2-preflight.cjs --env-file path/to/staging.env
```

It exits 0 only when every required item is satisfied. Run against the current development `server/.env` it reports the missing required items (`SYLLABUS_CHECK_ACADEMIC_V2`, `NODE_ENV=staging`, the host settings) plus the two unset caps: the correct answer for a development file. Then check the credentials (read-only; names and statuses only, never a value): `node scripts/credential-readiness.cjs --env-file path/to/staging.env`. The credential procedure is in [`CREDENTIAL-READINESS.md`](CREDENTIAL-READINESS.md).

## 3. What a staging check does (measured with the scripted model)

For the synthetic 18-week sample, under exactly the configuration above, a check sent 20 requests: 9 from the legacy path (it still runs for the official score) and 11 from Policy V2 (batches of 12 relationships, three batches in flight at a time). A longer or richer syllabus sends more; the request cap of 120 bounds it. Expect roughly **twice the model cost of a legacy-only check**. One earlier live legacy check of a real syllabus was billed about $0.92 (run 435), so a V2 check should be budgeted at about $1.80 or more; that is an estimate, not a measurement. The two caps above bound it. The legacy and V2 paths share **one** budget per check.

**When the provider fails (measured with a scripted provider that fails every request).** Every attempt counts against the request cap. HTTP 429 is tried again up to `ANTHROPIC_MAX_RETRIES` times (default 2, maximum 3; a value outside 0 to 3 is ignored and the default applies) and then the whole check stops: 3 requests. HTTP 500, 502, 503 and 529 are retried the same way and the check stops after three consecutive failing batches: **9 requests** at concurrency 1, **15 at the default concurrency of 3**, 24 at 6 (`SYLLABUS_CHECK_AI_CONCURRENCY`). A refusal (400, 401, 402, 403, 404) is one attempt and stops the check at once; 401, 402 and 403 also start a cooldown of 300 s (`SYLLABUS_CHECK_AI_COOLDOWN_SEC`) in which no request is sent. A timeout (HTTP 504, or the 180 s deadline `ANTHROPIC_TIMEOUT_SEC`) is never sent again, because a timed-out question may already have been billed: 3 requests (three batches tried once each). Whatever stops the check, the report says it is incomplete, and no verdict is invented.

- Five relationships (1, 2, 4, 6, 7) are evaluated by V2 only, once each.
- ILO ↔ CLO and ILO ↔ Activities are asked by both paths by design: they are *scored* relationships in the legacy path (official deductions) and *advisory* in V2, with V2 adding the CLO classification context. They are reported in separate sections and the recommendation list keeps one recommendation per relationship.
- Stage B and Stage C3 (and with them the Plan-sequence advice) are held off while V2 is on.

## 4. What the report says when V2 is off or unavailable

Every stored report carries `hybrid.semanticCoverage` (advisory data, never a score input) and the card shows a warning chip, "VPAA relationships checked: N of 7", only when the check is incomplete. The reason is stated.

| Situation | Coverage shown | Reason |
|---|---|---|
| Policy V2 off, no stage on (today's default) | 2 of 7 (ILO ↔ CLO, ILO ↔ Activities) | `policy_v2_off` |
| Policy V2 off, Stage B and C3 on | 7 of 7, from the legacy stages | none |
| Policy V2 on, the AI cannot run (provider down, refused, not approved, budget spent) | 0 of 7 | `v2_not_evaluated` |
| Policy V2 on, some answers could not be verified | the verified ones only | `v2_partial` |
| Policy V2 on, a syllabus field is empty | the relationships that use it are not evaluated | `missing_evidence` |
| Policy V2 on and everything evaluated | 7 of 7, no chip | none |

In every case the 47 coded rules still run, nothing is fabricated, no official score is issued from an incomplete AI check (the coded base score is shown as provisional), and the submission gates are exactly as before.

A CLO whose classification is not saved is **not judged and no classification is assumed**; the report names the CLO and tells the author to select one in the CLO step.

## 5. Procedure for an authorized staging test

1. Use a staging database holding a copy of the data, never production.
2. Put the settings of section 2 in the staging environment; run the preflight until it exits 0.
3. Start the staging API. Run **one** Re-Check on one approved or synthetic syllabus.
4. Confirm in the saved report: `hybrid.semanticCoverage.complete` is true; `hybrid.academicV2.alignment.liveModelCalls` equals the V2 requests actually sent; the official `score`, `passed` and deductions equal what the same syllabus gives with the flag off.
5. Confirm Accept, Edit, Reject and Undo and Check & Improve work for the author only, and a V2 recommendation cannot be accepted without a verification token.
6. Record the real cost and the request count; compare with section 3.
7. **Roll back** by unsetting `SYLLABUS_CHECK_ACADEMIC_V2` and restarting. There is no migration and no schema change; saved reports keep their `hybrid.academicV2` section and the UI handles its absence.

## 6. Before any institutional activation (not the software's decision)

- Written approval to activate Policy V2 in production, through your change process.
- A rubric for "partially aligned" for each relationship (the sources do not define one); until then the seven "partial" scenarios assert invariants only.
- A decision whether the legacy path should also run with `SYLLABUS_CHECK_CLO_DESCRIPTION=off` when V2 is off. It is unset by default so that every legacy request stays byte for byte what it was; changing it alters the input to Claude for the scored CLO relationships and should be validated first.
- A decision on C-04, R-02 and R-03 (replaced by link checks in Hybrid-2) and on whether Accept outside Policy V2 should also require a Check & Improve token.
- Budget approval, key rotation, and `SESSION_SECRET` set in every environment.

These tests establish **software conformance**. They do not measure how accurately Claude judges real syllabi, and no accuracy figure is claimed.
