// Subject submission deadlines: the rules and the queries. The rules are pure functions (tested without a database); the queries read
// the assignments and the submission history that already exist, so a requirement's status is worked out each time and never stored.
//
//   A deadline belongs to a subject and a term, and applies to every faculty member assigned to that subject: each one has their own
//   requirement. A submission is the first non-draft version the faculty member saved for that subject at or after the deadline's
//   `opens_at`. Late submissions stay allowed: they show as "submitted_late" and permissions are never touched. A deadline tracks
//   submission, not approval.
//
//   Statuses: upcoming -> due_today -> failed (past due, nothing submitted) ; submitted (on time) ; submitted_late.
// Days are Philippine days (UTC+8, no daylight saving), like the rest of the app. Times are read as epoch seconds (UNIX_TIMESTAMP) and
// written with FROM_UNIXTIME, so the database server's time zone cannot shift a deadline.

const { httpError } = require('./http');
const { pastCourseIds } = require('./academicYear');

const TERM_MAX = 30;
const INSTRUCTIONS_MAX = 1000;
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;
const STATUSES = ['upcoming', 'due_today', 'failed', 'submitted', 'submitted_late'];

const phDay = (ms) => new Date(ms + PH_OFFSET_MS).toISOString().slice(0, 10);
const iso = (ms) => (ms === null || ms === undefined ? null : new Date(ms).toISOString());
const secs = (ms) => Math.floor(ms / 1000);
const fromSecs = (value) => (value === null || value === undefined ? null : Number(value) * 1000);

// What state is one requirement in? Times are milliseconds; submittedAt is null when nothing has been submitted.
function statusOf({ now, dueAt, submittedAt = null }) {
  if (submittedAt !== null && submittedAt !== undefined) return submittedAt <= dueAt ? 'submitted' : 'submitted_late';
  if (now > dueAt) return 'failed';
  return phDay(now) === phDay(dueAt) ? 'due_today' : 'upcoming';
}

// How the requirements of one deadline add up. Waiting = still has time; failed = past due with nothing submitted.
function summarize(statuses) {
  const count = (name) => statuses.filter((s) => s === name).length;
  return {
    total: statuses.length,
    submitted: count('submitted'),
    late: count('submitted_late'),
    waiting: count('upcoming') + count('due_today'),
    failed: count('failed'),
  };
}

// A deadline is settled when it has faculty and every one of them has submitted (on time or late): nothing is left to wait for or chase.
// Worked out from the numbers each time, never stored, so a faculty member assigned later reopens it by themselves.
const isSettled = (summary) => !!summary && summary.total > 0 && summary.waiting === 0 && summary.failed === 0 && summary.submitted + summary.late === summary.total;

// The administrator's form -> clean values (milliseconds). `existing` is the deadline being edited: an unchanged past due date is allowed
// (someone fixing the instructions of a deadline that has since passed), a new one must be in the future.
function readInput(body, now, existing = null) {
  const b = body || {};
  if (typeof b.term !== 'string' || !b.term.trim()) throw httpError(400, 'Term is required.');
  if (b.term.trim().length > TERM_MAX) throw httpError(400, `Term is too long (max ${TERM_MAX} characters).`);
  const dueAt = typeof b.dueAt === 'number' ? b.dueAt : Date.parse(b.dueAt);
  if (!Number.isFinite(dueAt)) throw httpError(400, 'The due date and time are not valid.');
  const keepsDue = existing && secs(existing.dueAt) === secs(dueAt);
  if (dueAt <= now && !keepsDue) throw httpError(400, 'The due date must be in the future.');
  let opensAt = now;
  if (b.opensAt !== undefined && b.opensAt !== null && b.opensAt !== '') {
    opensAt = typeof b.opensAt === 'number' ? b.opensAt : Date.parse(b.opensAt);
    if (!Number.isFinite(opensAt)) throw httpError(400, 'The date submissions start counting is not valid.');
  } else if (existing) opensAt = existing.opensAt;
  if (opensAt >= dueAt) throw httpError(400, 'The due date must be after the date submissions start counting.');
  let instructions = null;
  if (b.instructions !== undefined && b.instructions !== null && String(b.instructions).trim()) {
    instructions = String(b.instructions).trim();
    if (instructions.length > INSTRUCTIONS_MAX) throw httpError(400, `Instructions are too long (max ${INSTRUCTIONS_MAX} characters).`);
  }
  return { term: b.term.trim(), dueAt, opensAt, instructions };
}

// ---- queries -------------------------------------------------------------------------------------------------------------------------

const SELECT = `SELECT d.deadline_id, d.course_id, d.term, UNIX_TIMESTAMP(d.due_at) AS due, UNIX_TIMESTAMP(d.opens_at) AS opens, d.instructions,
  UNIX_TIMESTAMP(d.created_at) AS created, UNIX_TIMESTAMP(d.cancelled_at) AS cancelled, c.code AS course_code, c.title AS course_title, p.code AS program_code
  FROM subject_deadlines d JOIN courses c ON c.course_id = d.course_id JOIN programs p ON p.program_id = c.program_id`;

const shape = (r) => ({
  id: r.deadline_id, courseId: r.course_id, term: r.term, dueAt: fromSecs(r.due), opensAt: fromSecs(r.opens), instructions: r.instructions || '',
  createdAt: fromSecs(r.created), cancelled: r.cancelled !== null && r.cancelled !== undefined,
  course: { code: r.course_code, title: r.course_title, program: r.program_code },
});
const publicForm = (d) => ({ ...d, dueAt: iso(d.dueAt), opensAt: iso(d.opensAt), createdAt: iso(d.createdAt) });

async function loadDeadline(db, id) {
  const [rows] = await db.query(SELECT + ' WHERE d.deadline_id = ?', [id]);
  return rows.length ? shape(rows[0]) : null;
}

// Faculty assigned to the subject, and when each first submitted at or after opens_at (null if they have not).
// Who a deadline is for: whoever the subject is assigned to (faculty, or an administrator, who can be assigned subjects too), and an administrator who
// is writing a syllabus for the subject without having it assigned (the dean writes syllabi). Sorted by name, each person once.
async function peopleOf(db, courseId) {
  const [assigned] = await db.query(
    `SELECT fc.user_id, u.first_name, u.last_name, u.role FROM faculty_courses fc JOIN users u ON u.user_id = fc.user_id
     WHERE fc.course_id = ? AND u.role IN ('faculty', 'admin') ORDER BY u.last_name, u.first_name`, [courseId]);
  const [authors] = await db.query(
    `SELECT DISTINCT s.user_id, u.first_name, u.last_name, u.role FROM syllabi s JOIN users u ON u.user_id = s.user_id
     WHERE s.course_id = ? AND u.role = 'admin' AND s.archived_at IS NULL`, [courseId]);
  const byId = new Map();
  for (const p of [...assigned, ...authors]) if (!byId.has(p.user_id)) byId.set(p.user_id, p);
  return [...byId.values()].sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`));
}

// When an administrator's own syllabus for the subject was first SENT FOR REVIEW (its 'submit' log), since the deadline opened. For an administrator
// a saved version does not mean submitted: checking their own syllabus in the AI Checker saves one before they send it. -> Map(userId -> ms)
async function adminSubmissions(db, courseId, opensAt, userIds) {
  if (!userIds.length) return new Map();
  const [rows] = await db.query(
    `SELECT s.user_id, MIN(UNIX_TIMESTAMP(l.action_date)) AS at FROM submission_logs l JOIN syllabi s ON s.syllabus_id = l.syllabus_id
     WHERE s.course_id = ? AND l.user_id = s.user_id AND l.action = 'submit' AND l.action_date >= FROM_UNIXTIME(?) AND s.user_id IN (?) GROUP BY s.user_id`,
    [courseId, secs(opensAt), userIds]);
  return new Map(rows.filter((r) => r.at !== null && r.at !== undefined).map((r) => [r.user_id, fromSecs(r.at)]));
}

async function requirements(db, deadline, now) {
  const people = await peopleOf(db, deadline.courseId);
  if (!people.length) return [];
  const [subs] = await db.query(
    `SELECT s.user_id, MIN(UNIX_TIMESTAMP(v.created_at)) AS at FROM syllabus_versions v JOIN syllabi s ON s.syllabus_id = v.syllabus_id
     WHERE s.course_id = ? AND v.created_by = s.user_id AND v.status_at_save <> 'draft' AND v.created_at >= FROM_UNIXTIME(?) GROUP BY s.user_id`,
    [deadline.courseId, secs(deadline.opensAt)]);
  const first = new Map(subs.map((r) => [r.user_id, fromSecs(r.at)]));
  // an administrator counts from sending for review, not from a saved version
  const admins = people.filter((p) => p.role === 'admin').map((p) => p.user_id);
  const sent = await adminSubmissions(db, deadline.courseId, deadline.opensAt, admins);
  for (const id of admins) { if (sent.has(id)) first.set(id, sent.get(id)); else first.delete(id); }
  return people.map((p) => {
    const submittedAt = first.has(p.user_id) ? first.get(p.user_id) : null;
    return { userId: p.user_id, name: `${p.first_name} ${p.last_name}`.trim(), submittedAt, status: statusOf({ now, dueAt: deadline.dueAt, submittedAt }) };
  });
}

// Every active deadline as stored (times in milliseconds), soonest first. The reminder job walks this list.
async function activeDeadlines(db) {
  const [rows] = await db.query(SELECT + ' WHERE d.cancelled_at IS NULL ORDER BY d.due_at, d.deadline_id');
  const past = await pastCourseIds(db); // a past academic year's subjects get no reminders and are not listed
  return rows.filter((r) => !past.has(r.course_id)).map(shape);
}

// All active deadlines for the administrator, soonest first, each with the numbers of its requirements.
async function listForAdmin(db, now = Date.now()) {
  const [rows] = await db.query(SELECT + ' WHERE d.cancelled_at IS NULL ORDER BY d.due_at, d.deadline_id');
  const past = await pastCourseIds(db);
  const deadlines = rows.filter((r) => !past.has(r.course_id)).map(shape);
  const people = await Promise.all(deadlines.map((d) => requirements(db, d, now)));
  return deadlines.map((d, i) => ({ ...publicForm(d), summary: summarize(people[i].map((p) => p.status)), settled: isSettled(summarize(people[i].map((p) => p.status))), unassigned: people[i].length === 0 }));
}

// One deadline in detail: every assigned faculty member with their status, and when each was last reminded.
async function progress(db, id, now = Date.now()) {
  const deadline = await loadDeadline(db, id);
  if (!deadline) throw httpError(404, 'Deadline not found');
  const people = await requirements(db, deadline, now);
  let last = new Map();
  if (people.length) {
    const [notices] = await db.query('SELECT user_id, MAX(UNIX_TIMESTAMP(created_at)) AS at FROM deadline_notices WHERE deadline_id = ? GROUP BY user_id', [id]);
    last = new Map(notices.map((n) => [n.user_id, fromSecs(n.at)]));
  }
  const withNotice = people.map((p) => ({ ...p, submittedAt: iso(p.submittedAt), lastNoticeAt: iso(last.has(p.userId) ? last.get(p.userId) : null) }));
  const summary = summarize(people.map((p) => p.status));
  return { deadline: publicForm(deadline), summary, settled: isSettled(summary), people: withNotice, unassigned: people.length === 0 };
}

// A person's own deadlines, soonest first, with their own status. Faculty: the subjects assigned to them. An administrator ({ admin: true }): the subjects
// assigned to them and the subjects they are writing a syllabus for; their submission is when they sent it for review.
async function mine(db, userId, now = Date.now(), { admin = false } = {}) {
  const [rows] = admin
    ? await db.query(SELECT + ' WHERE d.cancelled_at IS NULL AND (d.course_id IN (SELECT course_id FROM faculty_courses WHERE user_id = ?) OR d.course_id IN (SELECT course_id FROM syllabi WHERE user_id = ? AND archived_at IS NULL AND course_id IS NOT NULL)) ORDER BY d.due_at, d.deadline_id', [userId, userId])
    : await db.query(SELECT + ' JOIN faculty_courses fc ON fc.course_id = d.course_id WHERE fc.user_id = ? AND d.cancelled_at IS NULL ORDER BY d.due_at, d.deadline_id', [userId]);
  const out = [];
  for (const row of rows) {
    const deadline = shape(row);
    let submittedAt = null;
    if (admin) submittedAt = (await adminSubmissions(db, deadline.courseId, deadline.opensAt, [userId])).get(userId) || null;
    else {
      const [subs] = await db.query(
        `SELECT MIN(UNIX_TIMESTAMP(v.created_at)) AS at FROM syllabus_versions v JOIN syllabi s ON s.syllabus_id = v.syllabus_id
         WHERE s.course_id = ? AND s.user_id = ? AND v.created_by = s.user_id AND v.status_at_save <> 'draft' AND v.created_at >= FROM_UNIXTIME(?)`,
        [deadline.courseId, userId, secs(deadline.opensAt)]);
      submittedAt = subs.length && subs[0].at !== null && subs[0].at !== undefined ? fromSecs(subs[0].at) : null;
    }
    out.push({ ...publicForm(deadline), submittedAt: iso(submittedAt), status: statusOf({ now, dueAt: deadline.dueAt, submittedAt }) });
  }
  return out;
}

async function createDeadline(db, adminId, courseId, body, now = Date.now()) {
  const [courses] = await db.query('SELECT course_id FROM courses WHERE course_id = ?', [courseId]);
  if (!courses.length) throw httpError(404, 'Subject not found');
  const input = readInput(body, now);
  const [same] = await db.query('SELECT deadline_id, UNIX_TIMESTAMP(cancelled_at) AS cancelled FROM subject_deadlines WHERE course_id = ? AND term = ?', [courseId, input.term]);
  if (same.length && (same[0].cancelled === null || same[0].cancelled === undefined)) throw httpError(409, 'This subject already has a deadline for that term. Edit it instead.');
  let id;
  if (same.length) {            // a cancelled one for the same term is brought back with the new values
    id = same[0].deadline_id;
    await db.query('UPDATE subject_deadlines SET due_at = FROM_UNIXTIME(?), opens_at = FROM_UNIXTIME(?), instructions = ?, created_by = ?, cancelled_at = NULL WHERE deadline_id = ?',
      [secs(input.dueAt), secs(input.opensAt), input.instructions, adminId, id]);
  } else {
    const [result] = await db.query('INSERT INTO subject_deadlines (course_id, term, due_at, opens_at, instructions, created_by) VALUES (?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?), ?, ?)',
      [courseId, input.term, secs(input.dueAt), secs(input.opensAt), input.instructions, adminId]);
    id = result.insertId;
  }
  return { id, deadline: publicForm(await loadDeadline(db, id)), created: true };
}

async function updateDeadline(db, id, body, now = Date.now()) {
  const existing = await loadDeadline(db, id);
  if (!existing || existing.cancelled) throw httpError(404, 'Deadline not found');
  const input = readInput(body, now, existing);
  const [clash] = await db.query('SELECT deadline_id FROM subject_deadlines WHERE course_id = ? AND term = ? AND deadline_id <> ?', [existing.courseId, input.term, id]);
  if (clash.length) throw httpError(409, 'This subject already has a deadline for that term.');
  await db.query('UPDATE subject_deadlines SET term = ?, due_at = FROM_UNIXTIME(?), opens_at = FROM_UNIXTIME(?), instructions = ? WHERE deadline_id = ?',
    [input.term, secs(input.dueAt), secs(input.opensAt), input.instructions, id]);
  return { id, previous: publicForm(existing), deadline: publicForm(await loadDeadline(db, id)) };
}

async function cancelDeadline(db, id) {
  const existing = await loadDeadline(db, id);
  if (!existing || existing.cancelled) throw httpError(404, 'Deadline not found');
  await db.query('UPDATE subject_deadlines SET cancelled_at = NOW() WHERE deadline_id = ?', [id]);
  return { id, deadline: publicForm(existing) };
}

module.exports = { isSettled, STATUSES, TERM_MAX, INSTRUCTIONS_MAX, phDay, statusOf, summarize, readInput, listForAdmin, progress, mine, createDeadline, updateDeadline, cancelDeadline, loadDeadline, requirements, activeDeadlines };
