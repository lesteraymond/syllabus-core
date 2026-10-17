import StableButton from './StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useState } from 'react';
import StudentRegister from './StudentRegister';
import GoogleSignInButton from './GoogleSignInButton';
import ForgotPassword from './ForgotPassword';
import { Icon } from './ui';


export default function Login({ onLogin, onGoogleLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ user: '', pass: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [remember, setRemember] = useState(false);
  const fill = (e, p) => { setForm({ user: e, pass: p }); setError(''); };
  const submit = async (e) => {
    e.preventDefault();
    if (!form.user.trim() || !form.pass.trim()) { setError(translateUI("ui.enter_your_username_email_and_password_7bf61f")); return; }
    const err = await onLogin(form.user, form.pass, remember);
    if (err) setError(err);
  };
  return (
    <div className="login-page">
      <section className="login-brand">
        <div className="brand-orb"><img src="/cite-logo.png" alt={translateUI("ui.college_logo_1df91f")} /></div>
        <div>
          <span className="eyebrow light">{translateUI("ui.academic_quality_93a706")}</span>
          <h1>{translateUI("ui.syllabus_1b731d")}<br />{translateUI("ui.management_system_738978")}</h1>
          <p>{translateUI("ui.build_validate_review_approve_archive_and_analyze_undergraduate_s_0aef77")}</p>
          <div className="feature-pills"><span><Icon name="sparkle" size={16} />{translateUI("ui.ai_compliance_602783")}</span><span><Icon name="sealCheck" size={16} />{translateUI("ui.approval_workflow_cc8935")}</span></div>
        </div>
      </section>
      <section className="login-panel">
        {mode === 'register' ? (
          <StudentRegister onBack={() => setMode('login')} />
        ) : mode === 'forgot' ? (
          <ForgotPassword onBack={() => setMode('login')} />
        ) : (
        <form className="login-card" onSubmit={submit}>
          <img className="login-logo" src="/cite-logo.png" alt={translateUI("ui.college_logo_1df91f")} />
          <span className="eyebrow login-welcome">{translateUI("ui.welcome_back_593f1e")}</span>
          <span className="eyebrow login-sysname">{translateUI("ui.syllabus_management_system_e49cab")}</span>
          <h2>{translateUI("ui.sign_in_to_sms_52fec0")}</h2>
          <p className="muted">{translateUI("ui.use_your_institutional_account_to_continue_143ca3")}</p>
          <label>{translateUI("ui.username_or_email_728ae0")}<input value={form.user} onChange={e => setForm({ ...form, user: e.target.value })} placeholder={translateUI("ui.name_university_edu_ph_4d6969")} /></label>
          <label className="pass-field">{translateUI("ui.password_8be3c9")}<span className="pass-input"><input type={showPass ? 'text' : 'password'} value={form.pass} onChange={e => setForm({ ...form, pass: e.target.value })} placeholder="••••••••" /><button type="button" className="eye-btn" aria-label={showPass ? translateUI("ui.hide_password_e40123") : translateUI("ui.show_password_044b85")} onClick={() => setShowPass(!showPass)}><Icon name={showPass ? 'eyeSlash' : 'eye'} size={20} /></button></span></label>
          <div className="login-options"><label className="check"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />{translateUI("ui.remember_me_3444b2")}</label><button type="button" className="link-btn" onClick={() => setMode('forgot')}>{translateUI("ui.forgot_password_4c29f7")}</button></div>
          {error && <div className="form-error">{tr(error)}</div>}
          <StableButton className="btn primary wide" type="submit">{translateUI("ui.sign_in_f8492c")}</StableButton>
          <div className="or"><span />{translateUI("ui.or_175835")}<span /></div>
          <GoogleSignInButton onCredential={async (idToken) => { setError(''); const err = await onGoogleLogin(idToken); if (err) setError(err); }} onError={setError} />
          <div className="register-cta">
            <StableButton className="btn outline wide" type="button" onClick={() => setMode('register')}>{translateUI("ui.register_for_students_2f6e9d")}</StableButton>
          </div>
          {/* <div className="or"><span />or<span /></div>
          <button className="btn outline wide" type="button" onClick={() => { onLogin('admin@university.edu.ph', 'admin123'); }}>Enter Demo System</button> */}
          {/* <div className="demo-accounts"><small>Demo accounts — <button type="button" onClick={() => fill('admin@university.edu.ph', 'admin123')}>admin@university.edu.ph / admin123</button> · <button type="button" onClick={() => fill('faculty@university.edu.ph', 'faculty123')}>faculty@university.edu.ph / faculty123</button></small></div> */}
          {/* <small>Front-end prototype • No live authentication</small> */}
        </form>
        )}
      </section>
    </div>
  );
}
