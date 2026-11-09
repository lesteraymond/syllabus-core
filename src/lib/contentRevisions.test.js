import test from 'node:test';
import assert from 'node:assert/strict';
import { baseRevisionsFor, nextKnown, isRevisionProblem } from './contentRevisions.js';

// The client half of the mandatory revision contract: what a tab sends with a save, and what it remembers afterwards.
const known = { meta: 'm1', description: 'd1', clos: 'c1', plan: 'p1', reqs: 'r1', refs: 'f1', grading: 'g1', outcomes: 'o1' };

test('a save sends the revision of every section it saves, and only those', () => {
  assert.deepEqual(baseRevisionsFor(known, { plan: [], reqs: [] }), { plan: 'p1', reqs: 'r1' });
  assert.deepEqual(baseRevisionsFor(known, { description: [] }), { description: 'd1' });
});

test('a section this tab has no revision for is sent without one (the server then refuses it if it has content), never with an invented one', () => {
  assert.deepEqual(baseRevisionsFor({ plan: 'p1' }, { plan: [], reqs: [] }), { plan: 'p1' });
  assert.equal(baseRevisionsFor(undefined, { plan: [] }), undefined, 'a tab that knows nothing sends no base: only legitimate for a draft it has just created');
});

test('after a successful save the tab adopts the saved sections\' revisions and keeps the others as they were, so another author\'s change is never hidden', () => {
  const after = nextKnown(known, { plan: [] }, { revisions: { plan: 'p2', reqs: 'r-OTHER-TAB', meta: 'm1' } });
  assert.equal(after.plan, 'p2');
  assert.equal(after.reqs, 'r1', 'reqs was changed by someone else: this tab still holds the older revision, so its next save of reqs is refused');
  assert.notEqual(after, known, 'the remembered object is not mutated');
  assert.equal(known.plan, 'p1');
});

test('sections the server derived from this save are adopted; nothing else is', () => {
  const after = nextKnown(known, { description: [] }, { revisions: { description: 'd2', clos: 'c2', plan: 'p-OTHER' }, derivedSections: ['clos'] });
  assert.equal(after.description, 'd2');
  assert.equal(after.clos, 'c2');
  assert.equal(after.plan, 'p1');
});

test('a tab that created the draft adopts every saved revision; a response without revisions changes nothing', () => {
  assert.deepEqual(nextKnown(undefined, { description: [] }, { revisions: { description: 'd1', plan: 'none' } }), { description: 'd1', plan: 'none' });
  assert.equal(nextKnown(known, { plan: [] }, {}), known);
  assert.equal(nextKnown(known, { plan: [] }, undefined), known);
});

test('the two refusals are recognised, and nothing else is', () => {
  const err = (status, code) => Object.assign(new Error('x'), { status, data: { code } });
  assert.equal(isRevisionProblem(err(409, 'revision_conflict')), true);
  assert.equal(isRevisionProblem(err(428, 'revision_required')), true);
  assert.equal(isRevisionProblem(err(409, undefined)), false, 'a locked syllabus is also 409 but is not a revision problem');
  assert.equal(isRevisionProblem(err(409, 'syllabus_exists')), false);
  assert.equal(isRevisionProblem(err(428, 'revision_conflict')), false);
  assert.equal(isRevisionProblem(new Error('network')), false);
  assert.equal(isRevisionProblem(null), false);
});
