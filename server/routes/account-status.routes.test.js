'use strict';
// Disabled accounts (lib/accountStatus.js): sign-in, open sessions, "Forgot password", resend, the Admin disable and enable routes, the last active
// administrator, and a database before the migration. Real routes and sessions, in-memory database. Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
process.env.JWT_SECRET = 'account-status-tests-only';
const { requireAuth } = require('../middleware/auth');

const PASS = 'Test-pass-12';
async function withServer(fn, { migrated = true } = {}) {
  const users = [
    { user_id: 1, email: 'admin@x.ph', role: 'admin' }, { user_id: 2, email: 'dean2@x.ph', role: 'admin' },
    { user_id: 5, email: 'faculty@x.ph', role: 'faculty' }, { user_id: 6, email: 'vpaa@x.ph', role: 'vpaa' },
  ].map((u) => ({ ...u, first_name: 'Some', last_name: 'One', avatar_path: null, must_change_password: 0, preferred_language: 'en', created_at: '2026-01-01', password_hash: bcrypt.hashSync(PASS, 4), disabled_at: null, disabled_by: null }));
  const s = { users, tokens: [{ user_id: 5 }, { user_id: 6 }], temp: [{ user_id: 5 }], records: { syllabi: [{ id: 1, user_id: 5, status: 'approved' }], stages: [{ syllabus_id: 1, reviewer_id: 6 }] }, open: false, writes: [], activity: [] }; // activity: account_activity rows (lib/accountActivity.js)
  const noColumn = () => Object.assign(new Error("Unknown column 'disabled_at' in 'field list'"), { code: 'ER_BAD_FIELD_ERROR', errno: 1054 });
  const query = async (sql, p = []) => {
    if (!migrated && /disabled_at|disabled_by/.test(sql)) throw noColumn();
    const active = sql.includes('AND disabled_at IS NULL'), pick = (rows) => (active ? rows.filter((u) => !u.disabled_at) : rows);
    if (sql.startsWith('SELECT * FROM users WHERE LOWER(email)')) return [s.users.filter((u) => u.email === String(p[0]).toLowerCase())];
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [pick(s.users.filter((u) => u.user_id === p[0])).map((u) => ({ user_id: u.user_id }))];
    if (sql.startsWith('SELECT disabled_at FROM users WHERE user_id')) return [s.users.filter((u) => u.user_id === p[0]).map((u) => ({ disabled_at: u.disabled_at }))];
    if (sql.startsWith('SELECT user_id, email, role, first_name, last_name, avatar_path, must_change_password')) return [pick(s.users.filter((u) => u.user_id === p[0]))];
    if (sql.startsWith('SELECT user_id, email, first_name FROM users WHERE LOWER(email)')) return [pick(s.users.filter((u) => u.email === p[0]))];
    if (sql.startsWith('SELECT user_id, email, role, first_name FROM users WHERE user_id')) return [s.users.filter((u) => u.user_id === p[0])];
    if (sql.startsWith('SELECT user_id, email, role, first_name, last_name, avatar_path, created_at FROM users ORDER BY')) return [s.users.map((u) => ({ ...u }))];
    if (sql.startsWith('SELECT user_id FROM users WHERE disabled_at IS NOT NULL')) return [s.users.filter((u) => u.disabled_at).map((u) => ({ user_id: u.user_id }))];
    if (sql.startsWith("SELECT user_id, role, disabled_at FROM users WHERE user_id = ? OR role = 'admin' ORDER BY user_id FOR UPDATE")) { assert.equal(s.open, true); return [s.users.filter((u) => u.user_id === p[0] || u.role === 'admin').sort((a, b) => a.user_id - b.user_id).map(({ user_id, role, disabled_at }) => ({ user_id, role, disabled_at }))]; }
    if (sql.startsWith('UPDATE users SET disabled_at = NOW()')) { assert.equal(s.open, true); s.writes.push('disable ' + p[1]); Object.assign(s.users.find((u) => u.user_id === p[1]), { disabled_at: '2026-11-07 07:00:00', disabled_by: p[0] }); return [{ affectedRows: 1 }]; }
    if (sql.startsWith('UPDATE users SET disabled_at = NULL')) { assert.equal(s.open, true); s.writes.push('enable ' + p[0]); Object.assign(s.users.find((u) => u.user_id === p[0]), { disabled_at: null, disabled_by: null }); return [{ affectedRows: 1 }]; }
    if (sql.startsWith('DELETE FROM remember_tokens WHERE user_id')) { s.tokens = s.tokens.filter((t) => t.user_id !== p[0]); return [{}]; }
    if (sql.startsWith('DELETE FROM password_temp WHERE user_id')) { s.temp = s.temp.filter((t) => t.user_id !== p[0]); return [{}]; }
    if (sql.startsWith('SELECT temp_hash FROM password_temp')) return [[]];
    if (sql.startsWith('INSERT INTO password_temp')) { s.temp.push({ user_id: p[0] }); return [{}]; }
    if (sql.startsWith('DELETE FROM remember_tokens WHERE token_hash')) return [{}];
    if (sql.startsWith('INSERT INTO account_activity')) { const [user_id, action, , subject, notes] = p; s.activity.push({ user_id, action, subject, notes }); return [{}]; }
    if (sql.startsWith('SELECT first_name, last_name FROM users WHERE user_id')) return [s.users.filter((u) => u.user_id === p[0]).map((u) => ({ first_name: u.first_name, last_name: u.last_name }))];
    throw new Error('Unexpected query: ' + sql);
  };
  const conn = { query, beginTransaction: async () => { s.open = true; }, commit: async () => { s.open = false; }, rollback: async () => { s.open = false; }, release() {} };
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-session', resave: false, saveUninitialized: false }));
  app.locals.db = { query, getConnection: async () => conn };
  app.use('/api/auth', require('./auth'));
  app.use('/api/users', require('./users'));
  app.get('/api/protected', requireAuth, (req, res) => res.json({ ok: true }));
  const server = await new Promise((resolve) => { const sv = app.listen(0, '127.0.0.1', () => resolve(sv)); });
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const client = () => {
    let cookie = '';
    return async (route, method = 'GET', body) => {
      const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      for (const item of response.headers.getSetCookie()) if (item.startsWith('connect.sid=')) cookie = item.split(';')[0];
      return { status: response.status, body: await response.json() };
    };
  };
  const signedIn = async (email) => { const c = client(); assert.equal((await c('/auth/login', 'POST', { email, password: PASS })).status, 200, email); return c; };
  try { await fn({ s, client, signedIn }); } finally { await new Promise((resolve) => server.close(resolve)); }
}

test('an Admin disables an account: its open session ends at the next request, its remembered devices and temporary password are gone, and it cannot sign in', () => withServer(async ({ s, client, signedIn }) => {
  const admin = await signedIn('admin@x.ph'), faculty = await signedIn('faculty@x.ph');
  assert.equal((await faculty('/protected')).status, 200);
  const records = JSON.stringify(s.records);
  const r = await admin('/users/5/disable', 'POST');
  assert.equal(r.status, 200); assert.deepEqual(r.body, { id: 5, disabled: true });
  assert.equal(s.users.find((u) => u.user_id === 5).disabled_by, 1);
  assert.deepEqual(s.tokens.map((t) => t.user_id), [6]); assert.deepEqual(s.temp, []);
  const refused = await faculty('/protected');
  assert.equal(refused.status, 403); assert.equal(refused.body.code, 'account_disabled'); assert.match(refused.body.error, /This account is disabled/);
  assert.equal((await faculty('/protected')).status, 401, 'the session itself was ended');
  const again = await client()('/auth/login', 'POST', { email: 'faculty@x.ph', password: PASS });
  assert.equal(again.status, 403); assert.equal(again.body.code, 'account_disabled');
  const wrong = await client()('/auth/login', 'POST', { email: 'faculty@x.ph', password: 'not-the-password' });
  assert.equal(wrong.status, 401, 'a wrong password learns nothing about the account state');
  assert.equal(JSON.stringify(s.records), records, 'no academic record changes');
  const list = await admin('/users');
  assert.equal(list.body.find((u) => u.id === 5).disabled, true); assert.equal(list.body.find((u) => u.id === 1).disabled, false);
}));

test('a disabled account cannot read /auth/me, gets no temporary password, and an Admin cannot resend it credentials', () => withServer(async ({ s, signedIn, client }) => {
  const admin = await signedIn('admin@x.ph'), faculty = await signedIn('faculty@x.ph');
  await admin('/users/5/disable', 'POST');
  const me = await faculty('/auth/me'); assert.equal(me.status, 401);
  s.temp = [];
  const forgot = await client()('/auth/forgot-password', 'POST', { email: 'faculty@x.ph' });
  assert.equal(forgot.status, 200, 'the same answer as for any address');
  await new Promise((r) => setTimeout(r, 300));
  assert.deepEqual(s.temp, [], 'no temporary password was made');
  const resend = await admin('/users/5/resend-credentials', 'POST');
  assert.equal(resend.status, 409); assert.equal(resend.body.code, 'account_disabled');
}));

test('re-enabling restores sign-in; disabling and enabling twice changes nothing more', () => withServer(async ({ s, signedIn, client }) => {
  const admin = await signedIn('admin@x.ph');
  await admin('/users/6/disable', 'POST'); await admin('/users/6/disable', 'POST');
  assert.deepEqual(s.writes, ['disable 6']);
  const e = await admin('/users/6/enable', 'POST'); assert.equal(e.status, 200); assert.deepEqual(e.body, { id: 6, disabled: false });
  await admin('/users/6/enable', 'POST'); assert.deepEqual(s.writes, ['disable 6', 'enable 6']);
  assert.equal((await client()('/auth/login', 'POST', { email: 'vpaa@x.ph', password: PASS })).status, 200);
}));

test('no self-disable, only an administrator may disable or enable, and an unknown account is a 404', () => withServer(async ({ s, signedIn }) => {
  const admin = await signedIn('admin@x.ph'), faculty = await signedIn('faculty@x.ph');
  const self = await admin('/users/1/disable', 'POST'); assert.equal(self.status, 400); assert.equal(self.body.code, 'cannot_disable_self');
  assert.equal((await faculty('/users/6/disable', 'POST')).status, 403);
  assert.equal((await faculty('/users/6/enable', 'POST')).status, 403);
  assert.equal((await admin('/users/999/disable', 'POST')).status, 404);
  assert.deepEqual(s.writes, []);
}));

test('the last active administrator stays: over HTTP, and in the transaction whoever asks', () => withServer(async ({ s, signedIn }) => {
  const one = await signedIn('admin@x.ph'), two = await signedIn('dean2@x.ph');
  assert.equal((await one('/users/2/disable', 'POST')).status, 200, 'two active administrators: one may disable the other');
  const fromTwo = await two('/users/1/disable', 'POST');
  assert.equal(fromTwo.status, 403, 'the disabled administrator is refused at its next request'); assert.equal(fromTwo.body.code, 'account_disabled');
  // The rule itself, in the transaction, as if another administrator's request reached it: 1 is the only active administrator, so it stays.
  const { setDisabled } = require('../lib/accountStatus');
  const lockedRead = (sql, p) => (sql.startsWith('SELECT user_id, role, disabled_at') ? [s.users.filter((u) => u.user_id === p[0] || u.role === 'admin').map(({ user_id, role, disabled_at }) => ({ user_id, role, disabled_at }))] : assert.fail('no write expected: ' + sql));
  const db = { getConnection: async () => ({ query: async (sql, p) => lockedRead(sql, p), beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {} }) };
  await assert.rejects(setDisabled(db, 6, 1, true), (e) => e.status === 409 && e.body.code === 'last_active_admin' && /At least one administrator account must stay active/.test(e.message));
  assert.deepEqual(s.users.filter((u) => u.role === 'admin' && !u.disabled_at).map((u) => u.user_id), [1]);
  assert.equal((await one('/users/2/enable', 'POST')).status, 200, 'enabling is always allowed');
}));

test('before the migration every account is active, sign-in works, and disabling says the database update is needed', () => withServer(async ({ client, signedIn }) => {
  const admin = await signedIn('admin@x.ph');
  const faculty = await signedIn('faculty@x.ph');
  assert.equal((await faculty('/protected')).status, 200);
  const r = await admin('/users/5/disable', 'POST');
  assert.equal(r.status, 503); assert.equal(r.body.code, 'account_status_not_installed');
  assert.equal((await faculty('/protected')).status, 200);
  assert.equal((await client()('/auth/login', 'POST', { email: 'faculty@x.ph', password: PASS })).status, 200);
}, { migrated: false }));

// Recent Activity for transparency (lib/accountActivity.js): the Admin's disabling and enabling are recorded on the Admin, naming the account, only when
// something changed; a sign-in refused because the account is disabled, and a wrong password, are recorded on the account they were for.
test('disabling and enabling are recorded on the Admin, naming the account, once each; refused sign-ins on the account they were for', () => withServer(async ({ s, signedIn, client }) => {
  s.users.find((u) => u.user_id === 6).first_name = 'Vee'; s.users.find((u) => u.user_id === 6).last_name = 'Paa';
  const admin = await signedIn('admin@x.ph');
  s.activity.length = 0;
  await admin('/users/6/disable', 'POST'); await admin('/users/6/disable', 'POST');
  assert.equal((await client()('/auth/login', 'POST', { email: 'vpaa@x.ph', password: PASS })).status, 403);
  assert.equal((await client()('/auth/login', 'POST', { email: 'vpaa@x.ph', password: 'not-the-password' })).status, 401);
  await admin('/users/6/enable', 'POST'); await admin('/users/6/enable', 'POST');
  assert.deepEqual(s.activity.map((a) => [a.user_id, a.action, a.subject, a.notes]), [
    [1, 'user_disable', 'Vee Paa', null], [6, 'login_failed', null, 'disabled'], [6, 'login_failed', null, 'password'], [1, 'user_enable', 'Vee Paa', null]]);
  assert.ok(!JSON.stringify(s.activity).includes('not-the-password') && !JSON.stringify(s.activity).includes(PASS), 'never a password');
}));
