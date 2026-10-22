'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ops = require('./formOps');

const form = () => ({
  description: [{ id: 'd1', t: 'Short.' }],
  reqs: [{ id: 'q1', t: '1. Attend' }, { id: 'q2', t: 'Quizzes' }],
  plan: [
    { id: 'r3', kind: 'lesson', week: '3', ilos: [{ id: 'i3', text: '', tags: [] }, { id: 'i3b', text: 'Write loops', tags: [] }], contents: 'Loops', activities: '', tasks: '' },
    { id: 'r1', kind: 'lesson', week: '1', ilos: [{ id: 'i1', text: 'Explain variables', tags: [] }], contents: 'Variables', activities: '- Lecture', tasks: '- Quiz' },
  ],
  grading: { rows: [{ id: 'g1', label: 'Class Standing', pct: 60 }, { id: 'g2', label: 'Exam', pct: 50 }] },
});

test('set writes a field found by key or by id, and the undo puts it back', () => {
  const c = form();
  const undo = ops.applyOps(c, [{ op: 'set', path: 'plan[id=r1].tasks', value: '- Quiz 1' }, { op: 'set', path: 'grading.rows[id=g2].pct', value: 40 }]);
  assert.equal(c.plan[1].tasks, '- Quiz 1');
  assert.equal(c.grading.rows[1].pct, 40);
  assert.deepEqual(ops.applyOps(c, undo) && c, form());
});

test('the description is text for the author and paragraphs in the form; an existing paragraph keeps its id', () => {
  const c = form();
  const undo = ops.applyOps(c, [{ op: 'set', path: 'description', value: 'One.\nTwo.' }]);
  assert.deepEqual(c.description, [{ id: 'd1', t: 'One.' }, { t: 'Two.' }]);
  ops.applyOps(c, undo);
  assert.deepEqual(c.description, form().description);
});

test('insert, remove and sort work on the plan by id, and each can be undone', () => {
  const c = form();
  const exam = { id: 'x1', kind: 'exam', week: '6', ilos: [], contents: '**PRELIM EXAMINATION**', activities: '- Examination', tasks: '', values: '' };
  const undo = ops.applyOps(c, [
    { op: 'insert', path: 'plan', beforeId: 'r1', value: exam },
    { op: 'remove', path: 'plan[id=r3].ilos[id=i3]' },
    { op: 'sortPlan' },
  ]);
  assert.deepEqual(c.plan.map((r) => r.id), ['r1', 'r3', 'x1']);
  assert.deepEqual(c.plan[1].ilos.map((i) => i.id), ['i3b']);
  assert.deepEqual(ops.applyOps(c, undo) && c, form());
});

test('an operation that cannot be done leaves the form untouched', () => {
  const c = form();
  assert.equal(ops.applyOps(c, [{ op: 'set', path: 'reqs[id=q1].t', value: 'ok' }, { op: 'set', path: 'plan[id=nope].tasks', value: 'x' }]), null);
  assert.deepEqual(c, form());
  assert.equal(ops.applyOps(c, [{ op: 'insert', path: 'plan', value: { id: 'r1' } }]), null); // that id is taken
  assert.equal(ops.applyOps(c, [{ op: 'remove', path: 'plan' }]), null);
  assert.equal(ops.applyOps(c, [{ op: 'explode' }]), null);
  assert.equal(ops.applyOps(c, [{ op: 'set', path: 'bad path', value: 1 }]), null);
});

test('holds is true only while the form has the text a suggestion was written for', () => {
  const c = form();
  assert.equal(ops.holds(c, [{ path: 'reqs[id=q1].t', value: '1.  ATTEND ' }]), true);
  assert.equal(ops.holds(c, [{ path: 'reqs[id=q1].t', value: 'Something else' }]), false);
  assert.equal(ops.holds(c, [{ path: 'grading.rows[id=g1].pct', value: 60 }]), true);
  assert.equal(ops.holds(c, [{ path: 'description', value: 'Short.' }]), true);
  assert.equal(ops.holds(c, [{ path: 'plan[id=gone].tasks', value: '' }]), false);
  assert.equal(ops.holds(c, []), true);
});
