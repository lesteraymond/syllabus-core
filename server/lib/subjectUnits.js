'use strict';
// A subject's credit units (lecture and laboratory), set by an administrator (courses.lecture_units, courses.lab_units). Faculty cannot change them: routes/syllabusContent.js
// copies them into a syllabus's Step 1 on every save (applyUnits). On a subject without units (made before the form had them) faculty cannot type them either: the draft
// keeps what it had (keepUnits), and the units are not checked. Added by `npm run migrate-subject-units`; until then the columns are absent and everything here degrades to "not set" (reads) or a 503 that names the migration (writes).
const { httpError } = require('./http');

const COLUMNS = 'c.lecture_units, c.lab_units';
const MIGRATION_MESSAGE = "Run npm run migrate-subject-units before setting a subject's units.";
const MAX_UNITS = 30;
const INVALID = `Enter the lecture and laboratory units as numbers from 0 to ${MAX_UNITS}, with at most one decimal, for example 2 and 1. At least one of them must be more than 0.`;

const empty = (v) => v === undefined || v === null || (typeof v === 'string' && !v.trim());
function unitOf(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (!/^\d{1,2}(\.\d)?$/.test(String(value).trim())) return null;
  const n = Number(value);
  return n <= MAX_UNITS ? n : null;
}

// The units of a request body: undefined when neither was sent (leave the subject as it is), null when both were sent empty (clear them), else { lecture, lab }. 400 otherwise.
function parseUnits(body) {
  const b = body || {};
  if (b.lecture === undefined && b.lab === undefined) return undefined;
  if (empty(b.lecture) && empty(b.lab)) return null;
  const lecture = unitOf(b.lecture), lab = unitOf(b.lab);
  if (lecture === null || lab === null || lecture + lab === 0) throw httpError(400, INVALID);
  return { lecture, lab };
}

// { lecture, lab } as numbers (the database keeps decimals as text), or null while the administrator has not set them.
function unitsOf(row) {
  if (!row || row.lecture_units == null || row.lab_units == null) return null;
  return { lecture: Number(row.lecture_units), lab: Number(row.lab_units) };
}

async function saveUnits(db, courseId, units) {
  try { await db.query('UPDATE courses SET lecture_units = ?, lab_units = ? WHERE course_id = ?', [units ? units.lecture : null, units ? units.lab : null, courseId]); }
  catch (error) { if (error && error.code === 'ER_BAD_FIELD_ERROR') throw httpError(503, MIGRATION_MESSAGE); throw error; }
}

// Step 1 keeps units as text ("2"). A subject without units leaves the draft's (see keepUnits for faculty).
function applyUnits(meta, units) {
  if (!meta || !units) return meta;
  meta.lecture = String(units.lecture);
  meta.lab = String(units.lab);
  return meta;
}

// Faculty save on a subject without units: the units the stored draft of this subject had, or none (`stored`: its Step 1, null for another subject).
function keepUnits(meta, stored) {
  meta.lecture = String((stored && stored.lecture) ?? '');
  meta.lab = String((stored && stored.lab) ?? '');
  return meta;
}

module.exports = { keepUnits, COLUMNS, MIGRATION_MESSAGE, MAX_UNITS, parseUnits, unitsOf, saveUnits, applyUnits };
