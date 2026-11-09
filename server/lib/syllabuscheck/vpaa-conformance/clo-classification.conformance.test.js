'use strict';
// VPAA conformance, Task 2: the LCUP CLO classifications and how ILO↔CLO mappings are evaluated against them.
// The institutional classifications are NEVER changed here; these tests only verify that the software preserves and uses them.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./harness');
const contract = require('../cloClassification');
const { V2_PROMPT } = require('../academicV2Plan');

const S = 'SUPPORTED_BY_SUPPLIED_EVIDENCE', R = 'REQUIRES_REVISION', F = 'FACULTY_REVIEW';
const FIXED = ['Introductory', 'Enabling', 'Demonstrating', 'Integration of Values'];

test('[VPAA-R8-LEVELS] the four institutional classifications and their definitions are exactly as approved', () => {
  assert.deepEqual(contract.LEVELS, FIXED, 'CLO1..CLO4 = Introductory, Enabling, Demonstrating, Integration of Values');
  assert.deepEqual(h.POLICY.classifications, FIXED, 'the policy file carries the same four');
  assert.equal(contract.VERSION, 'lcup-ilo-clo-classification-3');
  for (const phrase of ['CLO1 is Introductory (Foundational Knowledge)', 'CLO2 is Enabling (Skill Development / Evaluate)', 'CLO3 is Demonstrating (Application / Create)', 'CLO4 is Integration of Values (Ethics & Responsibility / Evaluate & Create)']) {
    assert.ok(V2_PROMPT.includes(phrase), `the academic prompt states: ${phrase}`);
  }
});

test('[VPAA-R8-FIXED-BY-NUMBER] the classification comes from the CLO number, never from the saved label; a conflict is reported, not trusted or changed', async (t) => {
  h.liveGuard(t);
  const { content } = h.sample();
  content.clos.forEach((c) => { c.level = 'Introductory'; }); // what the PDF importer writes for every CLO
  const summary = contract.summaryOf(content);
  assert.deepEqual(summary.map((x) => x.level), FIXED);
  assert.deepEqual(summary.map((x) => x.stored.status), ['matches', 'conflicts', 'conflicts', 'conflicts'], 'saved placeholders are compared and reported');
  content.clos.push({ id: 'c5', title: 'Fifth', level: 'Enabling', statement: 'A fifth outcome' });
  assert.equal(contract.classificationOf(content, content.clos[4]).status, 'unavailable', 'a CLO beyond the fourth has no required classification');
  assert.equal(contract.classificationOf(content, content.clos[4]).reason, 'no_fixed_classification');

  // End to end: what is SENT to the model uses the fixed classification, and the faculty's saved labels are untouched.
  const fx = h.sample();
  fx.content.clos.forEach((c) => { c.level = 'Introductory'; });
  const before = structuredClone(fx.content);
  const { transport } = await h.evaluateV2(fx.content, fx.masters, {});
  assert.deepEqual(fx.content, before, 'saved labels, statements and mappings are unchanged');
  const sent = transport.pairs().filter((p) => p.type === 'CLO-classification');
  assert.equal(sent.length, 4);
  FIXED.forEach((level, k) => assert.ok(sent.find((p) => p.id === `clo${k}-classification`).source.includes(`Assigned classification: ${level}`), `CLO${k + 1} is sent as ${level}`));
  assert.ok(sent.every((p) => p.classificationSource === contract.SOURCE));
});

test('[VPAA-R8-STATEMENTS-PRESERVED] faculty-authored CLO statements are sent verbatim as the target and never rewritten', async (t) => {
  h.liveGuard(t);
  const fx = h.syllabus({});
  fx.content.clos.forEach((c, k) => { c.statement = `Faculty-authored statement number ${k + 1}, kept exactly as written.`; });
  const before = structuredClone(fx.content);
  const { transport, result } = await h.evaluateV2(fx.content, fx.masters, { script: () => ({ label: 'NOT_ALIGNED' }) });
  assert.deepEqual(fx.content, before, 'no statement, tag or label is modified, even when every answer is NOT_ALIGNED');
  for (const p of transport.pairs().filter((x) => x.type === 'CLO-classification')) {
    const k = Number(/^clo(\d+)/.exec(p.id)[1]);
    assert.equal(p.target.trim(), before.clos[k].statement, `CLO${k + 1} statement is the target verbatim`);
  }
  // Nothing is ever reclassified or replaced automatically.
  assert.ok(result.academic.suggestions.every((s) => !/^clos\[\d+\]\.level$/.test(s.path)), 'no suggestion changes a classification label');
  assert.ok(result.academic.relationships.filter((r) => r.relationshipType === 'CLO-classification').every((r) => r.correction?.canAutoApply !== true));
});

test('[VPAA-R8-CONTEXT] the judgment is not left to a Bloom verb: each ILO↔CLO request carries the classification, the lesson, the CLO\'s other lessons and the course CLOs', async (t) => {
  h.liveGuard(t);
  const fx = h.sample();
  const { transport } = await h.evaluateV2(fx.content, fx.masters, {});
  const iloClo = transport.pairs().filter((p) => p.type === 'ILO-CLO');
  assert.ok(iloClo.length > 0);
  for (const p of iloClo) {
    const ctx = p.classificationContext;
    assert.ok(ctx, `${p.id} carries the classification context`);
    assert.ok(FIXED.includes(ctx.classification), 'the fixed classification');
    assert.ok(typeof ctx.week === 'string' && ctx.week !== '', 'the ILO\'s week');
    assert.ok('weekContent' in ctx && Array.isArray(ctx.cloLessons) && ctx.cloLessons.length > 0, 'the lesson content and the lessons mapped to the same CLO');
    assert.equal(ctx.courseClos.length, fx.content.clos.length, 'the course\'s CLOs with their classifications');
    assert.ok(ctx.courseClos.every((c, k) => c.classification === FIXED[k]));
  }
  assert.ok(V2_PROMPT.includes('do not decide from a Bloom verb, a week number or a label alone'), 'the academic prompt forbids deciding from a verb, week or label alone');
  assert.ok(transport.sent.some((q) => /classificationContext/.test(q.system)), 'the request instructions name the classification context');
});

test('[VPAA-R8-MULTI-MAPPING] an ILO assigned to several CLOs gets one relationship per CLO, each with its own classification', async (t) => {
  h.liveGuard(t);
  const fx = h.syllabus({ ilo: 'Apply core programming structures to solve a course problem', tags: ['clo:c2', 'clo:c3', 'clo:c4'] });
  const { transport, result, rowIndex } = Object.assign(await h.evaluateV2(fx.content, fx.masters, {}), { rowIndex: fx.rowIndex });
  const ids = [2, 3, 4].map((n) => `row${rowIndex}-ilo0-clo:c${n}`);
  const pairs = ids.map((id) => transport.pairs().find((p) => p.id === id));
  assert.ok(pairs.every(Boolean), 'one relationship per assigned CLO');
  assert.deepEqual(pairs.map((p) => p.classificationContext.classification), ['Enabling', 'Demonstrating', 'Integration of Values']);
  for (const id of ids) {
    const rec = result.academic.relationships.find((r) => r.id === id);
    assert.equal(rec.cloClassification.status, 'evaluated');
    assert.equal(rec.cloClassification.basis, 'statement_and_classification');
  }
});

test('[VPAA-R8-SECONDARY-NOT-IGNORED] one wrong mapping among several is never silently ignored, in either position', async (t) => {
  h.liveGuard(t);
  const run = async (label1, label3) => {
    const fx = h.syllabus({ ilo: 'Define variables and data types used in programming', tags: ['clo:c1', 'clo:c3'] });
    const out = await h.evaluateV2(fx.content, fx.masters, { script: (p) => (p.id.endsWith('-clo:c1') ? { label: label1 } : p.id.endsWith('-clo:c3') ? { label: label3 } : undefined) });
    return { req: out.result.academic.requirements.find((q) => q.id === `weekly:${fx.rowIndex}:ILO-CLO`), r1: out.record(`row${fx.rowIndex}-ilo0-clo:c1`), r3: out.record(`row${fx.rowIndex}-ilo0-clo:c3`) };
  };
  const wrongSecondary = await run('ALIGNED', 'NOT_ALIGNED');
  assert.equal(wrongSecondary.req.status, F); assert.equal(wrongSecondary.r3.status, R);
  const wrongPrimary = await run('NOT_ALIGNED', 'ALIGNED');
  assert.equal(wrongPrimary.req.status, F); assert.equal(wrongPrimary.r1.status, R);
  const bothWrong = await run('NOT_ALIGNED', 'NOT_ALIGNED');
  assert.equal(bothWrong.req.status, R, 'every mapping failing is a revision, not a review');
  const bothRight = await run('ALIGNED', 'ALIGNED');
  assert.equal(bothRight.req.status, S);
  const partialExtra = await run('ALIGNED', 'PARTIALLY_ALIGNED');
  assert.equal(partialExtra.req.status, F, 'a partial extra mapping still needs faculty review');
});

test('[VPAA-R8-LABEL-COMPLETENESS] label completeness (CLO-08) is a separate criterion from classification meaning', async (t) => {
  h.liveGuard(t);
  const fx = h.sample();
  fx.content.clos.forEach((c) => { c.level = 'Introductory'; });
  const { result } = await h.evaluateV2(fx.content, fx.masters, {});
  const labels = result.academic.requirements.find((q) => q.id === 'course.classificationLabels'), meaning = result.academic.requirements.find((q) => q.id === 'course.CLOClassificationMeaning');
  assert.equal(labels.status, R, 'three CLOs saved as Introductory: the label set is incomplete');
  assert.equal(meaning.status, S, 'while the meaning check uses the fixed mapping and is judged on its own');
  assert.notEqual(labels.id, meaning.id);
});

// DEF-02 (resolved as FAIL-SAFE + ACTIONABLE, as instructed). A CLO whose SAVED classification is blank is still not judged, and no classification is assumed for it, but the
// report no longer skips it silently: it names the CLO, the field, and what the author must do. The label itself stays reported by CLO-08.
test('[VPAA-R8-BLANK-LABEL] DEF-02 regression: a CLO with no saved classification is not judged and not guessed, and the report says exactly what to do', async (t) => {
  h.liveGuard(t);
  const fx = h.sample();
  fx.content.clos[1].level = '';
  const before = structuredClone(fx.content);
  const { transport, record, result } = await h.evaluateV2(fx.content, fx.masters, {});
  assert.deepEqual(fx.content, before, 'nothing is written into the syllabus');
  assert.ok(!transport.pairs().some((p) => p.id === 'clo1-classification'), 'fail-safe: the classification relationship is not sent for this CLO');
  assert.ok(transport.pairs().filter((p) => p.type === 'CLO-classification').every((p) => !/clo1/.test(p.id)), 'and no request states a classification for it');
  const rec = record('clo1-classification');
  assert.equal(rec.status, 'NOT_CHECKED'); assert.equal(rec.academicJudgment, null);
  assert.equal(rec.path, 'clos[1].level', 'it names the field to fix');
  assert.ok(rec.reviewRequirements.includes('clo_classification_missing'), 'a specific, machine-readable reason (not just "missing evidence")');
  for (const part of [/CLO 2/, /not saved/, /no classification was assumed/, /Select a classification for this CLO in the CLO step/]) assert.match(rec.explanation, part);
  const meaning = result.academic.requirements.find((q) => q.id === 'course.CLOClassificationMeaning');
  assert.equal(meaning.status, 'PARTIALLY_EVALUATED'); assert.ok(meaning.reviewRequirements.includes('clo_classification_missing'), 'the course-level criterion carries the same reason');
  assert.equal(result.academic.requirements.find((q) => q.id === 'course.classificationLabels').status, R, 'CLO-08 still reports the missing label separately');
  for (const id of ['clo0-classification', 'clo2-classification', 'clo3-classification']) assert.equal(record(id).status, S, `${id} is unaffected`);
});

test('[VPAA-R8-BLANK-LABEL-LOCALIZED] the missing-classification message is shown in English and Filipino and names the CLO', async () => {
  const { hybridEn, hybridTl } = await import('../../../../src/i18n/hybrid.js');
  const academic = await import('../../../../src/i18n/academicV2.js');
  const flat = (m) => JSON.stringify(m);
  assert.ok(flat(academic).includes('academicV2.cloClassificationMissing'), 'the key exists');
  for (const lang of Object.values(academic).filter((x) => x && typeof x === 'object' && x['academicV2.cloClassificationMissing'])) assert.match(lang['academicV2.cloClassificationMissing'], /\{clo\}/, 'the CLO number is a parameter');
  assert.equal(Object.values(academic).filter((x) => x && typeof x === 'object' && x['academicV2.cloClassificationMissing']).length, 2, 'English and Filipino');
  for (const dict of [hybridEn, hybridTl]) for (const k of ['hybrid.vpaaCoverage', 'hybrid.vpaaCoverageNote.policy_v2_off', 'hybrid.vpaaCoverageNote.v2_not_evaluated', 'hybrid.vpaaCoverageNote.v2_partial', 'hybrid.vpaaCoverageNote.missing_evidence']) assert.ok(dict[k], k);
});
