'use strict';
// Builds syllabus-brochure.html (single-file, print-ready, Letter landscape) from project/*.dc.html, the same files the Design canvas uses.
//   node docs/brochure-letter/build.cjs
// Screenshots are read from ./screenshots/ beside the HTML file; a missing one shows its labelled frame instead.
const fs = require('node:fs');
const path = require('node:path');
const inner = (f) => { const s = fs.readFileSync(path.join(__dirname, 'project', f), 'utf8'); return s.slice(s.indexOf('</helmet>') + 9, s.indexOf('</x-dc>')).trim(); };
const page = (f) => inner(f).replaceAll('src="screenshots/', 'src="./screenshots/').replaceAll('<img ', '<img onerror="this.style.display=\'none\'" ');
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI-Powered Web-Based Syllabus Management System: Tri-Fold Brochure</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
<style>
@page { size: letter landscape; margin: 0; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; background: #FFFFFF; }
.toolbar { font-family: 'Plus Jakarta Sans', Inter, Arial, sans-serif; color: #0F172A; }
.page { position: relative; width: 11in; height: 8.5in; overflow: hidden; background: #FFFFFF; break-after: page; break-inside: avoid; }
.page:last-of-type { break-after: auto; }
@media screen {
  body { background: #F8FAFC; display: flex; flex-direction: column; align-items: center; gap: 32px; padding: 0 24px 48px; min-width: 11in; box-sizing: border-box; }
  .toolbar { position: sticky; top: 0; z-index: 2; box-sizing: border-box; width: 11in; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; background: #F8FAFC; border-bottom: 1px solid #E2E8F0; font-size: 13px; }
  .toolbar button { min-height: 44px; padding: 0 20px; border: 0; border-radius: 6px; background: #2563EB; color: #FFFFFF; font: inherit; font-weight: 700; cursor: pointer; }
  .toolbar button:hover { background: #0F172A; }
  .toolbar button:focus-visible { outline: 2px solid #0F172A; outline-offset: 2px; }
  .page { outline: 1px solid #E2E8F0; }
  .page::before, .page::after { content: ''; position: absolute; top: 0; bottom: 0; width: 0; border-left: 1px dashed #2563EB; opacity: 0.35; z-index: 1; pointer-events: none; }
  .page::before { left: 33.3333%; }
  .page::after { left: 66.6667%; }
}
@media print { .toolbar { display: none; } }
</style>
</head>
<body>
<div class="toolbar"><span>Letter landscape, two pages. Dashed fold lines show on screen only.</span><button type="button" onclick="window.print()">Print or save as PDF</button></div>
<main class="page" aria-label="Page 1, outside">
${page('Main.dc.html')}
</main>
<main class="page" aria-label="Page 2, inside">
${page('Inside.dc.html')}
</main>
</body>
</html>
`.replaceAll('<main class="page"', '<div class="page" role="group"').replaceAll('</main>', '</div>');
fs.writeFileSync(path.join(__dirname, 'syllabus-brochure.html'), html);
console.log('wrote syllabus-brochure.html', html.length);
