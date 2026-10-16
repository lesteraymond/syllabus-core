import test from 'node:test';
import assert from 'node:assert/strict';
import { adminStatCards, ADMIN_STAT_ORDER } from './adminDashboardStats.js';

const syl = status => ({ status });

test('the admin dashboard has exactly five cards, in order, and no compliance card', () => {
  const cards = adminStatCards({ programs: 4, subjects: 31, syllabi: [] });
  assert.deepEqual(cards.map(c => c[0]), ADMIN_STAT_ORDER);
  assert.ok(!cards.some(c => /compliance/i.test(c[0])));
});

test('programs and subjects show the catalog counts', () => {
  const cards = adminStatCards({ programs: 4, subjects: 31, syllabi: [] });
  assert.equal(cards[0][1], '4');
  assert.equal(cards[1][1], '31');
});

test('a catalog count that is loading or failed shows a dash, and zero is a real zero', () => {
  assert.equal(adminStatCards({ syllabi: [] })[0][1], '—');
  assert.equal(adminStatCards({ programs: null, subjects: undefined, syllabi: [] })[1][1], '—');
  assert.equal(adminStatCards({ programs: 0, subjects: 0, syllabi: [] })[0][1], '0');
});

test('a syllabus the faculty just submitted counts as under review for the admin', () => {
  const cards = adminStatCards({ programs: 1, subjects: 1, syllabi: [syl('submitted'), syl('under_review'), syl('approved'), syl('for_revision'), syl('rejected')] });
  assert.equal(cards[2][1], '2');
  assert.equal(cards[3][1], '1');
  assert.equal(cards[4][1], '1');
});

test('returning a syllabus for revision moves it from under review to for revision', () => {
  const before = adminStatCards({ programs: 1, subjects: 1, syllabi: [syl('under_review')] });
  const after = adminStatCards({ programs: 1, subjects: 1, syllabi: [syl('for_revision')] });
  assert.deepEqual([before[2][1], before[4][1]], ['1', '0']);
  assert.deepEqual([after[2][1], after[4][1]], ['0', '1']);
});
