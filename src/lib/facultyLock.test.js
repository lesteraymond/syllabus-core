import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Source checks (the builder is React, not run here): faculty never type the subject's term or the Vision, Mission, EGA and PO.
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('the builder locks the term and the standards for everyone but an administrator, whether or not the administrator filled them in', () => {
  const index = read('../views/builder2/index.jsx');
  assert.match(index, /const termLocked = !!user && user\.role !== 'admin' && load\.editable;/);
  assert.match(index, /const standardsLocked = termLocked;/);
  assert.ok(index.includes('lockTerm={termLocked}'));
  const info = read('../views/builder2/InfoStep.jsx');
  for (const field of ['readOnly={lockTerm || lock.yearLevel}', 'readOnly={lockTerm || lock.prereq}']) assert.ok(info.includes(field), field);
  assert.ok(info.includes('max="4"'), 'year level is 1 to 4, as on the server');
});

test('Add subject only picks an existing program; a new program is made with the Add program button', () => {
  const page = read('../views/CourseOutcomes.jsx');
  assert.ok(!page.includes('programName') && !page.includes('ac-programs'), 'no typed program name or code in the subject form');
  assert.ok(page.includes('<AddProgramForm') && page.includes('programs.addButton'));
  const form = read('../components/AddProgramForm.jsx');
  assert.ok(form.includes('outcomesApi.createProgram(') && form.includes('<SubjectSetup'), 'the program form holds the Vision, Mission, EGA and PO form and creates the program');
});
