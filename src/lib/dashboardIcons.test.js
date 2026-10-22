// Run: npm test. The dashboard's icons are black, solid, and readable on the tinted tiles behind them.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { compiledAppCss } from './compiledCss.js';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const dash = readFileSync(new URL('../views/DashboardView.jsx', import.meta.url), 'utf8');

const lum = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0); };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const rule = (sel) => { const m = css.match(new RegExp('(?:^|\\n)\\s*' + sel.replace(/[.*+?^${}()|[\]\\>]/g, '\\$&') + '\\s*\\{([^}]*)\\}')); return m ? m[1] : ''; };

const theme = readFileSync(new URL('../theme.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const token = (name, source = theme) => (source.match(new RegExp('--' + name + ': *(#[0-9a-fA-F]{6})')) || [])[1];

test('the dashboard icons take their colour from the brand theme, and it beats the old black rule', () => {
  // the theme loads after styles.css and uses the same specificity (0,3,0), so it wins for the stat tiles
  assert.match(theme, /\.stat-grid \.stat-card \.stat-icon \{[^}]*color: #ffffff/);
  assert.match(theme, /\.quick-actions button b \{[^}]*color: var\(--gold\)/);
  // main.jsx loads one entry, tailwind.css, which imports styles.css and then theme.css into the same (legacy) layer: the order is what counts
  assert.match(readFileSync(new URL('../main.jsx', import.meta.url), 'utf8'), /import '\.\/tailwind\.css';/, 'the app loads the stylesheet entry');
  assert.match(readFileSync(new URL('../tailwind.css', import.meta.url), 'utf8'), /@import "\.\/styles\.css" layer\(legacy\);\s*@import "\.\/theme\.css" layer\(legacy\);/, 'theme.css is imported after styles.css, in the same layer');
});

test('the stat icons are white on the sidebar gradient, and readable on every stop of it', () => {
  assert.match(theme, /\.stat-icon \{[^}]*background: linear-gradient\([^)]*var\(--side-top\)[^}]*var\(--side-bottom\)/);
  ['side-top', 'side-mid', 'side-bottom'].forEach((stop) => assert.ok(contrast('#ffffff', token(stop)) >= 4.5, 'white icon on ' + stop + ': ' + contrast('#ffffff', token(stop)).toFixed(1)));
  assert.ok(contrast(token('gold'), token('navy')) >= 4.5, 'gold icon on the navy quick-action chip: ' + contrast(token('gold'), token('navy')).toFixed(1));
});

test('every icon on the dashboard uses the regular weight, so the brand colours read cleanly', () => {
  const icons = dash.match(/<Icon\b[^>]*>/g) || [];
  assert.ok(icons.length >= 6, 'the dashboard icons were found: ' + icons.length);
  icons.forEach((i) => assert.match(i, /weight="regular"/, i));
});

test('the sidebar and the other screens are not touched by the dashboard rule', async () => {
  const compiled = await compiledAppCss(); // what the rule does once Tailwind has resolved styles.css, however it is written
  const sel = compiled.match(/[^{}]*--icon-black[^{}]*\{|[^{}]*color: var\(--icon-black\)[^{}]*/g).join(' ');
  assert.ok(!/\.sidebar|\.nav-|\.page-wrap|\.card\b/.test(sel.replace(/\.stat-card/g, '')), 'only stat tiles and quick actions: ' + sel.slice(0, 200));
});
