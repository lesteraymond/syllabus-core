import { useId, useState } from 'react';
import { auth } from '../lib/api';

// "Forgot password": ask for the registered email; a temporary password is sent to it. The answer is the same whether or not the
// email is registered, and the current password keeps working until the temporary one is used. It only collects the email.
//   onBack()  returns to the sign-in form
export default function ForgotPassword({ onBack }) {
  const uid = useId();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) { setError('Enter the email address you registered with.'); return; }
    setBusy(true);
    setError('');
    try {
      await auth.forgotPassword(value);
      setSentTo(value);
    } catch (err) {
      setError(err.message || 'The request could not be sent.');
    } finally { setBusy(false); }
  };

  return (
    <form className="login-card" onSubmit={submit} noValidate>
      <img className="login-logo" src="/cite-logo.png" alt="College logo" />
      <span className="eyebrow">Forgot password</span>
      <h2>Get a temporary password</h2>
      {sentTo ? (
        <>
          <div className="pw-sent" role="status" aria-live="polite">{'If ' + sentTo + ' is registered, a temporary password has been sent to it. It works for 30 minutes, and you will be asked to choose a new password when you use it.'}</div>
          <p className="muted">Your current password still works until you do.</p>
          <button className="btn primary wide" type="button" onClick={onBack}>Back to sign in</button>
        </>
      ) : (
        <>
          <p className="muted">Type the email address you were registered with. We will email you a temporary password.</p>
          <label htmlFor={uid + '-email'}>Email
            <input id={uid + '-email'} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@university.edu.ph" autoFocus />
          </label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="btn primary wide" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send temporary password'}</button>
          <button className="btn outline wide" type="button" onClick={onBack} disabled={busy}>Back to sign in</button>
        </>
      )}
    </form>
  );
}
