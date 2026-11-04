'use strict';
// Data-only offline adapter for the existing Claude transport. Never accepts a
// fetch function, URL, credential, live configuration or paid fallback.
const {POLICY}=require('./academicV2Plan');
const MODEL='claude-sonnet-4-6';
function replayOptions(replay,plan){
 if(!replay||replay.policyVersion!==POLICY.id||replay.inputHash!==plan.inputHash||replay.referenceHash!==plan.referenceHash||!Array.isArray(replay.judgements)||Object.keys(replay).some(key=>!['policyVersion','inputHash','referenceHash','judgements','availability','confirmedRoots'].includes(key)))throw Object.assign(Error('A matching versioned offline replay is required; historical or stale reports cannot activate V2.'),{status:400,code:'academic_v2_offline_replay_required',body:{code:'academic_v2_offline_replay_required'}});
 const env={SYLLABUS_CHECK_AI_PROVIDER:'anthropic',ANTHROPIC_API_KEY:'sk-ant-offline-replay-not-a-real-key',ANTHROPIC_MODEL:MODEL,SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL:MODEL,ANTHROPIC_MAX_RETRIES:'0',SYLLABUS_CHECK_PROMPT_VARIANT:'rubric',SYLLABUS_CHECK_AI_CONCURRENCY:'1',
  ...Object.fromEntries(['A','B','B3','B4','C1','C2','C3','D1','D2'].map(stage=>['SYLLABUS_CHECK_STAGE_'+stage,'on'])),SYLLABUS_CHECK_REQUIREMENTS_ADVICE:'on'};
 let requests=0;
 const transport=async(_url,init)=>{
  requests++;
  const pairs=JSON.parse(JSON.parse(init.body).messages[0].content).document_data;
  const ids=new Set(pairs.map(p=>p.id));
  // Do not repair, fill or relabel an answer. Missing/duplicate/unsupported data
  // goes through the existing schema, evidence, aspect and retry validation.
  const judgements=replay.judgements.filter(j=>j&&ids.has(j.id));
  return new Response(JSON.stringify({id:'msg_offline_v2',type:'message',role:'assistant',model:MODEL,content:[{type:'text',text:JSON.stringify({judgements})}],stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:0,output_tokens:0}}),{status:200,headers:{'content-type':'application/json'}});
 };
 return {env,transport,academicPolicy:POLICY.id,evaluationOnly:true,skipEmpty:false,requests:()=>requests,unavailable:replay.availability==='unavailable'};
}
module.exports={replayOptions};
