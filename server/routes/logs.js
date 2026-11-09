const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { isAdmin } = require('../lib/syllabusRules');
const accountActivity = require('../lib/accountActivity');
const router = express.Router();

// Each account has its own activity: only the rows of what the signed-in user did, whatever their role. Nobody's browser receives what
// someone else did, so the dashboard has nothing of anyone else's to hide. Two sources, newest first: what they did to syllabi in the review
// (submission_logs: submit, check, approve, ...) and their account activity (account_activity: sign-in and sign-out, password, name, photo,
// language, drafts, edits, deletions, account management; lib/accountActivity.js). An audit trail kept for transparency: nothing here clears or hides it.
//
// The administrator alone may read everyone's (?scope=all), or one person's (?scope=all&userId=7), for oversight. Anyone else asking is refused (403).
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
    const limit = everyone ? ALL_LIMIT : LIMIT;
    const [rows] = await db.query(`
      SELECT l.*, u.first_name, u.last_name, s.title, s.course_code
      FROM submission_logs l
      JOIN users u ON l.user_id = u.user_id
      JOIN syllabi s ON l.syllabus_id = s.syllabus_id
      ${who === null ? '' : 'WHERE l.user_id = ?'}
      ORDER BY l.action_date DESC
      LIMIT ${limit}
    `, who === null ? [] : [who]);
    const review = rows.map(r => ({ id: r.log_id, syllabusId: r.syllabus_id, userId: r.user_id, action: r.action, actionDate: r.action_date, notes: r.notes, user: `${r.first_name} ${r.last_name}`, title: r.title, courseCode: r.course_code }));
    const account = await accountActivity.listFor(db, who, limit);
    const time = (x) => { const t = new Date(x.actionDate).getTime(); return Number.isNaN(t) ? 0 : t; };
    res.json([...review, ...account].sort((a, b) => time(b) - time(a)).slice(0, limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
