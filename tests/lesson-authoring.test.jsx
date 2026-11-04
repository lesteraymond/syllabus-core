import React,{act,useState} from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import PlanStep from '../src/views/builder2/PlanStep';
import {emptyDraft,hydrateContent,blankRow,createModel,clone,SCHEMA_VERSION} from '../src/lib/syllabusModel';
import {canCreateIlo,canEditLessonField} from '../src/lib/lessonAuthoring';
import {INSTITUTION,PROGRAMS} from '../src/data/outcomesSeed';
import {setLanguage,t} from '../src/i18n';
import {saveOnce} from '../src/lib/draftSave';
const browser=new Window({url:'http://localhost:5173'});
Object.assign(globalThis,{window:browser,document:browser.document,HTMLElement:browser.HTMLElement,Event:browser.Event,MouseEvent:browser.MouseEvent,IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=await import('react-dom/client');
let counter=0;const id=()=>`lesson_${++counter}`;
const model=createModel({institution:INSTITUTION,programs:PROGRAMS,year:2026});
async function mount(seed,fn){
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let current;
 function Harness(){const [d,setD]=useState(seed),[filter,setFilter]=useState(null);current=d;return <PlanStep d={d} model={model} filter={filter} setFilter={setFilter} apply={f=>setD(d=>f(clone(d)))} onDeleteRow={()=>{}}/>;}
 await act(async()=>root.render(<Harness/>));
 const api={host,current:()=>current,button:key=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes(t(key))),
  cells:()=>[...host.querySelectorAll('tbody tr')][0].querySelectorAll('textarea'),
  cell:field=>host.querySelector(`textarea[aria-label="${t('plan.heading.'+field)+t('ui.of_week_60075b')+current.plan[0].week}"]`),
  click:async b=>{assert.ok(b);await act(async()=>b.click());},
  type:async(node,value)=>{assert.ok(node);assert.equal(node.disabled,false);await act(async()=>{Object.getOwnPropertyDescriptor(browser.HTMLTextAreaElement.prototype,'value').set.call(node,value);node.dispatchEvent(new browser.Event('input',{bubbles:true}));});},
 };
 try{await fn(api);}finally{await act(async()=>root.unmount());host.remove();}
}
for(const language of ['en','tl']){
 test(`${language}: a new lesson enforces Content → ILO → Activities → Assessment without changing columns`,async()=>{
  setLanguage(language);const d=emptyDraft(id);d.plan[0].week='1';
  await mount(d,async ui=>{
   const labels=[...ui.host.querySelectorAll('thead th')].map(n=>n.textContent);
   assert.deepEqual(labels,[t('ui.week_f82be6'),t('plan.heading.ilo'),t('plan.heading.contents'),t('plan.heading.activities'),t('plan.heading.tasks'),t('plan.heading.values')]);
   assert.ok(ui.host.textContent.includes(t('plan.contentFirst')));assert.ok(ui.host.textContent.includes(t('plan.order')));
   assert.equal(ui.current().plan[0].ilos.length,0);assert.equal(ui.button('ui.ilo_b41960').disabled,true);assert.equal(ui.cell('activities').disabled,true);assert.equal(ui.cell('tasks').disabled,true);
   await ui.click(ui.button('ui.ilo_b41960'));assert.equal(ui.current().plan[0].ilos.length,0);
   await ui.type(ui.cell('contents'),'Java conditional statements');assert.equal(ui.button('ui.ilo_b41960').disabled,false);
   await ui.click(ui.button('ui.ilo_b41960'));assert.equal(ui.current().plan[0].ilos.length,1);assert.equal(ui.cell('activities').disabled,true);
   const ilo=ui.host.querySelector('.ilo textarea');await ui.type(ilo,'Develop a Java conditional program');assert.equal(ui.cell('activities').disabled,false);assert.equal(ui.cell('tasks').disabled,true);
   await ui.type(ui.cell('activities'),'Guided programming practice');assert.equal(ui.cell('tasks').disabled,false);
   await ui.type(ui.cell('tasks'),'Write and test a conditional program');assert.equal(ui.current().plan[0].tasks,'Write and test a conditional program');
   await ui.type(ui.cell('contents'),'');
   assert.equal(ui.current().plan[0].ilos[0].text,'Develop a Java conditional program');assert.equal(ui.current().plan[0].activities,'Guided programming practice');assert.equal(ui.current().plan[0].tasks,'Write and test a conditional program');
   assert.equal(ui.host.querySelector('.ilo textarea').disabled,false);assert.equal(ui.cell('activities').disabled,false);assert.equal(ui.cell('tasks').disabled,false);assert.equal(ui.button('ui.ilo_b41960').disabled,true);
  });
 });
 test(`${language}: legacy drafts remain editable; newly added rows adopt the order; exams and duplication preserve source text`,async()=>{
  setLanguage(language);const d=emptyDraft(id);d.plan=[{id:id(),week:'1',kind:'lesson',contents:'',activities:'',tasks:'',values:'',ilos:[{id:id(),text:'Existing ILO',tags:[]}]}];
  const before=clone(d);
  await mount(d,async ui=>{
   assert.equal(ui.host.querySelector('.ilo textarea').disabled,false);assert.equal(ui.button('ui.ilo_b41960').disabled,false);assert.equal(ui.cell('activities').disabled,false);assert.equal(ui.cell('tasks').disabled,false);assert.deepEqual(ui.current(),before);
   await ui.click(ui.button('ui.add_week_3a833d'));assert.equal(ui.current().plan[1].authoringOrder,1);assert.deepEqual(ui.current().plan[1].ilos,[]);
   await ui.click(ui.button('ui.add_exam_row_19d3c0'));const exam=ui.current().plan[2];assert.equal(exam.kind,'exam');assert.equal(canCreateIlo(exam),true);assert.equal(canEditLessonField(exam,'tasks'),true);
   const duplicate=ui.host.querySelector(`button[aria-label="${t('ui.duplicate_row_d66d5f')}"]`);await ui.click(duplicate);
   const copy=ui.current().plan[1];assert.equal(copy.authoringOrder,1);assert.equal(copy.ilos[0].text,'Existing ILO');assert.deepEqual(copy.ilos[0].tags,[]);assert.equal(copy.week,'');assert.notEqual(copy.id,before.plan[0].id);
  });
 });
}
test('autosave JSON and reopen retain new-row policy and all faculty text; hydration never marks a legacy row',async()=>{
 setLanguage('en');const d=emptyDraft(id);d.meta.courseId=123;d.plan[0].week='3-4';d.plan[0].contents='Signals';d.plan[0].ilos=[{id:id(),text:'Analyze a signal',tags:['clo:c1','po:2']}];d.plan[0].activities='Analyze examples';d.plan[0].tasks='Explain signal features';
 const before=clone(d);let stored;
 const api={createDraft:async()=>({id:1}),saveContent:async(syllabusId,body)=>{assert.equal(syllabusId,1);stored=JSON.parse(JSON.stringify(body));}};
 assert.equal(await saveOnce({api,d,idRef:{current:null},saved:{current:{}},sections:['meta','plan'],schemaVersion:SCHEMA_VERSION}),'saved');
 const reopened=hydrateContent(stored,id);assert.deepEqual(reopened.plan,d.plan);assert.deepEqual(d,before);
 await mount(reopened,async ui=>{assert.equal(ui.current().plan[0].authoringOrder,1);assert.equal(ui.cell('activities').disabled,false);assert.equal(ui.cell('tasks').disabled,false);});
 const legacy=clone(stored);delete legacy.plan[0].authoringOrder;assert.equal(hydrateContent(legacy,id).plan[0].authoringOrder,undefined);
});
test('new-row dependency policy recognises empty markup and exempts examination rows',()=>{
 const row=blankRow(id);row.contents='** **';assert.equal(canCreateIlo(row),false);row.contents='Topic';assert.equal(canCreateIlo(row),true);
 assert.equal(canEditLessonField(row,'activities'),false);row.ilos.push({id:id(),text:'Explain the topic',tags:[]});assert.equal(canEditLessonField(row,'activities'),true);assert.equal(canEditLessonField(row,'tasks'),false);
 row.activities='Discuss topic';assert.equal(canEditLessonField(row,'tasks'),true);
 const exam=blankRow(id,'exam');assert.equal(exam.ilos.length,1);assert.equal(canEditLessonField(exam,'tasks'),true);
});
