'use strict';
// LOCAL E2E (staging-like topology): real Edge/Chromium, the real React build, the real Express server as NODE_ENV=staging behind a throwaway TLS proxy, an isolated
// scratch MySQL database with SYNTHETIC data, and a SCRIPTED provider (no byte leaves this machine). This is NOT a staging E2E and NOT a Claude test.
//   node scripts/e2e/run-e2e.cjs                 builds, starts the stack, runs every scenario, writes docs/vpaa-conformance/e2e/results.json
//   E2E_STACK_FILE=path/stack.json node ...      reuse an already running stack (development of the scenarios only)
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'docs/vpaa-conformance/e2e');
const L = require('./lib.cjs');
const { seed } = require('./seed-e2e.cjs');
const { startStack, DB_NAME } = require('./stack.cjs');
const harness = require(path.join(ROOT, 'server/lib/syllabuscheck/vpaa-conformance/harness'));
const { LEVELS } = require('./seed-e2e.cjs');

const RELATIONSHIPS = ['Content-course', 'Content-ILO', 'ILO-CLO', 'Content-activity', 'ILO-activity', 'Content-assessment', 'Activity-assessment'];
const AREAS = ['Format Compliance', 'Content Completeness', 'CO–PO Alignment', 'Assessment Alignment', 'Contact Hours', 'Reference Currency'];
const DESCRIPTION = Array.from({ length: 60 }, (_, i) => 'word' + i).join(' '); // synthetic course description

const results = [];
let current = null;
const check = (ok, message) => { current.checks.push({ ok: !!ok, message }); if (!ok) current.failed = true; return !!ok; };
const note = (message) => current.notes.push(message);
// a defect the run found in the application itself: recorded, counted separately and reported, but it does not make the scenario fail (the cause is not the test)
const known = (id, message) => { current.checks.push({ ok: false, known: id, message }); };
const evidence = (name) => { const file = path.join(OUT, name); current.evidence.push('docs/vpaa-conformance/e2e/' + name); return file; };

async function scenario(id, title, fn) {
  if (process.env.E2E_ONLY && !process.env.E2E_ONLY.split(',').includes(id)) return; // development aid: run only the named scenarios (they share state, so some need their predecessors)
  current = { id, title, status: 'PASS', checks: [], notes: [], evidence: [], failed: false };
  const started = Date.now();
  try { await fn(); } catch (error) { current.failed = true; current.checks.push({ ok: false, message: 'scenario aborted: ' + String(error.message).split('\n').slice(0, 3).join(' ').slice(0, 400) }); }
  current.status = current.failed ? 'FAIL' : 'PASS';
  current.ms = Date.now() - started;
  results.push(current);
  console.log(`${current.status}  ${id}  ${title}  (${current.ms} ms)`);
  for (const c of current.checks) if (!c.ok) console.log((c.known ? '      ⚠ KNOWN DEFECT ' + c.known + ': ' : '      ✖ ') + c.message);
  current = null;
}

// real JavaScript problems fail a scenario; "Failed to load resource" lines are the browser reporting HTTP errors the scenario provokes on purpose
function assertClean(s, label, { allowStatus = [] } = {}) {
  check(s.issues.pageErrors.length === 0, `${label}: no uncaught page errors (${s.issues.pageErrors.slice(0, 2).join(' | ') || 'none'})`);
  const scripts = s.issues.console.filter((m) => !/Failed to load resource/.test(m));
  check(scripts.length === 0, `${label}: no JavaScript console errors (${scripts.slice(0, 2).join(' | ') || 'none'})`);
  // the very first GET /auth/me of every page load is the app asking whether a session exists: 401 is its normal answer when nobody is signed in
  const unexpected = s.issues.badResponses.filter((r) => r !== 'GET /api/auth/me 401' && !allowStatus.some((code) => r.endsWith(' ' + code)));
  check(unexpected.length === 0, `${label}: no unexpected API failures (${unexpected.slice(0, 3).join(' | ') || 'none'})`);
  check(s.issues.blocked.length === 0, `${label}: no request left this machine (${[...new Set(s.issues.blocked)].join(',') || 'none blocked'})`);
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  // a fresh scratch database built only from the repository (init.js + every migration): the E2E never depends on a developer's database
  if (!process.env.E2E_SKIP_BOOTSTRAP) {
    const b = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname, 'db-bootstrap-check.cjs')], { env: { ...process.env, E2E_DB_NAME: DB_NAME, E2E_KEEP: '1' }, encoding: 'utf8' });
    if (b.status !== 0) throw new Error('could not build the scratch database: ' + (b.stdout || b.stderr).trim().slice(0, 300));
  }
  const seeded = await seed({ host: 'localhost', user: 'root', password: '', database: DB_NAME });
  let stack, stop = async () => {};
  if (process.env.E2E_STACK_FILE) {
    const st = JSON.parse(fs.readFileSync(process.env.E2E_STACK_FILE, 'utf8'));
    stack = { ...st, setProvider: (m) => fs.writeFileSync(st.control, m), providerEvents: () => fs.readFileSync(st.providerLog, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)) };
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  } else { stack = await startStack(); stop = stack.stop; }
  stack.setProvider('ok');
  const browser = await L.launch();
  const ctx = { stack, browser, seeded, state: {} };

  try { await require('./scenarios.cjs')(ctx, { scenario, check, known, note, evidence, assertClean, L, harness, LEVELS, RELATIONSHIPS, AREAS, DESCRIPTION, OUT, ROOT }); }
  finally { await browser.close(); }

  const providerEvents = stack.providerEvents();
  const summary = {
    label: 'LOCAL E2E (staging-like topology: https frontend, TLS proxy, NODE_ENV=staging server, isolated scratch database, scripted provider). Not a staging E2E; no live Claude request.',
    browser: 'Microsoft Edge (Chromium) via playwright-core', node: process.version, finishedAt: new Date().toISOString(),
    scenarios: { total: results.length, passed: results.filter((r) => r.status === 'PASS').length, failed: results.filter((r) => r.status === 'FAIL').length },
    checks: { total: results.reduce((n, r) => n + r.checks.length, 0), passed: results.reduce((n, r) => n + r.checks.filter((c) => c.ok).length, 0), knownDefects: results.reduce((n, r) => n + r.checks.filter((c) => c.known).length, 0) },
    providerRequests: providerEvents.filter((e) => e.kind === 'provider').length,
    blockedNetwork: providerEvents.filter((e) => /^blocked/.test(e.kind)).length,
  };
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ summary, results }, null, 2) + '\n');
  await stop();
  require('./report.cjs');
  console.log(JSON.stringify(summary));
  process.exitCode = summary.scenarios.failed ? 1 : 0;
}

main().catch((error) => { console.error('E2E run failed:', error.message); process.exit(2); });
