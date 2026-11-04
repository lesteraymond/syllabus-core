'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('./fixtures');
const { align, createRequestBudget, NEMOTRON_FREE } = require('./gemini');
const engine = require('./engine');
const policy = require('./academicPolicyV2');
const { plan, POLICY } = require('./academicV2Plan');

function routerEnv(extra = {}) {
  return {
    SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-key-not-a-real-key', OPENROUTER_MODEL: NEMOTRON_FREE,
    SYLLABUS_CHECK_AI_BATCH: '12', SYLLABUS_CHECK_AI_CONCURRENCY: '1', SYLLABUS_CHECK_AI_MAX_REQUESTS: '160',
    SYLLABUS_CHECK_AI_MAX_TOKENS: '8000000', ...extra,
  };
}
function pair(id, type = 'Content-ILO') {
  return { id, type, source: `Source evidence for ${id} explains the course skill.`, target: `Target evidence for ${id} practices the course skill.`, path: `plan[0].contents`, targetPath: `plan[0].ilos[0].text` };
}
function validAnswer(question) {
  return { judgements: question.document_data.map(item => ({
    id: item.id, label: 'ALIGNED', explanation: 'The quoted source and target support the same academic skill.',
    sourceQuote: item.source.trim().slice(0, 28), targetQuote: item.target.trim().slice(0, 28),
    sourceBloom: 'N/A', targetBloom: 'N/A', draft: '',
  })) };
}
function routerResponse(body, answer = validAnswer(JSON.parse(body.messages[1].content)), status = 200) {
  return new Response(JSON.stringify(status === 200 ? { model: body.model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(answer) } }] } : { error: { message: 'mock provider failure' } }),
    { status, headers: { 'content-type': 'application/json' } });
}
function mockRouter({ onRequest = () => {}, respond = body => routerResponse(body) } = {}) {
  return async (url, init) => {
    const body = JSON.parse(init.body), question = JSON.parse(body.messages[1].content);
    onRequest({ url, init, body, question });
    return respond(body, question, init);
  };
}
function largeSyllabus() {
  const { content, masters } = sample();
  content.plan.forEach((row, rowIndex) => {
    if (row.kind === 'exam') return;
    row.ilos = Array.from({ length: 5 }, (_, iloIndex) => ({
      id: `large-${rowIndex}-${iloIndex}`,
      text: `Apply and explain course concept ${rowIndex}-${iloIndex} through a concrete student task.`,
      tags: content.clos.map(clo => `clo:${clo.id}`),
    }));
  });
  return { content, masters };
}

test('a small check retains one-request behavior and returns judgments in input order', async () => {
  const { content, masters } = sample(), pairs = Array.from({ length: 4 }, (_, i) => pair(`small-${i}`));
  const sent = [];
  const result = await align(content, masters, { env: routerEnv({ SYLLABUS_CHECK_AI_BATCH: '12' }), pairs, transport: mockRouter({ onRequest: ({ question }) => sent.push(...question.document_data.map(p => p.id)) }) });
  assert.equal(result.status, 'completed');
  assert.equal(result.reuse.requests, 1);
  assert.deepEqual(sent, pairs.map(p => p.id));
  assert.deepEqual(result.judgements.map(j => j.id), pairs.map(p => p.id));
  assert.ok(result.judgements.every(j => j.label === 'ALIGNED' && !j.unverified));
});

test('244 relationships split deterministically across batches without losing or duplicating an ILO-to-CLO mapping', async () => {
  const { content, masters } = sample();
  const pairs = Array.from({ length: 61 }, (_, ilo) => Array.from({ length: 4 }, (_, clo) => pair(`ilo-${ilo}-clo-${clo}`, 'ILO-CLO'))).flat();
  const calls = [];
  const result = await align(content, masters, { env: routerEnv({ SYLLABUS_CHECK_AI_BATCH: '23' }), pairs,
    transport: mockRouter({ onRequest: ({ body, question }) => calls.push({ system: body.messages[0].content, ids: question.document_data.map(p => p.id) }) }) });
  assert.ok(pairs.length > 240);
  assert.equal(result.status, 'completed');
  assert.equal(calls.length, Math.ceil(pairs.length / 23));
  assert.deepEqual(result.judgements.map(j => j.id), pairs.map(p => p.id));
  const sent = calls.flatMap(call => call.ids);
  assert.equal(sent.length, pairs.length);
  assert.equal(new Set(sent).size, pairs.length);
  assert.deepEqual(new Set(sent), new Set(pairs.map(p => p.id)));
  const sameIloBatches = new Set(calls.flatMap((call, index) => call.ids.some(id => id.startsWith('ilo-5-')) ? [index] : []));
  assert.deepEqual(sameIloBatches, new Set([0, 1]), 'one ILO with four CLO mappings deliberately crosses the 23-pair boundary');
  assert.equal(new Set(calls.map(call => call.system)).size, 1, 'same relationship type keeps the same prompt contract in every batch');
});

test('a failed middle batch preserves verified judgments and marks every unanswered relationship unverified', async () => {
  const { content, masters } = sample(), pairs = Array.from({ length: 6 }, (_, i) => pair(`partial-${i}`, 'ILO-CLO'));
  let calls = 0;
  const result = await align(content, masters, { env: routerEnv({ SYLLABUS_CHECK_AI_BATCH: '2' }), pairs,
    transport: mockRouter({ respond: (body, question) => { calls += 1; return question.document_data.some(p => p.id === 'partial-2') ? routerResponse(body, null, 503) : routerResponse(body); } }) });
  assert.equal(calls, 3);
  assert.equal(result.status, 'not_evaluated');
  assert.deepEqual(result.judgements.map(j => j.id), pairs.map(p => p.id));
  assert.deepEqual(result.judgements.filter(j => !j.unverified).map(j => j.id), ['partial-0', 'partial-1', 'partial-4', 'partial-5']);
  assert.deepEqual(result.judgements.filter(j => j.unverified).map(j => j.id), ['partial-2', 'partial-3']);
  assert.equal(result.failure.kind, 'provider_error');
});

test('an empty AI response cannot become ALIGNED and remains incomplete after bounded retries', async () => {
  const { content, masters } = sample(), pairs = [pair('empty-response', 'ILO-CLO')];
  let calls = 0;
  const result = await align(content, masters, { env: routerEnv({ SYLLABUS_CHECK_AI_BATCH: '1' }), pairs,
    transport: mockRouter({ respond: body => { calls += 1; return routerResponse(body, { judgements: [] }); } }) });
  assert.equal(calls, 3);
  assert.equal(result.status, 'not_evaluated');
  assert.equal(result.judgements.length, 1);
  assert.equal(result.judgements[0].id, pairs[0].id);
  assert.equal(result.judgements[0].label, 'INSUFFICIENT_EVIDENCE');
  assert.equal(result.judgements[0].unverified, true);
});

test('duplicate input relationship IDs fail closed without making a provider request', async () => {
  const { content, masters } = sample(), pairs = [pair('duplicate'), pair('duplicate')];
  let calls = 0;
  const result = await align(content, masters, { env: routerEnv(), pairs, transport: mockRouter({ onRequest: () => { calls += 1; } }) });
  assert.equal(calls, 0);
  assert.equal(result.status, 'not_evaluated');
  assert.equal(result.failure.kind, 'duplicate_relationship_id');
  assert.equal(result.judgements.length, 2);
  assert.ok(result.judgements.every(j => j.unverified && j.label === 'INSUFFICIENT_EVIDENCE'));
});

test('a duplicate relationship ID in an AI response is rejected even when one copy is salvageable', async () => {
  const { content, masters } = sample(), pairs = [pair('duplicate-answer', 'ILO-CLO')];
  let calls = 0;
  const result = await align(content, masters, { env: routerEnv({ SYLLABUS_CHECK_AI_BATCH: '1' }), pairs,
    transport: mockRouter({ respond: body => {
      calls += 1;
      const good = validAnswer(JSON.parse(body.messages[1].content)).judgements[0];
      return routerResponse(body, { judgements: [good, { ...good }] });
    } }) });
  assert.equal(calls, 3);
  assert.equal(result.status, 'not_evaluated');
  assert.equal(result.judgements.length, 1);
  assert.equal(result.judgements[0].id, pairs[0].id);
  assert.equal(result.judgements[0].failureKind, 'invalid_output');
  assert.match(result.judgements[0].failure, /same id twice/);
  assert.equal(result.judgements[0].unverified, true);
  assert.notEqual(result.judgements[0].label, 'ALIGNED');
});

test('request-count exhaustion keeps earlier findings and materializes all remaining relationships as NOT_CHECKED', async () => {
  const { content, masters } = sample(), pairs = Array.from({ length: 5 }, (_, i) => pair(`request-budget-${i}`));
  let calls = 0;
  const result = await align(content, masters, { env: routerEnv({ SYLLABUS_CHECK_AI_BATCH: '1', SYLLABUS_CHECK_AI_MAX_REQUESTS: '2' }), pairs,
    transport: mockRouter({ onRequest: () => { calls += 1; } }) });
  assert.equal(calls, 2);
  assert.equal(result.status, 'not_evaluated');
  assert.equal(result.failure.kind, 'request_budget');
  assert.equal(result.requestBudget.requests, 2);
  assert.equal(result.requestBudget.exhausted, true);
  assert.deepEqual(result.judgements.map(j => j.id), pairs.map(p => p.id));
  assert.deepEqual(result.judgements.filter(j => !j.unverified).map(j => j.id), ['request-budget-0', 'request-budget-1']);
  assert.ok(result.judgements.slice(2).every(j => j.unverified && j.failureKind === 'request_budget' && j.label !== 'ALIGNED'));
});

test('token-budget exhaustion refuses before transport and returns no false alignment', async () => {
  const { content, masters } = sample(), pairs = [pair('token-budget', 'ILO-CLO')];
  let calls = 0;
  const result = await align(content, masters, { env: routerEnv({ SYLLABUS_CHECK_AI_MAX_TOKENS: '1' }), pairs,
    transport: mockRouter({ onRequest: () => { calls += 1; } }) });
  assert.equal(calls, 0);
  assert.equal(result.status, 'not_evaluated');
  assert.equal(result.failure.kind, 'request_budget');
  assert.equal(result.requestBudget.stopReason, 'token_budget');
  assert.equal(result.judgements[0].unverified, true);
});

test('the shared request limit counts each bounded Claude HTTP retry', async () => {
  const { content, masters } = sample(), pairs = [pair('claude-retry', 'ILO-CLO')], model = 'claude-sonnet-5-5';
  let calls = 0;
  const env = {
    SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: model, ANTHROPIC_MODEL: model,
    ANTHROPIC_API_KEY: 'sk-ant-unit-test-only-not-a-real-key', ANTHROPIC_MAX_RETRIES: '1', ANTHROPIC_MAX_TOKENS: '4096',
    SYLLABUS_CHECK_AI_MAX_REQUESTS: '2', SYLLABUS_CHECK_AI_MAX_TOKENS: '8000000', SYLLABUS_CHECK_AI_BATCH: '1',
  };
  const transport = async (_url, init) => {
    calls += 1;
    if (calls === 1) return new Response(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'temporary mocked failure' } }), { status: 500, headers: { 'content-type': 'application/json' } });
    const question = JSON.parse(JSON.parse(init.body).messages[0].content), answer = validAnswer(question);
    return new Response(JSON.stringify({ id: 'msg_mock_only', type: 'message', role: 'assistant', model,
      content: [{ type: 'text', text: JSON.stringify(answer) }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 100 } }),
    { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const requestBudget = createRequestBudget(env);
  const result = await align(content, masters, { env, pairs, transport, sleep: async () => {}, requestBudget });
  assert.equal(calls, 2);
  assert.equal(requestBudget.summary().requests, 2);
  assert.equal(result.status, 'completed');
  assert.equal(result.judgements[0].label, 'ALIGNED');
});

test('cancellation aborts the active request and marks relationships not yet evaluated', async () => {
  const { content, masters } = sample(), pairs = Array.from({ length: 5 }, (_, i) => pair(`cancel-${i}`, 'ILO-CLO'));
  const controller = new AbortController();
  let calls = 0;
  const transport = async (_url, init) => {
    calls += 1;
    await new Promise((resolve, reject) => {
      if (init.signal.aborted) return reject(init.signal.reason);
      init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
    });
    return new Response('{}');
  };
  const pending = align(content, masters, { env: routerEnv({ SYLLABUS_CHECK_AI_BATCH: '1' }), pairs, signal: controller.signal, transport });
  await new Promise(resolve => setTimeout(resolve, 10));
  controller.abort(new Error('test cancellation'));
  const result = await pending;
  assert.equal(calls, 1);
  assert.equal(result.status, 'not_evaluated');
  assert.equal(result.failure.kind, 'request_cancelled');
  assert.equal(result.judgements.length, pairs.length);
  assert.ok(result.judgements.every(j => j.unverified && j.label !== 'ALIGNED'));
});

test('Policy V2 evaluates more than 240 mapped weekly relationships with classification and r2 context across batches', async () => {
  const { content, masters } = largeSyllabus();
  const planned = plan(content, masters);
  const included = new Set([...POLICY.weeklyTypes, 'Course-CLO', 'CLO-PO', 'CLO-EGA', 'CLO-classification', 'Title-description', 'Description-plan']);
  const expected = planned.pairs.filter(p => included.has(p.type) && !planned.unavailable.has(p.id));
  const expectedMappings = planned.pairs.filter(p => p.type === 'ILO-CLO');
  assert.ok(expected.length > 240);
  assert.equal(expectedMappings.length, 300, '15 instructional lessons × 5 ILOs × 4 assigned CLO mappings');

  const sentIds = [], mappingRequests = [], batchSizes = [];
  const model = 'claude-sonnet-5-5';
  const env = {
    SYLLABUS_CHECK_ACADEMIC_V2: 'on', SYLLABUS_CHECK_AI_PROVIDER: 'anthropic',
    SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: model, ANTHROPIC_MODEL: model, ANTHROPIC_API_KEY: 'sk-ant-unit-test-only-not-a-real-key',
    ANTHROPIC_MAX_TOKENS: '4096', ANTHROPIC_MAX_RETRIES: '0', SYLLABUS_CHECK_AI_BATCH: '24', SYLLABUS_CHECK_AI_CONCURRENCY: '1',
    SYLLABUS_CHECK_AI_MAX_REQUESTS: '160', SYLLABUS_CHECK_AI_MAX_TOKENS: '8000000',
  };
  const transport = async (_url, init) => {
    const body = JSON.parse(init.body), question = JSON.parse(body.messages[0].content);
    batchSizes.push(question.document_data.length);
    sentIds.push(...question.document_data.map(p => p.id));
    assert.equal(question.course.description, '', 'the excluded CLO ↔ Course Description evidence is absent from shared context');
    const mappings = question.document_data.filter(p => p.type === 'ILO-CLO');
    if (mappings.length) {
      const system = body.system.map(part => part.text).join('\n');
      assert.match(system, /classificationContext/);
      assert.match(system, /Recommendation contract/);
      for (const item of mappings) {
        assert.ok(item.classificationContext, `${item.id} retains its fixed LCUP classification context`);
        assert.ok(question.recommendation_context?.pairs?.[item.id], `${item.id} receives its r2 lesson and mapping context`);
        assert.ok(item.classificationContext.cloLessons?.some(lesson => lesson.thisLesson) && item.classificationContext.cloLessons.some(lesson => !lesson.thisLesson), `${item.id} retains other-week progression context`);
        assert.ok(Object.values(question.recommendation_context.clos || {}).some(clo => clo.ilos?.some(ilo => ilo.week !== item.classificationContext.week)), `${item.id} recommendation context retains mapped ILOs from other weeks`);
      }
      mappingRequests.push(mappings.map(p => p.id));
    }
    const answer = validAnswer(question);
    for (const j of answer.judgements) Object.assign(j, { recommendation: 'NO_CHANGE', correctionField: 'none', correctionReason: '' });
    return new Response(JSON.stringify({ id: 'msg_mock_only', type: 'message', role: 'assistant', model,
      content: [{ type: 'text', text: JSON.stringify(answer) }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 100 } }),
    { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const result = await policy.evaluateIntegrated(content, masters, engine.coded, { env, transport });
  assert.equal(result.status, 'completed');
  assert.equal(result.alignment.requestBudget.exhausted, false);
  assert.equal(result.alignment.requestBudget.requests, batchSizes.length);
  assert.ok(batchSizes.every(size => size > 0 && size <= 24));
  assert.deepEqual(new Set(sentIds), new Set(expected.map(p => p.id)));
  assert.equal(sentIds.length, expected.length);
  assert.equal(new Set(sentIds).size, expected.length, 'each planned relationship is sent exactly once');
  assert.ok(mappingRequests.length > 1, 'ILO-CLO relationships span provider batches');
  assert.equal(result.academic.relationships.filter(r => r.relationshipType === 'ILO-CLO').length, 300);
  assert.ok(result.academic.relationships.filter(r => r.relationshipType === 'ILO-CLO').every(r => r.status === 'SUPPORTED_BY_SUPPLIED_EVIDENCE' && r.cloClassification?.status === 'evaluated' && r.correction?.canAutoApply === false));
  assert.equal(result.academic.provenance.networkRequests, batchSizes.length);
});

test('Policy V2 carries one request limit across outer slices and reports the rest NOT_CHECKED', async () => {
  const { content, masters } = largeSyllabus();
  const model = 'claude-sonnet-5-5';
  let calls = 0;
  const env = {
    SYLLABUS_CHECK_ACADEMIC_V2: 'on', SYLLABUS_CHECK_AI_PROVIDER: 'anthropic',
    SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: model, ANTHROPIC_MODEL: model, ANTHROPIC_API_KEY: 'sk-ant-unit-test-only-not-a-real-key',
    ANTHROPIC_MAX_TOKENS: '4096', ANTHROPIC_MAX_RETRIES: '0', SYLLABUS_CHECK_AI_BATCH: '24', SYLLABUS_CHECK_AI_CONCURRENCY: '1',
    SYLLABUS_CHECK_AI_MAX_REQUESTS: '2', SYLLABUS_CHECK_AI_MAX_TOKENS: '8000000',
  };
  const transport = async (_url, init) => {
    calls += 1;
    const body = JSON.parse(init.body), question = JSON.parse(body.messages[0].content), answer = validAnswer(question);
    for (const j of answer.judgements) Object.assign(j, { recommendation: 'NO_CHANGE', correctionField: 'none', correctionReason: '' });
    return new Response(JSON.stringify({ id: 'msg_mock_only', type: 'message', role: 'assistant', model,
      content: [{ type: 'text', text: JSON.stringify(answer) }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 100 } }),
    { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const result = await policy.evaluateIntegrated(content, masters, engine.coded, { env, transport });
  assert.equal(calls, 2);
  assert.equal(result.alignment.requestBudget.requests, 2);
  assert.equal(result.alignment.requestBudget.exhausted, true);
  assert.notEqual(result.status, 'completed');
  assert.ok(result.academic.relationships.some(r => r.status === 'NOT_CHECKED' && r.academicJudgment === null));
  assert.ok(result.academic.relationships.some(r => r.status === 'SUPPORTED_BY_SUPPLIED_EVIDENCE'));
});

test('an incomplete budgeted alignment remains separate from deterministic scoring and the advisory gate policy', async () => {
  const { content, masters } = sample();
  const deterministic = engine.coded(content, masters);
  const result = await engine.run(content, masters, {
    env: routerEnv({ SYLLABUS_CHECK_AI_BATCH: '1', SYLLABUS_CHECK_AI_MAX_REQUESTS: '1' }),
    transport: mockRouter(), linkChecker: async url => ({ url, status: 'ok', reason: 'offline test' }),
  });
  const standard = require('../compliance/standard-v4.json');
  const { aiGate } = require('./policy');
  assert.equal(result.hybrid.alignment.status, 'not_evaluated');
  assert.equal(result.hybrid.alignment.failure.kind, 'request_budget');
  assert.equal(result.baseScore, deterministic.base.overall);
  assert.equal(result.hybrid.baseScore, deterministic.base.overall);
  assert.equal(result.overall, null, 'an incomplete alignment is not published as a completed score');
  assert.equal(result.hybrid.ready, false);
  assert.equal(standard.passThreshold, 79);
  assert.equal(aiGate({}), 'advisory');
  assert.equal(aiGate({ SYLLABUS_CHECK_AI_GATE: 'required' }), 'required');
});

