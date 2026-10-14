// Builder content: the structured form (meta, description, CLOs, plan, ...) saved as one JSON document
// per syllabus, written section by section so autosave sends only what changed.
// Mounted on /api/syllabi after routes/syllabi.js (different paths, so the two never overlap).
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { inTransaction, httpError, sendError } = require('../lib/http');
const { notifyAdmins } = require('../lib/notify');
const rules = require('../lib/syllabusRules');
const { loadCourse } = require('../lib/courses');
const assignments = require('../lib/assignments');
const { loadOutcomes } = require('../lib/institution');
const { findProgram, loadProgram } = require('../lib/programs');
const { catalogGaps, gapsMessage } = require('../lib/catalogReady');
const compliance = require('../lib/compliance/service');
const { LABEL_SQL, labelsOf } = require('../lib/syllabusLabels');
const router = express.Router();

const MAX_CONTENT_BYTES = 512 * 1024;
// Top-level keys of the content document. `signoff` is deliberately absent: the system sets it, faculty do not.
// `clos` is accepted but never trusted: the course learning outcomes always come from the course catalog (admin-managed).
const SECTIONS = { meta: 'object', description: 'array', clos: 'array', plan: 'array', reqs: 'array', refs: 'object', grading: 'object' };
const TAG = /^(clo|ega|po):[A-Za-z0-9_-]{1,40}$/;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Shallow structural checks. What a tag points at is the client's rule; here we only keep malformed data out.
function validateSections(sections) {
  if (!isObject(sections) || !Object.keys(sections).length) throw httpError(400, 'sections must be an object with at least one section');
  for (const [key, value] of Object.entries(sections)) {
    if (!SECTIONS[key]) throw httpError(400, `Unknown section "${key}"`);
    const ok = SECTIONS[key] === 'array' ? Array.isArray(value) : isObject(value);
    if (!ok) throw httpError(400, `Section "${key}" must be ${SECTIONS[key] === 'array' ? 'a list' : 'an object'}`);
  }
  if (sections.meta) {
    for (const k of ['code', 'title']) if (sections.meta[k] !== undefined && typeof sections.meta[k] !== 'string') throw httpError(400, `meta.${k} must be text`);
    if (sections.meta.courseId !== undefined && sections.meta.courseId !== null && !Number.isInteger(sections.meta.courseId)) throw httpError(400, 'meta.courseId must be a course id');
    if (typeof sections.meta.code === 'string' && sections.meta.code.length > 50) throw httpError(400, 'Course code is too long (max 50 characters)');
    if (typeof sections.meta.title === 'string' && sections.meta.title.length > 255) throw httpError(400, 'Title is too long (max 255 characters)');
  }
  if (sections.plan) {
    for (const row of sections.plan) {
      if (!isObject(row) || !Array.isArray(row.ilos)) throw httpError(400, 'Each plan row needs an ilos list');
      for (const il of row.ilos) {
        if (!isObject(il) || !Array.isArray(il.tags) || il.tags.some((t) => typeof t !== 'string' || !TAG.test(t))) {
          throw httpError(400, 'ILO tags must look like clo:<id>, ega:<no> or po:<no>');
        }
      }
    }
  }
}

const parseId = (raw) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw httpError(404, 'Syllabus not found');
  return id;
};

// Makes the content agree with the course catalog: the course's code, title and CLOs are constant data that only
// admins edit, so whatever the client sent for them is replaced. No course chosen means no CLOs.
async function applyCatalog(db, content) {
  const courseId = content.meta && Number.isInteger(content.meta.courseId) ? content.meta.courseId : null;
  const course = courseId ? await loadCourse(db, courseId) : null;
  if (courseId && !course) throw httpError(400, 'That course does not exist');
  if (course) { content.meta.code = course.code; content.meta.title = course.title; }
  content.clos = course ? course.clos : [];
  return course;
}

// The vision, mission, EGAs and the program's outcomes as they are when a syllabus is submitted. Once submitted, the
// syllabus shows these texts (not the live ones), so a later admin edit does not rewrite what was reviewed or approved.
// Drafts have none and always show the live data. Clients cannot send this key: validateSections refuses it.
async function catalogSnapshot(db, content) {
  const institution = await loadOutcomes(db);
  let program = null;
  try { program = await loadProgram(db, await findProgram(db, content.meta && content.meta.program ? content.meta.program : '')); } catch { program = null; }
  return { institution, program: program ? { code: program.code, name: program.name, egas: program.egas, pos: program.pos } : null, savedAt: new Date().toISOString() };
}

// A new, empty draft. It is the owner's alone: admins never see drafts and no one is notified.
router.post('/drafts', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    await assignments.requireCourseAccess(db, req.session.user, null); // faculty need at least one assigned course
    const [result] = await db.query(
      "INSERT INTO syllabi (user_id, title, course_code, status, version) VALUES (?, '', '', 'draft', 'v1.0')",
      [req.session.user.id]
    );
    res.json({ id: result.insertId });
  } catch (err) { sendError(res, err); }
});

router.get('/:id/content', requireAuth, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const [rows] = await req.app.locals.db.query(
      'SELECT syllabus_id, user_id, status, version, content, content_schema_version, content_updated_at, course_id FROM syllabi WHERE syllabus_id = ?', [id]);
    const syl = rows[0];
    if (!syl || !rules.canView(req.session.user, syl)) throw httpError(404, 'Syllabus not found');
    let content = null;
    if (syl.content) { try { content = JSON.parse(syl.content); } catch { content = null; } }
    // The owner may edit only while the course is assigned to them (an admin can assign it again).
    let editable = rules.canEdit(req.session.user, syl);
    let lockedReason = null;
    if (editable && !rules.isAdmin(req.session.user)) {
      lockedReason = assignments.writeBlockedReason(req.session.user, await assignments.loadAssignments(req.app.locals.db, req.session.user.id), syl.course_id);
      if (lockedReason) editable = false;
    }
    res.json({ id, status: syl.status, version: syl.version, content, schemaVersion: syl.content_schema_version, updatedAt: syl.content_updated_at, editable, lockedReason });
  } catch (err) { sendError(res, err); }
});

// Body: { sections: { plan: [...], meta: {...} }, schemaVersion }. The given sections replace the stored ones;
// the others are untouched, so two tabs editing different sections never overwrite each other.
router.put('/:id/content', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const me = req.session.user;
    const id = parseId(req.params.id);
    const { sections, schemaVersion } = req.body || {};
    validateSections(sections);
    const version = Number.isInteger(schemaVersion) && schemaVersion > 0 && schemaVersion < 1000 ? schemaVersion : 2;

    const saved = await inTransaction(db, async (conn) => {
      const [rows] = await conn.query('SELECT syllabus_id, user_id, status, title, course_code, content, course_id FROM syllabi WHERE syllabus_id = ? FOR UPDATE', [id]);
      const syl = rows[0];
      if (!syl || !rules.canView(me, syl)) throw httpError(404, 'Syllabus not found'); // never reveal it to non-participants
      if (!rules.isOwner(me, syl)) throw httpError(403, 'Only the owner can edit syllabus content');
      if (!rules.canEdit(me, syl)) throw httpError(409, rules.lockedMessage(syl));

      await assignments.requireCourseAccess(conn, me, syl.course_id); // the syllabus's current course must be assigned

      let current = {};
      if (syl.content) { try { current = JSON.parse(syl.content); } catch { current = {}; } }
      const merged = { ...current, ...sections, schemaVersion: version };
      // and so must the course being chosen
      if (merged.meta && Number.isInteger(merged.meta.courseId)) await assignments.requireCourseAccess(conn, me, merged.meta.courseId);
      const course = await applyCatalog(conn, merged);
      const json = JSON.stringify(merged);
      if (Buffer.byteLength(json, 'utf8') > MAX_CONTENT_BYTES) throw httpError(413, `This syllabus is too large to save (limit ${MAX_CONTENT_BYTES / 1024} KB)`);

      // Keep the list columns (My Syllabi, repository) in step with the form's course code and title.
      const title = merged.meta && typeof merged.meta.title === 'string' ? merged.meta.title : syl.title;
      const code = merged.meta && typeof merged.meta.code === 'string' ? merged.meta.code : syl.course_code;
      await conn.query(
        'UPDATE syllabi SET content = ?, content_schema_version = ?, content_updated_at = NOW(), title = ?, course_code = ?, course_id = ? WHERE syllabus_id = ?',
        [json, version, title, code, course ? course.id : null, id]
      );
      return { bytes: Buffer.byteLength(json, 'utf8'), clos: merged.clos };
    });
    res.json({ savedAt: new Date().toISOString(), bytes: saved.bytes, clos: saved.clos });
  } catch (err) { sendError(res, err); }
});

// Read a syllabus the way a reviewer does: the submitted version (the latest, or the one in ?version=), with who wrote it and for which
// program and subject. Read-only. An admin may read any syllabus that is not a draft, the owner their own, anyone else gets a 404.
// A syllabus uploaded as a file has no form: `content` is null and `file` says where the upload is.
router.get('/:id/review', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const me = req.session.user;
    const id = parseId(req.params.id);
    const [rows] = await db.query(
      'SELECT s.syllabus_id, s.user_id, s.status, s.version, s.title, s.course_code, s.file_path, s.content, ' + LABEL_SQL + ' WHERE s.syllabus_id = ?', [id]);
    const syl = rows[0];
    if (!syl || !rules.canView(me, syl)) throw httpError(404, 'Syllabus not found');

    const [vrows] = await db.query(
      'SELECT version_id, version_label, status_at_save, note, created_at, file_path, (content IS NOT NULL) AS has_form FROM syllabus_versions WHERE syllabus_id = ? ORDER BY version_id DESC', [id]);
    const versions = vrows.map((v) => ({ id: v.version_id, label: v.version_label, statusAtSave: v.status_at_save, note: v.note || '', createdAt: v.created_at, filePath: v.file_path || null, hasForm: !!v.has_form }));

    let chosen = versions[0] || null;
    if (req.query.version !== undefined) {
      const want = Number(req.query.version);
      chosen = Number.isInteger(want) ? versions.find((v) => v.id === want) || null : null;
      if (!chosen) throw httpError(404, 'Version not found'); // an id that is not one of this syllabus's versions
    }

    let raw = syl.content; // a syllabus with no stored version falls back to its own saved form
    if (chosen) {
      const [crow] = await db.query('SELECT content FROM syllabus_versions WHERE version_id = ? AND syllabus_id = ?', [chosen.id, id]);
      raw = crow[0] ? crow[0].content : null;
    }
    let content = null;
    if (raw) { try { content = JSON.parse(raw); } catch { content = null; } }
    const filePath = chosen ? chosen.filePath : syl.file_path || null;
    res.json({
      syllabus: { id, userId: syl.user_id, status: syl.status, version: syl.version, courseCode: syl.course_code, title: syl.title, ...labelsOf(syl, content) },
      version: chosen,
      versions,
      content,
      catalog: content && content.catalog ? content.catalog : null,
      file: filePath ? { path: filePath } : null,
    });
  } catch (err) { sendError(res, err); }
});

// Submit a draft for review, or save a new version of a syllabus that is already in the system.
// Either way the form content as it is now is stored with the version, so the history can show what changed.
//  - draft           -> first version (v1.0), status submitted, admins notified;
//  - submitted / under review / for revision -> next version label; for revision becomes submitted again.
// Approved and rejected syllabi are locked (409). Body: { note? }.
router.post('/:id/submit', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const me = req.session.user;
    const id = parseId(req.params.id);
    const note = typeof (req.body || {}).note === 'string' ? req.body.note.trim().slice(0, 1000) : '';

    const complianceReady = await compliance.isInstalled(db);
    const outcome = await inTransaction(db, async (conn) => {
      const [rows] = await conn.query('SELECT * FROM syllabi WHERE syllabus_id = ? FOR UPDATE', [id]);
      const syl = rows[0];
      if (!syl || !rules.canView(me, syl)) throw httpError(404, 'Syllabus not found');
      if (!rules.isOwner(me, syl)) throw httpError(403, 'Only the owner can submit a syllabus');
      if (!rules.canEdit(me, syl)) throw httpError(409, rules.lockedMessage(syl));
      await assignments.requireCourseAccess(conn, me, syl.course_id);

      let content = null;
      if (syl.content) { try { content = JSON.parse(syl.content); } catch { content = null; } }
      const meta = content && content.meta;
      if (!meta || !Number.isInteger(meta.courseId)) throw httpError(400, 'Choose a course before submitting');
      await assignments.requireCourseAccess(conn, me, meta.courseId);
      // The version records the course outcomes as they are in the catalog now.
      await applyCatalog(conn, content);
      content.catalog = await catalogSnapshot(conn, content);
      // The syllabus is built from what an administrator sets up. Without it the faculty member could not have completed the
      // Learning Outcomes step, so refuse here too (the builder also blocks it).
      const cat = content.catalog;
      const gaps = catalogGaps({
        vision: cat.institution.vision, mission: cat.institution.mission,
        egaCount: cat.program ? cat.program.egas.length : 0, poCount: cat.program ? cat.program.pos.length : 0,
        cloCount: (content.clos || []).length, programCode: cat.program ? cat.program.code : meta.program, subjectCode: meta.code,
      });
      if (gaps.length) throw httpError(409, gapsMessage(gaps));
      // The form must follow the standard. A 'blocking' rule failing stops the submit (409 with the failed rules); anything
      // else only warns, and the builder offers "Submit anyway". The run is stored with the version below.
      const result = compliance.check(content, { catalog: content.catalog, preparedBy: `${me.firstName} ${me.lastName}` });
      if (!result.conformance.ok) {
        const g = compliance.gateError(result);
        throw httpError(409, g.message, { failed: g.failed });
      }
      const snapshot = JSON.stringify(content);
      if (Buffer.byteLength(snapshot, 'utf8') > MAX_CONTENT_BYTES) throw httpError(413, `This syllabus is too large to submit (limit ${MAX_CONTENT_BYTES / 1024} KB)`);
      await conn.query('UPDATE syllabi SET content = ?, content_updated_at = NOW() WHERE syllabus_id = ?', [snapshot, id]);

      const first = syl.status === 'draft';
      const label = first ? 'v1.0' : rules.nextVersionLabel(syl.version);
      const newStatus = rules.statusAfterOwnerEdit(syl.status);
      const versionNote = first ? 'Initial version' : (note || 'Updated by author');
      await conn.query('UPDATE syllabi SET status = ?, version = ? WHERE syllabus_id = ?', [newStatus, label, id]);
      const [versionRow] = await conn.query(
        `INSERT INTO syllabus_versions (syllabus_id, version_label, title, course_code, curriculum_id, file_path, status_at_save, note, content, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, label, content.meta.title, content.meta.code, syl.curriculum_id, syl.file_path, newStatus, versionNote, snapshot, me.id]
      );
      // The compliance run is stored with the version, in the same transaction, once the tables exist: it is the authoritative one.
      let runId = null;
      if (complianceReady) runId = await compliance.storeRun(conn, { syllabusId: id, versionId: versionRow && versionRow.insertId ? versionRow.insertId : null, content, result, createdBy: me.id });
      await conn.query(
        'INSERT INTO submission_logs (syllabus_id, user_id, action, notes) VALUES (?, ?, ?, ?)',
        [id, me.id, first ? 'upload' : (syl.status === 'for_revision' ? 'submit' : 'update'), (first ? 'Syllabus submitted from the builder' : `Saved as ${label}: ${versionNote}`).slice(0, 500)]
      );
      return { previous: syl.status, label, status: newStatus, courseCode: syl.course_code, title: syl.title, runId, content, result };
    });

    // After the commit, outside the transaction: the AI recommendations are a background job. They never delay or fail a submit.
    if (outcome.runId && outcome.result.status === 'scored' && outcome.result.findings.length) {
      compliance.startAiJob(db, { runId: outcome.runId, content: outcome.content, result: outcome.result, names: compliance.namesFor(me, outcome.content) });
    }

    // After the commit: notifications never affect the result.
    const who = `${me.firstName} ${me.lastName}`;
    if (outcome.previous === 'draft') {
      await notifyAdmins(db, { exceptUserId: me.id, type: 'submission', syllabusId: id, title: `New syllabus submitted: ${outcome.courseCode || outcome.title}`, body: `${who} submitted ${outcome.title || outcome.courseCode} for review.` });
    } else if (outcome.previous === 'under_review' || outcome.previous === 'for_revision') {
      await notifyAdmins(db, {
        exceptUserId: me.id, type: 'edit', syllabusId: id,
        title: outcome.previous === 'under_review' ? `Syllabus updated during review: ${outcome.courseCode} (${outcome.label})` : `Syllabus resubmitted: ${outcome.courseCode} (${outcome.label})`,
        body: `${who} saved a new version.`,
      });
    }
    res.json({ version: outcome.label, status: outcome.status });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
module.exports.MAX_CONTENT_BYTES = MAX_CONTENT_BYTES;
module.exports.catalogSnapshot = catalogSnapshot;
