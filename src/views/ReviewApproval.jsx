import { useMemo, useState, useEffect } from 'react';
import { Avatar, PageHead } from '../components/ui';

export default function ReviewApproval({ syllabi, handleStatus, user, messages, setChatCode, markRead, setHistCode }) {
  const pending = useMemo(() => syllabi.filter(s => s.status === 'submitted' || s.status === 'under_review'), [syllabi]);
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState('');
  useEffect(() => { if (pending.length > 0 && !selected) setSelected(pending[0]); }, [pending, selected]);
  const sel = selected || pending[0];
  const addComment = () => { if (!comment.trim() || !sel) return; setComment(''); };
  const order = ['submitted', 'under_review', 'for_revision', 'approved'];
  const labelMap = { submitted: 'Submitted', under_review: 'Under Review', for_revision: 'For Revision', approved: 'Approved' };
  return (
    <>
      <PageHead title="Review & Approval" subtitle="Review submissions, manage revision comments, and complete the approval workflow." actions={<span className="badge gold">{pending.length} Pending</span>} />
      <div className="review-layout">
        <section className="comments-card">
          <div className="queue-list">{pending.map(s => { const unread = messages.filter(m => m.syllabusId === s.id && m.receiverId === user.id && !m.isRead).length; return <button key={s.id} className={`queue-item${sel?.id === s.id ? ' active' : ''}`} onClick={() => setSelected(s)}><Avatar src={s.ownerAvatarUrl} name={s.faculty} /><div className="queue-info"><div className="queue-head"><strong>{s.courseCode}</strong>{unread > 0 && <span className="queue-dot" />}</div><p>{s.title}</p><small>{s.faculty} • {s.updatedAt}</small></div></button>; })}{pending.length === 0 && <div className="empty">All caught up! No pending syllabi.</div>}</div>
          {sel && <>
            <div className="review-summary"><span><small>Course</small><b>{sel.courseCode} • {sel.title}</b></span><span><small>Version</small><b>{sel.version}</b></span><span><small>Submitted by</small><b>{sel.faculty}</b></span><span><small>Updated</small><b>{sel.updatedAt}</b></span><span><small>Status</small><b className={`status ${sel.status}`}>{labelMap[sel.status] || sel.status}</b></span></div>
            <div className="tabs"><button className="active">Reviewer Comments</button><button onClick={() => setHistCode(sel.id)}>Revision History</button></div>
            <div className="comment-box"><textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a reviewer comment..." /><button className="btn primary" onClick={addComment}>Add Comment</button></div>
          </>}
        </section>
        <aside className="workflow-card">
          <h3>Workflow Status</h3>
          {sel ? order.map((x, i) => { const curr = order.indexOf(sel.status); return <div className={`flow ${i <= curr ? 'done' : ''} ${sel.status === x ? 'current' : ''}`} key={x}><i>{i < curr ? '✓' : i + 1}</i><span><strong>{labelMap[x]}</strong><small>{sel.status === x ? 'Current stage' : 'Pending'}</small></span></div>; }) : <p className="muted">Select a submission to view workflow.</p>}
          {sel && <div className="workflow-actions">
            <button className="btn outline wide" onClick={() => { setChatCode(sel.id); markRead(sel.id); }}>✉ Message Faculty</button>
            <button className="btn danger wide" onClick={() => handleStatus(sel.id, 'For Revision', comment || 'Please revise and resubmit.')}>Return for Revision</button>
            <button className="btn outline wide" style={{ color: '#b83838', borderColor: '#f2bebe' }} onClick={() => handleStatus(sel.id, 'Rejected', comment || 'Syllabus rejected.')}>Reject</button>
            <button className="btn success wide" onClick={() => handleStatus(sel.id, 'Approved', comment || 'Syllabus approved.')}>Approve Syllabus</button>
          </div>}
        </aside>
      </div>
    </>
  );
}
