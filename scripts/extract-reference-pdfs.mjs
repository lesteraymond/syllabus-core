// Read-only local PDF extraction and page rendering for source verification.
import fs from 'node:fs/promises';
import path from 'node:path';
import { getDocument } from '../tmp/reference-tools/node_modules/pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '../tmp/reference-tools/node_modules/@napi-rs/canvas/index.js';
const destination = path.resolve('tmp/reference-extract');
await fs.mkdir(destination, { recursive: true });
for (const file of ['IT-202-Programming-1.pdf', 'IE402-SYSTEM-ENGINEERINGS.pdf', 'CPE-304-Fundamentals-of-Mixed-Signals-and-Sensors.pdf']) {
  const task = getDocument({ data: new Uint8Array(await fs.readFile(path.join('reference-data', file))), useSystemFonts: true });
  const pdf = await task.promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const text = await page.getTextContent();
    const lines = [];
    for (const item of text.items) {
      const y = Math.round(item.transform[5] * 2) / 2;
      let line = lines.find(line => Math.abs(line.y - y) < 2);
      if (!line) { line = { y, items: [] }; lines.push(line); }
      line.items.push({ x: item.transform[4], str: item.str });
    }
    pages.push({ page: n, text: lines.sort((a, b) => b.y - a.y).map(line => line.items.sort((a, b) => a.x - b.x).map(item => item.str).join(' ')).join('\n') });
    if (n <= 3) {
      const viewport = page.getViewport({ scale: 1.7 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      await fs.writeFile(path.join(destination, `${file}-page${n}.png`), canvas.toBuffer('image/png'));
    }
  }
  await fs.writeFile(path.join(destination, `${file}.json`), JSON.stringify(pages, null, 2));
  await fs.writeFile(path.join(destination, `${file}.txt`), pages.map(p => `PAGE ${p.page}\n${p.text}`).join('\n\n'));
  console.log(JSON.stringify({ file, pages: pdf.numPages, textCharacters: pages.reduce((sum, p) => sum + p.text.length, 0) }));
  await task.destroy();
}
