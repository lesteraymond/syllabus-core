const test = require('node:test');
const assert = require('node:assert/strict');
// A refusal for credits or access starts a cooldown in the checker (gemini.js); each test here starts with a provider that is not blocked.
test.afterEach(() => require('./gemini').resetProviderBlock());
const { sample } = require('./fixtures');
const { run } = require('./engine');
const { align, pairsOf, NEMOTRON_FREE } = require('./gemini');

// A missing text, a provider failure, an unusable answer and "not enough evidence" must never turn into a confident academic verdict,
// and an AI answer must never override a deterministic institutional rule.
const aiEnv = { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only' };
const options = { useAi: true, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }), env: aiEnv };
const geminiReply = (batch, answer) => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(answer) }) }] } }] }) });
const batchOf = req => JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
const verdict = (p, label) => ({ id: p.id, label, explanation: 'Judged.', sourceQuote: p.source.slice(0, 12), targetQuote: p.target.slice(0, 12), sourceBloom: 'Apply', targetBloom: 'Apply', draft: label === 'ALIGNED' ? '' : 'A rewrite.' });
const noJudgement = r => !r.findings.some(f => f.ruleId === 'SEM') && r.hybrid.deductions.length === 0 && !r.hybrid.suggestions.some(s => s.source === 'ai');

test('an empty source or target is reported as insufficient text without asking the AI, and is never reused', async () => {
  const { content, masters } = sample();
  content.clos[0].statement = '   ';
  masters.pos = masters.pos.map(po => (po.no === 2 ? { ...po, text: '' } : po));
  const emptyIds = pairsOf(content, masters).filter(p => !p.source.trim() || !p.target.trim()).map(p => p.id);
  assert.ok(emptyIds.length >= 2, 'the sample has relationships with an empty side: ' + emptyIds.join(','));
  const asked = [];
  const transport = async (url, req) => { const batch = batchOf(req); asked.push(...batch.map(p => p.id)); return geminiReply(batch, p => verdict(p, 'ALIGNED')); };
  const result = await align(content, masters, { env: aiEnv, transport });
  for (const id of emptyIds) {
    assert.ok(!asked.includes(id), id + ' was not sent to the AI');
    const j = result.judgements.find(x => x.id === id);
    assert.equal(j.label, 'INSUFFICIENT_EVIDENCE', id);
    assert.equal(j.failureKind, 'insufficient_text');
    assert.match(j.explanation, /is empty, so it cannot be judged/);
    assert.equal(j.draft, '', 'no rewrite is invented for text that is not there');
  }
  assert.equal(result.status, 'not_evaluated', 'the check is incomplete until the text exists');
  assert.equal(result.failure.kind, 'insufficient_text');
  assert.equal(result.reuse.reused, 0, 'a synthetic judgement is not counted as reuse');
  const reusable = new Map(result.judgements.filter(j => !j.unverified && j.label !== 'INSUFFICIENT_EVIDENCE').map(j => [j.key, j]));
  assert.ok(![...reusable.values()].some(j => emptyIds.includes(j.id)), 'and it cannot be reused later');
});

test('when the provider fails, no academic verdict, deduction or suggestion appears and the check is incomplete', async () => {
  const { content, masters } = sample();
  for (const [status, kind] of [[429, 'provider_quota'], [503, 'provider_error'], [402, 'provider_access']]) {
    const result = await run(content, masters, { ...options, transport: async () => ({ ok: false, status, json: async () => ({}) }) });
    assert.equal(result.hybrid.alignment.status, 'not_evaluated');
    assert.equal(result.hybrid.alignment.failure.kind, kind);
    assert.ok(noJudgement(result), 'HTTP ' + status + ' produced no academic result');
    assert.equal(result.score, null);
    assert.equal(result.hybrid.ready, false);
    assert.ok(result.findings.some(f => f.ruleId === 'AI-REQUIRED' && f.severity === 'blocking'), 'and it says why');
  }
  require('./gemini').resetProviderBlock(); // the 402 above started a cooldown
  const timed = await run(content, masters, { ...options, transport: async () => { throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }); } });
  assert.equal(timed.hybrid.alignment.failure.kind, 'provider_timeout');
  assert.ok(noJudgement(timed));
});

test('answers that are not usable are never turned into a verdict, a deduction or a rewrite', async () => {
  const { content, masters } = sample();
  for (const body of ['not json at all', '{"judgements": "none"}', '{"judgements": []}', JSON.stringify({ judgements: [{ id: 'x', label: 'ALIGNED' }] })]) {
    const result = await run(content, masters, { ...options, transport: async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: body }] } }] }) }) });
    assert.equal(result.hybrid.alignment.status, 'not_evaluated', body);
    assert.equal(result.hybrid.deductions.length, 0, body);
    assert.ok(!result.hybrid.suggestions.some(s => s.source === 'ai'), body);
    assert.ok(result.hybrid.alignment.judgements.every(j => j.unverified && j.label === 'INSUFFICIENT_EVIDENCE'), 'every relationship is "could not verify", not aligned: ' + body);
  }
});

test('INSUFFICIENT_EVIDENCE is neither approval nor misalignment: it costs no points, gives no rewrite, and keeps the check incomplete', async () => {
  const { content, masters } = sample();
  const transport = async (url, req) => geminiReply(batchOf(req), p => ({ id: p.id, label: 'INSUFFICIENT_EVIDENCE', explanation: 'The text is unreadable.', sourceQuote: '', targetQuote: '', sourceBloom: 'N/A', targetBloom: 'N/A', draft: '' }));
  const result = await run(content, masters, { ...options, transport });
  assert.equal(result.hybrid.deductions.length, 0);
  assert.ok(!result.hybrid.suggestions.some(s => s.source === 'ai'));
  assert.equal(result.hybrid.alignment.status, 'not_evaluated');
  assert.equal(result.hybrid.ready, false);
  assert.equal(result.hybrid.alignment.failure.kind, 'insufficient_text');
});

test('an AI that approves everything cannot override a deterministic rule: a bad grading total and a missing tag stay blocking', async () => {
  const { content, masters } = sample();
  content.grading.rows = [{ id: 'g1', label: 'Class Standing', pct: 50 }, { id: 'g2', label: 'Examination', pct: 40 }];
  content.clos[0].pos = [];
  const transport = async (url, req) => geminiReply(batchOf(req), p => verdict(p, 'ALIGNED'));
  const result = await run(content, masters, { ...options, transport });
  const blocking = result.findings.filter(f => f.severity === 'blocking').map(f => f.ruleId);
  assert.ok(blocking.includes('GRADE-100') || blocking.includes('T-24'), 'grading total: ' + blocking.join(','));
  assert.ok(blocking.includes('CLO-MAP'), 'tag: ' + blocking.join(','));
  assert.equal(result.hybrid.ready, false);
  assert.equal(result.score, null);
});

test('a tag that exists does not prove the meaning, and a meaning that fits does not excuse a missing tag', async () => {
  const { content, masters } = sample();
  const transport = async (url, req) => geminiReply(batchOf(req), p => verdict(p, p.type === 'CLO-PO' || p.type === 'CLO-anyPO' ? 'NOT_ALIGNED' : 'ALIGNED'));
  const wrongMeaning = await run(content, masters, { ...options, transport });
  assert.ok(!wrongMeaning.findings.some(f => ['CLO-MAP', 'ILO-MAP'].includes(f.ruleId)), 'every tag exists');
  assert.ok(wrongMeaning.hybrid.deductions.length > 0, 'yet the meaning is penalised');
  const missingTag = structuredClone(content);
  missingTag.clos[0].pos = [];
  const allGood = async (url, req) => geminiReply(batchOf(req), p => verdict(p, 'ALIGNED'));
  const noTag = await run(missingTag, masters, { ...options, transport: allGood });
  assert.ok(noTag.findings.some(f => f.ruleId === 'CLO-MAP' && f.severity === 'blocking'), 'a fitting meaning does not fill a missing tag');
});

test('the free-JSON route also refuses an answer that is not a complete, quoted judgement', async () => {
  const { content, masters } = sample();
  const env = { SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'k', OPENROUTER_MODEL: NEMOTRON_FREE };
  const transport = async () => ({ ok: true, json: async () => ({ model: NEMOTRON_FREE, choices: [{ finish_reason: 'length', message: { content: '{"judgements":[' } }] }) });
  const result = await align(content, masters, { env, transport });
  assert.equal(result.status, 'not_evaluated');
  assert.ok(result.judgements.every(j => j.unverified));
  assert.equal(result.failure.kind, 'invalid_output');
});
