// The daily ceilings on AI requests (docs/security/SECURITY-AUDIT-REPORT.md SEC-11). No database, no provider. Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveAiQuota, createAiQuota } = require('./aiQuota');

const problem = (fn, name) => assert.throws(fn, (e) => e.code === 'ai_quota_invalid' && e.message.includes(name), name);

test('the ceilings come from the environment, with defaults, and cannot be turned off', () => {
  assert.deepEqual(resolveAiQuota({}), { checksPerUser: 40, checksTotal: 400, refinesPerUser: 60 });
  assert.deepEqual(resolveAiQuota({ AI_CHECKS_PER_USER_PER_DAY: '5', AI_CHECKS_PER_DAY: '50', AI_REFINES_PER_USER_PER_DAY: '7' }), { checksPerUser: 5, checksTotal: 50, refinesPerUser: 7 });
  for (const [name, value] of [['AI_CHECKS_PER_USER_PER_DAY', '0'], ['AI_CHECKS_PER_USER_PER_DAY', 'off'], ['AI_CHECKS_PER_DAY', '100001'], ['AI_REFINES_PER_USER_PER_DAY', '-3'], ['AI_CHECKS_PER_DAY', '2.5']]) problem(() => resolveAiQuota({ [name]: value }), name);
  problem(() => resolveAiQuota({ AI_CHECKS_PER_USER_PER_DAY: '50', AI_CHECKS_PER_DAY: '10' }), 'AI_CHECKS_PER_DAY'); // the total can never be below one person's share
});

test('each person has their own daily count of checks, and the server has a total for everyone', () => {
  const day = { t: Date.parse('2026-11-12T03:00:00Z') };
  const q = createAiQuota({ checksPerUser: 2, checksTotal: 3, refinesPerUser: 1 }, { now: () => day.t });
  assert.equal(q.take('check', 1).ok, true);
  assert.equal(q.take('check', 1).ok, true);
  const mine = q.take('check', 1);
  assert.deepEqual([mine.ok, mine.reason], [false, 'user']);
  assert.ok(mine.retryAfterSec > 0);
  assert.equal(q.take('check', 2).ok, true);              // the third of the day for the server
  const all = q.take('check', 3);
  assert.deepEqual([all.ok, all.reason], [false, 'total']); // the server's total is spent, even for someone who has made none
  assert.equal(q.take('refine', 3).ok, true);              // refinements are counted apart
  assert.equal(q.take('refine', 3).ok, false);
});

test('a refused request does not use up anything, and give() hands back a request that never reached the AI', () => {
  const q = createAiQuota({ checksPerUser: 1, checksTotal: 1, refinesPerUser: 1 }, { now: () => 0 });
  assert.equal(q.take('check', 1).ok, true);
  assert.equal(q.take('check', 2).ok, false);
  q.give('check', 1);
  assert.equal(q.take('check', 2).ok, true);
});

test('the counts start again on the next day (Philippine time)', () => {
  const day = { t: Date.parse('2026-11-12T15:59:00Z') }; // 23:59 in Manila
  const q = createAiQuota({ checksPerUser: 1, checksTotal: 10, refinesPerUser: 1 }, { now: () => day.t });
  assert.equal(q.take('check', 1).ok, true);
  const refused = q.take('check', 1);
  assert.equal(refused.ok, false);
  assert.equal(refused.retryAfterSec, 60);                // until midnight in Manila
  day.t = Date.parse('2026-11-12T16:00:00Z');             // 00:00 on the 13th in Manila
  assert.equal(q.take('check', 1).ok, true);
});

test('the counts never grow without bound: only today is kept', () => {
  const day = { t: 0 };
  const q = createAiQuota({ checksPerUser: 5, checksTotal: 100000, refinesPerUser: 5 }, { now: () => day.t });
  for (let d = 0; d < 3; d++) { day.t = d * 86400000; for (let u = 0; u < 50; u++) q.take('check', u); }
  assert.equal(q.size(), 50);
});

// ---- The per-check spending limit (SYLLABUS_CHECK_REPLAN_MAX_COST_USD; docs/ai-checker-audit-2026-11-12.md A-2) ----
const { resolveCheckCostCap } = require('./aiQuota');
// the one AI provider the application uses (syllabuscheck/aiConfig.js): Claude with its approved model
const CLAUDE = { SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-ant-test-only-quota-not-a-real-key', ANTHROPIC_MODEL: 'claude-sonnet-5-5', SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: 'claude-sonnet-5-5' };
const capProblem = (env, re) => assert.throws(() => resolveCheckCostCap(env), (e) => e.code === 'ai_quota_invalid' && e.message.includes('SYLLABUS_CHECK_REPLAN_MAX_COST_USD') && re.test(e.message));

test('staging and production refuse to start with an AI provider configured and no per-check spending limit', () => {
  for (const mode of ['staging', 'production']) {
    capProblem({ NODE_ENV: mode, ...CLAUDE }, /required/);
    assert.equal(resolveCheckCostCap({ NODE_ENV: mode, ...CLAUDE, SYLLABUS_CHECK_REPLAN_MAX_COST_USD: '10' }), 10);
    assert.equal(resolveCheckCostCap({ NODE_ENV: mode, SYLLABUS_CHECK_AI_PROVIDER: 'off' }), null, 'no AI provider: no AI cost, nothing to limit');
  }
});

test('development keeps working without one, and a malformed limit is refused in every mode', () => {
  assert.equal(resolveCheckCostCap({ ...CLAUDE }), null);
  assert.equal(resolveCheckCostCap({ ...CLAUDE, SYLLABUS_CHECK_REPLAN_MAX_COST_USD: '2.50' }), 2.5);
  for (const bad of ['0', '-1', 'ten', '10abc', '1001', 'Infinity']) {
    for (const mode of ['', 'staging']) capProblem({ NODE_ENV: mode, ...CLAUDE, SYLLABUS_CHECK_REPLAN_MAX_COST_USD: bad }, /above 0/);
  }
});

test('the old SYLLABUS_CHECK_AI_MAX_COST_USD no longer counts: it limited nothing once the old checker was removed, so it cannot stand in for the real cap', () => {
  for (const mode of ['staging', 'production']) capProblem({ NODE_ENV: mode, ...CLAUDE, SYLLABUS_CHECK_AI_MAX_COST_USD: '10' }, /required/);
  assert.equal(resolveCheckCostCap({ ...CLAUDE, SYLLABUS_CHECK_AI_MAX_COST_USD: 'not a number' }), null, 'ignored, even when malformed');
});

test('server/index.js checks the per-check spending limit before it listens', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'index.js'), 'utf8');
  const check = source.indexOf('resolveCheckCostCap(process.env)'), listen = source.indexOf('app.listen(');
  assert.ok(check > 0 && check < listen);
});
