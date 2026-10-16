// Tests for telling faculty about deadlines (lib/deadlineNotices.js): who is told, what they are told, how often, and that nothing here can
// break a deadline being saved. In-memory database, a fake bell and a fake mailer. Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert');
const D = require('./deadlines');
const { compose, createDeadlineNotifier, LEAD_MS, COOLDOWN_MS } = require('./deadlineNotices');
const { makeDb, submit, NOW } = require('./deadlines.fakedb');

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const DUE = NOW + 16 * DAY;                              // Oct 30, 16:00 Philippine time
const quiet = { warn() {}, error() {} };
const iso = (ms) => new Date(ms).toISOString();

// A notifier over a fresh database, with a bell and a mailer that only record. `at(ms)` moves the clock.
function setup(over = {}) {
  const db = makeDb();
  const sent = { bell: [], mail: [] };
  let clock = NOW;
  const notifier = createDeadlineNotifier({
    db, now: () => clock, log: quiet, env: {},
    notify: async (_db, n) => { sent.bell.push(n); },
    mail: async (m) => { sent.mail.push(m); return { sent: true }; },
    ...over,
  });
  const at = (ms) => { clock = ms; db.state.clock = ms; };
  const deadline = async (form = {}) => (await D.createDeadline(db, 1, 10, { term: '2026-2027 · 1st Semester', dueAt: iso(DUE), instructions: 'Use the v4 template.', ...form }, clock)).deadline;
  const kinds = () => db.state.notices.map((n) => n.kind);
  return { db, notifier, sent, at, deadline, kinds, now: () => clock };
}
const people = (sent) => sent.bell.map((b) => b.userId).sort();

// ---- the words ----------------------------------------------------------------------------------------------------------------------

const base = { id: 1, term: '2026-2027 · 1st Semester', dueAt: DUE, instructions: '', course: { code: 'IT 204', title: 'Data Structures', program: 'BSIT' } };

test('every notice names the subject and the due time in Philippine time, and says what to do', () => {
  const created = compose('created', { ...base, instructions: 'Use the v4 template.' });
  assert.strictEqual(created.title, 'New deadline: IT 204');
  assert.match(created.lines.join(' '), /IT 204 · Data Structures/); assert.match(created.lines.join(' '), /Oct 30, 2026, 10:00 AM \(Philippine Time\)/);
  assert.match(created.lines.join(' '), /Instructions: Use the v4 template\./);
  assert.doesNotMatch(compose('created', base).lines.join(' '), /Instructions/, 'no empty instructions line');
  assert.match(compose('missed', base).lines.join(' '), /no syllabus was submitted/); assert.match(compose('missed', base).lines.join(' '), /marked as late/);
  assert.strictEqual(compose('before', base).title, 'Due soon: IT 204');
  assert.strictEqual(compose('due', base).title, 'Due today: IT 204');
  assert.match(compose('cancelled', base).lines.join(' '), /do not need to submit/);
  assert.match(compose('manual', base).lines.join(' '), /administrator asks you/);
});

test('a changed deadline says what it was before', () => {
  const text = compose('updated', { ...base, dueAt: DUE + 7 * DAY }, { previous: base }).lines.join(' ');
  assert.match(text, /New due date: Nov 6, 2026/); assert.match(text, /It was Oct 30, 2026/);
  assert.throws(() => compose('nope', base), /Unknown notice/);
});

// ---- when a deadline is set, changed or cancelled ------------------------------------------------------------------------------------

test('setting a deadline tells each assigned faculty member who has not submitted, on the bell and by email, and records it', async () => {
  const t = setup();
  submit(t.db, 7, 10, NOW + DAY);                       // Hana has already submitted this term, so she needs no notice
  const deadline = await t.deadline({ opensAt: iso(NOW - 30 * DAY) });
  const r = await t.notifier.onCreated(deadline);
  assert.deepStrictEqual(r, { notified: 2, emailed: 2 });
  assert.deepStrictEqual(people(t.sent), [5, 6]);
  assert.ok(t.sent.bell.every((b) => b.type === 'deadline' && b.title === 'New deadline: IT 204' && !b.syllabusId));
  assert.deepStrictEqual(t.sent.mail.map((m) => m.to).sort(), ['fay@x.ph', 'gus@x.ph']);
  assert.strictEqual(t.sent.mail[0].name, 'Fay'); assert.strictEqual(t.sent.mail[0].subject, 'New deadline: IT 204');
  assert.deepStrictEqual(t.kinds(), ['created', 'created']);
});

test('emails follow the administrator\'s Email notifications setting; the bell always works; a person without an address gets the bell only', async () => {
  const off = setup();
  off.db.state.settings = JSON.stringify({ emailNotifications: false });
  await off.notifier.onCreated(await off.deadline());
  assert.strictEqual(off.sent.bell.length, 3); assert.strictEqual(off.sent.mail.length, 0);

  const noAddress = setup();
  noAddress.db.state.assigned.push([8, 10]);            // Ivo has no email on record
  noAddress.db.state.emails[8] = null;
  const r = await noAddress.notifier.onCreated(await noAddress.deadline());
  assert.deepStrictEqual(r, { notified: 4, emailed: 3 });

  const on = setup();
  on.db.state.settings = JSON.stringify({ emailNotifications: true });
  assert.strictEqual((await on.notifier.onCreated(await on.deadline())).emailed, 3);
});

test('a mail server that is down does not stop the bell or the record', async () => {
  const t = setup({ mail: async () => ({ sent: false, reason: 'unreachable' }) });
  const r = await t.notifier.onCreated(await t.deadline());
  assert.deepStrictEqual(r, { notified: 3, emailed: 0 });
  assert.strictEqual(t.kinds().length, 3);
});

test('a failure inside the notices never reaches the deadline being saved', async () => {
  const errors = [];
  const t = setup({ notify: async () => { throw new Error('bell broke'); }, log: { warn() {}, error: (...a) => errors.push(a.join(' ')) } });
  const deadline = await t.deadline();
  const r = await t.notifier.onCreated(deadline);        // resolves, does not throw
  assert.strictEqual(r.error, true);
  assert.match(errors[0], /bell broke/);
});

test('changing the instructions tells people; changing only nothing does not; moving the due time also restarts the automatic notices', async () => {
  const t = setup();
  const before = await t.deadline();
  const same = await D.updateDeadline(t.db, before.id, { term: before.term, dueAt: before.dueAt, instructions: before.instructions }, NOW);
  assert.deepStrictEqual(await t.notifier.onUpdated(same.previous, same.deadline), { notified: 0, emailed: 0 });

  const reworded = await D.updateDeadline(t.db, before.id, { term: before.term, dueAt: before.dueAt, instructions: 'Now use v5.' }, NOW);
  assert.strictEqual((await t.notifier.onUpdated(reworded.previous, reworded.deadline)).notified, 3);
  assert.match(t.sent.bell[0].title, /Deadline changed: IT 204/);

  t.db.state.notices.push({ deadline_id: before.id, user_id: 5, kind: 'before', at: NOW }, { deadline_id: before.id, user_id: 5, kind: 'missed', at: NOW });
  const moved = await D.updateDeadline(t.db, before.id, { term: before.term, dueAt: iso(DUE + 7 * DAY), instructions: 'Now use v5.' }, NOW);
  await t.notifier.onUpdated(moved.previous, moved.deadline);
  assert.ok(!t.kinds().includes('before') && !t.kinds().includes('missed'), 'the old automatic notices are cleared so the new date can fire them again');
  assert.match(t.sent.mail.at(-1).lines.join(' '), /It was Oct 30, 2026/);
});

test('cancelling a deadline tells those who have not submitted', async () => {
  const t = setup();
  submit(t.db, 5, 10, NOW + DAY);
  const deadline = await t.deadline({ opensAt: iso(NOW - 30 * DAY) });
  const cancelled = await D.cancelDeadline(t.db, deadline.id);
  const r = await t.notifier.onCancelled(cancelled.deadline);
  assert.strictEqual(r.notified, 2);
  assert.deepStrictEqual(people(t.sent), [6, 7]);
  assert.strictEqual(t.sent.bell[0].title, 'Deadline cancelled: IT 204');
});

// ---- the Remind button ---------------------------------------------------------------------------------------------------------------

test('Remind tells everyone who has not submitted, skips those who have, and says why it skipped', async () => {
  const t = setup();
  submit(t.db, 5, 10, NOW + DAY);
  const deadline = await t.deadline({ opensAt: iso(NOW - 30 * DAY) });
  const r = await t.notifier.remind(deadline.id, [], 1);
  assert.deepStrictEqual({ sent: r.sent, emailed: r.emailed }, { sent: 2, emailed: 2 });
  assert.deepStrictEqual(people(t.sent), [6, 7]);
  assert.strictEqual(t.sent.bell[0].title, 'Reminder: submit your syllabus for IT 204');
  assert.ok(t.db.state.notices.every((n) => n.kind === 'manual' && n.sent_by === 1), 'who pressed it is recorded');
  const only = await t.notifier.remind(deadline.id, [5, 99], 1);
  assert.deepStrictEqual(only.skipped.sort((a, b) => a.userId - b.userId), [{ userId: 5, reason: 'submitted' }, { userId: 99, reason: 'not_assigned' }]);
  assert.strictEqual(only.sent, 0);
});

test('a person can be reminded by hand once every six hours, not more, so a double click or a busy day sends nothing extra', async () => {
  const t = setup();
  const deadline = await t.deadline();
  assert.strictEqual((await t.notifier.remind(deadline.id, [5], 1)).sent, 1);
  t.at(NOW + HOUR);
  const again = await t.notifier.remind(deadline.id, [5], 1);
  assert.deepStrictEqual({ sent: again.sent, skipped: again.skipped }, { sent: 0, skipped: [{ userId: 5, reason: 'cooldown' }] });
  t.at(NOW + COOLDOWN_MS + HOUR);
  assert.strictEqual((await t.notifier.remind(deadline.id, [5], 1)).sent, 1);
  assert.strictEqual(t.sent.bell.length, 2);
});

test('Remind on a deadline that does not exist or was cancelled is a 404', async () => {
  const t = setup();
  const deadline = await t.deadline();
  await assert.rejects(() => t.notifier.remind(999, [], 1), (e) => e.status === 404);
  await D.cancelDeadline(t.db, deadline.id);
  await assert.rejects(() => t.notifier.remind(deadline.id, [], 1), (e) => e.status === 404);
});

// ---- the automatic notices -----------------------------------------------------------------------------------------------------------

test('far from the due date nothing is sent; within three days each person gets "due soon" once', async () => {
  const t = setup();
  await t.deadline();
  t.at(DUE - 10 * DAY);
  assert.deepStrictEqual(await t.notifier.runChecks(), { sent: 0 });
  t.at(DUE - LEAD_MS + HOUR);
  assert.deepStrictEqual(await t.notifier.runChecks(), { sent: 3 });
  assert.ok(t.sent.bell.every((b) => b.title === 'Due soon: IT 204'));
  t.at(DUE - 2 * DAY);
  assert.deepStrictEqual(await t.notifier.runChecks(), { sent: 0 }, 'not again');
});

test('on the due day each person gets "due today" once, and after the time passes, "missed" once, and never anything after they submit', async () => {
  const t = setup();
  const deadline = await t.deadline();
  t.at(DUE - 3 * HOUR);
  await t.notifier.runChecks();
  assert.ok(t.sent.bell.every((b) => b.title === 'Due today: IT 204'));
  const todayCount = t.sent.bell.length;
  await t.notifier.runChecks();
  assert.strictEqual(t.sent.bell.length, todayCount, 'due today is sent once');

  t.at(DUE + HOUR);
  submit(t.db, 6, 10, DUE - HOUR);                      // Gus had submitted on time
  t.db.state.versions.at(-1).at = DUE - HOUR;
  await t.notifier.runChecks();
  const missed = t.sent.bell.filter((b) => b.title === 'Deadline missed: IT 204');
  assert.deepStrictEqual(missed.map((b) => b.userId).sort(), [5, 7]);
  await t.notifier.runChecks();
  assert.strictEqual(t.sent.bell.filter((b) => b.title === 'Deadline missed: IT 204').length, 2, 'missed is sent once');
  assert.ok(deadline.id);
});

test('"due soon" is held back when the person was told about the deadline in the last day, so a new deadline is not announced twice', async () => {
  const t = setup();
  const deadline = await t.deadline({ dueAt: iso(NOW + 2 * DAY) });       // already inside the three days
  await t.notifier.onCreated(deadline);
  const after = t.sent.bell.length;
  assert.deepStrictEqual(await t.notifier.runChecks(), { sent: 0 });
  assert.strictEqual(t.sent.bell.length, after);
  t.at(NOW + DAY + 2 * HOUR);                                             // a day on, with the deadline still ahead
  assert.strictEqual((await t.notifier.runChecks()).sent, 3, 'it is sent once the quiet day has passed');
});

test('a cancelled deadline sends no automatic notices', async () => {
  const t = setup();
  const deadline = await t.deadline();
  await D.cancelDeadline(t.db, deadline.id);
  t.at(DUE + HOUR);
  assert.deepStrictEqual(await t.notifier.runChecks(), { sent: 0 });
});

// ---- off switches and a missing table ------------------------------------------------------------------------------------------------

test('DEADLINE_NOTICES=off sends nothing and records nothing, from every entry point', async () => {
  const t = setup({ env: { DEADLINE_NOTICES: 'off' } });
  const deadline = await t.deadline();
  assert.deepStrictEqual(await t.notifier.onCreated(deadline), { notified: 0, emailed: 0 });
  assert.strictEqual((await t.notifier.remind(deadline.id, [], 1)).sent, 0);
  t.at(DUE + HOUR);
  assert.deepStrictEqual(await t.notifier.runChecks(), { sent: 0 });
  assert.strictEqual(t.sent.bell.length, 0); assert.strictEqual(t.db.state.notices.length, 0);
});

test('before the migration has run, the notifier warns once and stays quiet instead of failing', async () => {
  const warnings = [];
  const db = { query: async () => { throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' }); } };
  const n = createDeadlineNotifier({ db, now: () => NOW, log: { warn: (m) => warnings.push(m), error() {} }, env: {}, notify: async () => {}, mail: async () => ({ sent: true }) });
  const created = { ...base, dueAt: iso(DUE), opensAt: iso(NOW) };
  assert.strictEqual((await n.onCreated(created)).error, true);
  assert.deepStrictEqual(await n.onCreated(created), { notified: 0, emailed: 0 }, 'after that it does nothing');
  assert.strictEqual(warnings.length, 1);
  assert.match(warnings[0], /migrate-deadlines/);
});

test('the timer can be started and stopped without leaving anything running', async () => {
  const t = setup();
  t.notifier.start();
  t.notifier.start();
  await t.notifier.stop();
  await t.notifier.stop();
});
