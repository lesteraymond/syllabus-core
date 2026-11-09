'use strict';
// Budget-handling browser scenario for the comprehensive profile, run with a deliberately TIGHT per-check cost cap (default 6 USD, see run-comprehensive-ui.cjs --suite=budget):
// the legacy relationships that feed the official score fit, the optional supporting checks are deferred, and Policy V2 does NOT fit completely.
// The page must say so plainly, never invent a result for what was not sent, and leave the official score and the 79 pass line exactly as they are.
// The scripted provider costs nothing; the cap guards the reservation made at Claude rates. Nothing here raises a cap.
const { SECOND } = require('./seed-e2e.cjs');

module.exports = async function run(ctx, h) {
  const { scenario, check, note, evidence, assertClean, L, harness, LEVELS, RESERVED } = h;
  const { stack, browser, state } = ctx;
  const { content: sample } = harness.sample();
  const sections = { clos: sample.clos.map((clo, i) => ({ ...clo, level: LEVELS[i] })), plan: sample.plan, reqs: sample.reqs, refs: sample.refs, grading: sample.grading, outcomes: sample.outcomes,
    meta: { ...sample.meta, courseId: SECOND.courseId, code: SECOND.code, title: SECOND.title, prereq: SECOND.prereq }, description: sample.description };

  await scenario('B01', 'Tight budget (browser): the required VPAA coverage does not fit, so the page says so, items stay NOT_CHECKED, nothing is invented, and the official result is unchanged', async () => {
    const s = await L.session(browser, stack);
    await s.loginOk('faculty');
    const d = await s.api('POST', '/syllabi/drafts');
    check((await s.api('PUT', `/syllabi/${d.body.id}/content`, { sections, schemaVersion: 3 })).status === 200, '[api] a synthetic syllabus was saved');
    state.id = d.body.id;
    await s.page.reload(); await s.page.waitForTimeout(1500);
    await s.nav('AI Checker');
    if (!/IT 205/.test(await s.page.locator('.select-trigger').first().innerText())) await s.pick(/IT 20[45]/, /IT 205/);
    await s.page.getByRole('button', { name: /^ai checker$/i }).nth(1).click();
    // if the page does not reach the V2 panel, record what it shows instead of failing blind
    await s.page.waitForFunction(() => /Academic Evaluation Policy V2/.test(document.body.innerText), null, { timeout: 120000 }).catch(async (e) => {
      note('page text when the V2 panel did not appear: ' + (await s.text()).slice(0, 900));
      note('API calls: ' + s.issues.apiCalls.slice(-8).join(', '));
      await s.shot(evidence('B01-x-v2-panel-missing.png'));
      throw e;
    });
    await s.page.waitForTimeout(1500);
    const text = await s.text();
    const run = (await s.api('GET', `/compliance?syllabus=${state.id}`)).body.run;
    const budget = run.hybrid.budget, cap = budget.limits.maxCostUsd;
    note('budget at the tight cap: ' + JSON.stringify({ limits: budget.limits, used: budget.used, byPriority: budget.byPriority, deferredOptional: budget.deferredOptional, requiredIncomplete: budget.requiredIncomplete, advice: budget.advice }));
    check(cap > 0 && cap < 8, `[api] the configured cap is tight (${cap} USD) and was not raised`);
    check(budget.used.reservedCostUsd <= cap + 1e-9, `[api] the cap was respected: ${budget.used.reservedCostUsd} reserved of ${cap}`);
    // the official result is untouched by what the advisory layer could not do
    check(run.status === 'scored' && run.passThreshold === 79 && typeof run.overall === 'number', `[api] the official result is still scored against 79 (overall ${run.overall}, status ${run.status})`);
    check(/Meets the standard/.test(text) && /pass line 79%/.test(text), '[browser] the official score and the 79% pass line are shown as usual');
    // the required academic coverage is reported incomplete, loudly, with the operator decision
    check(budget.requiredIncomplete === true && !!budget.advice && budget.advice.estimatedRequiredCostUsd > cap, `[api] the report states that the required evaluations did not fit (estimated need ${budget.advice && budget.advice.estimatedRequiredCostUsd} > cap ${cap})`);
    check(await s.page.getByTestId('budget-required-incomplete').count() === 1, '[browser] the page shows the "required academic evaluations did not fit" alert');
    const alertText = (await s.page.getByTestId('budget-required-incomplete').innerText()).replace(/\s+/g, ' ');
    check(/Nothing was invented/.test(alertText) && /operator decision/.test(alertText) && alertText.includes(String(cap)), '[browser] the alert says nothing was invented, that an operator decision is needed, and states the cap: ' + alertText.slice(0, 200));
    check(/VPAA relationships checked: \d of 7/.test(text) || run.hybrid.semanticCoverage.complete === false, '[browser] the seven-relationship coverage is shown as incomplete');
    await s.shot(evidence('B01-1-required-coverage-incomplete.png'));
    // nothing is fabricated for what was not sent
    const vpaa = run.hybrid.ruleCoverage.rules.filter((r) => r.namespace === 'vpaa_type');
    const open = await (async () => { const summary = s.page.locator('summary', { hasText: /Check coverage/ }).first(); await summary.click(); await s.page.waitForTimeout(500); return s.text(); })();
    let notChecked = 0;
    for (const rule of vpaa) {
      const unchecked = rule.instances.filter((i) => !i.verified);
      notChecked += unchecked.length;
      check(unchecked.every((i) => i.status === 'NOT_CHECKED' && i.attempted !== true), `[api] ${rule.ruleId}: every instance not sent is NOT_CHECKED and not attempted (${unchecked.length} of ${rule.instances.length})`);
      if (unchecked.length) check(rule.status !== 'PASS', `[api] ${rule.ruleId} is not reported as supported while ${unchecked.length} instances were never checked (status ${rule.status})`);
    }
    check(notChecked > 0, `[api] some required VPAA instances were not sent because of the cap (${notChecked})`);
    for (const id of RESERVED) check(new RegExp(id + ' · Not checked').test(open), `[browser] reserved rule ${id} is still Not checked`);
    check(budget.deferredOptional > 0, `[api] the optional supporting checks were deferred first (${budget.deferredOptional}), not the required ones`);
    check(budget.byPriority.optional.requests < budget.byPriority.v2.requests + budget.byPriority.scored.requests, '[api] the budget went to the required work, not the optional work');
    await s.shot(evidence('B01-2-coverage-with-unchecked-vpaa.png'));
    assertClean(s, 'B01');
    await s.close();
  });
};
