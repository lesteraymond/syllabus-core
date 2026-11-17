'use strict';
// CPE 101 check #458 (2026-11-17): score 85 with six findings but NO suggestion, and three findings that said the AI was unavailable. Three causes:
//   1. a deadlock: CLO-EVIDENCE (a manual relationship, fixed in its weeks) made its CLO "failing", so the ILO tagged to that CLO waited on it, the week's
//      activities and tasks waited on the ILO, and CLO-EVIDENCE waited on the activities and tasks: the plan rewrote nothing;
//   2. a reference the AI flagged was listed as "waits for a field above it", although the AI never rewrites a reference;
//   3. in official mode the OLD engine's original-requirements advice ran with its AI off and recorded each question as "not checked".
// Offline: scripted model.
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('./rules');
const T = require('./testSyllabus');
const O = require('./official');
const { check } = require('./check');
const { buildPlan } = require('./plan');
const { sample } = require('../fixtures');
const engine = require('../engine');

const answer = (q, no) => ({ q: q.id, items: R.CHECKLISTS[q.relationship].items.map(i => ({ id: i.id, answer: no.includes(i.id) ? 'no' : 'yes' })), quote: String(q.field.text).split(/\s+/).slice(0, 4).join(' '), explanation: 'scripted' });
// Week 3's ILO is off its content (ILO-CONTENT topic: no) and CLO 3, which it is tagged to, has no evidence in its weeks (CLO-EVIDENCE tasks: no).
const judge = () => T.scriptedJudge({ override: q => {
  if (q.id === 'ILO-CONTENT|ilo:i3') return answer(q, ['topic']);
  if (q.id === 'CLO-EVIDENCE|clo:c3') return answer(q, ['tasks']);
  return undefined;
} });

test('a CLO-EVIDENCE finding does not make the ILOs of its CLO wait: the off-content ILO is a root and the plan rewrites it', async () => {
  const result = await check(T.conforming(), undefined, { ask: judge(), store: new Map(), model: 'scripted', year: 2026 });
  const status = id => result.judged.results.find(r => r.id === id).status;
  assert.equal(status('ILO-CONTENT|ilo:i3'), 'failing');
  assert.notEqual(status('ILO-CLO|ilo:i3|clo:c3'), 'waiting', 'the CLO is not failing for the ILO: CLO-EVIDENCE is fixed in the weeks, not in the CLO');
  const log = [];
  const plan = await buildPlan(T.conforming(), undefined, { ask: judge(), rewrite: T.scriptedRewriter({ log }), store: new Map(), model: 'scripted', year: 2026 });
  assert.ok(log.some(job => job.field.kind === 'ilo' && job.field.label === 'Week 3 ILO 1'), 'Week 3 ILO 1 is rewritten (before: nothing was)');
  assert.ok(!log.some(job => job.field.kind === 'clo'), 'and the CLO still is not');
  const ilo = plan.unresolved.find(u => u.key === 'ilo:i3');
  assert.ok(!ilo || !/waits/.test(ilo.reason), 'the ILO was attempted, not left waiting: ' + (ilo && ilo.reason));
});

test('a reference the AI flags is the author\'s to replace, never "waiting for a field above it"', async () => {
  const content = T.conforming();
  content.refs.books.items[0].t = 'OFFTOPIC ' + content.refs.books.items[0].t;
  const plan = await buildPlan(content, undefined, { ask: T.scriptedJudge(), rewrite: T.scriptedRewriter(), store: new Map(), model: 'scripted', year: 2026 });
  const ref = plan.unresolved.find(u => u.key === 'ref:books:b1');
  assert.ok(ref, JSON.stringify(plan.unresolved));
  assert.match(ref.reason, /^for the faculty: the AI never rewrites a reference; replace or remove this source$/);
});

test('the engine beside the new checker has no AI: no "AI provider unavailable" findings, whatever the old advice switch says', async () => {
  // the old engine's original-requirements advice ran with its AI off and left "not checked" findings (#458); the advice was removed with the old AI Checker
  const { content, masters } = sample();
  const links = { linkChecker: async url => ({ url, status: 'ok' }) };
  const notChecked = r => r.findings.filter(f => /original-requirement relationship was not checked/.test(f.message || '')).length;
  const run = await engine.run(content, masters, { env: { SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', SYLLABUS_CHECK_REQUIREMENTS_ADVICE: 'on' }, ...links });
  assert.equal(notChecked(run), 0);
  assert.deepEqual(run.hybrid.alignment.judgements, [], 'no AI judgement: those are the new checker\'s');
  assert.equal(typeof O.noAiEnv, 'undefined', 'nothing left to switch off');
});
