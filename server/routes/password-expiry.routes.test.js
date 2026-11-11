// Generated passwords expire (docs/security/SECURITY-AUDIT-REPORT.md SEC-12). A password the system makes (a new account, "Resend credentials", the first
// administrator) works for GENERATED_PASSWORD_DAYS days and must be replaced at the first sign-in; after that it is refused with a way forward. A password the
// person chose never expires. In-memory fake database, a fake mailer, real sessions. Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');

process.env.ALLOWED_EMAIL_DOMAIN = 'x.ph';
const mailer = require('../lib/mailer');
const authRoutes = require('./auth');
const userRoutes = require('./users');
const { resolveGeneratedPasswordDays, expiresAt, isExpired, setExpiry } = require('../lib/passwordExpiry');
const { createAdmin } = require('../db/create-admin');

const DAY = 24 * 3600 * 1000;

function makeDb() {
  const s = {
    users: [
      { user_id: 1, email: 'dean@x.ph', password_hash: bcrypt.hashSync('Dean-pass-1', 4), must_change_password: 0, password_expires_at: null, role: 'admin', first_name: 'Ann', last_name: 'Dean', avatar_path: null, disabled_at: null },
      { user_id: 2, email: 'old@x.ph', password_hash: bcrypt.hashSync('Made-pass-12', 4), must_change_password: 1, password_expires_at: new Date(Date.now() - DAY), role: 'faculty', first_name: 'Old', last_name: 'O', avatar_path: null, disabled_at: null },
      { user_id: 3, email: 'new@x.ph', password_hash: bcrypt.hashSync('Made-pass-34', 4), must_change_password: 1, password_expires_at: new Date(Date.now() + DAY), role: 'faculty', first_name: 'New', last_name: 'N', avatar_path: null, disabled_at: null },
      { user_id: 4, email: 'chose@x.ph', password_hash: bcrypt.hashSync('Own-pass-56', 4), must_change_password: 0, password_expires_at: new Date(Date.now() - DAY), role: 'faculty', first_name: 'Chose', last_name: 'C', avatar_path: null, disabled_at: null },
      { user_id: 5, email: 'legacy@x.ph', password_hash: bcrypt.hashSync('Made-pass-78', 4), must_change_password: 1, role: 'faculty', first_name: 'Leg', last_name: 'L', avatar_path: null, disabled_at: null }, // a database before the migration
    ],
    expiries: [],
    nextId: 10,
  };
  const byId = (id) => s.users.find((u) => u.user_id === Number(id));
  const handle = (sql, p = []) => {
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [s.users.filter((u) => u.user_id === p[0]).map((u) => ({ user_id: u.user_id }))];
    if (sql.startsWith('SELECT * FROM users WHERE LOWER(email)')) return [s.users.filter((u) => u.email.toLowerCase() === String(p[0]).toLowerCase())];
    if (sql.startsWith('SELECT user_id FROM users WHERE LOWER(email)')) return [s.users.filter((u) => u.email.toLowerCase() === p[0]).map((u) => ({ user_id: u.user_id }))];
    if (sql.startsWith('SELECT user_id, email, role, first_name FROM users WHERE user_id')) return [s.users.filter((u) => u.user_id === p[0])];
    if (sql.startsWith('SELECT disabled_at FROM users WHERE user_id')) return [s.users.filter((u) => u.user_id === p[0]).map((u) => ({ disabled_at: u.disabled_at }))];
    if (sql.startsWith('SELECT first_name, last_name FROM users WHERE user_id')) return [s.users.filter((u) => u.user_id === p[0])];
    if (sql.startsWith('SELECT temp_hash FROM password_temp')) return [[]];
    if (sql.startsWith('UPDATE users SET password_expires_at = ?')) { s.expiries.push({ userId: Number(p[1]), at: p[0] }); byId(p[1]).password_expires_at = p[0]; return [{ affectedRows: 1 }]; }
    if (sql.startsWith('UPDATE users SET password_hash = ?, must_change_password = 1')) { Object.assign(byId(p[1]), { password_hash: p[0], must_change_password: 1 }); return [{}]; }
    if (sql.startsWith('INSERT INTO users')) { const u = { user_id: s.nextId++, email: p[0], password_hash: p[1], must_change_password: 1, role: p[2], first_name: p[3], last_name: p[4] }; s.users.push(u); return [{ insertId: u.user_id }]; }
    if (sql.startsWith('DELETE FROM password_temp') || sql.startsWith('DELETE FROM remember_tokens') || sql.startsWith('INSERT INTO account_activity')) return [{}];
    if (/program_outcome_sources/.test(sql)) throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' });
    throw new Error('unexpected query: ' + sql);
  };
  return { s, query: async (q, p) => handle(q, p) };
}

async function withServer(fn) {
  const db = makeDb();
  authRoutes.signInLimiter.reset(); userRoutes.resendLimiter.reset();
  const sent = []; mailer.setTransport({ sendMail: async (m) => { sent.push(m); } });
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 't', resave: false, saveUninitialized: false }));
  app.locals.db = db;
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const client = () => {
    let cookie = '';
    const call = async (method, path, body) => {
      const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const set = res.headers.getSetCookie().map((c) => c.split(';')[0]).filter((c) => !c.endsWith('=')); if (set.length) cookie = set.join('; ');
      return { status: res.status, body: await res.json().catch(() => ({})) };
    };
    call.login = (email, password) => call('POST', '/auth/login', { email, password });
    return call;
  };
  try { await fn({ db, client, sent }); } finally { await authRoutes.settled(); mailer.setTransport(null); await new Promise((r) => server.close(r)); }
}

test('an expired generated password is refused, with a way forward; it says nothing until the password itself is proven', () => withServer(async ({ client }) => {
  const expired = await client().login('old@x.ph', 'Made-pass-12');
  assert.strictEqual(expired.status, 403);
  assert.strictEqual(expired.body.code, 'password_expired');
  assert.match(expired.body.error, /Forgot password/);
  assert.strictEqual((await client().login('old@x.ph', 'wrong-pass-1')).status, 401); // a wrong guess learns nothing about the expiry
}));

test('a generated password still in its time works, and must then be replaced', () => withServer(async ({ client }) => {
  const res = await client().login('new@x.ph', 'Made-pass-34');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.user.mustChangePassword, true);
}));

test('a password the person chose never expires, and a database before the migration behaves as before', () => withServer(async ({ client }) => {
  assert.strictEqual((await client().login('chose@x.ph', 'Own-pass-56')).status, 200);
  assert.strictEqual((await client().login('legacy@x.ph', 'Made-pass-78')).status, 200);
}));

test('registering a user and resending credentials give the new password an expiry', () => withServer(async ({ db, client }) => {
  const dean = client();
  assert.strictEqual((await dean.login('dean@x.ph', 'Dean-pass-1')).status, 200);
  const before = Date.now();
  const made = await dean('POST', '/users', { firstName: 'Gus', lastName: 'G', email: 'gus@x.ph', role: 'faculty' });
  assert.strictEqual(made.status, 201);
  assert.strictEqual(made.body.emailSent, true);
  assert.strictEqual((await dean('POST', '/users/3/resend-credentials')).status, 200);
  assert.deepStrictEqual(db.s.expiries.map((e) => e.userId), [made.body.id, 3]);
  for (const e of db.s.expiries) {
    const ms = new Date(e.at).getTime() - before;
    assert.ok(ms > 6.9 * DAY && ms < 7.1 * DAY, 'about seven days');
  }
}));

test('the first administrator\'s password expires too', async () => {
  const db = makeDb();
  const id = await createAdmin(db, { email: 'first@x.ph', password: 'First-pass-99' });
  assert.deepStrictEqual(db.s.expiries.map((e) => e.userId), [id]);
});

test('the number of days comes from the environment, with a default, and a bad value stops the server by name', () => {
  assert.strictEqual(resolveGeneratedPasswordDays({}), 7);
  assert.strictEqual(resolveGeneratedPasswordDays({ GENERATED_PASSWORD_DAYS: '3' }), 3);
  for (const bad of ['0', '91', 'never', '1.5', '-2']) assert.throws(() => resolveGeneratedPasswordDays({ GENERATED_PASSWORD_DAYS: bad }), (e) => e.code === 'password_expiry_invalid' && /GENERATED_PASSWORD_DAYS/.test(e.message), bad);
  const now = Date.parse('2026-11-12T00:00:00Z');
  assert.strictEqual(expiresAt(now, {}).toISOString(), '2026-11-19T00:00:00.000Z');
});

test('isExpired: only a generated password still waiting to be replaced, past its time', () => {
  const now = Date.now(), past = new Date(now - 1000), future = new Date(now + 1000);
  assert.strictEqual(isExpired({ must_change_password: 1, password_expires_at: past }, now), true);
  assert.strictEqual(isExpired({ must_change_password: 1, password_expires_at: future }, now), false);
  assert.strictEqual(isExpired({ must_change_password: 0, password_expires_at: past }, now), false);
  assert.strictEqual(isExpired({ must_change_password: 1, password_expires_at: null }, now), false);
  assert.strictEqual(isExpired({ must_change_password: 1 }, now), false);
});

test('setExpiry is best effort: before the migration it changes nothing and does not throw', async () => {
  const db = { query: async () => { throw Object.assign(new Error("Unknown column 'password_expires_at'"), { code: 'ER_BAD_FIELD_ERROR' }); } };
  assert.strictEqual(await setExpiry(db, 7), false);
});

test('the migration adds the column once, and its dry run changes nothing', async () => {
  const { migrate } = require('../db/migrate-password-expiry');
  const conn = (has) => { const ran = []; return { ran, query: async (sql) => { if (/^SHOW COLUMNS/.test(sql)) return [has ? [{ Field: 'password_expires_at' }] : []]; ran.push(sql); return [{}]; } }; };
  const fresh = conn(false);
  assert.deepStrictEqual(await migrate(fresh, { dryRun: true }), { added: 1 });
  assert.deepStrictEqual(fresh.ran, []);
  assert.deepStrictEqual(await migrate(fresh), { added: 1 });
  assert.match(fresh.ran[0], /^ALTER TABLE users ADD COLUMN password_expires_at DATETIME NULL/);
  const done = conn(true);
  assert.deepStrictEqual(await migrate(done), { added: 0 });
  assert.deepStrictEqual(done.ran, []);
});
