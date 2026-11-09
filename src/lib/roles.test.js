// Run: npm test. The review chain's roles, and that the screens and the server agree on them.
import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { ROLE_LABELS, STAGES, REVIEW_ROLES, STAFF_ROLES, AUTHOR_ROLES, isReviewer, isApprover, stageOf, roleAllows, canAuthor } from './roles.js';
import { navItems } from '../data/initialData.js';
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

// Only faculty and the administrator write syllabi; the Asst. VPAA, the LIC Director and the VPAA review them (server/middleware/auth.js requireAuthor).
test('the screens and the server agree on who writes syllabi: faculty and the administrator only', () => {
  assert.deepStrictEqual([...AUTHOR_ROLES], ['faculty', 'admin']);
  assert.deepStrictEqual([...AUTHOR_ROLES], serverRoles.AUTHOR_ROLES);
  for (const role of everyRole) assert.strictEqual(canAuthor(role), serverRoles.canAuthor({ id: 1, role }), String(role));
  assert.deepStrictEqual(everyRole.filter(canAuthor), ['faculty', 'admin']);
});

test('the Syllabus Builder and My Syllabi are in the menu of faculty and the administrator only', () => {
  const pages = (role) => navItems.filter(([, , , gate]) => roleAllows(gate, role)).map(([page]) => page);
  for (const role of ['faculty', 'admin']) assert.ok(pages(role).includes('builder') && pages(role).includes('my-syllabi'), role);
  for (const role of ['asst_vpaa', 'lic_director', 'vpaa']) {
    assert.ok(!pages(role).includes('builder'), role + ': no Syllabus Builder');
    assert.ok(!pages(role).includes('my-syllabi'), role + ': no My Syllabi');
    assert.ok(pages(role).includes('ai') && pages(role).includes('review'), role + ': still reviews in the AI Checker and Review & Approval');
  }
});

// Users & Roles lists people by role in a fixed order (the VPAA, the Asst. VPAA, the LIC Director, the administrator, faculty), then by name.
test('people are listed by role (VPAA, Asst. VPAA, LIC Director, administrator, faculty), then by name', async () => {
  const { ROLE_ORDER, byRoleOrder } = await import('./roles.js');
  assert.deepStrictEqual([...ROLE_ORDER], ['vpaa', 'asst_vpaa', 'lic_director', 'admin', 'faculty']);
  assert.deepStrictEqual([...ROLE_ORDER].sort(), [...STAFF_ROLES].sort(), 'every staff role has its place');
  const people = [
    { role: 'faculty', lastName: 'Cruz', firstName: 'Ana' }, { role: 'admin', lastName: 'Evale', firstName: 'Diana' }, { role: 'student', lastName: 'Aa', firstName: 'S' },
    { role: 'vpaa', lastName: 'Paa', firstName: 'Vee' }, { role: 'faculty', lastName: 'Abad', firstName: 'Ben' }, { role: 'lic_director', lastName: 'Lim', firstName: 'Lee' },
    { role: 'asst_vpaa', lastName: 'Vee', firstName: 'Ash' },
  ];
  assert.deepStrictEqual([...people].sort(byRoleOrder).map((p) => p.role + ':' + p.lastName),
    ['vpaa:Paa', 'asst_vpaa:Vee', 'lic_director:Lim', 'admin:Evale', 'faculty:Abad', 'faculty:Cruz', 'student:Aa']);
});
