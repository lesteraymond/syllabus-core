'use strict';
// Whole-syllabus improvement plan: ONE set of changes for the whole syllabus that was checked together, so applying it does not move the
// conflicts to other fields.
//
// A normal check writes each recommendation for one relationship, against the CURRENT text of the other fields. This builds the plan in rounds,
// in memory, before anything is shown:
//   1. take the recommendations the check offers (with the top-down order of suggestionOrder.js these are the EARLIEST fields that need a change);
//   2. a field that several relationships flag at once (a CLO against its POs and EGAs, an activity against two ILOs), or that a first rewrite did
//      not fix, gets ONE rewrite written for all of its relationships together (refine.js rewrite);
//   3. put the rewrites into a copy of the syllabus and check the copy again. Only the relationships whose text changed are asked; every other
//      answer is reused. The fields after the changed ones are judged against the REVISED text, and their recommendations are written against it;
//   4. repeat until the check offers nothing more (or a round / budget limit is reached);
//   5. the last check of the copy is the verification of the whole package: each change says whether its field is now aligned, and the plan
//      says whether any relationship that was aligned got worse.
// Nothing is applied or saved here: the author reviews the plan and applies it (routes/syllabusCheck.js improvement-plan/apply). The AI never
// approves anything. Off by default because it makes extra AI requests: SYLLABUS_CHECK_WHOLE_PLAN=on. Its own request budget:
// SYLLABUS_CHECK_PLAN_MAX_REQUESTS (default 60: an 18-week syllabus needs several rounds), SYLLABUS_CHECK_PLAN_MAX_TOKENS, SYLLABUS_CHECK_PLAN_MAX_COST_USD; rounds: SYLLABUS_CHECK_PLAN_MAX_ROUNDS
// (default 8). Display only: the official result of the check (findings, points, score) is never changed by the plan.

const crypto = require('node:crypto');
const { contentHash } = require('../compliance/hash');
const refine = require('./refine');
const { createRequestBudget, courseOf } = require('./gemini');
const { layerOf, readsOf } = require('./suggestionOrder');

const VERSION = 'whole-plan-1';
const STATUS = { VERIFIED: 'VERIFIED', NEEDS_FACULTY_REVIEW: 'NEEDS_FACULTY_REVIEW', UNRESOLVED: 'UNRESOLVED', NOT_CHECKED: 'NOT_CHECKED' };
const MAX_ATTEMPTS = 2; // rewrites of one field inside one plan
const flag = (env, name) => String(env?.[name] ?? '').trim().toLowerCase();
const enabled = (env = process.env) => ['on', '1', 'true', 'yes'].includes(flag(env, 'SYLLABUS_CHECK_WHOLE_PLAN'));
const intOf = (value, low, high, fallback) => { const n = Number.parseInt(value, 10); return Number.isInteger(n) && n >= low && n <= high ? n : fallback; };

const FAILING = new Set(['PARTIALLY_ALIGNED', 'NOT_ALIGNED']);
const failing = j => FAILING.has(j.label) && !j.unverified;
const judgementsOf = r => r?.hybrid?.alignment?.judgements || [];
const planField = path => refine.FIELD.test(String(path)) || path === 'description';
const LAYER_TITLE = ['Course learning outcomes (CLO)', 'Lesson outcomes (ILO)', 'Course content', 'Learning activities', 'Assessment tasks', 'Values integration', 'Course description'];
const FIELD_NAME = ['clo', 'ilo', 'course_content', 'learning_activity', 'assessment_task', 'values', 'description'];

function reuseFrom(map, result) {
  for (const j of judgementsOf(result)) if (j.key && !j.unverified && j.label !== 'INSUFFICIENT_EVIDENCE') map.set(j.key, j);
  return map;
}
// The plan never changes the reference list, so the links checked by the check itself are used again instead of fetching them for every round.
function cachedLinkChecker(links) {
  const byUrl = new Map((links || []).filter(l => l && l.url).map(l => [l.url, l]));
  return async url => byUrl.get(url) || { url, status: 'unverifiable', reason: 'Not checked again while the improvement plan was built.' };
}
const sameText = (a, b) => JSON.stringify(typeof a === 'string' ? a.trim() : a) === JSON.stringify(typeof b === 'string' ? b.trim() : b);

// Does the check still ask for something on this field: an AI recommendation, a listed open field, or an alignment finding written against it.
function fieldOpen(result, path) {
  const h = result?.hybrid || {};
  return (h.suggestions || []).some(s => s.source === 'ai' && s.path === path)
    || (h.unresolved || []).some(u => u.path === path)
    || (result?.findings || []).some(f => f.ruleId === 'SEM' && (f.evidence?.targetPath || f.path) === path);
}

async function buildWholePlan({ content, masters, result, syllabusId = null, options = {}, run = null }) {
  const engineRun = run || require('./engine').run; // lazy: engine.js never needs this module, the service does
  const { VERSION: ENGINE_VERSION } = require('./engine');
  const env = options.env || process.env;
  const first = (result?.hybrid?.suggestions || []).filter(s => s.source === 'ai' && planField(s.path));
  if (!first.length || result?.hybrid?.alignment?.status !== 'completed') return null; // nothing to coordinate, or no verified check to start from

  const requestBudget = options.planBudget || createRequestBudget({
    ...env,
    SYLLABUS_CHECK_AI_MAX_REQUESTS: env.SYLLABUS_CHECK_PLAN_MAX_REQUESTS || '60',
    SYLLABUS_CHECK_AI_MAX_TOKENS: env.SYLLABUS_CHECK_PLAN_MAX_TOKENS || '800000',
    ...(env.SYLLABUS_CHECK_PLAN_MAX_COST_USD ? { SYLLABUS_CHECK_AI_MAX_COST_USD: env.SYLLABUS_CHECK_PLAN_MAX_COST_USD } : {}),
  });
  const maxRounds = intOf(env.SYLLABUS_CHECK_PLAN_MAX_ROUNDS, 1, 12, 8);
  const reuse = reuseFrom(new Map(options.reuse instanceof Map ? options.reuse : []), result);
  // A CLO is the faculty's official outcome: the plan rewrites it only when a relationship finds it clearly NOT_ALIGNED. A CLO that is only partly
  // aligned is kept as written (listed in preservations for the author), counted as settled, and the later fields are fitted to it.
  const kept = new Map();
  const settledHistory = () => ({ ...(options.history || {}), rejected: [...new Set([...(options.history?.rejected || []), ...kept.keys()])] });
  const runOptions = () => ({ ...options, requestBudget, reuse, history: settledHistory(), linkChecker: cachedLinkChecker(result.hybrid.links) });
  const aiOptions = { env, transport: options.transport, requestBudget, signal: options.signal };
  const declined = new Set(options.history?.rejected || []); // the author already kept these fields as written

  let candidate = content, current = result, rounds = 0, stop = null;
  const attempts = new Map(), changes = new Map();
  for (let round = 1; round <= maxRounds; round++) {
    let todo = (current.hybrid.suggestions || []).filter(s => s.source === 'ai' && planField(s.path) && !declined.has(s.path) && !kept.has(s.path) && (attempts.get(s.path) || 0) < MAX_ATTEMPTS);
    // Content first (VR-14; the owner's decision of 2026-11-12): the week's course content is the anchor. An ILO this plan rewrote that no longer fits its
    // week's content is re-fitted, with one rewrite written for all of its relationships (its CLO and its content together), and the content is never
    // rewritten to suit it. The same week's activities, tasks and values wait for the re-fitted ILO, so they are not written against a text about to change.
    const refit = judgementsOf(current).filter(j => j.type === 'ILO-content' && failing(j) && changes.has(j.path) && !declined.has(j.path) && !kept.has(j.path)
      && (attempts.get(j.path) || 0) < MAX_ATTEMPTS && !todo.some(s => s.path === j.path));
    if (refit.length) {
      const rows = new Set(refit.map(j => (/^plan\[(\d+)\]/.exec(j.path) || [])[1]).filter(Boolean));
      todo = todo.filter(s => !rows.has((/^plan\[(\d+)\]\.(?:activities|tasks|values)$/.exec(s.path) || [])[1]));
      for (const j of refit) todo.push({ id: `SEM:${j.id}`, path: j.path, source: 'ai', basedOn: [`SEM:${j.id}`], text: String(j.explanation || ''), replacement: undefined });
    }
    if (!todo.length) break;
    const byId = new Map(judgementsOf(current).map(j => [j.id, j]));
    let applied = 0, newlyKept = 0;
    for (const s of todo) {
      const before = refine.getValue(candidate, s.path);
      let value = s.replacement, combined = false;
      // Fix 3: one rewrite for every relationship of the field, when more than one flags it or the first rewrite did not fix it. A values
      // statement keeps the engine's draft, which is checked to keep the core value the faculty selected.
      const flaggedBy = judgementsOf(current).filter(j => failing(j) && j.targetPath === s.path);
      if (/^clos\[\d+\]\.statement$/.test(s.path) && !flaggedBy.some(j => j.label === 'NOT_ALIGNED')) {
        kept.set(s.path, { path: s.path, originalValue: before, reason: `Kept as written: this CLO is only partly aligned (${flaggedBy.map(j => j.type).join(', ') || 'no failing relationship'}), and the plan rewrites a CLO only when it is clearly not aligned. Review its wording yourself; the later fields are fitted to it as it is.`, relationships: flaggedBy.map(j => j.id) });
        newlyKept++;
        continue;
      }
      if (refine.FIELD.test(s.path) && !/\.values$/.test(s.path) && typeof before === 'string' && (flaggedBy.length > 1 || attempts.has(s.path))) {
        try {
          const requirements = refine.requirementsFor({ content: candidate, masters, path: s.path, baseline: judgementsOf(current) });
          value = await refine.rewrite({ path: s.path, current: before, requirements, course: courseOf(candidate), options: aiOptions });
          combined = true;
        } catch { value = s.replacement; combined = false; }
      }
      if (value === undefined || sameText(value, before)) continue;
      try { candidate = refine.setValue(candidate, s.path, value); } catch { continue; }
      attempts.set(s.path, (attempts.get(s.path) || 0) + 1);
      applied++;
      const driver = byId.get(String(s.id).replace(/^SEM:/, ''));
      const change = changes.get(s.path) || { path: s.path, originalValue: refine.getValue(content, s.path), sourceSuggestionId: round === 1 ? s.id : null, steps: [] };
      change.proposedValue = value;
      change.steps.push({ round, suggestionId: s.id, basedOn: s.basedOn || [s.id], combined, flaggedBy: flaggedBy.map(j => j.id), explanation: String(driver?.explanation || s.text || '').slice(0, 500) });
      changes.set(s.path, change);
    }
    if (!applied && !newlyKept) break;
    rounds = round;
    // The copy with this round's rewrites, checked again: only what changed is asked, and the next fields are judged against the revised text.
    current = await engineRun(candidate, masters, runOptions());
    reuseFrom(reuse, current);
    if (current.hybrid.alignment.status !== 'completed') { stop = 'verification_incomplete'; break; }
    if (round === maxRounds && (current.hybrid.suggestions || []).some(s => s.source === 'ai' && planField(s.path) && !declined.has(s.path) && !kept.has(s.path) && (attempts.get(s.path) || 0) < MAX_ATTEMPTS)) stop = 'round_limit';
  }
  // A field changed and then changed back is not a change.
  for (const [path, change] of changes) if (sameText(change.proposedValue, change.originalValue)) changes.delete(path);
  if (!changes.size) return null;

  // ---- Verification of the whole package: the last check of the copy ----
  const final = current;
  const originalKeys = new Set(judgementsOf(result).map(j => j.key).filter(Boolean));
  const was = new Map(judgementsOf(result).map(j => [j.id, j]));
  const regressions = judgementsOf(final).filter(j => failing(j) && was.get(j.id)?.label === 'ALIGNED')
    .map(j => ({ id: j.id, type: j.type, path: j.targetPath || j.path, from: 'ALIGNED', to: j.label, why: String(j.explanation || '').slice(0, 240) }));
  const touches = (j, path) => j.targetPath === path || j.path === path || readsOf(j, candidate).includes(path);
  // Required (coded) rules only: an AI answer that is missing is not a rule the revision broke (that is verification_incomplete).
  const ruleFailures = r => (r.conformance?.failed || []).filter(f => f.source === 'rule' && f.ruleId !== 'AI-REQUIRED').length;
  const blockingBefore = ruleFailures(result), blockingAfter = ruleFailures(final);
  const unresolvedIssues = [];
  if (stop === 'verification_incomplete') unresolvedIssues.push({ code: 'verification_incomplete', message: `The AI check of the revised syllabus did not complete (${String(final.hybrid.alignment.reason || 'no reason given').slice(0, 200)}), so these changes are not verified together.` });
  if (stop === 'round_limit') unresolvedIssues.push({ code: 'round_limit', message: `The plan stopped after ${maxRounds} rounds with recommendations still open; check again after applying it.` });
  if (blockingAfter > blockingBefore) unresolvedIssues.push({ code: 'deterministic_regression', message: `The revised syllabus fails ${blockingAfter - blockingBefore} more required rule(s) than the current one.` });
  for (const r of regressions) unresolvedIssues.push({ code: 'relationship_regressed', message: `${r.type} (${r.path}) was aligned and would become ${r.to}: ${r.why}` });

  const ordered = [...changes.values()].sort((a, b) => (layerOf(a.path) ?? 9) - (layerOf(b.path) ?? 9) || a.path.localeCompare(b.path, 'en', { numeric: true }));
  const planChanges = ordered.map((c, i) => {
    const layer = layerOf(c.path);
    const relationships = judgementsOf(final).filter(j => touches(j, c.path)).map(j => ({ id: j.id, type: j.type, label: j.label }));
    const regressed = regressions.some(r => { const j = judgementsOf(final).find(x => x.id === r.id); return j && touches(j, c.path); });
    const verification = stop === 'verification_incomplete' ? STATUS.NOT_CHECKED : regressed ? STATUS.UNRESOLVED : fieldOpen(final, c.path) ? STATUS.NEEDS_FACULTY_REVIEW : STATUS.VERIFIED;
    const last = c.steps[c.steps.length - 1], combined = c.steps.some(s => s.combined);
    const notes = [last.explanation, combined ? `One rewrite was written for all ${Math.max(...c.steps.map(s => s.flaggedBy.length), 2)} relationships of this field together.` : '',
      last.round > 1 ? `Written against the revised text of the earlier fields (round ${last.round}).` : ''].filter(Boolean);
    return { changeId: `chg_${i + 1}`, path: c.path, field: FIELD_NAME[layer] || 'general', originalValue: c.originalValue === undefined ? null : c.originalValue, proposedValue: c.proposedValue,
      explanation: notes.join(' '), ...(c.steps.length === 1 && c.sourceSuggestionId ? { sourceSuggestionId: c.sourceSuggestionId } : {}),
      rounds: c.steps.map(s => s.round), combinedRewrite: combined, basedOn: [...new Set(c.steps.flatMap(s => s.basedOn))], verification, relationships,
      semanticUnverified: verification !== STATUS.VERIFIED };
  });
  const status = stop === 'verification_incomplete' ? STATUS.NOT_CHECKED
    : regressions.length || blockingAfter > blockingBefore ? STATUS.UNRESOLVED
      : planChanges.every(c => c.verification === STATUS.VERIFIED) && !stop ? STATUS.VERIFIED : STATUS.NEEDS_FACULTY_REVIEW;
  const layers = [...new Set(planChanges.map(c => layerOf(c.path)))].filter(l => l !== null);
  const scoreBefore = result.hybrid.provisionalScore ?? null, scoreAfter = final.hybrid.provisionalScore ?? null;
  const verified = planChanges.filter(c => c.verification === STATUS.VERIFIED).length;
  const summaryText = status === STATUS.VERIFIED
    ? `All ${planChanges.length} changes were checked together on a copy of the syllabus: every changed field is aligned and nothing that was aligned got worse.${scoreBefore !== null && scoreAfter !== null ? ` Score ${scoreBefore} → ${scoreAfter}.` : ''}`
    : status === STATUS.NOT_CHECKED ? 'The changes could not be checked together (the AI check of the revised copy did not complete). Review them before applying.'
      : status === STATUS.UNRESOLVED ? `Checked together, ${regressions.length || 'some'} relationship(s) or required rule(s) would get worse. Review the listed conflicts before applying.`
        : `${verified} of ${planChanges.length} changes were verified together; the others still need your review (their field is not fully aligned yet).${scoreBefore !== null && scoreAfter !== null ? ` Score ${scoreBefore} → ${scoreAfter}.` : ''}`;
  const sourceHash = contentHash(content, ENGINE_VERSION);
  const budget = typeof requestBudget.summary === 'function' ? requestBudget.summary() : null;
  return {
    planId: `wplan_${crypto.createHash('sha256').update(JSON.stringify([sourceHash, planChanges.map(c => [c.path, c.proposedValue])])).digest('hex').slice(0, 16)}`,
    kind: 'whole-syllabus', version: VERSION, syllabusId, sourceHash, sourceVersion: content.schemaVersion || 2, createdAt: new Date().toISOString(), status, rounds,
    rootCauses: layers.map(l => ({ id: `layer_${l}`, kind: 'coordinated_layer', title: LAYER_TITLE[l], explanation: `Revised in order, so every later field is written against these.`, affectedFields: planChanges.filter(c => layerOf(c.path) === l).map(c => c.path) })),
    changes: planChanges, preservations: [...kept.values()].map(k => ({ path: k.path, originalValue: k.originalValue, reason: k.reason })), unresolvedIssues,
    // The answers that verified the revised text (asked while the plan was built). The next check reuses them for exactly that text (the reuse key is
    // the text of both sides), so applying the plan and checking again gives the verdicts the plan verified (repository.js reusableJudgements).
    verifiedJudgements: stop === 'verification_incomplete' ? [] : judgementsOf(final).filter(j => j.key && !j.unverified && j.label !== 'INSUFFICIENT_EVIDENCE' && !originalKeys.has(j.key)),
    validation: { status, overallEvaluated: stop !== 'verification_incomplete', deterministicChecksPass: blockingAfter <= blockingBefore, touchedFieldsCount: planChanges.length, conflictsDetected: regressions.length,
      unresolvedCount: unresolvedIssues.length, verifiedCount: verified, scoreBefore, scoreAfter, regressions, summaryText },
    ...(budget ? { usage: { requests: budget.requests ?? null, stopReason: budget.stopReason ?? null } } : {}),
  };
}

module.exports = { VERSION, STATUS, enabled, buildWholePlan, fieldOpen, cachedLinkChecker };
