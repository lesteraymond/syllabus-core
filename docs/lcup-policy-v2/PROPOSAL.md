# Academic Evaluation Policy V2 — draft for institutional review

Proposal ID: `academic-evaluation-v2-proposal-1`. Date: 2026-10-29. **Not approved, not active.**

This proposal does not replace the current runtime `syllabus-policy-2`. The two names are different version namespaces. No production configuration, scoring code, deductions, passing mark or submission gate is changed by this document or its offline comparison.

## Recommended policy: separate compliance from academic evidence

Keep the current deterministic compliance result and its provenance as one axis. Report academic alignment as a separate, coverage-aware profile. Do not average completeness into academic alignment or call a well-populated syllabus academically sound because its fields score highly.

The academic profile must report each required criterion as supported, partially supported, not supported, not checked or explicitly not applicable. It must retain all independent pair judgments, exact evidence, reference versions, faculty-review needs and recommendations. Its proposed disposition is separate from the existing official pass/fail result:

- **REQUIRES_REVISION:** a required relationship has a supported, substantive misalignment finding. Name the field and reason. This is a proposed academic disposition, not an activated submission gate.
- **FACULTY_REVIEW:** a partial relationship, ambiguous mapping, disputed evidence, source conflict or unconfirmed interpretation needs a decision.
- **NOT_EVALUATED / PARTIALLY_EVALUATED:** required observations are unavailable, disabled, missing or unverifiable. This is neither academic approval nor proof of poor learning quality.
- **SUPPORTED_BY_SUPPLIED_EVIDENCE:** the scoped profile is complete with no open issue in the supplied evidence. This is not faculty approval or a calibrated accuracy claim.

Keep the current official threshold **79** unchanged. Do not transfer it to an academic percentage without an explicit institutional decision. The isolated projection issues no new official academic score, academic pass decision or submission decision.

## Seven required weekly relationships

| Required relationship | Existing implementation to reuse | Policy V2 evidence unit |
|---|---|---|
| Course Title ↔ Course Content | Stage B `Content-course` | Each instructional lesson |
| Course Content ↔ ILO | Stage B `Content-ILO` | Every ILO of that lesson |
| ILO ↔ CLO | Core `ILO-CLO`, B3 mapping advice | Every ILO and its explicit CLO mappings |
| Course Content ↔ Activities | C3 `Content-activity` | Each instructional lesson |
| ILO ↔ Activities | Core `ILO-activity`; C1 for deeper support | Every ILO of that lesson |
| Course Content ↔ Assessment Tasks | C3 `Content-assessment` | Each instructional lesson |
| Activities ↔ Assessment Tasks | C3 `Activity-assessment` | Each instructional lesson |

All seven are required in the proposed academic evidence profile. Their results remain independent: one passing link cannot cancel another failing link. The production switches remain as they are; no new stage is needed to define this policy.

For course-wide summaries, use one cell per relationship per instructional lesson. Where a cell contains several ILOs, retain every ILO observation and mark the cell supported only when each required ILO is supported. This avoids giving a course more weight simply because one faculty member split an outcome into several statements. The exact reporting unit and any future numeric weighting need faculty validation.

For explicit ILO–CLO tags, preserve the current principle that an ILO needs at least one supported CLO, while keeping contradictory or unverified additional tags as mapping-review issues. The same course-level principle applies to at least one supported PO and EGA per CLO; do not automatically delete other tags, remap numbers or rewrite a sound statement to fit an unsuitable tag. Faculty must confirm incorrect/ambiguous mappings before academic sign-off.

The core reverse-direction `ILO-content` check remains available as diagnostic evidence. For the proposed canonical content-first criterion, use `Content-ILO`; the prompts ask related but different questions. Do not silently substitute one for the other or count both as two scored obligations. A discrepancy between their answers is review evidence, not a reason to select whichever label is more favorable.

## Preserve every other original requirement

| Requirement | Proposed treatment and evidence | Limitation/decision |
|---|---|---|
| Course identity and title | Existing program/curriculum/code/title checks; bind academic interpretation to the selected approved version | Reference conflicts must be resolved; a missing reference is not a faculty defect |
| Description fits title and taught plan | Existing `Title-description` and `Description-plan` | Title alone may not establish all required scope; no invented approved description |
| Exactly four CLOs | Existing four-CLO finding is a required academic-profile criterion | It remains advisory in production until a separately approved policy change |
| CLO classification coverage | Introductory, Enabling, Demonstrating and Integration of Values; existing coverage finding | Correct classification by meaning needs academic review; labels alone do not establish it |
| CLO ↔ Course Title / PO / EGA | Existing Course-CLO, CLO-PO, CLO-EGA and mapping evidence | Require authoritative/versioned masters; do not assume approved-source syllabi must score 100 |
| Weeks 1–18 | Existing schedule validation, including ranges, gaps, duplicates and exams | Schedule completeness and academic adequacy are separate |
| Week 1 course introduction/objectives | Existing introduction advice using title, supplied CLO context and lesson evidence | CLOs are the current schema's objective context; grouped-week timing needs faculty confirmation |
| Diverse learner support | Existing C1 learnerSupport evidence and concrete barriers/support | Current C1 is conditional; an unasked question remains not checked, never implicitly adequate |
| Marian-Augustinian values | Separate approved-name evidence, actual weekly integration and reference-definition status | Local definition/lexicon approval status must be respected; no keyword-only claim of meaningful integration |
| APA 7 | Existing D2 text-format/component checks, source type and uncertainty | Plain text cannot certify hanging indents, italics or every source category; relevance/authenticity are different questions |
| Complete headers, table columns and fields | Existing 47-rule and schema/completeness evidence | Fixed Builder headings, free text meaning and exported-document rendering are different scopes |
| Appropriate recommendations | Existing evidence/response contract, static review, dependency ordering and human acceptance | Grounding is necessary but not proof of academic appropriateness; faculty must judge proposals |

The full profile cannot be marked complete merely because the seven weekly links are supported. Course-level, values, APA and learner-support requirements remain visible. Do not create fabricated faculty judgments for unobserved criteria.

## Avoid duplicate penalties without hiding independent findings

The recommended profile uses no cumulative academic point subtraction, so a common root cause cannot be charged repeatedly. Remediation grouping reduces repeated work, not the visibility of failed relationships.

1. Keep stable IDs, source/target context hashes, scope, quotes and provenance for every observation. Duplicate/conflicting answers for the same ID are unresolved evidence; they are not counted twice and not resolved by taking the last answer.
2. Keep each required relationship as its own finding. Aggregate only for a clearly defined reporting unit, retaining its raw observations.
3. A shared field or recommendation path is **not** proof of a shared cause. One task can have unrelated subject-fit and feasibility problems. A wrong ILO can also cause failures in several different target fields.
4. Merge remediation roots only with an explicit causal explanation and reviewer/provenance. Until confirmed, mark the grouping provisional. The controlled experiment declares its own causes as scenario assumptions, never as faculty confirmations.
5. Keep one corrective action for a confirmed shared root, while listing every affected link. Recommendations follow existing dependencies: Course Content, ILO, CLO mapping, Activities, Assessment. Never rewrite multiple downstream cells to accommodate the same upstream mistake.
6. Do not charge both missing evidence and a semantic failure for the same absence. Completeness records the missing text/tag; the corresponding semantic criterion is not checked. A populated but unrelated statement is evaluated as misalignment, rather than “insufficient evidence.”

If an institution later chooses point deductions, charge a confirmed root once at the agreed severity, rather than summing its affected links. Genuine separate causes retain separate charges. Causal rules, severity, weights, caps and disputed-root handling require validation before that alternative can become official.

## Missing evidence, unavailable AI and reference conflicts

Use the existing four model labels and answer verification, with distinct operational states:

- Empty/missing text or mappings: retain deterministic findings; semantic evidence is missing. Do not invent a tag, source or outcome.
- Provider disabled/unapproved/unavailable, timeout, malformed response or unverified quotation: NOT_CHECKED. Record the cause and affected scope; never issue a pass or a fabricated “not aligned” label.
- Partial coverage: show how many expected units were fully evaluated, including unanswered units in the denominator. Do not calculate a completed academic grade over only the easy/answered subset.
- Long text or request limits: disclose unevaluated scope. Truncated evidence cannot certify an unseen remainder.
- Reference conflict: distinguish factual mismatch from faculty error. Keep source and reference versions; mark interpretation/remediation for review. Do not silently replace outcomes/curricula or renumber historical mappings.
- Examinations: retain schedule/required-field checks but exclude examination-only rows from instructional relationship denominators, using existing row handling. An ordinary instructional lesson must not disappear because it is empty.
- Grouped weeks: retain one source row and its shared evidence, without fabricating a week-by-week split. Equal per-row reporting is a descriptive convention in the shadow run, not an approved duration weight. Week 1 timing still requires confirmation where ambiguous.
- Orientation: do not invent a blanket CLO-mapping exemption. Faculty must decide how an orientation ILO should relate to technical CLOs; that institutional question remains visible.

Confidence, unknown evidence and partial alignment are not interchangeable. A model's confidence number would not establish a verified relationship or substitute for faculty validation.

## Scoring alternatives for review

| Alternative | Calculation | Rationale and impact | Approval still needed |
|---|---|---|---|
| **A. Dual-axis evidence profile — recommended now** | Keep current deterministic compliance separately. Show seven-link/course-criteria states, coverage, known problems and remediation roots; no blended academic grade | Prevents high completeness from masking known academic issues. No invented weights or double subtraction. Clear partial/unavailable states | Criterion acceptance boundaries, materiality, orientation/grouping policy, who signs off, and any future workflow effect |
| B. Separate bounded academic index | For approved nonnegative weights `w_r` summing to 1 and approved partial-credit parameter `p` between 0 and 1, compute `100 × Σ(w_r × mean_l q_lr)` over complete eligible units; `q=1` supported, `p` partial, `0` not supported. Unknowns prevent a completed point estimate | Normalizes course length and ILO splitting; keeps compliance separate. A high average can still hide one serious failure, so requires the profile and a non-compensation rule | All weights, partial credit, exclusions, severity overrides and an academic threshold. None are assigned here |
| C. Root-based academic deductions | Begin from an approved academic scale, subtract one approved severity charge per confirmed root, with approved normalization/caps | Familiar deductions; avoids charging several consequences of one confirmed cause. Causal disagreement and length/severity bias remain | Root adjudication, penalties, caps, denominator, reference-conflict handling and thresholds; not implemented |
| Retain current blended subtraction unchanged | Current weighted compliance baseline minus existing AI/link/value charges | Maximum compatibility, but leaves five required weekly relationships unscored and permits accumulation/coverage problems | Useful as a comparison baseline, not the recommended final academic policy |

No proposed numeric weights are institutionally approved. The existing `shadow-1` per-field caps (30 alignment, 10 links, 10 values) are a different earlier experiment, not Policy V2. They cannot repair coverage gaps for relationship types that never deduct points.

The isolated comparison reports descriptive support bounds: `lower = supported / expected` and `upper = (supported + partial + unknown) / expected`. These are counts expressed as proportions, not grades, confidence intervals or institutional weights. No partial-credit parameter is chosen. A single failed required relationship can coexist with a 99.05% proportion; the proposed revision/review disposition remains visible. Never apply the official 79 threshold to these descriptive bounds.

## Legacy direct ILO–Assessment check

| Option | Benefit | Risk/impact |
|---|---|---|
| Keep scored | Retains an explicit direct test that an assessment demonstrates the ILO's competence | Adds a scored obligation outside the final seven; multiple ILOs can multiply charges on one assessment and duplicate a root covered by other links |
| **Make advisory-only in an approved future policy — recommended** | Retains a useful diagnostic and C2 input while making the seven requested relationships the weekly scoring scope | Requires coordinated policy, verdict/tier and cache-version changes; advice can still be repetitive unless grouped carefully |
| Retire from proposed policy | Removes duplicate output and request cost | Pairwise alignment is not logically transitive: ILO–Activity and Activity–Assessment support does not guarantee direct ILO performance evidence. Removing the pair also affects C2 eligibility and requires an approved replacement trigger |

Keep the production deduction at 3/1 until authorized. The comparison's legacy-only failure has current arithmetic 97; holding other answers fixed, advisory and retirement both give arithmetic 100. This isolates a three-point charge, not a V2 grade. Retirement's lost diagnostic and C2 behavior are not captured by adding those points back.

Retain explicit direct evidence for faculty review: an assessment can be appropriate to the practiced activity yet provide weak evidence of the intended learning performance. Retiring the diagnostic before validating the seven-link coverage and reviewing C2 would remove useful information. Do not assume the final requirements authorize deletion of that information.

## Evidence and validation required before implementation

Use a reviewed, representative faculty corpus covering all supported programs, instructional/grouped/orientation/exam weeks, correct and incorrect mappings, partial/ambiguous text and meaningful learner/value/assessment examples. Keep protected evaluation material separate from tuning. No new official evaluation or held-out replay is authorized by this proposal.

Faculty must independently adjudicate each required relationship, course-level criterion, responsible field, acceptable recommendation and any shared root. Disagreements need explicit resolution. Measure per-type false acceptance/rejection, unknown/partial coverage, inter-reviewer agreement, root-group agreement, recommendation preservation/feasibility and score/disposition sensitivity by program and course length. Synthetic expected labels are not substitutes for these measurements.

Only after that evidence should the institution choose Alternative A/B/C, approve operational semantics and any numbers, approve the legacy check's treatment, and authorize implementation. A future rollout must use a new official version, retain historical report snapshots and include policy/execution configuration in cache validity. Do not silently reinterpret an existing saved score, reuse an old check under new criteria or change submission decisions during the shadow period.

## Recommended implementation sequence, after explicit authorization

1. Review this proposal and select the reporting/scoring alternative. Agree on required scope and the unresolved academic interpretations above.
2. Validate the existing seven pair types and other original criteria with faculty; keep unmeasured criteria visibly incomplete. Paid Claude work needs separate authorization.
3. Specify the accepted weights/thresholds only if a numeric alternative is chosen, and validate root aggregation and legacy-check handling.
4. Implement the approved policy as a versioned extension of the existing shared service/report, not another checker. Add complete coverage and clear compliance/academic labels. Review C1/C2 eligibility and missing-scope reporting rather than adding unnecessary stages.
5. Run read-only shadow comparisons on authorized saved reports, preserving old scores. Review transition rates and program/length effects. A later production activation, cache cutover and any gate change require explicit approval and rollback planning.

This task stops at design, isolated comparison and compatibility fixes. It authorizes no rollout, new academic score, submission restriction or feature activation.
