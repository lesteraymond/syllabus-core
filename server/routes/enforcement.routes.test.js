// HTTP-level tests that a faculty member can only use courses an admin assigned to them: the filtered course and
// program lists, the builder's draft/save/submit routes and the legacy create/edit routes. Same approach as
// assignments.routes.test.js: in-memory fake database, session user taken from the x-test-user header.
// The fake does not run SQL, so it checks the wiring (which queries and parameters the routes use), not MySQL itself.
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const compliance = require('../lib/compliance/service');
const reviewStages = require('../lib/reviewStages');
const F = require('../lib/compliance/fixtures');

const normalizeSql = sql => String(sql).replace(/\s+/g, ' ').trim();
const MISSING_PO_REFERENCE_SQL = new Set([
  'SELECT p.program_id, p.code, p.name, p.egas_version, p.pos_version FROM program_outcome_sources s JOIN programs p ON p.program_id = s.source_program_id WHERE s.program_id = ?',
  'SELECT p.program_id AS id, p.code, p.name FROM program_outcome_sources s JOIN programs p ON p.program_id = s.program_id WHERE s.source_program_id = ? ORDER BY p.code',
  'SELECT r.reference_id, r.version_label, r.source_file, r.source_sha256, r.outcomes_json FROM program_po_reference_active a JOIN program_po_reference_versions r ON r.reference_id = a.reference_id WHERE a.program_id = ?',
  "SELECT migration_id, details_json FROM program_po_reference_remediation WHERE entity_type='syllabus' AND entity_id=? AND status='needs_review'",
].map(normalizeSql));
const PO_REFERENCE_TABLE = /\b(?:program_outcome_sources|program_po_reference_(?:active|versions|remediation))\b/i;

const COURSES = [
  { course_id: 10, code: 'IT 101', title: 'Intro', program_id: 1, program_code: 'BSIT', program_name: 'BSIT' },
  { course_id: 11, code: 'IT 204', title: 'Programming 2', program_id: 1, program_code: 'BSIT', program_name: 'BSIT' },
  { course_id: 20, code: 'IE 101', title: 'Work Study', program_id: 2, program_code: 'BSIE', program_name: 'BSIE' },
];
const PROGRAMS = [{ program_id: 1, code: 'BSIT', name: 'BS IT', outcome_count: 10 }, { program_id: 2, code: 'BSIE', name: 'BS IE', outcome_count: 0 }];
const USERS = new Set([1, 5, 6, 9]);

function makeDb({ assigned = {}, syllabi = {}, beforeDelete, complianceInstalled = false, syllabusVersions = [], adminRuns = [], masterData = null, stages = [], chainInstalled = true } = {}) {
  // assigned: userId -> { programs: [], courses: [] }
  const queries = [];
  const writes = [];
  const egaCopies = []; // program ids that received a copy of the school-wide EGAs
  const mine = (uid) => assigned[uid] || { programs: [], courses: [] };
  const handle = (sql, params = []) => {
    queries.push(sql);
    if (/^(INSERT|UPDATE|DELETE)\b/i.test(sql)) writes.push({ sql, params: [...params] });
    if (normalizeSql(sql) === 'SELECT 1 FROM ai_check_runs LIMIT 1') {
      if (!complianceInstalled) throw Object.assign(new Error("Table 'ai_check_runs' doesn't exist"), { code: 'ER_NO_SUCH_TABLE' });
      return [[{ 1: 1 }]];
    }
    if (sql.startsWith('SELECT v.syllabus_id, v.version_id, (v.content IS NOT NULL')) {
      const ids = params[0] || [];
      return [syllabusVersions.filter(v => ids.includes(v.syllabus_id)).map(v => ({ syllabus_id: v.syllabus_id, version_id: v.version_id, checkable: v.content || v.file_path ? 1 : 0 }))];
    }
    if (sql.startsWith('SELECT DISTINCT syllabus_id, version_id FROM ai_check_runs')) {
      const ids = params[0] || [];
      return [adminRuns.filter(r => ids.includes(r.syllabus_id) && r.version_id !== null && r.created_by !== null && r.created_by !== syllabi[r.syllabus_id]?.user_id)
        .map(r => ({ syllabus_id: r.syllabus_id, version_id: r.version_id }))];
    }
    if (sql.startsWith('SELECT version_id, version_label, content FROM syllabus_versions')) {
      return [syllabusVersions.filter(v => v.syllabus_id === params[0]).slice().sort((a, b) => a.version_id - b.version_id).slice(-1)];
    }
    if (masterData && sql.startsWith('SELECT vision, mission_lead, mission_items, version FROM institution_settings')) {
      return [[{ vision: masterData.institution.vision, mission_lead: masterData.institution.mission.lead, mission_items: JSON.stringify(masterData.institution.mission.items), version: 1 }]];
    }
    if (masterData && sql.startsWith('SELECT ega_no, name, short_name FROM institution_egas ORDER BY ega_no')) {
      return [masterData.institution.egas.map(e => ({ ega_no: e.no, name: e.name, short_name: e.short }))];
    }
    if (masterData && sql.startsWith('SELECT program_id, code, name, egas_version, pos_version FROM programs WHERE code = ?')) {
      const p = masterData.program;
      return [p.code === params[0] ? [{ program_id: p.program_id, code: p.code, name: p.name, egas_version: 1, pos_version: 1 }] : []];
    }
    if (masterData && sql.startsWith('SELECT po_no, short_name, outcome_text, ega_nos FROM program_outcomes WHERE program_id = ?')) {
      return [masterData.program.pos.map(o => ({ po_no: o.no, short_name: o.short, outcome_text: o.text, ega_nos: o.egas.join(',') }))];
    }
    if (masterData && sql.startsWith('SELECT ega_no, name, short_name FROM program_egas WHERE program_id = ?')) {
      return [masterData.program.egas.map(e => ({ ega_no: e.no, name: e.name, short_name: e.short }))];
    }
    if (masterData && sql.startsWith("SELECT reference_id, program_code, curriculum_year, source, courses_json FROM syllabus_check_curricula WHERE status = 'approved' ORDER BY reference_id")) {
      return [masterData.curricula];
    }
    if (sql.startsWith('SELECT syllabus_id, user_id, status FROM syllabi WHERE') && !sql.includes('WHERE course_id')) return [syllabi[params[0]] ? [{ ...syllabi[params[0]] }] : []];
    if (sql.startsWith('DELETE FROM syllabi WHERE syllabus_id')) {
      beforeDelete?.(syllabi);
      const target = syllabi[params[0]];
      const allowed = target && (!sql.includes('AND status') || (target.user_id === params[1] && target.status === 'draft'));
      if (allowed) delete syllabi[params[0]];
      return [{ affectedRows: allowed ? 1 : 0 }];
    }
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [USERS.has(params[0]) ? [{ user_id: params[0] }] : []];
    if (sql.startsWith('SELECT program_id FROM faculty_programs')) return [mine(params[0]).programs.map((program_id) => ({ program_id }))];
    if (sql.startsWith('SELECT course_id FROM faculty_courses')) return [mine(params[0]).courses.map((course_id) => ({ course_id }))];
    if (sql.startsWith('SELECT 1 FROM faculty_courses fc JOIN courses c')) {
      const [uid, code] = params;
      return [COURSES.filter((c) => mine(uid).courses.includes(c.course_id) && c.code.toLowerCase() === String(code).toLowerCase()).map(() => ({ 1: 1 }))];
    }
    if (sql.startsWith('SELECT c.course_id, c.code, c.title, c.program_id, p.code AS program_code, COUNT')) {
      const filtered = sql.includes('faculty_courses');
      const uid = params[params.length - 1];
      return [COURSES.filter((c) => !filtered || mine(uid).courses.includes(c.course_id)).map((c) => ({ ...c, clo_count: 0 }))];
    }
    // what an admin's list needs to say what is still missing for each subject
    if (sql.startsWith('SELECT vision')) return [[{ vision: 'V', mission_lead: 'Lead', mission_items: JSON.stringify(['m1']), version: 1 }]];
    if (sql.startsWith('SELECT ega_no, name, short_name FROM institution_egas')) return [[{ ega_no: 1, name: 'E', short_name: 'E' }]];
    if (sql.startsWith('SELECT program_id, COUNT(*) AS n FROM program_egas')) return [[{ program_id: 1, n: 4 }]];
    if (sql.startsWith('SELECT program_id, COUNT(*) AS n FROM program_outcomes')) return [[{ program_id: 1, n: 10 }]];
    if (sql.startsWith('SELECT p.program_id, p.code, p.name, COUNT')) {
      const filtered = sql.includes('faculty_programs');
      return [PROGRAMS.filter((p) => !filtered || mine(params[0]).programs.includes(p.program_id))];
    }
    if (sql.startsWith('SELECT program_id FROM programs WHERE code')) { const p = PROGRAMS.find((x) => x.code === params[0]); return [p ? [{ program_id: p.program_id }] : []]; }
    if (sql.startsWith('SELECT 1 FROM courses WHERE code')) return [COURSES.filter((c) => c.code === params[0] && (!sql.includes('course_id <>') || c.course_id !== params[1]) && c.program_id === params[sql.includes('course_id <>') ? 2 : 1]).map(() => ({ 1: 1 }))];
    if (sql.startsWith('SELECT program_id FROM program_code_aliases')) return [[]]; // these fixtures have no historical codes
    // one syllabus for each subject (lib/subjectLock.js): the subject a code names, and the syllabi already on a subject
    if (sql.startsWith('SELECT course_id FROM courses WHERE code')) return [COURSES.filter((c) => c.code.toLowerCase() === String(params[0]).toLowerCase()).map((c) => ({ course_id: c.course_id }))];
    if (sql.startsWith('SELECT syllabus_id, user_id, status FROM syllabi WHERE course_id')) return [Object.values(syllabi).filter((r) => r.course_id === params[0] && r.syllabus_id !== params[1] && r.user_id === params[2]).map((r) => ({ syllabus_id: r.syllabus_id, user_id: r.user_id, status: r.status }))];
    if (sql.startsWith('SELECT code, name FROM programs')) return [PROGRAMS.map((p) => ({ code: p.code, name: p.name }))];
    if (sql.startsWith('INSERT INTO programs')) {
      const [code, name] = params;
      if (code === 'RACE') throw Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' });
      const program_id = 50 + PROGRAMS.length;
      PROGRAMS.push({ program_id, code, name, outcome_count: 0 });
      return [{ insertId: program_id }];
    }
    if (sql.startsWith('INSERT INTO program_egas')) { egaCopies.push(params[0]); return [{}]; }
    if (sql.startsWith('INSERT INTO courses')) {
      const [code, title, programId] = params;
      if (code === 'BOOM') throw new Error('disk full'); // lets a test fail the subject insert after the program was created
      const prog = PROGRAMS.find((x) => x.program_id === programId);
      const course_id = 99 + COURSES.length;
      COURSES.push({ course_id, code, title, program_id: programId, program_code: prog.code, program_name: prog.name });
      return [{ insertId: course_id }];
    }
    if (sql.startsWith('SELECT c.course_id, c.code, c.title, c.clos_version, p.program_id')) return [COURSES.filter((c) => c.course_id === params[0])];
    if (sql.startsWith('SELECT clo_id')) return [[]];
    if (sql.startsWith('SELECT syllabus_id, user_id, status, version, content')) return [syllabi[params[0]] ? [syllabi[params[0]]] : []];
    if (sql.startsWith('SELECT syllabus_id, user_id, status, title, course_code, content, course_id') || sql.startsWith('SELECT * FROM syllabi WHERE syllabus_id')) return [syllabi[params[0]] ? [syllabi[params[0]]] : []];
    // the review chain (lib/reviewStages.js): the stage table, the newest version of each syllabus, and the stages cleared
    if (sql.startsWith('SELECT 1 FROM syllabus_review_stages')) { if (!chainInstalled) throw Object.assign(new Error("Table 'syllabus_review_stages' doesn't exist"), { code: 'ER_NO_SUCH_TABLE' }); return [[]]; }
    if (sql.startsWith('SELECT syllabus_id, MAX(version_id) AS version_id FROM syllabus_versions')) return [(params[0] || []).map(id => syllabusVersions.filter(v => v.syllabus_id === id).slice(-1)[0]).filter(Boolean).map(v => ({ syllabus_id: v.syllabus_id, version_id: v.version_id }))];
    if (sql.startsWith('SELECT s.syllabus_id, s.version_id, s.stage')) return [stages.filter(r => (params[0] || []).includes(r.syllabus_id)).map(r => ({ reviewer_id: 1, note: '', cleared_at: null, first_name: 'Rev', last_name: 'Iewer', ...r }))];
    if (sql.startsWith("SELECT user_id FROM users WHERE role = 'admin'")) return [[]];
    if (PO_REFERENCE_TABLE.test(sql)) {
      if (MISSING_PO_REFERENCE_SQL.has(normalizeSql(sql))) throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' });
      throw new Error('unexpected query: ' + sql);
    }
    if (sql.startsWith('INSERT')) return [{ insertId: 100 }];
    if (sql.startsWith('UPDATE syllabi SET status = ?')) {
      const record = syllabi[params[params.length - 1]];
      if (record) record.status = params[0];
      return [{ affectedRows: record ? 1 : 0 }];
    }
    if (sql.startsWith('UPDATE')) return [{}];
    if (/FROM course_prerequisites/.test(sql)) return [[]]; // a subject's prerequisites: none set
    throw new Error('unexpected query: ' + sql);
  };
  // A transaction that really rolls back: what was added since beginTransaction is removed again.
  let snap = null;
  const conn = {
    query: async (s, p) => handle(s, p),
    beginTransaction: async () => { snap = { programs: PROGRAMS.length, courses: COURSES.length, copies: egaCopies.length }; },
    commit: async () => { snap = null; },
    rollback: async () => { if (snap) { PROGRAMS.length = snap.programs; COURSES.length = snap.courses; egaCopies.length = snap.copies; snap = null; } },
    release: () => {},
  };
  return { queries, writes, egaCopies, query: async (s, p) => handle(s, p), getConnection: async () => conn };
}

async function withServer(opts, fn) {
  const db = makeDb(opts);
  compliance.resetInstalledCache();
  reviewStages.resetInstalledCache();
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { const h = req.headers['x-test-user']; req.session = h ? { user: JSON.parse(h) } : {}; next(); });
  app.locals.db = db;
  app.use('/api/courses', require('./courses'));
  app.use('/api/programs', require('./programs'));
  app.use('/api/syllabi', require('./syllabi'));
  app.use('/api/syllabi', require('./syllabusContent'));
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (as, method, path, body) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(as ? { 'x-test-user': JSON.stringify(as) } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  try { await fn({ db, call }); } finally { await new Promise((r) => server.close(r)); compliance.resetInstalledCache(); }
}

const admin = { id: 1, role: 'admin', firstName: 'Ada', lastName: 'Admin' };
const fay = { id: 5, role: 'faculty', firstName: 'Fay', lastName: 'Faculty' };
const vpaa = { id: 9, role: 'vpaa', firstName: 'Vee', lastName: 'Paa' };
const allStages = (syllabusId, versionId) => ['dean', 'asst_vpaa', 'lic_director'].map(stage => ({ syllabus_id: syllabusId, version_id: versionId, stage }));
const gus = { id: 6, role: 'faculty', firstName: 'Gus', lastName: 'Faculty' };
const row = (over) => ({ syllabus_id: 1, user_id: 5, status: 'draft', version: 'v1.0', title: '', course_code: '', course_id: null, content: null, content_schema_version: null, content_updated_at: null, curriculum_id: null, file_path: null, ...over });
const meta = (courseId) => ({ sections: { meta: { courseId, code: 'X', title: 'Y' } } });
const ASSIGNED = { 5: { programs: [1], courses: [10] } };

function validApprovalFixture() {
  const content = F.good();
  content.meta.courseId = 11;
  content.meta.yearLevel = '2';
  const catalog = F.catalog();
  const syllabusId = 44, versionId = 144, savedContent = JSON.stringify(content);
  return {
    syllabus: row({ syllabus_id: syllabusId, user_id: 5, status: 'submitted', version: 'v1.0', title: content.meta.title, course_code: content.meta.code, course_id: 11, content: savedContent }),
    syllabusVersions: [{ syllabus_id: syllabusId, version_id: versionId, version_label: 'v1.0', content: savedContent, file_path: null }],
    adminRuns: [{ syllabus_id: syllabusId, version_id: versionId, created_by: 1 }],
    masterData: {
      institution: { ...catalog.institution, egas: catalog.program.egas },
      program: { ...catalog.program, program_id: 1, code: 'BSIT', name: 'BS IT' },
      curricula: [{ reference_id: 1, program_code: 'BSIT', curriculum_year: 'test-2026', source: 'fixture', courses_json: JSON.stringify([{ code: 'IT 204', title: content.meta.title, prereq: content.meta.prereq, lecture: 2, lab: 1, yearLevel: 2 }]) }],
    },
  };
}

test('the fake DB reports only the four exact unavailable PO-reference queries as missing tables', async () => {
  const db = makeDb();
  for (const sql of MISSING_PO_REFERENCE_SQL) {
    await assert.rejects(db.query(sql), error => error.code === 'ER_NO_SUCH_TABLE');
  }
  const malformed = [...MISSING_PO_REFERENCE_SQL][0] + ' /* unexpected clause */';
  await assert.rejects(db.query(malformed), /unexpected query:/);
  await assert.rejects(db.query('UPDATE program_outcome_sources SET source_program_id = ?'), /unexpected query:/);
});

test('faculty see only their assigned courses and programs; admins see all', () => withServer({ assigned: ASSIGNED }, async ({ call }) => {
  assert.deepStrictEqual((await call(fay, 'GET', '/courses')).body.map((c) => c.code), ['IT 101']);
  assert.deepStrictEqual((await call(fay, 'GET', '/courses?program=BSIT')).body.map((c) => c.code), ['IT 101']);
  assert.deepStrictEqual((await call(fay, 'GET', '/programs')).body.map((p) => p.code), ['BSIT']);
  assert.strictEqual((await call(admin, 'GET', '/courses')).body.length, 3);
  assert.strictEqual((await call(admin, 'GET', '/programs')).body.length, 2);
}));

test('a faculty member with nothing assigned gets empty lists', () => withServer({ assigned: ASSIGNED }, async ({ call }) => {
  assert.deepStrictEqual((await call(gus, 'GET', '/courses')).body, []);
  assert.deepStrictEqual((await call(gus, 'GET', '/programs')).body, []);
}));

test('faculty can delete their own draft, but no submitted or decided syllabus', async () => {
  const statuses = ['draft', 'submitted', 'under_review', 'for_revision', 'approved', 'rejected'];
  const syllabi = Object.fromEntries(statuses.map((status, index) => [index + 1, { syllabus_id: index + 1, user_id: 5, status }]));
  await withServer({ syllabi }, async ({ call, db }) => {
    for (let id = 2; id <= statuses.length; id++) {
      const result = await call(fay, 'DELETE', '/syllabi/' + id);
      assert.strictEqual(result.status, 409, statuses[id - 1]);
      assert.match(result.body.error, /Only draft syllabi/);
      assert.ok(syllabi[id]);
    }
    assert.ok(!db.queries.some(sql => sql.startsWith('DELETE FROM syllabi')));
    assert.strictEqual((await call(gus, 'DELETE', '/syllabi/1')).status, 404);
    assert.strictEqual((await call(null, 'DELETE', '/syllabi/1')).status, 401);
    assert.strictEqual((await call(fay, 'DELETE', '/syllabi/1')).status, 200);
    assert.ok(!syllabi[1]);
  });
});

test('a draft submitted while deletion is pending is preserved by the conditional delete', async () => {
  const syllabi = { 1: { syllabus_id: 1, user_id: 5, status: 'draft' } };
  await withServer({ syllabi, beforeDelete: records => { records[1].status = 'submitted'; } }, async ({ call }) => {
    const result = await call(fay, 'DELETE', '/syllabi/1');
    assert.strictEqual(result.status, 409);
    assert.strictEqual(syllabi[1].status, 'submitted');
  });
});

test('administrators retain deletion access to submitted records and their own drafts only', async () => {
  const statuses = ['submitted', 'under_review', 'for_revision', 'approved', 'rejected'];
  const syllabi = Object.fromEntries(statuses.map((status, index) => [index + 1, { syllabus_id: index + 1, user_id: 5, status }]));
  syllabi[10] = { syllabus_id: 10, user_id: 5, status: 'draft' };
  syllabi[11] = { syllabus_id: 11, user_id: 1, status: 'draft' };
  await withServer({ syllabi }, async ({ call }) => {
    assert.strictEqual((await call(admin, 'DELETE', '/syllabi/10')).status, 404);
    for (let id = 1; id <= statuses.length; id++) assert.strictEqual((await call(admin, 'DELETE', '/syllabi/' + id)).status, 200);
    assert.strictEqual((await call(admin, 'DELETE', '/syllabi/11')).status, 200);
    assert.ok(syllabi[10]);
  });
});

test('starting a draft needs at least one assigned course (faculty); admins are never blocked', () => withServer({ assigned: ASSIGNED }, async ({ call }) => {
  assert.strictEqual((await call(fay, 'POST', '/syllabi/drafts')).status, 200);
  const none = await call(gus, 'POST', '/syllabi/drafts');
  assert.strictEqual(none.status, 403);
  assert.match(none.body.error, /No program or subject is assigned/);
  assert.strictEqual((await call(admin, 'POST', '/syllabi/drafts')).status, 200);
}));

test('a program with no subject yet: the draft is refused and the message says a program is assigned', () => withServer({ assigned: { 5: { programs: [1], courses: [] } } }, async ({ call }) => {
  const r = await call(fay, 'POST', '/syllabi/drafts');
  assert.strictEqual(r.status, 403);
  assert.match(r.body.error, /program is assigned to you, but no subject yet/);
  assert.strictEqual((await call(fay, 'POST', '/syllabi', { title: 'X', courseCode: 'IT 101' })).status, 403);
}));

test('saving content for an unassigned course is refused (403), an assigned one is saved', () => withServer({ assigned: ASSIGNED, syllabi: { 1: row() } }, async ({ call }) => {
  const no = await call(fay, 'PUT', '/syllabi/1/content', meta(11));
  assert.strictEqual(no.status, 403);
  assert.match(no.body.error, /subject is not assigned to you/);
  assert.strictEqual((await call(fay, 'PUT', '/syllabi/1/content', meta(20))).status, 403);
  assert.strictEqual((await call(fay, 'PUT', '/syllabi/1/content', meta(10))).status, 200);
}));

test('a syllabus whose course is no longer assigned cannot be saved or submitted, and reads as not editable', () => withServer({ assigned: ASSIGNED, syllabi: { 2: row({ syllabus_id: 2, status: 'for_revision', course_id: 11, content: JSON.stringify({ meta: { courseId: 11 } }) }) } }, async ({ call }) => {
  assert.strictEqual((await call(fay, 'PUT', '/syllabi/2/content', { sections: { description: [] } })).status, 403);
  assert.strictEqual((await call(fay, 'POST', '/syllabi/2/submit', {})).status, 403);
  const get = await call(fay, 'GET', '/syllabi/2/content');
  assert.strictEqual(get.status, 200);
  assert.strictEqual(get.body.editable, false);
  assert.match(get.body.lockedReason, /subject is not assigned to you/);
}));

test('a submitted syllabus is locked: the owner cannot edit it until the administrator returns it for revision', () => withServer({ assigned: ASSIGNED, syllabi: { 6: row({ syllabus_id: 6, status: 'submitted', course_id: 10 }), 7: row({ syllabus_id: 7, status: 'under_review', course_id: 10 }), 8: row({ syllabus_id: 8, status: 'for_revision', course_id: 10 }), 9: row({ syllabus_id: 9, status: 'draft', course_id: 10 }) } }, async ({ call }) => {
  for (const id of [6, 7]) {
    const put = await call(fay, 'PUT', '/syllabi/' + id + '/content', { sections: { description: [] } });
    assert.strictEqual(put.status, 409, 'content ' + id);
    assert.match(put.body.error, /submitted and is locked.*returns it for revision/);
    assert.strictEqual((await call(fay, 'PUT', '/syllabi/' + id, { title: 'New title' })).status, 409, 'legacy edit ' + id);
    assert.strictEqual((await call(fay, 'POST', '/syllabi/' + id + '/submit', {})).status, 409, 'submit again ' + id);
    const get = await call(fay, 'GET', '/syllabi/' + id + '/content');
    assert.strictEqual(get.body.editable, false, 'editable ' + id);
  }
  const back = (await call(fay, 'GET', '/syllabi/8/content')).body; // returned for revision: told what the next version will be
  assert.strictEqual(back.nextVersion, 'v1.1');
  assert.strictEqual(back.reviewerNote, '');
  assert.ok(!('nextVersion' in (await call(fay, 'GET', '/syllabi/6/content')).body));
  for (const id of [8, 9]) { // a draft, or one returned for revision, can be edited
    assert.strictEqual((await call(fay, 'GET', '/syllabi/' + id + '/content')).body.editable, true, 'editable ' + id);
    assert.strictEqual((await call(fay, 'PUT', '/syllabi/' + id + '/content', { sections: { description: [] } })).status, 200, 'content ' + id);
  }
}));

test('an uploaded-file syllabus back from "For revision" is saved again only with a change and a note about it', () => withServer({ assigned: ASSIGNED, syllabi: { 12: row({ syllabus_id: 12, status: 'for_revision', course_code: 'IT 101', title: 'Intro', file_path: '/uploads/a.pdf' }) } }, async ({ call }) => {
  const put = (body) => call(fay, 'PUT', '/syllabi/12', body);
  const none = await put({ note: 'I looked again at the file.' });
  assert.strictEqual(none.status, 409);
  assert.match(none.body.error, /Nothing has changed/);
  assert.strictEqual((await put({ title: 'Intro', courseCode: 'IT 101', note: 'Same values sent again.' })).status, 409);
  assert.strictEqual((await put({ title: 'Intro to IT' })).status, 400); // changed, but no note
  assert.strictEqual((await put({ title: 'Intro to IT', note: 'short' })).status, 400);
  const refused = await put({ title: 'Intro to IT', note: 'Corrected the course title.' });
  assert.strictEqual(refused.status, 409);
  assert.strictEqual(refused.body.code, 'alignment_required');
}));

test('the same syllabus is editable again once the admin assigns the course', () => withServer({ assigned: { 5: { programs: [1], courses: [10, 11] } }, syllabi: { 2: row({ syllabus_id: 2, status: 'for_revision', course_id: 11 }) } }, async ({ call }) => {
  const get = await call(fay, 'GET', '/syllabi/2/content');
  assert.strictEqual(get.body.editable, true);
  assert.strictEqual(get.body.lockedReason, null);
  assert.strictEqual((await call(fay, 'PUT', '/syllabi/2/content', { sections: { description: [] } })).status, 200);
}));

test('submitting a draft for an unassigned course is refused', () => withServer({ assigned: ASSIGNED, syllabi: { 3: row({ syllabus_id: 3, course_id: 11, content: JSON.stringify({ meta: { courseId: 11, code: 'IT 204', title: 'P2' } }) }) } }, async ({ call }) => {
  assert.strictEqual((await call(fay, 'POST', '/syllabi/3/submit', {})).status, 403);
}));

test('another faculty member still gets 404 on someone else\'s syllabus', () => withServer({ assigned: { ...ASSIGNED, 6: { programs: [1], courses: [10] } }, syllabi: { 1: row() } }, async ({ call }) => {
  assert.strictEqual((await call(gus, 'GET', '/syllabi/1/content')).status, 404);
  assert.strictEqual((await call(gus, 'PUT', '/syllabi/1/content', meta(10))).status, 404);
  assert.strictEqual((await call(gus, 'POST', '/syllabi/1/submit', {})).status, 404);
}));

test('legacy create: an assigned course reaches the explicit builder-only gate; unassigned courses are refused', () => withServer({ assigned: ASSIGNED }, async ({ call, db }) => {
  const legacy = await call(fay, 'POST', '/syllabi', { title: 'Intro', courseCode: 'it 101' });
  assert.strictEqual(legacy.status, 409);
  assert.strictEqual(legacy.body.code, 'alignment_required');
  assert.ok(db.queries.some(sql => sql.startsWith('SELECT 1 FROM faculty_courses fc JOIN courses c')));
  assert.strictEqual((await call(fay, 'POST', '/syllabi', { title: 'P2', courseCode: 'IT 204' })).status, 403);
  assert.strictEqual((await call(fay, 'POST', '/syllabi', { title: 'No code', courseCode: '' })).status, 403);
  const none = await call(gus, 'POST', '/syllabi', { title: 'Intro', courseCode: 'IT 101' });
  assert.strictEqual(none.status, 403);
  assert.match(none.body.error, /No program or subject is assigned/);
}));

test('the structured builder rejects assigning a subject that already has this faculty member\'s syllabus', () => withServer({ assigned: ASSIGNED, syllabi: {
  9: row({ syllabus_id: 9, user_id: 5, course_id: 10, status: 'submitted' }),
  13: row({ syllabus_id: 13, user_id: 5, course_id: null, status: 'draft' }),
} }, async ({ call, db }) => {
  const again = await call(fay, 'PUT', '/syllabi/13/content', meta(10));
  assert.strictEqual(again.status, 409);
  assert.strictEqual(again.body.code, 'syllabus_exists');
  assert.strictEqual(again.body.existingId, 9);
  assert.strictEqual(again.body.existingStatus, 'submitted');
  assert.ok(db.queries.some(sql => sql.startsWith('SELECT syllabus_id, user_id, status FROM syllabi WHERE course_id')),
    'the duplicate syllabus query ran before the request was rejected');
  assert.ok(!db.writes.some(write => write.sql.startsWith('UPDATE syllabi SET content =')),
    'the failed assignment was not saved');
}));

test('legacy edits enforce course assignment and the structured alignment gate; faculty cannot approve', () => withServer({ assigned: ASSIGNED, syllabusVersions: [{ syllabus_id: 4, version_id: 40, content: null, file_path: null }], stages: allStages(4, 40), syllabi: { 4: row({ syllabus_id: 4, status: 'for_revision', course_code: 'IT 204' }), 5: row({ syllabus_id: 5, status: 'for_revision', course_code: 'IT 101' }) } }, async ({ call }) => {
  assert.strictEqual((await call(fay, 'PUT', '/syllabi/4', { title: 'New title', note: 'Changed the title.' })).status, 403);
  const assigned = await call(fay, 'PUT', '/syllabi/5', { title: 'New title', note: 'Changed the title.' });
  assert.strictEqual(assigned.status, 409);
  assert.strictEqual(assigned.body.code, 'alignment_required');
  const unauthorized = await call(fay, 'PUT', '/syllabi/5', { status: 'approved' });
  assert.strictEqual(unauthorized.status, 403);
  assert.match(unauthorized.body.error, /Only reviewers can change a syllabus status/);
  assert.strictEqual((await call(admin, 'PUT', '/syllabi/4', { status: 'approved' })).status, 403); // the dean never approves
  const missingForm = await call(vpaa, 'PUT', '/syllabi/4', { status: 'approved' });
  assert.strictEqual(missingForm.status, 409);
  assert.strictEqual(missingForm.body.code, 'alignment_required');
}));

test('the VPAA can approve a checked, cleared structured syllabus after the real deterministic gate passes', async () => {
  const previousGate = process.env.SYLLABUS_CHECK_AI_GATE;
  process.env.SYLLABUS_CHECK_AI_GATE = 'advisory';
  try {
    const fixture = validApprovalFixture();
    const syllabi = { 44: fixture.syllabus };
    await withServer({ assigned: ASSIGNED, syllabi, complianceInstalled: true, syllabusVersions: fixture.syllabusVersions, adminRuns: fixture.adminRuns, masterData: fixture.masterData, stages: allStages(44, 144) }, async ({ call, db }) => {
      const approved = await call(vpaa, 'PUT', '/syllabi/44', { status: 'approved' });
      assert.strictEqual(approved.status, 200, JSON.stringify(approved.body));
      assert.strictEqual(syllabi[44].status, 'approved');
      assert.ok(db.queries.some(sql => sql.startsWith('SELECT 1 FROM ai_check_runs LIMIT 1')));
      assert.ok(db.queries.some(sql => sql.startsWith('SELECT v.syllabus_id, v.version_id, (v.content IS NOT NULL')),
        'approval required the administrator check for the current version');
      assert.ok(db.queries.some(sql => sql.startsWith('SELECT reference_id, program_code, curriculum_year, source, courses_json FROM syllabus_check_curricula')),
        'approval reached the real curriculum-backed hard check');
      assert.ok(db.writes.some(write => write.sql.startsWith('UPDATE syllabi SET status = ?') && write.params[0] === 'approved'));
    });
  } finally {
    if (previousGate === undefined) delete process.env.SYLLABUS_CHECK_AI_GATE;
    else process.env.SYLLABUS_CHECK_AI_GATE = previousGate;
  }
});

test('a VPAA approval is still rejected when the actual curriculum hard gate fails', async () => {
  const previousGate = process.env.SYLLABUS_CHECK_AI_GATE;
  process.env.SYLLABUS_CHECK_AI_GATE = 'advisory';
  try {
    const fixture = validApprovalFixture();
    const invalid = JSON.parse(fixture.syllabus.content);
    invalid.meta.code = 'IT 999';
    fixture.syllabus.content = JSON.stringify(invalid);
    fixture.syllabusVersions[0].content = fixture.syllabus.content;
    const syllabi = { 44: fixture.syllabus };
    await withServer({ assigned: ASSIGNED, syllabi, complianceInstalled: true, syllabusVersions: fixture.syllabusVersions, adminRuns: fixture.adminRuns, masterData: fixture.masterData, stages: allStages(44, 144) }, async ({ call, db }) => {
      const refused = await call(vpaa, 'PUT', '/syllabi/44', { status: 'approved' });
      assert.strictEqual(refused.status, 409);
      assert.strictEqual(refused.body.code, 'syllabus_hard_gate');
      assert.strictEqual(syllabi[44].status, 'submitted');
      assert.ok(!db.writes.some(write => write.sql.startsWith('UPDATE syllabi SET status = ?')));
    });
  } finally {
    if (previousGate === undefined) delete process.env.SYLLABUS_CHECK_AI_GATE;
    else process.env.SYLLABUS_CHECK_AI_GATE = previousGate;
  }
});

test('an admin can add a subject to a program; faculty cannot; duplicates and unknown programs are refused', () => withServer({ assigned: ASSIGNED }, async ({ call }) => {
  const made = await call(admin, 'POST', '/courses', { code: 'IT 301', title: 'Networks', program: 'bsit' });
  assert.strictEqual(made.status, 200);
  assert.strictEqual(made.body.code, 'IT 301');
  assert.strictEqual(made.body.program.code, 'BSIT');
  assert.deepStrictEqual(made.body.clos, []);
  assert.ok((await call(admin, 'GET', '/courses')).body.some((c) => c.code === 'IT 301'));
  assert.strictEqual((await call(fay, 'POST', '/courses', { code: 'IT 302', title: 'X', program: 'BSIT' })).status, 403);
  const dup = await call(admin, 'POST', '/courses', { code: 'IT 101', title: 'Again', program: 'BSIT' });
  assert.strictEqual(dup.status, 409);
  assert.match(dup.body.error, /already exists/);
  // The same code in another program is a different subject, not a duplicate.
  const other = await call(admin, 'POST', '/courses', { code: 'IT 101', title: 'Introduction to Industrial Engineering', program: 'BSIE' });
  assert.strictEqual(other.status, 200);
  assert.strictEqual(other.body.program.code, 'BSIE');
  assert.strictEqual((await call(admin, 'POST', '/courses', { code: 'ZZ 1', title: 'X', program: 'NOPE' })).status, 400);
  const empty = await call(admin, 'POST', '/courses', { code: '', title: 'X', program: 'BSIT' });
  assert.strictEqual(empty.status, 400);
  assert.match(empty.body.error, /Subject code is required/);
}));

const addSubject = (call, body) => call(admin, 'POST', '/courses', body);

test('a typed existing program code works as before, in any letter case, and its name is ignored', () => withServer({ assigned: ASSIGNED }, async ({ call, db }) => {
  const before = PROGRAMS.length;
  const r = await addSubject(call, { code: 'IT 410', title: 'Capstone', program: ' bsit ', programName: 'Something else' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.program.code, 'BSIT');
  assert.strictEqual(r.body.programCreated, false);
  assert.strictEqual(PROGRAMS.length, before);
  assert.strictEqual(db.egaCopies.length, 0);
}));

test('a new program code with a full name is created together with its first subject and requires explicit EGA setup', () => withServer({ assigned: ASSIGNED }, async ({ call, db }) => {
  const r = await addSubject(call, { code: 'CE 101', title: 'Statics', program: 'bsce', programName: '  BS   Civil Engineering ' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.programCreated, true);
  assert.strictEqual(r.body.program.code, 'BSCE');
  assert.strictEqual(r.body.program.name, 'BS Civil Engineering'); // trimmed, repeated spaces collapsed
  assert.strictEqual(r.body.code, 'CE 101');
  assert.deepStrictEqual(db.egaCopies, []);
  assert.ok((await call(admin, 'GET', '/programs')).body.some((p) => p.code === 'BSCE')); // listed like any other program
}));

test('a new program without a usable name, or with a bad code, is refused and creates nothing', () => withServer({ assigned: ASSIGNED }, async ({ call, db }) => {
  const before = [PROGRAMS.length, COURSES.length];
  const noName = await addSubject(call, { code: 'ME 101', title: 'Thermo', program: 'BSME' });
  assert.strictEqual(noName.status, 400);
  assert.match(noName.body.error, /Enter the program's full name/);
  assert.strictEqual((await addSubject(call, { code: 'ME 101', title: 'Thermo', program: 'BSME', programName: '   ' })).status, 400);
  const digits = await addSubject(call, { code: 'ME 101', title: 'Thermo', program: 'BSME', programName: '12' });
  assert.strictEqual(digits.status, 400);
  assert.match(digits.body.error, /at least two letters/);
  const bad = await addSubject(call, { code: 'ME 101', title: 'Thermo', program: 'B S!', programName: 'Mechanical' });
  assert.strictEqual(bad.status, 400);
  assert.match(bad.body.error, /2 to 20 letters, digits or hyphens/);
  assert.strictEqual((await addSubject(call, { code: 'ME 101', title: 'Thermo', program: '', programName: 'Mechanical' })).status, 400);
  assert.strictEqual((await addSubject(call, { code: 'ME 101', title: 'Thermo', program: 'X', programName: 'Mechanical' })).status, 400);
  assert.deepStrictEqual([PROGRAMS.length, COURSES.length], before);
  assert.strictEqual(db.egaCopies.length, 0);
}));

test('a program name already used by another code is 409, ignoring case and extra spaces, and creates nothing', () => withServer({ assigned: ASSIGNED }, async ({ call, db }) => {
  const before = [PROGRAMS.length, COURSES.length];
  const r = await addSubject(call, { code: 'ZZ 1', title: 'Copy', program: 'BSNN', programName: 'bs   IT' });
  assert.strictEqual(r.status, 409);
  assert.match(r.body.error, /already used by BSIT/);
  assert.deepStrictEqual([PROGRAMS.length, COURSES.length], before);
  assert.strictEqual(db.egaCopies.length, 0);
}));

test('a shared subject code is allowed in a different program but remains unique within that program', () => withServer({ assigned: ASSIGNED }, async ({ call, db }) => {
  const before = PROGRAMS.length;
  const r = await addSubject(call, { code: 'IT 101', title: 'Again', program: 'BSAR', programName: 'BS Architecture' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.programCreated, true);
  assert.strictEqual(r.body.program.code, 'BSAR');
  assert.strictEqual(PROGRAMS.length, before + 1);
  const duplicate = await addSubject(call, { code: 'IT 101', title: 'Again', program: 'BSAR' });
  assert.strictEqual(duplicate.status, 409);
  assert.match(duplicate.body.error, /already exists/);
  const sameProgramRename = await call(admin, 'PUT', '/courses/10', { code: 'IT 204', title: 'Duplicate' });
  assert.strictEqual(sameProgramRename.status, 409);
  const otherProgramRename = await call(admin, 'PUT', `/courses/${r.body.id}`, { code: 'IT 204', title: 'Shared code' });
  assert.strictEqual(otherProgramRename.status, 200);
  assert.strictEqual(db.egaCopies.length, 0);
}));

test('if the subject cannot be saved, the new program is rolled back too', () => withServer({ assigned: ASSIGNED }, async ({ call, db }) => {
  const before = PROGRAMS.length;
  const r = await addSubject(call, { code: 'BOOM', title: 'Fails', program: 'BSCH', programName: 'BS Chemistry' });
  assert.strictEqual(r.status, 500);
  assert.strictEqual(PROGRAMS.length, before);
  assert.strictEqual(db.egaCopies.length, 0);
}));

test('two admins creating the same new program at once: the loser gets a clear 409', () => withServer({ assigned: ASSIGNED }, async ({ call }) => {
  const r = await addSubject(call, { code: 'RC 101', title: 'Race', program: 'RACE', programName: 'Race program' });
  assert.strictEqual(r.status, 409);
  assert.match(r.body.error, /just created/);
}));

test('faculty cannot create a subject or a program', () => withServer({ assigned: ASSIGNED }, async ({ call }) => {
  const before = PROGRAMS.length;
  const r = await call(fay, 'POST', '/courses', { code: 'ZZ 1', title: 'No', program: 'BSZZ', programName: 'Nope' });
  assert.strictEqual(r.status, 403);
  assert.strictEqual(PROGRAMS.length, before);
}));

test('an admin\'s subject list says what is still missing for each subject; the faculty list is unchanged', () => withServer({ assigned: ASSIGNED }, async ({ call }) => {
  const admins = (await call(admin, 'GET', '/courses')).body;
  const it101 = admins.find((c) => c.code === 'IT 101');
  assert.deepStrictEqual(it101.gaps, ['the vision','the mission','the BSIT graduate attributes (EGAs)','the BSIT program outcomes','the learning outcomes of IT 101']); // this subject has not been configured
  const ie = admins.find((c) => c.program === 'BSIE');
  assert.ok(ie.gaps.some((g) => /BSIE program outcomes/.test(g)));
  assert.ok((await call(fay, 'GET', '/courses')).body.every((c) => c.gaps === undefined));
}));
