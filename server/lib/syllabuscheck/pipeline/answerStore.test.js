'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('./testSyllabus');
const { check } = require('./check');
const { runShadow } = require('./shadow');
const { memoryStore, dbAnswerStore, layeredStore, pruneUnused } = require('./answerStore');
const { migrate } = require('../../../db/migrate-replan-answers');
const DDL = require('../../../db/replan-answers-ddl');

// A stand-in for the replan_answers table: the three statements answerStore.js sends, nothing else.
function fakeDb({ missing = false, failWith = null } = {}) {
  const table = new Map(), log = [];
  return {
    table, log,
    async query(sql, params) {
      log.push(sql);
      if (failWith) throw Object.assign(Error(failWith), { code: failWith });
      if (missing) throw Object.assign(Error("Table 'replan_answers' doesn't exist"), { code: 'ER_NO_SUCH_TABLE' });
      if (/^SELECT answer_key, answer_json FROM replan_answers WHERE answer_key IN \(\?\)$/.test(sql)) return [params[0].filter(k => table.has(k)).map(k => ({ answer_key: k, answer_json: table.get(k).answer_json }))];
      if (/^INSERT INTO replan_answers .* VALUES \? ON DUPLICATE KEY UPDATE answer_json = VALUES\(answer_json\)$/.test(sql)) { for (const [key, relationship, model, prompt, rules, json] of params[0]) table.set(key, { relationship, model, prompt, rules, answer_json: json }); return [{ affectedRows: params[0].length }]; }
      if (/^DELETE FROM replan_answers WHERE updated_at < \(NOW\(\) - INTERVAL \? DAY\)$/.test(sql)) return [{ affectedRows: 0, days: params[0] }];
      throw Error('unexpected SQL: ' + sql);
    },
  };
}
const YEAR = 2026;
const run = (store, ask) => check(T.conforming(), null, { ask, store, model: 'm', year: YEAR });

test('schema.sql carries the table exactly as db/replan-answers-ddl.js, and the table is not tied to the live checker', () => {
  const norm = s => s.replace(/\s+/g, ' ').trim();
  const schema = norm(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'db', 'schema.sql'), 'utf8'));
  assert.ok(schema.includes(norm(DDL[0])));
  assert.match(DDL[0], /answer_key CHAR\(64\) NOT NULL PRIMARY KEY/);
  assert.doesNotMatch(DDL[0], /FOREIGN KEY/);
});

test('the migration creates the table only when it is missing, and a dry run creates nothing', async () => {
  const conn = (exists) => { const sent = []; return { sent, query: async sql => { sent.push(sql); return /information_schema/.test(sql) ? [exists ? [{ table_name: 'replan_answers' }] : []] : [{}]; } }; };
  const fresh = conn(false);
  assert.deepEqual(await migrate(fresh), { created: 1 });
  assert.ok(fresh.sent.some(s => /CREATE TABLE IF NOT EXISTS replan_answers/.test(s)));
  const dry = conn(false);
  assert.deepEqual(await migrate(dry, { dryRun: true }), { created: 1 });
  assert.ok(!dry.sent.some(s => /CREATE TABLE/.test(s)));
  const present = conn(true);
  assert.deepEqual(await migrate(present), { created: 0 });
  assert.ok(!present.sent.some(s => /CREATE TABLE/.test(s)));
});

test('SURVIVES A RESTART: a re-check after the server restarts reuses every answer from the database and asks the AI nothing', async () => {
  const db = fakeDb();
  const first = await run(layeredStore(memoryStore(), dbAnswerStore(db)), T.scriptedJudge());
  assert.equal(first.judged.usage.asked, 142);
  assert.equal(db.table.size, 142);
  // a new process: empty memory, same database
  const afterRestart = await run(layeredStore(memoryStore(), dbAnswerStore(db)), T.failIfCalled);
  assert.equal(afterRestart.judged.usage.reused, 142);
  assert.equal(afterRestart.judged.usage.requests, 0);
  assert.deepEqual(afterRestart.judged.results.map(r => [r.id, r.verdict]), first.judged.results.map(r => [r.id, r.verdict]));
  const row = [...db.table.values()][0];
  assert.equal(row.model, 'm');
  assert.match(row.prompt, /^replan-prompt-/);
  assert.ok(JSON.parse(row.answer_json).items);
});

test('one read and one write per check, not one per question', async () => {
  const db = fakeDb();
  await run(layeredStore(memoryStore(), dbAnswerStore(db)), T.scriptedJudge());
  assert.equal(db.log.filter(s => s.startsWith('SELECT')).length, 1);
  assert.equal(db.log.filter(s => s.startsWith('INSERT')).length, 1);
});

test('a missing table or a database error never breaks a check: it runs from memory and says why', async () => {
  for (const [db, why] of [[fakeDb({ missing: true }), /npm run migrate-replan-answers/], [fakeDb({ failWith: 'ECONNRESET' }), /database error: ECONNRESET/]]) {
    const back = dbAnswerStore(db);
    const result = await run(layeredStore(memoryStore(), back), T.scriptedJudge());
    assert.equal(result.summary.complete, true);
    assert.equal(back.status().available, false);
    assert.match(back.status().problem, why);
  }
});

test('the shadow keeps answers in the database when the server passes its db, and reports where', async () => {
  const db = fakeDb();
  const provider = { ask: T.scriptedJudge(), rewrite: T.scriptedRewriter(), model: 'scripted' };
  const shadow = await runShadow({ content: T.conforming(), officialResult: { hybrid: {} }, env: { SYLLABUS_CHECK_REPLAN: 'shadow' }, provider, db });
  assert.equal(shadow.usage.store.kind, 'layered');
  assert.equal(shadow.usage.store.back.writes, 142);
  assert.equal(db.table.size, 142);
  const { summarize, renderDetail } = require('./shadowReport');
  assert.match(renderDetail(summarize({ run_id: 1, report_json: JSON.stringify({ hybrid: { replanShadow: shadow } }) })), /Answers kept in: database \(0 reused from it, 142 saved\)/);
});

test('pruneUnused deletes only answers unused for the given number of days, and refuses a bad number', async () => {
  const db = fakeDb();
  assert.equal(await pruneUnused(db, 180), 0);
  assert.match(db.log.at(-1), /^DELETE FROM replan_answers WHERE updated_at < \(NOW\(\) - INTERVAL \? DAY\)$/);
  await assert.rejects(pruneUnused(db, 0), /whole number/);
});
