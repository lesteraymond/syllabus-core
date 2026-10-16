const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const svc = require('../lib/programManagement');
const admin = { id:1, role:'admin' };
function makeDb() {
  const s = {
    programs:[{id:1,code:'BSIT',name:'Information Technology',egas_version:1,pos_version:1},{id:2,code:'BSCS',name:'Computer Science',egas_version:1,pos_version:1}],
    courses:[{id:10,code:'IT101',title:'Computing',program_id:1,clos_version:1},{id:20,code:'CS101',title:'Algorithms',program_id:2,clos_version:1}],
    syllabi:[{id:100,course_id:10,code:'IT101',title:'Syllabus',status:'approved',version:'v1.0',updated_at:'2026-01-01',file_path:'/uploads/123-test.pdf'},{id:200,course_id:20,code:'CS101',title:'Other syllabus',status:'draft',version:'v1.0',updated_at:'2026-01-01',file_path:null}],
    versions:[{id:1,syllabus_id:100,file_path:'/uploads/123-test.pdf'}],
    programAssignments:[{user_id:2,program_id:1}],subjectAssignments:[{user_id:2,course_id:10}],
    curricula:[],aliases:[],codeAliases:[],events:[],jobs:[],failDelete:false,transaction:false,
  };
  let backup;
  const query = async (sql,p=[]) => {
    // Route tests never expose cleanup jobs to the real filesystem worker.
    if(sql.startsWith('SELECT file_path FROM catalog_file_cleanup'))return [[]];
    if(sql.startsWith('SELECT COUNT(*) AS pending FROM catalog_file_cleanup'))return [[{pending:s.jobs.length}]];
    if(sql.startsWith('SELECT user_id FROM users WHERE user_id'))return [[{user_id:p[0]}]];
    if(sql.startsWith('SELECT program_id AS id, code, name, egas_version'))return [s.programs.filter(r=>r.id===p[0]).map(r=>({...r}))];
    if(sql.startsWith('SELECT code FROM program_code_aliases'))return [s.codeAliases.filter(r=>r.program_id===p[0]).map(({code})=>({code}))];
    if(sql.startsWith('SELECT program_id, code FROM program_code_aliases'))return [s.codeAliases.filter(r=>p[0].includes(r.code))];
    if(sql.startsWith('SELECT program_id FROM program_code_aliases'))return [s.codeAliases.filter(r=>r.code===p[0])];
    if(sql.startsWith('SELECT program_id, code, name, egas_version, pos_version FROM programs WHERE'))return [s.programs.filter(r=>sql.includes('WHERE code')?r.code===p[0]:r.id===p[0]).map(r=>({...r,program_id:r.id}))];
    if(sql.startsWith('SELECT p.program_id, p.code, p.name, p.egas_version, p.pos_version FROM programs p JOIN program_code_aliases'))return [s.codeAliases.filter(r=>r.code===p[0]).map(alias=>s.programs.find(r=>r.id===alias.program_id)).filter(Boolean).map(r=>({...r,program_id:r.id}))];
    if(sql.startsWith('SELECT code, name FROM programs'))return [s.programs.map(({code,name})=>({code,name}))];
    if(sql.startsWith('SELECT name FROM program_name_aliases'))return [s.aliases.filter(r=>r.program_id===p[0]).map(({name})=>({name}))];
    if(sql.startsWith('SELECT course_id AS id'))return [s.courses.filter(r=>r.program_id===p[0]).map(({program_id,...r})=>r)];
    if(sql.startsWith('SELECT curriculum_id AS id'))return [s.curricula.filter(r=>p[0].includes(r.name.toLowerCase())).map(({id})=>({id}))];
    if(sql.startsWith('SELECT s.syllabus_id AS id'))return [s.syllabi.filter(r=>p[0].includes(r.course_id)||(r.course_id==null && (p[1].includes(r.program)||p[2].includes(r.curriculum_id)||p[3].includes(r.code.toLowerCase())))).map(({course_id,program,curriculum_id,...r})=>r)];
    if(sql.startsWith('SELECT version_id AS id'))return [s.versions.filter(r=>p[0].includes(r.syllabus_id)).map(r=>({...r}))];
    if(sql.startsWith('SELECT user_id FROM faculty_programs'))return [s.programAssignments.filter(r=>r.program_id===p[0]).map(({user_id})=>({user_id}))];
    if(sql.startsWith('SELECT user_id, course_id FROM faculty_courses'))return [s.subjectAssignments.filter(r=>p[0].includes(r.course_id)).map(r=>({...r}))];
    if(sql.startsWith('SELECT program_id AS id, code, name FROM programs WHERE program_id <>'))return [s.programs.filter(r=>r.id!==p[0]&&(p[1].includes(r.name.toLowerCase())||p[2].includes(r.code.toLowerCase())))];
    if(sql.startsWith('SELECT program_id AS id, code, name FROM programs'))return [s.programs.map(({id,code,name})=>({id,code,name}))];
    if(sql.startsWith('INSERT IGNORE INTO program_name_aliases')){s.aliases.push({program_id:p[0],name:p[1]});return [{}];}
    if(sql.startsWith('INSERT IGNORE INTO program_code_aliases')){if(!s.codeAliases.some(r=>r.code===p[0]))s.codeAliases.push({code:p[0],program_id:p[1]});return [{}];}
    if(sql.startsWith('UPDATE programs SET code')){Object.assign(s.programs.find(r=>r.id===p[2]),{code:p[0],name:p[1]});return [{}];}
    if(sql.startsWith('UPDATE programs SET name')){s.programs.find(r=>r.id===p[1]).name=p[0];return [{}];}
    if(sql.startsWith('INSERT INTO catalog_events')){s.events.push(p);return [{}];}
    if(sql.startsWith('INSERT IGNORE INTO catalog_file_cleanup')){if(!s.jobs.some(r=>r.file_path===p[0]))s.jobs.push({file_path:p[0]});return [{}];}
    if(sql.startsWith('DELETE FROM')){
      assert.equal(s.transaction,true);
      if(s.failDelete)throw new Error('Simulated deletion failure');
      if(sql.startsWith('DELETE FROM syllabi')){s.syllabi=s.syllabi.filter(r=>!p[0].includes(r.id));s.versions=s.versions.filter(r=>!p[0].includes(r.syllabus_id));}
      else if(sql.startsWith('DELETE FROM courses')){s.courses=s.courses.filter(r=>!p[0].includes(r.id));s.subjectAssignments=s.subjectAssignments.filter(r=>!p[0].includes(r.course_id));}
      else if(sql.startsWith('DELETE FROM curriculum'))s.curricula=s.curricula.filter(r=>!p[0].includes(r.id));
      else if(sql.startsWith('DELETE FROM programs')){s.programs=s.programs.filter(r=>r.id!==p[0]);s.programAssignments=s.programAssignments.filter(r=>r.program_id!==p[0]);}
      else throw new Error('Unexpected delete: '+sql);
      return [{affectedRows:1}];
    }
    throw new Error('Unexpected SQL: '+sql);
  };
  const conn={query,beginTransaction:async()=>{backup=structuredClone(s);s.transaction=true;},commit:async()=>{s.transaction=false;},rollback:async()=>Object.assign(s,backup),release(){}};
  return {s,query,getConnection:async()=>conn};
}
async function withServer(fn){
  const db=makeDb();const app=express();app.use(express.json());
  app.use((req,res,next)=>{req.session={user:req.headers['x-user']?JSON.parse(req.headers['x-user']):undefined};next();});app.locals.db=db;
  app.use('/programs',require('./programs'));
  const server=await new Promise(resolve=>{const handle=app.listen(0,()=>resolve(handle));});
  const call=async(method,path,body,user=admin)=>{const response=await fetch('http://127.0.0.1:'+server.address().port+'/programs'+path,{method,headers:{'Content-Type':'application/json',...(user?{'x-user':JSON.stringify(user)}:{})},body:body&&JSON.stringify(body)});return {status:response.status,body:await response.json()};};
  try{await fn({db,call});}finally{await new Promise(resolve=>server.close(resolve));}
}
const confirmation=preview=>({previewToken:preview.previewToken,confirmCode:preview.program.code,acknowledgeCascade:true});

test('administrator preview reports subjects, all syllabus statuses, versions, assignments and files without deleting',()=>withServer(async({db,call})=>{
  const r=await call('GET','/1/deletion-preview');assert.equal(r.status,200);
  assert.deepEqual(r.body.counts,{subjects:1,syllabi:1,versions:1,assignments:2,files:1});
  assert.equal(r.body.syllabi[0].status,'approved');assert.equal(db.s.programs.length,2);assert.equal(db.s.events.length,0);
}));
test('faculty, students and anonymous requests cannot preview, rename or delete programs',()=>withServer(async({call})=>{
  for(const user of [{id:2,role:'faculty'},{id:3,role:'student'},null])for(const [method,path,body]of [['GET','/1/deletion-preview'],['PATCH','/1',{name:'Changed',expectedName:'Information Technology'}],['DELETE','/1',{}]])assert.equal((await call(method,path,body,user)).status,user?403:401);
}));
test('deletion requires a signed preview, exact typed code and explicit acknowledgement',()=>withServer(async({db,call})=>{
  assert.equal((await call('DELETE','/1',{})).status,409);const p=(await call('GET','/1/deletion-preview')).body;
  for(const body of [{...confirmation(p),confirmCode:'BSCS'},{...confirmation(p),acknowledgeCascade:false}])assert.equal((await call('DELETE','/1',body)).status,400);
  assert.equal((await call('DELETE','/1',{...confirmation(p),previewToken:p.previewToken+'x'})).status,409);assert.equal(db.s.programs.length,2);
}));
test('preview tokens are bound to their administrator and program',()=>withServer(async({call})=>{
  const p=(await call('GET','/1/deletion-preview')).body;
  assert.equal((await call('DELETE','/2',confirmation(p))).status,409);
  assert.equal((await call('DELETE','/1',confirmation(p),{id:9,role:'admin'})).status,409);
}));
test('an expired preview cannot authorize deletion',async()=>{
  const db=makeDb();const preview=await svc.preview(db,1,1);const realNow=Date.now;
  try{Date.now=()=>realNow()+11*60*1000;await assert.rejects(svc.remove(db,1,1,confirmation(preview)),error=>error.status===409);}finally{Date.now=realNow;}
  assert.equal(db.s.programs.length,2);
});
test('changed subjects, new syllabi and changed versions require a new preview',()=>withServer(async({db,call})=>{
  for(const mutate of [()=>db.s.courses[0].title='Changed title',()=>db.s.syllabi.push({id:101,course_id:10,code:'IT101',title:'New draft',status:'draft'}),()=>db.s.versions.push({id:2,syllabus_id:100,file_path:null})]){
    const p=(await call('GET','/1/deletion-preview')).body;mutate();const r=await call('DELETE','/1',confirmation(p));assert.equal(r.status,409);assert.equal(r.body.code,'preview_required');
  }assert.equal(db.s.events.length,0);
}));
test('confirmed deletion removes only the targeted program, subjects and syllabi and records an audit event',()=>withServer(async({db,call})=>{
  const p=(await call('GET','/1/deletion-preview')).body;const r=await call('DELETE','/1',confirmation(p));assert.equal(r.status,200);
  assert.deepEqual(db.s.programs.map(r=>r.id),[2]);assert.deepEqual(db.s.courses.map(r=>r.id),[20]);assert.deepEqual(db.s.syllabi.map(r=>r.id),[200]);assert.equal(db.s.versions.length,0);assert.equal(db.s.programAssignments.length,0);assert.equal(db.s.subjectAssignments.length,0);assert.equal(db.s.events[0][1],'delete_program');assert.equal(db.s.jobs[0].file_path,'/uploads/123-test.pdf');
  assert.equal((await call('DELETE','/1',confirmation(p))).status,404);
}));
test('an unused program is deletable through the same two-confirmation contract',()=>withServer(async({db,call})=>{
  db.s.programs.push({id:3,code:'NEW',name:'Unused Program',egas_version:1,pos_version:1});const p=(await call('GET','/3/deletion-preview')).body;assert.equal(p.counts.subjects,0);assert.equal((await call('DELETE','/3',confirmation(p))).status,200);assert.equal(db.s.programs.length,2);
}));
test('legacy uploads are included by curriculum, course code and retained program names',()=>withServer(async({db,call})=>{
  db.s.aliases.push({program_id:1,name:'Old IT Name'});db.s.curricula.push({id:11,name:'Old IT Name'});
  db.s.syllabi.push({id:101,course_id:null,curriculum_id:11,code:'OLD',title:'Legacy',status:'submitted'});
  db.s.syllabi.push({id:102,course_id:null,code:'IT101',title:'Legacy code',status:'submitted'});
  const p=(await call('GET','/1/deletion-preview')).body;assert.equal(p.counts.syllabi,3);
}));
test('a failure rolls back the deletion, audit event and file-cleanup outbox together',async()=>{
  const db=makeDb();const p=await svc.preview(db,1,1);db.s.failDelete=true;
  await assert.rejects(svc.remove(db,1,1,confirmation(p)),/Simulated deletion failure/);
  assert.equal(db.s.programs.length,2);assert.equal(db.s.syllabi.length,2);assert.equal(db.s.events.length,0);assert.equal(db.s.jobs.length,0);
});
test('renaming preserves ids, codes, assignments and historical syllabi',()=>withServer(async({db,call})=>{
  const before=structuredClone({assignments:db.s.programAssignments,syllabi:db.s.syllabi,versions:db.s.versions});
  const r=await call('PATCH','/1',{name:'  BS  Information Technology ',expectedName:'Information Technology'});assert.equal(r.status,200);assert.deepEqual(r.body,{id:1,code:'BSIT',name:'BS Information Technology'});assert.deepEqual({assignments:db.s.programAssignments,syllabi:db.s.syllabi,versions:db.s.versions},before);assert.equal(db.s.aliases[0].name,'Information Technology');assert.equal(db.s.events[0][1],'rename_program');
}));
test('duplicate, stale, invalid and code-changing renames are refused',()=>withServer(async({db,call})=>{
  for(const body of [{name:'computer  science',expectedName:'Information Technology'},{name:'Changed',expectedName:'Stale name'}])assert.equal((await call('PATCH','/1',body)).status,409);
  for(const body of [{name:''},{name:'Changed',expectedName:'Information Technology',unexpectedField:'NEW'}])assert.equal((await call('PATCH','/1',body)).status,400);assert.equal(db.s.programs[0].name,'Information Technology');
}));

test('ambiguous historical program names cannot cause deletion of another program records',()=>withServer(async({db,call})=>{
  db.s.aliases.push({program_id:1,name:'Computer Science'});
  assert.equal((await call('GET','/1/deletion-preview')).status,409);
  assert.equal(db.s.programs.length,2);assert.equal(db.s.syllabi.length,2);
}));

test('program code changes preserve assignments, subjects and historical versions while old codes still resolve',()=>withServer(async({db,call})=>{
  const before=structuredClone({assignments:db.s.programAssignments,subjects:db.s.courses,syllabi:db.s.syllabi,versions:db.s.versions});
  const r=await call('PATCH','/1',{name:'Information Technology',expectedName:'Information Technology',code:'  bsit-new  ',expectedCode:'BSIT'});
  assert.equal(r.status,200);assert.equal(r.body.code,'BSIT-NEW');assert.equal(r.body.id,1);
  assert.deepEqual({assignments:db.s.programAssignments,subjects:db.s.courses,syllabi:db.s.syllabi,versions:db.s.versions},before);
  assert.deepEqual(db.s.codeAliases,[{code:'BSIT',program_id:1}]);
  const resolved=await require('../lib/programs').findProgram(db,'BSIT');assert.equal(resolved.program_id,1);assert.equal(resolved.code,'BSIT-NEW');
  assert.equal(JSON.parse(db.s.events[0][4]).previousCode,'BSIT');
}));
test('duplicate, reserved, malformed and stale program codes are rejected',()=>withServer(async({db,call})=>{
  const base={name:'Information Technology',expectedName:'Information Technology',expectedCode:'BSIT'};
  assert.equal((await call('PATCH','/1',{...base,code:'BSCS'})).status,409);
  db.s.codeAliases.push({code:'OLD-CS',program_id:2});assert.equal((await call('PATCH','/1',{...base,code:'OLD-CS'})).status,409);
  for(const code of ['A','123','WITH SPACE','A'.repeat(21),null,false,123])assert.equal((await call('PATCH','/1',{...base,code})).status,400);
  assert.equal((await call('PATCH','/1',{...base,code:'NEW-IT',expectedCode:'OLD'})).status,409);
  assert.equal(db.s.programs[0].code,'BSIT');
}));
test('historical codes cannot be recycled when creating a new program',async()=>{
  const db=makeDb();db.s.codeAliases.push({code:'OLD-IT',program_id:1});
  await assert.rejects(require('../lib/programs').createProgram(db,{code:'OLD-IT',name:'Different program'}),error=>error.status===409);
});
test('a code change invalidates pending deletion previews and keeps historical code references visible',()=>withServer(async({db,call})=>{
  db.s.syllabi.push({id:101,course_id:null,code:'LEGACY',program:'bsit',title:'Legacy program',status:'submitted'});
  const old=(await call('GET','/1/deletion-preview')).body;
  assert.equal((await call('PATCH','/1',{name:'Information Technology',expectedName:'Information Technology',code:'NEW-IT',expectedCode:'BSIT'})).status,200);
  const r=await call('DELETE','/1',confirmation(old));assert.equal(r.status,409);assert.equal(r.body.code,'preview_required');
  const fresh=(await call('GET','/1/deletion-preview')).body;assert.equal(fresh.program.code,'NEW-IT');assert.equal(fresh.counts.syllabi,2);
}));
