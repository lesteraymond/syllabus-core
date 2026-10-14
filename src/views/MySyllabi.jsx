import { useEffect, useMemo, useState } from 'react';
import { fmt } from '../lib/utils';
import { PageHead } from '../components/ui';
import { users as usersApi } from '../lib/api';
import { commentBadge } from '../lib/notificationRoute';
import { ASSIGNMENT_MESSAGES, assignmentState, canEditSyllabus, courseLockReason, editBlockedReason, toBuilderShape } from '../lib/syllabusRules';

const STATUS_LABELS = { draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review', for_revision: 'For Revision', approved: 'Approved', rejected: 'Rejected' };

export default function MySyllabi({ syllabi, user, messages, commentCounts = {}, setEditing, setPage, setHistCode, setChatCode, setCommentCode, handleDelete, setConfirm, notify }) {
  // Programs and subjects an admin assigned to me: a syllabus whose subject is not in the list is read-only.
  const [mine, setMine] = useState(null);
  useEffect(() => {
    let live = true;
    usersApi.myAssignments().then((a) => { if (live) setMine(a); }).catch(() => {});
    return () => { live = false; };
  }, []);
  const state = assignmentState(mine); // 'none' | 'noSubject' | 'ok' | null
  const nothingAssigned = state === 'none' || state === 'noSubject';
  const my = useMemo(() => syllabi.filter(s => s.userId === user.id).map(s => ({ ...s, unreadCount: messages.filter(m => m.syllabusId === s.id && m.receiverId === user.id && !m.isRead).length })), [syllabi, user, messages]);
  return (
    <>
      <PageHead title="My Syllabi" subtitle="View and manage your submitted syllabi." actions={<button className="btn primary" disabled={nothingAssigned} title={nothingAssigned ? ASSIGNMENT_MESSAGES[state] : ''} onClick={() => { setEditing(null); setPage('builder'); }}>+ New Syllabus</button>} />
      {nothingAssigned && <div className="info-banner warning">{ASSIGNMENT_MESSAGES[state]} You can create a syllabus once a subject is assigned to you.</div>}
      <div className="syl-grid">
        {my.map(s => { const lock = courseLockReason(user, mine, s); return <div className="syl-card" key={s.id}>
          <div className="syl-head"><div className="syl-info"><h4>{s.courseCode}</h4><p>{s.title}</p></div><span className={`status ${s.status}`}>{STATUS_LABELS[s.status] || s.status}</span></div>
          <div className="syl-meta"><span>{s.program}</span><span>Updated {fmt(s.updatedAt)}</span>{s.unreadCount > 0 && <span className="syl-unread">{s.unreadCount} unread</span>}</div>
          {s.adminComment && (setCommentCode
            ? <button type="button" className="feedback-banner feedback-open" title="Open the reviewer comments" onClick={() => setCommentCode(s.id)}>💬 {s.adminComment}</button>
            : <div className="feedback-banner">💬 {s.adminComment}</div>)}
          <div className="syl-actions">
            <button className="btn outline" disabled={!canEditSyllabus(user, s) || !!lock} title={lock || (canEditSyllabus(user, s) ? 'Edit this syllabus (saved as a new version)' : editBlockedReason(s))} onClick={() => { setEditing(toBuilderShape(s)); setPage('builder'); }}>✎ Edit</button>
            {setCommentCode && (() => { const b = commentBadge(commentCounts[s.id]); return (
              <button className="btn outline syl-comments" title="Notes from your reviewer about this syllabus" onClick={() => setCommentCode(s.id)}>▤ Comments{b.text && <span className={'syl-badge' + (b.fresh ? ' fresh' : '')} aria-label={b.fresh ? b.text + ' new' : b.text + ' in total'}>{b.text}</span>}</button>
            ); })()}
            <button className="btn outline" title="A conversation with your reviewer" onClick={() => { setChatCode(s.id); }}>✉ Message</button>
            <button className="btn outline" onClick={() => setHistCode(s.id)}>◷ History</button>
            <button className="btn danger" onClick={() => setConfirm({ title: 'Delete Syllabus?', message: `Are you sure you want to delete ${s.courseCode}? This cannot be undone.`, label: 'Delete', onConfirm: () => handleDelete(s.id) })}>🗑</button>
          </div>
          {(s.status === 'submitted' || s.status === 'under_review') && <p className="syl-locked" role="note">{editBlockedReason(s)}</p>}
        </div>; })}
        {my.length === 0 && <div className="empty">No syllabi yet. Click "+ New Syllabus" to get started.</div>}
      </div>
    </>
  );
}
