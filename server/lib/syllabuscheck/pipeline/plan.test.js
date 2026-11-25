'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('./testSyllabus');
const { check } = require('./check');
const { buildPlan, applyPlan } = require('./plan');

const YEAR = 2026;
// Several misalignments at once, across the chain: a CLO off the subject with the wrong classification, a weak ILO, one activity only, a week
// with no value, weak tasks.
function messy() {
  const c = T.conforming();
  c.clos[1].statement = 'OFFTOPIC Explain folk dance outcome 2';
  c.clos[1].level = 'Introductory';
  c.plan[2].ilos[0].text = 'WEAK Explain topic number 3 clearly';
  c.plan[3].activities = 'Lecture only';
  c.plan[4].values = '';
  c.plan[6].tasks = '- Quiz 7 WEAK';
  return c;
}
const plan = (content, opts = {}) => buildPlan(content, null, { ask: T.scriptedJudge(), rewrite: T.scriptedRewriter(), year: YEAR, ...opts });

test('CONVERGENCE: after the author accepts the plan, a re-check shows no misalignment and asks the AI nothing', async () => {
  const store = new Map(), c = messy();
  const before = await check(c, null, { ask: T.scriptedJudge(), store: new Map(), year: YEAR });
  assert.ok(before.summary.misalignments >= 10);
  const result = await plan(c, { store });
  assert.equal(result.clean, true);
  assert.deepEqual(result.unresolved, []);
  assert.deepEqual(result.regressions, []);
  assert.ok(result.changes.every(ch => ch.status === 'VERIFIED'));
  const recheck = await check(applyPlan(c, result), null, { ask: T.failIfCalled, store, year: YEAR });
  assert.equal(recheck.summary.misalignments, 0);
  assert.equal(recheck.summary.complete, true);
  assert.equal(recheck.judged.usage.requests, 0);
  assert.equal(c.clos[1].level, 'Introductory', 'the original syllabus is not changed');
});

test('top-down: a failing CLO is fixed first; ILOs that failed only because of it are re-judged, never rewritten', async () => {
  const c = T.conforming();
  c.clos[1].statement = 'OFFTOPIC Explain folk dance outcome 2';
  const log = [];
  const result = await plan(c, { rewrite: T.scriptedRewriter({ log }) });
  assert.deepEqual(log.map(j => j.field.kind), ['clo']);
  assert.deepEqual(result.changes.map(ch => ch.key), ['clo:c2']);
  assert.equal(result.clean, true);
});

test('the rewrite is told everything it must satisfy: its parents, the failed checklist items, and the children to keep fitting', async () => {
  const c = T.conforming();
  c.plan[2].ilos[0].text = 'WEAK Explain topic number 3 clearly';
  const log = [];
  await plan(c, { rewrite: T.scriptedRewriter({ log }) });
  const job = log[0];
  assert.equal(job.field.kind, 'ilo');
  assert.deepEqual(job.dependsOn.map(p => p.kind).sort(), ['clo', 'content']);
  assert.ok(job.mustSatisfy.some(m => m.relationship === 'ILO-CLO' && m.failedItems.length));
  assert.deepEqual(job.keepFittingChildren.map(ch => ch.kind).sort(), ['activities', 'tasks', 'values'], 'the tasks depend on the verb level of the ILO');
});

test('content first: a misfit between an ILO and its week rewrites the ILO, never the content', async () => {
  const c = T.conforming();
  const override = q => (q.relationship === 'ILO-CONTENT' && /topic number 3/.test(q.field.text) && !/fixed/.test(q.field.text)
    ? { q: q.id, items: { topic: 'no', within: 'yes' }, quote: 'Explain topic number', explanation: 'Not this week\'s topic.' } : undefined);
  const rewrite = T.scriptedRewriter({ replace: job => JSON.stringify({ text: job.field.text + ' (fixed)', explanation: 'fits the week' }) });
  const result = await plan(c, { ask: T.scriptedJudge({ override }), rewrite });
  assert.deepEqual(result.changes.map(ch => ch.key), ['ilo:i3']);
  assert.equal(result.clean, true);
});

test('mechanical fixes need no AI: the fixed CLO classification is applied and verified', async () => {
  const c = T.conforming();
  c.clos[3].level = 'Enabling';
  const log = [];
  const result = await plan(c, { rewrite: T.scriptedRewriter({ log }) });
  assert.equal(log.length, 0);
  assert.deepEqual(result.changes.map(ch => [ch.key, ch.after, ch.source, ch.status]), [['clolevel:c4', 'Integration of Values', 'mechanical', 'VERIFIED']]);
  assert.equal(applyPlan(c, result).clos[3].level, 'Integration of Values');
});

test('a field that does not settle after two rewrites goes to faculty review, and the plan is not clean', async () => {
  const c = T.conforming();
  c.plan[2].ilos[0].text = 'WEAK Explain topic number 3 clearly';
  let n = 0;
  const rewrite = T.scriptedRewriter({ replace: job => JSON.stringify({ text: `WEAK attempt ${++n}: ${job.field.text}`.slice(0, 280), explanation: 'still weak' }) });
  const result = await plan(c, { rewrite });
  assert.equal(n, 2);
  assert.equal(result.clean, false);
  assert.equal(result.changes[0].status, 'NEEDS_FACULTY_REVIEW');
});

test('a rewrite that breaks a rule is refused and listed with its reason; the field keeps its text', async () => {
  const c = T.conforming();
  c.plan[4].values = '';
  const rewrite = T.scriptedRewriter({ replace: () => JSON.stringify({ text: 'Be good', explanation: 'x' }) });
  const result = await plan(c, { rewrite });
  assert.deepEqual(result.changes, []);
  assert.deepEqual(result.unresolved, [{ key: 'values:r5', reason: 'names none of the six core values' }]);
});

test('what only the author can fix is listed as manual: tags, schedule, references', async () => {
  const c = T.conforming();
  c.plan[3].ilos[0].tags = [];
  const result = await plan(c);
  assert.deepEqual(result.manual.map(m => m.rule), ['ILO-CLO-TAG']);
  assert.equal(result.clean, false);
});

test('applyPlan applies all changes or only the accepted ones', async () => {
  const c = messy();
  const result = await plan(c);
  const some = applyPlan(c, result, ['values:r5']);
  assert.equal(some.plan[4].values, 'Humility');
  assert.equal(some.plan[3].activities, 'Lecture only');
});

// As in the paid run of 2026-11-15: rewriting an ILO made an ADVICE relationship (TASK-ILO) slip. That must not hold any change back.
const REWRITTEN_ILO = 'Explain topic number 3 clearly';
const againstNewIlo = q => q.against.some(t => t.text === REWRITTEN_ILO);
const no = (q, item) => ({ q: q.id, items: require('./rules').CHECKLISTS[q.relationship].items.map(i => ({ id: i.id, answer: i.id === item ? 'no' : 'yes' })), quote: q.field.text.split(' ').slice(0, 2).join(' '), explanation: 'Slipped after the ILO changed.' });

test('an advice relationship that slips after a rewrite is reported apart and holds no change back', async () => {
  const c = T.conforming();
  c.plan[2].ilos[0].text = 'WEAK Explain topic number 3 clearly';
  c.plan[4].values = '';
  const override = q => (q.relationship === 'TASK-ILO' && q.id === 'TASK-ILO|tasks:r3' && againstNewIlo(q) ? no(q, 'measures') : undefined);
  const result = await plan(c, { ask: T.scriptedJudge({ override }) });
  assert.deepEqual(result.regressions, []);
  assert.deepEqual(result.adviceRegressions.map(r => r.id), ['TASK-ILO|tasks:r3']);
  assert.deepEqual(result.changes.map(ch => [ch.key, ch.status]), [['ilo:i3', 'VERIFIED'], ['values:r5', 'VERIFIED']]);
  assert.equal(result.clean, true);
});

test('a scored regression holds back only the changes it involves', async () => {
  const c = T.conforming();
  c.plan[2].ilos[0].text = 'WEAK Explain topic number 3 clearly';
  c.plan[4].values = '';
  // the week's activities stop fitting the rewritten ILO, and every attempt to rewrite the activities is refused
  const override = q => (q.id === 'ACTIVITY-FIT|activities:r3' && againstNewIlo(q) ? no(q, 'ilo') : undefined);
  const rewrite = T.scriptedRewriter({ replace: job => (job.field.kind === 'activities' ? JSON.stringify({ text: 'one line only', explanation: 'x' }) : undefined) });
  const result = await plan(c, { ask: T.scriptedJudge({ override }), rewrite });
  assert.deepEqual(result.regressions.map(r => r.id), ['ACTIVITY-FIT|activities:r3']);
  assert.ok(result.regressions[0].involves.includes('ilo:i3'));
  const status = Object.fromEntries(result.changes.map(ch => [ch.key, ch.status]));
  assert.equal(status['ilo:i3'], 'NEEDS_FACULTY_REVIEW');
  assert.equal(status['values:r5'], 'VERIFIED', 'an unrelated change is not held back');
  assert.equal(result.clean, false);
});

test('an answer that could not be had after the plan is unknown, not a regression, and holds no other change back (DSP test, 2026-11-15)', async () => {
  const c = T.conforming();
  c.plan[2].ilos[0].text = 'WEAK Explain topic number 3 clearly';
  c.plan[4].values = '';
  const unclear = q => (q.id === 'ACTIVITY-FIT|activities:r3' && againstNewIlo(q) ? { q: q.id, items: require('./rules').CHECKLISTS[q.relationship].items.map(i => ({ id: i.id, answer: 'unclear' })), quote: '', explanation: 'Cannot tell.' } : undefined);
  const result = await plan(c, { ask: T.scriptedJudge({ override: unclear }) });
  assert.deepEqual(result.regressions, []);
  assert.deepEqual(result.notRechecked.map(r => r.id), ['ACTIVITY-FIT|activities:r3']);
  const status = Object.fromEntries(result.changes.map(ch => [ch.key, ch.status]));
  assert.equal(status['ilo:i3'], 'VERIFIED');
  assert.equal(status['values:r5'], 'VERIFIED');
});

test('rewrites of ILOs in the same week see each other, and a near copy of a sibling is refused (DSP test, 2026-11-15)', async () => {
  const c = T.conforming();
  c.plan[2].ilos[0].text = 'WEAK Explain topic number 3 clearly';
  c.plan[2].ilos.push({ id: 'i3b', text: 'WEAK Describe the uses of topic number 3', tags: ['clo:c3'] });
  const log = [];
  const same = T.scriptedRewriter({ log, replace: job => (job.field.kind === 'ilo' ? JSON.stringify({ text: 'Explain topic number 3 with a worked example of each step', explanation: 'fits' }) : undefined) });
  const result = await plan(c, { rewrite: same });
  const second = log.find(j => j.field.label === 'Week 3 ILO 2');
  assert.ok(second.keepDistinctFrom.some(s => s.text === 'Explain topic number 3 with a worked example of each step'), 'the second rewrite sees what the first one wrote');
  assert.deepEqual(result.changes.filter(ch => ch.field === 'ilo').map(ch => ch.key), ['ilo:i3']);
  assert.deepEqual(result.unresolved.find(u => u.key === 'ilo:i3b'), { key: 'ilo:i3b', reason: 'repeats Week 3 ILO 1' });
});

test('a rewrite is told the links that fit now and must keep them (DSP re-run, 2026-11-15: CLO rewrites dropped PO links)', async () => {
  const c = T.conforming();
  // CLO 2: only its level fails; its POs and EGAs fit
  const levelOnly = q => (q.id === 'CLO-LEVEL|clo:c2' ? no(q, 'verb') : undefined);
  const log = [];
  await plan(c, { ask: T.scriptedJudge({ override: levelOnly }), rewrite: T.scriptedRewriter({ log, replace: job => (job.field.kind === 'clo' ? JSON.stringify({ text: 'Analyze and apply Java programming outcome 2', explanation: 'level' }) : undefined) }) });
  const job = log.find(j => j.field.kind === 'clo');
  const kept = job.mustKeep.map(k => k.relationship + ':' + k.against.map(a => a.label).join(','));
  assert.ok(kept.includes('CLO-PO:PO 1') && kept.includes('CLO-PO:PO 2') && kept.some(k => k.startsWith('CLO-EGA:')), kept.join(' '));
  assert.ok(!job.mustKeep.some(k => k.relationship === 'CLO-LEVEL'), 'what failed is not in mustKeep');
  const P = require('./prompt');
  assert.match(P.REWRITE_SYSTEM, /mustKeep fits NOW/);
  assert.equal(P.REWRITE_VERSION, 'replan-rewrite-5');
});

test('without a rewrite provider the plan only reports', async () => {
  const result = await buildPlan(messy(), null, { ask: T.scriptedJudge(), year: YEAR });
  assert.equal(result.usage.rewriteRequests, 0);
  assert.equal(result.clean, false);
  assert.ok(result.unresolved.length > 0);
});
