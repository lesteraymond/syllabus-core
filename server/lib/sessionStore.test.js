// Sessions kept in the database (docs/security/SECURITY-AUDIT-REPORT.md SEC-09): they survive a restart, are shared by several server processes, expire on the
// server, are stored under a hash of their id (a copy of the table cannot be used to sign in), and ending an account's sessions removes them for every process.
// A fake database that stores the rows in memory, real express-session, real cookies. Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const session = require('express-session');
const { MySqlSessionStore, resolveSessionStore, assertSessionTableReady, SESSIONS_DDL } = require('./sessionStore');
const auth = require('../middleware/auth');

function fakeDb() {
  const rows = new Map(); // session_id -> { user_id, expires (Date), data }
  return {
    rows,
    async query(sql, p = []) {
      sql = sql.replace(/\s+/g, ' ').trim();
      if (sql.startsWith('SELECT data FROM sessions WHERE session_id = ? AND expires > ?')) { const r = rows.get(p[0]); return [r && r.expires > p[1] ? [{ data: r.data }] : []]; }
      if (sql.startsWith('INSERT INTO sessions')) { rows.set(p[0], { user_id: p[1], expires: p[2], data: p[3] }); return [{ affectedRows: 1 }]; }
      if (sql.startsWith('UPDATE sessions SET expires = ? WHERE session_id = ?')) { const r = rows.get(p[1]); if (r) r.expires = p[0]; return [{ affectedRows: r ? 1 : 0 }]; }
      if (sql.startsWith('DELETE FROM sessions WHERE session_id = ?')) { rows.delete(p[0]); return [{}]; }
      if (sql.startsWith('DELETE FROM sessions WHERE user_id = ?')) { for (const [k, r] of rows) if (r.user_id === p[0]) rows.delete(k); return [{}]; }
      if (sql.startsWith('DELETE FROM sessions WHERE expires <= ?')) { let n = 0; for (const [k, r] of rows) if (r.expires <= p[0]) { rows.delete(k); n += 1; } return [{ affectedRows: n }]; }
      if (sql.startsWith('SELECT 1 FROM sessions LIMIT 1')) return [[]];
      if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [[{ user_id: p[0] }]];
      throw new Error('unexpected query: ' + sql);
    },
  };
}
const promisify = (store, method, ...args) => new Promise((resolve, reject) => store[method](...args, (err, value) => (err ? reject(err) : resolve(value))));

test('a session is stored under a hash of its id, with its account and expiry, and read back', async () => {
  const db = fakeDb(), store = new MySqlSessionStore(db, { sweepEveryMs: 0 });
  const sess = { cookie: { expires: new Date(Date.now() + 60000), originalMaxAge: 60000 }, user: { id: 7, role: 'faculty' } };
  await promisify(store, 'set', 'the-session-id', sess);
  assert.equal(db.rows.has('the-session-id'), false, 'the raw id is never a key');
  const key = crypto.createHash('sha256').update('the-session-id').digest('hex');
  assert.equal(db.rows.get(key).user_id, 7);
  assert.deepEqual((await promisify(store, 'get', 'the-session-id')).user, { id: 7, role: 'faculty' });
  assert.equal(await promisify(store, 'get', 'another-id'), null);
});

test('an expired session is not returned, and the sweep removes it', async () => {
  const db = fakeDb(), store = new MySqlSessionStore(db, { sweepEveryMs: 0 });
  await promisify(store, 'set', 'old', { cookie: { expires: new Date(Date.now() - 1000) }, user: { id: 1 } });
  await promisify(store, 'set', 'live', { cookie: { expires: new Date(Date.now() + 60000) }, user: { id: 1 } });
  assert.equal(await promisify(store, 'get', 'old'), null);
  assert.equal(await store.sweep(), 1);
  assert.equal(db.rows.size, 1);
});

test('a browser-session cookie (no expiry) still ends on the server after the session lifetime; touch() extends a live one', async () => {
  const db = fakeDb(), store = new MySqlSessionStore(db, { sweepEveryMs: 0, lifetimeMs: 1000 });
  await promisify(store, 'set', 'browser', { cookie: { expires: null }, user: { id: 1 } });
  const key = crypto.createHash('sha256').update('browser').digest('hex');
  const first = db.rows.get(key).expires.getTime();
  assert.ok(first > Date.now() && first <= Date.now() + 1000);
  await new Promise((r) => setTimeout(r, 20));
  await promisify(store, 'touch', 'browser', { cookie: { expires: null } });
  assert.ok(db.rows.get(key).expires.getTime() > first);
});

test('destroy() and destroyUser() remove sessions: one, or every session of one account', async () => {
  const db = fakeDb(), store = new MySqlSessionStore(db, { sweepEveryMs: 0 });
  const live = { expires: new Date(Date.now() + 60000) };
  for (const [sid, id] of [['a', 1], ['b', 1], ['c', 2], ['anon', null]]) await promisify(store, 'set', sid, { cookie: live, ...(id ? { user: { id } } : {}) });
  await promisify(store, 'destroy', 'c');
  assert.equal(db.rows.size, 3);
  await store.destroyUser(1);
  assert.equal(db.rows.size, 1, 'only the anonymous session is left');
});

// ---- through Express: a restart, a second process, and ending an account's sessions ----
async function app(db, store) {
  const a = express();
  a.use(express.json());
  a.use(session({ secret: 'shared-test-secret-0123456789', resave: false, saveUninitialized: false, store }));
  a.locals.db = db;
  a.post('/in', async (req, res) => { await auth.startSession(req, { id: req.body.id, role: 'faculty' }); res.json({}); });
  a.post('/end', async (req, res) => { await auth.endSessionsOf(req.body.id); res.json({}); });
  a.get('/ping', auth.requireAuth, (req, res) => res.json({ ok: true }));
  const server = await new Promise((resolve) => { const sv = a.listen(0, () => resolve(sv)); });
  const url = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, { cookie, body } = {}) => {
    const res = await fetch(url + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, cookie: res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ') };
  };
  return { call, close: () => new Promise((r) => server.close(r)) };
}

test('a signed-in session survives a restart and works in a second server process', async () => {
  const db = fakeDb();
  const first = await app(db, new MySqlSessionStore(db, { sweepEveryMs: 0 }));
  const { cookie } = await first.call('POST', '/in', { body: { id: 5 } });
  assert.equal((await first.call('GET', '/ping', { cookie })).status, 200);
  await first.close();
  const restarted = await app(db, new MySqlSessionStore(db, { sweepEveryMs: 0 }));
  const other = await app(db, new MySqlSessionStore(db, { sweepEveryMs: 0 }));
  try {
    assert.equal((await restarted.call('GET', '/ping', { cookie })).status, 200);
    assert.equal((await other.call('GET', '/ping', { cookie })).status, 200);
  } finally { await restarted.close(); await other.close(); }
});

test('ending an account\'s sessions in one process ends them in every process, and survives a restart', async () => {
  const db = fakeDb();
  const one = await app(db, new MySqlSessionStore(db, { sweepEveryMs: 0 }));
  const two = await app(db, new MySqlSessionStore(db, { sweepEveryMs: 0 }));
  auth.setSharedSessionStore(new MySqlSessionStore(db, { sweepEveryMs: 0 }));
  try {
    const { cookie } = await one.call('POST', '/in', { body: { id: 6 } });
    const other = (await one.call('POST', '/in', { body: { id: 8 } })).cookie;
    assert.equal((await two.call('GET', '/ping', { cookie })).status, 200);
    await two.call('POST', '/end', { body: { id: 6 } });
    assert.equal((await one.call('GET', '/ping', { cookie })).status, 401);
    assert.equal((await two.call('GET', '/ping', { cookie })).status, 401);
    assert.equal((await one.call('GET', '/ping', { cookie: other })).status, 200, 'other accounts are untouched');
  } finally { auth.setSharedSessionStore(null); await one.close(); await two.close(); }
});

test('SESSION_STORE: memory in development by default; staging and production use the database and refuse memory', () => {
  assert.equal(resolveSessionStore({}), 'memory');
  assert.equal(resolveSessionStore({ SESSION_STORE: 'mysql' }), 'mysql');
  for (const mode of ['staging', 'production']) {
    assert.equal(resolveSessionStore({ NODE_ENV: mode }), 'mysql');
    assert.throws(() => resolveSessionStore({ NODE_ENV: mode, SESSION_STORE: 'memory' }), (e) => e.code === 'session_store_invalid' && /SESSION_STORE/.test(e.message));
  }
  assert.throws(() => resolveSessionStore({ SESSION_STORE: 'redis' }), (e) => e.code === 'session_store_invalid');
});

test('the sessions table is checked at startup, with the migration named when it is missing', async () => {
  await assertSessionTableReady(fakeDb());
  const missing = { query: async () => { throw Object.assign(new Error("Table 'x.sessions' doesn't exist"), { code: 'ER_NO_SUCH_TABLE' }); } };
  await assert.rejects(assertSessionTableReady(missing), (e) => e.code === 'session_store_not_ready' && /migrate-session-store/.test(e.message));
  assert.match(SESSIONS_DDL, /session_id CHAR\(64\) NOT NULL PRIMARY KEY/);
  assert.match(SESSIONS_DDL, /FOREIGN KEY \(user_id\) REFERENCES users\(user_id\) ON DELETE CASCADE/);
});

test('server/index.js uses the store and tells the sign-in code about it', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'index.js'), 'utf8');
  assert.match(source, /new MySqlSessionStore\(pool\)/);
  assert.match(source, /setSharedSessionStore\(sessionStore\)/);
  assert.match(source, /assertSessionTableReady\(pool\)/);
  assert.ok(source.indexOf('mysql.createPool(') < source.indexOf('session({'), 'the pool exists before the session middleware');
});
