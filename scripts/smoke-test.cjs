'use strict';
// Post-deployment smoke test for a deployed API. It needs NO account, sends NO model request and changes NOTHING: only GETs, plus one deliberately refused POST.
//   node scripts/smoke-test.cjs --api https://api.example.org --origin https://app.example.org [--insecure-local]
//   --api       base URL of the API as browsers reach it (the TLS proxy), without /api
//   --origin    the frontend origin that CORS_ALLOWED_ORIGINS lists
//   --insecure-local  accept a self-signed certificate (local rehearsal only)
// Exit 0 only when every check passes. Prints names and statuses, never a header value that could hold a secret.
const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const api = (arg('--api') || '').replace(/\/+$/, ''), origin = (arg('--origin') || '').replace(/\/+$/, '');
if (!api || !origin) { console.error('usage: node scripts/smoke-test.cjs --api <url> --origin <frontend origin> [--insecure-local]'); process.exit(2); }
if (args.includes('--insecure-local')) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const results = [];
const check = (ok, name, detail = '') => { results.push(ok); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' : ' + detail : ''}`); };
const call = async (path, init = {}) => { const r = await fetch(api + path, { redirect: 'manual', ...init }); let body = null; try { body = await r.json(); } catch { /* not json */ } return { r, body }; };

(async () => {
  check(/^https:/.test(api), 'the API is reached over https', api.split('/')[2]);
  const health = await call('/api/health');
  check(health.r.status === 200 && health.body && health.body.status === 'ok' && health.body.database === 'ok', 'GET /api/health is 200 with the database reachable', `HTTP ${health.r.status}`);
  check(JSON.stringify(Object.keys(health.body || {}).sort()) === JSON.stringify(['database', 'status']), 'the health response reveals nothing but status and database');
  const me = await call('/api/auth/me', { headers: { Origin: origin } });
  check(me.r.status === 401, 'an unauthenticated request is refused (401)', `HTTP ${me.r.status}`);
  check(me.r.headers.get('access-control-allow-origin') === origin && me.r.headers.get('access-control-allow-credentials') === 'true', 'CORS answers the configured frontend origin with credentials');
  const foreign = await call('/api/auth/me', { headers: { Origin: 'https://foreign.invalid' } });
  check(!foreign.r.headers.get('access-control-allow-origin'), 'a foreign origin gets no CORS permission');
  const star = me.r.headers.get('access-control-allow-origin');
  check(star !== '*', 'the allowed origin is never a wildcard');
  const post = await call('/api/auth/login', { method: 'POST', headers: { Origin: 'https://foreign.invalid', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'smoke@example.invalid', password: 'x' }) });
  check(post.r.status === 403 && post.body && post.body.code === 'origin_not_allowed', 'a state-changing request from a foreign origin is refused (403 origin_not_allowed)', `HTTP ${post.r.status}`);
  const noSession = await call('/api/syllabi', { headers: { Origin: origin } });
  check(noSession.r.status === 401, 'a protected API is closed without a session (401)', `HTTP ${noSession.r.status}`);
  const cookies = (me.r.headers.getSetCookie ? me.r.headers.getSetCookie() : []).join(';');
  check(!/connect\.sid=/.test(cookies), 'no session cookie is issued to an anonymous visitor');
  const failed = results.filter((x) => !x).length;
  console.log(failed ? `\nSMOKE TEST FAILED: ${failed} check(s).` : '\nSMOKE TEST PASSED: every check passed.');
  console.log('This test is read-only: it used no account and sent no model request.');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('SMOKE TEST ERROR:', e.message + (e.cause ? ' (' + (e.cause.code || e.cause.message) + ')' : '')); process.exit(2); });
