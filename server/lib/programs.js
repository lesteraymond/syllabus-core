// Programs, their expected graduate attributes (EGAs) and their program outcomes (POs).
// Shared by routes/programs.js and the submit snapshot in routes/syllabusContent.js.
const { httpError } = require('./http');
const { loadProgramEgas } = require('./programEgas');
const poReferences = require('./programPoReferences');
const { loadYears, currentOf, catalogColumnReady } = require('./academicYear');

// `idOrCode` is the numeric program id or the program code (e.g. BSIT). The same code can exist in several academic years (each year has its own program rows): a code
// resolves to the program of `year` (default the current academic year), and when that year has none, to the newest one, so a link made by code keeps working.
async function findProgram(db, idOrCode, { year } = {}) {
  const key = String(idOrCode);
  let rows;
  if (/^\d+$/.test(key)) [rows] = await db.query('SELECT program_id, code, name, egas_version, pos_version FROM programs WHERE program_id = ?', [Number(key)]);
  else {
    const current = currentOf(await loadYears(db));
    const scoped = !!current && await catalogColumnReady(db);
    const target = year || (current && current.label);
    [rows] = scoped
      ? await db.query('SELECT program_id, code, name, egas_version, pos_version FROM programs WHERE code = ? ORDER BY (COALESCE(academic_year, ?) = ?) DESC, academic_year DESC, program_id DESC LIMIT 1', [key.toUpperCase(), current.label, target])
      : await db.query('SELECT program_id, code, name, egas_version, pos_version FROM programs WHERE code = ?', [key.toUpperCase()]);
  }
  if (rows[0]) return rows[0];
  // Old codes resolve to the same stable program ID; submitted content stays unchanged.
  if (!/^\d+$/.test(key)) {
    try {
      const [aliases] = await db.query('SELECT p.program_id, p.code, p.name, p.egas_version, p.pos_version FROM programs p JOIN program_code_aliases a ON a.program_id = p.program_id WHERE a.code = ? GROUP BY p.program_id, p.code, p.name, p.egas_version, p.pos_version', [key.toUpperCase()]);
      if (aliases.length === 1) return aliases[0];
    } catch (error) { if (error.code !== 'ER_NO_SUCH_TABLE') throw error; }
  }
  throw httpError(404, 'Program not found');
}

const parseEgas = (s) => String(s || '').split(',').map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0);

// { id, code, name, egas, pos, versions }. `egas` is the program's own list; `versions` are what a save must send back
// so that a save from an out-of-date screen is refused (see lib/programEgas.js isStale).
async function loadProgram(db, program) {
  const [pos] = await db.query('SELECT po_no, short_name, outcome_text, ega_nos FROM program_outcomes WHERE program_id = ? ORDER BY po_no', [program.program_id]);
  const poReference = await poReferences.activeFor(db, program.program_id);
  const mappedPos = pos.map((p) => ({ no:p.po_no, short:p.short_name, text:p.outcome_text, egas:parseEgas(p.ega_nos) }));
  if (poReference && !poReferences.sameBasis(mappedPos,poReference.outcomes)) throw httpError(409,'Program Outcome rows differ from their approved source version. Ask an administrator to resolve reference drift.',{code:'po_reference_drift'});
  return {
    id: program.program_id,
    code: program.code,
    name: program.name,
    egas: await loadProgramEgas(db, program.program_id),
    pos: mappedPos,
    ...(poReference ? { poReference } : {}),
    versions: { egas: program.egas_version || 1, pos: program.pos_version || 1 },
  };
}

// The program whose Program Outcomes are authoritative for `program`: its own, unless program_outcome_sources links it to another one (a
// specialization such as BSIT-CYBERSECURITY shares BSIT's). Programs and workflows keep their own ids; only the PO lookup follows the link.
// Without the table (not migrated yet) or a link, the program itself is returned.
async function outcomeSource(db, program) {
  try {
    const [rows] = await db.query('SELECT p.program_id, p.code, p.name, p.egas_version, p.pos_version FROM program_outcome_sources s JOIN programs p ON p.program_id = s.source_program_id WHERE s.program_id = ?', [program.program_id]);
    return rows[0] || program;
  } catch (error) { if (error.code === 'ER_NO_SUCH_TABLE') return program; throw error; }
}

// The program this one inherits its outcomes from, or null. `program` needs program_id (and code for messages).
async function inheritedFrom(db, program) {
  const source = await outcomeSource(db, program);
  return source.program_id !== program.program_id ? source : null;
}
const sourceInfo = source => ({ id: source.program_id, code: source.code, name: source.name });
// loadProgram, but a specialization shows (and is checked against) the EGAs and POs of the program it inherits from, with `inheritedFrom`.
async function loadResolvedProgram(db, program) {
  const source = await inheritedFrom(db, program);
  // A specialization's historical copy is never a second authoritative master.
  // Until the controlled link is installed, expose missing references through
  // the existing PO-MASTER/CUR-REF checks rather than blessing the copied list.
  if (program.code === 'BSIT-CYBERSECURITY' && (!source || source.code !== 'BSIT')) return {
    id:program.program_id,code:program.code,name:program.name,egas:[],pos:[],
    versions:{egas:program.egas_version||1,pos:program.pos_version||1},referenceStatus:'inheritance_not_configured'
  };
  if (!source) return loadProgram(db, program);
  const shared = await loadProgram(db, source);
  return { id:program.program_id,code:program.code,name:program.name,egas: shared.egas, pos: shared.pos, versions: shared.versions, ...(shared.poReference ? {poReference:shared.poReference} : {}), inheritedFrom: sourceInfo(source) }; // outcomes only: the curriculum stays the specialization's own (syllabuscheck/repository.js)
}
// The same for a subject's stored standards snapshot (courses.standards_json): the stored copy of a specialization's EGAs/POs is never used
// as is, so an edit of the source program cannot leave a subject reading outdated outcomes. Vision and mission are institutional and untouched.
// A subject of a program with a source version in force reads that version. Once an Admin has saved a newer version, a subject stays on the version it was given until Apply to Subjects.
async function inheritStandards(db, programId, standards, {code} = {}) {
  const source = await inheritedFrom(db, { program_id: programId });
  if(code==='BSIT-CYBERSECURITY'&&source?.code!=='BSIT')return {...standards,pos:[],poReference:null,referenceStatus:'inheritance_not_configured'};
  if (!source) {
    const poReference = await poReferences.activeFor(db,programId);
    if(!poReference)return standards;
    if(poReference.kind==='admin_published'&&!poReferences.sameBasis(standards.pos,poReference.outcomes))return poReferences.withAssignedVersion(db,programId,standards);
    const program = await loadProgram(db,await findProgram(db,programId));
    return {...standards,pos:program.pos,poReference,versions:{...standards.versions,pos:program.versions.pos}};
  }
  const shared = await loadProgram(db, source);
  return { ...standards, egas: shared.egas, pos: shared.pos, ...(shared.poReference ? {poReference:shared.poReference}:{}), versions: { ...standards.versions, egas: shared.versions.egas, pos: shared.versions.pos }, inheritedFrom: sourceInfo(source) };
}
// Refuses to edit outcomes that a program inherits. The message names where to edit them.
async function requireOwnOutcomes(db, program) {
  const source = await inheritedFrom(db, program);
  if(program.code==='BSIT-CYBERSECURITY'&&!source)throw httpError(409, `${program.code} inherits its Program Outcomes and EGAs from BSIT. Edit them in BSIT.`, {code:'outcomes_inherited',source:'BSIT'});
  if (source) throw httpError(409, `${program.code} inherits its Program Outcomes and EGAs from ${source.code}. Edit them in ${source.code}.`, { code: 'outcomes_inherited', source: source.code });
}
// Programs that inherit their outcomes from `programId` (empty without the table).
async function specializationsOf(db, programId) {
  try {
    const [rows] = await db.query('SELECT p.program_id AS id, p.code, p.name FROM program_outcome_sources s JOIN programs p ON p.program_id = s.program_id WHERE s.source_program_id = ? ORDER BY p.code', [programId]);
    return rows;
  } catch (error) { if (error.code === 'ER_NO_SUCH_TABLE') return []; throw error; }
}

const PROGRAM_CODE = /^[A-Z0-9-]{2,20}$/;

// Program names are compared ignoring case and repeated spaces, so "BS  Industrial engineering" is the same name as
// "BS Industrial Engineering".
const normalizeName = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

// Creates a program inside the caller's transaction (`conn`). The code is already trimmed and upper-cased. A new program has
// no EGAs or outcomes until an administrator configures them. A name already used by another program is refused. Returns its id. A concurrent creation of the same code is
// the unique key's job: it becomes a 409.
// With `year` (the catalog is per academic year) the program belongs to that year and the name and code checks look only at that year's programs, so last year's BSIT does
// not stop this year's BSIT; without it (before the migration) they look at every program.
async function createProgram(conn, { code, name, year, current }) {
  const [named] = year
    ? await conn.query('SELECT code, name FROM programs WHERE COALESCE(academic_year, ?) = ? ORDER BY program_id FOR UPDATE', [current, year])
    : await conn.query('SELECT code, name FROM programs ORDER BY program_id FOR UPDATE');
  const taken = named.find((p) => normalizeName(p.name) === normalizeName(name));
  if (taken) throw httpError(409, `That name is already used by ${taken.code}.`);
  // Never recycle a code retained by historical records from another program (of the same academic year).
  try {
    const [aliases] = year
      ? await conn.query('SELECT a.program_id FROM program_code_aliases a JOIN programs p ON p.program_id = a.program_id WHERE a.code = ? AND COALESCE(p.academic_year, ?) = ? FOR UPDATE', [code, current, year])
      : await conn.query('SELECT program_id FROM program_code_aliases WHERE code = ? FOR UPDATE', [code]);
    if (aliases.length) throw httpError(409, 'That program code is reserved by existing records. Choose another code.');
  } catch (error) { if (error.code !== 'ER_NO_SUCH_TABLE') throw error; }
  let result;
  try {
    [result] = year
      ? await conn.query('INSERT INTO programs (code, name, academic_year) VALUES (?, ?, ?)', [code, name, year])
      : await conn.query('INSERT INTO programs (code, name) VALUES (?, ?)', [code, name]);
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') throw httpError(409, 'That program was just created. Try again.');
    throw err;
  }
  return result.insertId;
}

module.exports = { findProgram, loadProgram, outcomeSource, inheritedFrom, loadResolvedProgram, inheritStandards, requireOwnOutcomes, specializationsOf, parseEgas, createProgram, normalizeName, PROGRAM_CODE };
