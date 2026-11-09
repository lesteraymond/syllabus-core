'use strict';
// OFFLINE plan for the controlled real-Claude test: exact request counts and sizes for each synthetic case, and a calibrated estimate of tokens and dollars.
// NO NETWORK: the offline guard of scripts/e2e/offline-provider.cjs is loaded first, so every Anthropic request is answered by a scripted double in this process and
// every other connection is refused. The ANTHROPIC key used here is a visibly fake stand-in.
//   node scripts/live-claude/plan.cjs            prints the plan and writes docs/checker-comprehensive/live/estimates.json
//
// How the estimate is made (all of it is stated, none of it is hidden in a constant):
//   requests     counted exactly from the real client path for each fixture; a real model answering misaligned text can ask a few more (a follow-up question for an ILO whose
//                CLO tags all failed, a corrective retry after an invalid answer), so the HIGH column adds 30 %.
//   input        request body bytes / 3.5 = tokens (a conservative English-and-JSON ratio). The system prompt is cacheable: cache reads are priced at the low rate for the share
//                of input the column assumes is cached (LOW 80 %, EXPECTED 60 %, HIGH 0 %).
//   output       relationships x tokens per relationship, MEASURED in earlier authorized runs (docs/ai-eval-anthropic ledgers): the legacy staged contract 309 tokens per
//                relationship (p2-b2, 120 relationships), the Policy V2 recommendation contract 758 (lcup-v2 r2 smoke). LOW uses 309 for legacy and 450 for V2; EXPECTED 400 and
//                758; HIGH 760 and 1,100. Thinking is billed as output and was 0 in every measured run.
//   price        anthropicClient.PRICES for claude-sonnet-5-5 ($2 in, $10 out, $0.10 cache read per million); HIGH also applies the 1.1 US-only factor.
//   NOT an upper bound of spending: the hard limits are the evaluation guard's cap, the spend register's cap and the provider-side limit (see the plan).
const fs = require('node:fs');
const path = require('node:path');
require('../e2e/offline-provider.cjs'); // fetch interception + network guard: nothing below can reach a real provider
const L = require('./lib.cjs');
const F = require('./fixtures.cjs');

const CALIBRATION = { legacyOutPerPair: { low: 309, expected: 400, high: 760 }, v2OutPerPair: { low: 450, expected: 758, high: 1100 }, charsPerToken: 3.5, cachedShare: { low: 0.8, expected: 0.6, high: 0 }, extraRequestsHigh: 0.3, secondsPerRequest: 7.3, concurrency: 3 };
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

async function planCase(which, mode = 'comprehensive') {
  const fixture = F.load(which);
  const env = L.anthropicEnv({ key: L.STAND_IN_KEY, cap: 1000, maxRequests: 500, mode });
  const { budget, log } = L.recordingBudget(env);
  const result = await L.runFixture(fixture, { env, requestBudget: budget });
  const summary = budget.summary();
  const legacyPairs = result.hybrid.alignment.judgements.length, v2Pairs = result.hybrid.academicV2.academic.relationships.length;
  const inputTokens = Math.round(log.reduce((a, r) => a + r.bytes, 0) / CALIBRATION.charsPerToken);
  const est = (col, geo = 1) => {
    const outputTokens = Math.round(legacyPairs * CALIBRATION.legacyOutPerPair[col] + v2Pairs * CALIBRATION.v2OutPerPair[col]);
    const factor = col === 'high' ? 1 + CALIBRATION.extraRequestsHigh : 1;
    const tokensIn = Math.round(inputTokens * factor), tokensOut = Math.round(outputTokens * factor);
    return { requests: Math.round(log.length * factor), inputTokens: tokensIn, outputTokens: tokensOut, dollars: round(L.dollars({ inputTokens: tokensIn, cachedShare: CALIBRATION.cachedShare[col], outputTokens: tokensOut, geo }), 3) };
  };
  const byPriority = Object.fromEntries(Object.entries(summary.byPriority || {}).map(([k, v]) => [k, v.requests]));
  return {
    case: which.toUpperCase(), mode, requests: log.length, requestsByPriority: byPriority, legacyRelationships: legacyPairs, policyV2Relationships: v2Pairs,
    requestBodyBytes: log.reduce((a, r) => a + r.bytes, 0), largestRequestBytes: Math.max(...log.map((r) => r.bytes)),
    inAppReservation: { reservedUsd: round(summary.reservedCostUsd, 2), reservedTokens: summary.reservedTokens, recommendedPerCheckCapUsd: Math.ceil(summary.reservedCostUsd * 1.25) },
    estimate: { low: est('low'), expected: est('expected'), high: est('high', L.US_FACTOR) },
    minutes: { expected: round((log.length / CALIBRATION.concurrency) * CALIBRATION.secondsPerRequest / 60, 1), high: round((log.length * 1.3 / CALIBRATION.concurrency) * CALIBRATION.secondsPerRequest / 60, 1) },
    offlineOfficial: { overall: result.overall, passed: result.passed, passThreshold: result.passThreshold, deterministicBlockingFindings: (result.findings || []).filter((f) => f.severity === 'blocking').length, v2: result.hybrid.academicV2.alignment.status },
    vpaaInstances: Object.fromEntries(result.hybrid.ruleCoverage.rules.filter((r) => r.namespace === 'vpaa_type').map((r) => [r.ruleId, r.instances.length])),
    cloClassificationPairs: result.hybrid.ruleCoverage.rules.filter((r) => /^CLO[1-4]:semantic$/.test(r.ruleId)).length,
  };
}

(async () => {
  F.write();
  const cases = [];
  for (const which of F.CASES) cases.push(await planCase(which));
  const v2only = [];
  for (const which of F.CASES) v2only.push(await planCase(which, 'v2only'));
  const register = JSON.parse(fs.readFileSync(path.join(L.ROOT, 'docs/ai-eval-anthropic/spend-register.json'), 'utf8'));
  const out = { v2only, model: L.MODEL, prices: { inputPerM: L.IN_PER_M, outputPerM: L.OUT_PER_M, cacheReadPerM: L.CACHE_READ_PER_M, usOnlyFactor: L.US_FACTOR }, calibration: CALIBRATION, cases,
    spendRegister: { capUsd: register.cap, chargedUsd: round(register.total, 4), remainingUsd: round(register.cap - register.total, 4) } };
  const total = (col) => round(cases.reduce((a, c) => a + c.estimate[col].dollars, 0), 2);
  out.allFourCases = { low: total('low'), expected: total('expected'), high: total('high') };
  const totalV2 = (col) => round(v2only.reduce((a, c) => a + c.estimate[col].dollars, 0), 2);
  out.allFourV2Only = { low: totalV2('low'), expected: totalV2('expected'), high: totalV2('high') };
  fs.mkdirSync(path.join(L.ROOT, 'docs/checker-comprehensive/live'), { recursive: true });
  fs.writeFileSync(path.join(L.ROOT, 'docs/checker-comprehensive/live/estimates.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`model ${out.model}  |  $${out.prices.inputPerM}/M in, $${out.prices.outputPerM}/M out, $${out.prices.cacheReadPerM}/M cache read (x${out.prices.usOnlyFactor} US-only, in HIGH)`);
  console.log('case | requests (scored/v2/optional) | legacy+V2 relationships | request bytes | in-app reservation | estimated $ low / expected / high | minutes');
  for (const c of cases) console.log(`${c.case}    | ${c.requests} (${c.requestsByPriority.scored}/${c.requestsByPriority.v2}/${c.requestsByPriority.optional}) | ${c.legacyRelationships}+${c.policyV2Relationships} | ${(c.requestBodyBytes / 1e6).toFixed(2)} MB | $${c.inAppReservation.reservedUsd} (cap >= $${c.inAppReservation.recommendedPerCheckCapUsd}) | $${c.estimate.low.dollars} / $${c.estimate.expected.dollars} / $${c.estimate.high.dollars} | ${c.minutes.expected}-${c.minutes.high}`);
  console.log(`all four cases: low $${out.allFourCases.low}, expected $${out.allFourCases.expected}, high $${out.allFourCases.high}   |   spend register: $${out.spendRegister.chargedUsd} of $${out.spendRegister.capUsd} used, $${out.spendRegister.remainingUsd} remaining`);
  console.log('V2-only mode (scored relationships + 7 VPAA + 4 CLO classifications, no optional stages):');
  for (const c of v2only) console.log(`${c.case}    | ${c.requests} (${c.requestsByPriority.scored}/${c.requestsByPriority.v2}/${c.requestsByPriority.optional || 0}) | ${c.legacyRelationships}+${c.policyV2Relationships} | in-app reservation $${c.inAppReservation.reservedUsd} (cap >= $${c.inAppReservation.recommendedPerCheckCapUsd}) | $${c.estimate.low.dollars} / $${c.estimate.expected.dollars} / $${c.estimate.high.dollars}`);
  console.log(`all four, V2-only: low $${out.allFourV2Only.low}, expected $${out.allFourV2Only.expected}, high $${out.allFourV2Only.high}`);
  console.log('VPAA instances per relationship (Case A):', JSON.stringify(cases[0].vpaaInstances), '| CLO semantic classification checks:', cases[0].cloClassificationPairs);
  console.log('deterministic blocking findings per case:', cases.map((c) => c.case + '=' + c.offlineOfficial.deterministicBlockingFindings).join(' '));
})().catch((e) => { console.error(e); process.exit(1); });
