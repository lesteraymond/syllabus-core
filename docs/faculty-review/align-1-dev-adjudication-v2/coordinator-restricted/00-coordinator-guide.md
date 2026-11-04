# Coordinator guide (restricted)

**Restricted to the review coordinator. Never send this folder, or any file in it, to case reviewers.** It names the evaluation arms and shows the software's verdicts, explanations and drafts and the developer's provisional verdicts.

**Status: Version 2, a draft for the developer's review, not yet sent to anyone. No faculty judgment is recorded anywhere in it, and nothing in it is approved.** Built 2026-10-28, offline, from Version 1's records. No AI provider was called. No checker code, prompt, dataset label, evaluation result or faculty dataset was changed, and Version 1's folder was not written.

## What changed from Version 1
Version 2 corrects the forms, guides, references and policy documents of Version 1 after its final audit, and splits them into separate bundles. The 58 cases, their codes and texts, the sets and the 160 proposals are unchanged. The full list is in `06-changes-from-v1.md`.

## Why this package exists
Two evaluations of the AI Syllabus Checker, A2 and B2, compared the checker's verdicts with provisional verdicts that a developer wrote for the align-1 dataset. Faculty have never reviewed those provisional verdicts.
- On some cases the checker and the provisional verdicts disagree.
- On others, the checker's two configurations recommend different remedies.

Neither the checker nor the provisional verdicts can settle these cases. This package asks qualified faculty to judge the cases themselves, without seeing anyone else's answer, and the institution to settle the policy questions those judgments depend on. The decisions can then be recorded as faculty-approved evaluation references.

## The bundles and who receives them
| Folder | Send to | When | Shows AI identities, AI verdicts or developer expectations? |
|---|---|---|---|
| `1-part-a-for-reviewers/` | Each case reviewer: the two shared files (the Part A guide and the references) and **only their own course folder** | After decisions I1, I2, I5, I12 and I15 are recorded | No |
| `2-part-b-for-reviewers/` | Each case reviewer: the Part B guide and **only their own course folder** | Only after that reviewer's Part A is returned | No identities, verdicts or expectations, but it shows anonymised changes proposed by the software |
| `3-policy-panel/` | The policy panel and the approving offices | The decisions needed before sending first; the policy questions at step 4, after Part A is returned | No |
| `coordinator-restricted/` | Nobody | Never | **Yes** |

Each document is a Word file to fill in and a PDF to print. The `.md` files in `coordinator-restricted/distributed-text/` are text copies of the distributed documents for the developer's review; they are not sent.

## Sending checklist
1. **Before anything is sent,** record decisions I1, I2, I5, I12 and I15 (`3-policy-panel/02-institutional-decisions-and-approvals`).
2. Give each reviewer a code and record it in `templates/reviewer-tracking.csv`.
3. **Part A:** send `1-part-a-for-reviewers/01-reviewer-guide-part-a` and `1-part-a-for-reviewers/02-curriculum-and-institutional-references` (each as .docx and .pdf) and the folder `1-part-a-for-reviewers/<COURSE>/`. Nothing else.
4. **Check the attachments before sending:** every file name starts with `01-`, `02-` or the reviewer's course code, and no file comes from `2-part-b-for-reviewers/`, `3-policy-panel/` or `coordinator-restricted/`.
5. **On return:** record the date and a checksum of the returned file (on Windows, `certutil -hashfile <file> SHA256`). The returned form is then not edited.
6. **Outside-expertise cases:** log them in `templates/reassignment-log.csv` and reassign them (procedure, section 5).
7. **Unclear answers** (two boxes ticked where one is asked, or a blank): ask the reviewer and record the clarification with its date. Never guess.
8. **Part B:** after a reviewer's Part A is returned, send `2-part-b-for-reviewers/01-reviewer-guide-part-b` and the folder `2-part-b-for-reviewers/<COURSE>/`. IE 310 has no Part B.
9. **Policy panel:** share `05-policy-question-case-map.md` only after Part A is returned (step 4).

**IE 310.** Its single case (IE310-01) has no Part B. It can be given to the MA 7 reviewers if they are industrial engineers, or to two industrial-engineering reviewers. Record the choice.

## Workload by course
| Course | Part A cases | Part B proposals | Reviewers |
|---|---|---|---|
| MA 7 Differential Calculus (BSIE, year 1) | 20 | 61 | 2 reviewers from mathematics or engineering |
| IE 310 Operations Research (BSIE, year 3) | 1 | 0 | 2 reviewers from industrial engineering |
| IT 204 Computer Programming 2 (BSIT, year 2) | 13 | 30 | 2 reviewers from information technology |
| NCM 101 Fundamentals of Nursing Practice (BSN, year 1) | 11 | 30 | 2 reviewers from nursing |
| EDUC 105 Assessment of Student Learning 1 (BSEd, year 3) | 6 | 18 | 2 reviewers from education |
| ACCTG 201 Intermediate Accounting 1 (BSA, year 2) | 4 | 15 | 2 reviewers from accountancy |
| HM 210 Food and Beverage Service (BSHM, year 2) | 3 | 6 | 2 reviewers from hospitality management |

As a rough guide, a Part A case takes three to five minutes and a Part B proposal one to two.

## The cases (restricted)
- **58 cases, each once.** The package covers the whole development split of align-1, by course. Each case is a different pair of texts; no two cases repeat a pair.
- **Every case has a Part A form**, so reviewers cannot tell which cases are in dispute. The coordinator's key puts each case in one of three sets:
  - **Set 1, 18 cases:** at least one checker answer differs from the provisional verdict. This is the minimum to adjudicate.
  - **Set 2, 26 cases:** the verdicts are within the provisional ones, but the answers vary, or a recommendation raises a question (re-mapping, level changes, duplication, value wording or replaced content).
  - **Set 3, 14 cases:** no disagreement and no flagged recommendation. These complete the split and act as blinding controls.
- **If faculty time is short**, send Sets 1 and 2 and a sample of Set 3, and record which were sent.
- **Part B covers every case for which a change was proposed:** 49 cases (44 of them in Sets 1 and 2), with 160 distinct proposals. Including the Set 3 proposals keeps Part B from revealing the sets.
- **The 42 held-out cases are not included** and were not read.
- **16 of the 58 are unchanged copies** of cases in the earlier eval-1.1 dataset. A decision on one applies to the other.

## Notes from Version 1's final audit
- **Proposals that repeat a case text** (after normalising case and punctuation): MA7-18-R4 (equals the text of MA7-20); NCM101-01-R3 (equals the text of NCM101-02, NCM101-09, NCM101-11). A reviewer who meets the same text twice may notice; the proposals are shown as generated.
- **Near-identical proposals within a case** (at least 85% of their words shared): 10 pairs: MA7-06-R2 and MA7-06-R3; MA7-15-R1 and MA7-15-R3; MA7-15-R2 and MA7-15-R4; IT204-04-R1 and IT204-04-R3; IT204-05-R1 and IT204-05-R3; NCM101-01-R1 and NCM101-01-R3; NCM101-01-R2 and NCM101-01-R3; EDUC105-05-R1 and EDUC105-05-R2; EDUC105-05-R2 and EDUC105-05-R3; ACCTG201-02-R1 and ACCTG201-02-R2. Identical texts were merged in Version 1; near-identical ones are rated separately.
- **Reviewers cannot see which proposal came from which configuration.** The key is in `03-comparison-and-blinding-key.md`.

## Do not send with this package
- **Version 1** (`docs/faculty-review/align-1-dev-adjudication/`). Version 2 replaces it for sending; Version 1's faculty and institution files lack the corrections in `06-changes-from-v1.md`.
- **The two older review sheets**, `docs/ai-eval-faculty-review-alignment.csv` and `docs/ai-eval-faculty-review.csv`. They are not blinded: they show the developer's expected verdicts. The first covers all 100 align-1 cases, including these 58 and the protected held-out cases. The second covers the eval-1.1 cases, 16 of which are copied here.
- **The evaluation reports** (`docs/anthropic-p2-*.md`) and anything in `docs/ai-eval-anthropic/`.
- **The other review packs cover different material.** `docs/faculty-review/faculty-review.*`, `docs/faculty-review/phase3/` and `docs/academic-validation-package/` cover real sample syllabi and whole-syllabus and stage checks. They do not overlap with these cases.

## Version 1 paths in the copied documents
| Version 1 | Version 2 |
|---|---|
| `faculty/01-reviewer-guide.md` | `1-part-a-for-reviewers/01-reviewer-guide-part-a` and `2-part-b-for-reviewers/01-reviewer-guide-part-b` |
| `faculty/02-curriculum-references.md` | `1-part-a-for-reviewers/02-curriculum-and-institutional-references` (the same document as `3-policy-panel/04-curriculum-and-institutional-references`) |
| `faculty/part-a/<COURSE>.md`, `part-a-responses.csv` | `1-part-a-for-reviewers/<COURSE>/<COURSE>-part-a-form` and `<COURSE>-part-a-responses.csv` |
| `faculty/part-b/<COURSE>.md`, `part-b-responses.csv` | `2-part-b-for-reviewers/<COURSE>/<COURSE>-part-b-form` and `<COURSE>-part-b-responses.csv` |
| `institution/01-policy-questions.md` | `3-policy-panel/01-academic-policy-questions` (case lists moved to `05-policy-question-case-map.md`) |
| `institution/02-institutional-decisions.md` | `3-policy-panel/02-institutional-decisions-and-approvals` |
| `institution/03-adjudication-procedure.md` | `3-policy-panel/03-adjudication-procedure` |
| `institution/policy-responses.csv` | `3-policy-panel/decision-and-approval-record.csv` |
| `coordinator/01-04`, `cases.json` | `coordinator-restricted/01-04`, `cases.json` |
| `README.md` | this guide (restricted parts) and `README.md` (a neutral index) |

## Sources
sha256, first 16 characters. The generator refuses to run if any of them, or any Version 1 file, has changed.

| Source | sha256 |
|---|---|
| `docs/ai-eval-anthropic/p2-a2-cases.json` | `73c27948f75cb1b7` |
| `docs/ai-eval-anthropic/p2-b2-cases.json` | `ef984e44cd49667a` |
| `docs/ai-eval-anthropic/p2-a1-result.json` | `ba3866e00e330cd7` |
| `server/lib/syllabuscheck/eval/alignment-dataset.json` | `ab282a107df8c73b` |
| `docs/ai-eval-anthropic/p2b2-preregistered.json` | `1415f75cfe12def3` |
| `src/data/outcomesSeed.js` | `a3b6314dbe45310b` |
| `server/db/local-outcome-data.cjs` | `d6730bbc7681b3a2` |
| `server/db/local-curriculum-data.cjs` | `7b89f89db64b4f19` |
| `server/config/marian-values.json` | `f8c9ab3fc5e2f11e` |
| `docs/faculty-review/align-1-dev-adjudication/package-manifest.json` (Version 1) | `a753552b15357829` |

The pre-registered developer notes (`docs/ai-eval-anthropic/p2b2-preregistered.json`) are the file whose hash `docs/anthropic-p2-b2-report.md` records.

## Rebuilding and verifying
- `node scripts/export-align1-adjudication-v2.cjs` rebuilds every .docx, .md, .csv and .json file byte for byte. Add `--pdf` to re-create the PDFs with Microsoft Word.
- `node scripts/verify-align1-adjudication-v2.cjs` runs the offline checks: case texts and codes, blinding, bundle separation, reference status, form contents and a rebuild.
- The generator refuses an `--out` folder that is, contains or lies inside Version 1's folder, and never overwrites a file that someone has changed.
- **Line endings.** With `core.autocrlf=true` and no `.gitattributes` rule, Git converts line endings on checkout, which changes the bytes of the .md and .csv files and breaks the hash checks. Before committing, add a rule such as `docs/faculty-review/** -text`.

## Limits
- **The course records are synthetic.** Their codes and titles resemble the institution's programs. R-CODES in the references shows which codes appear in the curricula transcribed in the system; their descriptions and outcomes were written for testing.
- **The program outcomes in the cases are synthetic, general wording**, not official outcomes. The outcomes the system holds are transcriptions, reproduced in the references with their status.
- **The EGAs are known only by name.** The system holds four names (transcribed, not confirmed) and no description of them.
- **The core-value names and definitions are a website copy, pending institutional approval.**
- **Four programs have nothing on record.** The system holds no outcomes, curriculum or syllabus for nursing, education, accountancy or hospitality.
- **58 cases is a small sample.**
