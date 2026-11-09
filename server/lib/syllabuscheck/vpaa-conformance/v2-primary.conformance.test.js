'use strict';
// Policy V2 as the PRIMARY seven-relationship semantic path, and advisory-only. Verifies: exactly the seven VPAA relationships with the right fields and
// identifiers; no relationship evaluated or reported twice when several checking stages exist; official scoring and gates identical with V2 on and off;
// honest "incomplete" reporting when V2 is off or the AI is unavailable; the shared budget; persistence; and the exact staging configuration.
// Software conformance only: the model is a scripted test double and nothing here measures Claude's accuracy.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./harness');
const { createMemoryDb } = require('./memdb');
const svc = require('../../compliance/service');
const repo = require('../repository');
const gemini = require('../gemini');
const refine = require('../refine');
const v2Activation = require('../academicV2Activation');
const { semanticCoverageOf } = require('../semanticCoverage');
const { POLICY } = require('../academicV2Plan');

const LINK = async (url) => ({ url, status: 'ok', httpStatus: 200 });
const SEVEN = ['Content-course', 'Content-ILO', 'ILO-CLO', 'Content-activity', 'ILO-activity', 'Content-assessment', 'Activity-assessment']; // VPAA 1..7
const V2_ONLY = ['Content-course', 'Content-ILO', 'Content-activity', 'Content-assessment', 'Activity-assessment']; // not scored by the legacy path
const SCORED = ['ILO-CLO', 'ILO-activity']; // scored in the legacy path (official deductions) and advisory in V2
const ID = { 'Content-course': /^row(\d+)-content$/, 'Content-ILO': /^row(\d+)-ilo\d+-contentilo$/, 'ILO-CLO': /^row(\d+)-ilo\d+-(clo:.+|unassigned-clo)$/, 'Content-activity': /^row(\d+)-contentactivity$/, 'ILO-activity': /^row(\d+)-ilo\d+-activity$/, 'Content-assessment': /^row(\d+)-contentassessment$/, 'Activity-assessment': /^row(\d+)-activityassessment$/ };
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

function world(t, { synthetic = false } = {}) {
  const { content, masters } = h.sample();
  masters.synthetic = synthetic; masters.fingerprint = 'v2-primary-fingerprint';
  t.mock.method(repo, 'mastersFor', async () => masters);
  return { content, masters, db: createMemoryDb({ syllabus: { content: JSON.stringify(content) } }) };
}
async function check(db, content, env, { script, transport } = {}) {
  gemini.resetProviderBlock();
  const tr = transport || h.scriptedTransport(script);
  const result = await svc.checkHybrid(db, structuredClone(content), { syllabusId: 100, env: h.envFor(env), transport: tr, linkChecker: LINK });
  return { result, tr };
}
const askedCount = (tr, type, row) => tr.pairs().filter((p) => p.type === type && ID[type].test(p.id) && p.id.startsWith(`row${row}-`)).length;
const OFF = { SYLLABUS_CHECK_ACADEMIC_V2: 'off' };
const ON = { SYLLABUS_CHECK_ACADEMIC_V2: 'on' };
const STAGES = { SYLLABUS_CHECK_STAGE_B: 'on', SYLLABUS_CHECK_STAGE_C3: 'on' };

test('[VPAA-V2-SEVEN] Policy V2 evaluates exactly the seven VPAA relationships, with the right fields and identifiers, and no CLO ↔ Course Description', async (t) => {
  h.liveGuard(t);
  assert.deepEqual(POLICY.weeklyTypes, SEVEN, 'the policy lists the seven, in VPAA order');
  const fx = h.sample();
  const { result, transport } = await h.evaluateV2(fx.content, fx.masters, {});
  const weekly = result.academic.requirements.filter((r) => String(r.id).startsWith('weekly:'));
  assert.deepEqual([...new Set(weekly.map((r) => r.relationshipType))].sort(), [...SEVEN].sort(), 'the weekly required relationships are exactly the seven');
  assert.ok(!weekly.some((r) => r.relationshipType === 'ILO-assessment'), 'the direct ILO ↔ Assessment diagnostic is not an eighth required relationship');
  assert.ok(!result.academic.relationships.some((r) => /CLO.*Description|Description.*CLO/.test(r.relationshipType)), 'CLO ↔ Course Description is not a relationship');
  const lessons = fx.content.plan.map((row, i) => ({ row, i })).filter(({ row }) => row.kind !== 'exam');
  const sent = transport.pairs();
  const want = (type, row) => ({ 'Content-course': [norm(fx.content.meta.title), norm(row.contents)], 'Content-ILO': [norm(row.contents), norm(row.ilos[0].text)], 'Content-activity': [norm(row.contents), norm(row.activities)], 'ILO-activity': [norm(row.ilos[0].text), norm(row.activities)], 'Content-assessment': [norm(row.contents), norm(row.tasks)], 'Activity-assessment': [norm(row.activities), norm(row.tasks)] }[type]);
  for (const { row, i } of lessons) for (const type of SEVEN) {
    const pairs = sent.filter((p) => p.type === type && p.id.startsWith(`row${i}-`));
    assert.ok(pairs.length >= 1, `week ${row.week}: ${type} was asked`);
    for (const p of pairs) {
      assert.match(p.id, ID[type], `${type}: relationship identifier`);
      if (type === 'ILO-CLO') { const clo = fx.content.clos.find((c) => p.id.endsWith(`-clo:${c.id}`)); assert.equal(norm(p.source), norm(clo.statement)); assert.equal(norm(p.target), norm(row.ilos[0].text)); continue; }
      const [src, tgt] = want(type, row);
      assert.ok(norm(p.source).includes(src), `${type} week ${row.week}: source carries ${src}`);
      assert.equal(norm(p.target), tgt, `${type} week ${row.week}: target is exactly the VPAA target field`);
    }
  }
  assert.equal(new Set(result.academic.relationships.map((r) => r.id)).size, result.academic.relationships.length, 'every relationship identifier is unique in the report');
});

test('[VPAA-V2-PERSISTENCE] a Policy V2 report is saved with the check and read back whole, with its relationships, suggestions and coverage', async (t) => {
  h.liveGuard(t);
  const { content, db } = world(t);
  const { result } = await check(db, content, { ...ON }, { script: (p) => (p.id === 'row0-content' ? { label: 'NOT_ALIGNED' } : undefined) });
  const runId = await svc.storeRun(db, { syllabusId: 100, versionId: null, content, result, createdBy: 26, ai: true });
  const stored = JSON.parse(db.state.reports.get(runId).report_json);
  assert.ok(stored.hybrid.academicV2, 'the V2 evaluation is in the saved report');
  const run = await svc.loadDetail(db, db.state.runs[0], svc.hashOf(content));
  assert.equal(run.hybrid.academicV2.academic.relationships.length, result.hybrid.academicV2.academic.relationships.length, 'every relationship record survives storage');
  assert.deepEqual(run.hybrid.academicV2.academic.relationships.map((r) => r.id), result.hybrid.academicV2.academic.relationships.map((r) => r.id));
  assert.equal(run.hybrid.semanticCoverage.evaluated, 7); assert.equal(run.hybrid.semanticCoverage.complete, true);
  assert.deepEqual(run.hybrid.suggestions.map((s) => s.id), result.hybrid.suggestions.map((s) => s.id), 'suggestions survive storage unchanged');
  assert.equal(run.hybrid.academicV2.academic.provenance.facultyValidated, false);
});

test('[VPAA-V2-NO-DUPLICATES] with several checking stages available, no relationship is evaluated or reported twice (the two scored ones are the one documented exception)', async (t) => {
  h.liveGuard(t);
  const script = (p) => (['row0-ilo0-activity', 'row0-content', 'row0-contentassessment'].includes(p.id) ? { label: 'NOT_ALIGNED' } : undefined);
  for (const [name, env] of Object.entries({ 'V2 on, stages off': { ...ON }, 'V2 on + Stage B + C3': { ...ON, ...STAGES }, 'V2 on + every stage': { ...ON, ...STAGES, SYLLABUS_CHECK_STAGE_A: 'on', SYLLABUS_CHECK_STAGE_B3: 'on', SYLLABUS_CHECK_STAGE_B4: 'on' } })) {
    const { content, db } = world(t);
    const { result, tr } = await check(db, content, env, { script });
    for (const type of V2_ONLY) assert.equal(askedCount(tr, type, 0), 1, `${name}: ${type} is asked once, by Policy V2 only`);
    for (const type of SCORED) assert.equal(askedCount(tr, type, 0), 2, `${name}: ${type} is asked by the scored legacy path and by V2 (advisory), by design`);
    assert.ok(!result.hybrid.stages?.b && !result.hybrid.stages?.c3, `${name}: the legacy stages that duplicate V2 were held off`);
    const byRelationship = new Map();
    for (const s of result.hybrid.suggestions) for (const id of (s.basedOn || [s.id]).map((x) => String(x).replace(/^SEM:/, ''))) byRelationship.set(id, (byRelationship.get(id) || 0) + 1);
    assert.ok([...byRelationship.values()].every((n) => n === 1), `${name}: one recommendation per relationship (${JSON.stringify([...byRelationship])})`);
    const findingIds = result.findings.map((f) => f.id);
    assert.equal(new Set(findingIds).size, findingIds.length, `${name}: no duplicate finding`);
    assert.equal(new Set(result.hybrid.alignment.judgements.map((j) => j.id)).size, result.hybrid.alignment.judgements.length, `${name}: no legacy relationship judged twice`);
    assert.equal(new Set(result.hybrid.academicV2.academic.relationships.map((r) => r.id)).size, result.hybrid.academicV2.academic.relationships.length, `${name}: no V2 relationship recorded twice`);
  }
  // With V2 off the legacy stages still work, each relationship once.
  const { content, db } = world(t);
  const { tr } = await check(db, content, { ...OFF, ...STAGES });
  for (const type of SEVEN) assert.equal(askedCount(tr, type, 0), 1, `V2 off + stages: ${type} once`);
});

test('[VPAA-V2-SCORE-PARITY] official scoring is identical with Policy V2 on and off: score, status, pass, deductions, findings, gates', async (t) => {
  h.liveGuard(t);
  const cases = {
    'every relationship aligned': () => undefined,
    'a scored ILO ↔ CLO failure': (p) => (p.id === 'row0-ilo0-clo:c1' ? { label: 'NOT_ALIGNED' } : undefined),
    'a scored ILO ↔ Activities partial': (p) => (p.id === 'row2-ilo0-activity' ? { label: 'PARTIALLY_ALIGNED' } : undefined),
    'an advisory Title ↔ Content failure': (p) => (p.type === 'Content-course' ? { label: 'NOT_ALIGNED' } : undefined),
    'every relationship failing': () => ({ label: 'NOT_ALIGNED' }),
  };
  const shape = (r) => ({ score: r.score, overall: r.overall, status: r.status, passed: r.passed, passThreshold: r.passThreshold, base: r.hybrid.baseScore, deductions: r.hybrid.deductions.map((d) => [d.id, d.points]), ready: r.hybrid.ready, conformance: r.conformance.ok, findings: r.findings.map((f) => f.id), areas: r.areas.map((a) => [a.key, a.score]) });
  let compared = 0, withDeductions = 0;
  for (const [name, script] of Object.entries(cases)) {
    const a = world(t), b = world(t);
    const off = await check(a.db, a.content, { ...OFF }, { script }), on = await check(b.db, b.content, { ...ON, ...STAGES }, { script });
    // Ignore the advisory finding ids of the relationships V2 now owns: those are reported in V2's own section, not in the scored findings.
    const scored = (s) => ({ ...s, findings: s.findings.filter((id) => /^SEM:row\d+-ilo\d+-(clo|activity)|^(?!SEM:)/.test(id)) });
    assert.deepEqual(scored(shape(on.result)), scored(shape(off.result)), `${name}: the official result is identical with V2 on`);
    assert.equal(on.result.passThreshold, 79);
    compared += 1; if (off.result.hybrid.deductions.length > 0) withDeductions += 1;
  }
  assert.equal(compared, 5); assert.ok(withDeductions >= 3, `the parity test must exercise real deductions (${withDeductions} cases had some), or it proves nothing`);
  // The coded 47-rule evaluation itself does not depend on V2 either.
  const { content, masters } = h.sample();
  assert.deepEqual(h.engine.coded(structuredClone(content), masters).base.findings, h.engine.coded(structuredClone(content), masters).base.findings);
});

test('[VPAA-V2-OFFLINE] when V2 is off, or the AI is unavailable, the report says the seven-relationship check is incomplete and invents nothing', async (t) => {
  h.liveGuard(t);
  const down = () => async () => { throw new TypeError('fetch failed'); };
  for (const [name, env, transport, reason] of [
    ['V2 on, connection fails', { ...ON }, down(), 'v2_not_evaluated'], ['V2 on, provider off', { ...ON, SYLLABUS_CHECK_AI_PROVIDER: 'off' }, undefined, 'v2_not_evaluated'],
    ['V2 on, model not approved', { ...ON, SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: '' }, undefined, 'v2_not_evaluated'], ['V2 off, connection fails', { ...OFF }, down(), 'policy_v2_off'],
  ]) {
    const { content, db } = world(t), offline = world(t);
    const baseline = await svc.checkHybrid(offline.db, structuredClone(content), { syllabusId: 100, env: h.envFor({ ...OFF, SYLLABUS_CHECK_AI_PROVIDER: 'off' }), linkChecker: LINK });
    const { result } = await check(db, content, env, { transport });
    const cov = result.hybrid.semanticCoverage;
    assert.equal(cov.complete, false, `${name}: not complete`); assert.equal(cov.reason, reason, name);
    assert.ok(cov.relationships.every((r) => r.status === 'not_evaluated'), `${name}: nothing counts as evaluated`);
    assert.equal(cov.evaluated, 0);
    assert.ok(result.hybrid.alignment.judgements.every((j) => j.unverified), `${name}: no verified judgment`);
    assert.equal(result.status, 'incomplete'); assert.equal(result.score, null, `${name}: no official score is issued`);
    assert.deepEqual(result.findings.map((f) => f.id), baseline.findings.map((f) => f.id), `${name}: the coded findings are exactly those of a no-AI check`);
    assert.equal(result.hybrid.baseScore, baseline.hybrid.baseScore);
    assert.equal(cov.advisoryOnly, true);
  }
});

test('[VPAA-V2-COVERAGE-REPORT] the coverage the report states matches what was really evaluated, in every configuration', async (t) => {
  h.liveGuard(t);
  const run = async (env, script) => { const w = world(t); return (await check(w.db, w.content, env, { script })).result.hybrid.semanticCoverage; };
  const def = await run({ ...OFF });
  assert.equal(def.evaluated, 2); assert.equal(def.complete, false); assert.equal(def.reason, 'policy_v2_off');
  assert.deepEqual(def.relationships.filter((r) => r.status === 'evaluated').map((r) => r.type), ['ILO-CLO', 'ILO-activity'], 'default: only the two core relationships ran');
  assert.deepEqual(def.relationships.map((r) => r.n), [1, 2, 3, 4, 5, 6, 7]);
  const legacyAll = await run({ ...OFF, ...STAGES });
  assert.equal(legacyAll.complete, true); assert.ok(legacyAll.relationships.every((r) => r.source === 'legacy'), 'legacy stages B + C3 do cover all seven when V2 is off');
  const v2 = await run({ ...ON });
  assert.equal(v2.complete, true); assert.equal(v2.primaryPath, 'policy-v2'); assert.ok(v2.relationships.every((r) => r.source === 'policy-v2'), 'with V2 on, V2 is the source for all seven');
  // A side the syllabus lacks makes the affected relationships "not evaluated", with a reason an author can act on.
  const w = world(t); w.content.plan[0].activities = '';
  const missing = (await check(w.db, w.content, { ...ON })).result.hybrid.semanticCoverage;
  assert.equal(missing.complete, false); assert.equal(missing.reason, 'missing_evidence');
  assert.deepEqual(missing.relationships.filter((r) => r.status === 'partial').map((r) => r.type).sort(), ['Activity-assessment', 'Content-activity', 'ILO-activity'], 'exactly the relationships that use the empty field');
  // The pure function agrees on a hand-built report.
  assert.equal(semanticCoverageOf({ hybrid: {} }, { v2On: false }).evaluated, 0);
});

test('[VPAA-V2-BUDGET] the per-check budget bounds the legacy path and Policy V2 TOGETHER, and exhausting it is reported, not hidden', async (t) => {
  h.liveGuard(t);
  for (const max of ['0', '6', '20']) {
    const { content, db } = world(t);
    const { result, tr } = await check(db, content, { ...ON, SYLLABUS_CHECK_AI_MAX_REQUESTS: max });
    assert.ok(tr.sent.length <= Number(max), `max ${max}: ${tr.sent.length} requests in total across both paths`);
    if (max !== '20') { assert.equal(result.hybrid.semanticCoverage.complete, false, `max ${max}: the check is reported incomplete`); assert.equal(result.status, 'incomplete'); }
    assert.ok(result.hybrid.alignment.judgements.every((j) => j.unverified || tr.pairs().some((p) => p.id === j.id)), `max ${max}: no judgment exists for a relationship that was never sent`);
    assert.equal(result.hybrid.academicV2.alignment.liveModelCalls <= tr.sent.length, true);
  }
});

test('[VPAA-V2-GATES] the official submission gates are the same with Policy V2 on and off', async (t) => {
  h.liveGuard(t);
  const saved = process.env.SYLLABUS_CHECK_ACADEMIC_V2;
  t.after(() => { if (saved === undefined) delete process.env.SYLLABUS_CHECK_ACADEMIC_V2; else process.env.SYLLABUS_CHECK_ACADEMIC_V2 = saved; });
  const outcome = async (flag) => {
    if (flag) process.env.SYLLABUS_CHECK_ACADEMIC_V2 = flag; else delete process.env.SYLLABUS_CHECK_ACADEMIC_V2;
    const { content, db } = world(t);
    const broken = structuredClone(content); broken.grading.rows[1].pct = 30;
    const wrongCode = structuredClone(content); wrongCode.meta.code = 'ZZ 999';
    const e1 = await svc.requireHybrid(db, 100, broken).then(() => null, (e) => [e.status, e.body?.code, e.body?.failed?.map((f) => f.ruleId)]);
    const e2 = await svc.requireHybrid(db, 100, wrongCode).then(() => null, (e) => [e.status, e.body?.code, e.body?.score]);
    const ok = await svc.requireHybrid(db, 100, content);
    return { e1, e2, ok };
  };
  const off = await outcome('off'), on = await outcome('on');
  assert.deepEqual(on, off, 'identical gate outcomes');
  assert.deepEqual(off.e1[1], 'syllabus_hard_gate'); assert.equal(off.e2[2], 0); assert.equal(off.ok, undefined);
});

// The exact configuration for an AUTHORIZED STAGING test (documented in docs/vpaa-conformance/POLICY-V2-ACTIVATION.md). Nothing here activates it anywhere: the
// objects below are isolated and are only inspected, never exported to process.env.
const STAGING = Object.freeze({ SYLLABUS_CHECK_ACADEMIC_V2: 'on', SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', ANTHROPIC_MODEL: 'claude-sonnet-5-5', SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: 'claude-sonnet-5-5', ANTHROPIC_API_KEY: 'sk-ant-staging-placeholder-not-a-real-key', SESSION_SECRET: 'staging-secret-at-least-16', SYLLABUS_CHECK_AI_GATE: 'advisory', SYLLABUS_CHECK_AI_MAX_REQUESTS: '120', SYLLABUS_CHECK_AI_MAX_COST_USD: '1.50' });
test('[VPAA-V2-STAGING-CONFIG] the documented staging configuration is complete, and each missing piece makes V2 report itself unavailable instead of guessing', () => {
  assert.equal(v2Activation.enabled(STAGING), true);
  const ok = gemini.providerConfig(STAGING);
  assert.deepEqual([ok.provider, ok.model, ok.configured, ok.approved], ['anthropic', 'claude-sonnet-5-5', true, true]);
  assert.ok(refine.signingSecret(STAGING.SESSION_SECRET), 'token signing is configured');
  assert.equal(require('../policy').aiGate(STAGING), 'advisory', 'the AI gate stays advisory');
  const without = (key) => ({ ...STAGING, [key]: '' });
  assert.equal(gemini.providerConfig(without('ANTHROPIC_API_KEY')).configured, false, 'no key: not configured');
  assert.equal(gemini.providerConfig(without('SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL')).configured, false, 'no approval: not configured');
  assert.equal(gemini.providerConfig({ ...STAGING, ANTHROPIC_MODEL: 'claude-unknown-9' }).configured, false, 'an unverified model: not configured');
  assert.equal(v2Activation.enabled(without('SYLLABUS_CHECK_ACADEMIC_V2')), false, 'flag unset: V2 off');
  assert.equal(v2Activation.enabled({ ...STAGING, SYLLABUS_CHECK_ACADEMIC_V2: 'true' }), false, 'only the exact value "on" activates it');
  assert.equal(refine.signingSecret(without('SESSION_SECRET').SESSION_SECRET), null, 'no secret: recommendations cannot be verified');
});

test('[VPAA-V2-BASELINE-PARITY] the official deterministic result of the six recorded real-syllabus baselines is identical to what was recorded before these changes', async (t) => {
  const { pathToFileURL } = require('node:url'), path = require('node:path'), fs = require('node:fs');
  const root = path.resolve(__dirname, '../../../..');
  const recordedFile = path.join(root, 'docs/lcup-approved-offline/deterministic-baseline.json');
  if (!fs.existsSync(recordedFile) || !fs.existsSync(path.join(root, 'docs/lcup-approved-offline/masters.json'))) return t.skip('the recorded baselines are not present in this checkout');
  const { runBaselines } = await import(pathToFileURL(path.join(root, 'scripts/lcup-approved-offline/baseline.mjs')).href);
  const recorded = JSON.parse(fs.readFileSync(recordedFile, 'utf8')), now = await runBaselines();
  const shape = (r) => JSON.stringify({ critical: r.critical, baseScore: r.baseScore, officialScore: r.officialScore, passed: r.passed, aiStatus: r.aiStatus, findings: r.findings.map((f) => [f.ruleId, f.path, f.severity]).sort(), checks: r.checks.map((c) => [c.ruleId, c.path, c.status]).sort() });
  assert.equal(recorded.results.length, 6); assert.equal(now.passThreshold, 79); assert.equal(now.deterministicRulesInStandard, 47);
  for (const a of recorded.results) assert.equal(shape(now.results.find((x) => x.key === a.key && x.scenario === a.scenario)), shape(a), `${a.key}/${a.scenario}: identical to the recorded official deterministic result`);
});
