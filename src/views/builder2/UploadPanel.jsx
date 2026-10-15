import StableButton from '../../components/StableButton';
import { t as translateUI } from "../../i18n/index.js";
import { MIN_NOTE } from '../../lib/syllabusRules';
import { useEffect, useMemo, useRef, useState } from 'react';

const MAX_BYTES = 10 * 1024 * 1024;

// The "Upload a file" tab of the builder: submit a finished PDF as the syllabus instead of the form. The PDF is shown
// before anything is sent, and nothing is submitted until the faculty member presses the button. The form draft is kept,
// but only what is submitted counts: this PDF becomes what reviewers see.
export default function UploadPanel({ hasCourse, existing, revising, busy, disabled, onChooseCourse, onSubmit, notify }) {
  const [file, setFile] = useState(null);
  const [note, setNote] = useState('');
  const [dragging, setDragging] = useState(false);
  const input = useRef(null);
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const pick = (f) => {
    if (!f) return;
    if (!(f.type === 'application/pdf' || /\.pdf$/i.test(f.name))) { notify(translateUI("ui.only_pdf_files_are_accepted_b07af1")); return; }
    if (f.size > MAX_BYTES) { notify(translateUI("ui.that_file_is_larger_than_10mb_1b3a23")); return; }
    setFile(f);
  };
  const size = file ? (file.size / 1024 / 1024).toFixed(1) + ' MB' : '';

  return (
    <section className="editor-card up-panel" aria-labelledby="up-title">
      <div className="editor-title">
        <div>
          <span className="eyebrow">{translateUI("ui.upload_a_file_db7dd1")}</span>
          <h2 id="up-title">{translateUI("ui.submit_your_syllabus_as_a_pdf_b41730")}</h2>
          <p>{translateUI("ui.use_this_when_your_syllabus_is_already_finished_the_pdf_is_what_r_cf6dfc")}</p>
        </div>
      </div>

      {!hasCourse && (
        <div className="info-banner warning">{translateUI("ui.choose_the_subject_first_so_the_syllabus_is_filed_under_the_right_54e15b")}{' '}
          <button type="button" className="link-btn" onClick={onChooseCourse}>{translateUI("ui.choose_it_in_the_form_c92099")}</button>
        </div>
      )}

      <fieldset disabled={disabled || busy} className="up-fields">
        <div
          className={'dropzone' + (dragging ? ' dragging' : '') + (file ? ' has-file' : '')}
          role="button"
          tabIndex={0}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files[0]); }}
          onClick={() => input.current.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current.click(); } }}
        >
          <input ref={input} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={(e) => { pick(e.target.files[0]); e.target.value = ''; }} />
          {file
            ? <><span className="drop-icon">📄</span><span className="drop-text">{file.name}</span><small>{size}{translateUI("ui.click_or_drop_to_replace_95d96b")}</small></>
            : <><span className="drop-icon">📤</span><span className="drop-text">{translateUI("ui.drag_and_drop_your_syllabus_here_or_click_to_choose_5b8cda")}</span><small>{translateUI("ui.pdf_only_max_10mb_daa870")}</small></>}
        </div>

        {url && (
          <div className="up-preview">
            <div className="up-preview-bar">
              <b>{translateUI("ui.preview_f1fbb2")}</b>
              <a href={url} target="_blank" rel="noreferrer">{translateUI("ui.open_in_a_new_tab_b22f39")}</a>
            </div>
            <iframe title={translateUI("ui.preview_of_the_selected_pdf_1b26e7")} src={url} />
          </div>
        )}

        <label className="up-note">{revising ? translateUI("ui.what_did_you_change_required_c57040") : translateUI("ui.note_for_the_reviewer_optional_201228")}
          <textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder={translateUI("ui.anything_the_reviewer_should_know_344e5b")} />
        </label>

        <div className="info-banner">{translateUI("ui.this_file_will_be_submitted_as_your_syllabus_anything_you_filled__2684db")}</div>
        <div className="up-actions">
          <StableButton type="button" className="btn primary" disabled={!file || !hasCourse || busy || disabled || (revising && note.trim().length < MIN_NOTE)} onClick={() => onSubmit(file, note.trim())}>
            {busy ? translateUI("ui.uploading_d921a7") : existing ? translateUI("ui.upload_as_new_version_77fd0e") : translateUI("ui.submit_for_review_f7710d")}
          </StableButton>
        </div>
      </fieldset>
    </section>
  );
}
