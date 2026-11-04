// Who is a reviewer, who approves, and which stage a role clears. Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert');
const roles = require('./roles');
const rules = require('./syllabusRules');

const user = (role, id = 1) => ({ id, role });

test('four roles review, one approves, and each of three has a stage of its own', () => {
  for (const r of ['admin', 'asst_vpaa', 'lic_director', 'vpaa']) assert.ok(roles.isReviewer(user(r)), r);
  for (const r of ['faculty', 'student', 'unknown', undefined]) assert.ok(!roles.isReviewer(user(r)), String(r));
  assert.ok(!roles.isReviewer(null));
  assert.deepStrictEqual(['admin', 'asst_vpaa', 'lic_director', 'vpaa', 'faculty'].map((r) => roles.stageOf(user(r))), ['dean', 'asst_vpaa', 'lic_director', null, null]);
  assert.deepStrictEqual(['admin', 'asst_vpaa', 'lic_director', 'vpaa', 'faculty'].map((r) => roles.isApprover(user(r))), [false, false, false, true, false]);
});

test('the dean is no longer an approver: only the VPAA decides, the others may only send a syllabus back', () => {
  const asked = (role, status) => rules.canSetStatus(user(role), status);
  for (const status of ['approved', 'for_revision', 'rejected']) assert.ok(asked('vpaa', status), 'vpaa ' + status);
  for (const role of ['admin', 'asst_vpaa', 'lic_director']) {
    assert.ok(asked(role, 'for_revision'), role + ' may return');
    assert.ok(!asked(role, 'approved') && !asked(role, 'rejected'), role + ' may not approve or reject');
  }
  for (const role of ['faculty', 'student']) for (const status of ['approved', 'for_revision', 'rejected']) assert.ok(!asked(role, status), role + ' ' + status);
});

test('every reviewer sees submitted syllabi, nobody but the owner sees a draft', () => {
  const sub = { user_id: 9, status: 'submitted' };
  const draft = { user_id: 9, status: 'draft' };
  for (const role of roles.REVIEW_ROLES) { assert.ok(rules.canView(user(role), sub), role); assert.ok(!rules.canView(user(role), draft), role + ' draft'); }
  assert.ok(rules.canView(user('faculty', 9), draft));
  assert.ok(!rules.canView(user('faculty', 3), sub));
});

test('deleting a submitted syllabus stays with the dean', () => {
  const sub = { user_id: 9, status: 'submitted' };
  assert.ok(rules.canDelete(user('admin'), sub));
  for (const role of ['asst_vpaa', 'lic_director', 'vpaa']) assert.ok(!rules.canDelete(user(role), sub), role);
});
