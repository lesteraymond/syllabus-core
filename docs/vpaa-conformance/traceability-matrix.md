# VPAA requirements traceability matrix

Generated 2026-11-04T21:33:57.138Z. A requirement is **Implemented** when production code for it exists, **Tested** when at least one conformance test targets it, **Passed** only when every non-known-issue test passed. A passing test does **not** declare a rule academically correct, and these tests do not measure Claude's accuracy.

## Summary

| Req | VPAA requirement | Tests passed | Failed | Known issues | Status |
|---|---|---|---|---|---|
| VR-01 | Course Title ↔ Course Content | 10/10 | 0 | 0 | Implemented · Tested · Passed · Requires Clarification |
| VR-02 | Course Content ↔ ILO | 10/10 | 0 | 0 | Implemented · Tested · Passed · Requires Clarification |
| VR-03 | ILO ↔ CLO | 10/10 | 0 | 0 | Implemented · Tested · Passed · Requires Clarification |
| VR-04 | Course Content ↔ Learning Activities | 10/10 | 0 | 0 | Implemented · Tested · Passed · Requires Clarification |
| VR-05 | ILO ↔ Learning Activities | 10/10 | 0 | 0 | Implemented · Tested · Passed · Requires Clarification |
| VR-06 | Course Content ↔ Assessment | 10/10 | 0 | 0 | Implemented · Tested · Passed · Requires Clarification |
| VR-07 | Learning Activities ↔ Assessment | 10/10 | 0 | 0 | Implemented · Tested · Passed · Requires Clarification |
| VR-08 | Fixed CLO classifications: CLO1 Introductory, CLO2 Enabling, CLO3 Demonstrating, CLO4 Integration of Values | 9/9 | 0 | 0 | Implemented · Tested · Passed |
| VR-09 | CLO ↔ Course Description is NOT a VPAA relationship and must stay excluded | 5/5 | 0 | 0 | Implemented · Tested · Passed |
| VR-10 | Official pass threshold 79; six weighted areas; authorized deductions unchanged | 12/12 | 0 | 0 | Implemented · Tested · Passed |
| VR-11 | The 47 deterministic compliance rules | 48/48 | 0 | 0 | Implemented · Tested · Passed · Requires Clarification |
| VR-12 | When the AI is unavailable or its answer is unusable, coded checks continue and no AI judgement is fabricated or marked verified | 26/26 | 0 | 0 | Implemented · Tested · Passed |
| VR-13 | AI recommendations are advisory: never auto-applied, only the author acts, and unverified suggestions are not recorded as accepted | 14/14 | 0 | 0 | Implemented · Tested · Passed · Requires Clarification |
| VR-14 | Content-first authoring order: Course Content → ILO → Learning Activities → Assessment Tasks | 1/1 | 0 | 0 | Implemented · Tested · Passed |
| VR-15 | Evidence integrity: quotations must come from the supplied text; a relationship with a missing side is insufficient evidence, never aligned | 33/33 | 0 | 0 | Implemented · Tested · Passed |
| VR-16 | Policy V2 is the PRIMARY, advisory-only semantic path for all seven relationships, and no relationship is evaluated or reported twice | 8/8 | 0 | 0 | Implemented · Tested · Passed · Requires Clarification |
| VR-18 | No publicly known fallback secret in staging or production: the server refuses to start without acceptable secrets, and no secret value is ever printed | 9/9 | 0 | 0 | Implemented · Tested · Passed |
| VR-20 | The API accepts credentialed browser requests only from explicitly configured frontend origins; session and remember-me cookies are HttpOnly and Secure in staging and production; cross-site state-changing requests are refused; invalid host settings stop the server instead of falling back | 9/9 | 0 | 0 | Implemented · Tested · Passed · Requires Clarification |
| VR-19 | The staging configuration is documented, matches the code, and has been rehearsed end to end offline with a scripted provider and synthetic data | 14/14 | 0 | 0 | Implemented · Tested · Passed · Requires Clarification |
| VR-17 | When Policy V2 is off or the AI is unavailable, the report states that the seven-relationship check is incomplete, with the reason | 4/4 | 0 | 0 | Implemented · Tested · Passed |

## Detail

### VR-01 — Course Title ↔ Course Content

| Item | Detail |
|---|---|
| VPAA requirement source | docs/lcup-policy-v2-implementation/requirements-matrix.md row "1. Course Title ↔ Content"; docs/lcup-requirements/REPORT.md §Seven relationships |
| Implementation | server/lib/syllabuscheck/academicV2Plan.js (pair build), server/lib/syllabuscheck/gemini.js pairsOf (Stage B Content-course), server/lib/syllabuscheck/stages.js B.tests |
| Active in the application when | SYLLABUS_CHECK_STAGE_B=on or SYLLABUS_CHECK_ACADEMIC_V2=on |
| Test cases | 10 test(s): `VPAA-R1-ALIGNED`, `VPAA-R1-MISALIGNED`, `VPAA-R1-PARTIAL`, `VPAA-R1-INSUFFICIENT`, `VPAA-R1-ADVERSARIAL`, `VPAA-ACTIVATION`, `VPAA-MAPPING`, `VPAA-LEGACY-PARITY`, `VPAA-V2-SEVEN`, `VPAA-V2-NO-DUPLICATES` |
| Test results | 10 passed, 0 failed, 0 known issue(s) |
| Status | Implemented · Tested · Passed · Requires Clarification |
| Requires clarification | partial-threshold rubric |
| Remaining limitations | Active in the application only with SYLLABUS_CHECK_STAGE_B=on or SYLLABUS_CHECK_ACADEMIC_V2=on. Academic accuracy of real Claude on this relationship is NOT measured (scripted model). Partial-alignment threshold requires rubric clarification (scenario VPAA-R1-PARTIAL). |

### VR-02 — Course Content ↔ ILO

| Item | Detail |
|---|---|
| VPAA requirement source | docs/lcup-policy-v2-implementation/requirements-matrix.md row "2. Content ↔ ILO"; docs/lcup-requirements/REPORT.md |
| Implementation | server/lib/syllabuscheck/academicV2Plan.js, server/lib/syllabuscheck/stages.js B (Content-ILO) |
| Active in the application when | SYLLABUS_CHECK_STAGE_B=on or SYLLABUS_CHECK_ACADEMIC_V2=on |
| Test cases | 10 test(s): `VPAA-R2-ALIGNED`, `VPAA-R2-MISALIGNED`, `VPAA-R2-PARTIAL`, `VPAA-R2-INSUFFICIENT`, `VPAA-R2-ADVERSARIAL`, `VPAA-ACTIVATION`, `VPAA-MAPPING`, `VPAA-LEGACY-PARITY`, `VPAA-V2-SEVEN`, `VPAA-V2-NO-DUPLICATES` |
| Test results | 10 passed, 0 failed, 0 known issue(s) |
| Status | Implemented · Tested · Passed · Requires Clarification |
| Requires clarification | partial-threshold rubric |
| Remaining limitations | Active in the application only with SYLLABUS_CHECK_STAGE_B=on or SYLLABUS_CHECK_ACADEMIC_V2=on. Academic accuracy of real Claude on this relationship is NOT measured (scripted model). Partial-alignment threshold requires rubric clarification (scenario VPAA-R2-PARTIAL). |

### VR-03 — ILO ↔ CLO

| Item | Detail |
|---|---|
| VPAA requirement source | docs/lcup-policy-v2-implementation/requirements-matrix.md row "3. ILO ↔ assigned CLO"; docs/lcup-requirements/REPORT.md |
| Implementation | server/lib/syllabuscheck/gemini.js pairsOf (ILO-CLO), server/lib/syllabuscheck/cloClassification.js |
| Active in the application when | always on (core scored relationship) |
| Test cases | 10 test(s): `VPAA-R3-ALIGNED`, `VPAA-R3-MISALIGNED`, `VPAA-R3-PARTIAL`, `VPAA-R3-INSUFFICIENT`, `VPAA-R3-ADVERSARIAL`, `VPAA-ACTIVATION`, `VPAA-MAPPING`, `VPAA-LEGACY-PARITY`, `VPAA-V2-SEVEN`, `VPAA-V2-NO-DUPLICATES` |
| Test results | 10 passed, 0 failed, 0 known issue(s) |
| Status | Implemented · Tested · Passed · Requires Clarification |
| Requires clarification | partial-threshold rubric |
| Remaining limitations | Active in the application only with always on (core scored relationship). Academic accuracy of real Claude on this relationship is NOT measured (scripted model). Partial-alignment threshold requires rubric clarification (scenario VPAA-R3-PARTIAL). |

### VR-04 — Course Content ↔ Learning Activities

| Item | Detail |
|---|---|
| VPAA requirement source | docs/lcup-policy-v2-implementation/requirements-matrix.md row "4. Content ↔ Activities"; docs/lcup-requirements/REPORT.md |
| Implementation | server/lib/syllabuscheck/lessonfit.js chainPairs, server/lib/syllabuscheck/stages.js C3 |
| Active in the application when | SYLLABUS_CHECK_STAGE_C3=on or SYLLABUS_CHECK_ACADEMIC_V2=on |
| Test cases | 10 test(s): `VPAA-R4-ALIGNED`, `VPAA-R4-MISALIGNED`, `VPAA-R4-PARTIAL`, `VPAA-R4-INSUFFICIENT`, `VPAA-R4-ADVERSARIAL`, `VPAA-ACTIVATION`, `VPAA-MAPPING`, `VPAA-LEGACY-PARITY`, `VPAA-V2-SEVEN`, `VPAA-V2-NO-DUPLICATES` |
| Test results | 10 passed, 0 failed, 0 known issue(s) |
| Status | Implemented · Tested · Passed · Requires Clarification |
| Requires clarification | partial-threshold rubric |
| Remaining limitations | Active in the application only with SYLLABUS_CHECK_STAGE_C3=on or SYLLABUS_CHECK_ACADEMIC_V2=on. Academic accuracy of real Claude on this relationship is NOT measured (scripted model). Partial-alignment threshold requires rubric clarification (scenario VPAA-R4-PARTIAL). |

### VR-05 — ILO ↔ Learning Activities

| Item | Detail |
|---|---|
| VPAA requirement source | docs/lcup-policy-v2-implementation/requirements-matrix.md row "5. ILO ↔ Activities"; docs/lcup-requirements/REPORT.md |
| Implementation | server/lib/syllabuscheck/gemini.js pairsOf (ILO-activity) |
| Active in the application when | always on (core scored relationship) |
| Test cases | 10 test(s): `VPAA-R5-ALIGNED`, `VPAA-R5-MISALIGNED`, `VPAA-R5-PARTIAL`, `VPAA-R5-INSUFFICIENT`, `VPAA-R5-ADVERSARIAL`, `VPAA-ACTIVATION`, `VPAA-MAPPING`, `VPAA-LEGACY-PARITY`, `VPAA-V2-SEVEN`, `VPAA-V2-NO-DUPLICATES` |
| Test results | 10 passed, 0 failed, 0 known issue(s) |
| Status | Implemented · Tested · Passed · Requires Clarification |
| Requires clarification | partial-threshold rubric |
| Remaining limitations | Active in the application only with always on (core scored relationship). Academic accuracy of real Claude on this relationship is NOT measured (scripted model). Partial-alignment threshold requires rubric clarification (scenario VPAA-R5-PARTIAL). |

### VR-06 — Course Content ↔ Assessment

| Item | Detail |
|---|---|
| VPAA requirement source | docs/lcup-policy-v2-implementation/requirements-matrix.md row "6. Content ↔ Assessment Tasks"; docs/lcup-requirements/REPORT.md |
| Implementation | server/lib/syllabuscheck/lessonfit.js chainPairs, server/lib/syllabuscheck/stages.js C3 |
| Active in the application when | SYLLABUS_CHECK_STAGE_C3=on or SYLLABUS_CHECK_ACADEMIC_V2=on |
| Test cases | 10 test(s): `VPAA-R6-ALIGNED`, `VPAA-R6-MISALIGNED`, `VPAA-R6-PARTIAL`, `VPAA-R6-INSUFFICIENT`, `VPAA-R6-ADVERSARIAL`, `VPAA-ACTIVATION`, `VPAA-MAPPING`, `VPAA-LEGACY-PARITY`, `VPAA-V2-SEVEN`, `VPAA-V2-NO-DUPLICATES` |
| Test results | 10 passed, 0 failed, 0 known issue(s) |
| Status | Implemented · Tested · Passed · Requires Clarification |
| Requires clarification | partial-threshold rubric |
| Remaining limitations | Active in the application only with SYLLABUS_CHECK_STAGE_C3=on or SYLLABUS_CHECK_ACADEMIC_V2=on. Academic accuracy of real Claude on this relationship is NOT measured (scripted model). Partial-alignment threshold requires rubric clarification (scenario VPAA-R6-PARTIAL). |

### VR-07 — Learning Activities ↔ Assessment

| Item | Detail |
|---|---|
| VPAA requirement source | docs/lcup-policy-v2-implementation/requirements-matrix.md row "7. Activities ↔ Assessment Tasks"; docs/lcup-requirements/REPORT.md |
| Implementation | server/lib/syllabuscheck/lessonfit.js chainPairs, server/lib/syllabuscheck/stages.js C3 |
| Active in the application when | SYLLABUS_CHECK_STAGE_C3=on or SYLLABUS_CHECK_ACADEMIC_V2=on |
| Test cases | 10 test(s): `VPAA-R7-ALIGNED`, `VPAA-R7-MISALIGNED`, `VPAA-R7-PARTIAL`, `VPAA-R7-INSUFFICIENT`, `VPAA-R7-ADVERSARIAL`, `VPAA-ACTIVATION`, `VPAA-MAPPING`, `VPAA-LEGACY-PARITY`, `VPAA-V2-SEVEN`, `VPAA-V2-NO-DUPLICATES` |
| Test results | 10 passed, 0 failed, 0 known issue(s) |
| Status | Implemented · Tested · Passed · Requires Clarification |
| Requires clarification | partial-threshold rubric |
| Remaining limitations | Active in the application only with SYLLABUS_CHECK_STAGE_C3=on or SYLLABUS_CHECK_ACADEMIC_V2=on. Academic accuracy of real Claude on this relationship is NOT measured (scripted model). Partial-alignment threshold requires rubric clarification (scenario VPAA-R7-PARTIAL). |

### VR-08 — Fixed CLO classifications: CLO1 Introductory, CLO2 Enabling, CLO3 Demonstrating, CLO4 Integration of Values

| Item | Detail |
|---|---|
| VPAA requirement source | docs/lcup-policy-v2-implementation/requirements-matrix.md row "Introductory, Enabling, Demonstrating, Integration of Values"; server/lib/syllabuscheck/cloClassification.js header |
| Implementation | server/lib/syllabuscheck/cloClassification.js, server/lib/syllabuscheck/academicV2Plan.js V2_PROMPT (CLO-classification) |
| Active in the application when | SYLLABUS_CHECK_ACADEMIC_V2=on (classification-3 contract) |
| Test cases | 9 test(s): `VPAA-R8-LEVELS`, `VPAA-R8-FIXED-BY-NUMBER`, `VPAA-R8-STATEMENTS-PRESERVED`, `VPAA-R8-CONTEXT`, `VPAA-R8-MULTI-MAPPING`, `VPAA-R8-SECONDARY-NOT-IGNORED`, `VPAA-R8-LABEL-COMPLETENESS`, `VPAA-R8-BLANK-LABEL`, `VPAA-R8-BLANK-LABEL-LOCALIZED` |
| Test results | 9 passed, 0 failed, 0 known issue(s) |
| Status | Implemented · Tested · Passed |
| Requires clarification | no |
| Remaining limitations | Requires SYLLABUS_CHECK_ACADEMIC_V2=on (off by default). A CLO with no saved classification is not judged and no classification is assumed; it is reported with its CLO number and what to do (DEF-02, resolved as fail-safe and actionable). Whether a statement suits its classification is an academic judgement, not measured. |

### VR-09 — CLO ↔ Course Description is NOT a VPAA relationship and must stay excluded

| Item | Detail |
|---|---|
| VPAA requirement source | docs/lcup-policy-v2-implementation/requirements-matrix.md rows "CLO relevance to Course Title" and "Description fits title and taught content"; server/lib/syllabuscheck/academicV2Plan.js V2_PROMPT |
| Implementation | server/lib/syllabuscheck/academicV2Plan.js (no such pair), server/lib/syllabuscheck/gemini.js (course.description blank for V2) |
| Active in the application when | n/a |
| Test cases | 5 test(s): `VPAA-DESCRIPTION-EXCLUSION`, `VPAA-DESCRIPTION-EXCLUSION-LEGACY`, `VPAA-DESCRIPTION-EXCLUSION-DEFAULT`, `VPAA-DESCRIPTION-EXCLUSION-V2`, `VPAA-DESCRIPTION-EXCLUSION-REUSE` |
| Test results | 5 passed, 0 failed, 0 known issue(s) |
| Status | Implemented · Tested · Passed |
| Requires clarification | no |
| Remaining limitations | GAP-01 resolved without changing default requests: SYLLABUS_CHECK_CLO_DESCRIPTION=off withholds the description from requests that carry a CLO relationship; the service sets it while Policy V2 is on. It is unset by default, so legacy-only requests are byte for byte unchanged and still carry the description. The description can still appear as the OWN evidence of a Description-plan or Plan-sequence pair that shares a batch with CLO pairs (as in Policy V2). |

### VR-10 — Official pass threshold 79; six weighted areas; authorized deductions unchanged

| Item | Detail |
|---|---|
| VPAA requirement source | server/lib/compliance/standard-v4.json; server/lib/syllabuscheck/policy.js; docs/ai-checker-rules.md §Scoring |
| Implementation | server/lib/compliance/standard-v4.json, server/lib/compliance/rules.js evaluate, server/lib/syllabuscheck/engine.js |
| Active in the application when | always on |
| Test cases | 12 test(s): `VPAA-R11-COUNT`, `VPAA-R11-BASELINE`, `VPAA-R10-THRESHOLD`, `VPAA-R10-PASS-LOGIC`, `VPAA-R10-BLOCKING-OVERRIDES-SCORE`, `VPAA-R10-SCORE-CAP`, `VPAA-R10-INSUFFICIENT`, `VPAA-R11-HYBRID-44`, `VPAA-R10-DEDUCTIONS`, `VPAA-V2-SCORE-PARITY`, `VPAA-V2-GATES`, `VPAA-V2-BASELINE-PARITY` |
| Test results | 12 passed, 0 failed, 0 known issue(s) |
| Status | Implemented · Tested · Passed |
| Requires clarification | no |
| Remaining limitations | Hybrid-2 official score is withheld (null) until the AI check completes; the coded base score is shown as provisional. Verdict weights (20/25/25/20/10) are an unapproved proposal and are not tested as policy. |

### VR-11 — The 47 deterministic compliance rules

| Item | Detail |
|---|---|
| VPAA requirement source | server/lib/compliance/standard-v4.json (47 entries); docs/ai-checker-rules.md §3a (44 applied in Hybrid-2) |
| Implementation | server/lib/compliance/rules.js CHECKS; server/lib/syllabuscheck/engine.js codedStandard |
| Active in the application when | always on (44 of 47 in Hybrid-2) |
| Test cases | 48 test(s): `VPAA-R11-T-01`, `VPAA-R11-T-02`, `VPAA-R11-T-03`, `VPAA-R11-T-04`, `VPAA-R11-T-05`, `VPAA-R11-T-06`, `VPAA-R11-T-07`, `VPAA-R11-T-08`, `VPAA-R11-T-09`, `VPAA-R11-T-10`, `VPAA-R11-T-11`, `VPAA-R11-T-12`, `VPAA-R11-T-13`, `VPAA-R11-T-14`, `VPAA-R11-T-15`, `VPAA-R11-T-16`, `VPAA-R11-T-17`, `VPAA-R11-T-18`, `VPAA-R11-T-19`, `VPAA-R11-T-20`, `VPAA-R11-T-21`, `VPAA-R11-T-22`, `VPAA-R11-T-23`, `VPAA-R11-T-24`, `VPAA-R11-T-25`, `VPAA-R11-T-26`, `VPAA-R11-T-27`, `VPAA-R11-C-01`, `VPAA-R11-C-02`, `VPAA-R11-C-03`, `VPAA-R11-C-04`, `VPAA-R11-P-01`, `VPAA-R11-P-02`, `VPAA-R11-P-03`, `VPAA-R11-P-04`, `VPAA-R11-P-05`, `VPAA-R11-A-01`, `VPAA-R11-A-02`, `VPAA-R11-A-03`, `VPAA-R11-A-04`, `VPAA-R11-H-01`, `VPAA-R11-H-02`, `VPAA-R11-H-03`, `VPAA-R11-H-04`, `VPAA-R11-R-01`, `VPAA-R11-R-02`, `VPAA-R11-R-03`, `VPAA-R11-PLACEHOLDER` |
| Test results | 48 passed, 0 failed, 0 known issue(s) |
| Status | Implemented · Tested · Passed · Requires Clarification |
| Requires clarification | C-04, R-02 and R-03 are replaced by link checks in Hybrid-2; whether a minimum reference COUNT must still be enforced is an institutional decision. |
| Remaining limitations | 44 of 47 rules apply in Hybrid-2; C-04, R-02, R-03 are replaced by link checks (institutional decision). LIM-01: rules test presence and form, not quality; placeholder text earns presence credit. DEF-01 resolved: invisible-only text no longer counts as written. |

### VR-12 — When the AI is unavailable or its answer is unusable, coded checks continue and no AI judgement is fabricated or marked verified

| Item | Detail |
|---|---|
| VPAA requirement source | server/lib/syllabuscheck/policy.js; docs/ai-checker-rules.md; docs/lcup-policy-v2-implementation/requirements-matrix.md (NOT_EVALUATED / NOT_CHECKED semantics) |
| Implementation | server/lib/syllabuscheck/gemini.js align/validate, server/lib/syllabuscheck/academicPolicyV2.js record() |
| Active in the application when | always on |
| Test cases | 26 test(s): `VPAA-R12-V2-unavailable`, `VPAA-R12-HYBRID-unavailable`, `VPAA-R12-V2-auth`, `VPAA-R12-HYBRID-auth`, `VPAA-R12-V2-budget`, `VPAA-R12-HYBRID-budget`, `VPAA-R12-V2-incomplete`, `VPAA-R12-HYBRID-incomplete`, `VPAA-R12-V2-invalidJson`, `VPAA-R12-HYBRID-invalidJson`, `VPAA-R12-V2-emptyAnswer`, `VPAA-R12-HYBRID-emptyAnswer`, `VPAA-R12-V2-noEvidence`, `VPAA-R12-HYBRID-noEvidence`, `VPAA-R12-V2-fabricatedEvidence`, `VPAA-R12-HYBRID-fabricatedEvidence`, `VPAA-R12-V2-timeout`, `VPAA-R12-HYBRID-timeout`, `VPAA-R12-BREAKER`, `VPAA-R12-PARTIAL`, `VPAA-R12-NOT-CONFIGURED`, `VPAA-R12-LIVECALLS`, `VPAA-R12-LIVECALLS-SHARED`, `VPAA-V2-OFFLINE`, `VPAA-V2-BUDGET`, `VPAA-T5-SYNTHETIC-GUARD` |
| Test results | 26 passed, 0 failed, 0 known issue(s) |
| Status | Implemented · Tested · Passed |
| Requires clarification | no |
| Remaining limitations | Timeouts are simulated with HTTP 504; no wall-clock timeout was exercised. DEF-03 resolved: V2 live-call counts are the requests actually sent. A bad answer multiplies requests (bounded by the per-check budget, default 512). |

### VR-13 — AI recommendations are advisory: never auto-applied, only the author acts, and unverified suggestions are not recorded as accepted

| Item | Detail |
|---|---|
| VPAA requirement source | docs/lcup-policy-v2-implementation/requirements-matrix.md ("Recommendations require faculty review"); server/routes/syllabusCheck.js decisions/refine |
| Implementation | server/routes/syllabusCheck.js, server/lib/syllabuscheck/refine.js |
| Active in the application when | always on (token required for Policy V2 suggestions) |
| Test cases | 14 test(s): `VPAA-R13-AUTHORIZATION`, `VPAA-R13-VALIDATION`, `VPAA-R13-V2-TOKEN`, `VPAA-R13-V2-STALE`, `VPAA-R13-V2-REPLAY`, `VPAA-R13-AUDIT`, `VPAA-R13-CHECK-IMPROVE`, `VPAA-R13-LEGACY-ACCEPT`, `VPAA-R13-NO-UNVERIFIED-SUGGESTION`, `VPAA-R13-SECRET`, `VPAA-R13-SECRET-ROUTES`, `VPAA-T5-RECOMMEND-FLOW`, `VPAA-T5-STALE`, `VPAA-T5-APPROVAL-GATES` |
| Test results | 14 passed, 0 failed, 0 known issue(s) |
| Status | Implemented · Tested · Passed · Requires Clarification |
| Requires clarification | For a non-Policy-V2 suggestion the server records Accept without a Check & Improve token; whether that is acceptable is an institutional decision. |
| Remaining limitations | CLAR-01: outside Policy V2 an Accept is recorded without a Check & Improve token (institutional decision). DEF-04 resolved: tokens are signed only with a configured SESSION_SECRET of at least 16 characters; without one the server fails closed (503). Replay protection is per-process memory. server/index.js still falls back to a public default for the SESSION cookie secret (not in scope here). |

### VR-14 — Content-first authoring order: Course Content → ILO → Learning Activities → Assessment Tasks

| Item | Detail |
|---|---|
| VPAA requirement source | docs/lcup-requirements/REPORT.md §Content-first lesson authoring; src/lib/lessonAuthoring.js |
| Implementation | src/lib/lessonAuthoring.js, src/views/builder2/PlanStep.jsx |
| Active in the application when | new lesson rows only (authoringOrder = 1) |
| Test cases | 1 test(s): `VPAA-CONTENT-FIRST` |
| Test results | 1 passed, 0 failed, 0 known issue(s) |
| Status | Implemented · Tested · Passed |
| Requires clarification | no |
| Remaining limitations | UI-level guard for NEW lesson rows only; the server does not reject an ILO saved without content. |

### VR-15 — Evidence integrity: quotations must come from the supplied text; a relationship with a missing side is insufficient evidence, never aligned

| Item | Detail |
|---|---|
| VPAA requirement source | server/lib/syllabuscheck/academicV2Plan.js V2_PROMPT ("Missing/unreadable sides are insufficient evidence, never aligned") |
| Implementation | server/lib/syllabuscheck/gemini.js verifyAnswer, server/lib/syllabuscheck/evidencePresence.js |
| Active in the application when | always on |
| Test cases | 21 test(s): `VPAA-R15-PARSE`, `VPAA-R15-OMITTED`, `VPAA-R15-INSUFFICIENT-ANSWER`, `VPAA-R15-NO-DUPLICATES`, `VPAA-R15-CONTEXT`, `VPAA-R15-REFERENCE-CONTEXT`, `VPAA-R15-DRAFT-GUARD`, `VPAA-INSUFFICIENT-JUNK`, `VPAA-PRESENCE-CONTRACT`, `VPAA-PRESENCE-INVISIBLE`, `VPAA-PRESENCE-INVISIBLE-RULES`, `VPAA-T5-SUBMIT-GATE`, `VPAA-T5-WORKFLOW`, `VPAA-T5-STAGES-VIA-SERVICE`, `VPAA-T5-UI-SCORED`, `VPAA-T5-UI-CLEAN`, `VPAA-T5-UI-FAILED`, `VPAA-T5-UI-STALE`, `VPAA-T5-UI-V2`, `VPAA-T5-UI-LANGUAGE`, `VPAA-T5-UI-ROBUST` |
| Test results | 33 passed, 0 failed, 0 known issue(s) |
| Status | Implemented · Tested · Passed |
| Requires clarification | no |
| Remaining limitations | DEF-01 resolved (invisible-only text is blank). DEF-05 (fixed): every Stage flag used to make the AI step fail through the shared service. |

### VR-16 — Policy V2 is the PRIMARY, advisory-only semantic path for all seven relationships, and no relationship is evaluated or reported twice

| Item | Detail |
|---|---|
| VPAA requirement source | architecture decision of 2026-11-04; docs/lcup-policy-v2-implementation/requirements-matrix.md (V2 is advisory: no points, no deductions, no gate) |
| Implementation | server/lib/compliance/service.js checkHybrid, server/lib/syllabuscheck/academicPolicyV2.js |
| Active in the application when | SYLLABUS_CHECK_ACADEMIC_V2=on (OFF by default; staging procedure in docs/vpaa-conformance/POLICY-V2-ACTIVATION.md) |
| Test cases | 8 test(s): `VPAA-V2-SEVEN`, `VPAA-V2-PERSISTENCE`, `VPAA-V2-NO-DUPLICATES`, `VPAA-V2-SCORE-PARITY`, `VPAA-V2-BUDGET`, `VPAA-V2-GATES`, `VPAA-V2-STAGING-CONFIG`, `VPAA-V2-BASELINE-PARITY` |
| Test results | 8 passed, 0 failed, 0 known issue(s) |
| Status | Implemented · Tested · Passed · Requires Clarification |
| Requires clarification | ILO ↔ CLO and ILO ↔ Activities are asked by both the legacy path (scored, official deductions) and V2 (advisory) by design. |
| Remaining limitations | Policy V2 is OFF by default and has not been activated anywhere; the staging procedure is in POLICY-V2-ACTIVATION.md. ILO ↔ CLO and ILO ↔ Activities are asked by both paths by design (scored in the legacy path). Stage B and C3 (and Plan-sequence) are held off while V2 is on. |

### VR-18 — No publicly known fallback secret in staging or production: the server refuses to start without acceptable secrets, and no secret value is ever printed

| Item | Detail |
|---|---|
| VPAA requirement source | staging-preparation instruction of 2026-11-05; server/lib/sessionSecret.js |
| Implementation | server/lib/sessionSecret.js, server/index.js, server/lib/syllabuscheck/refine.js, scripts/credential-readiness.cjs |
| Active in the application when | NODE_ENV=staging or production (a random per-process secret is used otherwise) |
| Test cases | 9 test(s): `VPAA-R13-SECRET`, `VPAA-R13-SECRET-ROUTES`, `VPAA-SEC-INDEX`, `VPAA-SEC-NO-FALLBACKS`, `VPAA-SEC-FAIL-CLOSED`, `VPAA-SEC-READINESS-NO-LEAK`, `VPAA-SEC-CREDENTIAL-REPORT`, `VPAA-SEC-HYGIENE`, `VPAA-SEC-TOKEN-RULE` |
| Test results | 9 passed, 0 failed, 0 known issue(s) |
| Status | Implemented · Tested · Passed |
| Requires clarification | no |
| Remaining limitations | Hardened only when NODE_ENV is staging or production; any other mode uses a random per-process secret (sessions end on restart), never a constant. Credentials exposed in earlier chats must be rotated by a person: nothing is rotated automatically. |

### VR-20 — The API accepts credentialed browser requests only from explicitly configured frontend origins; session and remember-me cookies are HttpOnly and Secure in staging and production; cross-site state-changing requests are refused; invalid host settings stop the server instead of falling back

| Item | Detail |
|---|---|
| VPAA requirement source | staging host-configuration instruction of 2026-11-05; server/lib/hostConfig.js |
| Implementation | server/lib/hostConfig.js, server/index.js, server/middleware/auth.js, scripts/vpaa-v2-preflight.cjs |
| Active in the application when | CORS_ALLOWED_ORIGINS, TRUST_PROXY and SESSION_COOKIE_SAMESITE (required with NODE_ENV=staging or production; development keeps http://localhost:5173) |
| Test cases | 9 test(s): `VPAA-HOST-DEV`, `VPAA-HOST-STAGING-COOKIES`, `VPAA-HOST-STAGING-CORS`, `VPAA-HOST-CSRF`, `VPAA-HOST-AUTHZ`, `VPAA-HOST-ROUTING`, `VPAA-HOST-INDEX`, `VPAA-HOST-NO-NETWORK`, `VPAA-SEC-FAIL-CLOSED` |
| Test results | 9 passed, 0 failed, 0 known issue(s) |
| Status | Implemented · Tested · Passed · Requires Clarification |
| Requires clarification | No staging domain is built in: the owner supplies the frontend origin. A wildcard origin is refused because every request carries credentials. |
| Remaining limitations | Verified offline against a real HTTP listener with controlled Origin headers; browser behavior on the real staging host (certificate, proxy headers, SameSite handling) is checked by the owner after deployment (STAGING-SETUP-CHECKLIST.md section G). The staging frontend origin and the proxy hop count are deployment facts supplied by the owner; none is built in. The default MemoryStore session store is unchanged (sessions end on restart, one process only). |

### VR-19 — The staging configuration is documented, matches the code, and has been rehearsed end to end offline with a scripted provider and synthetic data

| Item | Detail |
|---|---|
| VPAA requirement source | staging-preparation instruction of 2026-11-05; docs/vpaa-conformance/POLICY-V2-ACTIVATION.md |
| Implementation | docs/vpaa-conformance/POLICY-V2-ACTIVATION.md, scripts/vpaa-v2-preflight.cjs |
| Active in the application when | n/a (no live provider is ever called by the rehearsal) |
| Test cases | 14 test(s): `VPAA-STG-DOC-CONFIG`, `VPAA-STG-MODEL`, `VPAA-STG-LIMITS`, `VPAA-STG-RETRY`, `VPAA-STG-PROVIDER-FAILURE`, `VPAA-STG-ROLLBACK`, `VPAA-STG-DOC-NUMBERS`, `VPAA-STG-REHEARSAL-SEVEN`, `VPAA-STG-REHEARSAL-PARITY`, `VPAA-STG-REHEARSAL-PERSISTENCE`, `VPAA-STG-REHEARSAL-OFFLINE`, `VPAA-STG-REHEARSAL-AUTHORIZATION`, `VPAA-STG-REHEARSAL-NO-LIVE-CALL`, `VPAA-STG-UI-FACULTY-ADMIN` |
| Test results | 14 passed, 0 failed, 0 known issue(s) |
| Status | Implemented · Tested · Passed · Requires Clarification |
| Requires clarification | A live provider test needs separate written authorization (STAGING-TEST-PLAN.md section 3). |
| Remaining limitations | No live provider was called; the live smoke test is a separately authorized step (STAGING-TEST-PLAN.md). The staging environment itself (credentials, database, NODE_ENV, host settings) still needs manual steps. The in-app cost figure is a conservative reservation, not spend. |

### VR-17 — When Policy V2 is off or the AI is unavailable, the report states that the seven-relationship check is incomplete, with the reason

| Item | Detail |
|---|---|
| VPAA requirement source | architecture decision of 2026-11-04; docs/ai-checker-rules.md (a check that could not be made is never a pass) |
| Implementation | server/lib/syllabuscheck/semanticCoverage.js, src/views/ComplianceCard.jsx |
| Active in the application when | always on |
| Test cases | 4 test(s): `VPAA-V2-OFFLINE`, `VPAA-V2-COVERAGE-REPORT`, `VPAA-V2-UI-COVERAGE`, `VPAA-V2-UI-BLANK-CLO` |
| Test results | 4 passed, 0 failed, 0 known issue(s) |
| Status | Implemented · Tested · Passed |
| Requires clarification | no |
| Remaining limitations | Coverage is advisory data computed from the report; it never feeds a score or a gate. The warning chip is shown only when the check is incomplete. |

