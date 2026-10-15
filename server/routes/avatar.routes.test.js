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
  Object.values(s.users).forEach(user => Object.assign(user, { email: `user${user.user_id}@x.ph`, first_name: 'First', last_name: 'Last', must_change_password: 0 }));
  const handle = (sql, p = []) => {
    if (sql.startsWith('SELECT user_id, email, role, first_name, last_name, avatar_path, must_change_password')) return [s.users[p[0]] ? [{ ...s.users[p[0]] }] : []];
    if (sql.startsWith('UPDATE users SET first_name = ?, last_name = ?')) { Object.assign(s.users[p[2]], { first_name: p[0], last_name: p[1] }); return [{ affectedRows: 1 }]; }
    if (sql.startsWith('UPDATE users SET avatar_path = ?')) { s.users[p[1]].avatar_path = p[0]; return [{ affectedRows: 1 }]; }
    if (sql.startsWith('UPDATE users SET avatar_path = NULL')) { s.users[p[0]].avatar_path = null; return [{ affectedRows: 1 }]; }
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
  const call = async (as, method, route, body) => {
    const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(as ? { 'x-test-user': JSON.stringify(as) } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  };
  try { await fn({ db, status, call }); } finally { await new Promise((r) => server.close(r)); }
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

test('faculty and administrators edit their own name without changing email, role or another account', () => withServer(async ({ call, db }) => {
  for (const user of [fay, admin1]) {
    const before = { ...db.s.users[user.id] };
    const result = await call(user, 'PATCH', '/me/profile', { firstName: '  New First  ', lastName: 'New Last', role: 'admin', email: 'other@x.ph', id: 6 });
    assert.strictEqual(result.status, 200);
    assert.deepStrictEqual([result.body.user.firstName, result.body.user.lastName], ['New First', 'New Last']);
    assert.strictEqual(result.body.user.role, before.role);
    assert.strictEqual(result.body.user.email, before.email);
  }
  assert.strictEqual(db.s.users[6].first_name, 'First');
}));

test('profile name validation and authentication reject invalid requests without changing the account', () => withServer(async ({ call, db }) => {
  for (const firstName of ['', '   ', 'x'.repeat(101), 'Bad\nName', 42, null]) {
    assert.strictEqual((await call(fay, 'PATCH', '/me/profile', { firstName, lastName: 'Last' })).status, 400);
  }
  assert.strictEqual((await call(null, 'PATCH', '/me/profile', { firstName: 'New', lastName: 'Name' })).status, 401);
  assert.strictEqual((await call({ ...gus, role: 'student' }, 'PATCH', '/me/profile', { firstName: 'New', lastName: 'Name' })).status, 403);
  assert.strictEqual(db.s.users[5].first_name, 'First');
}));

test('Google photo sync saves a private avatar for this account and removal deletes the file', () => withServer(async ({ call, db, status }) => {
  const googleProfile = require('../lib/googleProfile');
  const original = googleProfile.getGooglePhoto;
  googleProfile.getGooglePhoto = async (token, email) => {
    assert.strictEqual(token, 'verified-token');
    assert.strictEqual(email, 'user6@x.ph');
    return Buffer.from('verified-photo-bytes');
  };
  try {
    const result = await call(gus, 'POST', '/me/avatar/google', { token: 'verified-token', userId: 5 });
    assert.strictEqual(result.status, 200);
    assert.match(result.body.avatarUrl, /^\/api\/users\/6\/avatar\?v=\d+$/);
    const file = path.join(ROOT, db.s.users[6].avatar_path);
    assert.ok(fs.existsSync(file));
    assert.strictEqual(await status(gus, 6), 200);
    assert.strictEqual((await call(gus, 'DELETE', '/me/avatar')).status, 200);
    assert.strictEqual(db.s.users[6].avatar_path, null);
    assert.ok(!fs.existsSync(file));
  } finally { googleProfile.getGooglePhoto = original; }
}));

test('failed Google verification keeps the existing photo and signed-out requests are refused', () => withServer(async ({ call, db }) => {
  const googleProfile = require('../lib/googleProfile');
  const original = googleProfile.getGooglePhoto;
  googleProfile.getGooglePhoto = async () => { throw Object.assign(new Error('Choose your own account'), { status: 403 }); };
  try {
    const before = db.s.users[5].avatar_path;
    assert.strictEqual((await call(fay, 'POST', '/me/avatar/google', { token: 'wrong-account' })).status, 403);
    assert.strictEqual(db.s.users[5].avatar_path, before);
    assert.strictEqual((await call(null, 'POST', '/me/avatar/google', { token: 'token' })).status, 401);
  } finally { googleProfile.getGooglePhoto = original; }
}));

test('Google photo import verifies audience and email, refuses arbitrary hosts, and converts the picture to a square WebP', async () => {
  const { getGooglePhoto } = require('../lib/googleProfile');
  const sharp = require('sharp');
  process.env.GOOGLE_CLIENT_ID = 'test-client';
  process.env.ALLOWED_EMAIL_DOMAIN = 'x.ph';
  let payload = { email_verified: true, email: 'user6@x.ph', picture: 'https://lh3.googleusercontent.com/photo' };
  let downloads = 0;
  const image = await sharp({ create: { width: 30, height: 20, channels: 3, background: '#ffffff' } }).png().toBuffer();
  const dependencies = {
    client: { verifyIdToken: async options => { assert.strictEqual(options.audience, 'test-client'); return { getPayload: () => payload }; } },
    fetch: async (url, options) => { downloads++; assert.strictEqual(options.redirect, 'error'); return new Response(image); },
  };
  const photo = await getGooglePhoto('token', 'USER6@X.PH', dependencies);
  const metadata = await sharp(photo).metadata();
  assert.deepStrictEqual([metadata.width, metadata.height, metadata.format], [256, 256, 'webp']);
  payload = { ...payload, email: 'another@x.ph' };
  await assert.rejects(getGooglePhoto('token', 'user6@x.ph', dependencies), { status: 403 });
  payload = { ...payload, email: 'user6@x.ph', picture: 'https://evil.example/photo' };
  await assert.rejects(getGooglePhoto('token', 'user6@x.ph', dependencies), { status: 400 });
  payload = { ...payload, picture: 'https://googleusercontent.com.evil.example/photo' };
  await assert.rejects(getGooglePhoto('token', 'user6@x.ph', dependencies), { status: 400 });
  assert.strictEqual(downloads, 1);
  await assert.rejects(getGooglePhoto('', 'user6@x.ph', dependencies), { status: 400 });
});


test('direct menu sync imports a photo for both roles and never accepts a client supplied account id', () => withServer(async ({ call, db }) => {
  const googleProfile = require('../lib/googleProfile');
  const original = googleProfile.getGooglePhotoWithAccessToken;
  let expectedEmail;
  googleProfile.getGooglePhotoWithAccessToken = async (token, email) => {
    assert.strictEqual(token, 'access-token');
    assert.strictEqual(email, expectedEmail);
    return Buffer.from('verified-photo');
  };
  try {
    for (const user of [gus, admin1]) {
      expectedEmail = db.s.users[user.id].email;
      const result = await call(user, 'POST', '/me/avatar/google', { accessToken: 'access-token', userId: 5 });
      assert.strictEqual(result.status, 200);
      assert.ok(db.s.users[user.id].avatar_path);
    }
    assert.strictEqual(db.s.users[5].avatar_path, 'avatars/fay-333.png');
    assert.strictEqual((await call(null, 'POST', '/me/avatar/google', { accessToken: 'token' })).status, 401);
    assert.strictEqual((await call({ ...gus, role: 'student' }, 'POST', '/me/avatar/google', { accessToken: 'token' })).status, 403);
    googleProfile.getGooglePhotoWithAccessToken = async () => { throw Object.assign(new Error('Photo unavailable'), { status: 502 }); };
    const before = db.s.users[6].avatar_path;
    assert.strictEqual((await call(gus, 'POST', '/me/avatar/google', { accessToken: 'token' })).status, 502);
    assert.strictEqual(db.s.users[6].avatar_path, before);
  } finally { googleProfile.getGooglePhotoWithAccessToken = original; }
}));

test('direct sync verifies audience, expiry and account identity before importing a Google photo', async () => {
  const { getGooglePhotoWithAccessToken } = require('../lib/googleProfile');
  const sharp = require('sharp');
  process.env.GOOGLE_CLIENT_ID = 'test-client';
  process.env.ALLOWED_EMAIL_DOMAIN = 'x.ph';
  let info = { aud: 'test-client', expiry_date: Date.now() + 3600000 };
  let profile = { email_verified: true, email: 'user6@x.ph', picture: 'https://lh3.googleusercontent.com/photo' };
  const image = await sharp({ create: { width: 20, height: 30, channels: 3, background: '#ffffff' } }).png().toBuffer();
  let downloads = 0;
  const dependencies = {
    client: { getTokenInfo: async token => { assert.strictEqual(token, 'access-token'); return info; } },
    fetch: async (url, options) => {
      assert.strictEqual(options.redirect, 'error');
      if (url === 'https://openidconnect.googleapis.com/v1/userinfo') {
        assert.strictEqual(options.headers.Authorization, 'Bearer access-token');
        return Response.json(profile);
      }
      downloads++;
      return new Response(image);
    },
  };
  const photo = await getGooglePhotoWithAccessToken('access-token', 'USER6@X.PH', dependencies);
  const metadata = await sharp(photo).metadata();
  assert.deepStrictEqual([metadata.width, metadata.height, metadata.format], [256, 256, 'webp']);
  info = { ...info, aud: 'other-client' };
  await assert.rejects(getGooglePhotoWithAccessToken('access-token', 'user6@x.ph', dependencies), { status: 401 });
  info = { aud: 'test-client', expiry_date: Date.now() - 1 };
  await assert.rejects(getGooglePhotoWithAccessToken('access-token', 'user6@x.ph', dependencies), { status: 401 });
  info.expiry_date = Date.now() + 3600000;
  profile.email = 'other@x.ph';
  await assert.rejects(getGooglePhotoWithAccessToken('access-token', 'user6@x.ph', dependencies), { status: 403 });
  profile.email = 'user6@x.ph'; profile.email_verified = false;
  await assert.rejects(getGooglePhotoWithAccessToken('access-token', 'user6@x.ph', dependencies), { status: 403 });
  profile.email_verified = true; profile.picture = 'https://evil.example/photo';
  await assert.rejects(getGooglePhotoWithAccessToken('access-token', 'user6@x.ph', dependencies), { status: 400 });
  assert.strictEqual(downloads, 1);
  await assert.rejects(getGooglePhotoWithAccessToken('', 'user6@x.ph', dependencies), { status: 400 });
});
