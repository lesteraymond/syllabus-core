'use strict';
// The background jobs of the AI Syllabus Generator (pipeline/generateJobs.js): one per syllabus, private to their author, saved in syllabus_generate_jobs so a result and the daily
// count survive a restart, and still working in memory when the table is missing.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createJobs, KEEP_MS, INTERRUPTED } = require('./generateJobs');
const { fakeJobsDb } = require('./generateJobs.fakedb');

const tick = () => new Promise((resolve) => setImmediate(resolve));
const settle = async () => { for (let i = 0; i < 6; i++) await tick(); };

test('a job starts at once, shows its progress, and keeps its result for the author only', async () => {
  const db = fakeJobsDb(), jobs = createJobs();
  let release; const hold = new Promise((resolve) => { release = resolve; });
  const view = await jobs.start({ db, syllabusId: 7, userId: 1, run: async (progress) => { progress({ step: 3, steps: 6, stage: 'weeks1' }); await hold; return { sections: { plan: [] } }; } });
  assert.equal(view.status, 'running');
  await settle();
  const running = await jobs.get(db, 7, 1);
  assert.deepEqual([running.status, running.step, running.stage], ['running', 3, 'weeks1']);
  assert.equal((await jobs.get(db, 7, 2)).status, 'none', 'someone else sees nothing');
  assert.equal(jobs.isRunning(7), true);
  assert.equal(jobs.isRunning(8), false, 'another syllabus is not running');
  assert.equal(await jobs.clear(db, 7, 1), false, 'a running job is never removed');
  release(); await settle();
  const done = await jobs.get(db, 7, 1);
  assert.equal(done.status, 'done');
  assert.deepEqual(done.result, { sections: { plan: [] } });
  assert.equal(jobs.isRunning(7), false);
  assert.equal(await jobs.clear(db, 7, 2), false, 'only the author clears it');
  assert.equal(await jobs.clear(db, 7, 1), true);
  assert.equal((await jobs.get(db, 7, 1)).status, 'none');
  assert.equal(db.rows[0].status, 'applied');
  assert.equal(db.rows[0].result_json, null, 'the result is emptied once it is taken; the row stays as the record');
});

test('a finished result survives a server restart: a new process reads it from the table', async () => {
  const db = fakeJobsDb();
  const before = createJobs();
  await before.start({ db, syllabusId: 7, userId: 1, run: async () => ({ sections: { plan: [{ week: '2' }] }, check: { status: 'clean' } }) });
  await settle();
  const after = createJobs(); // the restarted server: nothing in memory
  const read = await after.get(db, 7, 1);
  assert.equal(read.status, 'done');
  assert.deepEqual(read.result.sections.plan, [{ week: '2' }]);
  assert.equal((await after.get(db, 7, 2)).status, 'none', 'still private to its author');
  assert.equal(await after.clear(db, 7, 1), true);
  assert.equal((await after.get(db, 7, 1)).status, 'none');
});

test('a job that was running when the server stopped is reported failed, never forever "running"', async () => {
  const db = fakeJobsDb(), before = createJobs();
  await before.start({ db, syllabusId: 7, userId: 1, run: () => new Promise(() => {}) }); // never finishes: the process dies
  await settle();
  const after = createJobs();
  const read = await after.get(db, 7, 1);
  assert.deepEqual([read.status, read.error.message], ['failed', INTERRUPTED.message]);
  assert.equal(db.rows[0].status, 'failed', 'and the table says so too');
});

test('a failed run is a failed job with its status and message, and a broken progress report changes nothing', async () => {
  const db = fakeJobsDb(), jobs = createJobs();
  await jobs.start({ db, syllabusId: 1, userId: 1, run: async (progress) => { progress(null); progress({ step: 'x' }); throw Object.assign(new Error('The AI stopped.'), { status: 429 }); } });
  await settle();
  const failed = await jobs.get(db, 1, 1);
  assert.deepEqual([failed.status, failed.error.status, failed.error.message, failed.step], ['failed', 429, 'The AI stopped.', 0]);
});

test('the daily limit counts the last 24 hours from the table, so a restart does not reset it, and says when to try again', async () => {
  let clock = 1_000_000_000_000;
  const db = fakeJobsDb({ clock: () => clock }), now = () => clock;
  const first = createJobs({ now });
  for (let i = 0; i < 2; i++) { await first.start({ db, syllabusId: 10 + i, userId: 5, run: async () => ({}) }); clock += 60 * 1000; }
  await settle();
  const restarted = createJobs({ now });
  const blocked = await restarted.allowance(db, 5, 2);
  assert.deepEqual([blocked.ok, blocked.used], [false, 2]);
  assert.ok(blocked.retryAfterSec > 23 * 3600 && blocked.retryAfterSec <= 24 * 3600, 'until the older of the two leaves the 24 hours');
  assert.equal((await restarted.allowance(db, 6, 2)).ok, true, 'someone else is not counted');
  clock += 24 * 60 * 60 * 1000;
  assert.equal((await restarted.allowance(db, 5, 2)).ok, true, 'a day later it is open again');
});

test('without the table everything still works in memory (and the limit counts from memory), saying so once', async () => {
  const errors = []; const original = console.error; console.error = (m) => errors.push(String(m));
  try {
    const db = fakeJobsDb({ missing: true }), jobs = createJobs();
    assert.equal((await jobs.allowance(db, 1, 1)).ok, true);
    await jobs.start({ db, syllabusId: 1, userId: 1, run: async () => ({ ok: true }) });
    await settle();
    assert.equal((await jobs.get(db, 1, 1)).status, 'done');
    assert.equal(jobs.isPersistent(), false);
    assert.equal((await jobs.allowance(db, 1, 1)).ok, false, 'the memory count applies');
    assert.equal(await jobs.clear(db, 1, 1), true);
    assert.equal(errors.filter((m) => /syllabus_generate_jobs is missing/.test(m)).length, 1, 'reported once');
  } finally { console.error = original; }
});

test('a finished job is forgotten from memory after 30 minutes, and the table still has it until it is taken', async () => {
  let clock = 1000;
  const db = fakeJobsDb({ clock: () => clock }), jobs = createJobs({ now: () => clock });
  await jobs.start({ db, syllabusId: 1, userId: 1, run: async () => ({ ok: true }) });
  await settle();
  clock += KEEP_MS + 1;
  assert.equal((await jobs.get(db, 1, 1)).status, 'done', 'read back from the table');
  const noTable = createJobs({ now: () => clock });
  const mem = fakeJobsDb({ missing: true });
  await noTable.start({ db: mem, syllabusId: 2, userId: 1, run: async () => ({ ok: true }) });
  await settle();
  clock += KEEP_MS + 1;
  assert.equal((await noTable.get(mem, 2, 1)).status, 'none', 'with no table, memory is all there is');
});

test('the migration and schema.sql define the same table', () => {
  const norm = (s) => s.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();
  const ddl = norm(require('../../../db/generate-jobs-ddl')[0]);
  const schema = norm(fs.readFileSync(path.join(__dirname, '../../../db/schema.sql'), 'utf8'));
  assert.ok(schema.includes(ddl), 'server/db/schema.sql carries the table exactly as db/generate-jobs-ddl.js');
  assert.match(ddl, /FOREIGN KEY \(syllabus_id\) REFERENCES syllabi\(syllabus_id\) ON DELETE CASCADE/);
});

test('many generations run side by side: each keeps its own progress and result, for its own author', async () => {
  const db = fakeJobsDb(), jobs = createJobs();
  const releases = [];
  for (let id = 1; id <= 12; id++) {
    await jobs.start({ db, syllabusId: id, userId: id, run: async (progress) => { progress({ step: id % 7, steps: 7, stage: 'outline' }); await new Promise((r) => releases.push(r)); return { sections: { plan: [id] } }; } });
  }
  await settle();
  assert.equal(jobs.runningCount(), 12, 'all twelve run at once');
  for (let id = 1; id <= 12; id++) { const v = await jobs.get(db, id, id); assert.deepEqual([v.status, v.step], ['running', id % 7]); assert.equal((await jobs.get(db, id, id + 1)).status, 'none', 'private to its author'); }
  releases.forEach((r) => r()); await settle();
  for (let id = 1; id <= 12; id++) assert.deepEqual((await jobs.get(db, id, id)).result, { sections: { plan: [id] } });
  assert.equal(jobs.runningCount(), 0);
});
