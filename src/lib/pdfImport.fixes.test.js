import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { mapPdfFields, preparePdfImport } from './pdfImport.js';
import { importIdentity, titleMatches } from './pdfImportReview.js';
const require = createRequire(import.meta.url);
const { extractPdf } = require('../../server/lib/pdfImport');
const read = async file => JSON.parse(await fs.readFile(new URL(`../../docs/lcup-approved-offline/${file}`, import.meta.url)));
const base = () => ({ meta: { courseId: 25, code: 'IT 202', title: 'Computer Programming 1', program: 'BSIT', prereq: 'Existing' }, outcomes: { vision: '', mission: { lead: '', items: [] }, egas: [1,2,3,4].map(no=>({no,name:`EGA${no}`,short:`EGA${no}`})), pos: Array.from({length:13},(_,i)=>({no:i+1,text:`PO${i+1}`,short:`PO${i+1}`,egas:[]})) } });
const context = d => ({ selected: { id:d.meta.courseId,code:d.meta.code,title:d.meta.title,program:d.meta.program }, curricula:[{program:d.meta.program,status:'approved',curriculumYear:'2022-2023',courses:[{code:d.meta.code,title:d.meta.title}]}] });
const fields = () => ({ code:'IT 202',title:'Computer Programming 1',clos:'CLO1: First [PO1] [EGA1]\nCLO2: Second [PO2] [EGA2]\nCLO3: Third [PO3] [EGA3]' });
const map = (f=fields(),d=base(),options={}) => {let n=0;return mapPdfFields(f,d,()=>`fix_${++n}`,options);};
const apply = (f,d,options={}) => {let n=0;return preparePdfImport(f,d,()=>`fix_${++n}`,{identityContext:context(d),...options});};
test('all repeated PO/EGA labels and inclusive ranges survive, without duplicate links',()=>{
  const f=fields(); f.clos='CLO1: Source text [PO 1-3, PO3, PO6. PO7, PO 9–11] [EGA1-3, EGA4]';
  assert.deepEqual(map(f).content.clos[0].pos,[1,2,3,6,7,9,10,11]);
  assert.deepEqual(map(f).content.clos[0].egas,[1,2,3,4]);
});
test('unknown or descending source mappings remain reviewable and cannot be silently applied',()=>{
  for(const mapping of ['[PO 14]','[PO 5-3]','[PO0]','[PO1-]']){
    const f=fields();f.clos=`CLO1: Source text ${mapping}`;
    const r=map(f);assert.equal(r.unresolvedMappings.length,1);assert.match(r.unresolvedMappings[0].source,/Source text/);
    assert.throws(()=>apply(f,base()),/unresolvedMappings/);
  }
});
test('unpunctuated and inline ILOs, unlabelled prefixes/suffixes and CLO ranges remain distinct',()=>{
  const f=fields(), d=base();
  const row={week:'1',ilo:'Unlabelled prefix.\nILO 1 First [CLO1-3]\nUnlabelled suffix. ILO2: Second [CLO2] LO3. Third without tag.',contents:'Lesson',activities:'',tasks:'',values:''};
  const r=map(f,d,{planRows:[row]}),ilos=r.content.plan[0].ilos;
  assert.equal(ilos.length,5);
  assert.deepEqual(ilos.map(i=>i.tags.length),[0,3,0,1,0]);
  assert.equal(ilos[2].text,'Unlabelled suffix.');
  assert.ok(r.warnings.some(w=>w.key==='pdfImport.iloMappingReview'));
  assert.equal(ilos[1].text,'ILO 1 First');
});
test('prerequisite conflicts require a value-bound keep or replace decision in Apply',()=>{
  const d=base(),f={...fields(),prereq:'PDF prerequisite'},before=structuredClone(d);
  assert.throws(()=>apply(f,d),/prereqReviewRequired/);
  const choice={existing:'Existing',imported:'PDF prerequisite'};
  assert.equal(apply(f,d,{prerequisiteChoice:{...choice,action:'keep'}}).content.meta.prereq,'Existing');
  assert.equal(apply(f,d,{prerequisiteChoice:{...choice,action:'replace'}}).content.meta.prereq,'PDF prerequisite');
  assert.throws(()=>apply({...f,prereq:'Edited PDF prerequisite'},d,{prerequisiteChoice:{...choice,action:'replace'}}),/prereqReviewRequired/);
  assert.deepEqual(d,before);
  d.meta.prereq='';assert.equal(apply(f,d).content.meta.prereq,'PDF prerequisite');
  assert.equal(apply({...f,prereq:''},before).content.meta.prereq,'Existing');
});
test('Apply requires code/title and server context matching selected program and curriculum year',()=>{
  const d=base(),f=fields();
  assert.throws(()=>apply(f,d,{identityContext:null}),/selectMatchingSubject/);
  for(const change of [{code:''},{title:''},{title:'Another course'},{program:'BSIT-CYBERSECURITY'}])assert.throws(()=>apply({...f,...change},d),/selectMatchingSubject/);
  const c=context(d);c.selected.program='BSIT-CYBERSECURITY';assert.throws(()=>apply(f,d,{identityContext:c}),/selectMatchingSubject/);
  d.meta.curriculumYear='2025-2026';assert.throws(()=>apply(f,d),/selectMatchingSubject/);
  d.meta.curriculumYear='';c.selected.program='BSIT';c.curricula.push({...c.curricula[0],curriculumYear:'2023-2024'});
  assert.throws(()=>apply(f,d,{identityContext:c}),/selectMatchingSubject/);
});
test('Cyber IT-202 cannot import BSIT IT202; approved unique punctuation variants remain usable',()=>{
  const d=base();Object.assign(d.meta,{program:'BSIT-CYBERSECURITY',code:'IT-202',title:'SYSTEM INTEGRATION AND ARCHITECTURE 1'});
  assert.throws(()=>apply(fields(),d),/selectMatchingSubject/);
  Object.assign(d.meta,{program:'BSCPE',code:'CpE-304',title:'FUNDAMENTALS OF MIXED SIGNALS AND SENSORS'});
  assert.equal(apply({...fields(),code:'CpE 304',title:'Fundamentals of Mixed Signals and Sensors'},d).mismatch,false);
});
for(const key of ['it202','ie402','cpe304'])test(`${key}: real worker preview and Apply preserve verified CLO/PO/EGA/ILO information`,async t=>{
  const fixture=await read(`${key}.fixture.json`),snapshot=await read('masters.json');
  const master=snapshot.programs[fixture.content.meta.program].masters;
  const course=master.curricula[0].courses.find(c=>c.code.toUpperCase().replace(/[^A-Z0-9]/g,'')===fixture.content.meta.code.toUpperCase().replace(/[^A-Z0-9]/g,''));
  const d=structuredClone(fixture.content);Object.assign(d.meta,{courseId:25,code:course.code,title:course.title});
  // The approved source PDFs are kept local-only and may be absent from a checkout: skip, and say so, rather than fail.
  let bytes;
  try { bytes=await fs.readFile(new URL(`../../${fixture.source.file}`,import.meta.url)); }
  catch(error){ if(error.code==='ENOENT'){ t.skip(`source PDF not in this checkout: ${fixture.source.file}`); return; } throw error; }
  const preview=await extractPdf(bytes);
  const options={planRows:preview.layout.planRows,identityContext:{selected:{id:25,program:d.meta.program,code:course.code,title:course.title},curricula:master.curricula}};
  const unchanged=structuredClone(d);
  const result=apply(preview.fields,d,options),c=result.content,expected=fixture.content;
  assert.deepEqual(d,unchanged);
  assert.equal(result.mismatch,false);assert.equal(result.unresolvedMappings.length,0);
  assert.deepEqual(c.clos.map(c=>c.pos),expected.clos.map(c=>c.pos));
  assert.deepEqual(c.clos.map(c=>c.egas),expected.clos.map(c=>c.egas));
  assert.deepEqual(c.clos.map(c=>c.statement.replace(/\s/g,'')),expected.clos.map(c=>c.statement.replace(/\s/g,'')));
  assert.deepEqual(c.outcomes.pos.map(p=>p.text.replace(/\s/g,'')),expected.outcomes.pos.map(p=>p.text.replace(/\s/g,'')));
  assert.deepEqual(c.outcomes.egas.map(e=>e.name.replace(/\s/g,'')),expected.outcomes.egas.map(e=>e.name.replace(/\s/g,'')));
  assert.equal(c.outcomes.vision,expected.outcomes.vision);
  assert.deepEqual(c.outcomes.mission,expected.outcomes.mission);
  assert.equal(Object.values(c.refs).flatMap(g=>g.items.map(i=>i.t)).join('').replace(/\s/g,''),fixture.evidence.references.map(g=>g.raw).join('').replace(/\s/g,''));
  assert.equal(c.meta.prereq,expected.meta.prereq);
  assert.equal(c.description.map(p=>p.t).join('').replace(/\s/g,''),expected.description.map(p=>p.t).join('').replace(/\s/g,''));
  assert.deepEqual(c.plan.map(r=>r.week),expected.plan.map(r=>r.week));
  const sourceNumber = (tag,clos) => clos.findIndex(c=>`clo:${c.id}`===tag)+1;
  for(let i=0;i<c.plan.length;i++){
    const actual=c.plan[i],verified=expected.plan[i];
    assert.equal(actual.kind,verified.kind);
    assert.deepEqual(actual.ilos.filter(i=>i.text.trim() || i.tags.length).map(i=>i.tags.map(t=>sourceNumber(t,c.clos))),verified.ilos.map(i=>i.tags.map(t=>sourceNumber(t,expected.clos))));
    const prose = s => s.replace(/[[(]\s*CLO[\d\s,;.\-–CLO]*[)\]]/gi,'').replace(/\bCLO\s*\d+(?:\s*[-–,;.]\s*\d+)*/gi,'').replace(/[()[\]\s]/g,'');
    assert.equal(prose(actual.ilos.map(i=>i.text).join('')),prose(verified.ilos.map(i=>i.text).join('')));
    for(const name of ['contents','activities','tasks','values'])assert.equal(actual[name].replace(/\s/g,''),verified[name].replace(/\s/g,''));
  }
});
test('a subject code spelled with a space matches the curriculum spelling with a hyphen',()=>{
  const d=base();d.meta={...d.meta,code:'IT 204',title:'Computer Programming 2 (Intermediate Programming)'};
  const c=context(d);c.curricula[0].courses=[{code:'IT-204',title:'COMPUTER PROGRAMMING 2(INTERMEDIATE PROGRAMMING)'}];
  const f={...fields(),code:'IT 204',title:'Computer Programming 2'};
  assert.doesNotThrow(()=>apply(f,d,{identityContext:c}));
  const other=context(d);other.curricula[0].courses=[{code:'IT-205',title:'COMPUTER PROGRAMMING 2(INTERMEDIATE PROGRAMMING)'}];
  assert.throws(()=>apply(f,d,{identityContext:other}),/selectMatchingSubject/);
});
test('course titles match across "&"/"and", roman/arabic numerals and an optional trailing note, but not two different notes', () => {
  for (const [a, b] of [['Data Structures & Algorithms', 'DATA STRUCTURES AND ALGORITHMS'], ['Physics II', 'Physics 2'], ['Computer Programming 2', 'COMPUTER PROGRAMMING II (INTERMEDIATE PROGRAMMING)'], ['Physics 1 (Lecture)', 'Physics I']])
    assert.equal(titleMatches(a, b), true, `${a} = ${b}`);
  for (const [a, b] of [['Physics (Lecture)', 'Physics (Laboratory)'], ['Physics 2', 'Physics 3'], ['', '']])
    assert.equal(titleMatches(a, b), false, `${a} != ${b}`);
});

test('a PDF is matched with the administrator\'s subject of any curriculum year, one with nothing on file included', () => {
  const selected = { id: 25, program: 'BSAI', code: 'AI-201', title: 'Machine Learning 1' };
  const context = { selected, curricula: [{ id: 'subject:25', origin: 'admin', program: 'BSAI', curriculumYear: '2031-2032', status: 'approved', courses: [{ code: 'AI-201', title: 'Machine Learning 1' }] }] };
  const meta = { courseId: 25, program: 'BSAI', code: 'AI-201', title: 'Machine Learning 1', curriculumYear: '2022-2023' };
  const found = importIdentity({ code: 'AI 201', title: 'Machine Learning 1' }, meta, context, true);
  assert.equal(found.ok, true); assert.equal(found.curriculumYear, '2031-2032');
  context.curricula[0].curriculumYear = null;
  assert.equal(importIdentity({ code: 'AI 201', title: 'Machine Learning 1' }, meta, context, true).curriculumYear, '2022-2023', 'a subject without a curriculum year leaves the draft\'s');
  assert.equal(importIdentity({ code: 'AI 999', title: 'Machine Learning 1' }, meta, context, true).ok, false, 'another code is still refused');
});
