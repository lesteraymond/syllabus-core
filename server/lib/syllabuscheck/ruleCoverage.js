'use strict';
// Reporting only. No score/gate consumes this manifest. Evidence is collected from actual evaluator receipts, never inferred from a lack of findings.
// Rows: the fixed (no-AI) checks of ruleCatalog.js (the form standard, the institutional validation rules, the quality notes) and, on a report of the
// new AI Checker, its own fixed rules (pipeline/fixedRules.js, recorded in hybrid.replan.fixedRules; namespace new_ai_checker). Relationship instances:
// its AI questions (hybrid.alignment.judgements), one receipt each, and aiQuestions, the same counted by kind. A report the new checker did not make has
// neither (no synthetic coverage).
const {catalog,replaced} = require('./ruleCatalog');
const standardRules = Object.fromEntries(require('../compliance/standard-v4.json').rules.map(r => [r.id, r]));
// Why a row does not apply to this syllabus, as a code the panel words (hybrid.reason.<code>, English and Filipino). Before, six rows had no reason at all and
// the rest gave English-only technical text.
function notApplicableCode(rule, h) {
  const std = standardRules[rule.ruleId];
  if (std?.check === 'equalsCatalog') return 'checked_by_exact';             // T-09..T-12: INST-EXACT and PO-EXACT compare them with the program setup
  if (std?.check === 'gradingFormula' && std.params?.mode === 'overrideFilled') return 'no_override';
  if (std?.check === 'signoffRoles') return 'signoff_by_system';
  if (['INST-MASTER', 'PO-MASTER'].includes(rule.ruleId)) return 'master_present';
  if (rule.ruleId === 'LINK') return h.critical ? 'identity_stopped' : 'no_reference_urls';
  return 'not_applicable';
}
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
  // The syllabus's POs that are not linked to any EGA (the PO list P-03 reads). The link is required (2026-11-20) but older programs may lack it: the report
  // says so at the top (RuleCoveragePanel), and nothing is blocked. [] when every PO is linked, null when the syllabus has no POs.
  const poList=content.outcomes?.pos||content.catalog?.program?.pos||masters.pos||[];
  const posWithoutEga=poList.length?poList.filter(p=>!(p.egas||[]).length).map(p=>p.no):null;
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
    const reasonCode=replaced.includes(rule.ruleId)?'replaced':status==='NOT_APPLICABLE'?notApplicableCode(rule,h):null;
    return {ruleId:rule.ruleId,category:rule.category,namespace:rule.namespace,implemented:rule.implemented,enabled,applicable,executed,attempted:instances.some(r=>r.attempted),verified,status,activationState,reason,...(reasonCode?{reasonCode}:{}),instances};
  });
  // The new AI Checker's own fixed rules: each one ran; no finding is a pass, a finding needs revision, a review item needs a person to confirm
  if(replanned)for(const r of h.replan?.fixedRules||[]){
    const found=r.findings||[], instances=found.length?found.map(f=>receipt({id:r.ruleId,path:f.path,status:f.status})):[receipt({id:r.ruleId,status:'PASS'})];
    const status=instances.some(i=>i.status==='FAIL')?'FAIL':instances.some(i=>i.status==='NEEDS_REVIEW')?'NEEDS_REVIEW':'PASS';
    rows.push({ruleId:r.ruleId,category:'new_ai_checker_rule',namespace:'new_ai_checker',implemented:true,enabled:true,applicable:true,executed:true,attempted:true,verified:true,status,activationState:'ACTIVE',reason:null,instances});
  }
  // The new AI Checker's questions, one receipt each (its "rule" judgements are the fixed rules above)
  const replanReceipt=j=>{const answered=!j.unverified&&j.label!=='INSUFFICIENT_EVIDENCE';return {scope:'re-planned',id:j.id,path:j.path||null,week:null,status:answered?({ALIGNED:'PASS',NOT_ALIGNED:'FAIL',PARTIALLY_ALIGNED:'NEEDS_REVIEW'}[j.label]||'NOT_CHECKED'):'NOT_CHECKED',verified:answered,attempted:!!j.attempted,reused:!!j.reused,reason:answered?null:(j.explanation||'No valid answer').slice(0,300)};};
  const instanceList=replanned?judgments.filter(j=>j.status!=='rule'&&j.status!=='rule_review').map(replanReceipt):[];
  // the same questions counted by kind (the relationship is the first part of the question id: "ILO-CONTENT|ilo:i3"), in the order they were asked
  const kinds=new Map();
  for(const q of instanceList){const k=String(q.id).split('|')[0];if(!kinds.has(k))kinds.set(k,{relationship:k,asked:0,passed:0,failed:0,review:0,notChecked:0});const c=kinds.get(k);c.asked++;c[{PASS:'passed',FAIL:'failed',NEEDS_REVIEW:'review'}[q.status]||'notChecked']++;}
  const aiQuestions=replanned?{asked:instanceList.length,answered:instanceList.filter(r=>r.verified).length,byRelationship:[...kinds.values()]}:null;
  return {version:'rule-coverage-2',advisoryOnly:true,profile:'new-ai-checker',registeredStandard:47,directHybridRules:22,replacedRuleIds:replaced,aiQuestions,posWithoutEga,
    counts:summaryOf(rows),byNamespace:Object.fromEntries([...new Set(rows.map(r=>r.namespace))].map(n=>[n,summaryOf(rows.filter(r=>r.namespace===n))])),
    relationshipInstances:{expected:instanceList.length,attempted:instanceList.filter(r=>r.attempted).length,verified:instanceList.filter(r=>r.verified).length,notChecked:instanceList.filter(r=>!r.verified).length,rows:instanceList},
    rules:rows,limitations:['The AI questions are the new AI Checker\'s; their checklists and versions are in hybrid.replan.','Model verification establishes response/evidence handling, not real-model academic accuracy or institutional approval.']};
}
function coverageOf(...args) {
  try { return buildCoverage(...args); }
  catch { return {version:'rule-coverage-2',advisoryOnly:true,unavailable:true,reason:'coverage_preparation_failed',registeredStandard:47,directHybridRules:22,aiQuestions:null,counts:summaryOf([]),rules:[],relationshipInstances:{expected:null,attempted:0,verified:0,notChecked:null,rows:[]}}; }
}
module.exports={coverageOf,summaryOf};
