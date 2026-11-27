const test = require('node:test');
const assert = require('node:assert/strict');
const { createJobStore, errorRecord, validJobId } = require('./pdfImportJobs');

// Timers under test control: fire(n) runs the n-th timer set.
function fakeTimers() {
  const timers = [];
  return { timers, setTimer: (fn, ms) => { const t = { fn, ms, cleared: false }; timers.push(t); return t; }, clearTimer: t => { if (t) t.cleared = true; }, fire: t => { if (!t.cleared) t.fn(); } };
}
const file = { name: 'a.pdf', size: 3, buffer: Buffer.from('abc') };

test('job ids are short url-safe tokens', () => {
  assert.equal(validJobId('jabc12345678'), true);
  for (const bad of ['short', 'has space 1234', 'x'.repeat(65), 12345678, null, undefined, '../../etc/pw']) assert.equal(validJobId(bad), false);
});

test('a job is kept per person: running, then done with its result, then dropped after the TTL', () => {
  const clock = fakeTimers();
  const store = createJobStore({ ttlMs: 1000, runningMs: 5000, ...clock });
  assert.throws(() => store.start(5, 'bad', { kind: 'extract', file }));
  const job = store.start(5, 'jabc12345678', { kind: 'extract', file });
  assert.equal(job.state, 'running');
  assert.equal(store.get(5, 'jabc12345678'), job);
  assert.equal(store.get('5', 'jabc12345678'), job, 'person ids compare as strings');
  assert.equal(store.get(6, 'jabc12345678'), null, 'another person never sees it');
  assert.equal(store.get(5, 'jother123456'), null);
  store.finish(5, 'jabc12345678', { result: { fields: {} }, courseId: 25 });
  assert.equal(job.state, 'done');
  assert.equal(job.courseId, 25);
  assert.equal(clock.timers[0].cleared, true, 'the running timer is replaced');
  assert.equal(clock.timers[1].ms, 1000);
  clock.fire(clock.timers[1]);
  assert.equal(store.get(5, 'jabc12345678'), null);
  assert.equal(store.size(), 0);
});

test('a new scan replaces the last one, and a stale finish or timer never touches the new one', () => {
  const clock = fakeTimers();
  const store = createJobStore({ ...clock });
  store.start(5, 'jfirst123456', { kind: 'extract', file });
  const second = store.start(5, 'jsecond12345', { kind: 'syllabus', syllabusId: 3, file });
  assert.equal(store.get(5, 'jfirst123456'), null);
  store.finish(5, 'jfirst123456', { result: { stale: true } });
  store.fail(5, 'jfirst123456', { status: 500, body: {} });
  assert.equal(second.state, 'running');
  clock.timers[0].fn(); // the first job's timer, had it not been cleared
  assert.equal(store.get(5, 'jsecond12345'), second);
  store.fail(5, 'jsecond12345', errorRecord(Object.assign(new Error('pdfImport.timeout'), { status: 422 }), 'generic'));
  assert.deepEqual(second.error, { status: 422, body: { error: 'pdfImport.timeout' } });
});

test('a failure keeps the answer the request gave: refusals with their fields, anything else generic', () => {
  assert.deepEqual(errorRecord(Object.assign(new Error('x'), { status: 409, body: { code: 'syllabus_exists' } }), 'generic'), { status: 409, body: { error: 'x', code: 'syllabus_exists' } });
  assert.deepEqual(errorRecord(new Error('ECONNRESET at /var/db'), 'generic'), { status: 500, body: { error: 'generic' } });
});
