#!/usr/bin/env node
'use strict';
// The controlled real-Claude runner: a minimal SMOKE test, then ONE full evaluation of a synthetic case. Plan: docs/checker-comprehensive/live/LIVE-TEST-PLAN.md.
//
//   node scripts/live-claude/live.cjs smoke --plan                  what would be sent and what it would cost (no network, no key)
//   node scripts/live-claude/live.cjs smoke --dry-run               the whole code path against a SCRIPTED provider (no network, no key)
//   node scripts/live-claude/live.cjs full  --case a --scope comprehensive|v2only --plan | --dry-run
//   ... --live --confirm-paid --authorization "<the phrase --plan printed>" --provider-limit-usd N --env-file <path> [--max-cost USD] [--ledger-dir DIR]
//
// --live makes PAID requests. It refuses to start unless ALL of these hold: --confirm-paid; an --authorization phrase that is exactly the one --plan prints for THIS model,
// case, scope, request cap and dollar cap (so an authorization for one budget can never start another); --provider-limit-usd (the person's statement that a provider-side
// spending limit is set; it cannot be verified here and is recorded as a statement); an Anthropic key of the right form in --env-file (parsed only, never printed, never loaded
// into the environment); the approved model; an empty evidence directory (a paid run is never repeated into old evidence); and room in the spend register. Every request goes
// through server/lib/syllabuscheck/eval/providerGuard.js, which checks it BEFORE it leaves the process and refuses it locally once a cap is reached. No cap is ever raised here.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const L = require('./lib.cjs');
const F = require('./fixtures.cjs');
const evidence = require('./evidence.cjs');

const ROOT = L.ROOT;
const REGISTER_FILE = path.join(ROOT, 'docs/ai-eval-anthropic/spend-register.json');
const REGISTER_CAP = 10; // the authorized total for all Claude work of this project (docs/ai-eval-anthropic/spend-register.json); raising it is the owner's decision
const SMOKE = { maxRequests: 1, maxCostUsd: 0.3, maxOutputTokens: 20000 };
// the staging cost configuration under test (docs/release-candidate/RELEASE-CANDIDATE-REPORT.md); with ONE Policy V2 request they change nothing observable (no second request to warm,
// no Stage C/D fields in a Policy V2 answer, a ceiling that equals the configured 16000), and they are recorded so the run states what was in effect
const RECOMMENDED = { SYLLABUS_CHECK_CACHE_WARMUP: 'on', SYLLABUS_CHECK_OUTPUT_PLAN: 'on', SYLLABUS_CHECK_OUTPUT_FIELDS: 'scoped' };
const FULL = {
  comprehensive: { maxRequests: 80, maxOutputTokens: 260000, defaultCostUsd: 3.5, inAppCapUsd: 17, inAppMaxRequests: 120 },
  v2only: { maxRequests: 40, maxOutputTokens: 160000, defaultCostUsd: 2.0, inAppCapUsd: 6, inAppMaxRequests: 60 },
};
const args = process.argv.slice(2);
const command = args[0];
const has = (name) => args.includes('--' + name);
const flag = (name, fallback) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback; };
const fail = (message) => { console.error(message); process.exit(2); };
const mode = has('live') ? 'live' : has('dry-run') ? 'dry-run' : has('plan') ? 'plan' : null;
if (!['smoke', 'full'].includes(command) || !mode) fail('usage: live.cjs smoke|full (--plan | --dry-run | --live --confirm-paid --authorization "..." --provider-limit-usd N --env-file <path>) [--case a|b|c|d] [--scope comprehensive|v2only]');

// ---- what this run is ----
// the smoke test defaults to Case E: an approved course identity (BSIT IT 202) with synthetic content; the full tiers default to Case A
const which = String(flag('case', command === 'smoke' ? 'e' : 'a')).toLowerCase();
if (!F.CASES.includes(which)) fail('--case must be one of ' + F.CASES.join(', '));
const scope = String(flag('scope', 'comprehensive'));
if (command === 'full' && !FULL[scope]) fail('--scope must be comprehensive or v2only');
const limits = command === 'smoke' ? { ...SMOKE } : { ...FULL[scope], maxCostUsd: Number(flag('max-cost', FULL[scope].defaultCostUsd)) };
if (command === 'smoke') limits.defaultCostUsd = SMOKE.maxCostUsd;
if (command === 'full' && !(limits.maxCostUsd > 0 && limits.maxCostUsd <= 10)) fail('--max-cost must be a positive number of dollars, at most the register cap');
const maxCostUsd = command === 'smoke' ? SMOKE.maxCostUsd : limits.maxCostUsd;
const runName = command === 'smoke' ? `smoke-case-${which}` : `full-case-${which}-${scope}`;
const phrase = `I AUTHORIZE LIVE CLAUDE TEST ${runName} model=${L.MODEL} max-requests=${limits.maxRequests} max-real-spend-usd=${maxCostUsd.toFixed(2)}`;
const liveEvidenceDir = path.join(ROOT, 'docs/checker-comprehensive/live/runs', runName);
const evidenceDir = mode === 'live' ? liveEvidenceDir : path.join(os.tmpdir(), 'live-claude-dry-run-' + runName + '-' + process.pid);

const fixture = F.load(which);
const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const estimates = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/checker-comprehensive/live/estimates.json'), 'utf8')); } catch { return null; } })();

// the pairs of the smoke test: week 1's seven VPAA relationships and the classification of CLO 1: eight relationships in ONE request
function smokePairs(env) {
  const { plan, POLICY } = require(path.join(ROOT, 'server/lib/syllabuscheck/academicV2Plan'));
  const cloClassification = require(path.join(ROOT, 'server/lib/syllabuscheck/cloClassification'));
  const masters = structuredClone(fixture.masters); masters.synthetic = false; masters.fingerprint = 'live-claude-' + which;
  const ctx = plan(fixture.content, masters);
  const chosen = ctx.pairs.filter((p) => (/^row0-/.test(p.id) && POLICY.weeklyTypes.includes(p.type)) || p.id === 'clo0-classification');
  return { pairs: cloClassification.prepare(chosen, fixture.content, cloClassification.VERSION, masters), masters, POLICY, cloClassification };
}

// ---------------------------------------------------------------------- PLAN
function printPlan() {
  console.log(`Controlled real-Claude test: ${runName}`);
  console.log(`  model                 ${L.MODEL} (the only model the guard will send to; list prices $${L.IN_PER_M}/M in, $${L.OUT_PER_M}/M out; cache read $${L.CACHE_READ_PER_M}/M in the repo table but $0.20/M in the bundled Claude API reference: the guard charges the higher; verify on the pricing page)`);
  console.log(`  synthetic input       docs/checker-comprehensive/live/fixtures/case-${which}.json (${which === 'e' ? 'approved course identity BSIT IT 202 with invented syllabus content' : 'fictional course'}; no faculty or student data, no real PO or institutional text)`);
  if (command === 'smoke') {
    const { pairs } = smokePairs(L.anthropicEnv({ key: L.STAND_IN_KEY, cap: 1, mode: 'v2only' }));
    console.log(`  requests              1 request carrying ${pairs.length} relationships: ${pairs.map((p) => p.id).join(', ')}`);
    console.log('  estimated tokens      about 9,200 in (a 32 KB request: an 18,000-character system prompt plus the eight relationships; MEASURED offline) and about 6,100 out (8 x 758 measured per relationship)');
    console.log('  estimated real cost   about $0.08 (range $0.05 to $0.12); the in-app worst-case reservation of this one request is $0.247, which is why the hard cap is $0.30');
  } else {
    const e = estimates && (scope === 'v2only' ? estimates.v2only : estimates.cases).find((c) => c.case === which.toUpperCase());
    if (e) {
      console.log(`  requests              ${e.requests} counted offline (${JSON.stringify(e.requestsByPriority)}); up to ${Math.round(e.requests * 1.3)} if a real model needs follow-ups or corrective retries`);
      console.log(`  relationships         ${e.legacyRelationships} legacy-contract + ${e.policyV2Relationships} Policy V2`);
      console.log(`  estimated tokens      expected ${e.estimate.expected.inputTokens.toLocaleString()} in / ${e.estimate.expected.outputTokens.toLocaleString()} out (high ${e.estimate.high.inputTokens.toLocaleString()} / ${e.estimate.high.outputTokens.toLocaleString()})`);
      console.log(`  estimated real cost   $${e.estimate.low.dollars} low, $${e.estimate.expected.dollars} expected, $${e.estimate.high.dollars} high  (an estimate, never a limit)`);
      console.log(`  duration              about ${e.minutes.expected} to ${e.minutes.high} minutes if sent in parallel; sent ONE AT A TIME here (the shared cap is enforced serially), so roughly ${Math.round(e.requests * 7.3 / 60)} to ${Math.round(e.requests * 1.3 * 7.3 / 60)} minutes`);
    } else console.log('  (run node scripts/live-claude/plan.cjs first for the request and cost figures)');
    console.log(`  in-app per-check cap  SYLLABUS_CHECK_AI_MAX_COST_USD=${limits.inAppCapUsd} and SYLLABUS_CHECK_AI_MAX_REQUESTS=${limits.inAppMaxRequests} (a RESERVATION ceiling: it reserves each request at its worst case and is never reconciled downward; it is not dollars spent)`);
  }
  console.log(`  HARD LIMITS (enforced before any request leaves the process): at most ${limits.maxRequests} request(s), real spend at most $${maxCostUsd.toFixed(2)} (worst case of every request in flight counted), at most ${limits.maxOutputTokens.toLocaleString()} output tokens, and the spend register (cap $${REGISTER_CAP}) for all Claude work`);
  if (fs.existsSync(REGISTER_FILE)) { const r = JSON.parse(fs.readFileSync(REGISTER_FILE, 'utf8')); console.log(`  spend register        $${round(r.total, 2)} of $${r.cap} used before this run; $${round(r.cap - r.total, 2)} remaining`); }
  console.log('  provider-side limit   YOU must have set a hard monthly spend limit in the Anthropic console for the workspace the key belongs to; pass its amount as --provider-limit-usd (recorded as your statement)');
  console.log(`  evidence              ${path.relative(ROOT, liveEvidenceDir).split(path.sep).join('/')}/ (result, provider ledger, a reviewable report)`);
  console.log('');
  console.log('To authorize exactly this run, add to the command (copy the phrase unchanged):');
  console.log(`  --live --confirm-paid --provider-limit-usd <your console limit> --env-file <path to the env file holding ANTHROPIC_API_KEY> --authorization "${phrase}"`);
  if (command === 'full') console.log(`  (the dollar cap above is the default; --max-cost changes it and changes the phrase)`);
}
if (mode === 'plan') { printPlan(); process.exit(0); }

// ---------------------------------------------------------------------- preconditions of a paid run
let key = L.STAND_IN_KEY, fetchImpl, providerLimit = null;
if (mode === 'live') {
  if (!has('confirm-paid')) fail('--live needs --confirm-paid');
  if (flag('authorization', '') !== phrase) fail('--authorization is missing or is not exactly the phrase that --plan prints for this run. Nothing was sent.');
  providerLimit = Number(flag('provider-limit-usd', NaN));
  if (!(providerLimit > 0)) fail('--provider-limit-usd is required: set a hard spending limit in the Anthropic console first and state it here. Nothing was sent.');
  const envFile = flag('env-file', '');
  if (!envFile || !fs.existsSync(envFile)) fail('--env-file <path> is required (it is parsed, never printed and never loaded into the environment). Nothing was sent.');
  const dotenv = require(path.join(ROOT, 'server/node_modules/dotenv'));
  const parsed = dotenv.parse(fs.readFileSync(envFile, 'utf8'));
  key = parsed.ANTHROPIC_API_KEY || '';
  if (!/^sk-ant-/.test(key) || key === L.STAND_IN_KEY || /stand-in|not-a-real/i.test(key)) fail('ANTHROPIC_API_KEY in the env file is missing, a stand-in, or not in the form of an Anthropic key. Nothing was sent.');
  if (parsed.ANTHROPIC_MODEL && parsed.ANTHROPIC_MODEL !== L.MODEL) fail(`the env file names ANTHROPIC_MODEL=${parsed.ANTHROPIC_MODEL}; this test is for ${L.MODEL} only. Nothing was sent.`);
  if (fs.existsSync(evidenceDir) && fs.readdirSync(evidenceDir).length) fail('evidence already exists for this run; a paid run is never repeated into old evidence. Move or review it first.');
  fetchImpl = globalThis.fetch;
} else {
  fetchImpl = L.harness.scriptedTransport(); // the scripted double: no network, no key
}
fs.mkdirSync(evidenceDir, { recursive: true });

// ---------------------------------------------------------------------- the guard
const { createGuard, openSpendRegister, ANTHROPIC_MESSAGES } = require(path.join(ROOT, 'server/lib/syllabuscheck/eval/providerGuard'));
const registerFile = mode === 'live' ? REGISTER_FILE : path.join(evidenceDir, 'dry-run-register.json');
const register = openSpendRegister(registerFile, { cap: REGISTER_CAP });
process.on('exit', () => { try { register.release(); } catch { /* already released */ } });
const guard = createGuard({ fetch: fetchImpl, provider: 'anthropic', model: L.MODEL, maxRequests: limits.maxRequests, maxCost: maxCostUsd, maxTransient: 2, maxUnproductive: command === 'smoke' ? 1 : 8,
  maxOutputTokens: limits.maxOutputTokens, ledgerFile: path.join(evidenceDir, 'provider-ledger.json'), register, secrets: [key], log: (line) => console.log('  [guard] ' + line) });
const realFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('Blocked: every request of this run goes through the guarded transport'); };
const write = (name, value) => fs.writeFileSync(path.join(evidenceDir, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
const runFacts = () => ({ kind: mode === 'live' ? 'REAL Claude' : 'SCRIPTED provider (dry run)', provider: mode === 'live' ? 'anthropic' : 'scripted double', model: L.MODEL, requests: guard.ledger.requests, charged: round(guard.ledger.charged) });

(async () => {
  try {
    if (command === 'smoke') await runSmoke(); else await runFull();
  } catch (error) {
    write('ERROR.json', { error: String(error && error.message || error).slice(0, 500), ledger: { requests: guard.ledger.requests, charged: round(guard.ledger.charged) } });
    console.error('run stopped: ' + String(error && error.message || error).slice(0, 300));
    process.exitCode = 1;
  } finally { globalThis.fetch = realFetch; }
})();

// ---------------------------------------------------------------------- smoke
async function runSmoke() {
  const { align, createRequestBudget } = require(path.join(ROOT, 'server/lib/syllabuscheck/gemini'));
  const recommendationV2 = require(path.join(ROOT, 'server/lib/syllabuscheck/academicV2Recommendation'));
  const env = L.anthropicEnv({ key, cap: 3, maxRequests: 5, mode: 'v2only', extra: { SYLLABUS_CHECK_AI_CONCURRENCY: '1', ...RECOMMENDED } });
  for (const stage of L.profile.STAGES) env[`SYLLABUS_CHECK_STAGE_${stage}`] = 'off';
  env.SYLLABUS_CHECK_REQUIREMENTS_ADVICE = 'off';
  const { pairs, masters, POLICY, cloClassification } = smokePairs(env);
  console.log(`smoke: ${pairs.length} relationships in one request to ${L.MODEL} (${mode})`);
  const res = await align(fixture.content, masters, { env, transport: guard.fetch, requestBudget: createRequestBudget(env), pairs, skipEmpty: false, academicPolicy: POLICY.id, integratedAcademic: true, cloClassification: cloClassification.VERSION, recommendation: recommendationV2.VERSION });
  const judgements = res.judgements || [];
  const byId = new Map(pairs.map((p) => [p.id, p]));
  const rows = judgements.map((j) => {
    const p = byId.get(j.id) || {};
    const s = evidence.quoteCheck(j.sourceQuote, p.source), t = evidence.quoteCheck(j.targetQuote, p.target);
    return { id: j.id, type: j.type, label: j.label, unverified: !!j.unverified, failureKind: j.failureKind || null, sourceQuote: s, targetQuote: t, evidenceMatching: j.evidenceMatching || null, explanation: j.explanation, recommendation: j.recommendation || null, source: p.source, target: p.target };
  });
  const entry = (guard.ledger.entries || []).find((e) => e.kind === 'model') || {};
  const before = guard.ledger.requests;
  let refusal = null; // error handling: a request beyond the cap must be refused LOCALLY, with no network and no cost
  try { await guard.fetch(ANTHROPIC_MESSAGES, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: L.MODEL, max_tokens: 16, messages: [{ role: 'user', content: 'x' }] }) }); refusal = { refused: false }; } catch (e) { refusal = { refused: !!e.refused, message: String(e.message).slice(0, 160) }; }
  // What the provider itself reported for this one request, apart from every estimate. A scripted dry run reports the double's constants, which are NOT usage.
  const u = entry.usage || {}, geo = u.inferenceGeo === 'us' ? 1.1 : 1, num = (v) => (Number.isFinite(v) ? v : null);
  const priceRef = { input: 2, output: 10, cacheWrite5m: 2.5, cacheWrite1h: 4, cacheRead: 0.2 }; // per million tokens, Sonnet 5.5, bundled Claude API reference (cached 2026-10-06): cache read 0.1x input
  const atReference = num(u.inputTokens) === null ? null : round(((u.inputTokens * priceRef.input + (u.cacheCreationInputTokens - (u.cacheCreation1hTokens || 0)) * priceRef.cacheWrite5m + (u.cacheCreation1hTokens || 0) * priceRef.cacheWrite1h + u.cacheReadInputTokens * priceRef.cacheRead + u.completionTokens * priceRef.output) / 1e6) * geo, 6);
  const usage = {
    source: mode === 'live' ? 'provider-reported (Anthropic Messages API usage object)' : 'SCRIPTED DOUBLE CONSTANTS: not usage, not billing',
    modelRequested: L.MODEL, modelReturned: entry.modelReturned || null, messageId: entry.messageId || null, requestId: entry.requestId || null, httpStatus: entry.status ?? null, errorType: entry.errorType || null,
    stopReason: entry.stopReason || null, truncated: entry.stopReason === 'max_tokens', maxTokens: entry.maxTokens ?? null, thinkingBlocks: entry.thinkingBlocks ?? null,
    inputTokens: num(u.inputTokens), outputTokens: num(u.completionTokens), cacheCreationInputTokens: num(u.cacheCreationInputTokens), cacheCreation1hTokens: num(u.cacheCreation1hTokens), cacheReadInputTokens: num(u.cacheReadInputTokens), thinkingTokens: num(u.thinkingTokens),
    inferenceGeo: u.inferenceGeo ?? null, serviceTier: u.serviceTier ?? null, latencyMs: entry.ms ?? null,
    cost: { calculatedAtListPricesUsd: num(u.costAtListPrices), calculatedWithGeoUsd: num(u.estimatedCost), calculatedAtBundledReferencePricesUsd: atReference, chargedByGuardAgainstCapsUsd: round(guard.ledger.charged, 6), hardCapUsd: SMOKE.maxCostUsd,
      pricing: 'claude-sonnet-5-5 per million tokens: input $2, output $10, cache write 5m $2.50 (1.25x), cache write 1h $4 (2x), cache read $0.10 in anthropicClient.js but $0.20 in the bundled Claude API reference; the guard charges the higher. The Anthropic invoice and Console usage page are authoritative; verify these prices on the pricing page before the run.' },
    optimizationFlagsInEffect: RECOMMENDED, relationshipsAsked: pairs.length, relationshipsReturned: judgements.length,
  };
  const checks = [
    ['1 connectivity: the request was answered with HTTP 200 by the guarded model', entry.status === 200 && /^claude-sonnet-5-5/.test(String(entry.modelReturned || L.MODEL)) || (mode !== 'live' && judgements.length > 0)],
    ['2 model response compatibility: a normal end_turn answer with no unexpected thinking blocks', mode !== 'live' ? judgements.length > 0 : (entry.stopReason === 'end_turn' && !entry.thinkingBlocks)],
    ['3 structured JSON parsing: one judgment for every relationship asked', judgements.length === pairs.length && pairs.every((p) => judgements.some((j) => j.id === p.id))],
    ['4 schema validation: no answer was refused as invalid and every judgment is verified', rows.every((r) => !r.unverified && r.failureKind !== 'invalid_output')],
    ['5 error handling: a request beyond the cap is refused locally, sends nothing and costs nothing', refusal.refused === true && guard.ledger.requests === before],
    ['6 evidence attribution: every cited quotation appears verbatim in the text the model was given', rows.every((r) => r.sourceQuote.status !== 'NOT FOUND' && r.targetQuote.status !== 'NOT FOUND')],
    ['7 usage: the provider reported input tokens, output tokens and both cache counts for the request', mode !== 'live' || [usage.inputTokens, usage.outputTokens, usage.cacheCreationInputTokens, usage.cacheReadInputTokens].every((v) => v !== null)],
    ['8 completion: the answer ended normally (end_turn), was not cut off at max_tokens and was not refused', mode !== 'live' || (usage.stopReason === 'end_turn' && !usage.truncated)],
    ['9 spend: one request, charged within the hard cap, answered by the guarded model only', guard.ledger.requests - 0 <= 1 + 0 && guard.ledger.charged <= SMOKE.maxCostUsd && (mode !== 'live' || /^claude-sonnet-5-5/.test(String(usage.modelReturned)))],
  ].map(([name, ok]) => ({ name, ok: !!ok }));
  const result = { run: runFacts(), providerLimitStatedByPerson: providerLimit, usage, checks, refusal, relationships: rows, note: 'Transport and schema verification only. Whether any judgment is academically right is for human review of the table below.' };
  write('result.json', result);
  const md = ['# Smoke test', '', `${runFacts().kind}, model \`${L.MODEL}\`, ${runFacts().requests} request(s), $${runFacts().charged} charged. Provider-side limit stated by the person: ${providerLimit ?? 'n/a (dry run)'}.`, '', '| Check | Result |', '|---|---|', ...checks.map((c) => `| ${c.name} | ${c.ok ? 'PASS' : '**FAIL**'} |`), '', '## Provider-reported usage (' + (mode === 'live' ? 'REAL' : 'SCRIPTED, not usage') + ')', '', '```json', JSON.stringify(usage, null, 2), '```', '',
    '## What the model said (for human review; no judgment here is claimed to be academically right)', '', '| Relationship | Label | Source (as given) | Target (as given) | Quoted source / target | Explanation |', '|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.type} \`${r.id}\` | **${r.label}** | ${String(r.source).replace(/\s+/g, ' ').slice(0, 90).replace(/\|/g, '/')} | ${String(r.target).replace(/\s+/g, ' ').slice(0, 90).replace(/\|/g, '/')} | ${r.sourceQuote.status} / ${r.targetQuote.status} | ${String(r.explanation).replace(/\s+/g, ' ').slice(0, 220).replace(/\|/g, '/')} |`), ''];
  write('SMOKE-REPORT.md', md.join('\n'));
  console.log(checks.map((c) => `  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}`).join('\n'));
  console.log(`evidence: ${evidenceDir}`);
  process.exitCode = checks.every((c) => c.ok) ? 0 : 1;
}

// ---------------------------------------------------------------------- full
async function runFull() {
  const env = L.anthropicEnv({ key, cap: limits.inAppCapUsd, maxRequests: limits.inAppMaxRequests, mode: scope, extra: { SYLLABUS_CHECK_AI_CONCURRENCY: '1' } });
  console.log(`full evaluation: case ${which.toUpperCase()}, scope ${scope} (${mode})`);
  const result = await L.runFixture(fixture, { env, transport: guard.fetch });
  const facts = runFacts();
  write('report.json', result);
  write('stored-run.json', await L.storedRunOf(fixture, result)); // what the browser would receive: render it with scripts/live-claude/render-ui.mjs
  const { markdown, analysis } = evidence.render({ fixture, result, run: facts, title: `Evidence: ${runName}` });
  write('EVIDENCE.md', markdown);
  write('result.json', { run: facts, providerLimitStatedByPerson: providerLimit, official: { overall: result.overall, passed: result.passed, status: result.status, passThreshold: result.passThreshold }, vpaa: analysis.vpaa, cloClassification: analysis.clo.map((c) => ({ clo: c.n, label: c.label, status: c.status })), inventedQuotations: analysis.invented.length, counts: analysis.counts, budget: result.hybrid.budget || null, coverage: result.hybrid.ruleCoverage.counts });
  console.log(`  official ${result.overall} (pass line ${result.passThreshold}); ${facts.requests} request(s), $${facts.charged}; VPAA instances ${analysis.vpaa.map((v) => v.instances).join('/')}; quotations not found verbatim: ${analysis.invented.length}`);
  console.log(`evidence: ${evidenceDir}`);
}
