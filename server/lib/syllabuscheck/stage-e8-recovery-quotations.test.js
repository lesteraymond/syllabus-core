'use strict';
// The twelve quotations of the E.8 resource recovery, verified again from the raw model content. Saved responses only: no network or provider.
const test = require('node:test');
const assert = require('node:assert/strict');
const gemini = require('./gemini');
const dataset = require('./eval/stage-c-dataset.json');
const recovery = require('../../../docs/ai-eval-stage-e8-c-resource-recovery.json');
const C = { SYLLABUS_CHECK_STAGE_C1: 'on', SYLLABUS_CHECK_STAGE_C2: 'on' };
const pairOf = id => ({ ...dataset.items.find(p => p.id === id), path: 'eval', targetPath: 'eval' });
// Request 22 was the empty list: it carries no quotation and was answered again by request 23.
const answered = recovery.requests.map(r => ({ n: r.n, raw: JSON.parse(r.content) })).filter(r => r.raw.judgements.length);

test('E.8 recovery: all 12 quotations are verbatim copies of their texts, stored exactly as the model returned them', () => {
  let quotes = 0;
  for (const { raw } of answered) for (const j of raw.judgements) {
    const pair = pairOf(j.id), saved = recovery.answers[0][j.id];
    for (const side of ['source', 'target']) {
      assert.ok(pair[side].includes(j[side + 'Quote']), `${j.id} ${side}`);
      assert.equal(saved[side + 'Quote'], j[side + 'Quote'], `${j.id} ${side}`); assert.equal(saved.evidenceMatching[side], 'exact', `${j.id} ${side}`);
      quotes++;
    }
  }
  assert.deepEqual([answered.map(r => r.n), quotes], [[23, 24, 25], 12]);
});

test('E.8 recovery: a quotation changed in one letter\'s case or by one dropped character is refused, so no altered quotation passes', () => {
  for (const { raw } of answered) {
    const pairs = raw.judgements.map(j => pairOf(j.id)), contract = gemini.contractOf(C, dataset.courses[pairs[0].course]);
    for (const j of raw.judgements) for (const side of ['source', 'target']) {
      const quote = j[side + 'Quote'], i = quote.search(/[a-z]/i), flipped = quote[i] === quote[i].toUpperCase() ? quote[i].toLowerCase() : quote[i].toUpperCase();
      for (const altered of [quote.slice(0, i) + flipped + quote.slice(i + 1), quote.slice(0, -2) + quote.slice(-1)]) {
        const tampered = { judgements: raw.judgements.map(x => (x.id === j.id ? { ...x, [side + 'Quote']: altered } : x)) };
        assert.throws(() => gemini.validate(tampered, pairs, contract), e => (e.problems || []).some(p => /^quote_/.test(p.code)), `${j.id} ${side}: ${altered}`);
      }
    }
  }
});
