import test from 'node:test';
import assert from 'node:assert/strict';
import { isActive, IDLE_MS, BEAT_MS } from './activity.js';

const now = 1_000_000_000_000;

test('a visible tab with recent input counts as active', () => {
  assert.equal(isActive({ now, lastInputAt: now - 1000, visible: true }), true);
  assert.equal(isActive({ now, lastInputAt: now - IDLE_MS, visible: true }), true);
});

test('five minutes without input means the person is away', () => {
  assert.equal(IDLE_MS, 5 * 60 * 1000);
  assert.equal(isActive({ now, lastInputAt: now - IDLE_MS - 1, visible: true }), false);
});

test('a hidden tab never counts, however recent the last input', () => {
  assert.equal(isActive({ now, lastInputAt: now, visible: false }), false);
});

test('the heartbeat is slower than the server minimum gap and faster than its credit cap', () => {
  assert.ok(BEAT_MS >= 10 * 1000, 'the server ignores beats closer than 10 s');
  assert.ok(BEAT_MS * 2 < 90 * 1000 * 2 && BEAT_MS <= 90 * 1000, 'one beat never needs more credit than the server allows');
});
