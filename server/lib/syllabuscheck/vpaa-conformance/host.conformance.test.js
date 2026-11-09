'use strict';
// Staging host conformance: CORS, session and remember-me cookies, reverse-proxy handling, the cross-site guard, authentication and authorization, and the routing between the
// browser client and the server, through the REAL host-security function (applyHostSecurity, the one index.js calls), the REAL express-session, the REAL requireAuth and
// cookie issuance, and the REAL checker routes, over genuine HTTP on a loopback port with controlled Origin headers. No outside network, no real secret, no real data.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const h = require('./harness');
const { createMemoryDb } = require('./memdb');
const { resolveHostConfig, applyHostSecurity, sessionOptions } = require('../../hostConfig');
const { restoreSession, issueRememberToken } = require('../../../middleware/auth');

const ROOT = path.resolve(__dirname, '../../../..');
const ROUTE = require.resolve('../../../routes/syllabusCheck');
const FRONT = 'https://app.staging.invalid'; // a reserved-for-documentation name: no real domain is invented anywhere
const SECRET = 'host-conformance-session-secret-0123456789';
const staging = (over = {}) => ({ NODE_ENV: 'staging', CORS_ALLOWED_ORIGINS: FRONT, TRUST_PROXY: '1', ...over });
const SUGGESTION = { id: 'SEM:pair1', path: 'plan[0].tasks', replacement: 'Design and demonstrate a tested program.' };

// The app, built exactly like server/index.js builds its security layer, with the real checker routes behind the real auth.
async function boot(t, env) {
  h.liveGuard(t);
  const config = resolveHostConfig(env);
  const SETTINGS = ['NODE_ENV', 'SESSION_COOKIE_SAMESITE', 'SESSION_COOKIE_SECURE'], kept = Object.fromEntries(SETTINGS.map((k) => [k, process.env[k]]));
  for (const k of SETTINGS) { if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
  t.after(() => { for (const k of SETTINGS) { if (kept[k] === undefined) delete process.env[k]; else process.env[k] = kept[k]; } });
  const db = createMemoryDb({ syllabus: { syllabus_id: 100, user_id: 26, status: 'draft', content: '{}' } });
  const query = db.query.bind(db);
  db.query = async (sql, params) => (/^\s*INSERT INTO remember_tokens/.test(sql) ? [{ insertId: 1 }] : query(sql, params));
  db.state.runs.push({ run_id: 1, syllabus_id: 100 });
  db.state.reports.set(1, { reference_hash: 'x', report_json: JSON.stringify({ hybrid: { suggestions: [SUGGESTION] } }) });
  delete require.cache[ROUTE];
  const app = express();
  applyHostSecurity(app, config);
  app.use(express.json()); app.use(express.urlencoded({ extended: true }));
  app.use(session(sessionOptions(SECRET, config)));
  app.locals.db = db;
  // The only test-only route: it signs a person in the way routes/auth.js does (session user, optional remember-me cookie) so the REAL cookie flags are exercised.
  app.post('/test/login', async (req, res) => { req.session.user = { id: req.body.id, role: req.body.role, firstName: 'T', lastName: 'T' }; if (req.body.remember) await issueRememberToken(db, res, req.body.id); res.json({ ok: true }); });
  app.use(restoreSession);
  app.use('/api/syllabus-check', require(ROUTE));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;
  const request = (method, p, { headers = {}, body, form } = {}) => new Promise((resolve, reject) => {
    const payload = form ? new URLSearchParams(form).toString() : body === undefined ? undefined : JSON.stringify(body);
    const type = form ? 'application/x-www-form-urlencoded' : body === undefined ? undefined : 'application/json';
    const req = http.request({ host: '127.0.0.1', port, method, path: p, headers: { ...(type ? { 'Content-Type': type } : {}), ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}), ...headers } }, (res) => { let text = ''; res.on('data', (c) => { text += c; }); res.on('end', () => { let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ } resolve({ status: res.statusCode, headers: res.headers, cookies: res.headers['set-cookie'] || [], json, text }); }); });
    req.on('error', reject); if (payload) req.write(payload); req.end();
  });
  const login = async ({ id = 26, role = 'faculty', remember = false, headers = {} } = {}) => { const r = await request('POST', '/test/login', { headers, body: { id, role, remember } }); return { ...r, jar: r.cookies.map((c) => c.split(';')[0]).join('; ') }; };
  return { config, db, request, login };
}
const HTTPS = { 'X-Forwarded-Proto': 'https', Origin: FRONT };
const flags = (cookie) => cookie.split(';').slice(1).map((s) => s.trim().toLowerCase());

test('[VPAA-HOST-DEV] local development behaves as before: one localhost origin, HttpOnly Lax cookies that are not Secure, cookie-authenticated API', async (t) => {
  const { request, login, db } = await boot(t, {});
  const pre = (origin) => request('OPTIONS', '/api/syllabus-check/status', { headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' } });
  const ok = await pre('http://localhost:5173');
  assert.equal(ok.headers['access-control-allow-origin'], 'http://localhost:5173'); assert.equal(ok.headers['access-control-allow-credentials'], 'true'); assert.match(ok.headers.vary || '', /Origin/i);
  for (const origin of ['http://127.0.0.1:5173', 'https://evil.invalid', 'http://localhost:3000']) assert.equal((await pre(origin)).headers['access-control-allow-origin'], undefined, origin + ' gets no CORS access');
  const signedIn = await login({ remember: true, headers: { Origin: 'http://localhost:5173' } });
  assert.equal(signedIn.status, 200);
  const session1 = signedIn.cookies.find((c) => c.startsWith('connect.sid=')), remember = signedIn.cookies.find((c) => c.startsWith('remember_token='));
  assert.ok(session1 && remember, 'both cookies are issued');
  for (const c of [session1, remember]) { assert.ok(flags(c).includes('httponly'), 'HttpOnly'); assert.ok(flags(c).includes('samesite=lax'), 'SameSite=Lax'); assert.ok(!flags(c).includes('secure'), 'not Secure over plain http in development'); }
  assert.equal((await request('GET', '/api/syllabus-check/status')).status, 401, 'no cookie: not authenticated');
  assert.equal((await request('GET', '/api/syllabus-check/status', { headers: { Cookie: signedIn.jar } })).status, 200, 'the session cookie authenticates');
  const post = (origin) => request('POST', '/api/syllabus-check/runs/1/decisions', { headers: { Cookie: signedIn.jar, ...(origin ? { Origin: origin } : {}) }, body: { suggestionId: SUGGESTION.id, action: 'accept' } });
  assert.equal((await post('http://localhost:5173')).status, 201, 'the development frontend still works');
  assert.equal((await post('https://evil.invalid')).status, 403, 'a foreign origin is refused');
  assert.equal(db.state.decisions.length, 1, 'only the legitimate decision was recorded');
});

test('[VPAA-HOST-STAGING-COOKIES] in staging both cookies are HttpOnly, Secure and SameSite, the remember-me cookie included (it used to be Secure only in production), and nothing falls back to insecure', async (t) => {
  const { login, request } = await boot(t, staging());
  const behindProxy = await login({ remember: true, headers: HTTPS });
  const session1 = behindProxy.cookies.find((c) => c.startsWith('connect.sid=')), remember = behindProxy.cookies.find((c) => c.startsWith('remember_token='));
  assert.ok(session1 && remember, 'behind a TLS-terminating proxy both cookies are issued');
  for (const [name, c] of [['session', session1], ['remember-me', remember]]) for (const f of ['httponly', 'secure', 'samesite=lax', 'path=/']) assert.ok(flags(c).includes(f), `${name} cookie has ${f}`);
  assert.equal((await request('GET', '/api/syllabus-check/status', { headers: { Cookie: behindProxy.jar, 'X-Forwarded-Proto': 'https' } })).status, 200, 'and it authenticates over the proxied https connection');
  // plain HTTP reaching Node (no X-Forwarded-Proto): the Secure session cookie is NOT issued, so no insecure session exists
  const plain = await login({ headers: { Origin: FRONT } });
  assert.equal(plain.cookies.find((c) => c.startsWith('connect.sid=')), undefined, 'no session cookie over plain http: it fails closed instead of downgrading to an insecure cookie');
  assert.equal((await request('GET', '/api/syllabus-check/status')).status, 401);
  // a frontend on a different SITE needs SameSite=None, which is only valid with Secure
  const cross = await boot(t, staging({ SESSION_COOKIE_SAMESITE: 'none' }));
  const none = await cross.login({ remember: true, headers: HTTPS });
  for (const c of [none.cookies.find((x) => x.startsWith('connect.sid=')), none.cookies.find((x) => x.startsWith('remember_token='))]) { assert.ok(flags(c).includes('samesite=none') && flags(c).includes('secure') && flags(c).includes('httponly')); }
});

test('[VPAA-HOST-STAGING-CORS] staging allows only the configured frontend origin, never a wildcard, and does not inherit the localhost development default', async (t) => {
  const { request } = await boot(t, staging({ CORS_ALLOWED_ORIGINS: `${FRONT},https://second.staging.invalid` }));
  const allowed = (origin) => request('OPTIONS', '/api/syllabus-check/status', { headers: { Origin: origin, 'Access-Control-Request-Method': 'GET', 'X-Forwarded-Proto': 'https' } }).then((r) => r.headers['access-control-allow-origin']);
  assert.equal(await allowed(FRONT), FRONT); assert.equal(await allowed('https://second.staging.invalid'), 'https://second.staging.invalid');
  for (const origin of ['http://localhost:5173', 'https://evil.invalid', 'null', 'https://app.staging.invalid.evil.invalid']) assert.equal(await allowed(origin), undefined, origin + ' is not allowed');
  for (const origin of [FRONT, 'https://evil.invalid', 'null']) assert.notEqual(await allowed(origin), '*', 'the response never carries a wildcard');
});

test('[VPAA-HOST-CSRF] with cookie authentication, a state-changing request from a foreign site is refused before it reaches any route, including the classic form-post vector', async (t) => {
  const { request, login, db } = await boot(t, staging());
  const author = await login({ headers: HTTPS });
  const decide = (extra = {}, over = {}) => request('POST', '/api/syllabus-check/runs/1/decisions', { headers: { Cookie: author.jar, 'X-Forwarded-Proto': 'https', ...extra }, ...over, ...(over.form ? {} : { body: { suggestionId: SUGGESTION.id, action: 'reject' } }) });
  const before = () => db.state.decisions.length;
  assert.equal((await decide({ Origin: FRONT })).status, 201, 'the allowed frontend');
  assert.equal(before(), 1);
  for (const [name, extra, over] of [['a foreign origin', { Origin: 'https://evil.invalid' }], ['an opaque origin', { Origin: 'null' }], ['a foreign origin sending a urlencoded form (a "simple" request, no preflight)', { Origin: 'https://evil.invalid' }, { form: { suggestionId: SUGGESTION.id, action: 'reject' } }], ['no Origin but the browser says cross-site', { 'Sec-Fetch-Site': 'cross-site' }]]) {
    const r = await decide(extra, over || {});
    assert.equal(r.status, 403, name); assert.equal(r.json.code, 'origin_not_allowed', name); assert.equal(before(), 1, name + ': nothing was recorded');
  }
  assert.equal((await decide({})).status, 201, 'a non-browser client (no Origin) is not blocked');
  assert.equal((await decide({ 'Sec-Fetch-Site': 'same-site', Origin: FRONT })).status, 201);
  // reads are not subject to the guard, but a foreign page still cannot READ them: no CORS headers
  const read = await request('GET', '/api/syllabus-check/status', { headers: { Cookie: author.jar, Origin: 'https://evil.invalid', 'X-Forwarded-Proto': 'https' } });
  assert.equal(read.headers['access-control-allow-origin'], undefined, 'a foreign page gets no CORS access to the response');
});

test('[VPAA-HOST-AUTHZ] authentication and authorization still work through the real cookie session: anonymous, another faculty member, the administrator and the author', async (t) => {
  const { request, login, db } = await boot(t, staging());
  const decide = (jar, action = 'accept') => request('POST', '/api/syllabus-check/runs/1/decisions', { headers: { ...(jar ? { Cookie: jar } : {}), ...HTTPS }, body: { suggestionId: SUGGESTION.id, action } });
  assert.equal((await decide(null)).status, 401, 'anonymous');
  assert.equal((await decide((await login({ id: 27, headers: HTTPS })).jar)).status, 404, 'another faculty member cannot see the run');
  assert.equal((await decide((await login({ id: 1, role: 'admin', headers: HTTPS })).jar)).status, 404, 'a draft is not visible to the administrator');
  db.state.syllabus.status = 'under_review';
  const admin = (await login({ id: 1, role: 'admin', headers: HTTPS })).jar;
  assert.equal((await decide(admin)).status, 403, 'under review the administrator reads but never decides');
  assert.equal((await request('GET', '/api/syllabus-check/runs/1/decisions', { headers: { Cookie: admin, 'X-Forwarded-Proto': 'https' } })).status, 200);
  db.state.syllabus.status = 'draft';
  assert.equal((await decide((await login({ headers: HTTPS })).jar)).status, 201, 'the author');
});

test('[VPAA-HOST-ROUTING] every checker and compliance call the browser client makes exists on the server, under the prefixes index.js mounts', () => {
  const index = fs.readFileSync(path.join(ROOT, 'server/index.js'), 'utf8');
  assert.match(index, /app\.use\("\/api\/syllabus-check", require\("\.\/routes\/syllabusCheck"\)\)/);
  assert.match(index, /app\.use\("\/api", require\("\.\/routes\/compliance"\)\)/);
  const table = (router) => router.stack.filter((l) => l.route).flatMap((l) => Object.keys(l.route.methods).map((m) => `${m.toUpperCase()} ${l.route.path.replace(/:[A-Za-z]+/g, ':p')}`));
  const server = new Set([...table(require('../../../routes/syllabusCheck')).map((r) => r.replace(' ', ' /syllabus-check')), ...table(require('../../../routes/compliance'))]);
  const client = fs.readFileSync(path.join(ROOT, 'src/lib/api.js'), 'utf8');
  const calls = [...client.matchAll(/request\(\s*`([^`]*)`/g), ...client.matchAll(/request\(\s*'([^']*)'/g), ...client.matchAll(/request\(\s*"([^"]*)"/g)].map((m) => m[1]);
  // a nested template inside `${...}` (the optional query string) leaves an unterminated expression at the end of the capture: it is only a query suffix
  const wanted = calls.map((p) => p.replace(/\$\{[^}]*$/, '').replace(/\$\{[^}]*\}/g, ':p').replace(/(?<=[^/]):p/g, '').split('?')[0]).filter((p) => /^\/(syllabus-check|compliance)|\/compliance/.test(p));
  assert.ok(wanted.length >= 8, `the client makes ${wanted.length} checker/compliance calls`);
  const paths = new Set([...server].map((r) => r.split(' ')[1]));
  for (const p of new Set(wanted)) assert.ok(paths.has(p), `the client calls ${p} and the server has it`);
  for (const r of ['POST /syllabi/:p/compliance/recheck', 'GET /syllabus-check/status', 'GET /syllabus-check/runs/:p/decisions', 'POST /syllabus-check/runs/:p/decisions', 'POST /syllabus-check/runs/:p/suggestions/:p/refine']) assert.ok(server.has(r), r);
});

test('[VPAA-HOST-INDEX] server/index.js has no hardcoded origin and applies the host security before the session', () => {
  const src = fs.readFileSync(path.join(ROOT, 'server/index.js'), 'utf8');
  assert.ok(!/localhost:5173/.test(src), 'no hardcoded localhost origin in index.js');
  assert.ok(!/cors\(\s*\{/.test(src), 'no inline CORS options');
  assert.match(src, /resolveHostConfig\(process\.env\)/); assert.match(src, /cookie:\s*hostConfig\.sessionCookie/);
  assert.ok(src.indexOf('applyHostSecurity(app, hostConfig)') > 0 && src.indexOf('applyHostSecurity(app, hostConfig)') < src.indexOf('session('), 'host security (proxy trust, CORS, guard) comes before the session');
  assert.ok(src.indexOf('resolveHostConfig(process.env)') < src.indexOf('mysql.createPool('), 'a bad host setting stops the server before a database pool exists');
  const auth = fs.readFileSync(path.join(ROOT, 'server/middleware/auth.js'), 'utf8');
  assert.ok(!/NODE_ENV === 'production'/.test(auth), 'the remember-me cookie no longer keys Secure on production alone');
});

test('[VPAA-HOST-NO-NETWORK] nothing in this suite can reach beyond loopback', async (t) => {
  h.liveGuard(t);
  await assert.rejects(() => fetch('https://app.staging.invalid/api'), /LIVE NETWORK CALL BLOCKED/);
  await assert.rejects(() => fetch('https://api.anthropic.com/v1/messages'), /LIVE NETWORK CALL BLOCKED/);
});
