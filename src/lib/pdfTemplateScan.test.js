import test from 'node:test';
import assert from 'node:assert/strict';
import { scanTemplate, isBlank } from './pdfTemplateScan.js';

const full = { code: 'CPE 101', title: 'Logic', description: 'About logic.', prereq: '', credits: '3', clos: 'CLO1. x', plan: 'Week 1 | ...', reqs: 'Quiz', refs: 'Book', grading: '60/40' };

test('a filled template passes even with an empty pre-requisite', () => {
  const r = scanTemplate(full);
  assert.equal(r.ok, true);
  assert.deepEqual(r.missing, []);
  assert.equal(r.items.find((i) => i.key === 'prereq').optional, true);
});

test('any other empty section blocks', () => {
  const r = scanTemplate({ ...full, refs: '  ', grading: '' });
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ['refs', 'grading']);
});

test('placeholder text counts as empty', () => {
  for (const v of ['TBA', 'N/A', '-', '...', 't.b.d.', 'none']) assert.equal(isBlank(v), true, v);
  assert.equal(isBlank('None of the above apply'), false);
  assert.deepEqual(scanTemplate({ ...full, description: 'TBA' }).missing, ['description']);
});

test('a plan table needs one week with content, activities and tasks', () => {
  assert.deepEqual(scanTemplate(full, [{ week: '1', contents: 'Intro', activities: '', tasks: 'Quiz' }]).missing, ['plan']);
  assert.equal(scanTemplate(full, [{ week: '1', contents: 'Intro', activities: 'Lecture', tasks: 'Quiz' }]).ok, true);
});
