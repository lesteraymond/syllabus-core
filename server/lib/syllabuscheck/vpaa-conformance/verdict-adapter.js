'use strict';
// The advisory findings catalog (verdict.js) for ONE syllabus, built exactly as Policy V2 builds its fixed-rule findings
// (academicPolicyV2.js: buildVerdict(baseView, content, { all: true }).all). Test support only; no scoring.
const h = require('./harness');
const { buildVerdict } = require('../verdict');

function verdictFindingsOf(content, masters = h.sample().masters) {
  const part = h.coded(content, masters);
  const baseView = { ...part.base, findings: part.findings, hybrid: { codedChecks: part.checks, alignment: { status: 'not_evaluated', judgements: [] }, stages: {} } };
  return buildVerdict(baseView, content, { all: true }).all;
}
module.exports = { verdictFindingsOf };
