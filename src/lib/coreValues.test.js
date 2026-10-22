import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CORE_VALUES, hasCoreValue, namesCoreValue, toggleCoreValue } from './coreValues.js';

const [courage, community, missionary] = ['courage', 'community', 'missionary'].map((k) => CORE_VALUES.find((v) => v.key === k));

test('the builder list is the same six values the AI Checker uses', async () => {
  const standard = JSON.parse(await readFile(new URL('../../server/lib/compliance/standard-v4.json', import.meta.url), 'utf8'));
  assert.deepEqual(CORE_VALUES, standard.constants.coreValues);
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
