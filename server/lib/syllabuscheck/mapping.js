'use strict';
// Stage A: PO / EGA mapping advice. A CLO whose tagged POs (or EGAs) all fail the check while the whole-list relationship (CLO-anyPO / CLO-anyEGA)
// finds that it fits ANOTHER approved item is a mapping problem: the CLO is sound, the tag is wrong. The advice names that item only when
//   - the model's explanation starts with an item number that exists in the approved list,
//   - that item is not one of the tags already chosen, and
//   - the quote the server verified in the list lies inside that item's own line.
// Nothing is invented (the item and its wording come from the approved list), and nothing is changed: it is advice for the author.
const words = text => String(text ?? '').replace(/\s+/g, ' ').trim();
const KINDS = [
  { tag: 'CLO-PO', any: 'CLO-anyPO', key: 'pos', name: 'PO', list: masters => masters.pos || [], text: item => item.text },
  { tag: 'CLO-EGA', any: 'CLO-anyEGA', key: 'egas', name: 'EGA', list: masters => masters.institution?.egas || [], text: item => item.name },
];
function mappingAdviceOf(content, masters, judgements) {
  const advice = [];
  (content.clos || []).forEach((clo, i) => {
    for (const kind of KINDS) {
      const path = `clos[${i}].statement`;
      const tags = judgements.filter(j => j.type === kind.tag && j.path === path);
      const any = judgements.find(j => j.id === `clo${i}-any${kind.name.toLowerCase()}`);
      if (!tags.length || !any || any.unverified || any.label !== 'ALIGNED') continue;
      if (!tags.every(j => !j.unverified && (j.label === 'PARTIALLY_ALIGNED' || j.label === 'NOT_ALIGNED'))) continue;
      const match = /^\W*(?:PO|EGA)?\s*#?(\d+)\b/i.exec(String(any.explanation || ''));
      const no = match ? Number(match[1]) : null;
      const item = kind.list(masters).find(row => row.no === no);
      if (!item || (clo[kind.key] || []).includes(no)) continue;
      const line = words(`${item.no}. ${kind.text(item)}`);
      if (!any.sourceQuote || !line.includes(words(any.sourceQuote))) continue;
      advice.push({ recommendationType: 'RETAG_OUTCOME', type: kind.name, cloIndex: i, path: `clos[${i}].${kind.key}`, current: [...(clo[kind.key] || [])], suggested: no, suggestedText: kind.text(item), reason: tags.map(j => j.explanation).join(' ').slice(0, 1200), evidence: any.sourceQuote, basedOn: [any.id, ...tags.map(j => j.id)] });
    }
  });
  return advice;
}

// ---- Stage B3: ILO -> CLO mapping ----
// An ILO whose every tagged CLO fails the (scored) ILO-CLO check gets ONE more question, "does it build any CLO of the course?" (ILO-anyCLO), so the
// model is only asked where a mapping problem is possible. If it names a different CLO, and that CLO exists, is not already tagged, and the
// quote the server verified lies in that CLO's own line, the advice is to re-tag the ILO. The ILO text is not rewritten and no tag is changed.
const { orientationIlo } = require('./planrows');
const MAX_ANY_CLO = 12;
const failed = j => j && !j.unverified && (j.label === 'PARTIALLY_ALIGNED' || j.label === 'NOT_ALIGNED');
const cloList = content => (content.clos || []).map((clo, k) => (String(clo.statement || '').trim() ? `CLO ${k + 1}: ${String(clo.statement).trim()}` : '')).filter(Boolean).join('\n');
function iloCandidates(content, judgements) {
  const byId = new Map(judgements.map(j => [j.id, j]));
  const out = [];
  (content.plan || []).forEach((row, i) => {
    if (row.kind === 'exam') return;
    (row.ilos || []).forEach((ilo, j) => {
      if (!String(ilo.text || '').trim() || orientationIlo(row, ilo)) return; // an orientation ILO describes the course, not a CLO competence
      const tags = (ilo.tags || []).filter(tag => tag.startsWith('clo:'));
      if (tags.length && tags.every(tag => failed(byId.get(`row${i}-ilo${j}-${tag}`)))) out.push({ i, j });
    });
  });
  return out.slice(0, MAX_ANY_CLO);
}
function anyCloPairs(content, candidates) {
  const list = cloList(content);
  if (!list) return [];
  return candidates.map(({ i, j }) => {
    const path = `plan[${i}].ilos[${j}].text`;
    return { id: `row${i}-ilo${j}-anyclo`, type: 'ILO-anyCLO', source: list, target: String(content.plan[i].ilos[j].text), path, targetPath: null };
  });
}
// `skip(i, j)` lets the engine withhold advice where an earlier element is the problem (the week's content, or the ILO itself).
function iloMappingAdviceOf(content, judgements, skip = () => false) {
  const byId = new Map(judgements.map(j => [j.id, j]));
  const clos = content.clos || [], advice = [];
  (content.plan || []).forEach((row, i) => {
    (row.ilos || []).forEach((ilo, j) => {
      const any = byId.get(`row${i}-ilo${j}-anyclo`);
      if (!any || any.unverified || any.label !== 'ALIGNED' || skip(i, j)) return;
      const tags = (ilo.tags || []).filter(tag => tag.startsWith('clo:'));
      if (!tags.length || !tags.every(tag => failed(byId.get(`row${i}-ilo${j}-${tag}`)))) return;
      const match = /^\W*(?:CLO)?\s*#?(\d+)\b/i.exec(String(any.explanation || ''));
      const k = match ? Number(match[1]) : null, clo = k && clos[k - 1];
      if (!clo || !String(clo.statement || '').trim() || tags.includes(`clo:${clo.id}`)) return;
      if (!any.sourceQuote || !words(`CLO ${k}: ${clo.statement}`).includes(words(any.sourceQuote))) return;
      const current = tags.map(tag => clos.findIndex(c => `clo:${c.id}` === tag) + 1).filter(n => n > 0);
      advice.push({ recommendationType: 'RETAG_OUTCOME', type: 'CLO', contentCheck: byId.get(`row${i}-ilo${j}-contentilo`)?.label === 'ALIGNED' ? 'verified' : 'not_checked', rowIndex: i, iloIndex: j, week: row.week, path: `plan[${i}].ilos[${j}].tags`, current, currentIds: tags.map(tag => tag.slice(4)), suggested: k, suggestedId: clo.id, suggestedText: String(clo.statement).trim(), reason: tags.map(tag => byId.get(`row${i}-ilo${j}-${tag}`).explanation).join(' ').slice(0, 1200), evidence: any.sourceQuote, basedOn: [any.id, ...tags.map(tag => `row${i}-ilo${j}-${tag}`)] });
    });
  });
  return advice;
}
module.exports = { mappingAdviceOf, iloCandidates, anyCloPairs, iloMappingAdviceOf, MAX_ANY_CLO };
