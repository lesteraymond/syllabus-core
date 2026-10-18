import StableButton from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useMemo, useState } from 'react';
import { fmt } from '../lib/utils';
import { canChat } from '../lib/chatPartner';
import { PageHead, Icon } from '../components/ui';
import { users as usersApi, syllabi as syllabiApi } from '../lib/api';
import { commentBadge } from '../lib/notificationRoute';
import { ASSIGNMENT_MESSAGES, assignmentState, canDeleteSyllabus, canEditSyllabus, courseLockReason, editBlockedReason, toBuilderShape } from '../lib/syllabusRules';

import { deadlines as deadlinesApi } from '../lib/api';
import { deadlineForCard } from '../lib/deadlineView';
import { phDateTime } from '../lib/phTime';
const STATUS_LABELS = { draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review', for_revision: 'For Revision', approved: 'Approved', rejected: 'Rejected' };

export default function MySyllabi({ syllabi, user, messages, commentCounts = {}, setEditing, setPage, setHistCode, setChatCode, setCommentCode, handleDelete, setConfirm, notify }) {
  // Programs and subjects an admin assigned to me: a syllabus whose subject is not in the list is read-only.
  const isFaculty = user.role === 'faculty';
  const [resuming, setResuming] = useState(null);
  const [mine, setMine] = useState(null);
  // Syllabi archived when their subject went to another faculty member: shown only on request, read-only.
  const [archivedRows, setArchivedRows] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  useEffect(() => {
    let live = true;
    syllabiApi.archived().then((rows) => { if (live) setArchivedRows(rows.filter((r) => r.userId === user.id)); }).catch(() => {});
    return () => { live = false; };
  }, [user.id, syllabi]);
  useEffect(() => {
    let live = true;
    usersApi.myAssignments().then((a) => { if (live) setMine(a); }).catch(() => {});
    return () => { live = false; };
  }, []);
  // The deadlines of this faculty member's subjects (nothing for an administrator, and nothing before deadlines are set up).
  const [deadlines, setDeadlines] = useState([]);
  useEffect(() => {
    if (user.role !== 'faculty') return undefined;
    let live = true;
    deadlinesApi.mine().then((r) => { if (live) setDeadlines(r.enabled === false ? [] : r.deadlines || []); }).catch(() => {});
    return () => { live = false; };
  }, [user.role, syllabi]);
  const state = assignmentState(mine); // 'none' | 'noSubject' | 'ok' | null
  const nothingAssigned = user.role === 'faculty' && (state === 'none' || state === 'noSubject');
  const my = useMemo(() => [...syllabi.filter(s => s.userId === user.id), ...(showArchived ? archivedRows : [])].map(s => ({ ...s, unreadCount: messages.filter(m => m.syllabusId === s.id && m.receiverId === user.id && !m.isRead).length })), [syllabi, user, messages, showArchived, archivedRows]);
  return (
    <>
      <PageHead title={translateUI("ui.my_syllabi_3da1e8")} subtitle={translateUI("publication.mySubtitle")} actions={<><StableButton className="btn primary" disabled={nothingAssigned} title={nothingAssigned ? tr(ASSIGNMENT_MESSAGES[state]) : ''} onClick={() => { setEditing(null); setPage('builder'); }}>{translateUI("ui.new_syllabus_c4c7a9")}</StableButton></>} />
      {nothingAssigned && <div className="info-banner warning">{tr(ASSIGNMENT_MESSAGES[state])}{translateUI("ui.you_can_create_a_syllabus_once_a_subject_is_assigned_to_you_b8383e")}</div>}
      {archivedRows.length > 0 && <label className="syl-archive-toggle"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />{translateUI("syllabi.showArchived", { count: archivedRows.length })}</label>}
      <div className="syl-grid">
        {my.map(s => { const lock = courseLockReason(user, mine, s); const isDraft = s.status === 'draft'; const resumable = user.role === 'admin' && s.userId === user.id && s.status === 'under_review'; return <div className={'syl-card' + (s.archived ? ' syl-archived' : '')} key={s.id}>
          <div className="syl-head"><div className="syl-info"><h4>{s.courseCode}</h4><p>{s.title}</p></div><span className="syl-tags"><span className={`status ${s.status}`}>{tr(STATUS_LABELS[s.status] || s.status)}</span>{s.archived && <span className="status archived">{translateUI("syllabi.archivedTag")}</span>}</span></div>
          {(() => { const d = deadlineForCard(deadlines, s); return d && <div className="syl-deadline"><span className={'status dl-' + d.status}>{translateUI('deadline.status.' + d.status)}</span><span>{translateUI('deadline.dueOn', { date: phDateTime(d.dueAt) })}</span></div>; })()}
          <div className="syl-meta"><span>{s.programCode || s.program}</span><span>{translateUI("ui.updated_c95815")}{fmt(s.updatedAt)}</span>{isFaculty && s.unreadCount > 0 && <span className="syl-unread">{s.unreadCount}{translateUI("ui.unread_2630a7")}</span>}</div>
          {isFaculty && !isDraft && s.adminComment && (setCommentCode
            ? <button type="button" className="feedback-banner feedback-open" title={translateUI("ui.open_the_reviewer_comments_1c484a")} onClick={() => setCommentCode(s.id)}>💬 {s.adminComment}</button>
            : <div className="feedback-banner">💬 {s.adminComment}</div>)}
          {s.archived ? <><p className="syl-locked" role="note">{tr(editBlockedReason(s))}</p><div className="syl-actions"><StableButton className="btn outline syl-quiet" onClick={() => setHistCode(s.id)}>{translateUI("ui.history_fefbcc")}</StableButton></div></> : <div className="syl-actions">
            <StableButton className="btn outline syl-quiet" disabled={resuming === s.id || (!canEditSyllabus(user, s) && !resumable) || !!lock} title={tr(lock || (canEditSyllabus(user, s) || resumable ? 'Edit this syllabus (saved as a new version)' : editBlockedReason(s)))} onClick={async () => { if (resuming !== null) return; setResuming(s.id); try { if (resumable) await syllabiApi.resumeDraft(s.id); setEditing(toBuilderShape(resumable ? { ...s, status: 'draft' } : s)); setPage('builder'); } catch(error) { notify?.(tr(error.message)); } finally { setResuming(null); } }}>{translateUI("ui.edit_79cae4")}</StableButton>
            {resumable && <StableButton className="btn outline syl-quiet" onClick={() => setPage('ai')}>{translateUI('publication.checkDraft')}</StableButton>}
            {isFaculty && !isDraft && setCommentCode && (() => { const b = commentBadge(commentCounts[s.id]); return (
              <StableButton className="btn outline syl-comments" title={translateUI("ui.notes_from_your_reviewer_about_this_syllabus_6ace96")} onClick={() => setCommentCode(s.id)}>{translateUI("ui.comments_e445b9")}{b.text && <span className={'syl-badge' + (b.fresh ? ' fresh' : '')} aria-label={b.fresh ? b.text + translateUI("ui.new_7cebfd") : b.text + translateUI("ui.in_total_ed532f")}>{b.text}</span>}</StableButton>
            ); })()}
            {isFaculty && canChat(s, user) && <StableButton className="btn outline" title={translateUI("ui.a_conversation_with_your_reviewer_0032bd")} onClick={() => { setChatCode(s.id); }}>{translateUI("ui.message_890761")}</StableButton>}
            {(!isDraft || user.role === 'admin') && <StableButton className="btn outline syl-quiet" onClick={() => setHistCode(s.id)}>{translateUI("ui.history_fefbcc")}</StableButton>}
            {canDeleteSyllabus(user, s) && <StableButton className="btn danger syl-delete" aria-label={translateUI("ui.delete_p0_b3e049", { p0: (s.courseCode || 'draft syllabus') })} onClick={() => setConfirm({ title: translateUI("ui.delete_syllabus_db7e53"), message: translateUI("ui.are_you_sure_you_want_to_delete_p0_this_cannot_be_undone_efea10", { p0: (s.courseCode) }), label: 'Delete', onConfirm: () => handleDelete(s.id) })}><Icon name="bin" size={18} /></StableButton>}
          </div>}
          {!resumable && !s.archived && (s.status === 'submitted' || s.status === 'under_review') && <p className="syl-locked" role="note">{tr(editBlockedReason(s))}</p>}
        </div>; })}
        {my.length === 0 && <div className="empty">{translateUI("ui.no_syllabi_yet_click_new_syllabus_to_get_started_2e4bc9")}</div>}
      </div>
    </>
  );
}
