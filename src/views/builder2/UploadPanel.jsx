import { useEffect, useMemo, useRef, useState } from 'react';

const MAX_BYTES = 10 * 1024 * 1024;

// The "Upload a file" tab of the builder: submit a finished PDF as the syllabus instead of the form. The PDF is shown
// before anything is sent, and nothing is submitted until the faculty member presses the button. The form draft is kept,
// but only what is submitted counts: this PDF becomes what reviewers see.
export default function UploadPanel({ hasCourse, existing, busy, disabled, onChooseCourse, onSubmit, notify }) {
  const [file, setFile] = useState(null);
  const [note, setNote] = useState('');
  const [dragging, setDragging] = useState(false);
  const input = useRef(null);
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const pick = (f) => {
    if (!f) return;
    if (!(f.type === 'application/pdf' || /\.pdf$/i.test(f.name))) { notify('Only PDF files are accepted.'); return; }
    if (f.size > MAX_BYTES) { notify('That file is larger than 10MB.'); return; }
    setFile(f);
  };
  const size = file ? (file.size / 1024 / 1024).toFixed(1) + ' MB' : '';

  return (
    <section className="editor-card up-panel" aria-labelledby="up-title">
      <div className="editor-title">
        <div>
          <span className="eyebrow">UPLOAD A FILE</span>
          <h2 id="up-title">Submit your syllabus as a PDF</h2>
          <p>Use this when your syllabus is already finished. The PDF is what reviewers will read, so the form is not needed.</p>
        </div>
      </div>

      {!hasCourse && (
        <div className="info-banner warning">
          Choose the subject first, so the syllabus is filed under the right course.{' '}
          <button type="button" className="link-btn" onClick={onChooseCourse}>Choose it in the form</button>
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
            ? <><span className="drop-icon">📄</span><span className="drop-text">{file.name}</span><small>{size} • Click or drop to replace</small></>
            : <><span className="drop-icon">📤</span><span className="drop-text">Drag and drop your syllabus here, or click to choose</span><small>PDF only • Max 10MB</small></>}
        </div>

        {url && (
          <div className="up-preview">
            <div className="up-preview-bar">
              <b>Preview</b>
              <a href={url} target="_blank" rel="noreferrer">Open in a new tab</a>
            </div>
            <iframe title="Preview of the selected PDF" src={url} />
          </div>
        )}

        <label className="up-note">Note for the reviewer (optional)
          <textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the reviewer should know" />
        </label>

        <div className="info-banner">This file will be submitted as your syllabus. Anything you filled in on the form is kept as a draft, but it is not submitted.</div>
        <div className="up-actions">
          <button type="button" className="btn primary" disabled={!file || !hasCourse || busy || disabled} onClick={() => onSubmit(file, note.trim())}>
            {busy ? 'Uploading…' : existing ? 'Upload as new version' : 'Submit for review'}
          </button>
        </div>
      </fieldset>
    </section>
  );
}
