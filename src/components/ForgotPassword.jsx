import StableButton from './StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
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
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) { setError(translateUI("ui.enter_the_email_address_you_registered_with_8e2dd3")); return; }
    setBusy(true);
    setError('');
    try {
      await auth.forgotPassword(value);
      setSentTo(value);
    } catch (err) {
      setError(err.message || translateUI("ui.the_request_could_not_be_sent_11fa24"));
    } finally { setBusy(false); }
  };

  return (
    <form className="login-card login-card-forgot" onSubmit={submit} noValidate>
      <h2>{translateUI("ui.get_a_temporary_password_c137bb")}</h2>
      {sentTo ? (
        <>
          <div className="pw-sent" role="status" aria-live="polite">{translateUI("ui.if_ed46f9") + sentTo + translateUI("ui.is_registered_a_temporary_password_has_been_sent_to_it_it_works_f_64f2a8")}</div>
          <p className="muted">{translateUI("ui.your_current_password_still_works_until_you_do_e6c36b")}</p>
          <StableButton className="btn primary wide" type="button" onClick={onBack}>{translateUI("ui.back_to_sign_in_4da821")}</StableButton>
        </>
      ) : (
        <>
          <p className="muted">{translateUI("ui.type_your_registered_email_address_4e92a6")}</p>
          <label htmlFor={uid + '-email'}><input id={uid + '-email'} aria-label={translateUI("ui.email_2f707b")} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </label>
          {error && <div className="form-error" role="alert">{tr(error)}</div>}
          <StableButton className="btn primary wide" type="submit" disabled={busy}>{busy ? translateUI("ui.sending_cf7655") : translateUI("ui.send_temporary_password_02ad7e")}</StableButton>
          <StableButton className="btn outline wide" type="button" onClick={onBack} disabled={busy}>{translateUI("ui.back_to_sign_in_4da821")}</StableButton>
        </>
      )}
    </form>
  );
}
