'use strict';
// Read-only references and locators. No DB connection, PDF extraction or seeding.
const fs=require('node:fs'),path=require('node:path');
const {sameBasis}=require('../../server/lib/programPoReferences');
const {coded}=require('../../server/lib/syllabuscheck/engine');
const root=path.resolve(__dirname,'../..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
// Source checks digest raw bytes, never normalized text.
const sha=bytes=>require('node:crypto').createHash('sha256').update(bytes).digest('hex');
const fileRef=file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))});
function locateSource(source){
 const candidates=[source.file,'reference-data/'+path.basename(source.file)];
 const file=candidates.find(f=>fs.existsSync(path.join(root,f))&&fileRef(f).sha256===source.sha256);
 if(!file)throw Error('No byte-identical source for '+source.file);
 return {...source,declaredFile:source.file,file,relocated:file!==source.file};
}
function references(){
 const official=read('src/data/officialProgramOutcomes.json'),snapshot=read('docs/lcup-approved-offline/masters.json');
 const seed=require('../../server/db/local-curriculum-data.cjs'),imported=read('docs/local-reference-import.json');
 const curricula=seed.programs.map(p=>({program:p.code,curriculumYear:p.curriculumYear,status:'approved',source:'Existing verified transcription; no new approval or database activation',files:p.files.map(name=>{
  const file='docs/academic-references/'+name,ref=fileRef(file);if(ref.sha256!==imported.sourceSha256[name])throw Error('Curriculum image hash drift: '+name);return ref;
 }),courses:p.terms.flatMap(t=>t.rows)}));
 const poSources=Object.entries(official.programs).filter(([,p])=>p.sourceFile).map(([program,p])=>{const ref=fileRef(p.sourceFile);if(ref.sha256!==p.sha256)throw Error('Official PO source hash drift: '+program);return {program,...ref,count:p.outcomes.length,numbering:p.outcomes.map(o=>o.no),po12:p.outcomes.find(o=>o.no===12)||null};});
 const real=['it202','ie402','cpe304'].map(key=>{
  const file=`docs/lcup-approved-offline/${key}.fixture.json`,fixture=read(file),source=locateSource(fixture.source),program=fixture.content.meta.program;
  const masters=snapshot.programs[program].masters,designated=official.programs[program].outcomes,part=coded(fixture.content,masters);
  const current=curricula.find(c=>c.program===program),row=current.courses.find(c=>require('../../server/lib/syllabuscheck/identity').normCode(c.code)===require('../../server/lib/syllabuscheck/identity').normCode(fixture.content.meta.code));
  const matches=fixture.content.outcomes.pos.map(p=>({no:p.no,authoredText:p.text,officialText:designated.find(o=>o.no===p.no)?.text||null,equalText:p.text===designated.find(o=>o.no===p.no)?.text}));
  return {key,fixture,file,fileHash:fileRef(file).sha256,source,masters,readiness:{program,fixture:file,source,expectedPOs:designated.length,frozenMasterPOs:masters.pos.length,authoredPOs:fixture.content.outcomes.pos.length,authoredBasisMatchesOfficial:sameBasis(fixture.content.outcomes.pos,designated),frozenMasterMatchesOfficial:sameBasis(masters.pos,designated),poComparison:matches,curriculumYearStated:fixture.content.meta.curriculumYear||null,availableCurriculumYear:current.curriculumYear,courseAsAuthored:{code:fixture.content.meta.code,title:fixture.content.meta.title},curriculumCourse:row||null,productionIdentity:part.identity,codedCurriculumFindings:part.checks.filter(c=>c.ruleId.startsWith('CUR-')),reviewNotes:fixture.reviewNotes}};
 });
 return {official,snapshot,curricula,poSources,real,valueDefinitions:read('server/config/marian-values.json')};
}
module.exports={root,read,sha,fileRef,locateSource,references};
