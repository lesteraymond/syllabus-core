const crypto = require('crypto');
const { activeOnly, isDisabled, disabledBody } = require('../lib/accountStatus');
const { avatarUrlFor } = require('../lib/avatar');
const { isReviewer, isApprover, canAuthor } = require('../lib/roles');
const { cookieSettingsOf } = require('../lib/hostConfig');
const accountActivity = require('../lib/accountActivity'); // a session restored from a remembered device is a sign-in too (Recent Activity, best effort)

const REMEMBER_COOKIE = 'remember_token';
const REMEMBER_DAYS = 30;
const REMEMBER_MS = REMEMBER_DAYS * 24 * 60 * 60 * 1000;

// The one place a users row becomes the session/response user object.
const toSessionUser = (row) => ({
  id: row.user_id,
  email: row.email,
  role: row.role,
  preferredLanguage: row.preferred_language === 'tl' ? 'tl' : 'en',
  firstName: row.first_name,
  lastName: row.last_name,
  avatarUrl: avatarUrlFor(row.user_id, row.avatar_path),
  // true after a sign-in with a generated password: nothing else is open until the user has chosen their own (see requireAuth)
  mustChangePassword: !!row.must_change_password,
});

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function cookieOpts() {
  return cookieSettingsOf(process.env); // httpOnly always; Secure in staging and production; SameSite from SESSION_COOKIE_SAMESITE (default lax): the same flags as the session cookie
}

async function issueRememberToken(db, res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + REMEMBER_MS);
  await db.query('INSERT INTO remember_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [userId, hash(token), expires]);
  res.cookie(REMEMBER_COOKIE, token, { ...cookieOpts(), maxAge: REMEMBER_MS });
}

async function revokeRememberToken(db, req, res) {
  const token = readCookie(req, REMEMBER_COOKIE);
  if (token) await db.query('DELETE FROM remember_tokens WHERE token_hash = ?', [hash(token)]);
  res.clearCookie(REMEMBER_COOKIE, cookieOpts());
}

// If there is no live session but a valid remember cookie, restore the session
// and rotate the token (each token is single-use).
async function restoreSession(req, res, next) {
  try {
    if (req.session.user) return next();
    const token = readCookie(req, REMEMBER_COOKIE);
    if (!token) return next();
    const db = req.app.locals.db;
    const [rows] = await db.query(
      `SELECT t.token_id, u.*
       FROM remember_tokens t JOIN users u ON t.user_id = u.user_id
       WHERE t.token_hash = ? AND t.expires_at > NOW()`,
      [hash(token)]
    );
    await db.query('DELETE FROM remember_tokens WHERE expires_at <= NOW()');
    if (rows.length === 0) {
      res.clearCookie(REMEMBER_COOKIE, cookieOpts());
      return next();
    }
    const u = rows[0];
    if (u.disabled_at) { // a disabled account is never signed in from a remembered device
      await db.query('DELETE FROM remember_tokens WHERE user_id = ?', [u.user_id]);
      res.clearCookie(REMEMBER_COOKIE, cookieOpts());
      await accountActivity.record(db, { userId: u.user_id, action: 'login_failed', notes: 'disabled_remembered' });
      return next();
    }
    await db.query('DELETE FROM remember_tokens WHERE token_id = ?', [u.token_id]);
    req.session.user = toSessionUser(u);
    req.session.cookie.maxAge = REMEMBER_MS;
    await issueRememberToken(db, res, u.user_id);
    await accountActivity.record(db, { userId: u.user_id, action: 'login', notes: 'remembered' });
    next();
  } catch (err) {
    next(err);
  }
}

// Offboarding: once an admin deletes the user row, a still-alive session stops working.
// While the session carries mustChangePassword (signed in with a generated password) every API call is refused with 403 and
// code 'password_change_required', except the routes that use requireSignedIn: choosing the new password, signing out, /auth/me.
const PASSWORD_CHANGE = 'Choose your own password before you continue.';
function makeRequireAuth({ allowPasswordChange }) {
  return async function requireAuth(req, res, next) {
    try {
      if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
      const [rows] = await activeOnly(req.app.locals.db, 'SELECT user_id FROM users WHERE user_id = ?', [req.session.user.id]);
      if (rows.length === 0 && await isDisabled(req.app.locals.db, req.session.user.id).catch(() => false)) {
        return req.session.destroy(() => res.status(403).json(disabledBody())); // disabled since this session began: it ends here
      }
      if (rows.length === 0) {
        return req.session.destroy(() => res.status(403).json({ message: 'Access Denied. Account not registered.', error: 'Access Denied. Account not registered.' }));
      }
      if (req.session.user.mustChangePassword && !allowPasswordChange) {
        return res.status(403).json({ code: 'password_change_required', message: PASSWORD_CHANGE, error: PASSWORD_CHANGE });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
const requireAuth = makeRequireAuth({ allowPasswordChange: false });
const requireSignedIn = makeRequireAuth({ allowPasswordChange: true }); // signed in, even if a password change is still due

function requireAdmin(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (req.session.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
  });
}

// The people who check and review submitted syllabi (admin/dean, Asst. VPAA, LIC Director, VPAA), and the one who approves (VPAA).
function requireReviewer(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (!isReviewer(req.session.user)) return res.status(403).json({ error: 'Reviewer access required' });
    next();
  });
}
// The people who write syllabi: faculty and the administrator (lib/roles.js AUTHOR_ROLES). The Asst. VPAA, the LIC Director and the VPAA review only.
const AUTHORS_ONLY = 'Only faculty and the administrator write syllabi. The Asst. VPAA, the LIC Director and the VPAA review them.';
function requireAuthor(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (!canAuthor(req.session.user)) return res.status(403).json({ error: AUTHORS_ONLY, code: 'authors_only' });
    next();
  });
}
function requireApprover(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (!isApprover(req.session.user)) return res.status(403).json({ error: 'Only the VPAA can do this' });
    next();
  });
}

module.exports = { toSessionUser, requireAuth, requireSignedIn, requireAdmin, requireReviewer, requireApprover, requireAuthor, AUTHORS_ONLY, restoreSession, issueRememberToken, revokeRememberToken, REMEMBER_MS };
