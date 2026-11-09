'use strict';
// Reporting only. No score/gate consumes this manifest. Evidence is collected
// from actual evaluator receipts, never inferred from a lack of findings.
const {catalog,replaced} = require('./ruleCatalog');
const profile = require('./checkingProfile');
const v2Activation = require('./academicV2Activation');
const good = s => ['PASS','FAIL','NEEDS_REVIEW'].includes(s);
const normalize = s => ({PASS:'PASS',FAIL:'FAIL',NOT_EVALUATED:'NOT_CHECKED',NOT_CHECKED:'NOT_CHECKED',NOT_APPLICABLE:'NOT_APPLICABLE',NEEDS_REVIEW:'NEEDS_REVIEW',SUPPORTED_BY_SUPPLIED_EVIDENCE:'PASS',REQUIRES_REVISION:'FAIL',FACULTY_REVIEW:'NEEDS_REVIEW',PARTIALLY_EVALUATED:'PARTIALLY_EVALUATED'}[s] || 'NOT_CHECKED');
function summaryOf(rows) {
  return {catalogued:rows.length, implemented:rows.filter(r=>r.implemented).length, enabled:rows.filter(r=>r.enabled).length, applicable:rows.filter(r=>r.applicable).length,
    executed:rows.filter(r=>r.executed).length, attempted:rows.filter(r=>r.attempted).length, verified:rows.filter(r=>r.verified).length,
    failed:rows.filter(r=>r.status==='FAIL').length, needsReview:rows.filter(r=>r.status==='NEEDS_REVIEW').length, partiallyEvaluated:rows.filter(r=>r.status==='PARTIALLY_EVALUATED').length,
    notApplicable:rows.filter(r=>r.status==='NOT_APPLICABLE').length, notChecked:rows.filter(r=>r.status==='NOT_CHECKED').length};
}
function buildCoverage(result,content,masters={},env={}) {
  const h=result.hybrid||{}, v2=h.academicV2, judgments=h.alignment?.judgements||[], records=v2?.academic?.relationships||[];
  // Optional supporting questions the planned budget did not cover (gemini.js createRequestBudget): never sent, so never a pass or a fail.
  const deferredIds=new Set(judgments.filter(j=>j.failureKind==='budget_deferred').map(j=>j.id));
  let verdict=[];
  try { if(h.verdict&&!h.verdict.unavailable) verdict=require('./verdict').buildVerdict(result,content,{all:true}).all; } catch { /* unavailable remains visible */ }
  const entries=h.references||[], hasLessons=(content.plan||[]).some(r=>r.kind!=='exam');
  const receipt = (r, verified=good(normalize(r.status))) => ({id:r.id||r.ruleId,path:r.path||null,week:r.week??null,status:normalize(r.status),verified,attempted:r.attempted??verified,reused:!!r.reused,reason:r.reason||null});
  const semantic = j => receipt({...j,status:j.unverified||j.label==='INSUFFICIENT_EVIDENCE'?'NOT_CHECKED':({ALIGNED:'PASS',NOT_ALIGNED:'FAIL',PARTIALLY_ALIGNED:'NEEDS_REVIEW'}[j.label]),attempted:!!j.attempted},!j.unverified&&!!j.evidenceMatching&&j.label!=='INSUFFICIENT_EVIDENCE');
  const unasked = pair => ({id:pair.id,path:pair.path||null,status:'NOT_CHECKED',verified:false,attempted:false,reused:false,reason:'No verified evaluator response for this planned instance'});
  const merge = (expected,actual) => {const byId=new Map(actual.map(r=>[r.id,r]));return [...expected.map(p=>byId.get(p.id)||unasked(p)),...actual.filter(r=>!expected.some(p=>p.id===r.id))];};
  let planned=[];
  try {planned=require('./academicV2Plan').plan(content,masters).pairs;} catch { /* report malformed/unavailable rather than certify */ }
  const v2Types=new Set([...require('./academicV2Plan').POLICY.weeklyTypes,'Course-CLO','CLO-PO','CLO-EGA','CLO-classification','Title-description','Description-plan']);
  const v2Receipts=merge(planned.filter(p=>v2Types.has(p.type)),records.map(r=>receipt(r,r.verification==='quotes_verified'&&r.academicJudgment!==null)));
  const rows=catalog.map(rule=>{
    let enabled=rule.implemented&&!replaced.includes(rule.ruleId),applicable=true,executed=false,reason=null,instances=[];
    if(rule.flag) enabled=rule.flag==='SYLLABUS_CHECK_REF_VERIFY=crossref'?String(env.SYLLABUS_CHECK_REF_VERIFY).toLowerCase()==='crossref':String(env[rule.flag]).toLowerCase()==='on';
    if(rule.namespace==='registered_standard') {
      const r=(result.ruleChecks||[]).find(r=>r.ruleId===rule.ruleId);
      if(r){executed=true;instances=[receipt(r)];applicable=r.items>0;}
      if(replaced.includes(rule.ruleId)){applicable=false;reason='Superseded by link verification. Legacy count/year/age heuristics are not equivalent to authenticity or APA checks and are not restored.';}
      if(rule.ruleId==='P-03'&&(content.clos||[]).some(c=>(c.pos||[]).some(no=>!(content.outcomes?.pos||content.catalog?.program?.pos||masters.pos||[]).find(p=>String(p.no)===String(no))?.egas?.length))){
        instances=instances.map(r=>({...r,status:'NOT_CHECKED',verified:false}));reason='Approved PO-to-EGA crosswalk is unavailable for one or more selected POs. A vacuous legacy pass is not verified mapping consistency; existing score is unchanged.';
      }
    } else if(rule.namespace==='hybrid_validation') {
      instances=(h.codedChecks||[]).filter(r=>r.ruleId===rule.ruleId).map(r=>receipt(r));
      if(rule.ruleId==='AI-REQUIRED')instances=[receipt({ruleId:rule.ruleId,status:h.alignment?.status==='completed'?'PASS':'NOT_CHECKED',attempted:judgments.some(j=>j.attempted)})];
      executed=instances.length>0;
      if(['INST-MASTER','PO-MASTER'].includes(rule.ruleId)&&!instances.length){applicable=false;executed=true;reason='Missing-reference branch is not applicable: the available master is checked by the corresponding EXACT rule.';}
      if(rule.ruleId==='LINK'&&!instances.length){applicable=false;reason=h.critical?'Course identity stopped reference requests':'No reference URLs to verify';}
    } else if(rule.namespace==='semantic_type') {
      instances=judgments.filter(j=>j.type===rule.type).map(semantic);executed=instances.some(r=>r.attempted||r.verified);
      applicable=rule.type==='REF-plan'? (h.links||[]).some(l=>l.status==='ok'&&(l.page?.title||l.page?.text)):rule.type.startsWith('CLO')?(content.clos||[]).length>0:hasLessons;
      if(rule.type==='Description-plan')applicable=true;
      // V2 owns this baseline advisory question under the comprehensive profile.
      if(profile.enabled(env)&&rule.type==='Description-plan')instances=records.filter(r=>r.relationshipType===rule.type).map(r=>receipt(r,r.verification==='quotes_verified'&&r.academicJudgment!==null));
    } else if(rule.namespace==='vpaa_type') {
      instances=merge(planned.filter(p=>p.type===rule.type),records.filter(r=>r.relationshipType===rule.type).map(r=>receipt(r,r.verification==='quotes_verified'&&r.academicJudgment!==null)));
      applicable=hasLessons;executed=instances.some(r=>r.attempted||r.verified);
    } else if(rule.namespace==='classification') {
      const clo=content.clos?.[rule.index];
      if(rule.kind==='structure') {const actual=String(clo?.level||'').trim();instances=[receipt({id:rule.ruleId,path:`clos[${rule.index}].level`,status:actual.toLowerCase()===rule.name.toLowerCase()?'PASS':'FAIL'})];executed=true;}
      else {instances=records.filter(r=>r.id===`clo${rule.index}-classification`).map(r=>receipt(r,r.verification==='quotes_verified'&&r.academicJudgment!==null));executed=instances.some(r=>r.attempted||r.verified);}
    } else if(rule.namespace==='quality') {
      const r=h.quality?.checks?.find(r=>r.ruleId===rule.ruleId);if(r){instances=[receipt(r)];applicable=r.applicable;executed=r.executed;}
    } else if(rule.namespace==='reference_subcheck') {
      applicable=entries.some(e=>e.checkedCodes?.includes(rule.name));
      instances=entries.filter(e=>e.checkedCodes?.includes(rule.name)).map(e=>receipt({id:e.path+':'+rule.name,path:e.path,status:e.issues.some(i=>i.code===rule.name)?e.issues.some(i=>i.code===rule.name&&i.severity==='definite')?'FAIL':'NEEDS_REVIEW':'PASS'}));executed=enabled&&instances.length>0;
      if(!enabled)applicable=true;
    } else if(rule.namespace==='external') {
      instances=entries.filter(e=>e.components?.doi).map(e=>receipt({id:e.path,path:e.path,status:e.authenticity?.status==='verified'?'PASS':['mismatch','not_found'].includes(e.authenticity?.status)?'NEEDS_REVIEW':'NOT_CHECKED',attempted:!!e.authenticity?.source}));
      applicable=entries.some(e=>e.components?.doi);executed=instances.some(r=>r.attempted);reason='Authenticity requires explicit external lookup; the comprehensive profile never enables it.';
    } else if(rule.namespace==='verdict_rule'||rule.namespace==='report_alias') {
      const scoped=verdict.filter(r=>r.ruleId===rule.ruleId&&(!rule.type||!rule.stage||r.legacyRuleId===rule.type));
      instances=scoped.map(r=>({...receipt(r,r.method==='ai_semantic'?good(normalize(r.status))&&['quotes_verified','structured_field'].includes(r.verification):good(normalize(r.status))),id:r.relationshipId||r.id||r.ruleId,attempted:r.method==='ai_semantic'?!!judgments.find(j=>j.id===r.relationshipId)?.attempted:good(normalize(r.status))}));
      if(rule.stage&&rule.type){
        let expected=planned.filter(p=>p.type===rule.type);
        if(rule.type==='ILO-anyCLO'){
          const m=require('./mapping');expected=m.anyCloPairs(content,m.iloCandidates(content,judgments));
          if(!expected.length&&judgments.some(j=>j.type==='ILO-CLO')&&judgments.filter(j=>j.type==='ILO-CLO').every(j=>!j.unverified&&j.label==='ALIGNED')){applicable=false;reason='Conditional fallback not applicable: existing mapped CLO relationships were supported.';}
        }
        if(rule.type==='Ref-relevance')expected=entries.map(e=>({id:`ref-${e.group}-${e.index}`,path:e.path}));
        // Bind verdict aspect receipts to model instance ids, keeping unasked or
        // unassessed diagnostics visible even when the scored base type passed.
        instances=merge(expected,instances);
      }
      // A single model relationship cannot verify a missing structured aspect.
      if(['ALN-06','ALN-08','ALN-09'].includes(rule.ruleId))instances=instances.map(r=>({...r,verified:r.verified&&r.status!=='NOT_CHECKED'}));
      if(rule.stage&&v2Activation.enabled(env)&&['CLO-03','PLAN-03','ALN-01','ALN-11','ALN-12','ALN-13','CUR-11'].includes(rule.ruleId)){
        enabled=true;instances=records.filter(r=>r.relationshipType===rule.type).map(r=>receipt(r,r.verification==='quotes_verified'&&r.academicJudgment!==null));
      }
      executed=instances.some(r=>r.verified||r.attempted);
      if(['STR-05','PLAN-02','CLO-02'].includes(rule.ruleId)&&h.verdict&&!h.verdict.unavailable&&!instances.length){executed=true;applicable=rule.ruleId==='CLO-02'?(content.clos||[]).length>1:rule.ruleId==='PLAN-02'?(content.plan||[]).some(r=>require('./validation').weeksOf(r.week)?.includes(1)):true;if(applicable)instances=[receipt({ruleId:rule.ruleId,status:'PASS'})];}
    }
    if(!enabled) reason=reason||rule.requirement||'Implemented but disabled by configuration';
    if(!instances.length&&enabled&&applicable)reason=reason||'No evaluator receipt: missing evidence, stage dependency, request cap, provider unavailable or unassessed scope. This is not a pass.';
    if(instances.length&&instances.every(r=>r.status==='NOT_APPLICABLE'))applicable=false;
    const relevant=instances.filter(r=>r.status!=='NOT_APPLICABLE');
    const verified=enabled&&applicable&&relevant.length>0&&relevant.every(r=>r.verified);
    const status=!enabled?'NOT_CHECKED':!applicable?'NOT_APPLICABLE':!instances.length?'NOT_CHECKED':!verified?(instances.some(r=>r.verified)?'PARTIALLY_EVALUATED':'NOT_CHECKED'):instances.some(r=>r.status==='FAIL')?'FAIL':instances.some(r=>r.status==='NEEDS_REVIEW')?'NEEDS_REVIEW':'PASS';
    const budgetDeferred=['NOT_CHECKED','PARTIALLY_EVALUATED'].includes(status)&&instances.some(r=>r.status==='NOT_CHECKED'&&deferredIds.has(r.id));
    const activationState=rule.pendingState||(!rule.implemented?'NOT_IMPLEMENTED':!enabled?'IMPLEMENTED_BUT_DISABLED':verified?'ACTIVE':'IMPLEMENTED_BUT_NOT_EVALUATED');
    return {ruleId:rule.ruleId,category:rule.category,namespace:rule.namespace,implemented:rule.implemented,enabled,applicable,executed,attempted:instances.some(r=>r.attempted),verified,status,activationState,reason,...(budgetDeferred?{reasonCode:'budget_deferred'}:replaced.includes(rule.ruleId)?{reasonCode:'replaced'}:{}),instances};
  });
  const flags=h.stages||{};
  let legacyPlan=[];
  try {
    legacyPlan=require('./gemini').pairsOf(content,masters,h.links||[],{stageA:flags.a,stageB:flags.b,stageB4:flags.b4});
    if(profile.enabled(env)&&v2Activation.enabled(env))legacyPlan=legacyPlan.filter(p=>!profile.V2_ADVISORY.includes(p.type));
    const extras=new Set([...(flags.c1?['Activity-fit']:[]),...(flags.c2?['Assessment-fit']:[]),...(flags.c3?['Content-activity','Content-assessment','Activity-assessment']:[]),...(flags.d1?['Value-use']:[]),...(flags.d2?['Ref-relevance']:[]),...(flags.requirements?['Week1-introduction',...(profile.enabled(env)?[]:['Title-description'])]:[])]);
    legacyPlan=[...new Map([...legacyPlan,...planned.filter(p=>extras.has(p.type))].map(p=>[p.id,p])).values()];
  } catch { /* rule-level missing receipts still disclose malformed planning */ }
  const instanceList=[...merge(legacyPlan,judgments.map(semantic)).map(r=>({scope:'legacy',...r})),...(v2Activation.enabled(env)?v2Receipts.map(r=>({scope:'policy-v2',...r})):[])];
  return {version:'rule-coverage-1',advisoryOnly:true,profile:profile.enabled(env)?profile.NAME:'existing-flags',registeredStandard:47,directHybridRules:44,replacedRuleIds:replaced,
    counts:summaryOf(rows),byNamespace:Object.fromEntries([...new Set(rows.map(r=>r.namespace))].map(n=>[n,summaryOf(rows.filter(r=>r.namespace===n))])),
    relationshipInstances:{expected:instanceList.length,attempted:instanceList.filter(r=>r.attempted).length,verified:instanceList.filter(r=>r.verified).length,notChecked:instanceList.filter(r=>!r.verified).length,rows:instanceList},
    ...(h.budget?{budget:{planned:h.budget.planned,deferredOptional:h.budget.deferredOptional,requiredIncomplete:h.budget.requiredIncomplete,exhausted:h.budget.exhausted,stopReason:h.budget.stopReason,limits:h.budget.limits,used:h.budget.used,...(h.budget.advice?{advice:h.budget.advice}:{})}}:{}),
    rules:rows,limitations:['Catalogue includes report aliases and reference subchecks, not additional registered compliance rules.','Model verification establishes response/evidence handling, not real-model academic accuracy or institutional approval.','Unasked factory scope/caps cannot certify unseen evidence.']};
}
function coverageOf(...args) {
  try { return buildCoverage(...args); }
  catch { return {version:'rule-coverage-1',advisoryOnly:true,unavailable:true,reason:'coverage_preparation_failed',registeredStandard:47,directHybridRules:44,counts:summaryOf([]),rules:[],relationshipInstances:{expected:null,attempted:0,verified:0,notChecked:null,rows:[]}}; }
}
module.exports={coverageOf,summaryOf};
