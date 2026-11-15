'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { contentHash } = require('../compliance/hash');
const coordinatedPlanActivation = require('./coordinatedPlanActivation');
const coordinatedPlanEngine = require('./coordinatedPlanEngine');
const { VALIDATION_STATUS, buildPlan, applyChanges, getValue, setValue } = coordinatedPlanEngine;

function createBaseSyllabus() {
  return {
    schemaVersion: 2,
    meta: {
      courseId: 101,
      code: 'CpE 301',
      title: 'Logic Circuits and Design',
      program: 'BSCPE',
      curriculumYear: '2026-2027',
    },
    description: [{ t: 'Introduction to logic circuits, Boolean algebra, combinational and sequential digital systems.' }],
    clos: [
      { id: 'c1', text: 'Apply Boolean algebra to design and simplify digital logic circuits.' },
      { id: 'c2', text: 'Analyze and synthesize combinational arithmetic circuits.' },
      { id: 'c3', text: 'Design sequential logic circuits using latches and flip-flops.' },
    ],
    plan: Array.from({ length: 18 }, (_, i) => ({
      week: i + 1,
      contents: `Week ${i + 1} Principles of Logic Circuits`,
      ilos: [
        {
          text: `Describe core logic concepts for week ${i + 1}.`,
          tags: [`clo:c${(i % 2) + 1}`], // Note: clo:c3 intentionally omitted to test Scenario D
        },
      ],
      activities: 'Interactive lecture and problem exercises',
      tasks: 'Written quiz and homework problems',
      values: i === 1 ? 'Courage, Integrity' : 'Excellence',
    })),
  };
}

const mockMasters = {
  institution: {
    vision: 'A premier Catholic university...',
    mission: { lead: 'LCUP is committed to...', items: [] },
    values: ['Courage', 'Integrity', 'Excellence', 'Service'],
  },
  pos: [
    { no: 1, text: 'Apply engineering principles.' },
    { no: 2, text: 'Design complex computing systems.' },
  ],
  fingerprint: 'mock_fingerprint_hash_123',
};

test('Coordinated Plan - Feature Flag Isolation', () => {
  assert.equal(coordinatedPlanActivation.enabled({}), false);
  assert.equal(coordinatedPlanActivation.enabled({ SYLLABUS_CHECK_COORDINATED_PLAN: 'off' }), false);
  assert.equal(coordinatedPlanActivation.enabled({ SYLLABUS_CHECK_COORDINATED_PLAN: 'false' }), false);
  assert.equal(coordinatedPlanActivation.enabled({ SYLLABUS_CHECK_COORDINATED_PLAN: 'on' }), true);
  assert.equal(coordinatedPlanActivation.enabled({ SYLLABUS_CHECK_COORDINATED_PLAN: 'true' }), true);
});

test('Scenario A - Single-field isolated problem with no downstream dependencies', () => {
  const content = createBaseSyllabus();
  // Ensure all CLOs are covered so only the isolated suggestion is evaluated
  content.plan[5].ilos[0].tags.push('clo:c3');

  const result = {
    standard: { version: 'hybrid-2' },
    findings: [],
    hybrid: {
      suggestions: [
        {
          id: 'sug_desc_1',
          path: 'description[0].t',
          originalValue: content.description[0].t,
          replacement: 'Comprehensive study of logic circuits, Boolean algebra, combinational logic, and synchronous sequential circuits.',
          reason: 'Expand course overview to highlight modern digital hardware design.',
        },
      ],
    },
  };

  const plan = buildPlan({ content, masters: mockMasters, result, env: { SYLLABUS_CHECK_COORDINATED_PLAN: 'on' } });

  assert.ok(plan.planId.startsWith('plan_'));
  assert.equal(plan.changes.length, 1);
  assert.equal(plan.changes[0].path, 'description[0].t');
  assert.equal(plan.rootCauses.length, 1);
  assert.equal(plan.status, VALIDATION_STATUS.VERIFIED);
  assert.equal(plan.validation.deterministicChecksPass, true);
  assert.equal(plan.unresolvedIssues.length, 0);

  // Apply candidate
  const candidate = applyChanges(content, plan.changes);
  assert.equal(candidate.description[0].t, plan.changes[0].proposedValue);
});

test('Scenario B - ILO correction requiring coordinated Activity and Assessment adjustments', () => {
  const content = createBaseSyllabus();
  content.plan[5].ilos[0].tags.push('clo:c3');

  // Week 7 has an uncoordinated ILO that requires TLA and assessment coordination
  const result = {
    standard: { version: 'hybrid-2' },
    findings: [],
    hybrid: {
      academicV2: {
        academic: {
          relationships: [
            {
              id: 'rel_w7_ilo_clo',
              relationshipType: 'ILO-CLO',
              week: 7,
              path: 'plan[6].ilos[0].text',
              academicJudgment: 'PARTIALLY_ALIGNED',
            },
            {
              id: 'rel_w7_ilo_act',
              relationshipType: 'ILO-activity',
              week: 7,
              academicJudgment: 'NOT_ALIGNED',
            },
            {
              id: 'rel_w7_content_task',
              relationshipType: 'Content-assessment',
              week: 7,
              academicJudgment: 'NOT_ALIGNED',
            },
          ],
        },
      },
    },
  };

  const plan = buildPlan({ content, masters: mockMasters, result, env: { SYLLABUS_CHECK_COORDINATED_PLAN: 'on' } });

  assert.ok(plan.changes.length >= 3);
  const iloChange = plan.changes.find((c) => c.path === 'plan[6].ilos[0].text');
  const actChange = plan.changes.find((c) => c.path === 'plan[6].activities');
  const taskChange = plan.changes.find((c) => c.path === 'plan[6].tasks');

  assert.ok(iloChange, 'ILO change generated');
  assert.ok(actChange, 'Activity change generated');
  assert.ok(taskChange, 'Assessment change generated');

  assert.equal(iloChange.rootCauseId, actChange.rootCauseId);
  assert.equal(actChange.rootCauseId, taskChange.rootCauseId);

  const candidate = applyChanges(content, plan.changes);
  assert.equal(getValue(candidate, 'plan[6].ilos[0].text'), iloChange.proposedValue);
  assert.equal(getValue(candidate, 'plan[6].activities'), actChange.proposedValue);
  assert.equal(getValue(candidate, 'plan[6].tasks'), taskChange.proposedValue);
});

test('Scenario C - Off-topic lesson content requiring full module coordination', () => {
  const content = createBaseSyllabus();
  content.plan[5].ilos[0].tags.push('clo:c3');
  // Week 4 holds off-topic content
  content.plan[3].contents = '19th Century French Poetry and Literary Analysis';

  const result = {
    standard: { version: 'hybrid-2' },
    findings: [],
    hybrid: {
      academicV2: {
        academic: {
          relationships: [
            {
              id: 'rel_w4_content_course',
              relationshipType: 'Content-course',
              week: 4,
              path: 'plan[3].contents',
              academicJudgment: 'NOT_ALIGNED',
            },
          ],
        },
      },
      // Conflicting raw suggestion that would have preserved off-topic content
      suggestions: [
        {
          id: 'sug_offtopic_w4_legacy',
          path: 'plan[3].contents',
          replacement: 'Modern French Poetry and Symbolism',
          reason: 'Grammar polish on poetry',
        },
      ],
      suggestionsWithheld: [
        { id: 'sug_offtopic_w4_legacy', path: 'plan[3].contents' },
      ],
    },
  };

  const plan = buildPlan({ content, masters: mockMasters, result, env: { SYLLABUS_CHECK_COORDINATED_PLAN: 'on' } });

  const rootCause = plan.rootCauses.find((rc) => rc.kind === 'off_topic_content' && rc.week === 4);
  assert.ok(rootCause, 'Off-topic root cause identified for week 4');

  const contentChange = plan.changes.find((c) => c.path === 'plan[3].contents');
  const iloChange = plan.changes.find((c) => c.path === 'plan[3].ilos[0].text');
  const actChange = plan.changes.find((c) => c.path === 'plan[3].activities');
  const taskChange = plan.changes.find((c) => c.path === 'plan[3].tasks');

  assert.ok(contentChange && iloChange && actChange && taskChange, 'All 4 fields coordinated for off-topic week');
  assert.match(contentChange.proposedValue, /Boolean|Karnaugh|Logic/i, 'Replaced with on-topic curriculum content');
  assert.doesNotMatch(contentChange.proposedValue, /Poetry|French/i, 'No trace of off-topic poetry remains');

  // Verify no duplicate change for plan[3].contents
  const contentChanges = plan.changes.filter((c) => c.path === 'plan[3].contents');
  assert.equal(contentChanges.length, 1, 'Only one reconciled change for content path');
});

test('Scenario D - Unmapped CLO restored across syllabus weeks', () => {
  const content = createBaseSyllabus();
  // In base syllabus, clo:c3 is unmapped in all 18 weeks!

  const result = {
    standard: { version: 'hybrid-2' },
    findings: [],
    hybrid: { academicV2: { academic: { relationships: [] } } },
  };

  const plan = buildPlan({ content, masters: mockMasters, result, env: { SYLLABUS_CHECK_COORDINATED_PLAN: 'on' } });

  const cloRc = plan.rootCauses.find((rc) => rc.kind === 'clo_mapping_error');
  assert.ok(cloRc, 'CLO mapping gap identified');
  assert.match(cloRc.title, /CLO 3/);

  const cloChange = plan.changes.find((c) => c.field === 'clo_mapping');
  assert.ok(cloChange, 'CLO mapping change created');
  assert.ok(Array.isArray(cloChange.proposedValue));
  assert.ok(cloChange.proposedValue.includes('clo:c3'), 'clo:c3 added to week tags');

  // Candidate validation must show clo coverage restored
  const candidate = applyChanges(content, plan.changes);
  const allCandidateTags = candidate.plan.flatMap((r) => r.ilos.flatMap((i) => i.tags));
  assert.ok(allCandidateTags.includes('clo:c3'), 'Candidate contains clo:c3');
});

test('Scenario E - Multiple conflicts across different weeks consolidated in ONE plan', () => {
  const content = createBaseSyllabus();
  content.plan[5].ilos[0].tags.push('clo:c3');

  // Week 4: Off-topic
  content.plan[3].contents = 'Culinary Arts and Baking Fundamentals';
  // Week 11: Misaligned ILO
  content.plan[10].ilos[0].text = 'List names of famous computer scientists.';

  const result = {
    standard: { version: 'hybrid-2' },
    findings: [],
    hybrid: {
      academicV2: {
        academic: {
          relationships: [
            {
              id: 'rel_w4_content',
              relationshipType: 'Content-course',
              week: 4,
              path: 'plan[3].contents',
              academicJudgment: 'NOT_ALIGNED',
            },
            {
              id: 'rel_w11_ilo',
              relationshipType: 'ILO-CLO',
              week: 11,
              path: 'plan[10].ilos[0].text',
              academicJudgment: 'NOT_ALIGNED',
            },
            {
              id: 'rel_w11_act',
              relationshipType: 'ILO-activity',
              week: 11,
              academicJudgment: 'NOT_ALIGNED',
            },
          ],
        },
      },
    },
  };

  const plan = buildPlan({ content, masters: mockMasters, result, env: { SYLLABUS_CHECK_COORDINATED_PLAN: 'on' } });

  // Must contain root causes for both week 4 and week 11 in ONE improvement plan
  assert.ok(plan.rootCauses.some((rc) => rc.week === 4));
  assert.ok(plan.rootCauses.some((rc) => rc.week === 11));
  assert.ok(plan.changes.some((c) => c.path === 'plan[3].contents'));
  assert.ok(plan.changes.some((c) => c.path === 'plan[10].ilos[0].text'));
  assert.ok(plan.changes.some((c) => c.path === 'plan[10].activities'));
});

test('Scenario F - Reconciling conflicting Legacy and Policy V2 suggestions', () => {
  const content = createBaseSyllabus();
  content.plan[5].ilos[0].tags.push('clo:c3');

  const result = {
    standard: { version: 'hybrid-2' },
    findings: [],
    hybrid: {
      suggestions: [
        {
          id: 'legacy_sug_w2_ilo',
          path: 'plan[1].ilos[0].text',
          replacement: 'Legacy proposed wording for week 2 ILO.',
          priority: 1,
        },
      ],
      academicV2: {
        academic: {
          relationships: [
            {
              id: 'v2_w2_ilo_rel',
              relationshipType: 'Content-ILO',
              week: 2,
              path: 'plan[1].ilos[0].text',
              academicJudgment: 'NOT_ALIGNED',
            },
          ],
          suggestions: [
            {
              id: 'v2_sug_w2_ilo',
              path: 'plan[1].ilos[0].text',
              replacement: 'Policy V2 authoritative coordinated outcome for week 2.',
              priority: 5,
            },
          ],
        },
      },
    },
  };

  const plan = buildPlan({ content, masters: mockMasters, result, env: { SYLLABUS_CHECK_COORDINATED_PLAN: 'on' } });

  const w2Changes = plan.changes.filter((c) => c.path === 'plan[1].ilos[0].text');
  assert.equal(w2Changes.length, 1, 'Exactly one change retained for plan[1].ilos[0].text');
  assert.equal(w2Changes[0].proposedValue, 'Policy V2 authoritative coordinated outcome for week 2.');
});

test('Scenario G - Institutional Core-Value Preservation against AI substitution', () => {
  const content = createBaseSyllabus();
  content.plan[5].ilos[0].tags.push('clo:c3');
  // Week 2 has faculty-selected core values: 'Courage, Integrity'
  assert.equal(content.plan[1].values, 'Courage, Integrity');

  const result = {
    standard: { version: 'hybrid-2' },
    findings: [],
    hybrid: {
      suggestions: [
        {
          id: 'sug_ai_replace_values',
          path: 'plan[1].values',
          replacement: 'Innovation, Modernity, Efficiency',
          reason: 'AI thought these values sounded more high-tech.',
        },
      ],
    },
  };

  const plan = buildPlan({ content, masters: mockMasters, result, env: { SYLLABUS_CHECK_COORDINATED_PLAN: 'on' } });

  // AI substitution MUST be rejected and preserved
  const valueChange = plan.changes.find((c) => c.path === 'plan[1].values');
  assert.equal(valueChange, undefined, 'No change proposed for protected core value');

  const pres = plan.preservations.find((p) => p.path === 'plan[1].values');
  assert.ok(pres, 'Preservation recorded for plan[1].values');
  assert.match(pres.reason, /Preserved faculty-selected institutional core value/i);

  // Candidate must retain original values
  const candidate = applyChanges(content, plan.changes);
  assert.equal(candidate.plan[1].values, 'Courage, Integrity');
});

test('Scenario H - Already-aligned syllabus requiring no changes', () => {
  const content = createBaseSyllabus();
  content.plan[5].ilos[0].tags.push('clo:c3'); // All CLOs covered

  const result = {
    standard: { version: 'hybrid-2' },
    findings: [],
    hybrid: {
      suggestions: [],
      academicV2: {
        academic: {
          relationships: [
            { id: 'r1', relationshipType: 'Content-course', academicJudgment: 'ALIGNED' },
            { id: 'r2', relationshipType: 'ILO-CLO', academicJudgment: 'ALIGNED' },
          ],
        },
      },
    },
  };

  const plan = buildPlan({ content, masters: mockMasters, result, env: { SYLLABUS_CHECK_COORDINATED_PLAN: 'on' } });

  assert.equal(plan.changes.length, 0);
  assert.equal(plan.rootCauses.length, 0);
  assert.equal(plan.unresolvedIssues.length, 0);
  assert.equal(plan.status, VALIDATION_STATUS.VERIFIED);
  assert.match(plan.validation.summaryText, /academically coordinated/i);
});

test('Scenario I - Unverified semantic recommendations classified as NEEDS_FACULTY_REVIEW', () => {
  const content = createBaseSyllabus();
  content.plan[5].ilos[0].tags.push('clo:c3');

  const result = {
    standard: { version: 'hybrid-2' },
    findings: [],
    hybrid: {
      suggestions: [
        {
          id: 'sug_semantic_unverified',
          path: 'plan[4].ilos[0].text',
          replacement: 'Novel pedagogical formulation requiring live model verification.',
          semanticUnverified: true,
        },
      ],
    },
  };

  const plan = buildPlan({ content, masters: mockMasters, result, env: { SYLLABUS_CHECK_COORDINATED_PLAN: 'on' } });

  assert.equal(plan.status, VALIDATION_STATUS.NEEDS_FACULTY_REVIEW);
  assert.equal(plan.validation.status, VALIDATION_STATUS.NEEDS_FACULTY_REVIEW);
  assert.match(plan.validation.summaryText, /requiring faculty pedagogical review/i);
});

test('Scenario J - Atomic Faculty Apply All & Stale-Version Rejection', () => {
  const content = createBaseSyllabus();
  content.plan[5].ilos[0].tags.push('clo:c3');

  const result = {
    standard: { version: 'hybrid-2' },
    findings: [],
    hybrid: {
      suggestions: [
        {
          id: 'chg_sample_1',
          path: 'plan[0].activities',
          replacement: 'Interactive logic gates laboratory session with digital simulator.',
        },
        {
          id: 'chg_sample_2',
          path: 'plan[0].tasks',
          replacement: 'Design schematic simulation quiz on basic gates.',
        },
      ],
    },
  };

  const plan = buildPlan({ content, masters: mockMasters, result, env: { SYLLABUS_CHECK_COORDINATED_PLAN: 'on' } });

  // 1. Successful atomic application
  const updated = applyChanges(content, plan.changes);
  assert.equal(updated.plan[0].activities, 'Interactive logic gates laboratory session with digital simulator.');
  assert.equal(updated.plan[0].tasks, 'Design schematic simulation quiz on basic gates.');

  // 2. Partial approved selection support
  const partial = applyChanges(content, plan.changes, [plan.changes[0].changeId]);
  assert.equal(partial.plan[0].activities, 'Interactive logic gates laboratory session with digital simulator.');
  assert.equal(partial.plan[0].tasks, content.plan[0].tasks); // Unselected remains original!

  // 3. Stale version hash verification
  const originalHash = contentHash(content, 'hybrid-2');
  assert.equal(plan.sourceHash, originalHash);

  // Simulate concurrent faculty edit in another tab
  const driftedContent = structuredClone(content);
  driftedContent.plan[0].activities = 'Faculty just edited this in builder tab!';
  const driftedHash = contentHash(driftedContent, 'hybrid-2');

  assert.notEqual(driftedHash, plan.sourceHash, 'Drifted hash must differ from plan sourceHash');
});

// ---- Off-topic weeks are replaced from THIS syllabus, never from another course (the engine once proposed Logic Circuits topics for every course) ----
function programmingSyllabus() {
  return {
    schemaVersion: 2,
    meta: { courseId: 202, code: 'IT 202', title: 'Computer Programming 1', program: 'BSIT' },
    description: [{ t: 'Fundamentals of structured programming: variables, control structures, functions and arrays.' }],
    clos: [
      { id: 'p1', statement: 'Write programs that use variables, expressions and control structures.' },
      { id: 'p2', statement: 'Design functions that solve small problems.' },
      { id: 'p3', statement: 'Use arrays to store and process data.' },
    ],
    plan: Array.from({ length: 18 }, (_, i) => ({
      week: i + 1,
      contents: `Week ${i + 1} programming topic`,
      ilos: [{ text: `Write a short program for week ${i + 1}.`, tags: [`clo:p${(i % 3) + 1}`] }],
      activities: 'Laboratory exercise',
      tasks: 'Programming exercise',
      values: 'Excellence',
    })),
  };
}
const offTopicIn = (rows) => ({
  standard: { version: 'hybrid-2' }, findings: [],
  hybrid: { academicV2: { academic: { relationships: rows.map((r) => ({ id: `rel_w${r + 1}`, relationshipType: 'Content-course', week: r + 1, path: `plan[${r}].contents`, academicJudgment: 'NOT_ALIGNED' })) } } },
});
const ANOTHER_COURSE = /Logic|Boolean|Karnaugh|K-Map|circuit|Flip-Flop|Latch|Finite State|Adders|Hardware Registers|digital/i;

test('Off-topic weeks of a non-Logic course get replacements built from that course: its title and the CLO the week supports, never another course', () => {
  const content = programmingSyllabus();
  for (const r of [3, 6, 10, 14, 16]) content.plan[r].contents = '19th Century French Poetry';
  const plan = buildPlan({ content, masters: mockMasters, result: offTopicIn([3, 6, 10, 14, 16]), env: { SYLLABUS_CHECK_COORDINATED_PLAN: 'on' } });
  const offTopic = plan.changes.filter((c) => /^plan\[(3|6|10|14|16)\]\.(contents|ilos\[0\]\.text|activities|tasks)$/.test(c.path));
  assert.equal(offTopic.length, 20, 'four coordinated fields for each of the five weeks');
  for (const c of offTopic) {
    assert.doesNotMatch(String(c.proposedValue), ANOTHER_COURSE, `${c.path}: nothing from another course`);
    assert.doesNotMatch(String(c.proposedValue), /Poetry|French/i, `${c.path}: the off-topic text is gone`);
    assert.equal(c.semanticUnverified, true, `${c.path}: a draft for the faculty to finish, not a verified fix`);
  }
  for (const r of [3, 6, 10, 14, 16]) {
    const contents = plan.changes.find((c) => c.path === `plan[${r}].contents`).proposedValue;
    assert.match(contents, /Computer Programming 1/, 'names this course');
    const cloNo = (r % 3) + 1; // the CLO the week's ILO is tagged with
    assert.match(contents, new RegExp(`CLO ${cloNo} \\(`));
    assert.ok(contents.includes(content.clos[cloNo - 1].statement.replace(/\.$/, '')), 'quotes the CLO of this syllabus');
  }
  assert.equal(plan.validation.status, VALIDATION_STATUS.NEEDS_FACULTY_REVIEW, 'the package is never presented as verified');
  assert.doesNotMatch(JSON.stringify(plan.rootCauses), /official curriculum/i);
});

test('With no title or CLOs to draw on, the replacement says so instead of inventing a topic', () => {
  const content = programmingSyllabus();
  content.meta.title = '';
  content.clos = [];
  content.description = [];
  content.plan[3].contents = '19th Century French Poetry';
  const plan = buildPlan({ content, masters: mockMasters, result: offTopicIn([3]), env: { SYLLABUS_CHECK_COORDINATED_PLAN: 'on' } });
  const contents = plan.changes.find((c) => c.path === 'plan[3].contents');
  assert.ok(contents);
  assert.doesNotMatch(contents.proposedValue, ANOTHER_COURSE);
  assert.match(contents.proposedValue, /this course/i);
});

test('The engine holds no topic, outcome or activity text of any particular course', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, 'coordinatedPlanEngine.js'), 'utf8');
  assert.doesNotMatch(source, /Karnaugh|Flip-Flop|Logic Circuits|Finite State Machines|Adders, Subtractors|logic circuit problems|circuit design simulation/i);
});
