import React, { act } from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import UploadPanel from '../src/views/builder2/UploadPanel';
import SyllabusBuilderV2 from '../src/views/builder2';
import { syllabi, courses, users, outcomes, compliance } from '../src/lib/api';
import { emptyDraft } from '../src/lib/syllabusModel';

const browser = new Window({ url: 'http://localhost:5173' });
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Event: browser.Event, MouseEvent: browser.MouseEvent, IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import('react-dom/client');
let counter = 0;
const draft = emptyDraft(() => `row${++counter}`);
draft.meta = { ...draft.meta, program: 'BSIE', courseId: 25, code: 'MA 7', title: 'Differential Calculus' };
draft.outcomes = { vision: '', mission: { lead: '', items: [] }, egas: [], pos: [] };
const identityContextFor = (d = draft) => ({ selected: { id: d.meta.courseId, program: d.meta.program, code: d.meta.code, title: d.meta.title }, curricula: [{ program: d.meta.program, status: 'approved', curriculumYear: '2022-2023', courses: [{ code: d.meta.code, title: d.meta.title }] }] });
async function mount(t, props, fn) {
  t.mock.method(URL, 'createObjectURL', () => 'blob:test-pdf');
  t.mock.method(URL, 'revokeObjectURL', () => {});
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const base = { draft, hasCourse: true, busy: false, disabled: false, onChooseCourse() {}, onExtract() {}, onApply() {} };
  const onExtract = async (...args) => ({ identityContext: identityContextFor(props.draft || draft), ...await (props.onExtract || base.onExtract)(...args) });
  await act(async () => root.render(<UploadPanel {...base} {...props} onExtract={onExtract} />));
  const button = text => [...host.querySelectorAll('button')].find(node => node.textContent.includes(text));
  const pick = async () => {
    const input = host.querySelector('input[type=file]');
    assert.equal(input.closest('fieldset').disabled, false, 'the file picker must be usable');
    Object.defineProperty(input, 'files', { configurable: true, value: [new browser.File(['%PDF'], 'syllabus.pdf', { type: 'application/pdf' })] });
    await act(async () => input.dispatchEvent(new browser.Event('change', { bubbles: true })));
  };
  try { await fn({ host, button, pick }); }
  finally { await act(async () => root.unmount()); host.remove(); }
}
test('file selection waits for availability then automatically reads the PDF', async t => {
  let resolve, extractions = 0;
  t.mock.method(syllabi, 'pdfImportConfig', () => new Promise(done => { resolve = done; }));
  const fields = Object.fromEntries(['code', 'title', 'description', 'prereq', 'credits', 'clos', 'plan', 'reqs', 'refs', 'grading'].map(key => [key, '']));
  await mount(t, { onExtract: async () => { extractions++; return { fields, text: 'Source', pages: [{ method: 'text' }] }; } }, async ({ host, pick }) => {
    assert.match(host.textContent, /Checking PDF import availability/);
    await pick();
    assert.match(host.textContent, /syllabus.pdf/);
    assert.equal(extractions, 0, 'waits until availability resolves');
    await act(async () => resolve({ enabled: true }));
    assert.equal(extractions, 1, 'starts reading automatically once availability confirms enabled');
    assert.match(host.textContent, /Review extracted content/);
  });
});
test('an availability error can be retried without losing the selected file and auto-scans on recovery', async t => {
  let attempts = 0, extractions = 0;
  t.mock.method(syllabi, 'pdfImportConfig', async () => { if (++attempts === 1) throw Error('Network failure'); return { enabled: true }; });
  const fields = Object.fromEntries(['code', 'title', 'description', 'prereq', 'credits', 'clos', 'plan', 'reqs', 'refs', 'grading'].map(key => [key, '']));
  await mount(t, { onExtract: async () => { extractions++; return { fields, text: 'Source', pages: [{ method: 'text' }] }; } }, async ({ host, button, pick }) => {
    assert.match(host.textContent, /Could not check PDF import availability/);
    await pick();
    await act(async () => button('Retry availability check').click());
    assert.equal(attempts, 2);
    assert.match(host.textContent, /syllabus.pdf/);
    assert.equal(extractions, 1);
    assert.match(host.textContent, /Review extracted content/);
  });
});
test('no subject chosen yet: uploading a PDF automatically scans it; read-only access shows its reason and keeps real safeguards', async t => {
  t.mock.method(syllabi, 'pdfImportConfig', async () => ({ enabled: true }));
  let extractions = 0;
  await mount(t, { hasCourse: false, onExtract: async () => { extractions++; } }, async ({ host, pick }) => {
    await pick();
    assert.doesNotMatch(host.textContent, /Choose your assigned subject|Choose your subject/);
    assert.equal(extractions, 1, 'the PDF is scanned automatically to find its subject');
  });
  await mount(t, { disabled: true, disabledReason: 'This syllabus was submitted and is locked.' }, async ({ host }) => {
    assert.equal(host.querySelector('fieldset').disabled, true);
    assert.match(host.textContent, /submitted and is locked/);
  });
});
test('disabled service remains disabled and is explained on upload', async t => {
  t.mock.method(syllabi, 'pdfImportConfig', async () => ({ enabled: false }));
  await mount(t, {}, async ({ host, pick }) => {
    await pick();
    assert.match(host.textContent, /PDF import is currently disabled/);
    assert.match(host.querySelector('[role=alert]').textContent, /PDF import is currently disabled/);
  });
});
test('an availability request that never answers times out and offers recovery', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  t.mock.method(syllabi, 'pdfImportConfig', options => {
    signal = options.signal;
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Error('Aborted')), { once: true }));
  });
  await mount(t, {}, async ({ host, button, pick }) => {
    await pick();
    await act(async () => t.mock.timers.tick(8000));
    assert.equal(signal.aborted, true);
    assert.match(host.textContent, /Could not check PDF import availability/);
    assert.ok(button('Retry availability check'));
  });
});
for (const scenario of ['review', 'course', 'mapping']) {
test(`Apply shows its ${scenario} blocker beside the button and never calls the save handler`, async t => {
  t.mock.method(syllabi, 'pdfImportConfig', async () => ({ enabled: true }));
  const fields = Object.fromEntries(['code', 'title', 'description', 'prereq', 'credits', 'clos', 'plan', 'reqs', 'refs', 'grading'].map(key => [key, '']));
  if (scenario === 'course') fields.code = 'IE 402';
  if (scenario === 'mapping') fields.clos = Array.from({ length: 21 }, (_, i) => `CLO ${i + 1}: Analyze a function.`).join('\n');
  let applications = 0;
  await mount(t, { onExtract: async () => ({ fields, text: 'Source', pages: [{ method: 'text' }] }), onApply: async () => { applications++; } }, async ({ host, button, pick }) => {
    await pick();
    if (scenario !== 'review') await act(async () => host.querySelector('.pdf-import-confirm input').click());
    assert.equal(button('Apply and submit directly').disabled, false);
    await act(async () => button('Apply and submit directly').click());
    const feedback = host.querySelector('.pdf-import-review [role=alert][tabindex]');
    assert.ok(feedback);
    assert.match(feedback.textContent, scenario === 'review' ? /Confirm the review checkbox/ : scenario === 'course' ? /IE 402.*MA 7/ : /More than 20 CLO/);
    assert.equal(document.activeElement, feedback);
    assert.equal(applications, 0);
  });
});
}
test('layout preview renders editable plan columns and source outcomes, and applies the same structured rows', async t => {
  t.mock.method(syllabi, 'pdfImportConfig', async () => ({ enabled: true }));
  const fields = Object.fromEntries(['code', 'title', 'description', 'prereq', 'credits', 'clos', 'plan', 'reqs', 'refs', 'grading'].map(key => [key, '']));
  Object.assign(fields, { description: 'Filled', credits: '3', reqs: 'Quiz', refs: 'Book', grading: '60/40', code: 'MA 7', title: 'Differential Calculus', vision: 'Source vision', mission: 'Source mission', egas: 'EGA 1: Thinker', pos: 'PO1. Engineering', clos: 'CLO 3: Analyze a signal. [EGA 1] [PO 1]' });
  const rows = [{ week: '2-3', ilo: 'ILO1: Analyze |x|. [CLO3]', contents: 'Signals | amplitudes', activities: 'Construct a model', tasks: 'Model defense', values: 'Humility', sourcePages: [4, 5], kind: 'lesson' }];
  let applied;
  await mount(t, { onExtract: async () => ({ fields, text: 'Source', pages: [{ method: 'text' }], layout: { version: 2, planRows: rows, warnings: [] } }), onApply: async (fields, options) => { applied = options.planRows; } }, async ({ host, button, pick }) => {
    await pick();
    assert.ok(host.querySelector('.pdf-import-table table'));
    assert.equal(host.querySelector('.pdf-import-table textarea[aria-label="Row 1: Course Contents"]').value, 'Signals | amplitudes');
    assert.match(host.querySelector('.pdf-import-table').textContent, /Source pages: 4, 5/);
    assert.match(host.querySelector('.pdf-import-outcomes').textContent, /Institutional and program text/);
    await act(async () => host.querySelector('.pdf-import-confirm input').click());
    await act(async () => button('Apply and submit directly').click());
    assert.deepEqual(applied, rows);
  });
});
for (const outcome of ['complete', 'save-failed']) {
test(`builder scans a dirty draft without saving old text; Apply to form saves and leaves AI CHECK to the Review step: ${outcome}`, async t => {
  t.mock.method(URL, 'createObjectURL', () => 'blob:test-pdf');
  t.mock.method(URL, 'revokeObjectURL', () => {});
  const content = structuredClone(draft);
  content.meta.program = 'BSIE';
  const course = { id: 25, code: 'MA 7', title: 'Differential Calculus', program: { code: 'BSIE', name: 'Industrial Engineering' }, clos: [], standards: content.outcomes };
  t.mock.method(syllabi, 'getContent', async () => ({ content, editable: true, status: 'draft', version: 'v1.0' }));
  t.mock.method(outcomes, 'programs', async () => [{ code: 'BSIE', name: 'Industrial Engineering' }]);
  t.mock.method(courses, 'get', async () => course);
  t.mock.method(courses, 'list', async () => [{ id: 25, code: 'MA 7', title: 'Differential Calculus' }]);
  t.mock.method(users, 'myAssignments', async () => ({ courseIds: [25], programIds: [1] }));
  t.mock.method(syllabi, 'pdfImportConfig', async () => ({ enabled: true }));
  let calls = 0, resolve;
  t.mock.method(syllabi, 'importPdf', (id, file) => {
    assert.equal(id, 101); assert.equal(file.name, 'syllabus.pdf'); calls++;
    return new Promise(done => { resolve = done; });
  });
  let checks = 0, aiChecks = 0, allowSave = false, storedRun = null, saveFailures = 0;
  const order = [], notices = [];
  t.mock.method(syllabi, 'saveContent', async () => {
    assert.ok(allowSave, 'Scanning must not save unfinished old form content');
    order.push('save');
    if (outcome === 'save-failed' && saveFailures++ === 0) throw Error('Save unavailable');
    return {};
  });
  t.mock.method(compliance, 'get', async () => ({ installed: true, run: storedRun }));
  t.mock.method(compliance, 'recheck', async id => {
    assert.equal(id, 101); order.push('check'); aiChecks++;
    storedRun = { id: 123, status: 'insufficient', overall: null, stale: false, findings: [], areas: [], recommendations: [], aiStatus: 'failed', filledSections: 0, passThreshold: 75 };
    return { run: storedRun };
  });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const button = text => [...host.querySelectorAll('button')].find(node => node.textContent.includes(text));
  try {
    await act(async () => root.render(<SyllabusBuilderV2 editing={{ syllabusId: 101 }} user={{ id: 26, role: 'faculty', firstName: 'JP', lastName: 'Test' }} notify={message => notices.push(message)} setPage={() => {}} onSubmitted={() => { checks++; }} />));
    await act(async () => button('Add paragraph').click());
    await act(async () => button('Upload a file instead').click());
    const input = host.querySelector('input[type=file]');
    Object.defineProperty(input, 'files', { configurable: true, value: [new browser.File(['%PDF'], 'syllabus.pdf', { type: 'application/pdf' })] });
    await act(async () => input.dispatchEvent(new browser.Event('change', { bubbles: true })));
    assert.equal(calls, 1);
    assert.match(host.querySelector('.up-panel').textContent, /Reading PDF/);
    await act(async () => resolve({ fields: { ...Object.fromEntries(['description', 'prereq', 'credits', 'clos', 'plan', 'reqs', 'refs', 'grading'].map(key => [key, key === 'prereq' ? '' : 'Filled ' + key])), code: 'MA 7', title: 'Differential Calculus' }, identityContext: identityContextFor(content), text: 'Source', pages: [{ method: 'text' }] }));
    assert.match(host.querySelector('.up-panel').textContent, /Review extracted content/);
    assert.deepEqual(order, []);
    assert.equal(aiChecks, 0);
    allowSave = true;
    await act(async () => host.querySelector('.pdf-import-confirm input').click());
    const applyButton = button('Apply and submit directly');
    await act(async () => { applyButton.click(); applyButton.click(); });
    if (outcome === 'save-failed') {
      assert.match(host.querySelector('.up-panel [role=alert]').textContent, /draft could not be saved/);
      await act(async () => button('Apply and submit directly').click());
      assert.deepEqual(order, ['save', 'save'], 'the retry saves without forcing another PDF scan');
    } else {
      assert.deepEqual(order, ['save']);
    }
    assert.equal(calls, 1, 'the PDF was scanned once');
    assert.equal(aiChecks, 0, 'Apply to form never runs AI CHECK: that is the Review step');
    assert.ok(notices.some(message => message.includes('Submit from this Review step')));
    assert.ok(!host.querySelector('.up-panel'), 'back to the form, on the Review step');
    assert.equal(checks, 0);
  } finally { await act(async () => root.unmount()); host.remove(); }
});
}

for (const action of ['keep', 'replace']) {
test(`prerequisite ${action} requires an explicit choice and forwards the exact reviewed values`, async t => {
  t.mock.method(syllabi, 'pdfImportConfig', async () => ({ enabled: true }));
  const d = structuredClone(draft); d.meta.prereq = 'Existing prerequisite';
  const fields = { description: 'Filled', credits: '3', clos: 'CLO1. x', plan: 'Week 1', reqs: 'Quiz', refs: 'Book', grading: '60/40', code: 'MA 7', title: 'Differential Calculus', prereq: 'PDF prerequisite' };
  let applied;
  await mount(t, { draft: d, onExtract: async () => ({ fields, pages: [{ method: 'text' }] }), onApply: async (fields, options) => { applied = options; } }, async ({ host, button, pick }) => {
    await pick();
    assert.match(host.textContent, /Current prerequisite: Existing prerequisite/);
    assert.match(host.textContent, /PDF prerequisite: PDF prerequisite/);
    await act(async () => host.querySelector('.pdf-import-confirm input').click());
    await act(async () => button('Apply and submit directly').click());
    assert.match(host.querySelector('.pdf-import-review [role=alert][tabindex]').textContent, /Choose whether to keep or replace/);
    assert.equal(applied, undefined);
    const radios=host.querySelectorAll('.pdf-import-prerequisite input');
    await act(async () => radios[action==='keep'?0:1].click());
    assert.equal(host.querySelector('.pdf-import-confirm input').checked, false);
    await act(async () => host.querySelector('.pdf-import-confirm input').click());
    await act(async () => button('Apply and submit directly').click());
    assert.deepEqual(applied.prerequisiteChoice, { existing:'Existing prerequisite', imported:'PDF prerequisite', action });
    assert.equal(d.meta.prereq, 'Existing prerequisite');
  });
});
}
test('editing the PDF prerequisite invalidates the previous replacement confirmation',async t=>{
  t.mock.method(syllabi, 'pdfImportConfig', async () => ({ enabled: true }));
  const d=structuredClone(draft);d.meta.prereq='Existing';let applications=0;
  await mount(t,{draft:d,onExtract:async()=>({fields:{description: 'Filled', credits: '3', clos: 'CLO1. x', plan: 'Week 1', reqs: 'Quiz', refs: 'Book', grading: '60/40', code:'MA 7',title:'Differential Calculus',prereq:'PDF value'},pages:[]}),onApply:async()=>{applications++;}},async({host,button,pick})=>{
    await pick();
    await act(async()=>host.querySelectorAll('.pdf-import-prerequisite input')[1].click());
    const input=[...host.querySelectorAll('.pdf-import-section textarea')][3];
    await act(async()=>{
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(input,'Edited PDF value');
      input.dispatchEvent(new browser.Event('input',{bubbles:true}));
    });
    await act(async()=>host.querySelector('.pdf-import-confirm input').click());
    await act(async()=>button('Apply and submit directly').click());
    assert.equal(applications,0);assert.match(host.textContent,/Choose whether to keep or replace/);
  });
});
test('preview rejects BSIT content for Cyber IT-202, and missing curriculum context, without applying',async t=>{
  t.mock.method(syllabi, 'pdfImportConfig', async () => ({ enabled: true }));
  const d=structuredClone(draft);Object.assign(d.meta,{program:'BSIT-CYBERSECURITY',code:'IT-202',title:'SYSTEM INTEGRATION AND ARCHITECTURE 1'});
  for (const scenario of ['collision','missing-context']) {
    let applications=0;
    const fields=scenario==='collision'?{description: 'Filled', credits: '3', clos: 'CLO1. x', plan: 'Week 1', reqs: 'Quiz', refs: 'Book', grading: '60/40', code:'IT 202',title:'Computer Programming 1'}:{description: 'Filled', credits: '3', clos: 'CLO1. x', plan: 'Week 1', reqs: 'Quiz', refs: 'Book', grading: '60/40', code:d.meta.code,title:d.meta.title};
    await mount(t,{draft:d,onExtract:async()=>({fields,pages:[],...(scenario==='missing-context'?{identityContext:null}:{})}),onApply:async()=>{applications++;}},async({host,button,pick})=>{
      await pick();
      await act(async()=>host.querySelector('.pdf-import-confirm input').click());
      await act(async()=>button('Apply and submit directly').click());
      assert.equal(applications,0);assert.match(host.querySelector('[role=alert][tabindex]').textContent,/cannot be verified/);
    });
  }
});
// Refresh during or after a PDF scan (lib/builderRoute.js, lib/pdfImportResume.js, server/lib/pdfImportJobs.js).
const fullFields = () => ({ ...Object.fromEntries(['description', 'prereq', 'credits', 'clos', 'plan', 'reqs', 'refs', 'grading'].map(key => [key, key === 'prereq' ? '' : 'Filled ' + key])), code: 'MA 7', title: 'Differential Calculus' });
test('after a refresh the panel picks up the scan the server kept: no new upload, and its PDF and preview come back', async t => {
  t.mock.method(syllabi, 'pdfImportConfig', async () => ({ enabled: true }));
  let extractions = 0, finish;
  const resumed = [], asked = [];
  await mount(t, {
    resumeJob: 'jabc12345678',
    onExtract: async () => { extractions++; return { fields: fullFields(), pages: [] }; },
    onResume: (job, { onStatus }) => { resumed.push(job); onStatus({ state: 'running', file: { name: 'kept.pdf', size: 2048 } }); return new Promise(done => { finish = done; }); },
    onResumeFile: async (job, { name }) => { asked.push([job, name]); return new browser.File(['%PDF'], name, { type: 'application/pdf' }); },
  }, async ({ host }) => {
    assert.deepEqual(resumed, ['jabc12345678']);
    assert.ok(host.querySelector('.up-scanning'), 'the scan shows as still running');
    assert.match(host.textContent, /kept\.pdf/);
    await act(async () => finish({ fields: fullFields(), text: 'Source', pages: [{ method: 'text' }], identityContext: identityContextFor() }));
    assert.match(host.textContent, /Review extracted content/);
    assert.equal(host.querySelector('.up-scanning'), null);
    assert.equal(extractions, 0, 'nothing is uploaded or scanned again');
    assert.deepEqual(asked, [['jabc12345678', 'kept.pdf']]);
  });
});
test('a scan the server no longer has asks for the PDF again; without a scan to resume nothing is asked', async t => {
  t.mock.method(syllabi, 'pdfImportConfig', async () => ({ enabled: true }));
  await mount(t, { resumeJob: 'jabc12345678', onResume: async () => { throw new Error('pdfImport.interrupted'); }, onResumeFile: async () => null }, async ({ host }) => {
    assert.match(host.querySelector('[role=alert]').textContent, /interrupted.*Choose the PDF again/);
    assert.equal(host.querySelector('input[type=file]').closest('fieldset').disabled, false, 'a new PDF can be chosen');
  });
  let resumes = 0;
  await mount(t, { onResume: async () => { resumes++; } }, async () => assert.equal(resumes, 0));
});
async function mountBuilder(t, props, fn) {
  t.mock.method(URL, 'createObjectURL', () => 'blob:test-pdf');
  t.mock.method(URL, 'revokeObjectURL', () => {});
  const content = structuredClone(draft);
  const course = { id: 25, code: 'MA 7', title: 'Differential Calculus', program: { code: 'BSIE', name: 'Industrial Engineering' }, clos: [], standards: content.outcomes };
  t.mock.method(syllabi, 'getContent', async () => ({ content, editable: true, status: 'draft', version: 'v1.0' }));
  t.mock.method(outcomes, 'programs', async () => [{ code: 'BSIE', name: 'Industrial Engineering' }]);
  t.mock.method(courses, 'get', async () => course);
  t.mock.method(courses, 'list', async () => [{ id: 25, code: 'MA 7', title: 'Differential Calculus' }]);
  t.mock.method(users, 'myAssignments', async () => ({ courseIds: [25], programIds: [1] }));
  t.mock.method(syllabi, 'pdfImportConfig', async () => ({ enabled: true }));
  t.mock.method(compliance, 'get', async () => ({ installed: true, run: null }));
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const button = text => [...host.querySelectorAll('button')].find(node => node.textContent.includes(text));
  try {
    await act(async () => root.render(<SyllabusBuilderV2 editing={{ syllabusId: 101 }} user={{ id: 26, role: 'faculty', firstName: 'JP', lastName: 'Test' }} notify={() => {}} setPage={() => {}} onSubmitted={() => {}} {...props} />));
    await fn({ host, button, content });
  } finally { await act(async () => root.unmount()); host.remove(); window.history.replaceState(null, '', '#'); }
}
test('the builder reopened from the URL after a refresh shows the PDF import with the kept scan, without scanning again', async t => {
  window.history.replaceState(null, '', '#builder?id=101&mode=upload&job=jabc12345678');
  let uploads = 0;
  const asked = [];
  t.mock.method(syllabi, 'importPdf', async () => { uploads++; });
  t.mock.method(syllabi, 'pdfImportJob', async job => { asked.push(job); return { state: 'done', kind: 'syllabus', file: { name: 'kept.pdf', size: 10 }, result: { fields: fullFields(), identityContext: identityContextFor(), text: 'Source', pages: [{ method: 'text' }] } }; });
  t.mock.method(syllabi, 'pdfImportJobFile', async (job, { name }) => new browser.File(['%PDF'], name, { type: 'application/pdf' }));
  await mountBuilder(t, { restore: { mode: 'upload', job: 'jabc12345678' } }, async ({ host }) => {
    await act(async () => {});
    assert.equal(host.querySelector('[role=tab][aria-selected=true]').textContent, 'Upload a file instead');
    assert.match(host.querySelector('.up-panel').textContent, /Review extracted content/);
    assert.match(host.querySelector('.up-panel').textContent, /kept\.pdf/);
    assert.deepEqual(asked, ['jabc12345678']);
    assert.equal(uploads, 0);
    assert.equal(window.location.hash, '#builder?id=101&mode=upload&job=jabc12345678', 'the URL stays on this import');
  });
});
test('the builder keeps its draft, the upload tab and the scan it starts in the URL, and drops the scan once applied', async t => {
  window.history.replaceState(null, '', '#builder');
  let resolve, job;
  t.mock.method(syllabi, 'importPdf', (id, file, options) => { job = options.job; return new Promise(done => { resolve = done; }); });
  t.mock.method(syllabi, 'saveContent', async () => ({}));
  await mountBuilder(t, {}, async ({ host, button }) => {
    assert.equal(window.location.hash, '#builder?id=101');
    await act(async () => button('Upload a file instead').click());
    assert.equal(window.location.hash, '#builder?id=101&mode=upload');
    const input = host.querySelector('input[type=file]');
    Object.defineProperty(input, 'files', { configurable: true, value: [new browser.File(['%PDF'], 'syllabus.pdf', { type: 'application/pdf' })] });
    await act(async () => input.dispatchEvent(new browser.Event('change', { bubbles: true })));
    assert.match(job, /^[A-Za-z0-9_-]{8,64}$/);
    assert.equal(window.location.hash, '#builder?id=101&mode=upload&job=' + job, 'named before the scan ends, so a refresh during it can pick it up');
    await act(async () => resolve({ fields: fullFields(), identityContext: identityContextFor(), text: 'Source', pages: [{ method: 'text' }] }));
    await act(async () => host.querySelector('.pdf-import-confirm input').click());
    await act(async () => button('Apply and submit directly').click());
    assert.equal(window.location.hash, '#builder?id=101');
  });
});
test('a builder on another screen never writes its state into the URL', async t => {
  window.history.replaceState(null, '', '#my-syllabi');
  await mountBuilder(t, {}, async () => assert.equal(window.location.hash, '#my-syllabi'));
});
