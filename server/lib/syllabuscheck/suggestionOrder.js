'use strict';
// Top-down order of AI rewrites, so the recommendations of one check do not contradict each other.
//
// Every AI draft is written for ONE relationship, against the CURRENT text of the field on the other side of it (its source). When that source
// field gets its own rewrite in the same check, the draft was written against text that is about to change: applying both leaves the second
// field fitted to the old version of the first, and the next check flags it again (an ILO rewritten for its CLO, while the week's activity was
// rewritten for the old ILO; a CLO rewritten for a PO, while its ILOs were rewritten for the old CLO; the weekly contents rewritten, while the
// description was rewritten from the old contents).
//
// The fields follow one order: CLO -> ILO -> course content -> learning activities -> assessment tasks -> values -> course description. A rewrite
// is offered only when no field EARLIER in that order that its draft was written against is itself being rewritten in this check. The others
// wait: they are listed (not offered) with the field they wait for, and the next check, made after that field is settled, writes them against
// the revised text. Each round settles the earliest fields for good, so the recommendations converge instead of moving around the syllabus.
//
// A field whose rewrite the author REJECTED in the previous check counts as settled: the author keeps it as written, so the fields after it
// are fitted to it now and nothing waits forever on a recommendation the author has already declined.
//
// Display only: judgements, findings, points, scores and verdict statuses are unchanged. SYLLABUS_CHECK_SUGGESTION_ORDER=off restores the old
// behaviour (every rewrite offered at once).

const VERSION = 'suggestion-order-1';
const enabled = (env = process.env) => String(env?.SYLLABUS_CHECK_SUGGESTION_ORDER || '').trim().toLowerCase() !== 'off';

// The place of a field in the order. Anything else (references, tags, a coded field) has no place and neither waits nor holds anything back.
function layerOf(path) {
  const p = String(path || '');
  if (/^clos\[\d+\]\.statement$/.test(p)) return 0;
  if (/^plan\[\d+\]\.ilos\[\d+\]\.text$/.test(p)) return 1;
  if (/^plan\[\d+\]\.contents$/.test(p)) return 2;
  if (/^plan\[\d+\]\.activities$/.test(p)) return 3;
  if (/^plan\[\d+\]\.tasks$/.test(p)) return 4;
  if (/^plan\[\d+\]\.values$/.test(p)) return 5;
  if (p === 'description') return 6;
  return null;
}

const rowFields = (content, i, fields) => {
  const row = content?.plan?.[i];
  if (!row) return [];
  const out = [];
  if (fields.includes('ilos')) (row.ilos || []).forEach((_, j) => out.push(`plan[${i}].ilos[${j}].text`));
  for (const f of ['contents', 'activities', 'tasks']) if (fields.includes(f)) out.push(`plan[${i}].${f}`);
  return out;
};

// The syllabus fields a relationship's draft was written against (the source side of the pair, gemini.js pairsOf / lessonfit.js). The course
// identity and the approved masters (PO, EGA, institution) are not syllabus fields a recommendation rewrites, so they are never listed.
function readsOf(judgement, content) {
  const id = String(judgement?.id || ''), type = judgement?.type;
  const row = /^row(\d+)-/.exec(id), i = row ? Number(row[1]) : null;
  switch (type) {
    case 'ILO-CLO': {
      const tag = /-clo:(.+)$/.exec(id);
      const k = tag ? (content?.clos || []).findIndex(c => String(c?.id) === tag[1]) : -1;
      return k >= 0 ? [`clos[${k}].statement`] : [];
    }
    case 'ILO-content': case 'ILO-activity': case 'ILO-assessment':
      return judgement.path ? [judgement.path] : [];
    case 'Content-ILO': // Stage B: the ILO is judged against the week's content (a LATER field in the order, so it never holds the ILO back)
      return i === null ? [] : [`plan[${i}].contents`];
    case 'Activity-fit':
      return i === null ? [] : rowFields(content, i, ['ilos', 'contents']);
    case 'Assessment-fit':
      return i === null ? [] : rowFields(content, i, ['ilos', 'contents', 'activities']);
    case 'Module-value': case 'Value-use': {
      const at = i !== null ? i : Number((/^plan\[(\d+)\]/.exec(judgement.targetPath || judgement.path || '') || [])[1]);
      return Number.isInteger(at) ? rowFields(content, at, ['ilos', 'contents', 'activities', 'tasks']) : [];
    }
    case 'Description-plan':
      return (content?.plan || []).map((r, k) => (r?.kind === 'exam' ? null : `plan[${k}].contents`)).filter(Boolean);
    default:
      return [];
  }
}

// offered: the suggestions the engine would offer (coded and AI). judgements: the alignment judgements of this check. rejectedPaths: the fields
// whose AI rewrite the author rejected in the previous check (repository.js correctionHistory). Returns the suggestions still offered and the
// ones that wait, each with the fields it waits for.
function orderSuggestions({ offered = [], judgements = [], content = {}, rejectedPaths = [] } = {}) {
  const byId = new Map(judgements.map(j => [j.id, j]));
  const declined = new Set(rejectedPaths || []);
  // A field is unsettled when this check offers a rewrite for it that the author has not already declined.
  const unsettled = new Set(offered.filter(s => s.path && !declined.has(s.path)).map(s => s.path));
  const keep = [], waiting = [];
  for (const s of offered) {
    const own = layerOf(s.path);
    // Coded (deterministic) recommendations are never held back, and a field outside the order has nothing before it.
    if (s.source !== 'ai' || own === null) { keep.push(s); continue; }
    // The relationship whose draft the suggestion carries is its id (engine.js: the most serious relationship supplies the draft).
    const author = byId.get(String(s.id).replace(/^SEM:/, ''));
    const waitsFor = author ? [...new Set(readsOf(author, content).filter(p => p !== s.path && unsettled.has(p) && layerOf(p) !== null && layerOf(p) < own))] : [];
    if (!waitsFor.length) { keep.push(s); continue; }
    waiting.push({ suggestion: s, waitsFor });
  }
  return { offered: keep, waiting };
}

module.exports = { VERSION, enabled, layerOf, readsOf, orderSuggestions };
