import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePrereq, composePrereq, labelOf } from './prereqText.js';

const subjects = [
  { code: 'IT 202', title: 'Computer Programming 1 (Fundamentals of Programming)' },
  { code: 'CS 304', title: 'Cybersecurity and Data Privacy: Law, Policies, and Practices' },
  { code: 'CS 301', title: 'Introduction to Digital Forensics' },
];

test('the new text splits on semicolons, and a comma inside a subject name is not a separator', () => {
  const text = [labelOf(subjects[1]), labelOf(subjects[2]), '3rd Yr'].join('; ');
  assert.deepEqual(parsePrereq(text, subjects), [labelOf(subjects[1]), labelOf(subjects[2]), '3rd Yr']);
  assert.deepEqual(parsePrereq(labelOf(subjects[1]), subjects), [labelOf(subjects[1])]); // one subject, three commas in its name
});

test('older text with commas between bare codes is still read', () => {
  assert.deepEqual(parsePrereq('IT 202, 3rd Yr', subjects), ['IT 202', '3rd Yr']);
  assert.deepEqual(parsePrereq('CS 303, CS 304,CS 301', subjects), ['CS 303', 'CS 304', 'CS 301']);
  assert.deepEqual(parsePrereq('None', subjects), ['None']);
  assert.deepEqual(parsePrereq('', subjects), []);
  assert.deepEqual(parsePrereq(' ; , ', subjects), []);
});

test('without the program\'s subjects it falls back to separators, and compose uses semicolons', () => {
  assert.deepEqual(parsePrereq('IT 202 – Computer Programming 1; 3rd Yr', []), ['IT 202 – Computer Programming 1', '3rd Yr']);
  assert.equal(composePrereq(['IT 202 – Computer Programming 1', '3rd Yr']), 'IT 202 – Computer Programming 1; 3rd Yr');
  assert.equal(composePrereq([]), '');
});

test('a name matched in other letter case is still recognised', () => {
  assert.deepEqual(parsePrereq('cs 304 – cybersecurity and data privacy: law, policies, and practices; 4th Yr', subjects), ['cs 304 – cybersecurity and data privacy: law, policies, and practices', '4th Yr']);
});
