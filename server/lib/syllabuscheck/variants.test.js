const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('./fixtures');
const { PROMPT, pairsOf, requestOpenRouter, requestGemini, promptVersionOf, align } = require('./gemini');
const { NAMES, variantOf, promptFor, explanationFirst } = require('./variants');

const DOUBT = 'When in doubt between ALIGNED and PARTIALLY_ALIGNED, choose PARTIALLY_ALIGNED';

test('production uses the current prompt unless a variant is named, and an unknown name falls back to current', () => {
  const ON = { SYLLABUS_CHECK_STAGE_A: 'on' };
  assert.equal(variantOf({}), 'current');
  assert.equal(variantOf(ON), 'current');
  assert.equal(variantOf({ ...ON, SYLLABUS_CHECK_PROMPT_VARIANT: '' }), 'current');
  assert.equal(variantOf({ ...ON, SYLLABUS_CHECK_PROMPT_VARIANT: 'nonsense' }), 'current');
  assert.equal(variantOf({ SYLLABUS_CHECK_PROMPT_VARIANT: 'RUBRIC' }), 'rubric');
  assert.equal(promptFor(PROMPT, 'current'), PROMPT);
  assert.equal(promptVersionOf('google/gemini-x', {}), 'alignment-10');
});

test('every variant can be built from the current prompt, differs from it, and has its own prompt version', () => {
  const versions = new Set();
  for (const name of NAMES) {
    const text = promptFor(PROMPT, name);
    if (name !== 'current') assert.notEqual(text, PROMPT, name);
    versions.add(promptVersionOf('google/gemini-x', { SYLLABUS_CHECK_STAGE_A: 'on', SYLLABUS_CHECK_PROMPT_VARIANT: name }));
  }
  assert.equal(versions.size, NAMES.length, 'a verdict made under one wording is never reused under another');
});

test('the calibrated variants drop the "when in doubt choose PARTIAL" rule and define the four verdicts instead', () => {
  assert.ok(PROMPT.includes(DOUBT), 'the current prompt still has it');
  for (const name of ['calibrated', 'rubric', 'rubric-ordered']) {
    const text = promptFor(PROMPT, name);
    assert.ok(!text.includes(DOUBT), name);
    assert.match(text, /PARTIALLY_ALIGNED is not a fallback for uncertainty/);
    assert.match(text, /INSUFFICIENT_EVIDENCE: only when a text is missing, empty or unreadable/);
  }
});

test('only the rubric variants change the relationship rubric, and they keep the lesson-level multi-part rule', () => {
  assert.ok(!promptFor(PROMPT, 'calibrated').includes('does the CLO contribute to the program outcome'));
  for (const name of ['rubric', 'rubric-ordered']) {
    const text = promptFor(PROMPT, name);
    assert.match(text, /does the CLO contribute to the program outcome or graduate attribute\?/);
    assert.match(text, /does the ILO contribute to achieving the CLO\?/);
    assert.match(text, /the tag \(the PO number\) is not evidence of meaning/);
    assert.match(text, /For the lesson-level relationships \(ILO-activity, ILO-content, ILO-assessment, Module-value\)/);
    assert.ok(!text.includes('every one must be shown. If one is missing the pair is PARTIALLY_ALIGNED, not ALIGNED.'), 'the multi-part rule no longer applies to outcome mappings');
  }
});

test('a variant changes the prompt the provider receives and, for rubric-ordered, the order of the fields; the default is untouched', async () => {
  const { content, masters } = sample();
  const pairs = pairsOf(content, masters).slice(0, 2);
  const capture = async (variant, request) => {
    let body;
    const env = { OPENROUTER_API_KEY: 'k', OPENROUTER_MODEL: 'google/gemini-3.8-flash', SYLLABUS_CHECK_PROMPT_VARIANT: variant };
    const transport = async (url, req) => { body = JSON.parse(req.body); return { ok: false, status: 500, json: async () => ({}) }; };
    await request(pairs, { env, transport }).catch(() => {});
    return body;
  };
  const current = await capture('current', requestOpenRouter);
  const ordered = await capture('rubric-ordered', requestOpenRouter);
  const keys = body => Object.keys(body.response_format.json_schema.schema.properties.judgements.items.properties);
  assert.ok(current.messages[0].content.includes(DOUBT));
  assert.deepEqual(keys(current).slice(0, 3), ['id', 'label', 'explanation']);
  assert.ok(!ordered.messages[0].content.includes(DOUBT));
  assert.deepEqual(keys(ordered), ['id', 'explanation', 'sourceQuote', 'targetQuote', 'sourceBloom', 'targetBloom', 'label', 'draft']);
  assert.equal(explanationFirst('rubric'), false);
  // The same schema is a valid contract either way: the same fields are required.
  assert.deepEqual([...keys(current)].sort(), [...keys(ordered)].sort());
  let gemini;
  await requestGemini(pairs, { env: { GEMINI_API_KEY: 'k', SYLLABUS_CHECK_PROMPT_VARIANT: 'calibrated' }, transport: async (url, req) => { gemini = JSON.parse(req.body); return { ok: false, status: 500 }; } }).catch(() => {});
  assert.ok(!gemini.systemInstruction.parts[0].text.includes(DOUBT));
});

test('a check run under a variant is cached under that variant\'s version, so it cannot contaminate the default', async () => {
  const { content, masters } = sample();
  const verdict = p => ({ id: p.id, label: 'ALIGNED', explanation: 'ok', sourceQuote: p.source.slice(0, 8), targetQuote: p.target.slice(0, 8), sourceBloom: 'Apply', targetBloom: 'Apply', draft: '' });
  const calls = [];
  const transport = async (url, req) => { const batch = JSON.parse(JSON.parse(req.body).messages[1].content).document_data; calls.push(batch.length); return { ok: true, json: async () => ({ model: 'google/gemini-3.8-flash', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ judgements: batch.map(verdict) }) } }] }) }; };
  const base = { OPENROUTER_API_KEY: 'k', OPENROUTER_MODEL: 'google/gemini-3.8-flash', SYLLABUS_CHECK_AI_PROVIDER: 'openrouter' };
  const first = await align(content, masters, { env: { ...base, SYLLABUS_CHECK_PROMPT_VARIANT: 'rubric' }, transport });
  const reuse = new Map(first.judgements.map(j => [j.key, j]));
  assert.equal(first.promptVersion, 'alignment-10-rubric');
  calls.length = 0;
  const sameVariant = await align(content, masters, { env: { ...base, SYLLABUS_CHECK_PROMPT_VARIANT: 'rubric' }, transport, reuse });
  assert.equal(calls.length, 0, 'the same variant reuses');
  const defaulted = await align(content, masters, { env: base, transport, reuse });
  assert.ok(calls.length > 0 && defaulted.reuse.reused === 0, 'the default prompt does not reuse verdicts made under a variant');
  assert.equal(sameVariant.reuse.reused, first.judgements.length);
});
