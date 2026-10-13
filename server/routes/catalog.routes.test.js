// HTTP-level tests for the admin-managed catalog: each program has its own EGAs and POs, each subject its own CLOs.
// Covers refusing to remove an EGA or PO that is still in use, stale saves (two admins), isolation between programs,
// who may edit, and the snapshot stored when a syllabus is submitted. In-memory fake database, session user from the
// x-test-user header. Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');

function makeDb() {
  const s = {
    settings: { vision: 'V', mission_lead: 'Lead', mission_items: JSON.stringify(['m1']), version: 1 },
    instEgas: [{ ega_no: 1, name: 'Thinker', short_name: 'Thinker' }, { ega_no: 2, name: 'Professional', short_name: 'Pro' }],
    programs: [
      { program_id: 1, code: 'BSIT', name: 'BS IT', egas_version: 1, pos_version: 1 },
      { program_id: 2, code: 'BSIE', name: 'BS IE', egas_version: 1, pos_version: 1 },
    ],
    egas: [ // each program's own EGAs
      { program_id: 1, ega_no: 1, name: 'Thinker', short_name: 'Thinker' }, { program_id: 1, ega_no: 2, name: 'Professional', short_name: 'Pro' },
      { program_id: 2, ega_no: 1, name: 'Engineer', short_name: 'Engineer' }, { program_id: 2, ega_no: 2, name: 'Leader', short_name: 'Leader' },
    ],
    pos: [
      { program_id: 1, po_no: 1, short_name: 'Apply', outcome_text: 'Apply knowledge', ega_nos: '1' },
      { program_id: 1, po_no: 2, short_name: 'Ethics', outcome_text: 'Be ethical', ega_nos: '2' },
      { program_id: 2, po_no: 1, short_name: 'Design', outcome_text: 'Design systems', ega_nos: '1' },
    ],
    courses: [
      { course_id: 10, code: 'IT 204', title: 'Programming 2', program_id: 1, clos_version: 1 },
      { course_id: 20, code: 'IE 101', title: 'Work Study', program_id: 2, clos_version: 1 },
    ],
    clos: [{ course_id: 10, ega_nos: '1', po_nos: '1' }, { course_id: 20, ega_nos: '2', po_nos: '1' }],
    syllabi: { 1: { syllabus_id: 1, user_id: 5, status: 'draft', version: 'v1.0', title: 'Programming 2', course_code: 'IT 204', course_id: 10, curriculum_id: null, file_path: null, content: JSON.stringify({ meta: { courseId: 10, program: 'BSIT', code: 'IT 204', title: 'Programming 2' } }) } },
    saved: [],
  };
  const prog = (where) => s.programs.find(where);
  const handle = (sql, p = []) => {
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [[{ user_id: p[0] }]];
    if (sql.startsWith('SELECT vision')) return [[s.settings]];
    if (sql.startsWith('SELECT ega_no, name, short_name FROM institution_egas')) return [s.instEgas];
    if (sql.startsWith('SELECT ega_no FROM institution_egas')) return [s.instEgas.map((e) => ({ ega_no: e.ega_no }))];
    if (sql.startsWith('SELECT ega_no, name, short_name FROM program_egas')) return [s.egas.filter((e) => e.program_id === p[0])];
    if (sql.startsWith('SELECT p.program_id FROM programs p WHERE NOT EXISTS')) return [s.programs.filter((x) => !s.egas.some((e) => e.program_id === x.program_id)).map((x) => ({ program_id: x.program_id }))];
    if (sql.startsWith('SELECT version FROM institution_settings')) return [[{ version: s.settings.version }]];
    if (sql.startsWith('SELECT program_id, code, name, egas_version, pos_version FROM programs WHERE program_id')) return [s.programs.filter((x) => x.program_id === p[0])];
    if (sql.startsWith('SELECT program_id, code, name, egas_version, pos_version FROM programs WHERE code')) return [s.programs.filter((x) => x.code === p[0])];
    if (sql.startsWith('SELECT po_no FROM program_outcomes')) return [s.pos.filter((x) => x.program_id === p[0]).map((x) => ({ po_no: x.po_no }))];
    if (sql.startsWith('SELECT po_no, short_name')) return [s.pos.filter((x) => x.program_id === p[0])];
    if (sql.startsWith('SELECT o.po_no, o.ega_nos')) return [s.pos.filter((x) => x.program_id === p[0]).map((x) => ({ po_no: x.po_no, ega_nos: x.ega_nos, program_code: prog((y) => y.program_id === p[0]).code }))];
    if (sql.startsWith('SELECT c.code, k.ega_nos, k.po_nos')) return [s.clos.filter((k) => s.courses.find((c) => c.course_id === k.course_id).program_id === p[0]).map((k) => ({ code: s.courses.find((c) => c.course_id === k.course_id).code, ega_nos: k.ega_nos, po_nos: k.po_nos }))];
    if (sql.startsWith('SELECT code FROM courses WHERE program_id')) return [s.courses.filter((c) => c.program_id === p[0]).map((c) => ({ code: c.code }))];
    if (sql.startsWith('SELECT egas_version AS v')) return [[{ v: prog((x) => x.program_id === p[0]).egas_version }]];
    if (sql.startsWith('SELECT pos_version AS v')) return [[{ v: prog((x) => x.program_id === p[0]).pos_version }]];
    if (sql.startsWith('SELECT clos_version AS v')) return [[{ v: s.courses.find((c) => c.course_id === p[0]).clos_version }]];
    if (sql.startsWith('INSERT INTO institution_settings')) { s.settings.version++; return [{}]; }
    if (sql.startsWith('UPDATE programs SET egas_version')) { prog((x) => x.program_id === p[0]).egas_version++; return [{}]; }
    if (sql.startsWith('UPDATE programs SET pos_version')) { prog((x) => x.program_id === p[0]).pos_version++; return [{}]; }
    if (sql.startsWith('UPDATE courses SET clos_version')) { s.courses.find((c) => c.course_id === p[0]).clos_version++; return [{}]; }
    if (sql.startsWith('DELETE FROM program_egas')) { s.egas = s.egas.filter((e) => e.program_id !== p[0]); return [{}]; }
    if (sql.startsWith('INSERT INTO program_egas')) { p[0].forEach(([program_id, ega_no, name, short_name]) => s.egas.push({ program_id, ega_no, name, short_name })); return [{}]; }
    if (sql.startsWith('DELETE FROM program_outcomes')) { s.pos = s.pos.filter((x) => x.program_id !== p[0]); return [{}]; }
    if (sql.startsWith('INSERT INTO program_outcomes')) { p[0].forEach(([program_id, po_no, short_name, outcome_text, ega_nos]) => s.pos.push({ program_id, po_no, short_name, outcome_text, ega_nos })); return [{}]; }
    if (sql.startsWith('SELECT c.course_id, c.code, c.title, c.clos_version, p.program_id')) return [s.courses.filter((c) => c.course_id === p[0]).map((c) => ({ ...c, program_code: prog((x) => x.program_id === c.program_id).code, program_name: 'x' }))];
    if (sql.startsWith('SELECT clo_id')) return [s.clos.filter((k) => k.course_id === p[0]).map((k, i) => ({ clo_id: i + 1, title: '', clo_level: 'Enabling', statement: 's', ega_nos: k.ega_nos, po_nos: k.po_nos }))];
    if (sql.startsWith('SELECT course_id FROM faculty_courses')) return [[{ course_id: 10 }]];
    if (sql.startsWith('SELECT program_id FROM faculty_programs')) return [[{ program_id: 1 }]];
    if (sql.startsWith('SELECT * FROM syllabi WHERE syllabus_id')) return [s.syllabi[p[0]] ? [s.syllabi[p[0]]] : []];
    if (sql.startsWith("SELECT user_id FROM users WHERE role = 'admin'")) return [[]];
    if (sql.startsWith('UPDATE syllabi SET content')) { s.saved.push(JSON.parse(p[0])); return [{}]; }
    if (/^(INSERT|UPDATE|DELETE)/.test(sql)) return [{}];
    throw new Error('unexpected query: ' + sql);
  };
  const conn = { query: async (q, p) => handle(q, p), beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} };
  return { s, query: async (q, p) => handle(q, p), getConnection: async () => conn };
}

async function withServer(fn) {
  const db = makeDb();
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { const h = req.headers['x-test-user']; req.session = h ? { user: JSON.parse(h) } : {}; next(); });
  app.locals.db = db;
  app.use('/api/institution', require('./institution'));
  app.use('/api/programs', require('./programs'));
  app.use('/api/courses', require('./courses'));
  app.use('/api/syllabi', require('./syllabusContent'));
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (as, method, path, body) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(as ? { 'x-test-user': JSON.stringify(as) } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  try { await fn({ db, call }); } finally { await new Promise((r) => server.close(r)); }
}

const admin = { id: 1, role: 'admin' };
const fay = { id: 5, role: 'faculty', firstName: 'Fay', lastName: 'F' };
const inst = (over = {}) => ({ vision: 'New vision', mission: { lead: 'New lead', items: ['m1', 'm2'] }, egas: [{ no: 1, name: 'Thinker', short: 'Thinker' }, { no: 2, name: 'Professional', short: 'Pro' }], ...over });
const ega = (no, name = 'EGA ' + no) => ({ no, name, short: name });
const po = (no, egas, text = 'Statement') => ({ no, short: 'PO ' + no, text, egas });
const clo = (egas, pos) => ({ title: 'T', level: 'Enabling', statement: 'S', egas, pos });

test('a program returns its own EGAs, its POs, the versions and the subjects that share them', () => withServer(async ({ call }) => {
  const it = (await call(admin, 'GET', '/programs/BSIT/outcomes')).body;
  const ie = (await call(admin, 'GET', '/programs/BSIE/outcomes')).body;
  assert.deepStrictEqual(it.egas.map((e) => e.name), ['Thinker', 'Professional']);
  assert.deepStrictEqual(ie.egas.map((e) => e.name), ['Engineer', 'Leader']);
  assert.deepStrictEqual(it.versions, { egas: 1, pos: 1 });
  assert.deepStrictEqual(it.subjects, ['IT 204']);
  assert.deepStrictEqual(ie.subjects, ['IE 101']);
}));

test('editing one program\'s EGAs and POs never changes another program', () => withServer(async ({ call }) => {
  const r = await call(admin, 'PUT', '/programs/BSIT/egas', { egas: [ega(1, 'Renamed'), ega(2, 'Professional'), ega(3, 'Steward')], version: 1 });
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.body.egas.map((e) => e.name), ['Renamed', 'Professional', 'Steward']);
  assert.strictEqual(r.body.versions.egas, 2);
  const other = (await call(admin, 'GET', '/programs/BSIE/outcomes')).body;
  assert.deepStrictEqual(other.egas.map((e) => e.name), ['Engineer', 'Leader']);
  assert.strictEqual(other.versions.egas, 1);
  const pos = await call(admin, 'PUT', '/programs/BSIT/outcomes', { pos: [po(1, [1, 3]), po(2, [2])], version: 1 });
  assert.strictEqual(pos.status, 200);
  assert.strictEqual((await call(admin, 'GET', '/programs/BSIE/outcomes')).body.pos.length, 1);
}));

test('an EGA still used by a CLO or a PO of that program cannot be removed; one nothing uses can', () => withServer(async ({ call }) => {
  const used = await call(admin, 'PUT', '/programs/BSIT/egas', { egas: [ega(2)], version: 1 }); // EGA 1: IT 204's CLO and PO 1
  assert.strictEqual(used.status, 409);
  assert.match(used.body.error, /EGA 1 is used by IT 204, PO 1 \(BSIT\)/);
  assert.match(used.body.error, /Remove those tags first/);
  const ok = await call(admin, 'PUT', '/programs/BSIE/egas', { egas: [ega(1), ega(2), ega(3)], version: 1 });
  assert.strictEqual(ok.status, 200);
  // BSIT's CLO using EGA 1 does not block removing an EGA of BSIE that its own CLOs do not use
  const other = await call(admin, 'PUT', '/programs/BSIE/egas', { egas: [ega(1), ega(2)], version: 2 });
  assert.strictEqual(other.status, 200);
}));

test('a PO that a CLO of the program is tagged with cannot be removed; text, mapping and new POs can change', () => withServer(async ({ call }) => {
  const blocked = await call(admin, 'PUT', '/programs/BSIT/outcomes', { pos: [po(2, [2])], version: 1 });
  assert.strictEqual(blocked.status, 409);
  assert.match(blocked.body.error, /PO 1 is used by IT 204/);
  const ok = await call(admin, 'PUT', '/programs/BSIT/outcomes', { pos: [po(1, [1, 2], 'Reworded'), po(2, [2]), po(3, [1])], version: 1 });
  assert.strictEqual(ok.status, 200);
  // BSIE's PO 1 is used by IE 101 only, so BSIT's CLOs never block BSIE
  assert.strictEqual((await call(admin, 'PUT', '/programs/BSIE/outcomes', { pos: [], version: 1 })).status, 409);
}));

test('a PO can map only to EGAs of its own program', () => withServer(async ({ call }) => {
  const r = await call(admin, 'PUT', '/programs/BSIT/outcomes', { pos: [po(1, [1, 3]), po(2, [2])], version: 1 }); // BSIT has no EGA 3
  assert.strictEqual(r.status, 400);
  assert.match(r.body.error, /EGA that does not exist in BSIT/);
}));

test('two admins: a save from an out-of-date screen is refused with 409 and changes nothing', () => withServer(async ({ call }) => {
  const first = await call(admin, 'PUT', '/programs/BSIT/egas', { egas: [ega(1, 'A'), ega(2, 'B')], version: 1 });
  assert.strictEqual(first.status, 200);
  const stale = await call(admin, 'PUT', '/programs/BSIT/egas', { egas: [ega(1, 'C'), ega(2, 'D')], version: 1 });
  assert.strictEqual(stale.status, 409);
  assert.match(stale.body.error, /changed by someone else/);
  assert.deepStrictEqual((await call(admin, 'GET', '/programs/BSIT/outcomes')).body.egas.map((e) => e.name), ['A', 'B']);
  assert.strictEqual((await call(admin, 'PUT', '/programs/BSIT/egas', { egas: [ega(1, 'C'), ega(2, 'D')], version: 2 })).status, 200);
  // the EGA, PO and CLO versions are independent: saving EGAs does not make a POs save stale
  assert.strictEqual((await call(admin, 'PUT', '/programs/BSIT/outcomes', { pos: [po(1, [1]), po(2, [2])], version: 1 })).status, 200);
}));

test('CLO tags are checked against the subject\'s own program, and CLO saves are versioned', () => withServer(async ({ call }) => {
  const course = (await call(admin, 'GET', '/courses/10')).body;
  assert.strictEqual(course.version, 1);
  assert.strictEqual((await call(admin, 'PUT', '/courses/10/clos', { clos: [clo([3], [1])], version: 1 })).status, 400); // BSIT has no EGA 3
  assert.strictEqual((await call(admin, 'PUT', '/courses/10/clos', { clos: [clo([2], [1])], version: 1 })).status, 200);
  const stale = await call(admin, 'PUT', '/courses/10/clos', { clos: [clo([1], [1])], version: 1 });
  assert.strictEqual(stale.status, 409);
  assert.match(stale.body.error, /changed by someone else/);
  assert.strictEqual((await call(admin, 'PUT', '/courses/20/clos', { clos: [clo([1], [1])], version: 1 })).status, 200); // another subject is unaffected
}));

test('vision and mission are school-wide, versioned, and editable', () => withServer(async ({ call }) => {
  const ok = await call(admin, 'PUT', '/institution/outcomes', inst({ version: 1 }));
  assert.strictEqual(ok.status, 200);
  const stale = await call(admin, 'PUT', '/institution/outcomes', inst({ version: 1 }));
  assert.strictEqual(stale.status, 409);
}));

test('faculty cannot edit the institution, EGAs, program outcomes or CLOs, but can read them', () => withServer(async ({ call }) => {
  assert.strictEqual((await call(fay, 'PUT', '/institution/outcomes', inst())).status, 403);
  assert.strictEqual((await call(fay, 'PUT', '/programs/BSIT/egas', { egas: [ega(1)] })).status, 403);
  assert.strictEqual((await call(fay, 'PUT', '/programs/BSIT/outcomes', { pos: [po(1, [1])] })).status, 403);
  assert.strictEqual((await call(fay, 'PUT', '/courses/10/clos', { clos: [] })).status, 403);
  assert.strictEqual((await call(fay, 'GET', '/institution/outcomes')).status, 200);
  assert.strictEqual((await call(fay, 'GET', '/programs/BSIT/outcomes')).status, 200);
}));

test('submitting stores a snapshot with the program\'s own EGAs and POs; faculty cannot send one', () => withServer(async ({ call, db }) => {
  const r = await call(fay, 'POST', '/syllabi/1/submit', {});
  assert.strictEqual(r.status, 200);
  const saved = db.s.saved[0];
  assert.strictEqual(saved.catalog.institution.vision, 'V');
  assert.strictEqual(saved.catalog.program.code, 'BSIT');
  assert.deepStrictEqual(saved.catalog.program.egas.map((e) => e.no), [1, 2]);
  assert.deepStrictEqual(saved.catalog.program.pos.map((p) => p.no), [1, 2]);
  const forged = await call(fay, 'PUT', '/syllabi/1/content', { sections: { catalog: { institution: {} } } });
  assert.strictEqual(forged.status, 400);
  assert.match(forged.body.error, /Unknown section/);
}));

test('submit is refused with a clear 409 when the vision, mission, program EGAs or POs, or the subject CLOs are missing', () => withServer(async ({ call, db }) => {
  db.s.settings.vision = '  ';
  const noVision = await call(fay, 'POST', '/syllabi/1/submit', {});
  assert.strictEqual(noVision.status, 409);
  assert.match(noVision.body.error, /administrator has not finished setting up this subject yet: the vision is missing/);
  assert.strictEqual(db.s.saved.length, 0);
  db.s.settings.vision = 'V';
  db.s.settings.mission_items = JSON.stringify(['', ' ']);
  assert.match((await call(fay, 'POST', '/syllabi/1/submit', {})).body.error, /the mission is missing/);
  db.s.settings.mission_items = JSON.stringify(['m1']);
  db.s.pos = db.s.pos.filter((p) => p.program_id !== 1);
  assert.match((await call(fay, 'POST', '/syllabi/1/submit', {})).body.error, /BSIT program outcomes is missing/);
  db.s.egas = db.s.egas.filter((e) => e.program_id !== 1);
  db.s.instEgas = [];
  const both = await call(fay, 'POST', '/syllabi/1/submit', {});
  assert.strictEqual(both.status, 409);
  assert.match(both.body.error, /graduate attributes \(EGAs\), the BSIT program outcomes are missing/);
  assert.strictEqual(db.s.saved.length, 0);
}));

test('submit is refused when the subject has no learning outcomes, and works once everything is set up', () => withServer(async ({ call, db }) => {
  db.s.clos = db.s.clos.filter((k) => k.course_id !== 10);
  const noClos = await call(fay, 'POST', '/syllabi/1/submit', {});
  assert.strictEqual(noClos.status, 409);
  assert.match(noClos.body.error, /the learning outcomes of IT 204 is missing/);
  db.s.clos.push({ course_id: 10, ega_nos: '1', po_nos: '1' });
  const ok = await call(fay, 'POST', '/syllabi/1/submit', {});
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(db.s.saved.length, 1);
}));
