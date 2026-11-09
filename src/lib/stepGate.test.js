// Run: npm test. The administrator's "Strict format validation" switch in the builder (src/lib/stepGate.js): who completes the steps in order.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stepsGated, POLICY_UNKNOWN } from './stepGate.js';

test('Strict format validation ON: faculty editing their syllabus complete the steps in order', () => {
  assert.equal(stepsGated({ editable: true, role: 'faculty', strict: true }), true);
});

test('Strict format validation OFF: faculty open any step', () => {
  assert.equal(stepsGated({ editable: true, role: 'faculty', strict: false }), false);
});

test('the administrator is never held to the order, and neither is a read-only syllabus or a reviewer', () => {
  for (const strict of [true, false]) {
    assert.equal(stepsGated({ editable: true, role: 'admin', strict }), false, 'admin, strict ' + strict);
    assert.equal(stepsGated({ editable: false, role: 'faculty', strict }), false, 'read-only, strict ' + strict);
    for (const role of ['asst_vpaa', 'lic_director', 'vpaa']) assert.equal(stepsGated({ editable: true, role, strict }), false, role);
  }
});

test('until the setting is known (or if it cannot be read) the strict order applies: a missing answer never unlocks more', () => {
  assert.equal(POLICY_UNKNOWN.strictValidation, true);
  assert.equal(POLICY_UNKNOWN.loaded, false);
  assert.equal(stepsGated({ editable: true, role: 'faculty', strict: POLICY_UNKNOWN.strictValidation }), true);
  assert.equal(stepsGated({ editable: true, role: 'faculty', strict: undefined }), true, 'no value: strict');
});
