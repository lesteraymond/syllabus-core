'use strict';
// Claude (the direct Anthropic API) is experimental: the application sends it nothing until the operator approves one model
// (SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL), SYLLABUS_CHECK_AI_PROVIDER=off turns every provider off, and an evaluation script runs Claude apart from the
// application, with results that never count as a verified check. Offline: every request goes to a counting fake transport, the global fetch is blocked
// for this whole file, and no key here is a real key.
const test = require('node:test');
const assert = require('node:assert/strict');
const realFetch = globalThis.fetch;
let blocked = 0;
globalThis.fetch = async () => { blocked += 1; throw new TypeError('fetch failed (network blocked in anthropic-lock.test.js)'); };
test.after(() => { globalThis.fetch = realFetch; });
const { align, providerConfig, verifiedAlignment, resetProviderBlock } = require('./gemini');
const { askJson } = require('./modelClient');
const { run } = require('./engine');
const { sample } = require('./fixtures');
const repo = require('./repository');
const svc = require('../compliance/service');
const { contentHash } = require('../compliance/hash');

const KEY = 'sk-ant-test-only-not-a-real-key';
const MODEL = 'claude-sonnet-5-5';
const selected = { SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: KEY, ANTHROPIC_MODEL: MODEL }; // a valid key, not approved
const approved = { ...selected, SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: MODEL };
const router = { SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-only-router-key', OPENROUTER_MODEL: 'minimax/minimax-m3.1-flash' };
const LOCKED = 'Claude (the direct Anthropic API) is experimental and not approved for official checking on this server (SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL), so no AI request was sent; the coded rules ran.';
const OFF = 'AI checking is turned off on this server (SYLLABUS_CHECK_AI_PROVIDER=off), so no AI request was sent; the coded rules ran.';
const NOT_CONFIGURED = { kind: 'not_configured', retryable: false };
const json = body => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req_offline' } });
const judgement = pair => ({ id: pair.id, label: 'NOT_ALIGNED', explanation: 'Recall of flowers does not demonstrate engineering problem solving.', sourceQuote: pair.source.slice(0, 10), targetQuote: pair.target.slice(0, 10), sourceBloom: 'Create', targetBloom: 'Remember', draft: 'Construct a mathematical solution and demonstrate it with worked test cases.' });
// A fake fetch for the SDK that answers every relationship it is asked about and counts the requests.
function answering() {
  const calls = [];
  const transport = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url: String(url), body });
    const text = JSON.stringify({ judgements: JSON.parse(body.messages[0].content).document_data.map(judgement) });
    return json({ id: 'msg_offline', type: 'message', role: 'assistant', model: MODEL, content: [{ type: 'text', text }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1000, output_tokens: 200 } });
  };
  return { calls, transport };
}
const linkChecker = async url => ({ url, status: 'ok', httpStatus: 200 });
// What a check decides officially: the score and its band, pass at 79, readiness, the deductions and the blocking findings, and every coded check.
const official = report => ({ score: report.score, baseScore: report.baseScore, passed: report.passed, status: report.status, overall: report.overall, band: report.band, ready: report.hybrid.ready,
  provisionalScore: report.hybrid.provisionalScore, deductions: report.hybrid.deductions, failed: report.conformance.failed.map(f => f.id), codedChecks: report.hybrid.codedChecks.map(c => [c.id, c.status]) });
// The sample syllabus against masters that are not marked synthetic, so a completed AI check would make it ready and give it a score.
const real = () => { const { content, masters } = sample(); delete masters.synthetic; return { content, masters }; };
// Set some process.env values for one test and put them back afterwards.
function withProcessEnv(t, values) {
  const saved = Object.fromEntries(Object.keys(values).map(name => [name, process.env[name]]));
  for (const [name, value] of Object.entries(values)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  t.after(() => { for (const [name, value] of Object.entries(saved)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } });
}
test.beforeEach(() => resetProviderBlock());

test('a valid key with Claude selected configures nothing: only the approved model, or an evaluation that asks for it, is configured', () => {
  assert.deepEqual(providerConfig(selected), { provider: 'anthropic', model: MODEL, configured: false, approved: false });
  assert.deepEqual(providerConfig(approved), { provider: 'anthropic', model: MODEL, configured: true, approved: true });
  // The approval names one exact model: another model, a longer or differently written id, or a yes/on/true approves nothing.
  for (const other of ['claude-sonnet-4-6', 'claude-sonnet-5', 'Claude-Sonnet-5-5', 'claude-sonnet-5-5-x', 'claude', 'yes', 'on', 'true', '1', '*', '']) {
    assert.equal(providerConfig({ ...selected, SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: other }).configured, false, other);
  }
  assert.equal(providerConfig({ ...selected, SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: ` ${MODEL} ` }).configured, true, 'stray spaces around the approved id');
  // The approval never completes an incomplete configuration, and it never selects Claude: a key alone still selects nothing.
  for (const bad of [{ ANTHROPIC_API_KEY: '' }, { ANTHROPIC_API_KEY: 'abcdefghijklmnopqrstuvwxyz01234' }, { ANTHROPIC_MODEL: '' }]) assert.equal(providerConfig({ ...approved, ...bad }).configured, false, JSON.stringify(bad));
  assert.deepEqual(providerConfig({ ANTHROPIC_API_KEY: KEY, ANTHROPIC_MODEL: MODEL, SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: MODEL }), { provider: '', model: 'gemini-3.8-flash', configured: false });
  // An evaluation needs no approval but still a valid key and model, and it is marked as such.
  assert.deepEqual(providerConfig(selected, { evaluation: true }), { provider: 'anthropic', model: MODEL, configured: true, approved: false, evaluationOnly: true });
  assert.equal(providerConfig({ ...selected, ANTHROPIC_API_KEY: '' }, { evaluation: true }).configured, false);
  // The other providers are configured exactly as before, with or without the evaluation option.
  assert.deepEqual(providerConfig(router), { provider: 'openrouter', model: router.OPENROUTER_MODEL, configured: true });
  assert.deepEqual(providerConfig(router, { evaluation: true }), providerConfig(router));
  assert.deepEqual(providerConfig({ GEMINI_API_KEY: 'test-only' }), { provider: 'gemini', model: 'gemini-3.8-flash', configured: true });
  assert.deepEqual(providerConfig({}), { provider: '', model: 'gemini-3.8-flash', configured: false });
});

test('Claude selected with a valid key but not approved sends nothing: the check, an AI rewrite and the official result are those of a server without AI', async () => {
  const { content, masters } = real();
  const { calls, transport } = answering();
  assert.deepEqual(await align(content, masters, { env: selected, transport }), { status: 'not_evaluated', reason: LOCKED, judgements: [], failure: NOT_CONFIGURED });
  await assert.rejects(askJson({ system: 's', payload: {}, schema: () => ({}) }, { env: selected, transport }), error => error.status === 503);
  const none = await run(structuredClone(content), masters, { linkChecker, useAi: true, env: {} });
  const locked = await run(structuredClone(content), masters, { linkChecker, useAi: true, env: selected, transport });
  assert.deepEqual(official(locked), official(none));
  assert.deepEqual([locked.score, locked.hybrid.ready, locked.passed], [null, false, false]);
  assert.equal(locked.hybrid.alignment.reason, LOCKED);
  assert.ok(locked.conformance.failed.some(f => f.ruleId === 'AI-REQUIRED'));
  assert.equal(calls.length, 0);
  // The same server with the model approved: the AI is asked, and only then does the check get a score.
  const allowed = await run(structuredClone(content), masters, { linkChecker, useAi: true, env: approved, transport });
  assert.equal(allowed.hybrid.alignment.status, 'completed');
  assert.ok(calls.length > 0);
  assert.equal(typeof allowed.score, 'number');
  assert.equal(blocked, 0);
});

test('SYLLABUS_CHECK_AI_PROVIDER=off turns the AI off whatever keys and approval are set; the coded rules still run exactly as without a provider', async () => {
  const keys = { OPENROUTER_API_KEY: 'test-only-router-key', OPENROUTER_MODEL: 'minimax/minimax-m3.1-flash', GEMINI_API_KEY: 'test-only', ANTHROPIC_API_KEY: KEY, ANTHROPIC_MODEL: MODEL, SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: MODEL };
  for (const off of [{ SYLLABUS_CHECK_AI_PROVIDER: 'off' }, { SYLLABUS_CHECK_AI_PROVIDER: 'OFF' }, { COMPLIANCE_AI_PROVIDER: 'off' }]) {
    assert.deepEqual(providerConfig({ ...keys, ...off }), { provider: 'off', model: '', configured: false }, JSON.stringify(off));
    assert.deepEqual(providerConfig({ ...keys, ...off }, { evaluation: true }), { provider: 'off', model: '', configured: false });
  }
  const env = { ...keys, SYLLABUS_CHECK_AI_PROVIDER: 'off' };
  const { content, masters } = real();
  const { calls, transport } = answering();
  assert.deepEqual(await align(content, masters, { env, transport }), { status: 'not_evaluated', reason: OFF, judgements: [], failure: NOT_CONFIGURED });
  assert.deepEqual(await align(content, masters, { env, transport, evaluationOnly: true }), { status: 'not_evaluated', reason: OFF, judgements: [], failure: NOT_CONFIGURED, evaluationOnly: true });
  await assert.rejects(askJson({ system: 's', payload: {}, schema: () => ({}) }, { env, transport }), error => error.status === 503);
  const none = await run(structuredClone(content), masters, { linkChecker, useAi: true, env: {} });
  const turnedOff = await run(structuredClone(content), masters, { linkChecker, useAi: true, env, transport });
  assert.deepEqual(official(turnedOff), official(none));
  assert.ok(turnedOff.hybrid.codedChecks.length > 0);
  assert.equal(turnedOff.hybrid.alignment.reason, OFF);
  assert.ok(turnedOff.conformance.failed.some(f => f.ruleId === 'AI-REQUIRED' && f.message.includes('SYLLABUS_CHECK_AI_PROVIDER=off')));
  assert.equal(calls.length, 0);
});

test('only an evaluation script, with its own env and evaluationOnly: true, asks an unapproved Claude model; every result it gets is marked evaluationOnly', async () => {
  const { content, masters } = real();
  const { calls, transport } = answering();
  const result = await align(content, masters, { env: selected, transport, evaluationOnly: true });
  assert.deepEqual([result.status, result.provider, result.model, result.evaluationOnly], ['completed', 'anthropic', MODEL, true]);
  assert.ok(calls.length > 0);
  // Nothing else switches it on: another truthy value, an environment variable of any likely name, or the option without the script's own env.
  const before = calls.length;
  for (const value of ['true', 1, 'yes', {}]) assert.deepEqual(await align(content, masters, { env: selected, transport, evaluationOnly: value }), { status: 'not_evaluated', reason: LOCKED, judgements: [], failure: NOT_CONFIGURED }, String(value));
  for (const extra of [{ SYLLABUS_CHECK_EVALUATION: 'on' }, { SYLLABUS_CHECK_EVALUATION_ONLY: 'true' }, { evaluationOnly: 'true' }, { ANTHROPIC_EVALUATION: '1' }]) {
    assert.equal((await align(content, masters, { env: { ...selected, ...extra }, transport })).reason, LOCKED, JSON.stringify(extra));
  }
  assert.equal(calls.length, before);
  // Through the engine the evaluation gets the score the verdicts would give, which only an evaluation report reads: it never counts as verified,
  // also where that model is approved. (The stage passes get the same options: anthropic-replay.test.js runs them all.)
  const report = await run(structuredClone(content), masters, { linkChecker, useAi: true, env: selected, transport, evaluationOnly: true });
  assert.equal(report.hybrid.alignment.evaluationOnly, true);
  assert.equal(typeof report.score, 'number');
  assert.equal(verifiedAlignment(report.hybrid.alignment, approved), false);
  assert.equal(verifiedAlignment({ ...report.hybrid.alignment, evaluationOnly: undefined }, approved), true, 'the same result without the mark, on an approving server');
  assert.equal(blocked, 0);
});

test('the server cannot be switched to an evaluation: it reads process.env and passes no env, so the option alone leaves Claude locked', async t => {
  withProcessEnv(t, { ...selected, SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: undefined, OPENROUTER_API_KEY: undefined, GEMINI_API_KEY: undefined });
  const { content, masters } = real();
  const { calls, transport } = answering();
  assert.deepEqual(await align(content, masters, { transport, evaluationOnly: true }), { status: 'not_evaluated', reason: LOCKED, judgements: [], failure: NOT_CONFIGURED });
  const report = await run(structuredClone(content), masters, { linkChecker, useAi: true, transport, evaluationOnly: true });
  assert.deepEqual([report.score, report.hybrid.ready, report.hybrid.alignment.reason, 'evaluationOnly' in report.hybrid.alignment], [null, false, LOCKED, false]);
  assert.equal(providerConfig().configured, false);
  assert.equal(calls.length, 0);
});

test('the submission gate (SYLLABUS_CHECK_AI_GATE=required) accepts a Claude check only for the approved model and never an evaluation-only one', async t => {
  withProcessEnv(t, { SYLLABUS_CHECK_AI_GATE: 'required', SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: undefined });
  const { content, masters } = real();
  masters.fingerprint = 'current-master';
  const hash = contentHash(content, svc.standard.version);
  const report = { score: 85, referenceHash: masters.fingerprint, fingerprint: masters.fingerprint, hybrid: { ready: true, checkedAt: new Date().toISOString(), alignment: { status: 'completed', provider: 'anthropic', model: MODEL }, deductions: [] } };
  t.mock.method(repo, 'mastersFor', async () => masters);
  t.mock.method(repo, 'readReport', async () => report);
  const db = { query: async (sql, params) => {
    if (sql.startsWith('SELECT 1')) return [[]];
    if (sql.startsWith('SELECT * FROM ai_check_runs')) return [params[1] === hash ? [{ run_id: 7 }] : []];
    throw Error('Unexpected SQL: ' + sql);
  } };
  svc.resetInstalledCache();
  const refused = error => error.status === 409 && error.body.code === 'alignment_required';
  await assert.rejects(svc.requireHybrid(db, 100, content), refused, 'not approved');
  process.env.SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL = 'claude-sonnet-4-6';
  await assert.rejects(svc.requireHybrid(db, 100, content), refused, 'another model approved');
  process.env.SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL = MODEL;
  assert.equal((await svc.requireHybrid(db, 100, content)).score, 85);
  report.hybrid.alignment.evaluationOnly = true;
  await assert.rejects(svc.requireHybrid(db, 100, content), refused, 'evaluation only');
  // The other providers pass the gate exactly as before, and an evaluation-only result of theirs does not.
  report.hybrid.alignment = { status: 'completed', provider: 'openrouter', model: router.OPENROUTER_MODEL };
  assert.equal((await svc.requireHybrid(db, 100, content)).score, 85);
  report.hybrid.alignment.evaluationOnly = true;
  await assert.rejects(svc.requireHybrid(db, 100, content), refused);
  report.hybrid.alignment = { status: 'completed', provider: 'gemini' };
  assert.equal((await svc.requireHybrid(db, 100, content)).score, 85);
});
