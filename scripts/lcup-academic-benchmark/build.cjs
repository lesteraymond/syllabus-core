'use strict';
// Benchmark preparation only. Reuses Policy V2's planner; never evaluates meaning.
const fs=require('node:fs'),path=require('node:path');
const {POLICY,plan,hash}=require('../../server/lib/syllabuscheck/academicV2Plan');
const {assessmentPairs}=require('../../server/lib/syllabuscheck/lessonfit');
const {NEEDS_IDENTITY}=require('../../server/lib/syllabuscheck/identity');
const {coded}=require('../../server/lib/syllabuscheck/engine');
const {toCsv}=require('../import-align1-faculty-responses.cjs');
const {root,references,fileRef}=require('./references.cjs');
const {synthetic}=require('./synthetic.cjs');
const VERSION='lcup-academic-benchmark-1';
const EXTRA=['Course-CLO','CLO-PO','CLO-EGA','CLO-classification','Title-description','Description-plan','Week1-introduction','Activity-fit','Module-value','Value-use'];
const A_FIELDS=['reviewerId','reviewedAt','withinExpertise','expectedJudgment','sourceEvidence','targetEvidence','reason','incorrectFieldOrRelationship','recommendedCorrection','requiresInstitutionalDecision','notes'];
const B_FIELDS=['reviewerId','reviewedAt','withinExpertise','recommendationAppropriate','groundedInEvidence','preservesSoundMappings','specificAndActionable','reason','recommendedAlternative','notes'];
const blank=(id,caseHash,fields)=>({id,caseHash,reviewStatus:'unassigned',...Object.fromEntries(fields.map(k=>[k,null]))});
const fieldAt=(obj,p)=>String(p||'').replace(/\[(\d+)\]/g,'.$1').split('.').filter(Boolean).reduce((o,k)=>o?.[k],obj);
function citations(real,pair){
 const f=real.fixture,pages=new Set(f.evidence.fields.title.pages),chunks=[];
 const add=e=>{if(e){(e.pages||[]).forEach(p=>pages.add(p));chunks.push(structuredClone(e));}};
 const row=/^row(\d+)-/.exec(pair.id),clo=/^clo(\d+)-/.exec(pair.id),po=/-po(\d+)$/.exec(pair.id),ega=/-ega(\d+)$/.exec(pair.id);
 if(row){add(f.evidence.plan[Number(row[1])]);const lesson=f.content.plan[Number(row[1])];for(const ilo of lesson.ilos||[])for(const tag of ilo.tags||[]){const i=f.content.clos.findIndex(c=>'clo:'+c.id===tag);if(i>=0)add(f.evidence.outcomes['CLO'+(i+1)]);}}
 if(clo)add(f.evidence.outcomes['CLO'+(Number(clo[1])+1)]);
 if(po)add(f.evidence.outcomes['PO'+po[1]]);
 if(ega)add(f.evidence.outcomes['EGA'+ega[1]]);
 if(/description|course|classification/.test(pair.type.toLowerCase()))add(f.evidence.fields.description);
 if(['Description-plan','Schedule','Required-fields'].includes(pair.type))f.evidence.plan.forEach(add);
 return {refs:[{file:real.file,sha256:real.fileHash,path:pair.path},{...real.source,pages:[...pages].sort((a,b)=>a-b)}],raw:chunks};
}
function prepare(){
 const refs=references(),cases=[],contexts={},key=[],proposals=[];
 const sources=new Map();const remember=f=>{sources.set(f.file,f);return f;};
 remember(fileRef('src/data/officialProgramOutcomes.json'));remember(fileRef('server/db/local-curriculum-data.cjs'));remember(fileRef('docs/local-reference-import.json'));remember(fileRef('docs/lcup-approved-offline/masters.json'));remember(fileRef('server/config/marian-values.json'));
 refs.poSources.forEach(remember);refs.curricula.flatMap(c=>c.files).forEach(remember);
 function addContext(input,real,index){
  const id=real?'ctx-'+real.key:'ctx-S'+String(index).padStart(2,'0'),content=input.content,masters=input.masters,p=plan(content,masters),part=coded(content,masters),isReal=!!real;
  const context={id,program:content.meta.program,sourceKind:isReal?'verified-syllabus':'synthetic',course:content.meta,content:structuredClone(content),referenceHash:p.referenceHash,inputHash:p.inputHash,masters:structuredClone(masters),referenceNotes:isReal?real.readiness:null};
  if(real){remember(fileRef(real.file));remember(fileRef(real.source.file));context.source=real.source;context.rawEvidence=real.fixture.evidence;context.sourceNotes=real.fixture.reviewNotes;}
  else{context.source={file:'scripts/lcup-academic-benchmark/synthetic.cjs',...remember(fileRef('scripts/lcup-academic-benchmark/synthetic.cjs')),pages:[],note:'All authored syllabus prose and mappings are synthetic stimuli, not an approved syllabus.'};const curriculum=refs.curricula.find(c=>c.program===context.program),course=curriculum.courses.find(c=>c.code===content.meta.code);context.curriculumReference={...curriculum.files.find(f=>f.file.endsWith('/'+course.sourceFile)),pages:[course.page]};}
  contexts[id]=context;
  key.push({contextId:id,sourceKind:context.sourceKind,constructionIntent:input.variant||'Unchanged source evidence; no presumed alignment',facultyJudgment:null,sourceSiblingGroup:isReal?'syllabus-'+real.key:'synthetic-domain-'+content.meta.program});
  const candidates=p.pairs.filter(pair=>POLICY.weeklyTypes.includes(pair.type)||EXTRA.includes(pair.type));
  const assessment=assessmentPairs(content,p.rows.map(r=>r.i));
  let selected=isReal?[...candidates,...assessment]:candidates.filter(pair=>pair.id.startsWith('row2-')&&POLICY.weeklyTypes.includes(pair.type));
  if(!isReal&&input.variant==='coherent-candidate')selected.push(...candidates.filter(pair=>EXTRA.includes(pair.type)&&(!pair.id.startsWith('row')||/^row[02]-/.test(pair.id))),...assessment.filter(pair=>pair.id==='row2-assessfit'));
  // Structural scope is reviewable but separate from semantic accuracy metrics.
  if(isReal||input.variant==='coherent-candidate')selected.push(...[
   {id:'review-four-clos',type:'Four-CLOs',path:'clos',source:'Requirement: exactly four CLOs.',target:JSON.stringify(content.clos)},
   {id:'review-schedule',type:'Schedule',path:'plan',source:'Requirement: Weeks 1–18; preserve grouped weeks and examination rows.',target:JSON.stringify(content.plan.map(r=>({week:r.week,kind:r.kind})))},
   {id:'review-required-fields',type:'Required-fields',path:'',source:'Review the required syllabus headers, columns and cells in the supplied structured context.',target:JSON.stringify(content)},
  ]);
  if(isReal||input.variant==='coherent-candidate')for(const entry of p.entries.filter(e=>!e.blank))selected.push({id:`review-apa-${entry.group}-${entry.index}`,type:'APA7-text',path:entry.path,source:'APA 7 text-only review; visual formatting and source authenticity are not established.',target:entry.text});
  const seen=new Set();
  for(const pair of selected){
   if(seen.has(pair.id))continue;seen.add(pair.id);
   const objective=['Four-CLOs','Schedule','Required-fields','APA7-text'].includes(pair.type),holds=[];
   const reason=p.unavailable.get(pair.id);if(reason)holds.push({code:reason,owner:reason.includes('reference')?'institution':'technical'});
   if(part.identity.status!=='verified'&&(NEEDS_IDENTITY.has(pair.type)||pair.type==='CLO-classification'))holds.push({code:'course_identity_'+part.identity.status,owner:'institution'});
   if(isReal&&pair.type==='CLO-PO'&&!real.readiness.authoredBasisMatchesOfficial)holds.push({code:'authored_PO_basis_not_designated_official_basis',owner:'institution'});
   if(['Module-value','Value-use'].includes(pair.type)&&refs.valueDefinitions.status!=='configured')holds.push({code:'value_definitions_pending_approval',owner:'institution'});
   const idx=cases.filter(c=>c.contextId===id).length+1,caseId=`BM1-${isReal?real.key.toUpperCase():'S'+String(index).padStart(2,'0')}-${String(idx).padStart(3,'0')}`;
   let source=pair.source,target=pair.target;
   const sourceOverride=isReal&&pair.type==='CLO-PO';
   if(sourceOverride){const no=Number(/-po(\d+)$/.exec(pair.id)[1]);source=content.outcomes.pos.find(o=>o.no===no)?.text||'';}
   const evidence=real?citations(real,pair):{refs:[context.source,context.curriculumReference],raw:[]};
   if(pair.type==='CLO-PO'&&!real){const program=context.program==='BSIT-CYBERSECURITY'?'BSIT':context.program,official=refs.official.programs[program],no=Number(/-po(\d+)$/.exec(pair.id)[1]);evidence.refs.push({file:official.sourceFile,sha256:official.sha256,pages:official.outcomes.find(o=>o.no===no)?.sourcePages||[]});}
   if(pair.type==='CLO-EGA')evidence.refs.push(fileRef('docs/lcup-approved-offline/masters.json'));
   if(pair.type==='Value-use')evidence.refs.push(fileRef('server/config/marian-values.json'));
   if(pair.type==='APA7-text'&&real){const e=real.fixture.evidence.references.find(r=>r.builderGroup===pair.path?.split('.')[1]||r.items?.some(t=>t.replace(/\s+/g,' ').trim()===target.replace(/\s+/g,' ').trim()));if(e){evidence.refs[1].pages=e.pages;evidence.raw=[e];}}
   const item={id:caseId,contextId:id,program:context.program,sourceKind:context.sourceKind,kind:objective?'objective-review':'academic-semantic',relationshipType:pair.type,requiredWeekly:POLICY.weeklyTypes.includes(pair.type),optionalDiagnostic:pair.type==='Assessment-fit',pairId:pair.id,path:pair.path,sourceText:source,targetText:target,
    sourceRefs:evidence.refs,rawSourceEvidence:evidence.raw,fieldValue:pair.path?fieldAt(content,pair.path):null,missingEvidence:!String(source).trim()||!String(target).trim(),holds,
    claudeEligibility:holds.length||sourceOverride?'held_for_reference_or_context_review':'candidate_pending_authorization',
    ...(sourceOverride?{sourceBasis:'Authored PDF PO text, not a number remapped into the designated official list.',plannerSource:pair.source,reviewOnlyUntilBasisResolved:true}:{}),
    expectedJudgment:null,reviewStatus:'unassigned',policyVersion:POLICY.id};
   item.caseHash=hash({contextHash:hash(context),item});cases.push(item);
  }
  // Classification error candidate is separate from the label's completeness.
  if(!isReal&&input.variant==='coherent-candidate'){
   const parent=cases.find(c=>c.contextId===id&&c.pairId==='clo2-classification');const item={...structuredClone(parent),id:parent.id+'-C',sourceText:parent.sourceText.replace('Assigned classification: Demonstrating','Assigned classification: Integration of Values'),expectedJudgment:null,controlledEdit:{field:'assigned classification',original:'Demonstrating',supplied:'Integration of Values',origin:'synthetic perturbation, not a faculty correction'}};item.caseHash=hash(item);cases.push(item);
   key.push({caseId:item.id,constructionIntent:'Classification-meaning contrast; unchanged label set is not semantic proof.',facultyJudgment:null});
   const baseCase=cases.find(c=>c.contextId===id&&c.pairId==='row2-contentactivity');
   for(const [n,text] of ['Review the activity against the stated topic, retaining sound text and mappings.','Replace the engineering/computing topic and CLO tags with a human anatomy examination.'].entries()){
    const prop={id:baseCase.id+'-P'+(n+1),caseId:baseCase.id,caseHash:baseCase.caseHash,program:context.program,origin:'synthetic-proposal',isClaudeOutput:false,text};prop.proposalHash=hash(prop);proposals.push(prop);key.push({proposalId:prop.id,constructionIntent:n?'Unrelated correction candidate':'Grounded review candidate',facultyJudgment:null});
   }
  }
 }
 refs.real.forEach(real=>addContext({content:real.fixture.content,masters:real.masters},real));
 synthetic(refs).forEach((context,i)=>addContext(context,null,i+1));
 const dataset={version:VERSION,policyVersion:POLICY.id,status:'unlabelled-review-pool',official:false,facultyValidated:false,liveModelCalls:0,cases,contexts,sourceManifest:[...sources.values()].sort((a,b)=>a.file.localeCompare(b.file))};
 dataset.benchmarkHash=hash(dataset);
 const responseA={version:VERSION,benchmarkHash:dataset.benchmarkHash,part:'A',provenance:'unassigned-template',responses:cases.map(c=>blank(c.id,c.caseHash,A_FIELDS))};
 const responseB={version:VERSION,benchmarkHash:dataset.benchmarkHash,part:'B',provenance:'unassigned-template',responses:proposals.map(p=>({...blank(p.id,p.caseHash,B_FIELDS),caseId:p.caseId,proposalHash:p.proposalHash}))};
 const adjudication={version:VERSION,benchmarkHash:dataset.benchmarkHash,provenance:'unassigned-template',adjudications:cases.map(c=>({id:c.id,caseHash:c.caseHash,reviewStatus:'unassigned',adjudicatorId:null,reviewerIds:[],reviewedAt:null,acceptedJudgments:[],ambiguous:null,reason:null,sourceEvidence:null,targetEvidence:null,recordRef:null}))};
 const referenceReport={version:VERSION,officialPOReference:refs.official.version,poSources:refs.poSources,sourceAmbiguities:Object.fromEntries(Object.entries(refs.official.programs).filter(([,p])=>p.ambiguities?.length).map(([k,p])=>[k,p.ambiguities])),programs:refs.curricula.map(c=>({program:c.program,curriculumYear:c.curriculumYear,expectedPOs:c.program.startsWith('BSIT')?9:13,poSource:c.program==='BSIT-CYBERSECURITY'?'BSIT':c.program,curriculumSources:c.files,realSyllabusAvailable:refs.real.some(r=>r.fixture.content.meta.program===c.program),evidence:refs.real.find(r=>r.fixture.content.meta.program===c.program)?.readiness||null})),valueDefinitionsStatus:refs.valueDefinitions.status,databaseVerification:'Not performed in this task; prior SELECT-only snapshot and disposable migration reports are historical evidence, not a fresh current-database assertion.',migrationDependency:'The last verified existing-database snapshot was not migrated. Existing faculty PO meanings require explicit remediation. No migration or reference record change is performed here.'};
 return {dataset,responseA,responseB,adjudication,proposals,coordinator:{version:VERSION,benchmarkHash:dataset.benchmarkHash,notAnAnswerKey:true,constructionIntents:key},referenceReport};
}
function outputs(p){
 const json=o=>JSON.stringify(o,null,2)+'\n',{renderPartA,renderPartB}=require('./render.cjs');
 const aCols=['id','caseHash','reviewStatus',...A_FIELDS],bCols=['id','caseId','proposalHash','reviewStatus',...B_FIELDS];
 const files={'cases.json':json(p.dataset),'faculty-part-a.responses.json':json(p.responseA),'faculty-part-b.responses.json':json(p.responseB),'adjudication-template.json':json(p.adjudication),'proposals.json':json(p.proposals),'coordinator-only.json':json(p.coordinator),'reference-verification.json':json(p.referenceReport),
  'faculty-part-a.responses.csv':toCsv([aCols,...p.responseA.responses.map(r=>aCols.map(k=>r[k]))]),'faculty-part-b.responses.csv':toCsv([bCols,...p.responseB.responses.map(r=>bCols.map(k=>r[k]))]),'faculty-part-b.html':renderPartB(p)};
 files['model-results.template.json']=json({version:VERSION,benchmarkHash:p.dataset.benchmarkHash,policyVersion:POLICY.id,provenance:'not-run',runId:null,model:null,promptVersion:null,transcriptSha256:null,plannedCaseIds:[],observations:[]});
 files['model-evidence-review.template.json']=json({version:VERSION,benchmarkHash:p.dataset.benchmarkHash,provenance:'unassigned-template',reviews:p.dataset.cases.filter(c=>c.kind==='academic-semantic').map(c=>({id:c.id,caseHash:c.caseHash,reviewStatus:'unassigned',reviewerId:null,runId:null,transcriptSha256:null,quoteAccuracy:null,relevanceOfEvidence:null,explanationSupported:null,referenceHoldHonesty:null,reason:null}))});
 const types=[...POLICY.weeklyTypes,'Course-CLO','CLO-PO','CLO-EGA','CLO-classification','Title-description','Description-plan','Week1-introduction','Activity-fit','Module-value','Value-use','Assessment-fit','APA7-text'];
 const selection=[];for(const program of ['BSIT','BSIT-CYBERSECURITY','BSIE','BSCPE'])for(const type of types){const candidate=p.dataset.cases.find(c=>c.program===program&&c.sourceKind==='verified-syllabus'&&c.relationshipType===type&&!c.missingEvidence)||p.dataset.cases.find(c=>c.program===program&&c.relationshipType===type&&!c.missingEvidence);if(candidate)selection.push({id:candidate.id,program,type,sourceKind:candidate.sourceKind,held:candidate.holds.length>0,expectedJudgment:null,reviewerIds:[]});}
 files['pilot-selection.json']=json({version:VERSION,benchmarkHash:p.dataset.benchmarkHash,basis:'Deterministic coverage selection only; no correctness labels, random-sampling claim or reviewer assignment. A reference-held selection is for reference/faculty review, not a Claude-ready case.',cases:selection});
 for(const program of ['BSIT','BSIT-CYBERSECURITY','BSIE','BSCPE'])files['faculty-'+program+'.html']=renderPartA(p,program);
 const manifest={version:VERSION,benchmarkHash:p.dataset.benchmarkHash,files:Object.entries(files).map(([file,text])=>({file,sha256:require('./references.cjs').sha(Buffer.from(text))}))};files['package-manifest.json']=json(manifest);return files;
}
function writePackage(dir,files,{check=false,refreshUnassigned=false}={}){
 if(refreshUnassigned){
  // Explicit development refresh is allowed only for our unchanged, entirely
  // blank generated package. A returned/reviewed or edited file fails closed.
  const old=JSON.parse(fs.readFileSync(path.join(dir,'package-manifest.json'),'utf8'));
  for(const f of old.files)if(require('./references.cjs').sha(fs.readFileSync(path.join(dir,f.file)))!==f.sha256)throw Error('Package edited since generation; refresh refused');
  for(const name of ['faculty-part-a.responses.json','faculty-part-b.responses.json','adjudication-template.json']){const t=JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));if(t.provenance!=='unassigned-template'||(t.responses||t.adjudications).some(r=>r.reviewStatus!=='unassigned'))throw Error('Faculty work exists; refresh refused');}
 }
 // Preflight every existing path before writing any file; never erase returns.
 for(const [name,text] of Object.entries(files)){const f=path.join(dir,name);if(!refreshUnassigned&&fs.existsSync(f)&&fs.readFileSync(f,'utf8')!==text)throw Error('Refusing to overwrite changed package/possible faculty return: '+f);if(check&&!fs.existsSync(f))throw Error('Missing generated artifact: '+f);}
 if(!check){fs.mkdirSync(dir,{recursive:true});for(const [name,text] of Object.entries(files))if(refreshUnassigned||!fs.existsSync(path.join(dir,name)))fs.writeFileSync(path.join(dir,name),text,{flag:refreshUnassigned?'w':'wx'});}
}
module.exports={VERSION,A_FIELDS,B_FIELDS,prepare,outputs,writePackage};
if(require.main===module){try{const p=prepare();writePackage(path.join(root,'docs/lcup-academic-benchmark/package'),outputs(p),{check:process.argv.includes('--check'),refreshUnassigned:process.argv.includes('--refresh-unassigned')});console.log(JSON.stringify({version:VERSION,cases:p.dataset.cases.length,programs:[...new Set(p.dataset.cases.map(c=>c.program))],contexts:Object.keys(p.dataset.contexts).length,proposals:p.proposals.length,assignedFacultyLabels:p.responseA.responses.filter(r=>r.expectedJudgment!==null).length,heldCases:p.dataset.cases.filter(c=>c.holds.length).length}));}catch(error){console.error(error);process.exitCode=1;}}
