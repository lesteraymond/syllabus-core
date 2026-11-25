// A subject code is the same with a hyphen or a space ("IT 204" and "IT-204"): the curriculum check, the curriculum hint of another program, the pre-requisite,
// the administrator's curriculum warning and the AI Syllabus Generator all agree. A different code or pre-requisite is still found.
// Run: npm test.
const test = require('node:test');
const assert = require('node:assert/strict');
const { withoutHyphens, normCode, sameCode } = require('./subjectCode');
const { coded, normCode: engineNormCode } = require('./syllabuscheck/engine');
const { identityOf } = require('./syllabuscheck/identity');
const { samePrerequisite } = require('./syllabuscheck/prerequisite');
const { curriculumNote } = require('./curriculumNote');
const G = require('./syllabuscheck/pipeline/generate');
const { sample } = require('./syllabuscheck/fixtures');

test('a hyphen and a space are the same in a subject code; case and extra spaces are ignored as before', () => {
  for (const [a, b] of [['IT 204', 'IT-204'], ['it-204', 'IT 204'], ['IT  204', 'IT - 204'], ['GE - US', 'GE-US'], ['GE - ELECT KOMFIL', 'GE ELECT KOMFIL'], ['IT–204', 'IT-204'], ['IT-ELEC1', 'IT ELEC1']]) {
    assert.equal(sameCode(a, b), true, `${a} / ${b}`);
  }
  assert.equal(engineNormCode, normCode, 'the checker uses this one');
});

test('a different code stays different', () => {
  for (const [a, b] of [['IT 204', 'IT 205'], ['IT204', 'IT-204'], ['IT 999', 'IT-204'], ['', 'IT-204'], ['-', ''], ['CAPSPRO1', 'CAPSPRO 1'], ['IT-ELEC1', 'IT-ELEC2']]) {
    assert.equal(sameCode(a, b), false, `${a} / ${b}`);
  }
  assert.equal(withoutHyphens('-'), '-', 'only a hyphen that follows a letter or a digit');
});

// The real engine: one approved curriculum with the given code and pre-requisite.
function report(entered, official, program = 'ZZ') {
  const c = JSON.parse(JSON.stringify(sample().content));
  Object.assign(c.meta, { program, curriculumYear: '', ...entered });
  const course = { title: c.meta.title, lecture: Number(c.meta.lecture), lab: Number(c.meta.lab), yearLevel: Number(c.meta.yearLevel), ...official };
  return coded(c, { curricula: [{ id: 1, program, status: 'approved', curriculumYear: 'x', courses: [course] }], programCodes: [program] });
}
const checkOf = (r, ruleId, path) => r.checks.find(x => x.ruleId === ruleId && x.path === path);

test('CUR-CODE: "IT 204" is found in a curriculum that prints "IT-204", and the other way round', () => {
  for (const [entered, official] of [['IT 204', 'IT-204'], ['IT-204', 'IT 204']]) {
    const r = report({ code: entered, prereq: 'IT 202' }, { code: official, prereq: 'IT 202' });
    assert.equal(r.critical, false); assert.equal(r.identity.status, 'verified');
    assert.equal(checkOf(r, 'CUR-CODE', 'meta.code').status, 'PASS');
    assert.deepEqual(checkOf(r, 'CUR-CODE', 'meta.code').evidence, { actual: entered, expected: official }, 'the evidence keeps both spellings');
    assert.equal(r.findings.filter(f => /^CUR-/.test(f.ruleId || '')).length, 0);
  }
});

test('CUR-CODE: a code the curriculum does not have is still a critical mismatch', () => {
  for (const code of ['IT 999', 'IT204', 'IT 2-04']) assert.equal(report({ code, prereq: 'IT 202' }, { code: 'IT-204', prereq: 'IT 202' }).critical, true, code);
});

test('CUR-FIELD: a pre-requisite with a hyphen or a space is the same one; a different one still blocks', () => {
  const status = (entered, official) => checkOf(report({ code: 'ZZ 1', prereq: entered }, { code: 'ZZ 1', prereq: official }), 'CUR-FIELD', 'meta.prereq').status;
  for (const [a, b] of [['IT 204', 'IT-204'], ['IT-202', 'IT 202'], ['IT ELEC2, 4th Yr', 'IT-ELEC2, 4th Yr']]) assert.equal(status(a, b), 'PASS', `${a} / ${b}`);
  for (const [a, b] of [['IT 203', 'IT-204'], ['IT204', 'IT-204'], ['None', 'IT-204'], ['IT 204', 'IT-204, IT-205']]) assert.equal(status(a, b), 'FAIL', `${a} / ${b}`);
  assert.equal(samePrerequisite('it 204', 'IT-204'), false, 'upper and lower case are still compared exactly in a pre-requisite');
  assert.equal(samePrerequisite('-', ''), false);
});

test('a code of another program is found for the hint whatever its hyphen', () => {
  const r = identityOf({ code: 'CS 101', program: 'A' }, { curricula: [{ program: 'A', courses: [] }], otherCurricula: [{ program: 'B', curriculumYear: 'y', courses: [{ code: 'CS-101', title: 'T' }] }] }, [], null);
  assert.deepEqual(r.elsewhere, [{ program: 'B', curriculumYear: 'y', code: 'CS-101', title: 'T' }]);
});

test('the administrator is not warned about a hyphen, and is still warned about a different pre-requisite', () => {
  const rows = [{ program_code: 'BSIT', curriculum_year: '2022-2023', courses_json: JSON.stringify([{ code: 'IT-303', prereq: 'IT-204', yearLevel: 3 }]) }];
  const note = prerequisite => curriculumNote({ programCode: 'BSIT', code: 'IT 303', term: { prerequisite, yearLevel: 3 } }, rows);
  assert.equal(note('IT 204'), null);
  assert.deepEqual(note('IT 205').differences.map(d => [d.field, d.entered, d.curriculum]), [['prerequisite', 'IT 205', 'IT-204']]);
});

test('the generator finds the subject and its pre-requisite whatever the hyphen', () => {
  const masters = { curricula: [{ courses: [
    { code: 'IT 202', title: 'PROGRAMMING 1', yearLevel: 2, semester: '1st Semester' },
    { code: 'IT-204', title: 'PROGRAMMING 2', yearLevel: 2, semester: '2nd Semester' },
    { code: 'IT-303', title: 'SYSTEM INTEGRATION', yearLevel: 3, semester: '1st Semester' },
  ] }] };
  const of = (code, prereq) => G.subjectOf({ meta: { code, prereq, title: 'System Integration', program: 'BSIT' } }, masters, '');
  const spaced = of('IT 303', 'IT 204'), exact = of('IT-303', 'IT-204');
  assert.deepEqual(spaced.prerequisiteSubjects, ['PROGRAMMING 2']);
  assert.deepEqual(spaced.subjectsTakenBefore, ['PROGRAMMING 1', 'PROGRAMMING 2']);
  assert.deepEqual([spaced.prerequisiteSubjects, spaced.subjectsTakenBefore], [exact.prerequisiteSubjects, exact.subjectsTakenBefore]);
  assert.equal(spaced.code, 'IT 303', 'the code is sent as the author wrote it');
});

// The Cybersecurity curriculum prints some codes with a hyphen at the end ("IT 102-", "IT-ELEC1-", "IS-").
test('a hyphen at the end of a code is ignored', () => {
  for (const [a, b] of [['IT 102', 'IT 102-'], ['IT-204', 'IT-204-'], ['it 204', 'IT-204-'], ['IS', 'IS-'], ['IT ELEC1', 'IT-ELEC1-'], ['IT 102 -', 'IT 102']]) assert.equal(sameCode(a, b), true, `${a} / ${b}`);
  for (const [a, b] of [['IT 103', 'IT 102-'], ['IT102', 'IT 102-'], ['-', ''], ['IS 1', 'IS-']]) assert.equal(sameCode(a, b), false, `${a} / ${b}`);
  const r = report({ code: 'IT 204', prereq: 'IT 202' }, { code: 'IT-204-', prereq: 'IT 202' });
  assert.equal(r.critical, false); assert.deepEqual(checkOf(r, 'CUR-CODE', 'meta.code').evidence, { actual: 'IT 204', expected: 'IT-204-' });
});

test('a hyphen at the end of a code is ignored inside a pre-requisite too', () => {
  for (const [a, b] of [['IT ELEC1, 3rd Yr', 'IT-ELEC1-, 3rd Yr'], ['IT 102', 'IT 102-'], ['IT 102; IT 103', 'IT 102-; IT 103-'], ['IT 102 and IT 103', 'IT 102- and IT 103-']]) assert.equal(samePrerequisite(a, b), true, `${a} / ${b}`);
  for (const [a, b] of [['IT ELEC1', 'IT-ELEC1-, 3rd Yr'], ['IT ELEC2, 3rd Yr', 'IT-ELEC1-, 3rd Yr'], ['', 'IS-']]) assert.equal(samePrerequisite(a, b), false, `${a} / ${b}`);
});

test('the generator does not take a two-letter code for a piece of another word', () => {
  const masters = { curricula: [{ courses: [
    { code: 'IS-', title: 'INTEGRATING SEMINAR', yearLevel: 4, semester: '2nd Semester' },
    { code: 'IT-ELEC1-', title: 'ELECTIVE 1', yearLevel: 3, semester: '1st Semester' },
    { code: 'IT-ELEC2', title: 'ELECTIVE 2', yearLevel: 3, semester: '2nd Semester' },
  ] }] };
  const pre = prereq => G.subjectOf({ meta: { code: 'IT-ELEC2', prereq, title: 'Elective 2', program: 'X' } }, masters, '').prerequisiteSubjects;
  assert.deepEqual(pre('IT-ELEC1-, 3rd Yr'), ['ELECTIVE 1']);
  assert.deepEqual(pre('IT ELEC1, 3rd Yr'), ['ELECTIVE 1']);
  assert.equal(pre('[Not specified in the source curriculum (blank prerequisite cell).]'), undefined, '"IS" is inside "prerequisite"');
  assert.equal(pre('Discrete Mathematics'), undefined);
});

// BSIT prints "IT-204" Computer Programming 2, Cybersecurity "IT-204-" Quantitative Methods: two subjects of two programs whose codes now read the same.
test('a subject is looked for in its own program only, and another subject under the same code is still stopped by its title', () => {
  const c = JSON.parse(JSON.stringify(sample().content));
  Object.assign(c.meta, { program: 'CYBER', curriculumYear: '', code: 'IT 204', title: 'COMPUTER PROGRAMMING 2', prereq: 'IT 202' });
  const units = { lecture: Number(c.meta.lecture), lab: Number(c.meta.lab), yearLevel: Number(c.meta.yearLevel) };
  const curricula = [{ id: 1, program: 'CYBER', status: 'approved', curriculumYear: 'x', courses: [{ code: 'IT-204-', title: 'QUANTITATIVE METHODS', prereq: 'IT 202', ...units }] }];
  const otherCurricula = [{ program: 'BSIT', curriculumYear: 'x', courses: [{ code: 'IT-204', title: 'COMPUTER PROGRAMMING 2' }] }];
  const r = coded(c, { curricula, otherCurricula, programCodes: ['CYBER'] });
  assert.equal(checkOf(r, 'CUR-CODE', 'meta.code').evidence.expected, 'IT-204-');
  assert.equal(checkOf(r, 'CUR-FIELD', 'meta.title').status, 'FAIL');
  assert.ok(r.findings.some(f => f.path === 'meta.title' && f.severity === 'blocking'), 'submitting stays blocked');
});
