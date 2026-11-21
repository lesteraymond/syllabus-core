const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { validatePdf, extractPdf, MAX_BYTES } = require('./pdfImport');
function pdfBytes(text, { image, pages = 1, encrypted = false, drawing = '' } = {}) {
  const objects = [null, '<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${Array.from({ length: pages }, () => '3 0 R').join(' ')}] /Count ${pages} >>`,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> /XObject << /Im1 6 0 R >> >> /Contents 4 0 R >>'];
  const stream = image ? 'q 612 0 0 792 0 0 cm /Im1 Do Q' : `BT /F1 11 Tf 40 750 Td 16 TL ${text.split('\n').map(line => `(${line.replace(/[\\()]/g, '\\$&')}) Tj T*`).join('\n')} ET\n${drawing}`;
  objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  if (image) objects.push(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width 1224 /Height 1584 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`), image, Buffer.from('\nendstream')]));
  if (encrypted) objects.push(`<< /Filter /Standard /V 1 /R 2 /Length 40 /O <${'00'.repeat(32)}> /U <${'00'.repeat(32)}> /P -4 >>`);
  const parts = [Buffer.from('%PDF-1.7\n')], offsets = [0];
  let length = parts[0].length;
  for (let i = 1; i < objects.length; i++) { const obj = Buffer.concat([Buffer.from(`${i} 0 obj\n`), Buffer.from(objects[i]), Buffer.from('\nendobj\n')]); offsets.push(length); parts.push(obj); length += obj.length; }
  parts.push(Buffer.from(`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Root 1 0 R /Size ${objects.length} ${encrypted ? `/Encrypt ${objects.length - 1} 0 R /ID [<${'00'.repeat(16)}> <${'00'.repeat(16)}>]` : ''} >>\nstartxref\n${length}\n%%EOF`));
  return Buffer.concat(parts);
}
const text = 'I. COURSE CODE: MA 7\nII. COURSE TITLE: Differential Calculus\nIII. COURSE DESCRIPTION: Study limits and derivatives in engineering.\nIV. PRE-REQUISITE: Algebra\nV. CREDIT UNITS: 3\nVI. COURSE LEARNING OUTCOMES:\nCLO 1: Compute derivatives. PO: 1 EGA: 1\nVII. LEARNING PLAN:\n1 | Compute derivatives (CLO 1) | Derivatives | Practice | Problem set | Humility\nVIII. COURSE REQUIREMENTS: Problem sets\nIX. REFERENCES: https://example.org/calculus\nX. GRADING SYSTEM:\nProblem sets 60%\nExam 40%';
test('real text PDF extraction returns review fields and never a score or AI result', async () => {
  const result = await extractPdf(pdfBytes(text));
  assert.equal(result.found.length, 10);
  assert.equal(result.fields.code, 'MA 7');
  assert.equal(result.pages[0].method, 'text');
  assert.equal(result.requiresReview, true);
  assert.equal(result.aiCheckTriggered, false);
  assert.equal(result.score, undefined);
});
test('scanned PDF uses installed local OCR and preserves readable section text', { timeout: 120000 }, async () => {
  const { createCanvas } = require('@napi-rs/canvas');
  const canvas = createCanvas(1224, 1584), context = canvas.getContext('2d');
  context.fillStyle = 'white'; context.fillRect(0, 0, 1224, 1584);
  context.fillStyle = 'black'; context.font = '24px Arial';
  text.split('\n').forEach((line, i) => context.fillText(line, 60, 90 + i * 60));
  const result = await extractPdf(pdfBytes('', { image: canvas.toBuffer('image/jpeg') }));
  assert.equal(result.pages[0].method, 'ocr');
  assert.match(result.fields.description, /limits/i, result.text);
  assert.ok(result.pages[0].confidence > 30);
});
function tablePdf() {
  const prefix = 'I. COURSE CODE: MA 7\nII. COURSE TITLE: Differential Calculus\nIII. COURSE DESCRIPTION: Analyze limits, derivatives and engineering models.\nIV. PRE-REQUISITE: Algebra\nV. CREDIT UNITS: 3\nVI. COURSE LEARNING OUTCOMES:\nCLO 1: Analyze a model.\nCLO 3: Design a filter.\nVII. LEARNING PLAN:';
  const xs = [40, 100, 196, 292, 388, 484, 580];
  const commands = [];
  for (const x of xs) commands.push(`${x} 400 m ${x} 600 l S`);
  for (const y of [400, 560, 600]) commands.push(`40 ${y} m 580 ${y} l S`);
  const put = (text, x, y) => commands.push(`BT /F1 8 Tf ${x} ${y} Td (${text.replace(/[\\()]/g, '\\$&')}) Tj ET`);
  const headers = [['Week'], ['Intended Learning', 'Outcomes'], ['Course Contents'], ['Learning Activities'], ['Assessment Tasks'], ['Values']];
  const cells = [['1'], ['ILO1: Analyze |x|.', '[CLO 1, 3]'], ['Signals'], ['Build a model'], ['Model defense'], ['Humility']];
  headers.forEach((lines, i) => lines.forEach((line, n) => put(line, xs[i] + 4, 584 - n * 12)));
  cells.forEach((lines, i) => lines.forEach((line, n) => put(line, xs[i] + 4, 540 - n * 12)));
  put('VIII. COURSE REQUIREMENTS: A model report', 40, 360);
  put('IX. REFERENCES: https://example.org/math', 40, 330);
  put('X. GRADING SYSTEM:', 40, 300); put('Project 60%', 40, 280); put('Examination 40%', 40, 264);
  return pdfBytes(prefix, { drawing: commands.join('\n') });
}
test('a real PDF table is recovered as six columns without flattening cell contents', async () => {
  const result = await extractPdf(tablePdf());
  assert.equal(result.layout.planRows.length, 1);
  const row = result.layout.planRows[0];
  assert.equal(row.week, '1');
  assert.match(row.ilo, /Analyze \|x\|/);
  assert.equal(row.contents, 'Signals');
  assert.equal(row.values, 'Humility');
  assert.equal(row.activities, 'Build a model');
});
test('a scanned table is recovered from local OCR word boxes and printed grid lines', { timeout: 120000 }, async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // The image must not depend on the computer's own fonts (Arial on Windows, DejaVu on Linux: on Linux the OCR missed the word "Learning" in two
  // header cells and no row was recovered). The standard fonts bundled with pdfjs-dist give the same glyphs everywhere. pdfjs loads them only from a
  // path that uses "/" and ends in "/": a Windows path throws, and a file: URL is silently ignored (the computer's own fonts are used again).
  const path = require('node:path'), fontDir = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts');
  const standardFontDataUrl = fontDir.split(path.sep).join('/') + '/';
  const task = pdfjs.getDocument({ data: new Uint8Array(tablePdf()), useSystemFonts: false, standardFontDataUrl });
  const document = await task.promise;
  const page = await document.getPage(1), viewport = page.getViewport({ scale: 2 });
  const { createCanvas } = require('@napi-rs/canvas');
  const canvas = createCanvas(viewport.width, viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  const image = canvas.toBuffer('image/jpeg');
  await task.destroy();
  const result = await extractPdf(pdfBytes('', { image }));
  assert.equal(result.pages[0].method, 'ocr');
  assert.equal(result.layout.planRows.length, 1);
  assert.match(result.layout.planRows[0].contents, /Signals/i);
  assert.match(result.layout.planRows[0].tasks, /Model defense/i);
});
test('malformed, oversized, excessive pages and no-section documents fail closed', async () => {
  assert.throws(() => validatePdf(Buffer.from('not PDF')), /pdfImport.invalid/);
  assert.throws(() => validatePdf(Buffer.alloc(MAX_BYTES + 1)), /pdfImport.tooLarge/);
  await assert.rejects(extractPdf(pdfBytes(text, { pages: 31 })), /pdfImport.tooManyPages/);
  await assert.rejects(extractPdf(pdfBytes(text, { encrypted: true })), /pdfImport.encrypted/);
  await assert.rejects(extractPdf(pdfBytes('An ordinary document with enough legible text but no standard syllabus section headers.')), /pdfImport.noSections/);
});
test('timed-out worker is terminated before its evaluation slot can be reused', async () => {
  let terminated = false;
  class WatchWorker extends EventEmitter {
    constructor() { super(); setImmediate(() => { this.emit('message', { 'watch:require': ['pdfImport.worker.js'] }); this.emit('message', { fields: { code: 'X' }, pages: [] }); }); }
    terminate() { return Promise.resolve(); }
  }
  assert.deepEqual(await extractPdf(pdfBytes(text), { WorkerClass: WatchWorker }), { fields: { code: 'X' }, pages: [] }, 'node --watch notices from the worker are skipped');
  class HangingWorker extends EventEmitter { terminate() { terminated = true; return Promise.resolve(); } }
  await assert.rejects(extractPdf(pdfBytes(text), { timeoutMs: 10, WorkerClass: HangingWorker }), /pdfImport.timeout/);
  assert.equal(terminated, true);
});
// Pages given as lists of lines; an empty list is a blank page.
function multiPagePdf(pageLines) {
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', null, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const kids = [];
  for (const lines of pageLines) {
    const stream = lines.length ? 'BT /F1 11 Tf 40 750 Td 16 TL ' + lines.map(line => '(' + line.replace(/[\\()]/g, '\\$&') + ') Tj T*').join('\n') + ' ET' : '';
    objs.push('<< /Length ' + Buffer.byteLength(stream) + ' >>\nstream\n' + stream + '\nendstream');
    objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ' + objs.length + ' 0 R >>');
    kids.push(objs.length + ' 0 R');
  }
  objs[1] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + kids.length + ' >>';
  let out = '%PDF-1.7\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const xref = out.length;
  out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  return Buffer.from(out + 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF', 'latin1');
}
test('a blank page is skipped and reported instead of failing the whole import', async () => {
  const result = await extractPdf(multiPagePdf([text.split('\n'), []]));
  assert.equal(result.fields.code, 'MA 7');
  assert.deepEqual(result.pages.map(p => [p.page, p.method, p.reason]), [[1, 'text', undefined], [2, 'skipped', 'blank']]);
  await assert.rejects(extractPdf(multiPagePdf([[], []])), /pdfImport.unreadable/, 'a PDF with no readable page still fails');
});
module.exports = { pdfBytes, text };

