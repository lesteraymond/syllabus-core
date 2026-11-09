import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import ComplianceCard from '../src/views/ComplianceCard';
import CoordinatedPlanPanel from '../src/components/CoordinatedPlanPanel';
import { setLanguage, t } from '../src/i18n';

test.afterEach(() => setLanguage('en'));

const mockPlan = {
  planId: 'plan_walkthrough_test_123',
  sourceHash: 'hash_original_draft_501',
  status: 'VERIFIED',
  rootCauses: [
    {
      id: 'rc_offtopic_w4',
      kind: 'off_topic_content',
      week: 4,
      title: 'Off-Topic Course Content',
      explanation: 'Week 4 course content on 19th Century French Poetry does not align with the course title Logic Circuits and Design.',
      affectedFields: ['course_content', 'ilos', 'activities', 'tasks']
    },
    {
      id: 'rc_ilo_w7',
      kind: 'ilo_misalignment',
      week: 7,
      title: 'Constructive Alignment Conflict',
      explanation: 'The ILO requires memorizing inventor birth years, failing to develop synthesis and design skills for Combinational Arithmetic Adders.',
      affectedFields: ['ilos', 'activities', 'tasks']
    },
    {
      id: 'rc_clo_w11',
      kind: 'clo_mapping_error',
      week: 11,
      title: 'Program Outcome / CLO Incomplete Mapping',
      explanation: 'Course Learning Outcome CLO 3 is unmapped in the lesson plan; sequential latch topics should map to CLO 3.',
      affectedFields: ['clos', 'ilos']
    }
  ],
  changes: [
    {
      changeId: 'chg_1',
      field: 'course_content',
      path: 'plan[3].contents',
      originalValue: '19th Century French Poetry and Romanticist Literary Stylistics',
      proposedValue: 'Karnaugh Maps (K-Maps) and Boolean Simplification: 3-variable and 4-variable minimization techniques',
      explanation: 'Replace off-topic literature topic with core digital logic curriculum module.',
      affectedRelationships: ['Content-course', 'Content-ILO', 'Content-activity', 'Content-assessment']
    },
    {
      changeId: 'chg_2',
      field: 'ilo',
      path: 'plan[6].ilos[0].text',
      originalValue: 'Memorize the biographical birth years of early computing inventors.',
      proposedValue: 'Analyze, design, and simulate half adder and full adder combinational logic circuits.',
      explanation: 'Upgrade cognitive level to engineering synthesis aligned with course outcomes.',
      affectedRelationships: ['Content-ILO', 'ILO-CLO', 'ILO-activity']
    },
    {
      changeId: 'chg_3',
      field: 'clo_mapping',
      path: 'plan[10].ilos[0].tags',
      originalValue: ['clo:c1'],
      proposedValue: ['clo:c3'],
      explanation: 'Map Sequential Circuits to CLO 3 (Sequential Logic Implementation) to ensure complete outcome coverage.',
      affectedRelationships: ['ILO-CLO']
    }
  ],
  preservations: [
    {
      path: 'plan[1].values',
      originalValue: 'Courage, Integrity',
      reason: 'Faculty-selected institutional core values preserved without modification.'
    }
  ],
  unresolvedIssues: [],
  validation: {
    status: 'VERIFIED',
    deterministicChecksPass: true,
    overallEvaluated: true,
    summaryText: 'All proposed corrections are academically coordinated, conflict-free, and preserve institutional standards.'
  }
};

const mockRun = {
  id: 1,
  syllabusId: 501,
  overall: 85,
  passThreshold: 79,
  band: 'Compliant',
  standard: 'Undergraduate Syllabus v4',
  createdAt: new Date().toISOString(),
  findings: [],
  recommendations: [],
  hybrid: {
    ruleCoverage: { compliant: 47, total: 47 },
    improvementPlan: mockPlan,
    baseScore: 100,
    deductions: [],
    suggestions: [],
    alignment: { status: 'completed' }
  }
};

test('[COORD-UI-1] Renders single CoordinatedPlanPanel inside ComplianceCard at top position', () => {
  const html = renderToStaticMarkup(<ComplianceCard run={mockRun} onApplyDraft={async () => true} />);
  assert.ok(html.includes('Whole-Syllabus Improvement Plan'), 'Panel title rendered');
  assert.ok(html.includes('plan_walkthrough_test_123'), 'Plan ID rendered');
  assert.ok(html.includes('hy-pill ok'), 'Status badge class rendered');
  assert.ok(html.includes('VERIFIED'), 'Status text rendered');
});

test('[COORD-UI-2] Displays Root Causes with explanations and affected fields', () => {
  const html = renderToStaticMarkup(<CoordinatedPlanPanel run={mockRun} onPlanApplied={() => {}} />);
  assert.ok(html.includes('Detected Academic Conflicts &amp; Root Causes (3)'), 'Root causes count rendered');
  assert.ok(html.includes('Off-Topic Course Content'), 'Off-topic title rendered');
  assert.ok(html.includes('Constructive Alignment Conflict'), 'Constructive alignment title rendered');
  assert.ok(html.includes('Program Outcome / CLO Incomplete Mapping'), 'CLO mapping title rendered');
  assert.ok(html.includes('Week 4'), 'Week 4 reference rendered');
  assert.ok(html.includes('Week 7'), 'Week 7 reference rendered');
  assert.ok(html.includes('course_content'), 'Affected field course_content rendered');
  assert.ok(html.includes('ilos'), 'Affected field ilos rendered');
});

test('[COORD-UI-3] Displays Preservations box for institutional core values', () => {
  const html = renderToStaticMarkup(<CoordinatedPlanPanel run={mockRun} onPlanApplied={() => {}} />);
  assert.ok(html.includes('Institutional Standards &amp; Values Preserved'), 'Preservations heading rendered');
  assert.ok(html.includes('plan[1].values'), 'Path plan[1].values rendered');
  assert.ok(html.includes('Faculty-selected institutional core values preserved'), 'Preservation reason rendered');
});

test('[COORD-UI-4] Displays Proposed Changes with Side-by-Side Diff and Monospace formatting', () => {
  const html = renderToStaticMarkup(<CoordinatedPlanPanel run={mockRun} onPlanApplied={() => {}} />);
  assert.ok(html.includes('Connected Recommended Corrections (3)'), 'Proposed changes heading rendered');
  assert.ok(html.includes('19th Century French Poetry'), 'Original value rendered');
  assert.ok(html.includes('Karnaugh Maps'), 'Proposed value rendered');
  assert.ok(html.includes('Memorize the biographical birth years'), 'Original ILO rendered');
  assert.ok(html.includes('Analyze, design, and simulate half adder'), 'Proposed ILO rendered');
  assert.ok(html.includes('COURSE_CONTENT'), 'Field tag COURSE_CONTENT rendered');
  assert.ok(html.includes('ILO'), 'Field tag ILO rendered');
  assert.ok(html.includes('CLO_MAPPING'), 'Field tag CLO_MAPPING rendered');
  assert.ok(html.includes('Original Syllabus'), 'Original label rendered');
  assert.ok(html.includes('Proposed Syllabus'), 'Proposed label rendered');
});

test('[COORD-UI-5] Action bar shows count of approved changes and Apply All button', () => {
  const html = renderToStaticMarkup(<CoordinatedPlanPanel run={mockRun} onPlanApplied={() => {}} />);
  assert.ok(html.includes('3 of 3 changes approved to apply.'), 'Approved changes count rendered');
  assert.ok(html.includes('Apply All Approved Changes'), 'Apply All button label rendered');
});

test('[COORD-UI-6] Displays Needs Faculty Review badge and unresolved notice when semantic judgment requires human input', () => {
  const reviewPlan = {
    ...mockPlan,
    status: 'NEEDS_FACULTY_REVIEW',
    validation: {
      status: 'NEEDS_FACULTY_REVIEW',
      deterministicChecksPass: true,
      overallEvaluated: true,
      summaryText: 'Candidate syllabus passes all 47 deterministic structural rules. 1 change(s) require faculty review for non-core values.'
    },
    changes: [
      {
        ...mockPlan.changes[0],
        semanticUnverified: true
      }
    ],
    unresolvedIssues: [
      {
        code: 'non_core_value_review',
        message: 'Week 4 value "Compassion" requires faculty review.'
      }
    ]
  };
  const runWithReview = {
    ...mockRun,
    hybrid: {
      ...mockRun.hybrid,
      improvementPlan: reviewPlan
    }
  };
  const html = renderToStaticMarkup(<CoordinatedPlanPanel run={runWithReview} onPlanApplied={() => {}} />);
  assert.ok(html.includes('NEEDS FACULTY REVIEW'), 'Needs Faculty Review badge rendered');
  assert.ok(html.includes('Unresolved Conflicts'), 'Unresolved notice heading rendered');
  assert.ok(html.includes('non_core_value_review'), 'Unresolved code rendered');
  assert.ok(html.includes('Week 4 value &quot;Compassion&quot; requires faculty review.'), 'Unresolved message rendered');
});

test('[COORD-UI-7] Displays clean state when no improvements are required', () => {
  const cleanPlan = {
    ...mockPlan,
    changes: [],
    rootCauses: [],
    preservations: [],
    unresolvedIssues: []
  };
  const runClean = {
    ...mockRun,
    hybrid: {
      ...mockRun.hybrid,
      improvementPlan: cleanPlan
    }
  };
  const html = renderToStaticMarkup(<CoordinatedPlanPanel run={runClean} onPlanApplied={() => {}} />);
  assert.ok(html.includes('This syllabus is fully aligned. No coordinated corrections are required.'), 'Clean state message rendered');
});

test('[COORD-UI-8] Renders cleanly in Filipino (tr/t) without broken English fragments', () => {
  setLanguage('tl');
  const html = renderToStaticMarkup(<CoordinatedPlanPanel run={mockRun} onPlanApplied={() => {}} />);
  assert.ok(html.includes('Plano sa Pagpapahusay ng Buong Silabus'), 'Filipino title rendered');
  assert.ok(html.includes('Mga Natukoy na Salungatan at Pangunahing Sanhi'), 'Filipino root causes rendered');
  assert.ok(html.includes('Mga Nakaugnay na Mungkahing Pagwawasto'), 'Filipino proposed changes rendered');
  assert.ok(html.includes('Ilapat ang Lahat ng Aprubadong Pagbabago'), 'Filipino apply button rendered');
});
