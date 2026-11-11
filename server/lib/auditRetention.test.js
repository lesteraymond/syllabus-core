// The audit trail outlives what it is about (docs/security/SECURITY-AUDIT-REPORT.md SEC-15, DB-04): deleting an account or a syllabus keeps the rows of what was
// done (submission_logs, account_activity), named as they were; every sign-in line says from which address and browser; a sign-in attempt on an email that is
// not registered is recorded too. The migration that brings an existing database there is idempotent and has a dry run. No database. Run: npm test (project root).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const activity = require('./accountActivity');
const { migrate, plan } = require('../db/migrate-audit-retention');

const norm = (s) => s.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();
const schema = norm(fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'));
const tableOf = (name) => { const m = new RegExp(`CREATE TABLE IF NOT EXISTS ${name} \\((.*?)\\);`).exec(schema); assert.ok(m, name); return m[1]; };

test('schema.sql: deleting an account or a syllabus keeps its audit rows (SET NULL), and the rows can name them', () => {
  const logs = tableOf('submission_logs');
  assert.match(logs, /syllabus_id INT NULL/);
  assert.match(logs, /user_id INT NULL/);
  assert.match(logs, /subject VARCHAR\(300\) NULL/);
  assert.match(logs, /actor VARCHAR\(300\) NULL/);
  assert.match(logs, /FOREIGN KEY \(syllabus_id\) REFERENCES syllabi\(syllabus_id\) ON DELETE SET NULL/);
  assert.match(logs, /FOREIGN KEY \(user_id\) REFERENCES users\(user_id\) ON DELETE SET NULL/);
  const account = tableOf('account_activity');
  assert.match(account, /user_id INT NULL/);
  for (const column of ['actor VARCHAR\\(300\\) NULL', 'ip_address VARCHAR\\(45\\) NULL', 'user_agent VARCHAR\\(255\\) NULL']) assert.match(account, new RegExp(column));
  assert.match(account, /FOREIGN KEY \(user_id\) REFERENCES users\(user_id\) ON DELETE SET NULL/);
  assert.doesNotMatch(logs + account, /ON DELETE CASCADE/);
});

// A database as it is before the migration: the old columns, CASCADE on both tables.
function oldDatabase({ migrated = false } = {}) {
  const columns = {
    submission_logs: { log_id: 'NO', syllabus_id: migrated ? 'YES' : 'NO', user_id: migrated ? 'YES' : 'NO', action: 'NO', action_date: 'YES', notes: 'YES', ...(migrated ? { subject: 'YES', actor: 'YES' } : {}) },
    account_activity: { activity_id: 'NO', user_id: migrated ? 'YES' : 'NO', action: 'NO', syllabus_id: 'YES', subject: 'YES', notes: 'YES', created_at: 'YES', ...(migrated ? { actor: 'YES', ip_address: 'YES', user_agent: 'YES' } : {}) },
  };
  const rule = migrated ? 'SET NULL' : 'CASCADE';
  const fks = [
    { table_name: 'submission_logs', column_name: 'syllabus_id', constraint_name: 'submission_logs_ibfk_1', delete_rule: rule, referenced_table_name: 'syllabi' },
    { table_name: 'submission_logs', column_name: 'user_id', constraint_name: 'submission_logs_ibfk_2', delete_rule: rule, referenced_table_name: 'users' },
    { table_name: 'account_activity', column_name: 'user_id', constraint_name: 'account_activity_ibfk_1', delete_rule: rule, referenced_table_name: 'users' },
    { table_name: 'account_activity', column_name: 'syllabus_id', constraint_name: 'account_activity_ibfk_2', delete_rule: 'SET NULL', referenced_table_name: 'syllabi' },
  ];
  const ran = [];
  return {
    ran,
    async query(sql) {
      if (/FROM information_schema\.columns/i.test(sql)) return [Object.entries(columns).flatMap(([table_name, cols]) => Object.entries(cols).map(([column_name, is_nullable]) => ({ table_name, column_name, is_nullable })))];
      if (/FROM information_schema\.key_column_usage/i.test(sql)) return [fks];
      ran.push(sql.replace(/\s+/g, ' ').trim());
      return [{}];
    },
  };
}

test('the migration adds the columns, makes the keys nullable and keeps rows on delete; a dry run changes nothing', async () => {
  const db = oldDatabase();
  const dry = await migrate(db, { dryRun: true });
  assert.equal(db.ran.length, 0, 'a dry run changes nothing');
  assert.ok(dry.steps.length >= 4);
  const done = await migrate(db);
  assert.deepEqual(done.steps, dry.steps);
  const all = db.ran.join('\n');
  assert.match(all, /ALTER TABLE submission_logs ADD COLUMN subject VARCHAR\(300\) NULL/);
  assert.match(all, /ALTER TABLE submission_logs ADD COLUMN actor VARCHAR\(300\) NULL/);
  assert.match(all, /ALTER TABLE account_activity ADD COLUMN ip_address VARCHAR\(45\) NULL/);
  assert.match(all, /ALTER TABLE submission_logs DROP FOREIGN KEY `submission_logs_ibfk_2`, MODIFY user_id INT NULL, ADD CONSTRAINT `fk_submission_logs_user` FOREIGN KEY \(user_id\) REFERENCES users\(user_id\) ON DELETE SET NULL/);
  assert.match(all, /ALTER TABLE account_activity DROP FOREIGN KEY `account_activity_ibfk_1`, MODIFY user_id INT NULL, ADD CONSTRAINT `fk_account_activity_user` FOREIGN KEY \(user_id\) REFERENCES users\(user_id\) ON DELETE SET NULL/);
  assert.doesNotMatch(all, /account_activity_ibfk_2/, 'the syllabus key of account_activity already keeps its rows');
  assert.doesNotMatch(all, /DROP TABLE|DELETE FROM|TRUNCATE/);
});

test('the migration is idempotent: a database that already has the new shape gets nothing', async () => {
  const db = oldDatabase({ migrated: true });
  assert.deepEqual((await migrate(db)).steps, []);
  assert.equal(db.ran.length, 0);
});

test('a constraint name that is not a plain identifier stops the migration before anything is changed', async () => {
  const db = oldDatabase();
  const original = db.query.bind(db);
  db.query = async (sql) => { const out = await original(sql); if (/key_column_usage/i.test(sql)) out[0][1].constraint_name = 'x`; DROP TABLE users; --'; return out; };
  await assert.rejects(migrate(db), /constraint name/);
  assert.equal(db.ran.length, 0);
});

// ---- writing the activity ----

const writer = ({ old = false } = {}) => {
  const rows = [];
  return {
    rows,
    async query(sql, p) {
      if (!sql.startsWith('INSERT INTO account_activity')) throw new Error('unexpected query: ' + sql);
      if (old && /ip_address/.test(sql)) throw Object.assign(new Error("Unknown column 'ip_address' in 'field list'"), { code: 'ER_BAD_FIELD_ERROR' });
      if (old && p[0] === null) throw Object.assign(new Error("Column 'user_id' cannot be null"), { code: 'ER_BAD_NULL_ERROR' });
      rows.push({ sql, p });
      return [{}];
    },
  };
};
const request = { ip: '203.0.113.9', headers: { 'user-agent': 'Mozilla/5.0 ' + 'x'.repeat(400) } };

test('a sign-in line records the address and the browser, cut to fit', async () => {
  activity._resetColumnsProbe();
  const db = writer();
  assert.equal(await activity.record(db, { userId: 5, action: 'login', notes: 'password', request }), true);
  const [user_id, action, syllabus_id, subject, notes, ip, agent] = db.rows[0].p;
  assert.deepEqual([user_id, action, syllabus_id, subject, notes, ip], [5, 'login', null, null, 'password', '203.0.113.9']);
  assert.equal(agent.length, 255);
});

test('before the migration the same line is written without them, and nothing fails', async () => {
  activity._resetColumnsProbe();
  const db = writer({ old: true });
  assert.equal(await activity.record(db, { userId: 5, action: 'login', request }), true);
  assert.equal(db.rows[0].p.length, 5);
  assert.equal(await activity.record(db, { userId: 5, action: 'logout', request }), true);
  assert.equal(db.rows[1].p.length, 5, 'the old shape is remembered, not asked again each time');
});

test('a failed sign-in on an email that is not registered is recorded with no account, naming what was typed', async () => {
  activity._resetColumnsProbe();
  const db = writer();
  assert.equal(await activity.record(db, { userId: null, action: 'login_failed', subject: 'nobody@x.ph', notes: 'unknown_account', request }), true);
  assert.deepEqual(db.rows[0].p.slice(0, 5), [null, 'login_failed', null, 'nobody@x.ph', 'unknown_account']);
  assert.equal(await activity.record(db, { userId: null, action: 'login' }), false, 'only a failed sign-in may have no account');
  activity._resetColumnsProbe();
  const old = writer({ old: true });
  assert.equal(await activity.record(old, { userId: null, action: 'login_failed', subject: 'nobody@x.ph', request }), false, 'before the migration it cannot be stored, and that is not an error');
});

test('reading the activity keeps the lines of a deleted account, by the name it had', async () => {
  let asked = '';
  const db = { query: async (sql) => { asked = sql.replace(/\s+/g, ' '); return [[
    { activity_id: 1, user_id: null, actor: 'Fay Flores', action: 'login', syllabus_id: null, subject: null, notes: null, created_at: '2026-11-12T00:00:00Z', first_name: null, last_name: null, course_code: null, title: null },
    { activity_id: 2, user_id: null, actor: null, action: 'login_failed', syllabus_id: null, subject: 'nobody@x.ph', notes: 'unknown_account', created_at: '2026-11-12T00:01:00Z', first_name: null, last_name: null, course_code: null, title: null },
  ]]; } };
  const rows = await activity.listFor(db, null, 10);
  assert.match(asked, /FROM account_activity a LEFT JOIN users u ON u\.user_id = a\.user_id/);
  assert.equal(rows[0].user, 'Fay Flores');
  assert.equal(rows[1].user, 'Unknown account');
});

test('the routes name what is about to be deleted on its audit rows, and read audit rows whose account or syllabus is gone', () => {
  const users = fs.readFileSync(path.join(__dirname, '../routes/users.js'), 'utf8');
  assert.match(users, /keepAuditName\(conn, req\.params\.id, whose\)/);
  const syllabi = fs.readFileSync(path.join(__dirname, '../routes/syllabi.js'), 'utf8');
  assert.match(syllabi, /UPDATE submission_logs SET subject = \? WHERE syllabus_id = \?/);
  const logs = fs.readFileSync(path.join(__dirname, '../routes/logs.js'), 'utf8');
  assert.match(logs, /LEFT JOIN users u ON l\.user_id = u\.user_id/);
  assert.match(logs, /LEFT JOIN syllabi s ON l\.syllabus_id = s\.syllabus_id/);
  const auth = fs.readFileSync(path.join(__dirname, '../routes/auth.js'), 'utf8');
  assert.match(auth, /notes: 'unknown_account', request: req/);
  assert.match(auth, /action: 'login', notes: viaTemp \? 'temporary' : 'password', request: req/);
});

test('plan() lists the steps without running them', async () => {
  const steps = await plan(oldDatabase());
  assert.ok(steps.every((s) => typeof s === 'string' && s.startsWith('ALTER TABLE ')));
});
