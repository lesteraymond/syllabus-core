'use strict';
// Re-planned AI Checker as the OFFICIAL AI check (SYLLABUS_CHECK_REPLAN=official; owner decision 2026-11-15). Switching back is one setting.
//
// The old engine still runs, but with its AI step off: it supplies the no-AI rules, the base score, the reference links and every other part of
// the report exactly as today, with no AI cost. This module then fills the AI part of the same report from the new checker:
//   hybrid.alignment    the new checker's answers, in the shape the app already shows (judgements with type, path, label, explanation, quote)
//   hybrid.deductions   the old engine's no-AI deductions, plus the new checker's points (-1 partial, -3 not aligned; at most 5 per area)
//   hybrid.suggestions  the old engine's no-AI suggestions, plus the new checker's verified repair plan as drafts the author can accept, edit or
//                       reject with the existing buttons (path + replacement; the builder applies them, nothing is saved here)
//   score, ready, status, passed, band, conformance, summary: recomputed from the above
//   hybrid.replan       the new checker's own view (versions, review items, unchecked items, advice, plan, usage, where answers are kept)
// Items that cost no points (an extra tag that does not fit beside one that does, advice, the new checker's no-AI rules) are shown as advisory.
// A failure of the new checker never makes a score: the report is then the no-AI report, marked incomplete, with the reason.
const R = require('./rules');
const P = require('./prompt');
const { check } = require('./check');
const { buildPlan } = require('./plan');
const { claudeProvider } = require('./provider');
const { fieldKeyOfFinding } = require('./judge');
const { summarize } = require('../stewardship');
const { bindSuggestions } = require('../suggestions');

const PASS_THRESHOLD = require('../../compliance/standard-v4.json').passThreshold; // the same pass mark engine.js uses
const MODE = 'official';
const isOfficial = (env = process.env) => String(env.SYLLABUS_CHECK_REPLAN || '').trim().toLowerCase() === MODE;

// The largest per-check cap accepted: the same ceiling aiQuota.js puts on SYLLABUS_CHECK_AI_MAX_COST_USD. A typo such as 2000 must not let one check
// spend that much; the old checker then runs instead and the reason says why.
const MAX_CAP_USD = 1000;
// Can the new checker make the official AI check under these settings? When it cannot, the old checker runs as before.
function readiness(env = process.env) {
  if (!isOfficial(env)) return { ok: false, reason: 'SYLLABUS_CHECK_REPLAN is not official' };
  if (String(env.SYLLABUS_CHECK_AI_PROVIDER || '').trim().toLowerCase() !== 'anthropic') return { ok: false, reason: 'AI checking is off, or the provider is not the direct Anthropic provider' };
  const cap = Number.parseFloat(env.SYLLABUS_CHECK_REPLAN_MAX_COST_USD);
  if (!(Number.isFinite(cap) && cap > 0)) return { ok: false, reason: 'SYLLABUS_CHECK_REPLAN_MAX_COST_USD is required' };
  if (cap > MAX_CAP_USD) return { ok: false, reason: `SYLLABUS_CHECK_REPLAN_MAX_COST_USD must be at most ${MAX_CAP_USD}` };
  return { ok: true, cap };
}
// Requests one official check may send (SYLLABUS_CHECK_REPLAN_MAX_REQUESTS, 1-300; default 80). A value outside that range, such as "-5" or "abc",
// falls back to the default instead of refusing every request (which made the check incomplete) or lifting the limit.
const DEFAULT_MAX_REQUESTS = 80;
function maxRequestsOf(env = process.env, fallback = DEFAULT_MAX_REQUESTS) {
  const raw = String(env.SYLLABUS_CHECK_REPLAN_MAX_REQUESTS ?? '').trim();
  const n = Number(raw);
  return raw && Number.isInteger(n) && n >= 1 && n <= 300 ? n : fallback;
}

// ---- where a field lives in the content JSON (the app's paths) ----
function pathOf(content, key) {
  if (!key) return null;
  const [kind, a, b] = String(key).split(':');
  const plan = content.plan || [], clos = content.clos || [];
  const rowIndex = id => plan.findIndex(r => r.id === id);
  if (kind === 'clo') { const i = clos.findIndex(c => c.id === a); return i >= 0 ? `clos[${i}].statement` : null; }
  if (kind === 'clolevel') { const i = clos.findIndex(c => c.id === a); return i >= 0 ? `clos[${i}].level` : null; }
  if (kind === 'ilo') { for (let r = 0; r < plan.length; r++) { const k = (plan[r].ilos || []).findIndex(x => x.id === a); if (k >= 0) return `plan[${r}].ilos[${k}].text`; } return null; }
  if (kind === 'content') { const r = rowIndex(a); return r >= 0 ? `plan[${r}].contents` : null; }
  if (['activities', 'tasks', 'values'].includes(kind)) { const r = rowIndex(a); return r >= 0 ? `plan[${r}].${kind}` : null; }
  if (kind === 'ref') { const i = (content.refs?.[a]?.items || []).findIndex(x => x.id === b); return i >= 0 ? `refs.${a}.items[${i}].t` : null; }
  return null;
}
// The reverse of pathOf: the field key of an app path, or null. Only the text fields a draft can target (APPLYABLE below).
function keyOfPath(content, path) {
  const p = String(path || '');
  let m = /^clos\[(\d+)\]\.statement$/.exec(p);
  if (m) { const clo = (content.clos || [])[Number(m[1])]; return clo && clo.id ? `clo:${clo.id}` : null; }
  m = /^plan\[(\d+)\]\.ilos\[(\d+)\]\.text$/.exec(p);
  if (m) { const ilo = ((content.plan || [])[Number(m[1])]?.ilos || [])[Number(m[2])]; return ilo && ilo.id ? `ilo:${ilo.id}` : null; }
  m = /^plan\[(\d+)\]\.(contents|activities|tasks|values)$/.exec(p);
  if (m) { const row = (content.plan || [])[Number(m[1])]; return row && row.id ? `${m[2] === 'contents' ? 'content' : m[2]}:${row.id}` : null; }
  return null;
}
// The builder can apply a draft only to these text fields (the same list as src/lib/hybridView.js canRefine).
const APPLYABLE = /^(?:clos\[\d+\]\.statement|plan\[\d+\]\.(?:values|contents|activities|tasks)|plan\[\d+\]\.ilos\[\d+\]\.text)$/;

const REVIEW_SUFFIX = ' (extra tag)';
const NOT_CHECKED_SUFFIX = ' (not checked)';
const RULE_PREFIX = 'Rule ';

// The new checker's results and plan -> the parts of the official report.
function officialParts(content, result, plan) {
  const judgements = [], deductions = [], advisoryTypes = new Set();
  // AI results
  for (const r of result.judged.results) {
    // an unanswered question ("unclear", or no valid answer) is not a problem in the syllabus and costs nothing: shown as advisory, never "fix first"
    const type = r.status === 'review' ? r.relationship + REVIEW_SUFFIX : r.status === 'not_checked' ? r.relationship + NOT_CHECKED_SUFFIX : r.relationship;
    if (r.status === 'review' || r.status === 'not_checked' || !r.scored) advisoryTypes.add(type);
    judgements.push({
      id: r.id, type, path: pathOf(content, r.fieldKey), label: r.verdict, explanation: r.explanation || r.reason || null,
      sourceQuote: r.quote || null, targetQuote: null, status: r.status, against: (r.to || []).map(t => t.label).join(', '),
      // what the coverage reports read (ruleCoverage.js): whether the question was really put to the model, or answered from the store
      attempted: !r.reason, reused: !!r.reused,
      ...(r.status === 'not_checked' ? { unverified: true, ...(String(r.reason || '').startsWith('provider failed') ? { failureKind: 'provider_error' } : {}) } : {}),
    });
  }
  // points, at most AREA_CAPS per area, in the order the results come (top-down)
  const used = Object.fromEntries(R.AREAS.map(a => [a, 0]));
  for (const r of result.judged.results) {
    if (!(r.status === 'failing' || r.status === 'waiting') || !r.scored) continue;
    const full = R.DEDUCTION[r.verdict] || 0, cap = R.AREA_CAPS[r.area];
    const points = Number.isFinite(cap) ? Math.max(0, Math.min(full, cap - used[r.area])) : full;
    used[r.area] += points;
    deductions.push({ id: 'SEM:' + r.id, points, ...(points < full ? { capped: true, uncappedPoints: full } : {}), kind: 'alignment', area: r.area, path: pathOf(content, r.fieldKey),
      reason: `${r.relationship}${r.label ? ' · ' + r.label : ''}: ${r.verdict === 'NOT_ALIGNED' ? 'not aligned' : 'partly aligned'}${points < full ? ` (area cap of ${cap} points reached)` : ''}` });
  }
  // the new checker's no-AI rules: shown as advisory problems, no points (the old engine's own rules keep their points)
  const ruleIdsByField = new Map();
  for (const f of result.fixed.findings) {
    const type = RULE_PREFIX + f.rule;
    advisoryTypes.add(type);
    const key = fieldKeyOfFinding(f) || (f.where?.cloId ? 'clo:' + f.where.cloId : f.where?.ref ? `ref:${f.where.group}:${f.where.ref}` : null);
    const id = `RULE:${f.rule}:${JSON.stringify(f.where || {})}`;
    if (key) ruleIdsByField.set(key, [...(ruleIdsByField.get(key) || []), 'SEM:' + id]);
    judgements.push({ id, type, path: pathOf(content, key), label: f.severity === 'finding' ? 'PARTIALLY_ALIGNED' : 'ALIGNED', explanation: f.message, status: f.severity === 'finding' ? 'rule' : 'rule_review' });
  }
  // drafts from the verified repair plan
  const suggestions = [];
  for (const c of plan ? plan.changes : []) {
    if (c.source !== 'ai') continue;
    const path = pathOf(content, c.key);
    if (!path || !APPLYABLE.test(path)) continue;
    // a manual relationship (CLO-EVIDENCE) is not fixed by rewriting this field, so a draft never claims to fix it
    const basedOn = [...result.judged.results.filter(r => r.fieldKey === c.key && r.status !== 'ok' && !R.isManual(r.relationship)).map(r => 'SEM:' + r.id), ...(ruleIdsByField.get(c.key) || [])];
    suggestions.push({
      id: 'RP:' + c.key, path, title: c.status === 'VERIFIED' ? 'Suggested alignment revision' : 'Suggested alignment revision (needs faculty review)',
      text: c.explanation || 'A rewrite that satisfies every relationship of this field.', replacement: c.after, source: 'ai', basedOn,
      tier: 'material', attempt: 1, verification: c.status,
    });
  }
  return { judgements, deductions, advisoryTypes: [...advisoryTypes], suggestions: bindSuggestions(content, suggestions), used };
}

// The plan's unresolved fields, in the shape the app's list reads (engine.js `unresolved`; HybridCheckPanel shows reason 'waits_for_upstream' with
// waitsFor). A field waits when one of the fields it depends on still has a misalignment of its own; otherwise it needs a person (draft_needs_review).
function unresolvedOf(content, result, plan, drafted) {
  if (!plan) return [];
  const failingKeys = new Set(result.misalignments.map(m => m.fieldKey || (m.source === 'rule' ? fieldKeyOfFinding({ rule: m.rule, where: m.where }) : null)).filter(Boolean));
  const out = [];
  for (const u of plan.unresolved || []) {
    const path = pathOf(content, u.key);
    if (!path || drafted.has(path) || out.some(x => x.path === path)) continue;
    const own = result.judged.results.filter(r => r.fieldKey === u.key && r.status !== 'ok');
    const waitsFor = [...new Set(own.flatMap(r => r.parents || []))].filter(k => k !== u.key && failingKeys.has(k)).map(k => pathOf(content, k)).filter(Boolean);
    const worst = [...own].sort((a, b) => (R.DEDUCTION[b.verdict] || 0) - (R.DEDUCTION[a.verdict] || 0))[0];
    out.push({
      path, reason: waitsFor.length ? 'waits_for_upstream' : 'draft_needs_review', status: waitsFor.length ? 'WAITING' : 'NEEDS_REVIEW', tier: 'material',
      attempts: 0, label: worst ? worst.verdict : null, relationships: own.map(r => 'SEM:' + r.id), explanation: String(worst?.explanation || u.reason || '').slice(0, 500),
      detail: u.reason || null, ...(waitsFor.length ? { waitsFor } : {}), source: 're-planned',
    });
  }
  return out;
}

// Fill the AI part of an old-engine report made with AI off (`noAi`) from the new checker. Returns the same report object, changed.
// `out` (optional): receives { result, plan } (the check and the plan this call made), so a caller can re-check with the same plan without building it again.
// `concurrency` (optional, 1-6): requests in flight at once (default 3, judge.js). A test run under a tight cap passes 1, so the worst cases reserved
// for requests in flight do not crowd out the budget.
async function officialize({ noAi, content, masters, env = process.env, db, transport, store, provider, year, out, concurrency } = {}) {
  const startedAt = Date.now();
  const h = noAi.hybrid;
  if (!provider) {
    const ready = readiness(env);
    if (!ready.ok) throw Error(ready.reason);
    provider = claudeProvider({ env, transport, maxCostUsd: ready.cap, maxRequests: maxRequestsOf(env) });
    if (!provider.ready) throw Error(provider.reason);
  }
  if (!store) { const { storeFor } = require('./shadow'); store = storeFor(db); }
  // print every AI provider failure to the server console (the message only: never the key or the syllabus text)
  const ask = async (...args) => {
    try { return await provider.ask(...args); } catch (error) {
      console.error(`[ai-provider] request failed (${provider.model || 'unknown model'}): ${error?.kind || error?.name || 'Error'}: ${String(error?.message || error).slice(0, 300)}`);
      throw error;
    }
  };
  const opts = { ask, store, model: provider.model, year, ...(concurrency ? { concurrency } : {}) };
  const result = await check(content, masters, opts);
  const plan = result.summary.complete ? await buildPlan(content, masters, { ...opts, rewrite: provider.rewrite }) : null;
  if (out && typeof out === 'object') Object.assign(out, { result, plan });
  const parts = officialParts(content, result, plan);
  const complete = result.summary.complete;

  // findings: the old engine's, without its "AI must complete" block, which the new checker now answers
  const findings = noAi.findings.filter(f => f.ruleId !== 'AI-REQUIRED');
  if (!complete) console.error(`[ai-provider] alignment check incomplete: some relationships were not answered (${result.summary.reason || 'see earlier [ai-provider] lines'}).`);
  if (!complete) findings.push({ id: 'AI-REQUIRED:review', ruleId: 'AI-REQUIRED', path: 'review', step: 'review', area: 'assessment', severity: 'blocking', source: 'rule', message: 'AI alignment must complete before submission. Some questions could not be answered; run the check again.' });
  const failed = findings.filter(f => f.severity === 'blocking');
  const codedDeductions = (h.deductions || []).filter(d => d.kind !== 'alignment');
  const deductions = [...codedDeductions, ...parts.deductions];
  const points = deductions.reduce((s, d) => s + d.points, 0);
  const base = h.baseScore ?? noAi.baseScore ?? 0;
  const provisionalScore = h.critical ? 0 : Math.max(0, base - points);
  const ready = !failed.length && complete && !masters.synthetic;
  const score = h.critical ? 0 : ready ? provisionalScore : null;

  noAi.findings = findings;
  noAi.conformance = { ok: !failed.length, failed };
  Object.assign(noAi, { score, overall: score, status: score === null ? 'incomplete' : 'scored', passed: ready && score >= PASS_THRESHOLD, band: score === null ? null : score >= 90 ? 'Excellent' : score >= 79 ? 'Meets the standard' : 'Needs work' });
  h.alignment = {
    status: complete ? 'completed' : 'not_evaluated', reason: complete ? null : `${result.summary.notChecked} question(s) of the new AI Checker had no valid answer.`,
    provider: 'anthropic', model: String(provider.model || '').split('|')[0], promptVersion: P.PROMPT_VERSION, engine: 're-planned',
    judgements: parts.judgements, coverage: { total: result.judged.results.length, verified: result.judged.results.filter(r => r.status !== 'not_checked').length },
    usage: provider.usage ? provider.usage() : null,
  };
  h.deductions = deductions;
  h.suggestions = [...(h.suggestions || []).filter(s => s.source !== 'ai'), ...parts.suggestions];
  // Fields the plan could not fix in this check (waiting for a field above it, the round or request limit, or a rewrite it refused). They were only in
  // hybrid.replan before, so the app showed nothing for them; now they join the old engine's no-AI review items in the list the app reads.
  const unresolved = unresolvedOf(content, result, plan, new Set(parts.suggestions.map(s => s.path)));
  h.unresolved = [...(h.unresolved || []).filter(u => !unresolved.some(x => x.path === u.path)), ...unresolved];
  h.policy = { ...(h.policy || {}), advisoryTypes: [...new Set([...(h.policy?.advisoryTypes || []), ...parts.advisoryTypes])], areaCaps: R.AREA_CAPS };
  h.score = score; h.provisionalScore = provisionalScore; h.ready = ready;
  h.scoring = { ...(h.scoring || {}), official: { policy: `${R.VERSION}+caps${R.AREA_CAPS.ilo}`, deducted: points, score: provisionalScore } };
  h.summary = summarize({ findings, quality: h.quality, semanticCompleted: complete, missingValues: result.misalignments.length, unresolved: h.unresolved, corrections: [] });
  h.replan = {
    mode: MODE, versions: { rules: R.VERSION, prompt: P.PROMPT_VERSION }, summary: result.summary, areaPoints: parts.used,
    review: result.judged.results.filter(r => r.status === 'review').length, advice: result.judged.results.filter(r => r.status === 'advice').length,
    plan: plan ? { clean: plan.clean, rounds: plan.rounds, changes: plan.changes.length, unresolved: plan.unresolved, manual: plan.manual, regressions: plan.regressions } : null,
    usage: { ...result.judged.usage, provider: provider.usage ? provider.usage() : null, store: typeof store.status === 'function' ? store.status() : null, ms: Date.now() - startedAt },
  };
  return noAi;
}

module.exports = { isOfficial, readiness, maxRequestsOf, officialize, officialParts, unresolvedOf, pathOf, keyOfPath, APPLYABLE, MODE, MAX_CAP_USD };
