const test = require('node:test');
const assert = require('node:assert/strict');
const repo = require('./repository');
const svc = require('../compliance/service');
const { sample } = require('./fixtures');
const { contentHash } = require('../compliance/hash');
const { curriculumInput } = require('../../routes/syllabusCheck');

// Run a test under one AI-gate policy and put the environment back afterwards.
const underGate = (t, mode) => {
  const before = process.env.SYLLABUS_CHECK_AI_GATE;
  if (mode === undefined) delete process.env.SYLLABUS_CHECK_AI_GATE; else process.env.SYLLABUS_CHECK_AI_GATE = mode;
  t.after(() => { if (before === undefined) delete process.env.SYLLABUS_CHECK_AI_GATE; else process.env.SYLLABUS_CHECK_AI_GATE = before; });
};
test('strict policy (SYLLABUS_CHECK_AI_GATE=required): submission requires a current persisted Gemini report; clients cannot supply a score to bypass it', async t => {
  underGate(t, 'required');
  const { content, masters } = sample();
  delete masters.synthetic;
  masters.fingerprint = 'current-master';
  const hash = contentHash(content, svc.standard.version);
  let report = { score: 85, referenceHash: masters.fingerprint, fingerprint: masters.fingerprint, hybrid: { ready: true, checkedAt: new Date().toISOString(), alignment: { status: 'completed', provider: 'gemini' }, deductions: [{ points: 3 }] } };
  t.mock.method(repo, 'mastersFor', async () => masters);
  t.mock.method(repo, 'readReport', async () => report);
  const db = { query: async (sql, params) => {
    if (sql.startsWith('SELECT 1')) return [[]];
    if (sql.startsWith('SELECT * FROM ai_check_runs')) return [params[1] === hash ? [{ run_id: 7 }] : []];
    throw Error('Unexpected SQL: ' + sql);
  } };
  svc.resetInstalledCache();
  assert.equal((await svc.requireHybrid(db, 100, content)).score, 85);
  report.hybrid.alignment = { status: 'completed', provider: 'openrouter', model: 'google/gemini-2.5-flash' };
  assert.equal((await svc.requireHybrid(db, 100, content)).score, 85);
  report.hybrid.alignment = { status: 'completed', provider: 'openrouter', model: 'nvidia/nemotron-3-ultra-550b-a55b:free' };
  assert.equal((await svc.requireHybrid(db, 100, content)).score, 85);
  const changed = structuredClone(content); changed.plan[0].tasks += ' changed';
  await assert.rejects(svc.requireHybrid(db, 100, changed), e => e.status === 409 && e.body.code === 'alignment_required');
  report.hybrid.alignment.status = 'not_evaluated';
  await assert.rejects(svc.requireHybrid(db, 100, content), /Complete active AI/);
  report.hybrid.alignment.status = 'completed'; report.fingerprint = 'old-master';
  await assert.rejects(svc.requireHybrid(db, 100, content), /Complete active AI/);
  report.fingerprint = masters.fingerprint; report.hybrid.checkedAt = '2000-01-01T00:00:00.000Z';
  await assert.rejects(svc.requireHybrid(db, 100, content), /Complete active AI/);
  report = null;
  await assert.rejects(svc.requireHybrid(db, 100, content), /Complete active AI/);
});
test('curriculum hard mismatch precedes semantic gate and returns score zero', async t => {
  const { content, masters } = sample('invalid-course');
  t.mock.method(repo, 'mastersFor', async () => masters);
  svc.resetInstalledCache();
  const db = { query: async () => [[]] };
  await assert.rejects(svc.requireHybrid(db, 100, content), e => e.status === 409 && e.body.score === 0 && /CRITICAL MISMATCH/.test(e.message));
});
test('advisory policy (default): no AI check, a failed one or an old one does not stop a submit or an approval', async t => {
  underGate(t, undefined);
  const { content, masters } = sample();
  t.mock.method(repo, 'mastersFor', async () => masters);
  t.mock.method(repo, 'readReport', async () => null); // there is no persisted AI report at all
  svc.resetInstalledCache();
  const db = { query: async (sql) => { if (sql.startsWith('SELECT 1')) return [[]]; throw Error('The AI report must not even be looked up: ' + sql); } };
  assert.equal(await svc.requireHybrid(db, 100, content), undefined);
});
test('advisory policy still enforces the coded hard gates: a course outside the curriculum is refused with score zero', async t => {
  underGate(t, undefined);
  const { content, masters } = sample('invalid-course');
  t.mock.method(repo, 'mastersFor', async () => masters);
  svc.resetInstalledCache();
  await assert.rejects(svc.requireHybrid({ query: async () => [[]] }, 100, content), e => e.status === 409 && e.body.score === 0 && e.body.code === 'syllabus_hard_gate');
});
test('advisory policy still enforces the other coded hard gates, such as a grading total that is not 100%', async t => {
  underGate(t, undefined);
  const { content, masters } = sample();
  content.grading.rows[0].pct = 1;
  t.mock.method(repo, 'mastersFor', async () => masters);
  svc.resetInstalledCache();
  await assert.rejects(svc.requireHybrid({ query: async () => [[]] }, 100, content), e => e.status === 409 && e.body.code === 'syllabus_hard_gate' && e.body.failed.some(f => f.ruleId === 'GRADE-100'));
});
test('the policy reads SYLLABUS_CHECK_AI_GATE: only "required" is strict, anything else is advisory', () => {
  const { aiGate } = require('./policy');
  assert.equal(aiGate({}), 'advisory');
  assert.equal(aiGate({ SYLLABUS_CHECK_AI_GATE: 'Required' }), 'required');
  assert.equal(aiGate({ SYLLABUS_CHECK_AI_GATE: 'advisory' }), 'advisory');
  assert.equal(aiGate({ SYLLABUS_CHECK_AI_GATE: 'off' }), 'advisory');
});
test('missing checker installation blocks even when a client claims alignment is complete', async () => {
  svc.resetInstalledCache();
  await assert.rejects(svc.requireHybrid({ query: async () => { throw Error('missing tables'); } }, 1, { score: 100, alignment: 'completed' }), e => e.status === 503);
});
test('official reference import requires explicit identity fields and rejects synthetic or duplicate courses', () => {
  const { masters } = sample();
  const input = { program: 'BSIT', curriculumYear: '2026', source: 'Registrar verified curriculum', courses: masters.curricula[0].courses };
  assert.equal(curriculumInput(input).program, 'BSIT');
  assert.throws(() => curriculumInput({ ...input, synthetic: true }), /Synthetic/);
  assert.throws(() => curriculumInput({ ...input, courses: [...input.courses, ...input.courses] }), /Duplicate/);
  assert.throws(() => curriculumInput({ ...input, courses: [{ ...input.courses[0], yearLevel: '' }] }), /Every course/);
});
test('historical incomplete reports expose the baseline separately and no final score', async t => {
  t.mock.method(repo, 'readReport', async () => ({ score: 97, fingerprint: 'current', findings: [], hybrid: { ready: false, critical: false, baseScore: 97, score: 97, checkedAt: new Date().toISOString(), checkedMeta: {}, alignment: { status: 'not_evaluated' } } }));
  t.mock.method(repo, 'mastersFor', async () => ({ fingerprint: 'current' }));
  const db = { query: async () => [[]] };
  const result = await svc.loadDetail(db, { run_id: 1, standard_version: svc.standard.version, overall: 97, status: 'scored', passed: 1 }, null);
  assert.equal(result.overall, null);
  assert.equal(result.score, null);
  assert.equal(result.hybrid.score, null);
  assert.equal(result.hybrid.baseScore, 97);
  assert.equal(result.status, 'incomplete');
  assert.equal(result.passed, false);
});

const aged = (minutes) => ({ score: 96, fingerprint: 'current', findings: [], hybrid: { ready: true, critical: false, score: 96, checkedAt: new Date(Date.now() - minutes * 60000).toISOString(), checkedMeta: {}, alignment: { status: 'completed', provider: 'gemini' } } });
const loadAged = async (t, minutes) => {
  t.mock.method(repo, 'readReport', async () => structuredClone(aged(minutes)));
  t.mock.method(repo, 'mastersFor', async () => ({ fingerprint: 'current' }));
  return svc.loadDetail({ query: async () => [[]] }, { run_id: 1, standard_version: svc.standard.version, overall: 96, status: 'scored', passed: 1 }, undefined);
};
test('advisory policy: a complete check of an unchanged syllabus keeps its score however old it is', async t => {
  underGate(t, undefined);
  const result = await loadAged(t, 40);
  assert.equal(result.hybrid.ready, true, 'it is not marked incomplete because of its age');
  assert.equal(result.stale, false, 'stale means the syllabus changed, and it did not');
  assert.equal(result.overall, 96);
});
test('strict policy: the same check expires after 30 minutes, because a fresh AI check is then a gate', async t => {
  underGate(t, 'required');
  assert.equal((await loadAged(t, 10)).hybrid.ready, true);
  const old = await loadAged(t, 40);
  assert.equal(old.hybrid.ready, false);
  assert.equal(old.stale, true);
});
test('a check made by an older rule version or against changed references is out of date under either policy', async t => {
  underGate(t, undefined);
  t.mock.method(repo, 'readReport', async () => structuredClone(aged(1)));
  t.mock.method(repo, 'mastersFor', async () => ({ fingerprint: 'the references changed' }));
  const result = await svc.loadDetail({ query: async () => [[]] }, { run_id: 1, standard_version: svc.standard.version, overall: 96, status: 'scored', passed: 1 }, undefined);
  assert.equal(result.stale, true);
  assert.equal(result.hybrid.ready, false);
});
test('previous engine reports remain readable as history and cannot stay ready after a rule upgrade', async t => {
  const previous = { score: 90, fingerprint: 'current', findings: [], hybrid: { ready: true, critical: false, score: 90, checkedAt: new Date().toISOString(), checkedMeta: {}, alignment: { status: 'completed', provider: 'gemini' } } };
  t.mock.method(repo, 'readReport', async () => structuredClone(previous));
  t.mock.method(repo, 'mastersFor', async () => ({ fingerprint: 'current' }));
  const result = await svc.loadDetail({ query: async () => [[]] }, { run_id: 1, standard_version: 'hybrid-1', overall: 90, status: 'scored', passed: 1 }, null);
  assert.equal(result.overall, 90, 'Historical score is preserved');
  assert.equal(result.hybrid.alignment.status, 'completed');
  assert.equal(result.hybrid.ready, false);
  assert.equal(result.stale, true);
});
