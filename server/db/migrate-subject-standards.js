// Add subject-owned standards; preserve existing values as independent copies, never live fallbacks.
require('dotenv').config();
const mysql=require('mysql2/promise');
const {loadOutcomes}=require('../lib/institution');
const {findProgram,loadProgram}=require('../lib/programs');
async function main(){
 const conn=await mysql.createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASS,database:process.env.DB_NAME});
 try{
  const [columns]=await conn.query("SHOW COLUMNS FROM courses LIKE 'standards_json'");
  if(!columns.length) await conn.query('ALTER TABLE courses ADD COLUMN standards_json LONGTEXT NULL');
  await conn.beginTransaction();
  try{
   const inst=await loadOutcomes(conn);
   const [courses]=await conn.query('SELECT course_id, program_id FROM courses WHERE standards_json IS NULL FOR UPDATE');
   for(const c of courses){
    const program=await loadProgram(conn,await findProgram(conn,c.program_id));
    const standards={vision:inst.vision,mission:inst.mission,egas:program.egas,pos:program.pos,versions:{vision:1,egas:1,pos:1}};
    await conn.query('UPDATE courses SET standards_json = ? WHERE course_id = ?',[JSON.stringify(standards),c.course_id]);
   }
   await conn.commit();console.log('Subject standards ready; copied existing setup for '+courses.length+' subjects.');
  }catch(error){await conn.rollback();throw error;}
 }finally{await conn.end();}
}
main().catch(error=>{console.error('Subject standards migration failed:',error.message);process.exitCode=1;});
