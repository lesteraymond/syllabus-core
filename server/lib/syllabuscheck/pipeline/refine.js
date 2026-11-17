'use strict';
// "Check & improve" for a draft of the re-planned AI Checker (SYLLABUS_CHECK_REPLAN=official). The old route sent every draft to the old checker
// (../refine.js, gemini.js align), and before that refused it, because the report's prompt version is the new checker's, not the old one's.
//
// This checks a draft, or the author's edit of it, with the NEW checker's own rules, prompt and stored answers:
//   1. check the syllabus as it is (answers already stored for these exact texts are reused, so this is usually free);
//   2. put the draft into a copy and check again: only the questions whose texts changed are asked;
//   3. the draft passes when its field is left with no misalignment of its own (AI or no-AI rule), no SCORED relationship that touches the field
//      got worse, and every touched question got an answer. An advice relationship that slips is listed but never blocks (the plan's rule, plan.js);
//   4. if it does not pass, ask the new checker's rewriter ONCE, with the same job the repair plan gives it (parents, failures, what to keep, siblings),
//      validate the reply (prompt.js validateRewrite) and check that the same way;
//   5. otherwise report what stands in the way. Nothing is applied or saved here; the AI never approves.
// The answer has the shape the app already reads from ../refine.js: { status, usedRewrite, text, stats, blockers, reason? }.
const R = require('./rules');
const P = require('./prompt');
const { check } = require('./check');
const { structure, jobOf, siblingsOf, misaligned, getField, setField } = require('./plan');
const { claudeProvider } = require('./provider');
const { fieldKeyOfFinding } = require('./judge');
const { readiness, keyOfPath, APPLYABLE } = require('./official');
const { isTrivialRewrite } = require('../stewardship');

const RANK = { ALIGNED: 0, PARTIALLY_ALIGNED: 1, NOT_ALIGNED: 2, INSUFFICIENT_EVIDENCE: 3 };
const MAX_BLOCKERS = 8;
const DEFAULT_CAP_USD = 0.5;
const DEFAULT_MAX_REQUESTS = 12;

const fail = (message, status) => Object.assign(new Error(message), { status });

// The refine budget: SYLLABUS_CHECK_REFINE_MAX_COST_USD when set (never above the check's own cap), else the smaller of $0.50 and that cap.
function refineLimits(env = process.env) {
  const ready = readiness(env);
  if (!ready.ok) return { ok: false, reason: ready.reason };
  const own = Number.parseFloat(env.SYLLABUS_CHECK_REFINE_MAX_COST_USD);
  const cap = Number.isFinite(own) && own > 0 ? Math.min(own, ready.cap) : Math.min(DEFAULT_CAP_USD, ready.cap);
  const raw = Number(String(env.SYLLABUS_CHECK_REFINE_MAX_REQUESTS ?? '').trim());
  const maxRequests = Number.isInteger(raw) && raw >= 1 && raw <= 60 ? raw : DEFAULT_MAX_REQUESTS;
  return { ok: true, cap, maxRequests };
}

// Does this result involve the field: it judges it, it is judged against it, or it depends on it?
const touches = (r, key) => r.fieldKey === key || (r.to || []).some(t => t.key === key) || (r.parents || []).includes(key);
const ruleFindingsOf = (result, key) => result.fixed.findings.filter(f => f.severity === 'finding' && fieldKeyOfFinding(f) === key);

// What happens to the relationships of the field when `candidate` is its text.
async function verify({ content, masters, key, candidate, before, opts }) {
  const patched = structuredClone(content);
  setField(patched, key, candidate);
  const after = await check(patched, masters, opts);
  const was = new Map(before.judged.results.map(r => [r.id, r]));
  const touched = after.judged.results.filter(r => touches(r, key));
  let improved = 0, worse = 0, same = 0, unverified = 0, points = 0, providerFailed = false;
  const worsened = [];
  for (const r of touched) {
    if (r.status === 'not_checked') { unverified++; if (String(r.reason || '').startsWith('provider failed') || /cap is reached/.test(String(r.reason || ''))) providerFailed = true; continue; }
    const b = was.get(r.id);
    if (!b || b.status === 'not_checked') { same++; continue; }
    if (r.scored) points += (R.DEDUCTION[r.verdict] || 0) - (R.DEDUCTION[b.verdict] || 0);
    if (RANK[r.verdict] < RANK[b.verdict]) improved++;
    else if (RANK[r.verdict] > RANK[b.verdict]) {
      if (r.scored) { worse++; worsened.push({ id: r.id, type: r.relationship, from: b.verdict, to: r.verdict, why: String(r.explanation || '').slice(0, 240) }); }
      else same++; // an advice relationship that slips never blocks (plan.js adviceRegressions)
    } else same++;
  }
  // a no-AI rule on the field's own text (one activity option, no core value, a copied ILO) that the candidate clears is an improvement too
  const rulesBefore = ruleFindingsOf(before, key), rulesAfter = ruleFindingsOf(after, key);
  improved += Math.max(0, rulesBefore.length - rulesAfter.length);
  // what is still wrong with the field itself after the change
  const left = [
    ...after.judged.results.filter(r => r.fieldKey === key && (r.status === 'failing' || r.status === 'waiting') && !R.isManual(r.relationship)).map(r => ({ id: r.id, type: r.relationship, from: was.get(r.id)?.verdict || r.verdict, to: r.verdict, why: String(r.explanation || '').slice(0, 240) })),
    ...rulesAfter.map(f => ({ id: `RULE:${f.rule}`, type: 'Rule ' + f.rule, from: 'PARTIALLY_ALIGNED', to: 'PARTIALLY_ALIGNED', why: String(f.message || '').slice(0, 240) })),
  ];
  const accepted = worse === 0 && unverified === 0 && !misaligned(after, key);
  return { accepted, providerFailed, stats: { checked: touched.length, improved, worse, same, unverified, points }, blockers: [...worsened, ...left.filter(l => !worsened.some(w => w.id === l.id))] };
}

// The rewrite job for the field, exactly as the repair plan builds it (plan.js jobOf + siblingsOf), from the syllabus as it is now.
function jobFor(content, before, key, text) {
  const meta = structure(before.map).info.get(key);
  if (!meta) return null;
  const failures = before.judged.results.filter(r => r.fieldKey === key && (r.status === 'failing' || r.status === 'waiting') && !R.isManual(r.relationship));
  const rules = ruleFindingsOf(before, key).map(f => f.message);
  return { ...jobOf({ key, ...meta, text, failures, rules }, before), siblings: siblingsOf(content, key) };
}

// opts: env, db, transport (the provider's), or provider + store (tests), year.
async function refineDraft({ content, masters, suggestion, env = process.env, db, transport, provider, store, year } = {}) {
  const path = suggestion && suggestion.path;
  if (!APPLYABLE.test(String(path)) || typeof suggestion.replacement !== 'string' || suggestion.source !== 'ai') throw fail('This recommendation cannot be checked and improved.', 400);
  const key = keyOfPath(content, path);
  if (!key) throw fail('The field of this recommendation is no longer in the syllabus. Run the check again.', 409);
  const current = getField(content, key);
  if (typeof current !== 'string' || current !== suggestion.originalValue) {
    throw fail(current === suggestion.replacement ? 'This recommendation is already applied.' : 'This field changed since the recommendation was written. Run the check again.', 409);
  }
  if (!provider) {
    const limits = refineLimits(env);
    if (!limits.ok) throw fail('The new AI Checker is not available on this server: ' + limits.reason, 503);
    provider = claudeProvider({ env, transport, maxCostUsd: limits.cap, maxRequests: limits.maxRequests });
    if (!provider.ready) throw fail('The new AI Checker is not available on this server: ' + provider.reason, 503);
  }
  if (!store) { const { storeFor } = require('./shadow'); store = storeFor(db); }
  const opts = { ask: provider.ask, store, model: provider.model, year, concurrency: 1 };

  const before = await check(content, masters, opts);
  const meaningful = text => typeof text === 'string' && !!text.trim() && !isTrivialRewrite(current, text).trivial;
  const noop = { accepted: false, providerFailed: false, stats: { checked: 0, improved: 0, worse: 0, same: 0, unverified: 0, points: 0 }, blockers: [] };

  const first = meaningful(suggestion.replacement) ? await verify({ content, masters, key, candidate: suggestion.replacement, before, opts }) : noop;
  if (first.accepted) return { status: 'verified', usedRewrite: false, text: suggestion.replacement, stats: first.stats, blockers: [], engine: 're-planned' };
  if (first.providerFailed) throw fail('The AI could not check this recommendation (no answer from the provider, or its cost cap was reached). Try again later.', 502);

  // one rewrite by the new checker's rewriter, from the author's edit when there is one
  let text = null;
  const job = jobFor(content, before, key, suggestion.userEdited ? suggestion.replacement : current);
  if (job && typeof provider.rewrite === 'function') {
    try {
      const out = P.validateRewrite(job, await provider.rewrite(P.rewriteMessage(job)));
      if (!out.rejected) text = out.text;
    } catch { text = null; }
  }
  const second = text && text !== suggestion.replacement && meaningful(text) ? await verify({ content, masters, key, candidate: text, before, opts }) : null;
  if (second && second.accepted) return { status: 'verified', usedRewrite: true, text, stats: second.stats, blockers: [], engine: 're-planned' };

  const best = second && second.stats.worse < first.stats.worse ? { ...second, text } : { ...first, text: suggestion.replacement };
  const unchanged = !meaningful(suggestion.replacement) && !meaningful(text);
  return { status: 'blocked', usedRewrite: false, text: best.text, stats: best.stats, blockers: best.blockers.slice(0, MAX_BLOCKERS), engine: 're-planned', ...(unchanged ? { reason: 'no_meaningful_change' } : {}) };
}

// A report the new checker made (official mode), so its drafts go to refineDraft and not to the old checker.
const isReplanned = report => report?.hybrid?.alignment?.engine === 're-planned';

module.exports = { refineDraft, refineLimits, isReplanned, verify };
