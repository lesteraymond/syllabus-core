'use strict';
// The first paid run of the re-planned checker (docs/ai-checker-replan.md, Phase 3), on ONE SYNTHETIC syllabus only
// (server/lib/syllabuscheck/pipeline/eval/synthetic.js): check it, build the repair plan, apply the plan to a copy and check again.
//
//   node scripts/replan-paid-run.cjs                                         dry run (the default): nothing is sent, no key needed
//   node scripts/replan-paid-run.cjs --live --confirm-paid --max-cost 3      the paid run, only with the owner's approval of that budget
//
// Safeguards (the same as every paid evaluation here):
//   - every request goes through the evaluation guard (eval/providerGuard.js, Anthropic mode): at most --max-requests (default 60) and --max-cost
//     dollars (at most 5), worst case reserved before sending, one transient error stops the run, a ledger file;
//   - the spend register docs/ai-eval-anthropic/spend-register.json keeps the total of every Claude evaluation under its $10 cap, and its lock stops a
//     second paid run at the same time;
//   - the pipeline's own cost cap (pipeline/provider.js) as a second, independent limit;
//   - global fetch is blocked: only the guarded transport can reach the network; no database or route module may be loaded;
//   - the output directory must not hold a result already: a paid run is never repeated by accident.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const flag = name => args.includes(name);
const value = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const outDir = path.join(root, 'docs', 'ai-checker-replan-run', value('--label', 'synthetic-1'));
const registerFile = path.join(root, 'docs', 'ai-eval-anthropic', 'spend-register.json');
const MAX_COST_LIMIT = 5;

const pipeline = require('../server/lib/syllabuscheck/pipeline');
const { questionsOf, MAX_QUESTIONS_PER_REQUEST } = require('../server/lib/syllabuscheck/pipeline/judge');
const { extract } = require('../server/lib/syllabuscheck/pipeline/extract');
const P = require('../server/lib/syllabuscheck/pipeline/prompt');
const { syntheticSyllabus, MASTERS, PLANTED, plantedReport } = require('../server/lib/syllabuscheck/pipeline/eval/synthetic');
const { schemaProblems } = require('../server/lib/syllabuscheck/anthropicSchema');

function requestsOf(map) {
  const groups = {};
  for (const q of questionsOf(map)) groups[q.group] = (groups[q.group] || 0) + 1;
  return { questions: Object.values(groups).reduce((a, b) => a + b, 0), requests: Object.values(groups).reduce((n, size) => n + Math.ceil(size / MAX_QUESTIONS_PER_REQUEST), 0) };
}

function parseOptions() {
  const maxCost = Number.parseFloat(value('--max-cost', ''));
  const maxRequests = Number.parseInt(value('--max-requests', '60'), 10);
  return { live: flag('--live'), confirmed: flag('--confirm-paid'), maxCost, maxRequests };
}

// Refusals before anything can be sent. Returns the reason, or null when a live run may start.
function liveRefusal(options, env, fsImpl = fs) {
  if (!options.live) return null;
  if (!options.confirmed) return 'a paid run needs --confirm-paid (and the owner\'s approval of its budget)';
  if (!(Number.isFinite(options.maxCost) && options.maxCost > 0 && options.maxCost <= MAX_COST_LIMIT)) return `--max-cost must be a dollar amount above 0 and at most ${MAX_COST_LIMIT}`;
  if (!(Number.isInteger(options.maxRequests) && options.maxRequests > 0 && options.maxRequests <= 120)) return '--max-requests must be 1 to 120';
  if (fsImpl.existsSync(path.join(outDir, 'result.json'))) return `${path.relative(root, outDir)}/result.json exists: a paid run is not repeated (use another --label)`;
  // env null: the checks above run before server/.env is read at all
  if (env && !require('../server/lib/syllabuscheck/anthropicClient').anthropicReady(env)) return 'Anthropic is not configured (ANTHROPIC_API_KEY and a verified ANTHROPIC_MODEL in server/.env)';
  return null;
}

async function main() {
  const options = parseOptions();
  const content = syntheticSyllabus();
  const map = extract(content, MASTERS);
  const plannedRequests = requestsOf(map);
  const schemas = { answer: schemaProblems(P.ANSWER_SCHEMA), rewrite: schemaProblems(P.REWRITE_SCHEMA) };
  const dry = {
    syllabus: `${content.meta.code} ${content.meta.title} (synthetic)`, planted: PLANTED.map(p => `${p.id}: ${p.what} -> ${p.expect.join(', ')}`),
    check: plannedRequests, schemaProblems: schemas,
    note: 'The repair plan adds one request per rewritten field and re-asks only the weeks those fields belong to; the re-check after applying the plan should ask nothing.',
  };
  if (!options.live) {
    console.log(JSON.stringify({ mode: 'dry run: nothing was sent', ...dry }, null, 2));
    console.log('\nA paid run needs the owner\'s approval of a budget, then: node scripts/replan-paid-run.cjs --live --confirm-paid --max-cost <usd>');
    return;
  }
  const early = liveRefusal(options, null);
  if (early) throw Error(early);
  const env = { ...process.env, ...require('../server/node_modules/dotenv').parse(fs.readFileSync(path.join(root, 'server/.env'))) };
  const refusal = liveRefusal(options, env);
  if (refusal) throw Error(refusal);
  if (schemas.answer.length || schemas.rewrite.length) throw Error('a schema Anthropic would refuse: ' + JSON.stringify(schemas));
  const { createGuard, openSpendRegister, loadedDataModules } = require('../server/lib/syllabuscheck/eval/providerGuard');
  if (loadedDataModules().length) throw Error('application database modules are loaded; refusing to run');
  const { claudeProvider } = require('../server/lib/syllabuscheck/pipeline/provider');
  fs.mkdirSync(outDir, { recursive: true });
  const write = (name, data) => fs.writeFileSync(path.join(outDir, name), JSON.stringify(data, null, 2) + '\n');
  const nativeFetch = globalThis.fetch;
  const register = openSpendRegister(registerFile, { cap: 10 });
  process.on('exit', () => register.release());
  const guard = createGuard({ fetch: nativeFetch, provider: 'anthropic', model: env.ANTHROPIC_MODEL, maxRequests: options.maxRequests, maxCost: options.maxCost, maxTransient: 1,
    ledgerFile: path.join(outDir, 'provider-ledger.json'), register, secrets: [env.ANTHROPIC_API_KEY, env.GEMINI_API_KEY, env.OPENROUTER_API_KEY].filter(Boolean), log: line => console.log(line) });
  globalThis.fetch = () => { throw Error('only the guarded model transport may reach the network in this run'); };
  const provider = claudeProvider({ env, transport: guard.fetch, maxCostUsd: options.maxCost, maxRequests: options.maxRequests });
  if (!provider.ready) throw Error(provider.reason);
  const store = new Map(), year = new Date().getFullYear();
  const opts = { ask: provider.ask, store, model: provider.model, year };
  try {
    write('syllabus.json', content);
    write('masters.json', MASTERS);
    write('metadata.json', { startedAt: new Date().toISOString(), model: provider.model, rules: pipeline.VERSION, prompt: P.PROMPT_VERSION, limits: { maxCostUsd: options.maxCost, maxRequests: options.maxRequests, registerCapUsd: 10 }, ...dry });
    console.log('1/3 checking the synthetic syllabus');
    const before = await pipeline.check(content, MASTERS, opts);
    write('check-before.json', { summary: before.summary, usage: before.judged.usage, misalignments: before.misalignments, results: before.judged.results, fixed: before.fixed });
    if (guard.stopped()) { write('result.json', { status: 'stopped-during-check', before: before.summary, guard: guard.summary(), provider: provider.usage() }); return; }
    console.log('2/3 building the repair plan');
    const plan = await pipeline.buildPlan(content, MASTERS, { ...opts, rewrite: provider.rewrite });
    const { revised, ...planReport } = plan;
    write('plan.json', planReport);
    write('revised.json', revised);
    if (guard.stopped()) { write('result.json', { status: 'stopped-during-plan', before: before.summary, plan: { clean: plan.clean, after: plan.after }, guard: guard.summary(), provider: provider.usage() }); return; }
    console.log('3/3 re-checking the syllabus with the plan applied');
    const recheck = await pipeline.check(pipeline.applyPlan(content, plan), MASTERS, opts);
    write('check-after.json', { summary: recheck.summary, usage: recheck.judged.usage, misalignments: recheck.misalignments });
    const result = {
      status: guard.stopped() ? 'stopped-during-recheck' : 'completed',
      planted: plantedReport(before, plan),
      before: before.summary, plan: { clean: plan.clean, rounds: plan.rounds, changes: plan.changes.length, verified: plan.changes.filter(c => c.status === 'VERIFIED').length, unresolved: plan.unresolved.length, manual: plan.manual.length, regressions: plan.regressions.length, adviceRegressions: plan.adviceRegressions.length },
      convergence: { recheckQuestionsAsked: recheck.judged.usage.asked, recheckMisalignments: recheck.summary.misalignments, manualLeft: plan.manual.length },
      guard: guard.summary(), provider: provider.usage(),
    };
    write('result.json', result);
    console.log(JSON.stringify(result, null, 2));
  } finally { guard.saveLedger(); register.release(); }
}

if (require.main === module) main().catch(error => { console.error(String(error && error.message || error)); process.exitCode = 1; });
module.exports = { liveRefusal, requestsOf, parseOptions, MAX_COST_LIMIT, outDir };
