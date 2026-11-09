'use strict';
// The catalog (programs and subjects) belongs to an academic year. The fake database models a MIGRATED database: programs have an academic_year, the same code can exist in
// two years, and the queries are answered from small in-memory tables so the tests check what the server returns and refuses, not just the SQL text.
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const YEARS = [{ label: '2026–2027', start_year: 2026, is_current: 0 }, { label: '2027–2028', start_year: 2027, is_current: 1 }];

function makeDb() {
  const s = {
    programs: [{ program_id: 1, code: 'BSIT', name: 'BS IT', academic_year: '2026–2027' }],
    courses: [{ course_id: 10, code: 'IT 204', title: 'Programming 2', program_id: 1, program_code: 'BSIT', academic_year: '2026–2027' }],
    writes: [],
    egas: {}, pos: {},   // the EGAs and Program Outcomes of each program (program_egas, program_outcomes), by program id
    school: { vision: 'School vision', mission_lead: 'School mission', mission_items: JSON.stringify(['Teach well']), version: 1 },
  };
  const yearOfProgram = (p) => p.academic_year || '2027–2028';
  const handle = (sql, p = []) => {
    if (s.noCurriculumColumn && /curriculum_year/.test(sql) && !/syllabus_check_curricula/.test(sql)) throw Object.assign(new Error("Unknown column 'c.curriculum_year'"), { code: 'ER_BAD_FIELD_ERROR' }); // a database before migrate-curriculum-year
    if (/^(INSERT|UPDATE|DELETE)\b/i.test(sql)) s.writes.push({ sql, params: [...p] });
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [[{ user_id: p[0] }]];
    if (sql.startsWith('SELECT label, start_year, is_current FROM academic_years')) return [YEARS];
    if (sql.startsWith('SELECT academic_year FROM programs LIMIT 0')) return [[]];
    if (sql.startsWith('SELECT 1 FROM academic_years WHERE label')) return [YEARS.filter((y) => y.label === p[0]).map(() => ({ 1: 1 }))];
    if (sql.startsWith('SELECT p.program_id, p.code, p.name, COUNT(o.po_no)')) {
      const year = sql.includes('COALESCE(p.academic_year, ?) = ?') ? p[1] : null;
      return [s.programs.filter((x) => !year || yearOfProgram(x) === year).map((x) => ({ program_id: x.program_id, code: x.code, name: x.name, outcome_count: 0, ega_count: x.egaCount || 0 }))];
    }
    if (sql.startsWith('SELECT c.course_id, c.code, c.title, c.program_id, p.code AS program_code, COUNT')) {
      const year = sql.includes('COALESCE(p.academic_year, ?) = ?') ? p[sql.includes('p.code = ?') ? 2 : 1] : null;
      return [s.courses.filter((c) => !year || yearOfProgram(s.programs.find((x) => x.program_id === c.program_id)) === year).map(({ curriculum_year, ...c }) => ({ ...c, ...(sql.includes('c.curriculum_year') ? { curriculum_year: curriculum_year || null } : {}), clo_count: 0, standards_json: null }))];
    }
    if (sql.startsWith('SELECT program_id FROM programs WHERE code = ? AND COALESCE(academic_year, ?) = ?')) return [s.programs.filter((x) => x.code === p[0] && yearOfProgram(x) === p[2])];
    if (sql.startsWith('SELECT code, name FROM programs WHERE COALESCE(academic_year, ?) = ?')) return [s.programs.filter((x) => yearOfProgram(x) === p[1])];
    if (sql.startsWith('SELECT a.program_id FROM program_code_aliases')) return [[]];
    if (sql.startsWith('INSERT INTO programs (code, name, academic_year)')) { const x = { program_id: 100 + s.programs.length, code: p[0], name: p[1], academic_year: p[2] }; s.programs.push(x); return [{ insertId: x.program_id }]; }
    if (sql.startsWith('SELECT 1 FROM courses WHERE code = ? AND program_id = ?')) return [s.courses.filter((c) => c.code === p[0] && c.program_id === p[1]).map(() => ({ 1: 1 }))];
    if (sql.startsWith('INSERT INTO courses')) { const prog = s.programs.find((x) => x.program_id === p[2]); const c = { course_id: 200 + s.courses.length, code: p[0], title: p[1], program_id: p[2], program_code: prog.code, academic_year: null, standards_json: p[3] }; s.courses.push(c); return [{ insertId: c.course_id }]; }
    if (sql.startsWith('UPDATE courses SET academic_year = ?, semester')) { const c = s.courses.find((x) => x.course_id === p[4]); if (c) c.academic_year = p[0]; return [{}]; }
    if (sql.startsWith('UPDATE courses SET curriculum_year = ? WHERE course_id = ?')) { const c = s.courses.find((x) => x.course_id === p[1]); if (c) c.curriculum_year = p[0]; return [{}]; }
    if (sql.startsWith('SELECT 1 FROM courses WHERE code = ? AND course_id <> ? AND program_id = ?')) return [s.courses.filter((c) => c.code === p[0] && c.course_id !== p[1] && c.program_id === p[2]).map(() => ({ 1: 1 }))];
    if (sql.startsWith('UPDATE courses SET code = ?, title = ? WHERE course_id = ?')) { const c = s.courses.find((x) => x.course_id === p[2]); if (c) Object.assign(c, { code: p[0], title: p[1] }); return [{}]; }
    if (sql.startsWith('UPDATE courses SET academic_year = ? WHERE')) { const c = s.courses.find((x) => x.course_id === p[1]); if (c) c.academic_year = p[0]; return [{}]; }
    if (sql.startsWith('SELECT COALESCE(p.academic_year, ?) AS year FROM courses c JOIN programs p')) { const c = s.courses.find((x) => x.course_id === p[1]); return [c ? [{ year: yearOfProgram(s.programs.find((x) => x.program_id === c.program_id)) }] : []]; }
    if (sql.startsWith('SELECT COALESCE(academic_year, ?) AS year FROM programs WHERE program_id')) { const x = s.programs.find((r) => r.program_id === p[1]); return [x ? [{ year: yearOfProgram(x) }] : []]; }
    if (sql.startsWith('SELECT c.course_id, c.code, c.title, c.clos_version, p.program_id')) { const c = s.courses.find((x) => x.course_id === p[0]); const prog = c && s.programs.find((x) => x.program_id === c.program_id); return [c ? [{ course_id: c.course_id, code: c.code, title: c.title, clos_version: 1, program_id: prog.program_id, program_code: prog.code, program_name: prog.name, standards_json: null, academic_year: c.academic_year, semester: null, year_level: null, prerequisite: null, ...(sql.includes('c.curriculum_year') ? { curriculum_year: c.curriculum_year || null } : {}) }] : []]; }
    if (/information_schema/.test(sql)) return [sql.includes('COUNT(*)') ? [{ n: 0 }] : []]; // the version tables are not migrated here
    if (/FROM program_outcome_sources|FROM program_po_reference_active|FROM program_code_aliases|INTO program_po_reference_audit/.test(sql)) throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' });
    if (sql.startsWith('SELECT ega_no, name, short_name FROM program_egas WHERE program_id')) return [(s.egas[p[0]] || []).map((e) => ({ ega_no: e.no, name: e.name, short_name: e.short }))];
    if (sql.startsWith('INSERT INTO program_egas')) { for (const [pid, no, name, short] of p[0]) (s.egas[pid] = s.egas[pid] || []).push({ no, name, short }); return [{}]; }
    if (sql.startsWith('INSERT INTO program_outcomes')) { for (const [pid, no, short, text, egas] of p[0]) (s.pos[pid] = s.pos[pid] || []).push({ no, short, text, egas }); return [{}]; }
    if (sql.startsWith('SELECT po_no, short_name, outcome_text, ega_nos FROM program_outcomes WHERE program_id')) return [(s.pos[p[0]] || []).map((o) => ({ po_no: o.no, short_name: o.short, outcome_text: o.text, ega_nos: o.egas }))];
    if (sql.startsWith('SELECT vision, mission_lead, mission_items, version FROM institution_settings')) return [[s.school]];
    if (sql.startsWith('SELECT ega_no, name, short_name FROM institution_egas')) return [[]];
    if (sql.startsWith('SELECT course_id, code, standards_json FROM courses WHERE program_id')) return [s.courses.filter((c) => c.program_id === p[0]).map((c) => ({ course_id: c.course_id, code: c.code, standards_json: c.standards_json || null }))];
    if (sql.startsWith('UPDATE courses SET standards_json = ? WHERE course_id')) { const c = s.courses.find((x) => x.course_id === p[1]); if (c) c.standards_json = p[0]; return [{}]; }
    if (sql.startsWith('SELECT clo_id')) return [[]];
    if (sql.startsWith('SELECT program_id, code, name, egas_version, pos_version FROM programs WHERE code = ? ORDER BY (COALESCE(academic_year, ?) = ?) DESC')) { // a code resolves to the asked year's program, else the newest
      const same = s.programs.filter((x) => x.code === p[0]).sort((x, y) => (Number(yearOfProgram(y) === p[2]) - Number(yearOfProgram(x) === p[2])) || yearOfProgram(y).localeCompare(yearOfProgram(x)) || y.program_id - x.program_id);
      return [same.slice(0, 1)];
    }
    if (sql.startsWith('SELECT program_id, code, name, egas_version, pos_version FROM programs WHERE program_id')) return [s.programs.filter((x) => x.program_id === Number(p[0]))];
    if (sql.startsWith("SELECT program_code, curriculum_year, courses_json FROM syllabus_check_curricula")) return [[]];
    throw new Error('unexpected query: ' + sql);
  };
  const conn = { query: async (q, p) => handle(q, p), beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} };
  return { s, query: async (q, p) => handle(q, p), getConnection: async () => conn };
}

async function withServer(fn) {
  const db = makeDb();
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { const h = req.headers['x-test-user']; req.session = h ? { user: JSON.parse(h) } : {}; next(); });
  app.locals.db = db;
  app.use('/api/programs', require('./programs'));
  app.use('/api/courses', require('./courses'));
  const server = await new Promise((resolve) => { const x = app.listen(0, '127.0.0.1', () => resolve(x)); });
  const call = async (as, method, path, body) => { const r = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method, headers: { 'Content-Type': 'application/json', 'x-test-user': JSON.stringify(as) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  try { await fn({ call, db }); } finally { await new Promise((r) => server.close(r)); }
}
const admin = { id: 1, role: 'admin' }, fay = { id: 5, role: 'faculty' };
const TERM = { semester: '1st Semester', yearLevel: 2, prerequisite: 'None' };

test('a new academic year starts with no programs and no subjects, even for the administrator; last year stays', () => withServer(async ({ call }) => {
  assert.deepStrictEqual((await call(admin, 'GET', '/programs')).body, [], 'no programs in the current year 2027–2028');
  assert.deepStrictEqual((await call(admin, 'GET', '/courses')).body, [], 'no subjects either');
  const past = await call(admin, 'GET', '/programs?year=' + encodeURIComponent('2026–2027'));
  assert.deepStrictEqual(past.body.map((p) => p.code), ['BSIT'], 'the past year still has its program');
  assert.deepStrictEqual((await call(admin, 'GET', '/courses?year=' + encodeURIComponent('2026–2027'))).body.map((c) => c.code), ['IT 204']);
  assert.strictEqual((await call(admin, 'GET', '/courses?year=all')).body.length, 0, 'a catalog is never a mix of years: all means the current year');
}));

test('the program list tells which programs have EGAs and outcomes, so the admin can see which still need setting up', () => withServer(async ({ call, db }) => {
  const row = (await call(admin, 'GET', '/programs?year=' + encodeURIComponent('2026–2027'))).body[0];
  assert.deepStrictEqual([row.egaCount, row.outcomeCount, row.inheritedFrom], [0, 0, null], 'a program with no EGAs and no outcomes reports zeros (needs setup)');
  db.s.programs.find((p) => p.code === 'BSIT').egaCount = 3;
  assert.strictEqual((await call(admin, 'GET', '/programs?year=' + encodeURIComponent('2026–2027'))).body[0].egaCount, 3);
}));

test('a faculty member may look at the previous and the current year only', () => withServer(async ({ call }) => {
  assert.strictEqual((await call(fay, 'GET', '/programs?year=' + encodeURIComponent('2026–2027'))).status, 200);
  assert.strictEqual((await call(fay, 'GET', '/programs?year=' + encodeURIComponent('2031–2032'))).status, 403);
}));

test('adding a subject creates the program in the CURRENT year, and the same code may exist in two years', () => withServer(async ({ call, db }) => {
  const made = await call(admin, 'POST', '/courses', { code: 'IT 204', title: 'Programming 2 (new curriculum)', program: 'BSIT', programName: 'BS Information Technology', ...TERM });
  assert.strictEqual(made.status, 200, JSON.stringify(made.body));
  assert.strictEqual(made.body.programCreated, true, 'last year\'s BSIT is not this year\'s: a new BSIT row is created');
  const created = db.s.programs.find((p) => p.academic_year === '2027–2028');
  assert.deepStrictEqual([created.code, created.name], ['BSIT', 'BS Information Technology']);
  assert.strictEqual(db.s.programs.length, 2, 'both years keep their own BSIT');
  assert.deepStrictEqual((await call(admin, 'GET', '/courses')).body.map((c) => c.code), ['IT 204'], 'the current year has exactly its own subject');
  assert.strictEqual(db.s.courses.find((c) => c.title.includes('new curriculum')).academic_year, '2027–2028', 'the subject carries its catalog year');
  // a second subject of the same program joins the existing current-year program
  const again = await call(admin, 'POST', '/courses', { code: 'IT 301', title: 'Networks', program: 'BSIT', ...TERM });
  assert.strictEqual(again.status, 200); assert.strictEqual(again.body.programCreated, false);
  assert.strictEqual(db.s.programs.length, 2);
}));

test('a past academic year is view only: every change to its subjects and programs is refused with 403', () => withServer(async ({ call, db }) => {
  const refused = (r) => { assert.strictEqual(r.status, 403, JSON.stringify(r.body)); assert.strictEqual(r.body.code, 'catalog_year_read_only'); assert.match(r.body.error, /2026–2027 catalog is view only/); };
  refused(await call(admin, 'PUT', '/courses/10', { code: 'IT 204', title: 'Changed' }));
  refused(await call(admin, 'DELETE', '/courses/10'));
  refused(await call(admin, 'PUT', '/courses/10/clos', { clos: [], version: 1 }));
  refused(await call(admin, 'PUT', '/courses/10/standards', { section: 'vision', value: {}, version: 1 }));
  refused(await call(admin, 'PATCH', '/programs/1', { name: 'Renamed', expectedName: 'BS IT' }));
  refused(await call(admin, 'DELETE', '/programs/1', {}));
  refused(await call(admin, 'PUT', '/programs/BSIT/outcomes', { pos: [], version: 1 }));
  refused(await call(admin, 'PUT', '/programs/1/egas', { egas: [], version: 1 }));
  assert.ok(!db.s.writes.some((w) => /^(UPDATE|DELETE) (courses|programs)/.test(w.sql)), 'nothing was written');
}));

// ---- the EGAs and Program Outcomes of a new program, and how they reach its subjects ---------------------------------------------------------------------------------
const OUTCOMES = { egas: [{ no: 1, name: 'Critical thinking', short: 'CT' }, { no: 2, name: 'Service', short: 'SV' }], pos: [{ no: 1, short: 'PO1', text: 'Apply knowledge of computing', egas: [2, 1, 1] }] };
const standardsOf = (db, code) => JSON.parse(db.s.courses.find((c) => c.code === code).standards_json);

test('a new program is created with its EGAs and Program Outcomes, and its first subject starts with a copy of them and of the school vision and mission', () => withServer(async ({ call, db }) => {
  const made = await call(admin, 'POST', '/courses', { code: 'CS 101', title: 'Intro', program: 'BSCS', programName: 'BS Computer Science', outcomes: OUTCOMES, ...TERM });
  assert.strictEqual(made.status, 200, JSON.stringify(made.body));
  const program = db.s.programs.find((p) => p.code === 'BSCS');
  assert.deepStrictEqual(db.s.egas[program.program_id], OUTCOMES.egas, 'the program has its own EGAs');
  assert.deepStrictEqual(db.s.pos[program.program_id], [{ no: 1, short: 'PO1', text: 'Apply knowledge of computing', egas: '1,2' }], 'and its outcome, mapped to unique sorted EGAs');
  const own = standardsOf(db, 'CS 101');
  assert.deepStrictEqual([own.vision, own.mission, own.egas, own.pos], ['School vision', { lead: 'School mission', items: ['Teach well'] }, OUTCOMES.egas, [{ no: 1, short: 'PO1', text: 'Apply knowledge of computing', egas: [1, 2] }]], 'the faculty builder reads these when the program and subject are picked');
  assert.deepStrictEqual(own.versions, { vision: 1, egas: 1, pos: 1 });
  // a later subject of the same program starts with the same copy; a program without outcomes starts blank, as before
  assert.strictEqual((await call(admin, 'POST', '/courses', { code: 'CS 102', title: 'Next', program: 'BSCS', ...TERM })).status, 200);
  assert.deepStrictEqual(standardsOf(db, 'CS 102').egas, OUTCOMES.egas);
  assert.strictEqual((await call(admin, 'POST', '/courses', { code: 'EN 1', title: 'Blank', program: 'BSEN', programName: 'BS English', ...TERM })).status, 200);
  assert.deepStrictEqual(standardsOf(db, 'EN 1'), { vision: '', mission: { lead: '', items: [] }, egas: [], pos: [], versions: { vision: 1, egas: 1, pos: 1 } });
}));

test('bad outcomes are refused before anything is written, and outcomes are only accepted with a NEW program', () => withServer(async ({ call, db }) => {
  const base = { code: 'CS 101', title: 'Intro', program: 'BSCS', programName: 'BS Computer Science', ...TERM };
  for (const outcomes of [{ egas: [] }, { egas: [{ no: 1, name: '', short: 'x' }] }, { egas: OUTCOMES.egas, pos: [{ no: 1, short: 'P', text: 'T', egas: [9] }] }, { egas: [OUTCOMES.egas[0], OUTCOMES.egas[0]] }]) {
    const r = await call(admin, 'POST', '/courses', { ...base, outcomes });
    assert.strictEqual(r.status, 400, JSON.stringify(outcomes));
  }
  assert.ok(!db.s.writes.some((w) => /^INSERT INTO (programs|courses|program_egas)/.test(w.sql)), 'nothing was written');
  assert.strictEqual((await call(admin, 'POST', '/courses', { ...base, code: 'CS 100' })).status, 200);   // BSCS now exists in the current year
  const existing = await call(admin, 'POST', '/courses', { ...base, code: 'CS 999', outcomes: OUTCOMES });
  assert.strictEqual(existing.status, 400); assert.match(existing.body.error, /new program/);
  assert.strictEqual((await call(fay, 'POST', '/courses', { ...base, outcomes: OUTCOMES })).status, 403, 'only an administrator');
}));

test('Add program: an administrator creates a program on its own, with or without EGAs and POs, in the current year; its first subject starts with a copy', () => withServer(async ({ call, db }) => {
  const made = await call(admin, 'POST', '/programs', { code: 'bscs', name: '  BS   Computer Science ', outcomes: OUTCOMES });
  assert.strictEqual(made.status, 201, JSON.stringify(made.body));
  assert.deepStrictEqual([made.body.code, made.body.name, made.body.egaCount, made.body.outcomeCount], ['BSCS', 'BS Computer Science', 2, 1]);
  const program = db.s.programs.find((p) => p.code === 'BSCS');
  assert.deepStrictEqual(db.s.egas[program.program_id], OUTCOMES.egas);
  assert.deepStrictEqual(db.s.pos[program.program_id], [{ no: 1, short: 'PO1', text: 'Apply knowledge of computing', egas: '1,2' }]);
  assert.strictEqual((await call(admin, 'POST', '/courses', { code: 'CS 101', title: 'Intro', program: 'BSCS', ...TERM })).status, 200);
  assert.deepStrictEqual(standardsOf(db, 'CS 101').egas, OUTCOMES.egas, 'a subject added to the existing program copies its EGAs');
  // outcomes are optional: the program can be set up later with its Outcomes button
  const bare = await call(admin, 'POST', '/programs', { code: 'BSEN', name: 'BS English' });
  assert.strictEqual(bare.status, 201); assert.deepStrictEqual([bare.body.egaCount, bare.body.outcomeCount], [0, 0]);
}));

test('Add program refuses a repeated code, a bad code or name and bad outcomes, writes nothing for them, and is for administrators only', () => withServer(async ({ call, db }) => {
  assert.strictEqual((await call(admin, 'POST', '/programs', { code: 'BSCS', name: 'BS Computer Science' })).status, 201);
  const dup = await call(admin, 'POST', '/programs', { code: 'BSCS', name: 'Another name' });
  assert.strictEqual(dup.status, 409); assert.match(dup.body.error, /already exists/);
  assert.strictEqual((await call(admin, 'POST', '/programs', { code: 'BSIT', name: 'bs computer  science' })).status, 409, 'a name another program uses');
  for (const body of [{ code: 'X', name: 'BS Nothing' }, { code: 'B S!', name: 'BS Nothing' }, { code: 'BSNO', name: '' }, { code: 'BSNO', name: '12' }]) assert.strictEqual((await call(admin, 'POST', '/programs', body)).status, 400, JSON.stringify(body));
  const before = db.s.writes.length;
  for (const outcomes of [{ egas: [] }, { egas: OUTCOMES.egas, pos: [{ no: 1, short: 'P', text: 'T', egas: [9] }] }]) assert.strictEqual((await call(admin, 'POST', '/programs', { code: 'BSNO', name: 'BS Nothing', outcomes })).status, 400);
  assert.ok(!db.s.programs.some((p) => p.code === 'BSNO') && !db.s.writes.slice(before).some((w) => /^INSERT/.test(w.sql)), 'nothing was written');
  assert.strictEqual((await call(fay, 'POST', '/programs', { code: 'BSNO', name: 'BS Nothing' })).status, 403, 'only an administrator');
}));

test('Apply to subjects copies the program\'s outcomes and the school vision into its existing subjects, only for the current year, only for an administrator', () => withServer(async ({ call, db }) => {
  const blank = { vision: '', mission: { lead: '', items: [] }, egas: [], pos: [], versions: { vision: 1, egas: 1, pos: 1 } };
  assert.strictEqual((await call(admin, 'POST', '/courses', { code: 'EN 1', title: 'Blank', program: 'BSEN', programName: 'BS English', ...TERM })).status, 200);
  const program = db.s.programs.find((p) => p.code === 'BSEN');
  assert.strictEqual((await call(admin, 'POST', `/programs/${program.program_id}/sync-subjects`)).status, 409, 'a program without EGAs has nothing to apply');
  db.s.egas[program.program_id] = OUTCOMES.egas.map((e) => ({ ...e }));
  db.s.pos[program.program_id] = [{ no: 1, short: 'PO1', text: 'Apply knowledge of computing', egas: '1,2' }];
  assert.deepStrictEqual(standardsOf(db, 'EN 1'), blank, 'a subject keeps its own copy when the program changes');
  assert.strictEqual((await call(fay, 'POST', `/programs/${program.program_id}/sync-subjects`)).status, 403);
  const done = await call(admin, 'POST', `/programs/${program.program_id}/sync-subjects`);
  assert.strictEqual(done.status, 200, JSON.stringify(done.body));
  assert.deepStrictEqual([done.body.subjects, done.body.updated, done.body.unchanged, done.body.skipped], [1, 1, 0, []]);
  const after = standardsOf(db, 'EN 1');
  assert.deepStrictEqual([after.vision, after.egas.length, after.pos[0].egas, after.versions], ['School vision', 2, [1, 2], { vision: 2, egas: 2, pos: 2 }]);
  const again = await call(admin, 'POST', `/programs/${program.program_id}/sync-subjects`);
  assert.deepStrictEqual([again.body.updated, again.body.unchanged], [0, 1], 'a second run changes nothing');
  const past = await call(admin, 'POST', '/programs/1/sync-subjects');
  assert.strictEqual(past.status, 403); assert.strictEqual(past.body.code, 'catalog_year_read_only');
}));

// A subject's curriculum year (lib/curriculumYear.js): set with the subject, independent of its academic year, changed or cleared on edit, and absent until migrated.
test('a subject keeps a curriculum year of its own, separate from its academic year, and the list reports it', () => withServer(async ({ call }) => {
  const made = await call(admin, 'POST', '/courses', { code: 'IT 105', title: 'Discrete Structures', program: 'BSIT', programName: 'BS Information Technology', curriculumYear: '2022–2023', ...TERM });
  assert.strictEqual(made.status, 200, JSON.stringify(made.body));
  assert.strictEqual(made.body.curriculumYear, '2022-2023', 'normalized to the plain-hyphen form the approved curricula use');
  assert.strictEqual(made.body.term.academicYear, '2027–2028', 'the academic year is still the catalog year, untouched by the curriculum year');
  const plain = await call(admin, 'POST', '/courses', { code: 'IT 106', title: 'No curriculum yet', program: 'BSIT', ...TERM });
  assert.strictEqual(plain.status, 200); assert.strictEqual(plain.body.curriculumYear, null, 'optional: a subject may be made without one (API compatibility)');
  const list = (await call(admin, 'GET', '/courses')).body;
  assert.deepStrictEqual(list.map((c) => [c.code, c.curriculumYear]), [['IT 105', '2022-2023'], ['IT 106', null]]);
}));

test('a curriculum year must be two consecutive years; nothing is written when it is not', () => withServer(async ({ call, db }) => {
  for (const bad of ['2022', '2022-2024', '22-23', 'abcd-efgh', 2022]) {
    const r = await call(admin, 'POST', '/courses', { code: 'IT 9', title: 'X', program: 'BSIT', programName: 'BS IT', curriculumYear: bad, ...TERM });
    assert.strictEqual(r.status, 400, String(bad)); assert.match(r.body.error, /YYYY-YYYY/);
  }
  assert.strictEqual(db.s.courses.length, 1, 'no subject was created by a refused request');
}));

test('editing a subject changes or clears its curriculum year, and leaves it alone when it is not sent', () => withServer(async ({ call, db }) => {
  const id = (await call(admin, 'POST', '/courses', { code: 'IT 105', title: 'Discrete Structures', program: 'BSIT', programName: 'BS IT', curriculumYear: '2022-2023', ...TERM })).body.id;
  const kept = await call(admin, 'PUT', '/courses/' + id, { code: 'IT 105', title: 'Discrete Structures 1' });
  assert.strictEqual(kept.status, 200, JSON.stringify(kept.body)); assert.strictEqual(kept.body.curriculumYear, '2022-2023', 'not sent: unchanged');
  const changed = await call(admin, 'PUT', '/courses/' + id, { code: 'IT 105', title: 'Discrete Structures 1', curriculumYear: '2025-2026' });
  assert.strictEqual(changed.body.curriculumYear, '2025-2026');
  const cleared = await call(admin, 'PUT', '/courses/' + id, { code: 'IT 105', title: 'Discrete Structures 1', curriculumYear: '' });
  assert.strictEqual(cleared.body.curriculumYear, null, 'sent empty: cleared');
  const bad = await call(admin, 'PUT', '/courses/' + id, { code: 'IT 105', title: 'Renamed', curriculumYear: '2025' });
  assert.strictEqual(bad.status, 400); assert.strictEqual(db.s.courses.find((c) => c.course_id === id).title, 'Discrete Structures 1', 'a refused edit changes nothing');
  const faculty = await call(fay, 'PUT', '/courses/' + id, { code: 'IT 105', title: 'X', curriculumYear: '2022-2023' });
  assert.strictEqual(faculty.status, 403, 'administrators only, as before');
}));

test('before migrate-curriculum-year the catalog works as before; setting a curriculum year names the migration', () => withServer(async ({ call, db }) => {
  db.s.noCurriculumColumn = true;
  const plain = await call(admin, 'POST', '/courses', { code: 'IT 106', title: 'Networks', program: 'BSIT', programName: 'BS IT', ...TERM });
  assert.strictEqual(plain.status, 200, JSON.stringify(plain.body)); assert.strictEqual(plain.body.curriculumYear, null);
  const list = (await call(admin, 'GET', '/courses')).body;
  assert.deepStrictEqual(list.map((c) => [c.code, c.curriculumYear]), [['IT 106', null]], 'the list falls back and still answers');
  const refused = await call(admin, 'POST', '/courses', { code: 'IT 107', title: 'X', program: 'BSIT', curriculumYear: '2022-2023', ...TERM });
  assert.strictEqual(refused.status, 503); assert.match(refused.body.error, /migrate-curriculum-year/);
}));
