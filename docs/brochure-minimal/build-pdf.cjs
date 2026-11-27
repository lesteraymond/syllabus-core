'use strict';
// Builds the print-ready A4 PDF from project/*.dc.html (the same files the Design canvas uses).
//   node docs/brochure-minimal/build-pdf.cjs [folder for preview images]
// Print double-sided, landscape, "flip on short edge", at 100% size. Needs the internet once, for the Geist fonts.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(path.resolve(__dirname, '../../node_modules/playwright-core'));
const ASSETS = { // uploaded file on the canvas -> the same file in assets/
  'c73dcd3dd6e920ed9b7699c68eee0a2f': 'k-dash-dark.png', '47b2f47665beed46255435bfde1e684b': 'k-decision-dark.png', 'fb0016daf358f8ea3f21e4880e2d4a95': 'k-live-dark.png', 'a31b1b4c76aa80bafdac2c1d70480165': 'k-plan-dark.png', 'fd2150422a4a4c65543dcde7dfba03b4': 'k-progress-dark.png', '0eea14b541799be816aaeccf38a81c05': 'k-repo-dark.png', '0d215b085bacede858362287d7140064': 'k-result-dark.png',
  fb8dcab0b0a0e2faf6aee258e8a4efc7: 'GeistPixel-Square.woff2', be7478a1493a8d66bdd806de157450a5: 'c-dash-print.png', '5d33f3a7231dc67a3c8afce97df745d9': 'cite-logo.png',
  fd9a5ec3923db292ece2820bd3a4d019: 'halftone-card-dark.svg', '0141ff659f391a223332e55e10809871': 'halftone-cover-dark.svg',
  '457595343e016d8022e1d55ffcaa2cfb': 'k-decision.png', db1cc64025ca8714c0bef28c2fc7ec56: 'k-plan.png', '0673fc81f0d96d59462e1de13f8399a4': 'k-progress.png',
  '848c8814ea68366b7d20805f18fdccd7': 'k-repo.png', '6d758161df93bea94422261255d23ee7': 'k-result.png', f17b3bc811f8a97657d26b651871c953: 'k-live.png', '9dc2205fd968a6d721c81a2a90b1d969': 'lcup-logo.png',
};
const local = (s) => s.replace(/\/_blob\/([0-9a-f]{32})/g, (m, id) => { if (!ASSETS[id]) throw new Error('unknown asset ' + id); return 'assets/' + ASSETS[id]; });
const read = (f) => local(fs.readFileSync(path.join(__dirname, 'project', f), 'utf8'));
const cut = (s, a, b) => s.slice(s.indexOf(a) + a.length, s.indexOf(b));
const pages = ['Main.dc.html', 'Inside.dc.html'].map(read);
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>AI-Powered Web-Based Syllabus Management System</title>${cut(pages[0], '<helmet>', '</helmet>')}<style>@page{size:297mm 210mm;margin:0}html,body,.page{background:#0c0c0f}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{width:297mm;height:210mm;overflow:hidden;break-after:page}.page:last-child{break-after:auto}</style></head><body>${pages.map((p) => `<div class="page">${cut(p, '</helmet>', '</x-dc>')}</div>`).join('')}</body></html>`;
(async () => {
  const tmp = path.join(__dirname, '.print.html'); fs.writeFileSync(tmp, html);
  const browser = await chromium.launch({ channel: process.env.BROCHURE_BROWSER || 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1123, height: 1588 }, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
  const report = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      fonts: ['400 23px "Geist Pixel"', '500 14px Geist', '400 12px "Geist Mono"'].map((f) => [f, document.fonts.check(f)]),
      panels: [...document.querySelectorAll('section')].map((s) => { // px past the panel's own padding (0 or less is fine)
        const r = s.getBoundingClientRect(), c = getComputedStyle(s), kids = [...s.querySelectorAll('*')].filter((e) => getComputedStyle(e).position !== 'absolute');
        return { down: Math.round(Math.max(...kids.map((e) => e.getBoundingClientRect().bottom)) - (r.bottom - parseFloat(c.paddingBottom))), right: Math.round(Math.max(...kids.map((e) => e.getBoundingClientRect().right)) - (r.right - parseFloat(c.paddingRight))),
          gap: [...s.children].filter((e) => getComputedStyle(e).position !== 'absolute').map((e, i, a) => (i ? Math.round(e.getBoundingClientRect().top - a[i - 1].getBoundingClientRect().bottom) : null)).slice(1) };
      }),
      images: [...document.images].every((i) => i.complete && i.naturalWidth > 0),
    };
  });
  await page.pdf({ path: path.join(__dirname, 'syllabus-brochure-A4.pdf'), preferCSSPageSize: true, printBackground: true });
  if (process.argv[2]) for (const [i, el] of (await page.locator('.page').all()).entries()) await el.screenshot({ path: path.join(process.argv[2], `side-${i + 1}.png`) });
  // print-shop version: the same pages with 3 mm of black bleed on every side (303 x 216 mm, trims to A4); the cover dots run into the bleed
  await page.addStyleTag({ content: '@page{size:303mm 216mm}.page{box-sizing:border-box;width:303mm;height:216mm;padding:3mm}.page>div,.page>div>section:last-child{overflow:visible!important}.page:first-of-type>div>section:last-child>img:first-child{right:-3mm!important;bottom:-3mm!important}' });
  const bleed = (await page.content()).replace('size:297mm 210mm', 'size:303mm 216mm'); // the first @page rule wins otherwise
  fs.writeFileSync(tmp, bleed); await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' }); await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(__dirname, 'syllabus-brochure-A4-bleed.pdf'), preferCSSPageSize: true, printBackground: true });
  if (process.argv[2]) for (const [i, el] of (await page.locator('.page').all()).entries()) await el.screenshot({ path: path.join(process.argv[2], `bleed-${i + 1}.png`), scale: 'css' });
  await browser.close(); fs.unlinkSync(tmp);
  console.log(JSON.stringify(report, null, 1));
})();
