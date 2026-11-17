'use strict';
// VPAA Rule Conformance Testing Framework: shared harness.
//
// SCOPE. A SOFTWARE-CONFORMANCE harness: it gives tests the shared SYNTHETIC syllabus and masters, an isolated environment and a network guard.
// The AI is scripted elsewhere: the new AI Checker's tests use pipeline/testSyllabus.js (scriptedJudge, scriptedRewriter), and the browser E2E
// uses scripts/e2e/fake-anthropic.cjs. A passing test proves how the SOFTWARE handles an answer, never that Claude would give it. Nothing here
// calls the network, and `liveGuard()` fails the suite if any real fetch is attempted.
const { sample } = require('../fixtures');
const engine = require('../engine');

const MODEL = 'claude-sonnet-5-5';
const SYNTHETIC_KEY = 'sk-ant-conformance-test-only-not-a-real-key';

// An isolated environment object (the direct Anthropic provider with a synthetic key): it never reads or changes process.env.
function envFor(over = {}) {
  return { SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', ANTHROPIC_MODEL: MODEL, ANTHROPIC_API_KEY: SYNTHETIC_KEY, ANTHROPIC_MAX_RETRIES: '0', ...over };
}

// Fail loudly if anything in a test reaches the real network. A conformance test must never spend money.
// Loopback stays open because route tests talk to their own ephemeral 127.0.0.1 server; anything else is a live call.
function liveGuard(t) {
  const original = globalThis.fetch;
  const loopback = (url) => /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/i.test(String(url?.url || url));
  globalThis.fetch = async (url, init) => {
    if (loopback(url)) return original(url, init);
    throw new Error('LIVE NETWORK CALL BLOCKED in a conformance test: ' + String(url?.url || url));
  };
  t.after(() => { globalThis.fetch = original; });
}

module.exports = { MODEL, envFor, liveGuard, sample, engine };
