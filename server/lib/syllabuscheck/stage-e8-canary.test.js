'use strict';
// The canary selector is exercised through --plan only. No child process is authorized to call a provider.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const dataset = require('./eval/stage-c-dataset.json');
const gemini = require('./gemini');
const { stageFlags } = require('./stages');

const root = path.resolve(__dirname, '../../..');
const SAFE_ENV = {
  ...process.env,
  ...Object.fromEntries(['A', 'B', 'B3', 'B4', 'D1', 'D2'].map(name => [`SYLLABUS_CHECK_STAGE_${name}`, 'off'])),
  SYLLABUS_CHECK_STAGE_C1: 'on', SYLLABUS_CHECK_STAGE_C2: 'on',
  SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', OPENROUTER_MODEL: 'minimax/minimax-m3.1-flash',
  OPENROUTER_API_KEY: '', GEMINI_API_KEY: '',
  SYLLABUS_CHECK_PROMPT_TRIM: 'off', SYLLABUS_CHECK_SCHEMA_MIN_ITEMS: 'off',
  SYLLABUS_CHECK_PROMPT_VARIANT: 'current', SYLLABUS_CHECK_AI_TIMEOUT_SEC: '90',
};
const selected = [
  'af-prog1-good', 'af-prog1-irrelevant', 'af-prog1-passive', 'af-sensors-passive',
  'as-prog1-good', 'as-prog1-essay', 'as-prog1-recall-quiz', 'as-prog1-too-high',
];
const expectedOrder = dataset.items.filter(item => selected.includes(item.id)).map(item => item.id);
const plan = extra => spawnSync(process.execPath, [
  'scripts/eval-alignment.cjs', '--plan', '--dataset', 'stage-c', '--runs', '1',
  '--budget', '15', '--max-cost', '0.03', '--check-key', '--accounting', 'reconcile', ...extra,
], { cwd: root, env: SAFE_ENV, encoding: 'utf8', timeout: 10000 });
const assertRefused = result => {
  assert.equal(result.error, undefined);
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.match(result.stderr, /ids|filters/i);
  assert.ok(!result.stdout.includes('PLAN ('), 'invalid selection must be refused before a provider or plan begins');
  assert.ok(!result.stdout.includes('Key check:') && !result.stdout.includes('Prices now'), 'no preflight request was sent');
};

test('E.8 exact-ID canary plans eight existing cases and preserves dataset order', () => {
  const result = plan(['--ids', [...selected].reverse().join(',')]);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PLAN \(no provider call is made\)/);
  assert.match(result.stdout, /Dataset stage-c-2 \(stage-c\): 8 items, 1 run\(s\)/);
  assert.ok(result.stdout.includes(`Selected unchanged IDs (8 of 28): ${expectedOrder.join(', ')}`));
  assert.ok(!result.stdout.includes('af-prog1-alternatives'), 'unselected cases are not silently added');
  assert.match(result.stdout, /budget cap 15/);
  assert.match(result.stdout, /--max-cost \$0\.03/);
});

test('E.8 omitting --ids retains the complete original 28-item Stage C plan', () => {
  const result = plan([]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Dataset stage-c-2 \(stage-c\): 28 items, 1 run\(s\), 7 batches/);
  assert.ok(!result.stdout.includes('Selected unchanged IDs'));
});

test('E.8 canary preflight records only C1/C2 with current full r8 wording, no trim or minItems, and a bounded timeout', () => {
  const result = plan(['--ids', selected.join(',')]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Prompt alignment-12c1c2-r8(?:\r?\n)/);
  const configLine = result.stdout.split(/\r?\n/).find(line => line.startsWith('Evaluation configuration: '));
  assert.ok(configLine);
  const config = JSON.parse(configLine.slice('Evaluation configuration: '.length));
  assert.deepEqual(config, {
    stageFlags: { a: false, b: false, b3: false, b4: false, c1: true, c2: true, d1: false, d2: false },
    promptVariant: 'current', trim: false, minItems: false, timeoutMs: 90000,
  });
  assert.match(result.stdout, /Schema: judgements list as before \(no minItems\)/);
  const provider = gemini.providerConfig(SAFE_ENV);
  assert.equal(provider.provider, 'openrouter'); assert.equal(provider.model, 'minimax/minimax-m3.1-flash');
  const activity = dataset.items.find(item => item.type === 'Activity-fit');
  const assessment = dataset.items.find(item => item.type === 'Assessment-fit');
  const prompt = gemini.systemPromptOf('current', SAFE_ENV, [activity]);
  assert.equal(prompt, gemini.systemPromptOf('current', SAFE_ENV, [assessment]), 'full Stage C prompt is not trimmed by requested pair type');
  assert.match(prompt, /Activity-fit/); assert.match(prompt, /Assessment-fit/);
  assert.deepEqual(stageFlags(SAFE_ENV), config.stageFlags);
});

test('E.8 unknown IDs are refused instead of silently running the parent dataset or a partial selection', () => {
  for (const ids of ['not-a-stage-c-case', `${selected[0]},not-a-stage-c-case`]) assertRefused(plan(['--ids', ids]));
});

test('E.8 empty and malformed ID selections are refused before requests', () => {
  for (const args of [['--ids'], ['--ids', ''], ['--ids', '   '], ['--ids', ','], ['--ids', `${selected[0]},`], ['--ids', `${selected[0]},,${selected[1]}`]]) assertRefused(plan(args));
});

test('E.8 duplicated IDs are refused rather than issuing a duplicate or silently deduplicated evaluation', () => {
  assertRefused(plan(['--ids', `${selected[0]},${selected[0]}`]));
});

test('E.8 ID selections conflicting with type or split filters are refused before requests', () => {
  assertRefused(plan(['--ids', selected.join(','), '--types', 'Activity-fit']));
  assertRefused(plan(['--ids', selected.join(','), '--split', 'heldout']));
});
