'use strict';
// The Admin saved new Program Outcomes but has not used "Apply to subjects" yet. A syllabus whose CLOs use POs is then refused by the checker
// (it holds the older statements), and the refusal must say that the administrator has to apply them: the faculty has nothing to adopt yet.
const test = require('node:test');
const assert = require('node:assert/strict');
const repo = require('./repository');
const courses = require('../courses');
const refs = require('../programPoReferences');

const OLD = [{ no: 1, text: 'Old statement.' }, { no: 2, text: 'Second.' }];
const NEW = [{ no: 1, text: 'New statement.' }, { no: 2, text: 'Second.' }];
const reference = { id: 'po-5-v2', outcomes: NEW };
const mapped = { meta: { courseId: 41 }, outcomes: { pos: OLD }, clos: [{ pos: [1] }] };
const subjectWith = (pos) => async () => ({ id: 41, standards: { pos } });

test('the stored syllabus is refused against the newer reference, as before', () => {
  assert.throws(() => refs.assertContentBasis(mapped, reference), (e) => e.status === 409 && /previous or unknown Program Outcome reference/.test(e.message));
});

test('a subject that still offers the older POs means the administrator has not applied the save', async (t) => {
  t.mock.method(courses, 'loadCourse', subjectWith(OLD));
  assert.equal(await repo.notAppliedToSubject({}, mapped, reference), true);
  assert.match(repo.PO_NOT_APPLIED, /has not applied them to this subject yet/);
  assert.match(repo.PO_NOT_APPLIED, /Apply to subjects/);
});

test('once applied, the subject offers the new POs and the faculty adopts them: the general refusal stays', async (t) => {
  t.mock.method(courses, 'loadCourse', subjectWith(NEW.map((p) => ({ ...p, short: 'P' + p.no, egas: [1] }))));
  assert.equal(await repo.notAppliedToSubject({}, mapped, reference), false, 'only the statements count, as in the reference basis');
});

test('no subject, no reference, or a subject that cannot be read: the general refusal stays', async (t) => {
  const load = t.mock.method(courses, 'loadCourse', subjectWith(OLD));
  assert.equal(await repo.notAppliedToSubject({}, { ...mapped, meta: {} }, reference), false);
  assert.equal(await repo.notAppliedToSubject({}, mapped, null), false);
  assert.equal(load.mock.callCount(), 0);
  t.mock.method(courses, 'loadCourse', async () => { throw Object.assign(new Error('refused'), { status: 409 }); });
  assert.equal(await repo.notAppliedToSubject({}, mapped, reference), false);
  t.mock.method(courses, 'loadCourse', async () => null);
  assert.equal(await repo.notAppliedToSubject({}, mapped, reference), false);
});

test('the faculty message is translated', async () => {
  const { tr, setLanguage } = await import('../../../src/i18n/index.js');
  setLanguage('tl');
  try { assert.notEqual(tr(repo.PO_NOT_APPLIED), repo.PO_NOT_APPLIED); } finally { setLanguage('en'); }
});
