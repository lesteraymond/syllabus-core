// Run: npm test
import test from 'node:test';
import assert from 'node:assert';
import { chatPartner, initialsOf, partnerOf, threadTitle, canChat, DRAFT_CHAT_NOTE } from './chatPartner.js';

const fay = { id: 5, role: 'faculty' };
const admin = { id: 1, role: 'admin' };
const server = { id: 1, name: 'Diana Evale', roleLabel: 'Academic Administrator', avatarUrl: '/api/users/1/avatar?v=1' }; // an administrator: no program or subject
const facultyEntry = { id: 5, name: 'Fay Faculty', roleLabel: 'Faculty', avatarUrl: null, program: 'BSFM · Financial Management', subject: 'FM 202 — Fundamentals of Mathematics' };

test('chat header shows the syllabus owner to an administrator even with no messages or another administrator in the thread', () => {
  const syl = { userId: 5, faculty: 'Fay Faculty', ownerAvatarUrl: '/fay.png' };
  const expected = { name: 'Fay Faculty', initials: 'FF', avatarUrl: '/fay.png' };
  assert.deepStrictEqual(chatPartner([], admin, syl), expected);
  assert.deepStrictEqual(chatPartner([{ senderId: 2, sender: 'Other Admin', senderAvatarUrl: '/admin.png' }], admin, syl), expected);
});

test('faculty header uses the latest administrator message, independent of message order, and never their own message', () => {
  const messages = [
    { senderId: 2, senderRole: 'admin', sender: 'Latest Admin', senderAvatarUrl: '/latest.png', time: '2026-10-02' },
    { senderId: 5, sender: 'Fay Faculty', time: '2026-10-03' },
    { senderId: 1, senderRole: 'admin', sender: 'Older Admin', time: '2026-10-01' },
  ];
  const original = JSON.stringify(messages);
  assert.deepStrictEqual(chatPartner(messages, fay, {}), { name: 'Latest Admin', initials: 'LA', avatarUrl: '/latest.png' });
  assert.strictEqual(JSON.stringify(messages), original);
});

test('empty, unknown and self-only chat data have a useful generic partner', () => {
  for (const messages of [[], [{ senderId: 5, sender: 'Fay Faculty' }], [{ senderId: 1, sender: 'Unknown' }]]) {
    assert.deepStrictEqual(chatPartner(messages, fay, { faculty: 'Fay Faculty' }), { name: 'Administrator', initials: 'A', avatarUrl: null });
  }
  assert.strictEqual(chatPartner([], { ...admin, name: 'Ann', id: 1 }, { userId: 1, faculty: 'Ann' }).name, 'Faculty');
  assert.strictEqual(chatPartner([{ senderId: 6, senderRole: 'faculty', sender: 'Colleague' }], fay, {}).name, 'Administrator');
});

test('the server\'s answer is used, so a faculty member sees the administrator before anyone has written, with a name and a role only', () => {
  const p = partnerOf({ partner: server, messages: [], user: fay, syl: { id: 10, faculty: 'Fay Faculty' } });
  assert.deepStrictEqual(p, { name: 'Diana Evale', initials: 'DE', avatarUrl: '/api/users/1/avatar?v=1', roleLabel: 'Academic Administrator', program: '', subject: '' });
  // and the administrator sees the faculty member with the program and subject
  assert.deepStrictEqual(partnerOf({ partner: facultyEntry, messages: [], user: admin }), { name: 'Fay Faculty', initials: 'FF', avatarUrl: null, roleLabel: 'Faculty', program: 'BSFM · Financial Management', subject: 'FM 202 — Fundamentals of Mathematics' });
});

test('it wins over an older name in a message, so a changed name or picture shows without a new message', () => {
  const old = [{ senderId: 1, sender: 'Diana Old', senderAvatarUrl: '/old.png' }];
  assert.strictEqual(partnerOf({ partner: server, messages: old, user: fay }).name, 'Diana Evale');
  assert.strictEqual(partnerOf({ partner: server, messages: old, user: fay }).avatarUrl, '/api/users/1/avatar?v=1');
});

test('without the server\'s answer, the other side\'s latest message gives the name and picture; the program and subject appear only for an administrator', () => {
  const syl = { id: 10, courseCode: 'FM 202', courseTitle: 'Fundamentals of Mathematics', programCode: 'BSFM', program: 'Financial Management', faculty: 'Fay Faculty' };
  const p = partnerOf({ partner: null, messages: [{ senderId: 1, sender: 'Diana Evale', senderAvatarUrl: '/d.png' }], user: fay, syl });
  assert.deepStrictEqual([p.name, p.avatarUrl, p.program, p.subject], ['Diana Evale', '/d.png', '', '']); // a faculty member's view of the administrator
  const q = partnerOf({ partner: null, messages: [{ senderId: 5, sender: 'Fay Faculty', senderAvatarUrl: '/f.png' }], user: admin, syl });
  assert.deepStrictEqual([q.name, q.program, q.subject], ['Fay Faculty', 'BSFM · Financial Management', 'FM 202 — Fundamentals of Mathematics']); // an administrator's view of the faculty member
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
