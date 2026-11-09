# Policy V2 staging test plan, and the conditions for a live smoke test

Companion documents: [`POLICY-V2-ACTIVATION.md`](POLICY-V2-ACTIVATION.md) (the configuration), [`CREDENTIAL-READINESS.md`](CREDENTIAL-READINESS.md) (what must be rotated by hand), [`REPORT.md`](REPORT.md) (the conformance results).

## The four levels, and where things stand

| Level | Meaning | Status |
|---|---|---|
| **SOFTWARE CONFORMANCE VERIFIED** | The code does what the requirements say, shown offline with a scripted provider and synthetic data. | **Yes.** `npm run test:vpaa`, `npm test` and `npm run build` pass. |
| **STAGING CONFIGURATION READY** | The configuration is documented, matches the code, and the environment it describes exists. | **The configuration is ready; the environment is not.** The document is verified against the code (`VPAA-STG-*`), but the staging environment still needs its own credentials, database, `NODE_ENV=staging` and host settings (see `CREDENTIAL-READINESS.md`). |
| **LIVE PROVIDER TESTED** | A real Claude request has been made under this configuration and its results checked. | **No.** No Anthropic request was dispatched in any of this work. |
| **PRODUCTION APPROVED** | An authorized person has approved Policy V2 for production. | **No.** Policy V2 is off by default and was not activated anywhere. |

## 1. The offline staging rehearsal (done, repeatable)

It runs the full workflow under the **documented** configuration (the tests parse the block in `POLICY-V2-ACTIVATION.md`, so they cannot drift from it), with a **scripted provider**, **synthetic syllabus data** and an **in-memory database**. Any non-loopback network call fails the suite, and every credential in it is a stand-in. Run it with `npm run test:vpaa`, or just the staging parts:

```
node --test server/lib/syllabuscheck/vpaa-conformance/staging-config.conformance.test.js server/lib/syllabuscheck/vpaa-conformance/staging-rehearsal.conformance.test.js server/lib/syllabuscheck/vpaa-conformance/security.conformance.test.js
node scripts/test-vpaa-ui.mjs
```

| Required verification | Test |
|---|---|
| Seven VPAA relationships evaluated | `VPAA-STG-REHEARSAL-SEVEN`, `VPAA-V2-SEVEN` |
| Correct relationship identifiers | `VPAA-STG-REHEARSAL-SEVEN` (format per type, unique), `VPAA-V2-SEVEN` |
| Correct academic context extraction | `VPAA-STG-REHEARSAL-SEVEN` (course identity, adjacent week, no description with CLO relationships, fixed CLO classification), `VPAA-R15-CONTEXT` |
| Correct recommendation generation | `VPAA-STG-REHEARSAL-SEVEN` (advisory, one per relationship, never auto-applied), `VPAA-V2-NO-DUPLICATES` |
| Official score parity | `VPAA-STG-REHEARSAL-PARITY`, `VPAA-V2-SCORE-PARITY`, `VPAA-V2-BASELINE-PARITY` (six recorded real-syllabus baselines) |
| Saved report persistence | `VPAA-STG-REHEARSAL-PERSISTENCE`, `VPAA-V2-PERSISTENCE`, `VPAA-STG-ROLLBACK` |
| Faculty and Admin report rendering | `VPAA-STG-UI-FACULTY-ADMIN` (author with Apply controls, administrator read-only and the approval modal), `VPAA-V2-UI-*`, `VPAA-T5-UI-*` |
| AI-offline behavior | `VPAA-STG-REHEARSAL-OFFLINE`, `VPAA-V2-OFFLINE`, `VPAA-STG-PROVIDER-FAILURE` |
| Budget enforcement | `VPAA-STG-LIMITS` (request, token and cost limits), `VPAA-STG-RETRY` (every attempt counted), `VPAA-V2-BUDGET` |
| Authorization controls | `VPAA-STG-REHEARSAL-AUTHORIZATION` (author only, forged and replayed tokens, administrator read-only, locked syllabus, no secret fails closed), `VPAA-R13-*` |
| Secure secrets | `VPAA-SEC-*`, `server/lib/sessionSecret.test.js` |

## 2. What the rehearsal cannot show

How Claude Sonnet 5.5 actually judges text; whether its answers satisfy the strict response validator on real output; real latency, rate limiting and billing; the real cost of a check (the in-app cost figure is a conservative **reservation**, not spend); behavior against a real MySQL; the real Faculty and Administrator browsers; whether the staging host's CORS and cookie settings work. These are what a live smoke test is for.

## 3. Conditions required BEFORE a separately authorized live Claude smoke test

A live smoke test sends text to an external AI service. **It must not be started on the strength of this document alone.** Each of these must be true and recorded:

1. **Explicit written authorization** from the person who owns the decision, naming: the staging environment, the exact configuration, the maximum spend, the date, and who runs it. Authorization for one test does not extend to another.
2. **Synthetic content only.** The syllabus text sent is controlled synthetic text (for example the fixture course in `server/lib/compliance/fixtures.js`), never a faculty member's or the institution's real syllabus. The check also sends the program outcomes and attributes of the reference data it is run against; the authorizer must confirm that sending that wording to the provider is acceptable, or use reference text that is itself synthetic.
3. **Credentials done by hand** per `CREDENTIAL-READINESS.md`: exposed credentials revoked; a **new** staging Anthropic key in its own workspace with a **hard spend limit** set at the provider (the in-app cap is only a guard); new `SESSION_SECRET` and `JWT_SECRET`; a dedicated staging database user with a real password.
4. **Both read-only reports exit 0** on the staging environment file: `node scripts/credential-readiness.cjs --env-file <file>` and `node scripts/vpaa-v2-preflight.cjs --env-file <file>`.
5. **The offline evidence is green at the exact commit being deployed:** `npm run test:vpaa`, `npm test` and `npm run build`.
6. **A staging database and server separate from production**, with `NODE_ENV=staging`, no production data, and the host's CORS origin, proxy trust and cookie settings set for the staging address (`CORS_ALLOWED_ORIGINS`, `TRUST_PROXY`, `SESSION_COOKIE_SAMESITE`; see `STAGING-SETUP-CHECKLIST.md`). The preflight validates them with the same code the server runs at startup.
7. **Limits set:** `SYLLABUS_CHECK_AI_MAX_REQUESTS=120` and `SYLLABUS_CHECK_AI_MAX_COST_USD=10` as documented (the guard reserves about $4.5 for the 20-request synthetic check, measured; a smaller value makes the check stop early), and the provider-side spend limit lower than the amount the authorizer is willing to lose.
8. **A named observer and a stop rule:** abort at once if more than one check is started, a request count above 120 is seen, the provider reports a charge above the authorized maximum, or any real institutional text appears in a request.
9. **A rollback ready:** unset `SYLLABUS_CHECK_ACADEMIC_V2`, restart, and revoke the staging key if it was exposed at any point.

### The smoke test itself (when authorized)

Run **one** Re-Check of one synthetic syllabus. Then confirm, from the saved report and the provider's usage page: `hybrid.semanticCoverage.complete` is true; the V2 request count in the report equals the requests the provider recorded; no request carried real text; the official `score`, `passed` and deductions equal what the same syllabus gives with the flag off (re-run with the flag off to compare); every Claude answer passed validation (none reported "could not be verified"); Accept, Edit, Reject, Undo and Check & Improve work for the author only; the real spend is recorded and compared with the estimate. A pass of this test would raise the level **LIVE PROVIDER TESTED** for that configuration only. It is still not production approval, and it does not measure academic accuracy.

## 4. Verdict for this preparation

**SOFTWARE CONFORMANCE VERIFIED. STAGING CONFIGURATION READY (documented and verified; environment pending manual steps). LIVE PROVIDER NOT TESTED. PRODUCTION NOT APPROVED.**
