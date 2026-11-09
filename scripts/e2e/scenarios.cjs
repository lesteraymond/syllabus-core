'use strict';
// The E2E scenarios, in workflow order. They share state (the one syllabus created in E02) through ctx.state. Every scenario states what it drives through the
// real UI and what it reads through the real API; nothing is mocked in the browser.
const path = require('node:path');
const { SECOND } = require('./seed-e2e.cjs');
module.exports = async function run(ctx, h) {
  const { scenario, check, known, note, evidence, assertClean, L, harness, LEVELS, RELATIONSHIPS, AREAS, DESCRIPTION, OUT, ROOT } = h;
  const { stack, browser, state } = ctx;
  const { content: sample } = harness.sample();
  const sections = {
    clos: sample.clos.map((clo, i) => ({ ...clo, level: LEVELS[i] })),
    plan: sample.plan, reqs: sample.reqs, refs: sample.refs, grading: sample.grading, outcomes: sample.outcomes,
  };
  const idOf = async (s) => { const list = await s.api('GET', '/syllabi'); const rows = Array.isArray(list.body) ? list.body : list.body?.syllabi || []; return (rows.find((r) => /IT 204/.test(r.course_code || r.courseCode || '')) || {}).syllabus_id ?? (rows[0] || {}).id; };

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('E01', 'Authentication in a real browser: failed login, successful login, session cookie flags, logout', async () => {
    const s = await L.session(browser, stack);
    await s.login('faculty', 'wrong-password-123');
    await s.page.waitForTimeout(1500);
    check(/Invalid email or password/i.test(await s.text()), 'a wrong password shows the error message and stays on the login form');
    check(s.issues.apiCalls.some((c) => c === 'POST /api/auth/login 401'), 'the failed login was answered 401 by the API');
    await s.login('nobody', 'whatever-123');
    await s.page.waitForTimeout(1200);
    check(/Access Denied|not registered/i.test(await s.text()), 'an unregistered account is refused with its own message');
    await s.loginOk('faculty');
    const text = await s.text();
    check(/Test Faculty/.test(text) && /Dashboard/i.test(text), 'the faculty dashboard renders with the signed-in name');
    const cookies = await s.ctx.cookies();
    const sid = cookies.find((c) => c.name === 'connect.sid');
    check(sid && sid.httpOnly && sid.secure && sid.sameSite === 'Lax', `connect.sid is HttpOnly, Secure and SameSite=Lax over https (${sid ? `httpOnly=${sid.httpOnly} secure=${sid.secure} sameSite=${sid.sameSite}` : 'missing'})`);
    check(!cookies.some((c) => c.name === 'remember_token' && c.value), 'no remember-me cookie unless it was requested');
    const me = await s.api('GET', '/auth/me');
    check(me.status === 200, 'the session authenticates API calls made with credentials from the https frontend origin');
    check(s.issues.cors && s.issues.cors.origin === stack.FRONT && s.issues.cors.credentials === 'true', `CORS answers the configured frontend origin only, with credentials (${JSON.stringify(s.issues.cors)})`);
    await s.shot(evidence('E01-faculty-dashboard-1440.png'));
    await s.page.getByRole('button', { name: /log out/i }).click();
    await s.page.waitForTimeout(1500);
    const after = await s.api('GET', '/auth/me');
    check(after.status === 401, 'after logging out the API refuses the old session (401)');
    check(/Sign in/i.test(await s.text()), 'the login form is shown again after logout');
    assertClean(s, 'E01', { allowStatus: [401, 403] });
    await s.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('E02', 'Faculty creates a syllabus: Step 1 through the real form (validation, selects, units), Steps 2–6 supplied through the real API, save and reload', async () => {
    // Step 1 locks the subject's term for faculty (the administrator owns year level, pre-requisite and semester), so the administrator sets IT 204's term first and the faculty form then shows it read-only.
    const setTerm = async () => { const adm = await L.session(browser, stack); await adm.loginOk('admin'); const done = await adm.api('PUT', '/courses/10', { code: 'IT 204', title: (await adm.api('GET', '/courses/10')).body.title, semester: '1st Semester', yearLevel: 2, prerequisite: 'IT 202 - Programming 1' }); await adm.close(); if (done.status !== 200) throw new Error('the administrator could not set the subject term (HTTP ' + done.status + ')'); };
    await setTerm();
    const s = await L.session(browser, stack);
    await s.loginOk('faculty');
    await s.nav('My Syllabi');
    check(/No syllabi yet/i.test(await s.text()), 'a new faculty account starts with no syllabi');
    await s.page.getByRole('button', { name: /new syllabus/i }).click();
    await s.page.waitForTimeout(2000);
    let text = await s.text();
    check(/0 of 7 complete/.test(text), 'a new draft starts with 0 of 7 steps complete');
    check(/To continue: Choose a program/.test(text) && /Add at least one description paragraph/.test(text), 'the form lists what is still missing before Step 1 can be completed (form validation)');
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
    text = await s.text();
    check(/1 Course Information ✓/.test(text), 'Step 1 shows as complete once the required fields are filled');
    check(!/To continue: Choose a program/.test(text), 'the missing-field list disappears when Step 1 is complete');
    await s.page.getByRole('button', { name: /save as draft/i }).click();
    await s.page.waitForTimeout(1500);
    state.syllabusId = await idOf(s);
    check(Number.isInteger(state.syllabusId), `the draft exists in the database (id ${state.syllabusId})`);
    // Steps 2–6 (outcomes, 18-week plan, requirements, references, grading) are long forms: they are saved through the real API from the browser session.
    const saved = await s.api('PUT', `/syllabi/${state.syllabusId}/content`, { sections, schemaVersion: 3 });
    check(saved.status === 200, `Steps 2–6 saved through PUT /syllabi/:id/content (HTTP ${saved.status} ${saved.status === 200 ? '' : JSON.stringify(saved.body).slice(0, 220)})`);
    note('Steps 2–6 were supplied through the real API (not typed into the form) to keep the run bounded; Step 1 and the review step were driven through the UI.');
    await s.page.reload(); await s.page.waitForTimeout(1500);
    await s.nav('My Syllabi');
    check(/IT 204/.test(await s.text()) && /Draft/.test(await s.text()), 'after a full page reload the draft is listed in My Syllabi');
    await s.page.getByRole('button', { name: /edit/i }).first().click();
    await s.page.waitForTimeout(2500);
    text = await s.text();
    check(/7 of 7 complete/.test(text), 'reopening the draft shows 7 of 7 steps complete (save and reload persistence)');
    check(/Program \* BSIT/.test(text) && /IT 204 – Computer Programming 2/.test(text), 'the Step 1 choices were persisted');
    await s.page.getByRole('button', { name: /7 review syllabus/i }).click();
    await s.page.waitForTimeout(1200);
    text = await s.text();
    check(/COURSE LEARNING OUTCOMES/.test(text) && /LEARNING PLAN/.test(text) && /Integration of Values/.test(text), 'the review preview renders the outcomes with the four CLO classifications and the learning plan');
    await s.shot(evidence('E02-builder-review-1440.png'));
    assertClean(s, 'E02');
    await s.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('E03', 'Faculty runs the checker on the draft: official compliance score, six areas, all seven VPAA relationships, advisory only', async () => {
    const before = stack.providerEvents().filter((e) => e.kind === 'provider').length;
    const s = await L.session(browser, stack);
    await s.loginOk('faculty');
    await s.nav('AI Checker');
    await s.page.getByRole('button', { name: /^ai checker$/i }).nth(1).click();
    await s.page.getByText('Academic Evaluation Policy V2').first().waitFor({ timeout: 60000 });
    await s.page.waitForTimeout(800);
    const text = await s.text();
    check(/Meets the standard/.test(text) && /\(pass line 79%\)|79%/.test(text), 'the official score is shown against the 79% pass line');
    for (const rel of RELATIONSHIPS) check(new RegExp(':' + rel + '\\b').test(text), `relationship ${rel} is evaluated and rendered`);
    check(/has no effect on the official score, deductions, passing mark or submission gate/.test(text), 'the page states that the academic alignment is advisory only');
    check(/anthropic · claude-sonnet-5-5/.test(text) && /Evaluated/.test(text), 'the AI status shows the approved provider and model (scripted) as Evaluated');
    check(!/Requires faculty review; never applied automatically.*Check & Improve/.test(text), 'a draft preview offers no automatic correction');
    check(/requires revision/i.test(text) && /faculty review/i.test(text), 'the scripted gaps are reported as findings (Requires revision / Faculty review)');
    const calls = stack.providerEvents().filter((e) => e.kind === 'provider').length - before;
    // Every provider request goes through the check's one shared budget, so the number of scripted requests must equal what the budget counted and stay within its configured limit
    // (a fixed number would be wrong for every other profile: the comprehensive profile legitimately sends more than Policy V2 alone).
    const budget = (((await s.api('GET', '/compliance?syllabus=' + state.syllabusId)).body || {}).run || {}).hybrid;
    const counted = budget && budget.academicV2 && budget.academicV2.alignment && budget.academicV2.alignment.requestBudget;
    check(calls > 0 && (!counted || (calls === counted.requests && calls <= counted.maxRequests)), `the provider was reached only through the scripted double, and every request was counted by the shared budget (${calls} request(s)${counted ? ', budget counted ' + counted.requests + ' of ' + counted.maxRequests : ''})`);
    check(stack.providerEvents().every((e) => !/^blocked/.test(e.kind)), 'no request to any other host was attempted by the server');
    await s.shot(evidence('E03-faculty-checker-1440.png'));
    assertClean(s, 'E03');
    await s.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('E04', 'Faculty submits through the UI; the syllabus locks; another faculty member and signed-out callers cannot reach it', async () => {
    const s = await L.session(browser, stack);
    await s.loginOk('faculty');
    await s.nav('AI Checker');
    await s.page.getByRole('button', { name: /submit to admin/i }).click();
    await s.page.waitForTimeout(2500);
    let text = await s.text();
    check(/Submitted/.test(text) && /Review: Dean/.test(text), 'My Syllabi shows Submitted with the review chain (Dean, Asst. VPAA, LIC Director)');
    check(/submitted and is locked/i.test(text), 'the page explains that the submitted syllabus is locked');
    check(s.issues.apiCalls.some((c) => c === 'POST /api/syllabi/' + state.syllabusId + '/submit 200'), 'the submit call was answered 200');
    const edit = await s.api('PUT', '/syllabi/' + state.syllabusId + '/content', { sections: { reqs: sections.reqs }, schemaVersion: 3 });
    check(edit.status === 409, 'a locked syllabus refuses edits from its own owner (HTTP ' + edit.status + ')');
    const adminOnly = await s.api('GET', '/users');
    check(adminOnly.status === 403, 'a faculty account is refused an administrator API (HTTP ' + adminOnly.status + ')');
    await s.close();
    const other = await L.session(browser, stack);
    await other.loginOk('other');
    const peek = await other.api('GET', '/syllabi/' + state.syllabusId + '/content');
    check(peek.status === 404, "another faculty member cannot read the first member's syllabus (HTTP " + peek.status + ')');
    const write = await other.api('PUT', '/syllabi/' + state.syllabusId + '/content', { sections: { reqs: sections.reqs }, schemaVersion: 3 });
    check([403, 404].includes(write.status), "another faculty member cannot write to it (HTTP " + write.status + ')');
    const rec = await other.api('POST', '/syllabus-check/runs/1/refine', {});
    check([401, 403, 404, 400, 409].includes(rec.status), 'a recommendation action by a non-owner is not accepted (HTTP ' + rec.status + ')');
    await other.nav('My Syllabi');
    check(!/IT 204/.test(await other.text()), "the other member's My Syllabi does not list it");
    await other.close();
    const anon = await L.session(browser, stack);
    await anon.page.goto(stack.FRONT);
    const anonCalls = [await anon.api('GET', '/syllabi'), await anon.api('GET', '/syllabi/' + state.syllabusId + '/content'), await anon.api('POST', '/syllabi/' + state.syllabusId + '/submit', {}), await anon.api('GET', '/compliance?syllabus=all')];
    check(anonCalls.every((r) => r.status === 401), 'signed-out callers get 401 from every protected API (' + anonCalls.map((r) => r.status).join(',') + ')');
    await anon.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('E05', 'Administrator runs the official check: six weighted areas, 100% against 79, seven VPAA relationships, advisory panel, read-only for content', async () => {
    const s = await L.session(browser, stack);
    await s.loginOk('admin');
    const nav = await s.text();
    check(/Review & Approval/i.test(nav) && /Users & Roles/i.test(nav), 'the administrator sees the administration menus');
    await s.nav('Review & Approval');
    check(/waiting for the AI Checker/i.test(await s.text()), 'Review & Approval holds the submission back until the AI Checker has run');
    await s.nav('AI Checker');
    await s.pick(/Choose a faculty member/, /Test Faculty/);
    await s.pick(/Choose a program/, /BSIT/);
    await s.pick(/Choose a subject/, /IT 204/);
    await s.page.getByRole('button', { name: /check compliance/i }).click();
    await s.page.getByText('Academic Evaluation Policy V2').first().waitFor({ timeout: 60000 });
    await s.page.waitForTimeout(1000);
    const text = await s.text();
    check(/Meets the standard/.test(text) && /100%/.test(text), 'the official result is 100% and meets the standard');
    for (const area of AREAS) check(text.includes(area), 'area scored: ' + area);
    for (const rel of RELATIONSHIPS) check(text.includes(':' + rel + ' ') || text.includes(':' + rel), 'relationship ' + rel + ' appears in the saved report view');
    check(!text.includes('VPAA relationships checked'), 'no incomplete-coverage warning when all seven relationships were evaluated');
    check(/Academic alignment has no numeric score, deductions or passing mark/.test(text), 'the advisory panel states that it has no numeric score or passing mark');
    check(s.issues.apiCalls.some((c) => c.startsWith('POST /api/') && c.includes('check') && c.endsWith(' 200')), 'the official check ran through the shared hybrid service (POST ... 200: ' + s.issues.apiCalls.filter((c) => c.startsWith('POST') && !c.includes('heartbeat')).join(', ') + ')');
    await s.shot(evidence('E05-admin-official-check-1440.png'));
    const edit = await s.api('PUT', '/syllabi/' + state.syllabusId + '/content', { sections: { reqs: sections.reqs }, schemaVersion: 3 });
    check([403, 409].includes(edit.status), "an administrator cannot edit the faculty member's syllabus content (HTTP " + edit.status + ')');
    assertClean(s, 'E05', { allowStatus: [403] });
    await s.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('E06', 'Administrator opens the checked submission in Review & Approval and returns it for revision with a note', async () => {
    const s = await L.session(browser, stack);
    await s.loginOk('admin');
    await s.nav('Review & Approval');
    let text = await s.text();
    check(/1 PENDING/i.test(text) && /IT 204/.test(text), 'the checked submission now appears as pending');
    await s.page.getByRole('button', { name: /IT 204/ }).first().click();
    await s.page.waitForTimeout(3000);
    text = await s.text();
    check(/Clear my check/.test(text) && /Return for revision/.test(text), 'the reviewer sees the document with Clear my check and Return for revision');
    check(/Dean/.test(text) && /Asst. VPAA/.test(text) && /LIC Director/.test(text), 'the three clearing stages are shown');
    check(/COURSE LEARNING OUTCOMES|VI. COURSE LEARNING OUTCOMES/.test(text) && /Integration of Values|CLO 4/.test(text), 'the full syllabus is readable in the review document');
    await s.shot(evidence('E06-review-document-1440.png'));
    const note = s.page.getByLabel(/note to the faculty member/i).first();
    if (await note.count()) await note.fill('Synthetic E2E note: please review the week 1 activity and assessment wording.');
    else await s.page.locator('textarea').last().fill('Synthetic E2E note: please review the week 1 activity and assessment wording.');
    await s.page.getByRole('button', { name: /return for revision/i }).click();
    await s.page.waitForTimeout(1500);
    const confirm = s.page.getByRole('dialog').getByRole('button', { name: /return|confirm|yes/i });
    if (await confirm.count()) await confirm.first().click();
    await s.page.waitForTimeout(2500);
    text = await s.text();
    check(s.issues.apiCalls.includes('PUT /api/syllabi/' + state.syllabusId + ' 200'), 'the return was accepted by the API (' + s.issues.apiCalls.filter((c) => c.startsWith('POST') || c.startsWith('PATCH') || c.startsWith('PUT')).filter((c) => !c.includes('heartbeat')).join(', ') + ')');
    check(!/1 PENDING/i.test(text) || /All caught up/i.test(text), 'the item leaves the pending list once returned');
    assertClean(s, 'E06');
    await s.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('E07', 'Faculty, after the return: sees For Revision and the note, opens the official report, and reviews the recommendation', async () => {
    const s = await L.session(browser, stack);
    await s.loginOk('faculty');
    await s.nav('My Syllabi');
    let text = await s.text();
    check(/For Revision/i.test(text), 'My Syllabi shows the returned syllabus as For Revision');
    await s.nav('AI Checker');
    await s.page.waitForTimeout(2500);
    text = await s.text();
    check(text.includes('Corrections for human review'), 'the official report offers a corrections section');
    check(!text.includes('No correction is recommended for faculty review'), 'the scripted gaps produce at least one correction recommendation');
    const buttons = await s.page.$$eval('button', (els) => els.map((e) => e.innerText.split(String.fromCharCode(10)).join(' ').trim()).filter(Boolean));
    note('buttons on the faculty checker after the return: ' + buttons.slice(6).join(' | '));
    await s.shot(evidence('E07-faculty-after-return-1440.png'));
    assertClean(s, 'E07');
    await s.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('E08', 'Recommendation actions in the real UI: Check & improve, Accept (the draft changes), Undo (it changes back), Reject', async () => {
    const s = await L.session(browser, stack);
    await s.loginOk('faculty');
    await s.nav('AI Checker');
    await s.page.waitForTimeout(2500);
    const activities = async () => { const c = await s.api('GET', '/syllabi/' + state.syllabusId + '/content'); return JSON.stringify(c.body.content.plan[0].activities); };
    const original = await activities();
    const verify = s.page.getByRole('button', { name: /check & improve/i }).first();
    check(await verify.count() === 1, 'one correctable recommendation offers Check & improve');
    const providerBefore = stack.providerEvents().filter((e) => e.kind === 'provider').length;
    await verify.click();
    await s.page.waitForTimeout(6000);
    let text = await s.text();
    check(!/Check & improve failed|could not/i.test(text), 'Check & improve completed without an error message');
    check(stack.providerEvents().filter((e) => e.kind === 'provider').length > providerBefore, 'Check & improve asked the (scripted) provider to verify the proposed wording');
    note('after Check & improve: ' + text.slice(text.indexOf('Corrections for human review'), text.indexOf('Corrections for human review') + 700));
    note('recommendation card after Check & improve: ' + (await s.page.locator('.hy-rec').first().evaluate((el) => el.innerText.split(String.fromCharCode(10)).join(' | ') + ' || disabled: ' + [...el.querySelectorAll('button')].map((x) => x.innerText.trim() + '=' + x.disabled).join(', '))));
    await s.page.getByRole('button', { name: /^accept$/i }).first().click();
    await s.page.waitForTimeout(3500);
    const accepted = await activities();
    check(accepted !== original, 'Accept wrote the recommended text into the saved draft');
    check(s.issues.apiCalls.some((c) => c.startsWith('PUT /api/syllabi/' + state.syllabusId + '/content 200')), 'the accepted change was saved through the content API');
    text = await s.text();
    note('after Accept buttons: ' + (await s.page.$$eval('button', (els) => els.map((e) => e.innerText.trim()).filter(Boolean))).slice(8).join(' | '));
    // Undo: offered for the applied recommendation, restores the original text only while the field still holds what was applied, and records the reversal.
    const undoButton = s.page.getByRole('button', { name: /^undo change$/i });
    check(await undoButton.count() === 1, 'an Undo control is offered for the applied recommendation');
    await undoButton.click();
    await s.page.waitForTimeout(3500);
    check(await activities() === original, 'Undo restored the original saved text');
    check(/Change undone/.test(await s.text()), 'Undo reports success on the page');
    note('syllabus-check calls: ' + (s.issues.checkBodies || []).join(' || '));
    note('failed responses: ' + (s.issues.failedBodies || []).join(' || '));
    await s.shot(evidence('E08-recommendation-actions-1440.png'));
    assertClean(s, 'E08');
    await s.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('E09', 'Faculty: Reject a recommendation, then Check & improve + Accept the next one, Re-Check, write what changed and submit the new version', async () => {
    const s = await L.session(browser, stack);
    await s.loginOk('faculty');
    await s.nav('AI Checker');
    await s.page.waitForTimeout(2000);
    const activities = async () => { const c = await s.api('GET', '/syllabi/' + state.syllabusId + '/content'); return JSON.stringify(c.body.content.plan[0].activities); };
    const original = await activities();
    await s.page.getByRole('button', { name: /re-check again/i }).first().click();
    await s.page.waitForTimeout(6000);
    check(await s.page.locator('.hy-rec').count() >= 1, 'a Re-Check offers the correctable recommendation again');
    await s.page.getByRole('button', { name: /^reject$/i }).first().click();
    await s.page.waitForTimeout(2500);
    check(s.issues.apiCalls.some((c) => c.includes('/decisions 201')), 'Reject was recorded by the decisions API');
    check(await activities() === original, 'Reject changed nothing in the saved draft');
    await s.page.getByRole('button', { name: /re-check again/i }).first().click();
    await s.page.waitForTimeout(6000);
    const again = await s.page.locator('.hy-rec').count();
    note('recommendation cards after Reject + Re-Check: ' + again);
    if (again >= 1) {
      await s.page.getByRole('button', { name: /check & improve/i }).first().click();
      await s.page.waitForTimeout(6000);
      await s.page.getByRole('button', { name: /^accept$/i }).first().click();
      await s.page.waitForTimeout(3500);
      check(await activities() !== original, 'Check & improve then Accept changed the saved draft');
    } else known('E2E-03', 'after Reject and a Re-Check the same recommendation did not return, so the Accept path could not be exercised on this syllabus');
    await s.page.getByRole('button', { name: /re-check again/i }).first().click();
    await s.page.waitForTimeout(6000);
    let text = await s.text();
    check(/Meets the standard/.test(text), 'the Re-Check after the correction still meets the standard (official score is not changed by the advisory result)');
    const submit = s.page.getByRole('button', { name: /submit new version to admin/i });
    check(await submit.isDisabled(), 'Submit new version stays disabled until the author says what changed');
    await s.page.getByLabel(/what did you change/i).fill('Synthetic E2E: rewrote the week 1 activity to practise the weekly topic.');
    await s.page.waitForTimeout(500);
    check(!(await submit.isDisabled()), 'Submit new version is enabled once the change note is written');
    await submit.click();
    await s.page.waitForTimeout(3000);
    text = await s.text();
    check(/Submitted/.test(text), 'the corrected syllabus is Submitted again');
    const h = await s.api('GET', '/syllabi/' + state.syllabusId + '/versions');
    check(h.status === 200 && JSON.stringify(h.body).includes('v1.1'), 'a new version (v1.1) exists in the history');
    await s.shot(evidence('E09-resubmitted-1440.png'));
    assertClean(s, 'E09');
    await s.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('E10', 'Review chain through the UI: administrator re-checks and clears, Asst. VPAA and LIC Director clear, VPAA approves; approval gates are enforced', async () => {
    // the app confirms each decision in a dialog: press its confirming button (any button that is not Cancel/Close)
    const confirmDialog = async (s) => { const dlg = s.page.getByRole('alertdialog'); try { await dlg.waitFor({ timeout: 4000 }); } catch { return false; } await dlg.getByRole('button', { name: /^confirm$/i }).click(); await s.page.waitForTimeout(2500); return 'Confirm'; };
    const openFirst = async (s) => { await s.nav('Review & Approval'); await s.page.getByRole('button', { name: /IT 204/ }).first().click(); await s.page.waitForTimeout(2500); };
    // before the AI Checker has run on this version, even the VPAA cannot decide on it
    const early0 = await L.session(browser, stack);
    await early0.loginOk('vpaa');
    const unchecked = await early0.api('PUT', '/syllabi/' + state.syllabusId, { status: 'approved' });
    check(unchecked.status === 409 && /Check this syllabus in the AI Checker/.test(JSON.stringify(unchecked.body)), 'the VPAA cannot decide on a version the AI Checker has not checked (HTTP ' + unchecked.status + ')');
    await early0.close();

    const admin = await L.session(browser, stack);
    await admin.loginOk('admin');
    await admin.nav('AI Checker');
    await admin.pick(/Choose a faculty member/, /Test Faculty/);
    await admin.pick(/Choose a program/, /BSIT/);
    await admin.pick(/Choose a subject/, /IT 204/);
    await admin.page.getByRole('button', { name: /check compliance/i }).click();
    await admin.page.getByText('Academic Evaluation Policy V2').first().waitFor({ timeout: 60000 });
    check(/Meets the standard/.test(await admin.text()) && /100%/.test(await admin.text()), 'the re-check of the corrected version is 100% and meets the standard');
    await admin.page.getByRole('dialog').getByRole('button', { name: /^close$/i }).click(); // the result opens in a modal over the page
    // checked but not yet cleared by the three stages: the VPAA still cannot approve
    const early = await L.session(browser, stack);
    await early.loginOk('vpaa');
    const tooEarly = await early.api('PUT', '/syllabi/' + state.syllabusId, { status: 'approved' });
    check(tooEarly.status === 409 && /must each clear/.test(JSON.stringify(tooEarly.body)), 'the VPAA cannot approve while the three stages have not cleared (HTTP ' + tooEarly.status + ' ' + JSON.stringify(tooEarly.body).slice(0, 120) + ')');
    await early.close();


    await admin.page.waitForTimeout(600);
    await openFirst(admin);
    const notVpaa = await admin.api('PUT', '/syllabi/' + state.syllabusId, { status: 'approved' });
    check(notVpaa.status === 403, 'a Dean (administrator) cannot approve: only the VPAA can (HTTP ' + notVpaa.status + ')');
    await admin.page.getByRole('button', { name: /clear my check/i }).click();
    note('Dean confirm: ' + await confirmDialog(admin));
    let text = await admin.text();
    check(/DeanW+(Cleared|Test Administrator)|Cleared/.test(text), 'the Dean stage shows as cleared (' + text.slice(text.indexOf('Decision'), text.indexOf('Decision') + 160) + ')');
    await admin.close();

    for (const who of ['asst', 'lic']) {
      const r = await L.session(browser, stack);
      await r.loginOk(who);
      await openFirst(r);
      await r.page.getByRole('button', { name: /clear my check/i }).click();
      await confirmDialog(r);
      check(/Cleared/.test(await r.text()), who + ' stage cleared through the UI');
      await r.close();
    }

    const vpaa = await L.session(browser, stack);
    await vpaa.loginOk('vpaa');
    await openFirst(vpaa);
    const approve = vpaa.page.getByRole('button', { name: /^approve/i });
    check(await approve.count() >= 1, 'once all three stages cleared, the VPAA is offered Approve');
    await vpaa.shot(evidence('E10-vpaa-approval-1440.png'));
    await approve.first().click();
    note('VPAA confirm button: ' + await confirmDialog(vpaa));
    text = await vpaa.text();
    check(!/1 PENDING/i.test(text) || /All caught up/i.test(text), 'the approved item leaves the pending list');
    note('VPAA calls: ' + vpaa.issues.apiCalls.filter((c) => !c.startsWith('GET') && !c.includes('heartbeat')).join(', '));
    await vpaa.close();
    const faculty = await L.session(browser, stack);
    await faculty.loginOk('faculty');
    await faculty.nav('My Syllabi');
    check(/Approved/.test(await faculty.text()), 'the faculty member sees the syllabus as Approved');
    await faculty.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('E11', 'Repository and read-only behaviour after approval: faculty and administrator see it, nobody can edit it, a faculty account has no administrator surface', async () => {
    const f = await L.session(browser, stack);
    await f.loginOk('faculty');
    await f.nav('Repository');
    let text = await f.text();
    check(/IT 204/.test(text) && /Approved/.test(text), 'the approved syllabus is listed in the faculty Repository');
    const edit = await f.api('PUT', '/syllabi/' + state.syllabusId + '/content', { sections: { reqs: sections.reqs }, schemaVersion: 3 });
    check(edit.status === 409, 'an approved syllabus is locked against edits by its own owner (HTTP ' + edit.status + ')');
    const recheck = await f.api('POST', '/syllabi/' + state.syllabusId + '/compliance/recheck', { force: true });
    check(recheck.status === 409, 'an approved syllabus is not re-checked (HTTP ' + recheck.status + ')');
    const menu = await f.page.$$eval('aside button', (els) => els.map((e) => e.innerText.trim().toLowerCase()));
    check(!menu.some((m) => /users & roles|program & subjects|review & approval/.test(m)), 'a faculty account is not offered the administrator menus');
    const adminApis = await Promise.all([f.api('GET', '/users'), f.api('POST', '/users', { email: 'x@e2e.invalid', role: 'admin' }), f.api('PUT', '/courses/10/clos', { clos: [] })]);
    check(adminApis.every((r) => r.status === 403), 'administrator APIs answer 403 to a faculty account (' + adminApis.map((r) => r.status).join(',') + ')');
    await f.shot(evidence('E11-faculty-repository-1440.png'));
    assertClean(f, 'E11-faculty', { allowStatus: [403, 409] });
    await f.close();
    const a = await L.session(browser, stack);
    await a.loginOk('admin');
    await a.nav('Repository');
    text = await a.text();
    check(/IT 204/.test(text) && /Approved/.test(text), 'the administrator sees the approved syllabus in the Repository');
    const adminEdit = await a.api('PUT', '/syllabi/' + state.syllabusId + '/content', { sections: { reqs: sections.reqs }, schemaVersion: 3 });
    check([403, 409].includes(adminEdit.status), 'an administrator cannot rewrite faculty content in the repository (HTTP ' + adminEdit.status + ')');
    assertClean(a, 'E11-admin', { allowStatus: [403, 409] });
    await a.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  // a second, editable syllabus (IT 205) for the scenarios that must not disturb the approved one
  const second = { meta: { ...sample.meta, courseId: SECOND.courseId, code: SECOND.code, title: SECOND.title, prereq: SECOND.prereq }, description: sample.description };
  const second_sections = { ...sections, ...second };
  await scenario('E12', 'AI offline: provider outage, rejected credentials, rate limit and an invalid answer never stop the deterministic checker or fake a verification', async () => {
    const outcomes = {};
    const f = await L.session(browser, stack);
    await f.loginOk('faculty');
    const d = await f.api('POST', '/syllabi/drafts');
    const put = await f.api('PUT', '/syllabi/' + d.body.id + '/content', { sections: second_sections, schemaVersion: 3 });
    check(put.status === 200, 'a second synthetic syllabus (IT 205) was saved (HTTP ' + put.status + ')');
    state.secondId = d.body.id;
    // the first-ever run happens while the provider is down, through the real page
    stack.setProvider('down');
    await f.page.reload(); await f.page.waitForTimeout(2000); // the syllabus list was loaded before this draft existed
    await f.nav('AI Checker');
    if (!/IT 205/.test(await f.page.locator('.select-trigger').first().innerText())) await f.pick(/IT 20[45]/, /IT 205/);
    await f.page.getByRole('button', { name: /^ai checker$/i }).nth(1).click();
    await f.page.getByText(/VPAA relationships checked/).first().waitFor({ timeout: 40000 });
    const text = await f.text();
    note('page text with the AI down: ' + text.slice(text.indexOf('Compliance check'), text.indexOf('Compliance check') + 700));
    note('page tail with the AI down: ' + text.slice(-700));
    check(/Verification incomplete/.test(text) && /no final AI score yet/.test(text) && /AI unavailable/.test(text), 'with the AI down on a first-ever check the page says Verification incomplete / no final AI score yet / AI unavailable, and does not report a pass');
    check(!/Meets the standard/.test(text), 'no "Meets the standard" verdict is shown when the AI-scored part could not run');
    check(/You can still submit/.test(text), 'the advisory AI gate still lets the author submit (the AI never blocks or approves)');
    check(!/Evaluated/.test(text) || /Not evaluated|not evaluated/.test(text), 'the page does not claim the AI evaluation succeeded');
    check(/VPAA relationships checked: 0 of 7|0 of 7/.test(text), 'the incomplete seven-relationship coverage is stated explicitly (0 of 7)');
    await f.shot(evidence('E12-ai-down-1440.png'));
    assertClean(f, 'E12-ui', { allowStatus: [401, 409, 502, 503] });
    // Each failure mode on a syllabus whose text changed since its last check, so there is nothing verified to reuse (SYLLABUS_CHECK_REUSE) and the provider really is needed.
    // Order matters: a 401/403 starts a process-wide cooldown, so it goes last.
    const recheck = async () => { const r = await f.api('POST', '/syllabi/' + d.body.id + '/compliance/recheck', { force: true }); return { r, run: (r.body && r.body.run) || {} }; };
    let plan = structuredClone(second_sections.plan);
    const edit = async (tag) => { plan = plan.map((row) => (row.kind === 'exam' ? row : { ...row, contents: String(row.contents).split(' [')[0] + ' [' + tag + ']', activities: String(row.activities).split(' [')[0] + ' [' + tag + ']', tasks: String(row.tasks).split(' [')[0] + ' [' + tag + ']' })); return f.api('PUT', '/syllabi/' + d.body.id + '/content', { sections: { plan }, schemaVersion: 3 }); };
    for (const mode of ['ok', 'down', 'rate', 'invalid', 'auth']) {
      stack.setProvider(mode);
      await edit(mode);
      const { r, run } = await recheck();
      const cov = run.hybrid && run.hybrid.semanticCoverage;
      outcomes[mode] = { http: r.status, overall: run.overall, passed: run.passed, status: run.status, aiStatus: run.aiStatus, evaluated: cov && cov.evaluated, complete: cov && cov.complete, reason: cov && cov.reason };
      if (mode === 'ok') {
        check(r.status === 200 && run.status === 'scored' && run.passed === true && cov && cov.complete === true && cov.evaluated === 7, 'ok: the check scores and all seven relationships are evaluated');
        // an UNCHANGED syllabus re-checked while the AI is down keeps what was already verified and sends no request (SYLLABUS_CHECK_REUSE)
        stack.setProvider('down'); const before = stack.providerEvents().filter((e) => e.kind === 'provider').length; const same = await recheck();
        check(same.run.status === 'scored' && same.run.hybrid.semanticCoverage.complete === true && stack.providerEvents().filter((e) => e.kind === 'provider').length === before, 'an unchanged syllabus re-checked while the AI is down keeps its verified result and sends no provider request (reuse)');
        stack.setProvider('ok');
      }
      else {
        check(r.status === 200, mode + ': the check still answers (HTTP ' + r.status + '), the deterministic checker keeps working');
        check(run.passed !== true && (run.overall === null || run.overall === undefined) && run.status === 'incomplete' && run.aiStatus === 'failed', mode + ': it is reported incomplete (AI failed), with no score and no pass claimed (status ' + run.status + ', overall ' + run.overall + ', passed ' + run.passed + ')');
        check(cov && cov.complete === false && cov.evaluated < 7 && !!cov.reason, mode + ': the seven-relationship coverage is incomplete with a reason (' + (cov && cov.reason) + ', ' + (cov && cov.evaluated) + '/7)');
      }
    }
    note('failure-mode outcomes: ' + JSON.stringify(outcomes));
    stack.setProvider('ok');
    await f.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('E13', 'English / Filipino localization in the real UI: switch language, navigation and checker texts change, the choice survives a reload and is restored', async () => {
    const s = await L.session(browser, stack);
    await s.loginOk('faculty');
    let text = await s.text();
    check(/Dashboard/i.test(text) && /Syllabus Builder/i.test(text), 'the interface starts in English');
    await s.nav('Settings');
    await s.page.locator('.select-trigger').first().click();
    await s.page.getByRole('option', { name: /tagalog/i }).first().click();
    await s.page.waitForTimeout(2000);
    text = await s.text();
    check(/Pangkalahatang Tanaw/i.test(text) && /Mga Setting/i.test(text) && /Tagabuo ng Silabus/i.test(text), 'the navigation is shown in Filipino');
    await s.page.getByRole('button', { name: /^ai checker$/i }).first().click();
    await s.page.waitForTimeout(2500);
    text = await s.text();
    check(/Tagasuri ng Silabus gamit ang AI/.test(text) && /Patakaran V2 sa Akademikong Pagsusuri|Akademikong pagkakaugnay/.test(text), 'the AI Checker and the Policy V2 panel are shown in Filipino');
    check(!/Academic Evaluation Policy V2/.test(text), 'no English heading is left in the translated panel');
    await s.shot(evidence('E13-filipino-checker-1440.png'));
    await s.page.reload();
    await s.page.waitForTimeout(2500);
    check(/Magandang gabi|Magandang umaga|Magandang hapon/.test(await s.text()), 'the language choice survives a full reload (saved on the account)');
    await s.nav('Mga Setting');
    await s.page.locator('.select-trigger').first().click();
    await s.page.getByRole('option', { name: /english/i }).first().click();
    await s.page.waitForTimeout(1500);
    check(/Dashboard/i.test(await s.text()) && /Display language/i.test(await s.text()), 'switching back restores English');
    assertClean(s, 'E13', { allowStatus: [409] });
    await s.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('E14', 'Responsive layouts at 375, 768, 1024 and 1440 px: no horizontal overflow, navigation reachable, key pages usable', async () => {
    const pages = [['Dashboard', /Good (morning|afternoon|evening)/i], ['My Syllabi', /My Syllabi/], ['AI Checker', /AI Syllabus Checker/], ['Repository', /Syllabus Repository/]];
    for (const [name, vp] of Object.entries(L.VIEWPORTS)) {
      const s = await L.session(browser, stack, { viewport: vp });
      await s.loginOk('faculty');
      for (const [label, marker] of pages) {
        await s.nav(label);
        const metrics = await s.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        check(marker.test(await s.text()), name + ' ' + vp.width + 'px: ' + label + ' renders');
        check(metrics.sw <= metrics.cw + 1, name + ' ' + vp.width + 'px: ' + label + ' has no horizontal page overflow (scrollWidth ' + metrics.sw + ' <= ' + metrics.cw + ')');
        if (label === 'AI Checker') await s.shot(evidence('E14-checker-' + vp.width + '.png'));
      }
      assertClean(s, 'E14-' + vp.width, { allowStatus: [409] });
      await s.close();
    }
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('E15', 'Official scoring parity: the same syllabus gets the identical official result with Policy V2 on and with Policy V2 off', async () => {
    const { startApi, waitFor } = require('./stack.cjs');
    const offPort = Number(new URL(stack.API).port) + 200, onPort = Number(new URL(stack.API).port) + 100;
    // two fresh servers (V2 on, V2 off) rather than the main one: E12 ends with a rejected-credentials failure, which starts a 300 s provider cooldown inside that process
    const on_ = startApi({ port: onPort, work: stack.work, front: stack.FRONT, control: stack.control, providerLog: stack.work + '/provider-log-v2on.jsonl', serverLog: stack.work + '/api-v2on.log', extraEnv: { ...(process.env.E2E_DB_PORT ? { E2E_DB_PORT: process.env.E2E_DB_PORT } : {}) } });
    const off = startApi({ port: offPort, work: stack.work, front: stack.FRONT, control: stack.control, providerLog: stack.work + '/provider-log-v2off.jsonl', serverLog: stack.work + '/api-v2off.log', extraEnv: { ...(process.env.E2E_DB_PORT ? { E2E_DB_PORT: process.env.E2E_DB_PORT } : {}), SYLLABUS_CHECK_ACADEMIC_V2: 'off' } });
    try {
      await waitFor('http://127.0.0.1:' + offPort + '/api/health', 40000);
      await waitFor('http://127.0.0.1:' + onPort + '/api/health', 40000);
      const call = async (base, cookie, method, url, body) => { const r = await fetch(base + '/api' + url, { method, headers: { 'Content-Type': 'application/json', Origin: stack.FRONT, 'X-Forwarded-Proto': 'https', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch { /* none */ } return { r, status: r.status, body: j }; };
      const login = async (base) => { const r = await call(base, '', 'POST', '/auth/login', { email: 'e2e.faculty@e2e.invalid', password: L.PASSWORD }); return (r.r.headers.getSetCookie() || []).map((c) => c.split(';')[0]).filter((c) => c.startsWith('connect.sid')).join('; '); };
      const probe = async (base) => { const cookie = await login(base); const r = await call(base, cookie, 'POST', '/syllabi/' + state.secondId + '/compliance/recheck', { force: true }); return r.body && r.body.run; };
      stack.setProvider('ok');
      const on = await probe('http://127.0.0.1:' + onPort);
      const offRun = await probe('http://127.0.0.1:' + offPort);
      check(on && offRun, 'both servers produced a run (V2 on, V2 off)');
      check(on.hybrid.academicV2 && on.hybrid.academicV2.mode === 'live-application', 'the first server has Policy V2 integrated');
      check(!offRun.hybrid.academicV2, 'the second server has Policy V2 off');
      const official = (r) => JSON.stringify({ overall: r.overall, passed: r.passed, band: r.band, passThreshold: r.passThreshold, areas: (r.areas || []).map((a) => [a.id || a.name, a.score]), findings: (r.findings || []).map((x) => x.id || x.ruleId).sort() });
      check(official(on) === official(offRun), 'official score, bands, six area scores and rule findings are identical with Policy V2 on and off (' + on.overall + ' vs ' + offRun.overall + ')');
      check(on.passThreshold === 79 && offRun.passThreshold === 79, 'the passing threshold is 79 in both');
      note('V2 on: overall=' + on.overall + ' areas=' + (on.areas || []).length + ' | V2 off: overall=' + offRun.overall + ' areas=' + (offRun.areas || []).length);
    } finally { off.kill(); on_.kill(); }
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('E16', 'No unintended network request: the guard blocks every non-loopback connection, and the whole run produced only scripted provider requests', async () => {
    const { spawnSync } = require('node:child_process');
    const probe = spawnSync(process.execPath, ['-r', path.join(ROOT, 'scripts/e2e/offline-provider.cjs'), '-e', "fetch('https://example.org/').then(() => console.log('REACHED'), (e) => console.log('BLOCKED:' + e.message.split(String.fromCharCode(10))[0]))"], { encoding: 'utf8', env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot } });
    check(/BLOCKED:E2E offline guard/.test(probe.stdout) && !/REACHED/.test(probe.stdout), 'the offline guard refuses a request to a public host (' + probe.stdout.trim().slice(0, 90) + ')');
    const events = stack.providerEvents();
    const providerCalls = events.filter((e) => e.kind === 'provider');
    check(providerCalls.length > 0 && providerCalls.every((e) => e.url === 'https://api.anthropic.com/(scripted)'), 'every provider request of the run was answered by the scripted double (' + providerCalls.length + ' requests)');
    check(events.filter((e) => /^blocked/.test(e.kind)).length === 0, 'the server attempted no request to any other host during the whole run');
    note('provider request modes: ' + JSON.stringify(providerCalls.reduce((m, e) => ({ ...m, [e.mode]: (m[e.mode] || 0) + 1 }), {})));
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('E17', 'Post-deployment smoke test (scripts/smoke-test.cjs) passes against the https staging-like stack', async () => {
    // asynchronous on purpose: the TLS proxy runs inside this process, so a blocking spawnSync would starve it and the smoke test would time out
    const r = await new Promise((resolve) => require('node:child_process').execFile(process.execPath, [path.join(ROOT, 'scripts/smoke-test.cjs'), '--api', stack.PROXY, '--origin', stack.FRONT, '--insecure-local'], { env: { ...process.env } }, (error, stdout, stderr) => resolve({ status: error ? error.code : 0, stdout, stderr })));
    check(r.status === 0 && /SMOKE TEST PASSED/.test(r.stdout), 'the smoke test exits 0 (' + (r.stdout.split(String.fromCharCode(10)).filter((l) => /FAIL/.test(l)).join(' | ') || 'no failing check') + ')');
    note((r.stdout + ' ' + r.stderr.split(String.fromCharCode(10)).filter((l) => /ERROR/.test(l)).join(' ')).trim().split(String.fromCharCode(10)).slice(0, 14).join(' || '));
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('E18', "Admin sets a subject's academic year, semester, year level and pre-requisite; faculty picks it, the values fill in and cannot be changed", async () => {
    const a = await L.session(browser, stack);
    await a.loginOk('admin');
    await a.nav('Program & Subjects');
    await a.page.getByRole('button', { name: /add subject/i }).first().click();
    await a.page.waitForTimeout(600);
    check((await a.page.getByRole('heading', { name: 'Academic years', level: 3 }).count()) === 0, 'the separate Academic years card is gone');
    // the catalog is per academic year: a subject's year is not chosen, it is the year of the catalog it is added to (the current year)
    const yearBox = () => a.page.locator('.ac-form').getByLabel('Academic year', { exact: true });
    check(await yearBox().inputValue() === '2026–2027' && !(await yearBox().isEditable()), 'the subject\'s academic year is a fixed line showing the current year, 2026–2027 (not a dropdown)');
    check((await a.page.locator('.ac-form').getByRole('combobox', { name: 'Academic year', exact: true }).count()) === 0, 'there is no academic year dropdown, so no year can be picked or invented inside the form');
    const add = a.page.getByRole('button', { name: /^add subject$/i }).last();
    check(await add.isDisabled(), 'Add subject stays disabled until the semester, year level and pre-requisite are chosen');
    await a.page.locator('.ac-form').getByRole('combobox', { name: 'Program', exact: true }).click(); await a.page.getByRole('option', { name: /^BSIT/ }).first().click();
    await a.page.getByPlaceholder('e.g. IT 204').fill('IT 306');
    await a.page.locator('.ac-form .field.full input').first().fill('Mobile Application Development (synthetic)');
    const pick = async (label, option) => { await a.page.locator('.ac-form').getByRole('combobox', { name: label, exact: true }).click(); await a.page.getByRole('option', { name: option }).first().click(); await a.page.waitForTimeout(300); };
    await pick('Semester', /2nd Semester/);
    const levels = await (async () => { await a.page.locator('.ac-form').getByRole('combobox', { name: 'Year level', exact: true }).click(); const names = await a.page.getByRole('option').allInnerTexts(); await a.page.keyboard.press('Escape'); return names.map((x) => x.trim()).filter((x) => /^Year [1-9]$/.test(x)); })();
    check(levels.join(',') === 'Year 1,Year 2,Year 3,Year 4', 'the year level dropdown offers Year 1 to Year 4 (' + levels.join(',') + ')');
    await pick('Year level', 'Year 3');
    await a.page.getByLabel('Pre-requisite', { exact: true }).fill('IT 204 - Computer Programming 2');
    check(!(await add.isDisabled()), 'Add subject is enabled once the three are filled');
    await add.click();
    await a.page.locator('table tbody tr[data-catalog-row^="subject-"]', { hasText: 'IT 306' }).first().waitFor({ timeout: 20000 });   // the add runs a few requests: wait for the row, not for a fixed time
    await a.page.waitForTimeout(500);
    const text = await a.text();
    check(/IT 306/.test(text) && /2026–2027 · 2nd Semester · Year 3/.test(text) && /IT 204 - Computer Programming 2/.test(text), 'the subjects table shows the new subject with its term (in the current year) and pre-requisite');
    await a.shot(evidence('E18-admin-subject-term-1440.png'));
    const counted = (await a.api('GET', '/academic-years')).body.find((y) => y.label === '2026–2027');
    check(counted && counted.programs >= 1 && counted.subjects >= 3, 'the administrator\'s academic year list counts the programs and subjects of the year (' + JSON.stringify(counted) + ')');
    // give the faculty member the subject (administrator API, as Users & Roles does)
    const users = await a.api('GET', '/users');
    const fac = (users.body.users || users.body).find((u) => u.email === 'e2e.faculty@e2e.invalid');
    const subjects = await a.api('GET', '/courses');
    const mine = subjects.body.filter((c) => ['IT 204', 'IT 205', 'IT 306'].includes(c.code)).map((c) => c.id);
    const progs = await a.api('GET', '/programs');
    const assigned = await a.api('PUT', '/users/' + (fac.id || fac.user_id) + '/assignments', { programs: progs.body.map((p) => p.id), courses: mine });
    check(assigned.status === 200, 'the subject was assigned to the faculty member (HTTP ' + assigned.status + ')');
    state.termCourseId = subjects.body.find((c) => c.code === 'IT 306').id;
    assertClean(a, 'E18-admin');
    await a.close();

    const f = await L.session(browser, stack);
    await f.loginOk('faculty');
    // open the editable IT 205 draft from E12 and switch its subject to the new one (the app asks to confirm a subject change)
    f.page.on('dialog', (dialog) => dialog.accept());
    await f.nav('My Syllabi');
    await f.page.getByText('IT 205', { exact: false }).first().locator('xpath=ancestor::*[.//button[contains(., "Edit")]][1]').getByRole('button', { name: /edit/i }).first().click();
    await f.page.waitForTimeout(2500);
    await f.pick(/IT 205/, /IT 306/);
    await f.page.waitForTimeout(1500);
    const field = (name) => f.page.getByLabel(name, { exact: true });
    check(await field('Pre-requisite').inputValue() === 'IT 204 - Computer Programming 2', 'choosing the subject filled the pre-requisite automatically');
    check(await field('Year level').inputValue() === '3', 'choosing the subject filled the year level automatically');
    check(await field('Academic year').inputValue() === '2026–2027' && /2nd Semester/.test(await field('Semester').inputValue()), "the syllabus's own academic year (the current one, 2026–2027) and the subject's semester are shown");
    check(await field('Pre-requisite').isEditable() === false && await field('Year level').isEditable() === false, 'the pre-requisite and year level cannot be edited by faculty');
    check(/cannot change it/.test(await f.text()), 'the page says the administrator set them');
    await f.shot(evidence('E18-faculty-locked-1440.png'));
    // the server enforces it too: a forged save is stored with the administrator's values
    const list = (await f.api('GET', '/syllabi')).body;
    const row = list.find((x) => x.courseCode === 'IT 306') || list[0];
    const id = row && row.id;
    await f.page.waitForTimeout(2500);
    const forged = await f.api('PUT', '/syllabi/' + id + '/content', { sections: { meta: { courseId: state.termCourseId, code: 'IT 306', title: 'x', program: 'BSIT', lecture: '2', lab: '1', prereq: 'Forged by faculty', yearLevel: '1', academicYear: '1999–2000', semester: '1st Semester' } }, schemaVersion: 3 });
    check(forged.status === 200, 'a forged save is accepted (HTTP ' + forged.status + ')');
    const meta = (await f.api('GET', '/syllabi/' + id + '/content')).body.content.meta;
    check(meta.prereq === 'IT 204 - Computer Programming 2' && String(meta.yearLevel) === '3' && meta.semester === '2nd Semester', "the server stored the administrator's values, not the forged ones (" + [meta.prereq, meta.yearLevel, meta.academicYear, meta.semester].join(' | ') + ')');
    assertClean(f, 'E18-faculty', { allowStatus: [409] });
    await f.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('E19', 'Subjects table filters: program, semester and year level combine, hide subjects without a term, and clear', async () => {
    const a = await L.session(browser, stack);
    await a.loginOk('admin');
    await a.nav('Program & Subjects');
    const rows = () => a.page.locator('table tbody tr[data-catalog-row^="subject-"]').count();
    const pick = async (label, option) => { await a.page.getByRole('combobox', { name: label, exact: true }).click(); await a.page.getByRole('option', { name: option }).first().click(); await a.page.waitForTimeout(400); };
    const total = await rows();
    check(total >= 3, 'the unfiltered table lists every subject (' + total + ')');
    check(/[0-9]+ subjects?/.test(await a.text()), 'the subject count is shown');
    check((await a.page.locator('.sm-toolbar').getByRole('combobox', { name: 'Academic year', exact: true }).count()) === 0 && (await a.page.locator('.year-bar').getByRole('combobox', { name: 'Academic year', exact: true }).count()) === 1, "there is no academic year filter in the table (the page shows one year's catalog, chosen with the control in the header)");
    check((await a.page.getByRole('combobox', { name: 'Semester', exact: true }).count()) === 1, 'there is exactly one Semester filter on the page (' + (await a.page.getByRole('combobox', { name: 'Semester', exact: true }).count()) + ')');
    await pick('Semester', /2nd Semester/);
    await pick('Year level', 'Year 3');
    check(await rows() === 1 && /IT 306/.test(await a.text()), 'semester + year level together find IT 306');
    await a.shot(evidence('E19-subject-filters-1440.png'));
    await pick('Semester', /1st Semester/);
    check(await rows() === 0 && /No subject matches these filters/.test(await a.text()), 'a different semester hides it and the table says nothing matches');
    await a.page.getByRole('button', { name: /clear filters/i }).click();
    await a.page.waitForTimeout(500);
    check(await rows() === total && !(await a.page.getByRole('button', { name: /clear filters/i }).count()), 'Clear filters brings every subject back');
    await pick('Year level', 'Year 1');
    check(await rows() === 0, 'subjects without a term (and those of other levels) are hidden by a term filter');
    await a.page.getByRole('button', { name: /clear filters/i }).click();
    await pick('Filter by program', /BSIE|BSIT/);
    check(await rows() >= 1, 'the program filter still works alongside the others');
    assertClean(a, 'E19');
    await a.close();
    const p = await L.session(browser, stack, { viewport: L.VIEWPORTS.phone });
    await p.loginOk('admin');
    await p.nav('Program & Subjects');
    const m = await p.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    check(m.sw <= m.cw + 1, 'at 375 px the filters wrap and the page has no horizontal overflow (scrollWidth ' + m.sw + ' <= ' + m.cw + ')');
    await p.shot(evidence('E19-subject-filters-375.png'));
    await p.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('E20', 'Academic year scope: a new current year starts empty, last year stays stored and filterable, faculty see only the previous and current year, the admin sees all and always sees the current one', async () => {
    const labelsOf = (res) => res.body.map((y) => y.label).join(',');
    const a = await L.session(browser, stack);
    await a.loginOk('admin');
    check((await a.page.locator('.year-chip').count()) === 0, 'the top bar no longer carries a separate current-year chip (the academic year dropdowns say which year is current)');
    check((await a.api('GET', '/academic-years')).body.filter((y) => y.isCurrent).map((y) => y.label).join() === '2026–2027', 'the current academic year is 2026–2027');
    // the administrator adds the neighbouring years (the + Add year field of the academic year control on Program & Subjects does the same through this call; 2028 is added there below)
    for (const startYear of [2025, 2027]) await a.api('POST', '/academic-years', { startYear });
    check(labelsOf(await a.api('GET', '/academic-years')) === '2025–2026,2026–2027,2027–2028', 'the administrator sees every academic year');
    const f1 = await L.session(browser, stack);
    await f1.loginOk('faculty');
    check(labelsOf(await f1.api('GET', '/academic-years')) === '2025–2026,2026–2027', 'a faculty member sees only the previous and the current year (2025–2026, 2026–2027)');
    check((await f1.api('GET', '/syllabi?year=' + encodeURIComponent('2027–2028'))).status === 403, 'a faculty member may not ask for a year that is not previous or current');
    const before = (await f1.api('GET', '/syllabi')).body;
    check(before.length >= 1 && before.every((s) => s.academicYear === '2026–2027'), 'in the current year the faculty member has syllabi, each stamped 2026–2027 (' + before.length + ')');
    await f1.close();

    // a closed year filter shows the year alone; the "current" tag appears only in the open list (the owner's decision: no text beside the year until the dropdown is clicked)
    const yearShown = async (session, scope) => (await session.page.locator(scope + ' .select-current').first().innerText()).trim();
    const openListTags = async (session, scope, option) => { await session.page.locator(scope + ' .select-trigger').first().click(); const found = await session.page.getByRole('option', { name: option }).count(); await session.page.keyboard.press('Escape'); await session.page.waitForTimeout(200); return found === 1; };
    // one academic year control on Program & Subjects: + Add year, the year dropdown and Make current (no separate Current academic year card)
    await a.nav('Program & Subjects');
    check(await yearShown(a, '.year-bar .year-filter') === '2026–2027' && (await a.page.locator('.year-bar .year-filter').count()) === 1 && (await a.page.locator('.current-year').count()) === 0, 'Program & Subjects has one academic year control and no Current academic year card; closed, it shows the year alone');
    check(await openListTags(a, '.year-bar .year-filter', /^2026–2027 · current$/), 'the open list tags 2026–2027 as current');
    check((await a.page.getByRole('button', { name: 'Make current', exact: true }).count()) === 0, 'Make current is not offered while the current year is shown');
    await a.page.getByRole('button', { name: '+ Add year', exact: true }).click();
    // a year that already exists is refused inside the popover (no banner in the header, the header row keeps its size)
    const headerBefore = await a.page.locator('.page-head').boundingBox();
    await a.page.getByLabel('First year (for example 2027)').fill('2027');
    await a.page.getByRole('button', { name: 'Add academic year', exact: true }).click();
    await a.page.waitForTimeout(1200);
    check(/already exists/.test(await a.page.locator('.ay-pop .form-error').innerText()), 'adding a year that exists is refused with the message inside the popover');
    const headerAfter = await a.page.locator('.page-head').boundingBox();
    check(Math.abs(headerAfter.height - headerBefore.height) < 2, 'the page header does not change height while the add-year popover is open (' + Math.round(headerBefore.height) + ' px before, ' + Math.round(headerAfter.height) + ' px after)');
    check((await a.page.locator('.page-head').getByRole('button', { name: /add subject/i }).boundingBox()).y < headerBefore.y + headerBefore.height, '+ Add subject stays in the header row');
    await a.shot(evidence('E20-admin-add-year-popover-1440.png'));
    await a.page.getByLabel('First year (for example 2027)').fill('2028');
    await a.page.getByRole('button', { name: 'Add academic year', exact: true }).click();
    await a.page.waitForTimeout(1500);
    check(labelsOf(await a.api('GET', '/academic-years')) === '2025–2026,2026–2027,2027–2028,2028–2029', '+ Add year added 2028–2029');
    // the administrator makes 2027–2028 current: pick the year in the header dropdown, Make current, confirm
    await a.page.locator('.year-bar .year-filter .select-trigger').first().click();
    await a.page.getByRole('option', { name: /^2027–2028$/ }).click();
    await a.page.waitForTimeout(1200);
    await a.page.getByRole('button', { name: 'Make current', exact: true }).click();
    const dialog = a.page.getByRole('alertdialog');
    await dialog.waitFor();
    check(/Make 2027–2028 the current academic year/.test(await dialog.innerText()) && /No syllabus or catalog is changed/.test(await dialog.innerText()), 'the change is explained and confirmed first');
    await a.shot(evidence('E20-admin-change-current-year-1440.png'));
    await dialog.getByRole('button').last().click(); // Make current (Cancel is first)
    await a.page.waitForTimeout(2000);
    check(await yearShown(a, '.year-bar .year-filter') === '2027–2028' && await openListTags(a, '.year-bar .year-filter', /^2027–2028 · current$/), 'the academic year dropdown now shows 2027–2028, and its open list tags it as current');
    check((await a.page.getByRole('button', { name: 'Make current', exact: true }).count()) === 0, 'Make current is gone once the current year is shown');
    const adminYears = await a.api('GET', '/academic-years');
    check(adminYears.body.filter((y) => y.isCurrent).map((y) => y.label).join() === '2027–2028', 'exactly one year is current');

    // a faculty member now starts at zero in the new year, and 2026–2027 is the previous year
    const f2 = await L.session(browser, stack);
    await f2.loginOk('faculty');
    check(labelsOf(await f2.api('GET', '/academic-years')) === '2026–2027,2027–2028', 'the faculty member now sees 2026–2027 (previous) and 2027–2028 (current), no longer 2025–2026');
    check((await f2.api('GET', '/syllabi')).body.length === 0, 'the new academic year starts with no syllabi for the faculty member');
    const old = await f2.api('GET', '/syllabi?year=' + encodeURIComponent('2026–2027'));
    check(old.status === 200 && old.body.length === before.length && old.body.every((s) => s.academicYear === '2026–2027'), 'last year\'s syllabi are still stored and found by choosing 2026–2027');
    check((await f2.api('GET', '/syllabi?year=' + encodeURIComponent('2025–2026'))).status === 403, 'the year before the previous one is closed to the faculty member');
    check((await f2.api('GET', '/compliance?syllabus=all')).body.syllabi.length === 0, 'the compliance list (AI Checker, Dashboard, Analytics) also starts empty');
    check((await f2.api('GET', '/compliance?syllabus=all&year=' + encodeURIComponent('2026–2027'))).body.syllabi.length >= 1, 'and still has last year\'s checks under 2026–2027');
    await f2.nav('My Syllabi');
    check(/No syllabi yet/.test(await f2.text()), 'My Syllabi is empty in the new year');
    // the closed year filter shows the year alone, not cut off by the width of the control; the open list says which year is current
    const closedFilter = f2.page.locator('.year-filter .select-current').first();
    const closedText = await closedFilter.innerText();
    const closedBox = await closedFilter.evaluate((el) => ({ clipped: el.scrollWidth > el.clientWidth, scroll: el.scrollWidth, client: el.clientWidth, trigger: el.closest('.select-trigger').getBoundingClientRect().width }));
    check(closedText.trim() === '2027–2028' && !closedBox.clipped, 'the closed year filter shows the year alone and is not clipped ("' + closedText + '", ' + JSON.stringify(closedBox) + ')');
    check(await openListTags(f2, '.year-filter', /^2027–2028 · current$/), 'the open list tags the current year for faculty');
    await f2.page.locator('.year-filter .select-trigger').first().click();
    await f2.page.getByRole('option', { name: /^2026–2027$/ }).click();
    await f2.page.waitForTimeout(1500);
    check(/IT 204/.test(await f2.text()), 'choosing 2026–2027 in the year filter brings last year\'s syllabus back');
    await f2.shot(evidence('E20-faculty-previous-year-1440.png'));
    // the one-syllabus-per-subject rule is per academic year: the same subject can be done again in the new year
    const draft = await f2.api('POST', '/syllabi/drafts');
    const sameSubject = await f2.api('PUT', '/syllabi/' + draft.body.id + '/content', { sections: { meta: { courseId: 10, code: 'IT 204', title: 'x', program: 'BSIT', lecture: '2', lab: '1', prereq: 'None', yearLevel: '2' } }, schemaVersion: 3 });
    check(draft.status === 200 && sameSubject.status === 200, 'the faculty member can start a new syllabus on IT 204 in 2027–2028 (HTTP ' + sameSubject.status + ' ' + JSON.stringify(sameSubject.body).slice(0, 120) + ')');
    const created = (await f2.api('GET', '/syllabi')).body.find((s) => s.id === draft.body.id);
    check(created && created.academicYear === '2027–2028', 'the new syllabus is stamped with the current year');
    check((await f2.api('GET', '/syllabi/' + draft.body.id + '/content')).body.academicYear === '2027–2028', 'Step 1 can read the syllabus year');
    await f2.close();

    // the administrator still sees every year; a reviewer's work queue keeps last year's work in view
    check((await a.api('GET', '/syllabi?year=' + encodeURIComponent('2025–2026'))).status === 200, 'the administrator may open any year');
    const v = await L.session(browser, stack);
    await v.loginOk('vpaa');
    check((await v.api('GET', '/syllabi')).body.every((s) => s.academicYear === '2027–2028'), 'the VPAA, like everyone but the administrator, starts on the current year');
    check((await v.api('GET', '/syllabi?year=all')).body.some((s) => s.academicYear === '2026–2027'), 'the work queues ask for all visible years, so last year\'s submissions are still there');
    check((await v.api('GET', '/syllabi?year=' + encodeURIComponent('2025–2026'))).status === 403, 'the VPAA may not open a year older than the previous one');
    await v.nav('Review & Approval');
    check(await yearShown(v, '.year-filter') === 'Previous and current year' && await openListTags(v, '.year-filter', /^Previous and current year · current: 2027–2028$/), 'Review & Approval defaults to the previous and current year, and its open list names the current one');
    assertClean(v, 'E20-vpaa', { allowStatus: [403] });
    await v.close();
    assertClean(a, 'E20-admin', { allowStatus: [403, 409] });   // 409: the duplicate year the popover test adds on purpose
    await a.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  // E20 left 2027–2028 as the current year. Its catalog (programs and subjects) must be EMPTY, even for the administrator, until the administrator builds it
  // or asks for "Copy from last year"; the earlier year's catalog is then view only.
  await scenario('E21', "A new academic year's catalog starts empty even for the administrator; Copy from last year fills it on request; the earlier year is view only; a program code can be created again in another year", async () => {
    const enc = encodeURIComponent;
    const LAST = '2026–2027', NEW = '2027–2028', NEXT = '2028–2029';
    const a = await L.session(browser, stack);
    await a.loginOk('admin');
    const years = (await a.api('GET', '/academic-years')).body;
    check(years.filter((y) => y.isCurrent).map((y) => y.label).join() === NEW, 'the current academic year is ' + NEW);
    const lastPrograms = (await a.api('GET', '/programs?year=' + enc(LAST))).body;
    const lastSubjects = (await a.api('GET', '/courses?year=' + enc(LAST))).body;
    check(lastPrograms.length >= 1 && lastSubjects.length >= 3, LAST + ' still has its catalog (' + lastPrograms.length + ' programs, ' + lastSubjects.length + ' subjects)');
    check(years.find((y) => y.label === LAST).programs === lastPrograms.length && years.find((y) => y.label === NEW).programs === 0, 'the administrator\'s year list counts ' + LAST + ' and shows ' + NEW + ' with no programs');

    // 1. the new year starts with no programs and no subjects, for the administrator too
    check((await a.api('GET', '/programs')).body.length === 0 && (await a.api('GET', '/courses')).body.length === 0, NEW + ' starts with no programs and no subjects, even for the administrator');
    await a.nav('Program & Subjects');
    await a.page.waitForTimeout(1200);
    const rows = () => a.page.locator('table tbody tr[data-catalog-row^="subject-"]').count();
    check(await rows() === 0 && /No programs or subjects yet for 2027–2028/.test(await a.text()), 'Program & Subjects lists nothing and says so for ' + NEW);
    check(await a.page.getByRole('button', { name: 'Copy from ' + LAST, exact: true }).count() === 1, 'the optional "Copy from ' + LAST + '" button is offered');
    await a.shot(evidence('E21-admin-empty-new-year-1440.png'));
    await a.nav('Dashboard');
    await a.page.waitForTimeout(1500);
    const dash = await a.text();
    check(/Programs\s+0\s+In the catalog/.test(dash) && /Subjects\s+0\s+Across all programs/.test(dash), 'the Dashboard cards read 0 programs and 0 subjects');

    // 2. Copy from last year: confirmed first, then new records in the new year; nothing about syllabi, assignments or deadlines
    await a.nav('Program & Subjects');
    await a.page.getByRole('button', { name: 'Copy from ' + LAST, exact: true }).click();
    const dialog = a.page.getByRole('alertdialog');
    await dialog.waitFor();
    check(/Copy the 2026–2027 catalog into 2027–2028/.test(await dialog.innerText()) && /syllabi are not copied/.test(await dialog.innerText()), 'the copy is explained and confirmed first');
    await dialog.getByRole('button').last().click(); // Copy catalog (Cancel is first)
    for (let i = 0; i < 40 && !(await a.api('GET', '/programs')).body.length; i += 1) await a.page.waitForTimeout(500);   // the copy runs in one transaction: wait for it, not for a fixed time
    await a.page.waitForTimeout(1000);
    const progs = (await a.api('GET', '/programs')).body, subs = (await a.api('GET', '/courses')).body;
    check(progs.length === lastPrograms.length && subs.length === lastSubjects.length, NEW + ' now has the same number of programs and subjects as ' + LAST + ' (' + progs.length + ', ' + subs.length + ')');
    check(progs.every((p) => !lastPrograms.some((q) => q.id === p.id)) && subs.every((c) => !lastSubjects.some((d) => d.id === c.id)), 'they are new records, not the old ones');
    check(await a.page.getByRole('button', { name: 'Copy from ' + LAST, exact: true }).count() === 0 && await rows() === subs.length, 'the button is gone and the table lists the copied subjects');
    check((await a.api('POST', '/academic-years/copy-catalog', {})).status === 409, 'copying again is refused: only an empty academic year can be filled');
    const old204 = lastSubjects.find((c) => c.code === 'IT 204'), new204 = subs.find((c) => c.code === 'IT 204');
    const [o204, n204] = [(await a.api('GET', '/courses/' + old204.id)).body, (await a.api('GET', '/courses/' + new204.id)).body];
    check(o204.clos.length === n204.clos.length && o204.term.semester === n204.term.semester && o204.term.yearLevel === n204.term.yearLevel && n204.term.academicYear === NEW && o204.program.id !== n204.program.id, 'the copy keeps the CLOs and term of IT 204, belongs to the new year, and to its own copy of the program');
    await a.shot(evidence('E21-admin-copied-catalog-1440.png'));

    // 3. editing the copy never changes last year; last year's catalog is view only (also on the server)
    const renamed = await a.api('PUT', '/courses/' + new204.id, { code: new204.code, title: 'Renamed in the new year (synthetic)' });
    check(renamed.status === 200 && (await a.api('GET', '/courses/' + old204.id)).body.title === old204.title, 'a subject renamed in ' + NEW + ' keeps its old title in ' + LAST);
    const refused = await a.api('PUT', '/courses/' + old204.id, { code: old204.code, title: 'Changed after the year ended' });
    check(refused.status === 403 && /view only/.test(JSON.stringify(refused.body)), 'changing a subject of ' + LAST + ' is refused by the server (HTTP ' + refused.status + ')');
    check((await a.api('DELETE', '/courses/' + old204.id)).status === 403, 'deleting a subject of ' + LAST + ' is refused too');
    check((await a.api('PUT', '/programs/' + lastPrograms[0].id + '/outcomes', { pos: [], version: 1 })).status === 403, 'so is changing a program\'s outcomes of ' + LAST);
    await a.nav('Program & Subjects');
    await a.page.locator('.year-filter .select-trigger').first().click();
    await a.page.getByRole('option', { name: new RegExp('^' + LAST + '$') }).click();
    await a.page.waitForTimeout(1500);
    check(/past academic year/.test(await a.text()) && await rows() === lastSubjects.length, 'choosing ' + LAST + ' shows its catalog with a "past academic year" notice');
    check(await a.page.getByRole('button', { name: /add subject/i }).first().isDisabled(), 'Add subject is disabled for the past year');
    await a.shot(evidence('E21-admin-past-year-view-only-1440.png'));

    // 4. another new year: empty again, and the same program code can be created there (code is unique within a year, not across years)
    await a.api('POST', '/academic-years', { startYear: 2028 });
    check((await a.api('PUT', '/academic-years/current', { label: NEXT })).status === 200, NEXT + ' is made current');
    check((await a.api('GET', '/programs')).body.length === 0 && (await a.api('GET', '/courses')).body.length === 0, NEXT + ' starts empty as well');
    const fresh = await a.api('POST', '/courses', { code: 'IT 900', title: 'Fresh start (synthetic)', program: 'BSIT', programName: 'Bachelor of Science in Information Technology' });
    check(fresh.status === 200 || fresh.status === 201, 'BSIT can be created again in ' + NEXT + ', although BSIT exists in the earlier years (HTTP ' + fresh.status + ' ' + JSON.stringify(fresh.body).slice(0, 120) + ')');
    const nextPrograms = (await a.api('GET', '/programs')).body;
    const bsitIds = [lastPrograms.find((p) => p.code === 'BSIT'), progs.find((p) => p.code === 'BSIT'), nextPrograms.find((p) => p.code === 'BSIT')].map((p) => p && p.id);
    check(nextPrograms.length === 1 && new Set(bsitIds).size === 3 && bsitIds.every(Boolean), 'each year has its own BSIT record (' + bsitIds.join(', ') + ') and ' + NEXT + ' has only the new one');
    check((await a.api('GET', '/courses?year=' + enc(LAST))).body.length === lastSubjects.length, LAST + ' is unchanged by all of this');
    assertClean(a, 'E21', { allowStatus: [403, 409] });
    await a.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  // E21 left 2028–2029 current with a BSIT created together with its first subject: a new program has NO EGAs and NO Program Outcomes until the administrator sets them.
  await scenario('E22', 'A new program is flagged until the administrator sets its EGAs and Program Outcomes in the app; a past year is read-only; the school vision and mission are saved from the Add subject form, which replaced the separate card', async () => {
    const enc = encodeURIComponent;
    const CUR = '2028–2029', PREV = '2027–2028';
    const a = await L.session(browser, stack);
    await a.loginOk('admin');
    const bsit = (await a.api('GET', '/programs')).body.find((p) => p.code === 'BSIT');
    check(bsit && bsit.egaCount === 0 && bsit.outcomeCount === 0, 'the program created in ' + CUR + ' has no EGAs and no outcomes (' + JSON.stringify(bsit) + ')');
    await a.nav('Program & Subjects');
    await a.page.waitForTimeout(1500);
    const text = await a.text();
    check(/Set up EGAs and POs/.test(text) && /still have no EGAs or Program Outcomes: BSIT/.test(text), 'the program shows a "Set up EGAs and POs" badge and the page lists it in a banner');
    await a.shot(evidence('E22-admin-needs-setup-1440.png'));

    // 1. the Outcomes dialog: EGAs first, then an outcome mapped to a saved EGA
    await a.page.getByRole('button', { name: 'EGAs and Program Outcomes of BSIT', exact: true }).click();
    const dlg = a.page.getByRole('dialog', { name: /EGAs and Program Outcomes of BSIT/ });
    await dlg.waitFor();
    await a.page.waitForTimeout(800);
    check(await dlg.getByRole('button', { name: 'Add outcome', exact: true }).isDisabled(), 'an outcome cannot be added before an EGA is saved');
    await dlg.getByRole('button', { name: 'Add EGA', exact: true }).click();
    await dlg.getByLabel('Name, EGA 1', { exact: true }).fill('Critical and creative thinking (synthetic)');
    await dlg.getByLabel('Short name, EGA 1', { exact: true }).fill('Critical thinking');
    await dlg.getByRole('button', { name: 'Save EGAs', exact: true }).click();
    await a.page.waitForTimeout(1500);
    const afterEga = (await a.api('GET', '/programs/' + bsit.id + '/outcomes')).body;
    check(afterEga.egas.length === 1 && afterEga.egas[0].no === 1 && afterEga.pos.length === 0, 'the EGA is saved for this program only (' + afterEga.egas.length + ' EGA, ' + afterEga.pos.length + ' outcomes)');
    check(/Set up EGAs and POs/.test(await a.page.locator('.program-management').innerText()), 'with an EGA but no outcome the program still needs setup');
    await dlg.getByRole('button', { name: 'Add outcome', exact: true }).click();
    await dlg.getByLabel('Short name, PO 1', { exact: true }).fill('PO1');
    await dlg.getByLabel('Statement, PO 1', { exact: true }).fill('Apply knowledge of computing to solve problems (synthetic)');
    await dlg.locator('.outcomes-maps input[type=checkbox]').first().check();
    await a.shot(evidence('E22-admin-outcomes-editor-1440.png'));
    await dlg.getByRole('button', { name: 'Save outcomes', exact: true }).click();
    await a.page.waitForTimeout(1500);
    const afterPo = (await a.api('GET', '/programs/' + bsit.id + '/outcomes')).body;
    check(afterPo.pos.length === 1 && afterPo.pos[0].egas.join() === '1', 'the outcome is saved and mapped to EGA 1');
    await dlg.getByRole('button', { name: 'Close', exact: true }).click();
    await a.page.waitForTimeout(800);
    check(!/Set up EGAs and POs/.test(await a.text()) && !/still have no EGAs or Program Outcomes/.test(await a.text()), 'the badge and the banner are gone once the program has both');
    const listed = (await a.api('GET', '/programs')).body.find((p) => p.id === bsit.id);
    check(listed.egaCount === 1 && listed.outcomeCount === 1, 'the program list now counts 1 EGA and 1 outcome');
    check((await a.api('PUT', '/programs/' + bsit.id + '/egas', { egas: [{ no: 1, name: 'x', short: 'x' }], version: 1 })).status === 409, 'a save from an out-of-date screen is refused (409)');

    // 2. the previous year's program is read-only, in the dialog and on the server
    const prevBsit = (await a.api('GET', '/programs?year=' + enc(PREV))).body.find((p) => p.code === 'BSIT');
    await a.page.locator('.year-filter .select-trigger').first().click();
    await a.page.getByRole('option', { name: new RegExp('^' + PREV + '$') }).click();
    await a.page.waitForTimeout(1500);
    await a.page.getByRole('button', { name: 'EGAs and Program Outcomes of BSIT', exact: true }).click();
    const past = a.page.getByRole('dialog', { name: /EGAs and Program Outcomes of BSIT/ });
    await past.waitFor();
    await a.page.waitForTimeout(800);
    check(/past academic year/.test(await past.innerText()) && await past.getByRole('button', { name: 'Save EGAs', exact: true }).count() === 0, PREV + ' shows its EGAs and outcomes read-only (no Save)');
    await a.shot(evidence('E22-admin-past-year-outcomes-1440.png'));
    await past.getByRole('button', { name: 'Close', exact: true }).click();
    await a.page.waitForTimeout(500);
    check((await a.api('PUT', '/programs/' + prevBsit.id + '/outcomes', { pos: [], version: 1 })).status === 403, 'the server refuses to change the outcomes of ' + PREV);

    // 3. the school vision and mission live in the Add program form (no separate card): they can be saved on their own, before any program or subject is typed
    await a.page.locator('.year-filter .select-trigger').first().click();
    await a.page.getByRole('option', { name: new RegExp('^' + CUR) }).click();
    await a.page.waitForTimeout(1200);
    check((await a.page.locator('.institution-card').count()) === 0 && (await a.page.getByRole('heading', { name: 'School vision and mission' }).count()) === 0, 'there is no separate School vision and mission card on the page');
    const subjectsBefore = (await a.api('GET', '/courses')).body.length;
    await a.page.getByRole('button', { name: /add program/i }).first().click();
    const setup = a.page.locator('.subject-setup');
    await setup.waitFor();
    // no interaction is needed: with the program code still empty, the school's saved vision and mission arrive in the form by themselves
    await setup.locator('.institution-form').waitFor({ timeout: 5000 });
    const schoolSaved = (await a.api('GET', '/institution/outcomes')).body;
    const vmFields = setup.locator('.institution-form textarea');
    check(await a.page.getByPlaceholder('e.g. BSIT').inputValue() === '' && await vmFields.nth(0).inputValue() === schoolSaved.vision && await vmFields.nth(1).inputValue() === schoolSaved.mission.lead, 'the Add program form shows the saved school vision and mission as soon as it opens, before any program code is typed');
    await setup.locator('.institution-form textarea').first().fill('A synthetic vision statement for the end-to-end test.');
    await setup.getByRole('button', { name: 'Save vision and mission', exact: true }).click();
    await a.page.waitForTimeout(1500);
    const school = (await a.api('GET', '/institution/outcomes')).body;
    check(school.vision === 'A synthetic vision statement for the end-to-end test.' && school.egas.length >= 1, 'Save vision and mission saves it on its own and keeps the school EGA list (' + school.egas.length + ' EGAs)');
    check((await a.api('GET', '/courses')).body.length === subjectsBefore, 'no subject was created by saving it');
    check(await setup.getByRole('button', { name: 'Save vision and mission', exact: true }).isDisabled(), 'the Save button is disabled again once there is nothing new to save');
    await a.page.getByRole('button', { name: /^cancel$/i }).last().click();
    await a.page.waitForTimeout(600);
    assertClean(a, 'E22', { allowStatus: [403, 409] });
    await a.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  // The administrator sets up a NEW program (EGAs, Program Outcomes, vision) inside the Add subject form; the faculty builder shows exactly that for the program and subject.
  await scenario('E23', 'Add subject with a new program: the administrator types its EGAs, Program Outcomes and the school vision; faculty get them for that program and subject; a later change reaches existing subjects only through Apply to subjects', async () => {
    const VISION = 'Vision typed while adding EE 101 (synthetic).';
    const a = await L.session(browser, stack);
    await a.loginOk('admin');
    await a.nav('Program & Subjects');
    await a.page.getByRole('button', { name: /add program/i }).first().click();
    await a.page.waitForTimeout(600);
    await a.page.getByPlaceholder('e.g. BSIT').fill('BSEE');
    await a.page.getByPlaceholder('e.g. BS Information Technology').fill('BS Electrical Engineering (synthetic)');
    const setup = a.page.locator('.subject-setup');
    await setup.waitFor();
    check((await setup.getByRole('button', { name: 'Add EGA', exact: true }).count()) === 1, 'the Add program form shows the EGA and Program Outcome part');
    await setup.getByRole('button', { name: 'Add EGA', exact: true }).click();
    await setup.getByLabel('Name, EGA 1', { exact: true }).fill('Engineering practice (synthetic)');
    await setup.getByLabel('Short name, EGA 1', { exact: true }).fill('Practice');
    await setup.getByRole('button', { name: 'Add outcome', exact: true }).click();
    await setup.getByLabel('Short name, PO 1', { exact: true }).fill('PO1');
    await setup.getByLabel('Statement, PO 1', { exact: true }).fill('Apply engineering knowledge to analyse circuits (synthetic).');
    await setup.locator('.outcomes-maps input[type=checkbox]').first().check();
    await setup.locator('.institution-form textarea').first().fill(VISION);
    await a.shot(evidence('E23-admin-add-program-outcomes-1440.png'));
    await a.page.getByRole('button', { name: /^add program$/i }).last().click();
    await a.page.waitForTimeout(2500);
    const bsee = (await a.api('GET', '/programs')).body.find((p) => p.code === 'BSEE');
    check(bsee && bsee.egaCount === 1 && bsee.outcomeCount === 1, 'the program was created with its EGA and its Program Outcome (' + JSON.stringify(bsee) + ')');
    // then its subject: Add subject only picks the program from the list
    await a.page.getByRole('button', { name: /add subject/i }).first().click();
    await a.page.waitForTimeout(600);
    await a.page.getByPlaceholder('e.g. IT 204').fill('EE 101');
    await a.page.locator('.ac-form .field.full input').first().fill('Circuits (synthetic)');
    const pick = async (label, option) => { await a.page.locator('.ac-form').getByRole('combobox', { name: label, exact: true }).click(); await a.page.getByRole('option', { name: option }).first().click(); await a.page.waitForTimeout(300); };
    await pick('Program', /BSEE/);
    await pick('Semester', /1st Semester/); await pick('Year level', 'Year 1');
    await a.page.getByLabel('Pre-requisite', { exact: true }).fill('None');
    await a.page.getByRole('button', { name: /^add subject$/i }).last().click();
    await a.page.waitForTimeout(2500);
    const subject = (await a.api('GET', '/courses')).body.find((c) => c.code === 'EE 101');
    check(!!subject && !(subject.gaps || []).some((g) => /graduate attributes|program outcomes|vision/.test(g)), 'the subject list no longer reports the EGAs, POs or vision as missing (' + JSON.stringify(subject && subject.gaps) + ')');
    const masters = (await a.api('GET', '/programs/' + bsee.id + '/outcomes')).body, school = (await a.api('GET', '/institution/outcomes')).body;
    check(school.vision === VISION, 'the school vision typed in the form was saved');

    // the faculty builder reads the subject: it equals the masters the AI Checker compares with
    const users = (await a.api('GET', '/users')).body; const fac = (users.users || users).find((u) => u.email === 'e2e.faculty@e2e.invalid');
    const assigned = await a.api('PUT', '/users/' + (fac.id || fac.user_id) + '/assignments', { programs: [bsee.id], courses: [subject.id] });
    check(assigned.status === 200, 'the subject was assigned to the faculty member (HTTP ' + assigned.status + ')');
    const f = await L.session(browser, stack);
    await f.loginOk('faculty');
    const seen = (await f.api('GET', '/courses/' + subject.id)).body.standards;
    check(JSON.stringify(seen.egas) === JSON.stringify(masters.egas) && JSON.stringify(seen.pos) === JSON.stringify(masters.pos) && seen.vision === VISION, 'what faculty get for this program and subject is exactly the program EGAs and POs and the school vision');
    const draft = await f.api('POST', '/syllabi/drafts');
    const saved = await f.api('PUT', '/syllabi/' + draft.body.id + '/content', { sections: { meta: { courseId: subject.id, code: 'EE 101', title: 'x', program: 'BSEE', lecture: '2', lab: '1', prereq: 'None', yearLevel: '1' } }, schemaVersion: 3 });
    check(draft.status === 200 && saved.status === 200, 'the faculty member started a syllabus on it (HTTP ' + saved.status + ')');
    await f.nav('My Syllabi');
    await f.page.getByText('EE 101', { exact: false }).first().locator('xpath=ancestor::*[.//button[contains(., "Edit")]][1]').getByRole('button', { name: /edit/i }).first().click();
    await f.page.waitForTimeout(2500);
    // Step 2 opens once Step 1 is complete: the curriculum year and a course description (the subject supplies program, code, title and the administrator's term)
    await f.page.locator('[placeholder="For example, 2022-2023"],[aria-label="For example, 2022-2023"]').first().fill('test-2026');
    if (!(await f.page.getByPlaceholder('Describe the course in a few sentences').count())) await f.page.getByRole('button', { name: /add paragraph/i }).click();
    await f.page.getByPlaceholder('Describe the course in a few sentences').first().fill('A synthetic description for the end-to-end test of a new program.');
    await f.page.waitForTimeout(1200);
    // Step 1: the program, the year and the term are the administrator's, shown read-only with the right values
    const yearNow = (await a.api('GET', '/academic-years')).body.find((y) => y.isCurrent).label;
    const byLabel = (label) => f.page.getByLabel(label, { exact: true });
    check(await byLabel('Academic year').inputValue() === yearNow && !(await byLabel('Academic year').isEditable()), 'Step 1 shows the syllabus academic year (' + yearNow + ') read-only');
    check(await byLabel('Year level').inputValue() === '1' && await byLabel('Pre-requisite').inputValue() === 'None' && /1st Semester/.test(await byLabel('Semester').inputValue()), "Step 1 shows the administrator's year level, pre-requisite and semester");
    check(!(await byLabel('Year level').isEditable()) && !(await byLabel('Pre-requisite').isEditable()) && !(await byLabel('Semester').isEditable()), 'faculty cannot edit the year level, pre-requisite or semester');
    check(/BSEE/.test(await f.page.getByRole('combobox', { name: /program/i }).first().innerText()), 'Step 1 is on the BSEE program');
    await f.page.getByRole('button', { name: /2 learning outcomes/i }).click();
    await f.page.waitForTimeout(1500);
    // Step 2: faculty read the program's EGAs and Program Outcomes; they cannot type them
    const refs = await f.page.locator('.learning-outcomes-editor .refi').evaluateAll((nodes) => nodes.map((n) => ({ cd: n.querySelector('.cd').textContent.trim(), rt: n.querySelector('.rt').textContent.trim() })));
    check(refs.some((r) => /^EGA/.test(r.cd) && r.rt === 'Engineering practice (synthetic)'), 'Step 2 shows the EGA statement the administrator typed (' + JSON.stringify(refs) + ')');
    check(refs.some((r) => r.cd === 'PO 1' && r.rt.startsWith('Apply engineering knowledge to analyse circuits (synthetic).')), 'Step 2 shows the Program Outcome statement');
    check(refs.filter((r) => /^PO/.test(r.cd)).length === 1 && refs.filter((r) => /^EGA/.test(r.cd)).length === 1, "Step 2 shows only BSEE's outcomes (1 EGA, 1 PO), not another program's");
    check(await f.page.locator('.learning-outcomes-editor .sm-pair input, .learning-outcomes-editor .sm-pair textarea, .learning-outcomes-editor .vm input, .learning-outcomes-editor .vm textarea, .learning-outcomes-editor .ie-po').count() === 0, 'the vision, mission, EGAs and POs have no editable field for faculty');
    // the server holds the same line: a forged save keeps the administrator's values, and the administrator's routes refuse faculty
    const before23 = (await f.api('GET', '/syllabi/' + draft.body.id + '/content')).body;
    const forgedOutcomes = { ...before23.content.outcomes, vision: 'Forged vision', egas: [{ no: 1, name: 'Forged EGA', short: 'Forged' }], pos: [{ no: 1, short: 'Forged', text: 'Forged outcome', egas: [1] }] };
    const forged23 = await f.api('PUT', '/syllabi/' + draft.body.id + '/content', { sections: { outcomes: forgedOutcomes }, schemaVersion: 3 });
    const after23 = (await f.api('GET', '/syllabi/' + draft.body.id + '/content')).body.content.outcomes;
    check(!/Forged/.test(JSON.stringify(after23)) && after23.pos[0].text.startsWith('Apply engineering knowledge') && after23.vision === VISION, "a forged save (HTTP " + forged23.status + ") keeps the administrator's vision, EGAs and POs");
    const refused23 = await Promise.all([f.api('PUT', '/programs/' + bsee.id + '/outcomes', { pos: [], version: 1 }), f.api('PUT', '/programs/' + bsee.id + '/egas', { egas: [], version: 1 }), f.api('PUT', '/courses/' + subject.id + '/standards', {})]);
    check(refused23.every((r) => r.status === 403), "faculty are refused the administrator's outcome routes (" + refused23.map((r) => r.status).join(',') + ')');
    check((await f.page.locator('textarea').evaluateAll((els, v) => els.some((e) => e.value === v), VISION)) || (await f.text()).includes(VISION), 'and the vision');
    await f.shot(evidence('E23-faculty-step2-1440.png'));

    // a later change to the program does not reach existing subjects by itself: Apply to subjects does
    await a.nav('Program & Subjects');
    await a.page.getByRole('button', { name: 'EGAs and Program Outcomes of BSEE', exact: true }).click();
    const dlg = a.page.getByRole('dialog', { name: /EGAs and Program Outcomes of BSEE/ });
    await dlg.waitFor(); await a.page.waitForTimeout(800);
    // the reference versions sit in this dialog: what the Admin saved when adding the program is already version 1, with no approval, document or publication step
    const panel = dlg.locator('.po-reference');
    await panel.waitFor();
    const refV1 = (await a.api('GET', '/programs/' + bsee.id + '/po-reference')).body;
    check(!!refV1.active && /-v1$/.test(refV1.active.version) && refV1.active.appliesTo[0].academicYear === yearNow && new RegExp(refV1.active.version).test(await panel.innerText()), 'the new program has version 1 in force for ' + yearNow + ', and the panel shows it');
    check(!/approv|VPAA|publish/i.test(await panel.innerText()) && (await panel.locator('input, textarea').count()) === 0, 'the panel asks for no approval or document, and a saved version has no edit control');
    await dlg.getByLabel('Statement, PO 1', { exact: true }).fill('Apply engineering knowledge to analyse and design circuits (synthetic, revised).');
    await dlg.getByRole('button', { name: 'Save outcomes', exact: true }).click();
    await a.page.waitForTimeout(1500);
    check((await f.api('GET', '/courses/' + subject.id)).body.standards.pos[0].text.includes('analyse circuits'), 'the existing subject keeps its own copy after the program is edited');
    const refV2 = (await a.api('GET', '/programs/' + bsee.id + '/po-reference')).body;
    check(/-v2$/.test(refV2.active.version) && refV2.history.length === 2 && refV2.history.some((h) => h.status === 'superseded' && h.id === refV1.active.id), 'Save outcomes put version 2 in force and kept version 1');
    check(refV2.changes[0].next.id === refV2.active.id && refV2.changes[0].previous.id === refV1.active.id && /Test Administrator/.test(refV2.changes[0].by), 'the change log says who saved it, the previous version and the new one');
    await panel.getByText(refV2.active.version).first().waitFor();
    check(/Program Outcomes saved/.test(await panel.innerText()), 'the panel shows the new version and the change log without reopening the dialog');
    await dlg.getByRole('button', { name: /^Apply to 1 subjects?$/ }).click();
    await a.page.waitForTimeout(1500);
    check((await f.api('GET', '/courses/' + subject.id)).body.standards.pos[0].text.includes('revised'), 'Apply to subjects gives the existing subject the revised outcome');
    await a.shot(evidence('E23-admin-apply-to-subjects-1440.png'));
    await dlg.getByRole('button', { name: 'Close', exact: true }).click();
    assertClean(a, 'E23-admin', { allowStatus: [403, 409] });
    assertClean(f, 'E23-faculty', { allowStatus: [403, 409] });
    await f.close();
    await a.close();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  // A closed year filter shows the year alone on every screen that has one, and only its open list says which year is current (the owner's decision): read what each page really shows.
  await scenario('E24', 'Every closed academic-year filter shows the year alone and its open list tags the current year, for the administrator and for faculty', async () => {
    const CUR = '2028–2029';
    for (const who of ['admin', 'faculty']) {
      const s = await L.session(browser, stack);
      await s.loginOk(who);
      for (const page of ['Dashboard', 'My Syllabi', 'Repository', 'Compliance', 'Analytics', 'Reports']) {
        try { await s.nav(page); } catch { continue; }   // a role without this screen has nothing to check
        await s.page.waitForTimeout(1200);
        const trigger = s.page.locator('.page-head .year-filter .select-current');
        if (!(await trigger.count())) { note(who + ' ' + page + ': no year filter on this screen'); continue; }
        const shown = (await trigger.first().innerText()).trim();
        const clipped = await trigger.first().evaluate((el) => el.scrollWidth > el.clientWidth);
        check(shown === CUR && !clipped, who + ' ' + page + ': the closed filter reads only the year ("' + shown + '"' + (clipped ? ', CLIPPED' : '') + ')');
        await s.page.locator('.page-head .year-filter .select-trigger').first().click();
        const tagged = await s.page.getByRole('option', { name: new RegExp('^' + CUR + ' · current$') }).count();
        await s.page.keyboard.press('Escape'); await s.page.waitForTimeout(200);
        check(tagged === 1, who + ' ' + page + ': the open list tags ' + CUR + ' as current');
        if (page === 'Dashboard') await s.shot(evidence('E24-' + who + '-dashboard-year-filter-1440.png'));
      }
      await s.close();
    }
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------
  await scenario('E25', 'Review and adopt: a mapped syllabus keeps its Program Outcomes through opening, autosave and unrelated edits; the checker waits; the author adopts them in Step 2; mappings and reports stay', async () => {
    const OLD = 'Analyse requirements for a reviewed outcome (synthetic).', NEW = 'Analyse and evaluate requirements for a reviewed outcome (synthetic, updated).';
    const a = await L.session(browser, stack);
    await a.loginOk('admin');
    const egas = [{ no: 1, name: 'Review competence (synthetic)', short: 'Competence' }];
    const pos = [{ no: 1, short: 'RPO 1', text: 'Apply knowledge in a reviewed outcome (synthetic).', egas: [1] }, { no: 2, short: 'RPO 2', text: OLD, egas: [1] }];
    const made = await a.api('POST', '/programs', { code: 'BSRV', name: 'BS Review Flow (synthetic)', outcomes: { egas, pos } });
    check(made.status === 201, 'the administrator added a program with two POs (HTTP ' + made.status + ')');
    const subject = await a.api('POST', '/courses', { code: 'RV 101', title: 'Review Flow (synthetic)', program: 'BSRV', semester: '1st Semester', yearLevel: 1, prerequisite: 'None' });
    check(subject.status === 200, 'and a subject (HTTP ' + subject.status + ')');
    const users = (await a.api('GET', '/users')).body, fac = (users.users || users).find((u) => u.email === 'e2e.faculty@e2e.invalid');
    check((await a.api('PUT', '/users/' + (fac.id || fac.user_id) + '/assignments', { programs: [made.body.id], courses: [subject.body.id] })).status === 200, 'assigned to the faculty member');
    const f = await L.session(browser, stack);
    await f.loginOk('faculty');
    const draft = await f.api('POST', '/syllabi/drafts'), id = draft.body.id, url = '/syllabi/' + id + '/content';
    const standards = (await f.api('GET', '/courses/' + subject.body.id)).body.standards;
    const clos = sample.clos.slice(0, 4).map((clo, i) => ({ ...clo, level: LEVELS[i], egas: [1], pos: [i % 2 === 0 ? 1 : 2] }));
    const saved = await f.api('PUT', url, { sections: { meta: { courseId: subject.body.id, code: 'RV 101', title: 'x', program: 'BSRV', lecture: '2', lab: '1', curriculumYear: 'test-2026', prereq: 'None', yearLevel: '1' }, description: [{ id: 'd1', t: 'A synthetic description for the review flow.' }], outcomes: { vision: standards.vision, mission: standards.mission, egas: standards.egas, pos: standards.pos }, clos, refs: sample.refs }, schemaVersion: 3 });
    check(saved.status === 200, 'the faculty member mapped four CLOs to the two POs (HTTP ' + saved.status + ' ' + (saved.status === 200 ? '' : JSON.stringify(saved.body).slice(0, 200)) + ')');
    const stored = async () => (await f.api('GET', url)).body;
    const mappings = JSON.stringify((await stored()).content.clos.map((c) => c.pos));
    const recheck = async () => { let r = await f.api('POST', '/syllabi/' + id + '/compliance/recheck', {}); for (let i = 0; i < 4 && r.status === 429; i++) { await f.page.waitForTimeout(15000); r = await f.api('POST', '/syllabi/' + id + '/compliance/recheck', {}); } return r; };
    const firstCheck = await recheck();
    check(firstCheck.status === 200, 'the first check ran (HTTP ' + firstCheck.status + ')');
    const firstRef = firstCheck.body.run.hybrid.referenceContext.po.reference.id;

    // the administrator updates a PO and applies it to the subject
    const cur = (await a.api('GET', '/programs/' + made.body.id + '/outcomes')).body;
    check((await a.api('PUT', '/programs/' + made.body.id + '/outcomes', { pos: cur.pos.map((p) => (p.no === 2 ? { ...p, text: NEW } : p)), version: cur.versions.pos })).status === 200, 'the administrator saved the updated PO');
    const applied = await a.api('POST', '/programs/' + made.body.id + '/sync-subjects');
    check(applied.status === 200 && applied.body.updated === 1, 'Apply to Subjects updated the subject (' + JSON.stringify(applied.body).slice(0, 100) + ')');

    // opening the syllabus adopts nothing
    await f.nav('My Syllabi');
    await f.page.getByText('RV 101', { exact: false }).first().locator('xpath=ancestor::*[.//button[contains(., "Edit")]][1]').getByRole('button', { name: /edit/i }).first().click();
    await f.page.waitForTimeout(2500);
    await f.page.getByRole('button', { name: /2 learning outcomes/i }).click();
    await f.page.waitForTimeout(1500);
    const notice = f.page.locator('.po-review');
    check((await notice.count()) === 1 && /were updated/.test(await notice.innerText()), 'Step 2 tells the author the Program Outcomes were updated');
    check((await f.text()).includes(OLD) && !(await f.text()).includes(NEW), 'Step 2 still shows the stored statement');
    await f.shot(evidence('E25-faculty-review-notice-1440.png'));
    await f.page.waitForTimeout(2000);
    check((await stored()).content.outcomes.pos[1].text === OLD, 'opening the syllabus did not adopt the update');
    // an ordinary autosave from the page adopts nothing
    await f.page.getByRole('button', { name: /1 course information/i }).click();
    await f.page.waitForTimeout(800);
    await f.page.getByPlaceholder('Describe the course in a few sentences').first().fill('A synthetic description, edited to trigger an autosave.');
    await f.page.waitForTimeout(2500);
    const afterAutosave = (await stored()).content;
    check(/edited to trigger an autosave/.test(JSON.stringify(afterAutosave.description)) && afterAutosave.outcomes.pos[1].text === OLD, 'an autosave of Step 1 kept the stored statement');
    // nor does a save of the References section, nor a forged one
    const body = await stored();
    check((await f.api('PUT', url, { sections: { refs: body.content.refs }, schemaVersion: 3, baseRevisions: { refs: body.revisions.refs } })).status === 200 && (await stored()).content.outcomes.pos[1].text === OLD, 'saving only the References section kept the stored statement');
    const forged = JSON.parse(JSON.stringify(body.content.outcomes)); forged.pos[1].text = 'A forged statement.';
    await f.api('PUT', url, { sections: { outcomes: forged }, schemaVersion: 3, baseRevisions: { outcomes: body.revisions.outcomes } });
    check((await stored()).content.outcomes.pos[1].text === OLD, 'a forged save did not replace the stored statement');
    const waiting = await recheck();
    check(waiting.status === 409 && waiting.body.code === 'po_reference_review_required', 'the checker waits for the review (HTTP ' + waiting.status + ' ' + waiting.body.code + ')');

    // the author reviews both statements and adopts
    await f.page.getByRole('button', { name: /2 learning outcomes/i }).click();
    await f.page.waitForTimeout(1000);
    await f.page.getByRole('button', { name: 'Review and adopt', exact: true }).click();
    await f.page.locator('.po-review-rows').waitFor();
    const table = await f.page.locator('.po-review-rows').innerText();
    check(table.includes(OLD) && table.includes(NEW) && /PO 2/.test(table) && /CLO 2, CLO 4/.test(table), 'the review shows the affected PO, the existing and updated statements, and the mapped CLOs');
    check(/-v1 → .*-v2/.test(await f.page.locator('.po-review').innerText()), 'the review shows the reference versions');
    const adoptButton = f.page.getByRole('button', { name: 'Adopt the updated statements', exact: true });
    check(await adoptButton.isDisabled(), 'adopting stays disabled until the author confirms');
    await f.shot(evidence('E25-faculty-review-compare-1440.png'));
    await f.page.waitForTimeout(1200);
    check((await stored()).content.outcomes.pos[1].text === OLD, 'opening the review adopted nothing');
    await f.page.locator('.po-review input[type=checkbox]').check();
    await adoptButton.click();
    await f.page.waitForTimeout(3000);
    const adopted = (await stored()).content;
    check(adopted.outcomes.pos[1].text === NEW, 'the update was adopted when the author confirmed it');
    check(JSON.stringify(adopted.clos.map((c) => c.pos)) === mappings, 'the CLO-PO mappings are unchanged');
    check((await f.page.locator('.po-review').count()) === 0 || !/were updated/.test(await f.text()), 'the notice is gone');
    const next = await recheck();
    check(next.status === 200 && next.body.run.hybrid.referenceContext.po.reference.id !== firstRef, 'the next check runs on the new version (HTTP ' + next.status + ')');
    await f.shot(evidence('E25-faculty-after-adopt-1440.png'));
    const reports = (await f.api('GET', '/compliance?syllabus=' + id)).body;
    note('compliance history after adoption: ' + JSON.stringify(reports).length + ' bytes');
    assertClean(f, 'E25-faculty', { allowStatus: [409, 429] });
    assertClean(a, 'E25-admin');
    await f.close(); await a.close();
  });
};
