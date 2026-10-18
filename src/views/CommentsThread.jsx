import StableButton from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useRef, useState } from 'react';
import { syllabi as syllabiApi } from '../lib/api';
import { commentTypeLabel } from '../lib/reviewView';
import { when } from '../lib/complianceView';

// The reviewer's comments on one syllabus, oldest first. An administrator can add a comment (the faculty member is notified); the
// reason given with a decision appears here too, marked as a revision request, a rejection or an approval.
export default function CommentsThread({ syllabusId, canWrite, viewerId, onLoaded }) {
  const [comments, setComments] = useState(null);
  const [lastRead, setLastRead] = useState(null); // the newest comment this person had read when they opened it; null when not tracked
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);

  useEffect(() => {
    let live = true;
    setComments(null);
    setError('');
    syllabiApi.comments(syllabusId)
      .then((r) => { if (live) { setComments(r.comments); setLastRead(r.lastReadId === undefined ? null : r.lastReadId); if (onLoaded) onLoaded(r); } })
      .catch((e) => { if (live) { setError(e.message); setComments([]); } });
    return () => { live = false; };
  }, [syllabusId]);
  useEffect(() => { if (comments && comments.length) end.current?.scrollIntoView({ block: 'nearest' }); }, [comments]);

  const add = async (e) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await syllabiApi.addComment(syllabusId, text.trim());
      setComments((c) => [...(c || []), r.comment]);
      setText('');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="ct">
      <div className="ct-list" aria-live="polite">
        {comments === null && <p className="cmp-small">{translateUI("ui.loading_comments_a1458a")}</p>}
        {comments && comments.length === 0 && <p className="cmp-small">{translateUI("ui.no_comments_yet_207b24")}</p>}
        {(comments || []).map((c) => (
          <article className={'ct-item' + (c.type === 'comment' ? '' : ' ' + c.type)} key={c.id}>
            <header><strong>{c.author.name || translateUI("ui.reviewer_a74f16")}</strong>{c.type !== 'comment' && <span className="ct-type">{tr(commentTypeLabel(c.type))}</span>}{lastRead !== null && c.id > lastRead && c.author.id !== viewerId && <span className="ct-new">{translateUI("ui.new_6403f2")}</span>}<small>{when(c.createdAt)}</small></header>
            <p>{c.text}</p>
          </article>
        ))}
        <div ref={end} />
      </div>
      {error && <div className="info-banner warning" role="alert">{tr(error)}</div>}
      {canWrite && (
        <form className="ct-form" onSubmit={add}>
          <textarea value={text} maxLength={2000} rows={3} onChange={(e) => setText(e.target.value)} placeholder={translateUI("ui.add_a_comment_for_the_faculty_member_3f0231")} aria-label={translateUI("ui.new_comment_af65ae")} />
          <StableButton type="submit" className="btn primary" disabled={busy || !text.trim()}>{busy ? translateUI("ui.adding_ffb2e6") : translateUI("ui.add_comment_7d3764")}</StableButton>
        </form>
      )}
    </div>
  );
}
