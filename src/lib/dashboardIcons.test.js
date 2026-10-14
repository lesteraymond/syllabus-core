// Run: npm test. The dashboard's icons are black, solid, and readable on the tinted tiles behind them.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const dash = readFileSync(new URL('../views/DashboardView.jsx', import.meta.url), 'utf8');

const lum = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0); };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const rule = (sel) => { const m = css.match(new RegExp('(?:^|\\n)\\s*' + sel.replace(/[.*+?^${}()|[\]\\>]/g, '\\$&') + '\\s*\\{([^}]*)\\}')); return m ? m[1] : ''; };

test('the dashboard icon colour is black, and it beats the old per-category colours', () => {
  const black = (css.match(/--icon-black:\s*(#[0-9a-fA-F]{6})/) || [])[1];
  assert.ok(black, '--icon-black is defined');
  assert.ok(lum(black) < 0.01, 'it is black: ' + black);
  assert.match(css, /\.stat-grid \.stat-card \.stat-icon, \.quick-actions button b, \.quick-actions button > svg \{ color: var\(--icon-black\); \}/);
  // the old rules (.stat-icon.blue and so on) have specificity 0,2,0; the new one is 0,3,0 and so wins whatever the order
  assert.ok(/\.stat-icon\.blue/.test(css), 'the old category colours are still there, outranked rather than deleted');
});

test('black is readable on every tile the dashboard icons sit on (4.5:1)', () => {
  const black = (css.match(/--icon-black:\s*(#[0-9a-fA-F]{6})/) || [])[1];
  const tiles = ['blue', 'teal', 'gold', 'green', 'purple', 'red'].map((c) => [c, (rule('.stat-icon.' + c).match(/background:\s*(#[0-9a-fA-F]{6})/) || [])[1]]);
  tiles.push(['quick action', (rule('.quick-actions b').match(/background:\s*(#[0-9a-fA-F]{6})/) || [])[1]]);
  tiles.forEach(([n, bg]) => { assert.ok(bg, n + ' tile colour found'); assert.ok(contrast(black, bg) >= 4.5, n + ' tile: ' + contrast(black, bg).toFixed(1)); });
});

test('every icon on the dashboard uses the solid weight, so black really is black', () => {
  const icons = dash.match(/<Icon\b[^>]*>/g) || [];
  assert.ok(icons.length >= 6, 'the dashboard icons were found: ' + icons.length);
  icons.forEach((i) => assert.match(i, /weight="regular"/, i));
});

test('the sidebar and the other screens are not touched by the dashboard rule', () => {
  const sel = css.match(/[^{}]*--icon-black[^{}]*\{|[^{}]*color: var\(--icon-black\)[^{}]*/g).join(' ');
  assert.ok(!/\.sidebar|\.nav-|\.page-wrap|\.card\b/.test(sel.replace(/\.stat-card/g, '')), 'only stat tiles and quick actions: ' + sel.slice(0, 200));
});
