'use strict';
// POST /api/syllabus-check/runs/:id/suggestions/:suggestionId/refine ("Check & improve"): who may ask, the daily ceiling, the Settings switch and the refusals,
// for a draft of the new AI Checker (the only checker since the old one was removed). The new checker's refine is mocked and records each call: no request
// leaves the process.
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'existing-suite-test-secret-0123456789'; // verification tokens are signed only with a configured secret
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const repo = require('../lib/syllabuscheck/repository');
const replanRefine = require('../lib/syllabuscheck/pipeline/refine');
const P = require('../lib/syllabuscheck/pipeline/prompt');
const { sample } = require('../lib/syllabuscheck/fixtures');

const ENV = {
  SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-ant-test-only-refine-route-not-a-real-key', ANTHROPIC_MODEL: 'claude-sonnet-5-5',
  SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: 'claude-sonnet-5-5', SYLLABUS_CHECK_REPLAN: 'official', SYLLABUS_CHECK_REPLAN_MAX_COST_USD: '2',
};

// aiChecking: the administrator's switch as saved (lib/adminSettings.js); left out, the settings are not readable here and AI checking counts as on.
async function harness(t, { status = 'draft', aiChecking } = {}) {
  const saved = {};
  for (const [key, value] of Object.entries(ENV)) { saved[key] = process.env[key]; process.env[key] = value; }
  t.after(() => { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });

  const { content, masters } = sample();
  const original = content.clos[0].statement;
  const calls = [];
  t.mock.method(replanRefine, 'refineDraft', async ({ suggestion }) => { calls.push(suggestion.id); return { status: 'verified', usedRewrite: false, text: suggestion.replacement, stats: { checked: 2, improved: 1, worse: 0 } }; });
  const suggestion = { id: 'RP:clo:c1', path: 'clos[0].statement', source: 'ai', originalValue: original, replacement: original + ' (revised)' };
  const report = { hybrid: { alignment: { status: 'completed', provider: 'anthropic', model: 'claude-sonnet-5-5', engine: 're-planned', promptVersion: P.PROMPT_VERSION, judgements: [] }, suggestions: [suggestion] } };
  t.mock.method(repo, 'readReport', async () => report);
  t.mock.method(repo, 'mastersFor', async () => masters);
  // The route imports readReport when it loads, so load it after the mock.
  delete require.cache[require.resolve('./syllabusCheck')];
  const app = express(); app.use(express.json());
  app.locals.db = { query: async (sql, params) => {
    if (/program_po_reference_remediation/.test(sql)) return [[]];
    if (sql.startsWith('SELECT user_id FROM users')) return [[{ user_id: params[0] }]];
    if (sql.startsWith('SELECT s.*, r.run_id')) return [[{ syllabus_id: 100, user_id: 26, status, content: JSON.stringify(content) }]];
    if (aiChecking !== undefined && sql.includes("setting_key = 'administration'")) return [[{ setting_value: JSON.stringify({ aiChecking }) }]];
    throw Error('Unexpected query: ' + sql);
  } };
  app.use((req, res, next) => { const who = req.headers['x-test-role']; req.session = who ? { user: { id: who === 'admin' ? 1 : who === 'other' ? 27 : 26, role: who === 'admin' ? 'admin' : 'faculty' } } : {}; next(); });
  app.use('/api/syllabus-check', require('./syllabusCheck'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/syllabus-check/runs/1/suggestions/`;
  const http = require('node:http');
  const call = (role, id = suggestion.id) => new Promise((resolve, reject) => {
    const request = http.request(base + encodeURIComponent(id) + '/refine', { method: 'POST', headers: role ? { 'x-test-role': role } : {} }, (response) => {
      let body = ''; response.on('data', (c) => { body += c; }); response.on('end', () => resolve({ status: response.statusCode, body: body ? JSON.parse(body) : {} }));
    });
    request.on('error', reject); request.end();
  });
  return { call, calls, report, suggestion, original };
}

test('"Check & improve" is counted per person per day: past the ceiling it is 429 and nothing is sent to the AI', async (t) => {
  const quota = require('../lib/aiQuota');
  quota.setAiQuota(quota.createAiQuota({ checksPerUser: 1, checksTotal: 1, refinesPerUser: 1 }));
  t.after(() => quota.setAiQuota(null));
  const { call, calls } = await harness(t);
  assert.equal((await call('faculty')).status, 200);
  const before = calls.length;
  const refused = await call('faculty');
  assert.equal(refused.status, 429);
  assert.equal(refused.body.code, 'ai_daily_limit');
  assert.equal(calls.length, before, 'no AI request');
});

test('the author gets a verified rewrite back with a token, and nothing is saved', async (t) => {
  const { call, calls, suggestion } = await harness(t);
  const res = await call('faculty');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.status, 'verified');
  assert.equal(res.body.text, suggestion.replacement);
  assert.ok(res.body.verificationToken, 'a verified answer carries a token');
  assert.deepEqual(calls, [suggestion.id], 'the new checker checked it');
});

test('the administrator and other people cannot ask for one, and nothing is sent to the AI for them', async (t) => {
  const { call, calls } = await harness(t, { status: 'under_review' });
  const admin = await call('admin');
  assert.equal(admin.status, 403);
  assert.match(admin.body.error, /Only the author/);
  assert.equal((await call('other')).status, 404);
  assert.equal((await call(null)).status, 401);
  assert.equal(calls.length, 0);
});

test('a locked syllabus is refused before any AI request', async (t) => {
  const locked = await harness(t, { status: 'submitted' });
  assert.equal((await locked.call('faculty')).status, 409);
  assert.equal(locked.calls.length, 0);
});

test('an unknown recommendation, a check from an older checker version and an old-checker report are refused', async (t) => {
  const { call, calls, report } = await harness(t);
  assert.equal((await call('faculty', 'RP:nope')).status, 400);
  report.hybrid.alignment.promptVersion = 'replan-prompt-0';
  const older = await call('faculty');
  assert.equal(older.status, 409);
  assert.match(older.body.error, /older checker version/);
  delete report.hybrid.alignment.engine; // a report the old AI Checker made
  const old = await call('faculty');
  assert.equal(old.status, 409);
  assert.equal(old.body.code, 'old_checker_retired');
  assert.equal(calls.length, 0);
});

test('an AI provider failure is a 502 with the reason, not a verdict', async (t) => {
  const { call } = await harness(t);
  t.mock.method(replanRefine, 'refineDraft', async () => { throw Error('Anthropic API error 429'); });
  const res = await call('faculty');
  assert.equal(res.status, 502);
  assert.match(res.body.error, /429/);
});

// The administrator turned AI checking off (Settings > AI & Notifications; lib/adminSettings.js): checking a recommendation is only an AI request,
// so it is refused before anything is sent. With AI checking on it works as before.
test('with AI checking turned off in Settings, checking a recommendation is refused and nothing is sent to the AI', async (t) => {
  const { call, calls } = await harness(t, { aiChecking: false });
  const res = await call('faculty');
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'ai_checking_off');
  assert.match(res.body.error, /AI compliance checking is turned off in Settings/);
  assert.equal(calls.length, 0, 'no AI request');
});

test('with AI checking on in Settings the author still gets a verified rewrite', async (t) => {
  const { call } = await harness(t, { aiChecking: true });
  const res = await call('faculty');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.status, 'verified');
});
