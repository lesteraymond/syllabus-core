import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickerPosition, PICKER_WIDTH } from './pickerPosition.js';

const view = { width: 1500, height: 800 };
const button = (left, top) => ({ left, top, bottom: top + 24, right: left + 60 });

test('the picker opens right under its button, at the button\'s left edge', () => {
  const s = pickerPosition(button(640, 200), view);
  assert.deepEqual([s.left, s.top, s.bottom, s.width], [640, 230, undefined, PICKER_WIDTH]);
});

test('near the bottom of the window it opens above the button instead, touching it', () => {
  const s = pickerPosition(button(640, 600), view);
  assert.equal(s.top, undefined);
  assert.equal(s.bottom, 800 - 600 + 6, 'its bottom edge sits just above the button');
});

test('it never runs past the window: right edge, left edge, short windows', () => {
  assert.equal(pickerPosition(button(1400, 100), view).left, 1500 - PICKER_WIDTH - 8);
  assert.equal(pickerPosition(button(-20, 100), view).left, 8);
  const short = pickerPosition(button(100, 100), { width: 900, height: 300 });
  assert.equal(short.maxHeight, 276, 'the list scrolls inside a window shorter than the picker');
});

test('the picker is drawn on document.body, follows its button, and the Tag button passes itself as the anchor', () => {
  const parts = readFileSync(new URL('../views/builder2/parts.jsx', import.meta.url), 'utf8');
  const plan = readFileSync(new URL('../views/builder2/PlanStep.jsx', import.meta.url), 'utf8');
  assert.ok(parts.includes("import { createPortal } from 'react-dom';") && /document\.body\r?\n\s*\);/.test(parts), 'a transformed ancestor (a card\'s entry animation) can no longer move a fixed picker away from its button');
  assert.ok(parts.includes("window.addEventListener('scroll', follow, true)") && parts.includes('anchor.getBoundingClientRect()'), 'it stays next to the button while the page scrolls');
  assert.ok(plan.includes('anchor: e.currentTarget') && plan.includes('anchor={picker.anchor}'));
});
