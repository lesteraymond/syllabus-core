'use strict';
// "Check & improve" for the re-planned checker's drafts (pipeline/refine.js). Offline: the real old engine with AI off, the new checker on a scripted model.
const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('../fixtures');
const engine = require('../engine');
const T = require('./testSyllabus');
const O = require('./official');
const F = require('./refine');

const links = { linkChecker: async url => ({ url, status: 'ok' }) };
// An official check of the sample with Week 3's ILO weakened, and the provider + store it used (so the refine reuses its stored answers).
async function checked(edit = c => { c.plan[2].ilos[0].text = 'WEAK ' + c.plan[2].ilos[0].text; }) {
  const { content, masters } = sample();
  delete masters.synthetic;
  edit(content);
  const judgeLog = [], rewriteLog = [];
  const provider = { ask: T.scriptedJudge({ log: judgeLog }), rewrite: T.scriptedRewriter({ log: rewriteLog }), model: 'scripted' };
  const store = new Map();
  const noAi = await engine.run(content, masters, { env: { SYLLABUS_CHECK_AI_PROVIDER: 'off' }, ...links });
  const report = await O.officialize({ noAi, content, masters, provider, store, year: 2026 });
  const draft = report.hybrid.suggestions.find(s => s.id === 'RP:ilo:i3');
  return { content, masters, provider, store, report, draft, judgeLog, rewriteLog };
}
// an author's edit that still has the planted weakness, and differs from the original text
const WEAK_EDIT = 'WEAK Describe the main idea of topic number 3 in a short written exercise';
const refineWith = (ctx, suggestion, extra = {}) => F.refineDraft({ content: ctx.content, masters: ctx.masters, suggestion, provider: ctx.provider, store: ctx.store, year: 2026, ...extra });

test('a verified draft of the new checker passes its own Check & improve, from stored answers, with the shape the app reads', async () => {
  const ctx = await checked();
  assert.ok(ctx.draft && ctx.draft.verification === 'VERIFIED');
  const asked = ctx.judgeLog.length, rewritesBefore = ctx.rewriteLog.length;
  const out = await refineWith(ctx, ctx.draft);
  assert.equal(out.status, 'verified');
  assert.equal(out.usedRewrite, false);
  assert.equal(out.text, ctx.draft.replacement);
  assert.deepEqual(Object.keys(out.stats).sort(), ['checked', 'improved', 'points', 'same', 'unverified', 'worse']);
  assert.ok(out.stats.improved > 0 && out.stats.worse === 0 && out.stats.points < 0);
  assert.deepEqual(out.blockers, []);
  // the week's questions were already answered by the plan; only the CLO's evidence question, which quotes this week next to the others, is new
  const newQuestions = ctx.judgeLog.slice(asked).flatMap(l => T.questionsIn(l.message));
  assert.ok(newQuestions.every(q => q.relationship === 'CLO-EVIDENCE'), newQuestions.map(q => q.id).join(' '));
  assert.equal(ctx.rewriteLog.length, rewritesBefore, 'no new rewrite request');
});

test('an author edit that is still weak is rewritten once by the new rewriter and verified', async () => {
  const ctx = await checked();
  const rewritesBefore = ctx.rewriteLog.length;
  const edited = { ...ctx.draft, replacement: WEAK_EDIT, userEdited: true };
  const out = await refineWith(ctx, edited);
  assert.equal(out.status, 'verified');
  assert.equal(out.usedRewrite, true);
  assert.ok(!/WEAK/.test(out.text));
  assert.equal(ctx.rewriteLog.length, rewritesBefore + 1, 'exactly one rewrite request');
  const job = ctx.rewriteLog.at(-1);
  assert.equal(job.field.kind, 'ilo');
  assert.ok(/WEAK/.test(job.field.text), 'the rewrite starts from the author\'s edit');
  assert.ok(job.dependsOn.some(p => p.kind === 'content') && job.dependsOn.some(p => p.kind === 'clo'), 'it gets the same parents as the plan');
});

test('when no rewrite passes, it is blocked and says what stands in the way; nothing is applied', async () => {
  const ctx = await checked();
  ctx.provider.rewrite = async () => JSON.stringify({ text: '', explanation: 'none' }); // rejected by validateRewrite
  const original = ctx.content.plan[2].ilos[0].text;
  const out = await refineWith(ctx, { ...ctx.draft, replacement: WEAK_EDIT, userEdited: true });
  assert.equal(out.status, 'blocked');
  assert.equal(out.usedRewrite, false);
  assert.ok(out.blockers.length > 0);
  assert.ok(out.blockers.every(b => b.type && b.from && b.to), 'each blocker has the fields HybridCheckPanel shows');
  assert.ok(out.blockers.some(b => /^ILO-/.test(b.type)));
  assert.equal(ctx.content.plan[2].ilos[0].text, original, 'the syllabus is not changed');
});

test('a draft that would break a scored relationship that fits now is blocked as worse', async () => {
  const ctx = await checked();
  ctx.provider.rewrite = async () => { throw Error('no rewrite in this test'); };
  const out = await refineWith(ctx, { ...ctx.draft, replacement: 'OFFTOPIC ' + ctx.draft.replacement, userEdited: true });
  assert.equal(out.status, 'blocked');
  assert.ok(out.stats.worse > 0);
  assert.ok(out.blockers.some(b => b.to === 'NOT_ALIGNED'));
});

test('a trivial change is not checked and is reported as no meaningful change', async () => {
  const ctx = await checked();
  ctx.provider.rewrite = async () => JSON.stringify({ text: ctx.draft.originalValue, explanation: 'same' });
  const out = await refineWith(ctx, { ...ctx.draft, replacement: ctx.draft.originalValue.toUpperCase() + '.', userEdited: true });
  assert.equal(out.status, 'blocked');
  assert.equal(out.reason, 'no_meaningful_change');
});

test('it refuses what it cannot check: a non-AI or unknown field (400), a field changed since the check or already applied (409)', async () => {
  const ctx = await checked();
  await assert.rejects(refineWith(ctx, { ...ctx.draft, source: 'rule' }), e => e.status === 400);
  await assert.rejects(refineWith(ctx, { ...ctx.draft, path: 'meta.title' }), e => e.status === 400);
  await assert.rejects(refineWith(ctx, { ...ctx.draft, path: 'plan[99].ilos[0].text' }), e => e.status === 409);
  await assert.rejects(refineWith(ctx, { ...ctx.draft, originalValue: 'something else' }), e => e.status === 409 && /changed since/.test(e.message));
  ctx.content.plan[2].ilos[0].text = ctx.draft.replacement;
  await assert.rejects(refineWith(ctx, ctx.draft), e => e.status === 409 && /already applied/.test(e.message));
});

test('a provider that does not answer is an error (502), never a pass or a block', async () => {
  const ctx = await checked();
  ctx.store.clear(); // nothing stored: every question must be asked
  ctx.provider.ask = async () => { throw Error('The re-planned checker\'s cost cap is reached; the request was not sent.'); };
  await assert.rejects(refineWith(ctx, ctx.draft), e => e.status === 502);
});

test('without its own provider it needs the new checker to be ready, and keeps its spend under a small cap', async () => {
  const ctx = await checked();
  await assert.rejects(F.refineDraft({ content: ctx.content, masters: ctx.masters, suggestion: ctx.draft, env: {} }), e => e.status === 503);
  const ready = { SYLLABUS_CHECK_REPLAN: 'official', SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', SYLLABUS_CHECK_REPLAN_MAX_COST_USD: '2' };
  assert.deepEqual(F.refineLimits(ready), { ok: true, cap: 0.5, maxRequests: 12 });
  assert.equal(F.refineLimits({ ...ready, SYLLABUS_CHECK_REPLAN_MAX_COST_USD: '0.2' }).cap, 0.2, 'never above the check\'s own cap');
  assert.equal(F.refineLimits({ ...ready, SYLLABUS_CHECK_REFINE_MAX_COST_USD: '5' }).cap, 2);
  assert.equal(F.refineLimits({ ...ready, SYLLABUS_CHECK_REFINE_MAX_REQUESTS: '-3' }).maxRequests, 12);
  assert.equal(F.refineLimits({ ...ready, SYLLABUS_CHECK_REPLAN: 'shadow' }).ok, false);
});

test('isReplanned tells a new-checker report from an old one', async () => {
  const ctx = await checked();
  assert.equal(F.isReplanned(ctx.report), true);
  assert.equal(F.isReplanned({ hybrid: { alignment: { engine: undefined, promptVersion: 'alignment-x' } } }), false);
  assert.equal(F.isReplanned(null), false);
});
