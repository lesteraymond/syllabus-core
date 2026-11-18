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
const { uniqueIds } = require('./extract');
const { summarize } = require('../stewardship');
const { bindSuggestions } = require('../suggestions');

const PASS_THRESHOLD = require('../../compliance/standard-v4.json').passThreshold; // the same pass mark engine.js uses
const MODE = 'official';
const isOfficial = (env = process.env) => String(env.SYLLABUS_CHECK_REPLAN || '').trim().toLowerCase() === MODE;
// Is an AI provider set at all (anything but off)? With one set and the new checker not ready, an AI check says why (compliance/service.js).
const aiProviderOn = (env = process.env) => !['', 'off', 'none', 'false', '0'].includes(String(env.SYLLABUS_CHECK_AI_PROVIDER || '').trim().toLowerCase());

// The largest per-check cap accepted: the same ceiling aiQuota.js checks at startup. A typo such as 2000 must not let one check
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
// A mechanical fix of the plan (plan.js): a CLO's fixed classification, or an APA 7 repair built from the reference's own characters. Offered as a rule
// recommendation the author applies (src/lib/hybridCheck.js applySuggestion accepts these two paths); never rewritten by the AI, never "Check & improve".
const MECHANICAL = /^(?:clos\[\d+\]\.level|refs\.[a-z]+\.items\[\d+\]\.t)$/;
const ruleIdOf = f => `RULE:${f.rule}:${JSON.stringify(f.where || {})}`;
// the rule finding a mechanical change answers
const mechanicalFindingKey = f => (f.rule === 'CLO-LEVEL-LABEL' && f.where?.cloId ? `clolevel:${f.where.cloId}` : f.rule === 'REF-APA' && f.where?.ref ? `ref:${f.where.group}:${f.where.ref}` : null);

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
    const id = ruleIdOf(f);
    if (key) ruleIdsByField.set(key, [...(ruleIdsByField.get(key) || []), 'SEM:' + id]);
    judgements.push({ id, type, path: pathOf(content, key), label: f.severity === 'finding' ? 'PARTIALLY_ALIGNED' : 'ALIGNED', explanation: f.message, status: f.severity === 'finding' ? 'rule' : 'rule_review' });
  }
  // drafts from the verified repair plan
  const suggestions = [];
  for (const c of plan ? plan.changes : []) {
    if (c.source === 'mechanical') {
      // before: skipped, so a ready fix (CPE 101 #461: CLO 4 "Introductory" -> "Integration of Values") never reached the author
      const path = pathOf(content, c.key);
      if (!path || !MECHANICAL.test(path) || typeof c.after !== 'string') continue;
      const basedOn = result.fixed.findings.filter(f => mechanicalFindingKey(f) === c.key).map(f => 'SEM:' + ruleIdOf(f));
      suggestions.push({
        id: 'RP:' + c.key, path, title: c.field === 'cloLevel' ? 'Use the fixed CLO classification' : 'Corrected APA 7 reference',
        text: c.explanation || 'A fix built by the rules.', replacement: c.after, source: 'rule', basedOn, tier: 'mandatory', attempt: 1, verification: c.status,
      });
      continue;
    }
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
// The text of a field by its app path, shortened, so an item the author must fix says WHICH source, outcome or week it is (the page has no syllabus text).
const excerptAt = (content, path) => {
  const value = String(path || '').replace(/\[(\d+)\]/g, '.$1').split('.').reduce((o, k) => (o == null ? undefined : o[k]), content);
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return text ? (text.length > 160 ? text.slice(0, 157) + '...' : text) : null;
};
function unresolvedOf(content, result, plan, drafted) {
  if (!plan) return [];
  // the same rule as judge.js: a manual relationship (CLO-EVIDENCE) does not make its CLO a field the others wait for
  const failingKeys = new Set(result.misalignments.filter(m => !(m.source === 'ai' && R.isManual(m.rule))).map(m => m.fieldKey || (m.source === 'rule' ? fieldKeyOfFinding({ rule: m.rule, where: m.where }) : null)).filter(Boolean));
  const out = [];
  for (const u of plan.unresolved || []) {
    const path = pathOf(content, u.key);
    if (!path || drafted.has(path) || out.some(x => x.path === path)) continue;
    const own = result.judged.results.filter(r => r.fieldKey === u.key && r.status !== 'ok');
    const waitsFor = [...new Set(own.flatMap(r => r.parents || []))].filter(k => k !== u.key && failingKeys.has(k)).map(k => pathOf(content, k)).filter(Boolean);
    const worst = [...own].sort((a, b) => (R.DEDUCTION[b.verdict] || 0) - (R.DEDUCTION[a.verdict] || 0))[0];
    // Why there is no draft: it waits for a field above it; it is the author's to fix (a manual relationship such as CLO-EVIDENCE, or a reference, which the
    // AI never rewrites: plan.js says "for the faculty: ..."); or no verified rewrite was found in this check. Before, the last two were reported as
    // draft_needs_review, which the page reads as "a static review found copied wording in the proposed rewrite" (CPE 101 #461).
    const faculty = /^for the faculty: /.exec(u.reason || '');
    const reason = waitsFor.length ? 'waits_for_upstream' : faculty ? 'faculty_fix' : 'no_verified_rewrite';
    out.push({
      path, excerpt: excerptAt(content, path), reason, status: waitsFor.length ? 'WAITING' : 'NEEDS_REVIEW', tier: 'material',
      attempts: 0, label: worst ? worst.verdict : null, relationships: own.map(r => 'SEM:' + r.id), explanation: String(worst?.explanation || u.reason || '').slice(0, 500),
      detail: faculty ? u.reason.slice(faculty[0].length) : u.reason || null, ...(waitsFor.length ? { waitsFor } : {}), source: 're-planned',
    });
  }
  // The rule findings only the author can fix (plan.js AUTHOR_RULES: Week 1 orientation, an APA reference it could not repair, ...). They were only in
  // hybrid.replan.plan.manual, which the page never shows.
  for (const m of plan.manual || []) {
    const w = m.where || {};
    const key = fieldKeyOfFinding({ rule: m.rule, where: w }) || (w.ref ? `ref:${w.group}:${w.ref}` : w.ilo ? `ilo:${w.ilo}` : w.cloId ? `clo:${w.cloId}` : w.row ? `content:${w.row}` : null);
    const path = pathOf(content, key);
    if (!path || drafted.has(path) || out.some(x => x.path === path && x.reason === 'faculty_fix')) continue;
    out.push({ path, excerpt: excerptAt(content, path), reason: 'faculty_fix', status: 'NEEDS_REVIEW', tier: 'material', attempts: 0, label: null, relationships: ['SEM:' + ruleIdOf(m)], rule: m.rule,
      explanation: String(m.message || '').slice(0, 500), detail: m.message || null, source: 're-planned' });
  }
  return out;
}

// Why a check is incomplete: only the questions that got NO valid answer (a refused, failed or rejected request). An "unclear" answer is a valid answer
// (not checked, no points) and never makes a check incomplete, so it is not counted here; before, it was, and "3 questions had no valid answer" could
// mean one. The first few are named, so the author can see what blocks the score.
function incompleteReason(result) {
  const missing = result.judged.results.filter(r => r.reason);
  const named = missing.slice(0, 3).map(r => `${r.label} (${r.relationship}): ${String(r.reason).slice(0, 80)}`).join('; ');
  return `${missing.length} question${missing.length === 1 ? '' : 's'} of the new AI Checker had no valid answer${named ? ': ' + named + (missing.length > 3 ? '; …' : '') : ''}. Run the check again.`;
}

// Fill the AI part of an old-engine report made with AI off (`noAi`) from the new checker. Returns the same report object, changed.
// `out` (optional): receives { result, plan } (the check and the plan this call made), so a caller can re-check with the same plan without building it again.
// `concurrency` (optional, 1-6): requests in flight at once (default 3, judge.js). A test run under a tight cap passes 1, so the worst cases reserved
// for requests in flight do not crowd out the budget.
async function officialize({ noAi, content, masters, env = process.env, db, transport, store, provider, year, out, concurrency } = {}) {
  const startedAt = Date.now();
  // A working copy with unique item ids (extract.js uniqueIds): the report's paths are by position, so they hold for the saved syllabus too.
  content = uniqueIds(content);
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
    status: complete ? 'completed' : 'not_evaluated', reason: complete ? null : incompleteReason(result),
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

module.exports = { isOfficial, aiProviderOn, readiness, maxRequestsOf, officialize, officialParts, unresolvedOf, pathOf, keyOfPath, APPLYABLE, MODE, MAX_CAP_USD };
