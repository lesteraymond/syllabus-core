// Run: npm test
import test from 'node:test';
import assert from 'node:assert';
import { hasUnsaved, mergeCatalog, sameSet } from './assignmentSync.js';

const P = (id) => ({ id, code: 'P' + id, name: 'Program ' + id });
const C = (id, program = 'P1') => ({ id, code: 'S' + id, title: 'Subject ' + id, program });
const sel = (progs, courses, focusId = 1) => ({ progSel: new Set(progs), courseSel: new Set(courses), focusId });

test('a subject created elsewhere appears, unticked, and the admin\'s ticks are untouched', () => {
  const m = mergeCatalog({ programs: [P(1), P(2)], courses: [C(10), C(11), C(12)] }, sel([1], [10, 11]));
  assert.deepStrictEqual(m.courses.map((c) => c.id), [10, 11, 12]);
  assert.deepStrictEqual([...m.courseSel], [10, 11]); // 12 is new and not ticked
  assert.deepStrictEqual([...m.progSel], [1]);
});

test('unsaved ticks survive a refresh (they are never reset to the saved state)', () => {
  const m = mergeCatalog({ programs: [P(1)], courses: [C(10), C(11)] }, sel([1], [11])); // the admin ticked 11 and unticked 10
  assert.deepStrictEqual([...m.courseSel], [11]);
});

test('a subject or program that no longer exists is dropped from the ticks', () => {
  const m = mergeCatalog({ programs: [P(1)], courses: [C(10)] }, sel([1, 2], [10, 11]));
  assert.deepStrictEqual([...m.progSel], [1]);
  assert.deepStrictEqual([...m.courseSel], [10]);
});

test('the focused program stays focused, or falls back to the first one when it was removed', () => {
  assert.equal(mergeCatalog({ programs: [P(1), P(2)], courses: [] }, sel([], [], 2)).focusId, 2);
  assert.equal(mergeCatalog({ programs: [P(1), P(3)], courses: [] }, sel([], [], 2)).focusId, 1);
  assert.equal(mergeCatalog({ programs: [], courses: [] }, sel([], [], 2)).focusId, null);
});

test('a refresh does not mutate the selection it was given', () => {
  const s = sel([1], [10]);
  mergeCatalog({ programs: [P(1)], courses: [] }, s);
  assert.deepStrictEqual([...s.courseSel], [10]);
});

test('unsaved changes are detected by comparing with what was loaded', () => {
  const saved = sel([1], [10]);
  assert.equal(hasUnsaved(saved, sel([1], [10])), false);
  assert.equal(hasUnsaved(saved, sel([1], [10, 11])), true);
  assert.equal(hasUnsaved(saved, sel([], [10])), true);
  assert.equal(sameSet(new Set([1, 2]), new Set([2, 1])), true);
});
