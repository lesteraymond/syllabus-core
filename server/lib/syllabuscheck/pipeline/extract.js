'use strict';
// Re-planned AI Checker, Phase 1: turn a saved syllabus (content JSON, schemaVersion 2) and the school's masters into ONE structured map that
// every later stage reads. Pure: no model, no database, no network. Each field carries a fingerprint of its normalized text, so a later
// verification can reuse an answer only when the exact text is unchanged.
const crypto = require('node:crypto');
const { examLike, weeksIn, ORIENTATION } = require('../planrows');
const { namedValues } = require('../values');
const { CLO_LEVELS, BLOOM_ORDER_FIL, AFFECTIVE_VERBS_FIL } = require('./rules');

const clean = text => String(text ?? '').replace(/\s+/g, ' ').trim();
const fingerprint = text => crypto.createHash('sha256').update(clean(text).toLowerCase()).digest('hex').slice(0, 16);
const lines = text => String(text ?? '').split(/\r?\n/);

// The separate items of a free-text cell: one per line, with bullets and numbering removed. A single line holding several items separated by
// semicolons is split on them. Blank items are dropped.
function itemsOf(text) {
  const BULLET = /^\s*(?:[-*•▪◦·]|\(?[0-9]{1,2}[.)]|\(?[a-z][.)])\s+/i;
  let items = lines(text).map(line => clean(line.replace(BULLET, ''))).filter(Boolean);
  if (items.length === 1 && items[0].includes(';')) items = items[0].split(';').map(clean).filter(Boolean);
  return items;
}

// EGAs and POs: the masters passed in (what the server loads), else the copy saved with the syllabus.
function mastersOf(content, masters) {
  const egas = masters?.institution?.egas || content?.outcomes?.egas || content?.catalog?.program?.egas || [];
  const pos = masters?.pos || content?.outcomes?.pos || content?.catalog?.program?.pos || [];
  return {
    egas: egas.map(e => ({ no: Number(e.no), name: clean(e.name), text: clean(e.text || e.name) })),
    pos: pos.map(p => ({ no: Number(p.no), text: clean(p.text), egas: (p.egas || []).map(Number) })),
  };
}

function cloOf(clo, index) {
  const fixed = CLO_LEVELS[index] || null;
  return {
    no: index + 1, id: clo.id, title: clean(clo.title), statement: clean(clo.statement),
    savedLevel: clo.level || null, requiredLevel: fixed ? fixed.level : null,
    pos: (clo.pos || []).map(Number), egas: (clo.egas || []).map(Number),
    fingerprint: fingerprint(clo.statement),
  };
}

function kindOf(row, weeks) {
  if (examLike(row)) return 'exam';
  if (weeks.includes(1) && (ORIENTATION.test(String(row.contents || '')) || (row.ilos || []).some(ilo => ORIENTATION.test(String(ilo.text || ''))))) return 'orientation';
  return 'lesson';
}

function weekOf(row, index, clos) {
  const weeks = weeksIn(row.week);
  const cloById = new Map(clos.map(c => [c.id, c]));
  const ilos = (row.ilos || []).filter(ilo => clean(ilo.text)).map(ilo => {
    const tags = ilo.tags || [];
    const cloIds = tags.filter(t => /^clo:/.test(t)).map(t => t.slice(4));
    return {
      id: ilo.id, text: clean(ilo.text), fingerprint: fingerprint(ilo.text),
      cloIds, cloNos: cloIds.map(id => cloById.get(id)?.no ?? null), unknownClos: cloIds.filter(id => !cloById.has(id)),
    };
  });
  const values = clean(row.values);
  return {
    index, rowId: row.id, label: clean(row.week), weeks, kind: kindOf(row, weeks),
    content: { text: clean(row.contents), fingerprint: fingerprint(row.contents) },
    ilos,
    activities: { text: clean(row.activities), items: itemsOf(row.activities), fingerprint: fingerprint(row.activities) },
    tasks: { text: clean(row.tasks), items: itemsOf(row.tasks), fingerprint: fingerprint(row.tasks) },
    values: { text: values, named: namedValues(values), fingerprint: fingerprint(values) },
  };
}

function referencesOf(refs) {
  const out = [];
  for (const [group, block] of Object.entries(refs || {})) {
    if (!block || block.na) continue;
    for (const item of block.items || []) if (clean(item.t)) out.push({ group, id: item.id, text: clean(item.t), fingerprint: fingerprint(item.t) });
  }
  return out;
}

// The syllabus with every item id unique: CLOs, ILOs (across all weeks), week rows, and the references of each group. Every question, plan key and
// report path of the checker is found through these ids (`ilo:<id>`), so two items with one id made two questions with one name: the check stayed
// incomplete on every run, or one item got the other's verdict and draft. The first item with an id keeps it; a repeated, missing or non-text id is
// renamed (`<id>~<n>`, or `id~<n>` when there was none), the same way every time. Only ids change: ILO tags (`clo:<id>`) still name the CLO that
// kept the id, as the editor shows them. Returns the content itself when every id is already unique, else a copy: the saved syllabus never changes.
function uniqueIds(content) {
  if (!content || typeof content !== 'object') return content;
  const lists = [content.clos, (content.plan || []).flatMap(row => (row && row.ilos) || []), content.plan, ...Object.values(content.refs || {}).map(block => block && block.items)]
    .map(list => (Array.isArray(list) ? list.filter(item => item && typeof item === 'object') : []));
  const valid = id => typeof id === 'string' && id !== '';
  const needsWork = list => { const seen = new Set(); return list.some(item => !valid(item.id) || seen.has(item.id) || !seen.add(item.id)); };
  if (!lists.some(needsWork)) return content;
  const copy = structuredClone(content);
  const copyLists = [copy.clos, (copy.plan || []).flatMap(row => (row && row.ilos) || []), copy.plan, ...Object.values(copy.refs || {}).map(block => block && block.items)]
    .map(list => (Array.isArray(list) ? list.filter(item => item && typeof item === 'object') : []));
  const own = id => (typeof id === 'number' && Number.isFinite(id) ? String(id) : id); // a numeric id is the same id as text (tags are text)
  for (const list of copyLists) {
    const taken = new Set(list.map(item => own(item.id)).filter(valid));
    const kept = new Set();
    list.forEach((item, i) => {
      const id0 = own(item.id);
      if (valid(id0) && !kept.has(id0)) { item.id = id0; kept.add(id0); return; }
      let id = `${valid(id0) ? id0 : 'id'}~${i + 1}`;
      while (taken.has(id)) id += '~';
      taken.add(id); kept.add(id);
      item.id = id;
    });
  }
  return copy;
}

// CHED credit units: 1 lecture unit = 1 contact hr/week, 1 laboratory unit = 3 contact hrs/week (standard-v4.json).
const unitNum = v => { const n = Number.parseFloat(String(v ?? '').trim()); return Number.isFinite(n) && n >= 0 ? n : null; };
function unitsOf(meta) {
  const lecture = unitNum(meta?.lecture), lab = unitNum(meta?.lab);
  const contactHoursPerWeek = lecture !== null && lab !== null && lecture + lab > 0 ? lecture + lab * 3 : null;
  return { lectureUnits: lecture, labUnits: lab, contactHoursPerWeek };
}

// The structured map of one syllabus.
function extract(content, masters) {
  const c = content || {};
  const clos = (c.clos || []).map(cloOf);
  const { lectureUnits, labUnits, contactHoursPerWeek } = unitsOf(c.meta);
  return {
    course: {
      code: clean(c.meta?.code), title: clean(c.meta?.title), program: clean(c.meta?.program),
      ...(lectureUnits !== null ? { lectureUnits } : {}),
      ...(labUnits !== null ? { labUnits } : {}),
      ...(contactHoursPerWeek !== null ? { contactHoursPerWeek } : {}),
    },
    masters: mastersOf(c, masters),
    clos,
    weeks: (c.plan || []).map((row, i) => weekOf(row, i, clos)),
    references: referencesOf(c.refs),
  };
}

// Is `a` a near copy of `b`? Content words (3+ letters, common words left out): 80% of the shorter one's words shared, or the same leading verb
// with 45% and at least 5 words shared. "Compare FIR and IIR filters by explaining their advantages..." and "Compare FIR and IIR filters and explain how their
// advantages ... affect the choice..." are near copies; "Explain FIR filters" and "Design an FIR filter" are not.
const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'their', 'that', 'this', 'from', 'into', 'each', 'how', 'its', 'are', 'using', 'use', 'given', 'own']);
const wordsOf = text => (clean(text).toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter(w => !STOPWORDS.has(w));
function nearCopy(a, b) {
  const x = wordsOf(a), y = wordsOf(b);
  if (x.length < 4 || y.length < 4) return false;
  const ys = new Set(y), xs = new Set(x);
  let shared = 0; for (const w of xs) if (ys.has(w)) shared++;
  const overlap = shared / Math.min(xs.size, ys.size);
  // the second test also needs 5 shared words: outcomes often start with the same verb ("Explain ..."), which alone proves nothing
  return overlap >= 0.8 || (x[0] === y[0] && overlap >= 0.45 && shared >= 5);
}

// ---- the action verbs an outcome opens with ----
// CHED (Implementation Handbook for OBE and ISA, 2014, "Writing learning outcomes", rule 7): "Choose only one observable verb/behavior in a statement
// of outcome; choose the behavior that is of a higher dimension of complexity." This finds the verbs an outcome STARTS with when two or more are
// joined ("Define and explain ...", "Design, implement, and test ..."). Only words on this list count as verbs, so "Apply De Morgan's laws and ..."
// is one verb. Sources: the revised Bloom verbs (rules.BLOOM_ORDER) and the CHED handbook's Annex 4 (cognitive, psychomotor and affective verbs).
const OUTCOME_VERBS = new Set(`
  define list identify recall recognize name state label match memorize repeat reproduce outline record
  explain describe summarize classify discuss interpret illustrate paraphrase compare contrast infer exemplify translate estimate predict distinguish relate express report review restate locate
  apply use implement solve demonstrate write compute calculate perform execute operate show prepare practice employ modify construct produce manipulate sketch operate run test simulate configure install code program draw measure
  analyze analyse differentiate examine organize deconstruct attribute investigate categorize diagram break question detect separate debug trace
  evaluate judge justify critique assess appraise argue defend support check verify rate select choose prioritize recommend conclude decide validate weigh
  create design develop plan formulate compose generate propose build invent devise assemble integrate synthesize model author originate
  adopt commit advocate exemplify influence serve act display share participate volunteer value reflect respect appreciate observe apply
  correct fix revise edit present communicate collaborate lead manage conduct document derive prove convert graph plot troubleshoot maintain deploy
  optimize optimise analyse organise summarise recognise criticize critique cite discover research explore
  acknowledge comply contribute cooperate initiate balance rank theorize adapt adjust conceptualize embrace uphold
`.split(/\s+/).filter(Boolean));
// The words before the main verb that are not part of it: "Students will be able to", "The learner will", "Be able to".
const PREAMBLE = /^(?:(?:at the end of [^,]*,\s*)?(?:the\s+)?(?:students?|learners?)\s+(?:will|should|shall|must|can)\s+(?:be\s+able\s+to\s+)?|(?:be\s+)?able\s+to\s+)/i;
// The verbs after the first one: a joiner (",", "and", "or", "/", "&", "and/or"), then another verb on the list; anything else ends the list.
function joinedVerbs(words, verbSet, joiners) {
  if (!words.length || !verbSet.has(words[0])) return [];
  const verbs = [words[0]];
  for (let i = 1; i < words.length;) {
    let j = i, joined = false;
    while (j < words.length && joiners.includes(words[j])) { j++; joined = true; }
    if (!joined || j >= words.length || !verbSet.has(words[j])) break;
    verbs.push(words[j]);
    i = j + 1;
  }
  return verbs;
}
// An outcome written in Filipino (a Filipino-language subject): its own verb list (rules.BLOOM_ORDER_FIL, rules.AFFECTIVE_VERBS_FIL), its own preamble
// ("Sa pagtatapos ng kurso, ang mga mag-aaral ay inaasahang ...") and its own joiners ("at", "o"). It is tried only when the English reading finds no
// verb, so every English outcome is read exactly as before.
const FILIPINO_VERBS = new Set([...BLOOM_ORDER_FIL.flatMap(b => b.verbs.split(/,\s*/)), ...AFFECTIVE_VERBS_FIL.split(/,\s*/)]);
const PREAMBLE_FIL = /^(?:sa\s+pagtatapos\s+ng\s+[^,]*,\s*)?(?:ang\s+)?(?:mga\s+)?(?:mag-aaral|estudyante)\s+(?:ay\s+)?(?:inaasahang\s+|inaasahan\s+na\s+|dapat\s+na\s+)?/i;
function leadingVerbs(text) {
  const body = clean(text).replace(PREAMBLE, '');
  const english = joinedVerbs(body.toLowerCase().match(/[a-z]+|[,/&]/g) || [], OUTCOME_VERBS, [',', 'and', 'or', '/', '&']);
  if (english.length) return english;
  // a hyphenated Filipino word stays whole ("naiisa-isa", "mabigyang-kahulugan")
  return joinedVerbs(clean(text).replace(PREAMBLE_FIL, '').toLowerCase().match(/[a-zñ]+(?:-[a-zñ]+)*|[,/&]/g) || [], FILIPINO_VERBS, [',', 'at', 'o', '/', '&']);
}

module.exports = { extract, uniqueIds, itemsOf, fingerprint, clean, nearCopy, leadingVerbs, OUTCOME_VERBS, FILIPINO_VERBS };
