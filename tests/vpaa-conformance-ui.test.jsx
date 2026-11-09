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
  assert.ok(new RegExp(`${run.findings.length} findings? behind the score`).test(shown), 'the findings count is displayed');
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

test('[VPAA-T5-UI-V2] a Policy V2 report renders its academic evaluation panel without error', () => {
  const run = runs.v2;
  assert.ok(run.hybrid.academicV2, 'the stored report carries the V2 evaluation');
  const shown = text(html(run));
  assert.ok(shown.length > 200 && /academic/i.test(shown));
  assert.ok(!/Academic verdict/.test(shown));
});

test('[VPAA-T5-UI-LANGUAGE] the same stored run renders in Filipino with the same score, without leaving English chrome behind', () => {
  const run = runs.scored, en = text(html(run));
  setLanguage('tl');
  const tl = text(html(run));
  assert.notEqual(tl, en);
  assert.ok(tl.includes(`${run.overall}%`), 'the score is language-independent');
  assert.ok(!/findings behind the score/.test(tl), 'the English findings caption is translated');
});

test('[VPAA-V2-UI-COVERAGE] an incomplete seven-relationship check says so (with the reason), a complete one does not, in English and Filipino', () => {
  const shown = (run) => text(html(run)), raw = (run) => html(run);
  assert.equal(runs.default.hybrid.semanticCoverage.evaluated, 2);
  assert.ok(/VPAA relationships checked: 2 of 7/.test(shown(runs.default)), 'default configuration: 2 of 7');
  assert.ok(/Policy V2 is off/.test(raw(runs.default)), 'with the reason, on the chip');
  assert.ok(/VPAA relationships checked: 0 of 7/.test(shown(runs.failed)), 'an AI failure: 0 of 7');
  for (const complete of ['scored', 'clean', 'v2']) assert.ok(!/VPAA relationships checked/.test(shown(runs[complete])), complete + ': a complete check shows no warning');
  setLanguage('tl');
  assert.ok(/Mga ugnayang VPAA na nasuri: 2 sa 7/.test(shown(runs.default)), 'Filipino');
  assert.ok(/Naka-off ang Policy V2/.test(raw(runs.default)));
  assert.ok(!/VPAA relationships checked/.test(shown(runs.default)), 'no English left behind');
});

test('[VPAA-V2-UI-BLANK-CLO] a CLO with no saved classification is explained, naming the CLO, in English and Filipino', () => {
  const run = runs.blankClo, record = run.hybrid.academicV2.academic.relationships.find((r) => r.id === 'clo1-classification');
  assert.ok(record.reviewRequirements.includes('clo_classification_missing'));
  assert.ok(/The classification of CLO 2 is not saved/.test(text(html(run))) && /no classification was assumed/.test(text(html(run))) && /Select a classification for this CLO in the CLO step/.test(text(html(run))));
  setLanguage('tl');
  const tl = text(html(run));
  assert.ok(/Hindi pa naka-save ang klasipikasyon ng CLO 2/.test(tl) && /walang ipinagpalagay na klasipikasyon/.test(tl), 'Filipino, naming CLO 2');
  assert.ok(!/The classification of CLO 2 is not saved/.test(tl));
});

const plain = (s) => s.replace(/&quot;/g, '"').replace(/\s+/g, ' ');
test('[VPAA-STG-UI-FACULTY-ADMIN] the staging report renders for the Faculty author (with Apply controls) and for the Administrator (read only), the same score and the same seven relationships', () => {
  const run = runs.staging;
  assert.equal(run.hybrid.semanticCoverage.complete, true); assert.equal(run.hybrid.academicV2.mode, 'live-application');
  const faculty = plain(text(html(run))), admin = plain(text(renderToStaticMarkup(<ComplianceCard run={run} showFindings />)));
  const modal = plain(text(renderToStaticMarkup(<ComplianceModal syllabus={{ syllabusId: 100, courseCode: 'IT 204', title: 'Computer Programming 2', programCode: 'BSIT', status: 'under_review' }} run={run} isLatest onClose={() => {}} onOpenDraft={() => {}} onApprove={() => {}} approvalDisabled={false} />)));
  for (const [who, shown] of [['faculty', faculty], ['admin card', admin], ['admin modal', modal]]) {
    assert.ok(shown.includes(run.overall + '%'), who + ': the official score');
    for (const type of ['Content-course', 'Content-ILO', 'ILO-CLO', 'Content-activity', 'ILO-activity', 'Content-assessment', 'Activity-assessment']) assert.ok(shown.includes('weekly:0:' + type), who + ': the ' + type + ' requirement of week 1 is shown');
    assert.ok(!/VPAA relationships checked/.test(shown), who + ': a complete check shows no incompleteness warning');
    assert.ok(!/Academic verdict/.test(shown));
  }
  assert.ok(faculty.includes(plain(t('hybrid.applyNote'))), 'the author is told how to apply a recommendation');
  assert.ok(admin.includes(plain(t('hybrid.readOnlyNote'))) && !admin.includes(plain(t('hybrid.applyNote'))), 'the administrator sees the recommendations read-only: no Apply');
  assert.ok(/Approve|Edit draft|Close/i.test(modal), 'the administrator modal carries its own actions');
});

test('[VPAA-T5-UI-ROBUST] a missing run, an empty run and a run with no AI part render without throwing', () => {
  for (const run of [null, undefined, {}, { ...runs.clean, hybrid: undefined }, { ...runs.scored, findings: [], recommendations: [] }]) {
    assert.doesNotThrow(() => html(run), JSON.stringify(run)?.slice(0, 40));
  }
});

for (const language of ['en','tl']) test(`[VPAA-COMP-UI-${language}] existing report shows coverage and incomplete states in the selected language`, () => {
  setLanguage(language);
  const run = structuredClone(runs.failed), coverage = run.hybrid.ruleCoverage;
  assert.ok(coverage && coverage.rules.length >= 47, 'the saved report carries evaluator receipts');
  const shown = text(html(run));
  assert.ok(shown.includes(t('hybrid.coverageStatus.NOT_CHECKED')));
  assert.ok(shown.includes(t('hybrid.ruleCoverage', { verified: coverage.counts.verified, total: coverage.counts.catalogued })));
  assert.ok(shown.includes('VPAA-01') && shown.includes('STR-07'));
  assert.ok(!shown.includes('hybrid.coverageStatus.'), 'status translation keys never leak to faculty/admin');
  assert.ok(!/Academic verdict/.test(shown), 'deprecated verdict panel stays hidden');
  assert.equal(run.overall, null, 'coverage cannot turn an incomplete check into a score');
});

// Hardening: stale results are announced before the results they qualify, the budget notices say exactly what happened, and both panels use one vocabulary.
for (const language of ['en', 'tl']) test(`[HARDEN-STALE-${language}] a stale report shows its out-of-date banner BEFORE the V2 results, the coverage list and the recommendations`, () => {
  setLanguage(language);
  const run = structuredClone(runs.v2 || runs.scored); run.stale = true;
  const markup = html(run), shown = text(markup);
  assert.ok(markup.includes('data-testid="stale-banner"'), 'the banner is rendered');
  assert.ok(shown.includes(t('hybrid.staleTitle')) && shown.includes(t('hybrid.staleBody')));
  const banner = markup.indexOf('data-testid="stale-banner"');
  for (const later of ['hy-details', 'class="vd"', 'class="hy-recs"']) { const at = markup.indexOf(later); if (at >= 0) assert.ok(banner < at, `the banner comes before ${later}`); }
  if (markup.includes('class="vd"')) assert.ok(markup.includes('data-testid="stale-chip"'), 'the V2 panel heading carries its own out-of-date marker');
  assert.ok(!shown.includes('hybrid.stale'), 'translation keys never leak');
  const fresh = text(html({ ...structuredClone(run), stale: false }));
  assert.ok(!fresh.includes(t('hybrid.staleBody')), 'a current report shows no out-of-date banner');
});

for (const language of ['en', 'tl']) test(`[HARDEN-BUDGET-${language}] budget notices: deferred optional checks are said to be Not checked; incomplete required coverage asks for an operator decision`, () => {
  setLanguage(language);
  const base = structuredClone(runs.failed), rows = base.hybrid.ruleCoverage;
  const deferred = structuredClone(base); deferred.hybrid.ruleCoverage.budget = { planned: true, deferredOptional: 17, requiredIncomplete: false, exhausted: false, limits: { maxCostUsd: 10 } };
  const target = deferred.hybrid.ruleCoverage.rules.find((r) => r.status === 'NOT_CHECKED' && r.namespace !== 'reserved'); target.reasonCode = 'budget_deferred';
  const a = html(deferred), at = text(a);
  assert.ok(a.includes('data-testid="budget-optional-deferred"') && at.includes(t('hybrid.budgetDeferred', { count: 17 })));
  assert.ok(at.includes(t('hybrid.reason.budget_deferred')), 'the deferred rule says why it was not sent');
  assert.ok(!a.includes('budget-required-incomplete'));
  const incomplete = structuredClone(base); incomplete.hybrid.ruleCoverage.budget = { planned: true, deferredOptional: 0, requiredIncomplete: true, exhausted: true, stopReason: 'cost_budget', limits: { maxCostUsd: 3 }, advice: { estimatedRequiredCostUsd: 7.5, currentCapUsd: 3, options: ['raise_cost_cap', 'run_fewer_optional_checks'] } };
  const b = html(incomplete), bt = text(b);
  assert.ok(b.includes('data-testid="budget-required-incomplete"') && b.includes('role="alert"'));
  assert.ok(bt.includes(t('hybrid.budgetRequiredIncomplete', { cost: 7.5, cap: 3 })), 'the estimate and the configured cap are stated');
  assert.ok(!bt.includes('hybrid.budget'), 'translation keys never leak');
  assert.ok(!html(base).includes('budget-optional-deferred'), 'no notice when nothing was deferred');
  assert.ok(rows.rules.length >= 47);
});

for (const language of ['en', 'tl']) test(`[HARDEN-VOCAB-${language}] the coverage list and the Policy V2 panel use the same status words, and a replaced rule is shown as replaced`, () => {
  setLanguage(language);
  const same = [['hybrid.coverageStatus.PASS', 'academicV2.status.SUPPORTED_BY_SUPPLIED_EVIDENCE'], ['hybrid.coverageStatus.FAIL', 'academicV2.status.REQUIRES_REVISION'], ['hybrid.coverageStatus.NEEDS_REVIEW', 'academicV2.status.FACULTY_REVIEW'], ['hybrid.coverageStatus.NOT_CHECKED', 'academicV2.status.NOT_CHECKED'], ['hybrid.coverageStatus.PARTIALLY_EVALUATED', 'academicV2.status.PARTIALLY_EVALUATED']];
  for (const [a, b] of same) assert.equal(t(a), t(b), `${a} and ${b} read the same`);
  const run = structuredClone(runs.failed);
  const replaced = run.hybrid.ruleCoverage.rules.find((r) => r.ruleId === 'C-04');
  assert.ok(replaced, 'C-04 is in the manifest'); replaced.reasonCode = 'replaced';
  const shown = text(html(run));
  assert.ok(shown.includes('C-04 · ' + t('hybrid.coverageStatus.REPLACED')), 'a rule replaced by an authorized alternative check says so instead of a bare Not checked');
  const reserved = run.hybrid.ruleCoverage.rules.filter((r) => r.namespace === 'reserved');
  assert.equal(reserved.length, 11);
  for (const r of reserved) assert.ok(shown.includes(`${r.ruleId} · ${t('hybrid.coverageStatus.NOT_CHECKED')}`), `${r.ruleId} stays Not checked`);
  assert.ok(!reserved.some((r) => shown.includes(`${r.ruleId} · ${t('hybrid.coverageStatus.PASS')}`)), 'no reserved rule is ever shown as supported');
});

// A saved report of a syllabus under record review: its own score, read as history, and never offered as something to act on.
const underReview = (code = 'po_mapping_remediation_required') => { const run = structuredClone(runs.scored); run.stale = true; run.hybrid = { ...run.hybrid, ready: false }; run.recordReview = { code, savedReady: true }; return run; };
for (const language of ['en', 'tl']) test(`[SAVED-REPORT-${language}] a report under record review shows its saved score and an accurate notice, not "out of date"`, () => {
  setLanguage(language);
  const run = underReview(), markup = html(run), shown = text(markup);
  assert.ok(markup.includes('data-testid="saved-report-banner"'), 'the notice is rendered');
  assert.ok(shown.includes(t('hybrid.savedReportTitle')) && shown.includes(t('hybrid.savedReportBody')) && shown.includes(t('hybrid.savedReportLine')) && shown.includes(t('hybrid.savedReportChip')));
  assert.ok(shown.includes(run.overall + '%'), 'the saved score is on the screen'); assert.ok(!shown.includes(t('hybrid.incomplete')), 'it is not called incomplete');
  assert.ok(!markup.includes('data-testid="stale-banner"') && !shown.includes(t('hybrid.staleBody')) && !shown.includes(t('hybrid.staleRecs')), 'it does not say the syllabus changed');
  assert.ok(!shown.includes('hybrid.savedReport'), 'translation keys never leak');
  assert.ok(markup.indexOf('data-testid="saved-report-banner"') < markup.indexOf('class="cmp-top"'), 'the notice comes before the results it qualifies');
  const later = text(html(underReview('curriculum_reference_review_required'))); assert.ok(later.includes(t('hybrid.savedReportBodyCurriculum')) && !later.includes(t('hybrid.savedReportBody')));
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
  assert.ok(out.includes(run.overall + '%')); assert.ok(out.includes(t('hybrid.savedReportTitle')));
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
