import React,{act} from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Window} from 'happy-dom';
import AcademicEvaluationPanel from '../../src/components/AcademicEvaluationPanel';
import VerdictPanel from '../../src/components/VerdictPanel';
import HybridCheckPanel from '../../src/components/HybridCheckPanel';
import ComplianceCard from '../../src/views/ComplianceCard';
import {academicV2En,academicV2Tl} from '../../src/i18n/academicV2';
import {setLanguage,t} from '../../src/i18n';
const browser=new Window({url:'http://localhost:5173'});
Object.assign(globalThis,{window:browser,document:browser.document,HTMLElement:browser.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=await import('react-dom/client');
const report=JSON.parse(fs.readFileSync('tmp/lcup-policy-v2-implementation/report.json'));
let calls=[];
globalThis.fetch=async url=>{calls.push(String(url));assert.ok(String(url).endsWith('/syllabus-check/status'));return {ok:true,json:async()=>({aiGate:'required'})};};
async function render(Component,run,fn,props={}){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>root.render(<Component run={run} {...props}/>));try{await fn(host);}finally{await act(async()=>root.unmount());host.remove();}}
for(const lang of ['en','tl']){
 test(`${lang}: compliance 100 cannot hide academic revision in faculty/admin views`,async()=>{
  setLanguage(lang);
  for(const Component of [AcademicEvaluationPanel,VerdictPanel,ComplianceCard])await render(Component,report,host=>{
   assert.equal(host.querySelector('output').textContent,'100');
   assert.ok(host.textContent.includes(t('academicV2.status.REQUIRES_REVISION')));
   assert.ok(host.textContent.includes(t('academicV2.noAcademicScore')));
   assert.ok(host.textContent.includes(t('academicV2.preview')));
   assert.ok(host.textContent.includes(t('academicV2.noApproval')));
   assert.ok(host.textContent.includes('Human Anatomy'));
   assert.ok(host.querySelector('[data-policy="'+report.evaluationPolicy.id+'"]'));
   assert.equal(host.querySelectorAll('button').length,0);
   assert.equal(host.querySelector('.big-ring'),null);
  });
 });
 test(`${lang}: unavailable evidence is displayed without academic approval; reference limitations are visible`,async()=>{
  setLanguage(lang);const copy=structuredClone(report);copy.academic.disposition='NOT_EVALUATED';copy.academic.references.valueDefinitions.status='pending_approval';copy.academic.references.issues=[{code:'po_reference_unavailable'}];
  await render(AcademicEvaluationPanel,copy,host=>{
   for(const key of ['academicV2.status.NOT_EVALUATED','academicV2.valueApproval','academicV2.reference.po_reference_unavailable','academicV2.scope','academicV2.diagnostics'])assert.ok(host.textContent.includes(t(key)),key);
  });
 });
}
test('V2 never opens legacy decision/refinement UI or calls its API',async()=>{
 calls=[];await render(HybridCheckPanel,{...report,runId:777},host=>assert.equal(host.textContent,''));assert.equal(calls.length,0);
});
test('historical saved report remains on the legacy view with its original score',async()=>{
 setLanguage('en');const old=JSON.parse(fs.readFileSync('docs/sample-misaligned-report.json'));const before=JSON.stringify(old);
 await render(ComplianceCard,old,host=>{assert.equal(host.querySelector('[data-policy]'),null);assert.ok(host.querySelector('.cmp'));assert.ok(host.querySelector('.cmp-ring'));assert.equal(old.overall,99);});assert.equal(JSON.stringify(old),before);
});
test('Policy V2 renders interactive action controls when onApplyDraft is provided',async()=>{
 setLanguage('en');
 const actionable = structuredClone(report);
 const s = { id: 'review:row2-content', path: 'plan[2].contents', replacement: 'Proposed anatomy content', originalValue: 'Old anatomy content', source: 'ai', canRefine: true };
 actionable.academic.suggestions = [s];
 let applied = null;
 const onApplyDraft = async (patch) => { applied = patch; return true; };
 await render(AcademicEvaluationPanel, actionable, async (host) => {
  const buttons = host.querySelectorAll('button');
  assert.ok(buttons.length >= 3, 'Buttons for Accept, Edit, and Reject must be rendered');
  const acceptBtn = Array.from(buttons).find(b => b.textContent.includes('Accept'));
  assert.ok(acceptBtn);
  assert.equal(acceptBtn.disabled, true, 'Accept button must be disabled before verification');
  const refineBtn = Array.from(buttons).find(b => b.textContent.includes('Check & improve'));
  assert.ok(refineBtn);
  assert.equal(refineBtn.disabled, false, 'Check & improve button must be enabled');
  const rejectBtn = Array.from(buttons).find(b => b.textContent.includes('Reject'));
  assert.ok(rejectBtn);
  assert.equal(rejectBtn.disabled, false, 'Reject button must be enabled without verification');
  const textarea = host.querySelector('textarea');
  assert.ok(textarea, 'Textarea for editing must be rendered');
  assert.equal(textarea.value, 'Proposed anatomy content');
 }, { onApplyDraft });
});
test('all V2 interface keys have distinct English and Filipino translations',()=>{
 assert.deepEqual(Object.keys(academicV2En).sort(),Object.keys(academicV2Tl).sort());
 for(const [key,text] of Object.entries(academicV2En)){assert.ok(academicV2Tl[key]);assert.notEqual(academicV2Tl[key],text,key);}
});
