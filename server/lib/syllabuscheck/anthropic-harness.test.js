'use strict';
// Stage S7: the evaluation harness with Claude, offline end to end. scripts/eval-alignment.cjs and scripts/live-pipeline-eval.cjs run as child
// processes with a test key and temporary ledgers, result files and spend registers. Every child is answered by the offline replay
// (eval/anthropicReplayPreload.js: through the guard, the adapter and the SDK) and also gets a preload that refuses every socket, so not even a refusal
// that failed could reach the network. scripts/report-provider-drift.cjs compares result files offline and gives every drift category. Nothing here
// writes a file of the repository, and no request leaves the process.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { LEGACY_ENV } = require('./eval/phase3/oracle');
const { variant, loadManifest } = require('./eval/phase3/fixtures');
const { runPairedOfficialComparison, comparePairedOfficial, DRIFT_CATEGORIES } = require('./eval/phase3/score');
const { officialOf, compareProviders } = require('./eval/providerDrift');
const { claudeOptionsOf, applyClaudeEnv, planCostOf, EVALUATION_MODELS, AUTHORIZED_TOTAL, SPEND_REGISTER, HELDOUT_LOG, PLAN_KEY } = require('./eval/claudeEvaluation');
const { createGuard, openSpendRegister, claudePrices, claudeWorstCaseOf, ANTHROPIC_MESSAGES } = require('./eval/providerGuard');
const { verifiedAlignment } = require('./gemini');

const ROOT = path.resolve(__dirname, '../../..');
const PRELOAD = path.join(__dirname, 'eval', 'anthropicReplayPreload.js');
const KEY = 'sk-ant-test-only-S7-harness-not-a-real-key';
const P1_IDS = 'clo-po-calc-aligned,clo-po-calc-lower-level,clo-po-calc-unrelated,clo-po-calc-vague';
const MODEL = 'claude-sonnet-5-5';
const temps = [];
const tempDir = () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's7-harness-')); temps.push(dir); return dir; };
test.after(() => { for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true }); });
// Every socket is refused in the children: the replay answers every Anthropic request, and nothing else may be asked.
const NO_SOCKETS = path.join(tempDir(), 'no-sockets.cjs');
fs.writeFileSync(NO_SOCKETS, "'use strict';\nconst net = require('node:net');\nnet.Socket.prototype.connect = function () { throw new Error('offline test: no socket may be opened'); };\n");
// The child's environment: every setting the scripts read is stated, so server/.env fills none of them (it is read, never written). The application's
// approval switch names the evaluation model on purpose: an evaluation must neither need it nor be turned into an official check by it.
const STAGES_OFF = Object.fromEntries(['A', 'B', 'B3', 'B4', 'C1', 'C2', 'D1', 'D2'].map(stage => [`SYLLABUS_CHECK_STAGE_${stage}`, 'off']));
const childEnv = extra => ({ ...process.env, ...STAGES_OFF, NODE_OPTIONS: '', SYLLABUS_CHECK_AI_PROVIDER: 'off', ANTHROPIC_API_KEY: KEY, ANTHROPIC_MODEL: 'claude-sonnet-4-6', SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: MODEL,
  ANTHROPIC_THINKING: '', ANTHROPIC_EFFORT: '', ANTHROPIC_MAX_TOKENS: '', ANTHROPIC_TIMEOUT_SEC: '', ANTHROPIC_MAX_RETRIES: '', ANTHROPIC_PROMPT_CACHE: '', ANTHROPIC_CUSTOM_HEADERS: '',
  OPENROUTER_API_KEY: '', GEMINI_API_KEY: '', SYLLABUS_CHECK_PROMPT_TRIM: 'off', SYLLABUS_CHECK_PROMPT_VARIANT: 'current', SYLLABUS_CHECK_AI_BATCH: '', SYLLABUS_CHECK_REF_VERIFY: 'off',
  SYLLABUS_CHECK_OFFLINE_REPLAY: 'test', SYLLABUS_CHECK_REPLAY_FAULTS: '', SYLLABUS_CHECK_REPLAY_THINKING: '', SYLLABUS_CHECK_REPLAY_MODEL: '', ...extra });
function runScript(script, args, env = {}) {
  const r = spawnSync(process.execPath, ['--require', NO_SOCKETS, '--require', PRELOAD, path.join('scripts', script), ...args], { cwd: ROOT, env: childEnv(env), encoding: 'utf8', timeout: 180000 });
  assert.equal(r.error, undefined, String(r.error));
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, all: `${r.stdout}\n${r.stderr}` };
}
const files = dir => ({ ledger: path.join(dir, 'ledger.json'), out: path.join(dir, 'result.json'), register: path.join(dir, 'register.json') });
const paidArgs = (f, extra = []) => ['--provider', 'anthropic', '--confirm-paid', '--model', MODEL, '--thinking', 'adaptive', '--effort', 'high', '--dataset', 'general', '--legacy', '--ids', P1_IDS, '--runs', '1',
  '--budget', '3', '--max-cost', '0.5', '--ledger', f.ledger, '--out', f.out, '--spend-register', f.register, ...extra];
// The arguments without a flag (and its value), or with it replaced.
const without = (args, ...names) => args.filter((arg, i) => !names.includes(arg.replace(/^--/, '')) && !(i > 0 && names.includes(args[i - 1].replace(/^--/, '')) && !arg.startsWith('--')));
const withFlag = (args, name, value) => [...without(args, name), `--${name}`, value];
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const noKeyIn = (texts, label) => { for (const text of texts) assert.ok(!String(text).includes(KEY), `${label}: the key must appear nowhere`); };

test('the shared Claude options: one approved model, the authorized $10 total, explicit settings for a paid run, nothing out of range, no approval switch', () => {
  assert.deepEqual(EVALUATION_MODELS, ['claude-sonnet-5-5']);
  assert.equal(AUTHORIZED_TOTAL, 10);
  assert.ok(SPEND_REGISTER.endsWith(path.join('docs', 'ai-eval-anthropic', 'spend-register.json')) && HELDOUT_LOG.endsWith(path.join('docs', 'ai-eval-anthropic', 'heldout-log.jsonl')));
  const cli = argv => ({ has: name => argv.includes(`--${name}`), flag: (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback; } });
  const plan = claudeOptionsOf({ ...cli([]), paid: false });
  assert.deepEqual(plan.problems, []);
  assert.deepEqual([plan.options.model, plan.options.thinking, plan.options.effort, plan.options.maxTokens, plan.options.timeoutSec, plan.options.maxRetries, plan.options.maxOutputTokens, plan.options.totalCap], [MODEL, 'adaptive', 'high', 16000, 180, 2, null, 10]);
  const paid = claudeOptionsOf({ ...cli([]), paid: true });
  assert.equal(paid.problems.length, 3, 'a paid run states its model, thinking and effort');
  for (const [argv, problem] of [[['--model', 'claude-opus-5-5'], /approved for evaluation/], [['--model', 'claude-haiku-5-5'], /approved for evaluation/], [['--thinking', 'enabled'], /adaptive or off/], [['--effort', 'extreme'], /--effort must be/],
    [['--max-tokens', '500'], /1024 to 16000/], [['--max-tokens', '16001'], /1024 to 16000/], [['--timeout-sec', '301'], /10 to 300/], [['--max-retries', '4'], /0 to 3/], [['--max-output-tokens', '0'], /positive integer/],
    [['--total-cap', '10.01'], /at most 10/], [['--total-cap', '0'], /at most 10/], [['--reveal'], /--reveal is not available/]]) {
    const { problems } = claudeOptionsOf({ ...cli(argv), paid: false, refused: ['reveal'] });
    assert.ok(problems.some(p => problem.test(p)), `${argv.join(' ')}: ${problems.join('; ')}`);
  }
  const env = applyClaudeEnv({ SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: MODEL, ANTHROPIC_PROMPT_CACHE: 'off' }, plan.options);
  assert.deepEqual(env, { SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', ANTHROPIC_MODEL: MODEL, ANTHROPIC_THINKING: 'adaptive', ANTHROPIC_EFFORT: 'high', ANTHROPIC_MAX_TOKENS: '16000', ANTHROPIC_TIMEOUT_SEC: '180', ANTHROPIC_MAX_RETRIES: '2', ANTHROPIC_PROMPT_CACHE: 'on' });
  assert.match(PLAN_KEY, /^sk-ant-plan-only/);
});

test('planCostOf: each request\'s worst case is the guard\'s own bound, and the expected range is below it', () => {
  const prices = claudePrices(MODEL), user = JSON.stringify({ course: { code: 'IT 202' }, document_data: [{ id: 'a' }, { id: 'b' }] });
  const body = JSON.stringify({ model: MODEL, max_tokens: 16000, thinking: { type: 'adaptive' }, system: [{ type: 'text', text: 'x'.repeat(8000), cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content: user }], output_config: { effort: 'high', format: { type: 'json_schema', schema: { type: 'object' } } } });
  const one = planCostOf([body], prices), two = planCostOf([body, body], prices, 2);
  assert.equal(one.worst, claudeWorstCaseOf(body, prices).dollars);
  assert.deepEqual([one.requests, one.relationships, two.requests, two.relationships], [1, 2, 4, 8]);
  assert.ok(one.low > 0 && one.low < one.high && one.high < one.worst, JSON.stringify(one));
  assert.ok(two.low < 4 * one.low, 'after the first request the system prompt is read from the cache');
  assert.ok(Math.abs(two.worst - 4 * one.worst) < 1e-12);
});

test('--provider anthropic --plan builds the request through the adapter offline and prints its worst case, the expected range and the caps', () => {
  const f = files(tempDir());
  const r = runScript('eval-alignment.cjs', ['--provider', 'anthropic', '--plan', '--dataset', 'general', '--legacy', '--ids', P1_IDS, '--runs', '1', '--budget', '3', '--max-cost', '0.5', '--spend-register', f.register]);
  assert.equal(r.status, 0, r.all);
  assert.match(r.stdout, /^PLAN \(no provider call is made: every request below was built by the adapter/m);
  assert.match(r.stdout, /model claude-sonnet-5-5; thinking adaptive \(\{"type":"adaptive"\}\), effort high, max_tokens 16000, timeout 180 s, adapter retries 2, prompt cache on; EVALUATION ONLY/);
  assert.match(r.stdout, /Dataset eval-1\.1 \(general\): 4 items, 1 run\(s\), 1 batches per run \(batch size 12\)/);
  assert.match(r.stdout, /Prompt alignment-10 \(no stage on\)\r?\nEvaluation mode A: legacy academic alignment benchmark \(stages on: none; recommendation field no\)/);
  assert.match(r.stdout, /Published prices \(Anthropic's pricing page, pinned in anthropicClient\.js as of 2026-10-27, per million tokens\): input \$2, output \$10 \(thinking is output\), cache read \$0\.1, cache write \$2\.5 \(5 min\) \/ \$4 \(1 h\); x1\.1 only when an answer reports inference_geo "us"\. The guard counts the same tokens against its caps with a cache read at \$0\.2 /);
  assert.match(r.stdout, /Requests: 1 without retries; at most 39 with every retry allowed \(13 asked by the checker, each sent at most 3 time\(s\) by the adapter\); budget cap 3/);
  const worst = Number(/the largest \$(\d+\.\d+)/.exec(r.stdout)[1]), [low, high] = /Expected \(an estimate, not a limit\): \$(\d+\.\d+)-\$(\d+\.\d+)/.exec(r.stdout).slice(1).map(Number);
  assert.ok(worst > 0.1 && worst < 0.5 && low > 0 && low < high && high < worst, r.stdout);
  assert.match(r.stdout, /--max-cost \$0\.5;/);
  assert.match(r.stdout, /not created yet: no Claude evaluation has been charged/);
  assert.match(r.stdout, /Estimates are not spending limits/);
  const config = JSON.parse(r.stdout.split(/\r?\n/).find(line => line.startsWith('Evaluation configuration: ')).slice('Evaluation configuration: '.length));
  assert.deepEqual(config.anthropic, { model: MODEL, thinking: 'adaptive', thinkingParameter: { type: 'adaptive' }, effort: 'high', maxTokens: 16000, maxRetries: 2, promptCache: true, evaluationOnly: true });
  assert.deepEqual(fs.readdirSync(path.dirname(f.register)), [], 'a plan writes nothing');
  noKeyIn([r.all], 'plan');
  // A cost cap below one request's worst case, and an output-token cap below max_tokens, are pointed out: nothing would be sent.
  const low1 = runScript('eval-alignment.cjs', ['--provider', 'anthropic', '--plan', '--dataset', 'general', '--legacy', '--ids', P1_IDS, '--max-cost', '0.05', '--max-output-tokens', '1000']);
  assert.equal(low1.status, 0, low1.all);
  assert.match(low1.stdout, /--max-cost \$0\.05 {2}<-- below the worst case of one request/);
  assert.match(low1.stdout, /--max-output-tokens 1000 {2}<-- below max_tokens 16000: nothing would be sent/);
  // Thinking off is sent as the model's own way of turning it off, and effort max without thinking is refused before anything is built.
  const off = runScript('eval-alignment.cjs', ['--provider', 'anthropic', '--plan', '--dataset', 'general', '--legacy', '--ids', P1_IDS, '--thinking', 'off', '--effort', 'medium']);
  assert.equal(off.status, 0, off.all);
  assert.match(off.stdout, /thinking off \(\{"type":"between_tools"\}\), effort medium/);
  const max = runScript('eval-alignment.cjs', ['--provider', 'anthropic', '--plan', '--dataset', 'general', '--ids', P1_IDS, '--thinking', 'off', '--effort', 'max']);
  assert.equal(max.status, 2, max.all);
  assert.match(max.stderr, /effort max needs thinking on\. No request was sent/);
});

test('a --confirm-paid Claude run, answered by the offline replay, goes through the guard, the adapter and the SDK and writes an evaluation-only result', () => {
  const dir = tempDir(), f = files(dir);
  const r = runScript('eval-alignment.cjs', paidArgs(f));
  assert.equal(r.status, 0, r.all);
  assert.match(r.stdout, /Model anthropic\/claude-sonnet-5-5; prompt alignment-10; retry policy legacy/);
  assert.match(r.stdout, /Claude settings: thinking adaptive \(\{"type":"adaptive"\}\), effort high, max_tokens 16000, timeout 180 s, adapter retries 2, prompt cache on\. EVALUATION ONLY/);
  assert.match(r.stdout, /total cap \$10 over every Claude ledger of the spend register \(\$0 charged before this run\)/);
  assert.match(r.stdout, /Published prices \(Anthropic's pricing page, pinned in anthropicClient\.js as of 2026-10-27/);
  assert.match(r.stdout, /Claude usage this run: .*\(thinking 50 as reported: 1 request\(s\) reported thinking tokens, 0 reported zero, 0 reported no count, which is not taken for zero; thinking blocks 1\); models that answered \{"claude-sonnet-5-5":1\}\. Estimated at the published prices \$[\d.]+; charged by the guard against its caps \$[\d.]+; every Claude ledger together/);
  assert.match(r.stdout, /Adapter count: 1 question\(s\), 1 attempt\(s\), 0 timed out; thinking reported \{"nonzero":1,"zero":0,"unavailable":0\}; estimated \$[\d.]+ at the published prices/);
  const result = readJson(f.out), ledger = readJson(f.ledger), register = readJson(f.register);
  assert.deepEqual([result.model, result.provider, result.evaluationOnly, result.stopped, result.modelsReturned], [`anthropic/${MODEL}`, 'anthropic', true, null, { [MODEL]: 1 }]);
  assert.deepEqual(result.configuration.anthropic, { model: MODEL, thinking: 'adaptive', thinkingParameter: { type: 'adaptive' }, effort: 'high', maxTokens: 16000, maxRetries: 2, promptCache: true, evaluationOnly: true });
  assert.deepEqual(result.dataset.selection.selectedIds, P1_IDS.split(','));
  assert.equal(result.relationshipMetrics.verified, 4);
  assert.equal(result.requests.length, 1);
  const [request] = result.requests;
  assert.deepEqual([request.status, request.requestId, request.modelReturned, request.stopReason, request.accounting, request.usage.thinkingTokens, request.thinkingBlocks, request.ids], [200, 'req_replay_1', MODEL, 'end_turn', 'reconciled', 50, 1, P1_IDS.split(',')]);
  assert.ok(request.charged > 0 && request.charged <= request.worst, JSON.stringify(request));
  assert.ok(request.usage.estimatedCost > 0 && request.usage.estimatedCost <= request.charged, 'the published-price estimate is kept next to the guard\'s charge, and is not above it');
  assert.deepEqual([result.adapterUsage.requests, result.adapterUsage.attempts, result.adapterUsage.timedOut, result.adapterUsage.thinkingTokens, result.adapterUsage.thinkingReports, result.adapterUsage.stopReasons], [1, 1, 0, 50, { nonzero: 1, zero: 0, unavailable: 0 }, { end_turn: 1 }]);
  const usage = result.usage.anthropic;
  assert.deepEqual([usage.model, usage.modelsReturned, usage.prices.perMillionTokens.input, usage.prices.perMillionTokens.output, usage.thinkingTokens, usage.thinkingReports, usage.stopReasons, usage.limits.register.cap], [MODEL, { [MODEL]: 1 }, 2, 10, 50, { nonzero: 1, zero: 0, unavailable: 0 }, { end_turn: 1 }, 10]);
  assert.ok(Math.abs(usage.estimatedCost - result.adapterUsage.estimatedUsd) <= 1e-8, 'the guard\'s estimate is the adapter\'s');
  // P2: the run says which mode it measured, and reports the quality measures beside the agreement, from the same answers and the same usage.
  assert.match(r.stdout, /^Evaluation mode A: legacy academic alignment benchmark \(stages on: none; recommendation field no\)$/m);
  assert.match(r.stdout, /^strict agreement .*; permissive .*\r?\nfalse approvals .*\r?\nBloom \(the answers' own levels\): .*\r?\nrecommendations .*\r?\nmapping remedy: .*\r?\nevidence: .*\r?\noperations: 1 request\(s\); /m);
  const q = result.quality;
  assert.deepEqual([q.mode.id, q.answers.verified, q.agreement.permissive.rate, q.operations.requests, q.operations.estimatedCost, q.operations.chargedByGuard], ['A', 4, result.agreement, 1, usage.estimatedCost, usage.chargedThisRun]);
  assert.ok(Object.values(result.answers[0]).every(a => typeof a.sourceBloom === 'string' && typeof a.targetBloom === 'string'), 'the recorded answers keep their Bloom levels');
  assert.deepEqual([result.limits.totalCap, result.limits.maxTokens, result.limits.budget, result.limits.maxCost], [10, 16000, 3, 0.5]);
  // The ledger is a Claude ledger of its own, and the spend register holds what it charged, under the relative name of the ledger.
  assert.deepEqual([ledger.provider, ledger.model, ledger.modelsReturned, ledger.requests, ledger.entries[0].requestId, ledger.entries[0].modelReturned, ledger.entries[0].maxTokens, ledger.entries[0].tokens.thinking], ['anthropic', MODEL, { [MODEL]: 1 }, 1, 'req_replay_1', MODEL, 16000, 50]);
  assert.equal(ledger.charged, result.usage.charged);
  assert.deepEqual([register.cap, register.total, Object.keys(register.ledgers)], [10, ledger.charged, ['ledger.json']]);
  assert.equal(fs.existsSync(`${f.register}.lock`), false, 'the lock is released when the run ends');
  // The key and the thinking appear nowhere.
  noKeyIn([r.all, fs.readFileSync(f.out, 'utf8'), fs.readFileSync(f.ledger, 'utf8'), fs.readFileSync(f.register, 'utf8')], 'paid run');
  for (const file of [f.out, f.ledger]) assert.ok(!fs.readFileSync(file, 'utf8').includes('Replayed thinking block'), `${file} keeps no thinking`);
  // A second run continues the ledger (the counts carry over) into a new result file, and the register follows it.
  const second = runScript('eval-alignment.cjs', withFlag(paidArgs(f), 'out', path.join(dir, 'result-2.json')));
  assert.equal(second.status, 0, second.all);
  const ledger2 = readJson(f.ledger);
  assert.deepEqual([ledger2.requests, readJson(f.register).total], [2, ledger2.charged]);
  // An existing result file is never overwritten: refused before anything is sent, and the ledger is untouched.
  const before = fs.readFileSync(f.ledger, 'utf8');
  const again = runScript('eval-alignment.cjs', paidArgs(f));
  assert.equal(again.status, 2, again.all);
  assert.match(again.stderr, /already exist\(s\): an evaluation never overwrites an earlier result\. Name a new --out file\. No request was sent\./);
  assert.equal(fs.readFileSync(f.ledger, 'utf8'), before);
});

test('a paid Claude run records the model that answered exactly, and how each answer reported its thinking; another model stops the run', () => {
  // A dated snapshot of the evaluated model is the same model: the run completes, and the result names the snapshot.
  const dated = `${MODEL}-20261015`, a = files(tempDir());
  const snapshot = runScript('eval-alignment.cjs', paidArgs(a), { SYLLABUS_CHECK_REPLAY_MODEL: dated });
  assert.equal(snapshot.status, 0, snapshot.all);
  const resultA = readJson(a.out), ledgerA = readJson(a.ledger);
  assert.deepEqual([resultA.stopped, resultA.relationshipMetrics.verified, resultA.model, resultA.modelsReturned, resultA.requests[0].modelReturned, ledgerA.modelsReturned, ledgerA.entries[0].modelReturned], [null, 4, `anthropic/${MODEL}`, { [dated]: 1 }, dated, { [dated]: 1 }, dated]);
  // Another model: its answer is refused by the adapter and the guard stops the run; what it answered is recorded, and nothing more is sent.
  const b = files(tempDir());
  const other = runScript('eval-alignment.cjs', paidArgs(b), { SYLLABUS_CHECK_REPLAY_MODEL: 'claude-opus-5-5' });
  assert.equal(other.status, 0, other.all);
  const resultB = readJson(b.out), ledgerB = readJson(b.ledger);
  assert.equal(resultB.stopped, `request 1 was answered by claude-opus-5-5, not ${MODEL}: the pinned prices and this evaluation are for ${MODEL} only`);
  assert.deepEqual([ledgerB.requests, ledgerB.modelsReturned, resultB.modelsReturned, resultB.relationshipMetrics.verified], [1, { 'claude-opus-5-5': 1 }, { 'claude-opus-5-5': 1 }, 0]);
  // Thinking reported as zero, and thinking that happened with no count reported: 0 is kept as 0, a missing count as null, never as 0.
  for (const [mode, thinking, reports, blocks] of [['zero', 0, { nonzero: 0, zero: 1, unavailable: 0 }, 0], ['unreported', null, { nonzero: 0, zero: 0, unavailable: 1 }, 1], ['absent', null, { nonzero: 0, zero: 0, unavailable: 1 }, 0]]) {
    const f = files(tempDir()), r = runScript('eval-alignment.cjs', paidArgs(f), { SYLLABUS_CHECK_REPLAY_THINKING: mode });
    assert.equal(r.status, 0, `${mode}\n${r.all}`);
    const result = readJson(f.out), ledger = readJson(f.ledger);
    assert.deepEqual([result.requests[0].usage.thinkingTokens, result.requests[0].thinkingBlocks, ledger.entries[0].tokens.thinking, result.usage.anthropic.thinkingReports, result.adapterUsage.thinkingReports, result.adapterUsage.thinkingTokens], [thinking, blocks, thinking, reports, reports, 0], mode);
    // The thinking the model did is billed as output whatever the answer reports of it: 50 more output tokens with the block.
    assert.equal(result.usage.anthropic.outputTokens, result.adapterUsage.outputTokens, mode);
  }
  // The replay refuses a thinking mode it does not know, before anything is answered.
  const bad = runScript('eval-alignment.cjs', paidArgs(files(tempDir())), { SYLLABUS_CHECK_REPLAY_THINKING: 'sometimes' });
  assert.notEqual(bad.status, 0);
  assert.match(bad.all, /the replay's thinking mode must be one of reported, zero, unreported, absent, not sometimes/);
  for (const run of [snapshot, other]) noKeyIn([run.all], 'model identity');
});

test('P2: the same stage-a CLO-PO items in the legacy mode (A) and the staged mode (B) are reported apart, on the same quality measures', () => {
  // The replay answers ALIGNED for every relationship (its oracle has no expectation for these items), so each measure is what the dataset implies.
  const items = require('./eval/stage-a-dataset.json').items.filter(item => item.type === 'CLO-PO');
  const clearNot = items.filter(item => !item.ambiguous && !item.accept.includes('ALIGNED')).length, retag = items.filter(item => item.category === 'wrong-po-mapping').length;
  const args = f => withFlag(withFlag(withFlag(withFlag(without(paidArgs(f), 'legacy', 'ids'), 'dataset', 'stage-a'), 'types', 'CLO-PO'), 'budget', '6'), 'max-cost', '1');
  const modes = {};
  for (const [id, extra, name, stagesOn, field] of [['A', ['--legacy'], 'legacy academic alignment benchmark', [], false], ['B', [], 'enhanced staged semantic evaluation', ['a'], true]]) {
    const f = files(tempDir()), r = runScript('eval-alignment.cjs', [...args(f), ...extra]);
    assert.equal(r.status, 0, `${id}\n${r.all}`);
    assert.match(r.stdout, new RegExp(`^Evaluation mode ${id}: ${name} \\(stages on: ${stagesOn.join(', ') || 'none'}; recommendation field ${field ? 'yes' : 'no'}\\)$`, 'm'));
    const result = readJson(f.out), q = result.quality;
    assert.deepEqual(q.mode, { id, name, stagesOn, recommendationField: field });
    assert.deepEqual([q.answers.verified, q.agreement.permissive.rate, q.falseApprovals.clearNotAligned, q.falseApprovals.judgedAligned, q.falseRejections.judgedOtherwise], [items.length, result.agreement, clearNot, clearNot, 0], id);
    assert.deepEqual([q.recommendations.proposals, q.mappingRemedy.retagExpected.answers, q.mappingRemedy.retagExpected.failing, q.evidence.sides.exact], [{ NO_CHANGE: items.length }, retag, 0, 2 * items.length], id);
    assert.equal(q.operations.requests, result.usage.model, id);
    modes[id] = result;
  }
  assert.notEqual(modes.A.promptVersion, modes.B.promptVersion, 'the two modes ask with different wordings');
});

test('a paid Claude run is refused before any request unless it states everything, within the authorized caps, on synthetic data', () => {
  const cases = [
    [f => without(paidArgs(f), 'provider'), /names its provider: --provider openrouter or --provider anthropic\. It is never taken from server\/\.env/],
    [f => withFlag(paidArgs(f), 'provider', 'gemini'), /--provider must be openrouter or anthropic/],
    [f => without(paidArgs(f), 'model', 'thinking', 'effort'), /--model must be a Claude model approved for evaluation \(claude-sonnet-5-5\)\n--thinking must be adaptive or off\n--effort must be/],
    [f => withFlag(paidArgs(f), 'model', 'claude-opus-5-5'), /approved for evaluation/],
    [f => withFlag(paidArgs(f), 'model', 'claude-haiku-5-5'), /approved for evaluation/],
    [f => [...paidArgs(f), '--reveal'], /--reveal is not available with --provider anthropic/],
    [f => [...paidArgs(f), '--min-items'], /--min-items is not available with --provider anthropic/],
    [f => [...paidArgs(f), '--check-key'], /--check-key is not available with --provider anthropic/],
    [f => without(paidArgs(f), 'budget'), /needs --budget/],
    [f => without(paidArgs(f), 'max-cost'), /--max-cost \(dollars\) above 0 and at most the total cap \(\$10\)/],
    [f => withFlag(paidArgs(f), 'max-cost', '12'), /at most the total cap/],
    [f => [...paidArgs(f), '--total-cap', '11'], /--total-cap must be a positive number of dollars, at most 10/],
    [f => [...paidArgs(f), '--total-cap', '0.4'], /at most the total cap \(\$0\.4\)/],
    [f => without(paidArgs(f), 'ledger'), /--ledger \(a Claude ledger of its own\)/],
    [f => without(paidArgs(f), 'out'), /--out \(a new result file\)/],
    [f => withFlag(paidArgs(f), 'out', f.ledger), /separate files for --ledger, --out and --spend-register/],
    [f => [...paidArgs(f), '--max-tokens', '500'], /--max-tokens must be an integer from 1024 to 16000/],
    [f => [...paidArgs(f), '--timeout-sec', '5'], /--timeout-sec must be an integer from 10 to 300/],
    [f => [...without(paidArgs(f), 'dataset', 'ids', 'legacy'), '--dataset', 'alignment', '--split', 'heldout'], /--confirm-heldout: the selection includes held-out items/],
    [f => [...paidArgs(f), '--heldout-log', path.join(ROOT, 'docs', 'ai-eval-heldout-log.jsonl')], /--heldout-log must not be the OpenRouter held-out log/],
  ];
  for (const [argsOf, refusal] of cases) {
    const dir = tempDir(), f = files(dir), args = argsOf(f);
    const r = runScript('eval-alignment.cjs', args);
    assert.equal(r.status, 2, `${args.join(' ')}\n${r.all}`);
    assert.match(r.stderr, refusal, args.join(' '));
    assert.deepEqual(fs.readdirSync(dir), [], `${args.join(' ')}: nothing was written`);
    noKeyIn([r.all], args.join(' '));
  }
  // A key that is not in Anthropic's format is never sent: the run is refused as not configured.
  const dir = tempDir(), f = files(dir), bad = runScript('eval-alignment.cjs', paidArgs(f), { ANTHROPIC_API_KEY: 'not-an-anthropic-key-0123456789' });
  assert.equal(bad.status, 2, bad.all);
  assert.match(bad.stderr, /No usable AI provider is configured \(anthropic claude-sonnet-5-5\)/);
  assert.ok(!bad.all.includes('not-an-anthropic-key-0123456789'));
  assert.deepEqual(fs.readdirSync(dir), []);
  // A spend register held by another evaluation is refused, and its lock is left for that evaluation.
  const held = tempDir(), h = files(held);
  fs.writeFileSync(`${h.register}.lock`, JSON.stringify({ pid: 1, at: '2026-10-27T00:00:00.000Z', token: 'other' }));
  const locked = runScript('eval-alignment.cjs', paidArgs(h));
  assert.equal(locked.status, 2, locked.all);
  assert.match(locked.stderr, /is held by another evaluation .*; if none is running, delete/);
  assert.deepEqual(fs.readdirSync(held), ['register.json.lock']);
});

test('the run stops safely at a spend limit, an exhausted credit balance, the total cap and the output-token cap; an overload is retried within its bound', () => {
  // An exhausted credit balance (HTTP 400): one request, charged nothing, never retried; the result says why the run stopped.
  const a = files(tempDir());
  const credit = runScript('eval-alignment.cjs', paidArgs(a), { SYLLABUS_CHECK_REPLAY_FAULTS: JSON.stringify({ 1: { status: 400, message: 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.' } }) });
  assert.equal(credit.status, 0, credit.all);
  const stopped = readJson(a.out), ledgerA = readJson(a.ledger);
  assert.match(stopped.stopped, /HTTP 400: a spend limit or an exhausted credit balance/);
  assert.deepEqual([ledgerA.requests, ledgerA.charged, ledgerA.entries[0].accounting, readJson(a.register).total, stopped.adapterUsage.attempts], [1, 0, 'refused', 0, 1]);
  // The usage tier's monthly cap (HTTP 429 enforced_spend_limit_reached) is not a rate limit: it stops the run at once, never retried.
  const t = files(tempDir());
  const tier = runScript('eval-alignment.cjs', paidArgs(t), { SYLLABUS_CHECK_REPLAY_FAULTS: JSON.stringify({ 1: { status: 429, type: 'rate_limit_error', message: 'This request would exceed the monthly spend limit of your usage tier.', details: { error_code: 'enforced_spend_limit_reached' } } }) });
  assert.equal(tier.status, 0, tier.all);
  assert.match(readJson(t.out).stopped, /HTTP 429: a spend limit or an exhausted credit balance/);
  assert.equal(readJson(t.ledger).requests, 1);
  // An overload (529) is retried by the adapter, within its bound: two requests, the first charged its worst case (it may have been billed).
  const b = files(tempDir());
  const overload = runScript('eval-alignment.cjs', paidArgs(b), { SYLLABUS_CHECK_REPLAY_FAULTS: JSON.stringify({ 1: { status: 529, type: 'overloaded_error', message: 'Overloaded' } }) });
  assert.equal(overload.status, 0, overload.all);
  const ledgerB = readJson(b.ledger), resultB = readJson(b.out);
  assert.deepEqual([ledgerB.requests, ledgerB.entries.map(e => e.status), ledgerB.entries[0].accounting, ledgerB.entries[0].charged, resultB.adapterUsage.attempts, resultB.relationshipMetrics.verified], [2, [529, 200], 'worst_case', ledgerB.entries[0].worst, 2, 4]);
  // The total cap: other Claude ledgers already charged $9.90 of the $10, so the first request's worst case does not fit and nothing is sent.
  const c = files(tempDir());
  fs.writeFileSync(c.register, JSON.stringify({ cap: 10, total: 9.9, ledgers: { 'earlier-ledger.json': { model: MODEL, requests: 40, charged: 9.9, outputTokens: 100000, updatedAt: '2026-10-27T00:00:00.000Z' } } }));
  const capped = runScript('eval-alignment.cjs', paidArgs(c));
  assert.equal(capped.status, 0, capped.all);
  assert.match(readJson(c.out).stopped, /total cap: \$9\.9 already charged by every Claude ledger of the spend register \+ \$0\.\d+ worst case of the next request > \$10/);
  assert.equal(fs.existsSync(c.ledger), false, 'no request was counted');
  assert.equal(readJson(c.register).total, 9.9);
  // The output-token cap (thinking included): max_tokens 16000 does not fit under 1000, so nothing is sent.
  const d = files(tempDir());
  const tokens = runScript('eval-alignment.cjs', [...paidArgs(d), '--max-output-tokens', '1000']);
  assert.equal(tokens.status, 0, tokens.all);
  assert.match(readJson(d.out).stopped, /output-token cap: 0 output tokens already charged \+ max_tokens 16000 of the next request > 1000/);
  assert.equal(fs.existsSync(d.ledger), false);
  // A persistent overload. Each 529 is charged its worst case (a server error may have been billed), so under --max-cost $0.50 the cost cap stops the
  // run after two requests; under --max-cost $3 the third transient error does (--max-transient 3), within --budget 3. Retries are counted requests.
  const overloaded = JSON.stringify(Object.fromEntries([1, 2, 3, 4, 5].map(n => [n, { status: 529 }])));
  const e = files(tempDir());
  const persistent = runScript('eval-alignment.cjs', paidArgs(e), { SYLLABUS_CHECK_REPLAY_FAULTS: overloaded });
  assert.equal(persistent.status, 0, persistent.all);
  const ledgerE = readJson(e.ledger);
  assert.deepEqual([ledgerE.requests, ledgerE.entries.map(entry => entry.accounting)], [2, ['worst_case', 'worst_case']]);
  assert.match(readJson(e.out).stopped, /^cost cap: \$0\.\d+ already charged \+ \$0\.\d+ worst case of the next request > \$0\.5$/);
  const g = files(tempDir());
  const transient = runScript('eval-alignment.cjs', withFlag(paidArgs(g), 'max-cost', '3'), { SYLLABUS_CHECK_REPLAY_FAULTS: overloaded });
  assert.equal(transient.status, 0, transient.all);
  assert.equal(readJson(g.ledger).requests, 3, 'never more than --budget requests');
  assert.deepEqual([readJson(g.out).stopped, readJson(g.out).adapterUsage.attempts], ['3 rate limit(s), timeout(s), network or server error(s) (the last: HTTP 529)', 3]);
  for (const run of [credit, tier, overload, capped, tokens, persistent, transient]) noKeyIn([run.all], 'stops');
});

test('a Claude request that never settled (the process was killed) is charged its worst case when its ledger is read again, and the spend register with it', () => {
  const dir = tempDir(), ledgerFile = path.join(dir, 'ledger.json'), registerFile = path.join(dir, 'register.json');
  // What a run killed during its second request leaves: that entry was written (reserved, counted) before it was sent, and never charged.
  fs.writeFileSync(ledgerFile, JSON.stringify({ provider: 'anthropic', model: MODEL, pricesAsOf: '2026-10-27', outputTokens: 300, requests: 2, charged: 0.01, conservative: 0.012, accounting: 'reconcile', transient: 0, invalid: 0, unproductive: 0,
    entries: [{ n: 1, kind: 'model', at: '2026-10-27T00:00:00.000Z', status: 200, worst: 0.21, charged: 0.01, accounting: 'reconciled', conservativeCharge: 0.012, ids: ['a'], maxTokens: 16000, requestId: 'req_1', ms: 900, stopReason: 'end_turn', tokens: null },
      { n: 2, kind: 'model', at: '2026-10-27T00:00:01.000Z', worst: 0.2143, ids: ['b'], maxTokens: 16000, requestId: null, ms: null, stopReason: null, tokens: null }] }));
  const register = openSpendRegister(registerFile, { cap: 10 });
  try {
    const guard = createGuard({ fetch: async () => { throw Error('nothing is sent'); }, maxRequests: 10, maxCost: 1, ledgerFile, provider: 'anthropic', model: MODEL, register });
    assert.ok(Math.abs(guard.ledger.charged - 0.2243) < 1e-9);
    assert.equal(guard.ledger.outputTokens, 16300);
    assert.match(guard.summary().warnings[0], /1 request\(s\) of the ledger .* never settled \(the evaluation ended while they were in flight\): each was charged its worst case/);
    const saved = readJson(ledgerFile);
    assert.deepEqual([saved.charged, saved.outputTokens, saved.entries[1].charged, saved.entries[1].accounting, saved.entries[1].error], [0.2243, 16300, 0.2143, 'worst_case', 'unsettled: the evaluation ended while this request was in flight']);
    assert.equal(readJson(registerFile).total, 0.2243);
    // Read once more, nothing is charged twice.
    const again = createGuard({ fetch: async () => { throw Error('nothing is sent'); }, maxRequests: 10, maxCost: 1, ledgerFile, provider: 'anthropic', model: MODEL, register });
    assert.ok(Math.abs(again.ledger.charged - 0.2243) < 1e-9);
    assert.deepEqual(again.summary().warnings, []);
  } finally { register.release(); }
  // An OpenRouter ledger is read exactly as before.
  const routerLedger = path.join(dir, 'router.json');
  fs.writeFileSync(routerLedger, JSON.stringify({ requests: 1, charged: 0, entries: [{ n: 1, kind: 'model', at: '2026-10-27T00:00:00.000Z', worst: 0.01 }] }));
  const router = createGuard({ fetch: async () => { throw Error('nothing is sent'); }, maxRequests: 10, maxCost: 1, ledgerFile: routerLedger });
  assert.equal(router.ledger.charged, 0);
  assert.equal(fs.readFileSync(routerLedger, 'utf8').includes('unsettled'), false);
  assert.equal(ANTHROPIC_MESSAGES, 'https://api.anthropic.com/v1/messages');
});

test('live-pipeline-eval.cjs: the Claude plan offline, synthetic syllabi only, and a paid --legacy run whose result is evaluation only and keeps officialDetail', () => {
  const plan = runScript('live-pipeline-eval.cjs', ['--provider', 'anthropic', '--legacy', '--syllabi', 'bsit-aligned']);
  assert.equal(plan.status, 0, plan.all);
  assert.match(plan.stdout, /^PLAN ONLY \(Claude\): no provider call is made\. Model claude-sonnet-5-5; thinking adaptive/m);
  assert.match(plan.stdout, /prompt alignment-10 \(every stage off: --legacy\)/);
  assert.match(plan.stdout, /\| BSIT - IT 202 Computer Programming 1 \(aligned\) \| 9 \| 100 \| 927 \| [\d,]+ \| \$\d+\.\d{4} \| \$\d+\.\d{4}-\$\d+\.\d{4} \|/);
  for (const syllabi of ['bsit-aligned,real-prog1', 'real-calc1']) {
    const real = runScript('live-pipeline-eval.cjs', ['--provider', 'anthropic', '--syllabi', syllabi]);
    assert.equal(real.status, 2, real.all);
    assert.match(real.stderr, /Claude evaluates the synthetic syllabi only .*Real syllabi are never read or sent to Anthropic\. No request was sent\./);
  }
  const dir = tempDir(), f = files(dir);
  const live = ['--live', '--confirm-paid', '--provider', 'anthropic', '--model', MODEL, '--thinking', 'adaptive', '--effort', 'high', '--budget', '30', '--max-cost', '3', '--ledger', f.ledger, '--out', f.out, '--spend-register', f.register, '--legacy', '--syllabi', 'bsit-aligned'];
  const noProvider = runScript('live-pipeline-eval.cjs', without(live, 'provider', 'model', 'thinking', 'effort'));
  assert.equal(noProvider.status, 2, noProvider.all);
  assert.match(noProvider.stderr, /A paid run names its provider/);
  for (const [args, refusal] of [[without(live, 'ledger'), /--ledger/], [withFlag(live, 'max-cost', '11'), /at most the total cap/], [without(live, 'budget'), /--budget/], [[...live, '--min-items'], /--min-items is not available/]]) {
    const r = runScript('live-pipeline-eval.cjs', args);
    assert.equal(r.status, 2, r.all);
    assert.match(r.stderr, refusal);
  }
  assert.deepEqual(fs.readdirSync(dir), []);
  const r = runScript('live-pipeline-eval.cjs', live);
  assert.equal(r.status, 0, r.all);
  assert.match(r.stdout, /LIVE: model claude-sonnet-5-5, prompt alignment-10 full \(baseline\), every stage off \(--legacy\)/);
  const report = readJson(f.out), [syllabus] = report.results;
  assert.deepEqual([report.provider, report.model, report.evaluationOnly, report.legacy, report.promptVersion, report.stopped], ['anthropic', MODEL, true, true, 'alignment-10', null]);
  assert.deepEqual([report.modelsReturned, report.usage.anthropic.thinkingReports], [{ [MODEL]: 9 }, { nonzero: 9, zero: 0, unavailable: 0 }]);
  assert.match(r.stdout, /Published prices \(Anthropic's pricing page/);
  assert.match(r.stdout, /Claude usage this run: .*models that answered \{"claude-sonnet-5-5":9\}\. Estimated at the published prices/);
  assert.deepEqual(report.configuration.anthropic.thinkingParameter, { type: 'adaptive' });
  const detail = syllabus.officialDetail, alignment = detail.hybrid.alignment;
  assert.deepEqual([alignment.status, alignment.provider, alignment.model, alignment.evaluationOnly, detail.score, detail.passed, detail.hybrid.ready], ['completed', 'anthropic', MODEL, true, 98, true, true]);
  // Every relationship the replay answered was verified ALIGNED; the two points are the fixture's one reference link, which a live evaluation never
  // opens (its link checker answers not_checked), whichever provider answers.
  assert.ok(alignment.judgements.every(j => j.label === 'ALIGNED' && !j.unverified));
  assert.deepEqual(detail.hybrid.deductions.map(d => [d.kind, d.reason, d.points]), [['link', 'not_checked', 2]]);
  assert.deepEqual(syllabus.official, { score: 98, passed: true, ready: true });
  // The application's approval switch names this model, and still the evaluation's check never counts as a verified one.
  assert.equal(verifiedAlignment(alignment, { SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: MODEL }), false);
  assert.ok(detail.hybrid.alignment.judgements.length > 50 && detail.hybrid.alignment.judgements.every(j => !('draft' in j)), 'officialDetail keeps only what the comparator reads');
  const ledger = readJson(f.ledger);
  assert.deepEqual([ledger.provider, ledger.requests, readJson(f.register).total], ['anthropic', 9, ledger.charged]);
  noKeyIn([r.all, fs.readFileSync(f.out, 'utf8'), fs.readFileSync(f.ledger, 'utf8')], 'live pipeline');
  // The same model twice: the run-to-run noise floor, offline. The replay answers alike, so there is no drift.
  const g = { ledger: path.join(dir, 'ledger-2.json'), out: path.join(dir, 'result-2.json') };
  const r2 = runScript('live-pipeline-eval.cjs', withFlag(withFlag(live, 'ledger', g.ledger), 'out', g.out));
  assert.equal(r2.status, 0, r2.all);
  assert.equal(readJson(f.register).total, Math.round((ledger.charged + readJson(g.ledger).charged) * 1e8) / 1e8);
  const drift = spawnSync(process.execPath, ['--require', NO_SOCKETS, path.join('scripts', 'report-provider-drift.cjs'), '--baseline', f.out, '--candidate', g.out, '--format', 'json'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(drift.status, 0, drift.stderr);
  const out = JSON.parse(drift.stdout);
  assert.deepEqual([out.sameProviderAndModel, out.pairs.length, out.pairs[0].comparison.drift.category, out.categories.NO_SCORING_DRIFT], [true, 1, 'NO_SCORING_DRIFT', 1]);
});

// Five pairs of checks of the BSIT fixture with every stage off on both sides: the candidate's answers differ by an oracle override or fault, so each
// pair gives one drift category. Both sides go through the engine offline (runWithOracle blocks the network).
const manifest = loadManifest(), fixture = variant('bsit', 'aligned', manifest), spec = manifest.variants['bsit-aligned'];
const notAligned = ids => Object.fromEntries(ids.map(id => [id, { label: 'NOT_ALIGNED' }]));
const SCENARIOS = {
  NO_SCORING_DRIFT: {},
  ADVISORY_ONLY_CHANGES: { enhancedOverrides: { 'row1-ilo0-content': { label: 'PARTIALLY_ALIGNED' } } },
  SCORE_ONLY_DRIFT: { enhancedOverrides: { 'row1-ilo0-activity': { label: 'PARTIALLY_ALIGNED' } } },
  PASS_FAIL_CHANGING_DRIFT: { enhancedOverrides: notAligned(['row1-ilo0-clo:c1', 'row4-ilo0-clo:c1', 'row1-ilo0-activity', 'row6-ilo0-activity', 'row2-ilo0-assessment', 'row7-ilo0-assessment', 'row8-ilo0-assessment', 'row3-value', 'row9-value']) },
  SUBMISSION_GATE_DIFFERENCES: { enhancedFaults: [{ type: 'always_empty_judgements', onPair: 'clo0-po7' }] },
};
const sideOf = (provider, model, results) => ({ generated: '2026-10-27T00:00:00.000Z', provider, model, promptVersion: 'alignment-10', prompt: 'full', legacy: true, results });

test('officialOf keeps everything the scoring comparator reads, and report-provider-drift.cjs gives every drift category offline', async () => {
  const baseline = [], candidate = [];
  for (const [category, options] of Object.entries(SCENARIOS)) {
    const run = await runPairedOfficialComparison(structuredClone(fixture), { variantSpec: spec, enhancedEnv: { ...LEGACY_ENV }, ...options });
    assert.equal(run.comparison.drift.category, category);
    assert.deepEqual(comparePairedOfficial(officialOf(run.legacyResult), officialOf(run.enhancedResult)), run.comparison, `${category}: the comparator reads nothing officialOf leaves out`);
    baseline.push({ name: category, syllabus: `BSIT fixture (${category})`, officialDetail: officialOf(run.legacyResult) });
    candidate.push({ name: category, syllabus: `BSIT fixture (${category})`, officialDetail: officialOf(run.enhancedResult) });
  }
  const dir = tempDir(), baseFile = path.join(dir, 'baseline.json'), candFile = path.join(dir, 'candidate.json');
  fs.writeFileSync(baseFile, JSON.stringify(sideOf('openrouter', 'minimax/minimax-m3.1-flash', [...baseline, { name: 'only-here', syllabus: 'checked on one side', officialDetail: baseline[0].officialDetail }])));
  fs.writeFileSync(candFile, JSON.stringify({ ...sideOf('anthropic', MODEL, [...candidate, { name: 'failed', syllabus: 'its check failed', error: 'x' }]), evaluationOnly: true }));
  const inProcess = compareProviders(readJson(baseFile), readJson(candFile));
  assert.deepEqual(inProcess.categories, Object.fromEntries(Object.keys(DRIFT_CATEGORIES).map(key => [key, 1])));
  assert.deepEqual([inProcess.unpaired.baselineOnly, inProcess.unpaired.candidateOnly, inProcess.sameProviderAndModel, inProcess.candidate.evaluationOnly], [['only-here'], ['failed'], false, true]);
  const report = (args, env) => spawnSync(process.execPath, ['--require', NO_SOCKETS, path.join('scripts', 'report-provider-drift.cjs'), ...args], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env } });
  const json = report(['--baseline', baseFile, '--candidate', candFile, '--format', 'json']);
  assert.equal(json.status, 0, json.stderr);
  const parsed = JSON.parse(json.stdout);
  assert.deepEqual(parsed.categories, inProcess.categories);
  assert.deepEqual(parsed.pairs.map(p => [p.name, p.comparison.drift.category]), Object.keys(SCENARIOS).map(key => [key, key]));
  const outFile = path.join(dir, 'drift.md');
  const md = report(['--baseline', baseFile, '--candidate', candFile, '--out', outFile]);
  assert.equal(md.status, 0, md.stderr);
  assert.equal(fs.readFileSync(outFile, 'utf8'), md.stdout);
  for (const label of Object.values(DRIFT_CATEGORIES)) assert.ok(md.stdout.includes(`**${label}**`), label);
  assert.match(md.stdout, /- \*\*Baseline:\*\* `openrouter\/minimax\/minimax-m3\.1-flash`/);
  assert.match(md.stdout, /- \*\*Candidate:\*\* `anthropic\/claude-sonnet-5-5` .*evaluation only/);
  assert.match(md.stdout, /every stage off \(--legacy\)/);
  assert.match(md.stdout, /\| 100 -> 73 \(-27\) \| PASS -> FAIL \(\*\*FLIPPED\*\*\)/);
  assert.match(md.stdout, /Not compared \(checked on one side only, or without an official result\): baseline only-here; candidate failed\./);
  assert.match(md.stdout, /\| `row1-ilo0-activity` \| `ILO-activity` \|/);
  // Refused: a paid flag, an existing output, settings that differ, a file without results, and two files with no syllabus compared.
  for (const [args, refusal] of [
    [['--baseline', baseFile, '--candidate', candFile, '--live'], /strictly OFFLINE/],
    [['--baseline', baseFile, '--candidate', candFile, '--confirm-paid'], /strictly OFFLINE/],
    [['--baseline', baseFile, '--candidate', candFile, '--out', outFile], /already exists: a report never overwrites a file/],
    [['--baseline', baseFile], /--baseline and --candidate/],
  ]) {
    const r = report(args);
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.match(r.stderr, refusal);
  }
  const otherSettings = path.join(dir, 'other.json');
  fs.writeFileSync(otherSettings, JSON.stringify({ ...sideOf('anthropic', MODEL, candidate), legacy: false, promptVersion: 'alignment-12ab34c1c2d1d2-r8-a8' }));
  const differ = report(['--baseline', baseFile, '--candidate', otherSettings]);
  assert.equal(differ.status, 2);
  assert.match(differ.stderr, /REFUSED: the two results differ in promptVersion \("alignment-10" vs "alignment-12ab34c1c2d1d2-r8-a8"\), legacy \(true vs false\)/);
  const noResults = path.join(dir, 'no-results.json'), old = path.join(dir, 'old.json');
  fs.writeFileSync(noResults, JSON.stringify({ provider: 'openrouter' }));
  fs.writeFileSync(old, JSON.stringify(sideOf('openrouter', 'minimax/minimax-m3.1-flash', [{ name: 'bsit-aligned', official: { score: 100, passed: true, ready: true } }])));
  assert.match(report(['--baseline', noResults, '--candidate', candFile]).stderr, /is not a result file of scripts\/live-pipeline-eval\.cjs/);
  const none = report(['--baseline', old, '--candidate', old]);
  assert.equal(none.status, 2);
  assert.match(none.stderr, /no syllabus was checked on both sides with an official result \(officialDetail, which result files written before Stage S7 do not keep\)/);
});
