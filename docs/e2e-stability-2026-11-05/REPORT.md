# E2E stability and AI Checker readiness

**Offline results apply to the frozen source snapshot, not the subsequently edited working tree.** No AI Checker feature or academic policy was added. No database migration, real faculty write, paid/live Claude request, commit, push or deployment was performed.

## Exact source and concurrency

Git base HEAD: 4d30dcb74ff5794ab51cdc503a2e27fae1aa27d1. Tested source SHA-256: **6a55a8c755b72a8de7c16e629b3afc98978103cd6f31891f7317a7f90b19380a**, covering 783 source/test/config files. Full file hashes and installed dependency manifest hashes are in [tested-source.json](tested-source.json); selected hashes are in [relevant-hashes.json](relevant-hashes.json). Snapshot: `C:\Users\JP Del Rosario\Syllabus-Repository\tmp\e2e-stability-2026-11-05\source-1793883247019`. Node v26.12.1; local MariaDB10.4.32; Edge via playwright-core. Existing dependency directories are junctions; their manifest hashes and all frozen source hashes were verified between runs. No dependency install was performed.

A source file changed during the first capture, which was rejected. The user subsequently confirmed the other session had finished; hashes initially matched. **Further writes were then observed** in the files below. They were preserved and never copied back over the tested snapshot. [Current source differences](source-drift.json).

- scripts/e2e/scenarios.cjs
- src/i18n/extra.js
- src/styles.css
- src/views/CourseOutcomes.jsx
- tests/i18n-ui.test.jsx
- new: src/components/AcademicYearControl.jsx

The initial and final full uncommitted inventories are [git-status.txt](git-status.txt) and [git-status-final.txt](git-status-final.txt). Final status totals include task-created snapshots/artifacts: 102 modified tracked paths, 1 deleted tracked paths, 12980 untracked files. Pre-existing checker, catalog, auth, UI, localization, tests and documentation changes remain in place. Their full path list is supplied rather than attributing another session's edits to this task. **The current working tree is not certified by these frozen-snapshot results.**

The isolated build explicitly sets VITE_NEW_BUILDER=true, matching the checked development configuration, and blanks the Google identifier. Private .env files were not copied or changed. The checked-in safe server/.env.example was retained. Unit security tests used the original repository's read-only Git metadata with GIT_WORK_TREE set to the snapshot and optional locks disabled; no security assertion was skipped. [Build configuration](build-configuration.json).

## E19: cause and final status

The earlier failure stopped while locating the 2nd Semester option. It was a UI selection/timing symptom during unfinished subject-management work; it supplied no evidence of a PO, model, scoring, database-schema or optimization failure. The earlier whole-tree source state was not pinned, so **the exact historical event cannot be conclusively reconstructed**. Scroll-dismissal is consistent with the prior settled-scroll probe and Select's existing outside-scroll behavior, but is not promoted to a proven historical root cause.

On this finished snapshot, E19 runs only after E18 has created IT306 with its semester/year-level fixture. It asserts exactly one Semester filter. Browser traces show scrollY0, one control opening All semesters / 1st Semester / 2nd Semester, selection and combined filtering succeeding. E19 passes in the complete OFF and ON suites, including mobile checks. No isolated E19 run, retries that conceal a failure, product dropdown rewrite or academic change was used. [Full case receipts](e19-e23-results.json). Historical-trigger uncertainty remains a diagnostic limitation; no current E19 failure was reproduced.

## E23: cause and final status

The former fixture saved metadata only and attempted to enter Step2 while Step1 still lacked curriculum year and a description. The Builder's existing gate correctly refused navigation. This was an **incomplete fixture**, not an AI/PO/optimization defect. The finished subject-management test source fills both fields before Step2; that owner-authored correction was preserved. E23 now passes OFF and ON after E20–E22 establish academic-year/catalog dependencies. Assertions verify masters reach the faculty subject/Builder and later changes reach it only through the existing Apply to subjects action. No application gate was weakened.

## Final tests on the sealed snapshot

| Automated command/suite | Passed | Failed | Skipped | Todo |
|---|---:|---:|---:|---:|
| npm test | 2152 | 0 | 0 | 0 |
| npm run test:vpaa | 294 | 0 | 0 | 0 |
| npm run build | build passed | 0 | 0 | 0 |
| Focused PO integration | 15 | 0 | 0 | 0 |
| Cost optimization | 21 | 0 | 0 | 0 |

| Browser suite | Scenarios passed | Failed | Assertions passed |
|---|---:|---:|---|
| final-off | 23/23 | 0 | 377/377 |
| final-on | 23/23 | 0 | 377/377 |
| comprehensive-on | 10/10 | 0 | 287/287 |
| budget-on | 1/1 | 0 | 37/37 |
| po-off | 4/4 | 0 | program cases |
| po-on | 4/4 | 0 | program cases |

All completed final automated suites have zero cancelled tests. Counts overlap; do not add them as unique coverage. Full E01–E23 executions use fresh DATA fixtures in existing copied synthetic schemas, not independent E19/E23 runs. The earlier valid baseline OFF run also passed23/23. Final OFF and ON runs use the same sealed source, schema shape and stand-in provider. [Exact results and logs](test-results.json).

Initial harness-only problems were recorded and corrected: a private-config-free build initially selected the legacy Builder, and the first unit attempt lacked the tracked example/Git context. Those attempts are not treated as application regressions or final passes. A pure offline PO test imported a module that eagerly read private development configuration; this task fixed that test-helper dependency by loading configuration only when the actual read-only audit is called. Build warnings are non-fatal bundle/timing notices.

## Corrected PO and score parity

Development was inspected through read-only transactions at localhost:3306 / syllabus_cms_plus. Exact counts, statement text, numbering/order and version lcup-po-2026-10-29 still match the canonical reference. Three canonical sources serve four selections; Cyber preserves its identity and resolves BSIT curriculum reference1. [Before](development-before.json), [after](development-after.json).

The four-program browser workflow uses public approved-reference copies and explicitly synthetic syllabus/mapping choices. It verifies selection, subject resolution, valid mapping options, shared checking, report storage/reload and faculty/admin presentation.

| Program | POs | PO source | Faculty OFF/ON | Admin OFF/ON |
|---|---:|---|---|---|
| BSIT | 9 | BSIT | 99/99 | 99/99 |
| BSIE | 13 | BSIE | 99/99 | 99/99 |
| BSCPE | 13 | BSCPE | 99/99 | 99/99 |
| BSIT-CYBERSECURITY | 9 | BSIT | 99/99 | 99/99 |

All score comparisons retain threshold79. The 47 registered / 44 direct Hybrid-2 rules, weights20/20/20/15/10/15, authorized legacy deductions/secondary-tag treatment, seven VPAA types, four CLO classifications and submission/approval policies remain unchanged. Existing backend findings distinguish verified semantic judgments from missing/unverified evidence. [PO parity](po-parity.json).

## Policy V2, optimization, incomplete checks and budgets

Ordinary development Policy V2 and the comprehensive profile remain OFF/unset; the shared server environment hash is unchanged. Only isolated test processes enable Policy V2/the comprehensive-testing profile. OFF explicitly disables CACHE_WARMUP, OUTPUT_PLAN, OUTPUT_FIELDS, COURSE_CONTEXT, V2_GROUPING and PROMPT_TRIM. ON changes only the recommended CACHE_WARMUP=on, OUTPUT_PLAN=on and OUTPUT_FIELDS=scoped; optional course-context/grouping/trim remain off. Unit optimization tests additionally exercise their existing options. No optimization feature or provider-side spending limit was added or raised.

K01–K10 verify seven independent VPAA types, four structural/semantic classifications, saved reports, stale reports, recommendation safeguards, permissions, score parity and stale-tab409 handling. K07 and B01 verify model/budget-unavailable findings remain incomplete/NOT_CHECKED. B01 preserves the $6 reservation cap. The comprehensive/PO harness uses the existing $100 OFFLINE reservation allowance solely for stand-in coverage, not a live spending permission. Reported provider requests are in-process scripted responses; no real billing/cache savings or academic accuracy is claimed.

## Database and historical safeguards

No bootstrap or migration script was executed. Existing previously provisioned synthetic schemas were copied to the snapshot's own MariaDB datadir on port43310; data-only resets verify identity and schema shape. E2E_SKIP_BOOTSTRAP=1 and a guard reject CREATE/ALTER/DROP/TRUNCATE/RENAME in browser/API connections, including nested API instances. No schema gap was silently repaired. No real syllabus content was copied into those test schemas. The owned port43310 server was shut down after verification; development and other sessions were left running. [Shutdown receipt](isolated-shutdown.json).

The seven PO mapping reviews and one curriculum review remain needs_review; old PO10 is not remapped to PO9. Historical reports/decisions, approvals and faculty content are preserved. Data comparison and any unrelated usage-table drift are reported precisely in [database-preservation.json](database-preservation.json); no whole-database-unchanged claim is made if another session changed a table.

## Institutional and real-Claude dependencies

The corrected BSIT, BSIE and BSCpE reference versions contain no approved PO–EGA crosswalk; Cyber inherits the same BSIT limitation. Focused tests verify P-03 is NOT_CHECKED/unverified for all four selections. Any older BSIT crosswalk cannot be assumed valid for the corrected version. No crosswalk was invented. Formal VPAA approval of corrected POs is still not_recorded. Source-document verification and development activation are not formal academic approval. Vision, Mission and EGAs were not replaced; their separate authoritative-source approval review remains outstanding. The eight faculty/curriculum reviews were not resolved.

Real Claude network authentication, model availability, cache behavior, billing and academic accuracy remain **NOT VERIFIED**. A controlled live run still needs explicit authorization for its environment/text, an authorized pinned model/key, provider-side spend controls, existing request/token limits, approved synthetic/public inputs, and the existing guarded smoke/evidence procedure. Current PO activation authorization covers DEVELOPMENT ONLY; it does not authorize a staging reference rollout.

## Readiness recommendation

The pinned snapshot is an **offline integration candidate**, subject to the completed result table above. **Do not certify or deploy the latest working tree for staging:** it changed after the source freeze. Reconcile the listed changes with the owning session, freeze the final tree and repeat the relevant checks against that exact state before a staging decision. No real Claude verification, formal academic approval, production readiness or deployment authorization follows from mocked tests. Production compliance remains blocked by the academic/reference approvals and unverified live integration. No migration, paid call or deployment is scheduled.

Task-owned changes and evidence are listed in [files.json](files.json).
