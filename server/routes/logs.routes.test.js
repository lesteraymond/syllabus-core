// HTTP-level tests for the activity read (GET /api/logs): each account gets only its own activity, whatever its role, so nobody's browser
// ever receives what somebody else did. In-memory fake database. Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');

const admin = { id: 1, role: 'admin', firstName: 'Diana', lastName: 'Evale' };
const fay = { id: 5, role: 'faculty', firstName: 'Fay', lastName: 'F' };
const gus = { id: 6, role: 'faculty', firstName: 'Gus', lastName: 'G' };
const NAMES = { 1: ['Diana', 'Evale'], 5: ['Fay', 'F'], 6: ['Gus', 'G'] };

// `account`: the account_activity rows (lib/accountActivity.js); null is a database before npm run migrate-account-activity.
function makeDb({ account = [] } = {}) {
  const rows = [];
  let n = 0;
  const add = (user_id, action, syllabus_id = 10) => rows.push({ log_id: ++n, syllabus_id, user_id, action, action_date: new Date(Date.UTC(2026, 2, 1) + n * 60000).toISOString(), notes: action + ' note' });
  add(5, 'upload'); add(5, 'submit'); add(1, 'revision'); add(6, 'submit', 11); add(1, 'approve', 11);
  for (let i = 0; i < 60; i++) add(5, 'update');
  // everyone: set by a test only while it asks for the administrator's view of everyone (?scope=all); every other read must be one account's
  const state = { everyone: false };
  const handle = (text, p = []) => {
    const sql = String(text).replace(/\s+/g, ' ').trim();
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [NAMES[p[0]] ? [{ user_id: p[0] }] : []];
    if (sql.startsWith('SELECT l.*, u.first_name, u.last_name, s.title, s.course_code FROM submission_logs l')) {
      const one = sql.includes('WHERE l.user_id = ?');
      assert.ok(one || state.everyone, 'the read is limited to one account in the query itself');
      const limit = Number(/LIMIT (\d+)/.exec(sql)[1]);
      return [rows.filter((r) => !one || r.user_id === p[0]).sort((a, b) => b.log_id - a.log_id).slice(0, limit)
        .map((r) => ({ ...r, first_name: NAMES[r.user_id][0], last_name: NAMES[r.user_id][1], title: 'Fundamentals of Mathematics', course_code: 'FM 202' }))];
    }
    if (sql.startsWith('SELECT a.activity_id, a.user_id, a.action')) {
      if (account === null) throw Object.assign(new Error("Table 'account_activity' doesn't exist"), { code: 'ER_NO_SUCH_TABLE' });
      const one = sql.includes('WHERE a.user_id = ?');
      assert.ok(one || state.everyone, 'the account activity read is limited to one account in the query itself');
      const limit = Number(/LIMIT (\d+)/.exec(sql)[1]);
      return [account.filter((r) => !one || r.user_id === p[0]).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, limit)
        .map((r) => ({ syllabus_id: null, subject: null, notes: null, course_code: null, title: null, ...r, first_name: NAMES[r.user_id][0], last_name: NAMES[r.user_id][1] }))];
    }
    if (/program_outcome_sources/.test(sql)) throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' }); // not migrated yet
    throw new Error('unexpected query: ' + sql);
  };
  return { rows, state, query: async (q, p) => handle(q, p) };
}

async function withServer(opts, fn) {
  if (typeof opts === 'function') { fn = opts; opts = {}; }
  const db = makeDb(opts);
  const app = express();
  app.use((req, res, next) => { const h = req.headers['x-test-user']; req.session = h ? { user: JSON.parse(h) } : {}; next(); });
  app.locals.db = db;
  app.use('/api/logs', require('./logs'));
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const call = async (as, query = '') => { const res = await fetch(`http://127.0.0.1:${server.address().port}/api/logs${query}`, { headers: as ? { 'x-test-user': JSON.stringify(as) } : {} }); return { status: res.status, body: await res.json().catch(() => ({})) }; };
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
  assert.strictEqual(r.length, 50); // fay has 62 rows
  assert.ok(r.every((x, i) => i === 0 || x.id < r[i - 1].id));
  const first = r[0];
  assert.deepStrictEqual(Object.keys(first).sort(), ['action', 'actionDate', 'courseCode', 'id', 'notes', 'syllabusId', 'title', 'user', 'userId']);
}));

test('signing in is required', () => withServer(async ({ call }) => {
  assert.strictEqual((await call(null)).status, 401);
}));

// The account's own activity (account_activity): sign-in, sign-out, password, name, photo, language, drafts, edits, deletions, merged with the review
// history into one list, newest first. Only the signed-in account's rows; never a password.
const ACCOUNT = [
  { activity_id: 1, user_id: 6, action: 'login', notes: 'password', created_at: '2026-03-20T08:00:00Z' },
  { activity_id: 2, user_id: 6, action: 'name_change', notes: 'Gus G → Gus Gomez', created_at: '2026-03-20T08:05:00Z' },
  { activity_id: 3, user_id: 6, action: 'syllabus_delete', subject: 'OLD 1 — Legacy', notes: 'draft', created_at: '2026-03-01T09:00:00Z' },
  { activity_id: 4, user_id: 1, action: 'logout', created_at: '2026-03-21T08:00:00Z' },
];
test('the account activity is merged with the review history, newest first, and only the signed-in account\'s', () => withServer({ account: ACCOUNT }, async ({ call }) => {
  const r = (await call(gus)).body;
  // gus's review row (a submit) is dated 2026-03-01 00:04, before his deletion at 09:00 the same day
  assert.deepStrictEqual(r.map((x) => x.action), ['name_change', 'login', 'syllabus_delete', 'submit']);
  assert.ok(r.every((x) => x.userId === 6), 'never the administrator\'s sign-out');
  const [name, login, deleted] = r;
  assert.deepStrictEqual([name.id, name.notes, name.user], ['a2', 'Gus G → Gus Gomez', 'Gus G']);
  assert.strictEqual(login.notes, 'password', 'how he signed in, never the password');
  assert.deepStrictEqual([deleted.courseCode, deleted.title, deleted.syllabusId, deleted.notes], ['OLD 1', 'Legacy', null, 'draft'], 'a deleted draft is still named by what was recorded');
  assert.deepStrictEqual(Object.keys(deleted).sort(), ['action', 'actionDate', 'courseCode', 'id', 'notes', 'syllabusId', 'title', 'user', 'userId'], 'the same shape as a review row');
  assert.deepStrictEqual((await call(admin)).body.map((x) => x.action), ['logout', 'approve', 'revision']);
}));

test('before the account activity migration the list is the review history alone', () => withServer({ account: null }, async ({ call }) => {
  const r = await call(gus);
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.body.map((x) => x.action), ['submit']);
}));

test('the merged list is still capped', () => withServer({ account: Array.from({ length: 30 }, (_, i) => ({ activity_id: i + 1, user_id: 5, action: 'login', notes: 'password', created_at: '2026-04-01T08:' + String(i).padStart(2, '0') + ':00Z' })) }, async ({ call }) => {
  const r = (await call(fay)).body;
  assert.strictEqual(r.length, 50);
  assert.deepStrictEqual(r.slice(0, 30).map((x) => x.action), Array(30).fill('login'), 'the newest first: the April sign-ins before the March review rows');
}));

// The administrator's oversight: everyone's activity (?scope=all), or one person's (&userId=), merged and newest first. Nobody else may ask.
test('the administrator reads everyone\'s activity, or one person\'s; anyone else asking is refused', () => withServer({ account: ACCOUNT }, async ({ call, db }) => {
  assert.strictEqual((await call(fay, '?scope=all')).status, 403, 'faculty');
  assert.strictEqual((await call({ ...gus, role: 'vpaa' }, '?scope=all')).status, 403, 'a reviewer (the VPAA)');
  assert.strictEqual((await call(admin, '?scope=all&userId=abc')).status, 400);
  db.state.everyone = true;
  const all = (await call(admin, '?scope=all')).body;
  assert.strictEqual(all.length, 69, '65 review rows and 4 account rows, under the cap of 100');
  assert.deepStrictEqual([...new Set(all.map((x) => x.userId))].sort(), [1, 5, 6]);
  assert.ok(all.every((x, i) => i === 0 || new Date(x.actionDate) <= new Date(all[i - 1].actionDate)), 'newest first');
  assert.strictEqual(all[0].action, 'logout'); assert.strictEqual(all[0].user, 'Diana Evale');
  db.state.everyone = false;
  const gusOnly = (await call(admin, '?scope=all&userId=6')).body;
  assert.deepStrictEqual(gusOnly.map((x) => x.action), ['name_change', 'login', 'syllabus_delete', 'submit'], 'one person: read with the account in the query');
  assert.deepStrictEqual((await call(admin)).body.map((x) => x.action), ['logout', 'approve', 'revision'], 'without scope: still the administrator\'s own');
}));
