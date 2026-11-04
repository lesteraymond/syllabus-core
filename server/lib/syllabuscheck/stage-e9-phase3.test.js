'use strict';
// Stage E.9 Phase 3, Layer A: Offline end-to-end evaluation test suite (A1–A8).
// Tests the full 13-component Hybrid-2 checker (Stages A, B, B3, B4, C1, C2, D1, D2 + Stage E.8 recommendation safeguards)
// against complete 18-week syllabi across BSIT, BSIE, BSCpE, and BSIT-CYBERSECURITY using the deterministic OpenRouter mock provider.
// Runs 100% offline with zero network calls and zero database queries.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const {
  programSyllabus,
  buildSyllabus,
  PROGRAMS,
} = require('./eval/programSyllabi');
const {
  FIXTURES,
  CYBER,
  MANIFEST_FILE,
  loadManifest,
  base,
  variant,
} = require('./eval/phase3/fixtures');
const {
  DEFAULT_MODEL,
  DEFAULT_ENV,
  LEGACY_ENV,
  runWithOracle,
} = require('./eval/phase3/oracle');
const {
  AGREEMENT_LABEL,
  DRIFT_CATEGORIES,
  manifestHash,
  reconcileScoredRelationshipPolicy,
  runPairedOfficialComparison,
  runPairedDriftScenarios,
  estimatePhase3RequestVolume,
  scoreRun,
} = require('./eval/phase3/score');
const {
  DRAFT_STATUS,
  ACADEMIC_RECOMMENDATION_REVIEW,
  CSV_COLUMNS,
  buildPhase3FacultyReviewPackage,
  writePhase3FacultyReviewPackage,
} = require('./eval/phase3/facultyExport');
const { promptVersionOf, resetProviderBlock } = require('./gemini');
const { buildVerdict } = require('./verdict');
const { withholdReviewedDrafts } = require('./reportSafety');
const { createGuard, loadedDataModules } = require('./eval/providerGuard');
const { programs: CURRICULUM_PROGRAMS } = require('../../db/local-curriculum-data.cjs');
const { sources: OUTCOME_SOURCES } = require('../../db/local-outcome-data.cjs');

const manifest = loadManifest();

// ============================================================================
// Section 2 & A1: Existing fixture preservation, buildSyllabus() safety,
// Cyber Security provenance, and aligned 18-week variants (bsit, bsie, bscpe, cyber)
// ============================================================================

test('A1.1 existing BSIT, BSIE, and BSCpE fixtures remain byte-identical and explicit in identity', () => {
  for (const key of PROGRAMS) {
    const legacy = programSyllabus(key);
    const fromPhase3 = base(key);

    assert.equal(JSON.stringify(legacy.content), JSON.stringify(fromPhase3.content), `${key} base() content must match programSyllabus()`);
    assert.equal(JSON.stringify(legacy.masters), JSON.stringify(fromPhase3.masters), `${key} base() masters must match programSyllabus()`);
    assert.equal(fromPhase3.syllabusSynthetic, true);
    assert.equal(fromPhase3.identityStatus, 'transcribed');
    assert.ok(fromPhase3.identity.program);
    assert.ok(fromPhase3.identity.curriculumYear);
    assert.ok(fromPhase3.identity.code);
  }
});

test('A1.2 buildSyllabus() enforces explicit program + curriculumYear + code and rejects ambiguous normalized codes', () => {
  assert.throws(
    () => buildSyllabus('test', { ...CYBER, program: 'UNKNOWN-PROG' }),
    /has no transcribed curriculum/
  );
  assert.throws(
    () => buildSyllabus('test', { ...CYBER, curriculumYear: '1999-2000' }),
    /is transcribed for 2025-2026, not 1999-2000/
  );
  assert.throws(
    () => buildSyllabus('test', { ...CYBER, code: 'CS-999' }),
    /is not in the transcribed BSIT-CYBERSECURITY curriculum/
  );

  // Inject a temporary normalized code collision ('CS 301' vs 'CS-301') into BSIT-CYBERSECURITY curriculum and confirm buildSyllabus refuses to guess
  const cyberProg = CURRICULUM_PROGRAMS.find(p => p.code === 'BSIT-CYBERSECURITY');
  const termRows = cyberProg.terms[0].rows;
  termRows.push({
    code: 'CS 301',
    title: 'Duplicate Normalized Code Collision Course',
    lecture: 2,
    lab: 1,
    prereq: 'None',
  });
  try {
    assert.throws(
      () => buildSyllabus('test', CYBER),
      /matches more than one course of the transcribed BSIT-CYBERSECURITY curriculum/
    );
  } finally {
    termRows.pop();
  }
});

test('A1.3 Cyber Security CS-301 fixture uses BSIT-CYBERSECURITY 2025-2026 curriculum, shared BSIT outcomes, and honest synthetic provenance', () => {
  const cyber = base('cyber');
  assert.equal(cyber.program, 'BSIT-CYBERSECURITY');
  assert.equal(cyber.identity.program, 'BSIT-CYBERSECURITY');
  assert.equal(cyber.identity.curriculumYear, '2025-2026');
  assert.equal(cyber.identity.code, 'CS-301');
  assert.equal(cyber.content.meta.code, 'CS-301');
  assert.equal(cyber.content.meta.title, 'INTRODUCTION TO DIGITAL FORENSICS');
  assert.equal(cyber.masters.curricula.length, 1);
  assert.equal(cyber.masters.curricula[0].program, 'BSIT-CYBERSECURITY');
  assert.equal(cyber.masters.curricula[0].curriculumYear, '2025-2026');
  assert.deepEqual(cyber.masters.pos, OUTCOME_SOURCES.BSIT.pos);
  assert.deepEqual(cyber.masters.institution.egas, OUTCOME_SOURCES.BSIT.egas);

  // Must NOT be represented as institutionally approved offline
  assert.equal(cyber.syllabusSynthetic, true);
  assert.equal(cyber.identityStatus, 'transcribed_approval_not_confirmed');
  assert.equal(cyber.masters.outcomeSource, 'BSIT');
  assert.match(cyber.outcomes, /program_outcome_sources migration not run/);
  assert.equal(cyber.content.plan.length, 18);
});

test('A1.4 all four aligned 18-week variants (bsit, bsie, bscpe, cyber) score 100, pass all gates, and have 0 contradictions or false flags', async () => {
  for (const key of FIXTURES) {
    const syl = variant(key, 'aligned', manifest);
    const spec = manifest.variants[`${key}-aligned`];
    const { result, oracle } = await runWithOracle(syl, { variantSpec: spec });
    const score = scoreRun(result, syl, spec, { requests: oracle.stats.requests });

    assert.equal(result.score, 100, `${key}-aligned score must be 100`);
    assert.equal(result.passed, true, `${key}-aligned must pass at 79`);
    assert.equal(result.hybrid.ready, true, `${key}-aligned must be submission-ready`);
    assert.equal(result.hybrid.alignment.status, 'completed');
    assert.equal(result.hybrid.verdict.counts.FAIL, 0);
    assert.notEqual(result.hybrid.verdict.overall, 'NOT_COMPLIANT');

    assert.equal(score.criteria.E1_completed, true);
    assert.equal(score.criteria.E3_zeroContradictions, true);
    assert.equal(score.criteria.E4_zeroUnverifiedPass, true);
    assert.equal(score.criteria.E5_zeroReleasedUnsupportedDrafts, true);
    assert.equal(score.criteria.R2_zeroControlRowFalseFlags, true);
    assert.equal(score.criteria.R5_exactQuotationsRate, 1);
    assert.equal(score.criteria.R6_explanationReviewFlags, 0);
    assert.equal(score.criteria.R8_withinRequestCeiling, true);
    assert.ok(oracle.stats.requests <= 48, `Expected <= 48 requests on ${key}-aligned, got ${oracle.stats.requests}`);

    // Week 1 orientation and examination weeks (Weeks 6, 12, 18 -> indices 5, 11, 17) handling
    const ids = new Set(result.hybrid.alignment.judgements.map(j => j.id));
    for (const examRow of [5, 11, 17]) {
      assert.equal(ids.has(`row${examRow}-content`), false, `Exam row ${examRow} must not be asked for Content-course`);
      assert.equal(ids.has(`row${examRow}-activityfit`), false, `Exam row ${examRow} must not be asked for Activity-fit`);
      assert.equal(ids.has(`row${examRow}-assessfit`), false, `Exam row ${examRow} must not be asked for Assessment-fit`);
      assert.equal(ids.has(`row${examRow}-valueuse`), false, `Exam row ${examRow} must not be asked for Value-use`);
    }
    const plan01 = result.hybrid.verdict.findings.find(f => f.ruleId === 'PLAN-01');
    assert.equal(plan01, undefined, `${key}-aligned Week 1 orientation must pass PLAN-01`);
  }
  assert.deepEqual(loadedDataModules(), [], 'Zero runtime DB/data modules may be loaded in Layer A tests');
});

// ============================================================================
// A2: Multi-defect misaligned variants (bsit, bsie, bscpe, cyber)
// ============================================================================

test('A2.1 all four misaligned variants detect 100% of obvious & subtle primary defects, match cascades, and have 0 control-row false flags', async () => {
  for (const key of FIXTURES) {
    const syl = variant(key, 'misaligned', manifest);
    const spec = manifest.variants[`${key}-misaligned`];
    assert.ok(spec.controls.length >= 6, `${key}-misaligned must have at least 4 untouched control rows`);

    const { result, oracle } = await runWithOracle(syl, { variantSpec: spec });
    const score = scoreRun(result, syl, spec, { requests: oracle.stats.requests });

    assert.equal(score.agreementLabel, AGREEMENT_LABEL);
    assert.equal(score.criteria.E1_completed, true, `${key}-misaligned E1`);
    assert.equal(score.criteria.E3_zeroContradictions, true, `${key}-misaligned E3: ${JSON.stringify(score.contradictions)}`);
    assert.equal(score.criteria.E4_zeroUnverifiedPass, true, `${key}-misaligned E4`);
    assert.equal(score.criteria.E5_zeroReleasedUnsupportedDrafts, true, `${key}-misaligned E5`);
    assert.equal(score.criteria.R1_primaryDetectionRate, 1, `${key}-misaligned R1`);
    assert.equal(score.criteria.R2_zeroControlRowFalseFlags, true, `${key}-misaligned R2: ${JSON.stringify(score.falseFlags)}`);
    assert.equal(score.criteria.R3_responsibleAgreement, 1, `${key}-misaligned R3`);
    assert.equal(score.criteria.R4_recommendationAgreement, 1, `${key}-misaligned R4`);
    assert.equal(score.criteria.R5_exactQuotationsRate, 1, `${key}-misaligned R5`);
    assert.equal(score.criteria.R6_explanationReviewFlags, 0, `${key}-misaligned R6`);
    assert.equal(score.criteria.R8_withinRequestCeiling, true, `${key}-misaligned R8`);

    assert.equal(score.counts.obviousDetected, score.counts.obviousTotal, `${key} obvious defects`);
    assert.equal(score.counts.subtleDetected, score.counts.subtleTotal, `${key} subtle defects`);
    assert.equal(score.counts.cascadeMatched, score.counts.cascadeTotal, `${key} cascade expectations`);
  }
});

test('A2.2 misaligned variants enforce upstream academic evidence precedence (clo_off_course, upstream_invalid, content_sound, values_classified)', async () => {
  // 1. Cyber misaligned: CLO 4 is off-course (clo3-course NOT_ALIGNED) -> downstream PO/EGA rewrites withheld with clo_off_course
  const cyberMis = variant('cyber', 'misaligned', manifest);
  const { result: cyberRes } = await runWithOracle(cyberMis, { variantSpec: manifest.variants['cyber-misaligned'] });
  const cyberFindings = cyberRes.hybrid.verdict.findings;
  const clo3Course = cyberFindings.find(f => f.relationshipId === 'clo3-course');
  assert.equal(clo3Course?.ruleId, 'CLO-03');
  assert.equal(clo3Course?.status, 'FAIL');
  assert.equal(clo3Course?.recommendationType, 'REWRITE_TEXT');

  for (const relId of ['clo3-po3', 'clo3-po4', 'clo3-ega2', 'clo3-ega3', 'clo3-anypo', 'clo3-anyega']) {
    const f = cyberFindings.find(x => x.relationshipId === relId);
    assert.ok(f, `Expected finding for ${relId}`);
    assert.equal(f.withheld, 'clo_off_course', `${relId} must be withheld as clo_off_course`);
    assert.equal(f.recommendation, null, `${relId} must not offer a competing rewrite`);
  }
  const clo3Suggestions = cyberRes.hybrid.suggestions.filter(s => s.path === 'clos[3].statement');
  assert.equal(clo3Suggestions.length, 1);
  assert.equal(clo3Suggestions[0].id, 'SEM:clo3-course');

  // 2. BSIT misaligned: Week 3 (row2) content is off-course -> downstream ILO-CLO, ILO-activity, ILO-assessment, Module-value withheld as upstream_invalid
  //    and Week 4 (row3) content is sound while ILO is off-topic -> ILO-content withheld as content_sound, downstream withheld as upstream_invalid
  //    and Week 14 (row13) uses supporting values (Respect, Honesty) -> VAL-05 NEEDS_REVIEW (RETAG_OUTCOME) and ALN-05 withheld as values_classified
  const bsitMis = variant('bsit', 'misaligned', manifest);
  const { result: bsitRes } = await runWithOracle(bsitMis, { variantSpec: manifest.variants['bsit-misaligned'] });
  const bsitFindings = bsitRes.hybrid.verdict.findings;

  for (const relId of ['row2-ilo0-activity', 'row2-ilo0-assessment', 'row2-value']) {
    const f = bsitFindings.find(x => x.relationshipId === relId);
    assert.ok(f, `Expected cascade finding ${relId}`);
    assert.equal(f.withheld, 'upstream_invalid');
    assert.equal(f.responsible, 'course_content');
    assert.equal(f.recommendation, null);
  }
  assert.equal(
    bsitRes.hybrid.suggestions.some(s => s.id === 'SEM:row2-ilo0-clo:c1'),
    false,
    'Downstream ILO-CLO rewrite must be suppressed while week content is off-course'
  );
  assert.ok(bsitRes.hybrid.alignment.stageC.c1.heldBackUpstream >= 2, 'Stage C1 must hold back rows with upstream problems');
  assert.ok(bsitRes.hybrid.alignment.stageC.c2.heldBackUpstream >= 2, 'Stage C2 must hold back rows with upstream problems');
  assert.ok(bsitRes.hybrid.alignment.stageD.d1.heldBackUpstream >= 2, 'Stage D1 must hold back rows with upstream problems');

  const row3IloContent = bsitFindings.find(x => x.relationshipId === 'row3-ilo0-content');
  assert.equal(row3IloContent?.withheld, 'content_sound');
  assert.equal(row3IloContent?.recommendation, null);
  for (const relId of ['row3-ilo0-activity', 'row3-ilo0-assessment', 'row3-value']) {
    const f = bsitFindings.find(x => x.relationshipId === relId);
    assert.equal(f?.withheld, 'upstream_invalid');
    assert.equal(f?.responsible, 'ilo');
  }

  const row13ValMap = bsitFindings.find(x => x.relationshipId === 'row13-valuemap');
  assert.equal(row13ValMap?.ruleId, 'VAL-05');
  assert.equal(row13ValMap?.status, 'NEEDS_REVIEW');
  assert.equal(row13ValMap?.recommendationType, 'REVIEW_REQUIRED');
  const row13ModVal = bsitFindings.find(x => x.relationshipId === 'row13-value');
  assert.equal(row13ModVal?.withheld, 'values_classified');
  assert.equal(bsitRes.hybrid.suggestions.some(s => s.path === 'plan[13].values'), false, 'Faculty values text must not be rewritten when supporting values are classified');

  // 3. Open items (8.4 in bsie-misaligned, 7.3 in bscpe-misaligned) are excluded from agreement denominator and reported as open
  const bsieMis = variant('bsie', 'misaligned', manifest);
  const { result: bsieRes } = await runWithOracle(bsieMis, { variantSpec: manifest.variants['bsie-misaligned'] });
  const bsieScore = scoreRun(bsieRes, bsieMis, manifest.variants['bsie-misaligned']);
  assert.equal(bsieScore.openItems.length, 1);
  assert.equal(bsieScore.openItems[0].catalogueId, '8.4');
  assert.equal(bsieScore.openItems[0].reviewStatus, 'open');

  const bscpeMis = variant('bscpe', 'misaligned', manifest);
  const { result: bscpeRes } = await runWithOracle(bscpeMis, { variantSpec: manifest.variants['bscpe-misaligned'] });
  const bscpeScore = scoreRun(bscpeRes, bscpeMis, manifest.variants['bscpe-misaligned']);
  assert.equal(bscpeScore.openItems.length, 1);
  assert.equal(bscpeScore.openItems[0].catalogueId, '7.3');
  assert.equal(bscpeScore.openItems[0].reviewStatus, 'open');
});

// ============================================================================
// A3: Single-mutation variants across all 13 components
// ============================================================================

test('A3 single-mutation variants isolate each defect to the expected relationship, rule, and responsible field with 0 false flags', async () => {
  const singleDefectCases = [
    ['bsit', 'bsit-keyword-only'],
    ['bsit', 'bsit-clo3-offcourse'],
    ['bsit', 'bsit-clo2-po-obvious'],
    ['bsit', 'bsit-row2-content-obvious'],
    ['bsit', 'bsit-row3-ilo-obvious'],
    ['bsit', 'bsit-row4-activity-subtle'],
    ['bsit', 'bsit-row7-assess-obvious'],
    ['bsit', 'bsit-row8-assess-subtle'],
    ['bsit', 'bsit-row9-value-nameonly'],
    ['bsit', 'bsit-row10-iloclo-retag'],
    ['bsit', 'bsit-row13-value-supporting'],
    ['bsit', 'bsit-row14-assess-bare'],
    ['bsie', 'bsie-desc-obvious'],
    ['bsie', 'bsie-clo2-coverage-zero'],
    ['bsie', 'bsie-row0-no-orientation'],
    ['bsie', 'bsie-row12-value-obvious'],
    ['bsie', 'bsie-row13-value-competency'],
    ['bscpe', 'bscpe-sequence-swap'],
    ['bscpe', 'bscpe-row8-ilo-and-coverage-subtle'],
    ['bscpe', 'bscpe-ref-apa7'],
    ['cyber', 'cyber-clo4-offcourse'],
    ['cyber', 'cyber-ref-obvious'],
  ];

  for (const [key, defectId] of singleDefectCases) {
    const syl = variant(key, `single:${defectId}`, manifest);
    const defectSpec = {
      ...syl.defects[0],
      controls: manifest.variants[`${key}-aligned`].controls.filter(
        r => !syl.defects[0].expectations.some(e => e.id.startsWith(`row${r}-`))
      ),
    };
    const { result, oracle } = await runWithOracle(syl, { variantSpec: defectSpec });
    const score = scoreRun(result, syl, defectSpec, { requests: oracle.stats.requests });

    assert.equal(score.criteria.E1_completed, true, `single:${defectId} E1`);
    assert.equal(score.criteria.E3_zeroContradictions, true, `single:${defectId} E3: ${JSON.stringify(score.contradictions)}`);
    assert.equal(score.criteria.R1_primaryDetectionRate, 1, `single:${defectId} R1`);
    assert.equal(score.criteria.R2_zeroControlRowFalseFlags, true, `single:${defectId} R2: ${JSON.stringify(score.falseFlags)}`);
    assert.equal(score.criteria.R3_responsibleAgreement, 1, `single:${defectId} R3: ${JSON.stringify(score.expDetails)}`);
    assert.equal(score.criteria.R4_recommendationAgreement, 1, `single:${defectId} R4: ${JSON.stringify(score.expDetails)}`);
    assert.equal(score.counts.cascadeMatched, score.counts.cascadeTotal, `single:${defectId} cascades`);

    for (const det of defectSpec.deterministic || []) {
      const found = result.hybrid.verdict.findings.find(f => f.ruleId === det.ruleId && (!det.path || f.path === det.path));
      assert.ok(found, `Expected deterministic finding ${det.ruleId} on single:${defectId}`);
      assert.equal(found.status, det.status);
    }
  }
});

// ============================================================================
// A4: Paired Official Scoring Comparison & Score Drift Detection (Section 5)
// ============================================================================

test('A4.1 Controlled Case 1 (identical scored judgments): Legacy (all stages off) vs Enhanced (all stages on) produces identical official scores, deductions, pass@79, and submission gates', async () => {
  for (const key of FIXTURES) {
    for (const mode of ['aligned', 'misaligned']) {
      const syl = variant(key, mode, manifest);
      const spec = manifest.variants[`${key}-${mode}`];
      const paired = await runPairedOfficialComparison(syl, { variantSpec: spec });
      const { comparison, legacyResult, enhancedResult } = paired;

      assert.equal(comparison.prompts.legacy, 'alignment-10');
      assert.equal(comparison.prompts.enhanced, 'alignment-12ab34c1c2d1d2-r8-a8');
      assert.equal(comparison.scoredJudgments.allIdentical, true, `${key}-${mode} scored judgments must be identical`);
      assert.equal(comparison.scoredJudgments.differentCount, 0);
      assert.equal(comparison.scores.legacyScore, comparison.scores.enhancedScore, `${key}-${mode} official score must match`);
      assert.equal(comparison.deductions.legacyTotal, comparison.deductions.enhancedTotal, `${key}-${mode} deductions must match`);
      assert.equal(comparison.deductions.diffs.length, 0);
      assert.equal(comparison.passFailAt79.passChanged, false, `${key}-${mode} pass@79 must not flip`);
      assert.equal(comparison.submissionReadiness.readyChanged, false, `${key}-${mode} readiness must not change`);
      assert.equal(comparison.submissionGates.gatesChanged, false, `${key}-${mode} gates must not change`);

      // Advisory stages must add advisory relationships in Enhanced without altering official score
      assert.ok(comparison.advisoryFindings.legacyAdvisoryRelationships <= 25);
      assert.ok(
        comparison.advisoryFindings.enhancedAdvisoryRelationships > comparison.advisoryFindings.legacyAdvisoryRelationships + 60,
        `${key}-${mode} must evaluate Stage A/B/C/D advisory relationships`
      );
      if (mode === 'misaligned') {
        assert.ok(comparison.advisoryFindings.advisoryAddedByStagesCount > 0, `${key}-misaligned must have stage-added advisory findings`);
      }

      assert.equal(comparison.drift.detected, false);
      assert.equal(comparison.drift.officialDrift, false);
      assert.equal(comparison.drift.formulaInvariantWhenScoredEqual, true);
      assert.equal(legacyResult.score, enhancedResult.score);
    }
  }
});

test('A4.2 Controlled Case 2 (intentionally different scored judgments): detects and reports prompt-induced score drift, deduction diffs, and pass/fail flip at 79 honestly', async () => {
  // Use the keyword-only semantic alignment syllabus (bsit-keyword-only) + additional keyword-stuffed ILOs:
  // Path A (Legacy prompt without Stage A cloPoTail / Stage B3 iloTail) is fooled by shared keywords and answers ALIGNED on all scored questions (score = 100, passed = true).
  // Path B (Enhanced prompt with Stage A cloPoTail / Stage B3 iloTail) flags the keyword-only scored relationships as NOT_ALIGNED (8 relationships * 3 pts = 24 pts deducted -> score = 76 < 79, passed = false).
  const syl = variant('bsit', 'single:bsit-keyword-only', manifest);
  const driftScoredIds = [
    'clo0-po7',
    'clo0-po9',
    'clo0-ega1',
    'clo0-ega2',
    'row1-ilo0-clo:c1',
    'row2-ilo0-clo:c1',
    'row3-ilo0-clo:c1',
    'row4-ilo0-clo:c1',
  ];
  const legacyOverrides = {};
  const enhancedOverrides = {};
  for (const id of driftScoredIds) {
    legacyOverrides[id] = { label: 'ALIGNED', modelRecommendation: 'NO_CHANGE' };
    enhancedOverrides[id] = {
      label: 'NOT_ALIGNED',
      modelRecommendation: 'REWRITE_TEXT',
      oracleDraft: 'Revised outcome statement demonstrating specific programming competency and measurable technical artifact.',
    };
  }
  // Ensure whole-list CLO-anyPO and CLO-anyEGA are also NOT_ALIGNED in enhanced so clo0-po* / clo0-ega* are not downgraded to SEM-TAG advice
  enhancedOverrides['clo0-anypo'] = { label: 'NOT_ALIGNED', modelRecommendation: 'REWRITE_TEXT', oracleDraft: 'Revised CLO aligned with BSIT PO 7.' };
  enhancedOverrides['clo0-anyega'] = { label: 'NOT_ALIGNED', modelRecommendation: 'REWRITE_TEXT', oracleDraft: 'Revised CLO aligned with BSIT EGA 1.' };

  const paired = await runPairedOfficialComparison(syl, {
    variantSpec: manifest.variants['bsit-aligned'],
    legacyOverrides,
    enhancedOverrides,
  });
  const { comparison, legacyResult, enhancedResult } = paired;

  assert.equal(legacyResult.score, 100);
  assert.equal(legacyResult.passed, true);
  assert.equal(legacyResult.hybrid.ready, true);

  assert.equal(enhancedResult.score, 76);
  assert.equal(enhancedResult.passed, false);
  // Semantic alignment deductions are major (not blocking), so ready stays true while pass@79 flips to false
  assert.equal(enhancedResult.hybrid.ready, true);

  assert.equal(comparison.drift.detected, true, 'Must detect drift when scored judgments differ');
  assert.equal(comparison.drift.scoredJudgmentDrift, true);
  assert.equal(comparison.drift.officialDrift, true);
  assert.equal(comparison.drift.scoreDrift, true);
  assert.equal(comparison.drift.passFlipAt79, true, 'Must detect pass/fail flip across 79 threshold');
  assert.equal(comparison.drift.readinessDrift, false);
  assert.equal(comparison.scores.scoreDelta, -24);
  assert.equal(comparison.scoredJudgments.differentCount, driftScoredIds.length);
  assert.equal(comparison.deductions.diffs.length, driftScoredIds.length);
  assert.match(comparison.drift.summary, /Drift detected: 8 scored judgment\(s\) differed, score changed from 100 to 76 \(delta -24\), pass@79 FLIPPED/);
});

// ============================================================================
// A5: Fault Injection & Validation/Retry Contract (Section 4)
// ============================================================================

test('A5.1 fault injection: empty judgment array (single retry recovery, repeated stop, and 9-call unproductive guard)', async () => {
  const syl = variant('bsit', 'aligned', manifest);
  const spec = manifest.variants['bsit-aligned'];

  // 1. Single empty judgment array recovers on corrective retry
  const { result: recRes, oracle: recOracle } = await runWithOracle(syl, {
    variantSpec: spec,
    faults: [{ type: 'empty_judgements', onPair: 'clo0-course', attempt: 1 }],
  });
  assert.equal(recRes.score, 100);
  assert.equal(recRes.hybrid.alignment.status, 'completed');
  const refusedCodes = recOracle.stats.correctionsReceived.flatMap(c => c.corrections.flatMap(x => x.refused));
  assert.ok(refusedCodes.includes('empty_answer'));

  // 2. Repeated empty judgment array stops after 1 retry and leaves NOT_CHECKED (never PASS)
  const { result: stopRes } = await runWithOracle(syl, {
    variantSpec: spec,
    faults: [{ type: 'always_empty_judgements', onPair: 'clo0-po7' }],
  });
  assert.equal(stopRes.score, null, 'Unverified scored relationship must prevent official score');
  assert.equal(stopRes.hybrid.alignment.status, 'not_evaluated');
  const clo0po7 = stopRes.hybrid.alignment.judgements.find(j => j.id === 'clo0-po7');
  assert.equal(clo0po7?.unverified, true);
  assert.equal(clo0po7?.stoppedBecause, 'repeated_coverage_error');
  const falsePass = stopRes.hybrid.verdict.findings.filter(f => f.status === 'PASS' && f.verification === 'unverified');
  assert.equal(falsePass.length, 0);

  // 3. Run-level providerGuard stops after 9 consecutive unproductive responses
  const guard = createGuard({
    fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
    maxRequests: 60,
    maxCost: 1.0,
    maxUnproductive: 9,
  });
  for (let i = 1; i <= 9; i++) {
    assert.equal(guard.stopped(), null);
    guard.noteAnswer({ verified: 0, invalid: 'empty_answer' });
  }
  assert.match(guard.stopped() || '', /9 answer\(s\) in a row verified no relationship/);
});

test('A5.2 fault injection: missing relationship IDs (partial valid batch salvages verified items and retries only missing ID)', async () => {
  const syl = variant('bsit', 'aligned', manifest);
  const spec = manifest.variants['bsit-aligned'];

  const { result, oracle } = await runWithOracle(syl, {
    variantSpec: spec,
    faults: [{ type: 'omit_id', onPair: 'clo1-course', attempt: 1 }],
  });
  assert.equal(result.score, 100);
  assert.equal(result.hybrid.alignment.status, 'completed');
  assert.equal(oracle.stats.pairAttempts['clo1-course'], 2, 'Missing ID must be retried once');
  assert.equal(oracle.stats.pairAttempts['clo0-course'], 1, 'Validated sibling in same batch must NOT be re-asked');
});

test('A5.3 fault injection: invalid evidence quotations (swapped, wrong side, case flip, missing, and cross-pair isolation)', async () => {
  const syl = variant('bsit', 'aligned', manifest);
  const spec = manifest.variants['bsit-aligned'];

  const { result, oracle } = await runWithOracle(syl, {
    variantSpec: spec,
    faults: [
      { type: 'quotes_swapped', onPair: 'clo0-course', attempt: 1 },
      { type: 'quote_wrong_side', side: 'source', onPair: 'clo1-course', attempt: 1 },
      { type: 'quote_case_flip', side: 'target', onPair: 'clo2-course', attempt: 1 },
      { type: 'quote_missing', side: 'source', onPair: 'clo3-course', attempt: 1 },
      { type: 'quote_from_other_pair', side: 'target', onPair: 'row1-content', attempt: 1 },
    ],
  });

  assert.equal(result.score, 100);
  assert.equal(result.hybrid.alignment.status, 'completed');
  const refusedCodes = oracle.stats.correctionsReceived.flatMap(c => c.corrections.flatMap(x => x.refused));
  assert.ok(refusedCodes.includes('quotes_swapped'));
  assert.ok(refusedCodes.includes('quote_wrong_side'));
  assert.ok(refusedCodes.includes('quote_not_found'));
  assert.ok(refusedCodes.includes('quote_missing'));
  assert.ok(refusedCodes.includes('quote_from_other_pair'));

  // Confirm quote_from_other_pair was retried ALONE (single-item batch isolation)
  const retryCallForRow1 = oracle.stats.calls.find(c => c.pairIds.includes('row1-content') && c.corrections.length > 0);
  assert.ok(retryCallForRow1);
  assert.deepEqual(retryCallForRow1.pairIds, ['row1-content'], 'Cross-pair quote contamination must isolate the retry to a single relationship');
});

test('A5.4 fault injection: broken JSON and cut-off reply (finish_reason=length) split batch in half and recover', async () => {
  const syl = variant('bsit', 'aligned', manifest);
  const spec = manifest.variants['bsit-aligned'];

  const { result, oracle } = await runWithOracle(syl, {
    variantSpec: spec,
    faults: [
      { type: 'broken_json', onRequest: 1 },
      { type: 'cutoff_length', onRequest: 5 },
    ],
  });
  assert.equal(result.score, 100);
  assert.equal(result.hybrid.alignment.status, 'completed');
  // Request 1 had 4 items -> split into two 2-item requests (requests 2 and 3)
  assert.equal(oracle.stats.calls[0].pairIds.length, 4);
  assert.equal(oracle.stats.calls[1].pairIds.length, 2);
  assert.equal(oracle.stats.calls[2].pairIds.length, 2);
});

test('A5.5 fault injection: conflicting academic judgments (contract-level refusal vs aspect-level contradictory_response downgrade)', async () => {
  const syl = variant('bsit', 'aligned', manifest);
  const spec = manifest.variants['bsit-aligned'];

  // 1. Contract-level conflicts are refused by checkOne and retried with corrections:
  //    - ALIGNED with REWRITE_TEXT -> recommendation_conflicts_label
  //    - NOT_ALIGNED with NO_CHANGE -> recommendation_conflicts_label
  //    - RETAG_OUTCOME accompanied by a text rewrite -> retag_with_rewrite
  //    - RETAG_OUTCOME on a non-retag relationship type (Content-course) -> retag_not_applicable
  const { result: contractRes, oracle: contractOracle } = await runWithOracle(syl, {
    variantSpec: spec,
    faults: [
      { type: 'conflicting_recommendation', onPair: 'clo0-course', attempt: 1, label: 'ALIGNED', recommendation: 'REWRITE_TEXT', draft: 'Unwanted rewrite.' },
      { type: 'conflicting_recommendation', onPair: 'clo1-course', attempt: 1, label: 'NOT_ALIGNED', recommendation: 'NO_CHANGE', draft: '' },
      { type: 'conflicting_recommendation', onPair: 'clo0-po7', attempt: 1, label: 'NOT_ALIGNED', recommendation: 'RETAG_OUTCOME', withRewrite: true },
      { type: 'conflicting_recommendation', onPair: 'row1-content', attempt: 1, label: 'NOT_ALIGNED', recommendation: 'RETAG_OUTCOME', draft: '' },
    ],
  });
  assert.equal(contractRes.score, 100);
  const contractCodes = contractOracle.stats.correctionsReceived.flatMap(c => c.corrections.flatMap(x => x.refused));
  assert.ok(contractCodes.includes('recommendation_conflicts_label'));
  assert.ok(contractCodes.includes('retag_with_rewrite'));
  assert.ok(contractCodes.includes('retag_not_applicable'));

  // 2. Aspect-level contradiction (ALIGNED label with teaching: 'weak', and NOT_ALIGNED label with all-sound assessment aspects)
  //    passes JSON schema validation, is detected by aspects.contradictionsOf, downgraded to NEEDS_REVIEW (contradictory_response), and draft is withheld
  const { result: aspectRes } = await runWithOracle(syl, {
    variantSpec: spec,
    faults: [
      {
        type: 'conflicting_aspects',
        onPair: 'row1-activityfit',
        label: 'ALIGNED',
        fields: { teaching: 'weak', learnerSupport: 'limited', responsible: 'activity' },
      },
      {
        type: 'conflicting_aspects',
        onPair: 'row2-assessfit',
        label: 'NOT_ALIGNED',
        fields: { measures: 'yes', evidence: 'observable', level: 'matches', responsible: 'none' },
        draft: '- Written quiz and lab exercise with grading rubric.',
      },
    ],
  });
  const actFinding = aspectRes.hybrid.verdict.findings.find(f => f.relationshipId === 'row1-activityfit');
  assert.equal(actFinding?.status, 'NEEDS_REVIEW', 'ALIGNED label with negative aspects must never be accepted as PASS');
  assert.equal(actFinding?.verification, 'contradictory_response');
  assert.equal(actFinding?.responseNote, 'contradictory');

  const assFinding = aspectRes.hybrid.verdict.findings.find(f => f.relationshipId === 'row2-assessfit');
  assert.equal(assFinding?.status, 'NEEDS_REVIEW');
  assert.equal(assFinding?.verification, 'contradictory_response');
  assert.equal(assFinding?.recommendation, null, 'Contradictory finding must withhold its draft');
  assert.equal(aspectRes.hybrid.suggestions.some(s => s.path === 'plan[2].tasks'), false);
});

test('A5.6 fault injection: unsupported suggested corrections are withheld (withheld=draft_review) without erasing findings or official deductions', async () => {
  const syl = variant('bsit', 'aligned', manifest);
  // Make Week 5 (row4) content off-subject so keeps_off_subject has off-subject topic words to detect if retained in the draft
  syl.content.plan[4].contents = 'Medieval fresco restoration, mineral pigments, lime plaster preparation and period brushwork';
  const spec = manifest.variants['bsit-aligned'];

  // Inject all 10 blocking draft-review defect kinds + 1 advisory conditional_resource warning
  const { result, oracle } = await runWithOracle(syl, {
    variantSpec: spec,
    faults: [
      { type: 'unsupported_draft', kind: 'unnecessary_practical', onPair: 'row0-activityfit', label: 'PARTIALLY_ALIGNED' },
      { type: 'unsupported_draft', kind: 'copies_other_relationship', onPair: 'row2-activityfit', label: 'PARTIALLY_ALIGNED' },
      { type: 'unsupported_draft', kind: 'copies_reference', onPair: 'row3-ilo0-activity', label: 'NOT_ALIGNED' },
      { type: 'unsupported_draft', kind: 'keeps_off_subject', onPair: 'row4-content', label: 'NOT_ALIGNED' },
      { type: 'unsupported_draft', kind: 'assumes_resource', onPair: 'row6-activityfit', label: 'PARTIALLY_ALIGNED' },
      { type: 'unsupported_draft', kind: 'expands_competency', onPair: 'row7-activityfit', label: 'PARTIALLY_ALIGNED' },
      { type: 'unsupported_draft', kind: 'adds_participant', onPair: 'row8-assessfit', label: 'PARTIALLY_ALIGNED' },
      { type: 'unsupported_draft', kind: 'adds_activity', onPair: 'row9-valueuse', label: 'PARTIALLY_ALIGNED' },
      { type: 'unsupported_draft', kind: 'adds_week', onPair: 'row10-valueuse', label: 'PARTIALLY_ALIGNED' },
      { type: 'unsupported_draft', kind: 'value_not_expressed', onPair: 'row13-valueuse', label: 'PARTIALLY_ALIGNED' },
      { type: 'unsupported_draft', kind: 'conditional_resource', onPair: 'row12-activityfit', label: 'PARTIALLY_ALIGNED' },
    ],
  });

  const score = scoreRun(result, syl, spec, { requests: oracle.stats.requests });
  assert.equal(score.criteria.E5_zeroReleasedUnsupportedDrafts, true, 'Zero held drafts may appear in suggestions or finding.recommendation');
  assert.equal(score.criteria.R7_withheldUnsupportedDrafts, 10, 'All 10 blocking unsupported relationships must have drafts withheld');

  const blockedPairs = [
    'row0-activityfit',
    'row2-activityfit',
    'row3-ilo0-activity',
    'row4-content',
    'row6-activityfit',
    'row7-activityfit',
    'row8-assessfit',
    'row9-valueuse',
    'row10-valueuse',
    'row13-valueuse',
  ];
  for (const id of blockedPairs) {
    const f = result.hybrid.verdict.findings.find(x => x.relationshipId === id);
    assert.ok(f, `Finding for ${id} must still be reported`);
    assert.notEqual(f.status, 'PASS', `Finding for ${id} must not be erased`);
    assert.equal(f.withheld, 'draft_review', `${id} must have withheld='draft_review'`);
    assert.equal(f.recommendation, null, `${id} must have recommendation=null`);
    assert.equal(f.recommendationType, 'REVIEW_REQUIRED', `${id} must downgrade recommendationType to REVIEW_REQUIRED`);
  }

  // Scored pair row3-ilo0-activity still keeps its official deduction (-3 points -> score 97) even though its bad draft was withheld
  assert.equal(result.score, 97);

  // Conditional resource ("if available") is an advisory warning only, NOT withheld
  const condJ = result.hybrid.alignment.judgements.find(j => j.id === 'row12-activityfit');
  assert.ok(condJ?.draftWarnings?.includes('conditional_resource'));
  assert.equal(condJ?.draftReview?.length || 0, 0);
  const condF = result.hybrid.verdict.findings.find(x => x.relationshipId === 'row12-activityfit');
  assert.equal(condF?.withheld, null);
  assert.ok(condF?.recommendation);
});

test('A5.7 fault injection: authentication failures (401/402/403), rate limits (429), server errors (503), and timeouts never produce false PASS verdicts', async () => {
  const syl = variant('bsit', 'aligned', manifest);
  const spec = manifest.variants['bsit-aligned'];

  // 1. HTTP 401 authentication failure stops immediately, trips breaker, leaves unreached as NOT_CHECKED
  const { result: authRes, oracle: authOracle } = await runWithOracle(syl, {
    variantSpec: spec,
    faults: [{ type: 'http_error', status: 401, onRequest: 2 }],
  });
  assert.equal(authRes.score, null);
  assert.equal(authRes.passed, false);
  assert.equal(authRes.hybrid.alignment.status, 'not_evaluated');
  assert.equal(authRes.hybrid.alignment.failure.kind, 'provider_access');
  assert.equal(authOracle.stats.requests, 2, 'Must stop immediately after HTTP 401');
  const authScore = scoreRun(authRes, syl, spec);
  assert.equal(authScore.criteria.E4_zeroUnverifiedPass, true);

  // 2. HTTP 429 rate limit stops immediately and marks incomplete
  const { result: quotaRes } = await runWithOracle(syl, {
    variantSpec: spec,
    faults: [{ type: 'http_error', status: 429, onRequest: 2 }],
  });
  assert.equal(quotaRes.score, null);
  assert.equal(quotaRes.hybrid.alignment.failure.kind, 'provider_quota');
  assert.equal(scoreRun(quotaRes, syl, spec).criteria.E4_zeroUnverifiedPass, true);

  // 3. Single batch timeout (TimeoutError) marks that batch notChecked (provider_timeout), finishes other batches, withholds official score
  const { result: timeoutRes } = await runWithOracle(syl, {
    variantSpec: spec,
    faults: [{ type: 'timeout', onRequest: 2 }],
  });
  assert.equal(timeoutRes.score, null);
  assert.equal(timeoutRes.hybrid.alignment.status, 'not_evaluated');
  assert.equal(timeoutRes.hybrid.alignment.failure.kind, 'provider_timeout');
  assert.ok(timeoutRes.findings.some(f => f.ruleId === 'AI-REQUIRED' && f.severity === 'blocking'));
  assert.equal(scoreRun(timeoutRes, syl, spec).criteria.E4_zeroUnverifiedPass, true);

  // 4. Single batch HTTP 503 server error marks that batch notChecked (provider_error) and never approves unverified items
  const { result: err503Res } = await runWithOracle(syl, {
    variantSpec: spec,
    faults: [{ type: 'http_error', status: 503, onRequest: 3 }],
  });
  assert.equal(err503Res.score, null);
  assert.equal(err503Res.hybrid.alignment.failure.kind, 'provider_error');
  assert.equal(scoreRun(err503Res, syl, spec).criteria.E4_zeroUnverifiedPass, true);

  resetProviderBlock();
});

// ============================================================================
// A6: Identity and Structure Edge Cases (edge:<id>)
// ============================================================================

test('A6.1 unknown course code stops AI by default (score=0) and labels findings provisional when SYLLABUS_CHECK_PROVISIONAL_AI=on', async () => {
  const edgeSyl = variant('bsit', 'edge:bsit-unknown-code', manifest);

  // Default: AI does not run, CUR-03 fails, score is 0, all 13 AI rules are NOT_CHECKED
  const { result: stopRes, oracle: stopOracle } = await runWithOracle(edgeSyl, {});
  assert.equal(stopRes.score, 0);
  assert.equal(stopRes.passed, false);
  assert.equal(stopOracle.stats.requests, 0);
  assert.equal(stopRes.hybrid.alignment.status, 'not_evaluated');
  const cur03 = stopRes.hybrid.verdict.findings.find(f => f.ruleId === 'CUR-03');
  assert.equal(cur03?.status, 'FAIL');
  const notCheckedAiRules = stopRes.hybrid.verdict.findings.filter(f => f.method === 'ai_semantic' && f.status === 'NOT_CHECKED');
  assert.ok(notCheckedAiRules.length >= 13);

  // Provisional AI mode: AI runs, every AI finding has identityBasis='provisional', NEEDS_IDENTITY rules are never PASS
  const { result: provRes, oracle: provOracle } = await runWithOracle(
    edgeSyl,
    {},
    { env: { SYLLABUS_CHECK_PROVISIONAL_AI: 'on' } }
  );
  assert.equal(provRes.score, 0, 'Official score must still be 0 when course code is unknown');
  assert.ok(provOracle.stats.requests > 0, 'Provisional AI must run when enabled');
  assert.equal(provRes.hybrid.verdict.overall, 'NOT_COMPLIANT');
  const aiFindings = (provRes.hybrid.verdict.all || provRes.hybrid.verdict.findings).filter(
    f => f.method === 'ai_semantic' && f.relationshipId !== null
  );
  assert.ok(aiFindings.length > 0);
  for (const f of aiFindings) {
    assert.equal(f.identityBasis, 'provisional');
  }
  const falseIdentityPass = aiFindings.filter(
    f => ['CLO-03', 'CLO-09', 'PLAN-03', 'ALN-06', 'REF-03'].includes(f.ruleId) && f.status === 'PASS'
  );
  assert.equal(falseIdentityPass.length, 0, 'NEEDS_IDENTITY rules must never be PASS under provisional identity');
});

test('A6.2 cross-program course code collisions (IT-202 in BSIT vs BSIT-CYBERSECURITY vs BSIE) and deterministic edge cases', async () => {
  // 1. cyber-collision-it202: IT-202 in BSIT-CYBERSECURITY has official title "SYSTEM INTEGRATION AND ARCHITECTURE 1", not BSIT's "COMPUTER PROGRAMMING 1"
  const cyberCol = variant('cyber', 'edge:cyber-collision-it202', manifest);
  const { result: cyberColRes } = await runWithOracle(cyberCol, {});
  const cyberCur04 = cyberColRes.hybrid.verdict.findings.find(f => f.ruleId === 'CUR-04');
  assert.equal(cyberCur04?.status, 'FAIL');
  assert.match(cyberCur04?.recommendation || '', /SYSTEM INTEGRATION AND ARCHITECTURE 1/i);

  // 2. bsit-collision-cyber-title: IT 202 in BSIT has official title "COMPUTER PROGRAMMING 1 (FUNDAMENTALS OF PROGRAMMING)"
  const bsitCol = variant('bsit', 'edge:bsit-collision-cyber-title', manifest);
  const { result: bsitColRes } = await runWithOracle(bsitCol, {});
  const bsitCur04 = bsitColRes.hybrid.verdict.findings.find(f => f.ruleId === 'CUR-04');
  assert.equal(bsitCur04?.status, 'FAIL');
  assert.match(bsitCur04?.recommendation || '', /COMPUTER PROGRAMMING 1/i);

  // 3. bsie-cross-program-it202: IT 202 submitted under BSIE fails CUR-03
  const bsieCol = variant('bsie', 'edge:bsie-cross-program-it202', manifest);
  const { result: bsieColRes } = await runWithOracle(bsieCol, {});
  assert.equal(bsieColRes.score, 0);
  assert.equal(bsieColRes.hybrid.verdict.findings.find(f => f.ruleId === 'CUR-03')?.status, 'FAIL');

  // 4. bsit-title-case-only under shadow, exact, and normalized title comparison policies
  const titleSyl = variant('bsit', 'edge:bsit-title-case-only', manifest);
  const { result: shadowRes } = await runWithOracle(titleSyl, {}, { env: { SYLLABUS_CHECK_TITLE_POLICY: 'shadow' } });
  assert.equal(shadowRes.hybrid.verdict.findings.find(f => f.ruleId === 'CUR-04')?.status, 'FAIL');
  assert.equal(shadowRes.hybrid.shadowCurriculum?.mode, 'shadow');
  assert.equal(shadowRes.hybrid.shadowCurriculum?.title?.shadowStatus, 'PASS');

  const { result: exactRes } = await runWithOracle(titleSyl, {}, { env: { SYLLABUS_CHECK_TITLE_POLICY: 'exact' } });
  assert.equal(exactRes.hybrid.verdict.findings.find(f => f.ruleId === 'CUR-04')?.status, 'FAIL');
  assert.equal(exactRes.hybrid.shadowCurriculum, null);

  const { result: normRes } = await runWithOracle(titleSyl, {}, { env: { SYLLABUS_CHECK_TITLE_POLICY: 'normalized' } });
  assert.equal(normRes.score, 100);
  assert.equal(normRes.hybrid.verdict.findings.find(f => f.ruleId === 'CUR-04'), undefined);
  assert.equal(normRes.hybrid.shadowCurriculum?.mode, 'active');

  // 5. Remaining deterministic edges: wrong metadata, 3 CLOs + bad level/verb, duplicate CLO wording, empty Week 1
  for (const [key, edgeId] of [
    ['bsit', 'bsit-wrong-metadata'],
    ['bsit', 'bsit-three-clos-bad-level'],
    ['bsit', 'bsit-duplicate-clo-wording'],
    ['bscpe', 'bscpe-week1-empty'],
  ]) {
    const syl = variant(key, `edge:${edgeId}`, manifest);
    const edgeSpec = syl.edges[0];
    const { result } = await runWithOracle(syl, {});
    for (const det of edgeSpec.deterministic) {
      const f = result.hybrid.verdict.findings.find(x => x.ruleId === det.ruleId && (!det.path || x.path === det.path));
      assert.ok(f, `Expected ${det.ruleId} on edge:${edgeId}`);
      assert.equal(f.status, det.status);
    }
  }
});

test('A6.3 targeted regression cases for Cyber Security (2025-2026) and BSIT (2022-2023) courses that normalize to similar identifiers across curriculum versions', async () => {
  // All 8 course pairs in local-curriculum-data.cjs that normalize (squash) to identical alphanumeric identifiers
  // across BSIT-CYBERSECURITY (2025-2026) and BSIT (2022-2023) while differing in punctuation, title, units, or prerequisites
  const overlappingPairs = [
    {
      normalized: 'IT102',
      cyber: { code: 'IT 102-', title: 'DISCRETE MATHEMATICS', lec: 3, lab: 0, prereq: 'Not specified in the source curriculum (blank prerequisite cell).' },
      bsit: { code: 'IT 102', title: 'DISCRETE MATHEMATICS', lec: 3, lab: 0, prereq: 'IT 101' },
    },
    {
      normalized: 'IT202',
      cyber: { code: 'IT-202', title: 'SYSTEM INTEGRATION AND ARCHITECTURE 1', lec: 2, lab: 1, prereq: 'IT 103-' },
      bsit: { code: 'IT 202', title: 'COMPUTER PROGRAMMING 1 (FUNDAMENTALS OF PROGRAMMING)', lec: 2, lab: 1, prereq: 'IT 101' },
    },
    {
      normalized: 'IT203',
      cyber: { code: 'IT-203', title: 'COMPUTER NETWORKS 1 (FUNDAMENTALS OF NETWORKING)', lec: 2, lab: 1, prereq: 'IT 104' },
      bsit: { code: 'IT 203', title: 'DATA STRUCTURE AND ALGORITHM', lec: 3, lab: 0, prereq: 'IT 102' },
    },
    {
      normalized: 'IT204',
      cyber: { code: 'IT-204-', title: 'QUANTITATIVE METHODS (INCLUDING MODELING AND SIMULATION)', lec: 3, lab: 0, prereq: 'IT 102-' },
      bsit: { code: 'IT-204', title: 'COMPUTER PROGRAMMING 2(INTERMEDIATE PROGRAMMING)', lec: 2, lab: 1, prereq: 'IT 202' },
    },
    {
      normalized: 'IT205',
      cyber: { code: 'IT 205-', title: 'INFORMATION MANAGEMENT 1 (DATABASE FUNDAMENTAL)', lec: 2, lab: 1, prereq: 'IT 103-' },
      bsit: { code: 'IT-205', title: 'INTRODUCTION TO HUMAN COMPUTER INTERACTION', lec: 3, lab: 0, prereq: 'IT 202' },
    },
    {
      normalized: 'IT306',
      cyber: { code: 'IT-306', title: 'APPLICATION DEVELOPMENT AND EMERGING THEORIES', lec: 2, lab: 1, prereq: 'IT 209-' },
      bsit: { code: 'IT 306', title: 'INFORMATION MANAGEMENT 2 (ADVANCED DATABASE)', lec: 2, lab: 1, prereq: 'IT-302' },
    },
    {
      normalized: 'IT307',
      cyber: { code: 'IT-307-', title: 'SYSTEM ADMINISTRATION AND MAINTENANCE', lec: 2, lab: 1, prereq: 'IT 208-' },
      bsit: { code: 'IT-307', title: 'COMPUTER NETWORKS 2 (ADVANCED NETWORKING)', lec: 2, lab: 1, prereq: 'IT-304' },
    },
    {
      normalized: 'ITELEC1',
      cyber: { code: 'IT-ELEC1-', title: 'IT ELECTIVE 1 (INTRO.TO DATA SCIENCE IN PHYTON)', lec: 0, lab: 1, prereq: 'IT 208-' },
      bsit: { code: 'IT-ELEC1', title: 'IT ELECTIVE 1 (INTRO.TO DATA SCIENCE IN PYTHON)', lec: 2, lab: 1, prereq: '3rd Yr' },
    },
  ];

  // 1. buildSyllabus() resolves normalized identifiers strictly within the specified (program, curriculumYear)
  const orient = base('bsit').content.plan[0];
  const filledWeeks = CYBER.weeks.map((w, i) => (i === 0 ? [w[0], w[1], w[2], orient.activities, orient.tasks, orient.values] : w));

  for (const pair of overlappingPairs) {
    const cyberResolved = buildSyllabus(`cyber-${pair.normalized}`, {
      ...CYBER,
      weeks: filledWeeks,
      code: pair.normalized, // pass squashed identifier to test loose fallback within the selected curriculum
    });
    assert.equal(cyberResolved.program, 'BSIT-CYBERSECURITY');
    assert.equal(cyberResolved.content.meta.curriculumYear, '2025-2026');
    assert.equal(cyberResolved.masters.curricula[0].curriculumYear, '2025-2026');
    assert.equal(cyberResolved.record.code, pair.cyber.code);
    assert.equal(cyberResolved.record.title, pair.cyber.title);
    assert.equal(Number(cyberResolved.record.lecture), pair.cyber.lec);
    assert.equal(Number(cyberResolved.record.lab), pair.cyber.lab);
    assert.equal(cyberResolved.record.prereq || '', pair.cyber.prereq);
    assert.equal(cyberResolved.content.meta.code, pair.cyber.code);
    assert.equal(cyberResolved.content.meta.title, pair.cyber.title);

    const bsitResolved = buildSyllabus(`bsit-${pair.normalized}`, {
      ...CYBER,
      weeks: filledWeeks,
      program: 'BSIT',
      curriculumYear: '2022-2023',
      outcomes: 'BSIT',
      code: pair.normalized,
    });
    assert.equal(bsitResolved.program, 'BSIT');
    assert.equal(bsitResolved.content.meta.curriculumYear, '2022-2023');
    assert.equal(bsitResolved.masters.curricula[0].curriculumYear, '2022-2023');
    assert.equal(bsitResolved.record.code, pair.bsit.code);
    assert.equal(bsitResolved.record.title, pair.bsit.title);
    assert.equal(Number(bsitResolved.record.lecture), pair.bsit.lec);
    assert.equal(Number(bsitResolved.record.lab), pair.bsit.lab);
    assert.equal(bsitResolved.record.prereq || '', pair.bsit.prereq);
    assert.equal(bsitResolved.content.meta.code, pair.bsit.code);
    assert.equal(bsitResolved.content.meta.title, pair.bsit.title);

    // 2. Engine normCode preserves hyphen punctuation, so submitting BSIT's code variant under BSIT-CYBERSECURITY (2025-2026)
    // fails CUR-03 (critical mismatch, score=0) for all 8 pairs where hyphenation differs
    assert.notEqual(pair.cyber.code, pair.bsit.code);
    const wrongPunctSyl = JSON.parse(JSON.stringify(cyberResolved));
    wrongPunctSyl.content.meta.code = pair.bsit.code;
    const { result: punctRes, oracle: punctOracle } = await runWithOracle(wrongPunctSyl, {});
    assert.equal(punctRes.score, 0, `Submitting BSIT code "${pair.bsit.code}" under BSIT-CYBERSECURITY must fail CUR-03 with score=0`);
    assert.equal(punctOracle.stats.requests, 0, 'Unrecognized course code punctuation must stop AI checking by default');
    assert.equal(punctRes.hybrid.verdict.findings.find(f => f.ruleId === 'CUR-03')?.status, 'FAIL');
  }

  // 3. Multi-curriculum masters containing both BSIT (2022-2023) and BSIT-CYBERSECURITY (2025-2026):
  //    - Explicit curriculumYear='2025-2026' selects only BSIT-CYBERSECURITY (2025-2026)
  //    - Explicit curriculumYear='2022-2023' selects only BSIT (2022-2023)
  //    - Missing curriculumYear when both curricula match programCodes refuses to guess (CUR-01 / CUR-02 NEEDS_REVIEW, score=null)
  const cyberSample = buildSyllabus('cyber-it204', { ...CYBER, weeks: filledWeeks, code: 'IT-204-' });
  const bsitSample = buildSyllabus('bsit-it204', { ...CYBER, weeks: filledWeeks, program: 'BSIT', curriculumYear: '2022-2023', outcomes: 'BSIT', code: 'IT-204' });
  const multiCurrSyl = JSON.parse(JSON.stringify(cyberSample));
  multiCurrSyl.masters.curricula = [
    cyberSample.masters.curricula[0],
    bsitSample.masters.curricula[0],
  ];
  multiCurrSyl.masters.programCodes = ['BSIT-CYBERSECURITY', 'BSIT'];

  // 3a. With explicit curriculumYear='2025-2026', resolves to BSIT-CYBERSECURITY IT-204- (score=100)
  const { result: explicit2025 } = await runWithOracle(multiCurrSyl, {});
  assert.equal(explicit2025.score, 100);
  assert.equal(explicit2025.hybrid.curriculum?.program, 'BSIT-CYBERSECURITY');
  assert.equal(explicit2025.hybrid.curriculum?.curriculumYear, '2025-2026');
  assert.equal(explicit2025.hybrid.codedChecks.find(c => c.ruleId === 'CUR-CODE')?.evidence?.expected, 'IT-204-');

  // 3b. With explicit curriculumYear='2022-2023', IT-204- is not in BSIT 2022-2023 (which has IT-204), so CUR-03 fails
  const wrongYearSyl = JSON.parse(JSON.stringify(multiCurrSyl));
  wrongYearSyl.content.meta.curriculumYear = '2022-2023';
  const { result: explicit2022 } = await runWithOracle(wrongYearSyl, {});
  assert.equal(explicit2022.score, 0);
  assert.equal(explicit2022.hybrid.verdict.findings.find(f => f.ruleId === 'CUR-03')?.status, 'FAIL');

  // 3c. With blank curriculumYear='', two curriculum versions match programCodes -> engine refuses to guess (score=null, curriculum=null, CUR-02/CUR-03 NEEDS_REVIEW)
  const ambiguousYearSyl = JSON.parse(JSON.stringify(multiCurrSyl));
  ambiguousYearSyl.content.meta.curriculumYear = '';
  const { result: ambiguousRes } = await runWithOracle(ambiguousYearSyl, {});
  assert.equal(ambiguousRes.score, null);
  assert.equal(ambiguousRes.passed, false);
  assert.equal(ambiguousRes.hybrid.curriculum, null);
  assert.equal(ambiguousRes.hybrid.codedChecks.find(c => c.ruleId === 'CUR-CODE')?.status, 'NOT_EVALUATED');
  assert.equal(ambiguousRes.hybrid.verdict.findings.find(f => f.ruleId === 'CUR-02')?.status, 'NEEDS_REVIEW');
  assert.equal(ambiguousRes.hybrid.verdict.findings.find(f => f.ruleId === 'CUR-03')?.status, 'NEEDS_REVIEW');
});

// ============================================================================
// A7: Language (English/Tagalog i18n) and Cached-Report Compatibility
// ============================================================================

test('A7.1 English/Tagalog i18n audit passes with 0 untranslated verdict sentences', () => {
  const scriptPath = path.join(__dirname, '..', '..', '..', 'scripts', 'audit-verdict-i18n.mjs');
  const out = execFileSync(process.execPath, [scriptPath], { encoding: 'utf8' });
  assert.match(out, /\*\*0 of \d+\*\* distinct server sentences shown in the Verdict Panel have no Tagalog entry/);
});

test('A7.2 prompt version strings and cached pre-Stage-C / r7 report backward compatibility remain intact', () => {
  assert.equal(promptVersionOf(DEFAULT_MODEL, LEGACY_ENV), 'alignment-10');
  assert.equal(promptVersionOf(DEFAULT_MODEL, DEFAULT_ENV), 'alignment-12ab34c1c2d1d2-r8-a8');

  // Simulate an older cached report that predates aspect fields and has a draft flagged by draftReview
  const syl = base('bsit');
  const cachedResult = {
    score: 97,
    baseScore: 100,
    passed: true,
    findings: [
      {
        id: 'SEM:row1-ilo0-activity',
        ruleId: 'SEM',
        path: 'plan[1].ilos[0].text',
        step: 'plan',
        area: 'assessment',
        severity: 'major',
        source: 'ai',
        message: 'Activity is too passive.',
        evidence: {
          id: 'row1-ilo0-activity',
          type: 'ILO-activity',
          path: 'plan[1].ilos[0].text',
          targetPath: 'plan[1].activities',
          label: 'NOT_ALIGNED',
          explanation: 'Activity is too passive.',
          sourceQuote: 'Explain',
          targetQuote: 'Lecture',
          evidenceMatching: { source: 'exact', target: 'exact' },
          draft: '- In the electronics laboratory, use an oscilloscope and logic analyzer to test the circuit.',
          draftReview: ['assumes_resource'],
        },
      },
    ],
    checks: [],
    conformance: { failed: [] },
    hybrid: {
      ready: true,
      deductions: [{ id: 'SEM:row1-ilo0-activity', points: 3, reason: 'NOT_ALIGNED', kind: 'alignment', path: 'plan[1].activities' }],
      suggestions: [
        {
          id: 'SEM:row1-ilo0-activity',
          path: 'plan[1].activities',
          title: 'Suggested alignment revision',
          text: '- In the electronics laboratory, use an oscilloscope and logic analyzer to test the circuit.',
          replacement: '- In the electronics laboratory, use an oscilloscope and logic analyzer to test the circuit.',
          source: 'ai',
          basedOn: ['SEM:row1-ilo0-activity'],
        },
      ],
      mappingAdvice: [],
      alignment: {
        status: 'completed',
        promptVersion: 'alignment-10',
        judgements: [
          {
            id: 'row1-ilo0-activity',
            type: 'ILO-activity',
            path: 'plan[1].ilos[0].text',
            targetPath: 'plan[1].activities',
            label: 'NOT_ALIGNED',
            explanation: 'Activity is too passive.',
            sourceQuote: 'Explain',
            targetQuote: 'Lecture',
            evidenceMatching: { source: 'exact', target: 'exact' },
            draft: '- In the electronics laboratory, use an oscilloscope and logic analyzer to test the circuit.',
            draftReview: ['assumes_resource'],
          },
        ],
      },
    },
  };
  cachedResult.hybrid.verdict = buildVerdict(cachedResult, syl.content);
  const refreshed = withholdReviewedDrafts(cachedResult);
  assert.equal(refreshed.score, 97, 'Cached official score must never be altered by withholdReviewedDrafts');
  assert.equal(refreshed.hybrid.suggestions.length, 0, 'Unsupported lab hardware draft in cached report must be withheld on read');
  const f = refreshed.hybrid.verdict.findings.find(x => x.relationshipId === 'row1-ilo0-activity');
  assert.equal(f?.withheld, 'draft_review');
  assert.equal(f?.recommendation, null);
});

test('A7.3 Section 7 request-volume measurement estimates model requests across all 8 complete 18-week variants without network calls or ledger edits', async () => {
  const vol = await estimatePhase3RequestVolume({ manifest });
  assert.equal(vol.offline, true);
  assert.equal(vol.ledgerTouched, false);
  assert.equal(vol.rows.length, 8);
  assert.equal(vol.totals.enhancedRequests, 383);
  assert.equal(vol.totals.enhancedQuestions, 1487);
  assert.equal(vol.totals.enhancedCeiling, 3357);
  assert.equal(vol.totals.legacyRequests, 72);
  assert.equal(vol.totals.legacyQuestions, 798);
  assert.equal(vol.totals.pairedCleanRequests, 455);

  for (const row of vol.rows) {
    if (row.id.endsWith('-aligned')) {
      assert.equal(row.enhanced.requests, 48, `${row.id} enhanced requests must be 48`);
      assert.equal(row.enhanced.questions, 189, `${row.id} enhanced questions must be 189`);
      assert.equal(row.enhanced.retryCeiling, 426, `${row.id} enhanced retryCeiling must be 426`);
      assert.equal(row.legacy.requests, 9, `${row.id} legacy requests must be 9`);
      assert.equal(row.legacy.questions, 100, `${row.id} legacy questions must be 100`);
    } else {
      assert.ok(row.enhanced.requests >= 47 && row.enhanced.requests <= 49);
      assert.ok(row.enhanced.questions >= 181 && row.enhanced.questions <= 184);
      assert.ok(row.enhanced.retryCeiling >= 409 && row.enhanced.retryCeiling <= 417);
      assert.equal(row.legacy.requests, 9, `${row.id} legacy requests must be 9`);
      assert.ok(row.legacy.questions >= 99 && row.legacy.questions <= 100);
    }
  }
});

// ============================================================================
// A8: Manifest Consistency & Historical Dataset Integrity
// ============================================================================

test('A8.1 manifest-phase3-1.json is marked DRAFT, covers all 13 components, and has 0 orphan expectation IDs', async () => {
  assert.match(manifest.status, /^DRAFT/);
  assert.ok(manifestHash(MANIFEST_FILE).length === 64);

  const componentsCovered = new Set([
    ...manifest.defects.map(d => d.component),
    ...manifest.defects.flatMap(d => d.expectations.map(e => e.component)),
    ...manifest.edges.map(e => e.component),
  ]);
  for (let c = 1; c <= 13; c++) {
    assert.ok(componentsCovered.has(c), `Manifest defects + edges must cover component ${c}`);
  }

  for (const defect of manifest.defects) {
    assert.equal(defect.reviewStatus, 'unreviewed', `Defect ${defect.id} must have reviewStatus='unreviewed'`);
    assert.equal(defect.facultyVerdict, null, `Defect ${defect.id} must have facultyVerdict=null`);
    for (const exp of defect.expectations) {
      assert.equal(exp.reviewStatus, 'unreviewed', `Expectation ${exp.id} in ${defect.id} must be unreviewed`);
      assert.equal(exp.facultyVerdict, null, `Expectation ${exp.id} in ${defect.id} must have facultyVerdict=null`);
    }
  }

  for (const key of FIXTURES) {
    const misSyl = variant(key, 'misaligned', manifest);
    const misSpec = manifest.variants[`${key}-misaligned`];
    const { result } = await runWithOracle(misSyl, { variantSpec: misSpec });
    const plannedIds = new Set(result.hybrid.alignment.judgements.map(j => j.id));
    for (const exp of misSpec.expectations) {
      assert.ok(plannedIds.has(exp.id), `Expectation ${exp.id} in ${key}-misaligned must be planned by the engine`);
    }
    // Control rows must not have any expectations targeting them
    for (const ctrlRow of misSpec.controls) {
      const hasExpOnControl = misSpec.expectations.some(e => e.id.startsWith(`row${ctrlRow}-`));
      assert.equal(hasExpOnControl, false, `Control row ${ctrlRow} in ${key}-misaligned must have no expectations`);
    }
  }
});

test('A8.2 historical evaluation datasets and docs/ai-checker-rules.md remain byte-identical to their frozen SHA-256 hashes', () => {
  const repoRoot = path.join(__dirname, '..', '..', '..');
  const expectedHashes = {
    'docs/ai-checker-rules.md': 'e378baecca3c7655e8fa8d210ea9e3ff550f94dccc9872e39d66b4c12db9a00e',
    'server/lib/syllabuscheck/eval/dataset.json': '08423949b5b0ff92401be1a62328e549968233feb91761f87342cf03dbbfacb6',
    'server/lib/syllabuscheck/eval/alignment-dataset.json': 'ab282a107df8c73b6e7e21e60fd990c86837055577bbb5a4cc7758bd62095801',
    'server/lib/syllabuscheck/eval/stage-a-dataset.json': 'e2d3a372c0b6b6c75f3aa0a28bc59ec3c83e24a27e548cbf81aad131aa4c7bad',
    'server/lib/syllabuscheck/eval/stage-b-dataset.json': 'ee51171e9a6bfabccb2969419c77ad752707fba89ee93207a51b6e43daab6945',
    'server/lib/syllabuscheck/eval/stage-b3-dataset.json': 'c7e2ad276368facd4217e3cc95f23af3a51a986b91de594abac77004a9972b80',
    'server/lib/syllabuscheck/eval/stage-b4-dataset.json': '10d1413a56ed053a2bfb2520f9f5d63ec315ce682f8cb9381cf1a7c76dca42fa',
    'server/lib/syllabuscheck/eval/stage-c-dataset.json': 'f1211d4fd6097412146930f3cdae43c20a6c1f28c1e2d76b74cbdc501926dbac',
    'server/lib/syllabuscheck/eval/stage-d1-dataset.json': '596bd425f7971e7f930c2c1aeb3d03b8957f7a6db788938325152f6454cef057',
    'server/lib/syllabuscheck/eval/stage-d1-followup-dataset.json': '6d2eb3017d3303cbfe209626dd7fbf03e021fb4a72f885c6920dbe7c6c13eaf8',
    'server/lib/syllabuscheck/eval/stage-d2-dataset.json': 'bec7e41a93179994235763603459303d736fbb35207ef92493ddf68cafbbc90f',
    'server/lib/syllabuscheck/eval/stage-d2-followup-dataset.json': '73bdc96cc11b8f01b52c92c36d77e79e6b986671c2a134d2e0ee1fee5d287df8',
    'server/lib/syllabuscheck/eval/reference-format-fixtures.json': 'a1d41d0152011a0678c6fcbc5050cf42e5b5697cfdf5bc1580a2ce7372bf19fd',
  };
  for (const [relPath, expectedSha] of Object.entries(expectedHashes)) {
    const absPath = path.join(repoRoot, relPath);
    const actualSha = crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
    assert.equal(actualSha, expectedSha, `Historical file ${relPath} must not be modified`);
  }
});

// ============================================================================
// A9: Phase 3 Layer A, Part 2 — Faculty Review Export & Paired Scoring Drift CLI
// ============================================================================

test('A9.1 offline faculty-review export package includes all required fields, keeps expectations DRAFT, and documents all 5 academic recommendation review topics', async () => {
  const pkg = await buildPhase3FacultyReviewPackage({ manifest });

  assert.equal(pkg.status, DRAFT_STATUS);
  assert.match(pkg.status, /^DRAFT/);
  assert.equal(pkg.offlineOnly, true);
  assert.equal(pkg.autoPopulatedFacultyVerdicts, 0, 'Must never auto-populate faculty verdicts');
  assert.equal(pkg.counts.defectsCount, 46);
  assert.equal(pkg.counts.defectExpectationRecords, 117);
  assert.equal(pkg.counts.openAdjudicationRecords, 2);
  assert.equal(pkg.counts.deterministicEdgeRecords, 13);
  assert.equal(pkg.counts.totalRecords, 132);

  // Verify Section 4 Academic Recommendation Review topics (5 required topics)
  assert.equal(ACADEMIC_RECOMMENDATION_REVIEW.length, 5);
  const topicIds = new Set(pkg.academicRecommendationReview.map(t => t.id));
  assert.ok(topicIds.has('supplied_test_materials'));
  assert.ok(topicIds.has('contact_hours_modification'));
  assert.ok(topicIds.has('cross_relationship_copying'));
  assert.ok(topicIds.has('conditional_resource_recommendations'));
  assert.ok(topicIds.has('as_prog1_vague_evidence_disagreement'));

  const vagueTopic = pkg.academicRecommendationReview.find(t => t.id === 'as_prog1_vague_evidence_disagreement');
  assert.match(vagueTopic.facultyQuestion, /\(Q1\).*\(Q2\).*\(Q3\).*\(Q4\).*\(Q5\)/, 'Must include Q1–Q5 for as-prog1-vague-evidence');

  // Verify every record has all required Section 2 fields and blank faculty fields
  for (const r of pkg.records) {
    assert.ok(r.program, `Record ${r.recordId} must include program`);
    assert.ok(r.courseCode, `Record ${r.recordId} must include courseCode`);
    assert.ok(r.curriculumVersion, `Record ${r.recordId} must include curriculumVersion`);
    assert.ok(r.week, `Record ${r.recordId} must include week`);
    assert.ok(r.affectedField, `Record ${r.recordId} must include affectedField`);
    assert.equal(typeof r.originalContent, 'string');
    assert.equal(typeof r.modifiedContent, 'string');
    assert.equal(typeof r.cloContext, 'string');
    assert.equal(typeof r.iloContext, 'string');
    assert.equal(r.expectedFinding.status, DRAFT_STATUS, `Record ${r.recordId} must be marked DRAFT`);
    assert.ok(r.expectedFinding.ruleId, `Record ${r.recordId} must include expected ruleId`);
    assert.ok(r.expectedFinding.expectedVerdictStatus, `Record ${r.recordId} must include expectedVerdictStatus`);
    assert.equal(typeof r.evidence.sourceText, 'string');
    assert.equal(typeof r.evidence.targetText, 'string');
    assert.ok(Array.isArray(r.upstreamDependencies.paths));
    assert.ok(r.recommendation && typeof r.recommendation.recommendationType === 'string');

    // Faculty review fields must be blank / null
    assert.equal(r.facultyJudgment, null, `Record ${r.recordId} facultyJudgment must be null`);
    assert.equal(r.facultyExplanation, '', `Record ${r.recordId} facultyExplanation must be blank`);
    assert.equal(r.reviewedByRole, '', `Record ${r.recordId} reviewedByRole must be blank`);
    assert.equal(r.reviewDate, '', `Record ${r.recordId} reviewDate must be blank`);
  }

  // Verify defect expectations carry non-empty original vs modified instructional content and verbatim quotes
  const defectRecords = pkg.records.filter(r => r.recordType === 'declarative_defect_expectation');
  assert.ok(defectRecords.every(r => r.originalContent.length > 0 && r.modifiedContent.length > 0));
  assert.ok(defectRecords.every(r => r.evidence.sourceQuote.length > 0 && r.evidence.targetQuote.length > 0));
  assert.ok(defectRecords.some(r => r.upstreamDependencies.paths.length > 0), 'Must include upstream dependency records');

  // Verify CSV columns and generated files in docs/faculty-review/phase3
  const csvKeys = CSV_COLUMNS.map(([k]) => k);
  assert.ok(csvKeys.includes('expectationStatus'));
  assert.ok(csvKeys.includes('facultyJudgment'));
  assert.ok(csvKeys.includes('facultyExplanation'));
  assert.ok(csvKeys.includes('reviewedByRole'));
  assert.ok(csvKeys.includes('reviewDate'));

  const outDir = path.join(__dirname, '..', '..', '..', 'docs', 'faculty-review', 'phase3');
  const written = await writePhase3FacultyReviewPackage(outDir, { manifest });
  assert.ok(fs.existsSync(written.files.jsonPath));
  assert.ok(fs.existsSync(written.files.csvPath));
  assert.ok(fs.existsSync(written.files.htmlPath));
  assert.ok(fs.existsSync(written.files.readmePath));
});

test('A9.2 reconcileScoredRelationshipPolicy reconciles the 6 officially scored types vs 8 legacy planned types and 17 advisory types', () => {
  const rec = reconcileScoredRelationshipPolicy();
  assert.equal(rec.policyConsistent, true);
  assert.deepEqual(rec.scoredRelationshipTypes, [
    'CLO-PO',
    'CLO-EGA',
    'ILO-CLO',
    'ILO-activity',
    'ILO-assessment',
    'Module-value',
  ]);
  assert.equal(rec.scoredRelationshipTypesCount, 6);
  assert.equal(rec.legacyPlannedNonWholeListTypesCount, 8);
  assert.deepEqual(rec.legacyPlannedNonWholeListTypes, [
    'CLO-PO',
    'CLO-EGA',
    'ILO-CLO',
    'ILO-activity',
    'ILO-assessment',
    'Module-value',
    'ILO-content',
    'Description-plan',
  ]);
  assert.equal(rec.legacyAdvisoryRelationshipTypes.length, 5);
  assert.equal(rec.stagedAdvisoryRelationshipTypes.length, 12);
  assert.equal(rec.allAdvisoryRelationshipTypesCount, 17);
  assert.equal(rec.passMark, 79);
});

test('A9.3 runPairedDriftScenarios distinguishes all 5 drift categories and reports per-relationship evidence, deduction, and scoring effect', async () => {
  const report = await runPairedDriftScenarios({ scenario: 'all', manifest });
  assert.equal(report.offline, true);
  assert.equal(report.ledgerTouched, false);
  assert.equal(report.policyReconciliation.policyConsistent, true);

  const byId = new Map(report.scenarios.map(s => [s.scenarioId, s]));

  // 1. No scoring drift (identical-aligned)
  for (const key of FIXTURES) {
    const sc = byId.get(`identical-aligned:${key}-aligned`);
    assert.ok(sc, `Missing scenario identical-aligned:${key}-aligned`);
    assert.equal(sc.comparison.drift.category, 'NO_SCORING_DRIFT');
    assert.equal(sc.comparison.drift.categoryLabel, DRIFT_CATEGORIES.NO_SCORING_DRIFT);
    assert.equal(sc.comparison.scoredJudgments.differentCount, 0);
    assert.equal(sc.comparison.scores.scoreDelta, 0);
  }

  // 2. Advisory-only changes (identical-misaligned)
  for (const key of FIXTURES) {
    const sc = byId.get(`identical-misaligned:${key}-misaligned`);
    assert.ok(sc, `Missing scenario identical-misaligned:${key}-misaligned`);
    assert.equal(sc.comparison.drift.category, 'ADVISORY_ONLY_CHANGES');
    assert.equal(sc.comparison.drift.categoryLabel, DRIFT_CATEGORIES.ADVISORY_ONLY_CHANGES);
    assert.equal(sc.comparison.scoredJudgments.differentCount, 0);
    assert.equal(sc.comparison.scores.scoreDelta, 0);
    assert.ok(sc.comparison.advisoryFindings.advisoryAddedByStagesCount >= 9);
  }

  // 3. Score-only drift (100 -> 92, pass@79 stays true)
  const scoreOnly = byId.get('score-only-drift:bsit-100-to-92');
  assert.equal(scoreOnly.comparison.drift.category, 'SCORE_ONLY_DRIFT');
  assert.equal(scoreOnly.comparison.scores.legacyScore, 100);
  assert.equal(scoreOnly.comparison.scores.enhancedScore, 92);
  assert.equal(scoreOnly.comparison.scores.scoreDelta, -8);
  assert.equal(scoreOnly.comparison.passFailAt79.passChanged, false);
  assert.equal(scoreOnly.comparison.scoredJudgments.differentCount, 4);

  // 4A. Pass/fail-changing drift (92 -> 78 across all 6 scored relationship types, delta -14)
  const passFlip9278 = byId.get('pass-flip-92-78:bsit-6-scored-types');
  assert.equal(passFlip9278.comparison.drift.category, 'PASS_FAIL_CHANGING_DRIFT');
  assert.equal(passFlip9278.comparison.scores.legacyScore, 92);
  assert.equal(passFlip9278.comparison.scores.enhancedScore, 78);
  assert.equal(passFlip9278.comparison.scores.scoreDelta, -14);
  assert.equal(passFlip9278.comparison.passFailAt79.legacyPassed, true);
  assert.equal(passFlip9278.comparison.passFailAt79.enhancedPassed, false);
  assert.equal(passFlip9278.comparison.passFailAt79.passChanged, true);
  assert.equal(passFlip9278.comparison.scoredJudgments.differentCount, 6);
  const typesIn9278 = new Set(passFlip9278.comparison.scoredJudgments.diffs.map(d => d.type));
  assert.deepEqual(
    [...typesIn9278].sort(),
    ['CLO-EGA', 'CLO-PO', 'ILO-CLO', 'ILO-activity', 'ILO-assessment', 'Module-value'],
    '92 vs 78 drift scenario must cover all 6 officially scored relationship types'
  );
  for (const d of passFlip9278.comparison.scoredJudgments.diffs) {
    assert.ok(d.legacyEvidence?.sourceQuote && d.legacyEvidence?.targetQuote);
    assert.ok(d.enhancedEvidence?.sourceQuote && d.enhancedEvidence?.targetQuote);
    assert.ok(d.pointsDelta > 0);
    assert.match(d.scoringEffect, /contributed to pass@79 flip \(92 -> 78\)/);
  }

  // 4B. Pass/fail-changing drift (100 -> 76 across 8 scored instances, delta -24)
  const passFlip10076 = byId.get('pass-flip-100-76:bsit-keyword-only');
  assert.equal(passFlip10076.comparison.drift.category, 'PASS_FAIL_CHANGING_DRIFT');
  assert.equal(passFlip10076.comparison.scores.legacyScore, 100);
  assert.equal(passFlip10076.comparison.scores.enhancedScore, 76);
  assert.equal(passFlip10076.comparison.scores.scoreDelta, -24);
  assert.equal(passFlip10076.comparison.passFailAt79.passChanged, true);
  assert.equal(passFlip10076.comparison.scoredJudgments.differentCount, 8);

  // 5. Submission-gate differences (100 -> null, ready: true -> false, gate AI-REQUIRED)
  const gateDiff = byId.get('gate-diff:bsit-unverified-scored-pair');
  assert.equal(gateDiff.comparison.drift.category, 'SUBMISSION_GATE_DIFFERENCES');
  assert.equal(gateDiff.comparison.submissionReadiness.legacyReady, true);
  assert.equal(gateDiff.comparison.submissionReadiness.enhancedReady, false);
  assert.equal(gateDiff.comparison.submissionReadiness.readyChanged, true);
  assert.equal(gateDiff.comparison.submissionGates.gatesChanged, true);
  assert.ok(gateDiff.comparison.submissionGates.enhancedGates.includes('AI-REQUIRED'));
});

test('A9.4 offline CLI scripts execute without network/DB and refuse --live or --confirm-paid with exit code 2', () => {
  const repoRoot = path.join(__dirname, '..', '..', '..');
  const exportScript = path.join(repoRoot, 'scripts', 'export-phase3-faculty-review.cjs');
  const driftScript = path.join(repoRoot, 'scripts', 'report-phase3-scoring-drift.cjs');

  // Both scripts refuse --live and --confirm-paid with exit code 2
  for (const script of [exportScript, driftScript]) {
    for (const flag of ['--live', '--confirm-paid']) {
      let exitCode = 0;
      let stderr = '';
      try {
        execFileSync(process.execPath, [script, flag], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (err) {
        exitCode = err.status;
        stderr = String(err.stderr || '');
      }
      assert.equal(exitCode, 2, `${path.basename(script)} must refuse ${flag} with exit code 2`);
      assert.match(stderr, /REFUSED:.*strictly OFFLINE/);
    }
  }

  // Drift CLI runs in JSON mode offline and reports policyConsistent=true
  const stdout = execFileSync(
    process.execPath,
    [driftScript, '--scenario', 'pass-flip-92-78', '--format', 'json'],
    { encoding: 'utf8' }
  );
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.offline, true);
  assert.equal(parsed.ledgerTouched, false);
  assert.equal(parsed.policyReconciliation.policyConsistent, true);
  assert.equal(parsed.scenarios.length, 1);
  assert.equal(parsed.scenarios[0].comparison.scores.legacyScore, 92);
  assert.equal(parsed.scenarios[0].comparison.scores.enhancedScore, 78);
});
