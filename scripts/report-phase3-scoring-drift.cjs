#!/usr/bin/env node
'use strict';
// Stage E.9 Phase 3, Layer A (Part 2): Read-only Paired Official Scoring Drift CLI.
// Compares Path A (Legacy all-off prompt: alignment-10) vs Path B (Enhanced all-on prompt: alignment-12ab34c1c2d1d2-r8)
// using the deterministic Phase 3 oracle and scoring comparator.
//
// Usage:
//   node scripts/report-phase3-scoring-drift.cjs [--scenario all|identical|identical-aligned|identical-misaligned|score-only|pass-flip|pass-flip-92-78|pass-flip-100-76|gate-diff] [--variant <id>] [--format markdown|json] [--out <file>]
//
// Strictly offline: refuses --live or --confirm-paid, runs inside withNoNetwork(), makes zero provider or DB calls,
// and never touches any historical evaluation ledger.
const fs = require('node:fs');
const path = require('node:path');
const { withNoNetwork } = require('../server/lib/syllabuscheck/eval/phase3/oracle');
const { runPairedDriftScenarios } = require('../server/lib/syllabuscheck/eval/phase3/score');

const args = process.argv.slice(2);
if (args.some(a => a === '--live' || a === '--confirm-paid' || a.startsWith('--live=') || a.startsWith('--confirm-paid='))) {
  console.error('REFUSED: report-phase3-scoring-drift.cjs is strictly OFFLINE (Phase 3 Layer A, Part 2). Paid or live provider modes are not permitted.');
  process.exit(2);
}

const flag = (name, fallback) => {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith('--') ? args[idx + 1] : fallback;
};

const VALID_SCENARIOS = new Set([
  'all',
  'identical',
  'identical-aligned',
  'identical-misaligned',
  'score-only',
  'score-only-drift',
  'pass-flip',
  'pass-flip-92-78',
  'pass-flip-100-76',
  'gate-diff',
  'submission-gate-differences',
]);

const scenarioArg = flag('scenario', 'all');
if (!VALID_SCENARIOS.has(scenarioArg)) {
  console.error(`Invalid --scenario "${scenarioArg}". Allowed: ${[...VALID_SCENARIOS].join(', ')}`);
  process.exit(2);
}

const variantArg = flag('variant', null);
const formatArg = flag('format', args.includes('--json') ? 'json' : 'markdown');
const outArg = flag('out', null);

function formatScore(s, prov) {
  if (s === null || s === undefined) return `null (provisional ${prov ?? 'n/a'})`;
  return String(s);
}

function renderMarkdownReport(report) {
  const pol = report.policyReconciliation;
  const lines = [
    '# Stage E.9 Phase 3 — Paired Official Scoring Drift Report (Offline)',
    '',
    `- **Execution Mode:** \`OFFLINE ONLY\` (\`offline: ${report.offline}\`, \`ledgerTouched: ${report.ledgerTouched}\`)`,
    `- **Agreement Basis:** ${report.agreementNote}`,
    `- **Scoring Policy Version:** \`${pol.policyVersion}\` (Passing mark: \`${pol.passMark}\`; \`NOT_ALIGNED = -${pol.penalties.NOT_ALIGNED}\`, \`PARTIALLY_ALIGNED = -${pol.penalties.PARTIALLY_ALIGNED}\`, \`ALIGNED = 0\`, \`SEM-TAG re-tag = 0\`)`,
    '',
    '## 1. Reconciliation: Six vs. Eight Scored Relationship Types',
    '',
    `- **Officially Scored Relationship Types (${pol.scoredRelationshipTypesCount}):** ${pol.scoredRelationshipTypes.map(t => `\`${t}\``).join(', ')}`,
    `- **Legacy Planned Non-Whole-List Types (${pol.legacyPlannedNonWholeListTypesCount}):** ${pol.legacyPlannedNonWholeListTypes.map(t => `\`${t}\``).join(', ')}`,
    `- **Legacy Advisory Types (${pol.legacyAdvisoryRelationshipTypes.length}, 0 points):** ${pol.legacyAdvisoryRelationshipTypes.map(t => `\`${t}\``).join(', ')}`,
    `- **Staged Advisory Types (${pol.stagedAdvisoryRelationshipTypes.length}, 0 points):** ${pol.stagedAdvisoryRelationshipTypes.map(t => `\`${t}\``).join(', ')}`,
    `- **Policy Consistency Check:** \`${pol.policyConsistent}\``,
    '',
    `> ${pol.reconciliationNote}`,
    '',
    '## 2. Paired Comparison Summary Across Scenarios',
    '',
    '| Scenario | Prompts (Legacy vs Enhanced) | Scored (Same / Diff / Total) | Score (Leg -> Enh, Delta) | Deductions (Leg -> Enh, Delta) | Pass@79 (Leg -> Enh) | Ready (Leg -> Enh) | Gates Changed? | Advisory Added | Primary Drift Classification | All Classifications |',
    '|---|---|---|---|---|---|---|---|---:|---|---|',
  ];

  for (const s of report.scenarios) {
    const c = s.comparison;
    const scoreStr = `${formatScore(c.scores.legacyScore, c.scores.legacyProvisionalScore)} -> ${formatScore(c.scores.enhancedScore, c.scores.enhancedProvisionalScore)} (${c.scores.scoreDelta >= 0 ? '+' : ''}${c.scores.scoreDelta})`;
    const dedStr = `${c.deductions.legacyTotal} -> ${c.deductions.enhancedTotal} (${c.deductions.totalDelta >= 0 ? '+' : ''}${c.deductions.totalDelta})`;
    const passStr = `${c.passFailAt79.legacyPassed ? 'PASS' : 'FAIL'} -> ${c.passFailAt79.enhancedPassed ? 'PASS' : 'FAIL'}${c.passFailAt79.passChanged ? ' (**FLIPPED**)' : ''}`;
    const readyStr = `${c.submissionReadiness.legacyReady} -> ${c.submissionReadiness.enhancedReady}${c.submissionReadiness.readyChanged ? ' (**CHANGED**)' : ''}`;
    const gatesStr = c.submissionGates.gatesChanged
      ? `**YES** (${c.submissionGates.legacyGates.join(', ') || 'none'} -> ${c.submissionGates.enhancedGates.join(', ') || 'none'})`
      : `No (${c.submissionGates.enhancedGates.length} gate(s))`;
    lines.push(
      `| \`${s.scenarioId}\` | \`${c.prompts.legacy}\` vs \`${c.prompts.enhanced}\` | ${c.scoredJudgments.identicalCount} / **${c.scoredJudgments.differentCount}** / ${c.scoredJudgments.totalEnhanced} | ${scoreStr} | ${dedStr} | ${passStr} | ${readyStr} | ${gatesStr} | +${c.advisoryFindings.advisoryAddedByStagesCount} | **${c.drift.categoryLabel}** (\`${c.drift.category}\`) | ${c.drift.categoryLabels.join(', ')} |`
    );
  }

  lines.push('', '## 3. Detailed Breakdown of Differing Scored Relationships', '');

  for (const s of report.scenarios) {
    const c = s.comparison;
    lines.push(`### ${s.title} (\`${s.scenarioId}\`)`);
    lines.push(`- **Course:** ${s.program} (${s.curriculumYear}) — ${s.courseCode} ${s.courseTitle}`);
    lines.push(`- **Primary Classification:** **${c.drift.categoryLabel}** (\`${c.drift.category}\`)`);
    lines.push(`- **All Classifications:** ${c.drift.categoryLabels.map((l, i) => `${l} (\`${c.drift.categories[i]}\`)`).join(', ')}`);
    lines.push(`- **Summary:** ${c.drift.summary}`);

    if (c.scoredJudgments.diffs.length === 0) {
      lines.push('- **Differing Scored Relationships:** None (`0` differences across all 76 officially scored relationships).', '');
      continue;
    }

    lines.push(
      '',
      '| Relationship ID | Scored Type | Syllabus Path | Legacy Judgment (Pts) | Enhanced Judgment (Pts) | Pts Delta | Source & Target Evidence Quotes | Final Scoring Effect |',
      '|---|---|---|---|---|---:|---|---|'
    );
    for (const d of c.scoredJudgments.diffs) {
      const sq = d.enhancedEvidence?.sourceQuote || d.legacyEvidence?.sourceQuote || '(none)';
      const tq = d.enhancedEvidence?.targetQuote || d.legacyEvidence?.targetQuote || '(none)';
      const quotesCell = `src: "${sq.slice(0, 70)}" / tgt: "${tq.slice(0, 70)}"`.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
      const deltaStr = d.pointsDelta > 0 ? `+${d.pointsDelta}` : String(d.pointsDelta);
      lines.push(
        `| \`${d.id}\` | \`${d.type}\` | \`${d.path}\` | \`${d.legacyLabel}\` (-${d.legacyPoints}) | \`${d.enhancedLabel}\` (-${d.enhancedPoints}) | ${deltaStr} | ${quotesCell} | ${d.scoringEffect} |`
      );
    }
    lines.push('');
  }

  return lines.join('\n') + '\n';
}

(async () => {
  const report = await withNoNetwork(() =>
    runPairedDriftScenarios({
      scenario: scenarioArg,
      variant: variantArg,
    })
  );

  const output = formatArg === 'json' ? JSON.stringify(report, null, 2) + '\n' : renderMarkdownReport(report);
  if (outArg) {
    const absOut = path.resolve(process.cwd(), outArg);
    fs.mkdirSync(path.dirname(absOut), { recursive: true });
    fs.writeFileSync(absOut, output, 'utf8');
  }
  process.stdout.write(output);
})().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
