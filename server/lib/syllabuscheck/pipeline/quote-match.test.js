'use strict';
// A model's quote must be in the question's texts (prompt.js validateAnswers). Typographic variants it may type differently when it copies are not a
// different quote: before, a dash or an ellipsis copied as "-" or "..." rejected a correct answer, and twice rejected the question stayed unanswered and
// the whole check incomplete. A quote that is really not in the texts is still rejected. Offline.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('./testSyllabus');
const P = require('./prompt');
const R = require('./rules');
const { extract } = require('./extract');
const { questionsOf } = require('./judge');

function question(contents) {
  const c = T.conforming();
  const row = c.plan.find(r => r.kind === 'lesson' && r.week && !/orientation/i.test(r.contents));
  row.contents = contents;
  return questionsOf(extract(c, undefined)).find(q => q.relationship === 'CONTENT-TITLE' && q.from.text === contents.replace(/\s+/g, ' ').trim());
}
const validate = (q, quote) => P.validateAnswers({ questions: [q] }, JSON.stringify({ answers: [{ q: q.id, items: R.CHECKLISTS[q.relationship].items.map(i => ({ id: i.id, answer: 'yes' })), quote, explanation: 'scripted' }] }));

test('a quote that differs only in dashes, hyphens, ellipses, quote marks or invisible characters is the same quote', () => {
  const q = question('Graph coloring – chromatic numbers, the four‑color theorem… and “planar” graphs—a survey of the grap­hs');
  assert.ok(q, 'the question exists');
  for (const quote of [
    'Graph coloring – chromatic numbers', // as written
    'Graph coloring - chromatic numbers', // en dash typed as a hyphen
    'the four-color theorem', // non-breaking hyphen typed as a hyphen
    'four-color theorem... and', // ellipsis character typed as three dots
    '"planar" graphs-a survey', // curly quotes and an em dash typed plainly
    'survey of the graphs', // a soft hyphen inside a word
    'GRAPH   COLORING – chromatic', // case and spacing
  ]) {
    const out = validate(q, quote);
    assert.ok(out.answers.has(q.id), `${JSON.stringify(quote)}: ${JSON.stringify(out.rejected)}`);
    assert.equal(out.answers.get(q.id).quote.length > 0, true);
  }
});

test('a quote that is not in the texts is still refused', () => {
  const q = question('Graph coloring – chromatic numbers');
  for (const quote of ['Graph colouring - chromatic numbers', 'binary search trees', 'Graph coloring chromatic numbers']) {
    const out = validate(q, quote);
    assert.ok(!out.answers.has(q.id), JSON.stringify(quote));
    assert.equal(out.rejected[0].reason, 'the quote is not in the texts');
  }
});
