'use strict';
// Offline report only: reads the completed comparison evidence, makes no model request.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const base = path.join(root, 'docs/ai-checker-sample-comparison-2026-11-05');
const dir = path.join(base, 'attempt-2');
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name)));
const result = read('result.json');
if (!result.after) throw Error('A finished recheck is required to make this comparison report');
const before = read('original-report.json'), after = read('revised-report.json');
const { edits, excluded } = read('edits.json');
const metadata = read('metadata.json');
const original = read('original.json'), revised = read('revised.json');
const old = new Map(before.hybrid.alignment.judgements.map(j => [j.id, j]));
const now = new Map(after.hybrid.alignment.judgements.map(j => [j.id, j]));
const rank = { ALIGNED: 0, PARTIALLY_ALIGNED: 1, NOT_ALIGNED: 2 };
const shared = [...now.values()].filter(j => old.has(j.id));
const comparable = shared.filter(j => !j.unverified && !old.get(j.id).unverified && j.label in rank && old.get(j.id).label in rank);
const changes = comparable.map(j => ({ id: j.id, type: j.type, from: old.get(j.id).label, to: j.label, explanation: j.explanation, direction: rank[j.label] < rank[old.get(j.id).label] ? 'improved' : rank[j.label] > rank[old.get(j.id).label] ? 'worsened' : 'same' }));
const count = values => values.reduce((acc, key) => { acc[key] = (acc[key] || 0) + 1; return acc; }, {});
const totals = count(changes.map(j => j.direction));
const added = [...now.keys()].filter(id => !old.has(id)), removed = [...old.keys()].filter(id => !now.has(id));
const initial = JSON.parse(fs.readFileSync(path.join(base, 'result.json')));
const intact = crypto.createHash('sha256').update(fs.readFileSync(result.source.pdf)).digest('hex') === result.source.sha256;
const metrics = { shared: shared.length, comparable: comparable.length, improved: totals.improved || 0, worsened: totals.worsened || 0, same: totals.same || 0, added, removed, beforeLabels: count(before.hybrid.alignment.judgements.map(j => j.unverified ? 'UNVERIFIED' : j.label)), afterLabels: count(after.hybrid.alignment.judgements.map(j => j.unverified ? 'UNVERIFIED' : j.label)), sourcePdfUnchanged: intact, successfulModelRequests: result.usage.anthropic.modelsReturned, estimatedSuccessfulCostUsd: result.usage.anthropic.estimatedCost, conservativeGuardTotalUsd: result.usage.charged + initial.usage.charged, changes };
fs.writeFileSync(path.join(dir, 'comparison-metrics.json'), JSON.stringify(metrics, null, 2) + '\n');
const lines = [];
const add = (...s) => lines.push(...s);
const escape = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
add('# AI Checker sample comparison', '', 'Date: 5 November 2026 (Asia/Shanghai).', '',
  `**Observed result:** useful corrections, with mixed effects when accepted together. The same model rated ${metrics.improved} relationships better, ${metrics.worsened} worse and ${metrics.same} unchanged. Fully aligned relationships rose from ${metrics.beforeLabels.ALIGNED || 0} to ${metrics.afterLabels.ALIGNED || 0}. The revised copy remains experimental: ${after.hybrid.suggestions.length} suggestions and ${after.conformance.failed.length} blocking findings remain.`, '',
  '## What was tested', '',
  '- Repository sample: IT 202 - Computer Programming 1, BSIT, imported from `reference-data/IT-202-Programming-1.pdf` using the application importer and the existing real-syllabus fixture loader.',
  `- Live provider/model: ${metadata.provider.provider} / ${metadata.provider.model}. Every deeper optional stage and Policy V2 stayed off, as in the current configuration.`,
  `- The original produced ${before.hybrid.suggestions.length} suggestions. ${edits.length} AI text rewrites were applied together to a temporary JSON copy and the actual checker re-evaluated it. No Check & Improve approval is implied by this batch experiment.`,
  '- Two exact-reference corrections and one array-valued description rewrite were excluded from the experimental copy. All proposals remain in `attempt-2/suggestions.json`.',
  '- Link accessibility was checked once through the application code and reused for both versions. The model transport used the existing cost guard and spend register.',
  '- The test loaded no application database modules and saved no official score, syllabus, submission or approval.',
  `- The source PDF is unchanged (SHA-256 ${result.source.sha256}; verified after the run: ${intact}).`, '',
  '**Scope of the original:** ' + result.source.caveat, '',
  '## Comparison measured by the same model', '',
  `Both runs: original ${before.hybrid.alignment.status}; revised ${after.hybrid.alignment.status}. These are model judgments, not faculty-validated quality measurements.`, '',
  '| Measure | Original | Revised |', '|---|---:|---:|',
  `| Relationships with validated answers | ${before.hybrid.alignment.coverage.verified}/${before.hybrid.alignment.coverage.total} | ${after.hybrid.alignment.coverage.verified}/${after.hybrid.alignment.coverage.total} |`,
  ...['ALIGNED', 'PARTIALLY_ALIGNED', 'NOT_ALIGNED', 'INSUFFICIENT_EVIDENCE', 'UNVERIFIED'].map(k => `| ${k} | ${metrics.beforeLabels[k] || 0} | ${metrics.afterLabels[k] || 0} |`),
  `| Deterministic baseline | ${before.baseScore} | ${after.baseScore} |`,
  `| Diagnostic arithmetic (not an official grade) | ${before.hybrid.provisionalScore} | ${after.hybrid.provisionalScore} |`,
  `| Blocking findings in imported draft | ${before.conformance.failed.length} | ${after.conformance.failed.length} |`, '',
  `On ${comparable.length} comparable relationship IDs: **${metrics.improved} improved, ${metrics.worsened} worsened, ${metrics.same} unchanged**. Added IDs: ${added.length}; removed IDs: ${removed.length}. Changed CLO context can change judgments throughout the course.`, '',
  'A zero diagnostic result is the floor after accumulated deductions. Scores here are affected by imported metadata, blocking findings and the current scoring design; neither a score nor model agreement establishes academic validity.', '',
  '## Review of representative suggestions', '',
  'The comments below are an independent reading by the coding assistant, not a faculty review. Exact source text and proposed text for every experimental edit appear in the appendix.', '',
  '| Field | What the checker suggested | Review |', '|---|---|---|',
  '| Week 15 assessment | Replace C-program exercises with Java methods, parameter and recursion tasks, and specify output criteria. | Useful correction of a mismatch verified visually on PDF page 7. The proposal still needs an explicit debugging task to assess the debugging ILO; the new wording alone does not cover every ILO. |',
  '| Weeks 4-5 assessment | Replace the system-unit hardware simulation with a Java stream/file-processing program and a rubric. | More relevant to the existing stream ILO, but it adds file I/O requirements. The instructor must confirm the intended scope and available time. Original wording verified visually on PDF page 5. |',
  '| Weeks 3-4 ILO 1 | Replace “Demonstrate the skills by knowing...” with analyzing requirements and identifying Java constructs needed to meet them. | More observable and specific; it also expands the original expectation to requirements analysis. |',
  '| Weeks 4-5 values | Replace a list of traits with observable examples of help, reflection and community participation. | More actionable integration. Confirm that the named activities actually happen and that the wording follows institutional guidance. |',
  '| CLO 1 | Add “creatively design original Java-based solutions.” | Raises the expected cognitive level from defining/analyzing toward creating. This is a curriculum decision and can cause downstream alignment problems. Do not accept solely to satisfy a tag. |',
  '| Weeks 16-17 activity | Add group creation and presentation of a value web tied to the database program. | Makes the spirituality outcome visible, but adds workload and a presentation. Faculty must decide whether these belong in the lesson. |', '',
  '## Import issue found during source verification', '',
  `The source PDF page 1 says prerequisite **IT 101**. The imported JSON instead contains **${escape(original.meta.prereq)}**. The local curriculum reference agrees with IT 101. The experiment preserved the imported draft so the before/after AI comparison stayed reproducible; this import error was not repaired during the run.`, '',
  'Consequently, prerequisite warnings are evidence of an import problem, not proof of an author mistake. Other extracted text should also be verified before making academic decisions.', '',
  '## Relationships that worsened', '',
  'Two concrete tradeoffs deserve attention: the weeks 4-5 activities became entirely stream-focused and lost coverage of Java methods; the week 13 assessment became debugging-focused and lost direct array creation/manipulation evidence. These are shared fields supporting multiple ILOs. A replacement that fixes one relationship can weaken another. Changes to other fields and model variability also affect this comparison, so these results do not isolate each edit as the sole cause.', '',
  ...(changes.filter(j => j.direction === 'worsened').length ? changes.filter(j => j.direction === 'worsened').map(j => `- **${j.id} (${j.type})**: ${j.from} -> ${j.to}. ${j.explanation}`) : ['None among comparable, validated relationship IDs.']), '',
  '## Remaining blocking findings', '',
  ...after.conformance.failed.map(f => `- ${f.id}: ${f.message}`), '',
  'These flags describe the imported draft. Metadata, reference-group and mapping flags need source verification and faculty decisions rather than blind text substitution.', '',
  '## Recommended use after this experiment', '',
  '1. Fix or verify imported prerequisites and other source fields before interpreting checker findings.',
  '2. Select useful edits individually and use Check & Improve, especially for activities and assessments shared by multiple ILOs. This experiment tested the batch of offered drafts; it did not execute the individual Check & Improve workflow.',
  '3. Confirm CLO level, added file-I/O topics, group presentations and other workload changes with faculty. Where an existing outcome is sound but its tag is wrong, consider correcting the mapping rather than expanding the outcome.',
  '4. Have faculty compare original and revised text using the same rubric. This single model self-comparison supports usefulness for revision, not a measured accuracy rate or a production approval.', '',
  '## Cost and execution evidence', '',
  `Successful run: ${result.usage.model} model requests; token-based estimated cost **$${metrics.estimatedSuccessfulCostUsd.toFixed(4)}**, using the repository's pinned prices. This is a local estimate, not a provider invoice.`,
  `Total guard accounting including the initial failed sandbox network attempt: **$${metrics.conservativeGuardTotalUsd.toFixed(4)}**, below the $2 comparison limit. The failed attempt returned no usage; its $${initial.usage.charged.toFixed(4)} guard entry is a conservative worst-case reservation and does not demonstrate a billed charge.`, '',
  'Artifacts: `attempt-2/original.json`, `revised.json`, `original-report.json`, `revised-report.json`, `suggestions.json`, `edits.json`, `link-results.json`, `provider-ledger.json`, `comparison-metrics.json` and `result.json`. The parent result/ledger preserve the failed first attempt.', '',
  '## Exact before/after text for all experimental edits', '');
for (const [i, e] of edits.entries()) {
  const relevant = (e.basedOn || []).map(id => id.replace(/^SEM:/, '')).filter(id => old.has(id) && now.has(id));
  add(`### ${i + 1}. ${e.path}`, '', '**Original**', '', '```text', String(e.original), '```', '', '**Checker suggestion**', '', '```text', e.suggested, '```', '',
    'Related model verdicts: ' + relevant.map(id => `${id}: ${old.get(id).label} -> ${now.get(id).label}`).join('; '), '');
}
add('## Proposals not applied in this experiment', '', ...excluded.map(e => `- ${e.path} (${e.source || 'AI'}): ${e.reason}`), '');
fs.writeFileSync(path.join(base, 'COMPARISON.md'), lines.join('\n'));
console.log(JSON.stringify({ metrics: { ...metrics, changes: undefined }, report: path.join(base, 'COMPARISON.md'), edits: edits.length, originalTextCharacters: JSON.stringify(original).length, revisedTextCharacters: JSON.stringify(revised).length }, null, 2));
