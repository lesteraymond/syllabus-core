'use strict';
// Browser scenarios for the comprehensive profile. They share one synthetic syllabus (IT 204) through ctx.state and run in workflow order. Each check states
// whether it was read from the REAL BROWSER UI (page text / clicks / screenshots) or from the REAL API (the saved report). Nothing is mocked in the browser.
const fs = require('node:fs');
const path = require('node:path');
const { SECOND } = require('./seed-e2e.cjs');

module.exports = async function run(ctx, h) {
  const { scenario, check, known, note, evidence, assertClean, L, harness, LEVELS, RELATIONSHIPS, DESCRIPTION, RESERVED, ROOT } = h;
  const { stack, browser, state } = ctx;
  const { content: sample } = harness.sample();
  const sections = { clos: sample.clos.map((clo, i) => ({ ...clo, level: LEVELS[i] })), plan: sample.plan, reqs: sample.reqs, refs: sample.refs, grading: sample.grading, outcomes: sample.outcomes };
  const idOf = async (s) => { const list = await s.api('GET', '/syllabi'); const rows = Array.isArray(list.body) ? list.body : list.body?.syllabi || []; return (rows.find((r) => /IT 204/.test(r.course_code || r.courseCode || '')) || {}).syllabus_id ?? (rows[0] || {}).id; };
  const savedRun = async (s, id = state.syllabusId) => (await s.api('GET', '/compliance?syllabus=' + id)).body?.run;
  const providerCount = () => stack.providerEvents().filter((e) => e.kind === 'provider').length;
  // a screenshot of the union of several page regions (document coordinates), so one image can show e.g. all seven VPAA rows
  const regionShot = async (page, locators, file, { pad = 12, maxH = 2600 } = {}) => {
    const boxes = [];
    for (const loc of locators) { const n = await loc.count(); for (let i = 0; i < n; i++) boxes.push(await loc.nth(i).evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, r: r.right + scrollX, b: r.bottom + scrollY }; })); }
    if (!boxes.length) return false;
    const x = Math.max(0, Math.min(...boxes.map((b) => b.x)) - pad), y = Math.max(0, Math.min(...boxes.map((b) => b.y)) - pad);
    const right = Math.max(...boxes.map((b) => b.r)) + pad, bottom = Math.min(Math.max(...boxes.map((b) => b.b)) + pad, y + maxH);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file, fullPage: true, clip: { x, y, width: Math.min(right - x, 1440), height: bottom - y } });
    return true;
  };
  const openCoverage = async (s) => {
    const summary = s.page.locator('summary', { hasText: /Check coverage/ }).first();
    await summary.waitFor();
    if (!(await summary.evaluate((el) => el.parentElement.open))) await summary.click();
    await s.page.waitForTimeout(500);
    return s.page.locator('details', { has: s.page.locator('summary', { hasText: /Check coverage/ }) }).first();
  };
  const rowOf = (details, id) => details.locator('li', { has: details.page().locator('code', { hasText: new RegExp('^' + id.replace(/[:.]/g, (c) => '\\' + c) + '$') }) }).first();

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('K01', 'Syllabus Builder (browser): faculty completes the syllabus (Step 1 through the form, Steps 2–6 saved through the API) and opens the review step', async () => {
    // Step 1 locks the subject's term for faculty (the administrator owns year level, pre-requisite and semester), so the administrator sets IT 204's term first and the faculty form then shows it read-only.
    const setTerm = async () => { const adm = await L.session(browser, stack); await adm.loginOk('admin'); const done = await adm.api('PUT', '/courses/10', { code: 'IT 204', title: (await adm.api('GET', '/courses/10')).body.title, semester: '1st Semester', yearLevel: 2, prerequisite: 'IT 202 - Programming 1' }); await adm.close(); if (done.status !== 200) throw new Error('the administrator could not set the subject term (HTTP ' + done.status + ')'); };
    await setTerm();
    const s = await L.session(browser, stack);
    await s.loginOk('faculty');
    await s.nav('My Syllabi');
    await s.page.getByRole('button', { name: /new syllabus/i }).click();
    await s.page.waitForTimeout(2000);
    await s.pick(/Choose a program/, /BSIT/);
    await s.pick(/Choose a subject/, /IT 204/);
    await s.page.locator('[placeholder="Lecture units"],[aria-label="Lecture units"]').first().fill('2');
    await s.page.locator('[placeholder="Laboratory units"],[aria-label="Laboratory units"]').first().fill('1');
    await s.page.locator('[placeholder="For example, 2022-2023"],[aria-label="For example, 2022-2023"]').first().fill('test-2026');
    check(!(await s.page.getByLabel('Year level', { exact: true }).isEditable()) && !(await s.page.getByLabel('Pre-requisite', { exact: true }).isEditable()), 'faculty cannot edit the year level or pre-requisite');
    check(await s.page.getByLabel('Year level', { exact: true }).inputValue() === '2' && await s.page.getByLabel('Pre-requisite', { exact: true }).inputValue() === 'IT 202 - Programming 1', "the administrator's year level and pre-requisite are filled in");
    const para = s.page.getByPlaceholder('Describe the course in a few sentences');
    if (!(await para.count())) await s.page.getByRole('button', { name: /add paragraph/i }).click();
    await s.page.getByPlaceholder('Describe the course in a few sentences').first().fill(DESCRIPTION);
    await s.page.waitForTimeout(800);
    await s.page.getByRole('button', { name: /save as draft/i }).click();
    await s.page.waitForTimeout(1500);
    state.syllabusId = await idOf(s);
    check(Number.isInteger(state.syllabusId), `[browser] the draft was created through the form (id ${state.syllabusId})`);
    const saved = await s.api('PUT', `/syllabi/${state.syllabusId}/content`, { sections, schemaVersion: 3 });
    check(saved.status === 200, `[api] Steps 2–6 saved through PUT /syllabi/:id/content (HTTP ${saved.status})`);
    note('Steps 2–6 (outcomes, 18-week plan, requirements, references, grading) were supplied through the real API to keep the run bounded; Step 1, the review step and everything after were driven through the UI.');
    state.originalContent = (await s.api('GET', `/syllabi/${state.syllabusId}/content`)).body.content;
    await s.page.reload(); await s.page.waitForTimeout(1500);
    await s.nav('My Syllabi');
    await s.page.getByRole('button', { name: /edit/i }).first().click();
    await s.page.waitForTimeout(2500);
    check(/7 of 7 complete/.test(await s.text()), '[browser] the builder shows 7 of 7 steps complete');
    await s.page.getByRole('button', { name: /7 review syllabus/i }).click();
    await s.page.waitForTimeout(1200);
    const text = await s.text();
    check(/COURSE LEARNING OUTCOMES/.test(text) && /LEARNING PLAN/.test(text), '[browser] the Review step renders the full syllabus preview');
    check(/Introductory/.test(text) && /Enabling/.test(text) && /Demonstrating/.test(text) && /Integration of Values/.test(text), '[browser] the review preview shows the four CLO classifications');
    check(/checked in the AI Checker tab|AI Checker/i.test(text), '[browser] the Review step points the author to the AI Checker tab for checking');
    await s.shot(evidence('K01-builder-review-step.png'));
    assertClean(s, 'K01');
    await s.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('K02', 'AI Checker (browser): run the comprehensive check, official score, seven VPAA relationships, four CLO classifications, findings, coverage, reserved rules', async () => {
    const before = providerCount();
    const s = await L.session(browser, stack);
    await s.loginOk('faculty');
    await s.nav('AI Checker');
    await s.page.getByRole('button', { name: /^ai checker$/i }).nth(1).click();
    await s.page.getByText('Academic Evaluation Policy V2').first().waitFor({ timeout: 120000 });
    await s.page.waitForTimeout(1500);
    state.requests = providerCount() - before;
    let text = await s.text();
    // 1. official compliance score
    check(/99%/.test(text) && /Meets the standard/.test(text) && /pass line 79%/.test(text), '[browser] official score shown: 99% Excellent, Meets the standard (pass line 79%)');
    await s.shot(evidence('K02-1-official-score-and-checker-1440.png'));
    await s.page.screenshot({ path: evidence('K02-full-page.png'), fullPage: true });
    // 2. seven VPAA relationships
    for (const rel of RELATIONSHIPS) check(new RegExp(':' + rel + '\\b').test(text), `[browser] VPAA relationship ${rel} is rendered (weekly rows)`);
    check(/Academic alignment has no numeric score, deductions or passing mark/.test(text) && /no effect on the official score, deductions, passing mark or submission gate/.test(text), '[browser] the page states that academic alignment is advisory: no score, deductions, passing mark or gate effect');
    check(/anthropic · claude-sonnet-5-5/.test(text) && /Evaluated/.test(text), '[browser] AI status: Evaluated by the (scripted) approved provider/model');
    check(!/VPAA relationships checked/.test(text), '[browser] no incomplete-coverage warning (all seven relationships evaluated)');
    await regionShot(s.page, [s.page.locator('h3, h4').filter({ hasText: /AI academic alignment criteria/ })], evidence('K02-2-vpaa-relationships-heading.png'), { maxH: 900 });
    // 3. CLO classification
    check(/Four required CLO classifications — Evaluated: supported/.test(text), '[browser] structural check "Four required CLO classifications" is rendered and Supported');
    check(/Semantic appropriateness of CLO classifications/.test(text), '[browser] semantic check "Semantic appropriateness of CLO classifications" is rendered');
    for (let i = 0; i < 4; i++) check(new RegExp('clo' + i + '-classification · ').test(text), `[browser] relationship evidence for CLO ${i + 1} classification is rendered (clo${i}-classification)`);
    // 4. findings and recommendations
    check(/Corrections for human review/.test(text) && /Requires faculty review; never applied automatically/.test(text), '[browser] findings and correction recommendations are rendered (human review only)');
    check(/Evaluated: requires revision/.test(text) && /Needs faculty review/.test(text), '[browser] the scripted gaps appear as "Evaluated: requires revision" and "Needs faculty review" findings, in the same words the coverage list uses');
    check(/\d+ findings? behind the score/.test(text), '[browser] the card lists the findings that sit behind the official score (' + (text.match(/\d+ findings? behind the score/) || [''])[0] + ')');
    // 5. coverage section: statuses and reserved rules
    check(/Check coverage: \d+ of 195 catalogue entries verified/.test(text), '[browser] the collapsed coverage section reports its denominator (' + (text.match(/Check coverage: \d+ of \d+ catalogue entries verified/) || [''])[0] + ')');
    const details = await openCoverage(s);
    const open = await s.text();
    for (const label of ['Evaluated: supported', 'Evaluated: requires revision', 'Needs faculty review', 'Not checked', 'Not applicable', 'Partially evaluated', 'Replaced by an authorized alternative check']) check(new RegExp('· ' + label).test(open), `[browser] the coverage list shows entries with status "${label}"`);
    check(/Requires revision: \d+ · Needs faculty review: \d+ · Partially evaluated: \d+ · Not checked: \d+/.test(open), '[browser] the coverage summary counts Requires revision / Needs faculty review / Partially evaluated / Not checked');
    for (const id of ['C-04', 'R-02', 'R-03']) check(new RegExp(id + ' · Replaced by an authorized alternative check').test(open), `[browser] ${id} is shown as replaced by an authorized alternative check, not as a bare "Not checked"`);
    check(/Verification does not imply a pass/.test(open), '[browser] the page says verification does not imply a pass');
    for (const id of RESERVED) {
      const row = rowOf(details, id);
      const t = (await row.innerText()).replace(/\s+/g, ' ');
      check(new RegExp(id + ' · Not checked').test(t) && !/· Evaluated: supported/.test(t) && /VPAA|Registrar/.test(t), `[browser] reserved rule ${id} is "Not checked" with its institutional dependency (${t.slice(0, 70)}…), never Passed`);
    }
    for (let n = 1; n <= 7; n++) check(await rowOf(details, 'VPAA-0' + n).count() === 1, `[browser] coverage lists VPAA-0${n}`);
    for (let n = 1; n <= 4; n++) for (const kind of ['structure', 'semantic']) check(await rowOf(details, `CLO${n}:${kind}`).count() === 1, `[browser] coverage lists CLO${n}:${kind}`);
    const vpaaRows = []; for (let n = 1; n <= 7; n++) vpaaRows.push(rowOf(details, 'VPAA-0' + n));
    await regionShot(s.page, vpaaRows, evidence('K02-3-coverage-vpaa-01-07.png'));
    const cloRows = []; for (let n = 1; n <= 4; n++) for (const kind of ['structure', 'semantic']) cloRows.push(rowOf(details, `CLO${n}:${kind}`));
    await regionShot(s.page, cloRows, evidence('K02-4-coverage-clo-classifications.png'));
    await regionShot(s.page, RESERVED.map((id) => rowOf(details, id)), evidence('K02-5-coverage-eleven-reserved-rules-not-checked.png'));
    await regionShot(s.page, [details.locator('summary'), details.locator('p').first(), details.locator('p').nth(1)], evidence('K02-6-coverage-summary-and-counts.png'));
    const nc = []; for (const id of ['VAL-03', 'VAL-05', 'CUR-08', 'CUR-09', 'C-04', 'R-02', 'R-03']) if (await rowOf(details, id).count()) nc.push(rowOf(details, id));
    await regionShot(s.page, nc, evidence('K02-7-coverage-incomplete-or-unavailable.png'));
    // saved report
    const run = await savedRun(s);
    state.firstRunId = run.id;
    const bud = run.hybrid.budget;
    check(!!bud && bud.requiredIncomplete === false, '[api] the required academic evaluations fit the configured per-check budget (requiredIncomplete=false)');
    check(run.hybrid.academicV2.alignment.status === 'completed', '[api] Policy V2 completed: the optional supporting checks did not use up the budget before it ran');
    note('per-check budget: ' + JSON.stringify({ limits: bud && bud.limits, used: bud && bud.used, byPriority: bud && bud.byPriority, deferredOptional: bud && bud.deferredOptional }));
    if (bud && bud.deferredOptional > 0) {
      check(/optional supporting checks were not sent/.test(open) && await s.page.getByTestId('budget-optional-deferred').count() === 1, `[browser] the page says ${bud.deferredOptional} optional supporting checks were not sent, and that they are Not checked, never passed`);
      const flagged = await s.page.locator('li', { hasText: /Optional supporting check not sent/ }).count();
      check(flagged > 0, `[browser] the coverage list marks the deferred items with the budget reason (${flagged} rows)`);
      await s.shot(evidence('K02-8-budget-deferred-notice.png'));
    } else check(await s.page.getByTestId('budget-optional-deferred').count() === 0, '[browser] with room for every check no budget notice is shown');
    check(run && run.overall === 99 && run.passed === true && run.passThreshold === 79, `[api] the check was saved as a report (run ${run && run.id}): overall ${run && run.overall}, passed ${run && run.passed}, threshold ${run && run.passThreshold}`);
    await s.page.reload(); await s.page.waitForTimeout(2500);
    await s.nav('AI Checker'); await s.page.waitForTimeout(2000);
    const again = await s.text();
    check(/99%/.test(again) && /Check coverage: \d+ of 195/.test(again) && /Academic Evaluation Policy V2/.test(again), '[browser] after a full page reload the saved report is shown again (score, coverage and V2 panel)');
    check((await savedRun(s)).id === run.id, '[api] reloading did not create a second report (same run id)');
    note(`scripted provider requests for this first check: ${state.requests}`);
    assertClean(s, 'K02');
    await s.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('K03', 'Saved report audit (API): profile active, all deterministic rules executed, seven VPAA and four CLO classifications verified, reserved rules pending, duplicates, budget', async () => {
    const s = await L.session(browser, stack);
    await s.loginOk('faculty');
    const run = await savedRun(s);
    const h2 = run.hybrid, rc = h2.ruleCoverage, v2 = h2.academicV2;
    check(rc.profile === 'comprehensive-testing', `[api] the saved coverage manifest records the resolved profile "${rc.profile}"`);
    check(v2 && v2.status === 'completed' && v2.mode === 'live-application', `[api] Policy V2 ran although the V2 flag was explicitly OFF: the profile switched it on (status ${v2 && v2.status})`);
    check(v2.contracts.cloClassification === 'lcup-ilo-clo-classification-3', `[api] CLO classification contract ${v2.contracts.cloClassification}`);
    const by = (ns) => rc.rules.filter((r) => r.namespace === ns);
    // seven VPAA relationships
    for (const [i, type] of RELATIONSHIPS.entries()) {
      const rule = rc.rules.find((r) => r.ruleId === 'VPAA-0' + (i + 1));
      const verified = rule.instances.filter((x) => x.verified).length;
      check(rule.instances.length === 15 && verified === 15 && rule.attempted && rule.executed, `[api] VPAA-0${i + 1} ${type}: ${verified}/${rule.instances.length} instances verified and attempted, status ${rule.status}`);
    }
    // four CLO classifications
    for (let n = 1; n <= 4; n++) {
      const st = rc.rules.find((r) => r.ruleId === `CLO${n}:structure`), se = rc.rules.find((r) => r.ruleId === `CLO${n}:semantic`);
      check(st.executed && st.verified && se.executed && se.verified && se.attempted, `[api] CLO${n} (${LEVELS[n - 1]}): structure ${st.status}, semantic ${se.status}, both executed and verified`);
    }
    // deterministic rules: all 47 registered standards executed or explained
    const reg = by('registered_standard');
    check(reg.length === 47, `[api] 47 registered standard rules are catalogued (${reg.length})`);
    const unexplainedReg = reg.filter((r) => !r.executed && !r.reason);
    check(unexplainedReg.length === 0, `[api] every registered rule executed or carries a reason (${reg.filter((r) => r.executed).length} executed; non-executed: ${reg.filter((r) => !r.executed).map((r) => r.ruleId + '=' + r.status).join(', ') || 'none'})`);
    note('registered standards by status: ' + JSON.stringify(reg.reduce((m, r) => ({ ...m, [r.status]: (m[r.status] || 0) + 1 }), {})));
    check(by('hybrid_validation').every((r) => r.executed || r.status === 'NOT_APPLICABLE'), '[api] every coded hybrid validation (CUR-REF … AI-REQUIRED) executed or is not applicable');
    // reserved
    const reserved = rc.rules.filter((r) => r.namespace === 'reserved');
    check(reserved.length === 11 && RESERVED.every((id) => reserved.some((r) => r.ruleId === id)), '[api] exactly the eleven reserved rules are catalogued');
    check(reserved.every((r) => r.status === 'NOT_CHECKED' && !r.enabled && !r.implemented && !r.executed && !r.verified && r.instances.length === 0), '[api] none of the eleven reserved rules is enabled, implemented, executed, verified or has an instance (no false pass)');
    check(rc.rules.filter((r) => r.status === 'PASS' && RESERVED.includes(r.ruleId)).length === 0, '[api] no reserved rule is reported PASS anywhere');
    // duplicates
    const L2 = h2.alignment.judgements, V = v2.academic.relationships;
    const lIds = L2.map((j) => j.id), vIds = V.map((j) => j.id);
    check(new Set(lIds).size === lIds.length && new Set(vIds).size === vIds.length, '[api] no relationship id repeats inside the legacy list or inside the V2 list');
    const rcIds = rc.rules.map((r) => r.ruleId);
    check(new Set(rcIds).size === rcIds.length, '[api] no rule id repeats in the coverage manifest');
    const both = lIds.filter((i) => new Set(vIds).has(i));
    const byType = both.reduce((m, i) => { const t = L2.find((j) => j.id === i).type; return { ...m, [t]: (m[t] || 0) + 1 }; }, {});
    const answeredLegacy = both.filter((i) => L2.find((j) => j.id === i).attempted !== false && !L2.find((j) => j.id === i).unverified);
    const placeholders = both.filter((i) => L2.find((j) => j.id === i).unverified);
    note('relationship ids present in BOTH the legacy scored list and the V2 list: ' + both.length + ' ' + JSON.stringify(byType) + '; of which legacy placeholders without a request: ' + placeholders.length + ' (' + placeholders.join(',') + ')');
    state.overlap = { total: both.length, byType, placeholders };
    const documentedOverlap = new Set(['CLO-PO', 'CLO-EGA', 'ILO-CLO', 'ILO-activity']);
    check(Object.keys(byType).filter((t) => !documentedOverlap.has(t)).every((t) => placeholders.length > 0), '[api] every overlap outside the four documented scored relationships is only an unasked placeholder (no second model request)');
    const legacyV2Advisory = L2.filter((j) => ['Course-CLO', 'Description-plan', 'Content-course', 'Content-ILO'].includes(j.type));
    check(legacyV2Advisory.length === 0, '[api] the advisory types V2 owns (Course-CLO, Description-plan, Content-course, Content-ILO) are not asked a second time by the legacy path');
    // budget
    const b = v2.alignment.requestBudget || {};
    check(v2.alignment.status === 'completed', '[api] the shared per-check budget did not starve any V2 relationship');
    note(`shared per-check budget (cap $${ctx.profileEnv.SYLLABUS_CHECK_AI_MAX_COST_USD}): requests ${state.requests} sent this check; reserved cost recorded by the final summary: ${JSON.stringify(b)}`);
    // official score unchanged by the advisory layer
    check(run.passThreshold === 79 && run.areas.map((a) => a.weight).join('/') === '20/20/20/15/10/15', `[api] six official areas weighted ${run.areas.map((a) => a.weight).join('/')} and the pass line ${run.passThreshold}`);
    check(!('score' in (v2.academic || {})) || v2.academic.score == null, '[api] the V2 academic layer carries no numeric score');
    state.run = { overall: run.overall, areas: run.areas.map((a) => [a.id || a.name, a.score]), findings: (run.findings || []).map((f) => f.id || f.ruleId).sort() };
    await s.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('K04', 'Editing a checked syllabus (browser): the old result is marked out of date, is not presented as current, and a re-check restores it', async () => {
    const s = await L.session(browser, stack);
    await s.loginOk('faculty');
    await s.nav('My Syllabi');
    await s.page.getByRole('button', { name: /edit/i }).first().click();
    await s.page.waitForTimeout(2500);
    const box = s.page.getByPlaceholder('Describe the course in a few sentences').first();
    await box.fill(DESCRIPTION + ' A faculty edit made after the check.');
    await s.page.waitForTimeout(600);
    await s.page.getByRole('button', { name: /save as draft/i }).click();
    await s.page.waitForTimeout(2000);
    const content = (await s.api('GET', `/syllabi/${state.syllabusId}/content`)).body.content;
    check(/A faculty edit made after the check\./.test(JSON.stringify(content.description)), '[api] the faculty edit was saved');
    state.contentAfterEdit = content;
    const stale = await savedRun(s);
    check(stale.stale === true, `[api] the saved report is flagged stale after the edit (stale=${stale.stale})`);
    check(stale.id === state.firstRunId, '[api] the edit did not silently re-run or replace the report');
    await s.nav('AI Checker');
    await s.page.waitForTimeout(2500);
    const text = await s.text();
    check(/Out of date: the syllabus changed after this check/.test(text), '[browser] the page shows the "Out of date: the syllabus changed after this check" chip on the old result');
    note('stale page, text near the top: ' + text.slice(text.indexOf('Compliance check'), text.indexOf('Compliance check') + 380));
    const submit = s.page.getByRole('button', { name: /submit to admin/i });
    note('Submit to Admin while the result is out of date: ' + ((await submit.count()) ? (await submit.isDisabled() ? 'disabled' : 'enabled') : 'absent'));
    await s.shot(evidence('K04-1-out-of-date-result.png'));
    await s.page.screenshot({ path: evidence('K04-1b-out-of-date-full-page.png'), fullPage: true });
    // where is the marker relative to the stale result it qualifies? (document y-coordinates; 0 = top of the page)
    const pos = await s.page.evaluate(() => {
      const top = (el) => el && Math.round(el.getBoundingClientRect().top + scrollY);
      const banner = document.querySelector('[data-testid="stale-banner"]');
      const v2 = [...document.querySelectorAll('h2,h3,h4')].find((e) => /Academic Evaluation Policy V2/.test(e.innerText));
      const cov = [...document.querySelectorAll('summary')].find((e) => /Check coverage/.test(e.innerText));
      return { banner: top(banner), bannerSticky: banner ? getComputedStyle(banner).position : null, v2: top(v2), v2Chip: !!document.querySelector('[data-testid="stale-chip"]'), coverage: top(cov), pageHeight: document.documentElement.scrollHeight };
    });
    note('vertical position of the out-of-date banner vs the stale V2 panel and coverage section: ' + JSON.stringify(pos));
    check(pos.banner != null && pos.v2 != null && pos.banner < pos.v2 && pos.banner < pos.coverage, '[browser] the out-of-date banner is rendered ABOVE the stale V2 results and the coverage list (banner y=' + pos.banner + ', V2 panel y=' + pos.v2 + ')');
    check(pos.bannerSticky === 'sticky', '[browser] the banner is sticky, so it stays in view while the long results are read');
    check(pos.v2Chip, '[browser] the V2 panel heading itself carries an "Out of date" marker');
    check(/Out of date\./.test(await s.text()) && /Re-Check again before acting on a recommendation or submitting/.test(await s.text()), '[browser] the banner says the results describe the earlier version and to Re-Check before acting');
    await s.page.evaluate(() => scrollTo(0, 3000));
    await s.page.waitForTimeout(300);
    const stuck = await s.page.evaluate(() => { const el = document.querySelector('[data-testid="stale-banner"]'); const r = el && el.getBoundingClientRect(); return !!r && r.top >= 0 && r.top < 80; });
    check(stuck, '[browser] after scrolling down the page the banner is still visible at the top of the screen');
    await s.shot(evidence('K04-1c-stale-banner-while-scrolled.png'));
    await s.page.evaluate(() => scrollTo(0, 0));
    await s.page.getByRole('button', { name: /re-check again/i }).first().click();
    await s.page.waitForFunction(() => !/Out of date: the syllabus changed/.test(document.body.innerText), null, { timeout: 120000 });
    await s.page.waitForTimeout(2500);
    const fresh = await savedRun(s);
    check(fresh.id !== state.firstRunId && fresh.stale === false, `[api] Re-Check produced a new current report (run ${fresh.id}, stale=${fresh.stale})`);
    check(!/Out of date/.test(await s.text()) && /99%/.test(await s.text()) && /Meets the standard/.test(await s.text()), '[browser] after Re-Check the out-of-date chip is gone and the current result is shown');
    check(fresh.overall === 99 && fresh.passThreshold === 79, `[api] official score after the re-check: ${fresh.overall} / pass line ${fresh.passThreshold}`);
    check(JSON.stringify((await s.api('GET', `/syllabi/${state.syllabusId}/content`)).body.content) === JSON.stringify(content), '[api] the check and re-check did not change any faculty-authored content');
    state.firstRunId = fresh.id;
    await s.shot(evidence('K04-2-after-recheck.png'));
    assertClean(s, 'K04');
    await s.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('K05', 'Submission and administrator interface (browser): submit locks, admin runs the comprehensive check, sees the same report, returns it for revision', async () => {
    const f = await L.session(browser, stack);
    await f.loginOk('faculty');
    await f.nav('AI Checker');
    await f.page.waitForTimeout(1500);
    await f.page.getByRole('button', { name: /submit to admin/i }).click();
    await f.page.waitForTimeout(2500);
    const ft = await f.text();
    check(/Submitted/.test(ft) && /submitted and is locked/i.test(ft), '[browser] after Submit to Admin the page shows Submitted and says the syllabus is locked');
    const edit = await f.api('PUT', `/syllabi/${state.syllabusId}/content`, { sections: { reqs: sections.reqs }, schemaVersion: 3 });
    check(edit.status === 409, `[api] a submitted syllabus refuses edits from its own owner (HTTP ${edit.status})`);
    await f.close();

    const s = await L.session(browser, stack);
    await s.loginOk('admin');
    await s.nav('Review & Approval');
    check(/waiting for the AI Checker/i.test(await s.text()), '[browser] Review & Approval holds the submission back until the AI Checker has been run on it');
    const gate = await s.api('PUT', '/syllabi/' + state.syllabusId, { status: 'approved' });
    check(gate.status === 403 || gate.status === 409, `[api] the administrator cannot approve an unchecked submission (HTTP ${gate.status})`);
    await s.nav('AI Checker');
    await s.pick(/Choose a faculty member/, /Test Faculty/);
    await s.pick(/Choose a program/, /BSIT/);
    await s.pick(/Choose a subject/, /IT 204/);
    await s.page.getByRole('button', { name: /check compliance/i }).click();
    await s.page.getByText('Academic Evaluation Policy V2').first().waitFor({ timeout: 120000 });
    await s.page.waitForTimeout(1500);
    let text = await s.text();
    check(/Meets the standard/.test(text) && /99%/.test(text), '[browser][admin] official result 99% meets the standard');
    for (const rel of RELATIONSHIPS) check(new RegExp(':' + rel + '\\b').test(text), `[browser][admin] relationship ${rel} is rendered`);
    check(/Four required CLO classifications/.test(text) && /clo3-classification/.test(text), '[browser][admin] CLO classification results are rendered');
    check(/Academic alignment has no numeric score, deductions or passing mark/.test(text), '[browser][admin] the advisory statement is shown');
    const details = await openCoverage(s);
    const open = await s.text();
    for (const id of RESERVED) check(new RegExp(id + ' · Not checked').test(open), `[browser][admin] reserved rule ${id} is Not checked`);
    await s.shot(evidence('K05-1-admin-official-check.png'));
    // the administrator's result is a scrollable modal: scroll the first reserved row into view and capture the dialog itself
    await rowOf(details, 'STR-07').scrollIntoViewIfNeeded();
    await s.page.getByRole('dialog').first().screenshot({ path: evidence('K05-2-admin-reserved-not-checked.png') });
    const run = await savedRun(s);
    check(run.hybrid.ruleCoverage && run.hybrid.ruleCoverage.profile === 'comprehensive-testing' && run.overall === 99, `[api] the administrator's check was saved with the profile manifest (run ${run.id}, ${run.overall}%)`);
    await s.page.getByRole('dialog').getByRole('button', { name: /^close$/i }).click().catch(() => {});
    const edit2 = await s.api('PUT', `/syllabi/${state.syllabusId}/content`, { sections: { reqs: sections.reqs }, schemaVersion: 3 });
    check([403, 409].includes(edit2.status), `[api] an administrator cannot edit the faculty member's content (HTTP ${edit2.status})`);
    await s.nav('Review & Approval');
    await s.page.getByRole('button', { name: /IT 204/ }).first().click();
    await s.page.waitForTimeout(3000);
    text = await s.text();
    check(/Clear my check/.test(text) && /Return for revision/.test(text) && /Dean/.test(text) && /LIC Director/.test(text), '[browser][admin] the reviewer sees the document with Clear my check, Return for revision and the three clearing stages');
    await s.shot(evidence('K05-3-admin-review-and-approval.png'));
    const note1 = s.page.getByLabel(/note to the faculty member/i).first();
    if (await note1.count()) await note1.fill('Synthetic note: please review the week 1 activity and assessment wording.');
    else await s.page.locator('textarea').last().fill('Synthetic note: please review the week 1 activity and assessment wording.');
    await s.page.getByRole('button', { name: /return for revision/i }).click();
    await s.page.waitForTimeout(1500);
    const confirm = s.page.getByRole('dialog').getByRole('button', { name: /return|confirm|yes/i });
    if (await confirm.count()) await confirm.first().click();
    await s.page.waitForTimeout(2500);
    check(s.issues.apiCalls.includes('PUT /api/syllabi/' + state.syllabusId + ' 200'), '[api] the return for revision was accepted');
    assertClean(s, 'K05-admin', { allowStatus: [403, 409] });
    await s.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  // catalog.savedAt is stamped by the server on every save; it is not faculty content
  const norm = (c) => { const x = structuredClone(c); if (x && x.catalog) delete x.catalog.savedAt; return x; };
  const diffPaths = (a, b, prefix = '') => {
    if (JSON.stringify(a) === JSON.stringify(b)) return [];
    if (a && b && typeof a === 'object' && typeof b === 'object') return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) => diffPaths(a[k], b[k], prefix + (Array.isArray(a) ? `[${k}]` : prefix ? '.' + k : k)));
    return [prefix];
  };
  const REPAIRED = 'Scripted revised text for faculty review.'; // the scripted provider judges any text containing this marker as aligned
  await scenario('K06', 'Recommendations (browser): Check & Improve, Edit, Accept, Reject and Undo; nothing silently overwrites faculty-authored content', async () => {
    const s = await L.session(browser, stack);
    await s.loginOk('faculty');
    const content = async () => norm((await s.api('GET', `/syllabi/${state.syllabusId}/content`)).body.content);
    const sameAs = async (snap) => JSON.stringify(await content()) === JSON.stringify(snap);
    await s.nav('My Syllabi');
    check(/For Revision/i.test(await s.text()), '[browser] My Syllabi shows the returned syllabus as For Revision');
    const returned = await content();
    const savedByFaculty = norm(state.contentAfterEdit);
    check(JSON.stringify(returned) === JSON.stringify(savedByFaculty), `[api] after check → submit → administrator check → return, the faculty-authored content is exactly what the faculty saved (differs at: ${diffPaths(savedByFaculty, returned).join(', ') || 'nothing'}; the server-stamped catalog.savedAt is not content)`);
    await s.nav('AI Checker');
    await s.page.waitForTimeout(2500);
    let text = await s.text();
    // Provider mode 'unauthorized-field': a valid answer naming a field the ILO-activity relationship does not own. The recommendation contract must refuse to offer a rewrite.
    stack.setProvider('unauthorized-field');
    // a faculty edit of week 1 first, so the judgement is asked afresh (an unchanged lesson is answered from the verified earlier judgement, SYLLABUS_CHECK_REUSE)
    const planProbe = structuredClone(returned.plan);
    planProbe[0].activities = String(planProbe[0].activities) + ' Unauthorized-field probe.';
    check((await s.api('PUT', `/syllabi/${state.syllabusId}/content`, { sections: { plan: planProbe }, schemaVersion: 3 })).status === 200, '[api] the faculty edited week 1 so the next answer is asked afresh');
    await s.page.reload(); await s.page.waitForTimeout(1500);
    await s.nav('AI Checker'); await s.page.waitForTimeout(2500);
    await s.page.getByRole('button', { name: /re-check again/i }).first().click();
    await s.page.waitForFunction(() => /Requires faculty review; never applied automatically/.test(document.body.innerText), null, { timeout: 120000 });
    await s.page.waitForTimeout(1500);
    text = await s.text();
    check(/Corrections for human review/.test(text) && /Requires faculty review; never applied automatically/.test(text), '[browser] unauthorized field: the correction is shown as text for human review');
    check(await s.page.locator('.hy-rec').count() === 0 && await s.page.getByRole('button', { name: /check & improve|^accept$/i }).count() === 0, '[browser] unauthorized field: no Accept / Check & Improve control is offered because no field could be identified (the contract withholds the draft instead of guessing)');
    await s.shot(evidence('K06-0-correction-withheld-no-actions.png'));
    // Now the (default) scripted model names a field the relationship owns, so a rewrite is offered. The faculty's own baseline edit also makes the lesson's judgement fresh (no reuse).
    stack.setProvider('ok');
    const planEdit = structuredClone(returned.plan);
    planEdit[0].activities = String(planEdit[0].activities) + ' Faculty lab note.';
    check((await s.api('PUT', `/syllabi/${state.syllabusId}/content`, { sections: { plan: planEdit }, schemaVersion: 3 })).status === 200, '[api] the faculty saved a new baseline wording for week 1');
    const base = await content();
    await s.page.reload(); await s.page.waitForTimeout(1500); // the open page must hold the faculty's current draft, as it does after any real edit
    await s.nav('AI Checker'); await s.page.waitForTimeout(2500);
    await s.page.getByRole('button', { name: /re-check again/i }).first().click();
    await s.page.locator('.hy-rec').first().waitFor({ timeout: 120000 }).catch(() => {});
    await s.page.waitForTimeout(1500);
    check(await sameAs(base), '[api] the Re-Check itself did not change any faculty-authored content');
    text = await s.text();
    const cards = () => s.page.locator('.hy-rec');
    const buttonsOf = async (c) => (await c.locator('button').allInnerTexts()).map((x) => x.trim());
    check(await cards().count() >= 1, `[browser] ${await cards().count()} recommendation card(s) are offered`);
    note('buttons on the first card: ' + (await buttonsOf(cards().first())).join(' | '));
    const card = () => cards().first();
    const accept = () => card().getByRole('button', { name: /^accept$|apply verified rewrite/i });
    const refine = () => card().getByRole('button', { name: /check & improve/i });
    const reject = () => card().getByRole('button', { name: /^reject$/i });
    check(await refine().count() === 1 && await reject().count() === 1 && await accept().count() === 1, '[browser] the card offers Check & Improve, Accept and Reject');
    const editBox = () => card().getByLabel(/edit recommendation/i);
    check(await editBox().count() === 1, '[browser] the card offers an editable proposed-text box (Edit)');
    check(await accept().isDisabled(), '[browser] Accept is disabled until Check & Improve has verified the wording');
    await accept().click({ force: true, timeout: 3000 }).catch(() => {});
    await s.page.waitForTimeout(800);
    check(await sameAs(base), '[api] clicking the disabled Accept changed nothing');
    // Edit: the faculty rewrites the proposal; it must be verified again before it can be applied
    const EDIT = 'Faculty-authored wording that practises the weekly topic. ' + REPAIRED;
    const proposed = await editBox().inputValue();
    await editBox().fill(EDIT);
    await s.page.waitForTimeout(500);
    check(await accept().isDisabled(), '[browser] after the faculty edits the proposed text, Accept is disabled again until that exact text is verified');
    const p0 = providerCount();
    await refine().click();
    await s.page.locator('.hy-verify').first().waitFor({ timeout: 60000 });
    await s.page.waitForTimeout(500);
    check(providerCount() > p0, '[browser] Check & Improve asked the (scripted) provider to verify the faculty-edited wording');
    check(await sameAs(base), '[api] Check & Improve alone changed nothing in the syllabus');
    check(!(await accept().isDisabled()), '[browser] Accept is enabled once the edited wording is verified');
    await s.shot(evidence('K06-1-recommendation-verified.png'));
    await accept().click();
    await s.page.waitForTimeout(3500);
    const edited = await content();
    const changed = diffPaths(base, edited);
    check(changed.length === 1, `[api] Edit + Accept changed exactly one field: ${changed.join(', ') || 'none'}`);
    if (changed.length !== 1) {
      note('Accept diagnostics: card errors = ' + (await s.page.locator('.hy-err').allInnerTexts()).join(' | ') + '; failed responses = ' + (s.issues.failedBodies || []).join(' || ').slice(0, 600) + '; non-GET calls = ' + s.issues.apiCalls.filter((c) => !c.startsWith('GET') && !c.includes('heartbeat')).join(', '));
      await s.shot(evidence('K06-x-accept-did-not-apply.png'));
      stack.setProvider('ok');
      await s.close();
      return;
    }
    state.targetPath = changed[0];
    const valueAt = (obj, p) => p.replace(/\[(\d+)\]/g, '.$1').split('.').reduce((o, k) => o?.[k], obj);
    check(valueAt(edited, state.targetPath) === EDIT, '[api] the saved text is exactly what the faculty wrote, not the machine proposal');
    check(valueAt(edited, state.targetPath) !== proposed, '[api] the machine proposal was not written over the faculty edit');
    await s.shot(evidence('K06-2-after-edit-and-accept.png'));
    // Undo through the real button: offered for the applied recommendation, restores exactly the original, records the reversal
    const decisionsBefore = s.issues.apiCalls.filter((c) => /\/decisions 201/.test(c)).length;
    check(decisionsBefore >= 1, '[api] the Accept was recorded by the decisions API');
    check(await s.page.locator('details.hy-handled[open]').count() === 1, '[browser] the Applied recommendations list opens by itself after an apply, so Undo is in view');
    const undoBtn = s.page.getByRole('button', { name: /^undo change$/i });
    check(await undoBtn.count() === 1, '[browser] an Undo change button is offered for the applied recommendation');
    await s.shot(evidence('K06-2b-undo-offered.png'));
    await undoBtn.click();
    await s.page.waitForTimeout(3500);
    check(await sameAs(base), '[api] Undo restored the syllabus to exactly its state before the recommendation was applied');
    check(/Change undone/.test(await s.text()), '[browser] Undo reports success on the page');
    check(s.issues.apiCalls.filter((c) => /\/decisions 201/.test(c)).length === decisionsBefore + 1, '[api] the reversal was recorded as an append-only decision');
    check(await cards().count() >= 1 && await accept().isDisabled(), '[browser] after Undo the recommendation is offered again and must be verified again before it can be applied');
    await s.shot(evidence('K06-2c-after-undo.png'));
    const section = state.targetPath.split(/[.[]/)[0];
    // the server refuses an Accept for wording nobody verified
    const rc1 = await s.api('POST', `/syllabi/${state.syllabusId}/compliance/recheck`, { force: true });
    const sg = (rc1.body.run.hybrid.suggestions || [])[0];
    const unverified = sg ? await s.api('POST', `/syllabus-check/runs/${rc1.body.run.id}/decisions`, { suggestionId: sg.id, action: 'accept' }) : { status: 'no suggestion' };
    check(unverified.status === 409, `[api] the server refuses an Accept that was not verified by Check & Improve (HTTP ${unverified.status}: ${JSON.stringify(unverified.body).slice(0, 140)})`);
    check(await sameAs(base), '[api] the refused Accept changed nothing');
    // Accept the machine's own verified proposal
    await s.page.reload(); await s.page.waitForTimeout(1500);
    await s.nav('AI Checker'); await s.page.waitForTimeout(2500);
    check(await cards().count() >= 1, '[browser] after the Undo and a re-check the recommendation is offered again');
    await refine().click();
    await s.page.locator('.hy-verify').first().waitFor({ timeout: 60000 });
    await s.page.waitForTimeout(500);
    await accept().click();
    await s.page.waitForTimeout(3500);
    const accepted = await content();
    const ch2 = diffPaths(base, accepted);
    check(ch2.length === 1 && ch2[0] === state.targetPath, `[api] Check & Improve + Accept wrote only the recommended field (${ch2.join(', ')})`);
    // a target the faculty changed after the recommendation: nothing is overwritten
    await s.api('PUT', `/syllabi/${state.syllabusId}/content`, { sections: { [section]: base[section] }, schemaVersion: 3 });
    const rc2 = await s.api('POST', `/syllabi/${state.syllabusId}/compliance/recheck`, { force: true });
    await s.page.reload(); await s.page.waitForTimeout(1500);
    await s.nav('AI Checker'); await s.page.waitForTimeout(2500);
    if (await cards().count() >= 1) {
      await refine().click();
      await s.page.locator('.hy-verify').first().waitFor({ timeout: 60000 });
      await s.page.waitForTimeout(500);
      // the faculty edits the same field in the builder (another tab) after the recommendation was generated, then the card is still on screen
      const newer = structuredClone(base[section]);
      const setAt = (obj, p, v) => { const parts = p.replace(/\[(\d+)\]/g, '.$1').split('.').slice(1); let o = obj; for (const k of parts.slice(0, -1)) o = o[k]; o[parts.at(-1)] = v; };
      setAt(newer, state.targetPath.replace(/^[^.[]+/, section), 'Newer faculty wording written after the recommendation. Not the proposal.');
      const put = await s.api('PUT', `/syllabi/${state.syllabusId}/content`, { sections: { [section]: newer }, schemaVersion: 3 });
      check(put.status === 200, `[api] the faculty saved a newer edit of the same field (HTTP ${put.status})`);
      const keep = await content();
      await accept().click();
      await s.page.waitForTimeout(3500);
      const after = await content();
      const survived = valueAt(after, state.targetPath) === 'Newer faculty wording written after the recommendation. Not the proposal.';
      note('after clicking Accept on a recommendation whose target changed: field value is "' + String(valueAt(after, state.targetPath)).slice(0, 90) + '"; page notice: ' + (await s.page.locator('.hy-err,.hy-hint').allInnerTexts()).join(' | ').slice(0, 220));
      check(survived, '[api] the faculty\'s newer edit survived: Accept from the outdated page did not overwrite it');
      check(/NOT applied|newer changes/i.test((await s.page.locator('.hy-err').allInnerTexts()).join(' ')), '[browser] the card tells the author that newer changes exist and the recommendation was not applied');
      await s.shot(evidence('K06-4-stale-accept-refused.png'));
      await s.api('PUT', `/syllabi/${state.syllabusId}/content`, { sections: { [section]: base[section] }, schemaVersion: 3 });
    } else note('the recommendation was not offered after the re-check, so the changed-target case was not exercised in the browser');
    // Reject
    await s.api('POST', `/syllabi/${state.syllabusId}/compliance/recheck`, { force: true });
    await s.page.reload(); await s.page.waitForTimeout(1500);
    await s.nav('AI Checker'); await s.page.waitForTimeout(2500);
    const baseNow = await content();
    if (await cards().count() >= 1) {
      await reject().click();
      await s.page.waitForTimeout(2500);
      check(await sameAs(baseNow), '[api] Reject changed nothing in the saved syllabus');
      check(s.issues.apiCalls.filter((c) => /\/decisions 201/.test(c)).length >= 2, '[api] Reject was recorded by the decisions API');
      await s.shot(evidence('K06-3-after-reject.png'));
    } else known('K-REC-1', 'no recommendation card was offered for the Reject test after the re-check');
    stack.setProvider('ok');
    assertClean(s, 'K06', { allowStatus: [409] });
    await s.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  const second = { ...sections, meta: { ...sample.meta, courseId: SECOND.courseId, code: SECOND.code, title: SECOND.title, prereq: SECOND.prereq }, description: sample.description };
  const officialOf = (r) => JSON.stringify({ overall: r.overall, passed: r.passed, band: r.band, passThreshold: r.passThreshold, areas: (r.areas || []).map((a) => [a.id || a.name, a.score]), findings: (r.findings || []).map((x) => x.id || x.ruleId).sort() });
  await scenario('K07', 'Incomplete and unavailable checks (browser): with the AI provider down nothing is reported as passed; the official score and pass line are unchanged', async () => {
    const f = await L.session(browser, stack);
    await f.loginOk('faculty');
    const d = await f.api('POST', '/syllabi/drafts');
    const put = await f.api('PUT', `/syllabi/${d.body.id}/content`, { sections: second, schemaVersion: 3 });
    check(put.status === 200, `[api] a second synthetic syllabus (IT 205) was saved (HTTP ${put.status})`);
    state.secondId = d.body.id;
    stack.setProvider('down');
    await f.page.reload(); await f.page.waitForTimeout(2000);
    await f.nav('AI Checker');
    if (!/IT 205/.test(await f.page.locator('.select-trigger').first().innerText())) await f.pick(/IT 20[45]/, /IT 205/);
    await f.page.getByRole('button', { name: /^ai checker$/i }).nth(1).click();
    await f.page.getByText(/VPAA relationships checked/).first().waitFor({ timeout: 90000 });
    await f.page.waitForTimeout(1000);
    let text = await f.text();
    check(/Verification incomplete/.test(text) && /no final AI score yet/.test(text) && /AI unavailable/.test(text), '[browser] with the AI down on a first-ever check the page says Verification incomplete / no final AI score yet / AI unavailable');
    check(!/Meets the standard/.test(text), '[browser] no "Meets the standard" verdict is shown when the AI-scored part could not run');
    check(/0 of 7/.test(text), '[browser] the incomplete seven-relationship coverage is stated explicitly (0 of 7)');
    check(/You can still submit/.test(text), '[browser] the advisory AI gate still lets the author submit (the AI never blocks or approves)');
    const details = await openCoverage(f);
    const open = await f.text();
    for (let n = 1; n <= 7; n++) check(new RegExp('VPAA-0' + n + ' · Not checked').test(open), `[browser] VPAA-0${n} is "Not checked" while the provider is down (not supported)`);
    for (let n = 1; n <= 4; n++) check(new RegExp(`CLO${n}:semantic · Not checked`).test(open), `[browser] CLO${n}:semantic is "Not checked" while the provider is down`);
    check(/CLO1:structure · Evaluated: supported/.test(open) && /T-01 · Evaluated: supported/.test(open), '[browser] deterministic checks (T-01, CLO1:structure) still ran and report their own result without the AI');
    for (const id of RESERVED) check(new RegExp(id + ' · Not checked').test(open), `[browser] reserved rule ${id} is still Not checked`);
    await f.shot(evidence('K07-1-provider-down-page.png'));
    await regionShot(f.page, [details.locator('summary'), details.locator('p').first(), details.locator('p').nth(1)], evidence('K07-2-provider-down-coverage-counts.png'));
    const vp = []; for (let n = 1; n <= 7; n++) vp.push(rowOf(details, 'VPAA-0' + n));
    await regionShot(f.page, vp, evidence('K07-3-provider-down-vpaa-not-checked.png'));
    const downRun = await savedRun(f, state.secondId);
    const downCounts = downRun.hybrid.ruleCoverage.counts;
    note('coverage counts with the provider down (first-ever check): ' + JSON.stringify(downCounts));
    check(downRun.hybrid.ruleCoverage.rules.filter((r) => r.namespace === 'vpaa_type').every((r) => r.status === 'NOT_CHECKED' && !r.verified), '[api] every VPAA relationship is NOT_CHECKED and unverified in the saved report');
    stack.setProvider('ok');
    const online = (await f.api('POST', `/syllabi/${state.secondId}/compliance/recheck`, { force: true })).body.run;
    state.onlineOfficial = officialOf(online);
    check(online.hybrid.semanticCoverage.complete === true && online.hybrid.semanticCoverage.evaluated === 7, '[api] with the provider back, all seven relationships are evaluated');
    note('baseline (provider ok): overall=' + online.overall + ' counts=' + JSON.stringify(online.hybrid.ruleCoverage.counts));
    for (const mode of ['down', 'rate', 'invalid']) {
      stack.setProvider(mode);
      const r = await f.api('POST', `/syllabi/${state.secondId}/compliance/recheck`, { force: true });
      const run = r.body.run, cov = run.hybrid.semanticCoverage;
      check(r.status === 200 && run.overall === online.overall && run.passed === online.passed && run.passThreshold === 79, `[api] ${mode}: official score ${run.overall}, passed ${run.passed}, pass line ${run.passThreshold} are unchanged`);
      const v2rows = run.hybrid.ruleCoverage.rules.filter((x) => x.namespace === 'vpaa_type');
      const everyReused = v2rows.every((x) => x.instances.every((i) => i.reused === true && i.attempted !== true || !i.verified));
      check(cov.complete === false ? !!cov.reason : everyReused, `[api] ${mode}: coverage is either reported incomplete with a reason, or every verified relationship is flagged as reused from the earlier successful check, never fresh (complete=${cov.complete}, ${cov.evaluated}/7, reason=${cov.reason}, all verified instances reused=${everyReused})`);
      const pass = run.hybrid.ruleCoverage.rules.filter((x) => RESERVED.includes(x.ruleId) && x.status === 'PASS');
      check(pass.length === 0, `[api] ${mode}: no reserved rule becomes Passed`);
    }
    stack.setProvider('ok');
    note('The first check above had nothing to reuse, so it shows no score. The per-mode checks reuse the verified judgements of the earlier successful check of the same syllabus (SYLLABUS_CHECK_REUSE), so the official score stays while the seven-relationship coverage drops.');
    assertClean(f, 'K07', { allowStatus: [401, 409, 502, 503] });
    await f.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('K08', 'Official scoring parity and saved-report compatibility: profile on vs profile off vs V2 only; older saved reports still open in the page', async () => {
    const { startApi, waitFor } = require('./stack.cjs');
    const mysql = require(path.join(ROOT, 'server/node_modules/mysql2/promise'));
    const instances = [{ name: 'comprehensive profile (this stack)', base: stack.API, port: null }, { name: 'profile off, V2 off (legacy)', port: Number(new URL(stack.API).port) + 200, env: { SYLLABUS_CHECK_ACADEMIC_V2: 'off' } }, { name: 'V2 on, no profile', port: Number(new URL(stack.API).port) + 201, env: { SYLLABUS_CHECK_ACADEMIC_V2: 'on' } }];
    const started = [];
    const call = async (base, cookie, method, url, body) => { const r = await fetch(base + '/api' + url, { method, headers: { 'Content-Type': 'application/json', Origin: stack.FRONT, 'X-Forwarded-Proto': 'https', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch { /* none */ } return { r, status: r.status, body: j }; };
    const results = [];
    try {
      for (const inst of instances) {
        if (inst.port) { started.push(startApi({ port: inst.port, work: stack.work, front: stack.FRONT, control: stack.control, providerLog: stack.work + `/provider-log-${inst.port}.jsonl`, serverLog: stack.work + `/api-${inst.port}.log`, extraEnv: { ...(process.env.E2E_DB_PORT ? { E2E_DB_PORT: process.env.E2E_DB_PORT } : {}), ...inst.env } })); inst.base = `http://127.0.0.1:${inst.port}`; await waitFor(inst.base + '/api/health', 40000); }
        const login = await call(inst.base, '', 'POST', '/auth/login', { email: 'e2e.faculty@e2e.invalid', password: L.PASSWORD });
        const cookie = (login.r.headers.getSetCookie() || []).map((c) => c.split(';')[0]).filter((c) => c.startsWith('connect.sid')).join('; ');
        stack.setProvider('ok');
        // K01-K07 run several checks just before this one, so the application's per-user limit may answer 429: that limit is the behavior under test elsewhere and stays as it is. Only a 429 is
        // retried, as often as RATE_RETRIES, waiting what Retry-After says; any other failure is left to the checks below, and a 429 that outlasts the retries fails the scenario.
        const RATE_RETRIES = 4, MAX_WAIT_SEC = 60, FALLBACK_WAIT_SEC = 15;
        const recheckOnce = () => call(inst.base, cookie, 'POST', `/syllabi/${state.secondId}/compliance/recheck`, { force: true });
        let rc = await recheckOnce();
        for (let retry = 1; retry <= RATE_RETRIES && rc.status === 429; retry++) {
          const said = Number(rc.r.headers.get('retry-after')), waitSec = Math.min(said > 0 ? said : FALLBACK_WAIT_SEC, MAX_WAIT_SEC);
          note(`[rate limit] ${inst.name}: HTTP 429, Retry-After ${said > 0 ? said + ' s' : 'not sent'}; retry ${retry} of ${RATE_RETRIES} after ${waitSec} s`);
          await new Promise((done) => setTimeout(done, (waitSec + 1) * 1000));
          rc = await recheckOnce();
        }
        note(`[rate limit] ${inst.name}: final recheck HTTP ${rc.status}`);
        check(rc.status !== 429, `[api] ${inst.name}: the recheck was not left rate-limited after ${RATE_RETRIES} retries`);
        results.push({ inst, run: rc.body.run });
      }
    } finally { for (const x of started) x.kill(); }
    const [on, legacy, v2only] = results.map((x) => x.run);
    check(on && legacy && v2only, '[api] all three servers produced a run on the same syllabus');
    check(on.hybrid.ruleCoverage.profile === 'comprehensive-testing' && legacy.hybrid.ruleCoverage.profile !== 'comprehensive-testing' && v2only.hybrid.ruleCoverage.profile !== 'comprehensive-testing', `[api] only the first server resolved the comprehensive profile (${[on, legacy, v2only].map((r) => r.hybrid.ruleCoverage.profile).join(' | ')})`);
    check(!!on.hybrid.academicV2 && !legacy.hybrid.academicV2 && !!v2only.hybrid.academicV2, '[api] Policy V2 is on in the profile and V2-only servers and off in the legacy server');
    const scoreOf = (r) => JSON.stringify({ overall: r.overall, passed: r.passed, band: r.band, passThreshold: r.passThreshold, areas: (r.areas || []).map((a) => [a.id || a.name, a.score]) });
    const ids = (r) => (r.findings || []).map((x) => x.id || x.ruleId).sort();
    check(scoreOf(on) === scoreOf(legacy), `[api] official score, band, passed, pass line and six area scores identical with the profile on and with everything off (${on.overall} vs ${legacy.overall})`);
    check(scoreOf(on) === scoreOf(v2only), `[api] official score, band, passed, pass line and six area scores identical with the profile on and with V2 only (${on.overall} vs ${v2only.overall})`);
    for (const [name, other] of [['legacy', legacy], ['V2 only', v2only]]) {
      const added = ids(on).filter((i) => !ids(other).includes(i)), lost = ids(other).filter((i) => !ids(on).includes(i));
      note(`findings list, profile vs ${name}: added by the profile = [${added.join(', ')}]; present in ${name} but missing under the profile = [${lost.join(', ')}]`);
      check(lost.length === 0, `[api] no finding of the ${name} run is lost under the profile (lost: ${lost.join(', ') || 'none'})`);
      const deductedIds = new Set(((on.hybrid.deductions) || []).map((d) => d.id));
      const scoring = added.filter((i) => deductedIds.has(i) || (on.findings.find((x) => (x.id || x.ruleId) === i) || {}).severity === 'blocking');
      check(scoring.length === 0, `[api] every finding the profile adds is advisory: none deducts points or blocks (${added.length} added; scoring/blocking: ${scoring.join(', ') || 'none'})`);
    }
    check([on, legacy, v2only].every((r) => r.passThreshold === 79), '[api] the pass line is 79 on all three');
    const sc = (r) => JSON.stringify((r.hybrid.scoring || {}).official || {});
    note('hybrid official scoring blocks: profile=' + sc(on) + ' legacy=' + sc(legacy) + ' v2only=' + sc(v2only));
    check(sc(on) === sc(legacy), '[api] the hybrid scoring block (policy, deducted points, score) is identical with the profile on and off');
    // saved-report compatibility: strip what an older version never stored and open the report in the page
    const db = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: require('./stack.cjs').DB_NAME });
    const f = await L.session(browser, stack);
    await f.loginOk('faculty');
    const latest = await savedRun(f, state.secondId);
    const [[row]] = await db.query('SELECT report_json FROM syllabus_check_reports WHERE run_id = ?', [latest.id]);
    const original = row.report_json;
    for (const variant of [{ name: 'a report saved before the coverage manifest existed', strip: ['ruleCoverage'] }, { name: 'a report saved before Policy V2 and the coverage manifest existed', strip: ['ruleCoverage', 'academicV2', 'semanticCoverage'] }]) {
      const json = JSON.parse(original);
      for (const key of variant.strip) delete json.hybrid?.[key];
      await db.query('UPDATE syllabus_check_reports SET report_json = ? WHERE run_id = ?', [JSON.stringify(json), latest.id]);
      const fresh = await L.session(browser, stack);
      await fresh.loginOk('faculty');
      await fresh.nav('AI Checker');
      if (!/IT 205/.test(await fresh.page.locator('.select-trigger').first().innerText())) await fresh.pick(/IT 20[45]/, /IT 205/);
      await fresh.page.waitForTimeout(3000);
      const t = await fresh.text();
      check(/Meets the standard/.test(t) && /\d+%/.test(t), `[browser] ${variant.name} still opens: the official score and verdict are shown`);
      check(!/Check coverage/.test(t), `[browser] ${variant.name} shows no coverage section (no receipts are fabricated)`);
      check(!/Check coverage could not be prepared/.test(t), `[browser] ${variant.name} is not mislabelled as a failed coverage build`);
      await fresh.shot(evidence('K08-' + (variant.strip.length === 1 ? 'older-report-no-coverage' : 'older-report-no-v2') + '.png'));
      assertClean(fresh, 'K08 ' + variant.name);
      await fresh.close();
    }
    await db.query('UPDATE syllabus_check_reports SET report_json = ? WHERE run_id = ?', [original, latest.id]);
    await db.end();
    await f.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('K10', 'Two browser tabs on one syllabus: a save from the outdated tab is refused (HTTP 409), the newer text survives, the author is told and can load the latest version', async () => {
    const open = async (label) => {
      const s = await L.session(browser, stack);
      await s.loginOk('faculty');
      await s.nav('My Syllabi');
      await s.page.getByText('IT 205', { exact: false }).first().locator('xpath=ancestor::*[.//button[contains(., "Edit")]][1]').getByRole('button', { name: /edit/i }).first().click();
      await s.page.waitForTimeout(2500);
      s.label = label;
      return s;
    };
    const descOf = async (s) => { const c = (await s.api('GET', `/syllabi/${state.secondId}/content`)).body.content; return JSON.stringify(c.description); };
    const tabA = await open('A'), tabB = await open('B');
    const original = await descOf(tabA);
    const box = (s) => s.page.getByPlaceholder('Describe the course in a few sentences').first();
    check(await box(tabA).count() === 1 && await box(tabB).count() === 1, '[browser] both tabs show the Course Information step of the same syllabus');
    const NEWER = 'Tab A wrote the newer description. ' + original.slice(2, 40);
    await box(tabA).fill(NEWER);
    await tabA.page.waitForTimeout(3000);
    check((await descOf(tabA)).includes('Tab A wrote the newer description.'), '[api] tab A saved its edit through the builder autosave');
    check(!(tabA.issues.badResponses.some((r) => /\/content 409/.test(r))), "[browser] tab A's own save was accepted (no conflict for the up-to-date tab)");
    // the contract is mandatory: a save that does not say which version it was based on is refused (428), exactly as the server answers any client, and writes nothing
    const url = `/syllabi/${state.secondId}/content`;
    const before428 = await descOf(tabA);
    const noBase = await tabA.api('PUT', url, { sections: { description: ['A save with no base revision.'] }, schemaVersion: 3 }, { raw: true });
    check(noBase.status === 428 && noBase.body.code === 'revision_required' && noBase.body.sections.includes('description'), `[api] a save with no base revision is refused with HTTP 428 revision_required (HTTP ${noBase.status})`);
    check(await descOf(tabA) === before428, '[api] the refused save wrote nothing');
    const wrongBase = await tabA.api('PUT', url, { sections: { description: ['A save with a made-up base.'] }, schemaVersion: 3, baseRevisions: { description: 'deadbeefdeadbeef' } }, { raw: true });
    check(wrongBase.status === 409 && wrongBase.body.code === 'revision_conflict', `[api] a save with a base that is not the stored revision is refused with HTTP 409 (HTTP ${wrongBase.status})`);
    check(await descOf(tabA) === before428, '[api] the conflicting save wrote nothing');
    // tab B still shows the old text and edits the same section
    await box(tabB).fill('Tab B is outdated and must not overwrite tab A.');
    await tabB.page.waitForTimeout(3500);
    check(tabB.issues.badResponses.some((r) => /PUT \/api\/syllabi\/\d+\/content 409/.test(r)), "[browser] the outdated tab's save was answered HTTP 409 by the server");
    const afterB = await descOf(tabB);
    check(afterB.includes('Tab A wrote the newer description.') && !afterB.includes('outdated and must not overwrite'), '[api] the newer faculty content was preserved: tab B overwrote nothing');
    const banner = tabB.page.getByTestId('revision-conflict');
    check(await banner.count() === 1, '[browser] tab B shows the conflict notice');
    const bt = (await banner.innerText()).replace(/\s+/g, ' ');
    check(/Newer changes were saved/.test(bt) && /NOT saved/.test(bt) && /description/.test(bt) && /Load the latest version/.test(bt) && /replaces your unsaved changes/.test(bt), '[browser] the notice says newer changes exist, that the save did NOT happen, which section, and what loading will do: ' + bt.slice(0, 160));
    check(/Not saved\./.test(await tabB.text()), '[browser] the autosave indicator says Not saved');
    await tabB.shot(evidence('K10-1-outdated-tab-conflict-notice.png'));
    // a retry from the same outdated tab is still refused: nothing is merged silently
    await tabB.page.getByRole('button', { name: /^retry$/i }).first().click().catch(() => {});
    await tabB.page.waitForTimeout(1500);
    check(!(await descOf(tabB)).includes('outdated and must not overwrite'), '[api] retrying from the outdated tab still wrote nothing');
    // safe refresh: load the latest version; the outdated local edit is dropped, the newer text is shown, and the next edit saves normally
    await tabB.page.getByRole('button', { name: /load the latest version/i }).click();
    await tabB.page.waitForTimeout(2500);
    check(await tabB.page.getByTestId('revision-conflict').count() === 0, '[browser] the notice is gone after loading the latest version');
    check((await box(tabB).inputValue()).includes('Tab A wrote the newer description.'), "[browser] tab B now shows tab A's newer text");
    await box(tabB).fill((await box(tabB).inputValue()) + ' Tab B added this after loading the latest.');
    await tabB.page.waitForTimeout(3500);
    check((await descOf(tabB)).includes('Tab B added this after loading the latest.') && (await descOf(tabB)).includes('Tab A wrote the newer description.'), "[api] after loading the latest version tab B's next edit is saved on top of tab A's");
    await tabB.shot(evidence('K10-2-after-loading-latest.png'));
    // the stale tab A is now the outdated one: the same protection holds in the other direction
    await box(tabA).fill('Tab A is now the outdated tab.');
    await tabA.page.waitForTimeout(3500);
    check(!(await descOf(tabA)).includes('Tab A is now the outdated tab.') && await tabA.page.getByTestId('revision-conflict').count() === 1, '[browser] the protection is symmetric: the tab that became outdated is refused too');
    assertClean(tabB, 'K10 tab B', { allowStatus: [409] });
    await tabA.close(); await tabB.close();
  });

  await scenario('K09', 'No unintended network request: every provider request was answered by the scripted double; nothing left the machine', async () => {
    const { spawnSync } = require('node:child_process');
    const probe = spawnSync(process.execPath, ['-r', path.join(ROOT, 'scripts/e2e/offline-provider.cjs'), '-e', "fetch('https://example.org/').then(() => console.log('REACHED'), (e) => console.log('BLOCKED:' + e.message.split(String.fromCharCode(10))[0]))"], { encoding: 'utf8', env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot } });
    check(/BLOCKED:E2E offline guard/.test(probe.stdout) && !/REACHED/.test(probe.stdout), `[probe] the offline guard refuses a request to a public host (${probe.stdout.trim().slice(0, 90)})`);
    const events = stack.providerEvents();
    const calls = events.filter((e) => e.kind === 'provider');
    check(calls.length > 0 && calls.every((e) => e.url === 'https://api.anthropic.com/(scripted)'), `[server log] every provider request of the run (${calls.length}) was answered by the scripted double`);
    check(events.filter((e) => /^blocked/.test(e.kind)).length === 0, '[server log] the server attempted no request to any other host during the whole run');
    note('provider request modes: ' + JSON.stringify(calls.reduce((m, e) => ({ ...m, [e.mode]: (m[e.mode] || 0) + 1 }), {})));
  });
};
