'use strict';
// Stage E.9 Phase 3, Layer A: evaluation scorer and paired official scoring comparison.
// Computes automated criteria E1-E5 and R1-R8 (docs/stage-e9-phase3-evaluation-plan.md section 8) and compares
// Legacy (Path A, all advisory stages off) vs Enhanced (Path B, advisory stages on) official and advisory outputs.
// Every agreement figure is explicitly labelled as measured against developer-written DRAFT expectations, not faculty-verified.
const crypto = require('node:crypto');
const fs = require('node:fs');
const { contradictionsOf } = require('../contradictions');
const { isAdvisory, REF_PAIR, MAX_ATTEMPTS } = require('../../gemini');
const { POLICY } = require('../../policy');
const { FIXTURES, MANIFEST_FILE, loadManifest, variant } = require('./fixtures');
const { DEFAULT_ENV, LEGACY_ENV, runWithOracle } = require('./oracle');

const AGREEMENT_LABEL = 'against developer-written expectations, not faculty-verified';

const SCORED_TYPES = new Set([
  'CLO-PO',
  'CLO-EGA',
  'ILO-CLO',
  'ILO-activity',
  'ILO-assessment',
  'Module-value',
]);

const LEGACY_ADVISORY_TYPES = [
  'ILO-content',
  'Description-plan',
  'CLO-anyPO',
  'CLO-anyEGA',
  REF_PAIR,
];

const STAGED_ADVISORY_TYPES = [
  'Course-CLO',
  'CLO-set',
  'Content-course',
  'Plan-sequence',
  'Content-ILO',
  'ILO-anyCLO',
  'CLO-coverage',
  'Activity-fit',
  'Assessment-fit',
  'Value-use',
  'Value-map',
  'Ref-relevance',
];

const DRIFT_CATEGORIES = Object.freeze({
  NO_SCORING_DRIFT: 'No scoring drift',
  ADVISORY_ONLY_CHANGES: 'Advisory-only changes',
  SCORE_ONLY_DRIFT: 'Score-only drift',
  PASS_FAIL_CHANGING_DRIFT: 'Pass/fail-changing drift',
  SUBMISSION_GATE_DIFFERENCES: 'Submission-gate differences',
});

function reconcileScoredRelationshipPolicy() {
  const scoredTypes = [...SCORED_TYPES];
  const policyAdvisoryTypes = [...POLICY.advisoryTypes];
  const allAdvisoryTypes = [...new Set([...policyAdvisoryTypes, REF_PAIR])];
  const verifiedScored = scoredTypes.filter(t => !isAdvisory(t));
  const verifiedAdvisory = allAdvisoryTypes.filter(t => isAdvisory(t));

  return {
    policyVersion: POLICY.version,
    passMark: 79,
    penalties: {
      NOT_ALIGNED: POLICY.alignment,
      PARTIALLY_ALIGNED: POLICY.partialAlignment,
      ALIGNED: 0,
      SEM_TAG_RETAG_ADVICE: 0,
    },
    scoredRelationshipTypesCount: scoredTypes.length,
    scoredRelationshipTypes: scoredTypes,
    legacyPlannedNonWholeListTypesCount: 8,
    legacyPlannedNonWholeListTypes: [
      ...scoredTypes,
      'ILO-content',
      'Description-plan',
    ],
    legacyAdvisoryRelationshipTypes: LEGACY_ADVISORY_TYPES,
    stagedAdvisoryRelationshipTypes: STAGED_ADVISORY_TYPES,
    allAdvisoryRelationshipTypesCount: allAdvisoryTypes.length,
    allAdvisoryRelationshipTypes: allAdvisoryTypes,
    policyConsistent:
      verifiedScored.length === 6 &&
      verifiedAdvisory.length === allAdvisoryTypes.length &&
      !scoredTypes.some(t => isAdvisory(t)),
    reconciliationNote:
      'Exactly 6 relationship types deduct official points (!isAdvisory(type) in gemini.js and policy.js): CLO-PO, CLO-EGA, ILO-CLO, ILO-activity, ILO-assessment, and Module-value. References to "8" in legacy comparisons arise from two distinct contexts: (1) Legacy mode (alignment-10) plans 8 core course/weekly relationship types before whole-list helpers (the 6 scored types + 2 always-planned legacy advisory types ILO-content and Description-plan, plus CLO-anyPO, CLO-anyEGA, and REF-plan when reference links are fetched), where ILO-content, Description-plan, and REF-plan are in POLICY.advisoryTypes / REF_PAIR and deduct 0 points; and (2) Controlled drift test A4.2 mutates 8 scored relationship instances (2 CLO-PO + 2 CLO-EGA + 4 ILO-CLO = -24 pts, 100 -> 76) whereas the 6-instance weekly/outcome drift scenario mutates 6 scored relationship instances (-14 pts, 92 -> 78).',
  };
}

function manifestHash(file = MANIFEST_FILE) {
  const raw = fs.readFileSync(file, 'utf8');
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function pointsOfScoredJudgement(j, tagAdviceSet) {
  if (!j || isAdvisory(j.type) || j.label === 'ALIGNED') return 0;
  if (tagAdviceSet && tagAdviceSet.has(`TAG:${j.id}`)) return 0;
  if (j.label === 'PARTIALLY_ALIGNED') return 1;
  if (j.label === 'NOT_ALIGNED') return 3;
  return 0;
}

function comparePairedOfficial(legacyResult, enhancedResult) {
  const legJudgements = legacyResult.hybrid?.alignment?.judgements || [];
  const enhJudgements = enhancedResult.hybrid?.alignment?.judgements || [];
  const legTagAdvice = new Set((legacyResult.findings || []).filter(f => f.ruleId === 'SEM-TAG').map(f => f.id));
  const enhTagAdvice = new Set((enhancedResult.findings || []).filter(f => f.ruleId === 'SEM-TAG').map(f => f.id));

  const legScored = new Map(legJudgements.filter(j => SCORED_TYPES.has(j.type)).map(j => [j.id, j]));
  const enhScored = new Map(enhJudgements.filter(j => SCORED_TYPES.has(j.type)).map(j => [j.id, j]));
  const allScoredIds = [...new Set([...legScored.keys(), ...enhScored.keys()])];

  const scoredDiffs = [];
  const scoredQuoteDiffs = [];
  let identicalCount = 0;

  for (const id of allScoredIds) {
    const a = legScored.get(id) || null;
    const b = enhScored.get(id) || null;
    const aPoints = pointsOfScoredJudgement(a, legTagAdvice);
    const bPoints = pointsOfScoredJudgement(b, enhTagAdvice);
    const sameLabel = !!a && !!b && a.label === b.label && Boolean(a.unverified) === Boolean(b.unverified) && aPoints === bPoints;
    if (sameLabel) {
      identicalCount += 1;
    } else {
      scoredDiffs.push({
        id,
        type: (b || a)?.type || null,
        path: (b || a)?.path || null,
        targetPath: (b || a)?.targetPath || (b || a)?.path || null,
        legacyLabel: a ? a.label : null,
        enhancedLabel: b ? b.label : null,
        legacyUnverified: Boolean(a?.unverified),
        enhancedUnverified: Boolean(b?.unverified),
        legacyPoints: aPoints,
        enhancedPoints: bPoints,
        pointsDelta: bPoints - aPoints,
        legacyTagAdvice: legTagAdvice.has(`TAG:${id}`),
        enhancedTagAdvice: enhTagAdvice.has(`TAG:${id}`),
        legacyEvidence: a
          ? {
              sourceQuote: a.sourceQuote || '',
              targetQuote: a.targetQuote || '',
              evidenceMatching: a.evidenceMatching || null,
              explanation: a.explanation || '',
            }
          : null,
        enhancedEvidence: b
          ? {
              sourceQuote: b.sourceQuote || '',
              targetQuote: b.targetQuote || '',
              evidenceMatching: b.evidenceMatching || null,
              explanation: b.explanation || '',
            }
          : null,
      });
    }
    if (a && b && (a.sourceQuote !== b.sourceQuote || a.targetQuote !== b.targetQuote)) {
      scoredQuoteDiffs.push({
        id,
        legacyQuotes: { sourceQuote: a.sourceQuote, targetQuote: a.targetQuote },
        enhancedQuotes: { sourceQuote: b.sourceQuote, targetQuote: b.targetQuote },
      });
    }
  }

  const legacyDeductions = legacyResult.hybrid?.deductions || [];
  const enhancedDeductions = enhancedResult.hybrid?.deductions || [];
  const legDedById = new Map(legacyDeductions.map(d => [d.id, d]));
  const enhDedById = new Map(enhancedDeductions.map(d => [d.id, d]));
  const allDedIds = [...new Set([...legDedById.keys(), ...enhDedById.keys()])];
  const deductionDiffs = [];
  for (const id of allDedIds) {
    const da = legDedById.get(id);
    const db = enhDedById.get(id);
    const pa = da ? da.points : 0;
    const pb = db ? db.points : 0;
    if (pa !== pb || da?.reason !== db?.reason) {
      deductionDiffs.push({
        id,
        kind: (db || da)?.kind || null,
        path: (db || da)?.path || null,
        legacyPoints: pa,
        enhancedPoints: pb,
        delta: pb - pa,
        legacyReason: da?.reason || null,
        enhancedReason: db?.reason || null,
      });
    }
  }

  const legacyTotalDeductions = legacyDeductions.reduce((s, d) => s + (d.points || 0), 0);
  const enhancedTotalDeductions = enhancedDeductions.reduce((s, d) => s + (d.points || 0), 0);
  const legacyScore = legacyResult.score;
  const enhancedScore = enhancedResult.score;
  const scoreDelta = (enhancedScore ?? 0) - (legacyScore ?? 0);
  const passChanged = legacyResult.passed !== enhancedResult.passed;
  const readyChanged = legacyResult.hybrid?.ready !== enhancedResult.hybrid?.ready;

  const legacyGates = [
    ...new Set([
      ...(legacyResult.conformance?.failed || []).map(c => c.id),
      ...(legacyResult.findings || [])
        .filter(f => f.severity === 'blocking' || f.ruleId === 'AI-REQUIRED')
        .map(f => f.ruleId),
    ]),
  ];
  const enhancedGates = [
    ...new Set([
      ...(enhancedResult.conformance?.failed || []).map(c => c.id),
      ...(enhancedResult.findings || [])
        .filter(f => f.severity === 'blocking' || f.ruleId === 'AI-REQUIRED')
        .map(f => f.ruleId),
    ]),
  ];
  const gatesChanged = JSON.stringify(legacyGates) !== JSON.stringify(enhancedGates);

  const legVerdictFindings = legacyResult.hybrid?.verdict?.findings || [];
  const enhVerdictFindings = enhancedResult.hybrid?.verdict?.findings || [];
  const legActionableFindings = legVerdictFindings.filter(f => f.status !== 'NOT_CHECKED');
  const enhActionableFindings = enhVerdictFindings.filter(f => f.status !== 'NOT_CHECKED');
  const stageRuleIds = new Set(['CLO-03', 'CLO-09', 'PLAN-03', 'PLAN-04', 'PLAN-10', 'ALN-06', 'ALN-08', 'ALN-09', 'VAL-03', 'VAL-04', 'VAL-05', 'REF-02', 'REF-03', 'REF-05']);
  const advisoryAddedByStages = enhActionableFindings.filter(f => stageRuleIds.has(f.ruleId));
  const advisoryFindingCountDiff = enhActionableFindings.length - legActionableFindings.length;

  const verifiedQuotesCount = list =>
    list.filter(j => j.evidenceMatching?.source && j.evidenceMatching.source !== 'not_evaluated' && j.evidenceMatching?.target && j.evidenceMatching.target !== 'not_evaluated').length;

  const legacySuggestions = (legacyResult.hybrid?.suggestions || []).map(s => ({ id: s.id, path: s.path, text: s.text }));
  const enhancedSuggestions = (enhancedResult.hybrid?.suggestions || []).map(s => ({ id: s.id, path: s.path, text: s.text }));
  const withheldInEnhanced = enhVerdictFindings.filter(f => f.withheld).map(f => ({
    relationshipId: f.relationshipId,
    ruleId: f.ruleId,
    path: f.path,
    withheld: f.withheld,
  }));

  const advisoryChanged =
    advisoryAddedByStages.length > 0 ||
    advisoryFindingCountDiff !== 0 ||
    enhancedSuggestions.length !== legacySuggestions.length ||
    withheldInEnhanced.length > 0;

  const allScoredIdentical = scoredDiffs.length === 0 && legScored.size === enhScored.size;
  const scoreDrift = legacyScore !== enhancedScore;
  const officialDrift = scoreDrift || passChanged || readyChanged || gatesChanged || deductionDiffs.length > 0;
  const driftDetected = officialDrift || scoredDiffs.length > 0;
  const formulaInvariantWhenScoredEqual = !allScoredIdentical || !officialDrift;

  for (const d of scoredDiffs) {
    const parts = [];
    if (d.legacyUnverified !== d.enhancedUnverified || d.legacyLabel === 'INSUFFICIENT_EVIDENCE' || d.enhancedLabel === 'INSUFFICIENT_EVIDENCE') {
      parts.push(`verification changed (${d.legacyLabel} -> ${d.enhancedLabel}), withholding official score/readiness`);
    } else if (d.pointsDelta !== 0) {
      const sign = d.pointsDelta > 0 ? `+${d.pointsDelta}` : `${d.pointsDelta}`;
      const scoreEffect = -d.pointsDelta > 0 ? `+${-d.pointsDelta}` : `${-d.pointsDelta}`;
      parts.push(`${sign} deduction pt(s) (${scoreEffect} official score impact)`);
    } else if (d.legacyTagAdvice !== d.enhancedTagAdvice) {
      parts.push(`re-tag advice (SEM-TAG) changed without altering points`);
    } else {
      parts.push(`label changed (${d.legacyLabel} -> ${d.enhancedLabel}) with 0 net point change`);
    }
    if (passChanged && d.pointsDelta !== 0) {
      parts.push(`contributed to pass@79 flip (${legacyScore} -> ${enhancedScore})`);
    } else if (scoreDrift && d.pointsDelta !== 0) {
      parts.push(`contributed to score change (${legacyScore} -> ${enhancedScore})`);
    }
    if (readyChanged || gatesChanged) {
      parts.push(`affected submission readiness/gates`);
    }
    d.scoringEffect = parts.join('; ');
  }

  // Classify into the 5 explicit drift categories (Section 3):
  // - NO_SCORING_DRIFT: no official drift and no advisory finding changes
  // - ADVISORY_ONLY_CHANGES: no official/scored drift, but advisory stages added/changed advisory findings
  // - SCORE_ONLY_DRIFT: official score or deductions changed, without changing pass@79, readiness, or submission gates
  // - PASS_FAIL_CHANGING_DRIFT: pass/fail status at 79 flipped between Legacy and Enhanced
  // - SUBMISSION_GATE_DIFFERENCES: submission readiness or failed submission gates changed
  const categories = [];
  if (readyChanged || gatesChanged) {
    categories.push('SUBMISSION_GATE_DIFFERENCES');
  }
  if (passChanged) {
    categories.push('PASS_FAIL_CHANGING_DRIFT');
  }
  if ((scoreDrift || deductionDiffs.length > 0 || scoredDiffs.length > 0) && !passChanged && !readyChanged && !gatesChanged) {
    categories.push('SCORE_ONLY_DRIFT');
  }
  if (advisoryChanged) {
    categories.push('ADVISORY_ONLY_CHANGES');
  }
  if (!driftDetected && !advisoryChanged) {
    categories.push('NO_SCORING_DRIFT');
  }
  const primaryCategory = !driftDetected
    ? advisoryChanged
      ? 'ADVISORY_ONLY_CHANGES'
      : 'NO_SCORING_DRIFT'
    : readyChanged || gatesChanged
      ? 'SUBMISSION_GATE_DIFFERENCES'
      : passChanged
        ? 'PASS_FAIL_CHANGING_DRIFT'
        : 'SCORE_ONLY_DRIFT';

  return {
    prompts: {
      legacy: legacyResult.hybrid?.alignment?.promptVersion || 'alignment-10',
      enhanced: enhancedResult.hybrid?.alignment?.promptVersion || null,
    },
    scoredJudgments: {
      totalLegacy: legScored.size,
      totalEnhanced: enhScored.size,
      identicalCount,
      differentCount: scoredDiffs.length,
      allIdentical: allScoredIdentical,
      diffs: scoredDiffs,
    },
    scores: {
      legacyScore,
      enhancedScore,
      scoreDelta,
      legacyBaseScore: legacyResult.baseScore,
      enhancedBaseScore: enhancedResult.baseScore,
      legacyProvisionalScore: legacyResult.hybrid?.provisionalScore ?? null,
      enhancedProvisionalScore: enhancedResult.hybrid?.provisionalScore ?? null,
    },
    deductions: {
      legacyTotal: legacyTotalDeductions,
      enhancedTotal: enhancedTotalDeductions,
      totalDelta: enhancedTotalDeductions - legacyTotalDeductions,
      legacyCount: legacyDeductions.length,
      enhancedCount: enhancedDeductions.length,
      diffs: deductionDiffs,
    },
    passFailAt79: {
      passMark: 79,
      legacyPassed: legacyResult.passed,
      enhancedPassed: enhancedResult.passed,
      passChanged,
    },
    submissionReadiness: {
      legacyReady: legacyResult.hybrid?.ready ?? false,
      enhancedReady: enhancedResult.hybrid?.ready ?? false,
      readyChanged,
    },
    submissionGates: {
      legacyGates,
      enhancedGates,
      gatesChanged,
    },
    advisoryFindings: {
      legacyAdvisoryRelationships: legJudgements.filter(j => isAdvisory(j.type)).length,
      enhancedAdvisoryRelationships: enhJudgements.filter(j => isAdvisory(j.type)).length,
      legacyVerdictCounts: legacyResult.hybrid?.verdict?.counts || null,
      enhancedVerdictCounts: enhancedResult.hybrid?.verdict?.counts || null,
      legacyOverall: legacyResult.hybrid?.verdict?.overall || null,
      enhancedOverall: enhancedResult.hybrid?.verdict?.overall || null,
      advisoryAddedByStagesCount: advisoryAddedByStages.length,
    },
    evidenceQuotations: {
      legacyVerifiedCount: verifiedQuotesCount(legJudgements),
      enhancedVerifiedCount: verifiedQuotesCount(enhJudgements),
      scoredQuoteDiffs,
    },
    recommendations: {
      legacySuggestions,
      enhancedSuggestions,
      legacyMappingAdvice: legacyResult.hybrid?.mappingAdvice || [],
      enhancedMappingAdvice: enhancedResult.hybrid?.mappingAdvice || [],
      withheldInEnhanced,
    },
    drift: {
      detected: driftDetected,
      officialDrift,
      scoreDrift,
      passFlipAt79: passChanged,
      readinessDrift: readyChanged,
      gateDrift: gatesChanged,
      scoredJudgmentDrift: scoredDiffs.length > 0,
      advisoryChanged,
      formulaInvariantWhenScoredEqual,
      category: primaryCategory,
      categoryLabel: DRIFT_CATEGORIES[primaryCategory],
      categories,
      categoryLabels: categories.map(c => DRIFT_CATEGORIES[c]),
      summary: !driftDetected
        ? 'No scored judgment or official score drift between legacy (all stages off) and enhanced (all stages on).'
        : `Drift detected: ${scoredDiffs.length} scored judgment(s) differed, score changed from ${legacyScore} to ${enhancedScore} (delta ${scoreDelta >= 0 ? '+' : ''}${scoreDelta}), pass@79 ${passChanged ? 'FLIPPED' : 'unchanged'}, readiness ${readyChanged ? 'CHANGED' : 'unchanged'}.`,
    },
  };
}

async function runPairedOfficialComparison(syllabus, options = {}) {
  const legacyOracleOpts = options.legacyOracleOptions || {
    variantSpec: options.variantSpec,
    expectations: options.legacyExpectations || options.expectations,
    overrides: options.legacyOverrides || options.overrides,
    faults: options.legacyFaults || [],
  };
  const enhancedOracleOpts = options.enhancedOracleOptions || {
    variantSpec: options.variantSpec,
    expectations: options.enhancedExpectations || options.expectations,
    overrides: options.enhancedOverrides || options.overrides,
    faults: options.enhancedFaults || [],
  };

  const legacyRun = await runWithOracle(syllabus, legacyOracleOpts, {
    ...(options.engineOptions || {}),
    env: { ...LEGACY_ENV, ...(options.legacyEnv || {}) },
  });
  const enhancedRun = await runWithOracle(syllabus, enhancedOracleOpts, {
    ...(options.engineOptions || {}),
    env: { ...DEFAULT_ENV, ...(options.enhancedEnv || {}) },
  });

  const comparison = comparePairedOfficial(legacyRun.result, enhancedRun.result);
  return {
    legacyResult: legacyRun.result,
    enhancedResult: enhancedRun.result,
    legacyOracle: legacyRun.oracle,
    enhancedOracle: enhancedRun.oracle,
    comparison,
  };
}

function scoreRun(result, syllabus, variantSpec, options = {}) {
  const manifest = options.manifest || loadManifest();
  const judgements = result.hybrid?.alignment?.judgements || [];
  const findings = result.hybrid?.verdict?.findings || [];
  const byId = new Map(judgements.map(j => [j.id, j]));
  const findingByRel = new Map();
  for (const f of findings) {
    if (f.relationshipId && !findingByRel.has(f.relationshipId)) {
      findingByRel.set(f.relationshipId, f);
    }
  }

  const expectations = variantSpec?.expectations || [];
  const expectedIds = new Set(expectations.map(e => e.id || e.relationship));
  const primaryExps = expectations.filter(e => e.role === 'primary' && e.kind !== 'open');
  const openExps = expectations.filter(e => e.kind === 'open');
  const cascadeExps = expectations.filter(e => e.role === 'cascade');

  let primaryDetected = 0;
  let obviousDetected = 0, obviousTotal = 0;
  let subtleDetected = 0, subtleTotal = 0;
  let cascadeMatched = 0;
  let labelMatched = 0, labelTotal = 0;
  let fieldMatched = 0, fieldTotal = 0;
  let responsibleMatched = 0, responsibleTotal = 0;
  let recommendationMatched = 0, recommendationTotal = 0;
  const expDetails = [];
  const openItems = [];

  for (const exp of expectations) {
    const id = exp.id || exp.relationship;
    const j = byId.get(id);
    const f = findingByRel.get(id);
    const actualLabel = j ? j.label : null;
    const labelOk = !!actualLabel && (exp.accept || []).includes(actualLabel);

    if (exp.kind === 'open') {
      openItems.push({
        id,
        catalogueId: exp.catalogueId,
        mutation: exp.mutation,
        actualLabel,
        verdictStatus: f?.status || null,
        reviewStatus: 'open',
      });
      continue;
    }

    labelTotal += 1;
    if (labelOk) labelMatched += 1;

    if (exp.role === 'primary') {
      if (labelOk) primaryDetected += 1;
      if (exp.kind === 'obvious') {
        obviousTotal += 1;
        if (labelOk) obviousDetected += 1;
      } else if (exp.kind === 'subtle') {
        subtleTotal += 1;
        if (labelOk) subtleDetected += 1;
      }
    } else if (exp.role === 'cascade') {
      if (labelOk && (!exp.withheld || f?.withheld === exp.withheld)) cascadeMatched += 1;
    }

    let fieldsOk = true;
    if (exp.fields && j?.aspects?.values) {
      for (const [k, expectedVal] of Object.entries(exp.fields)) {
        fieldTotal += 1;
        if (j.aspects.values[k] === expectedVal) fieldMatched += 1;
        else fieldsOk = false;
      }
    }

    let respOk = true;
    if (exp.responsible !== null && exp.responsible !== undefined) {
      responsibleTotal += 1;
      if (f?.responsible === exp.responsible) responsibleMatched += 1;
      else respOk = false;
    }

    let recOk = true;
    if (exp.recommendation) {
      recommendationTotal += 1;
      if (f?.recommendationType === exp.recommendation) recommendationMatched += 1;
      else recOk = false;
    }

    let withheldOk = true;
    if (exp.withheld !== null && exp.withheld !== undefined) {
      withheldOk = f?.withheld === exp.withheld;
    }

    expDetails.push({
      id,
      role: exp.role,
      kind: exp.kind,
      mutation: exp.mutation,
      expectedAccept: exp.accept,
      actualLabel,
      labelOk,
      fieldsOk,
      respOk,
      recOk,
      withheldOk,
      actualResponsible: f?.responsible ?? null,
      actualRecommendationType: f?.recommendationType ?? null,
      actualWithheld: f?.withheld ?? null,
      actualVerdictStatus: f?.status ?? null,
    });
  }

  // Control rows false-flag check
  const controls = new Set(variantSpec?.controls || []);
  const falseFlags = [];
  for (const j of judgements) {
    const m = /^row(\d+)-/.exec(j.id);
    if (m && controls.has(Number(m[1])) && !expectedIds.has(j.id)) {
      if (j.label !== 'ALIGNED') {
        falseFlags.push({ id: j.id, row: Number(m[1]), label: j.label });
      }
    }
  }

  // Contradictions
  const contradictions = contradictionsOf(result, syllabus.content);

  // Unverified answers accepted as PASS
  const unverifiedAcceptedAsPass = findings.filter(
    f => f.method === 'ai_semantic' && f.status === 'PASS' && (f.verification === 'unverified' || f.verification === 'not_checked')
  );

  // Released unsupported drafts
  const heldIds = new Set(judgements.filter(j => j.draftReview?.length > 0).map(j => `SEM:${j.id}`));
  const releasedSuggestions = (result.hybrid?.suggestions || []).filter(s => (s.basedOn || []).some(b => heldIds.has(b)));
  const releasedFindings = findings.filter(f => f.draftReview?.length > 0 && f.recommendation !== null);

  // Quotes verification
  const checkedJudgements = judgements.filter(j => !j.unverified && j.label !== 'INSUFFICIENT_EVIDENCE');
  const quotesVerified = checkedJudgements.filter(
    j => j.evidenceMatching?.source && j.evidenceMatching.source !== 'not_evaluated' && j.evidenceMatching?.target && j.evidenceMatching.target !== 'not_evaluated'
  ).length;

  const explanationFlagged = judgements.filter(j => j.explanationReview?.length > 0);
  const withheldByDraftReview = [...new Set(findings.filter(f => f.withheld === 'draft_review').map(f => f.relationshipId || f.ruleId))];
  const unresolvedRelationships = judgements.filter(j => j.unverified || j.label === 'INSUFFICIENT_EVIDENCE');

  const requests = options.requests ?? result.hybrid?.alignment?.reuse?.requests ?? 0;
  const questions = judgements.length;
  const cleanRequests = Math.ceil(questions / 4);
  const retryCeiling = cleanRequests + 2 * questions;

  const pairedComparison = options.pairedOffResult
    ? comparePairedOfficial(options.pairedOffResult, result)
    : null;

  return {
    manifestVersion: manifest.version || 'phase3-1',
    manifestStatus: manifest.status,
    manifestSha256: manifestHash(),
    agreementLabel: AGREEMENT_LABEL,
    criteria: {
      E1_completed: result.hybrid?.alignment?.status === 'completed' && result.score !== null && typeof result.hybrid?.ready === 'boolean',
      E2_officialScoreInvariance: pairedComparison ? pairedComparison.drift.formulaInvariantWhenScoredEqual : null,
      E3_zeroContradictions: contradictions.length === 0,
      E4_zeroUnverifiedPass: unverifiedAcceptedAsPass.length === 0,
      E5_zeroReleasedUnsupportedDrafts: releasedSuggestions.length === 0 && releasedFindings.length === 0,
      R1_primaryDetectionRate: primaryExps.length ? primaryDetected / primaryExps.length : 1,
      R2_zeroControlRowFalseFlags: falseFlags.length === 0,
      R3_responsibleAgreement: responsibleTotal ? responsibleMatched / responsibleTotal : 1,
      R4_recommendationAgreement: recommendationTotal ? recommendationMatched / recommendationTotal : 1,
      R5_exactQuotationsRate: checkedJudgements.length ? quotesVerified / checkedJudgements.length : 1,
      R6_explanationReviewFlags: explanationFlagged.length,
      R7_withheldUnsupportedDrafts: withheldByDraftReview.length,
      R8_withinRequestCeiling: requests <= retryCeiling,
    },
    counts: {
      questions,
      requests,
      cleanRequests,
      retryCeiling,
      primaryDetected,
      primaryTotal: primaryExps.length,
      obviousDetected,
      obviousTotal,
      subtleDetected,
      subtleTotal,
      cascadeMatched,
      cascadeTotal: cascadeExps.length,
      openItemsCount: openItems.length,
      falseFlagsCount: falseFlags.length,
      contradictionsCount: contradictions.length,
      labelMatched,
      labelTotal,
      fieldMatched,
      fieldTotal,
      responsibleMatched,
      responsibleTotal,
      recommendationMatched,
      recommendationTotal,
      quotesVerified,
      quotesTotal: checkedJudgements.length,
      unresolvedCount: unresolvedRelationships.length,
    },
    falseFlags,
    contradictions,
    openItems,
    expDetails,
    pairedComparison,
  };
}

// Section 7: Offline request-volume measurement reusing the formulas from scripts/measure-request-volume.cjs and scripts/live-pipeline-eval.cjs.
// Never sends a network request and never reads or writes any live evaluation ledger.
const BYTES_PER_TOKEN = 4.85;
const OUTPUT_PER_ANSWER = 218;
const VOLUME_PRICES = Object.freeze({
  typical: { in: 1.5e-7, out: 6e-7 },
  worst: { in: 3e-7, out: 1.2e-6 },
});

function summarizeUsage({ requests, requestBytes, answered }) {
  const inputTokens = Math.round(requestBytes / BYTES_PER_TOKEN);
  const outputTokens = answered * OUTPUT_PER_ANSWER;
  const retryCeiling = requests + (MAX_ATTEMPTS - 1) * answered;
  const costTypical = +(inputTokens * VOLUME_PRICES.typical.in + outputTokens * VOLUME_PRICES.typical.out).toFixed(4);
  const costWorst = +(inputTokens * VOLUME_PRICES.worst.in + outputTokens * VOLUME_PRICES.worst.out).toFixed(4);
  return {
    requests,
    questions: answered,
    retryCeiling,
    requestBytes,
    inputTokens,
    outputTokens,
    costTypical,
    costWorst,
  };
}

async function estimatePhase3RequestVolume(options = {}) {
  const manifest = options.manifest || loadManifest();
  const rows = [];
  const totals = {
    enhancedRequests: 0,
    enhancedQuestions: 0,
    enhancedCeiling: 0,
    legacyRequests: 0,
    legacyQuestions: 0,
    pairedCleanRequests: 0,
  };

  for (const key of FIXTURES) {
    for (const mode of ['aligned', 'misaligned']) {
      const id = `${key}-${mode}`;
      const syl = variant(key, mode, manifest);
      const spec = manifest.variants[id];
      const paired = await runPairedOfficialComparison(syl, { variantSpec: spec });
      const enhanced = summarizeUsage(paired.enhancedOracle.stats);
      const legacy = summarizeUsage(paired.legacyOracle.stats);
      const pairedCleanRequests = enhanced.requests + legacy.requests;

      totals.enhancedRequests += enhanced.requests;
      totals.enhancedQuestions += enhanced.questions;
      totals.enhancedCeiling += enhanced.retryCeiling;
      totals.legacyRequests += legacy.requests;
      totals.legacyQuestions += legacy.questions;
      totals.pairedCleanRequests += pairedCleanRequests;

      rows.push({
        id,
        fixture: key,
        variant: mode,
        enhanced,
        legacy,
        pairedCleanRequests,
      });
    }
  }

  return {
    offline: true,
    ledgerTouched: false,
    assumptions: {
      bytesPerToken: BYTES_PER_TOKEN,
      outputTokensPerAnswer: OUTPUT_PER_ANSWER,
      stagedBatchSize: 4,
      legacyBatchSize: 12,
      maxAttemptsPerRelationship: MAX_ATTEMPTS,
      prices: VOLUME_PRICES,
    },
    rows,
    totals,
  };
}

async function runPairedDriftScenarios(options = {}) {
  const manifest = options.manifest || loadManifest();
  const filterScenario = options.scenario || 'all';
  const filterVariant = options.variant || null;
  const scenarios = [];

  const shouldRun = id => filterScenario === 'all' || filterScenario === id;

  // Scenario 1: Identical scored judgments across all 8 Phase 3 variants (aligned = NO_SCORING_DRIFT, misaligned = ADVISORY_ONLY_CHANGES)
  if (shouldRun('identical') || shouldRun('identical-aligned') || shouldRun('identical-misaligned')) {
    for (const key of FIXTURES) {
      for (const mode of ['aligned', 'misaligned']) {
        const variantId = `${key}-${mode}`;
        if (filterVariant && filterVariant !== variantId && filterVariant !== key) continue;
        if (filterScenario === 'identical-aligned' && mode !== 'aligned') continue;
        if (filterScenario === 'identical-misaligned' && mode !== 'misaligned') continue;
        const syl = variant(key, mode, manifest);
        const spec = manifest.variants[variantId];
        // On aligned variants, force row1-ilo0-activity and row1-activityfit to match so aligned variants have 0 advisory differences,
        // while misaligned variants show advisory-only stage additions with identical scored judgments.
        const paired = await runPairedOfficialComparison(syl, { variantSpec: spec });
        scenarios.push({
          scenarioId: mode === 'aligned' ? `identical-aligned:${variantId}` : `identical-misaligned:${variantId}`,
          scenarioGroup: mode === 'aligned' ? 'identical-aligned' : 'identical-misaligned',
          title:
            mode === 'aligned'
              ? `Identical scored judgments (${variantId}) — no scoring drift`
              : `Identical scored judgments (${variantId}) — advisory-only changes, zero official score drift`,
          fixture: key,
          variant: variantId,
          program: syl.program,
          curriculumYear: syl.content.meta.curriculumYear,
          courseCode: syl.content.meta.code,
          courseTitle: syl.content.meta.title,
          comparison: paired.comparison,
        });
      }
    }
  }

  // Scenario 2: Score-only drift (score changes from 100 to 92, delta -8, both paths remain PASS >= 79 and ready=true)
  if (shouldRun('score-only') || shouldRun('score-only-drift')) {
    const syl = variant('bsit', 'aligned', manifest);
    const legacyOverrides = {};
    const enhancedOverrides = {
      'row1-ilo0-activity': {
        label: 'NOT_ALIGNED',
        modelRecommendation: 'REWRITE_TEXT',
        oracleDraft: '- Students write, compile and run a first Java program in the laboratory after the demonstration.',
      },
      'row4-ilo0-clo:c1': {
        label: 'NOT_ALIGNED',
        modelRecommendation: 'REWRITE_TEXT',
        oracleDraft: 'Write Java programs that read console input with Scanner and format output.',
      },
      'row7-ilo0-assessment': {
        label: 'PARTIALLY_ALIGNED',
        modelRecommendation: 'REWRITE_TEXT',
        oracleDraft: '- Laboratory exercise: write and test a menu-driven unit-conversion program using switch.',
      },
      'row9-value': {
        label: 'PARTIALLY_ALIGNED',
        modelRecommendation: 'REWRITE_TEXT',
        oracleDraft: 'Interiority: students keep a debugging journal of the loop errors they encountered and reflect on what they learned.',
      },
    };
    const paired = await runPairedOfficialComparison(syl, {
      variantSpec: manifest.variants['bsit-aligned'],
      legacyOverrides,
      enhancedOverrides,
    });
    scenarios.push({
      scenarioId: 'score-only-drift:bsit-100-to-92',
      scenarioGroup: 'score-only-drift',
      title: 'Score-only drift (BSIT IT 202: Legacy 100 PASS vs Enhanced 92 PASS, delta -8, pass@79 unchanged)',
      fixture: 'bsit',
      variant: 'bsit-aligned',
      program: syl.program,
      curriculumYear: syl.content.meta.curriculumYear,
      courseCode: syl.content.meta.code,
      courseTitle: syl.content.meta.title,
      comparison: paired.comparison,
    });
  }

  // Scenario 3A: Pass/fail-changing drift (92 vs 78 across 6 scored relationships spanning all 6 scored relationship types, delta -14)
  if (shouldRun('pass-flip') || shouldRun('pass-flip-92-78')) {
    const syl = variant('bsit', 'aligned', manifest);
    // Legacy deducts 8 pts (score 92, PASS >= 79):
    //   4 differing relationships PARTIALLY_ALIGNED (-1 pt each = -4) + 2 differing ALIGNED (0 pts)
    //   + 4 unchanged baseline PARTIALLY_ALIGNED (-1 pt each = -4) = 8 pts total.
    // Enhanced deducts 22 pts (score 78, FAIL < 79):
    //   All 6 differing relationships are NOT_ALIGNED (-3 pts each = -18, delta +14)
    //   + 4 unchanged baseline PARTIALLY_ALIGNED (-1 pt each = -4) = 22 pts total.
    //   Total delta = +14 deduction points (-14 score delta: 92 -> 78, flipping pass@79 from true to false).
    //   Covers all 6 officially scored relationship types: CLO-PO, CLO-EGA, ILO-CLO, ILO-activity, ILO-assessment, Module-value.
    const sharedBaselineOverrides = {
      'clo0-po9': { label: 'PARTIALLY_ALIGNED', modelRecommendation: 'REWRITE_TEXT', oracleDraft: 'Explain how a Java program is structured, compiled and executed using modern IDE tools.' },
      'clo0-ega2': { label: 'PARTIALLY_ALIGNED', modelRecommendation: 'REWRITE_TEXT', oracleDraft: 'Explain how a Java program is structured, compiled and executed with professional care.' },
      'clo0-anypo': { label: 'NOT_ALIGNED', modelRecommendation: 'REWRITE_TEXT', oracleDraft: 'Explain Java program structure, compilation and data representation for PO 7.' },
      'clo0-anyega': { label: 'NOT_ALIGNED', modelRecommendation: 'REWRITE_TEXT', oracleDraft: 'Explain Java compilation, execution and data representation for EGA 1.' },
      'row6-ilo0-activity': { label: 'PARTIALLY_ALIGNED', modelRecommendation: 'REWRITE_TEXT', oracleDraft: '- Guided flowcharting and pair programming of conditional statements in the laboratory.' },
      'row8-ilo0-assessment': { label: 'PARTIALLY_ALIGNED', modelRecommendation: 'REWRITE_TEXT', oracleDraft: '- Programming task: sentinel-controlled average calculator with test cases.' },
    };
    const legacyOverrides = {
      ...sharedBaselineOverrides,
      'clo0-po7': { label: 'PARTIALLY_ALIGNED', modelRecommendation: 'REWRITE_TEXT', oracleDraft: 'Explain Java program structure, compilation and data representation.' },
      'clo0-ega1': { label: 'PARTIALLY_ALIGNED', modelRecommendation: 'REWRITE_TEXT', oracleDraft: 'Explain Java compilation, execution and data representation clearly.' },
      'row1-ilo0-clo:c1': { label: 'PARTIALLY_ALIGNED', modelRecommendation: 'REWRITE_TEXT', oracleDraft: 'Explain how a Java source file is compiled and executed in the JVM.' },
      'row1-ilo0-activity': { label: 'PARTIALLY_ALIGNED', modelRecommendation: 'REWRITE_TEXT', oracleDraft: '- Lecture-demonstration and laboratory coding of a first Java program.' },
      'row2-ilo0-assessment': { label: 'ALIGNED', modelRecommendation: 'NO_CHANGE' },
      'row3-value': { label: 'ALIGNED', modelRecommendation: 'NO_CHANGE' },
    };
    const enhancedOverrides = {
      ...sharedBaselineOverrides,
      'clo0-po7': { label: 'NOT_ALIGNED', modelRecommendation: 'REWRITE_TEXT', oracleDraft: 'Explain Java program structure, compilation and data representation for PO 7.' },
      'clo0-ega1': { label: 'NOT_ALIGNED', modelRecommendation: 'REWRITE_TEXT', oracleDraft: 'Explain Java compilation, execution and data representation for EGA 1.' },
      'row1-ilo0-clo:c1': { label: 'NOT_ALIGNED', modelRecommendation: 'REWRITE_TEXT', oracleDraft: 'Explain how a Java source file is compiled and executed in the JVM.' },
      'row1-ilo0-activity': { label: 'NOT_ALIGNED', modelRecommendation: 'REWRITE_TEXT', oracleDraft: '- Lecture-demonstration and laboratory coding of a first Java program.' },
      'row2-ilo0-assessment': { label: 'NOT_ALIGNED', modelRecommendation: 'REWRITE_TEXT', oracleDraft: '- Laboratory exercise on declaring and printing variables and quiz on data types.' },
      'row3-value': { label: 'NOT_ALIGNED', modelRecommendation: 'REWRITE_TEXT', oracleDraft: 'Courage: students present their traced answers to the class, including errors, and explain the correction.' },
    };
    const paired = await runPairedOfficialComparison(syl, {
      variantSpec: manifest.variants['bsit-aligned'],
      legacyOverrides,
      enhancedOverrides,
    });
    scenarios.push({
      scenarioId: 'pass-flip-92-78:bsit-6-scored-types',
      scenarioGroup: 'pass-flip-changing-drift',
      title: 'Pass/fail-changing drift (BSIT IT 202: Legacy 92 PASS vs Enhanced 78 FAIL across all 6 scored types, delta -14)',
      fixture: 'bsit',
      variant: 'bsit-aligned',
      program: syl.program,
      curriculumYear: syl.content.meta.curriculumYear,
      courseCode: syl.content.meta.code,
      courseTitle: syl.content.meta.title,
      comparison: paired.comparison,
    });
  }

  // Scenario 3B: Pass/fail-changing drift (100 vs 76 across 8 scored relationship instances under Stage A cloPoTail + Stage B3 iloTail, delta -24)
  if (shouldRun('pass-flip') || shouldRun('pass-flip-100-76')) {
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
    enhancedOverrides['clo0-anypo'] = { label: 'NOT_ALIGNED', modelRecommendation: 'REWRITE_TEXT', oracleDraft: 'Revised CLO aligned with BSIT PO 7.' };
    enhancedOverrides['clo0-anyega'] = { label: 'NOT_ALIGNED', modelRecommendation: 'REWRITE_TEXT', oracleDraft: 'Revised CLO aligned with BSIT EGA 1.' };

    const paired = await runPairedOfficialComparison(syl, {
      variantSpec: manifest.variants['bsit-aligned'],
      legacyOverrides,
      enhancedOverrides,
    });
    scenarios.push({
      scenarioId: 'pass-flip-100-76:bsit-keyword-only',
      scenarioGroup: 'pass-flip-changing-drift',
      title: 'Pass/fail-changing drift (BSIT keyword-only trap: Legacy 100 PASS vs Enhanced 76 FAIL across 8 scored instances, delta -24)',
      fixture: 'bsit',
      variant: 'single:bsit-keyword-only',
      program: syl.program,
      curriculumYear: syl.content.meta.curriculumYear,
      courseCode: syl.content.meta.code,
      courseTitle: syl.content.meta.title,
      comparison: paired.comparison,
    });
  }

  // Scenario 4: Submission-gate / readiness difference (Enhanced unverified scored relationship blocks readiness and adds AI-REQUIRED gate)
  if (shouldRun('gate-diff') || shouldRun('submission-gate-differences')) {
    const syl = variant('bsit', 'aligned', manifest);
    const paired = await runPairedOfficialComparison(syl, {
      variantSpec: manifest.variants['bsit-aligned'],
      enhancedFaults: [{ type: 'always_empty_judgements', onPair: 'clo0-po7' }],
    });
    scenarios.push({
      scenarioId: 'gate-diff:bsit-unverified-scored-pair',
      scenarioGroup: 'submission-gate-differences',
      title: 'Submission-gate difference (BSIT IT 202: Enhanced unverified clo0-po7 withholds official score and blocks readiness via AI-REQUIRED)',
      fixture: 'bsit',
      variant: 'bsit-aligned',
      program: syl.program,
      curriculumYear: syl.content.meta.curriculumYear,
      courseCode: syl.content.meta.code,
      courseTitle: syl.content.meta.title,
      comparison: paired.comparison,
    });
  }

  return {
    offline: true,
    ledgerTouched: false,
    agreementNote: AGREEMENT_LABEL,
    policyReconciliation: reconcileScoredRelationshipPolicy(),
    scenarios,
  };
}

module.exports = {
  AGREEMENT_LABEL,
  SCORED_TYPES,
  LEGACY_ADVISORY_TYPES,
  STAGED_ADVISORY_TYPES,
  DRIFT_CATEGORIES,
  manifestHash,
  reconcileScoredRelationshipPolicy,
  comparePairedOfficial,
  runPairedOfficialComparison,
  runPairedDriftScenarios,
  scoreRun,
  estimatePhase3RequestVolume,
};
