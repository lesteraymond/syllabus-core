'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveHostConfig, cookieSettingsOf, parseOrigins, parseTrustProxy, corsOptions, originGuard, DEV_DEFAULT_ORIGINS } = require('./hostConfig');

// Reserved-for-documentation names (RFC 2606): stand-ins for a frontend origin that this project deliberately never invents.
const FRONT = 'https://app.staging.invalid';
const staging = (over = {}) => ({ NODE_ENV: 'staging', CORS_ALLOWED_ORIGINS: FRONT, TRUST_PROXY: '1', ...over });
const problem = (fn, re) => assert.throws(fn, (e) => e.code === 'host_config_invalid' && re.test(e.message), String(re));

test('origins: explicit origins only, never a wildcard, "null", a path or a trailing slash', () => {
  assert.deepEqual(parseOrigins(''), []);
  assert.deepEqual(parseOrigins(undefined), []);
  assert.deepEqual(parseOrigins(` ${FRONT} , http://localhost:5173 ,${FRONT}`), [FRONT, 'http://localhost:5173'], 'trimmed and de-duplicated');
  problem(() => parseOrigins('*'), /wildcard is never allowed/);
  problem(() => parseOrigins('https://*.example.invalid'), /wildcard is never allowed/);
  problem(() => parseOrigins('null'), /must not contain "null"/);
  problem(() => parseOrigins(FRONT + '/'), /did you mean "https:\/\/app\.staging\.invalid"/);
  problem(() => parseOrigins(FRONT + '/app'), /exactly an origin/);
  problem(() => parseOrigins('https://user:pw@app.staging.invalid'), /exactly an origin/);
  problem(() => parseOrigins('app.staging.invalid'), /not a valid origin/);
  problem(() => parseOrigins('ftp://app.staging.invalid'), /exactly an origin/);
  problem(() => parseOrigins(Array.from({ length: 11 }, (_, i) => `https://a${i}.staging.invalid`).join(',')), /more than 10/);
});

test('trust proxy: a hop count of 1 to 5 or explicit proxies; "true" and "*" are refused because they trust a forgeable header', () => {
  assert.equal(parseTrustProxy(''), undefined); assert.equal(parseTrustProxy(undefined), undefined);
  assert.equal(parseTrustProxy('1'), 1); assert.equal(parseTrustProxy(' 3 '), 3);
  assert.deepEqual(parseTrustProxy('loopback'), ['loopback']);
  assert.deepEqual(parseTrustProxy('10.0.0.0/8, 192.168.1.5, loopback'), ['10.0.0.0/8', '192.168.1.5', 'loopback']);
  for (const bad of ['0', '6', '99']) problem(() => parseTrustProxy(bad), /between 1 and 5/);
  for (const bad of ['true', 'TRUE', 'false', '*']) problem(() => parseTrustProxy(bad), /refused/);
  for (const bad of ['proxy.example', 'one', '1.2.3.4; drop']) problem(() => parseTrustProxy(bad), /hop count, or a comma-separated list/);
});

test('cookies: HttpOnly always; Secure forced in staging and production; SameSite=None needs Secure; development stays as it was', () => {
  assert.deepEqual(cookieSettingsOf({}), { httpOnly: true, secure: false, sameSite: 'lax', path: '/' }, 'development default = the previous behavior');
  assert.deepEqual(cookieSettingsOf({ NODE_ENV: 'development' }), { httpOnly: true, secure: false, sameSite: 'lax', path: '/' });
  assert.equal(cookieSettingsOf({ SESSION_COOKIE_SECURE: 'true' }).secure, true, 'development can opt in to Secure');
  for (const NODE_ENV of ['staging', 'production']) {
    assert.deepEqual(cookieSettingsOf({ NODE_ENV }), { httpOnly: true, secure: true, sameSite: 'lax', path: '/' }, NODE_ENV + ': Secure with no setting at all');
    assert.equal(cookieSettingsOf({ NODE_ENV, SESSION_COOKIE_SECURE: 'true' }).secure, true);
    problem(() => cookieSettingsOf({ NODE_ENV, SESSION_COOKIE_SECURE: 'false' }), /refused/);
  }
  problem(() => cookieSettingsOf({ SESSION_COOKIE_SECURE: 'maybe' }), /true or false/);
  assert.equal(cookieSettingsOf({ SESSION_COOKIE_SAMESITE: 'Strict' }).sameSite, 'strict', 'case-insensitive');
  problem(() => cookieSettingsOf({ SESSION_COOKIE_SAMESITE: 'whenever' }), /lax, strict or none/);
  problem(() => cookieSettingsOf({ SESSION_COOKIE_SAMESITE: 'none' }), /requires Secure/);
  assert.deepEqual(cookieSettingsOf({ NODE_ENV: 'staging', SESSION_COOKIE_SAMESITE: 'none' }), { httpOnly: true, secure: true, sameSite: 'none', path: '/' });
});

test('development keeps exactly the localhost origin it always allowed, and an explicit list replaces it rather than adding to it', () => {
  const dev = resolveHostConfig({});
  assert.deepEqual(dev.origins, ['http://localhost:5173']); assert.equal(dev.originSource, 'development default'); assert.equal(dev.trustProxy, undefined); assert.equal(dev.strict, false);
  assert.deepEqual([...DEV_DEFAULT_ORIGINS], ['http://localhost:5173']);
  const explicit = resolveHostConfig({ CORS_ALLOWED_ORIGINS: FRONT });
  assert.deepEqual(explicit.origins, [FRONT], 'the localhost default is not added to an explicit list'); assert.equal(explicit.originSource, 'configured');
  assert.equal(resolveHostConfig({ NODE_ENV: 'test' }).strict, false);
  assert.deepEqual(dev.sessionCookie, { httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 86400000 }, 'the session cookie keeps its 24 hour life');
});

test('staging and production refuse to start without explicit origins, a trusted-proxy setting and safe cookies', () => {
  for (const NODE_ENV of ['staging', 'production']) {
    const ok = resolveHostConfig(staging({ NODE_ENV }));
    assert.deepEqual(ok.origins, [FRONT]); assert.equal(ok.trustProxy, 1); assert.equal(ok.cookie.secure, true); assert.equal(ok.strict, true);
    assert.ok(!ok.origins.includes('http://localhost:5173'), NODE_ENV + ': the localhost default is NOT inherited');
    problem(() => resolveHostConfig(staging({ NODE_ENV, CORS_ALLOWED_ORIGINS: undefined })), /CORS_ALLOWED_ORIGINS is required/);
    problem(() => resolveHostConfig(staging({ NODE_ENV, CORS_ALLOWED_ORIGINS: '' })), /CORS_ALLOWED_ORIGINS is required/);
    problem(() => resolveHostConfig(staging({ NODE_ENV, CORS_ALLOWED_ORIGINS: '*' })), /wildcard/);
    problem(() => resolveHostConfig(staging({ NODE_ENV, CORS_ALLOWED_ORIGINS: 'http://app.staging.invalid' })), /must use https/);
    problem(() => resolveHostConfig(staging({ NODE_ENV, TRUST_PROXY: undefined })), /TRUST_PROXY is required/);
    problem(() => resolveHostConfig(staging({ NODE_ENV, TRUST_PROXY: 'true' })), /refused/);
    problem(() => resolveHostConfig(staging({ NODE_ENV, SESSION_COOKIE_SECURE: 'false' })), /refused/);
  }
  assert.deepEqual(resolveHostConfig(staging({ CORS_ALLOWED_ORIGINS: 'http://localhost:5173' })).origins, ['http://localhost:5173'], 'plain http is accepted for localhost only (a local staging rehearsal)');
  assert.deepEqual(resolveHostConfig(staging({ CORS_ALLOWED_ORIGINS: `${FRONT}, https://other.staging.invalid` })).origins.length, 2, 'several frontends can be listed explicitly');
});

test('error messages name the setting and never contain a secret', () => {
  for (const env of [staging({ TRUST_PROXY: undefined }), staging({ CORS_ALLOWED_ORIGINS: '*', SESSION_SECRET: 'SENTINEL-do-not-print-1234' }), staging({ SESSION_COOKIE_SAMESITE: 'oops', JWT_SECRET: 'SENTINEL-do-not-print-5678' })]) {
    try { resolveHostConfig(env); assert.fail('should have thrown'); } catch (e) { assert.equal(e.code, 'host_config_invalid'); assert.match(e.message, /CORS_ALLOWED_ORIGINS|TRUST_PROXY|SESSION_COOKIE_SAMESITE/); assert.ok(!e.message.includes('SENTINEL')); }
  }
});

test('CORS: only listed origins get credentialed access, and an absent Origin (same-origin or a non-browser client) is passed through', () => {
  const allow = (config, origin) => new Promise((resolve) => corsOptions(config).origin(origin, (err, ok) => resolve(ok)));
  const cfg = resolveHostConfig(staging({ CORS_ALLOWED_ORIGINS: `${FRONT},https://second.staging.invalid` }));
  return Promise.all([allow(cfg, FRONT), allow(cfg, 'https://second.staging.invalid'), allow(cfg, 'https://evil.invalid'), allow(cfg, 'http://localhost:5173'), allow(cfg, 'null'), allow(cfg, undefined)]).then((r) => {
    assert.deepEqual(r, [true, true, false, false, false, true]);
    assert.equal(corsOptions(cfg).credentials, true);
  });
});

test('the cross-site guard: a state-changing request must come from an allowed origin or this server; reads and preflights are untouched', () => {
  const guard = originGuard(resolveHostConfig(staging()));
  const run = (method, headers = {}, host = 'api.staging.invalid') => { let out = 'next'; guard({ method, headers, protocol: 'https', get: () => host }, { status: (c) => ({ json: (b) => { out = [c, b.code]; } }) }, () => { out = 'next'; }); return out; };
  for (const method of ['GET', 'HEAD', 'OPTIONS']) assert.equal(run(method, { origin: 'https://evil.invalid' }), 'next', method + ' is never blocked by the guard');
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(run(method, { origin: FRONT }), 'next', method + ' from the allowed origin');
    assert.deepEqual(run(method, { origin: 'https://evil.invalid' }), [403, 'origin_not_allowed'], method + ' from a foreign origin');
    assert.deepEqual(run(method, { origin: 'null' }), [403, 'origin_not_allowed'], method + ' from an opaque origin');
  }
  assert.equal(run('POST', { origin: 'https://api.staging.invalid' }), 'next', 'this server\'s own origin');
  assert.equal(run('POST', {}), 'next', 'no Origin and no browser hint: a non-browser client');
  assert.deepEqual(run('POST', { 'sec-fetch-site': 'cross-site' }), [403, 'origin_not_allowed'], 'no Origin but the browser says cross-site');
  for (const site of ['same-origin', 'same-site', 'none']) assert.equal(run('POST', { 'sec-fetch-site': site }), 'next', site);
  assert.deepEqual(run('POST', { origin: 'https://evil.invalid', 'sec-fetch-site': 'same-origin' }), [403, 'origin_not_allowed'], 'a present Origin always decides');
});
