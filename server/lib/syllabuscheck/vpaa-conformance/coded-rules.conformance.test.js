'use strict';
// VPAA conformance, Task 4: the 47 deterministic rules, one at a time, plus the official scoring invariants (threshold 79, six weighted areas,
// authorized deductions). Nothing here changes a rule, a weight or the pass mark; it only measures them.
const test = require('node:test');
const assert = require('node:assert/strict');
const standard = require('../../compliance/standard-v4.json');
const { evaluate } = require('../../compliance/rules');
const { CASES, F } = require('./coded-rules.cases');
const h = require('./harness');
const { POLICY } = require('../policy');

const clone = (x) => structuredClone(x);
// One rule alone, so any finding or area score belongs to it. `applicable` = the rule produced something to judge (its area has a score).
function only(rule, mutate) {
  const content = F.good(), ctx = F.ctx();
  if (mutate) mutate(content, ctx);
  const res = evaluate(content, { ...standard, rules: [rule] }, ctx);
  const area = res.areas.find((a) => a.key === rule.area);
  return { res, finding: res.findings.filter((f) => f.ruleId === rule.id), applicable: area.score !== null, score: area.score };
}
const full = (mutate) => { const content = F.good(), ctx = F.ctx(); if (mutate) mutate(content, ctx); return evaluate(content, standard, ctx); };

test('[VPAA-R11-COUNT] the standard has exactly 47 rules with unique ids, and every rule has a conformance case', () => {
  assert.equal(standard.rules.length, 47);
  assert.equal(new Set(standard.rules.map((r) => r.id)).size, 47);
  assert.deepEqual(Object.keys(CASES).sort(), standard.rules.map((r) => r.id).sort(), 'the case table covers every rule and nothing else');
});

test('[VPAA-R11-BASELINE] the conforming synthetic syllabus passes all 47 rules with no finding and full credit', () => {
  const res = full();
  assert.deepEqual(res.findings, []);
  assert.equal(res.overall, 100);
  assert.equal(res.passed, true);
  assert.ok(res.areas.every((a) => a.score === 100));
});

for (const rule of standard.rules) {
  const c = CASES[rule.id];
  test(`[VPAA-R11-${rule.id}] ${rule.check} (${rule.severity}, ${rule.area}): valid, invalid and missing-field behaviour`, () => {
    // VALID: no finding, and full credit wherever the rule applies.
    const valids = [['the conforming syllabus', undefined, undefined], ...(c.valid || []).map(([n, m]) => [n, m]), ...(c.ctxValid ? [['valid context', (_, ctx) => Object.assign(ctx, c.ctxValid)]] : [])];
    for (const [name, mutate] of valids) {
      const r = only(rule, mutate);
      assert.equal(r.finding.length, 0, `${rule.id} valid case "${name}" must raise no finding: ${r.finding.map((f) => f.message).join(' | ')}`);
      if (r.applicable) assert.equal(r.score, 100, `${rule.id} valid case "${name}" earns full credit`);
    }
    // INVALID: a finding for this rule, with its declared severity and area, and credit withheld.
    const [invName, invMutate] = c.invalid;
    const inv = only(rule, invMutate);
    assert.ok(inv.finding.length >= 1, `${rule.id} must flag: ${invName}`);
    assert.ok(inv.finding.every((f) => f.severity === rule.severity && f.area === rule.area && f.step === rule.step), 'finding keeps the rule\'s severity, area and step');
    assert.ok(inv.finding.every((f) => f.message && !/\{\w+\}/.test(f.message)), 'the message is fully filled in (no raw {placeholders})');
    assert.ok(inv.finding.every((f) => f.path), 'every finding names the field to fix');
    assert.ok(inv.applicable && inv.score < 100, `${rule.id}: invalid content must not earn full credit (area score ${inv.score})`);
    if (c.invalidBoundary) assert.ok(only(rule, c.invalidBoundary[1]).finding.length >= 1, `${rule.id} boundary: ${c.invalidBoundary[0]}`);
    // MISSING FIELD: flagged, or explicitly neutral (not applicable) with a companion rule that catches the absence.
    const [missName, missMutate] = c.missing;
    const miss = only(rule, missMutate);
    if (c.scope) {
      // SCOPE-LIMITED: the rule judges one narrow property, so with the field absent it still applies and passes ON THAT PROPERTY (it earns its
      // own share); the absence itself must be flagged by a companion rule. Declared, measured and reported in the coverage matrix.
      assert.equal(miss.finding.length, 0, `${rule.id} "${missName}": judges only its narrow property`);
      assert.equal(miss.applicable, true);
      const whole = full(missMutate);
      for (const id of c.companion) assert.ok(whole.findings.some((f) => f.ruleId === id), `${rule.id} "${missName}": companion ${id} must flag the absence`);
    } else if (c.na) {
      assert.equal(miss.finding.length, 0, `${rule.id} "${missName}": declared neutral`);
      assert.equal(miss.applicable, false, `${rule.id} "${missName}": neutral means the rule contributes neither credit nor deduction`);
      if ((c.companion || []).length) {
        const whole = full(missMutate);
        for (const id of c.companion) assert.ok(whole.findings.some((f) => f.ruleId === id), `${rule.id} "${missName}": companion ${id} catches it`);
      }
    } else {
      assert.ok(miss.finding.length >= 1, `${rule.id} must flag the missing field: ${missName}`);
      assert.ok(miss.score < 100, `${rule.id}: a missing field never earns credit`);
    }
    // THE WHOLE STANDARD: a blocking finding stops the submit whatever the score; a non-blocking one never does.
    const wholeInvalid = full(invMutate);
    assert.ok(wholeInvalid.findings.some((f) => f.ruleId === rule.id));
    assert.equal(wholeInvalid.conformance.failed.some((f) => f.ruleId === rule.id), rule.severity === 'blocking');
    if (rule.severity === 'blocking') assert.equal(wholeInvalid.passed, false, `${rule.id} is blocking: passed must be false`);
  });
}

test('[VPAA-R10-THRESHOLD] the official pass mark is 79, the bands and the six weighted areas are unchanged', () => {
  assert.equal(standard.passThreshold, 79);
  assert.deepEqual(standard.bands, [{ min: 90, label: 'Excellent' }, { min: 79, label: 'Meets the standard' }, { min: 0, label: 'Needs work' }]);
  assert.deepEqual(standard.areas.map((a) => [a.key, a.weight]), [['template', 20], ['completeness', 20], ['co_po', 20], ['assessment', 15], ['contact_hours', 10], ['reference_currency', 15]]);
  assert.equal(standard.areas.reduce((s, a) => s + a.weight, 0), 100);
  assert.equal(standard.constants.gradingTotal, 100);
  assert.equal(standard.constants.weeksPerTerm, 18);
});

test('[VPAA-R10-PASS-LOGIC] passed is exactly (overall ≥ 79 and no blocking finding), for every single-rule failure', () => {
  for (const rule of standard.rules) {
    const res = full(CASES[rule.id].invalid[1]);
    assert.equal(res.passed, res.overall !== null && res.overall >= 79 && res.conformance.failed.length === 0, `${rule.id}: overall ${res.overall}, blocking ${res.conformance.failed.length}`);
    assert.equal(res.passThreshold, 79);
  }
});

test('[VPAA-R10-BLOCKING-OVERRIDES-SCORE] a blocking failure stops the pass even when the score is above 79; a non-blocking failure alone does not', () => {
  const blocking = full((c) => { c.meta.code = ''; });
  assert.ok(blocking.overall >= 79, `score ${blocking.overall} is above the pass mark`);
  assert.equal(blocking.passed, false, 'still not passed: the course code is a blocking rule');
  const minor = full(CASES['T-17'].invalid[1]);
  assert.ok(minor.findings.length > 0 && minor.conformance.ok === true && minor.overall >= 79);
  assert.equal(minor.passed, true, 'a minor-only failure keeps the pass');
});

test('[VPAA-R10-SCORE-CAP] the score reflects weights: a failed high-weight rule costs more than a failed low-weight one in the same area', () => {
  const heavy = full(CASES['T-24'].invalid[1]), light = full(CASES['T-18'].invalid[1]);
  assert.ok(heavy.overall < light.overall, `T-24 (weight 4) ${heavy.overall} < T-18 (weight 1) ${light.overall}`);
});

test('[VPAA-R10-INSUFFICIENT] an almost-empty draft is "not enough content", never a low score or a pass', () => {
  const res = evaluate(F.empty(), standard, F.ctx());
  assert.equal(res.status, 'insufficient');
  assert.equal(res.overall, null);
  assert.equal(res.passed, false);
  assert.ok(res.areas.every((a) => a.score === null));
});

test('[VPAA-R11-HYBRID-44] Hybrid-2 applies 44 of the 47 rules: C-04, R-02 and R-03 are replaced by link checks', () => {
  const content = F.good(), { masters } = h.sample();
  Object.assign(content, h.sample().content);
  content.refs = { books: { na: false, items: [{ id: 'a', t: 'Undated reference without a year' }] }, program: { na: true, items: [] }, online: { na: true, items: [] }, electronics: { na: true, items: [] } };
  const hybrid = h.engine.coded(content, masters).base.findings.map((f) => f.ruleId);
  for (const id of ['C-04', 'R-02', 'R-03']) assert.ok(!hybrid.includes(id), `${id} is not applied in Hybrid-2`);
  const legacy = evaluate(content, standard, { year: 2026 }).findings.map((f) => f.ruleId);
  assert.ok(legacy.includes('C-04') && legacy.includes('R-02'), 'the full 47-rule standard (browser parity) still has them');
});

test('[VPAA-R10-DEDUCTIONS] the authorized hybrid deductions are unchanged: alignment 3, partial 1, link 2, value 1; advisory relationships cost nothing', async (t) => {
  h.liveGuard(t);
  assert.equal(POLICY.alignment, 3); assert.equal(POLICY.partialAlignment, 1); assert.equal(POLICY.link, 2); assert.equal(POLICY.value, 1);
  const run = async ({ label, type, flags = {}, linkStatus = 'ok', mutate }) => {
    const { content, masters } = h.sample();
    if (mutate) mutate(content);
    const transport = h.scriptedTransport((p) => (p.type === type ? { label } : undefined));
    return h.engine.run(content, masters, { useAi: true, env: h.envFor({ SYLLABUS_CHECK_ACADEMIC_V2: 'off', ...flags }), transport, linkChecker: async (url) => ({ url, status: linkStatus, ...(linkStatus === 'redirected' ? { httpStatus: 301 } : {}) }) });
  };
  const points = (r, re) => r.hybrid.deductions.filter((d) => re.test(d.id)).map((d) => d.points);
  assert.deepEqual([...new Set(points(await run({ label: 'NOT_ALIGNED', type: 'ILO-CLO' }), /^SEM:row\d+-ilo\d+-clo/))], [3], 'NOT_ALIGNED costs 3');
  assert.deepEqual([...new Set(points(await run({ label: 'PARTIALLY_ALIGNED', type: 'ILO-CLO' }), /^SEM:row\d+-ilo\d+-clo/))], [1], 'PARTIALLY_ALIGNED costs 1');
  const advisory = await run({ label: 'NOT_ALIGNED', type: 'Content-course', flags: { SYLLABUS_CHECK_STAGE_B: 'on' } });
  assert.deepEqual(points(advisory, /^SEM:row\d+-content$/), [], 'an advisory relationship costs no points');
  const base = await run({ label: 'ALIGNED', type: 'ILO-CLO' });
  assert.equal(advisory.score, base.score, 'an advisory failure does not change the score');
  assert.ok(points(await run({ label: 'ALIGNED', type: 'ILO-CLO', linkStatus: 'redirected', mutate: (c) => { c.refs.online.items.push({ id: 'l', t: 'Example (2026). https://example.org/page' }); } }), /^LINK:/).every((p) => p === 2), 'a bad link costs 2');
});

// LIMITATION LIM-01 (characterization, not a defect): the 47 rules test PRESENCE and FORM, not quality. A placeholder earns presence credit; the
// advisory STR-05 flags it but, by design, does not change the official score. Changing that would change official scoring, which is out of scope.
test('[VPAA-R11-PLACEHOLDER] LIM-01: placeholder text satisfies the presence rules; only the advisory STR-05 flags it, and the score is unchanged', () => {
  const { verdictFindingsOf } = require('./verdict-adapter');
  for (const filler of ['TBD', 'n/a', 'Lorem ipsum dolor sit amet']) {
    const res = full((c) => { c.plan[0].values = filler; });
    const valuesEmpty = (r) => r.findings.some((f) => f.ruleId === 'T-16' && f.path === 'plan[0]' && (f.evidence?.empty || []).includes('values'));
    assert.equal(valuesEmpty(full((c) => { c.plan[0].values = ''; })), true, 'control: an EMPTY values cell is flagged by T-16, so this probe can fail');
    assert.equal(valuesEmpty(res), false, `"${filler}" is accepted as present by T-16`);
    assert.equal(res.overall, 100);
    const str05 = verdictFindingsOf((() => { const { content } = h.sample(); content.plan[0].values = filler; return content; })()).filter((f) => f.ruleId === 'STR-05');
    assert.ok(str05.length >= 1, `STR-05 (advisory) flags "${filler}"`);
  }
});
