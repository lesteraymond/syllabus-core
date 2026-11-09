'use strict';
// The academic year scope on the lists: GET /syllabi, GET /compliance, GET /compliance/history, and the year a new draft is stamped with. The fake database records the SQL
// and the parameters (it cannot evaluate SQL), so these tests check what the server asks the database for, and what it refuses.
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const YEARS = [{ label: '2025–2026', start_year: 2025, is_current: 0 }, { label: '2026–2027', start_year: 2026, is_current: 0 }, { label: '2027–2028', start_year: 2027, is_current: 1 }, { label: '2028–2029', start_year: 2028, is_current: 0 }];

function makeDb({ years = YEARS, syllabusRows = [] } = {}) {
  const log = [];
  const handle = (sql, params = []) => {
    log.push({ sql, params });
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [[{ user_id: params[0] }]];
    if (sql.startsWith('SELECT label, start_year, is_current FROM academic_years')) {
      if (!years) throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' });
      return [years];
    }
    if (sql.startsWith('SELECT s.*, u.first_name')) return [syllabusRows];
    if (sql === 'SELECT 1 FROM ai_check_runs LIMIT 1') throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' });
    if (sql.startsWith('SELECT s.syllabus_id, s.user_id, s.course_code')) return [[]];
    if (sql.startsWith('INSERT INTO syllabi')) return [{ insertId: 77 }];
    if (sql.startsWith('SELECT 1 FROM syllabus_review_stages')) throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' });
    throw new Error('unexpected query: ' + sql);
  };
  return { log, query: async (s, p) => handle(s, p), getConnection: async () => ({ query: async (s, p) => handle(s, p), beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} }) };
}

async function withServer(opts, fn) {
  const db = makeDb(opts);
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { const h = req.headers['x-test-user']; req.session = h ? { user: JSON.parse(h) } : {}; next(); });
  app.locals.db = db;
  app.use('/api/syllabi', require('./syllabi'));
  app.use('/api/syllabi', require('./syllabusContent'));
  app.use('/api', require('./compliance'));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const call = async (as, method, path, body) => { const r = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method, headers: { 'Content-Type': 'application/json', 'x-test-user': JSON.stringify(as) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  try { await fn({ call, db }); } finally { await new Promise((r) => server.close(r)); }
}
const admin = { id: 1, role: 'admin', firstName: 'Ada', lastName: 'Admin' }, fay = { id: 5, role: 'faculty', firstName: 'Fay', lastName: 'Faculty' }, vee = { id: 9, role: 'vpaa', firstName: 'Vee', lastName: 'Paa' };
const listQuery = (db) => db.log.filter((e) => e.sql.startsWith('SELECT s.*, u.first_name')).at(-1);
const ROW = { syllabus_id: 3, user_id: 5, status: 'approved', first_name: 'Fay', last_name: 'F', academic_year: '2026–2027', uploaded_at: new Date(), updated_at: new Date() };

test('GET /syllabi starts on the current academic year, so a new year is empty until syllabi are made in it', () => withServer({}, async ({ call, db }) => {
  assert.strictEqual((await call(fay, 'GET', '/syllabi')).status, 200);
  const q = listQuery(db);
  assert.ok(q.sql.includes(' AND COALESCE(s.academic_year, ?) IN (?)'), q.sql);
  assert.deepStrictEqual(q.params.slice(-2), ['2027–2028', ['2027–2028']]);
  assert.ok(q.sql.indexOf('s.user_id = ?') < q.sql.indexOf('COALESCE(s.academic_year'), 'the owner filter is still there');
}));

test('GET /syllabi?year= takes the previous year for a faculty member, refuses a year she may not see, and each row carries its year', () => withServer({ syllabusRows: [ROW] }, async ({ call, db }) => {
  const prev = await call(fay, 'GET', '/syllabi?year=' + encodeURIComponent('2026–2027'));
  assert.strictEqual(prev.status, 200);
  assert.strictEqual(prev.body[0].academicYear, '2026–2027');
  assert.deepStrictEqual(listQuery(db).params.slice(-2), ['2027–2028', ['2026–2027']]);
  for (const asked of ['2025–2026', '2028–2029']) {
    const refused = await call(fay, 'GET', '/syllabi?year=' + encodeURIComponent(asked));
    assert.deepStrictEqual([refused.status, refused.body.code], [403, 'year_not_allowed'], asked);
  }
  const all = await call(fay, 'GET', '/syllabi?year=all');
  assert.strictEqual(all.status, 200);
  assert.deepStrictEqual(listQuery(db).params.slice(-2), ['2027–2028', ['2026–2027', '2027–2028']], 'all, for a faculty member, is previous + current');
}));

test('an administrator may ask for any year and for all of them (no year condition)', () => withServer({}, async ({ call, db }) => {
  assert.strictEqual((await call(admin, 'GET', '/syllabi?year=' + encodeURIComponent('2025–2026'))).status, 200);
  assert.deepStrictEqual(listQuery(db).params.slice(-2), ['2027–2028', ['2025–2026']]);
  assert.strictEqual((await call(admin, 'GET', '/syllabi?year=all')).status, 200);
  assert.ok(!listQuery(db).sql.includes('academic_year'), 'every year, nothing filtered');
  assert.strictEqual((await call(vee, 'GET', '/syllabi?year=' + encodeURIComponent('2025–2026'))).status, 403, 'the VPAA is not an administrator here');
}));

test('the repository and the archived list are scoped the same way', () => withServer({}, async ({ call, db }) => {
  await call(fay, 'GET', '/syllabi?scope=repository');
  assert.ok(listQuery(db).sql.includes("s.status = 'approved'") && listQuery(db).sql.includes('academic_year'));
  await call(fay, 'GET', '/syllabi?archived=1&year=' + encodeURIComponent('2026–2027'));
  assert.ok(listQuery(db).sql.includes('s.archived_at IS NOT NULL') && listQuery(db).params.at(-1)[0] === '2026–2027');
}));

test('before the migration the lists are not scoped and a year is not refused', () => withServer({ years: null }, async ({ call, db }) => {
  assert.strictEqual((await call(fay, 'GET', '/syllabi?year=1999')).status, 200);
  assert.ok(!listQuery(db).sql.includes('academic_year'));
}));

test('GET /compliance (the AI Checker, Dashboard and Analytics list) takes the same year', () => withServer({}, async ({ call, db }) => {
  assert.strictEqual((await call(fay, 'GET', '/compliance?syllabus=all')).status, 200);
  let q = db.log.filter((e) => e.sql.startsWith('SELECT s.syllabus_id, s.user_id, s.course_code')).at(-1);
  assert.ok(q.sql.includes('WHERE s.user_id = ? AND COALESCE(s.academic_year, ?) IN (?) ORDER BY'), q.sql.slice(-160));
  assert.deepStrictEqual(q.params, [5, '2027–2028', ['2027–2028']]);
  assert.strictEqual((await call(admin, 'GET', '/compliance?syllabus=all&year=all')).status, 200);
  q = db.log.filter((e) => e.sql.startsWith('SELECT s.syllabus_id, s.user_id, s.course_code')).at(-1);
  assert.ok(!q.sql.includes('academic_year') && q.sql.includes("s.status <> 'draft' ORDER BY"));
  assert.strictEqual((await call(fay, 'GET', '/compliance?syllabus=all&year=' + encodeURIComponent('2025–2026'))).status, 403);
}));

test('a new draft is stamped with the current academic year; before the migration it is created as it always was', () => withServer({}, async ({ call, db }) => {
  const made = await call(admin, 'POST', '/syllabi/drafts');
  assert.deepStrictEqual([made.status, made.body.id], [200, 77]);
  const insert = db.log.find((e) => e.sql.startsWith('INSERT INTO syllabi'));
  assert.ok(insert.sql.includes('academic_year') && insert.params.includes('2027–2028'), insert.sql);
}));
test('a draft made before the migration has no year column', () => withServer({ years: null }, async ({ call, db }) => {
  assert.strictEqual((await call(admin, 'POST', '/syllabi/drafts')).status, 200);
  assert.ok(!db.log.find((e) => e.sql.startsWith('INSERT INTO syllabi')).sql.includes('academic_year'));
}));
