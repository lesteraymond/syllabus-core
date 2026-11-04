// Local-only source evidence. Explicit allowlist excludes IT-101.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const pdfjs = await import('../../server/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
const { positionedText, vectorBoxes } = require('../../server/lib/pdfGeometry');
const { recoverTables, tableBands, textLines } = require('../../server/lib/pdfLayout');
const { extractPdf } = require('../../server/lib/pdfImport');
const { createCanvas } = require('../../server/node_modules/@napi-rs/canvas');
export const root = path.resolve(import.meta.dirname, '../..');
export const out = path.join(root, 'docs/lcup-approved-offline');
export const sources = [
  ['it202', 'IT-202-Programming-1.pdf', 'BSIT'],
  ['ie402', 'IE402-SYSTEM-ENGINEERINGS.pdf', 'BSIE'],
  ['cpe304', 'CPE-304-Fundamentals-of-Mixed-Signals-and-Sensors.pdf', 'BSCPE'],
  ['ie403', 'IE-403-Operation-Management.pdf', 'BSIE'],
  ['cpe404', 'CPE-404-Digital-Signal-Processing.pdf', 'BSCPE'],
];
export const sha = b => createHash('sha256').update(b).digest('hex');
export const write = async (name, value) => { await fs.mkdir(out, { recursive: true }); await fs.writeFile(path.join(out, name), JSON.stringify(value, null, 2) + '\n'); };
export async function extract([key, file, program], render = false, { persist = true } = {}) {
  const bytes = await fs.readFile(path.join(root, 'docs/academic-references', file));
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: true });
  const pdf = await task.promise, pages = [], geometry = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n), viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const tokens = content.items.filter(i => typeof i.str === 'string').map(i => ({ text: i.str, x: i.transform[4], y: i.transform[5], width: i.width, height: i.height, eol: i.hasEOL }));
    pages.push({ page: n, width: viewport.width, height: viewport.height, tokens,
      stream: tokens.map(i => i.text + (i.eol ? '\n' : ' ')).join('') });
    geometry.push({ number: n, width: viewport.width, height: viewport.height,
      items: positionedText(content.items, viewport), boxes: vectorBoxes(await page.getOperatorList(), pdfjs, viewport) });
    if (render && n <= (['ie403', 'cpe404'].includes(key) ? 3 : pdf.numPages)) {
      const view = page.getViewport({ scale: 1.25 }), canvas = createCanvas(Math.ceil(view.width), Math.ceil(view.height));
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: view }).promise;
      await fs.mkdir(path.join(out, 'review'), { recursive: true });
      await fs.writeFile(path.join(out, 'review', `${key}-p${n}.png`), canvas.toBuffer('image/png'));
    }
  }
  await task.destroy();
  const layout = recoverTables(geometry);
  const production = await extractPdf(bytes);
  const tables = geometry.flatMap(page => tableBands(page).map(band => ({ page: page.number, top: band.top, bottom: band.bottom, xs: band.xs,
    cells: band.xs.slice(0, -1).map((_, i) => {
      const items = page.items.filter(item => {
        const x = item.x + Math.min(item.width / 2, 3), y = item.y + item.height / 2;
        return x >= band.xs[i] - 1 && x < band.xs[i + 1] - 1 && y > band.top + 1 && y < band.bottom - 1;
      });
      return { text: textLines(items).join('\n'), items };
    }) })));
  const result = { key, file, program, sha256: sha(bytes), pages, tables, layout, production };
  if (persist) {
    await write(`${key}.source.json`, result);
    await fs.writeFile(path.join(out, `${key}.source.txt`), pages.map(p => `PAGE ${p.page}\n${p.stream}`).join('\n'));
  }
  return result;
}
if (process.argv[1] === import.meta.filename) {
  for (const s of sources) {
    const r = await extract(s, true);
    console.log(JSON.stringify({ key: r.key, pages: r.pages.length, fields: r.layout.fields, rows: r.layout.planRows.map(p => ({ week: p.week, ilo: p.ilo, pages: p.sourcePages })) }));
  }
}
