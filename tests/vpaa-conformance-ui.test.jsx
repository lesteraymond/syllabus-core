import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import ComplianceCard from '../src/views/ComplianceCard';
import ComplianceModal from '../src/components/ComplianceModal';
import CheckHistory from '../src/components/CheckHistory';
import SyllabusPicker from '../src/components/SyllabusPicker';
import { groupByFacultyProgram } from '../src/lib/complianceView';
import { setLanguage, t, tr } from '../src/i18n';

// VPAA conformance, Task 5 (report rendering): the AI Checker card, rendered from REAL stored-run objects produced by the production service
// (see scripts/test-vpaa-ui.mjs). This checks what a faculty member or administrator is shown; it is not a measure of Claude's accuracy.
const runs = JSON.parse(fs.readFileSync(process.env.VPAA_UI_FIXTURE, 'utf8'));
const html = (run, extra = {}) => renderToStaticMarkup(<ComplianceCard run={run} onApplyDraft={async () => true} {...extra} />);
const text = (markup) => markup.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ');
test.afterEach(() => setLanguage('en'));

test('[VPAA-T5-UI-SCORED] a scored run shows its score, its findings and its recommendations, and the score equals base minus the listed deductions', () => {
  const run = runs.scored, markup = html(run), shown = text(markup);
  const points = run.hybrid.deductions.reduce((s, d) => s + d.points, 0);
  assert.equal(run.overall, Math.max(0, run.hybrid.baseScore - points), 'the number on screen is the number the findings explain');
  assert.ok(shown.includes(`${run.overall}%`), 'the score is displayed');
  // the new AI Checker reports its misalignments as deductions and judgements; the "findings behind the score" list shows the fixed-rule findings, when any
  if (run.findings.length) assert.ok(new RegExp(`${run.findings.length} findings? behind the score`).test(shown), 'the findings count is displayed');
  assert.ok(run.hybrid.deductions.length > 0, 'the points taken off are listed with the report');
  assert.ok(/AI-assisted check/.test(shown), 'the run is labelled AI-assisted');
  const ai = run.hybrid.suggestions.find((s) => s.source === 'ai');
  assert.ok(ai, 'the run has an AI recommendation');
  assert.ok(shown.includes(ai.replacement.slice(0, 30)), 'the suggested wording is shown for the author to review');
  assert.ok(/Apply|Accept|Edit|Reject/i.test(shown), 'the author can act on it');
  assert.ok(!/AI unavailable/.test(shown), 'a completed AI check is not labelled unavailable');
  assert.ok(!/Academic verdict/.test(shown), 'the removed advisory verdict panel is gone');
});

test('[VPAA-T5-UI-CLEAN] a run with nothing to improve says so and shows no recommendations', () => {
  const run = runs.clean, shown = text(html(run));
  assert.equal(run.hybrid.suggestions.length, 0);
  assert.ok(shown.includes(`${run.overall}%`));
  assert.ok(!/AI unavailable|not evaluated/i.test(shown));
});

test('[VPAA-T5-UI-FAILED] a run whose AI step failed shows no final score and says the AI check is incomplete, never a verified result', () => {
  const run = runs.failed, shown = text(html(run));
  assert.equal(run.overall, null);
  assert.equal(run.aiStatus, 'failed');
  assert.ok(!new RegExp(`\\b${run.hybrid.baseScore}%`).test(shown), 'the coded base score is not presented as the final score');
  assert.ok(/AI alignment: not evaluated/i.test(shown) || /not evaluated/i.test(shown), 'the missing AI part is stated');
  assert.ok(/incomplete/i.test(shown), 'the check is described as incomplete');
  assert.ok(run.hybrid.alignment.judgements.every((j) => j.unverified), 'and not one judgment was stored as verified');
});

test('[VPAA-T5-UI-STALE] a run whose syllabus changed afterwards is flagged out of date', () => {
  const run = runs.stale, shown = text(html(run));
  assert.equal(run.stale, true);
  assert.ok(/out of date/i.test(shown));
  assert.ok(!/out of date/i.test(text(html(runs.scored))), 'a current run is not');
});

test('[VPAA-T5-UI-LANGUAGE] the same stored run renders in Filipino with the same score, without leaving English chrome behind', () => {
  const run = runs.scored, en = text(html(run));
  setLanguage('tl');
  const tl = text(html(run));
  assert.notEqual(tl, en);
  assert.ok(tl.includes(`${run.overall}%`), 'the score is language-independent');
  assert.ok(!/findings behind the score/.test(tl), 'the English findings caption is translated');
});

test('[VPAA-UI-COVERAGE] an incomplete seven-relationship check says so, a complete one does not, in English and Filipino', () => {
  const shown = (run) => text(html(run));
  assert.equal(runs.failed.hybrid.semanticCoverage.evaluated, 0);
  assert.equal(runs.failed.hybrid.semanticCoverage.reason, 'replan_not_evaluated');
  assert.ok(/VPAA relationships checked: 0 of 7/.test(shown(runs.failed)), 'the new checker could not answer: 0 of 7');
  for (const complete of ['scored', 'clean']) {
    assert.equal(runs[complete].hybrid.semanticCoverage.evaluated, 7, complete + ': the new checker asks all seven');
    assert.ok(!/VPAA relationships checked/.test(shown(runs[complete])), complete + ': a complete check shows no warning');
  }
  setLanguage('tl');
  assert.ok(/Mga ugnayang VPAA na nasuri: 0 sa 7/.test(shown(runs.failed)), 'Filipino');
  assert.ok(!/VPAA relationships checked/.test(shown(runs.failed)), 'no English left behind');
});

const plain = (s) => s.replace(/&quot;/g, '"').replace(/\s+/g, ' ');
test('[VPAA-UI-FACULTY-ADMIN] a report of the new AI Checker renders for the Faculty author (with Apply controls) and for the Administrator (read only), with the same score', () => {
  const run = runs.scored;
  assert.equal(run.hybrid.semanticCoverage.complete, true); assert.equal(run.hybrid.alignment.engine, 're-planned');
  const faculty = plain(text(html(run))), admin = plain(text(renderToStaticMarkup(<ComplianceCard run={run} showFindings />)));
  const modal = plain(text(renderToStaticMarkup(<ComplianceModal syllabus={{ syllabusId: 100, courseCode: 'IT 204', title: 'Computer Programming 2', programCode: 'BSIT', status: 'under_review' }} run={run} isLatest onClose={() => {}} onOpenDraft={() => {}} onApprove={() => {}} approvalDisabled={false} />)));
  for (const [who, shown] of [['faculty', faculty], ['admin card', admin], ['admin modal', modal]]) {
    assert.ok(shown.includes(run.overall + '%'), who + ': the official score');
    assert.ok(!/VPAA relationships checked/.test(shown), who + ': a complete check shows no incompleteness warning');
    assert.ok(!/Academic verdict/.test(shown));
  }
  assert.ok(faculty.includes(plain(t('hybrid.applyNote'))), 'the author is told how to apply a recommendation');
  assert.ok(admin.includes(plain(t('hybrid.readOnlyNote'))) && !admin.includes(plain(t('hybrid.applyNote'))), 'the administrator sees the recommendations read-only: no Apply');
  assert.ok(/Approve|Edit draft|Close/i.test(modal), 'the administrator modal carries its own actions');
});

// CPE 101 #461: what only the author can fix was invisible and the card said "every check passed" at 96%
for (const language of ['en', 'tl']) test(`[UI-NEEDS-DECISION-${language}] problems with no draft are listed with what to do and which field, and the card never says everything passed while they remain`, () => {
  setLanguage(language);
  if (language === 'en') assert.ok(/Nothing to improve: every check passed/.test(text(html(runs.clean))), 'a clean check still says so');
  const run = structuredClone(runs.clean);
  run.hybrid.deductions = [{ id: 'SEM:REF-RELEVANCE|ref:books:b2', points: 3, kind: 'alignment', reason: 'REF-RELEVANCE: not aligned' }];
  run.hybrid.unresolved = [{ path: 'refs.books.items[1].t', excerpt: "Reinhart, P. (2023). The bread baker's apprentice.", reason: 'faculty_fix', status: 'NEEDS_REVIEW', detail: 'the AI never rewrites a reference; replace or remove this source' }];
  const markup = html(run), shown = text(markup);
  assert.ok(markup.includes('data-testid="needs-decision"'), 'the list is shown');
  assert.ok(shown.includes(t('hybrid.unresolvedTitle', { count: 1 })));
  assert.ok(shown.includes(t('hybrid.unresolved.faculty_fix')), 'the reason, in the selected language');
  assert.ok(shown.includes('bread baker') && shown.includes('replace or remove this source'), 'which source, and what to do');
  assert.ok(!/Nothing to improve/.test(shown), 'not "every check passed" while something is left');
  assert.ok(!shown.includes('hybrid.unresolved.'), 'no translation key leaks');
});

test('[VPAA-T5-UI-ROBUST] a missing run, an empty run and a run with no AI part render without throwing', () => {
  for (const run of [null, undefined, {}, { ...runs.clean, hybrid: undefined }, { ...runs.scored, findings: [], recommendations: [] }]) {
    assert.doesNotThrow(() => html(run), JSON.stringify(run)?.slice(0, 40));
  }
});

for (const language of ['en','tl']) test(`[VPAA-COMP-UI-${language}] an incomplete report lists its AI questions as not answered, never as aligned, in the selected language`, () => {
  setLanguage(language);
  const run = structuredClone(runs.failed), coverage = run.hybrid.ruleCoverage, ai = coverage.aiQuestions;
  assert.ok(coverage && coverage.rules.length >= 47, 'the saved report still carries the rule receipts (not shown)');
  assert.ok(ai && ai.asked > 0, 'a report of the new AI Checker counts its AI questions');
  const shown = text(html(run));
  assert.ok(shown.includes(t('hybrid.aiCoverageHeading', { answered: ai.answered, asked: ai.asked })));
  for (const k of ai.byRelationship) assert.equal(k.passed, 0, k.relationship + ': nothing unanswered is counted as aligned');
  assert.ok(!/hybrid\.(aiCoverage|aiQuestions)/.test(shown), 'translation keys never leak');
  assert.ok(!/Academic verdict/.test(shown), 'deprecated verdict panel stays hidden');
  assert.equal(run.overall, null, 'coverage cannot turn an incomplete check into a score');
});

// Check coverage shows only the AI questions counted by kind (owner, 2026-11-20); the rule-by-rule receipts stay in the report but are not listed.
for (const language of ['en', 'tl']) test(`[COVERAGE-AI-ONLY-${language}] check coverage lists the AI questions by kind and no rule rows`, () => {
  setLanguage(language);
  const run = structuredClone(runs.scored), coverage = run.hybrid.ruleCoverage, ai = coverage.aiQuestions;
  const markup = html(run), shown = text(markup);
  assert.ok(markup.includes('data-testid="ai-coverage"'));
  assert.ok(ai.asked > 0 && ai.answered === ai.asked, 'every question of the scored run was answered');
  assert.ok(shown.includes(t('hybrid.aiCoverageHeading', { answered: ai.answered, asked: ai.asked })));
  assert.ok(shown.includes(t('hybrid.aiCoverageScope')));
  for (const k of ai.byRelationship) assert.ok(shown.includes(`${k.relationship} · ${t('hybrid.aiQuestionsRow', k)}`), k.relationship);
  for (const id of ['CUR-CODE', 'AI-REQUIRED', 'T-09', 'C-04', 'CLO-COUNT', 'REF-RECENCY']) assert.ok(!shown.includes(id + ' ·'), id + ' is not listed');
  assert.ok(!/hybrid\.(aiCoverage|aiQuestions|coverageStatus|reason)\./.test(shown) && !/hybrid\.aiCoverage/.test(shown), 'translation keys never leak');
  const noAi = structuredClone(run); noAi.hybrid.ruleCoverage.aiQuestions = null;
  assert.ok(!html(noAi).includes('data-testid="ai-coverage"'), 'a report without AI questions shows no list');
});

// The program's POs not linked to an EGA: a notice at the top of the report, for the administrator to act on; it blocks nothing.
for (const language of ['en', 'tl']) test(`[PO-EGA-NOTICE-${language}] unlinked Program Outcomes are named at the top of the report, and no notice when all are linked`, () => {
  setLanguage(language);
  const run = structuredClone(runs.scored);
  run.hybrid.ruleCoverage.posWithoutEga = [3, 5];
  const markup = html(run), shown = text(markup);
  assert.ok(markup.includes('data-testid="po-ega-unlinked"'));
  assert.ok(shown.includes(t('hybrid.poEgaUnlinked', { list: '3, 5', count: 2 })));
  assert.ok(!shown.includes('hybrid.poEgaUnlinked'), 'the translation key never leaks');
  assert.ok(shown.includes(`${run.overall}%`), 'the score is still shown: nothing is blocked');
  run.hybrid.ruleCoverage.posWithoutEga = [];
  assert.ok(!html(run).includes('po-ega-unlinked'));
});

// Hardening: stale results are announced before the results they qualify, the budget notices say exactly what happened, and both panels use one vocabulary.
for (const language of ['en', 'tl']) test(`[HARDEN-STALE-${language}] a stale report is marked out of date with a quiet chip (no banner)`, () => {
  setLanguage(language);
  const run = structuredClone(runs.scored); run.stale = true;
  const markup = html(run), shown = text(markup);
  assert.ok(!markup.includes('data-testid="stale-banner"'), 'there is no out-of-date banner');
  assert.ok(markup.includes('class="chip stale"'), 'the out-of-date chip is rendered');
  assert.ok(!shown.includes('hybrid.stale'), 'translation keys never leak');
  const fresh = markup.includes('class="chip stale"') && html({ ...structuredClone(run), stale: false }).includes('class="chip stale"');
  assert.ok(!fresh, 'a current report has no out-of-date chip');
});

for (const language of ['en', 'tl']) test(`[HARDEN-BUDGET-${language}] budget notices: deferred optional checks are said to be Not checked; incomplete required coverage asks for an operator decision`, () => {
  setLanguage(language);
  const base = structuredClone(runs.failed), rows = base.hybrid.ruleCoverage;
  const deferred = structuredClone(base); deferred.hybrid.ruleCoverage.budget = { planned: true, deferredOptional: 17, requiredIncomplete: false, exhausted: false, limits: { maxCostUsd: 10 } };
  const a = html(deferred), at = text(a);
  assert.ok(a.includes('data-testid="budget-optional-deferred"') && at.includes(t('hybrid.budgetDeferred', { count: 17 })));
  assert.ok(!a.includes('budget-required-incomplete'));
  const incomplete = structuredClone(base); incomplete.hybrid.ruleCoverage.budget = { planned: true, deferredOptional: 0, requiredIncomplete: true, exhausted: true, stopReason: 'cost_budget', limits: { maxCostUsd: 3 }, advice: { estimatedRequiredCostUsd: 7.5, currentCapUsd: 3, options: ['raise_cost_cap', 'run_fewer_optional_checks'] } };
  const b = html(incomplete), bt = text(b);
  assert.ok(b.includes('data-testid="budget-required-incomplete"') && b.includes('role="alert"'));
  assert.ok(bt.includes(t('hybrid.budgetRequiredIncomplete', { cost: 7.5, cap: 3 })), 'the estimate and the configured cap are stated');
  assert.ok(!bt.includes('hybrid.budget'), 'translation keys never leak');
  assert.ok(!html(base).includes('budget-optional-deferred'), 'no notice when nothing was deferred');
  assert.ok(rows.rules.length >= 47);
});


// A saved report of a syllabus under record review: its own score, read as history, and never offered as something to act on.
const underReview = (code = 'po_mapping_remediation_required') => { const run = structuredClone(runs.scored); run.stale = true; run.hybrid = { ...run.hybrid, ready: false }; run.recordReview = { code, savedReady: true }; return run; };
for (const language of ['en', 'tl']) test(`[SAVED-REPORT-${language}] a report under record review shows its saved score and an accurate notice, not "out of date"`, () => {
  setLanguage(language);
  const run = underReview(), markup = html(run), shown = text(markup);
  assert.ok(!markup.includes('data-testid="saved-report-banner"'), 'there is no saved-report banner');
  assert.ok(shown.includes(t('hybrid.savedReportLine')) && shown.includes(t('hybrid.savedReportChip')));
  assert.ok(shown.includes(run.overall + '%'), 'the saved score is on the screen'); assert.ok(!shown.includes(t('hybrid.incomplete')), 'it is not called incomplete');
  assert.ok(!markup.includes('data-testid="stale-banner"') && !shown.includes(t('hybrid.staleBody')) && !shown.includes(t('hybrid.staleRecs')), 'it does not say the syllabus changed');
  assert.ok(!shown.includes('hybrid.savedReport'), 'translation keys never leak');
  setLanguage('en');
});
test('[SAVED-REPORT-readonly] nothing in a report under record review can be applied to the draft', () => {
  setLanguage('en');
  const run = underReview(), offered = html({ ...structuredClone(run), recordReview: undefined, stale: false, hybrid: { ...run.hybrid, ready: true } }), held = html(run);
  if (offered.includes('hy-actions')) assert.ok(!held.includes('hy-actions'), 'the author has no Accept, Edit or Reject here');
  assert.ok(!held.includes('<textarea'), 'no recommendation can be edited');
});
test('[SAVED-REPORT-modal] the result dialog shows the saved score', () => {
  setLanguage('en');
  const run = underReview(), out = text(renderToStaticMarkup(<ComplianceModal syllabus={{ courseCode: 'X 1', title: 'T' }} run={run} onClose={() => {}} />));
  assert.ok(out.includes(run.overall + '%')); assert.ok(out.includes(t('hybrid.savedReportLine')));
});
test('[SAVED-REPORT-i18n] English and Tagalog both carry the notice and the refusal, in different words', async () => {
  for (const key of ['hybrid.poMappingRemediation', 'hybrid.savedReportTitle', 'hybrid.savedReportBody', 'hybrid.savedReportBodyCurriculum', 'hybrid.savedReportLine', 'hybrid.savedReportChip']) {
    setLanguage('en'); const english = t(key); setLanguage('tl'); const tagalog = t(key); setLanguage('en');
    assert.ok(english && english !== key && tagalog && tagalog !== key, key); assert.notEqual(english, tagalog, key + ' is translated');
  }
});

// The lists: a stored score stays, but a syllabus under record review is never shown as meeting the standard, and cannot be sent to a check that would be refused.
const historyCard = (over) => ({ runId: 7, syllabusId: 3, courseCode: 'X 1', overall: 96, passed: true, scored: true, status: 'under_review', createdAt: '2026-11-01T01:00:00Z', ...over });
const historyHtml = (runs) => renderToStaticMarkup(<CheckHistory runs={runs} onOpen={() => {}} onApply={() => {}} onReset={() => {}} />);
for (const language of ['en', 'tl']) test(`[REVIEW-LIST-${language}] a history card keeps its score and states the review instead of meeting the standard`, () => {
  setLanguage(language);
  const held = historyHtml([historyCard({ recordReview: 'po_mapping_remediation_required' })]), normal = historyHtml([historyCard({ recordReview: null })]);
  assert.ok(text(held).includes('96%')); assert.ok(text(held).includes(t('hybrid.reviewRequiredChip'))); assert.ok(held.includes('hist-item warn') && !held.includes('hist-item good'));
  assert.ok(normal.includes('hist-item good') && !text(normal).includes(t('hybrid.reviewRequiredChip')));
  setLanguage('en');
});
for (const language of ['en', 'tl']) test(`[REVIEW-PICKER-${language}] the picker renders a row under review, and its note exists in this language (the note and the disabled button need a selected row: browser audit)`, () => {
  setLanguage(language); const row = { syllabusId: 3, facultyName: 'F', programCode: 'P', courseCode: 'X 1', status: 'for_revision', checkable: true, recordReview: 'po_mapping_remediation_required' };
  assert.equal(t('hybrid.reviewRequiredNote') === 'hybrid.reviewRequiredNote', false); assert.ok(renderToStaticMarkup(<SyllabusPicker groups={groupByFacultyProgram([row])} />).includes('pick-card')); setLanguage('en');
});
test('[STATUS-I18N] every status refusal the server sends has a Tagalog message', () => {
  for (const [key, english] of [['hybrid.statusApprovedFinal', 'This syllabus is approved. Approval is final, so its status can no longer change.'], ['hybrid.statusApprovalRequiresReview', 'Only a syllabus under review can be approved. A returned syllabus must be submitted again by its author first.'], ['hybrid.statusResubmissionRequired', 'A returned syllabus goes back to review only when its author submits it again.'], ['hybrid.statusNotAwaitingDecision', 'This syllabus is not waiting for a review decision.']]) {
    setLanguage('en'); assert.equal(t(key), english); setLanguage('tl'); const tagalog = t(key); assert.notEqual(tagalog, english); assert.equal(tr(english), tagalog, 'the page shows the Tagalog text for the exact server message'); setLanguage('en');
  }
});
