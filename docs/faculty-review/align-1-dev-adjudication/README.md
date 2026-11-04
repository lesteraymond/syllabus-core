# Faculty adjudication package: align-1 development cases

**Status: a draft for the developer's review, not yet sent to faculty. No faculty judgment is recorded anywhere in it, and nothing in it is a faculty-approved answer.**

Built 2026-10-28, offline, from saved records. No AI provider was called. No checker code, prompt, dataset label, evaluation result or faculty dataset was changed.

## Why this package exists
Two evaluations of the AI Syllabus Checker, A2 and B2, compared the checker's verdicts with provisional verdicts that a developer wrote for the align-1 dataset. Faculty have never reviewed those provisional verdicts.
- On some cases the checker and the provisional verdicts disagree.
- On others, the checker's two configurations recommend different remedies.

Neither the checker nor the provisional verdicts can settle these cases. This package asks:
- qualified faculty to judge the cases themselves, without seeing anyone else's answer;
- the institution to settle the policy questions those judgments depend on.

The decisions can then be recorded as faculty-approved evaluation references.

## Who receives what
| Folder | For | Shows AI identities, AI verdicts or developer expectations? |
|---|---|---|
| `faculty/` (the guide, the references and `part-a/`, which holds the forms and their response sheet) | Case reviewers | No |
| `faculty/part-b/` (the forms and their response sheet) | Case reviewers, only after they return Part A | No identities, verdicts or expectations, but it shows anonymised changes proposed by the checker |
| `institution/` | The policy panel and the approving offices | No |
| `coordinator/` | The review coordinator only | **Yes. Do not give these files to reviewers before they have returned Parts A and B** |

## The deliverables
| # | Deliverable | File |
|---|---|---|
| 1 | Faculty-review package | `faculty/01-reviewer-guide.md`, `faculty/02-curriculum-references.md`, `faculty/part-a/` (7 courses and `part-a-responses.csv`), `faculty/part-b/` (6 courses and `part-b-responses.csv`) |
| 2 | Academic policy questions | `institution/01-policy-questions.md`, `institution/policy-responses.csv` |
| 3 | Complete unique-case disagreement inventory | `coordinator/01-case-inventory.md` |
| 4 | Recommendation-quality review | `coordinator/02-recommendation-quality-review.md` (developer review) and `faculty/part-b/` (the faculty's review items) |
| 5 | Proposed academic adjudication procedure | `institution/03-adjudication-procedure.md` |
| 6 | Institutional decisions needed | `institution/02-institutional-decisions.md` |
| 7 | Development steps after faculty validation | `coordinator/04-post-validation-development-plan.md` |
| – | The separate comparison document | `coordinator/03-comparison-and-blinding-key.md` (identities, case key, proposal key) |
| – | Machine-readable record | `coordinator/cases.json` |

## The cases
- **58 cases, each once.** The package covers the whole development split of align-1, by course. Each case is a different pair of texts; no two cases repeat a pair.
- **Every case has a Part A form**, so reviewers cannot tell which cases are in dispute. The coordinator's key puts each case in one of three sets:
  - **Set 1, 18 cases:** at least one checker answer differs from the provisional verdict. This is the minimum to adjudicate.
  - **Set 2, 26 cases:** the verdicts are within the provisional ones, but the answers vary, or a recommendation raises a question. The questions are re-mapping, level changes, duplication, value wording and replaced content.
  - **Set 3, 14 cases:** no disagreement and no flagged recommendation. These complete the split and act as blinding controls.
- **If faculty time is short**, send Sets 1 and 2 and a sample of Set 3, and record which were sent.
- **Part B covers every case for which a change was proposed:** 49 cases (44 of them in Sets 1 and 2), with 160 distinct proposals. Including the Set 3 proposals keeps Part B from revealing the sets.
- **The 42 held-out cases are not included** and were not read.
- **16 of the 58 are unchanged copies** of cases in the earlier eval-1.1 dataset. A decision on one applies to the other.

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

## Do not send with this package
- **The two older review sheets**, `docs/ai-eval-faculty-review-alignment.csv` and `docs/ai-eval-faculty-review.csv`. They are not blinded: they show the developer's expected verdicts. The first covers all 100 align-1 cases, including these 58 and the protected held-out cases. The second covers the eval-1.1 cases, 16 of which are copied here. This package replaces both for adjudicating these cases.
- **The evaluation reports** (`docs/anthropic-p2-*.md`) and anything in `docs/ai-eval-anthropic/`.
- **The other review packs cover different material.** `docs/faculty-review/faculty-review.*`, `docs/faculty-review/phase3/` and `docs/academic-validation-package/` cover real sample syllabi and whole-syllabus and stage checks. They do not overlap with these cases.

## Sources
sha256, first 16 characters:

| Source | sha256 |
|---|---|
| `docs/ai-eval-anthropic/p2-a2-cases.json` | `73c27948f75cb1b7` |
| `docs/ai-eval-anthropic/p2-b2-cases.json` | `ef984e44cd49667a` |
| `docs/ai-eval-anthropic/p2-a1-result.json` | `ba3866e00e330cd7` |
| `server/lib/syllabuscheck/eval/alignment-dataset.json` | `ab282a107df8c73b` |
| `scratch: p2b2-preregistered.json` | `1415f75cfe12def3` |
| `src/data/outcomesSeed.js` | `a3b6314dbe45310b` |
| `server/db/local-outcome-data.cjs` | `d6730bbc7681b3a2` |
| `server/db/local-curriculum-data.cjs` | `7b89f89db64b4f19` |
| `server/config/marian-values.json` | `f8c9ab3fc5e2f11e` |

Every text, verdict, explanation and draft was copied by script from these sources. The script checked that the A2 and B2 records still match the hashes they record, and that the dataset matches the hash pre-registered before B2.

`p2b2-preregistered.json` holds the developer notes fixed before B2 ran. It is kept with the developer's session files, not in the repository. Its hash is recorded in `docs/anthropic-p2-b2-report.md`. Both the generator script and this file can be added to the repository if the package must be rebuilt from it.

## Limits
- **The course records are test cases.** Their codes and titles match the institution's programs, but their descriptions were written for testing.
- **The program outcomes in the cases are general test wording**, not the official outcomes. The official outcomes the system holds are reproduced in `faculty/02-curriculum-references.md` for context.
- **The EGAs are known only by name.** The system holds the institution's four official names and no description of them.
- **The core-value definitions are unconfirmed.** They were copied from the university website and are pending institutional approval.
- **Four programs have nothing on record.** The system holds no outcomes, curriculum or syllabus for nursing, education, accountancy or hospitality.
- **58 cases is a small sample.**
