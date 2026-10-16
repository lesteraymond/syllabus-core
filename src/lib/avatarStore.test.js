import test from 'node:test';
import assert from 'node:assert/strict';
import { recordAvatar, seedAvatars, resolveAvatar, subscribeAvatars, resetAvatars, versionOf, userIdOf } from './avatarStore.js';

const url = (id, v) => `/api/users/${id}/avatar?v=${v}`;
test.beforeEach(() => resetAvatars());

test('an avatar URL says whose picture it is and when it was uploaded', () => {
  assert.equal(userIdOf(url(7, 123)), 7);
  assert.equal(versionOf(url(7, 123)), 123);
  assert.equal(userIdOf(null), null);
  assert.equal(versionOf('/x.png'), 0);
});

test('a user nobody has recorded shows the copy the caller holds', () => {
  assert.equal(resolveAvatar(5, url(5, 100)), url(5, 100));
  assert.equal(resolveAvatar(5, null), null);
});

test('a new upload replaces an old copy in a list that has not refreshed yet', () => {
  recordAvatar(5, url(5, 2000), 2000);
  assert.equal(resolveAvatar(5, url(5, 1000)), url(5, 2000));
  assert.equal(resolveAvatar(null, url(5, 1000)), url(5, 2000), 'found by the id inside the URL when no id is passed');
});

test('removing a photo beats an older URL everywhere, and a later upload beats the removal', () => {
  recordAvatar(5, null, 3000);
  assert.equal(resolveAvatar(5, url(5, 1000)), null);
  recordAvatar(5, url(5, 4000), 4000);
  assert.equal(resolveAvatar(5, null), url(5, 4000));
  assert.equal(resolveAvatar(5, url(5, 1000)), url(5, 4000));
});

test('a server payload that started before a local change does not undo it', () => {
  recordAvatar(5, url(5, 5000), 5000);
  seedAvatars([[5, url(5, 1000)]], 4000);       // stale response arriving late
  assert.equal(resolveAvatar(5, url(5, 1000)), url(5, 5000));
});

test('a newer server payload updates what the store knows, including a removal by someone else', () => {
  seedAvatars([[8, url(8, 1000)]], 1000);
  assert.equal(resolveAvatar(8, null), url(8, 1000));
  seedAvatars([[8, null]], 2000);               // fetched later: the user has no picture now
  assert.equal(resolveAvatar(8, url(8, 1000)), null);
  seedAvatars([[8, url(8, 3000)]], 3000);
  assert.equal(resolveAvatar(8, null), url(8, 3000));
});

test('listeners are told about a real change only', () => {
  let calls = 0;
  const off = subscribeAvatars(() => { calls++; });
  recordAvatar(1, url(1, 10), 10);
  recordAvatar(1, url(1, 10), 10);               // nothing new
  seedAvatars([[1, url(1, 5)]], 5);              // older than what is known
  assert.equal(calls, 1);
  off();
  recordAvatar(1, null, 20);
  assert.equal(calls, 1);
});
