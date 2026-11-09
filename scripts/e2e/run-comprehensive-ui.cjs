'use strict';
// LOCAL browser verification of the comprehensive AI Checker profile (SYLLABUS_CHECK_PROFILE=comprehensive-testing).
// Same harness as scripts/e2e/run-e2e.cjs (real Edge, the real production build, the real server as NODE_ENV=staging behind a throwaway TLS proxy, an isolated
// scratch MySQL database with SYNTHETIC data, a SCRIPTED provider that never leaves this machine), but:
//   * the ONLY checking flag set is SYLLABUS_CHECK_PROFILE=comprehensive-testing (Policy V2 is explicitly OFF so the profile must switch it on itself);
//   * the per-check cost reservation cap is raised to E2E_COST_CAP_USD (default 100): the scripted double costs nothing, but the guard reserves at Claude rates;
//   * evidence goes to docs/checker-comprehensive/ui-verification/ and nothing under docs/vpaa-conformance/e2e is touched.
//   node scripts/e2e/run-comprehensive-ui.cjs                    the comprehensive-profile scenarios (K01..)
//   node scripts/e2e/run-comprehensive-ui.cjs --suite=regression the existing E01..E18 scenarios, unchanged, run with the profile on
//   E2E_STACK_FILE=path/stack.json                                reuse an already running stack (scenario development only)
const fs = require('node:fs');
const path = require('node:path');
if (process.env.E2E_DB_PORT) require('./db-port-redirect.cjs'); // test-only: run against an isolated database server (E2E_DB_PORT), never the shared one
const ROOT = path.resolve(__dirname, '../..');
const suiteArg = (process.argv.find((a) => a.startsWith('--suite=')) || '--suite=comprehensive').split('=')[1];
// E2E_NO_PROFILE=1 runs the same suite on the baseline configuration of scripts/e2e/stack.cjs (Policy V2 on, no profile): the control for attributing a failure to the profile
const NO_PROFILE = !!process.env.E2E_NO_PROFILE;
const OUT = path.join(ROOT, 'docs/checker-comprehensive/ui-verification', suiteArg + (NO_PROFILE ? '-baseline-no-profile' : '') + (process.env.E2E_OUT_SUFFIX ? '-' + process.env.E2E_OUT_SUFFIX : ''));
const L = require('./lib.cjs');
const { seed, LEVELS } = require('./seed-e2e.cjs');
const { startStack, DB_NAME } = require('./stack.cjs');
const harness = require(path.join(ROOT, 'server/lib/syllabuscheck/vpaa-conformance/harness'));

const RELATIONSHIPS = ['Content-course', 'Content-ILO', 'ILO-CLO', 'Content-activity', 'ILO-activity', 'Content-assessment', 'Activity-assessment'];
const AREAS = ['Format Compliance', 'Content Completeness', 'CO–PO Alignment', 'Assessment Alignment', 'Contact Hours', 'Reference Currency'];
const DESCRIPTION = Array.from({ length: 60 }, (_, i) => 'word' + i).join(' ');
const RESERVED = ['STR-07', 'ADM-04', 'ADM-05', 'CUR-10', 'CLO-05', 'CLO-10', 'PLAN-05', 'PLAN-06', 'ALN-03', 'ALN-04', 'ALN-10'];

const results = [];
let current = null;
const check = (ok, message) => { current.checks.push({ ok: !!ok, message }); if (!ok) current.failed = true; return !!ok; };
const note = (message) => current.notes.push(message);
const known = (id, message) => { current.checks.push({ ok: false, known: id, message }); };
const evidence = (name) => { const file = path.join(OUT, name); current.evidence.push(path.relative(ROOT, file).split(path.sep).join('/')); return file; };

// guards against anything else touching the shared scratch database mid-run
async function dbCounts() {
  try {
    const mysql = require(path.join(ROOT, 'server/node_modules/mysql2/promise'));
    const c = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: DB_NAME });
    const [[r]] = await c.query('SELECT (SELECT COUNT(*) FROM syllabi) syllabi, (SELECT COUNT(*) FROM users) users');
    await c.end();
    return `syllabi=${r.syllabi} users=${r.users}`;
  } catch (e) { return 'unreadable (' + e.code + ')'; }
}
async function scenario(id, title, fn) {
  if (process.env.E2E_ONLY && !process.env.E2E_ONLY.split(',').includes(id)) return;
  current = { id, title, status: 'PASS', checks: [], notes: [], evidence: [], failed: false };
  const started = Date.now();
  current.notes.push('scratch database at scenario start: ' + (await dbCounts()));
  try { await fn(); } catch (error) { current.failed = true; current.checks.push({ ok: false, message: 'scenario aborted: ' + String(error.stack || error.message).split('\n').slice(0, 4).join(' ').slice(0, 500) }); }
  current.status = current.failed ? 'FAIL' : 'PASS';
  current.ms = Date.now() - started;
  results.push(current);
  console.log(`${current.status}  ${id}  ${title}  (${current.ms} ms)`);
  for (const c of current.checks) if (!c.ok) console.log((c.known ? '      ! KNOWN DEFECT ' + c.known + ': ' : '      x ') + c.message);
  current = null;
}

function assertClean(s, label, { allowStatus = [] } = {}) {
  check(s.issues.pageErrors.length === 0, `${label}: no uncaught page errors (${s.issues.pageErrors.slice(0, 2).join(' | ') || 'none'})`);
  const scripts = s.issues.console.filter((m) => !/Failed to load resource/.test(m));
  check(scripts.length === 0, `${label}: no JavaScript console errors (${scripts.slice(0, 2).join(' | ') || 'none'})`);
  const unexpected = s.issues.badResponses.filter((r) => r !== 'GET /api/auth/me 401' && !allowStatus.some((code) => r.endsWith(' ' + code)));
  check(unexpected.length === 0, `${label}: no unexpected API failures (${unexpected.slice(0, 3).join(' | ') || 'none'})`);
  check(s.issues.blocked.length === 0, `${label}: no request left this machine (${[...new Set(s.issues.blocked)].join(',') || 'none blocked'})`);
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  if (process.env.E2E_DB_PORT) {
    // Fail closed: a plain connection to localhost:3306 must land on the isolated server, with the packet limit this run is about. Otherwise nothing is touched.
    const mysql = require(path.join(ROOT, 'server/node_modules/mysql2/promise'));
    const probe = await mysql.createConnection({ host: 'localhost', user: 'root', password: '' });
    const [[v]] = await probe.query('SELECT @@port AS port, @@datadir AS datadir, @@global.max_allowed_packet AS globalPacket, @@session.max_allowed_packet AS sessionPacket');
    await probe.end();
    const minPacket = Number(process.env.E2E_MIN_PACKET || 16 * 1024 * 1024);
    if (Number(v.port) !== Number(process.env.E2E_DB_PORT)) throw new Error('refusing to run: the database connection reached port ' + v.port + ', not the isolated server ' + process.env.E2E_DB_PORT);
    if (Number(v.globalPacket) < minPacket || Number(v.sessionPacket) < minPacket) throw new Error('refusing to run: the isolated server allows only ' + v.sessionPacket + ' bytes per packet (need ' + minPacket + ')');
    console.log('isolated database verified: ' + JSON.stringify(v));
    fs.writeFileSync(path.join(OUT, 'database-isolation.json'), JSON.stringify({ requestedPort: Number(process.env.E2E_DB_PORT), reached: v, requiredMinPacket: minPacket }, null, 2) + '\n');
  }
  if (!process.env.E2E_SKIP_BOOTSTRAP) {
    const b = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname, 'db-bootstrap-check.cjs')], { env: { ...process.env, E2E_DB_NAME: DB_NAME, E2E_KEEP: '1' }, encoding: 'utf8' });
    if (b.status !== 0) throw new Error('could not build the scratch database: ' + (b.stdout || b.stderr).trim().slice(0, 300));
  }
  const seeded = await seed({ host: 'localhost', user: 'root', password: '', database: DB_NAME });
  // E2E_EXTRA_ENV: JSON of extra server settings (the cost-optimization flags), added to the server environment
  const profileEnv = NO_PROFILE ? {} : { ...(process.env.E2E_DB_PORT ? { E2E_DB_PORT: process.env.E2E_DB_PORT } : {}), SYLLABUS_CHECK_PROFILE: 'comprehensive-testing', SYLLABUS_CHECK_ACADEMIC_V2: 'off', SYLLABUS_CHECK_AI_MAX_COST_USD: process.env.E2E_COST_CAP_USD || (suiteArg === 'budget' ? '6' : '100') };
  let stack, stop = async () => {};
  if (process.env.E2E_STACK_FILE) {
    const st = JSON.parse(fs.readFileSync(process.env.E2E_STACK_FILE, 'utf8'));
    stack = { ...st, setProvider: (m) => fs.writeFileSync(st.control, m), providerEvents: () => fs.readFileSync(st.providerLog, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)) };
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  } else { stack = await startStack({ extraEnv: { ...(process.env.E2E_DB_PORT ? { E2E_DB_PORT: process.env.E2E_DB_PORT } : {}), ...profileEnv, ...(process.env.E2E_EXTRA_ENV ? JSON.parse(process.env.E2E_EXTRA_ENV) : {}) } }); stop = stack.stop; }
  stack.setProvider('ok');
  const browser = await L.launch();
  const ctx = { stack, browser, seeded, state: {}, profileEnv };
  try {
    if (suiteArg === 'regression') await require('./scenarios.cjs')(ctx, { scenario, check, known, note, evidence, assertClean, L, harness, LEVELS, RELATIONSHIPS, AREAS, DESCRIPTION, OUT, ROOT });
    else if (suiteArg === 'budget') await require('./scenarios-budget.cjs')(ctx, { scenario, check, known, note, evidence, assertClean, L, harness, LEVELS, RELATIONSHIPS, AREAS, DESCRIPTION, RESERVED, OUT, ROOT });
    else await require('./scenarios-comprehensive.cjs')(ctx, { scenario, check, known, note, evidence, assertClean, L, harness, LEVELS, RELATIONSHIPS, AREAS, DESCRIPTION, RESERVED, OUT, ROOT });
  } finally { await browser.close(); }

  const providerEvents = stack.providerEvents();
  const summary = {
    label: 'LOCAL browser verification, comprehensive-testing profile (staging-like topology, isolated scratch database, SYNTHETIC data, SCRIPTED provider). Not a staging test and not a Claude test: no live model request was made.',
    suite: suiteArg, profile: NO_PROFILE ? 'none (baseline control: Policy V2 on, no profile)' : 'comprehensive-testing', configuration: profileEnv,
    browser: 'Microsoft Edge (Chromium) via playwright-core', node: process.version, finishedAt: new Date().toISOString(),
    scenarios: { total: results.length, passed: results.filter((r) => r.status === 'PASS').length, failed: results.filter((r) => r.status === 'FAIL').length },
    checks: { total: results.reduce((n, r) => n + r.checks.length, 0), passed: results.reduce((n, r) => n + r.checks.filter((c) => c.ok).length, 0), knownDefects: results.reduce((n, r) => n + r.checks.filter((c) => c.known).length, 0) },
    providerRequests: providerEvents.filter((e) => e.kind === 'provider').length,
    blockedNetwork: providerEvents.filter((e) => /^blocked/.test(e.kind)).length,
  };
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ summary, results }, null, 2) + '\n');
  await stop();
  console.log(JSON.stringify(summary));
  process.exitCode = summary.scenarios.failed ? 1 : 0;
}

main().catch((error) => { console.error('run failed:', error.message); process.exit(2); });
