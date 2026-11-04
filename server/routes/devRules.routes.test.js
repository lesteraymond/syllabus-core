// The developer rule editor at /dev/rules: off without a password, closed until the password is entered, locked after repeated wrong ones,
// refuses bad values, and a save changes the live standard (and its version) at once. In-memory fake database. Run: npm test (project root).
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const session = require('express-session');
const store = require('../lib/compliance/overridesStore');
const o = require('../lib/compliance/overrides');

const PASSWORD = 'dev-password-123';

async function withServer(fn, { password = PASSWORD } = {}) {
  process.env.DEV_EDITOR_PASSWORD = password;
  let settingValue = null;
  const changes = [];
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-session', resave: false, saveUninitialized: false }));
  app.locals.db = { query: async (sql, params = []) => {
    if (sql.startsWith('SELECT setting_value FROM app_settings')) return [settingValue ? [{ setting_value: settingValue }] : []];
    if (sql.startsWith('INSERT INTO app_settings')) { settingValue = params[1]; return [{}]; }
    if (sql.startsWith('CREATE TABLE')) return [{}];
    if (sql.startsWith('INSERT INTO standard_changes')) { changes.push({ change_id: changes.length + 1, who: params[0], rev: params[1], kind: params[2], changes: params[3], changed_at: new Date() }); return [{}]; }
    if (sql.startsWith('SELECT change_id')) return [[...changes].reverse()];
    throw new Error('unexpected query: ' + sql.slice(0, 60));
  } };
  const devRules = require('./devRules');
  devRules.resetFailures();
  app.use('/dev/rules', devRules);
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = 'http://127.0.0.1:' + server.address().port + '/dev/rules';
  let cookie = '';
  const call = async (path, { method = 'GET', body } = {}) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    let json = {};
    try { json = JSON.parse(text); } catch { /* a page, not JSON */ }
    return { status: res.status, body: json, text, headers: res.headers };
  };
  try { await store.load(app.locals.db); await fn({ call }); } finally { server.close(); o.apply({}, 0); }
}

test('the page is served with no data in it, and never cached or indexed', () => withServer(async ({ call }) => {
  const page = await call('/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /html/);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.match(page.headers.get('x-robots-tag'), /noindex/);
  assert.ok(!page.text.includes('T-24'), 'the page itself carries no rules');
}));

test('the data stays closed until the developer password is entered', () => withServer(async ({ call }) => {
  assert.deepEqual((await call('/api/status')).body, { configured: true, unlocked: false });
  assert.equal((await call('/api/data')).status, 403);
  assert.equal((await call('/api/data', { method: 'PUT', body: { doc: { passThreshold: 90 } } })).status, 403);
  assert.equal((await call('/api/reset', { method: 'POST', body: {} })).status, 403);
  assert.equal((await call('/api/unlock', { method: 'POST', body: { password: 'wrong-password' } })).status, 403);
  assert.equal((await call('/api/unlock', { method: 'POST', body: {} })).status, 403);
  assert.equal((await call('/api/unlock', { method: 'POST', body: { password: PASSWORD } })).status, 200);
  assert.equal((await call('/api/data')).status, 200);
  await call('/api/lock', { method: 'POST', body: {} });
  assert.equal((await call('/api/data')).status, 403);
  assert.equal(o.standard.passThreshold, 79);
}));

test('five wrong passwords lock the address out, even for the right one', () => withServer(async ({ call }) => {
  for (let i = 0; i < 5; i += 1) assert.equal((await call('/api/unlock', { method: 'POST', body: { password: 'nope-nope-nope' } })).status, 403);
  assert.equal((await call('/api/unlock', { method: 'POST', body: { password: PASSWORD } })).status, 429);
}));

test('with no developer password configured the editor is off', () => withServer(async ({ call }) => {
  assert.equal((await call('/')).status, 503);
  assert.deepEqual((await call('/api/status')).body, { configured: false, unlocked: false });
  assert.equal((await call('/api/unlock', { method: 'POST', body: { password: '' } })).status, 503);
  assert.equal((await call('/api/data')).status, 403);
}, { password: '' }));

test('a save validates, changes the live standard and its version, and is recorded; reset puts the file back', () => withServer(async ({ call }) => {
  await call('/api/unlock', { method: 'POST', body: { password: PASSWORD } });
  const bad = await call('/api/data', { method: 'PUT', body: { doc: { passThreshold: 500 } } });
  assert.equal(bad.status, 400);
  assert.equal(o.standard.passThreshold, 79);

  const doc = { passThreshold: 85, rules: { 'T-01': { weight: 6 }, 'T-02': { enabled: false } } };
  const ok = await call('/api/data', { method: 'PUT', body: { doc } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.changed, 3);
  assert.equal(o.standard.passThreshold, 85);
  assert.equal(o.standard.rules.some((r) => r.id === 'T-02'), false);
  assert.equal(ok.body.version, o.base.version + '.1');
  assert.equal(ok.body.history.length, 1);
  assert.equal(ok.body.history[0].changes.length, 3);
  assert.equal(ok.body.base.passThreshold, 79); // the file's own value stays visible

  const again = await call('/api/data', { method: 'PUT', body: { doc } });
  assert.equal(again.body.changed, 0); // nothing new: no new version, no history row
  assert.equal(again.body.history.length, 1);

  const reset = await call('/api/reset', { method: 'POST', body: {} });
  assert.equal(reset.status, 200);
  assert.equal(o.standard.passThreshold, 79);
  assert.equal(o.standard.version, o.base.version);
  assert.equal(reset.body.history.length, 2);
  const next = await call('/api/data', { method: 'PUT', body: { doc: { passThreshold: 80 } } });
  assert.equal(next.body.version, o.base.version + '.3'); // a version label is never used twice
}));
