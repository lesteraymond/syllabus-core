const test = require('node:test');
const assert = require('node:assert/strict');
const { shadowOf, SHADOW } = require('./scoring');
const { sample } = require('./fixtures');
const { run } = require('./engine');

const d = (id, points, path, kind = 'alignment') => ({ id, points, reason: 'x', kind, path });

test('a field that takes part in several relationships is charged once, for its most serious one', () => {
  const s = shadowOf({ base: 90, deductions: [d('SEM:a', 1, 'plan[0].tasks'), d('SEM:b', 3, 'plan[0].tasks'), d('SEM:c', 1, 'plan[1].tasks')] });
  assert.equal(s.deducted, 4, '3 for the field charged twice + 1 for the other');
  assert.equal(s.score, 86);
});

test('each kind of deduction is limited, and the report says what was limited', () => {
  const many = Array.from({ length: 40 }, (_, i) => d('SEM:' + i, 3, 'plan[' + i + '].tasks'));
  const s = shadowOf({ base: 95, deductions: many });
  assert.equal(s.deducted, SHADOW.caps.alignment);
  assert.deepEqual(s.capped, [{ kind: 'alignment', wouldTake: 120, takes: SHADOW.caps.alignment }]);
  assert.equal(s.score, 95 - SHADOW.caps.alignment, 'a long syllabus cannot be taken to 0 by alignment findings alone');
});

test('links and core values have their own limits', () => {
  const s = shadowOf({ base: 100, deductions: [...Array.from({ length: 12 }, (_, i) => d('LINK:' + i, 2, 'refs:https://example.org/' + i, 'link')), ...Array.from({ length: 15 }, (_, i) => d('VALUE:' + i, 1, 'plan[' + i + '].values', 'value'))] });
  assert.deepEqual([s.byKind.link, s.deducted], [24, 10 + 10]);
});

test('a critical curriculum mismatch is still 0 and a small syllabus scores the same as the official model', () => {
  assert.equal(shadowOf({ base: 80, deductions: [d('SEM:a', 3, 'x')], critical: true }).score, 0);
  const small = [d('SEM:a', 3, 'plan[0].tasks'), d('SEM:b', 1, 'plan[1].tasks'), d('LINK:u', 2, 'refs', 'link')];
  assert.equal(shadowOf({ base: 88, deductions: small }).score, 88 - 6);
});

test('the engine reports both scores, and the official one is untouched by the shadow', async () => {
  const { content, masters } = sample();
  const transport = async (url, req) => {
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    const answer = p => ({ id: p.id, label: 'NOT_ALIGNED', explanation: 'No.', sourceQuote: p.source.slice(0, 12), targetQuote: p.target.slice(0, 12), sourceBloom: 'Apply', targetBloom: 'Apply', draft: 'A rewrite.' });
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(answer) }) }] } }] }) };
  };
  const r = await run(content, masters, { useAi: true, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }), env: { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'x' }, transport });
  const total = r.hybrid.deductions.reduce((n, x) => n + x.points, 0);
  assert.equal(r.hybrid.scoring.official.deducted, total);
  assert.equal(r.hybrid.scoring.official.score, r.hybrid.provisionalScore);
  assert.equal(r.hybrid.provisionalScore, Math.max(0, r.baseScore - total), 'the official model is exactly the old one: uncapped');
  assert.ok(r.hybrid.scoring.shadow.score >= r.hybrid.provisionalScore, 'the shadow never scores below the official model');
  assert.ok(r.hybrid.deductions.every(x => x.kind && x.path), 'each deduction says its kind and field');
});
