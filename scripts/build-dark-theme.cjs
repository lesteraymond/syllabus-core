// Builds src/appearance.css: the dark and AMOLED themes. It reads the app's own light stylesheets and, for every rule that paints a
// hard-coded light surface, dark text or light border, emits the dark counterpart under :where(:root[data-theme=...]) (zero extra
// specificity, so the original cascade and every hover/active state keep working). Re-run after changing a colour in the stylesheets:
//   node scripts/build-dark-theme.cjs
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'src');
const files = ['styles.css', 'theme.css', 'responsive.css'];

const NAMED = { white: '#ffffff', black: '#000000' };
function parseColor(v) {
  v = v.trim().toLowerCase();
  if (NAMED[v]) v = NAMED[v];
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (!m) return null;
  let h = m[1]; if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
  }
  return { h, s, l };
}
const hs = (h, s, l) => `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
const neutral = (c) => c.s < 0.18;

// Surfaces: white-ish -> card, light grey -> surface, light tint -> the same hue, dark.
function darkBackground(raw) {
  const c = parseColor(raw); if (!c) return null;
  const x = hsl(c); if (x.l < 0.78) return null;
  if (neutral(x) || (x.l >= 0.93 && x.s < 0.5)) return x.l >= 0.97 ? 'var(--dk-card)' : x.l >= 0.9 ? 'var(--dk-surf)' : 'var(--dk-surf2)';
  return hs(x.h, Math.min(x.s, 0.6) * 0.55, 0.17 + (1 - x.l) * 0.2);
}
function darkText(raw) {
  const c = parseColor(raw); if (!c) return null;
  const x = hsl(c); if (x.l > 0.45) return null;
  if (neutral(x)) return x.l < 0.2 ? 'var(--text)' : 'var(--muted)';
  return hs(x.h, Math.min(x.s, 0.75), 0.74);
}
function darkBorder(raw) {
  const c = parseColor(raw); if (!c) return null;
  const x = hsl(c); if (x.l < 0.78) return null;
  return neutral(x) ? 'var(--line)' : hs(x.h, x.s * 0.4, 0.26);
}

function declsOf(body) {
  const out = [];
  for (const m of body.matchAll(/tw:\[([a-z-]+):([^\]]+)\]/g)) out.push([m[1], m[2].replace(/_/g, ' ')]);
  for (const part of body.replace(/@apply[^;]*;/g, '').split(';')) {
    const i = part.indexOf(':'); if (i < 1) continue;
    out.push([part.slice(0, i).trim().toLowerCase(), part.slice(i + 1).trim()]);
  }
  return out;
}
const COLOR_TOKEN = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|\bwhite\b/g;

const lightRules = []; const tokenLines = []; const finalValue = new Map(); // `${selector}|${prop}` -> the last raw value any file gives it
const keyProp = (p) => (p === 'background-color' ? 'background' : p);
for (const f of files) {
  const css = fs.readFileSync(path.join(root, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().replace(/\s+/g, ' ');
    if (!sel || sel.startsWith('@') || /^(from|to|\d+%)/.test(sel)) continue;
    const decls = declsOf(m[2]);
    if (sel === ':root') { for (const [p, v] of decls) if (p.startsWith('--') && !/(font|text-|fw-|tracking|radius|pad|h$|size|width|duration|ease)/.test(p)) { const t = darkBackground(v); if (t) tokenLines.push(`${p}: ${t.startsWith('var(') ? t : t};`); } continue; }
    if (/(^| )(@|:root|html|body\b[^.])/.test(sel) && false) continue;
    for (const [p, v] of decls) finalValue.set(sel + '|' + keyProp(p), v);
    const bgDecl = decls.filter(([p]) => p === 'background' || p === 'background-color').pop();
    const bgRaw = bgDecl && bgDecl[1];
    const bgColor = bgRaw && !/gradient|url\(/.test(bgRaw) ? bgRaw.split(/\s+/)[0] : null;
    const out = [];
    let bgDark = null;
    if (bgDecl && bgColor && !/gradient|url\(/.test(bgRaw) && /^(#|white)/i.test(bgRaw.trim()) && bgRaw.trim().split(/\s+/).length === 1) { bgDark = darkBackground(bgColor); if (bgDark) out.push({ prop: 'background', raw: bgRaw, css: `background: ${bgDark}` }); }
    const darkBgInRule = bgDecl && !bgDark && /^(#|var\(|rgb|linear)/i.test(bgRaw) && !/^var\(--(?:tint-|bg\b|card\b|th-gray\b)/i.test(bgRaw.trim()) && !(bgColor && parseColor(bgColor) && hsl(parseColor(bgColor)).l >= 0.78); // a mid/dark or gradient background: keep its text colour
    const colorDecl = decls.filter(([p]) => p === 'color').pop();
    if (colorDecl && !darkBgInRule) {
      const t = /^var\(--navy\b/.test(colorDecl[1].trim()) ? 'var(--ink)' : darkText(colorDecl[1]);
      if (t) out.push({ prop: 'color', raw: colorDecl[1], css: `color: ${t}` });
    }
    for (const [p, v] of decls) {
      if (/^border(-(top|right|bottom|left))?(-color)?$/.test(p) || p === 'outline-color') {
        const nv = v.replace(COLOR_TOKEN, (c) => darkBorder(c) || c);
        if (nv !== v) out.push({ prop: p, raw: v, css: `${p}: ${nv}` });
      }
    }
    const MIX_WHITE = /,\s*(#fff(?:fff)?|white)\s*\)/gi;
    for (const [p, v] of decls) { if (v.includes('color-mix(') && /^(background(-color)?|border(-[a-z]+)?(-color)?|outline-color)$/.test(p) && new RegExp(MIX_WHITE.source, 'i').test(v)) out.push({ prop: p, raw: v, css: `${p}: ${v.replace(MIX_WHITE, ', var(--dk-card))')}` }); }
    if (out.length) lightRules.push({ sel, out });
  }
}
// Split a selector list on top-level commas only (never inside :is(...), :where(...), :not(...), :has(...)).
function splitSelectors(s) {
  const parts = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { if (cur.trim()) parts.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}
const prefix = (theme) => (s) => splitSelectors(s).map((x) => `:where(:root[data-theme="${theme}"]) ${x}`).join(',\n');
let css = `/* GENERATED by scripts/build-dark-theme.cjs: do not edit by hand. The dark and AMOLED themes. */\n`;
css += `:root[data-theme="dark"], :root[data-theme="amoled"] {\n${[...new Set(tokenLines)].map((l) => '\t' + l).join('\n')}\n}\n`;
css += `/* Hand-set tokens (win over the generated ones above). */\n`;
css += `:root[data-theme="dark"] { --ds-background-100: #1c1c1c; --ds-background-200: #141414; --ds-bg-100: var(--ds-background-100); --ds-bg-200: var(--ds-background-200); --ds-gray-100: #222222; --ds-gray-200: #282828; --ds-gray-300: #303030; --ds-gray-400: #363636; --ds-gray-500: #4a4a4a; --ds-gray-600: #787878; --ds-gray-700: #8a8a8a; --ds-gray-900: #a3a3a3; --ds-gray-1000: #ededed; --ds-gray-alpha-100: rgba(255, 255, 255, 0.05); --ds-gray-alpha-200: rgba(255, 255, 255, 0.10); --ds-gray-alpha-400: rgba(255, 255, 255, 0.16); --dk-card: #1c1c1c; --dk-surf: #242424; --dk-surf2: #2c2c2c; --bg: var(--ds-background-200); --card: var(--ds-background-100); --ink: #ededed; --text: #d6d6d6; --muted: #a3a3a3; --line: var(--ds-gray-400); --line-strong: var(--ds-gray-500); --mat-base: 0 0 0 1px rgba(255, 255, 255, 0.08); --mat-small: 0 0 0 1px rgba(255, 255, 255, 0.09), 0 1px 3px rgba(0, 0, 0, 0.28); --mat-medium: 0 0 0 1px rgba(255, 255, 255, 0.11), 0 4px 14px rgba(0, 0, 0, 0.36); --mat-large: 0 0 0 1px rgba(255, 255, 255, 0.12), 0 12px 28px rgba(0, 0, 0, 0.44); --mat-tooltip: 0 0 0 1px rgba(255, 255, 255, 0.12), 0 4px 12px rgba(0, 0, 0, 0.40); --mat-menu: 0 0 0 1px rgba(255, 255, 255, 0.12), 0 8px 24px rgba(0, 0, 0, 0.45); --mat-modal: 0 0 0 1px rgba(255, 255, 255, 0.13), 0 16px 48px rgba(0, 0, 0, 0.56); --mat-fullscreen: 0 0 0 1px rgba(255, 255, 255, 0.14), 0 24px 64px rgba(0, 0, 0, 0.64); --shadow: var(--mat-small); --side-hover: var(--ds-gray-100); --side-active: var(--ds-gray-200); --side-active-hover: var(--ds-gray-300); --side-icon: #969696; --blue2: #7da6ff; --purple: #c4b5fd; --teal: #5eead4; --btn-primary-tint: #1f2e4d; --btn-primary-hover: #1d4ed8; --btn-secondary: #222222; --btn-secondary-hover: #2c2c2c; --btn-secondary-border: #3a3a3a; --th-gray: #242424; --row-sel: #223054; --warn: #ff9498; --warn-bg: #2e191b; --warn-border: #5e2a2f; --warn-icon: #ff6b70; --tint-cobalt: #18233c; --tint-gold: #30240e; --tint-copper: #122b28; --tint-green: #142a1b; --tint-crimson: #2e191b; --green-ink: #62c073; --clo-0-ink: #ffffff; --clo-2-ink: #ffffff; --clo-3-ink: #ffffff; --clo-4-ink: #ffffff; --clo-5-ink: #ffffff; --green-text: #62c073; --red-ink: #ff6b70; --gold-ink: #f5b942; --copper-ink: #5eead4; --copper-text: #5eead4; }\n`;
css += `:root[data-theme="amoled"] { --ds-bg-100: #0a0a0a; --ds-bg-200: #000000; --ds-gray-100: #141414; --ds-gray-200: #1a1a1a; --ds-gray-300: #222222; --ds-gray-400: #292929; --ds-gray-900: #a1a1a1; --ds-gray-1000: #ffffff; --dk-card: #0a0a0a; --dk-surf: #0f0f0f; --dk-surf2: #151515; --bg: #000000; --card: #0a0a0a; --ink: #ffffff; --text: #e5e5e5; --muted: #a1a1a1; --line: #1d1d1d; --line-strong: #333333; --mat-base: 0 0 0 1px rgba(255, 255, 255, 0.08); --mat-small: 0 0 0 1px rgba(255, 255, 255, 0.12); --mat-menu: 0 0 0 1px rgba(255, 255, 255, 0.12); --mat-modal: 0 0 0 1px rgba(255, 255, 255, 0.14); --shadow: none; --side-hover: #121212; --side-active: #181818; --side-active-hover: #1e1e1e; --side-icon: #888888; --blue2: #7da6ff; --purple: #c4b5fd; --teal: #5eead4; --btn-primary-tint: #0d1a33; --btn-primary-hover: #1d4ed8; --btn-secondary: #0a0a0a; --btn-secondary-hover: #161616; --btn-secondary-border: #262626; --th-gray: #0f0f0f; --row-sel: #0d1a33; --warn: #ff8a8e; --warn-bg: #1f0d0f; --warn-border: #4a1c20; --warn-icon: #ff6166; --tint-cobalt: #0d1230; --tint-gold: #261a06; --tint-copper: #081f1c; --tint-green: #0a1c10; --tint-crimson: #220d0f; --green-ink: #62c073; --clo-0-ink: #ffffff; --clo-2-ink: #ffffff; --clo-3-ink: #ffffff; --clo-4-ink: #ffffff; --clo-5-ink: #ffffff; --green-text: #62c073; --red-ink: #ff6166; --gold-ink: #f5b942; --copper-ink: #5eead4; --copper-text: #5eead4; }\n`;
css += `:root[data-theme="dark"], :root[data-theme="amoled"] { color-scheme: dark; }\n`;
css += `:where(:root[data-theme="dark"]) body, :where(:root[data-theme="amoled"]) body { background: var(--bg); color: var(--text); }\n`;
css += `/* Hand-set fixes: controls that take their fill from a token but hard-code a black label, plus semantic contrast in dark/AMOLED. */\n`;
css += `:root[data-theme="dark"] .btn.outline, :root[data-theme="amoled"] .btn.outline, :root[data-theme="dark"] .btn.outline:hover:not(:disabled), :root[data-theme="amoled"] .btn.outline:hover:not(:disabled), :root[data-theme="dark"] .asg-btn.ghost, :root[data-theme="amoled"] .asg-btn.ghost, :root[data-theme="dark"] .asg-btn.ghost:hover:not(:disabled), :root[data-theme="amoled"] .asg-btn.ghost:hover:not(:disabled), :root[data-theme="dark"] .rp-cancel, :root[data-theme="amoled"] .rp-cancel, :root[data-theme="dark"] .rp-cancel:hover:not(:disabled), :root[data-theme="amoled"] .rp-cancel:hover:not(:disabled) { color: var(--ink); }\n`;
css += `:root[data-theme="dark"] .toast, :root[data-theme="amoled"] .toast, :root[data-theme="dark"] .bld2-toast, :root[data-theme="amoled"] .bld2-toast { background: var(--dk-surf2); color: var(--ink); border: 1px solid var(--line-strong); }\n`;
css += `:root[data-theme="dark"] .btn.outline.syl-quiet:hover:not(:disabled), :root[data-theme="amoled"] .btn.outline.syl-quiet:hover:not(:disabled), :root[data-theme="dark"] .btn.outline.syl-quiet:focus-visible, :root[data-theme="amoled"] .btn.outline.syl-quiet:focus-visible { color: var(--ink); }\n`;
css += `:root[data-theme="dark"] .stepper button.active, :root[data-theme="amoled"] .stepper button.active, :root[data-theme="dark"] .gen-step.idle .gen-dot, :root[data-theme="amoled"] .gen-step.idle .gen-dot { color: #8fb4ff; }\n`;
css += `:root[data-theme="dark"] .usage-tooltip, :root[data-theme="amoled"] .usage-tooltip { background: var(--dk-surf2); color: var(--ink); border: 1px solid var(--line); }\n`;
css += `:root[data-theme="dark"] .status.for-revision, :root[data-theme="amoled"] .status.for-revision, :root[data-theme="dark"] .status.for_revision, :root[data-theme="amoled"] .status.for_revision, :root[data-theme="dark"] .status.dl-failed, :root[data-theme="amoled"] .status.dl-failed, :root[data-theme="dark"] .btn.danger, :root[data-theme="amoled"] .btn.danger, :root[data-theme="dark"] .logout:hover, :root[data-theme="amoled"] .logout:hover, :root[data-theme="dark"] .logout:focus-visible, :root[data-theme="amoled"] .logout:focus-visible { color: var(--red-ink); }\n`;
css += `:root[data-theme="dark"] .info-banner, :root[data-theme="amoled"] .info-banner { background: var(--dk-card); color: var(--text); border: 1px solid var(--line); }\n`;
css += `:root[data-theme="dark"] .info-banner svg, :root[data-theme="amoled"] .info-banner svg { color: #60a5fa; }\n`;
css += `:root[data-theme="dark"] .bld2 { --warn: #f2b8b5; --warn-bg: #2b1818; }\n`;
css += `:root[data-theme="amoled"] .bld2 { --warn: #f2b8b5; --warn-bg: #1f1010; }\n`;
css += `:root[data-theme="dark"] .info-banner.warning, :root[data-theme="amoled"] .info-banner.warning, :root[data-theme="dark"] .form-error, :root[data-theme="amoled"] .form-error, :root[data-theme="dark"] .check-warn, :root[data-theme="amoled"] .check-warn, :root[data-theme="dark"] .comp-warn, :root[data-theme="amoled"] .comp-warn, :root[data-theme="dark"] .asg-note, :root[data-theme="amoled"] .asg-note, :root[data-theme="dark"] .bld2 .blockers.admin, :root[data-theme="amoled"] .bld2 .blockers.admin, :root[data-theme="dark"] .hy-pill.warn, :root[data-theme="amoled"] .hy-pill.warn, :root[data-theme="dark"] .pick-card.pick-compact > .btn.pick-score.warn, :root[data-theme="amoled"] .pick-card.pick-compact > .btn.pick-score.warn { background: var(--warn-bg); color: var(--warn); border: 1px solid var(--warn-border); }\n`;
css += `:root[data-theme="dark"] .comp-badge.warn, :root[data-theme="amoled"] .comp-badge.warn, :root[data-theme="dark"] .cmp-badge.warn, :root[data-theme="amoled"] .cmp-badge.warn, :root[data-theme="dark"] .cmp .chip.stale, :root[data-theme="amoled"] .cmp .chip.stale, :root[data-theme="dark"] .cmp-row .chip.stale, :root[data-theme="amoled"] .cmp-row .chip.stale, :root[data-theme="dark"] .aic-state .chip.stale, :root[data-theme="amoled"] .aic-state .chip.stale, :root[data-theme="dark"] .setup-badge, :root[data-theme="amoled"] .setup-badge, :root[data-theme="dark"] .vh-decision, :root[data-theme="amoled"] .vh-decision, :root[data-theme="dark"] .feed-item.warn .feed-ico, :root[data-theme="amoled"] .feed-item.warn .feed-ico { background: var(--warn-bg); color: var(--warn); }\n`;
css += `:root[data-theme="dark"] .info-banner.warning svg, :root[data-theme="amoled"] .info-banner.warning svg { color: var(--warn-icon); }\n`;
css += `:root[data-theme="dark"] .ai-note, :root[data-theme="amoled"] .ai-note { background: var(--dk-card); color: var(--text); border: 1px solid var(--line); }\n`;
css += `:root[data-theme="dark"] .btn.danger:hover:not(:disabled), :root[data-theme="amoled"] .btn.danger:hover:not(:disabled) { background: #472020; border-color: #6b2c2c; }\n`;
css += `:root[data-theme="dark"] .status.approved, :root[data-theme="amoled"] .status.approved, :root[data-theme="dark"] .status.dl-submitted, :root[data-theme="amoled"] .status.dl-submitted, :root[data-theme="dark"] .hist-item.good .hist-score b, :root[data-theme="amoled"] .hist-item.good .hist-score b { color: var(--green-text); }\n`;
css += `:root[data-theme="dark"] .status.draft, :root[data-theme="amoled"] .status.draft { color: var(--muted); border-color: var(--line-strong); }\n`;
css += `:root[data-theme="dark"] .status.archived, :root[data-theme="amoled"] .status.archived, :root[data-theme="dark"] .hist-item.none .hist-score b, :root[data-theme="amoled"] .hist-item.none .hist-score b { color: var(--muted); }\n`;
css += `:root[data-theme="dark"] .select-trigger:disabled, :root[data-theme="amoled"] .select-trigger:disabled { color: var(--muted); }\n`;
css += `/* Auth & full-page panels whose light gradient backgrounds were skipped by the color pass, plus score ring tracks. */\n`;
css += `:root[data-theme="dark"] .login-panel, :root[data-theme="amoled"] .login-panel, :root[data-theme="dark"] .pw-page, :root[data-theme="amoled"] .pw-page { background: var(--bg); }\n`;
css += `:root[data-theme="dark"] .login-card h2, :root[data-theme="amoled"] .login-card h2 { color: var(--ink); }\n`;
css += `:root[data-theme="dark"] .login-card .check, :root[data-theme="amoled"] .login-card .check { color: var(--text); }\n`;
css += `:root[data-theme="dark"] .quality-ring, :root[data-theme="amoled"] .quality-ring { background: conic-gradient(var(--btn-primary) 0 var(--p), var(--ring-track) var(--p)); }\n`;
css += `:root[data-theme="dark"] .quality-mini.tone-mid .quality-ring, :root[data-theme="amoled"] .quality-mini.tone-mid .quality-ring { background: conic-gradient(var(--ring-warn) 0 var(--p), var(--ring-track) var(--p)); }\n`;
css += `:root[data-theme="dark"] .quality-mini.tone-bad .quality-ring, :root[data-theme="amoled"] .quality-mini.tone-bad .quality-ring { background: conic-gradient(var(--red) 0 var(--p), var(--ring-track) var(--p)); }\n`;
css += `:root[data-theme="dark"] .big-ring, :root[data-theme="amoled"] .big-ring { background: conic-gradient(var(--green) 0 var(--p), var(--ring-track) var(--p)); }\n`;
css += `:root[data-theme="dark"] .cmp-ring.warn, :root[data-theme="amoled"] .cmp-ring.warn, :root[data-theme="dark"] .cm-score .big-ring.cm-ring.warn, :root[data-theme="amoled"] .cm-score .big-ring.cm-ring.warn { background: conic-gradient(var(--ring-warn) 0 var(--p), var(--ring-track) var(--p)); }\n`;
css += `:root[data-theme="dark"] .top-actions .icon-btn:not(.is-open), :root[data-theme="amoled"] .top-actions .icon-btn:not(.is-open) { background: color-mix(in srgb, var(--muted) 14%, var(--dk-card)); color: var(--text); }\n`;
css += `:root[data-theme="dark"] .top-actions .icon-btn:not(.is-open):hover, :root[data-theme="amoled"] .top-actions .icon-btn:not(.is-open):hover { background: color-mix(in srgb, var(--muted) 22%, var(--dk-card)); }\n`;
css += `:root[data-theme="dark"] .top-actions .search, :root[data-theme="amoled"] .top-actions .search { background: color-mix(in srgb, var(--muted) 14%, var(--dk-card)); color: var(--muted); }\n`;
css += `:root[data-theme="dark"] .top-actions .search:focus-within, :root[data-theme="amoled"] .top-actions .search:focus-within { background: var(--dk-card); }\n`;
css += `:root[data-theme="dark"] .top-actions .search input, :root[data-theme="amoled"] .top-actions .search input { color: var(--text); }\n`;
css += `:root[data-theme="amoled"] .topbar .logout { border: 1px solid var(--line); color: var(--text); }\n`;
css += `:root[data-theme="dark"] .repository-table .table-action:not(:hover), :root[data-theme="amoled"] .repository-table .table-action:not(:hover) { color: #7da6ff; }\n`;
css += `:root[data-theme="amoled"] .repository-filters .reset { border: 1px solid var(--line); color: var(--text); }\n`;
css += `:root[data-theme="dark"] .top-actions .search.is-mobile-open, :root[data-theme="amoled"] .top-actions .search.is-mobile-open { background: var(--dk-card); border: 1px solid var(--line); }\n`;
css += `:root[data-theme="dark"] .select-option.is-selected, :root[data-theme="amoled"] .select-option.is-selected { color: #7da6ff; }\n`;
css += `:root[data-theme="dark"] .select-trigger:hover:not(:disabled) .select-chevron, :root[data-theme="amoled"] .select-trigger:hover:not(:disabled) .select-chevron, :root[data-theme="dark"] .select-trigger[aria-expanded="true"] .select-chevron, :root[data-theme="amoled"] .select-trigger[aria-expanded="true"] .select-chevron { color: #7da6ff; }\n`;
css += `:root[data-theme="dark"] .dl-chip.tone-set, :root[data-theme="amoled"] .dl-chip.tone-set { color: #7da6ff; border-color: color-mix(in srgb, #7da6ff 45%, var(--line)); }\n`;
css += `:root[data-theme="dark"] .link-btn, :root[data-theme="amoled"] .link-btn, :root[data-theme="dark"] .dashboard-grid .card-head .select-trigger, :root[data-theme="amoled"] .dashboard-grid .card-head .select-trigger { color: #7da6ff; }\n`;
const darkBlueLinks = ['.asg-link', '.bld2 .link', '.dp-link', '.rp-link', '.cmp-step', '.card-action-btn', '.hist-reset', '.demo-accounts button', '.pick-card.pick-compact > .btn.pick-edit', '.cmp-find > summary', '.hy-advice b', '.dp-day.is-today:not(.is-selected)', '.student-code', '.ar-toggle:hover', '.ar-toggle:focus-visible'];
css += `${darkBlueLinks.flatMap((s) => [`:root[data-theme="dark"] ${s}`, `:root[data-theme="amoled"] ${s}`]).join(', ')} { color: #7da6ff; }\n`;
const darkBlueOnTint = ['.user-act:hover:not(:disabled)', '.msg-drop-head .link-btn', '.msg-drop .thread.unread .thread-top small', '.notif-item.unread .notif-time', '.notif-tabs button.active', '.notif-item.unread .notif-ico', '.hist-ver', '.svm-modal .svm-changes', '.vh-modal .vh-changes', '.svm-head .rb-pill', '.vh-modal .vh-current', '.cmp .cmp-chips .chip.basis.ai', '.big-ring.cmp-ring.provisional small', '.big-ring.cmp-ring.checking small', '.ar-you', '.fr-findings-btn:hover', '.fr-findings-btn:focus-visible', '.ar-mini-docx:hover', '.repository-table .table-action:hover', '.repository-table .table-action:focus-visible'];
css += `${darkBlueOnTint.flatMap((s) => [`:root[data-theme="dark"] ${s}`, `:root[data-theme="amoled"] ${s}`]).join(', ')} { color: #8fb4ff; }\n`;
css += `:root[data-theme="dark"] .table-card.repository-table.student-table td .btn.student-view-btn:not(:hover), :root[data-theme="amoled"] .table-card.repository-table.student-table td .btn.student-view-btn:not(:hover) { color: #7da6ff; border-color: #7da6ff; }\n`;
css += `:root[data-theme="dark"] .outcomes-row .icon-btn.is-delete:hover:not(:disabled), :root[data-theme="amoled"] .outcomes-row .icon-btn.is-delete:hover:not(:disabled), :root[data-theme="dark"] .institution-item .icon-btn.is-delete:hover:not(:disabled), :root[data-theme="amoled"] .institution-item .icon-btn.is-delete:hover:not(:disabled), :root[data-theme="dark"] .outcomes-row .icon-btn.is-delete:focus-visible, :root[data-theme="amoled"] .outcomes-row .icon-btn.is-delete:focus-visible, :root[data-theme="dark"] .institution-item .icon-btn.is-delete:focus-visible, :root[data-theme="amoled"] .institution-item .icon-btn.is-delete:focus-visible { color: var(--red-ink); }\n`;
// Text contrast on dark surfaces (4.5:1 or better), both dark themes.
const darkText45 = [
  [['.badge.green', '.status.active'], 'border-color: #235f45'], // they draw their border with --green-ink, which is light here
  [['.rp-stages li.current', '.rp-stages li.current small', '.bld2 .eyebrow'], 'color: #7da6ff'], // not var(--blue2): some panels set it to a darker blue
  [['.bld2 .autosave:not(.saving):not(.error)', '.bld2 .stepper button.done i'], 'color: var(--green-ink)'],
  [['.quality-mini.tone-bad', '.hy-pill.bad', '.hy-pill.tier.material', '.hy-pill.tier.mandatory', '.user-act.danger', '.user-act.danger:hover:not(:disabled)'], 'color: var(--red-ink)'],
  [['.bld2 .stepper button:not(.active) span', '.bld2 .ledger th', '.asg-ledger th'], 'color: var(--muted)'],
  [['.comp-av'], 'color: #8fb4ff'],
  [['.rb-grid .avatar', '.svm-av'], 'color: color-mix(in srgb, var(--tone) 45%, #ffffff) !important'], // --tone is the program colour for a white page, put on by a utility class
];
for (const [sels, decl] of darkText45) css += `${['dark', 'amoled'].flatMap((t) => sels.map((x) => `:root[data-theme="${t}"] ${x}`)).join(', ')} { ${decl}; }\n`;
for (const r of lightRules) if (r.out.some((o) => finalValue.get(r.sel + '|' + keyProp(o.prop)) === o.raw)) css += `${['dark', 'amoled'].map((t) => prefix(t)(r.sel)).join(',\n')} { ${r.out.filter((o) => finalValue.get(r.sel + '|' + keyProp(o.prop)) === o.raw).map((o) => o.css).join('; ')}; }\n`;
fs.writeFileSync(path.join(root, 'appearance.css'), css);
console.log(`appearance.css: ${lightRules.length} rules, ${new Set(tokenLines).size} tokens, ${css.length} bytes`);
