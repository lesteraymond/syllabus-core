import test from 'node:test';
import assert from 'node:assert/strict';
import { newArrivals, showDesktop, askPermissionOnFirstGesture, playChime } from './desktopAlert.js';

test('the first list after sign-in only records what exists: nothing chimes', () => {
  const { seen, fresh } = newArrivals(null, [{ id: 1, isRead: false }, { id: 2, isRead: true }]);
  assert.deepEqual(fresh, []);
  assert.deepEqual([...seen].sort(), [1, 2]);
});

test('a new unread notification is fresh once; a read or already seen one is not', () => {
  let state = newArrivals(null, [{ id: 1, isRead: false }]);
  state = newArrivals(state.seen, [{ id: 3, isRead: false }, { id: 2, isRead: true }, { id: 1, isRead: false }]);
  assert.deepEqual(state.fresh.map((n) => n.id), [3]);
  state = newArrivals(state.seen, [{ id: 3, isRead: false }, { id: 1, isRead: false }]);
  assert.deepEqual(state.fresh, []);
  assert.deepEqual(newArrivals(new Set(), null).fresh, []);
});

test('without a browser nothing throws and no popup is made', () => {
  assert.equal(showDesktop({ id: 1 }, { title: 'x' }), null);
  assert.equal(typeof askPermissionOnFirstGesture(), 'function');
  assert.doesNotThrow(() => { globalThis.window = {}; try { playChime(); } finally { delete globalThis.window; } });
});
