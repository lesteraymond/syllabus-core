// The account activity log (lib/accountActivity.js, table account_activity): what it records, that recording never breaks the action, one "edited"
// line per editing session, the read that GET /api/logs merges, and the table definition (the migration and schema.sql must agree). Run: npm test.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const activity = require('./accountActivity');

// A fake database: the rows, a clock in minutes, and what was asked. `missing` is a database before the migration; `broken` fails every query.
function fakeDb({ missing = false, broken = false, rows = [] } = {}) {
  const s = { rows, clock: 0, queries: [] };
  const query = async (sql, p = []) => {
    s.queries.push(sql);
    if (broken) throw Object.assign(new Error('connection lost'), { code: 'PROTOCOL_CONNECTION_LOST' });
    if (missing && sql.includes('account_activity')) throw Object.assign(new Error("Table 'account_activity' doesn't exist"), { code: 'ER_NO_SUCH_TABLE' });
    if (sql.startsWith('INSERT INTO account_activity')) { const [user_id, action, syllabus_id, subject, notes] = p; s.rows.push({ activity_id: s.rows.length + 1, user_id, action, syllabus_id, subject, notes, at: s.clock }); return [{}]; }
    if (sql.startsWith('SELECT 1 FROM account_activity')) {
      const window = Number(/INTERVAL (\d+) MINUTE/.exec(sql)[1]);
      return [s.rows.filter((r) => r.user_id === p[0] && r.syllabus_id === p[1] && r.action === 'content_edit' && r.at > s.clock - window).slice(0, 1)];
    }
    if (sql.startsWith('SELECT course_code, title FROM syllabi')) return [p[0] === 9 ? [{ course_code: 'FM 202', title: 'Fundamentals of Mathematics' }] : []];
    if (sql.startsWith('SELECT a.activity_id')) {
      assert.match(sql, /WHERE a\.user_id = \?/);
      return [s.rows.filter((r) => r.user_id === p[0]).map((r) => ({ first_name: 'Fay', last_name: 'F', course_code: null, title: null, created_at: '2026-03-01T08:00:00Z', ...r }))];
    }
    throw new Error('unexpected query: ' + sql);
  };
  return { s, query };
}
const quiet = async (fn) => { const e = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = e; } };

test('each kind of account activity is recorded with who did it, and nothing that is not one of them', async () => {
  const db = fakeDb();
  for (const action of activity.ACTIONS) assert.equal(await activity.record(db, { userId: 5, action, notes: action === 'login' ? 'password' : null }), true, action);
  assert.deepEqual(db.s.rows.map((r) => r.action), activity.ACTIONS);
  assert.deepEqual(activity.ACTIONS, ['login', 'logout', 'password_change', 'name_change', 'photo_change', 'language_change', 'draft_create', 'content_edit', 'syllabus_delete',
    'login_failed', 'user_create', 'user_credentials', 'user_disable', 'user_enable', 'user_delete', 'user_assignments']);
  assert.equal(await activity.record(db, { userId: 5, action: 'approve' }), false, 'a review decision belongs to submission_logs');
  assert.equal(await activity.record(db, { userId: '5', action: 'login' }), false, 'a user id must be a number');
  assert.equal(await activity.record(db, { action: 'login' }), false);
  assert.equal(db.s.rows.length, activity.ACTIONS.length, 'nothing else was written');
});

test('long texts are cut to the column sizes and blank ones are stored as nothing', async () => {
  const db = fakeDb();
  await activity.record(db, { userId: 5, action: 'syllabus_delete', subject: 'x'.repeat(400), notes: '  ' });
  assert.equal(db.s.rows[0].subject.length, 300);
  assert.equal(db.s.rows[0].notes, null);
  await activity.record(db, { userId: 5, action: 'name_change', notes: 'y'.repeat(600), syllabusId: 'not a number' });
  assert.equal(db.s.rows[1].notes.length, 500);
  assert.equal(db.s.rows[1].syllabus_id, null);
});

test('recording never breaks the action: before the migration, or with the database down, it answers false and does not throw', async () => {
  await quiet(async () => {
    assert.equal(await activity.record(fakeDb({ missing: true }), { userId: 5, action: 'login' }), false);
    assert.equal(await activity.record(fakeDb({ broken: true }), { userId: 5, action: 'logout' }), false);
    assert.equal(await activity.recordEdit(fakeDb({ missing: true }), { userId: 5, syllabusId: 1 }), false);
  });
});

test('autosave: one "edited" line per syllabus per editing session; a later session, another syllabus or another person adds a line', async () => {
  const db = fakeDb();
  assert.equal(await activity.recordEdit(db, { userId: 5, syllabusId: 1, subject: 'FM 202', notes: 'draft' }), true);
  db.s.clock = 5; assert.equal(await activity.recordEdit(db, { userId: 5, syllabusId: 1, notes: 'draft' }), false, 'the same session');
  db.s.clock = activity.EDIT_SESSION_MINUTES - 1; assert.equal(await activity.recordEdit(db, { userId: 5, syllabusId: 1 }), false, 'still within the session');
  assert.equal(await activity.recordEdit(db, { userId: 5, syllabusId: 2 }), true, 'another syllabus');
  assert.equal(await activity.recordEdit(db, { userId: 6, syllabusId: 1 }), true, 'another person');
  db.s.clock = activity.EDIT_SESSION_MINUTES + 1; assert.equal(await activity.recordEdit(db, { userId: 5, syllabusId: 1, notes: 'for_revision' }), true, 'a new session');
  assert.deepEqual(db.s.rows.map((r) => [r.user_id, r.syllabus_id, r.notes]), [[5, 1, 'draft'], [5, 2, null], [6, 1, null], [5, 1, 'for_revision']]);
  assert.equal(await activity.recordEdit(db, { userId: 5, syllabusId: null }), false, 'an edit needs its syllabus');
});

test('a syllabus about to be deleted is named by its code and title; unreadable or unknown, by nothing', async () => {
  assert.equal(await activity.subjectOf(fakeDb(), 9), 'FM 202 — Fundamentals of Mathematics');
  assert.equal(await activity.subjectOf(fakeDb(), 10), null);
  assert.equal(await activity.subjectOf(fakeDb({ broken: true }), 9), null);
  assert.equal(activity.subjectLine('', 'Only a title'), 'Only a title');
  assert.equal(activity.subjectLine('IT 351', ''), 'IT 351');
  assert.equal(activity.subjectLine('', ''), null);
});

test('the read: the person\'s own rows in the shape of GET /api/logs, a deleted syllabus by its recorded name; nothing before the migration', async () => {
  const db = fakeDb({ rows: [
    { activity_id: 1, user_id: 5, action: 'syllabus_delete', syllabus_id: null, subject: 'FM 202 — Fundamentals of Mathematics', notes: 'draft' },
    { activity_id: 2, user_id: 5, action: 'login', syllabus_id: null, subject: null, notes: 'google' },
    { activity_id: 3, user_id: 6, action: 'logout', syllabus_id: null, subject: null, notes: null },
  ] });
  const rows = await activity.listFor(db, 5, 50);
  assert.deepEqual(rows.map((r) => [r.id, r.action, r.courseCode, r.title, r.notes, r.user]), [
    ['a1', 'syllabus_delete', 'FM 202', 'Fundamentals of Mathematics', 'draft', 'Fay F'],
    ['a2', 'login', null, null, 'google', 'Fay F']]);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['action', 'actionDate', 'courseCode', 'id', 'notes', 'syllabusId', 'title', 'user', 'userId']);
  assert.match(db.s.queries.at(-1), /LIMIT 50/);
  assert.deepEqual(await activity.listFor(fakeDb({ missing: true }), 5, 50), []);
  await assert.rejects(activity.listFor(fakeDb({ broken: true }), 5, 50), /connection lost/, 'any other failure is not hidden');
});

test('the migration and schema.sql define the same table, and a deleted syllabus or account behaves as an audit trail should', async () => {
  const norm = (s) => s.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();
  const ddl = norm(require('../db/account-activity-ddl')[0]);
  const schema = norm(fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'));
  assert.ok(schema.includes(ddl), 'server/db/schema.sql carries the table exactly as db/account-activity-ddl.js');
  assert.match(ddl, /FOREIGN KEY \(syllabus_id\) REFERENCES syllabi\(syllabus_id\) ON DELETE SET NULL/, 'deleting a syllabus keeps the record of what was done to it');
  assert.match(ddl, /action VARCHAR\(30\) NOT NULL/);
  assert.ok(activity.ACTIONS.every((a) => a.length <= 30));
  const { migrate } = require('../db/migrate-account-activity');
  const calls = [];
  const conn = (present) => ({ query: async (sql) => { calls.push(sql); return [present ? [{ table_name: 'account_activity' }] : []]; } });
  assert.deepEqual(await migrate(conn(true)), { created: 0 }, 'already there: nothing to do');
  assert.deepEqual(await migrate(conn(false), { dryRun: true }), { created: 1 });
  assert.ok(!calls.some((sql) => sql.startsWith('CREATE')), 'a dry run creates nothing');
});

// A session restored from a remembered device ("Remember me", middleware/auth.js restoreSession) is a sign-in too; a disabled account's remembered device
// is refused and recorded as a failed sign-in. No live session or no cookie: nothing.
test('a sign-in from a remembered device is recorded; a disabled account\'s remembered device is recorded as refused', async () => {
  const { restoreSession } = require('../middleware/auth');
  const run = async (row) => {
    const written = [];
    const db = { query: async (sql, p = []) => {
      if (sql.includes('FROM remember_tokens t JOIN users u')) return [row ? [row] : []];
      if (sql.startsWith('INSERT INTO account_activity')) { written.push({ user_id: p[0], action: p[1], notes: p[4] }); return [{}]; }
      return [{}]; // token clean-up and rotation
    } };
    const req = { headers: { cookie: 'remember_token=abc' }, session: { cookie: {} }, app: { locals: { db } } };
    const res = { cookie() {}, clearCookie() {} };
    let error = null;
    await restoreSession(req, res, (e) => { error = e || null; });
    assert.equal(error, null);
    return { written, user: req.session.user };
  };
  const base = { token_id: 3, user_id: 5, email: 'fay@x.ph', role: 'faculty', first_name: 'Fay', last_name: 'F', avatar_path: null, must_change_password: 0, preferred_language: 'en', disabled_at: null };
  const ok = await run(base);
  assert.equal(ok.user.id, 5);
  assert.deepEqual(ok.written, [{ user_id: 5, action: 'login', notes: 'remembered' }]);
  const off = await run({ ...base, disabled_at: '2026-11-08 08:00:00' });
  assert.equal(off.user, undefined, 'never signed in');
  assert.deepEqual(off.written, [{ user_id: 5, action: 'login_failed', notes: 'disabled_remembered' }]);
  assert.deepEqual((await run(null)).written, [], 'an unknown or expired token: nothing');
});
