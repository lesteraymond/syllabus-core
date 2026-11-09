'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadYears, currentOf, visibleOf, resolveYear, yearClause, currentLabel, queryInSameYear } = require('./academicYear');

const ROWS = [{ label: '2025–2026', start_year: 2025, is_current: 0 }, { label: '2026–2027', start_year: 2026, is_current: 0 }, { label: '2027–2028', start_year: 2027, is_current: 1 }, { label: '2028–2029', start_year: 2028, is_current: 0 }];
const dbOf = (rows, failWith) => ({ calls: [], async query(sql, params) {
  this.calls.push([sql, params]);
  if (failWith && sql.startsWith('SELECT label, start_year, is_current')) throw Object.assign(new Error(failWith), { code: failWith });
  if (sql.startsWith('SELECT label, start_year')) return [rows.map(({ label, start_year, is_current }) => (sql.includes('is_current') ? { label, start_year, is_current } : { label, start_year }))];
  return [[]];
} });
const admin = { id: 1, role: 'admin' }, fay = { id: 5, role: 'faculty' }, vee = { id: 9, role: 'vpaa' };
const labels = (years) => years.map((y) => y.label);

test('the current year is the one flagged; the previous year is the next lower start year that exists', async () => {
  const years = await loadYears(dbOf(ROWS));
  assert.strictEqual(currentOf(years).label, '2027–2028');
  assert.deepEqual(labels(visibleOf(years, admin)), ['2025–2026', '2026–2027', '2027–2028', '2028–2029'], 'an administrator sees every year, including a future one');
  assert.deepEqual(labels(visibleOf(years, fay)), ['2026–2027', '2027–2028']);
  assert.deepEqual(labels(visibleOf(years, vee)), ['2026–2027', '2027–2028'], 'reviewers other than the administrator are limited too');
  // a gap in the list: the previous year is simply the nearest earlier one
  const gap = await loadYears(dbOf([ROWS[0], ROWS[2]]));
  assert.deepEqual(labels(visibleOf(gap, fay)), ['2025–2026', '2027–2028']);
  const first = await loadYears(dbOf([{ label: '2026–2027', start_year: 2026, is_current: 1 }]));
  assert.deepEqual(labels(visibleOf(first, fay)), ['2026–2027'], 'no earlier year: only the current one');
});

test('resolveYear: no year means the current one; a year outside previous and current is refused for everyone but the administrator', async () => {
  const db = dbOf(ROWS);
  assert.deepEqual(await resolveYear(db, fay), { labels: ['2027–2028'], current: '2027–2028' });
  assert.deepEqual(await resolveYear(db, fay, '2026–2027'), { labels: ['2026–2027'], current: '2027–2028' });
  assert.deepEqual(await resolveYear(db, fay, 'all'), { labels: ['2026–2027', '2027–2028'], current: '2027–2028' }, 'all, for a faculty member, is previous + current');
  for (const asked of ['2025–2026', '2028–2029', 'nonsense']) await assert.rejects(() => resolveYear(db, fay, asked), (e) => e.status === 403 && e.body.code === 'year_not_allowed', asked);
  assert.deepEqual(await resolveYear(db, admin, '2025–2026'), { labels: ['2025–2026'], current: '2027–2028' });
  assert.deepEqual(await resolveYear(db, admin, 'all'), { labels: null, current: '2027–2028' }, 'an administrator\'s "all" is not filtered at all');
});

test('before the migration nothing is scoped and nothing is refused', async () => {
  for (const db of [dbOf(ROWS, 'ER_NO_SUCH_TABLE'), dbOf([{ label: '2026–2027', start_year: 2026 }, { label: '2027–2028', start_year: 2027 }], 'ER_BAD_FIELD_ERROR')]) {
    assert.deepEqual(await resolveYear(db, fay, '1999–2000'), { labels: null, current: null });
    assert.deepEqual(await resolveYear(db, fay), { labels: null, current: null });
    assert.strictEqual(await currentLabel(db), null);
  }
  const table = await loadYears(dbOf([{ label: '2026–2027', start_year: 2026 }], 'ER_BAD_FIELD_ERROR'));
  assert.deepEqual(labels(visibleOf(table, fay)), ['2026–2027'], 'a database with years but no current one shows them all');
  assert.strictEqual(await loadYears(dbOf([], 'ER_NO_SUCH_TABLE')), null);
});

test('yearClause adds the condition, with the current year standing in for a syllabus that has no year', async () => {
  assert.deepEqual(yearClause({ labels: null, current: '2027–2028' }), { sql: '', params: [] });
  assert.deepEqual(yearClause(null), { sql: '', params: [] });
  assert.deepEqual(yearClause({ labels: ['2026–2027'], current: '2027–2028' }), { sql: ' AND COALESCE(s.academic_year, ?) IN (?)', params: ['2027–2028', ['2026–2027']] });
  assert.equal(yearClause({ labels: ['x'], current: 'y' }, 'z.col').sql, ' AND COALESCE(z.col, ?) IN (?)');
});

test('queryInSameYear appends the same-year condition, and falls back to the plain query when there is no current year or no column', async () => {
  const db = dbOf(ROWS);
  await queryInSameYear(db, 'SELECT 1 FROM syllabi WHERE a = ?', [7], 93);
  const last = db.calls.at(-1);
  assert.ok(last[0].endsWith('AND COALESCE(academic_year, ?) = COALESCE((SELECT y.academic_year FROM syllabi y WHERE y.syllabus_id = ?), ?)'));
  assert.deepEqual(last[1], [7, '2027–2028', 93, '2027–2028']);
  const none = dbOf(ROWS, 'ER_NO_SUCH_TABLE');
  await queryInSameYear(none, 'SELECT 1 FROM syllabi WHERE a = ?', [7], 93);
  assert.deepEqual(none.calls.at(-1), ['SELECT 1 FROM syllabi WHERE a = ?', [7]]);
});
