'use strict';
// Dataset/prompt/transport adapter only. Academic judgments and response contracts
// are exclusively the existing Hybrid-2 Claude implementation; no score or gate.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const {plan,hash,POLICY}=require('../../server/lib/syllabuscheck/academicV2Plan');
const {replayOptions}=require('../../server/lib/syllabuscheck/academicV2Replay');
const G=require('../../server/lib/syllabuscheck/gemini');
const {applyClaudeEnv,EVALUATION_MODELS,AUTHORIZED_TOTAL,SPEND_REGISTER,PLAN_KEY,planCostOf}=require('../../server/lib/syllabuscheck/eval/claudeEvaluation');
const {createGuard,claudePrices,claudePriceTable,claudeWorstCaseOf,loadedDataModules,openSpendRegister,closeLedger}=require('../../server/lib/syllabuscheck/eval/providerGuard');
const {KEY_FORMAT,PRICES_AS_OF,sameModel}=require('../../server/lib/syllabuscheck/anthropicClient');
const R2=require('../../server/lib/syllabuscheck/academicV2Recommendation');
const C=require('../../server/lib/syllabuscheck/cloClassification');
const VERSION='lcup-v2-controlled-evaluation-1';
const BENCHMARK_FILE='docs/lcup-academic-benchmark/package/cases.json';
const sha=bytes=>require('node:crypto').createHash('sha256').update(bytes).digest('hex');
const PROMPT_FILES=['server/lib/syllabuscheck/gemini.js','server/lib/syllabuscheck/variants.js','server/lib/syllabuscheck/stages.js','server/lib/syllabuscheck/academicV2Plan.js','server/lib/syllabuscheck/anthropicClient.js','server/lib/syllabuscheck/evidencePresence.js','shared/contentPresence.cjs','server/lib/syllabuscheck/academicV2Recommendation.js'];
// A CLO classification bundle is also bound to the code that builds each relationship's classification context; any other bundle keeps exactly the
// fingerprints it always had.
const CLASSIFICATION_FILES=['server/lib/syllabuscheck/cloClassification.js','server/lib/syllabuscheck/coverage.js','server/lib/syllabuscheck/planrows.js'];
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const write=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const fail=message=>{throw Error(message);};
function envFor(model,key=PLAN_KEY){
 if(!EVALUATION_MODELS.includes(model))fail('Explicit model must be in the existing evaluation allowlist: '+EVALUATION_MODELS.join(', '));
 const seed=replayOptions({policyVersion:POLICY.id,inputHash:'seed',referenceHash:'seed',judgements:[]},{inputHash:'seed',referenceHash:'seed'}).env;
 return {...applyClaudeEnv({...seed},{model,thinking:'adaptive',effort:'high',maxTokens:4096,timeoutSec:90,maxRetries:0}),ANTHROPIC_API_KEY:key,SYLLABUS_CHECK_AI_BATCH:'4',SYLLABUS_CHECK_AI_CONCURRENCY:'1'};
}
const fingerprints=(extra=[])=>Object.fromEntries([...PROMPT_FILES,...extra].map(f=>[f,hash(fs.readFileSync(path.join(root,f),'utf8'))]));
// The opt-in, evaluation-only recommendation contract a bundle names (academicV2Recommendation.js), prepared for one context; null for a baseline bundle.
const recommendationOf=(bundle,context,env)=>bundle.recommendation?R2.prepare(context.content,context.masters,{version:bundle.recommendation.version,academicPolicy:POLICY.id,evaluationOnly:true,env,provider:'anthropic',recommend:true}):null;
// The relationships of one request as align sends them under the opt-in, evaluation-only CLO classification contract a bundle names (cloClassification.js
// prepare, the function align applies): each ILO-CLO relationship with its CLO's fixed classification and lesson context. Unchanged for any other bundle.
const classifiedPairs=(bundle,context,pairs,env)=>bundle.cloClassification?C.prepare(pairs,context.content,C.contractOf({cloClassification:bundle.cloClassification.version,evaluationOnly:true,env}),context.masters):pairs;
function limitsFor(scope){return {maxRequests:scope==='smoke'?6:24,maxInputTokens:scope==='smoke'?600000:2400000,maxInputTokensPerRequest:120000,maxOutputTokens:scope==='smoke'?24576:98304,maxOutputTokensPerRequest:4096,maxCost:scope==='smoke'?2:6};}
function pairOf(c,context){if(!context)fail('A source-bound V2 context is required');const pair=plan(context.content,context.masters).pairs.find(p=>p.id===c.pairId);if(!pair||pair.source!==c.sourceText||pair.target!==c.targetText)fail('Pair differs from existing V2 plan');return pair;}
function groupsOf(bundle,scope){const groups=new Map();for(const id of bundle.scopes[scope]||fail('Unknown scope')){const c=bundle.cases.find(c=>c.id===id);if(!groups.has(c.contextId))groups.set(c.contextId,[]);groups.get(c.contextId).push(c);}return [...groups].map(([contextId,cases])=>({contextId,cases,context:bundle.contexts[contextId]}));}
function verifyBundle(bundle,model){
 const {preparedHash,...body}=bundle;if(hash(body)!==preparedHash)fail('Prepared bundle hash mismatch');
 if(bundle.version!==VERSION||bundle.policyVersion!==POLICY.id||bundle.modelRequested!==model)fail('Wrong bundle/policy/model');
 if(bundle.recommendation!==undefined&&(bundle.recommendation?.version!==R2.VERSION||bundle.recommendation.official!==false||bundle.recommendation.productionActive!==false))fail('Unknown or official recommendation contract');
 if(bundle.cloClassification!==undefined&&(bundle.cloClassification?.version!==C.VERSION||bundle.cloClassification.source!==C.SOURCE||bundle.cloClassification.official!==false||bundle.cloClassification.productionActive!==false||!Array.isArray(bundle.cloClassification.notEvaluable)))fail('Unknown or official CLO classification contract');
 if(bundle.benchmarkFile!==BENCHMARK_FILE)fail('Only the existing LCUP academic benchmark is allowed');
 if(hash(fingerprints(bundle.cloClassification?CLASSIFICATION_FILES:[]))!==hash(bundle.promptSources))fail('Prompt source changed since preparation');
 const original=read(path.join(root,bundle.benchmarkFile));const {benchmarkHash,...originalBody}=original;if(hash(originalBody)!==benchmarkHash||benchmarkHash!==bundle.benchmarkHash)fail('Benchmark hash mismatch');
 for(const scope of ['smoke','pilot'])if(!Array.isArray(bundle.scopes[scope])||new Set(bundle.scopes[scope]).size!==bundle.scopes[scope].length||bundle.scopes[scope].some(id=>!bundle.cases.some(c=>c.id===id)))fail('Unknown/duplicate scope IDs');
 for(const c of bundle.cases){
  const actual=original.cases.find(a=>a.id===c.id);if(!actual||hash(actual)!==hash(c)||c.expectedJudgment!==null||c.holds.length||c.reviewOnlyUntilBasisResolved||!c.requiredWeekly||c.optionalDiagnostic)fail('Unknown, modified, labelled or held case: '+c.id);
  const context=bundle.contexts[c.contextId];if(hash(context)!==hash(original.contexts[c.contextId]))fail('Context differs from the verified frozen benchmark: '+c.id);
  const p=plan(context.content,context.masters),pair=p.pairs.find(p=>p.id===c.pairId);
  if(p.inputHash!==context.inputHash||p.referenceHash!==context.referenceHash||p.unavailable.has(c.pairId)||!pair||pair.source!==c.sourceText||pair.target!==c.targetText||pair.type!==c.relationshipType)fail('Stale/unavailable case context: '+c.id);
  for(const ref of c.sourceRefs)if(sha(fs.readFileSync(path.join(root,ref.file)))!==ref.sha256)fail('Source document changed: '+ref.file);
 }
 // A CLO classification bundle covers every ILO-CLO relationship of each of its contexts exactly once: a case of its pilot scope, or not evaluable for
 // the reason the plan gives (never sent). Its smoke scope is part of the pilot, and it carries no other relationship.
 if(bundle.cloClassification){
  const {smoke,pilot}=bundle.scopes,skipped=bundle.cloClassification.notEvaluable,listed=[...pilot,...skipped.map(n=>n.caseId)];
  if(bundle.cases.length!==pilot.length||bundle.cases.some(c=>!pilot.includes(c.id)||c.relationshipType!=='ILO-CLO')||smoke.some(id=>!pilot.includes(id))||new Set(listed).size!==listed.length||skipped.some(n=>!bundle.contexts[n.contextId]))fail('Mixed or duplicate CLO classification scope');
  for(const [contextId,context] of Object.entries(bundle.contexts)){
   const p=plan(context.content,context.masters),covered=bundle.cases.filter(c=>c.contextId===contextId).map(c=>c.pairId);
   for(const n of skipped.filter(n=>n.contextId===contextId)){const c=original.cases.find(a=>a.id===n.caseId);if(!c||c.contextId!==contextId||c.pairId!==n.pairId||c.relationshipType!=='ILO-CLO'||!p.unavailable.has(n.pairId)||p.unavailable.get(n.pairId)!==n.reason)fail('Unknown or evaluable relationship listed as not evaluable: '+n.caseId);covered.push(n.pairId);}
   const want=p.pairs.filter(x=>x.type==='ILO-CLO').map(x=>x.id);
   if(covered.length!==want.length||want.some(id=>!covered.includes(id)))fail('Incomplete CLO classification scope: '+contextId);
  }
 }
 if(loadedDataModules().length)fail('Evaluation unexpectedly loaded database/application modules');
 return bundle;
}
// A CLO classification bundle: every ILO-CLO relationship of each verified syllabus (the only benchmark contexts whose ILO-CLO relationships are all
// cases), one case per ILO and assigned CLO, so an ILO mapped to two CLOs is two relationships judged separately, in plan order. A relationship the plan
// cannot send is listed as not evaluable with the plan's reason; one absent from the benchmark, held or labelled refuses the bundle.
// Its smoke scope is one whole lesson per syllabus that fills one request, two ILOs each mapped to two CLOs (IT 202 Weeks 3-4, IE 402 Weeks 12-14,
// CpE 304 Weeks 4-5), together CLO 1 to CLO 4. Exact IDs verified against the real dataset.
const CLASSIFICATION_SMOKE=['BM1-IT202-041','BM1-IT202-042','BM1-IT202-044','BM1-IT202-045','BM1-IE402-053','BM1-IE402-054','BM1-IE402-056','BM1-IE402-057','BM1-CPE304-026','BM1-CPE304-027','BM1-CPE304-029','BM1-CPE304-030'];
function classificationScopes(d,eligible){
 const pilot=[],notEvaluable=[];
 for(const [contextId,context] of Object.entries(d.contexts))if(context.sourceKind==='verified-syllabus'){
  const p=plan(context.content,context.masters);
  for(const pair of p.pairs.filter(x=>x.type==='ILO-CLO')){
   const c=d.cases.find(c=>c.contextId===contextId&&c.pairId===pair.id)||fail('ILO-CLO relationship absent from the benchmark: '+contextId+' '+pair.id);
   if(p.unavailable.has(pair.id))notEvaluable.push({caseId:c.id,contextId,pairId:pair.id,reason:p.unavailable.get(pair.id)});
   else if(eligible(c)&&c.expectedJudgment===null&&c.relationshipType==='ILO-CLO')pilot.push(c.id);
   else fail('Held, labelled or ineligible ILO-CLO case: '+c.id);
  }
 }
 if(CLASSIFICATION_SMOKE.some(id=>!pilot.includes(id)))fail('Smoke ID absent from the ILO-CLO scope');
 return {smoke:CLASSIFICATION_SMOKE,pilot,notEvaluable,notes:[{scope:'smoke',note:'One whole lesson per verified syllabus, each filling one request: two ILOs, each mapped to two CLOs; together CLO 1 to CLO 4.'},{scope:'pilot',note:'Every ILO-CLO relationship of the three verified syllabi: one per ILO and assigned CLO, each judged separately, in plan order.'},{scope:'notEvaluable',note:'Relationships the V2 plan cannot send, with its reason; never sent. In these syllabi each is an ILO mapped to no CLO, or a lesson with no ILO.'}]};
}
function select(model,{recommendation,cloClassification}={}){
 envFor(model);const benchmarkFile=BENCHMARK_FILE,d=read(path.join(root,benchmarkFile));
 // A recommendation-only bundle carries its existing smoke cases. With CLO classification, the same r2 safeguards can accompany every existing
 // ILO-CLO case; the frozen case records and baseline selector remain unchanged.
 const r2=recommendation===undefined?null:recommendation===R2.VERSION?{version:recommendation,official:false,productionActive:false}:fail('Unknown recommendation contract: '+String(recommendation).slice(0,80));
 // A CLO classification bundle carries every ILO-CLO relationship of the verified syllabi (classificationScopes), optionally with r2 safeguards.
 const cc=cloClassification===undefined?null:cloClassification===C.VERSION?{version:C.VERSION,source:C.SOURCE,official:false,productionActive:false}:fail('Unknown CLO classification contract: '+String(cloClassification).slice(0,80));
 const eligible=c=>c.kind==='academic-semantic'&&c.requiredWeekly&&!c.optionalDiagnostic&&!c.holds.length&&!c.reviewOnlyUntilBasisResolved&&!c.missingEvidence;
 // Exact IDs verified against the real dataset; no assumed labels, no PO holds.
 const ilo=cc?classificationScopes(d,eligible):null,smoke=ilo?ilo.smoke:['BM1-IT202-096','BM1-IE402-074','BM1-CPE304-051'];
 const intents=read(path.join(root,'docs/lcup-academic-benchmark/package/coordinator-only.json')).constructionIntents;
 const programs=['BSIT','BSIT-CYBERSECURITY','BSIE','BSCPE'],variants=['coherent-candidate','partial-scope-candidate','unrelated-content-candidate'],pilot=[],notes=[];
 POLICY.weeklyTypes.forEach((type,i)=>variants.forEach((variant,j)=>{
  const program=programs[(i+j)%programs.length],ctx=intents.find(k=>k.contextId&&k.sourceKind==='synthetic'&&k.constructionIntent===variant&&d.contexts[k.contextId].program===program)?.contextId;
  const c=d.cases.find(c=>c.contextId===ctx&&c.relationshipType===type&&eligible(c));if(!c)fail('No eligible pilot case for '+type+'/'+variant);pilot.push(c.id);notes.push({caseId:c.id,sourceKind:'synthetic',constructionIntent:variant,facultyJudgment:null,note:'Construction intent is not a reference answer and is never sent to Claude.'});
 }));
 const cases=[...new Set([...(ilo?[]:smoke),...(r2&&!cc?[]:ilo?ilo.pilot:pilot)])].map(id=>{const c=d.cases.find(c=>c.id===id);if(!c||!eligible(c))fail('Smoke/pilot ID absent or held: '+id);return c;});
 const bundle={version:VERSION,policyVersion:POLICY.id,official:false,productionActive:false,facultyValidated:false,modelRequested:model,modelReturned:null,...(r2?{recommendation:r2}:{}),...(cc?{cloClassification:{...cc,notEvaluable:ilo.notEvaluable}}:{}),benchmarkFile,benchmarkHash:d.benchmarkHash,promptSources:fingerprints(cc?CLASSIFICATION_FILES:[]),scopes:{smoke,pilot:cc?ilo.pilot:r2?[]:ilo?ilo.pilot:pilot},cases,contexts:Object.fromEntries([...new Set(cases.map(c=>c.contextId))].map(id=>[id,d.contexts[id]])),referenceSnapshot:{version:VERSION+'-frozen-benchmark-contexts',productionDatabase:false,referenceRecordsChanged:false,approval:'Existing supplied benchmark contexts; not a new institutional approval. Only non-held selected weekly relationships are eligible.',canonicalPOVersion:require('../../src/data/officialProgramOutcomes.json').version},scopeNotes:r2&&!cc?[]:ilo?ilo.notes:notes};
 if(r2&&cc)bundle.scopeNotes.push({scope:'pilot',note:'The existing r2 safeguards are applied to the same classification-scoped ILO-CLO relationships; no benchmark labels or contexts are changed.'});
 bundle.preparedHash=hash(bundle);return verifyBundle(bundle,model);
}
async function dryPlan(bundle,scope,model,limits=limitsFor(scope)){
 verifyBundle(bundle,model);validateLimits(limits);if(Array.isArray(bundle.scopes[scope])&&!bundle.scopes[scope].length)fail('Empty scope: this bundle has no '+scope+' cases');const env={...envFor(model),ANTHROPIC_MAX_TOKENS:String(limits.maxOutputTokensPerRequest)},requests=[];
 for(const group of groupsOf(bundle,scope)){
  const size=G.batchSizeOf(model,env),recommendation=recommendationOf(bundle,group.context,env);for(let i=0;i<group.cases.length;i+=size){const cases=group.cases.slice(i,i+size);let captures=0;
   try{await G.requestAnthropic(classifiedPairs(bundle,group.context,cases.map(c=>pairOf(c,group.context)),env),{env,course:G.courseOf(group.context.content),academicPolicy:POLICY.id,recommendation,transport:async(url,init)=>{captures++;if(String(url)!=='https://api.anthropic.com/v1/messages')fail('Unexpected provider endpoint');const body=JSON.parse(init.body);requests.push({caseIds:cases.map(c=>c.id),contextId:group.contextId,body,bodyHash:hash(init.body),conservativeBound:claudeWorstCaseOf(init.body,claudePrices(model))});throw Object.assign(Error('Dry-run capture; no network request authorized.'),{refused:true});}});}catch(e){if(!e.refused)throw e;}
   if(captures!==1)fail('Dry planning did not capture exactly one initial SDK request');
  }
 }
 const bodies=requests.map(r=>JSON.stringify(r.body)),cost=planCostOf(bodies,claudePrices(model)),initialInputBound=requests.reduce((n,r)=>n+r.conservativeBound.inputTokens,0),worstRequest=Math.max(...requests.map(r=>r.conservativeBound.dollars));
 return {version:VERSION,policyVersion:POLICY.id,...(bundle.recommendation?{recommendation:bundle.recommendation.version}:{}),...(bundle.cloClassification?{cloClassification:bundle.cloClassification.version}:{}),preparedHash:bundle.preparedHash,scope,mode:'dry-run',official:false,networkRequests:0,liveModelCalls:0,modelRequested:model,modelReturned:null,promptVersion:G.promptVersionOf(model,env)+'-'+POLICY.id+(bundle.recommendation?'-'+bundle.recommendation.version:'')+(bundle.cloClassification?'-'+bundle.cloClassification.version:''),limits,initialRequests:requests.length,selectedCases:bundle.scopes[scope].length,requests,cost:{...cost,prices:claudePriceTable(claudePrices(model)),currentPricesVerified:false,label:'Repository-pinned estimates, not a current quote or invoice',initialInputBound,initialBodyRepeatEstimate:limits.maxRequests*worstRequest,retryNote:'Correction/split requests can be larger; the actual request byte/token/spend guards apply before every send.',requestCap:limits.maxRequests,inputTokenCap:limits.maxInputTokens,outputTokenCap:limits.maxOutputTokens,spendingCap:limits.maxCost},budgetFitsInitial:requests.length<=limits.maxRequests&&initialInputBound<=limits.maxInputTokens&&requests.every(r=>r.conservativeBound.inputTokens<=limits.maxInputTokensPerRequest)&&cost.worst<=limits.maxCost&&requests.length*limits.maxOutputTokensPerRequest<=limits.maxOutputTokens};
}
function validateLimits(l){for(const k of ['maxRequests','maxInputTokens','maxInputTokensPerRequest','maxOutputTokens','maxOutputTokensPerRequest'])if(!Number.isInteger(l[k])||l[k]<1)fail('Invalid positive integer limit: '+k);if(l.maxOutputTokensPerRequest<1024||l.maxOutputTokensPerRequest>16000)fail('Output max_tokens must be1024-16000');if(!(l.maxCost>0&&l.maxCost<=AUTHORIZED_TOTAL))fail('Spending cap exceeds existing evaluation authorization ceiling');}
function authorize(receipt,bundle,scope,model,limits){
 if(!receipt||receipt.version!==VERSION||receipt.approved!==true||!receipt.approvedBy?.trim()||!receipt.receiptId?.trim()||!Number.isFinite(Date.parse(receipt.approvedAt))||receipt.preparedHash!==bundle.preparedHash||receipt.scope!==scope||receipt.model!==model||receipt.policyVersion!==POLICY.id||(receipt.recommendation??null)!==(bundle.recommendation?.version??null)||(receipt.cloClassification??null)!==(bundle.cloClassification?.version??null))fail('Explicit matching live authorization receipt required; no request sent');
 validateLimits(limits);for(const k of Object.keys(limits))if(!(receipt.limits?.[k]>=limits[k]))fail('Requested limit exceeds authorization: '+k);
 if(!Number.isFinite(Date.parse(receipt.expiresAt))||Date.parse(receipt.expiresAt)<=Date.now())fail('Authorization expired or missing expiry');
}
function freshDirectory(dir){const full=path.resolve(dir),allowed=[path.join(root,'docs/lcup-v2-evaluation'),path.join(root,'tmp/lcup-v2-evaluation')];if(!allowed.some(p=>full.startsWith(p+path.sep)||full.startsWith(p+'-')))fail('Output must be isolated to this evaluation docs/tmp namespace');if(fs.existsSync(full))fail('Output directory already exists; refusing overwrite');fs.mkdirSync(full,{recursive:true});return full;}
async function execute(bundle,scope,model,limits,{receipt,key,out,send=globalThis.fetch,testOnly=false}={}){
 if(testOnly&&send===globalThis.fetch)fail('Mock execution requires an explicitly blocked/mock transport');
 verifyBundle(bundle,model);authorize(receipt,bundle,scope,model,limits);if(!KEY_FORMAT.test(key||''))fail('Provide an Anthropic credential through process environment; never on command line');
 const planned=await dryPlan(bundle,scope,model,limits);if(!planned.budgetFitsInitial)fail('Initial plan exceeds authorized limits; no request sent');
 const dir=freshDirectory(out);fs.mkdirSync(path.join(dir,'raw'));write(path.join(dir,'plan.json'),planned);write(path.join(dir,'authorization.json'),receipt);
 // The original global spend register is reused only for an authorized live run.
 // Mock tests use their own new register and mark every output synthetic.
 const register=openSpendRegister(testOnly?path.join(dir,'mock-spend-register.json'):SPEND_REGISTER,{cap:AUTHORIZED_TOTAL}),env={...envFor(model,key),ANTHROPIC_MAX_TOKENS:String(limits.maxOutputTokensPerRequest)},records=[],raw=[],responses=[];let sequence=0,inputReserved=0,stopReason=null,activeContextId=null,activeRecommendation=null;
 const guard=createGuard({provider:'anthropic',model,maxRequests:limits.maxRequests,maxCost:limits.maxCost,maxTokens:limits.maxOutputTokensPerRequest,maxOutputTokens:limits.maxOutputTokens,maxTransient:1,maxInvalid:1,maxUnproductive:1,secrets:[key],register,ledgerFile:path.join(dir,'ledger.json'),check:(sent,entry)=>{try{if(!entry.modelReturned)return {invalid:'missing_model_provenance',verified:[]};const pairs=JSON.parse(sent.messages[0].content).document_data,judgments=G.verifyAnswer(entry.content,pairs,G.contractOf(env,null,activeRecommendation));return {verified:judgments.filter(j=>!j.unverified).map(j=>j.id)};}catch(e){return {invalid:e.code||'invalid_response',verified:[]};}},fetch:async(url,init)=>{
  const n=++sequence,body=JSON.parse(init.body),pairs=JSON.parse(body.messages[0].content).document_data,start=Date.now(),entry={request:n,caseIds:bundle.cases.filter(c=>c.contextId===activeContextId&&bundle.scopes[scope].includes(c.id)&&pairs.some(p=>p.id===c.pairId&&p.source===c.sourceText&&p.target===c.targetText)).map(c=>c.id),requestedModel:body.model,promptVersion:planned.promptVersion,requestBodyHash:hash(init.body),inputReferenceBindings:[]};
  entry.inputReferenceBindings=entry.caseIds.map(id=>{const c=bundle.cases.find(c=>c.id===id),ctx=bundle.contexts[c.contextId];return {id,inputHash:ctx.inputHash,referenceHash:ctx.referenceHash};});
  entry.requestFile='raw/'+String(n).padStart(3,'0')+'.request.json';fs.writeFileSync(path.join(dir,entry.requestFile),guard.redact(init.body),{flag:'wx'});
  try{const response=await send(url,init),text=guard.redact(await response.clone().text());entry.latencyMs=Date.now()-start;entry.status=response.status;entry.file='raw/'+String(n).padStart(3,'0')+'.json';entry.responseHash=hash(text);fs.writeFileSync(path.join(dir,entry.file),text,{flag:'wx'});try{const r=JSON.parse(text);entry.modelReturned=r.model||null;entry.tokenUsage=r.usage||null;}catch{entry.modelReturned=null;entry.tokenUsage=null;}raw.push(entry);return response;}catch(e){entry.latencyMs=Date.now()-start;entry.error=guard.redact(e.message);raw.push(entry);throw e;}
 }});
 const transport=async(url,init)=>{const bound=claudeWorstCaseOf(init.body,claudePrices(model));if(bound.inputTokens>limits.maxInputTokensPerRequest||inputReserved+bound.inputTokens>limits.maxInputTokens){guard.stop('Input token reservation limit exceeded');throw Object.assign(Error('Input token reservation limit exceeded'),{refused:true});}inputReserved+=bound.inputTokens;return guard.fetch(url,init);};
 try{for(const group of groupsOf(bundle,scope)){
  if(guard.stopped())break;activeContextId=group.contextId;activeRecommendation=recommendationOf(bundle,group.context,env);const result=await G.align(group.context.content,group.context.masters,{env,pairs:group.cases.map(c=>pairOf(c,group.context)),academicPolicy:POLICY.id,evaluationOnly:true,transport,skipEmpty:false,...(bundle.recommendation?{recommendation:bundle.recommendation.version}:{}),...(bundle.cloClassification?{cloClassification:bundle.cloClassification.version}:{})});
  responses.push({contextId:group.contextId,...result});for(const c of group.cases){const j=result.judgements.find(j=>j.id===c.pairId),provenance=raw.some(r=>r.caseIds.includes(c.id)&&r.modelReturned&&sameModel(r.modelReturned,model));records.push({id:c.id,caseHash:c.caseHash,attempted:raw.some(r=>r.caseIds.includes(c.id)),judgment:j&&!j.unverified&&provenance?j:null,unverified:j?.unverified||!provenance,failure:result.failure||(!provenance?{kind:'missing_or_unsupported_model_provenance'}:null),inputHash:group.context.inputHash,referenceHash:group.context.referenceHash});}
  if(result.status!=='completed'){stopReason='Unresolved/invalid/provider result; stop for review';guard.stop(stopReason);break;}
 }}catch(e){stopReason=guard.redact(e.message);guard.stop(stopReason);}finally{
  const summary=guard.summary();guard.saveLedger();closeLedger(path.join(dir,'ledger.json'),{reason:stopReason||guard.stopped()||'scope_complete'});guard.release();
  for(const id of bundle.scopes[scope])if(!records.some(r=>r.id===id)){const c=bundle.cases.find(c=>c.id===id);records.push({id,caseHash:c.caseHash,attempted:false,judgment:null,failure:'not_attempted_after_stop',inputHash:bundle.contexts[c.contextId].inputHash,referenceHash:bundle.contexts[c.contextId].referenceHash});}
  for(const entry of raw){const cost=guard.ledger.entries.find(x=>x.n===entry.request);Object.assign(entry,{estimatedCost:cost?.usage?.estimatedCost??null,guardCharge:cost?.charged??null,accounting:cost?.accounting??null});}
  const result={version:VERSION,policyVersion:POLICY.id,...(bundle.recommendation?{recommendation:bundle.recommendation.version}:{}),...(bundle.cloClassification?{cloClassification:bundle.cloClassification.version}:{}),preparedHash:bundle.preparedHash,benchmarkHash:bundle.benchmarkHash,scope,runId:path.basename(dir),official:false,productionActive:false,provenance:testOnly?'synthetic-test-only':'controlled-Claude-evaluation',modelRequested:model,promptVersion:planned.promptVersion,rawTranscriptHash:hash(raw),priceAsOf:PRICES_AS_OF,pricesVerifiedCurrent:false,limits,inputReserved,stopReason:stopReason||guard.stopped()||null,summary,raw,observations:records,responses};const safe=JSON.parse(guard.redact(JSON.stringify(result)));write(path.join(dir,'results.json'),safe);return safe;
 }
}
module.exports={VERSION,PROMPT_FILES,CLASSIFICATION_FILES,CLASSIFICATION_SMOKE,classifiedPairs,select,verifyBundle,envFor,limitsFor,dryPlan,authorize,freshDirectory,execute,groupsOf,pairOf,recommendationOf,write,root,hash};
