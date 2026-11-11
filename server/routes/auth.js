const express = require('express');
const { activeOnly, isDisabled, disabledBody } = require('../lib/accountStatus');
const bcrypt = require('bcryptjs');
const { issueRememberToken, revokeRememberToken, toSessionUser, requireSignedIn, REMEMBER_MS, startSession, endSessionsOf, sessionEnded } = require('../middleware/auth');
const { resolveSignInLimits } = require('../lib/signInLimits');
const passwordExpiry = require('../lib/passwordExpiry'); // a generated password that was never replaced stops working (SEC-12)
const { createLimiter } = require('../lib/rateLimit');
const { generatePassword, validatePassword } = require('../lib/passwords');
const mailer = require('../lib/mailer');
const { domain, isSchoolEmail } = require('../lib/emailDomain');
const { OAuth2Client } = require('google-auth-library');
const accountActivity = require('../lib/accountActivity'); // sign-in, sign-out and password changes in the account's Recent Activity
const router = express.Router();

let googleClient = new OAuth2Client();
const setGoogleClient = (client) => { googleClient = client || new OAuth2Client(); }; // tests put a fake verifier here (like mailer.setTransport)

// Failed sign-ins are limited (lib/signInLimits.js): per account and per address for a password, per address for Google. A slot is taken before the
// password or token is looked at, so requests sent at the same moment cannot all slip past the limit, and handed back when the sign-in turns out to be
// correct: a correct sign-in is never counted, and it does not clear earlier failures either. Only password sign-in is ever closed for an account;
// Google sign-in and a remembered device still work for its owner, so nobody is locked out of their account by someone else's guesses.
const LIMITS = resolveSignInLimits(process.env);
const accountFailures = createLimiter({ max: LIMITS.perAccount, windowMs: LIMITS.windowMs });
const ipFailures = createLimiter({ max: LIMITS.perIp, windowMs: LIMITS.windowMs });
const googleFailures = createLimiter({ max: LIMITS.perIp, windowMs: LIMITS.windowMs });
const signInLimiter = { reset() { accountFailures.reset(); ipFailures.reset(); googleFailures.reset(); } };
const TOO_MANY = 'Too many attempts. Try again later.';
const tooMany = (res, slot) => { res.set('Retry-After', String(slot.retryAfterSec)); return res.status(429).json({ message: TOO_MANY, error: TOO_MANY, code: 'too_many_attempts' }); };
// An unknown email costs the same work as a wrong password, so the time an answer takes does not say whether the account exists.
const DUMMY_HASH = bcrypt.hashSync(require('crypto').randomBytes(18).toString('hex'), 10);
const INVALID = 'Invalid email or password';

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

// Verify a Google ID token, check the pre-registered allowlist, and sign in with the session cookie.
router.post('/google', async (req, res) => {
  try {
    const idToken = req.body.token ?? req.body.idToken;
    if (!idToken || typeof idToken !== 'string') return fail(res, 400, 'token is required');
    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error('GOOGLE AUTH ERROR: GOOGLE_CLIENT_ID is not set in server/.env');
      return fail(res, 500, 'Google sign-in is not configured on the server.');
    }

    const ipKey = 'ip:' + req.ip;
    const slot = googleFailures.take(ipKey);
    if (!slot.ok) return tooMany(res, slot);

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      console.error('GOOGLE AUTH ERROR: token verification failed:', verifyErr.message);
      return fail(res, 401, 'Google sign-in could not be verified. Please try again.');
    }

    const email = (payload.email || '').toLowerCase();
    if (!payload.email_verified || !isSchoolEmail(email)) {
      return fail(res, 403, `Access denied. Only @${domain()} accounts can sign in.`);
    }

    const db = req.app.locals.db;
    const [rows] = await db.query(
      'SELECT user_id, email, role, first_name, last_name, avatar_path, must_change_password, preferred_language FROM users WHERE LOWER(email) = LOWER(?)',
      [email]
    );
    const user = rows[0];
    // Allowlist: only users an admin has added to `users` may sign in. Offboarding = the row is deleted.
    if (!user) return fail(res, 403, 'Access Denied. Your account is not registered in the system.');
    if (await isDisabled(db, user.user_id)) { await accountActivity.record(db, { userId: user.user_id, action: 'login_failed', notes: 'disabled', request: req }); return res.status(403).json(disabledBody()); }

    // Also start the cookie session so the existing session-based routes keep working. A verified sign-in is not counted against the address.
    googleFailures.give(ipKey);
    const sessionUser = toSessionUser(user); // carries mustChangePassword: an account that still has its generated password chooses its own first
    await startSession(req, sessionUser);
    await accountActivity.record(db, { userId: user.user_id, action: 'login', notes: 'google', request: req }); // the account's Recent Activity (best effort)
    res.json({ user: sessionUser }); // the session cookie is the sign-in; no token is made (SEC-16)
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
    const ipKey = 'ip:' + req.ip, accountKey = 'account:' + login.toLowerCase().slice(0, 254);
    const ipSlot = ipFailures.take(ipKey);
    if (!ipSlot.ok) return tooMany(res, ipSlot);
    const accountSlot = accountFailures.take(accountKey);
    if (!accountSlot.ok) return tooMany(res, accountSlot);
    const [rows] = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [login]);
    const user = rows[0];
    // An unknown email gets the answer of a wrong password, after the same work: the reply does not say which emails are registered.
    if (!user) {
      await bcrypt.compare(String(password || ''), DUMMY_HASH);
      // recorded with no account (it has none), naming what was typed, so the administrator can see attempts on addresses that do not exist
      await accountActivity.record(db, { userId: null, action: 'login_failed', subject: login.slice(0, 254), notes: 'unknown_account', request: req });
      return fail(res, 401, INVALID);
    }

    let valid = user.password_hash ? await bcrypt.compare(String(password || ''), user.password_hash) : false;
    let viaTemp = false;
    if (!valid) { // the current password did not match: it may be the temporary one from "Forgot password"
      const temp = await findTemp(db, user.user_id);
      if (temp && await bcrypt.compare(String(password || ''), temp.temp_hash)) { valid = true; viaTemp = true; }
    }
    // A failed sign-in is recorded on the account it was for, so its owner (and the administrator) can see attempts they did not make. An unknown
    // email has no account to record it on. The answer to the person signing in is unchanged.
    if (!valid) { await accountActivity.record(db, { userId: user.user_id, action: 'login_failed', notes: 'password', request: req }); return fail(res, 401, INVALID); }
    ipFailures.give(ipKey); accountFailures.give(accountKey); // the password is right: this attempt is not a failure, whatever is answered next
    if (user.disabled_at) { await accountActivity.record(db, { userId: user.user_id, action: 'login_failed', notes: 'disabled', request: req }); return res.status(403).json(disabledBody()); }
    // A generated password past its time (only after the password is proven, so a guesser learns nothing). The temporary password of "Forgot password" is apart.
    if (!viaTemp && passwordExpiry.isExpired(user)) {
      await accountActivity.record(db, { userId: user.user_id, action: 'login_failed', notes: 'password_expired', request: req });
      return res.status(403).json({ message: passwordExpiry.EXPIRED, error: passwordExpiry.EXPIRED, code: 'password_expired' });
    } // only after the password is proven, so the answer reveals nothing to a guesser
    if (viaTemp) { // the current password stays valid until the new one is chosen
      await db.query('DELETE FROM password_temp WHERE user_id = ?', [user.user_id]).catch(() => {}); // a temporary password signs in once
      await db.query('UPDATE users SET must_change_password = 1 WHERE user_id = ?', [user.user_id]);
      user.must_change_password = 1;
    }

    if (user.role === 'student') {
      const [[profile]] = await db.query('SELECT verification_status FROM student_profiles WHERE user_id = ?', [user.user_id]);
      if (!profile || profile.verification_status === 'pending') return fail(res, 403, 'Your registration is waiting for an administrator to verify your COR.');
      if (profile.verification_status === 'rejected') return fail(res, 403, 'Your registration was rejected. Contact the administrator.');
    }

    const sessionUser = toSessionUser(user);
    await startSession(req, sessionUser); // a new session id at every sign-in
    if (remember) {
      req.session.cookie.maxAge = REMEMBER_MS;
      await issueRememberToken(db, res, user.user_id);
    } else {
      req.session.cookie.expires = false; // browser-session cookie
      await revokeRememberToken(db, req, res);
    }
    await accountActivity.record(db, { userId: user.user_id, action: 'login', notes: viaTemp ? 'temporary' : 'password', request: req }); // the account's Recent Activity (best effort)
    res.json({ user: sessionUser }); // the session cookie is the sign-in; no token is made (SEC-16)
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    fail(res, 500, 'Sign-in failed because of a server error. Please try again.');
  }
});

router.post('/logout', async (req, res) => {
  const who = req.session && req.session.user ? req.session.user.id : null; // signing out of a session that already ended records nothing
  if (Number.isInteger(who)) await accountActivity.record(req.app.locals.db, { userId: who, action: 'logout', request: req });
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
    const [rows] = await activeOnly(db, 'SELECT user_id, email, first_name FROM users WHERE LOWER(email) = ?', [email]); // a disabled account gets no temporary password
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
    await endSessionsOf(me.id); // every other open session of this account ends (with the database store: its rows are deleted, for every server process)
    await startSession(req, { ...me, mustChangePassword: false }, { keepCookie: true }); // and this one continues on a new session id
    await accountActivity.record(db, { userId: me.id, action: 'password_change', notes: me.mustChangePassword ? 'required' : 'self', request: req }); // never the password itself
    res.json({ message: 'Your password was changed.', user: req.session.user });
  } catch (err) {
    console.error('CHANGE PASSWORD ERROR:', err);
    fail(res, 500, 'The password could not be changed because of a server error.');
  }
});

router.get('/me', async (req, res) => {
  if (!req.session.user || sessionEnded(req)) return res.status(401).json({ error: 'Not authenticated' });
  try {
    // The account is authoritative, including preferences saved from another tab or device.
    const [rows] = await activeOnly(req.app.locals.db, 'SELECT user_id, email, role, first_name, last_name, avatar_path, must_change_password, preferred_language FROM users WHERE user_id = ?', [req.session.user.id]);
    if (!rows[0]) return res.status(401).json({ error: 'Not authenticated' });
    req.session.user = toSessionUser(rows[0]);
    res.json({ user: req.session.user });
  } catch { fail(res, 500, 'Could not load your account. Please try again.'); }
});

module.exports = router;
module.exports.forgotLimiter = forgotLimiter;
module.exports.signInLimiter = signInLimiter;
module.exports.setGoogleClient = setGoogleClient;
module.exports.settled = settled;
