// Conservative PDF-to-builder mapping. No provider, scoring, or persistence here.
// Text that cannot be mapped safely remains in the review preview with a warning.
import { importIdentity, outcomeReferences, iloChunks, prerequisiteReview } from './pdfImportReview.js';
export const PDF_FIELDS = ['code', 'title', 'description', 'prereq', 'credits', 'clos', 'plan', 'reqs', 'refs', 'grading'];
export const PDF_OUTCOME_FIELDS = ['vision', 'mission', 'egas', 'pos'];
// Words inside a title may be separated by any run of spaces or a tab (text layers and OCR both produce these).
const headings = [
  ['I', 'COURSE CODE'], ['II', 'COURSE TITLE'], ['III', 'COURSE DESCRIPTION'],
  ['IV', 'PRE\\s*[-–—]?\\s*REQUISITES?(?:\\s*\\(\\s*S\\s*\\))?'], ['V', 'CREDIT UNITS?'], ['VI', 'COURSE LEARNING OUTCOMES'],
  ['VII', 'LEARNING PLAN'], ['VIII', 'COURSE REQUIREMENTS'], ['IX', '(?:SUGGESTED )?REFERENCES'], ['X', 'GRADING SYSTEM'],
].map(([roman, title]) => [roman, title.replaceAll(' ', '[^\\S\\n]+')]);
// The sign-off block (Prepared / Checked / Approved by ...) and the form's change checklist follow the last section; they are not syllabus content.
const SIGN_OFF = /^[^\S\n]*(?:Prepared|Checked(?: and Reviewed)?|Reviewed|Approved|Noted)\s+by\s*:/im;
// A line holding only a page number ("3", "Page 3 of 12") inside a section.
const PAGE_NUMBER = /^[^\S\n]*(?:page[^\S\n]+)?\d{1,3}(?:[^\S\n]+of[^\S\n]+\d{1,3})?[^\S\n]*(?:\n|$)/gim;
export function splitPdfSections(text) {
  const fields = Object.fromEntries(PDF_FIELDS.map(k => [k, '']));
  const found = [];
  // OCR commonly reads roman I as lowercase l, 1 or |. Tolerate that only
  // immediately before a known full section title, never in authored content.
  // After the numeral: a dot or bracket with optional space ("V.CREDIT UNITS"), or at least one space.
  const pattern = ([roman, title]) => `${roman.replaceAll('I', '[Il1|]')}(?:\\s*[.)]\\s*|\\s+)${title}`;
  // Some text layers put a stray numeral fragment before a heading ("I. V.\tCREDIT UNITS"): skip one such fragment.
  const matches = [...String(text).matchAll(new RegExp(`^\\s*(?:[Il1|]\\s*[.)]\\s+)?(${headings.map(pattern).join('|')})\\s*[:：]?[^\\S\\n]*`, 'gim'))];
  for (let i = 0; i < matches.length; i++) {
    const index = headings.findIndex(heading => new RegExp(`^${pattern(heading)}$`, 'i').test(matches[i][1].trim()));
    if (index < 0) continue;
    const key = PDF_FIELDS[index];
    if (found.includes(key)) continue; // repeated page headers do not replace a section
    let body = text.slice(matches[i].index + matches[i][0].length, matches[i + 1]?.index ?? text.length);
    if (!matches[i + 1]) { const end = body.search(SIGN_OFF); if (end >= 0) body = body.slice(0, end); }
    if (['reqs', 'refs', 'grading'].includes(key)) body = body.replace(PAGE_NUMBER, '').replace(/\n{3,}/g, '\n\n');
    fields[key] = body.trim();
    found.push(key);
  }
  return { fields, found };
}
const lines = text => String(text || '').split('\n').map(s => s.trim()).filter(Boolean);
const clean = text => String(text || '').replace(/^[-•]\s*/, '').trim();
const numbered = text => lines(text).filter(s => !/^(?:CLO|ILO|WEEK|SCHEDULE|COMPONENT|PERCENTAGE)\s*(?:\||\t|$)/i.test(s));
const labelled = (text, label) => [...String(text || '').matchAll(new RegExp(`\\b${label}\\s*(\\d+)\\s*[.:]\\s*([\\s\\S]*?)(?=\\b${label}\\s*\\d+\\s*[.:]|$)`, 'gi'))].map(match => ({ no: Number(match[1]), text: match[2].replace(/\s+/g, ' ').trim() }));
// Supports both sequential ("PO1. ...", "PO 2: ...") and EGA-hierarchical ("PO 1: 1. ...", "PO 1.3. ...", "PO 2.2 ...") PO lists.
function parsePoEntries(text) {
  const raw = String(text || '');
  const hierarchical = [...raw.matchAll(/\bPO\s*\d+\s*[.:]\s*\d+\s*[.:]?\s*([\s\S]*?)(?=\bPO\s*\d+\s*[.:]\s*\d+|$)/gi)];
  if (hierarchical.length >= 2) {
    return hierarchical.map((match, idx) => ({ no: idx + 1, text: match[1].replace(/\s+/g, ' ').trim() }));
  }
  return labelled(raw, 'PO');
}
// A line that opens a new citation: "Proakis, J.", a surname of several words with a year later on the line
// ("Dela Cruz, J. (2021)", "Gomes de Sousa, D., ... (2025)"), or an organisation author ("World Health Organization. (2019)").
const SURNAME = "[A-Z][\\p{L}'’-]+";
const YEAR = '\\(\\s*(?:\\d{4}[a-z]?|n\\.\\s?d\\.)\\s*\\)';
const CITATION_START = [
  new RegExp(`^${SURNAME},\\s*[A-Z]`, 'u'),
  new RegExp(`^${SURNAME}(?:\\s+(?:[a-z]{1,3}\\s+)*${SURNAME}){1,2},\\s*[A-Z](?=.*${YEAR})`, 'u'),
  new RegExp(`^[A-Z][\\p{L}&'’ -]{2,80}?\\.?\\s*${YEAR}`, 'u'),
];
function referenceGroups(text, item) {
  const groups = Object.fromEntries(['books', 'program', 'online', 'electronics'].map(key => [key, { na: false, items: [] }]));
  let group = null, buffer = '';
  const flush = () => {
    if (buffer) groups[group || (/https?:\/\//i.test(buffer) ? 'online' : 'books')].items.push(item(buffer));
    buffer = '';
  };
  for (const line of lines(text)) {
    const heading = line.match(/^(?:[A-Z][.)]\s*)?(BOOKS|INTERNET PROGRAMMING|INTERNET REFERENCES|JOURNALS|ELECTRONICS)\s*:?\s*$/i);
    if (heading) { flush(); const name = heading[1].toUpperCase(); group = name === 'BOOKS' ? 'books' : name === 'INTERNET PROGRAMMING' ? 'program' : name === 'ELECTRONICS' ? 'electronics' : 'online'; continue; }
    if (/^(?:N\/?A|NOT APPLICABLE)\.?$/i.test(line) && group) { flush(); groups[group].na = true; continue; }
    const startsCitation = CITATION_START.some(rule => rule.test(line)) || /^\d+[.)]\s/.test(line) || /Accessed.*\b\d{4}\.?$/i.test(buffer);
    if (buffer && (startsCitation || group === 'electronics')) flush();
    buffer += (buffer ? ' ' : '') + line;
  }
  flush(); return groups;
}
// V. Credit Units -> { lecture, lab, explicit }. Reads "3", "3 units", "2 Lec 1 Lab", "1 Unit Laboratory 3 Units Lecture",
// "Lecture: 2, Laboratory: 1", "3 (2 lec / 1 lab)". explicit: both parts were stated, so no review warning is needed.
// A bare total is lecture units with 0 laboratory units (rule T-06 needs both numbers), flagged for review.
export function parseCreditUnits(source) {
  const text = String(source ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const num = '(\\d+(?:\\.\\d+)?)';
  const pick = (word) => {
    const after = text.match(new RegExp(`${num}\\s*(?:units?\\s*(?:of\\s*)?)?(?:${word})`, 'i'));
    if (after) return after[1];
    const before = text.match(new RegExp(`(?:${word})\\.?\\s*(?:units?)?\\s*[:=-]?\\s*${num}`, 'i'));
    return before ? before[1] : null;
  };
  const lecture = pick('lec(?:ture)?s?\\b'), lab = pick('lab(?:oratory)?s?\\b');
  if (lecture !== null || lab !== null) return { lecture: lecture ?? '0', lab: lab ?? '0', explicit: lecture !== null && lab !== null };
  const total = text.match(new RegExp(`^${num}\\s*(?:units?)?\\.?$`, 'i'));
  return total ? { lecture: total[1], lab: '0', explicit: false } : null;
}
// Pairs the PDF's PO (or EGA) list with the program's by wording, one to one. -> Map(pdfNo -> programNo).
// Without a PDF list the PDF is taken to use the program's own numbering (the template prints the program's list).
const OUTCOME_STOP = new Set(['the', 'and', 'for', 'with', 'using', 'that', 'into', 'from', 'both', 'other', 'their', 'need', 'needed', 'appropriate', 'ega']);
const outcomeWords = s => new Set(String(s || '').toLowerCase().replace(/\(\s*ega[^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').split(' ')
  .filter(w => w.length > 2 && !OUTCOME_STOP.has(w)).map(w => w.replace(/(?:ing|ed|es|s)$/, '')));
export function matchOutcomes(pdfList, programList, textOf) {
  const map = new Map();
  if (!pdfList.length) { for (const p of programList) map.set(p.no, p.no); return map; }
  const pairs = [];
  for (const a of pdfList) {
    const A = outcomeWords(textOf(a));
    for (const b of programList) {
      const B = outcomeWords(textOf(b));
      let shared = 0; for (const w of A) if (B.has(w)) shared++;
      const score = A.size && B.size ? (2 * shared) / (A.size + B.size) : 0;
      if (score >= 0.5) pairs.push({ a: a.no, b: b.no, score });
    }
  }
  const usedB = new Set();
  for (const p of pairs.sort((x, y) => y.score - x.score)) if (!map.has(p.a) && !usedB.has(p.b)) { map.set(p.a, p.b); usedB.add(p.b); }
  return map;
}
export function mapPdfFields(fields, draft, makeId, { planRows = null, identityContext = null, requireIdentity = false, prerequisiteChoice = null } = {}) {
  const warnings = [];
  const unresolvedMappings = [];
  const missing = PDF_FIELDS.filter(key => !String(fields[key] || '').trim());
  if (missing.length) warnings.push({ key: 'pdfImport.missing', values: { fields: missing.map(key => PDF_FIELDS.indexOf(key) + 1).join(', ') } });
  const id = () => makeId();
  const item = t => ({ id: id(), t: clean(t) });
  const next = structuredClone(draft);
  const outcomes = next.outcomes || { vision: '', mission: { lead: '', items: [] }, egas: [], pos: [] };
  const pdfEgas = fields.egas?.trim() ? labelled(fields.egas, 'EGA').map(entry => ({ no: entry.no, name: entry.text, short: entry.text.slice(0, 120) })) : [];
  const pdfPos = fields.pos?.trim() ? parsePoEntries(fields.pos).map(entry => ({ no: entry.no, text: entry.text, short: `PO ${entry.no}`, egas: [] })) : [];
  // Vision, Mission, EGA and PO are the program's administrator references (they are locked in the builder and the submit
  // rules T-09..T-12 compare them with the catalog). When the subject has them, the PDF never replaces them: the PDF's own
  // PO/EGA numbers are translated to the program's numbers by matching their text, so a CLO keeps its meaning.
  const masters = !!draft.meta?.courseId && (outcomes.pos || []).length > 0 && (outcomes.egas || []).length > 0;
  const translate = { PO: null, EGA: null };
  if (masters) {
    translate.PO = { map: matchOutcomes(pdfPos, outcomes.pos, p => p.text), known: new Set((pdfPos.length ? pdfPos : outcomes.pos).map(p => p.no)) };
    translate.EGA = { map: matchOutcomes(pdfEgas, outcomes.egas, e => e.name), known: new Set((pdfEgas.length ? pdfEgas : outcomes.egas).map(e => e.no)) };
    if ([fields.vision, fields.mission, fields.egas, fields.pos].some(v => String(v || '').trim())) warnings.push({ key: 'pdfImport.mastersKept', values: {} });
  } else {
    if (fields.vision?.trim()) outcomes.vision = fields.vision.trim();
    if (fields.mission?.trim()) {
      const parts = fields.mission.split(/\n\s*[•●▪-]\s*/).map(s => s.trim()).filter(Boolean);
      outcomes.mission = { lead: parts[0] || '', items: parts.slice(1) };
    }
    if (pdfEgas.length) outcomes.egas = pdfEgas;
    if (pdfPos.length) outcomes.pos = pdfPos;
  }
  next.outcomes = outcomes;
  // Course identity remains controlled by the selected subject and its normal save API.
  const normalize = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const identity = importIdentity(fields, draft.meta, identityContext, requireIdentity);
  if (!fields.program && identityContext) warnings.push({ key: 'pdfImport.programReview', values: { program: draft.meta.program } });
  const mismatch = !identity.ok;
  if (mismatch) warnings.push({ key: 'pdfImport.identityMismatch', values: { code: fields.code?.trim() || '', selected: draft.meta.code } });
  if (fields.title?.trim() && normalize(fields.title) !== normalize(draft.meta.title)) warnings.push({ key: 'pdfImport.titleMismatch', values: {} });
  const prerequisite = prerequisiteReview(fields, draft.meta, prerequisiteChoice);
  // IV. Pre-requisite is the one section an upload may leave empty. An empty one is imported as "None" (the checker no longer requires a value).
  next.meta.prereq = String(prerequisite.value ?? '').trim() ? prerequisite.value : 'None';
  if (next.meta.prereq === 'None' && !String(prerequisite.value ?? '').trim()) warnings.push({ key: 'pdfImport.prereqNone', values: {} });
  if (prerequisite.conflict) warnings.push({ key: 'pdfImport.prereqConflict', values: {} });
  const units = parseCreditUnits(fields.credits);
  if (units) { next.meta.lecture = units.lecture; next.meta.lab = units.lab; }
  if (fields.credits?.trim() && !units?.explicit) warnings.push({ key: 'pdfImport.creditsReview', values: {} });
  // Only labelled source columns replace institutional/program text. Unrecovered
  // columns retain the current form values and are explicitly flagged for review.
  next.description = [item((fields.description || '').replace(/\s*\n\s*/g, ' '))];
  // Join wrapped CLO paragraphs only when explicit CLO labels delimit them.
  // Otherwise one nonempty line is one authored CLO in the preview.
  const cloSource = /\bCLO\s*\d+[.:]/i.test(fields.clos || '')
    ? [...String(fields.clos).matchAll(/\bCLO\s*\d+[.:]\s*([\s\S]*?)(?=\bCLO\s*\d+[.:]|$)/gi)].map(m => m[0].replace(/\s*\n\s*/g, ' '))
    : numbered(fields.clos);
  const sourceCloNumbers = [];
  const clos = cloSource.map((line, i) => {
    const sourceNo = Number(line.match(/^\s*CLO\s*(\d+)/i)?.[1] || i + 1);
    const cells = line.split(/\t|\|/).map(s => s.trim()).filter(Boolean);
    const selected = (label, available) => {
      const refs = outcomeReferences(line, label);
      if (translate[label]) {
        const { map, known } = translate[label];
        // The PDF's numbers are its own; keep only those whose outcome matched one of the program's, under the program's number.
        // A number the PDF's own list (or, without one, the program's list) does not have is a source error, not a wording
        // difference: it stays unresolved so Apply waits for the person to correct it.
        const kept = [], dropped = [], unknown = [];
        for (const n of refs.values) (map.has(n) ? kept.push(map.get(n)) : known.has(n) ? dropped.push(n) : unknown.push(n));
        if (dropped.length) warnings.push({ key: 'pdfImport.outcomeNotMatched', values: { clo: sourceNo, label, numbers: dropped.join(', ') } });
        if (unknown.length || refs.invalid.length) unresolvedMappings.push({ clo: sourceNo, label, unknown, invalid: refs.invalid, source: line });
        return [...new Set(kept)].sort((a, b) => a - b);
      }
      const unknown = refs.values.filter(n => !available.some(p => p.no === n));
      if (unknown.length || refs.invalid.length) unresolvedMappings.push({ clo: sourceNo, label, unknown, invalid: refs.invalid, source: line });
      return refs.values.filter(n => available.some(p => p.no === n));
    };
    const statement = (cells.length > 1 && /^(?:CLO\s*)?\d+[.)]?$/i.test(cells[0]) ? cells[1] : line)
      .replace(/^(?:CLO\s*)?\d+[.):\s]+/i, '').replace(/\s*[[(]?\s*\b(?:POs?|EGAs?)\s*[:=]?\s*\d.*$/i, '').trim();
    if (statement) sourceCloNumbers.push(sourceNo);
    return { id: id(), title: `CLO ${sourceNo}`, level: 'Introductory', statement,
      pos: selected('PO', outcomes.pos), egas: selected('EGA', outcomes.egas) };
  }).filter(c => c.statement);
  if (clos.length > 20) throw new Error('pdfImport.tooManyClos');
  if (new Set(sourceCloNumbers).size !== sourceCloNumbers.length) throw new Error('pdfImport.duplicateClos');
  // Rule P-03: a CLO tagged with a PO also carries every EGA that PO serves in the program's list. With program references
  // the import applies it, so the imported CLOs follow the same rule the builder and the checker apply.
  if (masters) {
    let added = 0;
    for (const clo of clos) {
      const implied = new Set(clo.pos.flatMap(no => (outcomes.pos.find(p => p.no === no)?.egas || [])));
      for (const e of implied) if (!clo.egas.includes(e) && outcomes.egas.some(x => x.no === e)) { clo.egas.push(e); added++; }
      clo.egas.sort((a, b) => a - b);
    }
    if (added) warnings.push({ key: 'pdfImport.egasImplied', values: { count: added } });
  }
  // Replace CLOs together with the plan; never retain old mappings to replaced IDs.
  next.clos = clos;
  warnings.push({ key: 'pdfImport.outcomesReview', values: {} });
  const plan = [];
  let ambiguous = false;
  const inputs = planRows || lines(fields.plan).flatMap(line => {
    const cells = line.split(/\t|\|/).map(s => s.trim());
    if (!/^(?:weeks?\s*)?\d+(?:\s*[-–,]\s*\d+)*$/i.test(cells[0]) || cells.length !== 6) { ambiguous = true; return []; }
    const [week, ilo, contents, activities, tasks, values] = cells;
    return [{ week, ilo, contents, activities, tasks, values }];
  });
  for (const row of inputs) {
    const { week, ilo, contents, activities, tasks, values } = row;
    const kind = row.kind || (/EXAMINATION|\bEXAM\b/i.test(contents) ? 'exam' : 'lesson');
    const chunks = kind === 'exam' ? [{ text: ilo || '', ambiguous: false }] : iloChunks(ilo);
    const ilos = chunks.map(({ text, ambiguous }, index) => {
      const refs = outcomeReferences(text, 'CLO'), targets = refs.values;
      const unknown = targets.filter(n => !sourceCloNumbers.includes(n));
      if (unknown.length || refs.invalid.length) unresolvedMappings.push({ week, label: 'CLO', unknown, invalid: refs.invalid, source: text });
      const tags = targets.map(no => clos[sourceCloNumbers.indexOf(no)]).filter(Boolean).map(c => `clo:${c.id}`);
      if (kind !== 'exam' && (ambiguous || !tags.length)) warnings.push({ key: 'pdfImport.iloMappingReview', values: { week, outcome: index + 1 } });
      // Remove only explicit CLO annotations; source wording is otherwise intact.
      const statement = text.replace(/[[(]\s*CLO\s*\d[^\])]*[)\]]/gi, '').replace(/\bCLO\s*\d+(?:\s*[-–—,;.]\s*\d+)*/gi, '').trim();
      return { id: id(), text: statement, tags: [...new Set(tags)] };
    });
    plan.push({ id: id(), week: week.replace(/^weeks?\s*/i, ''), kind,
      ilos: ilos.length ? ilos : [{ id: id(), text: '', tags: [] }], contents, activities, tasks, values });
  }
  next.plan = plan.length ? plan : [{ id: id(), week: '', kind: 'lesson', ilos: [{ id: id(), text: '', tags: [] }], contents: '', activities: '', tasks: '', values: '' }];
  if (ambiguous || !plan.length) warnings.push({ key: 'pdfImport.planReview', values: {} });
  const requirements = [];
  const numberedRequirements = /^\s*(?:\d+[.)]|[•●▪])\s/m.test(fields.reqs || '');
  for (const line of lines(fields.reqs)) {
    if (numberedRequirements && requirements.length && !/^(?:\d+[.)]|[•●▪])\s/.test(line)) requirements[requirements.length - 1] += ' ' + line;
    else requirements.push(line);
  }
  next.reqs = requirements.map(item);
  next.refs = referenceGroups(fields.refs, item);
  warnings.push({ key: 'pdfImport.referencesReview', values: {} });
  const grading = [];
  for (const line of lines(fields.grading)) {
    // TOTAL and the passing mark ("Passing Grade: 50%") are not graded components.
    if (/^\s*(?:\d+[.)]\s*)?(?:TOTAL|PASSING\s+(?:GRADE|RATE|SCORE|MARK|PERCENTAGE))\b/i.test(line)) continue;
    const m = line.match(/^(.+?)\s*(?:\||\t|:|[-–])?\s*(\d+(?:\.\d+)?)\s*%\s*$/);
    if (m) grading.push({ id: id(), label: m[1].replace(/^\d+[.)]\s*/, '').replace(/[|:\t\s-]+$/, '').trim(), abbr: '', pct: m[2] });
  }
  next.grading = { rows: grading, override: { on: false, term: '', final: '' } };
  if (!grading.length || grading.reduce((sum, row) => sum + Number(row.pct), 0) !== 100) warnings.push({ key: 'pdfImport.gradingReview', values: {} });
  if (unresolvedMappings.length) warnings.push({ key: 'pdfImport.unresolvedMappings', values: {} });
  return { content: next, warnings, mismatch, identity, prerequisiteConflict: prerequisite.conflict, unresolvedMappings, counts: { clos: clos.length, plan: plan.length, references: Object.values(next.refs).reduce((sum, group) => sum + group.items.length, 0), grading: grading.length } };
}

// Preview and application share parsing; Apply additionally enforces decisions.
export function preparePdfImport(fields, draft, makeId, options = {}) {
  const mapped = mapPdfFields(fields, draft, makeId, { ...options, requireIdentity: true });
  if (mapped.mismatch) throw new Error('pdfImport.selectMatchingSubject');
  if (mapped.prerequisiteConflict && !mapped.prerequisiteConflict.decision) throw new Error('pdfImport.prereqReviewRequired');
  if (mapped.unresolvedMappings.length) throw new Error('pdfImport.unresolvedMappings');
  return mapped;
}
