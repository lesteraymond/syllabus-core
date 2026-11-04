const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('./fixtures');
const { run } = require('./engine');
const { align, pairsOf } = require('./gemini');
const { POLICY } = require('./policy');

// Regression tests for the endless "check -> suggest -> apply -> check -> suggest again" cycle.
// Found in the stored runs of one syllabus: (A) a "rewrite" identical to the current text was accepted 15 checks in a row; (B) every round of
// applied rewrites fixed some relationships and flagged new ones. The model is scripted here, so each test says exactly what the AI answers.
const options = { useAi: true, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }), env: { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only' } };
const ACTIVITY = 'row0-ilo0-activity';   // ILO text plan[0].ilos[0].text  ->  activities plan[0].activities (scored)
const CONTENT = 'row0-ilo0-content';     // advisory
const ILO_TEXT = 'plan[0].ilos[0].text';
const ACTIVITIES = 'plan[0].activities';

// script(pair, n) answers for a pair; n counts how many times this pair has been asked in this scripted run (1 = first look).
const scripted = (script) => {
  const calls = [], seen = new Map();
  const transport = async (url, req) => {
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    calls.push(batch.map(p => p.id));
    const answer = (p) => {
      const n = (seen.get(p.id) || 0) + 1; seen.set(p.id, n);
      const v = { label: 'ALIGNED', explanation: 'Fits.', draft: '', ...(script(p, n) || {}) };
      return { id: p.id, label: v.label, explanation: v.explanation, sourceQuote: p.source.slice(0, 12), targetQuote: p.target.slice(0, 12), sourceBloom: 'Apply', targetBloom: 'Apply', draft: v.label === 'ALIGNED' ? '' : (v.draft ?? 'A rewrite.') };
    };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(answer) }) }] } }] }) };
  };
  return { transport, calls };
};
const check = (content, masters, script, extra = {}) => { const ai = scripted(script); return run(content, masters, { ...options, transport: ai.transport, ...extra }).then(result => ({ result, ai })); };
const history = ({ path, basedOn, before, attempts = 1, previous = {}, runId = 7 }) => ({ attempts: { [path]: attempts }, last: { [path]: { runId, basedOn, before } }, previous });
const aiSuggestions = r => r.hybrid.suggestions.filter(s => s.source === 'ai');
const forPath = (r, path) => r.hybrid.suggestions.filter(s => s.path === path);
const deducted = (r, id) => r.hybrid.deductions.some(d => d.id === 'SEM:' + id);

test('1. a syllabus that satisfies every requirement gets no corrective suggestion and a clear "no changes needed"', async () => {
  const { content, masters } = sample();
  const { result } = await check(content, masters, () => ({ label: 'ALIGNED' }));
  assert.deepEqual(result.hybrid.suggestions, []);
  assert.deepEqual(result.hybrid.unresolved, []);
  assert.equal(result.hybrid.deductions.length, 0);
  assert.equal(result.hybrid.summary.status, 'no_changes_needed');
  assert.deepEqual([result.hybrid.summary.counts.mandatory, result.hybrid.summary.counts.material], [0, 0]);
  assert.ok(result.hybrid.summary.counts.optional > 0, 'optional quality notes exist, but they do not keep the answer from being "no changes needed"');
});

test('2. a genuine, evidence-backed deficiency is offered once as a MATERIAL correction and the answer is "changes still needed"', async () => {
  const { content, masters } = sample();
  const { result } = await check(content, masters, p => (p.id === ACTIVITY ? { label: 'PARTIALLY_ALIGNED', explanation: 'The activity is a lecture; the ILO asks the student to practise.', draft: 'Students practise the skill in a supervised laboratory exercise.' } : null));
  const s = forPath(result, ACTIVITIES);
  assert.equal(s.length, 1);
  assert.equal(s[0].tier, 'material');
  assert.equal(s[0].attempt, 1);
  assert.ok(deducted(result, ACTIVITY));
  assert.equal(result.hybrid.summary.status, 'material_open');
  assert.equal(result.hybrid.summary.counts.material, 1);
});

test('3. applying a valid correction resolves the original problem: no further suggestion for that field and "no changes needed"', async () => {
  const { content, masters } = sample();
  content.plan[0].activities = 'Students practise the skill in a supervised laboratory exercise.'; // the correction, applied
  const past = history({ path: ACTIVITIES, basedOn: [ACTIVITY], before: { [ACTIVITY]: 'PARTIALLY_ALIGNED' }, previous: { [ACTIVITY]: 'PARTIALLY_ALIGNED' } });
  const { result } = await check(content, masters, () => ({ label: 'ALIGNED' }), { history: past });
  assert.equal(result.hybrid.corrections.length, 1);
  assert.deepEqual([result.hybrid.corrections[0].path, result.hybrid.corrections[0].status], [ACTIVITIES, 'resolved']);
  assert.equal(forPath(result, ACTIVITIES).length, 0);
  assert.equal(result.hybrid.summary.status, 'no_changes_needed');
  assert.equal(result.hybrid.unresolved.length, 0);
});

test('4. a violation that is genuinely still there keeps being reported, with another real attempt first and then a stop that explains it', async () => {
  const { content, masters } = sample();
  const stillWrong = p => (p.id === ACTIVITY ? { label: 'PARTIALLY_ALIGNED', explanation: 'Still no practice by the student.', draft: 'Students complete a supervised laboratory task and submit the result.' } : null);
  const base = { path: ACTIVITIES, basedOn: [ACTIVITY], before: { [ACTIVITY]: 'PARTIALLY_ALIGNED' }, previous: { [ACTIVITY]: 'PARTIALLY_ALIGNED' } };

  const second = (await check(content, masters, stillWrong, { history: history({ ...base, attempts: 1 }) })).result;
  assert.equal(second.hybrid.corrections[0].status, 'unresolved', 'the checker says the earlier correction did not fix it');
  const again = forPath(second, ACTIVITIES);
  assert.equal(again.length, 1, 'one more real attempt is allowed');
  assert.equal(again[0].attempt, 2);
  assert.equal(again[0].tier, 'material');

  assert.equal(POLICY.maxRewriteAttempts, 2);
  const stopped = (await check(content, masters, stillWrong, { history: history({ ...base, attempts: POLICY.maxRewriteAttempts }) })).result;
  assert.equal(forPath(stopped, ACTIVITIES).length, 0, 'no third wording is generated');
  assert.equal(stopped.hybrid.unresolved.length, 1);
  assert.deepEqual([stopped.hybrid.unresolved[0].path, stopped.hybrid.unresolved[0].reason, stopped.hybrid.unresolved[0].attempts], [ACTIVITIES, 'attempt_limit', 2]);
  assert.match(stopped.hybrid.unresolved[0].explanation, /Still no practice/, 'it explains what is unresolved');
  assert.ok(deducted(stopped, ACTIVITY), 'the problem is NOT hidden: its points are still taken');
  assert.ok(stopped.findings.some(f => f.id === 'SEM:' + ACTIVITY && f.severity === 'major'), 'and it is still a finding');
  assert.equal(stopped.hybrid.summary.status, 'material_open', 'and the answer is not "no changes needed"');
  assert.equal(stopped.hybrid.summary.counts.unresolved, 1);
});

test('5. a "rewrite" that changes nothing is never offered (the loop found in the stored runs), but the problem is still reported', async () => {
  const { content, masters } = sample();
  const current = content.plan[0].activities;
  for (const [draft, why] of [[current, 'identical'], [current.toUpperCase() + '!', 'case_or_punctuation'], [current.split(' ').reverse().join(' '), 'reordered']]) {
    const { result } = await check(content, masters, p => (p.id === ACTIVITY ? { label: 'PARTIALLY_ALIGNED', explanation: 'Needs practice.', draft } : null));
    assert.equal(forPath(result, ACTIVITIES).length, 0, why + ': nothing to accept');
    assert.deepEqual([result.hybrid.unresolved[0].reason, result.hybrid.unresolved[0].detail], ['no_change_proposed', why]);
    assert.ok(deducted(result, ACTIVITY) && result.hybrid.summary.status === 'material_open', why + ': still reported');
  }
  const { result } = await check(content, masters, p => (p.id === ACTIVITY ? { label: 'PARTIALLY_ALIGNED', explanation: 'Needs practice.', draft: current + ' Students justify their results.' } : null));
  assert.equal(forPath(result, ACTIVITIES).length, 1, 'adding one real piece of content is a genuine change and is offered');
});

test('6. optional advice is labelled optional and never presented as a mandatory correction; required rules are labelled mandatory', async () => {
  const { content, masters } = sample();
  const optional = (await check(content, masters, p => (p.id === CONTENT ? { label: 'NOT_ALIGNED', explanation: 'Contents unrelated.', draft: 'Topics that match the ILO.' } : null))).result;
  const s = forPath(optional, 'plan[0].contents')[0];
  assert.equal(s.tier, 'optional');
  assert.equal(optional.hybrid.deductions.length, 0, 'it costs nothing');
  assert.ok(optional.findings.find(f => f.id === 'SEM:' + CONTENT).severity === 'minor', 'and is only a minor finding');
  assert.equal(optional.hybrid.summary.status, 'no_changes_needed', 'optional advice does not make the syllabus "not done"');
  assert.ok(optional.hybrid.summary.counts.optional >= 1);

  const wrongVision = structuredClone(content);
  wrongVision.outcomes.vision = 'A vision the author wrote themselves';
  const mandatory = (await check(wrongVision, masters, () => ({ label: 'ALIGNED' }))).result;
  const rule = mandatory.hybrid.suggestions.find(x => x.path === 'outcomes.vision');
  assert.deepEqual([rule.source, rule.tier], ['rule', 'mandatory']);
  assert.equal(mandatory.hybrid.summary.status, 'mandatory_open');
});

test('7. repeated checks do not invent new recommendations when nothing meaningful changed', async () => {
  const { content, masters } = sample();
  const script = p => (p.id === ACTIVITY ? { label: 'PARTIALLY_ALIGNED', explanation: 'Needs practice.', draft: 'Students practise in a laboratory.' } : null);
  const first = await check(content, masters, script);
  const reuse = new Map(first.result.hybrid.alignment.judgements.map(j => [j.key, j]));
  const second = await check(content, masters, script, { reuse });
  assert.equal(second.ai.calls.length, 0, 'the second check asks the AI nothing');
  assert.deepEqual(aiSuggestions(second.result).map(s => s.id), aiSuggestions(first.result).map(s => s.id), 'and offers exactly the same recommendations, none new');
  assert.deepEqual(second.result.hybrid.summary, first.result.hybrid.summary);
});

test('7b. a verdict that only fluctuates does not become a new recommendation: a previously fine relationship gets a second look, alone, and the milder verdict stands', async () => {
  const { content, masters } = sample();
  content.plan[0].activities = 'Students work through a different laboratory exercise.'; // an edit, so the pair is asked again
  const previous = { [ACTIVITY]: 'ALIGNED' };

  const noise = await check(content, masters, (p, n) => (p.id === ACTIVITY && n === 1 ? { label: 'PARTIALLY_ALIGNED', explanation: 'Not sure.', draft: 'Another wording.' } : null), { history: { attempts: {}, last: {}, previous } });
  const j = noise.result.hybrid.alignment.judgements.find(x => x.id === ACTIVITY);
  assert.equal(j.label, 'ALIGNED', 'the second look disagreed, so there is nothing to recommend');
  assert.deepEqual([j.confirmation, j.firstVerdict], ['overturned', 'PARTIALLY_ALIGNED']);
  assert.equal(forPath(noise.result, ACTIVITIES).length, 0);
  assert.equal(noise.result.hybrid.deductions.length, 0);
  assert.ok(noise.ai.calls.some(ids => ids.length === 1 && ids[0] === ACTIVITY), 'it was asked again on its own');

  const real = await check(content, masters, p => (p.id === ACTIVITY ? { label: 'PARTIALLY_ALIGNED', explanation: 'There is no practice.', draft: 'Students practise in a laboratory.' } : null), { history: { attempts: {}, last: {}, previous } });
  assert.equal(real.result.hybrid.alignment.judgements.find(x => x.id === ACTIVITY).confirmation, 'confirmed');
  assert.equal(forPath(real.result, ACTIVITIES).length, 1, 'two looks agree, so it is a genuine problem');

  const soft = await check(content, masters, (p, n) => (p.id === ACTIVITY ? (n === 1 ? { label: 'NOT_ALIGNED', explanation: 'No.', draft: 'X.' } : { label: 'PARTIALLY_ALIGNED', explanation: 'Partly.', draft: 'Y.' }) : null), { history: { attempts: {}, last: {}, previous } });
  assert.equal(soft.result.hybrid.alignment.judgements.find(x => x.id === ACTIVITY).label, 'PARTIALLY_ALIGNED', 'only what both looks support is reported');

  const alreadyFlagged = await check(content, masters, p => (p.id === ACTIVITY ? { label: 'PARTIALLY_ALIGNED', explanation: 'Still.', draft: 'Z.' } : null), { history: { attempts: {}, last: {}, previous: { [ACTIVITY]: 'PARTIALLY_ALIGNED' } } });
  assert.ok(!alreadyFlagged.ai.calls.some(ids => ids.length === 1 && ids[0] === ACTIVITY), 'a relationship that was already flagged is not second-guessed');
  const firstCheck = await check(content, masters, p => (p.id === ACTIVITY ? { label: 'PARTIALLY_ALIGNED', explanation: 'Still.', draft: 'Z.' } : null));
  assert.ok(!firstCheck.ai.calls.some(ids => ids.length === 1), 'and a first check has no previous verdict to compare with');
});

test('8. a correction that creates a genuine NEW violation is still detected, reported and charged', async () => {
  const { content, masters } = sample();
  content.plan[0].ilos[0].text = 'An ILO text that was rewritten to satisfy its CLO.'; // the applied correction
  const past = history({ path: ILO_TEXT, basedOn: ['row0-ilo0-clo:c1'], before: { 'row0-ilo0-clo:c1': 'PARTIALLY_ALIGNED' }, previous: { 'row0-ilo0-clo:c1': 'PARTIALLY_ALIGNED', [ACTIVITY]: 'ALIGNED' } });
  const { result } = await check(content, masters, p => (p.id === ACTIVITY ? { label: 'NOT_ALIGNED', explanation: 'The rewrite no longer matches the activity.', draft: 'Students practise the new outcome.' } : null), { history: past });
  const c = result.hybrid.corrections.find(x => x.path === ILO_TEXT);
  assert.equal(c.status, 'regressed');
  assert.deepEqual(c.introduced, [{ id: ACTIVITY, before: 'ALIGNED', after: 'NOT_ALIGNED' }]);
  assert.equal(c.relationships[0].after, 'ALIGNED', 'the original problem was fixed ...');
  assert.ok(deducted(result, ACTIVITY), '... but the new one costs its points');
  assert.equal(result.hybrid.summary.status, 'material_open');
  assert.equal(result.hybrid.summary.counts.regressed, 1);
  assert.equal(forPath(result, ACTIVITIES).length, 1, 'and it can be fixed');
});

test('9. an incomplete or failed AI check is never reported as "no changes needed"', async () => {
  const { content, masters } = sample();
  const down = await run(content, masters, { ...options, transport: async () => ({ ok: false, status: 429, json: async () => ({}) }) });
  assert.equal(down.hybrid.summary.status, 'incomplete');
  const unreadable = await run(content, masters, { ...options, transport: async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }) }) });
  assert.equal(unreadable.hybrid.summary.status, 'incomplete');
  const bad = structuredClone(content);
  bad.grading.rows = [{ id: 'g1', label: 'Class Standing', pct: 50 }];
  const blocked = await check(bad, masters, () => ({ label: 'ALIGNED' }));
  assert.equal(blocked.result.hybrid.summary.status, 'mandatory_open', 'a failing required rule outranks everything');
});

test('10. the official score, the pass mark and the blocking rules are not changed by any of this', async () => {
  const { content, masters } = sample();
  const script = p => (p.id === ACTIVITY ? { label: 'PARTIALLY_ALIGNED', explanation: 'x', draft: 'Students practise.' } : p.id === 'clo0-po1' ? { label: 'NOT_ALIGNED', explanation: 'y', draft: 'A CLO that fits.' } : null);
  const plain = (await check(content, masters, script)).result;
  const withHistory = (await check(content, masters, script, { history: history({ path: ACTIVITIES, basedOn: [ACTIVITY], before: { [ACTIVITY]: 'PARTIALLY_ALIGNED' }, attempts: POLICY.maxRewriteAttempts }) })).result;
  assert.deepEqual(withHistory.hybrid.deductions, plain.hybrid.deductions, 'stopping a rewrite never removes a deduction');
  assert.equal(withHistory.hybrid.provisionalScore, plain.hybrid.provisionalScore);
  assert.deepEqual(withHistory.conformance.failed.map(f => f.id), plain.conformance.failed.map(f => f.id));
  assert.equal(POLICY.alignment, 3);
  assert.equal(POLICY.partialAlignment, 1);
});

test('11. stored reports keep their shape: every field that existed still exists, the new ones are additions', async () => {
  const { content, masters } = sample();
  const { result } = await check(content, masters, () => ({ label: 'ALIGNED' }));
  for (const key of ['version', 'reportVersion', 'policy', 'codedChecks', 'ready', 'critical', 'score', 'provisionalScore', 'baseScore', 'deductions', 'links', 'alignment', 'suggestions', 'synthetic', 'checkedMeta', 'checkedAt', 'curriculum', 'quality', 'scoring']) assert.ok(key in result.hybrid, key);
  for (const key of ['summary', 'corrections', 'unresolved']) assert.ok(key in result.hybrid, 'new: ' + key);
  assert.ok(pairsOf(content, masters).length > 0 && (await align(content, masters, { env: options.env, transport: scripted(() => null).transport })).status);
});
