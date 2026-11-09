'use strict';
// VPAA conformance, Task 5: response parsing, quotation integrity, academic context, draft guards, and duplicate/missing findings.
// Every "model" here is a scripted test double that returns DAMAGED answers on purpose; the tests prove the software refuses them.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./harness');

const S = 'SUPPORTED_BY_SUPPLIED_EVIDENCE';
const TARGET = 'row0-contentactivity'; // an advice-only C3 link on lesson 1, used as the pair under attack
// Answers every pair faithfully except TARGET, whose judgement `damage` rewrites (or removes by returning null; returns an array to add extras).
const attack = (damage) => async (_url, init) => {
  const body = JSON.parse(init.body), user = JSON.parse(body.messages[0].content), item = body.output_config.format.schema.properties.judgements.items;
  const out = [];
  for (const pair of user.document_data) {
    const ok = h.answerFor(pair, {}), full = Object.fromEntries(Object.keys(item.properties).map((k) => [k, ok[k] !== undefined ? ok[k] : '']));
    if (pair.id !== TARGET) { out.push(full); continue; }
    const r = damage(full, pair, user.document_data);
    if (Array.isArray(r)) out.push(...r); else if (r) out.push(r);
  }
  return h.message(out);
};
const run = async (t, damage) => {
  h.liveGuard(t);
  const fx = h.sample();
  const out = await h.evaluateV2(fx.content, fx.masters, { transport: attack(damage) });
  return { ...out, target: out.record(TARGET), neighbour: out.record('row0-content') };
};
const refused = (r, why) => {
  assert.notEqual(r.target.status, S, `${why}: must not be SUPPORTED`);
  assert.equal(r.target.academicJudgment, null, `${why}: the judgment is discarded`);
  assert.equal(r.target.verification, 'unverified', `${why}: reported as unverified`);
  assert.equal(r.neighbour.status, S, `${why}: the other relationships keep their verified results`);
  assert.notEqual(r.result.alignment.status, 'completed', `${why}: the check does not claim to be complete`);
};

const CASES = {
  'a field the schema does not allow': (j) => ({ ...j, confidence: 0.99 }),
  'a required field is missing': (j) => { const { explanation, ...rest } = j; return rest; },
  'a label outside the four allowed values': (j) => ({ ...j, label: 'MOSTLY_ALIGNED' }),
  'a lower-case label': (j) => ({ ...j, label: 'aligned' }),
  'the same id answered twice': (j) => [j, { ...j }],
  'an id that was never asked': (j) => ({ ...j, id: 'row0-never-asked' }),
  'an empty explanation': (j) => ({ ...j, explanation: '' }),
  'an empty source quotation': (j) => ({ ...j, sourceQuote: '' }),
  'an invented source quotation': (j) => ({ ...j, sourceQuote: 'A PHRASE THAT APPEARS NOWHERE IN THE SYLLABUS' }),
  'a quotation with changed capitalisation': (j, p) => ({ ...j, sourceQuote: String(p.source).trim().slice(0, 14).toUpperCase() }),
  'the two quotations swapped': (j, p) => ({ ...j, sourceQuote: String(p.target).trim().slice(0, 8), targetQuote: String(p.source).trim().slice(0, 8) }),
  'a source quotation taken from the target side': (j, p) => ({ ...j, sourceQuote: String(p.target).trim().slice(0, 8) }),
  'a quotation borrowed from a different relationship': (j, p, all) => ({ ...j, targetQuote: String(all.find((q) => q.id === 'row0-contentassessment').target).trim().slice(0, 8) }),
};
for (const [name, damage] of Object.entries(CASES)) {
  test(`[VPAA-R15-PARSE] ${name} is refused and never verified`, async (t) => refused(await run(t, damage), name));
}

test('[VPAA-R15-OMITTED] a relationship the model leaves out is "not checked", not assumed aligned', async (t) => {
  const r = await run(t, () => null);
  assert.equal(r.target.status, 'NOT_CHECKED'); assert.equal(r.target.academicJudgment, null);
  assert.equal(r.result.alignment.status, 'partially_evaluated');
});

test('[VPAA-R15-INSUFFICIENT-ANSWER] when the text is present, INSUFFICIENT_EVIDENCE from the model is "not evaluated", never a pass', async (t) => {
  const r = await run(t, (j) => ({ ...j, label: 'INSUFFICIENT_EVIDENCE', sourceQuote: '', targetQuote: '' }));
  assert.notEqual(r.target.status, S); assert.equal(r.target.academicJudgment, null);
});

test('[VPAA-R15-NO-DUPLICATES] one record per asked relationship, no duplicates and none missing, in Policy V2 and in Hybrid-2', async (t) => {
  h.liveGuard(t);
  const fx = h.sample();
  const v2 = await h.evaluateV2(fx.content, fx.masters, {});
  const asked = [...new Set(v2.transport.pairs().map((p) => p.id))];
  const records = v2.result.academic.relationships.map((r) => r.id);
  assert.equal(new Set(records).size, records.length, 'V2: no duplicate record');
  for (const id of asked) assert.ok(records.includes(id), `V2: ${id} was asked and has a record`);
  const hy = h.sample();
  const transport = h.scriptedTransport();
  const result = await h.engine.run(hy.content, hy.masters, { useAi: true, env: h.envFor({ SYLLABUS_CHECK_ACADEMIC_V2: 'off', SYLLABUS_CHECK_STAGE_B: 'on', SYLLABUS_CHECK_STAGE_C3: 'on' }), transport, linkChecker: async (url) => ({ url, status: 'ok', httpStatus: 200 }) });
  const j = result.hybrid.alignment.judgements.map((x) => x.id);
  assert.equal(new Set(j).size, j.length, 'Hybrid-2: no relationship judged twice');
  for (const id of new Set(transport.pairs().map((p) => p.id))) assert.ok(j.includes(id), `Hybrid-2: ${id} was asked and has a judgement`);
  const findingIds = result.findings.map((f) => f.id);
  assert.equal(new Set(findingIds).size, findingIds.length, 'Hybrid-2: no duplicate finding id');
});

test('[VPAA-R15-CONTEXT] Title ↔ Content carries the adjacent weeks (and only those) and the course identity, never the description', async (t) => {
  h.liveGuard(t);
  const fx = h.sample();
  fx.content.description = [{ id: 'd1', t: 'DESCRIPTION-MARKER must not appear in a title-to-content judgment.' }];
  const { transport } = await h.evaluateV2(fx.content, fx.masters, {});
  const source = (id) => String(transport.pairs().find((p) => p.id === id).source);
  const weeks = fx.content.plan.map((r, i) => ({ r, i })).filter(({ r }) => r.kind === 'lesson');
  const mid = weeks[2], first = weeks[0], last = weeks[weeks.length - 1];
  assert.ok(/Topic 2/.test(source(`row${mid.i}-content`)) && /Topic 4/.test(source(`row${mid.i}-content`)), 'week 3 carries week 2 and week 4');
  assert.ok(!/Topic 7|Topic 8/.test(source(`row${mid.i}-content`)), 'but not distant weeks');
  assert.ok(!/Previous week/i.test(source(`row${first.i}-content`)), 'the first lesson has no previous week');
  assert.ok(/Next week - Week 18: .*EXAMINATION/i.test(source(`row${last.i}-content`)), 'the neighbour of the last lesson is the next row of the plan, here the final examination (week 18)');
  assert.ok(/Previous week - Week 16/.test(source(`row${last.i}-content`)), 'and its previous week is week 16');
  for (const w of weeks) assert.ok(!source(`row${w.i}-content`).includes('DESCRIPTION-MARKER'), 'no description in any Title ↔ Content pair');
  assert.ok(source(`row${mid.i}-content`).includes(fx.content.meta.title) && /Year level: 2/.test(source(`row${mid.i}-content`)), 'course identity and year level');
});

test('[VPAA-R15-REFERENCE-CONTEXT] a CLO ↔ PO relationship is not judged when the supplied PO reference does not match the official wording', async (t) => {
  h.liveGuard(t);
  const fx = h.sample(); // the fixture's PO text differs from the official PO set
  const { transport, result } = await h.evaluateV2(fx.content, fx.masters, {});
  assert.ok(!transport.pairs().some((p) => /^CLO-(PO|anyPO)$/.test(p.type)), 'no CLO-PO pair is sent against a reference that is not the official one');
  const req = result.academic.requirements.find((r) => r.id === 'course.clo0.PO');
  assert.equal(req.status, 'FACULTY_REVIEW'); assert.ok(req.reviewRequirements.includes('mapping_or_reference_review'), 'and the reason is reported, not guessed');
  assert.ok(result.academic.relationships.filter((r) => /^CLO-(PO|anyPO)$/.test(r.relationshipType)).every((r) => r.status !== S));
});

test('[VPAA-R15-DRAFT-GUARD] a rewrite that merely copies the text it was meant to revise is withheld, not offered as a recommendation', async (t) => {
  h.liveGuard(t);
  const { content, masters } = h.syllabus({ contents: 'Baroque oil painting techniques and colour theory' });
  const copied = (p) => ({ label: 'NOT_ALIGNED', draft: String(p.source).trim() });
  const out = await h.evaluateV2(content, masters, { script: (p) => (p.id === 'row0-content' ? copied(p) : undefined) });
  const rec = out.record('row0-content');
  assert.equal(rec.status, 'REQUIRES_REVISION', 'the judgment itself stands');
  assert.ok(rec.reviewRequirements.includes('recommendation_withheld'), 'the draft is withheld for review');
  assert.equal(rec.recommendedCorrection, null);
  assert.equal(out.result.academic.suggestions.filter((s) => s.relationshipId === 'row0-content').length, 0, 'no suggestion is created from a withheld draft');
});
