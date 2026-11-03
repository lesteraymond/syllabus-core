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
