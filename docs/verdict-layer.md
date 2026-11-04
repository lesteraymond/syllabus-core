# Advisory verdict layer (`verdict-1`)

`server/lib/syllabuscheck/verdict.js` re-expresses a finished hybrid report as typed findings. It is **shadow/advisory**: the official score, pass mark, deductions and submit gates are unchanged. The result is stored as `report_json.hybrid.verdict`; reports saved earlier simply lack it and the UI hides the panel.

- Findings: `ruleId` (proposed catalog), `legacyRuleId`, `category`, `path`, `week`, `status` (PASS / FAIL / NEEDS_REVIEW / NOT_CHECKED / NOT_APPLICABLE), `severity` (CRITICAL / MAJOR / MINOR / INFO), `method` (deterministic / course_profile / ai_semantic), `actual`, `evidence`, `explanation`, `recommendation`, `requiresFacultyApproval`.
- Separate answers: `completeness` (field fill, not academic fit), `curriculum`, `alignment` (NOT_CHECKED unless the AI run completed), `overall` (COMPLIANT / NOT_COMPLIANT / NEEDS_REVIEW / PARTIAL_VALIDATION), plus `unverified[]`. `rubric.score` stays null while any weighted category is unevaluated; the weights are a proposal, not university policy.
- New offline checks: CLO-01 (exactly four CLOs, `CONFIG.expectedCloCount`), CLO-02 (repeated wording only), CLO-08 (approved CLO tags), STR-05 (placeholder / filler / whitespace; examination rows exempt), PLAN-02 (keyword hint only).
- Existing rule IDs are untouched; see `CODED` and `AI` in verdict.js for the mapping.
- Not yet implemented (reported NOT_CHECKED): scoped AI checks for CLO quality and the content-ILO-activity-assessment chain, APA 7, course validation profiles, export rendering (STR-07), grading policy (ADM-04), approval metadata (ADM-05).
- Rollback: remove the `buildVerdict` call in `engine.js` and `VerdictPanel` in `ComplianceCard.jsx`. No schema change.
