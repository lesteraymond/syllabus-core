'use strict';
// The vision, mission, EGAs and POs an administrator set on a subject are constants for its syllabi (lib/syllabusOutcomes.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardsAreSet, forceStandards, validateOutcomes, blankOutcomes } = require('./syllabusOutcomes');

const ADMIN_SET = { vision: 'Admin vision', mission: { lead: 'Admin lead', items: ['m1', 'm2'] }, egas: [{ no: 1, name: 'EGA one', short: 'E1' }], pos: [{ no: 1, short: 'P1', text: 'PO one', egas: [1] }], versions: { vision: 1 } };

test('standards count as set once the administrator filled anything in', () => {
  assert.equal(standardsAreSet(null), false);
  assert.equal(standardsAreSet(blankOutcomes()), false);
  assert.equal(standardsAreSet({ ...blankOutcomes(), vision: '  ' }), false);
  assert.equal(standardsAreSet({ ...blankOutcomes(), vision: 'x' }), true);
  assert.equal(standardsAreSet(ADMIN_SET), true);
});

test('a faculty copy is replaced by the administrator values; the CLOs are left alone', () => {
  const content = { outcomes: { vision: 'My own', mission: { lead: 'mine', items: [] }, egas: [{ no: 1, name: 'changed', short: 'X' }, { no: 2, name: 'extra', short: 'Y' }], pos: [] }, clos: [{ id: 'c1', title: '', level: 'Enabling', statement: 's', egas: [1], pos: [1] }] };
  forceStandards(content.outcomes, ADMIN_SET);
  assert.deepEqual({ vision: content.outcomes.vision, mission: content.outcomes.mission, egas: content.outcomes.egas, pos: content.outcomes.pos }, { vision: ADMIN_SET.vision, mission: ADMIN_SET.mission, egas: ADMIN_SET.egas, pos: ADMIN_SET.pos });
  assert.notStrictEqual(content.outcomes.egas, ADMIN_SET.egas, 'a copy, never the catalog object itself');
  validateOutcomes(content.outcomes, content.clos, []); // the author's CLO mapping still holds against the forced EGAs and POs
});

test('a CLO mapped to an EGA the administrator does not have is refused after the override', () => {
  const content = { outcomes: { ...blankOutcomes() }, clos: [{ id: 'c1', title: '', level: 'Enabling', statement: 's', egas: [2], pos: [1] }] };
  forceStandards(content.outcomes, ADMIN_SET);
  assert.throws(() => validateOutcomes(content.outcomes, content.clos, []), /Invalid learning outcomes/);
});
