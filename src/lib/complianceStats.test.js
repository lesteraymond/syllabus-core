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
