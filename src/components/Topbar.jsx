import StableButton from './StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useRef, useState } from 'react';
import { Avatar, Icon } from './ui';
import { users as usersApi } from '../lib/api';
import { AVATAR_ACCEPT, prepareAvatar } from '../lib/avatar';
import { fmt } from '../lib/utils';
import { ROLE_LABELS } from '../lib/roles';
import GlobalSearch from './GlobalSearch';

export default function Topbar({ page, onLogout, user, unread, threads, msgDrop, setMsgDrop, setChatCode, markRead, notify, onAvatarChange, notifications, onOpenNotification, onMarkAllNotificationsRead, readOnly = false, syllabi = [], onSearchSyllabus, onSearchFaculty, onSearchSubject }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setMsgDrop(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [setMsgDrop]);
  // Notification bell: dropdown that closes on outside click and when the messages dropdown opens.
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef(null);
  useEffect(() => {
    if (!bellOpen) return undefined;
    const onDown = (e) => { if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [bellOpen]);
  const bellCount = notifications?.unreadCount || 0;

  // Profile menu: Change / Remove photo. Closes on outside click and on Escape (focus returns to the button).
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const profRef = useRef(null);
  const profBtnRef = useRef(null);
  const fileRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => { if (profRef.current && !profRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setMenuOpen(false); profBtnRef.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    profRef.current?.querySelector('[role="menuitem"]')?.focus();
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  const closeMenu = () => { setMenuOpen(false); profBtnRef.current?.focus(); };

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow choosing the same file again
    if (!file) return;
    setBusy(true);
    try {
      const { avatarUrl } = await usersApi.uploadAvatar(await prepareAvatar(file));
      onAvatarChange(avatarUrl);
      notify(translateUI("ui.profile_photo_updated_3d7ef0"));
    } catch (err) {
      notify(err.message || translateUI("ui.could_not_update_your_photo_78f1fc"));
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = async () => {
    closeMenu();
    setBusy(true);
    try {
      await usersApi.removeAvatar();
      onAvatarChange(null);
      notify(translateUI("ui.profile_photo_removed_1e6a07"));
    } catch (err) {
      notify(err.message || translateUI("ui.could_not_remove_your_photo_ed1d1f"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-brand"><img src="/cite-logo.png" alt={translateUI("ui.cict_logo_dee290")} /><strong>{translateUI("ui.cite_brand_5b2e91")}</strong></div>
      <div className="topbar-heading"><span className="eyebrow">{translateUI("ui.syllabus_management_system_e49cab")}</span></div>
      <div className="top-actions">
        <GlobalSearch role={user.role} syllabi={syllabi} onSyllabus={onSearchSyllabus} onFaculty={onSearchFaculty} onSubject={onSearchSubject} />
        {!readOnly && <>
        <div className="msg-wrap" ref={ref}>
          <button className="icon-btn" title={translateUI("ui.messages_f1702b")} aria-label={unread > 0 ? translateUI("ui.messages_p0_unread_f09423", { p0: (unread) }) : translateUI("ui.messages_f1702b")} onClick={() => { setBellOpen(false); setMsgDrop(!msgDrop); }}><Icon name="envelope" size={20} />{unread > 0 && <span className="pill" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}</button>
          {msgDrop && <div className="msg-drop">
            <div className="msg-drop-head"><strong>{translateUI("ui.messages_f1702b")}</strong><span>{unread}{translateUI("ui.unread_2630a7")}</span></div>
            {threads.length === 0 && <div className="msg-empty">{translateUI("ui.no_conversations_yet_265928")}</div>}
            {threads.map(t => <button key={t.code} className={`thread${t.unread ? ' unread' : ''}`} onClick={() => { setChatCode(t.code); markRead(t.code); setMsgDrop(false); }}>
              <Avatar className="thread-av" userId={t.partner?.id} src={t.partner?.avatarUrl} name={t.partner?.name} initials={t.partner?.initials || '?'} />
              <div className="thread-body"><div className="thread-top"><strong>{t.title}</strong><small>{fmt(t.lastTime)}</small></div><p>{t.partner?.name || translateUI("ui.unknown_bc7819")}{t.partner?.roleLabel && <em className="thread-role">{' · ' + tr(t.partner.roleLabel)}</em>}</p><span>{t.lastMsg}</span></div>
              {t.unread > 0 && <span className="thread-dot" />}
            </button>)}
          </div>}
        </div>
        <div className="msg-wrap" ref={bellRef}>
          <button className="icon-btn" title={translateUI("ui.notifications_753a22")} aria-label={bellCount > 0 ? translateUI("ui.notifications_p0_unread_5c2cb7", { p0: (bellCount) }) : translateUI("ui.notifications_753a22")} aria-haspopup="true" aria-expanded={bellOpen} onClick={() => { setMsgDrop(false); setBellOpen(o => !o); }}><Icon name="bell" size={20} />{bellCount > 0 && <span className="pill" aria-hidden="true">{bellCount > 99 ? '99+' : bellCount}</span>}</button>
          {bellOpen && <div className="msg-drop">
            <div className="msg-drop-head"><strong>{translateUI("ui.notifications_753a22")}</strong>{bellCount > 0 ? <button className="link-btn" onClick={onMarkAllNotificationsRead}>{translateUI("ui.mark_all_read_8958e2")}</button> : <span>{translateUI("ui.all_caught_up_47cbaf")}</span>}</div>
            <div className="notif-list">
              {(!notifications || notifications.items.length === 0) && <div className="msg-empty">{translateUI("ui.no_notifications_yet_5537c6")}</div>}
              {notifications?.items.map(n => <button key={n.id} className={`thread notif-item${n.isRead ? '' : ' unread'}`} onClick={() => { setBellOpen(false); onOpenNotification(n); }}>
                <div className="thread-body"><div className="thread-top"><strong>{tr(n.title)}</strong><small>{fmt(n.createdAt)}</small></div>{n.body && <p>{['message', 'comment'].includes(n.type) ? n.body : tr(n.body)}</p>}</div>
                {!n.isRead && <span className="thread-dot" />}
              </button>)}
            </div>
          </div>}
        </div>
        </>}
        <div className="profile-wrap" ref={profRef}>
          <button className="profile-btn" title={user.name} ref={profBtnRef} aria-haspopup={readOnly ? undefined : "menu"} aria-expanded={readOnly ? undefined : menuOpen} onClick={() => !readOnly && setMenuOpen(o => !o)}><Avatar userId={user.id} src={user.avatarUrl} name={user.name} initials={user.initials} /><span><strong>{user.name}</strong><small>{tr(ROLE_LABELS[user.role] || user.role || translateUI("ui.unknown_role_476868"))}</small></span></button>
          {menuOpen && !readOnly && <div className="profile-menu" role="menu" aria-label={translateUI("ui.profile_photo_33f385")}>
            <button type="button" role="menuitem" disabled={busy} onClick={() => { setMenuOpen(false); fileRef.current?.click(); }}>{translateUI("ui.change_photo_ed5690")}</button>
            {user.avatarUrl && <button type="button" role="menuitem" disabled={busy} onClick={removePhoto}>{translateUI("ui.remove_photo_c8f5ed")}</button>}
          </div>}
          <input ref={fileRef} type="file" accept={AVATAR_ACCEPT} hidden onChange={pickPhoto} />
        </div>
        <StableButton className="logout" aria-label={translateUI("ui.log_out_6e78c9")} onClick={onLogout}><Icon name="signOut" size={18} />{translateUI("ui.log_out_6e78c9")}</StableButton>
      </div>
    </header>
  );
}
