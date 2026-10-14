// HTTP-level tests for who may fetch whose profile picture (GET /api/users/:id/avatar). Pictures are private: an administrator may see any,
// a person their own, and a faculty member another person's only when they are in a conversation, which now includes the administrator who
// would receive their messages even before either has written. In-memory fake database and a real file. Run: npm test (project root).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

// Pictures are kept in a folder of their own for this test, so nothing real is read or left behind.
const DIR = 'private-avatar-test-' + process.pid;
process.env.PRIVATE_DIR = DIR;
const ROOT = path.join(__dirname, '..', DIR);
fs.mkdirSync(path.join(ROOT, 'avatars'), { recursive: true });
['diana-111.png', 'ben-222.png', 'fay-333.png'].forEach((f) => fs.writeFileSync(path.join(ROOT, 'avatars', f), 'png-bytes'));
test.after(() => fs.rmSync(ROOT, { recursive: true, force: true }));

const admin1 = { id: 1, role: 'admin', firstName: 'Diana', lastName: 'Evale' };
const fay = { id: 5, role: 'faculty', firstName: 'Fay', lastName: 'F' };
const gus = { id: 6, role: 'faculty', firstName: 'Gus', lastName: 'G' };

function makeDb() {
  const s = {
    users: {
      1: { user_id: 1, role: 'admin', avatar_path: 'avatars/diana-111.png' },
      2: { user_id: 2, role: 'admin', avatar_path: 'avatars/ben-222.png' },
      5: { user_id: 5, role: 'faculty', avatar_path: 'avatars/fay-333.png' },
      6: { user_id: 6, role: 'faculty', avatar_path: null },
    },
    syllabi: [{ user_id: 5, status: 'submitted' }, { user_id: 6, status: 'draft' }],
    messages: [],
  };
  const handle = (sql, p = []) => {
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [s.users[p[0]] ? [{ user_id: p[0] }] : []];
    if (sql.startsWith('SELECT 1 FROM messages WHERE')) return [s.messages.filter((m) => (m.s === p[0] && m.r === p[1]) || (m.s === p[2] && m.r === p[3])).map(() => ({ 1: 1 }))];
    if (sql.startsWith("SELECT user_id FROM users WHERE role = 'admin' ORDER BY user_id ASC LIMIT 1")) return [Object.values(s.users).filter((u) => u.role === 'admin').sort((a, b) => a.user_id - b.user_id).slice(0, 1).map((u) => ({ user_id: u.user_id }))];
    if (sql.startsWith("SELECT 1 FROM syllabi WHERE user_id = ? AND status <> 'draft'")) return [s.syllabi.filter((x) => x.user_id === p[0] && x.status !== 'draft').map(() => ({ 1: 1 }))];
    if (sql.startsWith('SELECT avatar_path FROM users WHERE user_id')) return [s.users[p[0]] ? [{ avatar_path: s.users[p[0]].avatar_path }] : []];
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
  app.use('/api/users', require('./users'));
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const base = `http://127.0.0.1:${server.address().port}/api/users`;
  const status = async (as, id) => (await fetch(`${base}/${id}/avatar`, { headers: as ? { 'x-test-user': JSON.stringify(as) } : {} })).status;
  try { await fn({ db, status }); } finally { await new Promise((r) => server.close(r)); }
}

test('a faculty member with a submitted syllabus sees the picture of the administrator who would receive their messages, with no message sent', () => withServer(async ({ status }) => {
  assert.strictEqual(await status(fay, 1), 200); // the first administrator account
}));

test('it is only that administrator: another administrator, a colleague, and a stranger stay private', () => withServer(async ({ status }) => {
  assert.strictEqual(await status(fay, 2), 404); // a second administrator they have never written to
  assert.strictEqual(await status(fay, 6), 404); // another faculty member (who also has no picture)
  assert.strictEqual(await status(gus, 5), 404); // a colleague's picture is private
  assert.strictEqual(await status(null, 1), 401);
}));

test('a faculty member with only a draft has no conversation yet, so the administrator\'s picture stays private', () => withServer(async ({ status }) => {
  assert.strictEqual(await status(gus, 1), 404);
}));

test('a conversation still opens the picture of whoever is in it, and the usual rules are unchanged: an administrator sees any picture, a person their own', () => withServer(async ({ status, db }) => {
  db.s.messages.push({ s: 2, r: 5 }); // Ben wrote to Fay
  assert.strictEqual(await status(fay, 2), 200);
  assert.strictEqual(await status(admin1, 5), 200);
  assert.strictEqual(await status(fay, 5), 200);
  assert.strictEqual(await status(admin1, 6), 404); // no picture on file
}));
