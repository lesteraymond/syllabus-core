import test from 'node:test';
import assert from 'node:assert/strict';
import { applySuggestion, canSubmitHybrid, decideSuggestion, undoSuggestion } from './hybridCheck.js';
test('submit remains disabled for absent, stale, edited, expired or unevaluated checks', () => {
  const run = { draftSignature: 'same', hybrid: { ready: true, checkedAt: new Date().toISOString(), alignment: { status: 'completed' } } };
  assert.equal(canSubmitHybrid(run, 'same'), true);
  for (const candidate of [null, { ...run, stale: true }, { ...run, hybrid: { ...run.hybrid, ready: false } }, { ...run, hybrid: { ...run.hybrid, checkedAt: '2000-01-01' } }, { ...run, hybrid: { ...run.hybrid, alignment: { status: 'not_evaluated' } } }]) assert.equal(canSubmitHybrid(candidate, 'same'), false);
  assert.equal(canSubmitHybrid(run, 'changed'), false);
});
test('a human-approved draft edits only allowed fields and preserves the original', () => {
  const original = { plan: [{ tasks: 'Old quiz' }], outcomes: { vision: 'Old vision' } };
  assert.equal(applySuggestion(original, { path: 'plan[0].tasks', replacement: 'Design and demonstrate a tested program.' }).plan[0].tasks, 'Design and demonstrate a tested program.');
  assert.equal(original.plan[0].tasks, 'Old quiz');
  for (const path of ['__proto__.polluted', 'status', 'meta.program', 'plan[999].tasks']) assert.throws(() => applySuggestion(original, { path, replacement: 'invalid' }));
});

test('independent recommendations can be saved successively without overwriting changed fields or reordered rows', () => {
  const original = { clos: [{ id: 'c1', statement: 'First CLO' }, { id: 'c2', statement: 'Second CLO' }] };
  const first = { id: 'first', path: 'clos[0].statement', originalValue: 'First CLO', targetIds: { row: 'c1' }, replacement: 'Revised first CLO' };
  const second = { id: 'second', path: 'clos[1].statement', originalValue: 'Second CLO', targetIds: { row: 'c2' }, replacement: 'Revised second CLO' };
  const changed = applySuggestion(original, first, { requireOriginal: true });
  const both = applySuggestion(changed, second, { requireOriginal: true });
  assert.deepEqual(both.clos.map(c => c.statement), ['Revised first CLO', 'Revised second CLO']);
  assert.throws(() => applySuggestion(changed, { ...first, replacement: 'Conflicting revision' }, { requireOriginal: true }), /suggestionTargetChanged/);
  assert.throws(() => applySuggestion({ clos: [...original.clos].reverse() }, first, { requireOriginal: true }), /suggestionTargetChanged/);
  assert.throws(() => applySuggestion(original, { path: first.path, replacement: 'Legacy proposal' }, { requireOriginal: true }), /refreshSuggestions/);
  assert.equal(applySuggestion(changed, first, { requireOriginal: true }).clos[0].statement, first.replacement, 'Idempotent retry after a decision-log error');
});

test('ILO suggestions verify both week and ILO identities and master objects compare independently of key order', () => {
  const d = { plan: [{ id: 'week1', ilos: [{ id: 'ilo1', text: 'Original' }] }], outcomes: { pos: [{ no: 1, text: 'PO' }] } };
  const patch = { path: 'plan[0].ilos[0].text', originalValue: 'Original', targetIds: { row: 'week1', ilo: 'ilo1' }, replacement: 'Revised' };
  assert.equal(applySuggestion(d, patch).plan[0].ilos[0].text, 'Revised');
  assert.throws(() => applySuggestion({ ...d, plan: [{ id: 'week1', ilos: [{ id: 'different', text: 'Original' }] }] }, patch), /suggestionTargetChanged/);
  assert.deepEqual(applySuggestion(d, { path: 'outcomes.pos', originalValue: [{ text: 'PO', no: 1 }], replacement: [{ no: 1, text: 'Updated PO' }] }).outcomes.pos, [{ no: 1, text: 'Updated PO' }]);
  assert.equal(applySuggestion({ meta: {} }, { path: 'meta.prereq', originalValue: null, originalMissing: true, replacement: 'IT 101' }, { requireOriginal: true }).meta.prereq, 'IT 101');
});

test('Accept waits for a successful save before recording a decision; save failures never record acceptance', async () => {
  const events = [];
  const suggestion = { id: 's1', path: 'plan[0].tasks', originalValue: 'Old', replacement: 'New' };
  let persisted = { plan: [{ tasks: 'Old' }] };
  const result = await decideSuggestion({ suggestion, action: 'accept', applyDraft: async patch => { persisted = applySuggestion(persisted, patch, { requireOriginal: true }); events.push('saved'); }, recordDecision: async body => { assert.equal(persisted.plan[0].tasks, 'New'); events.push('recorded'); return body; } });
  assert.deepEqual(events, ['saved', 'recorded']);
  assert.equal(result.applied, true);
  let decisions = 0;
  await assert.rejects(decideSuggestion({ suggestion, action: 'accept', applyDraft: async () => { throw Error('save failed'); }, recordDecision: async () => { decisions++; } }), /save failed/);
  assert.equal(decisions, 0);
});

test('edited drafts use the edited text; rejection and reviewer-only acceptance never change content', async () => {
  const suggestion = { id: 's1', path: 'plan[0].tasks', replacement: 'Original proposal' };
  let appliedText;
  const result = await decideSuggestion({ suggestion, action: 'edit', editedText: 'Human revision', applyDraft: async patch => { appliedText = patch.replacement; }, recordDecision: async body => body });
  assert.equal(appliedText, 'Human revision');
  assert.equal(result.decision.editedText, 'Human revision');
  await decideSuggestion({ suggestion, action: 'reject', applyDraft: () => { throw Error('Must not apply rejected text'); }, recordDecision: async body => body });
  assert.equal((await decideSuggestion({ suggestion, action: 'accept', recordDecision: async body => body })).applied, false);
  await assert.rejects(decideSuggestion({ suggestion, action: 'accept', applyDraft: async () => {}, recordDecision: async () => { throw Error('audit unavailable'); } }), error => error.draftSaved === true && error.message === 'audit unavailable');
});

test('undo restores the original text and records an undo event; refine-then-undo chains from the last applied value', async () => {
  const suggestion = { id: 's1', path: 'plan[0].tasks', originalValue: 'Old', replacement: 'New' };
  let persisted = { plan: [{ tasks: 'Old' }] };
  const apply = async patch => { persisted = applySuggestion(persisted, patch, { requireOriginal: true }); };
  const log = [];
  await decideSuggestion({ suggestion, action: 'accept', applyDraft: apply, recordDecision: async b => b });
  assert.equal(persisted.plan[0].tasks, 'New');
  // refine the applied text: the base is what was applied, not the first original
  await decideSuggestion({ suggestion: { ...suggestion, originalValue: 'New' }, action: 'edit', editedText: 'Refined', applyDraft: apply, recordDecision: async b => b });
  assert.equal(persisted.plan[0].tasks, 'Refined');
  await undoSuggestion({ suggestion, appliedValue: 'Refined', applyDraft: apply, recordDecision: async b => { log.push(b); return b; } });
  assert.equal(persisted.plan[0].tasks, 'Old');
  assert.deepEqual(log, [{ suggestionId: 's1', action: 'undo' }]);
});

test('undo is refused when the field was edited since, when the original is unknown, and when the log write fails it says the draft was saved', async () => {
  const suggestion = { id: 's1', path: 'plan[0].tasks', originalValue: 'Old', replacement: 'New' };
  let persisted = { plan: [{ tasks: 'Typed by the author' }] };
  const apply = async patch => { persisted = applySuggestion(persisted, patch, { requireOriginal: true }); };
  await assert.rejects(undoSuggestion({ suggestion, appliedValue: 'New', applyDraft: apply, recordDecision: async b => b }), /suggestionTargetChanged/);
  assert.equal(persisted.plan[0].tasks, 'Typed by the author');
  await assert.rejects(undoSuggestion({ suggestion: { ...suggestion, originalMissing: true }, appliedValue: 'New', applyDraft: apply, recordDecision: async b => b }), /cannotUndo/);
  await assert.rejects(undoSuggestion({ suggestion: { id: 'x', path: 'plan[0].tasks' }, appliedValue: 'New', applyDraft: apply, recordDecision: async b => b }), /cannotUndo/);
  persisted = { plan: [{ tasks: 'New' }] };
  await assert.rejects(undoSuggestion({ suggestion, appliedValue: 'New', applyDraft: apply, recordDecision: async () => { throw Error('audit unavailable'); } }), e => e.draftSaved === true && e.message === 'audit unavailable');
  assert.equal(persisted.plan[0].tasks, 'Old');
});

test('advisory policy: the author can submit without a completed AI check, but a coded hard gate still stops the submit', () => {
  const sig = '{"draft":1}';
  const failedAi = { stale: false, draftSignature: sig, hybrid: { ready: false, alignment: { status: 'not_evaluated' } }, findings: [
    { id: 'AI-REQUIRED:review', ruleId: 'AI-REQUIRED', severity: 'blocking' }, { id: 'SEM:a', ruleId: 'SEM', severity: 'blocking' }, { id: 'LINK:b', ruleId: 'LINK', severity: 'blocking' }, { id: 'VALUE:c', ruleId: 'VALUE', severity: 'major' }] };
  assert.equal(canSubmitHybrid(failedAi, sig), false, 'strict by default');
  assert.equal(canSubmitHybrid(failedAi, sig, 'required'), false);
  assert.equal(canSubmitHybrid(failedAi, sig, 'advisory'), true, 'AI, link and value findings are advice');
  assert.equal(canSubmitHybrid(null, sig, 'advisory'), true, 'no check yet: the server still enforces the hard gates and explains a refusal');
  const hard = { ...failedAi, findings: [...failedAi.findings, { id: 'CUR-CODE:meta.code', ruleId: 'CUR-CODE', severity: 'blocking' }] };
  assert.equal(canSubmitHybrid(hard, sig, 'advisory'), false);
  assert.equal(canSubmitHybrid({ ...hard, draftSignature: 'older form' }, sig, 'advisory'), true, 'a check of an older form says nothing about this one; the server decides');
  assert.equal(canSubmitHybrid({ ...hard, stale: true }, sig, 'advisory'), true);
});

test('a description suggestion replaces the paragraphs, can be undone, and is refused once the description was edited', () => {
  const original = { description: [{ id: 'd1', t: 'Old first.' }, { id: 'd2', t: 'Old second.' }] };
  const suggestion = { path: 'description', replacement: [{ id: 'd1', t: 'One paragraph that names the planned topics.' }], originalValue: structuredClone(original.description) };
  const applied = applySuggestion(original, suggestion, { requireOriginal: true });
  assert.deepEqual(applied.description, suggestion.replacement);
  assert.deepEqual(original.description.length, 2, 'the draft that was passed in is not changed');
  const undone = applySuggestion(applied, { ...suggestion, replacement: suggestion.originalValue, originalValue: suggestion.replacement }, { requireOriginal: true });
  assert.deepEqual(undone.description, original.description);
  const edited = { description: [{ id: 'd1', t: 'Someone rewrote it meanwhile.' }] };
  assert.throws(() => applySuggestion(edited, suggestion, { requireOriginal: true }), /suggestionTargetChanged/);
});
