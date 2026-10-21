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
  // syllabi: { id, userId, courseId, status, updatedAt, archived } so a subject changing hands can be followed end to end;
  // archivals: each time a subject given to someone archives what others wrote
  const store = { programs: new Map(), courses: new Map(), notes: [], archivals: [], syllabi: [] };
  const rowsOf = (m, id) => [...(m.get(id) || [])].sort((a, b) => a - b);
  const handle = (sql, params = []) => {
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [USERS[params[0]] ? [{ user_id: params[0] }] : []];
    if (sql.startsWith('SELECT user_id, role, first_name')) return [USERS[params[0]] ? [USERS[params[0]]] : []];
    if (sql.startsWith('SELECT program_id FROM programs')) return [PROGRAMS.map((p) => ({ program_id: p.program_id }))];
    if (sql.startsWith('SELECT course_id, program_id FROM courses')) return [COURSES.map((c) => ({ course_id: c.course_id, program_id: c.program_id }))];
    if (sql.startsWith('SELECT program_id FROM faculty_programs')) return [rowsOf(store.programs, params[0]).map((program_id) => ({ program_id }))];
    if (sql.startsWith('SELECT course_id FROM faculty_courses')) return [rowsOf(store.courses, params[0]).map((course_id) => ({ course_id }))];
    if (sql.startsWith('SELECT program_id, code, name FROM programs WHERE program_id IN')) return [PROGRAMS.filter((p) => params[0].includes(p.program_id))];
    // who holds a subject (the one-faculty-per-subject rule): rows of other users for the courses asked about, and every holder
    if (sql.startsWith('SELECT fc.course_id, c.code')) {
      const out = [];
      store.courses.forEach((set, uid) => { if (uid !== params[1]) set.forEach((cid) => { if (params[0].includes(cid)) { const c = COURSES.find((x) => x.course_id === cid); out.push({ course_id: cid, code: c.code, first_name: USERS[uid].first_name, last_name: USERS[uid].last_name }); } }); });
      return [out.sort((x, y) => x.code.localeCompare(y.code))];
    }
    if (sql.startsWith('SELECT fc.course_id, fc.user_id')) {
      const out = [];
      store.courses.forEach((set, uid) => set.forEach((cid) => out.push({ course_id: cid, user_id: uid, first_name: USERS[uid].first_name, last_name: USERS[uid].last_name })));
      return [out.sort((x, y) => x.course_id - y.course_id)];
    }
    if (sql.startsWith('SELECT c.course_id')) return [COURSES.filter((c) => params[0].includes(c.course_id))];
    if (sql.startsWith('UPDATE syllabi s JOIN users o')) {
      store.archivals.push({ courseIds: params[0], userId: params[1] });
      const hit = store.syllabi.filter((r) => params[0].includes(r.courseId) && r.userId !== params[1] && !r.archived);
      hit.forEach((r) => { r.archived = true; });
      return [{ affectedRows: hit.length }];
    }
    if (sql.startsWith('SELECT syllabus_id, course_id, status, updated_at FROM syllabi')) {
      return [store.syllabi.filter((r) => params[0].includes(r.courseId) && r.userId === params[1] && r.archived).map((r) => ({ syllabus_id: r.id, course_id: r.courseId, status: r.status, updated_at: r.updatedAt }))];
    }
    if (sql.startsWith('SELECT DISTINCT course_id FROM syllabi')) {
      return [[...new Set(store.syllabi.filter((r) => params[0].includes(r.courseId) && r.userId === params[1] && !r.archived).map((r) => r.courseId))].map((course_id) => ({ course_id }))];
    }
    if (sql.startsWith('UPDATE syllabi SET archived_at = NULL')) {
      store.syllabi.filter((r) => params[0].includes(r.id)).forEach((r) => { r.archived = false; });
      return [{ affectedRows: params[0].length }];
    }
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
  await call(admin, 'PUT', '/6/assignments', { programs: [1, 2], courses: [11] });   // a subject has one faculty member, so Gus holds a different one
  const put = await call(admin, 'PUT', '/5/assignments', { programs: [1], courses: [10, 20] });
  assert.deepStrictEqual(put.body.courseIds, [10]);
  assert.deepStrictEqual(put.body.dropped, [20]);
  assert.deepStrictEqual((await call(admin, 'GET', '/6/assignments')).body.courseIds, [11]);
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

test('a subject has one faculty member: saving one that another faculty member holds is refused, and nothing is changed', () => withServer(async ({ call, db }) => {
  assert.strictEqual((await call(admin, 'PUT', '/5/assignments', { programs: [1], courses: [10, 11] })).status, 200);
  const taken = await call(admin, 'PUT', '/6/assignments', { programs: [1], courses: [11] });
  assert.strictEqual(taken.status, 409);
  assert.strictEqual(taken.body.code, 'subject_taken');
  assert.match(taken.body.error, /IT 204 is already assigned to Fay Faculty\. Remove it from them first; a subject has one faculty member\./);
  assert.deepStrictEqual(taken.body.conflicts, [{ courseId: 11, code: 'IT 204', holder: 'Fay Faculty' }]);
  assert.strictEqual(db.store.courses.get(6), undefined, 'the refused save left Gus untouched');
  assert.deepStrictEqual([...db.store.courses.get(5)], [10, 11], 'and Fay keeps hers');
  assert.strictEqual(db.store.notes.filter((n) => n.userId === 6).length, 0, 'nobody is told about a save that did not happen');
}));

test('a subject given to a faculty member archives what others wrote for it; saving the same subjects again, or taking one away, archives nothing', () => withServer(async ({ call, db }) => {
  await call(admin, 'PUT', '/5/assignments', { programs: [1], courses: [10, 11] });
  assert.deepStrictEqual(db.store.archivals, [{ courseIds: [10, 11], userId: 5 }], 'Fay is given both subjects');
  await call(admin, 'PUT', '/5/assignments', { programs: [1], courses: [10, 11] });
  assert.strictEqual(db.store.archivals.length, 1, 'saving what she already has changes nothing');
  await call(admin, 'PUT', '/5/assignments', { programs: [1], courses: [10] });
  assert.strictEqual(db.store.archivals.length, 1, 'taking IT 204 away from her archives nothing yet: nobody has it');
  await call(admin, 'PUT', '/6/assignments', { programs: [1], courses: [11] });
  assert.deepStrictEqual(db.store.archivals[1], { courseIds: [11], userId: 6 }, 'giving IT 204 to Gus archives what Fay wrote for it');
  await call(admin, 'PUT', '/5/assignments', { programs: [1], courses: [10, 11] }); // refused: Gus holds it
  assert.strictEqual(db.store.archivals.length, 2, 'a refused save archives nothing');
}));

test('a subject that comes back to the faculty member it was archived from brings one of their syllabi back, and archives the new holder\'s', () => withServer(async ({ call, db }) => {
  const syl = (id, userId, status, updatedAt) => ({ id, userId, courseId: 11, status, updatedAt, archived: false });
  const flags = () => Object.fromEntries(db.store.syllabi.map((r) => [r.id, r.archived]));
  await call(admin, 'PUT', '/5/assignments', { programs: [1], courses: [10, 11] });
  db.store.syllabi.push(syl(1, 5, 'approved', '2026-10-14T10:00:00Z'), syl(2, 5, 'draft', '2026-10-16T10:00:00Z'));
  await call(admin, 'PUT', '/5/assignments', { programs: [1], courses: [10] }); // IT 204 taken away from Fay: nobody has it yet
  assert.deepStrictEqual(flags(), { 1: false, 2: false }, 'taking it away archives nothing');
  await call(admin, 'PUT', '/6/assignments', { programs: [1], courses: [11] }); // given to Gus
  assert.deepStrictEqual(flags(), { 1: true, 2: true }, 'Fay\'s syllabi leave the working lists');
  db.store.syllabi.push(syl(3, 6, 'draft', '2026-10-17T10:00:00Z')); // Gus starts his own
  await call(admin, 'PUT', '/6/assignments', { programs: [1], courses: [] }); // Gus lets go
  await call(admin, 'PUT', '/5/assignments', { programs: [1], courses: [10, 11] }); // and it goes back to Fay
  assert.deepStrictEqual(flags(), { 1: false, 2: true, 3: true }, 'Fay\'s approved one is active again (not the draft: one for each subject); Gus\'s is archived');
  await call(admin, 'PUT', '/5/assignments', { programs: [1], courses: [10, 11] });
  assert.deepStrictEqual(flags(), { 1: false, 2: true, 3: true }, 'saving the same subjects again changes nothing');
}));

test('a refused save is all or nothing, and says how many more subjects are taken', () => withServer(async ({ call, db }) => {
  await call(admin, 'PUT', '/5/assignments', { programs: [1], courses: [10, 11] });
  const r = await call(admin, 'PUT', '/6/assignments', { programs: [1], courses: [10, 11] });
  assert.strictEqual(r.status, 409);
  assert.match(r.body.error, /\(1 more subject are also taken\.\)/);
  assert.strictEqual(r.body.conflicts.length, 2);
  assert.strictEqual(db.store.courses.get(6), undefined);
}));

test('once the holder lets go, the subject can be assigned to someone else; saving your own subjects again is fine', () => withServer(async ({ call }) => {
  await call(admin, 'PUT', '/5/assignments', { programs: [1], courses: [10, 11] });
  assert.strictEqual((await call(admin, 'PUT', '/5/assignments', { programs: [1], courses: [10, 11] })).status, 200, 'the holder re-saving is not a conflict');
  assert.strictEqual((await call(admin, 'PUT', '/5/assignments', { programs: [1], courses: [10] })).status, 200);
  assert.strictEqual((await call(admin, 'PUT', '/6/assignments', { programs: [1], courses: [11] })).status, 200);
}));

test('a program can be assigned to many faculty even though a subject cannot', () => withServer(async ({ call }) => {
  assert.strictEqual((await call(admin, 'PUT', '/5/assignments', { programs: [1], courses: [10] })).status, 200);
  const second = await call(admin, 'PUT', '/6/assignments', { programs: [1], courses: [11] });
  assert.strictEqual(second.status, 200);
  assert.deepStrictEqual(second.body.programIds, [1]);
}));

test('the admin screen can see who holds each subject; faculty cannot', () => withServer(async ({ call }) => {
  await call(admin, 'PUT', '/5/assignments', { programs: [1], courses: [10] });
  await call(admin, 'PUT', '/6/assignments', { programs: [1], courses: [11] });
  const r = await call(admin, 'GET', '/subject-holders');
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.body.holders, [{ courseId: 10, userId: 5, name: 'Fay Faculty' }, { courseId: 11, userId: 6, name: 'Gus Faculty' }]);
  assert.strictEqual((await call(fay, 'GET', '/subject-holders')).status, 403);
  assert.strictEqual((await call(null, 'GET', '/subject-holders')).status, 401);
}));

test('two admins saving the same subject at the same moment: the database refuses the second with a clear 409', () => withServer(async ({ call, db }) => {
  const original = db.getConnection;
  db.getConnection = async () => { const c = await original(); const q = c.query; c.query = async (sql, p) => { if (String(sql).startsWith('INSERT INTO faculty_courses')) throw Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' }); return q(sql, p); }; return c; };
  const r = await call(admin, 'PUT', '/6/assignments', { programs: [1], courses: [11] });
  assert.strictEqual(r.status, 409);
  assert.match(r.body.error, /just assigned to someone else/);
}));
