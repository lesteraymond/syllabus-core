'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('./rules');
const P = require('./prompt');
const G = require('./generate');
const T = require('./testSyllabus');
const { extract } = require('./extract');
const { questionsOf } = require('./judge');
const { check } = require('./check');

test('extract computes CHED contact hours (1 lec = 1 hr/wk, 1 lab = 3 hrs/wk)', () => {
  const labCourse = T.conforming();
  labCourse.meta.lecture = '2';
  labCourse.meta.lab = '1';
  assert.deepEqual(extract(labCourse).course, {
    code: 'IT 204', title: 'Computer Programming 2', program: 'BSIT',
    lectureUnits: 2, labUnits: 1, contactHoursPerWeek: 5,
  });

  const lecOnly = T.conforming();
  lecOnly.meta.lecture = '3';
  lecOnly.meta.lab = '0';
  assert.deepEqual(extract(lecOnly).course, {
    code: 'IT 204', title: 'Computer Programming 2', program: 'BSIT',
    lectureUnits: 3, labUnits: 0, contactHoursPerWeek: 3,
  });
});

test('LAB-ALIGNMENT is asked only when labUnits > 0, in the syllabus group, and costs 0 points', async () => {
  assert.equal(R.CHECKLISTS['LAB-ALIGNMENT'].scored, false);
  assert.equal(R.isManual('LAB-ALIGNMENT'), true);

  const labCourse = T.conforming();
  labCourse.meta.lecture = '2';
  labCourse.meta.lab = '1';
  const labQs = questionsOf(extract(labCourse)).filter(q => q.relationship === 'LAB-ALIGNMENT');
  assert.equal(labQs.length, 1);
  assert.equal(labQs[0].group, 'syllabus');
  assert.match(labQs[0].to[0].text, /2 lecture unit\(s\), 1 laboratory unit\(s\) \(5 contact hours\/week\)/);

  const lecOnly = T.conforming();
  lecOnly.meta.lecture = '3';
  lecOnly.meta.lab = '0';
  assert.equal(questionsOf(extract(lecOnly)).filter(q => q.relationship === 'LAB-ALIGNMENT').length, 0);

  // Failing LAB-ALIGNMENT produces advice with zero score deduction
  const failLab = q => (q.relationship === 'LAB-ALIGNMENT' ? {
    q: q.id,
    items: [{ id: 'activities', answer: 'no' }, { id: 'tasks', answer: 'no' }],
    quote: q.field.text.slice(0, 20),
    explanation: 'No laboratory or hands-on work is listed for this 1-unit lab course.',
  } : undefined);
  const res = await check(labCourse, null, { year: 2026, ask: T.scriptedJudge({ override: failLab }) });
  const item = res.judged.results.find(r => r.relationship === 'LAB-ALIGNMENT');
  assert.equal(item.status, 'advice');
  assert.equal(res.judged.deductions.total, 0);
  assert.equal(res.summary.misalignments, 0);
  assert.equal(res.summary.advice, 1);
});

test('both AI Checker and Syllabus Generator share the CHED credit-unit rule and contactHoursPerWeek', () => {
  assert.match(P.RULES_TEXT, /1 lecture unit = 1 contact hour\/week; 1 laboratory unit = 3 contact hours\/week/);
  assert.match(P.JUDGE_SYSTEM, /LAB-ALIGNMENT:/);
  assert.match(P.REWRITE_SYSTEM, /When labUnits > 0, include hands-on or laboratory work/);
  assert.match(G.SYSTEM, /1 lecture unit = 1 contact hour\/week; 1 laboratory unit = 3 contact hours\/week/);

  const subject = G.subjectOf({ meta: { code: 'IT 204', title: 'Computer Programming 2', program: 'BSIT', lecture: '2', lab: '1' } }, {}, '');
  assert.equal(subject.lectureUnits, '2');
  assert.equal(subject.labUnits, '1');
  assert.equal(subject.contactHoursPerWeek, 5);

  const adminMsg = G.adminMessage({ subject, tasks: [], clos: [], topics: [] });
  assert.match(adminMsg.user, /Laboratory component/);
  assert.match(adminMsg.user, /laboratory tools, software or equipment/);
});
