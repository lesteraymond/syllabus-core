// Run: npm test
import test from 'node:test';
import assert from 'node:assert';
import { canApproveAdminDraft, assignmentState, canDeleteSyllabus, courseLockReason, NOT_ASSIGNED, NOTHING_ASSIGNED, NO_SUBJECT_YET } from './syllabusRules.js';
import { createRequire } from 'node:module';
const serverRules = createRequire(import.meta.url)('../../server/lib/syllabusRules.js');

const faculty = { id: 5, role: 'faculty' };
const mine = { unrestricted: false, programIds: [1], courseIds: [10], courses: [{ id: 10, code: 'IT 101' }] };
const none = { unrestricted: false, programIds: [], courseIds: [], courses: [] };
const programOnly = { unrestricted: false, programIds: [1], courseIds: [], courses: [] };

test('client and server deletion permissions agree: faculty own drafts only; administrator access is preserved', () => {
  for (const role of ['faculty', 'admin', 'student', 'unknown']) {
    for (const status of ['draft', 'submitted', 'under_review', 'for_revision', 'approved', 'rejected']) {
      for (const ownerId of [5, 6]) {
        const user = { id: 5, role };
        const expected = role === 'admin' ? ownerId === 5 || status !== 'draft' : role === 'faculty' && ownerId === 5 && status === 'draft';
        assert.strictEqual(canDeleteSyllabus(user, { userId: ownerId, status }), expected);
        assert.strictEqual(serverRules.canDelete(user, { user_id: ownerId, status }), expected);
      }
    }
  }
});

test('an assigned course is editable, an unassigned one says so', () => {
  assert.strictEqual(courseLockReason(faculty, mine, { courseId: 10 }), '');
  assert.strictEqual(courseLockReason(faculty, mine, { courseId: 11 }), NOT_ASSIGNED);
});

test('older syllabi without a course id are matched by course code, ignoring case and spaces', () => {
  assert.strictEqual(courseLockReason(faculty, mine, { courseCode: ' it 101 ' }), '');
  assert.strictEqual(courseLockReason(faculty, mine, { courseCode: 'IT 204' }), NOT_ASSIGNED);
});

test('a faculty member with nothing assigned is told so', () => {
  assert.strictEqual(courseLockReason(faculty, none, { courseCode: 'IT 101' }), NOTHING_ASSIGNED);
  assert.strictEqual(courseLockReason(faculty, none, { courseCode: '' }), NOTHING_ASSIGNED);
  assert.strictEqual(courseLockReason(faculty, mine, { courseCode: '' }), '');
});

test('the assignment state tells nothing, program-only and ready apart', () => {
  assert.strictEqual(assignmentState(none), 'none');
  assert.strictEqual(assignmentState(programOnly), 'noSubject');
  assert.strictEqual(assignmentState(mine), 'ok');
  assert.strictEqual(assignmentState(null), null);
  assert.strictEqual(assignmentState({ unrestricted: true, programIds: [], courseIds: [], courses: [] }), null);
});

test('a program without a subject yet says so, instead of claiming nothing is assigned', () => {
  assert.strictEqual(courseLockReason(faculty, programOnly, { courseCode: '' }), NO_SUBJECT_YET);
  assert.strictEqual(courseLockReason(faculty, programOnly, { courseCode: 'IT 101' }), NO_SUBJECT_YET);
});

test('nothing is blocked while the assignments load, and admins are never blocked', () => {
  assert.strictEqual(courseLockReason(faculty, null, { courseId: 99 }), '');
  assert.strictEqual(courseLockReason({ id: 1, role: 'admin' }, none, { courseId: 99 }), '');
  assert.strictEqual(courseLockReason(faculty, { unrestricted: true, programIds: [], courseIds: [], courses: [] }, { courseId: 99 }), '');
});

test('admin approval requires their draft and the current completed check without automatically approving a score',()=>{
  const user={id:1,role:'admin'};
  const syllabus={syllabusId:10,userId:1,status:'under_review'};
  const run={id:5,syllabusId:10,createdBy:1,status:'scored',conformant:true,stale:false,aiStatus:'ok',passed:false};
  assert.strictEqual(canApproveAdminDraft(user,syllabus,run),true); // warnings remain an administrator decision
  assert.strictEqual(canApproveAdminDraft(user,syllabus,{...run,aiStatus:'none'}),true);
  for (const change of [{aiStatus:'pending'},{aiStatus:'failed'},{aiStatus:undefined},{stale:true},{conformant:false},{status:'insufficient'},{createdBy:2},{syllabusId:11}]) assert.strictEqual(canApproveAdminDraft(user,syllabus,{...run,...change}),false);
  assert.strictEqual(canApproveAdminDraft(user,syllabus,run,false),false);
  assert.strictEqual(canApproveAdminDraft({id:1,role:'faculty'},syllabus,run),false);
  assert.strictEqual(canApproveAdminDraft(user,{...syllabus,userId:2},run),false);
  assert.strictEqual(canApproveAdminDraft(user,{...syllabus,status:'approved'},run),false);
  assert.strictEqual(canApproveAdminDraft(user,{...syllabus,status:'draft'},run),false);
  assert.strictEqual(canApproveAdminDraft(user,syllabus,null),false);
});

test('a rejected syllabus is edited and sent again, like one returned for revision; submitted and approved stay locked', async () => {
  const { canEditSyllabus, isReturned, noteMissing, editBlockedReason } = await import('./syllabusRules.js');
  const owner = { id: 7, role: 'faculty' };
  for (const status of ['draft', 'for_revision', 'rejected']) assert.equal(canEditSyllabus(owner, { userId: 7, status }), true, status);
  for (const status of ['submitted', 'under_review', 'approved']) assert.equal(canEditSyllabus(owner, { userId: 7, status }), false, status);
  assert.equal(isReturned('rejected'), true);
  assert.equal(isReturned('approved'), false);
  assert.equal(noteMissing('rejected', ''), true, 'a resubmission after a rejection also says what changed');
  assert.equal(noteMissing('draft', ''), false);
  assert.equal(editBlockedReason({ status: 'rejected' }), '');
});

test('an archived syllabus (its subject went to another faculty member) is read-only for its former owner', async () => {
  const { canEditSyllabus, editBlockedReason } = await import('./syllabusRules.js');
  const owner = { id: 7, role: 'faculty' };
  for (const status of ['draft', 'for_revision', 'rejected']) assert.equal(canEditSyllabus(owner, { userId: 7, status, archived: true }), false, status);
  assert.match(editBlockedReason({ status: 'draft', archived: true }), /archived because its subject was assigned to another faculty member/);
  assert.equal(canEditSyllabus(owner, { userId: 7, status: 'draft', archived: false }), true);
});
