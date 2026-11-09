// HTTP-level tests for the order of a submission: it goes to the AI Checker first, and only a syllabus a reviewer has checked on its
// newest version can be decided (approved, returned for revision, rejected) in Review & Approval. The syllabus list tells the reviewer
// which submissions still wait for the check. Approving is the VPAA's alone, and only after the dean, the Asst. VPAA and the LIC Director
// have cleared the newest version (routes/reviewChain.js); the dean can still return a syllabus for revision. In-memory fake database. Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
require('../lib/syllabuscheck/legacy-storage-test-helper')();
const svc = require('../lib/compliance/service');
const reviewStages = require('../lib/reviewStages');
const reviewAiChoice = require('../lib/reviewAiChoice');
const F = require('../lib/compliance/fixtures');

const admin = { id: 1, role: 'admin', firstName: 'Ann', lastName: 'A' };
const fay = { id: 5, role: 'faculty', firstName: 'Fay', lastName: 'F' };
const vpaa = { id: 9, role: 'vpaa', firstName: 'Vee', lastName: 'Paa' };

function makeDb(installed = true) {
  const s = {
    installed,
    syllabi: {
      1: { syllabus_id: 1, user_id: 5, status: 'submitted', version: 'v1.0', title: 'Fundamentals of Mathematics', course_code: 'FM 202', course_id: 202 },
      2: { syllabus_id: 2, user_id: 5, status: 'submitted', version: 'v1.0', title: 'Legacy', course_code: 'OLD 1' },
      3: { syllabus_id: 3, user_id: 5, status: 'draft', version: 'v1.0', title: 'Draft', course_code: 'FM 203' },
    },
    versions: [
      { version_id: 10, syllabus_id: 1, content: '{"meta":{"courseId":202,"program":"BSMATH"}}', file_path: null },
      { version_id: 20, syllabus_id: 2, content: null, file_path: null }, // nothing in the newest version that a check can read
    ],
    runs: [],
    stages: [], // the review chain: { syllabus_id, version_id, stage }
    chain: true,
    logged: [],
    aiChoice: false, // the syllabus_review_ai_choices table (migrate-review-ai-choice); off: a database before it, as every earlier test assumes
    choices: [],     // { syllabus_id, version_id, reviewer_id }
    logNotes: [],    // submission_logs notes
    people: { admin: [1, 2], asst_vpaa: [3], lic_director: [4], vpaa: [9, 11], faculty: [5] }, // who holds each role (lib/notify.js notifyRoles)
    notified: [],    // { userId, type, title, body }
    emailOn: undefined, // the administrator's "Email notifications" switch as saved (lib/adminSettings.js); undefined: the settings are not readable here
  };
  const handle = (sql, p = []) => {
    if (sql.startsWith('SELECT label, start_year, is_current FROM academic_years')) throw Object.assign(new Error("Table 'academic_years' doesn't exist"), { code: 'ER_NO_SUCH_TABLE' }); // these fixtures are a database before the academic year scope
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [[{ user_id: p[0] }]];
    if (sql.startsWith('SELECT c.course_id AS subject_id')) return [p[0] === 202 ? [{ subject_id: 202, subject_code: 'FM 202', program_id: 1, code: 'BSMATH' }] : []]; // lib/subjectValidation.js
    if (sql.startsWith('SELECT 1 FROM ai_check_runs')) { if (!s.installed) throw new Error("Table 'ai_check_runs' doesn't exist"); return [[]]; }
    if (sql.startsWith('SELECT 1 FROM syllabus_review_stages')) { if (!s.chain) throw new Error("Table 'syllabus_review_stages' doesn't exist"); return [[]]; }
    if (sql.startsWith('SELECT syllabus_id, MAX(version_id) AS version_id FROM syllabus_versions')) return [p[0].map((id) => s.versions.filter((v) => v.syllabus_id === id).slice(-1)[0]).filter(Boolean).map((v) => ({ syllabus_id: v.syllabus_id, version_id: v.version_id }))];
    if (sql.startsWith('SELECT s.syllabus_id, s.version_id, s.stage')) return [s.stages.filter((r) => p[0].includes(r.syllabus_id)).map((r) => ({ reviewer_id: 1, note: '', cleared_at: null, first_name: 'Rev', last_name: 'Iewer', ...r }))];
    if (sql.startsWith('SELECT version_id, version_label, content FROM syllabus_versions')) return [[...s.versions.filter(v => v.syllabus_id === p[0]).slice(-1)]];
    if (sql.startsWith('SELECT s.*, u.first_name')) {
      return [Object.values(s.syllabi).filter((x) => x.status !== 'draft').map((x) => ({ ...x, first_name: 'Fay', last_name: 'F', avatar_path: null, program_name: null, course_title: x.title, program_code: 'BSFM' }))];
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
    if (sql.startsWith('SELECT 1 FROM syllabus_review_ai_choices')) { if (!s.aiChoice) throw new Error("Table 'syllabus_review_ai_choices' doesn't exist"); return [[]]; }
    if (sql.startsWith('SELECT syllabus_id, version_id FROM syllabus_review_ai_choices')) return [s.choices.filter((c) => p[0].includes(c.syllabus_id) && c.reviewer_id === p[1])];
    if (sql.startsWith('INSERT IGNORE INTO syllabus_review_ai_choices')) { const dup = s.choices.some((c) => c.syllabus_id === p[0] && c.version_id === p[1] && c.reviewer_id === p[2]); if (!dup) s.choices.push({ syllabus_id: p[0], version_id: p[1], reviewer_id: p[2] }); return [{ affectedRows: dup ? 0 : 1 }]; }
    if (sql.startsWith('SELECT syllabus_id, user_id, status, title, course_code, archived_at FROM syllabi WHERE syllabus_id = ? FOR UPDATE')) return [s.syllabi[p[0]] ? [{ archived_at: null, ...s.syllabi[p[0]] }] : []];
    if (sql.startsWith('INSERT INTO syllabus_review_stages')) { if (!s.stages.some((r) => r.syllabus_id === p[0] && r.version_id === p[1] && r.stage === p[2])) s.stages.push({ syllabus_id: p[0], version_id: p[1], stage: p[2] }); return [{}]; }
    if (sql.startsWith('INSERT INTO submission_logs')) { s.logNotes.push(p[3]); return [{}]; }
    if (sql.includes("setting_key = 'administration'")) { if (s.emailOn === undefined) throw new Error('no settings in this fixture'); return [[{ setting_value: JSON.stringify({ emailNotifications: s.emailOn }) }]]; }
    // lib/reviewStages.js hiddenFromReviewers: the authors' roles (who is the dean)
    if (sql.startsWith('SELECT user_id, role FROM users WHERE user_id IN (?)')) return [p[0].map((id) => ({ user_id: id, role: ({ 1: 'admin', 3: 'asst_vpaa', 5: 'faculty', 9: 'vpaa', 11: 'vpaa' })[id] || 'faculty' }))];
    if (sql.startsWith('SELECT email, first_name FROM users WHERE user_id')) return [p[0] === 5 ? [{ email: 'fay@x.ph', first_name: 'Fay' }] : []]; // lib/decisionEmail.js: the owner
    if (sql.startsWith('INSERT INTO notifications')) { s.notified.push({ userId: p[0], type: p[1], syllabusId: p[2], title: p[3], body: p[4] }); return [{}]; }
    if (sql.startsWith('SELECT user_id FROM users WHERE role IN (?) AND user_id NOT IN (?)')) return [p[0].flatMap((role) => s.people[role] || []).filter((id) => !p[1].includes(id)).map((user_id) => ({ user_id }))];
    if (sql.startsWith('UPDATE syllabi SET status = ?')) { s.syllabi[p[p.length - 1]].status = p[0]; return [{}]; }
    if (/^(INSERT|UPDATE|DELETE)/.test(sql)) { s.logged.push(sql.slice(0, 40)); return [{}]; }
    if (sql.startsWith("SELECT user_id FROM users WHERE role = 'admin'")) return [[]];
    if (/program_outcome_sources/.test(sql)) throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' }); // not migrated yet
    throw new Error('unexpected query: ' + sql);
  };
  const conn = { query: async (q, p) => handle(q, p), beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} };
  return { s, query: async (q, p) => handle(q, p), getConnection: async () => conn };
}

async function withServer(opts, fn) {
  if (typeof opts === 'function') { fn = opts; opts = {}; }
  const db = makeDb(opts.installed !== false);
  svc.resetInstalledCache();
  reviewStages.resetInstalledCache();
  reviewAiChoice.resetInstalledCache();
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { const h = req.headers['x-test-user']; req.session = h ? { user: JSON.parse(h) } : {}; next(); });
  app.locals.db = db;
  app.use('/api/syllabi', require('./reviewChain'));
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
// What clearing does (routes/reviewChain.js): the stages are recorded, and the first one moves a submitted syllabus to under review.
const clearAll = (db, syllabusId, versionId) => { ['dean', 'asst_vpaa', 'lic_director'].forEach((stage) => db.s.stages.push({ syllabus_id: syllabusId, version_id: versionId, stage })); if (db.s.syllabi[syllabusId].status === 'submitted') db.s.syllabi[syllabusId].status = 'under_review'; };
const authorRun = (db, syllabusId, versionId) => db.s.runs.push({ run_id: db.s.runs.length + 1, syllabus_id: syllabusId, version_id: versionId, created_by: 5 });
const listed = async (call, id) => (await call(admin, 'GET', '/syllabi')).body.find((x) => x.id === id);

test('a submission waits for the AI Checker: the administrator\'s list says so, and a decision is refused until it is checked', () => withServer(async ({ call, db }) => {
  assert.strictEqual((await listed(call, 1)).awaitingAiCheck, true);
  for (const [status, extra] of [['approved', {}], ['for_revision', { adminComment: 'Fix the grading.' }], ['rejected', { adminComment: 'Not acceptable.' }]]) {
    const r = await call(vpaa, 'PUT', '/syllabi/1', { status, ...extra });
    assert.strictEqual(r.status, 409, status);
    assert.match(r.body.error, /Check this syllabus in the AI Checker/);
  }
  assert.strictEqual(db.s.syllabi[1].status, 'submitted');
}));

test('the faculty member\'s own check does not open the decision: only the administrator\'s check does', () => withServer(async ({ call, db }) => {
  authorRun(db, 1, 10); // what the faculty member\'s submit stored, on the newest version
  assert.strictEqual((await listed(call, 1)).awaitingAiCheck, true);
  assert.strictEqual((await call(vpaa, 'PUT', '/syllabi/1', { status: 'approved' })).status, 409);
  adminRun(db, 1, 10);
  assert.strictEqual((await listed(call, 1)).awaitingAiCheck, false);
  const early = await call(vpaa, 'PUT', '/syllabi/1', { status: 'approved' }); // checked, but the dean, the Asst. VPAA and the LIC Director have not cleared it
  assert.strictEqual(early.status, 409);
  assert.strictEqual(early.body.code, 'STAGES_PENDING');
  assert.strictEqual((await call(admin, 'PUT', '/syllabi/1', { status: 'approved' })).status, 403); // the dean never approves, cleared or not
  clearAll(db, 1, 10);
  assert.strictEqual((await call(admin, 'PUT', '/syllabi/1', { status: 'approved' })).status, 403);
  assert.strictEqual((await call(vpaa, 'PUT', '/syllabi/1', { status: 'approved' })).status, 200);
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
  clearAll(db, 1, 10);
  assert.strictEqual((await listed(call, 1)).awaitingAiCheck, false);
  db.s.versions.push({ version_id: 11, syllabus_id: 1, content: '{"meta":{"again":1,"courseId":202,"program":"BSMATH"}}', file_path: null }); // the faculty member resubmitted
  assert.strictEqual((await listed(call, 1)).awaitingAiCheck, true);
  assert.strictEqual((await call(vpaa, 'PUT', '/syllabi/1', { status: 'approved' })).status, 409);
  adminRun(db, 1, 11);
  assert.strictEqual((await listed(call, 1)).awaitingAiCheck, false);
  assert.strictEqual((await call(vpaa, 'PUT', '/syllabi/1', { status: 'approved' })).body.code, 'STAGES_PENDING'); // the three checks start again on a new version
  clearAll(db, 1, 11);
  assert.strictEqual((await call(vpaa, 'PUT', '/syllabi/1', { status: 'approved' })).status, 200);
}));

test('a submission without structured content cannot be approved', () => withServer(async ({ call, db }) => {
  assert.strictEqual((await listed(call, 2)).awaitingAiCheck, false);
  clearAll(db, 2, 20);
  const r = await call(vpaa, 'PUT', '/syllabi/2', { status: 'approved' });
  assert.strictEqual(r.status, 409);
  assert.strictEqual(r.body.code, 'alignment_required');
}));

test('missing compliance tables cannot be used to bypass the mandatory approval gate', t => withServer({ installed: false }, async ({ call, db }) => {
  clearAll(db, 1, 10);
  t.mock.method(svc, 'requireHybrid', require('../lib/syllabuscheck/legacy-storage-test-helper').realRequireHybrid);
  assert.strictEqual((await listed(call, 1)).awaitingAiCheck, false);
  assert.strictEqual((await call(vpaa, 'PUT', '/syllabi/1', { status: 'approved' })).status, 503);
}));

test('without the review chain tables nothing can be approved, and a reviewer list shows no stage', () => withServer(async ({ call, db }) => {
  db.s.chain = false;
  adminRun(db, 1, 10);
  const r = await call(vpaa, 'PUT', '/syllabi/1', { status: 'approved' });
  assert.strictEqual(r.status, 503);
  assert.match(r.body.error, /review chain is not set up/);
  assert.ok(!('stages' in (await listed(call, 1))));
}));

test('the dean, the Asst. VPAA and the LIC Director may send a syllabus back for revision but not approve or reject it; they see the chain, the owner only its progress', () => withServer(async ({ call, db }) => {
  adminRun(db, 1, 10);
  db.s.stages.push({ syllabus_id: 1, version_id: 10, stage: 'dean' });
  for (const role of ['admin', 'asst_vpaa', 'lic_director']) {
    const who = { id: 20, role, firstName: 'R', lastName: 'R' };
    for (const status of ['approved', 'rejected']) {
      const denied = await call(who, 'PUT', '/syllabi/1', { status, adminComment: 'Not acceptable.' });
      assert.strictEqual(denied.status, 403, role + ' ' + status);
      assert.match(denied.body.error, /Only the VPAA/);
    }
  }
  const row = await listed(call, 1);
  assert.strictEqual(row.stages.dean.cleared, true);
  assert.strictEqual(row.stages.cleared, 1);
  assert.strictEqual(row.readyForApproval, false);
  const mine = (await call(fay, 'GET', '/syllabi')).body.find((x) => x.id === 1);
  assert.deepStrictEqual(mine.reviewProgress, { dean: true, asst_vpaa: false, lic_director: false });
  assert.ok(!('stages' in mine));
  assert.strictEqual((await call({ id: 20, role: 'asst_vpaa', firstName: 'A', lastName: 'V' }, 'PUT', '/syllabi/1', { status: 'for_revision', adminComment: 'Fix the grading.' })).status, 200);
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

// Each reviewer may check a submission with AI or review it without an AI check (lib/reviewAiChoice.js). The choice is theirs and the version's.
const asst = { id: 21, role: 'asst_vpaa', firstName: 'As', lastName: 'St' };
const lic = { id: 22, role: 'lic_director', firstName: 'Li', lastName: 'C' };
const listedAs = async (call, who, id) => (await call(who, 'GET', '/syllabi')).body.find((x) => x.id === id);

test('a reviewer who chooses to review without an AI check may clear their own stage; the choice opens nothing for anyone else', () => withServer(async ({ call, db }) => {
  db.s.aiChoice = true;
  const refused = await call(asst, 'POST', '/syllabi/1/stage-clear', {});
  assert.strictEqual(refused.status, 409); assert.strictEqual(refused.body.code, 'ai_check_or_choice_required'); assert.match(refused.body.error, /Check this syllabus in the AI Checker/);
  const chose = await call(asst, 'POST', '/syllabi/1/review-without-ai', { note: 'Read in full.' });
  assert.strictEqual(chose.status, 200, JSON.stringify(chose.body));
  assert.deepStrictEqual(chose.body, { choice: 'without_ai', versionId: 10, recorded: true });
  assert.strictEqual((await call(asst, 'POST', '/syllabi/1/review-without-ai', {})).body.recorded, false, 'choosing again changes nothing');
  assert.deepStrictEqual(db.s.logNotes, ['Chose to review this version without an AI check: Read in full.'], 'logged once, with the reason');
  const mine = await listedAs(call, asst, 1);
  assert.strictEqual(mine.awaitingAiCheck, false); assert.strictEqual(mine.reviewedWithoutAi, true);
  const theirs = await listedAs(call, admin, 1);
  assert.strictEqual(theirs.awaitingAiCheck, true, 'the dean has not chosen and nobody checked with AI'); assert.ok(!('reviewedWithoutAi' in theirs));
  assert.strictEqual(db.s.syllabi[1].status, 'submitted', 'choosing changes no status');
  assert.strictEqual((await call(asst, 'POST', '/syllabi/1/stage-clear', {})).status, 200);
  assert.strictEqual((await call(admin, 'POST', '/syllabi/1/stage-clear', {})).status, 409, 'the dean still checks with AI or chooses for themselves');
  assert.strictEqual((await call(lic, 'POST', '/syllabi/1/stage-clear', {})).status, 409);
}));

test('the VPAA may also review without an AI check; the chain and the coded approval gates still apply', () => withServer(async ({ call, db }) => {
  db.s.aiChoice = true;
  clearAll(db, 1, 10);
  const before = await call(vpaa, 'PUT', '/syllabi/1', { status: 'approved' });
  assert.strictEqual(before.status, 409); assert.strictEqual(before.body.code, 'ai_check_or_choice_required');
  assert.strictEqual((await call(vpaa, 'POST', '/syllabi/1/review-without-ai', {})).status, 200);
  assert.strictEqual((await listedAs(call, vpaa, 1)).awaitingAiCheck, false);
  assert.strictEqual((await call(vpaa, 'PUT', '/syllabi/1', { status: 'approved' })).status, 200);
  assert.strictEqual(db.s.syllabi[1].status, 'approved');
}));

test('choosing does not skip the chain, and a new version asks again', () => withServer(async ({ call, db }) => {
  db.s.aiChoice = true;
  const early = await call(vpaa, 'POST', '/syllabi/1/review-without-ai', {});
  assert.strictEqual(early.status, 409); assert.strictEqual(early.body.code, 'STAGES_PENDING', 'the VPAA chooses once the dean, the Asst. VPAA and the LIC Director have cleared it');
  assert.strictEqual(db.s.choices.length, 0);
  clearAll(db, 1, 10);
  assert.strictEqual((await call(vpaa, 'POST', '/syllabi/1/review-without-ai', {})).status, 200);
  db.s.versions.push({ version_id: 11, syllabus_id: 1, content: '{"meta":{"again":1,"courseId":202,"program":"BSMATH"}}', file_path: null }); // resubmitted
  assert.strictEqual(await listedAs(call, vpaa, 1), undefined, 'a new version leaves the VPAA until the three clear it');
  assert.strictEqual((await listedAs(call, asst, 1)).awaitingAiCheck, true, 'and every reviewer is asked again');
  clearAll(db, 1, 11);
  assert.strictEqual((await call(vpaa, 'PUT', '/syllabi/1', { status: 'approved' })).body.code, 'ai_check_or_choice_required');
}));

test('choosing is refused for faculty, for a syllabus not waiting for review, when the institution requires the AI check, and before the migration', () => withServer(async ({ call, db }) => {
  db.s.aiChoice = true;
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/review-without-ai', {})).status, 403);
  db.s.syllabi[1].status = 'approved';
  assert.strictEqual((await call(asst, 'POST', '/syllabi/1/review-without-ai', {})).status, 409);
  db.s.syllabi[1].status = 'submitted';
  const before = process.env.SYLLABUS_CHECK_AI_GATE;
  process.env.SYLLABUS_CHECK_AI_GATE = 'required';
  try {
    const r = await call(asst, 'POST', '/syllabi/1/review-without-ai', {});
    assert.strictEqual(r.status, 409); assert.strictEqual(r.body.code, 'ai_check_required');
  } finally { if (before === undefined) delete process.env.SYLLABUS_CHECK_AI_GATE; else process.env.SYLLABUS_CHECK_AI_GATE = before; }
  assert.strictEqual(db.s.choices.length, 0, 'nothing was recorded by a refused request');
  db.s.aiChoice = false; reviewAiChoice.resetInstalledCache();
  const early = await call(asst, 'POST', '/syllabi/1/review-without-ai', {});
  assert.strictEqual(early.status, 503); assert.match(early.body.error, /migrate-review-ai-choice/);
}));

// The VPAA's work starts when the chain is done (lib/reviewStages.js readyForApprover): before that a syllabus is not in the VPAA's lists and cannot be decided.
test('a submission reaches the VPAA only when the dean, the Asst. VPAA and the LIC Director have all cleared its newest version', () => withServer(async ({ call, db }) => {
  assert.strictEqual(await listedAs(call, vpaa, 1), undefined, 'just submitted: not the VPAA\'s yet');
  assert.ok(await listedAs(call, admin, 1), 'the dean sees it');
  assert.ok(await listedAs(call, asst, 1), 'the Asst. VPAA sees it');
  db.s.stages.push({ syllabus_id: 1, version_id: 10, stage: 'dean' }, { syllabus_id: 1, version_id: 10, stage: 'asst_vpaa' });
  assert.strictEqual(await listedAs(call, vpaa, 1), undefined, 'two of three is not enough');
  db.s.stages.push({ syllabus_id: 1, version_id: 10, stage: 'lic_director' });
  const ready = await listedAs(call, vpaa, 1);
  assert.ok(ready, 'all three cleared: it reaches the VPAA'); assert.strictEqual(ready.readyForApproval, true);
  db.s.versions.push({ version_id: 11, syllabus_id: 1, content: '{"meta":{"again":1,"courseId":202,"program":"BSMATH"}}', file_path: null });
  assert.strictEqual(await listedAs(call, vpaa, 1), undefined, 'resubmitted: it leaves the VPAA until the three clear the new version');
  db.s.syllabi[2].status = 'approved';
  assert.ok(await listedAs(call, vpaa, 2), 'an approved syllabus stays visible to the VPAA');
}));

test('the VPAA cannot return or reject a syllabus that has not reached them; the AI check is still asked first', () => withServer(async ({ call, db }) => {
  const unchecked = await call(vpaa, 'PUT', '/syllabi/1', { status: 'for_revision', adminComment: 'Fix the grading.' });
  assert.strictEqual(unchecked.status, 409); assert.match(unchecked.body.error, /Check this syllabus in the AI Checker/, 'the order of the gates is unchanged');
  adminRun(db, 1, 10);
  for (const [status, extra] of [['for_revision', { adminComment: 'Fix the grading.' }], ['rejected', { adminComment: 'Not acceptable.' }]]) {
    const r = await call(vpaa, 'PUT', '/syllabi/1', { status, ...extra });
    assert.strictEqual(r.status, 409, status); assert.strictEqual(r.body.code, 'STAGES_PENDING');
  }
  assert.strictEqual(db.s.syllabi[1].status, 'submitted');
  assert.strictEqual((await call(admin, 'PUT', '/syllabi/1', { status: 'for_revision', adminComment: 'Fix the grading.' })).status, 200, 'the dean may still return it');
}));

test('once the chain is done the VPAA returns or rejects as before', () => withServer(async ({ call, db }) => {
  adminRun(db, 1, 10);
  clearAll(db, 1, 10);
  assert.strictEqual((await call(vpaa, 'PUT', '/syllabi/1', { status: 'for_revision', adminComment: 'Fix the grading.' })).status, 200);
  assert.strictEqual(db.s.syllabi[1].status, 'for_revision');
  assert.ok(await listedAs(call, vpaa, 1), 'what the VPAA returned stays in the VPAA\'s list until it is resubmitted');
}));

// The VPAA's final decision reaches the whole chain, not only the VPAA's own screen: the faculty member who submitted it (their own notice), every administrator
// (the dean), the Asst. VPAA, the LIC Director and any other VPAA account. The VPAA who decided is not notified of their own decision.
test('when the VPAA approves, the faculty member, the dean, the Asst. VPAA and the LIC Director are all notified', () => withServer(async ({ call, db }) => {
  adminRun(db, 1, 10); clearAll(db, 1, 10);
  db.s.notified = [];
  assert.strictEqual((await call(vpaa, 'PUT', '/syllabi/1', { status: 'approved' })).status, 200);
  const to = (id) => db.s.notified.filter((n) => n.userId === id);
  assert.deepStrictEqual(to(5).map((n) => [n.type, n.title]), [['status', 'Syllabus approved: FM 202']], 'the faculty member: once, opening their comments');
  for (const id of [1, 2, 3, 4, 11]) {
    assert.strictEqual(to(id).length, 1, 'user ' + id);
    assert.deepStrictEqual([to(id)[0].type, to(id)[0].title, to(id)[0].syllabusId], ['approval', 'Syllabus approved: FM 202', 1], 'user ' + id);
    assert.strictEqual(to(id)[0].body, 'Approved by the VPAA (Vee Paa). It is now in the Repository.', 'user ' + id);
  }
  assert.strictEqual(to(9).length, 0, 'not the VPAA who approved it');
  assert.strictEqual(db.s.notified.length, 6);
}));

test('a VPAA rejection reaches the chain with its reason; a return for revision by a reviewer still tells only the owner', () => withServer(async ({ call, db }) => {
  adminRun(db, 1, 10); clearAll(db, 1, 10);
  db.s.notified = [];
  assert.strictEqual((await call(vpaa, 'PUT', '/syllabi/1', { status: 'rejected', adminComment: 'Not acceptable.' })).status, 200);
  assert.deepStrictEqual(db.s.notified.map((n) => n.userId).sort((a, b) => a - b), [1, 2, 3, 4, 5, 11]);
  assert.ok(db.s.notified.filter((n) => n.userId !== 5).every((n) => n.type === 'status' && n.title === 'Syllabus rejected: FM 202' && n.body === 'Rejected by the VPAA (Vee Paa). Reason: Not acceptable.'));
  db.s.notified = [];
  db.s.syllabi[2].status = 'submitted'; db.s.versions[1].content = '{}'; adminRun(db, 2, 20);
  assert.strictEqual((await call(admin, 'PUT', '/syllabi/2', { status: 'for_revision', adminComment: 'Fix the grading.' })).status, 200);
  assert.deepStrictEqual(db.s.notified.map((n) => n.userId), [5], 'a return for revision is not a final decision');
}));

// The decision email (lib/decisionEmail.js): the faculty member is emailed about the VPAA's approval while "Email notifications" is on in Settings, and not
// while it is off; the in-app notification is sent either way. A fake mail transport: no real email is sent.
test('the faculty member is emailed about a decision while Email notifications is on, and not while it is off', async () => {
  const mailer = require('../lib/mailer');
  const decisionEmail = require('../lib/decisionEmail');
  const saved = { SMTP_HOST: process.env.SMTP_HOST, MAIL_FROM: process.env.MAIL_FROM };
  const sent = [];
  process.env.SMTP_HOST = 'smtp.test.invalid'; process.env.MAIL_FROM = 'noreply@x.ph';
  mailer.setTransport({ sendMail: async (m) => { sent.push(m); } });
  try {
    for (const on of [true, false]) {
      await withServer(async ({ call, db }) => {
        db.s.emailOn = on;
        adminRun(db, 1, 10); clearAll(db, 1, 10);
        assert.strictEqual((await call(vpaa, 'PUT', '/syllabi/1', { status: 'approved' })).status, 200);
        await decisionEmail.settled();
        assert.ok(db.s.notified.some((n) => n.userId === 5 && n.title === 'Syllabus approved: FM 202'), 'the in-app notice either way');
      });
      assert.strictEqual(sent.length, 1, on ? 'on: one email' : 'off: still only the one from before');
    }
    assert.strictEqual(sent[0].to, 'fay@x.ph');
    assert.strictEqual(sent[0].subject, 'Your syllabus was approved: FM 202');
    assert.match(sent[0].text, /approved by the VPAA \(Vee Paa\)/);
  } finally {
    mailer.setTransport(null);
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

// The dean's own syllabus (lib/reviewStages.js hiddenFromReviewers): checked in the AI Checker it is Under Review, but it reaches the Asst. VPAA, the
// LIC Director and the VPAA only when the dean sends it for review, which clears the dean stage on its newest version. Until then they do not see it and
// can neither clear a stage on it, choose to review it without AI, nor decide it. A faculty member's syllabus is not affected.
test('the dean\'s own syllabus reaches the other reviewers only once the dean sends it for review', () => withServer(async ({ call, db }) => {
  const asst = { id: 3, role: 'asst_vpaa', firstName: 'Ash', lastName: 'V' };
  db.s.syllabi[4] = { syllabus_id: 4, user_id: 1, status: 'under_review', version: 'v1.0', title: 'Dean own', course_code: 'DN 101' };
  db.s.versions.push({ version_id: 40, syllabus_id: 4, content: '{"meta":{}}', file_path: null });
  db.s.aiChoice = true;
  const ids = async (who) => (await call(who, 'GET', '/syllabi')).body.map((x) => x.id);
  assert.ok(!(await ids(asst)).includes(4), 'not in the Asst. VPAA\'s list before it is sent');
  assert.ok((await ids(asst)).includes(1), 'a faculty member\'s syllabus is');
  assert.ok((await ids(admin)).includes(4), 'the dean, its author, still sees it');
  for (const [method, path, body] of [['POST', '/syllabi/4/stage-clear', {}], ['POST', '/syllabi/4/review-without-ai', {}], ['PUT', '/syllabi/4', { status: 'for_revision', adminComment: 'Not yet.' }]]) {
    const r = await call(asst, method, path, body);
    assert.strictEqual(r.status, 409, method + ' ' + path);
    assert.strictEqual(r.body.code, 'not_sent_for_review', method + ' ' + path);
  }
  assert.ok(!db.s.stages.some((r) => r.syllabus_id === 4), 'nothing was cleared');
  // the dean sends it for review: the dean stage is cleared on its newest version (routes/syllabusContent.js publish)
  db.s.stages.push({ syllabus_id: 4, version_id: 40, stage: 'dean' });
  assert.ok((await ids(asst)).includes(4), 'now it reaches the Asst. VPAA');
  assert.strictEqual((await call(asst, 'POST', '/syllabi/4/review-without-ai', {})).status, 200, 'and they may review it');
  assert.strictEqual((await call(asst, 'POST', '/syllabi/4/stage-clear', {})).status, 200, 'and clear their stage');
  assert.ok(db.s.stages.some((r) => r.syllabus_id === 4 && r.stage === 'asst_vpaa'));
}));
