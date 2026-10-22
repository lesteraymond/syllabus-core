// HTTP-level tests for reading a syllabus the way a reviewer does (GET /api/syllabi/:id/review) and for the two names the syllabus list
// now carries (programCode, courseTitle). In-memory fake database, session user from the x-test-user header.
// Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');

const NAMES = { 5: { first_name: 'Fay', last_name: 'F' }, 6: { first_name: 'Gus', last_name: 'G' } };

function makeDb() {
  const s = {
    syllabi: {
      1: { syllabus_id: 1, user_id: 5, status: 'submitted', version: 'v1.1', title: 'Computer Programming 2', course_code: 'IT 204', file_path: null, content: JSON.stringify({ meta: { program: 'BSIT', title: 'working copy' } }), course_title: 'Computer Programming 2', program_code: 'BSIT', program_name: 'BS Information Technology', curriculum_program: null },
      2: { syllabus_id: 2, user_id: 5, status: 'draft', version: 'v1.0', title: 'A draft', course_code: 'IT 205', file_path: null, content: JSON.stringify({ meta: { program: 'BSIT' } }), course_title: null, program_code: null, program_name: null, curriculum_program: null },
      3: { syllabus_id: 3, user_id: 6, status: 'approved', version: 'v1.2', title: 'Data Analytics', course_code: 'IT304', file_path: '/uploads/syllabi/data-analytics.pdf', content: null, course_title: null, program_code: null, program_name: null, curriculum_program: 'BS Information Technology' },
      4: { syllabus_id: 4, user_id: 6, status: 'approved', version: 'v1.0', title: 'Old', course_code: 'OLD 1', file_path: null, content: null, course_title: null, program_code: null, program_name: null, curriculum_program: null },
      5: { syllabus_id: 5, user_id: 5, status: 'under_review', version: 'v1.0', title: 'No versions yet', course_code: 'IT 206', file_path: null, content: JSON.stringify({ meta: { program: 'BSIT', title: 'saved form' } }), course_title: null, program_code: null, program_name: null, curriculum_program: null },
    },
    versions: [
      { version_id: 10, syllabus_id: 1, version_label: 'v1.0', status_at_save: 'submitted', note: 'Initial version', created_at: '2026-01-01', file_path: null, content: JSON.stringify({ meta: { program: 'BSIT', title: 'first' }, catalog: { institution: { vision: 'V0' } } }) },
      { version_id: 11, syllabus_id: 1, version_label: 'v1.1', status_at_save: 'submitted', note: 'Fixed grading', created_at: '2026-01-02', file_path: null, content: JSON.stringify({ meta: { program: 'BSIT', title: 'second' }, catalog: { institution: { vision: 'V1' }, program: { code: 'BSIT' } } }) },
      { version_id: 12, syllabus_id: 3, version_label: 'v1.2', status_at_save: 'approved', note: '', created_at: '2026-01-03', file_path: '/uploads/syllabi/data-analytics.pdf', content: null },
      { version_id: 13, syllabus_id: 4, version_label: 'v1.0', status_at_save: 'approved', note: '', created_at: '2026-01-04', file_path: null, content: null },
    ],
  };
  const handle = (sql, p = []) => {
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [[{ user_id: p[0] }]]; // the auth middleware checks the user still exists
    if (sql.startsWith('SELECT s.syllabus_id, s.user_id, s.status')) {
      const x = s.syllabi[p[0]];
      return [x ? [{ ...x, ...NAMES[x.user_id] }] : []];
    }
    if (sql.startsWith('SELECT version_id, version_label, status_at_save')) {
      return [s.versions.filter((v) => v.syllabus_id === p[0]).sort((a, b) => b.version_id - a.version_id).map((v) => ({ ...v, has_form: v.content ? 1 : 0 }))];
    }
    if (sql.startsWith('SELECT version_label, content FROM syllabus_versions WHERE syllabus_id')) { // the version before the one shown, for "what changed"
      return [s.versions.filter((v) => v.syllabus_id === p[0] && v.version_id < p[1] && v.content).slice(-1).map((v) => ({ version_label: v.version_label, content: v.content }))];
    }
    if (sql.startsWith('SELECT content FROM syllabus_versions WHERE version_id')) {
      return [s.versions.filter((v) => v.version_id === p[0] && v.syllabus_id === p[1]).map((v) => ({ content: v.content }))];
    }
    if (sql.startsWith('SELECT s.*, u.first_name')) {
      const all = Object.values(s.syllabi);
      const visible = sql.includes("s.status <> 'draft' OR") ? all.filter(x=>x.status!=='draft'||x.user_id===p[0]) : sql.includes('s.user_id = ?') ? all.filter((x) => x.user_id === p[0]) : all.filter((x) => x.status !== 'draft');
      return [visible.filter((x) => !sql.includes("AND s.status = 'approved'") || x.status === 'approved')
        .map((x) => ({ ...x, ...NAMES[x.user_id], avatar_path: null, program_name: x.curriculum_program, course_id: null, curriculum_id: null, admin_comment: null, uploaded_at: '2026-01-01', updated_at: '2026-01-02' }))];
    }
    if (/FROM course_prerequisites/.test(sql)) return [[]]; // a subject's prerequisites: none set
    throw new Error('unexpected query: ' + sql);
  };
  return { s, query: async (q, p) => handle(q, p) };
}

async function withServer(fn) {
  const db = makeDb();
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { const h = req.headers['x-test-user']; req.session = h ? { user: JSON.parse(h) } : {}; next(); });
  app.locals.db = db;
  app.use('/api/syllabi', require('./syllabusContent'));
  app.use('/api/syllabi', require('./syllabi'));
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (as, path) => {
    const res = await fetch(base + '/syllabi' + path, { headers: as ? { 'x-test-user': JSON.stringify(as) } : {} });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  try { await fn({ db, call }); } finally { await new Promise((r) => server.close(r)); }
}

const admin = { id: 1, role: 'admin', firstName: 'Ann', lastName: 'A' };
const fay = { id: 5, role: 'faculty', firstName: 'Fay', lastName: 'F' };
const gus = { id: 6, role: 'faculty', firstName: 'Gus', lastName: 'G' };

test('faculty repository includes only their approved syllabi, while the workflow list retains every status', () => withServer(async ({ call, db }) => {
  for (const [i, status] of ['draft', 'submitted', 'under_review', 'for_revision', 'rejected', 'approved'].entries()) {
    db.s.syllabi[20 + i] = { ...db.s.syllabi[1], syllabus_id: 20 + i, status };
  }
  const repository = await call(fay, '/?scope=repository&status=submitted');
  assert.strictEqual(repository.status, 200);
  assert.deepStrictEqual(repository.body.map(x => x.id), [25]);
  assert.ok(repository.body.every(x => x.userId === fay.id && x.status === 'approved'));
  const workflow = await call(fay, '/');
  assert.strictEqual(workflow.status, 200);
  assert.deepStrictEqual(new Set(workflow.body.map(x => x.status)), new Set(['draft', 'submitted', 'under_review', 'for_revision', 'rejected', 'approved']));
  db.s.syllabi[20].status = 'approved'; // the existing approval transaction changes the same record
  assert.deepStrictEqual((await call(fay, '/?scope=repository')).body.map(x => x.id), [20, 25]);
  assert.deepStrictEqual((await call(gus, '/?scope=repository')).body.map(x => x.id), [3, 4]);
  assert.strictEqual((await call(null, '/?scope=repository')).status, 401);
}));

test('an admin reads the latest SUBMITTED version, not the author\'s working copy, with the faculty member, program and subject', () => withServer(async ({ call }) => {
  const r = await call(admin, '/1/review');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.content.meta.title, 'second'); // version v1.1, not the working copy
  assert.deepStrictEqual([r.body.version.id, r.body.version.label, r.body.version.note], [11, 'v1.1', 'Fixed grading']);
  assert.deepStrictEqual(r.body.syllabus, { id: 1, userId: 5, status: 'submitted', version: 'v1.1', courseCode: 'IT 204', title: 'Computer Programming 2', facultyName: 'Fay F', programCode: 'BSIT', programName: 'BS Information Technology', courseTitle: 'Computer Programming 2' });
  assert.strictEqual(r.body.catalog.institution.vision, 'V1'); // the snapshot it was submitted with
  assert.deepStrictEqual(r.body.versions.map((v) => v.label), ['v1.1', 'v1.0']); // newest first, for the version picker
  assert.strictEqual(r.body.file, null);
}));

test('?version= opens an earlier submitted version, and an id that is not one of this syllabus\'s versions is a 404', () => withServer(async ({ call }) => {
  const old = await call(admin, '/1/review?version=10');
  assert.strictEqual(old.status, 200);
  assert.strictEqual(old.body.content.meta.title, 'first');
  assert.strictEqual(old.body.version.label, 'v1.0');
  assert.strictEqual((await call(admin, '/1/review?version=12')).status, 404); // version 12 belongs to syllabus 3
  assert.strictEqual((await call(admin, '/1/review?version=999')).status, 404);
  assert.strictEqual((await call(admin, '/1/review?version=abc')).status, 404);
  assert.strictEqual((await call(admin, '/1/review?version=')).status, 404);
}));

test('a draft is invisible to an admin, other faculty cannot read it, the owner can, and signing out gets 401', () => withServer(async ({ call }) => {
  assert.strictEqual((await call(admin, '/2/review')).status, 404);
  assert.strictEqual((await call(gus, '/2/review')).status, 404);
  assert.strictEqual((await call(gus, '/1/review')).status, 404); // someone else's submitted syllabus
  const own = await call(fay, '/2/review');
  assert.strictEqual(own.status, 200);
  assert.strictEqual(own.body.version, null); // a draft has no submitted version: the saved form is shown
  assert.strictEqual(own.body.content.meta.program, 'BSIT');
  assert.strictEqual((await call(fay, '/1/review')).status, 200);
  assert.strictEqual((await call(null, '/1/review')).status, 401);
  assert.strictEqual((await call(admin, '/999/review')).status, 404);
  assert.strictEqual((await call(admin, '/abc/review')).status, 404);
}));

test('a syllabus uploaded as a file has no content and points at the file; one with neither says so', () => withServer(async ({ call }) => {
  const up = await call(admin, '/3/review');
  assert.strictEqual(up.status, 200);
  assert.strictEqual(up.body.content, null);
  assert.strictEqual(up.body.catalog, null);
  assert.deepStrictEqual(up.body.file, { path: '/uploads/syllabi/data-analytics.pdf' });
  assert.strictEqual(up.body.version.hasForm, false);
  assert.deepStrictEqual([up.body.syllabus.facultyName, up.body.syllabus.programCode, up.body.syllabus.programName], ['Gus G', 'BS Information Technology', '']); // an upload with only a curriculum falls back to its name
  const none = await call(admin, '/4/review');
  assert.strictEqual(none.status, 200);
  assert.deepStrictEqual([none.body.content, none.body.file], [null, null]);
  assert.strictEqual(none.body.syllabus.programName, 'No program');
}));

test('a syllabus with no stored version falls back to its own saved form', () => withServer(async ({ call }) => {
  const r = await call(admin, '/5/review');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.version, null);
  assert.deepStrictEqual(r.body.versions, []);
  assert.strictEqual(r.body.content.meta.title, 'saved form');
}));

test('the syllabus list carries programCode and courseTitle as NEW fields; nothing it had before changes', () => withServer(async ({ call, db }) => {
  db.s.syllabi[1].program_code = 'BSIT';
  const r = await call(admin, '/');
  assert.strictEqual(r.status, 200);
  const one = r.body.find((x) => x.id === 1);
  assert.strictEqual(one.programCode, 'BSIT');
  assert.strictEqual(one.courseTitle, 'Computer Programming 2');
  ['id', 'userId', 'filePath', 'title', 'courseCode', 'status', 'version', 'faculty', 'program', 'uploadedAt', 'updatedAt'].forEach((k) => assert.ok(k in one, k));
  assert.strictEqual(one.faculty, 'Fay F');
  const upload = r.body.find((x) => x.id === 3);
  assert.deepStrictEqual([upload.programCode, upload.courseTitle, upload.program], ['', '', 'BS Information Technology']); // old rows still list, with the old field intact
  assert.ok(!r.body.some((x) => x.id === 2)); // drafts stay out of an admin's list
}));

test('the review read says what the faculty member changed since the version before: nothing for the first version, sections for a later one', () => withServer(async ({ call }) => {
  const latest = await call(admin, '/1/review');
  assert.strictEqual(latest.status, 200);
  assert.strictEqual(latest.body.changes.from, 'v1.0');
  assert.ok(Array.isArray(latest.body.changes.sections));
  assert.strictEqual(typeof latest.body.changes.text, 'string');
  assert.strictEqual((await call(admin, '/1/review?version=10')).body.changes, null); // the first version has nothing before it
  assert.strictEqual((await call(admin, '/3/review')).body.changes, null); // an uploaded file has no form to compare
}));

test('administrator repository scope includes only approved syllabi while workflow lists retain pending reviews', () => withServer(async ({call}) => {
  const repository=await call(admin,'/?scope=repository');
  assert.strictEqual(repository.status,200);
  assert.deepStrictEqual(repository.body.map(row=>row.id),[3,4]);
  assert.ok(repository.body.every(row=>row.status==='approved'));
  const workflow=await call(admin,'/');
  assert.ok(workflow.body.some(row=>row.status==='submitted'));
  assert.ok(workflow.body.some(row=>row.status==='under_review'));
}));

test('administrator list includes only their own drafts alongside submitted records', () => withServer(async ({call,db})=>{
  db.s.syllabi[9]={...db.s.syllabi[2],syllabus_id:9,user_id:admin.id};
  const list=await call(admin,'/');assert.strictEqual(list.status,200);
  assert.ok(list.body.some(row=>row.id===9&&row.status==='draft'));
  assert.ok(!list.body.some(row=>row.id===2));
  assert.ok((await call(admin,'/?scope=repository')).body.every(row=>row.status==='approved'));
}));
