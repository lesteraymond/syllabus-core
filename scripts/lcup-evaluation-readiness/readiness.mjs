// Inventory existing candidate relationships without invoking align/run/providers.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),root=process.cwd(),out=path.join(root,'docs/lcup-evaluation-readiness');
globalThis.fetch=()=>{throw Error('Readiness inventory forbids network/AI');};
const {pairsOf}=require('../../server/lib/syllabuscheck/gemini');
const {stageFlags}=require('../../server/lib/syllabuscheck/stages');
const config=require('../../server/node_modules/dotenv').parse(await fs.readFile(path.join(root,'server/.env')));
const flags=stageFlags(config);
const audit=JSON.parse(await fs.readFile(path.join(out,'current-pos.json'),'utf8'));
const fixtures=[];
for(const key of ['it202','ie402','cpe304'])fixtures.push(JSON.parse(await fs.readFile(path.join(root,'docs/lcup-approved-offline',`${key}.fixture.json`),'utf8')));
const results=fixtures.map(f=>{
  const pairs=pairsOf(f.content,audit.programs[f.content.meta.program].masters,[],{stageA:flags.a,stageB:flags.b,stageB4:flags.b4});
  const inventory=pairs.map(p=>{
    let status='ready_for_faculty_labeling',reason='Source/target evidence available; no expected faculty label assigned.';
    if(p.type==='CLO-PO'&&f.key==='it202'){status='blocked_reference';reason='L1/F1: PDF nine-PO numbering differs from database ten-PO numbering.';}
    else if(p.type==='CLO-PO'&&f.key==='cpe304'&&p.id.endsWith('-po12')){status='blocked_reference';reason='L2: current/baseline PO12 incomplete; full supporting wording is not yet an adopted reference.';}
    else if(p.type==='CLO-PO'&&f.key==='cpe304'&&p.id.endsWith('-po13')){status='blocked_institutional_decision';reason='L2: PO13 applicability to BSCpE needs institutional confirmation.';}
    else if(p.type==='CLO-anyPO'){status='blocked_reference';reason=f.key==='it202'?'L1: unresolved official PO list/numbering.':'L2: whole-list judgment includes incomplete PO12; BSCpE also has unresolved PO13 applicability.';}
    else if(!p.source.trim()||!p.target.trim()){status='blocked_missing_evidence';reason='Existing pair has an empty source or target; do not fabricate missing text.';}
    if(p.type.includes('EGA')&&status==='ready_for_faculty_labeling')reason='Named EGA evidence available; full attribute definitions/crosswalk remain L3 faculty/institutional questions.';
    return {...p,status,reason,expectedLabel:null};
  });
  const untagged=f.content.plan.flatMap((row,i)=>row.kind==='exam'?[]:row.ilos.filter(v=>!v.tags.length).map(v=>({week:row.week,sourcePages:f.evidence.plan[i].pages,text:v.text,tags:[],expectedTarget:null})));
  const missingIlos=f.content.plan.flatMap((row,i)=>row.kind!=='exam'&&!row.ilos.some(v=>v.text.trim())?[{week:row.week,pages:f.evidence.plan[i].pages}]:[]);
  return {key:f.key,source:f.source,candidates:inventory,untagged,missingIlos,reviewNotes:f.reviewNotes,
    counts:Object.fromEntries([...new Set(inventory.map(p=>p.type))].map(type=>[type,{total:inventory.filter(p=>p.type===type).length,ready:inventory.filter(p=>p.type===type&&p.status==='ready_for_faculty_labeling').length,blocked:inventory.filter(p=>p.type===type&&p.status!=='ready_for_faculty_labeling').length}]))};
});
const result={stageFlags:flags,method:'Production pairsOf only; no engine.run/align, no link fetch, no new stages',aiRequests:0,facultyJudgments:0,externalEvaluationAuthorized:false,
  readiness:'Conditional readiness for faculty evidence review; live AI release blocked by reference/privacy/cost/adjudication decisions',results};
await fs.writeFile(path.join(out,'academic-readiness.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(results.map(r=>({key:r.key,counts:r.counts,untagged:r.untagged.length,missingIlos:r.missingIlos})),null,2));
