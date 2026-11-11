// HTTP-level tests for sign-in hardening (docs/security/SECURITY-AUDIT-REPORT.md SEC-02, SEC-04, SEC-05, SEC-06, SEC-12, SEC-13):
//   - failed password and Google sign-ins are limited per account and per address, and a correct sign-in is never counted;
//   - an unknown email gets the same answer as a wrong password;
//   - signing in (by password, by Google, or from a remembered device) starts a NEW session id, so a planted cookie is never the signed-in one;
//   - changing the password, or an administrator sending new credentials, ends that account's other sessions;
//   - a Google sign-in carries the "choose your own password" flag, and a temporary password works once.
// In-memory fake database, a fake mailer, a fake Google verifier, real sessions. Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.ALLOWED_EMAIL_DOMAIN = 'x.ph';
const mailer = require('../lib/mailer');
const authRoutes = require('./auth');
const userRoutes = require('./users');
const { requireAuth, restoreSession } = require('../middleware/auth');
const { resolveSignInLimits } = require('../lib/signInLimits');

const LIMITS = resolveSignInLimits({});

function makeDb() {
  const s = {
    users: [
      { user_id: 1, email: 'dean@x.ph', password_hash: bcrypt.hashSync('Dean-pass-1', 4), must_change_password: 0, role: 'admin', first_name: 'Ann', last_name: 'Dean', avatar_path: null, disabled_at: null },
      { user_id: 2, email: 'fay@x.ph', password_hash: bcrypt.hashSync('Fay-pass-12', 4), must_change_password: 0, role: 'faculty', first_name: 'Fay', last_name: 'F', avatar_path: null, disabled_at: null },
      { user_id: 3, email: 'gus@x.ph', password_hash: bcrypt.hashSync('Gus-made-99', 4), must_change_password: 1, role: 'faculty', first_name: 'Gus', last_name: 'G', avatar_path: null, disabled_at: null },
    ],
    temp: new Map(),
    remember: [], // { token_id, user_id, token_hash }
    nextToken: 1,
  };
  const byId = (id) => s.users.find((u) => u.user_id === id);
  const handle = (sql, p = []) => {
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [s.users.filter((u) => u.user_id === p[0] && !u.disabled_at).map((u) => ({ user_id: u.user_id }))];
    if (sql.startsWith('SELECT * FROM users WHERE LOWER(email)')) return [s.users.filter((u) => u.email.toLowerCase() === String(p[0]).toLowerCase())];
    if (sql.startsWith('SELECT user_id, email, role, first_name, last_name, avatar_path, must_change_password, preferred_language FROM users WHERE LOWER(email)')) return [s.users.filter((u) => u.email.toLowerCase() === String(p[0]).toLowerCase()).map((u) => ({ ...u }))];
    if (sql.startsWith('SELECT user_id, email, role, first_name, last_name, avatar_path, must_change_password')) return [s.users.filter((u) => u.user_id === p[0] && !u.disabled_at).map((u) => ({ ...u }))];
    if (sql.startsWith('SELECT user_id, email, first_name FROM users WHERE LOWER(email)')) return [s.users.filter((u) => u.email.toLowerCase() === p[0])];
    if (sql.startsWith('SELECT user_id, email, role, first_name FROM users WHERE user_id')) return [s.users.filter((u) => u.user_id === p[0])];
    if (sql.startsWith('SELECT disabled_at FROM users WHERE user_id')) return [s.users.filter((u) => u.user_id === p[0]).map((u) => ({ disabled_at: u.disabled_at }))];
    if (sql.startsWith('SELECT user_id, password_hash FROM users WHERE user_id')) return [s.users.filter((u) => u.user_id === p[0])];
    if (sql.startsWith('SELECT first_name, last_name FROM users WHERE user_id')) return [s.users.filter((u) => u.user_id === p[0])];
    if (sql.startsWith('SELECT temp_hash FROM password_temp')) { const t = s.temp.get(p[0]); return [t ? [{ temp_hash: t }] : []]; }
    if (sql.startsWith('INSERT INTO password_temp')) { s.temp.set(p[0], p[1]); return [{}]; }
    if (sql.startsWith('DELETE FROM password_temp')) { s.temp.delete(p[0]); return [{}]; }
    if (sql.startsWith('UPDATE users SET must_change_password = 1 WHERE')) { byId(p[0]).must_change_password = 1; return [{}]; }
    if (sql.startsWith('UPDATE users SET password_hash = ?, must_change_password = 0')) { Object.assign(byId(p[1]), { password_hash: p[0], must_change_password: 0 }); return [{}]; }
    if (sql.startsWith('UPDATE users SET password_hash = ?, must_change_password = 1')) { Object.assign(byId(p[1]), { password_hash: p[0], must_change_password: 1 }); return [{}]; }
    if (sql.startsWith('INSERT INTO remember_tokens')) { s.remember.push({ token_id: s.nextToken++, user_id: p[0], token_hash: p[1] }); return [{}]; }
    if (sql.startsWith('SELECT t.token_id, u.*')) return [s.remember.filter((t) => t.token_hash === p[0]).map((t) => ({ token_id: t.token_id, ...byId(t.user_id) }))];
    if (sql.startsWith('DELETE FROM remember_tokens WHERE expires_at')) return [{}];
    if (sql.startsWith('DELETE FROM remember_tokens WHERE token_id')) { s.remember = s.remember.filter((t) => t.token_id !== p[0]); return [{}]; }
    if (sql.startsWith('DELETE FROM remember_tokens WHERE token_hash')) { s.remember = s.remember.filter((t) => t.token_hash !== p[0]); return [{}]; }
    if (sql.startsWith('DELETE FROM remember_tokens WHERE user_id')) { s.remember = s.remember.filter((t) => t.user_id !== p[0]); return [{}]; }
    if (sql.startsWith('INSERT INTO account_activity')) return [{}];
    if (/program_outcome_sources/.test(sql)) throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' });
    throw new Error('unexpected query: ' + sql);
  };
  return { s, query: async (q, p) => handle(q, p) };
}

const outbox = () => { const sent = []; mailer.setTransport({ sent, sendMail: async (m) => { sent.push(m); } }); return sent; };
const passwordIn = (mail) => /Temporary password: (\S+)/.exec(mail.text)[1];

async function withServer(fn) {
  const db = makeDb();
  authRoutes.forgotLimiter.reset();
  authRoutes.signInLimiter.reset();
  userRoutes.resendLimiter.reset();
  // The Google verifier: a token "google:<email>" is a verified school account; anything else fails verification.
  authRoutes.setGoogleClient({ verifyIdToken: async ({ idToken }) => { const m = /^google:(.+)$/.exec(idToken); if (!m) throw new Error('bad token'); return { getPayload: () => ({ email: m[1], email_verified: true }) }; } });
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 't', resave: false, saveUninitialized: false }));
  app.locals.db = db;
  app.get('/api/visit', (req, res) => { req.session.visited = true; res.json({}); }); // an anonymous session, as a public page would start one
  app.use(restoreSession);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.get('/api/ping', requireAuth, (req, res) => res.json({ ok: true }));
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const client = () => {
    const jar = new Map();
    const call = async (method, path, body) => {
      const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(jar.size ? { cookie: [...jar].map(([k, v]) => k + '=' + v).join('; ') } : {}) }, body: body ? JSON.stringify(body) : undefined });
      for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); if (kv.slice(i + 1)) jar.set(kv.slice(0, i), kv.slice(i + 1)); else jar.delete(kv.slice(0, i)); }
      return { status: res.status, body: await res.json().catch(() => ({})), headers: res.headers };
    };
    call.login = (email, password, extra = {}) => call('POST', '/auth/login', { email, password, ...extra });
    call.jar = jar;
    call.sid = () => jar.get('connect.sid');
    return call;
  };
  try { await fn({ db, client }); } finally { await authRoutes.settled(); await new Promise((r) => server.close(r)); mailer.setTransport(null); authRoutes.setGoogleClient(null); }
}

// ---- SEC-02: limits ----

test('wrong passwords for one account are limited: after the allowed number the account answers 429, even to the right password, and other accounts are untouched', () => withServer(async ({ client }) => {
  const c = client();
  for (let i = 0; i < LIMITS.perAccount; i++) assert.strictEqual((await c.login('fay@x.ph', 'wrong-' + i)).status, 401, 'attempt ' + i);
  const blocked = await c.login('fay@x.ph', 'wrong-again');
  assert.strictEqual(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  assert.strictEqual(blocked.body.code, 'too_many_attempts');
  assert.strictEqual((await c.login('FAY@x.ph', 'Fay-pass-12')).status, 429); // the same account however it is typed; the password is not even tried
  assert.strictEqual((await c.login('dean@x.ph', 'Dean-pass-1')).status, 200);
}));

test('a correct sign-in is never counted, and it does not wipe out earlier failures either', () => withServer(async ({ client }) => {
  const c = client();
  for (let i = 0; i < LIMITS.perAccount * 3; i++) assert.strictEqual((await c.login('fay@x.ph', 'Fay-pass-12')).status, 200);
  for (let i = 0; i < LIMITS.perAccount - 1; i++) assert.strictEqual((await c.login('fay@x.ph', 'wrong')).status, 401);
  assert.strictEqual((await c.login('fay@x.ph', 'Fay-pass-12')).status, 200); // one failure short of the limit: still open
  assert.strictEqual((await c.login('fay@x.ph', 'wrong')).status, 401);       // the last allowed failure
  assert.strictEqual((await c.login('fay@x.ph', 'wrong')).status, 429);
}));

test('failures from one address are limited across accounts, known or not', () => withServer(async ({ client }) => {
  const c = client();
  for (let i = 0; i < LIMITS.perIp; i++) assert.strictEqual((await c.login(`nobody${i}@x.ph`, 'wrong')).status, 401, 'attempt ' + i);
  assert.strictEqual((await c.login('someone-else@x.ph', 'wrong')).status, 429);
  assert.strictEqual((await c.login('dean@x.ph', 'Dean-pass-1')).status, 429);
}));

test('failed Google sign-ins are limited per address; a verified one is never counted', () => withServer(async ({ client }) => {
  const c = client();
  for (let i = 0; i < LIMITS.perIp * 2; i++) assert.strictEqual((await c('POST', '/auth/google', { token: 'google:fay@x.ph' })).status, 200);
  for (let i = 0; i < LIMITS.perIp; i++) assert.strictEqual((await c('POST', '/auth/google', { token: 'forged-' + i })).status, 401);
  assert.strictEqual((await c('POST', '/auth/google', { token: 'forged' })).status, 429);
}));

test('the limits come from the environment, with safe defaults, and a bad value stops the server by name', () => {
  assert.deepStrictEqual(resolveSignInLimits({}), { perAccount: 10, perIp: 50, windowMs: 15 * 60 * 1000 });
  assert.deepStrictEqual(resolveSignInLimits({ SIGNIN_MAX_FAILURES_PER_ACCOUNT: '5', SIGNIN_MAX_FAILURES_PER_IP: '20', SIGNIN_WINDOW_MINUTES: '30' }), { perAccount: 5, perIp: 20, windowMs: 30 * 60 * 1000 });
  for (const [name, value] of [['SIGNIN_MAX_FAILURES_PER_ACCOUNT', '0'], ['SIGNIN_MAX_FAILURES_PER_ACCOUNT', 'off'], ['SIGNIN_MAX_FAILURES_PER_ACCOUNT', '100000'], ['SIGNIN_MAX_FAILURES_PER_IP', '-1'], ['SIGNIN_MAX_FAILURES_PER_IP', '1.5'], ['SIGNIN_WINDOW_MINUTES', '0'], ['SIGNIN_WINDOW_MINUTES', 'forever']]) {
    for (const mode of ['', 'staging', 'production']) {
      assert.throws(() => resolveSignInLimits({ NODE_ENV: mode, [name]: value }), (e) => e.code === 'signin_limits_invalid' && e.message.includes(name) && !e.message.includes('undefined'), name + '=' + value);
    }
  }
});

// ---- SEC-04: the same answer ----

test('an unknown email and a wrong password get the same status and the same message', () => withServer(async ({ client }) => {
  const c = client();
  const unknown = await c.login('nobody@x.ph', 'whatever-123'), wrong = await c.login('fay@x.ph', 'whatever-123');
  assert.strictEqual(unknown.status, 401);
  assert.strictEqual(wrong.status, 401);
  assert.deepStrictEqual(unknown.body, wrong.body);
  assert.strictEqual(unknown.body.error, 'Invalid email or password');
}));

// ---- SEC-05: a new session id at sign-in ----

test('signing in with a password starts a new session: a cookie that existed before sign-in is not the signed-in one', () => withServer(async ({ client }) => {
  const c = client();
  await c('GET', '/visit');
  const planted = c.sid();
  assert.ok(planted);
  assert.strictEqual((await c.login('fay@x.ph', 'Fay-pass-12')).status, 200);
  assert.notStrictEqual(c.sid(), planted);
  assert.strictEqual((await c('GET', '/ping')).status, 200);
  const attacker = client(); attacker.jar.set('connect.sid', planted);
  assert.strictEqual((await attacker('GET', '/ping')).status, 401);
}));

test('signing in with Google starts a new session too', () => withServer(async ({ client }) => {
  const c = client();
  await c('GET', '/visit');
  const planted = c.sid();
  assert.strictEqual((await c('POST', '/auth/google', { token: 'google:fay@x.ph' })).status, 200);
  assert.notStrictEqual(c.sid(), planted);
  const attacker = client(); attacker.jar.set('connect.sid', planted);
  assert.strictEqual((await attacker('GET', '/ping')).status, 401);
}));

test('a remembered device is signed in on a new session id, not on whatever session cookie the browser already had', () => withServer(async ({ client }) => {
  const first = client();
  assert.strictEqual((await first.login('fay@x.ph', 'Fay-pass-12', { remember: true })).status, 200);
  const later = client(); // the same browser later: its session is gone, the remember cookie is not, and someone planted a session cookie
  later.jar.set('remember_token', first.jar.get('remember_token'));
  await later('GET', '/visit');
  const planted = later.sid();
  later.jar.set('remember_token', first.jar.get('remember_token'));
  assert.strictEqual((await later('GET', '/ping')).status, 200);
  assert.notStrictEqual(later.sid(), planted);
  const attacker = client(); attacker.jar.set('connect.sid', planted);
  assert.strictEqual((await attacker('GET', '/ping')).status, 401);
}));

// ---- SEC-06: other sessions end ----

test('changing the password ends the account\'s other sessions and moves this one to a new session id', () => withServer(async ({ client }) => {
  const here = client(), elsewhere = client();
  await here.login('fay@x.ph', 'Fay-pass-12'); await elsewhere.login('fay@x.ph', 'Fay-pass-12');
  assert.strictEqual((await elsewhere('GET', '/ping')).status, 200);
  const before = here.sid();
  assert.strictEqual((await here('POST', '/auth/change-password', { currentPassword: 'Fay-pass-12', newPassword: 'Fay-new-pass-34' })).status, 200);
  assert.notStrictEqual(here.sid(), before);
  assert.strictEqual((await here('GET', '/ping')).status, 200);
  assert.strictEqual((await elsewhere('GET', '/ping')).status, 401);
  assert.strictEqual((await elsewhere('GET', '/auth/me')).status, 401);
  const stolen = client(); stolen.jar.set('connect.sid', before); // the id this session had before the change is dead as well
  assert.strictEqual((await stolen('GET', '/ping')).status, 401);
  const fresh = client();
  assert.strictEqual((await fresh.login('fay@x.ph', 'Fay-new-pass-34')).status, 200); // a sign-in after the change is a normal session
  assert.strictEqual((await fresh('GET', '/ping')).status, 200);
  const dean = client(); await dean.login('dean@x.ph', 'Dean-pass-1');
  assert.strictEqual((await dean('GET', '/ping')).status, 200); // nobody else is affected
}));

test('an administrator sending new credentials ends that account\'s open sessions', () => withServer(async ({ client }) => {
  outbox();
  const fay = client(), dean = client();
  await fay.login('fay@x.ph', 'Fay-pass-12'); await dean.login('dean@x.ph', 'Dean-pass-1');
  assert.strictEqual((await dean('POST', '/users/2/resend-credentials')).body.emailSent, true);
  assert.strictEqual((await fay('GET', '/ping')).status, 401);
  assert.strictEqual((await dean('GET', '/ping')).status, 200);
}));

// ---- SEC-12, SEC-13 ----

test('a Google sign-in on an account that still has a generated password must choose its own before anything else', () => withServer(async ({ client }) => {
  const c = client();
  const signedIn = await c('POST', '/auth/google', { token: 'google:gus@x.ph' });
  assert.strictEqual(signedIn.status, 200);
  assert.strictEqual(signedIn.body.user.mustChangePassword, true);
  const refused = await c('GET', '/ping');
  assert.strictEqual(refused.status, 403);
  assert.strictEqual(refused.body.code, 'password_change_required');
}));

test('a temporary password signs in once: the second use is refused, and the real password still works', () => withServer(async ({ client }) => {
  const sent = outbox();
  const c = client();
  await c('POST', '/auth/forgot-password', { email: 'fay@x.ph' });
  await authRoutes.settled();
  const temp = passwordIn(sent[0]);
  assert.strictEqual((await client().login('fay@x.ph', temp)).status, 200);
  assert.strictEqual((await client().login('fay@x.ph', temp)).status, 401);
  assert.strictEqual((await client().login('fay@x.ph', 'Fay-pass-12')).status, 200);
}));

test('a student registration password follows the same rule as every other chosen password', async () => {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 't', resave: false, saveUninitialized: false }));
  app.locals.db = { query: async () => { throw new Error('the password is checked before anything is read'); } };
  app.use('/api/students', require('./students'));
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const register = async (password) => { const res = await fetch(`http://127.0.0.1:${server.address().port}/api/students/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }); return { status: res.status, body: await res.json() }; };
  try {
    for (const bad of ['short1', 'onlyletters', '1234567890', 'a1'.repeat(40)]) { const r = await register(bad); assert.strictEqual(r.status, 400, bad); assert.match(r.body.error, /password/i); }
    const fine = await register('Good-pass-1'); // a valid password gets as far as "scan your COR first"
    assert.strictEqual(fine.status, 400);
    assert.match(fine.body.error, /Scan your COR/);
  } finally { await new Promise((r) => server.close(r)); }
});
