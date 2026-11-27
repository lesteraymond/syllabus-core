// The official course-title comparison: spacing and hyphens never make a different title, anything else still does; and a field the administrator sets on the
// subject is never offered to the author as a change they can apply. Run: npm test.
const test = require('node:test');
const assert = require('node:assert/strict');
const { titleDecision, titleRelation, titleDecisionChanged, sameTitle } = require('./titles');
const { coded } = require('./engine');
const { sample } = require('./fixtures');

const SAME = [
  ['COMPUTER PROGRAMMING 2 (INTERMEDIATE PROGRAMMING)', 'COMPUTER PROGRAMMING 2(INTERMEDIATE PROGRAMMING)'],
  ['IT ELECTIVE 1 (INTRO. TO DATA SCIENCE IN PYTHON)', 'IT ELECTIVE 1 (INTRO.TO DATA SCIENCE IN PYTHON)'],
  ['SOSYEDAD AT LITERATURANG/PANITIKANG PANLIPUNAN', 'SOSYEDAD AT LITERATURANG/ PANITIKANG PANLIPUNAN'],
  ['COMPUTER  PROGRAMMING 1 ', 'COMPUTER PROGRAMMING 1'],
  ['INTRODUCTION TO HUMAN-COMPUTER INTERACTION', 'INTRODUCTION TO HUMAN COMPUTER INTERACTION'],
  ['COMPUTER PROGRAMMING 1', 'COMPUTER PROGRAMMING 1'],
];
const DIFFERENT = [
  ['DATA STRUCTURES AND ALGORITHM', 'DATA STRUCTURE AND ALGORITHM'],
  ['COMPUTER PROGRAMMING 1', 'COMPUTER PROGRAMMING 2'],
  ['COMPUTER PROGRAMMING 2', 'COMPUTER PROGRAMMING 2(INTERMEDIATE PROGRAMMING)'],
  ['Computer Programming 1', 'COMPUTER PROGRAMMING 1'], // letter case is the normalized policy's, which is not active
  ['COMPUTERPROGRAMMING 1', 'COMPUTER PROGRAMMING 1'],
  ['', 'COMPUTER PROGRAMMING 1'],
];

test('spacing and hyphens do not make a different title; words, numbers, letter case and a missing part do', () => {
  for (const [a, b] of SAME) { assert.equal(sameTitle(a, b), true, `${a} / ${b}`); assert.equal(titleDecision('exact', a, b), true, a); assert.equal(titleDecision('normalized', a, b), true, a); }
  for (const [a, b] of DIFFERENT) { assert.equal(sameTitle(a, b), false, `${a} / ${b}`); assert.equal(titleDecision('exact', a, b), false, a); }
  assert.equal(titleDecision('normalized', 'Computer Programming 1', 'COMPUTER PROGRAMMING 1'), true, 'the normalized policy still folds letter case');
  assert.equal(titleRelation('COMPUTER PROGRAMMING 2', 'COMPUTER PROGRAMMING 2(INTERMEDIATE PROGRAMMING)').relation, 'subtitle');
  assert.equal(titleRelation(...SAME[0]).relation, 'case_or_space');
});

test('a stored report whose title now passes is out of date; one whose title still fails is not', () => {
  const report = (actual, expected, status) => ({ hybrid: { codedChecks: [{ ruleId: 'CUR-FIELD', path: 'meta.title', status, evidence: { actual, expected } }] } });
  assert.equal(titleDecisionChanged(report(...SAME[0], 'FAIL'), {}), true);
  assert.equal(titleDecisionChanged(report(...DIFFERENT[0], 'FAIL'), {}), false);
  assert.equal(titleDecisionChanged(report('A', 'A', 'PASS'), {}), false);
});

function check(entered, official, adminMeta) {
  const { content, masters } = sample();
  content.meta.title = entered; masters.curricula[0].courses[0].title = official;
  const r = coded(content, adminMeta ? { ...masters, adminMeta } : masters);
  return { finding: r.findings.find(f => f.ruleId === 'CUR-FIELD' && f.path === 'meta.title'), suggestion: r.suggestions.find(s => s.path === 'meta.title'), status: r.checks.find(c => c.ruleId === 'CUR-FIELD' && c.path === 'meta.title').status };
}

test('CUR-FIELD: a title that differs only in spacing passes and needs no recommendation', () => {
  const r = check(...SAME[0]);
  assert.deepEqual([r.status, r.finding, r.suggestion], ['PASS', undefined, undefined]);
});

test('CUR-FIELD: a different title still blocks; when the administrator set it on the subject, the author is told who corrects it and gets nothing to apply', () => {
  const free = check(...DIFFERENT[0]);
  assert.equal(free.finding.severity, 'blocking'); assert.equal(free.suggestion.replacement, 'DATA STRUCTURE AND ALGORITHM', 'a title the author may change is still offered');
  const locked = check(...DIFFERENT[0], { title: 'DATA STRUCTURES AND ALGORITHM' });
  assert.equal(locked.finding.severity, 'blocking', 'same severity');
  assert.equal(locked.suggestion, undefined, 'applying it would do nothing: every save restores the subject\'s title');
  assert.match(locked.finding.message, /title differs from the official curriculum/); assert.match(locked.finding.message, /"DATA STRUCTURE AND ALGORITHM"/); assert.match(locked.finding.message, /administrator/);
  const renamed = check(...DIFFERENT[0], { title: 'DATA STRUCTURE AND ALGORITHM' });
  assert.equal(renamed.suggestion.replacement, 'DATA STRUCTURE AND ALGORITHM', 'the subject is corrected already: applying (or saving) brings it into the draft');
});

test('the same holds for a pre-requisite and a year level the administrator set, and not for the units', () => {
  const { content, masters } = sample();
  Object.assign(content.meta, { prereq: 'IT 999', yearLevel: '4', lecture: '9' });
  const r = coded(content, { ...masters, adminMeta: { prereq: 'IT 999', yearLevel: '4' } });
  assert.deepEqual(r.suggestions.filter(s => s.path.startsWith('meta.')).map(s => s.path), ['meta.lecture']);
  for (const path of ['meta.prereq', 'meta.yearLevel']) assert.match(r.findings.find(f => f.path === path).message, /administrator/, path);
});
