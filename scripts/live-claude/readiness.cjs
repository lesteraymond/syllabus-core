#!/usr/bin/env node
'use strict';
// READ-ONLY staging-readiness audit for the controlled real-Claude test. It sends NO model request, changes nothing, and never prints a secret (only names, status words and
// non-secret identifiers). The one outside contact is an optional read-only query of the configured database's own settings (@@max_allowed_packet and the like).
//   node scripts/live-claude/readiness.cjs [--env-file path/.env] [--scope comprehensive|v2only] [--skip-db]
// It combines the two existing audits (credential-readiness.cjs, vpaa-v2-preflight.cjs, run as they are) with what they do not look at: the RESOLVED comprehensive profile, the
// in-app cost cap against the measured reservation, the database packet limit and isolation, the spend register, and the fixtures and plan. Exit 0 only when nothing blocks.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '../..');
const dotenv = require(path.join(ROOT, 'server/node_modules/dotenv'));
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const envFile = path.resolve(flag('env-file', path.join(ROOT, 'server/.env')));
const scope = flag('scope', 'comprehensive');
if (!fs.existsSync(envFile)) { console.error('env file not found'); process.exit(2); }
const fileEnv = dotenv.parse(fs.readFileSync(envFile, 'utf8'));

const results = [];
const add = (area, status, text) => results.push({ area, status, text });
const MIN_PACKET = 16 * 1024 * 1024;

(async () => {
  const gemini = require(path.join(ROOT, 'server/lib/syllabuscheck/gemini'));
  const profile = require(path.join(ROOT, 'server/lib/syllabuscheck/checkingProfile'));
  const v2 = require(path.join(ROOT, 'server/lib/syllabuscheck/academicV2Activation'));
  const anthropic = require(path.join(ROOT, 'server/lib/syllabuscheck/anthropicClient'));

  // 1. provider, model, key
  const cfg = gemini.providerConfig(fileEnv);
  add('provider', cfg.provider === 'anthropic' ? 'PASS' : 'FAIL', `SYLLABUS_CHECK_AI_PROVIDER resolves to "${cfg.provider}" (must be anthropic)`);
  add('provider', cfg.model === 'claude-sonnet-5-5' ? 'PASS' : 'FAIL', `model resolves to "${cfg.model}" (this test is for claude-sonnet-5-5)`);
  add('provider', anthropic.PRICES['claude-sonnet-5-5'] ? 'PASS' : 'FAIL', `pinned prices for the model: $${(anthropic.PRICES['claude-sonnet-5-5'] || []).slice(0, 2).join(' in / $')} out per million, as of ${anthropic.PRICES_AS_OF}`);
  add('provider', cfg.approved ? 'PASS' : 'FAIL', 'SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL equals the model (the approval lock)');
  add('provider', cfg.configured ? 'PASS' : 'FAIL', 'the provider is configured (a key of the right form is present; its value is never shown)');
  add('provider', /^sk-ant-/.test(fileEnv.ANTHROPIC_API_KEY || '') ? 'INFO' : 'FAIL', 'ANTHROPIC_API_KEY form is "sk-ant-..." (checked, not shown). Whether it is a SEPARATE staging key with its own spend limit cannot be seen from here: see the person\'s statement required by live.cjs (--provider-limit-usd)');

  // 2. the comprehensive profile, resolved
  const withProfile = { ...fileEnv, [profile.FLAG]: profile.NAME };
  const resolved = profile.resolve(withProfile);
  add('profile', fileEnv[profile.FLAG] === profile.NAME ? 'PASS' : 'ACTION', `SYLLABUS_CHECK_PROFILE is ${fileEnv[profile.FLAG] ? '"' + fileEnv[profile.FLAG] + '"' : 'unset'} in this file; it must be "${profile.NAME}" for the comprehensive scope (the rows below show what it resolves to)`);
  add('profile', v2.enabled(resolved) ? 'PASS' : 'FAIL', `with the profile, Policy V2 resolves to ${String(resolved.SYLLABUS_CHECK_ACADEMIC_V2)}`);
  add('profile', profile.STAGES.every((s) => resolved[`SYLLABUS_CHECK_STAGE_${s}`] === 'on') ? 'PASS' : 'FAIL', `with the profile, stages ${profile.STAGES.join(', ')} resolve to on (distinct stages only; Policy V2 owns the overlapping advisory questions)`);
  add('profile', !/crossref/i.test(String(resolved.SYLLABUS_CHECK_REF_VERIFY || '')) ? 'PASS' : 'FAIL', 'external reference lookups (Crossref) are off: the profile never enables them');
  add('profile', (resolved.SYLLABUS_CHECK_AI_GATE || 'advisory') === 'advisory' ? 'PASS' : 'FAIL', `AI gate is "${resolved.SYLLABUS_CHECK_AI_GATE || 'advisory'}" (advisory: the AI never blocks, approves or scores)`);
  add('profile', 'INFO', 'official scoring (six areas, 79 pass line), the submission and approval gates and the seven VPAA / four CLO definitions are not configuration: nothing in the environment can change them');

  // 3. budgets: the in-app per-check cap is a RESERVATION ceiling and must cover the measured reservation
  let est = null; try { est = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/checker-comprehensive/live/estimates.json'), 'utf8')); } catch { /* reported below */ }
  const needCap = est ? Math.max(...(scope === 'v2only' ? est.v2only : est.cases).map((c) => c.inAppReservation.recommendedPerCheckCapUsd)) : null;
  const cap = Number.parseFloat(fileEnv.SYLLABUS_CHECK_AI_MAX_COST_USD), maxReq = Number.parseInt(fileEnv.SYLLABUS_CHECK_AI_MAX_REQUESTS, 10);
  add('budget', est ? 'PASS' : 'FAIL', est ? 'offline plan present (node scripts/live-claude/plan.cjs): exact request counts and calibrated estimates' : 'run node scripts/live-claude/plan.cjs first');
  add('budget', Number.isFinite(cap) ? (needCap && cap >= needCap ? 'PASS' : 'ACTION') : 'ACTION', `SYLLABUS_CHECK_AI_MAX_COST_USD is ${Number.isFinite(cap) ? '$' + cap : 'unset'}; the ${scope} scope reserves about $${est ? (scope === 'v2only' ? est.v2only[0] : est.cases[0]).inAppReservation.reservedUsd : '?'} per check, so it needs at least $${needCap ?? '?'} (a RESERVATION ceiling, not dollars spent; below that, optional checks are deferred and required ones can be NOT_CHECKED). The REAL dollars are bounded by the evaluation guard, the spend register and the provider-side limit`);
  add('budget', Number.isFinite(maxReq) ? (maxReq >= (scope === 'v2only' ? 40 : 80) && maxReq <= 200 ? 'PASS' : 'ACTION') : 'ACTION', `SYLLABUS_CHECK_AI_MAX_REQUESTS is ${Number.isFinite(maxReq) ? maxReq : 'unset (default 512)'}; the ${scope} scope needs about ${scope === 'v2only' ? 40 : 80} and at most 200 is sensible`);
  const regFile = path.join(ROOT, 'docs/ai-eval-anthropic/spend-register.json');
  if (fs.existsSync(regFile)) { const r = JSON.parse(fs.readFileSync(regFile, 'utf8')); const left = r.cap - r.total; add('budget', left > 0 ? 'INFO' : 'FAIL', `spend register: $${r.total.toFixed(2)} of $${r.cap} used by earlier authorized work; $${left.toFixed(2)} remaining`); }
  add('budget', 'INFO', 'provider-side hard spending limit: cannot be read from here. It is the person\'s statement (live.cjs --provider-limit-usd) and must be set in the Anthropic console BEFORE any paid request');

  // 4. database: packet limit, isolation, least privilege (a read-only query of the server's own settings)
  if (args.includes('--skip-db')) add('database', 'INFO', 'database probe skipped (--skip-db)');
  else {
    const dbName = fileEnv.DB_NAME || '', dbUser = fileEnv.DB_USER || '';
    add('database', /^(syllabus_cms_plus)$/i.test(dbName) ? 'ACTION' : dbName ? 'PASS' : 'FAIL', `DB_NAME is "${dbName}" ${/^syllabus_cms_plus$/i.test(dbName) ? '(the DEVELOPMENT database: staging needs its own dedicated database)' : '(not the known development database)'}`);
    add('database', dbUser && dbUser.toLowerCase() !== 'root' ? 'PASS' : 'ACTION', `DB_USER is ${dbUser.toLowerCase() === 'root' ? 'the administrative account root' : dbUser ? 'a named account' : 'unset'}; staging needs a least-privilege user`);
    add('database', fileEnv.DB_PASS ? 'PASS' : 'ACTION', fileEnv.DB_PASS ? 'DB_PASS is set (value not shown)' : 'DB_PASS is empty: never acceptable outside local development');
    try {
      const mysql = require(path.join(ROOT, 'server/node_modules/mysql2/promise'));
      const c = await mysql.createConnection({ host: fileEnv.DB_HOST, user: dbUser, password: fileEnv.DB_PASS || '', database: dbName, connectTimeout: 5000 });
      const [[v]] = await c.query('SELECT @@version AS version, @@global.max_allowed_packet AS globalPacket, @@session.max_allowed_packet AS sessionPacket, @@port AS port');
      const [[col]] = await c.query("SELECT COLUMN_TYPE AS type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'syllabus_check_reports' AND COLUMN_NAME = 'report_json'").catch(() => [[null]]);
      await c.end();
      const ok = Number(v.globalPacket) >= MIN_PACKET && Number(v.sessionPacket) >= MIN_PACKET;
      add('database', ok ? 'PASS' : 'FAIL', `max_allowed_packet: global ${v.globalPacket}, this connection ${v.sessionPacket} bytes (need >= ${MIN_PACKET}); server ${v.version}, port ${v.port}. ${ok ? '' : 'A checking report of about 1 MB is rejected by this server: see docs/deployment/DATABASE-REQUIREMENTS.md'}`);
      add('database', col && /longtext/i.test(col.type) ? 'PASS' : col ? 'FAIL' : 'INFO', col ? `syllabus_check_reports.report_json is ${col.type}` : 'syllabus_check_reports not present in this database (not migrated, or not the application database)');
    } catch (e) { add('database', 'FAIL', 'the configured database could not be queried (' + String(e.code || e.message).slice(0, 60) + ')'); }
  }

  // 5. the two existing audits, as they are (they print names and statuses only)
  const run = (script) => spawnSync(process.execPath, [path.join(ROOT, 'scripts', script), '--env-file', envFile], { encoding: 'utf8', cwd: ROOT, timeout: 60000 });
  const cred = run('credential-readiness.cjs'), pre = run('vpaa-v2-preflight.cjs');
  for (const line of (cred.stdout || '').split(/\r?\n/).filter((l) => /^\[(ACTION)\]/.test(l))) add('credentials', 'ACTION', line.replace(/^\[ACTION\]\s*/, '').replace(/\s{2,}/g, ' ').slice(0, 150));
  if (!/\[ACTION\]/.test(cred.stdout || '')) add('credentials', 'PASS', 'no credential needs a manual action');
  for (const line of (pre.stdout || '').split(/\r?\n/).filter((l) => /^\[(FAIL|warn)\]/.test(l))) add('host and auth', line.startsWith('[FAIL]') ? 'FAIL' : 'ACTION', line.replace(/^\[(FAIL|warn)\]\s*/, '').slice(0, 170));
  if (!/\[FAIL\]/.test(pre.stdout || '')) add('host and auth', 'PASS', 'NODE_ENV, CORS origins, trusted proxy, cookie settings and the session secret satisfy the staging host rules');

  // 6. fixtures
  const dir = path.join(ROOT, 'docs/checker-comprehensive/live/fixtures');
  const wanted = require(path.join(ROOT, 'scripts/live-claude/fixtures.cjs')).CASES;
  const have = wanted.filter((w) => fs.existsSync(path.join(dir, `case-${w}.json`)));
  add('fixtures', have.length === wanted.length ? 'PASS' : 'FAIL', `synthetic fixtures present: cases ${have.join(', ').toUpperCase() || 'none'} (A-D fictional course; E approved BSIT IT 202 identity with invented content; no faculty or student data)`);

  // report
  const order = { FAIL: 0, ACTION: 1, INFO: 2, PASS: 3 };
  console.log(`Real-Claude staging readiness for: ${path.relative(ROOT, envFile)} (names and statuses only; nothing was sent or changed)\nscope: ${scope}\n`);
  let area = '';
  for (const r of results) { if (r.area !== area) { area = r.area; console.log('[' + area.toUpperCase() + ']'); } console.log(`  ${r.status.padEnd(6)} ${r.text}`); }
  const blocking = results.filter((r) => r.status === 'FAIL' || r.status === 'ACTION');
  console.log(`\n${blocking.length === 0 ? 'READY: nothing blocks a controlled real-Claude test.' : `NOT READY: ${results.filter((r) => r.status === 'FAIL').length} failing, ${results.filter((r) => r.status === 'ACTION').length} needing a manual action.`}`);
  process.exit(blocking.length === 0 ? 0 : 1);
})().catch((e) => { console.error('readiness audit failed: ' + String(e.message).slice(0, 200)); process.exit(2); });
