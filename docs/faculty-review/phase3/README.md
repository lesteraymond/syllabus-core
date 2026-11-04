# Stage E.9 Phase 3 — Whole-Syllabus Faculty Review Package

Generated offline by `node scripts/export-phase3-faculty-review.cjs` from `server/lib/syllabuscheck/eval/phase3/manifest-phase3-1.json` (manifest SHA-256: `2da030d93433c36511cce9a2196096511f17568053d611e22521d267fad0ae36`).

- **Status:** `DRAFT — developer-written expectation, NOT faculty-reviewed`
- **Offline execution:** `true` (zero AI provider calls, zero database access)
- **Auto-populated faculty verdicts:** `0` (all `facultyJudgment`, `facultyExplanation`, `reviewedByRole`, and `reviewDate` fields are blank for faculty completion)
- **Total review records:** `132` (`117` declarative defect expectations + `2` open adjudication item + `13` deterministic/identity edge cases across `46` defects and `9` edges)

## Files in This Package
- `phase3-faculty-review.json`: Structured machine-readable records with full provenance, original vs. modified content, CLO/ILO context, expected findings, verbatim evidence quotes, upstream dependencies, suggested recommendations, academic recommendation review considerations, and blank faculty sign-off fields.
- `phase3-faculty-review.csv`: UTF-8 spreadsheet (opens in Excel) with one row per review record and dedicated columns for faculty judgment, explanation, reviewer role, and review date.
- `phase3-faculty-review.html`: Printable browser view grouped by program, course, and curriculum version.
- `README.md`: Review instructions, provenance disclosures, and Academic Recommendation Review considerations.

## Provenance and Institutional Approval Disclosures
- **BSIT (`2022-2023`, `IT 202`), BSIE (`2022-2023`, `IE-402`), BSCpE (`2022-2023`, `CpE-304`)**: Course identity and Program Outcomes/EGAs come from the repository's transcriptions (`server/db/local-curriculum-data.cjs`, `server/db/local-outcome-data.cjs`). The 18-week lesson plans, descriptions, CLOs, and references are **synthetic** and written for evaluation testing.
- **BSIT-CYBERSECURITY (`2025-2026`, `CS-301 Introduction to Digital Forensics`)**: Both the 18-week syllabus plan and the offline curriculum status are synthetic/unconfirmed (`syllabusSynthetic: true`, `identityStatus: "transcribed_approval_not_confirmed"`). It uses the shared BSIT Program Outcomes and EGAs (`outcomeSource: "BSIT"`) without executing the `program_outcome_sources` migration.

## Academic Recommendation Review Considerations (Section 4)
### 1. Unsupported supplied test materials ("the provided test cases" / "the provided test data") (`supplied_test_materials`)
- **Reference cases:** as-prog1-keywords, bsit-row10-assessment-subtle, cyber-row10-assessment-subtle
- **Current behavior:** In Stage C r8 (as-prog1-keywords), a released assessment draft asks students to "run it on the provided test cases". The static reviewer (recommendationReview.js resources-4) withholds "the provided simulated measurement data" as assumes_resource, but gives no note for "the provided test cases" or "the provided test data" because programming test sets are outside its current resource noun vocabulary.
- **Question for faculty / QA (BSIT / Cyber Security Faculty & QA Reviewer Policy):** Should assessment recommendations that rely on faculty-supplied test cases or test data ("the provided test cases", "the given input file") carry an advisory note or withholding code when the lesson does not state that test cases are provided, or are instructor-supplied test inputs an ordinary part of a programming task?
- **Status:** Documented for faculty review; resources-4 unchanged.

### 2. Recommendations modifying approved contact hours (lecture / laboratory hour changes) (`contact_hours_modification`)
- **Reference cases:** CUR-05 (lecture/lab units), Stage E.8 contact-hour probes, bsie-row1-activity-passive, bscpe-row1-activity-passive
- **Current behavior:** Stage E.8 established that course contact hours (lecture and laboratory units) change only with institutional and registrar approval. Currently, no dedicated reviewer code enforces contact-hour invariance: "Add two more lecture hours for guided practice." receives no reviewer note, while "Convert one lecture hour into a laboratory hour." is withheld only as an assumed laboratory (assumes_resource), even if phrased as subject to department approval.
- **Question for faculty / QA (Academic QA / Institution & Architecture Approval):** Should a dedicated changes_contact_hours withholding code be activated in the static draft reviewer so any recommendation that adds, removes, or converts lecture/laboratory contact hours is automatically withheld?
- **Status:** Proposed (changes_contact_hours not yet implemented); documented for review.

### 3. Cross-relationship copying in drafts and explanations (copies_other_relationship vs borrowed_wording) (`cross_relationship_copying`)
- **Reference cases:** af-prog1-irrelevant, af-prog1-single-format, vu-prog1-name-only, vm-prog1-respect-supported, af-syseng-irrelevant, as-prog1-too-high
- **Current behavior:** When multiple relationships share a batch, the model can copy phrases from a sibling relationship into a draft or explanation. Static review withholds drafts with copies_other_relationship when 4-word sequences come from another week/relationship, and attaches advisory borrowed_wording / borrowed_context notes for smaller overlaps. In Stage D1 (vu-prog1-name-only), a saved draft copied another lesson's value statement, and in vm-prog1-respect-supported an explanation borrowed truthful test-log reporting from another week.
- **Question for faculty / QA (Program Faculty & Values Office):** Confirm that any draft or explanation borrowing activities, artifacts, or behaviors from a different lesson week must be rejected or withheld during faculty validation, and verify whether borrowed_wording advisory thresholds match faculty expectations.
- **Status:** Enforced for drafts via copies_other_relationship; explanations flagged for manual/faculty review.

### 4. Conditional resource recommendations ("if available" / "where available") in laboratory-0 and laboratory-bearing courses (`conditional_resource_recommendations`)
- **Reference cases:** af-sensors-passive, bsie-aligned (3/0 lecture-only), bscpe-aligned (3/0 lecture-only), bsit-aligned (2/1 lab), cyber-aligned (2/1 lab)
- **Current behavior:** Unconditional introduction of unestablished equipment, software, or laboratory facilities is withheld as assumes_resource (blocking). When a draft qualifies a resource with "if available" or "where available" (for example in a 3/0 laboratory-0 course like BSIE IE-402 or BSCpE CpE-304), resources-4 records conditional_resource as an advisory warning without withholding the draft.
- **Question for faculty / QA (BSIE & BSCpE Program Chairs / Faculty):** For laboratory-0 courses (lecture 3, laboratory 0), is a conditional phrasing ("using simulation software if available") acceptable as an advisory suggestion, or should resource-dependent suggestions in 0-lab courses be withheld unless the syllabus already names the tool?
- **Status:** Advisory warning (conditional_resource) active; documented for faculty review.

### 5. Unresolved academic disagreement: bare submission instruction "- Submit your work." (as-prog1-vague-evidence / Catalogue 8.4) (`as_prog1_vague_evidence_disagreement`)
- **Reference cases:** as-prog1-vague-evidence, bsit-row10-vague-submit
- **Current behavior:** For the assessment task "- Submit your work." in a practical Java programming lesson, the developer provisional expectation accepts PARTIALLY_ALIGNED (with measures: partly, evidence: vague), treating a bare instruction like the r8 bare-name rule ("- Quiz"). In the Stage C r8 unseen-cases run, the model answered NOT_ALIGNED (measures: no, evidence: vague, level: too_low) because the task names no observable product or artifact, and under the r8 contract measures: no requires NOT_ALIGNED.
- **Question for faculty / QA (BSIT Faculty (2 independent reviewers + Program Chair adjudicator)):** Adjudicate Q1-Q5 (Stage E.9 Phase 2 Closeout §4.6): (Q1) Should "- Submit your work." be PARTIALLY_ALIGNED, NOT_ALIGNED, or either? (Q2) Is measures: partly or measures: no? (Q3) Should level allow "cannot_tell" when no difficulty level is stated, or is too_low acceptable? (Q4) Should the r8 bare-name rule be extended to bare instructions (requiring prompt r9)? (Q5) Is the model's proposed draft acceptable?
- **Status:** OPEN — excluded from agreement scoring until faculty adjudicate; both developer expectation and model answer preserved unchanged.
