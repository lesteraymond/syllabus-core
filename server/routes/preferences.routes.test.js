const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
process.env.JWT_SECRET = 'preference-tests-only';
process.env.GOOGLE_CLIENT_ID = 'test-client';
process.env.ALLOWED_EMAIL_DOMAIN = 'x.ph';
const { toSessionUser } = require('../middleware/auth');
const auth = require('./auth');
const settings = require('./settings');

async function withServer(fn) {
  const rows = [
    { user_id: 1, email: 'admin@x.ph', role: 'admin', preferred_language: 'tl' },
    { user_id: 2, email: 'faculty@x.ph', role: 'faculty' },
    { user_id: 3, email: 'second@x.ph', role: 'faculty' },
    { user_id: 4, email: 'student@x.ph', role: 'student' },
  ].map(u => ({ ...u, first_name: 'Original', last_name: 'Name', avatar_path: null, password_hash: bcrypt.hashSync('Test-pass-12', 4) }));
  let storedSettings;
  let failWrites = false;
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-session', resave: false, saveUninitialized: false }));
  app.locals.db = { query: async (sql, params = []) => {
    if (sql.startsWith('SELECT * FROM users WHERE LOWER(email)') || sql.includes('FROM users WHERE LOWER(email) = LOWER(?)')) return [rows.filter(u => u.email === params[0])];
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [rows.filter(u => u.user_id === params[0])];
    if (sql.startsWith('SELECT user_id, email, role, first_name, last_name, avatar_path, must_change_password')) return [rows.filter(u => u.user_id === params[0])];
    if (sql.startsWith('UPDATE users SET preferred_language')) {
      if (failWrites) throw new Error('test database unavailable');
      const row = rows.find(u => u.user_id === params[1]);
      if (row) row.preferred_language = params[0];
      return [{ affectedRows: row ? 1 : 0 }];
    }
    if (sql.startsWith('UPDATE users SET first_name')) { Object.assign(rows.find(u => u.user_id === params[2]), { first_name: params[0], last_name: params[1] }); return [{ affectedRows: 1 }]; }
    if (sql.startsWith('SELECT setting_value FROM app_settings')) return [storedSettings ? [{ setting_value: storedSettings }] : []];
    if (sql.startsWith('INSERT INTO app_settings')) { if (failWrites) throw new Error('test database unavailable'); storedSettings = params[0]; return [{}]; }
    if (sql.startsWith('SELECT verification_status FROM student_profiles')) return [[{ verification_status: 'approved' }]];
    if (sql.startsWith('DELETE FROM remember_tokens')) return [{}];
    throw new Error('Unexpected query: ' + sql);
  } };
  app.use('/api/auth', auth);
  app.use('/api/users', require('./users'));
  app.use('/api/settings', settings);
  const server = await new Promise(resolve => { const sv = app.listen(0, '127.0.0.1', () => resolve(sv)); });
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const client = () => {
    let cookie = '';
    return async (route, method = 'GET', body) => {
      const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const cookies = response.headers.getSetCookie();
      for (const item of cookies) if (item.startsWith('connect.sid=')) cookie = item.split(';')[0];
      return { status: response.status, body: await response.json() };
    };
  };
  try { await fn({ client, rows, failWrites: value => { failWrites = value; } }); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('English is the default and password sign-in restores the persisted preference', () => withServer(async ({ client }) => {
  const admin = client(), faculty = client();
  assert.equal((await admin('/auth/login', 'POST', { email: 'admin@x.ph', password: 'Test-pass-12' })).body.user.preferredLanguage, 'tl');
  assert.equal((await faculty('/auth/login', 'POST', { email: 'faculty@x.ph', password: 'Test-pass-12' })).body.user.preferredLanguage, 'en');
  assert.equal(toSessionUser({ preferred_language: 'invalid' }).preferredLanguage, 'en');
}));

test('language saves are scoped to the signed-in account, survive sign-out, and survive profile edits', () => withServer(async ({ client, rows }) => {
  const faculty = client(), other = client();
  await faculty('/auth/login', 'POST', { email: 'faculty@x.ph', password: 'Test-pass-12' });
  await other('/auth/login', 'POST', { email: 'second@x.ph', password: 'Test-pass-12' });
  assert.equal((await faculty('/users/me/preferences', 'PATCH', { preferredLanguage: 'tl' })).status, 200);
  assert.equal(rows[1].preferred_language, 'tl');
  assert.equal(rows[2].preferred_language, undefined);
  assert.equal((await other('/auth/me')).body.user.preferredLanguage, 'en');
  assert.equal((await faculty('/users/me/profile', 'PATCH', { firstName: 'New', lastName: 'Name' })).body.user.preferredLanguage, 'tl');
  await faculty('/auth/logout', 'POST');
  assert.equal((await faculty('/auth/login', 'POST', { email: 'faculty@x.ph', password: 'Test-pass-12' })).body.user.preferredLanguage, 'tl');
}));

test('invalid languages, extra fields and unauthenticated writes never change preferences', () => withServer(async ({ client, rows }) => {
  const faculty = client();
  assert.equal((await faculty('/users/me/preferences', 'PATCH', { preferredLanguage: 'tl' })).status, 401);
  await faculty('/auth/login', 'POST', { email: 'faculty@x.ph', password: 'Test-pass-12' });
  for (const body of [{}, { preferredLanguage: 'de' }, { preferredLanguage: null }, { preferredLanguage: 'tl', userId: 1 }, { preferredLanguage: 'tl', aiChecking: false }]) {
    assert.equal((await faculty('/users/me/preferences', 'PATCH', body)).status, 400);
  }
  assert.equal(rows[1].preferred_language, undefined);
}));

test('a failed save preserves the stored and session language', () => withServer(async ({ client, rows, failWrites }) => {
  const faculty = client();
  await faculty('/auth/login', 'POST', { email: 'faculty@x.ph', password: 'Test-pass-12' });
  failWrites(true);
  assert.equal((await faculty('/users/me/preferences', 'PATCH', { preferredLanguage: 'tl' })).status, 500);
  assert.equal(rows[1].preferred_language, undefined);
  assert.equal((await faculty('/auth/me')).body.user.preferredLanguage, 'en');
}));

test('administrative settings require server-side administrator access and persist validated values', () => withServer(async ({ client, failWrites }) => {
  const admin = client(), faculty = client();
  await admin('/auth/login', 'POST', { email: 'admin@x.ph', password: 'Test-pass-12' });
  await faculty('/auth/login', 'POST', { email: 'faculty@x.ph', password: 'Test-pass-12' });
  const config = { ...settings.DEFAULTS, strictValidation: true };
  assert.equal((await faculty('/settings')).status, 403);
  assert.equal((await faculty('/settings', 'PUT', config)).status, 403);
  // The standard is readable by an administrator only, and it is the checker's own.
  assert.equal((await faculty('/settings/standard')).status, 403);
  const std = (await admin('/settings/standard')).body.standard;
  assert.equal(std.title, settings.DEFAULTS.template);
  assert.equal(std.passThreshold, 79);
  assert.ok(std.rules.length > 50 && std.areas.length === 6);
  // What is still a project decision reads as sentences, not field names.
  assert.ok(std.pending.length > 0 && std.pending.every(x => !/[\[\]_]|constants\./.test(x)));
  assert.deepEqual((await admin('/settings')).body.settings, settings.DEFAULTS);
  assert.equal((await admin('/settings', 'PUT', config)).status, 200);
  assert.deepEqual((await admin('/settings')).body.settings, config);
  assert.equal((await admin('/settings', 'PUT', { ...config, aiChecking: 'yes' })).status, 400);
  assert.equal((await admin('/settings', 'PUT', { ...config, role: 'faculty' })).status, 400);
  // One department only: any other name is refused, and so is a template or year the system does not use.
  assert.equal((await admin('/settings', 'PUT', { ...config, department: 'Custom department' })).status, 400);
  // The academic year is the one editable value, and it must be two consecutive years.
  assert.equal((await admin('/settings', 'PUT', { ...config, academicYear: '2026–2028' })).status, 400);
  failWrites(true);
  assert.equal((await admin('/settings', 'PUT', { ...config, strictValidation: false })).status, 500);
  assert.deepEqual((await admin('/settings')).body.settings, config);
}));

test('Google sign-in returns the persisted language after verified account matching', () => withServer(async ({ client }) => {
  const original = OAuth2Client.prototype.verifyIdToken;
  OAuth2Client.prototype.verifyIdToken = async () => ({ getPayload: () => ({ email: 'admin@x.ph', email_verified: true }) });
  try {
    const response = await client()('/auth/google', 'POST', { token: 'test-id-token' });
    assert.equal(response.status, 200);
    assert.equal(response.body.user.preferredLanguage, 'tl');
  } finally { OAuth2Client.prototype.verifyIdToken = original; }
}));


test('student accounts cannot use faculty/admin preferences or administrative settings', () => withServer(async ({ client }) => {
  const student = client();
  assert.equal((await student('/auth/login', 'POST', { email: 'student@x.ph', password: 'Test-pass-12' })).status, 200);
  assert.equal((await student('/users/me/preferences', 'PATCH', { preferredLanguage: 'tl' })).status, 403);
  assert.equal((await student('/settings')).status, 403);
}));

test('refresh restores the database language when another session changed the preference', () => withServer(async ({ client }) => {
  const first = client(), second = client();
  for (const account of [first, second]) await account('/auth/login', 'POST', { email: 'faculty@x.ph', password: 'Test-pass-12' });
  await second('/users/me/preferences', 'PATCH', { preferredLanguage: 'tl' });
  assert.equal((await first('/auth/me')).body.user.preferredLanguage, 'tl');
}));
