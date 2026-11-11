'use strict';
// Sessions in the database (docs/security/SECURITY-AUDIT-REPORT.md SEC-09). express-session's default MemoryStore keeps sessions in this process only: a restart
// signs everyone out, a second server process does not know them, and they are never removed. This store keeps them in the table `sessions`:
//   - a session survives a restart and is shared by every server process;
//   - it is stored under the SHA-256 of its id, so a copy of the table (a backup, a dump) cannot be used to sign in;
//   - it ends on the server: at its cookie's expiry, or LIFETIME_MS after its last use for a browser-session cookie; a sweep removes ended rows;
//   - ending an account's sessions (a password change, new credentials: middleware/auth.js endSessionsOf) deletes that account's rows, for every process;
//   - deleting an account deletes its sessions (ON DELETE CASCADE).
// No new dependency: it uses the server's own mysql2 pool. The table comes from db/migrate-session-store.js (and schema.sql for fresh installs).
//
//   SESSION_STORE   memory | mysql. Development: memory by default. Staging and production: mysql, always (memory is refused). A bad value stops the server.
const crypto = require('crypto');
const session = require('express-session');
const { hardened } = require('./sessionSecret');

const LIFETIME_MS = 24 * 60 * 60 * 1000; // a browser-session cookie still ends on the server a day after its last use
const SWEEP_EVERY_MS = 15 * 60 * 1000;
const SESSIONS_DDL = `CREATE TABLE IF NOT EXISTS sessions (
  session_id CHAR(64) NOT NULL PRIMARY KEY,
  user_id INT NULL,
  expires DATETIME NOT NULL,
  data MEDIUMTEXT NOT NULL,
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_expires (expires),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
)`;

const fail = (code, message) => Object.assign(new Error(message), { code });
const keyOf = (sid) => crypto.createHash('sha256').update(String(sid)).digest('hex');

function resolveSessionStore(env = process.env) {
  const strict = hardened(env), mode = String(env.NODE_ENV || '').trim().toLowerCase();
  const raw = String(env.SESSION_STORE || '').trim().toLowerCase();
  if (raw && !['memory', 'mysql'].includes(raw)) throw fail('session_store_invalid', 'SESSION_STORE must be memory or mysql.');
  if (strict && raw === 'memory') throw fail('session_store_invalid', `SESSION_STORE=memory is refused with NODE_ENV=${mode}: sessions must be kept in the database (mysql), so a restart or a second server process does not lose or revive them.`);
  return raw || (strict ? 'mysql' : 'memory');
}

// Before the server listens, with SESSION_STORE=mysql: the table must be there.
async function assertSessionTableReady(db) {
  try { await db.query('SELECT 1 FROM sessions LIMIT 1'); }
  catch (error) {
    if (error && error.code === 'ER_NO_SUCH_TABLE') throw fail('session_store_not_ready', 'The sessions table does not exist. Run "npm run migrate-session-store" in server/ (with the migration database account), or set SESSION_STORE=memory in development.');
    throw fail('session_store_not_ready', 'The sessions table could not be read (' + ((error && error.code) || 'error') + ').');
  }
}

class MySqlSessionStore extends session.Store {
  constructor(db, { lifetimeMs = LIFETIME_MS, sweepEveryMs = SWEEP_EVERY_MS } = {}) {
    super();
    this.db = db;
    this.lifetimeMs = lifetimeMs;
    if (sweepEveryMs) { this.timer = setInterval(() => this.sweep().catch((e) => console.error('SESSIONS: sweep failed (' + (e.code || 'error') + ').')), sweepEveryMs); this.timer.unref(); }
  }
  expiresOf(sess) {
    const at = sess && sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires).getTime() : NaN;
    return new Date(Number.isFinite(at) ? at : Date.now() + this.lifetimeMs);
  }
  get(sid, cb) {
    this.db.query('SELECT data FROM sessions WHERE session_id = ? AND expires > ?', [keyOf(sid), new Date()])
      .then(([rows]) => { if (!rows.length) return cb(null, null); let data; try { data = JSON.parse(rows[0].data); } catch { return cb(null, null); } cb(null, data); }, cb);
  }
  set(sid, sess, cb = () => {}) {
    const userId = sess && sess.user && Number.isInteger(Number(sess.user.id)) ? Number(sess.user.id) : null;
    this.db.query('INSERT INTO sessions (session_id, user_id, expires, data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), expires = VALUES(expires), data = VALUES(data)',
      [keyOf(sid), userId, this.expiresOf(sess), JSON.stringify(sess)]).then(() => cb(null), cb);
  }
  touch(sid, sess, cb = () => {}) {
    this.db.query('UPDATE sessions SET expires = ? WHERE session_id = ?', [this.expiresOf(sess), keyOf(sid)]).then(() => cb(null), cb);
  }
  destroy(sid, cb = () => {}) {
    this.db.query('DELETE FROM sessions WHERE session_id = ?', [keyOf(sid)]).then(() => cb(null), cb);
  }
  async destroyUser(userId) { await this.db.query('DELETE FROM sessions WHERE user_id = ?', [Number(userId)]); }
  async sweep() { const [r] = await this.db.query('DELETE FROM sessions WHERE expires <= ?', [new Date()]); return (r && r.affectedRows) || 0; }
  close() { if (this.timer) clearInterval(this.timer); }
}

module.exports = { MySqlSessionStore, resolveSessionStore, assertSessionTableReady, SESSIONS_DDL, LIFETIME_MS };
