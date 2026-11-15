'use strict';
// Test the re-planned AI Checker, exactly as official mode runs it, on ONE syllabus from the development database, without the app and without
// storing anything in the app. Two steps in two processes, so the paid step never loads database code:
//
//   node scripts/replan-syllabus-run.cjs --export 111
//       reads syllabus 111 and its program's masters inside a READ ONLY transaction and writes them to docs/ai-checker-replan-run/syllabus-111/
//   node scripts/replan-syllabus-run.cjs --run 111                                      dry run: what would be asked, nothing sent
//   node scripts/replan-syllabus-run.cjs --run 111 --live --confirm-paid --max-cost 1   the paid run (owner's approval of the budget)
//   add --label <name> to write a later run into its own subfolder, and --concurrency 1 to send one request at a time under a tight cap
//
// The paid run: the old engine with its AI step off (no-AI rules, base score; reference links are NOT fetched), then the new checker and its
// verified repair plan (pipeline/official.js), then a re-check with the plan applied. Safeguards as in scripts/replan-paid-run.cjs: the evaluation
// guard (Anthropic mode, worst case reserved before sending, one transient error stops the run, a ledger), the $10 spend register, the pipeline's
// own cap, a blocked global fetch, no database module loaded, and no repeat into a folder that already holds a result.
// The output folder holds real syllabus text: keep it local (do not commit it).
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const flag = (name) => args.includes(name);
const MAX_COST_LIMIT = 3;
const dirOf = id => path.join(root, 'docs', 'ai-checker-replan-run', 'syllabus-' + id);
const write = (dir, name, data) => fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2) + '\n');

async function exportSyllabus(id) {
  const env = require('../server/node_modules/dotenv').parse(fs.readFileSync(path.join(root, 'server', '.env')));
  const mysql = require('../server/node_modules/mysql2/promise');
  const repo = require('../server/lib/syllabuscheck/repository');
  const db = await mysql.createConnection({ host: env.DB_HOST, user: env.DB_USER, password: env.DB_PASS, database: env.DB_NAME });
  try {
    await db.query('START TRANSACTION READ ONLY');
    const [rows] = await db.query('SELECT syllabus_id, course_code, title, status, content FROM syllabi WHERE syllabus_id = ?', [id]);
    if (!rows.length) throw Error(`no syllabus ${id}`);
    const content = JSON.parse(rows[0].content);
    const masters = await repo.mastersFor(db, content, { syllabusId: id, historicalRead: true });
    await db.query('ROLLBACK');
    const dir = dirOf(id);
    fs.mkdirSync(dir, { recursive: true });
    write(dir, 'syllabus.json', content);
    write(dir, 'masters.json', masters);
    write(dir, 'export.json', { exportedAt: new Date().toISOString(), syllabusId: id, course: `${rows[0].course_code} ${rows[0].title}`, status: rows[0].status, program: content.meta?.program || null, egas: masters.institution?.egas?.length ?? null, pos: masters.pos?.length ?? null, note: 'Real syllabus text: keep local, do not commit.' });
    console.log(JSON.stringify({ exported: path.relative(root, dir), course: `${rows[0].course_code} ${rows[0].title}`, program: content.meta?.program, clos: (content.clos || []).length, weeks: (content.plan || []).length, egas: masters.institution?.egas?.length ?? 0, pos: masters.pos?.length ?? 0 }, null, 1));
  } finally { await db.end(); }
}

async function run(id) {
  const dir = dirOf(id);
  if (!fs.existsSync(path.join(dir, 'syllabus.json'))) throw Error(`export it first: node scripts/replan-syllabus-run.cjs --export ${id}`);
  const content = JSON.parse(fs.readFileSync(path.join(dir, 'syllabus.json'), 'utf8'));
  const masters = JSON.parse(fs.readFileSync(path.join(dir, 'masters.json'), 'utf8'));
  const { extract } = require('../server/lib/syllabuscheck/pipeline/extract');
  const { questionsOf, MAX_QUESTIONS_PER_REQUEST } = require('../server/lib/syllabuscheck/pipeline/judge');
  const groups = {};
  for (const q of questionsOf(extract(content, masters))) groups[q.group] = (groups[q.group] || 0) + 1;
  const planned = { questions: Object.values(groups).reduce((a, b) => a + b, 0), requests: Object.values(groups).reduce((n, s) => n + Math.ceil(s / MAX_QUESTIONS_PER_REQUEST), 0) };
  if (!flag('--live')) { console.log(JSON.stringify({ mode: 'dry run: nothing was sent', syllabus: `${content.meta?.code} ${content.meta?.title}`, check: planned, note: 'The repair plan adds one request per rewritten field plus re-asks for the weeks it touches.' }, null, 1)); return; }
  const maxCost = Number.parseFloat(value('--max-cost'));
  if (!flag('--confirm-paid')) throw Error('a paid run needs --confirm-paid (and the owner\'s approval of its budget)');
  if (!(Number.isFinite(maxCost) && maxCost > 0 && maxCost <= MAX_COST_LIMIT)) throw Error(`--max-cost must be above 0 and at most ${MAX_COST_LIMIT}`);
  const label = value('--label');
  if (label !== undefined && !/^[a-z0-9-]{1,40}$/.test(label)) throw Error('--label: lowercase letters, digits and dashes');
  const outDir = label ? path.join(dir, label) : dir; // a later run goes into its own subfolder; the inputs stay in the syllabus folder
  const concurrency = Number.parseInt(value('--concurrency') || '3', 10);
  if (!(concurrency >= 1 && concurrency <= 6)) throw Error('--concurrency: 1 to 6');
  if (fs.existsSync(path.join(outDir, 'result.json'))) throw Error(`${path.relative(root, outDir)}/result.json exists: a paid run is not repeated (use another --label)`);
  fs.mkdirSync(outDir, { recursive: true });
  const env = { ...process.env, ...require('../server/node_modules/dotenv').parse(fs.readFileSync(path.join(root, 'server', '.env'))) };
  if (!require('../server/lib/syllabuscheck/anthropicClient').anthropicReady(env)) throw Error('Anthropic is not configured');
  const engine = require('../server/lib/syllabuscheck/engine');
  const O = require('../server/lib/syllabuscheck/pipeline/official');
  const pipeline = require('../server/lib/syllabuscheck/pipeline');
  const { claudeProvider } = require('../server/lib/syllabuscheck/pipeline/provider');
  const { createGuard, openSpendRegister, loadedDataModules } = require('../server/lib/syllabuscheck/eval/providerGuard');
  if (loadedDataModules().length) throw Error('database modules are loaded; refusing to run');
  const register = openSpendRegister(path.join(root, 'docs', 'ai-eval-anthropic', 'spend-register.json'), { cap: 10 });
  process.on('exit', () => register.release());
  const nativeFetch = globalThis.fetch;
  const guard = createGuard({ fetch: nativeFetch, provider: 'anthropic', model: env.ANTHROPIC_MODEL, maxRequests: 120, maxCost, maxTransient: 1, ledgerFile: path.join(outDir, 'provider-ledger.json'), register, secrets: [env.ANTHROPIC_API_KEY, env.GEMINI_API_KEY, env.OPENROUTER_API_KEY].filter(Boolean), log: line => console.log(line) });
  globalThis.fetch = () => { throw Error('only the guarded model transport may reach the network in this run'); };
  const provider = claudeProvider({ env, transport: guard.fetch, maxCostUsd: maxCost, maxRequests: 120 });
  if (!provider.ready) throw Error(provider.reason);
  const store = new Map();
  try {
    console.log('1/3 the old engine with its AI step off (no AI cost; links not fetched)');
    const report = await engine.run(content, masters, { env: { ...env, SYLLABUS_CHECK_AI_PROVIDER: 'off' }, linkChecker: async url => ({ url, status: 'unverifiable', reason: 'not fetched in this test run' }) });
    const before = { status: report.status, score: report.score, baseScore: report.hybrid.baseScore, blocking: report.findings.filter(f => f.severity === 'blocking').map(f => f.ruleId) };
    console.log('2/3 the new checker and its repair plan, as official mode runs them');
    const made = {};
    await O.officialize({ noAi: report, content, masters, env, provider, store, out: made, concurrency });
    write(outDir, 'official-report.json', report);
    if (!made.plan) throw Error('the check did not complete, so no plan was built; see official-report.json');
    console.log('3/3 re-check with the SAME plan applied (built once; stored answers are reused)');
    const plan = made.plan;
    const recheck = await pipeline.check(pipeline.applyPlan(content, plan), masters, { ask: provider.ask, store, model: provider.model, concurrency });
    const h = report.hybrid;
    const result = {
      status: guard.stopped() ? 'stopped' : 'completed', syllabus: `${content.meta?.code} ${content.meta?.title}`,
      noAi: before, official: { score: report.score, ready: h.ready, alignment: h.alignment.status, coverage: h.alignment.coverage, points: h.deductions.reduce((s, d) => s + d.points, 0), areaPoints: h.replan?.areaPoints, misalignments: h.replan?.summary?.misalignments, review: h.replan?.summary?.review, notChecked: h.replan?.summary?.notChecked },
      suggestions: h.suggestions.filter(s => s.source === 'ai').map(s => ({ id: s.id, path: s.path, title: s.title, before: s.originalValue, after: s.replacement, why: s.text, fixes: s.basedOn })),
      plan: { clean: plan.clean, changes: plan.changes.length, verified: plan.changes.filter(c => c.status === 'VERIFIED').length, unresolved: plan.unresolved, manual: plan.manual.map(m => m.rule), regressions: plan.regressions },
      convergence: { recheckQuestionsAsked: recheck.judged.usage.asked, recheckMisalignments: recheck.summary.misalignments },
      guard: guard.summary(), provider: provider.usage(),
    };
    write(outDir, 'result.json', result);
    console.log(JSON.stringify({ status: result.status, noAi: result.noAi, official: result.official, plan: result.plan, convergence: result.convergence, cost: { estimatedUsd: result.provider.estimatedUsd, requests: result.provider.judgeRequests + result.provider.rewriteRequests } }, null, 1));
  } finally { guard.saveLedger(); register.release(); }
}

const exportId = value('--export'), runId = value('--run');
const idOk = v => /^\d+$/.test(String(v));
(async () => {
  if (exportId !== undefined) { if (!idOk(exportId)) throw Error('--export needs a syllabus id'); await exportSyllabus(Number(exportId)); return; }
  if (runId !== undefined) { if (!idOk(runId)) throw Error('--run needs a syllabus id'); await run(Number(runId)); return; }
  console.log('usage: --export <id> | --run <id> [--live --confirm-paid --max-cost <usd>]');
})().catch(error => { console.error(String(error && error.message || error)); process.exitCode = 1; });
