// The review chain's counting: a stage counts only on the newest version. Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { summarize, stagesOf, clear, approvalOf } = require('./reviewStages');
const ddl = require('../db/review-stages-ddl');

const row = (stage, version_id, extra = {}) => ({ syllabus_id: 1, version_id, stage, reviewer_id: 5, first_name: 'Rey', last_name: 'Viewer', note: '', cleared_at: '2026-03-01T00:00:00Z', ...extra });

test('nothing cleared is three open stages', () => {
  const s = summarize([], 7);
  assert.deepStrictEqual([s.dean.cleared, s.asst_vpaa.cleared, s.lic_director.cleared, s.allCleared, s.cleared], [false, false, false, false, 0]);
});

test('all three on the newest version is ready for the VPAA, and names the reviewer', () => {
  const s = summarize([row('dean', 7), row('asst_vpaa', 7), row('lic_director', 7, { first_name: 'Lic', last_name: 'Director' })], 7);
  assert.ok(s.allCleared);
  assert.strictEqual(s.lic_director.by, 'Lic Director');
  assert.strictEqual(s.dean.at, '2026-03-01T00:00:00Z');
});

test('a new version starts the three checks again: what was cleared on an older version does not count', () => {
  const rows = [row('dean', 7), row('asst_vpaa', 7), row('lic_director', 7), row('dean', 8)];
  const s = summarize(rows, 8);
  assert.deepStrictEqual([s.dean.cleared, s.asst_vpaa.cleared, s.lic_director.cleared, s.allCleared, s.cleared], [true, false, false, false, 1]);
  assert.strictEqual(summarize(rows, 7).allCleared, true);
});

test('a syllabus with no version has nothing cleared', () => {
  assert.strictEqual(summarize([row('dean', 7)], null).cleared, 0);
});

test('stagesOf answers every id with two queries and clear() is a single idempotent insert', async () => {
  const calls = [];
  const db = { query: async (sql, p) => {
    calls.push(sql.replace(/\s+/g, ' ').trim());
    if (sql.startsWith('SELECT 1 FROM syllabus_review_stages')) return [[{ 1: 1 }]];
    if (sql.startsWith('SELECT syllabus_id, MAX(version_id)')) return [[{ syllabus_id: 1, version_id: 7 }, { syllabus_id: 2, version_id: 3 }]];
    if (sql.startsWith('SELECT s.syllabus_id, s.version_id')) return [[row('dean', 7), { ...row('dean', 2), syllabus_id: 2 }]];
    throw new Error('unexpected ' + sql);
  } };
  const map = await stagesOf(db, [1, 2, 3]);
  assert.strictEqual(map.get(1).dean.cleared, true);
  assert.strictEqual(map.get(2).dean.cleared, false); // cleared on version 2, the newest is 3
  assert.strictEqual(map.get(3).cleared, 0);
  assert.strictEqual(calls.length, 3); // the install check, the versions, the rows
  const writes = [];
  await clear({ query: async (sql, p) => { writes.push([sql, p]); return [{}]; } }, { syllabusId: 1, versionId: 7, stage: 'dean', reviewerId: 5, note: 'ok' });
  assert.ok(/ON DUPLICATE KEY UPDATE/.test(writes[0][0]));
  await assert.rejects(clear({ query: async () => [{}] }, { syllabusId: 1, versionId: 7, stage: 'vpaa', reviewerId: 5 }));
  assert.strictEqual(await approvalOf({ query: async () => [[]] }, 1), null);
  assert.deepStrictEqual(await approvalOf({ query: async () => [[{ action_date: 'D', first_name: 'Vee', last_name: 'Paa' }]] }, 1), { by: 'Vee Paa', at: 'D' });
});

test('schema.sql carries the same stage table as the migration, and the role list', () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8').replace(/\s+/g, ' ');
  assert.ok(sql.includes(ddl[0].replace(/\s+/g, ' ').trim()));
  assert.ok(sql.includes("role ENUM('faculty', 'admin', 'student', 'asst_vpaa', 'lic_director', 'vpaa')"));
});

// When a syllabus reaches the VPAA (routes/syllabi.js, routes/compliance.js, routes/reviewChain.js all use these).
test('a syllabus reaches the VPAA once all three stages are cleared on its newest version, or once it is approved', async () => {
  const { readyForApprover, approverVisible, assertReadyForApprover } = require('./reviewStages');
  assert.strictEqual(readyForApprover('submitted', { allCleared: false }), false);
  assert.strictEqual(readyForApprover('under_review', { allCleared: true }), true);
  assert.strictEqual(readyForApprover('for_revision', { allCleared: true }), true, 'returned by the VPAA after the chain: still the VPAA\'s');
  assert.strictEqual(readyForApprover('approved', undefined), true);
  assert.strictEqual(readyForApprover('submitted', undefined), false, 'no chain known: not the VPAA\'s');
  const db = { async query(sql, p) {
    if (sql.startsWith('SELECT 1 FROM syllabus_review_stages')) return [[]];
    if (sql.startsWith('SELECT syllabus_id, MAX(version_id)')) return [p[0].map((id) => ({ syllabus_id: id, version_id: id * 10 }))];
    if (sql.startsWith('SELECT s.syllabus_id, s.version_id, s.stage')) return [['dean', 'asst_vpaa', 'lic_director'].map((stage) => ({ syllabus_id: 1, version_id: 10, stage, reviewer_id: 1, first_name: 'R', last_name: 'R' }))];
    throw new Error('unexpected ' + sql);
  } };
  const seen = await approverVisible(db, [{ syllabus_id: 1, status: 'under_review' }, { syllabus_id: 2, status: 'submitted' }, { syllabus_id: 3, status: 'approved' }]);
  assert.deepStrictEqual([...seen].sort(), [1, 3]);
  await assert.rejects(assertReadyForApprover(db, { syllabus_id: 2, status: 'submitted' }), (e) => e.status === 409 && e.body.code === 'STAGES_PENDING');
  await assertReadyForApprover(db, { syllabus_id: 1, status: 'under_review' });
  const broken = { async query() { throw new Error('connection lost'); } };
  assert.deepStrictEqual([...(await approverVisible(broken, [{ syllabus_id: 2, status: 'submitted' }]))], [], 'when the chain cannot be read, nothing unfinished reaches the VPAA');
});

// The dean's own syllabus before it is sent for review (hiddenFromReviewers): hidden from everyone but its author while it is Under Review and the dean
// stage is not cleared on its newest version; a faculty member's syllabus is never hidden this way.
test('an administrator\'s Under Review syllabus is hidden from other reviewers until the dean stage is cleared on its newest version', async () => {
  const rs = require('./reviewStages');
  const dean = rs.summarize([row('dean', 7)], 7), none = rs.summarize([], 7), oldVersion = rs.summarize([row('dean', 6)], 7);
  assert.strictEqual(rs.awaitingAuthor('admin', 'under_review', none), true);
  assert.strictEqual(rs.awaitingAuthor('admin', 'under_review', oldVersion), true, 'a dean stage on an older version does not count');
  assert.strictEqual(rs.awaitingAuthor('admin', 'under_review', dean), false, 'sent for review');
  assert.strictEqual(rs.awaitingAuthor('faculty', 'under_review', none), false, 'a faculty member\'s syllabus is never held back');
  for (const status of ['draft', 'for_revision', 'rejected', 'approved']) assert.strictEqual(rs.awaitingAuthor('admin', status, none), false, status);

  const roles = { 1: 'admin', 5: 'faculty' };
  const db = { query: async (sql, p) => {
    if (sql.startsWith('SELECT user_id, role FROM users WHERE user_id IN (?)')) return [p[0].map((id) => ({ user_id: id, role: roles[id] }))];
    throw new Error('unexpected query: ' + sql);
  } };
  const rows = [{ syllabus_id: 10, user_id: 1, status: 'under_review' }, { syllabus_id: 11, user_id: 1, status: 'under_review' }, { syllabus_id: 12, user_id: 5, status: 'under_review' }, { syllabus_id: 13, user_id: 1, status: 'approved' }];
  const stages = new Map([[10, none], [11, dean]]);
  assert.deepStrictEqual([...(await rs.hiddenFromReviewers(db, rows, 3, stages))], [10], 'another reviewer: only the dean\'s unsent one');
  assert.deepStrictEqual([...(await rs.hiddenFromReviewers(db, rows, 1, stages))], [], 'the dean sees their own');
  await assert.rejects(rs.assertSentForReview(db, rows[0], { id: 3 }), (e) => e.status === 409 && e.body.code === 'not_sent_for_review' && e.message === rs.NOT_SENT);
  await rs.assertSentForReview(db, rows[0], { id: 1 }); // the author
  const unreadable = { query: async () => { throw new Error('db down'); } };
  assert.deepStrictEqual([...(await rs.hiddenFromReviewers(unreadable, rows, 3, stages))], [], 'roles unreadable: nothing hidden');
});

// The order of the chain (turnOf, assertTurn): the dean, then the Asst. VPAA, then the LIC Director, then the VPAA.
test('the chain goes in order: the turn is the first stage not cleared on the newest version, then the VPAA', () => {
  const rs = require('./reviewStages');
  assert.strictEqual(rs.summarize([], 7).turn, 'dean');
  assert.strictEqual(rs.summarize([row('dean', 7)], 7).turn, 'asst_vpaa');
  assert.strictEqual(rs.summarize([row('dean', 7), row('asst_vpaa', 7)], 7).turn, 'lic_director');
  assert.strictEqual(rs.summarize([row('dean', 7), row('asst_vpaa', 7), row('lic_director', 7)], 7).turn, 'vpaa');
  assert.strictEqual(rs.summarize([row('dean', 6)], 7).turn, 'dean', 'a stage on an older version does not count');
  assert.strictEqual(rs.summarize([row('asst_vpaa', 7), row('lic_director', 7)], 7).turn, 'dean', 'cleared out of order before this rule: still the dean first');
  rs.assertTurn(rs.summarize([row('dean', 7)], 7), 'asst_vpaa');
  assert.throws(() => rs.assertTurn(rs.summarize([], 7), 'lic_director'), (e) => e.status === 409 && e.body.code === 'stage_out_of_order' && e.body.turn === 'dean' && /with the dean now/.test(e.message));
  assert.throws(() => rs.assertTurn(rs.summarize([row('dean', 7)], 7), 'dean'), (e) => e.body.turn === 'asst_vpaa', 'the dean has passed it on');
});

// A resubmission goes back to whoever returned it (returnedBy, keptStages, carryForward).
test('a resubmission keeps the stages cleared before the reviewer who returned it, and only those', async () => {
  const rs = require('./reviewStages');
  const all = rs.summarize([row('dean', 7), row('asst_vpaa', 7), row('lic_director', 7)], 7);
  const two = rs.summarize([row('dean', 7), row('asst_vpaa', 7)], 7);
  assert.deepStrictEqual(rs.keptStages(two, 'lic_director'), ['dean', 'asst_vpaa'], 'the LIC Director returned it');
  assert.deepStrictEqual(rs.keptStages(rs.summarize([row('dean', 7)], 7), 'asst_vpaa'), ['dean'], 'the Asst. VPAA returned it');
  assert.deepStrictEqual(rs.keptStages(rs.summarize([], 7), 'dean'), [], 'the dean returned it');
  assert.deepStrictEqual(rs.keptStages(all, 'vpaa'), ['dean', 'asst_vpaa', 'lic_director'], 'the VPAA returned or rejected it');
  assert.deepStrictEqual(rs.keptStages(all, 'dean'), [], 'a stage after the returner is never kept');
  assert.deepStrictEqual(rs.keptStages(rs.summarize([row('asst_vpaa', 7)], 7), 'lic_director'), [], 'only stages cleared in order are kept');
  assert.deepStrictEqual(rs.keptStages(all, null), []);

  // carryForward against a fake connection: the last return in the log names the reviewer; the kept rows are copied with their reviewer and date.
  const make = (log, rows) => {
    const inserted = [];
    const conn = { inserted, query: async (sql, p) => {
      sql = String(sql).replace(/\s+/g, ' ').trim();
      if (sql.startsWith('SELECT 1 FROM syllabus_review_stages')) return [[]];
      if (sql.startsWith('SELECT l.log_id, l.action, u.role FROM submission_logs')) return [log ? [log] : []];
      if (sql.startsWith('SELECT stage, reviewer_id, note, cleared_at FROM syllabus_review_stages')) return [rows];
      if (sql.startsWith('INSERT INTO syllabus_review_stages')) { inserted.push(p); return [{}]; }
      throw new Error('unexpected query: ' + sql);
    } };
    return conn;
  };
  const cleared = [{ stage: 'dean', reviewer_id: 1, note: 'ok', cleared_at: '2026-11-01' }, { stage: 'asst_vpaa', reviewer_id: 2, note: null, cleared_at: '2026-11-02' }];
  rs.resetInstalledCache();
  let conn = make({ log_id: 9, action: 'revision', role: 'lic_director' }, cleared);
  assert.deepStrictEqual(await rs.carryForward(conn, { syllabusId: 1, fromVersionId: 7, toVersionId: 8 }), { returner: 'lic_director', kept: ['dean', 'asst_vpaa'] });
  assert.deepStrictEqual(conn.inserted, [[1, 8, 'dean', 1, 'ok', '2026-11-01'], [1, 8, 'asst_vpaa', 2, null, '2026-11-02']]);
  conn = make({ log_id: 9, action: 'revision', role: 'asst_vpaa' }, cleared);
  assert.deepStrictEqual((await rs.carryForward(conn, { syllabusId: 1, fromVersionId: 7, toVersionId: 8 })).kept, ['dean']);
  conn = make({ log_id: 9, action: 'revision', role: 'admin' }, cleared);
  assert.deepStrictEqual((await rs.carryForward(conn, { syllabusId: 1, fromVersionId: 7, toVersionId: 8 })).kept, [], 'the dean returned it: the chain starts again');
  conn = make({ log_id: 9, action: 'reject', role: 'vpaa' }, [...cleared, { stage: 'lic_director', reviewer_id: 3, note: null, cleared_at: '2026-11-03' }]);
  assert.deepStrictEqual((await rs.carryForward(conn, { syllabusId: 1, fromVersionId: 7, toVersionId: 8 })).kept, ['dean', 'asst_vpaa', 'lic_director']);
  conn = make({ log_id: 9, action: 'submit', role: 'faculty' }, cleared);
  assert.deepStrictEqual(await rs.carryForward(conn, { syllabusId: 1, fromVersionId: 7, toVersionId: 8 }), { returner: null, kept: [] }, 'no return since the last submit: nothing kept');
  assert.strictEqual(conn.inserted.length, 0);
  assert.deepStrictEqual(await rs.carryForward(conn, { syllabusId: 1, fromVersionId: null, toVersionId: 8 }), { returner: null, kept: [] });
  const broken = { query: async (sql) => { if (String(sql).startsWith('SELECT 1')) return [[]]; throw new Error('db down'); } };
  assert.strictEqual(await rs.returnedBy(broken, 1), null, 'an unreadable log keeps nothing');
});
