'use strict';
// Offline tests of the faculty response importer (scripts/import-align1-faculty-responses.cjs), with SYNTHETIC returns only:
//   node scripts/import-align1-faculty-responses.test.cjs
// It is not part of npm test. Every return is made in a temporary folder from a copy of a blank Version 2 form or sheet; every
// reviewer code begins with SYNTH- and every written answer with "SYNTHETIC TEST RESPONSE", so nothing here is a faculty judgment.
// The package is only read, and each test removes its temporary folder when it ends. Tests 1-18 follow the resumption handoff's list.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto'), zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');
const I = require('./import-align1-faculty-responses.cjs');

const SCRIPT = path.join(__dirname, 'import-align1-faculty-responses.cjs'), REPO = path.resolve(__dirname, '..');
const V1 = path.join(REPO, 'docs', 'faculty-review', 'align-1-dev-adjudication');
const S = 'SYNTHETIC TEST RESPONSE', NOW = '2026-11-10T00:00:00.000Z';
const pkg = I.loadPackage();
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const itemOf = code => pkg.cases.get(code) || pkg.proposals.get(code);
const questionsOf = code => { const it = itemOf(code); return it.kind ? I.questionsB(it.type, it.kind) : I.questionsA(it.type); };
const opt = (code, q, label) => questionsOf(code).find(x => x.q === q).options.find(o => o.label.startsWith(label)).key;

// ---- zip archives, read and written here so that a test can build any archive, broken ones included
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const readZip = buf => {
  let e = buf.length - 22; while (buf.readUInt32LE(e) !== 0x06054b50) e--;
  const out = []; let p = buf.readUInt32LE(e + 16);
  for (let k = 0, n = buf.readUInt16LE(e + 10); k < n; k++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), at = buf.readUInt32LE(p + 42), name = buf.toString('utf8', p + 46, p + 46 + nl);
    const start = at + 30 + buf.readUInt16LE(at + 26) + buf.readUInt16LE(at + 28), raw = buf.subarray(start, start + csize);
    out.push([name, Buffer.from(method === 8 ? zlib.inflateRawSync(raw) : raw)]);
    p += 46 + nl + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return out;
};
// patch(name, local, central) may change a header after it is filled in: a flag, the method or a size.
const writeZip = (entries, { deflate = false, patch = null } = {}) => {
  const locals = [], centrals = []; let offset = 0;
  for (const [name, data] of entries) {
    const n = Buffer.from(name), body = deflate ? zlib.deflateRawSync(data) : data, method = deflate ? 8 : 0, crc = crc32(data), lh = Buffer.alloc(30), ch = Buffer.alloc(46);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(method, 8); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(n.length, 26);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(method, 10); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(offset, 42);
    if (patch) patch(name, lh, ch);
    locals.push(lh, n, body); centrals.push(ch, n); offset += 30 + n.length + body.length;
  }
  const cd = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
};

// ---- returns made from the blank forms and sheets. Answers are given per item as { question: option key, list of keys or text };
// "question|other-text" is the text written beside "Other".
const blankPath = (course, part, kind) => path.join(I.DEFAULT_PKG, part === 'A' ? '1-part-a-for-reviewers' : '2-part-b-for-reviewers', course,
  `${course}-part-${part.toLowerCase()}-${kind === 'docx' ? 'form.docx' : 'responses.csv'}`);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Ticks a box as Word does (w14:checked and the glyph) and fills a text control (placeholder off; a line break is a <w:br/>).
const fillXml = (xml, fill) => xml.replace(/<w:sdt>[\s\S]*?<\/w:sdt>/g, sdt => {
  const tag = (sdt.match(/<w:tag w:val="([^"]*)"\/>/) || [])[1];
  if (!tag) return sdt;
  if (sdt.includes('<w14:checkbox>')) {
    const k = tag.lastIndexOf('|'), want = fill[tag.slice(0, k)];
    return want !== undefined && [].concat(want).includes(tag.slice(k + 1)) ? sdt.replace('<w14:checked w14:val="0"/>', '<w14:checked w14:val="1"/>').replace('<w:t>☐</w:t>', '<w:t>☒</w:t>') : sdt;
  }
  const want = fill[tag];
  if (want === undefined || want === '') return sdt;
  const text = String(want).split('\n').map(esc).join('</w:t></w:r><w:r><w:br/><w:t xml:space="preserve">');
  return sdt.replace('<w:showingPlcHdr/>', '').replace(/<w:sdtContent>[\s\S]*<\/w:sdtContent>/, `<w:sdtContent><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:sdtContent>`);
});
// What Word adds when it saves: revision ids, paragraph ids, runs split mid-word, proofing marks, a bookmark, compression. Word also
// rewrites a style's id from its name, so the "Case text" style's id CaseText becomes Casetext (seen in a form Word 16 saved).
const wordish = xml => {
  let n = 0;
  return xml.replace(/<w:p>/g, () => `<w:p w:rsidR="00A1${String(++n).padStart(4, '0')}" w:rsidRDefault="00A10000" w14:paraId="${(0x10000000 + n).toString(16).toUpperCase()}" w14:textId="77777777">`)
    .replace(/<w:r>/g, '<w:r w:rsidRPr="00B2C3D4">')
    .replace(/<w:t xml:space="preserve">([^<&]{12,})<\/w:t>/g, (m, t) => { const h = Math.floor(t.length / 2); return `<w:t xml:space="preserve">${t.slice(0, h)}</w:t></w:r><w:proofErr w:type="spellStart"/><w:r w:rsidR="00C3D4E5"><w:t xml:space="preserve">${t.slice(h)}</w:t>`; })
    .replace('<w:body>', '<w:body><w:bookmarkStart w:id="0" w:name="_GoBack"/><w:bookmarkEnd w:id="0"/>')
    .replace(/<w:pStyle w:val="CaseText"\s*\/>/g, '<w:pStyle w:val="Casetext"/>');
};
const wordStyles = xml => xml.replace(/w:styleId="CaseText"/g, 'w:styleId="Casetext"');
const docx = (course, part, header, items = {}, { word = false, edit = x => x, extra = [] } = {}) => {
  const fill = { 'header|reviewer-code': header.code ?? '', 'header|date-returned': header.date ?? '', 'header|part-a-returned': header.partA ?? '' };
  for (const [code, ans] of Object.entries(items)) for (const [q, v] of Object.entries(ans)) fill[`${code}|${q}`] = v;
  const entries = readZip(fs.readFileSync(blankPath(course, part, 'docx')));
  const doc = entries.map(([n, d]) => [n, n === 'word/document.xml' ? Buffer.from(edit((word ? wordish : x => x)(fillXml(d.toString('utf8'), fill))), 'utf8')
    : word && n === 'word/styles.xml' ? Buffer.from(wordStyles(d.toString('utf8')), 'utf8') : d]);
  return writeZip([...doc, ...extra], { deflate: word });
};
const docXml = buf => readZip(buf).find(([n]) => n === 'word/document.xml')[1].toString('utf8');
const withDocXml = (buf, fn) => writeZip(readZip(buf).map(([n, d]) => [n, n === 'word/document.xml' ? Buffer.from(fn(d.toString('utf8')), 'utf8') : d]));
// A sheet's cells for one item's answers, written as a reviewer would: option labels, "Other: ..." where no "other" column exists.
const csvCells = (code, ans) => {
  const cells = {};
  for (const q of questionsOf(code)) {
    const v = ans[q.q], other = ans[`${q.q}|other-text`];
    if (v === undefined && other === undefined) continue;
    if (q.kind === 'text') { cells[q.csv] = v; continue; }
    if (v && typeof v === 'object' && !Array.isArray(v)) cells[q.csv] = v.raw; // { raw } is written as it stands
    else cells[q.csv] = [].concat(v ?? []).map(k => (k === 'other' ? (q.otherCsv || other === undefined ? 'Other' : `Other: ${other}`) : q.options.find(o => o.key === k).label)).join('; ');
    if (other !== undefined && q.otherCsv) cells[q.otherCsv] = other;
  }
  return cells;
};
const CP1252 = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e,
  '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f };
const cp1252 = text => Buffer.from([...text].map(ch => CP1252[ch] ?? (ch.codePointAt(0) < 256 ? ch.codePointAt(0) : 0x3f)));
const csv = (course, part, header, items = {}, { encoding = 'utf8-bom', delim = ',', only = false, edit = rows => rows } = {}) => {
  const rows = I.parseCsv(fs.readFileSync(blankPath(course, part, 'csv'), 'utf8').replace(/^\uFEFF/, ''));
  const head = rows[0], at = part === 'A' ? 2 : 3;
  const body = rows.slice(1).filter(r => !only || items[r[at]]).map(r => {
    const out = [...r];
    out[0] = header.code ?? ''; out[1] = header.date ?? '';
    for (const [col, text] of Object.entries(items[r[at]] ? csvCells(r[at], items[r[at]]) : {})) out[head.indexOf(col)] = text;
    return out;
  });
  const text = `${[head, ...edit(body, head)].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(delim)).join('\r\n')}\r\n`;
  if (encoding === 'utf8-bom') return Buffer.from(`\uFEFF${text}`, 'utf8');
  if (encoding === 'utf8') return Buffer.from(text, 'utf8');
  if (encoding === 'utf16le') return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]);
  return cp1252(text);
};
// A complete Part A answer; `more` changes or adds answers.
const A = (alignment, more = {}) => ({ 'within-expertise': 'yes', alignment, rationale: `${S}: rationale`, reading: 'did-not-affect', 'course-fit': 'yes',
  'course-fit-affected-alignment': 'no', recommendation: 'no-change', confidence: 'medium', ...more });
const OUTSIDE = { 'within-expertise': 'no-it-is-outside-my-expertise' };
const V = { a: 'aligned', p: 'partially-aligned', n: 'not-aligned', i: 'insufficient-information-to-judge' };

// ---- running an import in a temporary folder
const rmTree = d => {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { recursive: true, withFileTypes: true })) if (e.isFile()) fs.chmodSync(path.join(e.parentPath, e.name), 0o644);
  fs.rmSync(d, { recursive: true, force: true });
};
const tmp = t => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'align1-import-test-')); t.after(() => rmTree(d)); return d; };
const putFiles = (dir, files) => { for (const [name, data] of Object.entries(files)) { const p = path.join(dir, ...name.split('/')); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); } };
const track = (key, slot, code, { a = '2026-10-27', b = '', shaA = '', shaB = '' } = {}) => [pkg.courses.get(key).code, slot, code, 'synthetic', a, '', shaA, b, '', shaB, '', ''];
const move = (kase, from, to, outcome) => [kase, from, 'outside expertise', '2026-11-04', to, to ? '2026-11-05' : '', outcome, ''];
const run = (t, files, opts = {}) => {
  const root = opts.root || tmp(t), inbox = path.join(root, opts.inboxName || 'inbox');
  fs.mkdirSync(inbox, { recursive: true });
  putFiles(inbox, files);
  const record = (name, head, rows) => { if (!rows) return undefined; const p = path.join(root, name); fs.writeFileSync(p, I.toCsv([head, ...rows])); return p; };
  const o = { inbox, synthetic: opts.synthetic ?? true, now: NOW, tracking: record('tracking.csv', I.TRACK_HEAD, opts.tracking),
    reassignments: record('reassignments.csv', I.REASSIGN_HEAD, opts.reassign), clarifications: opts.clarifications };
  const res = I.importReturns(o), out = path.join(root, opts.outName || 'out');
  const w = opts.write === false ? null : I.writeOutputs(res, out), pre = res.synthetic ? 'SYNTHETIC-' : '';
  const read = n => fs.readFileSync(path.join(out, pre + n), 'utf8');
  return { root, inbox, out, res, w, read, json: n => JSON.parse(read(n)), table: n => I.parseCsv(read(n).replace(/^\uFEFF/, '')) };
};
const R = (res, part, code, rc) => res.responses[part].find(r => r.code === code && r.reviewerCode === rc);
const C = (res, code) => res.cases.find(c => c.code === code);
const Pr = (res, code) => res.props.find(p => p.code === code);
const F = (res, rel) => res.files.find(f => f.path === rel);
const issuesOf = r => r.issues.map(i => `${i.level}:${i.question}:${i.message}`);
const cli = args => spawnSync(process.execPath, [...process.execArgv, SCRIPT, ...args], { encoding: 'utf8', timeout: 120000 });
const allText = (dir, skip = () => false) => fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter(e => e.isFile() && !skip(path.join(e.parentPath, e.name)))
  .map(e => [path.relative(dir, path.join(e.parentPath, e.name)), fs.readFileSync(path.join(e.parentPath, e.name)).toString('latin1')]);
const snapshot = dir => fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter(e => e.isFile()).map(e => { const p = path.join(e.parentPath, e.name), st = fs.statSync(p); return [path.relative(dir, p), st.size, st.mtimeMs, sha(fs.readFileSync(p))]; }).sort();

const HM_A = () => ({ 'HM210-01': A(V.a), 'HM210-02': A(V.a), 'HM210-03': A(V.a) });

// ---- the package

test('the package check: the V2 package matches; a changed copy and Version 1 are refused', t => {
  assert.equal(pkg.version, 'align-1-dev-adjudication-v2');
  assert.equal(pkg.cases.size, 58); assert.equal(pkg.proposals.size, 160); assert.equal(pkg.courses.size, 7);
  assert.deepEqual([...pkg.courses.values()].filter(c => !c.formB).map(c => c.key), ['IE310']);
  assert.throws(() => I.loadPackage(V1), e => e instanceof I.Refusal && /reads Version 2 only/.test(e.message));
  const copy = path.join(tmp(t), 'pkg');
  fs.cpSync(I.DEFAULT_PKG, copy, { recursive: true });
  const rel = '1-part-a-for-reviewers/HM210/HM210-part-a-form.docx', file = path.join(copy, ...rel.split('/'));
  const ticked = withDocXml(fs.readFileSync(file), x => x.replace('<w14:checked w14:val="0"/>', '<w14:checked w14:val="1"/>').replace('<w:t>☐</w:t>', '<w:t>☒</w:t>'));
  fs.writeFileSync(file, ticked);
  assert.throws(() => I.loadPackage(copy), e => e instanceof I.Refusal && /HM210-part-a-form\.docx has changed since the package was built/.test(e.message));
  const mPath = path.join(copy, 'package-manifest.json'), M = JSON.parse(fs.readFileSync(mPath, 'utf8'));
  Object.assign(M.files.find(f => f.path === rel), { sha256: sha(ticked), bytes: ticked.length });
  fs.writeFileSync(mPath, `${JSON.stringify(M, null, 1)}\n`);
  assert.throws(() => I.loadPackage(copy), e => e instanceof I.Refusal && /does not match the package[\s\S]*is ticked or inconsistent in the blank form/.test(e.message));
  const r = cli(['--check-package', '--pkg', copy]);
  assert.equal(r.status, 1); assert.match(r.stderr, /^refused: /);
});

// ---- 1-18: the handoff's list

test('1. valid Part A returns: a Word form and a CSV sheet are read answer by answer', t => {
  const r1 = { 'HM210-01': A(V.a, { reading: 'part', 'bloom-source': 'apply', 'bloom-target': 'apply', confidence: 'high', comments: `${S}: a comment\non two lines` }),
    'HM210-02': A(V.a, { reading: 'every-part', recommendation: 'revise' }),
    'HM210-03': A(V.p, { reading: 'other', 'reading|other-text': `${S}: another reading`, 'course-fit': 'unsure', 'course-fit-note': `${S}: a fit note`, recommendation: 're-map', 're-map-target': `${S}: CLO 2`, confidence: 'low' }) };
  const r2 = { 'HM210-01': A(V.a), 'HM210-02': A(V.a, { recommendation: 'revise' }), 'HM210-03': A(V.p, { recommendation: 're-map', 're-map-target': `${S}: clo 2` }) };
  const { res, json, table } = run(t, { 'HM210-part-a-SYNTH-R1.docx': docx('HM210', 'A', { code: 'SYNTH-R1', date: '2026-11-03' }, r1),
    'HM210-part-a-SYNTH-R2.csv': csv('HM210', 'A', { code: 'synth-r2', date: '3 November 2026' }, r2) });
  assert.deepEqual(res.files.map(f => [f.path, f.status, f.reviewerCode, f.part, f.course, f.format]),
    [['HM210-part-a-SYNTH-R1.docx', 'counted', 'SYNTH-R1', 'A', 'HM210', 'docx'], ['HM210-part-a-SYNTH-R2.csv', 'counted', 'SYNTH-R2', 'A', 'HM210', 'csv']]);
  for (const rc of ['SYNTH-R1', 'SYNTH-R2']) for (const code of ['HM210-01', 'HM210-02', 'HM210-03']) assert.equal(R(res, 'A', code, rc).status, 'judgment', `${rc} ${code}`);
  assert.deepEqual(res.responses.A.filter(r => r.course === 'HM210').map(r => r.outcome), ['ALIGNED', 'ALIGNED', 'PARTIALLY_ALIGNED', 'ALIGNED', 'ALIGNED', 'PARTIALLY_ALIGNED']);
  const out = json('part-a-responses.json'), j = out.responses.find(x => x.caseCode === 'HM210-03' && x.reviewerCode === 'SYNTH-R1');
  assert.equal(out.synthetic, true);
  assert.deepEqual([j.status, j.outcome, j.dateReturned, j.format], ['judgment', 'PARTIALLY_ALIGNED', '2026-11-03', 'docx']);
  assert.deepEqual([j.answers.reading.value, j.answers.reading.other], ['other', `${S}: another reading`]);
  assert.deepEqual([j.answers['course-fit'].value, j.answers['course-fit-note'].text], ['unsure', `${S}: a fit note`]);
  assert.deepEqual([j.answers.recommendation.code, j.answers['re-map-target'].text, j.answers.confidence.value], ['RE_MAP', `${S}: CLO 2`, 'low']);
  const j1 = out.responses.find(x => x.caseCode === 'HM210-01' && x.reviewerCode === 'SYNTH-R1');
  assert.deepEqual([j1.answers['bloom-source'].value, j1.answers['bloom-target'].value, j1.answers.comments.text], ['apply', 'apply', `${S}: a comment\non two lines`]);
  assert.equal(out.responses.find(x => x.caseCode === 'HM210-03' && x.reviewerCode === 'SYNTH-R2').dateReturned, '2026-11-03');
  // Same verdicts stay Pending: they become Agreed only under the adopted policies, which the importer never assumes.
  for (const code of ['HM210-01', 'HM210-02', 'HM210-03']) {
    const c = C(res, code);
    assert.deepEqual([c.state, c.verdictAgreement, c.recommendationAgreement], ['Pending', 'same', 'same'], code);
    assert.match(c.reasons.join(), /same verdict; it becomes Agreed only when the readings are checked against the adopted policies/);
  }
  const rec = table('part-a-agreement-record.csv'), head = rec[0], row = rec.find(r => r[0] === 'HM210-03');
  assert.deepEqual([row[head.indexOf('reviewer_1_code')], row[head.indexOf('reviewer_2_code')], row[head.indexOf('r1_re-map_target')]], ['SYNTH-R1', 'SYNTH-R2', `${S}: CLO 2`]);
  assert.ok(rec.slice(1).every(r => ['Pending', 'Reassigning', 'To adjudication', 'Excluded'].includes(r[head.indexOf('state (Pending / Reassigning / Agreed / To adjudication / Adjudicated / Unresolved / Excluded)')])));
  const tally = json('tally.json');
  assert.deepEqual([tally.partA.responses.judgment, tally.partA.verdicts.ALIGNED, tally.partA.verdicts.PARTIALLY_ALIGNED, tally.partA.sameVerdictAwaitingPolicy, tally.partA.agreedOrAdjudicated], [6, 4, 2, 3, 0]);
});

test('2. valid Part B returns: ratings, reasons, concerns and notes are read apart from alignment', t => {
  const x = (code, q, label) => opt(code, q, label);
  const r1 = { 'HM210-02-R1': { rating: 'appropriate-as-written', concerns: ['no-concerns'] }, 'HM210-02-R2': { rating: 'acceptable-with-edits', note: `${S}: an edit` },
    'HM210-02-R3': { rating: 'not-appropriate', concerns: [x('HM210-02-R3', 'concerns', 'Raises the cognitive level'), 'other'], 'concerns|other-text': `${S}: another concern` },
    'HM210-02-R4': { rating: 'cannot-judge', 'cannot-judge-reason': 'insufficient-information' }, 'HM210-03-R1': { rating: 'appropriate-as-written' },
    'HM210-03-R2': { rating: 'cannot-judge', 'cannot-judge-reason': 'other', 'cannot-judge-reason|other-text': `${S}: why` } };
  const r2 = { 'HM210-02-R1': { rating: 'appropriate-as-written' }, 'HM210-02-R2': { rating: 'not-appropriate' }, 'HM210-02-R3': { rating: 'not-appropriate' },
    'HM210-02-R4': { rating: 'acceptable-with-edits', note: `${S}: edit` }, 'HM210-03-R1': { rating: 'appropriate-as-written' }, 'HM210-03-R2': { rating: 'appropriate-as-written' } };
  const { res, json, table } = run(t, {
    'a/HM210-SYNTH-R1.docx': docx('HM210', 'A', { code: 'SYNTH-R1', date: '2026-11-03' }, HM_A()), 'a/HM210-SYNTH-R2.csv': csv('HM210', 'A', { code: 'SYNTH-R2', date: '2026-11-03' }, HM_A()),
    'b/HM210-SYNTH-R1.docx': docx('HM210', 'B', { code: 'SYNTH-R1', date: '2026-11-08', partA: '2026-11-01' }, r1), 'b/HM210-SYNTH-R2.csv': csv('HM210', 'B', { code: 'SYNTH-R2', date: '2026-11-08' }, r2) });
  assert.deepEqual(res.files.map(f => [f.status, f.part]), [['counted', 'A'], ['counted', 'A'], ['counted', 'B'], ['counted', 'B']]);
  assert.deepEqual(res.responses.B.filter(r => r.reviewerCode === 'SYNTH-R1').map(r => [r.code, r.status, r.outcome]), [['HM210-02-R1', 'rating', 'APPROPRIATE_AS_WRITTEN'],
    ['HM210-02-R2', 'rating', 'ACCEPTABLE_WITH_EDITS'], ['HM210-02-R3', 'rating', 'NOT_APPROPRIATE'], ['HM210-02-R4', 'cannot-judge', 'CANNOT_JUDGE'], ['HM210-03-R1', 'rating', 'APPROPRIATE_AS_WRITTEN'], ['HM210-03-R2', 'cannot-judge', 'CANNOT_JUDGE']]);
  const j = json('part-b-responses.json').responses.find(r => r.proposalCode === 'HM210-02-R3' && r.reviewerCode === 'SYNTH-R1');
  assert.deepEqual([j.caseCode, j.kind, j.answers.concerns.value.length, j.answers.concerns.other], ['HM210-02', 'rewrite', 2, `${S}: another concern`]);
  assert.equal(json('part-b-responses.json').responses.find(r => r.proposalCode === 'HM210-03-R2' && r.reviewerCode === 'SYNTH-R1').answers['cannot-judge-reason'].other, `${S}: why`);
  assert.deepEqual(['HM210-02-R1', 'HM210-02-R2', 'HM210-02-R3', 'HM210-02-R4', 'HM210-03-R1', 'HM210-03-R2'].map(c => [Pr(res, c).combined, Pr(res, c).ratingsSame]), [
    ['appropriate (all ratings)', 'yes'], ['mixed', 'no'], ['not appropriate (all ratings)', 'yes'], ['one rating', 'not comparable'], ['appropriate (all ratings)', 'yes'], ['one rating', 'not comparable']]);
  const tally = json('tally.json');
  assert.deepEqual(tally.partB.responses, { rating: 10, 'cannot-judge': 2, held: 0, 'no-response': 0, 'no-rating': 0, excluded: 0, 'out-of-scope': 0 });
  assert.deepEqual(tally.partB.ratings.rewrite, { APPROPRIATE_AS_WRITTEN: 5, ACCEPTABLE_WITH_EDITS: 2, NOT_APPROPRIATE: 3 });
  assert.deepEqual(tally.partB.cannotJudgeByReason, { 'insufficient-information': 1, other: 1 });
  // Ratings never enter the alignment tallies, and the Part B form's own Part A date is checked against the Part A return.
  assert.equal(tally.partA.responses.judgment, 6);
  assert.ok(F(res, 'b/HM210-SYNTH-R1.docx').notes.some(n => /says Part A was returned on 2026-11-01, but the Part A return is dated 2026-11-03/.test(n)));
  const rr = table('part-b-ratings-record.csv');
  assert.deepEqual(rr.find(r => r[1] === 'HM210-02-R2').slice(3, 12), ['SYNTH-R1', 'Acceptable with edits', '', '', 'SYNTH-R2', 'Not appropriate', '', '', 'no']);
});

test('3. missing answers are recorded as missing and never filled in', t => {
  const r1 = { 'HM210-01': A(V.a), 'HM210-02': { 'within-expertise': 'yes', rationale: `${S}: no verdict ticked` } };
  const { res, json, table } = run(t, { 'r1.docx': docx('HM210', 'A', { code: 'SYNTH-R1' }, r1), 'r2.csv': csv('HM210', 'A', { code: 'SYNTH-R2' }, { 'HM210-01': A(V.n) }, { only: true }) },
    { tracking: [track('HM210', 'reviewer 1', 'SYNTH-R1'), track('HM210', 'reviewer 2', 'SYNTH-R2'), track('IE310', 'reviewer 1', 'SYNTH-R4')] });
  assert.equal(R(res, 'A', 'HM210-02', 'SYNTH-R1').status, 'held');
  assert.deepEqual(issuesOf(R(res, 'A', 'HM210-02', 'SYNTH-R1')).filter(i => i.startsWith('hold')), ['hold:alignment:question 1 (alignment) is blank']);
  assert.equal(R(res, 'A', 'HM210-03', 'SYNTH-R1').status, 'no-response');
  for (const code of ['HM210-02', 'HM210-03']) assert.deepEqual([R(res, 'A', code, 'SYNTH-R2').status, R(res, 'A', code, 'SYNTH-R2').entry.missingRow], ['no-response', 'absent']);
  const held = json('part-a-responses.json').responses.find(r => r.caseCode === 'HM210-02' && r.reviewerCode === 'SYNTH-R1');
  assert.deepEqual(held.answers.alignment, { status: 'blank' });
  assert.equal(held.outcome, null);
  const missing = table('missing-responses.csv').slice(1).map(r => r.slice(0, 5).join(' | '));
  assert.deepEqual(missing.sort(), ['A | HM210 | SYNTH-R1 | HM210-02 | held for clarification', 'A | HM210 | SYNTH-R1 | HM210-03 | not answered', 'A | HM210 | SYNTH-R2 | HM210-02 | not answered',
    'A | HM210 | SYNTH-R2 | HM210-03 | not answered', 'A | IE310 | SYNTH-R4 | (whole form) | form not returned'].sort());
  assert.match(table('missing-responses.csv').find(r => r[2] === 'SYNTH-R2' && r[3] === 'HM210-03')[5], /no row for it in the returned sheet/);
  assert.deepEqual(C(res, 'HM210-02').reasons, ['SYNTH-R1: held for clarification', 'SYNTH-R2: no answer to this case']);
  assert.deepEqual([C(res, 'IE310-01').state, C(res, 'IE310-01').reasons], ['Pending', ['SYNTH-R4: form not returned (no file in the inbox is attributed to this reviewer)']]);
  assert.ok(table('clarification-requests.csv').some(r => r[0] === 'A|SYNTH-R1|HM210-02|alignment' && r[6] === 'hold'));
  assert.equal(json('tally.json').missing.byKind['Part A: form not returned'], 1);
  assert.match(fs.readFileSync(path.join(res.inbox, '..', 'out', 'SYNTHETIC-import-report.md'), 'utf8'), /\| A \| form not returned \| 1 \|/);
});

test('4. duplicate records: repeated files, a form and a sheet with the same answers, repeated rows, two different returns', t => {
  const r1 = { 'HM210-01': A(V.a), 'HM210-02': A(V.n) }, form = docx('HM210', 'A', { code: 'SYNTH-R1' }, r1);
  const dupRow = (rows, head) => [...rows, [...rows[0]]];
  const clash = (rows, head) => { const other = [...rows[0]]; other[head.indexOf(I.HEAD_A[6])] = 'Not aligned'; return [...rows, other]; };
  const { res, table } = run(t, {
    'r1/form.docx': form, 'r1/form (copy).docx': form, 'r1/sheet.csv': csv('HM210', 'A', { code: 'SYNTH-R1' }, r1, { only: true }),
    'r2.csv': csv('HM210', 'A', { code: 'SYNTH-R2' }, HM_A(), { edit: dupRow }), 'r3.csv': csv('HM210', 'A', { code: 'SYNTH-R3' }, HM_A(), { edit: clash }),
    'r4/first.docx': docx('HM210', 'A', { code: 'SYNTH-R4' }, HM_A()), 'r4/second.docx': docx('HM210', 'A', { code: 'SYNTH-R4' }, { ...HM_A(), 'HM210-03': A(V.n) }) },
  { tracking: ['SYNTH-R1', 'SYNTH-R2', 'SYNTH-R3', 'SYNTH-R4'].map((c, k) => track('HM210', `reviewer ${k + 1}`, c)) });
  assert.deepEqual(res.files.map(f => [f.path, f.status]), [['r1/form (copy).docx', 'counted'], ['r1/form.docx', 'duplicate'], ['r1/sheet.csv', 'same-answers'],
    ['r2.csv', 'counted'], ['r3.csv', 'counted'], ['r4/first.docx', 'conflict'], ['r4/second.docx', 'conflict']]);
  assert.match(F(res, 'r1/form.docx').reasons[0], /the same bytes as F01; counted once/);
  assert.ok(F(res, 'r2.csv').notes.some(n => /repeats row 2 \(HM210-01\) with the same answers; counted once/.test(n)));
  assert.equal(res.responses.A.filter(r => r.reviewerCode === 'SYNTH-R2' && r.code === 'HM210-01').length, 1);
  assert.deepEqual(F(res, 'r3.csv').parsed.rows.rejected.map(r => [r.line, r.code]), [[5, 'HM210-01']]);
  assert.match(F(res, 'r3.csv').parsed.rows.rejected[0].reason, /appears in rows 2 and 5 with different answers; neither was imported/);
  assert.deepEqual([R(res, 'A', 'HM210-01', 'SYNTH-R3').status, R(res, 'A', 'HM210-01', 'SYNTH-R3').entry.missingRow], ['no-response', 'rejected']);
  assert.equal(res.responses.A.filter(r => r.reviewerCode === 'SYNTH-R4').length, 0);
  assert.ok(C(res, 'HM210-01').reasons.includes('SYNTH-R4: conflicting returns; none counted'));
  const missing = table('missing-responses.csv');
  assert.ok(missing.some(r => r[2] === 'SYNTH-R4' && r[4] === 'conflicting returns'));
  assert.ok(missing.some(r => r[2] === 'SYNTH-R3' && r[3] === 'HM210-01' && /its row in the returned sheet was not imported/.test(r[5])));
});

test('5. invalid reviewer identifiers are held or rejected, and a code that may be a name is never shown', t => {
  const root = tmp(t), inbox = path.join(root, 'inbox');
  const signedR2 = docx('IE310', 'A', { code: 'SYNTH-R2' }, { 'IE310-01': A(V.a) }), unsigned = docx('IE310', 'A', {}, { 'IE310-01': A(V.n) });
  const twoCodes = csv('HM210', 'A', { code: 'SYNTH-R1' }, HM_A(), { edit: rows => rows.map((r, k) => (k ? [`SYNTH-R${k + 1}`, ...r.slice(1)] : r)) });
  const { res, out } = run(t, { 'named.docx': docx('HM210', 'A', { code: 'Dr. Jane Doe' }, HM_A()), 'two-codes.csv': twoCodes, 'nocode.docx': docx('HM210', 'A', {}, HM_A()),
    'unregistered.docx': docx('HM210', 'A', { code: 'SYNTH-R9' }, HM_A()), 'real-code.csv': csv('HM210', 'A', { code: 'R1' }, HM_A()),
    'signed-r2-recorded-r1.docx': signedR2, 'unsigned-recorded-r3.docx': unsigned, 'changed-after-receipt.docx': docx('HM210', 'A', { code: 'SYNTH-R5' }, HM_A()) },
  { root, tracking: [track('HM210', 'reviewer 1', 'SYNTH-R1'), track('HM210', 'reviewer 2', 'SYNTH-R5', { shaA: 'ab'.repeat(32) }),
    track('IE310', 'reviewer 1', 'SYNTH-R1', { shaA: sha(signedR2) }), track('IE310', 'reviewer 2', 'SYNTH-R3', { shaA: sha(unsigned).slice(0, 16) })] });
  const why = rel => [F(res, rel).status, F(res, rel).reasons.join(' ')];
  assert.deepEqual(why('named.docx'), ['held', 'the reviewer code is not in the expected form (letters, digits, "-", "." or "_"); it is not shown here in case it is a name']);
  assert.deepEqual(why('two-codes.csv'), ['held', 'it gives more than one reviewer code (SYNTH-R1, SYNTH-R2, SYNTH-R3)']);
  assert.deepEqual(why('nocode.docx'), ['held', 'it gives no reviewer code, and the tracking record holds no checksum for it']);
  assert.deepEqual(why('unregistered.docx'), ['held', 'SYNTH-R9 is not registered for HM210 in the tracking record, and no case of HM210 is reassigned to them']);
  assert.deepEqual(why('real-code.csv'), ['rejected', 'R1 is not a synthetic test code, so the file is not imported in a --synthetic import']);
  assert.deepEqual(why('signed-r2-recorded-r1.docx'), ['held', 'it is signed SYNTH-R2, but the tracking record holds its checksum for SYNTH-R1']);
  assert.deepEqual([F(res, 'unsigned-recorded-r3.docx').status, F(res, 'unsigned-recorded-r3.docx').reviewerCode, F(res, 'unsigned-recorded-r3.docx').reviewerSource], ['counted', 'SYNTH-R3', 'the checksum recorded at receipt']);
  assert.deepEqual(why('changed-after-receipt.docx'), ['held', 'its checksum differs from the one recorded at receipt: it may have been changed after it was returned']);
  // A held return is not mistaken for a form never returned.
  assert.ok(C(res, 'HM210-01').reasons.some(r => /^SYNTH-R5: return not counted \(F\d+ held; see the file table\)$/.test(r)));
  assert.ok(C(res, 'IE310-01').reasons.some(r => /^SYNTH-R1: return not counted \(F\d+ held; see the file table\)$/.test(r)));
  for (const [file, text] of allText(out, p => p.includes('originals'))) assert.doesNotMatch(text, /Jane|Doe/, file);
  // Records: a code that may be a name, or a synthetic code in a real import, stops the import before anything is written.
  const rec = rows => { const p = path.join(root, `rec-${crypto.randomUUID()}.csv`); fs.writeFileSync(p, I.toCsv([I.TRACK_HEAD, ...rows])); return p; };
  assert.throws(() => I.importReturns({ inbox, synthetic: true, tracking: rec([track('HM210', 'reviewer 1', 'Jane Doe')]) }), e => e instanceof I.Refusal && !/Jane/.test(e.message) && /not shown here in case it is a name/.test(e.message));
  assert.throws(() => I.importReturns({ inbox, synthetic: false, tracking: rec([track('HM210', 'reviewer 1', 'SYNTH-R1')]) }), e => e instanceof I.Refusal && /synthetic data is imported only with --synthetic/.test(e.message));
  // A real import never takes a synthetic return.
  const real = run(t, { 'r1.csv': csv('HM210', 'A', { code: 'SYNTH-R1' }, HM_A()) }, { synthetic: false, outName: 'real-out' });
  assert.deepEqual([F(real.res, 'r1.csv').status, F(real.res, 'r1.csv').reasons[0]], ['rejected', 'SYNTH-R1 is a synthetic test code; synthetic test data is never imported as a faculty return']);
  assert.equal(real.res.responses.A.length, 0);
});

test('6. unknown case codes: sheet rows and form controls that are not in the package are refused', t => {
  const unknownRow = (rows, head) => [...rows, Object.assign([...rows[0]], { 2: 'HM210-99' }), Object.assign([...rows[0]], { 2: 'IE310-01' }), Object.assign([...rows[0]], { 2: 'x'.repeat(60) })];
  const extraControl = x => { const m = x.match(/<w:sdt><w:sdtPr><w:tag w:val="HM210-01\|alignment\|aligned"\/>[\s\S]*?<\/w:sdt>/)[0]; return x.replace(m, m + m.replace('HM210-01|alignment|aligned', 'HM210-99|alignment|aligned')); };
  const otherCourse = x => x.replace('<w:tag w:val="HM210-01|comments"/>', '<w:tag w:val="MA7-01|comments"/>');
  const { res } = run(t, { 'rows.csv': csv('HM210', 'A', { code: 'SYNTH-R1' }, HM_A(), { edit: unknownRow }), 'extra.docx': docx('HM210', 'A', { code: 'SYNTH-R2' }, HM_A(), { edit: extraControl }),
    'mixed.docx': docx('HM210', 'A', { code: 'SYNTH-R3' }, HM_A(), { edit: otherCourse }) });
  const rows = F(res, 'rows.csv').parsed.rows;
  assert.deepEqual(rows.rejected.map(r => r.reason), ['"HM210-99" is not a case code of the package', `"${'x'.repeat(40)}..." is not a case code of the package`]);
  assert.deepEqual(rows.outOfScope.map(r => r.reason), ['IE310-01 belongs to IE310, not to this HM210 sheet; it was not imported']);
  assert.equal(F(res, 'rows.csv').status, 'counted');
  assert.equal(res.responses.A.filter(r => r.course === 'IE310').length, 0);
  assert.deepEqual([F(res, 'extra.docx').status, F(res, 'extra.docx').reasons[0]], ['rejected', 'it holds 1 control that is not in the HM 210 Part A form sent (for example "HM210-99|alignment|aligned")']);
  assert.deepEqual([F(res, 'mixed.docx').status, F(res, 'mixed.docx').reasons[0]], ['rejected', 'it mixes the controls of several courses (HM210, MA7)']);
  const root = tmp(t), log = path.join(root, 'log.csv');
  fs.writeFileSync(log, I.toCsv([I.REASSIGN_HEAD, move('HM210-99', 'SYNTH-R1', 'SYNTH-R3', 'reassigned')]));
  assert.throws(() => I.importReturns({ inbox: res.inbox, synthetic: true, reassignments: log }), e => e instanceof I.Refusal && /"HM210-99" is not a case code of the package/.test(e.message));
});

test('7. unknown proposal codes: rows and controls outside the package or the course are refused', t => {
  const rows = (r, head) => [...r, Object.assign([...r[0]], { 3: 'HM210-02-R9' }), Object.assign([...r[0]], { 3: 'HM210-01-R1' }), Object.assign([...r[0]], { 3: 'ACCTG201-01-R1', 2: 'ACCTG201-01' })];
  const extra = x => x.replace('<w:tag w:val="HM210-03-R2|note"/>', '<w:tag w:val="HM210-03-R7|note"/>');
  const ratings = { 'HM210-02-R1': { rating: 'appropriate-as-written' } };
  const { res } = run(t, { 'b.csv': csv('HM210', 'B', { code: 'SYNTH-R1' }, ratings, { edit: rows }), 'b.docx': docx('HM210', 'B', { code: 'SYNTH-R2' }, ratings, { edit: extra }) });
  const parsed = F(res, 'b.csv').parsed.rows;
  assert.deepEqual(parsed.rejected.map(r => r.reason), ['"HM210-02-R9" is not a proposal code of the package', '"HM210-01-R1" is not a proposal code of the package']);
  assert.deepEqual(parsed.outOfScope.map(r => r.code), ['ACCTG201-01-R1']);
  assert.deepEqual([F(res, 'b.csv').status, R(res, 'B', 'HM210-02-R1', 'SYNTH-R1').status], ['counted', 'rating']);
  assert.deepEqual([F(res, 'b.docx').status, F(res, 'b.docx').reasons[0]], ['rejected', 'it holds 1 control that is not in the HM 210 Part B form sent (for example "HM210-03-R7|note")']);
  assert.equal(res.responses.B.filter(r => r.course === 'ACCTG201').length, 0);
});

test('8. corrupted Word documents are rejected one by one, and the rest of the inbox is still imported', t => {
  const good = docx('HM210', 'A', { code: 'SYNTH-R1' }, HM_A()), entries = readZip(good);
  const swap = (name, data) => entries.map(([n, d]) => [n, n === name ? data : d]);
  const deepBody = (open, close, n) => writeZip(swap('word/document.xml', Buffer.from(docXml(good).replace('<w:body>', `<w:body>${open.repeat(n)}<w:r><w:t>x</w:t></w:r>${close.repeat(n)}`), 'utf8')), { deflate: true });
  const flip = Buffer.from(good); flip[flip.indexOf('Reviewer code:') + 1] ^= 0x20;
  const bomb = writeZip([...entries, ['word/media/bomb.bin', Buffer.alloc(40 * 1024 * 1024)]], { deflate: true, patch: (n, l, c) => { if (n === 'word/media/bomb.bin') { l.writeUInt32LE(1000, 22); c.writeUInt32LE(1000, 24); } } });
  const bad = {
    'cut-short.docx': good.subarray(0, Math.floor(good.length / 2)), 'not-a-zip.docx': Buffer.from(`${S}: this is not a Word file`), 'checksum.docx': flip,
    'malformed.docx': writeZip(swap('word/document.xml', Buffer.from(docXml(good).replace('</w:p>', ''), 'utf8'))),
    'doctype.docx': writeZip(swap('word/document.xml', Buffer.from(docXml(good).replace('?>', '?><!DOCTYPE w [<!ENTITY x SYSTEM "file:///c:/windows/win.ini">]>'), 'utf8'))),
    'declared-huge.docx': writeZip(entries, { patch: (n, l, c) => { if (n === 'word/document.xml') { l.writeUInt32LE(40 * 1024 * 1024, 22); c.writeUInt32LE(40 * 1024 * 1024, 24); } } }),
    'bomb.docx': bomb, 'encrypted.docx': writeZip(entries, { patch: (n, l, c) => c.writeUInt16LE(0x0801, 8) }),
    'method.docx': writeZip(entries, { patch: (n, l, c) => { if (n === 'word/document.xml') c.writeUInt16LE(99, 10); } }),
    'twice.docx': writeZip([...entries, entries.find(([n]) => n === 'word/document.xml')]),
    'protected.docx': Buffer.concat([Buffer.from('d0cf11e0a1b11ae1', 'hex'), Buffer.alloc(600)]),
    'guide.docx': fs.readFileSync(path.join(I.DEFAULT_PKG, '1-part-a-for-reviewers', '01-reviewer-guide-part-a.docx')),
    'no-document.docx': writeZip(entries.filter(([n]) => n !== 'word/document.xml')),
    // Character references to characters XML does not allow (they once made the decoder throw).
    'char-ref-range.docx': docx('HM210', 'A', { code: 'SYNTH-R1' }, HM_A(), { edit: x => x.replace(`${S}: rationale`, `${S}: rationale &#x110000;`) }),
    'char-ref-huge.docx': docx('HM210', 'A', { code: 'SYNTH-R1' }, HM_A(), { edit: x => x.replace(`${S}: rationale`, `${S}: rationale &#99999999999999999999;`) }),
    'char-ref-nul.docx': docx('HM210', 'A', { code: 'SYNTH-R1' }, HM_A(), { edit: x => x.replace(`${S}: rationale`, `${S}: rationale &#0;`) }),
    'char-ref-style.docx': writeZip(swap('word/styles.xml', Buffer.from(entries.find(([n]) => n === 'word/styles.xml')[1].toString('utf8').replace('w:styleId="CaseText"', 'w:styleId="CaseText&#x110000;"'), 'utf8'))),
    // Deep nesting (it once made the reading time grow with the square of the depth): a few kilobytes that inflate to megabytes.
    'deep-paragraphs.docx': deepBody('<w:p>', '</w:p>', 40), 'deep-controls.docx': deepBody('<w:sdt><w:sdtContent>', '</w:sdtContent></w:sdt>', 20),
    'deep-elements.docx': deepBody('<w:x>', '</w:x>', 300), 'deep-bomb.docx': deepBody('<w:p>', '</w:p>', 400000),
    'huge-text.docx': writeZip(swap('word/document.xml', Buffer.from(docXml(good).replace('<w:body>', `<w:body><w:p><w:r><w:t>${'a'.repeat(9 * 1024 * 1024)}</w:t></w:r></w:p>`), 'utf8')), { deflate: true }),
  };
  const started = Date.now();
  const valid = docx('HM210', 'A', { code: 'SYNTH-R2' }, HM_A(), { edit: x => x.replace(`${S}: rationale`, `${S}: rationale &#x1F600; &#65;&#x0042;`) });
  const { res, root } = run(t, { ...bad, 'good.docx': good, 'valid-refs.docx': valid, 'zip-slip.docx': writeZip([...entries, ['../../evil.txt', Buffer.from('x')]]) });
  assert.ok(Date.now() - started < 60000, 'a hostile archive must not make the import slow');
  const reason = rel => (assert.equal(F(res, rel).status, 'rejected', rel), F(res, rel).reasons[0]);
  assert.match(reason('cut-short.docx'), /the end of the archive is missing/);
  assert.match(reason('not-a-zip.docx'), /it is not a zip archive/);
  assert.match(reason('checksum.docx'), /entry word\/document\.xml fails its checksum/);
  assert.match(reason('malformed.docx'), /is not well-formed XML/);
  assert.match(reason('doctype.docx'), /is not well-formed XML: a document type declaration/);
  assert.match(reason('declared-huge.docx'), /is cut short|fails its checksum|too large/);
  assert.match(reason('bomb.docx'), /entry word\/media\/bomb\.bin cannot be decompressed/);
  assert.match(reason('encrypted.docx'), /an encrypted \.docx/);
  assert.match(reason('method.docx'), /uses an unknown compression method/);
  assert.match(reason('twice.docx'), /entry word\/document\.xml appears twice/);
  assert.match(reason('protected.docx'), /a password-protected Word file or an old \.doc file/);
  assert.match(reason('guide.docx'), /no form controls were found/);
  assert.match(reason('no-document.docx'), /it has no word\/document\.xml/);
  for (const rel of ['char-ref-range.docx', 'char-ref-huge.docx', 'char-ref-nul.docx']) assert.match(reason(rel), /its text \(word\/document\.xml\) is not well-formed XML: a bad character reference/, rel);
  assert.match(reason('char-ref-style.docx'), /its styles \(word\/styles\.xml\) are not well-formed XML: a bad character reference in <w:style>/);
  for (const rel of ['deep-paragraphs.docx', 'deep-controls.docx']) assert.match(reason(rel), /its paragraphs and form controls are nested more than 8 deep/, rel);
  assert.match(reason('huge-text.docx'), /entry word\/document\.xml is 9 MB, more than a form's text can be \(8 MB\)/);
  for (const rel of ['deep-elements.docx', 'deep-bomb.docx']) assert.match(reason(rel), /its text \(word\/document\.xml\) is too deeply nested to be read: elements nested more than 256 deep/, rel);
  assert.ok(bad['deep-bomb.docx'].length < 64 * 1024, 'the deep file is small on disk');
  const t0 = Date.now(); assert.throws(() => I.readWordReturn(bad['deep-bomb.docx'], pkg), I.FileError); assert.ok(Date.now() - t0 < 5000, 'a deeply nested file is refused quickly');
  assert.equal(F(res, 'valid-refs.docx').status, 'counted');
  assert.equal(R(res, 'A', 'HM210-01', 'SYNTH-R2').entry.answers.rationale.text, `${S}: rationale \u{1F600} AB`);
  assert.deepEqual([F(res, 'good.docx').status, F(res, 'zip-slip.docx').status], ['counted', 'same-answers']);
  assert.equal(fs.readdirSync(root, { recursive: true }).some(n => String(n).endsWith('evil.txt')), false, 'an entry name is never used as a path');
  assert.equal(fs.existsSync(path.join(root, '..', 'evil.txt')), false);
});

test('9. malformed CSV files are rejected; other encodings and delimiters are read', t => {
  const head = I.HEAD_A.map(h => `"${h}"`).join(',');
  const tie = csv('HM210', 'A', { code: 'SYNTH-R1' }, HM_A(), { edit: r => [r[0], Object.assign([...r[0]], { 2: 'IE310-01', 3: 'IE 310' })] });
  const answers = { 'HM210-01': A(V.a, { rationale: `${S}: café ’quoted’ – dash` }) };
  const { res } = run(t, {
    'unclosed.csv': Buffer.from(`${head}\r\n"SYNTH-R1","2026-11-03","HM210-01`), 'after-quote.csv': Buffer.from(`${head}\r\n"SYNTH-R1"x,"","HM210-01"\r\n`),
    'renamed.csv': Buffer.from(head.replace('"rationale"', '"reason"')), 'dropped.csv': Buffer.from(head.replace(',"comments"', '')),
    'binary.csv': Buffer.from(`${head}\r\n"SYNTH-R1"\u0000\r\n`), 'bad-utf8.csv': Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(`${head}\r\n`), Buffer.from([0xc3, 0x28])]),
    'header-only.csv': Buffer.from(`${head}\r\n`), 'tie.csv': tie, 'book.xlsx': Buffer.from('PK'),
    'extra-cell.csv': csv('HM210', 'A', { code: 'SYNTH-R2' }, HM_A(), { edit: r => r.map((x, k) => (k === 1 ? [...x, 'spill'] : x)) }),
    'no-code.csv': csv('HM210', 'A', { code: 'SYNTH-R3' }, HM_A(), { edit: r => r.map((x, k) => (k === 2 ? Object.assign([...x], { 2: '' }) : x)) }),
    'semicolon.csv': csv('HM210', 'A', { code: 'SYNTH-R4' }, answers, { delim: ';' }), 'utf16.csv': csv('HM210', 'A', { code: 'SYNTH-R5' }, answers, { encoding: 'utf16le', delim: '\t' }),
    'ansi.csv': csv('HM210', 'A', { code: 'SYNTH-R6' }, answers, { encoding: 'cp1252' }), 'no-bom.csv': csv('HM210', 'A', { code: 'SYNTH-R7' }, answers, { encoding: 'utf8' }) });
  const why = rel => [F(res, rel).status, F(res, rel).reasons[0]];
  assert.deepEqual(why('unclosed.csv'), ['rejected', 'a quoted cell is never closed (the sheet may be cut short)']);
  assert.deepEqual(why('after-quote.csv'), ['rejected', 'text follows a closing quote in row 2']);
  for (const rel of ['renamed.csv', 'dropped.csv']) assert.deepEqual(why(rel), ['rejected', 'its header row is not that of a Part A or Part B response sheet (a column is renamed, missing, repeated or added)']);
  assert.deepEqual(why('binary.csv'), ['rejected', 'it holds binary data, so it is not a text sheet']);
  assert.deepEqual(why('bad-utf8.csv'), ['rejected', 'the sheet is marked as UTF-8 but holds bytes that are not UTF-8']);
  assert.deepEqual(why('header-only.csv'), ['rejected', 'the sheet has no rows']);
  assert.deepEqual(why('tie.csv'), ['rejected', 'its rows belong equally to HM210 and IE310, so the sheet\'s course cannot be told']);
  assert.deepEqual(why('book.xlsx'), ['unsupported', 'a workbook: save it as "CSV UTF-8" and import the CSV']);
  assert.deepEqual(F(res, 'extra-cell.csv').parsed.rows.rejected.map(r => r.reason), ['the row has more cells than the header (a cell may hold an unquoted comma); it was not imported']);
  assert.deepEqual(F(res, 'no-code.csv').parsed.rows.rejected.map(r => [r.line, r.reason]), [[4, 'the row has no case code; its answers were not imported']]);
  for (const [rel, rc, note] of [['semicolon.csv', 'SYNTH-R4', null], ['utf16.csv', 'SYNTH-R5', null], ['ansi.csv', 'SYNTH-R6', /saved as Windows-1252, not UTF-8/], ['no-bom.csv', 'SYNTH-R7', null]]) {
    assert.equal(F(res, rel).status, 'counted', rel);
    assert.equal(R(res, 'A', 'HM210-01', rc).entry.answers.rationale.text, `${S}: café ’quoted’ – dash`, rel);
    assert.equal(R(res, 'A', 'HM210-01', rc).outcome, 'ALIGNED', rel);
    if (note) assert.ok(F(res, rel).notes.some(n => note.test(n)), rel);
  }
  assert.equal(F(res, 'utf16.csv').encoding, 'UTF-16');
});

test('10. answers that are not one of the form\'s options are held or sent for clarification', t => {
  const r1 = { 'HM210-01': A({ raw: 'Mostly aligned' }), 'HM210-02': A({ raw: 'Aligned; Not aligned' }), 'HM210-03': A(V.a, { confidence: { raw: 'Very high' } }) };
  const r2 = { 'HM210-01': A([V.a, V.n]), 'HM210-02': A(V.a, { reading: 'other' }), 'HM210-03': A(V.a, { recommendation: [], 'recommendation|other-text': `${S}: text but no tick` }) };
  const b1 = { 'HM210-02-R1': { rating: { raw: 'Great' } }, 'HM210-02-R2': { rating: 'appropriate-as-written', concerns: { raw: 'No concerns; Bad grammar' } } };
  const b2 = { 'HM210-02-R1': { rating: ['appropriate-as-written', 'not-appropriate'] } };
  const { res, table } = run(t, { 'r1.csv': csv('HM210', 'A', { code: 'SYNTH-R1' }, r1), 'r2.docx': docx('HM210', 'A', { code: 'SYNTH-R2' }, r2),
    'b1.csv': csv('HM210', 'B', { code: 'SYNTH-R1' }, b1), 'b2.docx': docx('HM210', 'B', { code: 'SYNTH-R2' }, b2) });
  const top = (code, rc, part = 'A') => { const r = R(res, part, code, rc); return [r.status, ...r.issues.filter(i => i.level !== 'note').map(i => `${i.level}: ${i.message}`)]; };
  assert.deepEqual(top('HM210-01', 'SYNTH-R1'), ['held', 'hold: question 1 (alignment): "Mostly aligned" is not one of the form\'s options']);
  assert.deepEqual(top('HM210-02', 'SYNTH-R1'), ['held', 'hold: question 1 (alignment): more than one answer (Aligned; Not aligned)']);
  assert.deepEqual(top('HM210-03', 'SYNTH-R1'), ['judgment', 'clarify: question 7 (confidence): "Very high" is not one of the form\'s options']);
  assert.deepEqual(top('HM210-01', 'SYNTH-R2'), ['held', 'hold: question 1 (alignment): more than one answer (Aligned; Not aligned)']);
  assert.deepEqual(top('HM210-02', 'SYNTH-R2'), ['judgment', 'clarify: question 3 (reading applied): "Other" is chosen but not described']);
  assert.deepEqual(top('HM210-03', 'SYNTH-R2'), ['judgment', 'clarify: question 5 (recommendation): a description is written under "Other", but no box is ticked']);
  assert.deepEqual(top('HM210-02-R1', 'SYNTH-R1', 'B'), ['held', 'hold: the rating: "Great" is not one of the form\'s options']);
  assert.deepEqual(top('HM210-02-R2', 'SYNTH-R1', 'B'), ['rating', 'clarify: the concerns: "No concerns; Bad grammar" is not one of the form\'s options']);
  assert.deepEqual(top('HM210-02-R1', 'SYNTH-R2', 'B'), ['held', 'hold: the rating: more than one answer (Appropriate as written; Not appropriate)']);
  const rows = table('part-a-responses.csv'), h = rows[0];
  assert.equal(rows.find(r => r[0] === 'HM210-01' && r[h.indexOf('reviewer_code')] === 'SYNTH-R1')[h.indexOf('alignment')], '[not an option] Mostly aligned');
  assert.equal(rows.find(r => r[0] === 'HM210-01' && r[h.indexOf('reviewer_code')] === 'SYNTH-R2')[h.indexOf('alignment')], '[more than one] Aligned; Not aligned');
  // Held answers are not counted, so these cases cannot reach the adjudicator or be treated as agreed.
  assert.deepEqual(['HM210-01', 'HM210-02'].map(c => C(res, c).state), ['Pending', 'Pending']);
});

test('11. conflicting faculty judgments go to the adjudicator; no majority decides a case', t => {
  const { res, json, read, table } = run(t, {
    'r1.docx': docx('HM210', 'A', { code: 'SYNTH-R1' }, { 'HM210-01': A(V.a), 'HM210-02': A(V.a), 'HM210-03': A(V.a) }),
    'r2.csv': csv('HM210', 'A', { code: 'SYNTH-R2' }, { 'HM210-01': A(V.n, { recommendation: 'revise' }), 'HM210-02': A(V.a), 'HM210-03': A(V.a, { 'course-fit': 'no', 'course-fit-affected-alignment': 'yes' }) }),
    'r3.csv': csv('HM210', 'A', { code: 'SYNTH-R3' }, { 'HM210-01': A(V.n), 'HM210-02': A(V.n), 'HM210-03': A(V.a) }) });
  assert.deepEqual(['HM210-01', 'HM210-02', 'HM210-03'].map(c => [C(res, c).state, C(res, c).reasons.join('; ')]), [
    ['To adjudication', 'different verdicts'], ['To adjudication', 'different verdicts'], ['To adjudication', 'course fit affected the verdict (question 4b: read under the adopted P4 policy)']]);
  assert.equal(json('tally.json').partA.agreedOrAdjudicated, 0);
  const inv = table('disagreement-inventory.csv').slice(1);
  assert.deepEqual(inv.filter(r => r[2] === 'verdict').map(r => [r[0], r[3], r[5]]), [['HM210-01', 'SYNTH-R1: Aligned; SYNTH-R2: Not aligned; SYNTH-R3: Not aligned', 'to the adjudicator'],
    ['HM210-02', 'SYNTH-R1: Aligned; SYNTH-R2: Aligned; SYNTH-R3: Not aligned', 'to the adjudicator']]);
  assert.ok(inv.some(r => r[0] === 'HM210-01' && r[2] === 'recommendation' && r[4] === 'different'));
  assert.ok(inv.some(r => r[0] === 'HM210-03' && r[2] === 'course fit'));
  assert.match(read('import-report.md'), /never treats a majority as a decision/);
  assert.doesNotMatch(read('import-report.md'), /\| (Agreed|Adjudicated|Unresolved) \| [1-9]/);
});

test('12. outside-expertise answers: the case is reassigned, never judged by the importer', t => {
  const r1 = { 'HM210-01': { ...OUTSIDE, alignment: V.a, rationale: `${S}: written after saying outside` }, 'HM210-02': A(V.a), 'HM210-03': A(V.a) };
  const files = { 'r1.docx': docx('HM210', 'A', { code: 'SYNTH-R1' }, r1), 'r2.csv': csv('HM210', 'A', { code: 'SYNTH-R2' }, HM_A()) };
  const tracking = [track('HM210', 'reviewer 1', 'SYNTH-R1'), track('HM210', 'reviewer 2', 'SYNTH-R2')];
  const first = run(t, files, { tracking });
  const r = R(first.res, 'A', 'HM210-01', 'SYNTH-R1');
  assert.deepEqual([r.status, r.outcome], ['outside-expertise', 'OUTSIDE_EXPERTISE']);
  assert.match(issuesOf(r).join(), /answers given after "outside my expertise" \(question 1 \(alignment\); question 2 \(rationale\)\) are kept but not counted/);
  assert.deepEqual([C(first.res, 'HM210-01').state, C(first.res, 'HM210-01').reasons], ['Reassigning', ['SYNTH-R1: outside expertise; to be reassigned']]);
  assert.deepEqual(first.table('reassignment-requests.csv').slice(1).map(x => x.slice(0, 2)), [['HM210-01', 'SYNTH-R1']]);
  assert.deepEqual(first.table('reassignment-requests.csv')[0], I.REASSIGN_HEAD);
  // Logged and reassigned, awaiting the new reviewer.
  const waiting = run(t, files, { tracking, reassign: [move('HM210-01', 'SYNTH-R1', 'SYNTH-R3', 'reassigned')] });
  assert.deepEqual(C(waiting.res, 'HM210-01').reasons, ['SYNTH-R1: outside expertise; reassigned, awaiting the new reviewer']);
  assert.equal(waiting.table('reassignment-requests.csv').length, 1);
  assert.ok(waiting.table('missing-responses.csv').some(x => x[2] === 'SYNTH-R3' && x[3] === 'HM210-01' && /^reassigned case: form not returned/.test(x[5])));
  // The new reviewer's return counts for the reassigned case only.
  const done = run(t, { ...files, 'r3.csv': csv('HM210', 'A', { code: 'SYNTH-R3' }, HM_A()) }, { tracking, reassign: [move('HM210-01', 'SYNTH-R1', 'SYNTH-R3', 'reassigned')] });
  assert.deepEqual([C(done.res, 'HM210-01').state, C(done.res, 'HM210-01').judgments.map(j => j.reviewerCode)], ['Pending', ['SYNTH-R2', 'SYNTH-R3']]);
  assert.deepEqual(['HM210-02', 'HM210-03'].map(c => R(done.res, 'A', c, 'SYNTH-R3').status), ['out-of-scope', 'out-of-scope']);
  // No qualified reviewer: the case is excluded on the coordinator's record, not by the importer's judgment.
  const excluded = run(t, files, { tracking, reassign: [move('HM210-01', 'SYNTH-R1', '', 'excluded: no qualified reviewer')] });
  assert.deepEqual([C(excluded.res, 'HM210-01').state, C(excluded.res, 'HM210-01').reasons], ['Excluded', ['no qualified reviewer (reassignment log)']]);
});

test('13. "Insufficient information" answers go to the adjudicator and stay out of the verdict statistics', t => {
  const r1 = { 'HM210-01': A(V.i, { 'course-fit': 'insufficient-information-to-judge', recommendation: 'insufficient-information' }), 'HM210-02': A(V.i), 'HM210-03': A(V.a) };
  const r2 = { 'HM210-01': A(V.a), 'HM210-02': A(V.i), 'HM210-03': A(V.a) };
  const b1 = { 'HM210-02-R1': { rating: 'cannot-judge', 'cannot-judge-reason': 'insufficient-information' } };
  const { res, json } = run(t, { 'r1.docx': docx('HM210', 'A', { code: 'SYNTH-R1' }, r1), 'r2.csv': csv('HM210', 'A', { code: 'SYNTH-R2' }, r2), 'b1.csv': csv('HM210', 'B', { code: 'SYNTH-R1' }, b1) });
  const i8 = '"Insufficient information to judge" (the adjudicator decides whether the case can be judged; I8)';
  assert.deepEqual([C(res, 'HM210-01').state, C(res, 'HM210-01').reasons], ['To adjudication', ['different verdicts', i8]]);
  assert.deepEqual([C(res, 'HM210-02').state, C(res, 'HM210-02').reasons], ['To adjudication', [i8]]);
  assert.deepEqual(C(res, 'HM210-01').special, ['insufficient information']);
  const j = json('part-a-responses.json').responses.find(x => x.caseCode === 'HM210-01' && x.reviewerCode === 'SYNTH-R1');
  assert.deepEqual([j.outcome, j.answers['course-fit'].code, j.answers.recommendation.code], ['INSUFFICIENT_INFORMATION', 'INSUFFICIENT_INFORMATION', 'INSUFFICIENT_INFORMATION']);
  assert.equal(res.stats.verdict.excludedInsufficient, 2);
  assert.equal(res.stats.verdict.overall.pairedUnits, 1);
  assert.deepEqual(json('tally.json').partB.cannotJudgeByReason, { 'insufficient-information': 1 });
});

test('14. returned files are preserved: the inbox is never changed, and every file read is archived byte for byte', t => {
  const root = tmp(t), inbox = path.join(root, 'inbox');
  putFiles(inbox, { 'a/r1.docx': docx('HM210', 'A', { code: 'SYNTH-R1' }, HM_A()), 'a/r2.csv': csv('HM210', 'A', { code: 'SYNTH-R2' }, HM_A()), 'a/scan.pdf': Buffer.from('%PDF-1.4 synthetic'),
    'a/broken.docx': Buffer.from('not a zip'), 'a/~$r1.docx': Buffer.from('Dr. Lock Name'), 'a/.hidden.csv': Buffer.from('x'), 'a/same-as-r2.csv': csv('HM210', 'A', { code: 'SYNTH-R2' }, HM_A()) });
  const big = path.join(inbox, 'a', 'huge.docx');
  fs.writeFileSync(big, Buffer.alloc(I.MAX_FILE_BYTES + 1024));
  const before = snapshot(inbox);
  const { res, out, w, json } = run(t, {}, { root });
  assert.deepEqual(snapshot(inbox), before);
  assert.equal(w.inboxUnchanged, true);
  assert.equal(json('import-manifest.json').inboxUnchanged, true);
  assert.deepEqual(res.files.map(f => [f.path, f.status]), [['a/.hidden.csv', 'ignored'], ['a/broken.docx', 'rejected'], ['a/huge.docx', 'rejected'], ['a/r1.docx', 'counted'],
    ['a/r2.csv', 'counted'], ['a/same-as-r2.csv', 'duplicate'], ['a/scan.pdf', 'unsupported'], ['a/~$r1.docx', 'ignored']]);
  assert.match(F(res, 'a/huge.docx').reasons[0], /^it is 50 MB, more than a returned form or sheet can be \(50 MB\), so it was not read$/);
  const archive = path.join(out, 'SYNTHETIC-originals'), kept = fs.readdirSync(archive).sort();
  const expected = res.files.filter(f => f.sha256).map(f => `${f.sha256}${f.ext}`);
  assert.deepEqual(kept, [...new Set(expected)].sort());
  for (const f of res.files.filter(x => x.sha256)) {
    const copy = path.join(archive, `${f.sha256}${f.ext}`);
    assert.equal(sha(fs.readFileSync(copy)), sha(fs.readFileSync(f.abs)), f.path);
    assert.equal(fs.statSync(copy).mode & 0o222, 0, `${f.path} is archived read-only`);
  }
  // Ignored files are neither read nor copied: a Word lock file holds the name of whoever opened the form.
  assert.equal(res.files.filter(f => f.status === 'ignored').every(f => f.sha256 === null), true);
  for (const [file, text] of allText(out)) assert.doesNotMatch(text, /Lock Name/, file);
  // A file added to the inbox while the import runs is reported, and the command line then exits with 1.
  const res2 = I.importReturns({ inbox, synthetic: true, now: NOW });
  fs.writeFileSync(path.join(inbox, 'late.csv'), 'x');
  const w2 = I.writeOutputs(res2, path.join(root, 'out2'));
  assert.equal(w2.inboxUnchanged, false);
  assert.match(fs.readFileSync(path.join(root, 'out2', 'SYNTHETIC-import-report.md'), 'utf8'), /NO: a file was added, removed or changed while the import ran/);
});

test('15. the output folder: never overwritten, never inside the inbox, the package or Version 1', t => {
  const { res, root, out, inbox } = run(t, { 'r1.csv': csv('HM210', 'A', { code: 'SYNTH-R1' }, HM_A()) });
  const first = snapshot(out);
  assert.throws(() => I.writeOutputs(res, out), e => e instanceof I.Refusal && /is not empty; every import writes to a new folder/.test(e.message));
  assert.deepEqual(snapshot(out), first);
  const file = path.join(root, 'a-file.txt'); fs.writeFileSync(file, 'keep');
  assert.throws(() => I.writeOutputs(res, file), e => e instanceof I.Refusal && /is a file, not a folder/.test(e.message));
  assert.equal(fs.readFileSync(file, 'utf8'), 'keep');
  for (const [dir, what] of [[path.join(inbox, 'out'), 'the inbox'], [inbox, 'the inbox'], [root, 'the inbox'], [path.join(I.DEFAULT_PKG, 'import-out'), 'the package'], [path.join(V1, 'import-out'), 'Version 1']]) {
    assert.throws(() => I.writeOutputs(res, dir), e => e instanceof I.Refusal && e.message === `the output folder must not be, hold or lie inside ${what}`, dir);
  }
  assert.equal(fs.existsSync(path.join(inbox, 'out')) || fs.existsSync(path.join(I.DEFAULT_PKG, 'import-out')) || fs.existsSync(path.join(V1, 'import-out')), false);
  const empty = path.join(root, 'empty'); fs.mkdirSync(empty);
  assert.equal(I.writeOutputs(res, empty).out, empty);
  assert.ok(fs.existsSync(path.join(empty, 'SYNTHETIC-tally.json')));
  assert.deepEqual(fs.readdirSync(root).filter(n => n.includes('.incomplete-')), []);
  // Real responses must stay out of the repository: a folder inside it is reported (the check is on the paths only).
  assert.deepEqual(I.storageWarnings(path.join(REPO, 'inbox'), os.tmpdir()), ['the inbox lies inside the repository; real responses must never be committed, so keep them in the restricted store (see the guide)']);
  assert.deepEqual(I.storageWarnings(os.tmpdir(), path.join(os.tmpdir(), 'x')), []);
});

test('16. reviewer agreement: kappa and alpha match worked examples and are given only when the data support them', () => {
  // Cohen's kappa: 50 items, 20 yes-yes, 5 yes-no, 10 no-yes, 15 no-no gives 0.4.
  const pairs = [...Array(20).fill(['yes', 'yes']), ...Array(5).fill(['yes', 'no']), ...Array(10).fill(['no', 'yes']), ...Array(15).fill(['no', 'no'])];
  assert.equal(Math.round(I.cohenKappa(pairs) * 1000) / 1000, 0.4);
  // Krippendorff's alpha (nominal): Krippendorff's 4-observer, 12-unit example with missing values gives 0.743.
  const kd = [[1, 1, null, 1], [2, 2, 3, 2], [3, 3, 3, 3], [3, 3, 3, 3], [2, 2, 2, 2], [1, 2, 3, 4], [4, 4, 4, 4], [1, 1, 2, 1], [2, 2, 2, 2], [null, 5, 5, 5], [null, null, 1, 1], [null, 3, null, null]];
  assert.equal(Math.round(I.krippendorffAlpha(kd.map(u => u.filter(v => v !== null).map(String))) * 1000) / 1000, 0.743);
  const units = (n, same, raters = ['SYNTH-R1', 'SYNTH-R2']) => Array.from({ length: n }, (_, k) => ({ ratings: [{ rater: raters[0], value: k % 2 ? 'a' : 'b' }, { rater: raters[1], value: k < same ? (k % 2 ? 'a' : 'b') : 'c' }] }));
  const four = I.agreement(units(4, 4));
  assert.deepEqual([four.percent, four.percentReason, four.cohenKappa.value, four.cohenKappa.reason], [null, 'fewer than 5 paired units', null, 'not calculated: 4 paired units, fewer than 10']);
  const five = I.agreement(units(5, 4));
  assert.deepEqual([five.percent, five.cohenKappa.value, five.krippendorffAlpha.reason], [80, null, 'not calculated: 5 paired units, fewer than 10']);
  const ten = I.agreement(units(10, 8));
  assert.equal(ten.percent, 80); assert.equal(typeof ten.cohenKappa.value, 'number'); assert.equal(typeof ten.krippendorffAlpha.value, 'number');
  const one = I.agreement(Array.from({ length: 12 }, () => ({ ratings: [{ rater: 'SYNTH-R1', value: 'a' }, { rater: 'SYNTH-R2', value: 'a' }] })));
  assert.deepEqual([one.percent, one.cohenKappa.reason], [100, 'not calculated: only one category was used, so chance agreement is total']);
  const mixed = I.agreement([...units(6, 5), ...units(6, 5, ['SYNTH-R3', 'SYNTH-R4'])]);
  assert.deepEqual([mixed.cohenKappa.value, mixed.cohenKappa.reason, typeof mixed.krippendorffAlpha.value], [null, 'not applicable: the units were not all judged by the same two reviewers', 'number']);
});

test('16b. agreement from imported returns: MA7 with 20 cases, and two courses with different reviewer pairs', t => {
  const plan = 'aaaaaaaapppnnapanpia'.split(''), other = 'aaaaaaaapppnnpnnpaaa'.split('');
  const r1 = {}, r2 = {};
  pkg.courses.get('MA7').cases.forEach((c, k) => { r1[c.code] = A(V[plan[k]]); r2[c.code] = A(V[other[k]]); });
  const it3 = {}, it4 = {};
  pkg.courses.get('IT204').cases.forEach((c, k) => { it3[c.code] = A(k < 6 ? V.a : k < 10 ? V.p : V.n); it4[c.code] = A(k < 5 ? V.a : k < 10 ? V.p : k < 12 ? V.n : V.a); });
  const { res, read } = run(t, { 'ma7-r1.docx': docx('MA7', 'A', { code: 'SYNTH-R1' }, r1), 'ma7-r2.csv': csv('MA7', 'A', { code: 'SYNTH-R2' }, r2),
    'it-r3.csv': csv('IT204', 'A', { code: 'SYNTH-R3' }, it3), 'it-r4.csv': csv('IT204', 'A', { code: 'SYNTH-R4' }, it4) });
  // MA7-19 has an "Insufficient information" answer, so 19 cases are paired on the three verdicts: 14 the same.
  const ma7 = res.stats.verdict.byCourse.MA7;
  assert.deepEqual([ma7.pairedUnits, ma7.same, ma7.percent, ma7.cohenKappa.value, ma7.cohenKappa.raters, ma7.krippendorffAlpha.value], [19, 14, 73.7, 0.556, 'SYNTH-R1 + SYNTH-R2', 0.567]);
  assert.deepEqual(ma7.categories, { ALIGNED: 21, NOT_ALIGNED: 7, PARTIALLY_ALIGNED: 10 });
  assert.equal(res.stats.verdict.excludedInsufficient, 1);
  // An independent count of kappa from the same pairs.
  const pairs = plan.map((v, k) => [v, other[k]]).filter(([x, y]) => x !== 'i' && y !== 'i');
  const n = pairs.length, po = pairs.filter(([x, y]) => x === y).length / n, pe = ['a', 'p', 'n'].reduce((s, c) => s + (pairs.filter(([x]) => x === c).length / n) * (pairs.filter(([, y]) => y === c).length / n), 0);
  assert.equal(Math.round(((po - pe) / (1 - pe)) * 1000) / 1000, ma7.cohenKappa.value);
  const all = res.stats.verdict.overall;
  assert.deepEqual([all.pairedUnits, all.cohenKappa.value, all.cohenKappa.reason, typeof all.krippendorffAlpha.value], [32, null, 'not applicable: the units were not all judged by the same two reviewers', 'number']);
  assert.equal(typeof res.stats.verdict.byCourse.IT204.cohenKappa.value, 'number');
  assert.equal(res.stats.verdict.byCourse.HM210.pairedUnits, 0);
  assert.match(read('import-report.md'), /\| MA7 \| 19 \| 14 of 19 \| 73\.7% \| 0\.556 \| 0\.567 \| verdict \|/);
});

test('17. recommendation ratings: summaries by kind, combined ratings, reasons for "Cannot judge" and rating agreement', t => {
  const rw = pkg.courses.get('ACCTG201').proposals.filter(p => p.kind === 'rewrite').map(p => p.code), remap = pkg.courses.get('ACCTG201').proposals.find(p => p.kind === 'remap').code;
  const W = 'appropriate-as-written', E = 'acceptable-with-edits', N = 'not-appropriate', J = 'cannot-judge';
  const p1 = [W, W, W, W, W, W, W, W, E, E, N, W, N, J], p2 = [W, W, W, W, W, W, W, W, E, E, N, E, W, W];
  const b1 = {}, b2 = {};
  rw.forEach((code, k) => { b1[code] = { rating: p1[k], ...(p1[k] === J ? { 'cannot-judge-reason': 'outside-my-expertise' } : {}) }; b2[code] = { rating: p2[k] }; });
  b1[remap] = { rating: opt(remap, 'rating', 'Appropriate only if'), 're-map-target': `${S}: CLO 3` }; b2[remap] = { rating: 'appropriate' };
  const { res, json, read } = run(t, { 'b1.docx': docx('ACCTG201', 'B', { code: 'SYNTH-R1' }, b1), 'b2.csv': csv('ACCTG201', 'B', { code: 'SYNTH-R2' }, b2) });
  const tally = json('tally.json').partB;
  assert.deepEqual(tally.ratings, { rewrite: { APPROPRIATE_AS_WRITTEN: 19, ACCEPTABLE_WITH_EDITS: 5, NOT_APPROPRIATE: 3 }, 're-mapping': { APPROPRIATE_IF_TARGET_NAMED: 1, APPROPRIATE: 1 } });
  assert.deepEqual(tally.cannotJudgeByReason, { 'outside-my-expertise': 1 });
  // The tally covers every proposal of the package: those of the other courses are "not rated".
  const ofKind = k => [...pkg.proposals.values()].filter(p => p.kind === k).length;
  assert.deepEqual(tally.byCombinedRating, { 'rewrite: appropriate (all ratings)': 8, 'rewrite: acceptable to all, some with edits or a named target': 3, 'rewrite: not appropriate (all ratings)': 1,
    'rewrite: mixed': 1, 'rewrite: one rating': 1, 'rewrite: not rated': ofKind('rewrite') - 14, 're-mapping: acceptable to all, some with edits or a named target': 1, 're-mapping: not rated': ofKind('remap') - 1 });
  assert.deepEqual([ofKind('rewrite') - 14, ofKind('remap') - 1], [136, 9]);
  const s = res.stats.rating.rewrite.byCourse.ACCTG201;
  assert.deepEqual([s.pairedUnits, s.same, s.percent, s.cohenKappa.value, s.krippendorffAlpha.value], [13, 11, 84.6, 0.675, 0.686]);
  const m = res.stats.rating.remap.byCourse.ACCTG201;
  assert.deepEqual([m.pairedUnits, m.percent, m.cohenKappa.reason], [1, null, 'not calculated: 1 paired unit, fewer than 10']);
  assert.equal(json('part-b-responses.json').responses.find(r => r.proposalCode === remap && r.reviewerCode === 'SYNTH-R1').answers['re-map-target'].text, `${S}: CLO 3`);
  assert.match(read('import-report.md'), /\| rewrite \| Appropriate as written \| 19 \|/);
  assert.match(read('import-report.md'), /\| re-mapping \| Appropriate only if a suitable outcome is named \| 1 \|/);
  assert.match(read('import-report.md'), /\| Outside my expertise \| 1 \|/);
  // Ratings describe the proposed changes; they never change a Part A state.
  assert.equal(res.cases.filter(c => c.course === 'ACCTG201').every(c => c.state === 'Pending' && !c.judgments.length), true);
});

test('18. a failed write leaves no partial record, and the import can then be run again', t => {
  const { res, root } = run(t, { 'r1.docx': docx('HM210', 'A', { code: 'SYNTH-R1' }, HM_A()), 'bad.docx': Buffer.from('x') }, { write: false });
  const out = path.join(root, 'out'), real = fs.writeFileSync;
  fs.writeFileSync = function (file, ...rest) { if (String(file).endsWith('tally.json')) throw Object.assign(new Error('ENOSPC: simulated full disk'), { code: 'ENOSPC' }); return real.call(this, file, ...rest); };
  try { assert.throws(() => I.writeOutputs(res, out), /simulated full disk/); } finally { fs.writeFileSync = real; }
  assert.equal(fs.existsSync(out), false);
  assert.deepEqual(fs.readdirSync(root).filter(n => n.includes('.incomplete-')), []);
  // An existing empty folder is left empty, not removed.
  const empty = path.join(root, 'empty'); fs.mkdirSync(empty);
  fs.writeFileSync = function (file, ...rest) { if (String(file).endsWith('import-manifest.json')) throw new Error('simulated failure'); return real.call(this, file, ...rest); };
  try { assert.throws(() => I.writeOutputs(res, empty), /simulated failure/); } finally { fs.writeFileSync = real; }
  assert.deepEqual(fs.readdirSync(empty), []);
  // A refused import writes nothing at all.
  const badTracking = path.join(root, 'tracking.csv'); fs.writeFileSync(badTracking, 'not,the,template\r\n');
  assert.throws(() => I.importReturns({ inbox: res.inbox, synthetic: true, tracking: badTracking }), e => e instanceof I.Refusal && /tracking record: the header is not the template's/.test(e.message));
  // Recovery: the same import, run again, completes.
  const w = I.writeOutputs(I.importReturns({ inbox: res.inbox, synthetic: true, now: NOW }), out);
  assert.deepEqual([w.out, w.inboxUnchanged], [out, true]);
  assert.deepEqual(fs.readdirSync(out).sort(), ['SYNTHETIC-TEST-DATA.txt', 'SYNTHETIC-clarification-requests.csv', 'SYNTHETIC-disagreement-inventory.csv', 'SYNTHETIC-import-manifest.json',
    'SYNTHETIC-import-report.md', 'SYNTHETIC-missing-responses.csv', 'SYNTHETIC-originals', 'SYNTHETIC-part-a-agreement-record.csv', 'SYNTHETIC-part-a-responses.csv',
    'SYNTHETIC-part-a-responses.json', 'SYNTHETIC-part-b-ratings-record.csv', 'SYNTHETIC-part-b-responses.csv', 'SYNTHETIC-part-b-responses.json', 'SYNTHETIC-reassignment-requests.csv', 'SYNTHETIC-tally.json']);
});

// ---- further checks

test('blank forms and sheets returned with only a code: every case is "no answer", nothing is filled in', t => {
  const { res, json } = run(t, { 'blank.docx': docx('MA7', 'A', { code: 'SYNTH-R1' }), 'blank.csv': csv('MA7', 'B', { code: 'SYNTH-R1' }) });
  assert.equal(res.responses.A.every(r => r.status === 'no-response' && r.outcome === null), true);
  assert.equal(res.responses.B.every(r => r.status === 'no-response'), true);
  assert.equal(res.responses.A.length, 20); assert.equal(res.responses.B.length, 61);
  assert.equal(json('tally.json').partA.responses.judgment, 0);
  assert.equal(res.cases.filter(c => c.course === 'MA7').every(c => c.state === 'Pending'), true);
  assert.equal(json('part-a-responses.json').responses.every(r => Object.values(r.answers).every(a => a.status === 'blank' && a.value === undefined)), true);
});

test('Word comments and text added outside the fields are kept with their case; comment authors are never read', t => {
  const comments = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="7" w:author="Dr. Secret Name" w:date="2026-11-03T09:00:00Z" w:initials="DSN"><w:p><w:r><w:t>${S}: a Word comment</w:t></w:r></w:p></w:comment></w:comments>`;
  const edit = x => {
    let y = x.replace(/(<w:tag w:val="HM210-02\|rationale"\/>[\s\S]*?<\/w:sdt>)/, '$1<w:commentRangeStart w:id="7"/><w:commentRangeEnd w:id="7"/><w:r><w:commentReference w:id="7"/></w:r>');
    const at = y.indexOf('</w:p>', y.indexOf('<w:tag w:val="HM210-03|rationale"/>')) + 6;
    y = `${y.slice(0, at)}<w:p><w:r><w:t xml:space="preserve">${S}: a paragraph typed between the questions</w:t></w:r></w:p>${y.slice(at)}`;
    return y;
  };
  const { res, out, json } = run(t, { 'r1.docx': docx('HM210', 'A', { code: 'SYNTH-R1' }, HM_A(), { edit, extra: [['word/comments.xml', Buffer.from(comments, 'utf8')]] }) });
  assert.deepEqual(R(res, 'A', 'HM210-02', 'SYNTH-R1').entry.wordComments, [`${S}: a Word comment`]);
  assert.deepEqual(R(res, 'A', 'HM210-03', 'SYNTH-R1').entry.addedText, [`${S}: a paragraph typed between the questions`]);
  assert.deepEqual(R(res, 'A', 'HM210-01', 'SYNTH-R1').entry.wordComments, []);
  assert.deepEqual(json('part-a-responses.json').responses.find(r => r.caseCode === 'HM210-03').textAddedOutsideFields, [`${S}: a paragraph typed between the questions`]);
  for (const [file, text] of allText(out, p => p.includes('originals'))) assert.doesNotMatch(text, /Secret|DSN/, file);
});

test('a form saved by Word (revision ids, split runs, compression, a renamed style id) is read exactly like the plain form', t => {
  const answers = { 'HM210-01': A(V.p, { comments: `${S}: a comment long enough to be split by the save` }), 'HM210-02': A(V.n, { reading: 'other', 'reading|other-text': `${S}: other` }), 'HM210-03': A(V.i) };
  const answersB = { 'HM210-02-R1': { rating: 'appropriate-as-written' }, 'HM210-02-R2': { rating: 'acceptable-with-edits', note: `${S}: an edit long enough to be split` },
    'HM210-02-R3': { rating: 'cannot-judge', 'cannot-judge-reason': 'outside-my-expertise' }, 'HM210-03-R1': { rating: 'not-appropriate' } };
  const { res } = run(t, { 'plain.docx': docx('HM210', 'A', { code: 'SYNTH-R1' }, answers), 'saved.docx': docx('HM210', 'A', { code: 'SYNTH-R2' }, answers, { word: true }),
    'plain-b.docx': docx('HM210', 'B', { code: 'SYNTH-R1' }, answersB), 'saved-b.docx': docx('HM210', 'B', { code: 'SYNTH-R2' }, answersB, { word: true }) });
  for (const name of ['saved.docx', 'saved-b.docx']) {
    const entries = readZip(fs.readFileSync(path.join(res.inbox, name))), text = n => entries.find(([x]) => x === n)[1].toString('utf8');
    assert.match(text('word/document.xml'), /w14:paraId="[0-9A-F]{8}"[\s\S]*<w:proofErr w:type="spellStart"\/>/);
    // The case texts now carry a style id the blank form never had; they are found by the style's name.
    assert.match(text('word/document.xml'), /<w:pStyle w:val="Casetext"\/>/); assert.doesNotMatch(text('word/document.xml'), /w:val="CaseText"/);
    assert.match(text('word/styles.xml'), /w:styleId="Casetext"[^>]*>\s*<w:name w:val="Case text"\/>/); assert.doesNotMatch(text('word/styles.xml'), /w:styleId="CaseText"/);
  }
  const same = (part, codes) => { for (const code of codes) {
    const a = R(res, part, code, 'SYNTH-R1'), b = R(res, part, code, 'SYNTH-R2');
    assert.deepEqual([b.status, b.outcome, JSON.stringify(b.entry.answers), b.entry.addedText, b.entry.textCheck, issuesOf(b)], [a.status, a.outcome, JSON.stringify(a.entry.answers), a.entry.addedText, a.entry.textCheck, issuesOf(a)], code);
    assert.ok(!b.entry.textCheck, `${code}: no case text is reported as changed`);
  } };
  same('A', ['HM210-01', 'HM210-02', 'HM210-03']);
  same('B', ['HM210-02-R1', 'HM210-02-R2', 'HM210-02-R3', 'HM210-03-R1']);
  assert.deepEqual([F(res, 'saved.docx').notes, F(res, 'saved-b.docx').notes], [[], []]);
  // A form whose styles part is missing or broken: the style id is still read as a name, and a broken part rejects the file.
  const noStyles = writeZip(readZip(fs.readFileSync(path.join(res.inbox, 'plain.docx'))).filter(([n]) => n !== 'word/styles.xml'));
  const badStyles = writeZip(readZip(fs.readFileSync(path.join(res.inbox, 'plain.docx'))).map(([n, d]) => [n, n === 'word/styles.xml' ? Buffer.from('<w:styles><w:style>', 'utf8') : d]));
  const more = run(t, { 'no-styles.docx': noStyles, 'bad-styles.docx': badStyles });
  assert.deepEqual([R(more.res, 'A', 'HM210-01', 'SYNTH-R1').status, R(more.res, 'A', 'HM210-01', 'SYNTH-R1').entry.textCheck], ['judgment', null]);
  assert.equal(F(more.res, 'bad-styles.docx').status, 'rejected');
  assert.match(F(more.res, 'bad-styles.docx').reasons.join(), /its styles \(word\/styles\.xml\) are not well-formed XML/);
});

test('a changed case text holds the answer until the coordinator records which text was judged', t => {
  const kase = pkg.courses.get('HM210').cases.find(c => /bare hands/.test(`${c.source} ${c.target}`));
  assert.ok(kase, 'the HM210 Part A form holds the words "bare hands"');
  const files = { 'r1.docx': docx('HM210', 'A', { code: 'SYNTH-R1' }, HM_A(), { edit: x => x.replace('bare hands', 'gloved hands') }) };
  const first = run(t, files);
  const r = R(first.res, 'A', kase.code, 'SYNTH-R1');
  assert.equal(r.status, 'held');
  assert.match(issuesOf(r).join(), /hold:case-text:.*differs? from the text sent; the coordinator asks which text was judged/);
  const clar = first.table('clarification-requests.csv'), row = clar.find(x => x[0] === `A|SYNTH-R1|${kase.code}|case-text`);
  assert.ok(row);
  const answer = (text) => { const p = path.join(first.root, `clar-${crypto.randomUUID()}.csv`); fs.writeFileSync(p, I.toCsv([clar[0], Object.assign([...row], { 9: text, 10: '2026-11-12', 11: 'SYNTH-COORD' })])); return p; };
  const asSent = run(t, files, { clarifications: answer('JUDGED ON THE TEXT AS SENT') });
  assert.deepEqual([R(asSent.res, 'A', kase.code, 'SYNTH-R1').status, R(asSent.res, 'A', kase.code, 'SYNTH-R1').outcome], ['judgment', 'ALIGNED']);
  const changed = run(t, files, { clarifications: answer('JUDGED ON THE CHANGED TEXT') });
  assert.equal(R(changed.res, 'A', kase.code, 'SYNTH-R1').status, 'excluded');
  assert.match(C(changed.res, kase.code).reasons.join(), /SYNTH-R1: judged a changed text, so the answer is not counted/);
});

test('a form whose case heading was altered is still read; the texts that cannot be checked hold the answers', t => {
  const answersB = { 'HM210-02-R1': { rating: 'appropriate-as-written' }, 'HM210-02-R2': { rating: 'not-appropriate' }, 'HM210-03-R1': { rating: 'appropriate-as-written' }, 'HM210-03-R2': { rating: 'acceptable-with-edits' } };
  const alter = x => { assert.ok(x.includes('HM210-02 · ')); return x.replace('HM210-02 · ', 'HM210-O2 · '); };
  const { res } = run(t, { 'a.docx': docx('HM210', 'A', { code: 'SYNTH-R1' }, HM_A(), { edit: alter }), 'b.docx': docx('HM210', 'B', { code: 'SYNTH-R1' }, answersB, { edit: alter }),
    'other.docx': docx('HM210', 'A', { code: 'SYNTH-R2' }, HM_A()) });
  assert.deepEqual(res.files.map(f => [f.path, f.status]), [['a.docx', 'counted'], ['b.docx', 'counted'], ['other.docx', 'counted']]);
  const a2 = R(res, 'A', 'HM210-02', 'SYNTH-R1');
  assert.equal(a2.status, 'held');
  assert.match(issuesOf(a2).join(), /hold:case-text:the case heading was not found, so its texts could not be compared with the texts sent; the coordinator asks which text was judged/);
  assert.equal(R(res, 'A', 'HM210-01', 'SYNTH-R1').status, 'held'); // its section now runs on to HM210-03, so it is not laid out as sent
  assert.deepEqual([R(res, 'A', 'HM210-03', 'SYNTH-R1').status, R(res, 'A', 'HM210-02', 'SYNTH-R2').status], ['judgment', 'judgment']);
  for (const code of ['HM210-02-R1', 'HM210-02-R2']) {
    const b = R(res, 'B', code, 'SYNTH-R1');
    assert.equal(b.status, 'held', code);
    assert.ok(issuesOf(b).some(i => /^hold:case-text:the case heading was not found/.test(i)), code);
  }
  // Proposals left unanswered have nothing to hold.
  assert.deepEqual([R(res, 'B', 'HM210-02-R3', 'SYNTH-R1').status, R(res, 'B', 'HM210-02-R4', 'SYNTH-R1').status], ['no-response', 'no-response']);
  assert.deepEqual([R(res, 'B', 'HM210-03-R1', 'SYNTH-R1').status, R(res, 'B', 'HM210-03-R2', 'SYNTH-R1').status], ['rating', 'rating']);
});

test('clarifications settle only open issues; the answer as returned is kept beside the clarified one', t => {
  const r1 = { 'HM210-01': { ...A(V.a), 'within-expertise': undefined }, 'HM210-02': { ...A(V.a), alignment: undefined }, 'HM210-03': { ...A(V.a), alignment: undefined } };
  for (const a of Object.values(r1)) for (const k of Object.keys(a)) if (a[k] === undefined) delete a[k];
  const files = { 'r1.docx': docx('HM210', 'A', { code: 'SYNTH-R1' }, r1) };
  const first = run(t, files), clar = first.table('clarification-requests.csv');
  const row = (id, question, answer, date = '2026-11-12') => Object.assign([...clar.find(x => x[0] === id) || [id, '', '', '', '', question]], { 5: question, 9: answer, 10: date, 11: 'SYNTH-COORD' });
  const p = path.join(first.root, 'clar.csv');
  fs.writeFileSync(p, I.toCsv([clar[0],
    row('A|SYNTH-R1|HM210-02|alignment', 'alignment', 'Partially aligned'), row('A|SYNTH-R1|HM210-03|alignment', 'alignment', 'NO ANSWER'),
    row('A|SYNTH-R1|HM210-01|within-expertise', 'within-expertise', 'NO ANSWER'), row('A|SYNTH-R1|HM210-01|within-expertise', 'confidence', 'High'),
    row('A|SYNTH-R1|HM210-01|within-expertise', 'within-expertise', 'Yes', 'next week'), row('A|SYNTH-R1|HM210-01|nothing', 'alignment', 'Aligned'),
    row('A|SYNTH-R1|HM210-01|within-expertise', 'within-expertise', 'Mostly')]));
  const second = run(t, files, { clarifications: p });
  const two = R(second.res, 'A', 'HM210-02', 'SYNTH-R1');
  assert.deepEqual([two.status, two.outcome], ['judgment', 'PARTIALLY_ALIGNED']);
  const j = second.json('part-a-responses.json').responses.find(x => x.caseCode === 'HM210-02').answers.alignment;
  assert.deepEqual([j.value, j.source, j.clarifiedOn, j.asReturned.status], ['partially-aligned', 'clarification', '2026-11-12', 'blank']);
  assert.equal(R(second.res, 'A', 'HM210-03', 'SYNTH-R1').status, 'no-judgment');
  assert.equal(R(second.res, 'A', 'HM210-01', 'SYNTH-R1').status, 'held');
  assert.deepEqual(second.res.clar.notApplied.map(n => n.reason), ['question 0 needs Yes or No; it cannot be confirmed blank', 'the issue concerns within-expertise, not "confidence"',
    'date_clarified is blank or not a readable date (use 2026-11-03)', 'no open issue of this import has this id; a returned answer is changed only to settle an open issue',
    '"Mostly" is not one of the form\'s options for question 0 (within your expertise)']);
});

test('generated sheets guard against spreadsheet formulas; the JSON keeps the exact text', t => {
  const answers = { 'HM210-01': A(V.a, { rationale: '=1+1', comments: '@SUM(A1)' }), 'HM210-02': A(V.a, { rationale: '+2', comments: '-3+4' }), 'HM210-03': A(V.a, { rationale: '- a list item' }) };
  const { table, json } = run(t, { 'r1.csv': csv('HM210', 'A', { code: 'SYNTH-R1' }, answers) });
  const rows = table('part-a-responses.csv'), h = rows[0], get = (code, col) => rows.find(r => r[0] === code)[h.indexOf(col)];
  assert.deepEqual([get('HM210-01', 'rationale'), get('HM210-01', 'comments'), get('HM210-02', 'rationale'), get('HM210-02', 'comments'), get('HM210-03', 'rationale')], ['\'=1+1', '\'@SUM(A1)', '\'+2', '\'-3+4', '\'- a list item']);
  assert.equal(json('part-a-responses.json').responses.find(r => r.caseCode === 'HM210-01').answers.rationale.text, '=1+1');
  assert.equal(json('part-a-responses.json').responses.find(r => r.caseCode === 'HM210-03').answers.rationale.text, '- a list item');
  // Tabs and carriage returns that begin a cell are guarded too; a text that only contains a sign is left as it is.
  assert.deepEqual(I.parseCsv(I.toCsv([['\tx', '\rx', 'a=b', 'x-1', '']]).replace(/^﻿/, '')), [['\'\tx', '\'\rx', 'a=b', 'x-1', '']]);
});

test('the records hold codes only: no software answer, provisional verdict, set or name reaches them', t => {
  const C0 = JSON.parse(fs.readFileSync(path.join(I.DEFAULT_PKG, 'coordinator-restricted', 'cases.json'), 'utf8'));
  const restricted = [...C0.cases.map(c => c.id), ...new Set(C0.cases.flatMap(c => c.proposals.map(p => p.from))), ...C0.cases.map(c => (c.provisional && c.provisional.why) || '').filter(w => w.length > 20)];
  const { out } = run(t, { 'r1.docx': docx('HM210', 'A', { code: 'SYNTH-R1' }, HM_A()), 'r2.csv': csv('HM210', 'A', { code: 'SYNTH-R2' }, { ...HM_A(), 'HM210-01': A(V.n) }),
    'b1.docx': docx('MA7', 'B', { code: 'SYNTH-R1' }, { 'MA7-01-R1': { rating: 'appropriate' } }), 'named.docx': docx('IE310', 'A', { code: 'Dr. Jane Doe' }, { 'IE310-01': A(V.a) }) });
  for (const [file, text] of allText(out, p => p.includes('originals'))) {
    for (const s of restricted) assert.equal(text.includes(s), false, `${file} holds "${s}"`);
    assert.doesNotMatch(text, /provisional|claude|anthropic|minimax|gemini|openrouter|sonnet|jane|\bset [123]\b/i, file);
  }
});

test('the command line: package check, a synthetic import, and refusals with exit code 1', t => {
  const check = cli(['--check-package']);
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /58 cases and 160 proposals in 7 courses; the 13 forms and sheets match the importer/);
  const root = tmp(t), inbox = path.join(root, 'inbox'), out = path.join(root, 'out');
  putFiles(inbox, { 'r1.csv': csv('HM210', 'A', { code: 'SYNTH-R1' }, HM_A()) });
  const ok = cli(['--inbox', inbox, '--out', out, '--synthetic']);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /^SYNTHETIC TEST IMPORT\. 1 file: 1 counted, 0 repeated, 0 in conflict, 0 held, 0 rejected, 0 not read, 0 ignored$/m);
  assert.match(ok.stdout, /inbox unchanged: yes/);
  const again = cli(['--inbox', inbox, '--out', out, '--synthetic']);
  assert.equal(again.status, 1); assert.match(again.stderr, /^refused: .* is not empty/);
  for (const args of [['--bogus'], ['--inbox', inbox], ['--inbox'], ['--inbox', inbox, '--out', path.join(inbox, 'x'), '--synthetic']]) {
    const r = cli(args);
    assert.equal(r.status, 1, args.join(' ')); assert.match(r.stderr, /^refused: /, args.join(' '));
  }
  assert.equal(fs.existsSync(path.join(inbox, 'x')), false);
});
