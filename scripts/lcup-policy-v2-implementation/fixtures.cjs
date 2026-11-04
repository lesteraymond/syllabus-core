'use strict';
// Synthetic software-test data only. No faculty judgment or new official source.
const {sample}=require('../../server/lib/syllabuscheck/fixtures');
const {plan,POLICY}=require('../../server/lib/syllabuscheck/academicPolicyV2');
const {isNoRewrite,aspectKeysFor}=require('../../server/lib/syllabuscheck/gemini');
const {VALUE_NAMES}=require('../../server/lib/syllabuscheck/values');
const fit=require('../../server/lib/syllabuscheck/lessonfit');
const official=require('../../src/data/officialProgramOutcomes.json');
function fixture(program='BSIT'){
 const {content,masters}=sample();
 content.meta.program=program;
 masters.pos=structuredClone(official.programs[program==='BSIT-CYBERSECURITY'?'BSIT':program].outcomes);
 masters.outcomeSource=program==='BSIT-CYBERSECURITY'?'BSIT':null;
 masters.valueDefinitions={status:'configured',version:'synthetic-reference-for-software-tests',source:'Not an institutional approval; isolated mock reference',definitions:Object.fromEntries(VALUE_NAMES.map(name=>[name,`${name}: synthetic value-definition context for software tests.`]))};
 masters.curricula[0].program=program;masters.curricula[0].curriculumYear=program==='BSIT-CYBERSECURITY'?'2025-2026':'test-2026';content.meta.curriculumYear=masters.curricula[0].curriculumYear;
 content.outcomes={...structuredClone(masters.institution),pos:structuredClone(masters.pos)};
 content.description=[{id:'d',t:'This course introduces object-oriented programming concepts and develops practical skills through Java. Students explain classes and methods, implement reusable components, test program behavior and develop applications. They analyze requirements and evaluate solutions through guided practice, collaborative programming and individual projects. Ethical teamwork, attribution and responsible use of computing resources support the technical objectives of the course through varied learning and assessment activities.'}];
 content.clos.forEach((c,i)=>{c.level=POLICY.classifications[i];c.statement=['Explain object-oriented programming concepts.','Implement and test Java methods.','Develop and evaluate a Java application.','Demonstrate honesty and responsible teamwork in programming.'][i];c.pos=[1];c.egas=[1];});
 content.plan.forEach((r,i)=>{if(r.kind==='exam')return;r.contents=i===0?'Introduction to Computer Programming 2 and course objectives':'Java classes, methods and object-oriented programming';r.ilos[0].text='Implement and test Java methods.';r.activities='Guided examples, annotated explanations and programming practice.';r.tasks='Implement and test the stated Java method, then explain the results.';r.values='Courage: explain a programming decision and revise it after feedback.';});
 content.refs={books:{na:false,items:[{id:'b1',t:'Doe, J. (2025). Java programming. Academic Press.'},{id:'b2',t:'Lee, K. (2025). Object-oriented design. Academic Press.'}]},program:{na:false,items:[{id:'p1',t:'Smith, A. (2025). Computing foundations. Academic Press.'}]},online:{na:false,items:[{id:'o1',t:'Doe, J. (2025). Java methods. Example. https://example.org/java'}]},electronics:{na:true,items:[]}};
 return {content,masters};
}
function replay(content,masters,decide=()=>({}),extra={}){
 const context=plan(content,masters),pairs=[...context.pairs,...fit.assessmentPairs(content,context.rows.map(r=>r.i))];
 const keys=aspectKeysFor({c1:true,c2:true,d1:true,d2:true});
 const judgements=pairs.map(p=>{
  const override=decide(p)||{},label=override.label||'ALIGNED';
  const fields=Object.fromEntries(keys.map(key=>[key,'not_assessed']));
  Object.assign(fields,({'Activity-fit':{teaching:'sound',learnerSupport:'adequate',responsible:'none'},'Assessment-fit':{measures:'yes',evidence:'observable',level:'matches',responsible:'none'},'Value-use':{valueUse:'integrated',carriedBy:'content',valueFit:'fits',responsible:'none'},'Ref-relevance':{relevance:'relevant',basis:'title_and_venue'}}[p.type]||{}));
  const noRewrite=isNoRewrite(p.type),recommendation=label==='ALIGNED'?'NO_CHANGE':noRewrite?'REVIEW_REQUIRED':'REWRITE_TEXT';
  return {id:p.id,label,explanation:label==='ALIGNED'?'Scripted evidence supports this relationship.':'Scripted academic mismatch in the supplied competence or subject.',sourceQuote:p.source.slice(0,18),targetQuote:p.target.slice(0,18),sourceBloom:'N/A',targetBloom:'N/A',recommendation,draft:label==='ALIGNED'?'':noRewrite?'Review this relationship against the supplied source with faculty.':'Revise the stated performance for the supplied subject.',...fields,...override};
 });
 return {policyVersion:POLICY.id,inputHash:context.inputHash,referenceHash:context.referenceHash,judgements,...extra};
}
module.exports={fixture,replay,POLICY};
