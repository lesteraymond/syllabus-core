const fs = require('fs');
const path = require('path');
const multer = require('multer');
const express = require('express');
const bcrypt = require('bcryptjs');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { AVATAR_DIR, avatarRelPath, avatarFile, avatarUrlFor } = require('../lib/avatar');
const { inTransaction } = require('../lib/http');
const { createNotification } = require('../lib/notify');
const { createLimiter } = require('../lib/rateLimit');
const { generatePassword } = require('../lib/passwords');
const mailer = require('../lib/mailer');
const { domain, isSchoolEmail } = require('../lib/emailDomain');
const assignments = require('../lib/assignments');
const router = express.Router();

const ROLES = ['faculty', 'admin']; // admin = Dean / Academic Administrator
const resendLimiter = createLimiter({ max: 10, windowMs: 10 * 60 * 1000 }); // per admin

const fail = (res, status, message) => res.status(status).json({ message, error: message });

const toUser = (r) => ({
  id: r.user_id, email: r.email, role: r.role,
  firstName: r.first_name, lastName: r.last_name, createdAt: r.created_at,
  avatarUrl: avatarUrlFor(r.user_id, r.avatar_path),
});

// Registered users = the sign-in allowlist.
router.get('/', requireAdmin, async (req, res) => {
  try {
    const [rows] = await req.app.locals.db.query(
      'SELECT user_id, email, role, first_name, last_name, avatar_path, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(rows.map(toUser));
  } catch (err) {
    console.error('USERS ERROR:', err);
    fail(res, 500, err.message);
  }
});

// Admin registers a user. The system makes the password and emails it with the username (the email address); the user must choose
// their own at the first sign-in (must_change_password). The password is never in a response or a log. If the email cannot be sent the
// user is still registered: the response says emailSent: false and "Resend credentials" tries again. Users normally sign in with Google too.
router.post('/', requireAdmin, async (req, res) => {
  try {
    const firstName = String(req.body.first_name ?? req.body.firstName ?? '').trim();
    const lastName = String(req.body.last_name ?? req.body.lastName ?? '').trim();
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const role = req.body.role ?? 'faculty';

    if (!firstName || !lastName || !email) return fail(res, 400, 'first_name, last_name and email are required');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(res, 400, 'Invalid email address');
    if (!isSchoolEmail(email)) return fail(res, 400, 'Use an institutional email address ending in @' + domain() + '.');
    if (!ROLES.includes(role)) return fail(res, 400, 'Invalid role');

    const db = req.app.locals.db;
    const [existing] = await db.query('SELECT user_id FROM users WHERE LOWER(email) = ?', [email]);
    if (existing.length) return fail(res, 409, 'A user with this email is already registered');

    const password = generatePassword();
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (email, password_hash, must_change_password, role, first_name, last_name) VALUES (?, ?, 1, ?, ?, ?)',
      [email, hash, role, firstName, lastName]
    );
    const mail = await mailer.sendCredentials({ to: email, name: firstName, password, reason: 'welcome' });
    res.status(201).json({ id: result.insertId, email, role, firstName, lastName, emailSent: mail.sent, ...(mail.sent ? {} : { emailReason: mail.reason }) });
  } catch (err) {
    console.error('USERS ERROR:', err);
    fail(res, 500, err.message);
  }
});

// Send a user new credentials: a new generated password replaces their current one and must be changed at the next sign-in. The
// current password is only replaced once the email has gone out; if it cannot be sent, nothing changes. For a lost or never-delivered email. Not for yourself, and not for a student (they sign in with their student ID).
router.post('/:id/resend-credentials', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 404, 'User not found');
    if (id === req.session.user.id) return fail(res, 400, 'You cannot reset your own password here.');
    const slot = resendLimiter.take('resend:' + req.session.user.id);
    if (!slot.ok) {
      res.set('Retry-After', String(slot.retryAfterSec));
      return fail(res, 429, 'You are sending too often. Try again in ' + slot.retryAfterSec + ' seconds.');
    }
    const [rows] = await db.query('SELECT user_id, email, role, first_name FROM users WHERE user_id = ?', [id]);
    const user = rows[0];
    if (!user) return fail(res, 404, 'User not found');
    if (user.role === 'student' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(user.email)) return fail(res, 400, 'This account signs in with a student ID, not an email address.');

    // Send first, change the password only if the email went out: a failed send must never leave someone with a password nobody has seen.
    const password = generatePassword();
    const mail = await mailer.sendCredentials({ to: user.email, name: user.first_name, password, reason: 'welcome' });
    if (mail.sent) {
      await db.query('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE user_id = ?', [await bcrypt.hash(password, 10), id]);
      await db.query('DELETE FROM password_temp WHERE user_id = ?', [id]).catch(() => {});
      await db.query('DELETE FROM remember_tokens WHERE user_id = ?', [id]);
    }
    res.json({ id, email: user.email, emailSent: mail.sent, ...(mail.sent ? {} : { emailReason: mail.reason }) });
  } catch (err) {
    console.error('USERS ERROR:', err);
    fail(res, 500, err.message);
  }
});

// ---- Program and course assignments ----
// A faculty member can create and edit syllabi only for courses an admin assigned to them (lib/assignments.js).
// /me/assignments is registered before /:id/assignments: the two have the same shape.
router.get('/me/assignments', requireAuth, async (req, res) => {
  try {
    const me = req.session.user;
    if (me.role === 'admin') return res.json({ unrestricted: true, programIds: [], courseIds: [], programs: [], courses: [] });
    const db = req.app.locals.db;
    res.json({ unrestricted: false, ...(await assignments.describeAssignments(db, await assignments.loadAssignments(db, me.id))) });
  } catch (err) {
    console.error('ASSIGNMENTS ERROR:', err);
    fail(res, 500, err.message);
  }
});

// Only faculty are assignable. 404 for an unknown id, 400 for an admin.
async function findFaculty(db, rawId) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) throw Object.assign(new Error('User not found'), { status: 404 });
  const [rows] = await db.query('SELECT user_id, role, first_name, last_name FROM users WHERE user_id = ?', [id]);
  if (!rows[0]) throw Object.assign(new Error('User not found'), { status: 404 });
  if (rows[0].role !== 'faculty') throw Object.assign(new Error('Only faculty can be assigned programs and courses'), { status: 400 });
  return rows[0];
}

const sendAssignmentsError = (res, err) => {
  if (err.status) return fail(res, err.status, err.message);
  console.error('ASSIGNMENTS ERROR:', err);
  return fail(res, 500, err.message);
};

router.get('/:id/assignments', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const user = await findFaculty(db, req.params.id);
    res.json(await assignments.describeAssignments(db, await assignments.loadAssignments(db, user.user_id)));
  } catch (err) { sendAssignmentsError(res, err); }
});

// Body: { programs: [ids], courses: [ids] }. Replaces everything; a course whose program is not in the list is dropped.
router.put('/:id/assignments', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const user = await findFaculty(db, req.params.id);
    const catalog = await assignments.loadCatalogIds(db);
    const next = assignments.normalizeAssignments(req.body, catalog);
    const before = await assignments.loadAssignments(db, user.user_id);
    await inTransaction(db, (conn) => assignments.saveAssignments(conn, user.user_id, next));

    const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
    const changed = !same(before.programIds, next.programIds) || !same(before.courseIds, next.courseIds);
    if (changed) {
      // After the commit: a failed notification never affects the result.
      await createNotification(db, {
        userId: user.user_id,
        type: 'assignment',
        title: 'Your program and course assignments were updated',
        body: next.courseIds.length
          ? `You can now create syllabi for ${next.courseIds.length} subject${next.courseIds.length === 1 ? '' : 's'}.`
          : (next.programIds.length ? assignments.NO_SUBJECT_YET : 'No program or subject is assigned to you right now. Ask an administrator.'),
      });
    }
    // Saving a program that has no subjects in the catalog yet is fine; the admin is told so the UI can explain it.
    const described = await assignments.describeAssignments(db, next);
    const emptyPrograms = described.programs
      .filter((p) => !catalog.courses.some((c) => c.programId === p.id))
      .map((p) => ({ id: p.id, code: p.code }));
    res.json({ ...described, dropped: next.dropped, changed, emptyPrograms });
  } catch (err) { sendAssignmentsError(res, err); }
});

// ---- Profile picture (own account only: there is no user id in the URL) ----
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const avatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: AVATAR_MAX_BYTES, files: 1 } }).single('avatar');

// Identify the image from its first bytes; the client's mimetype and filename are never trusted.
function detectImageExt(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}

const removeFile = async (file) => { if (file) await fs.promises.unlink(file).catch(() => {}); };

router.post('/me/avatar', requireAuth, (req, res) => {
  avatarUpload(req, res, async (uploadErr) => {
    if (uploadErr) {
      if (uploadErr.code === 'LIMIT_FILE_SIZE') return fail(res, 413, 'Image is too large. The maximum size is 2 MB.');
      if (uploadErr.code === 'LIMIT_UNEXPECTED_FILE') return fail(res, 400, 'Upload the image in the "avatar" field, one file only.');
      console.error('AVATAR UPLOAD ERROR:', uploadErr);
      return fail(res, 400, 'The upload could not be processed.');
    }
    let newFile = null;
    try {
      if (!req.file) return fail(res, 400, 'No image uploaded. Choose a JPEG, PNG or WebP file.');
      const ext = detectImageExt(req.file.buffer);
      if (!ext) return fail(res, 400, 'Unsupported file. Use a JPEG, PNG or WebP image.');

      const userId = req.session.user.id;
      const db = req.app.locals.db;
      const [rows] = await db.query('SELECT avatar_path FROM users WHERE user_id = ?', [userId]);
      const oldPath = rows[0]?.avatar_path;

      const name = `u${userId}-${Date.now()}.${ext}`;
      await fs.promises.mkdir(AVATAR_DIR, { recursive: true });
      newFile = path.join(AVATAR_DIR, name);
      await fs.promises.writeFile(newFile, req.file.buffer);

      const avatarPath = avatarRelPath(name);
      await db.query('UPDATE users SET avatar_path = ? WHERE user_id = ?', [avatarPath, userId]);
      await removeFile(avatarFile(oldPath)); // only after the new one is saved

      const avatarUrl = avatarUrlFor(userId, avatarPath);
      req.session.user.avatarUrl = avatarUrl;
      res.json({ avatarUrl });
    } catch (err) {
      await removeFile(newFile);
      console.error('AVATAR ERROR:', err);
      fail(res, 500, 'Could not save your photo. Please try again.');
    }
  });
});

router.delete('/me/avatar', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const db = req.app.locals.db;
    const [rows] = await db.query('SELECT avatar_path FROM users WHERE user_id = ?', [userId]);
    await db.query('UPDATE users SET avatar_path = NULL WHERE user_id = ?', [userId]);
    await removeFile(avatarFile(rows[0]?.avatar_path));
    req.session.user.avatarUrl = null;
    res.json({ avatarUrl: null });
  } catch (err) {
    console.error('AVATAR ERROR:', err);
    fail(res, 500, 'Could not remove your photo. Please try again.');
  }
});

// Anyone may see an avatar if they are an admin, the owner, or share a message thread with that user.
// Everything else gets a 404 (not 403) so the route doesn't reveal which users have photos.
router.get('/:id/avatar', requireAuth, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId <= 0) return res.sendStatus(404);
    const viewer = req.session.user;
    const db = req.app.locals.db;

    if (viewer.role !== 'admin' && viewer.id !== targetId) {
      const [shared] = await db.query(
        'SELECT 1 FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) LIMIT 1',
        [viewer.id, targetId, targetId, viewer.id]
      );
      if (shared.length === 0) return res.sendStatus(404);
    }

    const [rows] = await db.query('SELECT avatar_path FROM users WHERE user_id = ?', [targetId]);
    const file = avatarFile(rows[0]?.avatar_path);
    if (!file) return res.sendStatus(404);
    res.sendFile(file, {
      dotfiles: 'deny',
      cacheControl: false, // set explicitly below; Express still adds an ETag and answers If-None-Match with 304
      headers: { 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' },
    }, (err) => {
      if (err && !res.headersSent) res.sendStatus(404); // file missing on disk
    });
  } catch (err) {
    console.error('AVATAR ERROR:', err);
    fail(res, 500, 'Could not load that photo.');
  }
});

// Moderation: an admin can remove any user's photo.
router.delete('/:id/avatar', requireAdmin, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId <= 0) return fail(res, 404, 'User not found');
    const db = req.app.locals.db;
    const [rows] = await db.query('SELECT avatar_path FROM users WHERE user_id = ?', [targetId]);
    if (rows.length === 0) return fail(res, 404, 'User not found');
    await db.query('UPDATE users SET avatar_path = NULL WHERE user_id = ?', [targetId]);
    await removeFile(avatarFile(rows[0].avatar_path));
    // submission_logs needs a syllabus and a fixed action list, so moderation is recorded in the server log.
    console.warn(`AVATAR MODERATION: admin ${req.session.user.id} removed the photo of user ${targetId}`);
    res.json({ avatarUrl: null });
  } catch (err) {
    console.error('AVATAR ERROR:', err);
    fail(res, 500, 'Could not remove that photo. Please try again.');
  }
});

// Offboarding: deleting the row removes access (the user can no longer sign in).
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    if (Number(req.params.id) === req.session.user.id) return fail(res, 400, 'You cannot remove your own account');
    const [result] = await req.app.locals.db.query('DELETE FROM users WHERE user_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return fail(res, 404, 'User not found');
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('USERS ERROR:', err);
    fail(res, 500, err.message);
  }
});

module.exports = router;
module.exports.resendLimiter = resendLimiter;
