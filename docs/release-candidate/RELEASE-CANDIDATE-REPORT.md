# Release-candidate verification and staging preflight

Date 2026-11-05. **Verdict: BLOCKED_WITH_REASONS** (section 10). Everything below is **offline verification**: scripted provider, synthetic data, isolated database. **No real-provider verification of any kind exists.** No paid request, migration (the browser runs used pre-provisioned copied schemas with DDL blocked), real faculty-record change, commit, push or deployment was performed.

## 1. Source stability

| Item | Value |
|---|---|
| Git HEAD | `4d30dcb74ff5794ab51cdc503a2e27fae1aa27d1` (the work is entirely uncommitted) |
| Earlier frozen snapshot (other session, `docs/e2e-stability-2026-11-05`) | source hash `6a55a8c7…19380a`, 783 files |
| **This release candidate: `rc2`** | **source hash `4d6aacec578613604e182d4f6e026fc5b3578ae4af035eb4d8b5b0a13a18aa68`**, 788 source files (package files, public, scripts except `scripts/release/`, server, shared, src, tests, vite.config.js); tree hash `d440324e…`; 2,001 files copied to `tmp/release-candidate/rc2` |
| Working tree vs `rc2` at the end | identical (`snapshot.cjs verify rc2`: `sourceUnchanged: true`) |
| `rc1` (hash `0dba17e8…`) | superseded: the other session made further edits (`scenarios.cjs` E24, `academicYearScope.js`, `extra.js`) before declaring its source final; rc1 browser results are kept as supplementary evidence only |

Drift of the current tree against the earlier verified snapshot (`scripts/release/source-compare.cjs`, `source-compare-1..4.json`): **added** `AcademicYearControl.jsx`, `academicYearScope.js` (+ test), the stability scripts; **changed** `AcademicYearScope.jsx`, `Topbar.jsx`, `CourseOutcomes.jsx`, `i18n/extra.js`, `styles.css`, `scripts/e2e/scenarios.cjs` (now E01-E24), `tests/i18n-ui.test.jsx`; **removed** `CurrentAcademicYear.jsx`. By area: **Subject management / academic-year UI and localization only.** Nothing changed in AI Checker services, Academic Policy V2, Program Outcomes, curriculum resolution, database schema or saved reports, and the cost optimizations are as verified (`costPlan.js` hash unchanged). My own changes since then: the live-test fixtures/runner (Case E, extra evidence fields; `scripts/live-claude/*`, `live-claude.test.js`) and release tooling. Unrelated changes by other sessions were preserved; I wrote nothing into their files, ports or evidence folders.

Coordination: the other session (`merge-academic-year-controls`) was edited-in-flight three times while I worked; I froze copies so its edits could not invalidate runs, and each run records the working-tree source hash before and after (`workingTreeSourceUnchangedDuringRun`).

## 2. Regression results

| Run (all on the frozen snapshot, isolated synthetic DB, scripted provider) | Source hash | Result |
|---|---|---|
| `npm test` | rc2 | **2,153 / 2,153 pass** (2048 + 22 + 49 + 16 + 18), 0 failed, 0 skipped, 0 cancelled |
| `npm run test:vpaa` | rc2 | conformance **276 / 276**, UI **18 / 18** |
| `npm run build` | rc2 | passes |
| Browser **E01-E24, optimizations OFF** | rc2 | **24 / 24 pass**, 0 failed checks, tree unchanged during the run |
| Browser **E01-E24, recommended optimizations ON** | rc2 | **NOT COMPLETE: the run was killed by the operating-system memory reaper at about E10** (log `rc-regression-on.log` is partial). Not restarted (rule: no restart after a memory kill without being asked) |
| Browser comprehensive K01-K10 (ON) | **rc1** (`0dba17e8`) | 10 / 10 pass; **not repeated on rc2** |
| Browser tight-budget B01, $6 (ON) | **rc1** | 1 / 1 pass; **not repeated on rc2** |
| Four-program PO integration **browser** tests (`checker-browser.cjs`, OFF and ON) | none | **NOT RUN** on this candidate (the other session's run on the earlier snapshot passed 4/4 OFF and 4/4 ON; that result is for that older hash) |

Because the instructions require the candidate to be tested as one stable hash, **only the three unit/build commands and E01-E24 OFF are valid for rc2; the rest is missing or on rc1.** The release-candidate result is therefore incomplete, not failed.

## 3. Corrected PO integration (development database, SELECT-only; `po-parity-rc2.json`)

BSIT **9** POs (source BSIT); BSIE **13** (BSIE); BSCpE **13** (BSCpE); BSIT-Cyber Security **9, source BSIT, BSIT 2022-2023 curriculum** (`program_outcome_sources` 17 -> 1). Eight `needs_review` rows intact: seven PO-mapping reviews (syllabus 43, 93, 97, 99, 100, 101, 102) and one curriculum review (110). No historical mapping touched. Run from the rc2 snapshot with a real approved-curriculum course identity per program and synthetic content: **51 requests both baseline and optimized**, official **85 / scored / passed, threshold 79**, **0 NOT_CHECKED** among the seven VPAA types, **4 CLO classifications evaluated**, the corrected PO text present in the requests, official outcome, verdicts and six areas identical between baseline and optimized, in all four programs. The activation is development-only; formal VPAA approval is `not_recorded`.

## 4. Academic evaluation coverage (offline)

Seven VPAA relationships and four CLO classifications each evaluated independently under every flag (`optimization.test.js`, 21 tests: coverage, grouped faults, output fields; part of the 2,153); CLO-to-PO semantic context reaches the requests (`CLO-PO`/`CLO-anyPO` pairs carry the program's resolved PO text; po-parity above); official score, 79 threshold, 47 rules / 11 reserved pending, submission and approval gates unchanged (E05, E10, K03 and the unit suites); saved report round trip and revision protection 409/428 (E01-E24 OFF; K10 on rc1); historical protection (eight reviews intact above; no write to the development database); incomplete checks report `NOT_CHECKED`/`incomplete` with no invented verdict (tests G, H, I; E12, K07, B01 on rc1). **Real-Claude accuracy of any verdict: not verified.**

## 5. Staging security preflight

Full table in `STAGING-PREFLIGHT.md`. Summary of the 12 items: **verified offline** - CORS/cookie rules (preflight READY 16/16 on a stand-in file), secure logging in code (no request/header/key logging; key redaction), `max_allowed_packet` handling (507 `report_too_large`; readiness script reads it; E2E ran on a 16 MB server), report sizing, application request/cost guards per check. **Owner-required, cannot be seen from the repository** - separate staging database, separate Claude key and workspace, provider-side hard spend limit and alerts, TLS/proxy/DNS, backup job and restore rehearsal. **Gaps** - no daily or aggregate spend cap in the application (real dollars are bounded only by the provider-side limit), no alerting or metrics, no proxy log configuration; **the development `.env` still holds live secrets to rotate** (SMTP app password, a Gemini key line, a short session secret). Nothing was created or changed.

## 6. Recommended configuration (cost caps unchanged)

```
SYLLABUS_CHECK_CACHE_WARMUP=on
SYLLABUS_CHECK_OUTPUT_PLAN=on
SYLLABUS_CHECK_OUTPUT_FIELDS=scoped
# unset / off: SYLLABUS_CHECK_V2_GROUPING, SYLLABUS_CHECK_PROMPT_TRIM, SYLLABUS_CHECK_COURSE_CONTEXT
SYLLABUS_CHECK_AI_MAX_REQUESTS=120          # unchanged
SYLLABUS_CHECK_AI_MAX_COST_USD=10           # unchanged (V2 staging); the comprehensive profile test needs 17 per its own plan and is a separate authorization
# SYLLABUS_CHECK_ACADEMIC_V2 stays unset/off in the ordinary development environment; on only in the explicitly authorized staging file
```
Verified by `vpaa-v2-preflight.cjs` (16 / 16 PASS on a stand-in staging file carrying exactly these settings) and by the E2E runs above (OFF explicitly sets all six cost flags to `off`; ON sets only the three recommended). Modeled benefit (not billed): first check about -3.6 %, full comprehensive about -13.6 % charge, reservation -12 % (see `docs/checker-comprehensive/optimization/`). Nothing was changed in any real environment file.

## 7. Real-Claude smoke-test plan (prepared, not executed)

`SMOKE-TEST-PLAN.md`. One request, `claude-sonnet-5-5`, 8 real academic relationships (week 1's seven VPAA types and the classification of CLO 1) over **Case E**: the approved identity BSIT IT 202 with invented syllabus text. Collects provider-reported input/output/cache-creation/cache-read tokens, model returned, stop reason (truncation/refusal), schema validity, verbatim evidence checking, status, and the calculated cost at list prices, bundled-reference prices and the guard's charge. Hard limits: 1 request, **$0.30** real-spend guard, 20,000 output tokens, spend register. Dry-run against the scripted provider passes 9/9 checks; `live-claude.test.js` 9/9. One request proves transport and schema only, not the comprehensive profile (section 6 of the plan lists what it does not prove).

## 8. Estimated maximum financial exposure

| Scope | Exposure |
|---|---|
| This work so far | **$0** (no paid call) |
| Smoke test, if authorized | **at most $0.30** (guard), expected about **$0.08** (range $0.05-0.12); worst-case in-app reservation of the single request $0.247 |
| Project register | $10 cap, $2.92 used, **$7.08 remaining** (guard-enforced for the test runner) |
| Tier-2 full runs (separate authorization) | default guards $2.00 (V2) / $3.50 (comprehensive) per run, within the register |
| A deployed staging server | **not bounded by the application beyond per-check reservations (120 requests, $10 or $17 reservation ceiling per check; real cost per V2 check about $1.4, comprehensive about $1.8 modeled) and a 10-checks/minute/user limit; the provider-side hard limit is the only aggregate control.** Without it, exposure is unbounded in principle. Recommended: a dedicated workspace with a **$5** monthly hard limit for the smoke phase |

Pricing caveat: the cache-read price is $0.10 in the repo table and $0.20 in the bundled reference (guard uses the higher); prices were not checked against the live pricing page.

## 9. Remaining institutional and owner approvals

Formal VPAA approval of the corrected POs (`not_recorded`); Vision/Mission/EGA authoritative-source review; PO-EGA crosswalk (P-03 stays NOT_CHECKED); the seven PO-mapping reviews and one curriculum review by faculty; written G1 (staging deployment) and G2 (live-Claude spend) authorizations; separate authorization for staging migrations and the PO reference rollout; provider workspace and limit; decision on a daily application spend cap.

## 10. Final verdict: BLOCKED_WITH_REASONS

1. **The release-candidate regression is incomplete on a single stable hash.** For `rc2` (`4d6aacec…`): unit suites, vpaa and build pass and E01-E24 OFF passes, but **E01-E24 with optimizations ON was killed by the memory reaper at ~E10**, and K01-K10, B01 and the four-program PO browser tests have **not** been run on rc2 (K/B passed only on the superseded rc1). Needed: re-run the three missing browser runs on rc2 (about 40 minutes, one at a time, with free memory above about 1.2 GB and no other heavy browser session), or declare a new freeze if the other session edits again.
2. **Staging prerequisites do not exist** (database, credentials, provider limit, proxy/TLS, backups, monitoring) and the PO reference rollout to staging is not authorized.
3. **Application gaps:** no aggregate spend cap, no alerting.
4. **Real-provider verification is entirely absent.** Nothing here shows Claude behaves as the scripted double does.
5. Secrets in the development `.env` need rotation.

It becomes **READY_FOR_CONTROLLED_STAGING_PREPARATION** when item 1 is closed on a stable hash (items 2-5 are preparation work for the owner, not blockers to *preparing* staging). The earlier snapshot of the other session (`6a55a8c7…`) passed the full set 23/23 OFF and ON with K/B/PO, and the cost-optimization code is unchanged since, which makes a clean re-run likely, but that is an expectation, not a result.

## Resuming

Snapshot `tmp/release-candidate/rc2` (with its junctions and its isolated database datadir, currently **shut down cleanly**) is kept. To resume: start mysqld on port 43310 with `--datadir=tmp/release-candidate/rc2/tmp/po-checker-integration/db/data --max_allowed_packet=16M`, then run `node scripts/release/run-suite.cjs rc2 regression on`, `comprehensive on`, `budget on`, `po off`, `po on` one at a time (driver: `scripts/release/run-suite.cjs`), verifying `node scripts/release/snapshot.cjs verify rc2` before and after each. Clean up with `snapshot.cjs clean rc2`.

## Files (this task; all uncommitted)

New: `scripts/release/{snapshot.cjs, source-compare.cjs}`, `docs/release-candidate/*`. Modified: `scripts/live-claude/{fixtures,live,readiness}.cjs` (Case E, evidence fields), `server/lib/syllabuscheck/live-claude.test.js`, `docs/checker-comprehensive/live/fixtures/case-e.json` (new). No application code, rule, PO content, scoring, configuration or database was modified.
