const { parentPort, workerData } = require('node:worker_threads');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { positionedText, vectorBoxes, rasterBoxes } = require('./pdfGeometry');
const { recoverTables } = require('./pdfLayout');
// English OCR data is installed with the app: no syllabus content or page image
// is sent to an AI provider or external OCR service.
const MAX_PAGES = 30;
const MAX_TEXT = 180000;
function pageLines(items) {
  const lines = [];
  for (const item of items) {
    if (!item.str?.trim()) continue;
    const y = item.transform[5];
    let line = lines.find(line => Math.abs(line.y - y) < 2);
    if (!line) { line = { y, items: [] }; lines.push(line); }
    line.items.push({ x: item.transform[4], width: item.width, text: item.str });
  }
  return lines.sort((a, b) => b.y - a.y).map(line => {
    let end = null;
    return line.items.sort((a, b) => a.x - b.x).map(item => {
      const gap = end === null ? '' : item.x - end > 16 ? '\t' : ' ';
      end = item.x + item.width;
      return gap + item.text;
    }).join('');
  }).join('\n');
}
(async () => {
  let task, ocr, encrypted = false;
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    task = pdfjs.getDocument({ data: new Uint8Array(workerData.bytes), isEvalSupported: false, useSystemFonts: true,
      standardFontDataUrl: path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts').replaceAll('\\', '/') + '/' });
    task.onPassword = () => { encrypted = true; task.destroy().catch(() => {}); };
    const pdf = await task.promise;
    if (pdf.numPages > MAX_PAGES) throw new Error('pdfImport.tooManyPages');
    const pages = [];
    const sourceStreams = [];
    const geometryPages = [];
    const cloColumn = [];
    let cloX = null, cloDone = false;
    let total = 0;
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const items = (await page.getTextContent()).items;
      const display = page.getViewport({ scale: 1 });
      let positioned = positionedText(items, display);
      let boxes = vectorBoxes(await page.getOperatorList(), pdfjs, display);
      let text = pageLines(items);
      sourceStreams.push(text.replace(/\s/g, '').length >= 100 ? items.map(item => (item.str || '') + (item.hasEOL ? '\n' : ' ')).join('') : '');
      // Three-column outcome tables must not mix POs/EGAs into CLO statements.
      // Use an explicitly labelled CLO column when its x position is unambiguous.
      const anchors = items.filter(item => /^CLO\s*\d+[.:]/i.test(item.str.trim()));
      if (!cloDone && anchors.length && cloX === null) cloX = Math.min(...anchors.map(item => item.transform[4]));
      const planHeading = items.find(item => /VII\s*[.)]?\s*LEARNING PLAN/i.test(item.str));
      if (!cloDone && cloX !== null) {
        const top = anchors.length && !cloColumn.length ? Math.max(...anchors.map(item => item.transform[5])) + 2 : page.getViewport({ scale: 1 }).height - 40;
        const bottom = planHeading ? planHeading.transform[5] + 5 : 35;
        cloColumn.push(pageLines(items.filter(item => item.transform[4] >= cloX - 4 && item.transform[5] <= top && item.transform[5] > bottom)));
      }
      if (planHeading) cloDone = true;
      let method = 'text', confidence = null;
      if (text.replace(/\s/g, '').length < 100) {
        if (!ocr) {
          const { createWorker } = require('tesseract.js');
          const { langPath, gzip } = require('@tesseract.js-data/eng');
          ocr = await createWorker('eng', 1, { langPath, gzip, cacheMethod: 'none' });
        }
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(2, Math.sqrt(5000000 / (base.width * base.height)));
        const viewport = page.getViewport({ scale });
        const { createCanvas } = require('@napi-rs/canvas');
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        const result = await ocr.recognize(canvas.toBuffer('image/png'), {}, { text: true, blocks: true });
        text = result.data.text;
        confidence = result.data.confidence;
        method = 'ocr';
        if (confidence < 35) throw new Error('pdfImport.unreadable');
        const words = (result.data.blocks || []).flatMap(block => block.paragraphs || []).flatMap(paragraph => paragraph.lines || []).flatMap(line => line.words || []);
        positioned = words.map(word => ({ text: word.text, x: word.bbox.x0 / scale, y: word.bbox.y0 / scale, width: (word.bbox.x1 - word.bbox.x0) / scale, height: (word.bbox.y1 - word.bbox.y0) / scale }));
        boxes = rasterBoxes(canvas, scale);
      }
      if (!text.trim()) throw new Error('pdfImport.unreadable');
      total += text.length;
      if (total > MAX_TEXT) throw new Error('pdfImport.tooMuchText');
      pages.push({ page: number, text, method, confidence });
      geometryPages.push({ number, width: display.width, height: display.height, items: positioned, boxes });
      page.cleanup();
    }
    if (total < 80) throw new Error('pdfImport.unreadable');
    const { splitPdfSections } = await import(pathToFileURL(path.resolve(__dirname, '../../src/lib/pdfImport.js')).href);
    const text = pages.map(page => page.text).join('\n\n');
    const { fields, found } = splitPdfSections(text);
    // Superscripts can sort above a preceding section heading. Use the bounded
    // source stream for these two prose fields when all delimiters were recovered.
    const stream = splitPdfSections(sourceStreams.join('\n'));
    if (['description', 'prereq', 'credits'].every(key => stream.found.includes(key))) {
      fields.description = stream.fields.description.replace(/\s+/g, ' ').trim();
      fields.prereq = stream.fields.prereq.replace(/(\d)\s+(st|nd|rd|th)\b/gi, '$1$2').replace(/\s+/g, ' ').trim();
    }
    if (cloColumn.some(text => /CLO\s*\d+[.:]/i.test(text))) fields.clos = cloColumn.join('\n').trim();
    const layout = recoverTables(geometryPages);
    Object.assign(fields, layout.fields);
    if (layout.planRows.length) fields.plan = layout.planRows.map(row => [row.week, row.ilo, row.contents, row.activities, row.tasks, row.values].map(cell => cell.replace(/\n/g, ' ')).join(' | ')).join('\n');
    else if (fields.plan?.trim()) layout.warnings.push({ code: 'plan_layout_not_recovered' });
    if (found.length < 2) throw new Error('pdfImport.noSections');
    parentPort.postMessage({ fields, found, text, layout: { version: 2, planRows: layout.planRows, warnings: layout.warnings }, pages: pages.map(({ page, method, confidence }) => ({ page, method, confidence })), requiresReview: true, aiCheckTriggered: false });
  } catch (error) {
    if (process.env.PDF_IMPORT_DEBUG === '1') console.error(error.stack);
    const message = encrypted || error.name === 'PasswordException' ? 'pdfImport.encrypted' : error.message?.startsWith('pdfImport.') ? error.message : 'pdfImport.unreadable';
    parentPort.postMessage({ error: message });
  } finally {
    if (ocr) await ocr.terminate().catch(() => {});
    if (task) await task.destroy().catch(() => {});
  }
})();
