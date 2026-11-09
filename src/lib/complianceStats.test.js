// Run: npm test. The dashboard's compliance numbers: AI score and approval are different things.
import test from 'node:test';
import assert from 'node:assert';
import { aiAverage, approval, programScores, areaAverages, SNAPSHOT_AREAS } from './complianceStats.js';

const row = (programCode, status, overall) => ({ programCode, status, run: overall === undefined ? null : { overall } });

test('the AI average counts only syllabi that have a score: an unchecked one, or one with no score yet, is not a zero', () => {
  assert.strictEqual(aiAverage([row('BSIT', 'approved', 90), row('BSIT', 'submitted', 70), row('BSIT', 'submitted'), row('BSIT', 'submitted', null)]), 80);
  assert.strictEqual(aiAverage([row('BSIT', 'submitted'), row('BSIT', 'draft', null)]), null);
  assert.strictEqual(aiAverage([]), null);
  assert.strictEqual(aiAverage(null), null);
  assert.strictEqual(aiAverage([row('BSIT', 'submitted', 0)]), 0, 'a real score of zero is a score');
});

test('approval is the share of syllabi an administrator approved, whatever their AI score', () => {
  assert.deepStrictEqual(approval([row('A', 'approved', 0), row('A', 'submitted', 99), row('A', 'approved'), row('A', 'for_revision')]), { approved: 2, total: 4, percent: 50 });
  assert.deepStrictEqual(approval([]), { approved: 0, total: 0, percent: 0 });
});

test('a program shows its own AI average, how many were checked, and its own approval share', () => {
  const scores = programScores([
    row('BSIT', 'approved', 100), row('BSIT', 'submitted', 50), row('BSIT', 'submitted'),
    row('BSIE', 'approved'), row('BSIE', 'approved'),
    row('BSCPE', 'submitted', 95),
  ]);
  const by = Object.fromEntries(scores.map((s) => [s.program, s]));
  assert.deepStrictEqual(by.BSIT, { program: 'BSIT', average: 75, checked: 2, total: 3, approved: 1, approvedPercent: 33 });
  assert.deepStrictEqual(by.BSIE, { program: 'BSIE', average: null, checked: 0, total: 2, approved: 2, approvedPercent: 100 });
  assert.deepStrictEqual(by.BSCPE, { program: 'BSCPE', average: 95, checked: 1, total: 1, approved: 0, approvedPercent: 0 });
});

test('programs with a score come first, best first; the ones without follow alphabetically', () => {
  const order = programScores([row('Z', 'submitted'), row('B', 'submitted', 60), row('A', 'submitted'), row('C', 'submitted', 90)]).map((s) => s.program);
  assert.deepStrictEqual(order, ['C', 'B', 'A', 'Z']);
});

test('a syllabus without a program is left out, and the plain syllabus list (program, no run) still gives approval', () => {
  assert.deepStrictEqual(programScores([row('', 'approved', 80), { status: 'approved' }, null]), []);
  const from = programScores([{ program: 'BSIT', status: 'approved' }, { program: 'BSIT', status: 'submitted' }]);
  assert.deepStrictEqual(from, [{ program: 'BSIT', average: null, checked: 0, total: 2, approved: 1, approvedPercent: 50 }]);
});

test('the snapshot rings are the real area averages, in a fixed order, with null where nothing was scored', () => {
  assert.deepStrictEqual(SNAPSHOT_AREAS, ['template', 'completeness', 'co_po', 'assessment']);
  const summary = { areas: [{ key: 'assessment', average: 61 }, { key: 'template', average: 88 }, { key: 'co_po', average: null }, { key: 'contact_hours', average: 100 }] };
  assert.deepStrictEqual(areaAverages(summary), [
    { key: 'template', average: 88 }, { key: 'completeness', average: null }, { key: 'co_po', average: null }, { key: 'assessment', average: 61 },
  ]);
  assert.deepStrictEqual(areaAverages(null).map((a) => a.average), [null, null, null, null]);
});

test('the scored syllabi spread over the high, medium and low bands, and the shares always add to 100', async () => {
  const { scoreBands } = await import('./complianceStats.js');
  assert.deepStrictEqual(scoreBands([row('A', 'approved', 100), row('A', 'approved', 80), row('A', 'submitted', 79), row('A', 'submitted', 50), row('A', 'submitted', 49), row('A', 'submitted')]),
    { count: 5, high: 40, medium: 40, low: 20 }, 'the unchecked syllabus is not part of the spread; 80 is high, 79 and 50 are medium, 49 is low');
  const thirds = scoreBands([row('A', 'x', 90), row('A', 'x', 60), row('A', 'x', 10)]);
  assert.strictEqual(thirds.high + thirds.medium + thirds.low, 100);
  assert.deepStrictEqual(scoreBands([row('A', 'draft')]), { count: 0, high: 0, medium: 0, low: 0 });
  assert.deepStrictEqual(scoreBands(null), { count: 0, high: 0, medium: 0, low: 0 });
});

// The administrator's Program Compliance: subjects with an approved syllabus out of the program's subjects, AI check or not.
test('program compliance counts the program\'s subjects that have an approved syllabus, out of all its subjects, whether or not AI checked them', async () => {
  const { programCoverage } = await import('./complianceStats.js');
  const programs = [{ code: 'BSIT', name: 'Information Technology' }, { code: 'BSCPE', name: 'Computer Engineering' }, { code: 'BSN', name: 'Nursing' }];
  const subjects = [{ id: 1, program: 'BSIT' }, { id: 2, program: 'BSIT' }, { id: 3, program: 'BSIT' }, { id: 4, program: 'BSIT' }, { id: 5, program: 'BSCPE' }, { id: 6, program: 'BSCPE' }];
  const syllabi = [
    { courseId: 1, status: 'approved' },                    // never checked by AI: still counts
    { courseId: 1, status: 'approved' },                    // a second approved syllabus for the same subject: counted once
    { courseId: 2, status: 'under_review' },                // not approved yet
    { courseId: 3, status: 'approved', archived: true },    // archived: the subject went to someone else
    { courseId: 5, status: 'approved' }, { courseId: 6, status: 'approved' },
  ];
  const out = programCoverage(programs, subjects, syllabi);
  assert.deepStrictEqual(out.map((p) => [p.program, p.approved, p.total, p.percent]), [['BSCPE', 2, 2, 100], ['BSIT', 1, 4, 25], ['BSN', 0, 0, 0]]);
  assert.strictEqual(out.find((p) => p.program === 'BSCPE').name, 'Computer Engineering');
  assert.deepStrictEqual(programCoverage([], [], []), []);
});

// A faculty member's Program Compliance: for each assigned program, their assigned subjects they have submitted a syllabus for (Submitted, Under Review,
// Approved), out of all their assigned subjects in it. A draft, or one returned for revision or rejected, must still be (re)submitted, so it does not count.
test('a faculty member\'s program compliance is their assigned subjects submitted, out of their assigned subjects in each program', async () => {
  const { programCoverage, FACULTY_SUBMITTED } = await import('./complianceStats.js');
  const programs = [{ code: 'BSIT', name: 'Information Technology' }];                       // one program assigned
  const subjects = [1, 2, 3, 4, 5].map((id) => ({ id, program: 'BSIT' }));                  // five subjects assigned in it
  const mine = [
    { courseId: 1, status: 'submitted' }, { courseId: 2, status: 'under_review' }, { courseId: 3, status: 'approved' },
    { courseId: 4, status: 'draft' }, { courseId: 5, status: 'for_revision' },
  ];
  const [bsit] = programCoverage(programs, subjects, mine, { statuses: FACULTY_SUBMITTED });
  assert.deepStrictEqual([bsit.approved, bsit.total, bsit.percent], [3, 5, 60]);
  mine[3].status = 'submitted'; mine[4].status = 'under_review'; // the draft submitted and the returned one resubmitted
  assert.deepStrictEqual(programCoverage(programs, subjects, mine, { statuses: FACULTY_SUBMITTED })[0].percent, 100, 'every assigned subject submitted: 100%');
  assert.deepStrictEqual(programCoverage(programs, subjects, [{ courseId: 1, status: 'rejected' }], { statuses: FACULTY_SUBMITTED })[0].approved, 0, 'rejected: not counted');
});

// The AI Quality Snapshot: the final score (rules minus AI deductions), the four areas after the AI deductions, and the lowest named.
test('the snapshot shows the final AI score and each area after the AI deductions, naming the lowest', async () => {
  const { snapshotOf } = await import('./complianceStats.js');
  const summary = { average: 87, areas: [
    { key: 'template', average: 100, final: 100 }, { key: 'completeness', average: 95, final: 95 },
    { key: 'co_po', average: 100, final: 70 },   // the rules found nothing; the AI check took points off the CLO-PO alignment
    { key: 'assessment', average: 90, final: 80 }, { key: 'reference_currency', average: 100, final: 60 }, // not one of the four rings
  ] };
  const s = snapshotOf(summary);
  assert.strictEqual(s.final, 87);
  assert.deepStrictEqual(s.areas.map((a) => [a.key, a.rules, a.score]), [['template', 100, 100], ['completeness', 95, 95], ['co_po', 100, 70], ['assessment', 90, 80]]);
  assert.deepStrictEqual(s.lowest, { key: 'co_po', score: 70 });
  assert.strictEqual(snapshotOf({ average: 100, areas: [{ key: 'template', average: 100, final: 100 }] }).lowest, null, 'nothing below 100: no lowest');
  assert.strictEqual(snapshotOf({ average: 90, areas: [{ key: 'co_po', average: 88 }] }).areas.find((a) => a.key === 'co_po').score, 88, 'an older server without the after-AI value: the rules value');
  assert.deepStrictEqual([snapshotOf(null).final, snapshotOf(null).lowest], [null, null]);
});
