// HTTP-level tests for the order of a submission: it goes to the AI Checker first, and only a syllabus the administrator has checked on its
// newest version can be decided (approved, returned for revision, rejected) in Review & Approval. The syllabus list tells the administrator
// which submissions still wait for their check. In-memory fake database. Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const svc = require('../lib/compliance/service');
const F = require('../lib/compliance/fixtures');

const admin = { id: 1, role: 'admin', firstName: 'Ann', lastName: 'A' };
const fay = { id: 5, role: 'faculty', firstName: 'Fay', lastName: 'F' };

function makeDb(installed = true) {
  const s = {
    installed,
    syllabi: {
      1: { syllabus_id: 1, user_id: 5, status: 'submitted', version: 'v1.0', title: 'Fundamentals of Mathematics', course_code: 'FM 202' },
      2: { syllabus_id: 2, user_id: 5, status: 'submitted', version: 'v1.0', title: 'Legacy', course_code: 'OLD 1' },
      3: { syllabus_id: 3, user_id: 5, status: 'draft', version: 'v1.0', title: 'Draft', course_code: 'FM 203' },
    },
    versions: [
      { version_id: 10, syllabus_id: 1, content: '{"meta":{}}', file_path: null },
      { version_id: 20, syllabus_id: 2, content: null, file_path: null }, // nothing in the newest version that a check can read
    ],
    runs: [],
    logged: [],
  };
  const handle = (sql, p = []) => {
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [[{ user_id: p[0] }]];
    if (sql.startsWith('SELECT 1 FROM ai_check_runs')) { if (!s.installed) throw new Error("Table 'ai_check_runs' doesn't exist"); return [[]]; }
    if (sql.startsWith('SELECT s.*, u.first_name')) {
      return [Object.values(s.syllabi).filter((x) => x.status !== 'draft').map((x) => ({ ...x, first_name: 'Fay', last_name: 'F', avatar_path: null, program_name: null, course_title: x.live_title || x.title, course_code_live: x.live_code || null, program_code: 'BSFM', program_full_name: 'BS Financial Management' }))];
    }
    // svc.adminCheckStates: the newest version of each syllabus, and the administrator's runs
    if (sql.startsWith('SELECT v.syllabus_id, v.version_id, (v.content IS NOT NULL')) {
      return [p[0].map((id) => s.versions.filter((v) => v.syllabus_id === id).slice(-1)[0]).filter(Boolean)
        .map((v) => ({ syllabus_id: v.syllabus_id, version_id: v.version_id, checkable: v.content || v.file_path ? 1 : 0 }))];
    }
    if (sql.startsWith('SELECT DISTINCT syllabus_id, version_id FROM ai_check_runs')) {
      return [s.runs.filter((r) => p[0].includes(r.syllabus_id) && r.version_id !== null && r.created_by !== null && r.created_by !== s.syllabi[r.syllabus_id].user_id)
        .map((r) => ({ syllabus_id: r.syllabus_id, version_id: r.version_id }))];
    }
    if (sql.startsWith('SELECT syllabus_id, user_id, status FROM syllabi WHERE syllabus_id')) return [s.syllabi[p[0]] ? [s.syllabi[p[0]]] : []];
    if (sql.startsWith('SELECT v.*, u.first_name, u.last_name')) return [(s.history || []).filter((v) => v.syllabus_id === p[0]).map((v) => ({ first_name: 'Fay', last_name: 'F', ...v }))];
    if (sql.startsWith('SELECT l.action, l.notes, l.action_date')) return [(s.logs || []).filter((l) => l.syllabus_id === p[0]).map((l) => ({ first_name: 'Ann', last_name: 'A', ...l }))];
    if (sql.startsWith('SELECT * FROM syllabi WHERE syllabus_id')) return [s.syllabi[p[0]] ? [{ ...s.syllabi[p[0]] }] : []];
    if (sql.startsWith('UPDATE syllabi SET status = ?')) { s.syllabi[p[p.length - 1]].status = p[0]; return [{}]; }
    if (/^(INSERT|UPDATE|DELETE)/.test(sql)) { s.logged.push(sql.slice(0, 40)); return [{}]; }
    if (sql.startsWith("SELECT user_id FROM users WHERE role = 'admin'")) return [[]];
    if (/FROM course_prerequisites/.test(sql)) return [[]]; // a subject's prerequisites: none set
    throw new Error('unexpected query: ' + sql);
  };
  const conn = { query: async (q, p) => handle(q, p), beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} };
  return { s, query: async (q, p) => handle(q, p), getConnection: async () => conn };
}

async function withServer(opts, fn) {
  if (typeof opts === 'function') { fn = opts; opts = {}; }
  const db = makeDb(opts.installed !== false);
  svc.resetInstalledCache();
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { const h = req.headers['x-test-user']; req.session = h ? { user: JSON.parse(h) } : {}; next(); });
  app.locals.db = db;
  app.use('/api/syllabi', require('./syllabi'));
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (as, method, path, body) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(as ? { 'x-test-user': JSON.stringify(as) } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  try { await fn({ db, call }); } finally { await new Promise((r) => server.close(r)); }
}

const adminRun = (db, syllabusId, versionId) => db.s.runs.push({ run_id: db.s.runs.length + 1, syllabus_id: syllabusId, version_id: versionId, created_by: 1 });
const authorRun = (db, syllabusId, versionId) => db.s.runs.push({ run_id: db.s.runs.length + 1, syllabus_id: syllabusId, version_id: versionId, created_by: 5 });
const listed = async (call, id) => (await call(admin, 'GET', '/syllabi')).body.find((x) => x.id === id);

test('a submission waits for the AI Checker: the administrator\'s list says so, and a decision is refused until it is checked', () => withServer(async ({ call, db }) => {
  assert.strictEqual((await listed(call, 1)).awaitingAiCheck, true);
  for (const [status, extra] of [['approved', {}], ['for_revision', { adminComment: 'Fix the grading.' }], ['rejected', { adminComment: 'Not acceptable.' }]]) {
    const r = await call(admin, 'PUT', '/syllabi/1', { status, ...extra });
    assert.strictEqual(r.status, 409, status);
    assert.match(r.body.error, /Check this syllabus in the AI Checker/);
  }
  assert.strictEqual(db.s.syllabi[1].status, 'submitted');
}));

test('the faculty member\'s own check does not open the decision: only the administrator\'s check does', () => withServer(async ({ call, db }) => {
  authorRun(db, 1, 10); // what the faculty member\'s submit stored, on the newest version
  assert.strictEqual((await listed(call, 1)).awaitingAiCheck, true);
  assert.strictEqual((await call(admin, 'PUT', '/syllabi/1', { status: 'approved' })).status, 409);
  adminRun(db, 1, 10);
  assert.strictEqual((await listed(call, 1)).awaitingAiCheck, false);
  assert.strictEqual((await call(admin, 'PUT', '/syllabi/1', { status: 'approved' })).status, 200);
  assert.strictEqual(db.s.syllabi[1].status, 'approved');
}));

test('once checked, each decision is allowed; the check does not decide anything by itself', () => withServer(async ({ call, db }) => {
  adminRun(db, 1, 10);
  assert.strictEqual(db.s.syllabi[1].status, 'submitted'); // a check changes no status
  assert.strictEqual((await call(admin, 'PUT', '/syllabi/1', { status: 'for_revision', adminComment: 'Fix the grading.' })).status, 200);
  assert.strictEqual(db.s.syllabi[1].status, 'for_revision');
}));

test('a new version needs a new check: the old one, made on an earlier version, is no longer enough', () => withServer(async ({ call, db }) => {
  adminRun(db, 1, 10);
  assert.strictEqual((await listed(call, 1)).awaitingAiCheck, false);
  db.s.versions.push({ version_id: 11, syllabus_id: 1, content: '{"meta":{"again":1}}', file_path: null }); // the faculty member resubmitted
  assert.strictEqual((await listed(call, 1)).awaitingAiCheck, true);
  assert.strictEqual((await call(admin, 'PUT', '/syllabi/1', { status: 'approved' })).status, 409);
  adminRun(db, 1, 11);
  assert.strictEqual((await listed(call, 1)).awaitingAiCheck, false);
  assert.strictEqual((await call(admin, 'PUT', '/syllabi/1', { status: 'approved' })).status, 200);
}));

test('a submission with nothing the check can read is not held back (it would wait forever), and is not marked as waiting', () => withServer(async ({ call }) => {
  assert.strictEqual((await listed(call, 2)).awaitingAiCheck, false);
  assert.strictEqual((await call(admin, 'PUT', '/syllabi/2', { status: 'approved' })).status, 200);
}));

test('before the compliance tables exist nothing can be checked, so nothing waits and decisions work as they always did', () => withServer({ installed: false }, async ({ call }) => {
  assert.strictEqual((await listed(call, 1)).awaitingAiCheck, false);
  assert.strictEqual((await call(admin, 'PUT', '/syllabi/1', { status: 'approved' })).status, 200);
}));

test('only an administrator\'s list carries the flag, and drafts stay out of it', () => withServer(async ({ call }) => {
  const mine = await call(fay, 'GET', '/syllabi');
  assert.ok(mine.body.length > 0 && mine.body.every((x) => !('awaitingAiCheck' in x)));
  assert.ok(!(await call(admin, 'GET', '/syllabi')).body.some((x) => x.id === 3));
}));

test('the version history says what changed between versions and what the administrator decided, for the owner and the administrator', () => withServer(async ({ call, db }) => {
  const a = F.good();
  const b = F.good(); b.description[0].t += ' extra';
  const c = F.good(); c.description[0].t += ' extra'; c.grading.rows[0].pct = 55; c.grading.rows[1].pct = 45;
  const at = (n) => '2026-03-0' + n + 'T10:00:00Z';
  const v = (id, label, content, day, note) => ({ version_id: id, syllabus_id: 1, version_label: label, title: 'Fundamentals of Mathematics', course_code: 'FM 202', curriculum_id: null, file_path: null, status_at_save: 'submitted', note, content: JSON.stringify(content), created_by: 5, created_at: at(day) });
  db.s.history = [v(10, 'v1.0', a, 1, 'Initial version'), v(11, 'v1.1', b, 3, 'Added to the description.'), v(12, 'v1.2', c, 5, 'Changed the grading split.')];
  db.s.logs = [
    { syllabus_id: 1, action: 'revision', notes: 'Status changed to for_revision: Fix the description.', action_date: at(2) },
    { syllabus_id: 1, action: 'revision', notes: 'Status changed to for_revision', action_date: at(4) }, // an older log line with no reason stored
  ];
  for (const who of [admin, fay]) {
    const r = await call(who, 'GET', '/syllabi/1/versions');
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(r.body.map((x) => x.version), ['v1.2', 'v1.1', 'v1.0']); // newest first, every version listed
    const [v12, v11, v10] = r.body;
    assert.strictEqual(v10.changes, null);
    assert.strictEqual(v11.changes.text, 'Course description (1 word)');
    assert.strictEqual(v12.changes.text, 'Grading system (4 words)'); // the grading split (two percentages out, two in), not the description
    assert.deepStrictEqual(v12.changes.sections.map((x) => x.key), ['grading']);
    assert.deepStrictEqual([v10.decision.action, v10.decision.reason, v10.decision.by], ['revision', 'Fix the description.', 'Ann A']);
    assert.deepStrictEqual([v11.decision.action, v11.decision.reason], ['revision', '']);
    assert.strictEqual(v12.decision, null);
    assert.strictEqual(v11.note, 'Added to the description.'); // what the faculty member said they changed
  }
  assert.strictEqual((await call({ id: 6, role: 'faculty', firstName: 'Gus', lastName: 'G' }, 'GET', '/syllabi/1/versions')).status, 404);
}));

test('a student\'s list and the repository show the subject as the catalog has it now; the working lists keep the syllabus\'s own text', () => withServer(async ({ call, db }) => {
  Object.assign(db.s.syllabi[1], { live_code: 'FM 202-A', live_title: 'Fundamentals of Mathematics (Revised)' });
  const student = { id: 9, role: 'student' };
  const forStudent = (await call(student, 'GET', '/syllabi')).body.find((x) => x.id === 1);
  assert.deepStrictEqual([forStudent.courseCode, forStudent.title, forStudent.programCode, forStudent.programName], ['FM 202-A', 'Fundamentals of Mathematics (Revised)', 'BSFM', 'BS Financial Management']);
  const repo = (await call(admin, 'GET', '/syllabi?scope=repository')).body.find((x) => x.id === 1);
  assert.deepStrictEqual([repo.courseCode, repo.title], ['FM 202-A', 'Fundamentals of Mathematics (Revised)']);
  const working = (await call(admin, 'GET', '/syllabi')).body.find((x) => x.id === 1);
  assert.deepStrictEqual([working.courseCode, working.title], ['FM 202', 'Fundamentals of Mathematics']); // the syllabus's own copy
  const unlinked = (await call(student, 'GET', '/syllabi')).body.find((x) => x.id === 2);
  assert.deepStrictEqual([unlinked.courseCode, unlinked.title], ['OLD 1', 'Legacy']); // no catalog subject: its own text
}));
