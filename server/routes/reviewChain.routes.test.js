// HTTP-level tests for the review chain: the dean (admin), the Asst. VPAA and the LIC Director each clear their own stage on a submitted
// syllabus (after the AI check); when the third clears, the VPAA is told; a new version starts the three checks again. Nothing here
// approves anything: that is the VPAA's, in routes/syllabi.js. In-memory fake database. Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const svc = require('../lib/compliance/service');
const reviewStages = require('../lib/reviewStages');

const dean = { id: 1, role: 'admin', firstName: 'Diana', lastName: 'Evale' };
const asst = { id: 2, role: 'asst_vpaa', firstName: 'Asa', lastName: 'Vee' };
const lic = { id: 3, role: 'lic_director', firstName: 'Lia', lastName: 'Director' };
const vpaa = { id: 4, role: 'vpaa', firstName: 'Vee', lastName: 'Paa' };
const fay = { id: 5, role: 'faculty', firstName: 'Fay', lastName: 'F' };
const gus = { id: 6, role: 'faculty', firstName: 'Gus', lastName: 'G' };
const NAMES = { 1: ['Diana', 'Evale'], 2: ['Asa', 'Vee'], 3: ['Lia', 'Director'], 4: ['Vee', 'Paa'], 5: ['Fay', 'F'] };

function makeDb({ chain = true, compliance = true } = {}) {
  const s = {
    syllabi: {
      1: { syllabus_id: 1, user_id: 5, status: 'submitted', title: 'Programming 2', course_code: 'IT 204', archived_at: null },
      2: { syllabus_id: 2, user_id: 5, status: 'draft', title: 'A draft', course_code: 'IT 205', archived_at: null },
      3: { syllabus_id: 3, user_id: 5, status: 'approved', title: 'Done', course_code: 'IT 206', archived_at: null },
      4: { syllabus_id: 4, user_id: 1, status: 'under_review', title: 'Dean wrote this', course_code: 'IT 207', archived_at: null },
    },
    versions: [{ version_id: 10, syllabus_id: 1 }, { version_id: 40, syllabus_id: 4 }],
    runs: [], stages: [], logs: [], notifications: [], vpaaIds: [4],
  };
  const handle = (text, p = []) => {
    const sql = String(text).replace(/\s+/g, ' ').trim();
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [[{ user_id: p[0] }]];
    if (sql.startsWith('SELECT 1 FROM syllabus_review_stages')) { if (!chain) throw new Error("Table 'syllabus_review_stages' doesn't exist"); return [[]]; }
    if (sql.startsWith('SELECT 1 FROM ai_check_runs')) { if (!compliance) throw new Error("Table 'ai_check_runs' doesn't exist"); return [[]]; }
    if (sql.startsWith('SELECT syllabus_id, user_id, status, title, course_code, archived_at FROM syllabi')) return [s.syllabi[p[0]] ? [{ ...s.syllabi[p[0]] }] : []];
    if (sql.startsWith('SELECT syllabus_id, user_id, status FROM syllabi')) return [s.syllabi[p[0]] ? [{ ...s.syllabi[p[0]] }] : []];
    if (sql.startsWith('SELECT v.syllabus_id, v.version_id, (v.content IS NOT NULL')) {
      return [p[0].map((id) => s.versions.filter((v) => v.syllabus_id === id).slice(-1)[0]).filter(Boolean).map((v) => ({ syllabus_id: v.syllabus_id, version_id: v.version_id, checkable: 1 }))];
    }
    if (sql.startsWith('SELECT DISTINCT syllabus_id, version_id FROM ai_check_runs')) {
      return [s.runs.filter((r) => p[0].includes(r.syllabus_id) && r.created_by !== s.syllabi[r.syllabus_id].user_id).map((r) => ({ syllabus_id: r.syllabus_id, version_id: r.version_id }))];
    }
    if (sql.startsWith('SELECT version_id, version_label, content FROM syllabus_versions')) return [s.versions.filter((v) => v.syllabus_id === p[0]).slice(-1)];
    if (sql.startsWith('SELECT syllabus_id, MAX(version_id) AS version_id FROM syllabus_versions')) return [p[0].map((id) => s.versions.filter((v) => v.syllabus_id === id).slice(-1)[0]).filter(Boolean).map((v) => ({ syllabus_id: v.syllabus_id, version_id: v.version_id }))];
    if (sql.startsWith('SELECT s.syllabus_id, s.version_id, s.stage')) {
      return [s.stages.filter((r) => p[0].includes(r.syllabus_id)).map((r) => ({ ...r, note: r.note || null, cleared_at: '2026-03-02T00:00:00Z', first_name: NAMES[r.reviewer_id][0], last_name: NAMES[r.reviewer_id][1] }))];
    }
    if (sql.startsWith('INSERT INTO syllabus_review_stages')) {
      const [syllabus_id, version_id, stage, reviewer_id, note] = p;
      if (!s.stages.some((r) => r.syllabus_id === syllabus_id && r.version_id === version_id && r.stage === stage)) s.stages.push({ syllabus_id, version_id, stage, reviewer_id, note });
      return [{}];
    }
    if (sql.startsWith('INSERT INTO submission_logs')) { s.logs.push({ syllabus_id: p[0], user_id: p[1], action: p[2], notes: p[3] }); return [{}]; }
    if (sql.startsWith("UPDATE syllabi SET status = 'under_review'")) { s.syllabi[p[0]].status = 'under_review'; return [{}]; }
    if (sql.startsWith('SELECT user_id FROM users WHERE role IN (?)')) return [s.vpaaIds.filter((id) => p[0].includes('vpaa') && id !== p[1]).map((user_id) => ({ user_id }))];
    if (sql.startsWith('INSERT INTO notifications')) { s.notifications.push({ user_id: p[0], type: p[1], syllabus_id: p[2], title: p[3] }); return [{}]; }
    if (sql.startsWith('SELECT l.action_date, u.first_name, u.last_name FROM submission_logs')) return [[{ action_date: '2026-03-09T00:00:00Z', first_name: 'Vee', last_name: 'Paa' }]];
    throw new Error('unexpected query: ' + sql);
  };
  const conn = { query: async (q, p) => handle(q, p), beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} };
  return { s, query: async (q, p) => handle(q, p), getConnection: async () => conn };
}

async function withServer(opts, fn) {
  if (typeof opts === 'function') { fn = opts; opts = {}; }
  const db = makeDb(opts);
  svc.resetInstalledCache();
  reviewStages.resetInstalledCache();
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { const h = req.headers['x-test-user']; req.session = h ? { user: JSON.parse(h) } : {}; next(); });
  app.locals.db = db;
  app.use('/api/syllabi', require('./reviewChain'));
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const call = async (as, method, path, body) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/syllabi${path}`, { method, headers: { 'Content-Type': 'application/json', ...(as ? { 'x-test-user': JSON.stringify(as) } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  try { await fn({ call, db }); } finally { await new Promise((r) => server.close(r)); }
}
const checked = (db, syllabusId = 1, versionId = 10, by = 2) => db.s.runs.push({ syllabus_id: syllabusId, version_id: versionId, created_by: by }); // a run by someone other than the owner

test('only the dean, the Asst. VPAA and the LIC Director clear a stage; the VPAA, faculty and visitors cannot', () => withServer(async ({ call, db }) => {
  checked(db);
  assert.strictEqual((await call(null, 'POST', '/1/stage-clear')).status, 401);
  for (const who of [fay, vpaa, { id: 9, role: 'student' }]) assert.strictEqual((await call(who, 'POST', '/1/stage-clear')).status, 403, who.role);
  assert.strictEqual((await call(dean, 'POST', '/1/stage-clear')).status, 200);
}));

test('the AI check comes first: no stage is cleared until a reviewer has checked the newest version', () => withServer(async ({ call, db }) => {
  const early = await call(dean, 'POST', '/1/stage-clear');
  assert.strictEqual(early.status, 409);
  assert.match(early.body.error, /Check this syllabus in the AI Checker/);
  assert.strictEqual(db.s.stages.length, 0);
  db.s.runs.push({ syllabus_id: 1, version_id: 10, created_by: 5 }); // the author's own check does not count
  assert.strictEqual((await call(dean, 'POST', '/1/stage-clear')).status, 409);
  checked(db);
  const ok = await call(dean, 'POST', '/1/stage-clear', { note: 'Looks complete.' });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.body.status, 'under_review'); // the first clearance starts the review
  assert.strictEqual(db.s.syllabi[1].status, 'under_review');
  assert.deepStrictEqual(db.s.stages.map((r) => [r.stage, r.reviewer_id, r.version_id, r.note]), [['dean', 1, 10, 'Looks complete.']]);
  assert.deepStrictEqual(db.s.logs.map((l) => [l.action, l.user_id]), [['check', 1]]);
  assert.match(db.s.logs[0].notes, /Cleared the dean review: Looks complete\./);
}));

test('each role clears its own stage; the VPAA is told only when the third clears, and clearing twice changes nothing', () => withServer(async ({ call, db }) => {
  checked(db);
  const first = await call(asst, 'POST', '/1/stage-clear');
  assert.strictEqual(first.body.stages.asst_vpaa.cleared, true);
  assert.strictEqual(first.body.stages.allCleared, false);
  assert.strictEqual((await call(asst, 'POST', '/1/stage-clear')).status, 200);
  assert.strictEqual(db.s.stages.length, 1);
  assert.strictEqual((await call(dean, 'POST', '/1/stage-clear')).body.stages.cleared, 2);
  assert.strictEqual(db.s.notifications.length, 0);
  const third = await call(lic, 'POST', '/1/stage-clear');
  assert.strictEqual(third.body.stages.allCleared, true);
  assert.deepStrictEqual(db.s.notifications.map((n) => [n.user_id, n.type, n.syllabus_id]), [[4, 'chain', 1]]);
  assert.match(db.s.notifications[0].title, /Ready for approval: IT 204/);
  await call(lic, 'POST', '/1/stage-clear');
  assert.strictEqual(db.s.notifications.length, 1); // not told again
}));

test('a new version starts the three checks again', () => withServer(async ({ call, db }) => {
  checked(db);
  for (const who of [dean, asst, lic]) await call(who, 'POST', '/1/stage-clear');
  assert.strictEqual((await call(fay, 'GET', '/1/stages')).body.stages.allCleared, true);
  db.s.versions.push({ version_id: 11, syllabus_id: 1 }); // the faculty member resubmitted
  assert.strictEqual((await call(dean, 'GET', '/1/stages')).body.stages.cleared, 0);
  assert.strictEqual((await call(dean, 'POST', '/1/stage-clear')).status, 409); // and the new version needs its own check first
  checked(db, 1, 11);
  assert.strictEqual((await call(dean, 'POST', '/1/stage-clear')).body.stages.cleared, 1);
}));

test('a syllabus that is not waiting for review, a draft, your own syllabus and a missing table are all refused', () => withServer(async ({ call, db }) => {
  checked(db, 3, 30); checked(db, 4, 40);
  assert.strictEqual((await call(dean, 'POST', '/2/stage-clear')).status, 404); // a draft is the author's
  assert.strictEqual((await call(dean, 'POST', '/3/stage-clear')).status, 409); // approved is final
  assert.strictEqual((await call(dean, 'POST', '/4/stage-clear')).status, 409); // the dean cannot clear their own syllabus
  assert.strictEqual((await call(dean, 'POST', '/99/stage-clear')).status, 404);
  assert.strictEqual((await call(dean, 'POST', '/abc/stage-clear')).status, 404);
  db.s.syllabi[1].archived_at = '2026-01-01';
  assert.strictEqual((await call(dean, 'POST', '/1/stage-clear')).status, 409);
}));

test('before the database update the answer says so', () => withServer({ chain: false }, async ({ call }) => {
  assert.strictEqual((await call(dean, 'POST', '/1/stage-clear')).status, 503);
  assert.deepStrictEqual((await call(dean, 'GET', '/1/stages')).body, { enabled: false });
}));

test('who sees the stages: reviewers and the owner; another faculty member gets a 404; the approver is named once approved', () => withServer(async ({ call, db }) => {
  checked(db);
  await call(dean, 'POST', '/1/stage-clear');
  for (const who of [dean, asst, lic, vpaa, fay]) {
    const r = await call(who, 'GET', '/1/stages');
    assert.strictEqual(r.status, 200, who.role);
    assert.strictEqual(r.body.stages.dean.by, 'Diana Evale');
    assert.strictEqual(r.body.approved, null);
  }
  assert.strictEqual((await call(gus, 'GET', '/1/stages')).status, 404);
  assert.strictEqual((await call(dean, 'GET', '/2/stages')).status, 404); // a draft
  const approved = await call(fay, 'GET', '/3/stages');
  assert.deepStrictEqual(approved.body.approved, { by: 'Vee Paa', at: '2026-03-09T00:00:00Z' });
}));
