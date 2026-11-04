'use strict';
// Offline import and tally of the faculty responses returned for the align-1 adjudication package, Version 2.
//
//   node scripts/import-align1-faculty-responses.cjs --inbox <dir> --out <new dir> [--tracking <csv>] [--reassignments <csv>]
//        [--clarifications <csv>] [--pkg <dir>] [--synthetic]
//   node scripts/import-align1-faculty-responses.cjs --check-package [--pkg <dir>]
//
// Reads the returned Word forms (.docx) and response sheets (.csv) in the inbox and writes a restricted record of them, with
// agreement counts, into a new folder. It makes no network request. It never writes to the inbox, the package or an existing
// folder, never fills in a missing answer and never decides a case. From the package it takes only the case and proposal codes,
// the courses, the relationship types and the texts sent: never the software's answers, the provisional verdicts or the sets.
// How coordinators use it: docs/faculty-review/align-1-response-import-guide.md.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_PKG = path.join(ROOT, 'docs', 'faculty-review', 'align-1-dev-adjudication-v2');
const V1_DIR = path.join(ROOT, 'docs', 'faculty-review', 'align-1-dev-adjudication');
const IMPORTER = 'align1-faculty-import-1', PACKAGE_VERSION = 'align-1-dev-adjudication-v2';
// Paired cases needed before a percentage (MIN_PERCENT_N) or a chance-corrected statistic (MIN_CHANCE_N) is reported.
const MIN_PERCENT_N = 5, MIN_CHANCE_N = 10;
const SYNTH = 'SYNTH-';
// Limits that keep a damaged or hostile file from exhausting memory or time. A returned form is well under 5 MB. In the Version 2
// forms the largest text part (word/document.xml) is under 1 MB, elements nest at most 10 deep, and paragraphs and form controls at
// most 2 deep. The parts that are read (MAX_XML_BYTES) and their nesting (MAX_NEST) bound the time a form takes to read.
const MAX_FILE_BYTES = 50 * 1024 * 1024, MAX_ENTRIES = 1000, MAX_PART_BYTES = 32 * 1024 * 1024, MAX_TOTAL_BYTES = 128 * 1024 * 1024, MAX_OPTION_CELL = 4000;
const MAX_XML_BYTES = 8 * 1024 * 1024, MAX_DEPTH = 256, MAX_NEST = 8;

class FileError extends Error {} // a returned file that cannot be read: it is recorded and left out
class Refusal extends Error {} // the import cannot run safely: nothing is written

// ---- small helpers
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const hashFile = file => { // read in chunks, so a large file is never held in memory
  const h = crypto.createHash('sha256'), fd = fs.openSync(file, 'r'), b = Buffer.alloc(1 << 20);
  try { let n; while ((n = fs.readSync(fd, b, 0, b.length, null)) > 0) h.update(b.subarray(0, n)); } finally { fs.closeSync(fd); }
  return h.digest('hex');
};
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const squash = s => String(s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
// Option words compare without case, curly quotes, dash variants, extra spaces or a trailing full stop or colon.
const fold = s => squash(String(s ?? '').normalize('NFC').replace(/[‘’‛ʼ]/g, '\'').replace(/[“”]/g, '"')
  .replace(/[‐-―−]/g, '-')).replace(/[\s.:;,]+$/, '').toLowerCase();
const tidy = s => String(s ?? '').replace(/\r\n?/g, '\n').trim(); // a written answer as given, without outer spaces
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const inside = (child, parent) => { const r = path.relative(path.resolve(parent), path.resolve(child)); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const byKey = (list, key) => list.reduce((m, x) => m.set(key(x), [...(m.get(key(x)) || []), x]), new Map());
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const pct = (k, n) => `${Math.round((1000 * k) / n) / 10}%`;
const round3 = x => Math.round(x * 1000) / 1000;
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const isoDate = (y, m, d) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null; };
const monthOf = w => { const x = w.toLowerCase().replace(/\.$/, ''); return x.length >= 3 ? MONTHS.findIndex(m => m.startsWith(x)) + 1 : 0; };
// Dates are read when unambiguous (2026-11-03, 3 November 2026, Nov 3, 2026); anything else, such as 11/03/2026, is kept as written.
const parseDate = s => {
  const v = squash(s); let m;
  if (!v) return { raw: '', iso: null };
  if ((m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) return { raw: v, iso: isoDate(+m[1], +m[2], +m[3]) };
  if ((m = v.match(/^(\d{1,2})[\s-]+([A-Za-z]+\.?)[\s,-]+(\d{4})$/)) && monthOf(m[2])) return { raw: v, iso: isoDate(+m[3], monthOf(m[2]), +m[1]) };
  if ((m = v.match(/^([A-Za-z]+\.?)\s+(\d{1,2}),?\s+(\d{4})$/)) && monthOf(m[1])) return { raw: v, iso: isoDate(+m[3], monthOf(m[1]), +m[2]) };
  return { raw: v, iso: null };
};
const dateText = d => (d && d.raw ? (d.iso || `${d.raw} (as written)`) : '');

// ---- CSV: written like the package's sheets (UTF-8 with BOM, CRLF, every cell quoted). A cell that a spreadsheet could read as a
// formula (one beginning with =, +, -, @, a tab or a carriage return) gets a leading apostrophe; the JSON files hold the exact text.
const csvCell = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
const toCsv = rows => `﻿${rows.map(r => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
const parseCsv = (text, delim = ',') => {
  const rows = []; let row = [], cur = '', q = false, quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch !== '"') cur += ch;
      else if (text[i + 1] === '"') { cur += '"'; i++; } else {
        q = false;
        const nx = text[i + 1];
        if (nx !== undefined && nx !== delim && nx !== '\r' && nx !== '\n') throw new FileError(`text follows a closing quote in row ${rows.length + 1}`);
      }
    } else if (ch === '"' && cur === '' && !quoted) { q = true; quoted = true; } else if (ch === delim) { row.push(cur); cur = ''; quoted = false; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = ''; quoted = false;
    } else cur += ch;
  }
  if (q) throw new FileError('a quoted cell is never closed (the sheet may be cut short)');
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
};
const decodeText = buf => {
  const utf8 = b => new TextDecoder('utf-8', { fatal: true }).decode(b);
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    try { return { text: utf8(buf.subarray(3)), encoding: 'UTF-8' }; } catch { throw new FileError('the sheet is marked as UTF-8 but holds bytes that are not UTF-8'); }
  }
  if (buf[0] === 0xff && buf[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(buf.subarray(2)), encoding: 'UTF-16' };
  if (buf[0] === 0xfe && buf[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(buf.subarray(2)), encoding: 'UTF-16' };
  try { return { text: utf8(buf), encoding: 'UTF-8' }; } catch { return { text: new TextDecoder('windows-1252').decode(buf), encoding: 'Windows-1252' }; }
};

// ---- .docx: a zip archive read entry by entry from its central directory. Every entry is decompressed, one at a time and within
// the size limits, and checked against its CRC; only the parts named in `keep` are returned. Entry names are never used as paths.
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const unzip = (buf, keep = ['word/document.xml', 'word/comments.xml', 'word/styles.xml']) => {
  if (buf.length >= 8 && buf.readUInt32LE(0) === 0xe011cfd0 && buf.readUInt32LE(4) === 0xe11ab1a1) throw new FileError('a password-protected Word file or an old .doc file, not a .docx form');
  if (buf.length < 22 || buf.readUInt32LE(0) !== 0x04034b50) throw new FileError('not a .docx file (it is not a zip archive)');
  let e = buf.length - 22; const stop = Math.max(0, buf.length - 22 - 65535);
  while (e >= stop && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < stop) throw new FileError('a damaged .docx: the end of the archive is missing (the file may be cut short)');
  const count = buf.readUInt16LE(e + 10), cdSize = buf.readUInt32LE(e + 12), cdAt = buf.readUInt32LE(e + 16);
  if (count === 0xffff || cdAt === 0xffffffff || cdAt + cdSize > e) throw new FileError('a damaged .docx: its archive directory is out of range');
  if (count > MAX_ENTRIES) throw new FileError(`it holds ${count} archive entries, far more than a form`);
  const parts = new Map(), names = new Set(); let p = cdAt, total = 0;
  for (let k = 0; k < count; k++) {
    if (p + 46 > e || buf.readUInt32LE(p) !== 0x02014b50) throw new FileError('a damaged .docx: its archive directory is broken');
    const flags = buf.readUInt16LE(p + 8), method = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16), csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28), at = buf.readUInt32LE(p + 42), name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (flags & 1) throw new FileError('an encrypted .docx');
    if (names.has(name)) throw new FileError(`a damaged .docx: entry ${name} appears twice`);
    names.add(name);
    if (at + 30 > buf.length || buf.readUInt32LE(at) !== 0x04034b50) throw new FileError(`a damaged .docx: entry ${name} is missing`);
    const start = at + 30 + buf.readUInt16LE(at + 26) + buf.readUInt16LE(at + 28);
    if (start + csize > buf.length) throw new FileError(`a damaged .docx: entry ${name} is cut short`);
    if (usize > MAX_PART_BYTES || (total += usize) > MAX_TOTAL_BYTES) throw new FileError(`entry ${name} is too large to be part of a form`);
    if (keep.includes(name) && usize > MAX_XML_BYTES) throw new FileError(`entry ${name} is ${Math.round(usize / 1048576)} MB, more than a form's text can be (${MAX_XML_BYTES / 1048576} MB)`);
    let data;
    if (method === 0) data = buf.subarray(start, start + csize);
    else if (method === 8) {
      try { data = zlib.inflateRawSync(buf.subarray(start, start + csize), { maxOutputLength: MAX_PART_BYTES }); } catch { throw new FileError(`a damaged .docx: entry ${name} cannot be decompressed`); }
    } else throw new FileError(`entry ${name} uses an unknown compression method`);
    if (data.length !== usize || crc32(data) !== crc) throw new FileError(`a damaged .docx: entry ${name} fails its checksum`);
    if (keep.includes(name)) parts.set(name, data);
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return parts;
};

// ---- XML: one left-to-right pass that also checks that the document is well formed. It tolerates the attributes, revision ids and
// namespaces Word adds when it saves, refuses a document type declaration, and never scans the same text twice, so a damaged or
// hostile file cannot make it slow.
const TAG_AT = /<(\/)?([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)((?:\s+[A-Za-z_][\w.:-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/)?>/y;
const BAD_AMP = /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/;
// A character reference must name a character XML allows (Char in XML 1.0), such as &#x41;; &#0; or &#x110000; is not well formed.
const xmlChar = n => n === 0x9 || n === 0xa || n === 0xd || (n >= 0x20 && n <= 0xd7ff) || (n >= 0xe000 && n <= 0xfffd) || (n >= 0x10000 && n <= 0x10ffff);
const badCharRef = s => s.includes('&#') && [...s.matchAll(/&#(?:x([0-9a-fA-F]+)|(\d+));/g)].some(m => !xmlChar(m[1] !== undefined ? parseInt(m[1], 16) : parseInt(m[2], 10)));
const scanXml = xml => {
  const tags = [], stack = []; let i = 0, rooted = false;
  while (i < xml.length) {
    const lt = xml.indexOf('<', i), text = xml.slice(i, lt < 0 ? xml.length : lt);
    if (BAD_AMP.test(text) || badCharRef(text)) return { error: `a bad character reference near position ${i}` };
    if (!stack.length && text.trim()) return { error: `text outside the document element near position ${i}` };
    if (lt < 0) break;
    const skip = (open, close, what) => { const e = xml.indexOf(close, lt + open.length); if (e < 0) return `an unclosed ${what}`; i = e + close.length; return null; };
    let bad = null;
    if (xml.startsWith('<?', lt)) bad = skip('<?', '?>', 'processing instruction');
    else if (xml.startsWith('<!--', lt)) bad = skip('<!--', '-->', 'comment');
    else if (xml.startsWith('<![CDATA[', lt)) bad = stack.length ? skip('<![CDATA[', ']]>', 'CDATA section') : 'a CDATA section outside the document element';
    else if (xml.startsWith('<!', lt)) bad = 'a document type declaration';
    else {
      TAG_AT.lastIndex = lt;
      const m = TAG_AT.exec(xml);
      if (!m) return { error: `a malformed tag near position ${lt}` };
      i = TAG_AT.lastIndex;
      if (BAD_AMP.test(m[3]) || badCharRef(m[3])) return { error: `a bad character reference in <${m[2]}>` };
      const tag = { at: lt, end: i, name: m[2], close: !!m[1], self: !!m[4], attrs: m[3] };
      if (tag.close) {
        if (tag.self || tag.attrs) return { error: `a malformed closing tag </${tag.name}>` };
        const open = stack.pop();
        if (open === undefined || tags[open].name !== tag.name) return { error: `</${tag.name}> does not close the open element` };
        tags[open].closeIndex = tags.length; tag.openIndex = open;
      } else {
        if (!stack.length && rooted) return { error: 'a second document element' };
        rooted = true;
        if (!tag.self && stack.push(tags.length) > MAX_DEPTH) return { error: `elements nested more than ${MAX_DEPTH} deep`, limit: true };
      }
      tags.push(tag);
    }
    if (bad) return { error: bad };
  }
  if (stack.length || !rooted) return { error: 'the document ends inside an element, or has no document element' };
  return { tags };
};
const xmlFault = (what, verb, scan) => new FileError(`${what} ${verb} ${scan.limit ? 'too deeply nested to be read' : 'not well-formed XML'}: ${scan.error}`);
const unesc = s => s.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (m, e) => ({ lt: '<', gt: '>', quot: '"', apos: '\'', amp: '&' })[e.toLowerCase()]
  ?? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)));
// The visible text of a stretch of WordprocessingML: text runs, line breaks and tabs; deleted text and field codes are left out.
const textOf = xml => {
  let out = ''; const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:(?:br|cr)(?:\s[^>]*)?\/>|<w:tab\/>|<w:noBreakHyphen\/>/g; let m;
  while ((m = re.exec(xml))) out += m[1] !== undefined ? unesc(m[1]) : m[0].startsWith('<w:tab') ? '\t' : m[0].startsWith('<w:noBreakHyphen') ? '-' : '\n';
  return out;
};
const ON = { 1: true, true: true, on: true, 0: false, false: false, off: false };
const onOff = (attrs, fallback) => { const v = (String(attrs || '').match(/\bw(?:14)?:val\s*=\s*"([^"]*)"/) || [])[1]; return v === undefined ? fallback : ON[v.toLowerCase()] ?? null; };
const PLACEHOLDERS = new Set(['__________', 'Click or tap here to write.']);
// Paragraph styles are known by their names: Word rewrites a style's id from its name when it saves (CaseText becomes Casetext).
const styleKey = s => fold(s).replace(/[\s_-]+/g, '');
const CASE_TEXT = styleKey('Case text');
const readStyles = buf => {
  const names = new Map();
  if (!buf) return names;
  const scan = scanXml(buf.toString('utf8'));
  if (scan.error) throw xmlFault('its styles (word/styles.xml)', 'are', scan);
  const { tags } = scan, attr = (t, name) => { const m = t.attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*"([^"]*)"`)); return m ? unesc(m[1]) : undefined; };
  for (const [k, t] of tags.entries()) { // each style's direct children only, so the file is walked once
    const id = t.name === 'w:style' && !t.close && !t.self ? attr(t, 'w:styleId') : undefined;
    if (id === undefined) continue;
    for (let c = k + 1; c < t.closeIndex; c = tags[c].self ? c + 1 : tags[c].closeIndex + 1) {
      if (tags[c].name === 'w:name') { const name = attr(tags[c], 'w:val'); if (name !== undefined) names.set(id, name); break; }
    }
  }
  return names;
};
const readDocXml = (xml, styles = new Map()) => {
  const scan = scanXml(xml);
  if (scan.error) throw xmlFault('its text (word/document.xml)', 'is', scan);
  const { tags } = scan, sdts = [], paras = [];
  // Each paragraph and control below is read whole, so their nesting is bounded: the work then grows with the file, not its square.
  let nest = 0;
  for (const t of tags) {
    if (t.self || (t.name !== 'w:p' && t.name !== 'w:sdt')) continue;
    if (t.close) nest--; else if (++nest > MAX_NEST) throw new FileError(`its paragraphs and form controls are nested more than ${MAX_NEST} deep, far deeper than a form's`);
  }
  const inner = k => (tags[k].self ? '' : xml.slice(tags[k].end, tags[tags[k].closeIndex].at));
  const child = (k, name) => { // the first direct child of element k with this name, or -1
    for (let c = k + 1; c < tags[k].closeIndex; c = tags[c].self ? c + 1 : tags[c].closeIndex + 1) if (tags[c].name === name) return c;
    return -1;
  };
  for (const [k, t] of tags.entries()) {
    if (t.close || t.self || (t.name !== 'w:sdt' && t.name !== 'w:p')) continue;
    const close = tags[t.closeIndex];
    if (t.name === 'w:p') {
      const pp = child(k, 'w:pPr'), pPr = pp >= 0 ? inner(pp) : '', id = unesc((pPr.match(/<w:pStyle\s+w:val="([^"]*)"/) || [])[1] || '');
      paras.push({ at: t.at, end: close.end, style: styleKey(styles.get(id) ?? id), text: textOf(inner(k)) });
      continue;
    }
    const pk = child(k, 'w:sdtPr'), ck = child(k, 'w:sdtContent'), pr = pk >= 0 ? inner(pk) : undefined, content = ck >= 0 ? inner(ck) : '';
    const tag = pr === undefined ? undefined : (pr.match(/<w:tag\s+w:val="([^"]*)"\s*\/>/) || [])[1];
    const s = { at: t.at, end: close.end, tag: tag === undefined ? null : unesc(tag) };
    if (pr !== undefined && /<w14:checkbox\b/.test(pr)) {
      const ck = pr.match(/<w14:checked\b([^>]*)\/>/), checked = ck ? onOff(ck[1], true) : false, glyph = squash(textOf(content));
      const shown = glyph === '☐' ? false : glyph === '☒' || glyph === '☑' ? true : null;
      Object.assign(s, { kind: 'box', checked: !!checked, inconsistent: checked === null || shown === null || shown !== checked });
    } else {
      const ph = pr === undefined ? null : pr.match(/<w:showingPlcHdr\b([^>]*?)\/>/), placeholder = ph ? onOff(ph[1], true) !== false : false;
      const value = placeholder ? '' : tidy(textOf(content));
      Object.assign(s, { kind: 'text', value: PLACEHOLDERS.has(value) ? '' : value });
    }
    sdts.push(s);
  }
  // Text outside the form's controls: each control is blanked out, position for position, so that only the form's own text is left.
  let masked = '', from = 0;
  for (const s of sdts) if (s.at >= from) { masked += xml.slice(from, s.at) + ' '.repeat(s.end - s.at); from = s.end; }
  masked += xml.slice(from);
  for (const p of paras) p.outside = squash(textOf(masked.slice(p.at, p.end)));
  const anchors = [...xml.matchAll(/<w:comment(?:RangeStart|Reference)\s+w:id="(\d+)"/g)].map(m => ({ id: m[1], at: m.index }));
  return { xml, sdts, paras, anchors, tracked: /<w:(?:ins|del|moveFrom|moveTo)\s/.test(xml) };
};
// Word comments: only their text is read, never the author's name or initials.
const readComments = buf => {
  if (!buf) return new Map();
  const xml = buf.toString('utf8'), scan = scanXml(xml);
  if (scan.error) throw xmlFault('its comments (word/comments.xml)', 'are', scan);
  const out = new Map();
  for (const m of xml.matchAll(/<w:comment\s[^>]*?w:id="(\d+)"[^>]*(?<!\/)>([\s\S]*?)<\/w:comment>/g)) {
    const paras = [...m[2].matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)].map(p => textOf(p[1]));
    out.set(m[1], tidy(paras.join('\n')));
  }
  return out;
};

// ---- the forms: this mirrors scripts/export-align1-adjudication-v2.cjs, and every import first checks it against the package's
// blank forms and sheets (checkPackage), so a difference stops the import instead of misreading a return.
const TYPES = {
  'CLO-PO': { title: 'CLO and program outcome', item: 'CLO', mapTo: 'program outcome', list: null, src: 'PO', tgt: 'CLO', reading: ['A CLO can be aligned by developing part of the PO', 'A CLO is aligned only if it addresses every part of the PO'] },
  'CLO-anyPO': { title: 'CLO and a list of program outcomes', item: 'CLO', mapTo: null, list: 'program outcome', src: 'PO it fits', tgt: 'CLO', reading: ['A CLO can be aligned by developing part of the PO it fits', 'A CLO is aligned only if it addresses every part of the PO it fits'] },
  'CLO-EGA': { title: 'CLO and expected graduate attribute', item: 'CLO', mapTo: 'graduate attribute', list: null, src: 'EGA', tgt: 'CLO', reading: ['A CLO can be aligned by developing the attribute as a whole', 'A CLO is aligned only if it reflects each element of the attribute\'s name'] },
  'CLO-anyEGA': { title: 'CLO and the list of graduate attributes', item: 'CLO', mapTo: null, list: 'graduate attribute', src: 'EGA it fits', tgt: 'CLO', reading: ['A CLO can be aligned by developing the attribute it fits as a whole', 'A CLO is aligned only if it reflects each element of that attribute\'s name'] },
  'ILO-CLO': { title: 'ILO and course learning outcome', item: 'ILO', mapTo: 'CLO', list: null, src: 'CLO', tgt: 'ILO', reading: ['An ILO can be aligned by developing part of the CLO', 'An ILO is aligned only if it addresses every part of the CLO'] },
};
const options = (labels, extra = {}) => labels.map(l => ({ key: slug(l), label: l, ...(extra[l] || {}) }));
const BLOOM = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create', 'Not applicable', 'Cannot tell'];
const INSUFFICIENT = { aliases: ['Insufficient information'], code: 'INSUFFICIENT_INFORMATION' };
const OTHER_A = { key: 'other', label: 'Other (describe):', aliases: ['Other'], other: true };
const OTHER_B = { key: 'other', label: 'Other:', aliases: ['Other'], other: true };
const HEAD_A = ['reviewer_code', 'date_returned', 'case_code', 'course', 'relationship', 'within_expertise (Yes / No - outside my expertise)',
  'alignment (Aligned / Partially aligned / Not aligned / Insufficient information)', 'which_listed_outcomes_fit (list cases only)', 'rationale',
  'reading_applied (Part / Every part / Did not affect / Other)', 'reading_other', 'belongs_in_course (Yes / No / Unsure / Insufficient information)',
  'belongs_in_course_note', 'course_fit_affected_alignment (Yes / No)',
  'recommendation (No change / Revise text / Re-map / Remove / Refer / Insufficient information / Other)', 're-map_target', 'recommendation_other',
  'bloom_source (optional)', 'bloom_target (optional)', 'confidence (High / Medium / Low)', 'comments'];
const HEAD_B = ['reviewer_code', 'date_returned', 'case_code', 'proposal_code', 'proposal_type', 'proposal_text',
  'rating (rewrites: Appropriate as written / Acceptable with edits / Not appropriate / Cannot judge; re-mappings: Appropriate / Appropriate if a target is named / Not appropriate / Cannot judge)',
  'cannot_judge_reason (Outside my expertise / Insufficient information / Other)', 'concerns', 're-map_target', 'suggested_edit_or_note'];
const memo = fn => { const m = new Map(); return (...a) => { const k = a.join('|'); if (!m.has(k)) m.set(k, fn(...a)); return m.get(k); }; };
const questionsA = memo(type => {
  const t = TYPES[type];
  return [
    { q: 'within-expertise', kind: 'one', title: 'question 0 (within your expertise)', csv: HEAD_A[5],
      options: [{ key: 'yes', label: 'Yes', code: 'WITHIN_EXPERTISE' }, { key: 'no-it-is-outside-my-expertise', label: 'No, it is outside my expertise', aliases: ['No - outside my expertise', 'No'], code: 'OUTSIDE_EXPERTISE' }] },
    { q: 'alignment', kind: 'one', title: 'question 1 (alignment)', csv: HEAD_A[6],
      options: [{ key: 'aligned', label: 'Aligned', code: 'ALIGNED' }, { key: 'partially-aligned', label: 'Partially aligned', code: 'PARTIALLY_ALIGNED' },
        { key: 'not-aligned', label: 'Not aligned', code: 'NOT_ALIGNED' }, { key: 'insufficient-information-to-judge', label: 'Insufficient information to judge', ...INSUFFICIENT }] },
    ...(t.list ? [{ q: 'fits', kind: 'text', title: `question 1 (which ${t.list}s it fits)`, csv: HEAD_A[7] }] : []),
    { q: 'rationale', kind: 'text', title: 'question 2 (rationale)', csv: HEAD_A[8] },
    { q: 'reading', kind: 'one', title: 'question 3 (reading applied)', csv: HEAD_A[9], otherCsv: HEAD_A[10],
      options: [{ key: 'part', label: t.reading[0], aliases: ['Part'] }, { key: 'every-part', label: t.reading[1], aliases: ['Every part'] },
        { key: 'did-not-affect', label: 'The distinction did not affect my answer for this case', aliases: ['Did not affect'] }, OTHER_A] },
    { q: 'course-fit', kind: 'one', title: 'question 4 (course fit)', csv: HEAD_A[11], options: options(['Yes', 'No', 'Unsure', 'Insufficient information to judge'], { 'Insufficient information to judge': INSUFFICIENT }) },
    { q: 'course-fit-note', kind: 'text', title: 'question 4 (course-fit note)', csv: HEAD_A[12] },
    { q: 'course-fit-affected-alignment', kind: 'one', title: 'question 4b (course fit affected the alignment answer)', csv: HEAD_A[13], options: options(['Yes', 'No']) },
    { q: 'recommendation', kind: 'one', title: 'question 5 (recommendation)', csv: HEAD_A[14], otherCsv: HEAD_A[16],
      options: [{ key: 'no-change', label: 'No change' }, { key: 'revise', label: `Revise the ${t.item} text`, aliases: ['Revise text'] },
        ...(t.mapTo ? [{ key: 're-map', label: t.item === 'ILO' ? 'Keep the ILO text and link it to a different CLO' : `Keep the CLO text and map it to a different ${t.mapTo}`, aliases: ['Re-map'] }] : []),
        { key: 'remove', label: t.item === 'CLO' ? 'Remove the CLO from this course' : 'Remove the ILO', aliases: ['Remove'] },
        { key: 'refer', label: 'Refer for a policy decision', aliases: ['Refer'] },
        { key: 'insufficient-information', label: 'Insufficient information to recommend', ...INSUFFICIENT }, OTHER_A] },
    ...(t.mapTo ? [{ q: 're-map-target', kind: 'text', title: 'question 5 (re-mapping target)', csv: HEAD_A[15] }] : []),
    { q: 'bloom-source', kind: 'one', optional: true, title: `question 6 (cognitive level of the ${t.src})`, csv: HEAD_A[17], options: options(BLOOM) },
    { q: 'bloom-target', kind: 'one', optional: true, title: `question 6 (cognitive level of the ${t.tgt})`, csv: HEAD_A[18], options: options(BLOOM) },
    { q: 'confidence', kind: 'one', title: 'question 7 (confidence)', csv: HEAD_A[19], options: options(['High', 'Medium', 'Low']) },
    { q: 'comments', kind: 'text', title: 'question 8 (comments)', csv: HEAD_A[20] },
  ];
});
const questionsB = memo((type, kind) => {
  const t = TYPES[type];
  const reason = { q: 'cannot-judge-reason', kind: 'one', title: 'the reason for "Cannot judge"', csv: HEAD_B[7], options: [...options(['Outside my expertise', 'Insufficient information']), OTHER_B] };
  const note = title => ({ q: 'note', kind: 'text', title, csv: HEAD_B[10] });
  return kind === 'rewrite' ? [
    { q: 'rating', kind: 'one', title: 'the rating', csv: HEAD_B[6], options: [{ key: 'appropriate-as-written', label: 'Appropriate as written', code: 'APPROPRIATE_AS_WRITTEN' },
      { key: 'acceptable-with-edits', label: 'Acceptable with edits', code: 'ACCEPTABLE_WITH_EDITS' }, { key: 'not-appropriate', label: 'Not appropriate', code: 'NOT_APPROPRIATE' },
      { key: 'cannot-judge', label: 'Cannot judge', code: 'CANNOT_JUDGE' }] },
    reason,
    { q: 'concerns', kind: 'many', title: 'the concerns', csv: HEAD_B[8], options: [...options(['No concerns', `The ${t.item} needed no change`,
      'Raises the cognitive level more than the course or year warrants', 'Lowers the cognitive level inappropriately', 'Changes the course\'s subject matter or scope',
      'Duplicates or restates another outcome', 'Adds, removes or changes values or attributes', 'Adds content the alignment does not need', 'Removes content the outcome needs',
      'A different remedy would be better (re-map, remove)', 'Wording, clarity or measurability']), OTHER_B] },
    note('the suggested edit or note'),
  ] : [
    { q: 'rating', kind: 'one', title: 'the rating', csv: HEAD_B[6], options: [{ key: 'appropriate', label: 'Appropriate', code: 'APPROPRIATE' },
      { key: `appropriate-only-if-a-suitable-${slug(t.mapTo)}-is-named`, label: `Appropriate only if a suitable ${t.mapTo} is named`, aliases: ['Appropriate if a target is named'], code: 'APPROPRIATE_IF_TARGET_NAMED' },
      { key: 'not-appropriate', label: 'Not appropriate', code: 'NOT_APPROPRIATE' }, { key: 'cannot-judge', label: 'Cannot judge', code: 'CANNOT_JUDGE' }] },
    reason,
    { q: 're-map-target', kind: 'text', title: 'the re-mapping target', csv: HEAD_B[9] },
    { q: 'concerns', kind: 'many', title: 'the concerns', csv: HEAD_B[8], options: [...options(['No concerns', `The ${t.item} itself should be revised`,
      `The ${t.item} should be removed`, `No suitable ${t.mapTo} exists`]), OTHER_B] },
    note('the note'),
  ];
});
const questionsOf = item => (item.kind ? questionsB(item.type, item.kind) : questionsA(item.type));
const optionOf = (q, key) => q.options.find(o => o.key === key);
const codeOf = (q, key) => { const o = optionOf(q, key); return o ? o.code || o.key.toUpperCase().replace(/-/g, '_') : null; };
const HEADER_FIELDS = { A: ['reviewer-code', 'date-returned'], B: ['reviewer-code', 'date-returned', 'part-a-returned'] };
const controlsOf = (code, q) => (q.kind === 'text' ? [{ tag: `${code}|${q.q}`, kind: 'text' }]
  : q.options.flatMap(o => [{ tag: `${code}|${q.q}|${o.key}`, kind: 'box', label: o.label }, ...(o.other ? [{ tag: `${code}|${q.q}|other-text`, kind: 'text' }] : [])]));
const formControls = (course, part) => [...HEADER_FIELDS[part].map(f => ({ tag: `header|${f}`, kind: 'text' })),
  ...(part === 'A' ? course.cases : course.proposals).flatMap(item => questionsOf(item).flatMap(q => controlsOf(item.code, q)))];

// ---- the package: read only, every file checked against its manifest
const packages = new Map();
const loadPackage = (dir = DEFAULT_PKG) => {
  const abs = path.resolve(dir);
  if (inside(abs, V1_DIR) || inside(V1_DIR, abs)) throw new Refusal('the package folder is, holds or lies inside Version 1; the importer reads Version 2 only');
  const mPath = path.join(abs, 'package-manifest.json');
  if (!fs.existsSync(mPath)) throw new Refusal(`no package-manifest.json in ${abs}`);
  const mBuf = fs.readFileSync(mPath), mSha = sha256(mBuf);
  if (packages.has(`${abs}|${mSha}`)) return packages.get(`${abs}|${mSha}`);
  const M = JSON.parse(mBuf.toString('utf8'));
  if (M.version !== PACKAGE_VERSION) throw new Refusal(`the package is ${M.version}, not ${PACKAGE_VERSION}`);
  const listed = new Map(M.files.map(f => [f.path, f]));
  const read = rel => {
    const f = listed.get(rel);
    if (!f) throw new Refusal(`${rel} is not in the package manifest`);
    const b = fs.readFileSync(path.join(abs, ...rel.split('/')));
    if (sha256(b) !== f.sha256) throw new Refusal(`${rel} has changed since the package was built (its sha256 differs from the manifest)`);
    return b;
  };
  const C = JSON.parse(read('coordinator-restricted/cases.json').toString('utf8'));
  const courses = new Map(), cases = new Map(), proposals = new Map();
  for (const c of C.cases) { // only codes, courses, types and texts are taken from the restricted records
    const key = c.code.split('-')[0];
    if (!TYPES[c.type]) throw new Refusal(`case ${c.code} has an unknown relationship type`);
    if (!courses.has(key)) {
      courses.set(key, { key, code: c.course.code, label: `${c.course.code} ${c.course.title} (${c.course.program}, year ${c.course.yearLevel})`,
        formA: c.distribution.partA, formB: c.distribution.partB, cases: [], proposals: [] });
    }
    const course = courses.get(key), kase = { code: c.code, course: key, type: c.type, source: c.source, target: c.target, proposals: [] };
    course.formB = course.formB || c.distribution.partB; // a case without proposals has no Part B form
    if (course.formA !== c.distribution.partA || (c.distribution.partB && course.formB !== c.distribution.partB) || !c.distribution.partB !== !c.proposals.length) {
      throw new Refusal(`case ${c.code} is in another form than the rest of ${key}`);
    }
    for (const p of c.proposals) {
      if (p.kind !== 'rewrite' && (p.kind !== 'remap' || !TYPES[c.type].mapTo)) throw new Refusal(`proposal ${p.code} has an unexpected kind`);
      const prop = { code: p.code, caseCode: c.code, course: key, type: c.type, kind: p.kind, text: p.kind === 'rewrite' ? p.text : null };
      kase.proposals.push(prop); course.proposals.push(prop); proposals.set(p.code, prop);
    }
    course.cases.push(kase); cases.set(c.code, kase);
  }
  const problems = [];
  for (const course of courses.values()) {
    for (const part of course.formB ? ['A', 'B'] : ['A']) {
      const formPath = part === 'A' ? course.formA : course.formB, sheetPath = formPath.replace(/-form\.docx$/, '-responses.csv');
      const parts = unzip(read(formPath)), doc = readDocXml(parts.get('word/document.xml').toString('utf8'), readStyles(parts.get('word/styles.xml')));
      const form = { path: formPath, sheet: sheetPath, controls: formControls(course, part) };
      form.tags = new Set(form.controls.map(c => c.tag));
      problems.push(...checkBlankForm(doc, form, course, part).map(p => `${formPath}: ${p}`));
      form.paraCounts = new Map();
      for (const p of doc.paras) if (p.outside) form.paraCounts.set(p.outside, (form.paraCounts.get(p.outside) || 0) + 1);
      const rows = parseCsv(decodeText(read(sheetPath)).text), head = part === 'A' ? HEAD_A : HEAD_B;
      if (JSON.stringify(rows[0]) !== JSON.stringify(head)) problems.push(`${sheetPath}: the header differs from the importer's`);
      const items = part === 'A' ? course.cases : course.proposals;
      form.blankRows = new Map(rows.slice(1).map(r => [r[part === 'A' ? 2 : 3], r]));
      const expected = items.map(item => (part === 'A' ? ['', '', item.code, course.label, TYPES[item.type].title, ...Array(16).fill('')]
        : ['', '', item.caseCode, item.code, item.kind === 'rewrite' ? `rewrite of the ${TYPES[item.type].item}` : 're-mapping',
          item.text ?? (item.type === 'ILO-CLO' ? 'keep the text; link it to a different CLO' : `keep the text; map it to a different ${TYPES[item.type].mapTo}`), '', '', '', '', '']));
      if (JSON.stringify(rows.slice(1)) !== JSON.stringify(expected)) problems.push(`${sheetPath}: the rows differ from the case records, or an answer is filled in`);
      course[`form${part}Spec`] = form;
    }
  }
  if (problems.length) throw new Refusal(`the importer's form definition does not match the package:\n  ${problems.slice(0, 12).join('\n  ')}`);
  const pkg = { dir: abs, manifestSha256: mSha, version: M.version, courses, cases, proposals };
  packages.set(`${abs}|${mSha}`, pkg);
  return pkg;
};
// A blank form must hold exactly the controls the importer expects, in order, each box with its option's words beside it, all
// unticked and empty, and every case text as recorded.
const checkBlankForm = (doc, form, course, part) => {
  const problems = [], tagged = doc.sdts.filter(s => s.tag !== null);
  if (tagged.length !== form.controls.length) problems.push(`${tagged.length} controls, expected ${form.controls.length}`);
  const paraOf = s => doc.paras.find(p => p.at <= s.at && s.end <= p.end);
  for (const [k, want] of form.controls.entries()) {
    const got = tagged[k];
    if (!got || got.tag !== want.tag || got.kind !== want.kind) { problems.push(`control ${k + 1} is ${got ? `${got.tag} (${got.kind})` : 'missing'}, expected ${want.tag} (${want.kind})`); break; }
    if (got.kind === 'box') {
      const p = paraOf(got), next = doc.sdts.find(s => s.at > got.at && p && s.at < p.end);
      const label = p ? squash(textOf(doc.xml.slice(got.end, next ? next.at : p.end))) : '';
      if (label !== want.label) problems.push(`${want.tag}: the words beside the box are "${label}", expected "${want.label}"`);
      if (got.checked || got.inconsistent) problems.push(`${want.tag} is ticked or inconsistent in the blank form`);
    } else if (got.value) problems.push(`${want.tag} is filled in the blank form`);
  }
  for (const check of textChecks(doc, course, part)) if (check.state !== 'same') problems.push(`${check.code}: ${check.message}`);
  return problems;
};
// The texts sent with each case: in Part A the two outcomes; in Part B the two outcomes and every proposed rewrite.
const textChecks = (doc, course, part) => {
  const heads = doc.paras.map((p, i) => [i, (p.text.match(/^([A-Z]+\d+-\d{2}(?:-R\d+)?) · /) || [])[1]]).filter(([, code]) => code);
  const caseHeads = heads.filter(([, code]) => !/-R\d+$/.test(code));
  return course.cases.filter(c => part === 'A' || c.proposals.length).map(c => {
    const at = caseHeads.findIndex(([, code]) => code === c.code);
    // Without its heading no text of the case can be checked: every rewrite is treated as changed, and the outcomes too.
    if (at < 0) return { code: c.code, state: 'not-found', proposals: c.proposals.filter(p => p.kind === 'rewrite').map(p => p.code), outcomes: true, message: 'the case heading was not found, so its texts could not be compared with the texts sent' };
    const from = caseHeads[at][0], to = at + 1 < caseHeads.length ? caseHeads[at + 1][0] : doc.paras.length, groups = [];
    let cur = null;
    for (const p of doc.paras.slice(from + 1, to)) { if (p.style === CASE_TEXT) (cur = cur || []).push(p.text); else if (cur) { groups.push(cur.join('\n')); cur = null; } }
    if (cur) groups.push(cur.join('\n'));
    const rewrites = c.proposals.filter(p => p.kind === 'rewrite'), want = part === 'A' ? [c.source, c.target] : [c.source, c.target, ...rewrites.map(p => p.text)];
    const changed = want.map((w, k) => (squash(groups[k]) === squash(w) ? null : k)).filter(k => k !== null);
    if (!changed.length && groups.length === want.length) return { code: c.code, state: 'same' };
    const what = changed.map(k => (k === 0 ? 'the first outcome' : k === 1 ? 'the second outcome' : `the proposed text of ${rewrites[k - 2].code}`));
    return { code: c.code, state: 'changed', proposals: changed.filter(k => k > 1).map(k => rewrites[k - 2].code), outcomes: changed.some(k => k < 2),
      message: what.length ? `${what.join(' and ')} differ${what.length === 1 ? 's' : ''} from the text sent` : 'the case\'s texts are not laid out as sent' };
  });
};

// ---- reading a returned form or sheet into answers. An answer is { status: answered | blank | multiple | invalid | damaged, value,
// raw, other, text }: value is an option key (a list for "tick any"), raw what was ticked or written, other the "Other" description.
const matchOption = (cell, q) => { const f = fold(cell); return q.options.find(o => fold(o.label) === f || (o.aliases || []).some(a => fold(a) === f)); };
// Every option named in a cell, longest first; anything left over makes the cell unreadable.
const findOptions = (cell, q) => {
  if (cell.length > MAX_OPTION_CELL) return { keys: [], leftover: 'too long to be a list of options' };
  let rest = ` ${fold(cell)} `; const keys = [];
  const words = q.options.flatMap(o => [o.label, ...(o.aliases || [])].map(w => ({ key: o.key, w: fold(w) }))).sort((a, b) => b.w.length - a.w.length);
  for (const { key, w } of words) {
    const re = new RegExp(`(^|[\\s;,|/])${escRe(w)}(?=$|[\\s;,|/.])`);
    while (re.test(rest)) { keys.push(key); rest = rest.replace(re, '$1 '); }
  }
  return { keys: q.options.map(o => o.key).filter(k => keys.includes(k)), leftover: rest.replace(/[\s;,|/.]+/g, ' ').replace(/\band\b/g, '').trim() }; // in the form's order
};
const OTHER_INLINE = /^\s*other\b\s*(?:\(describe\))?\s*[:\-–—]\s*([\s\S]*)$/i;
const readCell = (q, cell, otherCell = '') => {
  const raw = tidy(cell), otherCol = tidy(otherCell);
  if (q.kind === 'text') return raw ? { status: 'answered', text: raw } : { status: 'blank' };
  if (q.kind === 'many') {
    if (!raw) return { status: 'blank', other: otherCol };
    let other = '', rest = raw;
    const segs = raw.split(/\s*(?:;|\n|\|)\s*/), at = segs.findIndex(s => OTHER_INLINE.test(s));
    if (at >= 0) { other = segs[at].match(OTHER_INLINE)[1].trim(); rest = segs.filter((s, k) => k !== at).join('; '); }
    const { keys, leftover } = findOptions(rest, q);
    if (leftover) return { status: 'invalid', raw };
    return { status: 'answered', value: at >= 0 ? [...new Set([...keys, 'other'])] : keys, raw, other: other || otherCol };
  }
  if (!raw) return { status: 'blank', raw: '', other: otherCol };
  const one = matchOption(raw, q);
  if (one) return { status: 'answered', value: one.key, raw, other: otherCol };
  const inline = q.options.some(o => o.other) && raw.match(OTHER_INLINE);
  if (inline) return { status: 'answered', value: 'other', raw, other: [otherCol, inline[1].trim()].filter(Boolean).join('\n') };
  const { keys, leftover } = findOptions(raw, q);
  return !leftover && keys.length > 1 ? { status: 'multiple', value: keys, raw, other: otherCol } : { status: 'invalid', raw, other: otherCol };
};
const fromControls = (byTag, code, q) => {
  const one = tag => { const l = byTag.get(tag); return l && l.length === 1 ? l[0] : null; };
  if (q.kind === 'text') { const c = one(`${code}|${q.q}`); return !c || c.kind !== 'text' ? { status: 'damaged' } : c.value ? { status: 'answered', text: c.value } : { status: 'blank' }; }
  const boxes = q.options.map(o => [o, one(`${code}|${q.q}|${o.key}`)]), otherBox = q.options.some(o => o.other) ? one(`${code}|${q.q}|other-text`) : { kind: 'text', value: '' };
  if (boxes.some(([, c]) => !c || c.kind !== 'box' || c.inconsistent) || !otherBox || otherBox.kind !== 'text') return { status: 'damaged' };
  const ticked = boxes.filter(([, c]) => c.checked).map(([o]) => o), raw = ticked.map(o => o.label).join('; '), other = otherBox.value;
  if (!ticked.length) return { status: 'blank', raw, other };
  if (q.kind === 'many') return { status: 'answered', value: ticked.map(o => o.key), raw, other };
  return ticked.length === 1 ? { status: 'answered', value: ticked[0].key, raw, other } : { status: 'multiple', value: ticked.map(o => o.key), raw, other };
};
const itemsOf = (course, part) => (part === 'A' ? course.cases : course.proposals);
const readWordReturn = (buf, pkg) => {
  const parts = unzip(buf);
  if (!parts.has('word/document.xml')) throw new FileError('it has no word/document.xml, so it is not a Word document');
  const doc = readDocXml(parts.get('word/document.xml').toString('utf8'), readStyles(parts.get('word/styles.xml'))), comments = readComments(parts.get('word/comments.xml'));
  const tagged = doc.sdts.filter(s => s.tag), itemTags = tagged.filter(s => !s.tag.startsWith('header|'));
  if (!itemTags.length) throw new FileError('no form controls were found: it is not a returned Version 2 form, or its controls were removed');
  const partOf = tag => (/^[A-Z]+\d+-\d{2}-R\d+\|/.test(tag) ? 'B' : /^[A-Z]+\d+-\d{2}\|/.test(tag) ? 'A' : null);
  const partsSeen = new Set(itemTags.map(s => partOf(s.tag))), coursesSeen = new Set(itemTags.map(s => s.tag.split('-')[0]));
  if (partsSeen.has(null)) throw new FileError(`it holds controls that are in no form sent (for example "${itemTags.find(s => !partOf(s.tag)).tag}")`);
  if (partsSeen.size > 1) throw new FileError('it mixes Part A and Part B controls');
  if (coursesSeen.size > 1) throw new FileError(`it mixes the controls of several courses (${[...coursesSeen].sort().join(', ')})`);
  const part = [...partsSeen][0], course = pkg.courses.get([...coursesSeen][0]);
  if (!course) throw new FileError(`its controls name a course that is not in the package (${[...coursesSeen][0]})`);
  if (part === 'B' && !course.formB) throw new FileError(`it is a Part B form for ${course.code}, which has no Part B`);
  const form = course[`form${part}Spec`], unknown = tagged.filter(s => !form.tags.has(s.tag));
  if (unknown.length) throw new FileError(`it holds ${plural(unknown.length, 'control')} that ${unknown.length === 1 ? 'is' : 'are'} not in the ${course.code} Part ${part} form sent (for example "${unknown[0].tag}")`);
  const byTag = byKey(tagged, s => s.tag), header = {};
  for (const f of HEADER_FIELDS[part]) { const l = byTag.get(`header|${f}`); header[f] = l && l.length === 1 && l[0].kind === 'text' ? l[0].value : ''; }
  const notes = [];
  if (doc.tracked) notes.push('the form holds tracked changes; it was read as if they were accepted');
  // Anchor anything outside the controls (a Word comment, added text) to the case or proposal whose heading precedes it.
  const heads = doc.paras.map(p => [p.at, (p.text.match(/^([A-Z]+\d+-\d{2}(?:-R\d+)?) · /) || [])[1]]).filter(([, code]) => code);
  const anchorOf = at => { let lo = 0, hi = heads.length - 1, code = null; while (lo <= hi) { const mid = (lo + hi) >> 1; if (heads[mid][0] <= at) { code = heads[mid][1]; lo = mid + 1; } else hi = mid - 1; } return code; };
  const anchorItem = code => (!code ? null : part === 'A' ? code.replace(/-R\d+$/, '') : /-R\d+$/.test(code) ? code : null);
  const items = new Map(itemsOf(course, part).map(item => [item.code, { answers: Object.fromEntries(questionsOf(item).map(q => [q.q, fromControls(byTag, item.code, q)])), wordComments: [], addedText: [], notAsked: [], textCheck: null }]));
  const loose = { wordComments: [], addedText: [] };
  for (const a of doc.anchors) {
    if (!comments.has(a.id)) continue;
    const text = comments.get(a.id); comments.delete(a.id);
    const target = items.get(anchorItem(anchorOf(a.at)));
    if (text) (target || loose).wordComments.push(part === 'B' && !target && anchorOf(a.at) ? `[at ${anchorOf(a.at)}] ${text}` : text);
  }
  const counts = new Map(form.paraCounts);
  for (const p of doc.paras) {
    if (!p.outside) continue;
    const n = counts.get(p.outside) || 0;
    if (n) { counts.set(p.outside, n - 1); continue; }
    const target = items.get(anchorItem(anchorOf(p.at)));
    (target || loose).addedText.push(part === 'B' && !target && anchorOf(p.at) ? `[at ${anchorOf(p.at)}] ${p.outside}` : p.outside);
  }
  for (const check of textChecks(doc, course, part)) {
    if (check.state === 'same') continue;
    if (part === 'A') items.get(check.code).textCheck = check;
    else for (const prop of course.cases.find(c => c.code === check.code).proposals) {
      if (check.state === 'changed' && !check.outcomes && !check.proposals.includes(prop.code)) continue;
      items.get(prop.code).textCheck = { ...check, own: check.proposals.includes(prop.code) };
    }
  }
  if (loose.wordComments.length || loose.addedText.length) notes.push('the form holds Word comments or added text outside any case; they are kept with the file record');
  return { part, course: course.key, header: { reviewerCodes: [squash(header['reviewer-code']).toUpperCase()].filter(Boolean), dates: [header['date-returned']].filter(s => squash(s)), partAReturned: header['part-a-returned'] || '' },
    items, notes, loose, rows: { rejected: [], outOfScope: [] }, encoding: null };
};
const readCsvReturn = (buf, pkg) => {
  const { text, encoding } = decodeText(buf);
  if (text.includes('\u0000')) throw new FileError('it holds binary data, so it is not a text sheet');
  // The delimiter is the one whose header row is a response sheet's. A sheet that no delimiter reads reports the first error found.
  let table = null, part = null, parseError = null, parsedOnce = false;
  for (const delim of [',', ';', '\t']) {
    let t;
    try { t = parseCsv(text, delim); } catch (e) { if (!(e instanceof FileError)) throw e; parseError = parseError || e; continue; }
    parsedOnce = true;
    const head = (t[0] || []).map(fold);
    for (const [p, want] of [['A', HEAD_A], ['B', HEAD_B]]) {
      const named = head.filter(Boolean);
      if (named.length === want.length && want.every(w => head.includes(fold(w))) && new Set(named).size === named.length) { table = t; part = p; }
    }
    if (table) break;
  }
  if (!table) throw parseError && !parsedOnce ? parseError : new FileError('its header row is not that of a Part A or Part B response sheet (a column is renamed, missing, repeated or added)');
  const head = table[0].map(fold), want = part === 'A' ? HEAD_A : HEAD_B, col = name => head.indexOf(fold(name));
  const unnamed = head.map((h, k) => (h ? null : k)).filter(k => k !== null);
  const rows = table.slice(1).map((cells, n) => ({ line: n + 2, cells })).filter(r => r.cells.some(c => squash(c)));
  if (!rows.length) throw new FileError('the sheet has no rows');
  const get = (r, name) => r.cells[col(name)] ?? '';
  const codeCol = part === 'A' ? 'case_code' : 'proposal_code', lookup = part === 'A' ? pkg.cases : pkg.proposals;
  const byCourse = new Map();
  for (const r of rows) { const item = lookup.get(squash(get(r, codeCol)).toUpperCase()); if (item) byCourse.set(item.course, (byCourse.get(item.course) || 0) + 1); }
  const ranked = [...byCourse].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) throw new FileError(`no row holds a ${part === 'A' ? 'case' : 'proposal'} code of the package`);
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) throw new FileError(`its rows belong equally to ${ranked[0][0]} and ${ranked[1][0]}, so the sheet's course cannot be told`);
  const course = pkg.courses.get(ranked[0][0]);
  if (part === 'B' && !course.formB) throw new FileError(`it is a Part B sheet for ${course.code}, which has no Part B`);
  const form = course[`form${part}Spec`], items = new Map(), seen = new Map(), rejected = [], outOfScope = [], notes = [];
  if (encoding === 'Windows-1252') notes.push('the sheet was saved as Windows-1252, not UTF-8; characters outside that encoding may be lost (ask for a "CSV UTF-8" copy if a text looks wrong)');
  const codes = new Set(), dates = new Set();
  for (const r of rows) {
    const raw = squash(get(r, codeCol)), code = raw.toUpperCase(), item = lookup.get(code);
    if (!raw) { rejected.push({ line: r.line, code: '', reason: `the row has no ${part === 'A' ? 'case' : 'proposal'} code; its answers were not imported` }); continue; }
    if (!item) { const shown = raw.length > 40 ? `${raw.slice(0, 40)}...` : raw; rejected.push({ line: r.line, code: shown, reason: `"${shown}" is not a ${part === 'A' ? 'case' : 'proposal'} code of the package` }); continue; }
    if (item.course !== course.key) { outOfScope.push({ line: r.line, code, reason: `${code} belongs to ${item.course}, not to this ${course.key} sheet; it was not imported` }); continue; }
    if (unnamed.some(k => squash(r.cells[k]))) { rejected.push({ line: r.line, code, reason: 'the row has text in a column without a heading (a cell may hold an unquoted comma); it was not imported' }); continue; }
    if (r.cells.length > head.length) { rejected.push({ line: r.line, code, reason: 'the row has more cells than the header (a cell may hold an unquoted comma); it was not imported' }); continue; }
    const rc = squash(get(r, 'reviewer_code')).toUpperCase(), d = squash(get(r, 'date_returned'));
    if (rc) codes.add(rc);
    if (d) dates.add(d);
    const answers = {}, notAsked = [];
    for (const q of questionsOf(item)) answers[q.q] = readCell(q, get(r, q.csv), q.otherCsv ? get(r, q.otherCsv) : '');
    const asked = new Set(questionsOf(item).flatMap(q => [q.csv, q.otherCsv]).filter(Boolean));
    for (const name of want.slice(part === 'A' ? 5 : 6)) if (!asked.has(name) && squash(get(r, name))) notAsked.push({ column: name, text: tidy(get(r, name)) });
    const blank = form.blankRows.get(code), described = part === 'A' ? [[3, 'course'], [4, 'relationship']] : [[2, 'case_code'], [4, 'proposal_type'], [5, 'proposal_text']];
    const edited = described.filter(([k, name]) => squash(get(r, name)) !== squash(blank[k])).map(([, name]) => name);
    const entry = { answers, wordComments: [], addedText: [], notAsked, textCheck: null, line: r.line };
    if (edited.includes('proposal_text')) {
      entry.textCheck = { code, state: 'changed', own: true, outcomes: false, message: encoding !== 'Windows-1252' ? 'the proposed text in the sheet differs from the text sent'
        : 'the proposed text in the sheet differs from the text sent, possibly because the sheet was saved as Windows-1252', csvText: tidy(get(r, 'proposal_text')) };
    }
    if (edited.some(n => n !== 'proposal_text')) entry.edited = edited.filter(n => n !== 'proposal_text');
    if (seen.has(code)) {
      const prev = items.get(code);
      if (prev && JSON.stringify(sameAnswers(prev)) === JSON.stringify(sameAnswers(entry))) { notes.push(`row ${r.line} repeats row ${seen.get(code)} (${code}) with the same answers; counted once`); continue; }
      rejected.push({ line: r.line, code, reason: `${code} appears in rows ${seen.get(code)} and ${r.line} with different answers; neither was imported` });
      items.delete(code); continue;
    }
    seen.set(code, r.line); items.set(code, entry);
  }
  return { part, course: course.key, header: { reviewerCodes: [...codes], dates: [...dates], partAReturned: '' }, items, notes, loose: { wordComments: [], addedText: [] }, rows: { rejected, outOfScope }, encoding };
};
// What two returns must share to count as the same answers: the choices and the written texts, not the wording of a cell.
const sameAnswers = entry => Object.entries(entry.answers).sort(([a], [b]) => cmp(a, b)).map(([q, a]) => [q, a.status, Array.isArray(a.value) ? [...a.value].sort() : a.value ?? null, squash(a.text), squash(a.other)]);

// ---- evaluating one reviewer's answers to one case or proposal. Issues: hold (not counted until clarified), clarify (counted, but
// an answer needs clarifying), note (recorded for the coordinator).
const issue = (level, question, code, message, involves = [question]) => ({ level, question, code, message, involves });
const labelsOf = (q, keys) => [].concat(keys).map(k => (optionOf(q, k) || { label: k }).label).join('; ');
const checkChoice = (q, a, level) => {
  const other = squash(a.other);
  if (a.status === 'blank') {
    if (other) return issue(level, q.q, 'text-without-option', `${q.title}: a description is written under "Other", but no box is ticked`);
    return q.optional || a.confirmedBlank ? null : issue(level, q.q, 'blank', `${q.title} is blank`);
  }
  if (a.status === 'multiple') return issue(level, q.q, 'multiple', `${q.title}: more than one answer (${labelsOf(q, a.value)})`);
  if (a.status === 'invalid') return issue(level, q.q, 'invalid', `${q.title}: "${squash(a.raw)}" is not one of the form's options`);
  if (a.status === 'damaged') return issue(level, q.q, 'damaged', `${q.title}: the form's controls for this question are missing, repeated or inconsistent in the returned file`);
  const keys = [].concat(a.value);
  if (keys.includes('other') && !other) return issue(level, q.q, 'other-without-text', `${q.title}: "Other" is chosen but not described`);
  if (!keys.includes('other') && other) return issue(level, q.q, 'text-without-option', `${q.title}: a description is written under "Other", but "${labelsOf(q, keys)}" is chosen`);
  return null;
};
const evaluate = (item, entry) => {
  const qs = questionsOf(item), A = entry.answers, issues = [];
  // A damaged control is not an answer. It holds the item only where it could hide the answer that matters (question 0 or 1, or
  // the rating); on an item left blank otherwise it is only noted.
  const given = qs.filter(q => !['blank', 'damaged'].includes(A[q.q].status) || squash(A[q.q].other) || A[q.q].confirmedBlank);
  const damaged = qs.filter(q => A[q.q].status === 'damaged'), key = item.kind ? ['rating'] : ['within-expertise', 'alignment'];
  if (!given.length && !entry.textCheck && !damaged.some(q => key.includes(q.q))) {
    return { status: 'no-response', outcome: null, issues: damaged.map(q => issue('note', q.q, 'damaged', `${q.title}: the form's controls for this question are missing, repeated or inconsistent in the returned file`)) };
  }
  if (entry.textCheck && entry.textCheck.resolution !== 'as-sent') {
    if (entry.textCheck.resolution === 'changed') return { status: 'excluded', outcome: null, issues: [issue('note', 'case-text', 'judged-changed-text', 'the reviewer judged a changed text; the answer is kept but not counted')] };
    if (!given.length) return { status: 'no-response', outcome: null, issues };
    const own = !item.kind || entry.textCheck.own;
    issues.push(issue(own ? 'hold' : 'clarify', 'case-text', 'case-text-changed', `${entry.textCheck.message}; the coordinator asks which text was judged`));
  }
  if (!item.kind) { // Part A
    const q0 = A['within-expertise'];
    if (q0.status === 'answered' && q0.value === 'no-it-is-outside-my-expertise') {
      const after = given.filter(q => q.q !== 'within-expertise');
      if (after.length) issues.push(issue('note', 'within-expertise', 'answered-after-outside-expertise', `answers given after "outside my expertise" (${after.map(q => q.title).join('; ')}) are kept but not counted`));
      return { status: 'outside-expertise', outcome: 'OUTSIDE_EXPERTISE', issues: issues.filter(i => i.question !== 'case-text') };
    }
    for (const q of qs) {
      if (q.kind === 'text') continue;
      const found = checkChoice(q, A[q.q], q.q === 'within-expertise' || q.q === 'alignment' ? 'hold' : q.optional ? 'note' : 'clarify');
      if (found) issues.push(found);
    }
    const verdict = A.alignment.status === 'answered' ? A.alignment.value : null, t = TYPES[item.type];
    if (t.list && (verdict === 'aligned' || verdict === 'partially-aligned') && A.fits.status === 'blank') issues.push(issue('note', 'fits', 'blank', `${qs.find(q => q.q === 'fits').title} is blank`));
    if (verdict && A.rationale.status === 'blank') issues.push(issue('note', 'rationale', 'blank', verdict === 'insufficient-information-to-judge' ? 'question 2 (rationale) is blank, so the information needed is not named' : 'question 2 (rationale) is blank'));
    if (t.mapTo && A['re-map-target'].status === 'answered' && !(A.recommendation.status === 'answered' && A.recommendation.value === 're-map')) issues.push(issue('note', 're-map-target', 'target-without-re-map', 'a re-mapping target is written, but the recommendation is not to re-map'));
    for (const q of damaged.filter(x => x.kind === 'text')) issues.push(issue('note', q.q, 'damaged', `${q.title}: the field is missing or repeated in the returned file`));
    if (A.alignment.confirmedBlank && A['within-expertise'].status === 'answered') return { status: 'no-judgment', outcome: null, issues: issues.filter(i => i.level !== 'hold') };
    const hold = issues.some(i => i.level === 'hold');
    return { status: hold ? 'held' : 'judgment', outcome: hold ? null : codeOf(qs[1], verdict), issues };
  }
  const [rq, reasonQ] = qs, r = A.rating, reason = A['cannot-judge-reason'];
  const ri = checkChoice(rq, r, 'hold');
  if (ri) issues.push(ri);
  if (r.status === 'answered' && r.value === 'cannot-judge') { const x = checkChoice(reasonQ, reason, 'clarify'); if (x) issues.push(x); } else if (reason.status === 'damaged') {
    issues.push(issue('note', 'cannot-judge-reason', 'damaged', `${reasonQ.title}: the form's controls are missing, repeated or inconsistent in the returned file`));
  } else if (reason.status !== 'blank' || squash(reason.other)) {
    issues.push(issue('clarify', 'cannot-judge-reason', 'reason-without-cannot-judge', 'a reason for "Cannot judge" is given, but the rating is not "Cannot judge"', ['rating', 'cannot-judge-reason']));
  }
  const cq = qs.find(q => q.q === 'concerns'), c = A.concerns;
  if (c.status !== 'blank' || squash(c.other)) { const x = checkChoice(cq, c, 'clarify'); if (x) issues.push(x); }
  if (c.status === 'answered' && c.value.includes('no-concerns') && c.value.length > 1) issues.push(issue('note', 'concerns', 'no-concerns-with-concerns', '"No concerns" is ticked together with other concerns'));
  if (r.status === 'answered' && r.value === 'acceptable-with-edits' && A.note.status === 'blank') issues.push(issue('note', 'note', 'blank', '"Acceptable with edits" is chosen without a suggested edit'));
  for (const q of damaged.filter(x => x.kind === 'text')) issues.push(issue('note', q.q, 'damaged', `${q.title}: the field is missing or repeated in the returned file`));
  if (r.confirmedBlank) return { status: 'no-rating', outcome: null, issues: issues.filter(i => i.level !== 'hold') };
  const hold = issues.some(i => i.level === 'hold');
  return { status: hold ? 'held' : r.value === 'cannot-judge' ? 'cannot-judge' : 'rating', outcome: hold ? null : codeOf(rq, r.value), issues };
};

// ---- coordinator records: the V2 templates, filled in by the coordinator (read only)
const TRACK_HEAD = ['course', 'reviewer_slot', 'reviewer_code', 'discipline', 'part_a_sent', 'part_a_returned', 'part_a_sha256', 'part_b_sent', 'part_b_returned', 'part_b_sha256', 'clarifications_requested', 'notes'];
const REASSIGN_HEAD = ['case_code', 'original_reviewer_code', 'reason (outside expertise / other)', 'date_flagged', 'new_reviewer_code', 'date_reassigned', 'outcome (reassigned / excluded: no qualified reviewer)', 'notes'];
const CLAR_HEAD = ['issue_id', 'part', 'course', 'reviewer_code', 'item_code', 'question', 'level', 'issue', 'answer_as_returned', 'clarified_answer', 'date_clarified', 'recorded_by', 'notes'];
const CODE_RE = /^[A-Z0-9][A-Z0-9._-]{0,39}$/;
const readRecord = (file, head, what) => {
  if (!fs.existsSync(file)) throw new Refusal(`${what}: ${file} does not exist`);
  const buf = fs.readFileSync(file); let rows;
  try { rows = parseCsv(decodeText(buf).text); } catch (e) { throw new Refusal(`${what}: ${e.message}`); }
  const h = (rows[0] || []).map(fold), idx = head.map(c => h.indexOf(fold(c))), missing = head.filter((c, k) => idx[k] < 0);
  if (missing.length) throw new Refusal(`${what}: the header is not the template's (missing ${missing.join(', ')})`);
  return { file: path.resolve(file), sha256: sha256(buf), rows: rows.slice(1).map((r, n) => ({ line: n + 2, get: c => tidy(r[idx[head.indexOf(c)]] ?? '') })).filter(r => head.some(c => r.get(c))) };
};
const checkCode = (code, synthetic, what) => {
  if (!CODE_RE.test(code)) throw new Refusal(`${what}: a reviewer code is not in the expected form (letters, digits, "-", "." or "_"; it is not shown here in case it is a name)`);
  if (synthetic && !code.startsWith(SYNTH)) throw new Refusal(`${what}: ${code} is not a synthetic test code, so it cannot be used in a --synthetic import`);
  if (!synthetic && code.startsWith(SYNTH)) throw new Refusal(`${what}: ${code} is a synthetic test code; synthetic data is imported only with --synthetic`);
};
const readTracking = (file, pkg, synthetic) => {
  const rec = readRecord(file, TRACK_HEAD, 'tracking record'), reviewers = [], shaSeen = new Map();
  for (const r of rec.rows) {
    const code = squash(r.get('reviewer_code')).toUpperCase(), key = squash(r.get('course')).toUpperCase().replace(/\s+/g, '');
    if (!code) continue;
    if (!pkg.courses.has(key)) throw new Refusal(`tracking record, row ${r.line}: "${r.get('course')}" is not a course of the package`);
    checkCode(code, synthetic, `tracking record, row ${r.line}`);
    const course = pkg.courses.get(key), slot = squash(r.get('reviewer_slot')) || `row ${r.line}`;
    if (reviewers.some(x => x.course === key && x.code === code)) throw new Refusal(`tracking record: ${code} is listed twice for ${course.code}`);
    if (reviewers.some(x => x.course === key && x.slot.toLowerCase() === slot.toLowerCase())) throw new Refusal(`tracking record: two reviewers hold ${slot} of ${course.code}`);
    const shas = part => {
      const list = r.get(`part_${part}_sha256`).split(/[\s;,]+/).filter(Boolean).map(s => s.toLowerCase());
      for (const s of list) {
        if (!/^[0-9a-f]{16,64}$/.test(s)) throw new Refusal(`tracking record, row ${r.line}: part_${part}_sha256 holds "${s}", which is not a sha256 checksum (or its first 16 or more characters)`);
        if (shaSeen.has(s)) throw new Refusal(`tracking record: checksum ${s.slice(0, 16)} is recorded for two returns (rows ${shaSeen.get(s)} and ${r.line})`);
        shaSeen.set(s, r.line);
      }
      return list;
    };
    const sentB = r.get('part_b_sent') && !/no part b/i.test(r.get('part_b_sent'));
    reviewers.push({ course: key, code, slot, line: r.line, sentA: !!r.get('part_a_sent'), sentB: !!(sentB && course.formB), shaA: shas('a'), shaB: shas('b') });
  }
  return { file: rec.file, sha256: rec.sha256, reviewers };
};
const readReassignments = (file, pkg, synthetic) => {
  const rec = readRecord(file, REASSIGN_HEAD, 'reassignment log'), rows = [];
  for (const r of rec.rows) {
    const code = squash(r.get('case_code')).toUpperCase(), kase = pkg.cases.get(code), from = squash(r.get('original_reviewer_code')).toUpperCase(), to = squash(r.get('new_reviewer_code')).toUpperCase();
    if (!kase) throw new Refusal(`reassignment log, row ${r.line}: "${r.get('case_code')}" is not a case code of the package`);
    if (!from) throw new Refusal(`reassignment log, row ${r.line}: the original reviewer's code is blank`);
    checkCode(from, synthetic, `reassignment log, row ${r.line}`);
    if (to) checkCode(to, synthetic, `reassignment log, row ${r.line}`);
    const o = fold(r.get('outcome (reassigned / excluded: no qualified reviewer)'));
    const outcome = !o ? 'open' : o.startsWith('reassigned') ? 'reassigned' : o.startsWith('excluded') ? 'excluded' : null;
    if (!outcome) throw new Refusal(`reassignment log, row ${r.line}: the outcome "${r.get('outcome (reassigned / excluded: no qualified reviewer)')}" is neither "reassigned" nor "excluded: no qualified reviewer"`);
    if (outcome === 'reassigned' && !to) throw new Refusal(`reassignment log, row ${r.line}: the case is marked reassigned but the new reviewer's code is blank`);
    if (to && to === from) throw new Refusal(`reassignment log, row ${r.line}: the case is reassigned to the same reviewer`);
    rows.push({ line: r.line, case: code, course: kase.course, from, to: outcome === 'reassigned' ? to : '', outcome, reason: r.get('reason (outside expertise / other)'), dateReassigned: r.get('date_reassigned') });
  }
  return { file: rec.file, sha256: rec.sha256, rows };
};

// ---- the import
const IGNORED = /^(?:~\$.*|\.DS_Store|Thumbs\.db|desktop\.ini|\..*)$/i;
const UNSUPPORTED = { '.pdf': 'a PDF (for example a scanned paper form) cannot be read here: transcribe it into the course\'s response sheet (see the guide)',
  '.doc': 'an old Word format: ask the reviewer for the .docx form', '.xlsx': 'a workbook: save it as "CSV UTF-8" and import the CSV', '.xls': 'a workbook: save it as "CSV UTF-8" and import the CSV',
  '.ods': 'a workbook: save it as "CSV UTF-8" and import the CSV', '.odt': 'an OpenDocument file: ask the reviewer for the .docx form',
  '.jpg': 'an image: transcribe it into the course\'s response sheet (see the guide)', '.jpeg': 'an image: transcribe it into the course\'s response sheet (see the guide)',
  '.png': 'an image: transcribe it into the course\'s response sheet (see the guide)', '.heic': 'an image: transcribe it into the course\'s response sheet (see the guide)' };
const listInbox = dir => {
  const out = [];
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => cmp(a.name, b.name))) {
      const abs = path.join(d, e.name), rel = path.relative(dir, abs).split(path.sep).join('/');
      if (e.isSymbolicLink()) out.push({ rel, abs, skip: 'a link; links are not followed' });
      else if (e.isDirectory()) walk(abs);
      else if (e.isFile()) out.push({ rel, abs, skip: IGNORED.test(e.name) ? (e.name.startsWith('~$') ? 'a temporary lock file left by Word' : 'a system or hidden file') : null });
    }
  };
  walk(dir);
  return out;
};
const PREFER = { docx: 0, csv: 1 };
const importReturns = opts => {
  const synthetic = !!opts.synthetic, pkg = loadPackage(opts.pkg || DEFAULT_PKG);
  if (!opts.inbox) throw new Refusal('--inbox is required');
  const inbox = path.resolve(opts.inbox);
  if (!fs.existsSync(inbox) || !fs.statSync(inbox).isDirectory()) throw new Refusal(`the inbox ${inbox} is not a folder`);
  if (inside(inbox, pkg.dir) || inside(pkg.dir, inbox) || inside(inbox, V1_DIR)) throw new Refusal('the inbox must not be, hold or lie inside the package or Version 1');
  const tracking = opts.tracking ? readTracking(opts.tracking, pkg, synthetic) : null;
  const reassign = opts.reassignments ? readReassignments(opts.reassignments, pkg, synthetic) : { rows: [] };
  const clarRec = opts.clarifications ? readRecord(opts.clarifications, CLAR_HEAD, 'clarification record') : null;

  // 1. Files: hashed, sorted, duplicates by content found, each read as a form or a sheet.
  const files = listInbox(inbox).map((f, k) => {
    const rec = { id: `F${String(k + 1).padStart(2, '0')}`, path: f.rel, abs: f.abs, ext: path.extname(f.rel).toLowerCase(), status: null, reasons: [], notes: [], bytes: null, sha256: null };
    // An ignored file is neither read nor copied: a link is not followed, and a Word lock file holds the name of whoever opened the form.
    if (f.skip) { rec.status = 'ignored'; rec.reasons.push(f.skip); return rec; }
    try {
      const size = fs.statSync(f.abs).size;
      if (size > MAX_FILE_BYTES) Object.assign(rec, { bytes: size, sha256: hashFile(f.abs), large: true });
      else { const buf = fs.readFileSync(f.abs); Object.assign(rec, { bytes: buf.length, sha256: sha256(buf), buf }); }
    } catch (e) { rec.status = 'rejected'; rec.reasons.push(`it could not be read (${e.code || e.message})`); }
    return rec;
  });
  const firstBySha = new Map();
  for (const f of files) {
    if (f.status) continue;
    if (firstBySha.has(f.sha256)) { f.status = 'duplicate'; f.reasons.push(`the same bytes as ${firstBySha.get(f.sha256).id}; counted once`); continue; }
    firstBySha.set(f.sha256, f);
    f.format = f.ext === '.docx' ? 'docx' : f.ext === '.csv' ? 'csv' : null;
    if (f.large) { f.status = 'rejected'; f.reasons.push(`it is ${Math.round(f.bytes / 1048576)} MB, more than a returned form or sheet can be (${MAX_FILE_BYTES / 1048576} MB), so it was not read`); continue; }
    if (!f.format) { f.status = 'unsupported'; f.reasons.push(UNSUPPORTED[f.ext] || 'not a form or sheet the importer reads (.docx or .csv)'); continue; }
    try { f.parsed = f.format === 'docx' ? readWordReturn(f.buf, pkg) : readCsvReturn(f.buf, pkg); } catch (e) {
      if (e instanceof Refusal) throw e;
      // A fault of the importer's own on one file rejects that file only; its message is not shown, as it could quote the file.
      f.status = 'rejected'; f.reasons.push(e instanceof FileError ? e.message : `the importer failed while reading it (an internal ${e.name || 'error'}); it is not counted: keep the file and tell the developer`); continue;
    }
    Object.assign(f, { part: f.parsed.part, course: f.parsed.course, encoding: f.parsed.encoding });
    f.notes.push(...f.parsed.notes);
  }

  // 2. Whose return is it: the code written in it, or the reviewer whose tracking row records its checksum.
  const shaOwner = sha => tracking && tracking.reviewers.flatMap(r => [...r.shaA.map(s => ({ r, part: 'A', s })), ...r.shaB.map(s => ({ r, part: 'B', s }))]).find(x => sha.startsWith(x.s));
  for (const f of files.filter(x => x.parsed && !x.status)) {
    const written = f.parsed.header.reviewerCodes, owner = shaOwner(f.sha256), hold = why => { f.status = 'held'; f.reasons.push(why); };
    f.candidates = [...new Set([...written, owner ? owner.r.code : ''].filter(c => CODE_RE.test(c)))]; // whose return a held file may be
    const dates = f.parsed.header.dates.map(parseDate);
    f.dateReturned = dates[0] || null;
    if (dates.length > 1) f.notes.push(`the sheet gives more than one return date (${dates.map(d => d.raw).join('; ')}); the first is used`);
    if (written.length > 1) { hold(`it gives more than one reviewer code (${written.every(c => CODE_RE.test(c)) ? written.join(', ') : 'not shown'})`); continue; }
    const code = written[0] || '';
    if (code && !CODE_RE.test(code)) { hold('the reviewer code is not in the expected form (letters, digits, "-", "." or "_"); it is not shown here in case it is a name'); continue; }
    if (owner && (owner.r.course !== f.course || owner.part !== f.part)) { hold(`the tracking record holds its checksum for ${owner.r.course} Part ${owner.part}, but it is a ${f.course} Part ${f.part} return`); continue; }
    if (code && owner && owner.r.code !== code) { hold(`it is signed ${code}, but the tracking record holds its checksum for ${owner.r.code}`); continue; }
    if (!code && !owner) { hold('it gives no reviewer code, and the tracking record holds no checksum for it'); continue; }
    f.reviewerCode = code || owner.r.code;
    f.reviewerSource = code ? 'written in the return' : 'the checksum recorded at receipt';
    if (synthetic !== f.reviewerCode.startsWith(SYNTH)) {
      f.status = 'rejected';
      f.reasons.push(synthetic ? `${f.reviewerCode} is not a synthetic test code, so the file is not imported in a --synthetic import` : `${f.reviewerCode} is a synthetic test code; synthetic test data is never imported as a faculty return`);
      continue;
    }
    if (tracking) {
      const reg = tracking.reviewers.find(r => r.course === f.course && r.code === f.reviewerCode);
      const reassigned = reassign.rows.some(x => x.to === f.reviewerCode && x.course === f.course);
      if (!reg && !reassigned) { hold(`${f.reviewerCode} is not registered for ${f.course} in the tracking record, and no case of ${f.course} is reassigned to them`); continue; }
      const recorded = reg ? reg[`sha${f.part}`] : [];
      if (recorded.length && !recorded.some(s => f.sha256.startsWith(s))) { hold('its checksum differs from the one recorded at receipt: it may have been changed after it was returned'); continue; }
      if (reg && !recorded.length) f.notes.push(`no checksum is recorded at receipt for ${f.reviewerCode}'s Part ${f.part}; this import records ${f.sha256.slice(0, 16)}`);
      if (reg && f.part === 'B' && !reg.sentB) f.notes.push(`Part B is not recorded as sent to ${f.reviewerCode}`);
      if (reg && f.part === 'A' && !reg.sentA) f.notes.push(`Part A is not recorded as sent to ${f.reviewerCode}`);
    }
  }
  // A file that could not be read is still linked to a reviewer when the tracking record holds its checksum.
  for (const f of files.filter(x => x.sha256 && !x.parsed && (x.status === 'rejected' || x.status === 'unsupported'))) {
    const owner = shaOwner(f.sha256);
    if (owner) { f.recordedFor = { part: owner.part, course: owner.r.course, code: owner.r.code }; f.notes.push(`the tracking record holds its checksum for ${owner.r.code}'s ${owner.r.course} Part ${owner.part} return`); }
  }

  // 3. One return per reviewer, course and part: identical returns count once; different ones are held until the coordinator
  // establishes which is the reviewer's return.
  const returns = [];
  for (const [key, group] of byKey(files.filter(f => f.parsed && !f.status), f => `${f.part}|${f.course}|${f.reviewerCode}`)) {
    const [part, course, code] = key.split('|');
    group.sort((a, b) => PREFER[a.format] - PREFER[b.format] || cmp(a.id, b.id));
    // Compared over every item either return holds: a sheet that leaves out the rows of unanswered cases still matches a form.
    const codes = [...new Set(group.flatMap(f => [...f.parsed.items.keys()]))].sort(cmp), lookup = part === 'A' ? pkg.cases : pkg.proposals;
    const blankOf = code => ({ answers: Object.fromEntries(questionsOf(lookup.get(code)).map(q => [q.q, { status: 'blank' }])) });
    const sig = f => JSON.stringify(codes.map(c => [c, sameAnswers(f.parsed.items.get(c) || blankOf(c))]));
    const ret = { key, part, course, reviewerCode: code, files: group.map(f => f.id), counted: null, status: 'counted', dateReturned: group[0].dateReturned };
    if (group.every(f => sig(f) === sig(group[0]))) {
      ret.counted = group[0];
      group[0].status = 'counted';
      for (const f of group.slice(1)) { f.status = 'same-answers'; f.reasons.push(`the same answers as ${group[0].id}; counted once`); }
    } else {
      ret.status = 'conflict';
      const ids = group.map(f => f.id).join(', ');
      for (const f of group) { f.status = 'conflict'; f.reasons.push(`${code}'s ${course} Part ${part} returns (${ids}) differ; none is counted until the coordinator establishes which is the reviewer's return`); }
    }
    returns.push(ret);
  }
  const slotOf = (course, code) => (tracking && (tracking.reviewers.find(r => r.course === course && r.code === code) || {}).slot) || (reassign.rows.some(x => x.course === course && x.to === code) ? 'replacement' : '');
  // Reviewers are listed in the tracking record's order, then replacement reviewers, then any others.
  const rankOf = (course, code) => { const reg = tracking && tracking.reviewers.find(x => x.course === course && x.code === code); return reg ? reg.line : reassign.rows.some(x => x.course === course && x.to === code) ? 1e6 : 1e7; };
  for (const r of returns) { r.slot = slotOf(r.course, r.reviewerCode); r.rank = rankOf(r.course, r.reviewerCode); }
  for (const r of returns.filter(x => x.part === 'B' && x.counted)) {
    const a = returns.find(x => x.part === 'A' && x.course === r.course && x.reviewerCode === r.reviewerCode && x.counted);
    if (!a) r.counted.notes.push(`no Part A return from ${r.reviewerCode} is in this import; Part B is sent only after Part A is returned`);
    else {
      const said = parseDate(r.counted.parsed.header.partAReturned);
      if (said.iso && a.dateReturned && a.dateReturned.iso && said.iso !== a.dateReturned.iso) r.counted.notes.push(`the Part B form says Part A was returned on ${said.iso}, but the Part A return is dated ${a.dateReturned.iso}`);
    }
  }

  // 4. Responses: one per reviewer and item of a counted return. Items outside a reviewer's assignment are kept but not counted.
  const assigned = (part, course, code, item) => {
    if (!tracking) return true;
    if (tracking.reviewers.some(r => r.course === course && r.code === code)) return true;
    const caseCode = part === 'A' ? item.code : item.caseCode;
    return reassign.rows.some(x => x.to === code && x.case === caseCode);
  };
  const responses = { A: [], B: [] };
  for (const r of returns.filter(x => x.counted)) {
    const f = r.counted, course = pkg.courses.get(r.course);
    for (const item of itemsOf(course, r.part)) {
      const entry = f.parsed.items.get(item.code), rowRejected = f.parsed.rows.rejected.some(x => x.code === item.code);
      const resp = { part: r.part, item, code: item.code, course: r.course, reviewerCode: r.reviewerCode, slot: r.slot, rank: r.rank, file: f.id, format: f.format, dateReturned: r.dateReturned,
        entry: entry || { answers: Object.fromEntries(questionsOf(item).map(q => [q.q, { status: 'blank' }])), wordComments: [], addedText: [], notAsked: [], textCheck: null, missingRow: rowRejected ? 'rejected' : 'absent' } };
      resp.inScope = assigned(r.part, r.course, r.reviewerCode, item);
      responses[r.part].push(resp);
    }
  }
  const assess = resp => {
    const ev = evaluate(resp.item, resp.entry);
    if (resp.entry.notAsked.length) ev.issues.push(issue('note', 'not-asked', 'not-asked', `answers in columns the case does not ask (${resp.entry.notAsked.map(n => n.column).join('; ')}) are kept but not used`));
    if (resp.entry.edited) ev.issues.push(issue('note', 'description', 'description-edited', `the description cells were edited (${resp.entry.edited.join(', ')}); the code identifies the row`));
    if (!resp.inScope) { ev.issues = ev.status === 'no-response' ? [] : [issue('note', 'scope', 'not-assigned', `${resp.reviewerCode} is not assigned this ${resp.part === 'A' ? 'case' : 'proposal'}; the answers are kept but not counted`)]; ev.status = ev.status === 'no-response' ? 'not-assigned' : 'out-of-scope'; ev.outcome = null; }
    const id = q => `${resp.part}|${resp.reviewerCode}|${resp.code}|${q}`;
    for (const i of ev.issues) i.id = id(i.question);
    Object.assign(resp, ev);
  };
  for (const resp of [...responses.A, ...responses.B]) assess(resp);

  // 5. Clarifications recorded by the coordinator: each must answer an open hold or clarify issue of this import. The answer as
  // returned is kept beside the clarified one; a returned answer without an open issue is never changed.
  const clar = { applied: [], notApplied: [] };
  if (clarRec) {
    const open = new Map([...responses.A, ...responses.B].flatMap(r => r.issues.filter(i => i.level !== 'note').map(i => [i.id, { r, i }])));
    for (const row of clarRec.rows) {
      const id = row.get('issue_id'), answer = row.get('clarified_answer'), qName = row.get('question'), when = parseDate(row.get('date_clarified'));
      const refuse = why => clar.notApplied.push({ line: row.line, issueId: id, question: qName, reason: why });
      if (!answer) continue;
      const hit = open.get(id);
      if (!hit) { refuse('no open issue of this import has this id; a returned answer is changed only to settle an open issue'); continue; }
      if (!hit.i.involves.includes(qName)) { refuse(`the issue concerns ${hit.i.involves.join(' or ')}, not "${qName}"`); continue; }
      if (!when.iso) { refuse('date_clarified is blank or not a readable date (use 2026-11-03)'); continue; }
      const { r } = hit;
      if (qName === 'case-text') {
        const f = fold(answer);
        if (f !== 'judged on the text as sent' && f !== 'judged on the changed text') { refuse('for a changed text, the answer is "JUDGED ON THE TEXT AS SENT" or "JUDGED ON THE CHANGED TEXT"'); continue; }
        r.entry = { ...r.entry, textCheck: { ...r.entry.textCheck, resolution: f === 'judged on the text as sent' ? 'as-sent' : 'changed' } };
      } else {
        const q = questionsOf(r.item).find(x => x.q === qName);
        if (!q) { refuse(`"${qName}" is not a question of ${r.code}`); continue; }
        let next;
        if (fold(answer) === 'no answer') {
          if (qName === 'within-expertise') { refuse('question 0 needs Yes or No; it cannot be confirmed blank'); continue; }
          next = { status: 'blank', confirmedBlank: true };
        } else {
          next = readCell(q, answer);
          if (next.status !== 'answered') { refuse(`"${answer}" is not ${q.kind === 'many' ? 'a list of the' : 'one of the'} form's options for ${q.title}`); continue; }
        }
        r.entry = { ...r.entry, answers: { ...r.entry.answers, [qName]: { ...next, source: 'clarification', clarifiedOn: when.iso, asReturned: r.entry.answers[qName] } } };
      }
      clar.applied.push({ line: row.line, issueId: id, question: qName, answer, date: when.iso, recordedBy: row.get('recorded_by') });
    }
    for (const resp of [...responses.A, ...responses.B]) if (clar.applied.some(a => a.issueId.startsWith(`${resp.part}|${resp.reviewerCode}|${resp.code}|`))) assess(resp);
  }

  // 6. Tallies.
  const counted = s => ['judgment', 'outside-expertise', 'held', 'no-response', 'excluded', 'no-judgment'].includes(s);
  const expectedA = (course, kase) => {
    const codes = new Set();
    if (tracking) for (const r of tracking.reviewers) if (r.course === course && r.sentA) codes.add(r.code);
    for (const x of reassign.rows) if (x.case === kase && x.to) codes.add(x.to);
    for (const r of responses.A) if (r.code === kase && r.inScope && !tracking) codes.add(r.reviewerCode);
    return [...codes];
  };
  // Why an expected reviewer has no counted return: returns in conflict, a return held in step 2, an unreadable file recorded at
  // receipt, or no file at all.
  const notCountedWhy = (part, course, code) => {
    const ret = returns.find(x => x.part === part && x.course === course && x.reviewerCode === code);
    if (ret) return ret.status === 'conflict' ? { kind: 'conflicting returns', text: 'conflicting returns; none counted' } : null;
    const blocked = files.filter(f => (f.status === 'held' && f.part === part && f.course === course && (f.candidates || []).includes(code))
      || (f.recordedFor && f.recordedFor.part === part && f.recordedFor.course === course && f.recordedFor.code === code));
    return blocked.length ? { kind: 'return not counted', text: `return not counted (${blocked.map(f => `${f.id} ${STATUS_WORDS[f.status]}`).join(', ')}; see the file table)` }
      : { kind: 'form not returned', text: 'form not returned (no file in the inbox is attributed to this reviewer)' };
  };
  const cases = [...pkg.cases.values()].map(c => {
    const rs = responses.A.filter(r => r.code === c.code && r.inScope && counted(r.status)).sort((a, b) => a.rank - b.rank || cmp(a.reviewerCode, b.reviewerCode));
    const expected = expectedA(c.course, c.code);
    const why = expected.filter(code => !rs.some(r => r.reviewerCode === code)).map(code => ({ code, ...notCountedWhy('A', c.course, code) })).filter(w => w.kind);
    const notReturned = why.filter(w => w.kind === 'form not returned').map(w => w.code);
    const judgments = rs.filter(r => r.status === 'judgment'), outside = rs.filter(r => r.status === 'outside-expertise');
    const log = reassign.rows.filter(x => x.case === c.code);
    const replaced = o => log.some(x => x.from === o.reviewerCode && x.outcome === 'reassigned' && judgments.some(j => j.reviewerCode === x.to));
    const awaiting = [...why.map(w => `${w.code}: ${w.text}`), ...rs.filter(r => r.status === 'held').map(r => `${r.reviewerCode}: held for clarification`),
      ...rs.filter(r => r.status === 'no-response').map(r => `${r.reviewerCode}: no answer to this case`),
      ...rs.filter(r => r.status === 'no-judgment').map(r => `${r.reviewerCode}: no verdict given (confirmed in a clarification)`),
      ...rs.filter(r => r.status === 'excluded').map(r => `${r.reviewerCode}: judged a changed text, so the answer is not counted`)];
    const verdicts = [...new Set(judgments.map(j => j.outcome))];
    const reasons = [];
    let state;
    if (log.some(x => x.outcome === 'excluded')) { state = 'Excluded'; reasons.push('no qualified reviewer (reassignment log)'); } else if (outside.some(o => !replaced(o))) {
      state = 'Reassigning';
      for (const o of outside.filter(x => !replaced(x))) reasons.push(log.some(x => x.from === o.reviewerCode && x.outcome === 'reassigned') ? `${o.reviewerCode}: outside expertise; reassigned, awaiting the new reviewer` : `${o.reviewerCode}: outside expertise; to be reassigned`);
    } else if (awaiting.length || judgments.length < 2) {
      state = 'Pending';
      reasons.push(...awaiting);
      if (!awaiting.length) reasons.push(judgments.length ? 'one counted judgment; a second is needed' : 'not reviewed');
    } else {
      if (verdicts.length > 1) reasons.push('different verdicts');
      if (verdicts.includes('INSUFFICIENT_INFORMATION')) reasons.push('"Insufficient information to judge" (the adjudicator decides whether the case can be judged; I8)');
      if (judgments.some(j => j.entry.answers['course-fit-affected-alignment'].value === 'yes')) reasons.push('course fit affected the verdict (question 4b: read under the adopted P4 policy)');
      state = reasons.length ? 'To adjudication' : 'Pending';
      if (!reasons.length) reasons.push('same verdict; it becomes Agreed only when the readings are checked against the adopted policies (P1-P7 are not decided)');
    }
    const recs = judgments.filter(j => j.entry.answers.recommendation.status === 'answered');
    let recAgree = 'not comparable';
    if (recs.length >= 2) {
      const types = new Set(recs.map(j => j.entry.answers.recommendation.value));
      if (types.size > 1) recAgree = 'different';
      else if ([...types][0] !== 're-map') recAgree = 'same';
      else {
        const targets = recs.map(j => fold(j.entry.answers['re-map-target'].text));
        recAgree = targets.every(t => !t) || (targets.every(Boolean) && new Set(targets).size === 1) ? 'same' : targets.some(t => !t) ? 'different' : 'targets to compare';
      }
    }
    const special = [...(outside.length ? ['outside expertise'] : []), ...(verdicts.includes('INSUFFICIENT_INFORMATION') ? ['insufficient information'] : []),
      ...(rs.some(r => r.status === 'held' || r.issues.some(i => i.level !== 'note')) ? ['clarification needed'] : [])];
    return { code: c.code, course: c.course, type: c.type, state, reasons, responses: rs, judgments, expected, notReturned,
      verdictAgreement: judgments.length >= 2 ? (verdicts.length === 1 ? 'same' : 'different') : 'not comparable', recommendationAgreement: recAgree, special };
  });
  const props = [...pkg.proposals.values()].map(p => {
    const rs = responses.B.filter(r => r.code === p.code && r.inScope && ['rating', 'cannot-judge', 'held', 'no-response', 'excluded', 'no-rating'].includes(r.status)).sort((a, b) => a.rank - b.rank || cmp(a.reviewerCode, b.reviewerCode));
    const ratings = rs.filter(r => r.status === 'rating'), keys = [...new Set(ratings.map(r => r.entry.answers.rating.value))];
    const good = ['appropriate', 'appropriate-as-written'], not = 'not-appropriate';
    const combined = !ratings.length ? 'not rated' : ratings.length === 1 ? 'one rating' : keys.every(k => good.includes(k)) ? 'appropriate (all ratings)'
      : keys.every(k => k !== not) ? 'acceptable to all, some with edits or a named target' : keys.every(k => k === not) ? 'not appropriate (all ratings)' : 'mixed';
    return { code: p.code, caseCode: p.caseCode, course: p.course, kind: p.kind, responses: rs, ratings, combined, ratingsSame: ratings.length >= 2 ? (keys.length === 1 ? 'yes' : 'no') : 'not comparable' };
  });

  // Missing: forms not returned, and assigned items left blank or held.
  const missing = [], miss = (part, course, reviewerCode, item, kind, reason) => missing.push({ part, course, reviewerCode, item, kind, reason });
  if (tracking) {
    for (const r of tracking.reviewers) for (const part of ['A', 'B']) {
      const why = (part === 'A' ? r.sentA : r.sentB) && notCountedWhy(part, r.course, r.code);
      if (why) miss(part, r.course, r.code, '(whole form)', why.kind, why.text);
    }
  }
  for (const x of reassign.rows.filter(y => y.to)) { const why = notCountedWhy('A', x.course, x.to); if (why) miss('A', x.course, x.to, x.case, why.kind, `reassigned case: ${why.text}`); }
  for (const resp of [...responses.A, ...responses.B]) {
    if (!resp.inScope) continue;
    if (resp.status === 'no-response') {
      miss(resp.part, resp.course, resp.reviewerCode, resp.code, 'not answered', resp.entry.missingRow === 'rejected' ? 'its row in the returned sheet was not imported (see the file table)'
        : resp.entry.missingRow ? 'no row for it in the returned sheet' : 'not answered in the returned form');
    }
    if (resp.status === 'held') miss(resp.part, resp.course, resp.reviewerCode, resp.code, 'held for clarification', `held for clarification: ${resp.issues.filter(i => i.level === 'hold').map(i => i.message).join('; ')}`);
  }
  const reassignmentRequests = cases.flatMap(c => c.responses.filter(r => r.status === 'outside-expertise' && !reassign.rows.some(x => x.case === c.code && x.from === r.reviewerCode))
    .map(r => ({ case: c.code, from: r.reviewerCode, date: r.dateReturned ? dateText(r.dateReturned) : '' })));
  const result = { synthetic, importedAt: opts.now || new Date().toISOString(), pkg, inbox, tracking, reassign, clarRec, files, returns, responses, cases, props, missing, reassignmentRequests, clar };
  result.stats = statistics(result);
  return result;
};

// ---- agreement statistics. Units are the cases (or proposals) with at least two counted answers; each answer is a nominal
// category. Percentages need MIN_PERCENT_N units; Cohen's kappa needs the same two reviewers on every unit; both kappa and
// Krippendorff's alpha need MIN_CHANCE_N units and more than one category in use.
const cohenKappa = pairs => {
  const n = pairs.length, cats = [...new Set(pairs.flat())];
  const po = pairs.filter(([a, b]) => a === b).length / n;
  const pe = cats.reduce((s, c) => s + (pairs.filter(([a]) => a === c).length / n) * (pairs.filter(([, b]) => b === c).length / n), 0);
  return pe >= 1 ? null : (po - pe) / (1 - pe);
};
const krippendorffAlpha = units => { // nominal; units are lists of values, missing ones left out
  const o = new Map(), nc = new Map();
  let n = 0, disagree = 0;
  for (const u of units.filter(x => x.length >= 2)) {
    for (let i = 0; i < u.length; i++) {
      for (let j = 0; j < u.length; j++) {
        if (i === j) continue;
        const w = 1 / (u.length - 1);
        o.set(`${u[i]}\u0000${u[j]}`, (o.get(`${u[i]}\u0000${u[j]}`) || 0) + w);
        nc.set(u[i], (nc.get(u[i]) || 0) + w); n += w;
        if (u[i] !== u[j]) disagree += w;
      }
    }
  }
  let expected = 0;
  for (const [c, a] of nc) for (const [k, b] of nc) if (c !== k) expected += a * b;
  return expected === 0 ? null : 1 - ((n - 1) * disagree) / expected;
};
const agreement = units => { // units: [{ ratings: [{ rater, value }] }]
  const paired = units.filter(u => u.ratings.length >= 2), n = paired.length, same = paired.filter(u => new Set(u.ratings.map(r => r.value)).size === 1).length;
  const out = { pairedUnits: n, same, different: n - same, percent: null, cohenKappa: { value: null, reason: null }, krippendorffAlpha: { value: null, reason: null } };
  out.percent = n >= MIN_PERCENT_N ? Math.round((1000 * same) / n) / 10 : null;
  if (n < MIN_PERCENT_N) out.percentReason = `fewer than ${MIN_PERCENT_N} paired units`;
  const values = new Set(paired.flatMap(u => u.ratings.map(r => r.value)));
  const pairs = new Set(paired.map(u => u.ratings.map(r => r.rater).sort().join(' + ')));
  if (n < MIN_CHANCE_N) out.cohenKappa.reason = out.krippendorffAlpha.reason = `not calculated: ${plural(n, 'paired unit')}, fewer than ${MIN_CHANCE_N}`;
  else if (values.size < 2) out.cohenKappa.reason = out.krippendorffAlpha.reason = 'not calculated: only one category was used, so chance agreement is total';
  else {
    if (paired.some(u => u.ratings.length !== 2) || pairs.size !== 1) out.cohenKappa.reason = 'not applicable: the units were not all judged by the same two reviewers';
    else {
      const [a] = [...pairs][0].split(' + '), k = cohenKappa(paired.map(u => { const s = [...u.ratings].sort((x, y) => cmp(x.rater, y.rater)); return [s[0].value, s[1].value]; }));
      if (k === null) out.cohenKappa.reason = 'not calculated: chance agreement is total'; else { out.cohenKappa.value = round3(k); out.cohenKappa.raters = [...pairs][0]; out.cohenKappa.firstRater = a; }
    }
    const alpha = krippendorffAlpha(paired.map(u => u.ratings.map(r => r.value)));
    if (alpha === null) out.krippendorffAlpha.reason = 'not calculated: no expected disagreement'; else out.krippendorffAlpha.value = round3(alpha);
  }
  out.categories = Object.fromEntries([...values].sort().map(v => [v, paired.reduce((s, u) => s + u.ratings.filter(r => r.value === v).length, 0)]));
  return out;
};
const SCALE = ['ALIGNED', 'PARTIALLY_ALIGNED', 'NOT_ALIGNED'];
const statistics = res => {
  const courses = [...res.pkg.courses.keys()];
  const groupStats = (units, all) => ({ byCourse: Object.fromEntries(courses.map(c => [c, agreement(units.filter(u => u.course === c))]).filter(([, s]) => all || s.pairedUnits)), overall: agreement(units) });
  const verdictUnits = res.cases.filter(c => c.judgments.length >= 2 && c.judgments.every(j => SCALE.includes(j.outcome)))
    .map(c => ({ course: c.course, ratings: c.judgments.map(j => ({ rater: j.reviewerCode, value: j.outcome })) }));
  const recUnits = res.cases.map(c => ({ course: c.course, ratings: c.judgments.filter(j => j.entry.answers.recommendation.status === 'answered').map(j => ({ rater: j.reviewerCode, value: j.entry.answers.recommendation.value })) })).filter(u => u.ratings.length >= 2);
  const ratingUnits = kind => res.props.filter(p => p.kind === kind && p.ratings.length >= 2).map(p => ({ course: p.course, ratings: p.ratings.map(r => ({ rater: r.reviewerCode, value: r.entry.answers.rating.value })) }));
  const readings = {};
  for (const c of res.cases) for (const j of c.judgments) { const a = j.entry.answers.reading; const k = a.status === 'answered' ? a.value : a.status; readings[k] = (readings[k] || 0) + 1; }
  return {
    thresholds: { MIN_PERCENT_N, MIN_CHANCE_N },
    verdict: { ...groupStats(verdictUnits, true), excludedInsufficient: res.cases.filter(c => c.judgments.length >= 2 && !c.judgments.every(j => SCALE.includes(j.outcome))).length },
    recommendationType: groupStats(recUnits, true),
    rating: { rewrite: groupStats(ratingUnits('rewrite'), false), remap: groupStats(ratingUnits('remap'), false) },
    readingsApplied: readings,
  };
};

// ---- outputs
const ANSWER_HEAD_A = ['within_expertise', 'alignment', 'fits', 'rationale', 'reading', 'reading_other', 'course_fit', 'course_fit_note', 'course_fit_affected_alignment',
  'recommendation', 'recommendation_other', 're_map_target', 'bloom_source', 'bloom_target', 'confidence', 'comments'];
const ANSWER_HEAD_B = ['rating', 'cannot_judge_reason', 'cannot_judge_reason_other', 'concerns', 'concerns_other', 're_map_target', 'note'];
const cellOf = (q, a) => {
  if (!q || !a) return '';
  const mark = a.source === 'clarification' ? ' [clarified]' : '';
  if (q.kind === 'text') return a.status === 'answered' ? a.text + mark : a.status === 'damaged' ? '[damaged control]' : '';
  if (a.confirmedBlank) return '[no answer, confirmed]';
  if (a.status === 'answered') return labelsOf(q, a.value) + mark;
  if (a.status === 'multiple') return `[more than one] ${labelsOf(q, a.value)}`;
  if (a.status === 'invalid') return `[not an option] ${a.raw}`;
  if (a.status === 'damaged') return '[damaged control]';
  return '';
};
const answerCells = resp => {
  const qs = new Map(questionsOf(resp.item).map(q => [q.q, q])), A = resp.entry.answers, c = (q, k = q) => cellOf(qs.get(q), A[k]), other = q => (A[q] ? tidy(A[q].other) : '');
  return resp.part === 'A' ? [c('within-expertise'), c('alignment'), c('fits'), c('rationale'), c('reading'), other('reading'), c('course-fit'), c('course-fit-note'),
    c('course-fit-affected-alignment'), c('recommendation'), other('recommendation'), c('re-map-target'), c('bloom-source'), c('bloom-target'), c('confidence'), c('comments')]
    : [c('rating'), c('cannot-judge-reason'), other('cannot-judge-reason'), c('concerns'), other('concerns'), c('re-map-target'), c('note')];
};
const jsonAnswer = (q, a) => {
  const out = { status: a.confirmedBlank ? 'blank-confirmed' : a.status };
  if (q.kind === 'text') { if (a.text) out.text = a.text; } else if (a.value !== undefined) {
    out.value = a.value; out.label = Array.isArray(a.value) ? a.value.map(k => labelsOf(q, k)) : labelsOf(q, a.value);
    if (q.kind === 'one' && a.status === 'answered') out.code = codeOf(q, a.value);
  }
  if (a.raw) out.asWritten = a.raw;
  if (squash(a.other)) out.other = tidy(a.other);
  if (a.source === 'clarification') Object.assign(out, { source: 'clarification', clarifiedOn: a.clarifiedOn, asReturned: jsonAnswer(q, a.asReturned) });
  return out;
};
const responseJson = resp => ({ ...(resp.part === 'A' ? { caseCode: resp.code } : { proposalCode: resp.code, caseCode: resp.item.caseCode, kind: resp.item.kind === 'remap' ? 're-mapping' : 'rewrite' }),
  course: resp.course, reviewerCode: resp.reviewerCode, slot: resp.slot || null, file: resp.file, format: resp.format, dateReturned: resp.dateReturned ? dateText(resp.dateReturned) : null,
  status: resp.status, outcome: resp.outcome, answers: Object.fromEntries(questionsOf(resp.item).map(q => [q.q, jsonAnswer(q, resp.entry.answers[q.q])])),
  ...(resp.entry.wordComments.length ? { wordComments: resp.entry.wordComments } : {}), ...(resp.entry.addedText.length ? { textAddedOutsideFields: resp.entry.addedText } : {}),
  ...(resp.entry.notAsked.length ? { answersToQuestionsNotAsked: resp.entry.notAsked } : {}), ...(resp.entry.textCheck ? { textCheck: { message: resp.entry.textCheck.message, resolution: resp.entry.textCheck.resolution || null, ...(resp.entry.textCheck.csvText ? { textInSheet: resp.entry.textCheck.csvText } : {}) } } : {}),
  issues: resp.issues.map(i => ({ id: i.id, level: i.level, question: i.question, message: i.message })) });
const STATUS_WORDS = { counted: 'counted', 'same-answers': 'same answers as another file', duplicate: 'duplicate', conflict: 'conflicting returns', held: 'held', rejected: 'rejected', unsupported: 'not read', ignored: 'ignored' };
const md = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const table = (head, rows) => (rows.length ? [`| ${head.map(md).join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map(r => `| ${r.map(md).join(' | ')} |`)].join('\n') : '_None._');
const statCell = s => (s.value !== null ? String(s.value) : s.reason);
const statRows = (stats, label) => [...Object.entries(stats.byCourse).map(([c, s]) => [c, s]), ['all courses', stats.overall]].map(([c, s]) => [c, s.pairedUnits,
  `${s.same} of ${s.pairedUnits}`, s.percent !== null ? `${s.percent}%` : s.pairedUnits ? `(${s.percentReason})` : '', statCell(s.cohenKappa), statCell(s.krippendorffAlpha), label]);
const report = (res, out) => {
  const { pkg, files, returns, cases, props, stats } = res;
  const A = res.responses.A.filter(r => r.inScope), B = res.responses.B.filter(r => r.inScope), count = (list, s) => list.filter(r => r.status === s).length;
  const states = ['Pending', 'Reassigning', 'To adjudication', 'Excluded'].map(s => [s, cases.filter(c => c.state === s).length]);
  const sameVerdictPending = cases.filter(c => c.state === 'Pending' && c.verdictAgreement === 'same').length;
  const open = [...res.responses.A, ...res.responses.B].flatMap(r => r.issues);
  const lines = [
    `# Faculty response import${res.synthetic ? ' (SYNTHETIC TEST DATA)' : ''}`, '',
    '**Restricted to the review coordinator and the data steward.** It lists reviewer codes with their answers. It holds no software answer, no developer verdict and no case set, and it is not sent to reviewers or to the policy panel.', '',
    ...(res.synthetic ? ['> **SYNTHETIC TEST DATA. These are not faculty judgments.** Every return in this import was written to test the importer, and every reviewer code begins with `SYNTH-`. Nothing here may be reported, cited or used as a faculty evaluation.', ''] : []),
    ...out.warnings.flatMap(w => [`> **Warning:** ${w}.`, '']),
    '**This record decides nothing.** The importer never marks a case Agreed, Adjudicated or Unresolved, never treats a majority as a decision, and never fills in a blank. The states below are proposals for the coordinator\'s agreement record under the adjudication procedure, which awaits approval (decision I2).', '',
    '## 1. Inputs', '',
    table(['Input', 'Value'], [
      ['Imported', res.importedAt], ['Importer', `${IMPORTER} (scripts/import-align1-faculty-responses.cjs)`], ['Package', `${pkg.version}; manifest sha256 ${pkg.manifestSha256.slice(0, 16)}; forms and sheets checked against it`],
      ['Inbox', `${plural(files.length, 'file')}: ${files.filter(f => f.format === 'docx').length} Word, ${files.filter(f => f.format === 'csv').length} CSV, ${files.filter(f => !f.format).length} other`],
      ['Tracking record', res.tracking ? `${res.tracking.file}; sha256 ${res.tracking.sha256.slice(0, 16)}; ${plural(res.tracking.reviewers.length, 'reviewer')}` : 'none: reviewers are taken from the returns, so forms never returned cannot be listed'],
      ['Reassignment log', res.reassign.file ? `${res.reassign.file}; sha256 ${res.reassign.sha256.slice(0, 16)}; ${plural(res.reassign.rows.length, 'row')}` : 'none'],
      ['Clarification record', res.clarRec ? `${res.clarRec.file}; sha256 ${res.clarRec.sha256.slice(0, 16)}; ${res.clar.applied.length} applied, ${res.clar.notApplied.length} not applied` : 'none'],
      ['Inbox unchanged by the import', out.inboxUnchanged ? 'yes: after the import it holds the same files, each with the same sha256' : 'NO: a file was added, removed or changed while the import ran; import again from a stable inbox'],
      ['Statistics thresholds', `a percentage from ${MIN_PERCENT_N} paired units; kappa and alpha from ${MIN_CHANCE_N}`]]), '',
    '## 2. Files', '',
    table(['File', 'Path', 'sha256', 'Format', 'Part', 'Course', 'Reviewer', 'Status', 'Reasons and notes'], files.map(f => [f.id, f.path, f.sha256 ? f.sha256.slice(0, 16) : '', f.format || f.ext, f.part || '', f.course || '',
      f.reviewerCode || '', STATUS_WORDS[f.status] || f.status, [...f.reasons, ...f.notes, ...(f.parsed ? [...f.parsed.rows.rejected, ...f.parsed.rows.outOfScope].map(r => `row ${r.line}: ${r.reason}`) : [])].join(' / ')])), '',
    '## 3. Returns by reviewer', '',
    table(['Course', 'Reviewer', 'Slot', 'Part', 'Files', 'Status', 'Date returned'], returns.map(r => [r.course, r.reviewerCode, r.slot, r.part, r.files.join(', '), r.status, r.dateReturned ? dateText(r.dateReturned) : ''])), '',
    '## 4. Part A responses', '',
    'Counted responses are those of a counted return, for a case assigned to the reviewer. Outside-expertise answers are not judgments; held answers count only after clarification.', '',
    table(['Course', 'Cases', 'Responses', 'Judgments', 'of which Insufficient information', 'Outside expertise', 'Held', 'No answer', 'Not assigned (kept, not counted)'],
      [...pkg.courses.values()].map(c => { const rs = A.filter(r => r.course === c.key); return [c.key, c.cases.length, rs.filter(r => r.status !== 'not-assigned').length, count(rs, 'judgment'),
        rs.filter(r => r.outcome === 'INSUFFICIENT_INFORMATION').length, count(rs, 'outside-expertise'), count(rs, 'held'), count(rs, 'no-response'), res.responses.A.filter(r => r.course === c.key && r.status === 'out-of-scope').length]; })), '',
    '## 5. Part A case states (proposed; nothing is decided)', '',
    table(['State', 'Cases'], [...states, ['Agreed, Adjudicated, Unresolved', '0 (never set by the importer)']]), '',
    `${plural(sameVerdictPending, 'case')} have the same verdict from every counted reviewer and wait for the policy check before they can be Agreed.`, '',
    `**Reviewed and not reviewed.** ${cases.filter(c => c.judgments.length >= 2).length} cases have two or more counted judgments, ${cases.filter(c => c.judgments.length === 1).length} have one, and ${cases.filter(c => !c.judgments.length).length} have none. Only cases with two or more are used in section 6.`, '',
    '### Cases with no counted judgment', '', cases.filter(c => !c.judgments.length).map(c => c.code).join(', ') || '_None._', '',
    '### Cases needing reassignment', '', table(['Case', 'Reason'], cases.filter(c => c.state === 'Reassigning').map(c => [c.code, c.reasons.join('; ')])), '',
    '### Cases for the adjudicator', '', 'They go to the adjudicator once the policies they depend on are decided. A disagreement is never settled by the software, the coordinator or the data steward.', '',
    table(['Case', 'Verdicts', 'Reasons'], cases.filter(c => c.state === 'To adjudication').map(c => [c.code, c.judgments.map(j => `${j.reviewerCode}: ${labelsOf(questionsA(c.type)[1], j.entry.answers.alignment.value)}`).join('; '), c.reasons.join('; ')])), '',
    '### Pending cases', '', table(['Case', 'Reasons'], cases.filter(c => c.state === 'Pending').map(c => [c.code, c.reasons.join('; ')])), '',
    '## 6. Part A agreement', '',
    `**Method.** A unit is a case with two or more counted judgments. Two reviewers agree only when they choose the same option (procedure, section 7). The verdict statistics use the three verdicts Aligned, Partially aligned and Not aligned as nominal categories; ${plural(stats.verdict.excludedInsufficient, 'case')} with an "Insufficient information to judge" answer ${stats.verdict.excludedInsufficient === 1 ? 'is' : 'are'} left out of them and listed for the adjudicator. Cohen's kappa is given for a course only when the same two reviewers judged every unit; across courses the reviewer pairs differ, so the overall figure is Krippendorff's alpha (nominal). No statistic is given below ${MIN_CHANCE_N} units, or when only one category was used. With one to twenty cases per course these figures describe this review only; they are not estimates for the institution's syllabi.`, '',
    '### Verdicts', '', table(['Course', 'Paired cases', 'Same verdict', 'Percent', 'Cohen\'s kappa', 'Krippendorff\'s alpha', 'Measure'], statRows(stats.verdict, 'verdict')), '',
    '### Recommendation type', '', 'Compared by type; re-mapping targets are compared in the disagreement inventory.', '',
    table(['Course', 'Paired cases', 'Same type', 'Percent', 'Cohen\'s kappa', 'Krippendorff\'s alpha', 'Measure'], statRows(stats.recommendationType, 'recommendation type')), '',
    '### Readings applied (question 3)', '', 'For the policy panel\'s information under P1 and P2. A count of readings is not a policy, and a majority reading is not adopted by being common.', '',
    table(['Reading', 'Counted judgments'], Object.entries(stats.readingsApplied).map(([k, n]) => [k, n])), '',
    '## 7. Disagreement inventory', '', `${plural(res.disagreements.length, 'difference')} between counted judgments, listed in disagreement-inventory.csv. Verdict differences go to the adjudicator; the others are recorded side by side.`, '',
    table(['Aspect', 'Cases'], Object.entries(res.disagreements.reduce((m, d) => ({ ...m, [d.aspect]: (m[d.aspect] || 0) + 1 }), {}))), '',
    '## 8. Part B ratings (recommendation quality, kept apart from alignment)', '',
    'Ratings describe the proposed changes. They are not alignment verdicts and are not adjudicated (procedure, section 6). "Cannot judge" is not a rating: it is counted by reason.', '',
    table(['Kind', 'Rating', 'Ratings'], ['rewrite', 'remap'].flatMap(kind => { const q = questionsB('CLO-PO', kind)[0]; return q.options.filter(o => o.key !== 'cannot-judge').map(o => [kind === 'remap' ? 're-mapping' : 'rewrite', kind === 'remap' && o.key.startsWith('appropriate-only') ? 'Appropriate only if a suitable outcome is named' : o.label, B.filter(r => r.item.kind === kind && r.status === 'rating' && (r.entry.answers.rating.value === o.key || (kind === 'remap' && o.key.startsWith('appropriate-only') && r.entry.answers.rating.value.startsWith('appropriate-only')))).length]); })), '',
    table(['Cannot judge: reason', 'Count'], [...questionsB('CLO-PO', 'rewrite')[1].options.map(o => [o.label, B.filter(r => r.status === 'cannot-judge' && r.entry.answers['cannot-judge-reason'].value === o.key).length]),
      ['no reason given', B.filter(r => r.status === 'cannot-judge' && r.entry.answers['cannot-judge-reason'].status !== 'answered').length]]), '',
    table(['Proposals by their ratings', 'Rewrites', 'Re-mappings'], ['appropriate (all ratings)', 'acceptable to all, some with edits or a named target', 'mixed', 'not appropriate (all ratings)', 'one rating', 'not rated']
      .map(k => [k, props.filter(p => p.kind === 'rewrite' && p.combined === k).length, props.filter(p => p.kind === 'remap' && p.combined === k).length])), '',
    '### Rating agreement', '', table(['Course', 'Paired proposals', 'Same rating', 'Percent', 'Cohen\'s kappa', 'Krippendorff\'s alpha', 'Measure'],
      [...statRows(res.stats.rating.rewrite, 'rewrite ratings'), ...statRows(res.stats.rating.remap, 're-mapping ratings')]), '',
    `${plural(props.filter(p => p.ratingsSame === 'no').length, 'proposal')} received different ratings; both are recorded in part-b-ratings-record.csv.`, '',
    '## 9. Missing responses', '', table(['Part', 'What is missing', 'Count'], [...byKey(res.missing, m => `${m.part}|${m.kind}`)].map(([k, l]) => [...k.split('|'), l.length])), '',
    'Missing answers are never filled in. The full list is in missing-responses.csv.', '',
    '## 10. Clarifications', '',
    `${plural(open.filter(i => i.level === 'hold').length, 'answer')} are held and ${plural(open.filter(i => i.level === 'clarify').length, 'answer')} need clarifying; ${plural(open.filter(i => i.level === 'note').length, 'note')} are for the coordinator's attention. They are listed in clarification-requests.csv. The coordinator asks the reviewer, writes the reviewer's answer and its date in that file, and passes it back with --clarifications; the answer as returned is kept beside it.`, '',
    ...(res.clar.notApplied.length ? ['Clarifications not applied:', '', table(['Row', 'Issue', 'Reason'], res.clar.notApplied.map(n => [n.line, n.issueId, n.reason])), ''] : []),
    '## 11. Files in this folder', '', ...out.written.map(f => `- \`${f}\``), '',
    '## 12. Limits', '',
    '- The importer reads the Version 2 Word forms and CSV sheets only. A paper or scanned return is not read: it is transcribed into the course\'s sheet first (see the guide).',
    '- Written answers, Word comments and text added outside the form\'s fields are kept as written and never interpreted.',
    '- Two re-mapping targets written differently are not compared by the importer ("targets to compare"); the coordinator compares them.',
    '- The figures describe this review only. They are small-sample counts, not estimates for the institution, and no case is decided by them.',
  ];
  return `${lines.join('\n')}\n`;
};
const disagreementsOf = res => res.cases.flatMap(c => {
  if (c.judgments.length < 2) return [];
  const qs = questionsA(c.type), out = [];
  const aspect = (name, q, value, cmpText, what) => {
    const vals = c.judgments.map(j => ({ code: j.reviewerCode, v: value(j) }));
    const cmpd = new Set(vals.map(x => cmpText(x.v)));
    if (cmpd.size > 1) out.push({ case: c.code, course: c.course, aspect: name, answers: vals.map(x => `${x.code}: ${x.v || '(blank)'}`).join('; '), comparison: 'different', what });
  };
  const label = q => j => (j.entry.answers[q].status === 'answered' ? labelsOf(qs.find(x => x.q === q), j.entry.answers[q].value) : '');
  aspect('verdict', 'alignment', label('alignment'), x => x, 'to the adjudicator');
  aspect('reading applied', 'reading', label('reading'), x => x, 'recorded; read under the adopted P1 or P2 policy');
  aspect('course fit', 'course-fit', label('course-fit'), x => x, 'recorded; read under the adopted P4 policy');
  aspect('course fit affected the verdict', 'course-fit-affected-alignment', label('course-fit-affected-alignment'), x => x, 'recorded; read under the adopted P4 policy');
  const recs = c.judgments.filter(j => j.entry.answers.recommendation.status === 'answered');
  if (recs.length >= 2 && c.recommendationAgreement !== 'same') {
    out.push({ case: c.code, course: c.course, aspect: 'recommendation', comparison: c.recommendationAgreement,
      answers: recs.map(j => `${j.reviewerCode}: ${label('recommendation')(j)}${j.entry.answers.recommendation.value === 're-map' ? ` (target: ${j.entry.answers['re-map-target'].text || 'left open'})` : ''}`).join('; '),
      what: c.recommendationAgreement === 'targets to compare' ? 'the coordinator compares the targets; recorded side by side' : 'recorded side by side (decided only if the panel decides recommendations become references: I10, I11)' });
  }
  return out;
});
// Writes the whole record into dir, a new folder that writeOutputs renames into place once every file is complete.
const writeRecord = (res, dir, warnings) => {
  const prefix = res.synthetic ? 'SYNTHETIC-' : '', written = [];
  const put = (name, data) => { fs.writeFileSync(path.join(dir, prefix + name), data, { flag: 'wx' }); written.push(prefix + name); };
  // Originals: a byte copy of every file read, named by its checksum and made read-only.
  const orig = `${prefix}originals`, archived = new Map();
  fs.mkdirSync(path.join(dir, orig));
  for (const f of res.files.filter(x => x.sha256)) {
    if (archived.has(f.sha256)) continue;
    const name = `${f.sha256}${f.ext.replace(/[^.a-z0-9]/g, '').slice(0, 10)}`, dest = path.join(dir, orig, name);
    if (f.buf) fs.writeFileSync(dest, f.buf, { flag: 'wx' }); else fs.copyFileSync(f.abs, dest, fs.constants.COPYFILE_EXCL);
    if (hashFile(dest) !== f.sha256) throw new Refusal(`the copy of ${f.id} (${f.path}) differs from the file read: it may have changed during the import; nothing was written`);
    fs.chmodSync(dest, 0o444); archived.set(f.sha256, `${orig}/${name}`);
  }
  res.disagreements = disagreementsOf(res);
  const issuesText = r => r.issues.map(i => `${i.level}: ${i.message}`).join(' / ');
  const respRow = r => [r.code, ...(r.part === 'B' ? [r.item.caseCode, r.item.kind === 'remap' ? 're-mapping' : 'rewrite'] : []), r.course, ...(r.part === 'A' ? [TYPES[r.item.type].title] : []),
    r.reviewerCode, r.slot, r.file, r.format, r.dateReturned ? dateText(r.dateReturned) : '', r.status, r.outcome || '', ...answerCells(r), r.entry.wordComments.join('\n---\n'),
    r.entry.addedText.join('\n'), issuesText(r), Object.values(r.entry.answers).some(a => a.source === 'clarification') ? 'yes' : ''];
  const about = `RESTRICTED: coordinator and data steward only. ${res.synthetic ? 'SYNTHETIC TEST DATA, NOT FACULTY JUDGMENTS. ' : ''}Answers as returned; nothing filled in or decided.`;
  for (const part of ['A', 'B']) {
    const list = res.responses[part].filter(r => r.status !== 'not-assigned');
    put(`part-${part.toLowerCase()}-responses.csv`, toCsv([[...(part === 'A' ? ['case_code', 'course', 'relationship'] : ['proposal_code', 'case_code', 'kind', 'course']), 'reviewer_code', 'slot', 'file', 'format',
      'date_returned', 'status', 'outcome', ...(part === 'A' ? ANSWER_HEAD_A : ANSWER_HEAD_B), 'word_comments', 'text_added_outside_fields', 'issues', 'clarified'], ...list.map(respRow)]));
    put(`part-${part.toLowerCase()}-responses.json`, `${JSON.stringify({ about, synthetic: res.synthetic, importedAt: res.importedAt, responses: list.map(responseJson) }, null, 1)}\n`);
  }
  const first2 = c => [...c.judgments, ...c.responses.filter(r => r.status !== 'judgment')].slice(0, 2);
  const aCols = r => { if (!r) return Array(9).fill(''); const q = new Map(questionsA(r.item.type).map(x => [x.q, x])), a = r.entry.answers;
    return [r.reviewerCode, cellOf(q.get('within-expertise'), a['within-expertise']), cellOf(q.get('alignment'), a.alignment), cellOf(q.get('reading'), a.reading), cellOf(q.get('course-fit'), a['course-fit']),
      cellOf(q.get('course-fit-affected-alignment'), a['course-fit-affected-alignment']), cellOf(q.get('recommendation'), a.recommendation), q.has('re-map-target') ? cellOf(q.get('re-map-target'), a['re-map-target']) : '', cellOf(q.get('confidence'), a.confidence)]; };
  put('part-a-agreement-record.csv', toCsv([['case_code', 'course', 'relationship', 'reviewer_1_code', 'r1_within_expertise', 'r1_alignment', 'r1_reading', 'r1_course_fit', 'r1_fit_affected_alignment', 'r1_recommendation', 'r1_re-map_target', 'r1_confidence',
    'reviewer_2_code', 'r2_within_expertise', 'r2_alignment', 'r2_reading', 'r2_course_fit', 'r2_fit_affected_alignment', 'r2_recommendation', 'r2_re-map_target', 'r2_confidence',
    'verdict_agreement (same / different / not comparable)', 'recommendation_agreement (same / different / not comparable / targets to compare)', 'special_answers (outside expertise / insufficient information / clarification needed)',
    'state (Pending / Reassigning / Agreed / To adjudication / Adjudicated / Unresolved / Excluded)', 'notes'],
  ...res.cases.map(c => { const [r1, r2] = first2(c), more = [...c.judgments, ...c.responses.filter(r => r.status !== 'judgment')].slice(2);
    return [c.code, res.pkg.courses.get(c.course).code, TYPES[c.type].title, ...aCols(r1), ...aCols(r2), c.verdictAgreement, c.recommendationAgreement, c.special.join('; '), c.state,
      [...c.reasons, ...(more.length ? [`also: ${more.map(r => `${r.reviewerCode} (${r.status})`).join(', ')}`] : [])].join('; ')]; })]));
  const bCols = r => (r ? [r.reviewerCode, ...answerCells(r).slice(0, 2), answerCells(r)[3]] : ['', '', '', '']);
  put('part-b-ratings-record.csv', toCsv([['case_code', 'proposal_code', 'proposal_type', 'reviewer_1_code', 'r1_rating', 'r1_cannot_judge_reason', 'r1_concerns', 'reviewer_2_code', 'r2_rating', 'r2_cannot_judge_reason', 'r2_concerns', 'ratings_same (yes / no / not comparable)', 'notes'],
    ...res.props.map(p => { const [r1, r2] = p.responses, more = p.responses.slice(2); return [p.caseCode, p.code, p.kind === 'remap' ? 're-mapping' : 'rewrite', ...bCols(r1), ...bCols(r2), p.ratingsSame,
      [p.combined, ...(more.length ? [`also: ${more.map(r => `${r.reviewerCode} (${cellOf(questionsOf(r.item)[0], r.entry.answers.rating) || r.status})`).join(', ')}`] : [])].join('; ')]; })]));
  put('disagreement-inventory.csv', toCsv([['case_code', 'course', 'aspect', 'answers', 'comparison', 'what happens'], ...res.disagreements.map(d => [d.case, d.course, d.aspect, d.answers, d.comparison, d.what])]));
  put('missing-responses.csv', toCsv([['part', 'course', 'reviewer_code', 'item_code', 'what', 'reason'], ...res.missing.map(m => [m.part, m.course, m.reviewerCode, m.item, m.kind, m.reason])]));
  const clarRows = [...res.responses.A, ...res.responses.B].flatMap(r => r.issues.filter(i => i.level !== 'note').map(i => [i.id, r.part, r.course, r.reviewerCode, r.code, i.question, i.level, i.message,
    i.question === 'case-text' ? (r.entry.textCheck.csvText || '') : cellOf(questionsOf(r.item).find(q => q.q === i.question), r.entry.answers[i.question]), '', '', '', '']));
  put('clarification-requests.csv', toCsv([CLAR_HEAD, ...clarRows]));
  put('reassignment-requests.csv', toCsv([REASSIGN_HEAD, ...res.reassignmentRequests.map(x => [x.case, x.from, 'outside expertise', x.date, '', '', '', 'from the import: question 0 answered "No, it is outside my expertise"'])]));
  const tally = {
    about, synthetic: res.synthetic, importedAt: res.importedAt,
    files: Object.fromEntries(Object.keys(STATUS_WORDS).map(s => [s, res.files.filter(f => f.status === s).length])),
    partA: { cases: res.cases.length, states: Object.fromEntries(['Pending', 'Reassigning', 'To adjudication', 'Excluded'].map(s => [s, res.cases.filter(c => c.state === s).length])),
      agreedOrAdjudicated: 0, sameVerdictAwaitingPolicy: res.cases.filter(c => c.state === 'Pending' && c.verdictAgreement === 'same').length,
      reviewed: { twoOrMore: res.cases.filter(c => c.judgments.length >= 2).length, one: res.cases.filter(c => c.judgments.length === 1).length, none: res.cases.filter(c => !c.judgments.length).length },
      responses: Object.fromEntries(['judgment', 'outside-expertise', 'held', 'no-response', 'no-judgment', 'excluded', 'out-of-scope'].map(s => [s, res.responses.A.filter(r => r.status === s).length])),
      verdicts: Object.fromEntries(SCALE.concat('INSUFFICIENT_INFORMATION').map(v => [v, res.responses.A.filter(r => r.status === 'judgment' && r.outcome === v).length])),
      toAdjudication: res.cases.filter(c => c.state === 'To adjudication').map(c => ({ case: c.code, reasons: c.reasons })), reassignment: res.cases.filter(c => c.state === 'Reassigning').map(c => ({ case: c.code, reasons: c.reasons })) },
    partB: { proposals: res.props.length, responses: Object.fromEntries(['rating', 'cannot-judge', 'held', 'no-response', 'no-rating', 'excluded', 'out-of-scope'].map(s => [s, res.responses.B.filter(r => r.status === s).length])),
      ratings: Object.fromEntries(['rewrite', 'remap'].map(k => [k === 'remap' ? 're-mapping' : 'rewrite', res.responses.B.filter(r => r.item.kind === k && r.status === 'rating').reduce((m, r) => ({ ...m, [r.outcome]: (m[r.outcome] || 0) + 1 }), {})])),
      cannotJudgeByReason: res.responses.B.filter(r => r.status === 'cannot-judge').reduce((m, r) => { const a = r.entry.answers['cannot-judge-reason']; const k = a.status === 'answered' ? a.value : 'no reason given'; return { ...m, [k]: (m[k] || 0) + 1 }; }, {}),
      byCombinedRating: res.props.reduce((m, p) => ({ ...m, [`${p.kind === 'remap' ? 're-mapping' : 'rewrite'}: ${p.combined}`]: (m[`${p.kind === 'remap' ? 're-mapping' : 'rewrite'}: ${p.combined}`] || 0) + 1 }), {}) },
    statistics: res.stats, missing: { total: res.missing.length, byKind: res.missing.reduce((m, x) => ({ ...m, [`Part ${x.part}: ${x.kind}`]: (m[`Part ${x.part}: ${x.kind}`] || 0) + 1 }), {}) },
    disagreements: res.disagreements.length,
    issues: ['hold', 'clarify', 'note'].reduce((m, l) => ({ ...m, [l]: [...res.responses.A, ...res.responses.B].reduce((s, r) => s + r.issues.filter(i => i.level === l).length, 0) }), {}),
  };
  put('tally.json', `${JSON.stringify(tally, null, 1)}\n`);
  // The inbox after the import: the same files, each with the checksum it had when it was read.
  const sameList = JSON.stringify(listInbox(res.inbox).map(f => f.rel)) === JSON.stringify(res.files.map(f => f.path));
  const inboxNow = res.files.filter(f => f.sha256).map(f => { try { return hashFile(f.abs) === f.sha256; } catch { return false; } });
  const state = { written: [...written, `${orig}/ (${archived.size} files)`, `${prefix}import-report.md`, `${prefix}import-manifest.json`], inboxUnchanged: sameList && inboxNow.every(Boolean), warnings };
  put('import-report.md', report(res, state));
  put('import-manifest.json', `${JSON.stringify({
    about, importer: IMPORTER, importerSha256: sha256(fs.readFileSync(__filename)), node: process.version, synthetic: res.synthetic, importedAt: res.importedAt,
    package: { dir: res.pkg.dir, version: res.pkg.version, manifestSha256: res.pkg.manifestSha256 }, inbox: res.inbox, inboxUnchanged: state.inboxUnchanged,
    records: { tracking: res.tracking ? { file: res.tracking.file, sha256: res.tracking.sha256 } : null, reassignments: res.reassign.file ? { file: res.reassign.file, sha256: res.reassign.sha256 } : null,
      clarifications: res.clarRec ? { file: res.clarRec.file, sha256: res.clarRec.sha256, applied: res.clar.applied, notApplied: res.clar.notApplied } : null },
    thresholds: { MIN_PERCENT_N, MIN_CHANCE_N },
    files: res.files.map(f => ({ id: f.id, path: f.path, bytes: f.bytes, sha256: f.sha256, archived: archived.get(f.sha256) || null, format: f.format || null, encoding: f.encoding || null, status: f.status,
      part: f.part || null, course: f.course || null, reviewerCode: f.reviewerCode || null, reviewerFrom: f.reviewerSource || null, dateReturned: f.dateReturned ? dateText(f.dateReturned) : null, reasons: f.reasons, notes: f.notes,
      rowsNotImported: f.parsed ? [...f.parsed.rows.rejected, ...f.parsed.rows.outOfScope] : [], ...(f.parsed && (f.parsed.loose.wordComments.length || f.parsed.loose.addedText.length) ? { outsideAnyCase: f.parsed.loose } : {}) })),
    returns: res.returns.map(r => ({ part: r.part, course: r.course, reviewerCode: r.reviewerCode, slot: r.slot || null, files: r.files, status: r.status })),
  }, null, 1)}\n`);
  if (res.synthetic) fs.writeFileSync(path.join(dir, 'SYNTHETIC-TEST-DATA.txt'), 'Every file in this folder comes from synthetic test returns written to test the importer. None of it is a faculty judgment.\r\n', { flag: 'wx' });
  return { written: state.written, inboxUnchanged: state.inboxUnchanged };
};
const storageWarnings = (inbox, out) => [[inbox, 'the inbox'], [out, 'the output folder']].filter(([p]) => inside(p, ROOT))
  .map(([, what]) => `${what} lies inside the repository; real responses must never be committed, so keep them in the restricted store (see the guide)`);
const pause = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const removeTree = dir => { // true when the folder is gone
  try {
    for (const e of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) if (e.isFile()) fs.chmodSync(path.join(e.parentPath ?? e.path, e.name), 0o644);
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  } catch { /* reported by the caller */ }
  return !fs.existsSync(dir);
};
// The record is written into a temporary folder beside the output folder and takes the output folder's name only when every file
// is complete, so a failed import leaves no partial record. An existing output folder must be an empty folder.
const writeOutputs = (res, outDir) => {
  const out = path.resolve(outDir);
  for (const [dir, what] of [[res.pkg.dir, 'the package'], [V1_DIR, 'Version 1'], [res.inbox, 'the inbox']]) if (inside(out, dir) || inside(dir, out)) throw new Refusal(`the output folder must not be, hold or lie inside ${what}`);
  const existed = fs.existsSync(out);
  if (existed && !fs.statSync(out).isDirectory()) throw new Refusal(`${out} is a file, not a folder`);
  if (existed && fs.readdirSync(out).length) throw new Refusal(`${out} is not empty; every import writes to a new folder, so earlier records are never overwritten`);
  const warnings = storageWarnings(res.inbox, out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const tmp = path.join(path.dirname(out), `.${path.basename(out)}.incomplete-${process.pid}-${Date.now()}`);
  fs.mkdirSync(tmp);
  try {
    const done = writeRecord(res, tmp, warnings);
    if (existed) fs.rmdirSync(out); // still empty: rmdir refuses a folder that has filled since the check
    for (let k = 0; ; k++) { // Windows refuses a rename while a scanner holds a file open; it is tried again for up to a second
      try { fs.renameSync(tmp, out); break; } catch (e) { if (k >= 9 || !['EPERM', 'EACCES', 'EBUSY'].includes(e.code)) throw e; pause(100); }
    }
    return { out, ...done, warnings };
  } catch (e) {
    if (!removeTree(tmp)) e.message += `; the incomplete folder ${tmp} could not be removed and should be deleted`;
    if (existed && !fs.existsSync(out)) { try { fs.mkdirSync(out); } catch { /* the error that stopped the import is the one reported */ } }
    throw e;
  }
};

// ---- command line
const parseArgs = argv => {
  const o = {}, flags = new Set(['synthetic', 'check-package']), values = new Set(['inbox', 'out', 'tracking', 'reassignments', 'clarifications', 'pkg']);
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--') || (!flags.has(k) && !values.has(k))) throw new Refusal(`unknown argument ${argv[i]}`);
    if (flags.has(k)) o[k] = true; else { o[k] = argv[++i]; if (o[k] === undefined || o[k].startsWith('--')) throw new Refusal(`--${k} needs a value`); }
  }
  return o;
};
const main = argv => {
  const o = parseArgs(argv);
  if (o['check-package']) {
    const pkg = loadPackage(o.pkg || DEFAULT_PKG);
    console.log(`package ${pkg.version} (manifest ${pkg.manifestSha256.slice(0, 16)}): ${pkg.cases.size} cases and ${pkg.proposals.size} proposals in ${pkg.courses.size} courses; the ${[...pkg.courses.values()].reduce((s, c) => s + (c.formB ? 2 : 1), 0)} forms and sheets match the importer`);
    return 0;
  }
  if (!o.out) throw new Refusal('--out is required (a new or empty folder outside the package and the inbox)');
  const res = importReturns(o), w = writeOutputs(res, o.out);
  for (const x of w.warnings) console.warn(`warning: ${x}`);
  const c = s => res.files.filter(f => f.status === s).length;
  console.log(`${res.synthetic ? 'SYNTHETIC TEST IMPORT. ' : ''}${plural(res.files.length, 'file')}: ${c('counted')} counted, ${c('same-answers') + c('duplicate')} repeated, ${c('conflict')} in conflict, ${c('held')} held, ${c('rejected')} rejected, ${c('unsupported')} not read, ${c('ignored')} ignored`);
  console.log(`Part A: ${['Pending', 'Reassigning', 'To adjudication', 'Excluded'].map(s => `${res.cases.filter(x => x.state === s).length} ${s}`).join(', ')}; Part B: ${res.responses.B.filter(r => r.status === 'rating').length} ratings`);
  console.log(`clarifications needed: ${[...res.responses.A, ...res.responses.B].reduce((s, r) => s + r.issues.filter(i => i.level !== 'note').length, 0)}; inbox unchanged: ${w.inboxUnchanged ? 'yes' : 'NO'}`);
  console.log(`written to ${w.out}`);
  return w.inboxUnchanged ? 0 : 1;
};
if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) {
    if (!(e instanceof Refusal)) throw e;
    console.error(`refused: ${e.message}`); process.exitCode = 1;
  }
}

module.exports = { importReturns, writeOutputs, loadPackage, readWordReturn, readCsvReturn, parseCsv, toCsv, unzip, readDocXml, scanXml, cohenKappa, krippendorffAlpha, agreement,
  storageWarnings, main, questionsA, questionsB, TYPES, HEAD_A, HEAD_B, TRACK_HEAD, REASSIGN_HEAD, CLAR_HEAD, Refusal, FileError, DEFAULT_PKG, MIN_PERCENT_N, MIN_CHANCE_N, MAX_FILE_BYTES };
