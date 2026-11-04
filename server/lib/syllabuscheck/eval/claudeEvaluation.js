'use strict';
// Stage S7: how the evaluation scripts (scripts/eval-alignment.cjs, scripts/live-pipeline-eval.cjs) ask Claude, for evaluation only. The provider is
// named on the command line (--provider anthropic), never taken from server/.env; only a model approved for evaluation is asked; and the settings live
// in the script's local env object, without the application's approval switch (SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL is removed from it), so an
// evaluation neither relies on nor changes what the application may use. The adapter is then asked as an evaluation (gemini.js providerConfig
// { evaluation: true }, engine options evaluationOnly): every answer is marked evaluationOnly and never counts as a verified check, an official score or
// a submission gate. No I/O.
const path = require('node:path');
const { EFFORTS } = require('../anthropicClient');
const { claudeWorstCaseOf } = require('./providerGuard');

const EVALUATION_MODELS = ['claude-sonnet-5-5']; // approved for evaluation on 2026-10-27; every other model is refused
const AUTHORIZED_TOTAL = 10; // US$: the Claude evaluation budget authorized so far; --total-cap can lower it, never raise it
const CLAUDE_DIR = path.join(__dirname, '..', '..', '..', '..', 'docs', 'ai-eval-anthropic'); // Claude's evaluation files, apart from every earlier one
const SPEND_REGISTER = path.join(CLAUDE_DIR, 'spend-register.json');
const HELDOUT_LOG = path.join(CLAUDE_DIR, 'heldout-log.jsonl');
const PLAN_KEY = 'sk-ant-plan-only-not-a-key'; // what a plan hands the adapter, which needs a key in Anthropic's format; a plan never sends a request

// The Claude options of a command line (has(name), flag(name, fallback) as the scripts read them), and what is wrong with them. A paid run states its
// model, thinking and effort; a plan assumes the evaluation candidate at adaptive thinking and high effort. An integer given out of range is refused,
// never silently replaced. `refused` names the flags the script does not offer with Claude.
function claudeOptionsOf({ has, flag, paid, refused = [] }) {
  const wholeIn = (name, low, high, fallback) => { if (!has(name)) return fallback; const n = Number(flag(name, '')); return Number.isInteger(n) && n >= low && n <= high ? n : NaN; };
  const options = {
    model: flag('model', paid ? '' : EVALUATION_MODELS[0]), thinking: flag('thinking', paid ? '' : 'adaptive'), effort: flag('effort', paid ? '' : 'high'),
    maxTokens: wholeIn('max-tokens', 1024, 16000, 16000), timeoutSec: wholeIn('timeout-sec', 10, 300, 180), maxRetries: wholeIn('max-retries', 0, 3, 2),
    maxOutputTokens: wholeIn('max-output-tokens', 1, Number.MAX_SAFE_INTEGER, null),
    totalCap: has('total-cap') ? Number(flag('total-cap', '')) : AUTHORIZED_TOTAL,
    register: flag('spend-register', SPEND_REGISTER), heldoutLog: flag('heldout-log', HELDOUT_LOG),
  };
  const problems = [
    !EVALUATION_MODELS.includes(options.model) && `--model must be a Claude model approved for evaluation (${EVALUATION_MODELS.join(', ')})`,
    !['adaptive', 'off'].includes(options.thinking) && '--thinking must be adaptive or off',
    !EFFORTS.includes(options.effort) && `--effort must be ${EFFORTS.join(', ')}`,
    Number.isNaN(options.maxTokens) && '--max-tokens must be an integer from 1024 to 16000 (the max_tokens of every request, thinking included)',
    Number.isNaN(options.timeoutSec) && '--timeout-sec must be an integer from 10 to 300',
    Number.isNaN(options.maxRetries) && '--max-retries must be an integer from 0 to 3',
    Number.isNaN(options.maxOutputTokens) && '--max-output-tokens must be a positive integer',
    !(options.totalCap > 0 && options.totalCap <= AUTHORIZED_TOTAL) && `--total-cap must be a positive number of dollars, at most ${AUTHORIZED_TOTAL} (the authorized Claude evaluation budget)`,
    ...refused.filter(has).map(name => `--${name} is not available with --provider anthropic`),
  ].filter(Boolean);
  return { options, problems };
}
// The script's local env object, set to ask Claude with these options: the model and its settings, the prompt cache on (as the application would), and
// no approval switch.
function applyClaudeEnv(env, options) {
  Object.assign(env, { SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', ANTHROPIC_MODEL: options.model, ANTHROPIC_THINKING: options.thinking, ANTHROPIC_EFFORT: options.effort,
    ANTHROPIC_MAX_TOKENS: String(options.maxTokens), ANTHROPIC_TIMEOUT_SEC: String(options.timeoutSec), ANTHROPIC_MAX_RETRIES: String(options.maxRetries), ANTHROPIC_PROMPT_CACHE: 'on' });
  delete env.SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL;
  return env;
}
// What the requests a plan built (their bodies, as the adapter would send them) could cost over `runs` runs: each one's worst case, the guard's own
// bound on exactly those bytes at the pinned prices (claudeWorstCaseOf), and an expected range, which is an estimate and never a limit: input tokens
// about bytes / 4 plus 30%, plus 600 for what Anthropic adds; 150 to 400 output tokens per relationship; 500 to 3,000 thinking tokens per request when
// thinking is on. Low: the system prompt read from the cache after the first request (written once), the shortest answers, a global workspace. High:
// the system prompt written by every request, the longest answers, data residency (x1.1). Retries come on top of both.
function planCostOf(bodies, prices, runs = 1) {
  const tokensOf = text => Math.ceil((Buffer.byteLength(text) / 4) * 1.3);
  const each = bodies.map(body => {
    const sent = JSON.parse(body), n = JSON.parse(sent.messages[0].content).document_data.length, thinking = sent.thinking?.type === 'adaptive' ? [500, 3000] : [0, 0];
    const system = tokensOf((sent.system || []).map(block => block.text || '').join('')), rest = tokensOf(sent.messages[0].content) + 600;
    const cost = (fromCache, outputs, think) => (fromCache ? system * prices.listedCacheRead : system * prices.cacheWrite5m) + rest * prices.input + (outputs * n + think) * prices.output;
    return { relationships: n, inputTokens: system + rest, worst: claudeWorstCaseOf(body, prices).dollars, write: cost(false, 150, thinking[0]), read: cost(true, 150, thinking[0]), high: cost(false, 400, thinking[1]) * prices.geoFactor };
  });
  const sum = key => each.reduce((total, e) => total + e[key], 0);
  return { requests: each.length * runs, relationships: sum('relationships') * runs, worst: sum('worst') * runs, largest: Math.max(0, ...each.map(e => e.worst)),
    low: each.length ? sum('read') * runs + each[0].write - each[0].read : 0, high: sum('high') * runs, inputTokensPerRequest: each.length ? Math.round(sum('inputTokens') / each.length) : 0 };
}
module.exports = { EVALUATION_MODELS, AUTHORIZED_TOTAL, CLAUDE_DIR, SPEND_REGISTER, HELDOUT_LOG, PLAN_KEY, claudeOptionsOf, applyClaudeEnv, planCostOf };
