const express = require('express');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const toNotification = (r) => ({
  id: r.id, type: r.type, syllabusId: r.syllabus_id, title: r.title, body: r.body, isRead: !!r.is_read, createdAt: r.created_at,
});

// Mine, newest 50, plus the unread count.
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const me = req.session.user.id;
    const [rows] = await db.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50', [me]);
    const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', [me]);
    res.json({ notifications: rows.map(toNotification), unreadCount: n });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cheap counts for polling.
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const me = req.session.user.id;
    const [[m]] = await db.query('SELECT COUNT(*) AS n FROM messages WHERE receiver_id = ? AND is_read = 0', [me]);
    const [[n]] = await db.query('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', [me]);
    const [[l]] = await db.query('SELECT MAX(created_at) AS latest FROM messages WHERE sender_id = ? OR receiver_id = ?', [me, me]);
    res.json({ unreadMessages: m.n, unreadNotifications: n.n, latestMessageAt: l.latest ? new Date(l.latest).toISOString() : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/read-all', requireAuth, async (req, res) => {
  try {
    await req.app.locals.db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.session.user.id]);
    res.json({ message: 'Notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mine only: someone else's id simply matches nothing.
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    const [result] = await req.app.locals.db.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.session.user.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
