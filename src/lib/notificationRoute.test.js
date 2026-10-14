// Run: npm test
import test from 'node:test';
import assert from 'node:assert';
import { notificationTarget, commentNotificationIds, commentBadge } from './notificationRoute.js';

const n = (type, syllabusId = 7, over = {}) => ({ id: 1, type, syllabusId, isRead: false, ...over });

test('a message opens the chat, for anyone', () => {
  assert.deepStrictEqual(notificationTarget(n('message'), 'faculty'), { kind: 'chat', id: 7 });
  assert.deepStrictEqual(notificationTarget(n('message'), 'admin'), { kind: 'chat', id: 7 });
});

test('for a faculty member, a reviewer comment or a decision opens that syllabus\'s comments', () => {
  assert.deepStrictEqual(notificationTarget(n('comment'), 'faculty'), { kind: 'comments', id: 7 });
  assert.deepStrictEqual(notificationTarget(n('status'), 'faculty'), { kind: 'comments', id: 7 });
});

test('anything else, or a notification without a syllabus, opens the page where syllabi live', () => {
  assert.deepStrictEqual(notificationTarget(n('status'), 'admin'), { kind: 'page', page: 'review' });
  assert.deepStrictEqual(notificationTarget(n('comment'), 'admin'), { kind: 'page', page: 'review' }); // an admin wrote it; there is no thread to read
  assert.deepStrictEqual(notificationTarget(n('comment', null), 'faculty'), { kind: 'page', page: 'my-syllabi' });
  assert.deepStrictEqual(notificationTarget(n('message', null), 'faculty'), { kind: 'page', page: 'my-syllabi' });
  assert.deepStrictEqual(notificationTarget(n('something-new'), 'faculty'), { kind: 'page', page: 'my-syllabi' });
});

test('reading a syllabus\'s comments settles only its unread comment and decision notifications', () => {
  const items = [
    n('comment', 7, { id: 1 }), n('status', 7, { id: 2 }), n('message', 7, { id: 3 }), // a message is about the chat, not the thread
    n('comment', 8, { id: 4 }), n('comment', 7, { id: 5, isRead: true }), n('submission', 7, { id: 6 }),
  ];
  assert.deepStrictEqual(commentNotificationIds(items, 7), [1, 2]);
  assert.deepStrictEqual(commentNotificationIds(items, 99), []);
  assert.deepStrictEqual(commentNotificationIds([], 7), []);
});

test('the badge shows what is new, else the total, else nothing', () => {
  assert.deepStrictEqual(commentBadge({ total: 4, unread: 2 }), { text: '2', fresh: true });
  assert.deepStrictEqual(commentBadge({ total: 4, unread: 0 }), { text: '4', fresh: false });
  assert.deepStrictEqual(commentBadge({ total: 4, unread: null }), { text: '4', fresh: false }); // tracking not set up: the total only
  assert.deepStrictEqual(commentBadge({ total: 0, unread: 0 }), { text: '', fresh: false });
  assert.deepStrictEqual(commentBadge(undefined), { text: '', fresh: false });
});

test('for an administrator a new submission or a resubmission opens the AI Checker, where it is checked before it is reviewed', () => {
  assert.deepStrictEqual(notificationTarget(n('submission'), 'admin'), { kind: 'page', page: 'ai' });
  assert.deepStrictEqual(notificationTarget(n('edit'), 'admin'), { kind: 'page', page: 'ai' });
  assert.deepStrictEqual(notificationTarget(n('submission'), 'faculty'), { kind: 'page', page: 'my-syllabi' });
});
