const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { uploadFile, drain } = require('./catalogFileCleanup');
function fixture(file='/uploads/123-test.pdf', shared=false) {
  const jobs=[{file_path:file,attempts:0}];
  const db={query:async(sql,p=[])=>{
    if(sql.startsWith('SELECT file_path'))return [jobs.map(r=>({...r}))];
    if(sql.startsWith('SELECT 1 FROM syllabi'))return [shared?[{one:1}]:[]];
    if(sql.startsWith('DELETE FROM catalog_file_cleanup')){jobs.splice(jobs.findIndex(r=>r.file_path===p[0]),1);return [{}];}
    if(sql.startsWith('UPDATE catalog_file_cleanup')){jobs[0].attempts++;jobs[0].error=p[0];return [{}];}
    if(sql.startsWith('SELECT COUNT'))return [[{pending:jobs.length}]];
    throw new Error('Unexpected SQL '+sql);
  }};
  return {jobs,db};
}
test('cleanup only accepts direct syllabus PDFs within the configured upload root',()=>{
  const root=path.resolve('test-uploads');assert.equal(uploadFile('/uploads/123-test.PDF',root),path.join(root,'123-test.PDF'));
  for(const value of ['/uploads/../secret.pdf','/uploads/avatars/user.pdf','/uploads/cor/file.pdf','/uploads/test.txt','/other/test.pdf','/uploads/%2e%2e.pdf'])assert.throws(()=>uploadFile(value,root));
});
test('an unreferenced file is removed after commit and its durable cleanup job is cleared',async()=>{
  const f=fixture();const removed=[];const result=await drain(f.db,{root:path.resolve('test-uploads'),unlink:async file=>removed.push(file)});assert.equal(result.pending,0);assert.equal(removed.length,1);assert.equal(f.jobs.length,0);
});
test('files still referenced by another syllabus or version are preserved',async()=>{
  const f=fixture('/uploads/123-test.pdf',true);let removed=false;await drain(f.db,{unlink:async()=>{removed=true;}});assert.equal(removed,false);assert.equal(f.jobs.length,0);
});
test('filesystem failures keep the job for a later retry',async()=>{
  const f=fixture();const first=await drain(f.db,{unlink:async()=>{throw new Error('temporarily locked');}});assert.equal(first.pending,1);assert.equal(f.jobs[0].attempts,1);const second=await drain(f.db,{unlink:async()=>{}});assert.equal(second.pending,0);
});
test('already absent files are successful cleanup, while invalid paths are never unlinked',async()=>{
  const f=fixture();await drain(f.db,{unlink:async()=>{throw Object.assign(new Error('gone'),{code:'ENOENT'});}});assert.equal(f.jobs.length,0);
  const invalid=fixture('/uploads/../private.pdf');let called=false;assert.equal((await drain(invalid.db,{unlink:async()=>{called=true;}})).pending,1);assert.equal(called,false);
});
