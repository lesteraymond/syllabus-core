// Tests for subject deadlines (lib/deadlines.js): the status rules, the form validation, and the queries over an in-memory database.
// Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert');
const d = require('./deadlines');

const { makeDb, submit, NOW } = require('./deadlines.fakedb');
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const DUE = Date.UTC(2026, 9, 30, 8, 0, 0);          // 2026-10-30 16:00 in Philippine time
const s = (ms) => Math.floor(ms / 1000);

// ---- the rules ----------------------------------------------------------------------------------------------------------------------

test('a requirement with nothing submitted is upcoming, due today on the due day, and failed once the time has passed', () => {
  assert.strictEqual(d.statusOf({ now: NOW, dueAt: DUE }), 'upcoming');
  assert.strictEqual(d.statusOf({ now: DUE - 5 * HOUR, dueAt: DUE }), 'due_today');
  assert.strictEqual(d.statusOf({ now: DUE, dueAt: DUE }), 'due_today', 'at the exact due time it is not yet late');
  assert.strictEqual(d.statusOf({ now: DUE + 1000, dueAt: DUE }), 'failed');
});

test('a submission on time is submitted, after the due time is submitted late, and it ends the failed state', () => {
  assert.strictEqual(d.statusOf({ now: NOW, dueAt: DUE, submittedAt: NOW - HOUR }), 'submitted');
  assert.strictEqual(d.statusOf({ now: DUE + DAY, dueAt: DUE, submittedAt: DUE }), 'submitted', 'exactly at the deadline is on time');
  assert.strictEqual(d.statusOf({ now: DUE + DAY, dueAt: DUE, submittedAt: DUE + 1000 }), 'submitted_late');
  assert.strictEqual(d.statusOf({ now: DUE + 10 * DAY, dueAt: DUE, submittedAt: DUE + DAY }), 'submitted_late');
});

test('"today" is the Philippine day: 23:30 in Manila is still the due day, and the next minute after midnight there is not', () => {
  const dueLate = Date.UTC(2026, 9, 14, 15, 59, 0);   // 23:59 on Oct 14 in Manila
  assert.strictEqual(d.statusOf({ now: Date.UTC(2026, 9, 14, 15, 30, 0), dueAt: dueLate }), 'due_today');
  assert.strictEqual(d.statusOf({ now: Date.UTC(2026, 9, 13, 15, 59, 0), dueAt: dueLate }), 'upcoming', '23:59 on Oct 13 in Manila is the day before');
  assert.strictEqual(d.statusOf({ now: Date.UTC(2026, 9, 14, 16, 0, 1), dueAt: dueLate }), 'failed');
});

test('the summary counts each status and keeps "waiting" for the ones that still have time', () => {
  assert.deepStrictEqual(d.summarize(['submitted', 'submitted_late', 'failed', 'upcoming', 'due_today', 'failed']), { total: 6, submitted: 1, late: 1, waiting: 2, failed: 2 });
  assert.deepStrictEqual(d.summarize([]), { total: 0, submitted: 0, late: 0, waiting: 0, failed: 0 });
});

// ---- the form -----------------------------------------------------------------------------------------------------------------------

const good = { term: '2026-2027 · 1st Sem', dueAt: new Date(DUE).toISOString(), instructions: '  Use the new template.  ' };

test('a good form is cleaned up, and submissions count from now unless a start date is given', () => {
  const r = d.readInput(good, NOW);
  assert.deepStrictEqual(r, { term: '2026-2027 · 1st Sem', dueAt: DUE, opensAt: NOW, instructions: 'Use the new template.' });
  assert.strictEqual(d.readInput({ ...good, opensAt: new Date(NOW - 5 * DAY).toISOString() }, NOW).opensAt, NOW - 5 * DAY);
  assert.strictEqual(d.readInput({ ...good, instructions: '   ' }, NOW).instructions, null);
});

test('a bad form is refused with a message the administrator can act on', () => {
  const refuse = (body, pattern, existing) => assert.throws(() => d.readInput(body, NOW, existing), (e) => e.status === 400 && pattern.test(e.message));
  refuse({ ...good, term: '' }, /Term is required/);
  refuse({ ...good, term: 'x'.repeat(31) }, /Term is too long/);
  refuse({ ...good, dueAt: 'soon' }, /not valid/);
  refuse({ ...good, dueAt: undefined }, /not valid/);
  refuse({ ...good, dueAt: new Date(NOW - HOUR).toISOString() }, /must be in the future/);
  refuse({ ...good, opensAt: new Date(DUE + DAY).toISOString() }, /after the date submissions start/);
  refuse({ ...good, opensAt: 'nope' }, /start counting is not valid/);
  refuse({ ...good, instructions: 'x'.repeat(1001) }, /too long/);
});

test('editing a deadline that has already passed is allowed while its due time is unchanged, but a new past time is not', () => {
  const past = NOW - 3 * DAY;
  const existing = { dueAt: past, opensAt: past - 30 * DAY };
  const same = d.readInput({ term: 'T', dueAt: new Date(past).toISOString(), instructions: 'fixed typo' }, NOW, existing);
  assert.strictEqual(same.dueAt, past);
  assert.strictEqual(same.opensAt, existing.opensAt, 'the start date is kept when it is not sent again');
  assert.throws(() => d.readInput({ term: 'T', dueAt: new Date(NOW - DAY).toISOString() }, NOW, existing), /must be in the future/);
});

// ---- the queries --------------------------------------------------------------------------------------------------------------------


test('setting a deadline stores it, tells the administrator the subject and term, and refuses a second one for the same term', async () => {
  const db = makeDb();
  const { deadline } = await d.createDeadline(db, 1, 10, good, NOW);
  assert.strictEqual(deadline.courseId, 10);
  assert.strictEqual(deadline.term, '2026-2027 · 1st Sem');
  assert.strictEqual(deadline.dueAt, new Date(DUE).toISOString());
  assert.deepStrictEqual(deadline.course, { code: 'IT 204', title: 'Data Structures', program: 'BSIT' });
  await assert.rejects(() => d.createDeadline(db, 1, 10, good, NOW), (e) => e.status === 409);
  await assert.rejects(() => d.createDeadline(db, 1, 999, good, NOW), (e) => e.status === 404);
  const other = await d.createDeadline(db, 1, 10, { ...good, term: '2026-2027 · 2nd Sem' }, NOW);
  assert.ok(other.id !== deadline.id, 'a different term is a different deadline');
});

test('a cancelled deadline can be set again for the same term and is active again', async () => {
  const db = makeDb();
  const { id } = await d.createDeadline(db, 1, 10, good, NOW);
  await d.cancelDeadline(db, id);
  assert.deepStrictEqual(await d.listForAdmin(db, NOW), []);
  const again = await d.createDeadline(db, 2, 10, { ...good, instructions: 'new' }, NOW);
  assert.strictEqual(again.id, id, 'the same row is reused, so the term stays unique');
  assert.strictEqual((await d.listForAdmin(db, NOW)).length, 1);
  await assert.rejects(() => d.cancelDeadline(db, 999), (e) => e.status === 404);
});

test('progress lists each faculty member assigned to the subject, each against their own submission', async () => {
  const db = makeDb();
  const now = DUE + 2 * DAY;
  const { id } = await d.createDeadline(db, 1, 10, { ...good, opensAt: new Date(NOW - 20 * DAY).toISOString() }, NOW);
  submit(db, 5, 10, DUE - 3 * DAY);                 // Fay: on time
  submit(db, 6, 10, DUE + DAY);                     // Gus: late
  submit(db, 7, 10, DUE - DAY, 'draft');            // Hana: only a draft, which is not a submission
  submit(db, 8, 20, DUE - DAY);                     // Ivo: another subject, and not assigned to this one
  submit(db, 5, 10, NOW - 40 * DAY);                // an old submission from before the term counts for nothing
  const r = await d.progress(db, id, now);
  const by = Object.fromEntries(r.people.map((p) => [p.name, p.status]));
  assert.deepStrictEqual(by, { 'Fay Cruz': 'submitted', 'Gus Dela Cruz': 'submitted_late', 'Hana Lim': 'failed' });
  assert.strictEqual(r.people.length, 3, 'faculty assigned to a different subject are not part of it');
  assert.deepStrictEqual(r.summary, { total: 3, submitted: 1, late: 1, waiting: 0, failed: 1 });
  assert.strictEqual(r.unassigned, false);
  assert.strictEqual(r.people.find((p) => p.name === 'Hana Lim').submittedAt, null);
});

test('a submission made before the deadline was opened does not count, so last term\'s syllabus does not satisfy this term', async () => {
  const db = makeDb();
  const { id } = await d.createDeadline(db, 1, 10, good, NOW);           // counts from NOW
  submit(db, 5, 10, NOW - 60 * DAY);                                      // last term
  const before = await d.progress(db, id, NOW + DAY);
  assert.strictEqual(before.people.find((p) => p.name === 'Fay Cruz').status, 'upcoming');
  submit(db, 5, 10, NOW + 2 * DAY);                                       // this term
  const after = await d.progress(db, id, NOW + 3 * DAY);
  assert.strictEqual(after.people.find((p) => p.name === 'Fay Cruz').status, 'submitted');
});

test('a subject nobody is assigned to is reported as unassigned, not as failed requirements', async () => {
  const db = makeDb();
  db.state.assigned = [];
  const { id } = await d.createDeadline(db, 1, 10, good, NOW);
  const r = await d.progress(db, id, DUE + DAY);
  assert.deepStrictEqual(r.people, []);
  assert.strictEqual(r.unassigned, true);
  assert.strictEqual(r.summary.failed, 0);
  assert.strictEqual((await d.listForAdmin(db, DUE + DAY))[0].unassigned, true);
});

test('the administrator list is soonest first and carries each deadline\'s numbers', async () => {
  const db = makeDb();
  await d.createDeadline(db, 1, 10, { ...good, term: 'Later', dueAt: new Date(DUE + 20 * DAY).toISOString() }, NOW);
  await d.createDeadline(db, 1, 20, { ...good, term: 'Sooner' }, NOW);
  submit(db, 8, 20, NOW + DAY);
  const list = await d.listForAdmin(db, NOW + 2 * DAY);
  assert.deepStrictEqual(list.map((x) => x.term), ['Sooner', 'Later']);
  assert.deepStrictEqual(list[0].summary, { total: 1, submitted: 1, late: 0, waiting: 0, failed: 0 });
  assert.deepStrictEqual(list[1].summary, { total: 3, submitted: 0, late: 0, waiting: 3, failed: 0 });
});

test('a faculty member sees only the deadlines of their own subjects, each with their own status', async () => {
  const db = makeDb();
  await d.createDeadline(db, 1, 10, good, NOW);
  await d.createDeadline(db, 1, 20, { ...good, term: 'CS term' }, NOW);
  submit(db, 5, 10, NOW + DAY);
  const fay = await d.mine(db, 5, NOW + 2 * DAY);
  assert.strictEqual(fay.length, 1);
  assert.strictEqual(fay[0].course.code, 'IT 204');
  assert.strictEqual(fay[0].status, 'submitted');
  assert.strictEqual((await d.mine(db, 6, NOW + 2 * DAY))[0].status, 'upcoming', 'another assigned faculty member has not submitted');
  assert.strictEqual((await d.mine(db, 8, NOW + 2 * DAY))[0].course.code, 'CS 101');
  assert.deepStrictEqual(await d.mine(db, 99, NOW), []);
});

test('changing a deadline updates it in place, refuses a term that is already used, and a cancelled one cannot be changed', async () => {
  const db = makeDb();
  const a = await d.createDeadline(db, 1, 10, good, NOW);
  await d.createDeadline(db, 1, 10, { ...good, term: 'Other' }, NOW);
  const moved = await d.updateDeadline(db, a.id, { ...good, dueAt: new Date(DUE + 7 * DAY).toISOString(), instructions: 'extended' }, NOW);
  assert.strictEqual(moved.deadline.dueAt, new Date(DUE + 7 * DAY).toISOString());
  assert.strictEqual(moved.previous.dueAt, new Date(DUE).toISOString(), 'the old values come back, so a notice can say what changed');
  assert.strictEqual(moved.deadline.opensAt, new Date(NOW).toISOString(), 'the start date is kept');
  await assert.rejects(() => d.updateDeadline(db, a.id, { ...good, term: 'Other' }, NOW), (e) => e.status === 409);
  await d.cancelDeadline(db, a.id);
  await assert.rejects(() => d.updateDeadline(db, a.id, good, NOW), (e) => e.status === 404);
});

test('a requirement is never written to the database: statuses come from the history each time', async () => {
  const db = makeDb();
  const { id } = await d.createDeadline(db, 1, 10, good, NOW);
  const writes = () => db.state.queries.filter((q) => /^(INSERT|UPDATE|DELETE)/.test(q)).length;
  const before = writes();
  await d.progress(db, id, NOW); await d.listForAdmin(db, NOW); await d.mine(db, 5, NOW);
  assert.strictEqual(writes(), before, 'reading never writes');
});

test('a deadline is settled only when someone is assigned and every one of them has submitted, on time or late', () => {
  assert.equal(d.isSettled({ total: 3, submitted: 2, late: 1, waiting: 0, failed: 0 }), true);
  assert.equal(d.isSettled({ total: 2, submitted: 2, late: 0, waiting: 0, failed: 0 }), true);
  assert.equal(d.isSettled({ total: 0, submitted: 0, late: 0, waiting: 0, failed: 0 }), false, 'nobody assigned');
  assert.equal(d.isSettled({ total: 3, submitted: 2, late: 0, waiting: 1, failed: 0 }), false, 'someone still has time');
  assert.equal(d.isSettled({ total: 3, submitted: 2, late: 0, waiting: 0, failed: 1 }), false, 'someone missed it');
  assert.equal(d.isSettled(undefined), false);
});

test('the list and the progress say a deadline is settled once everyone submitted before it was due, and it reopens when someone is assigned', async () => {
  const db = makeDb();
  const { id } = await d.createDeadline(db, 1, 10, { ...good, opensAt: new Date(NOW - 20 * DAY).toISOString() }, NOW);
  const now = DUE - 2 * DAY;
  assert.equal((await d.listForAdmin(db, now))[0].settled, false);
  submit(db, 5, 10, DUE - 5 * DAY); submit(db, 6, 10, DUE - 4 * DAY); submit(db, 7, 10, DUE - 3 * DAY);   // everyone assigned to subject 10
  const list = await d.listForAdmin(db, now);
  assert.equal(list[0].settled, true);
  assert.equal((await d.progress(db, id, now)).settled, true);
  assert.equal(list[0].cancelled, false, 'settled is not cancelled');
  db.state.users[9] = ['Ida', 'Tan']; db.state.assigned.push([9, 10]);                                                       // a new person is assigned
  assert.equal((await d.listForAdmin(db, now))[0].settled, false);
});
