# LCUP production PDF importer fixes

Status: implemented and verified locally, ready for review. No commit, push, merge, migration or deployment. Existing uncommitted work was preserved. No live database connection or paid AI call was made.

## Changes and root causes

| Defect | Root cause | Focused correction |
|---|---|---|
| Lost CLO–PO links | A single regex match stopped at a repeated PO label; ranges were read as endpoints. | Collect every repeated PO/EGA annotation, expand inclusive ranges and deduplicate numbers. Unknown, descending or unfinished ranges remain in review evidence and block Apply rather than disappearing. |
| Lost/merged ILOs | Boundaries required punctuation and line starts. Untagged text inherited its neighbor's mappings. | Recognize inline/unpunctuated ILO/LO labels; preserve unlabelled prefixes and prose following a final CLO annotation as separate review candidates. No missing tag is inferred. Inclusive ILO–CLO ranges are retained. Ambiguous boundaries and untagged lesson outcomes show faculty-review warnings. |
| Silent prerequisite replacement | Any nonblank PDF value replaced the current draft value. | Default to preserving the current value. Show both values and require an explicit Keep/Replace choice before Apply. Bind that choice to the exact current/PDF values; edits invalidate it. Blank PDF values never clear an existing prerequisite. |
| BSIT/Cyber IT202 collision | Comparison removed code punctuation without considering program, curriculum or title. A conflicting title only warned. | Add read-only server context containing the selected catalog subject and its program's approved curricula. Preview and Apply validate selected subject/program, applicable curriculum year, unique code and title together. Missing/ambiguous context or conflicting identity blocks Apply. BSIT IT202 cannot import into Cyber IT-202. |

Additional prerequisite-related correction: text-PDF source streams delimit description/prerequisite before y-sorting can move superscript `th` into IE402's description. Ordinal superscripts are rejoined to their number. No faculty wording is corrected or rewritten. Table recovery, OCR, checking rules and scoring were not redesigned.

## Exact source/test files changed

Modified:

1. `src/lib/pdfImport.js` — use shared reference/boundary parsing, conflict review, and `preparePdfImport` for application guards.
2. `src/views/builder2/UploadPanel.jsx` — identity-aware preview, explicit prerequisite choices, local blockers and review warnings.
3. `src/views/builder2/index.jsx` — retain server preview context and revalidate before saving; preserve existing save/retry/check order.
4. `src/i18n/pdfImport.js` — English/Filipino review and error messages.
5. `server/routes/pdfImport.js` — attach read-only identity context after existing ownership/status/assignment rechecks.
6. `server/lib/pdfImport.worker.js` — bounded source-stream description/prerequisite extraction, including superscripts.
7. `server/routes/pdfImport.routes.test.js` — assert the augmented preview contract and retain no-write/authorization checks.
8. `tests/pdf-import-ui.test.jsx` — real identity context in existing mocks; prerequisite decisions, edit invalidation, cross-program/missing-context blockers.
9. `scripts/lcup-approved-offline/importer-regression.test.mjs` — convert six verified defect reproductions to corrected-behavior expectations.
10. `scripts/lcup-approved-offline/extract.mjs` — optional non-persisting extraction for regression tests.
11. `scripts/lcup-approved-offline/fixture.test.mjs` — compare fresh immutable source/geometry without overwriting the historical worker snapshots. Corrected worker fields are checked separately.

Added:

12. `src/lib/pdfImportReview.js` — pure import-only identity, mapping, ILO-boundary and prerequisite helpers.
13. `src/lib/pdfImport.fixes.test.js` — focused corrections and actual-PDF preview/Apply verification against the frozen fixtures.
14. `server/lib/pdfImportIdentity.js` — two SELECT-only queries for selected subject and approved curricula, with no outcome or record writes.
15. `server/lib/pdfImportIdentity.test.js` — program scoping, missing references and read-only behavior.

New review artifacts are confined to `docs/lcup-importer-fixes/`: this report, `before.json`, `verification.json`, and test logs (`old-expectations.log`, `offline29.log`, `existing19.log`, `targeted.log`, `ui.log`, `real-pdf-verification.log`, `i18n.log`). The verification manifest records the complete artifact list and before/after hashes for changed pre-existing files. No existing documentation or protected evaluation artifact was overwritten.

## Executed verification

All commands below completed successfully on the final implementation:

| Command | Result | Log |
|---|---|---|
| `node --test scripts/lcup-approved-offline/importer-regression.test.mjs scripts/lcup-approved-offline/fixture.test.mjs scripts/lcup-approved-offline/baseline.test.mjs` | 29 passed; 0 failed/skipped | [offline29.log](offline29.log) |
| `node --test server/lib/pdfImport.test.js server/lib/pdfLayout.test.js src/lib/pdfImport.test.js` | 19 passed; 0 failed/skipped | [existing19.log](existing19.log) |
| `node --test src/lib/pdfImport.fixes.test.js server/lib/pdfImportIdentity.test.js server/routes/pdfImport.routes.test.js` | 17 passed; 0 failed/skipped | [targeted.log](targeted.log) |
| `node scripts/test-pdf-import-ui.mjs` | 16 passed; 0 failed/skipped | [ui.log](ui.log) |
| `node --test src/i18n/i18n.test.js` | 9 passed; 0 failed/skipped | [i18n.log](i18n.log) |

90 distinct passing tests. The additional `real-pdf-verification.log` records a successful rerun of the nine mapper/real-PDF tests; these are not counted twice. The UI runner compiles the React builder and uses a simulated DOM with mocked save/check APIs. Route tests use a local test server and mocked database. No real faculty record was saved and no real AI check was requested. The full npm test command was not run.

The six earlier tests intentionally asserted broken behavior. After implementing the corrections, they were run unchanged: all six failed with evidence of restored mappings, separated ILOs, preserved prerequisites and a rejected identity collision. Those expected failures are retained in [old-expectations.log](old-expectations.log). Only then were their assertions/names updated. The original offline report/source snapshots remain historical evidence; they were not rewritten to hide the defects.

## Three approved syllabi

Actual PDFs were re-read through production `extractPdf`, mapped in preview, and passed through the same `preparePdfImport` guard used by the builder. Their program/curriculum identity came from the frozen master export; no live reference records were changed.

| Syllabus | CLO–PO links | CLO–EGA links | Lesson ILOs | ILO–CLO links | Untagged lesson outcomes preserved |
|---|---|---|---|---|---|
| BSIT IT202 | 19 | 11 | 20 | 30 | 4: three numbered and one unlabelled |
| BSIE IE402 | 13 | 5 | 15 | 29 | 0 |
| BSCpE CpE304 | 11 | 4 | 15 | 6 | 11; week1 remains without an ILO |

All43 CLO–PO, all20 CLO–EGA and all65 ILO–CLO relationships survive. The tests also verify CLO/PO/EGA wording, vision/mission, description, prerequisite, reference text, weekly content/activity/assessment/value cells, examination types/weeks and input immutability against the verified fixtures. IE402 retains `4th Year Standing`; its superscript no longer contaminates the description. Examination-row CLO tags are retained even when the source contains only tags and no prose.

**Yes for the verified academic content and relationships above:** the three syllabi now pass importer preview/application tests without the confirmed information loss. This is not a claim of semantic alignment, institutional compliance, perfect citation segmentation or a successful live save/paid AI check.

## Workflow effects and remaining limitations

- Existing records are not migrated or rewritten. Changes apply to future explicit PDF imports into editable drafts. Mapper tests verify that the source draft is not mutated; route/context tests permit only SELECT queries. No live database connection was opened during this task, so existing database records received no writes.
- Scan remains a private preview. Apply still uses the existing save endpoint and existing explicit **Apply and AI CHECK** behavior after saving. Test calls to those APIs were mocked. There are no new AI stages, scoring changes or submission-gate changes.
- Conflicting prerequisites now require a separate user choice. Source text and both prerequisite values remain visible until that decision. Any field edits clear the general review confirmation; prerequisite-value edits additionally invalidate the specific choice. The builder enforces these guards again before save.
- Identity validation requires one applicable approved curriculum. A blank year is accepted only when there is one approved version for the selected program. A mismatched/missing/ambiguous year/context blocks Apply; correct the selection/year and scan again. Missing code/title must be corrected in the preview.
- Code punctuation variants are accepted only when uniquely resolved inside that program's selected curriculum and title agrees. Title comparison normalizes case/punctuation/spacing and accepts an exact base title when the reference adds a trailing parenthetical qualifier (e.g. IT202). It does not infer arbitrary title synonyms. The catalog identity remains authoritative on save.
- These PDFs do not print a degree program code. The preview explicitly asks faculty to confirm the selected program. The system validates code/title within that program's curriculum; it cannot prove an unprinted degree/cohort or distinguish otherwise identical documents by code alone. A supplied explicit `fields.program` that conflicts is rejected.
- Unlabelled prose following a CLO annotation is a review candidate, not a proven new outcome boundary. Text is retained and missing tags remain empty. Faculty must resolve intent; no academic mappings are invented.
- Unsupported/unknown source outcome numbers/ranges block Apply with the original preview text available for correction. The importer does not silently discard such relationships or alter official POs.
- Existing source/policy issues remain: BSIT PO numbering, incomplete baseline engineering PO12, untagged ILOs, overlapping weeks, value requirements, institutional-text conflicts and reference categories. Current reference grouping can merge citation entries and has no dedicated Journals category; the full reference text is preserved, but that unrelated representation issue was not redesigned here. Total credit-unit text still requires the existing lecture/lab review.
- Context reflects approved references at preview time. Administrative changes after preview require a new scan; the existing save/check flow continues to enforce current catalog and checker behavior. Full real-browser-to-live-database testing was not performed to avoid altering faculty records or invoking paid evaluation.

## Integrity and restrictions

The initial inventory captured 966 pre-existing files, including `server/.env`, all verified offline artifacts and protected evaluations. The final manifest shows exactly the eleven intended existing file changes listed above; no other inventoried file changed or disappeared. All files under `docs/lcup-approved-offline/` remain byte-identical, including the three fixtures, source snapshots, masters, deterministic reports, rendered evidence and prior logs. All original PDFs and protected evaluation data remain unchanged. Branch/HEAD are unchanged.

No changes to the 47 deterministic rules, official scoring, passing79, Program Outcomes, curriculum records, approved faculty syllabi, submission gates, environment, schemas or migrations. No production database writes, paid AI calls, commit, push, merge or deployment. Implementation stops here for review.
