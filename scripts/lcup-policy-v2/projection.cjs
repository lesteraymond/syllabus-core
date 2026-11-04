'use strict';
// Offline reporting projection, never imported by server/src. It consumes existing
// pair definitions and verified observations; it does not judge academic meaning,
// run a provider, apply deductions or decide a submission.
const crypto=require('node:crypto');
const {pairsOf,evidenceQuote}=require('../../server/lib/syllabuscheck/gemini');
const fit=require('../../server/lib/syllabuscheck/lessonfit');
const {examLike,weeksIn}=require('../../server/lib/syllabuscheck/planrows');
const {buildVerdict}=require('../../server/lib/syllabuscheck/verdict');
const VERSION='academic-evaluation-v2-proposal-1';
const TYPES=['Content-course','Content-ILO','ILO-CLO','Content-activity','ILO-activity','Content-assessment','Activity-assessment'];
const contextKey=pair=>crypto.createHash('sha256').update(JSON.stringify([pair.id,pair.type,pair.source,pair.target])).digest('hex');
function manifestFor(content,masters){
 const rows=(content.plan||[]).map((row,i)=>({row,i})).filter(({row})=>!examLike(row));
 // These switches are pair-builder arguments, not runtime feature flags. No
 // optional stage/provider is activated; existing factories plan the questions.
 const pairs=[...pairsOf(content,masters,[],{stageA:true,stageB:true,stageB4:false}),...fit.chainPairs(content,rows.map(r=>r.i))];
 const cells=rows.flatMap(({row,i})=>TYPES.map(type=>{
  const inRow=pairs.filter(p=>p.type===type&&p.id.startsWith(`row${i}-`));
  const iloType=['Content-ILO','ILO-CLO','ILO-activity'].includes(type);
  const groups=iloType?(row.ilos?.length?row.ilos:[null]).map((_,j)=>inRow.filter(p=>p.id.startsWith(`row${i}-ilo${j}-`)).map(p=>p.id)):[inRow.map(p=>p.id)];
  return {id:`lesson${i}:${type}`,type,row:i,week:String(row.week||''),weeks:weeksIn(row.week),groups,quantifier:type==='ILO-CLO'?'one_supported_CLO_per_ILO':'all'};
 }));
 return {pairs,cells,lessons:rows.length,examRows:(content.plan||[]).length-rows.length};
}
function observationOf(pair,list){
 const matches=list.filter(j=>j.id===pair.id);
 if(matches.length!==1)return {status:'NOT_CHECKED',reason:matches.length?'duplicate_observation':'no_observation'};
 const j=matches[0];
 if(j.contextHash!==contextKey(pair))return {status:'NOT_CHECKED',reason:'context_changed'};
 if(j.unverified||j.label==='INSUFFICIENT_EVIDENCE')return {status:'NOT_CHECKED',reason:j.failureKind||'insufficient_evidence'};
 if(!pair.source.trim()||!pair.target.trim()||!j.explanation?.trim()||!evidenceQuote(pair.source,j.sourceQuote)||!evidenceQuote(pair.target,j.targetQuote))return {status:'NOT_CHECKED',reason:'unverified_evidence'};
 const status={ALIGNED:'SUPPORTED',PARTIALLY_ALIGNED:'PARTIAL',NOT_ALIGNED:'NOT_SUPPORTED'}[j.label];
 return status?{status,reason:null}:{status:'NOT_CHECKED',reason:'invalid_label'};
}
const allOf=statuses=>statuses.includes('NOT_SUPPORTED')?'NOT_SUPPORTED':statuses.includes('NOT_CHECKED')||!statuses.length?'NOT_CHECKED':statuses.includes('PARTIAL')?'PARTIAL':'SUPPORTED';
const REQUIREMENTS=[
 ['approved_course_identity',['CUR-02','CUR-03','CUR-04']],['description_fits_title',['CUR-11']],
 ['four_CLOs',['CLO-01']],['CLO_course_relevance',['CLO-03']],['CLO_PO_alignment',['CLO-06']],['CLO_EGA_alignment',['CLO-07']],['CLO_classifications',['CLO-08']],
 ['weeks_1_to_18',['PLAN-01']],['week1_introduction_objectives',['PLAN-11']],['diverse_learner_support',['ALN-06']],
 ['approved_value_names',['VAL-01']],['meaningful_value_integration',['VAL-02']],['APA7_text_subset',['REF-02','REF-03']],
];
function originalRequirements(report,content){
 const findings=buildVerdict(report,content,{all:true}).all;
 return REQUIREMENTS.map(([requirement,ids])=>{
  const scoped=ids.flatMap(id=>{const found=findings.filter(f=>f.ruleId===id);return found.length?found:[{ruleId:id,status:'NOT_CHECKED'}];});
  const statuses=scoped.map(f=>f.status);
  return {requirement,status:statuses.includes('FAIL')?'EXISTING_CHECK_FAILURE':statuses.includes('NOT_CHECKED')?'NOT_CHECKED':statuses.includes('NEEDS_REVIEW')?'FACULTY_REVIEW':statuses.every(s=>s==='PASS'||s==='NOT_APPLICABLE')?'SUPPORTED':'NOT_CHECKED',ruleIds:ids,
   context:statuses.includes('FAIL')?'Review the source/reference and institutional-policy context before attributing this existing finding to faculty error.':null,
   limitation:requirement==='APA7_text_subset'?'Text parsing does not certify italics, hanging indentation or complete APA compliance.':null};
 });
}
function project({content,masters,report,observations=[],rootGroups=[],provenance='unavailable'}){
 const manifest=manifestFor(content,masters),byPair=new Map(manifest.pairs.map(p=>[p.id,p]));
 const raw=new Map(manifest.pairs.map(p=>[p.id,observationOf(p,observations)]));
 const cells=manifest.cells.map(cell=>{
  let mappingReview=false;
  const groupStates=cell.groups.map(ids=>{
   const states=ids.map(id=>raw.get(id)?.status||'NOT_CHECKED');
   if(cell.quantifier==='one_supported_CLO_per_ILO'&&states.includes('SUPPORTED')){
    if(states.some(s=>s!=='SUPPORTED'))mappingReview=true;
    return 'SUPPORTED';
   }
   // No supported tag yet: an unanswered tag is unknown, not proof of no fit.
   if(cell.quantifier==='one_supported_CLO_per_ILO')return !states.length||states.includes('NOT_CHECKED')?'NOT_CHECKED':states.includes('PARTIAL')?'PARTIAL':'NOT_SUPPORTED';
   return allOf(states);
  });
  return {...cell,status:allOf(groupStates),complete:cell.groups.every(ids=>ids.length&&ids.every(id=>raw.get(id)?.status!=='NOT_CHECKED')),mappingReview,
   evidence:cell.groups.flat().map(id=>({id,...raw.get(id),type:byPair.get(id)?.type,observations:observations.filter(j=>j.id===id).map(j=>({label:j.label,explanation:j.explanation,sourceQuote:j.sourceQuote,targetQuote:j.targetQuote,recommendation:j.draft||'',contextHash:j.contextHash}))}))};
 });
 const counts={SUPPORTED:0,PARTIAL:0,NOT_SUPPORTED:0,NOT_CHECKED:0};for(const cell of cells)counts[cell.status]++;
 const complete=cells.length>0&&cells.every(c=>c.complete);
 const mappingReview=cells.some(c=>c.mappingReview);
 const disposition=counts.NOT_SUPPORTED?'REQUIRES_REVISION':counts.PARTIAL||mappingReview?'FACULTY_REVIEW':!complete?(cells.some(c=>c.status!=='NOT_CHECKED')?'PARTIALLY_EVALUATED':'NOT_EVALUATED'):'SUPPORTED_BY_SUPPLIED_EVIDENCE';
 // Descriptive bounds only: partial/unknown can contribute anywhere from 0 to 1.
 // No partial credit or institutionally approved relationship weights are invented.
 const lower=cells.length?100*counts.SUPPORTED/cells.length:null;
 const upper=cells.length?100*(counts.SUPPORTED+counts.PARTIAL+counts.NOT_CHECKED)/cells.length:null;
 const failureIds=new Set(cells.filter(c=>c.status==='NOT_SUPPORTED'||c.status==='PARTIAL'||c.mappingReview).flatMap(c=>c.groups.flat()).filter(id=>raw.get(id)?.status!=='SUPPORTED'));
 const assigned=new Set(),roots=[];
 for(const group of rootGroups){
  if(!group.basis||!['controlled_scenario_assumption','faculty_confirmed'].includes(group.provenance))throw Error('Explicit root-cause provenance required');
  const ids=[...new Set(group.pairIds.filter(id=>failureIds.has(id)))];
  if(ids.some(id=>assigned.has(id)))throw Error('Overlapping root declarations require review');
  if(ids.length){ids.forEach(id=>assigned.add(id));roots.push({...group,pairIds:ids});}
 }
 const other=originalRequirements(report,content);
 const legacy=(report.hybrid?.alignment?.judgements||[]).filter(j=>j.type==='ILO-assessment');
 const legacyIds=new Set(legacy.map(j=>`SEM:${j.id}`));
 const legacyPoints=(report.hybrid?.deductions||[]).filter(d=>legacyIds.has(d.id)).reduce((n,d)=>n+d.points,0);
 const legacyAlternative=report.hybrid?.alignment?.status==='completed'&&!report.hybrid?.critical&&typeof report.hybrid?.provisionalScore==='number'?Math.min(report.hybrid.baseScore,report.hybrid.provisionalScore+legacyPoints):null;
 return {version:VERSION,official:false,provenance,facultyValidated:false,officialAcademicScore:null,officialPassDecision:null,
  current:{publishedScore:report.score??null,baseScore:report.hybrid?.baseScore??report.baseScore??null,provisionalScore:report.hybrid?.provisionalScore??null,policy:report.hybrid?.scoring?.official?.policy||'syllabus-policy-2',deductions:structuredClone(report.hybrid?.deductions||[]),ready:report.hybrid?.ready??false},
  weekly:{lessons:manifest.lessons,examRows:manifest.examRows,cells,counts,coverage:cells.length?cells.filter(c=>c.complete).length/cells.length:null,complete,disposition,
   descriptiveSupportBoundsPct:{lower,upper},typeSummary:TYPES.map(type=>({type,...Object.fromEntries(Object.keys(counts).map(s=>[s,cells.filter(c=>c.type===type&&c.status===s).length]))}))},
  remediation:{declaredRoots:roots,declaredRootCount:roots.length,ungroupedEvidence:[...failureIds].filter(id=>!assigned.has(id)),deductionPoints:null,warning:'A shared field is not proof of a shared cause; unknown causes are not merged.'},
  legacyIloAssessment:{proposedTreatment:'advisory_only_not_activated',observations:legacy.map(j=>({id:j.id,label:j.label,unverified:!!j.unverified,explanation:j.explanation,sourceQuote:j.sourceQuote,targetQuote:j.targetQuote})),currentDeductionPoints:legacyPoints,arithmeticOnlyAlternatives:{keepScored:report.hybrid?.provisionalScore??null,advisory:legacyAlternative,retired:legacyAlternative},limitation:'Arithmetic holds every other answer fixed. Retirement would remove a diagnostic and require C2 trigger redesign; that behavior is not simulated. These are not Policy V2 grades.'},
  otherOriginalRequirements:other,overallAcademicDisposition:disposition==='REQUIRES_REVISION'?'REQUIRES_REVISION':other.some(r=>r.status==='EXISTING_CHECK_FAILURE')?'SOURCE_OR_REQUIREMENT_REVIEW_REQUIRED':!complete||other.some(r=>r.status!=='SUPPORTED')?'ACADEMIC_REVIEW_INCOMPLETE':'FACULTY_VALIDATION_REQUIRED',
  decisions:'No new official score, grade threshold, submission decision or faculty judgment is produced.'};
}
module.exports={VERSION,TYPES,contextKey,manifestFor,project,originalRequirements};
