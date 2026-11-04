// Isolated source adapter, not a checker. No production files, DB or providers are written.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { out, root, sources, write, sha } from './extract.mjs';
const require = createRequire(import.meta.url);
const { validateOutcomes } = require('../../server/lib/syllabusOutcomes');
const read = async name => JSON.parse(await fs.readFile(`${out}/${name}`, 'utf8'));
export const flat = s => String(s || '').replace(/\s+/g, ' ').trim();
export function numbers(text) {
  const values = [];
  for (const m of String(text).matchAll(/\d+(?:\s*[-–]\s*\d+)?/g)) {
    const [a, b = a] = m[0].split(/\s*[-–]\s*/).map(Number);
    if (b < a || b > 50) throw Error(`Ambiguous range ${m[0]}`);
    for (let n = a; n <= b; n++) values.push(n);
  }
  return [...new Set(values)];
}
export function targets(text, label) {
  return [...new Set([...text.matchAll(new RegExp(`\\b${label}\\s*(\\d+(?:\\s*[-–,;.]\\s*\\d+)*)`, 'gi'))].flatMap(m => numbers(m[1])))];
}
export function labelled(text, label) {
  const re = new RegExp(`\\b${label}\\s*(\\d+)\\s*[:.]`, 'gi'), hits = [...text.matchAll(re)];
  return hits.map((m, i) => ({ no: +m[1], raw: text.slice(m.index, hits[i + 1]?.index ?? text.length).trim(),
    text: flat(text.slice(m.index + m[0].length, hits[i + 1]?.index ?? text.length)) }));
}
function outcomeColumns(source) {
  let active = false;
  const parts = { egas: [], pos: [], clos: [] };
  for (const table of source.tables) {
    if (table.cells.length === 3 && /PROGRAM\s+OUTCOMES/.test(table.cells[1].text)) { active = true; continue; }
    if (table.cells.length === 6) active = false;
    if (!active || table.cells.length !== 3) continue;
    for (const [index, key] of ['egas', 'pos', 'clos'].entries()) {
      if (table.cells[index].text) parts[key].push({ page: table.page, text: table.cells[index].text, box: [table.xs[index], table.top, table.xs[index + 1], table.bottom] });
    }
  }
  return Object.fromEntries(Object.entries(parts).map(([key, chunks]) => [key, { chunks, text: chunks.map(c => c.text).join('\n') }]));
}
function entryPages(raw, column) {
  // Entry offsets into the concatenated source column, including continuations.
  const start = column.text.indexOf(raw), end = start + raw.length;
  let offset = 0;
  return column.chunks.filter(c => { const a = offset; offset += c.text.length + 1; return a < end && offset - 1 > start; }).map(c => c.page);
}
function planCells(source) {
  const rows = []; let active = false;
  for (const table of source.tables) {
    if (table.cells.length !== 6) continue;
    const cells = table.cells.map(c => c.text);
    if (/SCHEDULE/.test(cells[0]) && /OUTCOMES/.test(cells[1])) { active = true; continue; }
    if (!active) continue;
    const week = cells[0].replace(/week/ig, '').replace(/\s/g, '').replace(/[–—]/g, '-');
    const chunk = { page: table.page, cells, box: [table.xs[0], table.top, table.xs.at(-1), table.bottom] };
    if (/^\d+(?:[-,]\d+)*$/.test(week)) rows.push({ week, chunks: [chunk] });
    else if (!week && rows.length) rows.at(-1).chunks.push(chunk);
    else if (cells.some(Boolean)) throw Error(`Ambiguous plan row ${source.key} p${table.page}`);
  }
  return rows.map(row => ({ ...row, pages: [...new Set(row.chunks.map(c => c.page))],
    cells: Array.from({ length: 6 }, (_, i) => row.chunks.map(c => c.cells[i]).filter(Boolean).join('\n')) }));
}
export function splitIlos(text, key, week) {
  if (!text.trim()) return [];
  const hits = [...text.matchAll(/\b(?:I\s*LO|LO)\s*\d+\s*[:.]?/gi)];
  let chunks = hits.length ? hits.map((m, i) => text.slice(m.index, hits[i + 1]?.index ?? text.length).trim()) : [text.trim()];
  if (hits.length && text.slice(0, hits[0].index).trim()) throw Error('Unassigned ILO prefix');
  // Manual source review: the final unlabelled sentence is a separate outcome,
  // p8 of IT202. Do not inherit the preceding ILO's CLO2-3 tags.
  if (key === 'it202' && week === '16-17') {
    const boundary = chunks.at(-1).search(/Demonstrate\s+the\s+Filipino-Catholic/);
    if (boundary < 0) throw Error('Reviewed unlabelled outcome not found');
    const last = chunks.pop(); chunks.push(last.slice(0, boundary).trim(), last.slice(boundary).trim());
  }
  return chunks;
}
function referenceGroups(text) {
  const groups = []; let current;
  for (const line of text.split('\n')) {
    if (/^[A-D]\.\s*(BOOKS|INTERNET REFERENCES|JOURNALS|ELECTRONICS)\s*:?\s*$/i.test(line)) {
      current = { heading: line, raw: '', items: [] }; groups.push(current); continue;
    }
    if (!line.trim()) continue;
    if (!current) throw Error('Reference without source heading');
    current.raw += (current.raw ? '\n' : '') + line;
  }
  for (const group of groups) {
    const lines = group.raw.split('\n'); let buffer = '';
    for (const line of lines) {
      const start = /^(?:[A-Z][\p{L}'’-]+,\s*[A-Z]|[A-Z][\p{L}'’-]+\s+[A-Z]\.?\s+et\.|Java Tutorial|Learn Java|Java tutorial|Quizizz|Java Eclipse)/u.test(line);
      if (buffer && (start || /ELECTRONICS/.test(group.heading))) { group.items.push(buffer); buffer = ''; }
      buffer += (buffer ? '\n' : '') + line;
    }
    if (buffer) group.items.push(buffer);
  }
  return groups;
}
function fieldPages(source, text) {
  const compact = s => s.replace(/\s/g, '');
  const tokens = compact(text).slice(0, 40);
  const start = source.pages.find(p => compact(p.stream).includes(tokens))?.page;
  const tail = compact(text).slice(-40);
  const end = source.pages.find(p => p.page >= start && compact(p.stream).includes(tail))?.page ?? start;
  return start ? Array.from({ length: end - start + 1 }, (_, i) => start + i) : [];
}
export function build(source) {
  const { key, program } = source, f = source.production.fields, cols = outcomeColumns(source);
  const description = source.pages[0].stream.match(/III\.\s*COURSE DESCRIPTION\s*:([\s\S]*?)IV\./i)?.[1]?.trim();
  if (!description) throw Error('Source course description not found');
  const evidence = { identity: { program, basis: 'User-specified degree; matched within that program in frozen database export. Degree code is not printed in the college header.', schoolYear: '2025-2026', schoolYearPages: fieldPages(source, '2025-2026'), curriculumYear: null, curriculumYearReason: 'Not stated in PDF; school year is not curriculum year.' }, fields: {}, outcomes: {}, plan: [], references: [] };
  for (const name of ['code', 'title', 'description', 'credits', 'reqs', 'refs']) evidence.fields[name] = { raw: f[name], pages: fieldPages(source, f[name]) };
  evidence.fields.description = { raw: description, pages: [1], adaptation: 'Read between source-stream section headings, not y-sorted importer text.' };
  const prereqRaw = source.pages[0].stream.match(/IV\.[\s\S]*?:([\s\S]*?)V\.\s*CREDIT/i)?.[1]?.trim();
  if (!prereqRaw) throw Error('Prerequisite not found');
  const prereq = flat(prereqRaw).replace(/\b4\s+th\b/, '4th');
  evidence.fields.prereq = { raw: prereqRaw, pages: [1], adaptation: key === 'ie402' ? 'Superscript th rejoined to 4; no wording change.' : 'Whitespace only' };
  const notes = ['No PO-EGA crosswalk supplied; all PO.egas remain empty.', 'CLO level is an unsourced builder enum default (Introductory); no academic level judgment.', 'Whitespace and soft line wraps normalized in checker text. Original tokens, exact cell lines and page references retained in source/evidence.', 'No curriculum year or year level is printed; blank in source content.', 'EGA short labels are display metadata; exact master comparison can detect display differences.'];
  const pos = labelled(cols.pos.text, 'PO').map(e => {
    evidence.outcomes[`PO${e.no}`] = { raw: e.raw, pages: entryPages(e.raw, cols.pos) };
    return { no: e.no, text: e.text, short: `PO ${e.no}`, egas: [] };
  });
  const egas = labelled(cols.egas.text, 'EGA').map(e => {
    evidence.outcomes[`EGA${e.no}`] = { raw: e.raw, pages: entryPages(e.raw, cols.egas) };
    return { no: e.no, name: e.text, short: e.text.slice(0, 120) };
  });
  const clos = labelled(cols.clos.text, 'CLO').map(e => {
    evidence.outcomes[`CLO${e.no}`] = { raw: e.raw, pages: entryPages(e.raw, cols.clos) };
    const statement = e.text.replace(/\s*\[(?:EGA|PO)\s*\d[\s\S]*$/i, '').trim();
    return { id: `${key}_clo${e.no}`, title: `CLO ${e.no}`, level: 'Introductory', statement, pos: targets(e.text, 'PO'), egas: targets(e.text, 'EGA') };
  });
  const plan = planCells(source).map((row, i) => {
    evidence.plan.push(row);
    const [, ilo, contents, activities, tasks, values] = row.cells;
    const kind = /\b(?:EXAM|EXAMINATION)\b/i.test(contents) ? 'exam' : 'lesson';
    const ilos = (kind === 'lesson' ? splitIlos(ilo, key, row.week) : ilo.trim() ? [ilo] : []).map((raw, j) => {
      const tagged = targets(raw, 'CLO');
      return { id: `${key}_r${i + 1}_i${j + 1}`, text: flat(raw), tags: tagged.map(n => {
        if (!clos.some(c => c.id === `${key}_clo${n}`)) throw Error('Dangling source CLO target');
        return `clo:${key}_clo${n}`;
      }) };
    });
    return { id: `${key}_r${i + 1}`, week: row.week, kind, ilos, contents, activities, tasks, values };
  });
  if (key === 'it202') notes.push('p8 unlabelled value-webbing sentence split after ILO1, without copying its CLO tags; needs faculty confirmation.');
  if (key !== 'it202') notes.push('PO12 ends mid-sentence in baseline; supporting PDF completion is NOT inserted.');
  if (key === 'cpe304') notes.push('p7 week12 assessment/value cells appear swapped; preserved as printed. Preliminary exam activities say Mid Term; preserved.');
  if (key === 'ie402') notes.push('3 units states only total units; source lecture/lab split is unresolved. Builder-context scenario uses the catalog split explicitly.');
  if (key === 'ie402') notes.push('Production page y-sorting appends prerequisite superscript th to description and leaves 4 Year Standing. Offline adapter reads source stream and rejoins the superscript; production remains unchanged.');
  const groups = referenceGroups(f.refs), refs = Object.fromEntries(['books', 'program', 'online', 'electronics'].map(k => [k, { na: false, items: [] }]));
  for (const group of groups) {
    const dest = /BOOKS/.test(group.heading) ? 'books' : /ELECTRONICS/.test(group.heading) ? 'electronics' : 'online';
    evidence.references.push({ ...group, builderGroup: dest, pages: fieldPages(source, group.raw) });
    for (const raw of group.items) refs[dest].items.push({ id: `${key}_ref${Object.values(refs).reduce((n, g) => n + g.items.length, 0) + 1}`, t: raw });
  }
  notes.push('Source Journals retained as a source category in evidence; projected to builder online because schema has no Journals group. No absent group is silently marked N/A.');
  const gradingRaw = f.grading.split(/Prepared by:/i)[0].trim();
  evidence.fields.grading = { raw: gradingRaw, pages: fieldPages(source, gradingRaw) };
  const grading = gradingRaw.split('\n').flatMap((line, i) => {
    const m = line.match(/^(.+?)\s+(\d+)\s*%\s*$/); return m ? [{ id: `${key}_g${i}`, label: m[1].replace(/^\d+[.)]\s*/, '').trim(), abbr: '', pct: m[2] }] : [];
  });
  let reqN = 0;
  const reqs = f.reqs.split(/\n(?=\d+\.)/).map(t => ({ id: `${key}_q${++reqN}`, t }));
  const lec = f.credits.match(/(\d+)\s*units?\s*lecture/i), lab = f.credits.match(/(\d+)\s*units?\s*lab/i);
  const mission = f.mission.split(/\n\s*[●•]/).map(flat);
  const content = { schemaVersion: 3, meta: { program, code: f.code, title: f.title, schoolYear: '2025-2026', curriculumYear: '', yearLevel: '', prereq, lecture: lec?.[1] || '', lab: lab?.[1] || (lec ? '0' : '') },
    outcomes: { vision: f.vision, mission: { lead: mission[0], items: mission.slice(1) }, egas, pos }, description: [{ id: `${key}_desc`, t: description }], clos, plan, reqs, refs, grading: { rows: grading, override: { on: false, term: '', final: '' } } };
  evidence.fields.vision = { raw: f.vision, pages: fieldPages(source, f.vision) };
  evidence.fields.mission = { raw: f.mission, pages: fieldPages(source, f.mission) };
  validateOutcomes(content.outcomes, content.clos, content.plan);
  const expected = { it202: [9,13,20,19,30], ie402: [13,9,15,13,29], cpe304: [13,11,15,11,6] }[key];
  const actual = [pos.length, plan.length, plan.filter(r=>r.kind==='lesson').flatMap(r=>r.ilos).length, clos.reduce((n,c)=>n+c.pos.length,0), plan.filter(r=>r.kind==='lesson').flatMap(r=>r.ilos).reduce((n,i)=>n+i.tags.length,0)];
  if (!expected || clos.length !== 4 || egas.length !== 4 || actual.some((n,i)=>n!==expected[i])) throw Error(`Incomplete or changed source extraction: ${key} ${actual}`);
  return { version: 'lcup-approved-offline-1', source: { file: `docs/academic-references/${source.file}`, sha256: source.sha256, pages: source.pages.length }, key, content, evidence, reviewNotes: notes,
    readiness: { deterministic: true, aiEvaluation: false, reason: 'Faculty semantics and institutional references unresolved; external transmission not authorized.' } };
}
export async function generate() {
  const fixtures = [];
  for (const [key, file] of sources.slice(0, 3)) {
    const source = await read(`${key}.source.json`);
    if (sha(await fs.readFile(`${root}/docs/academic-references/${file}`)) !== source.sha256) throw Error('Source changed');
    const fixture = build(source); await write(`${key}.fixture.json`, fixture); fixtures.push(fixture);
  }
  const comparisons = [];
  for (const [key] of sources.filter(s => s[2] !== 'BSIT')) {
    const source = await read(`${key}.source.json`), col = outcomeColumns(source).pos;
    comparisons.push({ key, file: source.file, sha256: source.sha256, pos: labelled(col.text, 'PO').map(e => ({ ...e, pages: entryPages(e.raw, col) })) });
  }
  await write('engineering-pos.json', comparisons);
  return fixtures;
}
if (process.argv[1] === import.meta.filename) {
  const fixtures = await generate();
  for (const f of fixtures) console.log(JSON.stringify({ key: f.key, clos: f.content.clos.length, pos: f.content.outcomes.pos.length, planRows: f.content.plan.length, ilos: f.content.plan.filter(r => r.kind === 'lesson').reduce((n, r) => n + r.ilos.length, 0), untagged: f.content.plan.filter(r => r.kind === 'lesson').flatMap(r => r.ilos).filter(i => !i.tags.length).length, cloPo: f.content.clos.reduce((n, c) => n + c.pos.length, 0), iloClo: f.content.plan.filter(r => r.kind === 'lesson').flatMap(r => r.ilos).reduce((n, i) => n + i.tags.length, 0) }));
}
