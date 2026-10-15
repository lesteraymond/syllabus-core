const crypto = require('crypto');
const { inTransaction, httpError } = require('./http');
const { normalizeName } = require('./programs');
const secret = process.env.SESSION_SECRET ? crypto.createHash('sha256').update('program-deletion:' + process.env.SESSION_SECRET).digest() : crypto.randomBytes(32);
const sign = value => crypto.createHmac('sha256', secret).update(value).digest('base64url');
const jsonProgram = alias => "LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(" + alias + ".content), " + alias + ".content, NULL), '$.meta.program')), JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(" + alias + ".content), " + alias + ".content, NULL), '$.catalog.program.code'))))";
const ids = rows => rows.map(row => row.id);
const nonempty = list => list.length ? list : [null];
const digest = impact => crypto.createHash('sha256').update(JSON.stringify(impact)).digest('hex');
const missing = () => httpError(404, 'Program not found');

async function impactOf(conn, id) {
  const [[program]] = await conn.query('SELECT program_id AS id, code, name, egas_version, pos_version FROM programs WHERE program_id = ? FOR UPDATE', [id]);
  if (!program) throw missing();
  const [aliases] = await conn.query('SELECT name FROM program_name_aliases WHERE program_id = ? ORDER BY name FOR UPDATE', [id]);
  const [codeAliases] = await conn.query('SELECT code FROM program_code_aliases WHERE program_id = ? ORDER BY code FOR UPDATE', [id]);
  const names = [...new Set([program.code, program.name, ...aliases.map(row => row.name), ...codeAliases.map(row => row.code)].map(normalizeName))].sort();
  const [courses] = await conn.query('SELECT course_id AS id, code, title, clos_version FROM courses WHERE program_id = ? ORDER BY course_id FOR UPDATE', [id]);
  const courseIds = nonempty(ids(courses));
  const codes = nonempty(courses.map(row => row.code.trim().toLowerCase()));
  const [conflicts] = await conn.query('SELECT program_id AS id, code, name FROM programs WHERE program_id <> ? AND (LOWER(TRIM(name)) IN (?) OR LOWER(code) IN (?)) FOR UPDATE', [id, names, names]);
  if (conflicts.length) throw httpError(409, 'A legacy program name is also used by another program. Resolve the conflicting names before deleting.');
  const [curricula] = await conn.query('SELECT curriculum_id AS id FROM curriculum WHERE LOWER(TRIM(program_name)) IN (?) ORDER BY curriculum_id FOR UPDATE', [names]);
  const curriculumIds = nonempty(ids(curricula));
  const [syllabi] = await conn.query('SELECT s.syllabus_id AS id, s.course_code AS code, s.title, s.status, s.version, s.updated_at, s.file_path FROM syllabi s WHERE s.course_id IN (?) OR (s.course_id IS NULL AND (' + jsonProgram('s') + ' IN (?) OR s.curriculum_id IN (?) OR LOWER(TRIM(s.course_code)) IN (?) OR EXISTS (SELECT 1 FROM syllabus_versions v WHERE v.syllabus_id = s.syllabus_id AND (' + jsonProgram('v') + ' IN (?) OR v.curriculum_id IN (?) OR (v.content IS NULL AND LOWER(TRIM(v.course_code)) IN (?)))))) ORDER BY s.syllabus_id FOR UPDATE', [courseIds, names, curriculumIds, codes, names, curriculumIds, codes]);
  const [versions] = syllabi.length ? await conn.query('SELECT version_id AS id, syllabus_id, file_path FROM syllabus_versions WHERE syllabus_id IN (?) ORDER BY version_id FOR UPDATE', [ids(syllabi)]) : [[]];
  const [programAssignments] = await conn.query('SELECT user_id FROM faculty_programs WHERE program_id = ? ORDER BY user_id FOR UPDATE', [id]);
  const [subjectAssignments] = courses.length ? await conn.query('SELECT user_id, course_id FROM faculty_courses WHERE course_id IN (?) ORDER BY user_id, course_id FOR UPDATE', [ids(courses)]) : [[]];
  const files = [...new Set([...syllabi, ...versions].map(row => row.file_path).filter(Boolean))].sort();
  return { program, courses, curricula, syllabi, versions, programAssignments, subjectAssignments, files };
}
function summary(impact) {
  return { program: { id: impact.program.id, code: impact.program.code, name: impact.program.name }, subjects: impact.courses.map(({ id, code, title }) => ({ id, code, title })), syllabi: impact.syllabi.slice(0, 100).map(({ id, code, title, status }) => ({ id, code, title, status })), counts: { subjects: impact.courses.length, syllabi: impact.syllabi.length, versions: impact.versions.length, assignments: impact.programAssignments.length + impact.subjectAssignments.length, files: impact.files.length } };
}
async function preview(db, id, actor) {
  const impact = await inTransaction(db, conn => impactOf(conn, id));
  const payload = Buffer.from(JSON.stringify({ id, actor, hash: digest(impact), expires: Date.now() + 10 * 60 * 1000 })).toString('base64url');
  return { ...summary(impact), previewToken: payload + '.' + sign(payload) };
}
function verify(token, id, actor) {
  try {
    if (typeof token !== 'string' || token.length > 2048) throw new Error();
    const [payload, signature, extra] = token.split('.');
    const expected = sign(payload);
    if (extra || !signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error();
    const intent = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (intent.id !== id || intent.actor !== actor || intent.expires <= Date.now()) throw new Error();
    return intent;
  } catch { throw httpError(409, 'The deletion preview expired or is invalid. Review the program again.', { code: 'preview_required' }); }
}
async function remove(db, id, actor, body) {
  const intent = verify(body.previewToken, id, actor);
  return inTransaction(db, async conn => {
    const impact = await impactOf(conn, id);
    if (digest(impact) !== intent.hash) throw httpError(409, 'The program changed after the preview. Review the affected records again.', { code: 'preview_required' });
    if (body.confirmCode !== impact.program.code || body.acknowledgeCascade !== true) throw httpError(400, 'Type the program code and acknowledge permanent deletion.', { code: 'confirmation_required' });
    // Record the event and file outbox in the same transaction as the cascade.
    await conn.query('INSERT INTO catalog_events (actor_id, action, program_code, program_name, details) VALUES (?, ?, ?, ?, ?)', [actor, 'delete_program', impact.program.code, impact.program.name, JSON.stringify({ counts: summary(impact).counts, syllabusIds: ids(impact.syllabi), subjectIds: ids(impact.courses) })]);
    for (const file of impact.files) await conn.query('INSERT IGNORE INTO catalog_file_cleanup (file_path) VALUES (?)', [file]);
    if (impact.syllabi.length) await conn.query('DELETE FROM syllabi WHERE syllabus_id IN (?)', [ids(impact.syllabi)]);
    if (impact.courses.length) await conn.query('DELETE FROM courses WHERE course_id IN (?)', [ids(impact.courses)]);
    if (impact.curricula.length) await conn.query('DELETE FROM curriculum WHERE curriculum_id IN (?)', [ids(impact.curricula)]);
    await conn.query('DELETE FROM programs WHERE program_id = ?', [id]);
    return { deleted: true, ...summary(impact) };
  });
}
async function rename(db, id, actor, body) {
  if (Object.keys(body).some(key => !['name', 'expectedName', 'code', 'expectedCode'].includes(key))) throw httpError(400, 'Only the program code and name can be changed.');
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2 || name.length > 255 || !/\p{L}.*\p{L}/u.test(name) || typeof body.expectedName !== 'string') throw httpError(400, 'Enter a valid program name and reload the current record.');
  return inTransaction(db, async conn => {
    const [programs] = await conn.query('SELECT program_id AS id, code, name FROM programs ORDER BY program_id FOR UPDATE');
    const program = programs.find(row => row.id === id);
    if (!program) throw missing();
    const code = body.code === undefined ? program.code : typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    if (!/^[A-Z][A-Z0-9-]{1,19}$/.test(code)) throw httpError(400, 'Use a program code of 2 to 20 letters, digits or hyphens, starting with a letter.');
    if (body.code !== undefined && body.expectedCode !== program.code) throw httpError(409, 'This program was changed by someone else. Reload before saving.');
    if (program.name !== body.expectedName) throw httpError(409, 'This program was changed by someone else. Reload before saving.');
    if (programs.some(row => row.id !== id && normalizeName(row.name) === normalizeName(name))) throw httpError(409, 'Another program already uses that name.');
    if (programs.some(row => row.id !== id && (row.code === code || normalizeName(row.name) === normalizeName(code)))) throw httpError(409, 'Another program already uses that code.');
    const [aliases] = await conn.query('SELECT program_id, code FROM program_code_aliases WHERE code IN (?) FOR UPDATE', [[code, program.code]]);
    if (aliases.some(row => row.program_id !== id)) throw httpError(409, 'That program code is reserved by existing records. Choose another code.');
    await conn.query('INSERT IGNORE INTO program_name_aliases (program_id, name) VALUES (?, ?)', [id, program.name]);
    if (code !== program.code) await conn.query('INSERT IGNORE INTO program_code_aliases (code, program_id) VALUES (?, ?)', [program.code, id]);
    await conn.query('UPDATE programs SET code = ?, name = ? WHERE program_id = ?', [code, name, id]);
    await conn.query('INSERT INTO catalog_events (actor_id, action, program_code, program_name, details) VALUES (?, ?, ?, ?, ?)', [actor, 'rename_program', code, name, JSON.stringify({ previousCode: program.code, previousName: program.name })]);
    return { id, code, name };
  });
}
module.exports = { impactOf, preview, remove, rename };
