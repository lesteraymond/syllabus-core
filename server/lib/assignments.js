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
      'SELECT 1 FROM faculty_courses fc JOIN courses c ON c.course_id = fc.course_id WHERE fc.user_id = ? AND LOWER(c.code) = LOWER(?) LIMIT 1 FOR UPDATE',
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

// One subject has at most one faculty member (programs can be shared by many). Who holds which subject, for the admin screen:
// [{ courseId, userId, name }].
async function subjectHolders(db) {
  const [rows] = await db.query(
    'SELECT fc.course_id, fc.user_id, u.first_name, u.last_name FROM faculty_courses fc JOIN users u ON u.user_id = fc.user_id ORDER BY fc.course_id');
  return rows.map((r) => ({ courseId: r.course_id, userId: r.user_id, name: (r.first_name + ' ' + r.last_name).trim() }));
}

// Refuses the save when any of `courseIds` is held by another faculty member. Call it in the same transaction as saveAssignments; the rows
// are locked so two admins saving at once cannot both take the subject (the unique key on course_id is the last safety net).
// -> throws a 409 that names each subject and its holder; nothing has been changed yet.
async function assertSubjectsFree(conn, userId, courseIds) {
  if (!courseIds.length) return;
  const [rows] = await conn.query(
    `SELECT fc.course_id, c.code, u.first_name, u.last_name FROM faculty_courses fc JOIN courses c ON c.course_id = fc.course_id
     JOIN users u ON u.user_id = fc.user_id WHERE fc.course_id IN (?) AND fc.user_id <> ? ORDER BY c.code FOR UPDATE`, [courseIds, userId]);
  if (!rows.length) return;
  const held = rows.map((r) => ({ courseId: r.course_id, code: r.code, holder: (r.first_name + ' ' + r.last_name).trim() }));
  const first = held[0];
  const message = first.code + ' is already assigned to ' + first.holder + '. Remove it from them first; a subject has one faculty member.'
    + (held.length > 1 ? ' (' + (held.length - 1) + ' more subject' + (held.length > 2 ? 's' : '') + ' are also taken.)' : '');
  throw Object.assign(new Error(message), { status: 409, body: { code: 'subject_taken', conflicts: held } });
}

// A subject given to a faculty member is theirs to write now. What other faculty members wrote for it before is archived: it keeps its
// owner (so the name on it stays the former faculty member's), its versions and its logs, becomes read-only, and leaves the working
// lists. This runs when the subject is given, not when it is taken away, so removing a subject from someone and then adding it back to
// them loses nothing; and when it is given back to the person it was archived from, that syllabus returns (restoreReturned). Administrators' own syllabi are not touched. Returns how many were archived.
async function archiveReassigned(conn, userId, courseIds) {
  if (!courseIds.length) return 0;
  const [result] = await conn.query(
    `UPDATE syllabi s JOIN users o ON o.user_id = s.user_id SET s.archived_at = NOW()
     WHERE s.course_id IN (?) AND s.user_id <> ? AND s.archived_at IS NULL AND o.role = 'faculty'`, [courseIds, userId]);
  return result && result.affectedRows ? result.affectedRows : 0;
}

// The other half: a subject given back to a faculty member whose syllabus was archived when it went elsewhere brings that syllabus back,
// so they carry on from where they were. A subject has one syllabus for each person, and a person can have several archived on one subject
// (from before that rule), so exactly one returns for each subject: a submitted-or-later one before a draft, then the most recently
// changed. The rest stay archived as history. A subject on which the person already has an active syllabus brings nothing back.
// `archived` are the person's archived rows on those subjects ({ syllabus_id, course_id, status, updated_at }); `activeCourseIds` the
// subjects where they already have an active one. -> the syllabus ids to bring back.
function pickRestorable(archived, activeCourseIds = []) {
  const active = new Set(activeCourseIds);
  const stamp = (r) => { const t = new Date(r.updated_at).getTime(); return Number.isFinite(t) ? t : 0; };
  const rank = (r) => [r.status === 'draft' ? 0 : 1, stamp(r), r.syllabus_id];
  const better = (a, b) => { const x = rank(a); const y = rank(b); return x[0] !== y[0] ? x[0] > y[0] : x[1] !== y[1] ? x[1] > y[1] : x[2] > y[2]; };
  const best = new Map();
  for (const r of archived || []) {
    if (active.has(r.course_id)) continue;
    if (!best.has(r.course_id) || better(r, best.get(r.course_id))) best.set(r.course_id, r);
  }
  return [...best.values()].map((r) => r.syllabus_id);
}

async function restoreReturned(conn, userId, courseIds) {
  if (!courseIds.length) return [];
  const [archived] = await conn.query(
    'SELECT syllabus_id, course_id, status, updated_at FROM syllabi WHERE course_id IN (?) AND user_id = ? AND archived_at IS NOT NULL', [courseIds, userId]);
  if (!Array.isArray(archived) || !archived.length) return [];
  const [active] = await conn.query('SELECT DISTINCT course_id FROM syllabi WHERE course_id IN (?) AND user_id = ? AND archived_at IS NULL', [courseIds, userId]);
  const ids = pickRestorable(archived, (Array.isArray(active) ? active : []).map((r) => r.course_id));
  if (ids.length) await conn.query('UPDATE syllabi SET archived_at = NULL WHERE syllabus_id IN (?)', [ids]);
  return ids;
}

// Replaces a user's assignments with the already-normalized lists. Pass a transaction connection as `conn`.
async function saveAssignments(conn, userId, { programIds, courseIds }) {
  const [before] = await conn.query('SELECT course_id FROM faculty_courses WHERE user_id = ?', [userId]);
  const had = new Set((before || []).map((r) => r.course_id));
  const added = courseIds.filter((id) => !had.has(id));
  await conn.query('DELETE FROM faculty_courses WHERE user_id = ?', [userId]);
  await conn.query('DELETE FROM faculty_programs WHERE user_id = ?', [userId]);
  if (programIds.length) await conn.query('INSERT INTO faculty_programs (user_id, program_id) VALUES ?', [programIds.map((p) => [userId, p])]);
  if (courseIds.length) await conn.query('INSERT INTO faculty_courses (user_id, course_id) VALUES ?', [courseIds.map((c) => [userId, c])]);
  await archiveReassigned(conn, userId, added); // what others wrote for the subjects now given goes away ...
  await restoreReturned(conn, userId, added); // ... and what this person wrote for them earlier comes back
}

module.exports = {
  MAX_PROGRAMS, MAX_COURSES, NOT_ASSIGNED, NOTHING_ASSIGNED, NO_SUBJECT_YET, EMPTY,
  assignedProgramIds, assignedCourseIds, canUseCourse, hasAnyAssignment,
  mayWriteSyllabus, writeBlockedReason, normalizeAssignments,
  loadAssignments, loadCatalogIds, describeAssignments, saveAssignments, archiveReassigned, restoreReturned, pickRestorable, subjectHolders, assertSubjectsFree,
  requireCourseAccess, requireCourseCodeAccess,
};
