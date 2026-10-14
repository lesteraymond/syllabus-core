const express = require('express');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Each account has its own activity: only the rows of what the signed-in user did, whatever their role. Nobody's browser receives what
// someone else did, so the dashboard has nothing of anyone else's to hide.
const LIMIT = 30;
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [rows] = await db.query(`
      SELECT l.*, u.first_name, u.last_name, s.title, s.course_code
      FROM submission_logs l
      JOIN users u ON l.user_id = u.user_id
      JOIN syllabi s ON l.syllabus_id = s.syllabus_id
      WHERE l.user_id = ?
      ORDER BY l.action_date DESC
      LIMIT ${LIMIT}
    `, [req.session.user.id]);
    res.json(rows.map(r => ({ id: r.log_id, syllabusId: r.syllabus_id, userId: r.user_id, action: r.action, actionDate: r.action_date, notes: r.notes, user: `${r.first_name} ${r.last_name}`, title: r.title, courseCode: r.course_code })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
