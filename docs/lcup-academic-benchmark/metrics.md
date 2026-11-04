# Proposed academic accuracy measurement

These are descriptive evaluation measures, not official syllabus scores, acceptance thresholds or new academic weights. No institutional cutoff is assumed. The prepared benchmark has **zero faculty gold labels and zero genuine Claude responses**; all current accuracy rates are `null`, as recorded in [not-yet-measurable.json](not-yet-measurable.json).

## Eligible comparison and provenance

Keep raw independent returns separate from adjudicated references. The adapter requires an identified adjudicator, at least two distinct reviewer IDs under this proposed protocol, review date, accepted label(s), ambiguity flag, rationale, exact supplied evidence and an external review-record reference. This is an audit requirement for the benchmark, not a claim that identity or expertise can be proved by a string in JSON. The coordinator must verify the actual records and qualifications. No raw single return is promoted automatically.

Bind every file to benchmark version/hash, every observation to case ID/hash, and future model results to the V2 policy, model/run/prompt identity and raw transcript hash. A model result must name **plannedCaseIds** explicitly. Unknown/duplicate/stale observations and unplanned responses are rejected. Objective-review, unresolved reference-held and review-only PO cases cannot be placed in a model run plan.

Use `faculty-adjudication` provenance only after actual review; use `controlled-Claude-evaluation` only for actual retained run data. Synthetic unit-test records are accepted only through an explicit test-only function option and yield `synthetic-software-validation-only`, never faculty accuracy. The command-line tool does not expose that test-only option.

Only in-scope, faculty-adjudicated semantic cases with validated supplied responses enter agreement/error denominators. Preserve counts and report unavailable/invalid/unevaluated evidence beside those conditional rates. Do not quietly include objective field completeness in academic accuracy or merge optional C2 diagnostics into the seven required links.

## Measures

| Measure | Definition / denominator | Availability |
|---|---|---|
| False academic approvals | Model `ALIGNED` when the nonambiguous faculty accepted labels exclude `ALIGNED`, divided by answered clear non-aligned cases | Implemented through existing `qualityOf` and `scoreEval`; counts and explicit denominator retained |
| False academic rejections | Model label other than `ALIGNED` when the sole nonambiguous faculty label is `ALIGNED`, divided by answered clear-aligned cases | Implemented; distinguish partial/not-aligned/insufficient labels. Invalid or absent responses are not silently treated as rejections |
| Strict agreement | Exact match on a single defensible faculty label / answered single-label cases | Implemented; counts and rate |
| Permissive agreement | Model label in the documented faculty accepted set / answered cases | Implemented; multi-label ambiguity does not enter clear false-approval/rejection denominators |
| Each of seven relationships | The above counts/rates independently for Content-course, Content-ILO, ILO-CLO, Content-activity, ILO-activity, Content-assessment and Activity-assessment | Implemented; another passing relationship cannot cancel an error |
| Program differences | Same measures by BSIT, Cyber, BSIE and BSCpE, with sample/source composition visible | Implemented; Cyber has synthetic evidence only, so no real-Cyber generalization is possible |
| Real versus synthetic | Separate agreement/error groups by source kind | Implemented; do not pool 308 synthetic examples into a claim about faculty-authored syllabi |
| Missing/incomplete evaluation | Selected/planned, attempted, never attempted, contract/evidence-verified, unresolved; unselected review-pool cases and reference-held backlog separately | Reuses `createTracker`; zero plan currently means no run started, not a completed evaluation |
| Mechanical quotation accuracy | Exact/whitespace quote containment and quote refusals | Existing validator/quality diagnostics; this is not semantic evidence accuracy |
| Faculty evidence accuracy | Independent ratings of quote accuracy, relevance, explanation support and honest handling of reference holds; yes/partly/no/cannot-judge counts and reviewed-item share | Blank template prepared; measurement accepts bound evidence-review records after actual model data exists |
| Recommendation quality | Faculty ratings of appropriateness, grounding, valid-mapping preservation and actionability, with reasons/corrections; report disagreements and cannot-judge separately | Template and descriptive rating adapter prepared; current eight examples are synthetic. Genuine Claude ratings remain unavailable |
| Whole-profile false approvals/rejections | V2 supported/revision disposition versus a complete-scope faculty syllabus disposition, under the same required-scope/reference version | **Not measurable yet**; no genuine V2 report or complete-scope faculty disposition exists. No second disposition calculator is introduced |
| Stability, latency, tokens and cost | Existing runner logs and repeat-run comparison where separately authorized | Existing infrastructure available; not measured by this preparation and not used as academic accuracy |

The present metrics adapter counts recommendation appropriateness ratings separately for `synthetic-proposal` and genuine `Claude` origins. Claude proposals require matching run/transcript/case provenance. Evidence relevance and explanation support remain human judgments even when every quotation is mechanically exact. No synthetic rating is published as model quality.

Returned originals, clarification history and adjudications should be immutable. The existing faculty importer already supplies agreement/kappa/alpha utilities for its own package. Its package-specific import and statistical reporting rules must not be mistaken for an institutionally approved AI acceptance threshold; broader reliability statistics can be added to a reviewed aggregation of the new returns later without changing the checker.

## Experimental limits and review decisions

The 812 cases contain correlated links from the same lessons and synthetic variants from the same domain. They are not 812 independent syllabi or a random population sample. The 76-case subset selects coverage only; it is not a sensitivity/specificity sample with known positives/negatives. Faculty must establish those labels independently.

Before genuine evaluation, freeze the source/reference version and selections, document reviewer expertise and adjudication procedure, and predeclare how ambiguous/held cases are handled. Keep original-syllabus and synthetic sibling families together when deciding development versus independent validation use. No new held-out partition is claimed, and the protected existing 42-case held-out dataset is not incorporated. If cases are used to tune prompts, report that use and do not describe later performance on them as independent validation.

Publish sample counts, exclusions, raw versus verified failures and coverage beside every rate. No current percentage, institutional acceptance threshold or statement of academic accuracy can be derived from the software unit tests.
