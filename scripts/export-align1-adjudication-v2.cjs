#!/usr/bin/env node
'use strict';
// Builds docs/faculty-review/align-1-dev-adjudication-v2/, Version 2 of the faculty-adjudication package for the 58 align-1 development
// cases. Version 1 (docs/faculty-review/align-1-dev-adjudication/) is read and never written.
//   node scripts/export-align1-adjudication-v2.cjs [--out <dir>] [--prereg <file>] [--pdf]
// Offline. Reads Version 1's package (every file checked against its package-manifest.json) and takes the cases, codes, sets and proposals
// from its coordinator/cases.json unchanged. Checks those records against the sources Version 1 was built from: the A2, B2 and A1
// evaluation records, the development split of server/lib/syllabuscheck/eval/alignment-dataset.json and the developer notes pre-registered
// before B2 (--prereg, default docs/ai-eval-anthropic/p2b2-preregistered.json), each by the hash Version 1 recorded. Reads the institutional
// texts held in the repository for the references: src/data/outcomesSeed.js, server/db/local-outcome-data.cjs,
// server/db/local-curriculum-data.cjs and server/config/marian-values.json.
// Calls no provider and changes no source. Writes only inside --out (default: the Version 2 folder; Version 1's folder is refused), either
// into an empty folder or over files this script wrote and nobody has changed since (each checked against package-manifest.json), so a
// filled-in form is never overwritten; otherwise it refuses and writes nothing. The same inputs give byte-identical .docx, .md, .csv and
// .json files.
// --pdf also converts each .docx to PDF with Microsoft Word, opened read-only through COM and never saved. PDFs are not byte-reproducible,
// so the manifest records the .docx each was made from, and a later run without --pdf keeps a PDF only while its .docx is unchanged.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const EVAL = path.join(ROOT, 'docs', 'ai-eval-anthropic');
const option = name => { const i = process.argv.indexOf(name); return i > 1 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : null; };
const V1 = path.join(ROOT, 'docs', 'faculty-review', 'align-1-dev-adjudication');
const PKG = option('--out') || path.join(ROOT, 'docs', 'faculty-review', 'align-1-dev-adjudication-v2');
const PREREG = option('--prereg') || path.join(EVAL, 'p2b2-preregistered.json');
const PDF = process.argv.includes('--pdf');
const BUILT = '2026-10-28', VERSION = 'align-1-dev-adjudication-v2';
const within = (dir, p) => { const r = path.relative(dir, p); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };
if (within(V1, PKG) || within(PKG, V1)) { console.log('REFUSED: --out must not be Version 1\'s folder, lie inside it or contain it'); process.exit(2); }
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const shaBuf = buf => crypto.createHash('sha256').update(buf).digest('hex');
const rel = file => path.relative(ROOT, file).split(path.sep).join('/');
const short = h => h.slice(0, 16);
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const norm = s => String(s || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

// ---- a deterministic .docx writer: a stored (uncompressed) zip with one fixed date; answers are Word content controls ----
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const zipStore = entries => {
  const [y, m, d] = BUILT.split('-').map(Number), dosDate = ((y - 1980) << 9) | (m << 5) | d;
  const locals = [], centrals = []; let offset = 0;
  for (const [name, data] of entries) {
    const n = Buffer.from(name, 'utf8'), crc = crc32(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(0, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(dosDate, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(n.length, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(0, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(dosDate, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(offset, 42);
    locals.push(lh, n, data); centrals.push(ch, n); offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
};
const esc = s => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const NS14 = 'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="w14"';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const WIDTH = 10080; // text width in twips: US Letter with 0.75-inch margins
const NBSP = ' ', BOX = '☐';
// Inline markup shared by both renderers: **bold**, *italic*, `code`. Case texts never pass through it.
const spans = text => String(text).split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/).filter(Boolean)
  .map(s => (/^\*\*[^*]+\*\*$/.test(s) ? { s: s.slice(2, -2), b: true } : /^`[^`]+`$/.test(s) ? { s: s.slice(1, -1), code: true } : /^\*[^*\s][^*]*\*$/.test(s) ? { s: s.slice(1, -1), i: true } : { s }));
const vertical = b => b.vertical ?? (b.options.length > 5 || b.options.some(o => o.label.length > 45));

// A document is { title, footer, blocks }. Blocks: h1, h2 (pageBreak), h3, p, case (label, text), ul (items: text or { text, sub }),
// table (head, rows, widths; a cell is text or { field, alias }), choice (label, tag, options: { key, label, field }), area (tag, alias,
// lines), fields (items: { label, tag }), hr.
const docx = doc => {
  let id = 1;
  const r = (s, f = {}) => {
    const pr = (f.code ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>' : '') + (f.b ? '<w:b/>' : '') + (f.i ? '<w:i/>' : '') + (f.color ? `<w:color w:val="${f.color}"/>` : '');
    return `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(s)}</w:t></w:r>`;
  };
  const rs = (text, f = {}) => spans(text).map(x => r(x.s, { ...f, ...x })).join('');
  const p = (inner, ppr = '') => `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${inner}</w:p>`;
  const box = tag => `<w:sdt><w:sdtPr><w:tag w:val="${esc(tag)}"/><w:id w:val="${id++}"/><w14:checkbox><w14:checked w14:val="0"/><w14:checkedState w14:val="2612" w14:font="MS Gothic"/><w14:uncheckedState w14:val="2610" w14:font="MS Gothic"/></w14:checkbox></w:sdtPr><w:sdtContent><w:r><w:rPr><w:rFonts w:ascii="MS Gothic" w:eastAsia="MS Gothic" w:hAnsi="MS Gothic" w:hint="eastAsia"/></w:rPr><w:t>${BOX}</w:t></w:r></w:sdtContent></w:sdt>`;
  const field = (tag, alias, hint) => `<w:sdt><w:sdtPr><w:alias w:val="${esc(alias)}"/><w:tag w:val="${esc(tag)}"/><w:id w:val="${id++}"/><w:showingPlcHdr/><w:text w:multiLine="1"/></w:sdtPr><w:sdtContent><w:r><w:rPr><w:rStyle w:val="PlaceholderText"/></w:rPr><w:t xml:space="preserve">${esc(hint)}</w:t></w:r></w:sdtContent></w:sdt>`;
  // in a run of options across the line, each label is kept whole (no break inside it), so a box never ends a line alone
  const opt = (tag, o, across) => box(`${tag}|${o.key}`) + r(NBSP + (across ? o.label.replace(/ /g, NBSP) : o.label)) + (o.field ? r(across ? NBSP : ' ') + field(`${tag}|${o.key}-text`, `${o.label} (${tag.split('|')[0]})`, '__________') : '');
  const borders = (sides, color) => sides.map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="${color}"/>`).join('');
  const spacer = p('', '<w:spacing w:after="60"/>');
  // keep: a table marked keep stays on one page (each row is kept with the next), as Word does it
  const cellParas = (c, head, keep) => {
    const ppr = `${keep ? '<w:keepNext/>' : ''}<w:spacing w:after="40"/>`;
    return c && typeof c === 'object'
      ? (c.raw !== undefined ? String(c.raw).split('\n').map(line => p(r(line), ppr)).join('') : p(field(c.field, c.alias, ' '), ppr))
      : String(c).split('\n').map(line => p(rs(line, { b: head }), ppr)).join('');
  };
  const block = b => {
    switch (b.t) {
      case 'h1': return p(rs(b.text), '<w:pStyle w:val="Heading1"/>');
      case 'h2': return p(rs(b.text), `<w:pStyle w:val="Heading2"/>${b.pageBreak ? '<w:pageBreakBefore/>' : ''}`);
      case 'h3': return p(rs(b.text), '<w:pStyle w:val="Heading3"/>');
      case 'p': return p(rs(b.text), b.keepNext ? '<w:keepNext/>' : '');
      case 'raw': return p(r(b.text));
      case 'case': return p(r(b.label, { b: true }), '<w:keepNext/>') + b.text.split('\n').map((line, i, all) => p(r(line), `<w:pStyle w:val="CaseText"/>${i < all.length - 1 ? '<w:keepNext/>' : ''}`)).join('');
      case 'ul': return b.items.map(it => (typeof it === 'string' ? [[it, 0]] : [[it.text, 0], ...it.sub.map(s => [s, 1])])
        .map(([text, lvl]) => p(rs(text), `<w:pStyle w:val="ListBullet"/><w:numPr><w:ilvl w:val="${lvl}"/><w:numId w:val="1"/></w:numPr>`)).join('')).join('');
      case 'table': {
        const widths = b.widths.map(w => Math.round((w * WIDTH) / b.widths.reduce((s, x) => s + x, 0)));
        widths[widths.length - 1] += WIDTH - widths.reduce((s, x) => s + x, 0);
        const row = (cells, head, keep) => `<w:tr>${head ? '<w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>'}${cells.map((c, i) => `<w:tc><w:tcPr><w:tcW w:w="${widths[i]}" w:type="dxa"/>${head ? '<w:shd w:val="clear" w:color="auto" w:fill="D9E2F3"/>' : ''}</w:tcPr>${cellParas(c, head, keep)}</w:tc>`).join('')}</w:tr>`;
        return `<w:tbl><w:tblPr><w:tblW w:w="${WIDTH}" w:type="dxa"/><w:tblBorders>${borders(['top', 'left', 'bottom', 'right', 'insideH', 'insideV'], 'A6A6A6')}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${row(b.head, true, b.keep)}${b.rows.map((x, i) => row(x, false, b.keep && i < b.rows.length - 1)).join('')}</w:tbl>${spacer}`;
      }
      case 'choice': return vertical(b)
        ? p(rs(b.label), '<w:keepNext/>') + b.options.map((o, i) => p(opt(b.tag, o, false), `${i < b.options.length - 1 ? '<w:keepNext/>' : ''}<w:spacing w:after="20"/><w:ind w:left="360"/>`)).join('')
        : p(rs(b.label) + b.options.map(o => r('   ') + opt(b.tag, o, true)).join(''));
      case 'area': return `<w:tbl><w:tblPr><w:tblW w:w="${WIDTH}" w:type="dxa"/><w:tblBorders>${borders(['top', 'left', 'bottom', 'right'], '808080')}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="${WIDTH}"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="${(b.lines || 3) * 270 + 60}" w:hRule="atLeast"/></w:trPr><w:tc><w:tcPr><w:tcW w:w="${WIDTH}" w:type="dxa"/></w:tcPr>${p(field(b.tag, b.alias, 'Click or tap here to write.'))}</w:tc></w:tr></w:tbl>${spacer}`;
      case 'fields': return p(b.items.map((f, i) => (i ? r('      ') : '') + rs(`${f.label} `) + field(f.tag, f.label.replace(/[*`]/g, ''), '__________')).join(''));
      case 'hr': return '';
      default: throw new Error(`unknown block ${b.t}`);
    }
  };
  const body = doc.blocks.map(block).join('') + `<w:sectPr><w:footerReference w:type="default" r:id="rId4"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="900" w:right="1080" w:bottom="900" w:left="1080" w:header="480" w:footer="480" w:gutter="0"/></w:sectPr>`;
  const styles = `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="en-PH"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`
    + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
    + [['Heading1', 'heading 1', 0, 32, 200], ['Heading2', 'heading 2', 1, 26, 140], ['Heading3', 'heading 3', 2, 22, 120]].map(([sid, name, lvl, size, before]) => `<w:style w:type="paragraph" w:styleId="${sid}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${before}" w:after="80"/><w:outlineLvl w:val="${lvl}"/></w:pPr><w:rPr><w:b/><w:color w:val="1F3864"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr></w:style>`).join('')
    + '<w:style w:type="paragraph" w:customStyle="1" w:styleId="CaseText"><w:name w:val="Case text"/><w:basedOn w:val="Normal"/><w:pPr><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="1F3864"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:ind w:left="284" w:right="284"/></w:pPr><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>'
    + '<w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="40"/></w:pPr></w:style>'
    + '<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="595959"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style>'
    + '<w:style w:type="character" w:styleId="PlaceholderText"><w:name w:val="Placeholder Text"/><w:rPr><w:color w:val="808080"/></w:rPr></w:style>';
  const ct = (part, type) => `<Override PartName="/${part}" ContentType="application/vnd.openxmlformats-${type}+xml"/>`;
  const link = (rid, type, target) => `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/${type}" Target="${target}"/>`;
  const parts = [
    ['[Content_Types].xml', `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${ct('word/document.xml', 'officedocument.wordprocessingml.document.main')}${ct('word/styles.xml', 'officedocument.wordprocessingml.styles')}${ct('word/settings.xml', 'officedocument.wordprocessingml.settings')}${ct('word/numbering.xml', 'officedocument.wordprocessingml.numbering')}${ct('word/footer1.xml', 'officedocument.wordprocessingml.footer')}${ct('docProps/core.xml', 'package.core-properties')}${ct('docProps/app.xml', 'officedocument.extended-properties')}</Types>`],
    ['_rels/.rels', `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${link('rId1', 'officeDocument/2006/relationships/officeDocument', 'word/document.xml')}${link('rId2', 'package/2006/relationships/metadata/core-properties', 'docProps/core.xml')}${link('rId3', 'officeDocument/2006/relationships/extended-properties', 'docProps/app.xml')}</Relationships>`],
    ['docProps/core.xml', `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(doc.title)}</dc:title><dc:creator>Faculty adjudication package</dc:creator><cp:lastModifiedBy>Faculty adjudication package</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${BUILT}T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${BUILT}T00:00:00Z</dcterms:modified></cp:coreProperties>`],
    ['docProps/app.xml', `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Faculty adjudication package generator</Application></Properties>`],
    ['word/_rels/document.xml.rels', `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${link('rId1', 'officeDocument/2006/relationships/styles', 'styles.xml')}${link('rId2', 'officeDocument/2006/relationships/settings', 'settings.xml')}${link('rId3', 'officeDocument/2006/relationships/numbering', 'numbering.xml')}${link('rId4', 'officeDocument/2006/relationships/footer', 'footer1.xml')}</Relationships>`],
    ['word/document.xml', `${XML}<w:document ${NS} ${NS14}><w:body>${body}</w:body></w:document>`],
    ['word/styles.xml', `${XML}<w:styles ${NS}>${styles}</w:styles>`],
    ['word/settings.xml', `${XML}<w:settings ${NS}><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`],
    ['word/numbering.xml', `${XML}<w:numbering ${NS}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${[0, 1, 2].map(l => `<w:lvl w:ilvl="${l}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="${['•', '–', '·'][l]}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${360 + l * 360}" w:hanging="270"/></w:pPr></w:lvl>`).join('')}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`],
    ['word/footer1.xml', `${XML}<w:ftr ${NS}><w:p><w:pPr><w:pStyle w:val="Footer"/><w:jc w:val="center"/></w:pPr>${r(`${doc.footer} · page `)}<w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple>${r(' of ')}<w:fldSimple w:instr=" NUMPAGES "><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`],
  ];
  return zipStore(parts.map(([name, text]) => [name, Buffer.from(text, 'utf8')]));
};

// The same document as Markdown: the readable, diffable mirror kept for the coordinator and checked by the verifier.
const mdCell = c => (c && typeof c === 'object' && c.raw === undefined ? ' ' : String(c && typeof c === 'object' ? c.raw : c).replace(/\s*\n\s*/g, ' / ').replace(/\|/g, '\\|'));
const markdown = doc => doc.blocks.map(b => {
  switch (b.t) {
    case 'h1': return `# ${b.text}`;
    case 'h2': return `## ${b.text}`;
    case 'h3': return `### ${b.text}`;
    case 'p': case 'raw': return b.text;
    case 'case': return `**${b.label}**\n\n${b.text.split('\n').map(line => `> ${line}`).join('\n')}`;
    case 'ul': return b.items.map(it => (typeof it === 'string' ? `- ${it}` : [`- ${it.text}`, ...it.sub.map(s => `  - ${s}`)].join('\n'))).join('\n');
    case 'table': return [b.head, b.head.map(() => '---'), ...b.rows].map(row => `| ${row.map(mdCell).join(' | ')} |`).join('\n');
    case 'choice': {
      const opt = o => `${BOX} ${o.label}${o.field ? ' ____________' : ''}`;
      return vertical(b) ? `${b.label}\n${b.options.map(o => `   - ${opt(o)}`).join('\n')}` : `${b.label} ${b.options.map(opt).join(' ')}`;
    }
    case 'area': return '> (write here)';
    case 'fields': return b.items.map(f => `${f.label} ____________`).join('   ');
    case 'hr': return '---';
    default: throw new Error(`unknown block ${b.t}`);
  }
}).join('\n\n') + '\n';
const csvCell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
const csv = rows => '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const refuse = why => { console.log(`REFUSED: ${why}`); process.exit(2); };

// ---- presentation ----
// The two readings in question 3 are worded in parallel, neither with a justification, and are followed by a neutral third option.
const TYPE = {
  'CLO-PO': { title: 'CLO and program outcome', source: 'Program outcome (PO)', target: 'Course learning outcome (CLO)', srcShort: 'PO', tgtShort: 'CLO', item: 'CLO', mapTo: 'program outcome',
    question: 'Does the CLO align with the program outcome it is mapped to?',
    reading: ['A CLO can be aligned by developing part of the PO', 'A CLO is aligned only if it addresses every part of the PO'],
    targetHint: 'Name it from the program outcomes listed under Course context or from your program\'s own outcomes, or write "none suitable".' },
  'CLO-anyPO': { title: 'CLO and a list of program outcomes', source: 'Program outcomes (the whole list)', target: 'Course learning outcome (CLO)', srcShort: 'the PO it fits', tgtShort: 'CLO', item: 'CLO', mapTo: null, list: 'program outcome',
    question: 'Does the CLO align with at least one of the listed program outcomes? If so, which?',
    reading: ['A CLO can be aligned by developing part of the PO it fits', 'A CLO is aligned only if it addresses every part of the PO it fits'] },
  'CLO-EGA': { title: 'CLO and expected graduate attribute', source: 'Expected graduate attribute (EGA)', target: 'Course learning outcome (CLO)', srcShort: 'EGA', tgtShort: 'CLO', item: 'CLO', mapTo: 'graduate attribute',
    question: 'Does the CLO align with the graduate attribute it is mapped to?',
    reading: ['A CLO can be aligned by developing the attribute as a whole', 'A CLO is aligned only if it reflects each element of the attribute\'s name'],
    targetHint: 'Name one of the four graduate attributes listed under Course context, or write "none suitable".' },
  'CLO-anyEGA': { title: 'CLO and the list of graduate attributes', source: 'Expected graduate attributes (the whole list)', target: 'Course learning outcome (CLO)', srcShort: 'the EGA it fits', tgtShort: 'CLO', item: 'CLO', mapTo: null, list: 'graduate attribute',
    question: 'Does the CLO align with at least one of the listed graduate attributes? If so, which?',
    reading: ['A CLO can be aligned by developing the attribute it fits as a whole', 'A CLO is aligned only if it reflects each element of that attribute\'s name'] },
  'ILO-CLO': { title: 'ILO and course learning outcome', source: 'Course learning outcome (CLO)', target: 'Intended learning outcome (ILO)', srcShort: 'CLO', tgtShort: 'ILO', item: 'ILO', mapTo: 'CLO',
    question: 'Does the ILO align with the CLO it is meant to build toward?',
    reading: ['An ILO can be aligned by developing part of the CLO', 'An ILO is aligned only if it addresses every part of the CLO'],
    targetHint: 'Name it from the course learning outcomes listed under Course context, or write "none suitable".' },
};
const remapLabel = t => (t.item === 'ILO' ? 'Keep the ILO text and link it to a different CLO' : `Keep the CLO text and map it to a different ${t.mapTo}`);
const COURSE_ORDER = ['calc', 'ie', 'prog', 'nurs', 'edu', 'acct', 'hm'];
const COURSE_CODE = { calc: 'MA7', ie: 'IE310', prog: 'IT204', nurs: 'NCM101', edu: 'EDUC105', acct: 'ACCTG201', hm: 'HM210' };
const COURSE_REF = { calc: ['BSIE', 'MA 7'], ie: ['BSIE', null], prog: ['BSIT', 'IT-204'], nurs: [null], edu: [null], acct: [null], hm: [null] };
const REF_OF = { calc: 'R-BSIE', ie: 'R-BSIE', prog: 'R-BSIT' };
const BLOOM = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create', 'Not applicable', 'Cannot tell'];
// The status of every institutional or case text shown to reviewers. Nothing in the package is confirmed by the institution.
const STATUS = {
  synthetic: 'Synthetic: written for this review',
  transcribed: 'Transcribed: copied into the system, not confirmed by the institution',
  website: 'Website copy: pending institutional approval',
  none: 'Not held in the system',
};
const tagged = (label, status) => `**${label}** (*${STATUS[status]}*)`;
const opts = (labels, extra = {}) => labels.map(l => ({ key: slug(l), label: l, ...(extra[l] || {}) }));

async function main() {
  // ---- Version 1, which must be unchanged, and the records it was built from ----
  const v1Manifest = readJson(path.join(V1, 'package-manifest.json'));
  const v1Changed = v1Manifest.files.filter(f => !fs.existsSync(path.join(V1, f.path)) || sha(path.join(V1, f.path)) !== f.sha256).map(f => f.path);
  if (v1Changed.length) refuse(`Version 1 files changed or missing: ${v1Changed.join(', ')}`);
  const V1C = readJson(path.join(V1, 'coordinator', 'cases.json'));
  const SRC = Object.fromEntries(Object.entries(V1C.sources).map(([k, s]) => [k, k === 'prereg' ? PREREG : path.join(ROOT, s.file)]));
  const srcChanged = Object.entries(V1C.sources).filter(([k, s]) => !fs.existsSync(SRC[k]) || sha(SRC[k]) !== s.sha256 || v1Manifest.sources[k] !== s.sha256).map(([k]) => k);
  if (srcChanged.length) refuse(`a source differs from the hash Version 1 recorded: ${srcChanged.join(', ')}`);
  const D = readJson(SRC.dataset), VALS = readJson(SRC.values);
  const SEED = await import(pathToFileURL(SRC.seed).href);
  const OUTC = require(SRC.outcomes), CURR = require(SRC.curriculum);
  const dev = D.items.filter(i => i.split === 'dev'); // held-out items are dropped here and never read further
  const devById = new Map(dev.map(i => [i.id, i]));
  const KEY = Object.fromEntries(Object.entries(COURSE_CODE).map(([k, v]) => [v, k]));
  const keyOf = c => KEY[c.code.split('-')[0]];
  const cases = [...V1C.cases].sort((x, y) => COURSE_ORDER.indexOf(keyOf(x)) - COURSE_ORDER.indexOf(keyOf(y)) || x.code.localeCompare(y.code));
  const differs = cases.filter(c => {
    const i = devById.get(c.id);
    return !i || i.source !== c.source || i.target !== c.target || i.type !== c.type || i.course !== keyOf(c) || D.courses[i.course].code !== c.course.code
      || JSON.stringify(i.accept) !== JSON.stringify(c.provisional.accept);
  }).map(c => c.code);
  if (dev.length !== 58 || cases.length !== 58 || new Set(cases.map(c => c.id)).size !== 58 || differs.length) refuse(`the case records are not the 58 development cases (${differs.join(', ')})`);
  const proposals = cases.flatMap(c => c.proposals.map(p => ({ ...p, c })));
  const setCount = n => cases.filter(c => c.set === n).length;
  if (proposals.length !== 160 || setCount(1) !== 18 || setCount(2) !== 26 || setCount(3) !== 14 || proposals.some(p => !['rewrite', 'remap'].includes(p.kind) || (p.kind === 'rewrite') !== Boolean(p.text))) {
    refuse('the Version 1 case records do not hold 160 proposals and sets of 18, 26 and 14');
  }
  // the same CLO text within a course, for the cross-reference notes (Version 1 recorded the same lists)
  const cloText = c => (c.type === 'ILO-CLO' ? c.source : c.target);
  const alsoIn = c => cases.filter(o => o !== c && keyOf(o) === keyOf(c) && norm(cloText(o)) === norm(cloText(c))).map(o => o.code).sort();
  const sharedDiffers = cases.filter(c => JSON.stringify(alsoIn(c)) !== JSON.stringify(c.sharedClo)).map(c => c.code);
  if (sharedDiffers.length) refuse(`shared-CLO lists differ from Version 1: ${sharedDiffers.join(', ')}`);

  // ---- course facts, with the status of each ----
  const rowsOf = code => CURR.programs.find(p => p.code === code).terms.flatMap(t => t.rows.map(r => ({ ...r, yearLevel: t.yearLevel, semester: t.semester })));
  const rowText = r => `${r.code} ${r.title} (year ${r.yearLevel}, ${r.semester.toLowerCase()}, ${r.lecture} lecture and ${r.lab} laboratory units, prerequisite ${r.rawPrerequisite || 'cell blank in the source'})`;
  const placement = key => {
    const [program, code] = COURSE_REF[key], k = D.courses[key];
    if (!program) return { status: 'none', text: `The system holds no curriculum, program outcomes or syllabus for ${k.program}. Judge the cases from the texts given and your knowledge of the program. See R-NONE.` };
    const p = CURR.programs.find(x => x.code === program);
    if (!code) {
      const or = rowsOf(program).filter(r => /OPERATION RESEARCH/.test(r.title));
      return { status: 'none', text: `The ${program} ${p.curriculumYear} curriculum transcribed in the system has no course coded ${k.code}. Its operations research courses are ${or.map(rowText).join(' and ')}. See R-CODES.` };
    }
    return { status: 'transcribed', text: `The ${program} ${p.curriculumYear} curriculum transcribed in the system lists ${rowText(rowsOf(program).find(x => x.code === code))}. See ${REF_OF[key]} and R-CODES.` };
  };
  const codeKey = s => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const codeCheck = key => { // every transcribed curriculum is searched for the course code used in the forms
    const k = D.courses[key], found = CURR.programs.flatMap(p => rowsOf(p.code).filter(r => codeKey(r.code) === codeKey(k.code)).map(r => ({ program: p.code, year: p.curriculumYear, r })));
    const held = CURR.programs.some(p => p.code === k.program);
    return { k, found, held };
  };
  const mine = key => cases.filter(c => keyOf(c) === key);
  const posOf = key => [...new Set(mine(key).filter(c => c.type === 'CLO-PO').map(c => c.source)
    .concat(mine(key).filter(c => c.type === 'CLO-anyPO').flatMap(c => c.source.split('\n').map(l => l.replace(/^\d+\.\s*/, '')))))];
  const closOf = key => [...new Set(mine(key).filter(c => c.type === 'ILO-CLO').map(c => c.source))]; // the CLOs an ILO can be linked to
  const I = SEED.INSTITUTION;
  const egaNames = I.egas.map(e => e.name);
  const egaLabels = I.egas.map(e => (norm(e.short) !== norm(e.name) ? `${e.name} (short name in the system: "${e.short}")` : e.name));
  // case texts are shown verbatim and never pass through the inline markup
  const marked = cases.filter(c => /[*`]/.test(c.source + c.target) || c.proposals.some(p => /[*`]/.test(p.text || ''))).map(c => c.code);
  if (marked.length) refuse(`case texts contain * or \` and would be misread as markup: ${marked.join(', ')}`);
  if (proposals.some(p => p.kind === 'remap' && !TYPE[p.c.type].mapTo)) refuse('a re-mapping was proposed for a list case');

  // ---- output collection: every file with the audience it is for ----
  const out = new Map();
  const put = (file, data, audience) => out.set(file, { data: typeof data === 'string' ? data.replace(/\n{3,}/g, '\n\n') : data, audience });
  const MIRROR = 'coordinator-restricted/distributed-text';
  const putDoc = (file, doc, audience) => { put(file, docx(doc), audience); put(`${MIRROR}/${file.replace(/\.docx$/, '.md')}`, markdown(doc), 'coordinator'); };
  const A_DIR = '1-part-a-for-reviewers', B_DIR = '2-part-b-for-reviewers', P_DIR = '3-policy-panel', C_DIR = 'coordinator-restricted';
  const REFS = '02-curriculum-and-institutional-references.docx';

  // ======================= the reviewer forms =======================
  const courseContext = key => {
    const k = D.courses[key], pl = placement(key), pos = posOf(key);
    const egas = mine(key).some(c => c.type === 'CLO-EGA' || c.type === 'CLO-anyEGA'), ilo = mine(key).some(c => c.type === 'ILO-CLO');
    return [
      { t: 'h2', text: 'Course context' },
      { t: 'ul', items: [
        `${tagged('Course record', 'synthetic')}: ${k.code} ${k.title} · ${k.program} · year ${k.yearLevel} · ${k.discipline}. See R-CASES and R-CODES in the references.`,
        `${tagged('Course description', 'synthetic')}: "${k.description}"`,
        `${tagged('Curriculum placement', pl.status)}: ${pl.text}`,
        ...(pos.length ? [{ text: `${tagged('Program outcomes in this course\'s cases', 'synthetic')}: general wording written for this review, not ${k.program}'s official outcomes. Judge them as written.${REF_OF[key] ? ` The ${k.program} outcomes transcribed in the system are in ${REF_OF[key]}.` : ''}`, sub: pos }] : []),
        ...(ilo ? [{ text: `${tagged('Course learning outcomes that the ILOs in this course\'s cases build toward', 'synthetic')}:`, sub: closOf(key) }] : []),
        ...(egas ? [{ text: `${tagged('Expected graduate attributes', 'transcribed')}: the four names held in the system. No description of them is held (R-EGA).`, sub: egaLabels }] : []),
      ] },
    ];
  };
  const formA = c => {
    const t = TYPE[c.type], also = alsoIn(c), tag = q => `${c.code}|${q}`;
    const area = (q, label, lines) => [{ t: 'p', text: label, keepNext: true }, { t: 'area', tag: tag(q), alias: `${c.code} ${q}`, lines }];
    return [
      { t: 'h2', text: `${c.code} · ${t.title}`, pageBreak: true },
      { t: 'case', label: t.source, text: c.source },
      { t: 'case', label: t.target, text: c.target },
      ...(also.length ? [{ t: 'p', text: `*The same CLO also appears in ${also.join(', ')}. Judge each case on its own relationship.*` }] : []),
      { t: 'p', text: `**Question:** ${t.question}` },
      { t: 'choice', label: '**0. Is this case within your expertise?**', tag: tag('within-expertise'), options: opts(['Yes', 'No, it is outside my expertise']) },
      { t: 'p', text: '*If No, leave the rest of this case blank. The coordinator will reassign it.*' },
      { t: 'choice', label: '**1. Alignment:**', tag: tag('alignment'), options: opts(['Aligned', 'Partially aligned', 'Not aligned', 'Insufficient information to judge']) },
      ...(t.list ? [{ t: 'fields', items: [{ label: `Which ${t.list}(s) does it fit, if any? Write the number or numbers, or "none":`, tag: tag('fits') }] }] : []),
      ...area('rationale', '**2. Rationale.** What in the texts supports your judgment? What, if anything, is missing? If you chose "Insufficient information to judge", say what information you would need.', 3),
      { t: 'choice', label: '**3. Reading you applied** (the institution has not adopted a rule; see the guide):', tag: tag('reading'), vertical: true, options: [
        { key: 'part', label: t.reading[0] }, { key: 'every-part', label: t.reading[1] },
        { key: 'did-not-affect', label: 'The distinction did not affect my answer for this case' }, { key: 'other', label: 'Other (describe):', field: true }] },
      { t: 'choice', label: `**4. Course fit.** Does the ${t.item} itself belong in this course at this year level?`, tag: tag('course-fit'), options: opts(['Yes', 'No', 'Unsure', 'Insufficient information to judge']) },
      { t: 'fields', items: [{ label: 'Note (optional):', tag: tag('course-fit-note') }] },
      { t: 'choice', label: '**4b.** Did your answer to question 4 affect your answer to question 1?', tag: tag('course-fit-affected-alignment'), options: opts(['Yes', 'No']) },
      { t: 'choice', label: '**5. Recommendation:**', tag: tag('recommendation'), vertical: false, options: [
        { key: 'no-change', label: 'No change' }, { key: 'revise', label: `Revise the ${t.item} text` },
        ...(t.mapTo ? [{ key: 're-map', label: remapLabel(t) }] : []),
        { key: 'remove', label: t.item === 'CLO' ? 'Remove the CLO from this course' : 'Remove the ILO' },
        { key: 'refer', label: 'Refer for a policy decision' }, { key: 'insufficient-information', label: 'Insufficient information to recommend' },
        { key: 'other', label: 'Other (describe):', field: true }] },
      ...(t.mapTo ? [{ t: 'fields', items: [{ label: `If you chose to ${t.item === 'ILO' ? 'link it to a different CLO' : `map it to a different ${t.mapTo}`}, which one? ${t.targetHint}`, tag: tag('re-map-target') }] }] : []),
      { t: 'p', text: '**6. Cognitive level** (optional; revised Bloom\'s taxonomy):', keepNext: true },
      { t: 'choice', label: `${t.srcShort}:`, tag: tag('bloom-source'), options: opts(BLOOM), vertical: false },
      { t: 'choice', label: `${t.tgtShort}:`, tag: tag('bloom-target'), options: opts(BLOOM), vertical: false },
      { t: 'choice', label: '**7. Confidence:**', tag: tag('confidence'), options: opts(['High', 'Medium', 'Low']) },
      ...area('comments', '**8. Comments.** Anything else, including problems with the case itself.', 2),
    ];
  };
  const reviewerFields = part => ({ t: 'fields', items: [{ label: '**Reviewer code:**', tag: 'header|reviewer-code' }, { label: '**Date returned:**', tag: 'header|date-returned' },
    ...(part === 'B' ? [{ label: '**Part A returned on:**', tag: 'header|part-a-returned' }] : [])] });
  const cannotJudge = tag => ({ t: 'choice', label: '*If you cannot judge, why?*', tag: tag('cannot-judge-reason'), options: [...opts(['Outside my expertise', 'Insufficient information']), { key: 'other', label: 'Other:', field: true }] });
  const formB = c => {
    const t = TYPE[c.type];
    return [
      { t: 'h2', text: `${c.code} · ${t.title}`, pageBreak: true },
      { t: 'case', label: t.source, text: c.source },
      { t: 'case', label: `${t.target}, as written`, text: c.target },
      ...c.proposals.flatMap(p => {
        const tag = q => `${p.code}|${q}`;
        const note = label => [{ t: 'p', text: label, keepNext: true }, { t: 'area', tag: tag('note'), alias: `${p.code} note`, lines: 2 }];
        return p.kind === 'rewrite' ? [
          { t: 'h3', text: `${p.code} · Proposed rewrite of the ${t.item}` },
          { t: 'case', label: 'Proposed text', text: p.text },
          { t: 'choice', label: '**Rating:**', tag: tag('rating'), options: opts(['Appropriate as written', 'Acceptable with edits', 'Not appropriate', 'Cannot judge']) },
          cannotJudge(tag),
          { t: 'choice', label: '**Concerns** (tick any that apply):', tag: tag('concerns'), vertical: false, options: [...opts(['No concerns', `The ${t.item} needed no change`,
            'Raises the cognitive level more than the course or year warrants', 'Lowers the cognitive level inappropriately', 'Changes the course\'s subject matter or scope',
            'Duplicates or restates another outcome', 'Adds, removes or changes values or attributes', 'Adds content the alignment does not need', 'Removes content the outcome needs',
            'A different remedy would be better (re-map, remove)', 'Wording, clarity or measurability']), { key: 'other', label: 'Other:', field: true }] },
          ...note('**Suggested edit or note:**'),
        ] : [
          { t: 'h3', text: `${p.code} · Proposed re-mapping` },
          { t: 'p', text: `Keep the ${t.item} text unchanged and ${t.item === 'ILO' ? 'link it to a different CLO' : `map it to a different ${t.mapTo}`}. The proposal does not say which.` },
          { t: 'choice', label: '**Rating:**', tag: tag('rating'), options: opts(['Appropriate', `Appropriate only if a suitable ${t.mapTo} is named`, 'Not appropriate', 'Cannot judge']) },
          cannotJudge(tag),
          { t: 'fields', items: [{ label: `**Which ${t.mapTo} should it ${t.item === 'ILO' ? 'be linked' : 'be mapped'} to, if any?** ${t.targetHint}`, tag: tag('re-map-target') }] },
          { t: 'choice', label: '**Concerns** (tick any that apply):', tag: tag('concerns'), vertical: false, options: [...opts(['No concerns', `The ${t.item} itself should be revised`,
            `The ${t.item} should be removed`, `No suitable ${t.mapTo} exists`]), { key: 'other', label: 'Other:', field: true }] },
          ...note('**Note:**'),
        ];
      }),
    ];
  };
  const PART_A_HEAD = ['reviewer_code', 'date_returned', 'case_code', 'course', 'relationship', 'within_expertise (Yes / No - outside my expertise)',
    'alignment (Aligned / Partially aligned / Not aligned / Insufficient information)', 'which_listed_outcomes_fit (list cases only)', 'rationale',
    'reading_applied (Part / Every part / Did not affect / Other)', 'reading_other', 'belongs_in_course (Yes / No / Unsure / Insufficient information)',
    'belongs_in_course_note', 'course_fit_affected_alignment (Yes / No)',
    'recommendation (No change / Revise text / Re-map / Remove / Refer / Insufficient information / Other)', 're-map_target', 'recommendation_other',
    'bloom_source (optional)', 'bloom_target (optional)', 'confidence (High / Medium / Low)', 'comments'];
  const PART_B_HEAD = ['reviewer_code', 'date_returned', 'case_code', 'proposal_code', 'proposal_type', 'proposal_text',
    'rating (rewrites: Appropriate as written / Acceptable with edits / Not appropriate / Cannot judge; re-mappings: Appropriate / Appropriate if a target is named / Not appropriate / Cannot judge)',
    'cannot_judge_reason (Outside my expertise / Insufficient information / Other)', 'concerns', 're-map_target', 'suggested_edit_or_note'];
  const courseLine = key => { const k = D.courses[key]; return `${k.code} ${k.title} (${k.program}, year ${k.yearLevel})`; };
  for (const key of COURSE_ORDER) {
    const k = D.courses[key], code = COURSE_CODE[key], list = mine(key), withB = list.filter(c => c.proposals.length);
    putDoc(`${A_DIR}/${code}/${code}-part-a-form.docx`, { title: `Part A · ${k.code} ${k.title}`, footer: `Part A · ${k.code}`, blocks: [
      { t: 'h1', text: `Part A · ${k.code} ${k.title}` }, reviewerFields('A'),
      { t: 'h2', text: 'Before you start' },
      { t: 'ul', items: [
        `This form holds **${list.length} case${list.length === 1 ? '' : 's'}** for ${k.code}. Read the Part A reviewer guide first.`,
        'Judge each case on your own, without discussing it with other reviewers.',
        'If a case is outside your expertise, tick **No** at question 0 and leave the rest of that case blank.',
        `Fill in this form in Microsoft Word or on paper, or use the response sheet \`${code}-part-a-responses.csv\`. Return it to the coordinator. You will receive Part B after that.`,
      ] },
      ...courseContext(key), ...list.flatMap(formA),
    ] }, 'part-a-reviewers');
    put(`${A_DIR}/${code}/${code}-part-a-responses.csv`, csv([PART_A_HEAD, ...list.map(c => ['', '', c.code, courseLine(key), TYPE[c.type].title, ...PART_A_HEAD.slice(5).map(() => '')])]), 'part-a-reviewers');
    if (!withB.length) continue;
    const n = withB.reduce((s, c) => s + c.proposals.length, 0);
    putDoc(`${B_DIR}/${code}/${code}-part-b-form.docx`, { title: `Part B · ${k.code} ${k.title}`, footer: `Part B · ${k.code}`, blocks: [
      { t: 'h1', text: `Part B · ${k.code} ${k.title}` }, reviewerFields('B'),
      { t: 'h2', text: 'Before you start' },
      { t: 'ul', items: [
        '**Open this only after you have returned Part A.** Your Part A answers stand as you returned them.',
        `This form lists **${n} proposed change${n === 1 ? '' : 's'}** to outcomes in **${withB.length} case${withB.length === 1 ? '' : 's'}** of ${k.code}. Read the Part B reviewer guide first.`,
        'The proposals were generated automatically by the syllabus-checking software while it was being tested. They are in no particular order, and identical proposals are shown once. None of them is endorsed by anyone. Judge each on its merits.',
        'If you cannot judge a proposal, tick **Cannot judge** and say why.',
        `Fill in this form in Microsoft Word or on paper, or use the response sheet \`${code}-part-b-responses.csv\`.`,
      ] },
      ...courseContext(key), ...withB.flatMap(formB),
    ] }, 'part-b-reviewers');
    put(`${B_DIR}/${code}/${code}-part-b-responses.csv`, csv([PART_B_HEAD, ...withB.flatMap(c => c.proposals.map(p => ['', '', c.code, p.code,
      p.kind === 'rewrite' ? `rewrite of the ${TYPE[c.type].item}` : 're-mapping',
      p.kind === 'rewrite' ? p.text : `keep the text; ${TYPE[c.type].item === 'ILO' ? 'link it to a different CLO' : `map it to a different ${TYPE[c.type].mapTo}`}`, '', '', '', '', '']))]), 'part-b-reviewers');
  }

  // ======================= the reviewer guides (Part A and Part B are sent separately) =======================
  const statusTable = { t: 'table', widths: [3, 7], head: ['Label', 'What it means'], rows: [
    [STATUS.synthetic, 'Written to test the software. Not written by faculty, not institutional text and not taken from an approved syllabus. Judge it as written.'],
    [STATUS.transcribed, 'Copied into the syllabus system from an institutional document (a form, a syllabus or a registrar curriculum image). The responsible office has not confirmed the copy as current and approved.'],
    [STATUS.website, 'Copied from the university website. The institution has not confirmed it as the approved wording for syllabus checking.'],
    [STATUS.none, 'The system holds no text for this.'],
  ] };
  putDoc(`${A_DIR}/01-reviewer-guide-part-a.docx`, { title: 'Reviewer guide: Part A', footer: 'Reviewer guide · Part A', blocks: [
    { t: 'h1', text: 'Reviewer guide: Part A' },
    { t: 'p', text: 'Thank you for reviewing these cases. Your judgments will become the reference against which a syllabus-checking program is evaluated. They do not change any syllabus, grade or policy by themselves.' },
    { t: 'h2', text: 'What you receive' },
    { t: 'ul', items: [
      '**This guide.**',
      '**The curriculum and institutional references** (`02-curriculum-and-institutional-references`): the institutional texts held in the syllabus system, each with its source and status.',
      '**Your course\'s Part A form**, as a Word document you can fill in and as a PDF you can print, with a response sheet (CSV) if you prefer a spreadsheet. Each case shows one relationship between two outcomes, for example a course learning outcome and the program outcome it is mapped to, and asks for your judgment.',
      '**Part B, later.** After you return Part A, you will receive a separate Part B package. It asks you to rate changes proposed for some of the same outcomes.',
    ] },
    { t: 'h2', text: 'Before you start' },
    { t: 'ul', items: [
      'Please work on your own, and do not discuss the cases with other reviewers until the coordinator asks you to.',
      'Judge each relationship from the two texts and your professional knowledge of the course and program. You will not be shown how anyone else, or any software, judged these cases.',
      '**The cases are synthetic.** The course records, course descriptions and outcomes were written for this review to test the software. They were not written by faculty and are not taken from approved syllabi. The course codes and titles resemble the institution\'s programs; reference R-CODES shows which of them appear in the curricula transcribed in the system. The program outcomes in the cases are general wording, not your program\'s official outcomes. Judge every text as written.',
      'Some cases were written to be sound and some to be weak or mismatched. There is no expected proportion of either.',
      'If a case is unclear or badly posed, say so in the comments. That is useful information.',
      'A case\'s code tells you only its course and its place in your form.',
    ] },
    { t: 'h2', text: 'Status labels' },
    { t: 'p', text: 'Every text in the course context and the references carries one of these labels. **No text in this package has been confirmed by the institution.**' },
    statusTable,
    { t: 'h2', text: 'Terms' },
    { t: 'ul', items: [
      '**CLO:** course learning outcome. **ILO:** intended learning outcome of a lesson or week, a smaller unit within the course. **PO:** program outcome. **EGA:** expected graduate attribute (the system holds four names).',
      'In a **CLO and PO** or **CLO and EGA** case, the CLO is judged against the PO or EGA it is mapped to.',
      'In an **ILO and CLO** case, the ILO is judged against the CLO it is meant to build toward.',
      'In a **list** case, the CLO is judged against a whole list. The question is whether it fits at least one item, and which.',
    ] },
    { t: 'h2', text: 'The questions on each form' },
    { t: 'p', text: '**0. Within your expertise.** If a case is outside your expertise, tick **No** and leave the rest of that case blank. The coordinator will reassign it to another qualified reviewer. It is not counted as a judgment.' },
    { t: 'p', text: '**1. Alignment.** Choose one:' },
    { t: 'ul', items: [
      '**Aligned:** in your judgment, the outcome supports the outcome it is mapped to.',
      '**Partially aligned:** there is a connection, but it is weak, indirect, incomplete in a way that matters, or at an inappropriate level.',
      '**Not aligned:** the outcome does not support the outcome it is mapped to.',
      '**Insufficient information to judge:** the texts given are not enough to decide. Say in question 2 what you would need.',
    ] },
    { t: 'p', text: 'These descriptions are deliberately general. If your answer depends on how alignment is defined, question 3 records how.' },
    { t: 'p', text: '**2. Rationale.** Name the words or ideas in the texts that support your judgment, and anything missing.' },
    { t: 'p', text: '**3. Reading you applied.** When an outcome develops only part of the outcome above it, colleagues read "aligned" in different ways: some count a part as enough, others require every part. The institution has not adopted a rule. Tick the reading you applied. Tick "The distinction did not affect my answer for this case" when your answer would be the same under either reading. Your answer lets each judgment be read correctly under whatever rule is adopted.' },
    { t: 'p', text: '**4. Course fit.** Does the outcome itself belong in this course, at this year level? Choose **Unsure** if you have the information but cannot decide, and **Insufficient information to judge** if the materials do not give you enough. Question **4b** asks whether your course-fit answer affected your alignment answer. The institution has not decided whether course fit should affect the alignment verdict, so both answers are recorded.' },
    { t: 'p', text: '**5. Recommendation.** What, if anything, should change: no change; revise the outcome\'s text; keep the text but map or link it to a different outcome; remove the outcome; refer the case for a policy decision; insufficient information to recommend; or something else. If you choose a different outcome, name it: quote enough of its words to identify it, from the outcomes listed under Course context or, for program outcomes, from your program\'s own outcomes. Write "none suitable" if none fits.' },
    { t: 'p', text: '**6. Cognitive level** (optional). The revised Bloom\'s taxonomy level of each text (Remember, Understand, Apply, Analyze, Evaluate, Create). Choose "Not applicable", for example for an attribute\'s name, or "Cannot tell".' },
    { t: 'p', text: '**7. Confidence.**' },
    { t: 'ul', items: [
      '**High:** you would defend this judgment in a program review.',
      '**Medium:** reasonable colleagues might differ.',
      '**Low:** you are unsure or need more information.',
    ] },
    { t: 'p', text: '**8. Comments.** Anything else, including problems with the case itself.' },
    { t: 'h2', text: 'Returning your form' },
    { t: 'ul', items: [
      'In Word, tick the boxes and type in the grey fields. On paper, print the PDF and write by hand. In the response sheet, write one row per case, using the words of the form\'s options.',
      'Tick one box where a question asks for one answer. If you change your mind on paper, cross out the old tick clearly.',
      'Write the reviewer code the coordinator gave you. Write your name only if the institution asks for it.',
      'Return the form to the coordinator by the agreed date. Once returned, Part A is final, and you will then receive Part B.',
    ] },
    { t: 'h2', text: 'Time' },
    { t: 'p', text: 'As a rough guide, allow three to five minutes for each case.' },
  ] }, 'part-a-reviewers');

  putDoc(`${B_DIR}/01-reviewer-guide-part-b.docx`, { title: 'Reviewer guide: Part B', footer: 'Reviewer guide · Part B', blocks: [
    { t: 'h1', text: 'Reviewer guide: Part B' },
    { t: 'p', text: '**Open this only after you have returned Part A.** Your Part A answers stand as you returned them, and Part B does not change them.' },
    { t: 'h2', text: 'What Part B asks' },
    { t: 'ul', items: [
      'Part B lists changes proposed for some outcomes of the cases you judged in Part A. They were generated automatically by the syllabus-checking software while it was being tested.',
      'They are in no particular order, and identical proposals are shown once. None of them is endorsed by anyone. Judge each on its merits.',
      'Some proposals rewrite an outcome. Others keep the outcome\'s text and map it, or link it, to a different outcome without saying which.',
    ] },
    { t: 'h2', text: 'What you receive' },
    { t: 'ul', items: [
      '**This guide.**',
      '**Your course\'s Part B form**, as a Word document you can fill in and as a PDF you can print, with a response sheet (CSV).',
      'Use the **curriculum and institutional references** you received with Part A. The status labels have the same meaning here. No text in this package has been confirmed by the institution.',
    ] },
    { t: 'h2', text: 'Rating a proposal' },
    { t: 'p', text: '**A proposed rewrite.** Choose one:' },
    { t: 'ul', items: [
      '**Appropriate as written.**',
      '**Acceptable with edits:** suggest the edit.',
      '**Not appropriate.**',
      '**Cannot judge:** then say why.',
    ] },
    { t: 'p', text: '**A proposed re-mapping.** Choose one:' },
    { t: 'ul', items: [
      '**Appropriate.**',
      '**Appropriate only if a suitable outcome is named:** name it if you can.',
      '**Not appropriate.**',
      '**Cannot judge:** then say why.',
    ] },
    { t: 'p', text: '**Cannot judge.** If a proposal is outside your expertise, or the information given is not enough to judge it, tick **Cannot judge** and the reason. A proposal you cannot judge is not counted as a rating.' },
    { t: 'p', text: '**Concerns.** Tick any that apply, or "No concerns".' },
    { t: 'p', text: '**Naming an outcome.** Quote enough of its words to identify it, from the outcomes listed under Course context or, for program outcomes, from your program\'s own outcomes. Write "none suitable" if none fits.' },
    { t: 'h2', text: 'Returning your form' },
    { t: 'ul', items: [
      'In Word, tick the boxes and type in the grey fields. On paper, print the PDF and write by hand. In the response sheet, write one row per proposal, using the words of the form\'s options.',
      'Write the same reviewer code as in Part A, and the date you returned Part A.',
      'Return the form to the coordinator by the agreed date.',
    ] },
    { t: 'h2', text: 'Time' },
    { t: 'p', text: 'As a rough guide, allow one to two minutes for each proposal.' },
  ] }, 'part-b-reviewers');

  // ======================= curriculum and institutional references (sent with Part A and to the policy panel) =======================
  const egaName = n => I.egas.find(e => e.no === n)?.name || `EGA ${n}`;
  const status = (s, more = '') => ({ t: 'p', text: `**Status:** *${STATUS[s]}*.${more ? ` ${more}` : ''}` });
  const currTable = code => {
    const p = CURR.programs.find(x => x.code === code);
    return [{ t: 'p', text: `**${p.code}, ${p.name}, curriculum ${p.curriculumYear}** (registrar images ${p.files.join(', ')}; ${p.totalUnits} units)` },
      { t: 'table', widths: [6, 9, 13, 30, 5, 5, 18], head: ['Year', 'Semester', 'Code', 'Title', 'Lec', 'Lab', 'Prerequisite as printed'],
        rows: p.terms.flatMap(t => t.rows.map(r => [String(t.yearLevel), t.semester, { raw: r.code }, { raw: r.title }, String(r.lecture), String(r.lab), { raw: r.rawPrerequisite || '(blank)' }])) }];
  };
  const currStatus = status('transcribed', '`server/db/local-curriculum-data.cjs` describes itself as a "human-verified transcription" of the registrar curriculum images. The registrar has not confirmed it as the current approved curriculum.');
  const egaCases = cases.filter(c => c.type === 'CLO-EGA').map(c => c.source).concat(cases.filter(c => c.type === 'CLO-anyEGA').flatMap(c => c.source.split('\n').map(l => l.replace(/^\d+\.\s*/, ''))));
  const egaShorts = I.egas.map(e => e.short), byShort = egaCases.filter(n => !egaNames.includes(n));
  if (!byShort.every(n => egaShorts.includes(n))) refuse('an EGA in the cases is not one of the names or short names held in the system');
  const egaInCases = byShort.length ? `by full name or, in ${byShort.length === 1 ? 'one case' : `${byShort.length} cases`}, by the short name the system also holds` : 'by full name';
  const it204 = SEED.COURSES.find(c => c.code === 'IT 204');
  const codeRows = COURSE_ORDER.map(key => {
    const { k, found, held } = codeCheck(key);
    const where = found.length ? found.map(f => `${f.program} ${f.year}: ${f.r.code} ${f.r.title} (year ${f.r.yearLevel}, ${f.r.semester.toLowerCase()})`).join('\n')
      : held ? `Not found. The ${k.program} curriculum transcribed in the system has no course coded ${k.code}.` : `No curriculum for ${k.program} is held, so the code cannot be checked.`;
    return [`${k.code} ${k.title}`, `${k.program}, year ${k.yearLevel}`, { raw: where }, found.length ? STATUS.transcribed : STATUS.none];
  });
  const references = { title: 'Curriculum and institutional references', footer: 'Curriculum and institutional references', blocks: [
    { t: 'h1', text: 'Curriculum and institutional references' },
    { t: 'p', text: 'These are the institutional texts held in the syllabus system, reproduced exactly, with their sources and status. **None of them is a policy on how alignment is judged.** Where the system holds nothing, the entry says so.' },
    { t: 'p', text: '**No text in this package has been confirmed by the institution.** Each entry carries one of these status labels:' },
    statusTable,
    { t: 'h2', text: 'R-CASES · The review cases' },
    status('synthetic'),
    { t: 'p', text: `The course records (code, title, program, year level and discipline), the course descriptions, the program outcomes and the course and lesson outcomes in the review forms were written for this review, to test the software. They were not written by faculty and are not taken from approved syllabi. The graduate attributes in the cases are named as the system holds them (R-EGA), ${egaInCases}.` },
    { t: 'h2', text: 'R-CODES · Course codes in the forms, checked against the curricula held in the system' },
    { t: 'p', text: `Every curriculum transcribed in the system (${CURR.programs.map(p => `${p.code} ${p.curriculumYear}`).join(', ')}) was searched for each course code used in the forms. A match shows only that the code appears in a transcription. It does not confirm the course descriptions or outcomes in the cases, which are synthetic.` },
    { t: 'table', widths: [22, 14, 44, 20], head: ['Course in the forms', 'Program and year in the forms', 'In the curricula transcribed in the system', 'Status'], rows: codeRows },
    { t: 'h2', text: 'R-INST · Vision and mission' },
    status('transcribed', 'Source: `src/data/outcomesSeed.js`, which records that it was copied from the institutional form.'),
    { t: 'p', text: '**Vision.**' }, { t: 'raw', text: I.vision },
    { t: 'p', text: '**Mission.**' }, { t: 'raw', text: I.mission.lead },
    ...I.mission.items.map(m => ({ t: 'raw', text: `– ${m}` })),
    { t: 'h2', text: 'R-EGA · Expected graduate attributes' },
    status('transcribed', 'Source: `src/data/outcomesSeed.js` and `server/db/local-outcome-data.cjs`. **The system holds names only.** No description of any attribute is held (status: not held).'),
    { t: 'table', widths: [1, 5, 3], head: ['No.', 'Name', 'Short name'], rows: I.egas.map(e => [String(e.no), { raw: e.name }, { raw: e.short }]) },
    { t: 'h2', text: 'R-VAL · Core values' },
    status('website', `Source: \`server/config/marian-values.json\`, copied from ${VALS.source} on ${VALS.retrievedAt}. The file records its approval status as "${VALS.approval.replace(/_/g, ' ')}": the wording has not been confirmed by the institution as the approved wording for syllabus checking, and findings that use it stay advisory until it is.`),
    { t: 'table', widths: [1, 3], head: ['Value', 'Definition (website wording, not confirmed for this use)'], rows: VALS.values.map(v => [{ raw: v.name }, { raw: v.definition }]) },
    { t: 'p', text: 'No source in the system attributes any of these values to an Augustinian or a Marian tradition.' },
    { t: 'h2', text: 'R-BSIT · BS Information Technology' },
    { t: 'h3', text: 'Program outcomes and their EGA mapping (the system\'s list)' },
    status('transcribed', 'Source: `src/data/outcomesSeed.js`, which records that it was copied from the institutional form.'),
    { t: 'p', text: '**About the EGA column.** It is the mapping held in the system\'s list. The system does not record who adopted it or when, and the institution has not confirmed it. It is evidence of one list, not an approved mapping.' },
    { t: 'table', widths: [1, 9, 4], head: ['PO', 'Outcome', 'Mapped to EGA (not confirmed)'], rows: SEED.PROGRAMS.BSIT.pos.map(p => [String(p.no), { raw: p.text }, p.egas.map(n => `${n} (${egaName(n)})`).join('; ')]) },
    { t: 'h3', text: 'Program outcomes transcribed from the IT 202 syllabus' },
    status('transcribed', `Source: \`server/db/local-outcome-data.cjs\`, from ${OUTC.sources.BSIT.file}, pages ${OUTC.sources.BSIT.pages.join(' and ')}.`),
    ...(OUTC.sources.BSIT.warnings.length ? [{ t: 'ul', items: OUTC.sources.BSIT.warnings.map(w => `Note in the source: ${w}`) }] : []),
    { t: 'table', widths: [1, 12], head: ['PO', 'Outcome'], rows: OUTC.sources.BSIT.pos.map(p => [String(p.no), { raw: p.text }]) },
    { t: 'h3', text: 'The IT 204 syllabus template\'s course learning outcomes' },
    status('transcribed', 'Source: `src/data/outcomesSeed.js`, copied from a syllabus template labelled "corrected syllabus template (IT204-Programming2-EOMS)". The system does not record whether this template is the approved syllabus. The template also tags CLOs 2, 3 and 4 with PO 11 and PO 14, which are not in the BSIT list; those tags were left out when it was copied, for an administrator to decide.'),
    { t: 'table', widths: [2, 8, 5, 3, 3, 16], head: ['CLO', 'Title', 'Level label', 'POs', 'EGAs', 'Statement'], rows: it204.clos.map((k, i) => [String(i + 1), { raw: k.title }, { raw: k.level }, k.pos.join(', '), k.egas.join(', '), { raw: k.statement }]) },
    { t: 'p', text: 'The system does not define the level labels (Introductory, Enabling, Demonstrating, Integration of Values).' },
    { t: 'h3', text: 'Curriculum' }, currStatus, ...currTable('BSIT'),
    { t: 'h2', text: 'R-BSIE · BS Industrial Engineering' },
    { t: 'h3', text: 'Program outcomes transcribed from the IE 402 syllabus' },
    status('transcribed', `Source: \`server/db/local-outcome-data.cjs\`, from ${OUTC.sources.BSIE.file}, pages ${OUTC.sources.BSIE.pages.join(', ')}.`),
    ...(OUTC.sources.BSIE.warnings.length ? [{ t: 'ul', items: OUTC.sources.BSIE.warnings.map(w => `Note in the source: ${w}`) }] : []),
    { t: 'table', widths: [1, 12], head: ['PO', 'Outcome'], rows: OUTC.sources.BSIE.pos.map(p => [String(p.no), { raw: p.text }]) },
    { t: 'h3', text: 'Curriculum' }, currStatus, ...currTable('BSIE'),
    { t: 'h2', text: 'R-NONE · Programs with nothing held' },
    status('none'),
    { t: 'p', text: 'The system holds no program outcomes, curriculum or syllabus for **BSN** (NCM 101), **BSEd** (EDUC 105), **BSA** (ACCTG 201) or **BSHM** (HM 210). Cases in these courses are judged from their texts and the reviewers\' knowledge of the program. Whether official outcomes should be supplied is a pending institutional decision.' },
  ] };
  putDoc(`${A_DIR}/${REFS}`, references, 'part-a-reviewers');
  putDoc(`${P_DIR}/04-curriculum-and-institutional-references.docx`, references, 'policy-panel');

  // ======================= the policy panel: academic policy questions =======================
  // Neutral wording: options in no order of preference, each with a parallel "in practice" line; no inference from the system's
  // records toward any option; no case codes or case texts (the coordinator holds the case lists until Part A is returned).
  const POLICY = V1C.policyQuestions;
  const record = id => ({ t: 'table', keep: true, widths: [3, 7], head: ['Decision record', ''], rows: [
    ['Decision (option, with any wording)', { field: `${id}|decision`, alias: `${id} decision` }], ['Rationale', { field: `${id}|rationale`, alias: `${id} rationale` }],
    ['Decided by (role)', { field: `${id}|decided-by`, alias: `${id} decided by` }], ['Approval reference (minutes, memo or resolution)', { field: `${id}|approval-reference`, alias: `${id} approval reference` }],
    ['Date', { field: `${id}|date`, alias: `${id} date` }], ['Applies to (programs)', { field: `${id}|applies-to`, alias: `${id} applies to` }]] });
  const optionTable = rows => ({ t: 'table', keep: true, widths: [3, 7, 6], head: ['Option', 'What it says', 'What it would mean in practice'], rows: [...rows, ['D. Other', 'The panel\'s own wording.', 'As the panel describes.']] });
  const affected = id => ({ t: 'p', keepNext: true, text:`**Cases affected:** ${POLICY[id].cases.length}. The coordinator holds the list and shares it with the panel after the case reviewers have returned Part A.` });
  const open = more => ({ t: 'p', keepNext: true, text: `**Status:** open; requires an institutional decision.${more ? ` ${more}` : ''}` });
  const holds = items => [{ t: 'p', text: '**What the system holds** (evidence of current practice, with its status; not policy)' }, { t: 'ul', items }];
  const subq = (id, letter, text, labels) => ({ t: 'choice', label: `(${letter}) ${text}`, tag: `${id}|${letter}`, vertical: true, options: [...opts(labels), { key: 'other', label: 'Other:', field: true }] });
  const javaClo = it204.clos.find(k => k.statement.startsWith('Design, implement, and test robust and maintainable Java programs'));
  const bsitPo = n => SEED.PROGRAMS.BSIT.pos.find(p => p.no === n).text;
  if (!javaClo || !javaClo.pos.includes(3) || !javaClo.pos.includes(7)) refuse('the IT 204 template evidence quoted in P1 is not in the source');
  const egaMap = I.egas.map(e => [`${e.no} (${e.name})`, SEED.PROGRAMS.BSIT.pos.filter(p => p.egas.includes(e.no)).map(p => p.no).join(', ')]);
  const levelTitles = it204.clos.map(k => k.title).filter(t => t.includes('/'));
  const valuePhrase = 'Christo-centric Catholic and Marian–Augustinian values';
  if (!it204.clos.some(k => k.statement.includes(valuePhrase))) refuse('the IT 204 value phrase quoted in P6 is not in the source');
  putDoc(`${P_DIR}/01-academic-policy-questions.docx`, { title: 'Academic policy questions', footer: 'Academic policy questions', blocks: [
    { t: 'h1', text: 'Academic policy questions' },
    { t: 'p', text: '**Status: open.** The system holds no approved answer to any of these questions. Each needs an institutional decision before faculty judgments can become approved evaluation references.' },
    { t: 'p', text: 'These seven questions arose while the syllabus-checking software was being evaluated. They are set out without saying how the software, or anyone else, answered the cases.' },
    { t: 'ul', items: [
      '**How to answer.** The policy panel records one decision per question in the record under it, or in `decision-and-approval-record.csv`, with the approving role, the approval reference and the date. Please decide on academic grounds. Do not choose an option because it would make the software agree with any particular answer.',
      '**The options are listed in no order of preference.** None is recommended. Option D lets the panel write its own.',
      '**Evidence notes.** Where the system holds something relevant, it is quoted as evidence of current practice, with its status as defined in the references (04-curriculum-and-institutional-references). It is not policy, and no text in this package has been confirmed by the institution. Where nothing is held, the question says so.',
      '**When to answer.** After the case reviewers have returned Part A (procedure, step 4), so that their own readings are recorded first.',
    ] },
    { t: 'h2', text: 'P1. When is a CLO aligned with the program outcome it is mapped to: when it develops part of the PO, or only when it addresses all of it?' },
    { t: 'p', text: 'Two different judgments can be made about a program outcome: whether one CLO aligns with the PO it is mapped to, and whether the program, across all its courses, develops the whole PO. This question concerns the first. The second can be checked separately whichever option is chosen.' },
    optionTable([
      ['A. Contribution', 'A CLO is aligned with a PO when it develops a substantial part of the PO at an appropriate level. "Partially aligned" is kept for a contribution that is weak, indirect or at an inappropriate level.', 'A CLO that develops one part of a broad PO is Aligned. Coverage of the whole PO is checked separately, across the curriculum.'],
      ['B. Coverage', 'A CLO is aligned only when it addresses every part of the PO: each action, object and condition. A CLO that develops some parts is partially aligned.', 'A CLO that develops one part of a broad PO is Partially aligned. Coverage of the whole PO is shown CLO by CLO.'],
      ['C. Contribution, with a recorded degree', 'As A, and each CLO–PO mapping also records how far the CLO develops the PO, for example introductory, enabling or demonstrating.', 'A CLO that develops one part of a broad PO is Aligned, with its degree recorded. Coverage is checked across the curriculum from the recorded degrees, which needs an agreed scale.'],
    ]),
    { t: 'p', text: '**An illustration** (not one of the review cases): a CLO on preparing a project budget, mapped to a PO on planning, implementing and evaluating projects, is Aligned under A and C and Partially aligned under B. Where a CLO implies a component without stating it, the answer can also depend on whether implied components count.' },
    ...holds([
      `**One template maps a CLO to POs whose wording it does not contain** (status: transcribed). The IT 204 syllabus template copied into the system maps its CLO "${javaClo.statement.split(' ').slice(0, 9).join(' ')} …" to PO 3 ("${bsitPo(3)}") and to PO 7 ("${bsitPo(7)}"). The CLO's wording does not mention society. The system does not record why these mappings were made, and some of the template's tags (PO 11, PO 14) are not in the BSIT list.`,
      '**The template\'s CLOs carry level labels that the system does not define:** Introductory, Enabling, Demonstrating and Integration of Values (decision I7).',
      '**No curriculum map is held**, so the system has no record of how far each course contributes to each PO.',
    ]),
    affected('P1'), open(), record('P1'),
    { t: 'h2', text: 'P2. When is an ILO aligned with its CLO: when it develops part of the CLO, or only when it addresses all of it?' },
    { t: 'p', text: 'The same question as P1, one level down: it concerns one ILO and the CLO it is linked to.' },
    optionTable([
      ['A. Partial development', 'An ILO is aligned when it develops part of its CLO, in the same subject, even if it does not address the CLO\'s other parts.', 'An ILO that develops one part of its CLO is Aligned. Whether the ILOs linked to a CLO together cover it is not part of this verdict.'],
      ['B. Coverage', 'An ILO is aligned only when it addresses every part of its CLO; otherwise it is partially aligned.', 'An ILO that develops one part of its CLO is Partially aligned.'],
      ['C. Partial development, with the set checked', 'As A, and the ILOs linked to each CLO are checked together to confirm that they cover it.', 'An ILO that develops one part of its CLO is Aligned, and each CLO\'s set of ILOs is checked as well.'],
    ]),
    { t: 'p', text: '**Related sub-questions**' },
    { t: 'ul', items: ['(a) How should an ILO at a lower cognitive level than its CLO be judged?', '(b) How should an ILO at a higher cognitive level than its CLO be judged?',
      '(c) Must an ILO state its CLO\'s context or qualities, for example its setting, a required quality, or the conditions of performance?'] },
    ...holds(['Each ILO is linked to one CLO. No institutional rule on how an ILO is judged against its CLO is held.']),
    affected('P2'), open(), record('P2'),
    { t: 'h2', text: 'P3. How is a CLO judged against an expected graduate attribute that is held only as a name?' },
    { t: 'p', text: `The four attributes are held only as names (R-EGA; status: transcribed): ${egaNames.map(n => `"${n}"`).join(', ')}.` },
    optionTable([
      ['A. As a whole', 'A CLO aligns with an attribute when it develops the attribute in a recognisable way. It need not reflect every element of the name.', 'A CLO can align with an attribute without showing every element of its name.'],
      ['B. Element by element', 'The CLO must reflect each element of the name. For example, for "Critical and Creative thinker" it must show both critical and creative thinking; for "Competent Catholic Augustinian-Marian Professional", both professional competence and the Catholic and Augustinian-Marian dimension.', 'A CLO aligns with an attribute only if it shows every element of the name.'],
      ['C. Against an institutional description', 'The institution supplies a description or rubric for each attribute, and CLOs are judged against it.', 'CLOs are judged against the descriptions once they are supplied (decision I3).'],
    ]),
    { t: 'p', text: '**Related sub-questions**' },
    { t: 'ul', items: ['(a) Can a technical CLO with no ethical or faith element align with "Competent Catholic Augustinian-Marian Professional"?',
      '(b) Must a CLO mapped to "Critical and Creative thinker" show creativity as well as critical thinking?', '(c) Is a CLO\'s link to "Socially Responsive Steward" established by serving a community need?'] },
    ...holds(['**Names only** (status: transcribed); no description of any attribute is held. The system also records that the source syllabi state no PO-to-EGA mapping for BSIE and BSCpE.',
      '**The BSIT list maps each PO to attributes** (status: transcribed; the mapping is not confirmed). The PO texts are in R-BSIT. It shows how one program\'s list associates outcomes with attributes. It is not a definition of the attributes.']),
    { t: 'table', widths: [6, 4], head: ['Attribute', 'BSIT POs mapped to it in the system\'s list'], rows: egaMap },
    affected('P3'), open('If an official description of each attribute exists, please supply it (decision I3).'), record('P3'),
    { t: 'h2', text: 'P4. Should an outcome\'s fit with its course affect the alignment verdict?' },
    { t: 'p', text: '**Situations:** a CLO on a topic that the curriculum teaches in another course; a team design CLO without the course\'s subject content; a CLO whose activity the course description does not mention; a CLO that may be too advanced, or too basic, for its year.' },
    optionTable([
      ['A. Separate', 'The alignment verdict judges only the relationship between the two outcomes. Fit with the course\'s subject and year level is a separate finding.', 'Two findings are reported. An outcome can be Aligned and also be found not to fit its course.'],
      ['B. Integrated', 'An outcome outside the course\'s subject cannot be aligned, whatever its relationship to the PO or EGA.', 'One finding is reported. An outcome outside the course\'s subject is not aligned.'],
      ['C. Integrated only across disciplines', 'An outcome from another discipline altogether is not aligned; otherwise fit is a separate finding.', 'One finding for an outcome from another discipline; two findings otherwise.'],
    ]),
    { t: 'p', text: '**Related sub-questions**' },
    { t: 'ul', items: ['(a) What is the authority on a course\'s scope: the course description, the approved syllabus or the curriculum?', '(b) Does the institution set expected cognitive levels by year?',
      '(c) Who decides that an outcome is too advanced or too basic for its year?'] },
    ...holds([`**Registrar curriculum transcriptions** for ${CURR.programs.map(p => p.name).join('; ')} (status: transcribed; not confirmed by the registrar), with year, semester, units and prerequisites (R-BSIT, R-BSIE). They show where courses sit, not how fit should affect an alignment verdict.`,
      '**No year-level policy is held.** Nothing at all is held for BSN, BSEd, BSA or BSHM.']),
    affected('P4'), open(), record('P4'),
    { t: 'h2', text: 'P5. When a recommendation concerns a mapping, should it re-map or rewrite, and what must it state?' },
    { t: 'p', text: '**Situations:** a sound CLO mapped to an unrelated PO or EGA; an ILO linked to the wrong CLO; a CLO that fits no outcome of its program; a CLO that is weak in itself.' },
    { t: 'p', text: '**Sub-questions** (tick one option in each, or write your own):' },
    subq('P5', 'a', 'When an outcome is sound but mapped to the wrong outcome:', ['Change the mapping and keep the text', 'Rewrite the text to fit the mapping', 'Decide case by case']),
    subq('P5', 'b', 'Must a re-mapping recommendation name the outcome to map to?', ['Yes, always', 'Yes, when the program\'s list is available', 'No, stating that the mapping does not fit is enough']),
    subq('P5', 'c', 'May a recommendation propose removing an outcome from its course?', ['Yes', 'No, only flag it']),
    { t: 'fields', items: [{ label: '(d) Who approves a mapping change? (name the role)', tag: 'P5|d' }] },
    subq('P5', 'e', 'When an outcome is below its course\'s level and mapped to the wrong outcome, should it be:', ['Re-mapped as it is', 'Rewritten first', 'Decided case by case']),
    ...holds(['In the system as designed, the institution\'s vision, mission and EGAs, and each program\'s POs, are fixed. Faculty write CLOs and map them.',
      'When the IT 204 template was copied, its tags to PO 11 and PO 14, which are not in the BSIT list, were left out so that "an administrator decides what they should map to". That is how one mapping question was handled, not a rule.']),
    affected('P5'), open(), record('P5'),
    { t: 'h2', text: 'P6. May a recommendation add or change value wording in an outcome, and which value vocabulary applies?' },
    { t: 'p', text: '**Sub-questions**' },
    { t: 'ul', items: ['(a) When a CLO already names values, may a recommendation add other values, or attribute them to a tradition (for example call a value "Marian" or "Augustinian")?',
      '(b) Which vocabulary is authoritative for syllabus outcomes: the six core values; values described as Augustinian or Marian; other terms (for example integrity, truth, service)?',
      '(c) Must recommendations keep the author\'s value wording exactly?', '(d) Who confirms that the value wording in an outcome is correct?'] },
    ...holds([`**Six core values** (status: website copy, pending approval): ${VALS.values.map(v => v.name).join(', ')}. Their names and definitions were copied from the university website and have not been confirmed for syllabus checking (R-VAL, decision I4).`,
      '**No tradition is assigned.** No source in the system assigns any value to an Augustinian or a Marian tradition.',
      `**One template uses the phrase** (status: transcribed). The IT 204 template uses "${valuePhrase}" in a CLO.`]),
    affected('P6'), open('It also needs the value definitions to be confirmed (decision I4).'), record('P6'),
    { t: 'h2', text: 'P7. How are cognitive (Bloom\'s) levels applied to graduate attributes and to outcomes with several verbs?' },
    { t: 'p', text: '**Sub-questions**' },
    { t: 'ul', items: ['(a) Should an EGA, which is a noun phrase rather than an action, be given a cognitive level? If not, how is a CLO\'s level judged against it?',
      '(b) When an outcome has several verbs (for example "design, implement and evaluate"), which verb sets its level: the highest, the main one, or each separately?',
      '(c) How should an ILO\'s level be compared with its CLO\'s? (See also P2.)', '(d) Which taxonomy and verb list does the institution use?'] },
    ...holds([`**Levels are used in practice** (status: transcribed). The IT 204 template's CLO titles name levels: ${levelTitles.map(t => `"${t}"`).join(', ')}.`, '**No rule is held** on how levels are assigned or compared.']),
    affected('P7'), open(), record('P7'),
  ] }, 'policy-panel');

  // ======================= the policy panel: institutional decisions and approval requirements =======================
  const BEFORE_SEND = 'Step 1, before Part A is sent', STEP4 = 'Step 4, before the panel decides', STEP6 = 'Step 6, adjudication', STEP7 = 'Step 7, recording references';
  const DECISIONS = [ // id, decision, why it is needed, who decides (role), needed before
    ['P1–P7', 'The seven academic policy questions (01-academic-policy-questions)', 'They decide how case judgments become references', 'Policy panel', STEP6],
    ['I1', 'Name the coordinator, two reviewers per course, an adjudicator per discipline and the policy panel', 'The review needs qualified, independent people', 'Academic affairs', BEFORE_SEND],
    ['I2', 'Approve, amend or reject the adjudication procedure (03-adjudication-procedure)', 'It is a proposal', 'Academic affairs, with quality assurance', BEFORE_SEND],
    ['I3', 'Supply an official description of each EGA, or confirm that none exists', 'The system holds names only (P3)', 'The office responsible for the graduate attributes', STEP4],
    ['I4', 'Confirm or replace the core-value names and definitions', 'They were copied from the website and are pending approval (P6)', 'The office responsible for the core values', STEP4],
    ['I5', 'Supply official program outcomes and curricula for BSN, BSEd, BSA and BSHM, or confirm that these cases are judged as written', 'None is held; the cases use synthetic wording', 'The program chairs', BEFORE_SEND],
    ['I6', 'Confirm the BSIT outcome list and its mapping to the EGAs', 'The system holds 10 outcomes from the institutional form and 9 transcribed from the IT 202 syllabus, numbered differently; the IT 204 template tags outcomes 11 and 14; the PO-to-EGA mapping is not confirmed', 'The BSIT program chair', STEP4],
    ['I7', 'Say what the CLO level labels Introductory, Enabling, Demonstrating and Integration of Values mean, and whether a curriculum map with contribution levels exists', 'It bears on P1', 'Quality assurance', STEP4],
    ['I8', 'Decide whether "insufficient information" is an acceptable reference answer, and how it is treated', 'Reviewers may choose it, and the software has a similar verdict ("insufficient evidence")', 'Policy panel', STEP6],
    ['I9', 'Decide when a case may carry more than one accepted answer', 'Some cases may be genuinely open to two readings', 'Policy panel', STEP6],
    ['I10', 'Set the standard for an approved reference (for example both reviewers agree, or an adjudicated decision), and how unresolved cases are reported', 'It is needed to record decisions', 'Policy panel', STEP7],
    ['I11', 'Set limits on recommendations: may they raise an outcome\'s cognitive level beyond what its course and year need, change its subject matter, add content not needed for alignment, or propose removal?', 'Part B asks faculty to rate such proposals; the software needs a rule', 'Policy panel', STEP7],
    ['I12', 'Decide where approved references are kept, how they are versioned, who may change them, and whether reviewers are recorded by name or by code', 'Accountability and privacy; the forms collect a reviewer code', 'Academic affairs, with the data protection officer', BEFORE_SEND],
    ['I13', 'Decide whether and how faculty review the protected held-out cases (other reviewers, no software output, sealed until the final run)', 'Their verdicts are also developer-written', 'Quality assurance', 'Before any held-out run'],
    ['I14', 'Confirm that the checker\'s findings stay advisory, and that this review changes neither the official score, the pass mark of 79, the 47 rules nor the submission gates', 'This review changes no policy by itself', 'Academic affairs', 'Standing'],
    ['I15', 'Decide whether collecting, recording and reporting the reviewers\' judgments needs research-ethics clearance or the reviewers\' informed consent (for example if results are reported in a thesis or capstone document), and obtain it if so', 'Judgments are collected from people and may be reported', 'The research ethics committee, or the office the institution designates', BEFORE_SEND],
  ];
  const gate = step => DECISIONS.filter(d => d[4] === step).map(d => d[0]).join(', ');
  putDoc(`${P_DIR}/02-institutional-decisions-and-approvals.docx`, { title: 'Institutional decisions and approval requirements', footer: 'Institutional decisions and approvals', blocks: [
    { t: 'h1', text: 'Institutional decisions and approval requirements' },
    { t: 'p', text: '**Status: open. Nothing in this package is approved.** No decision has been recorded, and this package does not create, presume or record any approval. "Who decides" names a role for the institution to fill. It does not presume that a particular person or office exists.' },
    { t: 'h2', text: 'Decisions needed' },
    { t: 'p', text: 'Each decision is needed before the step it gates. The steps are in 03-adjudication-procedure.' },
    { t: 'table', widths: [6, 30, 24, 18, 14], head: ['ID', 'Decision', 'Why it is needed', 'Who decides (role)', 'Needed before'], rows: DECISIONS },
    { t: 'h2', text: 'Approval requirements' },
    { t: 'p', text: '**What an approval record contains.** For each decision:' },
    { t: 'ul', items: ['the decision ID;', 'the decision as worded by the approver (an option letter alone is not enough when the wording was changed);',
      'the approving role, and the approver\'s name if the institution records names;', 'the date;', 'a reference to the minutes, memo or resolution that records it;',
      'the programs or courses it applies to;', `the version of the documents decided on (this package: ${VERSION}, built ${BUILT});`, 'any conditions.'] },
    { t: 'p', text: '**Where it is recorded.** In the decision record under each policy question, or in `decision-and-approval-record.csv`, one row per decision. The data steward copies decisions exactly as recorded, and never completes or interprets one.' },
    { t: 'p', text: '**What does not count as approval:** a draft or a recommendation in this package; a decision recorded without a role, a date and a reference; agreement between the reviewers and the software.' },
    { t: 'p', text: '**Gates.** A step does not start until the decisions it needs are recorded:' },
    { t: 'table', widths: [4, 6], head: ['Gate', 'Decisions recorded first'], rows: [
      ['Before Part A is sent to reviewers (step 1)', gate(BEFORE_SEND)],
      ['Before the panel decides the policy questions (step 4)', `${gate(STEP4)}, or a recorded decision to proceed without them`],
      ['Before adjudication (step 6)', gate(STEP6)],
      ['Before approved references are recorded (step 7)', gate(STEP7)],
      ['Before any held-out run', 'I13'],
      ['Standing', 'I14'],
    ] },
    { t: 'p', text: '**If a decision is not made,** the step it gates does not start. Cases waiting on it stay Pending, and the report lists the missing decision.' },
    { t: 'h2', text: 'Notes' },
    { t: 'ul', items: [
      '**P1–P7** are set out in full, with options, in 01-academic-policy-questions.',
      '**I3 and I4** are needed before P3 and P6 can be settled on firm ground. If no description exists, P3 can still be decided (options A or B), but the references will rest on the names alone.',
      '**I5.** The nursing, education, accountancy and hospitality cases can still be reviewed as written. The reviewers are told that the cases are synthetic.',
      '**I8 and I9** affect scoring: a case with two accepted answers is scored differently from one with a single answer, and the choice must be recorded, not left to whoever converts the records.',
      '**I11** is separate from P5 and P6. It covers the general limits on what a proposed rewrite may change: level, subject, added content, removal.',
      '**I12** is needed before sending, because the forms collect a reviewer code and, if the institution asks, a name.',
      '**I13.** Faculty review of the held-out verdicts is the only way to make the final test meaningful. It must not expose those cases to the people who develop the software.',
      '**I15** does not presume that clearance or consent is needed. It asks the institution to decide, and to record the decision before any judgment is collected.',
    ] },
  ] }, 'policy-panel');
  const POLICY_TITLE = { P1: 'When is a CLO aligned with its PO: part or all of the PO?', P2: 'When is an ILO aligned with its CLO: part or all of the CLO?', P3: 'How is a CLO judged against an EGA held only as a name?',
    P4: 'Should course fit affect the alignment verdict?', P5: 'Re-map or rewrite, and what a mapping recommendation must state', P6: 'Value wording in recommendations, and which vocabulary applies', P7: 'Cognitive levels for attributes and multi-verb outcomes' };
  put(`${P_DIR}/decision-and-approval-record.csv`, csv([
    ['decision_id', 'decision_needed', 'needed_before', 'decision_as_worded', 'rationale', 'decided_by_role', 'approver_name (only if the institution records names)', 'approval_reference (minutes, memo or resolution)', 'date', 'applies_to', 'package_version_decided_on', 'conditions', 'notes'],
    ...Object.entries(POLICY_TITLE).map(([id, title]) => [id, title, STEP6, '', '', '', '', '', '', '', '', '', '']),
    ...DECISIONS.slice(1).map(([id, decision, , , before]) => [id, decision, before, '', '', '', '', '', '', '', '', '', '']),
  ]), 'policy-panel');

  // ======================= the policy panel: the proposed procedure =======================
  putDoc(`${P_DIR}/03-adjudication-procedure.docx`, { title: 'Proposed adjudication and validation procedure', footer: 'Proposed adjudication procedure', blocks: [
    { t: 'h1', text: 'Proposed adjudication and validation procedure' },
    { t: 'p', text: '**Status: a proposal for institutional approval (decision I2). Nothing in it is in force until approved.**' },
    { t: 'h2', text: '1. Principles' },
    { t: 'ul', items: [
      '**Faculty judgment is the reference.** The software\'s answers are never evidence that a case is right or wrong, and agreement with the software is never a reason to accept a judgment.',
      '**The provisional verdicts stay as they are.** The developer\'s provisional verdicts are not changed by any faculty decision, automatically or by hand. Approved references are recorded separately (section 9).',
      '**No judgment is created on anyone\'s behalf.** A blank stays blank, and a case without enough faculty input stays unresolved.',
      '**Special answers are recorded as given.** "Outside my expertise", "Insufficient information" and "Cannot judge" are never converted into a judgment (section 5).',
      '**Policies are decided on academic grounds.** They are decided before the software\'s results are shown to the panel, and never so that the software scores better.',
      '**Disagreement is information.** If reviewers cannot agree, the case is recorded as unresolved with both positions. It is not forced (section 6).',
      '**Reviews are blinded.** Case reviewers see no software answers, no developer verdicts and no one else\'s forms until they have returned their own.',
    ] },
    { t: 'h2', text: '2. Roles' },
    { t: 'p', text: 'The institution names the people.' },
    { t: 'table', widths: [3, 6, 7, 5], head: ['Role', 'Who', 'Does', 'Does not'], rows: [
      ['Coordinator', 'A staff member who reviews no cases', 'Assigns reviewer codes and cases; sends each bundle and collects the forms; reassigns cases outside a reviewer\'s expertise; asks reviewers to clarify unclear answers; holds the coordinator\'s records; counts agreement', 'Judge cases; edit or complete returned forms'],
      ['Case reviewer', 'Two per course, from the discipline: mathematics or engineering (MA 7, IE 310), information technology (IT 204), nursing (NCM 101), education (EDUC 105), accountancy (ACCTG 201), hospitality (HM 210)', 'Completes Part A, then Part B, for the assigned cases', 'See the software\'s answers before both parts are returned'],
      ['Adjudicator', 'One per discipline, for example the program chair or a designee who did not review the case', 'Settles the cases sent to adjudication, with a written reason', 'Overrule a policy the panel adopted'],
      ['Policy panel', 'Quality assurance, academic affairs and the program chairs; for P3 and P6 also the office responsible for the institution\'s Catholic Augustinian-Marian identity and core values', 'Decides P1–P7 and the institutional decisions', 'Judge individual cases in place of the reviewers'],
      ['Data steward', 'The developer', 'Records approved decisions as references exactly as decided, and logs every step', 'Change, interpret or complete a decision'],
    ] },
    { t: 'h2', text: '3. Sequence' },
    { t: 'table', widths: [2, 8, 4], head: ['Step', 'What happens', 'Output'], rows: [
      ['0. Approve', 'The institution approves this procedure, names the people and records the decisions needed before sending (I1, I2, I5, I12, I15)', 'Approval records'],
      ['1. Prepare', 'The coordinator assigns reviewer codes and cases, and sends each reviewer the Part A bundle only: the Part A guide, the references, and the Part A form and response sheet for the reviewer\'s course', 'Assignment list'],
      ['2. Part A', 'Each reviewer judges the assigned cases alone. A case marked outside a reviewer\'s expertise is reassigned (section 5)', 'Returned Part A, dated. The coordinator keeps a signed copy or checksum, after which the form is not edited'],
      ['3. Part B', 'Once a reviewer\'s Part A is returned, the coordinator sends that reviewer the Part B bundle: the Part B guide and the Part B form and response sheet. The reviewer rates the proposed changes for the same cases', 'Returned Part B'],
      ['4. Policy', 'The panel decides P1–P7 and the institutional decisions. It may see a summary of the faculty judgments (how often reviewers agreed, which readings they applied) and the list of cases each question affects, but not the software\'s answers', 'A versioned, dated policy record'],
      ['5. Agreement', 'For each case the coordinator compares the two reviewers: verdict, recommendation type, the reading each applied, course fit, and whether course fit affected the verdict', 'Agreement record'],
      ['6. Adjudication', 'The cases listed in section 6 go to the adjudicator, who records a decision with a reason, or marks the case unresolved or excluded', 'Adjudication record'],
      ['7. Reference', 'The data steward records the decisions as a new, separate reference version (section 9)', 'Reference file and change log'],
      ['8. Report', 'The coordinator reports how many cases are agreed, adjudicated, unresolved or excluded; how many special answers were given; how the references differ from the provisional verdicts; and what the panel decided', 'Summary'],
    ] },
    { t: 'h2', text: '4. Case states' },
    { t: 'table', widths: [2, 7], head: ['State', 'Meaning'], rows: [
      ['Pending', 'Not all forms are returned, or a decision the case depends on is not yet made'],
      ['Reassigning', 'A reviewer marked the case outside their expertise; it awaits another qualified reviewer'],
      ['Agreed', 'Both reviewers give the same verdict, and the reading each applied is consistent with the adopted policy'],
      ['Adjudicated', 'The adjudicator decided, with a written reason'],
      ['Unresolved', 'No decision could be reached; all positions are recorded (section 8)'],
      ['Excluded', 'The case cannot be used, for example because its texts cannot be judged or no qualified reviewer is available; recorded with the reason'],
    ] },
    { t: 'h2', text: '5. Special answers' },
    { t: 'table', widths: [5, 9, 3], head: ['Answer', 'What happens', 'Counted as a judgment?'], rows: [
      ['"No, it is outside my expertise" (Part A, question 0)', 'The coordinator reassigns the case to another qualified reviewer of the same discipline and logs the reassignment. If no qualified reviewer can be found, the case is excluded with that reason.', 'No'],
      ['"Insufficient information to judge" (question 1)', 'The case goes to the adjudicator, who decides whether it can be judged, for example once information is supplied, or should be excluded (I8).', 'Recorded as given; the adjudicator decides'],
      ['"Unsure" or "Insufficient information to judge" (question 4); "Insufficient information to recommend" (question 5); "Cannot tell" (question 6)', 'Recorded as given. Not a disagreement by itself.', 'Yes, as given'],
      ['"Yes" at question 4b (course fit affected the alignment answer)', 'The adjudicator reads the verdict under the adopted P4 policy. The reviewer\'s answer stays on record.', 'Yes, read under P4'],
      ['"Cannot judge" (Part B)', 'Recorded with its reason. Left out of the rating counts and reported as a count by reason.', 'No'],
      ['Two boxes ticked where one is asked, or a required answer left blank', 'The coordinator asks the reviewer to clarify and records the clarification with its date. The coordinator never guesses or completes an answer.', 'After clarification'],
    ] },
    { t: 'h2', text: '6. Handling disagreement' },
    { t: 'table', widths: [6, 8, 3], head: ['Situation', 'Action', 'Recorded as'], rows: [
      ['Both reviewers give the same verdict, and their readings are consistent with the adopted policy', 'None', 'Agreed'],
      ['The reviewers give different verdicts', 'The adjudicator decides with a written reason, or records the case as unresolved', 'Adjudicated or Unresolved'],
      ['The same verdict, but one rests on a reading or a course-fit treatment the panel did not adopt', 'The adjudicator decides the verdict under the adopted policy; the original answers stay on record', 'Adjudicated'],
      ['Either reviewer chose "Insufficient information to judge"', 'The adjudicator decides whether the case can be judged or is excluded', 'Adjudicated, Unresolved or Excluded'],
      ['The recommendation types differ', 'Both are recorded side by side. A reference recommendation is decided only if the panel decides that recommendations become references (I10, I11)', 'Recorded; adjudicated only if required'],
      ['The Part B ratings differ', 'Both ratings are recorded. They are not adjudicated, because ratings are used to write drafting rules, not reference answers (section 9)', 'Recorded as given'],
      ['The adjudicator cannot decide', 'All positions are recorded (section 8)', 'Unresolved'],
      ['A policy decision the case depends on is not made', 'The case waits', 'Pending'],
    ] },
    { t: 'p', text: 'A disagreement is never settled by the software\'s answer, by the coordinator or by the data steward. The coordinator keeps record templates for tracking, reassignment, agreement, adjudication and Part B ratings.' },
    { t: 'h2', text: '7. Agreement rules' },
    { t: 'ul', items: [
      '**Same option.** Two reviewers agree on a verdict only when they choose the same option; Aligned against Partially aligned is a disagreement.',
      '**A different reading.** Suppose a judgment was made under a reading the panel did not adopt. For example, P1 adopts one reading, and a reviewer chose Partially aligned only because of the other. The adjudicator, not the data steward, decides the verdict under the adopted reading. The reviewer\'s original answer stays on record.',
      '**Insufficient information.** If either reviewer chooses "Insufficient information to judge", the adjudicator decides whether the case can be judged or should be excluded (see also I8).',
      '**More than one accepted answer.** A case gets two accepted verdicts only if the adjudicator records why reasonable experts differ under the adopted policy (I9). Otherwise it gets one.',
      '**Recommendation type.** It is compared the same way. Two re-mappings agree only if they name the same target outcome, or if both leave the target open.',
      '**Statistics.** Percent agreement is reported per course and overall, with Cohen\'s kappa where the number of cases allows it. With one to twenty cases per course these figures describe this review only.',
    ] },
    { t: 'h2', text: '8. Recording an unresolved disagreement' },
    { t: 'p', text: 'For each unresolved case, record:' },
    { t: 'ul', items: ['the case code;', 'every judgment, with its reason and the reading applied;', 'the adjudicator\'s note on why the case could not be settled;', 'what would settle it, for example a policy decision, an EGA description or another reviewer.'] },
    { t: 'p', text: 'Unresolved cases are left out of headline agreement figures and reported separately. They are never settled by the software\'s answer.' },
    { t: 'h2', text: '9. Turning decisions into approved evaluation references' },
    { t: 'ul', items: [
      '**Never edit the dataset in place.** The provisional verdicts stay unchanged in `server/lib/syllabuscheck/eval/alignment-dataset.json`. Faculty decisions go into a new, separate record, for example `alignment-faculty-references-v1.json` or a new dataset version, as approved.',
      { text: '**What each reference record holds:**', sub: ['the dataset version and item, and the case code;', 'a hash of the two texts;', 'the final verdict, or verdicts with the reason for more than one;',
        'the recommendation type, and for a re-mapping the target outcome;', 'the policy version applied;', 'the reviewer and adjudicator codes, and the dates;', 'the rationale and the state.'] },
      'Unresolved and excluded cases are listed with their state but carry no verdict.',
      '**Only agreed and adjudicated cases are marked faculty-reviewed.** Every other case keeps its previous status.',
      '**Part B ratings are not reference answers for future drafts.** The software will write different drafts next time. The ratings are used to write and test rules for drafts, each approved by the panel. Examples of such rules: keep the author\'s values; do not raise a recall outcome to a design outcome when a re-mapping would keep it.',
      '**The data steward records decisions mechanically and logs every step.** A clerical error, such as a wrong code, is fixed with a logged note. A change to a decision needs the adjudicator.',
      '**Copies get the same decision.** Sixteen of the cases are copies of cases in an earlier test dataset (eval-1.1). Each copy gets the same decision, recorded through a mapping table.',
      '**Later changes make a new version.** A change to an approved reference follows this procedure again and produces a new version; old versions are kept.',
      '**Each evaluation names its reference version.** Results measured against provisional verdicts and against faculty references are never combined in one figure.',
    ] },
    { t: 'h2', text: '10. The protected held-out cases (later)' },
    { t: 'p', text: 'The held-out cases are a separate set kept for one final test. Their verdicts are also developer-written. Before they are used:' },
    { t: 'ul', items: ['faculty review them in a separate package, without any software output;', 'the decisions are recorded and sealed, for example by placing a checksum in the repository, so that they cannot be used to tune the software;',
      'the developer does not see the sealed decisions until the frozen configuration has been run on the held-out cases once;', 'the result is reported in aggregate, as the dataset\'s rules require.'] },
    { t: 'p', text: 'This package neither uses nor reveals the held-out cases.' },
    { t: 'h2', text: '11. Small numbers' },
    { t: 'p', text: 'The review covers 58 cases, with one to four in four of the seven courses. Its agreement figures describe these cases. They are not estimates for the institution\'s syllabi.' },
  ] }, 'policy-panel');

  // ======================= coordinator-restricted/ =======================
  // 01-04 are Version 1's coordinator documents, carried over byte for byte except for the listed corrections (each must match exactly
  // the expected number of times) and a notice under the title. Nothing in their evidence, verdicts, drafts or codes changes.
  const CORRECTIONS = [
    { file: '01-case-inventory.md', find: /\b(BSIE|BSIT) (\d{4}-\d{4}) curriculum: /g, replace: '$1 $2 curriculum as transcribed in the system (not confirmed by the registrar): ', expect: 26,
      why: 'The curriculum placement is a transcription held in the system, not a confirmed curriculum.' },
    { file: '01-case-inventory.md', find: /registrar curriculum lists MA 8 Integral Calculus/g, replace: 'registrar curriculum transcription held in the system (not confirmed by the registrar) lists MA 8 Integral Calculus', expect: 1,
      why: 'The same: a developer note stated a transcription as the registrar\'s curriculum.' },
  ];
  const v1Sha = file => v1Manifest.files.find(f => f.path === file).sha256;
  const applied = [];
  for (const file of ['01-case-inventory.md', '02-recommendation-quality-review.md', '03-comparison-and-blinding-key.md', '04-post-validation-development-plan.md']) {
    let text = fs.readFileSync(path.join(V1, 'coordinator', file), 'utf8');
    for (const c of CORRECTIONS.filter(x => x.file === file)) {
      const n = (text.match(c.find) || []).length;
      if (n !== c.expect) refuse(`correction "${c.find}" in ${file} matched ${n} times, expected ${c.expect}`);
      text = text.replace(c.find, c.replace);
      applied.push({ ...c, n });
    }
    const [title, ...rest] = text.split('\n');
    put(`${C_DIR}/${file}`, [title, '', `> **Version 2 copy (restricted).** This is Version 1's \`coordinator/${file}\` (sha256 \`${short(v1Sha(`coordinator/${file}`))}\`), carried over with its case codes, evidence, verdicts and drafts unchanged. Only the corrections listed in \`06-changes-from-v1.md\` were applied (${CORRECTIONS.filter(x => x.file === file).length || 'none'} for this file). File paths in it follow Version 1's layout; \`00-coordinator-guide.md\` maps them to Version 2.`, ...rest].join('\n'), 'coordinator');
  }
  put(`${C_DIR}/05-policy-question-case-map.md`, `# Policy questions and the cases they affect (restricted)

**Restricted.** Share these lists with the policy panel only after the case reviewers have returned Part A (procedure, step 4). Version 1 printed them inside the policy questions; Version 2 moved them here so that the panel's documents name no case.

| Question | Title | Cases | Case codes |
|---|---|---|---|
${Object.entries(POLICY).map(([id, q]) => `| ${id} | ${POLICY_TITLE[id]} | ${q.cases.length} | ${[...q.cases].sort().join(', ')} |`).join('\n')}
`, 'coordinator');
  // record templates for the procedure; blank wherever a person must decide
  const T_DIR = `${C_DIR}/templates`;
  put(`${T_DIR}/reviewer-tracking.csv`, csv([['course', 'reviewer_slot', 'reviewer_code', 'discipline', 'part_a_sent', 'part_a_returned', 'part_a_sha256', 'part_b_sent', 'part_b_returned', 'part_b_sha256', 'clarifications_requested', 'notes'],
    ...COURSE_ORDER.flatMap(key => [1, 2].map(n => [D.courses[key].code, `reviewer ${n}`, '', '', '', '', '', mine(key).some(c => c.proposals.length) ? '' : 'no Part B for this course', '', '', '', '']))]), 'coordinator');
  put(`${T_DIR}/reassignment-log.csv`, csv([['case_code', 'original_reviewer_code', 'reason (outside expertise / other)', 'date_flagged', 'new_reviewer_code', 'date_reassigned', 'outcome (reassigned / excluded: no qualified reviewer)', 'notes']]), 'coordinator');
  const sides = n => [`reviewer_${n}_code`, `r${n}_within_expertise`, `r${n}_alignment`, `r${n}_reading`, `r${n}_course_fit`, `r${n}_fit_affected_alignment`, `r${n}_recommendation`, `r${n}_re-map_target`, `r${n}_confidence`];
  put(`${T_DIR}/part-a-agreement-record.csv`, csv([['case_code', 'course', 'relationship', ...sides(1), ...sides(2), 'verdict_agreement (same / different / not comparable)', 'recommendation_agreement (same / different / not comparable)',
    'special_answers (outside expertise / insufficient information / clarification needed)', 'state (Pending / Reassigning / Agreed / To adjudication / Adjudicated / Unresolved / Excluded)', 'notes'],
    ...cases.map(c => [c.code, D.courses[keyOf(c)].code, TYPE[c.type].title, ...sides(1).map(() => ''), ...sides(2).map(() => ''), '', '', '', 'Pending', ''])]), 'coordinator');
  put(`${T_DIR}/adjudication-record.csv`, csv([['case_code', 'adjudicator_code', 'date', 'reason_sent (different verdicts / reading not adopted / insufficient information / course fit / other)', 'policy_version_applied',
    'decision (verdict, or Unresolved, or Excluded)', 'second_accepted_verdict', 'reason_for_two_verdicts', 'recommendation_decision (only if required)', 're-map_target', 'written_reason', 'what_would_settle_it (if unresolved)']]), 'coordinator');
  put(`${T_DIR}/part-b-ratings-record.csv`, csv([['case_code', 'proposal_code', 'proposal_type', 'reviewer_1_code', 'r1_rating', 'r1_cannot_judge_reason', 'r1_concerns', 'reviewer_2_code', 'r2_rating', 'r2_cannot_judge_reason', 'r2_concerns', 'ratings_same (yes / no / not comparable)', 'notes'],
    ...proposals.map(p => [p.c.code, p.code, p.kind === 'rewrite' ? 'rewrite' : 're-mapping', '', '', '', '', '', '', '', '', '', ''])]), 'coordinator');
  const distribution = c => ({ partA: `${A_DIR}/${COURSE_CODE[keyOf(c)]}/${COURSE_CODE[keyOf(c)]}-part-a-form.docx`, partB: c.proposals.length ? `${B_DIR}/${COURSE_CODE[keyOf(c)]}/${COURSE_CODE[keyOf(c)]}-part-b-form.docx` : null });
  put(`${C_DIR}/cases.json`, JSON.stringify({
    about: 'Restricted: the machine-readable form of Version 2 of the adjudication package. The case records are Version 1\'s, unchanged; each gains only its Version 2 form locations (distribution).',
    version: VERSION, builtAt: BUILT,
    basedOn: { package: rel(V1), manifestSha256: sha(path.join(V1, 'package-manifest.json')), casesSha256: sha(path.join(V1, 'coordinator', 'cases.json')) },
    sources: { ...V1C.sources, prereg: { file: rel(PREREG), sha256: V1C.sources.prereg.sha256 } },
    evaluations: V1C.evaluations, sets: V1C.sets, policyQuestions: V1C.policyQuestions,
    cases: V1C.cases.map(c => ({ ...c, distribution: distribution(c) })),
  }, null, 1) + '\n', 'coordinator');

  // ---- coordinator guide: Version 1's README (the restricted parts), corrected, with the sending checklist ----
  const words = t => new Set(String(t || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(w => w.length > 2));
  const jaccardWords = (a, b) => { const x = words(a), y = words(b); const inter = [...x].filter(w => y.has(w)).length; return inter / (x.size + y.size - inter || 1); };
  const rewrites = proposals.filter(p => p.kind === 'rewrite');
  const repeatsCase = rewrites.filter(p => cases.some(c => norm(c.source) === norm(p.text) || norm(c.target) === norm(p.text)))
    .map(p => `${p.code} (equals the text of ${cases.filter(c => norm(c.source) === norm(p.text) || norm(c.target) === norm(p.text)).map(c => c.code).join(', ')})`);
  const nearPairs = rewrites.flatMap((p, i) => rewrites.slice(i + 1).filter(q => q.c === p.c && jaccardWords(p.text, q.text) >= 0.85).map(q => `${p.code} and ${q.code}`));
  const workload = COURSE_ORDER.map(key => { const k = D.courses[key], list = mine(key); return `| ${k.code} ${k.title} (${k.program}, year ${k.yearLevel}) | ${list.length} | ${list.reduce((s, c) => s + c.proposals.length, 0)} | 2 reviewers from ${{ calc: 'mathematics or engineering', ie: 'industrial engineering', prog: 'information technology', nurs: 'nursing', edu: 'education', acct: 'accountancy', hm: 'hospitality management' }[key]} |`; });
  const partBCases = cases.filter(c => c.proposals.length);
  put(`${C_DIR}/00-coordinator-guide.md`, `# Coordinator guide (restricted)

**Restricted to the review coordinator. Never send this folder, or any file in it, to case reviewers.** It names the evaluation arms and shows the software's verdicts, explanations and drafts and the developer's provisional verdicts.

**Status: Version 2, a draft for the developer's review, not yet sent to anyone. No faculty judgment is recorded anywhere in it, and nothing in it is approved.** Built ${BUILT}, offline, from Version 1's records. No AI provider was called. No checker code, prompt, dataset label, evaluation result or faculty dataset was changed, and Version 1's folder was not written.

## What changed from Version 1
Version 2 corrects the forms, guides, references and policy documents of Version 1 after its final audit, and splits them into separate bundles. The 58 cases, their codes and texts, the sets and the 160 proposals are unchanged. The full list is in \`06-changes-from-v1.md\`.

## Why this package exists
Two evaluations of the AI Syllabus Checker, A2 and B2, compared the checker's verdicts with provisional verdicts that a developer wrote for the align-1 dataset. Faculty have never reviewed those provisional verdicts.
- On some cases the checker and the provisional verdicts disagree.
- On others, the checker's two configurations recommend different remedies.

Neither the checker nor the provisional verdicts can settle these cases. This package asks qualified faculty to judge the cases themselves, without seeing anyone else's answer, and the institution to settle the policy questions those judgments depend on. The decisions can then be recorded as faculty-approved evaluation references.

## The bundles and who receives them
| Folder | Send to | When | Shows AI identities, AI verdicts or developer expectations? |
|---|---|---|---|
| \`${A_DIR}/\` | Each case reviewer: the two shared files (the Part A guide and the references) and **only their own course folder** | After decisions I1, I2, I5, I12 and I15 are recorded | No |
| \`${B_DIR}/\` | Each case reviewer: the Part B guide and **only their own course folder** | Only after that reviewer's Part A is returned | No identities, verdicts or expectations, but it shows anonymised changes proposed by the software |
| \`${P_DIR}/\` | The policy panel and the approving offices | The decisions needed before sending first; the policy questions at step 4, after Part A is returned | No |
| \`${C_DIR}/\` | Nobody | Never | **Yes** |

Each document is a Word file to fill in and a PDF to print. The \`.md\` files in \`${MIRROR}/\` are text copies of the distributed documents for the developer's review; they are not sent.

## Sending checklist
1. **Before anything is sent,** record decisions I1, I2, I5, I12 and I15 (\`${P_DIR}/02-institutional-decisions-and-approvals\`).
2. Give each reviewer a code and record it in \`templates/reviewer-tracking.csv\`.
3. **Part A:** send \`${A_DIR}/01-reviewer-guide-part-a\` and \`${A_DIR}/${REFS.replace(/\.docx$/, '')}\` (each as .docx and .pdf) and the folder \`${A_DIR}/<COURSE>/\`. Nothing else.
4. **Check the attachments before sending:** every file name starts with \`01-\`, \`02-\` or the reviewer's course code, and no file comes from \`${B_DIR}/\`, \`${P_DIR}/\` or \`${C_DIR}/\`.
5. **On return:** record the date and a checksum of the returned file (on Windows, \`certutil -hashfile <file> SHA256\`). The returned form is then not edited.
6. **Outside-expertise cases:** log them in \`templates/reassignment-log.csv\` and reassign them (procedure, section 5).
7. **Unclear answers** (two boxes ticked where one is asked, or a blank): ask the reviewer and record the clarification with its date. Never guess.
8. **Part B:** after a reviewer's Part A is returned, send \`${B_DIR}/01-reviewer-guide-part-b\` and the folder \`${B_DIR}/<COURSE>/\`. IE 310 has no Part B.
9. **Policy panel:** share \`05-policy-question-case-map.md\` only after Part A is returned (step 4).

**IE 310.** Its single case (IE310-01) has no Part B. It can be given to the MA 7 reviewers if they are industrial engineers, or to two industrial-engineering reviewers. Record the choice.

## Workload by course
| Course | Part A cases | Part B proposals | Reviewers |
|---|---|---|---|
${workload.join('\n')}

As a rough guide, a Part A case takes three to five minutes and a Part B proposal one to two.

## The cases (restricted)
- **58 cases, each once.** The package covers the whole development split of align-1, by course. Each case is a different pair of texts; no two cases repeat a pair.
- **Every case has a Part A form**, so reviewers cannot tell which cases are in dispute. The coordinator's key puts each case in one of three sets:
  - **Set 1, ${setCount(1)} cases:** at least one checker answer differs from the provisional verdict. This is the minimum to adjudicate.
  - **Set 2, ${setCount(2)} cases:** the verdicts are within the provisional ones, but the answers vary, or a recommendation raises a question (re-mapping, level changes, duplication, value wording or replaced content).
  - **Set 3, ${setCount(3)} cases:** no disagreement and no flagged recommendation. These complete the split and act as blinding controls.
- **If faculty time is short**, send Sets 1 and 2 and a sample of Set 3, and record which were sent.
- **Part B covers every case for which a change was proposed:** ${partBCases.length} cases (${partBCases.filter(c => c.set < 3).length} of them in Sets 1 and 2), with ${proposals.length} distinct proposals. Including the Set 3 proposals keeps Part B from revealing the sets.
- **The 42 held-out cases are not included** and were not read.
- **16 of the 58 are unchanged copies** of cases in the earlier eval-1.1 dataset. A decision on one applies to the other.

## Notes from Version 1's final audit
- **Proposals that repeat a case text** (after normalising case and punctuation): ${repeatsCase.length ? repeatsCase.join('; ') : 'none'}. A reviewer who meets the same text twice may notice; the proposals are shown as generated.
- **Near-identical proposals within a case** (at least 85% of their words shared): ${nearPairs.length} pair${nearPairs.length === 1 ? '' : 's'}${nearPairs.length ? `: ${nearPairs.join('; ')}` : ''}. Identical texts were merged in Version 1; near-identical ones are rated separately.
- **Reviewers cannot see which proposal came from which configuration.** The key is in \`03-comparison-and-blinding-key.md\`.

## Do not send with this package
- **Version 1** (\`${rel(V1)}/\`). Version 2 replaces it for sending; Version 1's faculty and institution files lack the corrections in \`06-changes-from-v1.md\`.
- **The two older review sheets**, \`docs/ai-eval-faculty-review-alignment.csv\` and \`docs/ai-eval-faculty-review.csv\`. They are not blinded: they show the developer's expected verdicts. The first covers all 100 align-1 cases, including these 58 and the protected held-out cases. The second covers the eval-1.1 cases, 16 of which are copied here.
- **The evaluation reports** (\`docs/anthropic-p2-*.md\`) and anything in \`docs/ai-eval-anthropic/\`.
- **The other review packs cover different material.** \`docs/faculty-review/faculty-review.*\`, \`docs/faculty-review/phase3/\` and \`docs/academic-validation-package/\` cover real sample syllabi and whole-syllabus and stage checks. They do not overlap with these cases.

## Version 1 paths in the copied documents
| Version 1 | Version 2 |
|---|---|
| \`faculty/01-reviewer-guide.md\` | \`${A_DIR}/01-reviewer-guide-part-a\` and \`${B_DIR}/01-reviewer-guide-part-b\` |
| \`faculty/02-curriculum-references.md\` | \`${A_DIR}/${REFS.replace(/\.docx$/, '')}\` (the same document as \`${P_DIR}/04-curriculum-and-institutional-references\`) |
| \`faculty/part-a/<COURSE>.md\`, \`part-a-responses.csv\` | \`${A_DIR}/<COURSE>/<COURSE>-part-a-form\` and \`<COURSE>-part-a-responses.csv\` |
| \`faculty/part-b/<COURSE>.md\`, \`part-b-responses.csv\` | \`${B_DIR}/<COURSE>/<COURSE>-part-b-form\` and \`<COURSE>-part-b-responses.csv\` |
| \`institution/01-policy-questions.md\` | \`${P_DIR}/01-academic-policy-questions\` (case lists moved to \`05-policy-question-case-map.md\`) |
| \`institution/02-institutional-decisions.md\` | \`${P_DIR}/02-institutional-decisions-and-approvals\` |
| \`institution/03-adjudication-procedure.md\` | \`${P_DIR}/03-adjudication-procedure\` |
| \`institution/policy-responses.csv\` | \`${P_DIR}/decision-and-approval-record.csv\` |
| \`coordinator/01-04\`, \`cases.json\` | \`${C_DIR}/01-04\`, \`cases.json\` |
| \`README.md\` | this guide (restricted parts) and \`README.md\` (a neutral index) |

## Sources
sha256, first 16 characters. The generator refuses to run if any of them, or any Version 1 file, has changed.

| Source | sha256 |
|---|---|
${Object.entries(V1C.sources).map(([k, s]) => `| \`${k === 'prereg' ? rel(PREREG) : s.file}\` | \`${short(s.sha256)}\` |`).join('\n')}
| \`${rel(V1)}/package-manifest.json\` (Version 1) | \`${short(sha(path.join(V1, 'package-manifest.json')))}\` |

The pre-registered developer notes (\`${rel(PREREG)}\`) are the file whose hash \`docs/anthropic-p2-b2-report.md\` records.

## Rebuilding and verifying
- \`node scripts/export-align1-adjudication-v2.cjs\` rebuilds every .docx, .md, .csv and .json file byte for byte. Add \`--pdf\` to re-create the PDFs with Microsoft Word.
- \`node scripts/verify-align1-adjudication-v2.cjs\` runs the offline checks: case texts and codes, blinding, bundle separation, reference status, form contents and a rebuild.
- The generator refuses an \`--out\` folder that is, contains or lies inside Version 1's folder, and never overwrites a file that someone has changed.
- **Line endings.** With \`core.autocrlf=true\` and no \`.gitattributes\` rule, Git converts line endings on checkout, which changes the bytes of the .md and .csv files and breaks the hash checks. Before committing, add a rule such as \`docs/faculty-review/** -text\`.

## Limits
- **The course records are synthetic.** Their codes and titles resemble the institution's programs. R-CODES in the references shows which codes appear in the curricula transcribed in the system; their descriptions and outcomes were written for testing.
- **The program outcomes in the cases are synthetic, general wording**, not official outcomes. The outcomes the system holds are transcriptions, reproduced in the references with their status.
- **The EGAs are known only by name.** The system holds four names (transcribed, not confirmed) and no description of them.
- **The core-value names and definitions are a website copy, pending institutional approval.**
- **Four programs have nothing on record.** The system holds no outcomes, curriculum or syllabus for nursing, education, accountancy or hospitality.
- **58 cases is a small sample.**
`, 'coordinator');

  put(`${C_DIR}/06-changes-from-v1.md`, `# Changes from Version 1 (restricted)

Version 1 is \`${rel(V1)}/\` (package-manifest.json sha256 \`${short(sha(path.join(V1, 'package-manifest.json')))}\`). It is kept unchanged: every build of Version 2 first checks each of its files against its manifest.

## What did not change
- **The cases.** The same 58 cases, with the same codes, ids, texts, relationship types, courses and sets (${setCount(1)}, ${setCount(2)} and ${setCount(3)}).
- **The proposals.** The same ${proposals.length} proposals in ${partBCases.length} cases, with the same codes, kinds and texts, in the same order.
- **The evidence.** Every answer, quotation, explanation, draft and rule flag in the coordinator documents and in \`cases.json\`.
- **The provisional verdicts.** They appear only in coordinator-restricted files.
- **The blinding.** Codes by course, then relationship type, then a salted hash; proposals in salted-hash order; no software or developer answer, no evaluation name and no AI identity in any distributed file.
- **The academic expectations, the evaluation records, the checker and its scoring.** Version 2 changes none of them.

## Changes by requirement
| # | Requirement | What changed |
|---|---|---|
| 1 | An "outside my expertise" option | Part A: question 0 on every case ("Is this case within your expertise?"); a No leaves the case blank for reassignment. Part B: "Outside my expertise" as a reason for "Cannot judge". Procedure section 5: reassigned and not counted. A reassignment log template. |
| 2 | "Insufficient information" where appropriate | Question 1 offers "Insufficient information to judge" (Version 1: "Insufficient evidence to judge") and question 2 asks what information is missing. Question 4 adds "Insufficient information to judge" beside "Unsure"; question 5 adds "Insufficient information to recommend"; question 6 adds "Cannot tell". Decision I8 uses the same term. |
| 3 | "Cannot judge" for recommendations | Every Part B rating adds "Cannot judge" with a reason (outside my expertise, insufficient information, other). It is not counted as a rating. The concerns add "No concerns". |
| 4 | Neutral policy questions | Each question is an open question; the options are listed "in no order of preference", each with a parallel "what it would mean in practice" line, and none is recommended. Removed: "contribute meaningfully"; the P1 framing "Two questions that are easy to confuse … A program can cover a broad PO completely even if no single CLO covers all of it"; "That is consistent with options A and C"; "option C may already be practice"; P2's "smaller step" and "genuine step"; "It bears on P1, option C". P2 (a)-(b) and P7 (c) no longer presume what is acceptable or a defect. Examples taken from the review cases were replaced by a generic illustration, and the case lists moved to \`05-policy-question-case-map.md\`. In the forms, the two readings in question 3 are worded in parallel, neither with a justification, with a third option ("The distinction did not affect my answer for this case"). The guide no longer says "Separately from alignment" for course fit, and question 4b records whether course fit affected the alignment answer. |
| 5 | Synthetic references distinguished from institutional records | Four status labels (synthetic; transcribed, not confirmed; website copy, pending approval; not held), defined in the guides and the references and attached to every text in the course context and the references. New sections R-CASES and R-CODES. The PO-to-EGA column of R-BSIT carries a caveat. Every document states that no text in the package has been confirmed by the institution. |
| 6 | Unsupported claims about approved curricula | "The course codes and titles are the institution's" is replaced by R-CODES, a check of each code against the transcribed curricula (MA 7 and IT 204 appear; IE 310 does not; NCM 101, EDUC 105, ACCTG 201 and HM 210 cannot be checked). "The institution's four EGAs" and "official names" became "the four names held in the system". "The official outcomes the system holds" became the transcribed outcomes. "BSIE places MA 7 …" was removed. Curriculum placements say "transcribed in the system". The values entry no longer quotes the source file's note, which named the tool that copied it. Two corrections in the copied inventory (below). |
| 7 | Original evidence and case IDs preserved | The generator takes the cases and proposals from Version 1's \`cases.json\` after checking Version 1's manifest, the hashes of every source record and the dataset texts. The verifier recomputes the proposals from the evaluation records and checks every quotation against the case texts. |
| 8 | Part A and Part B separate | Separate bundles (\`${A_DIR}/\`, \`${B_DIR}/\`) with separate guides. The Part A guide mentions Part B only as a later package. |
| 9 | Coordinator files restricted | Everything restricted is in \`${C_DIR}/\` and named so; the README is a neutral index; the verifier checks that no distributed file holds restricted content and that each bundle holds only its own files. |
| 10 | Reviewer-ready response forms | Word forms with check boxes and text fields (content controls), PDFs for printing, and one response sheet per course and part, with the new columns. |
| 11 | Faculty disagreement handling | Procedure sections 5 (special answers) and 6 (handling disagreement), and record templates for tracking, reassignment, agreement, adjudication and Part B ratings. |
| 12 | Institutional approval requirements | \`02-institutional-decisions-and-approvals\`: what an approval record contains, what does not count as approval, and the gates. I12 now comes before sending; I15 (ethics clearance or consent) is new; I6 adds the PO-to-EGA mapping. \`decision-and-approval-record.csv\` replaces \`policy-responses.csv\`. |
| 13 | Blinding methodology preserved | As above; the verifier re-runs the blinding checks on the Word files, the PDFs, the response sheets and the document properties. |
| 14 | Reproducible | \`scripts/export-align1-adjudication-v2.cjs\` rebuilds the .docx, .md, .csv and .json files byte for byte; the PDFs are tied to the hash of the Word file each was made from; \`scripts/verify-align1-adjudication-v2.cjs\` rebuilds into a temporary folder and compares. |

## Corrections applied to the copied coordinator documents
| File | Correction | Times | Why |
|---|---|---|---|
${applied.map(c => `| \`${c.file}\` | ${String(c.find).replace(/\|/g, '\\|')} → "${c.replace.replace(/\$\d/g, '…').trim()}" | ${c.n} | ${c.why} |`).join('\n')}

## Changed form wording
| Question | Version 1 | Version 2 |
|---|---|---|
| 0 | (none) | Is this case within your expertise? Yes / No, it is outside my expertise |
| 1 | … / Insufficient evidence to judge | … / Insufficient information to judge |
| 3 (CLO and PO) | "The CLO develops a real part of the PO; other parts may be developed by other CLOs or courses" / "The CLO must show every part of the PO" / Other | "${TYPE['CLO-PO'].reading[0]}" / "${TYPE['CLO-PO'].reading[1]}" / "The distinction did not affect my answer for this case" / Other |
| 4 | Yes / No / Unsure | Yes / No / Unsure / Insufficient information to judge, and 4b: did it affect question 1? |
| 5 | … / Refer for a policy decision / Other | … / Refer for a policy decision / Insufficient information to recommend / Other, with guidance on naming a target |
| 6 | … / Not applicable | … / Not applicable / Cannot tell |
| Part B rating | Appropriate as written / Acceptable with edits / Not appropriate | … / Cannot judge, with a reason |
`, 'coordinator');

  put('README.md', `# Faculty adjudication package, Version 2

**Status: a draft for the developer's review, not yet sent. No faculty judgment is recorded in it, and nothing in it is approved by the institution.**

**Do not send this folder as a whole.** Each person receives only their own bundle:

| Folder | For | When |
|---|---|---|
| \`${A_DIR}/\` | Case reviewers: the Part A guide, the references, and their own course folder | First |
| \`${B_DIR}/\` | Case reviewers: the Part B guide and their own course folder | Only after the reviewer has returned Part A |
| \`${P_DIR}/\` | The policy panel and the approving offices | As the procedure in the folder sets out |
| \`${C_DIR}/\` | The review coordinator only | Never sent |

Each distributed document is a Word form (.docx) to fill in and a PDF to print. The response sheets are CSV files.

## Rebuilding and checking
- \`node scripts/export-align1-adjudication-v2.cjs\` rebuilds the package (add \`--pdf\` to re-create the PDFs with Microsoft Word).
- \`node scripts/verify-align1-adjudication-v2.cjs\` checks it offline.

Version 1 is kept unchanged in \`${rel(V1)}/\`.
`, 'index');

  // ======================= write: into an empty folder, or over this script's own unchanged files =======================
  const manifestFile = path.join(PKG, 'package-manifest.json');
  const listAll = dir => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? listAll(path.join(dir, e.name)) : [path.join(dir, e.name)])) : []);
  const existing = listAll(PKG).map(f => path.relative(PKG, f).split(path.sep).join('/'));
  const prev = fs.existsSync(manifestFile) ? readJson(manifestFile) : null;
  const known = new Map((prev ? [...prev.files, ...(prev.pdf || [])] : []).map(f => [f.path, f.sha256]));
  if (existing.length) {
    if (!prev) refuse(`${PKG} is not empty and holds no package-manifest.json`);
    const foreign = existing.filter(f => f !== 'package-manifest.json' && (!known.has(f) || sha(path.join(PKG, f)) !== known.get(f)));
    if (foreign.length) refuse(`these files were not written by this script, or were changed after it wrote them: ${foreign.join(', ')}`);
  }
  const files = [...out.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([p, f]) => {
    const buf = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    return { path: p, buf, sha256: shaBuf(buf), bytes: buf.length, audience: f.audience };
  });
  const shaOf = new Map(files.map(f => [f.path, f.sha256]));
  const pdfTargets = files.filter(f => f.path.endsWith('.docx')).map(f => ({ path: f.path.replace(/\.docx$/, '.pdf'), fromPath: f.path, fromSha256: f.sha256, audience: f.audience }));
  // without --pdf, a PDF is kept only while it is unchanged and its .docx is byte-identical to the one it was made from
  const kept = PDF ? [] : (prev?.pdf || []).filter(e => shaOf.get(e.fromPath) === e.fromSha256 && fs.existsSync(path.join(PKG, e.path)) && sha(path.join(PKG, e.path)) === e.sha256);
  const keep = new Set([...files.map(f => f.path), ...kept.map(e => e.path), 'package-manifest.json']);
  const stale = existing.filter(f => !keep.has(f));
  for (const f of stale) fs.unlinkSync(path.join(PKG, f));
  for (const f of files) { const full = path.join(PKG, f.path); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, f.buf); }
  let pdfEntries = kept, renderer = null, pdfFailed = [];
  if (PDF) {
    // Word opens each .docx read-only and exports it; nothing is saved, and only a Word process this step started is ever stopped
    const PS = [
      '$ErrorActionPreference = \'Stop\'',
      '$jobs = ConvertFrom-Json $env:ALIGN1_V2_PDF_JOBS',
      '$before = @(Get-Process WINWORD -ErrorAction SilentlyContinue | ForEach-Object Id)',
      '$word = New-Object -ComObject Word.Application',
      '$mine = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Where-Object { $before -notcontains $_.Id } | ForEach-Object Id)',
      'try {',
      '  $word.Visible = $false; $word.DisplayAlerts = 0',
      '  [Console]::Out.WriteLine((\'WORD|{0}|{1}\' -f $word.Version, $word.Build))',
      '  foreach ($j in $jobs) {',
      '    $doc = $word.Documents.Open([string]$j.docx, $false, $true, $false)',
      '    try {',
      '      $pages = $doc.ComputeStatistics(2)',
      '      $doc.ExportAsFixedFormat([string]$j.pdf, 17, $false, 0, 0, 1, 1, 0, $true, $true, 1, $true, $true, $false)',
      '      [Console]::Out.WriteLine((\'PDF|{0}|{1}\' -f $pages, $j.pdf))',
      '    } finally { $doc.Saved = $true; $doc.Close() }',
      '  }',
      '} finally {',
      '  $word.Quit(); [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)',
      '  for ($i = 0; $i -lt 20 -and @($mine | Where-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue }).Count; $i++) { Start-Sleep -Milliseconds 500 }',
      '  foreach ($id in $mine) { if (Get-Process -Id $id -ErrorAction SilentlyContinue) { Stop-Process -Id $id -Confirm:$false; [Console]::Out.WriteLine("STOPPED|$id") } }',
      '}',
    ].join('\n');
    const jobs = pdfTargets.map(t => ({ docx: path.join(PKG, t.fromPath), pdf: path.join(PKG, t.path) }));
    const run = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(PS, 'utf16le').toString('base64')],
      { env: { ...process.env, ALIGN1_V2_PDF_JOBS: JSON.stringify(jobs) }, encoding: 'utf8', timeout: 15 * 60 * 1000, windowsHide: true });
    const lines = String(run.stdout || '').split(/\r?\n/);
    const word = lines.find(l => l.startsWith('WORD|'))?.split('|');
    renderer = word ? `Microsoft Word ${word[1]} (build ${word[2]}), ExportAsFixedFormat: tagged, heading bookmarks, not PDF/A` : null;
    const pages = new Map(lines.filter(l => l.startsWith('PDF|')).map(l => { const [, n, p] = l.split('|'); return [path.resolve(p), Number(n)]; }));
    pdfEntries = pdfTargets.filter(t => pages.has(path.resolve(path.join(PKG, t.path)))).map(t => {
      const full = path.join(PKG, t.path);
      return { path: t.path, sha256: sha(full), bytes: fs.statSync(full).size, fromPath: t.fromPath, fromSha256: t.fromSha256, pages: pages.get(path.resolve(full)), renderer, audience: t.audience };
    });
    pdfFailed = pdfTargets.filter(t => !pdfEntries.some(e => e.path === t.path)).map(t => t.path);
    if (run.status !== 0 || pdfFailed.length) console.log(`PDF conversion incomplete (exit ${run.status}${run.error ? `, ${run.error.message}` : ''}): ${String(run.stderr || '').trim().slice(0, 600)}`);
    for (const l of lines.filter(x => x.startsWith('STOPPED|'))) console.log(`stopped the Word process the conversion started (${l.split('|')[1]})`);
  }
  const manifest = {
    version: VERSION, builtAt: BUILT, by: 'scripts/export-align1-adjudication-v2.cjs (offline)',
    basedOn: { package: rel(V1), manifestSha256: sha(path.join(V1, 'package-manifest.json')) },
    sources: Object.fromEntries(Object.entries(V1C.sources).map(([k, s]) => [k, { file: k === 'prereg' ? rel(PREREG) : s.file, sha256: s.sha256 }])),
    bundles: { [A_DIR]: 'part-a-reviewers', [B_DIR]: 'part-b-reviewers', [P_DIR]: 'policy-panel', [C_DIR]: 'coordinator (never sent)' },
    files: files.map(({ path: p, sha256, bytes, audience }) => ({ path: p, sha256, bytes, audience })),
    pdf: [...pdfEntries].sort((a, b) => a.path.localeCompare(b.path)),
  };
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 1) + '\n');

  // ---- report ----
  const by = {}; for (const f of files) by[f.audience] = (by[f.audience] || 0) + 1;
  console.log(`wrote ${files.length} files to ${rel(PKG) || PKG} (${Object.entries(by).map(([a, n]) => `${a} ${n}`).join(', ')}), plus package-manifest.json`);
  console.log(`cases ${cases.length} (sets ${setCount(1)}/${setCount(2)}/${setCount(3)}); Part A forms ${COURSE_ORDER.length}; Part B forms ${COURSE_ORDER.filter(k => mine(k).some(c => c.proposals.length)).length}; proposals ${proposals.length} in ${partBCases.length} cases`);
  console.log(`coordinator corrections: ${applied.map(c => `${c.file} ${c.n}`).join(', ')}`);
  const remade = stale.filter(f => pdfEntries.some(e => e.path === f)), removed = stale.filter(f => !remade.includes(f));
  console.log(`PDFs: ${pdfEntries.length} of ${pdfTargets.length}${PDF ? ` made (${renderer || 'renderer unknown'})` : ' kept from an earlier --pdf run'}${remade.length ? `, replacing ${remade.length} from the earlier build` : ''}${pdfFailed.length ? `; missing ${pdfFailed.join(', ')}` : ''}`);
  if (removed.length) console.log(`removed ${removed.length} file(s) that the earlier build wrote and this one does not: ${removed.join(', ')}`);
  console.log(`Version 1 unchanged: ${v1Manifest.files.length} files checked; sources unchanged: ${Object.keys(V1C.sources).join(', ')}`);
  if (PDF && pdfFailed.length) process.exit(3);
}

main().catch(err => { console.error(err); process.exit(1); });
