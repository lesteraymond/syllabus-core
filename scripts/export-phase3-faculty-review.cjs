#!/usr/bin/env node
'use strict';
// Stage E.9 Phase 3, Layer A (Part 2): Offline faculty-review package exporter CLI.
// Usage:
//   node scripts/export-phase3-faculty-review.cjs [--out-dir docs/faculty-review/phase3]
// Strictly offline: refuses any --live or --confirm-paid flag, runs inside withNoNetwork(),
// touches no database, and leaves all historical evaluation ledgers untouched.
const path = require('node:path');
const { writePhase3FacultyReviewPackage } = require('../server/lib/syllabuscheck/eval/phase3/facultyExport');

const args = process.argv.slice(2);
if (args.some(a => a === '--live' || a === '--confirm-paid' || a.startsWith('--live=') || a.startsWith('--confirm-paid='))) {
  console.error('REFUSED: export-phase3-faculty-review.cjs is strictly OFFLINE (Phase 3 Layer A, Part 2). Paid or live provider modes are not permitted.');
  process.exit(2);
}

const flag = (name, fallback) => {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith('--') ? args[idx + 1] : fallback;
};

const defaultOutDir = path.join(__dirname, '..', 'docs', 'faculty-review', 'phase3');
const outDir = path.resolve(process.cwd(), flag('out-dir', defaultOutDir));

(async () => {
  const res = await writePhase3FacultyReviewPackage(outDir);
  const c = res.package.counts;
  console.log(
    `wrote Phase 3 faculty-review package to ${path.relative(process.cwd(), res.outDir) || res.outDir} ` +
      `(${c.totalRecords} records: ${c.defectExpectationRecords} defect expectations, ${c.openAdjudicationRecords} open adjudication, ` +
      `${c.deterministicEdgeRecords} deterministic edges; ${c.recommendationReviewTopicsCount} recommendation review topics; ` +
      `status: ${res.package.status}; autoPopulatedFacultyVerdicts: ${res.package.autoPopulatedFacultyVerdicts})`
  );
})().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
