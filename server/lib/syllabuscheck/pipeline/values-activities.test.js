'use strict';
// CPE 101, 2026-11-17: re-checks stayed incomplete (no score, no plan, no suggestions) because one VALUE-ILO question could not be answered. Its checklist
// asks whether the value can be practised through the week's ILO AND activities, but the question carried only the ILO; with a teacher-centred ILO the
// answer quoted the activities, the quote was not in the question's texts, and it was rejected twice. The message also counted "unclear" answers as
// failures. Offline: the real old engine with AI off, the new checker on a scripted model.
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('./rules');
const P = require('./prompt');
const T = require('./testSyllabus');
const O = require('./official');
const { extract } = require('./extract');
const { questionsOf } = require('./judge');
const { sample } = require('../fixtures');
const engine = require('../engine');

test('the values question carries the week\'s activities as well as its ILO, and a quote from the activities is accepted', () => {
  const content = T.conforming();
  const q = questionsOf(extract(content)).find(x => x.relationship === 'VALUE-ILO' && x.from.key === 'values:r3');
  assert.ok(q.to.some(t => t.field === 'ilo'), 'the ILO');
  const activities = q.to.find(t => t.field === 'activities');
  assert.ok(activities && activities.text, 'the activities');
  assert.ok(q.parents.every(p => p.startsWith('ilo:')), 'the repair order still follows the ILO only');
  // a week with no activities is asked with its ILO only
  const bare = T.conforming(); bare.plan[2].activities = '';
  assert.ok(!questionsOf(extract(bare)).find(x => x.id === q.id).to.some(t => t.field === 'activities'));
  // an answer that quotes the activities passes the quote check
  const quote = activities.text.split(/\s+/).filter(Boolean).slice(0, 4).join(' ');
  const request = { questions: [q] };
  const raw = JSON.stringify({ answers: [{ q: q.id, items: [{ id: 'fits', answer: 'yes' }], quote, explanation: 'Practised in the activities.' }] });
  const out = P.validateAnswers(request, raw);
  assert.equal(out.rejected.length, 0, JSON.stringify(out.rejected));
  assert.ok(out.answers.has(q.id));
  assert.deepEqual(R.CHAIN.find(r => r.field === 'values').alignsTo, ['ilo', 'activities']);
});

async function officialWith(override) {
  const { content, masters } = sample();
  delete masters.synthetic;
  const noAi = await engine.run(content, masters, { env: { SYLLABUS_CHECK_AI_PROVIDER: 'off' }, linkChecker: async url => ({ url, status: 'ok' }) });
  const report = await O.officialize({ noAi, content, masters, provider: { ask: T.scriptedJudge({ override }), rewrite: T.scriptedRewriter(), model: 'scripted' }, store: new Map(), year: 2026 });
  return report;
}

test('an incomplete check names only the questions with no valid answer; an "unclear" answer is not one of them', async () => {
  let rejectedId = null, unclearId = null;
  const report = await officialWith(q => {
    if (q.relationship === 'VALUE-ILO' && !rejectedId) rejectedId = q.id;
    if (q.id === rejectedId) return { q: q.id, items: R.CHECKLISTS[q.relationship].items.map(i => ({ id: i.id, answer: 'yes' })), quote: 'a phrase that is in none of the texts', explanation: 'x' };
    if (q.relationship === 'TASK-ILO' && !unclearId) unclearId = q.id;
    if (q.id === unclearId) return { q: q.id, items: R.CHECKLISTS[q.relationship].items.map(i => ({ id: i.id, answer: 'unclear' })), quote: '', explanation: 'The task type is not described.' };
    return undefined;
  });
  const a = report.hybrid.alignment;
  assert.equal(a.status, 'not_evaluated');
  assert.match(a.reason, /^1 question of the new AI Checker had no valid answer: .+ \(VALUE-ILO\): the quote is not in the texts\. Run the check again\.$/);
  assert.doesNotMatch(a.reason, /TASK-ILO/, 'the unclear answer is not reported as a failure');
  assert.equal(report.score, null, 'still no score from an incomplete check');
  assert.equal(report.hybrid.suggestions.filter(s => s.source === 'ai').length, 0);
});

test('with every question answered (an "unclear" one included) the check completes and the plan drafts suggestions', async () => {
  let unclearId = null;
  const report = await officialWith(q => {
    if (q.relationship === 'TASK-ILO' && !unclearId) unclearId = q.id;
    if (q.id === unclearId) return { q: q.id, items: R.CHECKLISTS[q.relationship].items.map(i => ({ id: i.id, answer: 'unclear' })), quote: '', explanation: 'The task type is not described.' };
    return undefined;
  });
  assert.equal(report.hybrid.alignment.status, 'completed');
  assert.equal(report.hybrid.alignment.reason, null);
  assert.equal(typeof report.score, 'number');
  assert.ok(report.hybrid.suggestions.some(s => s.source === 'ai'), 'drafts are made');
});
