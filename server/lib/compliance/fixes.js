'use strict';
// Fixes that need no AI: the checker's own finding says exactly what is wrong and there is one right answer. Each is returned as a
// suggestion the author can accept or reject, like the AI's (see suggest.js), made of formOps operations.
//   grading components that do not total 100%   -> scale them so they do
//   a requirement that starts with its own number -> remove the number
//   a missing Prelim / Midterm / Final examination row -> add it at its week
//   an empty ILO before a filled one              -> remove the empty one
//   a requirement or a reference listed twice      -> remove the repeat
//   no word on diverse learners                   -> add a standard accommodation requirement
//   a grading component listed twice               -> merge them into one, adding their percentages
//   Learning Plan rows out of week order          -> sort them
//   the vision, mission or a graduate attribute that is not the LCUP's wording -> the LCUP's wording, from the standard
//
//   suggestion(spec)              -> a suggestion with its id (a hash of what it is about, so a rejection can be remembered)
//   stablePath(content, path)     the finding's path with list positions replaced by ids, so it survives other edits
//   deterministic(content, findings, standard) -> [suggestion]
const crypto = require('crypto');
const { weekKey } = require('./fixHelpers');

const arr = (x) => (Array.isArray(x) ? x : []);
const text = (x) => (x == null ? '' : String(x));
const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
const blank = (x) => !text(x).trim();

function suggestion({ kind, label, why, rules, covers, changes, ops, expect = [] }) {
  const id = crypto.createHash('sha256').update(kind + '\n' + JSON.stringify(expect) + '\n' + JSON.stringify(ops.map((o) => [o.op, o.path || '', o.value && o.value.id || '']))).digest('hex').slice(0, 12);
  return { id, kind, label, why, rules, covers, changes, ops, expect };
}

// 'plan[2].ilos[0]' -> 'plan[id=r3].ilos[id=i7]' (an item without an id keeps its position).
function stablePath(content, path) {
  let node = content;
  const out = [];
  for (const part of String(path).split('.')) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)(?:\[(\d+)\])?$/.exec(part);
    if (!m) return null;
    if (m[2] === undefined) { out.push(m[1]); node = obj(node)[m[1]]; continue; }
    const item = arr(obj(node)[m[1]])[Number(m[2])];
    if (item === undefined) return null;
    out.push(m[1] + (obj(item).id !== undefined ? '[id=' + item.id + ']' : '[' + m[2] + ']'));
    node = item;
  }
  return out.join('.');
}

const find = (findings, ruleId) => arr(findings).filter((f) => f && f.ruleId === ruleId);
const cover = (fs) => fs.map((f) => f.ruleId + '|' + f.path);
const weekLabel = (r) => 'Week ' + (text(obj(r).week).trim() || '?');

function gradingFix(content, findings) {
  const fs = find(findings, 'T-24');
  const rows = arr(obj(content.grading).rows);
  if (!fs.length || !rows.length || rows.some((r) => !Number.isFinite(Number(obj(r).pct)))) return [];
  const w = rows.map((r) => Number(r.pct));
  const sum = w.reduce((s, x) => s + x, 0);
  if (sum === 100) return [];
  const share = sum > 0 ? w.map((x) => (x * 100) / sum) : w.map(() => 100 / rows.length);
  const base = share.map(Math.floor);
  let left = 100 - base.reduce((s, x) => s + x, 0);
  share.map((x, i) => ({ i, f: x - Math.floor(x) })).sort((a, b) => b.f - a.f || a.i - b.i).forEach(({ i }) => { if (left > 0) { base[i] += 1; left -= 1; } });
  const ref = (r, i) => 'grading.rows' + (obj(r).id !== undefined ? '[id=' + r.id + ']' : '[' + i + ']') + '.pct';
  const show = (vals) => rows.map((r, i) => text(obj(r).label).trim() + ' ' + vals[i] + '%').join(' · ');
  return [suggestion({
    kind: 'grading', label: 'Grading system', rules: ['T-24'], covers: cover(fs),
    why: 'The components add up to ' + sum + '%; each is scaled so the total is 100%.',
    changes: [{ before: show(w) + ' = ' + sum + '%', after: show(base) + ' = 100%' }],
    ops: rows.map((r, i) => ({ op: 'set', path: ref(r, i), value: base[i] })).filter((o, i) => base[i] !== w[i]),
    expect: rows.map((r, i) => ({ path: ref(r, i), value: w[i] })),
  })];
}

function requirementNumbers(content, findings) {
  const reqs = arr(content.reqs);
  return find(findings, 'T-20').map((f) => {
    const m = /^reqs\[(\d+)\]$/.exec(f.path);
    const r = m && reqs[Number(m[1])];
    if (!r) return null;
    const stripped = text(r.t).replace(/^\s*\d+\s*[.)]\s+/, '').trim();
    if (!stripped || stripped === text(r.t).trim()) return null;
    const path = stablePath(content, f.path) + '.t';
    return suggestion({
      kind: 'text', label: 'Requirement ' + (Number(m[1]) + 1), rules: ['T-20'], covers: cover([f]),
      why: 'The form numbers the list itself, so the typed number is removed.',
      changes: [{ before: text(r.t).trim(), after: stripped }], ops: [{ op: 'set', path, value: stripped }], expect: [{ path, value: text(r.t) }],
    });
  }).filter(Boolean);
}

// Where each examination belongs in a term of `weeks` weeks, split into the standard's terms (18 weeks and three terms: weeks 6, 12, 18).
function examRows(content, findings, standard) {
  const fs = find(findings, 'A-03');
  if (!fs.length) return [];
  const terms = arr(obj(standard.constants).terms);
  const weeks = Number(obj(standard.constants).weeksPerTerm) || 18;
  const plan = arr(content.plan);
  const ops = [];
  const changes = [];
  fs.forEach((f) => {
    const key = text(f.path).split('.').pop();
    const at = terms.findIndex((t) => t.key === key);
    if (at < 0) return;
    const week = Math.round((weeks * (at + 1)) / terms.length);
    const name = text(terms[at].label).toUpperCase() + ' EXAMINATION';
    const before = plan.find((r) => weekKey(r) > week);
    ops.push({
      op: 'insert', path: 'plan', beforeId: before && before.id !== undefined ? before.id : null,
      value: { id: 'ai-exam-' + key, kind: 'exam', week: String(week), ilos: [{ id: 'ai-exam-' + key + '-i', text: '', tags: [] }], contents: '**' + name + '**', activities: '- Examination', tasks: '', values: '' },
    });
    changes.push({ before: 'No ' + text(terms[at].label) + ' examination row', after: 'Add "' + name + '" at week ' + week });
  });
  return ops.length ? [suggestion({ kind: 'exam', label: 'Learning Plan', rules: ['A-03'], covers: cover(fs), why: 'Every term needs its examination row in the plan.', changes, ops })] : [];
}

function emptyIlos(content, findings) {
  const out = [];
  find(findings, 'T-17').forEach((f) => {
    const m = /^plan\[(\d+)\]\.ilos$/.exec(f.path);
    const row = m && arr(content.plan)[Number(m[1])];
    if (!row) return;
    const ilos = arr(row.ilos);
    const lastFilled = ilos.reduce((acc, il, i) => (blank(obj(il).text) ? acc : i), -1);
    const drop = ilos.map((il, i) => ({ il, i })).filter(({ il, i }) => blank(obj(il).text) && i < lastFilled);
    if (!drop.length || drop.some(({ il }) => obj(il).id === undefined)) return;
    const base = stablePath(content, f.path);
    out.push(suggestion({
      kind: 'ilo', label: weekLabel(row), rules: ['T-17'], covers: cover([f]),
      why: 'An empty ILO before a filled one leaves a gap in the printed numbering.',
      changes: [{ before: ilos.map((il, i) => 'ILO' + (i + 1) + ': ' + (text(obj(il).text).trim() || '(empty)')).join('\n'), after: ilos.filter((_, i) => !drop.some((d) => d.i === i)).map((il, i) => 'ILO' + (i + 1) + ': ' + text(obj(il).text).trim()).join('\n') }],
      ops: drop.map(({ il }) => ({ op: 'remove', path: base + '[id=' + il.id + ']' })),
    }));
  });
  return out;
}

// A requirement or a reference that repeats an earlier one (D-04, D-05): the repeat is removed and the first stays.
function repeatedItems(content, findings) {
  const out = [];
  [['D-04', 'Requirement', 'requirement'], ['D-05', 'Reference', 'reference']].forEach(([id, label, noun]) => {
    find(findings, id).forEach((f) => {
      const path = stablePath(content, f.path);
      const node = String(f.path).split('.').reduce((v, k) => { const m = /^(\w+)(?:\[(\d+)\])?$/.exec(k); return v == null || !m ? undefined : (m[2] === undefined ? v[m[1]] : arr(v[m[1]])[Number(m[2])]); }, content);
      if (!path || !/\[id=/.test(path.split('.').pop()) || node === undefined) return;
      out.push(suggestion({
        kind: 'text', label, rules: [id], covers: cover([f]), why: 'The same ' + noun + ' is listed twice, so the repeat is removed.',
        changes: [{ before: text(obj(node).t).trim(), after: '(removed)' }], ops: [{ op: 'remove', path }], expect: [{ path: path + '.t', value: text(obj(node).t) }],
      }));
    });
  });
  return out;
}

// Two grading components with the same name become one, with their percentages added, so the total stays what it was (D-06).
function repeatedGrading(content, findings) {
  const fs = find(findings, 'D-06');
  const rows = arr(obj(content.grading).rows);
  if (!fs.length || rows.some((r) => obj(r).id === undefined)) return [];
  const key = (r) => text(obj(r).label).trim().toLowerCase().replace(/\s+/g, ' ');
  const groups = new Map();
  rows.forEach((r) => { if (key(r)) groups.set(key(r), [...(groups.get(key(r)) || []), r]); });
  const ops = [];
  const changes = [];
  const expect = [];
  groups.forEach((list) => {
    if (list.length < 2 || list.some((r) => !Number.isFinite(Number(obj(r).pct)))) return;
    const [first, ...rest] = list;
    const total = list.reduce((sum, r) => sum + Number(r.pct), 0);
    const ref = (r) => 'grading.rows[id=' + r.id + ']';
    ops.push({ op: 'set', path: ref(first) + '.pct', value: total }, ...rest.map((r) => ({ op: 'remove', path: ref(r) })));
    expect.push({ path: ref(first) + '.pct', value: first.pct });
    changes.push({ before: list.map((r) => text(r.label).trim() + ' ' + r.pct + '%').join(' + '), after: text(first.label).trim() + ' ' + total + '%' });
  });
  return ops.length ? [suggestion({ kind: 'grading', label: 'Grading system', rules: ['D-06'], covers: cover(fs), why: 'The same component is listed more than once, so the rows are merged and their percentages added.', changes, ops, expect })] : [];
}

// I-01 (nothing says the course is open to diverse learners) has no suggestion: what a syllabus promises students about accommodations is the
// author's own to write, so the checker only warns about it.

function planOrder(content, findings) {
  const fs = find(findings, 'T-18');
  if (!fs.length) return [];
  const plan = arr(content.plan);
  const sorted = plan.map((r, i) => ({ r, i })).sort((a, b) => weekKey(a.r) - weekKey(b.r) || a.i - b.i).map((x) => x.r);
  if (sorted.every((r, i) => r === plan[i])) return [];
  const show = (rows) => rows.map((r) => text(obj(r).week).trim() || '?').join(', ');
  return [suggestion({ kind: 'order', label: 'Learning Plan', rules: ['T-18'], covers: cover(fs), why: 'The rows are put in week order.', changes: [{ before: 'Weeks run: ' + show(plan), after: 'Weeks run: ' + show(sorted) }], ops: [{ op: 'sortPlan' }] })];
}

// The vision, mission and graduate attributes printed in a syllabus are the LCUP's own wording, which the standard holds (T-28, T-29, T-30).
function institutionText(content, findings, standard) {
  const K = obj(obj(standard.constants).institution);
  const own = obj(content.outcomes);
  const out = [];
  const vision = find(findings, 'T-28');
  if (vision.length && K.vision) {
    out.push(suggestion({
      kind: 'institution', label: 'Vision', rules: ['T-28'], covers: cover(vision), why: 'The syllabus must carry the LCUP vision word for word.',
      changes: [{ before: text(own.vision).trim(), after: K.vision }], ops: [{ op: 'set', path: 'outcomes.vision', value: K.vision }], expect: [{ path: 'outcomes.vision', value: text(own.vision) }],
    }));
  }
  const mission = find(findings, 'T-29');
  if (mission.length && K.mission) {
    const now = obj(own.mission);
    const show = (m) => [text(obj(m).lead).trim(), ...arr(obj(m).items).map((i) => '• ' + text(i).trim())].filter(Boolean).join('\n');
    out.push(suggestion({
      kind: 'institution', label: 'Mission', rules: ['T-29'], covers: cover(mission), why: 'The syllabus must carry the LCUP mission word for word.',
      changes: [{ before: show(now), after: show(K.mission) }], ops: [{ op: 'set', path: 'outcomes.mission', value: K.mission }], expect: [{ path: 'outcomes.mission', value: now }],
    }));
  }
  const egas = arr(own.egas);
  const fixes = find(findings, 'T-30').map((f) => {
    const no = Number(text(f.path).split('.').pop());
    const want = arr(K.egas).find((k) => Number(k.no) === no);
    const at = egas.findIndex((e) => Number(obj(e).no) === no);
    return want && at >= 0 ? { f, want, at } : null;
  }).filter(Boolean);
  if (fixes.length) {
    out.push(suggestion({
      kind: 'institution', label: 'Graduate attributes', rules: ['T-30'], covers: cover(fixes.map((x) => x.f)), why: 'The four graduate attributes must be worded as the LCUP words them.',
      changes: fixes.map((x) => ({ title: 'EGA ' + x.want.no, before: text(egas[x.at].name).trim(), after: x.want.name })),
      ops: fixes.map((x) => ({ op: 'set', path: 'outcomes.egas[' + x.at + '].name', value: x.want.name })),
      expect: fixes.map((x) => ({ path: 'outcomes.egas[' + x.at + '].name', value: text(egas[x.at].name) })),
    }));
  }
  return out;
}

function deterministic(content, findings, standard) {
  return [...gradingFix(content, findings), ...requirementNumbers(content, findings), ...examRows(content, findings, standard), ...emptyIlos(content, findings), ...repeatedItems(content, findings), ...repeatedGrading(content, findings),  ...planOrder(content, findings), ...institutionText(content, findings, standard)];
}

module.exports = { deterministic, suggestion, stablePath };
