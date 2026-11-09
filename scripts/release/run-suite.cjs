'use strict';
// Release-candidate browser runner: ONE suite per invocation, inside the frozen snapshot, against the pre-provisioned synthetic schemas on the isolated server (port 43310).
// No bootstrap, no migration, DDL blocked by stability-no-ddl.cjs; data-only reset first; the snapshot is hash-verified before and after (a run whose source moved is INVALID).
//   node scripts/release/run-suite.cjs <snapshotLabel> <suite: regression|comprehensive|budget|po> <off|on>
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const ROOT = 'C:/Users/JP Del Rosario/Syllabus-Repository';
const [label, suite, mode] = process.argv.slice(2);
if (!label || !['regression', 'comprehensive', 'budget', 'po'].includes(suite) || !['off', 'on'].includes(mode)) throw Error('usage: rc-run.cjs <label> <suite> <off|on>');
const snap = path.join(ROOT, 'tmp/release-candidate', label), OUT = path.join(ROOT, 'docs/release-candidate');
const run = `${suite}-${mode}`;
const recommended = { SYLLABUS_CHECK_CACHE_WARMUP: 'on', SYLLABUS_CHECK_OUTPUT_PLAN: 'on', SYLLABUS_CHECK_OUTPUT_FIELDS: 'scoped' };
const offAll = Object.fromEntries(['CACHE_WARMUP', 'OUTPUT_PLAN', 'OUTPUT_FIELDS', 'COURSE_CONTEXT', 'V2_GROUPING', 'PROMPT_TRIM'].map((n) => ['SYLLABUS_CHECK_' + n, 'off']));
const po = suite === 'po';
const database = 'syllabus_e2e_po_1105_' + (po ? 'workflow_' + (mode === 'on' ? 'optimized' : 'baseline') : suite);
const verify = () => JSON.parse(cp.spawnSync(process.execPath, [path.join(ROOT, 'scripts/release/snapshot.cjs'), 'verify', label], { encoding: 'utf8' }).stdout || '{}');
const before = verify();
const env = { ...process.env, VITE_NEW_BUILDER: 'true', PATH: 'C:/xampp/apache/bin;' + process.env.PATH, OPENSSL_CONF: 'C:/xampp/apache/conf/openssl.cnf', E2E_DB_PORT: '43310', E2E_SKIP_BOOTSTRAP: '1', E2E_NO_DDL: '1', E2E_DB_NAME: database,
  E2E_FRONT_PORT: '3864', E2E_PROXY_PORT: '3863', E2E_API_PORT: '3421', E2E_OUT_SUFFIX: 'rc-' + run, E2E_TRACE_RUN: run, E2E_EXTRA_ENV: JSON.stringify({ ...offAll, ...(mode === 'on' ? recommended : {}) }) };
if (suite === 'regression') env.E2E_NO_PROFILE = '1'; else delete env.E2E_NO_PROFILE;
if (po) env.PO_E2E_PREPROVISIONED = '1';
const reset = cp.spawnSync(process.execPath, ['scripts/e2e/stability-fixture.cjs', database], { cwd: snap, env, encoding: 'utf8' });
if (reset.status !== 0) { console.error('fixture reset refused: ' + reset.stderr); process.exit(3); }
const log = path.join(OUT, `rc-${run}.log`), fd = fs.openSync(log, 'w'), start = new Date().toISOString();
const args = ['-r', './scripts/e2e/stability-no-ddl.cjs', '-r', './scripts/e2e/stability-trace.cjs', ...(po ? ['scripts/po-controlled-activation/checker-browser.cjs', mode === 'on' ? 'optimized' : 'baseline'] : ['scripts/e2e/run-comprehensive-ui.cjs', '--suite=' + suite])];
const child = cp.spawnSync(process.execPath, args, { cwd: snap, env, windowsHide: true, stdio: ['ignore', fd, fd], timeout: 55 * 60 * 1000 });
fs.closeSync(fd);
const after = verify();
const text = fs.readFileSync(log, 'utf8');
const lines = text.split(/\r?\n/);
const verdicts = lines.filter((l) => /^(PASS|FAIL)\s+\S+/.test(l)).map((l) => l.replace(/\s{2,}.*$/, '').trim() + ' ' + (/\((\d+) ms\)/.exec(l) || [])[1] + 'ms');
const summary = { run, suite, mode, label, database, start, finished: new Date().toISOString(), exit: child.status, scenarios: lines.filter((l) => /^(PASS|FAIL)\s+\S+/.test(l)).map((l) => ({ result: l.slice(0, 4), id: l.slice(6).split(/\s+/)[0] })),
  failedChecks: lines.filter((l) => /^\s+x /.test(l)).map((l) => l.trim().slice(0, 300)), migrationsExecuted: 0, flags: JSON.parse(env.E2E_EXTRA_ENV),
  snapshotSourceHash: after.snapshotSourceHash, sourceHashBefore: before.currentSourceHash, sourceHashAfter: after.currentSourceHash, workingTreeSourceUnchangedDuringRun: before.sourceUnchanged && after.sourceUnchanged, log: path.relative(ROOT, log) };
fs.writeFileSync(path.join(OUT, `rc-${run}.json`), JSON.stringify(summary, null, 2));
const pass = summary.scenarios.filter((s) => s.result === 'PASS').length, fail = summary.scenarios.filter((s) => s.result === 'FAIL').length;
console.log(JSON.stringify({ run, exit: child.status, pass, fail, ids: summary.scenarios.map((s) => s.id + ':' + s.result).join(' '), failedChecks: summary.failedChecks.length, treeMoved: !summary.workingTreeSourceUnchangedDuringRun }));
process.exitCode = child.status || 0;
