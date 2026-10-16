import test from 'node:test';
import assert from 'node:assert/strict';
import { sentenceCase } from './sentenceCase.js';

test('only the first letter is a capital', () => {
  assert.equal(sentenceCase('Under Review'), 'Under review');
  assert.equal(sentenceCase('For Revision'), 'For revision');
  assert.equal(sentenceCase('My Submissions'), 'My submissions');
  assert.equal(sentenceCase('Programs'), 'Programs');
});

test('short all-capital words are acronyms and keep their capitals', () => {
  assert.equal(sentenceCase('AI Compliance Score'), 'AI compliance score');
  assert.equal(sentenceCase('Total CO Coverage'), 'Total CO coverage');
});

test('Tagalog labels and empty values are handled', () => {
  assert.equal(sentenceCase('Aking mga Naipasa'), 'Aking mga naipasa');
  assert.equal(sentenceCase(''), '');
  assert.equal(sentenceCase(undefined), undefined);
});
