# Reconciliation: optimization report vs corrected-PO activation, current working tree

Verified 2026-11-05, 19:30 to 20:25 local, against the **current uncommitted working tree**. No migration was executed, no real faculty record or approved PO content was changed, no paid AI call was made, nothing was committed, pushed or deployed. The only database read outside an isolated scratch server was SELECT-only on the development database (`syllabus_cms_plus`) to resolve the PO references.

## 1. E18-E20 status (Task 1, 2)

The earlier report (FINAL-COST-REPORT.md section 9) was correct for the tree as it was then and is **superseded**. E18-E20 belong to another session's in-progress academic-year / subject-term / program-outcome-editing work (session "edit-outcomes-from-add-subject"; E21-E23 were added to `scripts/e2e/scenarios.cjs` while I worked).

| Sample | Tree state | E18 | E19 | E20 | Others |
|---|---|---|---|---|---|
| Earlier report, 3 runs | before 19:30 | fail | fail | fail | E01-E17 pass |
| Run A, flags OFF, full sequence | 19:30-19:44 | pass | **fail** | pass | E21, E22 pass, E23 fail |
| Run B, flags ON (warm-up, plan, fields), full sequence | same | pass | **fail** | pass | same as A |
| Run C, recommended flags, full sequence | after 19:56 | pass | pass | pass | **E01-E23 all 23 pass** |

Exact causes found:
* **Earlier E18/E20 failures.** Scenario text, `CourseOutcomes.jsx` and `SubjectActions.jsx` were being rewritten (the academic-year filter was removed from the subjects table and the scenarios were rewritten to match). The failures changed between runs while files changed on disk. They are not related to any cost flag: they failed identically with every flag off.
* **E18 in an `E2E_ONLY=E18,E19,E20` run** fails at "IT 205 Edit" and E20 with "faculty member has syllabi (0)": these scenarios depend on data created by E02-E10, so a partial run is not a valid test. Only the full sequence counts.
* **E19 (runs A and B)** timed out clicking the Semester option on a table the peer was reshaping (a new check "exactly one Semester filter" appeared mid-run); **E23** needed the "N learning outcomes" step of the Add Subject form, which was locked ("Finish step 1 first") while the form was unfinished. Both passed after the peer's `CourseOutcomes.jsx` change at 19:56.
* **Migrations.** The scratch database is built by the repository bootstrap (`init.js` plus every `migrate-*` script in `server/package.json`, which already lists `migrate-subject-term`, `migrate-academic-year-scope`, `migrate-catalog-year`). So the academic-year / subject-term schema is present in the test database; my earlier statement that "the migration was not run" for the scratch DB was wrong. No migration was run against the development database by me.

Test-infrastructure fixes (mine, tests only, kept): second servers started by K08 and E15 inherit `E2E_DB_PORT`; `run-comprehensive-ui.cjs` accepts `E2E_EXTRA_ENV`.

## 2. Corrected PO integration (Task 3), development database read-only

| Program | Physical POs | Resolved by the checker (`mastersFor`) | Source |
|---|---:|---:|---|
| BSIT (id 1) | 9 (pos_version 2) | **9** | BSIT |
| BSIE (id 15) | 13 (v3) | **13** | BSIE |
| BSCPE (id 16) | 13 (v3) | **13** | BSCPE |
| BSIT-CYBERSECURITY (id 17) | 0 (v3) | **9, source BSIT, curriculum BSIT 2022-2023 (53 courses)** | `program_outcome_sources` 17 -> 1 |

Eight `needs_review` remediation rows are intact: seven PO-mapping reviews (syllabus 43, 93, 97, 99, 100, 101, 102) and one curriculum review (110). No historical mapping was touched.

Under the corrected references (`scripts/optimization/po-parity.cjs`, a real course identity from each program's approved curriculum with SYNTHETIC content, masters read SELECT-only from the dev DB, scripted provider, in-memory DB):

| Program (course used) | Requests base -> optimized | Official | 7 VPAA NOT_CHECKED | CLO classifications | Corrected PO text in requests | Parity |
|---|---|---|---:|---|---|---|
| BSIT (IT 202) | 51 -> 51 | 85 / scored / passed, threshold 79 | 0 | 4 evaluated | yes | official, verdicts, six areas identical |
| BSIE (MA 9DE) | 51 -> 51 | 85 / scored / passed, 79 | 0 | 4 | yes | identical |
| BSCpE (MA 9DE) | 51 -> 51 | 85 / scored / passed, 79 | 0 | 4 | yes | identical |
| Cyber Security (IT 202, BSIT curriculum) | 51 -> 51 | 85 / scored / passed, 79 | 0 | 4 | yes (BSIT's 9) | identical |

(Note: a made-up course code is correctly reported NOT_CHECKED, `course_identity_reference_review`, and a synthetic vision/mission/EGA set correctly fails `INST-EXACT`; the parity script authors the synthetic syllabus against the real references so the check can complete.)

## 3. Optimization with the recommended settings (Task 4)

Settings: `SYLLABUS_CHECK_CACHE_WARMUP=on`, `SYLLABUS_CHECK_OUTPUT_PLAN=on`, `SYLLABUS_CHECK_OUTPUT_FIELDS=scoped`; grouping and prompt trim off; scoped course context off. Isolated MariaDB (port 3408, 16 MB packet), scripted provider. **All figures modeled; no provider-reported token usage exists, so no actual Anthropic saving is claimed.**

| Scenario | Requests (actual, scripted) | Est. output tokens | Reservation | Modeled charge | Cache hits / eligible | Verified / NOT_CHECKED |
|---|---|---|---|---|---|---|
| First check, V2 | 20 -> 20 | 112,566 -> 112,566 | $4.632 -> $4.540 (-2.0%) | $1.3135 -> $1.2659 (-3.6%) | 12/20 -> 17/20 | 220/7 -> 220/7 |
| Unchanged re-check | 0 -> 0 | 0 | $0 | $0 | n/a | reused |
| One-week revision | 2 -> 2 | 2,684 | $0.431 -> $0.366 (-15.1%) | $0.0481 -> $0.0481 | 0/2 | same |
| CLO revision | 3 -> 3 | 16,452 | $0.765 -> $0.765 | $0.2248 -> $0.2119 (-5.7%) | 0/3 -> 1/3 | same |
| Full comprehensive | 51 -> 51 | 139,135 -> 125,559 (-9.8%) | $13.303 -> $11.585 (-12.9%) | $1.7614 -> $1.5227 (-13.6%) | 42/51 -> 47/51 | 273/7 -> 273/7 |
| Description edited | 8 -> 8 | 14,021 | $1.696 -> $1.496 (-11.8%) | $0.1897 -> $0.1788 (-5.7%) | 4/8 -> 6/8 | same |
| Tight $6 (comprehensive) | 22 -> 25 | 50,772 -> 70,156 | $5.772 -> $5.784 | $0.699 -> $0.847 (more work done) | 16/22 -> 22/25 | 112/168 -> **148/132** (+36 checked) |
| $10 (comprehensive) | 35 -> 42 | 122,140 -> 118,145 | $9.046 -> $9.616 (under cap) | $1.504 -> $1.394 | 27/35 -> 39/42 | 218/62 -> **243/37** (+25 checked) |
| Tight $4.4 (V2 only) | 18 -> 18 | 109,696 | $4.220 -> $4.192 | $1.280 -> $1.232 (-3.7%) | 10/18 -> 15/18 | 206/21 -> 206/21 |

Request counts do not fall (the flags do not remove requests); input bytes fall only for output fields (-2.5% on comprehensive). The output-token reduction rests on an assumed ~8 output tokens per omitted structured field. Under capped runs the reservation stays below the cap and the freed room checks more relationships, so modeled cost rises there because more academic work is done, not because anything got more expensive per relationship.

Verified under the recommended flags:
* All seven VPAA relationship types and all four CLO classifications evaluated as often as in the baseline, same verdicts (`optimization.test.js` coverage test; browser K02/K03; `po-parity.cjs`).
* Official scoring parity, passing threshold 79, six areas, rule counts (47 rules / 11 reserved pending): identical (tests J, K08, E15, po-parity).
* Submission and approval gates, saved reports, revision protection (409/428), recommendations Accept/Edit/Reject/Undo, EN/TL, error and budget reporting: browser K01-K10, B01, E01-E23 pass.
* Incomplete checks: provider-down, grouped-fault and tight-budget tests report NOT_CHECKED and `incomplete` with no invented verdict.
* No unauthorized academic change: no rule, wording, PO content, reference or faculty record modified by the optimization; the only code touched is cost plumbing.

## 4. Test results (Task 5)

| Run | Result |
|---|---|
| `npm test` | **2,151 / 2,151 pass** (2048 + 22 + 47 + 16 + 18), 0 failed, 0 skipped, 0 cancelled. (The PO report's 2,144 was taken earlier; the count grows as the other session adds tests.) |
| `npm run test:vpaa` | conformance **276 / 276**, UI **18 / 18** (the PO report's 294 counts its own additional suites) |
| `npm run build` | passes |
| `optimization.test.js` + `po-reference-activation.test.js` | **27 / 27** |
| Browser comprehensive K01-K10, recommended flags | **10 / 10 pass** |
| Browser tight-budget B01 ($6), recommended flags | **pass** |
| Browser regression E01-E23, recommended flags (Run C) | **23 / 23 pass** |
| Browser regression, flags off / flags on, before the peer's 19:56 change (Runs A, B) | E19 and E23 fail identically (peer's in-progress work); E01-E18, E20-E22 pass |
| Real Claude | not run (not authorised) |

## 5. Recommended staging configuration

```
SYLLABUS_CHECK_CACHE_WARMUP=on
SYLLABUS_CHECK_OUTPUT_PLAN=on
SYLLABUS_CHECK_OUTPUT_FIELDS=scoped
# leave unset/off: SYLLABUS_CHECK_V2_GROUPING, SYLLABUS_CHECK_PROMPT_TRIM; SYLLABUS_CHECK_COURSE_CONTEXT=scoped optional (description-edit heavy use only, needs academic review)
```
Do not raise `SYLLABUS_CHECK_AI_MAX_COST_USD` (a reservation ceiling). First staging run must record provider-reported `output_tokens`, `cache_read_input_tokens`, and `max_tokens` stops before any saving is claimed.

## 6. Remaining blockers and risks

1. **Real-provider confirmation is still missing.** All savings are modeled; output-field savings assume ~8 tokens per field; cache behavior and answer lengths are unverified. Needs an explicitly authorised run.
2. **Tree is in flux.** The other session is still editing academic-year / subject-term / program-outcome-editing files and `scenarios.cjs`; Run C is a snapshot (20:14-20:25). Re-run the regression once that work is final.
3. **Not committed.** Everything is uncommitted; E2E scenario files shared with the other session (`scenarios.cjs` is untracked) contain my small E15 database-port edit, which the peer was told to keep.
4. **Pre-existing**: an unknown id in a batch reply can leave 1-2 neighbouring relationships NOT_CHECKED (conservative; nothing invented).
5. **Institutional**: formal VPAA approval of the corrected PO references is not recorded; Policy V2 and the comprehensive profile are still not enabled in the development runtime (per the PO activation report). The optimization flags are likewise default off.

## 7. Files changed this round

`scripts/optimization/po-parity.cjs` (new), `scripts/optimization/benchmark.cjs` (`recommended` config), `docs/checker-comprehensive/optimization/{po-parity.json, benchmark-results.json, RECONCILIATION-REPORT.md}`, UI evidence under `docs/checker-comprehensive/ui-verification/*-full-off`, `*-full-on`, `*-recommended`, `*-e18-20-off`.
