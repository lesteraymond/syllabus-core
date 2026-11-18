'use strict';
// Re-planned AI Checker: one check of the whole syllabus (extract -> fixed rules -> AI checklists). Not wired into the running server.
const { extract, uniqueIds } = require('./extract');
const fixedRules = require('./fixedRules');
const { judge } = require('./judge');
const { lookupReferences, findingsOf } = require('./lookup');

// The misalignments a person would see: fixed-rule findings, and scored AI results that are failing or waiting on a failing parent.
function misalignmentsOf(fixed, judged) {
  return [
    ...fixed.findings.filter(f => f.severity === 'finding').map(f => ({ source: 'rule', rule: f.rule, area: f.area, field: f.field, where: f.where, message: f.message })),
    ...judged.results.filter(r => r.status === 'failing' || r.status === 'waiting').map(r => ({ source: 'ai', rule: r.relationship, area: r.area, field: r.field, fieldKey: r.fieldKey, label: r.label, status: r.status, verdict: r.verdict, message: r.explanation })),
  ];
}

// opts: ask, store, model, year (see judge.js and fixedRules.js).
// The caller reads the result with the same ids only after uniqueIds too (official.js, plan.js and refine.js do; it returns unique content unchanged).
async function check(content, masters, opts = {}) {
  const map = extract(uniqueIds(content), masters);
  const fixed = fixedRules.check(map, { year: opts.year });
  // Reference lookups (Crossref, Open Library, links) only when the caller asks: opts.lookup = {} or { fetchImpl, urlChecker }.
  let lookups = null;
  if (opts.lookup) {
    lookups = await lookupReferences(map, { year: opts.year, ...opts.lookup });
    fixed.findings.push(...findingsOf(lookups));
    fixed.summary = { finding: fixed.findings.filter(f => f.severity === 'finding').length, review: fixed.findings.filter(f => f.severity === 'review').length };
  }
  const judged = await judge(map, fixed, opts);
  const misalignments = misalignmentsOf(fixed, judged);
  return {
    map, fixed, judged, lookups, misalignments,
    summary: {
      misalignments: misalignments.length, review: fixed.summary.review + judged.results.filter(r => r.status === 'review').length,
      advice: judged.results.filter(r => r.status === 'advice').length, notChecked: judged.results.filter(r => r.status === 'not_checked').length,
      complete: judged.complete, deductions: judged.deductions.total,
    },
  };
}

module.exports = { check, misalignmentsOf };
