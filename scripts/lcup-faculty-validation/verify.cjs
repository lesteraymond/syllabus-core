#!/usr/bin/env node
'use strict';
// Verifies the faculty academic validation package, docs/lcup-faculty-validation-1/:
//   node scripts/lcup-faculty-validation/verify.cjs [--dir <package>] [--verbose]
// Offline. Reads the package, the frozen benchmark and the stored evaluation outputs under docs/; writes only a temporary rebuild in the
// system temp folder, which it removes. Calls no provider and changes no file.
//  1. Manifest: every package file is listed with its SHA-256, nothing else is present, and the inputs still match the benchmark manifest.
//  2. Rebuild: build.cjs run into a temporary folder gives byte-identical generated files.
//  3. Blinding of for-reviewers/: no benchmark ID or case hash, no selection signal or observation, no provider or model name, and no
//     8-word run of any stored model output (explanations, corrections, drafts under docs/) unless it is syllabus text or reviewer-guide
//     wording. The coordinator templates hold no faculty judgment or model result, and no sample case has an earlier model output.
//  4. Privacy: no sign-off phrase, email address, phone number or title before a name anywhere in the package.
//  5. Dataset: 21 distinct eligible cases, three per relationship, each bound to its benchmark case and hash; every statement found in its
//     benchmark side by gemini.js evidenceQuote; the ILO-CLO cases complete; the relationships that cannot be evaluated all accounted for.
//  6. Workbooks: the exact form headers, one row per case in order, the judgment list.
//  7. measure.cjs: the templates load (awaiting faculty adjudication), a synthetic test-only adjudication of all 21 is accepted, and the
//     same synthetic file is refused as faculty accuracy.
//  8. The benchmark package still matches its own manifest.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), os = require('node:os'), zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const i = process.argv.indexOf('--dir');
const DIR = i > 1 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : path.join(ROOT, 'docs', 'lcup-faculty-validation-1');
const BENCH = path.join(ROOT, 'docs', 'lcup-academic-benchmark', 'package');
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const flat = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const listFiles = dir => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? listFiles(path.join(dir, e.name)).map(f => `${e.name}/${f}`) : [e.name])) : []);
const failures = [], passed = [];
const check = (ok, what) => { (ok ? passed : failures).push(what); };

// ---- reading the stored (or deflated) zip of an .xlsx and the text of each part ----
function unzip(buf) {
  const parts = new Map();
  for (let at = 0; buf.readUInt32LE(at) === 0x04034b50;) {
    const method = buf.readUInt16LE(at + 8), size = buf.readUInt32LE(at + 18), nameLength = buf.readUInt16LE(at + 26), extra = buf.readUInt16LE(at + 28);
    const name = buf.toString('utf8', at + 30, at + 30 + nameLength), data = buf.subarray(at + 30 + nameLength + extra, at + 30 + nameLength + extra + size);
    parts.set(name, (method === 8 ? zlib.inflateRawSync(data) : data).toString('utf8'));
    at += 30 + nameLength + extra + size;
  }
  return parts;
}
const unescape = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const xmlText = xml => `${unescape(xml.replace(/<[^>]+>/g, ' '))} ${[...xml.matchAll(/="([^"]*)"/g)].map(m => unescape(m[1])).join(' ')}`;
const textOf = file => {
  const buf = fs.readFileSync(path.join(DIR, file));
  if (file.endsWith('.xlsx')) return [...unzip(buf).values()].map(xmlText).join(' ');
  if (file.endsWith('.html')) return unescape(buf.toString('utf8').replace(/<style[^]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' '));
  return buf.toString('utf8');
};
// the cells of one worksheet: { A1: text, ... } (inline strings and formulas)
const cellsOf = xml => Object.fromEntries([...xml.matchAll(/<c r="([A-Z]+\d+)"[^>]*?(?:\/>|>([^]*?)<\/c>)/g)].map(([, ref, inner = '']) => {
  const t = inner.match(/<t[^>]*>([^]*?)<\/t>/), f = inner.match(/<f>([^]*?)<\/f>/), v = inner.match(/<v>([^]*?)<\/v>/);
  return [ref, t ? unescape(t[1]) : f ? `=${unescape(f[1])}` : v ? v[1] : ''];
}));

// ---- 1. the manifest ----
const manifest = readJson(path.join(DIR, 'package-manifest.json'));
const present = listFiles(DIR).filter(f => f !== 'package-manifest.json').sort();
check(JSON.stringify(present) === JSON.stringify(manifest.files.map(f => f.file).sort()), `manifest lists exactly the ${present.length} files present`);
for (const f of manifest.files) check(fs.existsSync(path.join(DIR, f.file)) && sha(fs.readFileSync(path.join(DIR, f.file))) === f.sha256, `hash of ${f.file}`);
check(manifest.files.filter(f => f.origin === 'authored').map(f => f.file).sort().join() === 'README.md,institutional-definitions-and-evidence-gaps.md', 'the two hand-written files are recorded as authored');
const benchManifest = readJson(path.join(BENCH, 'package-manifest.json'));
for (const input of manifest.inputs) check(benchManifest.files.find(f => `docs/lcup-academic-benchmark/package/${f.file}` === input.file)?.sha256 === input.sha256, `input ${input.file} matches the benchmark manifest`);

// ---- 8. the benchmark package itself ----
for (const f of benchManifest.files) check(sha(fs.readFileSync(path.join(BENCH, f.file))) === f.sha256, `benchmark file ${f.file} unchanged`);
const dataset = readJson(path.join(BENCH, 'cases.json'));
const { hash, POLICY } = require('../../server/lib/syllabuscheck/academicV2Plan');
{ const { benchmarkHash, ...body } = dataset; check(hash(body) === benchmarkHash && benchmarkHash === manifest.benchmarkHash, 'benchmark content hash'); }

// ---- 2. a rebuild gives identical files ----
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lcup-faculty-validation-verify-'));
  try {
    const run = spawnSync(process.execPath, [path.join(__dirname, 'build.cjs'), '--out', tmp], { encoding: 'utf8' });
    check(run.status === 0, `rebuild runs (${flat(run.stdout || run.stderr).slice(0, 120)})`);
    const generated = manifest.files.filter(f => f.origin === 'generated');
    for (const f of generated) check(fs.existsSync(path.join(tmp, f.file)) && sha(fs.readFileSync(path.join(tmp, f.file))) === f.sha256, `rebuild of ${f.file} is byte-identical`);
    check(listFiles(tmp).filter(f => f !== 'package-manifest.json').length === generated.length, 'the rebuild writes no other file');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ---- 5. the dataset ----
const out = readJson(path.join(DIR, 'coordinator-only', 'validation-dataset.json'));
const { evidenceQuote } = require('../../server/lib/syllabuscheck/gemini');
const byId = new Map(dataset.cases.map(c => [c.id, c]));
const LABELS = ['ALIGNED', 'PARTIALLY_ALIGNED', 'NOT_ALIGNED', 'INSUFFICIENT_EVIDENCE'];
const CLASSIFICATION = ['Introductory', 'Enabling', 'Demonstrating', 'Integration of Values'];
check(out.cases.length === 21 && new Set(out.cases.map(c => c.benchmark.id)).size === 21, '21 distinct cases');
check(out.cases.every((c, k) => c.caseId === `FV-${String(k + 1).padStart(2, '0')}`), 'case IDs FV-01 to FV-21 in order');
check(JSON.stringify(out.labels) === JSON.stringify(LABELS), 'the four judgments');
for (const t of POLICY.weeklyTypes) check(out.cases.filter(c => c.relationship.key === t).length === 3, `three cases of ${t}`);
check(JSON.stringify(out.relationships.map(r => r.key)) === JSON.stringify(POLICY.weeklyTypes), 'the seven relationships of the evaluation policy, unchanged');
for (const c of out.cases) {
  const b = byId.get(c.benchmark.id);
  check(b && b.caseHash === c.benchmark.caseHash && b.relationshipType === c.relationship.key && b.pairId === c.benchmark.pairId && b.sourceText === c.benchmark.sourceText && b.targetText === c.benchmark.targetText, `${c.caseId} is bound to ${c.benchmark.id}`);
  check(b && ['ctx-it202', 'ctx-ie402', 'ctx-cpe304'].includes(b.contextId) && b.kind === 'academic-semantic' && b.requiredWeekly && !b.optionalDiagnostic && !b.holds.length && !b.reviewOnlyUntilBasisResolved && !b.missingEvidence && b.claudeEligibility === 'candidate_pending_authorization' && b.expectedJudgment == null && b.reviewStatus === 'unassigned', `${c.caseId} is a genuine, eligible, unlabelled case`);
  check(c.statements.length === 2 && c.statements.every(s => s.text && evidenceQuote(b[`${s.benchmarkSide}Text`], s.text)) && new Set(c.statements.map(s => s.benchmarkSide)).size === 2, `${c.caseId} statements are the benchmark's source and target text`);
  if (c.relationship.key === 'ILO-CLO') {
    const m = c.iloCloMapping, clo = m && dataset.contexts[b.contextId].content.clos[m.cloInThisRelationship - 1];
    check(m && clo && b.pairId.endsWith(`clo:${clo.id}`) && m.requiredClassification === CLASSIFICATION[m.cloInThisRelationship - 1] && flat(clo.statement) === m.cloStatement && m.facultyAssignedClos.includes(m.cloInThisRelationship) && flat(m.ilo).includes(flat(m.mappingAsPrinted)) && m.weeklyCourseContent && m.otherMappingsOfThisIlo.length === m.facultyAssignedClos.length - 1, `${c.caseId} ILO-CLO details (ILO, mapping, CLO statement, classification, week content)`);
  } else check(c.iloCloMapping === null, `${c.caseId} has no ILO-CLO block`);
  check(c.weekRow.ilos.filter(x => x.inThisCase).length === (/ILO/.test(c.relationship.key) ? 1 : 0), `${c.caseId} marks its ILO in the week row`);
}
const genuine = dataset.cases.filter(c => ['ctx-it202', 'ctx-ie402', 'ctx-cpe304'].includes(c.contextId) && POLICY.weeklyTypes.includes(c.relationshipType));
const blocked = genuine.filter(c => c.missingEvidence || c.holds.length).map(c => c.id).sort();
const listed = [...out.notEvaluable.ilosWithoutClo.map(x => x.benchmarkId), ...out.notEvaluable.lessonsWithoutIlo.flatMap(x => x.relationshipsNotEvaluable.map(r => r.benchmarkId)), ...out.notEvaluable.referenceHeld.map(x => x.benchmarkId)].sort();
check(blocked.length === 26 && JSON.stringify(blocked) === JSON.stringify(listed), 'all 26 relationships that cannot be evaluated are listed apart, and no other');
check(!out.cases.some(c => blocked.includes(c.benchmark.id)), 'no case that cannot be evaluated is in the sample');
const iloClo = genuine.filter(c => c.relationshipType === 'ILO-CLO');
check(out.iloCloRelationships.length === iloClo.length && out.iloCloRelationships.filter(r => r.status === 'evaluable').length === 65 && new Set(out.iloCloRelationships.map(r => r.benchmarkId)).size === iloClo.length, 'all 81 ILO-CLO relationships listed one by one, 65 evaluable');

// ---- 3. blinding ----
const reviewerFiles = present.filter(f => f.startsWith('for-reviewers/'));
check(reviewerFiles.join() === ['academic-evaluation-rubric.md', 'case-booklet.html', 'faculty-evaluation-form-CpE304.xlsx', 'faculty-evaluation-form-IE402.xlsx', 'faculty-evaluation-form-IT202.xlsx', 'faculty-evaluation-form.xlsx'].map(f => `for-reviewers/${f}`).join(), 'for-reviewers holds the booklet, the rubric and the four forms only');
const reviewerText = reviewerFiles.map(f => [f, textOf(f)]);
const selection = readJson(path.join(DIR, 'coordinator-only', 'selection-record.json'));
const caseHashes = new Set(dataset.cases.map(c => c.caseHash));
const norm = s => ` ${String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
for (const [f, text] of reviewerText) {
  check(!/BM1-/i.test(text) && ![...text.matchAll(/[0-9a-f]{64}/g)].some(m => caseHashes.has(m[0])), `${f}: no benchmark case ID or case hash`);
  check(!/claude|anthropic|gemini|openrouter|sonnet|opus|haiku|gpt|llm/i.test(text), `${f}: no provider or model name`);
  check(!/apparent (partial )?(alignment|misalignment)|limited evidence/i.test(text), `${f}: no selection signal`);
  check(!selection.signals.concat(selection.reserves).some(s => norm(text).includes(norm(s.observation))), `${f}: no selection observation`);
}
// stored model outputs: every string under an output-like key, in every JSON file under docs/ outside this package and the benchmark
const OUTPUT_KEYS = /^(explanation|recommendedcorrection|draft|suggestion|suggestions|rationale|recommendation|proposedcorrection|revision|explanationreview|recommendationreview)$/i;
const outputs = [];
const walk = (value, key) => {
  if (typeof value === 'string') { if (key && OUTPUT_KEYS.test(key) && value.split(/\s+/).length >= 8) outputs.push(value); }
  else if (Array.isArray(value)) value.forEach(v => walk(v, key));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, k);
};
const jsonFiles = dir => listFiles(dir).filter(f => /\.jsonl?$/.test(f)).map(f => path.join(dir, f));
for (const file of jsonFiles(path.join(ROOT, 'docs')).filter(f => !f.startsWith(DIR + path.sep) && !f.startsWith(path.join(ROOT, 'docs', 'lcup-academic-benchmark') + path.sep))) {
  const raw = fs.readFileSync(file, 'utf8');
  for (const line of file.endsWith('.jsonl') ? raw.split('\n').filter(Boolean) : [raw]) { try { walk(JSON.parse(line)); } catch { /* not JSON: nothing to read */ } }
}
const runsOf = s => { const w = norm(s).trim().split(' '), runs = new Set(); for (let k = 0; k + 8 <= w.length; k++) runs.add(w.slice(k, k + 8).join(' ')); return runs; };
// syllabus text (which model outputs quote) and the reviewer guide's label definitions (which the rubric repeats) are not leaks
const allowed = new Set([...['ctx-it202', 'ctx-ie402', 'ctx-cpe304'].map(id => JSON.stringify(dataset.contexts[id].content).replace(/\\n/g, ' ')), fs.readFileSync(path.join(ROOT, 'docs', 'lcup-academic-benchmark', 'REVIEWER-GUIDE.md'), 'utf8')].flatMap(s => [...runsOf(s)]));
const modelRuns = new Set();
for (const o of outputs) for (const run of runsOf(o)) if (!allowed.has(run)) modelRuns.add(run);
for (const [f, text] of reviewerText) {
  const leaks = [...runsOf(text)].filter(run => modelRuns.has(run));
  check(outputs.length > 1000 && !leaks.length, `${f}: no 8-word run from ${outputs.length} stored model outputs${leaks.length ? ` (found: ${leaks.slice(0, 3).join(' | ')})` : ''}`);
}
const earlier = new Set();
for (const dir of ['live-smoke-REVIEWED', 'live-smoke-r2-REVIEWED', 'r2-smoke-comparison'].map(d => path.join(ROOT, 'docs', 'lcup-v2-evaluation', d)))
  for (const f of jsonFiles(dir)) for (const m of fs.readFileSync(f, 'utf8').matchAll(/BM1-[A-Z0-9]+-\d{3}/g)) earlier.add(m[0]);
check(earlier.size > 0 && !out.cases.some(c => earlier.has(c.benchmark.id)), `no sample case has an earlier model output (${earlier.size} case IDs in the stored runs)`);
const adjTemplate = readJson(path.join(DIR, 'coordinator-only', 'adjudication.template.json'));
const modelTemplate = readJson(path.join(DIR, 'coordinator-only', 'model-results.template.json'));
check(adjTemplate.provenance === 'awaiting-faculty-adjudication' && adjTemplate.adjudications.length === 21 && adjTemplate.adjudications.every(a => a.reviewStatus !== 'adjudicated' && !a.acceptedJudgments?.length), 'the adjudication template holds no faculty judgment');
check(adjTemplate.adjudications.every((a, k) => a.id === out.cases[k].benchmark.id && a.caseHash === out.cases[k].benchmark.caseHash && a.validationCaseId === out.cases[k].caseId), 'the adjudication template follows the cases');
check(Array.isArray(modelTemplate.observations) && modelTemplate.observations.length === 0 && JSON.stringify(modelTemplate.plannedCaseIds) === JSON.stringify(out.cases.map(c => c.benchmark.id)), 'the model template holds no result and plans the 21 cases');

// ---- 6. workbooks ----
const FORM = ['Case ID', 'Academic relationship', 'Syllabus evidence', 'Faculty judgment', 'Academic justification', 'Recommended correction, if necessary', 'Reviewer ID', 'Within your expertise? (optional)', 'Requires an institutional decision? (optional)', 'Notes (optional)'];
for (const [file, code] of [['faculty-evaluation-form.xlsx', null], ['faculty-evaluation-form-IT202.xlsx', 'IT 202'], ['faculty-evaluation-form-IE402.xlsx', 'IE-402'], ['faculty-evaluation-form-CpE304.xlsx', 'CpE 304']]) {
  const parts = unzip(fs.readFileSync(path.join(DIR, 'for-reviewers', file)));
  const names = [...parts.get('xl/workbook.xml').matchAll(/<sheet name="([^"]+)"/g)].map(m => m[1]);
  check(names.join() === 'Instructions,Evaluation,Rubric', `${file}: sheets`);
  const xml = parts.get('xl/worksheets/sheet2.xml'), cells = cellsOf(xml), own = out.cases.filter(c => !code || c.course.code === code);
  check(FORM.every((h, k) => cells[`${String.fromCharCode(65 + k)}1`] === h) && !cells.K1, `${file}: the exact column headers`);
  check(own.every((c, k) => cells[`A${k + 2}`] === c.caseId && cells[`B${k + 2}`] === c.relationship.name && c.statements.every(s => cells[`C${k + 2}`].includes(s.text.split(/\s+(?=[•●▪➢])/)[0]))) && !cells[`A${own.length + 2}`], `${file}: one row per case, in order (${own.length})`);
  check(own.every((_, k) => 'DEFGHIJ'.split('').every(col => cells[`${col}${k + 2}`] === '')), `${file}: the judgment columns are empty`);
  check(xml.includes(`sqref="D2:D${own.length + 1}"><formula1>"${LABELS.join(',')}"</formula1>`), `${file}: the judgment list`);
  check(/<sheetProtection sheet="1"/.test(xml), `${file}: the evidence is protected`);
}
{
  const parts = unzip(fs.readFileSync(path.join(DIR, 'coordinator-only', 'faculty-claude-comparison-template.xlsx'))), cells = cellsOf(parts.get('xl/worksheets/sheet2.xml'));
  const header = Object.entries(cells).filter(([ref]) => /^[A-Z]+1$/.test(ref)).map(([, v]) => v);
  const inputs = ['Reviewer 1 ID', 'Reviewer 1 judgment', 'Reviewer 2 ID', 'Reviewer 2 judgment', 'Faculty reference judgment (adjudicated)', 'Claude run ID', 'Claude model', 'Claude prompt version', 'Claude status', 'Claude judgment', 'Claude recommended correction (verbatim)', 'Faculty rating of the Claude correction'];
  const colOf = h => Object.entries(cells).find(([ref, v]) => /^[A-Z]+1$/.test(ref) && v === h)?.[0].replace('1', '');
  check(inputs.every(h => colOf(h)), 'comparison: the reviewer, reference and Claude columns exist');
  check(inputs.every(h => out.cases.every((_, k) => cells[`${colOf(h)}${k + 2}`] === '')), 'comparison: no faculty judgment or Claude result is entered');
  check(out.cases.every((c, k) => cells[`A${k + 2}`] === c.caseId && cells[`B${k + 2}`] === c.benchmark.id), 'comparison: one row per case');
  check(header.length === 32 && ['Reviewers agree?', 'Agreement with faculty reference', 'Potential false approval', 'Potential false rejection'].every(h => out.cases.every((_, k) => cells[`${colOf(h)}${k + 2}`].startsWith('=IF('))), 'comparison: the agreement formulas on every row');
}

// ---- 4. privacy ----
for (const f of present) {
  const text = textOf(f);
  check(!/\b(prepared|approved|noted|reviewed|checked|recommending|recommended|certified)\s+by\b/i.test(text), `${f}: no sign-off phrase`);
  check(!/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(text), `${f}: no email address`);
  check(!/(\+63|\b0)\s?9\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/.test(text), `${f}: no phone number`);
  check(!/\b(Engr|Dr|Prof|Mr|Ms|Mrs|Atty|Rev|Fr|Sr)\.\s*[A-Z][a-z]+/.test(text), `${f}: no title before a name`);
}

// ---- 7. measure.cjs ----
{
  const { measure } = require('../lcup-academic-benchmark/measure.cjs');
  const r = measure(dataset, adjTemplate, modelTemplate);
  check(r.status === 'awaiting_faculty_adjudication' && r.academic.facultyLabelled === 0 && r.modelRequestsMade === 0 && r.official === false, 'measure.cjs loads the templates: awaiting faculty adjudication, no request');
  const synthetic = { ...adjTemplate, provenance: 'synthetic-test-only', adjudications: adjTemplate.adjudications.map((a, k) => {
    const c = out.cases[k], side = s => c.statements.find(x => x.benchmarkSide === s).text;
    return { ...a, reviewStatus: 'adjudicated', adjudicatorId: 'SYNTH-ADJ', reviewerIds: ['SYNTH-R1', 'SYNTH-R2'], reviewedAt: '2026-10-29', reason: 'Synthetic software check only; not a judgment.', recordRef: 'none', acceptedJudgments: ['PARTIALLY_ALIGNED'], ambiguous: false, sourceEvidence: side('source'), targetEvidence: side('target') };
  }) };
  const t = measure(dataset, synthetic, modelTemplate, { testOnly: true });
  check(t.academic.facultyLabelled === 21 && t.exclusions.length === 0 && t.status === 'awaiting_model_results', 'measure.cjs accepts a complete test-only adjudication of all 21, with the statements as quotes');
  let refused = false; try { measure(dataset, synthetic, modelTemplate); } catch (e) { refused = /Synthetic labels cannot be reported/.test(e.message); }
  check(refused, 'measure.cjs refuses the synthetic file as faculty accuracy');
}

if (process.argv.includes('--verbose')) for (const p of passed) console.log(`ok    ${p}`);
for (const f of failures) console.log(`FAIL  ${f}`);
console.log(`${passed.length} checks passed, ${failures.length} failed.`);
process.exit(failures.length ? 1 : 0);
