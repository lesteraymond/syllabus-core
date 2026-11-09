'use strict';
// Renders the evidence of ONE evaluation (scripted or real) as a reviewable document, and independently re-checks what the model said it quoted.
//   - Every Policy V2 judgment (the seven VPAA relationships, the existing course checks and the four CLO classifications) is shown with the text the model was given
//     (source and target), its label, the evidence it cited, its explanation, its recommendation and the evaluation status.
//   - Each cited quotation is checked HERE, separately from the application's own check, for appearing verbatim (whitespace and case ignored) in the text the model was
//     given and in the syllabus content: a quotation that appears nowhere is reported as possibly invented, never silently accepted.
//   - The provisional expectations of the fixture are shown next to what the model concluded. They are the developer's reading, not the truth: this document never says
//     a judgment is academically right or wrong. Agreement and disagreement are both for a human reviewer.
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const flatten = (v, out = []) => { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach((x) => flatten(x, out)); else if (v && typeof v === 'object') Object.values(v).forEach((x) => flatten(x, out)); return out; };
const clip = (s, n = 240) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; };
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

function quoteCheck(quote, ...haystacks) {
  if (!quote || !String(quote).trim()) return { quote: '', status: 'none' };
  const q = norm(quote);
  return { quote: String(quote), status: haystacks.some((h) => norm(h).includes(q)) ? 'verbatim' : 'NOT FOUND' };
}

function analyse({ fixture, result }) {
  const syllabusText = norm(flatten(fixture.content).join(' '));
  const records = (result.hybrid && result.hybrid.academicV2 && result.hybrid.academicV2.academic && result.hybrid.academicV2.academic.relationships) || [];
  const rows = records.map((r) => {
    const ev = r.evidence || {};
    const src = quoteCheck(ev.sourceQuote, r.sourceText, syllabusText), tgt = quoteCheck(ev.targetQuote, r.targetText, syllabusText);
    return { id: r.id, type: r.relationshipType, vpaa: r.relationshipId || null, week: r.week, path: r.path, label: r.academicJudgment, status: r.status, verification: r.verification,
      source: r.sourceText, target: r.targetText, sourceQuote: src, targetQuote: tgt, explanation: r.explanation, recommendation: r.recommendationType, recommendedCorrection: r.recommendedCorrection || (r.correction && r.correction.reason) || null, attempted: !!r.attempted, reused: !!r.reused };
  });
  const invented = rows.filter((r) => r.sourceQuote.status === 'NOT FOUND' || r.targetQuote.status === 'NOT FOUND');
  const labels = (list) => list.reduce((m, r) => ({ ...m, [r.label || 'NOT_CHECKED']: (m[r.label || 'NOT_CHECKED'] || 0) + 1 }), {});
  const vpaa = ['Content-course', 'Content-ILO', 'ILO-CLO', 'Content-activity', 'ILO-activity', 'Content-assessment', 'Activity-assessment'].map((type, i) => {
    const list = rows.filter((r) => r.type === type);
    return { id: 'VPAA-0' + (i + 1), type, instances: list.length, verified: list.filter((r) => r.verification === 'quotes_verified' && r.label !== null).length, labels: labels(list) };
  });
  const clo = rows.filter((r) => r.type === 'CLO-classification').map((r, i) => ({ n: i + 1, ...r }));
  const expectations = fixture.expectations || { relationships: [], classification: [] };
  const compare = [];
  for (const e of expectations.relationships || []) {
    const matches = e.type === 'all weekly relationships' ? rows.filter((r) => r.vpaa && Number(r.week) === e.week) : rows.filter((r) => r.type === e.type && Number(r.week) === e.week);
    compare.push({ what: `week ${e.week} ${e.type}`, expected: e.expect, got: matches.map((m) => `${m.type}: ${m.label || 'NOT_CHECKED'}`) });
  }
  for (const e of expectations.classification || []) {
    const m = clo.find((c) => c.n === e.clo);
    compare.push({ what: `CLO ${e.clo} (${e.label})`, expected: e.expect, got: m ? [`${m.label || 'NOT_CHECKED'}`] : ['no record'] });
  }
  return { rows, vpaa, clo, invented, compare, counts: { records: rows.length, verifiedQuotes: rows.filter((r) => r.verification === 'quotes_verified').length, notChecked: rows.filter((r) => !r.label || r.label === 'INSUFFICIENT_EVIDENCE').length } };
}

function render({ fixture, result, run = {}, title = 'Evidence' }) {
  const a = analyse({ fixture, result });
  const budget = result.hybrid.budget, cov = result.hybrid.ruleCoverage;
  const L = [];
  L.push(`# ${title}`, '');
  L.push(`Case **${fixture.meta.case}** (synthetic, ${fixture.meta.course}). ${run.kind || 'Run'}: ${run.provider || 'provider not stated'}, model \`${run.model || '?'}\`, ${run.requests ?? '?'} model request(s), ${run.charged != null ? '$' + run.charged + ' charged' : 'cost not stated'}.`, '');
  L.push('> **What this document is.** The model\'s responses, laid out so a person can read them. It does not say any judgment is academically right. The "provisional expectation" columns are the developer\'s reading of the synthetic text, not faculty-validated truth.', '');
  L.push('## Official result (unchanged by any of the above)', '');
  L.push(`Score **${result.overall ?? 'none'}**, status \`${result.status}\`, passed **${result.passed}**, pass line **${result.passThreshold}**. The advisory academic layer carries no score and no gate.`, '');
  L.push('## Seven VPAA relationships', '', '| ID | Relationship | Instances | Verified (quotes checked by the app) | Labels |', '|---|---|---|---|---|');
  for (const v of a.vpaa) L.push(`| ${v.id} | ${v.type} | ${v.instances} | ${v.verified} | ${cell(JSON.stringify(v.labels))} |`);
  L.push('', '### Judgments that are not fully supported, in full', '');
  const flagged = a.rows.filter((r) => r.vpaa && r.label !== 'ALIGNED');
  if (!flagged.length) L.push('_Every VPAA instance was judged ALIGNED._', '');
  for (const r of flagged) {
    L.push(`#### ${r.vpaa} ${r.type}, week ${r.week} — **${r.label || 'NOT_CHECKED'}** (${r.status}; ${r.verification || 'unverified'})`, '');
    L.push(`* Source (${r.path}): ${cell(clip(r.source))}`, `* Target: ${cell(clip(r.target))}`);
    L.push(`* Quoted from the source: "${cell(clip(r.sourceQuote.quote, 160))}" → ${r.sourceQuote.status}`, `* Quoted from the target: "${cell(clip(r.targetQuote.quote, 160))}" → ${r.targetQuote.status}`);
    L.push(`* Explanation: ${cell(clip(r.explanation, 400))}`, `* Recommendation: ${r.recommendation}${r.recommendedCorrection ? ' — ' + cell(clip(r.recommendedCorrection, 300)) : ''}`, '');
  }
  L.push('## Four CLO classifications', '', '| CLO | Stored classification | Statement the model saw | Model label | Quoted (verbatim?) | Explanation |', '|---|---|---|---|---|---|');
  for (const c of a.clo) L.push(`| CLO ${c.n} | ${cell(clip(c.source, 80))} | ${cell(clip(c.target, 140))} | **${c.label || 'NOT_CHECKED'}** | ${c.sourceQuote.status} / ${c.targetQuote.status} | ${cell(clip(c.explanation, 260))} |`);
  L.push('', '## Provisional expectations next to what the model concluded', '', '| Item | Developer\'s provisional expectation | What the model concluded |', '|---|---|---|');
  if (!a.compare.length) L.push('| (none for this case) | | |');
  for (const c of a.compare) L.push(`| ${cell(c.what)} | ${cell(c.expected)} | ${cell(c.got.join('; '))} |`);
  L.push('', `_${fixture.expectations && fixture.expectations.note || ''}_`, '');
  L.push('## Did the model invent anything?', '');
  L.push(`Independent check of every cited quotation against the text the model was given and the whole syllabus: **${a.invented.length}** quotation(s) not found verbatim out of ${a.rows.length} record(s).`);
  for (const r of a.invented.slice(0, 20)) L.push(`* ${r.type} ${r.id}: ${r.sourceQuote.status === 'NOT FOUND' ? 'source quote "' + cell(clip(r.sourceQuote.quote, 100)) + '"' : ''} ${r.targetQuote.status === 'NOT FOUND' ? 'target quote "' + cell(clip(r.targetQuote.quote, 100)) + '"' : ''} was not found`);
  L.push('', '## Coverage and budget', '');
  L.push(`Coverage manifest: ${cov.counts.verified} of ${cov.counts.catalogued} catalogue entries verified; not checked ${cov.counts.notChecked}; the 11 reserved rules are ${cov.rules.filter((r) => r.namespace === 'reserved' && r.status === 'NOT_CHECKED').length} of 11 Not checked.`);
  if (budget) L.push(`Per-check budget: ${budget.used.requests} request(s), $${budget.used.reservedCostUsd} reserved of $${budget.limits.maxCostUsd}; deferred optional ${budget.deferredOptional}; required evaluations incomplete: **${budget.requiredIncomplete}**.`);
  L.push('', '## What this does NOT establish', '', '* That any judgment is academically correct: that needs faculty review of the cases above.', '* Anything about real faculty syllabi, other courses or other programs.', '* The eleven reserved rules: they remain pending institutional requirements.', '');
  return { markdown: L.join('\n'), analysis: a };
}

module.exports = { analyse, render, quoteCheck, norm };
