// HTTP-level tests for generated passwords: an administrator registering a user (the password is made and emailed, never returned), the
// forced change at first sign-in, "Resend credentials", "Forgot password" (a separate temporary password that never locks anyone out),
// and choosing a new password. In-memory fake database, a fake mailer, real sessions. Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const mailer = require('../lib/mailer');
const authRoutes = require('./auth');
const userRoutes = require('./users');
const { requireAuth } = require('../middleware/auth');

const HOUR = 3600 * 1000;

function makeDb() {
  const s = {
    now: Date.parse('2026-03-01T08:00:00Z'),
    nextId: 10,
    users: [
      { user_id: 1, email: 'dean@x.ph', password_hash: bcrypt.hashSync('Dean-pass-1', 4), must_change_password: 0, role: 'admin', first_name: 'Ann', last_name: 'Dean', avatar_path: null },
      { user_id: 2, email: 'fay@x.ph', password_hash: bcrypt.hashSync('Fay-pass-12', 4), must_change_password: 0, role: 'faculty', first_name: 'Fay', last_name: 'F', avatar_path: null },
      { user_id: 3, email: '24-4233-624', password_hash: bcrypt.hashSync('Stud-pass-1', 4), must_change_password: 0, role: 'student', first_name: 'Sam', last_name: 'S', avatar_path: null },
    ],
    temp: new Map(), // user_id -> { temp_hash, expires }
    rememberDeletes: [],
  };
  const byId = (id) => s.users.find((u) => u.user_id === id);
  const handle = (sql, p = []) => {
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [s.users.filter((u) => u.user_id === p[0]).map((u) => ({ user_id: u.user_id }))];
    if (sql.startsWith('SELECT * FROM users WHERE LOWER(email)')) return [s.users.filter((u) => u.email.toLowerCase() === String(p[0]).toLowerCase())];
    if (sql.startsWith('SELECT user_id FROM users WHERE LOWER(email)')) return [s.users.filter((u) => u.email.toLowerCase() === p[0]).map((u) => ({ user_id: u.user_id }))];
    if (sql.startsWith('SELECT user_id, email, first_name FROM users WHERE LOWER(email)')) return [s.users.filter((u) => u.email.toLowerCase() === p[0])];
    if (sql.startsWith('SELECT user_id, email, role, first_name FROM users WHERE user_id')) return [s.users.filter((u) => u.user_id === p[0])];
    if (sql.startsWith('SELECT user_id, password_hash FROM users WHERE user_id')) return [s.users.filter((u) => u.user_id === p[0])];
    if (sql.startsWith('SELECT temp_hash FROM password_temp')) { const t = s.temp.get(p[0]); return [t && t.expires > s.now ? [{ temp_hash: t.temp_hash }] : []]; }
    if (sql.startsWith('INSERT INTO password_temp')) { s.temp.set(p[0], { temp_hash: p[1], expires: s.now + 30 * 60 * 1000 }); return [{}]; }
    if (sql.startsWith('DELETE FROM password_temp')) { s.temp.delete(p[0]); return [{}]; }
    if (sql.startsWith('DELETE FROM remember_tokens WHERE user_id')) { s.rememberDeletes.push(p[0]); return [{}]; }
    if (sql.startsWith('UPDATE users SET must_change_password = 1 WHERE')) { byId(p[0]).must_change_password = 1; return [{}]; }
    if (sql.startsWith('UPDATE users SET password_hash = ?, must_change_password = 0')) { Object.assign(byId(p[1]), { password_hash: p[0], must_change_password: 0 }); return [{}]; }
    if (sql.startsWith('UPDATE users SET password_hash = ?, must_change_password = 1')) { Object.assign(byId(p[1]), { password_hash: p[0], must_change_password: 1 }); return [{}]; }
    if (sql.startsWith('INSERT INTO users')) {
      const [email, password_hash, role, first_name, last_name] = p;
      const u = { user_id: s.nextId++, email, password_hash, must_change_password: 1, role, first_name, last_name, avatar_path: null };
      s.users.push(u);
      return [{ insertId: u.user_id }];
    }
    throw new Error('unexpected query: ' + sql);
  };
  return { s, query: async (q, p) => handle(q, p) };
}

// A fake mailer transport that records what would have been sent.
const outbox = () => { const sent = []; mailer.setTransport({ sent, sendMail: async (m) => { sent.push(m); } }); return sent; };
const passwordIn = (mail) => /Temporary password: (\S+)/.exec(mail.text)[1];

async function withServer(fn) {
  const db = makeDb();
  authRoutes.forgotLimiter.reset();
  userRoutes.resendLimiter.reset();
  const app = express();
  app.set('trust proxy', false);
  app.use(express.json());
  app.use(session({ secret: 't', resave: false, saveUninitialized: false }));
  app.locals.db = db;
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.get('/api/ping', requireAuth, (req, res) => res.json({ ok: true })); // any ordinary signed-in route
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  // a browser: keeps its own cookies
  const client = () => {
    const jar = new Map();
    const call = async (method, path, body) => {
      const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(jar.size ? { cookie: [...jar].map(([k, v]) => k + '=' + v).join('; ') } : {}) }, body: body ? JSON.stringify(body) : undefined });
      for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)); }
      return { status: res.status, body: await res.json().catch(() => ({})), headers: res.headers };
    };
    call.login = (email, password) => call('POST', '/auth/login', { email, password });
    return call;
  };
  try { await fn({ db, client }); } finally { await authRoutes.settled(); await new Promise((r) => server.close(r)); mailer.setTransport(null); }
}

const newUser = { firstName: 'Gus', lastName: 'G', email: 'Gus@X.ph', role: 'faculty' };

test('registering a user makes a password, emails it with the username, and never returns it', () => withServer(async ({ db, client }) => {
  const sent = outbox();
  const admin = client(); await admin.login('dean@x.ph', 'Dean-pass-1');
  const r = await admin('POST', '/users', { ...newUser, password: 'Typed-by-admin-1' }); // a typed password is ignored
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.body.emailSent, true);
  assert.strictEqual(r.body.email, 'gus@x.ph');
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].to, 'gus@x.ph');
  const pw = passwordIn(sent[0]);
  assert.match(sent[0].text, /Username: gus@x\.ph/);
  assert.ok(!JSON.stringify(r.body).includes(pw), 'the password is not in the response');
  assert.notStrictEqual(pw, 'Typed-by-admin-1');
  const row = db.s.users.find((u) => u.email === 'gus@x.ph');
  assert.strictEqual(row.must_change_password, 1);
  assert.ok(bcrypt.compareSync(pw, row.password_hash));
  assert.ok(!bcrypt.compareSync('Typed-by-admin-1', row.password_hash));
}));

test('only an administrator registers users, and the usual checks still apply', () => withServer(async ({ client }) => {
  outbox();
  const admin = client(); await admin.login('dean@x.ph', 'Dean-pass-1');
  const fay = client(); await fay.login('fay@x.ph', 'Fay-pass-12');
  assert.strictEqual((await fay('POST', '/users', newUser)).status, 403);
  assert.strictEqual((await client()('POST', '/users', newUser)).status, 401);
  assert.strictEqual((await admin('POST', '/users', { ...newUser, email: 'fay@x.ph' })).status, 409);
  assert.strictEqual((await admin('POST', '/users', { ...newUser, role: 'student' })).status, 400);
  assert.strictEqual((await admin('POST', '/users', { ...newUser, email: 'not-an-email' })).status, 400);
}));

test('if the email cannot go out the user is still registered, and the response says so', () => withServer(async ({ db, client }) => {
  mailer.setTransport({ sendMail: async () => { throw new Error('smtp down'); } });
  const origErr = console.error; console.error = () => {};
  const admin = client(); await admin.login('dean@x.ph', 'Dean-pass-1');
  let r;
  try { r = await admin('POST', '/users', newUser); } finally { console.error = origErr; }
  assert.strictEqual(r.status, 201);
  assert.deepStrictEqual([r.body.emailSent, r.body.emailReason], [false, 'failed']);
  assert.ok(db.s.users.some((u) => u.email === 'gus@x.ph'));
}));

test('the first sign-in with the emailed password works but opens nothing until the user chooses their own', () => withServer(async ({ db, client }) => {
  const sent = outbox();
  const admin = client(); await admin.login('dean@x.ph', 'Dean-pass-1');
  await admin('POST', '/users', newUser);
  const pw = passwordIn(sent[0]);
  const gus = client();
  const login = await gus.login('gus@x.ph', pw);
  assert.strictEqual(login.status, 200);
  assert.strictEqual(login.body.user.mustChangePassword, true);
  const blocked = await gus('GET', '/ping');
  assert.strictEqual(blocked.status, 403);
  assert.strictEqual(blocked.body.code, 'password_change_required');
  assert.strictEqual((await gus('GET', '/auth/me')).body.user.mustChangePassword, true); // the app can still ask who it is
  assert.strictEqual((await gus('POST', '/auth/change-password', { newPassword: 'short' })).status, 400);
  assert.strictEqual((await gus('POST', '/auth/change-password', { newPassword: 'gus@x.ph' })).status, 400);
  const done = await gus('POST', '/auth/change-password', { newPassword: 'My-own-pass-9' }); // no current password is asked after a generated one
  assert.strictEqual(done.status, 200);
  assert.strictEqual(done.body.user.mustChangePassword, false);
  assert.strictEqual((await gus('GET', '/ping')).status, 200);
  assert.strictEqual(db.s.users.find((u) => u.email === 'gus@x.ph').must_change_password, 0);
  assert.strictEqual((await client().login('gus@x.ph', pw)).status, 401); // the emailed one is gone
  assert.strictEqual((await client().login('gus@x.ph', 'My-own-pass-9')).status, 200);
  assert.strictEqual((await client().login('gus@x.ph', 'My-own-pass-9')).body.user.mustChangePassword, false);
}));

test('choosing a new password when nothing is due asks for the current one, and signs other devices out', () => withServer(async ({ db, client }) => {
  const fay = client(); await fay.login('fay@x.ph', 'Fay-pass-12');
  assert.strictEqual((await fay('POST', '/auth/change-password', { newPassword: 'Another-pass-5' })).status, 401);
  assert.strictEqual((await fay('POST', '/auth/change-password', { currentPassword: 'wrong-one-1', newPassword: 'Another-pass-5' })).status, 401);
  assert.strictEqual((await client()('POST', '/auth/change-password', { currentPassword: 'x', newPassword: 'Another-pass-5' })).status, 401);
  const ok = await fay('POST', '/auth/change-password', { currentPassword: 'Fay-pass-12', newPassword: 'Another-pass-5' });
  assert.strictEqual(ok.status, 200);
  assert.deepStrictEqual(db.s.rememberDeletes, [2]); // remember-me tokens revoked
  assert.strictEqual((await client().login('fay@x.ph', 'Fay-pass-12')).status, 401);
  assert.strictEqual((await client().login('fay@x.ph', 'Another-pass-5')).status, 200);
}));

test('Resend credentials: a new password replaces the old one and must be changed; not for yourself or a student; admin only; rate limited', () => withServer(async ({ db, client }) => {
  const sent = outbox();
  const admin = client(); await admin.login('dean@x.ph', 'Dean-pass-1');
  const r = await admin('POST', '/users/2/resend-credentials');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.emailSent, true);
  const pw = passwordIn(sent[0]);
  assert.ok(!JSON.stringify(r.body).includes(pw));
  assert.strictEqual((await client().login('fay@x.ph', 'Fay-pass-12')).status, 401);
  const fay = client();
  assert.strictEqual((await fay.login('fay@x.ph', pw)).body.user.mustChangePassword, true);
  assert.deepStrictEqual(db.s.rememberDeletes, [2]);
  assert.strictEqual((await admin('POST', '/users/1/resend-credentials')).status, 400); // yourself
  assert.strictEqual((await admin('POST', '/users/3/resend-credentials')).status, 400); // a student: signs in with an ID
  assert.strictEqual((await admin('POST', '/users/99/resend-credentials')).status, 404);
  assert.strictEqual((await fay('POST', '/users/2/resend-credentials')).status, 403);
  for (let i = 0; i < 7; i++) assert.strictEqual((await admin('POST', '/users/2/resend-credentials')).status, 200); // 3 earlier tries (the student and the unknown id count too) + 7 = the limit of 10
  assert.strictEqual((await admin('POST', '/users/2/resend-credentials')).status, 429);
}));

test('Forgot password answers the same for a registered and an unknown email, and only a registered one gets mail', () => withServer(async ({ client }) => {
  const sent = outbox();
  const a = await client()('POST', '/auth/forgot-password', { email: 'fay@x.ph' });
  const b = await client()('POST', '/auth/forgot-password', { email: 'nobody@x.ph' });
  await authRoutes.settled();
  assert.strictEqual(a.status, 200);
  assert.deepStrictEqual(a.body, b.body);
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].to, 'fay@x.ph');
  assert.match(sent[0].text, /30 minutes/);
  assert.strictEqual((await client()('POST', '/auth/forgot-password', { email: 'nonsense' })).status, 400);
}));

test('Forgot password never locks anyone out: the current password keeps working, the temporary one works too and then forces a change', () => withServer(async ({ db, client }) => {
  const sent = outbox();
  await client()('POST', '/auth/forgot-password', { email: 'fay@x.ph' });
  await authRoutes.settled();
  const temp = passwordIn(sent[0]);
  assert.ok(bcrypt.compareSync('Fay-pass-12', db.s.users[1].password_hash), 'the real password was not touched');
  const normal = await client().login('fay@x.ph', 'Fay-pass-12');
  assert.strictEqual(normal.status, 200);
  assert.strictEqual(normal.body.user.mustChangePassword, false);
  const fay = client();
  const viaTemp = await fay.login('fay@x.ph', temp);
  assert.strictEqual(viaTemp.status, 200);
  assert.strictEqual(viaTemp.body.user.mustChangePassword, true);
  assert.strictEqual((await fay('GET', '/ping')).status, 403);
  assert.strictEqual((await fay('POST', '/auth/change-password', { newPassword: 'Fresh-pass-77' })).status, 200);
  assert.strictEqual(db.s.temp.size, 0, 'the temporary password is used up');
  assert.strictEqual((await client().login('fay@x.ph', temp)).status, 401);
  assert.strictEqual((await client().login('fay@x.ph', 'Fay-pass-12')).status, 401);
  assert.strictEqual((await client().login('fay@x.ph', 'Fresh-pass-77')).status, 200);
}));

test('a temporary password expires after 30 minutes, and a newer request replaces an older one', () => withServer(async ({ db, client }) => {
  const sent = outbox();
  await client()('POST', '/auth/forgot-password', { email: 'fay@x.ph' }); await authRoutes.settled();
  await client()('POST', '/auth/forgot-password', { email: 'fay@x.ph' }); await authRoutes.settled();
  const [first, second] = sent.map(passwordIn);
  assert.strictEqual((await client().login('fay@x.ph', first)).status, 401); // replaced
  assert.strictEqual((await client().login('fay@x.ph', second)).status, 200);
  db.s.now += 31 * 60 * 1000;
  assert.strictEqual((await client().login('fay@x.ph', second)).status, 401); // expired
  assert.strictEqual((await client().login('fay@x.ph', 'Fay-pass-12')).status, 200); // the real one is unaffected
}));

test('Forgot password is rate limited per email and per address, with the same kind of answer', () => withServer(async ({ client }) => {
  const sent = outbox();
  for (let i = 0; i < 5; i++) assert.strictEqual((await client()('POST', '/auth/forgot-password', { email: 'fay@x.ph' })).status, 200);
  const blocked = await client()('POST', '/auth/forgot-password', { email: 'fay@x.ph' });
  assert.strictEqual(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) >= 1);
  await authRoutes.settled();
  assert.strictEqual(sent.length, 5);
  authRoutes.forgotLimiter.reset();
  for (let i = 0; i < 5; i++) await client()('POST', '/auth/forgot-password', { email: 'a' + i + '@x.ph' });
  assert.strictEqual((await client()('POST', '/auth/forgot-password', { email: 'other@x.ph' })).status, 429); // same address, many emails
}));

test('the existing sign-in answers are unchanged', () => withServer(async ({ client }) => {
  assert.strictEqual((await client().login('nobody@x.ph', 'x')).status, 403);
  assert.strictEqual((await client().login('fay@x.ph', 'nope')).status, 401);
}));

test('schema.sql carries the same definitions as the migration', () => {
  const schema = fs.readFileSync(require('node:path').join(__dirname, '../db/schema.sql'), 'utf8').replace(/\s+/g, ' ');
  const ddl = require('../db/passwords-ddl');
  assert.ok(ddl.column.ddl.includes('must_change_password TINYINT(1) NOT NULL DEFAULT 0'));
  assert.match(schema, /password_hash VARCHAR\(255\) NOT NULL, must_change_password TINYINT\(1\) NOT NULL DEFAULT 0,/);
  assert.strictEqual(ddl.tables.length, 1);
  assert.match(ddl.tables[0].replace(/\s+/g, ' '), /CREATE TABLE IF NOT EXISTS password_temp \( user_id INT NOT NULL PRIMARY KEY, temp_hash VARCHAR\(255\) NOT NULL, expires_at DATETIME NOT NULL,/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS password_temp \( user_id INT NOT NULL PRIMARY KEY, temp_hash VARCHAR\(255\) NOT NULL, expires_at DATETIME NOT NULL,/);
});
