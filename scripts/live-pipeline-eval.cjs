#!/usr/bin/env node
'use strict';
// Whole-pipeline evaluation of the checker with EVERY advisory stage on (or, with --legacy, every stage off), on the representative 18-week syllabi (with
// and without planted errors) and on the real sample syllabi. Read-only: no database, no syllabus is changed, no score is stored.
//
//   node scripts/live-pipeline-eval.cjs                      PLAN ONLY (the default): no network. Requests, tokens and estimated cost per syllabus.
//   node scripts/live-pipeline-eval.cjs --live --confirm-paid --budget 150 [--max-cost 0.5] [--max-transient 3] [--max-unproductive N]
//                                       [--max-unresolved 0.2] [--min-sample 8] [--warn-invalid N] [--max-invalid N] [--accounting reconcile|conservative]
//                                       [--min-items] [--ledger <file>] [--previous-ledger <closed ledger>] [--syllabi bsit-defects,real-prog1] [--trim]
//                                       [--out result.json] --provider openrouter
//                                                            PAID: calls the OpenRouter model configured in server/.env. Both flags are required.
//   --legacy                                                 every stage off: the settings the application uses today (the default is every stage on)
//
// Stage S7, Claude through the direct Anthropic API, for evaluation only (eval/claudeEvaluation.js):
//   node scripts/live-pipeline-eval.cjs --provider anthropic [--legacy] [--model claude-sonnet-5-5] [--thinking adaptive|off] [--effort high]
//                                                            PLAN: every request is built by the adapter and answered offline (the Phase 3 oracle, all
//                                                            ALIGNED); its worst case at the prices pinned in anthropicClient.js, and an estimate.
//   node scripts/live-pipeline-eval.cjs --live --confirm-paid --provider anthropic --model claude-sonnet-5-5 --thinking adaptive --effort high
//                                       --budget N --max-cost D --ledger <file> --out <new file> [--legacy] [--syllabi bsit-aligned,...]
//                                       [--total-cap 10] [--spend-register <file>] [--max-output-tokens N] [--max-tokens 16000] [--timeout-sec 180] [--max-retries 2]
// A paid run names its provider (--provider), never taken from server/.env, and never overwrites an earlier result (--out must be a new file). Claude
// checks the synthetic syllabi only: a real-* syllabus is refused before it is read. The engine is asked as an evaluation (evaluationOnly), so no
// answer counts as a verified check, an official score or a submission gate, and every Claude ledger records its charges in the spend register, whose
// total cap (default and at most $10) no evaluation passes. Each syllabus keeps what the scoring comparison reads of its engine result (officialDetail,
// eval/providerDrift.js), so two runs can be compared offline: scripts/report-provider-drift.cjs --baseline <file> --candidate <file>.
//
// Stop conditions (live). Every provider request goes through the guard in server/lib/syllabuscheck/eval/providerGuard.js and is checked BEFORE it is
// sent, so a limit stops the run in the middle of a syllabus, not only between syllabi:
//   - at most --budget provider requests in all, retries and the price lookup included (--ledger carries the count and charges into the next invocation,
//     and --previous-ledger names the closed ledger this one follows);
//   - a request is sent only while the dollars charged plus its worst case at the model's current highest prices fit under --max-cost (default $0.50).
//     The worst case is reserved before the request is sent; a reliable provider-reported cost settles it afterwards (--accounting reconcile, the
//     default since Stage E.6; conservative charges the larger of the reported cost and the tokens at the highest prices; a timeout or a request
//     without usage is always charged its worst case);
//   - HTTP 401/402/403 stops at once and nothing more is sent, as does any other refusal of the request format;
//   - --max-transient (default 3) rate limits, timeouts, network or server errors stop;
//   - --max-unproductive answers in a row that verified no relationship stop (default 1 + 2 x the batch size: the most one batch's bounded retries
//     can bring), counted as each answer arrives;
//   - answers that failed validation in whole or in part warn at --warn-invalid (default 40% of --budget, at least 3, the earlier stop) and stop only
//     when --max-invalid is given (Stage E.6: an answer refused for one relationship and corrected by the next request is not a failed evaluation).
// Between syllabi the run also stops when a contradiction between recommendations is found (eval/contradictions.js), and on the academic stop (Stage
// E.6, docs/stage-e6-evaluation-reliability.md): once --min-sample distinct relationships were attempted, a final unresolved rate above
// --max-unresolved (default 0.2; --stop-invalid is the earlier name) over every syllabus checked so far. The rate counts distinct relationships, never
// retry attempts, and a relationship that was never sent is never evaluated. The engine plans each stage from the answers before it, so the
// relationships of a syllabus are known once it is checked: every relationship it judged or sent, and those of a stage it planned but never reached
// (counted from its own stage counts). The report says whether the run completed for academic use (completion). Requests are sequential. What
// completed, the syllabus in progress included, is written to --out after every syllabus and when the run stops. The stage switches, --min-items and
// the concurrency live in a local env object, never process.env or server/.env.
// Planted errors give expected outcomes; they are the assistant's synthetic expectations, NOT faculty judgements.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const lib = path.join(root, 'server', 'lib', 'syllabuscheck');
const { run } = require(path.join(lib, 'engine.js'));
const gemini = require(path.join(lib, 'gemini.js'));
const { stageFlags, anyStage } = require(path.join(lib, 'stages.js'));
const { programSyllabus, PROGRAMS } = require(path.join(lib, 'eval', 'programSyllabi.js'));
const { loadReal, COURSES } = require(path.join(lib, 'eval', 'realSyllabi.js'));
const { contradictionsOf } = require(path.join(lib, 'eval', 'contradictions.js'));
const { createGuard, loadedDataModules, openSpendRegister, claudePrices, claudePriceTable, describeClaudePrices, describeClaudeUsage } = require(path.join(lib, 'eval', 'providerGuard.js'));
const { createTracker, academicStopOf, completionOf, describe: describeMetrics } = require(path.join(lib, 'eval', 'evalMetrics.js'));
const { anthropicSettings, requestConfigOf } = require(path.join(lib, 'anthropicClient.js'));
const { claudeOptionsOf, applyClaudeEnv, planCostOf, PLAN_KEY } = require(path.join(lib, 'eval', 'claudeEvaluation.js'));
const { officialOf } = require(path.join(lib, 'eval', 'providerDrift.js'));

const args = process.argv.slice(2);
const has = name => args.includes('--' + name);
const flag = (name, fallback) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback; };
const RATE = 0.089 / 1e6; // blended $ per token that earlier runs were billed at (input and output together); an estimate, not a quote
const STAGES = ['A', 'B', 'B3', 'B4', 'C1', 'C2', 'D1', 'D2'];
const live = has('live');
if (live && !has('confirm-paid')) { console.error('--live makes PAID provider calls. Add --confirm-paid to confirm, after approval.'); process.exit(2); }
const budget = Math.max(1, Number(flag('budget', flag('max-requests', 150))) || 150);
const maxCost = Math.max(0, Number(flag('max-cost', 0.5)) || 0.5); // dollars, checked against each request's worst case before it is sent
const maxTransient = Number(flag('max-transient', 3));
// Stage E.6: the academic stop is the final unresolved rate of distinct relationships (--stop-invalid, its earlier name, is still read); invalid
// answers warn at --warn-invalid and stop only when --max-invalid is given.
const maxUnresolved = Number(flag('max-unresolved', flag('stop-invalid', 0.2))), minSample = Number(flag('min-sample', 8));
const maxInvalid = flag('max-invalid', '') ? Number(flag('max-invalid', '')) : Infinity, warnInvalid = Number(flag('warn-invalid', Math.max(3, Math.ceil(budget * 0.4))));
const unproductiveGiven = flag('max-unproductive', '') ? Number(flag('max-unproductive', '')) : null, accounting = flag('accounting', 'reconcile');
if (!(maxUnresolved >= 0 && maxUnresolved <= 1) || !(Number.isInteger(minSample) && minSample >= 1)) { console.error('--max-unresolved must be a share from 0 to 1 and --min-sample a positive integer'); process.exit(2); }
const ledgerFile = flag('ledger', '') || null, previousLedger = flag('previous-ledger', '') || null, out = flag('out', '');
// Stage S7: --legacy turns every stage off; the provider is named on the command line, and Claude is asked only for evaluation.
const legacy = has('legacy');
const providerName = flag('provider', '');
if (has('provider') && !['openrouter', 'anthropic'].includes(providerName)) { console.error('--provider must be openrouter or anthropic. No request was sent.'); process.exit(2); }
const claude = providerName === 'anthropic';
let claudeOptions = null;
if (claude) {
  const { options, problems } = claudeOptionsOf({ has, flag, paid: live, refused: ['min-items'] });
  if (live) {
    const requests = Number(flag('budget', flag('max-requests', '')));
    if (!(Number.isInteger(requests) && requests >= 1)) problems.push('a paid Claude run needs --budget (the most requests in all, retries included) as a positive integer');
    if (!(has('max-cost') && maxCost > 0 && maxCost <= options.totalCap)) problems.push(`a paid Claude run needs --max-cost (dollars) above 0 and at most the total cap ($${options.totalCap})`);
    if (!ledgerFile) problems.push('a paid Claude run needs --ledger (a Claude ledger of its own)');
    if (!out) problems.push('a paid Claude run needs --out (a new result file)');
    const files = [ledgerFile, out, options.register].filter(Boolean).map(file => path.resolve(file));
    if (new Set(files).size !== files.length) problems.push('--ledger, --out and --spend-register must be separate files');
  }
  if (problems.length) { console.error(`${problems.join('\n')}\nNo request was sent.`); process.exit(2); }
  claudeOptions = options;
}
if (live && !providerName) { console.error('A paid run names its provider: --provider openrouter or --provider anthropic. It is never taken from server/.env. No request was sent.'); process.exit(2); }
if (live && out && fs.existsSync(out)) { console.error(`${out} already exists: an evaluation never overwrites an earlier result. Name a new --out file. No request was sent.`); process.exit(2); }

// ---- the syllabi and their planted errors ----
const PLANTED = [ // [what was changed, the relationship that must not be judged ALIGNED, change]
  ['week 3 content from another discipline', /^Content-course:row2-content$/, c => { c.plan[2].contents = 'Folk dance steps and costume design for the cultural festival'; }],
  ['week 9 ILO tagged to the wrong CLO', /^ILO-CLO:row8-ilo0-clo:c4$/, c => { c.plan[8].ilos[0].tags = ['clo:c4']; }],
  ['week 10 activity unrelated to the ILO', /^ILO-activity:row9-ilo0-activity$/, c => { c.plan[9].activities = '- Watch a full-length movie and write a reaction paper about the actors.'; }],
  ['week 11 assessment unrelated to the ILO', /^ILO-assessment:row10-ilo0-assessment$/, c => { c.plan[10].tasks = '- Multiple-choice quiz recalling the names of famous scientists.'; }],
  ['week 14 value only named', /^Value-use:row13-valueuse$/, c => { c.plan[13].values = 'Compassion'; }],
  ['week 15 supporting values without evidence', /^(Value-map:row14-valuemap|Module-value:row14-value)$/, c => { c.plan[14].values = 'Respect'; c.plan[14].activities = '- Lecture and demonstration.'; }],
  ['an unrelated book in the references', /^Ref-relevance:ref-books-1$/, c => { c.refs.books.items[1].t = 'Reyes, L. (2018). Principles of marketing management. Example Press.'; }],
];
const changedRows = new Set([2, 8, 9, 10, 13, 14]);
async function syllabi(names) {
  const out = [];
  for (const name of names) {
    const [kind, variant] = name.split('-');
    if (PROGRAMS.includes(kind)) {
      const s = programSyllabus(kind), content = structuredClone(s.content);
      if (variant === 'defects') for (const [, , change] of PLANTED) change(content);
      out.push({ name, label: s.label + (variant === 'defects' ? ' (planted errors)' : ' (aligned)'), content, masters: s.masters, planted: variant === 'defects' ? PLANTED : [], aligned: variant !== 'defects' });
    } else if (kind === 'real' && COURSES[variant]) {
      const r = await loadReal(variant);
      if (r) out.push({ name, label: r.label + ' (real text)', content: r.content, masters: r.masters, planted: [], aligned: false });
      else console.error(`skipped ${name}: the PDF is not in reference-data/`);
    } else console.error(`unknown syllabus ${name}`);
  }
  return out;
}
function envFor() {
  const env = { ...process.env };
  const file = path.join(root, 'server', '.env');
  if (fs.existsSync(file)) for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim(); }
  for (const k of STAGES) env['SYLLABUS_CHECK_STAGE_' + k] = legacy ? 'off' : 'on';
  env.SYLLABUS_CHECK_PROMPT_TRIM = has('trim') ? 'on' : 'off';
  env.SYLLABUS_CHECK_SCHEMA_MIN_ITEMS = has('min-items') ? 'on' : 'off'; // Stage E.6: only with --min-items, and only in this object
  if (claude) applyClaudeEnv(env, claudeOptions); // Stage S7: the model and its settings, in this object only, and no approval switch
  else if (providerName) env.SYLLABUS_CHECK_AI_PROVIDER = providerName;
  return env;
}
// --max-unproductive: by default the most answers one batch's bounded retries can bring: 1 + 2 x the batch size under the staged policy (9 for a batch of
// 4: each relationship is sent at most MAX_ATTEMPTS = 3 times, and every request carries at least one), 1 + 3 x under the legacy cascade (--legacy).
const extraSends = env => (anyStage(stageFlags(env)) ? gemini.MAX_ATTEMPTS - 1 : 3);
const unproductiveOf = env => unproductiveGiven ?? 1 + extraSends(env) * gemini.batchSizeOf(gemini.providerConfig(env, { evaluation: claude }).model, env);
// Stage E.6: the relationships of one checked syllabus, by id. The engine plans each stage from the answers before it, so they are known only once
// the syllabus is checked: every relationship it judged (an empty text answered locally is not a provider question, nor is a reused answer) and every
// id a request carried, plus, counted from the engine's own stage counts, the relationships of a stage it planned but never named (a batch never
// reached after a stop): those are planned and never attempted. Each request is read from the guard's log: the ids it carried and, for an answer
// that arrived, the ids it verified (the `check` hook). Feeds every tracker given.
function trackSyllabus(trackers, s, result, entries) {
  const key = id => `${s.name}:${id}`;
  const A = result ? result.hybrid.alignment : null, J = (A && A.judgements) || [];
  const local = j => j.failureKind === 'insufficient_text' || j.reused;
  const known = new Set([...J.filter(j => !local(j)).map(j => j.id), ...entries.flatMap(e => e.ids || [])]);
  const stages = A ? [A.b3, A.stageC && A.stageC.c1, A.stageC && A.stageC.c2, A.stageD && A.stageD.d1, A.stageD && A.stageD.d1 && A.stageD.d1.valueMap, A.stageD && A.stageD.d2] : [];
  const plannedCount = A ? ((A.coverage && A.coverage.total) || 0) + stages.reduce((n, x) => n + ((x && x.asked) || 0), 0) - J.filter(local).length : known.size;
  const unidentified = Math.max(0, plannedCount - known.size);
  for (const t of trackers) {
    t.plan([...known].map(key));
    t.plan(Array.from({ length: unidentified }, (_, i) => key(`unidentified-${i + 1}`)));
    for (const e of entries) t.sent({ keys: (e.ids || []).map(key), answered: Array.isArray(e.verifiedIds), verified: (e.verifiedIds || []).map(key) });
    for (const j of J) if (!local(j)) t.settle(key(j.id), j);
  }
  return { planned: Math.max(plannedCount, known.size), named: known.size, unidentified };
}
// An error printed outside the guard still never shows an API key.
const redactKeys = text => { const env = envFor(); return [env.OPENROUTER_API_KEY, env.GEMINI_API_KEY, env.ANTHROPIC_API_KEY].filter(key => typeof key === 'string' && key.trim().length >= 8).reduce((out, key) => out.split(key).join('[redacted]'), String(text)); };
// Planted errors found, and relationships flagged in parts of an aligned syllabus nobody changed (the synthetic expectation is ALIGNED there).
function scoreOf(s, result) {
  const J = (result.hybrid.alignment.judgements || []).filter(j => !j.unverified);
  const planted = s.planted.map(([what, re]) => { const j = J.find(x => re.test(x.type + ':' + x.id)); return { what, judged: j ? j.label : 'not asked or not verified', found: !!j && j.label !== 'ALIGNED' }; });
  const untouched = J.filter(j => { const row = /^row(\d+)-/.exec(j.id); return !(row && changedRows.has(Number(row[1])) && s.planted.length) && !/^ref-books-1$/.test(j.id); });
  const flagged = untouched.filter(j => ['PARTIALLY_ALIGNED', 'NOT_ALIGNED'].includes(j.label));
  return { planted, plantedFound: planted.filter(p => p.found).length, untouchedJudged: untouched.length, untouchedFlagged: flagged.length, flagged: flagged.slice(0, 40).map(j => `${j.type}:${j.id} ${j.label}`) };
}

// Stage S7: the Claude plan. Each syllabus is checked offline through the adapter (anthropicClient.js and the SDK), with a placeholder key, against the
// Phase 3 oracle replayed as Anthropic's API (eval/anthropicReplay.js), which answers every relationship ALIGNED with quotes from its own texts, as the
// stand-in below does: the requests are those a run would send for an all-aligned syllabus. Each worst case is the guard's own bound on exactly those
// bytes at the pinned prices; the expected range is an estimate, never a limit (eval/claudeEvaluation.js planCostOf).
async function claudePlan(list) {
  const { createOracle } = require(path.join(lib, 'eval', 'phase3', 'oracle.js'));
  const { createAnthropicReplay } = require(path.join(lib, 'eval', 'anthropicReplay.js'));
  globalThis.fetch = () => { throw new Error('Blocked: a plan sends nothing'); };
  const env = envFor(); env.ANTHROPIC_API_KEY = PLAN_KEY; env.SYLLABUS_CHECK_AI_CONCURRENCY = '1';
  const o = claudeOptions, prices = claudePrices(env.ANTHROPIC_MODEL), request = requestConfigOf(env.ANTHROPIC_MODEL, anthropicSettings(env));
  if (request.problem) { console.error(`${request.problem}. No request was sent.`); process.exit(2); }
  console.log(`PLAN ONLY (Claude): no provider call is made. Model ${env.ANTHROPIC_MODEL}; thinking ${o.thinking} (${JSON.stringify(request.thinking)}), effort ${request.effort}, max_tokens ${o.maxTokens}, adapter retries ${o.maxRetries}; prompt ${gemini.promptVersionOf(env.ANTHROPIC_MODEL, env)} (${legacy ? 'every stage off: --legacy' : 'every stage on'}); EVALUATION ONLY: never a verified check, an official score or a submission gate.`);
  console.log(describeClaudePrices(claudePriceTable(prices)));
  console.log(`Retry ceiling: the requests + ${extraSends(env)} x the questions (the checker's ${legacy ? 'legacy cascade' : 'bounded retries'}), each request sent at most ${1 + o.maxRetries} time(s) by the adapter. The oracle answers ALIGNED, so the later stages ask what an all-aligned syllabus would.`);
  console.log('| Syllabus | Requests | Questions | Retry ceiling | Input tokens per request | Worst case | Expected |\n|---|---:|---:|---:|---:|---:|---:|');
  const total = { requests: 0, questions: 0, ceiling: 0, worst: 0, low: 0, high: 0, largest: 0 };
  for (const s of list) {
    const replay = createAnthropicReplay(createOracle({}), { thinking: request.thinking.type === 'adaptive' }), bodies = [];
    const transport = async (url, init) => { bodies.push(String(init.body)); return replay.transport(url, init); };
    gemini.resetProviderBlock();
    await run(structuredClone(s.content), s.masters, { useAi: true, env, transport, evaluationOnly: true, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }) });
    const cost = planCostOf(bodies, prices), ceiling = (cost.requests + extraSends(env) * cost.relationships) * (1 + o.maxRetries);
    for (const key of ['requests', 'worst', 'low', 'high']) total[key] += cost[key];
    total.questions += cost.relationships; total.ceiling += ceiling; total.largest = Math.max(total.largest, cost.largest);
    console.log(`| ${s.label} | ${cost.requests} | ${cost.relationships} | ${ceiling} | ${cost.inputTokensPerRequest.toLocaleString('en-US')} | $${cost.worst.toFixed(4)} | $${cost.low.toFixed(4)}-$${cost.high.toFixed(4)} |`);
  }
  console.log(`| **Total** | **${total.requests}** | **${total.questions}** | **${total.ceiling}** | | **$${total.worst.toFixed(4)}** | **$${total.low.toFixed(4)}-$${total.high.toFixed(4)}** |`);
  console.log(`The worst case of one request is at most $${total.largest.toFixed(4)}: --max-cost must be at least that. Suggested --budget: ${Math.ceil(total.requests * 2)} (twice the minimum, for retries). Caps: --budget, --max-cost, --max-output-tokens, and --total-cap $${o.totalCap} over every Claude evaluation (spend register ${path.relative(process.cwd(), path.resolve(o.register))}).`);
  console.log('Estimates are not spending limits: the caps are the guard\'s own accounting at the pinned prices, and Anthropic\'s invoice (the Console\'s usage page) is what counts. Live: --live --confirm-paid --provider anthropic with its flags, only after approval.');
}

(async () => {
  const names = flag('syllabi', [...PROGRAMS.flatMap(k => [`${k}-aligned`, `${k}-defects`]), ...(claude ? [] : Object.keys(COURSES).map(k => `real-${k}`))].join(',')).split(',');
  // Stage S7: Claude checks the synthetic syllabi only. A real syllabus is refused before it is read, so no faculty text can reach Anthropic.
  const synthetic = new Set(PROGRAMS.flatMap(k => [`${k}-aligned`, `${k}-defects`]));
  if (claude && names.some(name => !synthetic.has(name))) { console.error(`Claude evaluates the synthetic syllabi only (${[...synthetic].join(', ')}); refused: ${names.filter(name => !synthetic.has(name)).join(', ')}. Real syllabi are never read or sent to Anthropic. No request was sent.`); process.exit(2); }
  const list = await syllabi(names);
  if (!live && claude) { await claudePlan(list); return; }
  if (!live) {
    // ---- PLAN: the same pipeline with a local stand-in that accepts everything; nothing leaves this computer ----
    const env = envFor(); env.SYLLABUS_CHECK_AI_PROVIDER = 'gemini'; env.GEMINI_API_KEY = 'plan-only';
    console.log('PLAN ONLY: no provider call is made. Minimum requests (no retries); tokens = characters / 4; cost at the blended rate earlier runs were billed.');
    console.log(legacy ? `Retry ceiling: the most requests the legacy cascade allows (--legacy, every stage off: after its batch, each question asked alone up to three times: the requests + 3 x the questions). The stand-in answers ALIGNED.`
      : `Retry ceiling: the most requests the bounded retries allow (each question sent at most ${gemini.MAX_ATTEMPTS} times, every request carrying at least one: the requests + ${gemini.MAX_ATTEMPTS - 1} x the questions). The stand-in answers ALIGNED, so the later stages ask what an all-aligned syllabus would (Stage B3 asks nothing then; Stages C and D ask the most).`);
    console.log('| Syllabus | Requests | Questions | Retry ceiling | Input tokens | Est. cost |\n|---|---:|---:|---:|---:|---:|');
    let total = { requests: 0, tokens: 0, ceiling: 0 };
    for (const s of list) {
      const keys = gemini.aspectKeysFor(stageFlags(env)); let requests = 0, chars = 0, questions = 0;
      const transport = async (url, req) => { requests++; chars += req.body.length; const b = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data; questions += b.length;
        const ans = p => ({ id: p.id, label: 'ALIGNED', explanation: 'plan', sourceQuote: p.source.slice(0, 14), targetQuote: p.target.slice(0, 14), sourceBloom: 'N/A', targetBloom: 'N/A', draft: '', ...Object.fromEntries(keys.map(k => [k, 'not_assessed'])) });
        return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: b.map(ans) }) }] } }] }) }; };
      gemini.resetProviderBlock();
      await run(structuredClone(s.content), s.masters, { useAi: true, env, transport, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }) });
      const tokens = Math.round(chars / 4), ceiling = requests + extraSends(env) * questions; total.requests += requests; total.tokens += tokens; total.ceiling += ceiling;
      console.log(`| ${s.label} | ${requests} | ${questions} | ${ceiling} | ${tokens.toLocaleString('en-US')} | $${(tokens * RATE).toFixed(4)} |`);
    }
    console.log(`| **Total** | **${total.requests}** | | **${total.ceiling}** | **${total.tokens.toLocaleString('en-US')}** | **$${(total.tokens * RATE).toFixed(4)}** |`);
    console.log(`Suggested --budget: ${Math.ceil(total.requests * 2)} (twice the minimum, for retries and halving). Live: add --live --confirm-paid, only after approval.`);
    console.log(`Stops (live): ${maxTransient} rate limits/timeouts/server errors; ${unproductiveOf(envFor())} answers in a row that verify nothing; between syllabi, a final unresolved rate above ${maxUnresolved} once ${minSample} relationships were attempted, or a contradiction; HTTP 401/402/403 and other refusals at once; invalid answers warn at ${warnInvalid}${maxInvalid === Infinity ? '' : ` and stop at ${maxInvalid}`}; accounting ${accounting}; schema ${has('min-items') ? 'minItems 1 (--min-items)' : 'as before (no minItems)'}.`);
    return;
  }
  // ---- LIVE (paid): every provider request goes through the guard, checked before it is sent ----
  const env = envFor();
  env.SYLLABUS_CHECK_AI_CONCURRENCY = '1'; // sequential (this object only): a stop takes effect before the next request is sent
  const config = gemini.providerConfig(env, { evaluation: claude });
  if (claude && !config.configured) { console.error(`A paid Claude run needs ANTHROPIC_API_KEY in Anthropic's own format and ${config.model} with settings it accepts. No request was sent.`); process.exit(2); }
  if (!claude && (config.provider !== 'openrouter' || !config.configured)) { console.error('A paid run needs the configured OpenRouter provider and a supported model: its listed prices bound the cost of every request.'); process.exit(2); }
  const loaded = loadedDataModules();
  if (loaded.length) { console.error(`Refusing to run: modules that reach application data are loaded: ${loaded.join(', ')}`); process.exit(1); }
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Blocked: every request of the evaluation goes through the guarded transport'); };
  // An answer is checked as it arrives, as requestOpenRouter checks it next (gemini.js verifyAnswer): why it failed, and the ids it verified (all of
  // them when it passed, the salvaged ones when it was refused in part). The guard counts it as an invalid answer (--warn-invalid, --max-invalid) and,
  // when it verified nothing, toward --max-unproductive; the ids feed the relationship counts (trackSyllabus).
  // Claude (Stage S7): the user message is the request's only message, and an answer is complete only when it ended with end_turn (anthropicClient.js).
  const checkAnswer = (sent, entry) => {
    if (claude ? entry.stopReason !== 'end_turn' : entry.finishReason && entry.finishReason !== 'stop') return { invalid: `incomplete_output: ${claude ? `stop_reason ${entry.stopReason}` : `finish_reason ${entry.finishReason}`}`, verified: [] };
    if (typeof entry.content !== 'string') return { invalid: 'incomplete_output: no answer text', verified: [] };
    try { const asked = JSON.parse(sent.messages[claude ? 0 : 1].content); gemini.verifyAnswer(entry.content, asked.document_data, gemini.contractOf(env, asked.course)); return null; }
    catch (error) { return error.unverified ? { invalid: `${error.code || 'invalid_answer'}: ${error.message}`, verified: (error.salvaged || []).map(j => j.id), code: error.code || 'invalid_answer' } : null; }
  };
  const maxUnproductive = unproductiveOf(env);
  let guard, register = null;
  try {
    if (claude) { // the spend register first (one Claude evaluation spends at a time; released however the process ends), then the guard that records into it
      for (const file of [claudeOptions.register, ledgerFile, out]) fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
      register = openSpendRegister(claudeOptions.register, { cap: claudeOptions.totalCap });
      process.on('exit', () => register.release());
    }
    guard = createGuard({ fetch: realFetch, maxRequests: budget, maxCost, maxTransient, maxInvalid, warnInvalid, maxUnproductive, accounting, ledgerFile, previousLedger, secrets: [env.OPENROUTER_API_KEY, env.GEMINI_API_KEY, env.ANTHROPIC_API_KEY], log: line => console.log(line), check: checkAnswer,
      ...(claude ? { provider: 'anthropic', model: config.model, maxOutputTokens: claudeOptions.maxOutputTokens, register } : {}) });
  } catch (error) {
    if (register) register.release();
    console.error(`${error.message} (--budget, --max-cost, --max-transient, --max-invalid, --warn-invalid, --max-unproductive, --accounting, --ledger, --previous-ledger${claude ? ', --spend-register, --total-cap, --max-output-tokens' : ''})`); process.exit(2);
  }
  const minItems = gemini.minItemsOn(env, config.model);
  const claudeRequest = claude ? requestConfigOf(config.model, anthropicSettings(env)) : null;
  console.log(`LIVE: model ${config.model}, prompt ${gemini.promptVersionOf(config.model, env)} ${has('trim') ? 'TRIMMED' : 'full (baseline)'}, ${legacy ? 'every stage off (--legacy)' : 'every stage on'}; limits ${budget} requests (the ledger already holds ${guard.ledger.requests}), $${maxCost} (accounting ${accounting}), ${maxTransient} transient errors, ${maxUnproductive} answers in a row that verify nothing; between syllabi the academic stop at a final unresolved rate above ${maxUnresolved} once ${minSample} relationships were attempted; invalid answers warn at ${warnInvalid}${maxInvalid === Infinity ? '' : ` and stop at ${maxInvalid}`}; schema ${minItems ? 'minItems 1' : 'as before (no minItems)'}; requests sequential.`);
  if (claude) {
    console.log(`Claude: thinking ${claudeOptions.thinking} (${JSON.stringify(claudeRequest.thinking)}), effort ${claudeRequest.effort}, max_tokens ${claudeOptions.maxTokens}, timeout ${claudeOptions.timeoutSec} s, adapter retries ${claudeOptions.maxRetries}; EVALUATION ONLY. Total cap $${register.cap} over every Claude ledger of the spend register ($${register.total()} charged before this run); output tokens ${claudeOptions.maxOutputTokens ?? 'not capped'}.`);
    console.log(describeClaudePrices(claudePriceTable(guard.state.prices)));
    // A first Ctrl+C stops sending and lets the request in flight settle (its charge reaches the ledger and the spend register); a second quits at once.
    let interrupted = false;
    process.on('SIGINT', () => { if (interrupted) process.exit(130); interrupted = true; guard.stop('interrupted by the operator (Ctrl+C): nothing more is sent; the request in flight settles, and a second Ctrl+C quits at once'); });
  } else try { await guard.readPrices(config.model, env.OPENROUTER_API_KEY); } catch (error) { guard.stop(`the price lookup failed (${guard.redact(error.message).slice(0, 120)}), so the cost ceiling cannot be enforced`); }
  const results = [], tracker = createTracker();
  let stopped = null;
  // A syllabus never checked (the run stopped first) has relationships that were never attempted; their number is known only from a check, so the
  // report names the syllabi instead (notStarted).
  const notStarted = () => list.filter(s => !results.some(r => r.name === s.name)).map(s => s.label);
  // A syllabus never checked counts as relationships never attempted: incomplete, before the unresolved rate (as in completionOf).
  const metricsNow = () => tracker.metrics(), completionNow = () => {
    const c = completionOf(metricsNow(), { maxUnresolved, stopped: stopped || guard.stopped() }), never = notStarted();
    return never.length && ['complete', 'unresolved_above_limit'].includes(c.state) ? { ...c, state: 'incomplete', usableForAgreement: false, reason: `${never.length} syllabus(es) were never checked (${never.join(', ')})${c.state === 'unresolved_above_limit' ? `; ${c.reason}` : ''}` } : c;
  };
  const schemaNow = () => { const empty = guard.httpLog.filter(e => e.kind === 'model' && /^empty_answer/.test(e.invalid || '')).length; return { minItems, emptyAnswers: empty, minItemsNotEnforced: minItems && empty > 0 }; };
  // Stage S7: legacy is one of the settings two runs must share to be compared (eval/providerDrift.js); a Claude report says it is evaluation only and
  // which configuration it asked with.
  const claudeReport = () => (claude ? { evaluationOnly: true, modelsReturned: guard.summary().anthropic.modelsReturned, configuration: { anthropic: { model: config.model, thinking: claudeOptions.thinking, thinkingParameter: claudeRequest.thinking, effort: claudeRequest.effort, maxTokens: claudeOptions.maxTokens, timeoutSec: claudeOptions.timeoutSec, maxRetries: claudeOptions.maxRetries, promptCache: true } }, prices: guard.state.prices } : {});
  const report = () => ({ generated: new Date().toISOString(), provider: config.provider, model: config.model, promptVersion: gemini.promptVersionOf(config.model, env), prompt: has('trim') ? 'trimmed' : 'full', legacy, ...claudeReport(), limits: { budget, maxCost, maxTransient, maxUnproductive, maxUnresolved, minSample, warnInvalid, maxInvalid: maxInvalid === Infinity ? null : maxInvalid, accounting, sequential: true, ...(claude ? { totalCap: register.cap, maxOutputTokens: claudeOptions.maxOutputTokens } : {}) }, usage: guard.summary(), stopped: stopped || guard.stopped(), relationshipMetrics: metricsNow(), completion: completionNow(), notStarted: notStarted(), schema: schemaNow(), results, isolation: { dataModulesLoaded: loadedDataModules() }, note: 'Expectations are the assistant\'s synthetic ones, not faculty judgements. A syllabus with stoppedDuring was checked only in part. Relationships that were never attempted are not evaluated.' });
  const save = () => { if (out) fs.writeFileSync(out, JSON.stringify(report(), null, 1)); }; // after every syllabus, so a stop keeps what completed
  for (const s of list) {
    if (guard.stopped()) break;
    const started = Date.now(), firstEntry = guard.httpLog.length;
    let result = null, failed = null;
    try { result = await run(structuredClone(s.content), s.masters, { useAi: true, env, transport: guard.fetch, linkChecker: async url => ({ url, status: 'not_checked' }), ...(claude ? { evaluationOnly: true } : {}) }); }
    catch (error) { failed = error; }
    // The relationships of this syllabus, from what the engine judged and what the guard sent (also when the check failed).
    const own = createTracker(), entries = guard.httpLog.slice(firstEntry).filter(e => e.kind === 'model');
    const plan = trackSyllabus([tracker, own], s, result, entries), mine = own.metrics();
    const relationships = { ...plan, attempted: mine.attempted, neverAttempted: mine.neverAttempted, verified: mine.verified, recovered: mine.recovered, unresolved: mine.unresolved, unresolvedRate: mine.unresolvedRate, firstAttempt: mine.firstAttempt, rawResponseErrors: mine.rawResponseErrors };
    if (failed) { results.push({ name: s.name, syllabus: s.label, error: guard.redact(failed.message).slice(0, 300), relationships, stoppedDuring: guard.stopped() }); stopped = `the check of ${s.label} failed: ${guard.redact(failed.message).slice(0, 120)}`; save(); break; }
    const J = result.hybrid.alignment.judgements || [];
    const contradictions = contradictionsOf(result, s.content);
    const entry = { name: s.name, syllabus: s.label, seconds: Math.round((Date.now() - started) / 1000), alignment: result.hybrid.alignment.status, failure: result.hybrid.alignment.failure || null, verdict: { overall: result.hybrid.verdict.overall, counts: result.hybrid.verdict.counts, states: result.hybrid.verdict.states, ...(result.hybrid.verdict.aspectCoverage ? { aspectCoverage: result.hybrid.verdict.aspectCoverage } : {}) }, official: { score: result.score, passed: result.passed, ready: result.hybrid.ready }, officialDetail: officialOf(result), relationships, contradictions, ...(s.planted.length || s.aligned ? { expectations: scoreOf(s, result) } : {}) };
    if (guard.stopped()) entry.stoppedDuring = guard.stopped(); // the guard stopped while this syllabus was checked: its result is partial
    results.push(entry);
    save();
    console.log(`${s.label}: ${entry.alignment}, ${J.length} answers; relationships ${mine.verified} of ${relationships.planned} verified, ${mine.unresolved} unresolved of ${mine.attempted} attempted, ${mine.neverAttempted} never attempted; contradictions ${contradictions.length}${entry.expectations ? `, planted found ${entry.expectations.plantedFound}/${entry.expectations.planted.length}, flags in untouched parts ${entry.expectations.untouchedFlagged}/${entry.expectations.untouchedJudged}` : ''}${entry.stoppedDuring ? ' (PARTIAL: the run stopped during this syllabus)' : ''}`);
    if (contradictions.length) { stopped = 'a contradiction between recommendations was found'; break; }
    const academic = academicStopOf(metricsNow(), { maxUnresolved, minSample });
    if (academic) { stopped = `academic stop: ${academic}`; break; }
  }
  stopped = stopped || guard.stopped();
  save();
  const u = guard.summary(), m = metricsNow(), c = completionNow();
  console.log(describeMetrics(m));
  console.log(`completion: ${c.state} (${c.reason}); usable for agreement: ${c.usableForAgreement ? 'yes' : 'no'}${notStarted().length ? `; never checked: ${notStarted().join(', ')}` : ''}`);
  if (minItems) { const sc = schemaNow(); console.log(`schema: minItems 1 sent; empty answers ${sc.emptyAnswers}${sc.minItemsNotEnforced ? ' (minItems was NOT enforced by the provider)' : ''}`); }
  for (const warning of u.warnings) console.log(`WARNING: ${warning}`);
  console.log(`requests ${u.requests}/${budget} (${u.model} to the model this run); tokens in ${u.promptTokens} (cached ${u.cachedTokens}), out ${u.completionTokens}; ${claude ? '' : `reported cost $${u.reportedCost}; `}charged against the cap $${u.charged} of $${maxCost} (accounting ${u.accounting.rule}; the conservative rule would have charged $${u.accounting.chargedConservatively})${stopped ? `; STOPPED: ${stopped}` : ''}`);
  if (claude) console.log(describeClaudeUsage(u.anthropic));
  if (out) console.log('wrote ' + out);
})().catch(error => { console.error(redactKeys(error && error.stack || error)); process.exit(1); });
