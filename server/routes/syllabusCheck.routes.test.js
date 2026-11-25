const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const repo = require('../lib/syllabuscheck/repository');

test('only the author records a decision, and only while the syllabus is editable; the administrator and other faculty cannot', async t => {
  const original = { meta: { program: 'BSIE' }, plan: [{ tasks: 'Old quiz' }] };
  const writes = [];
  const activity = [];
  let status = 'draft';
  let runBy = 26; // who ran the check: each person reaches only their own checks (2026-11-24)
  const suggestion = { id: 'SEM:pair1', path: 'plan[0].tasks', replacement: 'Design and demonstrate a tested program.' };
  t.mock.method(repo, 'readReport', async () => ({ hybrid: { alignment: { status: 'completed', engine: 're-planned' }, suggestions: [suggestion] } })) // a report of the new AI Checker (decisions on an old-checker report are refused);
  // Route imports readReport by reference when loaded, so patch before requiring it.
  delete require.cache[require.resolve('./syllabusCheck')];
  const app = express(); app.use(express.json());
  app.locals.db = { query: async (sql, params) => {
    if (sql.startsWith('SELECT user_id FROM users')) return [[{ user_id: params[0] }]];
    if (sql.startsWith('SELECT s.*, r.run_id')) return [[{ syllabus_id: 100, user_id: 26, status, content: JSON.stringify(original), run_id: 1, run_created_by: runBy }]];
    if (sql.startsWith('SELECT decision_id')) return [[]];
    if (sql.startsWith('INSERT INTO submission_logs')) { activity.push({ syllabusId: params[0], userId: params[1], action: params[2], notes: params[3] }); return [{ insertId: activity.length }]; }
    if (sql.startsWith('INSERT INTO syllabus_check_decisions')) { writes.push(params); return [{ insertId: writes.length }]; }
    if (/program_po_reference_remediation/.test(sql)) return [[]];
    throw Error('Unexpected mutation/query: ' + sql);
  } };
  app.use((req, res, next) => { const who = req.headers['x-test-role']; req.session = who ? { user: { id: who === 'admin' ? 1 : who === 'other' ? 27 : 26, role: who === 'admin' ? 'admin' : 'faculty' } } : {}; next(); });
  app.use('/api/syllabus-check', require('./syllabusCheck'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/syllabus-check/runs/1/decisions`;
  const call = async (role, body) => {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(role ? { 'x-test-role': role } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const accepted = await call('faculty', { suggestionId: suggestion.id, action: 'accept' });
  assert.equal(accepted.status, 201);
  assert.deepEqual(accepted.body.draft, { path: suggestion.path, replacement: suggestion.replacement });
  const edited = await call('faculty', { suggestionId: suggestion.id, action: 'edit', editedText: 'Construct a program and explain its test results.' });
  assert.equal(edited.body.draft.replacement, 'Construct a program and explain its test results.');
  assert.equal((await call('faculty', { suggestionId: suggestion.id, action: 'reject' })).body.draft, null);
  assert.equal(writes.length, 3);

  // The administrator cannot open the author's check at all (each person reaches only their own checks) ...
  status = 'under_review';
  assert.equal((await fetch(url, { headers: { 'x-test-role': 'admin' } })).status, 404, 'the author\'s check is not the administrator\'s to read');
  // ... and on their own check of the submitted version can read the recommendations but cannot accept, edit or reject them.
  runBy = 1;
  for (const action of ['accept', 'reject']) {
    const refused = await call('admin', { suggestionId: suggestion.id, action });
    assert.equal(refused.status, 403, action);
    assert.match(refused.body.error, /Only the author/);
  }
  assert.equal((await call('admin', { suggestionId: suggestion.id, action: 'edit', editedText: 'An admin rewrite.' })).status, 403);
  const read = await fetch(url, { headers: { 'x-test-role': 'admin' } });
  assert.equal(read.status, 200, 'the administrator can read the decisions on their own check');
  runBy = 26;

  // Once the author has submitted, a decision cannot be recorded any more either (the syllabus is locked).
  const locked = await call('faculty', { suggestionId: suggestion.id, action: 'accept' });
  assert.equal(locked.status, 409);

  status = 'draft';
  assert.equal((await call('other', { suggestionId: suggestion.id, action: 'accept' })).status, 404);
  assert.equal((await call(null, { suggestionId: suggestion.id, action: 'accept' })).status, 401);
  assert.equal((await call('faculty', { suggestionId: suggestion.id, action: 'accept' })).status, 201);
  assert.equal((await call('faculty', { suggestionId: 'invented', action: 'accept' })).status, 400);
  assert.equal(writes.length, 4, 'nothing the administrator or another person sent was written');
  // Each decision the author made is in their activity log, worded by what they did; refused ones are not.
  assert.deepEqual(activity.map(a => [a.syllabusId, a.userId, a.action, a.notes]), [
    [100, 26, 'recommend', 'Accepted recommendation: plan[0].tasks'],
    [100, 26, 'recommend', 'Edited and applied recommendation: plan[0].tasks'],
    [100, 26, 'recommend', 'Rejected recommendation: plan[0].tasks'],
    [100, 26, 'recommend', 'Accepted recommendation: plan[0].tasks'],
  ]);
  assert.equal(original.plan[0].tasks, 'Old quiz');
});

test('a recommendation the save did not keep (the administrator sets the field on the subject) is not recorded as applied', async t => {
  const stored = { meta: { title: 'DATA STRUCTURES AND ALGORITHM', prereq: 'IT 102' }, plan: [{ tasks: 'Old quiz' }] };
  const title = { id: 'CUR-FIELD:meta.title', path: 'meta.title', replacement: 'DATA STRUCTURE AND ALGORITHM' };
  const tasks = { id: 'SEM:pair1', path: 'plan[0].tasks', replacement: 'Design a tested program.' };
  const writes = [];
  t.mock.method(repo, 'readReport', async () => ({ hybrid: { alignment: { status: 'completed', engine: 're-planned' }, suggestions: [title, tasks] } }));
  delete require.cache[require.resolve('./syllabusCheck')];
  const app = express(); app.use(express.json());
  app.locals.db = { query: async (sql, params) => {
    if (sql.startsWith('SELECT user_id FROM users')) return [[{ user_id: params[0] }]];
    if (sql.startsWith('SELECT s.*, r.run_id')) return [[{ syllabus_id: 100, user_id: 26, status: 'draft', content: JSON.stringify(stored), run_id: 1, run_created_by: 26 }]];
    if (sql.startsWith('INSERT INTO submission_logs')) return [{ insertId: 1 }];
    if (sql.startsWith('INSERT INTO syllabus_check_decisions')) { writes.push(params); return [{ insertId: writes.length }]; }
    if (/program_po_reference_remediation/.test(sql)) return [[]];
    throw Error('Unexpected mutation/query: ' + sql);
  } };
  app.use((req, res, next) => { req.session = { user: { id: 26, role: 'faculty' } }; next(); });
  app.use('/api/syllabus-check', require('./syllabusCheck'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const call = async body => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/syllabus-check/runs/1/decisions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const refused = await call({ suggestionId: title.id, action: 'accept' });
  assert.equal(refused.status, 409); assert.equal(refused.body.code, 'admin_field'); assert.match(refused.body.error, /administrator/);
  assert.equal((await call({ suggestionId: title.id, action: 'edit', editedText: 'DATA STRUCTURE AND ALGORITHMS' })).status, 409, 'an edited text the save did not keep either');
  assert.equal(writes.length, 0, 'nothing is recorded as applied');
  assert.equal((await call({ suggestionId: title.id, action: 'reject' })).status, 201, 'the author can still set it aside');
  assert.equal((await call({ suggestionId: tasks.id, action: 'accept' })).status, 201, 'a field the author owns is recorded as before');
  stored.meta.title = 'DATA STRUCTURE AND ALGORITHM';
  assert.equal((await call({ suggestionId: title.id, action: 'accept' })).status, 201, 'the subject was corrected: the saved title is the recommended one');
});
