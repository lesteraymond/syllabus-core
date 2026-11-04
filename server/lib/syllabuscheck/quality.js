'use strict';
// Academic-quality notes about a syllabus, as structured ADVISORY findings. They never score, never block and never overwrite anything:
// they point at evidence in the syllabus and say what it may mean for the learner and what could be done.
//
// Everything here is deterministic and conservative on purpose. A note appears only when the syllabus's own words or numbers show the
// pattern; missing information is reported as missing, never as a defect. The AI relationships (gemini.js) judge meaning; this module
// covers what plain evidence can show, so it costs no provider call. Mandatory compliance stays in rules.js and engine.js.
//
// Finding: { id, category, check, severity: 'minor' | 'info', confidence: 'high' | 'medium' | 'low', advisory: true,
//            affected: { clos, ilos, weeks, fields }, evidence: [{ path, quote }], message, impact, action }
const VERSION = 'quality-1';

const text = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const words = (value) => text(value).toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) || [];
const quote = (value, max = 160) => { const t = text(value); return t.length > max ? t.slice(0, max - 1) + '…' : t; };
const has = (value, re) => re.test(text(value));

// Verbs that name something a student can be seen to do or produce, and wording that on its own does not. A vague word is only a note
// when the statement has no observable verb at all (the whole statement is judged, not one word).
const OBSERVABLE = ['analyze', 'analyse', 'apply', 'assemble', 'assess', 'build', 'calculate', 'categorize', 'classify', 'compare', 'compute', 'construct', 'create', 'critique', 'debug', 'define', 'demonstrate', 'derive', 'describe', 'design', 'develop', 'differentiate', 'distinguish', 'draw', 'estimate', 'evaluate', 'examine', 'explain', 'formulate', 'identify', 'implement', 'integrate', 'interpret', 'justify', 'list', 'measure', 'model', 'operate', 'organize', 'perform', 'plan', 'predict', 'present', 'produce', 'prove', 'recognize', 'recommend', 'select', 'simulate', 'sketch', 'solve', 'summarize', 'test', 'use', 'verify', 'write'];
const VAGUE = /\b(understand|understands|understanding|know|knows|knowing|appreciate|appreciation|learn|be aware of|become aware of|be familiar with|become familiar with|comprehend|grasp|become acquainted with)\b/i;
const PRACTICAL = new Set(['assemble', 'build', 'construct', 'draw', 'fabricate', 'install', 'measure', 'operate', 'perform', 'sketch']);
const verbsIn = (value) => { const seen = new Set(); for (const w of words(value)) { const stem = OBSERVABLE.find((v) => w === v || w === v + 's' || w === v + 'es' || w === v.replace(/e$/, '') + 'ing' || w === v + 'd' || w === v + 'ed'); if (stem) seen.add(stem); } return [...seen]; };

const jaccard = (a, b) => { const x = new Set(words(a)), y = new Set(words(b)); if (x.size < 4 || y.size < 4) return 0; let both = 0; x.forEach((w) => { if (y.has(w)) both += 1; }); return both / (x.size + y.size - both); };

const weekStart = (row) => { const n = parseInt(text(row?.week), 10); return Number.isFinite(n) ? n : null; };
const lessonRows = (content) => (content.plan || []).map((row, i) => ({ row, i })).filter(({ row }) => row && row.kind !== 'exam');
const lines = (value) => String(value ?? '').split(/\r?\n/).map((l) => text(l.replace(/^\s*[-*•\d.)]+\s+/, ''))).filter(Boolean);

function qualityOf(content) {
  const c = content || {};
  const findings = [];
  const add = (check, key, f) => findings.push({
    id: `quality:${check}:${key}`, category: f.category, check, severity: f.severity, confidence: f.confidence, advisory: true,
    affected: { clos: [], ilos: [], weeks: [], fields: [], ...f.affected }, evidence: f.evidence || [], message: f.message, impact: f.impact, action: f.action,
  });

  // ---- A. Outcome quality: CLOs and ILOs ----
  const outcomes = [];
  (c.clos || []).forEach((clo, i) => outcomes.push({ kind: 'CLO', path: `clos[${i}].statement`, text: clo?.statement, affected: { clos: [clo?.id].filter(Boolean) }, label: `CLO ${i + 1}` }));
  lessonRows(c).forEach(({ row, i }) => (row.ilos || []).forEach((ilo, j) => outcomes.push({ kind: 'ILO', path: `plan[${i}].ilos[${j}].text`, text: ilo?.text, affected: { ilos: [ilo?.id].filter(Boolean), weeks: [text(row.week)].filter(Boolean) }, label: `The ILO in week ${text(row.week)}` })));
  for (const o of outcomes) {
    if (!text(o.text)) continue;
    const verbs = verbsIn(o.text);
    if (has(o.text, VAGUE) && !verbs.length) {
      add('outcome.vagueVerb', o.path, {
        category: 'outcome_quality', severity: 'minor', confidence: 'medium', affected: { ...o.affected, fields: [o.path] }, evidence: [{ path: o.path, quote: quote(o.text) }],
        message: `${o.label} describes what the student will know or appreciate but names nothing the student can be seen to do or produce.`,
        impact: 'An outcome that cannot be observed is hard to teach toward and hard to assess consistently.',
        action: 'Keep the intended competency and add what the student will do or produce to show it (for example explain, solve, design or present).',
      });
    }
    if (verbs.length >= 3) {
      add('outcome.broad', o.path, {
        category: 'outcome_quality', severity: 'info', confidence: 'low', affected: { ...o.affected, fields: [o.path] }, evidence: [{ path: o.path, quote: quote(o.text) }],
        message: `${o.label} asks for several different performances (${verbs.slice(0, 4).join(', ')}).`,
        impact: 'One statement with many performances is hard to assess as a whole; a student may meet some and not others.',
        action: 'Check whether this is one competency or several. Keep it as written if the performances are steps of one task.',
      });
    }
    if (verbs.length && verbs.every((v) => PRACTICAL.has(v))) {
      add('outcome.practicalCompetency', o.path, {
        category: 'outcome_quality', severity: 'info', confidence: 'low', affected: { ...o.affected, fields: [o.path] }, evidence: [{ path: o.path, quote: quote(o.text) }],
        message: `${o.label} describes a practical performance.`,
        impact: 'The six cognitive levels (Remember to Create) describe thinking and fit a hands-on skill only partly, so its level may be read differently by different reviewers.',
        action: 'No change is needed. Make sure the assessment observes the performance itself, and state its criteria.',
      });
    }
  }
  const sameKind = (kind) => outcomes.filter((o) => o.kind === kind && text(o.text));
  const clos = sameKind('CLO');
  for (let a = 0; a < clos.length; a += 1) for (let b = a + 1; b < clos.length; b += 1) {
    if (jaccard(clos[a].text, clos[b].text) >= 0.85) {
      add('outcome.duplicate', `${clos[a].path}|${clos[b].path}`, {
        category: 'outcome_quality', severity: 'minor', confidence: 'medium', affected: { clos: [...clos[a].affected.clos, ...clos[b].affected.clos], fields: [clos[a].path, clos[b].path] },
        evidence: [{ path: clos[a].path, quote: quote(clos[a].text) }, { path: clos[b].path, quote: quote(clos[b].text) }],
        message: `${clos[a].label} and ${clos[b].label} are almost the same statement.`,
        impact: 'Two outcomes with the same meaning make coverage and assessment look larger than they are.',
        action: 'Keep one, or make the difference between them explicit. CLOs are set by the program, so ask the administrator before changing them.',
      });
    }
  }

  // ---- B. Course-wide coverage and progression ----
  const rows = lessonRows(c);
  const buildsOf = new Map(); // clo id -> lesson rows whose ILOs are tagged to it
  rows.forEach(({ row, i }) => (row.ilos || []).forEach((ilo) => (ilo?.tags || []).forEach((tag) => {
    if (typeof tag === 'string' && tag.startsWith('clo:')) { const id = tag.slice(4); if (!buildsOf.has(id)) buildsOf.set(id, new Set()); buildsOf.get(id).add(i); }
  })));
  (c.clos || []).forEach((clo, k) => {
    const built = [...(buildsOf.get(clo?.id) || [])];
    if (built.length === 1) {
      const row = c.plan[built[0]];
      if (text(row.tasks)) {
        add('progression.singleLesson', clo.id, {
          category: 'learning_progression', severity: 'info', confidence: 'medium', affected: { clos: [clo.id], weeks: [text(row.week)], fields: [`plan[${built[0]}]`] },
          evidence: [{ path: `clos[${k}].statement`, quote: quote(clo.statement) }, { path: `plan[${built[0]}].tasks`, quote: quote(row.tasks) }],
          message: `CLO ${k + 1} is built in one lesson only (week ${text(row.week)}), and that lesson also assesses it.`,
          impact: 'With a single lesson there may be little chance to practise and receive feedback before the outcome is assessed.',
          action: 'If this is intended, no change is needed. Otherwise add a practice or review opportunity in a later lesson.',
        });
      }
    }
  });
  for (let a = 0; a < rows.length; a += 1) for (let b = a + 1; b < rows.length; b += 1) {
    if (jaccard(rows[a].row.contents, rows[b].row.contents) >= 0.8) {
      add('coverage.repeatedContent', `${rows[a].i}|${rows[b].i}`, {
        category: 'coverage', severity: 'info', confidence: 'low', affected: { weeks: [text(rows[a].row.week), text(rows[b].row.week)], fields: [`plan[${rows[a].i}].contents`, `plan[${rows[b].i}].contents`] },
        evidence: [{ path: `plan[${rows[a].i}].contents`, quote: quote(rows[a].row.contents) }, { path: `plan[${rows[b].i}].contents`, quote: quote(rows[b].row.contents) }],
        message: `Weeks ${text(rows[a].row.week)} and ${text(rows[b].row.week)} list almost the same contents.`,
        impact: 'Repeated contents are fine for review and reinforcement, but can also hide topics that were meant to be covered.',
        action: 'If it is a deliberate review, no change is needed. Otherwise check that each week adds something new.',
      });
    }
  }

  // ---- C. Assessment quality ----
  rows.forEach(({ row, i }) => {
    const named = lines(row.tasks).filter((l) => l.split(' ').length <= 3 && /^(quiz|quizzes|exam|examination|exercise|exercises|assignment|assignments|activity|activities|seatwork|homework|recitation|test|long test|laboratory)\b/i.test(l));
    if (named.length) {
      add('assessment.namedOnly', String(i), {
        category: 'assessment_quality', severity: 'info', confidence: 'medium', affected: { weeks: [text(row.week)], fields: [`plan[${i}].tasks`] }, evidence: [{ path: `plan[${i}].tasks`, quote: quote(named.join('; ')) }],
        message: `Week ${text(row.week)} names its assessment (${quote(named.join('; '), 80)}) without saying what the student produces or answers.`,
        impact: 'A reviewer or student cannot tell what evidence the task collects, or at what level.',
        action: 'Add a few words on the output or the content assessed (for example "Quiz 1: differentiate polynomial and composite functions").',
      });
    }
    const count = lines(row.tasks).length;
    if (count >= 4) {
      add('workload.manyTasksInAWeek', String(i), {
        category: 'workload', severity: 'info', confidence: 'low', affected: { weeks: [text(row.week)], fields: [`plan[${i}].tasks`] }, evidence: [{ path: `plan[${i}].tasks`, quote: quote(lines(row.tasks).join('; ')) }],
        message: `Week ${text(row.week)} lists ${count} assessment tasks.`,
        impact: 'Several tasks in one week can be a heavy load for students and for grading.',
        action: 'Check that the load is realistic for the time available, or spread the tasks across weeks.',
      });
    }
  });
  const withTasks = rows.filter(({ row }) => text(row.tasks) && weekStart(row) !== null);
  const late = withTasks.filter(({ row }) => weekStart(row) >= 14);
  if (withTasks.length >= 5 && late.length / withTasks.length >= 0.6) {
    add('workload.assessmentClustering', 'late', {
      category: 'workload', severity: 'minor', confidence: 'medium', affected: { weeks: late.map(({ row }) => text(row.week)), fields: late.map(({ i }) => `plan[${i}].tasks`) },
      evidence: [{ path: 'plan', quote: `${late.length} of ${withTasks.length} lessons with assessment tasks fall in week 14 or later` }],
      message: 'Most of the assessment tasks are scheduled in the last weeks of the term.',
      impact: 'Late-term clustering leaves little time for feedback before the term ends and concentrates the workload.',
      action: 'If it is intended, no change is needed. Otherwise move some tasks earlier so students get feedback sooner.',
    });
  }
  const gradingRows = c.grading?.rows || [];
  const anyText = [c.description?.map?.((p) => p?.t).join(' '), ...(c.plan || []).map((r) => `${r?.tasks} ${r?.activities}`), ...(c.reqs || []).map((r) => r?.t), ...gradingRows.map((g) => g?.label)].join(' ');
  if (gradingRows.length && !/\b(rubric|rubrics|criteria|criterion|checklist|scoring guide|marking guide|grading guide)\b/i.test(anyText)) {
    add('assessment.noRubricMentioned', 'all', {
      category: 'assessment_quality', severity: 'info', confidence: 'low', affected: { fields: ['grading', 'plan'] },
      evidence: [{ path: 'grading', quote: 'No rubric, criteria, checklist or scoring guide is mentioned in the syllabus.' }],
      message: 'The syllabus does not mention how its assessments are scored (a rubric, criteria or a checklist).',
      impact: 'Stated criteria help students know what is expected and help graders score consistently.',
      action: 'Mention the scoring approach where it fits. This is a recommendation, not a requirement, unless the institution requires it.',
    });
  }
  gradingRows.forEach((g, k) => {
    const pct = Number(g?.pct);
    if (Number.isFinite(pct) && pct > 60 && gradingRows.length > 1) {
      add('assessment.dominantComponent', String(k), {
        category: 'assessment_quality', severity: 'minor', confidence: 'medium', affected: { fields: [`grading.rows[${k}]`] }, evidence: [{ path: `grading.rows[${k}]`, quote: `${text(g.label)}: ${pct}%` }],
        message: `One component (${text(g.label)}) carries ${pct}% of the grade.`,
        impact: 'When one component decides most of the grade, a single weak performance can outweigh the evidence from the rest of the course.',
        action: 'Check that the weight reflects the importance of what it assesses. The official grading system is not changed by this note.',
      });
    }
  });

  // ---- F. Accessibility: only an identifiable dependence is noted; missing documentation is not a barrier ----
  const NEEDS = /\b(laptop|computer|internet|wi-?fi|online|software|smartphone|mobile (?:device|phone)|tablet|zoom|google classroom|cloud|install|download|printer)\b/i;
  const ALTERNATIVE = /\b(alternative|offline|printed|school[- ]provided|provided by|lab computers?|borrow|loan|library|accessible|accommodat)/i;
  let noted = 0;
  rows.forEach(({ row, i }) => {
    const all = `${row.contents} ${row.activities} ${row.tasks}`;
    const hit = NEEDS.exec(all);
    if (hit && !ALTERNATIVE.test(all) && noted < 6) {
      noted += 1;
      add('access.dependsOnResources', String(i), {
        category: 'accessibility', severity: 'info', confidence: 'medium', affected: { weeks: [text(row.week)], fields: [`plan[${i}]`] }, evidence: [{ path: `plan[${i}]`, quote: quote(all.slice(Math.max(0, hit.index - 40), hit.index + 80)) }],
        message: `Week ${text(row.week)} relies on "${hit[0]}", and the syllabus does not say how students who do not have it take part.`,
        impact: 'Students without the equipment, software or connection may be unable to take part unless the school provides it or an alternative exists.',
        action: 'State where students can use it (for example school laboratories) or what alternative is accepted. No change is needed if the school already provides it.',
      });
    }
  });

  const SEVERITY = { minor: 0, info: 1 };
  const ORDER = ['outcome_quality', 'learning_progression', 'assessment_quality', 'coverage', 'workload', 'accessibility'];
  findings.sort((a, b) => SEVERITY[a.severity] - SEVERITY[b.severity] || ORDER.indexOf(a.category) - ORDER.indexOf(b.category) || (a.id < b.id ? -1 : 1));
  return { version: VERSION, advisory: true, findings, counts: { total: findings.length, minor: findings.filter((f) => f.severity === 'minor').length, info: findings.filter((f) => f.severity === 'info').length } };
}

module.exports = { qualityOf, VERSION, verbsIn };
