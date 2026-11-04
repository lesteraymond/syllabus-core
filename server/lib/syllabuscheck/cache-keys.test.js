const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('./fixtures');
const { align, pairsOf, pairKey, courseOf, courseKeyOf, promptVersionOf, NEMOTRON_FREE } = require('./gemini');

// A verdict is reused only when every input that can change it is unchanged, and an unrelated edit keeps the others.
const env = { SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-only-router-key', OPENROUTER_MODEL: NEMOTRON_FREE };
const verdict = pair => ({ id: pair.id, label: 'ALIGNED', explanation: 'Fits.', sourceQuote: pair.source.slice(0, 10), targetQuote: pair.target.slice(0, 10), sourceBloom: 'Apply', targetBloom: 'Apply', draft: '' });
const recorder = () => {
  const sent = [];
  const transport = async (url, request) => {
    const pairs = JSON.parse(JSON.parse(request.body).messages[1].content).document_data;
    sent.push(...pairs.map(p => p.id));
    return { ok: true, json: async () => ({ model: NEMOTRON_FREE, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ judgements: pairs.map(verdict) }) } }] }) };
  };
  return { sent, transport };
};
const reuseOf = result => new Map(result.judgements.map(j => [j.key, j]));
const first = async (content, masters, links) => { const r = recorder(); const result = await align(content, masters, { env, transport: r.transport, links }); return { result, sent: r.sent }; };
const again = async (content, masters, earlier, links) => { const r = recorder(); await align(content, masters, { env, transport: r.transport, reuse: reuseOf(earlier), links }); return r.sent; };

test('1. identical inputs reuse every verdict', async () => {
  const { content, masters } = sample();
  const { result } = await first(content, masters);
  assert.deepEqual(await again(structuredClone(content), structuredClone(masters), result), []);
});

test('2. a changed target text asks again only about the relationships that use it', async () => {
  const { content, masters } = sample();
  const { result } = await first(content, masters);
  const edited = structuredClone(content);
  edited.clos[0].statement += ' and justify the result';
  const sent = await again(edited, masters, result);
  assert.ok(sent.length > 0 && sent.length < pairsOf(edited, masters).length);
  assert.ok(sent.filter(id => /^clo0-/.test(id)).length > 0, 'the edited CLO is asked again');
  assert.ok(!sent.some(id => /^clo1-/.test(id)), 'another CLO is not');
});

test('3. a changed source text (an official PO) asks again about the CLOs judged against it', async () => {
  const { content, masters } = sample();
  const { result } = await first(content, masters);
  const changed = structuredClone(masters);
  changed.pos[0].text += ' and communicate the result';
  const sent = await again(content, changed, result);
  assert.ok(sent.length > 0, 'the relationships that read that PO are asked again');
  assert.ok(sent.every(id => /^clo\d+-(po1|anypo)$/.test(id)), 'and only those: ' + sent.join(','));
});

test('4. a changed course description, title, program or year level is a different question for every relationship', async () => {
  const { content, masters } = sample();
  const { result } = await first(content, masters);
  const total = pairsOf(content, masters).length;
  for (const edit of [c => { c.description[0].t += ' New focus.'; }, c => { c.meta.title = 'A different course'; }, c => { c.meta.program = 'BSXX'; }, c => { c.meta.yearLevel = '4'; }]) {
    const changed = structuredClone(content);
    edit(changed);
    const sent = await again(changed, masters, result);
    assert.equal(sent.length, total, 'every relationship is asked again after ' + edit.toString());
  }
});

test('5. a changed prompt version is a different question', () => {
  const { content, masters } = sample();
  const pair = pairsOf(content, masters)[0];
  const course = courseKeyOf(courseOf(content));
  assert.notEqual(pairKey(pair, 'openrouter', NEMOTRON_FREE, 'alignment-nemotron-8', course), pairKey(pair, 'openrouter', NEMOTRON_FREE, promptVersionOf(NEMOTRON_FREE), course));
});

test('6. a changed reference page asks again about that reference only', async () => {
  const { content, masters } = sample();
  const page = text => ({ url: 'https://example.org/book', status: 'ok', page: { title: 'Calculus notes', text } });
  const { result } = await first(content, masters, [page('Limits and derivatives.')]);
  const sent = await again(content, masters, result, [page('A completely different page about cooking.')]);
  assert.deepEqual(sent, ['ref0']);
  assert.deepEqual(await again(content, masters, result, [page('Limits and derivatives.')]), [], 'the same page is reused');
});

test('7. unrelated edits do not invalidate anything: units, requirements, grading and the CLO list wording elsewhere', async () => {
  const { content, masters } = sample();
  const { result } = await first(content, masters);
  const changed = structuredClone(content);
  changed.meta.lecture = '3';
  changed.meta.prereq = 'Another prerequisite';
  assert.deepEqual(await again(changed, masters, result), []);
});
