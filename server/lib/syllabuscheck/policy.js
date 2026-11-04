'use strict';
// Change the engine version whenever rules or this policy change. Persist this
// snapshot with each report so past deductions remain explainable.
const POLICY = Object.freeze({
  version: 'syllabus-policy-2',
  link: 2, alignment: 3, partialAlignment: 1, value: 1,
  minWeek: 1, maxWeek: 18,
  // Academic-quality relationships: they give a verdict and a suggestion, but cost no points, never block a submit, and an answer that
  // could not be verified does not hold the check open. They become scored only through an explicit, approved policy change.
  advisoryTypes: ['ILO-content', 'Description-plan', 'CLO-anyPO', 'CLO-anyEGA', 'Course-CLO', 'CLO-set', 'Content-course', 'Plan-sequence', 'Content-ILO', 'ILO-anyCLO', 'CLO-coverage', 'Activity-fit', 'Assessment-fit', 'Value-use', 'Value-map', 'Ref-relevance'],
  // Rewrites offered for one field before the checker stops and reports the problem as unresolved instead of proposing yet another wording.
  maxRewriteAttempts: 2,
});
// Who has the final say on a submit or an approval.
//   'advisory' (default)  the AI result and its recommendations inform the author and the reviewer; they never block. The coded
//                         hard gates still do (a course outside the curriculum, a grading total, missing standard sections).
//   'required'            a completed, fresh AI check is also needed before a submit or an approval (the earlier strict rule).
// Read on every call so a change in the environment needs no code change.
function aiGate(env = process.env) {
  return String(env.SYLLABUS_CHECK_AI_GATE || '').toLowerCase() === 'required' ? 'required' : 'advisory';
}
module.exports = { POLICY, aiGate };
