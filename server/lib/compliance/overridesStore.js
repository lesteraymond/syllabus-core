'use strict';
// Keeps the developer edits of the standard (overrides.js) in the database: the current edit set in app_settings, one row per change in
// standard_changes. `rev` only ever goes up (a reset counts as a change), so a version label such as v7.3 is never used for two different
// rule sets and a stored check made under one is never taken for current under another.
const o = require('./overrides');

const KEY = 'standard_overrides';
let state = { rev: 0, doc: {} };

async function ensure(db) {
  await db.query('CREATE TABLE IF NOT EXISTS standard_changes (change_id INT AUTO_INCREMENT PRIMARY KEY, who VARCHAR(80) NOT NULL, rev INT NOT NULL, kind VARCHAR(10) NOT NULL, changes LONGTEXT NOT NULL, changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_standard_changes_time (changed_at))');
}

async function load(db) {
  const [rows] = await db.query('SELECT setting_value FROM app_settings WHERE setting_key = ?', [KEY]);
  let saved = null;
  try { saved = rows[0] ? JSON.parse(rows[0].setting_value) : null; } catch { saved = null; }
  const checked = saved && Number.isInteger(saved.rev) ? { rev: saved.rev, ...o.validate(saved.doc) } : null;
  state = checked && !checked.errors.length ? { rev: checked.rev, doc: checked.doc } : { rev: 0, doc: {} };
  o.apply(state.doc, state.rev);
  return state;
}

const write = (db, next) => db.query('INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', [KEY, JSON.stringify(next)]);

// `who` is a short label for the history (the caller's address: the editor has a password, not accounts).
// -> { state, changes } or { errors }
async function save(db, who, input) {
  const { doc, errors } = o.validate(input);
  if (errors.length) return { errors };
  const changes = o.describe(state.doc, doc);
  if (!changes.length) return { state, changes };
  const next = { rev: state.rev + 1, doc };
  await ensure(db);
  await write(db, next);
  await db.query('INSERT INTO standard_changes (who, rev, kind, changes) VALUES (?, ?, ?, ?)', [who, next.rev, 'save', JSON.stringify(changes)]);
  state = next;
  o.apply(state.doc, state.rev);
  return { state, changes };
}

async function reset(db, who) {
  const changes = o.describe(state.doc, {});
  if (!changes.length) return { state, changes };
  const next = { rev: state.rev + 1, doc: {} };
  await ensure(db);
  await write(db, next);
  await db.query('INSERT INTO standard_changes (who, rev, kind, changes) VALUES (?, ?, ?, ?)', [who, next.rev, 'reset', JSON.stringify(changes)]);
  state = next;
  o.apply(state.doc, state.rev);
  return { state, changes };
}

async function history(db, limit = 30) {
  await ensure(db);
  const [rows] = await db.query('SELECT change_id, rev, kind, who, changes, changed_at FROM standard_changes ORDER BY change_id DESC LIMIT ?', [limit]);
  return rows.map((r) => {
    let changes = [];
    try { changes = JSON.parse(r.changes); } catch { changes = []; }
    return { id: r.change_id, rev: r.rev, kind: r.kind, at: r.changed_at, by: r.who, changes };
  });
}

const current = () => state;

module.exports = { load, save, reset, history, current, ensure };
