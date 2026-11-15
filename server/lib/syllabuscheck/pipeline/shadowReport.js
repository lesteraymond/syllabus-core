'use strict';
// Re-planned AI Checker: the side-by-side view of shadow results (scripts/replan-shadow-report.cjs). Pure: it formats stored check reports that
// carry hybrid.replanShadow next to the official (old checker) numbers of the same check. No database, no network, no AI.

const money = value => (Number.isFinite(value) ? '$' + value.toFixed(4) : '-');
const when = value => { const d = value instanceof Date ? value : new Date(value); return Number.isNaN(d.getTime()) ? '-' : d.toISOString().slice(0, 16).replace('T', ' '); };

// Where the shadow kept its answers (shadow.js usage.store), in words.
function storeLine(store) {
  if (!store) return null;
  const back = store.kind === 'layered' ? store.back : store.kind === 'database' ? store : null;
  if (!back) return 'memory only (lost when the server restarts)';
  if (back.available === false) return `memory only: ${back.problem}`;
  return `database (${back.hits} reused from it, ${back.writes} saved)`;
}

// One stored check -> the numbers the report shows. row: { run_id, syllabus_id, created_at, overall, course_code, title, report_json }.
function summarize(row) {
  let report = null;
  try { report = typeof row.report_json === 'string' ? JSON.parse(row.report_json) : row.report_json; } catch { /* reported as unreadable below */ }
  const hybrid = report?.hybrid || {};
  const shadow = hybrid.replanShadow || null;
  const base = {
    run: row.run_id, syllabus: row.syllabus_id, at: when(row.created_at), course: [row.course_code, row.title].filter(Boolean).join(' ') || '(unknown course)',
    official: {
      score: Number.isFinite(row.overall) ? row.overall : (report?.score ?? hybrid.score ?? null),
      deductions: Array.isArray(hybrid.deductions) ? hybrid.deductions.length : null,
      suggestions: Array.isArray(hybrid.suggestions) ? hybrid.suggestions.length : null,
    },
  };
  if (!report) return { ...base, state: 'unreadable', note: 'the stored report is not valid JSON' };
  if (!shadow) return { ...base, state: 'none', note: 'no shadow result (shadow mode was off, or the check ran without AI)' };
  if (shadow.error) return { ...base, state: 'error', note: shadow.error };
  if (shadow.skipped) return { ...base, state: 'skipped', note: shadow.skipped };
  const s = shadow.summary || {}, usage = shadow.usage || {}, provider = usage.provider || {};
  return {
    ...base, state: s.complete ? 'complete' : 'incomplete', mode: shadow.mode, versions: shadow.versions || null,
    shadow: {
      misalignments: s.misalignments ?? null, deductions: s.deductions ?? null, review: s.review ?? null, advice: s.advice ?? null, notChecked: s.notChecked ?? null,
      byRule: shadow.byRule || {}, requests: usage.requests ?? null, reused: usage.reused ?? null, ms: usage.ms ?? null,
      estimatedUsd: Number.isFinite(provider.estimatedUsd) ? provider.estimatedUsd : null, capStop: provider.budget?.stopReason || null,
      store: storeLine(usage.store),
    },
    misalignments: Array.isArray(shadow.misalignments) ? shadow.misalignments : [],
    // null: a shadow stored before these lists were kept (2026-11-15), so they cannot be shown
    review: Array.isArray(shadow.review) ? shadow.review : null,
    notChecked: Array.isArray(shadow.notChecked) ? shadow.notChecked : null,
    advice: Array.isArray(shadow.advice) ? shadow.advice : null,
    plan: shadow.plan || null,
  };
}

const pad = (text, width) => { const t = String(text ?? '-'); return t.length > width ? t.slice(0, width - 1) + '…' : t.padEnd(width); };
const topRules = byRule => Object.entries(byRule || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([rule, n]) => `${rule}×${n}`).join(', ') || '-';

// The list view: one line per check, newest first.
function renderList(items) {
  if (!items.length) return 'No stored checks with a shadow result yet. Run an AI check in the app with SYLLABUS_CHECK_REPLAN=shadow, then try again.';
  const head = `${pad('run', 6)} ${pad('when (UTC)', 17)} ${pad('course', 34)} ${pad('official', 18)} ${pad('new checker', 34)} ${pad('cost', 9)} top rules`;
  const lines = items.map(i => {
    const official = `score ${i.official.score ?? '-'} / ${i.official.deductions ?? '-'} ded`;
    const shadow = i.shadow ? `${i.shadow.misalignments} mis, -${i.shadow.deductions} pts, ${i.state}${i.shadow.notChecked ? ` (${i.shadow.notChecked} unchecked)` : ''}` : i.state;
    const line = `${pad(i.run, 6)} ${pad(i.at, 17)} ${pad(i.course, 34)} ${pad(official, 18)} ${pad(shadow, 34)} ${pad(i.shadow ? money(i.shadow.estimatedUsd) : '-', 9)} ${i.shadow ? topRules(i.shadow.byRule) : ''}`.trimEnd();
    // why a check has no shadow numbers, in full on its own line
    return i.shadow ? line : `${line}\n${' '.repeat(7)}-> ${i.note}`;
  });
  return [head, '-'.repeat(head.length), ...lines].join('\n');
}

// The detail view of one check: both checkers' numbers, then every misalignment the new checker found, then its plan when shadow mode was 'plan'.
function renderDetail(item, { max = 60 } = {}) {
  const out = [`Run ${item.run} · ${item.course} · ${item.at} UTC`, `Official (old checker): score ${item.official.score ?? '-'}, ${item.official.deductions ?? '-'} deductions, ${item.official.suggestions ?? '-'} suggestions`];
  if (!item.shadow) return [...out, `New checker: ${item.state}: ${item.note}`].join('\n');
  const s = item.shadow;
  out.push(`New checker (${item.mode}, ${item.versions?.prompt || '?'}): ${s.misalignments} misalignments, -${s.deductions} points (uncapped), ${s.review} for review, ${s.advice} advice, ${s.notChecked} not checked, ${item.state}`);
  out.push(`Requests ${s.requests ?? '-'} (reused answers ${s.reused ?? '-'}), ${s.ms != null ? Math.round(s.ms / 1000) + ' s' : '-'}, estimated ${money(s.estimatedUsd)}${s.capStop ? `, stopped by the cap (${s.capStop})` : ''}`);
  if (s.store) out.push(`Answers kept in: ${s.store}`);
  out.push('', 'Misalignments found by the new checker:');
  if (!item.misalignments.length) out.push('  none');
  for (const m of item.misalignments.slice(0, max)) out.push(`  [${m.source === 'ai' ? (m.status || 'ai') : 'rule'}] ${m.rule}${m.label ? ' · ' + m.label : m.where?.week ? ' · Week ' + m.where.week : ''}: ${String(m.message || '').replace(/\s+/g, ' ').slice(0, 220)}`);
  if (item.misalignments.length > max) out.push(`  … and ${item.misalignments.length - max} more`);
  const section = (title, list, empty) => {
    out.push('', title);
    if (list === null) { out.push('  not stored for this check (it ran before these lists were kept); run a new check to see them'); return; }
    if (!list.length) { out.push(`  ${empty}`); return; }
    for (const m of list.slice(0, max)) {
      const where = m.label ? ' · ' + m.label + (m.against ? ' vs ' + m.against : '') : m.where?.week ? ' · Week ' + m.where.week : m.where?.ref ? ' · reference ' + m.where.ref : '';
      out.push(`  [${m.source === 'rule' ? 'rule' : m.verdict || m.status}] ${m.rule}${where}: ${String(m.message || '').replace(/\s+/g, ' ').slice(0, 220)}`);
    }
    if (list.length > max) out.push(`  … and ${list.length - max} more`);
  };
  section('For faculty review (no penalty):', item.review, 'none');
  section('Not checked (no valid answer, or "unclear"; never a pass, never a deduction):', item.notChecked, 'none');
  section('Advice (no points):', item.advice, 'none');
  if (item.plan) {
    out.push('', `Repair plan: ${item.plan.clean ? 'clean after the plan' : 'not clean'}, ${item.plan.changes?.length || 0} changes, ${item.plan.unresolved?.length || 0} unresolved, ${item.plan.manual?.length || 0} for the author`);
    for (const c of (item.plan.changes || []).slice(0, max)) out.push(`  ${c.status} ${c.label}: "${String(c.before || '').slice(0, 80)}" -> "${String(c.after || '').slice(0, 120)}"`);
  }
  out.push('', 'Comparison only: the official score, findings and suggestions come from the old checker.');
  return out.join('\n');
}

module.exports = { summarize, renderList, renderDetail };
