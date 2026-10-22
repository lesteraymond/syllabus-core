// Builder content: the structured form (meta, description, CLOs, plan, ...) saved as one JSON document
// per syllabus, written section by section so autosave sends only what changed.
// Mounted on /api/syllabi after routes/syllabi.js (different paths, so the two never overlap).
const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { inTransaction, httpError, sendError } = require('../lib/http');
const { notifyAdmins } = require('../lib/notify');
const rules = require('../lib/syllabusRules');
const { loadCourse } = require('../lib/courses');
const assignments = require('../lib/assignments');
const subjectLock = require('../lib/subjectLock');
const { outcomesFrom, validateOutcomes } = require('../lib/syllabusOutcomes');
const { catalogGaps, gapsMessage } = require('../lib/catalogReady');
const compliance = require('../lib/compliance/service');
const { changedSections, describeChanges, normalize } = require('../lib/versionChange');
const { LABEL_SQL, labelsOf } = require('../lib/syllabusLabels');
const router = express.Router();

const MAX_CONTENT_BYTES = 512 * 1024;
// Top-level keys of the content document. `signoff` is deliberately absent: the system sets it, faculty do not.
const SECTIONS = { meta: 'object', outcomes: 'object', description: 'array', clos: 'array', plan: 'array', reqs: 'array', refs: 'object', grading: 'object' };
const TAG = /^(clo|ega|po):[A-Za-z0-9_-]{1,40}$/;

const parseJson = (text) => { try { return text ? JSON.parse(text) : null; } catch { return null; } };
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

// Only course identity is catalog-managed. Updated clients save their own Step 2 content.
// Preserve the legacy contract for clients/drafts that have not adopted syllabus-owned outcomes yet.
async function applyCatalog(db, content) {
  const courseId = content.meta && Number.isInteger(content.meta.courseId) ? content.meta.courseId : null;
  const course = courseId ? await loadCourse(db, courseId, { lock: true }) : null;
  if (courseId && !course) throw httpError(400, 'That course does not exist');
  if (course) { content.meta.code = course.code; content.meta.title = course.title; content.meta.program = course.program.code; }
  if (!content.outcomes) content.clos = course ? course.clos : [];
  else {
    validateOutcomes(content.outcomes, content.clos || [], content.plan || []);
    const o = content.outcomes;
    if (!course && (content.clos?.length || o.egas.length || o.pos.length || o.vision.trim() || o.mission.lead.trim() || o.mission.items.length)) throw httpError(400, 'Choose a subject before editing learning outcomes.');
    content.catalog = snapshotFrom(content, course);
  }
  return course;
}

// Build the trusted display snapshot from authored Step 2 values and catalog identity.
// Legacy content keeps its existing catalog behavior until adopted in the editable builder.
async function catalogSnapshot(db, content) {
  const course = content?.meta?.courseId ? await loadCourse(db,content.meta.courseId) : null;
  return snapshotFrom(content, course);
}
function snapshotFrom(content, course) {
  const standards = content.outcomes || course?.standards || require('../lib/subjectStandards').blankStandards();
  return {
    institution: { vision: standards.vision, mission: standards.mission, egas: standards.egas },
    program: course ? { code: course.program.code, name: course.program.name, egas: standards.egas, pos: standards.pos } : null,
    subjectId: course?.id || null, savedAt: new Date().toISOString(),
  };
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
      'SELECT syllabus_id, user_id, status, version, content, content_schema_version, content_updated_at, course_id, archived_at, admin_comment FROM syllabi WHERE syllabus_id = ?', [id]);
    const syl = rows[0];
    if (!syl || !rules.canView(req.session.user, syl)) throw httpError(404, 'Syllabus not found');
    let content = null;
    if (syl.content) { try { content = JSON.parse(syl.content); } catch { content = null; } }
    // The owner may edit only while the course is assigned to them (an admin can assign it again).
    let editable = rules.canEdit(req.session.user, syl);
    let lockedReason = null;
    let adoptedOutcomes = false;
    if (editable && !rules.isAdmin(req.session.user)) {
      lockedReason = assignments.writeBlockedReason(req.session.user, await assignments.loadAssignments(req.app.locals.db, req.session.user.id), syl.course_id);
      if (lockedReason) editable = false;
    }
    if (editable && content?.meta?.courseId && !content.outcomes) {
      const course = await loadCourse(req.app.locals.db, content.meta.courseId);
      content.outcomes = outcomesFrom(content, course);
      if (!content.clos?.length) content.clos = course?.clos || [];
      content.schemaVersion = 3;
      adoptedOutcomes = true;
    }
    // Back from "For revision": the next submission becomes the next version, and the reviewer's note says what to change.
    const revising = rules.isReturned(syl.status);
    res.json({ id, status: syl.status, version: syl.version, content, adoptedOutcomes, schemaVersion: syl.content_schema_version, updatedAt: syl.content_updated_at, editable, lockedReason,
      ...(revising ? { nextVersion: rules.nextVersionLabel(syl.version), reviewerNote: syl.admin_comment || '' } : {}) });
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
      const [rows] = await conn.query('SELECT syllabus_id, user_id, status, title, course_code, content, course_id, archived_at FROM syllabi WHERE syllabus_id = ? FOR UPDATE', [id]);
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
      if (course && course.id !== syl.course_id) await subjectLock.assertSubjectFree(conn, me, course.id, id); // one syllabus for each subject
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
      'SELECT s.syllabus_id, s.user_id, s.status, s.version, s.title, s.course_code, s.file_path, s.content, s.course_id, ' + LABEL_SQL + ' WHERE s.syllabus_id = ?', [id]);
    const syl = rows[0];
    // A student reads any approved syllabus.
    const studentReads = me.role === 'student' && !!syl && syl.status === 'approved';
    if (!syl || !(rules.canView(me, syl) || studentReads)) throw httpError(404, 'Syllabus not found');

    const [vrows] = await db.query(
      'SELECT version_id, version_label, status_at_save, note, created_at, file_path, (content IS NOT NULL) AS has_form FROM syllabus_versions WHERE syllabus_id = ? ORDER BY version_id DESC', [id]);
    let versions = vrows.map((v) => ({ id: v.version_id, label: v.version_label, statusAtSave: v.status_at_save, note: v.note || '', createdAt: v.created_at, filePath: v.file_path || null, hasForm: !!v.has_form }));
    if (studentReads) versions = versions.slice(0, 1).map((v) => ({ ...v, note: '' })); // only the current version, without the review notes

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
    // What the faculty member changed since the version before this one, so a reviewer can tell a real revision from a small edit.
    let changes = null;
    if (chosen && content) {
      const [before] = await db.query('SELECT version_label, content FROM syllabus_versions WHERE syllabus_id = ? AND version_id < ? AND content IS NOT NULL ORDER BY version_id DESC LIMIT 1', [id, chosen.id]);
      if (before[0]) {
        const list = changedSections(parseJson(before[0].content), content);
        if (!studentReads) changes = { from: before[0].version_label, sections: list, text: describeChanges(list) };
      }
    }
    res.json({
      syllabus: { id, userId: syl.user_id, status: syl.status, version: syl.version, courseCode: syl.course_code, title: syl.title, ...labelsOf(syl, content) },
      version: chosen,
      versions,
      changes,
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
// Completed administrator revisions are immutable. Review cycles and snapshot timestamps
// invalidate AI checks, but do not create duplicate content versions.
function adminRevisionContent(content) {
  const { reviewCycle, signoff, catalog, ...form } = content || {};
  const { savedAt, ...standards } = catalog || {};
  return normalize({ ...form, catalog: standards });
}
async function saveAdminRevision(conn, syl, content, me) {
  const previous = await compliance.latestVersion(conn, syl.syllabus_id);
  if (previous && JSON.stringify(adminRevisionContent(parseJson(previous.content))) === JSON.stringify(adminRevisionContent(content))) {
    return previous.version_label;
  }
  const label = previous ? rules.nextVersionLabel(previous.version_label) : 'v1.0';
  await conn.query(
    `INSERT INTO syllabus_versions (syllabus_id, version_label, title, course_code, curriculum_id, file_path, status_at_save, note, content, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [syl.syllabus_id, label, content.meta.title, content.meta.code, syl.curriculum_id, syl.file_path, 'under_review',
      previous ? 'Administrator revision prepared for AI check' : 'Administrator syllabus prepared for AI check', JSON.stringify(content), me.id]
  );
  return label;
}

async function finalizeSyllabus(req, res, publishing = false, preparing = false) {
  try {
    const db = req.app.locals.db;
    const me = req.session.user;
    const id = parseId(req.params.id);
    const note = typeof (req.body || {}).note === 'string' ? req.body.note.trim().slice(0, 1000) : '';

    if (!publishing && !preparing && rules.isAdmin(me)) throw httpError(403, 'Administrators publish their own drafts after an AI check.');
    const complianceReady = await compliance.isInstalled(db);
    if (publishing && !complianceReady) throw httpError(503, 'AI Checker must be set up before publishing.');
    const outcome = await inTransaction(db, async (conn) => {
      const [rows] = await conn.query('SELECT * FROM syllabi WHERE syllabus_id = ? FOR UPDATE', [id]);
      const syl = rows[0];
      if (!syl || !rules.canView(me, syl)) throw httpError(404, 'Syllabus not found');
      if (!rules.isOwner(me, syl)) throw httpError(403, 'Only the owner can submit a syllabus');
      if (publishing && syl.status !== 'under_review') throw httpError(409, 'Complete the form and send it to AI Checker before approving.');
      if (!rules.canEdit(me, syl) && !(publishing && rules.isAdmin(me) && syl.status === 'under_review')) throw httpError(409, rules.lockedMessage(syl));
      await assignments.requireCourseAccess(conn, me, syl.course_id);

      let content = null;
      if (syl.content) { try { content = JSON.parse(syl.content); } catch { content = null; } }
      const meta = content && content.meta;
      if (!meta || !Number.isInteger(meta.courseId)) throw httpError(400, 'Choose a course before submitting');
      await assignments.requireCourseAccess(conn, me, meta.courseId);
      // Validate authored outcomes and snapshot the exact values being submitted.
      await applyCatalog(conn, content);
      if (content.outcomes) validateOutcomes(content.outcomes, content.clos || [], content.plan || [], { complete: true });
      content.catalog = await catalogSnapshot(conn, content);
      // Legacy clients still receive their catalog setup checks; new clients complete these fields in Step 2.
      const cat = content.catalog;
      const gaps = catalogGaps({
        vision: cat.institution.vision, mission: cat.institution.mission,
        egaCount: cat.program ? cat.program.egas.length : 0, poCount: cat.program ? cat.program.pos.length : 0,
        cloCount: (content.clos || []).length, programCode: cat.program ? cat.program.code : meta.program, subjectCode: meta.code,
      });
      if (gaps.length) throw httpError(409, content.outcomes ? 'Complete Vision, Mission, EGA, PO and CLO in step 2 before submitting.' : gapsMessage(gaps));
      // The form must follow the standard. A 'blocking' rule failing stops the submit (409 with the failed rules); anything
      // else only warns, and the builder offers "Submit anyway". The run is stored with the version below.
      const result = compliance.check(content, { catalog: content.catalog, preparedBy: `${me.firstName} ${me.lastName}` });
      if (!result.conformance.ok) {
        const g = compliance.gateError(result);
        throw httpError(409, g.message, { failed: g.failed });
      }
      if (preparing) {
        content.reviewCycle=(Number(content.reviewCycle)||0)+1;
        const json=JSON.stringify(content);
        if (Buffer.byteLength(json,'utf8')>MAX_CONTENT_BYTES) throw httpError(413,'This syllabus is too large to save.');
        await conn.query('UPDATE syllabi SET content = ?, content_updated_at = NOW() WHERE syllabus_id = ?',[json,id]);
        const label = await saveAdminRevision(conn, syl, content, me);
        await conn.query('UPDATE syllabi SET status = ?, version = ? WHERE syllabus_id = ?',['under_review',label,id]);
        await conn.query('INSERT INTO submission_logs (syllabus_id, user_id, action, notes) VALUES (?, ?, ?, ?)',[id,me.id,'update','Completed administrator syllabus sent to AI Checker']);
        return {preparing:true,status:'under_review',label};
      }
      if (publishing) {
        const reviewedRunId=req.body?.reviewedRunId;
        if (reviewedRunId !== undefined && (!Number.isInteger(reviewedRunId) || reviewedRunId <= 0)) throw httpError(400,'Invalid AI check reference.');
        const checkContent=compliance.publicationContent(content,content.catalog);
        const checked=await compliance.cachedRun(conn,id,compliance.hashOf(checkContent));
        if (reviewedRunId !== undefined && checked?.run_id !== reviewedRunId) throw httpError(409,'The AI check changed. Open the current result before approving.');
        if (!checked || checked.created_by !== me.id || !checked.conformant || checked.status !== 'scored' || !['ok','none'].includes(checked.ai_status)) throw httpError(409,'Check the current saved form in AI Checker and wait for the check to finish before publishing.');
      }
      if (publishing) {
        // Approval records a decision about the checked revision, not another edit.
        // Also supports completed admin syllabi created before revision snapshots existed.
        const label = await saveAdminRevision(conn, syl, content, me);
        await conn.query('UPDATE syllabi SET status = ?, version = ? WHERE syllabus_id = ?', ['approved', label, id]);
        await conn.query('INSERT INTO submission_logs (syllabus_id, user_id, action, notes) VALUES (?, ?, ?, ?)',
          [id, me.id, 'approve', 'Administrator published syllabus after AI check']);
        return { label, status: 'approved' };
      }
      // A resubmission after "For revision" is a new version only if the faculty member changed something, and says what.
      if (rules.isReturned(syl.status)) {
        const previous = await compliance.latestVersion(conn, id);
        const before = previous ? parseJson(previous.content) : null;
        if (before && changedSections(before, content).length === 0) throw httpError(409, rules.UNCHANGED, { code: 'unchanged' });
        if (note.length < rules.MIN_NOTE) throw httpError(400, rules.NEED_NOTE, { code: 'need_note' });
      }
      const snapshot = JSON.stringify(content);
      if (Buffer.byteLength(snapshot, 'utf8') > MAX_CONTENT_BYTES) throw httpError(413, `This syllabus is too large to submit (limit ${MAX_CONTENT_BYTES / 1024} KB)`);
      await conn.query('UPDATE syllabi SET content = ?, content_updated_at = NOW() WHERE syllabus_id = ?', [snapshot, id]);

      const first = syl.status === 'draft' || (publishing && !(await compliance.latestVersion(conn,id)));
      const label = first ? 'v1.0' : rules.nextVersionLabel(syl.version);
      const newStatus = publishing ? 'approved' : rules.statusAfterOwnerEdit(syl.status);
      const versionNote = publishing ? 'Published by administrator after AI check' : first ? 'Initial version' : (note || 'Updated by author');
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
        [id, me.id, publishing ? 'approve' : first || rules.isReturned(syl.status) ? 'submit' : 'update', (publishing ? 'Administrator published syllabus after AI check' : first ? 'Syllabus submitted from the builder' : `Saved as ${label}: ${versionNote}`).slice(0, 500)]
      );
      return { previous: syl.status, label, status: newStatus, courseCode: syl.course_code, title: syl.title, runId, content, result };
    });

    if (outcome.preparing) return res.json({version:outcome.label,status:outcome.status});

    // After the commit, outside the transaction: the AI recommendations are a background job. They never delay or fail a submit.
    if (outcome.runId && outcome.result.status === 'scored' && (outcome.result.findings.length || compliance.canJudge())) {
      compliance.startAiJob(db, { runId: outcome.runId, content: outcome.content, result: outcome.result, names: compliance.namesFor(me, outcome.content),
        rescore: (judged) => compliance.check(outcome.content, { catalog: outcome.content.catalog, preparedBy: `${me.firstName} ${me.lastName}`, judged }) });
    }

    // After the commit: notifications never affect the result.
    const who = `${me.firstName} ${me.lastName}`;
    if (!publishing && outcome.previous === 'draft') {
      await notifyAdmins(db, { exceptUserId: me.id, type: 'submission', syllabusId: id, title: `New syllabus submitted: ${outcome.courseCode || outcome.title}`, body: `${who} submitted ${outcome.title || outcome.courseCode} for review.` });
    } else if (!publishing && (outcome.previous === 'under_review' || rules.isReturned(outcome.previous))) {
      await notifyAdmins(db, {
        exceptUserId: me.id, type: 'edit', syllabusId: id,
        title: outcome.previous === 'under_review' ? `Syllabus updated during review: ${outcome.courseCode} (${outcome.label})` : `Syllabus resubmitted: ${outcome.courseCode} (${outcome.label})`,
        body: `${who} saved a new version.`,
      });
    }
    res.json({ version: outcome.label, status: outcome.status });
  } catch (err) { sendError(res, err); }
}
router.post('/:id/submit', requireAuth, (req,res) => finalizeSyllabus(req,res));
router.post('/:id/prepare-check', requireAuth, requireAdmin, (req,res) => finalizeSyllabus(req,res,false,true));
router.post('/:id/publish', requireAuth, requireAdmin, (req,res) => finalizeSyllabus(req,res,true));

router.post('/:id/resume-draft', requireAuth, requireAdmin, async (req,res)=>{
  try {
    const id=parseId(req.params.id);const me=req.session.user;
    await inTransaction(req.app.locals.db,async conn=>{
      const [[syl]]=await conn.query('SELECT * FROM syllabi WHERE syllabus_id = ? FOR UPDATE',[id]);
      if(!syl || !rules.canView(me,syl)) throw httpError(404,'Syllabus not found');
      if(!rules.isOwner(me,syl)) throw httpError(403,'Only the owner can edit syllabus content');
      if(syl.status!=='under_review') throw httpError(409,'Only a syllabus waiting for an AI decision can return to draft.');
      // Preserve older completed syllabi before the first editable save overwrites them.
      const content = parseJson(syl.content);
      const label = content?.meta ? await saveAdminRevision(conn, syl, content, me) : syl.version;
      await conn.query('UPDATE syllabi SET status = ?, version = ? WHERE syllabus_id = ?',['draft',label,id]);
      await conn.query('INSERT INTO submission_logs (syllabus_id, user_id, action, notes) VALUES (?, ?, ?, ?)',[id,me.id,'update','Administrator returned syllabus to draft for editing']);
    });
    res.json({status:'draft'});
  }catch(error){sendError(res,error);}
});
module.exports = router;
module.exports.MAX_CONTENT_BYTES = MAX_CONTENT_BYTES;
module.exports.catalogSnapshot = catalogSnapshot;
