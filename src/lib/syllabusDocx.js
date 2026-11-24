// Zero-dependency OpenXML (.docx) generator matching the official LCUP Undergraduate Syllabus
// template in Step 7 (src/views/builder2/FormPaper.jsx): landscape Letter, LCUP & Testmark logos,
// Roman-numeral sections I–X, Vision/Mission & EGA/PO/CLO tables, 6-column Learning Plan,
// Term/Final grading formulas, and 3-column Prepared/Reviewed/Approved sign-off block.
import { PLAN_HEADINGS, defaultModel, gradeSubItems, finalRatingFraction, formulaBody, printedRefGroups, REFS_TITLE, MODIFICATIONS } from './syllabusModel.js';
import { CURRENT_SCHOOL_YEAR, COLLEGE_NAME, INSTITUTION_NAME, INSTITUTION_FORMER_NAME, INSTITUTION_ADDRESS, FORM_CODE } from './schoolYear.js';
import { phDate } from './phTime.js';

// The titles printed under each name in the sign-off block (same as FormPaper.jsx).
const SIGN_TITLES = { dean: 'Dean', asst_vpaa: 'Asst. Vice President for Academic Affairs', lic_director: 'LIC Director', vpaa: 'Vice President for Academic Affairs' };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const encodeUtf8 = (str) => new TextEncoder().encode(String(str ?? ''));
const u16 = (v) => [v & 0xff, (v >>> 8) & 0xff];
const u32 = (v) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];

function buildZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBytes = encodeUtf8(entry.name);
    const data = entry.content instanceof Uint8Array ? entry.content : encodeUtf8(entry.content);
    const crc = crc32(data);
    const localHeader = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04,
      ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), ...u16(0), ...nameBytes,
    ]);
    locals.push(localHeader, data);

    const centralHeader = new Uint8Array([
      0x50, 0x4b, 0x01, 0x02,
      ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(offset), ...nameBytes,
    ]);
    centrals.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  const centralSize = centrals.reduce((sum, b) => sum + b.length, 0);
  const eocd = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0),
    ...u16(entries.length), ...u16(entries.length),
    ...u32(centralSize), ...u32(offset), ...u16(0),
  ]);

  const out = new Uint8Array(offset + centralSize + eocd.length);
  let pos = 0;
  for (const part of [...locals, ...centrals, eocd]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

const xmlEsc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

// Landscape Letter usable width: 15840 dxa - 2*720 dxa margins = 14400 dxa (10 inches)
const PAGE_W = 14400;

const run = (text, { bold = false, italic = false, underline = false, caps = false, size = 20, color = '000000', font = 'Arial' } = {}) => {
  const lines = String(text ?? '').split('\n');
  const inner = lines.map((line, i) => (i > 0 ? '<w:br/>' : '') + `<w:t xml:space="preserve">${xmlEsc(line)}</w:t>`).join('');
  return `<w:r><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>${bold ? '<w:b/>' : ''}${italic ? '<w:i/>' : ''}${caps ? '<w:caps/>' : ''}<w:color w:val="${color}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${underline ? '<w:u w:val="single"/>' : ''}</w:rPr>${inner}</w:r>`;
};

const para = (runs, { spaceBefore = 0, spaceAfter = 60, align = '', indentLeft = 0 } = {}) =>
  `<w:p><w:pPr>${align ? `<w:jc w:val="${align}"/>` : ''}${indentLeft ? `<w:ind w:left="${indentLeft}"/>` : ''}<w:spacing w:before="${spaceBefore}" w:after="${spaceAfter}"/></w:pPr>${Array.isArray(runs) ? runs.join('') : runs}</w:p>`;

// Header cells are white like the institutional form (no shading); `header` only marks them for the reader of this code.
// eslint-disable-next-line no-unused-vars
const cell = (contentXml, { header = false, width = 0, vAlign = 'top' } = {}) =>
  `<w:tc><w:tcPr>${width ? `<w:tcW w:w="${width}" w:type="dxa"/>` : ''}<w:vAlign w:val="${vAlign}"/><w:tcMar><w:top w:w="70" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr>${contentXml}</w:tc>`;

const borderedTable = (rowsXml, widths = []) => {
  const grid = widths.length ? `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>` : '';
  return `<w:tbl><w:tblPr><w:tblW w:w="${PAGE_W}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="222222"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="222222"/><w:left w:val="single" w:sz="4" w:space="0" w:color="222222"/><w:right w:val="single" w:sz="4" w:space="0" w:color="222222"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="222222"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="222222"/></w:tblBorders></w:tblPr>${grid}${rowsXml.join('')}</w:tbl>`;
};

const borderlessTable = (rowsXml, widths = []) => {
  const grid = widths.length ? `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>` : '';
  const total = widths.length ? widths.reduce((s, w) => s + w, 0) : PAGE_W;
  return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="none"/><w:bottom w:val="none"/><w:left w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/></w:tblBorders></w:tblPr>${grid}${rowsXml.join('')}</w:tbl>`;
};

// Matches FormPaper.jsx's .kv2 row: Roman numeral | LABEL | : | Value
// `width` is the room it has: the page, or (for VIII to X) the inside of a bordered full-width row.
const kvRow = (roman, label, value = '', { boldValue = false, spaceBefore = 80, width = PAGE_W } = {}) => {
  const widths = [640, 2780, 260, width - 3680]; // wide enough for "VIII." on one line; the value column still starts at 3680
  return borderlessTable([
    `<w:tr>${cell(para(run(roman, { bold: true, size: 20 }), { spaceBefore, spaceAfter: 20 }), { width: widths[0] })}${cell(para(run(label, { bold: true, size: 20 }), { spaceBefore, spaceAfter: 20 }), { width: widths[1] })}${cell(para(run(label.endsWith(':') ? '' : ':', { size: 20 }), { spaceBefore, spaceAfter: 20 }), { width: widths[2] })}${cell(para(run(value, { bold: boldValue, size: 20 }), { spaceBefore, spaceAfter: 20 }), { width: widths[3] })}</w:tr>`,
  ], widths);
};

// Inline image drawing XML for embedded PNG logos (cx/cy in EMUs: 1px ≈ 9525 EMU)
function imageRun(rId, id, name, widthPx, heightPx) {
  const cx = Math.round(widthPx * 9525);
  const cy = Math.round(heightPx * 9525);
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="${xmlEsc(name)}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="${xmlEsc(name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

// Convert light markdown-like text (lines with leading "- " or "• ", or **bold**) into Word paragraphs.
function richCellParagraphs(rawText, size = 18) {
  const lines = String(rawText ?? '').split('\n');
  if (!lines.some((l) => l.trim())) return para(run('', { size }), { spaceAfter: 0 });
  return lines.map((line) => {
    const trimmed = line.trim();
    const isBullet = /^[-•*]\s+/.test(trimmed);
    const body = isBullet ? '• ' + trimmed.replace(/^[-•*]\s+/, '') : line;
    const parts = body.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    const runs = parts.map((part) => {
      if (part.startsWith('**') && part.endsWith('**')) return run(part.slice(2, -2), { bold: true, size });
      return run(part, { size });
    });
    return para(runs.length ? runs : run('', { size }), { spaceAfter: 30, indentLeft: isBullet ? 180 : 0 });
  }).join('');
}

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

export function buildSyllabusDocx(content = {}, fallback = {}) {
  const d = content || {};
  const meta = d.meta || {};
  const outcomes = d.outcomes || { vision: '', mission: { lead: '', items: [] }, egas: [], pos: [] };
  const egas = outcomes.egas || [];
  const pos = outcomes.pos || [];
  const clos = d.clos || [];
  const plan = d.plan || [];
  const reqs = (d.reqs || []).map((r) => (typeof r === 'string' ? r : r?.t || '').trim()).filter(Boolean);
  const refs = d.refs || {};
  const gradingRows = d.grading?.rows || [];
  const formulas = defaultModel.formulas({
    plan,
    grading: d.grading || { rows: gradingRows, override: { on: false, term: '', final: '' } },
  });

  const code = meta.code || fallback.courseCode || '';
  const title = meta.title || fallback.title || '';
  const schoolYear = meta.academicYear || fallback.academicYear || CURRENT_SCHOOL_YEAR.label;
  const preparedBy = fallback.faculty || d.signoff?.faculty || '';
  const signoffs = fallback.signoffs || null;
  const logos = fallback.logos || {}; // optional { lcup: Uint8Array, testmark: Uint8Array }

  const cloTags = (c) => {
    const e = (c.egas || []).join('&');
    const po = (c.pos || []).join(', ');
    return (e ? `[EGA ${e}] ` : '') + (po ? `[PO ${po}]` : '');
  };
  const iloTags = (il) => (il.tags || []).map((tag) => {
    if (String(tag).startsWith('clo:')) {
      const idx = clos.findIndex((c) => c.id === tag.slice(4));
      return idx >= 0 ? `[CLO${idx + 1}]` : '';
    }
    return ''; // an ILO prints its CLO only; the CLO carries the PO and EGA
  }).filter(Boolean).join(' ');

  const extraEntries = [];
  const docRelRows = [];
  const hasPng = !!(logos.lcup || logos.testmark);
  if (logos.lcup) {
    extraEntries.push({ name: 'word/media/lcup-logo.png', content: logos.lcup });
    docRelRows.push('<Relationship Id="rIdLogo1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/lcup-logo.png"/>');
  }
  if (logos.testmark) {
    extraEntries.push({ name: 'word/media/testmark-logo.png', content: logos.testmark });
    docRelRows.push('<Relationship Id="rIdLogo2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/testmark-logo.png"/>');
  }

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${hasPng ? '<Default Extension="png" ContentType="image/png"/>' : ''}
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${docRelRows.join('\n  ')}
</Relationships>`;

  const body = [];

  // 1. Official LCUP Header (mirrors FormPaper.jsx .paper-head + School Year / College): the logos close beside a letterhead in
  // Monotype Corsiva (name, former name, address), as on the approved syllabi.
  const headWidths = [3500, PAGE_W - 7000, 3500];
  const script = { font: 'Monotype Corsiva', italic: true };
  body.push(borderlessTable([
    `<w:tr>${cell(logos.lcup ? para(imageRun('rIdLogo1', 1, 'LCUP logo', 62, 62), { align: 'right', spaceAfter: 0 }) : para(run(''), { spaceAfter: 0 }), { width: headWidths[0], vAlign: 'center' })}${cell(para([run(INSTITUTION_NAME, { ...script, size: 32 }), run('\n' + INSTITUTION_FORMER_NAME, { ...script, size: 24 }), run('\n' + INSTITUTION_ADDRESS, { ...script, size: 24 })], { align: 'center', spaceAfter: 0 }), { width: headWidths[1], vAlign: 'center' })}${cell(logos.testmark ? para(imageRun('rIdLogo2', 2, 'Testmark logo', 70, 45), { align: 'left', spaceAfter: 0 }) : para(run(''), { spaceAfter: 0 }), { width: headWidths[2], vAlign: 'center' })}</w:tr>`,
  ], headWidths));

  body.push(para(run('SCHOOL YEAR ' + schoolYear, { bold: true, size: 20 }), { align: 'center', spaceBefore: 60, spaceAfter: 200 }));
  body.push(para(run(COLLEGE_NAME.toUpperCase(), { bold: true, size: 20 }), { align: 'center', spaceAfter: 240 }));

  // 2. Sections I – V (exact .kv2 format from FormPaper.jsx)
  body.push(kvRow('I.', 'COURSE CODE', code, { boldValue: true, spaceBefore: 40 }));
  body.push(kvRow('II.', 'COURSE TITLE', title, { boldValue: true, spaceBefore: 40 }));
  body.push(kvRow('III.', 'COURSE DESCRIPTION', '', { spaceBefore: 60 }));
  const desc = (d.description || []).map((x) => (typeof x === 'string' ? x : x?.t || '').trim()).filter(Boolean);
  desc.forEach((pText) => body.push(para(run(pText, { size: 20 }), { align: 'both', indentLeft: 520, spaceBefore: 40, spaceAfter: 60 })));
  body.push(kvRow('IV.', 'PRE-REQUISITE', meta.prereq || '', { spaceBefore: 40 }));
  body.push(kvRow('V.', 'CREDIT UNITS', `${meta.lecture ?? 0} units lecture / ${meta.lab ?? 0} unit laboratory`, { spaceBefore: 40 }));

  // 3. Section VI: Course Learning Outcomes (Vision/Mission table + 3-column EGA/PO/CLO table)
  body.push(kvRow('VI.', 'COURSE LEARNING OUTCOMES:', '', { spaceBefore: 100 }));
  const vmWidths = [Math.round(PAGE_W * 0.4), PAGE_W - Math.round(PAGE_W * 0.4)];
  const missionBody = [
    para(run(outcomes.mission?.lead || '', { size: 19 }), { spaceAfter: 50 }),
    ...(outcomes.mission?.items || []).filter((x) => String(x || '').trim()).map((item) =>
      para(run('• ' + item, { italic: true, size: 19 }), { indentLeft: 220, spaceAfter: 40 }),
    ),
  ].join('');
  body.push(borderedTable([
    `<w:tr>${cell(para(run('Vision', { bold: true, size: 19 }), { align: 'center', spaceAfter: 0 }), { header: true, width: vmWidths[0] })}${cell(para(run('Mission', { bold: true, size: 19 }), { align: 'center', spaceAfter: 0 }), { header: true, width: vmWidths[1] })}</w:tr>`,
    `<w:tr>${cell(para(run(outcomes.vision || '', { size: 19 }), { spaceAfter: 0 }), { width: vmWidths[0] })}${cell(missionBody, { width: vmWidths[1] })}</w:tr>`,
  ], vmWidths));

  body.push(para(run('', { size: 8 }), { spaceAfter: 60 }));

  const outWidths = [Math.round(PAGE_W * 0.22), Math.round(PAGE_W * 0.36), PAGE_W - Math.round(PAGE_W * 0.22) - Math.round(PAGE_W * 0.36)];
  const egaCellXml = egas.length
    ? egas.map((e) => para([run(`EGA ${e.no}`, { bold: true, size: 18 }), run(`: ${e.name || e.short || ''}`, { size: 18 })], { spaceAfter: 70 })).join('')
    : para(run('', { size: 18 }), { spaceAfter: 0 });
  const poCellXml = pos.length
    ? pos.map((o) => para([
      run(`PO ${o.no}.`, { bold: true, size: 18 }),
      run(` ${o.text || o.short || ''} `, { size: 18 }),
      ...((o.egas || []).length ? [run(o.egas.map((g) => `[EGA ${g}]`).join(' '), { bold: true, size: 18 })] : []),
    ], { spaceAfter: 50 })).join('')
    : para(run('No program outcomes loaded.', { italic: true, size: 18, color: '555555' }), { spaceAfter: 0 });
  const cloCellXml = clos.length
    ? clos.map((c, i) => para([
      run(`CLO ${i + 1} – ${c.level || ''}${c.title ? ` (${c.title})` : ''}`, { bold: true, size: 18 }),
      run('\n' + (c.statement || '') + ' ', { size: 18 }),
      run(cloTags(c), { bold: true, size: 18 }),
    ], { spaceAfter: 90 })).join('')
    : para(run('', { size: 18 }), { spaceAfter: 0 });

  body.push(borderedTable([
    `<w:tr>${cell(para(run('EXPECTED GRADUATE ATTRIBUTES', { bold: true, size: 18 }), { align: 'center', spaceAfter: 0 }), { header: true, width: outWidths[0] })}${cell(para(run('PROGRAM OUTCOMES', { bold: true, size: 18 }), { align: 'center', spaceAfter: 0 }), { header: true, width: outWidths[1] })}${cell(para(run('COURSE LEARNING OUTCOMES', { bold: true, size: 18 }), { align: 'center', spaceAfter: 0 }), { header: true, width: outWidths[2] })}</w:tr>`,
    `<w:tr>${cell(egaCellXml, { width: outWidths[0] })}${cell(poCellXml, { width: outWidths[1] })}${cell(cloCellXml, { width: outWidths[2] })}</w:tr>`,
  ], outWidths));

  // 4. Section VII: Learning Plan (exact 6-column table from FormPaper.jsx)
  body.push(kvRow('VII.', 'LEARNING PLAN:', '', { spaceBefore: 120 }));
  const planWidths = [
    Math.round(PAGE_W * 0.12),
    Math.round(PAGE_W * 0.22),
    Math.round(PAGE_W * 0.15),
    Math.round(PAGE_W * 0.18),
    Math.round(PAGE_W * 0.17),
    PAGE_W - Math.round(PAGE_W * 0.12) - Math.round(PAGE_W * 0.22) - Math.round(PAGE_W * 0.15) - Math.round(PAGE_W * 0.18) - Math.round(PAGE_W * 0.17),
  ];
  const planHeaders = ['SCHEDULE', ...Object.values(PLAN_HEADINGS).map((h) => h.toUpperCase())];
  const planRowsXml = [
    `<w:tr>${planHeaders.map((h, idx) => cell(para(run(h, { bold: true, size: 17 }), { align: 'center', spaceAfter: 0 }), { header: true, width: planWidths[idx] })).join('')}</w:tr>`,
    ...plan.map((r) => {
      const iloXml = r.kind === 'exam'
        ? para(run(r.ilos?.[0]?.text || '', { size: 18 }), { spaceAfter: 0 })
        : (r.ilos || []).map((il, j) => {
          const tags = iloTags(il);
          return para([
            run(`ILO${j + 1}: `, { bold: true, size: 18 }),
            run((il.text || '') + (tags ? ' ' : ''), { size: 18 }),
            ...(tags ? [run(tags, { bold: true, size: 18 })] : []),
          ], { spaceAfter: 50 });
        }).join('') || para(run('', { size: 18 }), { spaceAfter: 0 });
      return `<w:tr>${cell(para(run('Week ' + (r.week || ''), { size: 18 }), { spaceAfter: 0 }), { width: planWidths[0] })}${cell(iloXml, { width: planWidths[1] })}${cell(richCellParagraphs(r.contents, 18), { width: planWidths[2] })}${cell(richCellParagraphs(r.activities, 18), { width: planWidths[3] })}${cell(richCellParagraphs(r.tasks, 18), { width: planWidths[4] })}${cell(richCellParagraphs(r.values, 18), { width: planWidths[5] })}</w:tr>`;
    }),
  ];
  // VIII to X go in bordered full-width rows joined to the bottom of the Learning Plan table, as on the institutional form
  // (FormPaper.jsx tr.paper-sec). Inside such a row there is the page width less the cell's side margins.
  const SEC_W = PAGE_W - 200;
  const secRow = (xml) => `<w:tr><w:tc><w:tcPr><w:tcW w:w="${PAGE_W}" w:type="dxa"/><w:gridSpan w:val="6"/><w:tcMar><w:top w:w="40" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr>${xml}${para(run('', { size: 8 }), { spaceAfter: 0 })}</w:tc></w:tr>`;

  // 5. Section VIII: Course Requirements
  const reqXml = [kvRow('VIII.', 'COURSE REQUIREMENTS', '', { spaceBefore: 40, width: SEC_W }),
    ...reqs.map((reqText, i) => para(run(`${i + 1}. ${reqText}`, { size: 20 }), { indentLeft: 520, spaceAfter: 40 }))];

  // 6. Section IX: References (exact A–D groups from FormPaper.jsx)
  // "IX. SUGGESTED REFERENCES" (no colon, as printed), then only the groups in use, lettered in order (printedRefGroups).
  const refXml = [para([run('IX.', { bold: true, size: 20 }), run('\t' + REFS_TITLE, { bold: true, size: 20 })], { spaceBefore: 40, spaceAfter: 20, indentLeft: 100 }).replace('<w:pPr>', '<w:pPr><w:tabs><w:tab w:val="left" w:pos="740"/></w:tabs>')];
  // (indented by the 100 dxa cell margin of the kvRow headings above and below, so "IX." lines up with "VIII." and "X.")
  printedRefGroups(refs).forEach((g) => {
    refXml.push(para(run(`${g.letter}. ${g.title.toUpperCase()}`, { bold: true, size: 19 }), { indentLeft: 520, spaceBefore: 60, spaceAfter: 30 }));
    g.items.forEach((item) => refXml.push(para(run(item, { size: 19 }), { indentLeft: 720, spaceAfter: 30 })));
  });

  // 7. Section X: Grading System, laid out like the printed form (FormPaper.jsx .paper-grade): a number, the component and
  // what it includes, and on the right (under the heading's colon) its weight; then Term Grade and Final Rating as rows 3 and 4,
  // the Final Rating as a fraction (the exam terms over their number).
  const gradeHead = kvRow('X.', 'GRADING SYSTEM', '', { spaceBefore: 40, width: SEC_W });
  const gradeWidths = [520, 400, 2760, SEC_W - 3680];
  const gradeCell = (xml, w) => cell(xml, { width: w }).replace(/<w:tcMar>.*?<\/w:tcMar>/, '<w:tcMar><w:top w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>');
  const gradeRow = (no, labelXml, valueXml) => `<w:tr>${gradeCell(para(run(''), { spaceAfter: 0 }), gradeWidths[0])}${gradeCell(para(run(no, { size: 20 }), { spaceAfter: 160 }), gradeWidths[1])}${gradeCell(labelXml, gradeWidths[2])}${gradeCell(valueXml, gradeWidths[3])}</w:tr>`;
  const valuePara = (text) => para(run(text, { size: 20 }), { spaceAfter: 160 });
  const gradeRowsXml = gradingRows.map((r, i) => {
    const subs = gradeSubItems(r);
    const labelXml = [para(run(r.label || '', { size: 20 }), { spaceAfter: subs.length ? 0 : 160 }), ...subs.map((s, k) => para(run(s, { size: 20 }), { spaceAfter: k === subs.length - 1 ? 160 : 0 }))].join('');
    return gradeRow(`${i + 1}.`, labelXml, valuePara(`${Number(r.pct) || 0}%`));
  });
  const n = gradingRows.length;
  const frac = finalRatingFraction({ plan, grading: { rows: gradingRows, override: d.grading?.override || { on: false } } });
  // The fraction: a small borderless table about as wide as its text (10 pt Arial is about 105 dxa a character), the exam terms
  // underlined over their number, both centered.
  const fracW = frac ? Math.min(gradeWidths[3] - 100, frac.num.length * 105 + 120) : 0;
  const fracXml = frac
    ? `<w:tbl><w:tblPr><w:tblW w:w="${fracW}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="none"/><w:bottom w:val="none"/><w:left w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/></w:tblBorders><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="${fracW}"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="${fracW}" w:type="dxa"/></w:tcPr>${para(run(frac.num, { underline: true, size: 20 }), { align: 'center', spaceAfter: 0 })}${para(run(String(frac.den), { size: 20 }), { align: 'center', spaceAfter: 0 })}</w:tc></w:tr></w:tbl>${para(run(''), { spaceAfter: 120 })}`
    : valuePara(formulaBody(formulas.final, 'Final Rating'));
  const gradeXml = gradeHead + borderlessTable([
    ...gradeRowsXml,
    gradeRow(`${n + 1}.`, valuePara('Term Grade'), valuePara(formulaBody(formulas.term, 'Term Grade'))),
    gradeRow(`${n + 2}.`, valuePara('Final Rating'), fracXml),
  ], gradeWidths);

  body.push(borderedTable([...planRowsXml, secRow(reqXml.join('')), secRow(refXml.join('')), secRow(gradeXml)], planWidths));
  body.push(para(run(''), { spaceAfter: 120 }));

  // 8. Sign-off block, as on the printed form (FormPaper.jsx .paper-sign): a light blue strip over three columns; Prepared by (faculty),
  // Checked and Reviewed by (dean, Asst. VPAA, then References Certified by the LIC Director), Approved by (VPAA). Each name is bold,
  // underlined and in capitals, centered over its title and date; a name not yet known is a blank line to sign on.
  const sigWidths = [Math.round(PAGE_W / 3), Math.round(PAGE_W / 3), PAGE_W - 2 * Math.round(PAGE_W / 3)];
  const signLine = (name, title, at) => [
    name
      ? para(run(name, { bold: true, underline: true, caps: true, size: 19 }), { align: 'center', spaceBefore: 420, spaceAfter: 0 })
      : para(run('________________________________', { size: 19 }), { align: 'center', spaceBefore: 420, spaceAfter: 0 }),
    para(run(`${title} - ${at ? phDate(at) : 'Date'}`, { size: 18 }), { align: 'center', spaceAfter: 80 }),
  ].join('');
  const stageSign = (stage) => {
    const st = signoffs?.stages?.[stage];
    return st?.cleared ? signLine(st.by || '', SIGN_TITLES[stage], st.at) : signLine('', SIGN_TITLES[stage], null);
  };
  const label = (text, spaceBefore = 0) => para(run(text, { size: 19 }), { spaceBefore, spaceAfter: 0 });
  // Each date is the day that step happened: submitted (faculty), cleared (each reviewer), approved (VPAA); "Date" until then.
  const preparedXml = label('Prepared by:') + signLine(preparedBy || '', 'Faculty', signoffs?.submitted?.at || null);
  const reviewedXml = label('Checked and Reviewed by:') + stageSign('dean') + stageSign('asst_vpaa') + label('References Certified by:', 120) + stageSign('lic_director');
  const approvedXml = label('Approved by:') + (signoffs?.approved
    ? signLine(signoffs.approved.by || '', SIGN_TITLES.vpaa, signoffs.approved.at)
    : signLine('', SIGN_TITLES.vpaa, null));
  // The strip keeps with the next row and that row never splits, so the whole block moves to the next page together.
  const stripRow = `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="140" w:hRule="exact"/></w:trPr><w:tc><w:tcPr><w:tcW w:w="${PAGE_W}" w:type="dxa"/><w:gridSpan w:val="3"/><w:shd w:val="clear" w:color="auto" w:fill="DBE5F1"/></w:tcPr><w:p><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="0"/></w:pPr>${run('', { size: 2 })}</w:p></w:tc></w:tr>`;

  body.push(borderedTable([
    stripRow,
    `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cell(preparedXml, { width: sigWidths[0] })}${cell(reviewedXml, { width: sigWidths[1] })}${cell(approvedXml, { width: sigWidths[2] })}</w:tr>`,
  ], sigWidths));

  // 9. The template's Revision Date / Modifications box right under the sign-off block: two equal columns, as wide as every other
  // table. Word joins two tables with nothing between them, so a hairline paragraph keeps them apart.
  // In the downloaded file the Revision Date is left blank (to be written in by hand), and so is the checklist, as on the paper form.
  body.push('<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>');
  const revWidths = [PAGE_W / 2, PAGE_W / 2];
  const revTable = borderedTable([
    `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cell(para(run('Revision Date:', { size: 19 }), { spaceAfter: 60 }), { width: revWidths[0] })}${cell(para(run(''), { spaceAfter: 0 }), { width: revWidths[1] })}</w:tr>`,
    `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cell([para(run('Modifications:', { size: 19 }), { spaceAfter: 100 }), ...MODIFICATIONS.map((m) => para(run('__' + m, { size: 16 }), { spaceAfter: 0 })), para(run(''), { spaceAfter: 300 })].join(''), { width: revWidths[0] })}${cell(para(run(''), { spaceAfter: 0 }), { width: revWidths[1] })}</w:tr>`,
  ], revWidths);
  body.push(revTable);
  // 10. The form control code, bottom-left under the box, as on the approved syllabi. Only the downloaded file carries it.
  body.push(para(run(FORM_CODE, { bold: true, size: 18, font: 'Calibri' }), { spaceBefore: 360, spaceAfter: 0 }));

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body.join('\n    ')}
    <w:sectPr><w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>
  </w:body>
</w:document>`;

  return buildZip([
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: ROOT_RELS },
    { name: 'word/_rels/document.xml.rels', content: docRels },
    { name: 'word/document.xml', content: documentXml },
    ...extraEntries,
  ]);
}

async function fetchLogoBytes(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function downloadSyllabusDocx(content, fallback = {}) {
  const [lcup, testmark] = await Promise.all([fetchLogoBytes('/lcup-logo.png'), fetchLogoBytes('/testmark-logo.png')]);
  const bytes = buildSyllabusDocx(content, { ...fallback, logos: { lcup, testmark } });
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const rawName = String(content?.meta?.code || fallback.courseCode || 'syllabus').replace(/[^A-Za-z0-9._-]+/g, '_');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${rawName}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
