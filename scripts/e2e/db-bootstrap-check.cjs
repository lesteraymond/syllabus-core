'use strict';
// Proves that a NEW database can be provisioned from the repository alone: server/db/init.js (schema.sql + seed.sql), then every migrate-* script of server/package.json in order.
// It only ever touches an isolated scratch database whose name contains "e2e" (default syllabus_e2e_bootstrap), on this machine. No development, staging or production database is read or changed.
//   E2E_DB_HOST / E2E_DB_USER / E2E_DB_PASS   connection (default localhost, root, empty password: a local MariaDB/MySQL such as XAMPP)
//   E2E_DB_NAME                               scratch name (must contain "e2e")
//   E2E_KEEP=1                                keep the built database (scripts/e2e/run-e2e.cjs does, then seeds it)
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
if (process.env.E2E_DB_PORT) require('./db-port-redirect.cjs'); // test-only: this process's own connection goes to the isolated server
const REDIRECT = process.env.E2E_DB_PORT ? ['-r', path.join(__dirname, 'db-port-redirect.cjs')] : [];
const ROOT = path.resolve(__dirname, '../..');
const SERVER = path.join(ROOT, 'server');
const mysql = require(path.join(SERVER, 'node_modules/mysql2/promise'));

const cfg = { host: process.env.E2E_DB_HOST || 'localhost', user: process.env.E2E_DB_USER || 'root', password: process.env.E2E_DB_PASS || '' };
const name = process.env.E2E_DB_NAME || 'syllabus_e2e_bootstrap';
// migrate-program-outcome-sources links specializations to programs that exist; on an empty database it correctly reports "program not found" and exits 1.
const EXPECTED_NONZERO = new Set(['migrate-program-outcome-sources']);
// tables the application code reads or writes and that must exist after a bootstrap
const REQUIRED = ['users', 'syllabi', 'courses', 'programs', 'syllabus_versions', 'syllabus_review_stages', 'syllabus_check_reports', 'syllabus_check_decisions', 'syllabus_check_curricula', 'ai_check_runs', 'remember_tokens', 'faculty_courses', 'course_assignments', 'program_outcomes', 'institution_settings', 'notifications', 'messages', 'usage_daily'];

(async () => {
  if (!/e2e/i.test(name)) throw new Error('refusing to run: the scratch database name must contain "e2e"');
  if (!['localhost', '127.0.0.1', '::1'].includes(cfg.host)) throw new Error('refusing to run: the scratch database must be on this machine');
  const admin = await mysql.createConnection(cfg);
  await admin.query('DROP DATABASE IF EXISTS ??', [name]);
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-')); // empty: no .env is picked up
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, DB_HOST: cfg.host, DB_USER: cfg.user, DB_PASS: cfg.password, DB_NAME: name };
  const run = (script, extra = {}) => spawnSync(process.execPath, [...REDIRECT, path.join(SERVER, 'db', script + '.js')], { cwd, env: { ...env, ...(process.env.E2E_DB_PORT ? { E2E_DB_PORT: process.env.E2E_DB_PORT } : {}), ...extra }, encoding: 'utf8' });
  const problems = [];
  const init = run('init', { NODE_ENV: 'staging' }); // as a staging/production database is provisioned: the demo accounts must NOT be inserted
  if (init.status !== 0) problems.push('init.js failed: ' + String(init.stdout + init.stderr).split(/\r?\n/).filter(Boolean).pop());
  const scripts = Object.keys(JSON.parse(fs.readFileSync(path.join(SERVER, 'package.json'), 'utf8')).scripts).filter((k) => k.startsWith('migrate-'));
  for (const s of scripts) {
    const r = run(s);
    if (r.status !== 0 && !EXPECTED_NONZERO.has(s)) problems.push(`${s} failed (exit ${r.status}): ${String(r.stderr || r.stdout).split(/\r?\n/).find((l) => l.trim())}`);
  }
  const [[demo]] = await admin.query('SELECT COUNT(*) n FROM ??.users', [name]);
  if (demo.n !== 0) problems.push('a staging-mode init inserted ' + demo.n + ' user(s): the demo accounts must not exist');
  const made = run('create-admin', { CREATE_ADMIN_EMAIL: 'first.admin@bootstrap.invalid', CREATE_ADMIN_PASSWORD: 'Bootstrap-Temp-9x' });
  const [[adm]] = await admin.query("SELECT role, must_change_password m, password_hash h FROM ??.users WHERE email = 'first.admin@bootstrap.invalid'", [name]).catch(() => [[null]]);
  if (made.status !== 0 || !adm || adm.role !== 'admin' || adm.m !== 1 || /Bootstrap-Temp-9x/.test(adm.h)) problems.push('create-admin did not create a must-change-password administrator with a hashed password');
  if (/Bootstrap-Temp-9x/.test(made.stdout + made.stderr)) problems.push('create-admin printed the password');
  const [tables] = await admin.query('SELECT table_name t FROM information_schema.tables WHERE table_schema = ?', [name]);
  const have = new Set(tables.map((r) => r.t));
  const missing = REQUIRED.filter((t) => !have.has(t));
  if (missing.length) problems.push('missing tables after bootstrap: ' + missing.join(', '));
  if (!process.env.E2E_KEEP) await admin.query('DROP DATABASE ??', [name]); // E2E_KEEP=1 leaves the freshly built scratch database for the browser E2E run
  await admin.end();
  console.log(JSON.stringify({ scratchDatabase: name, migrationsRun: scripts.length, tables: have.size, missing, problems }));
  process.exitCode = problems.length ? 1 : 0;
})().catch((e) => { console.error('db bootstrap check failed:', e.message); process.exit(2); });
