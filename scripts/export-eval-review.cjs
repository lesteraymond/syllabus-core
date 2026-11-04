#!/usr/bin/env node
'use strict';
// Writes an evaluation dataset as a spreadsheet (CSV, opens in Excel) for FACULTY REVIEW.
//
//   node scripts/export-eval-review.cjs [--dataset general|alignment] [--result path/to/eval-result.json] [--out file.csv]
//
// Each row: the relationship type, the course and discipline, the source and target text exactly as the AI sees them, what the dataset author
// expects (and whether that is clear or ambiguous), the rationale and any diagnosis, optionally what the model answered in a given run, and
// EMPTY columns for the faculty verdict and notes. The author's expectations are shown so they can be challenged, not so they are accepted.
// For the alignment dataset the development and held-out items are both exported; faculty should review both, and an item reviewed by
// faculty can then be moved to the `faculty` track.
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback; };
const datasetName = flag('dataset', 'general');
const file = { general: 'dataset.json', alignment: 'alignment-dataset.json' }[datasetName];
if (!file) { console.error('--dataset must be general or alignment'); process.exit(2); }
const dataset = require(path.join(__dirname, '..', 'server', 'lib', 'syllabuscheck', 'eval', file));
const out = flag('out', path.join(__dirname, '..', 'docs', datasetName === 'alignment' ? 'ai-eval-faculty-review-alignment.csv' : 'ai-eval-faculty-review.csv'));
const resultFile = flag('result', '');
const result = resultFile ? JSON.parse(fs.readFileSync(resultFile, 'utf8')) : null;

const SHORT = { ALIGNED: 'Aligned', PARTIALLY_ALIGNED: 'Partially aligned', NOT_ALIGNED: 'Not aligned', INSUFFICIENT_EVIDENCE: 'Insufficient evidence' };
const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const columns = [
  'ID', 'Relationship type', 'Discipline', 'Course', 'Course title', 'Program / year', 'Set', 'Scenario', 'Source text', 'Target text',
  'Author expects', 'Clear or ambiguous', 'Author rationale', 'Diagnosis (awaiting faculty)', 'Where it came from',
  result ? `Model answered (${result.model}, prompt ${result.promptVersion}, ${result.runs} runs)` : 'Model answered',
  'FACULTY VERDICT (Aligned / Partially aligned / Not aligned)', 'FACULTY NOTES', 'Review status',
];
const rows = dataset.items.map((item) => {
  const course = dataset.courses[item.course];
  const got = result && result.perItem && result.perItem[item.id] ? result.perItem[item.id].map((l) => (l ? SHORT[l] : 'no valid answer')).join(' / ') : '';
  return [
    item.id, item.type, course.discipline || '', course.code, course.title, `${course.program}, year ${course.yearLevel}`,
    item.split === 'heldout' ? 'Held-out (do not show to the prompt authors)' : item.split === 'dev' ? 'Development' : '', item.category || '',
    item.source, item.target, item.accept.map((a) => SHORT[a]).join(' or '), item.ambiguous ? 'AMBIGUOUS (reasonable reviewers may differ)' : 'Clear', item.why,
    item.diagnosis ? `${item.diagnosis.finding} Proposal: ${item.diagnosis.proposal.accept.map((a) => SHORT[a]).join(' or ')} (not applied).` : '',
    item.origin ? `Original item ${item.id} of dataset ${item.origin}` : `Written for ${dataset.version}`,
    got, item.facultyVerdict || '', item.facultyNotes || '', item.reviewStatus || 'unreviewed',
  ];
});
const header = [`# ${dataset.status}`, `# Dataset ${dataset.version}. ${dataset.provenance || dataset.note}`, `# ${dataset.reviewProcess || 'Faculty: give your own verdict for each row and a note; where reviewers could differ, say so in the notes.'}`];
fs.writeFileSync(out, '﻿' + header.map(cell).join('\r\n') + '\r\n' + [columns, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n');
const col = (name) => columns.indexOf(name);
console.log(`wrote ${path.relative(process.cwd(), out)} (${rows.length} items, ${rows.filter((r) => r[col('Clear or ambiguous')].startsWith('AMBIGUOUS')).length} ambiguous, ${rows.filter((r) => r[col('Diagnosis (awaiting faculty)')]).length} disputed)`);
