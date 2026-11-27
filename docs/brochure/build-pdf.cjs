'use strict';
// Builds the brochure PDFs from project/*.dc.html (the same files the Design canvas uses).
//   node docs/brochure/build-pdf.cjs   -> syllabus-system-brochure-A4.pdf (exact A4, for submission and office printers)
//                                          syllabus-system-brochure-A4-bleed.pdf (3 mm bleed with crop and fold marks, for a print shop)
// Needs an internet connection once, for the Archivo font.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(path.resolve(__dirname, '../../node_modules/playwright-core'));
const PROJECT = path.join(__dirname, 'project');
const MM = 96 / 25.4, W = 297, H = 210, BLEED = 3, SLUG = 9; // mm
const PAGES = [
  { file: 'Main.dc.html', folds: [367, 745], bg: [['#EEF1FB', 367], ['#FFFFFF', 745], ['#1A2196', 1123]] },
  { file: 'Inside.dc.html', folds: [378, 756], bg: [['#EEF1FB', 378], ['#FFFFFF', 1123]] },
];
const inner = (f) => { const s = fs.readFileSync(path.join(PROJECT, f), 'utf8'); return s.slice(s.indexOf('</helmet>') + 9, s.indexOf('</x-dc>')); };
const head = `<meta charset="utf-8"><title>AI-Powered Web-Based Syllabus Management System</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&display=swap">`;
const base = '*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0}.page{position:relative;overflow:hidden;break-after:page}.page:last-child{break-after:auto}';

function trim() {
  return `<!doctype html><html lang="en"><head>${head}<style>@page{size:${W}mm ${H}mm;margin:0}${base}.page{width:${W}mm;height:${H}mm}</style></head><body>${PAGES.map((p) => `<div class="page">${inner(p.file)}</div>`).join('')}</body></html>`;
}

function bleed() {
  const o = BLEED + SLUG, pw = W + 2 * o, ph = H + 2 * o;
  const marks = (p) => {
    const line = (x1, y1, x2, y2, dash) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-width="0.2"${dash ? ' stroke-dasharray="1 0.8"' : ''}/>`;
    let s = '';
    for (const x of [o, o + W]) s += line(x, 0.5, x, SLUG - 2) + line(x, ph - SLUG + 2, x, ph - 0.5);
    for (const y of [o, o + H]) s += line(0.5, y, SLUG - 2, y) + line(pw - SLUG + 2, y, pw - 0.5, y);
    for (const f of p.folds) { const x = o + f / MM; s += line(x, 0.5, x, SLUG - 2, true) + line(x, ph - SLUG + 2, x, ph - 0.5, true); }
    return `<svg style="position:absolute;inset:0" width="${pw}mm" height="${ph}mm" viewBox="0 0 ${pw} ${ph}">${s}</svg>`;
  };
  const bgs = (p) => p.bg.map(([c, end], i) => {
    const start = i ? p.bg[i - 1][1] / MM : -BLEED, stop = i === p.bg.length - 1 ? W + BLEED : end / MM;
    return `<div style="position:absolute;left:${o + start}mm;top:${SLUG}mm;width:${stop - start}mm;height:${H + 2 * BLEED}mm;background:${c}"></div>`;
  }).join('');
  return `<!doctype html><html lang="en"><head>${head}<style>@page{size:${pw}mm ${ph}mm;margin:0}${base}.page{width:${pw}mm;height:${ph}mm}</style></head><body>${PAGES.map((p) => `<div class="page">${bgs(p)}<div style="position:absolute;left:${o}mm;top:${o}mm;width:${W}mm;height:${H}mm;overflow:hidden">${inner(p.file).replace('background: #FFFFFF; color: #0F1658', 'color: #0F1658')}</div>${marks(p)}</div>`).join('')}</body></html>`;
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROCHURE_BROWSER || 'chrome', headless: true });
  for (const [name, html] of [['syllabus-system-brochure-A4.pdf', trim()], ['syllabus-system-brochure-A4-bleed.pdf', bleed()]]) {
    const tmp = path.join(PROJECT, '.print.html'); fs.writeFileSync(tmp, html);
    const page = await browser.newPage();
    const fontOk = () => page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => f.family.includes('Archivo') && f.status === 'loaded'); });
    let ok = false;
    for (let i = 0; i < 6 && !ok; i++) { await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' }); ok = await fontOk(); }
    if (!ok) { fs.unlinkSync(tmp); throw new Error('the Archivo font could not be loaded: check the internet connection and run again'); }
    const report = await page.evaluate(() => ({
      font: document.fonts.check('800 20px Archivo') && [...document.fonts].some((f) => f.family.includes('Archivo') && f.status === 'loaded'),
      // any panel whose content is taller than the panel would be cut off in print
      overflow: [...document.querySelectorAll('section')].map((s) => { const bottom = s.getBoundingClientRect().bottom - 40; return Math.round(Math.max(...[...s.querySelectorAll('*')].map((e) => e.getBoundingClientRect().bottom)) - bottom); }),
      wide: [...document.querySelectorAll('section')].map((s) => { const right = s.getBoundingClientRect().right - 32; return Math.round(Math.max(...[...s.querySelectorAll('*')].map((e) => e.getBoundingClientRect().right)) - right); }),
      images: [...document.images].every((i) => i.complete && i.naturalWidth > 0),
    }));
    await page.pdf({ path: path.join(__dirname, name), preferCSSPageSize: true, printBackground: true });
    if (process.argv[2]) { await page.setViewportSize({ width: 1260, height: 900 }); for (const [i, el] of (await page.locator('.page').all()).entries()) await el.screenshot({ path: path.join(process.argv[2], name.replace('.pdf', '') + '-' + (i + 1) + '.png'), scale: 'css' }); }
    await page.close(); fs.unlinkSync(tmp);
    console.log(name, JSON.stringify(report));
  }
  await browser.close();
})();
