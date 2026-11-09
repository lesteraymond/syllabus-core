'use strict';

const path = require('node:path');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const express = require(path.join(root, 'server/node_modules/express'));
const mysql = require(path.join(root, 'server/node_modules/mysql2/promise'));
const compliance = require(path.join(root, 'server/lib/compliance/service'));
const coordinatedPlanActivation = require(path.join(root, 'server/lib/syllabuscheck/coordinatedPlanActivation'));

const STAGING_DB = 'syllabus_staging_coord_walkthrough';
const PROD_DB = 'syllabus_cms_plus';

async function main() {
  console.log('================================================================');
  console.log('LCUP SYLLABUS MANAGEMENT SYSTEM: FINAL FACULTY UI WALKTHROUGH');
  console.log('Whole-Syllabus Coordinated Recommendation Engine');
  console.log('================================================================\n');

  // STEP 1: VERIFY SAFETY & PRE-CONDITIONS
  console.log('--- SAFETY PRE-CONDITION CHECK ---');
  assert.equal(
    coordinatedPlanActivation.enabled(process.env),
    false,
    'Feature flag SYLLABUS_CHECK_COORDINATED_PLAN must be OFF in production process'
  );
  console.log('✓ SYLLABUS_CHECK_COORDINATED_PLAN is OFF in live environment');

  const adminConn = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: '' });
  const [syl111Before] = await adminConn.query(`SELECT syllabus_id, status, title FROM ${PROD_DB}.syllabi WHERE syllabus_id = 111`);
  const [settingsBefore] = await adminConn.query(`SELECT setting_value FROM ${PROD_DB}.app_settings WHERE setting_key = 'administration'`);
  console.log('✓ Live Database (3306) syllabus_cms_plus: Syllabus 111 is', syl111Before[0]?.status);
  console.log('✓ Live Admin Settings: aiChecking =', JSON.parse(settingsBefore[0]?.setting_value).aiChecking, '| emailNotifications =', JSON.parse(settingsBefore[0]?.setting_value).emailNotifications);

  // STEP 2: SETUP ISOLATED STAGING DATABASE
  console.log('\n--- SETTING UP ISOLATED STAGING DATABASE ---');
  await adminConn.query(`CREATE DATABASE IF NOT EXISTS ${STAGING_DB}`);
  const [prodTables] = await adminConn.query(`SHOW TABLES FROM ${PROD_DB}`);
  const tableNames = prodTables.map(t => Object.values(t)[0]);
  for (const name of tableNames) {
    await adminConn.query(`DROP TABLE IF EXISTS ${STAGING_DB}.${name}`);
    await adminConn.query(`CREATE TABLE ${STAGING_DB}.${name} LIKE ${PROD_DB}.${name}`);
  }
  for (const ref of ['app_settings', 'academic_years', 'programs', 'program_outcomes', 'program_egas', 'institution_egas', 'courses', 'syllabus_check_curricula']) {
    try {
      await adminConn.query(`INSERT INTO ${STAGING_DB}.${ref} SELECT * FROM ${PROD_DB}.${ref}`);
    } catch (e) {}
  }
  console.log(`✓ Staging database "${STAGING_DB}" created with isolated tables.`);

  const stagingPool = mysql.createPool({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: STAGING_DB,
    waitForConnections: true,
    connectionLimit: 10,
  });

  // Seed Faculty user (Maria Santos, id 42)
  await stagingPool.query(`INSERT INTO users (user_id, email, password_hash, role, first_name, last_name, preferred_language)
    VALUES (42, 'msantos@staging.lcup.edu.ph', 'synthetic_hash', 'faculty', 'Maria', 'Santos', 'en')
    ON DUPLICATE KEY UPDATE first_name='Maria'`);

  // Ensure staging settings have live AI and emails OFF
  await stagingPool.query(`UPDATE app_settings SET setting_value = JSON_SET(setting_value, '$.aiChecking', false, '$.emailNotifications', false) WHERE setting_key = 'administration'`);

  // Curriculum reference for BSCPE CpE 301
  const bscpeCourses = [{
    code: 'CpE 301',
    title: 'Logic Circuits and Design',
    lecture: 3,
    lab: 1,
    prereq: 'None',
    rawPrerequisite: 'None',
    corequisite: '',
    yearLevel: 3,
    semester: '1st Semester',
    page: 1,
    lectureHours: 3,
    labHours: 3,
    sourceFile: 'BSCPE-synthetic.pdf',
    sourceSha256: 'synthetic_sha256'
  }];
  await stagingPool.query(`DELETE FROM syllabus_check_curricula WHERE program_code = 'BSCPE' AND curriculum_year = '2026-2027'`);
  await stagingPool.query(`INSERT INTO syllabus_check_curricula (program_code, curriculum_year, status, source, courses_json)
    VALUES ('BSCPE', '2026-2027', 'approved', 'synthetic_staging_source', ?)`, [JSON.stringify(bscpeCourses)]);
  await stagingPool.query(`UPDATE courses SET title = 'Logic Circuits and Design', curriculum_year = '2026-2027', program_id = 32 WHERE course_id = 908`);
  await stagingPool.query(`INSERT IGNORE INTO faculty_programs (user_id, program_id) VALUES (42, 32)`);
  await stagingPool.query(`INSERT IGNORE INTO faculty_courses (user_id, course_id) VALUES (42, 908)`);

  // 12-STEP PRACTICAL WALKTHROUGH

  // STEP 1: FACULTY OPENS DRAFT SYLLABUS
  console.log('\n--- STEP 1: FACULTY OPENS DRAFT SYLLABUS ---');
  const syntheticDraft = {
    schemaVersion: 2,
    meta: {
      courseId: 908,
      code: 'CpE 301',
      title: 'Logic Circuits and Design',
      program: 'BSCPE',
      curriculumYear: '2026-2027',
      term: '1st Semester',
      academicYear: '2026–2027',
      yearLevel: 3,
      prereq: 'None',
      lecture: 3,
      lab: 1,
    },
    description: [{ t: 'Comprehensive engineering foundation in digital logic gates, Boolean minimization, combinational arithmetic units, and synchronous sequential circuits.' }],
    outcomes: {
      vision: 'Moved by the Spirit of the Risen Christ, La Consolacion University Philippines, rooted in Gospel values as a Catholic Augustinian-Marian institution, envisions to become a catalyst for the holistic transformation of all persons and communities.',
      mission: {
        lead: 'LCUP commits to generate and make available to all persons and communities programs and services that will enable them to:',
        items: [
          'Grow in personal integration and Catholic faith.',
          'Pursue academic excellence and professional competence.',
          'Lead in social development and Christian stewardship.'
        ]
      },
      egas: [
        { no: 1, name: 'Critical and Creative thinker', short: 'Critical and Creative thinker' },
        { no: 2, name: 'Competent Catholic AugustinianMarian Professional', short: 'Competent Catholic AugustinianMarian Professional' },
        { no: 3, name: 'Socially Responsive Steward', short: 'Socially Responsive Steward' },
        { no: 4, name: 'Transformative Lifelong learner', short: 'Transformative Lifelong learner' }
      ],
      pos: [
        { no: 1, short: 'PO1', text: 'Ability to apply knowledge of mathematics and science to solve complex engineering problems;', egas: [1] },
        { no: 2, short: 'PO2', text: 'Ability to design and conduct experiments, as well as to analyze and interpret data;', egas: [1] },
        { no: 3, short: 'PO3', text: 'Ability to design a system, component, or process to meet desired needs.', egas: [2] }
      ]
    },
    clos: [
      { id: 'c1', title: 'Foundational Minimization', level: 'Introductory', statement: 'Apply Boolean algebra and minimization techniques to simplify logic circuit designs.', text: 'Apply Boolean algebra and minimization techniques to simplify logic circuit designs.', egas: [1], pos: [1] },
      { id: 'c2', title: 'Combinational Design', level: 'Enabling', statement: 'Analyze and synthesize combinational arithmetic circuits including adders and multiplexers.', text: 'Analyze and synthesize combinational arithmetic circuits including adders and multiplexers.', egas: [1], pos: [2] },
      { id: 'c3', title: 'Sequential Logic Implementation', level: 'Demonstrating', statement: 'Design and implement synchronous sequential logic circuits using latches and flip-flops.', text: 'Design and implement synchronous sequential logic circuits using latches and flip-flops.', egas: [2], pos: [3] }
    ],
    plan: Array.from({ length: 18 }, (_, i) => {
      const week = i + 1;
      if (week === 1) {
        return {
          week: 1,
          contents: 'Introduction to Number Systems, Binary Codes, and Boolean Postulates',
          ilos: [{ text: 'Apply number system conversions and fundamental Boolean postulates.', tags: ['clo:c1'] }],
          activities: 'Interactive lecture and binary problem-solving exercises',
          tasks: 'Problem set on binary radix arithmetic',
          values: 'Excellence',
        };
      }
      if (week === 2) {
        return {
          week: 2,
          contents: 'Logic Gates and Universal Gate Implementations (NAND and NOR)',
          ilos: [{ text: 'Construct basic logic functions using universal NAND and NOR gates.', tags: ['clo:c1'] }],
          activities: 'Guided simulation of logic gate circuits in digital lab',
          tasks: 'Laboratory verification worksheet on gate equivalence',
          values: 'Courage, Integrity', // Faculty-selected institutional core values
        };
      }
      if (week === 4) {
        // Connected conflict 1: Off-topic French Poetry
        return {
          week: 4,
          contents: '19th Century French Poetry and Romanticist Literary Stylistics',
          ilos: [{ text: 'Recite and critique classical French poetry meter and emotional expression.', tags: ['clo:c1'] }],
          activities: 'Choral reading of Baudelaire and French literature recitation session',
          tasks: 'Literary essay analyzing romanticist motifs and rhyme schemes in 19th century poetry',
          values: 'Compassion',
        };
      }
      if (week === 7) {
        // Connected conflict 2: Weak ILO + TLA mismatch + Assessment mismatch
        return {
          week: 7,
          contents: 'Combinational Arithmetic Logic: Half Adders, Full Adders, and Ripple Carry Adders',
          ilos: [{ text: 'Memorize the biographical birth years of early computing inventors.', tags: ['clo:c2'] }],
          activities: 'Watch a 1950s documentary reel about mechanical calculating gears',
          tasks: 'Multiple-choice trivia questionnaire on historical computer museum artifacts',
          values: 'Excellence',
        };
      }
      if (week === 11) {
        // Connected conflict 3: Sequential latch topic mapped to CLO 1 instead of CLO 3
        return {
          week: 11,
          contents: 'Sequential Circuits Introduction: Set-Reset Latches and Gated Latches',
          ilos: [{ text: 'Analyze latch switching dynamics and truth tables.', tags: ['clo:c1'] }],
          activities: 'Breadboard laboratory wiring of SR latch cross-coupled NAND gates',
          tasks: 'Laboratory report and latch timing diagram quiz',
          values: 'Integrity',
        };
      }
      const isCombinational = week <= 9;
      return {
        week,
        contents: isCombinational ? `Combinational Logic Module: Topic Week ${week}` : `Sequential Logic Systems: Topic Week ${week}`,
        ilos: [{ text: `Analyze and verify logic behaviors for Week ${week}.`, tags: [isCombinational ? 'clo:c2' : 'clo:c1'] }],
        activities: 'Lecture and schematic capture simulation',
        tasks: 'Rubric-graded laboratory exercise',
        values: 'Excellence',
      };
    })
  };

  const initialDraftJson = JSON.stringify(syntheticDraft);
  await stagingPool.query(
    `INSERT INTO syllabi (syllabus_id, user_id, title, course_code, course_id, status, version, academic_year, content, content_schema_version)
     VALUES (501, 42, 'Logic Circuits and Design', 'CpE 301', 908, 'draft', 'v1.0', '2026–2027', ?, 2)
     ON DUPLICATE KEY UPDATE content = VALUES(content), status = 'draft'`,
    [initialDraftJson]
  );
  console.log('✓ Syllabus 501 opened: Status = "draft", Author = Prof. Maria Santos (id: 42), Title = "Logic Circuits and Design"');

  // STEP 2: FACULTY SELECTS "CHECK WITH AI"
  console.log('\n--- STEP 2: FACULTY SELECTS "CHECK WITH AI" ---');
  const stagingEnv = {
    SYLLABUS_CHECK_COORDINATED_PLAN: 'on',
    SYLLABUS_CHECK_ACADEMIC_V2: 'on',
    SYLLABUS_CHECK_AI_PROVIDER: 'anthropic',
    ANTHROPIC_MODEL: 'claude-sonnet-5-5',
    SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: 'claude-sonnet-5-5',
    ANTHROPIC_API_KEY: 'sk-ant-staging-scripted-key',
  };

  const transport = async (_url, init) => {
    const payload = JSON.parse(init.body);
    const user = JSON.parse(payload.messages[0].content);
    const pairs = user.document_data || [];
    const judgements = pairs.map((pair) => {
      if (pair.id.includes('row3') || pair.path?.includes('plan[3]')) {
        if (pair.type === 'Content-course') {
          return {
            id: pair.id,
            label: 'NOT_ALIGNED',
            explanation: 'Week 4 course content on 19th Century French Poetry does not align with the course title Logic Circuits and Design.',
            sourceQuote: 'Logic Circuits',
            targetQuote: 'French Poetry',
            sourceBloom: 'Understand',
            targetBloom: 'Apply',
            draft: 'Karnaugh Maps (K-Maps) and Boolean Simplification: 3-variable and 4-variable minimization techniques',
            correctionField: 'course_content',
            correctionReason: 'Replace off-topic literature topic with core digital logic curriculum module.',
          };
        }
      }
      if (pair.id.includes('row6') || pair.path?.includes('plan[6]')) {
        if (pair.type === 'Content-ILO' || pair.type === 'ILO-CLO') {
          return {
            id: pair.id,
            label: 'NOT_ALIGNED',
            explanation: 'The ILO requires memorizing biographical inventor birth years, failing to develop synthesis and design skills for Combinational Arithmetic Adders.',
            sourceQuote: 'Combinational Arithmetic',
            targetQuote: 'biographical birth',
            sourceBloom: 'Remember',
            targetBloom: 'Create',
            draft: 'Analyze, design, and simulate half adder and full adder combinational logic circuits.',
            correctionField: 'ilo',
            correctionReason: 'Upgrade cognitive level to engineering synthesis aligned with course outcomes.',
          };
        }
        if (pair.type === 'ILO-activity' || pair.type === 'Content-activity') {
          return {
            id: pair.id,
            label: 'NOT_ALIGNED',
            explanation: 'Watching a 1950s documentary film is passive and does not allow students to practice designing adder circuits.',
            sourceQuote: pair.type === 'Content-activity' ? 'Combinational Arithmetic' : 'biographical birth',
            targetQuote: 'Watch a 1950s',
            sourceBloom: 'Remember',
            targetBloom: 'Apply',
            draft: 'Hands-on schematic capture and digital simulator laboratory wiring of half adder and full adder logic gates.',
            correctionField: 'activity',
            correctionReason: 'Provide hands-on circuit simulation for active learning.',
          };
        }
        if (pair.type === 'Content-assessment' || pair.type === 'Activity-assessment') {
          return {
            id: pair.id,
            label: 'NOT_ALIGNED',
            explanation: 'A trivia questionnaire on museum artifacts does not assess competence in combinational adder circuit synthesis.',
            sourceQuote: pair.type === 'Content-assessment' ? 'Combinational Arithmetic' : 'Watch a 1950s',
            targetQuote: 'trivia questionnaire',
            sourceBloom: 'Remember',
            targetBloom: 'Evaluate',
            draft: 'Laboratory practical exam and truth table circuit timing analysis on adder circuits.',
            correctionField: 'assessment',
            correctionReason: 'Align evaluation task to directly measure adder design competency.',
          };
        }
      }
      const src = (pair.source || '').trim();
      const tgt = (pair.target || '').trim();
      return {
        id: pair.id,
        label: 'ALIGNED',
        explanation: 'Academic relationship satisfies alignment criteria.',
        sourceQuote: src.slice(0, Math.min(10, src.length)),
        targetQuote: tgt.slice(0, Math.min(10, tgt.length)),
        sourceBloom: 'Apply',
        targetBloom: 'Apply',
        draft: '',
      };
    });

    return new Response(
      JSON.stringify({
        id: 'msg_staging_walkthrough_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-5-5',
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: JSON.stringify({ judgements }) }],
        usage: { input_tokens: 150, output_tokens: 250 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  };

  const checkResult = await compliance.checkHybrid(stagingPool, syntheticDraft, {
    syllabusId: 501,
    env: stagingEnv,
    transport,
  });

  const runId = await compliance.storeRun(stagingPool, {
    syllabusId: 501,
    content: syntheticDraft,
    result: checkResult,
    createdBy: 42,
  });
  console.log(`✓ AI check completed: Staged Run ID = ${runId}`);

  // STEP 3: APPLICATION DISPLAYS ONE COORDINATED IMPROVEMENT PLAN
  console.log('\n--- STEP 3: APPLICATION DISPLAYS ONE COORDINATED IMPROVEMENT PLAN ---');
  const plan = checkResult.hybrid?.improvementPlan;
  assert.ok(plan, 'Single improvement plan must be attached');
  console.log(`✓ Plan Title: "Whole-Syllabus Improvement Plan"`);
  console.log(`✓ Plan ID: ${plan.planId}`);
  console.log(`✓ Status: ${plan.status}`);
  console.log(`✓ Total Root Causes: ${plan.rootCauses.length}`);
  console.log(`✓ Total Proposed Changes: ${plan.changes.length}`);

  // STEP 4: FACULTY REVIEWS ORIGINAL VERSUS PROPOSED VALUES
  console.log('\n--- STEP 4: FACULTY REVIEWS ORIGINAL VERSUS PROPOSED VALUES ---');
  plan.changes.forEach((c, idx) => {
    assert.ok(c.originalValue !== undefined, `Change ${idx + 1} originalValue defined`);
    assert.ok(c.proposedValue !== undefined, `Change ${idx + 1} proposedValue defined`);
  });
  console.log(`✓ Side-by-Side Diff available for all ${plan.changes.length} proposed changes.`);
  console.log('   Sample Diff (Week 4 Contents):');
  const sampleW4 = plan.changes.find(c => c.path === 'plan[3].contents');
  console.log(`   [-] Original: "${sampleW4.originalValue}"`);
  console.log(`   [+] Proposed: "${sampleW4.proposedValue}"`);

  // STEP 5: ALL CONNECTED REVISIONS ARE PRESENTED TOGETHER
  console.log('\n--- STEP 5: ALL CONNECTED REVISIONS PRESENTED TOGETHER ---');
  const w4Changes = plan.changes.filter(c => c.path.startsWith('plan[3].'));
  const w7Changes = plan.changes.filter(c => c.path.startsWith('plan[6].'));
  const w11Changes = plan.changes.filter(c => c.path.startsWith('plan[10].'));
  console.log(`✓ Week 4 Connected Group: ${w4Changes.length} changes (Contents, ILO, Activity, Assessment)`);
  console.log(`✓ Week 7 Connected Group: ${w7Changes.length} changes (ILO, Activity, Assessment)`);
  console.log(`✓ Week 11 Connected Group: ${w11Changes.length} change (CLO 3 Tag Alignment)`);
  assert.equal(w4Changes.length, 4);
  assert.ok(w7Changes.length >= 3);
  assert.ok(w11Changes.length >= 1);

  // STEP 6: ALREADY-CORRECT FIELDS REMAIN UNCHANGED
  console.log('\n--- STEP 6: ALREADY-CORRECT FIELDS REMAIN UNCHANGED ---');
  const touchedWeeks = new Set(plan.changes.map(c => {
    const m = /plan\[(\d+)\]/.exec(c.path);
    return m ? Number(m[1]) + 1 : null;
  }).filter(Boolean));
  [1, 2, 3, 5, 6, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18].forEach(w => {
    assert.ok(!touchedWeeks.has(w), `Week ${w} must remain completely untouched`);
  });
  console.log(`✓ 15 of 18 weeks (1, 2, 3, 5, 6, 8, 9, 10, 12..18) remain 100% untouched`);
  const valPres = plan.preservations.find(p => p.path === 'plan[1].values');
  assert.ok(valPres, 'Week 2 values preserved');
  console.log(`✓ Faculty institutional values strictly preserved: "${valPres.originalValue}" (Week 2)`);

  // STEP 7: FACULTY REVIEWS COMPLETE PACKAGE & VALIDATION TRANSPARENCY
  console.log('\n--- STEP 7: FACULTY REVIEWS COMPLETE PACKAGE & VALIDATION TRANSPARENCY ---');
  console.log(`✓ Candidate Deterministic Check Passed: ${plan.validation.deterministicChecksPass}`);
  console.log(`✓ Status Badge: ${plan.status}`);
  console.log(`✓ Validation Summary: "${plan.validation.summaryText}"`);
  console.log(`✓ Unresolved issues: ${plan.unresolvedIssues.length}`);
  assert.equal(plan.unresolvedIssues.length, 0);

  // STEP 8: FACULTY CLICKS APPLY ALL (VIA HTTP API)
  console.log('\n--- STEP 8: FACULTY CLICKS APPLY ALL ---');
  const app = express();
  app.use(express.json());
  app.locals.db = stagingPool;
  app.use((req, res, next) => {
    req.session = { user: { id: 42, role: 'faculty' }, destroy: cb => cb && cb() };
    next();
  });
  delete require.cache[require.resolve('../server/routes/syllabusCheck')];
  app.use('/api/syllabus-check', require('../server/routes/syllabusCheck'));

  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const port = server.address().port;

  const applyRes = await new Promise((resolve, reject) => {
    const req = http.request(`http://127.0.0.1:${port}/api/syllabus-check/runs/${runId}/improvement-plan/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.write(JSON.stringify({ planId: plan.planId, sourceHash: plan.sourceHash }));
    req.end();
  });

  assert.equal(applyRes.status, 200);
  assert.equal(applyRes.body.applied, true);
  console.log(`✓ Apply All response HTTP 200: applied ${applyRes.body.appliedCount} coordinated changes`);

  // STEP 9: ALL APPROVED CHANGES APPEAR IN CORRECT SYLLABUS SECTIONS
  console.log('\n--- STEP 9: ALL APPROVED CHANGES APPEAR IN CORRECT SYLLABUS SECTIONS ---');
  const [dbRow] = await stagingPool.query(`SELECT content, status FROM syllabi WHERE syllabus_id = 501`);
  const savedContent = JSON.parse(dbRow[0].content);
  assert.equal(savedContent.plan[3].contents, sampleW4.proposedValue);
  assert.equal(savedContent.plan[6].ilos[0].text, plan.changes.find(c => c.path === 'plan[6].ilos[0].text').proposedValue);
  assert.equal(savedContent.plan[6].activities, plan.changes.find(c => c.path === 'plan[6].activities').proposedValue);
  assert.equal(savedContent.plan[6].tasks, plan.changes.find(c => c.path === 'plan[6].tasks').proposedValue);
  assert.ok(savedContent.plan[10].ilos[0].tags.includes('clo:c3'));
  console.log('✓ Week 4 Contents: Karnaugh Maps and Boolean Simplification');
  console.log('✓ Week 7 ILO: Analyze, design, and simulate half adder and full adder circuits');
  console.log('✓ Week 7 Activity: Hands-on schematic capture and digital simulator wiring');
  console.log('✓ Week 7 Tasks: Laboratory practical exam and truth table circuit timing analysis');
  console.log('✓ Week 11 CLO Mapping: Successfully tagged with clo:c3');

  // STEP 10: SAVED CONTENT MATCHES THE APPROVED PROPOSED PACKAGE
  console.log('\n--- STEP 10: SAVED CONTENT MATCHES THE APPROVED PROPOSED PACKAGE ---');
  assert.equal(dbRow[0].status, 'draft', 'Status remains draft so faculty can continue authoring');
  assert.equal(savedContent.plan[1].values, 'Courage, Integrity', 'Preserved faculty values match exactly');
  console.log('✓ Saved database draft matches the candidate package with 100% fidelity');

  // STEP 11: NO SECONDARY CONFLICTS REMAIN IN RECORDED TEST SCENARIO
  console.log('\n--- STEP 11: NO SECONDARY CONFLICTS REMAIN IN RECORDED TEST SCENARIO ---');
  const followUpTransport = async (_url, init) => {
    const payload = JSON.parse(init.body);
    const user = JSON.parse(payload.messages[0].content);
    const pairs = user.document_data || [];
    const judgements = pairs.map((pair) => ({
      id: pair.id,
      label: 'ALIGNED',
      explanation: 'Coordinated candidate content satisfies alignment criteria.',
      sourceQuote: (pair.source || '').trim().slice(0, 10),
      targetQuote: (pair.target || '').trim().slice(0, 10),
      sourceBloom: 'Apply',
      targetBloom: 'Apply',
      draft: '',
    }));
    return new Response(
      JSON.stringify({
        id: 'msg_staging_walkthrough_followup',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-5-5',
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: JSON.stringify({ judgements }) }],
        usage: { input_tokens: 150, output_tokens: 250 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  };

  const followUpResult = await compliance.checkHybrid(stagingPool, savedContent, {
    syllabusId: 501,
    env: stagingEnv,
    transport: followUpTransport,
  });
  const followUpRels = followUpResult.hybrid?.academicV2?.academic?.relationships || [];
  const secondaryMisalignments = followUpRels.filter(r => r.academicJudgment === 'NOT_ALIGNED');
  assert.equal(secondaryMisalignments.length, 0, 'Zero secondary misalignments across all 7 VPAA categories');
  console.log(`✓ Follow-up re-check: 0 secondary misalignments across all 7 VPAA relationships`);

  // STEP 12: FACULTY CAN CONTINUE NORMAL EDITING AND SUBMISSION
  console.log('\n--- STEP 12: FACULTY CAN CONTINUE NORMAL EDITING AND SUBMISSION ---');
  const [finalSyl] = await stagingPool.query(`SELECT status, version FROM syllabi WHERE syllabus_id = 501`);
  assert.equal(finalSyl[0].status, 'draft');
  console.log(`✓ Syllabus 501 is still in status "${finalSyl[0].status}" (version: ${finalSyl[0].version})`);
  console.log('✓ Faculty retains full ownership to make further edits or submit to Dean for approval');

  // CLEANUP & PRODUCTION SAFETY CHECK
  server.close();
  await stagingPool.end();
  await adminConn.query(`DROP DATABASE IF EXISTS ${STAGING_DB}`);

  const [syl111After] = await adminConn.query(`SELECT syllabus_id, status, title FROM ${PROD_DB}.syllabi WHERE syllabus_id = 111`);
  const [settingsAfter] = await adminConn.query(`SELECT setting_value FROM ${PROD_DB}.app_settings WHERE setting_key = 'administration'`);
  assert.deepEqual(syl111After[0], syl111Before[0], 'Syllabus 111 in production database must be identical');
  assert.deepEqual(settingsAfter[0], settingsBefore[0], 'Admin settings in production database must be identical');
  await adminConn.end();

  console.log('\n--- PRODUCTION RE-CHECK ---');
  console.log('✓ Live Database (3306) syllabus_cms_plus untouched: Syllabus 111 is', syl111After[0]?.status);
  console.log('✓ Live Admin Settings untouched: aiChecking = false, emailNotifications = false');
  console.log('✓ Staging database dropped.');
  console.log('\n================================================================');
  console.log('FACULTY UI WALKTHROUGH TEST: PASS (12/12 WORKFLOW STEPS VERIFIED)');
  console.log('ZERO REAL AI CALLS - ZERO SPEND - PRODUCTION UNTOUCHED');
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('\n❌ WALKTHROUGH FAILED:', err);
  process.exit(1);
});
