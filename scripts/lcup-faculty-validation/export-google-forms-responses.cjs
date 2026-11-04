'use strict';
/**
 * LCUP Syllabus Management System — Faculty Validation Pilot
 * Google Forms Response Exporter & Pre-Adjudication Processor
 *
 * Governance Rule:
 *   Faculty responses are NEVER automatically treated as final adjudicated ground truth.
 *   Discipline Adjudicator review (ADJ-IT-01, ADJ-IE-01, ADJ-CPE-01) is strictly required
 *   before any entry can achieve reviewStatus "adjudicated".
 *
 * Usage:
 *   node scripts/lcup-faculty-validation/export-google-forms-responses.cjs \
 *     --it202-csv responses/it202.csv \
 *     --ie402-csv responses/ie402.csv \
 *     --cpe304-csv responses/cpe304.csv \
 *     --out docs/lcup-faculty-validation-1/coordinator-only/adjudication.draft.json
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DATASET_FILE = path.join(ROOT, 'docs', 'lcup-faculty-validation-1', 'coordinator-only', 'validation-dataset.json');
const TEMPLATE_FILE = path.join(ROOT, 'docs', 'lcup-faculty-validation-1', 'coordinator-only', 'adjudication.template.json');

function parseSimpleCsv(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) return [];
  const parseRow = row => {
    const entries = [];
    let inside = false, current = '';
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') {
        if (inside && row[i + 1] === '"') { current += '"'; i++; }
        else { inside = !inside; }
      } else if (c === ',' && !inside) {
        entries.push(current.trim());
        current = '';
      } else {
        current += c;
      }
    }
    entries.push(current.trim());
    return entries;
  };

  const headers = parseRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(lines[i]);
    if (row.length === headers.length) {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = row[idx]; });
      rows.push(obj);
    }
  }
  return rows;
}

function processResponses(itRows, ieRows, cpeRows, { log = () => {} } = {}) {
  const dataset = JSON.parse(fs.readFileSync(DATASET_FILE, 'utf8'));
  const template = JSON.parse(fs.readFileSync(TEMPLATE_FILE, 'utf8'));

  // Sort rows chronologically so later responses supersede earlier duplicates
  const allRows = [...itRows, ...ieRows, ...cpeRows].sort((a, b) => {
    const tA = Date.parse(a['Timestamp'] || '') || 0;
    const tB = Date.parse(b['Timestamp'] || '') || 0;
    return tA - tB;
  });

  const byCase = new Map();
  for (const c of dataset.cases) {
    byCase.set(c.caseId, {
      case: c,
      responses: new Map() // reviewerId -> entry
    });
  }

  // Parse fields
  for (const row of allRows) {
    const reviewerId = (row['Reviewer Identification Code'] || row['Reviewer ID'] || 'UNKNOWN').trim();
    const timestamp = row['Timestamp'] || new Date().toISOString();

    for (const [header, val] of Object.entries(row)) {
      const match = header.match(/\[(FV-\d\d)\]\s*(Academic Alignment Judgment|Academic Justification|Supporting Syllabus Evidence|Recommended Correction)/i);
      if (match) {
        const caseId = match[1];
        const fieldType = match[2];
        const record = byCase.get(caseId);
        if (record) {
          let reviewerEntry = record.responses.get(reviewerId);
          if (!reviewerEntry) {
            reviewerEntry = { reviewerId, timestamp, history: [], judgment: '', explanation: '', evidence: '', correction: '' };
            record.responses.set(reviewerId, reviewerEntry);
          } else if (reviewerEntry.timestamp !== timestamp) {
            // Track duplicate submission history
            reviewerEntry.history.push({
              timestamp: reviewerEntry.timestamp,
              judgment: reviewerEntry.judgment,
              explanation: reviewerEntry.explanation
            });
            log(`Reviewer ${reviewerId} resubmitted ${caseId} at ${timestamp}; superseding earlier submission from ${reviewerEntry.timestamp}`);
            reviewerEntry.timestamp = timestamp;
          }

          if (/Judgment/i.test(fieldType)) reviewerEntry.judgment = val.trim();
          else if (/Justification|Explanation/i.test(fieldType)) reviewerEntry.explanation = val.trim();
          else if (/Evidence/i.test(fieldType)) reviewerEntry.evidence = val.trim();
          else if (/Correction/i.test(fieldType)) reviewerEntry.correction = val.trim();
        }
      }
    }
  }

  // Populate draft adjudication structure
  const resultAdjudications = template.adjudications.map(adj => {
    const caseData = byCase.get(adj.validationCaseId);
    if (!caseData || !caseData.responses.size) return adj;

    const resps = Array.from(caseData.responses.values());
    const reviewerIds = resps.map(r => r.reviewerId);
    const judgments = resps.map(r => r.judgment).filter(Boolean);
    const uniqueJudgments = [...new Set(judgments)];
    const isUnanimous = uniqueJudgments.length === 1 && resps.length >= 2;

    // Check if INSUFFICIENT_EVIDENCE is selected
    const hasInsufficient = uniqueJudgments.includes('INSUFFICIENT_EVIDENCE');

    // STRICT GOVERNANCE:
    // Status is NEVER marked 'adjudicated' automatically.
    // It is marked 'pending_adjudication' if reviewers completed review,
    // and adjudicatorId remains null until human sign-off!
    const reviewStatus = resps.length >= 2
      ? (isUnanimous ? 'pending_adjudication_unanimous' : 'requires_adjudication_split')
      : 'in_progress';

    const preliminaryReason = isUnanimous
      ? `Reviewers agreed on ${uniqueJudgments[0]}. Reviewer notes: ${resps.map(r => r.reviewerId + ': "' + r.explanation + '"').join(' | ')}`
      : `Reviewers split: ${resps.map(r => r.reviewerId + '=' + r.judgment).join(' vs ')}. Reviewer notes: ${resps.map(r => r.reviewerId + ': "' + r.explanation + '"').join(' | ')}`;

    // For INSUFFICIENT_EVIDENCE, preserve explanation if no direct quote was found
    const evidenceText = resps.map(r => r.evidence).filter(Boolean).join('; ');

    return {
      ...adj,
      reviewStatus,
      reviewerIds,
      adjudicatorId: null, // STRICT: Must be filled by human adjudicator
      reviewedAt: null,    // STRICT: Must be filled upon human session completion
      acceptedJudgments: [], // STRICT: Frozen only after human adjudicator determination
      ambiguous: !isUnanimous,
      preliminaryReviewerJudgments: uniqueJudgments,
      reason: preliminaryReason,
      sourceEvidence: hasInsufficient ? null : (resps[0]?.evidence || null),
      targetEvidence: hasInsufficient ? null : (resps[0]?.evidence || null),
      missingEvidenceExplanation: hasInsufficient ? evidenceText : null,
      recordRef: 'GoogleForms_Export_' + adj.validationCaseId,
      adjudicatorSignOffRequired: true
    };
  });

  return {
    ...template,
    provenance: 'faculty-responses-awaiting-human-adjudication',
    adjudications: resultAdjudications
  };
}

module.exports = { parseSimpleCsv, processResponses };

if (require.main === module) {
  console.log('Google Forms Response Exporter module loaded.');
}
