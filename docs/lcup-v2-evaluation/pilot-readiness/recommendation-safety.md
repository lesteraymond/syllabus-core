# Recommendation safety assessment: three-case smoke test

This assessment covers the three Content-ILO recommendations in `../live-smoke-REVIEWED/` (run of 2026-10-29).

- **What it is:** a technical pre-assessment written before faculty review. It is not a faculty judgment.
- **What it assumes:** the faculty-authored texts are not assumed to be wrong.
- **What it changes:** nothing. Policy V2, the prompts, the rules and the data are all unchanged.

Evidence:

- `readiness.json` (`contextRisk`);
- the smoke run's `results.json` and `raw/*.request.json`;
- the fixtures in `docs/lcup-approved-offline/`.

## What Claude saw, and what it did not

Each request carried:

- the week's course content (the source);
- one ILO, including its printed `[CLO n]` label (the target);
- the course card: code, title, program, year level, description, and the CLO statements as an unnumbered list.

Each request did not carry:

- the same week's activities, tasks and values;
- the week's other ILOs;
- any other week;
- the CLO numbers, the structured ILO→CLO tags, and the CLO→PO/EGA tags.

## Two separate outcomes per case

The judgment outcome is the label. The recommendation outcome is the correction. Faculty review is still required for both.

| Case | Judgment outcome | Recommendation outcome | Cause of the recommendation problem |
|---|---|---|---|
| IT 202, Week 1 → ILO 1 [CLO1] | PARTIALLY_ALIGNED: plausible | Unsafe as written: drops the `[CLO1]` label | Recommendation quality |
| IE 402, Week 1 → ILO10 [CLO 4] | NOT_ALIGNED: defensible for the content column only | Unsafe: no ILO would still state CLO 4's spirituality competence | Both |
| CpE 304, Weeks 2–3 → ILO1 [CLO1] | PARTIALLY_ALIGNED: defensible as partial coverage | Unsafe: narrows an objective that Weeks 7–8 reuse | Mainly missing context |

### IT 202 (recommendation quality)

**Missing context does not explain it.** The `[CLO1]` label was inside the text Claude received. The week's unsent activities and tasks add no Java content. They cover:

- setting expectations;
- discussing the LCUP/CITE Vision, Mission and Goals;
- reviewing the course and its policies.

**Judgment.** The label is plausible. One weak point: the explanation calls the Bloom level "too high", but the model's own fields show Remember → Understand, only one level apart.

**Recommendation.** The draft drops `[CLO1]`, although the Policy V2 prompt says "Preserve source wording and mappings". Applied to this text, the draft would keep the structured tag `clo:it202_clo1` but remove the label from the ILO text.

**Faculty text.** An orientation ILO that previews the course's Java and ethics focus is a legitimate choice. The text is not necessarily wrong.

### IE 402 (both causes)

**What Claude saw.** It had CLO 4's statement, as the fourth unnumbered outcome. It also had the description: "integrates Marian Augustinian values into each lesson".

**What Claude did not see:**

- Week 1's activities, which include "Discussion on the Vision, Mission and Goals of LCUP and of CITE";
- Week 1's values: "Interiority, Respect, Obedience";
- that this is the only ILO in the plan that mentions the spirituality competence:
  - ten other ILO entries tagged CLO 4 (Weeks 10–18), none of which mentions spirituality;
  - the ILO10 in Weeks 12–14, a different statement with the same number.

**Judgment.** NOT_ALIGNED is defensible within Content-ILO, because the content column lists only orientation logistics. The week as a whole may still support this ILO through its activities and values, which Content-ILO does not look at. The faculty mapping may be intentional.

**Recommendation.** The draft turns the ILO into an orientation outcome: "Explain the course objectives, requirements, grading system and policies…". It keeps only a mention of how Marian Augustinian values are integrated. No ILO would then state CLO 4's competence: demonstrating the spirituality through value webbing. Claude's own explanation ("belongs to a later value-integration lesson") points to fixing the mapping or the content, not rewriting the ILO.

**Contract factor.** For a failing Content-ILO link, the existing response contract requires `REWRITE_TEXT` with a draft (`gemini.js:342-356`):

- `REVIEW_REQUIRED` is refused;
- `RETAG_OUTCOME` is not allowed for this relationship type.

Claude therefore could not answer "no field-level rewrite".

### CpE 304 (mainly missing context)

**What Claude did not see.** Neither of these was sent:

- the same ILO1 statement is also mapped to Weeks 7–8, whose content is analog-to-digital and digital-to-analog conversion (sampling, quantization, encoding). That is the "digital" part Claude found missing from Weeks 2–3;
- Weeks 2–3 also have ILO2: "Understand the design process of electronic circuits and systems."

**Judgment.** PARTIALLY_ALIGNED fits "this week covers part of the objective". The reasoning, however, treats the breadth of an objective that spans several weeks as a defect.

**Recommendation.** The draft narrows ILO1 to differential amplifiers and the design of one simple analog circuit. That would:

- remove the digital scope that Weeks 7–8 depend on;
- leave the two weeks with different wording for the same objective;
- add the design process, which ILO2 already covers.

**Contract and quality factors.** As for IE 402, the contract required a rewrite. The course description Claude did receive mentions signal converters and digital processing systems, so the narrowing is also partly a recommendation-quality problem.

**Note for faculty, not a finding.** ILO1's wording is close to CLO 2 ("Develop analytical and design skills for both analog and digital…"), but it is tagged CLO1.

## Context needed before suggesting a field-level correction

1. **The whole week row:** activities, tasks, values and the week's other ILOs. An ILO can be supported outside the content column (IE 402), and ILOs in the same week share scope (CpE 304).
2. **Every other week that uses the same statement or field text.** A reused objective should never be narrowed or widened on the evidence of one week (CpE 304).
   - In the pilot, 12 relationships can produce a correction.
   - Six of them target text that repeats in 13–14 other weeks: BM1-S01-003, BM1-S07-004, BM1-S14-004, BM1-S13-001, BM1-S20-001 and BM1-S01-002.
3. **The target's numbered mappings:** its CLO tags and printed labels, and the mapped CLO's PO/EGA tags. A rewrite must keep supporting the same CLO and keep the printed label (IT 202, IE 402).
4. **How the mapped CLO is covered across the plan,** including whether the target is the only ILO that states that competence (IE 402).
5. **Numbering conventions.** ILO numbers are not unique:
   - in IT 202, six other weeks each use ILO 1 for a different statement (one is printed "LO1");
   - IE 402 has a second ILO10.

   A correction must be tied to the field path and ID, never to the label.

Until a request carries this context, faculty should treat a field-level draft for Content-ILO, ILO-CLO, Content-course or ILO-activity as a prompt for their own review, not as replacement text.

**Possible improvements after the pilot baseline (none implemented):**

- send the context listed above;
- allow a non-rewrite outcome when the fix belongs in a different field;
- add static draft checks that keep the "ILO n:" prefix and the `[CLO n]` label, and that flag a draft whose target is reused in other weeks.

## The two outcomes stay separate in the evaluation

- **Report rows** (`report.cjs`) hold the judgment and the recommendation in different fields:
  - judgment: `actualJudgment`, `status`, `potentialFalseApproval` and `potentialFalseRejection`;
  - recommendation: `recommendedCorrection`, `recommendationReview` and `academicRecommendationAppropriate`, which stays null until faculty rate it.
- **Measurement** (`scripts/lcup-academic-benchmark/measure.cjs`) keeps them in different sections:
  - `academic`: label agreement, false approvals and false rejections against faculty labels;
  - `recommendations`: separate faculty ratings of each correction (yes, partly, no or cannot judge).

A correct label with an unsafe correction (likely IE 402) is therefore recorded as two outcomes.

## No recommendation can rewrite faculty content or change a mapping automatically

- **The evaluation runner** writes only to its own run folder and the spend register.
  - It loads no database module.
  - It stops if a prompt source, case, context or source PDF changes (`verifyBundle`).
  - Every repo file outside `node_modules`, `.git` and `tmp` was hashed before and after the smoke run. The run added only its run folder and receipt, and changed only the spend register.
- **Policy V2 in the app is preview-only:**
  - previews are generated from stored offline answers, not live AI calls;
  - a preview carries `suggestions: []` (`academicPolicyV2.js:135`);
  - a preview cannot be stored as an official run or replace a report (`compliance/service.js:86`, `syllabuscheck/repository.js:30`).
- **Hybrid-2 suggestions in production** need a person's explicit accept or edit (`src/lib/hybridCheck.js`, `decideSuggestion`). Applying one is refused if:
  - the field has changed since the check ran;
  - the row or ILO ID has changed.

  Every decision is logged, and the change can be undone.
- **What a suggestion can patch.** The apply step accepts only text fields from a fixed list. It cannot patch:
  - ILO→CLO tags (`ilos[].tags`);
  - CLO→PO/EGA mappings (`clos[].pos`, `clos[].egas`).

  CLO tags are built from printed labels only at PDF import (`pdfImport.js:124`), never when a suggestion is applied.
- **The master texts** (Vision, Mission, EGA, PO):
  - no AI relationship targets them;
  - the `outcomes.*` entries in the apply list serve only the coded "Use the exact master text" suggestion, which restores the official wording (`engine.js:57, 91, 94`).
- **Remaining risk:** a person who accepts an AI text suggestion as written could drop a `[CLO n]` label typed into the ILO text, as the IT 202 draft would.
  - The structured mapping stays, and the decision is logged.
  - PDF import already moves printed labels out of the ILO text and into the tags (`pdfImport.js:121-128`), so an imported ILO has no label to lose.
  - The evaluation fixtures keep the labels in the text.
