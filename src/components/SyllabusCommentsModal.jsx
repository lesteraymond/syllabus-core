import StableButton from './StableButton';
import { t as translateUI } from "../i18n/index.js";
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
          <div className="fc-title"><h3 id="fc-title">{translateUI("ui.reviewer_comments_7d59b1")}</h3><small>{syllabus.courseCode} • {syllabus.title}</small></div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={translateUI("ui.close_bbfa77")}>✕</button>
        </div>
        <div className="modal-body fc-body">
          <p className="fc-hint">{translateUI("ui.notes_from_your_reviewer_about_this_syllabus_including_the_reason_d994eb")}</p>
          <CommentsThread syllabusId={syllabus.id} canWrite={false} viewerId={viewerId} onLoaded={markRead} />
        </div>
        <div className="modal-foot">
          {onReply && <StableButton type="button" className="btn outline" onClick={() => onReply(syllabus.id)}>{translateUI("ui.reply_by_message_0df524")}</StableButton>}
          <StableButton type="button" className="btn primary" onClick={onClose}>{translateUI("ui.close_bbfa77")}</StableButton>
        </div>
      </div>
    </div>
  );
}
