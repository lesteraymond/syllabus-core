'use strict';
// The "older than 5 years" reference note (REF-RECENCY) counts from the school year the syllabus belongs to (meta.academicYear, set from its subject),
// never from today's date: before, the official check and Check & improve passed no year, so a 2023-2024 syllabus checked in 2026 had its 2019 book
// flagged although it was recent enough for that syllabus. Without an academic year it counts from the server's school year (lib/schoolYear.js), as the
// builder's compliance check does. A year the caller passes still wins (tests, scripts). Offline.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('./testSyllabus');
const { check, yearOfSyllabus } = require('./check');
const { schoolYearStart } = require('../../schoolYear');

const BOOK_2019 = 'Deitel, P., & Deitel, H. (2019). Java how to program (11th ed.). Pearson.';
const withBook = academicYear => {
  const c = T.conforming();
  if (academicYear === undefined) delete c.meta.academicYear; else c.meta.academicYear = academicYear;
  c.refs.books.items.push({ id: 'b9', t: BOOK_2019 });
  return c;
};
const recency = async (content, opts = {}) => (await check(content, null, { ask: T.scriptedJudge(), ...opts })).fixed.findings.filter(f => f.rule === 'REF-RECENCY' && f.where.ref === 'b9').length;

test('yearOfSyllabus: the start year of meta.academicYear (any dash), else the server school year', () => {
  assert.equal(yearOfSyllabus({ meta: { academicYear: '2023–2024' } }), 2023);
  assert.equal(yearOfSyllabus({ meta: { academicYear: '2023-2024' } }), 2023);
  assert.equal(yearOfSyllabus({ meta: { academicYear: 'S.Y. 2025 - 2026' } }), 2025);
  assert.equal(yearOfSyllabus({ meta: {} }), schoolYearStart());
  assert.equal(yearOfSyllabus({ meta: { academicYear: 'next year' } }), schoolYearStart());
  assert.equal(yearOfSyllabus(null), schoolYearStart());
});

test('a 2019 book: recent enough for a 2023-2024 syllabus, older than 5 years for a 2026-2027 one', async () => {
  assert.equal(await recency(withBook('2023–2024')), 0);
  assert.equal(await recency(withBook('2026–2027')), 1);
  assert.equal(await recency(withBook('2025–2026')), 1, '2019 < 2025 - 5');
  assert.equal(await recency(withBook('2024–2025')), 0, '2019 = 2024 - 5 is still within 5 years');
});

test('without an academic year the note counts from the server school year, and a year the caller passes wins', async () => {
  const start = schoolYearStart();
  assert.equal(await recency(withBook(undefined)), start - 5 > 2019 ? 1 : 0);
  assert.equal(await recency(withBook('2023–2024'), { year: 2030 }), 1);
});
