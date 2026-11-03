const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('./fixtures');
const { pairsOf, validate, salvage, rejections, PROMPT } = require('./gemini');

// Defects found by reading the model's own explanations (see docs/ai-eval-diagnosis.md):
//  - an ILO-CLO pair was answered INSUFFICIENT_EVIDENCE ("no ILO is supplied") because the prompt never said that the CLO is the source
//    and the ILO is the target;
//  - a REF-plan batch was refused because the model copied the TARGET text as its sourceQuote;
//  - a REF-plan page about cooking was labelled ALIGNED while the explanation said it cannot support the course.
const link = { url: 'https://example.org/book', status: 'ok', page: { title: 'Calculus notes', text: 'Limits and derivatives.' } };
const everyType = () => {
  const { content, masters } = sample();
  return [...new Set(pairsOf(content, masters, [link]).map(p => p.type))];
};
const direction = PROMPT.slice(PROMPT.indexOf('What "source" and "target" are'), PROMPT.indexOf('Tests, by pair type'));

test('the prompt says which side is the source and which the target for EVERY relationship the code produces', () => {
  const types = everyType();
  for (const required of ['CLO-PO', 'CLO-anyPO', 'CLO-anyEGA', 'ILO-CLO', 'ILO-activity', 'ILO-content', 'ILO-assessment', 'Module-value', 'Description-plan', 'REF-plan']) {
    assert.ok(types.includes(required), 'the sample produces ' + required);
  }
  for (const type of types) assert.ok(direction.includes(type), `the direction paragraph covers ${type}`);
  assert.match(direction, /ILO-CLO: source = the CLO statement; target = the ILO text/);
  assert.match(direction, /so it is never missing/, 'the ILO is never "not supplied"');
});

test('the prompt tells the model to quote each side from its own text and to keep the label consistent with the explanation', () => {
  assert.match(PROMPT, /sourceQuote is copied from the pair's "source" text only and targetQuote from its "target" text only/);
  assert.match(PROMPT, /label must agree with your explanation/);
  assert.match(PROMPT, /REF-plan \(advice only\): \(1\)/, 'REF-plan has tests like every other type');
});

test('a reference answer that quotes the target for the source is refused, says which quote failed, and does not hide the answers that were fine', () => {
  const { content, masters } = sample();
  const refs = pairsOf(content, masters, [link, { ...link, url: 'https://example.org/two' }]).filter(p => p.type === 'REF-plan');
  assert.equal(refs.length, 2);
  const answer = (pair, sourceQuote) => ({ id: pair.id, label: 'NOT_ALIGNED', explanation: 'Unrelated.', sourceQuote, targetQuote: pair.target.slice(0, 12), sourceBloom: 'N/A', targetBloom: 'N/A', draft: '' });
  const raw = { judgements: [answer(refs[0], refs[0].target.slice(0, 12)), answer(refs[1], refs[1].source.slice(0, 12))] };
  assert.throws(() => validate(raw, refs), error => error.code === 'quote_wrong_side' && /source quote is copied from the target text/.test(error.message));
  assert.deepEqual(salvage(raw, refs).map(j => j.id), [refs[1].id]);
  // Stage E.5: a refused quote keeps its details for debugging (which quote failed, and the quotes as answered)
  assert.deepEqual(rejections(raw, refs), [{ id: refs[0].id, reason: 'AI source quote is copied from the target text, not from the source text', code: 'quote_wrong_side',
    problems: [{ code: 'quote_wrong_side', side: 'source' }], given: { sourceQuote: refs[0].target.slice(0, 12), targetQuote: refs[0].target.slice(0, 12) } }]);
});

test('rejections names a missing, repeated or unrequested id, and a target quote that is not in the target', () => {
  const { content, masters } = sample();
  const ps = pairsOf(content, masters).filter(p => p.source && p.target).slice(0, 4);
  const good = p => ({ id: p.id, label: 'ALIGNED', explanation: 'ok', sourceQuote: p.source.slice(0, 8), targetQuote: p.target.slice(0, 8), sourceBloom: 'Apply', targetBloom: 'Apply', draft: '' });
  const raw = { judgements: [good(ps[0]), good(ps[0]), { ...good(ps[2]), targetQuote: 'not in the target text' }, { ...good(ps[3]), id: 'invented' }] };
  assert.deepEqual(rejections(raw, ps), [
    { id: ps[0].id, reason: 'answered more than once', code: 'duplicate_id' },
    { id: ps[1].id, reason: 'not answered', code: 'not_answered' },
    { id: ps[2].id, reason: 'AI evidence is not present in the supplied text (target quote)', code: 'quote_not_found', problems: [{ code: 'quote_not_found', side: 'target' }], given: { sourceQuote: ps[2].source.slice(0, 8), targetQuote: 'not in the target text' } },
    { id: ps[3].id, reason: 'not answered', code: 'not_answered' },
    { id: 'invented', reason: 'not a requested id', code: 'unknown_id' },
  ]);
  assert.deepEqual(rejections('nonsense', ps), [{ id: '*', reason: 'the answer is not an object with a judgements list', code: 'invalid_answer' }]);
});

test('a refused answer carries the reasons on the error, for logs and for the evaluation report', () => {
  const { content, masters } = sample();
  const [pair] = pairsOf(content, masters).filter(p => p.source && p.target);
  const { requestOpenRouter, NEMOTRON_FREE } = require('./gemini');
  const env = { SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'k', OPENROUTER_MODEL: NEMOTRON_FREE };
  const bad = { judgements: [{ id: pair.id, label: 'ALIGNED', explanation: 'ok', sourceQuote: 'nope', targetQuote: pair.target.slice(0, 8), sourceBloom: 'Apply', targetBloom: 'Apply', draft: '' }] };
  const transport = async () => ({ ok: true, json: async () => ({ model: NEMOTRON_FREE, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(bad) } }] }) });
  return assert.rejects(requestOpenRouter([pair], { env, transport }), error => error.unverified === true && error.rejected[0].id === pair.id && /source quote/.test(error.rejected[0].reason));
});
