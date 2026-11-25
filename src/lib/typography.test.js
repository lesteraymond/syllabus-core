// Run: npm test. The app's typeface is set in one place (two variables), and nothing quietly sets another.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync, statSync } from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const STACK = '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

test('body text and headings both use the Geist Sans stack', () => {
  assert.ok(css.includes('--font-body: ' + STACK + ';'), '--font-body');
  assert.ok(css.includes('--font-display: ' + STACK + ';'), '--font-display');
  assert.match(css, /body\s*\{[^}]*\}|:root\s*\{[^}]*font-family: var\(--font-body\)/, 'the page text reads the body variable');
});

test('forms and controls inherit the app font rather than the browser default', () => {
  assert.match(css, /input,\s*select,\s*textarea\s*\{\s*font: inherit;/);
  assert.match(css, /button,\s*input,\s*select,\s*textarea\s*\{\s*font: inherit;/);
});

test('no other typeface is set by name: only Geist Sans/Mono @font-face, the monospace token and the printed form', () => {
  const named = [...css.matchAll(/font-family:\s*([^;}]+)[;}]/g)].map((m) => m[1].trim());
  // The printed form's own fonts: Arial for the body and Monotype Corsiva for the letterhead, as on the approved institutional syllabi
  // (styles.css .paper-letterhead).
  const allowed = [(x) => x === '"Geist"', (x) => x === '"Geist Mono"', (x) => x === '"Inter"', (x) => x === '"Manrope"', (x) => x === '"Nunito"', (x) => x.startsWith('var(--font-'), (x) => x.startsWith('Arial, Helvetica'),
    (x) => x.startsWith('"Monotype Corsiva"')];
  const stray = named.filter((x) => !allowed.some((ok) => ok(x)));
  assert.deepStrictEqual(stray, [], 'another typeface set directly: ' + stray.join(' | '));
  assert.match(css, /--font-mono:\s*"Geist Mono",\s*ui-monospace/, 'the monospace token leads with Geist Mono');
});

test('the printed syllabus form keeps its own document font, whatever the app uses', () => {
  assert.match(css, /\.paper \{[^}]*font-family: Arial, Helvetica, "Liberation Sans", sans-serif;/);
});

test('Geist Sans and Geist Mono are installed, valid, small, and wired in @font-face', () => {
  for (const [label, rel, family] of [
    ['Geist Sans', '../../node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2', 'Geist'],
    ['Geist Mono', '../../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2', 'Geist Mono'],
  ]) {
    const file = new URL(rel, import.meta.url);
    assert.ok(existsSync(file), rel + ' exists');
    const b = readFileSync(file);
    assert.strictEqual(b.slice(0, 4).toString(), 'wOF2', label + ' is a woff2 file');
    assert.strictEqual(b.readUInt32BE(8), b.length, label + ' declared length matches real length');
    assert.ok(statSync(file).size < 120 * 1024, label + ' is light enough to load fast: ' + statSync(file).size + ' bytes');
    assert.match(css, new RegExp(`@font-face \\{\\s*font-family: "${family}";[^}]*\\.woff2"\\) format\\("woff2"\\);`), label + ' @font-face points at woff2');
    assert.match(css, new RegExp(`@font-face \\{\\s*font-family: "${family}";[^}]*font-display: swap;`), label + ' uses font-display: swap');
  }
});

test('the order of the stack: Geist first, then system UI fallbacks', () => {
  const parts = STACK.split(', ');
  const order = ['"Geist"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'system-ui', 'sans-serif'].map((f) => parts.indexOf(f));
  assert.ok(order.every((i) => i > -1) && order.every((i, k) => k === 0 || i > order[k - 1]), 'order: ' + order.join(','));
});
