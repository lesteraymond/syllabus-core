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

// The re-planned checker (pipeline/, official mode) asks the seven under its own checklist names. ACTIVITY-FIT judges the activities against the
// week's content AND its ILOs in one question, and TASK-FIT the tasks against the content and the activities, so each covers two of the seven.
const REPLANNED = {
  'Content-course': ['CONTENT-TITLE'], 'Content-ILO': ['ILO-CONTENT'], 'ILO-CLO': ['ILO-CLO'], 'Content-activity': ['ACTIVITY-FIT'],
  'ILO-activity': ['ACTIVITY-FIT'], 'Content-assessment': ['TASK-FIT'], 'Activity-assessment': ['TASK-FIT'],
};
// official.js names an unanswered question "<relationship> (not checked)" and an extra tag "<relationship> (extra tag)"
const baseType = type => String(type || '').replace(/ \((?:not checked|extra tag)\)$/, '');
const isReplanned = hybrid => hybrid.alignment?.engine === 're-planned';

function semanticCoverageOf(result, { v2On = false } = {}) {
  const hybrid = result?.hybrid || {};
  if (isReplanned(hybrid) && !v2On) return replannedCoverage(hybrid);
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

// Coverage of a report the re-planned checker made: a relationship is evaluated when every question of its checklist got an answer.
function replannedCoverage(hybrid) {
  const judgements = (hybrid.alignment?.judgements || []).filter(j => j.status !== 'rule' && j.status !== 'rule_review');
  const relationships = TYPES.map((type, index) => {
    const names = REPLANNED[type] || [];
    const asked = judgements.filter(j => names.includes(baseType(j.type)));
    const verified = asked.filter(j => !j.unverified && j.label !== 'INSUFFICIENT_EVIDENCE').length;
    return { n: index + 1, type, source: asked.length ? 're-planned' : null, asks: names, expected: asked.length, verified, status: asked.length && verified === asked.length ? 'evaluated' : verified ? 'partial' : 'not_evaluated' };
  });
  const evaluated = relationships.filter(r => r.status === 'evaluated').length;
  const complete = evaluated === TYPES.length;
  // why it is not complete: some answers could not be had (provider, cap, "unclear"), or the syllabus lacks the text a relationship needs
  const reason = complete ? null : hybrid.alignment?.status !== 'completed' && !relationships.some(r => r.verified) ? 'replan_not_evaluated' : relationships.some(r => r.status === 'partial') ? 'replan_partial' : 'missing_evidence';
  return { version: VERSION, advisoryOnly: true, primaryPath: 're-planned', policyV2: { enabled: false, status: 'off' }, evaluated, total: TYPES.length, complete, reason, relationships };
}

module.exports = { semanticCoverageOf, VERSION, TYPES, REPLANNED };
