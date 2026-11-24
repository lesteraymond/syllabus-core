'use strict';
// How the server connects to its database, and what it checks about that database before it listens. One place, validated at startup, like the secrets
// (lib/sessionSecret.js) and the host settings (lib/hostConfig.js). No value is ever printed or put in an error message.
//
// Connection settings (server/.env):
//   DB_HOST, DB_USER, DB_PASS, DB_NAME   as before. All four are REQUIRED when NODE_ENV is staging or production, and DB_USER may not be root there.
//   DB_PORT          the database port. Default 3306.
//   DB_SSL           off (default) | required. required encrypts the connection (TLS 1.2 or newer) and verifies the database server's certificate.
//                    REQUIRED when NODE_ENV is staging or production and DB_HOST is another machine (anything but localhost, 127.0.0.1, ::1): passwords, syllabi
//                    and student data must not cross a network in clear text.
//   DB_SSL_CA        path of the CA certificate file that signed the database server's certificate (only with DB_SSL=required; not needed for a public CA).
//   DB_POOL_SIZE     connections kept open. Default 10. 1 to 100.
//   DB_POOL_QUEUE    requests that may wait for a free connection. Default 200. 1 to 10000. Past it a request fails at once instead of waiting without end.
//   DB_SQL_STRICT    off (default) | on. on sets a strict sql_mode on every connection of the pool (STRICT_SQL_MODE below): a value too long for its column, or of
//                    the wrong type, is refused with an error instead of being silently cut or converted. Off keeps the server's own sql_mode, as before. Turn it
//                    on in staging only after the full browser E2E has passed against a strict database; once on, staging and production check at startup
//                    that it took effect, and refuse to start if it did not.
//
// The application's database account (assertDatabaseSafe). The running server only reads and writes rows, so its account needs SELECT, INSERT, UPDATE and DELETE on
// its own database and nothing else. An account that can also CREATE, ALTER or DROP turns any bug into the loss of the schema. In staging and production the server
// reads its own grants and refuses to start with more; development only warns. The scripts in server/db/ (init.js, the migrate-*.js files, create-admin.js) do need
// more: run them with a separate account for the migration window, by setting DB_USER and DB_PASS for that command only (a value already in the environment wins
// over server/.env), for example:  DB_USER=<migration account> DB_PASS=<its password> node db/migrate-deadlines.js
//
// Demo accounts. db/seed.sql holds accounts with publicly known passwords for local development. init.js never inserts them in staging or production, but a
// database made in development and promoted later would carry them: the server refuses to start in staging or production while any account still has one of
// those password hashes.
//
// The one exception: DB_E2E_SCRATCH=1. The local browser E2E (scripts/e2e/stack.cjs) runs this server as NODE_ENV=staging against a throwaway database as the
// local root account with no password. It is honoured ONLY when DB_HOST is this machine AND DB_NAME contains "e2e"; anywhere else it stops the server. With it,
// the account rules (a password, not root, the grant check, the demo-account check) become warnings; TLS, the port and the pool bounds are unchanged.
const fs = require('fs');
const path = require('path');
const { hardened } = require('./sessionSecret');

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const SEED_FILE = path.join(__dirname, '..', 'db', 'seed.sql');
// What the running server's account may hold. Everything else is excess (an allow-list, so a privilege nobody thought of is refused too).
const ALLOWED = new Set(['USAGE', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE TEMPORARY TABLES', 'LOCK TABLES', 'SHOW VIEW']);
const NEEDED = 'SELECT, INSERT, UPDATE, DELETE';
// MySQL 8's default sql_mode without ONLY_FULL_GROUP_BY (some list queries group by a key and read columns of that one row).
const STRICT_SQL_MODE = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

const fail = (code, message) => Object.assign(new Error(message), { code });
const clean = (v) => String(v ?? '').trim();

// true for the local E2E's scratch database (see the top of this file). Asking for the exception anywhere else is refused, not ignored.
function e2eScratch(env = process.env) {
  const asked = clean(env.DB_E2E_SCRATCH);
  if (!asked || asked === '0') return false;
  if (asked !== '1') throw fail('db_config_invalid', 'DB_E2E_SCRATCH must be 1 or unset.');
  if (!LOOPBACK.has(clean(env.DB_HOST).toLowerCase()) || !/e2e/i.test(clean(env.DB_NAME))) throw fail('db_config_invalid', 'DB_E2E_SCRATCH=1 is only for the local end-to-end test database: DB_HOST must be this machine and DB_NAME must contain "e2e". Remove it.');
  return true;
}
// Do the account rules stop the server (staging and production, except the E2E scratch database)?
const accountRulesEnforced = (env = process.env) => hardened(env) && !e2eScratch(env);

function wholeNumber(env, name, fallback, min, max) {
  const raw = clean(env[name]);
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max) throw fail('db_config_invalid', `${name} must be a whole number from ${min} to ${max} (the default is ${fallback}).`);
  return Number(raw);
}

// Shared TLS and port validation for both the server pool (resolveDbConfig) and standalone DB scripts (resolveConnectionConfig).
function resolveTlsAndPort(env = process.env) {
  const strict = hardened(env), mode = clean(env.NODE_ENV).toLowerCase() || 'development';
  const host = clean(env.DB_HOST);
  const ssl = clean(env.DB_SSL).toLowerCase() || 'off';
  if (!['off', 'required'].includes(ssl)) throw fail('db_config_invalid', 'DB_SSL must be off or required.');
  const caPath = clean(env.DB_SSL_CA);
  if (caPath && ssl !== 'required') throw fail('db_config_invalid', 'DB_SSL_CA is only used with DB_SSL=required.');
  if (strict && ssl !== 'required' && !LOOPBACK.has(host.toLowerCase())) throw fail('db_config_invalid', `DB_SSL=required is needed with NODE_ENV=${mode} when DB_HOST is another machine: the database connection must be encrypted.`);
  let tls;
  if (ssl === 'required') {
    tls = { minVersion: 'TLSv1.2', rejectUnauthorized: true };
    if (caPath) {
      try { tls.ca = fs.readFileSync(caPath, 'utf8'); } catch { throw fail('db_config_invalid', 'DB_SSL_CA names a file that cannot be read.'); }
    }
  }
  const port = wholeNumber(env, 'DB_PORT', 3306, 1, 65535);
  return { strict, mode, ssl, tls, port };
}

// Connection options for standalone scripts in server/db/ (init.js, migrate-*.js, create-admin.js, seed-*.js):
// honours DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME, DB_SSL and DB_SSL_CA, without pool-only keys or the server's non-root rule.
function resolveConnectionConfig(env = process.env, { includeDatabase = true } = {}) {
  const { tls, port } = resolveTlsAndPort(env);
  return {
    host: env.DB_HOST,
    port,
    user: env.DB_USER,
    password: env.DB_PASS,
    ...(includeDatabase ? { database: env.DB_NAME } : {}),
    connectTimeout: 10000,
    ...(tls ? { ssl: tls } : {}),
  };
}

// -> { pool: the options for mysql2's createPool, ssl: 'off' | 'required', strict }. Throws a db_config_invalid error naming the setting.
function resolveDbConfig(env = process.env) {
  const { strict, mode, ssl, tls, port } = resolveTlsAndPort(env);
  if (accountRulesEnforced(env)) {
    for (const name of ['DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME']) if (!clean(env[name])) throw fail('db_config_invalid', `${name} is required with NODE_ENV=${mode}.`);
    if (clean(env.DB_USER).toLowerCase() === 'root') throw fail('db_config_invalid', `DB_USER must not be the database's root account with NODE_ENV=${mode}: create an account for the application that may only ${NEEDED} on its own database.`);
  }
  const sqlStrict = clean(env.DB_SQL_STRICT).toLowerCase() || 'off';
  if (!['on', 'off'].includes(sqlStrict)) throw fail('db_config_invalid', 'DB_SQL_STRICT must be on or off.');
  const pool = {
    host: env.DB_HOST, port, user: env.DB_USER, password: env.DB_PASS, database: env.DB_NAME,
    waitForConnections: true,
    connectionLimit: wholeNumber(env, 'DB_POOL_SIZE', 10, 1, 100),
    queueLimit: wholeNumber(env, 'DB_POOL_QUEUE', 200, 1, 10000), // never 0: that is an unlimited queue
    connectTimeout: 10000,
    ...(tls ? { ssl: tls } : {}),
  };
  return { pool, ssl, strict, sqlMode: sqlStrict === 'on' ? STRICT_SQL_MODE : null };
}

// With DB_SQL_STRICT=on: every new connection of the pool sets the strict sql_mode before it runs anything else (a connection runs its commands in order, and the
// pool hands it out only after this event). A failure is logged; assertDatabaseSafe then finds the mode missing and, in staging and production, stops the server.
function applySessionSettings(pool, config) {
  if (!config || !config.sqlMode) return false;
  pool.on('connection', (connection) => {
    connection.query('SET SESSION sql_mode = ?', [config.sqlMode], (error) => { if (error) console.error('DATABASE: could not set the strict sql_mode on a connection (' + (error.code || 'error') + ').'); });
  });
  return true;
}

// The privileges in SHOW GRANTS output that the running server should not hold, sorted. [] when the account is limited to rows.
function excessPrivileges(grants) {
  const found = new Set();
  for (const line of grants || []) {
    const text = String(line).replace(/\s+/g, ' ').trim();
    const on = text.toUpperCase().indexOf(' ON ');
    if (!/^GRANT /i.test(text)) continue;
    if (on === -1) { found.add('A ROLE'); continue; } // GRANT <role> TO <account>: a role can carry any privilege
    if (/ WITH GRANT OPTION/i.test(text)) found.add('GRANT OPTION');
    const list = text.slice('GRANT '.length, on).replace(/\([^)]*\)/g, ''); // column lists removed: "SELECT (email)" is SELECT
    for (const raw of list.split(',')) {
      const privilege = raw.trim().toUpperCase().replace(/^ALL$/, 'ALL PRIVILEGES');
      if (privilege && !ALLOWED.has(privilege)) found.add(privilege);
    }
  }
  return [...found].sort();
}

// The demo accounts of db/seed.sql: [{ email, hash }]. [] when the file is not there.
function seededAccounts(file = SEED_FILE) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return []; }
  return [...text.matchAll(/\('([^'\s]+@[^'\s]+)',\s*'(\$2[aby]\$\d\d\$[^']{53})'/g)].map((m) => ({ email: m[1], hash: m[2] }));
}

// Before the server listens. Staging and production: throws (db_account_unsafe, db_demo_accounts, db_check_failed) and the server does not start. Any other mode:
// never throws; what it found comes back as warnings. -> { checked, excess, demoAccounts, warnings }
async function assertDatabaseSafe(db, env = process.env) {
  const strict = accountRulesEnforced(env), mode = clean(env.NODE_ENV).toLowerCase() || 'development';
  let excess, demoAccounts = 0, sqlModeWarning = null, sessionMode = null;
  try {
    const [rows] = await db.query('SHOW GRANTS FOR CURRENT_USER()');
    excess = excessPrivileges(rows.map((row) => Object.values(row)[0]));
    if (clean(env.DB_SQL_STRICT).toLowerCase() === 'on') {
      const [modes] = await db.query('SELECT @@SESSION.sql_mode AS mode');
      sessionMode = String((modes[0] || {}).mode || '');
    }
    const hashes = seededAccounts().map((a) => a.hash);
    if (hashes.length) {
      const [users] = await db.query('SELECT user_id FROM users WHERE password_hash IN (?)', [hashes]);
      demoAccounts = users.length;
    }
  } catch (error) {
    const code = (error && error.code) || 'unknown error'; // the code only: a driver message can repeat the host, the account or the statement
    if (strict) throw fail('db_check_failed', `The database could not be checked before starting (${code}). With NODE_ENV=${mode} the server does not start until it can read its own grants and the users table.`);
    return { checked: false, excess: [], demoAccounts: 0, warnings: [`the database could not be checked at startup (${code}).`] };
  }
  if (sessionMode !== null && !/(^|,)STRICT_(TRANS|ALL)_TABLES(,|$)/.test(sessionMode)) {
    const message = 'DB_SQL_STRICT=on, but the database connection is not in a strict sql_mode.';
    if (strict) throw fail('db_sql_mode', `With NODE_ENV=${mode} the server does not start: ${message}`);
    sqlModeWarning = message;
  }
  const tooMuch =`the application's database account can do more than the server needs (${excess.join(', ')}). It should only be able to ${NEEDED} on its own database; run the scripts in server/db/ with a separate account.`;
  const demo = `${demoAccounts} account${demoAccounts === 1 ? '' : 's'} still ${demoAccounts === 1 ? 'has' : 'have'} a demo password from db/seed.sql, which is publicly known. Remove ${demoAccounts === 1 ? 'it' : 'them'}, or give ${demoAccounts === 1 ? 'it' : 'them'} a new password.`;
  if (strict && excess.length) throw fail('db_account_unsafe', `With NODE_ENV=${mode} the server does not start: ${tooMuch}`);
  if (strict && demoAccounts) throw fail('db_demo_accounts', `With NODE_ENV=${mode} the server does not start: ${demo}`);
  return { checked: true, excess, demoAccounts, warnings: [...(excess.length ? [tooMuch] : []), ...(demoAccounts ? [demo] : []), ...(sqlModeWarning ? [sqlModeWarning] : [])] };
}

module.exports = { resolveDbConfig, resolveConnectionConfig, applySessionSettings, excessPrivileges, seededAccounts, assertDatabaseSafe, e2eScratch, SEED_FILE, ALLOWED, LOOPBACK, STRICT_SQL_MODE };
