const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { ACTIONS, record, checkNote, decisionNote } = require('./activity');

const recorder = () => {
  const rows = [];
  return { rows, db: { query: async (sql, params) => { assert.match(sql, /^INSERT INTO submission_logs/); rows.push(params); return [{ insertId: rows.length }]; } } };
};

test('a known action is written with the syllabus, the person and the note, cut to the column size', async () => {
  const { rows, db } = recorder();
  assert.equal(await record(db, { syllabusId: 3, userId: 9, action: 'check', notes: 'x'.repeat(900) }), true);
  assert.deepEqual(rows[0].slice(0, 3), [3, 9, 'check']);
  assert.equal(rows[0][3].length, 500);
  assert.equal(await record(db, { syllabusId: 3, userId: 9, action: 'recommend' }), true);
  assert.equal(rows[1][3], null, 'no note is stored as nothing');
});

test('an unknown action or a bad id is refused without touching the database', async () => {
  const { rows, db } = recorder();
  for (const bad of [{ action: 'invented' }, { action: 'check', syllabusId: '3' }, { action: 'check', userId: undefined }, { action: undefined }]) {
    assert.equal(await record(db, { syllabusId: 3, userId: 9, notes: 'n', ...bad }), false);
  }
  assert.equal(rows.length, 0);
});

test('a log write that fails never throws, so the action it describes still succeeds, and the console hears about it with the fix', async t => {
  const messages = [];
  t.mock.method(console, 'error', (m) => messages.push(String(m)));
  const old = Object.assign(new Error('Data truncated for column action'), { errno: 1265, code: 'WARN_DATA_TRUNCATED' });
  const db = { query: async () => { throw old; } };
  assert.equal(await record(db, { syllabusId: 1, userId: 1, action: 'check' }), false);
  assert.equal(await record(db, { syllabusId: 1, userId: 1, action: 'recommend' }), false);
  assert.ok(messages.length <= 1, 'one report, not one per failed write');
  if (messages.length) assert.match(messages[0], /migrate-activity-log/);
});

test('the actions in the writer are exactly the ones the table allows', () => {
  assert.deepEqual(ACTIONS, ['upload', 'update', 'submit', 'approve', 'reject', 'revision', 'delete', 'check', 'recommend']);
  const schema = fs.readFileSync(require.resolve('../db/schema.sql'), 'utf8');
  const afterTable = schema.slice(schema.indexOf('CREATE TABLE IF NOT EXISTS submission_logs'));
  const column = /action ENUM\(([^)]*)\) NOT NULL/.exec(afterTable)[1];
  assert.deepEqual(column.split(',').map(x => x.trim().replace(/'/g, '')), ACTIONS, 'schema.sql and the writer agree');
});

test('the notes say what happened in one line', () => {
  assert.equal(checkNote({ overall: 97, hybrid: { suggestions: [{}, {}] } }), 'AI check: score 97%; 2 recommendations');
  assert.equal(checkNote({ overall: 97, hybrid: { suggestions: [{}] } }), 'AI check: score 97%; 1 recommendation');
  assert.equal(checkNote({ overall: 100, hybrid: { suggestions: [] } }), 'AI check: score 100%');
  assert.equal(checkNote({ overall: null, hybrid: { suggestions: [] } }), 'AI check: incomplete, no score yet');
  assert.equal(checkNote({ overall: 0 }), 'AI check: score 0%');
  assert.equal(checkNote(null), 'AI check ran');
  assert.equal(decisionNote('accept', 'plan[3].tasks'), 'Accepted recommendation: plan[3].tasks');
  assert.equal(decisionNote('edit', 'clos[0].statement'), 'Edited and applied recommendation: clos[0].statement');
  assert.equal(decisionNote('reject', 'plan[3].tasks'), 'Rejected recommendation: plan[3].tasks');
  assert.equal(decisionNote('other'), 'Reviewed recommendation');
});
