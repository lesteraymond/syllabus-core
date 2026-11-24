// Whole-number syllabus versions (v1, v2, v3 ...): the label rule (lib/syllabusRules.js) and the one-time renumbering (db/migrate-version-labels.js).
const test = require('node:test');
const assert = require('node:assert');
const { nextVersionLabel, versionNumber, FIRST_VERSION } = require('../lib/syllabusRules');
const { migrate, plan } = require('./migrate-version-labels');

test('versions are whole numbers: the first is v1 and each next one adds 1', () => {
  assert.strictEqual(FIRST_VERSION, 'v1');
  assert.strictEqual(nextVersionLabel('v1'), 'v2');
  assert.strictEqual(nextVersionLabel('v9'), 'v10');
  assert.strictEqual(nextVersionLabel(''), 'v1');
  assert.strictEqual(nextVersionLabel(null), 'v1');
  assert.strictEqual(nextVersionLabel('draft'), 'v1');
});

test('an old dotted label still counts: v1.0 is the 1st version, v1.3 the 4th, and the next one continues from there', () => {
  assert.strictEqual(versionNumber('v1.0'), 1);
  assert.strictEqual(versionNumber('v1.3'), 4);
  assert.strictEqual(versionNumber('vv1.1'), 2); // the doubled prefix an old client-side bump left
  assert.strictEqual(nextVersionLabel('v1.0'), 'v2');
  assert.strictEqual(nextVersionLabel('v1.3'), 'v5');
  assert.strictEqual(nextVersionLabel('vv1.1'), 'v3');
});

test('the renumbering gives each syllabus v1, v2, v3 ... in save order, and its current version follows the row it named', () => {
  const versions = [
    { version_id: 10, syllabus_id: 1, version_label: 'v1.0' }, { version_id: 11, syllabus_id: 1, version_label: 'v1.1' }, { version_id: 14, syllabus_id: 1, version_label: 'v1.2' },
    { version_id: 12, syllabus_id: 2, version_label: 'v1.0' }, { version_id: 13, syllabus_id: 2, version_label: 'v1.1' }, { version_id: 15, syllabus_id: 2, version_label: 'v1.1' }, // a repeated label
  ];
  const syllabi = [
    { syllabus_id: 1, version: 'v1.2' }, { syllabus_id: 2, version: 'v1.1' },
    { syllabus_id: 3, version: 'v1.0' }, { syllabus_id: 4, version: '' }, { syllabus_id: 5, version: 'v1' }, // drafts never submitted
  ];
  const r = plan(versions, syllabi);
  assert.deepStrictEqual(r.versions.map((v) => [v.id, v.to]), [[10, 'v1'], [11, 'v2'], [14, 'v3'], [12, 'v1'], [13, 'v2'], [15, 'v3']]);
  assert.deepStrictEqual(r.syllabi.map((s) => [s.id, s.to]), [[1, 'v3'], [2, 'v3'], [3, 'v1'], [4, 'v1']], 'the repeated v1.1 is the newest row with it: v3; v1 is left alone');
});

test('a second run changes nothing, and a dry run writes nothing', async () => {
  const state = {
    versions: [{ version_id: 1, syllabus_id: 1, version_label: 'v1.0' }, { version_id: 2, syllabus_id: 1, version_label: 'v1.1' }],
    syllabi: [{ syllabus_id: 1, version: 'v1.1' }],
  };
  const writes = [];
  const conn = {
    query: async (sql, p) => {
      if (sql.startsWith('SELECT version_id')) return [state.versions.map((v) => ({ ...v }))];
      if (sql.startsWith('SELECT syllabus_id, version FROM syllabi')) return [state.syllabi.map((s) => ({ ...s }))];
      writes.push(sql);
      if (sql.startsWith('UPDATE syllabus_versions')) state.versions.find((v) => v.version_id === p[1]).version_label = p[0];
      if (sql.startsWith('UPDATE syllabi')) state.syllabi.find((s) => s.syllabus_id === p[1]).version = p[0];
      return [{}];
    },
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {},
  };
  const dry = await migrate(conn, { dryRun: true });
  assert.strictEqual(dry.versions.length, 2);
  assert.deepStrictEqual(writes, [], 'the dry run wrote nothing');
  await migrate(conn);
  assert.deepStrictEqual(state.versions.map((v) => v.version_label), ['v1', 'v2']);
  assert.strictEqual(state.syllabi[0].version, 'v2');
  assert.ok(writes.some((w) => w.includes("SET DEFAULT 'v1'")));
  const again = await migrate(conn);
  assert.deepStrictEqual([again.versions.length, again.syllabi.length], [0, 0]);
});
