'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { sample } = require('./fixtures');
const engine = require('./engine');
const { run, PENALTIES } = engine;
const { pairsOf, align, createRequestBudget, NEMOTRON_FREE } = require('./gemini');
const policy = require('./academicPolicyV2');
const { plan, POLICY } = require('./academicV2Plan');
const repo = require('./repository');
const service = require('../compliance/service');

async function loadComplianceView() {
  const filePath = path.resolve(__dirname, '../../../src/lib/complianceView.js');
  return import(pathToFileURL(filePath).href);
}

// Helper to construct a standard mock Gemini transport
function createGeminiTransport(answerFn) {
  return async (url, req) => {
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    const judgements = batch.map(p => answerFn(p));
    return {
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: JSON.stringify({ judgements }) }]
          }
        }]
      })
    };
  };
}

// Helper to construct a standard mock Anthropic (Claude) transport for Policy V2
function createAnthropicTransport(answerFn) {
  return async (_url, init) => {
    const body = JSON.parse(init.body);
    const message = JSON.parse(body.messages[0].content);
    const judgements = message.document_data.map(p => answerFn(p));
    return new Response(JSON.stringify({
      id: 'msg_mock_v2',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-5-5',
      content: [{ type: 'text', text: JSON.stringify({ judgements }) }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 150, output_tokens: 150 }
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

function baseOptions(transport) {
  return {
    useAi: true,
    env: { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key-mock-only' },
    linkChecker: async () => ({ status: 'ok', httpStatus: 200 }),
    transport
  };
}

function v2Env() {
  return {
    SYLLABUS_CHECK_ACADEMIC_V2: 'on',
    SYLLABUS_CHECK_AI_PROVIDER: 'anthropic',
    SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: 'claude-sonnet-5-5',
    ANTHROPIC_MODEL: 'claude-sonnet-5-5',
    ANTHROPIC_API_KEY: 'sk-ant-test-unit-only',
    SYLLABUS_CHECK_AI_BATCH: '12',
    SYLLABUS_CHECK_AI_CONCURRENCY: '1'
  };
}

// -----------------------------------------------------------------------------
// Scenario A: One ILO mapped to one aligned CLO
// -----------------------------------------------------------------------------
test('Scenario A: One ILO mapped to one aligned CLO evaluates and passes cleanly with zero deductions', async () => {
  const { content, masters } = sample();
  const rowIdx = content.plan.findIndex(r => r.kind !== 'exam' && (r.ilos || []).length);
  const ilo = content.plan[rowIdx].ilos[0];
  ilo.tags = ['clo:' + content.clos[0].id]; // Single CLO tag

  const pairs = pairsOf(content, masters).filter(p => p.type === 'ILO-CLO' && p.path === `plan[${rowIdx}].ilos[0].text`);
  assert.equal(pairs.length, 1, 'Exactly one ILO-CLO pair is planned');
  assert.equal(pairs[0].id, `row${rowIdx}-ilo0-clo:${content.clos[0].id}`);

  // 1. Legacy Hybrid Engine verification
  const transport = createGeminiTransport(p => ({
    id: p.id,
    label: 'ALIGNED',
    explanation: 'The ILO directly develops the foundational skills required by CLO 1.',
    sourceQuote: p.source.trim().slice(0, 15),
    targetQuote: p.target.trim().slice(0, 15),
    sourceBloom: 'Apply',
    targetBloom: 'Apply',
    draft: ''
  }));

  const result = await run(content, masters, baseOptions(transport));
  assert.ok(!result.hybrid.deductions.some(d => d.path === `plan[${rowIdx}].ilos[0].text`), 'No deduction for aligned ILO-CLO');
  assert.ok(!result.findings.some(f => f.path === `plan[${rowIdx}].ilos[0].text` && f.ruleId === 'SEM-TAG'), 'No SEM-TAG finding for single aligned tag');
  const judgement = result.hybrid.alignment.judgements.find(j => j.id === pairs[0].id);
  assert.ok(judgement, 'Raw judgement exists');
  assert.equal(judgement.label, 'ALIGNED');

  // 2. Policy V2 verification
  const v2Transport = createAnthropicTransport(p => ({
    id: p.id,
    label: 'ALIGNED',
    explanation: 'Aligned with foundational competence.',
    sourceQuote: p.source.trim().slice(0, 15),
    targetQuote: p.target.trim().slice(0, 15),
    sourceBloom: 'N/A',
    targetBloom: 'N/A',
    draft: '',
    recommendation: 'NO_CHANGE',
    correctionField: 'none',
    correctionReason: ''
  }));

  const v2Result = await policy.evaluateIntegrated(content, masters, (c, m) => engine.coded(c, m), {
    env: v2Env(),
    transport: v2Transport
  });

  const weeklyReq = v2Result.academic.requirements.find(r => r.id === `weekly:${rowIdx}:ILO-CLO`);
  assert.ok(weeklyReq);
  assert.equal(weeklyReq.status, 'SUPPORTED_BY_SUPPLIED_EVIDENCE', 'Requirement is SUPPORTED');
  assert.deepEqual(weeklyReq.evidenceIds, [pairs[0].id]);

  const rel = v2Result.academic.relationships.find(r => r.id === pairs[0].id);
  assert.ok(rel);
  assert.equal(rel.status, 'SUPPORTED_BY_SUPPLIED_EVIDENCE');
});

// -----------------------------------------------------------------------------
// Scenario B: One ILO mapped to two aligned CLOs
// -----------------------------------------------------------------------------
test('Scenario B: One ILO mapped to two aligned CLOs evaluates both pairs independently with distinct IDs', async () => {
  const { content, masters } = sample();
  const rowIdx = content.plan.findIndex(r => r.kind !== 'exam' && (r.ilos || []).length);
  const ilo = content.plan[rowIdx].ilos[0];
  ilo.tags = ['clo:' + content.clos[0].id, 'clo:' + content.clos[1].id]; // Two tags

  const pairs = pairsOf(content, masters).filter(p => p.type === 'ILO-CLO' && p.path === `plan[${rowIdx}].ilos[0].text`);
  assert.equal(pairs.length, 2, 'Two separate ILO-CLO pairs planned');
  const expectedId1 = `row${rowIdx}-ilo0-clo:${content.clos[0].id}`;
  const expectedId2 = `row${rowIdx}-ilo0-clo:${content.clos[1].id}`;
  assert.ok(pairs.some(p => p.id === expectedId1));
  assert.ok(pairs.some(p => p.id === expectedId2));

  // Both return ALIGNED
  const transport = createGeminiTransport(p => ({
    id: p.id,
    label: 'ALIGNED',
    explanation: `Evidence supports ${p.id}.`,
    sourceQuote: p.source.trim().slice(0, 15),
    targetQuote: p.target.trim().slice(0, 15),
    sourceBloom: 'Apply',
    targetBloom: 'Apply',
    draft: ''
  }));

  const result = await run(content, masters, baseOptions(transport));
  assert.ok(!result.hybrid.deductions.some(d => d.path === `plan[${rowIdx}].ilos[0].text`), 'No deduction when both tags align');
  assert.ok(!result.findings.some(f => f.path === `plan[${rowIdx}].ilos[0].text` && f.ruleId === 'SEM-TAG'), 'No SEM-TAG finding when both align');
  
  const j1 = result.hybrid.alignment.judgements.find(j => j.id === expectedId1);
  const j2 = result.hybrid.alignment.judgements.find(j => j.id === expectedId2);
  assert.ok(j1 && j1.label === 'ALIGNED');
  assert.ok(j2 && j2.label === 'ALIGNED');

  // Policy V2 verification
  const v2Transport = createAnthropicTransport(p => ({
    id: p.id,
    label: 'ALIGNED',
    explanation: `V2 supports ${p.id}.`,
    sourceQuote: p.source.trim().slice(0, 15),
    targetQuote: p.target.trim().slice(0, 15),
    sourceBloom: 'N/A',
    targetBloom: 'N/A',
    draft: '',
    recommendation: 'NO_CHANGE',
    correctionField: 'none',
    correctionReason: ''
  }));

  const v2Result = await policy.evaluateIntegrated(content, masters, (c, m) => engine.coded(c, m), {
    env: v2Env(),
    transport: v2Transport
  });

  const weeklyReq = v2Result.academic.requirements.find(r => r.id === `weekly:${rowIdx}:ILO-CLO`);
  assert.equal(weeklyReq.status, 'SUPPORTED_BY_SUPPLIED_EVIDENCE');
  assert.ok(weeklyReq.evidenceIds.includes(expectedId1) && weeklyReq.evidenceIds.includes(expectedId2));
});

// -----------------------------------------------------------------------------
// Scenario C: One ILO mapped to one aligned and one not-aligned CLO (PRIMARY STEP 3 OBJECTIVE)
// -----------------------------------------------------------------------------
test('Scenario C: One ILO mapped to one aligned and one not-aligned CLO preserves both individual judgments, retains SEM-TAG advice without deduction, and does not hide misalignment', async () => {
  const { content, masters } = sample();
  const rowIdx = content.plan.findIndex(r => r.kind !== 'exam' && (r.ilos || []).length);
  const ilo = content.plan[rowIdx].ilos[0];
  const tagAligned = 'clo:' + content.clos[0].id;
  const tagMisaligned = 'clo:' + content.clos[2].id;
  ilo.tags = [tagAligned, tagMisaligned];

  const path = `plan[${rowIdx}].ilos[0].text`;
  const idAligned = `row${rowIdx}-ilo0-${tagAligned}`;
  const idMisaligned = `row${rowIdx}-ilo0-${tagMisaligned}`;

  const misalignedExplanation = 'The ILO covers simple syntax, whereas CLO 3 demands full system integration and testing.';

  // 1. Legacy Hybrid Engine verification
  const transport = createGeminiTransport(p => {
    if (p.id === idMisaligned) {
      return {
        id: p.id,
        label: 'NOT_ALIGNED',
        explanation: misalignedExplanation,
        sourceQuote: p.source.trim().slice(0, 15),
        targetQuote: p.target.trim().slice(0, 15),
        sourceBloom: 'Apply',
        targetBloom: 'Analyze',
        draft: 'Rewrite that should be withheld'
      };
    }
    return {
      id: p.id,
      label: 'ALIGNED',
      explanation: 'Aligned with foundational programming concept.',
      sourceQuote: p.source.trim().slice(0, 15),
      targetQuote: p.target.trim().slice(0, 15),
      sourceBloom: 'Apply',
      targetBloom: 'Apply',
      draft: ''
    };
  });

  const result = await run(content, masters, baseOptions(transport));

  // A. Both judgments must exist in hybrid.alignment.judgements
  const jAligned = result.hybrid.alignment.judgements.find(j => j.id === idAligned);
  const jMisaligned = result.hybrid.alignment.judgements.find(j => j.id === idMisaligned);
  assert.ok(jAligned, 'Aligned relationship judgment is recorded');
  assert.equal(jAligned.label, 'ALIGNED');
  assert.ok(jMisaligned, 'Misaligned relationship judgment is recorded');
  assert.equal(jMisaligned.label, 'NOT_ALIGNED');
  assert.equal(jMisaligned.explanation, misalignedExplanation);

  // B. Official scoring preservation: zero deductions for loose tag advice
  assert.ok(!result.hybrid.deductions.some(d => d.id === 'SEM:' + idMisaligned), 'Zero points deducted for unaligned tag when another tag is aligned');

  // C. Finding generation: SEM-TAG advice finding is emitted with full evidence
  const semTagFinding = result.findings.find(f => f.id === 'TAG:' + idMisaligned);
  assert.ok(semTagFinding, 'SEM-TAG finding exists for the unaligned tag');
  assert.equal(semTagFinding.ruleId, 'SEM-TAG');
  assert.equal(semTagFinding.severity, 'minor');
  assert.equal(semTagFinding.path, path);
  assert.ok(semTagFinding.message.includes(misalignedExplanation), 'Finding preserves original explanation');
  assert.ok(semTagFinding.message.includes('Another CLO tag of this ILO is aligned, so this is advice only'), 'Finding includes institutional advice note');
  assert.equal(semTagFinding.evidence.id, idMisaligned, 'Finding preserves full relationship evidence');

  // D. Recommendation safety: no rewrite draft offered for the ILO text that could destroy the aligned mapping
  assert.ok(!result.hybrid.suggestions.some(s => s.path === path), 'No text rewrite suggestion emitted for the ILO statement');

  // E. Verdict translation: relationship is present with relationshipId
  const verdictItem = result.hybrid.verdict?.findings.find(f => f.relationshipId === idMisaligned);
  assert.ok(verdictItem, 'Verdict findings preserve individual relationship ID');
  assert.equal(verdictItem.status, 'NEEDS_REVIEW');
  assert.equal(verdictItem.severity, 'INFO');
  assert.equal(verdictItem.legacyRuleId, 'ILO-CLO');

  // 2. Policy V2 Verification
  const v2Transport = createAnthropicTransport(p => {
    if (p.id === idMisaligned) {
      return {
        id: p.id,
        label: 'NOT_ALIGNED',
        explanation: misalignedExplanation,
        sourceQuote: p.source.trim().slice(0, 15),
        targetQuote: p.target.trim().slice(0, 15),
        sourceBloom: 'N/A',
        targetBloom: 'N/A',
        draft: '',
        recommendation: 'RETAG_OUTCOME',
        correctionField: 'clo_mapping',
        correctionReason: 'The assigned CLO requires demonstrative application.'
      };
    }
    return {
      id: p.id,
      label: 'ALIGNED',
      explanation: 'Supported by introductory scope.',
      sourceQuote: p.source.trim().slice(0, 15),
      targetQuote: p.target.trim().slice(0, 15),
      sourceBloom: 'N/A',
      targetBloom: 'N/A',
      draft: '',
      recommendation: 'NO_CHANGE',
      correctionField: 'none',
      correctionReason: ''
    };
  });

  const v2Result = await policy.evaluateIntegrated(content, masters, (c, m) => engine.coded(c, m), {
    env: v2Env(),
    transport: v2Transport
  });

  // A. Requirement aggregation: Mixed alignment maps to FACULTY_REVIEW (F), NEVER SUPPORTED (S)
  const v2WeeklyReq = v2Result.academic.requirements.find(r => r.id === `weekly:${rowIdx}:ILO-CLO`);
  assert.ok(v2WeeklyReq);
  assert.equal(v2WeeklyReq.status, 'FACULTY_REVIEW', 'Mixed ILO-CLO mappings aggregate to FACULTY_REVIEW, never concealed as SUPPORTED');
  assert.ok(v2WeeklyReq.evidenceIds.includes(idAligned) && v2WeeklyReq.evidenceIds.includes(idMisaligned));

  // B. Both individual relationships are distinct in academic.relationships
  const relAligned = v2Result.academic.relationships.find(r => r.id === idAligned);
  const relMisaligned = v2Result.academic.relationships.find(r => r.id === idMisaligned);
  assert.ok(relAligned && relMisaligned);
  assert.equal(relAligned.status, 'SUPPORTED_BY_SUPPLIED_EVIDENCE');
  assert.equal(relMisaligned.status, 'REQUIRES_REVISION');
  assert.equal(relMisaligned.explanation, misalignedExplanation);
  assert.equal(relMisaligned.recommendationType, 'RETAG_OUTCOME');
  assert.equal(relMisaligned.correction?.field, 'clo_mapping');
});

// -----------------------------------------------------------------------------
// Scenario D: One ILO mapped to multiple partially aligned CLOs
// -----------------------------------------------------------------------------
test('Scenario D: One ILO mapped to multiple partially aligned CLOs records deductions and selects one representative proposal', async () => {
  const { content, masters } = sample();
  const rowIdx = content.plan.findIndex(r => r.kind !== 'exam' && (r.ilos || []).length);
  const ilo = content.plan[rowIdx].ilos[0];
  const tag1 = 'clo:' + content.clos[0].id;
  const tag2 = 'clo:' + content.clos[1].id;
  ilo.tags = [tag1, tag2];

  const path = `plan[${rowIdx}].ilos[0].text`;
  const id1 = `row${rowIdx}-ilo0-${tag1}`;
  const id2 = `row${rowIdx}-ilo0-${tag2}`;

  const transport = createGeminiTransport(p => {
    if (p.id === id1) {
      return {
        id: p.id,
        label: 'PARTIALLY_ALIGNED',
        explanation: 'Partially aligned with CLO 1: gap is minor.',
        sourceQuote: p.source.trim().slice(0, 15),
        targetQuote: p.target.trim().slice(0, 15),
        sourceBloom: 'Apply',
        targetBloom: 'Apply',
        draft: 'Slightly revised ILO statement for CLO 1.'
      };
    }
    if (p.id === id2) {
      return {
        id: p.id,
        label: 'PARTIALLY_ALIGNED',
        explanation: 'Partially aligned with CLO 2: cognitive gap.',
        sourceQuote: p.source.trim().slice(0, 15),
        targetQuote: p.target.trim().slice(0, 15),
        sourceBloom: 'Apply',
        targetBloom: 'Apply',
        draft: 'Significantly revised ILO statement for CLO 2.'
      };
    }
    return { id: p.id, label: 'ALIGNED', explanation: 'Aligned', sourceQuote: p.source.trim().slice(0, 10), targetQuote: p.target.trim().slice(0, 10), sourceBloom: 'Apply', targetBloom: 'Apply', draft: '' };
  });

  const result = await run(content, masters, baseOptions(transport));

  // Since neither tag is ALIGNED, supported does not have this ILO
  assert.ok(result.hybrid.deductions.some(d => d.id === 'SEM:' + id1 || d.id === 'SEM:' + id2), 'Deduction is applied when no tag aligns');
  const suggestions = result.hybrid.suggestions.filter(s => s.path === path);
  assert.equal(suggestions.length, 1, 'Only one non-colliding representative suggestion is offered');
});

// -----------------------------------------------------------------------------
// Scenario E: Multiple ILOs within the same lesson
// -----------------------------------------------------------------------------
test('Scenario E: Multiple ILOs within the same lesson are evaluated independently without cross-talk', async () => {
  const { content, masters } = sample();
  const rowIdx = content.plan.findIndex(r => r.kind !== 'exam');
  const row = content.plan[rowIdx];
  row.ilos = [
    { text: 'Explain basic loop structures in programs', tags: ['clo:' + content.clos[0].id, 'clo:' + content.clos[1].id] },
    { text: 'Build modular functions for error recovery', tags: ['clo:' + content.clos[1].id, 'clo:' + content.clos[2].id] }
  ];

  const pairs = pairsOf(content, masters).filter(p => p.type === 'ILO-CLO' && p.path.startsWith(`plan[${rowIdx}].ilos[`));
  assert.equal(pairs.length, 4, '4 distinct pairs planned (2 ILOs x 2 tags each)');

  const id0_c0 = `row${rowIdx}-ilo0-clo:${content.clos[0].id}`;
  const id0_c1 = `row${rowIdx}-ilo0-clo:${content.clos[1].id}`;
  const id1_c1 = `row${rowIdx}-ilo1-clo:${content.clos[1].id}`;
  const id1_c2 = `row${rowIdx}-ilo1-clo:${content.clos[2].id}`;

  const transport = createGeminiTransport(p => {
    // ILO 0: c0 is ALIGNED, c1 is NOT_ALIGNED
    if (p.id === id0_c0) return { id: p.id, label: 'ALIGNED', explanation: 'ILO 0 builds CLO 0.', sourceQuote: p.source.slice(0, 10), targetQuote: p.target.slice(0, 10), sourceBloom: 'Apply', targetBloom: 'Apply', draft: '' };
    if (p.id === id0_c1) return { id: p.id, label: 'NOT_ALIGNED', explanation: 'ILO 0 does not build CLO 1.', sourceQuote: p.source.slice(0, 10), targetQuote: p.target.slice(0, 10), sourceBloom: 'Apply', targetBloom: 'Apply', draft: 'Draft for loose tag 0-1.' };
    // ILO 1: c1 is NOT_ALIGNED, c2 is ALIGNED
    if (p.id === id1_c1) return { id: p.id, label: 'NOT_ALIGNED', explanation: 'ILO 1 does not build CLO 1.', sourceQuote: p.source.slice(0, 10), targetQuote: p.target.slice(0, 10), sourceBloom: 'Apply', targetBloom: 'Apply', draft: 'Draft for loose tag 1-1.' };
    if (p.id === id1_c2) return { id: p.id, label: 'ALIGNED', explanation: 'ILO 1 builds CLO 2.', sourceQuote: p.source.slice(0, 10), targetQuote: p.target.slice(0, 10), sourceBloom: 'Apply', targetBloom: 'Apply', draft: '' };
    return { id: p.id, label: 'ALIGNED', explanation: 'Aligned', sourceQuote: p.source.slice(0, 10), targetQuote: p.target.slice(0, 10), sourceBloom: 'Apply', targetBloom: 'Apply', draft: '' };
  });

  const result = await run(content, masters, baseOptions(transport));

  // Both ILOs have 1 aligned tag, so neither incurs official score deduction
  assert.ok(!result.hybrid.deductions.some(d => d.id === 'SEM:' + id0_c1), 'ILO 0 loose tag costs nothing');
  assert.ok(!result.hybrid.deductions.some(d => d.id === 'SEM:' + id1_c1), 'ILO 1 loose tag costs nothing');

  // Both loose tags have separate SEM-TAG findings with distinct paths
  const f0 = result.findings.find(f => f.id === 'TAG:' + id0_c1);
  const f1 = result.findings.find(f => f.id === 'TAG:' + id1_c1);
  assert.ok(f0 && f1);
  assert.equal(f0.path, `plan[${rowIdx}].ilos[0].text`);
  assert.equal(f1.path, `plan[${rowIdx}].ilos[1].text`);
  assert.ok(f0.message.includes('ILO 0 does not build CLO 1.'));
  assert.ok(f1.message.includes('ILO 1 does not build CLO 1.'));
});

// -----------------------------------------------------------------------------
// Scenario F: Missing or insufficient evidence for one mapping
// -----------------------------------------------------------------------------
test('Scenario F: Insufficient evidence for one mapping does not corrupt or drop valid mappings', async () => {
  const { content, masters } = sample();
  const rowIdx = content.plan.findIndex(r => r.kind !== 'exam');
  const ilo = content.plan[rowIdx].ilos[0];
  ilo.tags = ['clo:' + content.clos[0].id, 'clo:' + content.clos[1].id];

  const id1 = `row${rowIdx}-ilo0-clo:${content.clos[0].id}`;
  const id2 = `row${rowIdx}-ilo0-clo:${content.clos[1].id}`;

  const transport = createGeminiTransport(p => {
    if (p.id === id2) {
      return {
        id: p.id,
        label: 'INSUFFICIENT_EVIDENCE',
        explanation: 'Provided text is too vague to evaluate alignment.',
        sourceQuote: '',
        targetQuote: '',
        sourceBloom: 'N/A',
        targetBloom: 'N/A',
        draft: ''
      };
    }
    return { id: p.id, label: 'ALIGNED', explanation: 'Clean alignment', sourceQuote: p.source.slice(0, 10), targetQuote: p.target.slice(0, 10), sourceBloom: 'Apply', targetBloom: 'Apply', draft: '' };
  });

  const result = await run(content, masters, baseOptions(transport));
  const j1 = result.hybrid.alignment.judgements.find(j => j.id === id1);
  const j2 = result.hybrid.alignment.judgements.find(j => j.id === id2);
  assert.ok(j1 && j1.label === 'ALIGNED');
  assert.ok(j2 && j2.label === 'INSUFFICIENT_EVIDENCE');
});

// -----------------------------------------------------------------------------
// Scenario G: AI unavailable for one or more relationships
// -----------------------------------------------------------------------------
test('Scenario G: Provider failure or unverified relationship preserves completed relationships safely', async () => {
  const { content, masters } = sample();
  const rowIdx = content.plan.findIndex(r => r.kind !== 'exam');
  const ilo = content.plan[rowIdx].ilos[0];
  ilo.tags = ['clo:' + content.clos[0].id, 'clo:' + content.clos[1].id];

  const id1 = `row${rowIdx}-ilo0-clo:${content.clos[0].id}`;
  const id2 = `row${rowIdx}-ilo0-clo:${content.clos[1].id}`;

  const transport = createGeminiTransport(p => {
    if (p.id === id2) {
      // Simulate unverified provider failure
      return {
        id: p.id,
        unverified: true,
        failureKind: 'provider_error',
        label: 'INSUFFICIENT_EVIDENCE',
        explanation: 'Provider timed out for this relationship.',
        sourceQuote: '',
        targetQuote: '',
        sourceBloom: 'N/A',
        targetBloom: 'N/A',
        draft: ''
      };
    }
    return { id: p.id, label: 'ALIGNED', explanation: 'Clean alignment', sourceQuote: p.source.slice(0, 10), targetQuote: p.target.slice(0, 10), sourceBloom: 'Apply', targetBloom: 'Apply', draft: '' };
  });

  const result = await run(content, masters, baseOptions(transport));
  const j1 = result.hybrid.alignment.judgements.find(j => j.id === id1);
  const j2 = result.hybrid.alignment.judgements.find(j => j.id === id2);
  assert.ok(j1 && j1.label === 'ALIGNED');
  assert.ok(j2 && j2.unverified === true);
});

// -----------------------------------------------------------------------------
// Scenario H: Saved-report persistence and UI preservation of individual findings
// -----------------------------------------------------------------------------
test('Scenario H: Saved-report roundtrip and UI data model preserve every individual ILO-CLO finding', async () => {
  const { content, masters } = sample();
  const rowIdx = content.plan.findIndex(r => r.kind !== 'exam');
  const ilo = content.plan[rowIdx].ilos[0];
  ilo.tags = ['clo:' + content.clos[0].id, 'clo:' + content.clos[2].id];

  const idAligned = `row${rowIdx}-ilo0-clo:${content.clos[0].id}`;
  const idMisaligned = `row${rowIdx}-ilo0-clo:${content.clos[2].id}`;

  const transport = createGeminiTransport(p => {
    if (p.id === idMisaligned) {
      return { id: p.id, label: 'NOT_ALIGNED', explanation: 'Misaligned topic.', sourceQuote: p.source.slice(0, 10), targetQuote: p.target.slice(0, 10), sourceBloom: 'Apply', targetBloom: 'Apply', draft: 'Draft rewrite for loose tag.' };
    }
    return { id: p.id, label: 'ALIGNED', explanation: 'Aligned well.', sourceQuote: p.source.slice(0, 10), targetQuote: p.target.slice(0, 10), sourceBloom: 'Apply', targetBloom: 'Apply', draft: '' };
  });

  const runResult = await run(content, masters, baseOptions(transport));
  
  // Test Mock DB persistence roundtrip
  let storedJson = null;
  const mockConn = {
    query: async (sql, values) => {
      if (sql.startsWith('INSERT INTO ai_check_runs')) return [{ insertId: 999 }];
      if (sql.startsWith('INSERT INTO syllabus_check_reports')) {
        storedJson = JSON.parse(values[2]);
        return [[]];
      }
      return [[]];
    }
  };

  const storedRunId = await service.storeRun(mockConn, { syllabusId: 42, content, result: runResult, ai: true });
  assert.equal(storedRunId, 999);
  assert.ok(storedJson, 'Report JSON was persisted');

  // Verify that the persisted JSON contains both individual judgments
  const savedJudgements = storedJson.hybrid.alignment.judgements;
  assert.ok(savedJudgements.some(j => j.id === idAligned && j.label === 'ALIGNED'));
  assert.ok(savedJudgements.some(j => j.id === idMisaligned && j.label === 'NOT_ALIGNED'));

  // Verify that UI grouping function groupFindings() preserves SEM-TAG
  const { groupFindings } = await loadComplianceView();
  const grouped = groupFindings(runResult);
  const assessmentGroup = grouped.find(g => g.key === 'assessment');
  assert.ok(assessmentGroup, 'Assessment group exists in UI findings');
  const uiSemTag = assessmentGroup.findings.find(f => f.id === 'TAG:' + idMisaligned);
  assert.ok(uiSemTag, 'UI preserves SEM-TAG finding under assessment area');
});

// -----------------------------------------------------------------------------
// Scenario I: Official scoring and submission gates remain unchanged
// -----------------------------------------------------------------------------
test('Scenario I: Official scoring and submission gates remain strictly unchanged by advisory loose tags', async () => {
  const { content, masters } = sample();
  const rowIdx = content.plan.findIndex(r => r.kind !== 'exam');
  const ilo = content.plan[rowIdx].ilos[0];
  const tag1 = 'clo:' + content.clos[0].id;
  const tag3 = 'clo:' + content.clos[2].id;

  // Run 1: Single aligned tag
  ilo.tags = [tag1];
  const transport1 = createGeminiTransport(p => ({
    id: p.id, label: 'ALIGNED', explanation: 'Aligned', sourceQuote: p.source.slice(0, 10), targetQuote: p.target.slice(0, 10), sourceBloom: 'Apply', targetBloom: 'Apply', draft: ''
  }));
  const resSingle = await run(content, masters, baseOptions(transport1));

  // Run 2: One aligned tag + one unaligned tag
  ilo.tags = [tag1, tag3];
  const transport2 = createGeminiTransport(p => {
    if (p.id.endsWith(tag3)) return { id: p.id, label: 'NOT_ALIGNED', explanation: 'Loose tag mismatch', sourceQuote: p.source.slice(0, 10), targetQuote: p.target.slice(0, 10), sourceBloom: 'Apply', targetBloom: 'Apply', draft: '' };
    return { id: p.id, label: 'ALIGNED', explanation: 'Aligned', sourceQuote: p.source.slice(0, 10), targetQuote: p.target.slice(0, 10), sourceBloom: 'Apply', targetBloom: 'Apply', draft: '' };
  });
  const resMixed = await run(content, masters, baseOptions(transport2));

  // Compare official scores and deductions
  assert.equal(resMixed.overall, resSingle.overall, 'Official score is IDENTICAL between single aligned and mixed mappings');
  assert.equal(resMixed.passed, resSingle.passed, 'Pass status is IDENTICAL');
  assert.equal(resMixed.hybrid.deductions.length, resSingle.hybrid.deductions.length, 'Deduction count is IDENTICAL');

  // Verify submission blockers
  const { blockersOf } = await loadComplianceView();
  const blockersSingle = blockersOf(resSingle, 'advisory');
  const blockersMixed = blockersOf(resMixed, 'advisory');
  assert.deepEqual(blockersMixed, blockersSingle, 'Submission blockers are completely unaffected by SEM-TAG advice');
});

// -----------------------------------------------------------------------------
// Scenario J: Multiple ILO–CLO mappings processed across different AI batches
// -----------------------------------------------------------------------------
test('Scenario J: Multiple ILO-CLO mappings across AI batch boundaries reassemble without drop or corruption', async () => {
  const { content, masters } = sample();
  // Assign multiple CLO tags across several weeks
  for (let w = 0; w < 3; w++) {
    const row = content.plan[w];
    if (row && row.kind !== 'exam' && row.ilos?.length) {
      row.ilos[0].tags = ['clo:' + content.clos[0].id, 'clo:' + content.clos[1].id, 'clo:' + content.clos[2].id];
    }
  }

  // Force small batch size to cross boundaries
  const smallBatchEnv = {
    SYLLABUS_CHECK_AI_PROVIDER: 'gemini',
    GEMINI_API_KEY: 'test-key-mock-only',
    SYLLABUS_CHECK_AI_BATCH: '4' // Small batch size
  };

  const askedBatches = [];
  const transport = async (url, req) => {
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    askedBatches.push(batch.map(p => p.id));
    const judgements = batch.map(p => ({
      id: p.id,
      label: p.id.includes('clo:c3') ? 'NOT_ALIGNED' : 'ALIGNED',
      explanation: `Judged in batch: ${p.id}`,
      sourceQuote: p.source.slice(0, 10),
      targetQuote: p.target.slice(0, 10),
      sourceBloom: 'Apply',
      targetBloom: 'Apply',
      draft: p.id.includes('clo:c3') ? 'Draft rewrite for loose tag' : ''
    }));
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements }) }] } }] })
    };
  };

  const result = await run(content, masters, {
    useAi: true,
    env: smallBatchEnv,
    linkChecker: async () => ({ status: 'ok', httpStatus: 200 }),
    transport
  });

  assert.ok(askedBatches.length > 1, 'Requests were split across multiple batches');
  
  // Verify all ILO-CLO pairs across all rows were preserved in judgments
  const allIloCloJudgements = result.hybrid.alignment.judgements.filter(j => j.type === 'ILO-CLO');
  assert.ok(allIloCloJudgements.length >= 21, 'All ILO-CLO relationships were evaluated and reassembled across batches');
  for (let w = 0; w < 3; w++) {
    for (let c = 0; c < 3; c++) {
      const expectedId = `row${w}-ilo0-clo:${content.clos[c].id}`;
      assert.ok(allIloCloJudgements.some(j => j.id === expectedId), `Judgement exists for ${expectedId}`);
    }
  }
  
  // Verify each row has its unaligned c3 tag recorded as SEM-TAG advice
  const semTags = result.findings.filter(f => f.ruleId === 'SEM-TAG');
  assert.equal(semTags.length, 3, 'Each row with an unaligned tag produces its individual SEM-TAG finding');
});
