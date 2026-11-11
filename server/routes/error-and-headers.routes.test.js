// HTTP-level tests for what the server says when something goes wrong, and for the headers on every answer (docs/security/SECURITY-AUDIT-REPORT.md
// SEC-07, SEC-08, SEC-17, SEC-21): no stack trace, file path or SQL text ever reaches the client, in any mode; every response carries the security
// headers; API answers are not stored by the browser. In-memory fake database. Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { applyHostSecurity, applyErrorHandling, resolveHostConfig, JSON_BODY_LIMIT } = require('../lib/hostConfig');
const { sendError, httpError, SERVER_ERROR } = require('../lib/http');

const SECRET_TEXT = "Unknown column 'm.secret_col' in 'field list'"; // what a database error looks like: it must never be sent
const LEAK = /secret_col|field list|node_modules|\bat .+:\d+:\d+|[A-Z]:\\|\/server\/|SELECT |syllabus_db/;

const dev = () => resolveHostConfig({});
const staging = () => resolveHostConfig({ NODE_ENV: 'staging', CORS_ALLOWED_ORIGINS: 'https://app.example.test', TRUST_PROXY: '1' });

async function withServer(config, mount, fn) {
  const quiet = console.error; const logged = []; console.error = (...a) => logged.push(a.map(String).join(' '));
  const app = express();
  applyHostSecurity(app, config);
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use((req, res, next) => { const h = req.headers['x-test-user']; req.session = h ? { user: JSON.parse(h) } : {}; next(); });
  mount(app);
  applyErrorHandling(app);
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const call = async (method, route, { body, raw, as } = {}) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${route}`, { method, headers: { 'Content-Type': 'application/json', ...(as ? { 'x-test-user': JSON.stringify(as) } : {}) }, body: raw !== undefined ? raw : body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, headers: res.headers, text, json };
  };
  try { await fn(call, logged); } finally { console.error = quiet; await new Promise((r) => server.close(r)); }
}
const basic = (app) => {
  app.post('/api/echo', (req, res) => res.json({ ok: true }));
  app.get('/api/boom', (req, res, next) => next(Object.assign(new Error(SECRET_TEXT), { sql: 'SELECT * FROM users' })));
  app.get('/api/throws', () => { throw new Error(SECRET_TEXT); });
  app.get('/api/photo', (req, res) => { res.set('Cache-Control', 'private, max-age=86400'); res.json({}); });
  app.get('/elsewhere', (req, res) => res.send('ok'));
};

for (const [mode, config] of [['development', dev], ['staging', staging]]) {
  test(`${mode}: a malformed or oversized body gets a short JSON answer, never a stack trace`, () => withServer(config(), basic, async (call) => {
    const bad = await call('POST', '/api/echo', { raw: '{"email":' });
    assert.strictEqual(bad.status, 400);
    assert.match(bad.headers.get('content-type'), /^application\/json/);
    assert.strictEqual(bad.json.code, 'invalid_json');
    assert.doesNotMatch(bad.text, LEAK);
    const big = await call('POST', '/api/echo', { body: { x: 'y'.repeat(900 * 1024) } });
    assert.strictEqual(big.status, 413);
    assert.strictEqual(big.json.code, 'request_too_large');
    assert.doesNotMatch(big.text, LEAK);
    assert.strictEqual((await call('POST', '/api/echo', { body: { x: 'y'.repeat(400 * 1024) } })).status, 200); // a full syllabus save (512 KB of content) still fits
  }));

  test(`${mode}: an error a route passes on, or throws, is answered with a generic 500 and written to the server log only`, () => withServer(config(), basic, async (call, logged) => {
    for (const route of ['/api/boom', '/api/throws']) {
      const res = await call('GET', route);
      assert.strictEqual(res.status, 500);
      assert.deepStrictEqual(res.json, { error: SERVER_ERROR, code: 'server_error' });
      assert.doesNotMatch(res.text, LEAK);
    }
    assert.ok(logged.some((line) => line.includes('secret_col')), 'the detail is in the server log');
  }));
}

test('an unknown API path is a JSON 404, and nothing answers with an HTML error page', () => withServer(dev(), basic, async (call) => {
  const missing = await call('GET', '/api/no-such-thing');
  assert.strictEqual(missing.status, 404);
  assert.deepStrictEqual(missing.json, { error: 'Not found' });
  assert.strictEqual((await call('GET', '/no-such-page')).status, 404);
  assert.doesNotMatch((await call('GET', '/no-such-page')).text, /<html|Cannot GET/i);
}));

test('every response carries the security headers and never names the framework', () => withServer(dev(), basic, async (call) => {
  for (const route of ['/api/echo', '/api/no-such-thing', '/api/boom', '/elsewhere']) {
    const h = (route === '/api/echo' ? await call('POST', route, { body: { a: 1 } }) : await call('GET', route)).headers;
    assert.strictEqual(h.get('x-powered-by'), null, route);
    assert.strictEqual(h.get('x-content-type-options'), 'nosniff', route);
    assert.strictEqual(h.get('x-frame-options'), 'DENY', route);
    assert.strictEqual(h.get('referrer-policy'), 'no-referrer', route);
    assert.strictEqual(h.get('content-security-policy'), "default-src 'none'; frame-ancestors 'none'", route);
    assert.match(h.get('permissions-policy'), /camera=\(\)/, route);
    assert.strictEqual(h.get('strict-transport-security'), null, route + ': no HSTS over plain http in development');
  }
}));

test('staging and production add Strict-Transport-Security', () => withServer(staging(), basic, async (call) => {
  assert.match((await call('GET', '/elsewhere')).headers.get('strict-transport-security'), /^max-age=\d{7,}; includeSubDomains$/);
}));

test('API answers are not stored by the browser, unless a route sets its own caching (a profile photo)', () => withServer(dev(), basic, async (call) => {
  assert.strictEqual((await call('POST', '/api/echo', { body: {} })).headers.get('cache-control'), 'no-store');
  assert.strictEqual((await call('GET', '/api/no-such-thing')).headers.get('cache-control'), 'no-store');
  assert.strictEqual((await call('GET', '/api/photo')).headers.get('cache-control'), 'private, max-age=86400');
}));

test('sendError: a refusal keeps its message; an unexpected error is logged and answered generically', () => {
  const quiet = console.error; const logged = []; console.error = (...a) => logged.push(a.map(String).join(' '));
  const res = () => { const r = { code: null, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };
  try {
    const refused = res(); sendError(refused, httpError(409, 'This syllabus is locked.', { code: 'locked' }));
    assert.deepStrictEqual([refused.code, refused.body], [409, { error: 'This syllabus is locked.', code: 'locked' }]);
    const failed = res(); sendError(failed, new Error(SECRET_TEXT));
    assert.deepStrictEqual([failed.code, failed.body], [500, { error: SERVER_ERROR }]);
    assert.ok(logged.some((line) => line.includes('secret_col')));
  } finally { console.error = quiet; }
});

// Every router whose own 500 branch used to send the error's message: with a database that fails, none of them may say why.
const admin = { id: 1, role: 'admin', firstName: 'A', lastName: 'D' }, faculty = { id: 2, role: 'faculty', firstName: 'F', lastName: 'A' };
const failingDb = { query: async (sql) => { if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [[{ user_id: 1 }]]; throw Object.assign(new Error(SECRET_TEXT), { code: 'ER_BAD_FIELD_ERROR', sql }); }, getConnection: async () => { throw new Error(SECRET_TEXT); } };
const routers = (app) => {
  app.locals.db = failingDb;
  app.locals.usage = { heartbeat: () => ({ enabled: true }), summary: async () => { throw new Error(SECRET_TEXT); } };
  for (const [base, file] of [['/api/messages', './messages'], ['/api/notifications', './notifications'], ['/api/logs', './logs'], ['/api/usage', './usage'], ['/api/users', './users'], ['/api/syllabi', './syllabi'], ['/api/syllabi', './comments']]) app.use(base, require(file));
};
test('a database failure inside a route is never described to the client', () => withServer(dev(), routers, async (call, logged) => {
  const tries = [
    ['GET', '/api/messages', faculty], ['GET', '/api/messages/partners', faculty], ['GET', '/api/messages/5', faculty], ['POST', '/api/messages/5', faculty], ['PUT', '/api/messages/read/5', faculty],
    ['GET', '/api/notifications', faculty], ['GET', '/api/notifications/summary', faculty], ['PUT', '/api/notifications/read-all', faculty], ['PUT', '/api/notifications/3/read', faculty],
    ['GET', '/api/logs', faculty], ['GET', '/api/usage/summary', faculty],
    ['GET', '/api/users', admin], ['POST', '/api/users', admin], ['POST', '/api/users/2/resend-credentials', admin], ['GET', '/api/users/me/assignments', faculty], ['DELETE', '/api/users/2', admin],
    ['GET', '/api/syllabi', faculty], ['DELETE', '/api/syllabi/5', faculty], ['GET', '/api/syllabi/5/versions', faculty], ['GET', '/api/syllabi/5/comments', faculty],
  ];
  for (const [method, route, as] of tries) {
    const res = await call(method, route, { as, body: method === 'GET' ? undefined : { text: 'hello', first_name: 'A', last_name: 'B', email: 'a@email.lcup.edu.ph' } });
    assert.strictEqual(res.status, 500, method + ' ' + route);
    assert.doesNotMatch(res.text, LEAK, method + ' ' + route);
    assert.strictEqual(res.json.error, SERVER_ERROR, method + ' ' + route);
  }
  assert.ok(logged.length >= tries.length, 'each failure is in the server log');
}));

test('server/index.js applies the error handling after its routes and uses the shared body limit', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  assert.match(source, /express\.json\(\{ limit: JSON_BODY_LIMIT \}\)/);
  const lastRoute = source.lastIndexOf('app.use("/api/'), handling = source.indexOf('applyErrorHandling(app)');
  assert.ok(handling > lastRoute && lastRoute > 0, 'applyErrorHandling(app) comes after the last router');
  assert.ok(handling < source.indexOf('app.listen('), 'and before the server listens');
});
