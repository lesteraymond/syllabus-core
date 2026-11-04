'use strict';
// Thin offline measurement adapter. No checker, provider, DB or official score.
const fs=require('node:fs');
const {scoreEval}=require('../../server/lib/syllabuscheck/eval/metrics');
const {qualityOf}=require('../../server/lib/syllabuscheck/eval/qualityMetrics');
const {createTracker}=require('../../server/lib/syllabuscheck/eval/evalMetrics');
const {validate,contractOf,evidenceQuote}=require('../../server/lib/syllabuscheck/gemini');
const {plan,POLICY}=require('../../server/lib/syllabuscheck/academicV2Plan');
const {replayOptions}=require('../../server/lib/syllabuscheck/academicV2Replay');
const LABELS=['ALIGNED','PARTIALLY_ALIGNED','NOT_ALIGNED','INSUFFICIENT_EVIDENCE'];
const ratio=(n,d)=>d?n/d:null;
function bound(dataset,input){if(input.version!==dataset.version||input.benchmarkHash!==dataset.benchmarkHash)throw Error('Stale or mismatched benchmark input');}
function measure(dataset,adjudication,model,{testOnly=false,recommendationReviews=[],proposals=[],evidenceReviews=[]}={}){
 const {benchmarkHash,...body}=dataset;if(require('../../server/lib/syllabuscheck/academicV2Plan').hash(body)!==benchmarkHash)throw Error('Benchmark content hash mismatch');
 bound(dataset,adjudication);bound(dataset,model);
 if(!Array.isArray(adjudication.adjudications)||!Array.isArray(model.observations)||!Array.isArray(model.plannedCaseIds))throw Error('Expected adjudications, plannedCaseIds and observations arrays');
 if(model.policyVersion!==POLICY.id)throw Error('Wrong model-result policy version');
 if(!testOnly&&(model.provenance==='synthetic-test-only'||adjudication.provenance==='synthetic-test-only'))throw Error('Synthetic labels cannot be reported as faculty accuracy');
 if(!testOnly&&model.observations.length&&(!model.model||!model.promptVersion?.includes(POLICY.id)||!model.runId||!model.transcriptSha256||model.provenance!=='controlled-Claude-evaluation'))throw Error('Model provenance is incomplete');
 const byId=new Map(dataset.cases.map(c=>[c.id,c])),exclusions=[],gold=new Map(),observations=new Map(),answers=new Map(),tracker=createTracker(),refused=[];
 const planned=new Set(model.plannedCaseIds);if(planned.size!==model.plannedCaseIds.length)throw Error('Duplicate planned case ID');for(const id of planned){const c=byId.get(id);if(!c||c.kind!=='academic-semantic'||c.holds.length||c.reviewOnlyUntilBasisResolved)throw Error('Planned model scope contains an unknown, objective or reference-held case: '+id);}tracker.plan([...planned]);
 const adjudicatedIds=new Set();
 for(const r of adjudication.adjudications){
  if(adjudicatedIds.has(r.id))throw Error('Duplicate faculty adjudication: '+r.id);adjudicatedIds.add(r.id);
  const c=byId.get(r.id);if(!c||r.caseHash!==c.caseHash)throw Error('Unknown/stale faculty case: '+r.id);
  if(r.reviewStatus!=='adjudicated')continue;
  const proper=r.adjudicatorId&&r.reviewerIds?.length>=2&&new Set(r.reviewerIds).size===r.reviewerIds.length&&Number.isFinite(Date.parse(r.reviewedAt))&&r.reason?.trim()&&r.recordRef&&r.acceptedJudgments?.length&&r.acceptedJudgments.every(l=>LABELS.includes(l))&&typeof r.ambiguous==='boolean';
  const suppliedQuotes=(!c.sourceText.trim()||evidenceQuote(c.sourceText,r.sourceEvidence))&&(!c.targetText.trim()||evidenceQuote(c.targetText,r.targetEvidence));
  if(!proper||!suppliedQuotes){exclusions.push({id:c.id,reason:'faculty_adjudication_incomplete_or_evidence_not_in_source'});continue;}
  if(c.kind!=='academic-semantic'||c.optionalDiagnostic||c.holds.length||c.reviewOnlyUntilBasisResolved){exclusions.push({id:c.id,reason:'objective_optional_or_reference_held_scope'});continue;}
  if(!testOnly&&adjudication.provenance!=='faculty-adjudication'){exclusions.push({id:c.id,reason:'faculty_provenance_unconfirmed'});continue;}
  gold.set(c.id,{id:c.id,type:c.relationshipType,source:c.sourceText,target:c.targetText,accept:r.acceptedJudgments,ambiguous:r.ambiguous,program:c.program,category:c.sourceKind});
 }
 for(const o of model.observations){
  const c=byId.get(o.id);if(!c||o.caseHash!==c.caseHash||observations.has(o.id)||!planned.has(o.id))throw Error('Unknown, unplanned, duplicate or stale model case: '+o.id);
  observations.set(o.id,o);if(typeof o.attempted!=='boolean')throw Error('Attempted state must be explicit');
  if(c.kind!=='academic-semantic')continue;
  tracker.plan([c.id]);if(!o.attempted){if(o.judgment)throw Error('Unattempted case cannot carry a model judgment');continue;}
  let verified=null;
  try{
   const context=dataset.contexts[c.contextId],p=plan(context.content,context.masters);
   const adapter=replayOptions({policyVersion:POLICY.id,inputHash:p.inputHash,referenceHash:p.referenceHash,judgements:[]},p);
   const pair={id:c.pairId,type:c.relationshipType,source:c.sourceText,target:c.targetText,path:c.path,targetPath:null};
   if(o.judgment)verified=validate({judgements:[o.judgment]},[pair],contractOf(adapter.env))[0];
  }catch(e){refused.push({id:c.id,codes:e.problems?.map(p=>p.code)||[e.code||'invalid_answer']});}
  tracker.sent({keys:[c.id],answered:!!o.judgment,verified:verified?[c.id]:[]});tracker.settle(c.id,verified);if(verified)answers.set(c.id,{...verified,id:c.id});
 }
 const semantic=dataset.cases.filter(c=>c.kind==='academic-semantic');
 const scored=[...gold.values()].filter(c=>planned.has(c.id)),labels=new Map([...answers].map(([id,j])=>[id,j.label])),attempted=(_r,id)=>observations.get(id)?.attempted===true;
 const agreement=scoreEval(scored,[labels],{disciplineOf:item=>item.program,attempted});
 const quality=qualityOf(scored,[answers],{attempted,refused,flags:{a:true,b:true,b3:true,b4:true,c1:true,c2:true,c3:true,d1:true,d2:true,requirements:true}});
 const group=items=>{const q=qualityOf(items,[answers],{attempted,flags:{a:true,b:true,c3:true}}),g=scoreEval(items,[labels],{attempted});return {facultyLabelled:items.length,attempted:items.filter(i=>attempted(0,i.id)).length,agreement:g.agreement,agreementCounts:q.agreement,answered:g.answered,falseApprovals:q.falseApprovals,falseRejections:q.falseRejections,notAttempted:g.notAttempted,invalid:g.invalid};};
 const programs=Object.fromEntries(['BSIT','BSIT-CYBERSECURITY','BSIE','BSCPE'].map(p=>[p,group(scored.filter(i=>i.program===p))]));
 const relationships=Object.fromEntries(POLICY.weeklyTypes.map(t=>[t,group(scored.filter(i=>i.type===t))]));
 const recommendation={};for(const origin of ['synthetic-proposal','Claude']){
  const ps=proposals.filter(p=>p.origin===origin&&(origin!=='Claude'||p.isClaudeOutput===true&&p.runId===model.runId&&p.transcriptSha256===model.transcriptSha256&&byId.get(p.caseId)?.caseHash===p.caseHash)),ratings=recommendationReviews.filter(r=>r.reviewStatus==='reviewed'&&r.reviewerId&&r.reason?.trim()&&['yes','partly','no','cannot_judge'].includes(r.recommendationAppropriate)&&ps.some(p=>p.id===r.id&&p.proposalHash===r.proposalHash));
  const unique=new Set();for(const r of ratings){const key=r.id+'|'+r.reviewerId;if(unique.has(key))throw Error('Duplicate recommendation rating');unique.add(key);}
  recommendation[origin]={proposals:ps.length,reviewerRatings:ratings.length,appropriate:ratings.filter(r=>r.recommendationAppropriate==='yes').length,inappropriate:ratings.filter(r=>r.recommendationAppropriate==='no').length,partly:ratings.filter(r=>r.recommendationAppropriate==='partly').length,cannotJudge:ratings.filter(r=>r.recommendationAppropriate==='cannot_judge').length,appropriateShare:ratio(ratings.filter(r=>r.recommendationAppropriate==='yes').length,ratings.filter(r=>r.recommendationAppropriate!=='cannot_judge').length)};
 }
 const humanEvidence=evidenceReviews.filter(r=>r.reviewStatus==='reviewed'&&r.reviewerId&&r.reason?.trim()&&r.runId===model.runId&&r.transcriptSha256===model.transcriptSha256&&byId.get(r.id)?.caseHash===r.caseHash&&answers.has(r.id));
 const evidenceRatings={};for(const field of ['quoteAccuracy','relevanceOfEvidence','explanationSupported','referenceHoldHonesty']){const rated=humanEvidence.filter(r=>['yes','partly','no','cannot_judge'].includes(r[field]));evidenceRatings[field]={ratings:rated.length,yes:rated.filter(r=>r[field]==='yes').length,partly:rated.filter(r=>r[field]==='partly').length,no:rated.filter(r=>r[field]==='no').length,cannotJudge:rated.filter(r=>r[field]==='cannot_judge').length,yesShare:ratio(rated.filter(r=>r[field]==='yes').length,rated.filter(r=>r[field]!=='cannot_judge').length)};}
 return {version:dataset.version,policyVersion:POLICY.id,benchmarkHash:dataset.benchmarkHash,scope:testOnly?'synthetic-software-validation-only':'faculty-adjudicated-relationship-accuracy',status:!gold.size?'awaiting_faculty_adjudication':!answers.size?'awaiting_model_results':'measured_supplied_evidence',official:false,institutionalAcceptanceThreshold:null,modelRequestsMade:0,
  academic:{facultyLabelled:gold.size,inScopeFacultyLabelled:scored.length,unlabelledOrExcluded:semantic.length-gold.size,agreement:agreement.agreement,agreementCounts:quality.agreement,falseApprovals:quality.falseApprovals,falseRejections:quality.falseRejections,partialAccuracy:agreement.partialAccuracy,byRelationship:relationships,byProgram:programs,bySourceKind:Object.fromEntries(['verified-syllabus','synthetic'].map(k=>[k,group(scored.filter(i=>i.category===k))])),profileFalseApprovals:null,profileMeasurementLimitation:'No complete-scope faculty syllabus disposition or genuine V2 model report is supplied.'},
  operations:{...tracker.metrics(),reviewPoolSemantic:semantic.length,notSelected:semantic.length-planned.size,referenceHeld:semantic.filter(c=>c.holds.length||c.reviewOnlyUntilBasisResolved).length},evidence:{mechanical:quality.evidence,facultyRatings:evidenceRatings,semanticEvidenceLimitation:'Quote containment is mechanical; independent faculty review must establish whether the quotations support the explanation.'},recommendations:recommendation,exclusions,refused};
}
module.exports={measure,LABELS};
if(require.main===module){try{
 const args=process.argv.slice(2),get=flag=>args[args.indexOf(flag)+1],read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
 const allowed=['--dataset','--adjudication','--model','--evidence-reviews','--recommendation-reviews','--proposals','--output'];if(args.length%2||args.some((a,i)=>i%2===0&&!allowed.includes(a))||new Set(args.filter((_,i)=>i%2===0)).size!==args.length/2)throw Error('Only explicit data-file options are accepted; no paid/provider mode exists.');
 if(!args.includes('--dataset')||!args.includes('--adjudication')||!args.includes('--model'))throw Error('Usage: node measure.cjs --dataset cases.json --adjudication reviewed.json --model model-results.json');
 const dataset=read(get('--dataset')),options={};for(const flag of ['--evidence-reviews','--recommendation-reviews'])if(args.includes(flag)){const data=read(get(flag));bound(dataset,data);options[flag==='--evidence-reviews'?'evidenceReviews':'recommendationReviews']=data.reviews||data.responses;}if(args.includes('--proposals'))options.proposals=read(get('--proposals'));
 const result=JSON.stringify(measure(dataset,read(get('--adjudication')),read(get('--model')),options),null,2)+'\n';if(args.includes('--output'))fs.writeFileSync(get('--output'),result,{flag:'wx'});else process.stdout.write(result);
}catch(e){console.error(e.message);process.exitCode=1;}}
