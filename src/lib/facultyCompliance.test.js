import test from 'node:test';
import assert from 'node:assert/strict';
import { facultyCompliance } from './facultyCompliance.js';

const s = (userId, faculty, status, code = 'IT1') => ({ userId, faculty, status, courseCode: code, courseTitle: 'Title ' + code });

test('submitted and approved syllabi count; drafts and returned ones do not', () => {
  const [f] = facultyCompliance([s(1, 'Ana', 'approved'), s(1, 'Ana', 'submitted'), s(1, 'Ana', 'under_review'), s(1, 'Ana', 'for_revision'), s(1, 'Ana', 'draft')]);
  assert.deepEqual([f.approved, f.waiting, f.returned, f.drafts, f.counted], [1, 2, 1, 1, 3]);
  assert.equal(f.compliant, true);
  assert.equal(f.pct, 100);
  assert.equal(f.subjects.length, 5);
});

test('a faculty member below the requirement is missing the rest', () => {
  const [f] = facultyCompliance([s(2, 'Ben', 'submitted'), s(2, 'Ben', 'draft')]);
  assert.deepEqual([f.compliant, f.missing, f.pct], [false, 1, 50]);
});

test('two people with the same name stay two entries', () => {
  assert.equal(facultyCompliance([s(1, 'Sam', 'approved'), s(2, 'Sam', 'approved')]).length, 2);
});
