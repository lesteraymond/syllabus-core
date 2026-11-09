'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { parseYearLabel, labelOf, applyTerm, termOf, hasTerm } = require('../lib/subjectTerm');

// `years` is the academic_years table; `legacy` makes it a database that only had migrate-subject-term (no is_current column); `missingTable` has no table at all.
async function withServer(fn, { missingTable = false, legacy = false, usage = {}, years = [{ label: '2026–2027', start_year: 2026, is_current: 1 }] } = {}) {
  const db = {
    years,
    async query(sql, params = []) {
      if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [[{ user_id: params[0] }]]; // the sign-in check of requireAuth
      if (missingTable) throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' });
      if (sql.startsWith('SELECT academic_year FROM programs')) throw Object.assign(new Error('Unknown column'), { code: 'ER_BAD_FIELD_ERROR' }); // the catalog is not per year in this fixture
      if (sql.startsWith('SELECT label, start_year, is_current FROM academic_years')) {
        if (legacy) throw Object.assign(new Error('Unknown column'), { code: 'ER_BAD_FIELD_ERROR' });
        return [years.slice().sort((a, b) => a.start_year - b.start_year)];
      }
      if (sql.startsWith('SELECT label, start_year FROM academic_years')) return [years.slice().sort((a, b) => a.start_year - b.start_year).map(({ label, start_year }) => ({ label, start_year }))];
      if (sql.startsWith('INSERT INTO academic_years')) { if (years.some((y) => y.label === params[0])) throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }); years.push({ label: params[0], start_year: params[1], is_current: 0 }); return [{}]; }
      if (sql.startsWith('SELECT label, is_current FROM academic_years WHERE label')) return [years.filter((y) => y.label === params[0]).map((y) => ({ label: y.label, is_current: y.is_current }))];
      if (sql.startsWith('SELECT COUNT(*) AS n FROM')) return [[{ n: (usage[params[0]] || {})[sql.match(/FROM (\w+)/)[1]] || 0 }]];
      if (sql.startsWith('DELETE FROM academic_years WHERE label')) { const i = years.findIndex((y) => y.label === params[0]); if (i >= 0) years.splice(i, 1); return [{}]; }
      if (sql.startsWith('SELECT label FROM academic_years WHERE label')) return [years.filter((y) => y.label === params[0]).map((y) => ({ label: y.label }))];
      if (legacy && sql.startsWith('UPDATE academic_years SET is_current')) throw Object.assign(new Error('Unknown column'), { code: 'ER_BAD_FIELD_ERROR' });
      if (sql === 'UPDATE academic_years SET is_current = 0') { years.forEach((y) => { y.is_current = 0; }); return [{}]; }
      if (sql.startsWith('UPDATE academic_years SET is_current = 1 WHERE label')) { years.forEach((y) => { if (y.label === params[0]) y.is_current = 1; }); return [{}]; }
      throw new Error('unexpected query: ' + sql);
    },
    getConnection: async () => ({ query: (s, p) => db.query(s, p), beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} }),
  };
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { const h = req.headers['x-test-user']; req.session = h ? { user: JSON.parse(h) } : {}; next(); });
  app.locals.db = db; app.use('/api/academic-years', require('./academicYears'));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const call = async (as, method, body, path = '') => { const r = await fetch(`http://127.0.0.1:${server.address().port}/api/academic-years${path}`, { method, headers: { 'Content-Type': 'application/json', ...(as ? { 'x-test-user': JSON.stringify(as) } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  try { await fn({ call, db }); } finally { await new Promise((r) => server.close(r)); }
}
const admin = { id: 1, role: 'admin' }, fay = { id: 5, role: 'faculty' }, vee = { id: 9, role: 'vpaa' };
const THREE = [{ label: '2025–2026', start_year: 2025, is_current: 0 }, { label: '2026–2027', start_year: 2026, is_current: 0 }, { label: '2027–2028', start_year: 2027, is_current: 1 }, { label: '2028–2029', start_year: 2028, is_current: 0 }];

test('academic years: everyone signed in reads, only an administrator adds, the label is built from the first year', () => withServer(async ({ call }) => {
  assert.strictEqual((await call(null, 'GET')).status, 401);
  assert.deepStrictEqual((await call(fay, 'GET')).body, [{ label: '2026–2027', startYear: 2026, isCurrent: true }]);
  assert.strictEqual((await call(fay, 'POST', { startYear: 2027 })).status, 403);
  const made = await call(admin, 'POST', { startYear: 2027 });
  assert.deepStrictEqual([made.status, made.body], [200, { label: '2027–2028', startYear: 2027 }]);
  assert.deepStrictEqual((await call(admin, 'GET')).body.map((y) => y.label), ['2026–2027', '2027–2028'], 'listed in order');
  const dup = await call(admin, 'POST', { startYear: 2027 });
  assert.strictEqual(dup.status, 409); assert.match(dup.body.error, /already exists/);
  for (const bad of [{}, { startYear: 'soon' }, { startYear: 1999 }, { startYear: 2101 }, { startYear: 2027.5 }]) assert.strictEqual((await call(admin, 'POST', bad)).status, 400, JSON.stringify(bad));
}));

test('academic years: an administrator sees every year, everyone else only the current year and the previous one', () => withServer(async ({ call }) => {
  assert.deepStrictEqual((await call(admin, 'GET')).body.map((y) => y.label), ['2025–2026', '2026–2027', '2027–2028', '2028–2029']);
  for (const user of [fay, vee]) assert.deepStrictEqual((await call(user, 'GET')).body.map((y) => [y.label, y.isCurrent]), [['2026–2027', false], ['2027–2028', true]], user.role);
}, { years: structuredClone(THREE) }));

test('academic years: with no earlier year, a non-admin sees only the current one', () => withServer(async ({ call }) => {
  assert.deepStrictEqual((await call(fay, 'GET')).body.map((y) => y.label), ['2026–2027']);
}));

test('academic years: only an administrator makes a year current; it must exist; one year is current at a time', () => withServer(async ({ call, db }) => {
  assert.strictEqual((await call(fay, 'PUT', { label: '2027–2028' }, '/current')).status, 403);
  assert.strictEqual((await call(vee, 'PUT', { label: '2027–2028' }, '/current')).status, 403);
  assert.strictEqual((await call(admin, 'PUT', { label: '2031–2032' }, '/current')).status, 404);
  assert.strictEqual((await call(admin, 'PUT', {}, '/current')).status, 404);
  const done = await call(admin, 'PUT', { label: '2028–2029' }, '/current');
  assert.strictEqual(done.status, 200);
  assert.deepStrictEqual(done.body.filter((y) => y.isCurrent).map((y) => y.label), ['2028–2029']);
  assert.strictEqual(db.years.filter((y) => y.is_current).length, 1);
  // after the change a faculty member sees the new current year and the one before it
  assert.deepStrictEqual((await call(fay, 'GET')).body.map((y) => y.label), ['2027–2028', '2028–2029']);
}, { years: structuredClone(THREE) }));

test('academic years: before the migration the list is empty and adding says what to run', () => withServer(async ({ call }) => {
  assert.deepStrictEqual((await call(fay, 'GET')).body, []);
  const r = await call(admin, 'POST', { startYear: 2027 });
  assert.strictEqual(r.status, 503); assert.match(r.body.error, /migrate-subject-term/);
  const c = await call(admin, 'PUT', { label: '2026–2027' }, '/current');
  assert.strictEqual(c.status, 503); assert.match(c.body.error, /migrate-academic-year-scope/);
}, { missingTable: true }));

test('academic years: a database that only has the subject terms lists every year and has no current one', () => withServer(async ({ call }) => {
  const list = (await call(fay, 'GET')).body;
  assert.deepStrictEqual(list.map((y) => [y.label, y.isCurrent]), [['2026–2027', false], ['2027–2028', false]], 'nothing is hidden before a current year exists');
  const c = await call(admin, 'PUT', { label: '2027–2028' }, '/current');
  assert.strictEqual(c.status, 503); assert.match(c.body.error, /migrate-academic-year-scope/);
}, { legacy: true, years: [{ label: '2026–2027', start_year: 2026 }, { label: '2027–2028', start_year: 2027 }] }));

test('subject term helpers: labels are consecutive years, applyTerm forces only what the administrator set', () => {
  assert.strictEqual(labelOf(2027), '2027–2028');
  assert.deepStrictEqual(parseYearLabel('2027-2028'), { label: '2027–2028', startYear: 2027 }, 'a typed hyphen is accepted and stored with the en dash');
  assert.strictEqual(parseYearLabel('2027–2029'), null);
  assert.strictEqual(parseYearLabel('2027'), null);
  const meta = { prereq: 'typed', yearLevel: '4', curriculumYear: 'keep me', lecture: '2' };
  assert.strictEqual(applyTerm(meta, termOf({})), meta, 'no term: untouched');
  assert.deepStrictEqual(meta, { prereq: 'typed', yearLevel: '4', curriculumYear: 'keep me', lecture: '2' });
  applyTerm(meta, termOf({ academic_year: '2026–2027', semester: '1st Semester', year_level: 2, prerequisite: 'None' }));
  assert.deepStrictEqual(meta, { prereq: 'None', yearLevel: '2', curriculumYear: 'keep me', lecture: '2', semester: '1st Semester' }, "the syllabus's own academic year is its stamp, not the subject's year");
  assert.ok(hasTerm({ yearLevel: 1 }) && !hasTerm({}) && !hasTerm(null));
});

test('copy from last year: needs a sign-in, is for administrators only, and on a database without the catalog migration says what to run', () => withServer(async ({ call }) => {
  assert.strictEqual((await call(null, 'POST', {}, '/copy-catalog')).status, 401);
  assert.strictEqual((await call(fay, 'POST', {}, '/copy-catalog')).status, 403);
  assert.strictEqual((await call(vee, 'POST', {}, '/copy-catalog')).status, 403);
  const early = await call(admin, 'POST', {}, '/copy-catalog');
  assert.strictEqual(early.status, 503); assert.match(early.body.error, /migrate-catalog-year/);
}));

test('deleting an academic year: administrator only, never the current year, never one that syllabi, programs or subjects still belong to', () => withServer(async ({ call, db }) => {
  assert.strictEqual((await call(null, 'DELETE', null, '/2025%E2%80%932026')).status, 401);
  assert.strictEqual((await call(fay, 'DELETE', null, '/2025%E2%80%932026')).status, 403);
  assert.strictEqual((await call(admin, 'DELETE', null, '/2031%E2%80%932032')).status, 404);
  const current = await call(admin, 'DELETE', null, '/2027%E2%80%932028');
  assert.strictEqual(current.status, 409); assert.strictEqual(current.body.code, 'year_is_current');
  const used = await call(admin, 'DELETE', null, '/2026%E2%80%932027');
  assert.strictEqual(used.status, 409); assert.strictEqual(used.body.code, 'year_in_use');
  assert.match(used.body.error, /2 syllabuses, 1 program, 14 subjects/);
  assert.strictEqual(db.years.length, 4, 'nothing was deleted');
  const done = await call(admin, 'DELETE', null, '/2028%E2%80%932029');
  assert.strictEqual(done.status, 200);
  assert.deepStrictEqual(done.body.map((y) => y.label), ['2025–2026', '2026–2027', '2027–2028'], 'the answer is the list without it; the older years stay');
  assert.strictEqual(db.years.length, 3);
}, { years: THREE.map((y) => ({ ...y })), usage: { '2026–2027': { syllabi: 2, programs: 1, courses: 14 } } }));
