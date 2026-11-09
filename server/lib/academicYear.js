'use strict';
// Which academic year a syllabus belongs to, which one is current, and which ones a person may see.
//   current year  one row of academic_years (is_current), set by an administrator
//   an administrator (role "admin") sees every year; everyone else sees the CURRENT year and the PREVIOUS one (the next lower start year in the list)
//   a syllabus is stamped with the current year when it is created (syllabi.academic_year); a syllabus with no year counts as the current year
// Before `npm run migrate-academic-year-scope` has run there is no current year, so nothing is scoped and the application behaves as it did.
const { httpError } = require('./http');

const isAdmin = (user) => !!user && user.role === 'admin';
const NOT_MIGRATED = new Set(['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR']);

// [{ label, startYear, isCurrent }] ordered by start year, or null when the tables or columns are not there yet.
async function loadYears(db) {
  const shape = (rows) => rows.map((r) => ({ label: r.label, startYear: Number(r.start_year), isCurrent: !!Number(r.is_current) }));
  try {
    const [rows] = await db.query('SELECT label, start_year, is_current FROM academic_years ORDER BY start_year');
    return shape(rows);
  } catch (error) {
    if (error && error.code === 'ER_BAD_FIELD_ERROR') { // the years exist (migrate-subject-term) but none is current yet (migrate-academic-year-scope)
      const [rows] = await db.query('SELECT label, start_year FROM academic_years ORDER BY start_year');
      return shape(rows);
    }
    if (NOT_MIGRATED.has(error && error.code)) return null;
    throw error;
  }
}

const currentOf = (years) => (years || []).find((y) => y.isCurrent) || null;

// The years this person may see: all of them for an administrator, otherwise the current year and the previous one.
function visibleOf(years, user) {
  const current = currentOf(years);
  if (!years || !current || isAdmin(user)) return years || [];
  const previous = years.filter((y) => y.startYear < current.startYear).slice(-1);
  return [...previous, current];
}

// What a list should be filtered by, from the `year` the screen asked for.
//   { labels: null }        no filtering (not migrated, or an administrator asked for 'all')
//   { labels: ['2027–2028'], current: '2027–2028' }  those years (the current one when nothing was asked)
// A year this person may not see is refused with 403.
async function resolveYear(db, user, requested) {
  const years = await loadYears(db);
  const current = currentOf(years);
  if (!current) return { labels: null, current: null };
  const asked = typeof requested === 'string' ? requested.trim() : '';
  const visible = visibleOf(years, user);
  if (!asked) return { labels: [current.label], current: current.label };
  if (asked === 'all') return { labels: isAdmin(user) ? null : visible.map((y) => y.label), current: current.label };
  if (!visible.some((y) => y.label === asked)) throw httpError(403, 'That academic year is not available to you.', { code: 'year_not_allowed' });
  return { labels: [asked], current: current.label };
}

// " AND COALESCE(s.academic_year, ?) IN (?)" for a resolved scope ('' when nothing is filtered). A syllabus without a year counts as the current year.
function yearClause(scope, column = 's.academic_year') {
  if (!scope || !scope.labels) return { sql: '', params: [] };
  return { sql: ` AND COALESCE(${column}, ?) IN (?)`, params: [scope.current, scope.labels] };
}

// The label a new syllabus is stamped with, or null before the migration.
async function currentLabel(db) { const current = currentOf(await loadYears(db)); return current ? current.label : null; }

// The one-syllabus-per-subject rule is per academic year. These are the rows of a person's syllabi on a subject that count against a draft: those of the SAME year as the
// syllabus being saved (`exceptId`; with none, the current year). `sql` is a complete query ending in the archived filter; the year condition and its three parameters are
// appended. With no current year (not migrated) or a database without the column, the old query without a year condition runs.
async function queryInSameYear(db, sql, params, exceptId) {
  const current = await currentLabel(db);
  if (!current) return db.query(sql, params);
  try {
    return await db.query(sql + ' AND COALESCE(academic_year, ?) = COALESCE((SELECT y.academic_year FROM syllabi y WHERE y.syllabus_id = ?), ?)', [...params, current, exceptId || 0, current]);
  } catch (error) { if (error && error.code === 'ER_BAD_FIELD_ERROR') return db.query(sql, params); throw error; }
}

// ---- the catalog (programs, and through them subjects) belongs to an academic year ----------------------------------------------------------------------------
// programs.academic_year (migrate-catalog-year). A program without a year counts as the current year. A new academic year starts with no programs and no subjects, and a
// past year's catalog can be looked at but not changed. Before the migration (or with no current year) nothing is scoped, so every query keeps its old text.
const probes = new WeakMap();
async function catalogColumnReady(db) {
  const hit = probes.get(db);
  if (hit && Date.now() - hit.at < 15000) return hit.ready;
  let ready = true;
  try { await db.query('SELECT academic_year FROM programs LIMIT 0'); } catch (error) { if (error && error.code === 'ER_BAD_FIELD_ERROR') ready = false; else throw error; }
  probes.set(db, { at: Date.now(), ready });
  return ready;
}

// { scoped: false } or { scoped: true, current, label, readOnly }. `requested` is the year a screen asks for: none or 'all' means the current one (a catalog is never a mix of
// years); an administrator may ask for any year, everyone else only for the current and the previous one (403 otherwise).
async function catalogYear(db, user, requested) {
  const years = await loadYears(db);
  const current = currentOf(years);
  if (!current || !(await catalogColumnReady(db))) return { scoped: false };
  const asked = typeof requested === 'string' ? requested.trim() : '';
  let label = current.label;
  if (asked && asked !== 'all') {
    if (!visibleOf(years, user).some((y) => y.label === asked)) throw httpError(403, 'That academic year is not available to you.', { code: 'year_not_allowed' });
    label = asked;
  }
  return { scoped: true, current: current.label, label, readOnly: label !== current.label };
}

// " AND COALESCE(p.academic_year, ?) = ?" for a scoped catalog ('' when not scoped).
function programYearClause(scope, alias = 'p') {
  if (!scope || !scope.scoped) return { sql: '', params: [] };
  return { sql: ` AND COALESCE(${alias}.academic_year, ?) = ?`, params: [scope.current, scope.label] };
}

const readOnlyError = (year) => httpError(403, `The ${year} catalog is view only. Only the current academic year can be changed.`, { code: 'catalog_year_read_only' });
// A program (and so its subjects, outcomes and CLOs) of a past academic year cannot be changed.
async function assertCatalogEditable(db, programId) {
  const years = await loadYears(db);
  const current = currentOf(years);
  if (!current || !(await catalogColumnReady(db))) return;
  const [rows] = await db.query('SELECT COALESCE(academic_year, ?) AS year FROM programs WHERE program_id = ?', [current.label, programId]);
  if (rows[0] && rows[0].year !== current.label) throw readOnlyError(rows[0].year);
}
// The same for a subject, through its program.
async function assertSubjectEditable(db, courseId) {
  const years = await loadYears(db);
  const current = currentOf(years);
  if (!current || !(await catalogColumnReady(db))) return;
  const [rows] = await db.query('SELECT COALESCE(p.academic_year, ?) AS year FROM courses c JOIN programs p ON p.program_id = c.program_id WHERE c.course_id = ?', [current.label, courseId]);
  if (rows[0] && rows[0].year !== current.label) throw readOnlyError(rows[0].year);
}

// { scoped: false } or { scoped: true, current, year }: the academic year a program belongs to (a program without one counts as the current year). Used where programs are
// compared with each other: only programs of the SAME year can clash on a name or a code.
async function programYear(db, programId) {
  const current = currentOf(await loadYears(db));
  if (!current || !(await catalogColumnReady(db))) return { scoped: false };
  const [rows] = await db.query('SELECT COALESCE(academic_year, ?) AS year FROM programs WHERE program_id = ?', [current.label, programId]);
  return { scoped: true, current: current.label, year: rows[0] ? rows[0].year : current.label };
}

// The program a syllabus belongs to, by id: the program of its subject (syllabi.course_id, else the course in its content). The catalog is per academic year and the same
// code can exist in several years, so the CODE in a syllabus's content is not enough to find the right program: a 2026–2027 syllabus must keep being checked against its own
// year's outcomes. Returns the program id, or null when the catalog is not year-scoped or the syllabus has no subject (the caller then falls back to the code).
async function programIdOfSyllabus(db, { syllabusId, courseId }) {
  if (!currentOf(await loadYears(db)) || !(await catalogColumnReady(db))) return null;
  let id = Number.isInteger(courseId) ? courseId : null;
  if (syllabusId) { const [rows] = await db.query('SELECT course_id FROM syllabi WHERE syllabus_id = ?', [syllabusId]); if (rows[0] && rows[0].course_id) id = rows[0].course_id; }
  if (!id) return null;
  const [rows] = await db.query('SELECT program_id FROM courses WHERE course_id = ?', [id]);
  return rows[0] ? rows[0].program_id : null;
}

// The ids of the subjects that belong to a PAST academic year's catalog (empty when the catalog is not year-scoped). Used to leave them out of what is "current": the
// reminders, the assignment screen, the student course match.
async function pastCourseIds(db) {
  const current = currentOf(await loadYears(db));
  if (!current || !(await catalogColumnReady(db))) return new Set();
  const [rows] = await db.query('SELECT c.course_id FROM courses c JOIN programs p ON p.program_id = c.program_id WHERE COALESCE(p.academic_year, ?) <> ?', [current.label, current.label]);
  return new Set(rows.map((r) => r.course_id));
}

async function pastProgramIds(db) {
  const current = currentOf(await loadYears(db));
  if (!current || !(await catalogColumnReady(db))) return new Set();
  const [rows] = await db.query('SELECT program_id FROM programs WHERE COALESCE(academic_year, ?) <> ?', [current.label, current.label]);
  return new Set(rows.map((r) => r.program_id));
}

// { '2026–2027': { programs: 2, subjects: 14 } } for the administrator's year list ("already used"). Empty when the catalog is not year-scoped.
async function catalogCounts(db) {
  const current = currentOf(await loadYears(db));
  if (!current || !(await catalogColumnReady(db))) return {};
  const counts = {};
  const [programs] = await db.query('SELECT COALESCE(academic_year, ?) AS year, COUNT(*) AS n FROM programs GROUP BY COALESCE(academic_year, ?)', [current.label, current.label]);
  for (const r of programs) counts[r.year] = { programs: Number(r.n), subjects: 0 };
  const [subjects] = await db.query('SELECT COALESCE(p.academic_year, ?) AS year, COUNT(*) AS n FROM courses c JOIN programs p ON p.program_id = c.program_id GROUP BY COALESCE(p.academic_year, ?)', [current.label, current.label]);
  for (const r of subjects) { counts[r.year] = counts[r.year] || { programs: 0, subjects: 0 }; counts[r.year].subjects = Number(r.n); }
  return counts;
}

module.exports = { catalogCounts, pastProgramIds, pastCourseIds, programIdOfSyllabus, programYear, catalogYear, programYearClause, assertCatalogEditable, assertSubjectEditable, catalogColumnReady, queryInSameYear, isAdmin, loadYears, currentOf, visibleOf, resolveYear, yearClause, currentLabel };
