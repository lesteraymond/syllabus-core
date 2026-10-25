// HTTP-level tests for what a student may read (GET /api/students/syllabi and /syllabi/:id): approved syllabi only, the newest of each
// subject, and the student's own major subjects. In-memory fake database, session user from the x-test-user header.
// Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');

const row = (id, status, code, extra = {}) => ({ syllabus_id: id, user_id: 5, status, version: 'v1.0', title: 'Title ' + id, course_code: code, file_path: null, content: null, updated_at: '2026-01-0' + id, first_name: 'Fay', last_name: 'F', course_title: null, program_code: 'BSIT', program_name: 'BSIT', curriculum_program: null, ...extra });

function makeDb() {
  const s = {
    syllabi: {
      1: row(1, 'approved', 'IT 401'),
      2: row(2, 'approved', 'IT-401', { version: 'v1.1' }), // newer version of the same subject
      3: row(3, 'draft', 'IT 402'),
      4: row(4, 'under_review', 'IT 403'),
      5: row(5, 'submitted', 'CAPSPRO 2'),
      6: row(6, 'approved', 'IT 301', { content: JSON.stringify({ meta: { program: 'BSIT' } }) }),
      7: row(7, 'approved', 'GE 101'),
    },
    enrolled: [
      { subject_code: 'IT-401', subject_title: 'Quantitative Methods' },
      { subject_code: 'IT-402', subject_title: 'Social and Professional Issues' },
      { subject_code: 'CAPSPRO 2', subject_title: 'Capstone Project 2' },
      { subject_code: 'TH 3', subject_title: 'Ecclesiology' },
    ],
  };
  const handle = (sql, p = []) => {
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [[{ user_id: p[0] }]]; // the auth middleware checks the user still exists
    if (sql.startsWith('SELECT s.syllabus_id, s.title, s.course_code, s.version, s.updated_at')) {
      assert.ok(sql.includes("s.status = 'approved'"), 'the student list must be filtered to approved in the query');
      return [Object.values(s.syllabi).filter((x) => x.status === 'approved').sort((a, b) => b.syllabus_id - a.syllabus_id)];
    }
    if (sql.startsWith('SELECT s.syllabus_id, s.title, s.course_code, s.version, s.file_path')) {
      assert.ok(sql.includes("s.status = 'approved'"), 'one syllabus must be filtered to approved in the query');
      const x = s.syllabi[p[0]];
      return [x && x.status === 'approved' ? [x] : []];
    }
    if (sql.startsWith('SELECT subject_code, subject_title FROM student_enrollments')) return [s.enrolled];
    throw new Error('unexpected query: ' + sql);
  };
  return { s, query: async (q, p) => handle(q, p) };
}

async function withServer(fn) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { const h = req.headers['x-test-user']; req.session = h ? { user: JSON.parse(h) } : {}; next(); });
  app.locals.db = makeDb();
  app.use('/api/students', require('./students'));
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const base = `http://127.0.0.1:${server.address().port}/api/students`;
  const call = async (as, path, method = 'GET') => {
    const res = await fetch(base + path, { method, headers: as ? { 'x-test-user': JSON.stringify(as) } : {} });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  try { await fn({ call }); } finally { await new Promise((r) => server.close(r)); }
}

const student = { id: 9, role: 'student', firstName: 'Stu', lastName: 'Dent' };
const faculty = { id: 5, role: 'faculty', firstName: 'Fay', lastName: 'F' };

test('a student sees only approved syllabi, the newest of each subject', () => withServer(async ({ call }) => {
  const r = await call(student, '/syllabi');
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.body.syllabi.map((x) => x.id).sort((a, b) => a - b), [2, 6, 7]); // 1 is older than 2; drafts and ones in review never appear
  const one = r.body.syllabi.find((x) => x.id === 2);
  assert.strictEqual(one.version, 'v1.1');
  assert.ok(!('adminComment' in one) && !('filePath' in one) && !('userId' in one));
}));

test('my subjects are the student\'s major subjects, each with its syllabus or null', () => withServer(async ({ call }) => {
  const r = await call(student, '/syllabi');
  assert.deepStrictEqual(r.body.mySubjects, [
    { code: 'IT-401', title: 'Quantitative Methods', syllabusId: 2 },
    { code: 'IT-402', title: 'Social and Professional Issues', syllabusId: null }, // its syllabus is still a draft
    { code: 'CAPSPRO 2', title: 'Capstone Project 2', syllabusId: null }, // submitted, not approved yet
  ]); // TH 3 is not a major subject
}));

test('a student can open an approved syllabus but a draft or one in review is a 404', () => withServer(async ({ call }) => {
  const ok = await call(student, '/syllabi/6');
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.body.syllabus.courseCode, 'IT 301');
  assert.deepStrictEqual(ok.body.content, { meta: { program: 'BSIT' } });
  for (const id of [3, 4, 5, 99]) assert.strictEqual((await call(student, '/syllabi/' + id)).status, 404, 'syllabus ' + id);
  assert.strictEqual((await call(student, '/syllabi/abc')).status, 404);
}));

test('only a signed-in student may use these routes', () => withServer(async ({ call }) => {
  assert.strictEqual((await call(null, '/syllabi')).status, 401);
  assert.strictEqual((await call(faculty, '/syllabi')).status, 403);
  assert.strictEqual((await call(faculty, '/syllabi/6')).status, 403);
}));

test('the student routes only read: nothing can be written through them', () => withServer(async ({ call }) => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.strictEqual((await call(student, '/syllabi/6', method)).status, 404, method);
}));
