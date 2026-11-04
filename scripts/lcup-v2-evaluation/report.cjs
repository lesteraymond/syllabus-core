'use strict';
const fs=require('node:fs'),path=require('node:path'),P=require('./pipeline.cjs');
function modelInput(bundle,result,rows,dir){
 const G=require('../../server/lib/syllabuscheck/gemini'),env=P.envFor(result.modelRequested);
 const observations=rows.map(row=>{const c=bundle.cases.find(c=>c.id===row.caseId),context=bundle.contexts[c.contextId];let judgment=null;
  if(['REVIEWABLE_MODEL_JUDGMENT','INSUFFICIENT_EVIDENCE'].includes(row.status))for(const call of result.raw.filter(x=>x.caseIds.includes(c.id)&&x.file)){
   try{const raw=JSON.parse(fs.readFileSync(path.join(dir,call.file),'utf8')),answer=JSON.parse(raw.content.filter(x=>x.type==='text').map(x=>x.text).join('')),found=answer.judgements.filter(j=>j.id===c.pairId);if(found.length!==1)continue;const valid=G.validate({judgements:found},[P.pairOf(c,context)],G.contractOf(env,null,P.recommendationOf(bundle,context,env)))[0];if(valid.label===row.actualJudgment&&valid.explanation===row.explanation)judgment=found[0];}catch{ /* already reported as incomplete/invalid */ }
  }
  return {id:c.id,caseHash:c.caseHash,attempted:row.attempted,judgment};
 });
 return {version:JSON.parse(fs.readFileSync(path.join(P.root,bundle.benchmarkFile),'utf8')).version,benchmarkHash:bundle.benchmarkHash,policyVersion:bundle.policyVersion,provenance:result.provenance,runId:result.runId,model:result.modelRequested,promptVersion:result.promptVersion,...(bundle.recommendation?{recommendation:bundle.recommendation.version}:{}),...(bundle.cloClassification?{cloClassification:bundle.cloClassification.version}:{}),transcriptSha256:result.rawTranscriptHash,plannedCaseIds:bundle.scopes[result.scope],observations};
}
function report(bundle,dir){const r=JSON.parse(fs.readFileSync(path.join(dir,'results.json'),'utf8'));P.verifyBundle(bundle,r.modelRequested);if(r.preparedHash!==bundle.preparedHash||r.policyVersion!==bundle.policyVersion||(r.recommendation??null)!==(bundle.recommendation?.version??null)||(r.cloClassification??null)!==(bundle.cloClassification?.version??null)||!['controlled-Claude-evaluation','synthetic-test-only'].includes(r.provenance))throw Error('Unbound/unsupported result provenance');
 for(const raw of r.raw){if(raw.file){const file=path.resolve(dir,raw.file);if(!file.startsWith(path.resolve(dir,'raw')+path.sep))throw Error('Unsafe transcript path');if(P.hash(fs.readFileSync(file,'utf8'))!==raw.responseHash)throw Error('Raw response hash mismatch');}}
 const G=require('../../server/lib/syllabuscheck/gemini'),env=P.envFor(r.modelRequested);if(P.hash(r.raw)!==r.rawTranscriptHash||r.promptVersion!==G.promptVersionOf(r.modelRequested,env)+'-'+bundle.policyVersion+(bundle.recommendation?'-'+bundle.recommendation.version:'')+(bundle.cloClassification?'-'+bundle.cloClassification.version:''))throw Error('Transcript/prompt binding mismatch');
 const rows=r.observations.map(o=>{const c=bundle.cases.find(c=>c.id===o.id),ctx=c&&bundle.contexts[c.contextId];if(!c||o.caseHash!==c.caseHash||o.inputHash!==ctx.inputHash||o.referenceHash!==ctx.referenceHash)throw Error('Stale or unknown observation');let j=null,invalid=null;
  for(const call of r.raw.filter(x=>x.caseIds.includes(c.id)&&x.file)){try{const body=JSON.parse(fs.readFileSync(path.join(dir,call.file),'utf8')),answer=JSON.parse(body.content.filter(x=>x.type==='text').map(x=>x.text).join('')),found=answer.judgements.filter(x=>x.id===c.pairId);if(found.length!==1)throw Error('Missing or duplicate raw judgment');const validated=G.validate({judgements:found},[P.pairOf(c,ctx)],G.contractOf(env,null,P.recommendationOf(bundle,ctx,env)))[0];if(o.judgment&&validated.label===o.judgment.label&&validated.explanation===o.judgment.explanation){j=validated;invalid=null;}}catch(e){invalid=e.problems?.map(p=>p.code)||[e.code||'invalid_response'];}}if(o.judgment&&!j)invalid=invalid||['judgment_not_bound_to_raw_transcript'];
  const calls=r.raw.filter(x=>x.caseIds.includes(c.id));return {caseId:c.id,program:c.program,course:ctx.course,relationshipType:c.relationshipType,sourceKind:c.sourceKind,sourceText:c.sourceText,targetText:c.targetText,actualJudgment:j?.label||null,explanation:j?.explanation||null,sourceQuote:j?.sourceQuote||null,targetQuote:j?.targetQuote||null,evidenceVerification:j?.evidenceMatching||null,explanationReview:j?.explanationReview||[],recommendedCorrection:j?.draftReview?.length?null:j?.draft||null,recommendationReview:j?.draftReview||[],incorrectFieldIdentified:j?.responsible||j?.aspects?.responsible||null,relationshipPath:c.path,modelRequested:r.modelRequested,modelsReturned:[...new Set(calls.map(x=>x.modelReturned).filter(Boolean))],promptVersion:r.promptVersion,inputHash:o.inputHash,referenceHash:o.referenceHash,providerRequests:calls.map(x=>({request:x.request,tokenUsage:x.tokenUsage||null,latencyMs:x.latencyMs,status:x.status||null})),costAttribution:'Request-level usage/cost only; shared batch cost is not invented per relationship.',attempted:o.attempted,status:!o.attempted?'NOT_ATTEMPTED':invalid?'INVALID_RESPONSE':!j||j.unverified?'NOT_CHECKED':j.label==='INSUFFICIENT_EVIDENCE'?'INSUFFICIENT_EVIDENCE':'REVIEWABLE_MODEL_JUDGMENT',invalid,failure:o.failure,potentialFalseApproval:'UNDETERMINED_WITHOUT_INDEPENDENT_FACULTY_JUDGMENT',potentialFalseRejection:'UNDETERMINED_WITHOUT_INDEPENDENT_FACULTY_JUDGMENT',academicRecommendationAppropriate:null,facultyReviewRequired:true};});
 for(const row of rows){
  const observation=r.observations.find(o=>o.id===row.caseId),judgment=observation.judgment;
  row.sourceDocuments=bundle.cases.find(c=>c.id===row.caseId).sourceRefs;
  row.explanationReview=[...new Set([...row.explanationReview,...(judgment?.explanationReview||[])])];
  row.recommendationReview=[...new Set([...row.recommendationReview,...(judgment?.draftReview||[])])];
  if(row.recommendationReview.length)row.recommendedCorrection=null;
  if(judgment?.correction)row.correction=judgment.correction;
  if(judgment?.cloClassification)row.cloClassification=judgment.cloClassification;
  const responsible=judgment?.aspects?.values?.responsible;
  if(responsible&&!['none','not_assessed'].includes(responsible))row.incorrectFieldIdentified=responsible;
  for(const request of row.providerRequests){const raw=r.raw.find(x=>x.request===request.request);request.estimatedCost=raw.estimatedCost;request.guardCharge=raw.guardCharge;request.accounting=raw.accounting;request.sharedBatchCost=true;}
 }
 return {version:P.VERSION,policyVersion:r.policyVersion,...(bundle.recommendation?{recommendation:bundle.recommendation.version}:{}),...(bundle.cloClassification?{cloClassification:bundle.cloClassification.version}:{}),runId:r.runId,provenance:r.provenance,official:false,academicAccuracy:'NOT YET MEASURED',accuracy:null,acceptanceThreshold:null,rawTranscriptHash:r.rawTranscriptHash,stopReason:r.stopReason,priceAsOf:r.priceAsOf,pricesVerifiedCurrent:false,summary:r.summary,requestAccounting:r.raw,rows,measurementInput:modelInput(bundle,r,rows,dir),limitations:['Quote containment is not evidence relevance.','Academic correctness, false approvals/rejections and recommendation quality need independent faculty review.','Synthetic/mock runs cannot be presented as genuine Claude judgments.','This selected relationship scope is not a whole-syllabus disposition or official grade.',...(bundle.cloClassification?['Each CLO classification is LCUP\'s fixed classification for that CLO number, confirmed by the project owner; the official definitions of the four classifications are not in the repository and none was given to the model.']:[])]};
}
module.exports={report};
if(require.main===module){
 try{
  const dir=process.argv[2];
  if(!dir)throw Error('Pass a completed isolated run directory');
  // An optional second argument names the run's bundle (a recommendation bundle); without it, the frozen baseline bundle.
  const bundle=JSON.parse(fs.readFileSync(process.argv[3]?path.resolve(process.argv[3]):path.resolve(__dirname,'../../docs/lcup-v2-evaluation/prepared-final/bundle.json'),'utf8'));
  const r=report(bundle,dir);
  P.write(path.join(dir,'review-report.json'),r);
  P.write(path.join(dir,'benchmark-model-input.json'),r.measurementInput);
  const header='# Academic relationship review\n\nProvenance: '+r.provenance+'. Nonofficial relationship evaluation.\n\nACADEMIC ACCURACY: NOT YET MEASURED. Independent faculty review required.\n\n';
  // The CLO classification mark of an ILO-CLO judgement (cloClassification.js markOf), as faculty read it.
  const classified=m=>m.status==='evaluated'?m.clo+', '+m.classification+' (LCUP fixed mapping); saved label '+(m.stored.level||'none')+' ('+m.stored.status+')'+(m.otherClos?'; other CLOs named: '+m.otherClos.join(', '):'')+(m.unknownClos?'; CLOs named that the course does not have: '+m.unknownClos.join(', '):''):m.status+' ('+m.reason+')';
  const rows=r.rows.map(x=>'## '+x.caseId+' ('+x.relationshipType+')\n\nStatus: '+x.status+'; judgment: '+(x.actualJudgment||'unavailable')+'\n\n'+(x.explanation||'No verified explanation.')+'\n\nCorrection for faculty review: '+(x.recommendedCorrection||'None verified.')+'\n'+(x.correction?'\nRecommendation ('+x.correction.contract+'): '+x.correction.decision+'; field '+x.correction.field+(x.correction.path?' ('+x.correction.path+')':'')+(x.correction.withheld.length?'; draft withheld: '+x.correction.withheld.join(', '):'')+'\n\nReason given: '+(x.correction.reason||'none')+'\n':'')+(x.cloClassification?'\nCLO classification: '+classified(x.cloClassification)+'\n':''));
  fs.writeFileSync(path.join(dir,'review-report.md'),header+rows.join('\n'),{flag:'wx'});
  console.log('Wrote nonofficial faculty review report; no accuracy percentage.');
 }catch(e){console.error(e.message);process.exitCode=1;}
}
