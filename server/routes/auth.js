const express = require('express');
const bcrypt = require('bcryptjs');
const { issueRememberToken, revokeRememberToken, toSessionUser, requireSignedIn, REMEMBER_MS } = require('../middleware/auth');
const { createLimiter } = require('../lib/rateLimit');
const { generatePassword, validatePassword } = require('../lib/passwords');
const mailer = require('../lib/mailer');
const { OAuth2Client } = require('google-auth-library');
const { signAccessToken, JWT_TTL } = require('../middleware/jwt');
const router = express.Router();

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'email.lcup.edu.ph';
const googleClient = new OAuth2Client();

// "Forgot password" emails a temporary password. It is kept in password_temp, apart from the real one, and lasts TEMP_MINUTES: asking for
// one never changes the current password, so nobody can lock someone out by typing their email.
const TEMP_MINUTES = 30;
const FORGOT_MESSAGE = 'If that email is registered, a temporary password has been sent.';
const forgotLimiter = createLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
const pendingMail = new Set(); // sends in flight, so tests can wait for them
const settled = () => Promise.all([...pendingMail]);

// The unexpired temporary password of a user, or null. A database without the table yet simply has none.
async function findTemp(db, userId) {
  try {
    const [rows] = await db.query('SELECT temp_hash FROM password_temp WHERE user_id = ? AND expires_at > NOW()', [userId]);
    return rows[0] || null;
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return null;
    throw err;
  }
}

// Responses carry both `message` and `error` so the UI and older callers can read either.
const fail = (res, status, message) => res.status(status).json({ message, error: message });

// Verify a Google ID token, check the pre-registered allowlist, issue an 8-hour JWT.
router.post('/google', async (req, res) => {
  try {
    const idToken = req.body.token ?? req.body.idToken;
    if (!idToken || typeof idToken !== 'string') return fail(res, 400, 'token is required');
    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error('GOOGLE AUTH ERROR: GOOGLE_CLIENT_ID is not set in server/.env');
      return fail(res, 500, 'Google sign-in is not configured on the server.');
    }
    if (!process.env.JWT_SECRET) {
      console.error('GOOGLE AUTH ERROR: JWT_SECRET is not set in server/.env');
      return fail(res, 500, 'Server is missing its JWT secret.');
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      console.error('GOOGLE AUTH ERROR: token verification failed:', verifyErr.message);
      return fail(res, 401, 'Google sign-in could not be verified. Please try again.');
    }

    const email = (payload.email || '').toLowerCase();
    if (!payload.email_verified || !email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      return fail(res, 403, `Access denied. Only @${ALLOWED_DOMAIN} accounts can sign in.`);
    }

    const db = req.app.locals.db;
    const [rows] = await db.query(
      'SELECT user_id, email, role, first_name, last_name, avatar_path FROM users WHERE LOWER(email) = LOWER(?)',
      [email]
    );
    const user = rows[0];
    // Allowlist: only users an admin has added to `users` may sign in. Offboarding = the row is deleted.
    if (!user) return fail(res, 403, 'Access Denied. Your account is not registered in the system.');

    // Also start the cookie session so the existing session-based routes keep working.
    const sessionUser = toSessionUser(user);
    req.session.user = sessionUser;
    res.json({ token: signAccessToken(user), tokenType: 'Bearer', expiresIn: JWT_TTL, user: sessionUser });
  } catch (error) {
    console.error('GOOGLE AUTH ERROR:', error);
    fail(res, 500, 'Sign-in failed because of a server error. Please try again.');
  }
});


router.post('/login', async (req, res) => {
  try {
    const { email, password, remember } = req.body;
    const db = req.app.locals.db;
    // A student ID may be typed with or without its dashes: 244233624 is the same as 24-4233-624.
    const typed = String(email || '').trim();
    const idMatch = typed.match(/^(\d{2})\s*-?\s*(\d{4})\s*-?\s*(\d{3})$/);
    const login = idMatch ? `${idMatch[1]}-${idMatch[2]}-${idMatch[3]}` : typed;
    const [rows] = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [login]);
    const user = rows[0];
    if (!user) return fail(res, 403, 'Access Denied. Account not registered.');

    let valid = user.password_hash ? await bcrypt.compare(String(password || ''), user.password_hash) : false;
    let viaTemp = false;
    if (!valid) { // the current password did not match: it may be the temporary one from "Forgot password"
      const temp = await findTemp(db, user.user_id);
      if (temp && await bcrypt.compare(String(password || ''), temp.temp_hash)) { valid = true; viaTemp = true; }
    }
    if (!valid) return fail(res, 401, 'Invalid email or password');
    if (viaTemp) { // the current password stays valid until the new one is chosen
      await db.query('UPDATE users SET must_change_password = 1 WHERE user_id = ?', [user.user_id]);
      user.must_change_password = 1;
    }

    if (user.role === 'student') {
      const [[profile]] = await db.query('SELECT verification_status FROM student_profiles WHERE user_id = ?', [user.user_id]);
      if (!profile || profile.verification_status === 'pending') return fail(res, 403, 'Your registration is waiting for an administrator to verify your COR.');
      if (profile.verification_status === 'rejected') return fail(res, 403, 'Your registration was rejected. Contact the administrator.');
    }

    const sessionUser = toSessionUser(user);
    req.session.user = sessionUser;
    if (remember) {
      req.session.cookie.maxAge = REMEMBER_MS;
      await issueRememberToken(db, res, user.user_id);
    } else {
      req.session.cookie.expires = false; // browser-session cookie
      await revokeRememberToken(db, req, res);
    }
    res.json({ token: signAccessToken(user), tokenType: 'Bearer', expiresIn: JWT_TTL, user: sessionUser });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    fail(res, 500, 'Sign-in failed because of a server error. Please try again.');
  }
});

router.post('/logout', async (req, res) => {
  try { await revokeRememberToken(req.app.locals.db, req, res); } catch {}
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

// Always the same answer, whether or not the email is registered (and the work happens after the answer, so the time is the same too).
router.post('/forgot-password', async (req, res) => {
  const email = String(req.body && req.body.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(res, 400, 'Enter the email address you registered with.');
  const slot = [forgotLimiter.take('ip:' + req.ip), forgotLimiter.take('email:' + email)].find((x) => !x.ok);
  if (slot) {
    res.set('Retry-After', String(slot.retryAfterSec));
    return fail(res, 429, 'Too many requests. Try again in ' + Math.ceil(slot.retryAfterSec / 60) + ' minute(s).');
  }
  res.json({ message: FORGOT_MESSAGE });

  const db = req.app.locals.db;
  const job = (async () => {
    const [rows] = await db.query('SELECT user_id, email, first_name FROM users WHERE LOWER(email) = ?', [email]);
    const user = rows[0];
    if (!user) return;
    const password = generatePassword();
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO password_temp (user_id, temp_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ' + TEMP_MINUTES + ' MINUTE)) ON DUPLICATE KEY UPDATE temp_hash = VALUES(temp_hash), expires_at = VALUES(expires_at), created_at = CURRENT_TIMESTAMP',
      [user.user_id, hash]
    );
    await mailer.sendCredentials({ to: user.email, name: user.first_name, password, reason: 'forgot' });
  })().catch((err) => console.error('FORGOT PASSWORD ERROR:', err.message));
  pendingMail.add(job);
  job.finally(() => pendingMail.delete(job));
});

// The signed-in user chooses their own password. Right after a generated one (welcome email or "Forgot password") the sign-in itself
// was the proof, so the current password is not asked again; otherwise it is.
router.post('/change-password', requireSignedIn, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const me = req.session.user;
    const { currentPassword, newPassword } = req.body || {};
    const problem = validatePassword(newPassword, { email: me.email });
    if (problem) return fail(res, 400, problem);
    const [rows] = await db.query('SELECT user_id, password_hash FROM users WHERE user_id = ?', [me.id]);
    if (!rows[0]) return fail(res, 404, 'Account not found');
    if (!me.mustChangePassword) {
      const ok = rows[0].password_hash ? await bcrypt.compare(String(currentPassword || ''), rows[0].password_hash) : false;
      if (!ok) return fail(res, 401, 'Your current password is not correct.');
    }
    const hash = await bcrypt.hash(String(newPassword), 10);
    await db.query('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE user_id = ?', [hash, me.id]);
    await db.query('DELETE FROM password_temp WHERE user_id = ?', [me.id]).catch(() => {}); // a database without the table has nothing to clear
    await db.query('DELETE FROM remember_tokens WHERE user_id = ?', [me.id]); // devices that stayed signed in must sign in again
    req.session.user = { ...me, mustChangePassword: false };
    res.json({ message: 'Your password was changed.', user: req.session.user });
  } catch (err) {
    console.error('CHANGE PASSWORD ERROR:', err);
    fail(res, 500, 'The password could not be changed because of a server error.');
  }
});

router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user: req.session.user });
});

module.exports = router;
module.exports.forgotLimiter = forgotLimiter;
module.exports.settled = settled;
