'use strict';
// Re-planned AI Checker, Phase 3: SHADOW MODE. The server's normal check runs exactly as before; when switched on, the re-planned pipeline also checks
// the same syllabus and its result is attached to the report as hybrid.replanShadow, for comparison only. It never changes a finding, deduction,
// score, suggestion, gate or status, and a failure of it never disrupts the check (compliance/service.js catches it).
//
//   SYLLABUS_CHECK_REPLAN                 off (default) | shadow (check only) | plan (check + repair plan, display only)
//   SYLLABUS_CHECK_REPLAN_MAX_COST_USD    REQUIRED when on: the shadow's own cost cap per check, apart from the normal check's budget
//   SYLLABUS_CHECK_REPLAN_MAX_REQUESTS    default 60
// Only the direct Anthropic provider is used (SYLLABUS_CHECK_AI_PROVIDER=anthropic). Answers are kept in memory per process (bounded), so a re-check
// of the same text asks nothing again; nothing is written to the database.
const { check } = require('./check');
const { buildPlan } = require('./plan');
const { claudeProvider } = require('./provider');
const R = require('./rules');

const MODES = ['off', 'shadow', 'plan'];
const modeOf = (env = process.env) => { const m = String(env.SYLLABUS_CHECK_REPLAN || 'off').trim().toLowerCase(); return MODES.includes(m) ? m : 'off'; };
const enabled = (env = process.env) => modeOf(env) !== 'off';

// Answers: a bounded memory store shared by the checks of this process, in front of the database table replan_answers when the caller passes
// `db` (answerStore.js), so a re-check of unchanged text gives the same answers even after a server restart. Without the table the shadow still
// runs, from memory, and says so (usage.store).
const { memoryStore, dbAnswerStore, layeredStore } = require('./answerStore');
const boundedStore = memoryStore;
const sharedStore = memoryStore();
const storeFor = db => (db ? layeredStore(sharedStore, dbAnswerStore(db)) : sharedStore);

// One AI result as stored in the shadow attachment: what was judged, against what, and why.
const itemOf = r => ({ source: 'ai', rule: r.relationship, label: r.label, against: (r.to || []).map(t => t.label).join(', '), status: r.status, verdict: r.verdict, message: r.explanation || r.reason || null });

const countBy = (list, key) => list.reduce((acc, x) => ({ ...acc, [x[key]]: (acc[x[key]] || 0) + 1 }), {});

// Run the shadow for one check. Returns the attachment, or { skipped: reason } when it cannot run (it never throws for a configuration problem).
// officialResult: the normal check's result, for the side-by-side numbers. db: the server's database (answers kept in replan_answers).
// opts.transport (an evaluation guard), opts.store and opts.provider (tests).
async function runShadow({ content, masters, officialResult, env = process.env, transport, db, store = storeFor(db), provider } = {}) {
  const mode = modeOf(env);
  if (mode === 'off') return null;
  const startedAt = Date.now();
  if (!provider) {
    if (String(env.SYLLABUS_CHECK_AI_PROVIDER || '').trim().toLowerCase() !== 'anthropic') return { mode, skipped: 'the re-planned checker runs on the direct Anthropic provider only (SYLLABUS_CHECK_AI_PROVIDER=anthropic)' };
    const cap = Number.parseFloat(env.SYLLABUS_CHECK_REPLAN_MAX_COST_USD);
    const maxRequests = Number.parseInt(env.SYLLABUS_CHECK_REPLAN_MAX_REQUESTS, 10);
    provider = claudeProvider({ env, transport, maxCostUsd: cap, maxRequests: Number.isInteger(maxRequests) && maxRequests > 0 && maxRequests <= 300 ? maxRequests : 60 });
    if (!provider.ready) return { mode, skipped: provider.reason.replace('a cost cap (maxCostUsd > 0)', 'SYLLABUS_CHECK_REPLAN_MAX_COST_USD') };
  }
  const opts = { ask: provider.ask, store, model: provider.model };
  const result = await check(content, masters, opts);
  const plan = mode === 'plan' ? await buildPlan(content, masters, { ...opts, rewrite: provider.rewrite }) : null;
  const official = officialResult?.hybrid || {};
  return {
    mode, versions: { rules: R.VERSION, prompt: result.judged.promptVersion },
    note: 'Comparison only: the official findings, score and suggestions above are unchanged.',
    summary: result.summary,
    byRule: countBy(result.misalignments, 'rule'),
    misalignments: result.misalignments.slice(0, 200),
    // What went to faculty review (an extra tag beside one that fits; a fixed rule a person must confirm) and what was not checked (no valid
    // answer, or "unclear"), so the comparison can show every item that is neither aligned nor a misalignment.
    review: [
      ...result.judged.results.filter(r => r.status === 'review').map(itemOf),
      ...result.fixed.findings.filter(f => f.severity === 'review').map(f => ({ source: 'rule', rule: f.rule, where: f.where, message: f.message })),
    ].slice(0, 200),
    notChecked: result.judged.results.filter(r => r.status === 'not_checked').map(itemOf).slice(0, 200),
    advice: result.judged.results.filter(r => r.status === 'advice').map(itemOf).slice(0, 200),
    usage: { ...result.judged.usage, provider: provider.usage ? provider.usage() : null, store: typeof store.status === 'function' ? store.status() : { kind: 'map' }, ms: Date.now() - startedAt },
    official: { score: officialResult?.score ?? null, deductions: Array.isArray(official.deductions) ? official.deductions.length : null, suggestions: Array.isArray(official.suggestions) ? official.suggestions.length : null },
    ...(plan ? { plan: { clean: plan.clean, rounds: plan.rounds, changes: plan.changes.map(({ key, label, before, after, status, source }) => ({ key, label, before, after, status, source })), unresolved: plan.unresolved, manual: plan.manual, regressions: plan.regressions, adviceRegressions: plan.adviceRegressions, after: plan.after } } : {}),
  };
}

module.exports = { runShadow, enabled, modeOf, boundedStore, storeFor, MODES };
