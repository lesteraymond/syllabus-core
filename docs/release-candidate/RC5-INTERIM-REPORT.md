# rc5 interim integration run (2026-11-06): NOT a release candidate

rc5 = the rc4 full working tree plus three edits of mine. It was captured to learn how the tree behaves with the completed Builder Step 1 lock. **It is not the final freeze**: the session that owns Builder Step 1 and the Admin program/subject files says those files are still moving (`AddProgramForm`, `SubjectSetup`, `VisionMissionFields`, `OutcomesFields`, `CourseOutcomes`, `i18n/extra.js`), and its edits to E22/E23 had never been run.

Source hash `b645d43269ee6a8a62011c73016f39760add56c8f6d1a5a1707f9510fda9309a` (805 source files). The live tree was verified equal to this snapshot before and after the runs; the only files that differ from rc4 are:

| File | Change (all mine) |
|---|---|
| `scripts/e2e/scenarios.cjs` (E02 only) | The administrator sets IT 204's term (semester, year level, pre-requisite) through `PUT /courses/10` first; the faculty step then asserts Year level and Pre-requisite are read-only and pre-filled instead of typing them. |
| `scripts/e2e/scenarios-comprehensive.cjs` (K01 only) | Same change. |
| `src/components/ProgramOutcomesEditor.jsx` | Mounts `PoReferencePanel` (one import, one line) above the "Apply to subjects" block. It shows "not set up" until the publication tables exist, and publishes nothing. |

Later, uncommitted and not part of rc5: `scripts/po-controlled-activation/checker-browser.cjs` now reads the Program Outcomes that Step 2 shows to faculty as read-only text (`.refi`), because the builder no longer renders them as editable `.ie-po` textareas.

## Results

| Run | Result |
|---|---|
| `npm test` | 2,177 passed, 0 failed |
| `npm run test:vpaa` | 294 passed, 0 failed |
| `npm run build` | passed |
| E01-E24, optimizations off | 20 / 24; E20, E22, E23, E24 fail |
| E01-E24, optimizations on | 20 / 24; the same four fail |
| K01-K10 (recommended flags on) | 10 / 10 on the second and third runs; **one K08 failure on the first run** (see below) |
| B01 | 1 / 1 |
| Four-program PO browser workflow | **not completed**: see "Infrastructure" |

**E02 and K01 now pass**, which is the failure that blocked rc4.

## The four E-failures belong to the unfinished Admin/Step 2 work, not to the checker

| Scenario | Failed checks | Cause |
|---|---|---|
| E20, E24 | Program & Subjects academic-year control, "current" tags, closed-year filter wording ("2028-2029") on all pages | The other session's new `AcademicYearControl` and academic-year UI; the scenarios still expect the earlier layout, or the new layout is not finished. |
| E22 | "the Add program form shows the school vision and mission as soon as it opens" | `AddProgramForm.jsx`, still moving; its E22/E23 selector edits were never run. |
| E23 | "Step 2 of the builder shows the EGA the administrator typed" | Step 2 now shows the EGA and POs to faculty as read-only text (`ClosStep.jsx`, `lockStandards`), which `src/lib/facultyLock.test.js` calls intended; the scenario still looks for an editable input. |

None of these involves the checker, scoring (threshold 79), the PO reference code or my migration. They need either the other session's finished UI plus updated scenarios, or the user's decision on who edits the scenarios (the other session asked the user and has no answer).

## Open item: one unexplained K08 failure

K08's first run (right after two full E-suites) failed: "all three servers produced a run on the same syllabus", with a TypeError reading `.hybrid` of an undefined run. Two reruns of the whole K suite on the same snapshot passed 10 / 10 with a debug line that would have printed the recheck response, and it never printed. I could not reproduce it, so it is recorded as an unexplained intermittent failure, not as a pass. The final regression must show K08 passing repeatedly.

## Infrastructure

* The PO browser workflow (baseline) ran once with the updated harness: BSIT passed; BSIE then timed out for 120 s and BSCpE and BSIT-Cyber Security failed to load, because my isolated MariaDB (pid 18312) **disappeared without a shutdown message** while the machine had about 400-600 MB free. A rerun then failed at bootstrap (nothing was listening on port 43310). The files are renamed `rc5-po-baseline.log.INVALID-database-lost` and `rc5-po-optimized.log.INVALID-stale-before-harness-update`. This is an infrastructure loss, not an application result.
* Memory is the limit: "Memory Compression" held 1.8 GB and the browsers, Spotify and Defender the rest, leaving less than the roughly 1.2 GB a browser suite needs. I did not close any of your applications and I did not start another test. Free memory first.
* My isolated database is not running. The shared development server (pid 10312) was not touched.

## What decides the final freeze

1. The other session finishes the Admin files above and Builder Step 2/Step 1 and says so; the user decides who updates E20/E22/E23/E24.
2. Re-hash, freeze (rc6), and run the whole regression once, with 1.2 GB or more of free memory: unit tests, build, E01-E24 off and on, K01-K10 (K08 repeatedly), B01, the four-program PO workflow off and on, the integration test.
3. Only then compare with the activation checklist.

Nothing was committed, pushed, deployed, migrated or published; no paid model call was made.
