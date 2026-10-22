import StableButton from '../components/StableButton';
import AdministrativeSettings from '../components/AdministrativeSettings';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useId, useRef, useState } from 'react';
import { Avatar, PageHead, Field } from '../components/ui';
import { useGooglePhotoSync } from '../lib/useGooglePhotoSync';
import { users as usersApi, adminSettings } from '../lib/api';
import { AVATAR_ACCEPT, prepareAvatar } from '../lib/avatar';
import Select from '../components/Select';
import StandardDialog from '../components/StandardDialog';

export default function Settings({ user, notify, onAvatarChange, onProfileChange, language, languageBusy, onLanguageChange }) {
  const isAdmin = user.role === 'admin';
  const [administration, setAdministration] = useState(null);
  const [standardOpen, setStandardOpen] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [languageError, setLanguageError] = useState('');
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    adminSettings.get().then(result => { if (!cancelled) setAdministration(result.settings); })
      .catch(error => { if (!cancelled) setAdminError(error.message); });
    return () => { cancelled = true; };
  }, [isAdmin]);
  const updateAdmin = (key, value) => setAdministration(current => ({ ...current, [key]: value }));
  const saveAdmin = async event => {
    event.preventDefault();
    if (adminBusy || !administration) return;
    const year = String(administration.academicYear || '').match(/^(\d{4})–(\d{4})$/);
    if (!year || Number(year[2]) !== Number(year[1]) + 1) { setAdminError(translateUI("settings.year_invalid")); return; }
    setAdminBusy(true); setAdminError('');
    try { const result = await adminSettings.save(administration); setAdministration(result.settings); notify(translateUI("ui.settings_saved_f133b2")); }
    catch (error) { setAdminError(error.message); }
    finally { setAdminBusy(false); }
  };
  const [names, setNames] = useState({ firstName: user.firstName || '', lastName: user.lastName || '' });
  const [editingName, setEditingName] = useState(false);
  const firstNameRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const googlePhoto = useGooglePhotoSync(user.email);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const photoMenuRef = useRef(null);
  const photoMenuButtonRef = useRef(null);
  const photoMenuId = useId();
  const fileRef = useRef(null);
  const pending = useRef(false);
  useEffect(() => { setNames({ firstName: user.firstName || '', lastName: user.lastName || '' }); }, [user.firstName, user.lastName]);
  useEffect(() => { if (editingName) firstNameRef.current?.focus(); }, [editingName]);
  useEffect(() => {
    if (!photoMenuOpen) return;
    const items = () => [...photoMenuRef.current.querySelectorAll('[role="menuitem"]:not(:disabled)')];
    items()[0]?.focus();
    const outside = event => { if (!photoMenuRef.current?.contains(event.target)) setPhotoMenuOpen(false); };
    const keyboard = event => {
      if (event.key === 'Escape') { event.preventDefault(); setPhotoMenuOpen(false); photoMenuButtonRef.current?.focus(); }
      if (event.key === 'Tab') setPhotoMenuOpen(false);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const buttons = items();
        const current = buttons.indexOf(document.activeElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    photoMenuRef.current.addEventListener('keydown', keyboard);
    const menu = photoMenuRef.current;
    return () => { document.removeEventListener('pointerdown', outside); menu.removeEventListener('keydown', keyboard); };
  }, [photoMenuOpen]);
  const closePhotoMenu = () => { setPhotoMenuOpen(false); photoMenuButtonRef.current?.focus(); };

  const run = async (action, message) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try { await action(); notify(message); }
    catch (err) { setError(err.message || translateUI("ui.could_not_update_your_profile_please_try_again_b453df")); }
    finally { pending.current = false; setBusy(false); }
  };
  const pickPhoto = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    run(async () => {
      const result = await usersApi.uploadAvatar(await prepareAvatar(file));
      onAvatarChange(result.avatarUrl);
    }, 'Profile photo updated.');
  };
  const saveName = (event) => {
    event.preventDefault();
    if (!editingName) return;
    run(async () => {
      const result = await usersApi.updateProfile({ firstName: names.firstName.trim(), lastName: names.lastName.trim() });
      onProfileChange(result.user);
      setNames({ firstName: result.user.firstName, lastName: result.user.lastName });
      setEditingName(false);
    }, 'Profile changes saved.');
  };
  return (
    <>
      <PageHead title={translateUI("ui.settings_c7f73b")} subtitle={translateUI("ui.manage_your_profile_and_preferences_effe10")} />
      <section className="settings-card profile-settings" aria-busy={busy}>
        <h3>{translateUI("ui.my_profile_9ba8d3")}</h3>
        <div className="profile-settings-grid">
          <div className="profile-photo-container">
            <input ref={fileRef} type="file" accept={AVATAR_ACCEPT} onChange={pickPhoto} hidden />
            <div className="profile-photo-row">
              <Avatar className="avatar settings-avatar" userId={user.id} src={user.avatarUrl} name={user.name} initials={user.initials} />
              <div className="profile-photo-details">
                <h4>{translateUI("ui.profile_picture_aeb837")}</h4>
                <div className="profile-photo-actions">
                  <StableButton className="btn outline" type="button" disabled={busy} onClick={() => { setPhotoMenuOpen(false); fileRef.current?.click(); }}>{user.avatarUrl ? translateUI("ui.change_photo_ed5690") : translateUI("ui.upload_photo_69abef")}</StableButton>
                  <div className="profile-photo-menu-wrap" ref={photoMenuRef}>
                    <StableButton className="btn outline profile-photo-more" ref={photoMenuButtonRef} type="button" disabled={busy} aria-label={translateUI("ui.more_profile_photo_actions_5f34f0")} aria-haspopup="menu" aria-expanded={photoMenuOpen} aria-controls={photoMenuOpen ? photoMenuId : undefined} onClick={() => setPhotoMenuOpen(value => !value)}><span aria-hidden="true">•••</span></StableButton>
                    {photoMenuOpen && <div className="profile-photo-menu" id={photoMenuId} role="menu" aria-label={translateUI("ui.profile_photo_actions_32a191")}>
                      <button type="button" role="menuitem" disabled={busy || !user.avatarUrl} onClick={() => { closePhotoMenu(); run(async () => { await usersApi.removeAvatar(); onAvatarChange(null); }, 'Profile photo removed.'); }}>{translateUI("ui.remove_photo_c8f5ed")}</button>
                      <button type="button" role="menuitem" disabled={busy || googlePhoto.loading} onClick={() => { closePhotoMenu(); run(async () => { const accessToken = await googlePhoto.requestAccess(); const result = await usersApi.syncGoogleAvatarWithAccessToken(accessToken); onAvatarChange(result.avatarUrl); }, 'Google Workspace photo synced.'); }}>{translateUI("ui.sync_google_workspace_photo_2dd636")}</button>
                    </div>}
                  </div>
                </div>
                <p className="muted" role="status" aria-live="polite">{busy ? translateUI("ui.updating_profile_f2060f") : translateUI("ui.jpeg_png_or_webp_up_to_5_mb_7e66fd")}</p>
              </div>
            </div>
          </div>
          <form className="profile-name-form" onSubmit={saveName}>
            <Field label={translateUI("ui.first_name_7e568a")}><input ref={firstNameRef} autoComplete="given-name" value={names.firstName} maxLength={100} required readOnly={!editingName} disabled={busy} onChange={event => setNames({ ...names, firstName: event.target.value })} /></Field>
            <Field label={translateUI("ui.last_name_adec36")}><input autoComplete="family-name" value={names.lastName} maxLength={100} required readOnly={!editingName} disabled={busy} onChange={event => setNames({ ...names, lastName: event.target.value })} /></Field>
            {editingName
              ? <StableButton key="save-name" className="btn primary" type="submit" disabled={busy || !names.firstName.trim() || !names.lastName.trim()}>{translateUI("ui.save_profile_909bf3")}</StableButton>
              : <StableButton key="edit-name" className="btn outline" type="button" disabled={busy} onClick={event => { event.preventDefault(); setError(''); setEditingName(true); }}>{translateUI("ui.edit_profile_cd280a")}</StableButton>}
          </form>
        </div>
        {error && <div className="form-error" role="alert">{tr(error)}</div>}
      </section>
      <section className="settings-card language-settings" aria-busy={languageBusy}>
        <h3>{translateUI("ui.language_89b86a")}</h3>
        <p className="muted">{translateUI("ui.choose_the_language_used_throughout_the_system_your_preference_is_312fa8")}</p>
        <Field label={translateUI("ui.display_language_73de4c")}><Select value={language} disabled={languageBusy} onChange={async event => {
          setLanguageError('');
          try { await onLanguageChange(event.target.value); }
          catch (error) { setLanguageError(error.message || translateUI("ui.could_not_save_your_language_preference_please_try_again_479b33")); }
        }}><option value="en" lang="en">{translateUI("ui.english_649df0")}</option><option value="tl" lang="tl">{translateUI("ui.tagalog_68ddd9")}</option></Select></Field>
        <p className="language-save-status muted" role="status" aria-live="polite">{languageBusy ? translateUI("ui.saving_language_preference_e4f88d") : languageError ? tr('Language change was not saved. Your previous language has been restored.') : translateUI("ui.language_preference_saved_automatically_b4db96")}</p>
        {languageError && <div className="form-error" role="alert">{tr(languageError)}</div>}
      </section>
      {isAdmin && <form onSubmit={saveAdmin} aria-busy={adminBusy}>
        {adminError && <div className="form-error" role="alert">{tr(adminError)}</div>}
        {!administration && !adminError && <p role="status">{translateUI("ui.loading_administrator_settings_ce3873")}</p>}
        {administration && <>
          <AdministrativeSettings administration={administration} adminBusy={adminBusy} updateAdmin={updateAdmin} onViewStandard={() => setStandardOpen(true)} />
          <StableButton className="btn primary" type="submit" disabled={adminBusy}>{adminBusy ? translateUI("ui.saving_settings_984f7f") : translateUI("ui.save_settings_0022a3")}</StableButton>
        </>}
      </form>}
      {standardOpen && <StandardDialog onClose={() => setStandardOpen(false)} />}
    </>
  );
}
