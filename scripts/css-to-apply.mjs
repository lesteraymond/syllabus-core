// Rewrites the declarations of a plain stylesheet as Tailwind @apply statements, keeping every selector, at-rule, class name and the
// order of rules exactly as they are, so no markup changes. Equivalence is proven separately (css-equivalence.mjs).
//
// Rules the codemod follows, each learned from a probe of the compiler:
//  - a declaration becomes a real utility only when that utility emits exactly that one declaration (tw:grid for display: grid);
//    otherwise it becomes an arbitrary property with the identical text (tw:[padding:14px]);
//  - Tailwind REORDERS the utilities inside one @apply, and a shorthand must stay before its longhands, so two declarations of the
//    same family (border / border-color, padding / padding-right, font / line-height ...) never share an @apply: the order of the
//    statements is the original order of the declarations;
//  - variants (hover:, md:) are never used: hover: adds a (hover: hover) media wrapper, and the app's breakpoints are its own;
//  - left as written: custom properties and !important; vendor-prefixed and quoted/url() values; a property repeated in one rule (a
//    fallback pair); whole rules that use a modern colour function (color-mix, oklch ...), because Tailwind would wrap them in an @supports fallback; @font-face, @keyframes, print rules; the printed syllabus form (.paper); and rules with no class or id (the
//    base element rules).
// usage: node scripts/css-to-apply.mjs <in.css> <out.css>     (npm run css:to-apply -- <in.css> <out.css>)
// Then prove it: node scripts/css-equivalence.mjs <original.css> <out.css>
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../', import.meta.url)).replaceAll('\\', '/'); // the repository root
const require = createRequire(ROOT + 'package.json');
const postcss = require('postcss');
const tw = require('tailwindcss');
const [, , inFile, outFile] = process.argv;
if (!inFile || !outFile) { console.error('usage: node scripts/css-to-apply.mjs <in.css> <out.css>'); process.exit(2); }

// ---- the real utilities that emit exactly one declaration, with no Tailwind variable in it
const loadStylesheet = async (id, base) => {
  const file = id.startsWith('tailwindcss') ? require.resolve(id) : path.resolve(base, id);
  return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
};
// the same design system the app builds with (src/tailwind.css): the tw: prefix, the token theme, Tailwind's utilities
const ds = await tw.__unstable__loadDesignSystem('@import "./tw-theme.css" prefix(tw);\n@import "tailwindcss/utilities.css";', { base: ROOT + 'src', loadStylesheet });
const names = ds.getClassList().map((c) => c[0]).filter((n) => !n.startsWith('-') && !/\[/.test(n));
const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
const index = new Map(); // "prop: value" -> class
for (let i = 0; i < names.length; i += 400) {
  const chunk = names.slice(i, i + 400).map((n) => 'tw:' + n);
  const css = ds.candidatesToCss(chunk);
  css.forEach((text, k) => {
    if (!text || /@property|@media|@supports|&|--tw-|var\(--tw/.test(text)) return;
    const decls = [];
    postcss.parse(text).walkDecls((d) => decls.push(d));
    if (decls.length !== 1 || decls[0].important) return;
    const key = decls[0].prop.toLowerCase() + ': ' + norm(decls[0].value);
    const cls = chunk[k];
    if (!index.has(key) || cls.length < index.get(key).length) index.set(key, cls);
  });
}

// ---- families of properties that can interact (shorthand / longhand / aliases)
const FAMILY = { 'line-height': 'font', 'row-gap': 'gap', 'column-gap': 'gap', 'grid-gap': 'gap', 'grid-row-gap': 'gap', 'grid-column-gap': 'gap',
  'place-content': 'content', 'align-content': 'content', 'justify-content': 'content', 'place-items': 'items', 'align-items': 'items', 'justify-items': 'items',
  'place-self': 'self', 'align-self': 'self', 'justify-self': 'self', top: 'inset', right: 'inset', bottom: 'inset', left: 'inset',
  width: 'size', height: 'size', 'min-width': 'size', 'max-width': 'size', 'min-height': 'size', 'max-height': 'size', 'inline-size': 'size', 'block-size': 'size',
  'min-inline-size': 'size', 'max-inline-size': 'size', 'min-block-size': 'size', 'max-block-size': 'size', columns: 'column', 'overflow-wrap': 'wrapalias', 'word-wrap': 'wrapalias' };
const family = (p) => FAMILY[p] || p.split('-')[0];

const SAFE_VALUE = /^[A-Za-z0-9 ,.%#()\-+*/]+$/; // no quotes, url(), escapes, colons, underscores: nothing Tailwind could misread
const SKIP_AT = /keyframes|font-face|property|counter-style|page|print/i;
const stats = { rulesSeen: 0, rulesChanged: 0, declsConverted: 0, declsAsUtility: 0, declsAsArbitrary: 0, declsLeft: 0, applyStatements: 0 };
const left = new Map();

function skipRule(rule) {
  for (let p = rule.parent; p && p.type !== 'root'; p = p.parent) if (p.type === 'atrule' && (SKIP_AT.test(p.name) || (p.name === 'media' && /print/.test(p.params)))) return true;
  const sel = rule.selector;
  if (!/[.#]/.test(sel)) return true;      // base element rules, :root tokens
  if (/\.paper\b/.test(sel)) return true;  // the printed syllabus form keeps its own document styles
  return false;
}
function classFor(decl) {
  const key = decl.prop.toLowerCase() + ': ' + norm(decl.value);
  if (index.has(key)) { stats.declsAsUtility++; return index.get(key); }
  stats.declsAsArbitrary++;
  return 'tw:[' + decl.prop + ':' + decl.value.trim().replace(/\s+/g, '_') + ']';
}
function convertible(decl, counts) {
  if (decl.prop.startsWith('-')) return 'custom or vendor property';
  if (decl.important) return '!important';
  if (counts.get(decl.prop) > 1) return 'property repeated in the rule';
  if (decl.prop === 'all') return 'all';
  if (!SAFE_VALUE.test(decl.value.trim()) || decl.value.trim() === '') return 'value Tailwind could misread';
  return '';
}

const root = postcss.parse(fs.readFileSync(inFile, 'utf8'));
root.walkRules((rule) => {
  stats.rulesSeen++;
  if (skipRule(rule)) return;
  const decls = rule.nodes.filter((n) => n.type === 'decl');
  if (!decls.length) return;
  // Tailwind wraps EVERY declaration of a rule that has an @apply in an @supports fallback when one of them uses a modern colour function,
  // so such a rule is left completely as written.
  if (decls.some((d) => /color-mix|oklch|oklab|lab\(|lch\(|hwb\(|color\(|light-dark/i.test(d.value))) { stats.rulesWithModernColour = (stats.rulesWithModernColour || 0) + 1; return; }
  const counts = new Map();
  decls.forEach((d) => counts.set(d.prop, (counts.get(d.prop) || 0) + 1));
  const multiline = /\n/.test(rule.raws.between || '') || rule.nodes.some((n) => /\n/.test(n.raws.before || ''));
  const indent = multiline ? (rule.nodes[0].raws.before || '\n\t') : ' ';

  let group = null; // { first: node, classes: [], families: Set }
  const out = [];
  const flush = () => {
    if (!group) return;
    const params = group.classes.join(' ');
    const at = postcss.atRule({ name: 'apply', params, raws: { before: group.before, afterName: ' ' } });
    out.push(at); stats.applyStatements++;
    group = null;
  };
  rule.nodes.forEach((node) => {
    if (node.type !== 'decl') { flush(); out.push(node); return; }
    const why = convertible(node, counts);
    if (why) { flush(); out.push(node); stats.declsLeft++; left.set(why, (left.get(why) || 0) + 1); return; }
    const fam = family(node.prop);
    if (group && group.families.has(fam)) flush();   // an interacting property starts a new statement: the order is kept
    if (!group) group = { before: node.raws.before, classes: [], families: new Set() };
    group.classes.push(classFor(node)); group.families.add(fam);
    stats.declsConverted++;
  });
  flush();
  if (out.some((n) => n.type === 'atrule' && n.name === 'apply')) {
    rule.removeAll();
    out.forEach((n, i) => { if (i === 0) n.raws.before = n.raws.before; rule.append(n); });
    stats.rulesChanged++;
  }
});

fs.writeFileSync(outFile, root.toString());
console.log(JSON.stringify({ ...stats, left: Object.fromEntries(left), realUtilitiesAvailable: index.size }));
