#!/usr/bin/env node
'use strict';
// Builds docs/faculty-review/align-1-dev-adjudication/, the faculty-adjudication package for the 58 align-1 development cases judged in the
// A2 and B2 evaluations.
//   node scripts/export-align1-adjudication.cjs [--out <dir>] [--prereg <file>]
// Offline and read-only. Reads only saved records and repository texts:
//   docs/ai-eval-anthropic/p2-a2-cases.json and p2-b2-cases.json (each checked against the hashes it records) and p2-a1-result.json (for the
//   16 cases copied from eval-1.1); the development split of server/lib/syllabuscheck/eval/alignment-dataset.json (held-out items are dropped
//   by the split filter and never read further); the developer notes pre-registered before B2 (--prereg, default
//   docs/ai-eval-anthropic/p2b2-preregistered.json, whose hash the B2 report records); and the institutional texts held in the repository
//   (src/data/outcomesSeed.js, server/db/local-outcome-data.cjs, server/db/local-curriculum-data.cjs, server/config/marian-values.json).
// Calls no provider and changes no source. Writes only inside --out (default: the package folder), either into an empty folder or over files
// this script wrote and nobody has changed since (each checked against package-manifest.json), so a filled-in response sheet is never
// overwritten; otherwise it refuses and writes nothing. The same inputs give byte-identical files.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const LIB = path.join(ROOT, 'server', 'lib', 'syllabuscheck'), EVAL = path.join(ROOT, 'docs', 'ai-eval-anthropic');
const option = name => { const i = process.argv.indexOf(name); return i > 1 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : null; };
const PKG = option('--out') || path.join(ROOT, 'docs', 'faculty-review', 'align-1-dev-adjudication');
const PREREG = option('--prereg') || path.join(EVAL, 'p2b2-preregistered.json');
const SALT = 'align-1-dev-adjudication/2026-10-28', BUILT = '2026-10-28';
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const shaText = text => crypto.createHash('sha256').update(String(text)).digest('hex');
const rel = file => path.relative(ROOT, file).split(path.sep).join('/');
const short = h => h.slice(0, 16);

// ---- the draft rules pre-registered before B2 (unchanged) ----
const STOP = new Set(('a an and are as at be by can each for from given has have in into is it its may more of on one or other own such than that the their them '
  + 'these they this through to two use using will with week weeks student students').split(' '));
const stems = text => new Set((String(text || '').toLowerCase().match(/[a-z]+/g) || []).filter(w => w.length >= 4 && !STOP.has(w)).map(w => w.replace(/s$/, '').slice(0, 6)));
const jaccardStems = (x, y) => { const a = stems(x), b = stems(y), inter = [...a].filter(s => b.has(s)).length; return a.size + b.size - inter ? inter / (a.size + b.size - inter) : 0; };
const words = t => new Set(String(t || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(w => w.length > 2));
const jaccardWords = (a, b) => { const x = words(a), y = words(b); const inter = [...x].filter(w => y.has(w)).length; return inter / (x.size + y.size - inter || 1); };
const norm = s => String(s || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const ORDER = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];
const rank = level => { const i = ORDER.indexOf(String(level || '').replace(/^Analyse$/, 'Analyze')); return i < 0 ? null : i + 1; };
const CLO_SIDE = new Set(['CLO-PO', 'CLO-EGA', 'CLO-anyPO', 'CLO-anyEGA']);
const retention = (c, draft) => { const orig = stems(c.target), kept = [...orig].filter(s => stems(draft).has(s)).length; return orig.size ? kept / orig.size : 1; };
const VALUE = /augustin|marian|catholic|steward|lifelong|critical and creative|competent professional|values?\b|community and truth/i;
const OTHER_VALUE = /\b(integrity|service to others|truth|faith|honesty|excellence|charity|love|justice|stewardship|unity|augustinian|marian|catholic)\b/gi;

// ---- presentation ----
const LABEL = { ALIGNED: 'Aligned', PARTIALLY_ALIGNED: 'Partially aligned', NOT_ALIGNED: 'Not aligned', INSUFFICIENT_EVIDENCE: 'Insufficient evidence' };
const ABBR = { ALIGNED: 'A', PARTIALLY_ALIGNED: 'P', NOT_ALIGNED: 'N', INSUFFICIENT_EVIDENCE: 'I' };
const REMEDY = { NO_CHANGE: 'no change', REWRITE_TEXT: 'rewrite', RETAG_OUTCOME: 're-map (re-tag)', REVIEW_REQUIRED: 'review required' };
const TYPE = {
  'CLO-PO': { title: 'CLO and program outcome', source: 'Program outcome (PO)', target: 'Course learning outcome (CLO)', srcShort: 'PO', tgtShort: 'CLO', item: 'CLO', mapTo: 'program outcome',
    question: 'Does the CLO align with the program outcome it is mapped to?',
    reading: ['The CLO develops a real part of the PO; other parts may be developed by other CLOs or courses', 'The CLO must show every part of the PO'] },
  'CLO-anyPO': { title: 'CLO and a list of program outcomes', source: 'Program outcomes (the whole list)', target: 'Course learning outcome (CLO)', srcShort: 'the PO it fits', tgtShort: 'CLO', item: 'CLO', mapTo: null, list: 'program outcome',
    question: 'Does the CLO align with at least one of the listed program outcomes? If so, which?',
    reading: ['The CLO develops a real part of the PO it fits; other parts may be developed by other CLOs or courses', 'The CLO must show every part of the PO it fits'] },
  'CLO-EGA': { title: 'CLO and expected graduate attribute', source: 'Expected graduate attribute (EGA)', target: 'Course learning outcome (CLO)', srcShort: 'EGA', tgtShort: 'CLO', item: 'CLO', mapTo: 'graduate attribute',
    question: 'Does the CLO align with the graduate attribute it is mapped to?',
    reading: ['The CLO develops the attribute as a whole in a recognisable way', 'The CLO must reflect each element of the attribute\'s name'] },
  'CLO-anyEGA': { title: 'CLO and the list of graduate attributes', source: 'Expected graduate attributes (the whole list)', target: 'Course learning outcome (CLO)', srcShort: 'the EGA it fits', tgtShort: 'CLO', item: 'CLO', mapTo: null, list: 'graduate attribute',
    question: 'Does the CLO align with at least one of the listed graduate attributes? If so, which?',
    reading: ['The CLO develops the attribute it fits as a whole in a recognisable way', 'The CLO must reflect each element of that attribute\'s name'] },
  'ILO-CLO': { title: 'ILO and course learning outcome', source: 'Course learning outcome (CLO)', target: 'Intended learning outcome (ILO)', srcShort: 'CLO', tgtShort: 'ILO', item: 'ILO', mapTo: 'CLO',
    question: 'Does the ILO align with the CLO it is meant to build toward?',
    reading: ['The ILO is a step toward the CLO; other ILOs may develop the rest', 'The ILO must show every part of the CLO'] },
};
const TYPE_ORDER = ['CLO-PO', 'CLO-anyPO', 'CLO-EGA', 'CLO-anyEGA', 'ILO-CLO'];
const COURSE_ORDER = ['calc', 'ie', 'prog', 'nurs', 'edu', 'acct', 'hm'];
const COURSE_CODE = { calc: 'MA7', ie: 'IE310', prog: 'IT204', nurs: 'NCM101', edu: 'EDUC105', acct: 'ACCTG201', hm: 'HM210' };
const COURSE_REF = { calc: ['BSIE', 'MA 7'], ie: ['BSIE', null], prog: ['BSIT', 'IT-204'], nurs: [null], edu: [null], acct: [null], hm: [null] };
const BOX = '☐';
const quote = text => String(text).split('\n').map(l => `> ${l}`).join('\n');
const inline = text => String(text).replace(/\s*\n\s*/g, ' / ');
const cell = text => inline(text).replace(/\|/g, '\\|');
const csvCell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
const csv = rows => '\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
const list = items => items.length ? items.join(', ') : 'none';

// ---- authored notes: why the answers differ (coordinator only). Each is a reading of the saved answers, not a finding about who is right. ----
const NOTES = {
  'clo-po-prog-interdisciplinary': {
    reason: 'All four answers rate the levels Analyze → Evaluate, so the level is not in question. The answers that withhold ALIGNED (A2 run 1, B2 both runs) treat the PO\'s three objects (individuals, organizations and society) as parts the CLO must each show; B2 run 2 adds that the CLO is "not a programming outcome for this course". The provisional label reads evaluating a system\'s implications for its users as one valid instance of the PO. The label\'s own rationale already records the case as disputed, and A1 also answered PARTIALLY_ALIGNED in one of its two runs.',
    question: 'Does a CLO that evaluates a software system\'s ethical and social implications for its users align with a PO on the impact of computing on individuals, organizations and society? Separately, does such a CLO belong in IT 204?' },
  'd-po-01': {
    reason: 'All four answers are PARTIALLY_ALIGNED at Apply → Apply. Both arms place integration outside a differential calculus course (course fit); B2 adds that the CLO shows neither "complex" engineering problems nor any use of science, and B2 run 2 that it states only routine computation. The provisional label reads using integration on engineering problems as the PO\'s competence in other words. The registrar curriculum lists MA 8 Integral Calculus as a separate course after MA 7; that bears on course fit, not on the CLO–PO relationship as such.',
    question: 'Judged against the PO alone, does the CLO align? Separately, does an integration CLO belong in MA 7, and should that affect the alignment verdict?' },
  'd-po-03': {
    reason: 'All four answers are PARTIALLY_ALIGNED. B2 accepts "develop" as implementing but not as designing, and does not accept testing against a client\'s requirements as evaluating. B2 run 2 also rates the PO by "evaluate" rather than "design" and the CLO as Apply, a stricter level reading than the other three answers. The provisional label reads developing and testing a solution for a client as the PO\'s competence in other words.',
    question: 'Does "develop and test a web application that meets the requirements of a client" show the PO\'s design, implementation and evaluation, or only part of them? Is that difference enough to withhold ALIGNED?' },
  'd-po-05': {
    reason: 'All four answers are PARTIALLY_ALIGNED at Apply → Apply. B2 says the CLO does not mention the nursing process or reach families and communities, and notes that the course description does not list medication administration; A2\'s rewrites add families and family teaching. The provisional label reads a specific skill that develops one real part of a broad practice PO as aligned.',
    question: 'Does a specific, safely performed skill align with a broad practice PO when it names neither the PO\'s process nor all of its client groups? Separately, is medication administration within NCM 101\'s scope?' },
  'd-po-07': {
    reason: 'All four answers are PARTIALLY_ALIGNED. Both arms accept the CLO as the design part of the PO and withhold ALIGNED because it does not implement or evaluate assessments. The provisional label reads constructing a test blueprint and items as designing an assessment.',
    question: 'Does a CLO that develops one of the PO\'s three activities (design) align with the PO, when the other two (implement, evaluate) may be developed by other CLOs?' },
  'd-po-09': {
    reason: 'All four answers are PARTIALLY_ALIGNED at Apply → Apply. B2 withholds ALIGNED because the CLO never states "measure"; A2\'s cause in its report is the same kind (a multi-part PO with one part not shown). The provisional label reads recording and reporting under the standards as the PO\'s competence; the course description covers recognition, measurement and presentation under the Philippine Financial Reporting Standards.',
    question: 'Must a CLO state a component of the PO (here, measurement) that its other components imply, for the CLO to be aligned?' },
  'd-ega-03': {
    reason: 'A2 answered PARTIALLY_ALIGNED, then ALIGNED; B2 PARTIALLY_ALIGNED, then NOT_ALIGNED. Both B2 answers concede a link with the attribute ("may fit the EGA"; "shares the community and social-responsiveness theme") and withhold ALIGNED for course fit: the outreach is not in the course description, and designing and evaluating it may be too advanced for year 1. B2 run 2 is NOT_ALIGNED on course fit alone while conceding the EGA fit, so its verdict answers a different question from the one asked; it also rates the EGA\'s level "N/A". A2 run 1\'s cause in its report was reading the attribute\'s name literally. The provisional label reads serving a community need and evaluating the result as social responsiveness.',
    question: 'Does designing and evaluating a community outreach for a local health need align with "Socially Responsive Steward"? Separately, is such a CLO appropriate for a year-1 fundamentals of nursing course?' },
  'd-ilo-01': {
    reason: 'A2 answered NOT_ALIGNED and B2 PARTIALLY_ALIGNED in both runs, all at Apply → Apply. The explanations describe the ILO as a smaller step toward the CLO, then withhold ALIGNED because it mentions neither optimization nor an engineering context. A2\'s NOT_ALIGNED contradicts its own explanation; B2\'s PARTIALLY_ALIGNED does not. B2 run 1 also calls "differentiate" a procedural skill, below its own rating of Apply. On its first attempt in both runs B2 swapped the source and target quotes; the validator refused them and the re-ask corrected them.',
    question: 'Is an ILO that is a necessary step toward its CLO aligned when it does not show the CLO\'s application context?' },
  'd-ilo-10': {
    reason: 'A2 answered PARTIALLY_ALIGNED in both runs because the ILO does not show the delivery of service itself; B2 answered ALIGNED in both runs, as "a concrete Apply-level step" toward the CLO. The provisional label reads a standard step of table service as aligned. It is the one case where B2 changed A2\'s verdict toward the provisional label in both runs.',
    question: 'Is setting a cover for a three-course meal aligned with delivering table service to industry standards, as one step of it?' },
  'd-any-po-01': {
    reason: 'A2 answered ALIGNED, then PARTIALLY_ALIGNED; B2 PARTIALLY_ALIGNED twice. B2 names PO 1 as the best fit but says the CLO names no engineering problem, complexity or application; B2 run 2, like A2 run 2 (A2 report: the CLO lies outside the course\'s stated subject), adds that the CLO lies outside a differential calculus course. The provisional label reads fitting PO 1 as sufficient for a list case.',
    question: 'Does solving systems of linear equations by matrix methods align with "apply knowledge of mathematics … to solve complex engineering problems" without a stated engineering context? Separately, does such a CLO belong in MA 7?' },
  'd-any-po-03': {
    reason: 'Each arm answered ALIGNED in one run and PARTIALLY_ALIGNED in the other (A2 run 2, B2 run 1); the PARTIALLY_ALIGNED answers cite course fit, because the CLO has no calculus content. B2 run 2 found PO 3 met and PO 2 fitting. The provisional label reads fitting PO 2 and PO 3 as sufficient.',
    question: 'Is a team design CLO aligned with an engineering program\'s design and teamwork POs when it has no calculus content? Separately, does it belong in MA 7?' },
  'ilo-clo-prog-aligned': {
    reason: 'A2 answered ALIGNED twice; B2 PARTIALLY_ALIGNED, then ALIGNED, all at Create → Apply. B2 run 1 withheld ALIGNED because the CLO also asks to design and test and the ILO shows neither, and because no problem is named; B2 run 2 accepted the ILO as a smaller step. The provisional label reads a concrete step of the CLO as aligned; A1 answered ALIGNED in both runs.',
    question: 'Is implementing a class hierarchy with inheritance aligned with a CLO to design, implement and test object-oriented programs, as one step of it?' },
  'd-ega-07': {
    reason: 'A2 answered ALIGNED twice; B2 PARTIALLY_ALIGNED twice, because the CLO states no Catholic or Marian element of the attribute\'s name and does not show how the values are practised. B2 run 2 rates the EGA\'s level "N/A". The provisional label reads professional competence together with named Augustinian values as aligned. B2\'s rewrites change the value wording (see the recommendation review).',
    question: 'Must a CLO mapped to "Competent Catholic Augustinian-Marian Professional" reflect each element of the name, or is professional competence with named Augustinian values enough?' },
  'd-ilo-02': {
    reason: 'A2 answered ALIGNED twice; B2 ALIGNED, then PARTIALLY_ALIGNED, all at Create → Apply. B2 run 2 withheld ALIGNED because the ILO covers only testing, and counted the ILO\'s lower level (Apply against the CLO\'s Create) as a gap; the checker\'s own level rule for ILO–CLO pairs flags only an ILO above its CLO. The provisional label reads testing as one of the three things the CLO asks for.',
    question: 'Is an ILO that develops one of the CLO\'s activities (testing) aligned with it? Is a lower cognitive level than the CLO a gap for an ILO?' },
  'd-ilo-04': {
    reason: 'A2 answered ALIGNED twice; B2 PARTIALLY_ALIGNED, then ALIGNED, all at Apply → Apply. B2 run 1 accepted the ILO as a smaller step in the same subject but withheld ALIGNED because it shows neither the nursing process nor a simulated patient and covers only one procedure. The provisional label reads a basic procedure performed safely as aligned.',
    question: 'Is demonstrating correct hand hygiene aligned with performing basic nursing procedures safely using the nursing process, as one step of it?' },
  'd-ilo-06': {
    reason: 'A2 answered ALIGNED twice; B2 PARTIALLY_ALIGNED twice, because the CLO requires tests that are "valid and reliable", which the ILO does not address, and because the ILO covers one item format. The provisional label reads item writing as a core step of constructing a test.',
    question: 'Is writing multiple-choice items with plausible distractors aligned with constructing valid and reliable classroom tests, when it does not itself address validity and reliability?' },
  'd-any-ega-01': {
    reason: 'A2 answered ALIGNED twice; B2 ALIGNED, then PARTIALLY_ALIGNED. B2 run 2 withheld ALIGNED because no creative element is stated (the "Creative" half of EGA 1) and the CLO names no subject of the course. The provisional label reads fitting EGA 1 as sufficient. The same CLO is judged against EGA 1 alone in another case, whose provisional label accepts ALIGNED or PARTIALLY_ALIGNED.',
    question: 'Does analysing alternative designs and justifying a selection fit "Critical and Creative thinker" without a stated creative element?' },
  'd-ega-08': {
    reason: 'The provisional label accepts ALIGNED or PARTIALLY_ALIGNED and marks the case ambiguous: the CLO shows technical competence only, and whether that suffices depends on a definition of the attribute that the system does not hold. Both arms answered NOT_ALIGNED in all four runs: the CLO has no professional, ethical or faith-related element. A2 proposed adding value words; B2 proposed re-mapping the CLO. B2 rated the EGA\'s level "N/A" in both runs.',
    question: 'Does a purely technical programming CLO align with "Competent Catholic Augustinian-Marian Professional"? If not, should the CLO be re-mapped, or should values be added to it?' },
  'd-po-12': {
    reason: 'Both arms gave verdicts the provisional labels accept, but they differ: A2 answered PARTIALLY_ALIGNED with rewrites that bring computing into the nursing CLO; B2 answered NOT_ALIGNED and recommended re-mapping, keeping the CLO. The pre-registered provisional remedy is a re-tag. Neither arm\'s explanation says the PO comes from another program\'s list.',
    question: 'When a sound nursing CLO is mapped to a computing PO, should the recommendation change the mapping, the text, or both?' },
};
// Observations for recommendation cases, each checked against the B2 report (docs/anthropic-p2-b2-report.md, section C).
const OBS = {
  'clo-po-calc-unrelated': 'B2\'s re-tag explanations say the tag does not fit; neither names the PO to move to.',
  'clo-po-nurs-unrelated': 'A2\'s two drafts and B2\'s run-1 draft duplicate an existing nursing CLO of the course (B2 run 1 word for word); B2\'s run-2 draft restates the PO with a few words changed.',
  'clo-ega-unrelated': 'B2\'s replacements are object-oriented programming outcomes at Create, above the level B2 gave the attribute; the level of a replacement is for faculty.',
  'd-po-06': 'The rewrites replace the anatomy with communication, and B2\'s drop the cardiac topic. B2 considered re-mapping and rejected it ("the choice of PO is not the only issue").',
  'd-ega-02': 'Both arms replaced the CLO; the level of a replacement is for faculty.',
  'd-ega-04': 'A2\'s rewrites add community service to the calculus CLO, which the developer note says would force the fit.',
  'd-ega-06': 'B2\'s run-1 re-tag keeps a CLO the developer note calls below the course; its run-2 rewrite raises it for the course and the attribute.',
  'd-po-02': 'A2\'s rewrites raise the computation CLO to engineering design.',
  'clo-po-calc-lower-level': 'B2\'s run-2 re-tag keeps a recall-level CLO under an Apply-level PO.',
  'clo-po-prog-lower-level': 'B2\'s rewrites raise a Remember-level CLO to designing and evaluating solutions in both runs.',
  'd-po-08': 'B2\'s rewrites turn the history CLO into assessment design and drop the history topic.',
  'd-po-04': 'A2\'s rewrites turn the Python CLO into impact analysis (Apply to Analyze); B2 run 2 suggests "a PO about developing or implementing programs".',
  'd-po-10': 'Both B2 drafts name the Philippine Financial Reporting Standards, which the course description names.',
  'd-ilo-03': 'B2 run 2 recommends re-mapping the ILO "to a different outcome or to none"; whether an installation task is an ILO at all is a faculty question.',
  'd-ilo-09': 'B2 run 2 says the ILO "may be sound for another week or CLO", though the course description has no history topic; B2\'s run-1 draft restates the CLO (word overlap 0.92), as A2\'s drafts do (0.60 and 0.55).',
  'd-ilo-05': 'B2\'s drafts restate the CLO (word overlap 0.50) instead of giving a step toward it.',
};
// Which policy questions each case bears on (P1-P7, institution/01-policy-questions.md).
const POLICY_CASES = {
  P1: ['clo-po-prog-interdisciplinary', 'd-po-01', 'd-po-03', 'd-po-05', 'd-po-07', 'd-po-09', 'd-any-po-01', 'd-any-po-03', 'clo-po-prog-two-skills'],
  P2: ['d-ilo-01', 'd-ilo-10', 'ilo-clo-prog-aligned', 'd-ilo-02', 'd-ilo-04', 'd-ilo-06', 'ilo-clo-calc-aligned', 'd-ilo-07', 'd-ilo-08', 'd-ilo-14', 'd-ilo-15'],
  P3: ['d-ega-03', 'd-ega-07', 'd-ega-08', 'd-any-ega-01', 'clo-ega-aligned', 'd-ega-01', 'd-ega-05'],
  P4: ['d-po-01', 'd-any-po-01', 'd-any-po-03', 'd-ega-03', 'd-po-05', 'clo-po-prog-interdisciplinary', 'd-any-ega-01', 'd-po-06', 'd-ega-06', 'd-po-08'],
  P5: ['clo-po-calc-unrelated', 'clo-po-nurs-unrelated', 'clo-ega-unrelated', 'd-po-06', 'd-po-12', 'd-ega-02', 'd-ega-04', 'd-ega-06', 'd-po-02', 'clo-po-calc-lower-level', 'd-po-04', 'd-ega-08', 'd-ilo-03', 'd-ilo-09'],
  P6: ['d-ega-07', 'd-ega-08'],
  P7: ['d-ega-03', 'd-ega-05', 'd-ega-06', 'd-ega-07', 'd-ega-08', 'd-po-03', 'd-ilo-02', 'd-ilo-01'],
};
const POLICY_TITLE = {
  P1: 'coverage or contribution (CLO and PO)', P2: 'ILO steps', P3: 'EGA names', P4: 'course fit and year level',
  P5: 're-mapping (re-tag) recommendations', P6: 'value wording', P7: 'cognitive levels for attributes and multi-verb outcomes',
};
// The B2 report's escalation groups (section C5), by case.
const ESC_GROUPS = [
  ['the raise is the remedy the case calls for', ['clo-po-calc-vague', 'd-po-10', 'd-po-13', 'd-po-14']],
  ['an off-subject or below-course outcome rewritten; faculty set the level', ['clo-ega-unrelated', 'd-ega-02', 'd-any-ega-02', 'd-any-po-02', 'd-ega-06']],
  ['raised to match the PO where a re-tag or a smaller change could keep the outcome', ['clo-po-calc-lower-level', 'clo-po-prog-lower-level', 'd-po-08', 'd-po-06', 'd-po-03', 'd-po-02', 'd-po-04']],
  ['a provisionally aligned outcome raised to add the other half of an EGA name', ['d-any-ega-01']],
];

async function main() {
  const SRC = {
    a2: path.join(EVAL, 'p2-a2-cases.json'), b2: path.join(EVAL, 'p2-b2-cases.json'), a1: path.join(EVAL, 'p2-a1-result.json'),
    dataset: path.join(LIB, 'eval', 'alignment-dataset.json'), prereg: PREREG,
    seed: path.join(ROOT, 'src', 'data', 'outcomesSeed.js'), outcomes: path.join(ROOT, 'server', 'db', 'local-outcome-data.cjs'),
    curriculum: path.join(ROOT, 'server', 'db', 'local-curriculum-data.cjs'), values: path.join(ROOT, 'server', 'config', 'marian-values.json'),
  };
  const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
  const A = readJson(SRC.a2), B = readJson(SRC.b2), A1 = readJson(SRC.a1), D = readJson(SRC.dataset), PRE = readJson(SRC.prereg), VALS = readJson(SRC.values);
  const SEED = await import(pathToFileURL(SRC.seed).href);
  const OUTC = require(SRC.outcomes), CURR = require(SRC.curriculum);
  const { namedValues } = require(path.join(LIB, 'values.js'));
  const integrity = {
    a2Sources: [A.sources.result, A.sources.ledger, A.sources.dataset].every(s => sha(path.join(ROOT, s.file)) === s.sha256),
    b2Sources: [B.sources.result, B.sources.ledger, B.sources.dataset].every(s => sha(path.join(ROOT, s.file)) === s.sha256),
    a2CasesAsPreregistered: sha(SRC.a2) === PRE.a2.casesSha256,
    datasetAsPreregistered: sha(SRC.dataset) === PRE.dataset.sha256,
  };
  if (!Object.values(integrity).every(Boolean)) { console.log(`REFUSED: a source changed ${JSON.stringify(integrity)}`); process.exit(2); }
  const dev = D.items.filter(i => i.split === 'dev');
  const same = (x, y) => x.length === y.length && x.every((c, i) => c.id === y[i].id && c.source === y[i].source && c.target === y[i].target && JSON.stringify(c.accept) === JSON.stringify(y[i].accept));
  if (dev.length !== 58 || !same(A.cases, dev) || !same(B.cases, dev)) { console.log('REFUSED: the case records are not the 58 development cases'); process.exit(2); }
  const verbLevel = text => { let best = null; for (const w of (String(text || '').toLowerCase().match(/[a-z]+/g) || []).slice(0, 6)) for (const [lvl, verbs] of Object.entries(PRE.bloom)) if (verbs.includes(w) && (!best || rank(lvl) > rank(best))) best = lvl; return best; };
  const a2 = new Map(A.cases.map(c => [c.id, c])), b2 = new Map(B.cases.map(c => [c.id, c]));
  const remap = new Map(PRE.remapCandidates.map(r => [r.id, r])), levelGap = new Map(PRE.levelGap.map(r => [r.id, r]));
  const a1Ids = new Set(PRE.a1Overlap);
  const isClearAligned = c => !c.ambiguous && c.accept.length === 1 && c.accept[0] === 'ALIGNED';
  const isClearNot = c => !c.ambiguous && !c.accept.includes('ALIGNED');
  const verdictKind = (c, r) => (!r.verified ? 'unverified' : c.accept.includes(r.label) ? 'agrees' : isClearAligned(c) ? 'false rejection' : isClearNot(c) && r.label === 'ALIGNED' ? 'false approval' : 'outside the provisional labels');
  const ruleFlags = (C, c, r) => { // the pre-registered draft rules, per answer
    const f = [];
    if (!r.verified) return f;
    if (r.remedy === 'RETAG_OUTCOME') f.push('re-tag');
    if (!r.draft) return f;
    if (isClearAligned(c)) f.push('rewrite of a provisionally aligned outcome');
    const pool = PRE.cloPool[c.course] || {};
    if (CLO_SIDE.has(c.type)) for (const [text, holders] of Object.entries(pool)) {
      if (norm(text) === norm(c.target) && holders.includes(`${c.id}:target`)) continue;
      const j = jaccardStems(text, r.draft);
      if (norm(text) === norm(r.draft) || j >= 0.8) f.push(`duplicates another CLO of the course (${j.toFixed(2)})`);
    }
    const dl = verbLevel(r.draft);
    if (CLO_SIDE.has(c.type)) { const clo = rank(r.targetBloom), po = rank(r.sourceBloom); if (dl && clo && rank(dl) > clo && (po === null || rank(dl) >= po)) f.push(`Bloom escalation (${r.targetBloom} → ${dl})`); }
    else if (c.type === 'ILO-CLO') {
      const clo = rank(r.sourceBloom); if (dl && clo && rank(dl) > clo) f.push(`ILO draft above its CLO (${dl})`);
      const jc = jaccardWords(c.source, r.draft); if (jc >= 0.5) f.push(`ILO draft restates its CLO (${jc.toFixed(2)})`);
      for (const o of C.cases.filter(x => x.type === 'ILO-CLO' && x.course === c.course && x.id !== c.id)) { const j = jaccardWords(o.target, r.draft); if (j >= 0.8) f.push(`duplicates another ILO (${j.toFixed(2)})`); }
    }
    const kept = retention(c, r.draft); if (kept < 1 / 3) f.push(`replacement (keeps ${Math.round(kept * 100)}% of the original)`);
    const named = namedValues(r.draft), other = [...new Set((r.draft.match(OTHER_VALUE) || []).map(w => w.toLowerCase()))], drops = VALUE.test(c.target) && !VALUE.test(r.draft);
    if (named.length || other.length || drops) f.push(`value wording (${[...named, ...other].join(', ')}${drops ? `${named.length || other.length ? '; ' : ''}drops a value reference` : ''})`);
    return f;
  };
  const CONCERN = /^(re-tag|duplicates|Bloom escalation|ILO draft|replacement|value wording)/;

  // ---- sets: 1 verdict disputes; 2 recommendation and consistency questions; 3 the rest ----
  const cases = dev.map(item => {
    const ca = a2.get(item.id), cb = b2.get(item.id);
    const answers = [...ca.runs.map(r => ({ arm: 'A2', C: A, r })), ...cb.runs.map(r => ({ arm: 'B2', C: B, r }))]
      .map(x => ({ arm: x.arm, run: x.r.run, r: x.r, kind: verdictKind(item, x.r), flags: ruleFlags(x.C, item, x.r) }));
    const outside = answers.some(x => x.kind !== 'agrees');
    const labelsVary = new Set(answers.map(x => x.r.label)).size > 1;
    const concern = remap.has(item.id) || levelGap.has(item.id) || answers.some(x => x.flags.some(f => CONCERN.test(f)));
    const set = outside ? 1 : labelsVary || concern ? 2 : 3;
    const a1 = a1Ids.has(item.id) ? A1.answers.map((run, i) => ({ run: i + 1, a: run[item.id] })) : null;
    return { item, id: item.id, course: item.course, type: item.type, answers, set, labelsVary, a1 };
  });
  const byId = new Map(cases.map(c => [c.id, c]));
  // codes: by course, then relationship type, then a salted hash of the id (independent of labels, categories and verdicts)
  for (const course of COURSE_ORDER) {
    const mine = cases.filter(c => c.course === course).sort((x, y) => TYPE_ORDER.indexOf(x.type) - TYPE_ORDER.indexOf(y.type) || shaText(SALT + x.id).localeCompare(shaText(SALT + y.id)));
    mine.forEach((c, i) => { c.code = `${COURSE_CODE[course]}-${String(i + 1).padStart(2, '0')}`; });
  }
  const codeOf = id => byId.get(id).code;
  const codes = ids => ids.map(codeOf).sort();
  const ordered = [...cases].sort((x, y) => COURSE_ORDER.indexOf(x.course) - COURSE_ORDER.indexOf(y.course) || x.code.localeCompare(y.code));
  // Part B proposals: every change proposed in A2 or B2, for any case (so Part B does not reveal the sets); identical texts merged; all
  // re-mappings of a case merged
  for (const c of cases) {
    const groups = new Map();
    for (const x of c.answers) {
      if (!x.r.verified || x.r.remedy === 'NO_CHANGE') continue;
      const kind = x.r.remedy === 'RETAG_OUTCOME' ? 'remap' : x.r.draft ? 'rewrite' : null;
      if (!kind) continue;
      const text = kind === 'rewrite' ? x.r.draft.replace(/\s+/g, ' ').trim() : '';
      const key = `${kind}|${text}`;
      if (!groups.has(key)) groups.set(key, { kind, text, from: [], flags: new Set() });
      const g = groups.get(key);
      g.from.push(`${x.arm} run ${x.run} (${LABEL[x.r.label]})`);
      x.flags.filter(f => f !== 're-tag').forEach(f => g.flags.add(f));
    }
    c.proposals = [...groups.values()].sort((p, q) => shaText(`${SALT}|${c.code}|${p.kind}|${p.text}`).localeCompare(shaText(`${SALT}|${c.code}|${q.kind}|${q.text}`)))
      .map((p, i) => ({ ...p, flags: [...p.flags], code: `${c.code}-R${i + 1}` }));
  }
  // shared CLO texts within a course (the outcome being judged or rewritten), for cross-references in the forms
  const cloText = c => (c.type === 'ILO-CLO' ? c.item.source : c.item.target);
  const alsoIn = c => cases.filter(o => o !== c && o.course === c.course && norm(cloText(o)) === norm(cloText(c))).map(o => o.code).sort();

  // ---- curriculum facts ----
  const rowsOf = code => CURR.programs.find(p => p.code === code).terms.flatMap(t => t.rows.map(r => ({ ...r, yearLevel: t.yearLevel, semester: t.semester })));
  const placement = course => {
    const [program, code] = COURSE_REF[course];
    if (!program) return null;
    if (!code) {
      const or = rowsOf(program).filter(r => /OPERATION RESEARCH/.test(r.title));
      return `The ${program} curriculum transcription has no course coded IE 310. Its operations research courses are ${or.map(r => `${r.code} ${r.title} (year ${r.yearLevel}, ${r.semester.toLowerCase()}, ${r.lecture} lecture and ${r.lab} laboratory units${r.rawPrerequisite ? `, prerequisite ${r.rawPrerequisite}` : ''})`).join(' and ')}.`;
    }
    const r = rowsOf(program).find(x => x.code === code), p = CURR.programs.find(x => x.code === program);
    return `${p.code} ${p.curriculumYear} curriculum: ${r.code} ${r.title}, year ${r.yearLevel}, ${r.semester.toLowerCase()}, ${r.lecture} lecture and ${r.lab} laboratory units, prerequisite ${r.rawPrerequisite || '(blank in the source)'}.`;
  };
  const refOf = course => ({ calc: 'R-BSIE', ie: 'R-BSIE', prog: 'R-BSIT' }[course] || 'R-NONE');
  const courseLine = course => { const k = D.courses[course]; return `${k.code} ${k.title} (${k.program}, year ${k.yearLevel})`; };

  // ---- output collection ----
  const out = new Map();
  const put = (file, text) => out.set(file, text.replace(/\n{3,}/g, '\n\n'));
  const counts = { 1: cases.filter(c => c.set === 1).length, 2: cases.filter(c => c.set === 2).length, 3: cases.filter(c => c.set === 3).length };
  const partBCases = ordered.filter(c => c.proposals.length);
  const nProposals = partBCases.reduce((s, c) => s + c.proposals.length, 0);

  // ======================= faculty/ =======================
  const bloomLine = label => `${label}: ${['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create', 'Not applicable'].map(l => `${BOX} ${l}`).join(' ')}`;
  const recOptions = t => (t.list
    ? `${BOX} No change ${BOX} Revise the CLO text ${BOX} Remove the CLO from this course ${BOX} Refer for a policy decision ${BOX} Other:`
    : `${BOX} No change ${BOX} Revise the ${t.item} text ${BOX} Keep the ${t.item} text and ${t.item === 'ILO' ? 'link it to a different CLO' : `map it to a different ${t.mapTo}`} (which?): ${BOX} Remove the ${t.item}${t.item === 'CLO' ? ' from this course' : ''} ${BOX} Refer for a policy decision ${BOX} Other:`);
  const formA = c => {
    const t = TYPE[c.type], also = alsoIn(c);
    return [
      '---', '', `### ${c.code} · ${t.title}`, '',
      `**${t.source}**`, '', quote(c.item.source), '', `**${t.target}**`, '', quote(c.item.target), '',
      ...(also.length ? [`*The same CLO also appears in ${also.join(', ')}. Judge each case on its own relationship.*`, ''] : []),
      `**Question:** ${t.question}`, '',
      `1. **Alignment:** ${BOX} Aligned ${BOX} Partially aligned ${BOX} Not aligned ${BOX} Insufficient evidence to judge`,
      ...(t.list ? [`   - **Which ${t.list}(s) does it fit, if any?** (write the number or numbers)`] : []),
      '2. **Rationale.** What in the texts supports your judgment? What, if anything, is missing?',
      '   > (write here)',
      `3. **Reading you applied:** ${BOX} ${t.reading[0]} ${BOX} ${t.reading[1]} ${BOX} Other:`,
      `4. **Does the ${t.item} itself belong in this course at this year level?** ${BOX} Yes ${BOX} No ${BOX} Unsure. Note:`,
      `5. **Recommendation:** ${recOptions(t)}`,
      `6. **Cognitive level** (optional, revised Bloom's taxonomy):`,
      `   - ${bloomLine(t.srcShort)}`, `   - ${bloomLine(t.tgtShort)}`,
      `7. **Confidence:** ${BOX} High ${BOX} Medium ${BOX} Low`,
      '8. **Comments:**', '   > (write here)', '',
    ].join('\n');
  };
  const courseHeader = (course, part) => {
    const k = D.courses[course], pl = placement(course), mine = ordered.filter(c => c.course === course);
    const pos = [...new Set(mine.filter(c => c.type === 'CLO-PO').map(c => c.item.source).concat(mine.filter(c => c.type === 'CLO-anyPO').flatMap(c => c.item.source.split('\n').map(l => l.replace(/^\d+\.\s*/, '')))))];
    const egas = mine.some(c => c.type === 'CLO-EGA' || c.type === 'CLO-anyEGA');
    return [
      `# ${part} · ${k.code} ${k.title}`, '',
      part === 'Part A' ? 'Reviewer code: ____________   Date returned: ____________' : 'Reviewer code: ____________   Date returned: ____________   (Part A returned on: ____________)', '',
      '## Course context', '',
      `- **Course record (a test case written for evaluation):** ${k.code} ${k.title} · ${k.program} · year ${k.yearLevel} · ${k.discipline}.`,
      `- **Course description (test wording):** "${k.description}"`,
      `- **Curriculum placement:** ${pl ? `${pl} Source: the registrar curriculum transcription held in the system. See ${refOf(course)} in 02-curriculum-references.md.` : `No curriculum, program outcomes or syllabus for ${k.program} is held in the system (R-NONE). Judge the cases from the texts given and your knowledge of the program.`}`,
      ...(pos.length ? [`- **Program outcomes that appear in this course's cases** (general test wording, not ${k.program}'s official outcomes; judge them as written${refOf(course) !== 'R-NONE' ? `; the official outcomes held in the system are in ${refOf(course)}` : ''}):`, ...pos.map(p => `  - ${p}`)] : []),
      ...(egas ? ['- **Graduate attributes:** the institution\'s four EGAs, held in the system as names only (R-EGA): Critical and Creative thinker; Competent Catholic Augustinian-Marian Professional; Socially Responsive Steward; Transformative Lifelong learner.'] : []),
      '',
      part === 'Part A'
        ? `**${mine.length} case${mine.length === 1 ? '' : 's'}.** Read 01-reviewer-guide.md first. Judge each case on its own, without discussing it with other reviewers. Please return this Part A before you open Part B.`
        : '**Open this only after you have returned Part A.** The proposals below were generated automatically by the syllabus-checking software while it was being tested. They are in no particular order. Identical proposals are shown once. None of them is endorsed by anyone. Judge each on its merits. Your Part A answers stand as you returned them.',
      '',
    ].join('\n');
  };
  for (const course of COURSE_ORDER) {
    const mine = ordered.filter(c => c.course === course);
    put(`faculty/part-a/${COURSE_CODE[course]}.md`, [courseHeader(course, 'Part A'), ...mine.map(formA)].join('\n'));
    const withB = mine.filter(c => c.proposals.length);
    if (!withB.length) continue;
    const formB = c => {
      const t = TYPE[c.type];
      return [
        '---', '', `### ${c.code} · ${t.title}`, '', `**${t.source}**`, '', quote(c.item.source), '', `**${t.target}, as written**`, '', quote(c.item.target), '',
        ...c.proposals.flatMap(p => (p.kind === 'rewrite' ? [
          `#### ${p.code} · Proposed rewrite of the ${t.item}`, '', quote(p.text), '',
          `- **Rating:** ${BOX} Appropriate as written ${BOX} Acceptable with edits ${BOX} Not appropriate`,
          `- **Concerns** (tick any): ${BOX} The ${t.item} needed no change ${BOX} Raises the cognitive level more than the course or year warrants ${BOX} Lowers the cognitive level inappropriately ${BOX} Changes the course's subject matter or scope ${BOX} Duplicates or restates another outcome ${BOX} Adds, removes or changes values or attributes ${BOX} Adds content the alignment does not need ${BOX} Removes content the outcome needs ${BOX} A different remedy would be better (re-map, remove) ${BOX} Wording, clarity or measurability ${BOX} Other`,
          '- **Suggested edit or note:**', '  > (write here)', '',
        ] : [
          `#### ${p.code} · Proposed re-mapping`, '',
          `Keep the ${t.item} text unchanged and ${t.item === 'ILO' ? 'link it to a different CLO' : `map it to a different ${t.mapTo}`}. The proposal does not say which.`, '',
          `- **Rating:** ${BOX} Appropriate ${BOX} Appropriate only if a suitable ${t.mapTo} is named ${BOX} Not appropriate`,
          `- **Which ${t.mapTo} should it ${t.item === 'ILO' ? 'be linked' : 'be mapped'} to, if any?**`, '  > (write here)',
          `- **Concerns** (tick any): ${BOX} The ${t.item} itself should be revised ${BOX} The ${t.item} should be removed ${BOX} No suitable ${t.mapTo} exists ${BOX} Other`,
          '- **Note:**', '  > (write here)', '',
        ])),
      ].join('\n');
    };
    put(`faculty/part-b/${COURSE_CODE[course]}.md`, [courseHeader(course, 'Part B'), `**${withB.length} case${withB.length === 1 ? '' : 's'}, ${withB.reduce((s, c) => s + c.proposals.length, 0)} proposals.**`, '', ...withB.map(formB)].join('\n'));
  }
  put('faculty/part-a/part-a-responses.csv', csv([
    ['reviewer_code', 'date_returned', 'case_code', 'course', 'relationship', 'alignment (Aligned / Partially aligned / Not aligned / Insufficient evidence)', 'which_listed_outcomes_fit (list cases only)', 'rationale', 'reading_applied', 'belongs_in_course (Yes / No / Unsure)', 'belongs_in_course_note', 'recommendation (No change / Revise text / Re-map / Remove / Refer / Other)', 're-map_target', 'bloom_source (optional)', 'bloom_target (optional)', 'confidence (High / Medium / Low)', 'comments'],
    ...ordered.map(c => ['', '', c.code, courseLine(c.course), TYPE[c.type].title, '', '', '', '', '', '', '', '', '', '', '', '']),
  ]));
  put('faculty/part-b/part-b-responses.csv', csv([
    ['reviewer_code', 'date_returned', 'case_code', 'proposal_code', 'proposal_type', 'proposal_text', 'rating', 'concerns', 're-map_target', 'suggested_edit_or_note'],
    ...partBCases.flatMap(c => c.proposals.map(p => ['', '', c.code, p.code, p.kind === 'rewrite' ? `rewrite of the ${TYPE[c.type].item}` : 're-mapping', p.kind === 'rewrite' ? p.text : `keep the text; ${TYPE[c.type].item === 'ILO' ? 'link it to a different CLO' : `map it to a different ${TYPE[c.type].mapTo}`}`, '', '', '', ''])),
  ]));

  // ---- faculty/01-reviewer-guide.md ----
  put('faculty/01-reviewer-guide.md', `# Reviewer guide

Thank you for reviewing these cases. Your judgments will become the reference against which a syllabus-checking program is evaluated. They do not change any syllabus, grade or policy by themselves.

## What you will receive
- **Part A** (\`part-a/<course>.md\`, with the spreadsheet \`part-a/part-a-responses.csv\`): one form per case for your course. Each form shows one relationship between two outcomes, for example a course learning outcome and the program outcome it is mapped to, and asks for your judgment.
- **Part B** (\`part-b/<course>.md\`, with \`part-b/part-b-responses.csv\`), later: changes to some of the same outcomes, proposed automatically. You will receive Part B only after you have returned Part A.
- **Curriculum references** (\`02-curriculum-references.md\`): the institutional texts held in the system, with their sources and status.

## Before you start
- Please work on your own, and do not discuss the cases with other reviewers until the coordinator asks you to.
- Judge each relationship from the two texts and your professional knowledge of the course and program. You will not be shown how anyone else, or any software, judged these cases.
- These are test cases. The course codes and titles are the institution's, but the descriptions and outcomes were written to test the software. Some program outcomes are general test wording rather than your program's official outcomes. Judge them as written.
- Some cases were written to be sound and some to be weak or mismatched. There is no expected proportion of either.
- If a case is unclear or badly posed, say so in the comments. That is useful information.
- A case's code tells you only its course and its place in your form.

## Terms
- **CLO:** course learning outcome. **ILO:** intended learning outcome of a lesson or week, a smaller unit within the course. **PO:** program outcome. **EGA:** expected graduate attribute (the institution has four).
- In a **CLO and PO** or **CLO and EGA** case, the CLO is judged against the PO or EGA it is mapped to.
- In an **ILO and CLO** case, the ILO is judged against the CLO it is meant to build toward.
- In a **list** case, the CLO is judged against a whole list. The question is whether it fits at least one item, and which.

## The questions on each form
1. **Alignment.** Choose one:
   - **Aligned:** in your judgment, the outcome supports the outcome it is mapped to.
   - **Partially aligned:** there is a real connection, but it is weak, indirect, incomplete in a way that matters, or at an inappropriate level.
   - **Not aligned:** the outcome does not support the outcome it is mapped to.
   - **Insufficient evidence:** the texts given are not enough to decide.

   These descriptions are deliberately general. If your answer depends on how alignment is defined, question 3 records how.
2. **Rationale.** Name the words or ideas in the texts that support your judgment, and anything missing.
3. **Reading you applied.** Did you treat the outcome as needing to show every part of the outcome above it, or as contributing a real part of it? The institution has not yet adopted a rule on this. Your answer shows how each judgment was made, so that it can be read correctly under whatever rule is adopted.
4. **Course fit.** Separately from alignment: does the outcome itself belong in this course, at this year level?
5. **Recommendation.** What, if anything, should change: no change; revise the outcome's text; keep the text but map it to a different outcome (say which); remove the outcome; refer the case for a policy decision; or something else.
6. **Cognitive level** (optional). The revised Bloom's taxonomy level of each text (Remember, Understand, Apply, Analyze, Evaluate, Create), or "Not applicable", for example for an attribute's name.
7. **Confidence.**
   - **High:** you would defend this judgment in a program review.
   - **Medium:** reasonable colleagues might differ.
   - **Low:** you are unsure or need more information.
8. **Comments.** Anything else, including problems with the case itself.

## Returning your forms
- Fill in the forms (printed or electronic) or the spreadsheet \`part-a/part-a-responses.csv\`, one row per case.
- Write the reviewer code the coordinator gave you. Write your name only if the institution asks for it.
- Return the forms to the coordinator by the agreed date. Once returned, Part A is final; you will then receive Part B.

## Part B
Part B lists changes proposed for some outcomes. They were generated automatically, are in no particular order, and are not endorsed by anyone. For each proposal, say whether it is:
- appropriate as written;
- acceptable with edits; or
- not appropriate.

Then tick any concerns, and suggest an edit if you wish. Part B does not change your Part A answers. Return it as for Part A, or in \`part-b/part-b-responses.csv\`.

## Time
As a rough guide, allow three to five minutes for each Part A case and one to two minutes for each Part B proposal.
`);

  // ---- faculty/02-curriculum-references.md ----
  const I = SEED.INSTITUTION, egaName = n => I.egas.find(e => e.no === n)?.name || `EGA ${n}`;
  const currTable = code => {
    const p = CURR.programs.find(x => x.code === code);
    return [`**${p.code}, ${p.name}, curriculum ${p.curriculumYear}** (registrar images ${p.files.join(', ')}; ${p.totalUnits} units)`, '',
      '| Year | Semester | Code | Title | Lec | Lab | Prerequisite as printed |', '|---|---|---|---|---|---|---|',
      ...p.terms.flatMap(t => t.rows.map(r => `| ${t.yearLevel} | ${t.semester} | ${cell(r.code)} | ${cell(r.title)} | ${r.lecture} | ${r.lab} | ${cell(r.rawPrerequisite || '(blank)')} |`))].join('\n');
  };
  const it204 = SEED.COURSES.find(c => c.code === 'IT 204');
  put('faculty/02-curriculum-references.md', `# Curriculum and institutional references

These are the institutional texts held in the syllabus system, reproduced exactly, with their sources and status. **None of them is a policy on how alignment is judged.** Where the system holds nothing, the entry says so.

The courses in the review forms are test cases. Their codes and titles follow the institution's programs, but their descriptions and outcomes were written for testing. The program outcomes in the forms are general test wording, not the official outcomes below.

---

## R-INST · Vision and mission
Source: \`src/data/outcomesSeed.js\` ("copied from the institutional form").

**Vision.** ${I.vision}

**Mission.** ${I.mission.lead}
${I.mission.items.map(m => `- ${m}`).join('\n')}

## R-EGA · Expected graduate attributes
Source: \`src/data/outcomesSeed.js\` and \`server/db/local-outcome-data.cjs\`. **The system holds names only. No official description of any EGA is held.**

| No. | Name | Short name |
|---|---|---|
${I.egas.map(e => `| ${e.no} | ${e.name} | ${e.short} |`).join('\n')}

## R-VAL · Core values
Source: \`server/config/marian-values.json\`, copied from ${VALS.source} on ${VALS.retrievedAt}.

**Status: ${VALS.approval.replace(/_/g, ' ')}.** ${VALS.approvalNote}

| Value | Definition (website wording, not yet confirmed for this use) |
|---|---|
${VALS.values.map(v => `| ${v.name} | ${cell(v.definition)} |`).join('\n')}

No source in the system attributes any of these values to an Augustinian or a Marian tradition.

## R-BSIT · BS Information Technology

### Program outcomes and their EGA mapping (system's list)
Source: \`src/data/outcomesSeed.js\`, copied from the institutional form.

| PO | Outcome | Mapped to EGA |
|---|---|---|
${SEED.PROGRAMS.BSIT.pos.map(p => `| ${p.no} | ${cell(p.text)} | ${p.egas.map(n => `${n} (${egaName(n)})`).join('; ')} |`).join('\n')}

### Program outcomes transcribed from the IT 202 syllabus
Source: \`server/db/local-outcome-data.cjs\`, from ${OUTC.sources.BSIT.file}, pages ${OUTC.sources.BSIT.pages.join(' and ')}.
${OUTC.sources.BSIT.warnings.map(w => `- Note in the source: ${w}`).join('\n')}

| PO | Outcome |
|---|---|
${OUTC.sources.BSIT.pos.map(p => `| ${p.no} | ${cell(p.text)} |`).join('\n')}

### The IT 204 syllabus template's course learning outcomes
Source: \`src/data/outcomesSeed.js\`, copied from the corrected syllabus template (IT204-Programming2-EOMS). The template also tags CLOs 2, 3 and 4 with PO 11 and PO 14, which are not in the BSIT list; those tags were left out when it was copied, for an administrator to decide.

| CLO | Title | Level label | POs | EGAs | Statement |
|---|---|---|---|---|---|
${it204.clos.map((k, i) => `| ${i + 1} | ${cell(k.title)} | ${k.level} | ${k.pos.join(', ')} | ${k.egas.join(', ')} | ${cell(k.statement)} |`).join('\n')}

The system does not define the level labels (Introductory, Enabling, Demonstrating, Integration of Values).

### Curriculum
${currTable('BSIT')}

## R-BSIE · BS Industrial Engineering

### Program outcomes transcribed from the IE 402 syllabus
Source: \`server/db/local-outcome-data.cjs\`, from ${OUTC.sources.BSIE.file}, pages ${OUTC.sources.BSIE.pages.join(', ')}.
${OUTC.sources.BSIE.warnings.map(w => `- Note in the source: ${w}`).join('\n')}

| PO | Outcome |
|---|---|
${OUTC.sources.BSIE.pos.map(p => `| ${p.no} | ${cell(p.text)} |`).join('\n')}

### Curriculum
${currTable('BSIE')}

## R-NONE · Programs with nothing held
The system holds no program outcomes, curriculum or syllabus for **BSN** (NCM 101), **BSEd** (EDUC 105), **BSA** (ACCTG 201) or **BSHM** (HM 210). Cases in these courses are judged from their texts and the reviewers' knowledge of the program. Whether official outcomes should be supplied is an institutional decision (I5).
`);

  // ======================= institution/ =======================
  const affected = p => `**Cases affected:** ${codes(POLICY_CASES[p]).join(', ')}.`;
  const decisionBox = '| Decision (option, with any wording) | Rationale | Decided by (role) | Date | Applies to (programs) |\n|---|---|---|---|---|\n| | | | | |';
  put('institution/01-policy-questions.md', `# Academic policy questions

**Status: open.** The system holds no approved answer to any of these questions. Each needs an institutional decision before faculty judgments can become approved evaluation references.

These are the seven questions the evaluation of the AI Syllabus Checker raised. They are set out here without saying how the software, or anyone else, answered the cases.

- **How to answer.** The policy panel records one decision per question, in the table under it or in \`policy-responses.csv\`, with the approving role and the date. Please decide on academic grounds. Do not choose an option because it would make the software agree with any particular answer.
- **Evidence notes.** Where the system holds something relevant, it is quoted as evidence of current practice. It is not policy. Where nothing is held, the question says so.
- **When to answer.** After the case reviewers have returned Part A (procedure, step 4), so that their own readings are recorded first.

---

## P1. Must a CLO show every competency in a PO, or may it contribute meaningfully to one component of the PO?

**Two questions that are easy to confuse.**
- **Individual alignment:** does this one CLO align with the PO it is mapped to?
- **Curriculum-wide coverage:** across all its courses and CLOs, does the program develop every component of the PO to the level required at graduation?

A program can cover a broad PO completely even if no single CLO covers all of it. Several courses usually share a PO, each developing part of it, often at rising levels. The question is which of the two the alignment judgment of a single CLO should answer.

**Options**
- **A. Contribution.** A CLO is aligned with a PO when it develops a substantial component of the PO at an appropriate level. Whether the whole PO is covered is checked across the curriculum (for example in a curriculum map), not CLO by CLO. "Partially aligned" is kept for a contribution that is weak, indirect or at an inappropriate level.
- **B. Coverage.** A CLO is aligned only when it shows every component of the PO: each action, object and condition. A CLO that develops some components is partially aligned.
- **C. Contribution, with a recorded degree.** As A, but each CLO–PO mapping also records how far the CLO develops the PO (for example introductory, enabling or demonstrating), so that coverage can be checked across the curriculum.
- **D. Other** (describe).

**What changes with the answer.**
- A CLO that constructs a table of specifications and test items, mapped to a PO on designing, implementing and evaluating assessments, is aligned under A and C and partially aligned under B.
- A CLO that records and reports transactions under the standards, mapped to a PO on recording, measuring and reporting them, depends also on whether an implied component (measuring) must be stated.

**What the system holds** (evidence of practice, not policy)
- **One template maps CLOs to POs whose wording they do not contain.** The institution's IT 204 syllabus template, as copied into the system, maps each CLO to one or two POs and EGAs.
  - Its CLO "Design, implement, and test robust and maintainable Java programs …" is mapped to PO 3 ("Design and develop computing solutions using a system-level perspective.") and to PO 7 ("Understand the impact of their work on society and strive to ensure that their actions contribute positively on the community.").
  - The CLO's wording does not mention society.
  - That is consistent with options A and C. But it is one template, and some of its tags (PO 11, PO 14) do not exist in the BSIT list.
- **Its CLOs carry undefined level labels.** The same template labels its four CLOs Introductory, Enabling, Demonstrating and Integration of Values, and the system does not define these labels. If they are the institution's levels of contribution, option C may already be practice (decision I7).
- **No curriculum map is held**, so the system has no record of how far each course contributes to each PO.

${affected('P1')}

**Status:** requires institutional clarification.

${decisionBox}

---

## P2. Is an ILO that is a smaller step toward its CLO aligned, when it does not show the CLO's other verbs, conditions or qualities?

The same distinction applies one level down. A single ILO is usually one step, and a course's ILOs together build each CLO.

**Options**
- **A. Step.** An ILO is aligned when it is a genuine step toward its CLO, in the same subject and not above the CLO's level, even if it does not show the CLO's other components; other ILOs develop those.
- **B. Coverage.** An ILO is aligned only when it shows every component of its CLO; otherwise it is partially aligned.
- **C. Step, with the set checked.** As A, and separately check that the ILOs linked to each CLO together cover it.
- **D. Other.**

**Related sub-questions**
- (a) Is an ILO at a lower cognitive level than its CLO acceptable as a step?
- (b) Is an ILO above its CLO's level a defect?
- (c) Must an ILO show its CLO's context or qualities, for example "in engineering", "valid and reliable" or "on a simulated patient"?

**What the system holds:** each ILO is linked to one CLO. No institutional rule on how an ILO is judged against its CLO is held.

${affected('P2')}

**Status:** requires institutional clarification.

${decisionBox}

---

## P3. How is a CLO judged against an expected graduate attribute known only by its name?

The four EGAs are held only as names: ${I.egas.map(e => `"${e.name}"`).join(', ')}.

**Options**
- **A. As a whole.** A CLO aligns with an EGA when it develops the attribute in a recognisable way. It need not reflect every word of the name.
- **B. Element by element.** The CLO must reflect each element of the name. For example, for "Critical and Creative thinker" it must show both critical and creative thinking. For "Competent Catholic Augustinian-Marian Professional" it must show both professional competence and the Catholic and Augustinian-Marian dimension.
- **C. Against an institutional description.** The institution supplies a description or rubric for each EGA, and CLOs are judged against it.
- **D. Other.**

**Related sub-questions**
- (a) Can a technical CLO with no ethical or faith element align with "Competent Catholic Augustinian-Marian Professional"?
- (b) Must a CLO mapped to "Critical and Creative thinker" show creativity as well as critical thinking?
- (c) Is a CLO's link to "Socially Responsive Steward" established by serving a community need?

**What the system holds**
- **Names only.** The system also notes that the source syllabi state no PO-to-EGA mapping for BSIE and BSCpE.
- **The BSIT list maps each PO to EGAs:**

  | BSIT POs | What they cover | Mapped to |
  |---|---|---|
  | 1–3 | applying computing knowledge, analysing requirements, designing solutions | EGA 1 |
  | 4, 5 and 9 | ethical behaviour as an IT professional, Augustinian virtues and corporate social responsibility, professional and social ethics | EGA 2 |
  | 6 | teamwork | EGA 4 |
  | 7 and 10 | the impact of one's work on society, ethical leadership and social responsibility | EGA 3 |
  | 8 | the latest developments in the field | EGAs 1 and 4 |

  This shows how one program's list associates outcomes with attributes. It is not a definition of the attributes.

${affected('P3')}

**Status:** requires institutional clarification. If an official description of each EGA exists, please supply it (decision I3).

${decisionBox}

---

## P4. Should an outcome's fit with its course change the alignment verdict, or be reported separately?

**Situations**
- a CLO on a topic that the curriculum teaches in another course;
- a team design CLO without the course's subject content;
- a CLO whose activity the course description does not mention;
- a CLO that may be too advanced, or too basic, for its year.

**Options**
- **A. Separate.** The alignment verdict judges only the relationship between the two outcomes. Fit with the course's subject and year level is a separate finding.
- **B. Integrated.** An outcome outside the course's subject cannot be aligned, whatever its relationship to the PO or EGA.
- **C. Integrated only across disciplines.** An outcome from another discipline altogether (for example a calculus CLO in a nursing course) is not aligned; otherwise fit is a separate finding.
- **D. Other.**

**Related sub-questions**
- (a) What is the authority on a course's scope: the course description, the approved syllabus or the curriculum?
- (b) Does the institution set expected cognitive levels by year?
- (c) Who decides that an outcome is too advanced or too basic for its year?

**What the system holds**
- **Registrar curriculum transcriptions** for BSIT, BSIE, BSCpE and BSIT Cyber Security, with year, semester, units and prerequisites (R-BSIT, R-BSIE). For example, BSIE places MA 7 Differential Calculus in year 1, first semester, and MA 8 Integral Calculus in the second semester, with MA 7 as its prerequisite. These show where topics sit, not how fit should affect an alignment verdict.
- **No year-level policy.** Nothing at all is held for BSN, BSEd, BSA or BSHM.

${affected('P4')}

**Status:** requires institutional clarification.

${decisionBox}

---

## P5. When should a recommendation re-map an outcome instead of rewriting it, and what must it say?

**Situations**
- a sound CLO mapped to an unrelated PO or EGA;
- an ILO linked to the wrong CLO;
- a CLO that fits no outcome of its program;
- a CLO that is weak in itself.

**Sub-questions**
- (a) When the outcome is sound but mapped to the wrong outcome:
  - ${BOX} change the mapping and keep the text;
  - ${BOX} rewrite the text to fit the mapping;
  - ${BOX} decide case by case.
- (b) Must a re-mapping recommendation name the outcome to map to?
  - ${BOX} yes, always;
  - ${BOX} yes, when the program's list is available;
  - ${BOX} no, saying that the mapping does not fit is enough.
- (c) May a recommendation propose removing an outcome, for example a calculus CLO found in a nursing course?
  - ${BOX} yes;
  - ${BOX} no, only flag it.
- (d) Who approves a mapping change? (name the role)
- (e) When an outcome is below its course's level and mapped to the wrong outcome, should it be re-mapped as it is, or rewritten first?

**What the system holds**
- In the system as designed, the institution's vision, mission and EGAs, and each program's POs, are fixed. Faculty write CLOs and map them.
- When the IT 204 template was copied, its tags to PO 11 and PO 14, which are not in the BSIT list, were left out so that "an administrator decides what they should map to". That is how one mapping question was handled, not a rule.

${affected('P5')}

**Status:** requires institutional clarification.

${decisionBox}

---

## P6. May a recommendation add or change value wording in an outcome, and which value vocabulary is authoritative?

**Sub-questions**
- (a) When a CLO already names values, may a recommendation add other values, or attribute them to a tradition (for example call a value "Marian" or "Augustinian")?
- (b) Which vocabulary is authoritative for syllabus outcomes: the six core values; values described as Augustinian or Marian; other terms (for example integrity, truth, service)?
- (c) Must recommendations keep the author's value wording exactly?
- (d) Who confirms that the value wording in an outcome is correct?

**What the system holds**
- **Six core values with unconfirmed definitions:** ${VALS.values.map(v => v.name).join(', ')}. The definitions were copied from the university website and are pending approval (R-VAL, decision I4).
- **No tradition is assigned.** No source assigns any value to an Augustinian or a Marian tradition.
- **One template uses the phrase.** The IT 204 template uses "Christo-centric Catholic and Marian–Augustinian values" in a CLO.

${affected('P6')}

**Status:** requires institutional clarification, and approval of the value definitions.

${decisionBox}

---

## P7. How should cognitive (Bloom's) levels be applied to graduate attributes and to outcomes with several verbs?

**Sub-questions**
- (a) Should an EGA, which is a noun phrase rather than an action, be given a cognitive level? If not, how is a CLO's level judged against it?
- (b) When an outcome has several verbs (for example "design, implement and evaluate"), which verb sets its level: the highest, the main one, or each separately?
- (c) Is an ILO below its CLO's level acceptable, and an ILO above it a defect? (See also P2.)
- (d) Which taxonomy and verb list does the institution use?

**What the system holds**
- **Levels are used in practice.** The IT 204 template's CLO titles name levels, for example "Skill Development / Evaluate", "Application / Create" and "Ethics & Responsibility / Evaluate & Create".
- **No rule is held** on how levels are assigned or compared.

${affected('P7')}

**Status:** requires institutional clarification.

${decisionBox}
`);
  put('institution/policy-responses.csv', csv([
    ['id', 'question', 'decision (option and wording)', 'rationale', 'decided_by_role', 'date', 'applies_to', 'version', 'notes'],
    ...[['P1', 'Must a CLO show every competency in a PO, or may it contribute meaningfully to one component?'], ['P2', 'Is an ILO that is a smaller step toward its CLO aligned without showing the CLO\'s other parts?'], ['P3', 'How is a CLO judged against an EGA known only by its name?'], ['P4', 'Should course fit change the alignment verdict, or be reported separately?'], ['P5', 'When should a recommendation re-map instead of rewrite, and what must it say?'], ['P6', 'May a recommendation add or change value wording, and which vocabulary is authoritative?'], ['P7', 'How are cognitive levels applied to attributes and multi-verb outcomes?'],
      ['I1', 'Name the coordinator, reviewers, adjudicators and policy panel'], ['I2', 'Approve the adjudication procedure'], ['I3', 'Official EGA descriptions'], ['I4', 'Core-value definitions'], ['I5', 'Outcomes and curricula for BSN, BSEd, BSA, BSHM'], ['I6', 'The BSIT outcome list'], ['I7', 'Meaning of the CLO level labels; curriculum map'], ['I8', 'Insufficient evidence as a reference answer'], ['I9', 'When a case may carry more than one accepted answer'], ['I10', 'Standard for an approved reference; reporting unresolved cases'], ['I11', 'Limits on recommendations'], ['I12', 'Records, versions and reviewer identity'], ['I13', 'Faculty review of the held-out cases'], ['I14', 'Checker findings remain advisory; scoring unchanged']]
      .map(([id, q]) => [id, q, '', '', '', '', '', '', '']),
  ]));
  put('institution/02-institutional-decisions.md', `# Institutional decisions needed

**Status: open.** Each decision is needed before the step it blocks (steps are in 03-adjudication-procedure.md). "Who decides" names a role for the institution to fill. It does not presume that a particular person or office exists.

| ID | Decision | Why it is needed | Who decides (role) | Needed before |
|---|---|---|---|---|
| P1–P7 | The seven academic policy questions (01-policy-questions.md) | They decide how case judgments become references | Policy panel | Step 6, adjudication |
| I1 | Name the coordinator, two reviewers per course, an adjudicator per discipline and the policy panel | The review needs qualified, independent people | Academic affairs | Step 1 |
| I2 | Approve, amend or reject the adjudication procedure | It is a proposal | Academic affairs, with quality assurance | Step 1 |
| I3 | Supply an official description of each EGA, or confirm that none exists | The system holds names only (P3) | The office responsible for the graduate attributes | Step 4 |
| I4 | Confirm or replace the core-value definitions | They were copied from the website and are pending approval (P6) | The office responsible for the core values | Step 4 |
| I5 | Supply official program outcomes and curricula for BSN, BSEd, BSA and BSHM, or confirm that these cases are judged as written | None is held; the cases use test wording | The program chairs | Step 1 |
| I6 | Confirm the BSIT outcome list | The system holds 10 outcomes from the institutional form and 9 transcribed from the IT 202 syllabus, numbered differently, and the IT 204 template tags outcomes 11 and 14 | The BSIT program chair | Step 4 |
| I7 | Say what the CLO level labels Introductory, Enabling, Demonstrating and Integration of Values mean, and whether a curriculum map with contribution levels exists | It bears on P1, option C | Quality assurance | Step 4 |
| I8 | Decide whether "insufficient evidence" is an acceptable reference answer, and how it is treated | The software has this verdict, and faculty may choose it | Policy panel | Step 6 |
| I9 | Decide when a case may carry more than one accepted answer | Some cases may be genuinely open to two readings | Policy panel | Step 6 |
| I10 | Set the standard for an approved reference (for example both reviewers agree, or an adjudicated decision), and how unresolved cases are reported | It is needed to record decisions | Policy panel | Step 7 |
| I11 | Set limits on recommendations: may they raise an outcome's cognitive level beyond what its course and year need, change its subject matter, add content not needed for alignment, or propose removal? | Part B asks faculty to rate such proposals; the software needs a rule | Policy panel | Step 7 |
| I12 | Decide where approved references are kept, how they are versioned, who may change them, and whether reviewers are recorded by name or by code | Accountability and privacy | Academic affairs, with the data protection officer | Step 7 |
| I13 | Decide whether and how faculty review the protected held-out cases (other reviewers, no software output, sealed until the final run) | Their verdicts are also developer-written | Quality assurance | Before any held-out run |
| I14 | Confirm that the checker's findings stay advisory, and that this review changes neither the official score, the pass mark of 79, the 47 rules nor the submission gates | This review changes no policy by itself | Academic affairs | Standing |

## Notes
- **P1–P7** are set out in full, with options, in 01-policy-questions.md.
- **I3 and I4** are needed before P3 and P6 can be settled on firm ground. If no description exists, P3 can still be decided (options A or B), but the references will rest on the names alone.
- **I5.** The nursing, education, accountancy and hospitality cases can still be reviewed as written. Faculty should know that their program outcomes are test wording.
- **I8 and I9** affect scoring: a case with two accepted answers is scored differently from one with a single answer, and the choice must be recorded, not left to whoever converts the records.
- **I11** is separate from P5 and P6. It covers the general limits on what a proposed rewrite may change: level, subject, added content, removal.
- **I13.** Faculty review of the held-out verdicts is the only way to make the final test meaningful. It must not expose those cases to the people who develop the software.
`);
  put('institution/03-adjudication-procedure.md', `# Proposed adjudication and validation procedure

**Status: a proposal for institutional approval (decision I2). Nothing in it is in force until approved.**

## 1. Principles
1. **Faculty judgment is the reference.** The software's answers are never evidence that a case is right or wrong, and agreement with the software is never a reason to accept a judgment.
2. **The provisional verdicts stay as they are.** The developer's provisional verdicts are not changed by any faculty decision, automatically or by hand. Approved references are recorded separately (section 7).
3. **No judgment is created on anyone's behalf.** A blank stays blank, and a case without enough faculty input stays unresolved.
4. **Policies are decided on academic grounds.** They are decided before the software's results are shown to the panel, and never so that the software scores better.
5. **Disagreement is information.** If reviewers cannot agree, the case is recorded as unresolved with both positions. It is not forced.
6. **Reviews are blinded.** Case reviewers see no software answers, no developer verdicts and no one else's forms until they have returned their own.

## 2. Roles
The institution names the people.

| Role | Who | Does | Does not |
|---|---|---|---|
| Coordinator | A staff member who reviews no cases | Assigns reviewer codes and cases; sends and collects forms; holds the coordinator folder; counts agreement | Judge cases; edit returned forms |
| Case reviewer | Two per course, from the discipline: mathematics or engineering (MA 7, IE 310), information technology (IT 204), nursing (NCM 101), education (EDUC 105), accountancy (ACCTG 201), hospitality (HM 210) | Completes Part A, then Part B, for the assigned cases | See the software's answers before both parts are returned |
| Adjudicator | One per discipline, for example the program chair or a designee who did not review the case | Settles cases on which the reviewers disagree, with a written reason | Overrule a policy the panel adopted |
| Policy panel | Quality assurance, academic affairs and the program chairs; for P3 and P6 also the office responsible for the institution's Catholic Augustinian-Marian identity and core values | Decides P1–P7 and the institutional decisions | Judge individual cases in place of the reviewers |
| Data steward | The developer | Records approved decisions as references exactly as decided, and logs every step | Change, interpret or complete a decision |

## 3. Sequence

| Step | What happens | Output |
|---|---|---|
| 0. Approve | The institution approves this procedure and names the people (I1, I2) | Approval record |
| 1. Prepare | The coordinator assigns reviewer codes and cases. It sends the reviewer guide, the curriculum references and Part A. It withholds Part B, the institution folder and the coordinator folder | Assignment list |
| 2. Part A | Each reviewer judges the assigned cases alone | Returned Part A, dated. The coordinator keeps a signed copy or checksum, after which the form is not edited |
| 3. Part B | Once a reviewer's Part A is returned, the reviewer rates the proposed changes for the same cases | Returned Part B |
| 4. Policy | The panel decides P1–P7 and the institutional decisions. It may see a summary of the faculty judgments (how often reviewers agreed, which readings they applied) but not the software's answers | A versioned, dated policy record |
| 5. Agreement | For each case the coordinator compares the two reviewers: verdict, recommendation type, and the reading each applied | Agreement table |
| 6. Adjudication | Some cases go to the adjudicator, who records a decision with a reason or marks the case unresolved. These are cases where the reviewers disagree, where a judgment rests on a reading the panel did not adopt, or where a reviewer chose "insufficient evidence" | Adjudication record |
| 7. Reference | The data steward records the decisions as a new, separate reference version (section 7) | Reference file and change log |
| 8. Report | The coordinator reports: how many cases are agreed, adjudicated, unresolved or excluded; how the references differ from the provisional verdicts; what the panel decided | Summary |

## 4. Case states
| State | Meaning |
|---|---|
| Pending | Not all forms are returned |
| Agreed | Both reviewers give the same verdict, and the reading each applied is consistent with the adopted policy |
| Adjudicated | The adjudicator decided, with a written reason |
| Unresolved | No decision could be reached; all positions are recorded (section 6) |
| Excluded | The reviewers or the adjudicator found the case ill-posed, for example texts that cannot be judged; recorded with the reason |

## 5. Agreement rules
- **Same option.** Two reviewers agree on a verdict only when they choose the same option; Aligned against Partially aligned is a disagreement.
- **A different reading.** Suppose a judgment was made under a reading the panel did not adopt. For example, P1 adopts contribution, and a reviewer chose Partially aligned only because the CLO did not show every part of the PO. The adjudicator, not the data steward, decides the verdict under the adopted reading. The reviewer's original answer stays on record.
- **Insufficient evidence.** If either reviewer chooses insufficient evidence, the adjudicator decides whether the case can be judged or should be excluded (see also I8).
- **More than one accepted answer.** A case gets two accepted verdicts only if the adjudicator records why reasonable experts differ under the adopted policy (I9). Otherwise it gets one.
- **Recommendation type.** It is compared the same way. Two re-mappings agree only if they name the same target outcome, or if both leave the target open.
- **Statistics.** Percent agreement is reported per course and overall, with Cohen's kappa where the number of cases allows it. With one to twenty cases per course these figures describe this review only.

## 6. Recording an unresolved disagreement
For each unresolved case, record:
- the case code;
- every judgment, with its reason and the reading applied;
- the adjudicator's note on why the case could not be settled;
- what would settle it, for example a policy decision, an EGA description or another reviewer.

Unresolved cases are left out of headline agreement figures and reported separately. They are never settled by the software's answer.

## 7. Turning decisions into approved evaluation references
1. **Never edit the dataset in place.** The provisional verdicts stay unchanged in \`server/lib/syllabuscheck/eval/alignment-dataset.json\`. Faculty decisions go into a new, separate record, for example \`alignment-faculty-references-v1.json\` or a new dataset version, as approved.
2. **What each reference record holds:**
   - the dataset version and item, and the case code;
   - a hash of the two texts;
   - the final verdict, or verdicts with the reason for more than one;
   - the recommendation type, and for a re-mapping the target outcome;
   - the policy version applied;
   - the reviewer and adjudicator codes, and the dates;
   - the rationale and the state.

   Unresolved and excluded cases are listed with their state but carry no verdict.
3. **Only agreed and adjudicated cases are marked faculty-reviewed.** Every other case keeps its previous status.
4. **Part B ratings are not reference answers for future drafts.** The software will write different drafts next time. The ratings are used to write and test rules for drafts, each approved by the panel. Examples of such rules: keep the author's values; do not raise a recall outcome to a design outcome when a re-mapping would keep it.
5. **The data steward records decisions mechanically and logs every step.** A clerical error, such as a wrong code, is fixed with a logged note. A change to a decision needs the adjudicator.
6. **Copies get the same decision.** Sixteen of the cases are copies of cases in an earlier test dataset (eval-1.1). Each copy gets the same decision, recorded through a mapping table.
7. **Later changes make a new version.** A change to an approved reference follows this procedure again and produces a new version; old versions are kept.
8. **Each evaluation names its reference version.** Results measured against provisional verdicts and against faculty references are never combined in one figure.

## 8. The protected held-out cases (later)
The held-out cases are a separate set kept for one final test. Their verdicts are also developer-written. Before they are used:
- faculty review them in a separate package, without any software output;
- the decisions are recorded and sealed, for example by placing a checksum in the repository, so that they cannot be used to tune the software;
- the developer does not see the sealed decisions until the frozen configuration has been run on the held-out cases once;
- the result is reported in aggregate, as the dataset's rules require.

This package neither uses nor reveals the held-out cases.

## 9. Small numbers
The review covers 58 cases, with one to four in four of the seven courses. Its agreement figures describe these cases. They are not estimates for the institution's syllabi.
`);

  // ======================= coordinator/ =======================
  const evalRow = (name, C, result) => {
    const e = C.evaluation;
    return `| ${name} | \`${e.model}\` | \`${e.promptVersion}\` | ${e.mode?.id || ''} (${e.mode?.name || ''}${e.mode?.stagesOn?.length ? `; stages ${e.mode.stagesOn.join(', ')}` : ''}) | align-1, development split (58) | ${e.runs} | ${e.ranAt} | \`${rel(result)}\` (sha256 \`${short(sha(result))}\`) |`;
  };
  const verdictCell = x => (x.r.verified ? `${ABBR[x.r.label]}${x.kind === 'agrees' ? '' : x.kind === 'false rejection' ? ' (FR)' : x.kind === 'false approval' ? ' (FA)' : ' (✗)'}` : 'unverified');
  const armCells = (c, arm) => c.answers.filter(x => x.arm === arm).map(verdictCell).join(' / ');
  const policiesOf = id => Object.keys(POLICY_CASES).filter(p => POLICY_CASES[p].includes(id));
  const prereg = id => (remap.has(id) ? `Pre-registered remap candidate; provisional remedy ${remap.get(id).provisionalRemedy}: "${remap.get(id).reason}"` : levelGap.has(id) ? `Pre-registered level-gap note: "${levelGap.get(id).note}"` : '');
  const remedyRun = x => (x.r.verified ? `${REMEDY[x.r.remedy] || x.r.remedy}` : 'unverified');
  const autoReason = c => {
    const arms = ['A2', 'B2'].map(arm => `${arm}: ${c.answers.filter(x => x.arm === arm).map(x => `run ${x.run} ${LABEL[x.r.label]}, ${remedyRun(x)}${x.flags.filter(f => CONCERN.test(f) && f !== 're-tag').length ? ` (${x.flags.filter(f => CONCERN.test(f) && f !== 're-tag').join('; ')})` : ''}`).join('; ')}`).join('. ');
    return `Both arms' verdicts are within the provisional labels${c.labelsVary ? ', but the labels vary between answers' : ''}. ${arms}.${OBS[c.id] ? ` ${OBS[c.id]}` : ''}${prereg(c.id) ? ` ${prereg(c.id)}` : ''}`;
  };
  const record = c => {
    const k = D.courses[c.course], t = TYPE[c.type], note = NOTES[c.id], pl = placement(c.course);
    const lines = [
      `### ${c.code} · \`${c.id}\` (Set ${c.set})`, '',
      `- **Course context:** ${courseLine(c.course)}; a test record. Description: "${k.description}" ${pl || `No curriculum or program outcomes for ${k.program} are held (R-NONE).`}`,
      `- **Relationship type:** ${c.type}. Source: ${t.source}. Target: ${t.target}.`,
      `- **Source (verbatim):**`, '', quote(c.item.source), '', `- **Target (verbatim):**`, '', quote(c.item.target), '',
      `- **Provisional labels (developer-written, not faculty-reviewed):** ${c.item.accept.map(l => LABEL[l]).join(' or ')}${c.item.ambiguous ? ' · marked ambiguous' : ''} · category ${c.item.category}. Rationale: "${c.item.why}"`,
      ...(prereg(c.id) ? [`- **${prereg(c.id)}**`] : []),
      `- **Faculty forms:** Part A ${c.code}${c.proposals.length ? `; Part B ${c.proposals.map(p => p.code).join(', ')}` : '; no Part B proposals'}.`,
      ...(alsoIn(c).length ? [`- **Same CLO in:** ${alsoIn(c).map(code => `${code} (\`${cases.find(o => o.code === code).id}\`)`).join(', ')}.`] : []),
      ...(c.a1 ? [`- **Also in eval-1.1:** this case is an unchanged copy. A1 (same model, prompt alignment-10) answered ${c.a1.map(x => (x.a ? `run ${x.run} ${LABEL[x.a.label]}` : `run ${x.run} none`)).join(', ')}.`] : []),
      '', '| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |', '|---|---|---|---|---|---|',
      ...c.answers.map(x => `| ${x.arm} | ${x.run} | ${x.r.verified ? LABEL[x.r.label] : 'unverified'} | ${x.kind} | ${x.r.sourceBloom || '?'} → ${x.r.targetBloom || '?'} | ${remedyRun(x)} |`),
      '', '**Evidence cited by each answer**', '',
      ...c.answers.flatMap(x => [
        `- **${x.arm} run ${x.run}.** Source quote "${inline(x.r.sourceQuote || '')}" · target quote "${inline(x.r.targetQuote || '')}"`,
        `  - Explanation: ${x.r.explanation}`,
        ...(x.r.draft ? [`  - Draft: "${x.r.draft}"`] : []),
        ...(x.flags.length ? [`  - Pre-registered rule flags: ${x.flags.join('; ')}.`] : []),
        ...(x.r.validationFailures?.length ? [`  - First-attempt refusals: ${x.r.validationFailures.map(v => v.code).join(', ')} (re-asked; final answer verified).`] : []),
      ]),
      '', `**Reason for disagreement.** ${note ? note.reason : autoReason(c)}`, '',
      `**Policy questions:** ${policiesOf(c.id).length ? policiesOf(c.id).map(p => `${p}, ${POLICY_TITLE[p]}`).join('; ') : 'none of P1–P7 directly; see I11 for limits on recommendations'}.${note?.question ? ` **Case question:** ${note.question}` : ''}`, '',
    ];
    return lines.join('\n');
  };
  const header = ['| Arm | Model (as recorded; Anthropic\'s direct API) | Prompt | Mode | Dataset | Runs | Ran (UTC) | Saved record |', '|---|---|---|---|---|---|---|---|',
    evalRow('A2', A, SRC.a2), evalRow('B2', B, SRC.b2)].join('\n');
  const set1 = ordered.filter(c => c.set === 1), set2 = ordered.filter(c => c.set === 2), set3 = ordered.filter(c => c.set === 3);
  const frCount = arm => cases.reduce((s, c) => s + c.answers.filter(x => x.arm === arm && x.kind === 'false rejection').length, 0);
  put('coordinator/01-case-inventory.md', `# Unique-case disagreement inventory (restricted)

**Restricted to the review coordinator.** This document names the evaluation arms, and shows the software's verdicts, explanations and drafts and the developer's provisional verdicts. Do not give it to case reviewers before they have returned Parts A and B.

**Agreement here is with provisional, developer-written verdicts. It is not faculty-validated accuracy.** No verdict in this document has been reviewed by faculty. Where an answer differs from a provisional verdict, the inventory does not assume that either is right.

## Scope
The inventory covers all 58 cases in the development split of align-1, each once. No two cases share both texts, and the held-out split was not read.

| Set | Cases | Meaning | Where |
|---|---|---|---|
| 1 | ${counts[1]} | At least one A2 or B2 answer is outside the provisional labels | Section 1, full records |
| 2 | ${counts[2]} | All answers are within the provisional labels, but the labels vary between answers, or a recommendation raises a question (a re-mapping, a pre-registered remap or level-gap note, or a draft flagged by a pre-registered rule) | Section 2, full records |
| 3 | ${counts[3]} | No disagreement and no flagged recommendation | Section 3, summary only |

False rejections (an answer other than ALIGNED where ALIGNED is the only provisional label): A2 ${frCount('A2')} of 50 answers, B2 ${frCount('B2')} of 50. False approvals: none in either arm.

**Evaluations compared**

${header}

A1 (the same model and the A2 prompt on the eval-1.1 dataset, ${A1.ranAt}) is quoted only for the 16 cases copied from eval-1.1.

## Summary of all 58 cases
Verdicts: A = aligned, P = partially aligned, N = not aligned; FR = false rejection against the provisional labels; ✗ = otherwise outside them.

| Code | Case id | Set | Type | Provisional labels | A2 run 1 / 2 | B2 run 1 / 2 | Part B proposals | Policy questions |
|---|---|---|---|---|---|---|---|---|
${ordered.map(c => `| ${c.code} | \`${c.id}\` | ${c.set} | ${c.type} | ${c.item.accept.map(l => ABBR[l]).join(' or ')}${c.item.ambiguous ? ' (ambiguous)' : ''} | ${armCells(c, 'A2')} | ${armCells(c, 'B2')} | ${c.proposals.length || '–'} | ${policiesOf(c.id).join(', ') || '–'} |`).join('\n')}

## Section 1. Verdict disputes (Set 1, ${set1.length} cases)

${set1.map(record).join('\n')}

## Section 2. Recommendation and consistency cases (Set 2, ${set2.length} cases)

${set2.map(record).join('\n')}

## Section 3. Cases without disagreement (Set 3, ${set3.length} cases)
In every Set 3 case, all four answers are within the provisional labels, give the same verdict, and carry no flagged recommendation. These cases still need faculty review (Part A), because the provisional labels are unreviewed. ${set3.filter(c => c.proposals.length).length} of them have proposed changes. Those are in Part B with the rest, and their texts are also in \`cases.json\`.

| Code | Case id | Type | Provisional labels | All four answers | Remedies | Part B proposals |
|---|---|---|---|---|---|---|
${set3.map(c => `| ${c.code} | \`${c.id}\` | ${c.type} | ${c.item.accept.map(l => ABBR[l]).join(' or ')} | ${LABEL[c.answers[0].r.label]} | ${[...new Set(c.answers.map(remedyRun))].join(', ')} | ${c.proposals.map(p => p.code).join(', ') || '–'} |`).join('\n')}

## Linked cases
- **The same CLO in several cases.** These are different relationships, not duplicates, but a reviewer should judge the shared CLO consistently:
${[...new Map(cases.filter(c => alsoIn(c).length).map(c => [norm(cloText(c)), [c.code, ...alsoIn(c)].sort()])).values()].map(g => `  - ${g.map(code => `${code} (\`${cases.find(o => o.code === code).id}\`)`).join(', ')}`).join('\n')}
- **Copies of eval-1.1 cases.** ${cases.filter(c => c.a1).length} cases are unchanged copies of cases in the eval-1.1 dataset (\`server/lib/syllabuscheck/eval/dataset.json\`): ${codes(cases.filter(c => c.a1).map(c => c.id)).join(', ')}. One faculty decision should apply to both copies (procedure, section 7).
`);

  // ---- coordinator/02-recommendation-quality-review.md ----
  const allAns = arm => ordered.flatMap(c => c.answers.filter(x => x.arm === arm).map(x => ({ c, x })));
  const countFlag = (arm, re) => allAns(arm).filter(({ x }) => x.flags.some(f => re.test(f))).length;
  const listFlag = (arm, re) => allAns(arm).filter(({ x }) => x.flags.some(f => re.test(f))).map(({ c, x }) => `${c.code} run ${x.run}`);
  const escGroupOf = id => (ESC_GROUPS.find(([, ids]) => ids.includes(id)) || ['other'])[0];
  const escRows = arm => {
    const rows = allAns(arm).filter(({ x }) => x.flags.some(f => /^Bloom escalation/.test(f)));
    const groups = {};
    for (const { c, x } of rows) (groups[escGroupOf(c.id)] = groups[escGroupOf(c.id)] || []).push(`${c.code} r${x.run}`);
    return groups;
  };
  const escA = escRows('A2'), escB = escRows('B2');
  const remapMatch = arm => PRE.remapCandidates.flatMap(rc => byId.get(rc.id).answers.filter(x => x.arm === arm && x.r.verified).map(x => (rc.provisionalRemedy.startsWith('EITHER') ? ['RETAG_OUTCOME', 'REWRITE_TEXT'].includes(x.r.remedy) : rc.provisionalRemedy === 'RETAG' ? x.r.remedy === 'RETAG_OUTCOME' : x.r.remedy === 'REWRITE_TEXT'))).filter(Boolean).length;
  const retagCases = ordered.filter(c => remap.has(c.id) || c.answers.some(x => x.r.remedy === 'RETAG_OUTCOME'));
  const matrix = ordered.filter(c => c.set !== 3).map(c => `| ${c.code} | \`${c.id}\` | ${c.item.accept.map(l => ABBR[l]).join(' or ')} | ${armCells(c, 'A2')} | ${armCells(c, 'B2')} | ${c.answers.filter(x => x.arm === 'A2').map(remedyRun).join(' / ')} | ${c.answers.filter(x => x.arm === 'B2').map(remedyRun).join(' / ')} | ${[...new Set(c.answers.flatMap(x => x.flags.filter(f => f !== 're-tag').map(f => f.replace(/ \(.*$/, ''))))].join('; ') || '–'} |`).join('\n');
  const stat = {
    rewriteAligned: { A2: countFlag('A2', /^rewrite of a provisionally aligned/), B2: countFlag('B2', /^rewrite of a provisionally aligned/) },
    escalation: { A2: countFlag('A2', /^Bloom escalation/), B2: countFlag('B2', /^Bloom escalation/) },
    duplicates: { A2: countFlag('A2', /^duplicates another CLO/), B2: countFlag('B2', /^duplicates another CLO/) },
    iloRestates: { A2: countFlag('A2', /^ILO draft restates/), B2: countFlag('B2', /^ILO draft restates/) },
    iloAbove: { A2: countFlag('A2', /^ILO draft above/), B2: countFlag('B2', /^ILO draft above/) },
    replacement: { A2: countFlag('A2', /^replacement/), B2: countFlag('B2', /^replacement/) },
    values: { A2: countFlag('A2', /^value wording/), B2: countFlag('B2', /^value wording/) },
    retag: { A2: countFlag('A2', /^re-tag$/), B2: countFlag('B2', /^re-tag$/) },
    remapMatch: { A2: remapMatch('A2'), B2: remapMatch('B2') },
    drafts: { A2: allAns('A2').filter(({ x }) => x.r.draft).length, B2: allAns('B2').filter(({ x }) => x.r.draft).length },
  };
  const escTable = ['| Group | A2 | B2 |', '|---|---|---|', ...[...ESC_GROUPS.map(([g]) => g), 'other'].filter(g => escA[g] || escB[g]).map(g => `| ${g} | ${(escA[g] || []).length}: ${(escA[g] || []).join(', ') || '–'} | ${(escB[g] || []).length}: ${(escB[g] || []).join(', ') || '–'} |`)].join('\n');
  put('coordinator/02-recommendation-quality-review.md', `# Recommendation-quality review (restricted)

**Restricted to the review coordinator:** it names the arms and their answers. **This is a developer review against rules fixed before B2 ran (\`p2b2-preregistered.json\`). It is not a faculty review.** The faculty review of the same recommendations is Part B. Counts follow the B2 report (\`docs/anthropic-p2-b2-report.md\`, section C) and were recomputed here from the saved records.

## 1. Two separate questions
Whether a verdict is right and whether a recommendation is appropriate are different questions. The evaluations show all four combinations (the verdict columns compare with the provisional labels only):

| | The recommendation looks appropriate | The recommendation is questionable |
|---|---|---|
| **The verdict is within the provisional labels** | B2 on ${codeOf('clo-po-calc-unrelated')} (\`clo-po-calc-unrelated\`): not aligned; keep the calculus CLO and re-map it | A2 on ${codeOf('d-po-12')} (\`d-po-12\`): partially aligned is accepted, but the rewrite brings computing into a nursing CLO |
| **The verdict is outside the provisional labels** | B2 on ${codeOf('d-po-09')} (\`d-po-09\`): partially aligned, with a one-word addition ("measure") | B2 on ${codeOf('d-ega-03')} (\`d-ega-03\`) run 2: not aligned on course fit, and the replacement removes the community element that links the CLO to its attribute |

**How the faculty review keeps them apart**
- Part A asks faculty for the verdict and the type of remedy.
- Part B asks them to rate each proposed change.
- The reference records keep the two apart (procedure, section 7).

A rewrite of an outcome that faculty judge aligned is unnecessary whatever its quality, so Part A decides whether a change was needed, and Part B how good the change is.

## 2. Sets 1 and 2 at a glance
Verdicts against the provisional labels: FR = false rejection, ✗ = otherwise outside them. The flags are the pre-registered rules, per arm and run, in the case records.

| Code | Case | Provisional labels | A2 verdicts | B2 verdicts | A2 remedies | B2 remedies | Rule flags (either arm) |
|---|---|---|---|---|---|---|---|
${matrix}

## 3. The seven review areas

### 3.1 REWRITE_TEXT against RETAG_OUTCOME
- **A2 cannot re-map.** Its prompt has no re-mapping option, so every A2 remedy is a rewrite.
- **B2 re-mapped ${stat.retag.B2} answers on ${new Set(allAns('B2').filter(({ x }) => x.r.remedy === 'RETAG_OUTCOME').map(({ c }) => c.id)).size} cases.**
- **On the 8 remap candidates** (16 answers per arm), the remedy matches the pre-registered provisional remedy in ${stat.remapMatch.B2} of 16 B2 answers and ${stat.remapMatch.A2} of 16 A2 answers.
- **No re-mapping names its target.** Every B2 re-mapping explanation says that the mapping does not fit, but none names the outcome to move to.
- **B2 alternates between runs** on 4 cases: ${codes(['clo-po-calc-lower-level', 'd-ega-06', 'd-ilo-03', 'd-ilo-09']).join(', ')}.
- **Doubtful re-mappings:**
  - ${codeOf('d-ilo-03')} run 2 ("to a different outcome or to none");
  - ${codeOf('d-ilo-09')} run 2 ("may be sound for another week or CLO", though the course has no history topic).
- **One re-mapping keeps a level gap:** ${codeOf('clo-po-calc-lower-level')} run 2 (a recall-level CLO under an Apply-level PO).

| Code | Case | Pre-registered remedy or note | A2 run 1 / 2 | B2 run 1 / 2 |
|---|---|---|---|---|
${retagCases.map(c => `| ${c.code} | \`${c.id}\` | ${cell(remap.has(c.id) ? remap.get(c.id).provisionalRemedy : levelGap.has(c.id) ? `level gap: ${levelGap.get(c.id).note}` : '–')} | ${c.answers.filter(x => x.arm === 'A2').map(remedyRun).join(' / ')} | ${c.answers.filter(x => x.arm === 'B2').map(remedyRun).join(' / ')} |`).join('\n')}

**For faculty:** the re-mapping proposals in Part B, Part A question 5, and policy P5.

### 3.2 Incorrect PO mappings
By the developer's provisional reading, a mapping question arises in these cases:
- **a PO from another program's list, mapped to a sound CLO:** ${codeOf('d-po-12')} (\`d-po-12\`);
- **a CLO from another discipline, which no PO of the program fits, so a re-mapping cannot help:** ${codeOf('clo-po-nurs-unrelated')} (\`clo-po-nurs-unrelated\`);
- **remap candidates whose provisional remedy is a re-tag or either:** ${codes(PRE.remapCandidates.filter(r => /RETAG|EITHER/.test(r.provisionalRemedy)).map(r => r.id)).join(', ')};
- **level gaps where the pre-registered note says a re-tag would keep the outcome:** ${codes(['clo-po-calc-lower-level', 'd-po-02']).join(', ')};
- **re-mapped by B2 with no pre-registered note:** ${codes(['d-po-04', 'd-ega-08']).join(', ')}, and the two doubtful ILO re-mappings in 3.1.

What each arm did:
- **A2 bent the CLO toward the wrong outcome in 6 answers:** ${codes(['clo-po-calc-unrelated', 'd-po-12', 'd-ega-04']).join(', ')}, two each.
- **B2 did so in none.**
- **Neither arm's explanation of ${codeOf('d-po-12')} says that the PO belongs to another program's list.**

Whether the right remedy is to change the mapping, the text or both is P5. It is not settled here.

### 3.3 Rewriting already-aligned CLOs
Drafts written for cases whose only provisional label is ALIGNED: **A2 ${stat.rewriteAligned.A2}, B2 ${stat.rewriteAligned.B2}**. Each follows from a verdict in Set 1, so the faculty verdict in Part A decides whether any change was needed. Part B then rates the draft.

- **A2:** ${listFlag('A2', /^rewrite of a provisionally aligned/).join(', ')}
- **B2:** ${listFlag('B2', /^rewrite of a provisionally aligned/).join(', ')}

### 3.4 Unnecessary Bloom escalation
**The rule (pre-registered):** a CLO draft is flagged when the level of its leading verb is above the level the arm gave the CLO and at or above the level it gave the PO or EGA. An ILO draft is flagged when it is above its CLO.

**Counts:**
- CLO drafts: **A2 ${stat.escalation.A2}, B2 ${stat.escalation.B2}**;
- ILO drafts above their CLO: A2 ${stat.iloAbove.A2}, B2 ${stat.iloAbove.B2}.

The rule cannot tell a needed raise from an unnecessary one. The groups below follow the B2 report, and faculty decide in Part B:

${escTable}

**For faculty:** Part B ("raises the cognitive level more than warranted"), and I11.

### 3.5 Duplicate learning outcomes
- **CLO drafts that duplicate another CLO of the course** (pre-registered: word-stem overlap of 0.8 or more):
  - A2 ${stat.duplicates.A2}: ${listFlag('A2', /^duplicates another CLO/).join(', ') || 'none'};
  - B2 ${stat.duplicates.B2}: ${listFlag('B2', /^duplicates another CLO/).join(', ') || 'none'}.
- **ILO drafts that restate their own CLO** (word overlap of 0.5 or more), so that they are no longer a step toward it:
  - A2 ${stat.iloRestates.A2}: ${listFlag('A2', /^ILO draft restates/).join(', ') || 'none'};
  - B2 ${stat.iloRestates.B2}: ${listFlag('B2', /^ILO draft restates/).join(', ') || 'none'}.
- **A CLO draft that restates the PO** (read by hand): ${codeOf('clo-po-nurs-unrelated')} B2 run 2, "Provide safe, quality basic nursing care to a simulated patient using the nursing process." The PO reads "Provide safe, quality nursing care to individuals using the nursing process."

**For faculty:** Part B ("duplicates or restates another outcome"); for ${codeOf('clo-po-nurs-unrelated')}, whether removal is the better remedy (P5).

### 3.6 Changes to institutional values
**The rule (pre-registered):** a draft is flagged when it names a core value or another value term, or drops a value reference that the original had. Flagged drafts:
- A2 ${stat.values.A2}: ${listFlag('A2', /^value wording/).join(', ') || 'none'};
- B2 ${stat.values.B2}: ${listFlag('B2', /^value wording/).join(', ') || 'none'}.

Read by hand:
- **${codeOf('d-ega-07')} (\`d-ega-07\`)** is the only CLO in the cases that names values ("the Augustinian values of community and truth").
  - A2 left it unchanged.
  - B2 run 1 relabels them "Augustinian-Marian values of community, truth and compassion".
  - B2 run 2 keeps them and adds "the Marian value of compassion".
  - Compassion is one of the six core values. "Truth" is not, and no source in the system assigns values to an Augustinian or a Marian tradition.
- **${codeOf('d-ega-08')} (\`d-ega-08\`):**
  - A2's drafts add value terms to a purely technical CLO ("integrity", "humility", "service to others").
  - B2 re-maps instead and adds none.
- **No explanation in either arm proposes changing an EGA, a PO, a value or any institutional policy.**

**For faculty:** P6, and Part B ("adds, removes or changes values or attributes").

### 3.7 Changes to course scope
**The rule (pre-registered):** a draft is a replacement, not a revision, when it keeps under a third of the original's content stems. Replacements:
- A2 ${stat.replacement.A2};
- B2 ${stat.replacement.B2}.

Many are expected, because they replace off-subject outcomes. Those that change a plausible outcome's subject (read by hand, B2 report C6):
- **content replaced to fit the course description:**
  - ${codeOf('d-po-01')}: integration becomes differentiation;
  - ${codeOf('d-ega-03')}: the outreach becomes basic care;
  - ${codeOf('d-po-06')}: anatomy becomes communication.
- **content added to fit the course description:**
  - calculus in a team-design CLO (${codeOf('d-any-po-03')} B2 run 1);
  - differentiation in a linear-algebra CLO (${codeOf('d-any-po-01')} B2 run 2).
- **multi-part widening:**
  - ${codeOf('d-po-07')}: construct, administer and evaluate;
  - ${codeOf('d-po-03')}: design and evaluation;
  - ${codeOf('clo-po-prog-interdisciplinary')}: organizations and society.
- **ILO drafts grown toward their CLO:**
  - ${codeOf('d-ilo-01')};
  - ${codeOf('ilo-clo-prog-aligned')} B2 run 1 adds testing;
  - ${codeOf('d-ilo-02')} B2 run 2 adds implementation.

**For faculty:** Part B ("changes the course's subject matter or scope"), P4 and I11.

## 4. Draft counts
| | A2 | B2 |
|---|---|---|
| Drafts | ${stat.drafts.A2} | ${stat.drafts.B2} |
| Re-mappings | ${stat.retag.A2} | ${stat.retag.B2} |
| Remap candidates given the provisional remedy (of 16) | ${stat.remapMatch.A2} | ${stat.remapMatch.B2} |
| Rewrites of provisionally aligned outcomes | ${stat.rewriteAligned.A2} | ${stat.rewriteAligned.B2} |
| Bloom escalation (CLO drafts) | ${stat.escalation.A2} | ${stat.escalation.B2} |
| Duplicate CLOs | ${stat.duplicates.A2} | ${stat.duplicates.B2} |
| ILO drafts restating their CLO | ${stat.iloRestates.A2} | ${stat.iloRestates.B2} |
| Replacements (under a third kept) | ${stat.replacement.A2} | ${stat.replacement.B2} |
| Value wording flagged | ${stat.values.A2} | ${stat.values.B2} |
`);

  // ---- coordinator/03-comparison-and-blinding-key.md ----
  put('coordinator/03-comparison-and-blinding-key.md', `# Comparison document and blinding key (restricted)

**Restricted to the review coordinator.** This is the only document that links the blinded forms to the evaluations. Keep it, and the rest of the coordinator folder, away from case reviewers until they have returned Parts A and B.

## 1. Evaluations compared
${header}
| A1 | \`${A1.model}\` | \`${A1.promptVersion}\` | A (legacy) | eval-1.1 (41 cases; 16 copied into align-1) | ${A1.runs} | ${A1.ranAt} | \`${rel(SRC.a1)}\` (sha256 \`${short(sha(SRC.a1))}\`) |

- **Model, settings and cases are the same.** A2 and B2 used the same model and settings on the same 58 cases; they differ in prompt and recommendation contract. Their differences belong to the prompts, not to the model.
- **Every verdict is compared with provisional, developer-written labels**, which are not faculty-validated.

## 2. Case key
| Code | Dataset id | Set | Type | Category | Ambiguous | Provisional labels | Copy of an eval-1.1 case |
|---|---|---|---|---|---|---|---|
${ordered.map(c => `| ${c.code} | \`${c.id}\` | ${c.set} | ${c.type} | ${c.item.category} | ${c.item.ambiguous ? 'yes' : ''} | ${c.item.accept.map(l => LABEL[l]).join(' or ')} | ${c.a1 ? 'yes' : ''} |`).join('\n')}

## 3. Part B proposal key
| Proposal | Kind | Proposed by (arm, run, that answer's verdict) | Pre-registered rule flags |
|---|---|---|---|
${partBCases.flatMap(c => c.proposals.map(p => `| ${p.code} | ${p.kind === 'rewrite' ? 'rewrite' : 're-mapping'} | ${p.from.join('; ')} | ${cell(p.flags.join('; ') || '–')} |`)).join('\n')}

## 4. How the codes and order were made
- **Case codes.** Cases are coded by course and numbered by relationship type (${TYPE_ORDER.join(', ')}), then by sha256 of the salt and the dataset id. The salt is \`${SALT}\`.
- **Part B proposals.** Every rewrite or re-mapping that A2 or B2 proposed is included, for every case that has one. That covers Set 3 cases too, so Part B does not reveal the sets. Identical texts (after collapsing white space) are merged, and all re-mappings of a case are merged into one proposal. Proposals are ordered by sha256 of the salt, the case code, the kind and the text.
- **Nothing in a code or an order depends on the provisional label, the category or any verdict.**
`);

  // ---- coordinator/04-post-validation-development-plan.md ----
  put('coordinator/04-post-validation-development-plan.md', `# After faculty validation: development steps

**Status: a proposal. None of these steps is authorised, and none should be started yet.**
- Every step that sends a request to a model provider needs its own written approval and budget, as before.
- Claude stays evaluation-only throughout, and production stays locked.
- Throughout, nothing changes in the 47 deterministic rules, the official score, the pass mark of 79, the deductions or the submission gates. Nothing changes in the historical results, the provisional labels or the faculty datasets.

## Where things stand
Against provisional labels, not faculty-validated:

| Measure | A2 (\`alignment-10\`) | B2 (\`alignment-12a3-r7\`, Stage A + B3) |
|---|---|---|
| Permissive agreement | 96 of 116 | 87 of 116 |
| False approvals | 0 of 52 | 0 of 52 |
| False rejections | 18 of 50 | 27 of 50 |
| Remap candidates given the provisional remedy | 10 of 16 | 16 of 16 |
| Rewrites of provisionally aligned outcomes | 18 | 27 |

- **Small sample.** Two runs per arm. B2 changed its verdict between its own runs on 6 of 58 cases.
- **Most of the disagreement is policy, not error.** It rests on questions only the institution can answer (P1–P7).

## 1. Identify prompt weaknesses
- **Re-score first, offline.** Before changing anything, score the saved A2 and B2 answers against the approved faculty references; for the 16 copied cases, add A1. This needs no provider call and no budget. It shows:
  - how many of the provisional "false rejections" faculty consider false;
  - whether any provisional agreement was wrong;
  - which disagreements remain.
- **Trace each remaining disagreement to the prompt rule that produced it**, by policy question. The A2 report traced 13 of A2's 18 false rejections to two rules. Candidates already visible:
  - the multi-part rule ("every one must be shown"), if P1 adopts contribution;
  - the course-subject rule, which lets course fit decide the verdict, if P4 separates fit;
  - the ILO step test against the multi-part reading (P2);
  - word-by-word reading of EGA names (P3);
  - strict level readings: rating a multi-verb PO by a lower verb, or counting an ILO's lower level as a gap (P7);
  - first-attempt source/target swaps on ILO–CLO pairs (4 of 116 in B2, all recovered);
  - recommendation patterns: rewrites of aligned outcomes, raising to the PO's level, ILO drafts that restate their CLO, value wording, RETAG/REWRITE alternation, and re-mappings without a target.
- **Write each as a testable statement before any change is made.**

## 2. Make targeted changes using development data
- **One change per variant.** Each variant is named, versioned and hashed, and its expected effect is written down before it runs, as was done for B2.
- **Development data only.** Use the development split and, where needed, new development cases written for the purpose. Never use the held-out cases.
- **No case examples in the prompt.** Do not paste development cases into the prompt as examples. If examples are needed, write separate ones and check them for overlap with both splits.
- **The validator and its stop rule stay as they are**, at three invalid answers.

## 3. Preserve useful RETAG_OUTCOME behaviour
- **Keep Stage A's re-mapping contract:** a sound text with the wrong mapping gets a re-mapping with an empty draft.
- **Name the target if P5 requires it.** The re-mapping then names the target outcome from the program's list, and the validator checks it against the list.
- **Regression checks:**
  - re-mapping on the faculty-approved re-mapping cases;
  - no re-mapping where faculty choose removal or a rewrite (for example an off-subject CLO);
  - the same remedy in every run (B2 alternated on 4 cases).

## 4. Reduce unsupported false rejections
- **Align the verdict rules with P1–P4 as adopted.** For example, if contribution is adopted: a CLO that develops a substantial part of the PO at an appropriate level is ALIGNED, and the uncovered parts are noted, not scored as partial.
- **If P4 separates course fit**, report fit in its own advisory field and keep it out of the verdict.
- **Measure false rejections against the faculty references, by policy question.** False approvals must not rise: the 0 of 52, and the keyword traps, are hard gates.

## 5. Prevent unnecessary rewriting of aligned CLOs
- **No draft for an ALIGNED verdict.** That is already the contract.
- **An optional suggestion, not a required rewrite**, for a partial verdict whose only gap is optional under the adopted policy.
- **Drafts limited to the gap they fix.** They keep the author's subject, level and values unless the gap needs otherwise, and an ILO draft stays a step.
- **An advisory static draft review** for the patterns faculty reject in Part B: escalation, scope change, value changes, duplication.
- **Measures:** rewrites of faculty-aligned outcomes (the target is none), and the Part B-derived draft rules.

## 6. Repeat the relevant development evaluations
- **Each run needs its own approval and budget.** Run the A2-equivalent baseline and each changed variant on the same development cases, with the same model and settings.
- **Run enough to separate effect from variation.** Two runs per arm could not separate a change from run-to-run variation. Use at least three runs, more cases, or both.
- **Score against the faculty references first**, and report provisional agreement separately.
- **Keep the safeguards:** the spending guard, the request limits and the validation stop.

## 7. Lock the final evaluation configuration
- **Freeze everything:** the model id, the prompt version and hash, the contract, the stage flags, the batch size, the retries, the validator, the scoring script, the reference version and the analysis plan.
- **Pre-register what will be reported. Change nothing after the lock.**

## 8. Execute the protected held-out dataset once
- **Conditions:** only after step 7, with its own approval and budget, and after the held-out verdicts have been faculty-reviewed and sealed (procedure, section 8).
- **The run:** one run of the frozen configuration, reported in aggregate and appended to the held-out log.
- **Afterwards:** report the result whatever it is. Do not tune on the held-out cases afterwards.
`);

  // ---- coordinator/cases.json ----
  put('coordinator/cases.json', JSON.stringify({
    about: 'Restricted: the machine-readable form of the adjudication package for the 58 align-1 development cases. Provisional labels are developer-written and not faculty-reviewed; nothing here is a faculty judgment.',
    builtAt: BUILT, salt: SALT,
    sources: Object.fromEntries(Object.entries(SRC).map(([k, f]) => [k, { file: rel(f).startsWith('..') ? path.basename(f) : rel(f), sha256: sha(f) }])),
    evaluations: { A2: A.evaluation, B2: B.evaluation, A1: { model: A1.model, promptVersion: A1.promptVersion, dataset: A1.dataset, runs: A1.runs, ranAt: A1.ranAt } },
    sets: { 1: set1.map(c => c.code), 2: set2.map(c => c.code), 3: set3.map(c => c.code) },
    policyQuestions: Object.fromEntries(Object.entries(POLICY_CASES).map(([p, ids]) => [p, { title: POLICY_TITLE[p], cases: codes(ids) }])),
    cases: ordered.map(c => ({
      code: c.code, id: c.id, set: c.set, course: D.courses[c.course], type: c.type, category: c.item.category, ambiguous: !!c.item.ambiguous, origin: c.item.origin || null,
      source: c.item.source, target: c.item.target, provisional: { accept: c.item.accept, why: c.item.why, remap: remap.get(c.id) || null, levelGap: levelGap.get(c.id) || null },
      answers: c.answers.map(x => ({ arm: x.arm, run: x.run, verified: x.r.verified, label: x.r.label, againstProvisional: x.kind, sourceBloom: x.r.sourceBloom, targetBloom: x.r.targetBloom, remedy: x.r.remedy, draft: x.r.draft || null, sourceQuote: x.r.sourceQuote, targetQuote: x.r.targetQuote, explanation: x.r.explanation, ruleFlags: x.flags })),
      a1: c.a1 ? c.a1.map(x => ({ run: x.run, label: x.a?.label || null, draft: x.a?.draft || null })) : null,
      proposals: c.proposals.map(p => ({ code: p.code, kind: p.kind, text: p.text || null, from: p.from, ruleFlags: p.flags })),
      sharedClo: alsoIn(c), policy: policiesOf(c.id), note: NOTES[c.id] || null, observation: OBS[c.id] || null,
      faculty: { status: 'pending', judgments: [] },
    })),
  }, null, 1));

  // ---- README.md ----
  const workload = COURSE_ORDER.map(course => { const mine = ordered.filter(c => c.course === course); return `| ${courseLine(course)} | ${mine.length} | ${mine.reduce((s, c) => s + c.proposals.length, 0)} | 2 reviewers from ${{ calc: 'mathematics or engineering', ie: 'industrial engineering', prog: 'information technology', nurs: 'nursing', edu: 'education', acct: 'accountancy', hm: 'hospitality management' }[course]} |`; }).join('\n');
  put('README.md', `# Faculty adjudication package: align-1 development cases

**Status: a draft for the developer's review, not yet sent to faculty. No faculty judgment is recorded anywhere in it, and nothing in it is a faculty-approved answer.**

Built ${BUILT}, offline, from saved records. No AI provider was called. No checker code, prompt, dataset label, evaluation result or faculty dataset was changed.

## Why this package exists
Two evaluations of the AI Syllabus Checker, A2 and B2, compared the checker's verdicts with provisional verdicts that a developer wrote for the align-1 dataset. Faculty have never reviewed those provisional verdicts.
- On some cases the checker and the provisional verdicts disagree.
- On others, the checker's two configurations recommend different remedies.

Neither the checker nor the provisional verdicts can settle these cases. This package asks:
- qualified faculty to judge the cases themselves, without seeing anyone else's answer;
- the institution to settle the policy questions those judgments depend on.

The decisions can then be recorded as faculty-approved evaluation references.

## Who receives what
| Folder | For | Shows AI identities, AI verdicts or developer expectations? |
|---|---|---|
| \`faculty/\` (the guide, the references and \`part-a/\`, which holds the forms and their response sheet) | Case reviewers | No |
| \`faculty/part-b/\` (the forms and their response sheet) | Case reviewers, only after they return Part A | No identities, verdicts or expectations, but it shows anonymised changes proposed by the checker |
| \`institution/\` | The policy panel and the approving offices | No |
| \`coordinator/\` | The review coordinator only | **Yes. Do not give these files to reviewers before they have returned Parts A and B** |

## The deliverables
| # | Deliverable | File |
|---|---|---|
| 1 | Faculty-review package | \`faculty/01-reviewer-guide.md\`, \`faculty/02-curriculum-references.md\`, \`faculty/part-a/\` (7 courses and \`part-a-responses.csv\`), \`faculty/part-b/\` (${COURSE_ORDER.filter(k => ordered.some(c => c.course === k && c.proposals.length)).length} courses and \`part-b-responses.csv\`) |
| 2 | Academic policy questions | \`institution/01-policy-questions.md\`, \`institution/policy-responses.csv\` |
| 3 | Complete unique-case disagreement inventory | \`coordinator/01-case-inventory.md\` |
| 4 | Recommendation-quality review | \`coordinator/02-recommendation-quality-review.md\` (developer review) and \`faculty/part-b/\` (the faculty's review items) |
| 5 | Proposed academic adjudication procedure | \`institution/03-adjudication-procedure.md\` |
| 6 | Institutional decisions needed | \`institution/02-institutional-decisions.md\` |
| 7 | Development steps after faculty validation | \`coordinator/04-post-validation-development-plan.md\` |
| – | The separate comparison document | \`coordinator/03-comparison-and-blinding-key.md\` (identities, case key, proposal key) |
| – | Machine-readable record | \`coordinator/cases.json\` |

## The cases
- **58 cases, each once.** The package covers the whole development split of align-1, by course. Each case is a different pair of texts; no two cases repeat a pair.
- **Every case has a Part A form**, so reviewers cannot tell which cases are in dispute. The coordinator's key puts each case in one of three sets:
  - **Set 1, ${counts[1]} cases:** at least one checker answer differs from the provisional verdict. This is the minimum to adjudicate.
  - **Set 2, ${counts[2]} cases:** the verdicts are within the provisional ones, but the answers vary, or a recommendation raises a question. The questions are re-mapping, level changes, duplication, value wording and replaced content.
  - **Set 3, ${counts[3]} cases:** no disagreement and no flagged recommendation. These complete the split and act as blinding controls.
- **If faculty time is short**, send Sets 1 and 2 and a sample of Set 3, and record which were sent.
- **Part B covers every case for which a change was proposed:** ${partBCases.length} cases (${partBCases.filter(c => c.set !== 3).length} of them in Sets 1 and 2), with ${nProposals} distinct proposals. Including the Set 3 proposals keeps Part B from revealing the sets.
- **The 42 held-out cases are not included** and were not read.
- **16 of the 58 are unchanged copies** of cases in the earlier eval-1.1 dataset. A decision on one applies to the other.

## Workload by course
| Course | Part A cases | Part B proposals | Reviewers |
|---|---|---|---|
${workload}

As a rough guide, a Part A case takes three to five minutes and a Part B proposal one to two.

## Do not send with this package
- **The two older review sheets**, \`docs/ai-eval-faculty-review-alignment.csv\` and \`docs/ai-eval-faculty-review.csv\`. They are not blinded: they show the developer's expected verdicts. The first covers all 100 align-1 cases, including these 58 and the protected held-out cases. The second covers the eval-1.1 cases, 16 of which are copied here. This package replaces both for adjudicating these cases.
- **The evaluation reports** (\`docs/anthropic-p2-*.md\`) and anything in \`docs/ai-eval-anthropic/\`.
- **The other review packs cover different material.** \`docs/faculty-review/faculty-review.*\`, \`docs/faculty-review/phase3/\` and \`docs/academic-validation-package/\` cover real sample syllabi and whole-syllabus and stage checks. They do not overlap with these cases.

## Sources
sha256, first 16 characters:

| Source | sha256 |
|---|---|
${Object.entries(SRC).map(([k, f]) => `| \`${rel(f).startsWith('..') ? `scratch: ${path.basename(f)}` : rel(f)}\` | \`${short(sha(f))}\` |`).join('\n')}

Every text, verdict, explanation and draft was copied by script from these sources. The script checked that the A2 and B2 records still match the hashes they record, and that the dataset matches the hash pre-registered before B2.

${rel(SRC.prereg).startsWith('..')
    ? '`p2b2-preregistered.json` holds the developer notes fixed before B2 ran. It is kept with the developer\'s session files, not in the repository. Its hash is recorded in `docs/anthropic-p2-b2-report.md`. Both the generator script and this file can be added to the repository if the package must be rebuilt from it.'
    : `\`${rel(SRC.prereg)}\` holds the developer notes fixed before B2 ran. Its hash is recorded in \`docs/anthropic-p2-b2-report.md\`. The package is rebuilt with \`node scripts/export-align1-adjudication.cjs\`.`}

## Limits
- **The course records are test cases.** Their codes and titles match the institution's programs, but their descriptions were written for testing.
- **The program outcomes in the cases are general test wording**, not the official outcomes. The official outcomes the system holds are reproduced in \`faculty/02-curriculum-references.md\` for context.
- **The EGAs are known only by name.** The system holds the institution's four official names and no description of them.
- **The core-value definitions are unconfirmed.** They were copied from the university website and are pending institutional approval.
- **Four programs have nothing on record.** The system holds no outcomes, curriculum or syllabus for nursing, education, accountancy or hospitality.
- **58 cases is a small sample.**
`);

  // ---- write: only inside the package, only files this script made ----
  const manifestFile = path.join(PKG, 'package-manifest.json');
  const listAll = dir => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? listAll(path.join(dir, e.name)) : [path.join(dir, e.name)])) : []);
  const existing = listAll(PKG).map(f => path.relative(PKG, f).split(path.sep).join('/'));
  if (existing.length) {
    if (!fs.existsSync(manifestFile)) { console.log(`REFUSED: ${rel(PKG)} exists without this script's manifest`); process.exit(2); }
    const recorded = new Map(JSON.parse(fs.readFileSync(manifestFile, 'utf8')).files.map(f => [f.path, f.sha256]));
    const foreign = existing.filter(f => f !== 'package-manifest.json' && !recorded.has(f));
    if (foreign.length) { console.log(`REFUSED: files not made by this script: ${foreign.join(', ')}`); process.exit(2); }
    const changed = existing.filter(f => recorded.has(f) && sha(path.join(PKG, f)) !== recorded.get(f));
    if (changed.length) { console.log(`REFUSED: changed since this script wrote them (a filled-in response sheet?): ${changed.join(', ')}`); process.exit(2); }
  }
  const stale = existing.filter(f => f !== 'package-manifest.json' && !out.has(f));
  for (const [file, text] of out) { const full = path.join(PKG, file); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, text); }
  for (const f of stale) fs.unlinkSync(path.join(PKG, f));
  fs.writeFileSync(manifestFile, JSON.stringify({ builtAt: BUILT, by: `${rel(__filename)} (offline)`, salt: SALT, sources: Object.fromEntries(Object.entries(SRC).map(([k, f]) => [k, sha(f)])), files: [...out.keys()].sort().map(f => ({ path: f, sha256: sha(path.join(PKG, f)), bytes: fs.statSync(path.join(PKG, f)).size })) }, null, 1));

  // ---- report ----
  console.log(`integrity ${JSON.stringify(integrity)}`);
  console.log(`sets: 1 ${counts[1]} (${set1.map(c => c.id).join(', ')})`);
  console.log(`      2 ${counts[2]} (${set2.map(c => c.id).join(', ')})`);
  console.log(`      3 ${counts[3]} (${set3.map(c => c.id).join(', ')})`);
  console.log(`false rejections A2 ${frCount('A2')} B2 ${frCount('B2')}; false approvals A2 ${cases.reduce((s, c) => s + c.answers.filter(x => x.arm === 'A2' && x.kind === 'false approval').length, 0)} B2 ${cases.reduce((s, c) => s + c.answers.filter(x => x.arm === 'B2' && x.kind === 'false approval').length, 0)}`);
  console.log(`stats ${JSON.stringify(stat)}`);
  console.log(`escalation groups A2 ${JSON.stringify(Object.fromEntries(Object.entries(escA).map(([g, v]) => [g.slice(0, 24), v.length])))} B2 ${JSON.stringify(Object.fromEntries(Object.entries(escB).map(([g, v]) => [g.slice(0, 24), v.length])))}`);
  console.log(`Part B: ${partBCases.length} cases, ${nProposals} proposals (${partBCases.reduce((s, c) => s + c.proposals.filter(p => p.kind === 'remap').length, 0)} re-mappings)`);
  console.log(`unauthored Set 1 notes: ${set1.filter(c => !NOTES[c.id]).map(c => c.id).join(', ') || 'none'}; Set 2 with authored notes: ${set2.filter(c => NOTES[c.id]).map(c => c.id).join(', ')}`);
  console.log(`files: ${[...out.keys()].length}; stale removed ${stale.length}`);
  for (const [file] of [...out].sort()) console.log(`  ${file} ${fs.statSync(path.join(PKG, file)).size} bytes`);
}
main().catch(error => { console.error(error); process.exit(1); });
