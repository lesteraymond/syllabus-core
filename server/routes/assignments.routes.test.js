// HTTP-level tests for the assignment routes in routes/users.js, with an in-memory fake database and a stubbed
// session (the user comes from the x-test-user header). No MySQL needed. Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');

const USERS = {
  1: { user_id: 1, role: 'admin', first_name: 'Ada', last_name: 'Admin' },
  5: { user_id: 5, role: 'faculty', first_name: 'Fay', last_name: 'Faculty' },
  6: { user_id: 6, role: 'faculty', first_name: 'Gus', last_name: 'Faculty' },
};
const PROGRAMS = [{ program_id: 1, code: 'BSIT', name: 'BS Information Technology' }, { program_id: 2, code: 'BSIE', name: 'BS Industrial Engineering' }, { program_id: 3, code: 'BSEMC', name: 'BS Entertainment and Multimedia Computing' }];
const COURSES = [
  { course_id: 10, code: 'IT 101', title: 'Intro', program_id: 1, program_code: 'BSIT' },
  { course_id: 11, code: 'IT 204', title: 'Programming 2', program_id: 1, program_code: 'BSIT' },
  { course_id: 20, code: 'IE 101', title: 'Work Study', program_id: 2, program_code: 'BSIE' },
];

function makeDb() {
  const store = { programs: new Map(), courses: new Map(), notes: [] };
  const rowsOf = (m, id) => [...(m.get(id) || [])].sort((a, b) => a - b);
  const handle = (sql, params = []) => {
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [USERS[params[0]] ? [{ user_id: params[0] }] : []];
    if (sql.startsWith('SELECT user_id, role, first_name')) return [USERS[params[0]] ? [USERS[params[0]]] : []];
    if (sql.startsWith('SELECT program_id FROM programs')) return [PROGRAMS.map((p) => ({ program_id: p.program_id }))];
    if (sql.startsWith('SELECT course_id, program_id FROM courses')) return [COURSES.map((c) => ({ course_id: c.course_id, program_id: c.program_id }))];
    if (sql.startsWith('SELECT program_id FROM faculty_programs')) return [rowsOf(store.programs, params[0]).map((program_id) => ({ program_id }))];
    if (sql.startsWith('SELECT course_id FROM faculty_courses')) return [rowsOf(store.courses, params[0]).map((course_id) => ({ course_id }))];
    if (sql.startsWith('SELECT program_id, code, name FROM programs WHERE program_id IN')) return [PROGRAMS.filter((p) => params[0].includes(p.program_id))];
    if (sql.startsWith('SELECT c.course_id')) return [COURSES.filter((c) => params[0].includes(c.course_id))];
    if (sql.startsWith('DELETE FROM faculty_courses')) { store.courses.delete(params[0]); return [{}]; }
    if (sql.startsWith('DELETE FROM faculty_programs')) { store.programs.delete(params[0]); return [{}]; }
    if (sql.startsWith('INSERT INTO faculty_programs')) { params[0].forEach(([u, p]) => store.programs.set(u, (store.programs.get(u) || new Set()).add(p))); return [{}]; }
    if (sql.startsWith('INSERT INTO faculty_courses')) { params[0].forEach(([u, c]) => store.courses.set(u, (store.courses.get(u) || new Set()).add(c))); return [{}]; }
    if (sql.startsWith('INSERT INTO notifications')) { store.notes.push({ userId: params[0], type: params[1], title: params[3] }); return [{}]; }
    throw new Error('unexpected query: ' + sql);
  };
  const conn = { query: async (s, p) => handle(s, p), beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} };
  return { store, query: async (s, p) => handle(s, p), getConnection: async () => conn };
}

async function withServer(fn) {
  const db = makeDb();
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { const h = req.headers['x-test-user']; if (h) req.session = { user: JSON.parse(h) }; else req.session = {}; next(); });
  app.locals.db = db;
  app.use('/api/users', require('./users'));
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api/users`;
  const call = async (as, method, path, body) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(as ? { 'x-test-user': JSON.stringify(as) } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  try { await fn({ db, call }); } finally { await new Promise((r) => server.close(r)); }
}

const admin = { id: 1, role: 'admin' };
const fay = { id: 5, role: 'faculty' };
const gus = { id: 6, role: 'faculty' };

test('an admin saves assignments and reads them back with names', () => withServer(async ({ call }) => {
  const put = await call(admin, 'PUT', '/5/assignments', { programs: [1], courses: [10, 11] });
  assert.strictEqual(put.status, 200);
  assert.deepStrictEqual(put.body.programIds, [1]);
  assert.deepStrictEqual(put.body.courseIds, [10, 11]);
  assert.strictEqual(put.body.courses[0].code, 'IT 101');
  assert.strictEqual(put.body.changed, true);
  const get = await call(admin, 'GET', '/5/assignments');
  assert.strictEqual(get.status, 200);
  assert.deepStrictEqual(get.body.programs.map((p) => p.code), ['BSIT']);
}));

test('faculty cannot read or write another user\'s assignments (403)', () => withServer(async ({ call }) => {
  assert.strictEqual((await call(fay, 'PUT', '/5/assignments', { programs: [1], courses: [10] })).status, 403);
  assert.strictEqual((await call(fay, 'GET', '/6/assignments')).status, 403);
}));

test('a signed-out request is refused (401)', () => withServer(async ({ call }) => {
  assert.strictEqual((await call(null, 'GET', '/me/assignments')).status, 401);
  assert.strictEqual((await call(null, 'PUT', '/5/assignments', {})).status, 401);
}));

test('/me/assignments returns only the caller\'s own, and not another faculty member\'s', () => withServer(async ({ call }) => {
  await call(admin, 'PUT', '/5/assignments', { programs: [1], courses: [10] });
  await call(admin, 'PUT', '/6/assignments', { programs: [2], courses: [20] });
  const mine = await call(fay, 'GET', '/me/assignments');
  assert.deepStrictEqual(mine.body.courseIds, [10]);
  assert.strictEqual(mine.body.unrestricted, false);
  const his = await call(gus, 'GET', '/me/assignments');
  assert.deepStrictEqual(his.body.courseIds, [20]);
}));

test('an admin\'s /me/assignments says unrestricted', () => withServer(async ({ call }) => {
  const r = await call(admin, 'GET', '/me/assignments');
  assert.strictEqual(r.body.unrestricted, true);
}));

test('a faculty member with nothing assigned gets empty lists', () => withServer(async ({ call }) => {
  const r = await call(fay, 'GET', '/me/assignments');
  assert.deepStrictEqual([r.body.programIds, r.body.courseIds, r.body.unrestricted], [[], [], false]);
}));

test('removing a program removes its courses for that user only', () => withServer(async ({ call }) => {
  await call(admin, 'PUT', '/5/assignments', { programs: [1, 2], courses: [10, 20] });
  await call(admin, 'PUT', '/6/assignments', { programs: [1, 2], courses: [10, 20] });
  const put = await call(admin, 'PUT', '/5/assignments', { programs: [1], courses: [10, 20] });
  assert.deepStrictEqual(put.body.courseIds, [10]);
  assert.deepStrictEqual(put.body.dropped, [20]);
  assert.deepStrictEqual((await call(admin, 'GET', '/6/assignments')).body.courseIds, [10, 20]);
}));

test('a program with no subjects in the catalog saves fine and is reported as empty', () => withServer(async ({ call, db }) => {
  const put = await call(admin, 'PUT', '/5/assignments', { programs: [3], courses: [] });
  assert.strictEqual(put.status, 200);
  assert.deepStrictEqual(put.body.programIds, [3]);
  assert.deepStrictEqual(put.body.courseIds, []);
  assert.deepStrictEqual(put.body.emptyPrograms, [{ id: 3, code: 'BSEMC' }]);
  assert.match(db.store.notes[0].title, /updated/);
  const mixed = await call(admin, 'PUT', '/5/assignments', { programs: [1, 3], courses: [10] });
  assert.deepStrictEqual(mixed.body.emptyPrograms, [{ id: 3, code: 'BSEMC' }]);
  const back = await call(fay, 'GET', '/me/assignments');
  assert.deepStrictEqual(back.body.programIds, [1, 3]);
}));

test('only faculty can be assigned: an admin target is 400, an unknown user 404', () => withServer(async ({ call }) => {
  assert.strictEqual((await call(admin, 'PUT', '/1/assignments', { programs: [1] })).status, 400);
  assert.strictEqual((await call(admin, 'PUT', '/999/assignments', { programs: [1] })).status, 404);
  assert.strictEqual((await call(admin, 'GET', '/abc/assignments')).status, 404);
}));

test('unknown ids and malformed bodies are 400', () => withServer(async ({ call }) => {
  assert.strictEqual((await call(admin, 'PUT', '/5/assignments', { programs: [99] })).status, 400);
  assert.strictEqual((await call(admin, 'PUT', '/5/assignments', { programs: [1], courses: [99] })).status, 400);
  assert.strictEqual((await call(admin, 'PUT', '/5/assignments', { programs: 'BSIT' })).status, 400);
}));

test('the faculty member is notified only when something changed', () => withServer(async ({ call, db }) => {
  await call(admin, 'PUT', '/5/assignments', { programs: [1], courses: [10] });
  assert.strictEqual(db.store.notes.length, 1);
  assert.strictEqual(db.store.notes[0].userId, 5);
  assert.strictEqual(db.store.notes[0].type, 'assignment');
  const again = await call(admin, 'PUT', '/5/assignments', { programs: [1], courses: [10] });
  assert.strictEqual(again.body.changed, false);
  assert.strictEqual(db.store.notes.length, 1);
}));
