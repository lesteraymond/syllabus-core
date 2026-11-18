'use strict';
// Reporting only. No score/gate consumes this manifest. Evidence is collected from actual evaluator receipts, never inferred from a lack of findings.
// Rows: the fixed (no-AI) checks of ruleCatalog.js. Relationship instances: the new AI Checker's own questions (pipeline/official.js puts them in
// hybrid.alignment.judgements); before it has answered, there are none.
const {catalog,replaced} = require('./ruleCatalog');
const good = s => ['PASS','FAIL','NEEDS_REVIEW'].includes(s);
const normalize = s => ({PASS:'PASS',FAIL:'FAIL',NOT_EVALUATED:'NOT_CHECKED',NOT_CHECKED:'NOT_CHECKED',NOT_APPLICABLE:'NOT_APPLICABLE',NEEDS_REVIEW:'NEEDS_REVIEW'}[s] || 'NOT_CHECKED');
function summaryOf(rows) {
  return {catalogued:rows.length, implemented:rows.filter(r=>r.implemented).length, enabled:rows.filter(r=>r.enabled).length, applicable:rows.filter(r=>r.applicable).length,
    executed:rows.filter(r=>r.executed).length, attempted:rows.filter(r=>r.attempted).length, verified:rows.filter(r=>r.verified).length,
    failed:rows.filter(r=>r.status==='FAIL').length, needsReview:rows.filter(r=>r.status==='NEEDS_REVIEW').length, partiallyEvaluated:rows.filter(r=>r.status==='PARTIALLY_EVALUATED').length,
    notApplicable:rows.filter(r=>r.status==='NOT_APPLICABLE').length, notChecked:rows.filter(r=>r.status==='NOT_CHECKED').length};
}
function buildCoverage(result,content,masters={}) {
  const h=result.hybrid||{}, judgments=h.alignment?.judgements||[];
  const replanned=h.alignment?.engine==='re-planned';
  const receipt = (r, verified=good(normalize(r.status))) => ({id:r.id||r.ruleId,path:r.path||null,week:r.week??null,status:normalize(r.status),verified,attempted:r.attempted??verified,reused:!!r.reused,reason:r.reason||null});
  const rows=catalog.map(rule=>{
    let enabled=rule.implemented&&!replaced.includes(rule.ruleId),applicable=true,executed=false,reason=null,instances=[];
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
    } else if(rule.namespace==='quality') {
      const r=h.quality?.checks?.find(r=>r.ruleId===rule.ruleId);if(r){instances=[receipt(r)];applicable=r.applicable;executed=r.executed;}
    }
    if(!enabled) reason=reason||rule.requirement||'Implemented but disabled by configuration';
    if(!instances.length&&enabled&&applicable)reason=reason||'No evaluator receipt: missing evidence or unassessed scope. This is not a pass.';
    if(instances.length&&instances.every(r=>r.status==='NOT_APPLICABLE'))applicable=false;
    const relevant=instances.filter(r=>r.status!=='NOT_APPLICABLE');
    const verified=enabled&&applicable&&relevant.length>0&&relevant.every(r=>r.verified);
    const status=!enabled?'NOT_CHECKED':!applicable?'NOT_APPLICABLE':!instances.length?'NOT_CHECKED':!verified?(instances.some(r=>r.verified)?'PARTIALLY_EVALUATED':'NOT_CHECKED'):instances.some(r=>r.status==='FAIL')?'FAIL':instances.some(r=>r.status==='NEEDS_REVIEW')?'NEEDS_REVIEW':'PASS';
    const activationState=!rule.implemented?'NOT_IMPLEMENTED':!enabled?'IMPLEMENTED_BUT_DISABLED':verified?'ACTIVE':'IMPLEMENTED_BUT_NOT_EVALUATED';
    return {ruleId:rule.ruleId,category:rule.category,namespace:rule.namespace,implemented:rule.implemented,enabled,applicable,executed,attempted:instances.some(r=>r.attempted),verified,status,activationState,reason,...(replaced.includes(rule.ruleId)?{reasonCode:'replaced'}:{}),instances};
  });
  // The new AI Checker's questions, one receipt each ("rule" items are its fixed rules, already counted in the rows above)
  const replanReceipt=j=>{const answered=!j.unverified&&j.label!=='INSUFFICIENT_EVIDENCE';return {scope:'re-planned',id:j.id,path:j.path||null,week:null,status:answered?({ALIGNED:'PASS',NOT_ALIGNED:'FAIL',PARTIALLY_ALIGNED:'NEEDS_REVIEW'}[j.label]||'NOT_CHECKED'):'NOT_CHECKED',verified:answered,attempted:!!j.attempted,reused:!!j.reused,reason:answered?null:(j.explanation||'No valid answer').slice(0,300)};};
  const instanceList=replanned?judgments.filter(j=>j.status!=='rule'&&j.status!=='rule_review').map(replanReceipt):[];
  return {version:'rule-coverage-2',advisoryOnly:true,profile:'new-ai-checker',registeredStandard:47,directHybridRules:22,replacedRuleIds:replaced,
    counts:summaryOf(rows),byNamespace:Object.fromEntries([...new Set(rows.map(r=>r.namespace))].map(n=>[n,summaryOf(rows.filter(r=>r.namespace===n))])),
    relationshipInstances:{expected:instanceList.length,attempted:instanceList.filter(r=>r.attempted).length,verified:instanceList.filter(r=>r.verified).length,notChecked:instanceList.filter(r=>!r.verified).length,rows:instanceList},
    rules:rows,limitations:['The AI questions are the new AI Checker\'s; their checklists and versions are in hybrid.replan.','Model verification establishes response/evidence handling, not real-model academic accuracy or institutional approval.']};
}
function coverageOf(...args) {
  try { return buildCoverage(...args); }
  catch { return {version:'rule-coverage-2',advisoryOnly:true,unavailable:true,reason:'coverage_preparation_failed',registeredStandard:47,directHybridRules:22,counts:summaryOf([]),rules:[],relationshipInstances:{expected:null,attempted:0,verified:0,notChecked:null,rows:[]}}; }
}
module.exports={coverageOf,summaryOf};
