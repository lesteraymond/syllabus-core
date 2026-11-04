'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { evidenceQuote, validate } = require('./gemini');

test('line-break flattening recovers the actual syllabus evidence without rewriting it', () => {
  const source = 'Chain rule\nWork through chain rule using an engineering example.\r\n\tSubmit calculations.';
  const returned = 'Chain rule Work through chain rule using an engineering example. Submit calculations.';
  assert.deepEqual(evidenceQuote(source, returned), { text: source, match: 'whitespace' });
  assert.deepEqual(evidenceQuote('First.\n\nUse\t\tverified calculations. Last.', 'Use verified calculations.'), { text: 'Use\t\tverified calculations.', match: 'whitespace' });
  assert.deepEqual(evidenceQuote('Respect\u00a0and compassion.', 'Respect and compassion.'), { text: 'Respect\u00a0and compassion.', match: 'whitespace' });
});

test('evidence matching still rejects changed meaning, spelling, punctuation, case and invented quotes', () => {
  const source = 'Design a safe engineering model.\nVerify the derivative.';
  for (const quote of ['Design an unsafe engineering model.', 'design a safe engineering model.', 'Design a safe engineering model!', 'Design a safe engineering model. Verify its derivative.', 'Design ... Verify', '', '   ', null, 123]) assert.equal(evidenceQuote(source, quote), null, String(quote));
  assert.equal(evidenceQuote('Verify derivatives', 'Verifyderivatives'), null);
});

test('validated judgments persist original spans and annotate whitespace-only matching', () => {
  const pair = { id: 'week10-value', source: 'Chain rule\nCompare assumptions.', target: 'Community-orientedness:\nprotect workers.', path: 'plan[9].values', targetPath: 'plan[9].values', type: 'Module-value' };
  const judgement = { id: pair.id, label: 'ALIGNED', explanation: 'Peer review addresses consequences for workers.', sourceQuote: 'Chain rule Compare assumptions.', targetQuote: 'Community-orientedness: protect workers.', sourceBloom: 'Analyze', targetBloom: 'N/A', draft: '' };
  const [result] = validate({ judgements: [judgement] }, [pair]);
  assert.equal(result.sourceQuote, pair.source);
  assert.equal(result.targetQuote, pair.target);
  assert.deepEqual(result.evidenceMatching, { source: 'whitespace', target: 'whitespace' });
  assert.equal(pair.source.includes(result.sourceQuote), true);
  assert.throws(() => validate({ judgements: [{ ...judgement, sourceQuote: 'Invented model answer' }] }, [pair]), /evidence is not present/);
});
