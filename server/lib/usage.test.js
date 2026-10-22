// Tests for the time-usage counting (lib/usage.js): what a heartbeat credits, what it must not, and how little it writes.
// In-memory fake database. Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert');
const { createUsageBuffer, createUsageService, phDate, addDays, TUNING } = require('./usage');

const T0 = Date.UTC(2026, 9, 14, 2, 0, 0); // 2026-10-14 10:00 in Philippine time
const SEC = 1000;
const quiet = { warn() {}, error() {} };

function makeDb() {
  const calls = [];
  const stored = [];           // { user_id, usage_date, active_seconds, session_count }
  let failWith = null;
  const db = {
    calls,
    stored,
    failNextWith(err) { failWith = err; },
    async query(sql, params = []) {
      const text = String(sql).replace(/\s+/g, ' ').trim();
      calls.push({ text, params });
      if (failWith) { const err = failWith; failWith = null; throw err; }
      if (text.startsWith('INSERT INTO usage_daily')) {
        for (const [user_id, usage_date, secs, sessions] of params[0]) {
          const row = stored.find((r) => r.user_id === user_id && r.usage_date === usage_date);
          if (row) { row.active_seconds += secs; row.session_count += sessions; } else stored.push({ user_id, usage_date, active_seconds: secs, session_count: sessions });
        }
        return [{}];
      }
      if (text.startsWith('SELECT DATE_FORMAT')) return [stored.filter((r) => r.user_id === params[0] && r.usage_date >= params[1]).map((r) => ({ d: r.usage_date, active_seconds: r.active_seconds, session_count: r.session_count }))];
      if (text.startsWith('DELETE FROM usage_daily')) return [{}];
      throw new Error('unexpected query: ' + text);
    },
  };
  return db;
}

test('Philippine days: 16:30 UTC is already the next day in Manila', () => {
  assert.strictEqual(phDate(Date.UTC(2026, 9, 14, 15, 59, 59)), '2026-10-14');
  assert.strictEqual(phDate(Date.UTC(2026, 9, 14, 16, 0, 0)), '2026-10-15');
  assert.strictEqual(addDays('2026-10-01', -1), '2026-09-30');
});

test('a steady 30-second heartbeat credits the time between beats, and the first beat only starts the session', () => {
  const b = createUsageBuffer();
  assert.deepStrictEqual(b.beat(1, T0), { credited: 0, newSession: true });
  assert.strictEqual(b.beat(1, T0 + 30 * SEC).credited, 30);
  assert.strictEqual(b.beat(1, T0 + 60 * SEC).credited, 30);
  const [row] = b.drain();
  assert.deepStrictEqual(row, { userId: 1, date: '2026-10-14', seconds: 60, sessions: 1, longest: 60 });
});

test('a beat that arrives too soon after the last one is ignored, so a client cannot inflate its time', () => {
  const b = createUsageBuffer();
  b.beat(1, T0);
  assert.strictEqual(b.beat(1, T0 + 3 * SEC).ignored, true);
  assert.strictEqual(b.beat(1, T0 + 5 * SEC).ignored, true);
  assert.strictEqual(b.drain()[0].seconds, 0);
});

test('one credit is capped, and a long silence starts a new session instead of crediting the gap', () => {
  const b = createUsageBuffer();
  b.beat(1, T0);
  assert.strictEqual(b.beat(1, T0 + 100 * SEC).credited, TUNING.BEAT_CAP_S);      // slow tab: capped, not 100
  const away = T0 + 100 * SEC + 30 * 60 * SEC;                                       // 30 minutes of nothing
  assert.deepStrictEqual(b.beat(1, away), { credited: 0, newSession: true });
  const [row] = b.drain();
  assert.strictEqual(row.seconds, 90);
  assert.strictEqual(row.sessions, 2);
  assert.strictEqual(row.longest, 90);
});

test('two tabs of the same user count once: time is credited per user, not per tab', () => {
  const b = createUsageBuffer();
  b.beat(1, T0);                         // tab A
  b.beat(1, T0 + 1 * SEC);               // tab B, a moment later: ignored
  b.beat(1, T0 + 30 * SEC);              // tab A
  b.beat(1, T0 + 31 * SEC);              // tab B: ignored
  b.beat(1, T0 + 60 * SEC);              // tab A
  assert.strictEqual(b.drain()[0].seconds, 60);
});

test('users are counted separately and midnight splits credits between Philippine days', () => {
  const b = createUsageBuffer();
  const late = Date.UTC(2026, 9, 14, 15, 59, 40);
  b.beat(1, late); b.beat(2, late);
  b.beat(1, late + 30 * SEC);
  b.beat(2, late + 31 * SEC);
  const rows = b.drain().sort((x, y) => x.userId - y.userId || x.date.localeCompare(y.date));
  assert.deepStrictEqual(rows.map((r) => [r.userId, r.date, r.seconds, r.sessions]), [[1, '2026-10-14', 20, 1], [1, '2026-10-15', 10, 1], [2, '2026-10-14', 20, 1], [2, '2026-10-15', 11, 1]]);
});

test('an interval ending exactly at midnight counts a session on the next active day', () => {
  const b = createUsageBuffer();
  const midnight = Date.UTC(2026, 9, 14, 16);
  b.beat(1, midnight - 30000); b.beat(1, midnight); b.beat(1, midnight + 30000);
  assert.deepStrictEqual(b.drain().map(r => [r.date, r.seconds, r.sessions]), [['2026-10-14', 30, 1], ['2026-10-15', 30, 1]]);
});

test('a summary during a database flush waits for committed credits without dropping or doubling time', async () => {
  const db = makeDb();
  const query = db.query.bind(db);
  let release;
  const writing = new Promise(resolve => { release = resolve; });
  let started;
  const entered = new Promise(resolve => { started = resolve; });
  db.query = async (sql, params) => {
    if (sql.includes('INSERT INTO usage_daily')) { started(); await writing; }
    return query(sql, params);
  };
  let clock = T0;
  const usage = createUsageService({ db, now: () => clock, log: quiet });
  usage.heartbeat(1); clock += 30000; usage.heartbeat(1);
  await usage.summary(1, 7); // populate the pre-flush cache
  const flushing = usage.flush();
  await entered;
  const reading = usage.summary(1, 7);
  clock += 30000; usage.heartbeat(1); // keep accepting input during the write
  release();
  await flushing;
  assert.strictEqual((await reading).todaySeconds, 60);
  await usage.flush();
  assert.strictEqual((await usage.summary(1, 7)).todaySeconds, 60);
});

test('midnight refreshes the cached range and excludes expired days from session averages', async () => {
  const db = makeDb();
  db.stored.push({ user_id: 1, usage_date: '2026-10-08', active_seconds: 600, session_count: 10 });
  db.stored.push({ user_id: 1, usage_date: '2026-10-14', active_seconds: 600, session_count: 1 });
  let clock = Date.UTC(2026, 9, 14, 15, 59, 59);
  const usage = createUsageService({ db, now: () => clock, log: quiet });
  assert.strictEqual((await usage.summary(1, 7)).totalSeconds, 1200);
  clock += 2000;
  const summary = await usage.summary(1, 7);
  assert.strictEqual(summary.totalSeconds, 600);
  assert.strictEqual(summary.avgSessionSeconds, 600);
});

test('flush writes everyone in one statement, and nothing at all when nothing is waiting', async () => {
  const db = makeDb();
  let clock = T0;
  const usage = createUsageService({ db, now: () => clock, log: quiet });
  assert.strictEqual(await usage.flush(), 0);
  assert.strictEqual(db.calls.length, 0, 'no writes without credits');
  for (const id of [1, 2, 3]) usage.heartbeat(id);
  clock += 30 * SEC;
  for (const id of [1, 2, 3]) usage.heartbeat(id);
  assert.strictEqual(db.calls.length, 0, 'heartbeats never touch the database');
  assert.strictEqual(await usage.flush(), 3);
  assert.strictEqual(db.calls.length, 1, 'one batched write for all users');
  assert.strictEqual(db.stored.length, 3);
});

test('a failed write keeps the credits for the next flush instead of losing them', async () => {
  const db = makeDb();
  let clock = T0;
  const usage = createUsageService({ db, now: () => clock, log: quiet });
  usage.heartbeat(1); clock += 30 * SEC; usage.heartbeat(1);
  db.failNextWith(Object.assign(new Error('connection lost'), { code: 'PROTOCOL_CONNECTION_LOST' }));
  assert.strictEqual(await usage.flush(), 0);
  assert.strictEqual(await usage.flush(), 1);
  assert.strictEqual(db.stored[0].active_seconds, 30);
});

test('the summary joins stored days with time not yet written, so today is current', async () => {
  const db = makeDb();
  db.stored.push({ user_id: 1, usage_date: '2026-10-12', active_seconds: 1800, session_count: 2 });
  db.stored.push({ user_id: 1, usage_date: '2026-10-13', active_seconds: 600, session_count: 1 });
  db.stored.push({ user_id: 2, usage_date: '2026-10-13', active_seconds: 99999, session_count: 9 });
  let clock = T0;
  const usage = createUsageService({ db, now: () => clock, log: quiet });
  usage.heartbeat(1); clock += 30 * SEC; usage.heartbeat(1);
  const s = await usage.summary(1, 7);
  assert.strictEqual(s.days.length, 7);
  assert.strictEqual(s.days[6].date, '2026-10-14');
  assert.strictEqual(s.todaySeconds, 30);
  assert.strictEqual(s.totalSeconds, 1800 + 600 + 30);
  assert.strictEqual(s.activeDays, 3);
  assert.strictEqual(s.avgPerActiveDay, Math.round(2430 / 3));
  assert.deepStrictEqual(s.busiest, { date: '2026-10-12', seconds: 1800 });
  assert.strictEqual(s.hasData, true);
  assert.ok(!JSON.stringify(s).includes('99999'), 'another user\'s time is never part of it');
});

test('a user with no time yet gets seven empty days, not an error', async () => {
  const usage = createUsageService({ db: makeDb(), now: () => T0, log: quiet });
  const s = await usage.summary(7, 7);
  assert.strictEqual(s.enabled, true);
  assert.strictEqual(s.hasData, false);
  assert.strictEqual(s.busiest, null);
  assert.strictEqual(s.avgSessionSeconds, 0);
  assert.ok(s.days.every((d) => d.seconds === 0));
});

test('30 days is a supported range, and any other value falls back to 7', async () => {
  const usage = createUsageService({ db: makeDb(), now: () => T0, log: quiet });
  assert.strictEqual((await usage.summary(1, 30)).days.length, 30);
  assert.strictEqual((await usage.summary(1, 90)).days.length, 7);
});

test('before the migration has run, tracking turns itself off quietly and everything else keeps working', async () => {
  const db = makeDb();
  const warnings = [];
  let clock = T0;
  const usage = createUsageService({ db, now: () => clock, log: { warn: (m) => warnings.push(m), error() {} } });
  db.failNextWith(Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' }));
  assert.deepStrictEqual(await usage.summary(1, 7), { enabled: false });
  assert.deepStrictEqual(usage.heartbeat(1), { enabled: false });
  assert.strictEqual(warnings.length, 1);
  assert.ok(/migrate-usage/.test(warnings[0]));
});

test('USAGE_TRACKING=off is a kill switch: nothing is counted and nothing is read', async () => {
  const db = makeDb();
  const usage = createUsageService({ db, now: () => T0, log: quiet, env: { USAGE_TRACKING: 'off' } });
  assert.deepStrictEqual(usage.heartbeat(1), { enabled: false });
  assert.deepStrictEqual(await usage.summary(1, 7), { enabled: false });
  assert.strictEqual(db.calls.length, 0);
});
