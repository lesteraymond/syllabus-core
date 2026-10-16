// HTTP-level tests for the time-usage endpoints: sign-in is required, each account reads and adds only its own time, and a bad range
// falls back safely. In-memory fake database. Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { createUsageService } = require('../lib/usage');

const fay = { id: 5, role: 'faculty', firstName: 'Fay', lastName: 'F' };
const gus = { id: 6, role: 'faculty', firstName: 'Gus', lastName: 'G' };
const T0 = Date.UTC(2026, 9, 14, 2, 0, 0);

function makeDb() {
  const stored = [{ user_id: 5, usage_date: '2026-10-13', active_seconds: 1200, session_count: 1 }, { user_id: 6, usage_date: '2026-10-13', active_seconds: 777, session_count: 1 }];
  return {
    async query(text, p = []) {
      const sql = String(text).replace(/\s+/g, ' ').trim();
      if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [[{ user_id: p[0] }]];
      if (sql.startsWith('SELECT DATE_FORMAT')) return [stored.filter((r) => r.user_id === p[0] && r.usage_date >= p[1]).map((r) => ({ d: r.usage_date, active_seconds: r.active_seconds, session_count: r.session_count }))];
      if (sql.startsWith('INSERT INTO usage_daily') || sql.startsWith('DELETE FROM usage_daily')) return [{}];
      throw new Error('unexpected query: ' + sql);
    },
  };
}

async function withServer(fn, { withService = true } = {}) {
  const db = makeDb();
  let clock = T0;
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { const h = req.headers['x-test-user']; req.session = h ? { user: JSON.parse(h) } : {}; next(); });
  app.locals.db = db;
  if (withService) app.locals.usage = createUsageService({ db, now: () => clock, log: { warn() {}, error() {} } });
  app.use('/api/usage', require('./usage'));
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const call = async (method, path, as) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/usage${path}`, { method, headers: as ? { 'x-test-user': JSON.stringify(as) } : {} });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  try { await fn({ call, tick: (ms) => { clock += ms; } }); } finally { await new Promise((r) => server.close(r)); }
}

test('both endpoints need a signed-in user', () => withServer(async ({ call }) => {
  assert.strictEqual((await call('POST', '/heartbeat')).status, 401);
  assert.strictEqual((await call('GET', '/summary')).status, 401);
}));

test('a heartbeat counts for the person who sent it, and the summary shows it', () => withServer(async ({ call, tick }) => {
  assert.deepStrictEqual((await call('POST', '/heartbeat', fay)).body, { enabled: true });
  tick(30000);
  await call('POST', '/heartbeat', fay);
  const s = (await call('GET', '/summary?days=7', fay)).body;
  assert.strictEqual(s.todaySeconds, 30);
  assert.strictEqual(s.totalSeconds, 1200 + 30);
}));

test('each account sees only its own time, and cannot choose whose to read', () => withServer(async ({ call, tick }) => {
  await call('POST', '/heartbeat', fay); tick(30000); await call('POST', '/heartbeat', fay);
  const gusView = (await call('GET', '/summary?days=7&userId=5', gus)).body;
  assert.strictEqual(gusView.totalSeconds, 777, 'a userId in the query is ignored');
  assert.strictEqual(gusView.todaySeconds, 0, 'fay\'s heartbeats are not gus\'s time');
}));

test('days=30 returns thirty days; an unknown value returns seven', () => withServer(async ({ call }) => {
  assert.strictEqual((await call('GET', '/summary?days=30', fay)).body.days.length, 30);
  assert.strictEqual((await call('GET', '/summary?days=abc', fay)).body.days.length, 7);
}));

test('without the usage service the endpoints answer disabled instead of failing', () => withServer(async ({ call }) => {
  assert.deepStrictEqual((await call('POST', '/heartbeat', fay)).body, { enabled: false });
  assert.deepStrictEqual((await call('GET', '/summary', fay)).body, { enabled: false });
}, { withService: false }));
