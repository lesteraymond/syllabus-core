import { useRef } from 'react';
import { syllabi as syllabiApi } from '../lib/api';
import CommentsThread from '../views/CommentsThread';
import { useModalLayer } from './useModalLayer';

// What a faculty member reads when a reviewer has commented on their syllabus: the thread, oldest first, with the new ones marked. It is
// read-only (a reviewer writes comments); to answer, "Reply by message" opens the chat, which is the two-way conversation. Opening the
// thread marks it read, so the badge on the card clears. `onRead(id)` lets the app clear it without waiting for the next refresh.
export default function SyllabusCommentsModal({ syllabus, viewerId, onClose, onRead, onReply }) {
  const dialog = useRef(null);
  useModalLayer(dialog, onClose, !!syllabus);
  if (!syllabus) return null;

  const markRead = async () => {
    try { await syllabiApi.markCommentsRead(syllabus.id); } catch { /* the thread is still readable; the badge just clears later */ }
    if (onRead) onRead(syllabus.id);
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal fc-modal" role="dialog" aria-modal="true" aria-labelledby="fc-title" tabIndex={-1} ref={dialog} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="fc-title"><h3 id="fc-title">Reviewer comments</h3><small>{syllabus.courseCode} • {syllabus.title}</small></div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body fc-body">
          <p className="fc-hint">Notes from your reviewer about this syllabus, including the reason for a decision. To talk it over, send a message.</p>
          <CommentsThread syllabusId={syllabus.id} canWrite={false} viewerId={viewerId} onLoaded={markRead} />
        </div>
        <div className="modal-foot">
          {onReply && <button type="button" className="btn outline" onClick={() => onReply(syllabus.id)}>✉ Reply by message</button>}
          <button type="button" className="btn primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
