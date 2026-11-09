'use strict';
// Generates docs/vpaa-conformance/*: runs the VPAA conformance suites, reads the real per-test results, and writes the test matrix, the 47-rule coverage
// matrix, the requirements traceability matrix and the final report. Every number in those documents comes from this run.
//
//   node scripts/vpaa-conformance-report.cjs            run the conformance suites and write the documents
//   node scripts/vpaa-conformance-report.cjs --full     also run the whole repository test suite (`npm test`) as the regression run
//
// It never calls Claude or any network service; the conformance tests use scripted model answers only.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const OUT = path.join(root, 'docs/vpaa-conformance');
const DIR = path.join(root, 'server/lib/syllabuscheck/vpaa-conformance');
const { SCENARIOS, KINDS } = require(path.join(DIR, 'scenarios'));
const REQ = require(path.join(DIR, 'requirements'));
const { CASES } = require(path.join(DIR, 'coded-rules.cases'));
const standard = require(path.join(root, 'server/lib/compliance/standard-v4.json'));
const FULL = process.argv.includes('--full');
const md = (rows, head) => `| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|\n${rows.map((r) => `| ${r.map((c) => String(c ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`).join('\n')}\n`;
const esc = (s) => String(s ?? '');

// ---- run the suites -----------------------------------------------------------------------------------------------------------------------
async function runServer() {
  const { run } = require('node:test');
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.test.js')).sort().map((f) => path.join(DIR, f));
  const out = [];
  for await (const ev of run({ files })) {
    if (ev.type !== 'test:pass' && ev.type !== 'test:fail') continue;
    const d = ev.data, m = /^\[([^\]]+)\]/.exec(d.name || '');
    if (!m) continue;
    const todo = !!d.todo;
    out.push({ id: m[1], name: d.name, file: path.basename(d.file || ''), status: todo ? (ev.type === 'test:pass' ? 'KNOWN-ISSUE-FIXED' : 'KNOWN-ISSUE') : ev.type === 'test:pass' ? 'PASS' : 'FAIL', todo: todo ? (typeof d.todo === 'string' ? d.todo : 'todo') : null, ms: Math.round(d.details?.duration_ms ?? 0), error: ev.type === 'test:fail' ? String(d.details?.error?.message || '').split('\n')[0].slice(0, 300) : null });
  }
  return out;
}
function runUi() {
  const r = spawnSync(process.execPath, [path.join(root, 'scripts/test-vpaa-ui.mjs')], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = [];
  for (const line of (r.stdout || '').split(/\r?\n/)) {
    const m = /^([✔✖]) \[([^\]]+)\] (.+?) \(([\d.]+)ms\)$/.exec(line);
    if (m) out.push({ id: m[2], name: `[${m[2]}] ${m[3]}`, file: 'vpaa-conformance-ui.test.jsx', status: m[1] === '✔' ? 'PASS' : 'FAIL', todo: null, ms: Math.round(Number(m[4])), error: null });
  }
  return { tests: out, exit: r.status };
}
function runRegression() {
  const r = spawnSync('npm', ['test'], { cwd: root, encoding: 'utf8', shell: true, maxBuffer: 512 * 1024 * 1024, timeout: 25 * 60 * 1000 });
  const text = (r.stdout || '') + (r.stderr || '');
  const sum = (k) => [...text.matchAll(new RegExp(`^ℹ ${k} (\\d+)`, 'gm'))].reduce((s, m) => s + Number(m[1]), 0);
  const failed = [...text.matchAll(/^✖ (.+?) \(/gm)].map((m) => m[1]).filter((n) => !/^\[VPAA/.test(n));
  return { exit: r.status, tests: sum('tests'), pass: sum('pass'), fail: sum('fail'), todo: sum('todo'), cancelled: sum('cancelled'), skipped: sum('skipped'), failedNames: [...new Set(failed)].slice(0, 30) };
}

// ---- helpers over the results --------------------------------------------------------------------------------------------------------------
function summarize(results, re) {
  const rs = results.filter((r) => re.test(r.id));
  return { n: rs.length, pass: rs.filter((r) => r.status === 'PASS').length, fail: rs.filter((r) => r.status === 'FAIL').length, known: rs.filter((r) => r.status.startsWith('KNOWN')).length, ids: rs.map((r) => r.id) };
}
const verdict = (s) => (!s.n ? 'Not Tested' : s.fail ? 'Failed' : s.known ? 'Passed, with a known issue' : 'Passed');

// existing tests that mention a rule id (excluding this framework)
function existingTestFiles() {
  const out = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (['node_modules', 'tmp', 'dist', '.git', 'vpaa-conformance'].includes(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.test\.(js|cjs|jsx|mjs)$/.test(e.name)) out.push(p); } };
  for (const d of ['server', 'src', 'tests', 'shared']) if (fs.existsSync(path.join(root, d))) walk(path.join(root, d));
  return out;
}
function describeInputs(rule) {
  const p = rule.params || {};
  const parts = [];
  if (p.path) parts.push(p.path); if (p.paths) parts.push(...p.paths); if (p.columns) parts.push('plan columns: ' + p.columns.join(', ')); if (p.field) parts.push('catalog.' + p.field);
  if (p.target) parts.push({ description: 'description', ilo: 'plan[].ilos[].text', clo: 'clos[].title/.statement' }[p.target]); if (p.items) parts.push(`.${p.items} of each item`);
  const byCheck = { tagsResolve: 'plan[].ilos[].tags; clos[].id; program POs/EGAs', iloNumbering: 'plan[].ilos[].text', weeksOrder: 'plan[].week', numberedRequirements: 'reqs[].t', referenceGroups: 'refs.{books,program,online,electronics}', gradingTotal: 'grading.rows[].pct', gradingFormula: 'grading.rows, grading.override, exam rows', signoffRoles: 'signoff; preparer', referenceAge: 'refs.*.items[].t; evaluation year', cloConventions: 'clos[].egas, clos[].pos; program POs/EGAs', cloCoverage: 'clos[].id; plan[].ilos[].tags' + (p.requireColumn ? '; plan[].' + p.requireColumn : ''), examRowsPerTerm: 'plan[] exam rows (Prelim/Midterm/Final)', gradingHasExam: 'grading.rows[].label', contactUnits: 'meta.lecture, meta.lab', weeksCover: 'plan[].week' };
  if (byCheck[rule.check]) parts.push(byCheck[rule.check]);
  return [...new Set(parts.filter(Boolean))].join('; ') || '(see check)';
}

(async () => {
  const startedAt = new Date();
  const server = await runServer();
  const ui = runUi();
  const results = [...server, ...ui.tests];
  const regression = FULL ? runRegression() : null;
  const files = existingTestFiles();
  const texts = files.map((f) => [path.relative(root, f).replace(/\\/g, '/'), fs.readFileSync(f, 'utf8')]);
  fs.mkdirSync(OUT, { recursive: true });
  const w = (name, body) => fs.writeFileSync(path.join(OUT, name), body);
  const by = new Map(results.map((r) => [r.id, r]));
  const counts = { total: results.length, pass: results.filter((r) => r.status === 'PASS').length, fail: results.filter((r) => r.status === 'FAIL').length, known: results.filter((r) => r.status === 'KNOWN-ISSUE').length, fixed: results.filter((r) => r.status === 'KNOWN-ISSUE-FIXED').length };

  // ---- 1. relationship test matrix -------------------------------------------------------------------------------------------------------
  const rows = SCENARIOS.map((s) => [s.id, s.relationship, s.kind, s.expected.judgment ?? '(not asked)', s.expected.disposition, s.rubric === 'defined' ? 'defined' : 'REQUIRES RUBRIC CLARIFICATION', by.get(s.id)?.status || 'NOT RUN']);
  let matrix = `# VPAA relationship test matrix (7 relationships × 5 cases = ${SCENARIOS.length} scenarios)\n\nGenerated ${startedAt.toISOString()} by \`scripts/vpaa-conformance-report.cjs\`. Source of the scenarios: \`server/lib/syllabuscheck/vpaa-conformance/scenarios.js\`.\n\n` +
    `**How to read this.** The syllabus text is controlled and synthetic. The "expected" columns were derived from the requirement text cited in each row, **not** from Claude. The model in these tests is a scripted test double: a PASS shows the *software* builds the right relationship from the right fields, validates the answer, maps it to the right disposition and keeps its evidence and recommendation behaviour. It does **not** show how Claude would judge this text. Where the requirements do not say where "aligned" ends and "partially aligned" begins, the row is marked **REQUIRES RUBRIC CLARIFICATION** and the test asserts only invariants (never a pass, faculty review required, nothing auto-applied), not a specific academic label.\n\n## Summary\n\n` +
    md(rows, ['Test ID', 'VPAA relationship', 'Case', 'Expected judgment', 'Expected disposition', 'Expected-answer basis', 'Software result']);
  for (const r of REQ.RELATIONSHIPS) {
    matrix += `\n## ${r.id} — ${r.label}\n\n- **Source:** ${r.source}\n- **Implementation:** ${r.implementation}\n- **Fields:** source = ${r.fields.source}; target = ${r.fields.target}\n- **Active in the application when:** ${r.activation.join(' ')}\n`;
    for (const s of SCENARIOS.filter((x) => x.n === r.n)) {
      const res = by.get(s.id);
      matrix += `\n### ${s.id} — ${s.kind}: ${s.title}\n\n` + md([
        ['VPAA relationship', s.relationship], ['Syllabus input', '`' + JSON.stringify(s.input) + '`' + (s.extra ? ' (+ a second CLO and tag set up by the scenario)' : '')], ['Relevant academic context', s.context],
        ['Expected judgment', esc(s.expected.judgment ?? 'none: the model must not be asked')], ['Expected disposition', s.expected.disposition], ['Expected evidence requirements', s.evidence],
        ['Expected recommendation behavior', s.recommendation], ['Source of the expected result', s.source], ['Rubric', s.rubric === 'defined' ? 'defined by the cited requirement' : '**requires rubric clarification** — no official partial/aligned threshold; the label is not asserted'],
        ['Pass/fail criteria', s.pass], ['Software result', `**${res?.status || 'NOT RUN'}**${res?.error ? ' — ' + res.error : ''}`],
      ], ['Field', 'Value']);
    }
  }
  w('test-matrix.md', matrix);
  w('test-matrix.json', JSON.stringify(SCENARIOS.map((s) => ({ ...s, extra: undefined, softwareResult: by.get(s.id)?.status || 'NOT RUN' })), null, 2));

  // ---- 2. coded rules coverage matrix ----------------------------------------------------------------------------------------------------
  const HYBRID_OFF = new Set(['C-04', 'R-02', 'R-03']);
  const ruleRows = standard.rules.map((rule) => {
    const c = CASES[rule.id], res = by.get('VPAA-R11-' + rule.id);
    const existing = texts.filter(([, t]) => new RegExp(`['"\`]${rule.id}['"\`]|\\b${rule.id}\\b`).test(t)).map(([f]) => f);
    const behaviour = c.scope ? `scope-limited: still applies and passes on its narrow property; companion ${c.companion.join(', ')} flags the absence` : c.na ? `neutral (not applicable): no credit, no deduction${(c.companion || []).length ? '; companion ' + c.companion.join(', ') + ' flags it' : '; no companion rule'}` : 'finding raised, credit withheld';
    const gaps = [];
    if (HYBRID_OFF.has(rule.id)) gaps.push('not applied in Hybrid-2 (replaced by link checks)');
    if (!existing.length) gaps.push('no pre-existing automated test names this rule (it may be exercised indirectly); now covered here');
    if (['nonEmpty', 'columnsFilled', 'textLength', 'iloNumbering', 'referenceGroups', 'numberedRequirements', 'gradingHasExam'].includes(rule.check)) gaps.push('presence/form only: placeholder text (TBD, n/a) and invisible-only text satisfy it (LIM-01, DEF-01)');
    if (c.note && /Tautological/.test(c.note)) gaps.push('earns credit by construction while the grading override is off');
    if (c.note && /Partial credit/.test(c.note)) gaps.push('partial credit (fraction of the rule\'s share), by design');
    if (c.na && !(c.companion || []).length) gaps.push('skipped for drafts / when its context is absent; nothing else covers that case');
    return { id: rule.id, area: rule.area, severity: rule.severity, weight: rule.weight, check: rule.check, requirement: rule.message.replace(/\{(\w+)\}/g, '‹$1›'), fix: rule.fix, inputs: describeInputs(rule), valid: ['the conforming syllabus', ...(c.valid || []).map((v) => v[0])], invalid: c.invalid[0], missing: c.missing[0], behaviour, existing, hybrid: HYBRID_OFF.has(rule.id) ? 'NOT APPLIED' : 'applied', result: res?.status || 'NOT RUN', gaps, note: c.note || '' };
  });
  let cov = `# Coverage matrix: the 47 deterministic compliance rules\n\nGenerated ${startedAt.toISOString()}. Source of the rules: \`server/lib/compliance/standard-v4.json\` (pass mark **${standard.passThreshold}**, six weighted areas ${standard.areas.map((a) => `${a.key} ${a.weight}`).join(', ')}). Each rule was tested **in isolation** with a valid case, an invalid case and a missing-field case (\`coded-rules.cases.js\`), then again inside the full standard.\n\n` +
    `**Missing-field classes.** *finding raised*: the rule flags the absence. *neutral*: the rule has nothing to judge, so it contributes neither credit nor deduction (a companion rule is expected to flag the absence). *scope-limited*: the rule judges one narrow property, still applies, and passes on it; a companion flags the absence.\n\n## Summary\n\n` +
    md(ruleRows.map((r) => [r.id, r.area, r.severity, r.weight, r.check, r.hybrid, r.behaviour.split(':')[0], r.existing.length, r.result]), ['Rule', 'Area', 'Severity', 'Weight', 'Check', 'In Hybrid-2', 'Missing-field class', 'Existing tests naming it', 'Conformance result']) + '\n## Rule by rule\n\n';
  for (const r of ruleRows) {
    cov += `### ${r.id} — ${r.check} (${r.severity}, ${r.area}, weight ${r.weight})\n\n` + md([
      ['Official requirement (the rule\'s own message)', r.requirement], ['Input fields', r.inputs], ['Expected valid behavior', 'No finding, full credit: ' + r.valid.join('; ')], ['Expected invalid behavior', `Finding with severity ${r.severity}, area ${r.area}, field path and filled-in message, credit withheld: ${r.invalid}` + (r.severity === 'blocking' ? '; blocks the submit whatever the score' : '')],
      ['Missing-field handling', `${r.missing} → ${r.behaviour}`], ['Recommendation behavior', `Rule-based fix shown to the author: "${r.fix}" (no AI involved)`], ['Applied in Hybrid-2', r.hybrid],
      ['Existing automated tests naming this rule', r.existing.length ? r.existing.slice(0, 6).join('<br>') + (r.existing.length > 6 ? `<br>… +${r.existing.length - 6} more` : '') : 'none'], ['Conformance result (this framework)', `**${r.result}**`], ['Coverage gaps / notes', [...r.gaps, r.note].filter(Boolean).join('; ') || 'none identified'],
    ], ['Item', 'Detail']) + '\n';
  }
  w('coded-rules-coverage.md', cov);
  w('coded-rules-coverage.json', JSON.stringify(ruleRows, null, 2));

  // ---- 3. traceability matrix ------------------------------------------------------------------------------------------------------------
  const rel = (n) => new RegExp(`^VPAA-R${n}-(ALIGNED|MISALIGNED|PARTIAL|INSUFFICIENT|ADVERSARIAL)$`);
  const TR = [
    ...REQ.RELATIONSHIPS.map((r) => ({ r, tests: [rel(r.n)], extra: /^VPAA-(ACTIVATION|MAPPING|LEGACY-PARITY)$|^VPAA-V2-(SEVEN|NO-DUPLICATES)$/, limits: [`Active in the application only with ${r.activation.join(' ')}.`, 'Academic accuracy of real Claude on this relationship is NOT measured (scripted model).', 'Partial-alignment threshold requires rubric clarification (scenario ' + SCENARIOS.find((s) => s.n === r.n && s.kind === 'partial').id + ').'] })),
    { r: REQ.byId['VR-08'], tests: [/^VPAA-R8-/], limits: ['Requires SYLLABUS_CHECK_ACADEMIC_V2=on (off by default).', 'A CLO with no saved classification is not judged and no classification is assumed; it is reported with its CLO number and what to do (DEF-02, resolved as fail-safe and actionable).', 'Whether a statement suits its classification is an academic judgement, not measured.'] },
    { r: REQ.byId['VR-09'], tests: [/^VPAA-DESCRIPTION-EXCLUSION/], limits: ['GAP-01 resolved without changing default requests: SYLLABUS_CHECK_CLO_DESCRIPTION=off withholds the description from requests that carry a CLO relationship; the service sets it while Policy V2 is on. It is unset by default, so legacy-only requests are byte for byte unchanged and still carry the description.', 'The description can still appear as the OWN evidence of a Description-plan or Plan-sequence pair that shares a batch with CLO pairs (as in Policy V2).'] },
    { r: REQ.byId['VR-10'], tests: [/^VPAA-R10-/, /^VPAA-R11-(COUNT|BASELINE|HYBRID-44)$/, /^VPAA-V2-(SCORE-PARITY|BASELINE-PARITY|GATES)$/], limits: ['Hybrid-2 official score is withheld (null) until the AI check completes; the coded base score is shown as provisional.', 'Verdict weights (20/25/25/20/10) are an unapproved proposal and are not tested as policy.'] },
    { r: REQ.byId['VR-11'], tests: [/^VPAA-R11-[TCPAHR]-\d\d$/, /^VPAA-R11-PLACEHOLDER$/], limits: ['44 of 47 rules apply in Hybrid-2; C-04, R-02, R-03 are replaced by link checks (institutional decision).', 'LIM-01: rules test presence and form, not quality; placeholder text earns presence credit.', 'DEF-01 resolved: invisible-only text no longer counts as written.'] },
    { r: REQ.byId['VR-12'], tests: [/^VPAA-R12-/, /^VPAA-T5-SYNTHETIC-GUARD$/, /^VPAA-V2-(OFFLINE|BUDGET)$/], limits: ['Timeouts are simulated with HTTP 504; no wall-clock timeout was exercised.', 'DEF-03 resolved: V2 live-call counts are the requests actually sent.', 'A bad answer multiplies requests (bounded by the per-check budget, default 512).'] },
    { r: REQ.byId['VR-13'], tests: [/^VPAA-R13-/, /^VPAA-T5-(RECOMMEND-FLOW|APPROVAL-GATES|STALE)$/], limits: ['CLAR-01: outside Policy V2 an Accept is recorded without a Check & Improve token (institutional decision).', 'DEF-04 resolved: tokens are signed only with a configured SESSION_SECRET of at least 16 characters; without one the server fails closed (503).', 'Replay protection is per-process memory.', 'server/index.js still falls back to a public default for the SESSION cookie secret (not in scope here).'] },
    { r: REQ.byId['VR-14'], tests: [/^VPAA-CONTENT-FIRST$/], limits: ['UI-level guard for NEW lesson rows only; the server does not reject an ILO saved without content.'] },
    { r: REQ.byId['VR-15'], tests: [/^VPAA-R15-/, /^VPAA-INSUFFICIENT-JUNK$/, /^VPAA-PRESENCE-/, /^VPAA-T5-(SUBMIT-GATE|WORKFLOW|STAGES-VIA-SERVICE|UI-.*)$/], limits: ['DEF-01 resolved (invisible-only text is blank).', 'DEF-05 (fixed): every Stage flag used to make the AI step fail through the shared service.'] },
    { r: REQ.byId['VR-16'], tests: [/^VPAA-V2-(SEVEN|PERSISTENCE|NO-DUPLICATES|SCORE-PARITY|BASELINE-PARITY|GATES|BUDGET|STAGING-CONFIG)$/], limits: ['Policy V2 is OFF by default and has not been activated anywhere; the staging procedure is in POLICY-V2-ACTIVATION.md.', 'ILO ↔ CLO and ILO ↔ Activities are asked by both paths by design (scored in the legacy path).', 'Stage B and C3 (and Plan-sequence) are held off while V2 is on.'] },
    { r: REQ.byId['VR-18'], tests: [/^VPAA-SEC-/, /^VPAA-R13-SECRET/], limits: ['Hardened only when NODE_ENV is staging or production; any other mode uses a random per-process secret (sessions end on restart), never a constant.', 'Credentials exposed in earlier chats must be rotated by a person: nothing is rotated automatically.'] },
    { r: REQ.byId['VR-20'], tests: [/^VPAA-HOST-/, /^VPAA-SEC-FAIL-CLOSED$/], limits: ['Verified offline against a real HTTP listener with controlled Origin headers; browser behavior on the real staging host (certificate, proxy headers, SameSite handling) is checked by the owner after deployment (STAGING-SETUP-CHECKLIST.md section G).', 'The staging frontend origin and the proxy hop count are deployment facts supplied by the owner; none is built in.', 'The default MemoryStore session store is unchanged (sessions end on restart, one process only).'] },
    { r: REQ.byId['VR-19'], tests: [/^VPAA-STG-/], limits: ['No live provider was called; the live smoke test is a separately authorized step (STAGING-TEST-PLAN.md).', 'The staging environment itself (credentials, database, NODE_ENV, host settings) still needs manual steps.', 'The in-app cost figure is a conservative reservation, not spend.'] },
    { r: REQ.byId['VR-17'], tests: [/^VPAA-V2-(OFFLINE|COVERAGE-REPORT|UI-COVERAGE|UI-BLANK-CLO)$/], limits: ['Coverage is advisory data computed from the report; it never feeds a score or a gate.', 'The warning chip is shown only when the check is incomplete.'] },
  ];
  const trRows = TR.map(({ r, tests, extra, limits }) => {
    const ids = [...new Set(results.filter((x) => tests.some((re) => re.test(x.id)) || (extra && extra.test(x.id))).map((x) => x.id))];
    const sel = results.filter((x) => ids.includes(x.id));
    const s = { n: sel.length, pass: sel.filter((x) => x.status === 'PASS').length, fail: sel.filter((x) => x.status === 'FAIL').length, known: sel.filter((x) => x.status.startsWith('KNOWN')).length };
    const clar = r.clarification || (r.n ? 'partial-threshold rubric' : '');
    const status = [r.n || r.id ? 'Implemented' : '', s.n ? 'Tested' : 'Not Tested', s.fail ? 'Failed' : s.n ? 'Passed' : '', s.known ? 'Known issue open' : '', clar ? 'Requires Clarification' : ''].filter(Boolean).join(' · ');
    return { id: r.id, requirement: r.label, source: r.source, implementation: r.implementation, activation: (r.activation || []).join(' '), tests: ids, counts: s, status, limits, clarification: clar };
  });
  let trace = `# VPAA requirements traceability matrix\n\nGenerated ${startedAt.toISOString()}. A requirement is **Implemented** when production code for it exists, **Tested** when at least one conformance test targets it, **Passed** only when every non-known-issue test passed. A passing test does **not** declare a rule academically correct, and these tests do not measure Claude's accuracy.\n\n## Summary\n\n` +
    md(trRows.map((t) => [t.id, t.requirement, `${t.counts.pass}/${t.counts.n}`, t.counts.fail, t.counts.known, t.status]), ['Req', 'VPAA requirement', 'Tests passed', 'Failed', 'Known issues', 'Status']) + '\n## Detail\n\n';
  for (const t of trRows) trace += `### ${t.id} — ${t.requirement}\n\n` + md([['VPAA requirement source', t.source], ['Implementation', t.implementation], ['Active in the application when', t.activation || 'n/a'], ['Test cases', `${t.tests.length} test(s): ` + t.tests.map((i) => '`' + i + '`').join(', ')], ['Test results', `${t.counts.pass} passed, ${t.counts.fail} failed, ${t.counts.known} known issue(s)`], ['Status', t.status], ['Requires clarification', t.clarification || 'no'], ['Remaining limitations', t.limits.join(' ')]], ['Item', 'Detail']) + '\n';
  w('traceability-matrix.md', trace);
  w('traceability-matrix.json', JSON.stringify(trRows, null, 2));

  // ---- 4. machine-readable results + final report ----------------------------------------------------------------------------------------
  const meta = { generatedAt: startedAt.toISOString(), node: process.version, platform: process.platform, counts, regression, uiExit: ui.exit };
  w('results.json', JSON.stringify({ meta, tests: results }, null, 2));
  const g = (re) => summarize(results, re);
  const ruleSum = summarize(results, /^VPAA-R11-[TCPAHR]-\d\d$/), relSum = summarize(results, /^VPAA-R[1-7]-(ALIGNED|MISALIGNED|PARTIAL|INSUFFICIENT|ADVERSARIAL)$/);
  const known = results.filter((r) => r.status.startsWith('KNOWN'));
  const report = fs.readFileSync(path.join(__dirname, 'vpaa-conformance-report.template.md'), 'utf8')
    .replaceAll('{{GENERATED}}', startedAt.toISOString()).replaceAll('{{NODE}}', process.version)
    .replaceAll('{{TOTAL}}', counts.total).replaceAll('{{PASS}}', counts.pass).replaceAll('{{FAIL}}', counts.fail).replaceAll('{{KNOWN}}', counts.known).replaceAll('{{FIXED}}', counts.fixed)
    .replaceAll('{{CLASS_COUNTS}}', ['finding raised, credit withheld', 'neutral', 'scope-limited'].map((k) => `${ruleRows.filter((x) => x.behaviour.startsWith(k)).length} ${k === 'neutral' ? 'neutral when the field is absent' : k === 'scope-limited' ? 'scope-limited' : 'flag a missing field'}`).join(', '))
    .replaceAll('{{UNNAMED}}', ruleRows.filter((x) => !x.existing.length).length + ' (' + ruleRows.filter((x) => !x.existing.length).map((x) => x.id).join(', ') + ')')
    .replaceAll('{{REL_N}}', relSum.n).replaceAll('{{REL_PASS}}', relSum.pass).replaceAll('{{RULE_N}}', ruleSum.n).replaceAll('{{RULE_PASS}}', ruleSum.pass)
    .replaceAll('{{REGRESSION}}', regression ? `${regression.tests} tests across the whole repository, ${regression.pass} passed, ${regression.fail} failed, ${regression.todo} marked todo (npm test exit code ${regression.exit}; this includes the ${counts.total} conformance tests)` : 'not run in this invocation (use --full)')
    .replaceAll('{{KNOWN_TABLE}}', known.length ? md(known.map((k) => [k.id, k.status, k.todo]), ['Test', 'Status', 'Known issue']) : '**No test is marked `todo`: every issue found earlier is fixed and covered by a passing regression test, or is a documented limitation that needs an institutional decision.**')
    .replaceAll('{{BY_FILE}}', md([...new Set(results.map((r) => r.file))].sort().map((f) => { const rs = results.filter((r) => r.file === f); return [f, rs.length, rs.filter((r) => r.status === 'PASS').length, rs.filter((r) => r.status === 'FAIL').length, rs.filter((r) => r.status.startsWith('KNOWN')).length]; }), ['Suite', 'Tests', 'Passed', 'Failed', 'Known issues']))
    .replaceAll('{{FAILED_LIST}}', results.filter((r) => r.status === 'FAIL').map((r) => `- ${r.id}: ${r.error}`).join('\n') || 'None.');
  w('REPORT.md', report);
  console.log(JSON.stringify({ ...counts, regression: regression && { exit: regression.exit, tests: regression.tests, pass: regression.pass, fail: regression.fail, todo: regression.todo }, uiExit: ui.exit }));
  process.exitCode = counts.fail || ui.exit ? 1 : 0;
})();
