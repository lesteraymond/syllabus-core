import StableButton from './StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import StudentRegister from './StudentRegister';
import GoogleSignInButton from './GoogleSignInButton';
import ForgotPassword from './ForgotPassword';
import LoginConstellation from './LoginConstellation';
import { Icon } from './ui';

const RECENT_KEY = 'sms_recent_logins';
const MAX_RECENT = 5;

function readRecentEmails() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string' && v.trim()).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecentEmail(email) {
  const clean = email.trim();
  if (!clean) return readRecentEmails();
  const next = [clean, ...readRecentEmails().filter((e) => e.toLowerCase() !== clean.toLowerCase())].slice(0, MAX_RECENT);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
  return next;
}

function removeRecentEmail(email) {
  const next = readRecentEmails().filter((e) => e.toLowerCase() !== email.toLowerCase());
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
  return next;
}

export default function Login({ onLogin, onGoogleLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ user: '', pass: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [remember, setRemember] = useState(false);
  const [recent, setRecent] = useState(readRecentEmails);
  const [recentOpen, setRecentOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const userInputId = useId();
  const userWrapRef = useRef(null);
  const passRef = useRef(null);

  const filteredRecent = useMemo(() => {
    const q = form.user.trim().toLowerCase();
    return q ? recent.filter((e) => e.toLowerCase().includes(q) && e.toLowerCase() !== q) : recent;
  }, [recent, form.user]);

  useEffect(() => {
    if (!recentOpen) return undefined;
    const onDown = (e) => { if (userWrapRef.current && !userWrapRef.current.contains(e.target)) setRecentOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [recentOpen]);

  const pickRecent = (email) => {
    setForm((f) => ({ ...f, user: email }));
    setError('');
    setRecentOpen(false);
    setActiveIdx(-1);
    passRef.current?.focus();
  };

  const deleteRecent = (e, email) => {
    e.preventDefault();
    e.stopPropagation();
    const next = removeRecentEmail(email);
    setRecent(next);
    setActiveIdx(-1);
    if (next.length === 0) setRecentOpen(false);
  };

  const onUserKeyDown = (e) => {
    if (!recentOpen || filteredRecent.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % filteredRecent.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? filteredRecent.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIdx >= 0 && filteredRecent[activeIdx]) {
      e.preventDefault();
      pickRecent(filteredRecent[activeIdx]);
    } else if (e.key === 'Escape') {
      setRecentOpen(false);
      setActiveIdx(-1);
    }
  };

  const fill = (e, p) => { setForm({ user: e, pass: p }); setError(''); };
  const submit = async (e) => {
    e.preventDefault();
    if (!form.user.trim() || !form.pass.trim()) { setError(translateUI("ui.enter_your_username_email_and_password_7bf61f")); return; }
    const err = await onLogin(form.user, form.pass, remember);
    if (err) {
      setError(err);
    } else {
      setRecent(saveRecentEmail(form.user));
    }
  };
  return (
    <div className="login-page">
      <section className="login-brand">
        <LoginConstellation />
        <div className="login-brand-content">
          <div className="brand-orb"><img src="/cite-logo.png" alt={translateUI("ui.college_logo_1df91f")} /></div>
          <h1><span>{translateUI("ui.syllabus_1b731d")}</span> <span className="login-brand-accent">{translateUI("ui.management_system_738978")}</span></h1>
          <p>{translateUI("ui.build_validate_review_approve_archive_and_analyze_undergraduate_s_0aef77")}</p>
          <div className="feature-pills"><span><Icon name="sparkle" size={16} />{translateUI("ui.ai_compliance_602783")}</span><span><Icon name="sealCheck" size={16} />{translateUI("ui.approval_workflow_cc8935")}</span><span><Icon name="graduationCap" size={16} />{translateUI("ui.academic_quality_93a706")}</span></div>
        </div>
      </section>
      <section className="login-panel">
        {mode === 'register' ? (
          <StudentRegister onBack={() => setMode('login')} />
        ) : mode === 'forgot' ? (
          <ForgotPassword onBack={() => setMode('login')} />
        ) : (
        <form className="login-card login-card-signin" autoComplete="off" onSubmit={submit}>
          <h2>{translateUI("ui.sign_in_to_login_7c41d8")}</h2>
          <p className="muted">{translateUI("ui.use_your_institutional_account_to_continue_143ca3")}</p>
          <div className="login-field">
            <label htmlFor={userInputId}>{translateUI("ui.username_or_email_728ae0")}</label>
            <div className="login-user-wrap" ref={userWrapRef}>
              <input
                id={userInputId}
                name="login_id"
                autoComplete="one-time-code"
                value={form.user}
                onFocus={() => { if (filteredRecent.length > 0) setRecentOpen(true); }}
                onChange={e => { setForm({ ...form, user: e.target.value }); setRecentOpen(true); setActiveIdx(-1); }}
                onKeyDown={onUserKeyDown}
                aria-expanded={recentOpen && filteredRecent.length > 0}
                aria-haspopup="listbox"
              />
              {recentOpen && filteredRecent.length > 0 && (
                <div className="login-recent-menu" role="listbox" aria-label={translateUI('login.recentAccounts')}>
                  <div className="login-recent-head">{translateUI('login.recentAccounts')}</div>
                  {filteredRecent.map((email, idx) => (
                    <div
                      key={email}
                      role="option"
                      aria-selected={idx === activeIdx}
                      className={'login-recent-item' + (idx === activeIdx ? ' is-active' : '')}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onMouseDown={(e) => { e.preventDefault(); pickRecent(email); }}
                    >
                      <span className="login-recent-ico" aria-hidden="true"><Icon name="userCircle" size={16} /></span>
                      <span className="login-recent-email">{email}</span>
                      <button
                        type="button"
                        className="login-recent-remove"
                        aria-label={translateUI('login.removeRecentItem', { email })}
                        title={translateUI('login.removeRecent')}
                        onMouseDown={(e) => deleteRecent(e, email)}
                      >
                        <Icon name="xCircle" size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <label className="pass-field">{translateUI("ui.password_8be3c9")}<span className="pass-input"><input ref={passRef} name="login_secret" autoComplete="new-password" type={showPass ? 'text' : 'password'} value={form.pass} onChange={e => setForm({ ...form, pass: e.target.value })} /><button type="button" className="eye-btn" aria-label={showPass ? translateUI("ui.hide_password_e40123") : translateUI("ui.show_password_044b85")} onClick={() => setShowPass(!showPass)}><Icon name={showPass ? 'eyeSlash' : 'eye'} size={20} /></button></span></label>
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
