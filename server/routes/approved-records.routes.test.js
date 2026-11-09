'use strict';
// Approved syllabi are protected: a subject or an account they depend on cannot be deleted either.
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { CODE, approvedOfCourse, approvedTiedToAccount, syllabusRefused } = require('../lib/approvedRecords');

function makeDb({ syllabi = [], tied = [], users = [{ user_id: 7, role: 'faculty' }, { user_id: 1, role: 'admin' }] } = {}) {
  const s = { syllabi, tied, users, courses: [{ course_id: 10 }], deleted: [], locks: [], open: false, rolledBack: 0, committed: 0, activity: [] }; // activity: account_activity rows (lib/accountActivity.js)
  const query = async (sql, p = []) => {
    const q = sql.trim();
    if (q.startsWith('SELECT user_id FROM users WHERE user_id')) return [s.users.filter((u) => u.user_id === p[0])];
    if (/^SELECT syllabus_id AS id, course_code AS code, title, status FROM syllabi WHERE course_id = \? FOR UPDATE/.test(q)) { s.locks.push('course-syllabi'); return [s.syllabi.filter((r) => r.course_id === p[0])]; }
    if (q === 'SELECT syllabus_id FROM syllabi FOR UPDATE') { s.locks.push('all-syllabi'); return [s.syllabi.map((r) => ({ syllabus_id: r.id }))]; }
    if (q.startsWith("SELECT s.syllabus_id AS id, s.course_code AS code, s.title FROM syllabi s WHERE s.status = 'approved'")) { assert.equal(s.locks.at(-1), 'all-syllabi', 'the locks come first'); return [s.tied]; }
    if (q.startsWith('DELETE FROM users')) { assert.equal(s.open, true); s.deleted.push(['users', p[0]]); const before = s.users.length; s.users = s.users.filter((u) => String(u.user_id) !== String(p[0])); return [{ affectedRows: before - s.users.length }]; }
    if (q.startsWith('SELECT first_name, last_name FROM users WHERE user_id')) return [s.users.filter((u) => u.user_id === p[0]).map((u) => ({ first_name: u.first_name, last_name: u.last_name }))];
    if (q.startsWith('INSERT INTO account_activity')) { const [user_id, action, , subject] = p; s.activity.push({ user_id, action, subject }); return [{}]; }
    throw new Error('Unexpected SQL: ' + q);
  };
  const conn = { query, beginTransaction: async () => { s.open = true; }, commit: async () => { s.open = false; s.committed++; }, rollback: async () => { s.open = false; s.rolledBack++; }, release() {} };
  return { s, query, getConnection: async () => conn };
}
const approved = { id: 5, code: 'IT 101', title: 'Approved', status: 'approved', course_id: 10 };
const draft = { id: 6, code: 'IT 101', title: 'Draft', status: 'draft', course_id: 10 };

test('the subject check locks every syllabus of the subject and reports only the approved ones', async () => {
  const db = makeDb({ syllabi: [approved, draft] });
  assert.deepEqual((await approvedOfCourse(db, 10)).map((r) => r.id), [5]);
  assert.deepEqual(db.s.locks, ['course-syllabi']);
});

test('the account check locks the syllabi first, in a statement of its own, then reads them', async () => {
  const db = makeDb({ syllabi: [approved], tied: [{ id: 5, code: 'IT 101', title: 'Approved' }] });
  assert.deepEqual((await approvedTiedToAccount(db, 7)).map((r) => r.id), [5]);
  assert.deepEqual(db.s.locks, ['all-syllabi']);
});

test('the refusal is a 409 with the protected-record code', () => {
  const error = syllabusRefused();
  assert.equal(error.status, 409);
  assert.equal(error.body.code, CODE);
  assert.equal(CODE, 'approved_records_protected');
});

async function withUsers(db, fn) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.session = { user: req.headers['x-user'] ? JSON.parse(req.headers['x-user']) : undefined }; next(); });
  app.locals.db = db;
  app.use('/users', require('./users'));
  const server = await new Promise((resolve) => { const handle = app.listen(0, () => resolve(handle)); });
  const call = async (path, user = { id: 1, role: 'admin' }) => {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/users' + path, { method: 'DELETE', headers: { 'x-user': JSON.stringify(user) } });
    return { status: response.status, body: await response.json() };
  };
  try { await fn(call); } finally { await new Promise((resolve) => server.close(resolve)); }
}

test('an account an approved syllabus depends on is refused, with a count, and stays', () => {
  const db = makeDb({ syllabi: [approved], tied: [{ id: 5, code: 'IT 101', title: 'Approved' }] });
  return withUsers(db, async (call) => {
    const r = await call('/7');
    assert.equal(r.status, 409);
    assert.equal(r.body.code, CODE);
    assert.equal(r.body.count, 1);
    assert.match(r.body.error, /This account cannot be deleted\. Approved syllabi that depend on it: 1\./);
    assert.deepEqual(db.s.deleted, []);
    assert.equal(db.s.rolledBack, 1);
    assert.equal(db.s.committed, 0);
  });
});

test('an account nothing approved depends on is still deleted', () => {
  const db = makeDb({ syllabi: [draft] });
  return withUsers(db, async (call) => {
    assert.equal((await call('/7')).status, 200);
    assert.deepEqual(db.s.deleted, [['users', '7']]);
    assert.equal(db.s.committed, 1);
  });
});

test('deleting an account that does not exist is still a 404, and faculty still cannot delete accounts', () => {
  const db = makeDb();
  return withUsers(db, async (call) => {
    assert.equal((await call('/99')).status, 404);
    assert.equal((await call('/7', { id: 7, role: 'faculty' })).status, 403);
  });
});

// Recent Activity for transparency (lib/accountActivity.js): removing an account is recorded on the administrator, naming it (read before it is gone).
// A refused or unknown removal records nothing.
test('removing an account is recorded on the administrator by name; a refused or unknown one is not', () => {
  const db = makeDb({ syllabi: [draft], users: [{ user_id: 7, role: 'faculty', first_name: 'Fay', last_name: 'Flores' }, { user_id: 8, role: 'faculty', first_name: 'Gus', last_name: 'Go' }, { user_id: 1, role: 'admin' }] });
  return withUsers(db, async (call) => {
    assert.equal((await call('/99')).status, 404);
    db.s.tied = [{ id: 5, code: 'IT 101', title: 'Approved' }];
    assert.equal((await call('/8')).status, 409);
    db.s.tied = [];
    assert.equal((await call('/7')).status, 200);
    assert.deepEqual(db.s.activity, [{ user_id: 1, action: 'user_delete', subject: 'Fay Flores' }]);
  });
});
