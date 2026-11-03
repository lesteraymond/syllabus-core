'use strict';
// The CLO classification an ILO-CLO evaluation uses, and what an ILO-CLO relationship carries when an evaluation asks for it.
// LCUP requires four classifications fixed by CLO number: CLO1 Introductory (Foundational Knowledge), CLO2 Enabling (Skill Development / Evaluate),
// CLO3 Demonstrating (Application / Create), and CLO4 Integration of Values (Ethics & Responsibility / Evaluate & Create). These accepted definitions
// are supplied in the versioned academic prompt; faculty continue to author their own CLO statements for their course and assigned outcomes.
// The classification comes from the CLO's number alone (its place in content.clos), never from the label saved with it: every saved CLO must carry one
// of the four labels, the PDF importer writes 'Introductory' for every CLO (src/lib/pdfImport.js) and the builder starts a new CLO as 'Enabling'
// (ClosStep.jsx). The saved label is compared with the required one and any difference reported (stored.status 'conflicts'); it is never trusted,
// sent as the classification, or changed. Where the classification comes from (the fixed mapping) is kept apart from whether the CLO statement suits it,
// which is an academic judgement for the evaluation and for faculty. A CLO numbered above 4 has no required classification (unavailable).
// Nothing here changes a CLO, its statement or its mapping, or approves/rejects an ILO from its week or verb alone.
// The classification is sent only to an evaluation that selects this versioned contract (gemini.js align options.cloClassification), either in an
// isolated evaluation or while the separately gated Policy V2 application integration is enabled. The normal production baseline never selects it.
const v2Activation = require('./academicV2Activation');
const { brief } = require('./planrows');
const { taggedRows } = require('./coverage');
const LEVELS = ['Introductory', 'Enabling', 'Demonstrating', 'Integration of Values']; // CLO 1..4
const VERSION = 'lcup-ilo-clo-classification-3'; // the contract; part of the fingerprint of every relationship that carries the context (gemini.js pairKey)
const SOURCE = 'lcup_fixed_mapping';
const MAX_LESSONS = 12, MAX_WEEK_TEXT = 1000, MAX_ILO_TEXT = 200, MAX_CLO_TEXT = 300;
const flat = text => String(text ?? '').replace(/\s+/g, ' ').trim();
const ID = /^row(\d+)-ilo\d+-clo:(.+)$/;

// The required classification of the CLO at index k, and how the label saved with it compares (matches, conflicts, missing).
function classificationOf(content, clo) {
  const k = (content?.clos || []).indexOf(clo);
  if (k < 0) return { status: 'unavailable', reason: 'clo_not_found' };
  const level = LEVELS[k] || null, saved = flat(clo.level);
  const stored = { level: saved || null, status: !saved ? 'missing' : level && saved.toLowerCase() === level.toLowerCase() ? 'matches' : 'conflicts' };
  return level ? { status: 'required', clo: `CLO ${k + 1}`, level, source: SOURCE, stored } : { status: 'unavailable', reason: 'no_fixed_classification', clo: `CLO ${k + 1}`, stored };
}
// Every CLO of the course with its required classification: what an evaluation reports about the saved labels, CLO by CLO.
const summaryOf = content => (content?.clos || []).map(clo => classificationOf(content, clo));

// What an ILO-CLO relationship carries under the contract: its CLO's number and classification, the ILO's week and that week's course content, every
// lesson mapped to the same CLO in plan order (this one marked; past MAX_LESSONS the first ones and this one), and the course's CLOs with their
// classifications, so another existing CLO can be named. null when the CLO has no required classification.
function lessonContextOf(content, rowIndex, clo) {
  const found = classificationOf(content, clo), row = (content.plan || [])[rowIndex];
  if (found.status !== 'required' || !row) return null;
  const tag = `clo:${clo.id}`;
  const lessons = taggedRows(content, clo).map(({ row: lesson, i }) => ({ week: String(lesson.week ?? ''),
    ilo: (lesson.ilos || []).filter(ilo => flat(ilo.text) && (ilo.tags || []).includes(tag)).map(ilo => brief(ilo.text, MAX_ILO_TEXT)).join(' / '), ...(i === rowIndex ? { thisLesson: true } : {}) }));
  const shown = lessons.length <= MAX_LESSONS ? lessons : lessons.filter((lesson, n) => n < MAX_LESSONS - 1 || lesson.thisLesson);
  const courseClos = (content.clos || []).map((c, k) => ({ clo: `CLO ${k + 1}`, classification: LEVELS[k] || null, statement: brief(c?.statement, MAX_CLO_TEXT) }));
  return { clo: found.clo, classification: found.level, week: String(row.week ?? ''), weekContent: brief(row.contents, MAX_WEEK_TEXT), cloLessons: shown,
    ...(shown.length < lessons.length ? { cloLessonsNotListed: lessons.length - shown.length } : {}), courseClos };
}

// The syllabus as an evaluation under the contract reads it: every CLO's level is its required classification ('' past CLO 4, where there is none).
// A copy for building request text only; the syllabus itself, its statements and mappings are never changed.
const viewOf = content => ({ ...content, clos: (content?.clos || []).map((clo, k) => ({ ...clo, level: LEVELS[k] || '' })) });
// The relationships whose request text states a CLO level: the Stage B4 coverage question and the Policy V2 classification question.
const LEVEL_TYPES = new Set(['CLO-coverage', 'CLO-classification']);
function rebuilt(pairs, content, masters) {
  const view = viewOf(content), out = new Map(), wanted = new Set(pairs.filter(p => LEVEL_TYPES.has(p.type)).map(p => p.type));
  if (wanted.has('CLO-coverage')) require('./coverage').coveragePairs(view, (id, type, source, target, path, targetPath) => out.set(id, { id, type, source: String(source || ''), target: String(target || ''), path, targetPath }));
  if (wanted.has('CLO-classification')) for (const p of require('./academicV2Plan').plan(view, masters).pairs) if (p.type === 'CLO-classification') out.set(p.id, p);
  return out;
}

// The relationships of one request. With the contract every ILO-CLO relationship whose CLO has a required classification gets a fresh context, and a
// relationship whose text states a CLO level is rebuilt with the required classification (classificationSource), so no saved placeholder reaches the
// request beside it. Without the contract none carries either, whatever a caller passed, so only the contract can change a request.
function prepare(pairs, content, contract, masters) {
  const again = contract && pairs.some(p => LEVEL_TYPES.has(p.type)) ? rebuilt(pairs, content, masters) : null;
  return pairs.map(pair => {
    const { classificationContext, classificationSource, ...plain } = pair;
    if (again && LEVEL_TYPES.has(pair.type)) { const fresh = again.get(pair.id); if (fresh) return { ...fresh, classificationSource: SOURCE }; }
    const match = contract && pair.type === 'ILO-CLO' ? ID.exec(String(pair.id ?? '')) : null;
    const clo = match ? (content?.clos || []).find(c => c?.id === match[2]) : null;
    const context = clo ? lessonContextOf(content, Number(match[1]), clo) : null;
    return context ? { ...plain, classificationContext: context } : classificationContext === undefined && classificationSource === undefined ? pair : plain;
  });
}
// The contract an align call selected, or null. Only the exact version and an isolated evaluation or enabled Policy V2 call may select it.
function contractOf(options = {}) {
  if (options.cloClassification === undefined) return null;
  const evaluation = options.evaluationOnly === true && !!options.env;
  if (options.cloClassification !== VERSION || (!evaluation && !v2Activation.integrated(options, options.env || process.env))) throw Object.assign(Error('Unknown or non-evaluation CLO classification contract'), { status: 400 });
  return VERSION;
}

// What an ILO-CLO judgement records (gemini.js align adds it to every one, fresh or reused). status: evaluated (the classification was part of the
// question), not_evaluated (statement only: the contract was not selected) or unavailable (no CLO mapped or found, or no required classification).
// When evaluated, CLO numbers the explanation names besides its own are listed: otherClos exist in the course, unknownClos do not (an unsupported
// reference for review). The label is never changed here.
function markOf(pair, content, judgement, contract) {
  const match = ID.exec(String(pair.id ?? ''));
  if (!match) return { status: 'unavailable', reason: 'clo_not_mapped', basis: 'statement_only' };
  const clos = content?.clos || [], clo = clos.find(c => c?.id === match[2]);
  if (!clo) return { status: 'unavailable', reason: 'clo_not_found', basis: 'statement_only' };
  const found = classificationOf(content, clo);
  if (found.status !== 'required') return { ...found, basis: 'statement_only' };
  const base = { clo: found.clo, classification: found.level, source: found.source, stored: found.stored };
  if (!pair.classificationContext) return { status: 'not_evaluated', reason: contract ? 'not_sent' : 'contract_not_selected', ...base, basis: 'statement_only' };
  const named = [...new Set([...String(judgement?.explanation ?? '').matchAll(/\bCLO\s*(\d+)\b/gi)].map(m => Number(m[1])))].filter(n => `CLO ${n}` !== found.clo);
  const otherClos = named.filter(n => n >= 1 && n <= clos.length).map(n => `CLO ${n}`), unknownClos = named.filter(n => n < 1 || n > clos.length).map(n => `CLO ${n}`);
  return { status: 'evaluated', contract: VERSION, ...base, basis: 'statement_and_classification', ...(otherClos.length ? { otherClos } : {}), ...(unknownClos.length ? { unknownClos } : {}) };
}
function mark(judgements, pairs, content, contract = null) {
  const iloClo = new Map(pairs.filter(pair => pair.type === 'ILO-CLO').map(pair => [pair.id, pair]));
  return iloClo.size ? judgements.map(j => (iloClo.has(j.id) ? { ...j, cloClassification: markOf(iloClo.get(j.id), content, j, contract) } : j)) : judgements;
}
module.exports = { LEVELS, VERSION, SOURCE, MAX_LESSONS, classificationOf, summaryOf, lessonContextOf, viewOf, prepare, contractOf, markOf, mark };
