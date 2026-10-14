// Run: npm test
import test from 'node:test';
import assert from 'node:assert';
import { initialsOf, partnerOf, threadTitle, canChat, DRAFT_CHAT_NOTE } from './chatPartner.js';

const fay = { id: 5, role: 'faculty' };
const admin = { id: 1, role: 'admin' };
const server = { id: 1, name: 'Diana Evale', roleLabel: 'Academic Administrator', avatarUrl: '/api/users/1/avatar?v=1', program: 'BSFM · Financial Management', subject: 'FM 202 — Fundamentals of Mathematics' };

test('the server\'s answer is used, so a faculty member sees the administrator before anyone has written', () => {
  const p = partnerOf({ partner: server, messages: [], user: fay, syl: { id: 10, faculty: 'Fay Faculty' } });
  assert.deepStrictEqual(p, { name: 'Diana Evale', initials: 'DE', avatarUrl: '/api/users/1/avatar?v=1', roleLabel: 'Academic Administrator', program: 'BSFM · Financial Management', subject: 'FM 202 — Fundamentals of Mathematics' });
});

test('it wins over an older name in a message, so a changed name or picture shows without a new message', () => {
  const old = [{ senderId: 1, sender: 'Diana Old', senderAvatarUrl: '/old.png' }];
  assert.strictEqual(partnerOf({ partner: server, messages: old, user: fay }).name, 'Diana Evale');
  assert.strictEqual(partnerOf({ partner: server, messages: old, user: fay }).avatarUrl, '/api/users/1/avatar?v=1');
});

test('without the server\'s answer, the other side\'s latest message gives the name and picture, and the syllabus the program and subject', () => {
  const syl = { id: 10, courseCode: 'FM 202', courseTitle: 'Fundamentals of Mathematics', programCode: 'BSFM', program: 'Financial Management', faculty: 'Fay Faculty' };
  const p = partnerOf({ partner: null, messages: [{ senderId: 1, sender: 'Diana Evale', senderAvatarUrl: '/d.png' }], user: fay, syl });
  assert.deepStrictEqual([p.name, p.avatarUrl, p.program, p.subject], ['Diana Evale', '/d.png', 'BSFM · Financial Management', 'FM 202 — Fundamentals of Mathematics']);
});

test('an administrator with no answer and no message still sees the syllabus owner; a faculty member with nothing known gets null, not their own name', () => {
  const syl = { id: 10, courseCode: 'FM 202', title: 'Fundamentals', faculty: 'Fay Faculty', ownerAvatarUrl: '/fay.png' };
  const a = partnerOf({ partner: undefined, messages: [], user: admin, syl });
  assert.deepStrictEqual([a.name, a.initials, a.avatarUrl, a.roleLabel], ['Fay Faculty', 'FF', '/fay.png', 'Faculty']);
  assert.strictEqual(partnerOf({ partner: undefined, messages: [], user: fay, syl }), null); // the old code showed the faculty member their own name here
  assert.strictEqual(partnerOf({ partner: null, messages: [{ senderId: 5, sender: 'Fay' }], user: fay, syl }), null); // only their own messages: still nobody known
});

test('initials and the thread title read well, and a missing syllabus falls back to its number', () => {
  assert.strictEqual(initialsOf('Jp Rizal G. Del Rosario'), 'JR');
  assert.strictEqual(initialsOf(''), '');
  assert.strictEqual(threadTitle({ courseCode: 'FM 202', courseTitle: 'Fundamentals of Mathematics' }, 58), 'FM 202 • Fundamentals of Mathematics');
  assert.strictEqual(threadTitle(undefined, 58), 'Syllabus #58');
});

test('a draft has no conversation, and a submitted, returned, approved or rejected syllabus does', () => {
  assert.strictEqual(canChat({ status: 'draft' }), false);
  for (const status of ['submitted', 'under_review', 'for_revision', 'approved', 'rejected']) assert.strictEqual(canChat({ status }), true, status);
  assert.strictEqual(canChat(undefined), false);
  assert.match(DRAFT_CHAT_NOTE, /Submit it for review first/);
});
