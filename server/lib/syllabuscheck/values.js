'use strict';
// Stage D1: Marian-Augustinian values.
// The six core values are the ones the checker has always used (the coded VALUE check and the scored Module-value relationship): this module is now the one
// place that lists them, in the same order, so nothing about the scored behaviour changes.
//
// WHAT IS NOT HERE: the institution's authoritative DEFINITIONS of the six values. They are not in the repository and are not invented here. They can be
// supplied in a JSON file (server/config/marian-values.json, or the path in SYLLABUS_CHECK_VALUES_FILE):
//   { "version": "...", "source": "where the wording comes from", "values": [ { "name": "Humility", "definition": "..." }, ... ] }
// When present and valid, the definition of every value a lesson names is given to the AI with that lesson. When absent, the AI is told that none is supplied
// and must judge only whether the lesson text itself shows students acting in a way that expresses the named value; every finding then says the
// definitions were not supplied (`definitions: 'not_supplied'`), so the result is never presented as a judgement against the institutional definition.
//
// Integration is judged per lesson (Value-use, advisory) only where the scored Module-value answer is ALIGNED and the lesson's earlier fields are not known to
// be off: a lesson the scored check already flags keeps that finding and is not asked again. No value is required in every lesson and not every value needs to
// appear in the course. Examination rows are never asked.
const fs = require('node:fs');
const path = require('node:path');
const { examLike, brief } = require('./planrows');
const fit = require('./lessonfit');

const VALUE_NAMES = Object.freeze(['Compassion', 'Courage', 'Community-orientedness', 'Humility', 'Interiority', 'Missionary Spirit']);
const spellings = name => (name === 'Community-orientedness' ? ['community-orientedness', 'community orientedness'] : [name.toLowerCase()]);
// The core values a text names, in the order of VALUE_NAMES (exact names only: no synonyms and no adjectives are guessed).
function namedValues(text) {
  const t = String(text ?? '').toLowerCase();
  return VALUE_NAMES.filter(name => spellings(name).some(spelling => t.includes(spelling)));
}

// ---- the institution's definitions, when supplied ----
function loadDefinitions(env = process.env) {
  const file = env.SYLLABUS_CHECK_VALUES_FILE || path.join(__dirname, '..', '..', 'config', 'marian-values.json');
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (error) { return { status: 'not_supplied', definitions: {} }; }
  try {
    const data = JSON.parse(raw), definitions = {};
    if (!data || typeof data !== 'object' || !Array.isArray(data.values)) throw new Error('"values" must be a list');
    for (const row of data.values) {
      if (!row || !VALUE_NAMES.includes(row.name)) throw new Error(`"${row && row.name}" is not one of the six core values`);
      if (typeof row.definition !== 'string' || !row.definition.trim() || row.definition.length > 1200) throw new Error(`the definition of ${row.name} must be a text of up to 1200 characters`);
      definitions[row.name] = row.definition.trim();
    }
    // 'configured' only when the institution has marked the wording approved; a file copied from a website and not yet confirmed is 'pending_approval'.
    // Both are given to the AI with the lesson; only the label on the findings differs, and every Stage D1 finding stays advisory either way.
    const approved = data.approval === 'approved';
    if (!approved && Object.keys(definitions).length !== VALUE_NAMES.length) throw new Error('a definition is missing for one of the six values');
    return { status: approved ? 'configured' : 'pending_approval', version: String(data.version || ''), source: String(data.source || ''), retrievedAt: String(data.retrievedAt || ''), definitions };
  } catch (error) { return { status: 'invalid', reason: error.message, definitions: {} }; }
}

// ---- the question about one lesson ----
function valueContext(content, row, defs) {
  const ilos = fit.iloIndexes(row).map(j => `- ${brief(row.ilos[j].text, 300)}`);
  const named = namedValues(row.values);
  const definitions = named.filter(name => defs.definitions[name]).map(name => `- ${name}: ${defs.definitions[name]}`);
  return [`Week ${row.week} course content: ${String(row.contents).trim().slice(0, 1000)}`, 'ILOs:', ...ilos,
    `Learning activities: ${brief(row.activities, 500) || '(none written)'}`, `Assessment tasks: ${brief(row.tasks, 400) || '(none written)'}`,
    definitions.length ? `Definitions of the values named (from the institution's published wording; approval status: ${defs.status}):\n${definitions.join('\n')}` : 'No institutional definition of the values named is supplied: judge only what the lesson text itself shows.'].join('\n');
}
// The lessons that get the question, and why the others do not.
function eligible(content, judgements) {
  const asked = [], reused = [], upstream = [], noValue = [];
  for (const { row, i } of fit.lessonRows(content)) {
    if (!String(row.values || '').trim() || !namedValues(row.values).length) { noValue.push(i); continue; }
    const up = fit.upstreamOf(judgements, i, row);
    if (up.bad || fit.activityInvalid(judgements, i, row) || fit.assessmentInvalid(judgements, i, row)) { upstream.push(i); continue; }
    const scored = fit.label(judgements, `row${i}-value`);
    if (fit.verified(scored) && scored.label === 'ALIGNED') asked.push(i); else reused.push(i);
  }
  return { asked: asked.slice(0, 36), reused, upstream, noValue };
}
function valuePairs(content, indexes, defs) {
  return indexes.map(i => { const row = content.plan[i]; return { id: `row${i}-valueuse`, type: 'Value-use', source: valueContext(content, row, defs), target: String(row.values).slice(0, 1500), path: `plan[${i}].values`, targetPath: `plan[${i}].values` }; });
}

// ---- the whole course (VAL-04), without a model call ----
// From the coded names, the scored Module-value answers and the Value-use answers: how many lessons name a value, how many were judged integrated, and
// whether one text is simply copied into most lessons. The share below is a proposal for review, not an approved institutional threshold.
const POLICY = Object.freeze({ approved: false, minIntegratedShare: 0.5, copiedShare: 0.6, copiedMinLessons: 4 });
function valuesProfile(content, judgements = [], defs = { status: 'not_supplied' }) {
  const rows = fit.lessonRows(content).concat((content.plan || []).map((row, i) => ({ row, i })).filter(({ row }) => row.kind !== 'exam' && !examLike(row) && String(row.contents || '').trim() && !(row.ilos || []).some(ilo => String(ilo.text || '').trim())));
  const seen = new Set(), lessons = rows.filter(({ i }) => (seen.has(i) ? false : seen.add(i))).sort((a, b) => a.i - b.i);
  const norm = text => String(text ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const withValue = lessons.filter(({ row }) => namedValues(row.values).length);
  const counts = Object.fromEntries(VALUE_NAMES.map(name => [name, withValue.filter(({ row }) => namedValues(row.values).includes(name)).length]));
  const texts = new Map(); for (const { row } of withValue) { const key = norm(row.values); texts.set(key, (texts.get(key) || 0) + 1); }
  const [copiedText, copiedCount] = [...texts.entries()].sort((a, b) => b[1] - a[1])[0] || ['', 0];
  const verdictOf = i => { const use = fit.label(judgements, `row${i}-valueuse`), scored = fit.label(judgements, `row${i}-value`); return use && fit.verified(use) ? use : scored && fit.verified(scored) ? scored : null; };
  const checked = withValue.filter(({ i }) => verdictOf(i)), integrated = checked.filter(({ i }) => verdictOf(i).label === 'ALIGNED');
  return {
    definitions: defs.status, policy: POLICY, lessons: lessons.length, namingAValue: withValue.length, valuesUsed: counts,
    copied: withValue.length >= POLICY.copiedMinLessons && copiedCount / withValue.length >= POLICY.copiedShare ? { lessons: copiedCount, of: withValue.length, text: copiedText.slice(0, 200) } : null,
    checked: checked.length, integrated: integrated.length, integratedWeeks: integrated.map(({ row }) => row.week),
  };
}
module.exports = { VALUE_NAMES, namedValues, loadDefinitions, eligible, valuePairs, valueContext, valuesProfile, POLICY };
