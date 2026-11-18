'use strict';
// The AI provider lock (aiConfig.js), which replaced the old checker's provider code: Claude only, only for the approved model, and the submission gate
// accepts only a completed check of the new AI Checker.
const test = require('node:test');
const assert = require('node:assert/strict');
const { providerConfig, verifiedAlignment } = require('./aiConfig');

const KEY = 'sk-ant-test-only-aiconfig-not-a-real-key';
const CLAUDE = { SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: KEY, ANTHROPIC_MODEL: 'claude-sonnet-5-5' };

test('Claude is configured only with a valid key, a claude-* model and that model approved; a key alone turns nothing on', () => {
  assert.equal(providerConfig({ ...CLAUDE }).configured, false, 'not approved');
  assert.equal(providerConfig({ ...CLAUDE, SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: 'claude-opus-5-5' }).configured, false, 'another model approved');
  assert.deepEqual(providerConfig({ ...CLAUDE, SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: 'claude-sonnet-5-5' }), { provider: 'anthropic', model: 'claude-sonnet-5-5', configured: true, approved: true });
  assert.equal(providerConfig({ ...CLAUDE, ANTHROPIC_API_KEY: 'not-a-key', SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: 'claude-sonnet-5-5' }).configured, false, 'invalid key');
  assert.equal(providerConfig({ ANTHROPIC_API_KEY: KEY, ANTHROPIC_MODEL: 'claude-sonnet-5-5', SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: 'claude-sonnet-5-5' }).configured, false, 'Claude is used only when chosen by name');
});

test('off, or one of the old checker\'s providers, configures nothing', () => {
  for (const provider of ['off', 'gemini', 'openrouter', 'deepseek', 'groq', '']) {
    assert.equal(providerConfig({ SYLLABUS_CHECK_AI_PROVIDER: provider, GEMINI_API_KEY: 'k', OPENROUTER_API_KEY: 'k' }).configured, false, provider || '(unset)');
  }
});

test('the submission gate accepts only a completed check of the new AI Checker with the approved model, never an old-checker or evaluation-only one', () => {
  const env = { SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: 'claude-sonnet-5-5' };
  const ok = { status: 'completed', provider: 'anthropic', model: 'claude-sonnet-5-5', engine: 're-planned' };
  assert.equal(verifiedAlignment(ok, env), true);
  assert.equal(verifiedAlignment({ ...ok, status: 'not_evaluated' }, env), false);
  assert.equal(verifiedAlignment({ ...ok, evaluationOnly: true }, env), false);
  assert.equal(verifiedAlignment({ ...ok, model: 'claude-opus-5-5' }, env), false, 'a model that is not the approved one');
  const { engine, ...oldChecker } = ok;
  assert.equal(verifiedAlignment(oldChecker, env), false, 'a report of the old AI Checker');
  assert.equal(verifiedAlignment({ status: 'completed', provider: 'gemini' }, env), false);
});
