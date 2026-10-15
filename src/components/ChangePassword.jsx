import StableButton from './StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
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
    if (password !== again) { setError(translateUI("ui.the_two_passwords_do_not_match_d9ae81")); return; }
    setSaving(true);
    setError('');
    try {
      await auth.changePassword({ newPassword: password });
      onDone();
    } catch (err) {
      setError(err.message || translateUI("ui.the_password_could_not_be_changed_ceb60b"));
      setSaving(false);
    }
  };

  return (
    <main className="pw-page">
      <form className="login-card pw-card" onSubmit={submit} noValidate>
        <img className="login-logo" src="/cite-logo.png" alt={translateUI("ui.college_logo_1df91f")} />
        <span className="eyebrow">{translateUI("ui.first_sign_in_e8fad6")}</span>
        <h2>{translateUI("ui.choose_your_own_password_19d96e")}</h2>
        <p className="muted">{translateUI("ui.you_are_signed_in_as_531cce") + user.email + translateUI("ui.with_a_temporary_password_choose_a_new_one_to_continue_c9567a")}</p>
        <label htmlFor={uid + '-new'}>{translateUI("ui.new_password_159d33")}<span className="pass-input">
            <input id={uid + '-new'} type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby={uid + '-rules'} autoFocus />
            <button type="button" className="eye-btn" aria-label={show ? translateUI("ui.hide_passwords_37701c") : translateUI("ui.show_passwords_a76567")} onClick={() => setShow(!show)}><Icon name={show ? 'eyeSlash' : 'eye'} size={20} /></button>
          </span>
        </label>
        <label htmlFor={uid + '-again'}>{translateUI("ui.type_it_again_da6510")}<input id={uid + '-again'} type={show ? 'text' : 'password'} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </label>
        <p id={uid + '-rules'} className="pw-rules">{tr(RULES)}</p>
        {error && <div className="form-error" role="alert">{tr(error)}</div>}
        <StableButton className="btn primary wide" type="submit" disabled={saving}>{saving ? translateUI("ui.saving_56a228") : translateUI("ui.save_and_continue_3b033f")}</StableButton>
        <StableButton className="btn outline wide" type="button" onClick={onLogout} disabled={saving}>{translateUI("ui.sign_out_dc1649")}</StableButton>
      </form>
    </main>
  );
}
