'use strict';
// Read-only inventory; summaries never contain faculty answers or credentials.
const fs=require('node:fs');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const fixtures=['it202','ie402','cpe304'].map(k=>{const f=read(`docs/lcup-approved-offline/${k}.fixture.json`);return {key:k,keys:Object.keys(f),source:f.source,provenance:f.provenance,verification:f.verification,meta:f.content.meta,otherKeys:Object.fromEntries(Object.entries(f).filter(([k])=>k!=='content').map(([k,v])=>[k,Array.isArray(v)?{length:v.length,first:v[0]}:v&&typeof v==='object'?{keys:Object.keys(v),sample:Object.entries(v).slice(0,2)}:v])),clo:f.content.clos[0],row:f.content.plan[1]};});
const masters=read('docs/lcup-approved-offline/masters.json');
const canonical=read('src/data/officialProgramOutcomes.json');
const refs=read('docs/local-reference-import.json');
console.log(JSON.stringify({fixtures,masters:{keys:Object.keys(masters),programs:Object.entries(masters.programs).map(([p,x])=>({p,keys:Object.keys(x),curricula:x.masters.curricula.map(c=>({id:c.id,program:c.program,year:c.curriculumYear,status:c.status,source:c.source,courses:c.courses.slice(0,3)})),pos:x.masters.pos.length}))},canonical:{keys:Object.keys(canonical),BSIT:canonical.programs.BSIT},references:{keys:Object.keys(refs),summary:refs.summary,curricula:refs.curricula}},null,2));
