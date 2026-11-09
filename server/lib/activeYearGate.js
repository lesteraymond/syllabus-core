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

module.exports = { CODE, MESSAGES, activeYear, assertActiveYear };
