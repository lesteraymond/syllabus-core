import test from 'node:test';
import assert from 'node:assert/strict';
import { createLanguageTransition } from './transition.js';

function fixture(reduced = false) {
  const listeners = new Set();
  const animations = [];
  const motion = {
    matches: reduced,
    addEventListener: (_, listener) => listeners.add(listener),
    removeEventListener: (_, listener) => listeners.delete(listener),
  };
  const element = {
    ownerDocument: { defaultView: { matchMedia: () => motion } },
    animate(frames, options) {
      const animation = { frames, options, cancelled: false, cancel() { this.cancelled = true; this.oncancel?.(); } };
      animations.push(animation);
      return animation;
    },
  };
  const transition = createLanguageTransition();
  const update = (language, account = 'faculty') => transition.update({ language, account, element });
  return { transition, update, element, animations, listeners, motion };
}

test('manual language changes animate after commit without waiting for animation completion', () => {
  const f = fixture();
  f.update('en');
  assert.equal(f.animations.length, 0);
  assert.equal(f.update('tl'), undefined);
  assert.equal(f.animations.length, 1);
  assert.equal(f.animations[0].options.duration, 180);
  assert.ok(f.animations[0].frames.every(frame => Object.keys(frame).every(key => key === 'opacity')));
  f.update('tl'); // Saving the preference must not replay the transition.
  assert.equal(f.animations.length, 1);
  f.animations[0].onfinish();
  assert.equal(f.listeners.size, 0);
});

test('failed-save rollback replaces an in-progress transition and disposal cleans up', () => {
  const f = fixture();
  f.update('en'); f.update('tl'); f.update('en');
  assert.equal(f.animations[0].cancelled, true);
  assert.equal(f.animations.length, 2);
  assert.equal(f.listeners.size, 1);
  f.transition.dispose();
  assert.equal(f.animations[1].cancelled, true);
  assert.equal(f.listeners.size, 0);
});

test('account restoration and logout cancel motion without animating between accounts', () => {
  const f = fixture();
  f.update('en'); f.update('tl');
  f.update('en', 'admin');
  assert.equal(f.animations[0].cancelled, true);
  assert.equal(f.animations.length, 1);
  f.update('tl', null);
  f.update('tl', 'faculty');
  assert.equal(f.animations.length, 1);
});

test('reduced motion is honored both before and during a transition', () => {
  const f = fixture(true);
  f.update('en'); f.update('tl');
  assert.equal(f.animations.length, 0);
  f.motion.matches = false;
  f.update('en');
  for (const listener of f.listeners) listener({ matches: true });
  assert.equal(f.animations[0].cancelled, true);
  assert.equal(f.listeners.size, 0);
});

test('missing or failing animation APIs never prevent language updates', () => {
  const transition = createLanguageTransition();
  assert.doesNotThrow(() => {
    transition.update({ language: 'en', account: 'faculty' });
    transition.update({ language: 'tl', account: 'faculty', element: {} });
    transition.update({ language: 'en', account: 'faculty', element: { animate() { throw new Error('unsupported'); } } });
    transition.dispose();
  });
});
