'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { planImport, canonicalCode, isGeneral, prerequisiteText } = require('./curriculumImport');
const real = require('../db/curriculum-data');

const sub = (code, title, prereq = [], units = { lecture: 3, lab: 0 }) => ({ year: 1, term: '1', code, title, prereq, units });
const data = (programs) => ({ programs });
const empty = { programs: [], courses: [] };
const byCode = (plan, code) => plan.courses.find((c) => c.code === code);
const links = (plan, key) => plan.prerequisites.find((p) => p.key === key).items;

test('codes are written one way, and general education is not a subject of the catalog', () => {
  assert.equal(canonicalCode('IT-204'), 'IT 204');
  assert.equal(canonicalCode('IT 102-'), 'IT 102');
  assert.equal(canonicalCode('CpE-300'), 'CpE 300');
  assert.equal(canonicalCode('CAPSPRO1'), 'CAPSPRO 1');
  assert.equal(canonicalCode('IT-ELEC1'), 'IT-ELEC1');
  assert.equal(canonicalCode('TECHPREN-CITE'), 'TECHPREN-CITE');
  ['GE - US', 'GE - ELECT KOMFIL', 'PATHFit 3', 'NSTP 1', 'TH 4'].forEach((c) => assert.equal(isGeneral(c), true, c));
  ['IT 101', 'CENGDIS', 'TECHPREN-CITE', 'ENGDA', 'MA 7', 'PHYENG', 'CHEMENG'].forEach((c) => assert.equal(isGeneral(c), false, c));
});

test('subjects are created under their program, and a prerequisite is a link when it is a subject and a label when it is not', () => {
  const plan = planImport(data([{ code: 'BSIT', name: 'BS IT', suffix: 'IT', subjects: [sub('IT 101', 'Intro'), sub('IT 102', 'Discrete', ['IT 101']), sub('IT-ELEC1', 'Elective', ['3rd Yr', 'TH 4', 'IT 102'])] }]), empty);
  assert.deepEqual(plan.programs, [{ code: 'BSIT', name: 'BS IT', exists: false, id: null }]);
  assert.deepEqual(plan.courses.map((c) => [c.code, c.action]), [['IT 101', 'create'], ['IT 102', 'create'], ['IT-ELEC1', 'create']]);
  assert.deepEqual(links(plan, 'new:BSIT|IT 102'), [{ label: 'IT 101', target: 'new:BSIT|IT 101' }]);
  assert.deepEqual(links(plan, 'new:BSIT|IT-ELEC1'), [{ label: '3rd Yr', target: null }, { label: 'TH 4', target: null }, { label: 'IT 102', target: 'new:BSIT|IT 102' }]);
});

test('a subject with no prerequisite says None', () => {
  const plan = planImport(data([{ code: 'A', name: 'A', subjects: [sub('IT 101', 'Intro')] }]), empty);
  assert.deepEqual(links(plan, 'new:A|IT 101'), [{ label: 'None', target: null }]);
});

test('every program gets its own list: the same code in two programs is two subjects, each with its own prerequisites', () => {
  const plan = planImport(data([
    { code: 'A', name: 'A', subjects: [sub('IS-CITE', 'Integrating Seminar', ['4th Yr']), sub('IT 204', 'Programming 2')] },
    { code: 'B', name: 'B', subjects: [sub('IS-CITE', 'Integrating Seminar', []), sub('IT 204', 'Quantitative Methods'), sub('CS 301', 'Forensics', ['IT 204'])] },
  ]), empty);
  assert.deepEqual(plan.courses.map((c) => c.key), ['new:A|IS-CITE', 'new:A|IT 204', 'new:B|IS-CITE', 'new:B|IT 204', 'new:B|CS 301']);
  assert.deepEqual(links(plan, 'new:A|IS-CITE'), [{ label: '4th Yr', target: null }]);
  assert.deepEqual(links(plan, 'new:B|IS-CITE'), [{ label: 'None', target: null }]);
  assert.deepEqual(links(plan, 'new:B|CS 301'), [{ label: 'IT 204', target: 'new:B|IT 204' }]); // the program's own IT 204, not A's
});

test('existing subjects: the same code in the same program is retitled, another program\'s subject is left alone', () => {
  const existing = {
    programs: [{ id: 1, code: 'BSIT', name: 'IT' }],
    courses: [
      { id: 10, code: 'IT101', title: 'Introduction to Computing', programCode: 'BSIT' },
      { id: 11, code: 'IT102', title: 'Computer Programming 1', programCode: 'BSIT' },
      { id: 12, code: 'IT 302', title: 'History of IE', programCode: 'BSIE' },
    ],
  };
  const plan = planImport(data([{ code: 'BSIT', name: 'IT', subjects: [sub('IT 101', 'Introduction to Computing'), sub('IT 102', 'Discrete Mathematics', ['IT 101']), sub('IT 302', 'Information Management 1')] }]), existing);
  assert.equal(plan.programs[0].exists, true);
  assert.equal(plan.courses.find((c) => c.id === 10).action, 'unchanged');
  const retitled = plan.courses.find((c) => c.id === 11);
  assert.deepEqual([retitled.action, retitled.oldTitle, retitled.newTitle, retitled.code], ['update', 'Computer Programming 1', 'Discrete Mathematics', 'IT102']);
  assert.equal(plan.courses.find((c) => c.id === 12), undefined); // BSIE's IT 302 is a different subject
  assert.equal(byCode(plan, 'IT 302').action, 'create'); // and BSIT's own IT 302 is added next to it
  assert.deepEqual(links(plan, 'db:11'), [{ label: 'IT 101', target: 'db:10' }]);
});

test('a subject an earlier import added with a program suffix gets its printed code back', () => {
  const existing = { programs: [{ id: 2, code: 'BSIT-CS', name: 'CS' }], courses: [{ id: 20, code: 'IT 202-CS', title: 'System Integration and Architecture 1', programCode: 'BSIT-CS' }] };
  const plan = planImport(data([{ code: 'BSIT-CS', name: 'CS', subjects: [sub('IT 202', 'System Integration and Architecture 1')] }]), existing);
  const c = plan.courses.find((x) => x.id === 20);
  assert.deepEqual([c.action, c.oldCode, c.newCode, c.code], ['update', 'IT 202-CS', 'IT 202', 'IT 202']);
  assert.equal(c.newTitle, undefined);
  assert.equal(plan.courses.length, 1);
});

test('importing twice changes nothing the second time', () => {
  const programs = [{ code: 'BSIT', name: 'IT', subjects: [sub('IT 204', 'Programming 2')] }, { code: 'BSIT-CS', name: 'CS', subjects: [sub('IT 204', 'Quantitative Methods', ['IT 204'])] }];
  const first = planImport(data(programs), empty);
  let id = 100;
  const existing = { programs: first.programs.map((p) => ({ id: ++id, code: p.code, name: p.name })), courses: first.courses.map((c) => ({ id: ++id, code: c.code, title: c.title, programCode: c.programCode })) };
  const second = planImport(data(programs), existing);
  assert.deepEqual(second.programs.map((p) => p.exists), [true, true]);
  assert.ok(second.courses.every((c) => c.action === 'unchanged'), JSON.stringify(second.courses));
});

test('prerequisite text lists the current code of a linked subject, or the printed label, or None', () => {
  assert.equal(prerequisiteText([]), null); // nobody has set them: the form is left alone
  assert.equal(prerequisiteText([{ label: 'None' }]), 'None');
  assert.equal(prerequisiteText([{ code: 'IT 202', title: 'Computer Programming 1', label: 'IT 202' }, { label: '3rd Yr' }]), 'IT 202 – Computer Programming 1; 3rd Yr');
  assert.equal(prerequisiteText([{ code: 'CS 304', title: 'Cybersecurity and Data Privacy: Law, Policies, and Practices' }]), 'CS 304 – Cybersecurity and Data Privacy: Law, Policies, and Practices');
});

test('the real curricula: four programs, codes unique within each program, and each prerequisite is a subject of its own program or a general-education label', () => {
  const plan = planImport(real, empty);
  assert.deepEqual(plan.programs.map((p) => p.code), ['BSIT', 'BSIT-CS', 'BSCPE', 'BSIE']);
  const keys = plan.courses.map((c) => c.programCode + '|' + c.code);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(plan.courses.length, real.programs.reduce((n, p) => n + p.subjects.filter((s) => !isGeneral(canonicalCode(s.code))).length, 0));
  // The subjects asked about are in BSIE; the shared ones are in every program that prints them.
  const inProgram = (p) => new Set(plan.courses.filter((c) => c.programCode === p).map((c) => c.code));
  ['MA 7', 'PHYENG', 'PRIECO', 'EMEC', 'FUNELC-IE', 'COMPRO', 'ENGEC', 'IMAP', 'STATIE2', 'OR 1', 'IOAM', 'ACC1-IE', 'IE 301', 'ENGBOHS', 'TECHPREN-CITE', 'IE 302', 'ACC2-IE', 'OR 2', 'ERGO 1', 'ERGO 2', 'IE-ELEC1', 'IE-ELEC2', 'IE-ELEC3', 'IS-CITE', 'CAD'].forEach((c) => assert.ok(inProgram('BSIE').has(c), c + ' is in BSIE'));
  ['TECHPREN-CITE', 'IS-CITE', 'IT-PRAC'].forEach((c) => ['BSIT', 'BSIT-CS'].forEach((p) => assert.ok(inProgram(p).has(c), c + ' is in ' + p)));
  assert.ok(inProgram('BSIT').has('IT 202') && inProgram('BSIT-CS').has('IT 202') && !inProgram('BSIT-CS').has('IT 202-CS'));
  const allowed = /^(None|\d(st|nd|rd|th) Yr|GE - [A-Z]+|PATHFit \d|NSTP \d|TH \d)$/;
  plan.prerequisites.forEach((p) => p.items.forEach((it) => { if (!it.target) assert.match(it.label, allowed, 'an unresolved prerequisite: ' + it.label); }));
  const keySet = new Set(plan.courses.map((c) => c.key));
  plan.prerequisites.forEach((p) => p.items.forEach((it) => {
    if (!it.target) return;
    assert.ok(keySet.has(it.target));
    assert.notEqual(it.target, p.key);
    assert.equal(it.target.split('|')[0], p.key.split('|')[0], 'a link stays inside its program'); // new:BSIT|IT 101 -> new:BSIT|...
  }));
  const link = (code, prog) => links(plan, 'new:' + prog + '|' + code).map((i) => i.label).join(',');
  assert.equal(link('IT 302', 'BSIT'), 'IT 202');
  assert.equal(link('CpE 309', 'BSCPE'), 'CpE 301,ENGDA,GE - PC');
  assert.equal(link('IE 403', 'BSIE'), 'IE 302,OR 1');
  assert.equal(link('CAPCYB 1', 'BSIT-CS'), 'CS 303,CS 304,CS 301');
  assert.equal(link('IMAP', 'BSIE'), 'CHEMENG,PHYENG');
  assert.equal(links(plan, 'new:BSIE|IMAP').every((i) => i.target), true); // now links to BSIE's CHEMENG and PHYENG
});

test('every subject of the real curricula has credit units, matching the photos at the spots checked', () => {
  const plan = planImport(real, empty);
  assert.equal(plan.units.length, real.programs.reduce((n, p) => n + p.subjects.filter((s) => !isGeneral(canonicalCode(s.code))).length, 0));
  assert.ok(plan.units.every((u) => Number.isFinite(u.lecture) && Number.isFinite(u.lab) && u.lecture >= 0 && u.lab >= 0 && u.lecture <= 6 && u.lab <= 2));
  // Spot checks against the photos (each semester's printed total was used to place the rows).
  const of = (key) => plan.units.find((u) => u.key === key);
  assert.deepEqual([of('new:BSIT|IT 202').lecture, of('new:BSIT|IT 202').lab], [2, 1]);
  assert.deepEqual([of('new:BSIT|IT 101').lecture, of('new:BSIT|IT 101').lab], [3, 0]);
  assert.deepEqual([of('new:BSIT|OFFTOOLS').lecture, of('new:BSIT|OFFTOOLS').lab], [0, 1]);
  assert.deepEqual([of('new:BSIT|IT-PRAC').lecture, of('new:BSIT|IT-PRAC').lab], [6, 0]);
  assert.deepEqual([of('new:BSIT-CS|IT-ELEC1').lecture, of('new:BSIT-CS|IT-ELEC1').lab], [0, 1]); // not the same as BSIT's IT-ELEC1
  assert.deepEqual([of('new:BSIE|CapsPro-IE').lecture, of('new:BSIE|CapsPro-IE').lab], [1, 2]);
});
