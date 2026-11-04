#!/usr/bin/env node
'use strict';
// Verifies docs/faculty-review/align-1-dev-adjudication-v2/ offline, against Version 1 and the records both versions were built from (the A2,
// B2 and A1 evaluation records, the development split of align-1, the pre-registered developer notes and the institutional texts), not
// against the generator's own output.
//   node scripts/verify-align1-adjudication-v2.cjs [--pkg <dir>] [--prereg <file>] [--no-rebuild]
// Checks Version 1 and every source unchanged; every file against package-manifest.json; the 58 cases, their codes, texts, answers and
// quotations; the 160 proposals, recomputed from the A2 and B2 records; the Word forms (case texts, questions, content controls, blank
// answers), their Markdown copies, the response sheets and the PDFs; the blinding of every distributed file (text, document properties, PDF
// metadata, file names); the separation of the bundles; the status of every institutional reference; the neutrality of the policy
// questions; and, unless --no-rebuild, a rebuild into a temporary folder compared byte for byte (the PDFs, which Word does not make
// reproducibly, excepted).
// Reads the development split only: held-out items are dropped by the split filter and never read further. Calls nothing over the network
// and changes no file in the repository (the temporary rebuild folder is removed). Prints findings and counts, never a credential.
// Exit code 1 if any check fails.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), os = require('node:os'), zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');

const ROOT = path.join(__dirname, '..');
const option = name => { const i = process.argv.indexOf(name); return i > 1 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : null; };
const V1 = path.join(ROOT, 'docs', 'faculty-review', 'align-1-dev-adjudication');
const PKG = option('--pkg') || path.join(ROOT, 'docs', 'faculty-review', 'align-1-dev-adjudication-v2');
const PREREG = option('--prereg') || path.join(ROOT, 'docs', 'ai-eval-anthropic', 'p2b2-preregistered.json');
const GENERATOR = path.join(__dirname, 'export-align1-adjudication-v2.cjs');
const A_DIR = '1-part-a-for-reviewers', B_DIR = '2-part-b-for-reviewers', P_DIR = '3-policy-panel', C_DIR = 'coordinator-restricted', MIRROR = `${C_DIR}/distributed-text`;
const COURSE_CODE = { calc: 'MA7', ie: 'IE310', prog: 'IT204', nurs: 'NCM101', edu: 'EDUC105', acct: 'ACCTG201', hm: 'HM210' };
const CODE_RE = /\b(?:MA7|IE310|IT204|NCM101|EDUC105|ACCTG201|HM210)-\d{2}\b/;
const TITLE = { 'CLO-PO': 'CLO and program outcome', 'CLO-anyPO': 'CLO and a list of program outcomes', 'CLO-EGA': 'CLO and expected graduate attribute', 'CLO-anyEGA': 'CLO and the list of graduate attributes', 'ILO-CLO': 'ILO and course learning outcome' };
const STATUS = { synthetic: 'Synthetic: written for this review', transcribed: 'Transcribed: copied into the system, not confirmed by the institution', website: 'Website copy: pending institutional approval', none: 'Not held in the system' };
const CREATOR = 'Faculty adjudication package';

const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const inPkg = f => path.join(PKG, ...f.split('/'));
const text = f => fs.readFileSync(inPkg(f), 'utf8');
let pass = 0, fail = 0;
const check = (area, name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'} [${area}] ${name}${detail ? ` | ${detail}` : ''}`); };
const note = (area, t) => console.log(`NOTE [${area}] ${t}`);
const few = (xs, n = 6) => { const u = [...new Set(xs)]; return u.slice(0, n).join('; ') + (u.length > n ? ` (+${u.length - n} more)` : ''); };
const ws = s => String(s).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const squash = s => String(s).replace(/\s+/g, '');
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sentences = t => String(t || '').split(/(?<=[.!?;:])\s+/).map(s => s.trim()).filter(s => s.length >= 30);
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const parseCsv = raw => {
  const rows = []; let row = [], cur = '', q = false;
  const t = raw.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; } else if (ch === '\r') { /* a row ends at \n */ } else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
};

// ---- .docx: a zip reader (stored or deflated entries, CRC-checked) and a reader for the parts this package writes ----
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const unzip = buf => {
  let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('not a zip file');
  const parts = new Map(); let p = buf.readUInt32LE(e + 16), crcBad = 0;
  for (let k = 0, n = buf.readUInt16LE(e + 10); k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
    const method = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16), size = buf.readUInt32LE(p + 20), nameLen = buf.readUInt16LE(p + 28), at = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen), start = at + 30 + buf.readUInt16LE(at + 26) + buf.readUInt16LE(at + 28);
    const data = method === 0 ? buf.subarray(start, start + size) : zlib.inflateRawSync(buf.subarray(start, start + size));
    if (crc32(data) !== crc) crcBad++;
    parts.set(name, data);
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return { parts, crcBad };
};
const unesc = s => s.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (m, e) => ({ lt: '<', gt: '>', quot: '"', apos: '\'', amp: '&' })[e.toLowerCase()]
  ?? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)));
const runText = xml => [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map(m => unesc(m[1])).join('').replace(/ /g, ' ');
const wellFormed = xml => {
  const stack = []; const re = /<\?xml[^>]*\?>|<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>/g;
  let last = 0, m;
  while ((m = re.exec(xml))) {
    const between = xml.slice(last, m.index);
    if (between.includes('<') || /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(between)) return false;
    last = re.lastIndex;
    if (!m[2]) continue;
    if (m[1]) { if (stack.pop() !== m[2]) return false; } else if (!m[4]) stack.push(m[2]);
  }
  return stack.length === 0 && !xml.slice(last).includes('<');
};
const readDocx = file => {
  const { parts, crcBad } = unzip(fs.readFileSync(inPkg(file)));
  const xml = name => (parts.has(name) ? parts.get(name).toString('utf8') : '');
  const doc = xml('word/document.xml');
  const sdtsOf = s => [...s.matchAll(/<w:sdt>([\s\S]*?)<\/w:sdt>/g)].map(m => ({
    tag: unesc((m[1].match(/<w:tag w:val="([^"]*)"\/>/) || [])[1] || ''), alias: unesc((m[1].match(/<w:alias w:val="([^"]*)"\/>/) || [])[1] || ''),
    id: (m[1].match(/<w:id w:val="(\d+)"\/>/) || [])[1], box: m[1].includes('<w14:checkbox>'), unchecked: /<w14:checked w14:val="0"\/>/.test(m[1]) && runText(m[1]) === '☐',
    placeholder: m[1].includes('<w:showingPlcHdr/>') }));
  const paras = [...doc.matchAll(/<w:p>([\s\S]*?)<\/w:p>/g)].map(m => ({ style: (m[1].match(/<w:pStyle w:val="([^"]+)"\/>/) || [])[1] || '', text: runText(m[1]),
    pageBreak: m[1].includes('<w:pageBreakBefore/>'), sdts: sdtsOf(m[1]) }));
  const tables = [...doc.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)].map(t => [...t[1].matchAll(/<w:tr>([\s\S]*?)<\/w:tr>/g)]
    .map(r => [...r[1].matchAll(/<w:tc>([\s\S]*?)<\/w:tc>/g)].map(c => [...c[1].matchAll(/<w:p>([\s\S]*?)<\/w:p>/g)].map(p => runText(p[1])).join('\n'))));
  const footer = xml('word/footer1.xml');
  return { parts, crcBad, xml, doc, paras, tables, sdts: sdtsOf(doc), all: paras.map(p => p.text).join('\n'),
    footerPrefix: unesc((footer.match(/<w:t xml:space="preserve">([^<]*)<\/w:t><\/w:r><w:fldSimple w:instr=" PAGE ">/) || [])[1] || '').replace(/ /g, ' ') };
};
// the paragraphs of one heading's section, up to the next heading of the same style
const sections = (d, style, re) => {
  const heads = d.paras.map((p, k) => [k, p]).filter(([, p]) => p.style === style && re.test(p.text));
  return heads.map(([k, p], n) => ({ head: p, paras: d.paras.slice(k + 1, n + 1 < heads.length ? heads[n + 1][0] : d.paras.length) }));
};
// consecutive case-text paragraphs, each group joined with line breaks
const caseGroups = paras => { const out = []; let cur = null; for (const p of paras) { if (p.style === 'CaseText') (cur = cur || []).push(p.text); else if (cur) { out.push(cur.join('\n')); cur = null; } } if (cur) out.push(cur.join('\n')); return out; };
const tableWithHead = (d, head) => d.tables.find(t => t.length && sameJson(t[0], head));

// ---- PDF text, with the repository's pdfjs-dist (server/node_modules) ----
const loadPdfjs = async () => {
  try {
    const req = createRequire(path.join(ROOT, 'server', 'package.json'));
    const dir = path.dirname(req.resolve('pdfjs-dist/package.json'));
    return { lib: await import(pathToFileURL(path.join(dir, 'legacy', 'build', 'pdf.mjs')).href), fonts: `${path.join(dir, 'standard_fonts').split(path.sep).join('/')}/` };
  } catch { return null; }
};
const readPdf = async (pdfjs, file) => {
  const task = pdfjs.lib.getDocument({ data: new Uint8Array(fs.readFileSync(inPkg(file))), isEvalSupported: false, useSystemFonts: false, standardFontDataUrl: pdfjs.fonts, verbosity: 0 });
  const pdf = await task.promise, meta = await pdf.getMetadata(), pages = [];
  for (let n = 1; n <= pdf.numPages; n++) { const tc = await (await pdf.getPage(n)).getTextContent(); pages.push(tc.items.map(it => it.str + (it.hasEOL ? '\n' : ' ')).join('')); }
  const xmp = meta.metadata && typeof meta.metadata.getAll === 'function' ? JSON.stringify(meta.metadata.getAll()) : '';
  await task.destroy();
  return { pages, info: meta.info || {}, xmp };
};

(async () => {
  if (!fs.existsSync(path.join(PKG, 'package-manifest.json'))) { console.log(`FAIL [files] no package-manifest.json in ${PKG}`); process.exit(1); }
  console.log(`Verifying ${path.relative(ROOT, PKG).split(path.sep).join('/') || PKG}\n`);

  // ======================= 1. Version 1 and the sources =======================
  const v1m = readJson(path.join(V1, 'package-manifest.json'));
  const v1Bad = v1m.files.filter(f => !fs.existsSync(path.join(V1, f.path)) || sha(path.join(V1, f.path)) !== f.sha256).map(f => f.path);
  check('version 1', `Version 1 is unchanged: all ${v1m.files.length} files match its manifest`, v1m.files.length === 27 && !v1Bad.length, few(v1Bad));
  const V1C = readJson(path.join(V1, 'coordinator', 'cases.json'));
  const SRC = Object.fromEntries(Object.entries(V1C.sources).map(([k, s]) => [k, k === 'prereg' ? PREREG : path.join(ROOT, s.file)]));
  const drift = Object.entries(V1C.sources).filter(([k, s]) => !fs.existsSync(SRC[k]) || sha(SRC[k]) !== s.sha256 || v1m.sources[k] !== s.sha256).map(([k]) => k);
  check('sources', `all ${Object.keys(SRC).length} source records match the hashes Version 1 recorded (${Object.keys(SRC).join(', ')})`, Object.keys(SRC).length === 9 && !drift.length, drift.join(', '));
  const A = readJson(SRC.a2), B = readJson(SRC.b2), A1 = readJson(SRC.a1), D = readJson(SRC.dataset), PRE = readJson(SRC.prereg), VALS = readJson(SRC.values);
  check('sources', 'the A2 and B2 records still match the result, ledger and dataset hashes they record', [A, B].every(R => [R.sources.result, R.sources.ledger, R.sources.dataset].every(s => fs.existsSync(path.join(ROOT, s.file)) && sha(path.join(ROOT, s.file)) === s.sha256)));
  const SEED = await import(pathToFileURL(SRC.seed).href), OUTC = require(SRC.outcomes), CURR = require(SRC.curriculum);
  const dev = D.items.filter(i => i.split === 'dev'); // held-out items are dropped here and never read further
  const devIds = new Set(dev.map(i => i.id)), byId = new Map(dev.map(i => [i.id, i]));
  const runsOf = id => [...A.cases.find(c => c.id === id).runs.map(r => ({ arm: 'A2', r })), ...B.cases.find(c => c.id === id).runs.map(r => ({ arm: 'B2', r }))];

  // ======================= 2. files and manifest =======================
  const M = readJson(path.join(PKG, 'package-manifest.json'));
  const listAll = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? listAll(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  const onDisk = listAll(PKG).map(f => path.relative(PKG, f).split(path.sep).join('/')).sort();
  const PDFS = M.pdf || [], listed = new Map([...M.files, ...PDFS].map(f => [f.path, f]));
  const unlisted = onDisk.filter(f => f !== 'package-manifest.json' && !listed.has(f)), absent = [...listed.keys()].filter(f => !onDisk.includes(f));
  check('files', `${onDisk.length} files on disk: ${M.files.length} package files, ${PDFS.length} PDFs and the manifest, and nothing else`, !unlisted.length && !absent.length,
    few([...unlisted.map(f => `not in the manifest: ${f}`), ...absent.map(f => `missing: ${f}`)]));
  const hashBad = [...listed.values()].filter(f => onDisk.includes(f.path) && (sha(inPkg(f.path)) !== f.sha256 || fs.statSync(inPkg(f.path)).size !== f.bytes)).map(f => f.path);
  check('files', 'every file matches the sha256 and size in the manifest', !hashBad.length, few(hashBad));
  check('files', 'the manifest names Version 2, Version 1\'s manifest hash and the source hashes Version 1 recorded', M.version === 'align-1-dev-adjudication-v2'
    && M.basedOn.manifestSha256 === sha(path.join(V1, 'package-manifest.json')) && Object.entries(V1C.sources).every(([k, s]) => M.sources[k] && M.sources[k].sha256 === s.sha256));
  const AUD = { [A_DIR]: 'part-a-reviewers', [B_DIR]: 'part-b-reviewers', [P_DIR]: 'policy-panel', [C_DIR]: 'coordinator' };
  const audBad = [...listed.values()].filter(f => f.audience !== (f.path === 'README.md' ? 'index' : AUD[f.path.split('/')[0]])).map(f => f.path);
  check('files', 'each file\'s audience in the manifest is the one its folder is for', !audBad.length, few(audBad));
  const top = [...new Set(onDisk.map(f => f.split('/')[0]))].sort();
  check('files', 'the package holds only README.md, the manifest and the four folders', sameJson(top, [A_DIR, B_DIR, P_DIR, 'README.md', C_DIR, 'package-manifest.json'].sort()), top.join(', '));
  const junk = onDisk.filter(f => /\.(md|csv)$/.test(f) && /\bundefined\b(?! level labels)|\bNaN\b|\[object Object\]|\bnull\b/.test(text(f)));
  check('files', 'no template artefacts (undefined, NaN, null, [object Object]) in any Markdown or CSV file', !junk.length, few(junk));
  const fffd = onDisk.filter(f => /\.(md|csv|json)$/.test(f) && text(f).includes('�'));
  check('files', 'no replacement characters (encoding faults) in any text file', !fffd.length, few(fffd));
  const SECRET = /sk-ant-[A-Za-z0-9_-]{8,}|sk-or-[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|Bearer\s+[A-Za-z0-9._-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}/;
  const secretHits = onDisk.filter(f => !f.endsWith('.pdf') && SECRET.test(fs.readFileSync(inPkg(f), 'latin1')));
  check('files', 'no credential pattern in any file (Word files read as raw bytes; PDFs are checked by their text below)', !secretHits.length, few(secretHits));

  // ======================= 3. cases =======================
  const C = readJson(inPkg(`${C_DIR}/cases.json`));
  const strip = c => { const { distribution, ...rest } = c; return rest; };
  check('cases', 'cases.json holds Version 1\'s 58 case records unchanged and in the same order; each gains only its form locations', C.cases.length === 58 && V1C.cases.length === 58
    && C.cases.every((c, k) => sameJson(strip(c), V1C.cases[k]) && c.distribution && typeof c.distribution.partA === 'string'));
  check('cases', 'cases.json: evaluations, sets and policy questions as in Version 1; sources as Version 1 recorded; based on Version 1\'s manifest and cases.json',
    sameJson(C.evaluations, V1C.evaluations) && sameJson(C.sets, V1C.sets) && sameJson(C.policyQuestions, V1C.policyQuestions)
    && Object.entries(V1C.sources).every(([k, s]) => C.sources[k] && C.sources[k].sha256 === s.sha256)
    && C.basedOn.manifestSha256 === sha(path.join(V1, 'package-manifest.json')) && C.basedOn.casesSha256 === sha(path.join(V1, 'coordinator', 'cases.json')));
  check('cases', '58 development cases with unique ids, no two sharing both texts', dev.length === 58 && devIds.size === 58 && new Set(dev.map(i => `${i.source}\u0000${i.target}`)).size === 58);
  check('cases', 'the A2 and B2 records hold the same 58 cases with the same texts and labels', [A, B].every(R => R.cases.length === 58
    && R.cases.every(c => byId.has(c.id) && byId.get(c.id).source === c.source && byId.get(c.id).target === c.target && sameJson(byId.get(c.id).accept, c.accept))));
  check('cases', 'cases.json: 58 unique codes, 58 unique ids, exactly the development ids', new Set(C.cases.map(c => c.code)).size === 58 && new Set(C.cases.map(c => c.id)).size === 58 && C.cases.every(c => devIds.has(c.id)));
  const codeToId = new Map(C.cases.map(c => [c.code, c.id])), idToCode = new Map(C.cases.map(c => [c.id, c.code]));
  const fieldBad = C.cases.filter(c => { const i = byId.get(c.id); return !i || c.source !== i.source || c.target !== i.target || c.type !== i.type || c.category !== i.category || !!c.ambiguous !== !!i.ambiguous
    || !sameJson(c.provisional.accept, i.accept) || c.provisional.why !== i.why || c.course.code !== D.courses[i.course].code || !c.code.startsWith(`${COURSE_CODE[i.course]}-`); }).map(c => c.code);
  check('cases', 'every case\'s texts, type, labels, rationale, category and course equal the dataset, and each code names its course', !fieldBad.length, few(fieldBad));
  const set1 = new Set(dev.filter(i => runsOf(i.id).some(x => !i.accept.includes(x.r.label))).map(i => i.id));
  check('cases', 'Set 1 recomputed from the A2 and B2 records (an answer outside the provisional labels): 18 cases, as recorded', set1.size === 18 && C.cases.every(c => (c.set === 1) === set1.has(c.id)), `${set1.size}`);
  const setN = n => C.cases.filter(c => c.set === n).length;
  check('cases', 'sets of 18, 26 and 14 cases', setN(1) === 18 && setN(2) === 26 && setN(3) === 14, `${setN(1)}/${setN(2)}/${setN(3)}`);
  const allRuns = dev.flatMap(i => runsOf(i.id));
  check('cases', 'all 232 A2 and B2 answers are verified', allRuns.length === 232 && allRuns.every(x => x.r.verified), `${allRuns.filter(x => x.r.verified).length} of ${allRuns.length}`);
  check('cases', 'no faculty judgment is recorded: every case is pending with no judgments', C.cases.every(c => c.faculty && c.faculty.status === 'pending' && Array.isArray(c.faculty.judgments) && !c.faculty.judgments.length));
  const CC = c => c.code.split('-')[0];
  const distBad = C.cases.filter(c => c.distribution.partA !== `${A_DIR}/${CC(c)}/${CC(c)}-part-a-form.docx` || c.distribution.partB !== (c.proposals.length ? `${B_DIR}/${CC(c)}/${CC(c)}-part-b-form.docx` : null)).map(c => c.code);
  check('cases', 'each case\'s form locations name its own course\'s forms (a Part B form only when changes were proposed)', !distBad.length, few(distBad));

  // ======================= 4. evidence =======================
  const ansBad = [];
  for (const c of C.cases) {
    const rs = runsOf(c.id);
    if (c.answers.length !== 4) { ansBad.push(`${c.code}: ${c.answers.length} answers`); continue; }
    c.answers.forEach((a, k) => { const x = rs[k], r = x.r;
      if (a.arm !== x.arm || a.run !== r.run || a.verified !== r.verified || a.label !== r.label || a.sourceBloom !== r.sourceBloom || a.targetBloom !== r.targetBloom || a.remedy !== r.remedy
        || (a.draft || null) !== (r.draft || null) || a.sourceQuote !== r.sourceQuote || a.targetQuote !== r.targetQuote || a.explanation !== r.explanation) ansBad.push(`${c.code} ${x.arm} run ${r.run}`); });
    if (c.a1) c.a1.forEach((x, k) => { const a = A1.answers[k][c.id]; if (!a || x.label !== a.label || (x.draft || null) !== (a.draft || null)) ansBad.push(`${c.code} A1 run ${k + 1}`); });
  }
  check('evidence', 'every A2 and B2 answer (verdict, levels, remedy, draft, quotations, explanation) and every A1 answer equals its source record', !ansBad.length, few(ansBad));
  check('evidence', 'the 16 eval-1.1 copies carry their A1 answers', C.cases.filter(c => c.a1).length === 16 && C.cases.filter(c => c.a1).every(c => PRE.a1Overlap.includes(c.id)));
  let quotes = 0; const quoteBad = [];
  for (const c of C.cases) for (const a of c.answers) for (const [q, t] of [[a.sourceQuote, c.source], [a.targetQuote, c.target]]) { quotes++; if (!q || !t.includes(q)) quoteBad.push(`${c.code} ${a.arm} run ${a.run}`); }
  check('evidence', `every evidence quotation is an exact substring of its case text (${quotes} quotations)`, quotes === 464 && !quoteBad.length, few(quoteBad));
  // Version 2's copies of Version 1's coordinator documents: Version 1's text with the two documented corrections, and a notice under the title
  const CORR = [[/\b(BSIE|BSIT) (\d{4}-\d{4}) curriculum: /g, '$1 $2 curriculum as transcribed in the system (not confirmed by the registrar): ', 26],
    [/registrar curriculum lists MA 8 Integral Calculus/g, 'registrar curriculum transcription held in the system (not confirmed by the registrar) lists MA 8 Integral Calculus', 1]];
  const copyBad = [];
  for (const file of ['01-case-inventory.md', '02-recommendation-quality-review.md', '03-comparison-and-blinding-key.md', '04-post-validation-development-plan.md']) {
    let t = fs.readFileSync(path.join(V1, 'coordinator', file), 'utf8');
    if (file === '01-case-inventory.md') for (const [re, rep, n] of CORR) { const got = (t.match(re) || []).length; if (got !== n) copyBad.push(`${file}: a correction matched ${got} times, not ${n}`); t = t.replace(re, rep); }
    const v1Lines = t.split('\n'), v2Lines = text(`${C_DIR}/${file}`).split('\n');
    if (!(v2Lines[0] === v1Lines[0] && v2Lines[1] === '' && /^> \*\*Version 2 copy \(restricted\)\.\*\*/.test(v2Lines[2]) && v2Lines.slice(3).join('\n') === v1Lines.slice(1).join('\n'))) copyBad.push(file);
  }
  check('evidence', 'the four copied coordinator documents are Version 1\'s, changed only by a notice and the two documented corrections (26 and 1 replacements)', !copyBad.length, few(copyBad));
  const evidenceTexts = dev.flatMap(i => [i.source, i.target, i.why, ...runsOf(i.id).flatMap(x => [x.r.explanation, x.r.draft, x.r.sourceQuote, x.r.targetQuote])])
    .concat(A1.answers.flatMap(run => Object.entries(run).filter(([id]) => devIds.has(id)).map(([, a]) => a.draft))).filter(Boolean);
  check('evidence', 'the corrections touch no case text, rationale, quotation, explanation or draft', !evidenceTexts.some(t => CORR.some(([re]) => new RegExp(re.source).test(t))));

  // ======================= 5. proposals, recomputed from the A2 and B2 records =======================
  const expected = new Map();
  for (const i of dev) {
    const e = { rewrites: new Map(), remap: [] };
    for (const x of runsOf(i.id)) {
      const r = x.r, who = `${x.arm} run ${r.run}`;
      if (r.remedy === 'RETAG_OUTCOME') { e.remap.push(who); continue; }
      if (r.remedy === 'NO_CHANGE' || !r.draft) continue;
      const t = r.draft.replace(/\s+/g, ' ').trim(); if (!e.rewrites.has(t)) e.rewrites.set(t, []); e.rewrites.get(t).push(who);
    }
    expected.set(idToCode.get(i.id), e);
  }
  const expectedTotal = [...expected.values()].reduce((s, e) => s + e.rewrites.size + (e.remap.length ? 1 : 0), 0);
  const proposals = C.cases.flatMap(c => c.proposals.map(p => ({ ...p, c })));
  const propBad = [];
  for (const c of C.cases) {
    const e = expected.get(c.code), rw = c.proposals.filter(p => p.kind === 'rewrite'), rm = c.proposals.filter(p => p.kind === 'remap');
    if (!sameJson(rw.map(p => p.text).sort(), [...e.rewrites.keys()].sort())) propBad.push(`${c.code}: rewrites`);
    if (rm.length !== (e.remap.length ? 1 : 0)) propBad.push(`${c.code}: re-mapping`);
    c.proposals.forEach((p, k) => { if (p.code !== `${c.code}-R${k + 1}`) propBad.push(`${c.code}: numbering`); });
    for (const p of c.proposals) {
      const from = (p.from || []).map(s => s.replace(/ \(.*\)$/, '')).sort(), want = (p.kind === 'remap' ? e.remap : e.rewrites.get(p.text) || []).slice().sort();
      if (!sameJson(from, want)) propBad.push(`${p.code}: provenance`);
    }
  }
  check('proposals', `${expectedTotal} distinct proposals recomputed from the A2 and B2 records; the package holds ${proposals.length}, in ${C.cases.filter(c => c.proposals.length).length} cases`,
    expectedTotal === 160 && proposals.length === 160 && new Set(proposals.map(p => p.code)).size === 160 && C.cases.filter(c => c.proposals.length).length === 49);
  check('proposals', 'every rewrite and re-mapping from the A2 and B2 answers is in the package exactly once with the answers that proposed it, codes R1..Rn per case, nothing else', !propBad.length, few(propBad));

  // ======================= 6. bundles =======================
  const courses = Object.values(COURSE_CODE), bCourses = courses.filter(cc => C.cases.some(c => CC(c) === cc && c.proposals.length));
  const both = names => names.flatMap(n => [`${n}.docx`, `${n}.pdf`]);
  const ALLOWED = {
    [A_DIR]: [...both(['01-reviewer-guide-part-a', '02-curriculum-and-institutional-references']), ...courses.flatMap(cc => [...both([`${cc}/${cc}-part-a-form`]), `${cc}/${cc}-part-a-responses.csv`])],
    [B_DIR]: [...both(['01-reviewer-guide-part-b']), ...bCourses.flatMap(cc => [...both([`${cc}/${cc}-part-b-form`]), `${cc}/${cc}-part-b-responses.csv`])],
    [P_DIR]: [...both(['01-academic-policy-questions', '02-institutional-decisions-and-approvals', '03-adjudication-procedure', '04-curriculum-and-institutional-references']), 'decision-and-approval-record.csv'],
  };
  for (const [dir, want] of Object.entries(ALLOWED)) {
    const got = onDisk.filter(f => f.startsWith(`${dir}/`)).map(f => f.slice(dir.length + 1)).sort();
    check('bundles', `${dir}/ holds exactly its ${want.length} files, each course's forms in its own folder`, sameJson(got, [...want].sort()),
      few([...got.filter(f => !want.includes(f)).map(f => `extra: ${f}`), ...want.filter(f => !got.includes(f)).map(f => `missing: ${f}`)]));
  }
  check('bundles', 'IE 310 has no Part B form (no change was proposed for its case)', !bCourses.includes('IE310') && bCourses.length === 6);
  const restrictedMd = onDisk.filter(f => f.startsWith(`${C_DIR}/`) && f.endsWith('.md') && !f.startsWith(`${MIRROR}/`));
  const unmarked = restrictedMd.filter(f => !/restricted/i.test(text(f).split('\n').slice(0, 5).join('\n')));
  check('bundles', `every coordinator document says it is restricted in its first lines (${restrictedMd.length} documents), and cases.json says so`, restrictedMd.length === 7 && !unmarked.length && /^Restricted/.test(C.about), few(unmarked));

  // ======================= 7. the Word documents =======================
  const docxFiles = onDisk.filter(f => f.endsWith('.docx'));
  const DOCS = new Map(docxFiles.map(f => [f, readDocx(f)]));
  const PARTS = ['[Content_Types].xml', '_rels/.rels', 'docProps/app.xml', 'docProps/core.xml', 'word/_rels/document.xml.rels', 'word/document.xml', 'word/footer1.xml', 'word/numbering.xml', 'word/settings.xml', 'word/styles.xml'];
  const structBad = [], xmlBad = [], hiddenBad = [], propsBad = [], ctlBad = [], mirrorBad = [];
  for (const [f, d] of DOCS) {
    if (!sameJson([...d.parts.keys()].sort(), [...PARTS].sort()) || d.crcBad) structBad.push(f);
    if (![...d.parts.keys()].every(n => wellFormed(d.xml(n)))) xmlBad.push(f);
    if (/<w:vanish\/>|<w:ins |<w:del |<w:delText|w:rsid|<w:instrText|<w:hyperlink|TargetMode="External"|<w:object|<w:binData|<w:altChunk|<w:customXml/.test([...d.parts.keys()].map(d.xml).join(''))) hiddenBad.push(f);
    const core = d.xml('docProps/core.xml'), h1 = d.paras.find(p => p.style === 'Heading1');
    if (unesc((core.match(/<dc:creator>([^<]*)</) || [])[1] || '') !== CREATOR || unesc((core.match(/<cp:lastModifiedBy>([^<]*)</) || [])[1] || '') !== CREATOR
      || !h1 || unesc((core.match(/<dc:title>([^<]*)</) || [])[1] || '').replace(/ /g, ' ') !== h1.text || !/<Application>Faculty adjudication package generator<\/Application>/.test(d.xml('docProps/app.xml'))
      || /<dc:description|<cp:keywords|<dc:subject|<Company|<Manager/.test(core + d.xml('docProps/app.xml'))) propsBad.push(f);
    const ids = d.sdts.map(s => s.id), tags = d.sdts.map(s => s.tag);
    if (new Set(ids).size !== ids.length || new Set(tags).size !== tags.length || d.sdts.some(s => !s.tag || (s.box ? !s.unchecked : !s.placeholder))) ctlBad.push(f);
    // the Markdown copy for the developer's review: the same headings and the same quoted texts, in the same order
    const mf = `${MIRROR}/${f.replace(/\.docx$/, '.md')}`;
    if (!onDisk.includes(mf)) { mirrorBad.push(`${f}: no copy`); continue; }
    const md = text(mf), heads = d.paras.filter(p => /^Heading[123]$/.test(p.style)).map(p => `${'#'.repeat(+p.style.slice(-1))} ${p.text}`);
    const mdHeads = md.split('\n').filter(l => /^#{1,3} /.test(l));
    const mdQuotes = []; let cur = null;
    for (const l of md.split('\n')) { if (l.startsWith('> ')) (cur = cur || []).push(l.slice(2)); else if (cur) { mdQuotes.push(cur.join('\n')); cur = null; } }
    if (cur) mdQuotes.push(cur.join('\n'));
    if (!sameJson(mdHeads, heads) || !sameJson(mdQuotes.filter(q => q !== '(write here)'), caseGroups(d.paras))) mirrorBad.push(f);
  }
  check('word', `all ${DOCS.size} Word files hold exactly the ten parts this package writes, with correct checksums`, DOCS.size === 20 && !structBad.length, few(structBad));
  check('word', 'every XML part is well formed (balanced tags, quoted attributes, escaped text)', !xmlBad.length, few(xmlBad));
  check('word', 'no hidden text, tracked change, revision id, field code, hyperlink, external link, embedded object or custom XML', !hiddenBad.length, few(hiddenBad));
  check('word', `document properties: creator and last editor "${CREATOR}", title equal to the document's heading, no other personal or descriptive property`, !propsBad.length, few(propsBad));
  check('word', 'content controls: unique ids and tags; every check box unticked and every text field empty (showing its placeholder)', !ctlBad.length, few(ctlBad));
  check('word', 'every Word file has a Markdown copy for the coordinator with the same headings and the same quoted texts', !mirrorBad.length, few(mirrorBad));
  const allDocText = [...DOCS.values()].map(d => d.all).join('\n');
  check('word', 'no template artefacts (undefined, NaN, null, [object Object]) or replacement characters in the Word files', !/\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b|�/.test(allDocText));

  // ---- Part A forms ----
  const A_LABELS = ['Question:', '0. Is this case within your expertise?', 'No, it is outside my expertise', 'If No, leave the rest of this case blank.', '1. Alignment:', 'Insufficient information to judge',
    '2. Rationale.', '3. Reading you applied', 'The distinction did not affect my answer for this case', '4. Course fit.', 'Unsure', '4b.', 'Did your answer to question 4 affect your answer to question 1?',
    '5. Recommendation:', 'Refer for a policy decision', 'Insufficient information to recommend', '6. Cognitive level', 'Cannot tell', '7. Confidence:', '8. Comments.'];
  const BLOOM = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create', 'not-applicable', 'cannot-tell'];
  const expectTagsA = c => {
    const list = c.type === 'CLO-anyPO' || c.type === 'CLO-anyEGA', q = (name, keys) => keys.map(k => `${c.code}|${name}|${k}`);
    return [...q('within-expertise', ['yes', 'no-it-is-outside-my-expertise']), ...q('alignment', ['aligned', 'partially-aligned', 'not-aligned', 'insufficient-information-to-judge']),
      ...(list ? [`${c.code}|fits`] : []), `${c.code}|rationale`, ...q('reading', ['part', 'every-part', 'did-not-affect', 'other', 'other-text']),
      ...q('course-fit', ['yes', 'no', 'unsure', 'insufficient-information-to-judge']), `${c.code}|course-fit-note`, ...q('course-fit-affected-alignment', ['yes', 'no']),
      ...q('recommendation', ['no-change', 'revise', ...(list ? [] : ['re-map']), 'remove', 'refer', 'insufficient-information', 'other', 'other-text']), ...(list ? [] : [`${c.code}|re-map-target`]),
      ...q('bloom-source', BLOOM), ...q('bloom-target', BLOOM), ...q('confidence', ['high', 'medium', 'low']), `${c.code}|comments`].sort();
  };
  const codeKey = s => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const placementStatus = c => { const k = c.course, prog = CURR.programs.find(p => p.code === k.program); return prog && prog.terms.some(t => t.rows.some(r => codeKey(r.code) === codeKey(k.code))) ? 'transcribed' : 'none'; };
  const contextBad = [];
  const checkContext = (f, d, mine) => {
    const ctx = sections(d, 'Heading2', /^Course context$/)[0], items = ctx ? ctx.paras.map(p => p.text).join('\n') : '';
    const k = mine[0].course, has = types => mine.some(c => types.includes(c.type));
    const want = [`Course record (${STATUS.synthetic}): ${k.code} ${k.title}`, `Course description (${STATUS.synthetic}): "${k.description}"`, `Curriculum placement (${STATUS[placementStatus(mine[0])]}):`,
      ...(has(['CLO-PO', 'CLO-anyPO']) ? [`Program outcomes in this course's cases (${STATUS.synthetic})`] : []),
      ...(has(['ILO-CLO']) ? [`Course learning outcomes that the ILOs in this course's cases build toward (${STATUS.synthetic})`] : []),
      ...(has(['CLO-EGA', 'CLO-anyEGA']) ? [`Expected graduate attributes (${STATUS.transcribed})`] : [])];
    const missing = want.filter(w => !items.includes(w));
    if (!ctx || missing.length) contextBad.push(`${f}: ${missing.join(' / ') || 'no course context'}`);
  };
  const seenA = [], formBadA = [], textBadA = [];
  for (const cc of courses) {
    const f = `${A_DIR}/${cc}/${cc}-part-a-form.docx`, d = DOCS.get(f), mine = C.cases.filter(c => CC(c) === cc);
    if (!d) { formBadA.push(`${f}: missing`); continue; }
    checkContext(f, d, mine);
    const segs = sections(d, 'Heading2', /^[A-Z0-9]+-\d{2} · /);
    if (!sameJson(segs.map(s => s.head.text.split(' · ')[0]), mine.map(c => c.code))) formBadA.push(`${f}: cases or order`);
    for (const s of segs) {
      const code = s.head.text.split(' · ')[0], c = mine.find(x => x.code === code); if (!c) continue;
      seenA.push(code);
      const segText = s.paras.map(p => p.text).join('\n');
      if (s.head.text !== `${code} · ${TITLE[c.type]}` || !s.head.pageBreak) formBadA.push(`${code}: heading`);
      if (!sameJson(caseGroups(s.paras), [c.source, c.target])) textBadA.push(code);
      const missing = A_LABELS.filter(l => !segText.includes(l)); if (missing.length) formBadA.push(`${code}: missing ${missing.join(', ')}`);
      const also = c.sharedClo.length ? `The same CLO also appears in ${c.sharedClo.join(', ')}. Judge each case on its own relationship.` : null;
      if (also ? !segText.includes(also) : /also appears in/.test(segText)) formBadA.push(`${code}: shared-CLO note`);
      if (!sameJson(s.paras.flatMap(p => p.sdts.map(x => x.tag)).sort(), expectTagsA(c))) formBadA.push(`${code}: answer fields`);
    }
    const headTags = d.paras.slice(0, d.paras.findIndex(p => p.style === 'Heading2')).flatMap(p => p.sdts.map(x => x.tag));
    if (!sameJson(headTags, ['header|reviewer-code', 'header|date-returned'])) formBadA.push(`${f}: reviewer code and date fields`);
  }
  check('part A', `Part A: ${courses.length} course forms, ${seenA.length} cases, each once, in its own course's form, on its own page, with the right relationship title`, seenA.length === 58 && new Set(seenA).size === 58 && !formBadA.some(x => /cases or order|heading|missing$/.test(x)), few(formBadA));
  check('part A', 'Part A: both texts of every case equal the dataset texts exactly (case IDs and texts unchanged)', !textBadA.length, few(textBadA));
  check('part A', 'Part A: every case has questions 0-8 and 4b, "Insufficient information" in questions 1, 4 and 5, "Cannot tell" in question 6, the list or target field its type needs, and the shared-CLO note', !formBadA.length, few(formBadA));
  check('part A', 'course context in every Part A and Part B form: each text carries its status label, and the curriculum placement\'s status matches what the system holds', !contextBad.length, few(contextBad));
  const v1Wording = [/develops a real part/i, /must show every part/i, /Insufficient evidence to judge/i, /Separately from alignment/i, /BSIE places MA 7/i];
  const oldA = docxFiles.filter(f => f.startsWith(`${A_DIR}/`) && v1Wording.some(re => re.test(DOCS.get(f).all)));
  check('part A', 'Version 1\'s one-sided wording is gone from the Part A forms and guide (the readings in question 3 are parallel)', !oldA.length, few(oldA));

  // ---- Part B forms ----
  const seenB = [], formBadB = [], textBadB = [];
  for (const cc of bCourses) {
    const f = `${B_DIR}/${cc}/${cc}-part-b-form.docx`, d = DOCS.get(f), mine = C.cases.filter(c => CC(c) === cc && c.proposals.length);
    if (!d) { formBadB.push(`${f}: missing`); continue; }
    checkContext(f, d, mine);
    if (!d.all.includes('Open this only after you have returned Part A.')) formBadB.push(`${f}: Part A first`);
    const headTags = d.paras.slice(0, d.paras.findIndex(p => p.style === 'Heading2')).flatMap(p => p.sdts.map(x => x.tag));
    if (!sameJson(headTags, ['header|reviewer-code', 'header|date-returned', 'header|part-a-returned'])) formBadB.push(`${f}: header fields`);
    const segs = sections(d, 'Heading2', /^[A-Z0-9]+-\d{2} · /);
    if (!sameJson(segs.map(s => s.head.text.split(' · ')[0]), mine.map(c => c.code))) formBadB.push(`${f}: cases or order`);
    for (const s of segs) {
      const code = s.head.text.split(' · ')[0], c = mine.find(x => x.code === code); if (!c) continue;
      const item = c.type === 'ILO-CLO' ? 'ILO' : 'CLO';
      const groups = caseGroups(s.paras);
      if (!sameJson(groups.slice(0, 2), [c.source, c.target])) textBadB.push(`${code}: case texts`);
      if (!sameJson(groups.slice(2), c.proposals.filter(p => p.kind === 'rewrite').map(p => p.text))) textBadB.push(`${code}: proposed texts`);
      const h3 = s.paras.filter(p => p.style === 'Heading3').map(p => p.text);
      if (!sameJson(h3, c.proposals.map(p => `${p.code} · ${p.kind === 'rewrite' ? `Proposed rewrite of the ${item}` : 'Proposed re-mapping'}`))) formBadB.push(`${code}: proposal headings`);
      const tags = new Set(s.paras.flatMap(p => p.sdts.map(x => x.tag)));
      for (const p of c.proposals) {
        seenB.push(p.code);
        const need = [...(p.kind === 'rewrite' ? ['rating|appropriate-as-written', 'rating|acceptable-with-edits'] : ['rating|appropriate', 're-map-target']), 'rating|not-appropriate', 'rating|cannot-judge',
          'cannot-judge-reason|outside-my-expertise', 'cannot-judge-reason|insufficient-information', 'cannot-judge-reason|other', 'cannot-judge-reason|other-text', 'concerns|no-concerns', 'concerns|other-text', 'note'].map(t => `${p.code}|${t}`);
        const miss = need.filter(t => !tags.has(t)); if (miss.length) formBadB.push(`${p.code}: ${miss.map(t => t.split('|').slice(1).join('|')).join(', ')}`);
      }
      if ([...tags].some(t => !c.proposals.some(p => t.startsWith(`${p.code}|`)))) formBadB.push(`${code}: a field outside the proposals`);
    }
  }
  check('part B', `Part B: ${bCourses.length} course forms holding all ${seenB.length} proposals, each once, numbered and in the order of the case records`, seenB.length === 160 && new Set(seenB).size === 160 && sameJson(seenB, proposals.map(p => p.code)) && !formBadB.some(x => /cases or order|headings/.test(x)), few(formBadB));
  check('part B', 'Part B: the case texts and every proposed text equal the records exactly', !textBadB.length, few(textBadB));
  check('part B', 'Part B: every proposal can be rated "Cannot judge" with a reason (outside my expertise, insufficient information, other) and has "No concerns", a note field and, for a re-mapping, a target field', !formBadB.length, few(formBadB));

  // ---- response sheets ----
  const csvBad = [];
  for (const cc of courses) {
    const rows = parseCsv(text(`${A_DIR}/${cc}/${cc}-part-a-responses.csv`)), head = rows[0], body = rows.slice(1), mine = C.cases.filter(c => CC(c) === cc);
    const k = mine[0].course, at = name => head.findIndex(h => h.startsWith(name));
    const cols = ['reviewer_code', 'date_returned', 'case_code', 'course', 'relationship', 'within_expertise', 'alignment', 'which_listed_outcomes_fit', 'rationale', 'reading_applied', 'reading_other', 'belongs_in_course (',
      'belongs_in_course_note', 'course_fit_affected_alignment', 'recommendation (', 're-map_target', 'recommendation_other', 'bloom_source', 'bloom_target', 'confidence', 'comments'];
    if (cols.some(n => at(n) < 0) || head.length !== cols.length || !/Insufficient information/.test(head[at('alignment')]) || !/outside my expertise/.test(head[at('within_expertise')])) csvBad.push(`${cc} Part A: columns`);
    if (body.length !== mine.length || body.some((r, n) => r.length !== head.length || r[at('case_code')] !== mine[n].code || r[at('relationship')] !== TITLE[mine[n].type]
      || !r[at('course')].startsWith(`${k.code} ${k.title} (${k.program}`) || r.some((v, j) => ![at('case_code'), at('course'), at('relationship')].includes(j) && v !== ''))) csvBad.push(`${cc} Part A: rows`);
  }
  for (const cc of bCourses) {
    const rows = parseCsv(text(`${B_DIR}/${cc}/${cc}-part-b-responses.csv`)), head = rows[0], body = rows.slice(1), mine = proposals.filter(p => CC(p.c) === cc);
    const at = name => head.findIndex(h => h.startsWith(name));
    if (!/Cannot judge/.test(head[at('rating')] || '') || at('cannot_judge_reason') < 0 || at('proposal_text') < 0 || at('proposal_code') < 0) csvBad.push(`${cc} Part B: columns`);
    if (body.length !== mine.length || body.some((r, n) => r[at('proposal_code')] !== mine[n].code || r[at('case_code')] !== mine[n].c.code
      || (mine[n].kind === 'rewrite' ? r[at('proposal_text')] !== mine[n].text : !/^keep the text; /.test(r[at('proposal_text')]))
      || r.some((v, j) => ![at('case_code'), at('proposal_code'), at('proposal_type'), at('proposal_text')].includes(j) && v !== ''))) csvBad.push(`${cc} Part B: rows`);
  }
  check('sheets', 'response sheets: one row per case (Part A) or per proposal (Part B) of the course, in form order, with the texts of the forms and every answer column blank', !csvBad.length, few(csvBad));
  const dec = parseCsv(text(`${P_DIR}/decision-and-approval-record.csv`)), decIds = dec.slice(1).map(r => r[0]);
  const wantIds = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', ...Array.from({ length: 15 }, (_, n) => `I${n + 1}`)];
  check('sheets', 'decision-and-approval-record.csv: one row for each of P1-P7 and I1-I15, every decision, approver, reference and date blank', sameJson(decIds, wantIds) && dec.slice(1).every(r => r.slice(3).every(v => v === '')));
  const tpl = n => parseCsv(text(`${C_DIR}/templates/${n}`));
  const track = tpl('reviewer-tracking.csv'), agree = tpl('part-a-agreement-record.csv'), ratings = tpl('part-b-ratings-record.csv'), adj = tpl('adjudication-record.csv'), reas = tpl('reassignment-log.csv');
  check('sheets', 'coordinator templates: 14 reviewer slots, 58 agreement rows (all Pending), 160 rating rows, empty adjudication and reassignment logs; no judgment, decision or name filled in',
    track.length === 15 && track.slice(1).every(r => r.slice(2).every((v, j) => v === '' || (j === 5 && v === 'no Part B for this course')))
    && agree.length === 59 && sameJson(agree.slice(1).map(r => r[0]), C.cases.map(c => c.code)) && agree.slice(1).every(r => r.slice(3).every((v, j, all) => (j === all.length - 2 ? v === 'Pending' : v === '')))
    && ratings.length === 161 && sameJson(ratings.slice(1).map(r => r[1]), proposals.map(p => p.code)) && ratings.slice(1).every(r => r.slice(3).every(v => v === ''))
    && adj.length === 1 && reas.length === 1);

  // ======================= 8. references =======================
  const REFS = `${A_DIR}/02-curriculum-and-institutional-references.docx`, R = DOCS.get(REFS);
  check('references', 'the Part A copy and the policy panel copy of the references are the same document', R && DOCS.get(`${P_DIR}/04-curriculum-and-institutional-references.docx`)
    && R.doc === DOCS.get(`${P_DIR}/04-curriculum-and-institutional-references.docx`).doc);
  const rsec = Object.fromEntries(sections(R, 'Heading2', /^R-[A-Z]+ · /).map(s => [s.head.text.split(' · ')[0], s]));
  check('references', 'sections R-CASES, R-CODES, R-INST, R-EGA, R-VAL, R-BSIT, R-BSIE and R-NONE, in that order', sameJson(Object.keys(rsec), ['R-CASES', 'R-CODES', 'R-INST', 'R-EGA', 'R-VAL', 'R-BSIT', 'R-BSIE', 'R-NONE']));
  const statusOf = s => s.paras.filter(p => /^Status: /.test(p.text)).map(p => p.text);
  const WANT_STATUS = { 'R-CASES': ['synthetic'], 'R-INST': ['transcribed'], 'R-EGA': ['transcribed'], 'R-VAL': ['website'], 'R-BSIT': ['transcribed', 'transcribed', 'transcribed', 'transcribed'], 'R-BSIE': ['transcribed', 'transcribed'], 'R-NONE': ['none'] };
  const statusBad = Object.entries(WANT_STATUS).filter(([k, want]) => !rsec[k] || !sameJson(statusOf(rsec[k]).map(t => t.split('.')[0].replace(/^Status: /, '')), want.map(w => STATUS[w]))).map(([k]) => k);
  check('references', 'every institutional reference states its status with the right label (synthetic, transcribed, website copy or not held)', !statusBad.length, few(statusBad));
  const labelTable = tableWithHead(R, ['Label', 'What it means']);
  check('references', 'the four status labels are defined in the references and in the Part A guide', labelTable && sameJson(labelTable.slice(1).map(r => r[0]), Object.values(STATUS))
    && tableWithHead(DOCS.get(`${A_DIR}/01-reviewer-guide-part-a.docx`), ['Label', 'What it means']));
  const codesTable = tableWithHead(R, ['Course in the forms', 'Program and year in the forms', 'In the curricula transcribed in the system', 'Status']);
  const codeBad = [];
  for (const [key, course] of Object.entries(D.courses).filter(([key]) => COURSE_CODE[key])) {
    const row = codesTable && codesTable.find(r => r[0] === `${course.code} ${course.title}`);
    const found = CURR.programs.flatMap(p => p.terms.flatMap(t => t.rows).filter(r => codeKey(r.code) === codeKey(course.code)).map(r => ({ p, r })));
    const held = CURR.programs.some(p => p.code === course.program);
    const ok = row && (found.length ? found.every(({ p, r }) => row[2].includes(`${p.code} ${p.curriculumYear}: ${r.code} ${r.title}`)) && row[3] === STATUS.transcribed
      : held ? /^Not found\./.test(row[2]) && row[3] === STATUS.none : /cannot be checked/.test(row[2]) && row[3] === STATUS.none);
    if (!ok) codeBad.push(course.code);
    note('references', `R-CODES ${course.code} ${course.title} (${course.program}): ${found.length ? `found in ${found.map(({ p, r }) => `${p.code} ${p.curriculumYear} as "${r.code} ${r.title}"`).join(' and ')}` : held ? `not in the ${course.program} curriculum held` : `no ${course.program} curriculum held; cannot be checked`}`);
  }
  check('references', 'R-CODES: every course code in the forms checked against every curriculum transcribed in the system, with the right result and status', codesTable && codesTable.length === 8 && !codeBad.length, few(codeBad));
  const row2 = t => (t || []).slice(1).map(r => r.slice(0, 2));
  const valT = tableWithHead(R, ['Value', 'Definition (website wording, not confirmed for this use)']);
  check('references', 'R-VAL: the six core values with their exact definitions, labelled website copy pending approval', VALS.values.length === 6 && valT && sameJson(row2(valT), VALS.values.map(v => [v.name, v.definition])));
  const egaT = tableWithHead(R, ['No.', 'Name', 'Short name']);
  check('references', 'R-EGA: the four attribute names and short names as held, stated as names only', egaT && sameJson(egaT.slice(1), SEED.INSTITUTION.egas.map(e => [String(e.no), e.name, e.short])) && /names only/.test(rsec['R-EGA'].paras.map(p => p.text).join(' ')));
  const bsitT = tableWithHead(R, ['PO', 'Outcome', 'Mapped to EGA (not confirmed)']), poTables = R.tables.filter(t => sameJson(t[0], ['PO', 'Outcome']));
  check('references', 'R-BSIT and R-BSIE: the system\'s 10 BSIT outcomes (with the EGA caveat), the 9 IT 202 outcomes and the 13 BSIE outcomes reproduced exactly, with the source notes',
    bsitT && sameJson(row2(bsitT), SEED.PROGRAMS.BSIT.pos.map(p => [String(p.no), p.text])) && poTables.length === 2
    && sameJson(row2(poTables[0]), OUTC.sources.BSIT.pos.map(p => [String(p.no), p.text])) && sameJson(row2(poTables[1]), OUTC.sources.BSIE.pos.map(p => [String(p.no), p.text]))
    && OUTC.sources.BSIE.warnings.every(w => R.all.includes(w)) && /not an approved mapping/.test(rsec['R-BSIT'].paras.map(p => p.text).join(' ')));
  const currT = R.tables.filter(t => sameJson(t[0], ['Year', 'Semester', 'Code', 'Title', 'Lec', 'Lab', 'Prerequisite as printed']));
  const currRows = code => CURR.programs.find(p => p.code === code).terms.flatMap(t => t.rows.map(r => [String(t.yearLevel), t.semester, r.code, r.title]));
  check('references', 'curriculum tables: every transcribed BSIT and BSIE row reproduced (year, semester, code, title)', currT.length === 2
    && sameJson(currT[0].slice(1).map(r => r.slice(0, 4)), currRows('BSIT')) && sameJson(currT[1].slice(1).map(r => r.slice(0, 4)), currRows('BSIE')), `${currT.map(t => t.length - 1).join(' and ')} rows`);
  const I = SEED.INSTITUTION;
  check('references', 'R-INST: the vision and mission reproduced exactly', [I.vision, I.mission.lead, ...I.mission.items.map(m => `– ${m}`)].every(t => R.paras.some(p => p.text === t)));
  const it204 = SEED.COURSES.find(c => c.code === 'IT 204');
  check('references', 'R-BSIT: the IT 204 template\'s CLO statements reproduced exactly, its level labels marked as undefined in the system', it204.clos.every(k => R.all.includes(k.statement)) && /does not define the level labels/.test(R.all));
  const CLAIMS = [/codes and titles are the institution's/i, /institution's four EGAs/i, /official names/i, /official outcomes the system holds/i, /BSIE places MA 7/i, /\b(BSIE|BSIT) \d{4}-\d{4} curriculum: /, /registrar curriculum lists/i, /approved curriculum (lists|places|shows)/i];
  const distributed = docxFiles.filter(f => !f.startsWith(`${C_DIR}/`));
  const claimHits = distributed.filter(f => CLAIMS.some(re => re.test(DOCS.get(f).all)));
  check('references', 'no distributed document presents a transcription or the synthetic cases as the institution\'s approved curriculum or official outcomes (Version 1\'s claims are gone)', !claimHits.length, few(claimHits));
  const noteSentences = sentences(VALS.approvalNote);
  check('references', 'the core-values entry no longer quotes the source file\'s approval note', !distributed.some(f => noteSentences.some(s => DOCS.get(f).all.includes(s))));

  // ======================= 9. policy questions, decisions and procedure =======================
  const POL = DOCS.get(`${P_DIR}/01-academic-policy-questions.docx`), DEC = DOCS.get(`${P_DIR}/02-institutional-decisions-and-approvals.docx`), PROC = DOCS.get(`${P_DIR}/03-adjudication-procedure.docx`);
  const qs = sections(POL, 'Heading2', /^P[1-7]\. /);
  check('policy', 'seven policy questions, P1 to P7, each phrased as an open question', sameJson(qs.map(s => s.head.text.slice(0, 2)), ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']) && qs.every(s => s.head.text.trim().endsWith('?')));
  const optTables = POL.tables.filter(t => sameJson(t[0], ['Option', 'What it says', 'What it would mean in practice']));
  check('policy', 'options listed "in no order of preference", none recommended, each with a "what it would mean in practice" line, each table ending with an open option D', /The options are listed in no order of preference\. None is recommended\./.test(POL.all)
    && optTables.length === 4 && optTables.every(t => t.slice(1).every(r => r.length === 3 && r.every(Boolean)) && t[t.length - 1][0] === 'D. Other'));
  const SLANT = [/contribute meaningfully/i, /easy to confuse/i, /can cover a broad PO completely even if no single CLO covers all of it/i, /consistent with options? A and C/i, /may already be practice/i,
    /smaller step/i, /genuine step/i, /bears on P1, option C/i, /\brecommended option\b/i, /\bwe recommend\b/i, /\bpreferred\b/i];
  const slant = [POL, DEC, PROC].filter(d => SLANT.some(re => re.test(d.all))).map(d => d.paras[0].text);
  check('policy', 'Version 1\'s leading wording is gone from the policy documents', !slant.length, few(slant));
  const records = POL.tables.filter(t => t[0][0] === 'Decision record');
  check('policy', 'a blank decision record under each question (decision, rationale, role, approval reference, date, programs)', records.length === 7
    && records.every(t => sameJson(t.slice(1).map(r => r[0]), ['Decision (option, with any wording)', 'Rationale', 'Decided by (role)', 'Approval reference (minutes, memo or resolution)', 'Date', 'Applies to (programs)'])
      && t.slice(1).every(r => r[1].trim() === '')));
  check('policy', '"Cases affected" gives a count only; the case lists are held by the coordinator until Part A is returned', qs.every(s => s.paras.some(p => /^Cases affected: \d+\. The coordinator holds the list/.test(p.text))));
  const decT = tableWithHead(DEC, ['ID', 'Decision', 'Why it is needed', 'Who decides (role)', 'Needed before']);
  const decRow = id => decT && decT.find(r => r[0] === id);
  check('decisions', 'decisions P1-P7 and I1-I15, each with its reason, deciding role and the step it gates; I12 and I15 (ethics clearance or consent) needed before sending',
    decT && sameJson(decT.slice(1).map(r => r[0]), ['P1–P7', ...wantIds.slice(7)]) && decT.slice(1).every(r => r.every(Boolean))
    && /before Part A is sent/.test(decRow('I12')[4]) && /ethics/i.test(decRow('I15')[1]) && /before Part A is sent/.test(decRow('I15')[4]) && /EGA/.test(decRow('I6')[1]));
  check('decisions', 'approval requirements: nothing approved, what an approval record holds, what does not count as approval, and the gates', /Nothing in this package is approved\./.test(DEC.all)
    && /What an approval record contains\./.test(DEC.all) && /What does not count as approval:/.test(DEC.all) && tableWithHead(DEC, ['Gate', 'Decisions recorded first']));
  const procHeads = PROC.paras.filter(p => p.style === 'Heading2').map(p => p.text);
  check('procedure', 'procedure: sections 1-11, with special answers (5) and handling disagreement (6) as tables', sameJson(procHeads.map(h => h.split('.')[0]), Array.from({ length: 11 }, (_, n) => String(n + 1)))
    && procHeads[4] === '5. Special answers' && procHeads[5] === '6. Handling disagreement'
    && tableWithHead(PROC, ['Answer', 'What happens', 'Counted as a judgment?']) && tableWithHead(PROC, ['Situation', 'Action', 'Recorded as']) && /A disagreement is never settled by the software's answer/.test(PROC.all));

  // ======================= 10. PDFs =======================
  const pdfjs = await loadPdfjs();
  const distributedDocx = docxFiles.filter(f => !f.startsWith(`${C_DIR}/`));
  const pdfOf = new Map(PDFS.map(e => [e.fromPath, e]));
  const stale = distributedDocx.filter(f => !pdfOf.has(f) || pdfOf.get(f).fromSha256 !== sha(inPkg(f)) || pdfOf.get(f).path !== f.replace(/\.docx$/, '.pdf') || pdfOf.get(f).audience !== listed.get(f).audience);
  check('pdf', `every distributed Word file has a PDF made from its current version (${PDFS.length} PDFs)`, PDFS.length === distributedDocx.length && !stale.length, few(stale));
  const PDF_TEXT = new Map();
  if (!pdfjs) check('pdf', 'the PDFs can be read (pdfjs-dist in server/node_modules)', false, 'pdfjs-dist not found');
  else {
    const pdfBad = [], metaBad = [], onePage = [];
    for (const e of PDFS.filter(x => onDisk.includes(x.path))) {
      const p = await readPdf(pdfjs, e.path), d = DOCS.get(e.fromPath);
      const body = p.pages.map((t, n) => { const s = squash(t), foot = squash(`${d.footerPrefix}${n + 1} of ${p.pages.length}`); const at = s.indexOf(foot); return at < 0 ? s : s.slice(0, at) + s.slice(at + foot.length); });
      PDF_TEXT.set(e.path, { spaced: p.pages.join('\n'), squashed: body.join(''), meta: JSON.stringify(p.info) + p.xmp });
      const all = body.join(''), lost = d.paras.map(x => squash(x.text)).filter(s => s && !all.includes(s));
      if (p.pages.length !== e.pages || lost.length || body.length !== p.pages.length) pdfBad.push(`${e.path}${lost.length ? ` (${lost.length} paragraphs not found)` : ''}`);
      if (p.info.Author !== CREATOR || ws(p.info.Title || '') !== d.paras.find(x => x.style === 'Heading1').text || p.info.Subject || p.info.Keywords) metaBad.push(e.path);
      if (/part-a-form\.pdf$/.test(e.path)) {
        const codes = C.cases.filter(c => e.path.includes(`/${CC(c)}/`)).map(c => c.code);
        const starts = body.filter(s => codes.some(code => s.startsWith(squash(`${code} · `)))).length;
        onePage.push([e.path.split('/')[1], codes.length, starts, p.pages.length]);
      }
    }
    check('pdf', 'each PDF has the page count recorded, and every paragraph of its Word file appears in its text', !pdfBad.length, few(pdfBad));
    check('pdf', `PDF properties: author "${CREATOR}", title equal to the document's heading, no subject or keywords`, !metaBad.length, few(metaBad));
    const fits = onePage.reduce((s, [, n, starts, pages]) => s + (starts === n && pages === n + 1 ? n : 0), 0);
    note('pdf', `Part A layout: ${fits} of 58 cases start their own page with no overflow page (${onePage.map(([cc, n, , pages]) => `${cc} ${pages} pages for ${n} cases`).join(', ')})`);
  }

  // ======================= 11. blinding and separation =======================
  // every distributed file is scanned as reviewers or the panel would receive it: the Word text, its fields and properties, the PDF text and
  // properties, the response sheets and the file names; the coordinator's Markdown copies of the same documents are scanned too
  const reviewerFiles = onDisk.filter(f => f.startsWith(`${A_DIR}/`) || f.startsWith(`${B_DIR}/`)), panelFiles = onDisk.filter(f => f.startsWith(`${P_DIR}/`));
  const views = f => {
    const out = [f];
    if (f.endsWith('.docx')) { const d = DOCS.get(f); out.push(d.all, d.sdts.map(s => `${s.tag} ${s.alias}`).join('\n'), d.xml('docProps/core.xml'), d.xml('docProps/app.xml'), d.footerPrefix); }
    else if (f.endsWith('.pdf')) { const p = PDF_TEXT.get(f); if (p) out.push(p.spaced, p.meta); }
    else out.push(text(f));
    return out.join('\n');
  };
  const mirrorsOf = files => files.filter(f => f.endsWith('.docx')).map(f => `${MIRROR}/${f.replace(/\.docx$/, '.md')}`);
  const groups = { reviewers: [...reviewerFiles, ...mirrorsOf(reviewerFiles)], panel: [...panelFiles, ...mirrorsOf(panelFiles)], index: ['README.md'] };
  const corpus = Object.fromEntries(Object.entries(groups).map(([g, files]) => [g, files.map(f => [f, f.startsWith(`${MIRROR}/`) ? text(f) : views(f)])]));
  const scan = (name, re, gs) => { const hits = gs.flatMap(g => corpus[g].filter(([, t]) => re.test(t)).map(([f]) => `${f}: "${(t => t.match(re)[0])(corpus[g].find(([x]) => x === f)[1])}"`)); check('blinding', name, !hits.length, few(hits, 4)); };
  scan('no AI model or provider name (Claude, Sonnet, Opus, Haiku, Anthropic, MiniMax, OpenRouter, Gemini, OpenAI, GPT and others), and no "assistant"',
    /claude|sonnet|\bopus\b|haiku|anthropic|gemini|minimax|openrouter|openai|\bgpt\b|llama|mistral|deepseek|\bqwen\b|assistant/i, ['reviewers', 'panel', 'index']);
  scan('no mention of AI or language models', /\bAI\b|artificial intelligence|language model|\bLLMs?\b|chatbot|machine learning/i, ['reviewers', 'panel', 'index']);
  scan('no evaluation-arm names (A1-A3, B1-B3) and no run numbers', /\b(A1|A2|A3|B1|B2|B3)\b|\bruns? [12]\b/, ['reviewers', 'panel', 'index']);
  const idRe = new RegExp(`(${dev.map(i => escRe(i.id)).join('|')})(?![a-z0-9-])|\\b(d-(po|ilo|ega|any)|clo-(po|ega)|ilo-clo)-[a-z0-9]`);
  scan('no dataset case ids', idRe, ['reviewers', 'panel', 'index']);
  scan('no machine labels or remedy codes', /\b(ALIGNED|PARTIALLY_ALIGNED|NOT_ALIGNED|INSUFFICIENT_EVIDENCE|REWRITE_TEXT|RETAG_OUTCOME|NO_CHANGE|REVIEW_REQUIRED)\b/, ['reviewers', 'panel', 'index']);
  scan('reviewer bundles: no developer-written or provisional verdicts, expected or accepted answers, or "ambiguous"', /provisional|developer|expected (verdict|answer|label)|accepted (label|answer|verdict)s?|\bambiguous\b/i, ['reviewers']);
  scan('reviewer bundles: no evaluation vocabulary (align-1, eval-1.1, held-out, dataset, prompt)', /\balign-1\b|eval-1\.1|held-out|\bdataset\b|\bprompts?\b/i, ['reviewers']);
  scan('no set membership or dispute language', /\bSet [123]\b|disput|false (rejection|approval)|disagreement inventory/i, ['reviewers', 'panel', 'index']);
  scan('no reference to a coordinator file', /coordinator-restricted|coordinator\/|cases\.json|blinding-key|case-inventory|recommendation-quality|policy-question-case-map|changes-from-v1|distributed-text|reviewer-tracking|reassignment-log|agreement-record|adjudication-record|ratings-record/, ['reviewers', 'panel']);
  const cats = [...new Set(dev.map(i => i.category))];
  scan(`no dataset category names (${cats.length})`, new RegExp(`\\b(${cats.map(escRe).join('|')})\\b`), ['reviewers', 'panel', 'index']);
  scan('the policy panel\'s documents name no case (case codes appear only in the reviewer forms and the coordinator\'s files)', CODE_RE, ['panel', 'index']);
  const reviewerOnly = corpus.reviewers.filter(([f]) => f.startsWith(`${A_DIR}/`) || f.startsWith(`${MIRROR}/${A_DIR}/`));
  check('separation', 'the Part A bundle holds no Part B proposal and no Part B rating question', !reviewerOnly.some(([, t]) => /Proposed rewrite|Proposed re-mapping|Proposed text|Appropriate as written|Acceptable with edits/.test(t)));
  check('separation', 'the Part A guide mentions Part B only as a later, separate package', /Part B, later\./.test(DOCS.get(`${A_DIR}/01-reviewer-guide-part-a.docx`).all) && !/Cannot judge/.test(DOCS.get(`${A_DIR}/01-reviewer-guide-part-a.docx`).all));
  check('separation', 'the Part B guide and every Part B form say to open them only after returning Part A', [`${B_DIR}/01-reviewer-guide-part-b.docx`, ...bCourses.map(cc => `${B_DIR}/${cc}/${cc}-part-b-form.docx`)].every(f => DOCS.get(f).all.includes('Open this only after you have returned Part A.')));
  check('separation', 'the policy panel\'s documents hold no reviewer form and no proposal', !corpus.panel.some(([, t]) => /Is this case within your expertise|Proposed rewrite|Proposed re-mapping/.test(t)));
  for (const [f, t] of corpus.panel.filter(([, x]) => /provisional|developer/i.test(x))) note('blinding', `${f} mentions provisional or developer-written verdicts as a category (no verdict given): ${(t.match(/provisional|developer/gi) || []).length} times`);
  // texts that must never reach reviewers or the panel: the developer's rationale, the software's explanations, the pre-registered notes
  const distributedText = [...corpus.reviewers, ...corpus.panel, ...corpus.index].map(([f, t]) => [f, ws(t)]);
  const hitsOf = list => distributedText.filter(([, t]) => list.some(s => t.includes(s))).map(([f]) => f);
  check('blinding', 'no sentence of the developer\'s rationale for any case', !hitsOf(dev.flatMap(i => sentences(i.why))).length, few(hitsOf(dev.flatMap(i => sentences(i.why)))));
  const expl = dev.flatMap(i => runsOf(i.id).flatMap(x => sentences(x.r.explanation)));
  check('blinding', 'no sentence of any A2 or B2 explanation', !hitsOf(expl).length, few(hitsOf(expl)));
  const notes = [...PRE.remapCandidates.map(r => r.reason), ...PRE.levelGap.map(r => r.note)].flatMap(sentences);
  check('blinding', 'no pre-registered developer note', !hitsOf(notes).length, few(hitsOf(notes)));
  const caseTexts = new Set(dev.flatMap(i => [ws(i.source), ws(i.target)]));
  const drafts = proposals.filter(p => p.kind === 'rewrite').map(p => ws(p.text)), sameAsCase = proposals.filter(p => p.kind === 'rewrite' && caseTexts.has(ws(p.text))).map(p => p.code);
  const draftHits = distributedText.filter(([f]) => !f.includes(B_DIR)).filter(([, t]) => drafts.some(dr => !caseTexts.has(dr) && t.includes(dr))).map(([f]) => f);
  check('blinding', 'no proposed text outside Part B (Part A, the references, the policy documents and the index hold none)', !draftHits.length, few(draftHits));
  if (sameAsCase.length) note('blinding', `proposals whose text repeats a case text word for word, so the words also appear in Part A as that case: ${sameAsCase.join(', ')}`);
  const egaNames = new Set(SEED.INSTITUTION.egas.flatMap(e => [ws(e.name), ws(e.short)]));
  const panelCaseHits = corpus.panel.filter(([f]) => !/04-curriculum-and-institutional-references/.test(f)).filter(([, t]) => [...caseTexts].some(ct => ct.length >= 25 && !egaNames.has(ct) && ws(t).includes(ct))).map(([f]) => f);
  check('blinding', 'the policy questions, decisions and procedure quote no case text', !panelCaseHits.length, few(panelCaseHits));
  const user = [os.userInfo().username, process.env.USERNAME].filter(u => u && u.length >= 3);
  const userHits = onDisk.filter(f => !f.endsWith('.pdf') && user.some(u => fs.readFileSync(inPkg(f), 'utf8').toLowerCase().includes(u.toLowerCase())))
    .concat([...PDF_TEXT].filter(([, p]) => user.some(u => p.meta.toLowerCase().includes(u.toLowerCase()) || p.spaced.toLowerCase().includes(u.toLowerCase()))).map(([f]) => f));
  check('blinding', 'the computer account name of whoever built the package appears in no file, document property or PDF property', !userHits.length, few(userHits));
  const README = text('README.md');
  check('blinding', 'README.md is a neutral index: no arms, sets, verdicts, model names, case codes or case counts by set', !/\b(A1|A2|B2)\b|\bSet [123]\b|provisional|ALIGNED|claude|minimax|anthropic/i.test(README) && !CODE_RE.test(README));

  // ======================= 12. rebuild =======================
  if (process.argv.includes('--no-rebuild')) note('rebuild', 'skipped (--no-rebuild)');
  else {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'align1-v2-verify-'));
    try {
      const run = spawnSync(process.execPath, [...process.execArgv, GENERATOR, '--out', tmp, '--prereg', PREREG], { encoding: 'utf8', timeout: 5 * 60 * 1000, windowsHide: true });
      const rebuilt = run.status === 0 ? listAll(tmp).map(f => path.relative(tmp, f).split(path.sep).join('/')).sort() : [];
      const mine = onDisk.filter(f => !f.endsWith('.pdf'));
      const differ = mine.filter(f => f !== 'package-manifest.json' && (!rebuilt.includes(f) || !fs.readFileSync(path.join(tmp, f)).equals(fs.readFileSync(inPkg(f)))));
      const extra = rebuilt.filter(f => !mine.includes(f));
      const mfA = { ...M, pdf: undefined }, mfB = run.status === 0 ? { ...readJson(path.join(tmp, 'package-manifest.json')), pdf: undefined } : null;
      check('rebuild', `a fresh build from the same sources reproduces all ${mine.length - 1} .docx, .md, .csv and .json files byte for byte, and the manifest apart from its PDF list`,
        run.status === 0 && !differ.length && !extra.length && sameJson(mfA, mfB), run.status !== 0 ? `generator exit ${run.status}: ${String(run.stdout || '').trim().split('\n').pop()}` : few([...differ, ...extra.map(f => `extra: ${f}`)]));
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
