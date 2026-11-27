const express = require('express');
const { serverError } = require('../lib/http'); // an unexpected failure: logged here, answered generically
const { requireAuth } = require('../middleware/auth');
const { resolveYear } = require('../lib/academicYear');
const router = express.Router();

const toNotification = (r) => ({
  id: r.id, type: r.type, syllabusId: r.syllabus_id, title: r.title, body: r.body, isRead: !!r.is_read, createdAt: r.created_at,
});

// Active academic year filter for syllabus-linked notifications and messages: a new academic year starts clean and switching back restores them.
function notifYearFilter(scope) {
  if (!scope || !scope.labels) return { join: '', where: '', params: [] };
  return {
    join: ' LEFT JOIN syllabi s ON s.syllabus_id = n.syllabus_id',
    where: ' AND (n.syllabus_id IS NULL OR (s.syllabus_id IS NOT NULL AND COALESCE(s.academic_year, ?) IN (?)))',
    params: [scope.current, scope.labels],
  };
}
function msgYearFilter(scope) {
  if (!scope || !scope.labels) return { join: '', where: '', params: [] };
  return {
    join: ' JOIN syllabi s ON s.syllabus_id = m.syllabus_id',
    where: " AND s.status <> 'draft' AND COALESCE(s.academic_year, ?) IN (?)",
    params: [scope.current, scope.labels],
  };
}

// Mine, newest 50, plus the unread count (direct messages live in the Messages mailbox, not the bell).
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const me = req.session.user.id;
    const nf = notifYearFilter(await resolveYear(db, req.session.user));
    const [rows] = await db.query(
      `SELECT n.* FROM notifications n${nf.join} WHERE n.user_id = ? AND n.type <> 'message'${nf.where} ORDER BY n.created_at DESC, n.id DESC LIMIT 50`,
      [me, ...nf.params]
    );
    const [[{ n }]] = await db.query(
      `SELECT COUNT(*) AS n FROM notifications n${nf.join} WHERE n.user_id = ? AND n.is_read = 0 AND n.type <> 'message'${nf.where}`,
      [me, ...nf.params]
    );
    res.json({ notifications: rows.map(toNotification), unreadCount: n });
  } catch (err) {
    serverError(res, err, 'NOTIFICATIONS ERROR:');
  }
});

// Cheap counts for polling.
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const me = req.session.user.id;
    const scope = await resolveYear(db, req.session.user);
    const nf = notifYearFilter(scope);
    const mf = msgYearFilter(scope);
    const [[m]] = await db.query(`SELECT COUNT(*) AS n FROM messages m${mf.join} WHERE m.receiver_id = ? AND m.is_read = 0${mf.where}`, [me, ...mf.params]);
    const [[n]] = await db.query(`SELECT COUNT(*) AS n FROM notifications n${nf.join} WHERE n.user_id = ? AND n.is_read = 0 AND n.type <> 'message'${nf.where}`, [me, ...nf.params]);
    const [[l]] = await db.query(`SELECT MAX(m.created_at) AS latest FROM messages m${mf.join} WHERE (m.sender_id = ? OR m.receiver_id = ?)${mf.where}`, [me, me, ...mf.params]);
    res.json({ unreadMessages: m.n, unreadNotifications: n.n, latestMessageAt: l.latest ? new Date(l.latest).toISOString() : null, activeAcademicYear: scope.current || null });
  } catch (err) {
    serverError(res, err, 'NOTIFICATIONS ERROR:');
  }
});

router.put('/read-all', requireAuth, async (req, res) => {
  try {
    await req.app.locals.db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.session.user.id]);
    res.json({ message: 'Notifications marked as read' });
  } catch (err) {
    serverError(res, err, 'NOTIFICATIONS ERROR:');
  }
});

// Mine only: someone else's id simply matches nothing.
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    const [result] = await req.app.locals.db.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.session.user.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    serverError(res, err, 'NOTIFICATIONS ERROR:');
  }
});

module.exports = router;
