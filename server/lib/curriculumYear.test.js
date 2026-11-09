'use strict';
// A subject's curriculum year (lib/curriculumYear.js), the curriculum warning that follows it (lib/curriculumNote.js), the column fallback (lib/subjectTerm.js) and the
// catalog copy carrying it (lib/catalogCopy.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCurriculumYear, parseCurriculumYear, curriculumYearOf, saveCurriculumYear } = require('./curriculumYear');
const { curriculumNote } = require('./curriculumNote');
const { withColumnFallbacks } = require('./subjectTerm');

test('a curriculum year is two consecutive years, stored with a plain hyphen', () => {
  for (const [input, out] of [['2022-2023', '2022-2023'], ['2022–2023', '2022-2023'], [' 2022 - 2023 ', '2022-2023'], ['2025—2026', '2025-2026']]) assert.strictEqual(normalizeCurriculumYear(input), out, input);
  for (const bad of ['2022', '2022-2024', '2023-2022', '22-23', '2022/2023', '', null, undefined, '1800-1801', 'x2022-2023']) assert.strictEqual(normalizeCurriculumYear(bad), null, String(bad));
});

test('a request body: not sent leaves the subject alone, empty clears it, anything else must be valid', () => {
  assert.strictEqual(parseCurriculumYear({}), undefined);
  assert.strictEqual(parseCurriculumYear(undefined), undefined);
  assert.strictEqual(parseCurriculumYear({ curriculumYear: '' }), null);
  assert.strictEqual(parseCurriculumYear({ curriculumYear: '  ' }), null);
  assert.strictEqual(parseCurriculumYear({ curriculumYear: null }), null);
  assert.strictEqual(parseCurriculumYear({ curriculumYear: '2022–2023' }), '2022-2023');
  for (const bad of ['2022', 2022, {}, ['2022-2023']]) assert.throws(() => parseCurriculumYear({ curriculumYear: bad }), (e) => e.status === 400 && /YYYY-YYYY/.test(e.message), JSON.stringify(bad));
  assert.strictEqual(curriculumYearOf({ curriculum_year: '2022-2023' }), '2022-2023');
  assert.strictEqual(curriculumYearOf({}), null);
});

test('saving on a database without the column answers 503 with the migration to run; other errors pass through', async () => {
  const missing = { query: async () => { throw Object.assign(new Error('Unknown column'), { code: 'ER_BAD_FIELD_ERROR' }); } };
  await assert.rejects(saveCurriculumYear(missing, 1, '2022-2023'), (e) => e.status === 503 && /migrate-curriculum-year/.test(e.message));
  const broken = { query: async () => { throw Object.assign(new Error('gone'), { code: 'PROTOCOL_CONNECTION_LOST' }); } };
  await assert.rejects(saveCurriculumYear(broken, 1, '2022-2023'), (e) => e.code === 'PROTOCOL_CONNECTION_LOST');
  const calls = []; await saveCurriculumYear({ query: async (sql, p) => { calls.push([sql, p]); return [{}]; } }, 7, null);
  assert.deepStrictEqual(calls, [['UPDATE courses SET curriculum_year = ? WHERE course_id = ?', [null, 7]]]);
});

test('column fallbacks: each query is tried while a column is missing, and only that error falls through', async () => {
  const seen = [];
  const db = (failing) => ({ query: async (sql) => { seen.push(sql); if (failing.includes(sql)) throw Object.assign(new Error('x'), { code: 'ER_BAD_FIELD_ERROR' }); return [[{ sql }]]; } });
  assert.strictEqual((await withColumnFallbacks(db([]), ['a', 'b', 'c'], []))[0][0].sql, 'a');
  assert.strictEqual((await withColumnFallbacks(db(['a']), ['a', 'b', 'c'], []))[0][0].sql, 'b');
  assert.strictEqual((await withColumnFallbacks(db(['a', 'b']), ['a', 'b', 'c'], []))[0][0].sql, 'c');
  await assert.rejects(withColumnFallbacks(db(['a', 'b', 'c']), ['a', 'b', 'c'], []), (e) => e.code === 'ER_BAD_FIELD_ERROR', 'the last one is not swallowed');
  const other = { query: async () => { throw Object.assign(new Error('y'), { code: 'ER_PARSE_ERROR' }); } };
  await assert.rejects(withColumnFallbacks(other, ['a', 'b'], []), (e) => e.code === 'ER_PARSE_ERROR', 'any other error is not a missing column');
});

test('the curriculum warning compares only the subject\'s own curriculum when it has one', () => {
  const rows = [
    { program_code: 'BSIT', curriculum_year: '2018-2019', courses_json: JSON.stringify([{ code: 'IT 105', prereq: 'IT 101', yearLevel: 1 }]) },
    { program_code: 'BSIT', curriculum_year: '2022-2023', courses_json: JSON.stringify([{ code: 'IT 105', prereq: 'None', yearLevel: 2 }]) },
  ];
  const term = { prerequisite: 'None', yearLevel: 2 };
  assert.strictEqual(curriculumNote({ programCode: 'BSIT', code: 'IT 105', term, curriculumYear: '2022-2023' }, rows), null, 'matches its own curriculum: no warning');
  const other = curriculumNote({ programCode: 'BSIT', code: 'IT 105', term, curriculumYear: '2018-2019' }, rows);
  assert.deepStrictEqual(other.differences.map((d) => [d.field, d.curriculumYear]), [['prerequisite', '2018-2019'], ['yearLevel', '2018-2019']]);
  const unset = curriculumNote({ programCode: 'BSIT', code: 'IT 105', term }, rows);
  assert.deepStrictEqual(unset.differences.map((d) => d.curriculumYear), ['2018-2019', '2018-2019'], 'no curriculum year: every approved curriculum is compared, as before');
  assert.strictEqual(curriculumNote({ programCode: 'BSIT', code: 'IT 105', term, curriculumYear: '2030-2031' }, rows), null, 'no approved curriculum of that year: nothing to compare');
});

test('copying a catalog carries each subject\'s curriculum year when the column exists, and works without it', async () => {
  const { copyCatalog } = require('./catalogCopy');
  const years = [{ label: '2026–2027', start_year: 2026, is_current: 0 }, { label: '2027–2028', start_year: 2027, is_current: 1 }];
  const run = async (subject) => {
    const programs = [{ program_id: 1, code: 'BSIT', name: 'IT', academic_year: '2026–2027' }], courses = [subject];
    let next = 500;
    const conn = { async query(sql, p = []) {
      if (sql.startsWith('SELECT label, start_year, is_current FROM academic_years')) return [years];
      if (sql.startsWith('SELECT academic_year FROM programs LIMIT 0')) return [[]];
      if (sql.startsWith('SELECT program_id FROM programs WHERE COALESCE(academic_year, ?) = ?')) return [programs.filter((x) => x.academic_year === p[1])];
      if (sql.startsWith('SELECT COALESCE(academic_year, ?) AS year, COUNT(*)')) return [[{ year: '2026–2027', n: 1 }]];
      if (sql.startsWith('SELECT program_id, code, name FROM programs')) return [programs.filter((x) => x.academic_year === p[1])];
      if (sql.startsWith('INSERT INTO programs')) { programs.push({ program_id: 100, code: p[0], name: p[1], academic_year: p[2] }); return [{ insertId: 100 }]; }
      if (/^INSERT INTO (program_egas|program_outcomes|course_clos|catalog_events)/.test(sql)) return [{}];
      if (/program_outcome_sources|program_po_reference_active/.test(sql)) throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' });
      if (sql.startsWith('SELECT * FROM courses WHERE program_id IN')) return [courses.filter((c) => p[0].includes(c.program_id))];
      if (sql.startsWith('INSERT INTO courses')) { const cols = sql.match(/\(([^)]*)\) VALUES/)[1].split(', '); const row = { course_id: next++ }; cols.forEach((c, i) => { row[c] = p[i]; }); courses.push(row); return [{ insertId: row.course_id }]; }
      throw new Error('unexpected query: ' + sql);
    } };
    await copyCatalog(conn, {});
    return courses.find((c) => c.course_id >= 500);
  };
  const base = { course_id: 10, code: 'IT 101', title: 'Intro', program_id: 1, clos_version: 1, standards_json: null, academic_year: '2026–2027', semester: '1st Semester', year_level: 1, prerequisite: 'None' };
  const copied = await run({ ...base, curriculum_year: '2022-2023' });
  assert.strictEqual(copied.curriculum_year, '2022-2023', 'a curriculum spans academic years: the copy keeps it');
  assert.strictEqual(copied.academic_year, '2027–2028', 'while the academic year becomes the new one');
  const before = await run({ ...base });
  assert.ok(!Object.hasOwn(before, 'curriculum_year'), 'a database without the column: nothing about it is inserted');
});
