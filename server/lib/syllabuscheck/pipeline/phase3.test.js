'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const T = require('./testSyllabus');
const P = require('./prompt');
const pipeline = require('./index');
const { claudeProvider } = require('./provider');
const { runShadow, modeOf } = require('./shadow');
const { syntheticSyllabus, MASTERS, PLANTED, plantedReport } = require('./eval/synthetic');
const { schemaProblems } = require('../anthropicSchema');
const script = require('../../../../scripts/replan-paid-run.cjs');

const ENV = { ANTHROPIC_API_KEY: 'sk-ant-test-not-a-real-key', ANTHROPIC_MODEL: 'claude-sonnet-5-5' };
// A stand-in for anthropicMessage: reserves like the real one (onRequest before sending), answers with the scripted judge, reports usage.
function fakeSend({ costPerRequest = 0.01, fail = null } = {}) {
  const calls = [];
  const send = async (request, opts) => {
    opts.onRequest({ model: request.model, system: request.system, messages: [{ role: 'user', content: request.user }] }, 16000);
    calls.push(request);
    if (fail) throw Object.assign(Error(fail), { usage: { attempts: 1, inputTokens: 0, outputTokens: 0, estimatedUsd: 0 } });
    const text = await T.scriptedJudge()({ system: request.system, user: request.user, schema: request.schema });
    return { text, usage: { attempts: 1, inputTokens: 1000, outputTokens: 200, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, estimatedUsd: costPerRequest } };
  };
  send.calls = calls;
  return send;
}

test('both response schemas are accepted by Anthropic structured outputs (checked offline)', () => {
  assert.deepEqual(schemaProblems(P.ANSWER_SCHEMA), []);
  assert.deepEqual(schemaProblems(P.REWRITE_SCHEMA), []);
});

test('answers in the schema\'s list form are read; an item listed twice is refused', () => {
  const request = { questions: [{ id: 'q', relationship: 'CONTENT-TITLE', from: { text: 'Topic 3' }, to: [{ text: 'IT 204' }] }] };
  const base = { q: 'q', quote: 'Topic 3', explanation: 'fits' };
  assert.equal(P.validateAnswers(request, { answers: [{ ...base, items: [{ id: 'subject', answer: 'yes' }] }] }).answers.get('q').items.subject, 'yes');
  assert.match(P.validateAnswers(request, { answers: [{ ...base, items: [{ id: 'subject', answer: 'yes' }, { id: 'subject', answer: 'no' }] }] }).rejected[0].reason, /each item once/);
});

test('provider: nothing is sent without a cost cap or a configured Claude model', () => {
  assert.equal(claudeProvider({ env: ENV }).ready, false);
  assert.match(claudeProvider({ env: ENV, maxCostUsd: 0 }).reason, /cost cap/);
  assert.match(claudeProvider({ env: { ANTHROPIC_API_KEY: 'nope', ANTHROPIC_MODEL: 'claude-sonnet-5-5' }, maxCostUsd: 1 }).reason, /not configured/);
  assert.match(claudeProvider({ env: { ...ENV, ANTHROPIC_MODEL: 'claude-unknown-1' }, maxCostUsd: 1 }).reason, /not configured/);
});

test('provider: a request is sent only while spent + its worst case fits the cap; the request that would pass the cap is never sent', async () => {
  const send = fakeSend({ costPerRequest: 0.2 });
  const provider = claudeProvider({ env: ENV, maxCostUsd: 0.5, send });
  assert.equal(provider.ready, true);
  assert.match(provider.model, /^claude-sonnet-5-5\|thinking=adaptive\|effort=high$/);
  const message = P.judgeMessage({ course: {}, questions: [] });
  await provider.ask(message);
  await provider.ask(message);
  await assert.rejects(provider.ask(message), error => error.kind === 'request_budget');
  assert.equal(send.calls.length, 2);
  const used = provider.usage();
  assert.equal(used.judgeRequests, 3);
  assert.equal(used.inputTokens, 2000);
  assert.equal(used.estimatedUsd, 0.4);
  assert.equal(used.budget.spentUsd, 0.4);
  assert.equal(used.budget.stopReason, 'cost_budget');
});

test('provider: worst cases are released when a request settles, so a $2 cap is not used up by requests that cost a cent', async () => {
  const send = fakeSend({ costPerRequest: 0.01 });
  const provider = claudeProvider({ env: ENV, maxCostUsd: 2, send });
  const result = await pipeline.check(T.conforming(), null, { ask: provider.ask, model: provider.model, year: 2026 });
  assert.equal(send.calls.length, 20);
  assert.equal(result.summary.complete, true);
  assert.equal(provider.usage().budget.spentUsd, 0.2);
});

test('provider: a timed-out request (it may have been billed) settles at its worst case', () => {
  const { spendCap } = require('./provider');
  const cap = spendCap({ maxCostUsd: 1, maxRequests: 10, model: 'claude-sonnet-5-5' });
  const worst = cap.reserve('x'.repeat(1000), 16000);
  cap.settle(worst, { timedOut: true, estimatedUsd: null });
  assert.equal(cap.summary().spentUsd, Math.round(worst * 1e8) / 1e8);
  const cap2 = spendCap({ maxCostUsd: 1, maxRequests: 1, model: 'claude-sonnet-5-5' });
  cap2.reserve('x', 100);
  assert.throws(() => cap2.reserve('x', 100), error => error.kind === 'request_budget' && error.budgetReason === 'request_limit');
});

test('provider: a failed request is counted, its usage kept, and the error passed on (the judge then marks its questions not checked)', async () => {
  const provider = claudeProvider({ env: ENV, maxCostUsd: 2, send: fakeSend({ fail: 'Anthropic HTTP 529' }) });
  const result = await pipeline.check(T.conforming(), null, { ask: provider.ask, model: provider.model, year: 2026 });
  assert.equal(result.summary.complete, false);
  assert.ok(result.judged.results.every(r => r.status === 'not_checked'));
  assert.equal(provider.usage().failures, 20);
});

test('through the real Claude client: rules and syllabus context go as two cached system blocks, identical for every request of a check', async () => {
  const calls = [];
  const transport = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    const message = { system: body.system.map(b => b.text), user: body.messages[0].content };
    const text = await T.scriptedJudge()(message);
    return new Response(JSON.stringify({ id: 'msg_offline', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: [{ type: 'text', text }], stop_reason: 'end_turn', stop_sequence: null,
      usage: { input_tokens: 900, output_tokens: 150, cache_creation_input_tokens: 0, cache_read_input_tokens: 1500 } }), { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req_offline' } });
  };
  const provider = claudeProvider({ env: ENV, maxCostUsd: 2, transport });
  const result = await pipeline.check(T.conforming(), null, { ask: provider.ask, model: provider.model, year: 2026 });
  assert.equal(result.summary.misalignments, 0);
  assert.equal(calls.length, 20);
  assert.ok(calls.every(b => b.system.length === 2 && b.system.every(block => block.cache_control?.type === 'ephemeral')));
  assert.equal(new Set(calls.map(b => JSON.stringify(b.system))).size, 1);
  assert.equal(provider.usage().cacheReadInputTokens, 30000);
});

test('the Claude client still sends a single text system prompt exactly as before', async () => {
  const { anthropicMessage } = require('../anthropicClient');
  let sent;
  const transport = async (url, init) => { sent = JSON.parse(init.body); return new Response(JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: [{ type: 'text', text: '{"text":"x","explanation":"y"}' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } }); };
  await anthropicMessage({ model: 'claude-sonnet-5-5', system: 'One system text.', user: 'u', schema: P.REWRITE_SCHEMA }, { env: ENV, transport });
  assert.deepEqual(sent.system, [{ type: 'text', text: 'One system text.', cache_control: { type: 'ephemeral' } }]);
});

test('shadow mode is off by default and skips (never throws) when it cannot run safely', async () => {
  assert.equal(modeOf({}), 'off');
  assert.equal(modeOf({ SYLLABUS_CHECK_REPLAN: 'bogus' }), 'off');
  assert.equal(await runShadow({ content: T.conforming(), env: {} }), null);
  const notAnthropic = await runShadow({ content: T.conforming(), env: { SYLLABUS_CHECK_REPLAN: 'shadow', SYLLABUS_CHECK_AI_PROVIDER: 'openrouter' } });
  assert.match(notAnthropic.skipped, /direct Anthropic provider only/);
  const noCap = await runShadow({ content: T.conforming(), env: { ...ENV, SYLLABUS_CHECK_REPLAN: 'shadow', SYLLABUS_CHECK_AI_PROVIDER: 'anthropic' } });
  assert.match(noCap.skipped, /SYLLABUS_CHECK_REPLAN_MAX_COST_USD/);
});

test('shadow mode attaches a comparison and leaves the official result untouched', async () => {
  const official = { score: 72, hybrid: { deductions: [{ id: 'd1' }], suggestions: [{ id: 's1' }, { id: 's2' }] } };
  const snapshot = structuredClone(official);
  const content = T.conforming();
  content.plan[3].activities = 'Lecture only';
  const provider = { ask: T.scriptedJudge(), rewrite: T.scriptedRewriter(), model: 'scripted' };
  const shadow = await runShadow({ content, officialResult: official, env: { SYLLABUS_CHECK_REPLAN: 'shadow' }, provider, store: new Map() });
  assert.deepEqual(official, snapshot);
  assert.equal(shadow.mode, 'shadow');
  assert.deepEqual(shadow.byRule, { 'ACTIVITY-OPTIONS': 1 });
  assert.deepEqual(shadow.official, { score: 72, deductions: 1, suggestions: 2 });
  assert.equal(shadow.plan, undefined);
  const planned = await runShadow({ content, officialResult: official, env: { SYLLABUS_CHECK_REPLAN: 'plan' }, provider, store: new Map() });
  assert.equal(planned.plan.clean, true);
  assert.deepEqual(planned.plan.changes.map(c => c.key), ['activities:r4']);
});

test('the compliance service runs the shadow inside its own try/catch, after the official result is built', () => {
  const source = require('node:fs').readFileSync(path.join(__dirname, '..', '..', 'compliance', 'service.js'), 'utf8');
  const at = source.indexOf("require('../syllabuscheck/pipeline/shadow')");
  assert.ok(at > source.indexOf('hybridEngine.run(content, masters, { ...options, ...legacyOptions'));
  assert.match(source.slice(at, at + 700), /try \{[\s\S]*runShadow[\s\S]*\} catch \(error\) \{[\s\S]*replanShadow = \{ mode/);
});

test('paid-run script: dry run by default; a live run needs --confirm-paid, a cap of at most $5, a configured model and a fresh output folder', () => {
  const base = { live: true, confirmed: true, maxCost: 3, maxRequests: 60 };
  const noResult = { existsSync: () => false }, hasResult = { existsSync: () => true };
  assert.equal(script.liveRefusal({ ...base, live: false }, null, noResult), null);
  assert.match(script.liveRefusal({ ...base, confirmed: false }, null, noResult), /--confirm-paid/);
  assert.match(script.liveRefusal({ ...base, maxCost: 6 }, null, noResult), /at most 5/);
  assert.match(script.liveRefusal({ ...base, maxCost: NaN }, null, noResult), /--max-cost/);
  assert.match(script.liveRefusal(base, null, hasResult), /not repeated/);
  assert.match(script.liveRefusal(base, { ANTHROPIC_API_KEY: '' }, noResult), /not configured/);
  assert.equal(script.liveRefusal(base, ENV, noResult), null);
  assert.ok(script.outDir.includes(path.join('docs', 'ai-checker-replan-run')));
});

test('synthetic syllabus: the fixed rules find the 4 planted problems that need no AI, and 20 requests check the rest', async () => {
  const content = syntheticSyllabus();
  const result = await pipeline.check(content, MASTERS, { year: 2026 });
  const found = plantedReport(result).filter(p => p.found).map(p => p.id);
  assert.deepEqual(found, ['P2', 'P4', 'P5', 'P7']);
  assert.equal(script.requestsOf(require('./extract').extract(content, MASTERS)).requests, 20);
  assert.ok(JSON.stringify(content).includes('synthetic'));
});

test('synthetic syllabus end to end with a model that sees the planted problems: all 8 found, the plan converges, the re-check asks nothing', async () => {
  const content = syntheticSyllabus();
  const planted = {
    'CLO-TITLE|clo:c3': { item: 'subject', text: content.clos[2].statement },
    'ILO-CONTENT|ilo:i5': { item: 'topic', text: content.plan[4].ilos[0].text },
    'TASK-FIT|tasks:r11': { item: 'content', text: content.plan[10].tasks },
    'ILO-CLO|ilo:i14|clo:c3': { item: 'student', text: content.plan[13].ilos[0].text },
  };
  const override = q => {
    const p = planted[q.id];
    if (!p || q.field.text !== p.text.replace(/\s+/g, ' ').trim()) return undefined;
    const items = require('./rules').CHECKLISTS[q.relationship].items.map(i => ({ id: i.id, answer: i.id === p.item ? 'no' : 'yes' }));
    return { q: q.id, items, quote: q.field.text.split(' ').slice(0, 3).join(' '), explanation: 'Planted problem.' };
  };
  const better = {
    clo: 'Design, implement and evaluate Python programs that use files, exceptions, modules and classes to meet given requirements.',
    ilo: { i5: 'Write Python programs that choose between actions with if, elif and else statements.', i14: 'Handle runtime errors in Python programs with try, except and finally.' },
    tasks: '- Lab exercise: clean and format a text file with string methods',
  };
  const rewrite = T.scriptedRewriter({ replace: job => {
    if (job.field.kind === 'clo') return JSON.stringify({ text: better.clo, explanation: 'On the subject.' });
    if (job.field.kind === 'ilo') return JSON.stringify({ text: /database/.test(job.field.text) ? better.ilo.i5 : better.ilo.i14, explanation: 'Fits the week.' });
    if (job.field.kind === 'tasks') return JSON.stringify({ text: better.tasks, explanation: 'Assesses strings.' });
    return undefined;
  } });
  const store = new Map(), opts = { ask: T.scriptedJudge({ override }), store, model: 'oracle', year: 2026 };
  const before = await pipeline.check(content, MASTERS, opts);
  const plan = await pipeline.buildPlan(content, MASTERS, { ...opts, rewrite });
  const report = plantedReport(before, plan);
  assert.deepEqual(report.filter(p => !p.found).map(p => p.id), []);
  assert.deepEqual(report.filter(p => !p.changedByPlan).map(p => p.id), ['P7'], 'only the old reference is left to faculty review');
  assert.equal(plan.clean, true);
  const recheck = await pipeline.check(pipeline.applyPlan(content, plan), MASTERS, { ...opts, ask: T.failIfCalled });
  assert.equal(recheck.summary.misalignments, 0);
  assert.equal(recheck.judged.usage.asked, 0);
  assert.equal(PLANTED.length, 8);
});
