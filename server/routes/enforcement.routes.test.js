// HTTP-level tests that a faculty member can only use courses an admin assigned to them: the filtered course and
// program lists, the builder's draft/save/submit routes and the legacy create/edit routes. Same approach as
// assignments.routes.test.js: in-memory fake database, session user taken from the x-test-user header.
// The fake does not run SQL, so it checks the wiring (which queries and parameters the routes use), not MySQL itself.
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');

const COURSES = [
  { course_id: 10, code: 'IT 101', title: 'Intro', program_id: 1, program_code: 'BSIT', program_name: 'BSIT' },
  { course_id: 11, code: 'IT 204', title: 'Programming 2', program_id: 1, program_code: 'BSIT', program_name: 'BSIT' },
  { course_id: 20, code: 'IE 101', title: 'Work Study', program_id: 2, program_code: 'BSIE', program_name: 'BSIE' },
];
const PROGRAMS = [{ program_id: 1, code: 'BSIT', name: 'BS IT', outcome_count: 10 }, { program_id: 2, code: 'BSIE', name: 'BS IE', outcome_count: 0 }];
const USERS = new Set([1, 5, 6]);

function makeDb({ assigned = {}, syllabi = {}, beforeDelete } = {}) {
  // assigned: userId -> { programs: [], courses: [] }
  const queries = [];
  const egaCopies = []; // program ids that received a copy of the school-wide EGAs
  const mine = (uid) => assigned[uid] || { programs: [], courses: [] };
  const handle = (sql, params = []) => {
    queries.push(sql);
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
    // A subject code is unique within its program: create passes (code, program id), a rename passes (code, own id, own id).
    if (sql.startsWith('SELECT 1 FROM courses WHERE code')) {
      const rename = sql.includes('course_id <>');
      const home = rename ? (COURSES.find((c) => c.course_id === params[1]) || {}).program_id : params[1];
      return [COURSES.filter((c) => c.code === params[0] && c.program_id === home && (!rename || c.course_id !== params[1])).map(() => ({ 1: 1 }))];
    }
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
    if (sql.startsWith("SELECT user_id FROM users WHERE role = 'admin'")) return [[]];
    if (sql.startsWith('INSERT')) return [{ insertId: 100 }];
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
  return { queries, egaCopies, query: async (s, p) => handle(s, p), getConnection: async () => conn };
}

async function withServer(opts, fn) {
  const db = makeDb(opts);
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
  try { await fn({ db, call }); } finally { await new Promise((r) => server.close(r)); }
}

const admin = { id: 1, role: 'admin', firstName: 'Ada', lastName: 'Admin' };
const fay = { id: 5, role: 'faculty', firstName: 'Fay', lastName: 'Faculty' };
const gus = { id: 6, role: 'faculty', firstName: 'Gus', lastName: 'Faculty' };
const row = (over) => ({ syllabus_id: 1, user_id: 5, status: 'draft', version: 'v1.0', title: '', course_code: '', course_id: null, content: null, content_schema_version: null, content_updated_at: null, curriculum_id: null, file_path: null, ...over });
const meta = (courseId) => ({ sections: { meta: { courseId, code: 'X', title: 'Y' } } });
const ASSIGNED = { 5: { programs: [1], courses: [10] } };

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
  assert.strictEqual((await put({ title: 'Intro to IT', note: 'Corrected the course title.' })).status, 200);
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

test('legacy create: the course code must match an assigned course', () => withServer({ assigned: ASSIGNED }, async ({ call }) => {
  assert.strictEqual((await call(fay, 'POST', '/syllabi', { title: 'Intro', courseCode: 'it 101' })).status, 200);
  assert.strictEqual((await call(fay, 'POST', '/syllabi', { title: 'P2', courseCode: 'IT 204' })).status, 403);
  assert.strictEqual((await call(fay, 'POST', '/syllabi', { title: 'No code', courseCode: '' })).status, 403);
  const none = await call(gus, 'POST', '/syllabi', { title: 'Intro', courseCode: 'IT 101' });
  assert.strictEqual(none.status, 403);
  assert.match(none.body.error, /No program or subject is assigned/);
}));

test('legacy create: a subject the person already has a syllabus on cannot get another', () => withServer({ assigned: ASSIGNED, syllabi: { 9: row({ syllabus_id: 9, user_id: 5, course_id: 10, status: 'submitted' }) } }, async ({ call }) => {
  const again = await call(fay, 'POST', '/syllabi', { title: 'Intro again', courseCode: 'IT 101' });
  assert.strictEqual(again.status, 409);
  assert.match(again.body.error, /already have a syllabus for this subject \(Submitted\)/);
}));

test('legacy edit by the owner needs an assigned course; an admin changing status is unaffected', () => withServer({ assigned: ASSIGNED, syllabi: { 4: row({ syllabus_id: 4, status: 'for_revision', course_code: 'IT 204' }), 5: row({ syllabus_id: 5, status: 'for_revision', course_code: 'IT 101' }) } }, async ({ call }) => {
  assert.strictEqual((await call(fay, 'PUT', '/syllabi/4', { title: 'New title', note: 'Changed the title.' })).status, 403);
  assert.strictEqual((await call(fay, 'PUT', '/syllabi/5', { title: 'New title', note: 'Changed the title.' })).status, 200);
  assert.strictEqual((await call(admin, 'PUT', '/syllabi/4', { status: 'approved' })).status, 200);
}));

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

test('a subject code another program already uses is allowed in a new program, which is created with it', () => withServer({ assigned: ASSIGNED }, async ({ call, db }) => {
  const before = PROGRAMS.length;
  const r = await addSubject(call, { code: 'IT 101', title: 'Introduction to Architecture', program: 'BSAR', programName: 'BS Architecture' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.programCreated, true);
  assert.strictEqual(r.body.program.code, 'BSAR');
  assert.strictEqual(PROGRAMS.length, before + 1);
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
