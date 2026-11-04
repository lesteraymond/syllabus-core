import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { CORE_VALUES, hasCoreValue, namesCoreValue, toggleCoreValue } from './coreValues.js';

const [courage, community, missionary] = ['courage', 'community', 'missionary'].map((k) => CORE_VALUES.find((v) => v.key === k));

test('the builder list is the same six values the AI Checker uses', () => {
  const { VALUE_NAMES } = createRequire(import.meta.url)('../../server/lib/syllabuscheck/values.js');
  assert.deepEqual(CORE_VALUES.map((v) => v.name), [...VALUE_NAMES]);
  assert.equal(CORE_VALUES.length, 6);
});

test('a value is recognised however it is cased or spelled', () => {
  assert.ok(hasCoreValue('Honesty, COURAGE', courage));
  assert.ok(hasCoreValue('community oriented', community));
  assert.ok(hasCoreValue('Missionary spirit', missionary));
  assert.ok(!namesCoreValue('Honesty, Respect, Critical Thinking'));
  assert.ok(namesCoreValue('**Interiority**'));
});

test('toggling adds a value to the text and takes it out again', () => {
  assert.equal(toggleCoreValue('', courage), 'Courage');
  assert.equal(toggleCoreValue('Honesty', courage), 'Honesty, Courage');
  assert.equal(toggleCoreValue('Honesty,', courage), 'Honesty, Courage');
  assert.equal(toggleCoreValue('Honesty, Courage', courage), 'Honesty');
  assert.equal(toggleCoreValue('courage, Honesty', courage), 'Honesty');
  assert.equal(toggleCoreValue('Courage', courage), '');
  assert.equal(toggleCoreValue('Honesty, Community-orientedness, Respect', community), 'Honesty, Respect');
  assert.equal(toggleCoreValue('Missionary Spirit', missionary), '');
});
