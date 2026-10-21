import test from 'node:test';
import assert from 'node:assert/strict';
import { hasSubject, saveOnce } from './draftSave.js';

const SECTIONS = ['meta', 'description', 'plan'];
const refusal = () => Object.assign(new Error('You already have a syllabus for this subject (Approved).'), { status: 409, data: { code: 'syllabus_exists' } });

// a fake api that records what it was asked, with a switch for failures
function setup({ id = null, saved = {}, saveError = null, removeError = null } = {}) {
  const calls = [];
  const api = {
    createDraft: async () => { calls.push(['createDraft']); return { id: 77 }; },
    saveContent: async (i, body, v) => { calls.push(['saveContent', i, Object.keys(body), v]); if (saveError) throw saveError; return {}; },
    remove: async (i) => { calls.push(['remove', i]); if (removeError) throw removeError; return {}; },
  };
  return { calls, api, idRef: { current: id }, saved: { current: { ...saved } } };
}
const run = (s, d) => saveOnce({ api: s.api, d, idRef: s.idRef, saved: s.saved, sections: SECTIONS, schemaVersion: 2 });

test('a subject decides whether there is anything to keep', () => {
  assert.equal(hasSubject({ meta: { courseId: 9 } }), true);
  for (const d of [null, undefined, {}, { meta: {} }, { meta: { courseId: null } }, { meta: { courseId: 0 } }]) assert.equal(hasSubject(d), false);
});

test('before a subject is chosen nothing is created and nothing is sent', async () => {
  const s = setup();
  assert.equal(await run(s, { meta: { program: 'BSIT', courseId: null }, description: [], plan: [] }), 'no-subject');
  assert.deepEqual(s.calls, [], 'no empty draft row is left behind in My Syllabi');
  assert.equal(s.idRef.current, null);
  assert.deepEqual(s.saved.current, {}, 'and nothing counts as saved yet');
});

test('the first save with a subject creates the row once and sends every section', async () => {
  const s = setup();
  assert.equal(await run(s, { meta: { courseId: 9 }, description: [1], plan: [] }), 'saved');
  assert.deepEqual(s.calls, [['createDraft'], ['saveContent', 77, ['meta', 'description', 'plan'], 2]]);
  assert.equal(s.idRef.current, 77);
  assert.equal(s.saved.current.meta, JSON.stringify({ courseId: 9 }));
});

test('what was typed before the subject is not lost: it goes up with the first save', async () => {
  const s = setup();
  const d = { meta: { courseId: null }, description: ['typed early'], plan: [] };
  await run(s, d);
  assert.deepEqual(s.calls, []);
  await run(s, { ...d, meta: { courseId: 9 } });
  assert.deepEqual(s.calls[1].slice(2, 3), [['meta', 'description', 'plan']]);
});

test('later saves send only the sections that changed, and never create a second row', async () => {
  const s = setup({ id: 77, saved: { meta: JSON.stringify({ courseId: 9 }), description: JSON.stringify([]), plan: JSON.stringify([]) } });
  assert.equal(await run(s, { meta: { courseId: 9 }, description: ['new'], plan: [] }), 'saved');
  assert.deepEqual(s.calls, [['saveContent', 77, ['description'], 2]]);
  s.calls.length = 0;
  assert.equal(await run(s, { meta: { courseId: 9 }, description: ['new'], plan: [] }), 'unchanged');
  assert.deepEqual(s.calls, [], 'nothing changed, nothing sent');
});

test('a section the form does not have is skipped', async () => {
  const s = setup({ id: 77 });
  await run(s, { meta: { courseId: 9 } });
  assert.deepEqual(s.calls, [['saveContent', 77, ['meta'], 2]]);
});

test('a first save refused because the person already has a syllabus on that subject deletes the row it just created', async () => {
  const s = setup({ saveError: refusal() });
  await assert.rejects(() => run(s, { meta: { courseId: 9 }, description: [], plan: [] }), (e) => e.data.code === 'syllabus_exists');
  assert.deepEqual(s.calls, [['createDraft'], ['saveContent', 77, ['meta', 'description', 'plan'], 2], ['remove', 77]]);
  assert.equal(s.idRef.current, null, 'the next save starts clean');
  assert.deepEqual(s.saved.current, {}, 'and nothing counts as saved');
});

test('a refusal on a draft that already existed leaves it alone', async () => {
  const s = setup({ id: 40, saveError: refusal() });
  await assert.rejects(() => run(s, { meta: { courseId: 9 }, description: [], plan: [] }));
  assert.deepEqual(s.calls.map((c) => c[0]), ['saveContent'], 'no delete');
  assert.equal(s.idRef.current, 40);
});

test('any other failure on the first save keeps the row, so a retry reuses it', async () => {
  const s = setup({ saveError: new Error('Cannot reach the server.') });
  await assert.rejects(() => run(s, { meta: { courseId: 9 }, description: [], plan: [] }));
  assert.equal(s.idRef.current, 77);
  assert.deepEqual(s.calls.map((c) => c[0]), ['createDraft', 'saveContent']);
  s.calls.length = 0;
  s.api.saveContent = async (i, body) => { s.calls.push(['saveContent', i, Object.keys(body)]); return {}; };
  assert.equal(await run(s, { meta: { courseId: 9 }, description: [], plan: [] }), 'saved');
  assert.deepEqual(s.calls, [['saveContent', 77, ['meta', 'description', 'plan']]], 'the retry does not create a second row');
});

test('the original refusal reaches the screen even when deleting the row fails', async () => {
  const s = setup({ saveError: refusal(), removeError: new Error('offline') });
  await assert.rejects(() => run(s, { meta: { courseId: 9 }, description: [], plan: [] }), (e) => e.data && e.data.code === 'syllabus_exists');
  assert.equal(s.idRef.current, null);
});
