'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { gradingTotal, weeksOf } = require('./validation');
const { coded, run, VERSION } = require('./engine');
const { sample } = require('./fixtures');
const { mastersFor } = require('./repository');

test('grading sums decimal inputs exactly without floating point error or rounding into compliance', () => {
  for (const values of [[33.33, 33.33, 33.34], ['0.1', '0.2', '99.7'], [100], ['50.000000000001', '49.999999999999']]) {
    assert.equal(gradingTotal(values.map(pct => ({ pct }))).exact, true, values.join(','));
  }
  assert.equal(gradingTotal([{ pct: '99.999999999999' }]).exact, false);
  for (const pct of ['', true, null, -1, 101, '1e2', '0x64', 'NaN', Infinity, '100.0000000000001']) assert.equal(gradingTotal([{ pct }]).valid, false, String(pct));
  assert.equal(gradingTotal([]).exact, false);
});

test('week parser rejects ignored fragments, zero, reversed and out of policy ranges', () => {
  assert.deepEqual(weeksOf('Week 1-3, 5'), [1, 2, 3, 5]);
  assert.deepEqual(weeksOf('1–3'), [1, 2, 3]);
  for (const value of ['1, typo', '0', '19', '3-1', '1-60', '1.5', '']) assert.equal(weeksOf(value), null, value);
  const { content, masters } = sample();
  content.plan = content.plan.filter(row => row.week !== '3');
  assert.ok(coded(content, masters).findings.some(f => f.ruleId === 'WEEK-GAP' && f.evidence.actual.includes(3)));
});

test('rule evidence distinguishes official course absence from missing references', () => {
  const { content, masters } = sample('invalid-course');
  let result = coded(content, masters);
  assert.equal(result.checks.find(c => c.ruleId === 'CUR-CODE').status, 'FAIL');
  assert.equal(result.critical, true);
  masters.curricula = [];
  result = coded(content, masters);
  assert.equal(result.checks.find(c => c.ruleId === 'CUR-CODE').status, 'NOT_EVALUATED');
  assert.equal(result.critical, false);
});

test('mapping rules reject nonexistent, duplicate, and unassigned outcome relationships', () => {
  for (const mutate of [
    c => { c.clos[0].pos = [999]; },
    c => { c.clos[0].egas = []; },
    c => { c.clos[0].pos = [1, 1]; },
    c => { c.clos[1].id = c.clos[0].id; },
    c => { c.plan[0].ilos[0].tags = ['clo:gone']; },
    c => { c.plan[0].ilos[0].tags = []; },
  ]) {
    const { content, masters } = sample(); mutate(content);
    assert.ok(coded(content, masters).findings.some(f => ['CLO-ID', 'CLO-MAP', 'ILO-MAP'].includes(f.ruleId) && f.severity === 'blocking'));
  }
});

test('versioned report records pass, not applicable and observed link evidence without authorizing simulated checks', async () => {
  const { content, masters } = sample('broken-link');
  const result = await run(content, masters, { useAi: false, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }) });
  assert.equal(result.hybrid.version, VERSION);
  assert.equal(result.hybrid.reportVersion, 2);
  assert.equal(result.hybrid.policy.version, 'syllabus-policy-2');
  assert.equal(result.hybrid.codedChecks.find(c => c.ruleId === 'CUR-CODE').status, 'PASS');
  assert.ok(result.hybrid.codedChecks.some(c => c.status === 'NOT_APPLICABLE'));
  assert.equal(result.hybrid.codedChecks.find(c => c.ruleId === 'LINK').evidence.httpStatus, 200);
  assert.equal(result.score, null);
  assert.equal(result.hybrid.ready, false);
  assert.doesNotThrow(() => JSON.stringify(result));
});

test('reference fingerprint changes for selected references but ignores unrelated programs', async () => {
  const { content, masters } = sample();
  // Use the actual repository loaders with a minimal database fixture.
  const db = { query: async sql => {
    if (sql.includes('syllabus_check_curricula')) return [db.curricula];
    return [[]];
  }, curricula: [] };
  // Missing program/institution rows are allowed by their loaders; curriculum
  // scope, source and contents must still determine the reference hash.
  const row = { reference_id: 1, program_code: content.meta.program, curriculum_year: content.meta.curriculumYear, source: 'Registrar', courses_json: JSON.stringify(masters.curricula[0].courses) };
  db.curricula = [row];
  const first = await mastersFor(db, content);
  db.curricula.push({ ...row, reference_id: 2, program_code: 'OTHER' });
  assert.equal((await mastersFor(db, content)).fingerprint, first.fingerprint);
  db.curricula[0] = { ...row, source: 'Revised registrar source' };
  assert.notEqual((await mastersFor(db, content)).fingerprint, first.fingerprint);
});
