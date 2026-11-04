'use strict';
// Stage E.9 Phase 3, Layer A (Part 2): Offline faculty-review package builder and exporter.
// Generates a complete, self-contained faculty-review package from the Phase 3 declarative defect catalogue
// (manifest-phase3-1.json) and the four 18-week fixtures (BSIT, BSIE, BSCpE, BSIT-CYBERSECURITY).
// Runs 100% offline inside withNoNetwork() with zero provider calls and zero database queries.
// All developer-written expectations remain marked DRAFT (reviewStatus: "unreviewed", facultyVerdict: null).
const fs = require('node:fs');
const path = require('node:path');
const { pairsOf } = require('../../gemini');
const { FIXTURES, PROVENANCE, MANIFEST_FILE, loadManifest, base, variant } = require('./fixtures');
const { runWithOracle, withNoNetwork } = require('./oracle');
const { SCORED_TYPES, manifestHash } = require('./score');

const DRAFT_STATUS = 'DRAFT — developer-written expectation, NOT faculty-reviewed';
const UNVERIFIED_PROPOSAL_NOTE = 'UNVERIFIED PROPOSAL — generated for testing/review; requires faculty approval before any syllabus change.';

// Section 4: Academic Recommendation Review Considerations (documented for faculty & QA review without redesigning production safeguards).
const ACADEMIC_RECOMMENDATION_REVIEW = Object.freeze([
  {
    id: 'supplied_test_materials',
    title: 'Unsupported supplied test materials ("the provided test cases" / "the provided test data")',
    referenceCases: ['as-prog1-keywords', 'bsit-row10-assessment-subtle', 'cyber-row10-assessment-subtle'],
    currentBehavior:
      'In Stage C r8 (as-prog1-keywords), a released assessment draft asks students to "run it on the provided test cases". The static reviewer (recommendationReview.js resources-4) withholds "the provided simulated measurement data" as assumes_resource, but gives no note for "the provided test cases" or "the provided test data" because programming test sets are outside its current resource noun vocabulary.',
    facultyQuestion:
      'Should assessment recommendations that rely on faculty-supplied test cases or test data ("the provided test cases", "the given input file") carry an advisory note or withholding code when the lesson does not state that test cases are provided, or are instructor-supplied test inputs an ordinary part of a programming task?',
    decisionOwner: 'BSIT / Cyber Security Faculty & QA Reviewer Policy',
    status: 'Documented for faculty review; resources-4 unchanged.',
  },
  {
    id: 'contact_hours_modification',
    title: 'Recommendations modifying approved contact hours (lecture / laboratory hour changes)',
    referenceCases: ['CUR-05 (lecture/lab units)', 'Stage E.8 contact-hour probes', 'bsie-row1-activity-passive', 'bscpe-row1-activity-passive'],
    currentBehavior:
      'Stage E.8 established that course contact hours (lecture and laboratory units) change only with institutional and registrar approval. Currently, no dedicated reviewer code enforces contact-hour invariance: "Add two more lecture hours for guided practice." receives no reviewer note, while "Convert one lecture hour into a laboratory hour." is withheld only as an assumed laboratory (assumes_resource), even if phrased as subject to department approval.',
    facultyQuestion:
      'Should a dedicated changes_contact_hours withholding code be activated in the static draft reviewer so any recommendation that adds, removes, or converts lecture/laboratory contact hours is automatically withheld?',
    decisionOwner: 'Academic QA / Institution & Architecture Approval',
    status: 'Proposed (changes_contact_hours not yet implemented); documented for review.',
  },
  {
    id: 'cross_relationship_copying',
    title: 'Cross-relationship copying in drafts and explanations (copies_other_relationship vs borrowed_wording)',
    referenceCases: ['af-prog1-irrelevant', 'af-prog1-single-format', 'vu-prog1-name-only', 'vm-prog1-respect-supported', 'af-syseng-irrelevant', 'as-prog1-too-high'],
    currentBehavior:
      'When multiple relationships share a batch, the model can copy phrases from a sibling relationship into a draft or explanation. Static review withholds drafts with copies_other_relationship when 4-word sequences come from another week/relationship, and attaches advisory borrowed_wording / borrowed_context notes for smaller overlaps. In Stage D1 (vu-prog1-name-only), a saved draft copied another lesson\'s value statement, and in vm-prog1-respect-supported an explanation borrowed truthful test-log reporting from another week.',
    facultyQuestion:
      'Confirm that any draft or explanation borrowing activities, artifacts, or behaviors from a different lesson week must be rejected or withheld during faculty validation, and verify whether borrowed_wording advisory thresholds match faculty expectations.',
    decisionOwner: 'Program Faculty & Values Office',
    status: 'Enforced for drafts via copies_other_relationship; explanations flagged for manual/faculty review.',
  },
  {
    id: 'conditional_resource_recommendations',
    title: 'Conditional resource recommendations ("if available" / "where available") in laboratory-0 and laboratory-bearing courses',
    referenceCases: ['af-sensors-passive', 'bsie-aligned (3/0 lecture-only)', 'bscpe-aligned (3/0 lecture-only)', 'bsit-aligned (2/1 lab)', 'cyber-aligned (2/1 lab)'],
    currentBehavior:
      'Unconditional introduction of unestablished equipment, software, or laboratory facilities is withheld as assumes_resource (blocking). When a draft qualifies a resource with "if available" or "where available" (for example in a 3/0 laboratory-0 course like BSIE IE-402 or BSCpE CpE-304), resources-4 records conditional_resource as an advisory warning without withholding the draft.',
    facultyQuestion:
      'For laboratory-0 courses (lecture 3, laboratory 0), is a conditional phrasing ("using simulation software if available") acceptable as an advisory suggestion, or should resource-dependent suggestions in 0-lab courses be withheld unless the syllabus already names the tool?',
    decisionOwner: 'BSIE & BSCpE Program Chairs / Faculty',
    status: 'Advisory warning (conditional_resource) active; documented for faculty review.',
  },
  {
    id: 'as_prog1_vague_evidence_disagreement',
    title: 'Unresolved academic disagreement: bare submission instruction "- Submit your work." (as-prog1-vague-evidence / Catalogue 8.4)',
    referenceCases: ['as-prog1-vague-evidence', 'bsit-row10-vague-submit'],
    currentBehavior:
      'For the assessment task "- Submit your work." in a practical Java programming lesson, the developer provisional expectation accepts PARTIALLY_ALIGNED (with measures: partly, evidence: vague), treating a bare instruction like the r8 bare-name rule ("- Quiz"). In the Stage C r8 unseen-cases run, the model answered NOT_ALIGNED (measures: no, evidence: vague, level: too_low) because the task names no observable product or artifact, and under the r8 contract measures: no requires NOT_ALIGNED.',
    facultyQuestion:
      'Adjudicate Q1-Q5 (Stage E.9 Phase 2 Closeout §4.6): (Q1) Should "- Submit your work." be PARTIALLY_ALIGNED, NOT_ALIGNED, or either? (Q2) Is measures: partly or measures: no? (Q3) Should level allow "cannot_tell" when no difficulty level is stated, or is too_low acceptable? (Q4) Should the r8 bare-name rule be extended to bare instructions (requiring prompt r9)? (Q5) Is the model\'s proposed draft acceptable?',
    decisionOwner: 'BSIT Faculty (2 independent reviewers + Program Chair adjudicator)',
    status: 'OPEN — excluded from agreement scoring until faculty adjudicate; both developer expectation and model answer preserved unchanged.',
  },
]);

function readPath(obj, pathStr) {
  if (!obj || !pathStr) return undefined;
  return String(pathStr)
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
    .reduce((cur, key) => (cur == null ? undefined : cur[key]), obj);
}

function formatValue(val) {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string') return val.trim();
  if (Array.isArray(val)) {
    return val
      .map(item => {
        if (typeof item === 'object' && item !== null) {
          if ('t' in item) return String(item.t);
          if ('text' in item) return String(item.text);
          if ('statement' in item) return `${item.title || item.id || 'CLO'} (${item.level || ''}): ${item.statement} [POs: ${(item.pos || []).join(', ')}; EGAs: ${(item.egas || []).join(', ')}]`;
          return JSON.stringify(item);
        }
        return String(item);
      })
      .join('\n');
  }
  if (typeof val === 'object') {
    if ('t' in val) return String(val.t);
    if ('text' in val) return String(val.text);
    return JSON.stringify(val);
  }
  return String(val);
}

function parseRowIndex(paths) {
  for (const p of paths || []) {
    const m = /^plan\[(\d+)\]/.exec(String(p));
    if (m) return Number(m[1]);
  }
  return null;
}

function parseCloIndex(paths, expId) {
  for (const p of paths || []) {
    const m = /^clos\[(\d+)\]/.exec(String(p));
    if (m) return Number(m[1]);
  }
  const mId = /^clo(\d+)-/.exec(String(expId || ''));
  if (mId) return Number(mId[1]);
  return null;
}

function buildCloContext(content, masters, rowIdx, cloIdx) {
  const clos = content.clos || [];
  const pos = masters.pos || [];
  const egas = masters.institution?.egas || [];

  const formatOneClo = (c, idx) => {
    const poTexts = (c.pos || []).map(no => {
      const p = pos.find(x => x.no === no);
      return p ? `PO ${no}: ${p.text}` : `PO ${no} (not in approved list)`;
    });
    const egaTexts = (c.egas || []).map(no => {
      const e = egas.find(x => x.no === no);
      return e ? `EGA ${no} (${e.title || e.name}): ${e.name}` : `EGA ${no}`;
    });
    return [
      `CLO ${idx + 1} [${c.level || 'untagged'}]: ${c.statement}`,
      poTexts.length ? `  Mapped POs: ${poTexts.join(' | ')}` : '  Mapped POs: (none)',
      egaTexts.length ? `  Mapped EGAs: ${egaTexts.join(' | ')}` : '  Mapped EGAs: (none)',
    ].join('\n');
  };

  if (cloIdx !== null && clos[cloIdx]) {
    return formatOneClo(clos[cloIdx], cloIdx);
  }
  if (rowIdx !== null && content.plan?.[rowIdx]) {
    const row = content.plan[rowIdx];
    const tags = (row.ilos || []).flatMap(ilo => ilo.tags || []);
    const matched = tags
      .filter(t => t.startsWith('clo:'))
      .map(t => clos.findIndex(c => `clo:${c.id}` === t))
      .filter(i => i >= 0);
    if (matched.length) {
      return [...new Set(matched)].map(i => formatOneClo(clos[i], i)).join('\n\n');
    }
  }
  return clos.map((c, i) => formatOneClo(c, i)).join('\n\n');
}

function buildIloContext(content, rowIdx, cloIdx) {
  const plan = content.plan || [];
  if (rowIdx !== null && plan[rowIdx]) {
    const row = plan[rowIdx];
    if (row.kind === 'exam') return `Week ${row.week}: Examination row (${row.contents})`;
    const iloLines = (row.ilos || []).map(
      (ilo, j) => `ILO ${j + 1} [tags: ${(ilo.tags || []).join(', ') || 'none'}]: ${ilo.text || '(empty)'}`
    );
    return [
      `Week ${row.week} Lesson Context:`,
      ...iloLines,
      `Weekly Content: ${row.contents || '(empty)'}`,
      `Activities: ${row.activities || '(empty)'}`,
      `Assessment Tasks: ${row.tasks || '(empty)'}`,
      `Values Statement: ${row.values || '(empty)'}`,
    ].join('\n');
  }
  if (cloIdx !== null) {
    const cloTag = `clo:c${cloIdx + 1}`;
    const supporting = plan
      .filter(r => r.kind !== 'exam' && (r.ilos || []).some(ilo => (ilo.tags || []).includes(cloTag)))
      .map(r => `Week ${r.week}: ${(r.ilos || []).map(i => i.text).join('; ')}`);
    return supporting.length
      ? `Weeks tagged to CLO ${cloIdx + 1} (${supporting.length} week(s)):\n${supporting.join('\n')}`
      : `No weekly ILOs currently tagged to CLO ${cloIdx + 1} (0 supporting weeks).`;
  }
  return `18-week plan (${plan.filter(r => r.kind !== 'exam').length} instructional weeks; exam weeks 6, 12, 18).`;
}

function attachReviewConsiderations(defect, exp) {
  const notes = [];
  if (defect.catalogueId === '8.4' || defect.id.includes('vague-submit') || exp?.kind === 'open') {
    notes.push('as_prog1_vague_evidence_disagreement');
  }
  if (defect.component === 11 || exp?.type === 'Activity-fit' || exp?.type === 'ILO-activity') {
    notes.push('conditional_resource_recommendations', 'contact_hours_modification', 'cross_relationship_copying');
  }
  if (defect.component === 12 || exp?.type === 'Assessment-fit' || exp?.type === 'ILO-assessment') {
    notes.push('supplied_test_materials', 'cross_relationship_copying');
  }
  if (defect.component === 13 && (exp?.type === 'Value-use' || exp?.type === 'Value-map' || exp?.type === 'Module-value')) {
    notes.push('cross_relationship_copying');
  }
  return [...new Set(notes)];
}

async function buildPhase3FacultyReviewPackage(options = {}) {
  return withNoNetwork(async () => {
    const manifest = options.manifest || loadManifest();
    const mHash = manifestHash(MANIFEST_FILE);
    const baseByFixture = {};
    for (const key of FIXTURES) {
      baseByFixture[key] = base(key);
    }

    const records = [];

    // 1. Export all 46 declarative semantic defects and their primary + cascade expectations
    for (const defect of manifest.defects) {
      const alignedSyl = baseByFixture[defect.fixture];
      const mutSyl = variant(defect.fixture, `single:${defect.id}`, manifest);
      const prov = PROVENANCE[defect.fixture];
      const syntheticSpec = {
        base: defect.fixture,
        defects: [defect.id],
        controls: [],
        partialControls: [],
        defaultExpectation: { accept: ['ALIGNED'] },
        expectations: defect.expectations,
        deterministic: defect.deterministic || [],
      };
      const { result } = await runWithOracle(mutSyl, {
        variantSpec: syntheticSpec,
        expectations: defect.expectations,
      });

      const plannedPairs = pairsOf(mutSyl.content, mutSyl.masters, [], {
        stageA: true,
        stageB: true,
        stageB4: true,
      });
      const pairById = new Map(plannedPairs.map(p => [p.id, p]));
      const judgementsById = new Map((result.hybrid?.alignment?.judgements || []).map(j => [j.id, j]));
      const findingsByRel = new Map();
      for (const f of result.hybrid?.verdict?.findings || []) {
        if (f.relationshipId && !findingsByRel.has(f.relationshipId)) {
          findingsByRel.set(f.relationshipId, f);
        }
      }

      const rowIdx = parseRowIndex(defect.affectedFields);
      const weekLabel =
        rowIdx !== null && mutSyl.content.plan?.[rowIdx]
          ? `Week ${mutSyl.content.plan[rowIdx].week} (plan[${rowIdx}])`
          : 'Course-level';

      const originalFieldText = (defect.affectedFields || [])
        .map(p => `${p}: ${formatValue(readPath(alignedSyl.content, p))}`)
        .join('\n\n');
      const modifiedFieldText = (defect.affectedFields || [])
        .map(p => `${p}: ${formatValue(readPath(mutSyl.content, p))}`)
        .join('\n\n');

      for (const exp of defect.expectations) {
        const relId = exp.id || exp.relationship;
        const expRowIdx = parseRowIndex([exp.path, ...(defect.affectedFields || [])]);
        const expCloIdx = parseCloIndex(defect.affectedFields, relId);
        const pair = pairById.get(relId);
        const j = judgementsById.get(relId);
        const f = findingsByRel.get(relId);

        const expWeekLabel =
          expRowIdx !== null && mutSyl.content.plan?.[expRowIdx]
            ? `Week ${mutSyl.content.plan[expRowIdx].week} (plan[${expRowIdx}])`
            : weekLabel;

        const cloContext = buildCloContext(mutSyl.content, mutSyl.masters, expRowIdx, expCloIdx);
        const iloContext = buildIloContext(mutSyl.content, expRowIdx, expCloIdx);

        const upstreamDeps = [
          ...(defect.dependencies || []),
          ...(exp.withheld ? [`Precedence withholding active: ${exp.withheld}${f?.withheldNote ? ` (${f.withheldNote})` : ''}`] : []),
        ];

        const considerationIds = attachReviewConsiderations(defect, exp);
        const considerations = considerationIds.map(cid => {
          const item = ACADEMIC_RECOMMENDATION_REVIEW.find(x => x.id === cid);
          return item ? `${item.id}: ${item.title} — ${item.facultyQuestion}` : cid;
        });

        let suggestedRecText = '';
        if (exp.withheld || f?.withheld) {
          suggestedRecText = `[WITHHELD (${exp.withheld || f?.withheld})]: ${f?.withheldNote || 'No rewrite offered due to upstream precedence or draft safeguard.'}`;
        } else if ((f?.recommendationType || exp.recommendation) === 'RETAG_OUTCOME') {
          const advice = (result.hybrid?.mappingAdvice || []).find(m => m.path && (defect.affectedFields || []).some(af => af.startsWith(m.path.split('.')[0])));
          suggestedRecText = `[RETAG_OUTCOME — keep authored text unchanged]: ${f?.recommendation || advice?.message || exp.oracleExplanation || 'Re-tag to the matching approved outcome.'}`;
        } else if (f?.recommendation || exp.oracleDraft) {
          suggestedRecText = `[${f?.recommendationType || exp.recommendation || 'REWRITE_TEXT'} — ${UNVERIFIED_PROPOSAL_NOTE}]\n${f?.recommendation || exp.oracleDraft}`;
        } else {
          suggestedRecText = `[${f?.recommendationType || exp.recommendation || 'REVIEW_REQUIRED'}]: Faculty author decision required; no automatic text replacement proposed.`;
        }

        records.push({
          recordId: `${defect.id}::${relId}`,
          recordType: exp.kind === 'open' ? 'open_adjudication_item' : 'declarative_defect_expectation',
          expectationStatus: DRAFT_STATUS,
          reviewStatus: exp.reviewStatus || defect.reviewStatus || 'unreviewed',
          // 1. Program, course and curriculum version
          program: mutSyl.program,
          courseCode: mutSyl.content.meta.code,
          courseTitle: mutSyl.content.meta.title,
          curriculumVersion: mutSyl.content.meta.curriculumYear,
          units: `${mutSyl.content.meta.lecture} lecture / ${mutSyl.content.meta.lab} laboratory`,
          prerequisite: mutSyl.content.meta.prereq || '(none)',
          yearLevel: mutSyl.content.meta.yearLevel,
          outcomeSource: prov.outcomes,
          provenance: {
            syllabusSynthetic: prov.syllabusSynthetic,
            identityStatus: prov.identityStatus,
            outcomesStatus: prov.outcomesStatus,
            note:
              defect.fixture === 'cyber'
                ? 'BSIT-CYBERSECURITY CS-301 curriculum row is transcribed from 2025-2026 registrar image (approval not confirmed offline); uses shared BSIT POs/EGAs without executing program_outcome_sources migration.'
                : 'Course identity and POs/EGAs from repository transcriptions; 18-week plan is synthetic.',
          },
          // 2. Syllabus week and affected field
          week: expWeekLabel,
          affectedFields: defect.affectedFields,
          affectedField: (defect.affectedFields || []).join(', '),
          relationshipPath: f?.path || j?.path || pair?.path || (defect.affectedFields || [])[0] || '',
          // 3. Original instructional content
          originalContent: originalFieldText,
          // 4. Modified instructional content
          modifiedContent: modifiedFieldText,
          // 5. CLO and ILO context
          cloContext,
          iloContext,
          // 6. Expected academic finding (marked DRAFT)
          expectedFinding: {
            status: DRAFT_STATUS,
            defectId: defect.id,
            catalogueId: exp.catalogueId || defect.catalogueId,
            component: exp.component || defect.component,
            category: defect.category,
            kind: exp.kind || defect.kind,
            role: exp.role,
            relationshipId: relId,
            relationshipType: exp.type,
            isOfficiallyScoredType: SCORED_TYPES.has(exp.type),
            ruleId: exp.verdict?.ruleId || f?.ruleId || null,
            expectedLabels: exp.accept,
            expectedAspects: exp.fields || null,
            expectedResponsibleField: exp.responsible || null,
            expectedVerdictStatus: exp.verdict?.status || null,
            expectedVerdictSeverity: exp.verdict?.severity || null,
            developerDescription: defect.description,
            developerRationale: exp.oracleExplanation || defect.description,
          },
          // 7. Source and target evidence
          evidence: {
            sourceText: pair?.source || f?.reference || '',
            targetText: pair?.target || f?.actual || '',
            sourceQuote: j?.sourceQuote || '',
            targetQuote: j?.targetQuote || '',
            evidenceMatching: j?.evidenceMatching || { source: 'exact', target: 'exact' },
            evidenceRequirements: defect.evidenceRequirements || '',
          },
          // 8. Upstream dependencies
          upstreamDependencies: {
            paths: defect.dependencies || [],
            withheld: exp.withheld || f?.withheld || null,
            withheldNote: f?.withheldNote || null,
            summary: upstreamDeps.join(' | ') || 'None (primary upstream relationship)',
          },
          // 9. Suggested recommendation
          recommendation: {
            recommendationType: f?.recommendationType || exp.recommendation || null,
            withheld: exp.withheld || f?.withheld || null,
            suggestedText: suggestedRecText,
            requiresFacultyApproval: true,
            reviewConsiderations: considerations,
          },
          // 10-12. Faculty review fields (unpopulated by design)
          facultyJudgment: exp.facultyVerdict ?? null,
          facultyAgreement: '',
          facultyExplanation: exp.facultyNotes || '',
          reviewedByRole: '',
          reviewDate: '',
        });
      }
    }

    // 2. Export the 9 deterministic / curriculum identity edge cases from manifest.edges
    for (const edge of manifest.edges) {
      const alignedSyl = baseByFixture[edge.fixture];
      const edgeSyl = variant(edge.fixture, `edge:${edge.id}`, manifest);
      const prov = PROVENANCE[edge.fixture];
      const { result } = await runWithOracle(edgeSyl, {});
      const affectedPaths = (edge.edits || []).map(e => e.set);
      const rowIdx = parseRowIndex(affectedPaths);
      const weekLabel =
        rowIdx !== null && edgeSyl.content.plan?.[rowIdx]
          ? `Week ${edgeSyl.content.plan[rowIdx].week} (plan[${rowIdx}])`
          : 'Course-level (Identity / Structure)';

      const originalFieldText = affectedPaths
        .map(p => `${p}: ${formatValue(readPath(alignedSyl.content, p))}`)
        .join('\n\n');
      const modifiedFieldText = affectedPaths
        .map(p => `${p}: ${formatValue(readPath(edgeSyl.content, p))}`)
        .join('\n\n');

      for (const det of edge.deterministic || []) {
        const f = (result.hybrid?.verdict?.findings || []).find(
          x => x.ruleId === det.ruleId && (!det.path || x.path === det.path)
        );
        records.push({
          recordId: `edge:${edge.id}::${det.ruleId}:${det.path || 'course'}`,
          recordType: 'deterministic_identity_or_structure_edge',
          expectationStatus: DRAFT_STATUS,
          reviewStatus: edge.reviewStatus || 'unreviewed',
          program: edgeSyl.program,
          courseCode: edgeSyl.content.meta.code,
          courseTitle: edgeSyl.content.meta.title,
          curriculumVersion: edgeSyl.content.meta.curriculumYear,
          units: `${edgeSyl.content.meta.lecture} lecture / ${edgeSyl.content.meta.lab} laboratory`,
          prerequisite: edgeSyl.content.meta.prereq || '(none)',
          yearLevel: edgeSyl.content.meta.yearLevel,
          outcomeSource: prov.outcomes,
          provenance: {
            syllabusSynthetic: prov.syllabusSynthetic,
            identityStatus: prov.identityStatus,
            outcomesStatus: prov.outcomesStatus,
            note:
              edge.fixture === 'cyber'
                ? 'BSIT-CYBERSECURITY CS-301 curriculum row is transcribed from 2025-2026 registrar image (approval not confirmed offline); uses shared BSIT POs/EGAs.'
                : 'Course identity and POs/EGAs from repository transcriptions; 18-week plan is synthetic.',
          },
          week: weekLabel,
          affectedFields: affectedPaths,
          affectedField: affectedPaths.join(', '),
          relationshipPath: det.path || f?.path || affectedPaths[0] || '',
          originalContent: originalFieldText,
          modifiedContent: modifiedFieldText,
          cloContext: buildCloContext(edgeSyl.content, edgeSyl.masters, rowIdx, null),
          iloContext: buildIloContext(edgeSyl.content, rowIdx, null),
          expectedFinding: {
            status: DRAFT_STATUS,
            defectId: `edge:${edge.id}`,
            catalogueId: edge.catalogueId,
            component: edge.component,
            category: 'deterministic_identity_or_structure',
            kind: 'deterministic',
            role: 'primary',
            relationshipId: null,
            relationshipType: 'deterministic',
            isOfficiallyScoredType: false,
            ruleId: det.ruleId,
            expectedLabels: [det.status],
            expectedAspects: null,
            expectedResponsibleField: f?.responsible || 'institution_policy',
            expectedVerdictStatus: det.status,
            expectedVerdictSeverity: det.severity || f?.severity || 'MAJOR',
            developerDescription: edge.description,
            developerRationale: f?.explanation || edge.description,
          },
          evidence: {
            sourceText: String(f?.evidence || f?.reference || 'Approved curriculum / structural rule'),
            targetText: String(f?.actual || modifiedFieldText),
            sourceQuote: String(f?.evidence || ''),
            targetQuote: String(f?.actual || ''),
            evidenceMatching: { source: 'deterministic', target: 'deterministic' },
            evidenceRequirements: 'Deterministic rule check against the selected curriculum record or structural requirement.',
          },
          upstreamDependencies: {
            paths: ['masters.curricula', ...affectedPaths],
            withheld: null,
            withheldNote: null,
            summary:
              det.ruleId === 'CUR-03'
                ? 'Blocks AI checking by default when course code is unrecognized in the selected program curriculum (score = 0).'
                : 'Deterministic rule check.',
          },
          recommendation: {
            recommendationType: f?.recommendation ? 'REWRITE_TEXT' : 'REVIEW_REQUIRED',
            withheld: null,
            suggestedText: f?.recommendation
              ? `[DETERMINISTIC RULE SUGGESTION]: ${f.recommendation}`
              : '[REVIEW_REQUIRED]: Confirm against the registrar-approved curriculum record.',
            requiresFacultyApproval: true,
            reviewConsiderations: edge.id.includes('metadata') ? ['contact_hours_modification'] : [],
          },
          facultyJudgment: edge.facultyVerdict ?? null,
          facultyAgreement: '',
          facultyExplanation: edge.facultyNotes || '',
          reviewedByRole: '',
          reviewDate: '',
        });
      }
    }

    return {
      packageVersion: 'phase3-faculty-review-1',
      manifestVersion: manifest.version,
      manifestSha256: mHash,
      status: DRAFT_STATUS,
      offlineOnly: true,
      autoPopulatedFacultyVerdicts: 0,
      counts: {
        totalRecords: records.length,
        defectExpectationRecords: records.filter(r => r.recordType === 'declarative_defect_expectation').length,
        openAdjudicationRecords: records.filter(r => r.recordType === 'open_adjudication_item').length,
        deterministicEdgeRecords: records.filter(r => r.recordType === 'deterministic_identity_or_structure_edge').length,
        defectsCount: manifest.defects.length,
        edgesCount: manifest.edges.length,
        recommendationReviewTopicsCount: ACADEMIC_RECOMMENDATION_REVIEW.length,
      },
      provenance: PROVENANCE,
      academicRecommendationReview: ACADEMIC_RECOMMENDATION_REVIEW,
      records,
    };
  });
}

const CSV_COLUMNS = [
  ['recordId', 'Record ID'],
  ['recordType', 'Record Type'],
  ['expectationStatus', 'Expectation Status (DRAFT vs Faculty-Approved)'],
  ['reviewStatus', 'Review Status'],
  ['program', 'Program'],
  ['courseCode', 'Course Code'],
  ['courseTitle', 'Course Title'],
  ['curriculumVersion', 'Curriculum Version'],
  ['units', 'Contact Units (Lec / Lab)'],
  ['prerequisite', 'Prerequisite'],
  ['outcomeSource', 'Outcome Source'],
  ['provenanceNote', 'Provenance & Approval Status'],
  ['week', 'Syllabus Week'],
  ['affectedField', 'Affected Syllabus Field(s)'],
  ['originalContent', 'Original Instructional Content (Aligned Base)'],
  ['modifiedContent', 'Modified Instructional Content (Planted Defect)'],
  ['cloContext', 'CLO Context (Statement, Level, PO/EGA Tags)'],
  ['iloContext', 'ILO & Weekly Lesson Context'],
  ['expectedFindingSummary', 'Expected Academic Finding (Developer DRAFT)'],
  ['sourceEvidence', 'Source Evidence & Verbatim Quote'],
  ['targetEvidence', 'Target Evidence & Verbatim Quote'],
  ['upstreamDependencies', 'Upstream Dependencies & Precedence'],
  ['suggestedRecommendation', 'Suggested Recommendation & Review Considerations'],
  ['facultyAgreement', 'Faculty Judgment: Agree with Expected Finding? (Agree / Disagree / Unsure)'],
  ['facultyJudgment', 'Faculty Judgment: Expected Verdict (ALIGNED / PARTIALLY_ALIGNED / NOT_ALIGNED / FAIL / PASS)'],
  ['facultyExplanation', 'Faculty Explanation / Notes'],
  ['reviewedByRole', 'Reviewed-By Name & Role (Faculty / Chair / Librarian / Values Office)'],
  ['reviewDate', 'Review Date (YYYY-MM-DD)'],
];

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function escHtml(text) {
  return String(text ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function flattenRecordForCsv(r) {
  const ef = r.expectedFinding;
  const expectedFindingSummary = [
    `[${ef.status}]`,
    `Defect: ${ef.defectId} (Catalogue ${ef.catalogueId}, Component ${ef.component}, ${ef.role}, ${ef.kind})`,
    `Rule: ${ef.ruleId || 'n/a'} | Relationship: ${ef.relationshipType} (${ef.relationshipId || 'deterministic'}) | Officially Scored: ${ef.isOfficiallyScoredType ? 'YES' : 'NO (advisory)'}`,
    `Expected Label(s): ${(ef.expectedLabels || []).join(' or ')} | Expected Verdict: ${ef.expectedVerdictStatus || 'n/a'}`,
    ef.expectedAspects ? `Expected Aspect Fields: ${JSON.stringify(ef.expectedAspects)}` : '',
    ef.expectedResponsibleField ? `Expected Responsible Field: ${ef.expectedResponsibleField}` : '',
    `Developer Rationale: ${ef.developerRationale}`,
  ]
    .filter(Boolean)
    .join('\n');

  const sourceEvidence = [
    `Source Text:\n${r.evidence.sourceText}`,
    r.evidence.sourceQuote ? `Verbatim Source Quote (${r.evidence.evidenceMatching?.source || 'exact'}): "${r.evidence.sourceQuote}"` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const targetEvidence = [
    `Target Text:\n${r.evidence.targetText}`,
    r.evidence.targetQuote ? `Verbatim Target Quote (${r.evidence.evidenceMatching?.target || 'exact'}): "${r.evidence.targetQuote}"` : '',
    r.evidence.evidenceRequirements ? `Evidence Requirement: ${r.evidence.evidenceRequirements}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const suggestedRecommendation = [
    r.recommendation.suggestedText,
    r.recommendation.reviewConsiderations?.length
      ? `Academic Recommendation Review Considerations:\n- ${r.recommendation.reviewConsiderations.join('\n- ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    recordId: r.recordId,
    recordType: r.recordType,
    expectationStatus: r.expectationStatus,
    reviewStatus: r.reviewStatus,
    program: r.program,
    courseCode: r.courseCode,
    courseTitle: r.courseTitle,
    curriculumVersion: r.curriculumVersion,
    units: r.units,
    prerequisite: r.prerequisite,
    outcomeSource: r.outcomeSource,
    provenanceNote: `${r.provenance.identityStatus} — ${r.provenance.note}`,
    week: r.week,
    affectedField: r.affectedField,
    originalContent: r.originalContent,
    modifiedContent: r.modifiedContent,
    cloContext: r.cloContext,
    iloContext: r.iloContext,
    expectedFindingSummary,
    sourceEvidence,
    targetEvidence,
    upstreamDependencies: r.upstreamDependencies.summary,
    suggestedRecommendation,
    facultyAgreement: r.facultyAgreement || '',
    facultyJudgment: r.facultyJudgment ?? '',
    facultyExplanation: r.facultyExplanation || '',
    reviewedByRole: r.reviewedByRole || '',
    reviewDate: r.reviewDate || '',
  };
}

function renderFacultyReviewCsv(pkg) {
  const headerRow = CSV_COLUMNS.map(c => csvCell(c[1])).join(',');
  const dataRows = pkg.records.map(r => {
    const flat = flattenRecordForCsv(r);
    return CSV_COLUMNS.map(([key]) => csvCell(flat[key])).join(',');
  });
  return '\uFEFF' + [headerRow, ...dataRows].join('\r\n') + '\r\n';
}

function renderFacultyReviewHtml(pkg) {
  const programs = [...new Set(pkg.records.map(r => `${r.program} (${r.curriculumVersion}) — ${r.courseCode} ${r.courseTitle}`))];
  const renderCard = r => {
    const flat = flattenRecordForCsv(r);
    return `<article class="record ${r.recordType === 'open_adjudication_item' ? 'open' : 'draft'}">
  <h4>${escHtml(r.recordId)} <small>${escHtml(r.week)} · ${escHtml(r.affectedField)}</small></h4>
  <p class="badge"><b>Status:</b> ${escHtml(r.expectationStatus)} · <b>Review Status:</b> ${escHtml(r.reviewStatus)} · <b>Program/Curriculum:</b> ${escHtml(r.program)} (${escHtml(r.curriculumVersion)}) · <b>Course:</b> ${escHtml(r.courseCode)} ${escHtml(r.courseTitle)}</p>
  <p class="prov"><b>Provenance:</b> ${escHtml(flat.provenanceNote)}</p>
  <div class="grid">
    <div><b>Original Instructional Content (Aligned Base)</b><pre>${escHtml(r.originalContent)}</pre></div>
    <div><b>Modified Instructional Content (Planted Defect)</b><pre>${escHtml(r.modifiedContent)}</pre></div>
  </div>
  <div class="grid">
    <div><b>CLO Context</b><pre>${escHtml(r.cloContext)}</pre></div>
    <div><b>ILO &amp; Weekly Lesson Context</b><pre>${escHtml(r.iloContext)}</pre></div>
  </div>
  <div class="grid">
    <div><b>Source Evidence &amp; Quote</b><pre>${escHtml(flat.sourceEvidence)}</pre></div>
    <div><b>Target Evidence &amp; Quote</b><pre>${escHtml(flat.targetEvidence)}</pre></div>
  </div>
  <p><b>Expected Academic Finding (Developer DRAFT):</b></p>
  <pre>${escHtml(flat.expectedFindingSummary)}</pre>
  <p><b>Upstream Dependencies &amp; Precedence:</b> ${escHtml(r.upstreamDependencies.summary)}</p>
  <p><b>Suggested Recommendation (Unverified Proposal):</b></p>
  <pre>${escHtml(flat.suggestedRecommendation)}</pre>
  <div class="box">
    <b>Faculty Review (to be completed by qualified faculty / adjudicator):</b><br>
    Agree with developer expectation? [ ] Agree &nbsp; [ ] Disagree &nbsp; [ ] Unsure<br>
    Faculty Judgment (ALIGNED / PARTIALLY_ALIGNED / NOT_ALIGNED / FAIL / PASS): ______________________________<br>
    Faculty Explanation / Notes: ____________________________________________________________________________<br>
    Reviewed-By Name &amp; Role: ______________________________________ &nbsp; Review Date: ___________________
  </div>
</article>`;
  };

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Phase 3 Whole-Syllabus Faculty Review Package (DRAFT)</title>
<style>
body{font:14px/1.5 system-ui,sans-serif;margin:0 auto;max-width:1180px;padding:16px 20px;color:#1b1f3a}
.warn{background:#fff3d6;border:1px solid #e0b04a;padding:12px 16px;border-radius:8px;margin-bottom:16px}
.rev{background:#eef4ff;border:1px solid #9ab6e8;padding:12px 16px;border-radius:8px;margin-bottom:16px}
article.record{border:1px solid #cfd3e6;border-left:6px solid #9a6a1a;border-radius:8px;padding:12px 16px;margin:14px 0;break-inside:avoid}
article.record.open{border-left-color:#c93b2b;background:#fffafa}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:8px 0}
pre{white-space:pre-wrap;word-break:break-word;background:#f4f5fa;padding:8px;border-radius:6px;margin:4px 0;font:12.5px/1.4 ui-monospace,monospace}
.badge{font-size:12.5px;color:#333;margin:4px 0}
.prov{font-size:12px;color:#6b4c00;margin:4px 0}
.box{border:1px dashed #666;padding:8px 12px;border-radius:6px;margin-top:8px;background:#fcfcfe}
@media(max-width:760px){.grid{grid-template-columns:1fr}}
</style></head><body>
<h1>Stage E.9 Phase 3 — Whole-Syllabus Faculty Review Package (DRAFT)</h1>
<div class="warn">
  <b>IMPORTANT — ALL EXPECTATIONS ARE DEVELOPER-WRITTEN DRAFTS:</b> Every expected finding in this package is marked <code>${escHtml(DRAFT_STATUS)}</code>. None of these expectations has been approved by faculty (` +
    `<code>autoPopulatedFacultyVerdicts: 0</code>). The 18-week lesson plans are synthetic test fixtures, and the BSIT-CYBERSECURITY (2025-2026) CS-301 curriculum row is a transcription whose institutional approval is not confirmed offline.
</div>
<div class="rev">
  <h2>Section 4: Academic Recommendation Review Considerations (${pkg.academicRecommendationReview.length} Topics)</h2>
  ${pkg.academicRecommendationReview
    .map(
      item => `<p><b>${escHtml(item.title)}</b> (<code>${escHtml(item.id)}</code>; cases: ${escHtml(item.referenceCases.join(', '))})<br>
  <i>Current behavior:</i> ${escHtml(item.currentBehavior)}<br>
  <i>Faculty review question (${escHtml(item.decisionOwner)}):</i> ${escHtml(item.facultyQuestion)}</p>`
    )
    .join('\n')}
</div>
${programs
  .map(progLabel => {
    const mine = pkg.records.filter(r => `${r.program} (${r.curriculumVersion}) — ${r.courseCode} ${r.courseTitle}` === progLabel);
    return `<section><h2>${escHtml(progLabel)} (${mine.length} review records)</h2>${mine.map(renderCard).join('\n')}</section>`;
  })
  .join('\n')}
</body></html>`;
}

function renderFacultyReviewReadme(pkg) {
  return `# Stage E.9 Phase 3 — Whole-Syllabus Faculty Review Package

Generated offline by \`node scripts/export-phase3-faculty-review.cjs\` from \`server/lib/syllabuscheck/eval/phase3/manifest-phase3-1.json\` (manifest SHA-256: \`${pkg.manifestSha256}\`).

- **Status:** \`${pkg.status}\`
- **Offline execution:** \`true\` (zero AI provider calls, zero database access)
- **Auto-populated faculty verdicts:** \`0\` (all \`facultyJudgment\`, \`facultyExplanation\`, \`reviewedByRole\`, and \`reviewDate\` fields are blank for faculty completion)
- **Total review records:** \`${pkg.counts.totalRecords}\` (\`${pkg.counts.defectExpectationRecords}\` declarative defect expectations + \`${pkg.counts.openAdjudicationRecords}\` open adjudication item + \`${pkg.counts.deterministicEdgeRecords}\` deterministic/identity edge cases across \`${pkg.counts.defectsCount}\` defects and \`${pkg.counts.edgesCount}\` edges)

## Files in This Package
- \`phase3-faculty-review.json\`: Structured machine-readable records with full provenance, original vs. modified content, CLO/ILO context, expected findings, verbatim evidence quotes, upstream dependencies, suggested recommendations, academic recommendation review considerations, and blank faculty sign-off fields.
- \`phase3-faculty-review.csv\`: UTF-8 spreadsheet (opens in Excel) with one row per review record and dedicated columns for faculty judgment, explanation, reviewer role, and review date.
- \`phase3-faculty-review.html\`: Printable browser view grouped by program, course, and curriculum version.
- \`README.md\`: Review instructions, provenance disclosures, and Academic Recommendation Review considerations.

## Provenance and Institutional Approval Disclosures
- **BSIT (\`2022-2023\`, \`IT 202\`), BSIE (\`2022-2023\`, \`IE-402\`), BSCpE (\`2022-2023\`, \`CpE-304\`)**: Course identity and Program Outcomes/EGAs come from the repository's transcriptions (\`server/db/local-curriculum-data.cjs\`, \`server/db/local-outcome-data.cjs\`). The 18-week lesson plans, descriptions, CLOs, and references are **synthetic** and written for evaluation testing.
- **BSIT-CYBERSECURITY (\`2025-2026\`, \`CS-301 Introduction to Digital Forensics\`)**: Both the 18-week syllabus plan and the offline curriculum status are synthetic/unconfirmed (\`syllabusSynthetic: true\`, \`identityStatus: "transcribed_approval_not_confirmed"\`). It uses the shared BSIT Program Outcomes and EGAs (\`outcomeSource: "BSIT"\`) without executing the \`program_outcome_sources\` migration.

## Academic Recommendation Review Considerations (Section 4)
${pkg.academicRecommendationReview
  .map(
    (item, idx) => `### ${idx + 1}. ${item.title} (\`${item.id}\`)
- **Reference cases:** ${item.referenceCases.join(', ')}
- **Current behavior:** ${item.currentBehavior}
- **Question for faculty / QA (${item.decisionOwner}):** ${item.facultyQuestion}
- **Status:** ${item.status}`
  )
  .join('\n\n')}
`;
}

async function writePhase3FacultyReviewPackage(outDir, options = {}) {
  const pkg = await buildPhase3FacultyReviewPackage(options);
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'phase3-faculty-review.json');
  const csvPath = path.join(outDir, 'phase3-faculty-review.csv');
  const htmlPath = path.join(outDir, 'phase3-faculty-review.html');
  const readmePath = path.join(outDir, 'README.md');

  fs.writeFileSync(jsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  fs.writeFileSync(csvPath, renderFacultyReviewCsv(pkg), 'utf8');
  fs.writeFileSync(htmlPath, renderFacultyReviewHtml(pkg), 'utf8');
  fs.writeFileSync(readmePath, renderFacultyReviewReadme(pkg), 'utf8');

  return {
    outDir,
    files: { jsonPath, csvPath, htmlPath, readmePath },
    package: pkg,
  };
}

module.exports = {
  DRAFT_STATUS,
  ACADEMIC_RECOMMENDATION_REVIEW,
  CSV_COLUMNS,
  buildPhase3FacultyReviewPackage,
  renderFacultyReviewCsv,
  renderFacultyReviewHtml,
  renderFacultyReviewReadme,
  writePhase3FacultyReviewPackage,
};
