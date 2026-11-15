// Content first (VPAA requirement VR-14: Course Content -> ILO -> Learning Activities -> Assessment Tasks; the owner's decision of 2026-11-12: everywhere):
// the week's course content is the anchor, so an ILO-content answer never rewrites the contents to fit the ILO. The contents are rewritten only when
// they are themselves judged off-course (Content-course, Stage B).
//
// The whole-syllabus plan follows the same rule (wholeSyllabusPlan.test.js): it re-fits an ILO to its week's content, never the content to the ILO.
// ILO-content is advisory (policy.js): it never costs points. Scripted transport only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('./fixtures');
const { run } = require('./engine');

const B_ON = { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only', SYLLABUS_CHECK_STAGE_B: 'on' };
const base = { useAi: true, linkChecker: async (url) => ({ url, status: 'ok', httpStatus: 200 }) };
function scripted(decide) {
  return async (url, req) => {
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    const answer = (pair) => { const v = decide(pair); return { id: pair.id, label: v.label, explanation: 'Judged.', sourceQuote: pair.source.slice(0, 14), targetQuote: pair.target.slice(0, 14), sourceBloom: 'Apply', targetBloom: 'Apply', draft: v.draft || '' }; };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(answer) }) }] } }] }) };
  };
}
const contentsRewrites = (result) => (result.hybrid.suggestions || []).filter((s) => /^plan\[\d+\]\.contents$/.test(s.path));
const pointsOf = (result) => (result.hybrid.deductions || []).reduce((sum, d) => sum + Number(d.points || 0), 0);
const iloContentWrong = (pair) => (pair.type === 'ILO-content' ? { label: 'PARTIALLY_ALIGNED', draft: 'Rewritten contents chosen to fit the ILO' } : { label: 'ALIGNED' });

test('Stage B on, the content fits the course: an ILO-content answer does not rewrite the course contents', async () => {
  const { content, masters } = sample();
  const result = await run(content, masters, { ...base, env: B_ON, transport: scripted(iloContentWrong) });
  assert.deepEqual(contentsRewrites(result), []);
});

test('Stage B on, the content is off-course: the contents may be rewritten, because the content itself was judged wrong', async () => {
  const { content, masters } = sample();
  const decide = (pair) => (pair.id === 'row2-content' ? { label: 'NOT_ALIGNED', draft: 'Java conditional statements: if, if-else and switch' } : { label: 'ALIGNED' });
  const result = await run(content, masters, { ...base, env: B_ON, transport: scripted(decide) });
  assert.ok(contentsRewrites(result).some((s) => s.path === 'plan[2].contents'));
});

test('ILO-content is advisory: the score is the same whether its answers are aligned or not', async () => {
  const { content, masters } = sample();
  const aligned = await run(content, masters, { ...base, env: B_ON, transport: scripted(() => ({ label: 'ALIGNED' })) });
  const wrong = await run(content, masters, { ...base, env: B_ON, transport: scripted(iloContentWrong) });
  assert.equal(pointsOf(wrong), pointsOf(aligned));
  assert.equal(wrong.overall, aligned.overall);
});

// ---- Content first with Stage B off (the owner's decision of 2026-11-12: content first everywhere) ----
// With Stage B off nothing judges the week's contents against the course, so there is no evidence the contents are the part that is wrong. A real
// check of IT 202 on 2026-11-05 (Stage B off) nevertheless rewrote the course contents of 10 weeks to fit their ILOs.
const OFF = { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only' };

test('Stage B off: an ILO-content answer never rewrites the course contents; its finding is still reported, at no cost', async () => {
  const { content, masters } = sample();
  const result = await run(content, masters, { ...base, env: OFF, transport: scripted(iloContentWrong) });
  assert.deepEqual(contentsRewrites(result), []);
  assert.ok((result.findings || []).some((f) => /^SEM:row\d+-ilo\d+-content$/.test(f.id)), 'the author still sees the finding');
  assert.ok(!(result.hybrid.deductions || []).some((d) => /-content$/.test(String(d.id))), 'and it costs nothing');
});

test('Stage B off: the score is the same whether the ILO-content answers are aligned or not', async () => {
  const { content, masters } = sample();
  const aligned = await run(content, masters, { ...base, env: OFF, transport: scripted(() => ({ label: 'ALIGNED' })) });
  const wrong = await run(content, masters, { ...base, env: OFF, transport: scripted(iloContentWrong) });
  assert.equal(pointsOf(wrong), pointsOf(aligned));
  assert.equal(wrong.overall, aligned.overall);
});
