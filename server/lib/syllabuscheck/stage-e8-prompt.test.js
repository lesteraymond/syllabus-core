'use strict';
// Prompt/cache regressions use only local data and injected transports. They establish the instruction and compatibility contracts, not live accuracy.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const gemini = require('./gemini');
const stages = require('./stages');
const { sample } = require('./fixtures');
const { promptFor } = require('./variants');
const C1 = { SYLLABUS_CHECK_STAGE_C1: 'on' }, C2 = { SYLLABUS_CHECK_STAGE_C2: 'on' }, BOTH = { ...C1, ...C2 };
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
test.afterEach(() => gemini.resetProviderBlock());

test('Stage A and C prompt revisions invalidate only the staged versions they change', () => {
  assert.equal(stages.STAGE_REVISION, 7); assert.equal(stages.A_PROMPT_REVISION, 8); assert.equal(stages.C_PROMPT_REVISION, 8);
  for (const [env, version] of [
    [{}, 'alignment-10'], [C1, 'alignment-12c1-r8'], [C2, 'alignment-12c2-r8'], [BOTH, 'alignment-12c1c2-r8'],
    [{ SYLLABUS_CHECK_STAGE_D1: 'on' }, 'alignment-12d1-r7'], [{ SYLLABUS_CHECK_STAGE_D2: 'on' }, 'alignment-12d2-r7'],
    [{ SYLLABUS_CHECK_STAGE_A: 'on' }, 'alignment-12a-r7-a8'],
    [{ ...C1, SYLLABUS_CHECK_STAGE_A: 'on' }, 'alignment-12ac1-r8-a8'],
    [{ ...C1, SYLLABUS_CHECK_STAGE_D2: 'on' }, 'alignment-12c1d2-r8'],
  ]) assert.equal(gemini.promptVersionOf('m', env), version);
  assert.deepEqual(stages.stageFlags({}), { a: false, b: false, b3: false, b4: false, c1: false, c2: false, d1: false, d2: false });
});

test('E.8 all-off scored prompt remains byte exact and unaffected stages exclude corrected C wording', () => {
  const off = promptFor(gemini.PROMPT, 'current', stages.stageFlags({}));
  assert.equal(hash(off), '81d11a069d91ee47c7171bd941f05867d73e6423eebf1ea9d8fa6c06f49d7262');
  for (const env of [{}, { SYLLABUS_CHECK_STAGE_D1: 'on' }, { SYLLABUS_CHECK_STAGE_D2: 'on' }]) {
    const text = gemini.systemPromptOf('current', env, []);
    assert.ok(!text.includes(stages.C1.tests)); assert.ok(!text.includes(stages.C2.tests));
  }
  const full = gemini.systemPromptOf('current', BOTH, []);
  assert.ok(full.includes(stages.C1.tests) && full.includes(stages.C2.tests));
  assert.equal(stages.trimOn(BOTH), false); assert.equal(gemini.minItemsOn(BOTH), false);
});

test('E.8 prompt distinguishes cognitive demands from physical skills and retains genuine practical evidence requirements', () => {
  for (const text of [stages.C1.tests, stages.C2.tests]) {
    for (const demand of ['knowledge/understanding', 'application', 'analysis', 'evaluation', 'design/creation', 'practical skill demonstration']) assert.ok(text.toLowerCase().includes(demand), demand);
    assert.match(text, /action, object and expected evidence together/);
    assert.doesNotMatch(text, /a lecture alone does not develop an Apply-or-higher ILO/);
  }
  assert.match(stages.C1.tests, /Worked examples and guided explanation count as instructional support/);
  assert.match(stages.C1.tests, /never demand hands-on coding, construction or laboratory work for an ILO that only requires conceptual explanation/);
  assert.match(stages.C1.tests, /practical performance ILO needs learners to practise that performance/);
  assert.match(stages.C2.tests, /A genuine practical ILO still needs evidence of the stated performance/);
  assert.match(stages.C2.tests, /format name alone does not establish cognitive difficulty/);
  assert.match(stages.C2.tests, /unseen quiz questions do not prove a precise Bloom level/);
});

test('E.8 prompt keeps feasibility uncertainty separate and requires conditional resources without weakening the competence', () => {
  for (const text of [stages.C1.tests, stages.C2.tests]) {
    assert.match(text, /faculty.confirm/);
    assert.match(text, /feasible alternative/);
    assert.match(text, /explicitly unavailable/);
    assert.match(text, /external participant/);
    assert.match(text, /specialist software/);
    assert.match(text, /faculty feasibility review/);
  }
  assert.match(stages.C1.tests, /uncertainty to state, not evidence by itself that teaching is weak/);
  assert.match(stages.C1.tests, /laboratory zero likewise does not prove practical learning is impossible/);
  assert.match(stages.C2.tests, /rather than automatically changing the academic judgment/);
  assert.match(stages.C2.tests, /must not change the competence measured/);
  const text = stages.C1.tests + stages.C2.tests;
  assert.doesNotMatch(text, /if-else|switch|exam scores|inverting amplifier|starter file|Example Press|af-prog1|af-sensors|as-prog1/);
});

test('E.8 Stage C schema/aspect enums retain the existing provider abstraction and no new cognitive scoring field', () => {
  const keys = gemini.aspectKeysFor(stages.stageFlags(BOTH));
  assert.deepEqual(keys, ['teaching', 'learnerSupport', 'measures', 'evidence', 'level', 'responsible']);
  for (const native of [false, true]) {
    const schema = gemini.alignmentSchema(native, false, keys);
    assert.deepEqual(schema.properties.judgements.items.required, ['id', 'label', 'explanation', 'sourceQuote', 'targetQuote', 'sourceBloom', 'targetBloom', 'draft', ...keys]);
    assert.equal(schema.properties.judgements.minItems, undefined);
  }
});

test('E.8 a saved Stage C r7 response is not reused under r8; the new response is reused without another provider call', async () => {
  const { content, masters } = sample();
  const env = { ...C1, SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only' };
  const pair = { id: 'conceptual', type: 'Activity-fit', source: 'Week 3 course content: storage models\nILOs:\n- Explain the distinction between stack and heap storage.\nContact units stated by the syllabus: lecture 2, laboratory 1', target: 'Lecture-discussion with worked examples and guided explanation.', path: 'plan[2].activities', targetPath: 'plan[2].activities' };
  const model = gemini.providerConfig(env).model, courseKey = gemini.courseKeyOf(gemini.courseOf(content));
  const oldKey = gemini.pairKey(pair, 'gemini', model, 'alignment-12c1-r7', courseKey);
  const currentKey = gemini.pairKey(pair, 'gemini', model, gemini.promptVersionOf(model, env), courseKey);
  assert.notEqual(oldKey, currentKey);
  const old = { ...pair, key: oldKey, label: 'PARTIALLY_ALIGNED', explanation: 'Old practical inference.', draft: 'Add laboratory work.' };
  const snapshot = structuredClone(old);
  let calls = 0;
  const transport = async (_url, req) => {
    calls++;
    assert.ok(JSON.parse(req.body).systemInstruction.parts[0].text.includes(stages.C1.tests));
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: [{ id: pair.id, label: 'ALIGNED', explanation: 'The discussion supports the stated conceptual explanation.', sourceQuote: 'Explain the distinction between stack and heap storage.', targetQuote: pair.target, sourceBloom: 'Understand', targetBloom: 'Understand', draft: '', teaching: 'sound', learnerSupport: 'adequate', measures: 'not_assessed', evidence: 'not_assessed', level: 'not_assessed', responsible: 'none' }] }) }] } }] }) };
  };
  const first = await gemini.align(content, masters, { env, pairs: [pair], reuse: new Map([[oldKey, old]]), transport });
  assert.equal(calls, 1); assert.deepEqual(first.reuse, { reused: 0, asked: 1, requests: 1 });
  assert.equal(first.judgements[0].label, 'ALIGNED'); assert.equal(first.judgements[0].key, currentKey);
  const second = await gemini.align(content, masters, { env, pairs: [pair], reuse: new Map([[currentKey, first.judgements[0]]]), transport: async () => { throw Error('a current cached answer must not call a provider'); } });
  assert.deepEqual(second.reuse, { reused: 1, asked: 0, requests: 0 });
  assert.equal(second.judgements[0].label, 'ALIGNED'); assert.deepEqual(old, snapshot, 'old reports remain readable and unchanged');
});
