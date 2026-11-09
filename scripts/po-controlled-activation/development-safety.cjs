'use strict';
// Read-only identity/inventory preflight. Credentials never enter reports/argv.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const mysql=require('../../server/node_modules/mysql2/promise');
const dotenv=require('../../server/node_modules/dotenv');
const root=path.resolve(__dirname,'../..');
const env=dotenv.parse(fs.readFileSync(path.join(root,'server/.env')));
const migration=require('../../server/db/official-po-migration.cjs');
const {findProgram}=require('../../server/lib/programs');
const OUT=path.join(root,'docs/po-development-activation');
const TEMP=path.join(root,'tmp/po-development-activation');
const config=()=>({host:env.DB_HOST,port:Number(env.DB_PORT||3306),user:env.DB_USER,password:env.DB_PASS,database:env.DB_NAME,dateStrings:true,multipleStatements:false,connectTimeout:8000});
const sha=value=>crypto.createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const quote=name=>'`'+String(name).replaceAll('`','``')+'`';
function assertDevelopment(identity){
 const cfg=config();
 if(!['localhost','127.0.0.1','::1'].includes(String(cfg.host).toLowerCase())||cfg.port===43308)throw Error('STOP: configured database is not the reviewed local development endpoint');
 for(const mode of [env.NODE_ENV,process.env.NODE_ENV])if(mode&&['staging','production'].includes(mode.toLowerCase()))throw Error('STOP: staging/production environment detected');
 if(/stag|prod/i.test(cfg.database)||identity.database!==cfg.database||identity.port!==cfg.port)throw Error('STOP: target database/port is not the intended development database');
 const previous=JSON.parse(fs.readFileSync(path.join(root,'docs/po-controlled-activation/reviewed-plan.json'),'utf8'));
 if(migration.hash(identity)!==previous.databaseIdentityHash)throw Error('STOP: database identity differs from the explicitly reviewed development target');
 if(!String(identity.datadir).replaceAll('\\','/').toLowerCase().startsWith('c:/xampp/mysql/data'))throw Error('STOP: target datadir is not the reviewed local XAMPP development server');
 return {configuredHost:cfg.host,configuredPort:cfg.port,configuredName:cfg.database,nodeEnvironment:env.NODE_ENV||process.env.NODE_ENV||'development (default)',identity,databaseIdentityHash:migration.hash(identity),matchesPreviouslyReviewedTarget:true,developmentTestingOnly:true,institutionalApproval:'not_recorded'};
}
async function identityOf(db){const [[r]]=await db.query('SELECT DATABASE() AS db_name,@@hostname AS hostname,@@port AS port,@@datadir AS datadir');return {database:r.db_name,hostname:r.hostname,port:r.port,datadir:r.datadir};}
async function inventory(db){
 const [tables]=await db.query('SELECT TABLE_NAME AS name,TABLE_TYPE AS type,ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME');
 const result=[];
 for(const table of tables){
  const [rows]=await db.query('SELECT * FROM '+quote(table.name));
  const normalized=rows.map(row=>JSON.stringify(row)).sort();
  const [ddlRows]=await db.query('SHOW CREATE '+(table.type==='VIEW'?'VIEW ':'TABLE ')+quote(table.name));
  const ddl=Object.values(ddlRows[0])[1];
  result.push({...table,rows:rows.length,sha256:sha(normalized),ddlSha256:sha(ddl),ddl});
 }
 const [routines]=await db.query('SELECT ROUTINE_NAME AS object_name,ROUTINE_TYPE AS object_kind,ROUTINE_DEFINITION AS definition_text,IS_DETERMINISTIC AS deterministic_flag,SQL_DATA_ACCESS AS data_access_mode,SECURITY_TYPE AS security_mode,DEFINER AS definer_value FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE() ORDER BY ROUTINE_NAME');
 const [triggers]=await db.query('SELECT TRIGGER_NAME AS object_name,EVENT_MANIPULATION AS event_kind,EVENT_OBJECT_TABLE AS target_table,ACTION_STATEMENT AS action_sql,ACTION_TIMING AS timing_value FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() ORDER BY TRIGGER_NAME');
 const [events]=await db.query('SELECT EVENT_NAME AS object_name,EVENT_DEFINITION AS definition_text,EVENT_TYPE AS event_kind,INTERVAL_VALUE AS interval_amount,INTERVAL_FIELD AS interval_unit,STATUS AS state_value FROM information_schema.EVENTS WHERE EVENT_SCHEMA=DATABASE() ORDER BY EVENT_NAME');
 return {tables:result,routines,triggers,events,hash:sha({tables:result.map(({ddl,...r})=>r),routines,triggers,events})};
}
async function main(){
 fs.mkdirSync(OUT,{recursive:true});fs.mkdirSync(TEMP,{recursive:true});
 const db=await mysql.createConnection(config());
 try{
  const verified=assertDevelopment(await identityOf(db));
  console.log(JSON.stringify({target:verified.configuredHost,port:verified.configuredPort,database:verified.configuredName,server:verified.identity.hostname,datadir:verified.identity.datadir,environment:verified.nodeEnvironment,matchesReviewedDevelopment:true}));
  await db.query('SET SESSION TRANSACTION READ ONLY');await db.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
  const ids=[];for(const code of migration.CODES)ids.push((await findProgram(db,code)).program_id);
  const plan=await migration.plan(db,{programIds:ids});const full=await inventory(db);
  const [[server]]=await db.query('SELECT VERSION() AS version,@@event_scheduler AS event_scheduler,@@read_only AS read_only');
  await db.rollback();
  const knownReviews=plan.impacts.filter(i=>i.type==='syllabus').map(i=>i.id).sort((a,b)=>a-b);
  if(JSON.stringify(knownReviews)!==JSON.stringify([43,93,97,99,100,101,102,110]))throw Error('STOP: historical impact set changed; reassess dry run before activation');
  const nonTransactional=full.tables.filter(t=>t.type==='BASE TABLE'&&!['InnoDB'].includes(t.engine));
  if(nonTransactional.length)throw Error('STOP: full consistent backup requires a separate plan for non-transactional tables');
  fs.writeFileSync(path.join(OUT,'target-identity.json'),JSON.stringify({...verified,server},null,2)+'\n',{flag:'wx'});
  fs.writeFileSync(path.join(TEMP,'before-full-inventory.json'),JSON.stringify(full,null,2)+'\n',{flag:'wx',mode:0o600});
  migration.writeBackup(path.join(TEMP,'reference-before.json'),plan);
  fs.writeFileSync(path.join(OUT,'dry-run.json'),JSON.stringify({migrationId:plan.migrationId,beforeHash:plan.beforeSha256,targets:plan.before.programs.map(p=>({id:p.program_id,code:p.code,posVersion:p.pos_version})),beforeCounts:plan.before.programs.map(p=>({program:p.code,physicalPoCount:plan.before.pos.filter(r=>r.program_id===p.program_id).length})),referenceIds:['BSIT','BSIE','BSCPE'].map(code=>migration.ID+'-'+code),changes:{program_outcomes:'Replace only the three target canonical sets with 9/13/13 exact statements; remove the target Cyber copy after preserving it in backup.',programs:'Increment only the four target pos_version values.',program_outcome_sources:'Link target Cyber program to target BSIT program.',program_po_reference_versions:'Insert exactly three source-attributed immutable versions.',program_po_reference_active:'Activate exactly three canonical references; Cyber inherits parent.',program_po_reference_migrations:'Insert one applied migration audit.',program_po_reference_remediation:'Insert eight needs_review sidecar rows; no faculty content edits.'},impacts:plan.impacts.map(({oldBasis,cloMappings,directIloPoMappings,...row})=>row),unrelatedProgramHash:plan.before.unrelatedHash,protectedTables:plan.before.protectedHashes,fullTableCount:full.tables.length,programsModified:ids,formalInstitutionalApproval:'not_recorded',dryRunOnly:true,developmentTestingOnly:true},null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({dryRunOnly:true,targets:ids,physicalPoCounts:plan.before.programs.map(p=>[p.code,plan.before.pos.filter(r=>r.program_id===p.program_id).length]),reviewIds:knownReviews,fullTables:full.tables.length,routines:full.routines.length,triggers:full.triggers.length,events:full.events.length,beforeHash:plan.beforeSha256}));
 }finally{await db.end();}
}
module.exports={config,assertDevelopment,identityOf,inventory,sha,quote,OUT,TEMP};
if(require.main===module)main().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
