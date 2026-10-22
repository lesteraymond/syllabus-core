// Proves a converted stylesheet is equivalent to the original: both are compiled by Tailwind (the real build step), flattened into the
// list of style rules, and compared rule by rule: the same selector in the same at-rule context in the same position; the same value for
// every declaration (spacing around commas and slashes aside); the same !important flags; and the same relative order for any two
// properties of the same family (shorthand / longhand / aliases), the only case where order can change the result.
// usage: node scripts/css-equivalence.mjs <before.css> <after.css>   (npm run css:equivalence -- <before.css> <after.css>); exits 1 on any difference
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../', import.meta.url)).replaceAll('\\', '/'); // the repository root
const require = createRequire(ROOT + 'package.json');
const postcss = require('postcss');
const { compile } = require('@tailwindcss/node');
const [, , beforeFile, afterFile, themeFile = ROOT + 'src/theme.css'] = process.argv;

const dir = ROOT + 'src/__equiv/';
fs.mkdirSync(dir, { recursive: true });
fs.copyFileSync(ROOT + 'src/tw-theme.css', dir + 'tw-theme.css');
fs.copyFileSync(themeFile, dir + 'theme.css');
const entry = (name) => `@layer theme, base, legacy, components, utilities;\n@import "./tw-theme.css" layer(theme) prefix(tw);\n@import "tailwindcss/utilities.css" layer(utilities);\n@import "./${name}" layer(legacy);\n@import "./theme.css" layer(legacy);\n`;
async function compiled(file, name) {
  fs.copyFileSync(file, dir + name);
  const c = await compile(entry(name), { base: dir, onDependency() {} });
  return c.build([]);
}
let before, after;
try { before = await compiled(beforeFile, 'before.css'); after = await compiled(afterFile, 'after.css'); }
finally { fs.rmSync(dir, { recursive: true, force: true }); }

const FAMILY = { 'line-height': 'font', 'row-gap': 'gap', 'column-gap': 'gap', 'grid-gap': 'gap', 'grid-row-gap': 'gap', 'grid-column-gap': 'gap', 'place-content': 'content', 'align-content': 'content', 'justify-content': 'content', 'place-items': 'items', 'align-items': 'items', 'justify-items': 'items', 'place-self': 'self', 'align-self': 'self', 'justify-self': 'self', top: 'inset', right: 'inset', bottom: 'inset', left: 'inset', width: 'size', height: 'size', 'min-width': 'size', 'max-width': 'size', 'min-height': 'size', 'max-height': 'size', 'inline-size': 'size', 'block-size': 'size', columns: 'column', 'overflow-wrap': 'wrapalias', 'word-wrap': 'wrapalias' };
const family = (p) => (p.startsWith('--') ? p : FAMILY[p] || p.split('-')[0]);
const canon = (v) => v.toLowerCase().replace(/\s+/g, ' ').replace(/\s*([,/])\s*/g, '$1').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();

function flatten(text) {
  const out = [];
  postcss.parse(text).walkRules((rule) => {
    const ctx = [];
    for (let p = rule.parent; p && p.type !== 'root'; p = p.parent) if (p.type === 'atrule') ctx.unshift('@' + p.name + ' ' + p.params.replace(/\s+/g, ' ').trim());
    if (ctx.some((c) => /@keyframes|@font-face|@property/.test(c))) return;
    out.push({ ctx: ctx.join(' > '), selector: rule.selector.replace(/\s+/g, ' ').trim(), decls: rule.nodes.filter((n) => n.type === 'decl').map((d) => ({ prop: d.prop.toLowerCase(), value: canon(d.value), important: !!d.important })), nested: rule.nodes.filter((n) => n.type === 'rule' || n.type === 'atrule').map((n) => (n.type === 'rule' ? n.selector : '@' + n.name + ' ' + n.params).slice(0, 90)).join(' | ') });
  });
  return out;
}
const A = flatten(before), B = flatten(after);
const problems = [];
const note = (m) => { if (problems.length < 25) problems.push(m); problems.total = (problems.total || 0) + 1; };
if (A.length !== B.length) note(`rule count ${A.length} vs ${B.length}`);
let declsCompared = 0, orderPairs = 0;
for (let i = 0; i < Math.min(A.length, B.length); i++) {
  const a = A[i], b = B[i];
  if (a.ctx !== b.ctx || a.selector !== b.selector) { note(`rule #${i}: ${a.ctx} ${a.selector}  vs  ${b.ctx} ${b.selector}`); break; }
  if (a.nested !== b.nested) note(`rule #${i} ${b.selector}: nested blocks differ: before [${a.nested}] after [${b.nested}]`);
  // every property: the same list of values, in order
  const props = new Set([...a.decls.map((d) => d.prop), ...b.decls.map((d) => d.prop)]);
  for (const p of props) {
    const va = a.decls.filter((d) => d.prop === p).map((d) => d.value + (d.important ? '!' : ''));
    const vb = b.decls.filter((d) => d.prop === p).map((d) => d.value + (d.important ? '!' : ''));
    declsCompared += Math.max(va.length, vb.length);
    if (JSON.stringify(va) !== JSON.stringify(vb)) note(`${a.ctx} ${a.selector} { ${p} }: ${JSON.stringify(va)}  vs  ${JSON.stringify(vb)}`);
  }
  // the relative order of every pair of declarations of one family
  const pos = (decls) => decls.map((d, k) => ({ ...d, k }));
  const pa = pos(a.decls), pb = pos(b.decls);
  for (let x = 0; x < pa.length; x++) for (let y = x + 1; y < pa.length; y++) {
    if (family(pa[x].prop) !== family(pa[y].prop)) continue;
    orderPairs++;
    const ix = pb.findIndex((d) => d.prop === pa[x].prop && d.value === pa[x].value), iy = pb.findIndex((d, k) => d.prop === pa[y].prop && d.value === pa[y].value && k !== ix);
    if (ix < 0 || iy < 0 || ix > iy) note(`${a.ctx} ${a.selector}: the order of ${pa[x].prop} and ${pa[y].prop} changed`);
  }
}
console.log(JSON.stringify({ rulesBefore: A.length, rulesAfter: B.length, declarationsCompared: declsCompared, orderedPairsChecked: orderPairs, problems: problems.total || 0 }));
problems.forEach((p) => console.log('  ' + String(p).slice(0, 260)));
process.exit(problems.total ? 1 : 0);
