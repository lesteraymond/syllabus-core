const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('./fixtures');
const requirements = require('./requirementsAdvice');
const { run } = require('./engine');
const { buildVerdict } = require('./verdict');
const { catalog } = require('./ruleCatalog');

// School rule (2026-11-11): Week 1 is the orientation and Week 2 starts the first topic of the course (PLAN-12, advice only, with the Week 1 check
// under SYLLABUS_CHECK_REQUIREMENTS_ADVICE=on). Scripted transport only.
const week2 = content => requirements.pairsOf(content).filter(p => p.type === 'Week2-topic');
const options = { useAi: true, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }), env: { SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-only', OPENROUTER_MODEL: 'nvidia/nemotron-3-ultra-550b-a55b:free', SYLLABUS_CHECK_REQUIREMENTS_ADVICE: 'on' } };

test('the Week 2 question carries the course, its objectives and the Week 1 orientation, and judges the Week 2 row', () => {
  const { content } = sample();
  content.plan[0].contents = 'Course orientation: outline, policies and grading';
  content.plan[1].contents = 'Topic 2: variables and data types';
  const [p] = week2(content);
  assert.equal(p.id, 'row1-week2firsttopic');
  assert.equal(p.path, 'plan[1].contents');
  assert.equal(p.targetPath, null, 'advice only: never rewrites the field');
  assert.match(p.source, /Course objectives \(CLOs\)/);
  assert.match(p.source, /Week 1 \(orientation\) content: Course orientation/);
  assert.match(p.target, /^Week 2\nTopic 2: variables and data types/);
});

test('a missing Week 2 stays an explicit empty question (never a pass), and a grouped Week 1-2 row says so', () => {
  const { content } = sample();
  const none = structuredClone(content); none.plan = none.plan.filter(row => row.week !== '2');
  assert.deepEqual(week2(none).map(p => [p.id, p.target]), [['requirements-week2-missing', '']]);
  const grouped = structuredClone(content); grouped.plan[0].week = '1-2';
  const [p] = week2(grouped);
  assert.match(p.source, /Week 1 and Week 2 are one grouped row/);
});

test('it is a registered advisory rule: PLAN-12 in the catalogue, no points, and the AI answer becomes a PLAN-12 finding', async () => {
  assert.ok(requirements.TYPES.includes('Week2-topic'));
  assert.match(requirements.TESTS, /Week2-topic \(advice only\): judge whether Week 2 begins the first real topic/);
  assert.ok(catalog.some(r => r.ruleId === 'PLAN-12' && r.flag === 'SYLLABUS_CHECK_REQUIREMENTS_ADVICE'));
  const { content, masters } = sample();
  content.plan[1].contents = 'Course outline, class policies and grading (continued)';
  const transport = async (url, req) => {
    const pairs = JSON.parse(JSON.parse(req.body).messages[1].content).document_data;
    const answer = p => p.type === 'Week2-topic'
      ? { id: p.id, label: 'NOT_ALIGNED', explanation: 'Week 2 continues the orientation instead of starting the first topic.', sourceQuote: p.source.slice(0, 6), targetQuote: p.target.slice(0, 6), sourceBloom: 'N/A', targetBloom: 'N/A', draft: 'Start the first course topic in Week 2 and keep the outline and policies in Week 1.' }
      : { id: p.id, label: 'ALIGNED', explanation: 'Fits.', sourceQuote: p.source.slice(0, 5), targetQuote: p.target.slice(0, 5), sourceBloom: 'Apply', targetBloom: 'Apply', draft: '' };
    return { ok: true, json: async () => ({ model: options.env.OPENROUTER_MODEL, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ judgements: pairs.map(answer) }) } }] }) };
  };
  const result = await run(content, masters, { ...options, transport });
  const j = result.hybrid.alignment.judgements.find(x => x.type === 'Week2-topic');
  assert.equal(j.label, 'NOT_ALIGNED');
  assert.ok(!result.hybrid.deductions.some(d => d.id.includes('week2firsttopic')), 'advice only: no points');
  assert.ok(!result.hybrid.suggestions.some(s => s.path === 'plan[1].contents' && (s.basedOn || []).some(b => String(b).includes('week2'))), 'no rewrite of the faculty text');
  const f = buildVerdict(result, content, { all: true }).all.find(x => x.ruleId === 'PLAN-12');
  assert.equal(f.status, 'FAIL');
  assert.equal(f.responsible, 'course_content');
  assert.match(f.recommendation, /Start the first course topic in Week 2/);
});
