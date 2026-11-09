'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isStrongSecret, weaknessOf, resolveSessionSecret, assertHardenedSecrets, hardened, KNOWN_PUBLIC } = require('./sessionSecret');

const GOOD = 'a-random-session-secret-0123456789';

test('an acceptable secret is at least 16 varied characters and not a publicly known default', () => {
  assert.equal(isStrongSecret(GOOD), true);
  assert.equal(isStrongSecret('  ' + GOOD + '  '), true, 'surrounding whitespace is ignored');
  for (const bad of [undefined, null, '', '   ', 'short', 'only-15-chars!!', 'aaaaaaaaaaaaaaaaaaaa', '1212121212121212', 'capstone-secret', 'CAPSTONE-SECRET', 'syllabus-academic-verification-secret', 'changeme', 'keyboard cat']) assert.equal(isStrongSecret(bad), false, JSON.stringify(bad));
  assert.ok(KNOWN_PUBLIC.has('capstone-secret') && KNOWN_PUBLIC.has('syllabus-academic-verification-secret'), 'the two constants this project used to ship are on the list');
});

test('weaknessOf names the reason without revealing the value', () => {
  assert.equal(weaknessOf(GOOD), null);
  assert.equal(weaknessOf(''), 'missing');
  assert.equal(weaknessOf('capstone-secret'), 'a publicly known default');
  assert.match(weaknessOf('tiny'), /shorter than 16/);
  assert.equal(weaknessOf('aaaaaaaaaaaaaaaaaaaa'), 'too repetitive');
  for (const v of ['tiny', 'SENTINEL-VALUE-1']) assert.ok(!String(weaknessOf(v)).includes(v));
});

test('hardened modes are exactly production and staging', () => {
  for (const mode of ['production', 'staging', 'PRODUCTION', ' Staging ']) assert.equal(hardened({ NODE_ENV: mode }), true, mode);
  for (const mode of [undefined, '', 'development', 'test', 'local']) assert.equal(hardened({ NODE_ENV: mode }), false, String(mode));
});

test('production and staging REFUSE a missing or unacceptable session secret and never fall back', () => {
  for (const mode of ['production', 'staging']) {
    for (const SESSION_SECRET of [undefined, '', 'capstone-secret', 'tiny', 'aaaaaaaaaaaaaaaaaaaa']) {
      assert.throws(() => resolveSessionSecret({ NODE_ENV: mode, SESSION_SECRET }), (e) => e.code === 'secret_required' && e.variable === 'SESSION_SECRET' && /will not start/.test(e.message), `${mode} ${JSON.stringify(SESSION_SECRET)}`);
    }
    assert.deepEqual(resolveSessionSecret({ NODE_ENV: mode, SESSION_SECRET: GOOD }), { secret: GOOD, source: 'configured' }, `${mode}: a good secret is used as configured`);
  }
});

test('the error never contains the configured value', () => {
  for (const value of ['SENT-short', 'capstone-secret', 'aaaaaaaaaaaaaaaaaaaa']) {
    assert.throws(() => resolveSessionSecret({ NODE_ENV: 'staging', SESSION_SECRET: value }), (e) => !e.message.includes(value), JSON.stringify(value));
    assert.throws(() => assertHardenedSecrets({ NODE_ENV: 'production', SESSION_SECRET: GOOD, JWT_SECRET: value }), (e) => !e.message.includes(value), JSON.stringify(value));
  }
});

test('outside the hardened modes a random per-process secret replaces a missing or weak one: never a constant, and the value is never logged', () => {
  const warnings = [];
  const secrets = [];
  for (const SESSION_SECRET of [undefined, 'capstone-secret', 'SENT-short']) {
    const out = resolveSessionSecret({ NODE_ENV: undefined, SESSION_SECRET }, { warn: (m) => warnings.push(m) });
    assert.equal(out.source, 'ephemeral'); assert.match(out.secret, /^[0-9a-f]{64}$/, '32 random bytes');
    assert.ok(!KNOWN_PUBLIC.has(out.secret.toLowerCase()));
    secrets.push(out.secret);
  }
  assert.equal(new Set(secrets).size, 3, 'a different secret every time: there is no constant');
  assert.equal(warnings.length, 3);
  assert.ok(warnings.every((w) => /Sessions end when the server restarts/.test(w)) && warnings.every((w) => !w.includes('SENTINEL')), 'the warning says what it means and never contains the value');
  assert.equal(resolveSessionSecret({ NODE_ENV: 'development', SESSION_SECRET: GOOD }, { warn: () => assert.fail('no warning for a good secret') }).source, 'configured', 'development with a configured secret keeps using it');
});

test('hardened startup also requires an acceptable JWT_SECRET and does nothing in development', () => {
  assert.deepEqual(assertHardenedSecrets({ NODE_ENV: undefined }), [], 'development: not enforced');
  assert.deepEqual(assertHardenedSecrets({ NODE_ENV: 'test' }), []);
  const ok = { NODE_ENV: 'staging', SESSION_SECRET: GOOD, JWT_SECRET: 'another-random-jwt-secret-9876543210' };
  assert.deepEqual(assertHardenedSecrets(ok), ['SESSION_SECRET', 'JWT_SECRET']);
  assert.throws(() => assertHardenedSecrets({ ...ok, JWT_SECRET: undefined }), (e) => e.variable === 'JWT_SECRET');
  assert.throws(() => assertHardenedSecrets({ ...ok, SESSION_SECRET: 'capstone-secret' }), (e) => e.variable === 'SESSION_SECRET');
  assert.throws(() => assertHardenedSecrets({ ...ok, NODE_ENV: 'production', JWT_SECRET: 'short' }), (e) => e.variable === 'JWT_SECRET' && /NODE_ENV=production/.test(e.message));
});
