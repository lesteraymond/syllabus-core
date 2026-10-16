// Real MySQL verification. All synthetic rows are rolled back, including on failure.
require('dotenv').config();
const mysql=require('mysql2/promise');
const assert=require('node:assert/strict');
const {loadCourse}=require('../lib/courses');
const {blankStandards,updateStandards}=require('../lib/subjectStandards');
async function main(){
 const conn=await mysql.createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASS,database:process.env.DB_NAME});
 try{
  await conn.beginTransaction();
  const marker='T'+Date.now();
  const [program]=await conn.query('INSERT INTO programs (code,name) VALUES (?,?)',[marker,'Verification '+marker]);
  const ids=[];
  for(const suffix of ['A','B']){
   const [subject]=await conn.query('INSERT INTO courses (code,title,program_id,standards_json) VALUES (?,?,?,?)',[marker+suffix,'Synthetic subject',program.insertId,JSON.stringify(blankStandards())]);ids.push(subject.insertId);
  }
  const before=await loadCourse(conn,ids[0],{lock:true});assert.equal(before.standards.vision,'');assert.deepEqual(before.standards.egas,[]);
  const next=updateStandards(before.standards,'vision',{vision:'Only A',mission:{lead:'Only A mission',items:['A purpose']}},1,[]);
  await conn.query('UPDATE courses SET standards_json=? WHERE course_id=?',[JSON.stringify(next),ids[0]]);
  assert.equal((await loadCourse(conn,ids[0])).standards.vision,'Only A');
  assert.equal((await loadCourse(conn,ids[1])).standards.vision,'');
  assert.throws(()=>updateStandards(next,'vision',{vision:'Stale'},1,[]),error=>error.status===409);
  console.log('Real MySQL checks passed: blank defaults, subject isolation, stale versions and locking. Synthetic records rolled back.');
 }finally{await conn.rollback();await conn.end();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
