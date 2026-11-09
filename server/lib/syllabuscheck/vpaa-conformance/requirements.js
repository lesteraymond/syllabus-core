'use strict';
// The VPAA requirement catalog the conformance framework traces to. Each row restates ONE authoritative requirement and points at the
// repository document that records it. Nothing here defines new academic policy: the wording is copied or closely paraphrased from the
// sources named, and where the sources do not fix a precise answer the row says so (`clarification`).
//
//   id            stable key used by test names ("[VR-03-...]") and by the traceability generator
//   text          the requirement
//   source        where the requirement is recorded in this repository
//   implementation  the production code that is supposed to implement it
//   activation    what must be switched on for it to run in the application (verified by the activation test, not asserted from docs)
//   clarification an open institutional question that the framework deliberately does NOT answer
const MATRIX = 'docs/lcup-policy-v2-implementation/requirements-matrix.md';
const REPORT = 'docs/lcup-requirements/REPORT.md';
const STD = 'server/lib/compliance/standard-v4.json';
const SC = 'server/lib/syllabuscheck/';

const RELATIONSHIPS = [
  { id: 'VR-01', n: 1, label: 'Course Title ↔ Course Content', type: 'Content-course', source: `${MATRIX} row "1. Course Title ↔ Content"; ${REPORT} §Seven relationships`,
    implementation: `${SC}academicV2Plan.js (pair build), ${SC}gemini.js pairsOf (Stage B Content-course), ${SC}stages.js B.tests`, activation: ['SYLLABUS_CHECK_STAGE_B=on', 'or SYLLABUS_CHECK_ACADEMIC_V2=on'],
    fields: { source: 'course code, title, program, year level, week number, adjacent weeks\' content (NOT the course description)', target: 'the week\'s Course Content' }, rewrite: true },
  { id: 'VR-02', n: 2, label: 'Course Content ↔ ILO', type: 'Content-ILO', source: `${MATRIX} row "2. Content ↔ ILO"; ${REPORT}`,
    implementation: `${SC}academicV2Plan.js, ${SC}stages.js B (Content-ILO)`, activation: ['SYLLABUS_CHECK_STAGE_B=on', 'or SYLLABUS_CHECK_ACADEMIC_V2=on'],
    fields: { source: 'the week\'s Course Content', target: 'one ILO of that week' }, rewrite: true },
  { id: 'VR-03', n: 3, label: 'ILO ↔ CLO', type: 'ILO-CLO', source: `${MATRIX} row "3. ILO ↔ assigned CLO"; ${REPORT}`,
    implementation: `${SC}gemini.js pairsOf (ILO-CLO), ${SC}cloClassification.js`, activation: ['always on (core scored relationship)'],
    fields: { source: 'the faculty-authored CLO statement of an assigned CLO', target: 'one ILO' }, rewrite: true },
  { id: 'VR-04', n: 4, label: 'Course Content ↔ Learning Activities', type: 'Content-activity', source: `${MATRIX} row "4. Content ↔ Activities"; ${REPORT}`,
    implementation: `${SC}lessonfit.js chainPairs, ${SC}stages.js C3`, activation: ['SYLLABUS_CHECK_STAGE_C3=on', 'or SYLLABUS_CHECK_ACADEMIC_V2=on'],
    fields: { source: 'the week\'s Course Content', target: 'the week\'s Suggested Learning Activities' }, rewrite: false },
  { id: 'VR-05', n: 5, label: 'ILO ↔ Learning Activities', type: 'ILO-activity', source: `${MATRIX} row "5. ILO ↔ Activities"; ${REPORT}`,
    implementation: `${SC}gemini.js pairsOf (ILO-activity)`, activation: ['always on (core scored relationship)'],
    fields: { source: 'one ILO', target: 'the week\'s Suggested Learning Activities' }, rewrite: true },
  { id: 'VR-06', n: 6, label: 'Course Content ↔ Assessment', type: 'Content-assessment', source: `${MATRIX} row "6. Content ↔ Assessment Tasks"; ${REPORT}`,
    implementation: `${SC}lessonfit.js chainPairs, ${SC}stages.js C3`, activation: ['SYLLABUS_CHECK_STAGE_C3=on', 'or SYLLABUS_CHECK_ACADEMIC_V2=on'],
    fields: { source: 'the week\'s Course Content', target: 'the week\'s Suggested Assessment Tasks' }, rewrite: false },
  { id: 'VR-07', n: 7, label: 'Learning Activities ↔ Assessment', type: 'Activity-assessment', source: `${MATRIX} row "7. Activities ↔ Assessment Tasks"; ${REPORT}`,
    implementation: `${SC}lessonfit.js chainPairs, ${SC}stages.js C3`, activation: ['SYLLABUS_CHECK_STAGE_C3=on', 'or SYLLABUS_CHECK_ACADEMIC_V2=on'],
    fields: { source: 'the week\'s Suggested Learning Activities', target: 'the week\'s Suggested Assessment Tasks' }, rewrite: false },
];

// Cross-cutting requirements. `clarification` marks a point the sources leave open.
const OTHER = [
  { id: 'VR-08', label: 'Fixed CLO classifications: CLO1 Introductory, CLO2 Enabling, CLO3 Demonstrating, CLO4 Integration of Values', source: `${MATRIX} row "Introductory, Enabling, Demonstrating, Integration of Values"; ${SC}cloClassification.js header`,
    implementation: `${SC}cloClassification.js, ${SC}academicV2Plan.js V2_PROMPT (CLO-classification)`, activation: ['SYLLABUS_CHECK_ACADEMIC_V2=on (classification-3 contract)'] },
  { id: 'VR-09', label: 'CLO ↔ Course Description is NOT a VPAA relationship and must stay excluded', source: `${MATRIX} rows "CLO relevance to Course Title" and "Description fits title and taught content"; ${SC}academicV2Plan.js V2_PROMPT`,
    implementation: `${SC}academicV2Plan.js (no such pair), ${SC}gemini.js (course.description blank for V2)`, activation: ['n/a'] },
  { id: 'VR-10', label: 'Official pass threshold 79; six weighted areas; authorized deductions unchanged', source: `${STD}; ${SC}policy.js; docs/ai-checker-rules.md §Scoring`,
    implementation: `${STD}, server/lib/compliance/rules.js evaluate, ${SC}engine.js`, activation: ['always on'] },
  { id: 'VR-11', label: 'The 47 deterministic compliance rules', source: `${STD} (47 entries); docs/ai-checker-rules.md §3a (44 applied in Hybrid-2)`,
    implementation: 'server/lib/compliance/rules.js CHECKS; server/lib/syllabuscheck/engine.js codedStandard', activation: ['always on (44 of 47 in Hybrid-2)'],
    clarification: 'C-04, R-02 and R-03 are replaced by link checks in Hybrid-2; whether a minimum reference COUNT must still be enforced is an institutional decision.' },
  { id: 'VR-12', label: 'When the AI is unavailable or its answer is unusable, coded checks continue and no AI judgement is fabricated or marked verified', source: `${SC}policy.js; docs/ai-checker-rules.md; ${MATRIX} (NOT_EVALUATED / NOT_CHECKED semantics)`,
    implementation: `${SC}gemini.js align/validate, ${SC}academicPolicyV2.js record()`, activation: ['always on'] },
  { id: 'VR-13', label: 'AI recommendations are advisory: never auto-applied, only the author acts, and unverified suggestions are not recorded as accepted', source: `${MATRIX} ("Recommendations require faculty review"); server/routes/syllabusCheck.js decisions/refine`,
    implementation: 'server/routes/syllabusCheck.js, server/lib/syllabuscheck/refine.js', activation: ['always on (token required for Policy V2 suggestions)'],
    clarification: 'For a non-Policy-V2 suggestion the server records Accept without a Check & Improve token; whether that is acceptable is an institutional decision.' },
  { id: 'VR-14', label: 'Content-first authoring order: Course Content → ILO → Learning Activities → Assessment Tasks', source: `${REPORT} §Content-first lesson authoring; src/lib/lessonAuthoring.js`,
    implementation: 'src/lib/lessonAuthoring.js, src/views/builder2/PlanStep.jsx', activation: ['new lesson rows only (authoringOrder = 1)'] },
  { id: 'VR-16', label: 'Policy V2 is the PRIMARY, advisory-only semantic path for all seven relationships, and no relationship is evaluated or reported twice', source: 'architecture decision of 2026-11-04; docs/lcup-policy-v2-implementation/requirements-matrix.md (V2 is advisory: no points, no deductions, no gate)',
    implementation: 'server/lib/compliance/service.js checkHybrid, server/lib/syllabuscheck/academicPolicyV2.js', activation: ['SYLLABUS_CHECK_ACADEMIC_V2=on (OFF by default; staging procedure in docs/vpaa-conformance/POLICY-V2-ACTIVATION.md)'],
    clarification: 'ILO ↔ CLO and ILO ↔ Activities are asked by both the legacy path (scored, official deductions) and V2 (advisory) by design.' },
  { id: 'VR-17', label: 'When Policy V2 is off or the AI is unavailable, the report states that the seven-relationship check is incomplete, with the reason', source: 'architecture decision of 2026-11-04; docs/ai-checker-rules.md (a check that could not be made is never a pass)',
    implementation: 'server/lib/syllabuscheck/semanticCoverage.js, src/views/ComplianceCard.jsx', activation: ['always on'] },
  { id: 'VR-18', label: 'No publicly known fallback secret in staging or production: the server refuses to start without acceptable secrets, and no secret value is ever printed', source: 'staging-preparation instruction of 2026-11-05; server/lib/sessionSecret.js',
    implementation: 'server/lib/sessionSecret.js, server/index.js, server/lib/syllabuscheck/refine.js, scripts/credential-readiness.cjs', activation: ['NODE_ENV=staging or production (a random per-process secret is used otherwise)'] },
  { id: 'VR-19', label: 'The staging configuration is documented, matches the code, and has been rehearsed end to end offline with a scripted provider and synthetic data', source: 'staging-preparation instruction of 2026-11-05; docs/vpaa-conformance/POLICY-V2-ACTIVATION.md',
    implementation: 'docs/vpaa-conformance/POLICY-V2-ACTIVATION.md, scripts/vpaa-v2-preflight.cjs', activation: ['n/a (no live provider is ever called by the rehearsal)'],
    clarification: 'A live provider test needs separate written authorization (STAGING-TEST-PLAN.md section 3).' },
  { id: 'VR-20', label: 'The API accepts credentialed browser requests only from explicitly configured frontend origins; session and remember-me cookies are HttpOnly and Secure in staging and production; cross-site state-changing requests are refused; invalid host settings stop the server instead of falling back', source: 'staging host-configuration instruction of 2026-11-05; server/lib/hostConfig.js',
    implementation: 'server/lib/hostConfig.js, server/index.js, server/middleware/auth.js, scripts/vpaa-v2-preflight.cjs', activation: ['CORS_ALLOWED_ORIGINS, TRUST_PROXY and SESSION_COOKIE_SAMESITE (required with NODE_ENV=staging or production; development keeps http://localhost:5173)'],
    clarification: 'No staging domain is built in: the owner supplies the frontend origin. A wildcard origin is refused because every request carries credentials.' },
  { id: 'VR-15', label: 'Evidence integrity: quotations must come from the supplied text; a relationship with a missing side is insufficient evidence, never aligned', source: `${SC}academicV2Plan.js V2_PROMPT ("Missing/unreadable sides are insufficient evidence, never aligned")`,
    implementation: `${SC}gemini.js verifyAnswer, ${SC}evidencePresence.js`, activation: ['always on'] },
];

const ALL = [...RELATIONSHIPS, ...OTHER];
module.exports = { RELATIONSHIPS, OTHER, ALL, byId: Object.fromEntries(ALL.map((r) => [r.id, r])), byType: Object.fromEntries(RELATIONSHIPS.map((r) => [r.type, r])) };
