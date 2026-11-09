# RC7 offline regression report

Date 2026-11-06. Offline only: isolated synthetic databases, scripted provider, no paid requests. Nothing was committed, pushed, deployed or migrated.

**Verdict: rc7 is not ready for development activation. One genuine defect must be fixed first (section 3).**

Tested source: `4d7d1720a2692ece1b8fa8a23d6d9241de8a73238369ba81e8424d09c2221bb3` (805 source files). The live tree equalled the snapshot before and after every suite. No application source was changed during testing.

## 1. Results

| Suite | Result | Evidence |
|---|---|---|
| E01-E24, optimizations off | 23 / 24, E23 fails | `rc7-e-off.log` |
| E01-E24, recommended optimizations on | 23 / 24, E23 fails | `rc7-e-on.log` |
| K01-K10, as written | 9 / 10 in three runs, K08 fails | `rc7-k-run1.log`, `rc7-k-run2.log` |
| K01-K10, with a temporary test-only retry | 10 / 10 | `rc7-k-retry-on-429.log` |
| B01 | 1 / 1 | `rc7-b01.log` |
| Four-program PO workflow, off | 3 / 4 first run, 4 / 4 on retry | `rc7-po-baseline.log`, `rc7-po-baseline-retry.log` |
| Four-program PO workflow, on | 4 / 4 | `rc7-po-optimized.log` |
| Dynamic-reference integration | 21 / 21 | `rc7-integration.log` |
| Migration rehearsal | passed, 14 steps | `po-publication-rehearsal.json` |
| `npm test` | 2,175 passed, 0 failed | |
| `npm run test:vpaa` | 294 passed, 0 failed | |
| PO reference panel UI tests | 4 / 4 | |
| Build, localization audit | passed; 2,577 bilingual keys | |

## 2. Failures, classified

| Failure | Class | Finding |
|---|---|---|
| E23 | **Genuine application defect** | Section 3 |
| K08 | Test defect | The main server answered `429 You are checking too often. Try again in 3 seconds.` K01-K07 run several checks just before it and the scenario does not wait, so it fails whenever the suite runs fast. This explains the earlier intermittent failure: more free memory made the suite faster. The application's rate limit behaved correctly. With a test-only retry on 429, K08 passed all its parity checks. The retry was applied to the snapshot's test copy and removed afterwards; the repository scenario still needs it |
| PO baseline, BSIT | Unexplained single timeout | A 12-second wait for the program dropdown on the first page of that run. It passed on retry and in the optimized run, so it is not reproducible. It is recorded, not dismissed |

## 3. The defect: saved POs reach existing subjects without Apply to Subjects

**Observed:** E23's check "the existing subject keeps its own copy after the program is edited" fails with optimizations off and on. The check passed on rc6 and fails on rc7, because the policy change gave every program a version.

**Cause:** `inheritStandards` (`server/lib/programs.js:85`) replaces a subject's POs with the active version's POs on every subject read. That was built for the few official-reference programs. Now every program with saved POs has a version, so it applies everywhere.

**Conflict:** this contradicts the owner's decision to keep manual Apply to Subjects. `standards_json` itself is not overwritten, but subject reads show the new POs immediately.

**Likely wider effect (from reading the code, not observed in a test):**
* `forceStandards` uses the same read, so a faculty save of a draft could take the new POs before Apply to Subjects.
* `loadCourse` (`server/lib/courses.js:27`) refuses a subject whose catalog CLOs carry PO mappings once its POs differ from the version, until Apply to Subjects.

**Proposed fix (not applied; this authorization covers testing only):** keep the overlay for source versions and specializations, and leave a subject with an Admin-saved version on its own copy until Apply to Subjects. Add an integration test for it, because the current 21 did not catch this.

## 4. Admin reference workflow

Verified through the real API on an isolated database (integration test), and in the browser where E23 reached it.

| Requirement | Result |
|---|---|
| Admin creates an academic year, a program, and saves POs | pass |
| The correct PO version becomes active at once, with who and when | pass |
| Saving identical POs makes no version; a stale screen is refused; faculty get 403 | pass |
| The previous version stays unchanged; the log has the previous and the new version | pass |
| Admin edits EGAs; the before and after are logged; the new statement reaches the checker | pass |
| Vision and Mission saves are logged | pass |
| A copied catalog keeps the same version; saving there makes that year's own version | pass |
| A changed PO re-asks CLO-PO only; a changed EGA re-asks CLO-EGA and reuses CLO-PO | pass |
| A version altered in the database is refused | pass |
| No PO-to-EGA mapping is invented (P-03 NOT_CHECKED) | pass |
| Existing subjects unchanged until Apply to Subjects | **fail, section 3** |

## 5. New programs

Programs created by the Admin, with 5 POs and with 3 POs, were recognized with no checker change. Every CLO-PO relationship was judged by the scripted provider, none was assumed aligned, and each report named its own version. A program with no POs stays NOT_CHECKED. Claude behavior itself was not tested: the provider is scripted.

## 6. Existing programs

Browser workflow, off and on: BSIT 9 POs, BSIE 13, BSCpE 13, BSIT-Cyber Security 9 from BSIT, each score 99 against threshold 79. An Admin save to BSIT supersedes and preserves its source version, Cyber Security follows it, and its curriculum source stays BSIT.

## 7. Scoring parity and saved reports

* The PO workflow gives identical programs, counts, sources and scores with optimizations off and on.
* K08, with the test-only retry, passed profile on, profile off and V2-only parity, and older saved reports still open.
* The integration test confirms the official result is identical with flags off and on, and threshold 79 holds.
* Saved reports name the version they ran under and are not rewritten. A syllabus authored under an earlier version is refused for checking until reviewed, rather than re-scored.

## 8. Remaining UI defects and limits

* No Curriculum Management screen (separate feature, decided by the owner).
* Saving in the reference panel area reloads the outcomes dialog, which drops unsaved EGA and PO edits above it.
* Faculty are blocked at Step 1 when a subject has no Admin-set pre-requisite, with a message they cannot act on.
* The Add program read-only Vision/Mission state with an empty EGA list has not been exercised in a browser.

## 9. Database activation requirements

1. Written authorization naming `syllabus_cms_plus`.
2. Backup and restore verification.
3. The migration, then `VERIFIED` from the check tool.
4. Raising `max_allowed_packet` from 1 MB to 16 MB (prepared in `DEV-DATABASE-PACKET-CONFIG.md`, not applied).

## 10. Recommendation

Do not activate rc7. Authorize the source fix for section 3 and the K08 test fix, freeze rc8, and rerun the full regression. Reconsider activation preparation only if rc8 passes with no test-only changes. This is not a production-readiness statement: staging prerequisites and real-Claude verification remain outstanding.
