'use strict';
// Offline cost benchmark of the Comprehensive Hybrid AI Checker: baseline vs the optimisation flags (server/lib/syllabuscheck/costPlan.js).
//
//   node scripts/optimization/benchmark.cjs [--case a] [--json out.json] [--only first,unchanged,week,clo,comprehensive,tight] [--strategies]
//
// NO request leaves this machine: every provider call is answered in-process by the conformance harness's scripted transport. The numbers are therefore
// REQUEST COUNTS, REQUEST BYTES and MODELED token usage / charges, never billed amounts:
//   * the request bodies are the real ones the application builds (real prompts, schemas, course context, batching, budget reservations, reuse);
//   * tokens are MODELED: input = bytes / 4; output = relationships x a measured per-relationship figure (309 staged legacy, 758 V2 recommendation
//     contract; see docs/checker-comprehensive/live/estimates.json); a modeled answer longer than the request's max_tokens is returned as a max_tokens stop
//     (the real incomplete-output path, so the extra halving requests it causes are counted);
//   * the prompt cache is MODELED on Anthropic's documented behaviour: a cached prefix becomes readable only after the request that writes it has
//     answered, so concurrent first requests each write it; every check starts cold (no entry survives from an earlier check);
//   * prices are the published list prices in anthropicClient.PRICES (no regional factor).
// Real Claude may differ (output length, thinking tokens, cache semantics); this proves the plumbing and the direction, not the invoice.
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../..');
process.chdir(ROOT);
const L = require(path.join(ROOT, 'scripts/live-claude/lib.cjs')), F = require(path.join(ROOT, 'scripts/live-claude/fixtures.cjs'));
const gemini = require(path.join(ROOT, 'server/lib/syllabuscheck/gemini'));
const ASPECT_KEYS = gemini.ASPECT_KEYS;
const { estimateUsd } = require(path.join(ROOT, 'server/lib/syllabuscheck/anthropicClient'));
const svc = require(path.join(ROOT, 'server/lib/compliance/service')), repo = require(path.join(ROOT, 'server/lib/syllabuscheck/repository'));
const { createMemoryDb } = require(path.join(ROOT, 'server/lib/syllabuscheck/vpaa-conformance/memdb'));

// ASSUMPTION (needs a real run): the measured 309 legacy tokens per relationship were taken with the full 13 Stage C/D enum fields, each costing about 8 output tokens
// ('"learnerSupport":"not_assessed",'); so a legacy relationship costs LEGACY_BASE + 8 per Stage C/D field the request asks for.
const FIELD_TOKENS = 8, LEGACY_BASE = 309 - 13 * FIELD_TOKENS;
const OUT_PER_PAIR = { legacy: 309, v2: 758 }, BYTES_PER_TOKEN = 4;
const argv = process.argv.slice(2), arg = (name, dflt) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : dflt; };
const caseId = arg('case', 'a'), only = (arg('only', '') || '').split(',').filter(Boolean), jsonOut = arg('json', ''), withStrategies = argv.includes('--strategies');

// ---- the scripted provider with modeled usage and a modeled prompt cache ----
const MIN_CACHEABLE_TOKENS = 1024; // ASSUMED minimum cacheable prompt (not verified for the model; every system prompt here is several times larger)
function modeledProvider(ready = new Set()) {
  const inner = L.harness.scriptedTransport((pair) => {
    if (pair.id === 'row0-ilo0-activity') return { label: 'PARTIALLY_ALIGNED', explanation: "Scripted: the activity does not yet practise the week's content.", recommendation: 'REWRITE_TEXT', correctionField: 'learning_activity' };
    if (pair.id === 'row0-contentassessment') return { label: 'NOT_ALIGNED', explanation: "Scripted: the assessment task does not measure the week's content." };
    return undefined;
  });
  const log = [];
  const transport = async (url, init) => {
    const body = JSON.parse(String(init.body));
    const system = body.system.map((s) => s.text).join(''), user = JSON.parse(body.messages[0].content);
    // A Policy V2 request carries the versioned recommendation contract in its system prompt (whether or not any of its relationships has recommendation context).
    const pairs = (user.document_data || []).length, v2 = system.includes('Recommendation contract lcup-v2-recommendation');
    const bytes = Buffer.byteLength(String(init.body), 'utf8'), systemTokens = Math.ceil(Buffer.byteLength(system) / BYTES_PER_TOKEN);
    const cacheable = body.system.some((s) => s.cache_control), prefix = crypto.createHash('sha256').update(body.model + '\0' + system).digest('hex');
    const aspectFields = Object.keys(body.output_config?.format?.schema?.properties?.judgements?.items?.properties || {}).filter((k) => ASPECT_KEYS.includes(k)).length;
    const wanted = pairs * (v2 ? OUT_PER_PAIR.v2 : LEGACY_BASE + FIELD_TOKENS * aspectFields), truncated = wanted > body.max_tokens, outputTokens = Math.min(wanted, body.max_tokens);
    const totalTokens = Math.ceil(bytes / BYTES_PER_TOKEN);
    const eligible = cacheable && systemTokens >= MIN_CACHEABLE_TOKENS, read = eligible && ready.has(prefix), write = eligible && !read;
    const row = { eligible, bytes, pairs, v2, maxTokens: body.max_tokens, truncated, outputTokens, inputTokens: totalTokens - (cacheable ? systemTokens : 0), cacheCreationInputTokens: write ? systemTokens : 0, cacheReadInputTokens: read ? systemTokens : 0, prefix: prefix.slice(0, 6) };
    log.push(row);
    await new Promise((resolve) => setTimeout(resolve, 20)); // scripted latency: a concurrent request does not see a cache entry that is still being written
    if (eligible) ready.add(prefix);
    const response = await inner(url, init);
    const payload = await response.json();
    payload.usage = { input_tokens: row.inputTokens, output_tokens: outputTokens, cache_creation_input_tokens: row.cacheCreationInputTokens, cache_read_input_tokens: row.cacheReadInputTokens };
    if (truncated) { payload.stop_reason = 'max_tokens'; payload.content = [{ type: 'text', text: '{"judgements":[' }]; }
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { transport, log };
}
const usdOf = (rows) => rows.reduce((sum, r) => sum + estimateUsd(L.MODEL, { inputTokens: r.inputTokens, cacheCreationInputTokens: r.cacheCreationInputTokens, cacheReadInputTokens: r.cacheReadInputTokens, outputTokens: r.outputTokens }), 0);
const sum = (rows, key) => rows.reduce((a, r) => a + (r[key] || 0), 0);

// ---- configurations ----
const CONFIGS = {
  baseline: {},
  'scoped-context': { SYLLABUS_CHECK_COURSE_CONTEXT: 'scoped' },
  'output-plan': { SYLLABUS_CHECK_OUTPUT_PLAN: 'on' },
  'cache-warmup': { SYLLABUS_CHECK_CACHE_WARMUP: 'on' },
  'prompt-trim': { SYLLABUS_CHECK_PROMPT_TRIM: 'on' }, // an existing flag (stages.js trimOn): only the relationship tests a request needs; takes effect with a stage on (comprehensive)
  'grouping-week1': { SYLLABUS_CHECK_V2_GROUPING: 'week1' },
  'grouping-week2': { SYLLABUS_CHECK_V2_GROUPING: 'week2' },
  'grouping-week3': { SYLLABUS_CHECK_V2_GROUPING: 'week3' },
  'grouping-adaptive': { SYLLABUS_CHECK_V2_GROUPING: 'adaptive' },
  'output-fields': { SYLLABUS_CHECK_OUTPUT_FIELDS: 'scoped' },
  'safe-set': { SYLLABUS_CHECK_COURSE_CONTEXT: 'scoped', SYLLABUS_CHECK_OUTPUT_PLAN: 'on', SYLLABUS_CHECK_CACHE_WARMUP: 'on' },
};
CONFIGS['recommended'] = { SYLLABUS_CHECK_CACHE_WARMUP: 'on', SYLLABUS_CHECK_OUTPUT_PLAN: 'on', SYLLABUS_CHECK_OUTPUT_FIELDS: 'scoped' }; // the staging set: no scoped context, no grouping, no prompt trim
CONFIGS['safe+fields'] = { SYLLABUS_CHECK_COURSE_CONTEXT: 'scoped', SYLLABUS_CHECK_OUTPUT_PLAN: 'on', SYLLABUS_CHECK_CACHE_WARMUP: 'on', SYLLABUS_CHECK_OUTPUT_FIELDS: 'scoped' };
CONFIGS['all-flags'] = { SYLLABUS_CHECK_OUTPUT_FIELDS: 'scoped', SYLLABUS_CHECK_COURSE_CONTEXT: 'scoped', SYLLABUS_CHECK_OUTPUT_PLAN: 'on', SYLLABUS_CHECK_CACHE_WARMUP: 'on', SYLLABUS_CHECK_V2_GROUPING: 'week2' }; // every compatible flag together (week2: the conservative grouping)
const STRATEGIES = { 'A existing': {}, 'B week x1': { SYLLABUS_CHECK_V2_GROUPING: 'week1' }, 'C week x2': { SYLLABUS_CHECK_V2_GROUPING: 'week2' }, 'D week x3': { SYLLABUS_CHECK_V2_GROUPING: 'week3' }, 'E adaptive': { SYLLABUS_CHECK_V2_GROUPING: 'adaptive' } };

// What a check decided: the official outcome, and the verdict of every relationship that was actually checked (a not-checked one has none).
const labelsOf = (result) => {
  const labels = {};
  for (const j of result.hybrid.alignment?.judgements || []) if (!j.unverified && j.label !== 'INSUFFICIENT_EVIDENCE') labels['L:' + j.id] = j.label;
  for (const r of result.hybrid.academicV2?.academic?.relationships || []) if (r.status !== 'NOT_CHECKED') labels['V:' + r.id] = r.academicJudgment;
  return labels;
};
const signatureOf = (result) => crypto.createHash('sha256').update(JSON.stringify([result.overall, result.status, result.passed, Object.entries(labelsOf(result)).sort()])).digest('hex').slice(0, 12);
// 'identical': same official outcome and the same set of verdicts. 'same-verdicts': same official outcome, and every relationship both checks verified got the same verdict (one
// check verified more of them: the budget reached further). Anything else is a regression.
function parityOf(row, base) {
  const official = row.overall === base.overall && row.status === base.status && row.passed === base.passed;
  const common = Object.keys(row.labels).filter((k) => k in base.labels), same = common.every((k) => row.labels[k] === base.labels[k]);
  const delta = Object.keys(row.labels).length - Object.keys(base.labels).length;
  if (!official || !same) return 'DIFFERENT';
  return row.signature === base.signature ? 'identical' : delta === 0 ? 'identical' : 'same verdicts, ' + (delta > 0 ? '+' : '') + delta + ' checked';
}

// One sequence of checks on ONE syllabus (stored runs give the reuse a later check relies on).
async function sequence({ mode, extra, cap = 1000, steps, keepCache = false }) {
  const sharedCache = new Set();
  const fx = F.load(caseId), masters = structuredClone(fx.masters);
  masters.synthetic = false; masters.fingerprint = 'bench-1';
  const original = repo.mastersFor; repo.mastersFor = async () => masters;
  const content = structuredClone(fx.content), db = createMemoryDb({ syllabus: { content: JSON.stringify(content) } });
  const week = (n) => content.plan.find((r) => String(r.week) === String(n));
  const mutations = {
    first: null, unchanged: null,
    week: (c) => { week(5).activities = 'Laboratory: implement a Payable interface in several Employee classes and a Report interface for a second hierarchy'; },
    clo: (c) => { c.clos[1].statement = 'Apply inheritance, polymorphism, interfaces and abstract classes to design and write Java programs that solve well-defined problems.'; },
    description: (c) => { c.description = [{ id: 'd1', t: c.description[0].t + ' Students also learn basic software documentation.' }]; },
  };
  const rows = [];
  try {
    for (const name of steps) {
      const mutate = mutations[name]; if (mutate) mutate(content, masters);
      db.syllabus && (db.syllabus.content = JSON.stringify(content));
      const env = L.anthropicEnv({ key: L.STAND_IN_KEY, cap, maxRequests: 500, mode, extra });
      const budget = gemini.createRequestBudget(env), provider = modeledProvider(keepCache ? sharedCache : new Set());
      const t0 = Date.now();
      const result = await svc.checkHybrid(db, content, { syllabusId: 100, env, transport: provider.transport, requestBudget: budget, linkChecker: async (url) => ({ url, status: 'ok', httpStatus: 200 }) });
      await svc.storeRun(db, { syllabusId: 100, versionId: null, content, result, createdBy: 26, ai: true });
      const s = budget.summary(), log = provider.log, v2 = result.hybrid.academicV2?.academic?.relationships || [];
      rows.push({ step: name, requests: log.length, bytes: sum(log, 'bytes'), inputTokens: sum(log, 'inputTokens'), cacheWriteTokens: sum(log, 'cacheCreationInputTokens'), cacheReadTokens: sum(log, 'cacheReadInputTokens'), outputTokens: sum(log, 'outputTokens'),
        maxTokensTotal: sum(log, 'maxTokens'), eligibleRequests: log.filter((r) => r.eligible).length, cacheHitRequests: log.filter((r) => r.cacheReadInputTokens > 0).length, modeledUsd: Math.round(usdOf(log) * 1e4) / 1e4, reservedUsd: s.reservedCostUsd, truncated: log.filter((r) => r.truncated).length, maxTokensSeen: Math.max(0, ...log.map((r) => r.maxTokens)),
        legacyReuse: result.hybrid.alignment?.reuse || null, v2Reused: v2.filter((r) => r.reused).length, v2Total: v2.length, v2Attempted: v2.filter((r) => r.attempted).length,
        verified: Object.keys(labelsOf(result)).length, notChecked: (result.hybrid.alignment?.judgements || []).filter((j) => j.unverified).length + v2.filter((r) => r.status === 'NOT_CHECKED').length, providerReportedRequests: s.providerReported?.requests ?? 0, providerReportedOutputTokens: s.providerReported?.outputTokens ?? 0, deferredOptional: s.deferredOptional || 0, exhausted: !!s.exhausted, overall: result.overall, status: result.status, passed: result.passed, signature: signatureOf(result), labels: labelsOf(result), accountingOk: !!(s.providerReported && s.providerReported.requests === log.length - 0) || log.length === 0, wallMs: Date.now() - t0 });
    }
  } finally { repo.mastersFor = original; }
  return rows;
}

const SCENARIOS = {
  first: { title: '1. First full check (Policy V2 on)', mode: 'v2only', steps: ['first'], pick: 0 },
  unchanged: { title: '2. Unchanged re-check', mode: 'v2only', steps: ['first', 'unchanged'], pick: 1 },
  week: { title: '3. One-week revision (week 5 activities)', mode: 'v2only', steps: ['first', 'week'], pick: 1 },
  clo: { title: '4. CLO revision (CLO 2 statement)', mode: 'v2only', steps: ['first', 'clo'], pick: 1 },
  comprehensive: { title: '5. Full comprehensive check (first)', mode: 'comprehensive', steps: ['first'], pick: 0 },
  tight: { title: '6a. Tight budget: $6 reservation cap on the comprehensive profile (below its documented $17 minimum)', mode: 'comprehensive', steps: ['first'], pick: 0, cap: 6 },
  tightv2: { title: '6b. Tight budget: $4.4 reservation cap, Policy V2 on (required work fits, optional does not)', mode: 'v2only', steps: ['first'], pick: 0, cap: 4.4 },
  cap10: { title: '6c. $10 reservation cap on the comprehensive profile (below its documented $17 minimum)', mode: 'comprehensive', steps: ['first'], pick: 0, cap: 10 },
  warm: { title: '8. CLO revision while the prompt cache is still warm (previous check within 5 minutes)', mode: 'v2only', steps: ['first', 'clo'], pick: 1, keepCache: true },
  description: { title: '7. Course description edited (V2 on)', mode: 'v2only', steps: ['first', 'description'], pick: 1 },
};

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : String(n));
async function main() {
  const out = { generatedAt: new Date().toISOString(), kind: 'MODELED offline benchmark - scripted provider; not billed usage', case: caseId, bytesPerToken: BYTES_PER_TOKEN, outputPerPair: OUT_PER_PAIR, scenarios: {}, strategies: null };
  const names = Object.keys(SCENARIOS).filter((n) => !only.length || only.includes(n));
  for (const name of names) {
    const sc = SCENARIOS[name]; out.scenarios[name] = { title: sc.title, configs: {} };
    for (const [cname, extra] of Object.entries(CONFIGS)) {
      const rows = await sequence({ mode: sc.mode, extra, cap: sc.cap || 1000, steps: sc.steps, keepCache: !!sc.keepCache });
      out.scenarios[name].configs[cname] = rows[sc.pick];
    }
    const base = out.scenarios[name].configs.baseline;
    console.log('\n' + sc.title);
    console.log('config'.padEnd(16), 'req'.padStart(4), 'bytes'.padStart(9), 'in tok'.padStart(8), 'cacheW'.padStart(8), 'cacheR'.padStart(8), 'out tok'.padStart(8), 'modeled $'.padStart(10), 'reserved $'.padStart(11), 'trunc'.padStart(5), 'maxTok'.padStart(8), 'chit'.padStart(5), 'ver/nc'.padStart(8), 'ms'.padStart(6), 'parity');
    for (const [cname, r] of Object.entries(out.scenarios[name].configs)) {
      r.parityWithBaseline = parityOf(r, base);
      console.log(cname.padEnd(16), String(r.requests).padStart(4), fmt(r.bytes).padStart(9), fmt(r.inputTokens).padStart(8), fmt(r.cacheWriteTokens).padStart(8), fmt(r.cacheReadTokens).padStart(8), fmt(r.outputTokens).padStart(8), String(r.modeledUsd).padStart(10), String(r.reservedUsd).padStart(11), String(r.truncated).padStart(5), fmt(r.maxTokensTotal).padStart(8), (r.cacheHitRequests + '/' + r.eligibleRequests).padStart(5), (r.verified + '/' + r.notChecked).padStart(8), String(r.wallMs).padStart(6), r.parityWithBaseline + ' [' + r.overall + '/' + r.status + ']');
    }
  }
  if (withStrategies) {
    out.strategies = {};
    console.log('\nV2 request consolidation strategies (first check, Policy V2 on; SYLLABUS_CHECK_V2_GROUPING)');
    console.log('strategy'.padEnd(14), 'req'.padStart(4), 'bytes'.padStart(9), 'out tok'.padStart(8), 'modeled $'.padStart(10), 'reserved $'.padStart(11), 'trunc'.padStart(5), 'max_tokens', ' parity');
    let base;
    for (const [sname, extra] of Object.entries(STRATEGIES)) {
      const [r] = await sequence({ mode: 'v2only', extra, steps: ['first'] });
      base = base || r; r.parityWithBaseline = parityOf(r, base); out.strategies[sname] = r;
      console.log(sname.padEnd(14), String(r.requests).padStart(4), fmt(r.bytes).padStart(9), fmt(r.outputTokens).padStart(8), String(r.modeledUsd).padStart(10), String(r.reservedUsd).padStart(11), String(r.truncated).padStart(5), String(r.maxTokensSeen).padStart(10), ' ' + r.parityWithBaseline);
    }
  }
  if (jsonOut) { require('node:fs').writeFileSync(jsonOut, JSON.stringify(out, null, 2)); console.log('\nwritten', jsonOut); }
}
main().catch((error) => { console.error(error); process.exit(1); });
