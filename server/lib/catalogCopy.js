'use strict';
// "Copy from last year": the administrator's one-step way to start the current academic year's catalog from an earlier year's, instead of typing every program, EGA,
// PO, subject and CLO again. It is never automatic (a new academic year starts empty) and it only ever fills an EMPTY current year.
//   copied    programs (code, name), their EGAs and POs, specializations (their outcome source, re-linked), subjects (code, title, term, curriculum year, CLO version, standards snapshot)
//             and a pointer to the PO reference version the source program uses (the same statements, so the version itself is not duplicated)
//             and each subject's CLOs. The copies are NEW rows: editing them never changes the earlier year, which stays view only.
//   not copied faculty assignments, deadlines, syllabi and everything about them, old-code aliases
//             and the approved-curricula references (those are keyed by program code, so a program with the same code keeps them).
// Everything happens in one transaction, so a failure leaves nothing behind.
const { httpError } = require('./http');
const { loadYears, currentOf, catalogColumnReady } = require('./academicYear');
const { linkCopy } = require('./programPoReferences');

const TERM_KEYS = ['semester', 'year_level', 'prerequisite', 'curriculum_year']; // copied only when the column exists (the curriculum year stays: a curriculum spans academic years)

async function copyCatalog(conn, { from, actor = null } = {}) {
  const years = await loadYears(conn);
  const current = currentOf(years);
  if (!current || !(await catalogColumnReady(conn))) throw httpError(503, 'Run npm run migrate-catalog-year first.');
  const label = current.label;

  const [mine] = await conn.query('SELECT program_id FROM programs WHERE COALESCE(academic_year, ?) = ? FOR UPDATE', [label, label]);
  if (mine.length) throw httpError(409, `${label} already has programs. Copying is only for an empty academic year.`, { code: 'catalog_not_empty' });

  // the source: the year asked for, else the nearest earlier year that has a catalog
  const [counts] = await conn.query('SELECT COALESCE(academic_year, ?) AS year, COUNT(*) AS n FROM programs GROUP BY COALESCE(academic_year, ?)', [label, label]);
  const withCatalog = new Set(counts.filter((r) => Number(r.n) > 0).map((r) => r.year));
  let source = typeof from === 'string' && from.trim() ? from.trim() : null;
  if (source) {
    if (!years.some((y) => y.label === source) || source === label) throw httpError(400, 'Choose an earlier academic year to copy from.');
  } else {
    const earlier = years.filter((y) => y.startYear < current.startYear && withCatalog.has(y.label)).slice(-1)[0];
    if (!earlier) throw httpError(409, 'There is no earlier academic year with a catalog to copy.', { code: 'no_source_catalog' });
    source = earlier.label;
  }
  if (!withCatalog.has(source)) throw httpError(409, `${source} has no programs to copy.`, { code: 'no_source_catalog' });

  const [programs] = await conn.query('SELECT program_id, code, name FROM programs WHERE COALESCE(academic_year, ?) = ? ORDER BY program_id FOR UPDATE', [label, source]);
  const programMap = new Map();
  for (const p of programs) {
    const [made] = await conn.query('INSERT INTO programs (code, name, academic_year) VALUES (?, ?, ?)', [p.code, p.name, label]);
    programMap.set(p.program_id, made.insertId);
    await conn.query('INSERT INTO program_egas (program_id, ega_no, name, short_name) SELECT ?, ega_no, name, short_name FROM program_egas WHERE program_id = ?', [made.insertId, p.program_id]);
    await conn.query('INSERT INTO program_outcomes (program_id, po_no, short_name, outcome_text, ega_nos) SELECT ?, po_no, short_name, outcome_text, ega_nos FROM program_outcomes WHERE program_id = ?', [made.insertId, p.program_id]);
    await linkCopy(conn, p.program_id, made.insertId, { actorId: actor, fromYear: source }); // the same statements, so the new year keeps using the same version
  }

  // a specialization keeps inheriting the outcomes of its source program: re-link the copies to each other
  try {
    const [links] = await conn.query('SELECT program_id, source_program_id, specialization FROM program_outcome_sources WHERE program_id IN (?)', [[...programMap.keys()]]);
    for (const l of links) if (programMap.has(l.source_program_id)) await conn.query('INSERT INTO program_outcome_sources (program_id, source_program_id, specialization) VALUES (?, ?, ?)', [programMap.get(l.program_id), programMap.get(l.source_program_id), l.specialization]);
  } catch (error) { if (error.code !== 'ER_NO_SUCH_TABLE') throw error; }

  const [courses] = await conn.query('SELECT * FROM courses WHERE program_id IN (?) ORDER BY course_id', [[...programMap.keys()]]);
  let subjects = 0;
  for (const c of courses) {
    const columns = ['code', 'title', 'program_id', 'clos_version', 'standards_json', 'academic_year'];
    const values = [c.code, c.title, programMap.get(c.program_id), c.clos_version || 1, c.standards_json, label];
    for (const key of TERM_KEYS) if (Object.hasOwn(c, key)) { columns.push(key); values.push(c[key]); }
    const [made] = await conn.query(`INSERT INTO courses (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, values);
    await conn.query('INSERT INTO course_clos (course_id, sort_order, title, clo_level, statement, ega_nos, po_nos) SELECT ?, sort_order, title, clo_level, statement, ega_nos, po_nos FROM course_clos WHERE course_id = ? ORDER BY sort_order, clo_id', [made.insertId, c.course_id]);
    subjects += 1;
  }

  try { await conn.query('INSERT INTO catalog_events (actor_id, action, program_code, program_name, details) VALUES (?, ?, ?, ?, ?)', [actor, 'copy_catalog', '-', `${source} to ${label}`, JSON.stringify({ from: source, to: label, programs: programs.length, subjects })]); }
  catch (error) { if (error.code !== 'ER_NO_SUCH_TABLE') throw error; }
  return { from: source, to: label, programs: programs.length, subjects };
}

module.exports = { copyCatalog };
