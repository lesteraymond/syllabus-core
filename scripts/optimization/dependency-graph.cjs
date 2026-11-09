'use strict';
// Measures the real dependency graph of the checker: for each single edit to a synthetic syllabus (or to an institutional reference), which relationships the
// next check asks the AI again and which it reuses. It runs the real service over an in-memory database with the scripted provider (no network, no cost):
// one full check is stored, then each edit is checked against that stored run (without storing it), so every row is relative to the same baseline.
//
//   node scripts/optimization/dependency-graph.cjs [--case a] [--json out.json] [--md out.md] [--flags "SYLLABUS_CHECK_COURSE_CONTEXT=scoped,..."]
//
// "Re-asked" counts relationships sent to the model (both the legacy scored/advisory pairs and the Policy V2 ones); the breakdown by relationship type is the
// measured dependency of the edited field. Nothing here changes the checker: it is an experiment over the existing reuse (gemini.js pairKey / reusableJudgements).
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
process.chdir(ROOT);
const L = require(path.join(ROOT, 'scripts/live-claude/lib.cjs')), F = require(path.join(ROOT, 'scripts/live-claude/fixtures.cjs'));
const gemini = require(path.join(ROOT, 'server/lib/syllabuscheck/gemini'));
const svc = require(path.join(ROOT, 'server/lib/compliance/service')), repo = require(path.join(ROOT, 'server/lib/syllabuscheck/repository'));
const { createMemoryDb } = require(path.join(ROOT, 'server/lib/syllabuscheck/vpaa-conformance/memdb'));
const argv = process.argv.slice(2), arg = (name, dflt) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : dflt; };
const caseId = arg('case', 'a'), jsonOut = arg('json', ''), mdOut = arg('md', '');
const flags = Object.fromEntries((arg('flags', '') || '').split(',').filter(Boolean).map((kv) => kv.split('=')));

const revise = (text) => String(text) + ' (revised)';
const row = (c, week) => c.plan.find((r) => String(r.week) === String(week));
const EDITS = [
  { id: 'title', label: 'Course title', apply: (c) => { c.meta.title = revise(c.meta.title); } },
  { id: 'description', label: 'Course description', apply: (c) => { c.description[0].t = revise(c.description[0].t); } },
  { id: 'clo1-statement', label: 'CLO 1 statement', apply: (c) => { c.clos[0].statement = revise(c.clos[0].statement); } },
  { id: 'clo2-statement', label: 'CLO 2 statement', apply: (c) => { c.clos[1].statement = revise(c.clos[1].statement); } },
  { id: 'clo1-level', label: 'CLO 1 classification level', apply: (c) => { c.clos[0].level = c.clos[0].level === 'Introductory' ? 'Intermediate' : 'Introductory'; } },
  { id: 'clo1-po-map', label: 'CLO 1 PO mapping', apply: (c) => { c.clos[0].pos = [...(c.clos[0].pos || []), 2]; } },
  { id: 'w5-content', label: 'Week 5 content', apply: (c) => { row(c, 5).contents = revise(row(c, 5).contents); } },
  { id: 'w5-ilo', label: 'Week 5 ILO', apply: (c) => { row(c, 5).ilos[0].text = revise(row(c, 5).ilos[0].text); } },
  { id: 'w5-activity', label: 'Week 5 activities', apply: (c) => { row(c, 5).activities = revise(row(c, 5).activities); } },
  { id: 'w5-task', label: 'Week 5 tasks', apply: (c) => { row(c, 5).tasks = revise(row(c, 5).tasks); } },
  { id: 'w5-value', label: 'Week 5 values', apply: (c) => { row(c, 5).values = revise(row(c, 5).values); } },
  { id: 'w1-content', label: 'Week 1 content', apply: (c) => { row(c, 1).contents = revise(row(c, 1).contents); } },
  { id: 'reference', label: 'A reference (books)', apply: (c) => { c.refs.books.items[0].t = revise(c.refs.books.items[0].t); } },
  { id: 'po-master', label: 'Institutional PO 1 wording (reference version)', apply: (c, m) => { m.pos[0].text = revise(m.pos[0].text); c.outcomes.pos[0].text = m.pos[0].text; m.fingerprint = 'dg-2'; } },
];

async function main() {
  const fx = F.load(caseId), masters = structuredClone(fx.masters);
  masters.synthetic = false; masters.fingerprint = 'dg-1';
  const original = repo.mastersFor; repo.mastersFor = async () => masters;
  const transportFor = (asked) => {
    const inner = L.harness.scriptedTransport(() => undefined);
    return async (url, init) => { try { for (const p of (JSON.parse(JSON.parse(String(init.body)).messages[0].content).document_data || [])) asked.push({ type: p.type, id: p.id }); } catch { /* not a relationship request */ } return inner(url, init); };
  };
  const check = async (db, content, store, asked) => {
    const env = L.anthropicEnv({ key: L.STAND_IN_KEY, cap: 1000, maxRequests: 500, mode: 'comprehensive', extra: flags });
    const budget = gemini.createRequestBudget(env);
    const result = await svc.checkHybrid(db, content, { syllabusId: 100, env, transport: transportFor(asked), requestBudget: budget, linkChecker: async (url) => ({ url, status: 'ok', httpStatus: 200 }) });
    if (store) await svc.storeRun(db, { syllabusId: 100, versionId: null, content, result, createdBy: 26, ai: true });
    return { result, requests: budget.summary().requests };
  };
  const out = { case: caseId, flags, baseline: null, edits: [] };
  try {
    const base = structuredClone(fx.content), db = createMemoryDb({ syllabus: { content: JSON.stringify(base) } });
    const first = []; const f = await check(db, base, true, first);
    const total = first.length;
    out.baseline = { requests: f.requests, relationshipsAsked: total, byType: histogram(first) };
    const zero = []; const again = await check(db, base, false, zero);
    out.unchanged = { requests: again.requests, relationshipsAsked: zero.length };
    for (const edit of EDITS) {
      const content = structuredClone(base), m = structuredClone(masters);
      edit.apply(content, m);
      repo.mastersFor = async () => m;
      const asked = [];
      const r = await check(db, content, false, asked);
      repo.mastersFor = async () => masters;
      out.edits.push({ id: edit.id, label: edit.label, requests: r.requests, relationshipsAsked: asked.length, share: Math.round((asked.length / total) * 1000) / 10, byType: histogram(asked), weeks: [...new Set(asked.map((a) => /^row(\d+)-/.exec(a.id)?.[1]).filter((x) => x !== undefined))].length });
    }
  } finally { repo.mastersFor = original; }
  const lines = [`# Measured dependency matrix (case ${caseId}${Object.keys(flags).length ? ', flags ' + JSON.stringify(flags) : ', default flags'})`, '',
    `Full check: ${out.baseline.requests} requests, ${out.baseline.relationshipsAsked} relationships sent. Unchanged re-check: ${out.unchanged.requests} requests, ${out.unchanged.relationshipsAsked} relationships.`, '',
    '| Edit | Requests | Relationships re-asked | % of full | Re-asked by type |', '|---|---:|---:|---:|---|',
    ...out.edits.map((e) => `| ${e.label} | ${e.requests} | ${e.relationshipsAsked} | ${e.share}% | ${Object.entries(e.byType).map(([t, n]) => `${t} ${n}`).join(', ') || 'none'} |`)];
  console.log(lines.join('\n'));
  if (jsonOut) require('node:fs').writeFileSync(jsonOut, JSON.stringify(out, null, 2));
  if (mdOut) require('node:fs').writeFileSync(mdOut, lines.join('\n') + '\n');
}
function histogram(list) { return list.reduce((m, x) => ({ ...m, [x.type]: (m[x.type] || 0) + 1 }), {}); }
main().catch((error) => { console.error(error); process.exit(1); });
