'use strict';
// Cost optimisation controls for the Anthropic checker path. Nothing here changes what is asked or scored unless an operator turns a flag on:
// with every flag unset the checker sends exactly the requests it always did (verified byte for byte by optimization.test.js).
//
//   SYLLABUS_CHECK_COURSE_CONTEXT=scoped    F1. The course description is sent only with the relationship types that read it (DESCRIPTION_TYPES);
//                                           other requests carry the course without it. Part of the prompt version, so verdicts made with the full
//                                           context are never reused for a scoped question (or the other way round).
//   SYLLABUS_CHECK_OUTPUT_PLAN=on           F2. max_tokens (and so the budget reservation) is sized from the number of relationships in the request
//                                           instead of the account-wide ceiling. It can never be higher than ANTHROPIC_MAX_TOKENS.
//   SYLLABUS_CHECK_V2_GROUPING=week1|week2|week3|adaptive
//                                           F3. Policy V2 relationships are batched by the week they belong to (one, two or three weeks per request;
//                                           adaptive packs whole weeks up to the batch size). Unset/default: the existing fixed-size batches.
//   SYLLABUS_CHECK_CACHE_WARMUP=on          F4. The first request that carries a given cacheable prefix is sent alone; the others with the same prefix
//                                           wait for it, so they read the prompt cache instead of each writing it.
//   SYLLABUS_CHECK_OUTPUT_FIELDS=scoped    F6. A request asks only for the Stage C/D structured fields that its relationship types use. The stage prompts already tell the
//                                           model to answer not_assessed in those fields for every other type; the strict schema made it write them out all the same.
//                                           Part of the prompt version. Legacy (non-Policy-V2) requests only; Policy V2 requests carry no such fields.
//   Accounting (usage reported by the provider, kept apart from reservations) is always on and reporting-only.
//
// Every flag only changes how the same relationships are packed, sized or ordered. None changes a rule, a prompt's academic wording, a verdict
// contract, the official score, the passing threshold or a gate.

const flagOf = (env, name) => String(env?.[name] ?? '').trim().toLowerCase();
const isOn = value => ['on', '1', 'true', 'yes'].includes(value);

// The relationship types whose question reads the course description (measured from the prompt: Content-course and Ref-relevance judge against the
// course, Title-description and Description-plan are about the description itself). Every other type is judged from its own two sides.
const DESCRIPTION_TYPES = /^(Content-course|Ref-relevance|Title-description|Description-plan)$/;
const needsDescription = type => DESCRIPTION_TYPES.test(String(type || ''));
const scopedContextOn = env => flagOf(env, 'SYLLABUS_CHECK_COURSE_CONTEXT') === 'scoped';
const COURSE_CONTEXT_VERSION = 'cc1';

// ---------- F2: planned output ceiling ----------
// Output tokens measured per relationship (scripted-provider calibration against the real answer shapes): ≈309 for a staged legacy relationship, ≈758 for a
// V2 recommendation-contract one. The ceiling gives each relationship at least 4× that (never a cap on quality: an answer that does not fit is refused as
// incomplete and asked again in halves, exactly as before, so too small a ceiling costs a retry, never a wrong verdict). Adaptive thinking spends output
// tokens too, so it gets a fixed allowance on top.
const OUTPUT_PER_PAIR = { legacy: 1300, recommendation: 3000 };
const OUTPUT_BASE = 1500, THINKING_ALLOWANCE = 6000;
const outputPlanOn = env => isOn(flagOf(env, 'SYLLABUS_CHECK_OUTPUT_PLAN'));
function plannedMaxTokens({ pairCount, recommendation = false, thinking = false, ceiling }) {
  const planned = OUTPUT_BASE + Math.max(1, pairCount) * (recommendation ? OUTPUT_PER_PAIR.recommendation : OUTPUT_PER_PAIR.legacy) + (thinking ? THINKING_ALLOWANCE : 0);
  return Math.min(ceiling, Math.max(1024, planned));
}

// ---------- F6: structured fields per request ----------
// Which relationship types use which Stage C / D fields (stages.js C1, C2, D1, D2 directions and aspects.js REQUIRED/TYPES: no other type reads them). A group keeps
// ALL of its fields when any of its types is in the request, so nothing a type may answer is withheld; only whole unused groups are left out.
const ASPECT_GROUPS = [
  { types: ['Activity-fit', 'Assessment-fit'], keys: ['teaching', 'learnerSupport', 'measures', 'evidence', 'level', 'responsible'] },
  { types: ['Value-use', 'Value-map'], keys: ['valueUse', 'carriedBy', 'valueFit', 'coreValue', 'integration', 'responsible'] },
  { types: ['Ref-relevance'], keys: ['relevance', 'basis'] },
];
const OUTPUT_FIELDS_VERSION = 'of1';
const outputFieldsOn = env => flagOf(env, 'SYLLABUS_CHECK_OUTPUT_FIELDS') === 'scoped';
function aspectKeysForPairs(keys, pairs) {
  const types = new Set(pairs.map(pair => pair.type)), needed = new Set();
  for (const group of ASPECT_GROUPS) if (group.types.some(type => types.has(type))) for (const key of group.keys) needed.add(key);
  return keys.filter(key => needed.has(key));
}

// ---------- F3: batch planning ----------
const GROUPINGS = ['default', 'week1', 'week2', 'week3', 'adaptive'];
function groupingOf(env) { const value = flagOf(env, 'SYLLABUS_CHECK_V2_GROUPING'); return GROUPINGS.includes(value) ? value : 'default'; }
// The week a relationship belongs to, from the path of its source or target ("plan[4]..."); null for a course-level relationship.
function weekOf(pair) {
  for (const path of [pair?.path, pair?.targetPath]) { const found = /^plan\[(\d+)\]/.exec(String(path || '')); if (found) return Number(found[1]); }
  return null;
}
// How `items` are cut into requests. 'default' is the existing fixed-size slicing, so planBatches(items, size, 'default') is identical to it.
// The week strategies are bounded by HARD_MAX (the largest batch the checker already allows, SYLLABUS_CHECK_AI_BATCH=24), not by `size`: a week or two
// of Policy V2 relationships is more than 12, which is the point of grouping them. Adaptive packs whole consecutive weeks toward 1.5× `size`, so a week
// is never split to fill a request. A group over its bound is split in order. Course-level relationships (no week) are batched together at `size`.
const HARD_MAX = 24;
function planBatches(items, size, grouping = 'default') {
  const out = [];
  const slices = (list, limit) => { for (let i = 0; i < list.length; i += limit) out.push(list.slice(i, i + limit)); };
  if (grouping === 'default' || !GROUPINGS.includes(grouping)) { slices(items, size); return out; }
  const weeks = new Map(), course = [];
  for (const item of items) { const week = weekOf(item); if (week === null) course.push(item); else { if (!weeks.has(week)) weeks.set(week, []); weeks.get(week).push(item); } }
  const ordered = [...weeks.entries()].sort((a, b) => a[0] - b[0]);
  if (grouping === 'adaptive') {
    const limit = Math.min(HARD_MAX, Math.ceil(size * 1.5));
    let current = [];
    for (const [, list] of ordered) {
      if (current.length && current.length + list.length > limit) { slices(current, limit); current = []; }
      current = current.concat(list);
    }
    if (current.length) slices(current, limit);
  } else {
    const span = grouping === 'week2' ? 2 : grouping === 'week3' ? 3 : 1;
    for (let i = 0; i < ordered.length; i += span) slices(ordered.slice(i, i + span).flatMap(([, list]) => list), HARD_MAX);
  }
  slices(course, size);
  return out;
}
const countBatches = (items, size, grouping) => planBatches(items, size, grouping).length;

// ---------- F1 helper: keep description-free and description-reading relationships in separate requests ----------
// A stable partition: relationships that need the description go together (and after the others), so most requests can leave it out. The order inside
// each group is unchanged. `rank` lets the caller keep its own earlier grouping (scored before optional) as the major key.
function partitionByContext(items, rank = () => 0) {
  return items.map((item, index) => ({ item, index, key: rank(item) * 2 + (needsDescription(item.type) ? 1 : 0) })).sort((a, b) => a.key - b.key || a.index - b.index).map(entry => entry.item);
}

// ---------- F4: cache warm-up gate ----------
// One gate per check (keyed by the shared request budget). A request whose cacheable prefix has not been seen goes first; later requests with the same
// prefix wait until it has finished (answered or failed), then run together. Requests with different prefixes do not wait for each other.
const gates = new WeakMap();
const warmupOn = env => isOn(flagOf(env, 'SYLLABUS_CHECK_CACHE_WARMUP'));
function gateFor(owner) {
  if (!owner || typeof owner !== 'object') return null;
  if (!gates.has(owner)) gates.set(owner, { first: new Map(), stats: { prefixes: 0, waited: 0 } });
  return gates.get(owner);
}
async function throughGate(gate, prefix, send) {
  if (!gate) return send();
  const earlier = gate.first.get(prefix);
  if (earlier) { gate.stats.waited += 1; await earlier.catch(() => {}); return send(); }
  gate.stats.prefixes += 1;
  const running = Promise.resolve().then(send);
  gate.first.set(prefix, running.then(() => {}, () => {})); // what the others wait for settles whether the first request answered or failed
  return running;
}
const warmupStats = owner => (gates.get(owner) || { stats: { prefixes: 0, waited: 0 } }).stats;

module.exports = { ASPECT_GROUPS, OUTPUT_FIELDS_VERSION, outputFieldsOn, aspectKeysForPairs, DESCRIPTION_TYPES, needsDescription, scopedContextOn, COURSE_CONTEXT_VERSION, outputPlanOn, plannedMaxTokens, OUTPUT_PER_PAIR, OUTPUT_BASE, THINKING_ALLOWANCE,
  GROUPINGS, groupingOf, weekOf, planBatches, countBatches, partitionByContext, warmupOn, gateFor, throughGate, warmupStats };
