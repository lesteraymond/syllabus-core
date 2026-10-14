// HTTP-level tests for who a conversation is with (GET /api/messages/partners): the other person's name, picture and role, and the syllabus's
// program and subject, known before anyone has written and following a name change. In-memory fake database. Run: npm test (project root).
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');

const admin1 = { id: 1, role: 'admin', firstName: 'Diana', lastName: 'Evale' };
const admin2 = { id: 2, role: 'admin', firstName: 'Ben', lastName: 'Reyes' };
const fay = { id: 5, role: 'faculty', firstName: 'Fay', lastName: 'Faculty' };
const gus = { id: 6, role: 'faculty', firstName: 'Gus', lastName: 'Gomez' };

function makeDb() {
  const s = {
    users: {
      1: { user_id: 1, role: 'admin', first_name: 'Diana', last_name: 'Evale', avatar_path: 'avatars/diana-111.png' },
      2: { user_id: 2, role: 'admin', first_name: 'Ben', last_name: 'Reyes', avatar_path: null },
      5: { user_id: 5, role: 'faculty', first_name: 'Fay', last_name: 'Faculty', avatar_path: 'avatars/fay-333.png' },
      6: { user_id: 6, role: 'faculty', first_name: 'Gus', last_name: 'Gomez', avatar_path: null },
    },
    syllabi: {
      10: { syllabus_id: 10, user_id: 5, status: 'submitted', course_code: 'FM 202', title: 'Fundamentals of Mathematics', course_title: 'Fundamentals of Mathematics', program_code: 'BSFM', program_name: 'Bachelor of Science in Financial Management', curriculum_program: null },
      11: { syllabus_id: 11, user_id: 5, status: 'draft', course_code: 'FM 203', title: 'Draft', course_title: null, program_code: 'BSFM', program_name: 'Bachelor of Science in Financial Management', curriculum_program: null },
      12: { syllabus_id: 12, user_id: 6, status: 'approved', course_code: 'IT 101', title: 'Intro', course_title: 'Intro to IT', program_code: 'BSIT', program_name: 'BS Information Technology', curriculum_program: null },
    },
    messages: [], // { syllabus_id, sender_id, receiver_id, created_at }
  };
  const handle = (sql, p = []) => {
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [s.users[p[0]] ? [{ user_id: p[0] }] : []];
    if (sql.startsWith('SELECT s.syllabus_id, s.user_id, s.course_code, s.title, u.avatar_path,')) {
      const mine = sql.includes('AND s.user_id = ?');
      return [Object.values(s.syllabi).filter((x) => x.status !== 'draft' && (!mine || x.user_id === p[0])).sort((a, b) => b.syllabus_id - a.syllabus_id)
        .map((x) => ({ ...x, first_name: s.users[x.user_id].first_name, last_name: s.users[x.user_id].last_name, avatar_path: s.users[x.user_id].avatar_path }))];
    }
    if (sql.startsWith('SELECT m.sender_id, m.receiver_id, us.role AS sender_role')) {
      return [s.messages.filter((m) => m.syllabus_id === p[0]).slice().reverse().map((m) => ({ sender_id: m.sender_id, receiver_id: m.receiver_id, sender_role: s.users[m.sender_id].role, receiver_role: s.users[m.receiver_id].role }))];
    }
    if (sql.startsWith("SELECT user_id FROM users WHERE role = 'admin' AND user_id <>")) {
      return [Object.values(s.users).filter((u) => u.role === 'admin' && u.user_id !== p[0]).sort((a, b) => a.user_id - b.user_id).slice(0, 1).map((u) => ({ user_id: u.user_id }))];
    }
    if (sql.startsWith('SELECT user_id, first_name, last_name, avatar_path FROM users WHERE user_id IN')) return [p[0].map((id) => s.users[id]).filter(Boolean)];
    throw new Error('unexpected query: ' + sql);
  };
  return { s, query: async (q, p) => handle(q, p) };
}

async function withServer(fn) {
  const db = makeDb();
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { const h = req.headers['x-test-user']; req.session = h ? { user: JSON.parse(h) } : {}; next(); });
  app.locals.db = db;
  app.use('/api/messages', require('./messages'));
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const base = `http://127.0.0.1:${server.address().port}/api/messages`;
  const call = async (as, path = '/partners') => {
    const res = await fetch(base + path, { headers: as ? { 'x-test-user': JSON.stringify(as) } : {} });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  try { await fn({ db, call }); } finally { await new Promise((r) => server.close(r)); }
}

test('a faculty member sees the administrator\'s real name, picture and role, and the program and subject, before anyone has written', () => withServer(async ({ call }) => {
  const r = await call(fay);
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(Object.keys(r.body.partners), ['10']); // their own submitted syllabus only: no draft, nobody else's
  const p = r.body.partners[10];
  assert.deepStrictEqual([p.id, p.name, p.role, p.roleLabel], [1, 'Diana Evale', 'admin', 'Academic Administrator']); // the first administrator
  assert.strictEqual(p.avatarUrl, '/api/users/1/avatar?v=111'); // the picture is the administrator's own, and its version changes when they change it
  assert.strictEqual(p.program, 'BSFM · Bachelor of Science in Financial Management');
  assert.strictEqual(p.subject, 'FM 202 — Fundamentals of Mathematics');
}));

test('an administrator sees the faculty member\'s name, picture and role, with the program and subject, for every submitted syllabus', () => withServer(async ({ call }) => {
  const r = await call(admin1);
  assert.deepStrictEqual(Object.keys(r.body.partners).sort(), ['10', '12']); // drafts have no conversation
  const p = r.body.partners[10];
  assert.deepStrictEqual([p.id, p.name, p.role, p.roleLabel], [5, 'Fay Faculty', 'faculty', 'Faculty']);
  assert.strictEqual(p.avatarUrl, '/api/users/5/avatar?v=333');
  assert.strictEqual(p.program, 'BSFM · Bachelor of Science in Financial Management');
  assert.strictEqual(p.subject, 'FM 202 — Fundamentals of Mathematics');
  assert.strictEqual(r.body.partners[12].name, 'Gus Gomez');
  assert.strictEqual(r.body.partners[12].avatarUrl, null); // no picture: the screen shows initials
}));

test('the administrator already in the thread is the one shown, as it is the one a message goes to', () => withServer(async ({ call, db }) => {
  assert.strictEqual((await call(fay)).body.partners[10].name, 'Diana Evale');
  db.s.messages.push({ syllabus_id: 10, sender_id: 2, receiver_id: 5 }); // Ben wrote to Fay about this syllabus
  const p = (await call(fay)).body.partners[10];
  assert.deepStrictEqual([p.id, p.name], [2, 'Ben Reyes']);
  db.s.messages.push({ syllabus_id: 10, sender_id: 5, receiver_id: 2 });
  assert.strictEqual((await call(fay)).body.partners[10].id, 2); // still Ben once Fay replies
}));

test('a changed name or picture shows on the next read, for both sides: nothing is copied into the conversation', () => withServer(async ({ call, db }) => {
  db.s.users[1].first_name = 'Dianne'; db.s.users[1].avatar_path = 'avatars/diana-222.png';
  const fromFaculty = (await call(fay)).body.partners[10];
  assert.strictEqual(fromFaculty.name, 'Dianne Evale');
  assert.strictEqual(fromFaculty.avatarUrl, '/api/users/1/avatar?v=222');
  db.s.users[5].last_name = 'Santos-Cruz'; db.s.users[5].avatar_path = null;
  const fromAdmin = (await call(admin1)).body.partners[10];
  assert.strictEqual(fromAdmin.name, 'Fay Santos-Cruz');
  assert.strictEqual(fromAdmin.avatarUrl, null); // the picture was removed
}));

test('with no administrator account there is nobody to talk to, and the read still works; sign-in is required', () => withServer(async ({ call, db }) => {
  delete db.s.users[1]; delete db.s.users[2];
  const r = await call(fay);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.partners[10], null);
  assert.strictEqual((await call(null)).status, 401);
}));

test('/partners is its own route: it is not read as a syllabus id (which would be a 404 "Syllabus not found")', () => withServer(async ({ call }) => {
  const r = await call(fay);
  assert.strictEqual(r.status, 200);
  assert.ok(r.body.partners && !r.body.error);
}));
