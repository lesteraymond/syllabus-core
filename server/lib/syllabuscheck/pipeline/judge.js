'use strict';
// Re-planned AI Checker, Phase 2: the AI judgment of the whole syllabus.
//
// 1. questionsOf(map): every relationship the rules ask, as checklist questions, each tied to the field it judges (`from.key`) and to the fields it
//    depends on (`parents`).
// 2. judge(): questions whose exact texts were answered before are reused from the store; the rest are asked in ONE request per group: the CLOs,
//    each week (content, ILOs, activities, tasks, values together) and the whole syllabus (sequence, references). A rejected answer is asked once
//    more; a provider failure is never retried and never a pass.
// 3. statuses: code sets the verdict (rules.verdictOf), then:
//      ok           ALIGNED
//      failing      a scored misalignment whose parents are fine: a ROOT cause, to repair now
//      waiting      a misalignment whose parent field is itself failing: judged again once the parent is fixed
//      review       an extra tag that does not fit beside a tag that does (need 'any'): faculty review, no penalty
//      advice       a misalignment in an unscored relationship
//      not_checked  INSUFFICIENT_EVIDENCE, a rejected answer or a provider failure: never a pass, never a deduction
// `ask(message)` is the provider: it receives { system, user, schema, promptVersion } and returns the reply text or object. Tests pass a script.
const R = require('./rules');
const P = require('./prompt');
const crypto = require('node:crypto');
const { clean } = require('./extract');

const MAX_QUESTIONS_PER_REQUEST = 25;
const DEFAULT_CONCURRENCY = 3;
const RANK = { ALIGNED: 0, PARTIALLY_ALIGNED: 1, NOT_ALIGNED: 2, INSUFFICIENT_EVIDENCE: 3 };

// Fixed-rule findings that are a problem of a field's own text, so the repair plan can rewrite that field (tags, counts and the schedule are the
// author's to fix).
const FIXED_TEXT_RULES = {
  'CLO-STATEMENT': f => `clo:${f.where.cloId}`, 'CONTENT-MISSING': f => `content:${f.where.row}`, 'ACTIVITY-OPTIONS': f => `activities:${f.where.row}`,
  'TASKS-MISSING': f => `tasks:${f.where.row}`, 'VALUES-WEEKLY': f => `values:${f.where.row}`, 'ILO-DUPLICATE': f => `ilo:${f.where.ilo}`,
  'OUTCOME-ONE-VERB': f => (f.where.ilo ? `ilo:${f.where.ilo}` : `clo:${f.where.cloId}`),
};
const fieldKeyOfFinding = f => (FIXED_TEXT_RULES[f.rule] ? FIXED_TEXT_RULES[f.rule](f) : null);

const weekLabel = w => `Week ${w.label || '?'}`;
const iloLabel = (w, i) => `${weekLabel(w)} ILO ${i + 1}`;

function questionsOf(map) {
  const out = [];
  const course = { field: 'courseTitle', key: 'course', label: 'Course title', text: clean(`${map.course.code} ${map.course.title}`) };
  const cloById = new Map(map.clos.map(c => [c.id, c]));
  const cloTarget = clo => ({ field: 'clo', key: `clo:${clo.id}`, label: `CLO ${clo.no}${clo.requiredLevel ? ` (${clo.requiredLevel})` : ''}`, text: clo.statement });
  const add = (relationship, group, from, to, parents = [], tag = '') => out.push({
    id: `${relationship}|${from.key}${tag ? '|' + tag : ''}`, relationship, group, from, to, parents,
  });
  // the CLOs
  for (const clo of map.clos) {
    if (!clo.statement) continue;
    const from = { field: 'clo', key: `clo:${clo.id}`, label: `CLO ${clo.no}`, text: clo.statement };
    add('CLO-TITLE', 'clos', from, [course]);
    const level = R.CLO_LEVELS[clo.no - 1];
    if (level) add('CLO-LEVEL', 'clos', from, [{ field: 'cloLevel', key: `level:${clo.no}`, label: `CLO ${clo.no} classification`, text: `${level.level} (${level.focus})` }]);
    for (const po of map.masters.pos.filter(p => clo.pos.includes(p.no))) add('CLO-PO', 'clos', from, [{ field: 'po', key: `po:${po.no}`, label: `PO ${po.no}`, text: po.text }], [], `po:${po.no}`);
    for (const ega of map.masters.egas.filter(e => clo.egas.includes(e.no))) add('CLO-EGA', 'clos', from, [{ field: 'ega', key: `ega:${ega.no}`, label: `EGA ${ega.no}`, text: ega.text }], [], `ega:${ega.no}`);
  }
  // each week
  const planText = map.weeks.filter(w => w.kind === 'lesson' && w.content.text).map(w => `${weekLabel(w)}: ${w.content.text}`).join('\n');
  for (const w of map.weeks) {
    const group = `week:${w.rowId}`;
    const content = { field: 'content', key: `content:${w.rowId}`, label: `${weekLabel(w)} content`, text: w.content.text };
    const ilos = w.ilos.map((ilo, i) => ({ field: 'ilo', key: `ilo:${ilo.id}`, label: iloLabel(w, i), text: ilo.text, ilo }));
    const activities = { field: 'activities', key: `activities:${w.rowId}`, label: `${weekLabel(w)} activities`, text: w.activities.text };
    const tasks = { field: 'tasks', key: `tasks:${w.rowId}`, label: `${weekLabel(w)} tasks`, text: w.tasks.text };
    const values = { field: 'values', key: `values:${w.rowId}`, label: `${weekLabel(w)} values`, text: w.values.text };
    const iloTargets = ilos.map(({ ilo, ...t }) => t);
    if (w.kind === 'lesson' && content.text) {
      add('CONTENT-TITLE', group, content, [course]);
      add('CONTENT-SEQUENCE', 'syllabus', content, [{ field: 'plan', key: 'plan', label: 'All weekly topics, in order', text: planText }]);
    }
    if (w.kind !== 'exam' && content.text) for (const t of iloTargets) add('ILO-CONTENT', group, t, [content], [content.key]);
    if (w.kind === 'lesson') {
      for (const { ilo, ...t } of ilos) for (const id of ilo.cloIds) if (cloById.get(id)?.statement) add('ILO-CLO', group, t, [cloTarget(cloById.get(id))], [`clo:${id}`], `clo:${id}`);
      if (activities.text && content.text) add('ACTIVITY-FIT', group, activities, [content, ...iloTargets], [content.key, ...iloTargets.map(t => t.key)]);
      // the ILOs too, for the level item (constructive alignment): an "apply" ILO is not assessed by a recall quiz
      if (tasks.text && content.text) add('TASK-FIT', group, tasks, [content, ...(activities.text ? [activities] : []), ...iloTargets], [content.key, activities.key, ...iloTargets.map(t => t.key)]);
      if (tasks.text && iloTargets.length) add('TASK-ILO', group, tasks, iloTargets, iloTargets.map(t => t.key));
    }
    if (w.values.named.length) {
      // The checklist asks whether the value can be practised through the week's ILO AND activities, so the activities are given too: without them an
      // answer quoting the activities was rejected ("the quote is not in the texts"), the question stayed unanswered and the whole check was incomplete
      // (CPE 101 Week 17, 2026-11-17: a teacher-centred ILO, the value carried by an ethics case discussion). The repair order still follows the ILO only.
      if (iloTargets.length) add('VALUE-ILO', group, values, [...iloTargets, ...(activities.text ? [activities] : [])], iloTargets.map(t => t.key));
      else if (content.text) add('VALUE-ILO', group, values, [{ ...content, label: `${weekLabel(w)} content (${w.kind === 'exam' ? 'examination week' : 'no ILO'})` }], [content.key]);
    }
  }
  // each CLO's own verb level, against the weeks mapped to it (constructive alignment): their ILOs, activities and tasks, one line per week.
  // Its parents are those weeks' activities and tasks, so it waits while one of them is still failing (fix the weeks first).
  for (const clo of map.clos) {
    if (!clo.statement) continue;
    const weeks = map.weeks.filter(w => w.kind === 'lesson' && w.ilos.some(ilo => ilo.cloIds.includes(clo.id)));
    if (!weeks.length) continue; // an unmapped CLO is a fixed rule (CLO-COVERAGE), not a level question
    const lines = weeks.map(w => `${weekLabel(w)}. ILO: ${w.ilos.filter(ilo => ilo.cloIds.includes(clo.id)).map(ilo => clean(ilo.text)).join(' / ') || '(none)'} | Activities: ${clean(w.activities.text) || '(none)'} | Tasks: ${clean(w.tasks.text) || '(none)'}`);
    const from = { field: 'clo', key: `clo:${clo.id}`, label: `CLO ${clo.no}`, text: clo.statement };
    const mapped = { field: 'plan', key: `evidence:${clo.id}`, label: `Weeks mapped to CLO ${clo.no}`, text: lines.join('\n') };
    // asked with the whole-syllabus questions: it reads several weeks, and the CLO request already carries up to ~24 questions
    add('CLO-EVIDENCE', 'syllabus', from, [mapped], weeks.flatMap(w => [`activities:${w.rowId}`, `tasks:${w.rowId}`]));
  }
  // references
  const topics = { field: 'plan', key: 'plan', label: 'All weekly topics, in order', text: planText };
  for (const ref of map.references) add('REF-RELEVANCE', 'syllabus', { field: 'references', key: `ref:${ref.group}:${ref.id}`, label: `Reference (${ref.group})`, text: ref.text }, planText ? [course, topics] : [course]);
  return out;
}

// The reuse key of a question: a full SHA-256 (it is also the primary key of a stored answer in replan_answers) of everything the answer depends on.
// promptVersion: P.promptVersionFor(map.course): PROMPT_VERSION for every syllabus but one written in Filipino, so their keys are unchanged.
const keyOf = (q, course, model, promptVersion = P.PROMPT_VERSION) => crypto.createHash('sha256').update([R.VERSION, promptVersion, model || '', course, q.relationship, q.from.text, ...q.to.map(t => `${t.label}=${t.text}`)].map(s => clean(s).toLowerCase()).join('␟')).digest('hex');

function chunk(list, size) { const out = []; for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size)); return out; }

async function askGroup(request, ask, usage, context) {
  usage.requests++;
  let raw;
  try { raw = await ask(P.judgeMessage(request, context)); } catch (error) {
    usage.providerFailures++;
    return { answers: new Map(), rejected: request.questions.map(q => ({ q: q.id, reason: 'provider failed: ' + clean(error && error.message).slice(0, 200), provider: true })) };
  }
  return P.validateAnswers(request, raw);
}

// Judge a map. `fixed` is the fixed-rule result for the same map (fixedRules.check). Options: ask (required unless every answer is stored),
// store ({ get, set }; default a new Map), model (part of the reuse key), concurrency (requests in flight at once, 1-6, default 3 like the live
// checker). The FIRST request is sent alone, so it writes the prompt cache that every later request then reads; the rest go `concurrency` at a time.
// Results do not depend on the order in which answers arrive.
async function judge(map, fixed, { ask, store = new Map(), model = '', retries = 1, concurrency = DEFAULT_CONCURRENCY } = {}) {
  const questions = questionsOf(map);
  const course = clean(`${map.course.code} ${map.course.title}`);
  const promptVersion = P.promptVersionFor(map.course);
  const usage = { questions: questions.length, reused: 0, asked: 0, requests: 0, retries: 0, providerFailures: 0 };
  const answers = new Map(), reasons = new Map(), reused = new Set();
  const pending = [];
  // Stored answers: one round trip when the store can (answerStore.js getMany), else one lookup per key. A store may be a plain Map.
  const keys = questions.map(q => keyOf(q, course, model, promptVersion));
  let stored;
  if (typeof store.getMany === 'function') stored = await store.getMany([...new Set(keys)]);
  else { stored = new Map(); for (const k of keys) { const v = await store.get(k); if (v) stored.set(k, v); } }
  questions.forEach((q, i) => {
    const hit = stored.get(keys[i]);
    if (hit) { answers.set(q.id, hit); reused.add(q.id); usage.reused++; } else pending.push(q);
  });
  usage.asked = pending.length;
  // One SYLLABUS CONTEXT for every request of this check (prompt.js syllabusContext): cached by the provider after the first request.
  const context = P.syllabusContext(questions.flatMap(q => q.to));
  const groups = new Map();
  for (const q of pending) { if (!groups.has(q.group)) groups.set(q.group, []); groups.get(q.group).push(q); }
  const parts = [];
  for (const [group, list] of groups) for (const part of chunk(list, MAX_QUESTIONS_PER_REQUEST)) parts.push({ group, part });
  const runPart = async ({ group, part }) => {
    if (typeof ask !== 'function') { for (const q of part) reasons.set(q.id, 'no provider'); return; }
    let request = { id: group, course: { code: map.course.code, title: map.course.title, program: map.course.program }, questions: part };
    for (let attempt = 0; attempt <= retries; attempt++) {
      const { answers: got, rejected } = await askGroup(request, ask, usage, context);
      for (const [id, a] of got) { answers.set(id, a); reasons.delete(id); }
      for (const r of rejected) reasons.set(r.q, r.reason);
      const again = rejected.filter(r => !r.provider).map(r => r.q);
      if (!again.length || attempt === retries) break;
      usage.retries++;
      request = { ...request, questions: request.questions.filter(q => again.includes(q.id)) };
    }
  };
  if (parts.length) await runPart(parts[0]); // alone: it writes the prompt cache
  const width = Math.max(1, Math.min(6, Number.isInteger(concurrency) ? concurrency : DEFAULT_CONCURRENCY));
  let next = 1;
  const worker = async () => { while (next < parts.length) await runPart(parts[next++]); };
  await Promise.all(Array.from({ length: Math.min(width, parts.length - 1) }, worker));
  const toStore = [];
  const results = questions.map((q, i) => {
    const a = answers.get(q.id);
    const verdict = a ? R.verdictOf(q.relationship, a.items) : R.VERDICT.INSUFFICIENT_EVIDENCE;
    if (a && !reused.has(q.id) && verdict !== R.VERDICT.INSUFFICIENT_EVIDENCE) toStore.push({ key: keys[i], answer: a, meta: { relationship: q.relationship, model, promptVersion, rulesVersion: R.VERSION } });
    return {
      id: q.id, relationship: q.relationship, area: R.CHECKLISTS[q.relationship].area, scored: R.CHECKLISTS[q.relationship].scored,
      field: q.from.field, fieldKey: q.from.key, label: q.from.label, text: q.from.text, to: q.to, parents: q.parents,
      verdict, items: a ? a.items : null, failedItems: a ? Object.keys(a.items).filter(k => a.items[k] === 'no') : [],
      quote: a ? a.quote : null, explanation: a ? a.explanation : null, reused: reused.has(q.id), reason: a ? null : reasons.get(q.id) || 'not answered',
    };
  });
  if (typeof store.setMany === 'function') await store.setMany(toStore);
  else for (const e of toStore) await store.set(e.key, e.answer, e.meta);
  setStatuses(results, fixed);
  const counted = results.filter(r => r.status === 'failing' || r.status === 'waiting');
  return {
    version: R.VERSION, promptVersion, results, usage,
    // complete: every question got a valid answer or a definite INSUFFICIENT_EVIDENCE; none was lost to the provider or a rejected reply
    complete: results.every(r => !r.reason),
    deductions: R.deductions(counted),
  };
}

function setStatuses(results, fixed) {
  // need 'any': the best answer of a field's tags counts; a tag that fails beside it goes to review.
  const groups = new Map();
  for (const r of results) if (R.CHECKLISTS[r.relationship].need === 'any') {
    const k = `${r.relationship}|${r.fieldKey}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const extras = new Set();
  for (const list of groups.values()) {
    const best = [...list].sort((a, b) => RANK[a.verdict] - RANK[b.verdict])[0];
    for (const r of list) if (r !== best && r.verdict !== 'ALIGNED' && r.verdict !== 'INSUFFICIENT_EVIDENCE') extras.add(r);
  }
  for (const r of results) {
    if (r.verdict === 'ALIGNED') r.status = 'ok';
    else if (r.verdict === 'INSUFFICIENT_EVIDENCE') r.status = 'not_checked';
    else if (extras.has(r)) r.status = 'review';
    else r.status = r.scored ? 'failing' : 'advice';
  }
  // A manual relationship (CLO-EVIDENCE) is fixed in OTHER fields (its weeks), never in its own: it does not make its field "failing" for the fields that
  // depend on it. Before, it did, and the weeks it waits for waited on the CLO in turn: a cycle in which the plan rewrote nothing (CPE 101 #458, Week 10).
  const failingFields = new Set(results.filter(r => r.status === 'failing' && !R.isManual(r.relationship)).map(r => r.fieldKey));
  for (const f of (fixed && fixed.findings) || []) if (f.severity === 'finding') { const key = fieldKeyOfFinding(f); if (key) failingFields.add(key); }
  for (const r of results) if ((r.status === 'failing' || r.status === 'advice') && r.parents.some(p => failingFields.has(p))) r.status = 'waiting';
  return results;
}

module.exports = { questionsOf, judge, setStatuses, keyOf, fieldKeyOfFinding, FIXED_TEXT_RULES, MAX_QUESTIONS_PER_REQUEST };
