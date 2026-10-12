const crypto = require('crypto');

const REMEMBER_COOKIE = 'remember_token';
const REMEMBER_DAYS = 30;
const REMEMBER_MS = REMEMBER_DAYS * 24 * 60 * 60 * 1000;

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
  return { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' };
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
      `SELECT t.token_id, u.user_id, u.email, u.role, u.first_name, u.last_name
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
    await db.query('DELETE FROM remember_tokens WHERE token_id = ?', [u.token_id]);
    req.session.user = { id: u.user_id, email: u.email, role: u.role, firstName: u.first_name, lastName: u.last_name };
    req.session.cookie.maxAge = REMEMBER_MS;
    await issueRememberToken(db, res, u.user_id);
    next();
  } catch (err) {
    next(err);
  }
}

// Offboarding: once an admin deletes the user row, a still-alive session stops working.
async function requireAuth(req, res, next) {
  try {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
    const [rows] = await req.app.locals.db.query('SELECT user_id FROM users WHERE user_id = ?', [req.session.user.id]);
    if (rows.length === 0) {
      return req.session.destroy(() => res.status(403).json({ message: 'Access Denied. Account not registered.', error: 'Access Denied. Account not registered.' }));
    }
    next();
  } catch (err) {
    next(err);
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (req.session.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
  });
}

module.exports = { requireAuth, requireAdmin, restoreSession, issueRememberToken, revokeRememberToken, REMEMBER_MS };
