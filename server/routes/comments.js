// Reviewer comments on a syllabus. Mounted on /api/syllabi (the paths below are relative to that).
//   GET  /:id/comments        the thread, oldest first: the owner and administrators (an admin only once it is no longer a draft);
//                             for the owner it also says which comment they have read up to (lastReadId)
//   POST /:id/comments        an administrator adds a comment; the faculty member who owns the syllabus is notified
//   GET  /comment-summary     a faculty member's syllabi with comments: how many, and how many are unread
//   POST /:id/comments/read   the owner marks the thread as read (only ever moves forward)
// Unread tracking needs the comment_reads table (npm run migrate-comment-reads); until then the counts say unread: null and nothing breaks.
// Decisions (approve, return for revision, reject) record their reason as a typed comment in the same transaction as the status
// change; that lives in routes/syllabi.js. Anyone else gets a 404, so nobody can tell that another faculty member's syllabus exists.
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { httpError, sendError } = require('../lib/http');
const { createNotification } = require('../lib/notify');
const rules = require('../lib/syllabusRules');
const { validateComment } = require('../lib/reviewComments');
const commentReads = require('../lib/commentReads');
const router = express.Router();

const parseId = (raw) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw httpError(404, 'Syllabus not found');
  return id;
};

async function loadVisible(db, me, id) {
  const [rows] = await db.query('SELECT syllabus_id, user_id, status, title, course_code FROM syllabi WHERE syllabus_id = ?', [id]);
  const syl = rows[0];
  if (!syl || !rules.canView(me, syl)) throw httpError(404, 'Syllabus not found');
  return syl;
}

const shape = (r) => ({
  id: r.comment_id,
  text: r.comment_text,
  type: r.comment_type,
  createdAt: r.created_at,
  author: { id: r.user_id, name: [r.first_name, r.last_name].filter(Boolean).join(' '), role: r.role },
});

const SELECT = `SELECT c.comment_id, c.comment_text, c.comment_type, c.created_at, c.user_id, u.first_name, u.last_name, u.role
  FROM comments c JOIN users u ON u.user_id = c.user_id`;

router.get('/:id/comments', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const syl = await loadVisible(db, req.session.user, parseId(req.params.id));
    const [rows] = await db.query(SELECT + ' WHERE c.syllabus_id = ? ORDER BY c.created_at ASC, c.comment_id ASC LIMIT 300', [syl.syllabus_id]);
    const mine = rules.isOwner(req.session.user, syl);
    res.json({ comments: rows.map(shape), lastReadId: mine ? await commentReads.lastRead(db, req.session.user.id, syl.syllabus_id) : null });
  } catch (err) { sendError(res, err); }
});

// A faculty member's own syllabi that have comments, with the unread count of each (one query, so the cards can show a badge).
router.get('/comment-summary', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const me = req.session.user;
    if (me.role === 'admin') return res.json({ installed: await commentReads.isInstalled(db), counts: {} }); // reviewers write comments; they have none to read
    res.json(await commentReads.counts(db, me.id));
  } catch (err) { sendError(res, err); }
});

// The owner has read the thread up to now.
router.post('/:id/comments/read', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const me = req.session.user;
    const syl = await loadVisible(db, me, parseId(req.params.id));
    if (!rules.isOwner(me, syl)) throw httpError(403, 'Only the faculty member who owns the syllabus reads its comments');
    res.json({ installed: await commentReads.markRead(db, me.id, syl.syllabus_id) });
  } catch (err) { sendError(res, err); }
});

router.post('/:id/comments', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const me = req.session.user;
    const syl = await loadVisible(db, me, parseId(req.params.id));
    if (!rules.isAdmin(me)) throw httpError(403, 'Only administrators can add reviewer comments');
    const text = validateComment((req.body || {}).text);
    const [ins] = await db.query('INSERT INTO comments (syllabus_id, user_id, comment_text, comment_type) VALUES (?, ?, ?, ?)', [syl.syllabus_id, me.id, text, 'comment']);
    const [rows] = await db.query(SELECT + ' WHERE c.comment_id = ?', [ins.insertId]);

    // After the write: a notification never affects the result.
    if (syl.user_id !== me.id) {
      await createNotification(db, {
        userId: syl.user_id, type: 'comment', syllabusId: syl.syllabus_id,
        title: `New reviewer comment: ${syl.course_code || syl.title || 'your syllabus'}`,
        body: text.slice(0, 300),
      });
    }
    res.status(201).json({ comment: shape(rows[0]) });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
