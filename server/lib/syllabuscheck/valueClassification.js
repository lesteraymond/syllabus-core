'use strict';
// Classification of what a lesson's "values" column contains. The faculty text is never changed; this builds a DERIVED view of it.
//   core_value        one of the six official Marian-Augustinian core values, named (values.js namedValues)
//   supporting_value  a value or observable behaviour (Respect, Honesty, Cooperation ...): fine to write, but not itself an official core value
//   competency        an academic competency or graduate attribute (Critical Thinking ...): not a Marian-Augustinian core value
//   unclassified      anything the vocabulary does not recognise: neither accepted nor rejected
// Which core value a supporting value supports depends on the lesson (its activity and assessment), so NO fixed mapping exists here. That judgement is the
// advisory Value-map question; without evidence the result is NEEDS_REVIEW. The vocabulary lists are proposals (server/config/values-lexicon.json).
const fs = require('node:fs');
const path = require('node:path');
const { VALUE_NAMES, namedValues } = require('./values');
const fit = require('./lessonfit');
const { examLike } = require('./planrows');

function loadLexicon(env = process.env) {
  const file = env.SYLLABUS_CHECK_VALUES_LEXICON || path.join(__dirname, '..', '..', 'config', 'values-lexicon.json');
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const list = key => (Array.isArray(data[key]) ? data[key].map(x => String(x).toLowerCase().trim()).filter(Boolean) : []);
    return { status: 'proposed', version: String(data.version || ''), supporting: list('supportingValues'), competencies: list('competencies') };
  } catch (error) { return { status: 'not_supplied', version: '', supporting: [], competencies: [] }; }
}
const tidy = text => String(text ?? '').replace(/[•●▪·*]+/g, ' ').replace(/\s+/g, ' ').replace(/^[\s\-:;,.]+|[\s\-:;,.]+$/g, '').trim();
const flat = text => tidy(text).toLowerCase().replace(/[-_]/g, ' ');
// One entry per bullet, line or list item; "Courage: students ..." keeps its explanation with the value.
function splitExpressions(text) {
  const parts = String(text ?? '').split(/\r?\n|[•●▪]|;/).map(tidy).filter(Boolean);
  const seen = new Set();
  return parts.filter(p => { const k = flat(p); return seen.has(k) ? false : seen.add(k); });
}
const escapeRe = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasTerm = (text, term) => new RegExp(`(^|[^a-z])${escapeRe(flat(term))}([^a-z]|$)`).test(flat(text));
function classifyExpression(text, lexicon) {
  const core = namedValues(text);
  if (core.length) return { text, category: 'core_value', canonicalCoreValue: core[0] };
  if (lexicon.competencies.some(t => hasTerm(text, t))) return { text, category: 'competency', canonicalCoreValue: null };
  if (lexicon.supporting.some(t => hasTerm(text, t))) return { text, category: 'supporting_value', canonicalCoreValue: null };
  return { text, category: 'unclassified', canonicalCoreValue: null };
}
// The deterministic classification of one lesson's text.
function classifyText(text, lexicon) {
  const expressions = splitExpressions(text).map(e => classifyExpression(e, lexicon));
  const by = c => expressions.filter(e => e.category === c);
  const status = !expressions.length ? 'empty' : by('core_value').length ? 'core_named' : by('supporting_value').length ? 'supporting_only' : by('competency').length && !by('unclassified').length ? 'competency_only' : 'unclassified_only';
  return { expressions, status, core: [...new Set(by('core_value').map(e => e.canonicalCoreValue))], supporting: by('supporting_value').map(e => e.text), competencies: by('competency').map(e => e.text), unclassified: by('unclassified').map(e => e.text) };
}

// Lessons that get the Value-map question: no core value named, but a supporting or unrecognised expression the lesson's own activity might carry. A
// competency-only column is not asked (a competency is not mapped to a core value). Earlier fields must not be known to be wrong.
function mapTargets(content, judgements, lexicon) {
  const asked = [], held = [];
  for (const { row, i } of fit.lessonRows(content)) {
    const c = classifyText(row.values, lexicon);
    if (!['supporting_only', 'unclassified_only'].includes(c.status)) continue;
    const up = fit.upstreamOf(judgements, i, row);
    if (up.bad || fit.activityInvalid(judgements, i, row) || fit.assessmentInvalid(judgements, i, row)) held.push(i); else asked.push(i);
  }
  return { asked: asked.slice(0, 14), held };
}
function mapPairs(content, indexes, defs, lexicon, valueContext) {
  return indexes.map(i => {
    const row = content.plan[i], c = classifyText(row.values, lexicon);
    return { id: `row${i}-valuemap`, type: 'Value-map', source: `${valueContext(content, row, defs)}\nThe six official core values: ${VALUE_NAMES.join(', ')}.\nExpressions the faculty wrote (not official core values): ${[...c.supporting, ...c.unclassified].join('; ')}`.slice(0, 5000), target: String(row.values).slice(0, 1500), path: `plan[${i}].values`, targetPath: `plan[${i}].values` };
  });
}

// The derived record per lesson that the report carries (hybrid.valuesClassification) and the verdict reads. Nothing is stored in the syllabus.
//   classificationStatus: core_named | core_supported | needs_review | competency_only | unclassified | empty
function classifyCourse(content, judgements, lexicon) {
  const out = [];
  (content.plan || []).forEach((row, i) => {
    if (row.kind === 'exam' || examLike(row)) return;
    if (!(row.ilos || []).some(ilo => String(ilo.text || '').trim()) && !String(row.contents || '').trim()) return;
    const c = classifyText(row.values, lexicon), map = fit.label(judgements, `row${i}-valuemap`), use = fit.label(judgements, `row${i}-valueuse`);
    const v = map && fit.verified(map) && map.label === 'ALIGNED' && map.aspects ? map.aspects.values : null;
    const mapped = v && VALUE_NAMES.includes(v.coreValue) && v.integration === 'demonstrated' ? map : null;
    const status = c.status === 'core_named' ? 'core_named' : mapped ? 'core_supported' : c.status === 'empty' ? 'empty' : c.status === 'competency_only' ? 'competency_only' : c.status === 'unclassified_only' && !map ? 'unclassified' : 'needs_review';
    out.push({ path: `plan[${i}].values`, week: row.week, classificationStatus: status, expressions: c.expressions,
      canonicalCoreValue: c.core[0] || (mapped ? mapped.aspects.values.coreValue : null), supportingValue: c.supporting, competency: c.competencies,
      integrationEvidence: mapped ? { source: 'Value-map', quote: mapped.sourceQuote || null, explanation: mapped.explanation || null } : use && fit.verified(use) && use.label === 'ALIGNED' ? { source: 'Value-use', quote: use.sourceQuote || null, explanation: use.explanation || null } : null });
  });
  return out;
}
module.exports = { loadLexicon, splitExpressions, classifyExpression, classifyText, mapTargets, mapPairs, classifyCourse };
