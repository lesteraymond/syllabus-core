'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { copyCatalog } = require('./catalogCopy');

// A small in-memory catalog: `programs` with their year, `courses` under them. Only the statements copyCatalog issues are modelled.
function fake({ years, programs, courses = [], migrated = true, noSources = false }) {
  const log = [];
  let nextProgram = 100, nextCourse = 500;
  const conn = {
    log, programs, courses,
    async query(sql, params = []) {
      log.push([sql.replace(/\s+/g, ' ').trim(), params]);
      if (sql.startsWith('SELECT label, start_year, is_current FROM academic_years')) return [years];
      if (sql.startsWith('SELECT academic_year FROM programs LIMIT 0')) { if (!migrated) throw Object.assign(new Error('no column'), { code: 'ER_BAD_FIELD_ERROR' }); return [[]]; }
      if (sql.startsWith('SELECT program_id FROM programs WHERE COALESCE(academic_year, ?) = ?')) return [programs.filter((p) => (p.academic_year || params[0]) === params[1]).map((p) => ({ program_id: p.program_id }))];
      if (sql.startsWith('SELECT COALESCE(academic_year, ?) AS year, COUNT(*)')) {
        const n = {}; for (const p of programs) { const y = p.academic_year || params[0]; n[y] = (n[y] || 0) + 1; }
        return [Object.entries(n).map(([year, c]) => ({ year, n: c }))];
      }
      if (sql.startsWith('SELECT program_id, code, name FROM programs')) return [programs.filter((p) => (p.academic_year || params[0]) === params[1]).map(({ program_id, code, name }) => ({ program_id, code, name }))];
      if (sql.startsWith('INSERT INTO programs')) { const id = nextProgram++; programs.push({ program_id: id, code: params[0], name: params[1], academic_year: params[2] }); return [{ insertId: id }]; }
      if (sql.startsWith('INSERT INTO program_egas') || sql.startsWith('INSERT INTO program_outcomes') || sql.startsWith('INSERT INTO course_clos') || sql.startsWith('INSERT INTO catalog_events')) return [{}];
      if (sql.startsWith('SELECT program_id, source_program_id, specialization FROM program_outcome_sources')) { if (noSources) throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' }); return [[]]; }
      if (sql.startsWith('SELECT reference_id FROM program_po_reference_active')) throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' }); // an unmigrated database: no version to carry over
      if (sql.startsWith('SELECT * FROM courses WHERE program_id IN')) return [courses.filter((c) => params[0].includes(c.program_id))];
      if (sql.startsWith('INSERT INTO courses')) { const id = nextCourse++; const cols = sql.match(/\(([^)]*)\) VALUES/)[1].split(', '); const row = { course_id: id }; cols.forEach((c, i) => { row[c] = params[i]; }); courses.push(row); return [{ insertId: id }]; }
      throw new Error('unexpected query: ' + sql);
    },
  };
  return conn;
}

const Y = [{ label: '2026–2027', start_year: 2026, is_current: 0 }, { label: '2027–2028', start_year: 2027, is_current: 1 }];
const BSIT = { program_id: 1, code: 'BSIT', name: 'Information Technology', academic_year: '2026–2027' };
const SUBJECT = { course_id: 10, code: 'IT 101', title: 'Intro', program_id: 1, clos_version: 3, standards_json: '{"x":1}', academic_year: '2026–2027', semester: 1, year_level: 2, prerequisite: 'IT 100' };

test('copying fills an EMPTY current year from the nearest earlier year, as new rows with the new year; the earlier year is untouched', async () => {
  const conn = fake({ years: Y, programs: [{ ...BSIT }], courses: [{ ...SUBJECT }] });
  const done = await copyCatalog(conn, { actor: 7 });
  assert.deepStrictEqual(done, { from: '2026–2027', to: '2027–2028', programs: 1, subjects: 1 });
  const copy = conn.programs.find((p) => p.academic_year === '2027–2028');
  assert.ok(copy && copy.program_id !== 1 && copy.code === 'BSIT' && copy.name === 'Information Technology');
  assert.strictEqual(conn.programs.find((p) => p.program_id === 1).academic_year, '2026–2027', 'the earlier program row is not changed');
  const made = conn.courses.find((c) => c.course_id !== 10);
  assert.deepStrictEqual([made.code, made.title, made.program_id, made.clos_version, made.standards_json, made.academic_year, made.semester, made.year_level, made.prerequisite],
    ['IT 101', 'Intro', copy.program_id, 3, '{"x":1}', '2027–2028', 1, 2, 'IT 100']);
  assert.ok(conn.log.some(([sql]) => sql.startsWith('INSERT INTO course_clos')), 'the CLOs are copied');
  assert.ok(!conn.log.some(([sql]) => /syllabi|assignment|deadline/i.test(sql)), 'nothing about syllabi, assignments or deadlines is touched');
  assert.ok(conn.log.some(([sql, p]) => sql.startsWith('INSERT INTO catalog_events') && p[0] === 7), 'the action is logged with the administrator');
});

test('copying is refused when the current year already has programs (409 catalog_not_empty)', async () => {
  const conn = fake({ years: Y, programs: [{ ...BSIT }, { program_id: 2, code: 'BSIE', name: 'Industrial', academic_year: '2027–2028' }], courses: [] });
  await assert.rejects(copyCatalog(conn, {}), (e) => e.status === 409 && e.body && e.body.code === 'catalog_not_empty');
  assert.strictEqual(conn.programs.length, 2, 'nothing was inserted');
});

test('copying is refused when no earlier year has a catalog, or the chosen year is the current one, unknown, or empty', async () => {
  const none = fake({ years: Y, programs: [] });
  await assert.rejects(copyCatalog(none, {}), (e) => e.status === 409 && e.body.code === 'no_source_catalog');
  const conn = fake({ years: Y, programs: [{ ...BSIT }] });
  await assert.rejects(copyCatalog(conn, { from: '2027–2028' }), (e) => e.status === 400);
  await assert.rejects(copyCatalog(conn, { from: '1999–2000' }), (e) => e.status === 400);
  const empty = fake({ years: [{ label: '2025–2026', start_year: 2025, is_current: 0 }, ...Y], programs: [{ ...BSIT }] });
  await assert.rejects(copyCatalog(empty, { from: '2025–2026' }), (e) => e.status === 409 && e.body.code === 'no_source_catalog');
  assert.strictEqual((await copyCatalog(empty, { from: '2026–2027' })).programs, 1, 'an explicit source with a catalog works');
});

test('a database without the catalog migration, or without any academic year, says what to run (503) and a missing specialization table is fine', async () => {
  await assert.rejects(copyCatalog(fake({ years: Y, programs: [{ ...BSIT }], migrated: false }), {}), (e) => e.status === 503 && /migrate-catalog-year/.test(e.message));
  await assert.rejects(copyCatalog(fake({ years: [], programs: [] }), {}), (e) => e.status === 503);
  const done = await copyCatalog(fake({ years: Y, programs: [{ ...BSIT }], courses: [{ ...SUBJECT }], noSources: true }), {});
  assert.strictEqual(done.programs, 1);
});
