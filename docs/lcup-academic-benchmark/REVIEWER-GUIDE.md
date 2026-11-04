# Independent faculty academic review

Package: `lcup-academic-benchmark-1`. Policy: `academic-evaluation-v2-preview-1`. **Draft review materials; no faculty answer key and no Claude evaluation has been run.**

Open the HTML file for your program in [package/](package/), or work in a separate copy of its response JSON/CSV. The HTML forms operate locally, make no server request and export JSON. Save an export before closing or reloading: unsaved entries are not retained. A JSON export is a return for coordinator validation, not automatic adjudication or institutional approval. Keep the original blank package unchanged.

The complete pool has 812 cases. The coordinator can begin with [76 coverage-selected cases](package/pilot-selection.json), including 28 weekly-relationship cases. This is not a correctness-balanced sample or a ready-to-send Claude batch: 17 selections have reference holds. A reviewer's assignment and expertise must be confirmed before distribution. Nobody has been assigned in the templates.

## Part A: your independent judgment

Record your reviewer identification, date and expertise. For each assigned case, read the source, target, original course/CLO context and cited source pages. Distinguish verified syllabus evidence from synthetic prose. Synthetic prose and mapping tags are author-written stimuli, not approved faculty syllabi. Approved curricula/POs remain references even when the lesson text is synthetic.

Choose an expected judgment only when you can justify it:

- `ALIGNED`: supplied evidence supports this particular academic relationship.
- `PARTIALLY_ALIGNED`: the relationship has meaningful support but a material gap or ambiguity remains.
- `NOT_ALIGNED`: there is a substantiated mismatch in this particular relationship.
- `INSUFFICIENT_EVIDENCE`: the supplied information cannot support a defensible judgment.

Leave an answer blank if you have not reviewed it. Record outside-expertise or unresolved-policy cases for reassignment/review; do not guess. Do not treat a missing institutional reference as a faculty error. A reference hold does not prescribe a judgment. Give the coordinator the exact issue that needs resolution.

For each judgment, quote supporting text from each supplied side where available, explain the reason, identify the responsible field or relationship, and recommend a specific correction where appropriate. If a side is missing, say what is missing instead of inventing a quotation or CLO tag. Preserve faculty wording when you quote it. Do not silently fix printed typos, renumber POs or infer an unprovided crosswalk.

The seven required weekly relationships are independent:

1. Course Title ↔ Course Content.
2. Course Content ↔ ILO.
3. ILO ↔ assigned CLO.
4. Course Content ↔ Suggested Learning Activities.
5. ILO ↔ Suggested Learning Activities.
6. Course Content ↔ Suggested Assessment Tasks.
7. Suggested Learning Activities ↔ Suggested Assessment Tasks.

A populated field, shared keyword or supported neighboring link is not proof of alignment. An unrelated topic can coexist with internally related ILOs, activities and assessments: judge the title/content link independently. Conversely, do not fail an otherwise sound link solely because a different field is wrong.

For mappings, distinguish a sound statement with an incorrect tag from a statement that actually needs rewriting. Keep supported tags, identify questionable additional tags and do not invent replacements. For a missing mapping, describe the required review. In real CLO–PO cases, the displayed source is the **authored PDF's PO meaning**. Frozen database-planner text is retained separately in the JSON, and reference holds prevent its silent conversion to the designated official numbering.

For other cases:

- Judge four-CLO count and classification-label completeness separately from whether the classification fits the statement academically.
- Use the selected program's curriculum. BSIT IT 202 and Cyber IT-202 are different subjects. Cyber inherits BSIT's nine POs while retaining its own curriculum.
- Grouped weeks provide shared cells; do not invent which topic occurred in an individual week. Week 1 timing within a group may require confirmation.
- Examination rows remain in the schedule and are exempt from instructional seven-link cases. An orientation does not automatically need laboratory practice.
- Assess learner support, activity quality and content/value integration using the actual lesson. A value name alone is not evidence of meaningful integration. Definition approval is still pending; record interpretation questions.
- `Assessment-fit` cases are optional deeper diagnostics. They do not create a required eighth direct ILO–Assessment relationship or change Policy V2's required disposition.
- Four-CLO, schedule, required-field and APA-text cases are objective/review scope, tracked separately from semantic accuracy. Plain text does not establish italics, hanging indentation, reference authenticity or the whole exported document layout.

Read the [reference verification report](reference-verification.md) and existing [exact official PO wording/pages](../lcup-po-correction/exact-program-outcomes.md). The case JSON supplies source hashes, pages and raw excerpts; the original PDFs are the reference when an extraction is unclear.

## Part B: recommendation and evidence review

Return and freeze your Part A before viewing Part B or a model answer. Do not revise your independent judgment merely to match the model. Any correction or clarification needs an append-only explanation and date in the review record.

The supplied [Part B page](package/faculty-part-b.html) contains **eight synthetic proposal examples, not Claude outputs**. Rate their appropriateness, grounding, preservation of valid mappings and actionability, and explain your reasoning. Both grounded-looking and unrelated-looking proposals remain unlabelled until faculty review. The coordinator's construction intent is not a correct answer.

After a separately authorized actual Claude run, genuine recommendations and explanation/evidence records can be reviewed against the frozen Part A. The [model-evidence review template](package/model-evidence-review.template.json) asks separately whether quoted evidence is accurate, relevant, supports the explanation and handles reference uncertainty honestly. Its fields are blank because no model output exists yet. Actual Claude recommendation quality cannot be measured from the synthetic proposals.

## Coordinator handling

Reuse the existing independent-review and adjudication procedure from the earlier faculty packages. For this new benchmark, obtain two independent qualified reviews where possible, document disagreement and use an identified adjudicator/panel. This is the proposed benchmark protocol, not a newly approved institutional acceptance threshold.

The [adjudication template](package/adjudication-template.json) is deliberately separate from raw responses. Preserve returned originals. Record reviewer IDs, adjudicator, date, accepted judgment(s), ambiguity, exact evidence, rationale and a record reference. Do not average categories or take a majority automatically. Multiple defensible labels remain explicit. No automatic number-to-number PO conversion is provided.

Distribute only assigned reviewer HTML/blank response materials, this guide and relevant references. Keep `coordinator-only.json`, future model answers and other reviewers' returns out of Part A. Filename separation is not an access-control system; the coordinator must manage actual distribution. No materials have been sent by this preparation task.
