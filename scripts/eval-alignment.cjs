#!/usr/bin/env node
'use strict';
// Runs an evaluation dataset against the CONFIGURED provider and model (server/.env) and reports how the verdicts compare with the dataset's
// accepted verdicts. It calls the real provider and costs money; it is never run by `npm test`.
//
//   node scripts/eval-alignment.cjs --plan [--dataset ...]          what a run would cost (no network, no key needed)
//   node scripts/eval-alignment.cjs --confirm-paid [--dataset general|alignment] [--split dev|heldout|all] [--variant current|calibrated|rubric|rubric-ordered]
//                                   [--runs 2] [--types CLO-PO,ILO-CLO] [--out result.json] [--reveal]
//                                   [--budget 60] [--max-cost 0.05] [--max-transient 3] [--max-unproductive N] [--max-unresolved 0.2] [--min-sample 8]
//                                   [--warn-invalid N] [--max-invalid N] [--accounting reconcile|conservative] [--min-items] [--max-tokens N]
//                                   [--ledger <file>] [--previous-ledger <closed ledger>] [--check-key]
//                                   [--ids exact-id,exact-id]  unchanged items from this dataset only; invalid/duplicate/empty selections fail before HTTP
//                                   [--review-between-batches] operator review before another paid batch; anything except 'continue' stops
//
// Every provider request goes through the guard in server/lib/syllabuscheck/eval/providerGuard.js, which checks it BEFORE it is sent: at most --budget
// requests in all (retries and the price lookup included; --ledger carries the count and the charges into the next invocation, and --previous-ledger
// names the closed ledger this one follows), and only while the dollars charged plus the request's worst case at the model's current highest prices fit
// under --max-cost. The worst case is reserved before a request is sent; a reliable provider-reported cost settles it afterwards (--accounting
// reconcile, the default since Stage E.6; conservative charges the larger of the reported cost and the tokens at the highest prices, and a timeout or
// a request without usage is always charged its worst case). HTTP 401/402/403 stops at once, as does any other refusal of the request format;
// --max-transient rate limits, timeouts, network or server errors stop; --max-unproductive answers in a row that verified no relationship stop.
// Stage E.6 (docs/stage-e6-evaluation-reliability.md): the run is counted by distinct relationship (eval/evalMetrics.js) and, between batches, stops
// when the final unresolved rate exceeds --max-unresolved once --min-sample relationships were attempted; the result says whether the run completed
// for academic use (completion). Answers that failed validation in whole or in part warn at --warn-invalid (default 40% of --budget, at least 3, the
// earlier stop) and stop only when --max-invalid is given. After a stop nothing more is sent, and what completed is still scored and written (--out).
// --min-items asks the provider for a non-empty judgements list (only while a stage is on; SYLLABUS_CHECK_SCHEMA_MIN_ITEMS=on in the local env object).
// --check-key (Stage E.7) asks OpenRouter whether the key is accepted before the price lookup and the first paid request: one more counted request,
// which bills nothing. A refused key stops the run there; only the status and fields that say nothing about the key are printed and kept.
// A paid run needs --confirm-paid and --provider (OpenRouter, whose listed prices bound the cost, or Claude below), and never overwrites an earlier
// result (--out must be a new file). The global fetch is blocked, so nothing goes around the guard, and the provider and the stage switches live in a
// local env object (process.env and server/.env are never changed).
//
// Stage S7, Claude through the direct Anthropic API, for evaluation only:
//   node scripts/eval-alignment.cjs --provider anthropic --plan [--model claude-sonnet-5-5] [--thinking adaptive|off] [--effort high] [--dataset ...]
//   node scripts/eval-alignment.cjs --provider anthropic --confirm-paid --model claude-sonnet-5-5 --thinking adaptive --effort high
//                                   --budget N --max-cost D --ledger <file> --out <new file> [--total-cap 10] [--spend-register <file>]
//                                   [--max-output-tokens N] [--max-tokens 16000] [--timeout-sec 180] [--max-retries 2] [--confirm-heldout] [--heldout-log <file>]
// The provider is named on the command line, never taken from server/.env, and only a model approved for evaluation is asked (EVALUATION_MODELS in
// server/lib/syllabuscheck/eval/claudeEvaluation.js, which keeps what the evaluation scripts share about Claude). The
// local env object holds the model and its settings without the application's approval switch (SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL is removed),
// and the adapter is asked as an evaluation (providerConfig { evaluation: true }): the result is marked evaluationOnly and never counts as a verified
// check, an official score or a submission gate. --plan builds every first request through the adapter offline and prints its worst case at the prices
// pinned in anthropicClient.js. A paid Claude run states its model, thinking and effort, and needs --budget, --max-cost, --ledger and --out; every
// Claude ledger records what it charged in the spend register (--spend-register, default docs/ai-eval-anthropic/spend-register.json), whose total cap
// (--total-cap, default and at most AUTHORIZED_TOTAL, $10) no evaluation passes, and whose lock lets one Claude evaluation spend at a time. --max-output-tokens
// caps the output tokens of the ledger, thinking included; --max-tokens sets max_tokens (1024-16000), --timeout-sec the deadline of one question
// (10-300) and --max-retries the adapter's retries (0-3). Held-out items need --confirm-heldout and are logged to docs/ai-eval-anthropic/heldout-log.jsonl,
// never to the OpenRouter log; --reveal, --min-items and --check-key are refused. A first Ctrl+C stops sending (the request in flight still settles); a
// second quits. The guard's figures are its own accounting at the pinned prices, never Anthropic's invoice, and an estimate is never a spending limit.
//
// P2 preparation: every plan and run names its mode, from the wording it uses (A, the legacy academic alignment benchmark: no stage on; B, the enhanced
// staged semantic evaluation: a stage on), and a run reports beside the agreement the quality measures of server/lib/syllabuscheck/eval/qualityMetrics.js
// (result.quality): strict and permissive agreement, false approvals and rejections, insufficient evidence, Bloom disagreements, unsupported
// recommendations, the mapping remedy (a rewrite where a re-tag may suit better), evidence quotation, latency, tokens and cost. A held-out run keeps their
// counts only.
//
//   --dataset general    server/lib/syllabuscheck/eval/dataset.json     (all relationship types, 41 items; the default)
//   --dataset alignment  server/lib/syllabuscheck/eval/alignment-dataset.json   (ILO-CLO, CLO-EGA, CLO-PO; development and held-out splits)
//   --dataset stage-a    server/lib/syllabuscheck/eval/stage-a-dataset.json   (Course-CLO, CLO-set and CLO-PO keyword traps for BSIT, BSIE and BSCpE courses; unreviewed)
//   --split              alignment and stage-c3 datasets only. `dev` (default) is what prompts are tuned on. `heldout` must not be used to tune:
//                        it prints aggregates only (add --reveal to see items) and every held-out run is appended to docs/ai-eval-heldout-log.jsonl.
//   --dataset stage-b    server/lib/syllabuscheck/eval/stage-b-dataset.json   (Content-course, Content-ILO and Plan-sequence for the same three courses; unreviewed). Switches Stage B on.
//   --dataset stage-b3 | stage-b4   ILO-CLO / ILO-anyCLO mapping items, and CLO-coverage items built by coverage.js (each switches its own stage on; the other stages stay as set)
//   --dataset stage-c    Activity-fit (C1) and Assessment-fit (C2) items built by lessonfit.js (switches both on)
//   --dataset stage-c3   Content-activity, Content-assessment and Activity-assessment items built by lessonfit.chainPairs (switches C3 on; synthetic,
//                        unreviewed; development and held-out splits, `dev` by default)
//   --dataset stage-d1 | stage-d2   Value-use (D1) and Ref-relevance (D2) items built by values.js / references.js (each switches its own stage on); synthetic and unreviewed
//   --dataset stage-d1-followup | stage-d2-followup   versioned E.7 offline datasets; the original aliases keep their original examples and expectations
//   --legacy             ask with the alignment-10 wording (Stage A off, what the application uses today); --stage-a forces Stage A on for any dataset
//   --variant            the prompt wording to test (server/lib/syllabuscheck/variants.js). Production uses `current`.
//
// Requests go through the same retry path the app uses (judgeBatch), so the report includes the retry rate and the answers that never verified.
// The expected verdicts are written by the developer and NOT validated by faculty: read the numbers as a baseline and as a way to compare
// prompts or models with each other, never as agreement with faculty.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'server');
const g = require(path.join(root, 'lib/syllabuscheck/gemini.js'));
const { scoreEval } = require(path.join(root, 'lib/syllabuscheck/eval/metrics.js'));
const { answerOf, summarizeReviews } = require(path.join(root, 'lib/syllabuscheck/eval/answerReviews.js'));
const { reviewBatch } = require(path.join(root, 'lib/syllabuscheck/eval/batchReview.js'));
const { stageFlags, anyStage } = require(path.join(root, 'lib/syllabuscheck/stages.js'));
const { createGuard, loadedDataModules, openSpendRegister, claudePrices, claudePriceTable, describeClaudePrices, describeClaudeUsage } = require(path.join(root, 'lib/syllabuscheck/eval/providerGuard.js'));
const { createTracker, academicStopOf, completionOf, describe: describeMetrics } = require(path.join(root, 'lib/syllabuscheck/eval/evalMetrics.js'));
const { anthropicSettings, requestConfigOf } = require(path.join(root, 'lib/syllabuscheck/anthropicClient.js'));
const { claudeOptionsOf, applyClaudeEnv, planCostOf, PLAN_KEY } = require(path.join(root, 'lib/syllabuscheck/eval/claudeEvaluation.js'));
const { qualityOf, describeQuality, describeMode, modeOf } = require(path.join(root, 'lib/syllabuscheck/eval/qualityMetrics.js'));

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback; };
const has = (name) => args.includes('--' + name);
const datasetName = flag('dataset', 'general');
const file = { general: 'dataset.json', alignment: 'alignment-dataset.json', 'stage-a': 'stage-a-dataset.json', 'stage-b': 'stage-b-dataset.json', 'stage-b3': 'stage-b3-dataset.json', 'stage-b4': 'stage-b4-dataset.json', 'stage-c': 'stage-c-dataset.json', 'stage-c3': 'stage-c3-dataset.json', 'stage-d1': 'stage-d1-dataset.json', 'stage-d2': 'stage-d2-dataset.json', 'stage-d1-followup': 'stage-d1-followup-dataset.json', 'stage-d2-followup': 'stage-d2-followup-dataset.json' }[datasetName];
if (!file) { console.error('--dataset must be general, alignment, stage-a, stage-b, stage-b3, stage-b4, stage-c, stage-c3, stage-d1, stage-d2, stage-d1-followup or stage-d2-followup'); process.exit(2); }
const dataset = require(path.join(root, 'lib/syllabuscheck/eval', file));
const split = flag('split', ['alignment', 'stage-c3'].includes(datasetName) ? 'dev' : 'all');
const runsWanted = Math.max(1, Math.min(10, Number(flag('runs', 2)) || 2));
const only = flag('types', '') ? new Set(flag('types', '').split(',')) : null;
const selectedIds = has('ids') ? flag('ids', '').split(',').map(id => id.trim()) : null;
if (selectedIds && (selectedIds.some(id => !id) || new Set(selectedIds).size !== selectedIds.length || selectedIds.some(id => !dataset.items.some(item => item.id === id)))) {
  console.error('--ids must be a nonempty, unique list of exact IDs in the selected dataset. No request was sent.'); process.exit(2);
}
const reveal = has('reveal');
const budget = Math.max(1, Number(flag('budget', flag('max-requests', 60))) || 60); // most provider requests this run may make, retries included
const maxCost = Number(flag('max-cost', 0.05)), maxTransient = Number(flag('max-transient', 3));
// Stage E.6: invalid answers warn (at the earlier stop) and stop only when --max-invalid is given; the academic stop is the final unresolved rate.
const maxInvalid = flag('max-invalid', '') ? Number(flag('max-invalid', '')) : Infinity, warnInvalid = Number(flag('warn-invalid', Math.max(3, Math.ceil(budget * 0.4))));
const unproductiveGiven = flag('max-unproductive', '') ? Number(flag('max-unproductive', '')) : null, maxUnresolved = Number(flag('max-unresolved', 0.2)), minSample = Number(flag('min-sample', 8));
const accounting = flag('accounting', 'reconcile'), maxTokens = flag('max-tokens', '') ? Number(flag('max-tokens', '')) : null;
if (!(maxUnresolved >= 0 && maxUnresolved <= 1) || !(Number.isInteger(minSample) && minSample >= 1)) { console.error('--max-unresolved must be a share from 0 to 1 and --min-sample a positive integer'); process.exit(2); }
const ledgerFile = flag('ledger', '') || null, previousLedger = flag('previous-ledger', '') || null;
const HELDOUT_LOG = path.join(__dirname, '..', 'docs', 'ai-eval-heldout-log.jsonl'); // every OpenRouter look at the held-out split

// Stage S7: the provider is named here, never taken from server/.env. Claude is asked only for evaluation, only for a model approved for it
// (eval/claudeEvaluation.js), and only within the authorized total, whatever the spend register says.
const providerName = flag('provider', '');
if (has('provider') && !['openrouter', 'anthropic'].includes(providerName)) { console.error('--provider must be openrouter or anthropic. No request was sent.'); process.exit(2); }
if (has('confirm-paid') && !has('plan') && !providerName) { console.error('A paid run names its provider: --provider openrouter or --provider anthropic. It is never taken from server/.env. No request was sent.'); process.exit(2); }
const claude = providerName === 'anthropic';
let claudeOptions = null;
if (claude) {
  const { options, problems } = claudeOptionsOf({ has, flag, paid: has('confirm-paid'), refused: ['reveal', 'min-items', 'check-key'] });
  if (path.resolve(options.heldoutLog) === path.resolve(HELDOUT_LOG)) problems.push('--heldout-log must not be the OpenRouter held-out log');
  if (problems.length) { console.error(`${problems.join('\n')}\nNo request was sent.`); process.exit(2); }
  claudeOptions = options;
}

const env = { ...process.env };
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim(); }
if (flag('variant', '')) env.SYLLABUS_CHECK_PROMPT_VARIANT = flag('variant', '');
// Stage A is off in the application until approved. An evaluation names which wording it measures: Stage A on (the default here for the stage-a
// dataset), or --legacy for the alignment-10 wording the application uses today.
env.SYLLABUS_CHECK_STAGE_A = has('legacy') ? 'off' : (datasetName === 'stage-a' || datasetName === 'stage-b' || has('stage-a')) ? 'on' : (env.SYLLABUS_CHECK_STAGE_A || 'off');
env.SYLLABUS_CHECK_STAGE_B3 = has('legacy') ? 'off' : (datasetName === 'stage-b3' || has('stage-b3')) ? 'on' : (env.SYLLABUS_CHECK_STAGE_B3 || 'off');
env.SYLLABUS_CHECK_STAGE_C1 = has('legacy') ? 'off' : (datasetName === 'stage-c' || has('stage-c1')) ? 'on' : (env.SYLLABUS_CHECK_STAGE_C1 || 'off');
env.SYLLABUS_CHECK_STAGE_D1 = has('legacy') ? 'off' : (['stage-d1', 'stage-d1-followup'].includes(datasetName) || has('stage-d1')) ? 'on' : (env.SYLLABUS_CHECK_STAGE_D1 || 'off');
env.SYLLABUS_CHECK_STAGE_D2 = has('legacy') ? 'off' : (['stage-d2', 'stage-d2-followup'].includes(datasetName) || has('stage-d2')) ? 'on' : (env.SYLLABUS_CHECK_STAGE_D2 || 'off');
env.SYLLABUS_CHECK_STAGE_C2 = has('legacy') ? 'off' : (datasetName === 'stage-c' || has('stage-c2')) ? 'on' : (env.SYLLABUS_CHECK_STAGE_C2 || 'off');
env.SYLLABUS_CHECK_STAGE_C3 = has('legacy') ? 'off' : (datasetName === 'stage-c3' || has('stage-c3')) ? 'on' : (env.SYLLABUS_CHECK_STAGE_C3 || 'off');
env.SYLLABUS_CHECK_STAGE_B4 = has('legacy') ? 'off' : (datasetName === 'stage-b4' || has('stage-b4')) ? 'on' : (env.SYLLABUS_CHECK_STAGE_B4 || 'off');
env.SYLLABUS_CHECK_STAGE_B = has('legacy') ? 'off' : (datasetName === 'stage-b' || has('stage-b')) ? 'on' : (env.SYLLABUS_CHECK_STAGE_B || 'off');
env.SYLLABUS_CHECK_SCHEMA_MIN_ITEMS = has('min-items') ? 'on' : 'off'; // Stage E.6: only with --min-items, and only in this object
if (claude) applyClaudeEnv(env, claudeOptions); // the model and its settings, in this object only, and no approval switch
else if (providerName) env.SYLLABUS_CHECK_AI_PROVIDER = providerName;
const claudeRequest = claude ? requestConfigOf(claudeOptions.model, anthropicSettings(env)) : null; // the thinking and effort every request carries
if (claudeRequest?.problem) { console.error(`${claudeRequest.problem}. No request was sent.`); process.exit(2); }
const config = g.providerConfig(env, { evaluation: claude });
if (!config.configured && !has('plan')) { console.error(`No usable AI provider is configured (${config.provider || 'none'} ${config.model}).`); process.exit(2); }
// Claude: what each request used, as the adapter reports it (also for an answer that was refused or cut off: it was billed all the same).
const adapterUsage = claude ? g.usageTotal() : null;
const providerRequest = claude ? (pairs, options) => g.requestAnthropic(pairs, { ...options, onUsage: (used) => adapterUsage.add(used) }) : config.provider === 'openrouter' ? g.requestOpenRouter : g.requestGemini;
const promptVersion = g.promptVersionOf(config.model, env);
// --max-unproductive: by default the most answers one batch's retries can bring when none of them verifies anything: 1 + 2 x the batch size under the
// staged policy (9 for a batch of 4: each relationship is sent at most MAX_ATTEMPTS = 3 times, and every request carries at least one), 1 + 3 x the
// batch size under the legacy cascade (every stage off: after its batch, each relationship is asked alone up to three times).
const maxUnproductive = unproductiveGiven ?? 1 + (anyStage(stageFlags(env)) ? g.MAX_ATTEMPTS - 1 : 3) * g.batchSizeOf(config.model, env);

const { readAspects, coverageOf, TYPES: ASPECT_TYPES } = require(path.join(root, 'lib/syllabuscheck/aspects.js'));
const items = dataset.items.filter((item) => (!selectedIds || selectedIds.includes(item.id)) && (!only || only.has(item.type)) && (split === 'all' || !item.split || item.split === split));
if (!items.length || (selectedIds && items.length !== selectedIds.length)) {
  console.error('The item filters are empty or conflict with --ids. No request was sent.'); process.exit(2);
}
const datasetInfo = { name: datasetName, version: dataset.version, split, reviewStatus: dataset.reviewStatus || 'unreviewed',
  ...(selectedIds ? { selection: { parentItems: dataset.items.length, selectedIds: items.map(item => item.id) } } : {}) };
const configuration = { stageFlags: stageFlags(env), promptVariant: env.SYLLABUS_CHECK_PROMPT_VARIANT || 'current',
  trim: String(env.SYLLABUS_CHECK_PROMPT_TRIM || '').toLowerCase() === 'on', minItems: g.minItemsOn(env, config.model), timeoutMs: claude ? anthropicSettings(env).timeoutMs : g.timeoutOf(config.model, env),
  ...(claude ? { anthropic: { model: config.model, thinking: claudeOptions.thinking, thinkingParameter: claudeRequest.thinking, effort: claudeRequest.effort, maxTokens: claudeOptions.maxTokens, maxRetries: claudeOptions.maxRetries, promptCache: true, evaluationOnly: true } } : {}) };
const usesHeldout = items.some((item) => item.split === 'heldout');
const disciplineOf = (item) => dataset.courses[item.course] && dataset.courses[item.course].discipline;
const pairOf = (item) => ({ id: item.id, type: item.type, source: item.source, target: item.target, path: 'eval', targetPath: g.isNoRewrite(item.type) ? null : 'eval' });

// --plan: what a run WOULD cost, from the dataset and the prompt alone. It calls no provider and needs no key.
// The request multiplier (1.5x to 4.5x the number of batches) is what earlier bounded runs actually needed because of refused first answers and retries;
// the price per token is the blended rate those runs were billed. Both are observations, not quotes.
function printPlan() {
  const size = g.batchSizeOf(config.model, env);
  let batches = 0, dataChars = 0, systemChars = 0, systemCharsTrimmed = 0;
  const { systemPromptOf } = g;
  for (const course of Object.keys(dataset.courses)) {
    const mine = items.filter((item) => item.course === course);
    for (let i = 0; i < mine.length; i += size) {
      const batch = mine.slice(i, i + size).map(pairOf);
      batches += 1;
      dataChars += batch.reduce((n, p) => n + p.source.length + p.target.length + 60, 0);
      systemChars += systemPromptOf('current', env, batch).length;
      systemCharsTrimmed += systemPromptOf('current', { ...env, SYLLABUS_CHECK_PROMPT_TRIM: 'on' }, batch).length;
    }
  }
  const base = batches * runsWanted, low = Math.ceil(base * 1.5), high = Math.ceil(base * 4.5);
  // Stage E.6: the most requests the bounded retries allow (each relationship sent at most MAX_ATTEMPTS times, every request carrying at least one):
  // 1 + 2 x its relationships for each batch. The budget cap stops a run before this when it is lower.
  const retryCeiling = anyStage(stageFlags(env)) ? (batches + (g.MAX_ATTEMPTS - 1) * items.length) * runsWanted : null;
  const perRun = (chars) => Math.round((chars + dataChars) / 4);
  const tokens = (chars, mult) => Math.round(perRun(chars) * runsWanted * mult);
  const dollars = (n) => '$' + (n * 8.9e-8).toFixed(4);
  console.log(`PLAN (no provider call is made)`);
  console.log(`Dataset ${dataset.version} (${datasetName}): ${items.length} items, ${runsWanted} run(s), ${batches} batches per run (batch size ${size}); stages on: ${JSON.stringify(stageFlags(env))}`);
  const pending = items.filter(item => item.excludeFromAgreement);
  if (pending.length) console.log(`Agreement scope: ${items.length - pending.length} scored items; ${pending.length} diagnostic(s) await a faculty/schema decision and are excluded from agreement.`);
  console.log(`Prompt ${promptVersion}${anyStage(stageFlags(env)) ? '' : ' (no stage on)'}`);
  if (selectedIds) console.log(`Selected unchanged IDs (${items.length} of ${dataset.items.length}): ${items.map(item => item.id).join(', ')}`);
  console.log(`Evaluation configuration: ${JSON.stringify(configuration)}`);
  console.log(`Requests: ${base} without retries; expected ${low}-${high} with retries; budget cap ${budget}${high > budget ? '  <-- the cap is below the pessimistic estimate: raise --budget or run fewer items' : ''}`);
  if (retryCeiling !== null) console.log(`Retry exposure: at most ${retryCeiling} model requests under the bounded retries (${g.MAX_ATTEMPTS} sends per relationship at most), plus 1 price lookup; the budget cap ${budget} and --max-cost $${maxCost} stop it first when lower`);
  console.log(`Stops: ${maxTransient} rate limits/timeouts/server errors; ${maxUnproductive} answers in a row that verify nothing; final unresolved rate above ${maxUnresolved} once ${minSample} relationships were attempted; HTTP 401/402/403 and other refusals at once; invalid answers warn at ${warnInvalid}${maxInvalid === Infinity ? '' : ` and stop at ${maxInvalid}`}; accounting ${accounting}`);
  console.log(`Schema: ${g.minItemsOn(env, config.model) ? 'judgements list with minItems 1 (--min-items)' : 'judgements list as before (no minItems)'}`);
  console.log(`Prompt tokens (approx, chars/4): full prompt ${tokens(systemChars / batches * batches, low / base)}-${tokens(systemChars, high / base)}; with SYLLABUS_CHECK_PROMPT_TRIM=on ${tokens(systemCharsTrimmed, low / base)}-${tokens(systemCharsTrimmed, high / base)} (the trim needs a stage flag on)`);
  console.log(`Cost at the rate earlier runs were billed (${'$0.089'} per million tokens, blended): full ${dollars(tokens(systemChars, low / base))}-${dollars(tokens(systemChars, high / base))}; trimmed ${dollars(tokens(systemCharsTrimmed, low / base))}-${dollars(tokens(systemCharsTrimmed, high / base))}`);
}
// Stage S7: what a Claude run would send and what it could cost, offline. Every first request is built by the adapter itself (gemini.js requestAnthropic,
// anthropicClient.js and the SDK) with a placeholder key, and caught by a transport that sends nothing, so each worst case is the guard's own bound on
// exactly the bytes a run would send at the pinned prices; the expected range is an estimate, never a limit (eval/claudeEvaluation.js planCostOf).
async function printClaudePlan() {
  const o = claudeOptions, prices = claudePrices(config.model), table = claudePriceTable(prices), size = g.batchSizeOf(config.model, env), staged = anyStage(stageFlags(env));
  const planEnv = { ...env, ANTHROPIC_API_KEY: PLAN_KEY }; // the adapter needs a key in Anthropic's format; this one is never sent
  const bodies = [], capture = async (url, init) => { bodies.push(String(init.body)); throw Object.assign(Error('plan only: nothing is sent'), { refused: true }); };
  for (const course of Object.keys(dataset.courses)) {
    const mine = items.filter((item) => item.course === course);
    for (let i = 0; i < mine.length; i += size) {
      try { await g.requestAnthropic(mine.slice(i, i + size).map(pairOf), { env: planEnv, transport: capture, course: dataset.courses[course] }); } catch (error) { if (!error.refused) throw error; }
    }
  }
  const cost = planCostOf(bodies, prices, runsWanted), base = cost.requests, largest = cost.largest;
  // The most requests a run can make: the checker's retries (staged: 1 + 2 x the relationships of each batch; legacy: 1 + 3 x), each request sent at most
  // 1 + --max-retries times by the adapter (a rate limit, an overload, a server error or a dropped connection).
  const asked = (bodies.length + (staged ? g.MAX_ATTEMPTS - 1 : 3) * items.length) * runsWanted, ceiling = asked * (1 + o.maxRetries);
  const usd = (v) => `$${v.toFixed(4)}`;
  let registered = 'not created yet: no Claude evaluation has been charged';
  try { if (fs.existsSync(o.register)) { const r = JSON.parse(fs.readFileSync(o.register, 'utf8')); registered = `$${r.total ?? 0} charged by every Claude ledger so far, of its cap $${r.cap}`; } } catch { registered = 'unreadable: a paid run would refuse it'; }
  const budgetGiven = has('budget') || has('max-requests'), costGiven = has('max-cost');
  console.log('PLAN (no provider call is made: every request below was built by the adapter and kept in this process)');
  console.log(`Provider anthropic (Claude, direct API), model ${config.model}; thinking ${o.thinking} (${JSON.stringify(claudeRequest.thinking)}), effort ${claudeRequest.effort}, max_tokens ${o.maxTokens}, timeout ${o.timeoutSec} s, adapter retries ${o.maxRetries}, prompt cache on; EVALUATION ONLY: never a verified check, an official score or a submission gate`);
  console.log(`Dataset ${dataset.version} (${datasetName}): ${items.length} items, ${runsWanted} run(s), ${bodies.length} batches per run (batch size ${size}); stages on: ${JSON.stringify(stageFlags(env))}`);
  const pending = items.filter(item => item.excludeFromAgreement);
  if (pending.length) console.log(`Agreement scope: ${items.length - pending.length} scored items; ${pending.length} diagnostic(s) await a faculty/schema decision and are excluded from agreement.`);
  console.log(`Prompt ${promptVersion}${staged ? '' : ' (no stage on)'}`);
  console.log(describeMode(modeOf(stageFlags(env))));
  if (selectedIds) console.log(`Selected unchanged IDs (${items.length} of ${dataset.items.length}): ${items.map(item => item.id).join(', ')}`);
  if (usesHeldout) console.log(`Held-out items: ${items.filter((item) => item.split === 'heldout').length}. A paid run needs --confirm-heldout, reports aggregates only and logs the look to ${path.relative(process.cwd(), path.resolve(o.heldoutLog))}`);
  console.log(`Evaluation configuration: ${JSON.stringify(configuration)}`);
  console.log(describeClaudePrices(table));
  console.log(`Requests: ${base} without retries; at most ${ceiling} with every retry allowed (${asked} asked by the checker, each sent at most ${1 + o.maxRetries} time(s) by the adapter); budget cap ${budgetGiven ? budget : 'not given (a paid run needs --budget)'}${budgetGiven && base > budget ? '  <-- below the requests without retries: the run would stop before it ends' : ''}`);
  console.log(`Worst case (the guard's bound, reserved before each request is sent): ${usd(cost.worst / base)} per request on average, the largest ${usd(largest)}; ${usd(cost.worst)} for the requests without retries; ${usd(ceiling * largest)} if every allowed request were sent at the largest`);
  console.log(`Expected (an estimate, not a limit): ${usd(cost.low)}-${usd(cost.high)} for the requests without retries (about ${cost.inputTokensPerRequest.toLocaleString('en-US')} input tokens per request; 150-400 output tokens per relationship; thinking ${claudeRequest.thinking.type === 'adaptive' ? '500-3,000' : '0'} tokens per request)`);
  console.log(`Caps that stop a run: --budget ${budgetGiven ? budget : '(required)'} requests; --max-cost ${costGiven ? `$${maxCost}${largest > maxCost ? `  <-- below the worst case of one request ($${largest.toFixed(4)}): nothing would be sent` : ''}` : `(required: at least the largest worst case, $${largest.toFixed(4)})`}; --total-cap $${o.totalCap} over every Claude evaluation (spend register ${path.relative(process.cwd(), path.resolve(o.register))}: ${registered}); --max-output-tokens ${o.maxOutputTokens ?? 'none'}${o.maxOutputTokens && o.maxOutputTokens < o.maxTokens ? `  <-- below max_tokens ${o.maxTokens}: nothing would be sent` : ''}`);
  console.log(`Stops: ${maxTransient} rate limits/timeouts/server errors; ${maxUnproductive} answers in a row that verify nothing; final unresolved rate above ${maxUnresolved} once ${minSample} relationships were attempted; a spend limit, an exhausted credit balance, HTTP 401/402/403 and other refusals at once; invalid answers warn at ${warnInvalid}${maxInvalid === Infinity ? '' : ` and stop at ${maxInvalid}`}; accounting ${accounting}`);
  console.log(`A paid run: --provider anthropic --confirm-paid --model ${config.model} --thinking ${o.thinking} --effort ${claudeRequest.effort} --budget N --max-cost D --ledger <file> --out <new file>${usesHeldout ? ' --confirm-heldout' : ''}`);
  console.log('Estimates are not spending limits: the caps are the guard\'s own accounting at the pinned prices, and Anthropic\'s invoice (the Console\'s usage page) is what counts.');
}
if (has('plan') && !claude) { printPlan(); process.exit(0); }
const planning = has('plan'); // from here on, only the Claude plan (asynchronous: it runs at the start of the main function below, with the global fetch blocked)
if (!planning && !has('confirm-paid')) { console.error('This run makes PAID provider calls. Add --confirm-paid to confirm, after approval (--plan shows what it would cost).'); process.exit(2); }
if (!planning && !claude && config.provider !== 'openrouter') { console.error(`A paid run needs the OpenRouter provider: its listed prices bound the cost of every request (configured: ${config.provider || 'none'}).`); process.exit(2); }
const outFile = flag('out', '');
if (!planning) {
  // Stage S7: an evaluation never overwrites an earlier result, whichever provider made it.
  const taken = [outFile, has('review-between-batches') && outFile ? outFile + '.progress.json' : ''].filter((file) => file && fs.existsSync(file));
  if (taken.length) { console.error(`${taken.join(' and ')} already exist(s): an evaluation never overwrites an earlier result. Name a new --out file. No request was sent.`); process.exit(2); }
}
if (!planning && claude) {
  const requests = Number(flag('budget', flag('max-requests', '')));
  const problems = [
    !(Number.isInteger(requests) && requests >= 1) && '--budget (the most requests in all, retries included) as a positive integer',
    !(has('max-cost') && maxCost > 0 && maxCost <= claudeOptions.totalCap) && `--max-cost (dollars) above 0 and at most the total cap ($${claudeOptions.totalCap})`,
    !ledgerFile && '--ledger (a Claude ledger of its own)',
    !outFile && '--out (a new result file)',
    usesHeldout && !has('confirm-heldout') && '--confirm-heldout: the selection includes held-out items, which must never be used to tune a prompt (aggregates only, and the look is logged)',
  ].filter(Boolean);
  const files = [ledgerFile, outFile, claudeOptions.register].filter(Boolean).map((file) => path.resolve(file));
  if (new Set(files).size !== files.length) problems.push('separate files for --ledger, --out and --spend-register');
  if (problems.length) { console.error(`A paid Claude run needs ${problems.join('; ')}. No request was sent.`); process.exit(2); }
}

// ---- the guard: every provider request of this process goes through guard.fetch, checked before it is sent ----
const nativeFetch = globalThis.fetch;
// A redirect would hide extra HTTP hops from the guard's request counter. Refuse it locally instead of silently following it.
const realFetch = (url, init) => nativeFetch(url, { ...init, redirect: 'error' });
globalThis.fetch = () => { throw new Error('Blocked: every request of the evaluation goes through the guarded transport'); };
let guard, register = null;
if (!planning) {
  try {
    if (claude) {
      // Stage S7: the spend register first (its lock lets one Claude evaluation spend at a time; released however the process ends), then the guard,
      // which records every charge of its ledger in it and refuses a request that would take every Claude ledger together past the total cap.
      for (const file of [claudeOptions.register, ledgerFile, outFile]) fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
      register = openSpendRegister(claudeOptions.register, { cap: claudeOptions.totalCap });
      process.on('exit', () => register.release());
    }
    guard = createGuard({ fetch: realFetch, maxRequests: budget, maxCost, maxTransient, maxInvalid, warnInvalid, maxUnproductive, accounting, maxTokens: claude ? null : maxTokens, ledgerFile, previousLedger,
      secrets: [env.OPENROUTER_API_KEY, env.GEMINI_API_KEY, env.ANTHROPIC_API_KEY], log: (line) => console.log(line),
      ...(claude ? { provider: 'anthropic', model: config.model, maxOutputTokens: claudeOptions.maxOutputTokens, register } : {}) });
  } catch (error) {
    if (register) register.release();
    console.error(`${error.message} (--budget, --max-cost, --max-transient, --max-invalid, --warn-invalid, --max-unproductive, --accounting, --max-tokens, --ledger, --previous-ledger${claude ? ', --spend-register, --total-cap, --max-output-tokens' : ''})`); process.exit(2);
  }
}
// The retry policy the application uses for these stages: the bounded staged policy when any stage is on, the earlier cascade when none is.
const retryOptions = { halve: anyStage(stageFlags(env)) };

// Stage E.6: every relationship of every run, counted once however often it is asked (`${run}:${id}`: one item asked in two runs is two). Every run is
// planned before the first request, so the relationships of a run that never started count as never attempted.
const tracker = createTracker();
const batchReviews = [];
const keyOf = (runNumber, id) => `${runNumber}:${id}`;
// Stage E.7: what each answer said, kept in the result so its evidence can be read afterwards: a verified answer's quotes, how they matched the
// texts, its explanation, its recommendation and the draft the author would be offered (with the static draft review, when it held the draft back),
// and its fields; for a relationship that never verified, why each attempt was refused (the refused quotes included).
const unverifiedAnswerOf = (j) => ({ label: null, unverified: true, failureCodes: j.failureCodes || [], attempts: j.attempts ?? null, stoppedBecause: j.stoppedBecause || null, refusals: j.refusals || [] });
async function oneRun(runNumber) {
  const labels = new Map(), aspects = new Map(), answers = new Map();
  // invalidAnswers: answers that failed validation in whole or in part (retries included; called firstAttemptInvalid before Stage E.6, although it
  // counted every attempt). finalUnverified: relationships whose asking ended without a verified answer.
  const stats = { batches: 0, requests: 0, invalidAnswers: 0, finalUnverified: 0, providerErrors: 0, notSent: 0 };
  const failures = [];
  const size = g.batchSizeOf(config.model, env);
  const key = (id) => keyOf(runNumber, id);
  const modelRequests = () => guard.httpLog.filter((e) => e.kind === 'model').length, sentBefore = modelRequests();
  for (const course of Object.keys(dataset.courses)) {
    const mine = items.filter((item) => item.course === course);
    for (let i = 0; i < mine.length && !guard.stopped(); i += size) {
      const batch = mine.slice(i, i + size), batchStart = modelRequests();
      // A verified judgement is kept as soon as it arrives (also from an answer that was partly refused), so a stop in the middle of a batch
      // loses only what was never verified.
      const keep = (j) => { labels.set(j.id, j.label); aspects.set(j.id, { type: j.type, label: j.label, aspects: j.aspects || null }); answers.set(j.id, answerOf(j)); };
      const request = async (b, o) => {
        const keys = b.map((p) => key(p.id));
        try {
          const judged = await providerRequest(b, { ...o, env, course: dataset.courses[course], transport: guard.fetch });
          judged.forEach(keep);
          tracker.sent({ keys, answered: true, verified: judged.map((j) => key(j.id)) }); guard.noteAnswer({ verified: judged.length });
          return judged;
        } catch (error) {
          if (error.unverified) {
            (error.salvaged || []).forEach(keep);
            stats.invalidAnswers += 1;
            failures.push({ course, ids: b.map((p) => p.id), error: guard.redact(error.message).slice(0, 160), code: error.code || null, rejected: error.rejected || [] });
            tracker.sent({ keys, answered: true, verified: (error.salvaged || []).map((j) => key(j.id)) });
            guard.noteAnswer({ verified: (error.salvaged || []).length, invalid: `${error.code || 'invalid_answer'}: ${error.message}` });
          } else if (!error.refused) tracker.sent({ keys, answered: false }); // sent, and no answer came back
          throw error;
        }
      };
      try {
        for (const j of await g.judgeBatch(request, batch.map(pairOf), retryOptions)) {
          tracker.settle(key(j.id), j);
          if (j.unverified) { stats.finalUnverified += 1; labels.set(j.id, null); answers.set(j.id, unverifiedAnswerOf(j)); } else keep(j);
        }
      } catch (error) {
        if (!error.refused) stats.providerErrors += 1; // a refusal is the guard's stop, not the provider's error
        failures.push({ course, ids: batch.map((x) => x.id), error: guard.redact(error.message).slice(0, 160), rejected: [] });
        console.error(`  ${course} batch ${i / size + 1}: ${guard.redact(error.message).slice(0, 110)}`);
      }
      if (modelRequests() > batchStart) stats.batches += 1; else stats.notSent += 1; // a batch counts once a request for it was sent
      // Stage E.6: between batches, the academic stop on the final unresolved rate of the distinct relationships attempted so far.
      const academic = academicStopOf(tracker.metrics(), { maxUnresolved, minSample });
      if (academic) guard.stop(`academic stop: ${academic}`);
      if (has('review-between-batches') && !guard.stopped() && modelRequests() > batchStart) {
        const snapshot = { status: 'paused_for_academic_batch_review', dataset: datasetInfo, configuration, promptVersion,
          ids: batch.map(p => p.id), answers: Object.fromEntries(answers), relationshipMetrics: tracker.metrics(), usage: guard.summary(), ...(guard.state.prices ? { prices: guard.state.prices } : {}), batchReviews };
        const progress = flag('out', '');
        if (progress) fs.writeFileSync(progress + '.progress.json', guard.redact(JSON.stringify(snapshot, null, 2)));
        console.log('\nBATCH ACADEMIC REVIEW\n' + guard.redact(JSON.stringify({ ids: snapshot.ids, answers: Object.fromEntries(snapshot.ids.map(id => [id, answers.get(id) || null])) }, null, 2)));
        const decision = await reviewBatch();
        batchReviews.push({ ids: snapshot.ids, proceed: decision.proceed, reason: decision.reason ? guard.redact(decision.reason).slice(0, 500) : null });
        if (!decision.proceed) guard.stop(`academic operator stop: ${guard.redact(decision.reason).slice(0, 500)}`);
      }
    }
    if (guard.stopped()) break;
  }
  stats.requests = modelRequests() - sentBefore; // provider requests actually sent, retries included
  return { labels, aspects, answers, stats, failures };
}

(async () => {
  if (planning) { await printClaudePlan(); process.exit(0); }
  if (usesHeldout && !reveal) console.log('Held-out split: aggregates only (items are not shown). Do not tune a prompt on these numbers.\n');
  if ((dataset.reviewStatus || 'unreviewed') !== 'faculty-reviewed') console.log('*** UNREVIEWED BASELINE: the expected verdicts have not been validated by faculty, so this is not a measure of agreement with faculty. ***');
  console.log(`Dataset ${dataset.version} (${datasetName}, split ${split}); ${items.length} items; ${runsWanted} run(s)`);
  console.log(`Model ${config.provider}/${config.model}; prompt ${promptVersion}; retry policy ${retryOptions.halve ? 'staged (a stage is on)' : 'legacy (no stage on)'}`);
  console.log(describeMode(modeOf(stageFlags(env))));
  if (selectedIds) console.log(`Selected unchanged IDs (${items.length} of ${dataset.items.length}): ${items.map(item => item.id).join(', ')}`);
  console.log(`Evaluation configuration: ${JSON.stringify(configuration)}`);
  console.log(`Limits: ${budget} provider requests (the ledger already holds ${guard.ledger.requests}), $${maxCost} (already charged $${guard.summary().charged}; accounting ${accounting}), ${maxTransient} rate limits/timeouts/server errors, ${maxUnproductive} answers in a row that verify nothing; academic stop when the final unresolved rate exceeds ${maxUnresolved} once ${minSample} relationships were attempted; invalid answers warn at ${warnInvalid}${maxInvalid === Infinity ? '' : ` and stop at ${maxInvalid}`}${!claude && maxTokens ? `; max_tokens ${maxTokens}` : ''}${claude ? `; total cap $${register.cap} over every Claude ledger of the spend register ($${register.total()} charged before this run); output tokens ${claudeOptions.maxOutputTokens ?? 'not capped'}` : ''}`);
  if (claude) console.log(`Claude settings: thinking ${claudeOptions.thinking} (${JSON.stringify(claudeRequest.thinking)}), effort ${claudeRequest.effort}, max_tokens ${claudeOptions.maxTokens}, timeout ${claudeOptions.timeoutSec} s, adapter retries ${claudeOptions.maxRetries}, prompt cache on. EVALUATION ONLY: never a verified check, an official score or a submission gate`);
  console.log(`Schema: ${g.minItemsOn(env, config.model) ? 'judgements list with minItems 1 (--min-items; the answers are still checked id by id)' : 'judgements list as before (no minItems)'}`);
  const loaded = loadedDataModules();
  if (loaded.length) { console.error(`Refusing to run: modules that reach application data are loaded: ${loaded.join(', ')}`); process.exit(1); }
  let keyCheck = null;
  if (has('check-key')) {
    try {
      keyCheck = await guard.checkKey(env.OPENROUTER_API_KEY);
      console.log(`Key check: HTTP ${keyCheck.status}${keyCheck.ok ? ` (accepted; free tier ${keyCheck.freeTier}; credit limit ${keyCheck.limit ?? 'none'}${keyCheck.limitRemaining === null ? '' : `, $${keyCheck.limitRemaining} remaining`}${keyCheck.expiresAt ? `; expires ${keyCheck.expiresAt}` : ''})` : ''}`);
      if (!keyCheck.ok) guard.stop(`the key check failed (HTTP ${keyCheck.status})`);
      else if (keyCheck.limitRemaining !== null && keyCheck.limitRemaining < maxCost) guard.warn(`the key's remaining credit limit ($${keyCheck.limitRemaining}) is below --max-cost ($${maxCost}): a request may be refused with HTTP 402, which stops the run`);
    } catch (error) { guard.stop(`the key check failed (${guard.redact(error.message).slice(0, 120)})`); }
  }
  if (claude) {
    // Stage S7: Anthropic publishes no prices to look up; the guard charges the pinned ones, shown here before the first request. A first Ctrl+C stops
    // sending and lets the request in flight settle (its charge reaches the ledger and the spend register); a second quits at once.
    console.log(`${describeClaudePrices(claudePriceTable(guard.state.prices))}\n`);
    let interrupted = false;
    process.on('SIGINT', () => { if (interrupted) process.exit(130); interrupted = true; guard.stop('interrupted by the operator (Ctrl+C): nothing more is sent; the request in flight settles, and a second Ctrl+C quits at once'); });
  } else try {
    const p = await guard.readPrices(config.model, env.OPENROUTER_API_KEY), perM = (v) => '$' + Math.round(v * 1e14) / 1e8 + '/M';
    console.log(`Prices now (highest of ${p.endpoints.length} endpoint(s), ${p.endpoints.filter((e) => e.structuredOutputs).length} with structured outputs: ${p.endpoints.filter((e) => e.structuredOutputs).map((e) => e.provider).join(', ') || 'none'}): input ${perM(Math.max(p.prompt, p.cacheWrite))}, output ${perM(Math.max(p.completion, p.reasoning))}, per request $${p.request}\n`);
  } catch (error) { guard.stop(`the price lookup failed (${guard.redact(error.message).slice(0, 120)}), so the cost ceiling cannot be enforced`); }
  for (let n = 1; n <= runsWanted; n += 1) tracker.plan(items.map((item) => keyOf(n, item.id)));
  const aspectRuns = [], answerRuns = [], runs = [], totals = { batches: 0, requests: 0, invalidAnswers: 0, finalUnverified: 0, providerErrors: 0, notSent: 0 }, failures = [];
  for (let n = 1; n <= runsWanted && !guard.stopped(); n += 1) {
    console.log(`run ${n}...`);
    const r = await oneRun(n);
    runs.push(r.labels); aspectRuns.push(r.aspects); answerRuns.push(r.answers);
    for (const k of Object.keys(totals)) totals[k] += r.stats[k];
    failures.push(...r.failures.map((f) => ({ run: n, ...f })));
  }
  // Stage E.6: what the evaluation completed, by distinct relationship, and whether it is usable for agreement.
  const relationshipMetrics = tracker.metrics(), completion = completionOf(relationshipMetrics, { maxUnresolved, stopped: guard.stopped() });
  const schema = { minItems: g.minItemsOn(env, config.model), emptyAnswers: failures.filter((f) => f.code === 'empty_answer').length };
  schema.minItemsNotEnforced = schema.minItems && schema.emptyAnswers > 0;
  const out = flag('out', '');
  // Stage S7: a Claude result says it is evaluation only, names the models that answered exactly as Anthropic did, and carries what the adapter itself
  // counted next to the guard's accounting.
  const claudeMarks = () => (claude ? { provider: 'anthropic', evaluationOnly: true, modelsReturned: guard.summary().anthropic.modelsReturned, adapterUsage: adapterUsage.total } : {});
  if (!runs.length) { // stopped before the first question: nothing to score, but the reason, the usage and the plan never attempted are kept
    const stoppedResult = { stopped: guard.stopped(), ...claudeMarks(), usage: guard.summary(), ...(keyCheck ? { keyCheck } : {}), ...(guard.state.prices ? { prices: guard.state.prices } : {}), relationshipMetrics, completion, dataset: datasetInfo, configuration,
      isolation: { dataModulesLoaded: loadedDataModules() }, model: `${config.provider}/${config.model}`, promptVersion, ranAt: new Date().toISOString() };
    console.log(`STOPPED before the first run: ${stoppedResult.stopped}`);
    if (out) { fs.writeFileSync(out, guard.redact(JSON.stringify(stoppedResult, null, 2))); console.log(`wrote ${out}`); }
    return;
  }
  // A relationship a run never sent (it stopped first) is left out of the score: it was not evaluated (Stage E.6). One sent and never verified is
  // an invalid answer, as before.
  const m = scoreEval(items, runs, { disciplineOf, attempted: (r, id) => tracker.attempted(keyOf(r + 1, id)) });
  // The structured fields (Stages C and D): how often they were answered, valid, consistent with the label, and equal to the provisional expectation.
  // Per field, its state in each answer (aspects.js coverageOf): only an assessed field is compared with the expectation, so a field the model did not
  // assess, left out, answered outside its enum or in a self-contradictory answer is never agreement and never disagreement (Stage E.6).
  const fields = { answers: 0, withFields: 0, missing: 0, malformed: 0, contradictory: 0, notAssessed: 0 }, perField = {};
  items.forEach((item) => aspectRuns.forEach((run) => {
    const got = run.get(item.id);
    if (!got || !ASPECT_TYPES.has(item.type) || got.label === 'INSUFFICIENT_EVIDENCE') return;
    fields.answers += 1;
    const j = { type: item.type, label: got.label, aspects: got.aspects }, read = readAspects(j), cov = coverageOf(j);
    if (!cov) { fields.missing += 1; return; } // an answer without any field record
    for (const [key, state] of Object.entries(cov.fields)) (perField[key] ||= { assessed: 0, not_assessed: 0, missing: 0, malformed: 0, contradicted: 0, compared: 0, agree: 0 })[state] += 1;
    for (const [key, want] of Object.entries(item.excludeFromAgreement ? {} : item.expectedAspects || {})) {
      if (cov.fields[key] !== 'assessed') continue;
      const cell = perField[key], acceptable = Array.isArray(want) ? want : [want];
      cell.compared += 1; if (acceptable.includes(read.values[key])) cell.agree += 1;
    }
    fields.withFields += 1;
    if (read.missing.length) fields.missing += 1;
    if (read.invalid.length) fields.malformed += 1;
    if (read.contradictions.length) fields.contradictory += 1;
    if (Object.values(cov.fields).includes('not_assessed')) fields.notAssessed += 1;
  }));
  m.structuredFields = { ...fields, perField, note: 'Expectations are provisional. Only an assessed field is compared with them: a field that was not assessed, missing, malformed or in a self-contradictory answer is counted by its state, never as agreement. INSUFFICIENT_EVIDENCE answers are left out.' };
  // P2: the quality measures beside the agreement, for the mode the run used (eval/qualityMetrics.js), from the recorded answers and every refused
  // judgement; held-out items keep their counts only.
  const quality = qualityOf(items, answerRuns, { flags: stageFlags(env), attempted: (r, id) => tracker.attempted(keyOf(r + 1, id)), refused: failures.flatMap((f) => f.rejected || []), usage: guard.summary(), withIds: !usesHeldout || reveal });
  const result = {
    ...m, model: `${config.provider}/${config.model}`, promptVersion, ...claudeMarks(),
    dataset: datasetInfo, configuration, ...(has('review-between-batches') ? { batchReviews } : {}),
    // invalidAnswerRate: answers that failed validation in whole or in part, per request sent (retries included). Results written before Stage E.6
    // called these firstAttemptInvalid and firstAttemptInvalidRate; the first-attempt rate of distinct relationships is relationshipMetrics.firstAttempt.
    retries: { ...totals, retryRate: totals.batches ? Math.round(((totals.requests - totals.batches) / totals.batches) * 1000) / 1000 : null, invalidAnswerRate: totals.requests ? Math.round((totals.invalidAnswers / totals.requests) * 1000) / 1000 : null },
    relationshipMetrics, completion, schema, answerReview: summarizeReviews(answerRuns), quality,
    limits: { budget, maxCost, maxTransient, maxUnproductive, maxUnresolved, minSample, warnInvalid, maxInvalid: maxInvalid === Infinity ? null : maxInvalid, accounting, maxTokens: claude ? claudeOptions.maxTokens : maxTokens || 'production (8192)',
      ...(claude ? { totalCap: register.cap, spendRegister: path.relative(process.cwd(), path.resolve(claudeOptions.register)), maxOutputTokens: claudeOptions.maxOutputTokens } : {}) },
    failures, perItem: Object.fromEntries(items.map((item) => [item.id, runs.map((run, r) => (tracker.attempted(keyOf(r + 1, item.id)) ? run.get(item.id) || null : 'not_attempted'))])), ranAt: new Date().toISOString(),
    answers: answerRuns.map((run) => Object.fromEntries(run)),
  };
  const pct = (v) => (v === null || v === undefined ? 'n/a' : (v * 100).toFixed(1) + '%');
  console.log(`\nanswered ${m.answered}; never verified ${m.invalid} (${pct(m.invalidRate)}); never attempted ${m.notAttempted}; provider errors ${totals.providerErrors}; batches not sent after a stop ${totals.notSent}`);
  console.log(`requests ${totals.requests} for ${totals.batches} batches => retry rate ${pct(result.retries.retryRate)}; answers that failed validation in whole or part ${totals.invalidAnswers} (${pct(result.retries.invalidAnswerRate)} of requests)`);
  console.log(describeMetrics(relationshipMetrics));
  console.log(`completion: ${completion.state} (${completion.reason}); usable for agreement: ${completion.usableForAgreement ? 'yes' : 'no'}`);
  if (m.excludedFromAgreement?.length) console.log(`Agreement scope: ${m.scoredItems} items eligible for agreement of ${m.datasetItems} dataset items; pending diagnostics excluded: ${m.excludedFromAgreement.map(item => item.id).join(', ')}`);
  console.log(`Advisory answer review: ${result.answerReview.flaggedAnswers.length} flagged answer(s); explanation ${JSON.stringify(result.answerReview.counts.explanationReview)}; withheld draft ${JSON.stringify(result.answerReview.counts.draftReview)}; draft cautions ${JSON.stringify(result.answerReview.counts.draftWarnings)} (heuristic warnings, not verified academic errors)`);
  if (schema.minItems) console.log(`schema: minItems 1 sent; empty answers ${schema.emptyAnswers}${schema.minItemsNotEnforced ? ' (minItems was NOT enforced by the provider)' : ''}`);
  if (m.structuredFields.answers) {
    const f = m.structuredFields;
    console.log(`structured fields (Stage C/D answers ${f.answers}): answered ${f.withFields}, missing ${f.missing}, malformed ${f.malformed}, contradictory ${f.contradictory}, with a field not assessed ${f.notAssessed}`);
    for (const [key, c] of Object.entries(f.perField)) console.log(`  ${key.padEnd(15)} agree ${c.agree}/${c.compared}; assessed ${c.assessed}, not assessed ${c.not_assessed}, missing ${c.missing}, malformed ${c.malformed}, contradicted ${c.contradicted}`);
  }
  console.log(`agreement with accepted verdicts                     ${pct(m.agreement)}`);
  console.log(`false approvals  (clear not-aligned judged ALIGNED)  ${pct(m.falseNegativeRate)}  [${m.counts.falseNegative}/${m.counts.clearNot}]`);
  console.log(`false rejections (clear ALIGNED judged otherwise)    ${pct(m.falsePositiveRate)}  [${m.counts.falsePositive}/${m.counts.clearAligned}]`);
  console.log(`partial-alignment accuracy                           ${pct(m.partialAccuracy)}`);
  console.log(`repeatability across runs                            ${pct(m.stability)}`);
  console.log(`${describeQuality(quality).join('\n')}\n`);
  const table = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, { items: v.items, answered: v.answered, agreement: pct(v.agreement), invalid: v.invalid }]));
  console.log('by relationship type'); console.table(table(m.byType));
  console.log('by discipline'); console.table(table(m.byDiscipline));
  console.log('expected -> judged (answers)'); console.table(m.confusion);
  if (!usesHeldout || reveal) {
    console.log('by category'); console.table(table(m.byCategory));
    if (m.disagreements.length) {
      console.log('\nDisagreements:');
      for (const d of m.disagreements) console.log(`  ${d.id.padEnd(34)} accepted ${d.accept.map((a) => a[0]).join('/')}  got ${d.got.map((l) => (l ? l[0] : '-')).join(',')}`);
    }
  } else { delete result.perItem; delete result.disagreements; delete result.byCategory; delete result.failures; delete result.answers; delete result.answerReview.flaggedAnswers; }
  if (usesHeldout) {
    // Every look at the held-out set is recorded, so how often it was used to make a decision can be checked. Claude's looks go to a log of their own
    // (Stage S7), with the provider and the configuration, so the OpenRouter log keeps only its own history.
    const log = claude ? path.resolve(claudeOptions.heldoutLog) : HELDOUT_LOG;
    if (claude) fs.mkdirSync(path.dirname(log), { recursive: true });
    fs.appendFileSync(log, JSON.stringify({ at: result.ranAt, dataset: `${datasetName}@${dataset.version}`, split, model: result.model, promptVersion, mode: quality.mode.id, ...(claude ? { provider: 'anthropic', evaluationOnly: true, anthropic: configuration.anthropic } : {}), runs: runsWanted, runsCompleted: runs.length, items: items.length, agreement: m.agreement, falseApprovalRate: m.falseNegativeRate, falseRejectionRate: m.falsePositiveRate, partialAccuracy: m.partialAccuracy, invalidRate: m.invalidRate, stability: m.stability, finalUnresolvedRate: relationshipMetrics.unresolvedRate, coverage: relationshipMetrics.coverage, completion: completion.state, revealed: reveal, stopped: guard.stopped() }) + '\n');
    console.log(`\nlogged to ${path.relative(process.cwd(), log)}`);
  }
  result.usage = guard.summary();
  if (keyCheck) result.keyCheck = keyCheck;
  if (guard.state.prices) result.prices = guard.state.prices;
  // Stage E.7: every model request as the guard saw it, with the model's own answer text (redacted like every text the guard keeps). Held-out
  // items stay hidden unless --reveal.
  // A Claude request also keeps its request id (Anthropic's support needs it), the model that answered, how its answer ended, how many thinking blocks it
  // had (never their text), its error type and its worst case.
  const claudeRequestOf = (e) => (claude ? { requestId: e.requestId ?? null, modelReturned: e.modelReturned ?? null, stopReason: e.stopReason ?? null, ...(e.stopReason === 'refusal' ? { stopCategory: e.stopCategory ?? null } : {}), thinkingBlocks: e.thinkingBlocks ?? null, errorType: e.errorType ?? null, worst: e.worst ?? null } : {});
  if (!usesHeldout || reveal) result.requests = guard.httpLog.filter((e) => e.kind === 'model').map((e) => ({ n: e.n, ids: e.ids || [], status: e.status ?? null, ms: e.ms ?? null, provider: e.provider || null, finishReason: e.finishReason ?? null, ...claudeRequestOf(e), usage: e.usage || null, accounting: e.accounting || null, charged: e.charged ?? null, conservativeCharge: e.conservativeCharge ?? null, error: e.error || null, content: typeof e.content === 'string' ? guard.redact(e.content) : null }));
  result.stopped = guard.stopped();
  result.isolation = { dataModulesLoaded: loadedDataModules(), processEnvStageFlags: Object.keys(process.env).filter((k) => /^SYLLABUS_CHECK_STAGE_/.test(k)) };
  const u = result.usage;
  console.log(`provider usage: ${u.requests} request(s) in all (cap ${budget}; this run ${u.model} to the model, ${u.priceLookups} price lookup${u.keyChecks ? `, ${u.keyChecks} key check` : ''}); prompt tokens ${u.promptTokens} (cached ${u.cachedTokens}), completion tokens ${u.completionTokens}; ${claude ? '' : `reported cost $${u.reportedCost}; `}charged against the cap $${u.charged} of $${maxCost} (accounting ${u.accounting.rule}: ${Object.entries(u.accounting.requests).map(([rule, n]) => `${n} ${rule.replace('_', ' ')}`).join(', ')}; the conservative rule would have charged $${u.accounting.chargedConservatively})`);
  if (claude) {
    const a = adapterUsage.total;
    console.log(describeClaudeUsage(u.anthropic));
    console.log(`Adapter count: ${a.requests} question(s), ${a.attempts} attempt(s), ${a.timedOut} timed out; thinking reported ${JSON.stringify(a.thinkingReports)}; estimated $${a.estimatedUsd} at the published prices (x1.1 only for an answer that reports inference_geo "us"); enum values differing only in capitalisation ${a.enumCaseOnly}`);
  }
  for (const warning of u.warnings) console.log(`WARNING: ${warning}`);
  if (result.stopped) console.log(`STOPPED: ${result.stopped}. The numbers above cover only the relationships attempted; ${relationshipMetrics.neverAttempted} planned relationship(s) were never attempted and are not evaluated.`);
  if (out) { fs.writeFileSync(out, guard.redact(JSON.stringify(result, null, 2))); console.log(`wrote ${out}`); }
})().catch((error) => { // the Claude plan has no guard: its error is redacted with the same keys
  const keys = [env.ANTHROPIC_API_KEY, env.OPENROUTER_API_KEY, env.GEMINI_API_KEY].filter((key) => typeof key === 'string' && key.trim().length >= 8);
  const text = String(error && error.stack || error);
  console.error(guard ? guard.redact(text) : keys.reduce((out, key) => out.split(key).join('[redacted]'), text)); process.exit(1);
});
