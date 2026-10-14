// Run: npm test. The app's typeface is set in one place (two variables), and nothing quietly sets another.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync, statSync } from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const STACK = '"SF Pro Rounded", ui-rounded, "Nunito", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';

test('body text and headings both use the rounded system stack', () => {
  assert.ok(css.includes('--font-body: ' + STACK + ';'), '--font-body');
  assert.ok(css.includes('--font-display: ' + STACK + ';'), '--font-display');
  assert.match(css, /body\s*\{[^}]*\}|:root\s*\{[^}]*font-family: var\(--font-body\)/, 'the page text reads the body variable');
});

test('forms and controls inherit the app font rather than the browser default', () => {
  assert.match(css, /input,\s*select,\s*textarea\s*\{\s*font: inherit;/);
  assert.match(css, /button,\s*input,\s*select,\s*textarea\s*\{\s*font: inherit;/);
});

test('no other typeface is set by name: only the two @font-face files kept for rollback, the monospace token and the printed form', () => {
  const named = [...css.matchAll(/font-family:\s*([^;}]+)[;}]/g)].map((m) => m[1].trim());
  const allowed = [(x) => x === '"Inter"', (x) => x === '"Manrope"', (x) => x === '"Nunito"', (x) => x.startsWith('var(--font-'), (x) => x.startsWith('Arial, Helvetica')];
  const stray = named.filter((x) => !allowed.some((ok) => ok(x)));
  assert.deepStrictEqual(stray, [], 'another typeface set directly: ' + stray.join(' | '));
  assert.match(css, /--font-mono:\s*ui-monospace/, 'the monospace token is unchanged');
});

test('the printed syllabus form keeps its own document font, whatever the app uses', () => {
  assert.match(css, /\.paper \{[^}]*font-family: Arial, Helvetica, "Liberation Sans", sans-serif;/);
});

test('the rounded fallback is real: Nunito is hosted with the app, valid, small, and licensed', () => {
  const dir = new URL('../../public/fonts/', import.meta.url);
  const file = new URL('nunito-latin.woff2', dir);
  assert.ok(existsSync(file), 'public/fonts/nunito-latin.woff2 exists');
  const b = readFileSync(file);
  assert.strictEqual(b.slice(0, 4).toString(), 'wOF2', 'it is a woff2 file');
  assert.strictEqual(b.readUInt32BE(8), b.length, 'its declared length is its real length (not truncated)');
  assert.ok(statSync(file).size < 120 * 1024, 'it is light enough to load fast: ' + statSync(file).size + ' bytes');
  assert.match(css, /@font-face \{\s*font-family: "Nunito";[^}]*src: url\("\/fonts\/nunito-latin\.woff2"\) format\("woff2"\);/, 'the @font-face points at the file');
  assert.match(css, /@font-face \{\s*font-family: "Nunito";[^}]*font-display: swap;/, 'text shows at once in the fallback and swaps in when Nunito arrives');
  const license = readFileSync(new URL('Nunito-OFL.txt', dir), 'utf8');
  assert.match(license, /SIL Open Font License, Version 1\.1/, 'the license text ships with the font');
});

test('the order of the stack: rounded system fonts first, then Nunito, then the plain system fonts as the last fallbacks', () => {
  const order = ['"SF Pro Rounded"', 'ui-rounded', '"Nunito"', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'].map((f) => STACK.indexOf(f));
  assert.ok(order.every((i) => i > -1) && order.every((i, k) => k === 0 || i > order[k - 1]), 'order: ' + order.join(','));
});
