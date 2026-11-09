process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'existing-suite-test-secret-0123456789'; // verification tokens are signed only with a configured secret
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const repo = require('../lib/syllabuscheck/repository');
const { align, NEMOTRON_FREE, promptVersionOf } = require('../lib/syllabuscheck/gemini');
const { sample } = require('../lib/syllabuscheck/fixtures');

const ENV = { SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-only-router-key', OPENROUTER_MODEL: NEMOTRON_FREE };
const reply = (content) => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }) });
// The pretend judge from refine.test.js: a CLO-PO relationship is a problem until its text carries [fit]; [bad] anywhere is a problem.
const verdict = (pair) => {
  const text = pair.source + ' ' + pair.target;
  const problem = text.includes('[bad]') || (pair.type === 'CLO-PO' && !text.includes('[fit]'));
  return { id: pair.id, label: problem ? 'NOT_ALIGNED' : 'ALIGNED', explanation: problem ? 'Does not fit.' : 'Fits.', sourceQuote: pair.source.slice(0, 6), targetQuote: pair.target.slice(0, 6), sourceBloom: 'Apply', targetBloom: 'Apply', draft: problem ? 'A draft.' : '' };
};
const network = (calls) => async (url, request) => {
  calls.push(url);
  const payload = JSON.parse(JSON.parse(request.body).messages[1].content).document_data;
  return Array.isArray(payload) ? reply({ judgements: payload.map(verdict) }) : reply({ text: 'rewritten [fit]' });
};

// aiChecking: the administrator's switch as saved (lib/adminSettings.js); left out, the settings are not readable here and AI checking counts as on.
async function harness(t, { status = 'draft', aiChecking } = {}) {
  const saved = {};
  for (const [key, value] of Object.entries(ENV)) { saved[key] = process.env[key]; process.env[key] = value; }
  t.after(() => { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });

  const { content, masters } = sample();
  const original = content.clos[0].statement;
  const calls = [];
  t.mock.method(globalThis, 'fetch', network(calls));
  const alignment = await align(content, masters, { env: ENV, transport: network([]) });
  const suggestion = { id: 'SEM:clo0', path: 'clos[0].statement', source: 'ai', originalValue: original, replacement: original + ' [fit]' };
  const report = { hybrid: { alignment, suggestions: [suggestion] } };
  t.mock.method(repo, 'readReport', async () => report);
  t.mock.method(repo, 'mastersFor', async () => masters);
  // The route imports readReport when it loads, so load it after the mock.
  delete require.cache[require.resolve('./syllabusCheck')];
  const app = express(); app.use(express.json());
  app.locals.db = { query: async (sql, params) => {
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
  const realFetch = require('node:http');
  // fetch is mocked for the AI; the test's own requests go through http so they are not intercepted.
  const call = (role, id = 'SEM:clo0') => new Promise((resolve, reject) => {
    const request = realFetch.request(base + encodeURIComponent(id) + '/refine', { method: 'POST', headers: role ? { 'x-test-role': role } : {} }, (response) => {
      let body = ''; response.on('data', (c) => { body += c; }); response.on('end', () => resolve({ status: response.statusCode, body: body ? JSON.parse(body) : {} }));
    });
    request.on('error', reject); request.end();
  });
  return { call, calls, report, suggestion, original };
}

test('the author gets a verified rewrite back, and nothing is saved', async (t) => {
  const { call, calls, suggestion } = await harness(t);
  const before = calls.length;
  const res = await call('faculty');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.status, 'verified');
  assert.equal(res.body.text, suggestion.replacement);
  assert.equal(res.body.usedRewrite, false);
  assert.ok(res.body.stats.improved > 0 && res.body.stats.worse === 0);
  assert.ok(calls.length > before, 'the AI was asked about the relationships the rewrite touches');
});

test('the administrator and other people cannot ask for one, and nothing is sent to the AI for them', async (t) => {
  const { call, calls } = await harness(t, { status: 'under_review' });
  const before = calls.length;
  const admin = await call('admin');
  assert.equal(admin.status, 403);
  assert.match(admin.body.error, /Only the author/);
  assert.equal((await call('other')).status, 404);
  assert.equal((await call(null)).status, 401);
  assert.equal(calls.length, before);
});

test('a locked syllabus, an unknown recommendation or an older checker version is refused before any AI request', async (t) => {
  const locked = await harness(t, { status: 'submitted' });
  const before = locked.calls.length;
  assert.equal((await locked.call('faculty')).status, 409);
  assert.equal(locked.calls.length, before);
});

test('an unknown recommendation and a check from an older checker version are refused', async (t) => {
  const { call, calls, report } = await harness(t);
  const before = calls.length;
  assert.equal((await call('faculty', 'SEM:nope')).status, 400);
  report.hybrid.alignment.promptVersion = promptVersionOf(NEMOTRON_FREE) + '-old';
  const old = await call('faculty');
  assert.equal(old.status, 409);
  assert.match(old.body.error, /older checker version/);
  assert.equal(calls.length, before);
});

test('an AI provider failure is a 502 with the reason, not a verdict', async (t) => {
  const { call } = await harness(t);
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 429, json: async () => ({}) }));
  const res = await call('faculty');
  assert.equal(res.status, 502);
  assert.match(res.body.error, /429/);
});

// The administrator turned AI checking off (Settings > AI & Notifications; lib/adminSettings.js): checking a recommendation is only an AI request,
// so it is refused before anything is sent. With AI checking on it works as before.
test('with AI checking turned off in Settings, checking a recommendation is refused and nothing is sent to the AI', async (t) => {
  const { call, calls } = await harness(t, { aiChecking: false });
  const before = calls.length;
  const res = await call('faculty');
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'ai_checking_off');
  assert.match(res.body.error, /AI compliance checking is turned off in Settings/);
  assert.equal(calls.length, before, 'no AI request');
});

test('with AI checking on in Settings the author still gets a verified rewrite', async (t) => {
  const { call } = await harness(t, { aiChecking: true });
  const res = await call('faculty');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.status, 'verified');
});
