// HTTP-level tests for the activity read (GET /api/logs): each account gets only its own activity, whatever its role, so nobody's browser
// ever receives what somebody else did. In-memory fake database. Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');

const admin = { id: 1, role: 'admin', firstName: 'Diana', lastName: 'Evale' };
const fay = { id: 5, role: 'faculty', firstName: 'Fay', lastName: 'F' };
const gus = { id: 6, role: 'faculty', firstName: 'Gus', lastName: 'G' };
const NAMES = { 1: ['Diana', 'Evale'], 5: ['Fay', 'F'], 6: ['Gus', 'G'] };

function makeDb() {
  const rows = [];
  let n = 0;
  const add = (user_id, action, syllabus_id = 10) => rows.push({ log_id: ++n, syllabus_id, user_id, action, action_date: '2026-03-0' + (1 + (n % 9)) + 'T10:00:00Z', notes: action + ' note' });
  add(5, 'upload'); add(5, 'submit'); add(1, 'revision'); add(6, 'submit', 11); add(1, 'approve', 11);
  for (let i = 0; i < 40; i++) add(5, 'update');
  const handle = (text, p = []) => {
    const sql = String(text).replace(/\s+/g, ' ').trim();
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [NAMES[p[0]] ? [{ user_id: p[0] }] : []];
    if (sql.startsWith('SELECT l.*, u.first_name, u.last_name, s.title, s.course_code FROM submission_logs l')) {
      assert.ok(sql.includes('WHERE l.user_id = ?'), 'the read is limited to one account in the query itself');
      const limit = Number(/LIMIT (\d+)/.exec(sql)[1]);
      return [rows.filter((r) => r.user_id === p[0]).sort((a, b) => b.log_id - a.log_id).slice(0, limit)
        .map((r) => ({ ...r, first_name: NAMES[r.user_id][0], last_name: NAMES[r.user_id][1], title: 'Fundamentals of Mathematics', course_code: 'FM 202' }))];
    }
    throw new Error('unexpected query: ' + sql);
  };
  return { rows, query: async (q, p) => handle(q, p) };
}

async function withServer(fn) {
  const db = makeDb();
  const app = express();
  app.use((req, res, next) => { const h = req.headers['x-test-user']; req.session = h ? { user: JSON.parse(h) } : {}; next(); });
  app.locals.db = db;
  app.use('/api/logs', require('./logs'));
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const call = async (as) => { const res = await fetch(`http://127.0.0.1:${server.address().port}/api/logs`, { headers: as ? { 'x-test-user': JSON.stringify(as) } : {} }); return { status: res.status, body: await res.json().catch(() => ({})) }; };
  try { await fn({ call, db }); } finally { await new Promise((r) => server.close(r)); }
}

test('an administrator gets only what they did themselves, not what faculty did', () => withServer(async ({ call }) => {
  const r = await call(admin);
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.body.map((x) => x.action).sort(), ['approve', 'revision']);
  assert.ok(r.body.every((x) => x.userId === 1 && x.user === 'Diana Evale'));
}));

test('a faculty member gets only their own activity, and not the administrator\'s or a colleague\'s', () => withServer(async ({ call }) => {
  const mine = await call(gus);
  assert.deepStrictEqual(mine.body.map((x) => [x.userId, x.action]), [[6, 'submit']]);
  const fays = (await call(fay)).body;
  assert.ok(fays.length > 0 && fays.every((x) => x.userId === 5));
}));

test('the list is newest first and capped, and carries what the dashboard words: action, person, course and date', () => withServer(async ({ call }) => {
  const r = (await call(fay)).body;
  assert.strictEqual(r.length, 30); // fay has 42 rows
  assert.ok(r.every((x, i) => i === 0 || x.id < r[i - 1].id));
  const first = r[0];
  assert.deepStrictEqual(Object.keys(first).sort(), ['action', 'actionDate', 'courseCode', 'id', 'notes', 'syllabusId', 'title', 'user', 'userId']);
}));

test('signing in is required', () => withServer(async ({ call }) => {
  assert.strictEqual((await call(null)).status, 401);
}));
