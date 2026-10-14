const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { avatarUrlFor } = require('../lib/avatar');
const { createNotification } = require('../lib/notify');
const { LABEL_SQL, labelsOf } = require('../lib/syllabusLabels');
const router = express.Router();

const MAX_TEXT = 2000;

// Chat is per syllabus and only ever between the syllabus owner (faculty) and an admin.
// Loads the syllabus and says whether the signed-in user may take part. Sends the error response itself
// (404 missing syllabus, 403 not a participant) and returns null in that case.
async function loadThread(req, res) {
  const id = Number(req.params.syllabusId);
  if (!Number.isInteger(id) || id <= 0) { res.status(404).json({ error: 'Syllabus not found' }); return null; }
  const db = req.app.locals.db;
  const [rows] = await db.query('SELECT syllabus_id, user_id, course_code FROM syllabi WHERE syllabus_id = ?', [id]);
  if (rows.length === 0) { res.status(404).json({ error: 'Syllabus not found' }); return null; }
  const me = req.session.user;
  const ownerId = rows[0].user_id;
  if (me.id !== ownerId && me.role !== 'admin') { res.status(403).json({ error: 'You are not part of this conversation' }); return null; }
  return { db, syllabusId: id, ownerId, courseCode: rows[0].course_code, me };
}

// Who an owner's message goes to: the admin already in this thread (most recent), else the first admin account.
async function adminFor(db, syllabusId, meId) {
  const [msgs] = await db.query(
    `SELECT m.sender_id, m.receiver_id, us.role AS sender_role, ur.role AS receiver_role
     FROM messages m
     JOIN users us ON us.user_id = m.sender_id
     JOIN users ur ON ur.user_id = m.receiver_id
     WHERE m.syllabus_id = ?
     ORDER BY m.created_at DESC, m.message_id DESC`,
    [syllabusId]
  );
  for (const m of msgs) {
    if (m.sender_role === 'admin' && m.sender_id !== meId) return m.sender_id;
    if (m.receiver_role === 'admin' && m.receiver_id !== meId) return m.receiver_id;
  }
  const [admins] = await db.query("SELECT user_id FROM users WHERE role = 'admin' AND user_id <> ? ORDER BY user_id ASC LIMIT 1", [meId]);
  return admins[0]?.user_id ?? null;
}

// Who the signed-in user is talking to, for every syllabus they can message about, with the profile to show: name, picture, role, and the
// syllabus's program and subject. Read from the users and the syllabus themselves (not from a message), so it is right before anyone has
// written and follows a name or picture change. An administrator talks to the syllabus owner; an owner talks to the administrator already in
// the thread, otherwise the first administrator (the same rule that decides where their message goes). Drafts have no conversation.
const ADMIN_LABEL = 'Academic Administrator';
router.get('/partners', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const me = req.session.user;
    const isAdmin = me.role === 'admin';
    const [rows] = await db.query(
      'SELECT s.syllabus_id, s.user_id, s.course_code, s.title, u.avatar_path, ' + LABEL_SQL + " WHERE s.status <> 'draft'" + (isAdmin ? '' : ' AND s.user_id = ?') + ' ORDER BY s.syllabus_id DESC LIMIT 500',
      isAdmin ? [] : [me.id]
    );
    const adminOf = new Map();
    if (!isAdmin) for (const r of rows) adminOf.set(r.syllabus_id, await adminFor(db, r.syllabus_id, me.id));
    const wanted = [...new Set([...adminOf.values()].filter(Boolean))];
    const [admins] = wanted.length ? await db.query('SELECT user_id, first_name, last_name, avatar_path FROM users WHERE user_id IN (?)', [wanted]) : [[]];
    const adminById = new Map(admins.map((a) => [a.user_id, a]));
    const partners = {};
    rows.forEach((r) => {
      const labels = labelsOf(r, null);
      const subject = [r.course_code, labels.courseTitle].filter(Boolean).join(' \u2014 ');
      const program = labels.programCode ? labels.programCode + (labels.programName ? ' \u00b7 ' + labels.programName : '') : labels.programName || '';
      if (isAdmin) {
        partners[r.syllabus_id] = { id: r.user_id, name: labels.facultyName, role: 'faculty', roleLabel: 'Faculty', avatarUrl: avatarUrlFor(r.user_id, r.avatar_path), program, subject };
        return;
      }
      const a = adminById.get(adminOf.get(r.syllabus_id));
      partners[r.syllabus_id] = a
        ? { id: a.user_id, name: `${a.first_name} ${a.last_name}`, role: 'admin', roleLabel: ADMIN_LABEL, avatarUrl: avatarUrlFor(a.user_id, a.avatar_path), program, subject }
        : null; // no administrator account at all
    });
    res.json({ partners });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Same message shape as the per-syllabus endpoint.
const toMessage = (r) => ({ id: r.message_id, syllabusId: r.syllabus_id, senderId: r.sender_id, receiverId: r.receiver_id, text: r.message_text, isRead: r.is_read, time: r.created_at, sender: `${r.first_name} ${r.last_name}`, senderAvatarUrl: avatarUrlFor(r.sender_id, r.avatar_path) });

// Every message I sent or received, across all syllabi, in one request.
router.get('/', requireAuth, async (req, res) => {
  try {
    const me = req.session.user.id;
    const [rows] = await req.app.locals.db.query(`
      SELECT m.*, u.first_name, u.last_name, u.avatar_path
      FROM messages m
      JOIN users u ON m.sender_id = u.user_id
      WHERE m.sender_id = ? OR m.receiver_id = ?
      ORDER BY m.created_at ASC, m.message_id ASC
    `, [me, me]);
    res.json(rows.map(toMessage));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:syllabusId', requireAuth, async (req, res) => {
  try {
    const t = await loadThread(req, res);
    if (!t) return;
    const [rows] = await t.db.query(`
      SELECT m.*, u.first_name, u.last_name, u.avatar_path
      FROM messages m
      JOIN users u ON m.sender_id = u.user_id
      WHERE m.syllabus_id = ?
      ORDER BY m.created_at ASC
    `, [t.syllabusId]);
    res.json(rows.map(r => ({ id: r.message_id, syllabusId: r.syllabus_id, senderId: r.sender_id, receiverId: r.receiver_id, text: r.message_text, isRead: r.is_read, time: r.created_at, sender: `${r.first_name} ${r.last_name}`, senderAvatarUrl: avatarUrlFor(r.sender_id, r.avatar_path) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:syllabusId', requireAuth, async (req, res) => {
  try {
    const t = await loadThread(req, res);
    if (!t) return;

    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!text) return res.status(400).json({ error: 'Message cannot be empty' });
    if (text.length > MAX_TEXT) return res.status(400).json({ error: `Message is too long (max ${MAX_TEXT} characters)` });

    // Any receiverId sent by the client is ignored; the receiver is decided here.
    let receiverId;
    if (t.me.id === t.ownerId) receiverId = await adminFor(t.db, t.syllabusId, t.me.id);
    else receiverId = t.ownerId; // sender is an admin (loadThread already rejected everyone else)
    if (!receiverId) return res.status(409).json({ error: 'No administrator is available to receive this message' });

    const [result] = await t.db.query(
      'INSERT INTO messages (syllabus_id, sender_id, receiver_id, message_text) VALUES (?, ?, ?, ?)',
      [t.syllabusId, t.me.id, receiverId, text]
    );
    await createNotification(t.db, {
      userId: receiverId,
      type: 'message',
      syllabusId: t.syllabusId,
      title: `New message from ${t.me.firstName} ${t.me.lastName}`,
      body: `${t.courseCode ? t.courseCode + ': ' : ''}${text.slice(0, 140)}`,
    });
    res.json({ id: result.insertId, message: 'Message sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/read/:syllabusId', requireAuth, async (req, res) => {
  try {
    const t = await loadThread(req, res);
    if (!t) return;
    await t.db.query('UPDATE messages SET is_read = 1 WHERE syllabus_id = ? AND receiver_id = ?', [t.syllabusId, t.me.id]);
    res.json({ message: 'Messages marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
