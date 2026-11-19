'use strict';
// AI Syllabus Generator routes (/api/syllabus-check/syllabi/:id/generate): off by default, author-only, a background job (POST starts it and answers 202, GET reads its progress and
// result, DELETE removes a finished job), one at a time, a daily limit, the Settings switch. The generator is mocked and records each call: no request leaves the process.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const repo = require('../lib/syllabuscheck/repository');
const generator = require('../lib/syllabuscheck/pipeline/generate');
const { sample } = require('../lib/syllabuscheck/fixtures');
const { fakeJobsDb } = require('../lib/syllabuscheck/pipeline/generateJobs.fakedb');

const ON = { SYLLABUS_CHECK_GENERATE: 'on', SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', SYLLABUS_CHECK_GENERATE_MAX_COST_USD: '2', SYLLABUS_CHECK_GENERATE_PER_USER_PER_DAY: '2' };
const RESULT = { status: 'generated', sections: { plan: [] }, check: { status: 'clean' }, warnings: [], usage: { estimatedUsd: 0.4, budget: { requests: 25 } } };

// hold: a promise the mocked generator waits for, so a job can be observed while it runs.
// jobsDb: the table of jobs; pass the same one to a second harness to stand for the server restarting.
async function harness(t, { env = ON, status = 'draft', aiChecking, content: override, hold = null, fail = null, jobsDb = fakeJobsDb() } = {}) {
  const saved = {};
  for (const key of [...Object.keys(ON), 'SYLLABUS_CHECK_GENERATE']) saved[key] = process.env[key];
  for (const key of Object.keys(ON)) delete process.env[key];
  for (const [key, value] of Object.entries(env)) process.env[key] = value;
  t.after(() => { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const { content, masters } = sample();
  const calls = [], activity = [];
  t.mock.method(generator, 'generateSyllabus', async (args) => {
    calls.push(args);
    args.onProgress({ step: 2, steps: 6, stage: 'outline' });
    if (hold) await hold;
    if (fail) throw fail;
    return RESULT;
  });
  t.mock.method(repo, 'mastersFor', async () => masters);
  t.mock.method(console, 'log', () => {}); // the cost line
  delete require.cache[require.resolve('./syllabusCheck')];
  const app = express(); app.use(express.json());
  app.locals.db = { query: async (sql, params) => {
    if (/syllabus_generate_jobs/.test(sql)) return jobsDb.query(sql, params);
    if (sql.startsWith('SELECT user_id FROM users')) return [[{ user_id: params[0] }]];
    if (/program_po_reference_remediation/.test(sql)) return [[]];
    if (sql.startsWith('SELECT * FROM syllabi')) return [[{ syllabus_id: params[0], user_id: 26, status, content: JSON.stringify(override === undefined ? content : override) }]];
    if (aiChecking !== undefined && sql.includes("setting_key = 'administration'")) return [[{ setting_value: JSON.stringify({ aiChecking }) }]];
    if (/account_activity/.test(sql)) { activity.push(params); return [{ insertId: 1 }]; }
    throw Error('Unexpected query: ' + sql);
  } };
  app.use((req, res, next) => { const who = req.headers['x-test-role']; req.session = who ? { user: { id: who === 'admin' ? 1 : who === 'other' ? 27 : 26, role: who === 'admin' ? 'admin' : 'faculty' } } : {}; next(); });
  app.use('/api/syllabus-check', require('./syllabusCheck'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const send = (method, path, role, body) => new Promise((resolve, reject) => {
    const request = http.request(`http://127.0.0.1:${server.address().port}/api/syllabus-check${path}`, { method, headers: { ...(role ? { 'x-test-role': role } : {}), ...(body ? { 'content-type': 'application/json' } : {}) } }, (response) => {
      let text = ''; response.on('data', (c) => { text += c; }); response.on('end', () => resolve({ status: response.statusCode, body: text ? JSON.parse(text) : {} }));
    });
    request.on('error', reject); request.end(body ? JSON.stringify(body) : undefined);
  });
  const settle = async (role) => { for (let i = 0; i < 50; i++) { const s = await send('GET', '/syllabi/100/generate', role); if (s.body.status !== 'running') return s; await new Promise((r) => setTimeout(r, 10)); } throw new Error('the job never finished'); };
  const startAt = (id, role, body) => send('POST', `/syllabi/${id}/generate`, role, body);
  const settleAt = async (id, role) => { for (let i = 0; i < 80; i++) { const s = await send('GET', `/syllabi/${id}/generate`, role); if (s.body.status !== 'running') return s; await new Promise((r) => setTimeout(r, 10)); } throw new Error('the job never finished'); };
  return { startAt, settleAt, start: (role, body) => send('POST', '/syllabi/100/generate', role, body), read: (role) => send('GET', '/syllabi/100/generate', role), clear: (role) => send('DELETE', '/syllabi/100/generate', role), status: (role) => send('GET', '/status', role), settle, calls, activity, jobsDb };
}

test('the generator is off by default: 503, and nothing is sent', async (t) => {
  const h = await harness(t, { env: {} });
  const out = await h.start('faculty');
  assert.equal(out.status, 503);
  assert.equal(out.body.code, 'generator_unavailable');
  assert.deepEqual(h.calls, []);
  assert.equal((await h.status('faculty')).body.generator.available, false);
});

test('switched on with a cost cap, POST answers 202 at once and the result is read from the job', async (t) => {
  const h = await harness(t);
  assert.equal((await h.status('faculty')).body.generator.available, true);
  const started = await h.start('faculty');
  assert.equal(started.status, 202);
  assert.equal(started.body.status, 'running');
  const done = await h.settle('faculty');
  assert.equal(done.body.status, 'done');
  assert.equal(done.body.result.status, 'generated');
  assert.ok(h.calls[0].content.meta.courseId && h.calls[0].masters && typeof h.calls[0].onProgress === 'function');
  assert.equal((await h.clear('faculty')).body.cleared, true, 'the screen removes a finished job once it has applied it');
  assert.equal((await h.read('faculty')).body.status, 'none');
});

test('progress is readable while the job runs, and the job is private to its author', async (t) => {
  let release; const hold = new Promise((resolve) => { release = resolve; });
  const h = await harness(t, { hold });
  await h.start('faculty');
  await new Promise((r) => setTimeout(r, 30));
  const running = await h.read('faculty');
  assert.deepEqual([running.body.status, running.body.step, running.body.stage], ['running', 2, 'outline']);
  assert.equal((await h.read('other')).status, 404, 'someone else cannot read it');
  assert.equal((await h.clear('faculty')).body.cleared, false, 'a running job is never removed');
  release();
  assert.equal((await h.settle('faculty')).body.status, 'done');
});

test('the same syllabus is generated once at a time, but every other syllabus generates at the same moment, with no waiting and no error', async (t) => {
  let release; const hold = new Promise((resolve) => { release = resolve; });
  const { SYLLABUS_CHECK_GENERATE_PER_USER_PER_DAY, ...noLimit } = ON; // no daily limit: that is the default
  const h = await harness(t, { hold, env: noLimit });
  assert.equal((await h.start('faculty')).status, 202);
  const again = await h.start('faculty');
  assert.equal(again.status, 409, 'the same syllabus twice at once is refused');
  assert.equal(again.body.code, 'generate_busy');
  const others = await Promise.all([101, 102, 103, 104, 105, 106].map((id) => h.startAt(id, 'faculty')));
  assert.deepEqual(others.map((r) => r.status), [202, 202, 202, 202, 202, 202], 'six more syllabi start while the first still runs');
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(h.calls.length, 7, 'all seven are running together');
  release();
  for (const id of [100, 101, 102, 103, 104, 105, 106]) assert.equal((await h.settleAt(id, 'faculty')).body.status, 'done', 'syllabus ' + id);
});

test('a failed generation is a failed job with its message, and the author\'s notes reach the generator as data', async (t) => {
  const h = await harness(t, { fail: Object.assign(new Error('The AI could not write a usable "course outline". Nothing was changed. Try again.'), { status: 502 }) });
  await h.start('faculty', { guidance: 'Use Java. Cover recursion.' });
  const done = await h.settle('faculty');
  assert.equal(done.body.status, 'failed');
  assert.equal(done.body.error.status, 502);
  assert.match(done.body.error.message, /course outline/);
  assert.equal(h.calls[0].guidance, 'Use Java. Cover recursion.');
});

test('notes that are not text or are longer than 1500 characters are refused before anything starts', async (t) => {
  const h = await harness(t);
  assert.equal((await h.start('faculty', { guidance: 'x'.repeat(1501) })).status, 400);
  assert.equal((await h.start('faculty', { guidance: 42 })).status, 400);
  assert.deepEqual(h.calls, []);
});

test('only the author: someone else cannot see it (404) and nobody signed in is refused', async (t) => {
  const h = await harness(t);
  assert.equal((await h.start('other')).status, 404);
  assert.equal((await h.start('admin')).status, 404); // an administrator never sees another person's draft
  assert.equal((await h.start(null)).status >= 400, true);
  assert.deepEqual(h.calls, []);
});

test('a submitted (locked) syllabus cannot be generated into', async (t) => {
  const h = await harness(t, { status: 'submitted' });
  assert.equal((await h.start('faculty')).status, 409);
  assert.deepEqual(h.calls, []);
});

test('the administrator\'s AI switch applies: with AI checking off it is 409 and nothing is sent', async (t) => {
  const h = await harness(t, { aiChecking: false });
  const out = await h.start('faculty');
  assert.equal(out.status, 409);
  assert.equal(out.body.code, 'ai_checking_off');
  assert.deepEqual(h.calls, []);
});

test('a draft with no subject is 409 before any request', async (t) => {
  const h = await harness(t, { content: { meta: { courseId: null, title: '' } } });
  const out = await h.start('faculty');
  assert.equal(out.status, 409);
  assert.equal(out.body.code, 'subject_required');
  assert.deepEqual(h.calls, []);
});

test('there is no daily limit unless one is set: many generations in a row are all accepted', async (t) => {
  const { SYLLABUS_CHECK_GENERATE_PER_USER_PER_DAY, ...noLimit } = ON;
  const h = await harness(t, { env: noLimit });
  for (let i = 0; i < 7; i++) { assert.equal((await h.start('faculty')).status, 202); await h.settle('faculty'); await h.clear('faculty'); }
  assert.equal(h.calls.length, 7);
});

test('when a daily limit is set, each person has it: past it the answer is 429 and nothing is sent', async (t) => {
  const h = await harness(t);
  for (let i = 0; i < 2; i++) { assert.equal((await h.start('faculty')).status, 202); await h.settle('faculty'); await h.clear('faculty'); }
  const third = await h.start('faculty');
  assert.equal(third.status, 429);
  assert.equal(third.body.code, 'generate_daily_limit');
  assert.equal(h.calls.length, 2);
});

test('a finished generation is recorded in the author\'s Recent Activity', async (t) => {
  const h = await harness(t);
  await h.start('faculty');
  await h.settle('faculty');
  assert.ok(h.activity.some((params) => params.includes('generate')), 'a "generate" line was written');
});

test('a finished generation survives a server restart: the author still gets the result, and the daily limit does not reset', async (t) => {
  const first = await harness(t);
  await first.start('faculty');
  assert.equal((await first.settle('faculty')).body.status, 'done');
  const restarted = await harness(t, { jobsDb: first.jobsDb }); // a new server process on the same database
  const read = await restarted.read('faculty');
  assert.equal(read.body.status, 'done');
  assert.equal(read.body.result.status, 'generated');
  assert.equal((await restarted.read('other')).status, 404);
  // the first run counts toward today's two: one more is allowed, a third is not
  assert.equal((await restarted.clear('faculty')).body.cleared, true);
  assert.equal((await restarted.start('faculty')).status, 202);
  await restarted.settle('faculty');
  assert.equal((await restarted.start('faculty')).status, 429);
});

test('a generation that was running when the server stopped is reported as interrupted after the restart', async (t) => {
  const never = new Promise(() => {});
  const first = await harness(t, { hold: never });
  assert.equal((await first.start('faculty')).status, 202);
  await new Promise((r) => setTimeout(r, 30));
  const restarted = await harness(t, { jobsDb: first.jobsDb });
  const read = await restarted.read('faculty');
  assert.equal(read.body.status, 'failed');
  assert.match(read.body.error.message, /server restarted/);
});
