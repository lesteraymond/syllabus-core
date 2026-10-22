import test from 'node:test';
import assert from 'node:assert/strict';
import { searchAll } from './searchView.js';

const s = (id, userId, faculty, courseCode, courseTitle, status = 'approved') => ({ id, userId, faculty, courseCode, courseTitle, status, programCode: 'BSIT' });
const rows = [s(1, 10, 'Juan Santos', 'IT 101', 'Intro to Computing'), s(2, 10, 'Juan Santos', 'IT 102', 'Programming 1'), s(3, 11, 'Diana Evale', 'FM 202', 'Financial Math'), s(4, 11, 'Diana Evale', 'IT 103', 'Hidden draft', 'draft')];

test('every word must match, in any order and any case', () => {
  assert.deepEqual(searchAll('computing it', rows, { role: 'admin' }).syllabi.map((x) => x.id), [1]);
  assert.deepEqual(searchAll('  SANTOS ', rows, { role: 'admin' }).syllabi.map((x) => x.id), [1, 2]);
  assert.deepEqual(searchAll('zzz', rows, { role: 'admin' }), { syllabi: [], faculty: [], subjects: [] });
  assert.deepEqual(searchAll('', rows, { role: 'admin' }).syllabi, []);
});

test('an administrator also finds faculty and subjects, and never a draft', () => {
  const r = searchAll('diana', rows, { role: 'admin' });
  assert.deepEqual(r.faculty, [{ userId: 11, name: 'Diana Evale', count: 1 }]);
  assert.deepEqual(searchAll('hidden', rows, { role: 'admin' }).syllabi, []);
  assert.deepEqual(searchAll('IT 10', rows, { role: 'admin' }).subjects.map((x) => x.code), ['IT 101', 'IT 102']);
});

test('a faculty member or student only gets syllabi', () => {
  const r = searchAll('santos', rows, { role: 'faculty' });
  assert.equal(r.syllabi.length, 2);
  assert.deepEqual([r.faculty, r.subjects], [[], []]);
});

test('the list is capped', () => {
  assert.equal(searchAll('it', rows, { role: 'admin', limit: 1 }).syllabi.length, 1);
});
