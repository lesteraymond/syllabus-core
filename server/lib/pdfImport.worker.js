const { parentPort, workerData } = require('node:worker_threads');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { positionedText, vectorBoxes, rasterBoxes } = require('./pdfGeometry');
const { recoverTables } = require('./pdfLayout');
// English OCR data is installed with the app: no syllabus content or page image
// is sent to an AI provider or external OCR service.
const MAX_PAGES = 30;
const MAX_TEXT = 180000;
// Fewer readable characters than this on a page means its text layer may be missing (a scan) and OCR is considered.
const OCR_BELOW = 100;
// The heading that ends VI. Course Learning Outcomes, read from a whole printed line so a heading split into
// several text pieces ("VII." + "LEARNING PLAN") or numbered as a later section still counts.
const OUTCOMES_END = /^\s*(?:[Il1|]\s*[.)]\s+)?(?:V[Il1|]{2,3}|[Il1|]X|X)\s*[.)]?\s*(?:LEARNING\s+PLAN|COURSE\s+REQUIREMENTS|(?:SUGGESTED\s+)?REFERENCES|GRADING\s+SYSTEM)\b/i;
const nonSpace = text => text.replace(/\s/g, '').length;
// Text items as printed lines, top to bottom. Positions are taken on the displayed page (viewport), so a page
// with /Rotate, or a page whose text is drawn rotated to read upright, still yields lines in reading order.
function pageRows(items, viewport) {
  const lines = [];
  for (const item of items) {
    if (!item.str?.trim()) continue;
    const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
    let line = lines.find(line => Math.abs(line.y - y) < 2);
    if (!line) { line = { y, items: [] }; lines.push(line); }
    line.items.push({ x, y, width: item.width, text: item.str });
  }
  return lines.sort((a, b) => a.y - b.y).map(line => ({ y: line.y, text: joinRow(line.items), items: line.items }));
}
// One printed line: a wide gap (a table column) becomes a tab, a narrow one a space.
function joinRow(items) {
  let end = null;
  return [...items].sort((a, b) => a.x - b.x).map(item => {
    const gap = end === null ? '' : item.x - end > 16 ? '\t' : ' ';
    end = item.x + item.width;
    return gap + item.text;
  }).join('');
}
(async () => {
  let task, ocr, encrypted = false;
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const imageOps = new Set(Object.entries(pdfjs.OPS).filter(([name]) => /^paint.*Image/i.test(name)).map(([, op]) => op));
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
      // Lets the caller extend its deadline while pages are still being read (scanned pages take seconds each).
      parentPort.postMessage({ progress: { page: number, pages: pdf.numPages } });
      const page = await pdf.getPage(number);
      const items = (await page.getTextContent()).items;
      const display = page.getViewport({ scale: 1 });
      const operators = await page.getOperatorList();
      let positioned = positionedText(items, display);
      let boxes = vectorBoxes(operators, pdfjs, display);
      const rows = pageRows(items, display);
      let text = rows.map(row => row.text).join('\n');
      sourceStreams.push(nonSpace(text) >= OCR_BELOW ? items.map(item => (item.str || '') + (item.hasEOL ? '\n' : ' ')).join('') : '');
      // Three-column outcome tables must not mix POs/EGAs into CLO statements.
      // Use an explicitly labelled CLO column when its x position is unambiguous, and only up to the heading that ends
      // section VI: without that heading the column is not used (the section text below stands instead).
      const anchors = rows.flatMap(row => row.items).filter(item => /^CLO\s*\d+[.:]/i.test(item.text.trim()));
      if (!cloDone && anchors.length && cloX === null) cloX = Math.min(...anchors.map(item => item.x));
      if (!cloDone && cloX !== null) {
        const top = anchors.length && !cloColumn.length ? Math.min(...anchors.map(item => item.y)) - 2 : 40;
        const end = rows.find(row => row.y > top && OUTCOMES_END.test(row.text));
        const bottom = end ? end.y - 5 : display.height - 35;
        cloColumn.push(rows.map(row => joinRow(row.items.filter(item => item.x >= cloX - 4 && item.y >= top && item.y < bottom))).filter(Boolean).join('\n'));
        if (end) cloDone = true;
      }
      let method = 'text', confidence = null;
      const layerChars = nonSpace(text);
      // OCR a page only when its text layer is (nearly) empty and the page shows an image, or has no text at all (text drawn
      // as outlines). A page with a little real text and no image (a sign-off page) keeps its text layer as it is.
      const hasImage = operators.fnArray.some(op => imageOps.has(op));
      if (layerChars < OCR_BELOW && (hasImage || layerChars === 0)) {
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
        confidence = result.data.confidence;
        // A blank page, or a page OCR cannot read (a logo, a signature, a stamp), no longer fails the whole import: it keeps
        // whatever text layer it had, or is skipped and reported. The import fails only if too little text is left overall.
        // OCR replaces a partial text layer only when it read clearly more of the page.
        const ocrChars = nonSpace(result.data.text);
        if (ocrChars && confidence >= 35 && (layerChars === 0 || ocrChars >= layerChars * 2 + 20)) {
          text = result.data.text;
          method = 'ocr';
          const words = (result.data.blocks || []).flatMap(block => block.paragraphs || []).flatMap(paragraph => paragraph.lines || []).flatMap(line => line.words || []);
          positioned = words.map(word => ({ text: word.text, x: word.bbox.x0 / scale, y: word.bbox.y0 / scale, width: (word.bbox.x1 - word.bbox.x0) / scale, height: (word.bbox.y1 - word.bbox.y0) / scale }));
          boxes = rasterBoxes(canvas, scale);
        }
      }
      if (!text.trim()) {
        pages.push({ page: number, text: '', method: 'skipped', confidence, reason: confidence !== null && confidence < 35 && confidence > 0 ? 'unreadable' : 'blank' });
        page.cleanup();
        continue;
      }
      total += text.length;
      if (total > MAX_TEXT) throw new Error('pdfImport.tooMuchText');
      pages.push({ page: number, text, method, confidence });
      geometryPages.push({ number, width: display.width, height: display.height, items: positioned, boxes });
      page.cleanup();
    }
    if (total < 80) throw new Error('pdfImport.unreadable');
    const { splitPdfSections } = await import(pathToFileURL(path.resolve(__dirname, '../../src/lib/pdfImport.js')).href);
    const text = pages.filter(page => page.text).map(page => page.text).join('\n\n');
    const { fields, found } = splitPdfSections(text);
    // Superscripts can sort above a preceding section heading. Use the bounded
    // source stream for these two prose fields when all delimiters were recovered.
    const stream = splitPdfSections(sourceStreams.join('\n'));
    if (['description', 'prereq', 'credits'].every(key => stream.found.includes(key))) {
      fields.description = stream.fields.description.replace(/\s+/g, ' ').trim();
      fields.prereq = stream.fields.prereq.replace(/(\d)\s+(st|nd|rd|th)\b/gi, '$1$2').replace(/\s+/g, ' ').trim();
    }
    if (cloDone && cloColumn.some(text => /CLO\s*\d+[.:]/i.test(text))) fields.clos = cloColumn.join('\n').trim();
    const layout = recoverTables(geometryPages);
    Object.assign(fields, layout.fields);
    if (layout.planRows.length) fields.plan = layout.planRows.map(row => [row.week, row.ilo, row.contents, row.activities, row.tasks, row.values].map(cell => cell.replace(/\n/g, ' ')).join(' | ')).join('\n');
    else if (fields.plan?.trim()) layout.warnings.push({ code: 'plan_layout_not_recovered' });
    if (found.length < 2) throw new Error('pdfImport.noSections');
    parentPort.postMessage({ fields, found, text, layout: { version: 2, planRows: layout.planRows, warnings: layout.warnings }, pages: pages.map(({ page, method, confidence, reason }) => ({ page, method, confidence, ...(reason ? { reason } : {}) })), requiresReview: true, aiCheckTriggered: false });
  } catch (error) {
    if (process.env.PDF_IMPORT_DEBUG === '1') console.error(error.stack);
    const message = encrypted || error.name === 'PasswordException' ? 'pdfImport.encrypted' : error.message?.startsWith('pdfImport.') ? error.message : 'pdfImport.unreadable';
    parentPort.postMessage({ error: message });
  } finally {
    if (ocr) await ocr.terminate().catch(() => {});
    if (task) await task.destroy().catch(() => {});
  }
})();
