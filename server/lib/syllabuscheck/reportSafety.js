'use strict';
// Final presentation boundary for current or saved reports. Raw judgments stay diagnostic evidence; withheld drafts never become actionable proposals.
// No model, DB, score/gate calculation, or mutation of the saved report. A same-field proposal driven by a different judgment may remain eligible.
function withholdReviewedDrafts(report) {
  const hybrid = report?.hybrid;
  if (!hybrid) return report;
  const held = new Map((hybrid.alignment?.judgements || []).filter(j => j.draftReview?.length).map(j => [j.id, j]));
  for (const f of [...(hybrid.verdict?.findings || []), ...(hybrid.verdict?.all || [])]) {
    if (f.relationshipId && f.draftReview?.length) held.set(f.relationshipId, held.get(f.relationshipId) || { id: f.relationshipId });
  }
  if (!held.size) return report;
  const idOf = id => String(id || '').replace(/^SEM:/, '');
  const sameText = (a, b) => typeof a === 'string' && typeof b === 'string' && a.trim() === b.trim();
  const usable = s => !held.has(idOf(s.id)) && ![...held.values()].some(j => j.draft &&
    (s.path === j.targetPath || (s.basedOn || []).some(id => idOf(id) === j.id)) && (sameText(s.text, j.draft) || sameText(s.replacement, j.draft)));
  const safeFinding = f => {
    if (!held.has(f.relationshipId) && !f.draftReview?.length) return f;
    return { ...f, recommendation: null, requiresFacultyApproval: false,
      recommendationType: f.recommendationType === 'NO_CHANGE' ? 'NO_CHANGE' : 'REVIEW_REQUIRED', withheld: f.withheld || 'draft_review',
      ...(f.detail ? { detail: { ...f.detail, change: null } } : {}) };
  };
  return { ...report, ...(Array.isArray(report.recommendations) ? { recommendations: report.recommendations.filter(usable) } : {}),
    hybrid: { ...hybrid, ...(Array.isArray(hybrid.suggestions) ? { suggestions: hybrid.suggestions.filter(usable) } : {}),
      ...(hybrid.verdict ? { verdict: { ...hybrid.verdict,
        ...(Array.isArray(hybrid.verdict.findings) ? { findings: hybrid.verdict.findings.map(safeFinding) } : {}),
        ...(Array.isArray(hybrid.verdict.all) ? { all: hybrid.verdict.all.map(safeFinding) } : {}) } } : {}) } };
}
module.exports = { withholdReviewedDrafts };
