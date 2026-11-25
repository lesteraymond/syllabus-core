// The administrator's subject is the reference a syllabus is checked against (owner, 2026-11-25): its code, title, pre-requisite, year level and units, set on the
// admin screens for any program, new ones included. The typed copy of the printed curricula is not read anywhere (owner, 2026-11-25).
// Run: npm test.
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseUnits, unitsOf, applyUnits } = require('./subjectUnits');
const { subjectReference, programSubjectsOf } = require('./subjectReference');
const { findByCode } = require('./subjectCode');
const { coded, run } = require('./syllabuscheck/engine');
const G = require('./syllabuscheck/pipeline/generate');
const { mastersFor } = require('./syllabuscheck/repository');
const { sample } = require('./syllabuscheck/fixtures');

// ---- units ----
test('units: both or none, numbers from 0 with at most one decimal, not both zero', () => {
  assert.equal(parseUnits({}), undefined, 'not sent: the subject keeps its units');
  assert.equal(parseUnits({ lecture: '', lab: '' }), null, 'sent empty: cleared');
  assert.deepEqual(parseUnits({ lecture: '2', lab: 1 }), { lecture: 2, lab: 1 });
  assert.deepEqual(parseUnits({ lecture: '3', lab: '0' }), { lecture: 3, lab: 0 });
  assert.deepEqual(parseUnits({ lecture: 1.5, lab: 0.5 }), { lecture: 1.5, lab: 0.5 });
  for (const bad of [{ lecture: '2' }, { lab: '1' }, { lecture: '4 O', lab: '4' }, { lecture: -1, lab: 1 }, { lecture: 2, lab: 99 }, { lecture: 1.25, lab: 0 }, { lecture: 0, lab: 0 }, { lecture: true, lab: 1 }, { lecture: ' ', lab: 1 }]) {
    assert.throws(() => parseUnits(bad), e => e.status === 400 && /unit/i.test(e.message), JSON.stringify(bad));
  }
});
test('units are read as numbers and written into Step 1 as the syllabus keeps them; a subject without units leaves the author\'s', () => {
  assert.deepEqual(unitsOf({ lecture_units: '2.0', lab_units: '1.0' }), { lecture: 2, lab: 1 });
  assert.equal(unitsOf({ lecture_units: null, lab_units: null }), null);
  assert.equal(unitsOf({}), null, 'a database without the columns');
  assert.deepEqual(applyUnits({ lecture: '4 O', lab: '4' }, { lecture: 2, lab: 1 }), { lecture: '2', lab: '1' });
  assert.deepEqual(applyUnits({ lecture: '4', lab: '4' }, null), { lecture: '4', lab: '4' });
});

// ---- the reference of a syllabus ----
const row = (over = {}) => ({ course_id: 1, code: 'AI-201', title: 'MACHINE LEARNING 1', program_id: 9, program_code: 'BSAI', academic_year: '2026–2027', semester: '1st Semester', year_level: 2, prerequisite: 'AI 101', curriculum_year: '2027-2028', lecture_units: '2.0', lab_units: '1.0', ...over });
const fakeDb = rows => ({ query: async (sql, params) => {
  if (/WHERE c\.course_id = \?/.test(sql)) return [rows.filter(r => r.course_id === params[0])];
  if (/WHERE c\.program_id = \?/.test(sql)) return [rows.filter(r => r.program_id === params[0])];
  throw new Error('unexpected query: ' + sql);
} });

test('the reference is the syllabus\'s own subject, of any program, with nothing on file for that program', async () => {
  const ref = await subjectReference(fakeDb([row(), row({ course_id: 2, code: 'AI 101', title: 'INTRODUCTION TO AI', year_level: 1, prerequisite: null })]), { meta: { courseId: 1, curriculumYear: '2027-2028' } });
  assert.equal(ref.record.origin, 'admin'); assert.equal(ref.record.status, 'approved'); assert.equal(ref.record.program, 'BSAI');
  assert.deepEqual(ref.record.courses, [{ code: 'AI-201', title: 'MACHINE LEARNING 1', prereq: 'AI 101', lecture: 2, lab: 1, yearLevel: 2, semester: '1st Semester' }], 'this subject only: adding or editing another subject never makes a check out of date');
  assert.deepEqual(ref.adminMeta, { title: 'MACHINE LEARNING 1', prereq: 'AI 101', yearLevel: '2', lecture: '2', lab: '1' });
  assert.deepEqual(ref.subjects.map(s => s.code), ['AI-201', 'AI 101']);
});
test('what the administrator has not set is unknown, not empty; a set-up subject without a pre-requisite has none', async () => {
  const bare = await subjectReference(fakeDb([row({ semester: null, year_level: null, prerequisite: null, lecture_units: null, lab_units: null, curriculum_year: null })]), { meta: { courseId: 1 } });
  assert.deepEqual(bare.record.courses[0], { code: 'AI-201', title: 'MACHINE LEARNING 1', prereq: null, lecture: null, lab: null, yearLevel: null, semester: null });
  assert.deepEqual(bare.adminMeta, { title: 'MACHINE LEARNING 1' });
  const none = await subjectReference(fakeDb([row({ prerequisite: null })]), { meta: { courseId: 1 } });
  assert.equal(none.record.courses[0].prereq, ''); assert.equal(none.adminMeta.prereq, '');
});
test('no subject, or a deleted one: no reference (the caller uses the curricula on file, as before)', async () => {
  assert.equal(await subjectReference(fakeDb([row()]), { meta: {} }), null);
  assert.equal(await subjectReference(fakeDb([row()]), { meta: { courseId: 77 } }), null);
});

// ---- the check ----
const recordOf = course => ({ id: 'subject:1', origin: 'admin', source: 'Administrator subject list', program: 'BSAI', curriculumYear: 'test-2026', status: 'approved', courses: [course] });
function check(meta, course, adminMeta) {
  const { content, masters } = sample();
  Object.assign(content.meta, { program: 'BSAI', ...meta });
  const known = { prereq: 'AI 101', lecture: 2, lab: 1, yearLevel: 2, semester: '1st Semester', ...course };
  return coded(content, { ...masters, curricula: [recordOf(known)], programCodes: ['BSAI'], adminMeta: adminMeta || {} });
}
const step1 = { code: 'AI-201', title: 'DATA STRUCTURES', prereq: 'AI 101', lecture: '2', lab: '1', yearLevel: '2' };
const cur = r => r.findings.filter(f => /^CUR-/.test(f.ruleId || ''));

test('a syllabus that carries its subject\'s values passes, whatever the printed curriculum says', () => {
  const r = check(step1, { code: 'AI-201', title: 'DATA STRUCTURES' });
  assert.deepEqual(cur(r), []); assert.equal(r.critical, false); assert.equal(r.identity.status, 'verified');
});
test('a field the administrator has not set is not checked and does not block', () => {
  const r = check({ ...step1, lecture: '5', lab: '2', prereq: 'anything', yearLevel: '4' }, { code: 'AI-201', title: 'DATA STRUCTURES', prereq: null, lecture: null, lab: null, yearLevel: null });
  assert.deepEqual(cur(r), []);
  for (const path of ['meta.prereq', 'meta.lecture', 'meta.lab', 'meta.yearLevel']) assert.equal(r.checks.find(c => c.ruleId === 'CUR-FIELD' && c.path === path).status, 'NOT_APPLICABLE', path);
});
test('a draft saved before the administrator corrected the subject says to save it, never a score of 0', () => {
  const r = check({ ...step1, code: 'AI 999', title: 'OLD TITLE', lecture: '4' }, { code: 'AI-201', title: 'DATA STRUCTURES' }, { title: 'DATA STRUCTURES', prereq: 'AI 101', yearLevel: '2', lecture: '2', lab: '1' });
  assert.equal(r.critical, false);
  assert.deepEqual(cur(r).map(f => f.path).sort(), ['meta.code', 'meta.lecture', 'meta.title']);
  for (const f of cur(r)) { assert.equal(f.severity, 'blocking'); assert.match(f.message, /administrator/); assert.match(f.message, /save the syllabus/i); }
  assert.ok(!cur(r).some(f => /official curriculum/.test(f.message)), 'the printed curriculum is not named as the reference');
});
test('an empty pre-requisite matches "None" and is never offered as text', () => {
  assert.deepEqual(cur(check({ ...step1, prereq: 'None' }, { code: 'AI-201', title: 'DATA STRUCTURES', prereq: '' })), []);
  const r = check({ ...step1, prereq: 'AI 101' }, { code: 'AI-201', title: 'DATA STRUCTURES', prereq: '' });
  assert.equal(cur(r).length, 1); assert.equal(r.suggestions.some(s => s.path === 'meta.prereq'), false);
});
test('a new program is ready for a final score with no curriculum on file', async () => {
  const { content, masters } = sample();
  Object.assign(content.meta, { program: 'BSAI', ...step1 });
  const report = await run(content, { ...masters, synthetic: false, curricula: [recordOf({ code: 'AI-201', title: 'DATA STRUCTURES', prereq: 'AI 101', lecture: 2, lab: 1, yearLevel: 2 })], programCodes: ['BSAI'] }, { useAi: false, linkChecker: async () => ({ status: 'ok' }) });
  assert.deepEqual(report.findings.filter(f => f.severity === 'blocking').map(f => f.ruleId), ['AI-REQUIRED'], 'only the AI answer is missing');
  assert.equal(report.hybrid.curriculum.origin, 'admin');
});

// ---- a list that writes one code two ways ----
test('the exact spelling wins over a spelling that differs only in a hyphen', () => {
  const list = [{ code: 'AI 301', title: 'ROBOTICS' }, { code: 'AI-301', title: 'COMPUTER VISION' }];
  assert.equal(findByCode(list, 'AI-301').title, 'COMPUTER VISION'); assert.equal(findByCode(list, 'ai 301').title, 'ROBOTICS');
  assert.equal(findByCode([list[1]], 'AI 301').title, 'COMPUTER VISION'); assert.equal(findByCode(list, 'AI 999'), undefined);
});

// ---- the generator's background ----
test('the generator knows the administrator\'s subjects of the same curriculum year, and the pre-requisite whatever its year', () => {
  const subjects = [
    { code: 'IT 204', title: 'PROGRAMMING 2', prereq: 'IT-202', yearLevel: 2, semester: '2nd Semester', curriculumYear: '2022-2023' },
    { code: 'IT 202', title: 'PROGRAMMING 1', yearLevel: 2, semester: '1st Semester', curriculumYear: '2027-2028' },
    { code: 'IT 101', title: 'INTRODUCTION TO COMPUTING', yearLevel: 1, semester: '1st Semester', curriculumYear: null },
    { code: 'IT 999', title: 'OTHER CURRICULUM', yearLevel: 1, semester: '1st Semester', curriculumYear: '2030-2031' },
  ];
  const programSubjects = programSubjectsOf(subjects, { code: 'IT 204', curriculumYear: '2022-2023', prereq: 'IT-202' });
  assert.deepEqual(programSubjects.map(s => s.title), ['PROGRAMMING 2', 'PROGRAMMING 1', 'INTRODUCTION TO COMPUTING'], 'a subject of another curriculum year was not taken before');
  const subject = G.subjectOf({ meta: { code: 'IT 204', prereq: 'IT-202', title: 'x', program: 'BSIT' } }, { curricula: [], programSubjects }, '');
  assert.deepEqual(subject.prerequisiteSubjects, ['PROGRAMMING 1']); assert.deepEqual(subject.subjectsTakenBefore, ['PROGRAMMING 1', 'INTRODUCTION TO COMPUTING']);
});

// ---- the printed curricula are not read ----
// Answers the lookups of mastersFor for one program and its subjects; reading the printed curricula is an error.
const checkerDb = rows => ({ query: async (sql, params = []) => {
  if (/syllabus_check_curricula/.test(sql)) throw new Error('the printed curricula must not be read');
  if (/WHERE c\.course_id = \?/.test(sql)) return [rows.filter(r => r.course_id === params[0])];
  if (/WHERE c\.program_id = \?/.test(sql)) return [rows.filter(r => r.program_id === params[0])];
  if (/FROM institution_settings/.test(sql)) return [[{ vision: 'V', mission_lead: 'L', mission_items: '[]', version: 1 }]];
  return [[]];
} });
test('a check reads the administrator\'s subject and nothing printed', async () => {
  const m = await mastersFor(checkerDb([row(), row({ course_id: 2, code: 'AI 101', title: 'INTRODUCTION TO AI', year_level: 1, prerequisite: null })]), { meta: { courseId: 1, program: 'BSAI' } });
  assert.deepEqual(m.curricula.map(c => c.id), ['subject:1']); assert.deepEqual(m.programSubjects.map(s => s.code), ['AI-201', 'AI 101']);
  assert.equal(m.otherCurricula, undefined);
});
test('a syllabus without a subject has no reference and is told to choose one', async () => {
  const masters = await mastersFor(checkerDb([row()]), { meta: { program: 'BSAI' } });
  assert.deepEqual(masters.curricula, []);
  const { content } = sample(); delete content.meta.courseId;
  const r = coded(content, { ...sample().masters, curricula: [] }), found = r.findings.find(x => x.ruleId === 'CUR-REF');
  assert.equal(found.severity, 'blocking'); assert.match(found.message, /choose the subject/i); assert.ok(!/curriculum/i.test(found.message));
  assert.equal(r.critical, false, 'never a score of 0 for it');
});
test('the fingerprint follows the subject itself, not the other subjects of the program', async () => {
  const c = { meta: { courseId: 1, program: 'BSAI' } };
  const first = (await mastersFor(checkerDb([row()]), c)).fingerprint;
  assert.equal((await mastersFor(checkerDb([row(), row({ course_id: 2, code: 'AI 101' })]), c)).fingerprint, first);
  assert.notEqual((await mastersFor(checkerDb([row({ title: 'MACHINE LEARNING ONE' })]), c)).fingerprint, first);
  assert.notEqual((await mastersFor(checkerDb([row({ lecture_units: '3.0' })]), c)).fingerprint, first);
});
