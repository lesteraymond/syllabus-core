'use strict';
// How much of the seven-relationship VPAA semantic check a finished report actually contains, so an incomplete check says so instead of looking complete.
//
//   1 Title ↔ Content   2 Content ↔ ILO   3 ILO ↔ CLO   4 Content ↔ Activities   5 ILO ↔ Activities   6 Content ↔ Assessment   7 Activities ↔ Assessment
//
// Pure: it reads the report and nothing else, and it is advisory data. It is never an input to a score, a deduction, a gate or an approval.
// The new AI Checker (pipeline/) asks the seven under its own checklist names. A relationship counts as evaluated only when every question of its checklist
// got an answer; one with an unanswerable question is "partial", and one nothing asked is "not_evaluated".
const VERSION = 'vpaa-coverage-1';
const TYPES = ['Content-course', 'Content-ILO', 'ILO-CLO', 'Content-activity', 'ILO-activity', 'Content-assessment', 'Activity-assessment']; // the seven, in VPAA order

// ACTIVITY-FIT judges the activities against the week's content AND its ILOs in one question, and TASK-FIT the tasks against the content and the
// activities, so each covers two of the seven.
const REPLANNED = {
  'Content-course': ['CONTENT-TITLE'], 'Content-ILO': ['ILO-CONTENT'], 'ILO-CLO': ['ILO-CLO'], 'Content-activity': ['ACTIVITY-FIT'],
  'ILO-activity': ['ACTIVITY-FIT'], 'Content-assessment': ['TASK-FIT'], 'Activity-assessment': ['TASK-FIT'],
};
// official.js names an unanswered question "<relationship> (not checked)" and an extra tag "<relationship> (extra tag)"
const baseType = type => String(type || '').replace(/ \((?:not checked|extra tag)\)$/, '');

function semanticCoverageOf(result) {
  const hybrid = result?.hybrid || {};
  // before the new checker has answered (a check without AI, or one it could not complete) nothing of the seven is in the report
  const judgements = hybrid.alignment?.engine === 're-planned' ? (hybrid.alignment.judgements || []).filter(j => j.status !== 'rule' && j.status !== 'rule_review') : [];
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
