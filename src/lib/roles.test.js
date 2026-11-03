// Run: npm test. The review chain's roles, and that the screens and the server agree on them.
import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { ROLE_LABELS, STAGES, REVIEW_ROLES, STAFF_ROLES, isReviewer, isApprover, stageOf, roleAllows } from './roles.js';
const serverRoles = createRequire(import.meta.url)('../../server/lib/roles.js');

const everyRole = ['faculty', 'admin', 'asst_vpaa', 'lic_director', 'vpaa', 'student', 'unknown', undefined, null];

test('the screens and the server agree on who reviews, who approves and which stage a role clears', () => {
  assert.deepStrictEqual([...REVIEW_ROLES], serverRoles.REVIEW_ROLES);
  assert.deepStrictEqual([...STAFF_ROLES], serverRoles.STAFF_ROLES);
  assert.deepStrictEqual([...STAGES], serverRoles.STAGES);
  for (const role of everyRole) {
    const user = { id: 1, role };
    assert.strictEqual(isReviewer(role), serverRoles.isReviewer(user), String(role));
    assert.strictEqual(isApprover(role), serverRoles.isApprover(user), String(role));
    assert.strictEqual(stageOf(role), serverRoles.stageOf(user), String(role));
  }
});

test('every staff role has a label, and the VPAA is the only approver', () => {
  for (const role of STAFF_ROLES) assert.ok(ROLE_LABELS[role], role);
  assert.deepStrictEqual(everyRole.filter(isApprover), ['vpaa']);
  assert.strictEqual(ROLE_LABELS.vpaa, 'Vice President for Academic Affairs');
  assert.strictEqual(ROLE_LABELS.asst_vpaa, 'Asst. Vice President for Academic Affairs');
});

test('a navigation gate can be open, one role, or a list of roles', () => {
  assert.ok(roleAllows(null, 'vpaa') && roleAllows(undefined, 'faculty'));
  assert.ok(roleAllows('admin', 'admin') && !roleAllows('admin', 'vpaa'));
  assert.ok(roleAllows(['faculty', 'admin'], 'admin') && !roleAllows(['faculty', 'admin'], 'lic_director'));
  assert.ok(!roleAllows(['faculty'], undefined));
});
