'use strict';
// What a faculty member changed between two versions of a form syllabus. Only what they write counts: the course choice and credit units, the
// description, the learning plan, the course requirements, the references and the grading. The catalog's own text (vision, mission, EGAs,
// program outcomes, course learning outcomes, the course code and title it supplies) and the system's sign-off are not theirs, so an
// administrator editing the catalog never makes a syllabus look "changed".
//
// Changes that are not changes are ignored: spacing, blank lines and the internal ids of rows. Any change to a letter or a word counts, and
// the result says how much (words, rows) so the reviewer can judge whether it is a real revision.

const SECTIONS = [
  { key: 'meta', label: 'Course information', pick: ['courseId', 'lecture', 'lab', 'prereq'] },
  { key: 'description', label: 'Course description' },
  { key: 'plan', label: 'Learning plan', unit: 'week' },
  { key: 'reqs', label: 'Course requirements' },
  { key: 'refs', label: 'References' },
  { key: 'grading', label: 'Grading system' },
];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// A copy that compares equal when the text is the same: strings trimmed with runs of whitespace collapsed, row ids dropped, keys in order.
function normalize(value) {
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
  if (Array.isArray(value)) return value.map(normalize);
  if (isObject(value)) {
    const out = {};
    Object.keys(value).sort().forEach((k) => { if (k !== 'id') out[k] = normalize(value[k]); });
    return out;
  }
  return value === undefined ? null : value;
}

const section = (content, def) => {
  const raw = isObject(content) ? content[def.key] : undefined;
  if (def.pick) { const o = isObject(raw) ? raw : {}; return normalize(Object.fromEntries(def.pick.map((k) => [k, o[k] === undefined ? null : o[k]]))); }
  return normalize(raw === undefined ? null : raw);
};

// Every piece of text in a value, in order. A number counts as a word, so a changed grading split or unit count shows how much changed.
function words(value, out = []) {
  if (typeof value === 'number') out.push(String(value));
  else if (typeof value === 'string') value.split(' ').filter(Boolean).forEach((w) => out.push(w));
  else if (Array.isArray(value)) value.forEach((v) => words(v, out));
  else if (isObject(value)) Object.keys(value).forEach((k) => words(value[k], out));
  return out;
}

// How many words differ: the words that were added plus the words that were removed (a replaced word counts as 2, a typo fix as 2).
function wordDelta(a, b) {
  const count = (list) => list.reduce((m, w) => m.set(w, (m.get(w) || 0) + 1), new Map());
  const x = count(words(a));
  const y = count(words(b));
  let n = 0;
  new Set([...x.keys(), ...y.keys()]).forEach((w) => { n += Math.abs((x.get(w) || 0) - (y.get(w) || 0)); });
  return n;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Rows that differ, for a list of rows (the learning plan): changed in place, added or removed.
function rowDelta(a, b) {
  const x = Array.isArray(a) ? a : [];
  const y = Array.isArray(b) ? b : [];
  let n = Math.abs(x.length - y.length);
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (!same(x[i], y[i])) n += 1;
  return n;
}

// -> [] when nothing the faculty member writes differs; otherwise [{ key, label, words, rows? }] for each section that does.
function changedSections(previous, next) {
  const out = [];
  SECTIONS.forEach((def) => {
    const a = section(previous, def);
    const b = section(next, def);
    if (same(a, b)) return;
    const item = { key: def.key, label: def.label, words: wordDelta(a, b) };
    if (def.unit) item.rows = rowDelta(a, b);
    out.push(item);
  });
  if (previous?.outcomes || next?.outcomes) {
    const authored = c => normalize({ outcomes: c?.outcomes || (c?.catalog ? { vision: c.catalog.institution?.vision, mission: c.catalog.institution?.mission, egas: c.catalog.program?.egas || c.catalog.institution?.egas || [], pos: c.catalog.program?.pos || [] } : null), clos: c?.clos || [] });
    const a = authored(previous), b = authored(next);
    if (!same(a, b)) out.push({ key: 'outcomes', label: 'Learning outcomes', words: wordDelta(a, b) });
  }
  return out;
}

// "Course description (1 word), Learning plan (2 weeks)": what a reviewer reads.
function describeChanges(list) {
  return list.map((c) => {
    const parts = [];
    if (c.rows) parts.push(c.rows + (c.rows === 1 ? ' week' : ' weeks'));
    else if (c.words) parts.push(c.words + (c.words === 1 ? ' word' : ' words'));
    return c.label + (parts.length ? ' (' + parts.join(', ') + ')' : '');
  }).join(', ');
}

module.exports = { changedSections, describeChanges, normalize, wordDelta, SECTIONS };
