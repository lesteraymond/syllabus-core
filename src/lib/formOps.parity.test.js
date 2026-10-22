import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as client from './formOps.js';

// The same operations on the same form must give the same form and the same undo on the server (which scores a suggestion before it is
// shown) and in the builder (which applies it).
const server = createRequire(import.meta.url)('../../server/lib/compliance/formOps.js');

const form = () => ({
  description: [{ id: 'd1', t: 'Short.' }],
  reqs: [{ id: 'q1', t: '1. Attend' }],
  plan: [
    { id: 'r3', kind: 'lesson', week: '3', ilos: [{ id: 'i3', text: '', tags: [] }, { id: 'i3b', text: 'Write loops', tags: [] }], contents: 'Loops', activities: '', tasks: '' },
    { id: 'r1', kind: 'lesson', week: '1', ilos: [{ id: 'i1', text: 'Explain', tags: [] }], contents: 'V', activities: '- L', tasks: '- Q' },
  ],
  grading: { rows: [{ id: 'g1', label: 'A', pct: 60 }, { id: 'g2', label: 'B', pct: 50 }] },
});
const exam = { id: 'x1', kind: 'exam', week: '6', ilos: [], contents: '**PRELIM EXAMINATION**', activities: '- Examination', tasks: '', values: '' };
const sets = [
  [{ op: 'set', path: 'description', value: 'One.\nTwo.' }, { op: 'set', path: 'reqs[id=q1].t', value: 'Attend' }, { op: 'set', path: 'grading.rows[id=g2].pct', value: 40 }],
  [{ op: 'insert', path: 'plan', beforeId: 'r1', value: exam }, { op: 'remove', path: 'plan[id=r3].ilos[id=i3]' }, { op: 'sortPlan' }],
  [{ op: 'set', path: 'plan[id=zzz].tasks', value: 'x' }],
  [{ op: 'insert', path: 'plan', value: { id: 'r1' } }],
];

test('client and server apply the same operations to the same result and the same undo', () => {
  for (const ops of sets) {
    const a = form(); const b = form();
    const ua = client.applyOps(a, ops);
    const ub = server.applyOps(b, ops);
    assert.deepEqual(a, b);
    assert.deepEqual(ua, ub);
  }
});

test('client and server agree on whether a suggestion still holds', () => {
  const c = form();
  for (const expect of [[{ path: 'reqs[id=q1].t', value: '1. attend' }], [{ path: 'reqs[id=q1].t', value: 'No' }], [{ path: 'plan[id=none].tasks', value: '' }], [{ path: 'description', value: 'Short.' }]]) {
    assert.equal(client.holds(c, expect), server.holds(c, expect));
  }
});
