'use strict';
// Generated passwords expire (docs/security/SECURITY-AUDIT-REPORT.md SEC-12). A password the system makes and emails (an administrator registering a user,
// "Resend credentials", db/create-admin.js) must be replaced at the first sign-in (must_change_password). Until now it stayed valid for good if the person never
// signed in, so an old welcome email was a working password forever. Now it works for GENERATED_PASSWORD_DAYS days (users.password_expires_at); after that a
// sign-in with it is refused (routes/auth.js) and the person uses "Forgot password" or asks for new credentials. A password the person chose never expires:
// the check applies only while must_change_password is set. The temporary password of "Forgot password" has its own 30 minutes (password_temp).
//
//   GENERATED_PASSWORD_DAYS   1 to 90, default 7. A bad value stops the server at startup, by name.
//
// The column comes from db/migrate-password-expiry.js. Before it, nothing expires and setting an expiry quietly does nothing.
const DAY_MS = 24 * 60 * 60 * 1000;
const fail = (message) => Object.assign(new Error(message), { code: 'password_expiry_invalid' });

function resolveGeneratedPasswordDays(env = process.env) {
  const raw = String(env?.GENERATED_PASSWORD_DAYS ?? '').trim();
  if (!raw) return 7;
  if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 90) throw fail('GENERATED_PASSWORD_DAYS must be a whole number from 1 to 90 (the default is 7).');
  return Number(raw);
}

const expiresAt = (now = Date.now(), env = process.env) => new Date(now + resolveGeneratedPasswordDays(env) * DAY_MS);

// A users row: is its password a generated one, still waiting to be replaced, past its time?
function isExpired(user, now = Date.now()) {
  if (!user || !Number(user.must_change_password) || !user.password_expires_at) return false;
  const at = new Date(user.password_expires_at).getTime();
  return Number.isFinite(at) && at <= now;
}

// After a generated password is stored for userId. Best effort: true when the expiry was written, false before the migration (or on any error, logged once).
let reported = false;
async function setExpiry(db, userId, now = Date.now()) {
  try {
    await db.query('UPDATE users SET password_expires_at = ? WHERE user_id = ?', [expiresAt(now), Number(userId)]);
    return true;
  } catch (error) {
    if (!reported && !(error && error.code === 'ER_BAD_FIELD_ERROR')) { reported = true; console.error('PASSWORD EXPIRY: could not set it (' + ((error && error.code) || 'error') + ').'); }
    return false;
  }
}

const EXPIRED = 'This password was made for you by the system and has expired without being used. Use "Forgot password" on the sign-in page, or ask the administrator to send new credentials.';

module.exports = { resolveGeneratedPasswordDays, expiresAt, isExpired, setExpiry, EXPIRED };
