'use strict';
// The subject rule (lib/subjectValidation.js), decided from the database rows. Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertValidSubject, MESSAGES } = require('./subjectValidation');

function conn({ subjects = { 10: { program_id: 1, code: 'BSIT', academic_year: '2026–2027' } }, aliases = [], current = '2026–2027' } = {}) {
  const asked = [];
  return {
    asked,
    query: async (sql, p) => {
      asked.push(sql.split(' ').slice(0, 4).join(' '));
      if (sql.startsWith('SELECT c.course_id AS subject_id')) { const x = subjects[p[0]]; return [x ? [{ subject_id: p[0], subject_code: 'IT ' + p[0], ...x }] : []]; }
      if (sql.startsWith('SELECT 1 FROM program_code_aliases')) return [aliases.filter((a) => a.program_id === p[0] && a.code === p[1])];
      if (sql.startsWith('SELECT label, start_year, is_current FROM academic_years')) return [[{ label: current, start_year: 2026, is_current: 1 }]];
      throw new Error('Unexpected query: ' + sql);
    },
  };
}
const syl = (over = {}) => ({ syllabus_id: 1, course_id: 10, academic_year: '2026–2027', ...over });
const form = (meta = {}) => ({ meta: { courseId: 10, program: 'BSIT', ...meta } });
const refused = (code, stage = 'submit') => (e) => e.status === 409 && e.body.code === code && e.message === MESSAGES[stage][code];

test('a valid subject passes: it exists, the form names it, and it belongs to the program and academic year', async () => {
  assert.equal((await assertValidSubject(conn(), syl(), form(), 'submit')).subject_id, 10);
  assert.equal((await assertValidSubject(conn(), syl(), form(), 'approve')).subject_id, 10);
});

test('no subject at all: course_id NULL, whatever the form says', async () => {
  await assert.rejects(assertValidSubject(conn(), syl({ course_id: null }), form(), 'submit'), refused('subject_required'));
  await assert.rejects(assertValidSubject(conn(), syl({ course_id: undefined }), form(), 'approve'), refused('subject_required', 'approve'));
});

test('a subject that does not exist, or was deleted, is no subject', async () => {
  await assert.rejects(assertValidSubject(conn(), syl({ course_id: 99 }), form({ courseId: 99 }), 'submit'), refused('subject_required'));
  await assert.rejects(assertValidSubject(conn({ subjects: {} }), syl(), form(), 'approve'), refused('subject_required', 'approve'));
});

test('the form must name this very subject: another id, or none, is a mismatch', async () => {
  await assert.rejects(assertValidSubject(conn(), syl(), form({ courseId: 11 }), 'submit'), refused('subject_mismatch'));
  await assert.rejects(assertValidSubject(conn(), syl(), { meta: {} }, 'submit'), refused('subject_mismatch'));
  await assert.rejects(assertValidSubject(conn(), syl(), null, 'approve'), refused('subject_mismatch', 'approve'));
});

test('a subject of another program is refused; an older code of the same program is not; a form without a program is judged by its subject', async () => {
  await assert.rejects(assertValidSubject(conn(), syl(), form({ program: 'BSIE' }), 'submit'), refused('subject_mismatch'));
  assert.ok(await assertValidSubject(conn({ aliases: [{ program_id: 1, code: 'BSINFOTECH' }] }), syl(), form({ program: 'bsinfotech' }), 'submit'));
  assert.ok(await assertValidSubject(conn(), syl(), form({ program: undefined }), 'submit'));
  assert.ok(await assertValidSubject(conn(), syl(), form({ program: ' bsit ' }), 'submit'));
});

test('a subject of another academic year is refused; a program with no year belongs to the current one', async () => {
  await assert.rejects(assertValidSubject(conn(), syl({ academic_year: '2027–2028' }), form(), 'submit'), refused('subject_mismatch'));
  await assert.rejects(assertValidSubject(conn(), syl({ academic_year: '2027–2028' }), form(), 'approve'), refused('subject_mismatch', 'approve'));
  const noYear = { subjects: { 10: { program_id: 1, code: 'BSIT', academic_year: null } } };
  assert.ok(await assertValidSubject(conn(noYear), syl(), form(), 'submit'));
  await assert.rejects(assertValidSubject(conn({ ...noYear, current: '2027–2028' }), syl(), form(), 'submit'), refused('subject_mismatch'));
  assert.ok(await assertValidSubject(conn(), syl({ academic_year: undefined }), form(), 'submit'), 'a database before the academic year scope has no syllabus year to compare');
});

test('the check reads and never writes, and a refusal happens before anything else is asked', async () => {
  const c = conn();
  await assert.rejects(assertValidSubject(c, syl({ course_id: null }), form(), 'submit'));
  assert.deepEqual(c.asked, []);
  const d = conn(); await assertValidSubject(d, syl(), form(), 'submit');
  assert.ok(d.asked.every((q) => q.startsWith('SELECT')));
});

test('the messages say what to do, at submission and at approval', () => {
  assert.match(MESSAGES.submit.subject_required, /Choose an existing subject in Step 1/);
  assert.match(MESSAGES.approve.subject_required, /cannot be approved\. Return it for revision/);
  assert.match(MESSAGES.approve.subject_mismatch, /does not match its program or academic year/);
});
