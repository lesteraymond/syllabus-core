'use strict';
// Re-planned AI Checker, Phase 2: ONE repair plan for the whole syllabus, verified before anyone sees it.
//
//   1. Check the syllabus (check.js). Apply the mechanical fixes first: a CLO's fixed classification, an APA repair built from the reference's own
//      characters.
//   2. Each round, take the ROOT fields: a field with a misalignment of its own (a failing AI result, or a fixed rule about its own text) whose
//      parent fields are all fine. Fields waiting on a failing parent are left for a later round, so a fix is always written against settled
//      parents. EGA, PO and references are never rewritten; content is never rewritten to suit an ILO (it has no ILO parent).
//   3. Rewrite each root field once, given every relationship it must satisfy (parents) and the fields that rely on it (children), in a copy.
//   4. Check the copy again. Answers whose exact texts are unchanged are reused from the store, so only changed fields and the ones that depend on
//      them are asked. Repeat until nothing is left or the round limit is reached; a field gets at most two rewrites.
//   5. The last check is the verification: a change is VERIFIED only when its field ends with no misalignment and nothing that was aligned got worse.
// Because the verification answers are stored by exact text, a re-check of the syllabus after the author accepts the plan reuses them: it cannot
// show a new misalignment unless the text was changed again. Nothing is saved here; the author accepts the plan (applyPlan) and the AI never approves.
const R = require('./rules');
const P = require('./prompt');
const { check } = require('./check');
const { fieldKeyOfFinding } = require('./judge');
const { clean } = require('./extract');

const PLAN_VERSION = 'replan-plan-1';
const STATUS = { VERIFIED: 'VERIFIED', NEEDS_FACULTY_REVIEW: 'NEEDS_FACULTY_REVIEW', NOT_CHECKED: 'NOT_CHECKED' };
const REWRITABLE = new Set(R.CHAIN.filter(r => r.rewritable).map(r => r.field));
const AUTHOR_RULES = new Set(['CLO-COUNT', 'CLO-PO-TAG', 'CLO-EGA-TAG', 'CLO-UNKNOWN-TAG', 'CLO-COVERAGE', 'WEEK1-ORIENTATION', 'WEEK2-FIRST-TOPIC', 'ILO-MISSING', 'ILO-CLO-TAG', 'REF-NONE', 'REF-APA', 'REF-LINK']);

// ---- reading and writing one field of the content JSON ----
function locate(content, key) {
  const [kind, a, b] = key.split(':');
  const row = id => (content.plan || []).find(r => r.id === id);
  if (kind === 'clo') { const clo = (content.clos || []).find(c => c.id === a); return clo && { obj: clo, prop: 'statement' }; }
  if (kind === 'ilo') { for (const r of content.plan || []) { const ilo = (r.ilos || []).find(i => i.id === a); if (ilo) return { obj: ilo, prop: 'text' }; } return null; }
  if (kind === 'content') { const r = row(a); return r && { obj: r, prop: 'contents' }; }
  if (['activities', 'tasks', 'values'].includes(kind)) { const r = row(a); return r && { obj: r, prop: kind }; }
  if (kind === 'ref') { const item = content.refs?.[a]?.items?.find(i => i.id === b); return item && { obj: item, prop: 't' }; }
  if (kind === 'clolevel') { const clo = (content.clos || []).find(c => c.id === a); return clo && { obj: clo, prop: 'level' }; }
  return null;
}
const getField = (content, key) => { const at = locate(content, key); return at ? String(at.obj[at.prop] ?? '') : null; };
function setField(content, key, value) { const at = locate(content, key); if (!at) throw new Error('No such field: ' + key); at.obj[at.prop] = value; }

// ---- the structure of the dependency chain, per field instance ----
function structure(map) {
  const parents = new Map(), children = new Map(), info = new Map();
  const link = (child, parent) => {
    if (!parents.has(child)) parents.set(child, new Set());
    parents.get(child).add(parent);
    if (!children.has(parent)) children.set(parent, new Set());
    children.get(parent).add(child);
  };
  for (const clo of map.clos) info.set(`clo:${clo.id}`, { field: 'clo', label: `CLO ${clo.no}`, text: clo.statement });
  for (const w of map.weeks) {
    const k = f => `${f}:${w.rowId}`, name = `Week ${w.label || '?'}`;
    info.set(k('content'), { field: 'content', label: `${name} content`, text: w.content.text });
    info.set(k('activities'), { field: 'activities', label: `${name} activities`, text: w.activities.text });
    info.set(k('tasks'), { field: 'tasks', label: `${name} tasks`, text: w.tasks.text });
    info.set(k('values'), { field: 'values', label: `${name} values`, text: w.values.text });
    w.ilos.forEach((ilo, i) => {
      const key = `ilo:${ilo.id}`;
      info.set(key, { field: 'ilo', label: `${name} ILO ${i + 1}`, text: ilo.text });
      link(key, k('content'));
      for (const id of ilo.cloIds) if (map.clos.some(c => c.id === id)) link(key, `clo:${id}`);
      link(k('activities'), key);
      link(k('values'), key);
    });
    link(k('activities'), k('content'));
    link(k('tasks'), k('content'));
    link(k('tasks'), k('activities'));
    if (!w.ilos.length) link(k('values'), k('content'));
  }
  return { parents, children, info };
}

// Root fields of one check: own misalignment, all parents fine.
function rootsOf(result, attempts, maxAttempts) {
  const { parents, info } = structure(result.map);
  const own = new Map();
  const note = (key, entry) => { if (!own.has(key)) own.set(key, { failures: [], rules: [] }); entry(own.get(key)); };
  for (const r of result.judged.results) if (r.status === 'failing' || r.status === 'waiting') note(r.fieldKey, o => o.failures.push(r));
  for (const f of result.fixed.findings) if (f.severity === 'finding') { const key = fieldKeyOfFinding(f); if (key) note(key, o => o.rules.push(f.message)); }
  const failing = new Set(own.keys());
  const roots = [];
  for (const [key, o] of own) {
    const meta = info.get(key);
    if (!meta || !REWRITABLE.has(meta.field)) continue;
    if ([...(parents.get(key) || [])].some(p => failing.has(p))) continue; // waits for its parent
    if (o.failures.some(r => r.status === 'waiting')) continue;
    if ((attempts.get(key) || 0) >= maxAttempts) continue;
    roots.push({ key, ...meta, ...o });
  }
  roots.sort((a, b) => R.layerOf(a.field) - R.layerOf(b.field));
  return roots;
}

function jobOf(root, result) {
  const { parents, children, info } = structure(result.map);
  const asText = key => ({ ...(info.get(key) || { field: key.split(':')[0], label: key }), key });
  return {
    course: result.map.course, key: root.key, field: root.field, label: root.label, text: root.text,
    parents: [...(parents.get(root.key) || [])].map(asText),
    failures: root.failures.map(r => ({ relationship: r.relationship, to: r.to, failedItems: r.failedItems, explanation: r.explanation })),
    // what the field already does right: its relationships that are ALIGNED now (a PO or EGA a CLO already supports, the CLO an ILO already builds).
    // A rewrite must keep them, so fixing one link does not break another (DSP re-run, 2026-11-15: three CLO rewrites dropped a PO).
    keep: result.judged.results.filter(r => r.fieldKey === root.key && r.status === 'ok').map(r => ({ relationship: r.relationship, to: r.to })),
    rules: root.rules,
    children: [...(children.get(root.key) || [])].map(asText).filter(c => c.text),
  };
}

// The fields of the same kind beside a field, with their CURRENT text in the plan's working copy (so a rewrite sees what an earlier rewrite of the same
// round wrote): the other ILOs of the same week, or the other CLOs. A rewrite must stay distinct from them (prompt.js keepDistinctFrom, validateRewrite).
function siblingsOf(content, key) {
  const [kind, id] = String(key).split(':');
  if (kind === 'ilo') {
    const row = (content.plan || []).find(r => (r.ilos || []).some(i => i.id === id));
    if (!row) return [];
    return row.ilos.map((i, n) => ({ i, n })).filter(({ i }) => i.id !== id && clean(i.text)).map(({ i, n }) => ({ field: 'ilo', key: 'ilo:' + i.id, label: `Week ${row.week || '?'} ILO ${n + 1}`, text: clean(i.text) }));
  }
  if (kind === 'clo') return (content.clos || []).map((c, n) => ({ c, n })).filter(({ c }) => c.id !== id && clean(c.statement)).map(({ c, n }) => ({ field: 'clo', key: 'clo:' + c.id, label: `CLO ${n + 1}`, text: clean(c.statement) }));
  return [];
}

const misaligned = (result, key) => result.misalignments.some(m => m.fieldKey === key || (m.source === 'rule' && fieldKeyOfFinding({ rule: m.rule, where: m.where }) === key));

// Build the plan. opts: ask (judge provider), rewrite (rewrite provider; same shape as ask), store, model, year, maxRounds (3), maxAttempts (2).
async function buildPlan(content, masters, opts = {}) {
  const { rewrite, maxRounds = 3, maxAttempts = 2 } = opts;
  const checkOpts = { ask: opts.ask, store: opts.store || new Map(), model: opts.model, year: opts.year, ...(opts.concurrency ? { concurrency: opts.concurrency } : {}) };
  const state = structuredClone(content);
  const changes = new Map(), attempts = new Map(), rejections = new Map();
  const usage = { checks: 0, judgeRequests: 0, rewriteRequests: 0 };
  const run = async () => { usage.checks++; const r = await check(state, masters, checkOpts); usage.judgeRequests += r.judged.usage.requests; return r; };
  const record = (key, field, label, after, explanation, source) => {
    const before = changes.has(key) ? changes.get(key).before : getField(content, key);
    changes.set(key, { key, field, label, before, after, explanation, source });
  };

  const initial = await run();
  // mechanical fixes: fixed CLO classification, APA repairs from the reference's own characters
  let mechanical = 0;
  for (const f of initial.fixed.findings) {
    if (f.rule === 'CLO-LEVEL-LABEL' && f.fix?.level) { const key = `clolevel:${f.where.cloId}`; setField(state, key, f.fix.level); record(key, 'cloLevel', `CLO ${f.where.clo} classification`, f.fix.level, f.message, 'mechanical'); mechanical++; }
    if (f.rule === 'REF-APA' && f.fix?.text) { const key = `ref:${f.where.group}:${f.where.ref}`; setField(state, key, f.fix.text); record(key, 'references', `Reference (${f.where.group})`, f.fix.text, f.message, 'mechanical'); mechanical++; }
  }
  let current = mechanical ? await run() : initial;
  let rounds = 0;
  for (; rounds < maxRounds; rounds++) {
    const roots = rootsOf(current, attempts, maxAttempts);
    if (!roots.length || typeof rewrite !== 'function') break;
    for (const root of roots) {
      const job = { ...jobOf(root, current), siblings: siblingsOf(state, root.key) };
      attempts.set(root.key, (attempts.get(root.key) || 0) + 1);
      usage.rewriteRequests++;
      let raw;
      try { raw = await rewrite(P.rewriteMessage(job)); } catch (error) { rejections.set(root.key, 'provider failed: ' + clean(error && error.message).slice(0, 200)); continue; }
      const out = P.validateRewrite(job, raw);
      if (out.rejected) { rejections.set(root.key, out.rejected); continue; }
      setField(state, root.key, out.text);
      record(root.key, root.field, root.label, out.text, out.explanation, 'ai');
    }
    current = await run();
  }

  // verification: the last check of the revised copy
  // A regression is a relationship that was ALIGNED before the plan and is not after it. Only SCORED relationships count: an advice relationship
  // that slips (TASK-ILO, CONTENT-SEQUENCE) is reported apart (adviceRegressions) and never holds a change back. A regression holds back only the
  // changes it involves: the field it judges, or a field it is judged against or depends on.
  // An answer that could not be had after the plan (a refused or failed request, or "unclear": INSUFFICIENT_EVIDENCE) is UNKNOWN, not worse: it is
  // listed apart (notRechecked) and holds back only the change of its own field (status NOT_CHECKED, below), never as a regression.
  const before = new Map(initial.judged.results.map(r => [r.id, r.verdict]));
  const describe = r => ({ id: r.id, label: r.label, verdict: r.verdict, involves: [...new Set([r.fieldKey, ...r.parents, ...r.to.map(t => t.key)])] });
  const wasAligned = current.judged.results.filter(r => before.get(r.id) === 'ALIGNED' && r.verdict !== 'ALIGNED');
  const slipped = wasAligned.filter(r => r.verdict !== 'INSUFFICIENT_EVIDENCE');
  const notRechecked = wasAligned.filter(r => r.verdict === 'INSUFFICIENT_EVIDENCE').map(r => ({ ...describe(r), reason: r.reason || 'unclear' }));
  const regressions = slipped.filter(r => r.scored).map(describe);
  const adviceRegressions = slipped.filter(r => !r.scored).map(describe);
  const regressedBy = key => regressions.some(r => r.involves.includes(key));
  const notChecked = key => current.judged.results.some(r => r.fieldKey === key && r.status === 'not_checked');
  const refStillFlagged = key => key.startsWith('ref:') && current.fixed.findings.some(f => f.rule === 'REF-APA' && f.severity === 'finding' && key === 'ref:' + f.where.group + ':' + f.where.ref);
  const list = [...changes.values()].map(c => ({
    ...c,
    status: c.source === 'mechanical' ? (refStillFlagged(c.key) ? STATUS.NEEDS_FACULTY_REVIEW : STATUS.VERIFIED) : notChecked(c.key) ? STATUS.NOT_CHECKED : misaligned(current, c.key) || regressedBy(c.key) ? STATUS.NEEDS_FACULTY_REVIEW : STATUS.VERIFIED,
  }));
  const changed = new Set(changes.keys());
  const leftKeys = new Set([...current.misalignments.map(m => m.fieldKey || (m.source === 'rule' ? fieldKeyOfFinding({ rule: m.rule, where: m.where }) : null))].filter(Boolean));
  const unresolved = [...leftKeys].filter(k => !changed.has(k)).map(k => ({ key: k, reason: rejections.get(k) || ((attempts.get(k) || 0) >= maxAttempts ? 'not fixed after ' + maxAttempts + ' rewrites' : 'waits for a field above it, or the round limit was reached') }));
  const manual = current.fixed.findings.filter(f => f.severity === 'finding' && AUTHOR_RULES.has(f.rule)).map(f => ({ rule: f.rule, where: f.where, message: f.message }));
  return {
    version: PLAN_VERSION, rounds, usage,
    changes: list, unresolved, manual, regressions, adviceRegressions, notRechecked,
    before: initial.summary, after: current.summary,
    clean: current.misalignments.length === 0 && current.summary.complete,
    revised: state,
  };
}

// The content with the accepted changes applied (all of them, or only the listed keys). Returns a new object; the original is not changed.
function applyPlan(content, plan, keys = null) {
  const out = structuredClone(content);
  for (const c of plan.changes) if (!keys || keys.includes(c.key)) setField(out, c.key, c.after);
  return out;
}

module.exports = { buildPlan, applyPlan, rootsOf, structure, siblingsOf, getField, setField, PLAN_VERSION, STATUS };
