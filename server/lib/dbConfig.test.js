// How the server connects to its database, and what it checks about that database before it listens (docs/security/SECURITY-AUDIT-REPORT.md
// DB-01, DB-02, DB-05, DB-07). No database: the checks run against a fake that answers SHOW GRANTS and the two user queries. Run: npm test (project root).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveDbConfig, resolveConnectionConfig, applySessionSettings, excessPrivileges, seededAccounts, assertDatabaseSafe, e2eScratch, SEED_FILE, STRICT_SQL_MODE } = require('./dbConfig');
const { EventEmitter } = require('node:events');

const problem = (fn, re) => assert.throws(fn, (e) => e.code === 'db_config_invalid' && re.test(e.message), String(re));
const base = { DB_HOST: 'localhost', DB_USER: 'app', DB_PASS: 'not-a-real-password', DB_NAME: 'syllabus' };
const staging = { ...base, NODE_ENV: 'staging' };

test('development keeps the connection it always had, now with bounds on waiting', () => {
  const c = resolveDbConfig({ DB_HOST: 'localhost', DB_USER: 'root', DB_PASS: '', DB_NAME: 'syllabus_db' });
  assert.deepEqual(c.pool, { host: 'localhost', port: 3306, user: 'root', password: '', database: 'syllabus_db', waitForConnections: true, connectionLimit: 10, queueLimit: 200, connectTimeout: 10000 });
  assert.equal(c.ssl, 'off');
  assert.equal(c.strict, false);
});

test('the port, pool size and queue come from the environment and are checked', () => {
  const c = resolveDbConfig({ ...base, DB_PORT: '3307', DB_POOL_SIZE: '20', DB_POOL_QUEUE: '50' });
  assert.equal(c.pool.port, 3307);
  assert.equal(c.pool.connectionLimit, 20);
  assert.equal(c.pool.queueLimit, 50);
  problem(() => resolveDbConfig({ ...base, DB_PORT: '0' }), /DB_PORT/);
  problem(() => resolveDbConfig({ ...base, DB_PORT: '70000' }), /DB_PORT/);
  problem(() => resolveDbConfig({ ...base, DB_PORT: 'mysql' }), /DB_PORT/);
  problem(() => resolveDbConfig({ ...base, DB_POOL_SIZE: '0' }), /DB_POOL_SIZE/);
  problem(() => resolveDbConfig({ ...base, DB_POOL_SIZE: '1000' }), /DB_POOL_SIZE/);
  problem(() => resolveDbConfig({ ...base, DB_POOL_QUEUE: '0' }), /DB_POOL_QUEUE/); // 0 would mean an unlimited queue
});

test('TLS: off or required; required encrypts and verifies the server, with an optional CA file', () => {
  assert.equal(resolveDbConfig({ ...base, DB_SSL: 'off' }).pool.ssl, undefined);
  const on = resolveDbConfig({ ...base, DB_HOST: 'db.internal.example', DB_SSL: 'required' });
  assert.deepEqual(on.pool.ssl, { minVersion: 'TLSv1.2', rejectUnauthorized: true });
  const ca = path.join(os.tmpdir(), 'dbconfig-test-ca-' + process.pid + '.pem');
  fs.writeFileSync(ca, 'not a real certificate');
  try { assert.equal(resolveDbConfig({ ...base, DB_SSL: 'required', DB_SSL_CA: ca }).pool.ssl.ca, 'not a real certificate'); } finally { fs.rmSync(ca, { force: true }); }
  problem(() => resolveDbConfig({ ...base, DB_SSL: 'required', DB_SSL_CA: path.join(os.tmpdir(), 'no-such-ca.pem') }), /DB_SSL_CA/);
  problem(() => resolveDbConfig({ ...base, DB_SSL: 'maybe' }), /DB_SSL/);
  problem(() => resolveDbConfig({ ...base, DB_SSL: 'off', DB_SSL_CA: ca }), /DB_SSL_CA/);
});

test('staging and production: a database on another machine must use TLS, and every connection setting must be there', () => {
  for (const mode of ['staging', 'production']) {
    const env = { ...base, NODE_ENV: mode };
    assert.equal(resolveDbConfig(env).strict, true); // a local database needs no TLS
    for (const local of ['localhost', '127.0.0.1', '::1']) assert.equal(resolveDbConfig({ ...env, DB_HOST: local }).pool.ssl, undefined);
    problem(() => resolveDbConfig({ ...env, DB_HOST: 'db.internal.example' }), /DB_SSL=required/);
    problem(() => resolveDbConfig({ ...env, DB_HOST: '10.0.0.5', DB_SSL: 'off' }), /DB_SSL=required/);
    assert.ok(resolveDbConfig({ ...env, DB_HOST: '10.0.0.5', DB_SSL: 'required' }).pool.ssl);
    for (const name of ['DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME']) problem(() => resolveDbConfig({ ...env, [name]: '' }), new RegExp(name));
    problem(() => resolveDbConfig({ ...env, DB_USER: 'root' }), /DB_USER/); // the server never runs as the database's own administrator
  }
});

test('an error never repeats the password or any other value', () => {
  for (const env of [{ ...staging, DB_HOST: 'db.internal.example' }, { ...staging, DB_PORT: 'x' }, { ...staging, DB_NAME: '' }]) {
    try { resolveDbConfig(env); assert.fail('expected a refusal'); } catch (e) { assert.ok(!e.message.includes('not-a-real-password')); }
  }
});

// ---- what the application's account may do ----

test('excessPrivileges: an account limited to reading and writing rows is fine; anything that can change or destroy the schema is named', () => {
  assert.deepEqual(excessPrivileges(['GRANT USAGE ON *.* TO `app`@`localhost`', 'GRANT SELECT, INSERT, UPDATE, DELETE ON `syllabus`.* TO `app`@`localhost`']), []);
  assert.deepEqual(excessPrivileges(['GRANT SELECT, INSERT, UPDATE, DELETE, CREATE TEMPORARY TABLES, LOCK TABLES ON `syllabus`.* TO `app`@`%`']), []);
  assert.deepEqual(excessPrivileges(['GRANT ALL PRIVILEGES ON *.* TO `root`@`localhost` WITH GRANT OPTION']), ['ALL PRIVILEGES', 'GRANT OPTION']);
  assert.deepEqual(excessPrivileges(['GRANT ALL PRIVILEGES ON `syllabus`.* TO `app`@`localhost`']), ['ALL PRIVILEGES']);
  assert.deepEqual(excessPrivileges(['GRANT USAGE ON *.* TO `app`@`%`', 'GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX ON `syllabus`.* TO `app`@`%`']), ['ALTER', 'CREATE', 'DROP', 'INDEX']);
  assert.deepEqual(excessPrivileges(['GRANT SELECT, FILE, SUPER, PROCESS, RELOAD, SHUTDOWN, CREATE USER ON *.* TO `app`@`%`']), ['CREATE USER', 'FILE', 'PROCESS', 'RELOAD', 'SHUTDOWN', 'SUPER']);
  assert.deepEqual(excessPrivileges(['GRANT SELECT (email), UPDATE (email) ON `syllabus`.`users` TO `app`@`%`']), []); // column privileges
  assert.deepEqual(excessPrivileges(['GRANT `dba`@`%` TO `app`@`%`']), ['A ROLE']); // a role can carry anything: not accepted
});

const fakeDb = ({ grants = ['GRANT SELECT, INSERT, UPDATE, DELETE ON `syllabus`.* TO `app`@`localhost`'], users = [], fail = null } = {}) => ({
  asked: [],
  async query(sql, params) {
    this.asked.push(sql);
    if (fail) throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3306 using password not-a-real-password'), { code: fail });
    if (/^SHOW GRANTS/.test(sql)) return [grants.map((g) => ({ 'Grants for app@localhost': g }))];
    if (/FROM users WHERE password_hash IN/.test(sql)) return [users.filter((u) => params[0].includes(u.password_hash)).map((u) => ({ user_id: u.user_id }))];
    throw new Error('unexpected query: ' + sql);
  },
});

test('seed.sql is read for the demo accounts: their emails and their password hashes', () => {
  const seeded = seededAccounts();
  assert.ok(seeded.length >= 2);
  for (const a of seeded) { assert.match(a.email, /^[^@\s]+@[^@\s]+$/); assert.match(a.hash, /^\$2[aby]\$\d\d\$.{53}$/); }
  assert.deepEqual(seededAccounts(path.join(os.tmpdir(), 'no-seed-file.sql')), []);
  assert.ok(fs.existsSync(SEED_FILE));
});

test('staging and production refuse to start on an over-privileged account, naming the privileges and how to fix it', async () => {
  await assert.rejects(assertDatabaseSafe(fakeDb({ grants: ['GRANT ALL PRIVILEGES ON *.* TO `root`@`localhost` WITH GRANT OPTION'] }), staging),
    (e) => e.code === 'db_account_unsafe' && /ALL PRIVILEGES, GRANT OPTION/.test(e.message) && /SELECT, INSERT, UPDATE, DELETE/.test(e.message));
  await assert.rejects(assertDatabaseSafe(fakeDb({ grants: ['GRANT SELECT, INSERT, UPDATE, DELETE, DROP ON `syllabus`.* TO `app`@`%`'] }), staging), (e) => e.code === 'db_account_unsafe' && /DROP/.test(e.message));
});

test('staging and production refuse to start while an account still has a demo password from seed.sql', async () => {
  const demoHash = seededAccounts()[0].hash;
  const db = fakeDb({ users: [{ user_id: 1, password_hash: demoHash }, { user_id: 2, password_hash: '$2a$10$' + 'x'.repeat(53) }] });
  await assert.rejects(assertDatabaseSafe(db, staging), (e) => e.code === 'db_demo_accounts' && /1 account/.test(e.message) && !e.message.includes(demoHash));
});

test('staging and production refuse to start when the checks cannot be made, without repeating the driver\'s message', async () => {
  await assert.rejects(assertDatabaseSafe(fakeDb({ fail: 'ECONNREFUSED' }), staging), (e) => e.code === 'db_check_failed' && /ECONNREFUSED/.test(e.message) && !/not-a-real-password/.test(e.message));
});

test('a safe account on a clean database passes, and says what was checked', async () => {
  const result = await assertDatabaseSafe(fakeDb({ users: [{ user_id: 2, password_hash: '$2a$10$' + 'x'.repeat(53) }] }), staging);
  assert.deepEqual(result, { checked: true, excess: [], demoAccounts: 0, warnings: [] });
});

test('development never refuses: the same findings come back as warnings, and an unreachable database is left to the health check', async () => {
  const demoHash = seededAccounts()[0].hash;
  const loud = await assertDatabaseSafe(fakeDb({ grants: ['GRANT ALL PRIVILEGES ON *.* TO `root`@`localhost` WITH GRANT OPTION'], users: [{ user_id: 1, password_hash: demoHash }] }), base);
  assert.equal(loud.checked, true);
  assert.deepEqual(loud.excess, ['ALL PRIVILEGES', 'GRANT OPTION']);
  assert.equal(loud.demoAccounts, 1);
  assert.equal(loud.warnings.length, 2);
  const down = await assertDatabaseSafe(fakeDb({ fail: 'ECONNREFUSED' }), base);
  assert.equal(down.checked, false);
  assert.equal(down.warnings.length, 1);
});

test('DB_E2E_SCRATCH=1 relaxes the account rules only for a local database whose name contains "e2e", and is refused anywhere else', async () => {
  const e2e = { NODE_ENV: 'staging', DB_HOST: 'localhost', DB_USER: 'root', DB_PASS: '', DB_NAME: 'syllabus_e2e_local', DB_E2E_SCRATCH: '1' };
  assert.equal(e2eScratch(e2e), true);
  assert.equal(resolveDbConfig(e2e).pool.user, 'root'); // what scripts/e2e/stack.cjs starts the real server with
  const loud = await assertDatabaseSafe(fakeDb({ grants: ['GRANT ALL PRIVILEGES ON *.* TO `root`@`localhost` WITH GRANT OPTION'] }), e2e);
  assert.deepEqual([loud.checked, loud.warnings.length], [true, 1]); // a warning, not a refusal
  problem(() => resolveDbConfig({ ...e2e, DB_NAME: 'syllabus_cms_plus' }), /DB_E2E_SCRATCH/);          // a real database name
  problem(() => resolveDbConfig({ ...e2e, DB_HOST: 'db.internal.example', DB_SSL: 'required' }), /DB_E2E_SCRATCH/); // another machine
  problem(() => resolveDbConfig({ ...e2e, DB_E2E_SCRATCH: 'yes' }), /DB_E2E_SCRATCH/);
  await assert.rejects(assertDatabaseSafe(fakeDb(), { ...e2e, DB_NAME: 'syllabus_cms_plus' }), (e) => e.code === 'db_config_invalid');
  assert.equal(e2eScratch({ ...e2e, DB_E2E_SCRATCH: '' }), false);
  problem(() => resolveDbConfig({ ...e2e, DB_E2E_SCRATCH: '' }), /DB_PASS|DB_USER/); // without it the staging rules apply to the same settings
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', 'e2e', 'stack.cjs'), 'utf8'), /DB_E2E_SCRATCH: '1'/);
});

test('DB_SQL_STRICT: off by default; on sets the strict sql_mode on every new connection, first', () => {
  assert.equal(resolveDbConfig(base).sqlMode, null);
  assert.equal(applySessionSettings(new EventEmitter(), resolveDbConfig(base)), false);
  problem(() => resolveDbConfig({ ...base, DB_SQL_STRICT: 'yes' }), /DB_SQL_STRICT/);
  const config = resolveDbConfig({ ...base, DB_SQL_STRICT: 'on' });
  assert.match(config.sqlMode, /STRICT_TRANS_TABLES/);
  assert.doesNotMatch(config.sqlMode, /ONLY_FULL_GROUP_BY/);
  const pool = new EventEmitter();
  assert.equal(applySessionSettings(pool, config), true);
  const sent = [];
  pool.emit('connection', { query: (sql, params, cb) => { sent.push([sql, params]); cb(null); } });
  assert.deepEqual(sent, [['SET SESSION sql_mode = ?', [STRICT_SQL_MODE]]]);
});

test('DB_SQL_STRICT=on is checked at startup: staging and production refuse to start if the connection is not strict', async () => {
  const withMode = (mode) => { const db = fakeDb(); const original = db.query.bind(db); db.query = async (sql, p) => (/@@SESSION\.sql_mode/.test(sql) ? [[{ mode }]] : original(sql, p)); return db; };
  assert.deepEqual((await assertDatabaseSafe(withMode(STRICT_SQL_MODE), { ...staging, DB_SQL_STRICT: 'on' })).warnings, []);
  await assert.rejects(assertDatabaseSafe(withMode('NO_ENGINE_SUBSTITUTION'), { ...staging, DB_SQL_STRICT: 'on' }), (e) => e.code === 'db_sql_mode');
  const dev = await assertDatabaseSafe(withMode(''), { ...base, DB_SQL_STRICT: 'on' });
  assert.equal(dev.warnings.length, 1);
  assert.deepEqual((await assertDatabaseSafe(withMode(''), staging)).warnings, [], 'off: the mode is not asked for');
});

test('server/index.js builds its pool from this module and checks the database before it listens', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  assert.match(source, /mysql\.createPool\(dbConfig\.pool\)/);
  assert.match(source, /applySessionSettings\(pool, dbConfig\)/);
  assert.doesNotMatch(source, /process\.env\.DB_PASS/);
  const check = source.indexOf('assertDatabaseSafe(pool'), listen = source.indexOf('app.listen(');
  assert.ok(check > 0 && check < listen, 'assertDatabaseSafe runs before app.listen');
});

test('resolveConnectionConfig honours DB_PORT, DB_SSL, DB_SSL_CA and includeDatabase: false without pool-only keys', () => {
  const dev = resolveConnectionConfig({ DB_HOST: 'localhost', DB_USER: 'root', DB_PASS: '', DB_NAME: 'syllabus_db' });
  assert.deepEqual(dev, { host: 'localhost', port: 3306, user: 'root', password: '', database: 'syllabus_db', connectTimeout: 10000 });
  const initCfg = resolveConnectionConfig({ ...base, DB_PORT: '3307', DB_HOST: 'db.internal.example', DB_SSL: 'required' }, { includeDatabase: false });
  assert.equal(initCfg.port, 3307);
  assert.equal('database' in initCfg, false);
  assert.deepEqual(initCfg.ssl, { minVersion: 'TLSv1.2', rejectUnauthorized: true });
  assert.equal('connectionLimit' in initCfg, false);
  // Standalone migration scripts allow a separate migration/root account in staging/production, but still require TLS on non-loopback hosts.
  assert.equal(resolveConnectionConfig({ ...staging, DB_USER: 'root' }).user, 'root');
  problem(() => resolveConnectionConfig({ ...staging, DB_HOST: 'db.internal.example' }), /DB_SSL=required/);
  problem(() => resolveConnectionConfig({ ...base, DB_PORT: 'bad' }), /DB_PORT/);
});

test('every standalone script in server/db/ connects through resolveConnectionConfig (honours DB_PORT and DB_SSL)', () => {
  const dbDir = path.join(__dirname, '..', 'db');
  const scripts = fs.readdirSync(dbDir).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'));
  let checked = 0;
  for (const file of scripts) {
    const src = fs.readFileSync(path.join(dbDir, file), 'utf8');
    if (!/createConnection|createPool/.test(src)) continue;
    checked++;
    assert.match(src, /resolveConnectionConfig/, `${file} must use resolveConnectionConfig from ../lib/dbConfig`);
    assert.doesNotMatch(src, /createConnection\(\s*\{[\s\S]*?DB_HOST/, `${file} must not hardcode createConnection({ host: DB_HOST })`);
    if (file === 'init.js') assert.match(src, /includeDatabase:\s*false/, 'init.js must omit database before CREATE DATABASE');
  }
  assert.ok(checked >= 40, 'expected to check all server/db scripts, got ' + checked);
});
