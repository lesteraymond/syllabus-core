'use strict';
// VPAA conformance, Tasks 1, 3 and 5: the seven relationships, scenario by scenario, against the PRODUCTION code with a SCRIPTED model.
// A pass here is SOFTWARE conformance (right fields, right validation, right disposition, right recommendation behaviour). It is not evidence
// of Claude's academic accuracy: the model is a test double and never makes a network call (liveGuard).
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./harness');
const { SCENARIOS } = require('./scenarios');
const { RELATIONSHIPS, byType } = require('./requirements');

const S = 'SUPPORTED_BY_SUPPLIED_EVIDENCE', R = 'REQUIRES_REVISION', F = 'FACULTY_REVIEW', N = 'NOT_EVALUATED';
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const TYPES = RELATIONSHIPS.map((r) => r.type);

// The relationship id(s) a scenario is about, on its lesson row.
function pairIds(s, r, content) {
  const tags = content.plan[r].ilos[0].tags || [];
  const cloTags = tags.filter((t) => t.startsWith('clo:'));
  return {
    'Content-course': [`row${r}-content`], 'Content-ILO': [`row${r}-ilo0-contentilo`],
    'ILO-CLO': cloTags.length ? cloTags.map((t) => `row${r}-ilo0-${t}`) : [`row${r}-ilo0-unassigned-clo`],
    'Content-activity': [`row${r}-contentactivity`], 'ILO-activity': [`row${r}-ilo0-activity`],
    'Content-assessment': [`row${r}-contentassessment`], 'Activity-assessment': [`row${r}-activityassessment`],
  }[s.type];
}
// Expected (source, target) text of each relationship, from the VPAA field definitions in requirements.js.
function expectedFields(type, content, r, id = '') {
  const row = content.plan[r], ilo = norm(row.ilos[0].text), clo = content.clos.find((c) => id.endsWith(`-clo:${c.id}`));
  return {
    'Content-course': { source: [norm(content.meta.title), `Program: ${content.meta.program}`], target: norm(row.contents) },
    'Content-ILO': { source: [norm(row.contents)], target: ilo },
    'ILO-CLO': { source: clo ? [norm(clo.statement)] : [], target: ilo },
    'Content-activity': { source: [norm(row.contents)], target: norm(row.activities) },
    'ILO-activity': { source: [ilo], target: norm(row.activities) },
    'Content-assessment': { source: [norm(row.contents)], target: norm(row.tasks) },
    'Activity-assessment': { source: [norm(row.activities)], target: norm(row.tasks) },
  }[type];
}
// The scripted model: it answers the pair(s) under test as the scenario says and every other relationship faithfully ALIGNED.
function scriptFor(s, ids) {
  return (pair) => {
    if (!ids.includes(pair.id)) return undefined;
    const label = typeof s.scripted === 'string' ? s.scripted : Object.entries(s.scripted || {}).find(([tag]) => pair.id.endsWith(`-${tag}`))?.[1];
    return label ? { label } : undefined;
  };
}
const actionFor = (result, id) => (result.academic.remediation.actions || []).filter((a) => (a.relationshipIds || []).includes(id));
const suggestionFor = (result, id) => (result.academic.suggestions || []).filter((x) => (x.basedOn || []).includes(id) || x.relationshipId === id);

for (const s of SCENARIOS) {
  test(`[${s.id}] ${s.relationship} - ${s.kind}: ${s.title}`, async (t) => {
    h.liveGuard(t);
    const { content, masters, rowIndex, row } = h.syllabus(s.input);
    s.extra?.(content, masters, row);
    const before = structuredClone(content);
    const ids = pairIds(s, rowIndex, content);
    const { result, transport, record } = await h.evaluateV2(content, masters, { script: scriptFor(s, ids) });
    const sent = transport.pairs();

    assert.deepEqual(content, before, 'the evaluation never changes faculty text, tags or mappings');
    assert.equal(s.type, byType[s.type].type);
    assert.ok(result.academic.relationships.every((rel) => !/CLO.*Description|Description.*CLO/.test(rel.relationshipType)), 'CLO-Description is not a relationship');

    if (s.kind === 'insufficient') {
      for (const id of ids) {
        assert.ok(!sent.some((p) => p.id === id), `${id}: a relationship with a missing side is never sent to the model`);
        const rec = record(id);
        assert.equal(rec.status, 'NOT_CHECKED', `${id}: not evaluated, never a pass`);
        assert.equal(rec.academicJudgment, null, 'no judgment is fabricated');
        assert.ok(rec.reviewRequirements.includes('missing_evidence'));
        assert.equal(actionFor(result, id).length + suggestionFor(result, id).length, 0, 'nothing to recommend without evidence');
      }
      assert.notEqual(result.academic.disposition, S, 'missing evidence can never certify the syllabus');
      return;
    }

    // Relationship construction: right fields, nothing else.
    for (const id of ids) {
      const want = expectedFields(s.type, content, rowIndex, id);
      const pair = sent.find((p) => p.id === id);
      assert.ok(pair, `${id} reached the model`);
      assert.equal(pair.type, s.type);
      for (const piece of want.source) assert.ok(norm(pair.source).includes(piece), `${id}: source carries "${piece}"`);
      assert.equal(norm(pair.target), want.target, `${id}: target is exactly the VPAA target field`);
      if (s.type === 'Content-course') assert.ok(!content.description.some((d) => norm(pair.source).includes(norm(d.t))), 'the course description is not part of Title ↔ Content');
    }

    for (const id of ids) {
      const rec = record(id), pair = sent.find((p) => p.id === id), label = typeof s.scripted === 'string' ? s.scripted : Object.entries(s.scripted).find(([tag]) => id.endsWith(`-${tag}`))[1];
      const disposition = { ALIGNED: S, NOT_ALIGNED: R, PARTIALLY_ALIGNED: F }[label];
      assert.equal(rec.academicJudgment, label);
      assert.equal(rec.status, disposition, `${id}: ${label} maps to ${disposition}`);
      // Evidence: both quotations are exact substrings of the supplied pair text, and the software says it verified them.
      assert.equal(rec.verification, 'quotes_verified');
      assert.ok(pair.source.includes(rec.evidence.sourceQuote) && rec.evidence.sourceQuote.length > 0, 'source quotation comes from the source text');
      assert.ok(pair.target.includes(rec.evidence.targetQuote) && rec.evidence.targetQuote.length > 0, 'target quotation comes from the target text');
      assert.equal(rec.provenance.facultyValidated, false, 'no faculty approval is implied');
      const actions = actionFor(result, id), suggestions = suggestionFor(result, id);
      if (label === 'ALIGNED') {
        assert.equal(actions.length + suggestions.length, 0, 'an aligned relationship offers no correction');
      } else {
        assert.ok(actions.length >= 1, `${id}: a non-aligned relationship produces a recommendation action`);
        assert.ok(actions.every((a) => a.canAutoApply === false && a.requiresHumanReview === true), 'recommendations are never auto-applied');
        // A rewrite is offered only where the relationship has a field to rewrite; the three C3 links are advice only.
        if (!pair.targetPath) assert.equal(suggestions.length, 0, `${id}: an advice-only link offers no field rewrite`);
        assert.ok(suggestions.every((x) => x.source === 'ai' && x.canRefine === true && !('autoApply' in x)), 'suggestions are advisory and must be refined/approved by faculty');
      }
    }

    // The weekly requirement and the overall disposition agree with the records.
    if (s.type !== 'ILO-CLO') {
      const req = result.academic.requirements.find((q) => q.id === `weekly:${rowIndex}:${s.type}`);
      const expected = { ALIGNED: S, NOT_ALIGNED: R, PARTIALLY_ALIGNED: F }[s.scripted];
      assert.equal(req.status, expected, 'the weekly requirement carries the relationship\'s own result');
    } else if (s.id === 'VPAA-R3-ADVERSARIAL') {
      const req = result.academic.requirements.find((q) => q.id === `weekly:${rowIndex}:ILO-CLO`);
      assert.equal(req.status, F, 'a supported mapping plus a disputed extra mapping needs faculty review');
      assert.equal(record(`row${rowIndex}-ilo0-clo:c1`).status, S);
      assert.equal(record(`row${rowIndex}-ilo0-clo:c3`).status, R, 'the incorrect secondary mapping is NOT silently ignored');
    }
    if (s.kind !== 'aligned') assert.notEqual(result.academic.disposition, S, 'a failed relationship prevents a clean disposition');

    // Independence: every other relationship on the lesson keeps exactly what the model said about it.
    for (const type of TYPES.filter((x) => x !== s.type)) {
      for (const [, rec] of result.academic.relationships.filter((x) => x.relationshipType === type && x.id.startsWith(`row${rowIndex}-`)).entries()) assert.equal(rec.status, S, `${rec.id}: unaffected by the ${s.type} result`);
    }

    // Prompt-injection text is data: it travels only inside the request's document data.
    if (s.injection) {
      assert.ok(transport.sent.every((q) => !q.system.includes(s.injection)), 'injected text never enters the system prompt');
      assert.ok(transport.sent.some((q) => JSON.stringify(q.user).includes(s.injection)), 'it is sent only as document data');
      assert.ok(transport.sent.every((q) => /untrusted/i.test(q.system)), 'the system prompt declares the document text untrusted');
      assert.equal(record(ids[0]).status, R, 'the injected instruction did not change the verdict');
    }

    // A compromised or careless model: ALIGNED with quotations that are not in the text must never become a verified pass.
    if (s.kind === 'adversarial' && s.id !== 'VPAA-R3-ADVERSARIAL') {
      const bad = await h.evaluateV2(structuredClone(before), structuredClone(masters), { script: (p) => (ids.includes(p.id) ? { label: 'ALIGNED', sourceQuote: 'A SOURCE QUOTATION THAT IS NOT IN THE SYLLABUS', targetQuote: 'A TARGET QUOTATION THAT IS NOT IN THE SYLLABUS' } : undefined) });
      for (const id of ids) {
        const rec = bad.record(id);
        assert.notEqual(rec.status, S, `${id}: a fabricated quotation cannot produce SUPPORTED`);
        assert.equal(rec.verification, 'unverified');
        assert.equal(rec.academicJudgment, null, 'the unverifiable judgment is discarded');
      }
      assert.notEqual(bad.result.alignment.status, 'completed', 'the check reports that it could not be completed');
    }
  });
}

// ---- cross-cutting relationship conformance ---------------------------------------------------------------------------------------------
test('[VPAA-ACTIVATION] which of the seven relationships run in the application under each configuration (measured, not assumed)', async (t) => {
  h.liveGuard(t);
  const run = async (flags) => {
    const { content, masters } = h.sample();
    const transport = h.scriptedTransport();
    await h.engine.run(content, masters, { useAi: true, env: h.envFor({ SYLLABUS_CHECK_ACADEMIC_V2: 'off', ...flags }), transport, linkChecker: async (url) => ({ url, status: 'ok', httpStatus: 200 }) });
    return new Set(transport.pairs().map((p) => p.type));
  };
  const wanted = ['Content-course', 'Content-ILO', 'ILO-CLO', 'Content-activity', 'ILO-activity', 'Content-assessment', 'Activity-assessment'];
  const def = await run({}), b = await run({ SYLLABUS_CHECK_STAGE_B: 'on' }), c3 = await run({ SYLLABUS_CHECK_STAGE_C3: 'on' }), both = await run({ SYLLABUS_CHECK_STAGE_B: 'on', SYLLABUS_CHECK_STAGE_C3: 'on' });
  // Default production configuration: only the core relationships run. The reverse "ILO-content" half of Content ↔ ILO is core; "Content-ILO" is Stage B.
  assert.deepEqual(wanted.filter((x) => def.has(x)), ['ILO-CLO', 'ILO-activity'], 'DEFAULT: only ILO↔CLO and ILO↔Activities run among the seven');
  assert.ok(def.has('ILO-content'));
  assert.deepEqual(wanted.filter((x) => b.has(x)), ['Content-course', 'Content-ILO', 'ILO-CLO', 'ILO-activity'], 'STAGE_B adds Title↔Content and Content↔ILO');
  assert.deepEqual(wanted.filter((x) => c3.has(x)), ['ILO-CLO', 'Content-activity', 'ILO-activity', 'Content-assessment', 'Activity-assessment'], 'STAGE_C3 adds the three chain links');
  assert.deepEqual(wanted.filter((x) => both.has(x)).sort(), [...wanted].sort(), 'STAGE_B + STAGE_C3 run all seven');
  // Policy V2 (SYLLABUS_CHECK_ACADEMIC_V2=on) runs all seven by itself, regardless of the stage flags.
  const { content, masters } = h.sample(), transport = h.scriptedTransport();
  await h.policy.evaluateIntegrated(content, masters, h.coded, { env: h.envFor({ SYLLABUS_CHECK_STAGE_B: 'off', SYLLABUS_CHECK_STAGE_C3: 'off' }), transport });
  const v2 = new Set(transport.pairs().map((p) => p.type));
  assert.deepEqual(wanted.filter((x) => v2.has(x)).sort(), [...wanted].sort(), 'POLICY V2 runs all seven');
  t.diagnostic(`default runs ${[...def].sort().join(', ')}`);
});

test('[VPAA-MAPPING] every instructional week builds exactly one of each relationship per ILO/CLO, with unique ids and no exam obligations', async (t) => {
  h.liveGuard(t);
  const { content, masters } = h.sample();
  const { result } = await h.evaluateV2(content, masters, {});
  const lessons = content.plan.map((r, i) => ({ r, i })).filter(({ r }) => r.kind !== 'exam');
  const exams = content.plan.map((r, i) => ({ r, i })).filter(({ r }) => r.kind === 'exam');
  const rels = result.academic.relationships;
  assert.equal(new Set(rels.map((x) => x.id)).size, rels.length, 'no duplicate relationship ids');
  for (const type of TYPES) {
    for (const { r, i } of lessons) {
      const expected = type === 'Content-ILO' || type === 'ILO-activity' ? r.ilos.length : type === 'ILO-CLO' ? r.ilos.reduce((n, il) => n + Math.max(1, (il.tags || []).filter((x) => x.startsWith('clo:')).length), 0) : 1;
      assert.equal(rels.filter((x) => x.relationshipType === type && x.id.startsWith(`row${i}-`)).length, expected, `week ${r.week} ${type}`);
    }
    for (const { i } of exams) assert.equal(rels.filter((x) => x.relationshipType === type && x.id.startsWith(`row${i}-`)).length, 0, `exam row ${i} carries no ${type} obligation`);
  }
  assert.equal(result.academic.requirements.filter((x) => TYPES.includes(x.relationshipType)).length, TYPES.length * lessons.length, 'one weekly requirement per relationship per lesson');
});

const MARKER = 'UNIQUE-DESCRIPTION-MARKER this course description must never reach a CLO judgment.';
const CLO_TYPES = /^(Course-CLO|CLO-set|CLO-PO|CLO-EGA|CLO-anyPO|CLO-anyEGA|ILO-CLO|ILO-anyCLO|CLO-coverage|CLO-classification)$/;
test('[VPAA-DESCRIPTION-EXCLUSION] Policy V2: the course description is never evidence for a CLO judgment, and CLO-Description is not a relationship', async (t) => {
  h.liveGuard(t);
  const { content, masters } = h.sample();
  content.description = [{ id: 'd1', t: MARKER }];
  const v2 = await h.evaluateV2(content, masters, {});
  assert.ok(v2.sent.length > 0);
  assert.ok(v2.sent.every((q) => q.user.course.description === ''), 'V2: the shared course context carries no description');
  assert.ok(v2.sent.flatMap((q) => q.user.document_data).filter((p) => CLO_TYPES.test(p.type)).every((p) => !JSON.stringify(p).includes('UNIQUE-DESCRIPTION-MARKER')), 'V2: no CLO pair carries the description');
  assert.ok(v2.sent.every((q) => /Ignore the course description for all CLO-related judgments/.test(q.system)), 'V2: the prompt tells the model to ignore the description for CLO judgments');
  assert.ok(!v2.sent.flatMap((q) => q.user.document_data).some((p) => /CLO.*Description|Description.*CLO/.test(p.type)), 'no CLO-Description relationship exists');
});

// GAP-01 (resolved, backward compatible). Determination: the description never created an excluded CLO ↔ Description RELATIONSHIP (no such pair exists in either path); it was
// SHARED CONTEXT sent with requests that carried CLO relationships. SYLLABUS_CHECK_CLO_DESCRIPTION=off now sends such a request without it, exactly as Policy V2 does. It is OFF by
// default so every existing request stays byte for byte what it was (the alignment-10 pins prove that), and the shared service turns it on for the legacy run of a check while Policy V2
// is on. What can still appear in the same request is the description as the OWN evidence of a Description-plan or Plan-sequence pair that shares the batch; each pair is judged on its
// own text, and Policy V2 batches the same way.
const LEGACY_STAGES = { SYLLABUS_CHECK_ACADEMIC_V2: 'off', SYLLABUS_CHECK_STAGE_A: 'on', SYLLABUS_CHECK_STAGE_B: 'on', SYLLABUS_CHECK_STAGE_B3: 'on', SYLLABUS_CHECK_STAGE_B4: 'on', SYLLABUS_CHECK_STAGE_C3: 'on' };
const legacyRun = async (env, over = {}) => {
  const { content, masters } = h.sample();
  content.description = [{ id: 'd1', t: MARKER }];
  const transport = h.scriptedTransport();
  await h.engine.run(structuredClone(content), masters, { useAi: true, env: h.envFor({ ...LEGACY_STAGES, ...env }), transport, linkChecker: async (url) => ({ url, status: 'ok', httpStatus: 200 }), ...over });
  return transport;
};
const cloRequests = (transport) => transport.sent.filter((q) => q.user.document_data.some((p) => CLO_TYPES.test(p.type)));

test('[VPAA-DESCRIPTION-EXCLUSION-LEGACY] GAP-01 regression: with SYLLABUS_CHECK_CLO_DESCRIPTION=off no request with a CLO relationship carries the course description', async (t) => {
  h.liveGuard(t);
  const transport = await legacyRun({ SYLLABUS_CHECK_CLO_DESCRIPTION: 'off' });
  assert.ok(cloRequests(transport).length > 0, 'the legacy path asked CLO relationships');
  assert.ok(cloRequests(transport).every((q) => q.user.course.description === ''), 'every request that carries a CLO relationship has no shared course description');
  assert.equal(transport.sent.flatMap((q) => q.user.document_data).filter((p) => CLO_TYPES.test(p.type) && JSON.stringify(p).includes('UNIQUE-DESCRIPTION-MARKER')).length, 0, 'no CLO relationship pair carries the description');
  assert.ok(!transport.sent.flatMap((q) => q.user.document_data).some((p) => /CLO.*Description|Description.*CLO/.test(p.type)), 'and CLO ↔ Description is not a relationship');
  assert.ok(transport.sent.filter((q) => !q.user.document_data.some((p) => CLO_TYPES.test(p.type))).some((q) => q.user.course.description.includes('UNIQUE-DESCRIPTION-MARKER')), 'the constraint is scoped: requests with no CLO relationship keep the description');
});

test('[VPAA-DESCRIPTION-EXCLUSION-DEFAULT] GAP-01: with the switch unset (the default) the legacy requests are unchanged: the description is still in the shared context', async (t) => {
  h.liveGuard(t);
  for (const value of [undefined, '', 'on', 'true']) {
    const transport = await legacyRun(value === undefined ? {} : { SYLLABUS_CHECK_CLO_DESCRIPTION: value });
    assert.ok(cloRequests(transport).some((q) => q.user.course.description.includes('UNIQUE-DESCRIPTION-MARKER')), `switch ${JSON.stringify(value)}: only the exact value "off" changes a request`);
  }
});

test('[VPAA-DESCRIPTION-EXCLUSION-V2] GAP-01: through the shared service with Policy V2 on, NO request of the check (legacy or V2) carries the description with a CLO relationship', async (t) => {
  h.liveGuard(t);
  const svc = require('../../compliance/service'), repo = require('../repository'), { createMemoryDb } = require('./memdb');
  const { content, masters } = h.sample(); masters.fingerprint = 'fp'; masters.synthetic = false; content.description = [{ id: 'd1', t: MARKER }];
  t.mock.method(repo, 'mastersFor', async () => masters);
  const transport = h.scriptedTransport();
  await svc.checkHybrid(createMemoryDb({ syllabus: { content: JSON.stringify(content) } }), content, { syllabusId: 100, env: h.envFor({ SYLLABUS_CHECK_ACADEMIC_V2: 'on', SYLLABUS_CHECK_STAGE_A: 'on' }), transport, linkChecker: async (url) => ({ url, status: 'ok', httpStatus: 200 }) });
  const legacy = transport.sent.filter((q) => !/academic-evaluation-v2/.test(q.system)), v2 = transport.sent.filter((q) => /academic-evaluation-v2/.test(q.system));
  assert.ok(cloRequests({ sent: legacy }).length > 0 && v2.length > 0, 'both paths asked CLO relationships');
  assert.ok(cloRequests(transport).every((q) => q.user.course.description === ''), 'no request with a CLO relationship carries the shared description');
  assert.equal(transport.sent.flatMap((q) => q.user.document_data).filter((p) => CLO_TYPES.test(p.type) && JSON.stringify(p).includes('UNIQUE-DESCRIPTION-MARKER')).length, 0);
});

test('[VPAA-DESCRIPTION-EXCLUSION-REUSE] GAP-01: with the switch on, editing only the description does not re-ask a CLO relationship, but does re-ask what the description is evidence for', async (t) => {
  h.liveGuard(t);
  const env = h.envFor({ ...LEGACY_STAGES, SYLLABUS_CHECK_CLO_DESCRIPTION: 'off' }), link = async (url) => ({ url, status: 'ok', httpStatus: 200 });
  const { content, masters } = h.sample();
  const first = await h.engine.run(structuredClone(content), masters, { useAi: true, env, transport: h.scriptedTransport(), linkChecker: link });
  const reuse = new Map(first.hybrid.alignment.judgements.filter((j) => j.key && !j.unverified && j.label !== 'INSUFFICIENT_EVIDENCE').map((j) => [j.key, j]));
  const askedFirst = new Set(first.hybrid.alignment.judgements.map((j) => j.type)), cloTypes = [...askedFirst].filter((x) => CLO_TYPES.test(x));
  assert.ok(cloTypes.length > 0 && askedFirst.has('Description-plan'));
  const edited = structuredClone(content); edited.description = [{ id: 'd1', t: 'A completely different description of the same course.' }];
  const transport = h.scriptedTransport();
  await h.engine.run(edited, masters, { useAi: true, env, transport, reuse, linkChecker: link });
  const asked = new Set(transport.pairs().map((p) => p.type));
  for (const type of cloTypes) assert.ok(!asked.has(type), `${type} is reused: the description is not part of its question`);
  assert.ok(asked.has('Description-plan'), 'the description-dependent relationship is asked again');
});

test('[VPAA-INSUFFICIENT-JUNK] whitespace-only and empty-markup text (empty bullet, empty bold) counts as missing evidence in every lesson field', async (t) => {
  h.liveGuard(t);
  const junk = ['', '   ', '\n\n', '\t', '- ', '****', '- ****'];
  const fields = [['contents', ['Content-course', 'Content-ILO', 'Content-activity', 'Content-assessment']], ['activities', ['Content-activity', 'ILO-activity', 'Activity-assessment']], ['tasks', ['Content-assessment', 'Activity-assessment']]];
  for (const [field, types] of fields) {
    for (const value of junk) {
      const { content, masters, rowIndex } = h.syllabus({ [field]: value });
      const { transport, record, result } = await h.evaluateV2(content, masters, {});
      for (const type of types) {
        const rec = result.academic.relationships.find((x) => x.relationshipType === type && x.id.startsWith(`row${rowIndex}-`));
        assert.ok(rec, type);
        assert.equal(rec.status, 'NOT_CHECKED', `${field}=${JSON.stringify(value)} → ${type} must be missing evidence`);
        assert.ok(!transport.pairs().some((p) => p.id === rec.id), `${field}=${JSON.stringify(value)} → ${type} is not sent`);
      }
    }
  }
});

test('[VPAA-LEGACY-PARITY] with Stage B and C3 on, the production hybrid path judges each relationship the same way as Policy V2 for the same scripted answer', async (t) => {
  h.liveGuard(t);
  for (const s of SCENARIOS.filter((x) => (x.kind === 'aligned' || x.kind === 'misaligned') && x.n !== 3)) {
    const { content, masters, rowIndex } = h.syllabus(s.input);
    const [id] = pairIds(s, rowIndex, content);
    const transport = h.scriptedTransport(scriptFor(s, [id]));
    const result = await h.engine.run(content, masters, { useAi: true, env: h.envFor({ SYLLABUS_CHECK_ACADEMIC_V2: 'off', SYLLABUS_CHECK_STAGE_B: 'on', SYLLABUS_CHECK_STAGE_C3: 'on' }), transport, linkChecker: async (url) => ({ url, status: 'ok', httpStatus: 200 }) });
    const j = result.hybrid.alignment.judgements.find((x) => x.id === id);
    assert.ok(j, `${s.id}: the hybrid path asked about ${id}`);
    assert.equal(j.label, s.scripted, `${s.id}`);
    assert.ok(!j.unverified, 'verified');
  }
});

test('[VPAA-CONTENT-FIRST] authoring order Course Content → ILO → Activities → Assessment is enforced for new lesson rows only', async () => {
  const { orderedLesson, canCreateIlo, canEditLessonField } = await import('../../../../src/lib/lessonAuthoring.js');
  const fresh = (o = {}) => ({ kind: 'lesson', authoringOrder: 1, contents: '', activities: '', tasks: '', ilos: [{ text: '' }], ...o });
  assert.equal(orderedLesson(fresh()), true);
  assert.equal(canCreateIlo(fresh()), false, 'no ILO before Course Content');
  assert.equal(canEditLessonField(fresh(), 'ilo', ''), false);
  assert.equal(canEditLessonField(fresh({ contents: 'Loops' }), 'ilo', ''), true);
  assert.equal(canEditLessonField(fresh({ contents: 'Loops' }), 'activities', ''), false, 'no activity before an ILO');
  assert.equal(canEditLessonField(fresh({ contents: 'Loops', ilos: [{ text: 'Implement loops' }] }), 'activities', ''), true);
  assert.equal(canEditLessonField(fresh({ contents: 'Loops', ilos: [{ text: 'Implement loops' }] }), 'tasks', ''), false, 'no task before an activity');
  assert.equal(canEditLessonField(fresh({ contents: 'Loops', ilos: [{ text: 'Implement loops' }], activities: '- Lab' }), 'tasks', ''), true);
  assert.equal(canEditLessonField(fresh({ ilos: [{ text: 'Existing ILO' }] }), 'ilo', 'Existing ILO'), true, 'clearing content never locks text that is already written');
  const legacy = { kind: 'lesson', contents: '', ilos: [{ text: '' }] };
  assert.equal(orderedLesson(legacy), false);
  assert.equal(canCreateIlo(legacy), true, 'legacy rows and imports are never locked');
  assert.equal(orderedLesson({ kind: 'exam', authoringOrder: 1 }), false, 'exam rows are exempt');
});

// ---- content presence: what counts as "something was written" (shared/contentPresence.cjs) -----------------------------------------------
test('[VPAA-PRESENCE-CONTRACT] the documented presence rule: unmatched markers are literal content; an empty bullet or empty bold is not', () => {
  const { hasContent } = require('../../../../shared/contentPresence.cjs');
  for (const empty of ['', '   ', '\n\n', '\t', '- ', '****', '- ****']) assert.equal(hasContent(empty), false, JSON.stringify(empty));
  for (const literal of ['**', '- Quiz', '**x**', 'int **p;', '<b>']) assert.equal(hasContent(literal), true, JSON.stringify(literal));
});

// DEF-01 (fixed): text made only of invisible characters is blank. Authored text is never altered, and text that merely CONTAINS an invisible character is still text.
test('[VPAA-PRESENCE-INVISIBLE] DEF-01 regression: text made only of zero-width or other invisible characters counts as missing', () => {
  const { hasContent } = require('../../../../shared/contentPresence.cjs');
  for (const invisible of ['​', '‌', '‍', '⁠', '﻿', '­', '‎', '‪', '​​', ' ​\n﻿\t', '- ​', '**​**']) assert.equal(hasContent(invisible), false, JSON.stringify(invisible));
  for (const written of ['a​b', '​x', 'x﻿', '**', '- Quiz', 'int **p;', 'ก‍ข']) assert.equal(hasContent(written), true, JSON.stringify(written));
});

test('[VPAA-PRESENCE-INVISIBLE-RULES] DEF-01 regression: an invisible-only field is flagged by the scored presence rules and never reaches the model', async (t) => {
  h.liveGuard(t);
  const { evaluate } = require('../../compliance/rules');
  const standard = require('../../compliance/standard-v4.json');
  const F = require('../../compliance/fixtures');
  const c = F.good(); c.meta.code = '​'; c.plan.find((r) => r.kind === 'lesson').values = '​‌';
  const res = evaluate(c, standard, F.ctx());
  assert.ok(res.findings.some((f) => f.ruleId === 'T-01'), 'T-01: the course code is blank');
  assert.ok(res.findings.some((f) => f.ruleId === 'T-16' && (f.evidence?.empty || []).includes('values')), 'T-16: the lesson has no value');
  const fx = h.syllabus({ activities: '​' });
  const { transport, result } = await h.evaluateV2(fx.content, fx.masters, {});
  assert.ok(!transport.pairs().some((p) => p.id === `row${fx.rowIndex}-contentactivity`), 'an invisible-only side is not sent to the model');
  assert.equal(result.academic.relationships.find((r) => r.id === `row${fx.rowIndex}-contentactivity`).status, 'NOT_CHECKED');
});
