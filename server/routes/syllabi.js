const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const { avatarUrlFor } = require('../lib/avatar');
const { createNotification, notifyAdmins } = require('../lib/notify');
const rules = require('../lib/syllabusRules');
const subjectLock = require('../lib/subjectLock');
const assignments = require('../lib/assignments');
const { validateReason, typeForStatus, MAX_LENGTH } = require('../lib/reviewComments');
const compliance = require('../lib/compliance/service');
const { changedSections, describeChanges } = require('../lib/versionChange');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
// Syllabus files are PDFs only: every reviewer and student can then open them in the browser.
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.pdf' && file.mimetype === 'application/pdf') return cb(null, true);
    const err = new Error('Only PDF files are accepted');
    err.status = 400;
    cb(err);
  },
});

// multer's own errors (wrong file type, over 10MB) become a normal JSON error the app can show.
const onePdf = (req, res, next) => upload.single('file')(req, res, (err) => {
  if (!err) return next();
  const message = err.code === 'LIMIT_FILE_SIZE' ? 'That file is larger than 10MB.' : err.message || 'The upload failed.';
  res.status(err.status || 400).json({ message, error: message });
});

// A submission goes to the AI Checker first and is decided in Review & Approval only after the administrator has checked it there. These
// are the decisions that wait for that check (submitting, and moving to "under review", do not).
const DECISIONS = ['approved', 'for_revision', 'rejected'];
const CHECK_FIRST = 'Check this syllabus in the AI Checker before you decide on it.';

router.get('/', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    let query = `SELECT s.*, u.first_name, u.last_name, u.avatar_path, c.program_name, co.title AS course_title, co.code AS course_code_live, pr.code AS program_code, pr.name AS program_full_name FROM syllabi s JOIN users u ON s.user_id = u.user_id LEFT JOIN curriculum c ON s.curriculum_id = c.curriculum_id LEFT JOIN courses co ON co.course_id = s.course_id LEFT JOIN programs pr ON pr.program_id = co.program_id`;
    const params = [];

    if (req.session.user.role === 'student') {
      // A student reads every approved syllabus, whatever subject it is (not only the subjects on their COR).
      query += " WHERE s.status = 'approved'";
    } else if (req.session.user.role === 'faculty') {
      query += ' WHERE s.user_id = ?';
      params.push(req.session.user.id);
    } else {
      query += " WHERE (s.status <> 'draft' OR s.user_id = ?)"; // only the administrator's own drafts are visible
      params.push(req.session.user.id);
    }

    // Archived syllabi (the subject went to another faculty member) are out of every working list; ?archived=1 asks for only those.
    query += req.query.archived === '1' ? ' AND s.archived_at IS NOT NULL' : ' AND s.archived_at IS NULL';

    // Repository reads are approved-only; the default list still powers the workflow tabs.
    if (req.query.scope === 'repository') query += " AND s.status = 'approved'";

    query += ' ORDER BY s.uploaded_at DESC';
    const [rows] = await db.query(query, params);

    // For an administrator: which submissions still wait for their own AI check (checkable, and not checked on the newest version).
    // Without the compliance tables nothing can be checked, so nothing waits.
    const admin = req.session.user.role === 'admin';
    let states = new Map();
    if (admin && rows.length) {
      try { if (await compliance.isInstalled(db)) states = await compliance.adminCheckStates(db, rows.map((r) => r.syllabus_id)); } catch { states = new Map(); }
    }

    // The student's lists and the repository show the subject as the catalog has it now (code, title, program), so a renamed or recoded subject
    // reads the same everywhere; a syllabus with no catalog subject keeps its own text. Faculty and admin working lists are unchanged.
    const live = req.session.user.role === 'student' || req.query.scope === 'repository';
    res.json(rows.map(r => ({
      id: r.syllabus_id,
      userId: r.user_id,
      curriculumId: r.curriculum_id,
      courseId: r.course_id,
      archived: !!r.archived_at,
      filePath: r.file_path,
      title: live && r.course_title ? r.course_title : r.title,
      courseCode: live && r.course_code_live ? r.course_code_live : r.course_code,
      status: r.status,
      version: r.version,
      adminComment: r.admin_comment,
      uploadedAt: r.uploaded_at,
      updatedAt: r.updated_at,
      faculty: `${r.first_name} ${r.last_name}`,
      ownerAvatarUrl: avatarUrlFor(r.user_id, r.avatar_path),
      program: r.program_name || '',
      programCode: r.program_code || '', // the catalog program of the subject (the field above comes from the old curriculum)
      programName: r.program_full_name || '',
      courseTitle: r.course_title || '',
      ...(admin ? { awaitingAiCheck: !!(states.get(r.syllabus_id) && states.get(r.syllabus_id).checkable && !states.get(r.syllabus_id).checked) } : {}),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- helpers for the write routes ----

// Runs fn(conn) inside one transaction: commit on success, rollback (and rethrow) on any error.
async function inTransaction(db, fn) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

// An HTTP error that the route handler turns into a response.
const httpError = (status, message) => Object.assign(new Error(message), { status });

// Files are never overwritten (names are unique), so the only file we ever remove is one that was
// uploaded by a request that then failed, so no version can ever point at a missing file.
const discardUpload = async (file) => { if (file) await fs.promises.unlink(file.path).catch(() => {}); };

const sendError = (res, err) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error('SYLLABUS ERROR:', err);
  return res.status(500).json({ error: err.message });
};

// MySQL here is not in strict mode and would silently cut long values, so reject them instead.
const checkLengths = ({ title, courseCode }) => {
  if (typeof title === 'string' && title.length > 255) throw httpError(400, 'Title is too long (max 255 characters)');
  if (typeof courseCode === 'string' && courseCode.length > 50) throw httpError(400, 'Course code is too long (max 50 characters)');
};

const VERSION_COLUMNS = `(syllabus_id, version_label, title, course_code, curriculum_id, file_path, status_at_save, note, created_by)`;

router.post('/', requireAuth, onePdf, async (req, res) => {
  let committed = false;
  try {
    const db = req.app.locals.db;
    if (rules.isAdmin(req.session.user)) throw httpError(403, 'Use the syllabus builder and AI Checker to publish your own syllabus.');
    const { title, courseCode, curriculumId } = req.body;
    checkLengths({ title, courseCode });
    await assignments.requireCourseCodeAccess(db, req.session.user, courseCode); // faculty: only an assigned course
    const filePath = req.file ? `/uploads/${req.file.filename}` : null;

    const syllabusId = await inTransaction(db, async (conn) => {
      // One syllabus for each subject (lib/subjectLock.js). This route takes the subject as text, so find the catalog subject it names; when
      // there is one, it is checked and stored on the row, so the rule also counts this syllabus from now on.
      const code = String(courseCode || '').trim();
      const [named] = code ? await conn.query('SELECT course_id FROM courses WHERE code = ?', [code]) : [[]];
      const courseId = named.length === 1 ? named[0].course_id : null;
      if (courseId) await subjectLock.assertSubjectFree(conn, req.session.user, courseId, 0);
      const [result] = await conn.query(
        'INSERT INTO syllabi (user_id, curriculum_id, file_path, title, course_code, course_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.session.user.id, curriculumId || null, filePath, title, courseCode, courseId, 'submitted']
      );
      await conn.query(
        `INSERT INTO syllabus_versions ${VERSION_COLUMNS} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [result.insertId, 'v1.0', title, courseCode, curriculumId || null, filePath, 'submitted', 'Initial version', req.session.user.id]
      );
      await conn.query(
        'INSERT INTO submission_logs (syllabus_id, user_id, action, notes) VALUES (?, ?, ?, ?)',
        [result.insertId, req.session.user.id, 'upload', 'Syllabus uploaded']
      );
      return result.insertId;
    });
    committed = true;

    await notifyAdmins(db, {
      exceptUserId: req.session.user.id,
      type: 'submission',
      syllabusId,
      title: `New syllabus submitted: ${courseCode || title || 'Untitled'}`,
      body: `${req.session.user.firstName} ${req.session.user.lastName} submitted ${title || courseCode || 'a syllabus'} for review.`,
    });
    res.json({ id: syllabusId, message: 'Syllabus uploaded' });
  } catch (err) {
    if (!committed) await discardUpload(req.file);
    sendError(res, err);
  }
});

// Two kinds of update share this route:
//  - an admin changes the status (and optionally the reviewer comment): JSON body with `status`;
//  - the owner edits the content (title, course code, curriculum, file, note): this creates a new version.
router.put('/:id', requireAuth, onePdf, async (req, res) => {
  const db = req.app.locals.db;
  const me = req.session.user;
  let committed = false;
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw httpError(404, 'Syllabus not found');
    const { title, courseCode, curriculumId, note, status, adminComment } = req.body;
    checkLengths({ title, courseCode });
    const hasContent = title !== undefined || courseCode !== undefined || curriculumId !== undefined || !!req.file;

    const outcome = await inTransaction(db, async (conn) => {
      const [rows] = await conn.query('SELECT * FROM syllabi WHERE syllabus_id = ? FOR UPDATE', [id]);
      const syl = rows[0];
      if (!syl || !rules.canView(me, syl)) throw httpError(404, 'Syllabus not found'); // never reveal it to non-participants

      // ---- status change: admin only ----
      if (status !== undefined && status !== '') {
        if (rules.isArchived(syl)) throw httpError(409, rules.ARCHIVED_MESSAGE);
        if (rules.isAdmin(me) && rules.isOwner(me,syl) && status === 'approved') throw httpError(409, 'Use the syllabus builder and AI Checker to publish your own syllabus.');
        if (syl.status === 'draft') throw httpError(409, 'Complete the form and check it in AI Checker before publishing your draft.');
        if (!rules.canChangeStatus(me)) throw httpError(403, 'Only administrators can change a syllabus status');
        if (!rules.STATUSES.includes(status)) throw httpError(400, 'Invalid status');
        if (hasContent) throw httpError(403, 'Administrators cannot edit syllabus content');
        if (DECISIONS.includes(status) && await compliance.isInstalled(db)) { // the AI check comes first, then the administrator decides
          const state = (await compliance.adminCheckStates(conn, [id])).get(id);
          if (state && state.checkable && !state.checked) throw httpError(409, CHECK_FIRST);
        }
        // Returning a syllabus for revision or rejecting it needs a reason; approving does not.
        const reason = validateReason(status, adminComment);
        const fields = ['status = ?'];
        const params = [status];
        if (adminComment !== undefined) { fields.push('admin_comment = ?'); params.push(adminComment); }
        await conn.query(`UPDATE syllabi SET ${fields.join(', ')} WHERE syllabus_id = ?`, [...params, id]);
        const action = { approved: 'approve', rejected: 'reject', for_revision: 'revision', submitted: 'submit' }[status] || 'update';
        await conn.query('INSERT INTO submission_logs (syllabus_id, user_id, action, notes) VALUES (?, ?, ?, ?)', [id, me.id, action, (`Status changed to ${status}` + (reason ? ': ' + reason : '')).slice(0, 500)]);
        // The reason is kept as a comment too, in the same transaction, so the thread and the status cannot disagree.
        if (reason) await conn.query('INSERT INTO comments (syllabus_id, user_id, comment_text, comment_type) VALUES (?, ?, ?, ?)', [id, me.id, reason.slice(0, MAX_LENGTH), typeForStatus(status)]);
        return { kind: 'status', syl, status, comment: adminComment !== undefined ? adminComment : syl.admin_comment };
      }

      // Administrator-authored records publish only through the checked form transaction.
      if (rules.isAdmin(me) && rules.isOwner(me,syl)) throw httpError(409, 'Use the syllabus builder and AI Checker to publish your own syllabus.');
      // ---- content edit: the owner only ----
      if (rules.isAdmin(me) && !rules.isOwner(me, syl)) throw httpError(403, 'Administrators cannot edit syllabus content');
      if (!rules.canEdit(me, syl)) throw httpError(409, rules.lockedMessage(syl));

      // The same rule as the builder's submit: back from "For revision" only with a change (a new file, or a different title, code or
      // curriculum), and a sentence saying what it is.
      if (rules.isReturned(syl.status)) {
        const changed = !!req.file
          || (title !== undefined && title !== syl.title)
          || (courseCode !== undefined && courseCode !== syl.course_code)
          || (curriculumId !== undefined && curriculumId !== '' && String(curriculumId) !== String(syl.curriculum_id == null ? '' : syl.curriculum_id));
        if (!changed) throw httpError(409, rules.UNCHANGED);
        if (!(typeof note === 'string' && note.trim().length >= rules.MIN_NOTE)) throw httpError(400, rules.NEED_NOTE);
      }
      const next = {
        title: title !== undefined ? title : syl.title,
        courseCode: courseCode !== undefined ? courseCode : syl.course_code,
        curriculumId: curriculumId !== undefined && curriculumId !== '' ? curriculumId : syl.curriculum_id,
        filePath: req.file ? `/uploads/${req.file.filename}` : syl.file_path,
      };
      // Faculty: the syllabus's course (and the code being typed) must be assigned to them, or it is read-only.
      if (syl.course_id) await assignments.requireCourseAccess(conn, me, syl.course_id);
      await assignments.requireCourseCodeAccess(conn, me, next.courseCode);
      const newStatus = rules.statusAfterOwnerEdit(syl.status);
      const first = syl.status === 'draft'; // a draft submitted as an uploaded file is the first version
      const label = first ? 'v1.0' : rules.nextVersionLabel(syl.version); // the client's version, if any, is ignored
      const versionNote = (typeof note === 'string' && note.trim()) ? note.trim().slice(0, 1000) : (first ? 'Initial version (uploaded file)' : 'Updated by author');

      await conn.query(
        'UPDATE syllabi SET title = ?, course_code = ?, curriculum_id = ?, file_path = ?, status = ?, version = ? WHERE syllabus_id = ?',
        [next.title, next.courseCode, next.curriculumId || null, next.filePath, newStatus, label, id]
      );
      await conn.query(
        `INSERT INTO syllabus_versions ${VERSION_COLUMNS} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, label, next.title, next.courseCode, next.curriculumId || null, next.filePath, newStatus, versionNote, me.id]
      );
      await conn.query(
        'INSERT INTO submission_logs (syllabus_id, user_id, action, notes) VALUES (?, ?, ?, ?)',
        [id, me.id, first ? 'upload' : (rules.isReturned(syl.status) ? 'submit' : 'update'), `${first ? 'Uploaded file, saved as' : 'Edited, saved as'} ${label}: ${versionNote}`.slice(0, 500)]
      );
      return { kind: 'edit', syl, label, title: next.title, courseCode: next.courseCode, previousStatus: syl.status };
    });

    committed = true;
    // After the commit: notifications never affect the result.
    if (outcome.kind === 'status') {
      const decision = { approved: 'Syllabus approved', for_revision: 'Revision requested', rejected: 'Syllabus rejected' }[outcome.status];
      if (decision && outcome.syl.user_id !== me.id) {
        await createNotification(db, {
          userId: outcome.syl.user_id,
          type: 'status',
          syllabusId: id,
          title: `${decision}: ${outcome.syl.course_code || outcome.syl.title}`,
          body: outcome.comment ? `Reviewer comment: ${outcome.comment}` : '',
        });
      }
      return res.json({ message: 'Syllabus updated' });
    }

    if (outcome.previousStatus === 'draft') {
      await notifyAdmins(db, {
        exceptUserId: me.id,
        type: 'submission',
        syllabusId: id,
        title: `New syllabus submitted: ${outcome.courseCode || outcome.title || 'Untitled'}`,
        body: `${me.firstName} ${me.lastName} submitted ${outcome.title || outcome.courseCode || 'a syllabus'} (uploaded file) for review.`,
      });
    } else if (outcome.previousStatus === 'under_review' || rules.isReturned(outcome.previousStatus)) {
      await notifyAdmins(db, {
        exceptUserId: me.id,
        type: 'edit',
        syllabusId: id,
        title: outcome.previousStatus === 'under_review'
          ? `Syllabus updated during review: ${outcome.courseCode} (${outcome.label})`
          : `Syllabus resubmitted: ${outcome.courseCode} (${outcome.label})`,
        body: `${me.firstName} ${me.lastName} saved a new version.`,
      });
    }
    res.json({ message: 'Syllabus updated', version: outcome.label });
  } catch (err) {
    if (!committed) await discardUpload(req.file); // a rejected or failed edit leaves no orphan file behind
    sendError(res, err);
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw httpError(404, 'Syllabus not found');
    const [rows] = await db.query('SELECT syllabus_id, user_id, status FROM syllabi WHERE syllabus_id = ?', [id]);
    const me = req.session.user;
    if (!rows[0] || !rules.canView(me, rows[0])) throw httpError(404, 'Syllabus not found');
    if (!rules.canDelete(me, rows[0])) throw httpError(409, 'Only draft syllabi can be deleted by faculty.');
    // Enforce the draft restriction in the mutation too: a concurrent submission must never be deleted.
    const [result] = await db.query(
      rules.isAdmin(me) ? 'DELETE FROM syllabi WHERE syllabus_id = ?' : "DELETE FROM syllabi WHERE syllabus_id = ? AND user_id = ? AND status = 'draft'",
      rules.isAdmin(me) ? [id] : [id, me.id]
    );
    if (!result.affectedRows) throw httpError(409, 'This syllabus changed or was removed. Refresh your list before deleting.');
    res.json({ message: 'Syllabus deleted' });
  } catch (err) {
    sendError(res, err);
  }
});

// Version history: the owner and admins only. Newest first; `changed` lists the tracked fields that
// differ from the previous version.
router.get('/:id/versions', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw httpError(404, 'Syllabus not found');
    const [syl] = await db.query('SELECT syllabus_id, user_id, status FROM syllabi WHERE syllabus_id = ?', [id]);
    if (!syl[0] || !rules.canView(req.session.user, syl[0])) throw httpError(404, 'Syllabus not found');

    const [rows] = await db.query(
      `SELECT v.*, u.first_name, u.last_name
       FROM syllabus_versions v JOIN users u ON u.user_id = v.created_by
       WHERE v.syllabus_id = ?
       ORDER BY v.created_at ASC, v.version_id ASC`,
      [id]
    );
    // What the administrator decided about a version (returned for revision, approved, rejected), with the reason: the decision belongs to
    // the version that was newest when it was made.
    const [logs] = await db.query(
      "SELECT l.action, l.notes, l.action_date, u.first_name, u.last_name FROM submission_logs l JOIN users u ON u.user_id = l.user_id WHERE l.syllabus_id = ? AND l.action IN ('revision', 'approve', 'reject') ORDER BY l.action_date ASC, l.log_id ASC",
      [id]
    );
    const decisionOf = (i) => {
      const from = new Date(rows[i].created_at).getTime();
      const to = i + 1 < rows.length ? new Date(rows[i + 1].created_at).getTime() : Infinity;
      const mine = logs.filter((l) => { const t = new Date(l.action_date).getTime(); return t >= from && t < to; });
      const l = mine[mine.length - 1];
      if (!l) return null;
      const m = /^Status changed to [a-z_]+(?:: ([\s\S]*))?$/.exec(l.notes || '');
      return { action: l.action, at: l.action_date, by: `${l.first_name} ${l.last_name}`, reason: m && m[1] ? m[1] : '' };
    };
    const parse = (text) => { try { return text ? JSON.parse(text) : null; } catch { return null; } };
    const tracked = [['title', 'title'], ['course_code', 'courseCode'], ['curriculum_id', 'curriculumId'], ['file_path', 'file'], ['content', 'content']];
    const versions = rows.map((r, i) => ({
      id: r.version_id,
      version: r.version_label,
      title: r.title,
      courseCode: r.course_code,
      curriculumId: r.curriculum_id,
      filePath: r.file_path,
      statusAtSave: r.status_at_save,
      note: r.note,
      createdAt: r.created_at,
      author: `${r.first_name} ${r.last_name}`,
      changed: i === 0 ? [] : tracked.filter(([col]) => (r[col] ?? null) !== (rows[i - 1][col] ?? null)).map(([, name]) => name),
      // For a form: which sections the faculty member changed since the version before, and how much ("Course description (1 word)").
      changes: i > 0 && r.content && rows[i - 1].content ? (() => { const list = changedSections(parse(rows[i - 1].content), parse(r.content)); return { sections: list, text: describeChanges(list) }; })() : null,
      decision: decisionOf(i),
    }));
    res.json(versions.reverse());
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
