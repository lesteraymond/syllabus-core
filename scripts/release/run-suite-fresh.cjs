'use strict';
// Browser suite against a frozen snapshot on a FRESHLY BOOTSTRAPPED isolated database (repository schema + every migrate-* script, including migrate-po-reference-publication), port E2E_DB_PORT
// (default 43311), one suite per invocation. The scratch database is created by the E2E runner itself (db-bootstrap-check.cjs; the name contains "e2e"); no existing database is touched.
//   node scripts/release/run-suite-fresh.cjs <snapshotLabel> <regression|comprehensive|budget> <off|on>
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const ROOT = path.resolve(__dirname, '../..');
const [label, suite, mode] = process.argv.slice(2);
if (!label || !['regression', 'comprehensive', 'budget'].includes(suite) || !['off', 'on'].includes(mode)) throw Error('usage: run-suite-fresh.cjs <label> <suite> <off|on>');
const snap = path.join(ROOT, 'tmp/release-candidate', label), OUT = path.join(ROOT, 'docs/release-candidate'), run = `${suite}-${mode}`;
const recommended = { SYLLABUS_CHECK_CACHE_WARMUP: 'on', SYLLABUS_CHECK_OUTPUT_PLAN: 'on', SYLLABUS_CHECK_OUTPUT_FIELDS: 'scoped' };
const offAll = Object.fromEntries(['CACHE_WARMUP', 'OUTPUT_PLAN', 'OUTPUT_FIELDS', 'COURSE_CONTEXT', 'V2_GROUPING', 'PROMPT_TRIM'].map((n) => ['SYLLABUS_CHECK_' + n, 'off']));
const verify = () => JSON.parse(cp.spawnSync(process.execPath, [path.join(ROOT, 'scripts/release/snapshot.cjs'), 'verify', label], { encoding: 'utf8' }).stdout || '{}');
const before = verify();
const env = { ...process.env, VITE_NEW_BUILDER: 'true', PATH: 'C:/xampp/apache/bin;' + process.env.PATH, OPENSSL_CONF: 'C:/xampp/apache/conf/openssl.cnf', E2E_DB_PORT: process.env.E2E_DB_PORT || '43311', E2E_DB_NAME: `syllabus_e2e_dyn_${suite}`,
  E2E_OUT_SUFFIX: 'dyn-' + run, ...(process.env.E2E_ONLY ? { E2E_ONLY: process.env.E2E_ONLY } : {}), E2E_EXTRA_ENV: JSON.stringify({ ...offAll, ...(mode === 'on' ? recommended : {}) }) };
delete env.E2E_SKIP_BOOTSTRAP; delete env.E2E_NO_DDL;
if (suite === 'regression') env.E2E_NO_PROFILE = '1'; else delete env.E2E_NO_PROFILE;
const log = path.join(OUT, `dyn-${run}.log`), fd = fs.openSync(log, 'w'), start = new Date().toISOString();
const child = cp.spawnSync(process.execPath, ['scripts/e2e/run-comprehensive-ui.cjs', '--suite=' + suite], { cwd: snap, env, windowsHide: true, stdio: ['ignore', fd, fd], timeout: 60 * 60 * 1000 });
fs.closeSync(fd);
const after = verify(), lines = fs.readFileSync(log, 'utf8').split(/\r?\n/);
const scenarios = lines.filter((l) => /^(PASS|FAIL)\s+\S+/.test(l)).map((l) => ({ result: l.slice(0, 4), id: l.slice(6).split(/\s+/)[0] }));
const summary = { run, suite, mode, label, database: env.E2E_DB_NAME, port: env.E2E_DB_PORT, schema: 'fresh bootstrap (init.js + every migrate-* script)', start, finished: new Date().toISOString(), exit: child.status, scenarios,
  failedChecks: lines.filter((l) => /^\s+x /.test(l)).map((l) => l.trim().slice(0, 300)), flags: JSON.parse(env.E2E_EXTRA_ENV), snapshotSourceHash: after.snapshotSourceHash, workingTreeSourceHashBefore: before.currentSourceHash, workingTreeSourceHashAfter: after.currentSourceHash, log: path.relative(ROOT, log) };
fs.writeFileSync(path.join(OUT, `dyn-${run}.json`), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ run, exit: child.status, pass: scenarios.filter((s) => s.result === 'PASS').length, fail: scenarios.filter((s) => s.result === 'FAIL').length, ids: scenarios.map((s) => s.id + ':' + s.result).join(' '), failedChecks: summary.failedChecks.length }));
process.exitCode = child.status || 0;
