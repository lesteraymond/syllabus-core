#!/usr/bin/env node
'use strict';
// Stage E.4: how many provider requests and tokens an all-stages check takes BEFORE and AFTER the E.4 changes. Before: batches of 12 relationships and
// the earlier retry cascade (keep what verified, ask the rest again, halve, then three tries per single relationship). After: batches of STAGED_BATCH (4)
// and the bounded retry policy (judgeStaged). A check with every stage off is unchanged and is measured for reference.
//
//   node scripts/measure-request-volume.cjs [--seeds 10] [--out docs/stage-e4-request-volume.json]
//
// Offline and read-only: a scripted model answers, the global fetch throws, no key is read (a placeholder is used), no database module is loaded,
// and only --out is written. What is exact and what is estimated:
//   - requests and request bytes are exact for these scripted runs: the real request bodies are built by gemini.js and measured;
//   - input tokens = request bytes / 4.85 (Stage E.3 run 2: 253,283 request bytes were billed as 52,253 prompt tokens, 4.84-4.85 in all 8 requests);
//   - output tokens = 218 per relationship answered (run 2: 4,581 completion tokens for 21 answers);
//   - the failure rates of the simulated scenarios are ASSUMPTIONS, stated with each scenario. Run 2 observed 7 empty explanations in one batch of 8,
//     none in 13 answers given in batches of 1-4, and 3 quote errors in those 13 (on two hard items); the rates below are set from that, not measured.
//   - costs use the endpoint prices recorded in run 2 (docs/ai-eval-stage-e3-smoke-run2.json), with no prompt caching (run 2 had 74% of its input
//     tokens cached, so a real check is usually cheaper than the "typical" figure).
const fs = require('node:fs');
const path = require('node:path');
globalThis.fetch = () => { throw Error('measure-request-volume is offline: no network request is allowed'); };
const repo = path.join(__dirname, '..'), lib = path.join(repo, 'server/lib/syllabuscheck');
const g = require(path.join(lib, 'gemini.js'));
const { stageFlags, recommendOn } = require(path.join(lib, 'stages.js'));
const { run } = require(path.join(lib, 'engine.js'));
const { sample } = require(path.join(lib, 'fixtures.js'));
const { programSyllabus, PROGRAMS } = require(path.join(lib, 'eval/programSyllabi.js'));
const { loadReal, COURSES } = require(path.join(lib, 'eval/realSyllabi.js'));

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const SEEDS = Math.max(1, Number(flag('seeds', 10)) || 10), OUT = flag('out', null);
const BYTES_PER_TOKEN = 4.85, OUTPUT_PER_ANSWER = 218, BEFORE_BATCH = 12;
const STAGES = ['A', 'B', 'B3', 'B4', 'C1', 'C2', 'D1', 'D2'];
const MODEL = 'minimax/minimax-m3.1-flash';
const KEY = { SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'measure-only-not-a-key', OPENROUTER_MODEL: MODEL, SYLLABUS_CHECK_VALUES_FILE: path.join(repo, 'server/config/marian-values.json'), SYLLABUS_CHECK_AI_COOLDOWN_SEC: '0' };
const ALL = { ...KEY, ...Object.fromEntries(STAGES.map(k => ['SYLLABUS_CHECK_STAGE_' + k, 'on'])) };
const CONFIGS = { legacy: { ...KEY }, before: { ...ALL, SYLLABUS_CHECK_AI_BATCH: String(BEFORE_BATCH) }, after: { ...ALL } };

// Prices: the structured-output endpoints recorded in run 2 (typical = median, worst = highest); fixed fallbacks when the record is absent.
const prices = (() => {
  try {
    const list = require(path.join(repo, 'docs/ai-eval-stage-e3-smoke-run2.json')).prices.endpoints.filter(e => e.structuredOutputs);
    const median = values => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];
    return { source: 'run 2 price lookup (structured-output endpoints)', typical: { in: median(list.map(e => e.prompt)), out: median(list.map(e => e.completion)) }, worst: { in: Math.max(...list.map(e => e.prompt)), out: Math.max(...list.map(e => e.completion)) } };
  } catch { return { source: 'fallback constants', typical: { in: 1.5e-7, out: 6e-7 }, worst: { in: 3e-7, out: 1.2e-6 } }; }
})();
const usage = ({ requests, bytes, answered }) => {
  const input = Math.round(bytes / BYTES_PER_TOKEN), output = answered * OUTPUT_PER_ANSWER;
  return { requests, requestBytes: bytes, inputTokens: input, outputTokens: output, costTypical: +(input * prices.typical.in + output * prices.typical.out).toFixed(4), costWorst: +(input * prices.worst.in + output * prices.worst.out).toFixed(4) };
};

// ---- the scripted model ----
const GOOD = { 'Activity-fit': { teaching: 'sound', learnerSupport: 'adequate' }, 'Assessment-fit': { measures: 'yes', evidence: 'observable', level: 'matches' }, 'Value-use': { valueUse: 'integrated', carriedBy: 'activity', valueFit: 'fits' }, 'Ref-relevance': { relevance: 'relevant', basis: 'title_and_venue' }, 'Value-map': { coreValue: 'Community-orientedness', integration: 'demonstrated' } };
function answerOf(pair, env, { label = 'ALIGNED', recommendation } = {}) {
  const flags = stageFlags(env), empty = !pair.source.trim() || !pair.target.trim();
  const final = empty ? 'INSUFFICIENT_EVIDENCE' : label;
  return { id: pair.id, label: final, explanation: 'Scripted answer for the measurement.', sourceQuote: empty ? '' : pair.source.slice(0, 14), targetQuote: empty ? '' : pair.target.slice(0, 14), sourceBloom: 'N/A', targetBloom: 'N/A', draft: '',
    ...Object.fromEntries(g.aspectKeysFor(flags).map(k => [k, 'not_assessed'])), ...(final === 'ALIGNED' ? GOOD[pair.type] || {} : {}),
    ...(recommendOn(flags) && recommendation !== null ? { recommendation: recommendation || (final === 'ALIGNED' ? 'NO_CHANGE' : 'REVIEW_REQUIRED') } : {}) };
}
const reply = (model, judgements) => ({ ok: true, json: async () => ({ model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ judgements }) } }] }) });
// `broken()` true: the reply is not valid JSON, so it names no relationship (counted as answered: its output tokens are estimated like any other)
function scripted(answer, broken = () => false) {
  const tally = { requests: 0, bytes: 0, answered: 0 };
  const transport = async (url, init) => {
    tally.requests += 1; tally.bytes += Buffer.byteLength(init.body);
    const body = JSON.parse(init.body), batch = JSON.parse(body.messages[1].content).document_data;
    tally.answered += batch.length;
    if (broken()) return { ok: true, json: async () => ({ model: body.model, choices: [{ finish_reason: 'stop', message: { content: '{"judgements": [' } }] }) };
    return reply(body.model, batch.map(pair => answer(pair, batch)));
  };
  return { tally, transport };
}

// ---- Part 1: a whole check (every pass the engine makes), every answer valid ----
async function wholeCheck(content, masters, env) {
  g.resetProviderBlock();
  const { tally, transport } = scripted(pair => answerOf(pair, env));
  const result = await run(structuredClone(content), masters, { useAi: true, env, transport, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }) });
  const judgements = result.hybrid.alignment.judgements || [];
  return { ...usage(tally), relationships: judgements.length, verified: judgements.filter(j => !j.unverified).length, status: result.hybrid.alignment.status };
}

// ---- Part 2: the retry policies under failing answers (the main pass of the check) ----
// The retry cascade as it was before Stage E.4 (gemini.js judgeBatch with options.halve), kept here verbatim for the comparison only.
async function judgeBefore(request, batch, options) {
  try { return await request(batch, options); } catch (error) {
    if (!error.unverified) throw error;
    const kept = error.salvaged || [];
    if (kept.length && kept.length < batch.length) {
      const have = new Set(kept.map(j => j.id));
      return [...kept, ...await judgeBefore(request, batch.filter(pair => !have.has(pair.id)), options)];
    }
  }
  if (options.halve && batch.length > 2) {
    const middle = Math.ceil(batch.length / 2);
    return [...await judgeBefore(request, batch.slice(0, middle), options), ...await judgeBefore(request, batch.slice(middle), options)];
  }
  if (batch.length > 1) {
    const judged = [];
    for (const pair of batch) judged.push(...await judgeBefore(request, [pair], options));
    return judged;
  }
  for (let attempt = 0; attempt < 2; attempt++) { try { return await request(batch, options); } catch (error) { if (!error.unverified) throw error; } }
  return [{ id: batch[0].id, unverified: true }];
}
const mulberry32 = seed => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// pEmpty(n): chance that an answer in a batch of n relationships comes back with an empty explanation; pQuote: chance of swapped quotes;
// tagErrors: relationships whose text is sound and only the tag is wrong (2 CLO-PO and 2 ILO-CLO); retag: how the model answers those AFTER E.4.
// BEFORE E.4 the model left their draft empty against the old instruction (5 of 5 in run 2), which the old contract refused every time.
const SCENARIOS = {
  clean: { note: 'every answer valid', pEmpty: () => 0, pQuote: 0, tagErrors: false },
  'run-2 like': { note: 'empty explanations in 85% of answers in batches of 8 or more (run 2: 7 of 8), none below 8; 5% swapped quotes; 4 tag-only errors answered as re-tags', pEmpty: n => (n >= 8 ? 0.85 : 0), pQuote: 0.05, tagErrors: true, retag: 'RETAG_OUTCOME' },
  'pessimistic small batches': { note: 'as run-2 like, plus 25% empty explanations in batches of 4-7 and 15% swapped quotes', pEmpty: n => (n >= 8 ? 0.85 : n >= 4 ? 0.25 : 0), pQuote: 0.15, tagErrors: true, retag: 'RETAG_OUTCOME' },
  'model ignores the re-tag contract': { note: 'as run-2 like, but the 4 tag-only errors come back as REWRITE_TEXT with no draft, a contract error every time', pEmpty: n => (n >= 8 ? 0.85 : 0), pQuote: 0.05, tagErrors: true, retag: 'REWRITE_TEXT' },
  'unreadable replies': { note: 'as run-2 like, plus 10% of replies (any batch size) that are not valid JSON, so the reply names no relationship (not observed in run 2)', pEmpty: n => (n >= 8 ? 0.85 : 0), pQuote: 0.05, tagErrors: true, retag: 'RETAG_OUTCOME', pBroken: 0.1 },
};
function tagErrorIds(pairs) {
  const pick = type => pairs.filter(p => p.type === type && p.source.trim() && p.target.trim()).slice(0, 2).map(p => p.id);
  return new Set([...pick('CLO-PO'), ...pick('ILO-CLO')]);
}
async function policyRun(pairs, course, policy, scenario, seed) {
  const env = CONFIGS.after, rng = mulberry32(seed), errors = scenario.tagErrors ? tagErrorIds(pairs) : new Set();
  const { tally, transport } = scripted((pair, batch) => {
    const tagError = errors.has(pair.id);
    const j = answerOf(pair, env, tagError ? { label: 'NOT_ALIGNED', recommendation: policy === 'before' ? null : scenario.retag } : {});
    if (rng() < scenario.pEmpty(batch.length)) j.explanation = '';
    if (j.sourceQuote && rng() < scenario.pQuote) [j.sourceQuote, j.targetQuote] = [j.targetQuote, j.sourceQuote];
    return j;
  }, () => !!scenario.pBroken && rng() < scenario.pBroken);
  const request = batch => g.requestOpenRouter(batch, { env, transport, course });
  const size = policy === 'before' ? BEFORE_BATCH : g.STAGED_BATCH, out = [];
  for (let i = 0; i < pairs.length; i += size) {
    const batch = pairs.slice(i, i + size);
    out.push(...(policy === 'before' ? await judgeBefore(request, batch, { halve: true }) : await g.judgeBatch(request, batch, { halve: true })));
  }
  return { ...usage(tally), relationships: pairs.length, verified: out.filter(j => !j.unverified).length, notVerified: out.filter(j => j.unverified).length };
}
const mean = list => Object.fromEntries(Object.keys(list[0]).map(k => [k, typeof list[0][k] === 'number' ? +(list.reduce((s, x) => s + x[k], 0) / list.length).toFixed(k.startsWith('cost') ? 4 : 1) : list[0][k]]));

(async () => {
  const syllabi = [{ key: 'sample', label: 'Test fixture (sample)', ...sample() }, ...PROGRAMS.map(key => { const s = programSyllabus(key); return { key, label: s.label + ' (18-week representative)', content: s.content, masters: s.masters }; })];
  for (const key of Object.keys(COURSES)) { const real = await loadReal(key); if (real) syllabi.push({ key: 'real-' + key, label: COURSES[key].label + ' (real faculty PDF)', content: real.content, masters: real.masters }); }
  const record = { stage: 'E.4', generatedBy: 'node scripts/measure-request-volume.cjs', offline: true, assumptions: { bytesPerToken: BYTES_PER_TOKEN, outputTokensPerAnswer: OUTPUT_PER_ANSWER, beforeBatch: BEFORE_BATCH, afterBatch: g.STAGED_BATCH, seeds: SEEDS, prices }, wholeCheck: [], retryPolicy: [] };
  for (const s of syllabi) {
    const row = { syllabus: s.label };
    for (const [name, env] of Object.entries(CONFIGS)) row[name] = await wholeCheck(s.content, s.masters, env);
    record.wholeCheck.push(row);
  }
  for (const s of syllabi) {
    const flags = stageFlags(CONFIGS.after);
    const pairs = g.pairsOf(s.content, s.masters, [], { stageA: flags.a, stageB: flags.b, stageB4: flags.b4 });
    const course = g.courseOf(s.content);
    for (const [name, scenario] of Object.entries(SCENARIOS)) {
      const row = { syllabus: s.label, scenario: name, assumption: scenario.note };
      for (const policy of ['before', 'after']) {
        const runs = [];
        for (let seed = 1; seed <= (name === 'clean' ? 1 : SEEDS); seed++) runs.push(await policyRun(pairs, course, policy, scenario, seed));
        row[policy] = mean(runs);
      }
      record.retryPolicy.push(row);
    }
  }
  const line = (label, u) => `${label.padEnd(10)} ${String(u.requests).padStart(6)} req ${String(u.inputTokens).padStart(8)} in ${String(u.outputTokens).padStart(7)} out  $${u.costTypical.toFixed(4)} typical  $${u.costWorst.toFixed(4)} worst`;
  console.log('Whole check, every answer valid (exact requests; tokens and cost estimated)');
  for (const r of record.wholeCheck) { console.log('\n' + r.syllabus); for (const name of Object.keys(CONFIGS)) console.log('  ' + line(name, r[name]) + `  ${r[name].verified}/${r[name].relationships} verified, ${r[name].status}`); }
  console.log('\nRetry policy, main pass only, mean of ' + SEEDS + ' seeds (failure rates are assumptions)');
  for (const r of record.retryPolicy) { console.log(`\n${r.syllabus} - ${r.scenario}`); for (const p of ['before', 'after']) console.log('  ' + line(p, r[p]) + `  ${r[p].verified}/${r[p].relationships} verified`); }
  if (OUT) { fs.writeFileSync(path.resolve(OUT), JSON.stringify(record, null, 2) + '\n'); console.log('\nwrote ' + OUT); }
})().catch(error => { console.error(error); process.exit(1); });
