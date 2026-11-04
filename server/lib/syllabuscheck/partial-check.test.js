const test = require('node:test');
const assert = require('node:assert/strict');
// A refusal for credits or access starts a cooldown in the checker (gemini.js); each test here starts with a provider that is not blocked.
test.afterEach(() => require('./gemini').resetProviderBlock());
const { sample } = require('./fixtures');
const { run } = require('./engine');
const { align, pairsOf } = require('./gemini');

// A check should give as much as it can: a score and recommendations for what it did reach, and an honest account of what it did not. One failed
// call must not throw away the rest of the check, and an unreached relationship must never turn into a verdict.
const base = { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only', SYLLABUS_CHECK_AI_BATCH: '4', SYLLABUS_CHECK_AI_CONCURRENCY: '1' };
const options = { useAi: true, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }), env: base };
const batchOf = req => JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
const verdict = (p, label) => ({ id: p.id, label, explanation: 'Judged.', sourceQuote: p.source.slice(0, 12), targetQuote: p.target.slice(0, 12), sourceBloom: 'Apply', targetBloom: 'Apply', draft: label === 'ALIGNED' ? '' : 'A real rewrite with new content.' });
const ok = (batch, label) => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(p => verdict(p, label(p))) }) }] } }] }) });
const timeout = () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });

// Which pairs end up in which batch (the sample, 4 per call).
const idsOf = () => { const { content, masters } = sample(); return pairsOf(content, masters).filter(p => p.source.trim() && p.target.trim()).map(p => p.id); };

test('a timeout on one batch does not stop the others: the rest is judged, and exactly what was missed is reported as not checked', async () => {
  const { content, masters } = sample();
  const all = idsOf();
  const dead = new Set(all.slice(8, 12)); // the third batch
  const calls = [];
  const transport = async (url, req) => {
    const batch = batchOf(req);
    calls.push(batch.map(p => p.id));
    if (batch.some(p => dead.has(p.id))) throw timeout();
    return ok(batch, p => (p.id === all[0] ? 'PARTIALLY_ALIGNED' : 'ALIGNED'));
  };
  const result = await align(content, masters, { env: base, transport });
  const byId = new Map(result.judgements.map(j => [j.id, j]));
  assert.equal(result.status, 'not_evaluated');
  assert.equal(result.failure.kind, 'provider_timeout');
  assert.ok(calls.some(ids => ids.includes(all[all.length - 1])), 'a batch AFTER the failed one was still asked');
  for (const id of dead) {
    const j = byId.get(id);
    assert.deepEqual([j.label, j.unverified, j.failureKind], ['INSUFFICIENT_EVIDENCE', true, 'provider_timeout'], id + ' is "not checked", not a verdict');
    assert.equal(j.draft, '');
  }
  assert.equal(byId.get(all[0]).label, 'PARTIALLY_ALIGNED', 'what was reached keeps its real verdict');
  assert.equal(result.coverage.total, all.length);
  assert.equal(result.coverage.verified, all.length - dead.size, 'the coverage says exactly how many were checked');
});

test('with the check unfinished, the score is still shown as a PROVISIONAL one next to recommendations, and nothing official changes', async () => {
  const { content, masters } = sample();
  const all = idsOf();
  const dead = new Set(all.slice(8, 12));
  const transport = async (url, req) => {
    const batch = batchOf(req);
    if (batch.some(p => dead.has(p.id))) throw timeout();
    return ok(batch, p => (p.id === 'row0-ilo0-activity' ? 'PARTIALLY_ALIGNED' : 'ALIGNED'));
  };
  const result = await run(content, masters, { ...options, transport });
  assert.equal(result.score, null, 'there is no OFFICIAL score for an unfinished check');
  assert.equal(result.hybrid.ready, false);
  assert.equal(result.hybrid.summary.status, 'incomplete', 'and it is never "no changes needed"');
  assert.ok(Number.isFinite(result.hybrid.provisionalScore), 'but there is a provisional score');
  assert.equal(result.hybrid.provisionalScore, result.baseScore - result.hybrid.deductions.reduce((n, d) => n + d.points, 0));
  assert.ok(result.hybrid.deductions.some(d => d.id === 'SEM:row0-ilo0-activity'), 'built only from real verdicts');
  assert.ok(result.hybrid.suggestions.some(s => s.path === 'plan[0].activities'), 'recommendations for what was reached');
  assert.equal(result.hybrid.alignment.coverage.verified, all.length - 4);
  assert.ok(!result.findings.some(f => f.ruleId === 'SEM' && dead.has(String(f.id).replace('SEM:', ''))), 'a relationship the provider failed on is not listed as a problem');
  assert.equal(result.passed, false, 'an unfinished check never passes');
});

test('a provider that keeps failing is not hammered: after three failed batches the check stops', async () => {
  const { content, masters } = sample();
  let calls = 0;
  const transport = async () => { calls += 1; return { ok: false, status: 503, json: async () => ({}) }; };
  const result = await align(content, masters, { env: base, transport });
  const batches = Math.ceil(idsOf().length / 4);
  assert.ok(batches > 6, 'the sample has many batches');
  assert.equal(calls, 3, 'one call per failed batch, and no more after the third');
  assert.equal(result.status, 'not_evaluated');
  assert.equal(result.coverage.verified, 0);
});

test('a quota or access error stops at once, because every later call would fail too', async () => {
  const { content, masters } = sample();
  for (const status of [429, 402, 401]) {
    require('./gemini').resetProviderBlock();
    let calls = 0;
    const transport = async () => { calls += 1; return { ok: false, status, json: async () => ({}) }; };
    const result = await align(content, masters, { env: base, transport });
    assert.equal(calls, 1, 'HTTP ' + status);
    assert.equal(result.status, 'not_evaluated');
  }
});

test('a finished check reports full coverage, and its score is the base score minus the deductions', async () => {
  const { content, masters } = sample();
  const transport = async (url, req) => ok(batchOf(req), p => (p.id === 'row0-ilo0-activity' ? 'PARTIALLY_ALIGNED' : 'ALIGNED'));
  const result = await run(content, masters, { ...options, transport });
  const c = result.hybrid.alignment.coverage;
  assert.equal(c.verified, c.total);
  assert.equal(result.hybrid.alignment.status, 'completed');
  assert.equal(result.hybrid.provisionalScore, result.baseScore - 1);
  assert.equal(result.hybrid.summary.status, 'material_open');
});
