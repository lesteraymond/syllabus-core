'use strict';
// The account's own activity (table account_activity, db/account-activity-ddl.js), shown with the syllabus history (lib/activity.js, submission_logs)
// in the dashboard's Recent Activity: signing in and out (and a failed sign-in, recorded on the account it was for), changing the password, the name,
// the profile photo or the language, starting a draft, editing a syllabus's content, deleting a syllabus, and an administrator's management of
// accounts (registering, new sign-in details, disabling, enabling, removing, assignments; recorded on the administrator, naming the account).
// An audit trail kept for transparency: rows are only added, never changed or removed here. An administrator reads everyone's (listFor with no user).
//
// Writing is best effort on purpose, like lib/activity.js: losing a line must never make the action itself fail (a sign-in, a save). Without
// the table (before npm run migrate-account-activity) nothing is recorded and the read returns nothing; the server console says so once.
const ACTIONS = ['login', 'logout', 'password_change', 'name_change', 'photo_change', 'language_change', 'draft_create', 'content_edit', 'syllabus_delete',
  'login_failed', 'user_create', 'user_credentials', 'user_disable', 'user_enable', 'user_delete', 'user_assignments', 'generate',
  'terms_accept']; // a student's agreement to the registration Terms and Conditions (routes/students.js): notes = '<version> at <ISO time>'
// Autosave writes the content every few seconds: one "edited" line per syllabus per editing session, not one per save. A save within this many
// minutes of the person's last "edited" line for the same syllabus is part of that session.
const EDIT_SESSION_MINUTES = 30;
const NO_TABLE = 'ER_NO_SUCH_TABLE';
let reported = false;

const report = (action, error) => {
  if (reported) return;
  reported = true;
  const hint = error && error.code === NO_TABLE ? ' Run "npm run migrate-account-activity" in server/ to start recording it.' : '';
  console.error(`Account activity: could not record "${action}" (${(error && (error.code || error.message)) || error}).${hint}`);
};

const text = (value, max) => { const s = value === null || value === undefined ? '' : String(value).trim(); return s ? s.slice(0, max) : null; };

// Does the table have the columns of db/migrate-audit-retention.js (ip_address, user_agent)? Learnt from the first write, then remembered.
let auditColumns = null;
const _resetColumnsProbe = () => { auditColumns = null; }; // tests only
const OLD_COLUMNS = new Set(['ER_BAD_FIELD_ERROR', 'ER_BAD_NULL_ERROR']);

// request: the Express request, for the address and browser of the line (both optional; cut to fit). userId may be null only for a failed sign-in on an
// email that is not registered (subject then holds what was typed): there is no account to put it on. Before the migration that line cannot be stored.
async function record(db, { userId, action, syllabusId = null, subject = null, notes = null, request = null }) {
  if (!ACTIONS.includes(action)) return false;
  if (!Number.isInteger(userId) && !(userId === null && action === 'login_failed')) return false;
  const base = [userId, action, Number.isInteger(syllabusId) ? syllabusId : null, text(subject, 300), text(notes, 500)];
  const ip = request ? text(request.ip, 45) : null;
  const agent = request && request.headers ? text(request.headers['user-agent'], 255) : null;
  try {
    if (auditColumns !== false) {
      try {
        await db.query('INSERT INTO account_activity (user_id, action, syllabus_id, subject, notes, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)', [...base, ip, agent]);
        auditColumns = true;
        return true;
      } catch (error) {
        if (!(error && OLD_COLUMNS.has(error.code))) throw error;
        auditColumns = false; // a table from before db/migrate-audit-retention.js
      }
    }
    if (userId === null) return false; // the old table needs an account on every line
    await db.query('INSERT INTO account_activity (user_id, action, syllabus_id, subject, notes) VALUES (?, ?, ?, ?, ?)', base);
    return true;
  } catch (error) { report(action, error); return false; }
}

// Just before an account is deleted: its name is written on its audit rows, which then stay with no account (ON DELETE SET NULL). Best effort: before the
// migration there is no column for it (and the rows go with the account, as before), and an error here never stops the deletion.
async function keepAuditName(db, userId, name) {
  if (!name) return;
  for (const table of ['submission_logs', 'account_activity']) {
    try { await db.query(`UPDATE ${table} SET actor = ? WHERE user_id = ? AND actor IS NULL`, [String(name).slice(0, 300), Number(userId)]); } catch { /* not migrated: nothing to keep */ }
  }
}

// One "edited" line per editing session: nothing new when the person already has one for this syllabus from the last EDIT_SESSION_MINUTES.
async function recordEdit(db, { userId, syllabusId, subject = null, notes = null }) {
  if (!Number.isInteger(userId) || !Number.isInteger(syllabusId)) return false;
  try {
    const [recent] = await db.query(
      `SELECT 1 FROM account_activity WHERE user_id = ? AND syllabus_id = ? AND action = 'content_edit' AND created_at > (NOW() - INTERVAL ${EDIT_SESSION_MINUTES} MINUTE) LIMIT 1`,
      [userId, syllabusId]);
    if (recent.length) return false;
  } catch (error) { report('content_edit', error); return false; }
  return record(db, { userId, action: 'content_edit', syllabusId, subject, notes });
}

// The subject line of a syllabus ("FM 202 — Fundamentals of Mathematics"), read before it is deleted so the record still names it. Null when unreadable.
async function subjectOf(db, syllabusId) {
  try {
    const [rows] = await db.query('SELECT course_code, title FROM syllabi WHERE syllabus_id = ?', [syllabusId]);
    return rows[0] ? subjectLine(rows[0].course_code, rows[0].title) : null;
  } catch { return null; }
}
const subjectLine = (code, title) => [text(code, 50), text(title, 240)].filter(Boolean).join(' — ') || null;

// The name of an account an administrator acts on ("Fay Flores"), read before it changes or is removed so the record still names it. "user #id" when unreadable.
async function personOf(db, userId) {
  try {
    const [rows] = await db.query('SELECT first_name, last_name FROM users WHERE user_id = ?', [userId]);
    const name = rows[0] ? text(`${rows[0].first_name || ''} ${rows[0].last_name || ''}`, 300) : null;
    if (name) return name;
  } catch { /* the id is enough */ }
  return 'user #' + userId;
}

// The account activity of one person (userId), or of everyone (userId null: the administrator's view), newest first, at most `limit` rows, in the shape
// GET /api/logs returns. [] before the migration. When `yearScope` has labels (Dashboard Recent Activity for a specific/current academic year),
// only rows tied to a syllabus of that academic year are returned so a fresh academic year starts clean and switching back restores its history.
async function listFor(db, userId, limit, { includeAuditMeta = false, yearScope = null } = {}) {
  try {
    const where = [];
    const params = [];
    if (userId !== null) { where.push('a.user_id = ?'); params.push(userId); }
    if (yearScope && yearScope.labels) {
      where.push('s.syllabus_id IS NOT NULL AND COALESCE(s.academic_year, ?) IN (?)');
      params.push(yearScope.current, yearScope.labels);
    }
    const filterSql = where.length ? 'WHERE ' + where.join(' AND ') + ' ' : '';
    const [rows] = await db.query(
      `SELECT a.activity_id, a.user_id, a.action, a.syllabus_id, a.subject, a.notes, a.created_at, u.first_name, u.last_name, s.course_code, s.title, a.*
       FROM account_activity a LEFT JOIN users u ON u.user_id = a.user_id LEFT JOIN syllabi s ON s.syllabus_id = a.syllabus_id
       ${filterSql}ORDER BY a.created_at DESC, a.activity_id DESC LIMIT ${Number(limit)}`, params);
    return rows.map((r) => {
      // the syllabus as it is now; a deleted one (or one with no code yet) by the name recorded at the time
      const [code, ...rest] = String(r.subject || '').split(' — ');
      return {
        id: 'a' + r.activity_id, syllabusId: r.syllabus_id, userId: r.user_id, action: r.action, actionDate: r.created_at, notes: r.notes,
        user: r.first_name || r.last_name ? `${r.first_name} ${r.last_name}` : r.actor || (r.user_id === null ? 'Unknown account' : 'user #' + r.user_id), title: r.title || rest.join(' — ') || null, courseCode: r.course_code || code || null,
        ...(includeAuditMeta ? { ipAddress: r.ip_address || null, userAgent: r.user_agent || null } : {}),
      };
    });
  } catch (error) {
    if (error && error.code === NO_TABLE) return [];
    throw error;
  }
}

module.exports = { ACTIONS, EDIT_SESSION_MINUTES, record, recordEdit, subjectOf, subjectLine, personOf, listFor, keepAuditName, _resetColumnsProbe };
