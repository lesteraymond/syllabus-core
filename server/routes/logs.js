const express = require('express');
const { sendError, serverError } = require('../lib/http'); // an unexpected failure: logged here, answered generically
const { requireAuth } = require('../middleware/auth');
const { isAdmin } = require('../lib/syllabusRules');
const { resolveYear } = require('../lib/academicYear');
const accountActivity = require('../lib/accountActivity');
const router = express.Router();

// Each account has its own activity: only the rows of what the signed-in user did, whatever their role. Nobody's browser receives what
// someone else did, so the dashboard has nothing of anyone else's to hide. Two sources, newest first: what they did to syllabi in the review
// (submission_logs: submit, check, approve, ...) and their account activity (account_activity: sign-in and sign-out, password, name, photo,
// language, drafts, edits, deletions, account management; lib/accountActivity.js). An audit trail kept for transparency: nothing here clears or hides it.
//
// Personal Recent Activity (scope !== 'all') is scoped to the requested or current academic year so a new academic year starts fresh and
// switching back to a previous academic year restores its history. The administrator's Audit Log (?scope=all) stays unfiltered across all years
// unless ?year= is explicitly requested. Anyone else asking for ?scope=all is refused (403).
const LIMIT = 50;
const ALL_LIMIT = 100;
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const me = req.session.user;
    const everyone = req.query.scope === 'all';
    if (everyone && !isAdmin(me)) return res.status(403).json({ error: 'Only the administrator can read everyone\'s activity.' });
    let who = me.id;
    if (everyone) {
      who = null;
      if (req.query.userId !== undefined && req.query.userId !== '') {
        who = Number(req.query.userId);
        if (!Number.isInteger(who) || who <= 0) return res.status(400).json({ error: 'userId must be a user id' });
      }
    }
    const yearScope = (!everyone || req.query.year) ? await resolveYear(db, me, req.query.year) : { labels: null, current: null };
    const limit = everyone ? ALL_LIMIT : LIMIT;
    const where = [];
    const params = [];
    if (who !== null) { where.push('l.user_id = ?'); params.push(who); }
    if (yearScope.labels) { where.push('s.syllabus_id IS NOT NULL AND COALESCE(s.academic_year, ?) IN (?)'); params.push(yearScope.current, yearScope.labels); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [rows] = await db.query(`
      SELECT l.*, u.first_name, u.last_name, s.title, s.course_code
      FROM submission_logs l
      LEFT JOIN users u ON l.user_id = u.user_id
      LEFT JOIN syllabi s ON l.syllabus_id = s.syllabus_id
      ${whereSql}
      ORDER BY l.action_date DESC
      LIMIT ${limit}
    `, params);
    const review = rows.map(r => ({ id: r.log_id, syllabusId: r.syllabus_id, userId: r.user_id, action: r.action, actionDate: r.action_date, notes: r.notes, user: r.first_name || r.last_name ? `${r.first_name} ${r.last_name}` : r.actor || 'Deleted account', title: r.title || r.subject || null, courseCode: r.course_code || null })); // a deleted account or syllabus keeps its history
    const account = await accountActivity.listFor(db, who, limit, { includeAuditMeta: everyone, yearScope });
    const time = (x) => { const t = new Date(x.actionDate).getTime(); return Number.isNaN(t) ? 0 : t; };
    res.json([...review, ...account].sort((a, b) => time(b) - time(a)).slice(0, limit));
  } catch (err) {
    if (err && err.status) return sendError(res, err);
    serverError(res, err, 'LOGS ERROR:');
  }
});

module.exports = router;
