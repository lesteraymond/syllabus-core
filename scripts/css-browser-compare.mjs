// Real-browser check that two stylesheets give every element the same computed style.
// For each selector in the CSS (without pseudo-classes) it builds a matching element, reads getComputedStyle, and compares the two stylesheets
// at a wide and a narrow window.
// usage: node scripts/css-browser-compare.mjs <before.css> <after.css> [<theme.css>]   (npm run css:browser-compare -- ...)
// Give it the BUILT css of two builds (npm run build, then copy dist/assets/*.css). Needs Edge or Chrome (EDGE_PATH); exits 1 on any difference.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const require = createRequire(new URL('../package.json', import.meta.url)); // resolves postcss from the repository
const postcss = require('postcss');
const [, , beforeCss, afterCss, themeCss] = process.argv;
const dir = path.dirname(beforeCss);
const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'; // any Chromium works: set EDGE_PATH

// every selector worth testing, from the BEFORE file (a selector lost by the cleanup would show up as a different computed style)
const selectors = new Set();
const root = postcss.parse(fs.readFileSync(beforeCss, 'utf8'));
root.walkRules((rule) => {
  for (let p = rule.parent; p && p.type !== 'root'; p = p.parent) if (p.type === 'atrule' && /keyframes|font-face/i.test(p.name)) return;
  rule.selectors.forEach((s) => { s = s.replace(/\s+/g, ' ').trim(); if (s && !/:/.test(s) && !s.includes('*')) selectors.add(s); });
});
if (themeCss) postcss.parse(fs.readFileSync(themeCss, 'utf8')).walkRules((rule) => rule.selectors.forEach((s) => { s = s.replace(/\s+/g, ' ').trim(); if (s && !/:/.test(s) && !s.includes('*')) selectors.add(s); }));
const list = [...selectors];

const page = (css, theme) => `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${css}">${theme ? `<link rel="stylesheet" href="${theme}">` : ''}</head><body><div id="stage"></div><pre id="out"></pre><script>
const SELECTORS = ${JSON.stringify(list)}; const DEBUG = ${JSON.stringify(process.env.DEBUG_SELECTORS ? JSON.parse(process.env.DEBUG_SELECTORS) : [])};
function compounds(sel) { // [{ comb, text }]
  const out = []; let cur = '', depth = 0, comb = ' ';
  const flush = () => { if (cur) { out.push({ comb, text: cur }); cur = ''; } };
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (c === '[' || c === '(') depth++; if (c === ']' || c === ')') depth--;
    if (!depth && (c === ' ' || c === '>' || c === '+' || c === '~')) { flush(); if (c !== ' ') comb = c; else if (!'>+~'.includes(comb)) comb = ' '; continue; }
    if (!depth && out.length >= 0 && cur === '' && '>+~'.includes(comb) && c !== ' ') { /* start of a compound after an explicit combinator */ }
    cur += c;
    if (cur.length && !depth) { /* keep reading */ }
    // after a compound was flushed by a combinator, the next compound starts with that combinator
    if (cur.length === 1) { /* nothing */ }
    if (i === sel.length - 1) flush();
    if (cur === '' ) comb = comb;
  }
  return out;
}
function parseCompound(t) {
  const el = { tag: 'div', id: '', classes: [], attrs: [] };
  const m = /^[a-zA-Z][a-zA-Z0-9-]*/.exec(t); if (m) { el.tag = m[0]; t = t.slice(m[0].length); }
  const re = /#([\\w-]+)|\\.([\\w-]+)|\\[([^\\]=~^$*|]+)(?:([~^$*|]?=)"?([^"\\]]*)"?)?\\]/g; let x;
  while ((x = re.exec(t))) { if (x[1]) el.id = x[1]; else if (x[2]) el.classes.push(x[2]); else el.attrs.push([x[3], x[5] === undefined ? '' : x[5]]); }
  return el;
}
function make(d) { const e = document.createElement(['svg','path','rect'].includes(d.tag) ? 'div' : d.tag); if (d.id) e.id = d.id; d.classes.forEach((c) => e.classList.add(c)); d.attrs.forEach(([k, v]) => e.setAttribute(k, v)); return e; }
function build(sel) {
  const parts = []; const re = /\\s*([>+~])\\s*|\\s+/g; let last = 0, comb = ' '; let depth = 0; let buf = ''; const toks = [];
  for (let i = 0; i < sel.length; i++) { const c = sel[i]; if (c === '[' || c === '(') depth++; if (c === ']' || c === ')') depth--;
    if (!depth && (c === '>' || c === '+' || c === '~')) { if (buf.trim()) toks.push({ comb, text: buf.trim() }); buf = ''; comb = c; continue; }
    if (!depth && c === ' ') { if (buf.trim()) { toks.push({ comb, text: buf.trim() }); buf = ''; comb = ' '; } continue; }
    buf += c; }
  if (buf.trim()) toks.push({ comb, text: buf.trim() });
  const stage = document.getElementById('stage'); stage.textContent = '';
  let parent = stage, prev = null, target = null;
  toks.forEach((t, i) => { const e = make(parseCompound(t.text));
    if (i === 0) parent.appendChild(e);
    else if (t.comb === '+' || t.comb === '~') { prev.parentNode.appendChild(e); }
    else { prev.appendChild(e); }
    prev = e; target = e; });
  return target;
}
function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h; }
const res = {};
for (const sel of SELECTORS) {
  let el; try { el = build(sel); } catch (e) { continue; }
  if (!el || !el.matches(sel)) continue;
  const cs = getComputedStyle(el); const parts = []; for (const p of cs) parts.push(p + ':' + cs.getPropertyValue(p)); parts.sort();
  res[sel] = hash(parts.join(';')) + ':' + parts.length + (DEBUG.includes(sel) ? '|' + parts.join(';') : '');
}
document.getElementById('out').textContent = JSON.stringify(res);
</script></body></html>`;

function run(name, css, theme, width) {
  const html = path.join(dir, name + '.html');
  fs.writeFileSync(html, page(path.basename(css), theme ? path.basename(theme) : ''));
  const r = spawnSync(EDGE, ['--headless=new', '--disable-gpu', '--no-sandbox', `--window-size=${width},900`, '--virtual-time-budget=30000', '--dump-dom', 'file:///' + html.replace(/\\/g, '/')], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const m = /<pre id="out">([\s\S]*?)<\/pre>/.exec(r.stdout || '');
  if (!m) throw new Error('no output from the browser: ' + (r.stderr || '').slice(0, 300));
  return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
}

let bad = 0;
for (const width of [1400, 600]) {
  const a = run('before-' + width, beforeCss, themeCss, width);
  const b = run('after-' + width, afterCss, themeCss, width);
  const keys = Object.keys(a);
  const diff = keys.filter((k) => a[k] !== b[k]);
  console.log(`width ${width}: ${keys.length} elements built and compared, ${diff.length} differ`);
  diff.slice(0, 10).forEach((k) => console.log('  DIFF', k));
  const props = (v) => Object.fromEntries(v.split('|')[1].split(';').map((x) => [x.slice(0, x.indexOf(':')), x.slice(x.indexOf(':') + 1)]));
  for (const k of diff) if (a[k].includes('|')) { const pa = props(a[k]); const pb = props(b[k]); for (const q of new Set([...Object.keys(pa), ...Object.keys(pb)])) if (pa[q] !== pb[q]) console.log('   ', k, '|', q, ':', JSON.stringify(pa[q]), '->', JSON.stringify(pb[q])); }
  bad += diff.length;
}
console.log('selectors in the stylesheet (no pseudo-classes):', list.length);
process.exit(bad ? 1 : 0);
