const express = require('express');
const bcrypt = require('bcryptjs');
const { issueRememberToken, revokeRememberToken, toSessionUser, REMEMBER_MS } = require('../middleware/auth');
const { OAuth2Client } = require('google-auth-library');
const { signAccessToken, JWT_TTL } = require('../middleware/jwt');
const router = express.Router();

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'email.lcup.edu.ph';
const googleClient = new OAuth2Client();

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

    const valid = user.password_hash ? await bcrypt.compare(String(password || ''), user.password_hash) : false;
    if (!valid) return fail(res, 401, 'Invalid email or password');

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

router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user: req.session.user });
});

module.exports = router;
