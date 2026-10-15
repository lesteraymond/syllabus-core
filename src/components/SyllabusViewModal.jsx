import StableButton from './StableButton';
import { localizeChanges } from '../i18n/changes';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
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
      .catch((e) => { if (live) setError(e.message || translateUI("ui.could_not_open_this_syllabus_d06b9d")); });
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
            <h3 id="svm-title">{s ? s.facultyName || translateUI("ui.syllabus_1b731d") : translateUI("ui.syllabus_1b731d")}</h3>
            {s ? <div className="svm-meta"><span className="rb-pill">{programLabel(s)}</span><span className="svm-subject">{subjectLabel(s)}</span></div> : <small>{translateUI("ui.opening_b1b853")}</small>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={translateUI("ui.close_bbfa77")}>✕</button>
        </div>

        {s && (
          <div className="svm-bar">
            <span className={'status ' + String(s.status).replaceAll('_', '-')}>{tr(STATUS_LABELS[s.status] || s.status)}</span>
            {payload.versions.length > 1
              ? (
                <label className="svm-version"><small>{translateUI("ui.version_2da600")}</small>
                  <select value={payload.version ? payload.version.id : ''} onChange={(e) => setVersionId(Number(e.target.value))}>
                    {payload.versions.map((v) => <option key={v.id} value={v.id}>{versionOption(v, v.id === latestId)}</option>)}
                  </select>
                </label>
              )
              : <span className="cmp-small">{payload.version ? translateUI("ui.version_03283e") + payload.version.label : translateUI("ui.saved_form_not_submitted_yet_c3a777")}</span>}
            {payload.changes && <span className="cmp-small svm-changes">{payload.changes.text ? translateUI("ui.changed_since_737991") + payload.changes.from + ': ' + localizeChanges(payload.changes) : translateUI("ui.nothing_the_faculty_member_wrote_differs_from_a512f5") + payload.changes.from + '.'}</span>}
          </div>
        )}

        <div className={'svm-split' + (aside ? ' has-aside' : '')}>
        <div className="modal-body svm-body">
          {error && <div className="info-banner warning" role="alert">{tr(error)}</div>}
          {!error && !payload && <div className="empty">{translateUI("ui.opening_the_syllabus_51c75a")}</div>}
          {payload && (payload.content
            ? <ReviewDocument content={payload.content} facultyName={s.facultyName} />
            : (
              <div className="svm-nofile">
                <p>{tr(noFormMessage(payload.file))}</p>
                {payload.file && <p><a className="btn outline" href={`${API_ORIGIN}${payload.file.path}`} target="_blank" rel="noreferrer">{translateUI("ui.open_79d37e") + fileName(payload.file.path)}</a></p>}
                {payload.file && /\.pdf$/i.test(payload.file.path) && <iframe className="svm-pdf" title={translateUI("ui.uploaded_syllabus_73f85b")} src={`${API_ORIGIN}${payload.file.path}`} />}
              </div>
            ))}
        </div>
        {aside && <aside className="svm-aside" aria-label={translateUI("ui.review_e29a79")}>{aside}</aside>}
        </div>
        <div className="modal-foot"><StableButton type="button" className="btn outline" onClick={onClose}>{translateUI("ui.close_bbfa77")}</StableButton></div>
      </div>
    </div>
  );
}
