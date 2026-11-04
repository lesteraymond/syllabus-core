#!/usr/bin/env node
'use strict';
// Builds the faculty review pack in docs/faculty-review/ so qualified faculty can check the AI checker's evaluation data WITHOUT the source code:
//   faculty-review.csv    one row per item, opens in Excel (UTF-8)
//   faculty-review.html   the same, readable and printable in any browser, grouped by course
//   README.md             how to review and what every column means
// Read-only: it reads the three sample syllabi in reference-data/ (through the application's own PDF importer), the evaluation datasets and the
// saved evaluation results, and writes only the three files above. It calls no AI provider and touches no database.
// EVERY label in the pack is provisional until qualified faculty confirm or correct it.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const server = path.join(root, 'server');
const out = path.join(root, 'docs', 'faculty-review');
const dir = path.join(server, 'lib/syllabuscheck/eval');
const { extractPdf } = require(path.join(server, 'lib/pdfImport.js'));
const { sources } = require(path.join(server, 'db/local-outcome-data.cjs'));

const COURSES = [
  { key: 'prog1', program: 'BSIT', pdf: 'IT-202-Programming-1.pdf', label: 'BSIT - IT 202 Computer Programming 1' },
  { key: 'syseng', program: 'BSIE', pdf: 'IE402-SYSTEM-ENGINEERINGS.pdf', label: 'BSIE - IE 402 Systems Engineering' },
  { key: 'sensors', program: 'BSCPE', pdf: 'CPE-304-Fundamentals-of-Mixed-Signals-and-Sensors.pdf', label: 'BSCpE - CPE 304 Fundamentals of Mixed Signals and Sensors' },
];
const DATASETS = [
  { stage: 'Stage A (CLO relevance, PO mapping)', file: 'stage-a-dataset.json', result: 'ai-eval-stage-a-regression.json' },
  { stage: 'Stage B1-B2 (weekly content, ILO)', file: 'stage-b-dataset.json', result: 'ai-eval-stage-b-regression.json' },
  { stage: 'Stage B3 (ILO to CLO)', file: 'stage-b3-dataset.json', result: 'ai-eval-stage-b3-baseline.json' },
  { stage: 'Stage B4 (CLO coverage)', file: 'stage-b4-dataset.json', result: 'ai-eval-stage-b4-baseline.json' },
  { stage: 'Stage C (learning activities, assessment tasks)', file: 'stage-c-dataset.json', result: 'ai-eval-stage-c-baseline.json' },
];
const clean = text => String(text ?? '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').trim();
const esc = text => String(text ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
const COLUMNS = ['Item', 'Kind', 'Stage / relationship', 'Course', 'Category', 'Original content (what the checker read)', 'Reference it was judged against', 'Provisional expected decision', 'AI decision (run 1 / run 2)', 'AI explanation', 'Why the provisional decision was proposed', 'Label status', 'Faculty: agree with the provisional decision? (Yes / No / Unsure)', 'Faculty: expected decision (ALIGNED / PARTIALLY_ALIGNED / NOT_ALIGNED)', 'Faculty notes', 'Reviewer / date'];
const PROVISIONAL = 'PROVISIONAL - not reviewed by faculty';

(async () => {
  const rows = [], refs = [];
  // ---- the real syllabi, as written ----
  for (const course of COURSES) {
    const file = path.join(root, 'reference-data', course.pdf);
    if (!fs.existsSync(file)) { console.error(`skipped ${course.label}: ${file} not found`); continue; }
    const imported = await extractPdf(fs.readFileSync(file));
    const f = imported.fields, planRows = imported.layout.planRows || [];
    const po = sources[course.program].pos.map(p => `PO ${p.no}: ${p.text}`).join('\n');
    refs.push({ course, description: clean(f.description), clos: clean(f.clos), po });
    const common = { course: course.label, status: 'Real syllabus text, extracted automatically from the PDF: check it against the original', provisional: '(none proposed: this is real faculty content; the faculty member sets the expected decision)', ai: 'Not run on this text yet (provider credits unavailable)', aiWhy: 'n/a', why: 'n/a' };
    const refKind = { kind: 'Reference', category: 'reference', provisional: 'n/a', ai: 'n/a', aiWhy: 'n/a', why: 'n/a', course: course.label, reference: '', status: 'Reference text: description and CLOs from the sample syllabus; Program Outcomes transcribed from the registrar image (check the wording). Not official wording.' };
    rows.push({ ...refKind, item: `real-${course.key}-ref-description`, stage: 'Course description (sample syllabus)', content: clean(f.description) });
    rows.push({ ...refKind, item: `real-${course.key}-ref-clos`, stage: 'Course learning outcomes (sample syllabus)', content: clean(f.clos) });
    rows.push({ ...refKind, item: `real-${course.key}-ref-pos`, stage: `Program Outcomes of ${course.program}`, content: po });
    clean(f.clos).split(/\n(?=CLO\s*\d)/).filter(Boolean).forEach((text, i) => rows.push({ item: `real-${course.key}-clo${i + 1}`, kind: 'Real syllabus', stage: 'CLO as written (with the syllabus\'s own EGA / PO tags)', category: 'real', content: clean(text), reference: `See reference rows real-${course.key}-ref-description and real-${course.key}-ref-pos (description and Program Outcomes).`, ...common }));
    planRows.forEach((r, i) => rows.push({ item: `real-${course.key}-week${String(r.week).replace(/[^0-9-]/g, '')}-${i + 1}`, kind: 'Real syllabus', stage: r.kind === 'exam' ? 'Examination row as written' : 'Weekly plan row as written', category: 'real', content: [`Week: ${r.week}`, `ILO: ${clean(r.ilo) || '(none written)'}`, `Course content:\n${clean(r.contents)}`, `Learning activities:\n${clean(r.activities)}`, `Assessment tasks:\n${clean(r.tasks)}`, `Values:\n${clean(r.values)}`].join('\n'), reference: `The CLOs of the same syllabus: see reference row real-${course.key}-ref-clos.`, ...common }));
  }
  // ---- the synthetic test items, with the decisions the AI gave ----
  for (const set of DATASETS) {
    const dataset = require(path.join(dir, set.file));
    const resultFile = path.join(root, 'docs', set.result);
    const result = fs.existsSync(resultFile) ? JSON.parse(fs.readFileSync(resultFile, 'utf8')) : null;
    for (const item of dataset.items) {
      const c = dataset.courses[item.course];
      const runs = result && result.perItem && result.perItem[item.id];
      rows.push({
        item: item.id, kind: 'Synthetic test item', stage: `${set.stage} / ${item.type}`, course: COURSES.find(x => x.key === item.course)?.label || `${c.program} - ${c.code} ${c.title}`, category: item.category,
        content: clean(item.target), reference: clean(item.source), provisional: item.accept.join(' or ') + (item.ambiguous ? ' (marked ambiguous)' : ''),
        ai: runs ? runs.map(label => label || '(not verified)').join(' / ') : 'not run', aiWhy: 'Not stored with the evaluation file (the model\'s wording was only inspected during development)',
        why: item.why, status: `${PROVISIONAL}. Written by the assistant${dataset.provenance ? '; ' + (/SYNTHETIC/.test(dataset.provenance) ? 'weekly topics, ILOs and plans are synthetic' : 'reference text taken from the repository records') : ''}.`,
      });
    }
  }
  const body = rows.map(r => [r.item, r.kind, r.stage, r.course, r.category, r.content, r.reference, r.provisional, r.ai, r.aiWhy, r.why, r.status, '', '', '', '']);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'faculty-review.csv'), '﻿' + [COLUMNS, ...body].map(line => line.map(csvCell).join(',')).join('\r\n'));

  // ---- the HTML pack ----
  const section = course => {
    const mine = rows.filter(r => r.course === course.label);
    const ref = refs.find(x => x.course.key === course.key);
    return `<section><h2>${esc(course.label)}</h2>
${ref ? `<details open><summary>References used for this course</summary><h4>Course description (from the sample syllabus)</h4><pre>${esc(ref.description)}</pre><h4>Course learning outcomes as written in the sample syllabus</h4><pre>${esc(ref.clos)}</pre><h4>Program Outcomes (transcribed from the registrar image; check the wording)</h4><pre>${esc(ref.po)}</pre></details>` : ''}
${['Real syllabus', 'Synthetic test item'].map(kind => { const list = mine.filter(r => r.kind === kind); return list.length ? `<h3>${kind === 'Real syllabus' ? 'Real syllabus text, as written' : 'Test items (synthetic examples with provisional labels)'} (${list.length})</h3>${list.map(card).join('')}` : ''; }).join('')}</section>`;
  };
  const card = r => `<article class="item ${r.kind === 'Real syllabus' ? 'real' : 'syn'}"><h4>${esc(r.item)} <small>${esc(r.stage)}${r.category && r.category !== 'real' ? ' - ' + esc(r.category) : ''}</small></h4>
<div class="grid"><div><b>Original content</b><pre>${esc(r.content)}</pre></div><div><b>Reference</b><pre>${esc(r.reference)}</pre></div></div>
<p><b>Provisional expected decision:</b> ${esc(r.provisional)} &nbsp; <b>AI decision (run 1 / run 2):</b> ${esc(r.ai)}</p>
<p><b>Why proposed:</b> ${esc(r.why)}</p><p class="note">${esc(r.status)}</p>
<p class="box">Faculty: agree? Yes / No / Unsure &nbsp; Expected decision: ALIGNED / PARTIALLY_ALIGNED / NOT_ALIGNED &nbsp; Notes: ______________________________</p></article>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI Checker - faculty review pack</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:0 auto;max-width:1100px;padding:16px 20px;color:#1b1f3a}h1{margin:.2em 0}.warn{background:#fff3d6;border:1px solid #e0b04a;padding:10px 14px;border-radius:8px}section{margin-top:28px}.item{border:1px solid #cfd3ea;border-radius:10px;padding:10px 14px;margin:14px 0;page-break-inside:avoid}.item.real{border-left:6px solid #2a6ac8}.item.syn{border-left:6px solid #b08a2a}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}pre{white-space:pre-wrap;word-break:break-word;background:#f5f6fd;padding:8px;border-radius:6px;margin:4px 0;font:13px/1.45 ui-monospace,monospace}small{font-weight:400;color:#555}.note{color:#7a5300;font-size:13px}.box{border:1px dashed #888;padding:8px;border-radius:6px}@media(max-width:700px){.grid{grid-template-columns:1fr}}@media print{.item{break-inside:avoid}}</style></head><body>
<h1>AI Checker - faculty review pack</h1>
<p class="warn"><b>Every decision shown here is provisional.</b> The expected decisions were written by the assistant, not by faculty, and the AI decisions are the model's own. Real syllabus text was extracted automatically from the sample PDFs; Program Outcome wording was transcribed from the registrar images. Nothing in this pack has been verified by qualified faculty, and none of it states an official requirement. Please confirm or correct each item.</p>
<p>Decisions: <b>ALIGNED</b> = the relationship is supported by the two texts; <b>PARTIALLY_ALIGNED</b> = you can name a specific part that is not supported; <b>NOT_ALIGNED</b> = the texts do not support each other. The same items are in <code>faculty-review.csv</code> for a spreadsheet.</p>
${COURSES.map(section).join('')}</body></html>`;
  fs.writeFileSync(path.join(out, 'faculty-review.html'), html);
  fs.writeFileSync(path.join(out, 'README.md'), `# Faculty review pack for the AI Checker

Open \`faculty-review.html\` in any browser (or print it), or \`faculty-review.csv\` in Excel. No access to the application or its code is needed.

**Everything here is provisional.** The expected decisions are the assistant's proposals, not faculty judgments; the real syllabus text was extracted automatically from the three sample PDFs (IT 202, IE 402, CPE 304) and the Program Outcome wording was transcribed from the registrar images. Please check both against the originals.

## What to do
For each item, read the **original content** and the **reference** it was judged against, then say whether you agree with the provisional decision. Where you disagree, give the expected decision (ALIGNED, PARTIALLY_ALIGNED or NOT_ALIGNED) and a note. For the real syllabus rows no decision is proposed: please give one where you can, and mark rows whose extraction is wrong.

## Columns
| Column | Meaning |
|---|---|
| Item / Kind | an identifier; "Real syllabus" (text as written) or "Synthetic test item" (written by the assistant to test the checker) |
| Stage / relationship | what is compared (for example weekly content against the course, an ILO against a CLO, a CLO against a Program Outcome) |
| Original content / Reference | the faculty text, and the text it is judged against |
| Provisional expected decision | the assistant's proposal; "or" means either is acceptable |
| AI decision (run 1 / run 2) | what the model answered in two live runs; "not run" if it has not been asked |
| AI explanation | not stored with the saved evaluations |
| Faculty columns | for you to fill in |

## Limits
- The Program Outcome texts are not official wording; do not quote them as policy.
- The synthetic weekly plans and ILOs are examples, not the institution's learning plans.
- A decision of ALIGNED / NOT_ALIGNED here is not an institutional rule; the checker's findings remain advisory.
`);
  console.log(`wrote ${rows.length} items to docs/faculty-review/ (${rows.filter(r => r.kind === 'Real syllabus').length} real, ${rows.filter(r => r.kind === 'Synthetic test item').length} synthetic, ${rows.filter(r => r.kind === 'Reference').length} reference)`);
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
