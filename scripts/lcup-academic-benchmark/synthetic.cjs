'use strict';
// Author-written stimuli; neither an approved syllabus nor a faculty answer key.
// Reuses the existing Builder-compatible V2 software fixture factory.
const {fixture}=require('../lcup-policy-v2-implementation/fixtures.cjs');
const {POLICY}=require('../../server/lib/syllabuscheck/academicV2Plan');
const domains={
 BSIT:{code:'IT 202',topic:'Java conditional statements and input validation',ilo:'Implement and test Java if/else statements for the stated input-validation rules.',activity:'Trace worked examples, then write and test Java conditional programs in pairs with annotated instructions.',task:'Submit a Java program and tests that demonstrate correct handling of the stated input conditions.',description:'Students develop, trace and test Java programs using basic programming concepts and input validation.'},
 'BSIT-CYBERSECURITY':{code:'IT-202',topic:'REST service interfaces, data contracts and integration error handling',ilo:'Integrate two supplied services using the stated data contract and verify error handling.',activity:'Inspect an annotated interface contract and implement an integration in a guided laboratory with alternative text instructions.',task:'Demonstrate the integrated services and submit tests showing contract and error handling.',description:'Students analyze interfaces and integrate software services using specified data contracts and testable system boundaries.'},
 BSIE:{code:'IE-402',topic:'System boundaries, stakeholder requirements and verification criteria',ilo:'Derive verifiable system requirements and identify interfaces for the stated engineering system.',activity:'Analyze a stakeholder case with guided diagrams and text descriptions, then construct a requirements matrix in groups.',task:'Submit a requirements matrix and defend how the stated interfaces meet stakeholder needs.',description:'Students analyze engineering systems, stakeholder requirements, system boundaries and verifiable interfaces.'},
 BSCPE:{code:'CpE-304',topic:'Sampling analog sensor signals and signal conditioning',ilo:'Measure a sensor signal and explain how conditioning and sampling affect the observed data.',activity:'Use annotated circuit diagrams and a supervised sensor laboratory to collect and interpret signal traces.',task:'Submit measured traces and a laboratory explanation of conditioning and sampling choices.',description:'Students analyze mixed-signal sensor systems through conditioning, sampling, measurement and interpretation of experimental data.'}
};
function synthetic(refs){
 const contexts=[];
 for(const [program,d] of Object.entries(domains)){
  const curriculum=refs.curricula.find(c=>c.program===program),course=curriculum.courses.find(c=>c.code===d.code);
  if(!course)throw Error('Missing designated synthetic curriculum course '+program);
  for(const variant of ['coherent-candidate','partial-scope-candidate','unrelated-content-candidate','incorrect-mapping-candidate','ambiguous-candidate','missing-evidence']){
   const f=fixture(program),sourceProgram=program==='BSIT-CYBERSECURITY'?'BSIT':program;
   delete f.masters.valueDefinitions;
   f.masters.curricula=[{...structuredClone(curriculum),id:'source-transcription-'+program}];
   f.masters.pos=structuredClone(refs.official.programs[sourceProgram].outcomes);
   f.masters.institution=structuredClone(refs.snapshot.programs.BSIT.masters.institution);
   f.content.meta={...f.content.meta,program,code:course.code,title:course.title,curriculumYear:curriculum.curriculumYear,prereq:course.prereq,lecture:String(course.lecture),lab:String(course.lab),yearLevel:String(course.yearLevel)};
   f.content.outcomes={...structuredClone(f.masters.institution),pos:structuredClone(f.masters.pos)};
   f.content.description=[{id:'synthetic-description',t:d.description}];
   const statements=[`Explain the concepts of ${d.topic}.`,d.ilo,`Demonstrate and justify a solution involving ${d.topic}.`,`Practice honest reporting and responsible teamwork while studying ${d.topic}.`];
   f.content.clos.forEach((c,i)=>Object.assign(c,{statement:statements[i],level:POLICY.classifications[i],pos:[program.startsWith('BSIT')?7:1],egas:[1]}));
   f.content.plan.forEach((r,i)=>{if(r.kind==='exam')return;Object.assign(r,{contents:i===0?`Introduction to ${course.title} and the supplied course objectives`:d.topic,activities:d.activity,tasks:d.task,values:'Courage: explain a decision and revise it after evidence-based peer feedback.'});r.ilos=[{id:`synthetic-ilo-${i}`,text:i===0?'Explain the course subject and the supplied course objectives.':d.ilo,tags:['clo:'+f.content.clos[1].id]}];});
   const row=f.content.plan[2];
   if(variant==='partial-scope-candidate'){row.contents+='; evaluate an additional complex design scenario';row.activities='Listen to a brief overview of the first concept.';row.tasks='Recall the first definition.';}
   if(variant==='unrelated-content-candidate')Object.assign(row,{contents:'Human anatomy: organs of the digestive system',ilos:[{...row.ilos[0],text:'Explain digestion in the human body.'}],activities:'Identify the stomach and intestines on an anatomy diagram.',tasks:'Complete a human anatomy examination on digestive organs.'});
   if(variant==='incorrect-mapping-candidate'){f.content.clos[0].statement='Compare the historical styles of Renaissance painting.';row.ilos[0].tags=['clo:'+f.content.clos[0].id];}
   if(variant==='ambiguous-candidate'){row.contents='Applications and professional practice';row.ilos[0].text='Analyze the appropriate approach.';row.activities='Discuss an example.';row.tasks='Present a response.';row.ilos[0].tags=['clo:'+f.content.clos[0].id,'clo:'+f.content.clos[1].id];}
   if(variant==='missing-evidence'){row.contents='';row.ilos[0].text='';row.ilos[0].tags=[];row.activities='';row.tasks='';}
   contexts.push({id:`synthetic-${program}-${variant}`,program,variant,content:f.content,masters:f.masters,sourceKind:'synthetic',domain:d});
  }
 }
 return contexts;
}
module.exports={synthetic,domains};
