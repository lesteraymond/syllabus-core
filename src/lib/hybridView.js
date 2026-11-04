// Presentation-only shaping of run.hybrid for the checker panel. The server stays authoritative: nothing here
// changes a score, a gate or a decision, it only groups what the server already sent into "what is wrong".
// INSUFFICIENT_EVIDENCE is a relationship the AI answered but the server could not verify: it blocks the submit, so it is a problem too.
const SEVERITY_OF_LABEL = { NOT_ALIGNED: 'high', INSUFFICIENT_EVIDENCE: 'high', PARTIALLY_ALIGNED: 'medium' };

// Every problem the author can act on, most serious first: a curriculum-critical finding, each point deduction,
// and each AI relationship that is not fully aligned.
// `key` is the id the server uses for the same finding in deductions and in a recommendation's `basedOn` (SEM:<pair id>, VALUE:<path>),
// so a problem can be matched to the recommendation that fixes it. An AI relationship is both a judgement and a point deduction on the
// server; here it is one problem that carries its points, not two entries.
export function problemsOf(hybrid, run) {
  if (!hybrid) return [];
  const out = [];
  if (hybrid.critical) {
    const f = run?.findings?.find((x) => x.ruleId === 'CUR-CODE');
    if (f?.message) out.push({ id: 'critical', key: 'CUR-CODE', kind: 'critical', severity: 'high', title: f.message });
  }
  const aligned = new Map();
  // Advisory relationships (the server's policy.advisoryTypes, carried in the report, plus a reference page) give no points and no block, so they
  // are always "improve" and never "fix first". Reports made before the policy listed them only know the reference page.
  const advisoryTypes = new Set(['REF-plan', ...(hybrid.policy?.advisoryTypes || [])]);
  for (const j of hybrid.alignment?.judgements || []) {
    if (j.unverified && String(j.failureKind || '').startsWith('provider_')) continue; // the provider failed before it was checked: not a problem in the syllabus
    const advisory = advisoryTypes.has(j.type);
    const severity = advisory ? (j.label === 'ALIGNED' ? undefined : 'medium') : SEVERITY_OF_LABEL[j.label];
    if (!severity) continue;
    const p = {
      id: 'alignment:' + j.id, key: 'SEM:' + j.id, kind: 'alignment', severity, label: j.label, type: j.type, advisory,
      where: j.type === 'REF-plan' ? undefined : j.path, title: j.type === 'REF-plan' ? String(j.path || '').replace(/^refs:/, '') : String(j.type || '').replaceAll('_', ' '),
      detail: j.explanation, sourceQuote: j.sourceQuote, targetQuote: j.targetQuote,
    };
    aligned.set(p.key, p);
    out.push(p);
  }
  for (const d of hybrid.deductions || []) {
    const same = aligned.get(d.id);
    if (same) { same.points = d.points; continue; }
    out.push({ id: 'deduction:' + d.id, key: d.id, kind: 'deduction', severity: 'high', title: d.reason, points: d.points, ref: d.id });
  }
  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1));
}

// Which problems each recommendation fixes (by its basedOn ids), and which problems have no draft to accept.
export function linkProblems(problems, suggestions) {
  const fixed = new Set();
  const forSuggestion = {};
  for (const s of suggestions || []) {
    const ids = new Set([s.id, ...(s.basedOn || [])]);
    forSuggestion[s.id] = problems.filter((p) => ids.has(p.key));
    forSuggestion[s.id].forEach((p) => fixed.add(p.id));
  }
  return { forSuggestion, unlinked: problems.filter((p) => !fixed.has(p.id)) };
}

export function groupBySeverity(problems) {
  return [
    { key: 'high', items: problems.filter((p) => p.severity === 'high') },
    { key: 'medium', items: problems.filter((p) => p.severity === 'medium') },
  ].filter((g) => g.items.length);
}

// base − deductions = score, as three figures the card can lay out as an equation.
export function scoreBreakdown(hybrid) {
  const deducted = (hybrid?.deductions || []).reduce((sum, d) => sum + (Number(d.points) || 0), 0);
  return { base: hybrid?.baseScore ?? null, deducted, score: hybrid?.score ?? null };
}

// Which kind of change a recommendation proposes, so the card can name it.
export function suggestionKind(path) {
  const p = String(path || '');
  if (/^clos\[/.test(p)) return 'clo';
  if (/\.ilos\[/.test(p)) return 'ilo';
  if (/^plan\[/.test(p)) return 'plan';
  if (/^outcomes\./.test(p)) return 'outcomes';
  if (/^meta\./.test(p)) return 'meta';
  return 'other';
}

// Which recommendations can be checked and improved: an AI rewrite of a text field (the same fields the server accepts).
export const canRefine = (s) => !!s && s.source === 'ai' && typeof s.replacement === 'string'
  && /^(?:clos\[\d+\]\.statement|plan\[\d+\]\.(?:values|contents|activities|tasks)|plan\[\d+\]\.ilos\[\d+\]\.text)$/.test(String(s.path));
