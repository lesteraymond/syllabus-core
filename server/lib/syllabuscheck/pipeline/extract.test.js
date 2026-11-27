'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../../compliance/fixtures');
const { extract, itemsOf, fingerprint } = require('./extract');

test('extract builds one map: course, masters, 4 CLOs with fixed levels, weeks, references', () => {
  const map = extract(F.good());
  assert.deepEqual(map.course, { code: 'IT 204', title: 'Computer Programming 2', program: 'BSIT', lectureUnits: 2, labUnits: 1, contactHoursPerWeek: 5 });
  assert.equal(map.masters.egas.length, 4);
  assert.equal(map.masters.pos.length, 5);
  assert.deepEqual(map.clos.map(c => c.requiredLevel), ['Introductory', 'Enabling', 'Demonstrating', 'Integration of Values']);
  assert.deepEqual(map.clos.map(c => c.savedLevel), ['Introductory', 'Introductory', 'Introductory', 'Introductory']);
  assert.equal(map.weeks.length, 18);
  assert.equal(map.weeks[5].kind, 'exam');
  assert.deepEqual(map.weeks[1].ilos[0].cloNos, [2]);
  assert.deepEqual(map.weeks[1].values.named, ['Courage']);
  assert.deepEqual(map.references.map(r => r.group), ['books', 'books', 'program', 'online']); // electronics is N/A
});

test('masters passed in win over the copy saved with the syllabus', () => {
  const map = extract(F.good(), { institution: { egas: [{ no: 1, name: 'Only' }] }, pos: [{ no: 9, text: 'P9', egas: [1] }] });
  assert.deepEqual(map.masters.egas.map(e => e.no), [1]);
  assert.deepEqual(map.masters.pos.map(p => p.no), [9]);
});

test('a Week 1 row about the course is orientation; blank ILOs are dropped; unknown CLO tags are kept apart', () => {
  const c = F.good();
  c.plan[0].contents = 'Course orientation: vision, mission, grading system and class policies';
  c.plan[1].ilos.push({ id: 'blank', text: '   ', tags: [] }, { id: 'ghost', text: 'Trace a loop', tags: ['clo:gone'] });
  const map = extract(c);
  assert.equal(map.weeks[0].kind, 'orientation');
  assert.equal(map.weeks[1].ilos.length, 2);
  assert.deepEqual(map.weeks[1].ilos[1].unknownClos, ['gone']);
  assert.deepEqual(map.weeks[1].ilos[1].cloNos, [null]);
});

test('itemsOf splits lines, bullets, numbering and semicolons', () => {
  assert.deepEqual(itemsOf('- Lecture\n* Pair programming\n\n1. Video walkthrough'), ['Lecture', 'Pair programming', 'Video walkthrough']);
  assert.deepEqual(itemsOf('Lecture; lab exercise; reflection'), ['Lecture', 'lab exercise', 'reflection']);
  assert.deepEqual(itemsOf(''), []);
});

test('the fingerprint ignores spacing and case but not wording', () => {
  assert.equal(fingerprint('Explain  loops'), fingerprint('explain loops '));
  assert.notEqual(fingerprint('Explain loops'), fingerprint('Explain arrays'));
});
