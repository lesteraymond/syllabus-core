'use strict';
// Constructive alignment (owner, 2026-11-17; CHED Handbook on Typology, OBE and ISA): an outcome's verb must match its activities (TLAs) AND its
// assessment tasks (ATs). Checked each week (the level items of ACTIVITY-FIT and TASK-FIT, against the week's ILOs) and each CLO (CLO-EVIDENCE:
// its own verb level reached by the activities and tasks of at least one mapped week). A mismatch is partly aligned, -1. Offline, scripted model.
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('./rules');
const P = require('./prompt');
const T = require('./testSyllabus');
const { extract } = require('./extract');
const { questionsOf } = require('./judge');
const { check } = require('./check');
const { buildPlan } = require('./plan');
const O = require('./official');
const { sample } = require('../fixtures');
const engine = require('../engine');

// A scripted judge that answers "no" to the given item of the given relationship (optionally only for questions whose id matches), "yes" elsewhere.
const answering = (rules) => T.scriptedJudge({
  override: q => {
    const rule = rules.find(r => r.relationship === q.relationship && (!r.id || r.id.test(q.id)));
    if (!rule) return undefined;
    return { q: q.id, items: R.CHECKLISTS[q.relationship].items.map(i => ({ id: i.id, answer: rule.no.includes(i.id) ? 'no' : 'yes' })), quote: String(q.field.text).split(/\s+/).filter(Boolean).slice(0, 4).join(' '), explanation: rule.why || 'The level does not match.' };
  },
});
const run = (content, ask, extra = {}) => check(content, undefined, { ask, store: new Map(), model: 'scripted', year: 2026, ...extra });

test('the rule is data: level items on activities and tasks, tasks judged against the ILOs, and one evidence question per CLO', () => {
  assert.ok(R.CHECKLISTS['ACTIVITY-FIT'].items.some(i => i.id === 'level' && !i.critical));
  assert.ok(R.CHECKLISTS['TASK-FIT'].items.some(i => i.id === 'level' && !i.critical));
  assert.deepEqual(R.CHECKLISTS['TASK-FIT'].to, ['content', 'activities', 'ilo']);
  const ev = R.CHECKLISTS['CLO-EVIDENCE'];
  assert.equal(ev.scored, true);
  assert.equal(ev.area, 'clo');
  assert.ok(ev.items.every(i => !i.critical), 'a mismatch is partly aligned, never not aligned');
  assert.deepEqual(ev.items.map(i => i.id), ['activities', 'tasks'], 'both the TLAs and the ATs must reach the level');
  assert.equal(R.isManual('CLO-EVIDENCE'), true);
  assert.equal(R.isManual('ILO-CLO'), false);
  assert.match(R.CONSTRUCTIVE_ALIGNMENT_SOURCE, /CHED/);
});

test('the prompt states constructive alignment and shows an apply outcome under a recall quiz', () => {
  assert.match(P.JUDGE_SYSTEM, /CONSTRUCTIVE ALIGNMENT/);
  assert.match(P.JUDGE_SYSTEM, /memorization or recall quiz alone does not assess it/);
  assert.match(P.JUDGE_SYSTEM, /TASK-FIT level=no/);
  assert.match(P.JUDGE_SYSTEM, /CLO-EVIDENCE:\n  activities - .*\n  tasks - /);
  assert.match(P.REWRITE_SYSTEM, /tasks: .*at the level of that ILO's own verb/);
  assert.equal(P.PROMPT_VERSION, 'replan-prompt-7');
  assert.equal(R.VERSION, 'replan-rules-2', 'answers judged under the old rules are never reused');
});

test('each week: the tasks are judged against the week\'s ILOs; each CLO: one question quoting its mapped weeks', () => {
  const content = T.conforming();
  const map = extract(content);
  const qs = questionsOf(map);
  const task = qs.find(q => q.relationship === 'TASK-FIT' && q.from.key === 'tasks:r3');
  assert.ok(task.to.some(t => t.field === 'ilo'), 'the ILO is a target of TASK-FIT');
  assert.ok(task.parents.some(p => p.startsWith('ilo:')));
  const evidence = qs.filter(q => q.relationship === 'CLO-EVIDENCE');
  const mapped = map.clos.filter(c => map.weeks.some(w => w.kind === 'lesson' && w.ilos.some(i => i.cloIds.includes(c.id))));
  assert.equal(evidence.length, mapped.length);
  const c3 = evidence.find(q => q.from.key === 'clo:c3');
  const weeks = map.weeks.filter(w => w.kind === 'lesson' && w.ilos.some(i => i.cloIds.includes('c3')));
  for (const w of weeks) {
    assert.ok(c3.to[0].text.includes(w.tasks.text.split('\n')[0].replace(/^-\s*/, '').trim().slice(0, 12)), `week ${w.label} tasks are quoted`);
    assert.ok(c3.parents.includes(`activities:${w.rowId}`) && c3.parents.includes(`tasks:${w.rowId}`));
  }
  // an unmapped CLO gets no evidence question (CLO-COVERAGE, a fixed rule, covers it)
  const unmapped = T.conforming();
  for (const row of unmapped.plan) for (const ilo of row.ilos || []) ilo.tags = (ilo.tags || []).filter(t => t !== 'clo:c4');
  assert.ok(!questionsOf(extract(unmapped)).some(q => q.relationship === 'CLO-EVIDENCE' && q.from.key === 'clo:c4'));
});

test('an apply ILO assessed only by recall: the week\'s tasks are partly aligned, -1 in the tasks area', async () => {
  const result = await run(T.conforming(), answering([{ relationship: 'TASK-FIT', id: /tasks:r3/, no: ['level'], why: 'A recall quiz does not assess applying.' }]));
  const r = result.judged.results.find(x => x.id.startsWith('TASK-FIT|tasks:r3'));
  assert.equal(r.verdict, 'PARTIALLY_ALIGNED');
  assert.equal(r.status, 'failing');
  assert.deepEqual(r.failedItems, ['level']);
  assert.equal(result.judged.deductions.capped.tasks, 1);
});

test('activities that only lecture under an apply ILO: partly aligned, -1 in the activities area', async () => {
  const result = await run(T.conforming(), answering([{ relationship: 'ACTIVITY-FIT', id: /activities:r3/, no: ['level'] }]));
  const r = result.judged.results.find(x => x.id.startsWith('ACTIVITY-FIT|activities:r3'));
  assert.equal(r.verdict, 'PARTIALLY_ALIGNED');
  assert.equal(result.judged.deductions.capped.activities, 1);
});

test('a CLO whose verb level is never reached in its weeks: -1 in the CLO area, and it waits while one of those weeks is still failing', async () => {
  const alone = await run(T.conforming(), answering([{ relationship: 'CLO-EVIDENCE', id: /clo:c3/, no: ['activities', 'tasks'] }]));
  const ev = alone.judged.results.find(x => x.id === 'CLO-EVIDENCE|clo:c3');
  assert.equal(ev.verdict, 'PARTIALLY_ALIGNED', 'both items no is still partly aligned (no critical item)');
  assert.equal(ev.status, 'failing');
  assert.equal(alone.judged.deductions.capped.clo, 1);
  const weekTask = alone.map.weeks.find(w => w.kind === 'lesson' && w.ilos.some(i => i.cloIds.includes('c3')));
  const both = await run(T.conforming(), answering([
    { relationship: 'CLO-EVIDENCE', id: /clo:c3/, no: ['tasks'] },
    { relationship: 'TASK-FIT', id: new RegExp(`tasks:${weekTask.rowId}\\b`), no: ['level'] },
  ]));
  assert.equal(both.judged.results.find(x => x.id === 'CLO-EVIDENCE|clo:c3').status, 'waiting', 'fix the week first');
});

test('the repair plan never lowers a CLO\'s verb for its evidence; it fixes the weeks, and the CLO finding goes to the faculty', async () => {
  const log = [];
  const ask = answering([{ relationship: 'CLO-EVIDENCE', id: /clo:c3/, no: ['tasks'] }]);
  const plan = await buildPlan(T.conforming(), undefined, { ask, rewrite: T.scriptedRewriter({ log }), store: new Map(), model: 'scripted', year: 2026 });
  assert.ok(!log.some(job => job.field.kind === 'clo'), 'no CLO rewrite was asked for');
  const u = plan.unresolved.find(x => x.key === 'clo:c3');
  assert.ok(u, JSON.stringify(plan.unresolved));
  assert.match(u.reason, /for the faculty/);
});

test('official mode: the evidence finding costs its point, is listed for review, and no CLO draft claims to fix it', async () => {
  const { content, masters } = sample();
  delete masters.synthetic;
  const noAi = await engine.run(content, masters, { env: { SYLLABUS_CHECK_AI_PROVIDER: 'off' }, linkChecker: async url => ({ url, status: 'ok' }) });
  const ask = answering([{ relationship: 'CLO-EVIDENCE', id: /clo:c2/, no: ['activities'] }]);
  const report = await O.officialize({ noAi, content, masters, provider: { ask, rewrite: T.scriptedRewriter(), model: 'scripted' }, store: new Map(), year: 2026 });
  const h = report.hybrid;
  const ded = h.deductions.find(d => d.id === 'SEM:CLO-EVIDENCE|clo:c2');
  assert.ok(ded && ded.points === 1 && ded.area === 'clo', JSON.stringify(h.deductions.filter(d => /CLO-EVIDENCE/.test(d.id))));
  const path = O.pathOf(content, 'clo:c2');
  assert.ok(h.unresolved.some(u => u.path === path && u.relationships.includes('SEM:CLO-EVIDENCE|clo:c2')));
  assert.ok(!h.suggestions.some(s => (s.basedOn || []).includes('SEM:CLO-EVIDENCE|clo:c2')));
});

test('an ILO is judged against its CLO\'s own verb, not the highest level the classification allows', () => {
  const level = R.CHECKLISTS['ILO-CLO'].items.find(i => i.id === 'level');
  assert.ok(level && !level.critical, 'a level mismatch is partly aligned');
  assert.match(level.ask, /CLO's own main verb/);
  assert.match(level.ask, /not the highest level its classification allows/);
  assert.match(P.JUDGE_SYSTEM, /a CLO 1 that says "explain" caps its ILOs at understand, although Introductory allows apply/);
  assert.match(P.JUDGE_SYSTEM, /G\. ILO-CLO against the CLO's own verb\. CLO 1 \(Introductory\): "Explain[^\n]*level=no[^\n]*the same ILO is level=yes/);
  assert.match(P.REWRITE_SYSTEM, /ilo: .*at or below the level of its CLO's own main verb/);
  // the examples stay in order, A to G
  const labels = [...P.JUDGE_SYSTEM.matchAll(/^([A-Z])\. /gm)].map(m => m[1]).join('');
  assert.equal(labels, 'ABCDEFGHI');
  // Introductory still allows apply, so a CLO 1 written with "apply" passes its own level check (CLO-LEVEL)
  assert.deepEqual(R.CLO_LEVELS[0].bloom, ['remember', 'understand', 'apply']);
});

test('a week with several ILOs: every ILO needs an activity and a task at its own verb level; two alternatives for the week, not per ILO', () => {
  const act = Object.fromEntries(R.CHECKLISTS['ACTIVITY-FIT'].items.map(i => [i.id, i.ask]));
  assert.match(act.ilo, /EVERY ILO of the week have at least one activity/);
  assert.match(act.level, /each ILO of the week practised by at least one activity at the cognitive level of that ILO's own verb/);
  assert.match(act.diverse, /two for the week as a whole, not two per ILO/);
  const task = Object.fromEntries(R.CHECKLISTS['TASK-FIT'].items.map(i => [i.id, i.ask]));
  assert.match(task.level, /each ILO of the week assessed by at least one task at the cognitive level of that ILO's own verb/);
  assert.match(task.level, /One task may cover several ILOs/);
  assert.match(R.CHECKLISTS['TASK-ILO'].items[0].ask, /each of the week's ILOs/);
  assert.match(P.JUDGE_SYSTEM, /H\. A week with several ILOs\./);
  assert.match(P.JUDGE_SYSTEM, /ACTIVITY-FIT ilo=no and level=no \(ILO 2 has no activity\), diverse=yes/);
  assert.match(P.REWRITE_SYSTEM, /activities: .*for the week as a whole, not per ILO.*EVERY ILO of the week/);
  assert.match(P.REWRITE_SYSTEM, /tasks: .*EVERY ILO of the week is assessed by at least one task/);
});

test('a week with several ILOs: the activity and task questions and their rewrites see every ILO of the week, whatever CLO each is tagged to', async () => {
  const c = T.conforming();
  const row = c.plan[2];
  row.ilos.push({ ...row.ilos[0], id: 'i3b', text: 'Judge whether a shortcut used in topic number 3 is honest practice', tags: ['clo:c4'] });
  const qs = questionsOf(extract(c));
  for (const rel of ['ACTIVITY-FIT', 'TASK-FIT']) {
    const q = qs.find(x => x.relationship === rel && x.from.key.endsWith(':' + row.id));
    assert.deepEqual(q.to.filter(t => t.field === 'ilo').map(t => t.key).sort(), [`ilo:${row.ilos[0].id}`, 'ilo:i3b'].sort(), rel);
  }
  // each ILO keeps its own CLO question, and the week is evidence for both CLOs
  assert.ok(qs.some(q => q.id === 'ILO-CLO|ilo:i3b|clo:c4'));
  const evidence = qs.filter(q => q.relationship === 'CLO-EVIDENCE' && q.to[0].text.includes('honest practice'));
  assert.deepEqual(evidence.map(q => q.from.key), ['clo:c4'], 'the CLO 4 evidence quotes ILO i3b; the other CLO\'s line quotes only its own ILO');
  row.activities = 'WEAK ' + row.activities;
  row.tasks = 'WEAK ' + row.tasks;
  const log = [];
  await buildPlan(c, undefined, { ask: T.scriptedJudge(), rewrite: T.scriptedRewriter({ log }), store: new Map(), model: 'scripted', year: 2026 });
  for (const kind of ['activities', 'tasks']) {
    const job = log.find(j => j.field.kind === kind && j.field.label.startsWith('Week 3'));
    assert.ok(job, kind + ' was rewritten');
    assert.deepEqual(job.dependsOn.filter(d => d.kind === 'ilo').map(d => d.label), ['Week 3 ILO 1', 'Week 3 ILO 2'], kind);
  }
});

test('CLO 4 takes the affective levels value, organize and internalize, with the CHED handbook\'s verbs; the other CLOs do not', () => {
  assert.deepEqual(R.AFFECTIVE_ORDER.map(a => a.level), ['receive', 'respond', 'value', 'organize', 'internalize']);
  assert.match(R.AFFECTIVE_ORDER.find(a => a.level === 'internalize').verbs, /advocate, defend, exemplify, influence, perform, practice, serve, support/);
  assert.match(R.AFFECTIVE_ORDER.find(a => a.level === 'value').verbs, /commit/);
  assert.deepEqual(R.CLO_LEVELS[3].affective, ['value', 'organize', 'internalize']);
  assert.deepEqual(R.CLO_LEVELS[3].bloom, ['evaluate', 'create'], 'the cognitive levels stay');
  assert.ok(R.CLO_LEVELS.slice(0, 3).every(l => !l.affective), 'only CLO 4');
  assert.match(R.AFFECTIVE_SOURCE, /CHED Implementation Handbook for OBE and ISA/);
  assert.match(R.CHECKLISTS['CLO-LEVEL'].items.find(i => i.id === 'verb').ask, /or for CLO 4 also its affective levels/);
  assert.match(R.CHECKLISTS['ILO-CLO'].items.find(i => i.id === 'level').ask, /When the CLO's verb is affective, an affective ILO at or below that affective level fits, and so does a cognitive ILO/);
  // what the AI is told
  assert.match(P.JUDGE_SYSTEM, /CLO 4: Integration of Values [^\n]*Bloom levels: evaluate, create; or the affective levels: value, organize, internalize\./);
  assert.match(P.JUDGE_SYSTEM, /AFFECTIVE LEVELS [^\n]*Only CLO 4 may use them:\n  1\. receive /);
  assert.match(P.JUDGE_SYSTEM, /A written quiz about the value alone does not assess it\./);
  assert.match(P.JUDGE_SYSTEM, /I\. An affective CLO 4\. [^\n]*verb=yes/);
  assert.match(P.JUDGE_SYSTEM, /CLO-EVIDENCE: mapped weeks whose only task is "- Quiz on the provisions of the Data Privacy Act" give tasks=no/);
  assert.match(P.REWRITE_SYSTEM, /CLO 4 states the ethical, values or responsibility side of the subject, and may use an affective verb at value, organize or internalize/);
  // the one-verb rule knows the affective verbs too
  const { leadingVerbs } = require('./extract');
  assert.deepEqual(leadingVerbs('Advocate and practice the ethical use of computing'), ['advocate', 'practice']);
  assert.deepEqual(leadingVerbs('Commit to honest data handling in team projects'), ['commit']);
});
