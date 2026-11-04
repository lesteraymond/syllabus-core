# Changes from Version 1 (restricted)

Version 1 is `docs/faculty-review/align-1-dev-adjudication/` (package-manifest.json sha256 `a753552b15357829`). It is kept unchanged: every build of Version 2 first checks each of its files against its manifest.

## What did not change
- **The cases.** The same 58 cases, with the same codes, ids, texts, relationship types, courses and sets (18, 26 and 14).
- **The proposals.** The same 160 proposals in 49 cases, with the same codes, kinds and texts, in the same order.
- **The evidence.** Every answer, quotation, explanation, draft and rule flag in the coordinator documents and in `cases.json`.
- **The provisional verdicts.** They appear only in coordinator-restricted files.
- **The blinding.** Codes by course, then relationship type, then a salted hash; proposals in salted-hash order; no software or developer answer, no evaluation name and no AI identity in any distributed file.
- **The academic expectations, the evaluation records, the checker and its scoring.** Version 2 changes none of them.

## Changes by requirement
| # | Requirement | What changed |
|---|---|---|
| 1 | An "outside my expertise" option | Part A: question 0 on every case ("Is this case within your expertise?"); a No leaves the case blank for reassignment. Part B: "Outside my expertise" as a reason for "Cannot judge". Procedure section 5: reassigned and not counted. A reassignment log template. |
| 2 | "Insufficient information" where appropriate | Question 1 offers "Insufficient information to judge" (Version 1: "Insufficient evidence to judge") and question 2 asks what information is missing. Question 4 adds "Insufficient information to judge" beside "Unsure"; question 5 adds "Insufficient information to recommend"; question 6 adds "Cannot tell". Decision I8 uses the same term. |
| 3 | "Cannot judge" for recommendations | Every Part B rating adds "Cannot judge" with a reason (outside my expertise, insufficient information, other). It is not counted as a rating. The concerns add "No concerns". |
| 4 | Neutral policy questions | Each question is an open question; the options are listed "in no order of preference", each with a parallel "what it would mean in practice" line, and none is recommended. Removed: "contribute meaningfully"; the P1 framing "Two questions that are easy to confuse … A program can cover a broad PO completely even if no single CLO covers all of it"; "That is consistent with options A and C"; "option C may already be practice"; P2's "smaller step" and "genuine step"; "It bears on P1, option C". P2 (a)-(b) and P7 (c) no longer presume what is acceptable or a defect. Examples taken from the review cases were replaced by a generic illustration, and the case lists moved to `05-policy-question-case-map.md`. In the forms, the two readings in question 3 are worded in parallel, neither with a justification, with a third option ("The distinction did not affect my answer for this case"). The guide no longer says "Separately from alignment" for course fit, and question 4b records whether course fit affected the alignment answer. |
| 5 | Synthetic references distinguished from institutional records | Four status labels (synthetic; transcribed, not confirmed; website copy, pending approval; not held), defined in the guides and the references and attached to every text in the course context and the references. New sections R-CASES and R-CODES. The PO-to-EGA column of R-BSIT carries a caveat. Every document states that no text in the package has been confirmed by the institution. |
| 6 | Unsupported claims about approved curricula | "The course codes and titles are the institution's" is replaced by R-CODES, a check of each code against the transcribed curricula (MA 7 and IT 204 appear; IE 310 does not; NCM 101, EDUC 105, ACCTG 201 and HM 210 cannot be checked). "The institution's four EGAs" and "official names" became "the four names held in the system". "The official outcomes the system holds" became the transcribed outcomes. "BSIE places MA 7 …" was removed. Curriculum placements say "transcribed in the system". The values entry no longer quotes the source file's note, which named the tool that copied it. Two corrections in the copied inventory (below). |
| 7 | Original evidence and case IDs preserved | The generator takes the cases and proposals from Version 1's `cases.json` after checking Version 1's manifest, the hashes of every source record and the dataset texts. The verifier recomputes the proposals from the evaluation records and checks every quotation against the case texts. |
| 8 | Part A and Part B separate | Separate bundles (`1-part-a-for-reviewers/`, `2-part-b-for-reviewers/`) with separate guides. The Part A guide mentions Part B only as a later package. |
| 9 | Coordinator files restricted | Everything restricted is in `coordinator-restricted/` and named so; the README is a neutral index; the verifier checks that no distributed file holds restricted content and that each bundle holds only its own files. |
| 10 | Reviewer-ready response forms | Word forms with check boxes and text fields (content controls), PDFs for printing, and one response sheet per course and part, with the new columns. |
| 11 | Faculty disagreement handling | Procedure sections 5 (special answers) and 6 (handling disagreement), and record templates for tracking, reassignment, agreement, adjudication and Part B ratings. |
| 12 | Institutional approval requirements | `02-institutional-decisions-and-approvals`: what an approval record contains, what does not count as approval, and the gates. I12 now comes before sending; I15 (ethics clearance or consent) is new; I6 adds the PO-to-EGA mapping. `decision-and-approval-record.csv` replaces `policy-responses.csv`. |
| 13 | Blinding methodology preserved | As above; the verifier re-runs the blinding checks on the Word files, the PDFs, the response sheets and the document properties. |
| 14 | Reproducible | `scripts/export-align1-adjudication-v2.cjs` rebuilds the .docx, .md, .csv and .json files byte for byte; the PDFs are tied to the hash of the Word file each was made from; `scripts/verify-align1-adjudication-v2.cjs` rebuilds into a temporary folder and compares. |

## Corrections applied to the copied coordinator documents
| File | Correction | Times | Why |
|---|---|---|---|
| `01-case-inventory.md` | /\b(BSIE\|BSIT) (\d{4}-\d{4}) curriculum: /g → "… … curriculum as transcribed in the system (not confirmed by the registrar):" | 26 | The curriculum placement is a transcription held in the system, not a confirmed curriculum. |
| `01-case-inventory.md` | /registrar curriculum lists MA 8 Integral Calculus/g → "registrar curriculum transcription held in the system (not confirmed by the registrar) lists MA 8 Integral Calculus" | 1 | The same: a developer note stated a transcription as the registrar's curriculum. |

## Changed form wording
| Question | Version 1 | Version 2 |
|---|---|---|
| 0 | (none) | Is this case within your expertise? Yes / No, it is outside my expertise |
| 1 | … / Insufficient evidence to judge | … / Insufficient information to judge |
| 3 (CLO and PO) | "The CLO develops a real part of the PO; other parts may be developed by other CLOs or courses" / "The CLO must show every part of the PO" / Other | "A CLO can be aligned by developing part of the PO" / "A CLO is aligned only if it addresses every part of the PO" / "The distinction did not affect my answer for this case" / Other |
| 4 | Yes / No / Unsure | Yes / No / Unsure / Insufficient information to judge, and 4b: did it affect question 1? |
| 5 | … / Refer for a policy decision / Other | … / Refer for a policy decision / Insufficient information to recommend / Other, with guidance on naming a target |
| 6 | … / Not applicable | … / Not applicable / Cannot tell |
| Part B rating | Appropriate as written / Acceptable with edits / Not appropriate | … / Cannot judge, with a reason |
