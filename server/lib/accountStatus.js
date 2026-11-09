'use strict';
// Disabled accounts. Disabling keeps the account and everything it wrote (syllabi, versions, reviews, approvals, comments, checks); it only ends access:
// no password or Google sign-in, no remembered device, no "Forgot password", and any open session is refused at its next request (middleware/auth.js).
// The column comes from db/migrate-account-status.js. Before that migration has run, every account is active and disabling answers 503.
const { inTransaction, httpError } = require('./http');

const CODE = 'account_disabled';
const DISABLED = 'This account is disabled. Contact the administrator.';
const SELF = 'You cannot disable your own account.';
const LAST_ADMIN = 'At least one administrator account must stay active.';
const ACTOR_DISABLED = 'Your account is disabled.';
const NOT_INSTALLED = 'Disabling accounts is not set up on this server yet. Ask an administrator to run the database update.';
const RESEND_DISABLED = 'Enable this account before sending new credentials.';

const absent = (error) => !!error && (error.code === 'ER_BAD_FIELD_ERROR' || error.errno === 1054);
let missingUntil = 0; // a database without the column is asked again after 30 seconds, so running the migration needs no restart
const remember = () => { missingUntil = Date.now() + 30000; };

// sql must end with a WHERE condition: only active accounts are returned. Before the migration, sql runs as it is.
async function activeOnly(db, sql, params) {
  if (Date.now() >= missingUntil) {
    try { return await db.query(sql + ' AND disabled_at IS NULL', params); }
    catch (error) { if (!absent(error)) throw error; remember(); }
  }
  return db.query(sql, params);
}

async function isDisabled(db, userId) {
  if (Date.now() < missingUntil) return false;
  try {
    const [rows] = await db.query('SELECT disabled_at FROM users WHERE user_id = ?', [userId]);
    return !!(rows[0] && rows[0].disabled_at);
  } catch (error) {
    if (absent(error)) { remember(); return false; }
    throw error;
  }
}

const disabledBody = () => ({ message: DISABLED, error: DISABLED, code: CODE });

// Disable or enable an account. Every administrator row is locked with the target, in one statement and one order, so two administrators disabling each other
// at the same moment are serialized and the second sees the first: at least one administrator always stays active.
async function setDisabled(db, actorId, userId, disabled) {
  if (disabled && userId === actorId) throw httpError(400, SELF, { code: 'cannot_disable_self' });
  return inTransaction(db, async (conn) => {
    let rows;
    try { [rows] = await conn.query("SELECT user_id, role, disabled_at FROM users WHERE user_id = ? OR role = 'admin' ORDER BY user_id FOR UPDATE", [userId]); }
    catch (error) { if (absent(error)) throw httpError(503, NOT_INSTALLED, { code: 'account_status_not_installed' }); throw error; }
    const target = rows.find((row) => Number(row.user_id) === userId), actor = rows.find((row) => Number(row.user_id) === actorId);
    if (actor && actor.disabled_at) throw httpError(403, ACTOR_DISABLED, { code: CODE });
    if (!target) throw httpError(404, 'User not found');
    if (disabled && target.role === 'admin' && !rows.some((row) => row.role === 'admin' && Number(row.user_id) !== userId && !row.disabled_at)) throw httpError(409, LAST_ADMIN, { code: 'last_active_admin' });
    if (disabled && !target.disabled_at) {
      await conn.query('UPDATE users SET disabled_at = NOW(), disabled_by = ? WHERE user_id = ?', [actorId, userId]);
      await conn.query('DELETE FROM remember_tokens WHERE user_id = ?', [userId]); // remembered devices end now; open sessions end at their next request
      try { await conn.query('DELETE FROM password_temp WHERE user_id = ?', [userId]); } catch (error) { if (!error || error.code !== 'ER_NO_SUCH_TABLE') throw error; }
    }
    if (!disabled && target.disabled_at) await conn.query('UPDATE users SET disabled_at = NULL, disabled_by = NULL WHERE user_id = ?', [userId]);
    // changed: whether this call disabled or enabled anything (asking twice changes nothing the second time); the route keeps it out of its answer
    return { id: userId, disabled, changed: disabled ? !target.disabled_at : !!target.disabled_at };
  });
}

// Ids of disabled accounts, for the Users & Roles list (empty before the migration).
async function disabledIds(db) {
  try { const [rows] = await db.query('SELECT user_id FROM users WHERE disabled_at IS NOT NULL'); return new Set(rows.map((row) => Number(row.user_id))); }
  catch { return new Set(); }
}

module.exports = { CODE, DISABLED, SELF, LAST_ADMIN, NOT_INSTALLED, RESEND_DISABLED, activeOnly, isDisabled, disabledBody, setDisabled, disabledIds };
