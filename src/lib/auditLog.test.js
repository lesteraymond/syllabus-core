import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuditCsv, categoryOfAction, filterAuditRows, shapeAuditRow } from './auditLog.js';
import { isRecentActivity } from './activityView.js';

test('categoryOfAction separates security, account management, and syllabus events', () => {
  assert.equal(categoryOfAction('login_failed'), 'security');
  assert.equal(categoryOfAction('password_change'), 'security');
  assert.equal(categoryOfAction('user_disable'), 'account');
  assert.equal(categoryOfAction('user_assignments'), 'account');
  assert.equal(categoryOfAction('approve'), 'syllabus');
  assert.equal(categoryOfAction('submit'), 'syllabus');
});

test('filterAuditRows filters by category and search text', () => {
  const rows = [
    shapeAuditRow({ id: 1, action: 'login_failed', user: 'Juan Santos', notes: 'password', actionDate: '2026-11-24T04:00:00Z' }, 0),
    shapeAuditRow({ id: 2, action: 'approve', user: 'VPAA User', courseCode: 'GE - PC', title: 'Purposive Communication', actionDate: '2026-11-24T04:05:00Z' }, 1),
    shapeAuditRow({ id: 3, action: 'user_disable', user: 'Admin User', courseCode: 'Fay Flores', actionDate: '2026-11-24T04:10:00Z' }, 2),
  ];
  assert.equal(filterAuditRows(rows, { category: 'security' }).length, 1);
  assert.equal(filterAuditRows(rows, { category: 'account' }).length, 1);
  assert.equal(filterAuditRows(rows, { category: 'syllabus' }).length, 1);
  assert.equal(filterAuditRows(rows, { query: 'purposive' }).length, 1);
  assert.equal(filterAuditRows(rows, { query: 'fay' }).length, 1);
});

test('buildAuditCsv escapes quotes, includes IP Address, and neutralizes spreadsheet formulas', () => {
  const row = shapeAuditRow({ id: 1, action: 'name_change', user: '=CMD()', notes: 'Old -> New', ipAddress: '10.0.0.5', actionDate: '2026-11-24T04:00:00Z' }, 0);
  const csv = buildAuditCsv([row]);
  assert.ok(csv.startsWith('\uFEFFDate,Time,Actor,Category,Action,Target,Details,IP Address'));
  assert.ok(csv.includes("'=CMD()"));
  assert.ok(csv.includes('10.0.0.5'));
  assert.equal(filterAuditRows([row], { query: '10.0.0.5' }).length, 1);
});

test('isRecentActivity keeps workflow/profile actions and excludes audit-only security/admin actions', () => {
  for (const action of ['submit', 'draft_create', 'content_edit', 'approve', 'name_change', 'photo_change']) {
    assert.equal(isRecentActivity({ action }), true, action + ' belongs in Recent Activity');
  }
  for (const action of ['login', 'logout', 'login_failed', 'password_change', 'terms_accept', 'user_create', 'user_disable', 'user_delete']) {
    assert.equal(isRecentActivity({ action }), false, action + ' belongs only in Audit Log');
  }
});
