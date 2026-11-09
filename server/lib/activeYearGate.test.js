'use strict';
// The active academic year rule for new AI checks (lib/activeYearGate.js). Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertActiveYear, activeYear, MESSAGES, CODE } = require('./activeYearGate');

const db = (current, { missing } = {}) => { const asked = []; return { asked, query: async (sql) => { asked.push(sql); if (missing) throw Object.assign(new Error('no table'), { code: missing }); return [current === undefined ? [] : [].concat(current).map((label) => ({ label }))]; } }; };
const refused = (msg) => (e) => e.status === 409 && e.body.code === CODE && e.message === msg;

test('a syllabus of the active year may be checked; the active year is read from the database each time', async () => {
  const d = db('2028–2029');
  assert.equal(await assertActiveYear(d, { academic_year: '2028–2029' }), '2028–2029');
  assert.equal(await assertActiveYear(d, { academic_year: '2028–2029' }), '2028–2029');
  assert.equal(d.asked.length, 2);
});

test('a syllabus of another year is refused, naming both years', async () => {
  await assert.rejects(assertActiveYear(db('2028–2029'), { academic_year: '2026–2027' }), refused(MESSAGES.inactive('2028–2029', '2026–2027')));
  await assert.rejects(assertActiveYear(db('2026–2027'), { academic_year: '2028–2029' }), (e) => e.body.activeYear === '2026–2027' && e.body.syllabusYear === '2028–2029');
});

test('no active year, a broken state with two, or a syllabus with no year: refused', async () => {
  await assert.rejects(assertActiveYear(db(undefined), { academic_year: '2026–2027' }), refused(MESSAGES.none));
  await assert.rejects(assertActiveYear(db(['2026–2027', '2028–2029']), { academic_year: '2026–2027' }), refused(MESSAGES.none));
  await assert.rejects(assertActiveYear(db('2026–2027'), { academic_year: null }), refused(MESSAGES.unset));
  await assert.rejects(assertActiveYear(db(undefined, { missing: 'ER_NO_SUCH_TABLE' }), { academic_year: '2026–2027' }), refused(MESSAGES.none));
});

test('a database from before the academic-year scope (no academic_year column) is not restricted', async () => {
  const d = db('2026–2027');
  assert.equal(await assertActiveYear(d, { syllabus_id: 1, status: 'draft' }), null);
  assert.equal(d.asked.length, 0);
});

test('the store re-reads the active year under a shared lock, so a year switch waits for it or is seen by it', async () => {
  const d = db('2026–2027');
  await assertActiveYear(d, { academic_year: '2026–2027' }, { lock: true });
  assert.match(d.asked[0], /LOCK IN SHARE MODE$/);
  assert.equal(await activeYear(db('2026–2027')), '2026–2027');
});

test('other database errors are not hidden', async () => {
  await assert.rejects(assertActiveYear(db(undefined, { missing: 'ER_ACCESS_DENIED_ERROR' }), { academic_year: '2026–2027' }), (e) => e.code === 'ER_ACCESS_DENIED_ERROR');
});
