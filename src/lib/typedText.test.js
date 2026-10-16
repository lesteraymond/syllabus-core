// Run: npm test. Text a person types (an ILO, a description paragraph) can hold a very long word and a line break. A text box shows both,
// so the Formatted view and the finished form must too: the word wraps inside its cell, and the line break stays a line break.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compiledAppCss } from './compiledCss.js';

const source = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
// every rule that has exactly this selector (a selector can have several rules), their declarations joined
const rule = (css, selector) => { let out = ''; for (let i = css.indexOf(selector + ' {'); i >= 0; i = css.indexOf(selector + ' {', i + 1)) out += css.slice(i, css.indexOf('}', i)); return out; };

test('the finished form wraps long words inside their cell and keeps typed line breaks', async () => {
  const css = await compiledAppCss();
  assert.match(rule(css, ':is(.bld2, .svm-paper) .paper'), /overflow-wrap: anywhere/, 'a long word breaks inside its cell');
  assert.match(rule(css, ':is(.bld2, .svm-paper) .paper .typed-text'), /white-space: pre-line/, 'a typed line break is kept');
});

test('the Learning Plan step does the same in its Formatted view', async () => {
  const css = await compiledAppCss();
  assert.match(rule(css, '.bld2 .fmt'), /overflow-wrap: anywhere/);
  assert.match(rule(css, '.bld2 .typed-text'), /white-space: pre-line/);
});

test('everything a person types into a text box is marked as typed text where it is shown', () => {
  const paper = source('../views/builder2/FormPaper.jsx');
  assert.equal(paper.split('typed-text').length - 1, 3, 'FormPaper: the description paragraphs, the exam ILO and the lesson ILOs');
  assert.match(source('../views/builder2/PlanStep.jsx'), /className="fmt typed-text"/, 'PlanStep: the ILO in the Formatted view');
});
