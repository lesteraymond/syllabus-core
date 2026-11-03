const test = require('node:test');
const assert = require('node:assert/strict');
const { align, pairsOf, NEMOTRON_FREE } = require('./gemini');
const { refineSuggestion, requirementsFor, setValue, getValue, FIELD } = require('./refine');
const { sample } = require('./fixtures');

const env = { SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-only-router-key', OPENROUTER_MODEL: NEMOTRON_FREE };
const reply = (content) => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }) });

// A pretend judge, driven by markers in the text so the tests can say exactly what each rewrite does:
//   a CLO-PO relationship is a problem until its text carries [fit]; any relationship whose text carries [bad] is a problem.
const verdict = (pair) => {
  const text = pair.source + ' ' + pair.target;
  const problem = text.includes('[bad]') || (pair.type === 'CLO-PO' && !text.includes('[fit]'));
  return { id: pair.id, label: problem ? 'NOT_ALIGNED' : 'ALIGNED', explanation: problem ? 'Does not fit.' : 'Fits.', sourceQuote: pair.source.slice(0, 6), targetQuote: pair.target.slice(0, 6), sourceBloom: 'Apply', targetBloom: 'Apply', draft: problem ? 'A draft.' : '' };
};
// Records what was asked: judgements (pair ids) and rewrites (the requirements given).
const fakeAi = ({ rewriteWith = null, fail = null } = {}) => {
  const asked = [], rewrites = [];
  const transport = async (url, request) => {
    if (fail) return { ok: false, status: fail };
    const payload = JSON.parse(JSON.parse(request.body).messages[1].content).document_data;
    if (Array.isArray(payload)) { asked.push(...payload.map((p) => p.id)); return reply({ judgements: payload.map(verdict) }); }
    rewrites.push(payload);
    return reply({ text: typeof rewriteWith === 'function' ? rewriteWith(payload) : rewriteWith });
  };
  return { transport, asked, rewrites };
};

async function setup() {
  const { content, masters } = sample();
  const first = fakeAi();
  const report = { hybrid: { alignment: await align(content, masters, { env, transport: first.transport }) } };
  const path = 'clos[0].statement';
  const original = getValue(content, path);
  const suggestion = (replacement, extra = {}) => ({ id: 'SEM:x', path, source: 'ai', originalValue: original, replacement, ...extra });
  return { content, masters, report, path, original, suggestion };
}

test('a draft that improves relationships and breaks none is verified as it is, and only the relationships it touches are asked', async () => {
  const { content, masters, report, original, suggestion } = await setup();
  const ai = fakeAi();
  const out = await refineSuggestion({ content, masters, report, suggestion: suggestion(original + ' [fit]'), options: { env, transport: ai.transport } });
  assert.equal(out.status, 'verified');
  assert.equal(out.usedRewrite, false);
  assert.equal(out.text, original + ' [fit]');
  assert.ok(out.stats.improved > 0 && out.stats.worse === 0, JSON.stringify(out.stats));
  assert.equal(out.stats.points < 0, true, 'it would take points off the deductions');
  const total = pairsOf(content, masters, []).length;
  assert.ok(ai.asked.length > 0 && ai.asked.length < total / 2, `asked ${ai.asked.length} of ${total}`);
  assert.deepEqual(ai.rewrites, [], 'no rewrite was needed');
});

test('a draft that breaks another relationship is not offered; one rewrite that satisfies all of them is asked for and verified', async () => {
  const { content, masters, report, original, suggestion } = await setup();
  const ai = fakeAi({ rewriteWith: original + ' [fit]' });
  const out = await refineSuggestion({ content, masters, report, suggestion: suggestion(original + ' [fit] [bad]'), options: { env, transport: ai.transport } });
  assert.equal(out.status, 'verified');
  assert.equal(out.usedRewrite, true);
  assert.equal(out.text, original + ' [fit]');
  assert.equal(ai.rewrites.length, 1);
  const given = ai.rewrites[0];
  assert.equal(given.field, 'course learning outcome');
  assert.equal(given.current, original);
  assert.ok(given.relationships.length > 1, 'the model is shown every relationship the CLO takes part in');
  assert.ok(given.relationships.some((r) => r.thisFieldIsThe === 'source') && given.relationships.some((r) => r.thisFieldIsThe === 'target'), 'both as a source and as a target');
  assert.ok(given.relationships.every((r) => r.otherSide.length <= 700));
});

test('when no rewrite satisfies everything the answer is "blocked", with the relationships in the way, and nothing is changed', async () => {
  const { content, masters, report, original, suggestion } = await setup();
  const ai = fakeAi({ rewriteWith: original + ' [fit] [bad]' });
  const out = await refineSuggestion({ content, masters, report, suggestion: suggestion(original + ' [fit] [bad]'), options: { env, transport: ai.transport } });
  assert.equal(out.status, 'blocked');
  assert.ok(out.blockers.length > 0 && out.blockers.length <= 8);
  assert.ok(out.blockers.every((b) => b.from === 'ALIGNED' && b.to === 'NOT_ALIGNED' && b.why));
  assert.equal(getValue(content, 'clos[0].statement'), original, 'the draft in memory is untouched');
});

test('only a text field an AI rewrite can target, still holding the text the recommendation was written for, can be refined', async () => {
  const { content, masters, report, original, suggestion } = await setup();
  const ai = fakeAi();
  const options = { env, transport: ai.transport };
  const refused = (s, status) => assert.rejects(refineSuggestion({ content, masters, report, suggestion: s, options }), (e) => e.status === status);
  await refused(suggestion('x', { source: 'rule' }), 400);
  await refused(suggestion('x', { path: 'meta.title' }), 400);
  await refused(suggestion({ not: 'text' }), 400);
  await refused(suggestion('x', { originalValue: 'something the author has since changed' }), 409);
  const applied = setValue(content, 'clos[0].statement', 'Already applied.');
  await assert.rejects(refineSuggestion({ content: applied, masters, report, suggestion: suggestion('Already applied.', { originalValue: original }), options }), (e) => e.status === 409 && /already applied/.test(e.message));
  assert.equal(ai.asked.length, 0, 'nothing was sent to the AI for any of them');
});

test('a quota or provider failure is reported as a failure, not as a verdict on the rewrite', async () => {
  const { content, masters, original, suggestion } = await setup();
  const ai = fakeAi({ fail: 429 });
  await assert.rejects(refineSuggestion({ content, masters, report: { hybrid: { alignment: { judgements: [] } } }, suggestion: suggestion(original + ' [fit]'), options: { env, transport: ai.transport } }), (e) => e.status === 502 && /429/.test(e.message));
});

test('the requirements list every relationship that uses the field, worst first, capped', async () => {
  const { content, masters, report } = await setup();
  const list = requirementsFor({ content, masters, path: 'clos[0].statement', baseline: report.hybrid.alignment.judgements });
  assert.ok(list.length > 0 && list.length <= 12);
  assert.ok(list.every((r) => ['source', 'target'].includes(r.thisFieldIsThe) && r.relationship));
  const rank = { ALIGNED: 0, PARTIALLY_ALIGNED: 1, NOT_ALIGNED: 2 };
  assert.deepEqual(list.map((r) => rank[r.currentVerdict]), [...list.map((r) => rank[r.currentVerdict])].sort((a, b) => b - a), 'worst first');
});

test('the refinable fields are exactly the ones an AI rewrite can target', () => {
  for (const ok of ['clos[0].statement', 'plan[3].contents', 'plan[3].activities', 'plan[3].tasks', 'plan[3].values', 'plan[2].ilos[1].text']) assert.match(ok, FIELD, ok);
  for (const no of ['meta.title', 'outcomes.vision', 'plan[0].ilos', 'clos[0].pos', 'refs.books', '__proto__.x']) assert.doesNotMatch(no, FIELD, no);
});
