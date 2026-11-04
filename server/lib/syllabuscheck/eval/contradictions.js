'use strict';
// What "contradictory recommendations" means, as one executable definition used by the whole-pipeline tests (stage-e2.test.js) and by the live
// evaluation (scripts/live-pipeline-eval.cjs). Each entry returned is a contradiction found in one checked report:
//   two rewrites for one field; a rewrite no failing relationship asks for; a rewrite of a field whose earlier field (content, ILO, activity, assessment)
//   is wrong; a rewrite of values the values question already answered; a reference rewrite; re-tag advice and a rewrite for the same field;
//   a field both offered and listed as needing a decision; a values decision that disagrees with the classification; PASS and FAIL for one rule and field;
//   a withheld draft that is still recommended; "no replacement" while one is offered; a formatting note for a failing title; an advisory title
//   decision that differs from the official one; and (Stage E.4) a CLO rewrite built only from tag answers that said the CLO can stay as written, a
//   draft that failed the static review offered anyway, re-tag advice and "no approved item verified" for one field, a re-tag finding that still
//   carries a rewrite, and a rewrite of a CLO toward a PO or EGA while the CLO was judged not to be about the course.
const { buildVerdict } = require('../verdict');

// ---- what "contradictory recommendations" means, checked on every run ----
function contradictionsOf(result, content) {
  const out = [], h = result.hybrid, J = new Map((h.alignment.judgements || []).map(j => [j.id, j])), sugg = h.suggestions || [];
  const label = id => J.get(id) && !J.get(id).unverified ? J.get(id).label : null;
  const any = (re, pred) => [...J.values()].some(j => re.test(j.id) && !j.unverified && pred(j.label));
  const counts = new Map(); for (const s of sugg) counts.set(s.path, (counts.get(s.path) || 0) + 1);
  for (const [p, n] of counts) if (n > 1) out.push(`${n} rewrites for ${p}`);
  // Stage E.4: every failing tag of a CLO's PO (or EGA) group answered RETAG_OUTCOME, "the CLO can stay as written".
  const GROUP = { 'CLO-PO': 'CLO-PO', 'CLO-anyPO': 'CLO-PO', 'CLO-EGA': 'CLO-EGA', 'CLO-anyEGA': 'CLO-EGA' };
  const keepsText = (i, kind) => { const tags = [...J.values()].filter(j => j.type === kind && j.path === `clos[${i}].statement` && !j.unverified && ['PARTIALLY_ALIGNED', 'NOT_ALIGNED'].includes(j.label)); return tags.length > 0 && tags.every(j => j.recommendation === 'RETAG_OUTCOME'); };
  // A CLO judged not to be about the course (Course-CLO) is rewritten for the course first; a PO / EGA fit draft must wait.
  const offCourse = path => { const m = /^clos\[(\d+)\]\.statement$/.exec(path || ''); return !!m && label(`clo${m[1]}-course`) === 'NOT_ALIGNED'; };
  const fitsOutcome = type => /^CLO-(PO|EGA|anyPO|anyEGA)$/.test(type);
  for (const s of sugg) {
    if (s.source === 'ai') {
      const drivers = (s.basedOn || []).map(b => J.get(String(b).replace(/^SEM:/, ''))).filter(Boolean);
      if (!drivers.some(j => j.label !== 'ALIGNED')) out.push(`a rewrite of ${s.path} that no failing relationship asks for`);
      if (drivers.some(j => j.draftReview?.length && j.draft === s.text)) out.push(`a draft that failed the static review is offered for ${s.path}`);
      const clo = /^clos\[(\d+)\]\.statement$/.exec(s.path);
      if (clo && drivers.length && drivers.every(j => GROUP[j.type] && keepsText(clo[1], GROUP[j.type]))) out.push(`a rewrite of ${s.path} although its tag answers say it can stay as written`);
      if (clo && offCourse(s.path) && drivers.some(j => fitsOutcome(j.type) && j.draft === s.text)) out.push(`a rewrite of ${s.path} toward a PO or EGA although the CLO is not about the course`);
    }
    else if (!(h.codedChecks || []).some(c => c.path === s.path && c.status === 'FAIL')) out.push(`a rule suggestion for ${s.path} without a failing check`);
    const m = /^plan\[(\d+)\]\.(contents|activities|tasks|values|ilos\[\d+\]\.text)$/.exec(s.path);
    if (m) {
      const i = m[1], field = m[2];
      const contentOff = label(`row${i}-content`) === 'NOT_ALIGNED', iloOff = any(new RegExp(`^row${i}-ilo\\d+-contentilo$`), l => l !== 'ALIGNED');
      const activityOff = any(new RegExp(`^row${i}-(ilo\\d+-activity|activityfit)$`), l => l === 'NOT_ALIGNED'), assessOff = any(new RegExp(`^row${i}-(ilo\\d+-assessment|assessfit)$`), l => l === 'NOT_ALIGNED');
      if (field === 'contents' && label(`row${i}-content`) === 'ALIGNED') out.push(`a rewrite of week ${Number(i) + 1} content that was verified to belong to the course`);
      if (/^ilos/.test(field) && contentOff) out.push(`an ILO rewrite while the week ${Number(i) + 1} content is off`);
      if (['activities', 'tasks', 'values'].includes(field) && (contentOff || iloOff)) out.push(`a ${field} rewrite while the week ${Number(i) + 1} content or ILO is off`);
      if (['tasks', 'values'].includes(field) && activityOff) out.push(`a ${field} rewrite while the week ${Number(i) + 1} activity is off`);
      if (field === 'values' && assessOff) out.push(`a values rewrite while the week ${Number(i) + 1} assessment is off`);
      if (field === 'values' && label(`row${i}-valuemap`)) out.push(`a values rewrite although the values question answered for week ${Number(i) + 1}`);
    }
    if (/^refs/.test(s.path)) out.push(`a reference rewrite (${s.path})`);
  }
  for (const a of h.mappingAdvice || []) { const path = a.type === 'CLO' ? `plan[${a.rowIndex}].ilos[${a.iloIndex}].text` : `clos[${a.cloIndex}].statement`; if (counts.has(path)) out.push(`re-tag advice and a rewrite for ${path}`); }
  for (const u of h.unresolved || []) {
    if (counts.has(u.path)) out.push(`${u.path} both offered and listed as needing a decision`);
    const c = (h.valuesClassification || []).find(x => x.path === u.path);
    if (u.reason === 'value_needs_review' && c && c.classificationStatus === 'core_supported') out.push(`${u.path}: "nothing supports a value" although the lesson supports ${c.canonicalCoreValue}`);
    if (u.reason === 'value_supported' && (!c || c.classificationStatus !== 'core_supported')) out.push(`${u.path}: a supported value without the evidence`);
    if (u.reason === 'retag_needs_review' && (h.mappingAdvice || []).some(a => a.path === u.path)) out.push(`re-tag advice and "no approved item verified" for ${u.path}`);
  }
  const all = buildVerdict(result, content, { all: true }).all;
  const seen = new Map();
  for (const f of all) { const k = `${f.ruleId}|${f.legacyRuleId}|${f.path}${f.clo ? '#' + f.clo : ''}`; seen.set(k, (seen.get(k) || new Set()).add(f.status)); }
  for (const [k, statuses] of seen) if (statuses.has('PASS') && statuses.has('FAIL')) out.push(`PASS and FAIL for ${k}`);
  for (const f of all) {
    if (f.withheld && f.recommendation) out.push(`a withheld draft is still recommended (${f.ruleId} ${f.path})`);
    if (/No replacement is proposed/.test(f.recommendation || '') && counts.has(f.path)) out.push(`"no replacement" while a rewrite of ${f.path} is offered`);
    if (f.recommendationType === 'RETAG_OUTCOME' && f.legacyRuleId !== 'mapping-advice' && f.recommendation) out.push(`a re-tag finding that still carries a rewrite (${f.ruleId} ${f.path})`);
    if (fitsOutcome(f.legacyRuleId) && f.recommendation && offCourse(f.path)) out.push(`a ${f.legacyRuleId} rewrite of ${f.path} although the CLO is not about the course`);
  }
  for (const i of result.hybrid.verdict.informational || []) if (all.some(f => f.ruleId === 'CUR-04' && f.path === i.path && f.status === 'FAIL')) out.push('a formatting note for a title that fails');
  // the advisory verdict must decide the title as the official check in force does (found in the Stage E.2 browser check)
  const officialTitle = (h.codedChecks || []).find(c => c.ruleId === 'CUR-FIELD' && c.path === 'meta.title'), advisoryTitle = all.find(f => f.ruleId === 'CUR-04' && f.path === 'meta.title');
  if (officialTitle && advisoryTitle && (officialTitle.status === 'FAIL') !== (advisoryTitle.status === 'FAIL')) out.push(`the advisory title decision (${advisoryTitle.status}) differs from the official one (${officialTitle.status})`);
  return out;
}
module.exports = { contradictionsOf };
