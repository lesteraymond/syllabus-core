'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..', '..');
const DATASET_FILE = path.join(ROOT, 'docs', 'lcup-faculty-validation-1', 'coordinator-only', 'validation-dataset.json');
const OUT_GS = path.join(ROOT, 'docs', 'verification', 'google-forms', 'generate-forms.gs');
const OUT_JSON = path.join(ROOT, 'docs', 'verification', 'google-forms', 'google-forms-cases.json');

const dataset = JSON.parse(fs.readFileSync(DATASET_FILE, 'utf8'));

// Verify Case Counts
const it202Cases = dataset.cases.filter(c => c.course.code === 'IT 202');
const ie402Cases = dataset.cases.filter(c => c.course.code === 'IE-402');
const cpe304Cases = dataset.cases.filter(c => c.course.code === 'CpE 304');

assert.equal(it202Cases.length, 7, 'IT 202 must have exactly 7 cases');
assert.equal(ie402Cases.length, 9, 'IE 402 must have exactly 9 cases');
assert.equal(cpe304Cases.length, 5, 'CpE 304 must have exactly 5 cases');
assert.equal(dataset.cases.length, 21, 'Total cases must be 21');

const cleanCase = c => ({
  caseId: c.caseId,
  courseCode: c.course.code,
  courseTitle: c.course.title,
  program: c.program,
  relationshipKey: c.relationship.key,
  relationshipName: c.relationship.name,
  week: c.week,
  lesson: c.lesson,
  statements: c.statements.map(s => ({
    role: s.role,
    text: s.text.trim()
  })),
  iloCloMapping: c.iloCloMapping ? {
    ilo: c.iloCloMapping.ilo,
    mappingAsPrinted: c.iloCloMapping.mappingAsPrinted,
    cloInThisRelationship: c.iloCloMapping.cloInThisRelationship,
    cloStatement: c.iloCloMapping.cloStatement,
    requiredClassification: c.iloCloMapping.requiredClassification,
    weeklyCourseContent: c.iloCloMapping.weeklyCourseContent
  } : null,
  weekContext: {
    content: c.weekRow?.content?.trim() || '',
    activities: c.weekRow?.activities?.trim() || '',
    assessment: c.weekRow?.assessment?.trim() || ''
  }
});

const bundled = {
  manifest: {
    source: 'LCUP Syllabus Management System — Academic Validation Pilot',
    datasetVersion: dataset.version,
    benchmarkHash: dataset.benchmark?.hash || null,
    totalCases: 21,
    distribution: {
      'IT 202': it202Cases.length,
      'IE-402': ie402Cases.length,
      'CpE 304': cpe304Cases.length
    }
  },
  courses: [
    {
      courseCode: 'IT 202',
      courseTitle: 'Computer Programming 1',
      program: 'BSIT',
      reviewerCodes: ['R-IT-01', 'R-IT-02'],
      adjudicatorCode: 'ADJ-IT-01',
      caseCount: 7,
      cases: it202Cases.map(cleanCase)
    },
    {
      courseCode: 'IE-402',
      courseTitle: 'Systems Engineering',
      program: 'BSIE',
      reviewerCodes: ['R-IE-01', 'R-IE-02'],
      adjudicatorCode: 'ADJ-IE-01',
      caseCount: 9,
      cases: ie402Cases.map(cleanCase)
    },
    {
      courseCode: 'CpE 304',
      courseTitle: 'Fundamentals of Mixed Signals and Sensors',
      program: 'BSCPE',
      reviewerCodes: ['R-CPE-01', 'R-CPE-02'],
      adjudicatorCode: 'ADJ-CPE-01',
      caseCount: 5,
      cases: cpe304Cases.map(cleanCase)
    }
  ]
};

fs.writeFileSync(OUT_JSON, JSON.stringify(bundled, null, 2));

// Generate the Google Apps Script (.gs)
const scriptContent = `/**
 * LCUP Syllabus Management System — Hybrid AI Checker
 * Independent Faculty Validation — Google Forms Generator & Lifecycle Manager
 *
 * Automated deployment script for generating three separate Google Forms
 * and linked Google Sheets response destinations for independent faculty review:
 *   1. IT 202 (BSIT) — 7 Cases (FV-01 to FV-07)
 *   2. IE 402 (BSIE) — 9 Cases (FV-08 to FV-16)
 *   3. CpE 304 (BSCPE) — 5 Cases (FV-17 to FV-21)
 *
 * Pre-requisite: Authorized University Google Workspace Account (script.google.com)
 *
 * Operational Security & Governance Controls:
 * - Domain Authentication: setRequireLogin(true) restricts responder access strictly to institutional Google Workspace accounts.
 * - Reviewer Pseudonymity: setCollectEmail(false) ensures personal email addresses are not captured in research data.
 * - Air-Gap Blind: Zero model predictions, scores, or benchmark answers exposed to reviewers.
 * - Anti-Contamination Isolation: A separate generateTestValidationForm() function deploys isolated test forms with synthetic data.
 * - Response Privacy: setPublishingSummary(false) disables public response summaries so reviewers cannot view peer answers.
 * - Deployment Lock: PropertiesService lock prevents accidental duplicate generation.
 * - Record Freezing: closeValidationForms() closes responder inputs and creates an immutable frozen audit spreadsheet snapshot.
 */

// BUNDLED FACULTY VALIDATION DATASET (21 Institutional Cases)
const VALIDATION_BUNDLE = ${JSON.stringify(bundled, null, 2)};

const JUDGMENT_OPTIONS = [
  'ALIGNED',
  'PARTIALLY_ALIGNED',
  'NOT_ALIGNED',
  'INSUFFICIENT_EVIDENCE'
];

// SAFETY LOCK: Set to true only if intentionally regenerating official forms after clearing prior files
const FORCE_REGENERATE = false;

/**
 * Main deployment function: Generates the 3 official forms and linked spreadsheets.
 */
function generateAllValidationForms() {
  Logger.log('===============================================================');
  Logger.log('LCUP SYLLABUS MANAGEMENT SYSTEM — OFFICIAL FACULTY VALIDATION GENERATOR');
  Logger.log('===============================================================');

  // Guard: Prevent accidental duplicate creation
  const props = PropertiesService.getScriptProperties();
  const priorDeployment = props.getProperty('LCUP_VALIDATION_DEPLOYED_AT');
  if (priorDeployment && !FORCE_REGENERATE) {
    Logger.log('ABORTED: Official validation forms were already generated on ' + priorDeployment + '.');
    Logger.log('Existing Coordinator Directory Sheet ID: ' + (props.getProperty('LCUP_COORDINATOR_SHEET_ID') || 'N/A'));
    Logger.log('To regenerate forms intentionally:');
    Logger.log('  1. Run resetValidationDeployment() to clear the deployment lock, OR');
    Logger.log('  2. Set FORCE_REGENERATE = true at the top of Code.gs.');
    Logger.log('===============================================================');
    return;
  }

  // Step 1: Pre-execution validation
  verifyCaseIntegrity();

  const results = [];
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd_HH-mm');
  const deployedFormIds = [];
  const deployedSheetIds = [];

  // Step 2: Iterate and generate each course form
  for (const course of VALIDATION_BUNDLE.courses) {
    Logger.log('\\n>>> Generating Official Form for: ' + course.courseCode + ' (' + course.courseTitle + ')');
    const formRecord = buildFormForCourse(course, timestamp);
    results.push(formRecord);
    deployedFormIds.push(formRecord.formId);
    deployedSheetIds.push(formRecord.sheetId);
  }

  // Step 3: Create Coordinator Master Directory Spreadsheet
  Logger.log('\\n===============================================================');
  Logger.log('ALL OFFICIAL FORMS SUCCESSFULLY CREATED AND LINKED:');
  Logger.log('===============================================================');

  const summarySheet = SpreadsheetApp.create('LCUP Validation Forms — Coordinator Directory (' + timestamp + ')');
  const sheet = summarySheet.getActiveSheet();
  sheet.appendRow([
    'Course Code',
    'Course Title',
    'Program',
    'Case Count',
    'Assigned Reviewers',
    'Discipline Adjudicator',
    'Reviewer Form URL (Responder)',
    'Coordinator Edit URL',
    'Response Spreadsheet URL'
  ]);
  sheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#E2E8F0');

  for (const r of results) {
    Logger.log('\\n[' + r.courseCode + '] ' + r.courseTitle);
    Logger.log('  Cases: ' + r.caseCount);
    Logger.log('  Reviewers: ' + r.reviewerCodes.join(', ') + ' | Adjudicator: ' + r.adjudicatorCode);
    Logger.log('  Reviewer Form URL: ' + r.publishedUrl);
    Logger.log('  Coordinator Edit URL: ' + r.editUrl);
    Logger.log('  Linked Response Sheet: ' + r.sheetUrl);

    sheet.appendRow([
      r.courseCode,
      r.courseTitle,
      r.program,
      r.caseCount,
      r.reviewerCodes.join(', '),
      r.adjudicatorCode,
      r.publishedUrl,
      r.editUrl,
      r.sheetUrl
    ]);
  }

  sheet.autoResizeColumns(1, 9);

  // Set script properties to lock deployment
  props.setProperty('LCUP_VALIDATION_DEPLOYED_AT', timestamp);
  props.setProperty('LCUP_COORDINATOR_SHEET_ID', summarySheet.getId());
  props.setProperty('LCUP_DEPLOYED_FORM_IDS', JSON.stringify(deployedFormIds));
  props.setProperty('LCUP_DEPLOYED_SHEET_IDS', JSON.stringify(deployedSheetIds));

  Logger.log('\\nCoordinator Directory saved at: ' + summarySheet.getUrl());
  Logger.log('Deployment locked. Official forms remain in pristine 0-response state.');
  Logger.log('===============================================================');
}

/**
 * Builds a single course Google Form and links its response spreadsheet.
 */
function buildFormForCourse(course, timestamp) {
  const formTitle = 'LCUP Faculty Validation — ' + course.courseCode + ' (' + course.courseTitle + ')';
  const form = FormApp.create(formTitle);

  // 1. Form Description & Introduction
  form.setDescription(
    'LCUP Syllabus Management System — Independent Faculty Validation Pilot\\n' +
    'Course: ' + course.courseCode + ' — ' + course.courseTitle + ' (' + course.program + ')\\n\\n' +
    'WELCOME & INSTRUCTIONS:\\n' +
    'Thank you for contributing your academic expertise to validate outcome-based education (OBE) syllabus alignment. ' +
    'In this form, you will evaluate ' + course.cases.length + ' isolated academic relationship pairs extracted directly from the approved syllabus.\\n\\n' +
    'EVALUATION PRINCIPLES:\\n' +
    '1. Independent Review: Complete this evaluation independently without consulting other reviewers or syllabus authors.\\n' +
    '2. Human Judgment Only: Do not use generative AI, chatbots, or automated checkers.\\n' +
    '3. Meaning Over Formatting: Judge pedagogical coherence and substantive alignment, not formatting or numbering.\\n' +
    '4. Four Standard Judgments:\\n' +
    '   - ALIGNED: Supplied evidence mutually supports the relationship with no material gap.\\n' +
    '   - PARTIALLY_ALIGNED: Meaningful support exists, but a material gap, scope mismatch, or ambiguity remains.\\n' +
    '   - NOT_ALIGNED: Substantiated disconnect, contradiction, or unrelated subject matter.\\n' +
    '   - INSUFFICIENT_EVIDENCE: Statement text is too brief, circular, or generic to support a defensible judgment.\\n\\n' +
    'Your responses are saved upon submission. You may edit your submission until the review window closes.'
  );

  // 2. Form Settings (Domain Authentication + Responder Privacy)
  form.setAllowResponseEdits(true);
  form.setPublishingSummary(false); // CRITICAL: Reviewers CANNOT view peer responses
  form.setShowLinkToRespondAgain(false);
  form.setProgressBar(true);
  form.setConfirmationMessage(
    'Thank you for submitting your expert evaluation for ' + course.courseCode + '. ' +
    'Your responses have been securely recorded for the LCUP Academic Validation Study.'
  );

  // Domain Authentication with Pseudonymous Data Recording
  try {
    form.setRequireLogin(true);   // Restricts access strictly to authorized institutional domain accounts
    form.setCollectEmail(false);  // Preserves reviewer pseudonymity in exported research data
  } catch (e) {
    Logger.log('Notice on access settings for ' + course.courseCode + ': ' + e.message);
  }

  // 3. Section 1: Reviewer Identification (Strictly Appointed Faculty Reviewers Only)
  const reviewerItem = form.addListItem();
  reviewerItem.setTitle('Reviewer Identification Code');
  reviewerItem.setHelpText('Select your assigned confidential reviewer code.');
  reviewerItem.setChoices(course.reviewerCodes.map(code => reviewerItem.createChoice(code)));
  reviewerItem.setRequired(true);

  const declarationItem = form.addCheckboxItem();
  declarationItem.setTitle('Reviewer Declaration & Compliance');
  declarationItem.setChoices([
    declarationItem.createChoice('I confirm that I am conducting this academic evaluation independently, relying on my professional subject-matter expertise without using generative AI assistance.')
  ]);
  declarationItem.setRequired(true);

  // 4. Case Sections: Exactly one page break per case
  for (let i = 0; i < course.cases.length; i++) {
    const c = course.cases[i];

    // Page Break for Case
    form.addPageBreakItem()
      .setTitle('Case ' + c.caseId + ' of ' + course.cases.length + ' — ' + c.relationshipName)
      .setHelpText('Academic Relationship: ' + c.relationshipName + ' (' + c.relationshipKey + ')\\n' +
                   'Curricular Placement: ' + c.lesson + ' (' + c.week + ')');

    // Section Header / Evidence Display
    let evidenceText = 'SYLLABUS EVIDENCE FOR THIS CASE:\\n\\n';
    for (let sIdx = 0; sIdx < c.statements.length; sIdx++) {
      const st = c.statements[sIdx];
      evidenceText += '📌 Statement ' + (sIdx + 1) + ' [' + st.role + ']:\\n"' + st.text + '"\\n\\n';
    }

    if (c.iloCloMapping) {
      evidenceText += '📋 MAPPED CLO CONTEXT:\\n' +
                      '• CLO Statement: "' + c.iloCloMapping.cloStatement + '"\\n' +
                      '• Required Classification: ' + c.iloCloMapping.requiredClassification + '\\n' +
                      '• Syllabus Mapping as Printed: ' + c.iloCloMapping.mappingAsPrinted + '\\n\\n';
    }

    evidenceText += '🔍 SURROUNDING LESSON CONTEXT (' + c.week + '):\\n' +
                    '• Course Content: ' + (c.weekContext.content || 'N/A') + '\\n' +
                    '• Activities: ' + (c.weekContext.activities || 'N/A') + '\\n' +
                    '• Assessment: ' + (c.weekContext.assessment || 'N/A');

    const evidenceSection = form.addSectionHeaderItem();
    evidenceSection.setTitle('Syllabus Excerpts: ' + c.caseId);
    evidenceSection.setHelpText(evidenceText);

    // Question 1: Alignment Judgment
    const judgmentItem = form.addMultipleChoiceItem();
    judgmentItem.setTitle('[' + c.caseId + '] Academic Alignment Judgment');
    judgmentItem.setHelpText(
      'Select the discrete judgment that best reflects the alignment between the two statements above.\\n' +
      'ALIGNED: Fully supported | PARTIALLY_ALIGNED: Meaningful support but material gap | ' +
      'NOT_ALIGNED: Substantiated mismatch | INSUFFICIENT_EVIDENCE: Cannot be defended either way.'
    );
    judgmentItem.setChoices(JUDGMENT_OPTIONS.map(opt => judgmentItem.createChoice(opt)));
    judgmentItem.setRequired(true);

    // Question 2: Academic Justification / Explanation
    const explanationItem = form.addParagraphTextItem();
    explanationItem.setTitle('[' + c.caseId + '] Academic Justification / Explanation');
    explanationItem.setHelpText(
      'Detail your academic reasoning. If you noted a gap or mismatch, identify which specific competency, ' +
      'action verb level, or subject matter is missing or inconsistent. For INSUFFICIENT_EVIDENCE, explain why the text is non-evaluable.'
    );
    explanationItem.setRequired(true);

    // Question 3: Supporting Syllabus Evidence / Explanation of Missing Evidence
    const quotesItem = form.addParagraphTextItem();
    quotesItem.setTitle('[' + c.caseId + '] Supporting Syllabus Evidence');
    quotesItem.setHelpText(
      'Quote verbatim phrases from the syllabus statements that substantiate your judgment. ' +
      'If you selected INSUFFICIENT_EVIDENCE because the syllabus lacks necessary details or is circular/generic, explicitly describe what evidence is missing.'
    );
    quotesItem.setRequired(true);

    // Question 4: Recommended Correction (Optional)
    const correctionItem = form.addParagraphTextItem();
    correctionItem.setTitle('[' + c.caseId + '] Recommended Correction (Optional)');
    correctionItem.setHelpText(
      'If you judged PARTIALLY_ALIGNED or NOT_ALIGNED, propose constructive replacement text and specify which component ' +
      '(content, ILO, activity, or assessment) should be revised. Enter "None" if aligned.'
    );
    correctionItem.setRequired(false);
  }

  // 5. Link to Google Sheet Destination
  const sheetTitle = 'LCUP Faculty Validation Responses — ' + course.courseCode + ' (' + timestamp + ')';
  const spreadsheet = SpreadsheetApp.create(sheetTitle);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheet.getId());

  return {
    formId: form.getId(),
    sheetId: spreadsheet.getId(),
    courseCode: course.courseCode,
    courseTitle: course.courseTitle,
    program: course.program,
    caseCount: course.cases.length,
    reviewerCodes: course.reviewerCodes,
    adjudicatorCode: course.adjudicatorCode,
    publishedUrl: form.getPublishedUrl(),
    editUrl: form.getEditUrl(),
    sheetUrl: spreadsheet.getUrl()
  };
}

/**
 * Dedicated Synthetic Test Deployment: Creates an isolated test form with synthetic data.
 * Does NOT touch or contaminate official faculty validation forms or spreadsheets.
 */
function generateTestValidationForm() {
  Logger.log('>>> Creating Isolated Synthetic Test Form (Coordinator Pre-Launch Trial)...');
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd_HH-mm');
  const testTitle = 'LCUP Faculty Validation — SYNTHETIC TEST FORM (' + timestamp + ')';
  const testForm = FormApp.create(testTitle);

  testForm.setDescription(
    'ISOLATED SYNTHETIC TEST FORM FOR COORDINATOR TRIAL ONLY.\\n' +
    'This form contains fictional test cases to verify Google Forms submission, editing, ' +
    'and CSV export behavior without contaminating official evaluation records.'
  );

  testForm.setAllowResponseEdits(true);
  testForm.setPublishingSummary(false);
  testForm.setRequireLogin(true);
  testForm.setCollectEmail(false);

  // Test Reviewer Identification
  const revItem = testForm.addListItem();
  revItem.setTitle('Reviewer Identification Code');
  revItem.setChoices([
    revItem.createChoice('TEST-REVIEWER-01'),
    revItem.createChoice('TEST-REVIEWER-02')
  ]);
  revItem.setRequired(true);

  const decItem = testForm.addCheckboxItem();
  decItem.setTitle('Reviewer Declaration & Compliance');
  decItem.setChoices([decItem.createChoice('Test compliance declaration acknowledgment.')]);
  decItem.setRequired(true);

  // Add 2 Synthetic Test Cases
  const syntheticCases = [
    { id: 'FV-01', rel: 'Course Content ↔ Learning Activities', stmt1: 'Synthetic Introduction to Programming', stmt2: 'Hands-on practice exercises in programming lab.' },
    { id: 'FV-02', rel: 'Course Content ↔ ILO', stmt1: 'Syntax and loops', stmt2: 'ILO: Understand looping structures.' }
  ];

  for (const sc of syntheticCases) {
    testForm.addPageBreakItem().setTitle('Synthetic Case [' + sc.id + '] ' + sc.rel);
    const sec = testForm.addSectionHeaderItem();
    sec.setTitle('Synthetic Test Syllabus Excerpts');
    sec.setHelpText('📌 Statement 1: ' + sc.stmt1 + '\\n📌 Statement 2: ' + sc.stmt2);

    const jItem = testForm.addMultipleChoiceItem();
    jItem.setTitle('[' + sc.id + '] Academic Alignment Judgment').setRequired(true);
    jItem.setChoices(JUDGMENT_OPTIONS.map(opt => jItem.createChoice(opt)));

    testForm.addParagraphTextItem().setTitle('[' + sc.id + '] Academic Justification / Explanation').setRequired(true);
    testForm.addParagraphTextItem().setTitle('[' + sc.id + '] Supporting Syllabus Evidence').setRequired(true);
    testForm.addParagraphTextItem().setTitle('[' + sc.id + '] Recommended Correction (Optional)').setRequired(false);
  }

  // Link to separate synthetic test spreadsheet
  const testSheet = SpreadsheetApp.create('LCUP Validation Responses — SYNTHETIC TEST (' + timestamp + ')');
  testForm.setDestination(FormApp.DestinationType.SPREADSHEET, testSheet.getId());

  Logger.log('Synthetic Test Form Created: ' + testForm.getPublishedUrl());
  Logger.log('Synthetic Test Sheet Created: ' + testSheet.getUrl());
  Logger.log('Coordinator may test submissions and CSV export using these separate test links.');
}

/**
 * Verifies exact 7/9/5 case distribution and case ID continuity.
 */
function verifyCaseIntegrity() {
  Logger.log('Verifying dataset integrity...');
  let totalCases = 0;
  const expected = { 'IT 202': 7, 'IE-402': 9, 'CpE 304': 5 };

  for (const course of VALIDATION_BUNDLE.courses) {
    const code = course.courseCode;
    const count = course.cases.length;
    if (count !== expected[code]) {
      throw new Error('Case distribution mismatch for ' + code + ': expected ' + expected[code] + ', got ' + count);
    }
    totalCases += count;
  }

  if (totalCases !== 21) {
    throw new Error('Total case count mismatch: expected 21, got ' + totalCases);
  }

  Logger.log('Integrity Check Passed: Exactly 21 cases across IT 202 (7), IE 402 (9), and CpE 304 (5).');
}

/**
 * Freezes evaluation records upon deadline:
 *   1. Sets setAcceptingResponses(false) on all official forms.
 *   2. Creates timestamped, read-only audit snapshot copies of each response spreadsheet.
 */
function closeValidationForms() {
  const props = PropertiesService.getScriptProperties();
  const formIds = JSON.parse(props.getProperty('LCUP_DEPLOYED_FORM_IDS') || '[]');
  const sheetIds = JSON.parse(props.getProperty('LCUP_DEPLOYED_SHEET_IDS') || '[]');
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd_HH-mm');

  if (!formIds.length) {
    Logger.log('No deployed official forms recorded in script properties.');
    return;
  }

  Logger.log('Freezing official validation forms...');
  for (const id of formIds) {
    const f = FormApp.openById(id);
    f.setAcceptingResponses(false);
    Logger.log('Closed submissions on: ' + f.getTitle());
  }

  Logger.log('\\nCreating immutable, timestamped spreadsheet snapshots...');
  const snapshotFolder = DriveApp.createFolder('LCUP Faculty Validation — Frozen Audit Snapshots (' + timestamp + ')');
  for (const sId of sheetIds) {
    const origSheet = SpreadsheetApp.openById(sId);
    const copyFile = DriveApp.getFileById(sId).makeCopy('FROZEN_SNAPSHOT_' + origSheet.getName() + ' (' + timestamp + ')', snapshotFolder);
    const frozenSheet = SpreadsheetApp.openById(copyFile.getId());
    const protection = frozenSheet.getActiveSheet().protect().setDescription('Frozen Ground Truth Audit Snapshot — Read-Only');
    protection.removeEditors(protection.getEditors());
    Logger.log('Frozen Snapshot Created: ' + copyFile.getName() + ' => ' + copyFile.getUrl());
  }

  props.setProperty('LCUP_FROZEN_AT', timestamp);
  Logger.log('\\nAll validation records are permanently frozen in folder: ' + snapshotFolder.getUrl());
  Logger.log('Responses are now ready for download, hashing, and discipline adjudication.');
}

/**
 * Reopens validation forms if an authorized administrative extension is granted.
 */
function reopenValidationForms() {
  const props = PropertiesService.getScriptProperties();
  const formIds = JSON.parse(props.getProperty('LCUP_DEPLOYED_FORM_IDS') || '[]');
  for (const id of formIds) {
    const f = FormApp.openById(id);
    f.setAcceptingResponses(true);
    Logger.log('Reopened form: ' + f.getTitle());
  }
}

/**
 * Clears deployment properties lock if intentional recreation of official forms is needed.
 */
function resetValidationDeployment() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('LCUP_VALIDATION_DEPLOYED_AT');
  props.deleteProperty('LCUP_COORDINATOR_SHEET_ID');
  props.deleteProperty('LCUP_DEPLOYED_FORM_IDS');
  props.deleteProperty('LCUP_DEPLOYED_SHEET_IDS');
  props.deleteProperty('LCUP_FROZEN_AT');
  Logger.log('Deployment lock cleared. generateAllValidationForms() can now run.');
}
`;

fs.writeFileSync(OUT_GS, scriptContent);
console.log('Successfully regenerated Google Apps Script: ' + OUT_GS);
console.log('Successfully regenerated Bundled JSON: ' + OUT_JSON);
