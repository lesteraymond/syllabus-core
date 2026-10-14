import { useId, useState } from 'react';
import { auth } from '../lib/api';
import { Icon } from './ui';

const RULES = 'At least 8 characters, with a letter and a number.';

// Shown in place of the whole app while the signed-in user still has to choose their own password: right after the first sign-in with
// the password that was emailed to them, or with a temporary one from "Forgot password". The server refuses everything else until it is done.
//   user      the signed-in user (its email is shown, and cannot be used as the password)
//   onDone()  called once the new password is saved      onLogout()  lets them leave instead
export default function ChangePassword({ user, onDone, onLogout }) {
  const uid = useId();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) { setError(RULES); return; }
    if (password !== again) { setError('The two passwords do not match.'); return; }
    setSaving(true);
    setError('');
    try {
      await auth.changePassword({ newPassword: password });
      onDone();
    } catch (err) {
      setError(err.message || 'The password could not be changed.');
      setSaving(false);
    }
  };

  return (
    <main className="pw-page">
      <form className="login-card pw-card" onSubmit={submit} noValidate>
        <img className="login-logo" src="/cite-logo.png" alt="College logo" />
        <span className="eyebrow">First sign-in</span>
        <h2>Choose your own password</h2>
        <p className="muted">{'You are signed in as ' + user.email + ' with a temporary password. Choose a new one to continue.'}</p>
        <label htmlFor={uid + '-new'}>New password
          <span className="pass-input">
            <input id={uid + '-new'} type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby={uid + '-rules'} autoFocus />
            <button type="button" className="eye-btn" aria-label={show ? 'Hide passwords' : 'Show passwords'} onClick={() => setShow(!show)}><Icon name={show ? 'eyeSlash' : 'eye'} size={20} /></button>
          </span>
        </label>
        <label htmlFor={uid + '-again'}>Type it again
          <input id={uid + '-again'} type={show ? 'text' : 'password'} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </label>
        <p id={uid + '-rules'} className="pw-rules">{RULES}</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="btn primary wide" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save and continue'}</button>
        <button className="btn outline wide" type="button" onClick={onLogout} disabled={saving}>Sign out</button>
      </form>
    </main>
  );
}
