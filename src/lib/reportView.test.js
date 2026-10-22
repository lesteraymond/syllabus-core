import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, termAt } from './reportView.js';

const row = (id, code, status, overall, extra = {}) => ({
  syllabusId: id, courseCode: code, courseTitle: 'Title ' + code, facultyName: 'Faculty ' + id, programCode: 'BSIT', status,
  run: overall === null ? null : { overall, createdAt: '2026-10-05T04:00:00Z', areas: [{ key: 'template', score: 90 }, { key: 'reference_currency', score: extra.ref ?? 50 }] },
});

test('termAt names the school year and semester in Philippine time', () => {
  assert.deepEqual(termAt(new Date('2026-10-22T06:00:00Z')), { schoolYear: '2026-2027', semester: '1st Semester' });
  assert.deepEqual(termAt(new Date('2027-02-10T06:00:00Z')), { schoolYear: '2026-2027', semester: '2nd Semester' });
  assert.deepEqual(termAt(new Date('2027-06-15T06:00:00Z')), { schoolYear: '2027-2028', semester: 'Summer' });
});

test('the report counts statuses, bands and the syllabi under the pass mark', () => {
  const rows = [row(1, 'IT1', 'approved', 92), row(2, 'IT2', 'approved', 80), row(3, 'IT3', 'submitted', 70), row(4, 'IT4', 'for_revision', 40), row(5, 'IT5', 'draft', null)];
  const r = buildReport(rows, { user: { role: 'admin', name: 'Admin' }, now: new Date('2026-10-22T06:00:00Z') });
  assert.equal(r.summary.assigned, 5);
  assert.deepEqual(r.statuses.map((s) => s.count), [2, 1, 1, 1]);
  assert.equal(r.statuses.reduce((n, s) => n + s.count, 0), 5);
  assert.deepEqual(r.distribution.map((d) => d.count), [2, 1, 1]);
  assert.equal(r.summary.checks, 4);
  assert.equal(r.summary.below, 2);
  assert.deepEqual(r.needAttention.map((x) => x.code), ['IT4', 'IT3']);
  assert.equal(r.needAttention[0].weakest, 'References (50%)');
  assert.equal(r.trend[0].label, 'October');
  assert.equal(r.byProgram[0].program, 'BSIT');
});

test('a faculty report has no program table and an unknown status still counts', () => {
  const r = buildReport([row(1, 'IT1', 'weird', 90)], { user: { role: 'faculty', name: 'F' } });
  assert.equal(r.byProgram.length, 0);
  assert.equal(r.statuses.reduce((n, s) => n + s.count, 0), 1);
});

test('with nothing checked the report has no insights and no average', () => {
  const r = buildReport([row(1, 'IT1', 'draft', null)], { user: { role: 'admin' } });
  assert.equal(r.summary.average, null);
  assert.deepEqual(r.insights, []);
  assert.deepEqual(r.needAttention, []);
});
