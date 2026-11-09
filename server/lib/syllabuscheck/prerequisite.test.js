// "No pre-requisite" has one meaning in the curriculum check (prerequisite.js, CUR-FIELD meta.prereq / verdict CUR-07), and genuine differences are still found.
// Run: npm test.
const test = require('node:test');
const assert = require('node:assert/strict');
const { noPrerequisite, samePrerequisite, BLANK } = require('./prerequisite');
const { coded } = require('./engine');
const { sample } = require('./fixtures');

test('the ways of writing "no pre-requisite" are recognized, and nothing else is', () => {
  for (const v of [undefined, null, '', '   ', 'None', 'none', 'NONE', 'None.', ' N/A ', 'n/a', BLANK]) assert.equal(noPrerequisite(v), true, JSON.stringify(v));
  for (const v of ['IT 101', 'MA 7, MA 8', '4th Yr', 'Nonexistent', 'None of the above', 'IT-ELEC2, 4th Yr']) assert.equal(noPrerequisite(v), false, v);
});

test('two values match when they are identical, or when both say there is no pre-requisite', () => {
  assert.equal(samePrerequisite('IT 101', 'IT 101'), true);
  assert.equal(samePrerequisite('None', BLANK), true, 'a syllabus stating none does not differ from a curriculum that specifies none');
  assert.equal(samePrerequisite('', 'None'), true);
  assert.equal(samePrerequisite('N/A', 'None'), true);
  // genuine differences
  assert.equal(samePrerequisite('None', 'IT 101'), false, 'the curriculum requires one: missing it is a mismatch');
  assert.equal(samePrerequisite('IT 101', BLANK), false, 'naming a pre-requisite the curriculum does not have is a mismatch');
  assert.equal(samePrerequisite('IT 101', 'IT 102'), false);
  assert.equal(samePrerequisite('it 101', 'IT 101'), false, 'a real pre-requisite is still compared exactly, as before');
});

// The real engine, one subject, one approved curriculum row: only the pre-requisite (and once the lecture hours) differ between the cases.
function prereqCheck(entered, official, { lecture } = {}) {
  const c = JSON.parse(JSON.stringify(sample().content));
  Object.assign(c.meta, { program: 'ZZ', code: 'ZZ 1', curriculumYear: '', prereq: entered });
  const course = { code: 'ZZ 1', title: c.meta.title, prereq: official, lecture: lecture ?? Number(c.meta.lecture), lab: Number(c.meta.lab), yearLevel: Number(c.meta.yearLevel) };
  const report = coded(c, { curricula: [{ id: 1, program: 'ZZ', status: 'approved', curriculumYear: 'x', courses: [course] }], programCodes: ['ZZ'] });
  const at = (path) => report.checks.find((x) => x.ruleId === 'CUR-FIELD' && x.path === path);
  const finding = (path) => report.findings.find((x) => x.ruleId === 'CUR-FIELD' && x.path === path);
  return { status: at('meta.prereq').status, finding: finding('meta.prereq'), lecture: at('meta.lecture').status };
}

test('CUR-FIELD: a subject with no pre-requisite is valid against a curriculum that specifies none', () => {
  for (const [entered, official] of [['None', BLANK], ['None', 'None'], ['', BLANK], ['N/A', 'None']]) {
    const r = prereqCheck(entered, official);
    assert.equal(r.status, 'PASS', `${JSON.stringify(entered)} vs ${official}`); assert.equal(r.finding, undefined);
  }
});

test('CUR-FIELD: a matching pre-requisite passes', () => {
  assert.equal(prereqCheck('IT 101', 'IT 101').status, 'PASS');
  assert.equal(prereqCheck('MA 7, MA 8', 'MA 7, MA 8').status, 'PASS');
});

test('CUR-FIELD: a genuine pre-requisite mismatch is still found and still blocks', () => {
  for (const [entered, official] of [['None', 'IT 101'], ['', 'IT 101'], ['IT 101', BLANK], ['IT 101', 'IT 102']]) {
    const r = prereqCheck(entered, official);
    assert.equal(r.status, 'FAIL', `${JSON.stringify(entered)} vs ${official}`);
    assert.ok(r.finding && r.finding.severity === 'blocking', 'same severity as before');
  }
});

// The whole report for a named pre-requisite against a given official value.
function reportFor(entered, official) {
  const c = JSON.parse(JSON.stringify(sample().content));
  Object.assign(c.meta, { program: 'ZZ', code: 'ZZ 1', curriculumYear: '', prereq: entered });
  const course = { code: 'ZZ 1', title: c.meta.title, prereq: official, lecture: Number(c.meta.lecture), lab: Number(c.meta.lab), yearLevel: Number(c.meta.yearLevel) };
  return coded(c, { curricula: [{ id: 1, program: 'ZZ', status: 'approved', curriculumYear: 'x', courses: [course] }], programCodes: ['ZZ'] });
}

test('a blank curriculum cell is never offered as text for the syllabus; the finding explains it and asks for verification', () => {
  const r = reportFor('IT 101', BLANK), f = r.findings.find((x) => x.ruleId === 'CUR-FIELD' && x.path === 'meta.prereq');
  assert.ok(f && f.severity === 'blocking', 'still a blocking mismatch');
  assert.equal(r.suggestions.filter((s) => s.path === 'meta.prereq').length, 0, 'no replacement suggestion');
  assert.ok(!JSON.stringify(r.suggestions).includes(BLANK), 'the placeholder appears in no suggestion');
  assert.ok(!f.message.includes(BLANK), 'nor in the message');
  assert.match(f.message, /No pre-requisite is listed for this subject in the approved curriculum/);
  assert.match(f.message, /"IT 101"/); assert.match(f.message, /does not prove/); assert.match(f.message, /verify/);
  assert.equal(r.checks.find((x) => x.ruleId === 'CUR-FIELD' && x.path === 'meta.prereq').evidence.expected, BLANK, 'the evidence still records the reference exactly as stored');
});

test('the wording change touches nothing else: same status, severity and score as any other pre-requisite mismatch', () => {
  const blank = reportFor('IT 101', BLANK), other = reportFor('IT 101', 'IT 102');
  const pick = (r) => r.findings.filter((x) => x.ruleId === 'CUR-FIELD' && x.path === 'meta.prereq').map((x) => [x.severity, x.area, x.step]);
  assert.deepEqual(pick(blank), pick(other));
  assert.deepEqual([blank.base, blank.critical], [other.base, other.critical], 'the score does not depend on the wording or the suggestion');
  const s = other.suggestions.find((x) => x.path === 'meta.prereq');
  assert.ok(s && s.replacement === 'IT 102' && /differs from the official curriculum/.test(other.findings.find((x) => x.path === 'meta.prereq').message), 'a real official pre-requisite is still offered as the correction');
  assert.equal(reportFor('None', BLANK).findings.filter((x) => x.path === 'meta.prereq').length, 0, 'no pre-requisite against a blank cell is still valid (optional pre-requisite)');
});

test('the other curriculum fields are not loosened', () => {
  const r = prereqCheck('None', BLANK, { lecture: 99 });
  assert.equal(r.status, 'PASS'); assert.equal(r.lecture, 'FAIL', 'a lecture-hours difference is still a mismatch');
});
