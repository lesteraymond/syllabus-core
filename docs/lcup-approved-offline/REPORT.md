# LCUP approved-syllabus offline preparation report

2026-10-28. Status: isolated fixtures and offline verification completed; production fixes and Claude evaluation pending review. This continues the existing importer/checker work. No broad curriculum re-audit was performed.

## 1. Repository state before and after

Branch: `Responsive-Design-2`; HEAD: `68926cb392756c07bb0b999538d098d1038be368`.

Before work: 56 modified entries and 209 untracked entries in `git status --short` (265 total). These include extensive unfinished importer, checker, application, database-script and evaluation work. They were preserved.

The initial inventory recorded SHA-256 hashes for 894 existing files. The final check found zero changes to those files and preserved every initial status entry. The only new status entries are `docs/lcup-approved-offline/` and `scripts/lcup-approved-offline/`. HEAD and branch are unchanged. See [before inventory](repository-before.json) and [after verification](repository-after.json).

Integrity limitation: PowerShell could not hash `docs/anthropic-p2-a2-report.md` initially because another process held it open. Node could read it later; its final hash and the missing-before-hash limitation are recorded separately. There is no initial byte-comparison claim for that report. No task script targets it. A1/A2/A3/B1/B2 result files, align-1, faculty packages, the protected held-out dataset, historical evaluation outputs and faculty-response importer outputs covered by the initial inventory have unchanged hashes.

No production code, scoring, the 47 rules, passing mark 79, gates, official outcomes, environment files or PDFs were edited. No database writes, migrations, AI/provider requests, P3/P4/P5 work, deletion, commit, push, merge or deployment occurred. The sole database operation was a read-only, consistent-transaction master export; no syllabus records were read.

## 2. Files inspected and reused

Required documents were read before authoring: `docs/lcup-curriculum-reference-audit.md`, `docs/lcup-curriculum-audit-followup.md`, `docs/lcup-academic-decisions-for-vpaa.md`.

Production paths inspected:

- `server/routes/pdfImport.js`; `server/lib/pdfImport.js`; `server/lib/pdfImport.worker.js`; `server/lib/pdfGeometry.js`; `server/lib/pdfLayout.js`.
- `src/lib/pdfImport.js`; `src/lib/syllabusModel.js`; `src/views/builder2/UploadPanel.jsx`; PDF application path in `src/views/builder2/index.jsx`; `server/routes/syllabusContent.js`; `server/lib/syllabusOutcomes.js`.
- `server/lib/syllabuscheck/engine.js`, `repository.js`, `validation.js`; `server/lib/institution.js`; `server/lib/programs.js`; database connection configuration in `server/index.js` (read, not started).
- `server/db/local-outcome-data.cjs`, `local-curriculum-data.cjs`; existing `eval/realSyllabi.js`, `eval/programSyllabi.js`, compliance fixtures, checker gate/engine tests; `scripts/audit-pdf-layout.cjs`, `extract-reference-pdfs.mjs`; root/server package manifests and importer tests.
- `server/.env` was read only by the master-export script to establish the local read-only connection; no credentials are included in these artifacts.

The previous `realSyllabi.js` loader was not used: it replaces outcomes with transcription data and builds institution masters from syllabus text, masking reference conflicts. Existing live/evaluation scripts were not executed. No Claude scratchpad files were needed.

Actual source PDFs, all located in `docs/academic-references/`:

| Role | File | Pages | SHA-256 |
|---|---|---|---|
| Baseline BSIT | IT-202-Programming-1.pdf | 11 | `6376fe94981ae65f25054234e1ae63cd50be8f70f12b774ea72949e07d561845` |
| Baseline BSIE | IE402-SYSTEM-ENGINEERINGS.pdf | 12 | `44ca6d48c77d0b04055cf330717b9381b64d3b7fb8674be727aa2eb4a1807569` |
| Baseline BSCpE | CPE-304-Fundamentals-of-Mixed-Signals-and-Sensors.pdf | 9 | `f68eb5bedb77d31b153b23dc354ef457c9a349b7fca64ba5a46578230982a4a2` |
| Supporting POs only | IE-403-Operation-Management.pdf | See source ledger | See engineering-pos.json |
| Supporting POs only | CPE-404-Digital-Signal-Processing.pdf | See source ledger | See engineering-pos.json |

The three baseline copies in `reference-data/` are byte-identical. IT-101 was not extracted or incorporated. The supporting syllabi contribute only their engineering PO comparison; none of their CLOs or plans is a baseline checker input.

## 3. Reproduced importer defects and affected code paths

All four reported behaviors affect the production import workflow, not just evaluation preparation. Regression tests pin today's behavior without fixing it.

| Defect | Reproduction and exact responsible path | Effect |
|---|---|---|
| CpE304 loses outcome links | `src/lib/pdfImport.js:86-94`: first `line.match` for PO followed by digits/punctuation stops at a repeated `PO`. Actual PDF snapshot maps CLOs to `[1]`, `[6]`, `[4]`, `[11]` instead of `[1,2,3,5]`, `[6,7,12]`, `[4,9]`, `[11,13]`. | Seven of eleven printed CLO–PO links lost. Raw worker columns contain them; loss happens in client mapping. |
| IT202 loses an untagged ILO | `src/lib/pdfImport.js:110-118`: ILO boundaries require `:` or `.` and line starts. Actual p5 week4–5 `ILO 2 Acquire…` is merged into the preceding tagged ILO. | Preview has two ILOs instead of three and hides the missing relationship. Additional inline/unlabelled outcomes and CLO ranges require care. |
| Prerequisite overwritten | `src/lib/pdfImport.js:70`: nonblank PDF value unconditionally replaces `next.meta.prereq`. | Replaces an existing authored/catalog value; no conflict choice. The source syllabus wording itself may still be valid. |
| BSIT IT202 / Cyber IT-202 collision | `src/lib/pdfImport.js:66-69`: code comparison strips all non-alphanumerics and does not compare program; title mismatch is only a warning. | A BSIT PDF can be applied to a selected Cyber subject. The selected Cyber identity remains, carrying unrelated BSIT content. |

Production sequence: `POST /:id/import-pdf` in `server/routes/pdfImport.js` calls `extractPdf`, which runs `pdfImport.worker.js`; the worker calls `recoverTables` and returns raw fields/plan rows. `UploadPanel.jsx:49` maps the preview; its apply guard at `:85-90` blocks only `mapped.mismatch`. `builder2/index.jsx:203-205` maps again when applying. The normal content-save path (`syllabusContent.js:65`) copies catalog code/title/program, but does not restore prerequisite or lost mappings. These tests exercise the mapper directly and actual worker snapshots; a new browser-to-database end-to-end test was not run.

Additional reproduced source observation: IE402 p1 superscript `th` is assigned to the description by y-sorted `pageLines` (`pdfImport.worker.js:10-26,48`), leaving `4 Year Standing` in the prerequisite field. The isolated adapter instead reads description/prerequisite between original stream headings and rejoins `4` + superscript `th`. No production correction was made.

Separate evaluation-only artifact: raw `CpE 304` is a critical CUR-CODE mismatch under the current checker; normal builder save uses catalog `CpE-304`. Source and builder-context scenarios are reported separately to avoid mislabelling this as a reachable builder defect. The checker itself keeps the BSIT and Cyber curricula separate; its cross-program isolation tests pass.

## 4. Fixture generator implementation

All new executable code is in `scripts/lcup-approved-offline/`:

- `extract.mjs`: explicit five-PDF allowlist, local PDF.js token/coordinate evidence, existing geometry/table primitives, unmodified production-worker preview, SHA-256 and rendered review pages. No OCR or external service was needed for these text PDFs.
- `generate.mjs`: isolated source adapter. Reconstructs table cells/continuations with page coordinates; parses complete repeated labels and inclusive ranges; keeps every untagged ILO; separates the reviewed unlabelled IT202 sentence without inheriting its neighbor's tags. It rejects incomplete/changed extraction instead of emitting an accepted fixture.
- `export-masters.cjs`: optional, explicit local MySQL export through production `mastersFor`; read-only transaction and SELECT-only wrapper. Records versions, source references, fingerprint and query ledger in `masters.json`. It is not used by subsequent offline tests.
- `baseline.mjs`: existing `engine.coded`, with network entry points disabled. Does not call `engine.run`, provider transports, report persistence or link verification. Adds classifications to the returned findings without changing rules or deductions.
- `report.mjs`: readable PO comparison and deterministic finding tables. `integrity.cjs`: original file hash and Git-state verification.

Checker-compatible inputs are the `content` objects in [IT202](it202.fixture.json), [IE402](ie402.fixture.json) and [CpE304](cpe304.fixture.json). They validate with the existing `validateOutcomes` service. Evidence/review notes are sidecars, not a second checking engine.

Fixtures preserve program context, source code/title, description, school year, credit-unit text, prerequisite, all POs/EGAs/CLOs, printed mappings, all weekly cells, references, requirements, exams and grading text. Program degree identity comes from the user's designation and a match scoped to that program in the frozen reference; the PDF prints the college header rather than the degree code. Curriculum year/year level are not printed and remain blank in source content. No school year is relabelled as a curriculum year.

Raw PDF tokens, line breaks, coordinates and source pages are retained in `*.source.json`/`*.source.txt`. Source cell text and exact outcome labels are retained in each fixture's `evidence`. Checker prose normalizes whitespace/line wraps only. Faculty spelling, punctuation, malformed tags and source gaps remain. No PO12 completion or missing CLO mapping is inserted.

Builder projection limitations are explicit: Journals has no dedicated schema group and is projected to `online` while its original category is retained in evidence; absent groups are not marked N/A. EGA short labels and the required CLO-level enum are unsourced display/default metadata, not academic judgments. IE402 says only `3 units`; its lecture/lab split is unknown in source content and taken from the catalog only in the labelled builder-context scenario. Grading formulas and CpE304's empty item `4.` remain in evidence; the existing builder percentage rows do not express every printed grading line. Typed requirement numbers remain source text and trigger the existing T-20 representation finding.

## 5. Source-to-fixture verification

| Fixture | CLO / PO / EGA | Lesson ILOs | Untagged lesson outcomes | CLO–PO / CLO–EGA / ILO–CLO links | Plan rows | Exam weeks | References |
|---|---|---|---|---|---|---|---|
| IT202 | 4 / 9 / 4 | 20 | 4: three numbered, one unlabelled | 19 / 11 / 30 | 13 | 6,12,18 | 13 |
| IE402 | 4 / 13 / 4 | 15 | 0 | 13 / 5 / 29 | 9 | 4,9,18 | 7 |
| CpE304 | 4 / 13 / 4 | 15 | 11; plus no ILO at week1 | 11 / 4 / 6 | 11 | 6,12,18 | 4 |

All 43 CLO–PO, 20 CLO–EGA and 65 ILO–CLO links are retained. All 18 weeks are covered; IT202 still overlaps week4. IE402 weeks15–17 correctly continue across pages8–10. CpE304 examination cells, including the apparent week12 assessment/value swap, remain as printed.

Automated verification covers exact field text against source token streams; all characters and prose order within outcome/plan cells; complete outcome-column reconstruction; every weekly cell/continuation; inclusive mapping ranges; exam rows; stable IDs; correct identity/program scope; original PDF hashes and repeat extraction/generation. Separate bullet glyphs can occur out of reading order in the PDF stream; geometric ordering preserves every glyph and all prose. Relevant rendered PO pages (all four engineering sources), IT202 untagged/unlabelled ILO pages, IE402 continuation layout and CpE304's swapped exam cells were inspected locally. Rendering also produced local review PNGs for all baseline pages; there is no claim of an independent human line-by-line transcription of every page.

No unresolved character-loss discrepancy remains in the executed preservation checks. Remaining interpretation questions: IT202 p8 unlabelled outcome boundary needs faculty confirmation; PDF line-end hyphens and nonstandard bullet glyphs are preserved; IE402 total-unit split and unprinted year/cohort fields cannot be recovered from the source. These limitations remain in fixture notes and block AI-evaluation readiness. The supplied documents' own missing tags/text are preserved gaps, not extraction omissions.

## 6. Executed targeted offline tests

Executed successfully:

```powershell
node --test scripts/lcup-approved-offline/importer-regression.test.mjs scripts/lcup-approved-offline/fixture.test.mjs scripts/lcup-approved-offline/baseline.test.mjs
```

29 passed, 0 failed, 0 skipped. [Execution log](targeted-tests.log). Includes six defect reproductions, fail-closed extraction, fresh extraction repeatability for all five PDFs, byte-repeatable fixture generation, master-backed checker isolation, deterministic scenarios and exact comparisons of all13 engineering POs. A passing defect reproduction means the defect still exists.

```powershell
node --test server/lib/pdfImport.test.js server/lib/pdfLayout.test.js src/lib/pdfImport.test.js
```

19 passed, 0 failed, 0 skipped. [Existing importer test log](existing-importer-tests.log). The existing tests do not cover the newly reproduced defects. The full npm test command and live evaluation scripts were not run. Initial preservation testing exposed IE402's misplaced superscript; the adapter was corrected and the complete targeted suite rerun successfully. PDF.js emitted nonfatal font-function warnings; token repeatability and preservation checks still passed.

## 7. Deterministic baselines and classifications

Executed the existing Hybrid-2 coded component against frozen actual MySQL masters. [Machine report](deterministic-baseline.json) and [complete classified findings](deterministic-findings.md) retain every rule, path, severity, evidence and expected value. The 47-rule standard is untouched; the production coded component already excludes C-04/R-02/R-03. Base scores are its 44-rule component, not official Hybrid-2 scores.

| Scenario | IT202 base / critical | IE402 base / critical | CpE304 base / critical |
|---|---|---|---|
| Source identity and unprinted fields left blank | 96 / false | 96 / false | 93 / true |
| Catalog identity/context explicitly supplied | 96 / false | 99 / false | 93 / false |

Builder-context takes code/title/year level from the catalog/reference; IE402 lecture/lab comes from that reference because the PDF only states a total. Curriculum year remains blank, so the existing engine selects the sole approved version. Authored prerequisite and institutional/program outcomes are never replaced. This scenario is not a simulated full production autosave.

All three builder-context scenarios have blocking findings. `officialScore` and `passed` remain null; AI is NOT_EVALUATED. Neither VPAA approval nor a base score above79 establishes a pass or a false rejection.

1. **Confirmed objective discrepancy:** IT202 week4 occurs in two rows; its three numbered ILOs and unlabelled outcome have no CLO tag; CpE304 has eleven untagged ILOs and no week1 ILO; IT202 CLO4 and CpE304 CLO3/4 have no lesson ILO coverage. Whether the current enforcement is intended remains an L18 policy question.
2. **Institutional reference conflict:** BSIT's printed nine POs vs the stored ten and incompatible numbering; differing vision/mission; reference-category/form editions; IE402 `4th Year Standing` vs `4th Yr`; titles as printed vs catalog spelling/case. Engineering PO-EXACT passes because stored wording was transcribed from the same incomplete baselines, not because supporting sources verified it.
3. **Possible software defect:** reproduced importer losses/collision; EGA exact comparison includes generated short labels and wrapped hyphen spacing; source-only identity/blank context artifacts; T-20 on retained numbered strings. Correct these representations before interpreting their findings as academic defects.
4. **Academic-policy question:** VALUE finds no institutional core-value name in 1/10 IT202, 4/6 IE402 and 8/8 CpE304 lesson rows; exam rows are exempt. Curriculum cohort/year format, required ILO tagging and reference-group N/A requirements need institutional decisions.
5. **AI-dependent judgment requiring faculty validation:** CLO/PO/EGA/ILO academic suitability; course/lesson relevance; learning activity and assessment alignment; value integration; reference relevance/authenticity. No semantic labels or faculty truth judgments were fabricated.

## 8. Engineering Program Outcome comparison

[All 13 POs, exact source wording and page references](engineering-po-comparison.md); [machine-readable raw text/line breaks](engineering-pos.json).

IE403 p3 and CPE404 p3 both print the complete PO12:

> Knowledge and understanding of engineering and management principles as a member and leader in a team, to manage projects and in multidisciplinary environments.

IE402 p3 and CpE304 p3 stop after `and in`. The completion was verified visually in both supporting PDFs and is not inserted into any baseline or official master.

Differences beyond PO12 are punctuation, with the remaining words identical:

- IE402 vs IE403: PO2 (`;` / `.`), PO4 (none / `;`), PO5 (`;` / `.`), PO7 (none / `.`), PO10 (`;` / `.`), PO11 (`and;` / `and`).
- CpE304 vs CPE404: PO4 and PO7 (none / `;`).
- IE402 vs CpE304: PO11 only (`and;` / `and`).
- IE403 vs CPE404: PO2, PO5, PO7 and PO10 (`.` / `;`).

The sources provide no independent PO–EGA crosswalk and do not decide whether identical PO13 is appropriate for BSCpE. Full PO12 wording is now evidenced; official adoption/version and shared-vs-program-specific lists remain unresolved.

## 9. Remaining institutional/faculty decisions

Use the existing VPAA decision document; no new answers are assumed:

- L1/F1: authoritative BSIT PO version/numbering and remapping of all19 printed IT202 CLO–PO links. Cyber Security uses BSIT POs under the policy given in this task; its distinct 2025–2026 curriculum remains separate. The formal inheritance link has not been applied.
- L2/L3: adopt/version the evidenced complete engineering PO12; settle punctuation, PO13 applicability, separate/shared PO lists and independent PO–EGA crosswalks.
- L15/L16: vision/mission version (including CpE304's six-item mission) and current syllabus-form reference categories.
- L17/L18: weekly core values, ILO tagging/completeness, CLO coverage and examination treatment.
- L19/L20 and Registrar: school year vs curriculum/cohort; official code/title/prerequisite variants; IE402 total-unit interpretation.
- F2–F10: IT202 overlap and C-language task in Java course; unlabelled/untagged ILO targets; repeated/skipped ILO numbers; engineering spirituality mappings; CpE304 week12 cell swap, preliminary-exam wording, laboratory/project requirements and blank grading item; course-reference relevance.
- L21/privacy: authorize any external transmission, required redaction/consent and paid evaluation budget separately. Current source ledgers and rendered pages contain author/sign-off information and are local review material, not external prompts.

## 10. Recommended minimal technical fixes — not implemented

After review, fix the production mapper's repeated-PO-label parsing and inclusive CLO ranges; recognize unpunctuated/inline ILO starts; retain unlabelled outcomes with a review prompt. Add a prerequisite conflict choice and preserve superscript text at section boundaries. Validate import identity using selected program plus program-scoped code/title resolution, with explicit confirmation for a conflicting title/course. Do not change course equality globally or substitute Cyber's curriculum with BSIT's.

Keep original source wording/evidence alongside derived builder fields. Handle reference categories and display-only outcome metadata through approved template/representation work. Master corrections, PO inheritance and policy changes require separate authorized/versioned work. None of these proposals authorizes changing rules, scoring, gates or passing79.

## 11. Reproduction and next authorized AI evaluation

To regenerate locally with the existing dependencies and source PDFs:

```powershell
node scripts/lcup-approved-offline/extract.mjs
node scripts/lcup-approved-offline/generate.mjs
node scripts/lcup-approved-offline/baseline.mjs
node scripts/lcup-approved-offline/report.mjs
```

The extractor CLI prints source text; redirect to a file within this isolated folder if desired. Regeneration fails if a required PDF is missing. `export-masters.cjs` is a separate optional read-only refresh; using a new master export creates a different reference baseline and must be recorded as such. It does not run automatically in tests. Run `integrity.cjs` after checks to refresh repository verification.

Pending before Claude: resolve/record PO identity and source ambiguities; obtain faculty judgments without assuming approved means ALIGNED; authorize privacy/redaction and cost; create a reviewed redacted payload from these three `content` objects and explicitly versioned masters. Use the existing shared Hybrid-2 checking path with current stages only and a separate output directory. Never invoke the historical evaluation runners against protected results. No redacted external payload or paid AI run was created/executed here.

Completed: isolated fixtures, raw evidence and page references, four production-defect reproductions, supplemental superscript diagnosis, PO comparison, read-only master export, deterministic baselines, 48 passing targeted/existing importer tests and repository integrity verification. Pending: production fixes, official reference/policy decisions, faculty semantic adjudication and any authorized Claude evaluation. Work stops here for review.
