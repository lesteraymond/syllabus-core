'use strict';
// Reserved IDs are not a license to invent a rubric. Keep the missing decision
// explicit in both the verdict and the coverage inventory.
module.exports = Object.freeze({
  'STR-07': {state:'PENDING_POLICY_CLARIFICATION', reason:'VPAA must identify the approved export template/version, layout acceptance criteria and the exported artifact to inspect. PDF layout regression tests do not verify an individual checking run.'},
  'ADM-04': {state:'PENDING_INSTITUTIONAL_REFERENCE', reason:'VPAA/Registrar must supply an approved, versioned grading policy with applicable program/course scope and permitted component/formula constraints. GRADE-100 alone does not establish that policy.'},
  'ADM-05': {state:'PENDING_POLICY_CLARIFICATION', reason:'VPAA/Registrar must specify required approver roles, revision events, ordering, authorized signatures and which revision requires renewed approval. Existing review gates and T-27 remain in force.'},
  'CUR-10': {state:'PENDING_INSTITUTIONAL_REFERENCE', reason:'Registrar must supply approved curriculum/reference versions, effective cohorts, provenance and supersession rules. CUR-REF validates selection/availability; a content fingerprint is not institutional version approval.'},
  ...Object.fromEntries(['CLO-05','CLO-10','PLAN-05','PLAN-06','ALN-03','ALN-04','ALN-10'].map(id => [id,{state:'PENDING_POLICY_CLARIFICATION', reason:`VPAA must supply the authoritative definition, scope, evidence requirements and decision rubric for reserved ${id}. No scoped implementation or approved definition was located; no meaning is inferred from this identifier.`}]))
});
