# Isolated Policy V2 comparison

No official policy, score or submission result is changed. The three approved-source fixtures have no new Claude/faculty judgments. Controlled cases use author-scripted hypotheses verified through the existing answer/evidence contract; they are not faculty labels. All optional runtime flags remain off.

The numeric candidate is the existing engine’s provisional arithmetic. Controlled masters retain `synthetic:true`, so their published official score is null. Support bounds are descriptive proportions, not grades, confidence intervals or a new passing threshold. With no observations, 0–100 is uninformative, not a predicted result.

| Case | Deterministic base | Current provisional candidate | Published score | Weekly supported / partial / not supported / unknown | Complete coverage | Descriptive support bounds % | Proposed weekly disposition |
|---|---:|---:|---:|---|---:|---|---|
| verified-it202 | 96 | — | — | 0 / 0 / 0 / 70 | 0% | 0–100 | NOT_EVALUATED |
| verified-ie402 | 96 | — | — | 0 / 0 / 0 / 42 | 0% | 0–100 | NOT_EVALUATED |
| verified-cpe304 | 93 | — | 0 | 0 / 0 / 0 / 56 | 0% | 0–100 | NOT_EVALUATED |
| controlled-supported-assumption | 100 | 100 | — | 105 / 0 / 0 / 0 | 100% | 100–100 | SUPPORTED_BY_SUPPLIED_EVIDENCE |
| complete-off-course-content | 100 | 100 | — | 45 / 0 / 60 / 0 | 100% | 42.86–42.86 | REQUIRES_REVISION |
| all-seven-misaligned | 100 | 10 | — | 0 / 0 / 105 / 0 | 100% | 0–0 | REQUIRES_REVISION |
| independent-Content-course | 100 | 100 | — | 104 / 0 / 1 / 0 | 100% | 99.05–99.05 | REQUIRES_REVISION |
| independent-Content-ILO | 100 | 100 | — | 104 / 0 / 1 / 0 | 100% | 99.05–99.05 | REQUIRES_REVISION |
| independent-ILO-CLO | 100 | 97 | — | 104 / 0 / 1 / 0 | 100% | 99.05–99.05 | REQUIRES_REVISION |
| independent-Content-activity | 100 | 100 | — | 104 / 0 / 1 / 0 | 100% | 99.05–99.05 | REQUIRES_REVISION |
| independent-ILO-activity | 100 | 97 | — | 104 / 0 / 1 / 0 | 100% | 99.05–99.05 | REQUIRES_REVISION |
| independent-Content-assessment | 100 | 100 | — | 104 / 0 / 1 / 0 | 100% | 99.05–99.05 | REQUIRES_REVISION |
| independent-Activity-assessment | 100 | 100 | — | 104 / 0 / 1 / 0 | 100% | 99.05–99.05 | REQUIRES_REVISION |
| same-root-four-links | 100 | 100 | — | 101 / 0 / 4 / 0 | 100% | 96.19–96.19 | REQUIRES_REVISION |
| partial-evidence | 100 | 100 | — | 54 / 0 / 0 / 51 | 51.43% | 51.43–100 | PARTIALLY_EVALUATED |
| AI-unavailable | 100 | 100 | — | 0 / 0 / 0 / 105 | 0% | 0–100 | NOT_EVALUATED |
| partial-one-relationship | 100 | 100 | — | 104 / 1 / 0 / 0 | 100% | 99.05–100 | FACULTY_REVIEW |
| untagged-ILO | 100 | 100 | — | 104 / 0 / 0 / 1 | 99.05% | 99.05–100 | PARTIALLY_EVALUATED |
| grouped-weeks | 100 | 100 | — | 98 / 0 / 0 / 0 | 100% | 100–100 | SUPPORTED_BY_SUPPLIED_EVIDENCE |
| legacy-ILO-assessment-only | 100 | 97 | — | 105 / 0 / 0 / 0 | 100% | 100–100 | SUPPORTED_BY_SUPPLIED_EVIDENCE |
| duplicate-value-name-and-meaning | 100 | 98 | — | 105 / 0 / 0 / 0 | 100% | 100–100 | SUPPORTED_BY_SUPPLIED_EVIDENCE |
| one-CLO-many-PO-links | 100 | 94 | — | 105 / 0 / 0 / 0 | 100% | 100–100 | SUPPORTED_BY_SUPPLIED_EVIDENCE |

The complete off-course-content example retains a current 100-point candidate because its scored ILO/CLO/activity/task links are scripted as supported. Sixty required relationship cells fail in the proposed profile; it requires revision. The all-seven-fail example instead falls to 10 under the current deductions, showing that current scoring does catch its scored failures. A single failure can coexist with a 99.05% support proportion; therefore a descriptive average cannot substitute for reviewing every required relationship.

The three approved sources retain their deterministic discrepancies and reference conflicts. Their academic coverage is zero, so no V2 academic score or faculty conclusion is issued. The critical course-code result for the source CpE spelling, where present, is existing deterministic behavior, not an academic verdict. No Builder identity projection or PO replacement was applied to these frozen inputs.

## Legacy ILO–Assessment options

The controlled legacy-only failure gives current arithmetic 97. Holding every other answer fixed, keeping it scored gives 97, advisory gives 100, and removing it gives 100. These numbers isolate a three-point charge; they are not V2 grades. The advisory alternative retains its diagnostic. The retirement alternative would also affect C2 eligibility, which this arithmetic comparison does not simulate.

## Root handling and evidence limits

One controlled off-course field can explain four separate failed links. The projection keeps all four findings but records one explicitly declared remediation root and no deduction total. It never infers that two findings have the same cause merely because they share a path. Declarations in this experiment are controlled assumptions, not faculty confirmations. Complete observations, quotes, recommendations, context hashes and root provenance are retained in the JSON.

The full original course/value/APA requirements are retained as a separate profile of existing typed findings; unasked criteria remain NOT_CHECKED. Passing the seven-link profile does not complete that profile or establish faculty approval. Actual accuracy, faculty agreement, calibrated numeric weights, real pass/fail shifts and recommendation acceptance cannot be measured from this run.
