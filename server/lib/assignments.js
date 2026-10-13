// Faculty assignments: which programs and courses an admin has given a faculty member.
// A faculty member may create and edit a syllabus only for an assigned course; admins are never restricted.
//
// The rules are pure functions over a plain `assignments` object ({ programIds: [], courseIds: [] }), so they are
// unit-tested without a database. Only loadAssignments / saveAssignments touch MySQL.
//
// Invariants (kept by normalizeAssignments and saveAssignments):
//   - a course is assigned only if its program is assigned to the same user;
//   - removing a program removes that program's courses for that user, in the same transaction;
//   - only users with role 'faculty' are assignable.

const MAX_PROGRAMS = 20;
const MAX_COURSES = 200;

// "Subject" is the catalog item (IT 204, Programming 2). In this school a "course" is the program, so the messages
// say subject. The code keeps the older names (courses, courseId, faculty_courses) to avoid renaming the architecture.
const NOT_ASSIGNED = 'This subject is not assigned to you. Ask an administrator.';
const NOTHING_ASSIGNED = 'No program or subject is assigned to you yet. Ask an administrator.';
const NO_SUBJECT_YET = 'A program is assigned to you, but no subject yet. Ask an administrator.';

const EMPTY = Object.freeze({ programIds: Object.freeze([]), courseIds: Object.freeze([]) });

const assignedProgramIds = (a) => (a && a.programIds) || [];
const assignedCourseIds = (a) => (a && a.courseIds) || [];

const isFaculty = (user) => !!user && user.role === 'faculty';
const isAdmin = (user) => !!user && user.role === 'admin';

const canUseCourse = (a, courseId) => Number.isInteger(courseId) && assignedCourseIds(a).includes(courseId);
const hasAnyAssignment = (a) => assignedCourseIds(a).length > 0;

// May `user` write (save content, submit, edit) a syllabus for `courseId`?
//  - admins: always (they never edit content in routes, but they are never restricted by assignments);
//  - faculty: the course must be assigned. With no course chosen yet (courseId null) a faculty member needs at
//    least one assigned course, so someone with no assignments cannot start a syllabus at all.
function mayWriteSyllabus(user, a, courseId) {
  if (isAdmin(user)) return true;
  if (!isFaculty(user)) return false;
  if (courseId === null || courseId === undefined) return hasAnyAssignment(a);
  return canUseCourse(a, Number(courseId));
}

// Nothing usable is assigned: say whether even a program is missing, or only the subjects.
const nothingUsableReason = (a) => (assignedProgramIds(a).length ? NO_SUBJECT_YET : NOTHING_ASSIGNED);

// The message to show when mayWriteSyllabus is false.
function writeBlockedReason(user, a, courseId) {
  if (mayWriteSyllabus(user, a, courseId)) return null;
  return (courseId === null || courseId === undefined) && !hasAnyAssignment(a) ? nothingUsableReason(a) : NOT_ASSIGNED;
}

const bad = (message) => Object.assign(new Error(message), { status: 400 });

function idList(raw, what, max) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw bad(`${what} must be a list of ids`);
  const ids = raw.map((x) => (typeof x === 'string' && /^\d+$/.test(x) ? Number(x) : x));
  if (ids.some((x) => !Number.isInteger(x) || x <= 0)) throw bad(`${what} must be a list of ids`);
  const unique = [...new Set(ids)];
  if (unique.length > max) throw bad(`Too many ${what} (max ${max})`);
  return unique;
}

// Validates a request body against the catalog and returns the lists to store.
//   input   { programs: [ids], courses: [ids] }
//   catalog { programs: [{ id }], courses: [{ id, programId }] }  (what exists right now)
// Unknown ids are an error. A course whose program is not in `programs` is dropped (and reported in `dropped`),
// which is how "removing a program removes its courses" falls out of one save.
function normalizeAssignments(input, catalog) {
  const body = input || {};
  const programs = idList(body.programs, 'programs', MAX_PROGRAMS);
  const courses = idList(body.courses, 'courses', MAX_COURSES);
  const programIds = new Set(catalog.programs.map((p) => p.id));
  const courseProgram = new Map(catalog.courses.map((c) => [c.id, c.programId]));
  if (programs.some((id) => !programIds.has(id))) throw bad('One of the programs does not exist');
  if (courses.some((id) => !courseProgram.has(id))) throw bad('One of the courses does not exist');
  const chosen = new Set(programs);
  const kept = courses.filter((id) => chosen.has(courseProgram.get(id)));
  return {
    programIds: programs.slice().sort((a, b) => a - b),
    courseIds: kept.slice().sort((a, b) => a - b),
    dropped: courses.filter((id) => !chosen.has(courseProgram.get(id))),
  };
}

// ---- database ----

async function loadAssignments(db, userId) {
  const [progs] = await db.query('SELECT program_id FROM faculty_programs WHERE user_id = ? ORDER BY program_id', [userId]);
  const [courses] = await db.query('SELECT course_id FROM faculty_courses WHERE user_id = ? ORDER BY course_id', [userId]);
  return { programIds: progs.map((r) => r.program_id), courseIds: courses.map((r) => r.course_id) };
}

// What exists in the catalog, for normalizeAssignments.
async function loadCatalogIds(db) {
  const [programs] = await db.query('SELECT program_id FROM programs');
  const [courses] = await db.query('SELECT course_id, program_id FROM courses');
  return { programs: programs.map((p) => ({ id: p.program_id })), courses: courses.map((c) => ({ id: c.course_id, programId: c.program_id })) };
}

// ---- guards used by the routes ----
// Both take a db pool or a transaction connection and throw an error with status 403 when the write is not allowed.
// Admins pass without a query.
const forbidden = (message) => Object.assign(new Error(message), { status: 403 });

// Builder syllabi: the course is a catalog id (null while none is chosen yet).
async function requireCourseAccess(db, user, courseId) {
  if (isAdmin(user)) return;
  const reason = writeBlockedReason(user, await loadAssignments(db, user.id), courseId === undefined ? null : courseId);
  if (reason) throw forbidden(reason);
}

// Legacy syllabi: the course is free text, so it must match the code of an assigned course.
async function requireCourseCodeAccess(db, user, code) {
  if (isAdmin(user)) return;
  if (!isFaculty(user)) throw forbidden(NOT_ASSIGNED);
  const text = String(code || '').trim();
  if (text) {
    const [rows] = await db.query(
      'SELECT 1 FROM faculty_courses fc JOIN courses c ON c.course_id = fc.course_id WHERE fc.user_id = ? AND LOWER(c.code) = LOWER(?) LIMIT 1',
      [user.id, text]
    );
    if (rows.length) return;
  }
  const a = await loadAssignments(db, user.id);
  throw forbidden(hasAnyAssignment(a) ? NOT_ASSIGNED : nothingUsableReason(a));
}

// Names for the ids, for the admin screen and the faculty member's own view:
// { programIds, courseIds, programs: [{ id, code, name }], courses: [{ id, code, title, program, programId }] }
async function describeAssignments(db, a) {
  const programIds = assignedProgramIds(a);
  const courseIds = assignedCourseIds(a);
  const [programs] = programIds.length ? await db.query('SELECT program_id, code, name FROM programs WHERE program_id IN (?) ORDER BY code', [programIds]) : [[]];
  const [courses] = courseIds.length
    ? await db.query('SELECT c.course_id, c.code, c.title, c.program_id, p.code AS program_code FROM courses c JOIN programs p ON p.program_id = c.program_id WHERE c.course_id IN (?) ORDER BY c.code', [courseIds])
    : [[]];
  return {
    programIds, courseIds,
    programs: programs.map((p) => ({ id: p.program_id, code: p.code, name: p.name })),
    courses: courses.map((c) => ({ id: c.course_id, code: c.code, title: c.title, program: c.program_code, programId: c.program_id })),
  };
}

// Replaces a user's assignments with the already-normalized lists. Pass a transaction connection as `conn`.
async function saveAssignments(conn, userId, { programIds, courseIds }) {
  await conn.query('DELETE FROM faculty_courses WHERE user_id = ?', [userId]);
  await conn.query('DELETE FROM faculty_programs WHERE user_id = ?', [userId]);
  if (programIds.length) await conn.query('INSERT INTO faculty_programs (user_id, program_id) VALUES ?', [programIds.map((p) => [userId, p])]);
  if (courseIds.length) await conn.query('INSERT INTO faculty_courses (user_id, course_id) VALUES ?', [courseIds.map((c) => [userId, c])]);
}

module.exports = {
  MAX_PROGRAMS, MAX_COURSES, NOT_ASSIGNED, NOTHING_ASSIGNED, NO_SUBJECT_YET, EMPTY,
  assignedProgramIds, assignedCourseIds, canUseCourse, hasAnyAssignment,
  mayWriteSyllabus, writeBlockedReason, normalizeAssignments,
  loadAssignments, loadCatalogIds, describeAssignments, saveAssignments,
  requireCourseAccess, requireCourseCodeAccess,
};
