'use strict';
// A student reads only: every approved syllabus (their own subjects marked), nothing else (routes/students.js GET /syllabi and /syllabi/:id).
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const students = require('./students');

const SYLLABI = [
  { syllabus_id: 3, course_id: 20, course_code: 'IT 101', title: 'Intro', version: 'v1.0', file_path: null, content: '{}', updated_at: '2026-08-01', first_name: 'Gus', last_name: 'G', uploaded_at: 0, program_code: 'BSIT' },
  { syllabus_id: 1, course_id: 10, course_code: 'FM 202', title: 'Fundamentals', version: 'v1.1', file_path: null, content: '{"meta":{"courseId":10}}', updated_at: '2026-10-01', first_name: 'Fay', last_name: 'F', uploaded_at: 2 },
  { syllabus_id: 2, course_id: 10, course_code: 'FM 202', title: 'Fundamentals', version: 'v1.0', file_path: null, content: '{}', updated_at: '2026-09-01', first_name: 'Fay', last_name: 'F', uploaded_at: 1 },
];

// The fake database applies the three conditions the route's SQL states: approved, not archived, and a subject on the student's own COR.
function withServer(role, fn) {
  const queries = [];
  const db = { query: async (sql, params) => {
    if (/FROM users WHERE user_id = \?/.test(sql) && !/FROM syllabi/.test(sql)) return [[{ user_id: 7 }]]; // the sign-in check of requireAuth
    if (/FROM academic_years/.test(sql)) throw Object.assign(new Error("Table 'academic_years' doesn't exist"), { code: 'ER_NO_SUCH_TABLE' });
    if (/FROM courses c/.test(sql)) return [[]]; // the subject lookup for the outcomes snapshot: not found here, so none is built
    queries.push({ sql, params });
    assert.ok(/s.status = 'approved'/.test(sql) && /s.archived_at IS NULL/.test(sql), 'the read is limited in SQL to approved, not archived');
    const own = new Set([10]);
    const rows = SYLLABI.filter((s) => !/s.syllabus_id = ?/.test(sql) || s.syllabus_id === params[1]).map((s) => ({ ...s, enrolled: own.has(s.course_id) ? 1 : 0 })).sort((a, b) => b.uploaded_at - a.uploaded_at);
    return [rows];
  } };
  const app = express();
  app.locals.db = db;
  app.use((req, res, next) => { req.session = { user: { id: 7, role } }; next(); });
  app.use('/api/students', students);
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      const get = (path) => new Promise((ok) => http.get({ port: server.address().port, path: '/api/students' + path, agent: false }, (res) => { let b = ''; res.on('data', (c) => { b += c; }); res.on('end', () => ok({ status: res.statusCode, body: b ? JSON.parse(b) : null })); }));
      try { resolve(await fn(get, queries)); } catch (e) { reject(e); } finally { server.closeAllConnections(); server.close(); }
    });
  });
}

test('a student lists every approved syllabus, the newest of each subject, and marks their own subjects', () => withServer('student', async (get, queries) => {
  const r = await get('/syllabi');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.syllabi.map((s) => [s.id, s.courseCode, s.version, s.enrolled]), [[1, 'FM 202', 'v1.1', true], [3, 'IT 101', 'v1.0', false]], 'one per subject, the newest');
  assert.ok(!('content' in r.body.syllabi[0]), 'the list carries no content');
  assert.deepEqual(queries[0].params, [7], 'the student id only marks their subjects');
}));

test('a student opens one syllabus of their subject, with its content', () => withServer('student', async (get) => {
  const r = await get('/syllabi/1');
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.syllabus.id, r.body.content.meta.courseId, r.body.file], [1, 10, null]);
}));

test('a syllabus that is not theirs to read, or not there, is the same 404', () => withServer('student', async (get) => {
  assert.equal((await get('/syllabi/99')).status, 404);
  assert.equal((await get('/syllabi/abc')).status, 404);
}));

test('only a student may use these routes', () => withServer('faculty', async (get, queries) => {
  assert.equal((await get('/syllabi')).status, 403);
  assert.equal((await get('/syllabi/1')).status, 403);
  assert.equal(queries.length, 0, 'nothing was read');
}));
