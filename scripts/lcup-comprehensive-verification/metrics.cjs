'use strict';
// Descriptive measurement extension around the existing guarded offline adapter.
// No judgment generation, policy evaluation, weights, provider or DB access.
const {measure}=require('../lcup-academic-benchmark/measure.cjs');
const LABELS=['ALIGNED','PARTIALLY_ALIGNED','NOT_ALIGNED','INSUFFICIENT_EVIDENCE'];
const rate=(n,d)=>d?n/d:null;
function fullMetrics(dataset,adjudication,model,options={}){
 const base=measure(dataset,adjudication,model,options),excluded=new Set(base.exclusions.map(e=>e.id)),refused=new Set(base.refused.map(e=>e.id)),planned=new Set(model.plannedCaseIds),byCase=new Map(dataset.cases.map(c=>[c.id,c])),byObservation=new Map(model.observations.map(o=>[o.id,o]));
 const eligible=adjudication.adjudications.filter(a=>a.reviewStatus==='adjudicated'&&!excluded.has(a.id)&&planned.has(a.id));
 if(eligible.length!==base.academic.inScopeFacultyLabelled)throw Error('Metric adapter eligibility differs from the existing validator');
 function score(items){
  const confusion=Object.fromEntries(LABELS.map(a=>[a,Object.fromEntries(LABELS.map(b=>[b,0]))])),coverage={facultyCases:items.length,validSingleLabel:0,ambiguous:0,notChecked:0};
  for(const a of items){const o=byObservation.get(a.id);if(!o?.attempted||!o.judgment||refused.has(a.id)){coverage.notChecked++;continue;}if(a.ambiguous||a.acceptedJudgments.length!==1){coverage.ambiguous++;continue;}const expected=a.acceptedJudgments[0],actual=o.judgment.label;if(!LABELS.includes(actual)){coverage.notChecked++;continue;}confusion[expected][actual]++;coverage.validSingleLabel++;}
  const perClass={};for(const label of LABELS){const tp=confusion[label][label],fp=LABELS.reduce((n,k)=>n+(k===label?0:confusion[k][label]),0),fn=LABELS.reduce((n,k)=>n+(k===label?0:confusion[label][k]),0);perClass[label]={tp,fp,fn,support:tp+fn,predicted:tp+fp,precision:rate(tp,tp+fp),recall:rate(tp,tp+fn),f1:rate(2*tp,2*tp+fp+fn)};}
  return {positiveConvention:'ALIGNED means approval; other classes are reported independently',confusion,perClass,coverage,accuracy:rate(LABELS.reduce((n,l)=>n+confusion[l][l],0),coverage.validSingleLabel),incompleteEvaluationRate:rate(coverage.notChecked,coverage.facultyCases)};
 }
 return {...base,classification:score(eligible),classificationByRelationship:Object.fromEntries(require('../../src/data/academicPolicyV2.json').weeklyTypes.map(type=>[type,score(eligible.filter(a=>byCase.get(a.id).relationshipType===type))])),classificationByProgram:Object.fromEntries(['BSIT','BSIT-CYBERSECURITY','BSIE','BSCPE'].map(p=>[p,score(eligible.filter(a=>byCase.get(a.id).program===p))])),recommendationAcceptanceRate:base.recommendations.Claude.appropriateShare,recommendationAcceptanceDefinition:'Independent bound faculty appropriateness ratings, not UI clicks or automatic application',academicAccuracyStatus:base.academic.inScopeFacultyLabelled&&base.operations.verified&&!options.testOnly?'MEASURED_ONLY_ON_SUPPLIED_REVIEWED_SCOPE':'NOT YET MEASURED'};
}
module.exports={fullMetrics,LABELS};
