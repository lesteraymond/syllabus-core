import StableButton from './StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useRef, useState } from 'react';
import { Icon } from './ui';
import { students } from '../lib/api';
import { useModalLayer } from './useModalLayer';

const MAX_BYTES = 10 * 1024 * 1024;

// Read-only: what the server read from the COR. The student confirms it or retakes the photo; nothing here can be typed.
function ScanModal({ scan, busy, error, onConfirm, onRetake, onClose }) {
  const dialog = useRef(null);
  useModalLayer(dialog, () => { if (!busy) onClose(); }); // Esc closes it, except while the account is being created
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
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="scan-title" tabIndex={-1} ref={dialog}>
        <div className="modal-head">
          <div><h3 id="scan-title">{translateUI("ui.is_this_your_cor_1d57c8")}</h3><small>{translateUI("ui.this_is_what_we_read_from_your_photo_it_can_t_be_edited_here_c24d4b")}</small></div>
          <button type="button" className="icon-btn" aria-label={translateUI("ui.close_bbfa77")} title={translateUI("ui.close_bbfa77")} disabled={busy} onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <dl className="scan-list">
            {rows.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value || <em>{translateUI("ui.not_readable_c35717")}</em>}</dd></div>
            ))}
          </dl>
          <h4 className="scan-subjects-title">{translateUI("ui.enrolled_subjects_0ea329")}</h4>
          {scan.subjects.length > 0
            ? <ul className="scan-subjects">{scan.subjects.map((s, i) => <li key={i}><b>{s.code}</b> {s.title}</li>)}</ul>
            : <p className="muted">{translateUI("ui.we_could_not_read_the_subject_list_from_your_photo_this_will_not__c5b836")}</p>}
          <div className={'info-banner' + (sure ? '' : ' warning')}>
            {sure
              ? translateUI("ui.your_enrollment_in_bsit_looks_confirmed_your_account_will_be_read_fa67fa")
              : translateUI("ui.we_could_not_confirm_everything_on_your_cor_you_can_still_registe_0afe9d")}
          </div>
          {error && <div className="form-error">{tr(error)}</div>}
        </div>
        <div className="modal-foot">
          <StableButton type="button" className="btn outline" disabled={busy} onClick={onRetake}>{translateUI("ui.retake_photo_4873d4")}</StableButton>
          <StableButton type="button" className="btn primary" disabled={busy} onClick={onConfirm}>{busy ? translateUI("ui.creating_account_27b8a2") : translateUI("ui.confirm_and_register_558ffe")}</StableButton>
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
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setError(translateUI("ui.upload_a_photo_of_your_cor_jpg_png_or_webp_b5323e")); return; }
    if (f.size > MAX_BYTES) { setError(translateUI("ui.that_photo_is_larger_than_10mb_801f53")); return; }
    setFile(f);
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.pass.length < 8) { setError(translateUI("ui.use_a_password_of_at_least_8_characters_69cc28")); return; }
    if (form.pass !== form.confirm) { setError(translateUI("ui.the_passwords_do_not_match_540a66")); return; }
    if (!file) { setError(translateUI("ui.upload_your_cor_to_continue_da868b")); return; }
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
  const closeModal = () => { setScan(null); setModalError(''); }; // keeps the chosen photo so they can scan it again

  if (done) {
    const verified = done.status === 'verified';
    return (
      <div className="login-card register-card register-done">
        <span className="drop-icon">{verified ? '✓' : '⏳'}</span>
        <h2>{verified ? translateUI("ui.registration_complete_ab7971") : translateUI("ui.waiting_for_verification_a113ec")}</h2>
        <p className="muted">{done.message}</p>
        <StableButton className="btn primary wide" type="button" onClick={onBack}>{translateUI("ui.back_to_sign_in_c65048")}</StableButton>
      </div>
    );
  }

  return (
    <>
      <form className="login-card register-card" onSubmit={submit}>
        <h2>{translateUI("ui.create_your_account_4046b5")}</h2>
        <p className="muted">{translateUI("ui.for_bsit_students_we_read_your_cor_to_verify_your_enrollment_and__bed562")}</p>
        <label>{translateUI("ui.certificate_of_registration_cor_0ef71c")}<div className={`dropzone compact${dragging ? ' dragging' : ''}${file ? ' has-file' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => document.getElementById('cor-input').click()}>
            <input id="cor-input" type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={e => { handleFile(e.target.files[0]); e.target.value = ''; }} />
            {file ? <><span className="drop-icon">📎</span><span className="drop-text">{file.name}</span><small>{translateUI("ui.click_or_drop_to_replace_7c5654")}</small></> : <><span className="drop-icon">📷</span><span className="drop-text">{translateUI("ui.take_a_photo_or_upload_your_cor_cea856")}</span><small>{translateUI("ui.whole_page_flat_in_good_light_image_only_max_10mb_73f731")}</small></>}
          </div>
        </label>
        <label className="pass-field">{translateUI("ui.password_0aa0ce")}<span className="pass-input">
            <input type={showPass ? 'text' : 'password'} value={form.pass} onChange={e => setForm({ ...form, pass: e.target.value })} placeholder={translateUI("ui.at_least_8_characters_1fe494")} autoComplete="new-password" />
            <button type="button" className="eye-btn" aria-label={showPass ? translateUI("ui.hide_password_e40123") : translateUI("ui.show_password_044b85")} onClick={() => setShowPass(!showPass)}><Icon name={showPass ? 'eyeSlash' : 'eye'} size={20} /></button>
          </span>
        </label>
        <label>{translateUI("ui.confirm_password_228465")}<input type={showPass ? 'text' : 'password'} value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} placeholder={translateUI("ui.type_it_again_488399")} autoComplete="new-password" />
        </label>
        {error && <div className="form-error">{tr(error)}</div>}
        <StableButton className="btn primary wide" type="submit" disabled={scanning}>{scanning ? translateUI("ui.reading_your_cor_this_can_take_a_few_seconds_595ad5") : translateUI("ui.scan_cor_and_continue_696299")}</StableButton>
        <button className="link-btn" type="button" onClick={onBack}>{translateUI("ui.back_to_sign_in_e52282")}</button>
      </form>
      {scan && <ScanModal scan={scan} busy={saving} error={modalError} onConfirm={confirm} onRetake={retake} onClose={closeModal} />}
    </>
  );
}
