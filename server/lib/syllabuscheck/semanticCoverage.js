'use strict';
// How much of the seven-relationship VPAA semantic check a finished report actually contains, so an incomplete check says so instead of looking complete.
//
//   1 Title ↔ Content   2 Content ↔ ILO   3 ILO ↔ CLO   4 Content ↔ Activities   5 ILO ↔ Activities   6 Content ↔ Assessment   7 Activities ↔ Assessment
//
// Pure: it reads the report and nothing else, and it is advisory data. It is never an input to a score, a deduction, a gate or an approval.
// Policy V2 is the primary path for all seven. A relationship counts as evaluated only when EVERY instance of it was judged and verified; one with a
// missing side or an unverifiable answer is "partial", and one nothing asked is "not_evaluated". The two scored legacy relationships (ILO ↔ CLO and
// ILO ↔ Activities) also run in the legacy path for the official score; V2's records are used for coverage whenever V2 produced them.
const POLICY = require('../../../src/data/academicPolicyV2.json');

const VERSION = 'vpaa-coverage-1';
const TYPES = POLICY.weeklyTypes; // the seven, in VPAA order

function semanticCoverageOf(result, { v2On = false } = {}) {
  const hybrid = result?.hybrid || {};
  const v2 = hybrid.academicV2 || null;
  const records = v2?.academic?.relationships || [];
  const judgements = hybrid.alignment?.judgements || [];
  const relationships = TYPES.map((type, index) => {
    const fromV2 = records.filter((r) => r.relationshipType === type);
    const fromLegacy = judgements.filter((j) => j.type === type);
    const useV2 = v2On || fromV2.length > 0;
    const expected = useV2 ? fromV2.length : fromLegacy.length;
    const verified = useV2
      ? fromV2.filter((r) => r.academicJudgment !== null && r.verification === 'quotes_verified').length
      : fromLegacy.filter((j) => !j.unverified && j.label !== 'INSUFFICIENT_EVIDENCE').length;
    return { n: index + 1, type, source: useV2 ? 'policy-v2' : fromLegacy.length ? 'legacy' : null, expected, verified, status: expected && verified === expected ? 'evaluated' : verified ? 'partial' : 'not_evaluated' };
  });
  const evaluated = relationships.filter((r) => r.status === 'evaluated').length;
  const complete = evaluated === TYPES.length;
  const v2Status = v2On ? (v2?.status || 'not_evaluated') : 'off';
  // Why it is not complete: V2 is off; V2 ran but the AI part could not (provider unavailable, refused, budget); some answers could not be verified; or the
  // syllabus lacks the text a relationship needs.
  const reason = complete ? null : !v2On ? 'policy_v2_off' : v2Status === 'not_evaluated' ? 'v2_not_evaluated' : v2Status === 'partially_evaluated' ? 'v2_partial' : 'missing_evidence';
  return { version: VERSION, advisoryOnly: true, primaryPath: v2On ? 'policy-v2' : 'legacy', policyV2: { enabled: !!v2On, status: v2Status }, evaluated, total: TYPES.length, complete, reason, relationships };
}

module.exports = { semanticCoverageOf, VERSION, TYPES };
