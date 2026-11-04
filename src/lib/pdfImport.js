// Conservative PDF-to-builder mapping. No provider, scoring, or persistence here.
// Text that cannot be mapped safely remains in the review preview with a warning.
import { importIdentity, outcomeReferences, iloChunks, prerequisiteReview } from './pdfImportReview.js';
export const PDF_FIELDS = ['code', 'title', 'description', 'prereq', 'credits', 'clos', 'plan', 'reqs', 'refs', 'grading'];
export const PDF_OUTCOME_FIELDS = ['vision', 'mission', 'egas', 'pos'];
const headings = [
  ['I', 'COURSE CODE'], ['II', 'COURSE TITLE'], ['III', 'COURSE DESCRIPTION'],
  ['IV', 'PRE\\s*[-–—]?\\s*REQUISITES?'], ['V', 'CREDIT UNITS'], ['VI', 'COURSE LEARNING OUTCOMES'],
  ['VII', 'LEARNING PLAN'], ['VIII', 'COURSE REQUIREMENTS'], ['IX', 'REFERENCES'], ['X', 'GRADING SYSTEM'],
];
export function splitPdfSections(text) {
  const fields = Object.fromEntries(PDF_FIELDS.map(k => [k, '']));
  const found = [];
  // OCR commonly reads roman I as lowercase l, 1 or |. Tolerate that only
  // immediately before a known full section title, never in authored content.
  const pattern = ([roman, title]) => `${roman.replaceAll('I', '[Il1|]')}\\s*[.)]?\\s+${title}`;
  const matches = [...String(text).matchAll(new RegExp(`^\\s*(${headings.map(pattern).join('|')})\\s*[:：]?[^\\S\\n]*`, 'gim'))];
  for (let i = 0; i < matches.length; i++) {
    const index = headings.findIndex(heading => new RegExp(`^${pattern(heading)}$`, 'i').test(matches[i][1].trim()));
    if (index < 0) continue;
    const key = PDF_FIELDS[index];
    if (found.includes(key)) continue; // repeated page headers do not replace a section
    fields[key] = text.slice(matches[i].index + matches[i][0].length, matches[i + 1]?.index ?? text.length).trim();
    found.push(key);
  }
  return { fields, found };
}
const lines = text => String(text || '').split('\n').map(s => s.trim()).filter(Boolean);
const clean = text => String(text || '').replace(/^[-•]\s*/, '').trim();
const numbered = text => lines(text).filter(s => !/^(?:CLO|ILO|WEEK|SCHEDULE|COMPONENT|PERCENTAGE)\s*(?:\||\t|$)/i.test(s));
const labelled = (text, label) => [...String(text || '').matchAll(new RegExp(`\\b${label}\\s*(\\d+)\\s*[.:]\\s*([\\s\\S]*?)(?=\\b${label}\\s*\\d+\\s*[.:]|$)`, 'gi'))].map(match => ({ no: Number(match[1]), text: match[2].replace(/\s+/g, ' ').trim() }));
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
    const startsCitation = /^[A-Z][\p{L}'’-]+,\s*[A-Z]/u.test(line) || /^\d+[.)]\s/.test(line) || /Accessed.*\b\d{4}\.?$/i.test(buffer);
    if (buffer && (startsCitation || group === 'electronics')) flush();
    buffer += (buffer ? ' ' : '') + line;
  }
  flush(); return groups;
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
  if (fields.vision?.trim()) outcomes.vision = fields.vision.trim();
  if (fields.mission?.trim()) {
    const parts = fields.mission.split(/\n\s*[•●▪-]\s*/).map(s => s.trim()).filter(Boolean);
    outcomes.mission = { lead: parts[0] || '', items: parts.slice(1) };
  }
  if (fields.egas?.trim()) outcomes.egas = labelled(fields.egas, 'EGA').map(entry => ({ no: entry.no, name: entry.text, short: entry.text.slice(0, 120) }));
  if (fields.pos?.trim()) outcomes.pos = labelled(fields.pos, 'PO').map(entry => ({ no: entry.no, text: entry.text, short: `PO ${entry.no}`, egas: [] }));
  next.outcomes = outcomes;
  // Course identity remains controlled by the selected subject and its normal save API.
  const normalize = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const identity = importIdentity(fields, draft.meta, identityContext, requireIdentity);
  if (!fields.program && identityContext) warnings.push({ key: 'pdfImport.programReview', values: { program: draft.meta.program } });
  const mismatch = !identity.ok;
  if (mismatch) warnings.push({ key: 'pdfImport.identityMismatch', values: { code: fields.code?.trim() || '', selected: draft.meta.code } });
  if (fields.title?.trim() && normalize(fields.title) !== normalize(draft.meta.title)) warnings.push({ key: 'pdfImport.titleMismatch', values: {} });
  const prerequisite = prerequisiteReview(fields, draft.meta, prerequisiteChoice);
  next.meta.prereq = prerequisite.value;
  if (prerequisite.conflict) warnings.push({ key: 'pdfImport.prereqConflict', values: {} });
  const credits = fields.credits?.match(/^\s*(\d+(?:\.\d+)?)\s*(?:units?)?\s*$/i);
  if (credits) { next.meta.lecture = credits[1]; next.meta.lab = ''; }
  if (fields.credits?.trim()) warnings.push({ key: 'pdfImport.creditsReview', values: {} });
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
      const unknown = refs.values.filter(n => !available.some(p => p.no === n));
      if (unknown.length || refs.invalid.length) unresolvedMappings.push({ clo: sourceNo, label, unknown, invalid: refs.invalid, source: line });
      return refs.values.filter(n => available.some(p => p.no === n));
    };
    const statement = (cells.length > 1 && /^(?:CLO\s*)?\d+[.)]?$/i.test(cells[0]) ? cells[1] : line)
      .replace(/^(?:CLO\s*)?\d+[.):\s]+/i, '').replace(/\s*\[?\b(?:POs?|EGAs?)\s*[:=]?\s*\d.*$/i, '').trim();
    if (statement) sourceCloNumbers.push(sourceNo);
    return { id: id(), title: `CLO ${sourceNo}`, level: 'Introductory', statement,
      pos: selected('PO', outcomes.pos), egas: selected('EGA', outcomes.egas) };
  }).filter(c => c.statement);
  if (clos.length > 20) throw new Error('pdfImport.tooManyClos');
  if (new Set(sourceCloNumbers).size !== sourceCloNumbers.length) throw new Error('pdfImport.duplicateClos');
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
    if (/^\s*TOTAL\b/i.test(line)) continue;
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
