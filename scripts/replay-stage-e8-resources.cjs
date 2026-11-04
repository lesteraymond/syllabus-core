#!/usr/bin/env node
'use strict';
// Pure offline replay of the 16 ALREADY SAVED Stage C r8 judgments. No model invocation, dotenv, DB, label edit or ledger write.
// node scripts/replay-stage-e8-resources.cjs [--write] --write creates a separate derived artifact, never overwrites a historical response.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const gemini = require('../server/lib/syllabuscheck/gemini');
const { RESOURCE_REVIEW_VERSION } = require('../server/lib/syllabuscheck/recommendationReview');
const { answerOf } = require('../server/lib/syllabuscheck/eval/answerReviews');
// The ledger input is the byte snapshot taken after the r8 runs (16 requests), the same bytes the first replay read from the live ledger. The live
// ledger keeps growing with later authorized runs, so it is not a reproducible input; its cumulative accounting is tested separately.
const inputs = ['docs/ai-eval-stage-e8-c-r8-regression.json', 'docs/ai-eval-stage-e8-c-r8-remaining.json', 'docs/ai-eval-stage-e8-c-ledger-before-resource-regression.json', 'server/lib/syllabuscheck/eval/stage-c-dataset.json'];
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const normalized = s => String(s || '').replace(/\s+/g, ' ').trim();
function replay() {
  const hashes = Object.fromEntries(inputs.map(file => [file, hash(file)]));
  const dataset = read(inputs[3]), records = [], seen = new Set();
  const C = { SYLLABUS_CHECK_STAGE_C1: 'on', SYLLABUS_CHECK_STAGE_C2: 'on' };
  for (const input of inputs.slice(0, 2)) {
    const result = read(input);
    assert.equal(result.promptVersion, 'alignment-12c1c2-r8');
    for (const request of result.requests) {
      const raw = JSON.parse(request.content);
      const pairs = raw.judgements.map(j => {
        const item = dataset.items.find(p => p.id === j.id);
        assert.ok(item && !seen.has(item.id));
        return { ...item, path: 'eval', targetPath: 'eval' };
      });
      const checked = gemini.validate(raw, pairs, gemini.contractOf(C, dataset.courses[pairs[0].course]));
      for (const j of checked) {
        seen.add(j.id);
        const before = result.answers[0][j.id], original = raw.judgements.find(r => r.id === j.id), pair = pairs.find(p => p.id === j.id);
        for (const key of ['label', 'explanation', 'sourceQuote', 'targetQuote', 'draft']) assert.equal(j[key], before[key], `${j.id}:${key}`);
        for (const key of ['sourceBloom', 'targetBloom']) assert.equal(j[key], original[key]);
        assert.deepEqual(j.aspects, before.aspects); assert.deepEqual(j.evidenceMatching, before.evidenceMatching);
        for (const side of ['source', 'target']) assert.ok(normalized(pair[side]).includes(normalized(j[side + 'Quote'])));
        const after = answerOf(j), changes = {};
        for (const key of ['draftReview', 'draftWarnings', 'explanationReview']) {
          const previous = before[key] || [], next = after[key] || [];
          changes[key] = { added: next.filter(code => !previous.includes(code)), removed: previous.filter(code => !next.includes(code)) };
        }
        const reviewEvidenceChanged = JSON.stringify(before.reviewEvidence || null) !== JSON.stringify(after.reviewEvidence || null);
        records.push({ id: j.id, input, source: pair.source, target: pair.target, provisionalLabels: pair.accept,
          provisionalLabelAgreement: pair.accept.includes(j.label), unchangedAcademicJudgment: true,
          bloom: { source: j.sourceBloom, target: j.targetBloom }, before, after, changes, reviewEvidenceChanged,
          withheldBefore: !!before.draftReview?.length, withheldAfter: !!after.draftReview?.length,
          structuredFieldComparisons: Object.entries(pair.expectedAspects || {}).map(([key, expected]) => ({ key, expected, actual: j.aspects.values[key], agrees: (Array.isArray(expected) ? expected : [expected]).includes(j.aspects.values[key]) })) });
      }
    }
  }
  assert.equal(records.length, 16);
  for (const file of inputs) assert.equal(hash(file), hashes[file], 'Historical input changed');
  const changed = records.filter(r => r.reviewEvidenceChanged || Object.values(r.changes).some(c => c.added.length || c.removed.length));
  const ledger = read(inputs[2]);
  return { status: 'offline_replay_not_a_model_evaluation', reviewerVersion: RESOURCE_REVIEW_VERSION,
    inputs: hashes, summary: { replayed: records.length, exactQuotes: records.length * 2, unchangedAcademicJudgments: records.length,
      unchangedProvisionalLabels: true, provisionalLabelAgreement: records.filter(r => r.provisionalLabelAgreement).length,
      generatedDrafts: records.filter(r => r.after.draft).length, withheldBefore: records.filter(r => r.withheldBefore).length,
      withheldAfter: records.filter(r => r.withheldAfter).length, newlyWithheld: records.filter(r => !r.withheldBefore && r.withheldAfter).map(r => r.id),
      noLongerWithheld: records.filter(r => r.withheldBefore && !r.withheldAfter).map(r => r.id),
      changedReviewRecords: changed.map(r => r.id), providerRequests: 0, providerCost: 0 },
    historicalLedger: { file: inputs[2], requests: ledger.requests, charged: ledger.charged, unchanged: true },
    caveat: 'Local advisory review changes only. This does not repair or approve historical model output, establish faculty accuracy, or evaluate the 12 unseen cases.', records };
}
if (require.main === module) {
  globalThis.fetch = () => { throw Error('Network is forbidden in this offline replay'); };
  const result = replay();
  if (process.argv.includes('--write')) fs.writeFileSync(path.join(root, 'docs/ai-eval-stage-e8-c-resource-replay.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ summary: result.summary, changes: result.records.filter(r => result.summary.changedReviewRecords.includes(r.id)).map(r => ({ id: r.id, changes: r.changes, evidence: r.after.reviewEvidence })) }, null, 2));
}
module.exports = { replay };
