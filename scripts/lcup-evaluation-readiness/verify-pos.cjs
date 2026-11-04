'use strict';
// The only connection to the configured database in this task: read-only.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'docs/lcup-evaluation-readiness');
const mysql = require('../../server/node_modules/mysql2/promise');
const env = require('../../server/node_modules/dotenv').parse(fs.readFileSync(path.join(root, 'server/.env')));
const { findProgram, loadProgram, loadResolvedProgram } = require('../../server/lib/programs');
const { mastersFor } = require('../../server/lib/syllabuscheck/repository');
const { sources } = require('../../server/db/local-outcome-data.cjs');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'docs/lcup-approved-offline', name)));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
(async () => {
  const connection = await mysql.createConnection({ host: env.DB_HOST, user: env.DB_USER, password: env.DB_PASS, database: env.DB_NAME, connectTimeout: 5000 });
  try {
    await connection.query('SET SESSION TRANSACTION READ ONLY');
    await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    const queries = [];
    const db = { query: async (sql, params) => {
      if (!/^SELECT\b/i.test(sql)) throw Error('Read-only SELECT guard');
      queries.push(sql); return connection.query(sql, params);
    } };
    const [[server]] = await db.query('SELECT VERSION() AS version, @@tx_read_only AS readOnly');
    const [tables] = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'program_outcome_sources'");
    const [links] = tables.length ? await db.query('SELECT program_id, source_program_id FROM program_outcome_sources') : [[]];
    const seed = await import('../../src/data/outcomesSeed.js');
    const programs = {};
    for (const code of ['BSIT', 'BSIT-CYBERSECURITY', 'BSIE', 'BSCPE']) {
      const program = await findProgram(db, code), own = await loadProgram(db, program), resolved = await loadResolvedProgram(db, program);
      programs[code] = { id: own.id, versions: own.versions, ownPos: own.pos, resolvedPos: resolved.pos, inheritedFrom: resolved.inheritedFrom || null, masters: await mastersFor(db, { meta: { program: code } }) };
    }
    const references = ['it202', 'ie402', 'cpe304'].map(key => { const f = read(`${key}.fixture.json`); return { key, program: f.content.meta.program, source: f.source, pos: f.content.outcomes.pos, pages: Object.fromEntries(Object.entries(f.evidence.outcomes).filter(([k]) => k.startsWith('PO')).map(([k,v])=>[k,v.pages])) }; });
    const engineering = read('engineering-pos.json');
    for (const source of [...references.map(r=>({file:path.basename(r.source.file),sha256:r.source.sha256})), ...engineering]) {
      if (hash(fs.readFileSync(path.join(root, 'docs/academic-references', source.file))) !== source.sha256) throw Error(`Source hash changed: ${source.file}`);
    }
    const comparisons = references.map(r => ({ key:r.key,program:r.program,dbCount:programs[r.program].resolvedPos.length,pdfCount:r.pos.length,
      numbered:r.pos.map(p=>({no:p.no,pages:r.pages[`PO${p.no}`],pdf:p.text,database:programs[r.program].resolvedPos.find(v=>v.no===p.no)?.text || null,exactTextMatch:programs[r.program].resolvedPos.find(v=>v.no===p.no)?.text===p.text})) }));
    const sourceSummary = { bsitSeed:seed.PROGRAMS.BSIT.pos, transcriptions:Object.fromEntries(Object.entries(sources).map(([k,v])=>[k,v.pos])) };
    const result = { verifiedAt:new Date().toISOString(), server, inheritanceTableExists:!!tables.length, links, programs, references, engineering, comparisons, sourceSummary,
      bsitSeedMatchesDatabase:JSON.stringify(seed.PROGRAMS.BSIT.pos)===JSON.stringify(programs.BSIT.ownPos),
      cyberOwnMatchesBsit:JSON.stringify(programs['BSIT-CYBERSECURITY'].ownPos)===JSON.stringify(programs.BSIT.ownPos),
      completeEngineeringPO12:Object.fromEntries(['BSIE','BSCPE'].map(code=>[code,programs[code].resolvedPos.find(p=>p.no===12)?.text.endsWith('multidisciplinary environments.') || false])),
      queries, databaseWrites:0, facultyRecordsRead:0 };
    await connection.rollback();
    fs.writeFileSync(path.join(out, 'current-pos.json'), JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify({server,counts:Object.fromEntries(Object.entries(programs).map(([k,v])=>[k,v.resolvedPos.length])),inheritanceTableExists:result.inheritanceTableExists,cyberSource:programs['BSIT-CYBERSECURITY'].inheritedFrom,completePO12:result.completeEngineeringPO12,readOnlyQueries:queries.length}));
  } finally { await connection.end(); }
})().catch(e=>{console.error(e.code || e.message);process.exitCode=1;});
