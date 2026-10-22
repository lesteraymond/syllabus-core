import test from 'node:test';
import assert from 'node:assert/strict';
import { trial, applyAll, loadRejected, saveRejected } from './suggestionView.js';

const form = () => ({
  reqs: [{ id: 'q1', t: '1. Attend' }],
  plan: [{ id: 'r1', kind: 'lesson', week: '1', ilos: [{ id: 'i1', text: 'Learn loops', tags: [] }], contents: 'Loops', activities: '', tasks: '' }],
  grading: { rows: [{ id: 'g1', label: 'A', pct: 60 }, { id: 'g2', label: 'B', pct: 50 }] },
});
const text = { id: 'a1', expect: [{ path: 'reqs[id=q1].t', value: '1. Attend' }], ops: [{ op: 'set', path: 'reqs[id=q1].t', value: 'Attend' }] };
const lesson = { id: 'a2', expect: [{ path: 'plan[id=r1].tasks', value: '' }], ops: [{ op: 'set', path: 'plan[id=r1].tasks', value: '- Quiz' }] };
const grading = { id: 'a3', expect: [{ path: 'grading.rows[id=g2].pct', value: 50 }], ops: [{ op: 'set', path: 'grading.rows[id=g2].pct', value: 40 }] };

test('trial says whether a suggestion still fits, without changing the form', () => {
  const c = form();
  const t = trial(c, text);
  assert.equal(t.ok, true);
  assert.deepEqual(c, form());
  c.reqs[0].t = 'Something the author typed since';
  assert.deepEqual(trial(c, text), { ok: false });
  assert.deepEqual(trial(form(), { ...text, ops: [{ op: 'set', path: 'reqs[id=gone].t', value: 'x' }] }), { ok: false });
});

test('applyAll applies those that fit, skips the rest, and each has its own undo', () => {
  const c = form();
  c.plan[0].tasks = 'already written';
  const done = applyAll(c, [text, lesson, grading]);
  assert.deepEqual(done.map((d) => d.id), ['a1', 'a3']);
  assert.equal(c.reqs[0].t, 'Attend');
  assert.equal(c.plan[0].tasks, 'already written');
  assert.equal(c.grading.rows[1].pct, 40);
});

test('rejections are remembered per syllabus and survive a broken store', () => {
  const store = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; })();
  saveRejected(7, new Set(['a1', 'b2']), store);
  assert.deepEqual([...loadRejected(7, store)], ['a1', 'b2']);
  assert.deepEqual([...loadRejected(8, store)], []);
  assert.deepEqual([...loadRejected(7, { getItem: () => { throw new Error('blocked'); } })], []);
  assert.doesNotThrow(() => saveRejected(7, new Set(['x']), { setItem: () => { throw new Error('blocked'); } }));
});
