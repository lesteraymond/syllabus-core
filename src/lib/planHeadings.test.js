// Run: npm test. The learning plan's column headings are one wording in three places: the institutional form (printed in capitals), the
// builder's Learning Plan step (each word capitalised, in the user's language), and the translations that feed the step. They must not drift.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_HEADINGS } from './syllabusModel.js';
import { dictionaries } from '../i18n/index.js';
import { compiledAppCss } from './compiledCss.js';

const KEYS = Object.keys(PLAN_HEADINGS);

test('the printed form keeps the exact headings of the institutional form', () => {
  const printed = Object.values(PLAN_HEADINGS).map((h) => h.toUpperCase());
  assert.deepEqual(printed, [
    'INTENDED LEARNING OUTCOMES (ILO)', 'COURSE CONTENTS', 'SUGGESTED LEARNING ACTIVITIES', 'SUGGESTED ASSESSMENT TASKS', 'EXPECTED VALUE/S TO BE INTEGRATED',
  ]);
});

test('the builder shows the same words as the form, with every word capitalised', () => {
  for (const key of KEYS) {
    assert.equal(dictionaries.en['plan.heading.' + key], PLAN_HEADINGS[key], key + ': the English heading says what the form says');
    for (const word of PLAN_HEADINGS[key].split(' ')) assert.match(word, /^[A-Z(]/, key + ': "' + word + '" starts with a capital');
  }
});

test('every heading has a Tagalog translation that is not just the English text', () => {
  for (const key of KEYS) {
    const tl = dictionaries.tl['plan.heading.' + key];
    assert.ok(tl && tl.trim(), key + ' has a Tagalog heading');
    assert.notEqual(tl, PLAN_HEADINGS[key], key + ' is translated');
  }
});

test('the plan\'s cell text lines up under its heading: the field is pulled back by its own inset', async () => {
  const css = await compiledAppCss();
  const rule = css.match(/\.bld2 \.plan td > \.cell, \.bld2 \.plan \.wkc > \.cell \{([^}]*)\}/);
  assert.ok(rule, 'the alignment rule for the plan cells is there');
  assert.match(rule[1], /margin-inline: -8px/, 'a 1px border and 7px of padding, pulled back');
  assert.match(rule[1], /width: calc\(100% \+ 16px\)/, 'and the width grows by the same amount on both sides');
  assert.match(css, /\.bld2 \.plan td > \.fmt, \.bld2 \.plan \.wkc > \.fmt \{[^}]*margin-inline: -7px/, 'the Formatted view has 7px of padding and no border');
});
