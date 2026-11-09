// A subject's term as the administrator sets it (lib/subjectTerm.js): the pre-requisite is optional, since many subjects have none; a syllabus for a
// subject set up without one says "None". Run: npm test.
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTerm, applyTerm } = require('./subjectTerm');

// the academic years the database knows
const db = { query: async (sql, p) => { assert.match(sql, /FROM academic_years WHERE label = \?/); return [p[0] === '2026–2027' ? [{ 1: 1 }] : []]; } };
const base = { academicYear: '2026–2027', semester: '1st Semester', yearLevel: 1 };

test('a subject can be added without a pre-requisite; one that is given is kept, trimmed', async () => {
  assert.deepEqual(await parseTerm(db, { ...base, prerequisite: '' }), { ...base, prerequisite: null });
  assert.deepEqual(await parseTerm(db, { ...base }), { ...base, prerequisite: null }, 'not sent at all');
  assert.deepEqual(await parseTerm(db, { ...base, prerequisite: '   ' }), { ...base, prerequisite: null }, 'only spaces: none');
  assert.deepEqual(await parseTerm(db, { ...base, prerequisite: '  IT 101 ' }), { ...base, prerequisite: 'IT 101' });
});

test('the academic year, semester and year level are still required, and a pre-requisite is still limited in length', async () => {
  await assert.rejects(parseTerm(db, { ...base, semester: '' }), (e) => e.status === 400);
  await assert.rejects(parseTerm(db, { ...base, yearLevel: 0 }), (e) => e.status === 400);
  await assert.rejects(parseTerm(db, { ...base, prerequisite: 'x'.repeat(256) }), (e) => e.status === 400 && /too long/.test(e.message));
  assert.equal(await parseTerm(db, {}), null, 'no term fields: the subject is left as it is');
});

test('a syllabus shows the subject\'s pre-requisite, or "None" when the subject was set up without one', () => {
  assert.equal(applyTerm({ prereq: 'typed by faculty' }, { ...base, prerequisite: 'IT 101' }).prereq, 'IT 101');
  assert.equal(applyTerm({ prereq: 'typed by faculty' }, { ...base, prerequisite: null }).prereq, 'None');
  assert.equal(applyTerm({ prereq: 'as typed' }, null).prereq, 'as typed', 'a subject without a term leaves step 1 as typed');
});

// Every subject of a catalog year is stamped with that year automatically (routes/courses.js), even when the administrator entered no term. That stamp is
// not a set-up: "None" is never invented for such a subject (the cause of the release integration test failure after v1.73.3).
test('the automatic academic-year stamp alone does not make a pre-requisite: the typed one stays', () => {
  const stampOnly = { academicYear: '2026–2027', semester: null, yearLevel: null, prerequisite: null };
  assert.equal(applyTerm({ prereq: 'ZZ 100 - Prerequisite' }, stampOnly).prereq, 'ZZ 100 - Prerequisite');
  assert.equal(applyTerm({ prereq: '' }, stampOnly).prereq, '', 'nothing typed, nothing set: still nothing');
  assert.equal(applyTerm({ prereq: 'typed' }, { ...stampOnly, semester: '2nd Semester' }).prereq, 'None', 'a semester entered is a set-up');
  assert.equal(applyTerm({ prereq: 'typed' }, { ...stampOnly, yearLevel: 2 }).prereq, 'None', 'a year level entered is a set-up');
  assert.equal(applyTerm({ prereq: 'typed' }, { ...stampOnly, prerequisite: 'IT 101' }).prereq, 'IT 101');
});
