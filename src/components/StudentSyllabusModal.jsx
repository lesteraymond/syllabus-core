import StableButton from './StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useRef, useState } from 'react';
import { API_ORIGIN, students } from '../lib/api';
import { fileName, noFormMessage } from '../lib/reviewView';
import ReviewDocument from '../views/ReviewDocument';
import StudentSyllabusReader from './StudentSyllabusReader';
import { useModalLayer } from './useModalLayer';

const PHONE = '(max-width: 720px)';
const PAPER_WIDTH = 650; // the form's own minimum width (see .paper in styles.css), a little over so nothing is clipped

// A student's window onto one approved syllabus: the whole syllabus, read-only. It is the reviewer's window without the version picker,
// the status and the decision panel, because a student only ever sees the approved version. Esc and a click outside close it.
// On a phone the form is too wide to read, so the syllabus opens as plain sections instead, with "View as form" for the real form.
export default function StudentSyllabusModal({ syllabusId, onClose }) {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [asForm, setAsForm] = useState(false);
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE).matches);
  const dialog = useRef(null);
  const fit = useRef(null);
  const [scale, setScale] = useState(1);

  // The form on a phone is shrunk to the width of the screen (the whole page at once; pinch to zoom in), not scrolled sideways.
  useEffect(() => {
    const el = fit.current;
    if (!el) return undefined;
    const measure = () => setScale(Math.min(1, el.clientWidth / PAPER_WIDTH));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [phone, asForm, payload]);

  useEffect(() => {
    const query = window.matchMedia(PHONE);
    const on = () => setPhone(query.matches);
    query.addEventListener('change', on);
    return () => query.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    let live = true;
    setPayload(null);
    setError('');
    students.syllabus(syllabusId)
      .then((p) => { if (live) setPayload(p); })
      .catch((e) => { if (live) setError(e.message || translateUI("ui.could_not_open_this_syllabus_d06b9d")); });
    return () => { live = false; };
  }, [syllabusId]);

  useModalLayer(dialog, onClose);

  const s = payload ? payload.syllabus : null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal svm-modal sh-modal" role="dialog" aria-modal="true" aria-labelledby="svm-title" tabIndex={-1} ref={dialog} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head svm-head">
          <div className="svm-who">
            <h3 id="svm-title">{s ? [s.courseCode, s.courseTitle || s.title].filter(Boolean).join(' · ') : translateUI("ui.syllabus_1b731d")}</h3>
            {s
              ? <small>{[s.facultyName, translateUI("student.versionOf_c18a3b", { version: s.version })].filter(Boolean).join(' · ')}</small>
              : <small>{translateUI("ui.opening_b1b853")}</small>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={translateUI("ui.close_bbfa77")}>✕</button>
        </div>

        <div className="modal-body svm-body">
          {error && <div className="info-banner warning" role="alert">{tr(error)}</div>}
          {!error && !payload && <div className="empty">{translateUI("ui.opening_the_syllabus_51c75a")}</div>}
          {payload && (payload.content
            ? (!phone
              ? <ReviewDocument content={payload.content} facultyName={s.facultyName} />
              : asForm
                ? <div ref={fit} className="sh-fit"><div style={{ zoom: scale }}><ReviewDocument content={payload.content} facultyName={s.facultyName} /></div></div>
                : <StudentSyllabusReader content={payload.content} />)
            : (
              <div className="svm-nofile">
                <p>{tr(noFormMessage(payload.file))}</p>
                {payload.file && <p><a className="btn outline" href={`${API_ORIGIN}${payload.file.path}`} target="_blank" rel="noreferrer">{translateUI("ui.open_79d37e") + fileName(payload.file.path)}</a></p>}
                {payload.file && /\.pdf$/i.test(payload.file.path) && <iframe className="svm-pdf" title={translateUI("ui.uploaded_syllabus_73f85b")} src={`${API_ORIGIN}${payload.file.path}`} />}
              </div>
            ))}
        </div>
        <div className="modal-foot">
          {phone && payload && payload.content && <StableButton type="button" className="btn ghost" onClick={() => setAsForm((v) => !v)}>{asForm ? translateUI("student.readingView_7a2c5e") : translateUI("student.viewAsForm_e60b93")}</StableButton>}
          <StableButton type="button" className="btn outline" onClick={onClose}>{translateUI("ui.close_bbfa77")}</StableButton>
        </div>
      </div>
    </div>
  );
}
