'use strict';
// Policy V2 shares the existing Hybrid-2 service and report storage. Its default
// path remains the isolated offline preview; live application evaluation is separately gated.
const {POLICY,plan,hash}=require('./academicV2Plan');
const {align,createRequestBudget}=require('./gemini');
const {readAspects}=require('./aspects');
const fit=require('./lessonfit');
const {buildVerdict}=require('./verdict');
const {namedValues}=require('./values');
const {replayOptions}=require('./academicV2Replay');
const {providerConfig,batchSizeOf}=require('./gemini');
const costPlan=require('./costPlan');
// The relationships the integrated pass asks: the seven confirmed weekly links and the existing course checks.
const INCLUDED=new Set([...POLICY.weeklyTypes,'Course-CLO','CLO-PO','CLO-EGA','CLO-classification','Title-description','Description-plan']);
const cloClassification=require('./cloClassification');
const recommendationV2=require('./academicV2Recommendation');
const v2Activation=require('./academicV2Activation');
const {stageFlags}=require('./stages');
const {hasContent}=require('../../../shared/contentPresence.cjs');
const S='SUPPORTED_BY_SUPPLIED_EVIDENCE',R='REQUIRES_REVISION',F='FACULTY_REVIEW',N='NOT_EVALUATED',P='PARTIALLY_EVALUATED';
const DETERMINISTIC_REQUIREMENTS=new Set(['course.identity','course.fourCLOs','course.classificationLabels','schedule.weeks1to18','structure.requiredFields','references.APA7text']);
const deterministicRequirement=r=>DETERMINISTIC_REQUIREMENTS.has(r.id)||r.id.startsWith('references:');
const isV2=report=>report?.evaluationPolicy?.id===POLICY.id;
// Why a relationship was not evaluated, in words an author can act on. Unlisted reasons stay as their code.
const cloNumber=pair=>{const m=/^clo(\d+)-/.exec(pair.id||'');return m?'CLO '+(Number(m[1])+1):'this CLO';};
const REASON_TEXT={clo_classification_missing:pair=>`The classification of ${cloNumber(pair)} is not saved, so whether its statement suits its classification was not evaluated, and no classification was assumed. Select a classification for this CLO in the CLO step, then check again.`};
const reasonText=(pair,reason)=>REASON_TEXT[reason]?REASON_TEXT[reason](pair):reason;
const error=message=>Object.assign(Error(message),{status:400,code:'academic_v2_offline_only',body:{code:'academic_v2_offline_only'}});
function aggregate(records){
 const statuses=records.map(r=>r.status==='NOT_CHECKED'?N:r.status);
 if(statuses.includes(R))return R;if(statuses.includes(F))return F;
 if(!records.length||statuses.every(s=>s===N))return N;
 if(statuses.includes(N)||statuses.includes(P))return P;
 return S;
}
function record(pair,j,context,reason,{notChecked=false}={}){
 let status=notChecked?'NOT_CHECKED':N,review=[];
 if(j&&!j.unverified&&j.label!=='INSUFFICIENT_EVIDENCE'){
  status={ALIGNED:S,PARTIALLY_ALIGNED:F,NOT_ALIGNED:R}[j.label]||N;
  const aspect=readAspects(j),needed={'Activity-fit':['teaching','learnerSupport'],'Value-use':['valueUse','carriedBy','valueFit']}[pair.type];
  if(aspect.contradictions.length){status=F;review.push('contradictory_response');}
  if(needed&&(!aspect.present||needed.some(key=>!aspect.values[key]||aspect.values[key]==='not_assessed')||aspect.invalid.length||aspect.missing.length)){status=N;review.push('required_aspects_not_assessed');}
  if(j.explanationReview?.length){status=F;review.push(...j.explanationReview);}
 }
 if(reason){status=notChecked?'NOT_CHECKED':reason.endsWith('reference_review')||reason==='ega_reference_unavailable'?F:N;review.push(reason);}
 if(!hasContent(pair.source)||!hasContent(pair.target)){status=notChecked?'NOT_CHECKED':N;review.push('missing_evidence');}
 if(j?.draftReview?.length)review.push('recommendation_withheld');
 if(j?.correction&&j.correction.decision!=='NO_CHANGE')review.push('faculty_review_required');
 const weeklyIndex=POLICY.weeklyTypes.indexOf(pair.type),rowIndex=/^row(\d+)-/.exec(pair.id||'');
 const fields={'Content-course':['meta.title','contents'],'Content-ILO':['contents','ilos'],'ILO-CLO':['clos','ilos'],'Content-activity':['contents','activities'],'ILO-activity':['ilos','activities'],'Content-assessment':['contents','tasks'],'Activity-assessment':['activities','tasks']}[pair.type]||[null,null];
 return {id:pair.id,relationshipType:pair.type,relationshipId:weeklyIndex<0?null:`VPAA-${String(weeklyIndex+1).padStart(2,'0')}`,path:pair.path,section:rowIndex?'plan':String(pair.path||'').split(/[.\[]/)[0]||null,week:rowIndex?context.rows.find(r=>r.i===Number(rowIndex[1]))?.row.week??null:null,sourceField:fields[0],targetField:fields[1],attempted:!!j?.attempted,reused:!!j?.reused,sourceText:pair.source,targetText:pair.target,academicJudgment:j?.unverified||j?.label==='INSUFFICIENT_EVIDENCE'?null:j?.label||null,status,
  evidence:{sourceQuote:j?.sourceQuote||'',targetQuote:j?.targetQuote||'',matching:j?.evidenceMatching||null},explanation:j?.explanation||reasonText(pair,reason)||'This relationship has not been evaluated.',
  recommendedCorrection:j?.draftReview?.length||j?.correction&&!j.correction.draftOffered?null:j?.draft||null,recommendationType:j?.correction?.decision||j?.recommendation||null,
  correction:j?.correction||null,cloClassification:j?.cloClassification||null,classificationContext:pair.classificationContext||null,reviewRequirements:[...new Set(review)],
  aspects:j?.aspects||null,provenance:{policyVersion:POLICY.id,kind:context.runMode==='application'?'live-application':'offline-Claude-replay',liveModelCall:context.runMode==='application'?!!context.liveModelCall&&!!j:false,facultyValidated:false,inputHash:context.inputHash,referenceHash:context.referenceHash,promptVersion:j?.key?context.promptVersion:null},
  contextHash:hash([pair.type,pair.source,pair.target]),verification:j?.unverified?'unverified':j?.label!=='INSUFFICIENT_EVIDENCE'&&j?.evidenceMatching?'quotes_verified':'not_checked'};
}
function criterion(id,records,extra={}){return {id,status:aggregate(records),evidenceIds:records.map(r=>r.id),required:true,...extra};}
function rootActions(records,roots,context){
 const byId=new Map(records.map(r=>[r.id,r])),used=new Set(),actions=[],reviews=[];
 for(const root of roots||[]){
  const ids=[...new Set(root.relationshipIds||[])],receipt=root.confirmation;
  if(!ids.length||!receipt?.reviewer||!receipt.receiptId||!receipt.basis||receipt.inputHash!==context.inputHash||receipt.referenceHash!==context.referenceHash||!['offline-mock','faculty-review'].includes(receipt.provenance)||!root.correction?.trim()||ids.some(id=>used.has(id)||!byId.has(id)||![R,F].includes(byId.get(id).status))){reviews.push({id:root.id||'root',reason:'unconfirmed_or_stale_root'});continue;}
  ids.forEach(id=>used.add(id));actions.push({id:root.id,relationshipIds:ids,correction:root.correction,confirmation:receipt,requiresHumanReview:true,canAutoApply:false});
 }
 for(const r of records)if([R,F].includes(r.status)&&!used.has(r.id))actions.push({id:'review:'+r.id,relationshipIds:[r.id],correction:r.recommendedCorrection||r.correction?.reason||'Review the supplied evidence and responsible field with faculty.',field:r.correction?.field||null,path:r.correction?.path||r.path||null,recommendationType:r.correction?.decision||r.recommendationType||'REVIEW_REQUIRED',requiresHumanReview:true,canAutoApply:false});
 return {actions,rootReviews:reviews};
}
async function evaluateWith(content,masters,options,coded,context,part,request,{runMode='offline-Claude-replay',adapter=null,alignment=null,notChecked=false,integrated=false}={}){
 const answers=[];
 context.runMode=runMode;
 // A self-declared title cannot supply an approved course identity. Reuse the
 // existing guard's scope; local lesson-to-lesson evidence remains available.
 if(part.identity.status!=='verified'){
  const {NEEDS_IDENTITY}=require('./identity');
  const reason=['curriculum_unavailable','curriculum_ambiguous'].includes(part.identity.status)?'course_identity_reference_review':'course_identity_not_verified';
  for(const pair of context.pairs)if(NEEDS_IDENTITY.has(pair.type)||pair.type==='CLO-classification')context.unavailable.set(pair.id,reason);
 }
 const ask=async pairs=>{
  const available=pairs.filter(p=>!context.unavailable.has(p.id));
  if(available.length)await request(available,answers,context);
 };
 await ask(context.pairs);
 // Preserve C2's dependency on the direct ILO–Assessment diagnostic. C2 and
 // that diagnostic are optional in V2 and cannot change required disposition.
 const c2=integrated?{asked:[]}:fit.eligible(content,answers,'assessment');
 const c2Pairs=fit.assessmentPairs(content,c2.asked);await ask(c2Pairs);
 const byAnswer=new Map(answers.map(j=>[j.id,j]));
 context.liveModelCall=runMode==='application'&&(alignment?.liveModelCalls||0)>0;
 const records=[...context.pairs,...c2Pairs].map(pair=>record(pair,byAnswer.get(pair.id),context,context.unavailable.get(pair.id),{notChecked}));
 const byRecord=new Map(records.map(r=>[r.id,r]));
 const collect=ids=>ids.map(id=>byRecord.get(id)).filter(Boolean);
 const requirements=context.weekly.map(cell=>{
  const groups=cell.groups.map(ids=>{const found=collect(ids);if(!found.length)return {status:N};
   if(cell.type==='ILO-CLO'&&found.some(r=>r.status===S))return {status:found.every(r=>r.status===S)?S:F};
   return {status:aggregate(found)};});
  return {id:cell.id,relationshipType:cell.type,path:cell.path,week:cell.week,status:aggregate(groups),evidenceIds:cell.groups.flat(),required:true};
 });
 const baseView={...part.base,findings:part.findings,hybrid:{codedChecks:part.checks,alignment:{status:'not_evaluated',judgements:[]},stages:{}}};
 const fixed=buildVerdict(baseView,content,{all:true}).all;
 const fixedCriterion=(id,rows)=>({id,status:!rows.length?N:rows.some(r=>r.status==='FAIL')?R:rows.some(r=>['NEEDS_REVIEW','NOT_CHECKED'].includes(r.status))?F:S,required:true,evidenceIds:[],findings:rows});
 requirements.push(fixedCriterion('course.identity',fixed.filter(f=>/^CUR-0[234]$/.test(f.ruleId))));
 if(['curriculum_unavailable','curriculum_ambiguous'].includes(part.identity?.status))requirements.at(-1).status=F;
 requirements.push(fixedCriterion('course.fourCLOs',fixed.filter(f=>f.ruleId==='CLO-01')),
  fixedCriterion('course.classificationLabels',fixed.filter(f=>f.ruleId==='CLO-08')),
  fixedCriterion('schedule.weeks1to18',fixed.filter(f=>f.ruleId==='PLAN-01')));
 for(const [id,type] of [['course.descriptionTitle','Title-description'],['course.descriptionContent','Description-plan'],['course.CLORelevance','Course-CLO'],['course.CLOClassificationMeaning','CLO-classification'],['week1.introduction','Week1-introduction']]){
  if(integrated&&id==='week1.introduction')continue;
  const scoped=records.filter(r=>r.relationshipType===type);requirements.push(criterion(id,scoped));
  if(scoped.some(r=>r.reviewRequirements.includes('clo_classification_missing')))requirements.at(-1).reviewRequirements=['clo_classification_missing'];
 }
 const intro=requirements.find(r=>r.id==='week1.introduction');
 if(intro?.status===S&&context.rows.some(({row})=>require('./planrows').weeksIn(row.week).includes(1)&&require('./planrows').weeksIn(row.week).length>1)){intro.status=F;intro.reviewRequirements=['confirm_week1_timing_within_group'];}
 for(const [i,clo] of (content.clos||[]).entries())for(const [kind,type] of [['PO','CLO-PO'],['EGA','CLO-EGA']]){
  const scoped=records.filter(r=>r.relationshipType===type&&r.id.startsWith(`clo${i}-`));
  let status=scoped.some(r=>r.status===S)?scoped.every(r=>r.status===S)?S:F:aggregate(scoped);
  if(!(kind==='PO'?clo.pos:clo.egas)?.length)status=F;
  if(kind==='PO'&&!context.reference.poUsable||kind==='EGA'&&!context.reference.egaUsable)status=F;
  requirements.push({id:`course.clo${i}.${kind}`,status,required:true,evidenceIds:scoped.map(r=>r.id),reviewRequirements:status===F?['mapping_or_reference_review']:[]});
 }
 if(!integrated)for(const {row,i} of context.rows){
  requirements.push(criterion(`weekly:${i}:diverseLearners`,collect([`row${i}-activityfit`]),{week:String(row.week)}));
  const value=criterion(`weekly:${i}:values`,collect([`row${i}-value`,`row${i}-valueuse`]),{week:String(row.week)});
  if(!namedValues(row.values).length)value.status=F;
  if(context.reference.valueDefinitions.status!=='configured'&&value.status===S){value.status=F;value.reviewRequirements=['value_definition_approval_review'];}
  requirements.push(value);
 }
 for(const entry of context.entries){
  const definite=entry.issues?.some(issue=>issue.severity==='definite'),possible=entry.issues?.length||entry.format?.uncertain;
  requirements.push({id:`references:${entry.group}:${entry.index}:APA7text`,status:entry.blank?N:definite?R:possible?F:S,required:true,evidenceIds:[],sourceText:entry.text,findings:entry.issues||[],limitation:'Plain text does not establish italics or hanging indentation; source authenticity is not verified.'});
 }
 if(!context.entries.some(e=>!e.blank))requirements.push({id:'references.APA7text',status:N,required:true,evidenceIds:[]});
 // Field/header/cell correctness comes from the unchanged compliance engine.
 requirements.push({id:'structure.requiredFields',status:part.findings.some(f=>f.severity==='blocking')?F:part.base.findings?.length?F:S,required:true,evidenceIds:[],findings:part.base.findings||[]});
 const optionalTypes=new Set(['ILO-assessment','Assessment-fit','ILO-content','CLO-anyPO','CLO-anyEGA','CLO-set','CLO-coverage','Plan-sequence','Ref-relevance']);
 const requiredRecords=records.filter(r=>!optionalTypes.has(r.relationshipType));
 const grouped=rootActions(requiredRecords,options.offlineReplay?.confirmedRoots||[],context);
 let disposition=aggregate(integrated?requirements.filter(r=>!deterministicRequirement(r)):requirements);
 if(!requiredRecords.some(r=>[S,R,F].includes(r.status))&&disposition!==R)disposition=N;
 const policy={...POLICY,active:false};
 const hardFailures=part.findings.filter(f=>f.severity==='blocking');
 const conformance={ok:!hardFailures.length,failed:hardFailures};
 const provenance=integrated?{kind:'live-application',liveModelCalls:alignment?.liveModelCalls||0,networkRequests:alignment?.liveModelCalls??0,facultyValidated:false,inputHash:context.inputHash,referenceHash:context.referenceHash}:
  {kind:'offline-Claude-replay',liveModelCalls:0,networkRequests:0,adapterRequests:adapter.requests(),facultyValidated:false,inputHash:context.inputHash,referenceHash:context.referenceHash};
 const segments=path=>String(path||'').replace(/\[(\d+)\]/g,'.$1').split('.');
 const getValue=(c,p)=>(!p||!c)?undefined:segments(p).reduce((v,k)=>(v===undefined||v===null?undefined:v[k]),c);
 const suggestions=[];
 for(const a of grouped.actions){
  const r=records.find(rec=>rec.id===a.relationshipIds?.[0]);
  const targetPath=a.path||r?.path;
   if(r&&targetPath&&r.recommendedCorrection){
   const orig=getValue(content,targetPath);
   suggestions.push({
    id:a.id,relationshipId:r.id,path:targetPath,title:'Suggested academic alignment revision',
    text:r.explanation||r.correction?.reason||'Academic alignment revision recommended',
    replacement:r.recommendedCorrection,originalValue:typeof orig==='string'?orig:(r.targetText||''),
    source:'ai',policy:POLICY.id,basedOn:a.relationshipIds||[r.id],field:a.field,
    recommendationType:a.recommendationType||'REWRITE_TEXT',canRefine:true
   });
  }
 }
 const storedRequirements=integrated?requirements.map(r=>({...r,kind:deterministicRequirement(r)?'deterministic_compliance':'ai_academic_alignment'})):requirements;
 const coverageRequirements=integrated?storedRequirements.filter(r=>r.kind==='ai_academic_alignment'):storedRequirements;
 const coverage={required:coverageRequirements.length,supported:coverageRequirements.filter(r=>r.status===S).length,notEvaluated:coverageRequirements.filter(r=>r.status===N||r.status==='NOT_CHECKED').length};
 const academic={policyVersion:POLICY.id,disposition,requirements:storedRequirements,relationships:records,remediation:grouped,suggestions,coverage,
  references:context.reference,provenance,scope:'Structured syllabus and text-based references',
  limitations:integrated?['Advisory academic alignment has no numeric score, deductions or submission-gate effect.','Recommendations require faculty review; syllabus content and mappings are never changed automatically.']:
   ['APA visual formatting and source authenticity are not established by plain text.','Mocked judgments demonstrate software behavior, not academic accuracy or faculty approval.'],
  ...(integrated?{}:{originalContext:{content:structuredClone(content),referenceHash:context.referenceHash}}),
  diagnostics:{iloAssessment:records.filter(r=>r.relationshipType==='ILO-assessment'),c2:records.filter(r=>r.relationshipType==='Assessment-fit'),c2Eligibility:c2,affectsDisposition:false}};
 if(integrated)return {version:POLICY.id,mode:'live-application',status:alignment?.status||'not_evaluated',contracts:{policy:POLICY.id,cloClassification:cloClassification.VERSION,recommendation:recommendationV2.VERSION},alignment:{status:alignment?.status||'not_evaluated',provider:alignment?.provider||null,model:alignment?.model||null,reason:alignment?.reason||'',promptVersion:context.promptVersion||null,liveModelCalls:provenance.liveModelCalls,requestBudget:alignment?.requestBudget||null,judgements:answers},academic,suggestions};
 return {standard:POLICY.id,evaluationPolicy:policy,status:'offline-preview',score:null,overall:null,passed:false,
  compliance:{policyVersion:'hybrid-2-compliance',ruleCount:47,score:part.base.overall,passThreshold:79,passed:part.base.passed,conformance,rulesConformance:part.base.conformance,findings:part.findings,codedChecks:part.checks},
  academic,
  hybrid:{version:'hybrid-2',evaluationPolicy:policy,ready:false,score:null,baseScore:part.base.overall,deductions:[],suggestions,alignment:{status:adapter.unavailable?'not_evaluated':'completed',provider:'offline-replay',evaluationOnly:true,judgements:answers,promptVersion:context.promptVersion||POLICY.id},policy:{version:POLICY.id,academicPoints:false}},
  findings:part.findings,conformance,areas:part.base.areas};
}
async function evaluate(content,masters,options,coded){
 if(['transport','env','linkChecker','refFetch','useAi'].some(key=>Object.hasOwn(options,key)))throw error('V2 preview accepts offline replay data only; no live provider or network options are allowed.');
 const context=plan(content,masters),adapter=replayOptions(options.offlineReplay,context),part=coded(content,masters);
 const request=async(pairs,answers,ctx)=>{
  if(adapter.unavailable)return;
  const seen=new Set(answers.map(j=>j?.id).filter(Boolean));
  for(let i=0;i<pairs.length;i+=120){
   const slice=pairs.slice(i,i+120).filter(pair=>!seen.has(pair.id));
   if(!slice.length)continue;
   const result=await align(content,masters,{...adapter,pairs:slice});
   ctx.promptVersion=result.promptVersion||ctx.promptVersion;
   for(const j of result.judgements||[])if(j?.id&&!seen.has(j.id)){seen.add(j.id);answers.push(j);}
  }
 };
 return evaluateWith(content,masters,options,coded,context,part,request,{adapter});
}
const STOP_KINDS=new Set(['request_budget','request_cancelled','provider_access','provider_budget','provider_quota','not_configured','duplicate_relationship_id']);
const uncheckedOf=(pair,kind='not_checked')=>({id:pair.id,type:pair.type,path:pair.path,targetPath:pair.targetPath,label:'INSUFFICIENT_EVIDENCE',unverified:true,failureKind:kind,
 explanation:'The AI did not answer for this relationship, so it has not been checked yet. Run the check again after resolving the request failure.',
 sourceQuote:'',targetQuote:'',evidenceMatching:{source:'not_evaluated',target:'not_evaluated'},sourceBloom:'N/A',targetBloom:'N/A',draft:'',attempted:false});
async function evaluateIntegrated(content,masters,coded,options={}){
 const env=options.env||process.env;
 if(!v2Activation.enabled(env))throw error('Policy V2 application checking is disabled; enable its explicit server configuration flag first.');
 const context=plan(content,masters),part=coded(content,masters);
 // The integrated pass asks only the seven confirmed weekly links and the existing course checks. Stage D1 values and optional diagnostics stay in their existing checker path.
 context.pairs=context.pairs.filter(pair=>INCLUDED.has(pair.type));
 context.pairs=cloClassification.prepare(context.pairs,content,cloClassification.VERSION,masters);
 const flagsOff={...env,SYLLABUS_CHECK_STAGE_A:'off',SYLLABUS_CHECK_STAGE_B:'off',SYLLABUS_CHECK_STAGE_B3:'off',SYLLABUS_CHECK_STAGE_B4:'off',SYLLABUS_CHECK_STAGE_C1:'off',SYLLABUS_CHECK_STAGE_C2:'off',SYLLABUS_CHECK_STAGE_C3:'off',SYLLABUS_CHECK_STAGE_D1:'off',SYLLABUS_CHECK_STAGE_D2:'off',SYLLABUS_CHECK_REQUIREMENTS_ADVICE:'off'};
 const requestBudget=options.requestBudget||createRequestBudget(flagsOff);
 const sentBefore=requestBudget.summary().requests; // requests already sent by the legacy run that shares this budget
 const configured=providerConfig(flagsOff),canCall=options.useAi!==false&&configured.provider==='anthropic'&&configured.configured;
 let answers=[];let reason=canCall?'':options.useAi===false?'AI was explicitly disabled for this check; no Policy V2 model request was sent.':'Policy V2 requires the explicitly approved Claude provider; no academic AI request was sent.';
 const request=async(pairs,out,ctx)=>{
  answers=out;
  if(!canCall)return;
  const seen=new Set(out.map(j=>j?.id).filter(Boolean));
  const chunkReasons=[];
  let stopKind=null;
  for(let i=0;i<pairs.length;i+=120){
   const slice=pairs.slice(i,i+120).filter(pair=>!seen.has(pair.id));
   if(!slice.length)continue;
   if(stopKind){
    for(const pair of slice){seen.add(pair.id);out.push(uncheckedOf(pair,stopKind));}
    continue;
   }
   const result=await align(content,masters,{env:flagsOff,...(options.transport?{transport:options.transport}:{}),requestBudget,reuse:options.reuse,signal:options.signal,pairs:slice,skipEmpty:false,
    academicPolicy:POLICY.id,integratedAcademic:true,cloClassification:cloClassification.VERSION,recommendation:recommendationV2.VERSION});
   ctx.promptVersion=result.promptVersion||ctx.promptVersion;
   for(const j of result.judgements||[])if(j?.id&&!seen.has(j.id)){seen.add(j.id);out.push(j);}
   for(const pair of slice)if(!seen.has(pair.id)){seen.add(pair.id);out.push(uncheckedOf(pair,result.failure?.kind||'not_checked'));}
   if(result.reason&&!/^\d+ of \d+ relationships could not be verified\./.test(result.reason)&&!chunkReasons.includes(result.reason))chunkReasons.push(result.reason);
   if(requestBudget.summary().exhausted)stopKind='request_budget';
   else if(options.signal?.aborted)stopKind='request_cancelled';
   else if(result.failure&&(STOP_KINDS.has(result.failure.kind)||(result.status==='not_evaluated'&&!['invalid_output','insufficient_text'].includes(result.failure.kind)&&!(result.coverage?.verified>0))))stopKind=result.failure.kind;
  }
  const unverifiedCount=out.filter(j=>j?.unverified||j?.label==='INSUFFICIENT_EVIDENCE').length;
  if(chunkReasons.length)reason=chunkReasons.join(' ');
  else if(unverifiedCount>0)reason=`${unverifiedCount} of ${pairs.length} relationships could not be verified. Click Re-Check again.`;
 };
 const expected=()=>context.pairs.filter(pair=>!context.unavailable.has(pair.id));
 const evaluated=()=>{const byId=new Map(answers.map(j=>[j.id,j]));return expected().filter(pair=>{const j=byId.get(pair.id);return j&&!j.unverified&&j.label!=='INSUFFICIENT_EVIDENCE';}).length;};
 const requiredComplete=()=>{
  const exp=expected(),byId=new Map(answers.map(j=>[j.id,j]));
  return exp.length>0&&answers.length===exp.length&&exp.every(pair=>{
   const j=byId.get(pair.id);
   return Boolean(j&&!j.unverified&&j.label!=='INSUFFICIENT_EVIDENCE');
  });
 };
 const alignment={get status(){const total=expected().length,checked=evaluated();return total&&checked===total&&requiredComplete()?'completed':checked?'partially_evaluated':'not_evaluated';},provider:canCall?configured.provider:configured.provider||null,model:canCall?configured.model||null:null,
  get reason(){return reason;},get liveModelCalls(){return requestBudget.summary().requests-sentBefore;},get requestBudget(){return requestBudget.summary();}};
 return evaluateWith(content,masters,options,coded,context,part,request,{runMode:'application',alignment,notChecked:true,integrated:true});
}
// The upper bound of provider requests the required integrated evaluation sends (one per batch of relationships), for the shared budget's planning hold.
// Reuse can only lower it; it never counts optional work.
function plannedRequests(content,masters,env=process.env){
 const context=plan(content,masters);
 const pairs=cloClassification.prepare(context.pairs.filter(pair=>INCLUDED.has(pair.type)),content,cloClassification.VERSION,masters).filter(pair=>!context.unavailable.has(pair.id));
 const flagsOff={...env,SYLLABUS_CHECK_STAGE_A:'off',SYLLABUS_CHECK_STAGE_B:'off',SYLLABUS_CHECK_STAGE_B3:'off',SYLLABUS_CHECK_STAGE_B4:'off',SYLLABUS_CHECK_STAGE_C1:'off',SYLLABUS_CHECK_STAGE_C2:'off',SYLLABUS_CHECK_STAGE_C3:'off',SYLLABUS_CHECK_STAGE_D1:'off',SYLLABUS_CHECK_STAGE_D2:'off',SYLLABUS_CHECK_REQUIREMENTS_ADVICE:'off'};
 // The same cutting as align (costPlan.planBatches): the existing fixed-size batches unless SYLLABUS_CHECK_V2_GROUPING selects week grouping.
 const size=batchSizeOf(providerConfig(flagsOff).model,flagsOff),grouping=costPlan.groupingOf(env);let total=0;
 for(let i=0;i<pairs.length;i+=120)total+=costPlan.countBatches(pairs.slice(i,i+120),size,grouping);
 return total;
}
module.exports={POLICY,isV2,plan,evaluate,evaluateIntegrated,aggregate,plannedRequests};
