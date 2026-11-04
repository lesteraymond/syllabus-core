const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('./fixtures');
const { qualityOf } = require('./quality');
const { run } = require('./engine');

const find = (result, check) => result.findings.filter(f => f.check === check);

test('every note is advisory, has a stable id and says what, why and what to do', () => {
  const { content } = sample();
  content.clos[0].statement = 'Understand and appreciate the basics';
  const result = qualityOf(content);
  assert.equal(result.advisory, true);
  assert.ok(result.findings.length > 0);
  for (const f of result.findings) {
    assert.match(f.id, /^quality:[\w.]+:/);
    assert.equal(f.advisory, true);
    assert.ok(['minor', 'info'].includes(f.severity), 'never blocking: ' + f.severity);
    assert.ok(['high', 'medium', 'low'].includes(f.confidence));
    assert.ok(f.message && f.impact && f.action, 'message, educational impact and recommended action');
    assert.ok(f.evidence.length > 0 && f.evidence.every(e => e.path && e.quote), 'evidence from the syllabus');
  }
  assert.deepEqual(qualityOf(content).findings.map(f => f.id), result.findings.map(f => f.id), 'ids are stable');
});

test('A. a vague word is only a note when the statement has no observable verb at all', () => {
  const { content } = sample();
  content.clos[0].statement = 'Understand the principles of programming';
  content.clos[1].statement = 'Understand recursion and explain it with a worked example';
  const vague = find(qualityOf(content), 'outcome.vagueVerb');
  assert.deepEqual(vague.map(f => f.affected.fields[0]), ['clos[0].statement']);
});

test('A. several performances in one outcome are noted gently, and a practical skill is noted as such', () => {
  const { content } = sample();
  content.clos[0].statement = 'Design, implement and evaluate a database';
  content.clos[1].statement = 'Operate and assemble the lathe';
  const r = qualityOf(content);
  assert.equal(find(r, 'outcome.broad')[0].severity, 'info');
  assert.equal(find(r, 'outcome.practicalCompetency')[0].affected.fields[0], 'clos[1].statement');
});

test('A. two almost identical CLOs are noted', () => {
  const { content } = sample();
  content.clos[0].statement = 'Apply differentiation rules to solve optimization problems in engineering';
  content.clos[1].statement = 'Apply differentiation rules to solve optimization problems in engineering.';
  assert.equal(find(qualityOf(content), 'outcome.duplicate').length, 1);
});

test('B. a CLO built and assessed in one lesson only is an info note, never a penalty', () => {
  const { content } = sample();
  const cloId = content.clos[0].id;
  content.plan.forEach(r => (r.ilos || []).forEach(i => { i.tags = (i.tags || []).filter(t => t !== 'clo:' + cloId); }));
  content.plan[0].ilos[0].tags = ['clo:' + cloId];
  content.plan[0].tasks = '- Quiz on the topic';
  const note = find(qualityOf(content), 'progression.singleLesson').find(f => f.affected.clos[0] === cloId);
  assert.ok(note);
  assert.equal(note.severity, 'info');
});

test('B. almost the same contents in two weeks is an info note that allows deliberate review', () => {
  const { content } = sample();
  content.plan[0].contents = 'Introduction to loops and conditionals in the language';
  content.plan[1].contents = 'Introduction to loops and conditionals in the language.';
  const note = find(qualityOf(content), 'coverage.repeatedContent')[0];
  assert.equal(note.severity, 'info');
  assert.match(note.action, /deliberate review|intended/);
});

test('C. a task that is only named is noted; a described task is not', () => {
  const { content } = sample();
  content.plan[0].tasks = '- Quiz 1';
  content.plan[1].tasks = '- Quiz 2: differentiate polynomial and composite functions';
  const weeks = find(qualityOf(content), 'assessment.namedOnly').flatMap(f => f.affected.weeks);
  assert.ok(weeks.includes(content.plan[0].week));
  assert.ok(!weeks.includes(content.plan[1].week));
});

test('C. a missing rubric is a low-confidence recommendation, and not raised when one is mentioned', () => {
  const { content } = sample();
  const none = find(qualityOf(content), 'assessment.noRubricMentioned');
  assert.equal(none.length, 1);
  assert.equal(none[0].confidence, 'low');
  assert.match(none[0].action, /not a requirement/);
  content.plan[0].tasks = '- Project scored with a rubric';
  assert.equal(find(qualityOf(content), 'assessment.noRubricMentioned').length, 0);
});

test('C. one grading component above 60% is noted, and the official grading is not touched', () => {
  const { content } = sample();
  content.grading.rows = [{ id: 'g1', label: 'Class Standing', pct: 30 }, { id: 'g2', label: 'Examination', pct: 70 }];
  const note = find(qualityOf(content), 'assessment.dominantComponent')[0];
  assert.match(note.evidence[0].quote, /Examination: 70%/);
  assert.deepEqual(content.grading.rows.map(g => g.pct), [30, 70]);
});

test('E. assessment piled into the last weeks is noted; the same load spread out is not', () => {
  const { content } = sample();
  content.plan.forEach(r => { if (r.kind === 'lesson') r.tasks = (parseInt(r.week, 10) >= 14 || r.week === '1') ? '- Project milestone' : ''; });
  assert.equal(find(qualityOf(content), 'workload.assessmentClustering').length, 1);
  content.plan.forEach(r => { if (r.kind === 'lesson') r.tasks = '- Seatwork on the topic'; });
  assert.equal(find(qualityOf(content), 'workload.assessmentClustering').length, 0);
});

test('F. a reliance on equipment is noted only when the syllabus does not say how students without it take part', () => {
  const { content } = sample();
  content.plan[0].activities = 'Students install the software on their laptop';
  content.plan[1].activities = 'Students use the software on school-provided laboratory computers';
  const notes = find(qualityOf(content), 'access.dependsOnResources');
  const weeks = notes.flatMap(f => f.affected.weeks);
  assert.ok(weeks.includes(content.plan[0].week));
  assert.ok(!weeks.includes(content.plan[1].week));
  assert.ok(notes[0].message.includes('does not say how'), 'a missing alternative is not called a barrier');
});

test('notes never change the official score, never block, and are part of the stored report', async () => {
  const { content, masters } = sample();
  content.clos[0].statement = 'Understand and appreciate the basics';
  const transport = async (url, req) => {
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    const answer = p => ({ id: p.id, label: 'ALIGNED', explanation: 'ok', sourceQuote: p.source.slice(0, 12), targetQuote: p.target.slice(0, 12), sourceBloom: 'Apply', targetBloom: 'Apply', draft: '' });
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(answer) }) }] } }] }) };
  };
  const result = await run(content, masters, { useAi: true, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }), env: { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'x' }, transport });
  assert.ok(result.hybrid.quality.findings.length > 0);
  assert.equal(result.hybrid.deductions.length, 0, 'no points');
  assert.ok(!result.findings.some(f => String(f.id).startsWith('quality:')), 'they are not mixed into the compliance findings');
});

test('an empty or partial syllabus gives no notes and no error', () => {
  assert.deepEqual(qualityOf({}).findings, []);
  assert.deepEqual(qualityOf(null).findings, []);
  assert.doesNotThrow(() => qualityOf({ clos: [null], plan: [null, { kind: 'lesson', ilos: [null] }], grading: { rows: [null] } }));
});
