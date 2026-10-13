import { useState } from 'react';
import { Icon } from './ui';

export default function StudentRegister({ onBack }) {
  const [form, setForm] = useState({ username: '', pass: '' });
  const [showPass, setShowPass] = useState(false);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleFile = (f) => { if (f) { setFile(f); setError(''); } };

  const submit = (e) => {
    e.preventDefault();
    if (!form.username.trim()) { setError('Enter your username.'); return; }
    if (!form.pass.trim()) { setError('Enter a password.'); return; }
    if (!file) { setError('Upload your COR to continue.'); return; }
    setDone(true);
  };

  if (done) {
    return (
      <div className="login-card register-card register-done">
        <span className="drop-icon">✓</span>
        <h2>Registration Received</h2>
        <p className="muted">Your account has been created. Sign in with your username and password to continue.</p>
        <button className="btn primary wide" type="button" onClick={onBack}>Back to Sign In</button>
      </div>
    );
  }

  return (
    <form className="login-card register-card" onSubmit={submit}>
      <img className="login-logo" src="/cite-logo.png" alt="College logo" />
      <span className="eyebrow">STUDENT REGISTRATION</span>
      <h2>Create your account</h2>
      <p className="muted">For CITE students. Your COR is required to verify your enrollment.</p>
      <label>Username
        <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="e.g. 2021-01234" />
      </label>
      <label className="pass-field">Password
        <span className="pass-input">
          <input type={showPass ? 'text' : 'password'} value={form.pass} onChange={e => setForm({ ...form, pass: e.target.value })} placeholder="••••••••" />
          <button type="button" className="eye-btn" aria-label={showPass ? 'Hide password' : 'Show password'} onClick={() => setShowPass(!showPass)}><Icon name={showPass ? 'eyeSlash' : 'eye'} size={20} /></button>
        </span>
      </label>
      <label>Certificate of Registration (COR)
        <div className={`dropzone compact${dragging ? ' dragging' : ''}${file ? ' has-file' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => document.getElementById('cor-input').click()}>
          <input id="cor-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
          {file ? <><span className="drop-icon">📎</span><span className="drop-text">{file.name}</span><small>Click or drop to replace</small></> : <><span className="drop-icon">📷</span><span className="drop-text">Take a photo or upload your COR</span><small>Image only • Max 10MB</small></>}
        </div>
      </label>
      {error && <div className="form-error">{error}</div>}
      <button className="btn primary wide" type="submit">Register</button>
      <button className="link-btn" type="button" onClick={onBack}>← Back to Sign In</button>
    </form>
  );
}
