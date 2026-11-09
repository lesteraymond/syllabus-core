'use strict';
// The controlled real-Claude test tooling (scripts/live-claude): fixtures, plan, evidence generator and the guarded runner. Everything here runs OFFLINE against a scripted
// provider. These tests are what guarantee that no paid request can start without the exact authorization, and that the synthetic fixtures stay synthetic and deterministic.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../../..');
const F = require(path.join(ROOT, 'scripts/live-claude/fixtures.cjs'));
const evidence = require(path.join(ROOT, 'scripts/live-claude/evidence.cjs'));
const RUNNER = path.join(ROOT, 'scripts/live-claude/live.cjs');
const PRELOAD = path.join(ROOT, 'scripts/e2e/offline-provider.cjs');
const run = (args, extraEnv = {}) => spawnSync(process.execPath, ['-r', PRELOAD, RUNNER, ...args], { cwd: ROOT, encoding: 'utf8', env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, E2E_PROVIDER_LOG: path.join(os.tmpdir(), `live-claude-test-${process.pid}.jsonl`), ...extraEnv }, timeout: 240000 });
const providerEvents = () => { try { return fs.readFileSync(path.join(os.tmpdir(), `live-claude-test-${process.pid}.jsonl`), 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
const diffPaths = (a, b, prefix = '') => {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (a && b && typeof a === 'object' && typeof b === 'object') return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) => diffPaths(a[k], b[k], prefix + (Array.isArray(a) ? `[${k}]` : prefix ? '.' + k : k)));
  return [prefix];
};

test('fixtures: the committed files are exactly what the builder produces, every case says it is synthetic, and none carries a person, an address or a link', () => {
  for (const which of F.CASES) {
    const committed = F.load(which), built = F.build(which);
    assert.deepEqual(committed, built, `case ${which} is stale: run node scripts/live-claude/fixtures.cjs`);
    assert.equal(committed.meta.synthetic, true);
    assert.equal(committed.meta.provisionalExpectations, true);
    const text = JSON.stringify(committed);
    assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(text), 'no e-mail address');
    assert.ok(!text.toLowerCase().includes('http'), 'no link of any kind');
    assert.ok(!/(student number|faculty id|ID no)/i.test(text));
  }
});

test('fixtures: B, C and D differ from the aligned Case A only where they are meant to, so a difference in what the model says is attributable', () => {
  const a = F.load('a').content;
  const changed = (which) => diffPaths(a, F.load(which).content);
  assert.deepEqual(changed('b').map((p) => p.replace(/\[\d+\]/g, '[]')).sort(), ['plan[].activities', 'plan[].contents', 'plan[].ilos[].text', 'plan[].tasks', 'plan[].tasks'].sort(), 'Case B changes weekly content, an ILO, an activity and two assessment tasks, nothing else');
  assert.ok(changed('c').every((p) => /^clos\[\d\]\.statement$/.test(p)) && changed('c').length === 4, 'Case C changes only the four CLO statements');
  assert.ok(changed('d').every((p) => /^(plan\[\d+\]\.(contents|activities|tasks|ilos\[0\]\.text)|clos\[1\]\.statement)$/.test(p)), 'Case D changes only the vague weeks and one CLO');
  for (const which of F.CASES) {
    const levels = F.load(which).content.clos.map((c) => c.level);
    assert.deepEqual(levels, ['Introductory', 'Enabling', 'Demonstrating', 'Integration of Values'], 'the four required classifications are present in the stored labels of every case');
  }
});

test('every case passes the deterministic gates (nothing blocks), so the model really is asked; the official score and the 79 pass line are computed as always', () => {
  const r = run(['smoke', '--plan']);
  assert.equal(r.status, 0, r.stderr);
  // the estimates were produced by running every case through the real service offline
  const est = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/checker-comprehensive/live/estimates.json'), 'utf8'));
  assert.equal(est.cases.length, 4); assert.equal(est.v2only.length, 4);
  for (const c of [...est.cases, ...est.v2only]) {
    assert.equal(c.offlineOfficial.deterministicBlockingFindings, 0, `case ${c.case} (${c.mode}) has a blocking deterministic finding`);
    assert.equal(c.offlineOfficial.passThreshold, 79);
    assert.equal(c.offlineOfficial.v2, 'completed');
    assert.deepEqual(Object.keys(c.vpaaInstances), ['VPAA-01', 'VPAA-02', 'VPAA-03', 'VPAA-04', 'VPAA-05', 'VPAA-06', 'VPAA-07']);
    assert.ok(Object.values(c.vpaaInstances).every((n) => n === 15));
    assert.equal(c.cloClassificationPairs, 4);
    assert.ok(c.estimate.low.dollars < c.estimate.expected.dollars && c.estimate.expected.dollars < c.estimate.high.dollars);
    assert.ok(c.inAppReservation.recommendedPerCheckCapUsd >= c.inAppReservation.reservedUsd, 'the recommended in-app cap covers the reservation');
  }
  assert.ok(est.cases[0].requests > est.v2only[0].requests, 'the comprehensive profile sends more requests than V2 only');
});

test('--plan prints the exact authorization phrase for the run and sends NOTHING (the offline guard records zero provider requests and zero blocked connections)', () => {
  for (const args of [['smoke', '--plan'], ['full', '--case', 'a', '--scope', 'comprehensive', '--plan'], ['full', '--case', 'c', '--scope', 'v2only', '--plan']]) {
    const r = run(args);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /model\s+claude-sonnet-5-5/);
    assert.match(r.stdout, /I AUTHORIZE LIVE CLAUDE TEST \S+ model=claude-sonnet-5-5 max-requests=\d+ max-real-spend-usd=\d+\.\d\d/);
    assert.match(r.stdout, /HARD LIMITS/);
    assert.match(r.stdout, /provider-side limit/);
  }
  const events = providerEvents();
  assert.equal(events.filter((e) => e.kind === 'provider').length, 0, 'no provider request was made by any --plan');
  assert.equal(events.filter((e) => /^blocked/.test(e.kind)).length, 0, 'no connection was even attempted');
});

test('--live refuses to start, with nothing sent and no evidence directory created, unless EVERY precondition holds', () => {
  const phrase = 'I AUTHORIZE LIVE CLAUDE TEST smoke-case-e model=claude-sonnet-5-5 max-requests=1 max-real-spend-usd=0.30';
  const dir = path.join(ROOT, 'docs/checker-comprehensive/live/runs/smoke-case-e');
  const before = fs.existsSync(dir);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'live-claude-env-'));
  const write = (name, text) => { const f = path.join(tmp, name); fs.writeFileSync(f, text); return f; };
  const standIn = write('standin.env', 'ANTHROPIC_API_KEY=sk-ant-local-e2e-stand-in-not-a-real-key-0123456789\n');
  const noKey = write('nokey.env', 'SOMETHING=else\n');
  const wrongModel = write('wrongmodel.env', 'ANTHROPIC_API_KEY=sk-ant-api03-' + 'x'.repeat(40) + '\nANTHROPIC_MODEL=claude-opus-5-5\n');
  const refused = (args, pattern, label) => { const r = run(['smoke', '--live', ...args]); assert.notEqual(r.status, 0, label + ' must not start'); assert.match(r.stderr, pattern, label); assert.ok(!/ECONNRESET|api\.anthropic\.com/.test(r.stdout + r.stderr) || /Nothing was sent/.test(r.stderr), label); };
  refused([], /needs --confirm-paid/, 'no --confirm-paid');
  refused(['--confirm-paid'], /authorization/, 'no authorization');
  refused(['--confirm-paid', '--authorization', phrase.replace('0.30', '30.00')], /not exactly the phrase/, 'a different dollar cap than the plan printed');
  refused(['--confirm-paid', '--authorization', phrase.replace('smoke-case-e', 'full-case-a-comprehensive')], /not exactly the phrase/, 'the phrase of another run');
  refused(['--confirm-paid', '--authorization', phrase], /provider-limit-usd is required/, 'no provider-side limit stated');
  refused(['--confirm-paid', '--authorization', phrase, '--provider-limit-usd', '5'], /env-file/, 'no env file');
  refused(['--confirm-paid', '--authorization', phrase, '--provider-limit-usd', '5', '--env-file', noKey], /missing, a stand-in/, 'no key in the env file');
  refused(['--confirm-paid', '--authorization', phrase, '--provider-limit-usd', '5', '--env-file', standIn], /missing, a stand-in/, 'a stand-in key');
  refused(['--confirm-paid', '--authorization', phrase, '--provider-limit-usd', '5', '--env-file', wrongModel], /claude-sonnet-5-5 only/, 'another model');
  assert.equal(fs.existsSync(dir), before, 'a refused run created no evidence directory');
  assert.equal(providerEvents().filter((e) => e.kind === 'provider').length, 0);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('the smoke dry-run exercises the real client, schema validation and guard against the scripted provider: nine checks pass (usage, completion and spend included), the cap refusal is local, the key is nowhere in the output', () => {
  const r = run(['smoke', '--dry-run']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  for (let n = 1; n <= 9; n += 1) assert.match(r.stdout, new RegExp(`PASS  ${n} `));
  assert.ok(!/FAIL/.test(r.stdout));
  assert.ok(!/sk-ant-[A-Za-z0-9_-]{20,}/.test(r.stdout + r.stderr), 'no key-shaped text in the output');
  const where = /evidence: (.+)/.exec(r.stdout)[1].trim();
  const result = JSON.parse(fs.readFileSync(path.join(where, 'result.json'), 'utf8'));
  assert.equal(result.relationships.length, 8, 'week 1\'s seven VPAA relationships and the classification of CLO 1');
  assert.deepEqual([...new Set(result.relationships.map((x) => x.type))].sort(), ['Activity-assessment', 'CLO-classification', 'Content-activity', 'Content-ILO', 'Content-assessment', 'Content-course', 'ILO-CLO', 'ILO-activity'].sort());
  assert.equal(result.refusal.refused, true);
  // the evidence that a real run must produce, with a scripted run labelled as what it is
  assert.match(result.usage.source, /SCRIPTED/); assert.equal(result.usage.modelRequested, 'claude-sonnet-5-5'); assert.equal(result.usage.truncated, false);
  for (const key of ['inputTokens', 'outputTokens', 'cacheCreationInputTokens', 'cacheReadInputTokens']) assert.ok(Number.isFinite(result.usage[key]), key);
  assert.ok(result.usage.cost.chargedByGuardAgainstCapsUsd <= result.usage.cost.hardCapUsd && result.usage.cost.hardCapUsd === 0.3);
  assert.deepEqual(result.usage.optimizationFlagsInEffect, { SYLLABUS_CHECK_CACHE_WARMUP: 'on', SYLLABUS_CHECK_OUTPUT_PLAN: 'on', SYLLABUS_CHECK_OUTPUT_FIELDS: 'scoped' });
  const ledger = JSON.parse(fs.readFileSync(path.join(where, 'provider-ledger.json'), 'utf8'));
  assert.equal(ledger.requests, 1, 'exactly one request, and the refused second one was not counted as sent');
  assert.ok(!JSON.stringify(ledger).includes('x-api-key'));
  fs.rmSync(where, { recursive: true, force: true });
  assert.equal(providerEvents().filter((e) => /^blocked/.test(e.kind)).length, 0);
});

test('the full dry-run covers the seven VPAA relationships (15 instances each) and the four CLO classifications and renders the evidence document', () => {
  const r = run(['full', '--case', 'c', '--scope', 'comprehensive', '--dry-run']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const where = /evidence: (.+)/.exec(r.stdout)[1].trim();
  const result = JSON.parse(fs.readFileSync(path.join(where, 'result.json'), 'utf8'));
  assert.equal(result.official.passThreshold, 79);
  assert.deepEqual(result.vpaa.map((v) => v.instances), [15, 15, 15, 15, 15, 15, 15]);
  assert.equal(result.cloClassification.length, 4);
  assert.equal(result.inventedQuotations, 0);
  assert.equal(result.budget.requiredIncomplete, false);
  const md = fs.readFileSync(path.join(where, 'EVIDENCE.md'), 'utf8');
  for (const heading of ['## Seven VPAA relationships', '## Four CLO classifications', '## Provisional expectations', '## Did the model invent anything?', '## What this does NOT establish']) assert.ok(md.includes(heading), heading);
  assert.match(md, /It does not say any judgment is academically right/);
  assert.match(md, /11 of 11 Not checked/);
  fs.rmSync(where, { recursive: true, force: true });
});

test('evidence: a quotation that is not in the text the model was given is reported as NOT FOUND, never accepted', () => {
  assert.equal(evidence.quoteCheck('Explain how  Encapsulation protects data', 'We explain how encapsulation protects data of an object').status, 'verbatim', 'whitespace and case are ignored');
  assert.equal(evidence.quoteCheck('Polymorphism is taught with the Zebra class', 'Apply polymorphism to a Shape hierarchy', 'whole syllabus text').status, 'NOT FOUND');
  assert.equal(evidence.quoteCheck('', 'anything').status, 'none');
  const fixture = F.load('a');
  const record = (quote) => ({ id: 'row0-content', relationshipType: 'Content-course', relationshipId: 'VPAA-01', week: '1', path: 'plan[0].contents', sourceText: 'Course: IT 204', targetText: 'Course orientation', academicJudgment: 'ALIGNED', status: 'SUPPORTED_BY_SUPPLIED_EVIDENCE', verification: 'quotes_verified', evidence: { sourceQuote: 'Course: IT 204', targetQuote: quote }, explanation: 'x' });
  const clean = evidence.analyse({ fixture, result: { hybrid: { academicV2: { academic: { relationships: [record('Course orientation')] } } } } });
  const made = evidence.analyse({ fixture, result: { hybrid: { academicV2: { academic: { relationships: [record('The instructor shall grade on a curve of fifty percent')] } } } } });
  assert.equal(clean.invented.length, 0);
  assert.equal(made.invented.length, 1, 'an invented quotation is surfaced');
});

test('Phase 7, offline: a full dry-run produces the stored run the browser receives, and the real faculty AI Checker component renders it in English and Filipino with every check passing', () => {
  const full = run(['full', '--case', 'b', '--scope', 'v2only', '--dry-run']);
  assert.equal(full.status, 0, full.stdout + full.stderr);
  const where = /evidence: (.+)/.exec(full.stdout)[1].trim();
  assert.ok(fs.existsSync(path.join(where, 'stored-run.json')));
  const ui = spawnSync(process.execPath, [path.join(ROOT, 'scripts/live-claude/render-ui.mjs'), path.join(where, 'stored-run.json')], { cwd: ROOT, encoding: 'utf8', timeout: 240000 });
  assert.equal(ui.status, 0, ui.stdout + ui.stderr);
  assert.equal((ui.stdout.match(/^PASS /gm) || []).length, 7);
  assert.ok(!/^FAIL/m.test(ui.stdout));
  assert.ok(fs.existsSync(path.join(where, 'faculty-ui.en.html')) && fs.existsSync(path.join(where, 'faculty-ui.tl.html')));
  fs.rmSync(where, { recursive: true, force: true });
});
