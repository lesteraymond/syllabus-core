'use strict';
// Institutional policy: the AI Checker performs NEW checks only for syllabi of the active academic year (the Admin chooses it: PUT /api/academic-years/current).
// Viewing a syllabus and its saved reports is never restricted; only new checks, the AI steps that go with them, and the runs they store are.
// The active year is read from academic_years every time (never cached), first before any AI request, then again under a shared lock in the transaction that
// stores the result: switching the active year updates those rows, so a switch either waits for the store to commit or, if it committed first, makes it refuse.
const { httpError } = require('./http');

const CODE = 'inactive_academic_year';
const MESSAGES = {
  inactive: (active, year) => `AI Checking is only available for the currently active Academic Year (${active}). The Admin must activate ${year} before a new AI Check can be performed on this syllabus.`,
  none: 'No Academic Year is active, so no new AI Check can be performed. The Admin must activate an Academic Year first.',
  unset: 'This syllabus has no recorded Academic Year, so a new AI Check cannot be performed on it.',
};

async function activeYear(db, { lock = false } = {}) {
  try {
    const [rows] = await db.query('SELECT label FROM academic_years WHERE is_current = 1' + (lock ? ' LOCK IN SHARE MODE' : ''));
    return rows.length === 1 ? rows[0].label : null;
  } catch (error) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR')) return null; // years exist but none is marked current yet: none is active
    throw error;
  }
}

// syl: the syllabus row read with SELECT *. A database from before the academic-year scope has no academic_year column, so there is nothing to compare: as before.
// Throws 409 inactive_academic_year, or returns the active year.
async function assertActiveYear(db, syl, options = {}) {
  if (!syl || !Object.prototype.hasOwnProperty.call(syl, 'academic_year')) return null;
  const active = await activeYear(db, options);
  if (!active) throw httpError(409, MESSAGES.none, { code: CODE, activeYear: null, syllabusYear: syl.academic_year || null });
  if (!syl.academic_year) throw httpError(409, MESSAGES.unset, { code: CODE, activeYear: active, syllabusYear: null });
  if (syl.academic_year !== active) throw httpError(409, MESSAGES.inactive(active, syl.academic_year), { code: CODE, activeYear: active, syllabusYear: syl.academic_year });
  return active;
}

// ---- editing ----
// A syllabus of an academic year that is no longer the active one is a record: it can be viewed, never edited (owner decision 2026-11-23, after the E2E report's
// BUG-010; the same rule as the Curriculum screen, where a past year is view only). Unlike a new AI check, a syllabus with no recorded year, or a server with no
// active year, is NOT refused here: nothing says it belongs to a past year.
const PAST_CODE = 'past_academic_year';
const PAST_MESSAGE = (year, active) => `This syllabus belongs to the ${year} academic year, which is no longer active (${active} is). It is kept as a record and can only be viewed.`;

// syl: a syllabus row. Its academic_year is used when the row has it; otherwise it is read (a database from before the column: nothing is past).
// -> { year, active } when the syllabus is of another year than the active one, else null.
async function pastYearOf(db, syl, { lock = false } = {}) {
  if (!syl) return null;
  let year;
  if (Object.prototype.hasOwnProperty.call(syl, 'academic_year')) year = syl.academic_year;
  else {
    try { const [rows] = await db.query('SELECT academic_year FROM syllabi WHERE syllabus_id = ?', [syl.syllabus_id]); year = rows && rows[0] ? rows[0].academic_year : null; }
    catch (error) { if (error && error.code === 'ER_BAD_FIELD_ERROR') return null; throw error; }
  }
  if (!year) return null;
  const active = await activeYear(db, { lock });
  return active && year !== active ? { year, active } : null;
}
// Throws 409 past_academic_year when the syllabus is of a past academic year.
async function assertEditableYear(db, syl, options = {}) {
  const past = await pastYearOf(db, syl, options);
  if (past) throw httpError(409, PAST_MESSAGE(past.year, past.active), { code: PAST_CODE, activeYear: past.active, syllabusYear: past.year });
}

module.exports = { CODE, MESSAGES, activeYear, assertActiveYear, PAST_CODE, PAST_MESSAGE, pastYearOf, assertEditableYear };
