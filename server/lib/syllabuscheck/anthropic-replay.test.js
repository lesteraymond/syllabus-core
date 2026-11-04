'use strict';
// Evidence-validation parity between the providers, offline: the Phase 3 oracle's answers reach the engine once as OpenRouter (oracle.js) and once as
// Claude (eval/anthropicReplay.js, through the Anthropic adapter and the official SDK). Identical answers must verify identically: the same verdicts,
// quotes, evidence matches, recommendations, held drafts, findings, retries and official result. Only the provider's own marks may differ (the reuse
// key, which carries the provider and model, the provider and model names, the time of the check, and the usage and evaluation-only marks of a Claude
// check). The Claude runs are evaluation-only checks of an unapproved model, as the evaluation harness makes them. No network: runWithOracle blocks fetch.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createOracle, runWithOracle, DEFAULT_ENV, LEGACY_ENV } = require('./eval/phase3/oracle');
const { FIXTURES, variant, loadManifest } = require('./eval/phase3/fixtures');
const { createAnthropicReplay, routerBodyOf, ANTHROPIC_URL, THINKING_TOKENS } = require('./eval/anthropicReplay');
const { verifiedAlignment, providerConfig } = require('./gemini');
const { run } = require('./engine');

const manifest = loadManifest();
const CLAUDE = { SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-ant-test-only-not-a-real-key', ANTHROPIC_MODEL: 'claude-sonnet-5-5' };
// Everything but the provider's own marks. A verdict's reuse key (64 hex characters) is dropped wherever a copy of the verdict appears.
function comparable(result) {
  const copy = JSON.parse(JSON.stringify(result));
  delete copy.hybrid.checkedAt;
  for (const key of ['provider', 'model', 'usage', 'evaluationOnly']) delete copy.hybrid.alignment[key];
  const strip = node => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.key === 'string' && /^[0-9a-f]{64}$/.test(node.key)) delete node.key;
    for (const value of Object.values(node)) strip(value);
  };
  strip(copy);
  return copy;
}
// What the oracle was asked, request by request: the same relationships, with the same corrections, in the same order.
const asked = stats => ({ requests: stats.requests, calls: stats.calls.map(({ model, ...call }) => call), pairAttempts: stats.pairAttempts, corrections: stats.correctionsReceived });
async function both(syllabus, oracleOptions, { env = DEFAULT_ENV, thinking = true } = {}) {
  const viaRouter = await runWithOracle(structuredClone(syllabus), oracleOptions, { env });
  const replay = createAnthropicReplay(createOracle(oracleOptions), { thinking });
  const claudeEnv = { ...env, ...CLAUDE };
  const viaClaude = await runWithOracle(structuredClone(syllabus), replay, { env: claudeEnv, evaluationOnly: true });
  return { router: viaRouter.result, routerStats: viaRouter.oracle.stats, claude: viaClaude.result, replay, claudeEnv };
}
function assertParity({ router, routerStats, claude, replay, claudeEnv }, label) {
  assert.deepEqual(comparable(claude), comparable(router), label);
  assert.deepEqual(asked(replay.stats), asked(routerStats), `${label}: the oracle was asked the same questions`);
  const alignment = claude.hybrid.alignment;
  assert.deepEqual([alignment.provider, alignment.model, alignment.evaluationOnly], ['anthropic', 'claude-sonnet-5-5', true], label);
  assert.equal(verifiedAlignment(alignment, claudeEnv), false, `${label}: an evaluation result never counts for the submission gate`);
  // Every request went to the fixed Messages URL with the candidate's parameters, all stated.
  assert.ok(replay.calls.length > 0 && replay.calls.length === replay.stats.requests, label);
  for (const call of replay.calls) {
    assert.deepEqual([call.model, call.maxTokens, call.thinking, call.effort, call.format], ['claude-sonnet-5-5', 16000, { type: 'adaptive' }, 'high', 'json_schema'], label);
    assert.deepEqual(call.keys, ['max_tokens', 'messages', 'model', 'output_config', 'system', 'thinking'], label);
  }
}

test('identical answers verify identically: the four Phase 3 fixtures, aligned and misaligned, every stage on, a thinking block before each answer', async () => {
  for (const key of FIXTURES) {
    for (const name of ['aligned', 'misaligned']) {
      const pair = await both(variant(key, name, manifest), { variantSpec: manifest.variants[`${key}-${name}`] });
      assertParity(pair, `${key}-${name}`);
      assert.equal(pair.claude.hybrid.alignment.status, 'completed');
      if (name === 'aligned') assert.deepEqual([pair.claude.score, pair.claude.passed, pair.claude.hybrid.ready], [100, true, true], `${key}-aligned`);
    }
  }
});

test('the same with every stage off, the production settings', async () => {
  for (const key of FIXTURES) {
    for (const name of ['aligned', 'misaligned']) {
      assertParity(await both(variant(key, name, manifest), { variantSpec: manifest.variants[`${key}-${name}`] }, { env: LEGACY_ENV }), `${key}-${name} legacy`);
    }
  }
});

test('answers the checker refuses are refused, corrected and asked again identically: empty and missing answers, bad quotes, broken and cut-off JSON, contradictions and unsupported drafts', async () => {
  const syllabus = variant('bsit', 'aligned', manifest), variantSpec = manifest.variants['bsit-aligned'];
  const scenarios = {
    'empty answer, recovered': [{ type: 'empty_judgements', onPair: 'clo0-course', attempt: 1 }],
    'empty answer, every time': [{ type: 'always_empty_judgements', onPair: 'clo0-po7' }],
    'missing id': [{ type: 'omit_id', onPair: 'clo1-course', attempt: 1 }],
    'bad quotes': [
      { type: 'quotes_swapped', onPair: 'clo0-course', attempt: 1 }, { type: 'quote_wrong_side', side: 'source', onPair: 'clo1-course', attempt: 1 },
      { type: 'quote_case_flip', side: 'target', onPair: 'clo2-course', attempt: 1 }, { type: 'quote_missing', side: 'source', onPair: 'clo3-course', attempt: 1 },
      { type: 'quote_from_other_pair', side: 'target', onPair: 'row1-content', attempt: 1 }, { type: 'quote_not_found', side: 'both', onPair: 'row2-content', attempt: 1 },
    ],
    // finish_reason length from OpenRouter, stop_reason max_tokens from Claude: both are incomplete output, and the batch is split the same way.
    'broken and cut-off JSON': [{ type: 'broken_json', onRequest: 1 }, { type: 'cutoff_length', onRequest: 5 }],
    'contradicting recommendations': [
      { type: 'conflicting_recommendation', onPair: 'clo0-course', attempt: 1, label: 'ALIGNED', recommendation: 'REWRITE_TEXT', draft: 'Unwanted rewrite.' },
      { type: 'conflicting_recommendation', onPair: 'clo1-course', attempt: 1, label: 'NOT_ALIGNED', recommendation: 'NO_CHANGE', draft: '' },
      { type: 'conflicting_recommendation', onPair: 'clo0-po7', attempt: 1, label: 'NOT_ALIGNED', recommendation: 'RETAG_OUTCOME', withRewrite: true },
      { type: 'conflicting_recommendation', onPair: 'row1-content', attempt: 1, label: 'NOT_ALIGNED', recommendation: 'RETAG_OUTCOME', draft: '' },
    ],
    'contradicting and malformed stage fields': [
      { type: 'conflicting_aspects', onPair: 'row1-activityfit', label: 'ALIGNED', fields: { teaching: 'weak', learnerSupport: 'limited', responsible: 'activity' } },
      { type: 'conflicting_aspects', onPair: 'row2-assessfit', label: 'NOT_ALIGNED', fields: { measures: 'yes', evidence: 'observable', level: 'matches', responsible: 'none' }, draft: '- Written quiz and lab exercise with grading rubric.' },
      { type: 'malformed_aspect', onPair: 'row3-activityfit', keys: ['learnerSupport'] }, { type: 'unassessed_aspect', onPair: 'row4-assessfit', keys: ['measures'] },
    ],
    'role confusion': [{ type: 'role_confusion', onPair: 'row1-ilo0-clo:c1', attempt: 1 }],
  };
  for (const [label, faults] of Object.entries(scenarios)) {
    const pair = await both(syllabus, { variantSpec, faults });
    assertParity(pair, label);
    assert.ok(pair.replay.stats.calls.some(call => call.faultApplied), `${label}: the fault was applied`);
  }
  // Unsupported drafts are held back the same way, and the official deduction stays (the A5.6 scenario).
  const offSubject = structuredClone(syllabus);
  offSubject.content.plan[4].contents = 'Medieval fresco restoration, mineral pigments, lime plaster preparation and period brushwork';
  const drafts = [['unnecessary_practical', 'row0-activityfit', 'PARTIALLY_ALIGNED'], ['copies_other_relationship', 'row2-activityfit', 'PARTIALLY_ALIGNED'], ['copies_reference', 'row3-ilo0-activity', 'NOT_ALIGNED'],
    ['keeps_off_subject', 'row4-content', 'NOT_ALIGNED'], ['assumes_resource', 'row6-activityfit', 'PARTIALLY_ALIGNED'], ['expands_competency', 'row7-activityfit', 'PARTIALLY_ALIGNED'],
    ['adds_participant', 'row8-assessfit', 'PARTIALLY_ALIGNED'], ['adds_activity', 'row9-valueuse', 'PARTIALLY_ALIGNED'], ['adds_week', 'row10-valueuse', 'PARTIALLY_ALIGNED'],
    ['value_not_expressed', 'row13-valueuse', 'PARTIALLY_ALIGNED'], ['conditional_resource', 'row12-activityfit', 'PARTIALLY_ALIGNED']];
  const unsupported = await both(offSubject, { variantSpec, faults: drafts.map(([kind, onPair, label]) => ({ type: 'unsupported_draft', kind, onPair, label })) });
  assertParity(unsupported, 'unsupported drafts');
  assert.equal(unsupported.claude.score, 97);
  for (const [kind, id] of drafts) {
    const finding = unsupported.claude.hybrid.verdict.findings.find(f => f.relationshipId === id);
    assert.equal(finding?.withheld, kind === 'conditional_resource' ? null : 'draft_review', id);
  }
});

test('a thinking block before the answer changes nothing, and neither its text nor its signature is kept; its tokens are counted as output', async () => {
  const syllabus = variant('bscpe', 'misaligned', manifest), oracleOptions = { variantSpec: manifest.variants['bscpe-misaligned'] };
  const withThinking = await both(syllabus, oracleOptions, { thinking: true }), without = await both(syllabus, oracleOptions, { thinking: false });
  assert.deepEqual(comparable(withThinking.claude), comparable(without.claude));
  const text = JSON.stringify(withThinking.claude);
  assert.equal(text.includes('Replayed thinking block') || text.includes('"replay"'), false);
  const used = withThinking.claude.hybrid.alignment.usage;
  assert.equal(used.thinkingTokens, THINKING_TOKENS * used.requests);
  assert.equal(without.claude.hybrid.alignment.usage.thinkingTokens, 0);
  assert.equal(used.outputTokens - without.claude.hybrid.alignment.usage.outputTokens, used.thinkingTokens);
});

test('the replay hands the oracle the request unchanged, accepts only the Messages URL, and an unapproved model outside an evaluation sends nothing', async () => {
  const body = { model: 'claude-sonnet-5-5', max_tokens: 16000, thinking: { type: 'adaptive' }, system: [{ type: 'text', text: 'The system prompt.', cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: '{"course":{},"document_data":[]}' }], output_config: { effort: 'high', format: { type: 'json_schema', schema: { type: 'object' } } } };
  assert.deepEqual(routerBodyOf(body), { model: 'claude-sonnet-5-5', temperature: 0, stream: false, max_tokens: 16000,
    messages: [{ role: 'system', content: 'The system prompt.' }, { role: 'user', content: '{"course":{},"document_data":[]}' }],
    response_format: { type: 'json_schema', json_schema: { name: 'syllabus_alignment', strict: true, schema: { type: 'object' } } } });
  const replay = createAnthropicReplay(createOracle({}));
  await assert.rejects(replay.transport('https://openrouter.ai/api/v1/chat/completions', { body: '{}' }), /Unexpected provider URL in the Anthropic replay/);
  await assert.rejects(replay.transport(ANTHROPIC_URL + '?beta=true', { body: '{}' }), /Unexpected provider URL/);
  assert.equal(replay.stats.requests, 0);
  // Without evaluationOnly the same environment is an ordinary check of an unapproved Claude model: nothing is sent, and the official result is the
  // one of a server with no AI provider.
  const syllabus = variant('bsit', 'aligned', manifest), claudeEnv = { ...DEFAULT_ENV, ...CLAUDE };
  assert.deepEqual([providerConfig(claudeEnv).configured, providerConfig(claudeEnv).approved], [false, false]);
  const locked = await runWithOracle(structuredClone(syllabus), replay, { env: claudeEnv });
  assert.equal(replay.stats.requests, 0);
  assert.deepEqual([locked.result.hybrid.alignment.status, locked.result.hybrid.alignment.failure.kind, locked.result.score, locked.result.hybrid.ready], ['not_evaluated', 'not_configured', null, false]);
  const none = await run(structuredClone(syllabus).content, syllabus.masters, { useAi: true, env: { ...DEFAULT_ENV, SYLLABUS_CHECK_AI_PROVIDER: 'off' }, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }) });
  const official = report => [report.score, report.baseScore, report.passed, report.status, report.overall, report.band, report.hybrid.ready, report.hybrid.provisionalScore, report.hybrid.deductions, report.conformance.failed.map(f => f.id)];
  assert.deepEqual(official(locked.result), official(none));
});
