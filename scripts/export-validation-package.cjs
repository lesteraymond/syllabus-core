#!/usr/bin/env node
'use strict';
// Builds docs/academic-validation-package/ for qualified faculty: one record per validation example, each with the fields faculty need to judge it.
//   node scripts/export-validation-package.cjs
// Read-only: reads reference-data/ (through the application's own importer), the evaluation datasets and saved evaluation results; runs the checker
// OFFLINE (no provider, no database) to obtain the deterministic results; writes only the four files below.
//   validation-package.json / .csv / .html   the records       README.md   how to review, what is real and what is synthetic
// Each record says what it is:  REAL FACULTY TEXT (extracted from the sample PDF, may carry extraction errors)  or  SYNTHETIC (written by the assistant).
// NOTHING here is faculty-verified. "Expected academic judgment" is empty for real text, and proposed-by-assistant for synthetic text.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const server = path.join(root, 'server', 'lib', 'syllabuscheck');
const out = path.join(root, 'docs', 'academic-validation-package');
const { run } = require(path.join(server, 'engine.js'));
const { loadReal, COURSES } = require(path.join(server, 'eval', 'realSyllabi.js'));
const refs = require(path.join(server, 'references.js'));
const values = require(path.join(server, 'values.js'));
const clean = text => String(text ?? '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').trim();
const REAL = 'REAL FACULTY TEXT (extracted from the PDF; check against the original)', SYN = 'SYNTHETIC - written by the assistant, unreviewed';
const NOT_RUN = 'not run for this item (no saved model judgment)';
const records = [];
const add = r => records.push({ id: '', kind: '', course: '', curriculumReference: '', relationship: '', facultyText: '', referenceText: '', expectedJudgment: '', modelJudgment: NOT_RUN, evidence: '', explanation: '', recommendation: '', reviewerDecision: '', reviewerNotes: '', ...r });
const squash = text => String(text ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

(async () => {
  const dir = path.join(server, 'eval');
  const valuesDefs = values.loadDefinitions({});
  for (const key of Object.keys(COURSES)) {
    const real = await loadReal(key);
    if (!real) { console.error('skipped (no PDF): ' + COURSES[key].label); continue; }
    const rec = real.record, label = COURSES[key].label;
    const curRef = rec ? `${real.program} curriculum ${real.content.meta.curriculumYear}: ${rec.code} ${rec.title}, ${rec.lecture} lecture / ${rec.lab} lab unit(s), prerequisite "${rec.prereq}" (transcribed from the curriculum image; verify against the approved curriculum)` : `${real.program}: the course was not found in the transcribed curriculum`;
    const offline = await run(structuredClone(real.content), real.masters, { useAi: false, linkChecker: async url => ({ url, status: 'not_checked' }), env: { SYLLABUS_CHECK_STAGE_D1: 'on', SYLLABUS_CHECK_STAGE_D2: 'on' } });
    const verdict = offline.hybrid.verdict, f = real.extracted.fields;
    // ---- course identity against the approved record ----
    for (const [field, pdfText, recordText, rule] of [['title', f.title, rec && rec.title, 'CUR-04'], ['prerequisite', f.prereq, rec && rec.prereq, 'CUR-07'], ['credit units', f.credits, rec && `${rec.lecture} lecture / ${rec.lab} lab`, 'CUR-05']]) {
      const found = verdict.findings.filter(x => x.ruleId === rule);
      add({ id: `${key}-identity-${field.replace(/\s/g, '-')}`, kind: REAL, course: label, curriculumReference: curRef, relationship: `Course identity: ${field} against the approved curriculum record (${rule})`, facultyText: clean(pdfText), referenceText: clean(recordText),
        expectedJudgment: '(faculty/registrar to decide whether the syllabus or the curriculum record is right)', evidence: found.length ? found.map(x => `${x.status}: ${x.actual ?? ''} vs ${x.evidence ?? ''}`).join('; ') : 'no difference found by the deterministic check', explanation: found.length ? found.map(x => x.explanation).join(' ') : 'The deterministic check found no difference.', recommendation: found.length && found[0].recommendation ? found[0].recommendation : '(none: the checker only proposes a replacement it can read from the approved record)' });
    }
    // ---- the weekly chain, as written ----
    real.content.plan.forEach((row, i) => {
      const ilos = row.ilos.map((ilo, j) => `ILO ${j + 1}: ${ilo.text} [CLO tags: ${(ilo.tags || []).map(t => (real.content.clos.findIndex(c => 'clo:' + c.id === t) + 1) || '?').join(', ') || 'none'}]`).join('\n');
      const vcm = require(path.join(server, 'valueClassification.js')), vcls = vcm.classifyText(row.values, vcm.loadLexicon({}));
      const named = values.namedValues(row.values), valueFinding = verdict.findings.find(x => x.ruleId === 'VAL-01' && x.path === `plan[${i}].values`);
      add({ id: `${key}-week-${String(row.week).replace(/[^0-9-]/g, '')}-${i + 1}`, kind: REAL, course: label, curriculumReference: curRef, relationship: row.kind === 'exam' ? 'Examination row, as written' : 'Weekly chain: course content -> ILO -> learning activity -> assessment task -> values',
        facultyText: clean(`CONTENT:\n${row.contents}\n\n${ilos}\n\nACTIVITIES:\n${row.activities}\n\nASSESSMENT:\n${row.tasks}\n\nVALUES:\n${row.values}`), referenceText: 'The course CLOs (see the CLO records) and the Program Outcomes of ' + real.program,
        expectedJudgment: '(faculty to decide, in this order: content belongs to the course; ILO matches the content; activity develops the ILO; task assesses the ILO at its level; each named value is lived in what students do)',
        evidence: `Core values named in this row: ${named.join(', ') || 'none of the six'}. Supporting values: ${vcls.supporting.join('; ') || 'none'}. Competencies / graduate attributes: ${vcls.competencies.join('; ') || 'none'}. Not recognised: ${vcls.unclassified.join('; ') || 'none'} (vocabulary lists are proposals). Which core value a supporting value supports is for faculty to decide from the activity.${valueFinding ? ' Deterministic VAL-01: ' + valueFinding.status + '.' : ''}`, explanation: row.kind === 'exam' ? 'Examination weeks are not asked the lesson questions.' : 'The checker asks these questions in this order and does not suggest a downstream change when an upstream field is judged wrong.', recommendation: '(none until a model judgement exists)' });
    });
    // ---- references: deterministic format, relevance not run, authenticity not verified ----
    for (const e of refs.referenceReport(real.content, { year: 2026 })) {
      add({ id: `${key}-ref-${e.group}-${e.index + 1}`, kind: REAL, course: label, curriculumReference: curRef, relationship: `Reference (${e.group}): APA 7 format; relevance; authenticity - three separate questions`, facultyText: e.text, referenceText: `Source kind read from the text: ${e.type.kind} (${e.type.confidence} confidence)`,
        expectedJudgment: '(librarian/faculty to decide: format correct? relevant to the course? exists as cited?)', modelJudgment: `Format (deterministic, offline): ${e.format.status}. Relevance: ${NOT_RUN}. Authenticity: not verified.`, evidence: e.issues.length ? e.issues.map(i => `${i.code} (${i.severity})`).join(', ') : 'no format issue found',
        explanation: e.issues.map(i => i.message).join(' ') || 'No problem found by the deterministic checks.', recommendation: e.suggestedText ? 'Mechanical repair only: ' + e.suggestedText : (e.missing.length ? 'Supply the missing part(s) from the source itself: ' + e.missing.join(', ') : '(none)') });
    }
  }
  // ---- synthetic examples with the saved model answers where they exist ----
  // Disagreements between a live model answer and the assistant's proposed expectation, flagged for a faculty decision. The expectation is never
  // changed to agree with the model (Stage E.5: docs/stage-e5-reference-evidence.md, section 7).
  const FLAGGED = {
    'vu-prog1-name-only': {
      model: 'ALIGNED (valueUse integrated, carriedBy activity, valueFit fits; recommendation NO_CHANGE), from the Stage E.4 live smoke run (docs/ai-eval-stage-e4-smoke-resume.json): "Students review each other\'s code during pair programming, which can express Humility through acknowledging mistakes and accepting constructive feedback."',
      question: 'FLAGGED FOR FACULTY REVIEW: the earlier Stage E.4 answer called this ALIGNED/integrated after following a worked prompt example. Stage E.6 removed that example. The saved Stage E.7 r7 answer is PARTIALLY_ALIGNED/name_only, but its proposed rewrite copies another lesson\'s value statement and must not be treated as verified. The statement is only "Humility"; does the lesson demonstrate the value or only permit an opportunity? The provisional expectation remains unchanged until faculty decide. See docs/stage-e7-phase2-evaluation.md and docs/stage-e7-academic-reliability-follow-up.md.',
    },
    'vm-prog1-respect-supported': { question: 'FACULTY REVIEW (E.7): the explanation borrows truthful test-log reporting from another relationship. Listening and learning from a partner are in this lesson; the additional borrowed behavior is not. Review the explanation separately from the unchanged academic label.' },
    'vu-prog1-unrelated': { question: 'FACULTY REVIEW (E.7): the proposed rewrite introduces a classmate from another section, which this lesson does not describe. A saved draft is an unverified proposal; preserve the faculty text.' },
    'vu-sensors-silly': { question: 'FACULTY REVIEW (E.7): the proposed rewrite connects Compassion to checking and re-measuring technical gain without showing compassionate behavior. Review the value-to-behavior link before proposing a replacement.' },
    'vu-prog1-no-activity': { question: 'FACULTY REVIEW (E.7): the lesson has no written activity or task, while a hidden model draft invents laboratory activity. Do not infer an activity from the course\'s laboratory units or adopt the hidden draft.' },
    'rr-sensors-relevant': { question: 'LIBRARIAN/FACULTY REVIEW (E.7): the explanation calls Example Press a technical press and selects title_and_venue, but the entry does not support that publisher claim. Review the explanation and provisional basis separately from the unchanged relevance judgment.' },
  };
  const SETS = [['Stage A', 'stage-a-dataset.json', 'ai-eval-stage-a-regression.json'], ['Stage B1-B2', 'stage-b-dataset.json', 'ai-eval-stage-b-regression.json'], ['Stage B3', 'stage-b3-dataset.json', 'ai-eval-stage-b3-baseline.json'], ['Stage B4', 'stage-b4-dataset.json', 'ai-eval-stage-b4-baseline.json'], ['Stage C', 'stage-c-dataset.json', 'ai-eval-stage-c-baseline.json'], ['Stage D1 offline follow-up (stage-d1-2)', 'stage-d1-followup-dataset.json', 'ai-eval-stage-e7-d1.json'], ['Stage D2 offline follow-up (stage-d2-2)', 'stage-d2-followup-dataset.json', 'ai-eval-stage-e7-d2-resume.json']];
  for (const [stage, file, resultFile] of SETS) {
    const data = require(path.join(dir, file)), saved = resultFile && fs.existsSync(path.join(root, 'docs', resultFile)) ? JSON.parse(fs.readFileSync(path.join(root, 'docs', resultFile), 'utf8')) : null;
    for (const item of data.items) {
      const c = data.courses[item.course] || {}, runs = saved && saved.perItem && saved.perItem[item.id];
      const answers = (saved && Array.isArray(saved.answers) ? saved.answers : []).map(run => run[item.id]).filter(Boolean);
      const latest = runs ? runs.map(l => l || '(not verified)').join(' / ') + ' (saved evaluation: ' + resultFile + ')' : NOT_RUN;
      const history = FLAGGED[item.id] && FLAGGED[item.id].model;
      const expected = item.excludeFromAgreement ? 'PENDING faculty/librarian decision; excluded from agreement. ' + (item.pendingDecision || '') : `PROPOSED by the assistant: ${item.accept.join(' or ')}${item.ambiguous ? ' (marked ambiguous)' : ''}`;
      add({ id: item.id, kind: SYN, course: `${c.program || ''} ${c.code || ''} ${c.title || ''}`.trim(), curriculumReference: 'Course identity as in the repository records; the lesson text is synthetic', relationship: `${stage}: ${item.type}${item.category ? ' (' + item.category + ')' : ''}`, facultyText: clean(item.target), referenceText: clean(item.source),
        expectedJudgment: expected, modelJudgment: history ? latest + '\nHistorical answer: ' + history : latest,
        evidence: [item.expectedAspects ? 'Provisional expected structured fields: ' + JSON.stringify(item.expectedAspects) : '', ...answers.map(a => 'Saved model quotes (quote matching does not verify reasoning): ' + JSON.stringify({ source: a.sourceQuote, target: a.targetQuote, aspects: a.aspects && a.aspects.values }))].filter(Boolean).join('\n'),
        explanation: [item.why || '', FLAGGED[item.id] ? FLAGGED[item.id].question : '', ...answers.map(a => 'Saved model explanation, not faculty-verified: ' + a.explanation)].filter(Boolean).join('\n'),
        recommendation: answers.some(a => a.draft) ? 'UNVERIFIED saved model proposal; held for faculty review in this package. ' + answers.filter(a => a.draft).map(a => a.draft).join('\n') : '(no saved model rewrite; any revision requires faculty judgment)' });
    }
  }
  const fixtures = require(path.join(dir, 'reference-format-fixtures.json'));
  for (const item of fixtures.items) {
    const r = refs.parseReference(item.text, { year: 2026 });
    add({ id: 'format-' + item.id, kind: SYN, course: '(not course-specific)', curriculumReference: 'n/a', relationship: 'APA 7 format of a synthetic reference (invented author and publisher)', facultyText: item.text, referenceText: `Expected: ${item.expectedKind}, ${item.expectedStatus}${item.expectedIssues.length ? ', ' + item.expectedIssues.join(', ') : ''}`,
      expectedJudgment: 'PROPOSED by the assistant: ' + item.expectedStatus, modelJudgment: `Deterministic checker: ${r.format.status} (${r.type.kind}); issues: ${r.issues.map(i => i.code).join(', ') || 'none'}`, evidence: item.note, explanation: r.issues.map(i => i.message).join(' '), recommendation: r.suggestedText ? 'Mechanical repair: ' + r.suggestedText : '' });
  }
  fs.mkdirSync(out, { recursive: true });
  const COLS = [['id', 'Item'], ['kind', 'What this is'], ['course', 'Course'], ['curriculumReference', 'Curriculum reference'], ['relationship', 'Relationship checked'], ['facultyText', 'Faculty text (actual)'], ['referenceText', 'Reference it is judged against'], ['expectedJudgment', 'Expected academic judgment'], ['modelJudgment', 'Model judgment'], ['evidence', 'Supporting evidence'], ['explanation', 'Explanation'], ['recommendation', 'Proposed recommendation'], ['reviewerDecision', 'Reviewer decision (agree / disagree / unsure)'], ['reviewerNotes', 'Reviewer notes']];
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  fs.writeFileSync(path.join(out, 'validation-package.json'), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), status: 'NOT faculty-verified', definitionsStatus: valuesDefs.status, records }, null, 1));
  fs.writeFileSync(path.join(out, 'validation-package.csv'), '﻿' + [COLS.map(c => c[1]), ...records.map(r => COLS.map(c => r[c[0]]))].map(l => l.map(cell).join(',')).join('\r\n'));
  const esc = text => String(text ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const groups = [...new Set(records.map(r => r.course))];
  const card = r => `<article class="${r.kind === REAL ? 'real' : 'syn'}"><h4>${esc(r.id)} <small>${esc(r.relationship)}</small></h4><p class="tag">${esc(r.kind)}</p>${r.curriculumReference ? `<p class="note"><b>Curriculum:</b> ${esc(r.curriculumReference)}</p>` : ''}<div class="g"><div><b>Faculty text</b><pre>${esc(r.facultyText)}</pre></div><div><b>Judged against</b><pre>${esc(r.referenceText)}</pre></div></div><p><b>Expected judgment:</b> ${esc(r.expectedJudgment)}</p><p><b>Model judgment:</b> ${esc(r.modelJudgment)}</p>${r.evidence ? `<p><b>Evidence:</b> ${esc(r.evidence)}</p>` : ''}${r.explanation ? `<p><b>Explanation:</b> ${esc(r.explanation)}</p>` : ''}${r.recommendation ? `<p><b>Recommendation:</b> ${esc(r.recommendation)}</p>` : ''}<p class="box">Reviewer decision: Agree / Disagree / Unsure &nbsp; Notes: ______________________________</p></article>`;
  fs.writeFileSync(path.join(out, 'validation-package.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Academic validation package</title><style>body{font:15px/1.5 system-ui,sans-serif;margin:0 auto;max-width:1100px;padding:16px 20px;color:#1b1f3a}.warn{background:#fff3d6;border:1px solid #e0b04a;padding:10px 14px;border-radius:8px}article{border:1px solid #cfd3e6;border-radius:8px;padding:10px 14px;margin:12px 0;break-inside:avoid}article.real{border-left:6px solid #2f6f4f}article.syn{border-left:6px solid #9a6a1a}.tag{font-size:12px;font-weight:600}.g{display:grid;grid-template-columns:1fr 1fr;gap:12px}pre{white-space:pre-wrap;background:#f4f5fa;padding:8px;border-radius:6px}.box{border:1px dashed #888;padding:6px 10px}.note{font-size:13px}@media(max-width:700px){.g{grid-template-columns:1fr}}</style></head><body><h1>Academic validation package</h1><p class="warn"><b>Nothing here is faculty-verified.</b> Green-edged records are real faculty text extracted from the sample PDFs and may carry extraction errors. Amber-edged records are synthetic examples written by the assistant; their expected judgments are proposals. The institution's Marian-Augustinian value definitions are copied from the university website and are <b>pending approval</b>.</p>${groups.map(g => `<section><h2>${esc(g)}</h2>${records.filter(r => r.course === g).map(card).join('')}</section>`).join('')}</body></html>`);
  fs.writeFileSync(path.join(out, 'README.md'), `# Academic validation package

Generated by \`node scripts/export-validation-package.cjs\`. Open \`validation-package.html\` in a browser (or print it), or \`validation-package.csv\` in Excel. No access to the application is needed.

## What is real and what is synthetic
- **REAL FACULTY TEXT**: IT 202, IE 402 and CpE 304, extracted automatically from the sample PDFs in \`reference-data/\`. Extraction can split or merge lines: check against the original. The curriculum record comes from the repository's transcription of the curriculum images (also unverified).
- **SYNTHETIC**: examples written by the assistant to test the checker. Their expected judgments are **proposals**. The reference entries use invented authors and "Example" publishers; none is a real work.
- **Nothing is faculty-verified.** No model judgment is included for real text. Synthetic judgments come only from existing saved evaluations, including the completed E.7 D1/D2 runs; the standalone Stage C r7 dataset evaluation remains prepared, not executed. Earlier smoke runs included some Stage C relationships. Regenerating this package makes no provider call. Saved explanations and drafts are model-authored, unverified material for review, not verified findings or accepted rewrites.

## E.7 offline follow-up
- Versioned D1 follow-up: 29 items, preserving the original 17 and adding 12 programming, engineering and laboratory examples that distinguish a value merely named, an opportunity, demonstrated integration and insufficient evidence.
- Versioned D2 follow-up: 13 items, preserving the original nine labels and relevance expectations, adding provisional evidence-basis values and four venue cases. The venue-only diagnostic has no scored label/basis until faculty or a librarian decide how the current enum should represent it.
- New examples have no model judgment. Original result files and baseline datasets are preserved. See [offline follow-up](../stage-e7-academic-reliability-follow-up.md) and [Stage C plan, not run](../stage-c-evaluation-plan.md).

## How to review
For each record read the faculty text and what it is judged against, then record **Agree / Disagree / Unsure** and a note. Where the expected judgment is blank, the decision is yours. For references, format, relevance and existence are separate questions.

## Flagged for faculty review
These saved answers need review for an academic disagreement or unsupported reasoning/draft content. An explanation caution does not change its label or make the faculty's text wrong. Expectations have not been changed to match model answers.
${Object.keys(FLAGGED).map(id => `- **${id}**: ${FLAGGED[id].question}`).join('\n')}

## Fields
${COLS.map(c => `- **${c[1]}**`).join('\n')}

## Known limits
- The six core-value definitions used by the checker are the wording on https://lcup.edu.ph/mission-vision.php (retrieved 2026-10-25); the institution has not confirmed them for this use (status: ${valuesDefs.status}).
- The APA 7 rules were applied from the assistant's knowledge; the official APA examples pages could not be retrieved from this environment, so the validator is not verified against them.
- Real value columns often list generic words (for example "Respect", "Critical Thinking") instead of the six core values; the checker reports that as a wording finding, which is a policy question for the institution.
`);
  console.log(`wrote ${records.length} records (${records.filter(r => r.kind === REAL).length} real, ${records.filter(r => r.kind === SYN).length} synthetic) to docs/academic-validation-package/`);
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
