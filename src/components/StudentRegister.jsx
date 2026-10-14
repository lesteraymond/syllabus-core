import { useState } from 'react';
import { Icon } from './ui';
import { students } from '../lib/api';

const MAX_BYTES = 10 * 1024 * 1024;

// Read-only: what the server read from the COR. The student confirms it or retakes the photo; nothing here can be typed.
function ScanModal({ scan, busy, error, onConfirm, onRetake }) {
  const rows = [
    ['Student ID', scan.studentId],
    ['Name', scan.studentName],
    ['Program', scan.program],
    ['Year level', scan.yearLevel],
    ['Section', scan.section],
    ['School year', scan.schoolYear],
    ['Term', scan.term],
  ];
  const sure = scan.bsit === 'yes' && scan.studentName && scan.schoolYear;
  return (
    <div className="overlay" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="scan-title">
        <div className="modal-head">
          <div><h3 id="scan-title">Is this your COR?</h3><small>This is what we read from your photo. It can't be edited here.</small></div>
        </div>
        <div className="modal-body">
          <dl className="scan-list">
            {rows.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value || <em>Not readable</em>}</dd></div>
            ))}
          </dl>
          <h4 className="scan-subjects-title">Enrolled subjects</h4>
          {scan.subjects.length > 0
            ? <ul className="scan-subjects">{scan.subjects.map((s, i) => <li key={i}><b>{s.code}</b> {s.title}</li>)}</ul>
            : <p className="muted">We could not read the subject list from your photo. This will not stop you from registering.</p>}
          <div className={'info-banner' + (sure ? '' : ' warning')}>
            {sure
              ? 'Your enrollment in BSIT looks confirmed. Your account will be ready right away.'
              : 'We could not confirm everything on your COR. You can still register: an administrator will check your COR before you can sign in. A clearer photo (full page, flat, good light) may avoid the wait.'}
          </div>
          {error && <div className="form-error">{error}</div>}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn outline" disabled={busy} onClick={onRetake}>Retake photo</button>
          <button type="button" className="btn primary" disabled={busy} onClick={onConfirm}>{busy ? 'Creating account...' : 'Confirm and register'}</button>
        </div>
      </div>
    </div>
  );
}

export default function StudentRegister({ onBack }) {
  const [form, setForm] = useState({ pass: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scan, setScan] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [done, setDone] = useState(null); // { status, message }

  const handleFile = (f) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setError('Upload a photo of your COR (JPG, PNG or WebP).'); return; }
    if (f.size > MAX_BYTES) { setError('That photo is larger than 10MB.'); return; }
    setFile(f);
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.pass.length < 8) { setError('Use a password of at least 8 characters.'); return; }
    if (form.pass !== form.confirm) { setError('The passwords do not match.'); return; }
    if (!file) { setError('Upload your COR to continue.'); return; }
    setScanning(true);
    setError('');
    try {
      setScan(await students.scan(file));
      setModalError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const confirm = async () => {
    setSaving(true);
    setModalError('');
    try {
      setDone(await students.register(form.pass));
      setScan(null);
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const retake = () => { setScan(null); setFile(null); setModalError(''); };

  if (done) {
    const verified = done.status === 'verified';
    return (
      <div className="login-card register-card register-done">
        <span className="drop-icon">{verified ? '✓' : '⏳'}</span>
        <h2>{verified ? 'Registration Complete' : 'Waiting for Verification'}</h2>
        <p className="muted">{done.message}</p>
        <button className="btn primary wide" type="button" onClick={onBack}>Back to Sign In</button>
      </div>
    );
  }

  return (
    <>
      <form className="login-card register-card" onSubmit={submit}>
        <img className="login-logo" src="/cite-logo.png" alt="College logo" />
        <span className="eyebrow">STUDENT REGISTRATION</span>
        <h2>Create your account</h2>
        <p className="muted">For BSIT students. We read your COR to verify your enrollment, and your student ID becomes your username.</p>
        <label>Certificate of Registration (COR)
          <div className={`dropzone compact${dragging ? ' dragging' : ''}${file ? ' has-file' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => document.getElementById('cor-input').click()}>
            <input id="cor-input" type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={e => { handleFile(e.target.files[0]); e.target.value = ''; }} />
            {file ? <><span className="drop-icon">📎</span><span className="drop-text">{file.name}</span><small>Click or drop to replace</small></> : <><span className="drop-icon">📷</span><span className="drop-text">Take a photo or upload your COR</span><small>Whole page, flat, in good light • Image only • Max 10MB</small></>}
          </div>
        </label>
        <label className="pass-field">Password
          <span className="pass-input">
            <input type={showPass ? 'text' : 'password'} value={form.pass} onChange={e => setForm({ ...form, pass: e.target.value })} placeholder="At least 8 characters" autoComplete="new-password" />
            <button type="button" className="eye-btn" aria-label={showPass ? 'Hide password' : 'Show password'} onClick={() => setShowPass(!showPass)}><Icon name={showPass ? 'eyeSlash' : 'eye'} size={20} /></button>
          </span>
        </label>
        <label>Confirm password
          <input type={showPass ? 'text' : 'password'} value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} placeholder="Type it again" autoComplete="new-password" />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button className="btn primary wide" type="submit" disabled={scanning}>{scanning ? 'Reading your COR... this can take a few seconds' : 'Scan COR and continue'}</button>
        <button className="link-btn" type="button" onClick={onBack}>← Back to Sign In</button>
      </form>
      {scan && <ScanModal scan={scan} busy={saving} error={modalError} onConfirm={confirm} onRetake={retake} />}
    </>
  );
}
