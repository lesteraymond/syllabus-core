'use strict';
// Repeated or missing item ids (CLOs, ILOs, week rows, references). Every question of the new AI Checker is named after the id of the field it judges, so two
// fields with one id made two questions with one name: in one request the reply was refused ("answered more than once") and the check stayed incomplete on
// every run; in two requests the later answer was given to both fields (one ILO got the other's verdict, and a draft could land on the wrong field).
// The checker now works on a copy in which every id is unique (extract.uniqueIds); the saved syllabus is never changed. Offline.
const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('../fixtures');
const engine = require('../engine');
const T = require('./testSyllabus');
const O = require('./official');
const F = require('./refine');
const { check } = require('./check');
const { uniqueIds } = require('./extract');
const { relatedContextHash } = require('../refine');

const run = content => check(content, null, { year: 2026, ask: T.scriptedJudge() });
const lessonWeeks = c => c.plan.filter(p => p.kind !== 'exam' && (p.ilos || []).length);
const unanswered = r => r.judged.results.filter(x => x.reason).map(x => `${x.id}: ${x.reason}`);

test('uniqueIds: unique ids are kept as they are (the same object back); repeated and missing ones are renamed in a copy, the same way every time', () => {
  const c = T.conforming();
  assert.equal(uniqueIds(c), c);
  const w = lessonWeeks(c);
  w[3].ilos[0].id = w[2].ilos[0].id;
  c.clos[1].id = c.clos[0].id;
  delete w[4].id;
  const saved = structuredClone(c);
  const a = uniqueIds(c), b = uniqueIds(c);
  assert.deepEqual(c, saved, 'the input is not changed');
  assert.deepEqual(a, b, 'deterministic');
  assert.equal(uniqueIds(a), a, 'idempotent');
  const aw = lessonWeeks(a);
  assert.equal(aw[2].ilos[0].id, w[2].ilos[0].id, 'the first holder of an id keeps it');
  assert.notEqual(aw[3].ilos[0].id, aw[2].ilos[0].id);
  assert.equal(a.clos[0].id, c.clos[0].id);
  assert.notEqual(a.clos[1].id, a.clos[0].id);
  assert.ok(aw[4].id && !c.plan.some(p => p.id === aw[4].id), 'a missing id gets a new one that no other row has');
  // ILO tags still point at the CLO that kept the id (the editor shows the first CLO with an id too)
  assert.deepEqual(aw[3].ilos[0].tags, w[3].ilos[0].tags);
  // nothing but ids changes
  const ids = x => JSON.parse(JSON.stringify(x, (k, v) => (k === 'id' ? undefined : v)));
  assert.deepEqual(ids(a), ids(c));
});

test('uniqueIds: a numeric id is the same id as text, so the ILO tags that name it still find it', async () => {
  const c = T.conforming();
  const old = c.clos[0].id;
  c.clos[0].id = 7;
  for (const row of c.plan) for (const ilo of row.ilos || []) ilo.tags = (ilo.tags || []).map(t => (t === 'clo:' + old ? 'clo:7' : t));
  assert.equal(uniqueIds(c).clos[0].id, '7');
  const r = await run(c);
  assert.equal(r.summary.complete, true);
  assert.ok(r.judged.results.some(x => x.relationship === 'ILO-CLO' && x.id.endsWith('|clo:7')), 'the ILOs tagged clo:7 are still asked about CLO 1');
});

test('two ILOs of one week with one id: the check completes and each ILO is judged on its own', async () => {
  const c = T.conforming();
  const w = lessonWeeks(c)[3];
  w.ilos.push({ ...w.ilos[0], text: 'OFFTOPIC ' + w.ilos[0].text });
  const r = await run(c);
  assert.deepEqual(unanswered(r), []);
  assert.equal(r.summary.complete, true);
  const verdicts = r.judged.results.filter(x => x.relationship === 'ILO-CONTENT' && x.label.startsWith(`Week ${w.week}`)).map(x => [x.text.startsWith('OFFTOPIC'), x.verdict]);
  assert.deepEqual(verdicts, [[false, 'ALIGNED'], [true, 'NOT_ALIGNED']]);
});

test('ILOs of two weeks with one id: each keeps its own verdict (before, the good one got the other one\'s)', async () => {
  const c = T.conforming();
  const w = lessonWeeks(c);
  w[3].ilos[0].id = w[2].ilos[0].id;
  w[3].ilos[0].text = 'OFFTOPIC ' + w[3].ilos[0].text;
  const r = await run(c);
  assert.equal(r.summary.complete, true);
  const of = week => r.judged.results.find(x => x.relationship === 'ILO-CONTENT' && x.label.startsWith(`Week ${week.week} `)).verdict;
  assert.equal(of(w[2]), 'ALIGNED');
  assert.equal(of(w[3]), 'NOT_ALIGNED');
});

test('two CLOs, two week rows, or ILOs and references without an id: the check completes', async () => {
  const cases = {
    'two CLOs with one id': c => { c.clos[1].id = c.clos[0].id; },
    'two week rows with one id': c => { const w = lessonWeeks(c); w[3].id = w[2].id; },
    'ILOs without an id, in one week and in two': c => { const w = lessonWeeks(c); w[3].ilos.push({ ...w[3].ilos[0], text: 'Compare ' + w[3].ilos[0].text }); for (const x of [w[2], w[3]]) for (const ilo of x.ilos) delete ilo.id; },
    'references without an id': c => { for (const block of Object.values(c.refs || {})) for (const item of (block && block.items) || []) delete item.id; },
    'a CLO without an id': c => { delete c.clos[2].id; },
  };
  for (const [name, edit] of Object.entries(cases)) {
    const c = T.conforming();
    edit(c);
    const r = await run(c);
    assert.deepEqual(unanswered(r), [], name);
    assert.equal(r.summary.complete, true, name);
  }
});

// The official report on the real sample (the old engine with AI off, then the new checker on the scripted model).
const links = { linkChecker: async url => ({ url, status: 'ok' }) };
async function official(edit) {
  const { content, masters } = sample();
  delete masters.synthetic;
  edit(content);
  const saved = structuredClone(content);
  const noAi = await engine.run(content, masters, { env: { SYLLABUS_CHECK_AI_PROVIDER: 'off' }, ...links });
  const provider = { ask: T.scriptedJudge(), rewrite: T.scriptedRewriter(), model: 'scripted' };
  const store = new Map();
  const report = await O.officialize({ noAi, content, masters, provider, store, year: 2026 });
  assert.deepEqual(content, saved, 'the saved syllabus is not changed');
  return { report, content, masters, provider, store };
}

test('official report with a repeated ILO id: complete, and the deduction and the draft point at the weak ILO, not at its twin', async () => {
  const ctx = await official(c => {
    c.plan[3].ilos[0].id = c.plan[2].ilos[0].id;
    c.plan[3].ilos[0].text = 'WEAK ' + c.plan[3].ilos[0].text; // the second holder of the id is the weak one
  });
  const h = ctx.report.hybrid;
  assert.equal(h.alignment.status, 'completed');
  const paths = h.deductions.filter(d => d.kind === 'alignment').map(d => d.path);
  assert.ok(paths.length && paths.every(p => p.startsWith('plan[3].')), paths.join(' '));
  const draft = h.suggestions.find(s => s.path === 'plan[3].ilos[0].text');
  assert.ok(draft, 'a draft for the weak ILO');
  assert.equal(draft.originalValue, ctx.content.plan[3].ilos[0].text);
  assert.ok(!h.suggestions.some(s => s.path === 'plan[2].ilos[0].text'), 'no draft for the ILO that was fine');

  // Check & improve of that draft works on the right field
  const out = await F.refineDraft({ content: ctx.content, masters: ctx.masters, suggestion: draft, provider: ctx.provider, store: ctx.store, year: 2026 });
  assert.equal(out.status, 'verified');
  // and the context a decision is checked against is the weak ILO's own (its week), not its twin's
  assert.notEqual(relatedContextHash(ctx.content, ctx.masters, 'plan[3].ilos[0].text'), relatedContextHash(ctx.content, ctx.masters, 'plan[2].ilos[0].text'));
  assert.notEqual(relatedContextHash(ctx.content, ctx.masters, 'plan[3].ilos[0].text'), '');
});
