// Time spent in the system, counted on the server and written to the database rarely.
//
// The browser sends a heartbeat about every 30 seconds, and only while the person is really there (tab visible, input in the last few
// minutes). Each heartbeat credits the time since that user's previous one, so:
//   - two open tabs cannot count twice: time is credited per user, not per tab;
//   - a sleeping laptop cannot inflate the total: one credit is capped (BEAT_CAP_S), and a long silence starts a new session;
//   - nothing touches the database per heartbeat: credits wait in memory and are written together by flush() (one statement for
//     every user), about once a minute and at shutdown. A crash loses at most that last minute.
// The buffer is the only part that would move to Redis if the API ever runs as several processes; the routes and the table stay as they are.
// Days are Philippine days (UTC+8, no daylight saving), like the rest of the app.

const TUNING = {
  BEAT_MIN_MS: 10 * 1000,        // a heartbeat closer than this to the last one is ignored
  BEAT_CAP_S: 90,                // the most one heartbeat can credit
  SESSION_GAP_MS: 120 * 1000,    // silence longer than this ends the session; the next heartbeat starts a new one
  FLUSH_MS: 60 * 1000,           // how often waiting credits are written
  CACHE_MS: 30 * 1000,           // how long a user's stored rows are reused by the summary
  FORGET_MS: 60 * 60 * 1000,     // a user not heard from for this long is dropped from memory
  KEEP_DAYS: 400,                // older rows are deleted
};
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

const phDate = (ms) => new Date(ms + PH_OFFSET_MS).toISOString().slice(0, 10);
const addDays = (date, n) => { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

function createUsageBuffer(tuning = TUNING) {
  const live = new Map();        // userId -> { lastBeatAt, sessionSeconds }
  let pending = new Map();       // `${userId}|${date}` -> { userId, date, seconds, sessions, longest }
  const cell = (userId, date) => {
    const key = userId + '|' + date;
    if (!pending.has(key)) pending.set(key, { userId, date, seconds: 0, sessions: 0, longest: 0 });
    return pending.get(key);
  };

  function beat(userId, nowMs) {
    const user = live.get(userId);
    const date = phDate(nowMs);
    if (!user || nowMs - user.lastBeatAt > tuning.SESSION_GAP_MS) {
      live.set(userId, { lastBeatAt: nowMs, sessionSeconds: 0, sessionDate: date });
      cell(userId, date).sessions += 1;
      return { credited: 0, newSession: true };
    }
    if (nowMs - user.lastBeatAt < tuning.BEAT_MIN_MS) return { credited: 0, ignored: true };
    const credited = Math.min(Math.round((nowMs - user.lastBeatAt) / 1000), tuning.BEAT_CAP_S);
    // Split the credited interval at Philippine midnight instead of moving yesterday's seconds into today.
    let cursor = nowMs - credited * 1000;
    while (cursor < nowMs) {
      const day = phDate(cursor);
      const end = Math.min(nowMs, Date.parse(addDays(day, 1) + 'T00:00:00+08:00'));
      const seconds = Math.round(end / 1000) - Math.round(cursor / 1000);
      const c = cell(userId, day);
      if (day !== user.sessionDate) { c.sessions += 1; user.sessionDate = day; }
      user.sessionSeconds += seconds;
      c.seconds += seconds;
      c.longest = Math.max(c.longest, user.sessionSeconds);
      cursor = end;
    }
    user.lastBeatAt = nowMs;
    return { credited };
  }

  // Hands over everything waiting and empties the buffer. restore() puts it back if the write failed.
  function drain() { const rows = [...pending.values()]; pending = new Map(); return rows; }
  function restore(rows) {
    for (const r of rows) { const c = cell(r.userId, r.date); c.seconds += r.seconds; c.sessions += r.sessions; c.longest = Math.max(c.longest, r.longest); }
  }
  const pendingFor = (userId) => [...pending.values()].filter((r) => r.userId === userId);
  function forget(nowMs) { for (const [id, u] of live) if (nowMs - u.lastBeatAt > tuning.FORGET_MS) live.delete(id); }
  return { beat, drain, restore, pendingFor, forget, size: () => live.size };
}

function createUsageService({ db, now = Date.now, tuning = TUNING, log = console, env = process.env }) {
  const buffer = createUsageBuffer(tuning);
  const cache = new Map();       // `${userId}|${days}` -> { at, rows }
  let available = true;          // false once the table is found missing: tracking is simply off until the migration has run
  let timer = null;
  let lastPurge = '';

  const on = () => env.USAGE_TRACKING !== 'off' && available;
  const dropCache = (userId) => { for (const key of cache.keys()) if (key.startsWith(userId + '|')) cache.delete(key); };
  const noTable = (err) => {
    if (err && err.code === 'ER_NO_SUCH_TABLE') {
      if (available) log.warn('USAGE: the usage_daily table is missing. Run "npm run migrate-usage" in server/ to turn time tracking on.');
      available = false;
      return true;
    }
    return false;
  };

  function heartbeat(userId) {
    if (!on()) return { enabled: false };
    buffer.beat(userId, now());
    return { enabled: true };
  }

  async function writePending() {
    const rows = buffer.drain();
    if (!rows.length) return 0;
    try {
      await db.query(
        `INSERT INTO usage_daily (user_id, usage_date, active_seconds, session_count, longest_session_seconds) VALUES ?
         ON DUPLICATE KEY UPDATE active_seconds = active_seconds + VALUES(active_seconds), session_count = session_count + VALUES(session_count),
         longest_session_seconds = GREATEST(longest_session_seconds, VALUES(longest_session_seconds))`,
        [rows.map((r) => [r.userId, r.date, r.seconds, r.sessions, r.longest])]);
      rows.forEach((r) => dropCache(r.userId));
      return rows.length;
    } catch (err) {
      if (!noTable(err)) { buffer.restore(rows); log.error('USAGE: could not write usage, will retry:', err.message); }
      return 0;
    }
  }

  async function purge() {
    const today = phDate(now());
    if (lastPurge === today) return;
    lastPurge = today;
    try { await db.query('DELETE FROM usage_daily WHERE usage_date < ?', [addDays(today, -tuning.KEEP_DAYS)]); } catch (err) { noTable(err); }
  }

  async function readSummary(userId, days) {
    if (!on()) return { enabled: false };
    const span = days === 30 ? 30 : 7;
    const today = phDate(now());
    const from = addDays(today, -(span - 1));
    const key = userId + '|' + span + '|' + today;
    let hit = cache.get(key);
    if (!hit || now() - hit.at > tuning.CACHE_MS) {
      try {
        const [rows] = await db.query(
          `SELECT DATE_FORMAT(usage_date, '%Y-%m-%d') AS d, active_seconds, session_count FROM usage_daily WHERE user_id = ? AND usage_date >= ? ORDER BY usage_date`,
          [userId, from]);
        hit = { at: now(), rows };
        cache.set(key, hit);
      } catch (err) {
        if (noTable(err)) return { enabled: false };
        throw err;
      }
    }
    const byDate = new Map();
    const add = (date, seconds, sessions) => { const c = byDate.get(date) || { seconds: 0, sessions: 0 }; c.seconds += seconds; c.sessions += sessions; byDate.set(date, c); };
    hit.rows.filter((r) => r.d >= from && r.d <= today).forEach((r) => add(r.d, Number(r.active_seconds), Number(r.session_count)));
    buffer.pendingFor(userId).filter((r) => r.date >= from && r.date <= today).forEach((r) => add(r.date, r.seconds, r.sessions));

    const series = [];
    for (let i = 0; i < span; i++) { const date = addDays(from, i); series.push({ date, seconds: (byDate.get(date) || { seconds: 0 }).seconds }); }
    const totalSeconds = series.reduce((sum, d) => sum + d.seconds, 0);
    const sessions = [...byDate.values()].reduce((sum, c) => sum + c.sessions, 0);
    const activeDays = series.filter((d) => d.seconds > 0).length;
    const busiest = series.reduce((best, d) => (d.seconds > (best ? best.seconds : 0) ? d : best), null);
    return {
      enabled: true, days: series, today, totalSeconds,
      todaySeconds: series[series.length - 1].seconds,
      activeDays, avgPerActiveDay: activeDays ? Math.round(totalSeconds / activeDays) : 0,
      avgSessionSeconds: sessions ? Math.round(totalSeconds / sessions) : 0,
      busiest: busiest ? { date: busiest.date, seconds: busiest.seconds } : null,
      hasData: totalSeconds > 0,
    };
  }

  // A summary must not read between draining the buffer and committing its write.
  // Serialize database operations; heartbeats still add to memory without waiting.
  let operation = Promise.resolve();
  const serialize = (run) => {
    const result = operation.then(run);
    operation = result.catch(() => {});
    return result;
  };
  const flush = () => serialize(writePending);
  const summary = (userId, days) => serialize(() => readSummary(userId, days));

  function start() {
    if (timer || env.USAGE_TRACKING === 'off') return;
    timer = setInterval(() => { buffer.forget(now()); flush().then(purge); }, tuning.FLUSH_MS);
    if (timer.unref) timer.unref();
  }
  async function stop() { if (timer) { clearInterval(timer); timer = null; } await flush(); }

  return { heartbeat, summary, flush, start, stop, _buffer: buffer };
}

module.exports = { TUNING, phDate, addDays, createUsageBuffer, createUsageService };
