import { useEffect, useRef, useState } from 'react';
import { Avatar, Icon } from './ui';
import { users as usersApi } from '../lib/api';
import { AVATAR_ACCEPT, prepareAvatar } from '../lib/avatar';
import { navItems } from '../data/initialData';
import { fmt } from '../lib/utils';

export default function Topbar({ page, onLogout, user, unread, threads, msgDrop, setMsgDrop, setChatCode, markRead, notify, onAvatarChange, notifications, onOpenNotification, onMarkAllNotificationsRead }) {
  const title = navItems.find(([k]) => k === page)?.[2] || 'Dashboard';
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
      notify('Profile photo updated.');
    } catch (err) {
      notify(err.message || 'Could not update your photo.');
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
      notify('Profile photo removed.');
    } catch (err) {
      notify(err.message || 'Could not remove your photo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="topbar">
      <div><span className="eyebrow">SYLLABUS MANAGEMENT SYSTEM</span><h2>{title}</h2></div>
      <div className="top-actions">
        <div className="search"><Icon name="magnifyingGlass" size={18} /><input placeholder="Search syllabus, course, faculty..." /></div>
        <div className="msg-wrap" ref={ref}>
          <button className="icon-btn" title="Messages" aria-label="Messages" onClick={() => { setBellOpen(false); setMsgDrop(!msgDrop); }}><Icon name="envelope" size={20} />{unread > 0 && <span className="pill">{unread}</span>}</button>
          {msgDrop && <div className="msg-drop">
            <div className="msg-drop-head"><strong>Messages</strong><span>{unread} unread</span></div>
            {threads.length === 0 && <div className="msg-empty">No conversations yet.</div>}
            {threads.map(t => <button key={t.code} className={`thread${t.unread ? ' unread' : ''}`} onClick={() => { setChatCode(t.code); markRead(t.code); setMsgDrop(false); }}>
              <Avatar className="thread-av" src={t.partner?.avatarUrl} name={t.partner?.name} initials={t.partner?.initials || '?'} />
              <div className="thread-body"><div className="thread-top"><strong>{t.title}</strong><small>{fmt(t.lastTime)}</small></div><p>{t.partner?.name || 'Unknown'}{t.partner?.roleLabel && <em className="thread-role">{' · ' + t.partner.roleLabel}</em>}</p><span>{t.lastMsg}</span></div>
              {t.unread > 0 && <span className="thread-dot" />}
            </button>)}
          </div>}
        </div>
        <div className="msg-wrap" ref={bellRef}>
          <button className="icon-btn" title="Notifications" aria-label={bellCount > 0 ? `Notifications, ${bellCount} unread` : 'Notifications'} aria-haspopup="true" aria-expanded={bellOpen} onClick={() => { setMsgDrop(false); setBellOpen(o => !o); }}><Icon name="bell" size={20} />{bellCount > 0 && <span className="pill">{bellCount > 99 ? '99+' : bellCount}</span>}</button>
          {bellOpen && <div className="msg-drop">
            <div className="msg-drop-head"><strong>Notifications</strong>{bellCount > 0 ? <button className="link-btn" onClick={onMarkAllNotificationsRead}>Mark all read</button> : <span>All caught up</span>}</div>
            <div className="notif-list">
              {(!notifications || notifications.items.length === 0) && <div className="msg-empty">No notifications yet.</div>}
              {notifications?.items.map(n => <button key={n.id} className={`thread notif-item${n.isRead ? '' : ' unread'}`} onClick={() => { setBellOpen(false); onOpenNotification(n); }}>
                <div className="thread-body"><div className="thread-top"><strong>{n.title}</strong><small>{fmt(n.createdAt)}</small></div>{n.body && <p>{n.body}</p>}</div>
                {!n.isRead && <span className="thread-dot" />}
              </button>)}
            </div>
          </div>}
        </div>
        <div className="profile-wrap" ref={profRef}>
          <button className="profile-btn" ref={profBtnRef} aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)}><Avatar src={user.avatarUrl} name={user.name} initials={user.initials} /><span><strong>{user.name}</strong><small>{user.role === 'admin' ? 'Academic Administrator' : user.dept}</small></span></button>
          {menuOpen && <div className="profile-menu" role="menu" aria-label="Profile photo">
            <button type="button" role="menuitem" disabled={busy} onClick={() => { setMenuOpen(false); fileRef.current?.click(); }}>Change photo</button>
            {user.avatarUrl && <button type="button" role="menuitem" disabled={busy} onClick={removePhoto}>Remove photo</button>}
          </div>}
          <input ref={fileRef} type="file" accept={AVATAR_ACCEPT} hidden onChange={pickPhoto} />
        </div>
        <button className="logout" onClick={onLogout}>Log out</button>
      </div>
    </header>
  );
}
