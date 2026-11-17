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
const { anthropicMessage } = require('./anthropicClient');
const { schemaProblems, caseOnlyEnumMismatches, patternProblem } = require('./anthropicSchema');
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
