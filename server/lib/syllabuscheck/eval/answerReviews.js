'use strict';
// Offline evaluation reporting only. A warning describes a heuristic suspicion, not an invalid answer or an academic error.
// The Bloom levels the answer gave each side are kept (P2: qualityMetrics.js compares them); an answer recorded before that has none.
const answerOf = j => ({
  label: j.label, sourceQuote: j.sourceQuote || '', targetQuote: j.targetQuote || '', evidenceMatching: j.evidenceMatching || null,
  sourceBloom: j.sourceBloom || null, targetBloom: j.targetBloom || null,
  explanation: j.explanation || '', recommendation: j.recommendation || null, draft: j.draft || '',
  ...(j.draftReview ? { draftReview: j.draftReview } : {}),
  ...(j.draftWarnings ? { draftWarnings: j.draftWarnings } : {}),
  ...(j.explanationReview ? { explanationReview: j.explanationReview } : {}),
  ...(j.reviewEvidence ? { reviewEvidence: j.reviewEvidence } : {}),
  aspects: j.aspects || null,
});

function summarizeReviews(answerRuns) {
  const counts = { explanationReview: {}, draftReview: {}, draftWarnings: {} }, flaggedAnswers = [];
  answerRuns.forEach((run, index) => {
    for (const [id, answer] of run) {
      const record = { run: index + 1, id };
      let flagged = false;
      for (const key of Object.keys(counts)) {
        const codes = [...new Set(Array.isArray(answer[key]) ? answer[key] : [])];
        if (!codes.length) continue;
        flagged = true; record[key] = codes;
        for (const code of codes) counts[key][code] = (counts[key][code] || 0) + 1;
      }
      if (flagged) flaggedAnswers.push({ ...record, ...(answer.reviewEvidence ? { reviewEvidence: answer.reviewEvidence } : {}) });
    }
  });
  return { advisory: true, note: 'Counts are heuristic review warnings, not verified academic errors. Labels, fields, validation and agreement are unchanged by these warnings.', counts, flaggedAnswers };
}

module.exports = { answerOf, summarizeReviews };
