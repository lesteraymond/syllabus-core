import { useEffect, useRef, useState } from 'react';
import { API_ORIGIN, syllabi as syllabiApi } from '../lib/api';
import { STATUS_LABELS } from '../lib/syllabusRules';
import { fileName, noFormMessage, programLabel, subjectLabel, toneStyle, versionOption } from '../lib/reviewView';
import { Avatar } from './ui';
import ReviewDocument from '../views/ReviewDocument';
import { useModalLayer } from './useModalLayer';

// The reviewer's view of a submitted syllabus: who wrote it, for which program and subject, and the whole syllabus in a window. It has
// no compliance check: an administrator checks a submission in the AI Checker, and Review & Approval is only the syllabus and the decision.
// `aside` is an optional panel shown beside the syllabus (Review & Approval puts the decision,
// comments and messages there); the window itself only reads.
// The version picker opens an earlier submitted version. Esc and a click outside close it, and focus returns to what opened it.
export default function SyllabusViewModal({ syllabusId, onClose, aside, avatarUrl, initialVersionId = null }) {
  const [payload, setPayload] = useState(null);
  const [versionId, setVersionId] = useState(initialVersionId); // a version chosen elsewhere (the history), else the newest
  const [error, setError] = useState('');
  const dialog = useRef(null);

  useEffect(() => {
    let live = true;
    setPayload(null);
    setError('');
    syllabiApi.review(syllabusId, versionId)
      .then((p) => { if (live) setPayload(p); })
      .catch((e) => { if (live) setError(e.message || 'Could not open this syllabus.'); });
    return () => { live = false; };
  }, [syllabusId, versionId]);

  // Esc, Tab, focus, scroll and stacking above or below other modals are handled by the shared layer (see useModalLayer).
  useModalLayer(dialog, onClose);

  const s = payload ? payload.syllabus : null;
  const latestId = payload && payload.versions.length ? payload.versions[0].id : null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal svm-modal" role="dialog" aria-modal="true" aria-labelledby="svm-title" tabIndex={-1} ref={dialog} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head svm-head" style={s ? toneStyle(s) : undefined}>
          <Avatar className="avatar svm-av" src={avatarUrl} name={s ? s.facultyName : ''} />
          <div className="svm-who">
            <h3 id="svm-title">{s ? s.facultyName || 'Syllabus' : 'Syllabus'}</h3>
            {s ? <div className="svm-meta"><span className="rb-pill">{programLabel(s)}</span><span className="svm-subject">{subjectLabel(s)}</span></div> : <small>Opening…</small>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {s && (
          <div className="svm-bar">
            <span className={'status ' + String(s.status).replaceAll('_', '-')}>{STATUS_LABELS[s.status] || s.status}</span>
            {payload.versions.length > 1
              ? (
                <label className="svm-version"><small>Version</small>
                  <select value={payload.version ? payload.version.id : ''} onChange={(e) => setVersionId(Number(e.target.value))}>
                    {payload.versions.map((v) => <option key={v.id} value={v.id}>{versionOption(v, v.id === latestId)}</option>)}
                  </select>
                </label>
              )
              : <span className="cmp-small">{payload.version ? 'Version ' + payload.version.label : 'Saved form, not submitted yet'}</span>}
            {payload.changes && <span className="cmp-small svm-changes">{payload.changes.text ? 'Changed since ' + payload.changes.from + ': ' + payload.changes.text : 'Nothing the faculty member wrote differs from ' + payload.changes.from + '.'}</span>}
          </div>
        )}

        <div className={'svm-split' + (aside ? ' has-aside' : '')}>
        <div className="modal-body svm-body">
          {error && <div className="info-banner warning" role="alert">{error}</div>}
          {!error && !payload && <div className="empty">Opening the syllabus…</div>}
          {payload && (payload.content
            ? <ReviewDocument content={payload.content} facultyName={s.facultyName} />
            : (
              <div className="svm-nofile">
                <p>{noFormMessage(payload.file)}</p>
                {payload.file && <p><a className="btn outline" href={`${API_ORIGIN}${payload.file.path}`} target="_blank" rel="noreferrer">{'Open ' + fileName(payload.file.path)}</a></p>}
                {payload.file && /\.pdf$/i.test(payload.file.path) && <iframe className="svm-pdf" title="Uploaded syllabus" src={`${API_ORIGIN}${payload.file.path}`} />}
              </div>
            ))}
        </div>
        {aside && <aside className="svm-aside" aria-label="Review">{aside}</aside>}
        </div>
        <div className="modal-foot"><button type="button" className="btn outline" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
