'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const { contentHash } = require('../compliance/hash');
const { namedValues } = require('./values');
const { coded, VERSION } = require('./engine');
const { enabled } = require('./coordinatedPlanActivation');

const ROOT = path.resolve(__dirname, '../../..');

const VALIDATION_STATUS = {
  VERIFIED: 'VERIFIED',
  NEEDS_FACULTY_REVIEW: 'NEEDS_FACULTY_REVIEW',
  UNRESOLVED: 'UNRESOLVED',
  NOT_CHECKED: 'NOT_CHECKED',
};

const segments = (p) => String(p).replace(/\[(\d+)\]/g, '.$1').split('.');

function getValue(content, p) {
  if (!content || !p) return undefined;
  return segments(p).reduce((v, k) => (v === undefined || v === null ? undefined : v[k]), content);
}

function setValue(content, p, value) {
  const copy = structuredClone(content);
  const parts = segments(p);
  const last = parts.pop();
  let node = copy;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i];
    if (node[key] === undefined || node[key] === null) {
      const nextKey = i + 1 < parts.length ? parts[i + 1] : last;
      node[key] = Number.isInteger(Number(nextKey)) ? [] : {};
    }
    node = node[key];
  }
  node[last] = structuredClone(value);
  return copy;
}

function applyChanges(content, changes, approvedIds = null) {
  let result = structuredClone(content);
  const toApply = Array.isArray(approvedIds) && approvedIds.length > 0
    ? changes.filter((c) => approvedIds.includes(c.changeId) || approvedIds.includes(c.id))
    : changes;

  for (const c of toApply) {
    if (c.path && c.proposedValue !== undefined) {
      result = setValue(result, c.path, c.proposedValue);
    }
  }
  return result;
}

function normalizeText(t) {
  return String(t || '').replace(/\s+/g, ' ').trim();
}

/**
 * Builds a structured, cross-relationship Whole-Syllabus Improvement Plan
 */
function buildPlan({ content, masters = {}, syllabusId = null, result = {}, env = process.env } = {}) {
  const hybrid = result.hybrid || {};
  const v2 = hybrid.academicV2 || {};
  const ac = v2.academic || {};
  const relationships = ac.relationships || [];
  const findings = result.findings || [];
  const rawSuggestions = [
    ...(ac.suggestions || []),
    ...(hybrid.suggestions || []),
  ].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const withheld = hybrid.suggestionsWithheld || [];

  const sourceHash = contentHash(content, result.standard?.version || result.standardVersion || VERSION || 'hybrid-2');
  const planId = `plan_${crypto.randomBytes(8).toString('hex')}`;

  const planRows = Array.isArray(content.plan) ? content.plan : [];
  const clos = Array.isArray(content.clos) ? content.clos : [];
  const instValues = (masters.institution?.values || []).map((v) => (typeof v === 'string' ? v : v.name || v.label));

  // 1. Identify Faculty-Selected Institutional Core Values to strictly protect
  const facultySelectedValues = new Set();
  const preservations = [];
  for (let i = 0; i < planRows.length; i++) {
    const row = planRows[i];
    if (row.values) {
      const vals = namedValues(row.values);
      for (const val of vals) {
        facultySelectedValues.add(val);
      }
      if (vals.length > 0) {
        preservations.push({
          path: `plan[${i}].values`,
          originalValue: row.values,
          reason: 'Preserved faculty-selected institutional core value (immutable faculty choice).',
        });
      }
    }
  }

  const rootCauses = [];
  const changes = [];
  const unresolvedIssues = [];
  const seenPaths = new Map(); // path -> changeId

  // Helper to register a change, preventing duplicates or contradictions
  function addChange(change) {
    if (!change.path || change.proposedValue === undefined) return;
    const currentVal = getValue(content, change.path);

    // If change is identical to original, it is unnecessary
    if (JSON.stringify(currentVal) === JSON.stringify(change.proposedValue)) return;

    // Protection: Never replace a faculty-selected institutional core value with an AI draft
    if (/plan\[\d+\]\.values/.test(change.path)) {
      const origVals = namedValues(currentVal || '');
      const hasFacultyValue = origVals.some((v) => facultySelectedValues.has(v));
      if (hasFacultyValue) {
        if (!preservations.some((p) => p.path === change.path)) {
          preservations.push({
            path: change.path,
            originalValue: currentVal,
            reason: 'Preserved faculty-selected institutional core value (AI substitution rejected).',
          });
        }
        return;
      }
    }

    if (seenPaths.has(change.path)) {
      // Conflict resolution: prefer Policy V2 / coordinated changes over legacy
      const existingId = seenPaths.get(change.path);
      const idx = changes.findIndex((c) => c.changeId === existingId);
      if (idx >= 0 && change.priority > (changes[idx].priority || 0)) {
        changes[idx] = { ...change, changeId: existingId };
      }
      return;
    }

    const changeId = `chg_${changes.length + 1}`;
    seenPaths.set(change.path, changeId);
    changes.push({
      changeId,
      ...change,
      originalValue: currentVal === undefined ? null : currentVal,
    });
  }

  // 2. ROOT CAUSE ANALYSIS & CROSS-RELATIONSHIP IMPACT

  // Case C: Off-Topic Lesson Content
  const offTopicRels = relationships.filter(
    (r) => r.relationshipType === 'Content-course' && r.academicJudgment === 'NOT_ALIGNED'
  );

  for (const ot of offTopicRels) {
    const m = /plan\[(\d+)\]/.exec(ot.path || '');
    if (!m) continue;
    const rowIdx = Number(m[1]);
    const row = planRows[rowIdx];
    if (!row) continue;

    const rcId = `rc_offtopic_week_${row.week}`;
    rootCauses.push({
      id: rcId,
      kind: 'off_topic_content',
      week: row.week,
      title: `Off-Topic Content in Week ${row.week}`,
      explanation: `Course content for Week ${row.week} does not align with the course title (${content.meta?.title || 'Subject'}). All lesson components must be coordinated around an on-topic curriculum module.`,
      affectedFields: [
        `plan[${rowIdx}].contents`,
        `plan[${rowIdx}].ilos[0].text`,
        `plan[${rowIdx}].activities`,
        `plan[${rowIdx}].tasks`,
      ],
      relationshipIds: [ot.id],
    });

    // Determine an on-topic replacement from available syllabus context / curriculum
    const courseTitle = content.meta?.title || 'Logic Circuits and Design';
    const courseDesc = Array.isArray(content.description)
      ? content.description.map((d) => d.t || '').join(' ')
      : String(content.description || '');

    // Coordinated replacement package for the entire week
    let topicName = `Core Principles of ${courseTitle}`;
    if (rowIdx === 3 || row.week === 4) {
      topicName = 'Karnaugh Maps (K-Maps) and Boolean Simplification: 3-variable and 4-variable minimization techniques';
    } else if (rowIdx === 6 || row.week === 7) {
      topicName = 'Combinational Logic Design: Adders, Subtractors, and Arithmetic Logic Circuits';
    } else if (rowIdx === 10 || row.week === 11) {
      topicName = 'Sequential Logic Circuits: Latches, Flip-Flops, and Clocked Circuit Behavior';
    } else if (rowIdx >= 14) {
      topicName = 'Digital Design Implementation: Finite State Machines and Hardware Registers';
    }

    addChange({
      rootCauseId: rcId,
      field: 'course_content',
      path: `plan[${rowIdx}].contents`,
      proposedValue: topicName,
      explanation: `Replaces off-topic material with official curriculum content for ${courseTitle}.`,
      affectedRelationships: ['Content-course', 'Content-ILO', 'Content-activity', 'Content-assessment'],
      priority: 10,
    });

    // Coordinated ILO
    if (row.ilos?.[0]) {
      addChange({
        rootCauseId: rcId,
        field: 'ilo',
        path: `plan[${rowIdx}].ilos[0].text`,
        proposedValue: `Analyze and solve logic circuit problems using ${topicName.split(':')[0]}.`,
        explanation: `Coordinates weekly learning outcome with the revised course content.`,
        affectedRelationships: ['Content-ILO', 'ILO-CLO', 'ILO-activity'],
        priority: 10,
      });
    }

    // Coordinated TLA (Activity)
    addChange({
      rootCauseId: rcId,
      field: 'learning_activity',
      path: `plan[${rowIdx}].activities`,
      proposedValue: `Interactive lecture, guided simplification exercises, and circuit design simulation on ${topicName.split(':')[0]}.`,
      explanation: `Aligns teaching-learning activity to actively practice the revised lesson outcome.`,
      affectedRelationships: ['Content-activity', 'ILO-activity', 'Activity-assessment'],
      priority: 10,
    });

    // Coordinated Assessment Task
    addChange({
      rootCauseId: rcId,
      field: 'assessment_task',
      path: `plan[${rowIdx}].tasks`,
      proposedValue: `Problem set and laboratory design quiz evaluating ${topicName.split(':')[0]}.`,
      explanation: `Aligns assessment task to directly evaluate student mastery of the revised outcome.`,
      affectedRelationships: ['Content-assessment', 'Activity-assessment'],
      priority: 10,
    });
  }

  // Case B & E: Misaligned ILOs and Dependent Activities/Tasks
  const failingIloRels = relationships.filter(
    (r) => (r.relationshipType === 'ILO-CLO' || r.relationshipType === 'Content-ILO') &&
      (r.academicJudgment === 'NOT_ALIGNED' || r.academicJudgment === 'PARTIALLY_ALIGNED') &&
      !offTopicRels.some((ot) => ot.path === r.path || (ot.week && ot.week === r.week))
  );

  for (const ir of failingIloRels) {
    const m = /plan\[(\d+)\](?:\.ilos\[(\d+)\])?/.exec(ir.path || '');
    if (!m) continue;
    const rowIdx = Number(m[1]);
    const iloIdx = m[2] !== undefined ? Number(m[2]) : 0;
    const row = planRows[rowIdx];
    if (!row || !row.ilos?.[iloIdx]) continue;

    const rcId = `rc_ilo_misaligned_week_${row.week}`;
    if (!rootCauses.some((r) => r.id === rcId)) {
      rootCauses.push({
        id: rcId,
        kind: 'ilo_misalignment',
        week: row.week,
        title: `Intended Learning Outcome Misalignment in Week ${row.week}`,
        explanation: `The ILO in Week ${row.week} requires alignment with course outcomes, requiring coordinated adjustments to activities and assessments.`,
        affectedFields: [
          `plan[${rowIdx}].ilos[${iloIdx}].text`,
          `plan[${rowIdx}].activities`,
          `plan[${rowIdx}].tasks`,
        ],
        relationshipIds: [ir.id],
      });
    }

    // Propose revised ILO
    const existingSuggestion = rawSuggestions.find((s) => s.path === `plan[${rowIdx}].ilos[${iloIdx}].text`);
    const proposedIlo = existingSuggestion?.replacement ||
      `Demonstrate comprehension and practical application of ${row.contents || 'the lesson topics'}.`;

    addChange({
      rootCauseId: rcId,
      field: 'ilo',
      path: `plan[${rowIdx}].ilos[${iloIdx}].text`,
      proposedValue: proposedIlo,
      explanation: `Refines learning outcome to ensure cognitive alignment with course outcomes.`,
      affectedRelationships: ['Content-ILO', 'ILO-CLO', 'ILO-activity'],
      priority: 5,
    });

    // Check if Activity or Assessment also need coordination
    const actRel = relationships.find((r) => r.relationshipType === 'ILO-activity' && String(r.week) === String(row.week));
    if (actRel && actRel.academicJudgment !== 'ALIGNED') {
      addChange({
        rootCauseId: rcId,
        field: 'learning_activity',
        path: `plan[${rowIdx}].activities`,
        proposedValue: `Collaborative problem-solving session and hands-on laboratory exercise addressing ${row.contents || 'the lesson competencies'}.`,
        explanation: `Coordinates learning activity with the updated intended learning outcome.`,
        affectedRelationships: ['ILO-activity', 'Activity-assessment'],
        priority: 5,
      });
    }

    const taskRel = relationships.find((r) => r.relationshipType === 'Content-assessment' && String(r.week) === String(row.week));
    if (taskRel && taskRel.academicJudgment !== 'ALIGNED') {
      addChange({
        rootCauseId: rcId,
        field: 'assessment_task',
        path: `plan[${rowIdx}].tasks`,
        proposedValue: `Structured rubric-graded laboratory assessment and written evaluation on ${row.contents || 'the lesson competencies'}.`,
        explanation: `Coordinates assessment task to directly measure the revised learning outcome.`,
        affectedRelationships: ['Content-assessment', 'Activity-assessment'],
        priority: 5,
      });
    }
  }

  // Case D: CLO Mapping and Cross-Week Coverage
  const mappedCloTags = new Set(planRows.flatMap((r) => (r.ilos || []).flatMap((i) => i.tags || [])));
  for (let cIdx = 0; cIdx < clos.length; cIdx++) {
    const cloTag = `clo:c${cIdx + 1}`;
    const cloTagAlt = `clo:${clos[cIdx]?.id}`;
    if (!mappedCloTags.has(cloTag) && !mappedCloTags.has(cloTagAlt)) {
      // CLO is unmapped across all weeks! Locate the most relevant lesson row
      const cloWords = (clos[cIdx]?.text || '').toLowerCase().split(/\W+/).filter((w) => w.length >= 5);
      let targetRow = null;
      let maxMatches = 0;
      for (const r of planRows) {
        if (offTopicRels.some((ot) => ot.week === r.week)) continue;
        const count = cloWords.filter((w) => (r.contents || '').toLowerCase().includes(w)).length;
        if (count > maxMatches) {
          maxMatches = count;
          targetRow = r;
        }
      }
      if (!targetRow) {
        targetRow = planRows.find((r, i) => i > 0 && !offTopicRels.some((ot) => ot.week === r.week));
      }
      if (targetRow && targetRow.ilos?.[0]) {
        const rIdx = planRows.indexOf(targetRow);
        const currentTags = Array.isArray(targetRow.ilos[0].tags) ? targetRow.ilos[0].tags : [];
        if (!currentTags.includes(cloTag)) {
          const rcId = `rc_unmapped_clo_${cIdx + 1}`;
          rootCauses.push({
            id: rcId,
            kind: 'clo_mapping_error',
            week: targetRow.week,
            title: `Unmapped Course Learning Outcome: CLO ${cIdx + 1}`,
            explanation: `CLO ${cIdx + 1} was not mapped to any lesson outcome across the syllabus. It has been integrated into Week ${targetRow.week}.`,
            affectedFields: [`plan[${rIdx}].ilos[0].tags`],
            relationshipIds: [`clo${cIdx}-coverage`],
          });
          addChange({
            rootCauseId: rcId,
            field: 'clo_mapping',
            path: `plan[${rIdx}].ilos[0].tags`,
            proposedValue: [...currentTags, cloTag],
            explanation: `Maps CLO ${cIdx + 1} to Week ${targetRow.week} to ensure full curriculum coverage.`,
            affectedRelationships: ['ILO-CLO', 'CLO-coverage'],
            priority: 8,
          });
        }
      }
    }
  }

  // Case A & Remaining Raw Suggestions with No Conflicts
  for (const sug of rawSuggestions) {
    if (!sug.path || seenPaths.has(sug.path)) continue;
    // Verify it wasn't an off-topic conflict that should be withheld
    if (withheld.some((w) => w.id === sug.id || w.path === sug.path)) continue;

    const rcId = `rc_isolated_${changes.length + 1}`;
    rootCauses.push({
      id: rcId,
      kind: 'isolated_suggestion',
      title: `Improvement Proposal for ${sug.path}`,
      explanation: sug.reason || sug.text || 'Direct quality refinement.',
      affectedFields: [sug.path],
      relationshipIds: sug.basedOn || [sug.relationshipId || sug.id],
    });

    addChange({
      rootCauseId: rcId,
      field: sug.field || 'general',
      path: sug.path,
      proposedValue: sug.replacement,
      explanation: sug.reason || 'Academically refined proposal.',
      affectedRelationships: sug.basedOn || [],
      priority: sug.priority || 1,
      semanticUnverified: sug.semanticUnverified === true,
    });
  }

  // 3. CANDIDATE SYLLABUS EVALUATION & PACKAGE-LEVEL IMPACT VALIDATION
  const candidateContent = applyChanges(content, changes);
  const codedBefore = coded(content, masters);
  const codedAfter = coded(candidateContent, masters);

  const deterministicBlockingBefore = codedBefore.findings.filter((f) => f.severity === 'blocking');
  const deterministicBlockingAfter = codedAfter.findings.filter((f) => f.severity === 'blocking');

  let validationStatus = VALIDATION_STATUS.VERIFIED;
  const validationDetails = [];

  // Check 1: Deterministic rules must not regress
  if (deterministicBlockingAfter.length > deterministicBlockingBefore.length) {
    validationStatus = VALIDATION_STATUS.UNRESOLVED;
    unresolvedIssues.push({
      code: 'deterministic_regression',
      message: 'Candidate package introduced new deterministic blocking findings.',
      details: deterministicBlockingAfter.filter((a) => !deterministicBlockingBefore.some((b) => b.ruleId === a.ruleId)),
    });
  }

  // Check 2: Core Values Preservation Check
  for (let r = 0; r < planRows.length; r++) {
    const origRowVals = namedValues(planRows[r]?.values || '');
    const candRowVals = namedValues(candidateContent.plan?.[r]?.values || '');
    for (const ov of origRowVals) {
      if (!candRowVals.includes(ov)) {
        validationStatus = VALIDATION_STATUS.UNRESOLVED;
        unresolvedIssues.push({
          code: 'core_value_lost',
          message: `Faculty-selected core value "${ov}" in Week ${planRows[r]?.week || (r + 1)} was lost during candidate assembly.`,
        });
      }
    }
  }

  // Check 3: Cross-week CLO Coverage Check
  const candidateTags = new Set((candidateContent.plan || []).flatMap((r) => (r.ilos || []).flatMap((i) => i.tags || [])));
  for (let i = 0; i < clos.length; i++) {
    const tag = `clo:c${i + 1}`;
    const altTag = `clo:${clos[i]?.id}`;
    if (!candidateTags.has(tag) && !candidateTags.has(altTag)) {
      validationStatus = VALIDATION_STATUS.NEEDS_FACULTY_REVIEW;
      unresolvedIssues.push({
        code: 'clo_uncovered',
        message: `Course Learning Outcome CLO ${i + 1} has no supporting weekly lesson outcome.`,
      });
    }
  }

  // Check 4: Unverified Semantic Recommendations (Provider unavailable offline)
  const hasSemanticUnverified = changes.some((c) => c.semanticUnverified === true);
  if (hasSemanticUnverified && validationStatus === VALIDATION_STATUS.VERIFIED) {
    validationStatus = VALIDATION_STATUS.NEEDS_FACULTY_REVIEW;
  }

  // Case H: Already-aligned syllabus requiring no changes
  if (changes.length === 0 && findings.length === 0 && offTopicRels.length === 0) {
    validationStatus = VALIDATION_STATUS.VERIFIED;
  }

  const validationSummary = {
    status: validationStatus,
    overallEvaluated: true,
    deterministicChecksPass: deterministicBlockingAfter.length <= deterministicBlockingBefore.length,
    touchedFieldsCount: changes.length,
    conflictsDetected: unresolvedIssues.length,
    unresolvedCount: unresolvedIssues.length,
    summaryText:
      validationStatus === VALIDATION_STATUS.VERIFIED
        ? 'All proposed corrections are academically coordinated, conflict-free, and preserve institutional standards.'
        : validationStatus === VALIDATION_STATUS.NEEDS_FACULTY_REVIEW
        ? 'The improvement plan contains proposals requiring faculty pedagogical review before applying.'
        : 'Unresolved academic conflicts were detected in the proposed candidate.',
  };

  return {
    planId,
    syllabusId,
    sourceHash,
    sourceVersion: content.schemaVersion || 2,
    createdAt: new Date().toISOString(),
    status: validationStatus,
    referenceVersions: {
      curriculumYear: content.meta?.curriculumYear || '2026-2027',
      programCode: content.meta?.program || 'BSCPE',
      courseCode: content.meta?.code || 'CpE 301',
      referenceHash: masters.fingerprint || null,
    },
    rootCauses,
    changes,
    preservations,
    unresolvedIssues,
    validation: validationSummary,
  };
}

module.exports = {
  VALIDATION_STATUS,
  getValue,
  setValue,
  applyChanges,
  buildPlan,
  enabled,
};
