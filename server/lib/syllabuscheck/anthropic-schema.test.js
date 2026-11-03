'use strict';
// Structured-output compatibility with Claude (anthropicSchema.js), offline: every schema this checker can send passes the lint built from Anthropic's
// structured-outputs rules, a schema the API would refuse is refused before anything is sent, the response envelope is read the same way whatever blocks
// come before the text, and an enum value that differs only in capitalisation is still refused but counted apart. The global fetch is blocked for this
// whole file, and no key here is a real key.
const test = require('node:test');
const assert = require('node:assert/strict');
const realFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new TypeError('fetch failed (network blocked in anthropic-schema.test.js)'); };
test.after(() => { globalThis.fetch = realFetch; });
const gemini = require('./gemini');
const { alignmentSchema, contractOf, requestAnthropic, align, pairsOf, courseOf, classifyFailure, resetProviderBlock } = gemini;
const { NAMES, explanationFirst } = require('./variants');
const { anthropicMessage } = require('./anthropicClient');
const { askJson } = require('./modelClient');
const { schemaProblems, caseOnlyEnumMismatches, patternProblem } = require('./anthropicSchema');
const { refineSuggestion, getValue } = require('./refine');
const { sample } = require('./fixtures');

const KEY = 'sk-ant-test-only-not-a-real-key';
const MODEL = 'claude-sonnet-5-5';
const env = { SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: KEY, ANTHROPIC_MODEL: MODEL, SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: MODEL };
const STAGES = ['A', 'B', 'B3', 'B4', 'C1', 'C2', 'D1', 'D2'];
const stagesOf = mask => Object.fromEntries(STAGES.map((stage, i) => [`SYLLABUS_CHECK_STAGE_${stage}`, mask & (1 << i) ? 'on' : 'off']));
const USAGE = { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 3000, cache_read_input_tokens: 0 };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_offline' } });
const message = (text, extra = {}) => json({ id: 'msg_offline', type: 'message', role: 'assistant', model: MODEL, content: [{ type: 'text', text }], stop_reason: 'end_turn', stop_sequence: null, usage: USAGE, ...extra });
function fake(answer) {
  const calls = [];
  const transport = async (url, init) => { const body = JSON.parse(init.body); calls.push(body); return answer(body, calls.length); };
  return { calls, transport };
}
const asked = body => JSON.parse(body.messages[0].content).document_data;
const judgement = pair => ({ id: pair.id, label: 'NOT_ALIGNED', explanation: 'Recall of flowers does not demonstrate engineering problem solving.', sourceQuote: pair.source.slice(0, 10), targetQuote: pair.target.slice(0, 10), sourceBloom: 'Create', targetBloom: 'Remember', draft: 'Construct a mathematical solution and demonstrate it with worked test cases.' });
const one = () => { const { content, masters } = sample(); return { pairs: pairsOf(content, masters).slice(0, 1), course: courseOf(content) }; };
test.beforeEach(() => resetProviderBlock());

test('every alignment schema the checker can send to Claude passes the lint: all 256 stage combinations under each prompt variant', () => {
  const distinct = new Set();
  let widest = 0;
  for (let mask = 0; mask < 2 ** STAGES.length; mask += 1) {
    for (const variant of NAMES) {
      const settings = { ...stagesOf(mask), SYLLABUS_CHECK_PROMPT_VARIANT: variant };
      const contract = contractOf(settings);
      const schema = alignmentSchema(false, explanationFirst(variant), contract.aspectKeys, contract.recommend);
      assert.deepEqual(schemaProblems(schema), [], `stages ${mask.toString(2).padStart(8, '0')} variant ${variant}`);
      // Every field is required (no optional property, no union), so Claude writes them in the order of the schema and the explanation-first
      // variant keeps its order.
      const item = schema.properties.judgements.items;
      assert.deepEqual(item.required, Object.keys(item.properties));
      widest = Math.max(widest, item.required.length);
      distinct.add(JSON.stringify(schema));
    }
  }
  assert.equal(widest, 22, 'every stage on: 8 fields, the recommendation and 13 stage fields');
  assert.ok(distinct.size > 1);
  // minItems: 1 (Stage E.6, OpenRouter only, never sent to Claude) is within Anthropic's limits too; 2 is not.
  const contract = contractOf(stagesOf(255));
  assert.deepEqual(schemaProblems(alignmentSchema(false, false, contract.aspectKeys, contract.recommend, 1)), []);
  assert.match(schemaProblems(alignmentSchema(false, false, contract.aspectKeys, contract.recommend, 2)).join(), /minItems 2 is not supported/);
  // The Gemini form of the same schema (upper-case type names, no additionalProperties) is not one Claude takes.
  assert.ok(schemaProblems(alignmentSchema(true, false, contract.aspectKeys, contract.recommend)).length > 0);
});

test('the schema a request carries is exactly the one linted, for the stages and variants that change it', async () => {
  const { pairs, course } = one();
  for (const stages of [[], ['A'], ['B3'], ['C1'], ['C2'], ['D1'], ['D2'], STAGES]) {
    for (const variant of ['current', 'rubric-ordered']) {
      const settings = { ...env, ...stagesOf(stages.reduce((mask, stage) => mask | (1 << STAGES.indexOf(stage)), 0)), SYLLABUS_CHECK_PROMPT_VARIANT: variant, SYLLABUS_CHECK_VALUES_FILE: 'no-such-file.json' };
      const sent = fake(() => message(JSON.stringify({ judgements: pairs.map(judgement) })));
      await requestAnthropic(pairs, { env: settings, transport: sent.transport, course }).catch(() => {}); // only the request is compared here
      const contract = contractOf(settings);
      assert.equal(sent.calls.length, 1, `${stages.join('+') || 'no stage'} ${variant}`);
      assert.deepEqual(sent.calls[0].output_config.format, { type: 'json_schema', schema: alignmentSchema(false, explanationFirst(variant), contract.aspectKeys, contract.recommend) });
    }
  }
});

test('the schema of an AI rewrite through Claude passes the lint', async () => {
  const { content, masters } = sample();
  // A pretend judge as in refine.test.js: a CLO-PO relationship is a problem until its text carries [fit]; any text carrying [bad] is a problem.
  const verdict = pair => {
    const text = pair.source + ' ' + pair.target, problem = text.includes('[bad]') || (pair.type === 'CLO-PO' && !text.includes('[fit]'));
    return { id: pair.id, label: problem ? 'NOT_ALIGNED' : 'ALIGNED', explanation: problem ? 'Does not fit.' : 'Fits.', sourceQuote: pair.source.slice(0, 6), targetQuote: pair.target.slice(0, 6), sourceBloom: 'Apply', targetBloom: 'Apply', draft: problem ? 'A draft.' : '' };
  };
  const path = 'clos[0].statement', original = getValue(content, path);
  const ai = fake(body => { const data = asked(body); return message(JSON.stringify(Array.isArray(data) ? { judgements: data.map(verdict) } : { text: original + ' [fit]' })); });
  const report = { hybrid: { alignment: await align(content, masters, { env, transport: ai.transport }) } };
  assert.equal(report.hybrid.alignment.status, 'completed');
  const out = await refineSuggestion({ content, masters, report, suggestion: { id: 'SEM:x', path, source: 'ai', originalValue: original, replacement: original + ' [fit] [bad]' }, options: { env, transport: ai.transport } });
  assert.deepEqual([out.status, out.usedRewrite], ['verified', true]);
  const rewrites = ai.calls.filter(body => !Array.isArray(asked(body)));
  assert.equal(rewrites.length, 1);
  assert.deepEqual(rewrites[0].output_config.format.schema, { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false });
  assert.deepEqual(schemaProblems(rewrites[0].output_config.format.schema), []);
});

test('the lint accepts what Anthropic supports and names each thing it does not', () => {
  const object = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
  const string = { type: 'string' };
  const supported = {
    ...object({
      code: { type: 'string', pattern: '^[A-Z]{2,4}-\\d{3}$', description: 'A course code' }, slash: { type: 'string', pattern: '^a\\\\b$' }, when: { type: 'string', format: 'date' },
      kind: { const: 'syllabus' }, level: { enum: ['low', 'high', 1, true, null] }, note: { type: ['string', 'null'], default: null },
      either: { anyOf: [string, { type: 'integer' }] }, both: { allOf: [string, { title: 'A string' }] },
      items: { type: 'array', items: { $ref: '#/$defs/item' }, minItems: 1 }, more: { type: 'array', items: { $ref: '#/definitions/other' }, minItems: 0 },
    }, ['code', 'when', 'kind', 'level', 'items']),
    $defs: { item: object({ name: string }) }, definitions: { other: object({ value: { type: 'number' } }), unused: object({ flag: { type: 'boolean' } }) },
  };
  assert.deepEqual(schemaProblems(supported), []);
  // 24 optional properties and 16 union types are the most a request may carry.
  const many = (n, schema) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`p${i}`, schema]));
  assert.deepEqual(schemaProblems(object(many(24, string), [])), []);
  assert.deepEqual(schemaProblems(object(many(16, { type: ['string', 'null'] }))), []);
  const refused = [
    [object(many(25, string), []), '$: 25 optional properties (at most 24)'],
    [object(many(17, { anyOf: [string, { type: 'null' }] })), '$: 17 union types (at most 16)'],
    [{ type: 'object', properties: { a: string }, required: ['a'] }, '$: an object must set additionalProperties: false'],
    [{ ...object({ a: string }), additionalProperties: true }, '$: an object must set additionalProperties: false'],
    [object({ a: { type: 'object', properties: {} } }), '$.a: an object must set additionalProperties: false'],
    [object({ a: string }, ['a', 'b']), '$: required names b, which is not one of its properties'],
    [object({ a: { type: 'OBJECT' } }), '$.a: type "OBJECT" is not supported'],
    [object({ a: { type: 'string', minLength: 1 } }), '$.a: minLength is not supported'],
    [object({ a: { type: 'string', maxLength: 4000 } }), '$.a: maxLength is not supported'],
    [object({ a: { type: 'integer', minimum: 0 } }), '$.a: minimum is not supported'],
    [object({ a: { type: 'number', multipleOf: 2 } }), '$.a: multipleOf is not supported'],
    [object({ a: { type: 'array', items: string, maxItems: 3 } }), '$.a: maxItems is not supported'],
    [object({ a: { type: 'array', items: string, uniqueItems: true } }), '$.a: uniqueItems is not supported'],
    [object({ a: { type: 'array', items: string, minItems: 2 } }), '$.a: minItems 2 is not supported (only 0 or 1)'],
    [object({ a: { type: 'array', items: [string, string] } }), '$.a: items must be one schema'],
    [object({ a: { oneOf: [string] } }), '$.a: oneOf is not supported'],
    [object({ a: { enum: [{ nested: true }] } }), '$.a: enum must list strings, numbers, booleans or null'],
    [object({ a: { enum: [] } }), '$.a: enum must list strings, numbers, booleans or null'],
    [object({ a: { enum: ['Missionary Spirit', 'Missionary spirit'] } }), '$.a: enum has values that differ only in capitalisation'],
    [object({ a: { const: ['x'] } }), '$.a: const must be a string, number, boolean or null'],
    [object({ a: { type: 'string', format: 'regex' } }), '$.a: format "regex" is not supported'],
    [object({ a: { type: 'string', pattern: '(a)\\1' } }), '$.a: pattern uses a backreference'],
    [object({ a: { type: 'string', pattern: '(?<x>a)\\k<x>' } }), '$.a: pattern uses a backreference'],
    [object({ a: { type: 'string', pattern: 'a(?=b)' } }), '$.a: pattern uses a lookahead or lookbehind'],
    [object({ a: { type: 'string', pattern: '(?<!a)b' } }), '$.a: pattern uses a lookahead or lookbehind'],
    [object({ a: { type: 'string', pattern: '\\bword\\b' } }), '$.a: pattern uses a word boundary (\\b or \\B)'],
    [object({ a: { type: 'string', pattern: 'a{1,1000}' } }), '$.a: pattern repeats more than 100 times'],
    [object({ a: { type: 'string', pattern: '[' } }), '$.a: pattern is not a valid regular expression'],
    [object({ a: { $ref: 'https://example.invalid/schema.json' } }), '$.a: $ref "https://example.invalid/schema.json" does not name this schema\'s own $defs or definitions'],
    [object({ a: { $ref: '#/$defs/missing' } }), '$.a: $ref "#/$defs/missing" does not name this schema\'s own $defs or definitions'],
    [{ ...object({ a: { $ref: '#/$defs/node' } }), $defs: { node: object({ child: { $ref: '#/$defs/node' } }) } }, '#/$defs/node.child: $ref #/$defs/node is recursive'],
    [{ ...object({ a: { $ref: '#' } }) }, '$.a: $ref # is recursive'],
    [{ ...object({ a: { allOf: [{ $ref: '#/$defs/s' }] } }), $defs: { s: string } }, '$.a.allOf[0]: allOf with $ref is not supported'],
    [object({ a: { ...string, $defs: { s: string } } }), '$.a: $defs and definitions belong at the top of the schema'],
    [{ ...object({ a: string }), $defs: { s: { type: 'string', maxLength: 2 } } }, '#/$defs/s: maxLength is not supported'],
    [object({ a: null }), '$.a is not a schema'],
  ];
  for (const [schema, problem] of refused) assert.ok(schemaProblems(schema).includes(problem), `${problem}\n got: ${JSON.stringify(schemaProblems(schema))}`);
  for (const notSchema of [null, undefined, [], 'object', 3]) assert.deepEqual(schemaProblems(notSchema), ['$ is not a schema']);
  assert.equal(patternProblem('^[A-Za-z ]{1,100}$'), '');
  assert.equal(patternProblem(7), 'is not a string');
});

test('a schema Claude would refuse is refused before anything is sent, as provider_rejected: never retried, the check stops as for an HTTP 400', async () => {
  const { pairs, course } = one();
  const sent = fake(() => message('{}'));
  const bad = { type: 'object', properties: { text: { type: 'string', maxLength: 4000 } }, required: ['text'] };
  const error = await anthropicMessage({ model: MODEL, system: 's', user: 'u', schema: bad, subject: 'alignment' }, { env, transport: sent.transport }).then(() => null, e => e);
  assert.equal(error.message, 'Anthropic structured outputs cannot take this schema: $: an object must set additionalProperties: false; $.text: maxLength is not supported; alignment not evaluated');
  assert.deepEqual([error.kind, classifyFailure(error), 'usage' in error, sent.calls.length], ['provider_rejected', { kind: 'provider_rejected', retryable: false }, false, 0]);
  // More than three problems: the first three are named.
  const worse = { type: 'object', properties: { a: { type: 'string', minLength: 1 }, b: { type: 'integer', maximum: 3 }, c: { type: 'string', format: 'regex' } }, required: ['a', 'b', 'c'] };
  assert.match((await anthropicMessage({ model: MODEL, system: 's', user: 'u', schema: worse }, { env, transport: sent.transport }).catch(e => e)).message, /\(and 1 more\)$/);
  // An AI rewrite whose schema Claude would refuse sends nothing either.
  const rewrite = { system: 'Rewrite the field.', payload: { current: 'Know programs.' }, schema: () => bad };
  await assert.rejects(askJson(rewrite, { env, transport: sent.transport }), e => e.kind === 'provider_rejected');
  // The alignment schemas themselves always pass: a request for a pair goes out.
  await requestAnthropic(pairs, { env, transport: sent.transport, course }).catch(() => {});
  assert.equal(sent.calls.length, 1);
});

test('the answer is read from the text blocks only, whatever thinking blocks come first; no text at all is incomplete output', async () => {
  const { pairs, course } = one();
  const valid = JSON.stringify({ judgements: pairs.map(judgement) }), half = Math.floor(valid.length / 2);
  const thinking = { type: 'thinking', thinking: 'private reasoning that is never kept', signature: 'offline' }, redacted = { type: 'redacted_thinking', data: 'opaque-offline' };
  const blocks = [redacted, thinking, { type: 'text', text: valid.slice(0, half) }, { type: 'text', text: valid.slice(half) }];
  const sent = fake(() => message('', { content: blocks }));
  const answer = await anthropicMessage({ model: MODEL, system: 's', user: 'u', schema: { type: 'object', properties: {}, required: [], additionalProperties: false } }, { env, transport: sent.transport });
  assert.equal(answer.text, valid);
  assert.equal(JSON.stringify(answer).includes('private reasoning') || JSON.stringify(answer).includes('opaque-offline'), false);
  assert.equal((await requestAnthropic(pairs, { env, transport: sent.transport, course })).length, 1);
  const empty = fake(() => message('', { content: [thinking] }));
  const error = await requestAnthropic(pairs, { env, transport: empty.transport, course }).then(() => null, e => e);
  assert.deepEqual([error.code, error.unverified, error.stopReason, error.message], ['incomplete_output', true, 'end_turn', 'Anthropic returned incomplete alignment output (stop_reason end_turn)']);
});

test('an enum value that differs only in capitalisation is refused exactly as before, and counted apart', async () => {
  const contract = contractOf(stagesOf(255)), schema = alignmentSchema(false, false, contract.aspectKeys, contract.recommend);
  const answer = { judgements: [{ id: 'p1', label: 'Not_Aligned', recommendation: 'REWRITE_TEXT', coreValue: 'Missionary spirit', basis: 'TITLE_ONLY', relevance: 'wrong' }, { id: 'p2', label: 'ALIGNED' }] };
  assert.deepEqual(caseOnlyEnumMismatches(answer, schema), [
    { path: ['judgements', 0, 'label'], given: 'Not_Aligned', expected: 'NOT_ALIGNED' },
    { path: ['judgements', 0, 'coreValue'], given: 'Missionary spirit', expected: 'Missionary Spirit' },
    { path: ['judgements', 0, 'basis'], given: 'TITLE_ONLY', expected: 'title_only' },
  ], 'a wrong value (relevance) and an exact one are not capitalisation slips');
  assert.deepEqual(caseOnlyEnumMismatches({ kind: 'Syllabus' }, { type: 'object', properties: { kind: { const: 'syllabus' } }, required: ['kind'], additionalProperties: false }), [{ path: ['kind'], given: 'Syllabus', expected: 'syllabus' }]);
  for (const notAnswer of [null, 'text', [], {}]) assert.deepEqual(caseOnlyEnumMismatches(notAnswer, schema), []);

  // One request: the label is refused (invalid_label), as from any provider, and the request's record names the slip.
  const { pairs, course } = one();
  const used = [], slipped = fake(() => message(JSON.stringify({ judgements: pairs.map(pair => ({ ...judgement(pair), label: 'Not_aligned' })) })));
  const error = await requestAnthropic(pairs, { env, transport: slipped.transport, course, onUsage: u => used.push(u) }).then(() => null, e => e);
  assert.deepEqual([error.code, error.unverified], ['invalid_label', true]);
  assert.deepEqual(used[0].enumCaseOnly, [{ id: pairs[0].id, field: 'label', given: 'Not_aligned', expected: 'NOT_ALIGNED' }]);

  // A whole check: the one slipped relationship is asked again and verified, and the check reports the slip apart from its verdicts.
  const { content, masters } = sample();
  const times = new Map();
  const check = fake(body => message(JSON.stringify({ judgements: asked(body).map(pair => {
    times.set(pair.id, (times.get(pair.id) || 0) + 1);
    return times.size === 1 && times.get(pair.id) === 1 ? { ...judgement(pair), label: 'not_aligned' } : judgement(pair);
  }) })));
  const result = await align(content, masters, { env, transport: check.transport });
  assert.equal(result.status, 'completed');
  assert.equal(result.usage.enumCaseOnly, 1);
  const [first] = times.keys();
  assert.ok(result.judgements.every(j => !j.unverified));
  assert.equal(result.judgements.find(j => j.id === first).label, 'NOT_ALIGNED');
  assert.equal([...times.values()].filter(n => n > 1).length, 1, 'only the slipped relationship was asked again');
  // Without a slip nothing is recorded.
  const clean = [];
  await requestAnthropic(pairs, { env, transport: fake(() => message(JSON.stringify({ judgements: pairs.map(judgement) }))).transport, course, onUsage: u => clean.push(u) });
  assert.equal('enumCaseOnly' in clean[0], false);
});
