'use strict';
// Staging security conformance: the session secret, secrets never printed, and repository hygiene. The server is started for real (server/index.js) but only in
// situations where it must stop before it opens a database connection or a port; nothing is sent anywhere and no real secret is used or shown.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../../../..');
const INDEX = path.join(ROOT, 'server/index.js');
const GOOD_A = 'sentinel-session-secret-AAAA-1234567890', GOOD_B = 'sentinel-jwt-secret-BBBB-0987654321';

// An empty working directory: server/index.js reads `.env` from the CURRENT directory, so the developer's real server/.env is never loaded.
function boot(env) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'vpaa-boot-'));
  try {
    const r = spawnSync(process.execPath, [INDEX], { cwd, encoding: 'utf8', timeout: 30000, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env } });
    return { status: r.status, out: (r.stdout || '') + (r.stderr || ''), signal: r.signal };
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
}

test('[VPAA-SEC-INDEX] server/index.js has no secret literal: the session secret comes only from the shared resolver, which runs before the database pool exists', () => {
  const src = fs.readFileSync(INDEX, 'utf8');
  assert.ok(!/capstone-secret/.test(src), 'the public default is gone from index.js');
  assert.ok(!/SESSION_SECRET\s*\|\|/.test(src), 'no `SESSION_SECRET || fallback`');
  assert.match(src, /secret:\s*sessionSecret/);
  assert.match(src, /resolveSessionSecret\(process\.env\)/);
  assert.ok(src.indexOf('assertHardenedSecrets(') < src.indexOf('mysql.createPool('), 'secrets are checked before a database pool is created');
  assert.ok(src.indexOf('assertHardenedSecrets(') < src.indexOf('app.listen('), 'and before the server listens');
});

test('[VPAA-SEC-NO-FALLBACKS] no server source falls back to a public constant for a secret, and the former constants appear only in the refusal list', () => {
  const hits = [];
  const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { if (['node_modules', 'uploads', 'private'].includes(e.name)) continue; const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (/\.(js|cjs|mjs)$/.test(e.name) && !/\.test\./.test(e.name) && !p.includes('vpaa-conformance')) { const t = fs.readFileSync(p, 'utf8'); if (/process\.env\.[A-Z_]*(SECRET|KEY|TOKEN)[A-Z_]*\s*(\|\||\?\?)\s*['"`][^'"`]+['"`]/.test(t)) hits.push(path.relative(ROOT, p)); if (/capstone-secret|syllabus-academic-verification-secret/.test(t) && !p.endsWith('sessionSecret.js')) hits.push(path.relative(ROOT, p) + ' (constant)'); } } };
  walk(path.join(ROOT, 'server'));
  assert.deepEqual(hits, [], 'secret-like variables with a literal fallback, or the old constants outside the refusal list');
});

test('[VPAA-SEC-FAIL-CLOSED] the real server REFUSES to start in staging and production without acceptable secrets, before touching a database, and never prints what was configured', () => {
  const cases = [
    ['staging', {}, 'SESSION_SECRET'], ['production', {}, 'SESSION_SECRET'],
    ['staging', { SESSION_SECRET: 'capstone-secret', JWT_SECRET: GOOD_B }, 'SESSION_SECRET'], ['production', { SESSION_SECRET: 'SENT-short', JWT_SECRET: GOOD_B }, 'SESSION_SECRET'],
    ['staging', { SESSION_SECRET: 'aaaaaaaaaaaaaaaaaaaaaaaa', JWT_SECRET: GOOD_B }, 'SESSION_SECRET'],
    ['staging', { SESSION_SECRET: GOOD_A }, 'JWT_SECRET'], ['production', { SESSION_SECRET: GOOD_A, JWT_SECRET: 'SENT-jwt' }, 'JWT_SECRET'],
    // host settings (secrets are fine here): each missing or unsafe one stops the server too
    ...[
      [{}, 'CORS_ALLOWED_ORIGINS'], [{ CORS_ALLOWED_ORIGINS: '*', TRUST_PROXY: '1' }, 'CORS_ALLOWED_ORIGINS'], [{ CORS_ALLOWED_ORIGINS: 'https://app.staging.invalid/', TRUST_PROXY: '1' }, 'CORS_ALLOWED_ORIGINS'],
      [{ CORS_ALLOWED_ORIGINS: 'http://app.staging.invalid', TRUST_PROXY: '1' }, 'CORS_ALLOWED_ORIGINS'], [{ CORS_ALLOWED_ORIGINS: 'https://app.staging.invalid' }, 'TRUST_PROXY'],
      [{ CORS_ALLOWED_ORIGINS: 'https://app.staging.invalid', TRUST_PROXY: 'true' }, 'TRUST_PROXY'], [{ CORS_ALLOWED_ORIGINS: 'https://app.staging.invalid', TRUST_PROXY: '1', SESSION_COOKIE_SECURE: 'false' }, 'SESSION_COOKIE_SECURE'],
      [{ CORS_ALLOWED_ORIGINS: 'https://app.staging.invalid', TRUST_PROXY: '1', SESSION_COOKIE_SAMESITE: 'whenever' }, 'SESSION_COOKIE_SAMESITE'],
    ].flatMap(([extra, variable]) => ['staging', 'production'].map((mode) => [mode, { SESSION_SECRET: GOOD_A, JWT_SECRET: GOOD_B, ...extra }, variable])),
  ];
  for (const [mode, extra, variable] of cases) {
    const r = boot({ NODE_ENV: mode, ...extra });
    assert.equal(r.status, 1, `NODE_ENV=${mode} ${JSON.stringify(Object.keys(extra))}: exits with status 1 (got ${r.status}, ${r.signal || 'no signal'})`);
    assert.match(r.out, /FATAL/); assert.ok(r.out.includes(variable), `names ${variable}`);
    if (['SESSION_SECRET', 'JWT_SECRET'].includes(variable)) assert.match(r.out, new RegExp(`NODE_ENV=${mode}`));
    for (const key of ['SESSION_SECRET', 'JWT_SECRET']) if (extra[key]) assert.ok(!r.out.includes(extra[key]), 'the output never contains a configured secret');
    assert.ok(!/Server running|listening|Auth endpoints/i.test(r.out), 'it never started');
  }
});

test('[VPAA-SEC-READINESS-NO-LEAK] the credential report and the Policy V2 preflight never print a value, a prefix or a fragment of any secret', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vpaa-env-'));
  const secrets = { SESSION_SECRET: 'LEAKCHECK-session-ZQXJ-7788990011', JWT_SECRET: 'LEAKCHECK-jwt-WVKM-1122334455-66778899', DB_PASS: 'LEAKCHECK-dbpass-PLMN-4455', SMTP_PASS: 'LEAKCHECK-smtp-GHJK-3344', ANTHROPIC_API_KEY: 'sk-ant-LEAKCHECK-anthropic-RTYU-0099887766554433', OPENROUTER_API_KEY: 'sk-or-v1-LEAKCHECK-openrouter-FGHJ-5566778899aabbcc' };
  const file = path.join(dir, 'staging.env');
  fs.writeFileSync(file, Object.entries({ NODE_ENV: 'staging', SYLLABUS_CHECK_ACADEMIC_V2: 'on', SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', ANTHROPIC_MODEL: 'claude-sonnet-5-5', SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: 'claude-sonnet-5-5', ...secrets }).map(([k, v]) => `${k}=${v}`).join('\n') + '\n# GEMINI_API_KEY=LEAKCHECK-gemini-ABCD-1234567890\n');
  try {
    for (const script of ['scripts/credential-readiness.cjs', 'scripts/vpaa-v2-preflight.cjs']) {
      const r = spawnSync(process.execPath, [path.join(ROOT, script), '--env-file', file], { encoding: 'utf8', timeout: 60000 });
      const out = (r.stdout || '') + (r.stderr || '');
      assert.ok(out.length > 200, `${script} produced a report`);
      assert.ok(!out.includes('LEAKCHECK'), `${script}: no secret fragment (the marker LEAKCHECK appears in every value)`);
      for (const v of [...Object.values(secrets), 'LEAKCHECK-gemini-ABCD-1234567890']) for (let i = 0; i + 8 <= v.length; i += 4) assert.ok(!out.includes(v.slice(i, i + 8)), `${script}: no 8-character fragment of a secret`);
    }
    const cred = spawnSync(process.execPath, [path.join(ROOT, 'scripts/credential-readiness.cjs'), '--env-file', file], { encoding: 'utf8' }).stdout;
    assert.match(cred, /GEMINI_API_KEY[\s\S]*COMMENTED-OUT line still holds a value/, 'it does report that a commented-out line still holds a secret');
    assert.match(cred, /SMTP_PASS[\s\S]*EXPOSED/, 'and the credential the project notes record as shared');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('[VPAA-SEC-CREDENTIAL-REPORT] the credential report flags reuse, weak and missing secrets and exits non-zero until they are fixed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vpaa-env-'));
  const run = (lines) => { const f = path.join(dir, 'x.env'); fs.writeFileSync(f, lines.join('\n') + '\n'); const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/credential-readiness.cjs'), '--env-file', f], { encoding: 'utf8' }); return { status: r.status, out: r.stdout }; };
  try {
    const weak = run(['SESSION_SECRET=capstone-secret', 'JWT_SECRET=short', 'DB_PASS=', 'ANTHROPIC_API_KEY=not-an-anthropic-key-format-0123456789']);
    assert.equal(weak.status, 1);
    assert.match(weak.out, /SESSION_SECRET[\s\S]*WEAK: a publicly known default/); assert.match(weak.out, /JWT_SECRET[\s\S]*WEAK: shorter than 16/); assert.match(weak.out, /DB_PASS[\s\S]*EMPTY/); assert.match(weak.out, /ANTHROPIC_API_KEY[\s\S]*unexpected key format/);
    const reuse = run(['SESSION_SECRET=reused-value-0123456789-abcdef', 'JWT_SECRET=reused-value-0123456789-abcdef', 'DB_PASS=a-real-db-password-1', 'ANTHROPIC_API_KEY=sk-ant-placeholder-for-this-test-0123456789']);
    assert.match(reuse.out, /SAME VALUE reused in/);
    const good = run(['SESSION_SECRET=sentinel-session-secret-AAAA-1234567890', 'JWT_SECRET=sentinel-jwt-secret-BBBB-0987654321', 'DB_PASS=a-real-db-password-1', 'ANTHROPIC_API_KEY=sk-ant-placeholder-for-this-test-0123456789']);
    assert.ok(!/\[ACTION\] (SESSION_SECRET|JWT_SECRET|DB_PASS|ANTHROPIC_API_KEY)/.test(good.out), 'a good file has no blocking action for the required secrets');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('[VPAA-SEC-HYGIENE] the environment files are git-ignored and untracked, and no real-looking provider key is committed', () => {
  const git = (args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  for (const f of ['.env', 'server/.env']) { assert.notEqual(git(['ls-files', '--error-unmatch', f]).status, 0, `${f} is not tracked`); assert.equal(git(['check-ignore', '-q', f]).status, 0, `${f} is git-ignored`); }
  assert.equal(git(['ls-files', '--error-unmatch', 'server/.env.example']).status, 0, 'the example file (no values) is tracked');
  const example = fs.readFileSync(path.join(ROOT, 'server/.env.example'), 'utf8');
  assert.ok(!/(sk-ant-|sk-or-v1-|AIza)[A-Za-z0-9_-]{20,}/.test(example), 'the example file holds no key');
  const tracked = git(['grep', '-IoE', 'sk-ant-[A-Za-z0-9_-]{30,}|sk-or-v1-[A-Za-z0-9]{30,}|AIza[0-9A-Za-z_-]{35}|ghp_[A-Za-z0-9]{36}', 'HEAD']);
  const real = (tracked.stdout || '').split(/\r?\n/).filter(Boolean).filter((l) => !/not-a-real-key|placeholder|test-only|unit-test|offline-replay|example|fake|dummy|xxxx/i.test(l));
  assert.equal(real.length, 0, 'no real-looking provider key in the committed tree (placeholders excluded)');
});

test('[VPAA-SEC-TOKEN-RULE] the verification-token secret follows the same rule as the session secret', () => {
  const { signingSecret } = require('../refine');
  assert.equal(signingSecret('capstone-secret'), null); assert.equal(signingSecret('syllabus-academic-verification-secret'), null); assert.equal(signingSecret('aaaaaaaaaaaaaaaaaaaaaaaa'), null);
  assert.equal(signingSecret(GOOD_A), GOOD_A);
});
