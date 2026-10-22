'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./fixtures');
const standard = require('./standard-v4.json');
const { evaluate } = require('./rules');

const run = (c) => evaluate(c, standard, F.ctx());
const found = (c, id) => run(c).findings.filter((f) => f.ruleId === id);
const lessons = (c) => c.plan.filter((r) => r.kind === 'lesson');

test('a clean syllabus has no duplicate finding and keeps its full score', () => {
  const r = run(F.good());
  assert.equal(r.overall, 100);
  assert.deepEqual(r.findings.filter((f) => /^D-/.test(f.ruleId)), []);
});

test('D-01: the same ILO in two weeks, and a near-copy, are found; a different ILO is not', () => {
  const c = F.good();
  const [a, b, d] = lessons(c);
  b.ilos[0].text = a.ilos[0].text;
  const f = found(c, 'D-01');
  assert.equal(f.length, 1);
  assert.equal(f[0].path, 'plan[' + c.plan.indexOf(b) + '].ilos[0]');
  assert.match(f[0].message, /has the same ILO as Week 1/);
  a.ilos[0].text = 'Explain how a class groups the data and the behaviour of an object in a Java program';
  d.ilos[0].text = 'Explain how a class groups the data and the behaviour of an object in a Java application';
  assert.ok(found(c, 'D-01').some((x) => x.path === 'plan[' + c.plan.indexOf(d) + '].ilos[0]'), 'one changed word is still a copy');
  d.ilos[0].text = 'Write a constructor that sets the initial state of a new object';
  assert.ok(!found(c, 'D-01').some((x) => x.path === 'plan[' + c.plan.indexOf(d) + '].ilos[0]'));
});

test('D-02: the same content, activities or task in two lessons; short text and exam rows are left alone', () => {
  const c = F.good();
  const [a, b] = lessons(c);
  a.contents = '**Introduction to classes and objects in Java**';
  b.activities = a.activities;
  b.contents = a.contents;
  const f = found(c, 'D-02');
  assert.deepEqual(f.map((x) => x.path.split('.').pop()).sort(), ['activities', 'contents']);
  assert.match(f.find((x) => /activities/.test(x.path)).message, /learning activities is the same as in Week 1/);
  const short = F.good();
  lessons(short).forEach((r) => { r.tasks = '- Quiz'; });
  assert.deepEqual(found(short, 'D-02'), []);
  const exams = F.good();
  exams.plan.filter((r) => r.kind === 'exam').forEach((r) => { r.activities = '- Written examination on the topics of this term'; });
  assert.deepEqual(found(exams, 'D-02'), []);
});

test('D-03: a lesson whose activities and task are the same text', () => {
  const c = F.good();
  const a = lessons(c)[0];
  a.tasks = a.activities;
  const f = found(c, 'D-03');
  assert.equal(f.length, 1);
  assert.match(f[0].message, /the learning activities and the assessment task are the same text/);
});

test('D-04: a requirement listed twice, even with other punctuation', () => {
  const c = F.good();
  c.reqs.push({ id: 'dup', t: c.reqs[0].t.toUpperCase() + '.' });
  const f = found(c, 'D-04');
  assert.equal(f.length, 1);
  assert.equal(f[0].path, 'reqs[' + (c.reqs.length - 1) + ']');
  assert.match(f[0].message, /repeats requirement 1/);
});

test('D-05: a reference listed twice, in the same group or another', () => {
  const c = F.good();
  const first = c.refs.books.items[0].t;
  c.refs.online.items.push({ id: 'dup', t: first });
  c.refs.online.na = false;
  const f = found(c, 'D-05');
  assert.equal(f.length, 1);
  assert.equal(f[0].path, 'refs.online.items[' + (c.refs.online.items.length - 1) + ']');
});

test('D-06: a grading component named twice', () => {
  const c = F.good();
  c.grading.rows.push({ id: 'g9', label: ' ' + c.grading.rows[0].label.toLowerCase() + ' ', pct: 0 });
  assert.equal(found(c, 'D-06').length, 1);
});

test('D-07: a description that repeats a sentence or copies a CLO', () => {
  const c = F.good();
  c.description = [{ id: 'd1', t: 'This course teaches students how to write programs in Java. This course teaches students how to write programs in Java. It has labs.' }];
  assert.match(found(c, 'D-07')[0].message, /repeats a sentence/);
  const d = F.good();
  d.description = [{ id: 'd1', t: 'In this course, ' + d.clos[0].statement + ' Students also practise in the laboratory.' }];
  d.clos[0].statement = 'Explain the concepts of object-oriented programming using correct Java terminology';
  d.description[0].t = 'In this course students learn to ' + d.clos[0].statement.toLowerCase() + '. Students also practise in the laboratory.';
  assert.match(found(d, 'D-07')[0].message, /copies the statement of CLO 1 word for word/);
});

test('duplicates cost a few points, never block a submit, and point at the right step', () => {
  const c = F.good();
  const [a, b] = lessons(c);
  b.ilos[0].text = a.ilos[0].text;
  c.reqs.push({ id: 'dup', t: c.reqs[0].t });
  const r = run(c);
  const area = r.areas.find((x) => x.key === 'completeness');
  assert.ok(area.score < 100 && area.score > 80, String(area.score));
  assert.ok(r.overall > 90, String(r.overall));
  assert.equal(r.conformance.ok, true);
  assert.deepEqual([...new Set(r.findings.filter((f) => /^D-/.test(f.ruleId)).map((f) => f.step))].sort(), ['plan', 'reqs']);
});
