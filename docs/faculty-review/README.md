# Faculty review pack for the AI Checker

Open `faculty-review.html` in any browser (or print it), or `faculty-review.csv` in Excel. No access to the application or its code is needed.

**Everything here is provisional.** The expected decisions are the assistant's proposals, not faculty judgments; the real syllabus text was extracted automatically from the three sample PDFs (IT 202, IE 402, CPE 304) and the Program Outcome wording was transcribed from the registrar images. Please check both against the originals.

## What to do
For each item, read the **original content** and the **reference** it was judged against, then say whether you agree with the provisional decision. Where you disagree, give the expected decision (ALIGNED, PARTIALLY_ALIGNED or NOT_ALIGNED) and a note. For the real syllabus rows no decision is proposed: please give one where you can, and mark rows whose extraction is wrong.

## Columns
| Column | Meaning |
|---|---|
| Item / Kind | an identifier; "Real syllabus" (text as written) or "Synthetic test item" (written by the assistant to test the checker) |
| Stage / relationship | what is compared (for example weekly content against the course, an ILO against a CLO, a CLO against a Program Outcome) |
| Original content / Reference | the faculty text, and the text it is judged against |
| Provisional expected decision | the assistant's proposal; "or" means either is acceptable |
| AI decision (run 1 / run 2) | what the model answered in two live runs; "not run" if it has not been asked |
| AI explanation | not stored with the saved evaluations |
| Faculty columns | for you to fill in |

## Limits
- The Program Outcome texts are not official wording; do not quote them as policy.
- The synthetic weekly plans and ILOs are examples, not the institution's learning plans.
- A decision of ALIGNED / NOT_ALIGNED here is not an institutional rule; the checker's findings remain advisory.
