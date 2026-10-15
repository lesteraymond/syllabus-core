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
    notifications: 0,
  };
  const handle = (text, p = []) => {
    const sql = String(text).replace(/\s+/g, ' ').trim(); // the routes write some queries over several lines
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
    // ---- the chat routes
    if (sql.startsWith('SELECT syllabus_id, user_id, course_code, status FROM syllabi WHERE syllabus_id')) return [s.syllabi[p[0]] ? [s.syllabi[p[0]]] : []];
    if (sql.startsWith('SELECT m.*, u.first_name, u.last_name, u.avatar_path')) {
      const person = (id) => s.users[id];
      const rows = sql.includes('JOIN syllabi s ON')
        ? s.messages.filter((m) => (m.sender_id === p[0] || m.receiver_id === p[1]) && s.syllabi[m.syllabus_id].status !== 'draft')
        : s.messages.filter((m) => m.syllabus_id === p[0]);
      return [rows.map((m) => ({ message_id: m.message_id || 1, is_read: 0, created_at: '2026-03-01T10:00:00Z', message_text: m.text || 'hi', ...m, syllabus_owner_id: s.syllabi[m.syllabus_id].user_id, first_name: person(m.sender_id).first_name, last_name: person(m.sender_id).last_name, avatar_path: null }))];
    }
    if (sql.startsWith('INSERT INTO messages')) { s.messages.push({ message_id: s.messages.length + 100, syllabus_id: p[0], sender_id: p[1], receiver_id: p[2], text: p[3] }); return [{ insertId: s.messages.length + 99 }]; }
    if (sql.startsWith('INSERT INTO notifications')) { s.notifications += 1; return [{}]; }
    if (sql.startsWith('UPDATE messages SET is_read')) return [{}];
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
  const call = async (as, path = '/partners', method = 'GET', body) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(as ? { 'x-test-user': JSON.stringify(as) } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  try { await fn({ db, call }); } finally { await new Promise((r) => server.close(r)); }
}

test('a faculty member sees the administrator\'s real name, picture and role, and no program or subject, before anyone has written', () => withServer(async ({ call }) => {
  const r = await call(fay);
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(Object.keys(r.body.partners), ['10']); // their own submitted syllabus only: no draft, nobody else's
  const p = r.body.partners[10];
  assert.deepStrictEqual([p.id, p.name, p.role, p.roleLabel], [1, 'Diana Evale', 'admin', 'Academic Administrator']); // the first administrator
  assert.strictEqual(p.avatarUrl, '/api/users/1/avatar?v=111'); // the picture is the administrator's own, and its version changes when they change it
  assert.ok(!('program' in p) && !('subject' in p), 'program and subject describe the faculty member, never the administrator');
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

test('a draft has no conversation: its owner is told to submit first, an administrator is told it does not exist, and nothing is stored', () => withServer(async ({ call, db }) => {
  // syllabus 11 is Fay's draft
  const read = await call(fay, '/11');
  assert.strictEqual(read.status, 409);
  assert.strictEqual(read.body.code, 'draft');
  assert.match(read.body.error, /Submit it for review first/);
  const send = await call(fay, '/11', 'POST', { text: 'Hello admin' });
  assert.strictEqual(send.status, 409);
  assert.strictEqual((await call(fay, '/read/11', 'PUT')).status, 409);
  assert.strictEqual((await call(admin1, '/11')).status, 404); // an administrator never sees a draft
  assert.strictEqual((await call(admin1, '/11', 'POST', { text: 'Hello Fay' })).status, 404);
  assert.strictEqual((await call(gus, '/11', 'POST', { text: 'Hi' })).status, 403); // somebody else's draft: still not their conversation
  assert.strictEqual(db.s.messages.length, 0, 'no message was stored');
  assert.strictEqual(db.s.notifications, 0, 'and no administrator was notified about a syllabus they cannot see');
}));

test('a submitted syllabus still has its conversation for both sides, and a message notifies the other', () => withServer(async ({ call, db }) => {
  const first = await call(fay, '/10', 'POST', { text: 'Please review.' });
  assert.strictEqual(first.status, 200, JSON.stringify(first.body));
  assert.strictEqual(db.s.messages.length, 1);
  assert.strictEqual(db.s.messages[0].receiver_id, 1); // the first administrator
  assert.strictEqual(db.s.notifications, 1);
  assert.strictEqual((await call(admin1, '/10', 'POST', { text: 'Will do.' })).status, 200);
  assert.strictEqual((await call(admin1, '/10')).status, 200);
  assert.strictEqual((await call(fay, '/read/10', 'PUT')).status, 200);
}));

test('messages written about a syllabus while it was a draft are kept but not shown, and show once it is submitted', () => withServer(async ({ call, db }) => {
  db.s.messages.push({ message_id: 26, syllabus_id: 11, sender_id: 5, receiver_id: 1, text: 'Written when it was a draft' });
  db.s.messages.push({ message_id: 27, syllabus_id: 10, sender_id: 5, receiver_id: 1, text: 'Written about a submitted one' });
  for (const who of [fay, admin1]) assert.deepStrictEqual((await call(who, '/')).body.map((m) => m.id), [27], who.role);
  db.s.syllabi[11].status = 'submitted';
  assert.deepStrictEqual((await call(admin1, '/')).body.map((m) => m.id).sort(), [26, 27]);
}));

test('an admin has no messaging partner or thread on their own completed syllabus and cannot send themselves a message',()=>withServer(async({call,db})=>{
  db.s.syllabi[13]={...db.s.syllabi[10],syllabus_id:13,user_id:admin1.id,status:'approved'};
  assert.ok(!(await call(admin1)).body.partners[13]);
  const count=db.s.messages.length;
  for(const [method,path,body] of [['GET','/13'],['POST','/13',{text:'Self message',receiverId:admin1.id}],['PUT','/read/13']]) {
    const response=await call(admin1,path,method,body);
    assert.strictEqual(response.status,409);assert.strictEqual(response.body.code,'self_chat');
  }
  assert.strictEqual(db.s.messages.length,count);assert.strictEqual(db.s.notifications,0);
  db.s.messages.push({syllabus_id:13,sender_id:admin1.id,receiver_id:admin1.id});
  assert.deepStrictEqual((await call(admin1,'/')).body,[]);
  assert.strictEqual((await call(admin1,'/10','POST',{text:'Faculty conversation'})).status,200);
}));
