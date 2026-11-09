import test from 'node:test';
import assert from 'node:assert/strict';
import { yearUsage, yearOptionLabel, ADD_YEAR, noFilters, filtersActive, termFiltersActive, filterSubjects, emptyTerm, termFrom, termComplete, termSet, termBody, termLine, lockedFields, anyLocked, subjectSetUp, prerequisiteOf, YEAR_LEVELS, SEMESTER_OPTIONS, semesterKey, CURRICULUM_NONE, normalizeCurriculumYear, curriculumYearOptions, curriculumYearChoices, CURRICULUM_RANGE } from './subjectTerm.js';
import { emptyDraft, applyCourse, clearCourse } from './syllabusModel.js';

let n = 0;
const newId = () => 'st' + (++n);
const course = (term) => ({ id: 5, code: 'IT 204', title: 'Programming 2', program: { code: 'BSIT' }, clos: [], ...(term ? { term } : {}) });
const TERM = { academicYear: '2026–2027', semester: '2nd Semester', yearLevel: 2, prerequisite: 'IT 202 - Programming 1' };

test('year levels are 1 to 4 and semesters are the first, the second and the summer term', () => {
  assert.deepEqual(YEAR_LEVELS, [1, 2, 3, 4]);
  assert.deepEqual(SEMESTER_OPTIONS.map((s) => s.value), ['1st Semester', '2nd Semester', 'Summer']);
  assert.deepEqual(SEMESTER_OPTIONS.map((s) => semesterKey(s.value)), ['deadline.sem.first', 'deadline.sem.second', 'deadline.sem.summer'], 'each is shown with its own label (Summer was shown as "2nd Semester" before)');
  assert.equal(semesterKey('3rd Semester'), '', 'an unknown value has no label key: it is shown as stored');
});

test('a term form is complete only with all four fields, and the API body carries a numeric year level', () => {
  assert.equal(termComplete(emptyTerm()), false);
  assert.equal(termComplete({ academicYear: '2026–2027', semester: '1st Semester', yearLevel: '3', prerequisite: 'None' }), true);
  for (const missing of ['academicYear', 'semester', 'yearLevel']) assert.equal(termComplete({ academicYear: '2026–2027', semester: '1st Semester', yearLevel: '3', prerequisite: 'None', [missing]: '' }), false, missing);
  assert.equal(termComplete({ academicYear: '2026–2027', semester: '1st Semester', yearLevel: '3', prerequisite: '' }), true, 'the pre-requisite is optional: many subjects have none');
  assert.equal(termComplete({ academicYear: '2026–2027', semester: '1st Semester', yearLevel: '5', prerequisite: 'None' }), false, 'year level 5 does not exist');
  assert.equal(termComplete({ academicYear: '2026–2027', semester: '1st Semester', yearLevel: '3', prerequisite: '   ' }), true, 'a blank pre-requisite is none');
  assert.deepEqual(lockedFields({ academicYear: '2026–2027', semester: '1st Semester', yearLevel: 3, prerequisite: null }).prereq, true, 'a set-up subject owns its pre-requisite even when it has none ("None")');
  assert.deepEqual(termBody({ academicYear: '2026–2027', semester: '1st Semester', yearLevel: '3', prerequisite: ' None ' }), { academicYear: '2026–2027', semester: '1st Semester', yearLevel: 3, prerequisite: 'None' });
  assert.deepEqual(termFrom(TERM), { academicYear: '2026–2027', semester: '2nd Semester', yearLevel: '2', prerequisite: 'IT 202 - Programming 1' });
  assert.deepEqual(termFrom(null), emptyTerm());
});

test('the term line reads academic year, semester and year level, and is empty when the subject has none', () => {
  const t = (key, v) => (key === 'term.line' ? `${v.year} | ${v.semester} | ${v.level}` : key);
  assert.equal(termLine(TERM, t, (s) => s.toUpperCase()), '2026–2027 | 2ND SEMESTER | 2');
  assert.equal(termLine({ academicYear: null, semester: null, yearLevel: null, prerequisite: null }, t), '');
  assert.equal(termLine(undefined, t), '');
  assert.equal(termSet(TERM), true);
  assert.equal(termSet({ academicYear: null, semester: null, yearLevel: null, prerequisite: null }), false);
});

test('only what the administrator set is locked for faculty', () => {
  assert.deepEqual(lockedFields(TERM), { prereq: true, yearLevel: true, academicYear: true, semester: true });
  assert.deepEqual(lockedFields({ prerequisite: 'None', yearLevel: null }), { prereq: true, yearLevel: false, academicYear: false, semester: false });
  assert.equal(anyLocked(undefined), false);
  assert.equal(anyLocked({ academicYear: null, semester: null, yearLevel: null, prerequisite: null }), false);
});

test('choosing a subject fills the pre-requisite, year level, academic year and semester; a subject without a term keeps what was typed', () => {
  const typed = emptyDraft(newId); typed.meta.prereq = 'Typed'; typed.meta.yearLevel = '4';
  const noTerm = applyCourse(typed, course());
  assert.deepEqual([noTerm.meta.prereq, noTerm.meta.yearLevel, noTerm.meta.academicYear, noTerm.meta.semester], ['Typed', '4', undefined, undefined]);
  const filled = applyCourse(typed, course(TERM));
  assert.deepEqual([filled.meta.prereq, filled.meta.yearLevel, filled.meta.academicYear, filled.meta.semester], ['IT 202 - Programming 1', '2', '2026–2027', '2nd Semester']);
  assert.equal(typed.meta.prereq, 'Typed', 'the input draft is not mutated');
  const empty = applyCourse(typed, course({ academicYear: null, semester: null, yearLevel: null, prerequisite: null }));
  assert.equal(empty.meta.prereq, 'Typed', 'an empty term changes nothing');
});

// Same rule as the server (server/lib/subjectTerm.js setUp): the automatic academic-year stamp alone is not a set-up, so no "None" is invented and Step 1
// stays editable; a subject set up without a pre-requisite shows (and locks) "None".
test('the academic-year stamp alone neither invents "None" nor locks the pre-requisite', () => {
  const stampOnly = { academicYear: '2026–2027', semester: null, yearLevel: null, prerequisite: null };
  assert.equal(subjectSetUp(stampOnly), false); assert.equal(prerequisiteOf(stampOnly), null);
  assert.equal(lockedFields(stampOnly).prereq, false, 'faculty may still type it');
  const typed = emptyDraft(newId); typed.meta.prereq = 'ZZ 100 - Prerequisite';
  assert.equal(applyCourse(typed, course(stampOnly)).meta.prereq, 'ZZ 100 - Prerequisite');
  const setUpNone = { ...stampOnly, semester: '1st Semester', yearLevel: 1 };
  assert.equal(subjectSetUp(setUpNone), true); assert.equal(prerequisiteOf(setUpNone), 'None'); assert.equal(lockedFields(setUpNone).prereq, true);
  assert.equal(applyCourse(typed, course(setUpNone)).meta.prereq, 'None');
  assert.equal(prerequisiteOf({ ...setUpNone, prerequisite: 'IT 101' }), 'IT 101');
});

test('unchoosing the subject drops its academic year and semester but leaves what faculty typed', () => {
  const d = applyCourse(emptyDraft(newId), course(TERM));
  const cleared = clearCourse(d);
  assert.deepEqual([cleared.meta.academicYear, cleared.meta.semester, cleared.meta.courseId], [undefined, undefined, null]);
});

const S = (id, program, term) => ({ id, code: 'C' + id, title: 'T' + id, program, term });
const T = (academicYear, semester, yearLevel) => ({ academicYear, semester, yearLevel, prerequisite: 'None' });
const NONE = { academicYear: null, semester: null, yearLevel: null, prerequisite: null };
const SUBJECTS = [S(1, 'BSIT', T('2026–2027', '1st Semester', 1)), S(2, 'BSIT', T('2026–2027', '2nd Semester', 2)), S(3, 'BSIT', T('2027–2028', '2nd Semester', 3)), S(4, 'BSIE', T('2027–2028', '2nd Semester', 3)), S(5, 'BSIE', NONE), S(6, 'BSIT')];
const ids = (list) => list.map((c) => c.id);
const f = (patch) => ({ ...noFilters(), ...patch });

test('no filters keeps every subject, with or without a term', () => {
  assert.deepEqual(ids(filterSubjects(SUBJECTS, noFilters())), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(ids(filterSubjects(SUBJECTS)), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(filterSubjects(undefined, noFilters()), []);
  assert.equal(filtersActive(noFilters()), false);
});

test('each filter on its own: program, academic year, semester, year level', () => {
  assert.deepEqual(ids(filterSubjects(SUBJECTS, f({ program: 'BSIE' }))), [4, 5], 'a program filter keeps a subject that has no term');
  assert.deepEqual(ids(filterSubjects(SUBJECTS, f({ academicYear: '2027–2028' }))), [3, 4]);
  assert.deepEqual(ids(filterSubjects(SUBJECTS, f({ semester: '2nd Semester' }))), [2, 3, 4]);
  assert.deepEqual(ids(filterSubjects(SUBJECTS, f({ yearLevel: '3' }))), [3, 4], 'the dropdown value is a string, the stored level a number');
  assert.deepEqual(ids(filterSubjects(SUBJECTS, f({ yearLevel: 3 }))), [3, 4]);
});

test('filters combine: every one that is set must match', () => {
  assert.deepEqual(ids(filterSubjects(SUBJECTS, f({ program: 'BSIT', academicYear: '2027–2028' }))), [3]);
  assert.deepEqual(ids(filterSubjects(SUBJECTS, f({ academicYear: '2026–2027', semester: '2nd Semester' }))), [2]);
  assert.deepEqual(ids(filterSubjects(SUBJECTS, f({ academicYear: '2027–2028', semester: '2nd Semester', yearLevel: '3' }))), [3, 4]);
  assert.deepEqual(ids(filterSubjects(SUBJECTS, f({ program: 'BSIT', academicYear: '2027–2028', semester: '2nd Semester', yearLevel: '3' }))), [3]);
  assert.deepEqual(ids(filterSubjects(SUBJECTS, f({ academicYear: '2026–2027', yearLevel: '3' }))), [], 'nothing matches: an empty list, not an error');
});

test('a subject without a term matches only while no term filter is set', () => {
  for (const patch of [{ academicYear: '2026–2027' }, { semester: '1st Semester' }, { yearLevel: '1' }]) assert.ok(!ids(filterSubjects(SUBJECTS, f(patch))).some((id) => id === 5 || id === 6), JSON.stringify(patch));
  assert.deepEqual(ids(filterSubjects(SUBJECTS, f({ program: 'BSIT' }))), [1, 2, 3, 6]);
  assert.equal(termFiltersActive(f({ program: 'BSIT' })), false);
  assert.equal(termFiltersActive(f({ yearLevel: '2' })), true);
  assert.equal(filtersActive(f({ program: 'BSIT' })), true);
});

test('unknown values match nothing and the input list is not changed', () => {
  const before = JSON.stringify(SUBJECTS);
  assert.deepEqual(filterSubjects(SUBJECTS, f({ academicYear: '1999–2000' })), []);
  assert.deepEqual(filterSubjects(SUBJECTS, f({ yearLevel: '9' })), []);
  assert.equal(JSON.stringify(SUBJECTS), before);
});

test('yearUsage counts the subjects of each academic year, ignores subjects without a term, and can leave one subject out', () => {
  assert.deepEqual(yearUsage(SUBJECTS), { '2026–2027': 2, '2027–2028': 2 });
  assert.deepEqual(yearUsage(SUBJECTS, 1), { '2026–2027': 1, '2027–2028': 2 }, 'the subject being edited does not make its own year used');
  assert.deepEqual(yearUsage([]), {});
  assert.deepEqual(yearUsage(undefined), {});
  assert.deepEqual(yearUsage([S(7, 'BSIT')]), {});
});

test('the academic year option says whether the year is used: not used yet, one subject, many subjects', () => {
  const t = (key, v) => ({ 'years.notUsed': 'not used yet', 'years.inUseOne': 'in use by 1 subject', 'years.inUse': 'in use by ' + (v && v.count) + ' subjects' })[key];
  assert.equal(yearOptionLabel('2027–2028', 0, t), '2027–2028 · not used yet');
  assert.equal(yearOptionLabel('2026–2027', 1, t), '2026–2027 · in use by 1 subject');
  assert.equal(yearOptionLabel('2026–2027', 3, t), '2026–2027 · in use by 3 subjects');
  assert.ok(ADD_YEAR && !/^[0-9]{4}/.test(ADD_YEAR), 'the add option can never be mistaken for a year');
});

// A subject's curriculum year: its own filter, independent of the term filters, with "not set" for subjects that have none.
test('the curriculum year filter: one year, the subjects without one, and combined with the program and term filters', () => {
  const list = [
    { id: 1, program: 'BSIT', curriculumYear: '2022-2023', term: { academicYear: '2026–2027', semester: '1st Semester', yearLevel: 1 } },
    { id: 2, program: 'BSIT', curriculumYear: '2025-2026', term: { academicYear: '2026–2027', semester: '2nd Semester', yearLevel: 1 } },
    { id: 3, program: 'BSIE', curriculumYear: '2022-2023', term: null },
    { id: 4, program: 'BSIE', curriculumYear: null, term: null },
  ];
  const f = (patch) => ({ ...noFilters(), ...patch });
  const ids = (rows) => rows.map((r) => r.id);
  assert.equal(noFilters().curriculumYear, '');
  assert.equal(filtersActive(f({ curriculumYear: '2022-2023' })), true);
  assert.equal(termFiltersActive(f({ curriculumYear: '2022-2023' })), false, 'not a term filter: a subject without a term can still match it');
  assert.deepEqual(ids(filterSubjects(list, f({ curriculumYear: '2022-2023' }))), [1, 3]);
  assert.deepEqual(ids(filterSubjects(list, f({ curriculumYear: CURRICULUM_NONE }))), [4]);
  assert.deepEqual(ids(filterSubjects(list, f({ curriculumYear: '2022-2023', program: 'BSIE' }))), [3]);
  assert.deepEqual(ids(filterSubjects(list, f({ curriculumYear: '2022-2023', semester: '1st Semester' }))), [1]);
  assert.deepEqual(ids(filterSubjects(list, f({ curriculumYear: '2018-2019' }))), []);
  assert.deepEqual(ids(filterSubjects(list, noFilters())), [1, 2, 3, 4], 'no filter: every subject, with or without a curriculum year');
});

test('curriculum years are normalized like the server does and offered newest first without duplicates', () => {
  assert.equal(normalizeCurriculumYear('2022–2023'), '2022-2023');
  assert.equal(normalizeCurriculumYear(' 2022 - 2023 '), '2022-2023');
  for (const bad of ['2022', '2022-2024', '', null, 'abc']) assert.equal(normalizeCurriculumYear(bad), null, String(bad));
  assert.deepEqual(curriculumYearOptions([{ curriculumYear: '2022-2023' }, { curriculumYear: null }, { curriculumYear: '2022-2023' }], ['2025-2026', '2022–2023', 'junk']), ['2025-2026', '2022-2023']);
  assert.deepEqual(curriculumYearOptions(undefined), []);
  assert.ok(!normalizeCurriculumYear(CURRICULUM_NONE), 'the "not set" option can never be mistaken for a year');
});

test('the curriculum year dropdown offers recent curricula, the ones in use, the approved ones (marked) and the current value, newest first', () => {
  const choices = curriculumYearChoices({ thisYear: 2026, inUse: ['2001-2002'], approved: ['2022–2023', 'junk'], value: '1998-1999' });
  const values = choices.map((c) => c.value);
  assert.equal(values[0], '2027-2028', 'next year\'s curriculum is offered');
  assert.ok(values.includes(`${2026 - CURRICULUM_RANGE}-${2027 - CURRICULUM_RANGE}`) && !values.includes(`${2025 - CURRICULUM_RANGE}-${2026 - CURRICULUM_RANGE}`), 'the range reaches back CURRICULUM_RANGE years');
  assert.ok(values.includes('2001-2002') && values.includes('1998-1999'), 'older years in use and the current value are kept');
  assert.deepEqual(values, [...values].sort((a, b) => b.localeCompare(a)), 'newest first');
  assert.equal(new Set(values).size, values.length, 'no duplicates');
  assert.deepEqual(choices.filter((c) => c.approved).map((c) => c.value), ['2022-2023'], 'only the approved reference is marked');
  assert.ok(values.every((v) => normalizeCurriculumYear(v) === v), 'every choice is a valid, normalized curriculum year');
});
