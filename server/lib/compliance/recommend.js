'use strict';
// Turns a rule result into ranked recommendations.
//   recommend({ provider, result, content, standard, timeoutMs }) -> { items, source, ai }
//
// The rules decide what is wrong and how much it matters; a provider (AI) only helps word the advice. Everything it returns is
// checked: an item must have a title, a text and cite at least one real finding (basedOn) or it is dropped; the step, rows, CLOs
// and areas it is linked to are taken from the cited findings, never from the model; its priority is the area score gap x the
// area weight; at most `standard.recommendations.max` are kept. If the provider fails, times out or returns nothing usable,
// rule-based recommendations (the same wording the mock writes) are returned instead. Nothing here talks to the database, so
// it can run outside the submit transaction.
const { groupByRule, describe } = require('./providers');

const TITLE_MAX = 120;
const TEXT_MAX = 500;
const PROVIDER_TIMEOUT_MS = 45000;

// ---- keeping names and emails out of what a provider sees ----
// Masked: email addresses, phone numbers, titled names ("Prof. Juan Dela Cruz", "Dr. Reyes"), and any name the caller lists
// (the syllabus owner, the people named in the sign-off). Years are kept. A name typed into free text with no title and not in
// the list cannot be recognised, which is why the excerpt is short and the sign-off is never included.
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;
const TITLED = /\b(?:Prof|Professor|Dr|Engr|Mr|Mrs|Ms|Atty|Rev|Fr|Sr|Br)\.?\s+[A-Z][\w'-]*(?:\s+[A-Z][\w.'-]*){0,3}/g;
const escapeRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function redact(s, names = []) {
  let t = String(s == null ? '' : s).replace(EMAIL, '[email]').replace(PHONE, (m) => (/^(19|20)\d{2}$/.test(m.trim()) ? m : '[number]')).replace(TITLED, '[name]');
  const parts = new Set();
  (Array.isArray(names) ? names : []).forEach((n) => {
    const full = String(n || '').replace(/\s+/g, ' ').trim();
    if (full.length < 3) return;
    parts.add(full);
    full.split(' ').forEach((w) => { if (w.length >= 3) parts.add(w); }); // each part of the name too: "Juan", "Dela", "Cruz"
  });
  [...parts].sort((a, b) => b.length - a.length).forEach((n) => { t = t.replace(new RegExp('\\b' + escapeRe(n) + '\\b', 'gi'), '[name]'); });
  return t;
}
const clip = (s, n, names) => redact(s, names).replace(/\s+/g, ' ').trim().slice(0, n);

// A short description of the syllabus for a provider. Built only from the course content: no sign-off (where the preparer,
// reviewer and approver are named), no user data, no catalog snapshot; emails and phone numbers are masked.
function buildExcerpt(content, standard, names = []) {
  const c = content && typeof content === 'object' ? content : {};
  const meta = c.meta && typeof c.meta === 'object' ? c.meta : {};
  const list = (x) => (Array.isArray(x) ? x : []);
  const groups = c.refs && typeof c.refs === 'object' ? c.refs : {};
  return {
    course: { code: clip(meta.code, 20, names), title: clip(meta.title, 80, names), program: clip(meta.program, 20, names), lecture: clip(meta.lecture, 6, names), lab: clip(meta.lab, 6, names) },
    description: clip(list(c.description).map((p) => (p && p.t) || '').join(' '), 400, names),
    clos: list(c.clos).slice(0, 12).map((k, i) => ({ n: i + 1, title: clip(k && k.title, 80, names), statement: clip(k && k.statement, 200, names), egas: list(k && k.egas), pos: list(k && k.pos) })),
    plan: list(c.plan).slice(0, 24).map((r) => ({
      week: clip(r && r.week, 20, names), kind: r && r.kind === 'exam' ? 'exam' : 'lesson',
      ilos: list(r && r.ilos).slice(0, 5).map((il) => clip(il && il.text, 140, names)).filter(Boolean),
      tasks: clip(r && r.tasks, 100, names),
    })),
    grading: list(c.grading && c.grading.rows).slice(0, 10).map((g) => ({ label: clip(g && g.label, 40, names), pct: Number(g && g.pct) || 0 })),
    references: Object.fromEntries(standard.constants.refGroups.map((g) => [g.key, list(groups[g.key] && groups[g.key].items).length])),
  };
}

const scrubFinding = (f, names) => ({
  id: f.id, area: f.area, ruleId: f.ruleId, severity: f.severity, step: f.step, path: f.path,
  message: clip(f.message, 300, names),
  evidence: JSON.parse(redact(JSON.stringify(f.evidence || {}), names)),
});

// ---- what a recommendation is linked to, read from the findings it cites ----
function linksOf(cited) {
  const rows = [];
  const clos = [];
  cited.forEach((f) => {
    const r = /^plan\[(\d+)\]/.exec(f.path);
    if (r && !rows.includes(+r[1])) rows.push(+r[1]);
    const k = /^clos\[(\d+)\]/.exec(f.path);
    if (k && !clos.includes(+k[1] + 1)) clos.push(+k[1] + 1); // CLO numbers are 1-based, as printed on the form
  });
  return {
    step: cited[0].step,
    steps: [...new Set(cited.map((f) => f.step))],
    areas: [...new Set(cited.map((f) => f.area))],
    rows: rows.sort((a, b) => a - b),
    clos: clos.sort((a, b) => a - b),
  };
}

// ---- priority: from the score gap and the area weight, not from the model ----
function priorityOf(areaKeys, result, standard) {
  let value = 0;
  areaKeys.forEach((k) => {
    const a = result.areas.find((x) => x.key === k);
    if (a && a.score !== null) value = Math.max(value, ((100 - a.score) / 100) * a.weight);
  });
  value = Math.round(value * 100) / 100;
  const s = standard.recommendations;
  return { value, level: value >= s.highAt ? 'High' : value >= s.mediumAt ? 'Medium' : 'Low' };
}

function finish(items, result, standard) {
  const byId = new Map(result.findings.map((f) => [f.id, f]));
  return items
    .map((it) => {
      const cited = it.basedOn.map((id) => byId.get(id));
      const links = linksOf(cited);
      return { ...it, ...links, priority: priorityOf(links.areas, result, standard), blocking: cited.filter((f) => f.severity === 'blocking').length };
    })
    .sort((a, b) => b.priority.value - a.priority.value || b.blocking - a.blocking || a.title.localeCompare(b.title))
    .slice(0, standard.recommendations.max)
    .map((it) => ({ source: it.source, title: it.title, text: it.text, basedOn: it.basedOn, step: it.step, steps: it.steps, areas: it.areas, rows: it.rows, clos: it.clos, priority: it.priority.value, level: it.priority.level }));
}

// Checks what a provider returned. Anything that is not an object with a title, a text and at least one real finding id in
// basedOn is dropped. Unknown fields (a priority, a score, an area) are ignored.
function validateItems(raw, result, standard) {
  const ids = new Set(result.findings.map((f) => f.id));
  const seen = new Set();
  const items = [];
  let dropped = 0;
  (Array.isArray(raw) ? raw : []).forEach((it) => {
    const ok = it && typeof it === 'object' && !Array.isArray(it);
    const title = ok && typeof it.title === 'string' ? it.title.replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX) : '';
    const text = ok && typeof it.text === 'string' ? it.text.replace(/\s+/g, ' ').trim().slice(0, TEXT_MAX) : '';
    const basedOn = ok && Array.isArray(it.basedOn) ? [...new Set(it.basedOn.filter((x) => typeof x === 'string' && ids.has(x)))] : [];
    const key = title.toLowerCase();
    if (!title || !text || !basedOn.length || seen.has(key)) { dropped += 1; return; }
    seen.add(key);
    items.push({ source: 'ai', title, text, basedOn });
  });
  return { items, dropped };
}

// One recommendation per failed rule, worded from the standard's own fix title and the rule's messages.
function ruleRecommendations(result, standard) {
  const out = groupByRule(result.findings).map((g) => {
    const rule = standard.rules.find((r) => r.id === g.ruleId);
    return { source: 'rule', title: (rule && rule.fix) || 'Review ' + g.ruleId, text: describe(g.items).slice(0, TEXT_MAX), basedOn: g.items.slice(0, 5).map((f) => f.id) };
  });
  return finish(out, result, standard);
}

const withTimeout = (p, ms) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(Object.assign(new Error('The AI provider took too long.'), { code: 'timeout' })), ms);
  Promise.resolve(p).then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
});

async function recommend({ provider, result, content, standard, names = [], timeoutMs = PROVIDER_TIMEOUT_MS }) {
  const info = { provider: provider ? provider.name : null, model: provider ? provider.model : null, promptVersion: provider ? provider.promptVersion : null };
  if (result.status === 'insufficient') return { items: [], source: 'rule', ai: { ...info, status: 'skipped', reason: 'insufficient', dropped: 0 } };
  if (!result.findings.length) return { items: [], source: 'rule', ai: { ...info, status: 'skipped', reason: 'no_findings', dropped: 0 } };
  try {
    if (!provider) throw Object.assign(new Error('No AI provider is configured.'), { code: 'not_configured' });
    const raw = await withTimeout(provider.recommend(result.findings.map((f) => scrubFinding(f, names)), buildExcerpt(content, standard, names), standard), timeoutMs);
    const { items, dropped } = validateItems(raw, result, standard);
    if (!items.length) throw Object.assign(new Error('The AI returned nothing usable.'), { code: 'empty' });
    return { items: finish(items, result, standard), source: 'ai', ai: { ...info, status: 'ok', dropped } };
  } catch (e) {
    return { items: ruleRecommendations(result, standard), source: 'rule', ai: { ...info, status: 'failed', reason: e.code || 'error', error: String(e.message || e).slice(0, 200), dropped: 0 } };
  }
}

module.exports = { recommend, validateItems, ruleRecommendations, buildExcerpt, redact, priorityOf, linksOf, PROVIDER_TIMEOUT_MS };
