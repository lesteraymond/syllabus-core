#!/usr/bin/env node
'use strict';
// Stage S7: provider scoring drift, offline. Compares two whole-pipeline evaluation results (scripts/live-pipeline-eval.cjs --out) of the same synthetic
// syllabi under the same settings, by two providers or models (or by one model twice, for the run-to-run noise floor), syllabus by syllabus with the
// Phase 3 comparator (server/lib/syllabuscheck/eval/providerDrift.js compareProviders, phase3/score.js comparePairedOfficial): no scoring drift,
// advisory-only changes, score-only drift, pass/fail-changing drift at 79, or submission-gate differences, and every scored relationship that differs.
//
//   node scripts/report-provider-drift.cjs --baseline <result.json> --candidate <result.json> [--format markdown|json] [--out <new file>]
//
// Strictly offline: it refuses --live and --confirm-paid, reads the two files and compares them inside withNoNetwork(), calls no provider and no
// database, and changes neither file (--out must be a new file). Two results whose prompt version, prompt trim or --legacy differ are refused: their
// difference would not be the provider's alone. It reports what WOULD differ; it changes no official score, pass mark, penalty, readiness or gate.
const fs = require('node:fs');
const path = require('node:path');
const { withNoNetwork } = require('../server/lib/syllabuscheck/eval/phase3/oracle');
const { compareProviders, DRIFT_CATEGORIES } = require('../server/lib/syllabuscheck/eval/providerDrift');

const args = process.argv.slice(2);
if (args.some(a => /^--(live|confirm-paid)(=|$)/.test(a))) {
  console.error('REFUSED: report-provider-drift.cjs is strictly OFFLINE: it compares two result files and calls no provider.');
  process.exit(2);
}
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback; };
const baselineFile = flag('baseline', ''), candidateFile = flag('candidate', ''), format = flag('format', args.includes('--json') ? 'json' : 'markdown'), out = flag('out', '');
if (!baselineFile || !candidateFile) { console.error('--baseline and --candidate name two result files of scripts/live-pipeline-eval.cjs.'); process.exit(2); }
if (!['markdown', 'json'].includes(format)) { console.error('--format must be markdown or json'); process.exit(2); }
if (out && fs.existsSync(out)) { console.error(`${out} already exists: a report never overwrites a file. Name a new --out file.`); process.exit(2); }
function read(file) {
  let report;
  try { report = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { console.error(`${file} cannot be read as JSON (${error.message})`); process.exit(2); }
  if (!report || !Array.isArray(report.results)) { console.error(`${file} is not a result file of scripts/live-pipeline-eval.cjs (it has no results)`); process.exit(2); }
  return report;
}

const cell = text => String(text ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const scoreOf = (score, provisional) => (score === null || score === undefined ? `none (provisional ${provisional ?? 'n/a'})` : String(score));
function renderMarkdown(drift, files) {
  const first = drift.pairs[0].comparison;
  const lines = [
    '# Provider scoring drift (offline)',
    '',
    `- **Baseline:** \`${drift.baseline.label}\` (${files.baseline}; generated ${drift.baseline.generated || 'n/a'}${drift.baseline.evaluationOnly ? '; evaluation only' : ''})`,
    `- **Candidate:** \`${drift.candidate.label}\` (${files.candidate}; generated ${drift.candidate.generated || 'n/a'}${drift.candidate.evaluationOnly ? '; evaluation only' : ''})`,
    `- **Shared settings:** prompt \`${first.prompts.legacy}\`; ${drift.shared.prompt || 'full'} prompt; ${drift.shared.legacy ? 'every stage off (--legacy)' : 'every stage on'}`,
    ...(drift.sameProviderAndModel ? ['- **Same provider and model on both sides:** this is the run-to-run noise floor, not a difference between providers.'] : []),
    `- **Basis:** ${drift.agreementNote}. Nothing here changes an official score, the pass mark (79), a penalty, readiness or a submission gate: it reports what would differ if the candidate's verdicts stood where the baseline's do.`,
    '',
    '## Summary',
    '',
    '| Primary category | Syllabi |',
    '|---|---:|',
    ...Object.entries(DRIFT_CATEGORIES).map(([key, label]) => `| ${label} (\`${key}\`) | ${drift.categories[key]} |`),
    '',
    '## Per syllabus',
    '',
    '| Syllabus | Scored (same / differ / total) | Score (baseline -> candidate) | Pass@79 | Ready | Gates changed | Primary category | All categories |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const p of drift.pairs) {
    const c = p.comparison;
    lines.push(`| ${cell(p.syllabus)}${p.partial ? ' (PARTIAL: a run stopped during it)' : ''} | ${c.scoredJudgments.identicalCount} / **${c.scoredJudgments.differentCount}** / ${c.scoredJudgments.totalEnhanced} | ${scoreOf(c.scores.legacyScore, c.scores.legacyProvisionalScore)} -> ${scoreOf(c.scores.enhancedScore, c.scores.enhancedProvisionalScore)} (${c.scores.scoreDelta >= 0 ? '+' : ''}${c.scores.scoreDelta}) | ${c.passFailAt79.legacyPassed ? 'PASS' : 'FAIL'} -> ${c.passFailAt79.enhancedPassed ? 'PASS' : 'FAIL'}${c.passFailAt79.passChanged ? ' (**FLIPPED**)' : ''} | ${c.submissionReadiness.legacyReady} -> ${c.submissionReadiness.enhancedReady}${c.submissionReadiness.readyChanged ? ' (**CHANGED**)' : ''} | ${c.submissionGates.gatesChanged ? `**yes** (${c.submissionGates.legacyGates.join(', ') || 'none'} -> ${c.submissionGates.enhancedGates.join(', ') || 'none'})` : 'no'} | **${c.drift.categoryLabel}** | ${c.drift.categoryLabels.join(', ')} |`);
  }
  if (drift.unpaired.baselineOnly.length || drift.unpaired.candidateOnly.length) {
    lines.push('', `Not compared (checked on one side only, or without an official result): baseline ${drift.unpaired.baselineOnly.join(', ') || 'none'}; candidate ${drift.unpaired.candidateOnly.join(', ') || 'none'}.`);
  }
  lines.push('', '## Scored relationships that differ', '');
  for (const p of drift.pairs) {
    const diffs = p.comparison.scoredJudgments.diffs;
    lines.push(`### ${cell(p.syllabus)}`);
    if (!diffs.length) { lines.push('', 'None.', ''); continue; }
    lines.push('', '| Relationship | Type | Path | Baseline (points) | Candidate (points) | Delta | Effect |', '|---|---|---|---|---|---:|---|');
    for (const d of diffs) lines.push(`| \`${d.id}\` | \`${d.type}\` | \`${cell(d.path)}\` | \`${d.legacyLabel}\` (-${d.legacyPoints}) | \`${d.enhancedLabel}\` (-${d.enhancedPoints}) | ${d.pointsDelta > 0 ? '+' : ''}${d.pointsDelta} | ${cell(d.scoringEffect)} |`);
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

(async () => {
  const baseline = read(baselineFile), candidate = read(candidateFile);
  const drift = await withNoNetwork(async () => compareProviders(baseline, candidate));
  if (drift.settingsDiffer.length) {
    console.error(`REFUSED: the two results differ in ${drift.settingsDiffer.map(d => `${d.setting} (${JSON.stringify(d.baseline)} vs ${JSON.stringify(d.candidate)})`).join(', ')}, so their difference would not be the provider's alone.`);
    process.exit(2);
  }
  if (!drift.pairs.length) { console.error('REFUSED: no syllabus was checked on both sides with an official result (officialDetail, which result files written before Stage S7 do not keep).'); process.exit(2); }
  const report = { baselineFile, candidateFile, ...drift, shared: { promptVersion: baseline.promptVersion ?? null, prompt: baseline.prompt ?? null, legacy: !!baseline.legacy } };
  const output = format === 'json' ? JSON.stringify(report, null, 2) + '\n' : renderMarkdown(report, { baseline: baselineFile, candidate: candidateFile });
  if (out) { fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(out, output, { encoding: 'utf8', flag: 'wx' }); }
  process.stdout.write(output);
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
