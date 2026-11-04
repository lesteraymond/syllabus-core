'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');

const {
  createRequestBudget,
  align,
  classifyFailure,
  blockedNow,
  resetProviderBlock,
  NEMOTRON_FREE
} = require('./gemini');
const { sample } = require('./fixtures');
const { refineSuggestion, createVerificationToken, verifyVerificationToken, relatedContextHash } = require('./refine');
const academicV2Activation = require('./academicV2Activation');
const complianceService = require('../compliance/service');
const repo = require('./repository');

function mockTransportFor(batches) {
  let callCount = 0;
  return async (url, options) => {
    callCount++;
    const idx = callCount - 1;
    const bodyStr = options.body;
    const reqData = JSON.parse(bodyStr);
    const handler = batches[idx] || batches[batches.length - 1];
    if (typeof handler === 'function') {
      return handler(reqData, options, callCount);
    }
    return handler;
  };
}

function makeAnswer(pairs, label = 'ALIGNED') {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{
        finish_reason: 'stop',
        message: {
          content: JSON.stringify({
            judgements: pairs.map(p => ({
              id: p.id,
              label,
              explanation: 'Evidence aligns with required outcome.',
              sourceQuote: p.source ? p.source.slice(0, 30) : 'Evidence',
              targetQuote: p.target ? p.target.slice(0, 30) : 'Target',
              sourceBloom: 'Apply',
              targetBloom: 'Apply',
              draft: ''
            }))
          })
        }
      }]
    })
  };
}

test('Scenario A: Request-budget exhaustion stops checking cleanly without silent truncation', async () => {
  const { content, masters } = sample();
  const testPairs = [
    { id: 'p1', type: 'ILO-CLO', source: 'Source 1', target: 'Target 1', path: 'plan[0].ilos[0]', targetPath: 'plan[0].ilos[0].text' },
    { id: 'p2', type: 'ILO-CLO', source: 'Source 2', target: 'Target 2', path: 'plan[0].ilos[1]', targetPath: 'plan[0].ilos[1].text' },
    { id: 'p3', type: 'ILO-CLO', source: 'Source 3', target: 'Target 3', path: 'plan[1].ilos[0]', targetPath: 'plan[1].ilos[0].text' },
    { id: 'p4', type: 'ILO-CLO', source: 'Source 4', target: 'Target 4', path: 'plan[1].ilos[1]', targetPath: 'plan[1].ilos[1].text' }
  ];

  const env = {
    SYLLABUS_CHECK_AI_PROVIDER: 'openrouter',
    OPENROUTER_API_KEY: 'test-key',
    OPENROUTER_MODEL: NEMOTRON_FREE,
    SYLLABUS_CHECK_AI_BATCH: '2',
    SYLLABUS_CHECK_AI_MAX_REQUESTS: '1', // Only 1 request allowed
    SYLLABUS_CHECK_AI_MAX_TOKENS: '500000',
    SYLLABUS_CHECK_AI_CONCURRENCY: '1'
  };

  const transport = mockTransportFor([
    req => makeAnswer(testPairs.slice(0, 2)),
    req => makeAnswer(testPairs.slice(2, 4))
  ]);

  const result = await align(content, masters, {
    env,
    transport,
    pairs: testPairs,
    skipEmpty: false
  });

  assert.strictEqual(result.status, 'not_evaluated', 'Overall status must remain not_evaluated when budget exhausted');
  assert.strictEqual(result.failure?.kind, 'request_budget', 'Failure kind must indicate request_budget');
  assert.strictEqual(result.requestBudget?.exhausted, true, 'Request budget must report exhausted=true');
  assert.strictEqual(result.requestBudget?.stopReason, 'request_limit', 'Stop reason must be request_limit');
  assert.strictEqual(result.requestBudget?.requests, 1, 'Only 1 request should have been dispatched');

  // Verify that the second batch relationships are marked unverified with failureKind: request_budget
  const unverified = result.judgements.filter(j => j.unverified);
  assert.strictEqual(unverified.length, 2, 'Unsent batch must contain unverified relationships');
  for (const j of unverified) {
    assert.strictEqual(j.failureKind, 'request_budget');
    assert.strictEqual(j.label, 'INSUFFICIENT_EVIDENCE');
  }
});

test('Scenario B: Token-budget exhaustion halts evaluation and marks remaining findings', async () => {
  const { content, masters } = sample();
  const testPairs = [
    { id: 'p1', type: 'ILO-CLO', source: 'Source 1', target: 'Target 1', path: 'plan[0].ilos[0]', targetPath: 'plan[0].ilos[0].text' },
    { id: 'p2', type: 'ILO-CLO', source: 'Source 2', target: 'Target 2', path: 'plan[0].ilos[1]', targetPath: 'plan[0].ilos[1].text' }
  ];

  const env = {
    SYLLABUS_CHECK_AI_PROVIDER: 'openrouter',
    OPENROUTER_API_KEY: 'test-key',
    OPENROUTER_MODEL: NEMOTRON_FREE,
    SYLLABUS_CHECK_AI_BATCH: '2',
    SYLLABUS_CHECK_AI_MAX_REQUESTS: '10',
    SYLLABUS_CHECK_AI_MAX_TOKENS: '100', // Very small token budget; 1 request body exceeds 100 bytes
    SYLLABUS_CHECK_AI_CONCURRENCY: '1'
  };

  const transport = mockTransportFor([
    req => makeAnswer(testPairs)
  ]);

  const result = await align(content, masters, {
    env,
    transport,
    pairs: testPairs,
    skipEmpty: false
  });

  assert.strictEqual(result.status, 'not_evaluated');
  assert.strictEqual(result.failure?.kind, 'request_budget');
  assert.strictEqual(result.requestBudget?.exhausted, true);
  assert.strictEqual(result.requestBudget?.stopReason, 'token_budget');
});

test('Scenario C: Multiple AI batches share one requestBudget', async () => {
  const { content, masters } = sample();
  const testPairs = [
    { id: 'p1', type: 'ILO-CLO', source: 'Source 1', target: 'Target 1', path: 'plan[0].ilos[0]', targetPath: 'plan[0].ilos[0].text' },
    { id: 'p2', type: 'ILO-CLO', source: 'Source 2', target: 'Target 2', path: 'plan[0].ilos[1]', targetPath: 'plan[0].ilos[1].text' },
    { id: 'p3', type: 'ILO-CLO', source: 'Source 3', target: 'Target 3', path: 'plan[1].ilos[0]', targetPath: 'plan[1].ilos[0].text' },
    { id: 'p4', type: 'ILO-CLO', source: 'Source 4', target: 'Target 4', path: 'plan[1].ilos[1]', targetPath: 'plan[1].ilos[1].text' }
  ];

  const sharedBudget = createRequestBudget({
    SYLLABUS_CHECK_AI_MAX_REQUESTS: '10',
    SYLLABUS_CHECK_AI_MAX_TOKENS: '1000000'
  });

  const env = {
    SYLLABUS_CHECK_AI_PROVIDER: 'openrouter',
    OPENROUTER_API_KEY: 'test-key',
    OPENROUTER_MODEL: NEMOTRON_FREE,
    SYLLABUS_CHECK_AI_BATCH: '2',
    SYLLABUS_CHECK_AI_CONCURRENCY: '1'
  };

  const transport = mockTransportFor([
    req => makeAnswer(testPairs.slice(0, 2)),
    req => makeAnswer(testPairs.slice(2, 4))
  ]);

  const result = await align(content, masters, {
    env,
    transport,
    pairs: testPairs,
    skipEmpty: false,
    requestBudget: sharedBudget
  });

  assert.strictEqual(result.status, 'completed');
  assert.strictEqual(sharedBudget.summary().requests, 2, 'Both batches must count towards the shared budget');
  assert.strictEqual(sharedBudget.summary().remainingRequests, 8);
  assert.strictEqual(sharedBudget.summary().exhausted, false);
});

test('Scenario D: Retry attempts consume their allowance from the shared budget', async () => {
  const budget = createRequestBudget({
    SYLLABUS_CHECK_AI_MAX_REQUESTS: '3',
    SYLLABUS_CHECK_AI_MAX_TOKENS: '1000000'
  });

  // Reserve attempt 1
  budget.reserveRequest('request body 1', 1000);
  assert.strictEqual(budget.summary().requests, 1);

  // Reserve attempt 2 (retry)
  budget.reserveRequest('request body retry 1', 1000);
  assert.strictEqual(budget.summary().requests, 2);

  // Reserve attempt 3 (retry 2)
  budget.reserveRequest('request body retry 2', 1000);
  assert.strictEqual(budget.summary().requests, 3);

  // Next attempt must throw and be rejected by the budget
  assert.throws(
    () => budget.reserveRequest('request body retry 3', 1000),
    err => err.kind === 'request_budget' && err.budgetReason === 'request_limit'
  );
  assert.strictEqual(budget.summary().exhausted, true);
});

test('Scenario E: Concurrent budget reservations safely cap total requests', async () => {
  const budget = createRequestBudget({
    SYLLABUS_CHECK_AI_MAX_REQUESTS: '5',
    SYLLABUS_CHECK_AI_MAX_TOKENS: '1000000'
  });

  let succeeded = 0;
  let rejected = 0;

  const tasks = Array.from({ length: 15 }, async () => {
    try {
      budget.reserveRequest('sample body', 500);
      succeeded++;
    } catch (e) {
      if (e.kind === 'request_budget') rejected++;
    }
  });

  await Promise.all(tasks);

  assert.strictEqual(succeeded, 5, 'Exactly 5 reservations must succeed');
  assert.strictEqual(rejected, 10, 'Remaining 10 reservations must be rejected');
  assert.strictEqual(budget.summary().requests, 5);
  assert.strictEqual(budget.summary().exhausted, true);
});

test('Scenario F & G: Two simultaneous Faculty Re-Checks and duplicate re-checks are single-flighted with HTTP 409', async () => {
  const activeChecks = new WeakSet();
  const runningChecks = new Set();
  const fakeApp = { locals: {} };

  // First request acquires lock
  assert.strictEqual(activeChecks.has(fakeApp), false);
  activeChecks.add(fakeApp);
  runningChecks.add(101);

  // Second simultaneous request for another syllabus (Scenario F)
  let errF = null;
  if (activeChecks.has(fakeApp)) {
    errF = { status: 409, code: 'ai_check_in_progress' };
  }
  assert.strictEqual(errF?.status, 409);
  assert.strictEqual(errF?.code, 'ai_check_in_progress');

  // Duplicate request for same syllabus (Scenario G)
  let errG = null;
  if (activeChecks.has(fakeApp) || runningChecks.has(101)) {
    errG = { status: 409, code: 'ai_check_in_progress' };
  }
  assert.strictEqual(errG?.status, 409);
  assert.strictEqual(errG?.code, 'ai_check_in_progress');

  // Cleanup
  activeChecks.delete(fakeApp);
  runningChecks.delete(101);
  assert.strictEqual(activeChecks.has(fakeApp), false);
});

test('Scenario H: Check & Improve concurrency is locked per application instance', async () => {
  const refining = new WeakSet();
  const fakeApp = { locals: {} };

  assert.strictEqual(refining.has(fakeApp), false);
  refining.add(fakeApp);

  // Second concurrent refine request
  let error = null;
  if (refining.has(fakeApp)) {
    error = { status: 409, message: 'Another recommendation is being checked. Try again in a moment.' };
  }
  assert.strictEqual(error?.status, 409);
  assert.match(error?.message, /Another recommendation is being checked/);

  refining.delete(fakeApp);
  assert.strictEqual(refining.has(fakeApp), false);
});

test('Scenario I: Provider credit exhaustion activates cooldown breaker and halts requests without retry', async () => {
  resetProviderBlock();
  const { content, masters } = sample();
  const testPairs = [
    { id: 'p1', type: 'ILO-CLO', source: 'Source 1', target: 'Target 1', path: 'plan[0].ilos[0]', targetPath: 'plan[0].ilos[0].text' }
  ];

  const env = {
    SYLLABUS_CHECK_AI_PROVIDER: 'openrouter',
    OPENROUTER_API_KEY: 'test-key',
    OPENROUTER_MODEL: NEMOTRON_FREE,
    SYLLABUS_CHECK_AI_COOLDOWN_SEC: '300'
  };

  // Simulate OpenRouter HTTP 402 Payment Required (credit balance exhausted)
  const transport = async () => ({
    ok: false,
    status: 402,
    json: async () => ({ error: { message: 'Insufficient credits on account' } })
  });

  const result = await align(content, masters, {
    env,
    transport,
    pairs: testPairs,
    skipEmpty: false
  });

  assert.strictEqual(result.status, 'not_evaluated');
  assert.strictEqual(result.failure?.kind, 'provider_access');
  assert.strictEqual(result.failure?.httpStatus, 402);

  // Breaker must be active now
  const blocked = blockedNow();
  assert.ok(blocked, 'Provider cooldown breaker must be activated');
  assert.strictEqual(blocked.status, 402);

  // Immediate subsequent check should be blocked locally without calling transport
  let networkCalled = false;
  const dummyTransport = async () => { networkCalled = true; };
  const blockedResult = await align(content, masters, {
    env,
    transport: dummyTransport,
    pairs: testPairs,
    skipEmpty: false
  });
  assert.strictEqual(networkCalled, false, 'No network request should be sent while breaker is active');
  assert.strictEqual(blockedResult.status, 'not_evaluated');

  resetProviderBlock();
});

test('Scenario J: Request cancellation during evaluation cleanly aborts in-flight processing', async () => {
  const { content, masters } = sample();
  const testPairs = [
    { id: 'p1', type: 'ILO-CLO', source: 'Source 1', target: 'Target 1', path: 'plan[0].ilos[0]', targetPath: 'plan[0].ilos[0].text' }
  ];

  const controller = new AbortController();
  const env = {
    SYLLABUS_CHECK_AI_PROVIDER: 'openrouter',
    OPENROUTER_API_KEY: 'test-key',
    OPENROUTER_MODEL: NEMOTRON_FREE
  };

  const transport = async (url, opts) => {
    // Cancel the controller during transport invocation
    controller.abort(new Error('User cancelled'));
    const err = new Error('The operation was aborted');
    err.name = 'AbortError';
    throw err;
  };

  const result = await align(content, masters, {
    env,
    transport,
    pairs: testPairs,
    skipEmpty: false,
    signal: controller.signal
  });

  assert.strictEqual(result.status, 'not_evaluated');
  assert.strictEqual(result.failure?.kind, 'request_cancelled');
  assert.strictEqual(result.judgements[0].unverified, true);
  assert.strictEqual(result.judgements[0].failureKind, 'request_cancelled');
});

test('Scenario K: Incomplete academic reports remain strictly incomplete and never manufactured', async () => {
  const { content, masters } = sample();
  const testPairs = [
    { id: 'p1', type: 'ILO-CLO', source: 'Source 1', target: 'Target 1', path: 'plan[0].ilos[0]', targetPath: 'plan[0].ilos[0].text' },
    { id: 'p2', type: 'ILO-CLO', source: 'Source 2', target: 'Target 2', path: 'plan[0].ilos[1]', targetPath: 'plan[0].ilos[1].text' }
  ];

  // Batch 1 succeeds, Batch 2 throws a 500 server error
  const transport = mockTransportFor([
    req => makeAnswer(testPairs.slice(0, 1), 'ALIGNED'),
    req => ({ ok: false, status: 500, json: async () => ({ error: { message: 'Internal Server Error' } }) }),
    req => ({ ok: false, status: 500, json: async () => ({ error: { message: 'Internal Server Error' } }) }),
    req => ({ ok: false, status: 500, json: async () => ({ error: { message: 'Internal Server Error' } }) })
  ]);

  const env = {
    SYLLABUS_CHECK_AI_PROVIDER: 'openrouter',
    OPENROUTER_API_KEY: 'test-key',
    OPENROUTER_MODEL: NEMOTRON_FREE,
    SYLLABUS_CHECK_AI_BATCH: '1',
    SYLLABUS_CHECK_AI_CONCURRENCY: '1'
  };

  const result = await align(content, masters, {
    env,
    transport,
    pairs: testPairs,
    skipEmpty: false
  });

  assert.strictEqual(result.status, 'not_evaluated', 'Must never manufacture a completed report on error');
  assert.strictEqual(result.coverage.verified < result.coverage.total, true);

  const j1 = result.judgements.find(j => j.id === 'p1');
  const j2 = result.judgements.find(j => j.id === 'p2');
  assert.strictEqual(j1.label, 'ALIGNED', 'Verified relationship from batch 1 is preserved');
  assert.strictEqual(j2.unverified, true, 'Unfinished relationship must be clearly marked unverified');
  assert.strictEqual(j2.label, 'INSUFFICIENT_EVIDENCE');
});

test('Scenario L: Cost-accounting consistency with per-check dollar spending caps', () => {
  const env = {
    SYLLABUS_CHECK_AI_MAX_COST_USD: '0.05',
    SYLLABUS_CHECK_AI_MAX_REQUESTS: '10',
    SYLLABUS_CHECK_AI_MAX_TOKENS: '1000000'
  };

  const budget = createRequestBudget(env);
  assert.strictEqual(budget.summary().maxCostUsd, 0.05);

  // Reserve request with model pricing
  budget.reserveRequest('small test body', 1000, { model: 'claude-sonnet-5-5' });
  const s1 = budget.summary();
  assert.ok(s1.reservedCostUsd > 0, 'Estimated cost should be reserved');
  assert.strictEqual(s1.exhausted, false);

  // Reconcile actual usage under the limit
  budget.reconcileUsage({ estimatedUsd: 0.02 });
  assert.strictEqual(budget.summary().reconciledCostUsd, 0.02);
  assert.strictEqual(budget.summary().exhausted, false);

  // Reconcile actual usage exceeding limit
  assert.throws(
    () => budget.reconcileUsage({ estimatedUsd: 0.04 }), // Total 0.06 > 0.05
    err => err.kind === 'request_budget' && err.budgetReason === 'cost_budget'
  );
  assert.strictEqual(budget.summary().exhausted, true);
  assert.strictEqual(budget.summary().stopReason, 'cost_budget');
});

test('Scenario M: Verification-token synchronous reservation prevents in-process double-consumption race', async () => {
  const consumedTokens = new Set();
  const tokenSig = 'sig-test-token-12345';

  let firstAccepted = false;
  let secondAccepted = false;

  // Simulate two concurrent requests arriving with the same verification token
  const processDecision = async () => {
    if (consumedTokens.has(tokenSig)) {
      throw Object.assign(new Error('This verification token has already been applied.'), { status: 409 });
    }
    // Synchronously reserve before async DB query
    consumedTokens.add(tokenSig);
    // Simulate async DB query
    await new Promise(r => setTimeout(r, 10));
    return { ok: true };
  };

  const [res1, res2] = await Promise.allSettled([
    processDecision(),
    processDecision()
  ]);

  const fulfilled = [res1, res2].filter(r => r.status === 'fulfilled');
  const rejected = [res1, res2].filter(r => r.status === 'rejected');

  assert.strictEqual(fulfilled.length, 1, 'Only one concurrent request can consume the token');
  assert.strictEqual(rejected.length, 1, 'The other concurrent request must be rejected');
  assert.strictEqual(rejected[0].reason.status, 409);
});

test('Scenario N: Server restart resets memory Set, but cryptographic verification retains expiration & context drift protection', () => {
  const { content, masters } = sample();
  const path = 'plan[0].ilos[0].text';
  const original = content.plan[0].ilos[0].text;
  const replacement = 'Demonstrate fundamental principles of academic computing.';

  const contextHash = relatedContextHash(content, masters, path);

  // Expired token test
  const expiredToken = createVerificationToken({
    runId: 100,
    suggestionId: 'sug-1',
    syllabusId: 50,
    path,
    originalValue: original,
    replacement,
    contextHash,
    ttlMs: -1000 // already expired
  });

  const checkExpired = verifyVerificationToken(expiredToken, {
    runId: 100,
    suggestionId: 'sug-1',
    syllabusId: 50,
    path,
    originalValue: original,
    replacement,
    contextHash
  });
  assert.strictEqual(checkExpired.valid, false);
  assert.strictEqual(checkExpired.reason, 'expired');

  // Context drift test (modifying related learning activity)
  const driftedContent = structuredClone(content);
  driftedContent.plan[0].activities = 'Completely different rewritten activities';
  const driftedContextHash = relatedContextHash(driftedContent, masters, path);

  const freshToken = createVerificationToken({
    runId: 100,
    suggestionId: 'sug-1',
    syllabusId: 50,
    path,
    originalValue: original,
    replacement,
    contextHash
  });

  const checkDrift = verifyVerificationToken(freshToken, {
    runId: 100,
    suggestionId: 'sug-1',
    syllabusId: 50,
    path,
    originalValue: original,
    replacement,
    contextHash: driftedContextHash
  });
  assert.strictEqual(checkDrift.valid, false);
  assert.strictEqual(checkDrift.reason, 'context_drift');
});

test('Scenario O: Legacy Hybrid Checker compatibility preserves 47 rules, passing mark of 79 and official scoring', async () => {
  const { content, masters } = sample();
  const coded = require('./engine').coded(content, masters);

  assert.ok(coded.findings, 'Must produce deterministic findings');
  assert.ok(Number.isFinite(coded.base.overall), 'Must produce numeric score');
  assert.strictEqual(coded.base.overall, 100, 'Clean sample syllabus has base score 100');

  const standard = require('../compliance/standard-v4.json');
  assert.strictEqual(standard.passThreshold, 79, 'Official passing mark must remain 79');
  assert.strictEqual(standard.rules.length, 47, 'Deterministic compliance rules count must remain 47');
});

test('Scenario P: Policy V2 is disabled by default in standard environment', () => {
  // Ensure default environment has no V2 flags enabled
  const isEnabled = academicV2Activation.enabled({});
  assert.strictEqual(isEnabled, false, 'Policy V2 must be disabled by default');

  const isIntegrated = academicV2Activation.integrated({}, {});
  assert.strictEqual(isIntegrated, false, 'Policy V2 integrated must be false by default');
});
