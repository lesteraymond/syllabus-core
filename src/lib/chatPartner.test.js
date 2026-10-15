// Run: npm test
import test from 'node:test';
import assert from 'node:assert';
import { initialsOf, partnerOf, threadTitle, canChat, DRAFT_CHAT_NOTE } from './chatPartner.js';

const fay = { id: 5, role: 'faculty' };
const admin = { id: 1, role: 'admin' };
const server = { id: 1, name: 'Diana Evale', roleLabel: 'Academic Administrator', avatarUrl: '/api/users/1/avatar?v=1' }; // an administrator: no program or subject
const facultyEntry = { id: 5, name: 'Fay Faculty', roleLabel: 'Faculty', avatarUrl: null, program: 'BSFM · Financial Management', subject: 'FM 202 — Fundamentals of Mathematics' };

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

test('an administrator cannot message themselves about their own syllabus in any status',()=>{
  for(const status of ['draft','submitted','under_review','for_revision','approved','rejected']) {
    const syl={userId:admin.id,status,faculty:'Own administrator'};
    assert.strictEqual(canChat(syl,admin),false);
    assert.strictEqual(partnerOf({partner:{id:admin.id,name:'Own administrator'},user:admin,syl}),null);
  }
  assert.strictEqual(canChat({userId:fay.id,status:'approved'},admin),true);
  assert.strictEqual(canChat({userId:fay.id,status:'submitted'},fay),true);
});
