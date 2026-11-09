# RC2 completion and dynamic-reference readiness: two verdicts

Date 2026-11-06. All results are **offline** (scripted Claude double, synthetic data, isolated database on port 43310 built from pre-provisioned copied schemas; no migration, no DDL, no paid call, no write to the development database, no commit, push or deployment). Nothing here is real-Claude, staging or production evidence.

## Source state

| | Hash (source set, `scripts/release/` excluded) |
|---|---|
| Release candidate **rc2** (frozen copy, `tmp/release-candidate/rc2`) | `4d6aacec578613604e182d4f6e026fc5b3578ae4af035eb4d8b5b0a13a18aa68`, 788 files |
| Live working tree now | `0ad88ab3…` at 00:06, `8a60e5dc…` at the end: **no longer equals rc2, and still moving** |

The working tree has moved on since the rc2 freeze (the other session is still editing): modified `server/lib/syllabusOutcomes.js`, `server/routes/academicYears.js` (+ test), `server/routes/syllabusContent.js`, `server/routes/catalog.routes.test.js`, `src/lib/api.js`, `src/lib/syllabusModel.js` (+ test), `src/lib/academicYearScope.js` (+ test), `src/components/{AcademicYearControl,AcademicYearScope,Select}.jsx`, `src/views/builder2/{ClosStep,InfoStep,index}.jsx`, `src/i18n/extra.js`, `src/styles.css`; added `server/lib/syllabusStandardsLock.test.js`. Areas: subject/academic-year UI, subject-standards handling, content save. Nothing in `server/lib/syllabuscheck/`, the cost optimizations or the schema. Every run below executed the **frozen rc2 bytes** (hash verified before and after each run), so each is valid for rc2 only; the report states "tree moved" because the live tree differs from rc2, not because rc2 changed. **A release candidate that matches the current tree needs a new freeze and a full re-run.**

## A. CURRENT RELEASE CANDIDATE READINESS

| Run on rc2 | Result |
|---|---|
| `npm test` | 2,153 / 2,153 |
| `npm run test:vpaa` | 276 + 18 |
| `npm run build` | passes |
| Browser E01-E24, optimizations **OFF** | 24 / 24 |
| Browser E01-E24, recommended optimizations **ON** | **24 / 24** (flags: warm-up, output plan, scoped output fields ON; course context, grouping, prompt trim OFF) |
| Browser K01-K10 (ON) | **10 / 10** |
| Browser tight-budget B01, $6 (ON) | **1 / 1** |
| Four-program PO browser workflow, OFF | **4 / 4** (BSIT 9 POs, BSIE 13, BSCpE 13, Cyber 9 from BSIT; browser score 99, threshold 79) |
| Four-program PO browser workflow, ON | **4 / 4** (same) |

**Existing four-program verification** (SELECT-only against development, `po-parity-rc2.json`, plus the browser runs): BSIT 9, BSIE 13, BSCpE 13, Cyber Security inherits BSIT's 9 POs and BSIT 2022-2023 curriculum; baseline and optimized runs identical (51 requests, official 85/scored/passed, threshold 79, seven VPAA types and four CLO classifications evaluated with 0 NOT_CHECKED, six areas and verdicts identical). Eight historical reviews intact (PO mapping reviews for syllabus 43, 93, 97, 99, 100, 101, 102 and the curriculum review for 110); no mapping rewritten; saved-report round trip and revision protection (E01-E24, K10); faculty and admin views (E05-E10, K05).

Failed or incomplete: nothing failed on rc2; the earlier interruption (ON regression killed by the memory reaper) is closed by this run. Missing: a freeze that matches the live tree. Required code changes for this verdict: none. Required database changes: none. Remaining authorizations: a live-Claude smoke test (prepared, `SMOKE-TEST-PLAN.md`) and staging provisioning, below.

**Verdict A: READINESS_PENDING_SOURCE_REFREEZE.** On the frozen rc2 bytes every required offline suite passes (all rows above). The current tree has moved and was not re-verified. **BLOCKED_WITH_REASONS for staging preparation** until (1) the tree is re-frozen and the suite re-run, and (2) the staging prerequisites below exist.

## B. DYNAMIC ACADEMIC REFERENCE SUPPORT READINESS

Full evidence: `DYNAMIC-REFERENCE-AUDIT.md`. A brand-new program `ZZNEW` was created through the real Admin API in an isolated database and checked (current tree and rc2 behave identically).

* **Verified:** the legacy checker reads PO masters from the database per academic-year program row; a new program is resolved with no hard-coded list; a PO edit reaches the checker and is flagged (`PO-EXACT`); copy-catalog gives the new year its own program/PO/EGA rows with isolation from the previous year; missing PO-EGA mappings give `P-03 NOT_CHECKED` with no invented mapping; curriculum references are an approved/immutable registry by program code.
* **Failed:** Policy V2 CLO-PO and CLO-anyPO relationships for a new program (8/8 `NOT_CHECKED`, `po_reference_review`), because `academicV2Plan.referencesFor` compares against the static `officialProgramOutcomes.json`; the program's own EGAs are not consumed (`INST-EXACT` blocks a syllabus carrying the program's EGAs); the saved V2 report of a new program is labelled with the static official version `lcup-po-2026-10-29` and its 2026-10-29 authorization; unversioned programs record no PO version, the institution version is never recorded; creating a subject with a new program creates no curriculum reference (the first check was blocked by `CUR-REF`).
* **Missing requirements:** a way to publish an Admin-edited PO list as an immutable versioned reference (today only the migration script writes those rows); versioned Vision/Mission/EGA history.
* **Required code changes** (minimum, existing resolver and tables only, no new rules/checker): replace the static comparison in `academicV2Plan.referencesFor` with `masters.pos` / `masters.poReference` / `masters.outcomeSource`; stop falling back to `official.version/authorization`; record program `versions` and `institution.version` in `referenceContext`; use `program_egas` as the EGA master when defined; an Admin "publish PO reference version" action. **Required database changes:** none for the first four; the publish action writes the existing `program_po_reference_*` tables (which must exist in staging, i.e. the PO migration applied there: a separate authorization); a table only if Vision/Mission/EGA history is wanted. **Authorization needed:** the owner's decision on whether unversioned PO lists may be judged by V2; staging migration.

**Verdict B: NOT_READY for newly created programs** (works for the four existing programs because their POs equal the static JSON). Not implemented here by design: this release verification only audits and reports.

## Staging readiness (rechecked; nothing deployed, no paid call)

| Blocker | Status |
|---|---|
| Separate staging database | does not exist; owner-required |
| Separate Claude credentials | not created; the development `.env` still holds a key that must not be reused |
| Provider-side hard spend limit | unverifiable from the repository; owner must set it (recommended $5 for the smoke phase) |
| TLS / proxy | verified only as a staging-like local topology; real certificate, DNS and proxy log hygiene missing |
| Secret rotation | **still open**: `credential-readiness.cjs` on the development file reports 3 manual actions (staging `DB_PASS` not set, SMTP app password, Gemini key line) |
| Backup / restore | procedure documented and a full backup restore was proven for the PO activation; no staging backup job or rehearsal |
| Monitoring / alerting | only `/api/health` and per-run records; no alerting |
| Aggregate spending control | **gap**: only per-check reservations (120 requests, $10/$17 ceiling) and a 10/min per-user limit; no daily cap in the application; the provider-side limit is the only aggregate control |

## Distinctions

Existing four-program integration: verified offline (browser, SELECT-only reads of development). Newly created program integration: legacy path works, V2 CLO-PO does not (audit). Offline scripted AI verification: everything above. **Real-Claude verification: none** (the one-request smoke test is prepared and not authorized). Staging readiness: not ready (owner prerequisites). Production readiness: not assessed and not ready (no live verification, no formal VPAA approval of the corrected POs, no staging run).
