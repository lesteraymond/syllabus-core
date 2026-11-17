'use strict';
// POST /api/syllabus-check/runs/:id/suggestions/:suggestionId/refine for a report the re-planned checker made (official mode). Before the fix the route
// compared the report's prompt version ('replan-prompt-N') with the OLD checker's and refused every new-checker draft with 409 "made by an older checker
// version"; with that check out of the way it would have sent the draft to the old checker. Offline: a test-only key, a mocked database and a mocked
// new-checker refine; no request leaves the process.
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'existing-suite-test-secret-0123456789'; // verification tokens are signed with it
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

const repo = require('../repository');
const { sample } = require('../fixtures');
const oldRefine = require('../refine');
const replanRefine = require('./refine');
const P = require('./prompt');

const ENV = {
  SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-ant-test-only-replan-refine-not-a-real-key', ANTHROPIC_MODEL: 'claude-sonnet-5-5',
  SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: 'claude-sonnet-5-5', SYLLABUS_CHECK_REPLAN: 'official', SYLLABUS_CHECK_REPLAN_MAX_COST_USD: '2',
};

async function harness(t, { env = ENV } = {}) {
  const saved = {};
  for (const [k, v] of Object.entries(env)) { saved[k] = process.env[k]; process.env[k] = v; }
  t.after(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
  const { content, masters } = sample();
  const app = express();
  app.use(express.json());
  app.locals.db = {
    query: async (sql, params = []) => {
      if (/program_po_reference_remediation/.test(sql)) return [[]];
      if (sql.startsWith('SELECT user_id FROM users')) return [[{ user_id: params[0] }]];
      if (sql.startsWith('SELECT s.*, r.run_id')) return [[{ syllabus_id: 100, user_id: 26, status: 'draft', content: JSON.stringify(content) }]];
      if (sql.startsWith('INSERT INTO')) return [{ insertId: 1, affectedRows: 1 }];
      throw new Error('Unhandled query in mock db: ' + sql);
    },
  };
  let report = null;
  t.mock.method(repo, 'readReport', async () => report);
  t.mock.method(repo, 'mastersFor', async () => masters);
  app.use((req, res, next) => { req.session = { user: { id: 26, role: 'faculty' } }; next(); });
  delete require.cache[require.resolve('../../../routes/syllabusCheck')];
  app.use('/api/syllabus-check', require('../../../routes/syllabusCheck'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/syllabus-check`;
  const post = (p, body = {}) => new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(base + p, { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } }, res => {
      let data = ''; res.on('data', c => { data += c; }); res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
    });
    req.on('error', reject); req.end(payload);
  });
  const get = p => new Promise((resolve, reject) => {
    http.get(base + p, res => { let data = ''; res.on('data', c => { data += c; }); res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null })); }).on('error', reject);
  });
  return { content, masters, post, get, setReport: r => { report = r; } };
}

const draftOf = content => ({ id: 'RP:ilo:' + content.plan[2].ilos[0].id, path: 'plan[2].ilos[0].text', replacement: 'Apply topic 3 in a short guided exercise', originalValue: content.plan[2].ilos[0].text, source: 'ai', verification: 'VERIFIED' });
const replannedReport = (suggestion, promptVersion = P.PROMPT_VERSION) => ({ hybrid: { alignment: { status: 'completed', provider: 'anthropic', model: 'claude-sonnet-5-5', engine: 're-planned', promptVersion, judgements: [] }, suggestions: [suggestion] } });

test('a new-checker draft goes to the new checker\'s Check & improve, never to the old checker, and a verified answer gets a token', async t => {
  const h = await harness(t);
  const draft = draftOf(h.content);
  h.setReport(replannedReport(draft));
  const calls = [];
  t.mock.method(replanRefine, 'refineDraft', async args => { calls.push(args); return { status: 'verified', usedRewrite: false, text: args.suggestion.replacement, stats: { checked: 3, improved: 1, worse: 0, same: 2, unverified: 0, points: -1 }, blockers: [], engine: 're-planned' }; });
  const old = t.mock.method(oldRefine, 'refineSuggestion', async () => { throw Error('the old checker must not be used'); });
  const res = await h.post(`/runs/7/suggestions/${encodeURIComponent(draft.id)}/refine`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.status, 'verified');
  assert.equal(res.body.engine, 're-planned');
  assert.equal(typeof res.body.verificationToken, 'string');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].suggestion.id, draft.id);
  assert.equal(old.mock.callCount(), 0);
});

test('the author\'s edit is what the new checker checks', async t => {
  const h = await harness(t);
  const draft = draftOf(h.content);
  h.setReport(replannedReport(draft));
  let seen;
  t.mock.method(replanRefine, 'refineDraft', async args => { seen = args.suggestion; return { status: 'blocked', usedRewrite: false, text: args.suggestion.replacement, stats: { checked: 1, improved: 0, worse: 1, same: 0, unverified: 0, points: 2 }, blockers: [{ id: 'x', type: 'ILO-CLO', from: 'ALIGNED', to: 'NOT_ALIGNED', why: '' }], engine: 're-planned' }; });
  const res = await h.post(`/runs/7/suggestions/${encodeURIComponent(draft.id)}/refine`, { editedText: 'My own wording of the outcome' });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'blocked');
  assert.equal(res.body.verificationToken, undefined, 'no token for a blocked draft');
  assert.equal(seen.replacement, 'My own wording of the outcome');
  assert.equal(seen.userEdited, true);
});

test('a new-checker report from an older new-checker prompt must be checked again first', async t => {
  const h = await harness(t);
  const draft = draftOf(h.content);
  h.setReport(replannedReport(draft, 'replan-prompt-1'));
  const called = t.mock.method(replanRefine, 'refineDraft', async () => { throw Error('must not be called'); });
  const res = await h.post(`/runs/7/suggestions/${encodeURIComponent(draft.id)}/refine`);
  assert.equal(res.status, 409);
  assert.match(res.body.error, /older checker version/);
  assert.equal(called.mock.callCount(), 0);
});

test('a new-checker report while the new checker is switched off is refused before any AI request', async t => {
  const h = await harness(t, { env: { ...ENV, SYLLABUS_CHECK_REPLAN: 'shadow' } });
  const draft = draftOf(h.content);
  h.setReport(replannedReport(draft));
  const called = t.mock.method(replanRefine, 'refineDraft', async () => { throw Error('must not be called'); });
  const res = await h.post(`/runs/7/suggestions/${encodeURIComponent(draft.id)}/refine`);
  assert.equal(res.status, 409);
  assert.match(res.body.error, /new AI Checker/);
  assert.equal(called.mock.callCount(), 0);
});

const oldReport = draft => { const { promptVersionOf } = require('../gemini'); return { hybrid: { alignment: { status: 'completed', provider: 'anthropic', model: 'claude-sonnet-5-5', promptVersion: promptVersionOf('claude-sonnet-5-5') }, suggestions: [draft], improvementPlan: { planId: 'old-plan', sourceHash: 'x', changes: [] } } }; };

test('the old AI Checker is retired: an old-checker report is refused by Check & improve and the improvement plan, and nothing reaches any AI', async t => {
  const h = await harness(t);
  const draft = { ...draftOf(h.content), id: 'SEM:old' };
  h.setReport(oldReport(draft));
  const newer = t.mock.method(replanRefine, 'refineDraft', async () => { throw Error('must not be called'); });
  const old = t.mock.method(oldRefine, 'refineSuggestion', async () => { throw Error('must not be called'); });
  const res = await h.post(`/runs/7/suggestions/${encodeURIComponent(draft.id)}/refine`);
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.code, 'old_checker_retired');
  assert.match(res.body.error || res.body.message || '', /old AI Checker, which is no longer used/);
  assert.equal(old.mock.callCount(), 0);
  assert.equal(newer.mock.callCount(), 0);
  const apply = await h.post('/runs/7/improvement-plan/apply', { planId: 'old-plan' });
  assert.equal(apply.status, 409, JSON.stringify(apply.body));
  assert.equal(apply.body.code, 'old_checker_retired');
});

test('the old Check & improve and improvement plan are removed: even with SYLLABUS_CHECK_LEGACY_AI=on an old-checker report is refused, and no report has a plan', async t => {
  process.env.SYLLABUS_CHECK_LEGACY_AI = 'on';
  t.after(() => { delete process.env.SYLLABUS_CHECK_LEGACY_AI; });
  const h = await harness(t);
  const draft = { ...draftOf(h.content), id: 'SEM:old' };
  h.setReport(oldReport(draft));
  const newer = t.mock.method(replanRefine, 'refineDraft', async () => { throw Error('must not be called'); });
  const old = t.mock.method(oldRefine, 'refineSuggestion', async () => { throw Error('must not be called'); });
  const res = await h.post(`/runs/7/suggestions/${encodeURIComponent(draft.id)}/refine`);
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.code, 'old_checker_retired');
  assert.equal(old.mock.callCount() + newer.mock.callCount(), 0);
  h.setReport(replannedReport(draftOf(h.content)));
  const plan = await h.get('/runs/7/improvement-plan');
  assert.equal(plan.status, 200);
  assert.equal(plan.body.plan, null);
  const apply = await h.post('/runs/7/improvement-plan/apply', {});
  assert.equal(apply.status, 409);
  assert.equal(apply.body.code, 'old_checker_retired');
});
