import { installLocalizedValidation } from './i18n/validation';
import { tr } from "./i18n/index.js";
import { t as translateUI } from "./i18n/index.js";
import { getLanguage, setLanguage, subscribeLanguage } from './i18n';
import { createLanguagePreference } from './i18n/preference';
import { useLanguageTransition } from './i18n/useLanguageTransition';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import ChatModal from './components/ChatModal';
import ConfirmModal from './components/ConfirmModal';
import ChangePassword from './components/ChangePassword';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import SyllabusCommentsModal from './components/SyllabusCommentsModal';
import SyllabusViewModal from './components/SyllabusViewModal';
import Topbar from './components/Topbar';
import MobileNav from './components/MobileNav';
import { useMediaQuery, NARROW_QUERY } from './lib/useMediaQuery';
import VersionHistoryModal from './components/VersionHistoryModal';
import ReviewPanel from './views/ReviewPanel';
import { navItems } from './data/initialData';
import { auth, users as usersApi, logs as logsApi, messages as messagesApi, notifications as notificationsApi, syllabi as syllabiApi, onPasswordChangeRequired } from './lib/api';
import { commentNotificationIds, notificationTarget } from './lib/notificationRoute';
import { canChat, partnerOf, threadTitle } from './lib/chatPartner';
import { canDeleteSyllabus, canEditSyllabus, editBlockedReason } from './lib/syllabusRules';
import { useNotificationPolling, usePeriodicRefresh } from './lib/usePolling';
import { recordAvatar, seedAvatars } from './lib/avatarStore';
import { useActiveTime } from './lib/useActiveTime';
import AIChecker from './views/AIChecker';
import Analytics from './views/Analytics';
import Compliance from './views/Compliance';
import CourseOutcomes from './views/CourseOutcomes';
import Dashboard from './views/DashboardView';
import MySyllabi from './views/MySyllabi';
import Reports from './views/Reports';
import Repository from './views/Repository';
import ReviewApproval from './views/ReviewApproval';
import Settings from './views/Settings';
import StudentDashboard from './views/StudentDashboard';
import StudentSyllabi from './views/StudentSyllabi';
import SyllabusBuilder from './views/SyllabusBuilder';
import UsersRoles from './views/UsersRoles';
import SyllabusBuilderV2 from './views/builder2';

// The rebuilt syllabus builder (src/views/builder2) is behind a flag until it is approved: the current builder stays
// the default. Set VITE_NEW_BUILDER=true in .env to use the rebuilt one.
const NEW_BUILDER = import.meta.env.VITE_NEW_BUILDER === 'true';

export default function App() {
  const [user, setUser] = useState(null);
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, () => 'en');
  const languageShell = useLanguageTransition(language, user?.id);
  useEffect(() => installLocalizedValidation(document), []);
  const [languageBusy, setLanguageBusy] = useState(false);
  const languageRequest = useRef(0);
  const languageInFlight = useRef(false);
  const preferenceRef = useRef(null);
  if (!preferenceRef.current) preferenceRef.current = createLanguagePreference({
    apply: setLanguage,
    persist: usersApi.updatePreferences,
    onSaved: (id, preferredLanguage) => setUser(current => current?.id === id ? { ...current, preferredLanguage } : current),
  });
  const changeLanguage = async next => {
    if (languageInFlight.current) return;
    languageInFlight.current = true;
    const request = ++languageRequest.current;
    setLanguageBusy(true);
    try { await preferenceRef.current.change(next); }
    finally { if (request === languageRequest.current) { languageInFlight.current = false; setLanguageBusy(false); } }
  };
  const acceptUser = account => {
    languageRequest.current++; languageInFlight.current = false; setLanguageBusy(false);
    preferenceRef.current.reset(account.id, account.preferredLanguage);
    const signedIn = formatUser(account);
    seedAvatars([[signedIn.id, signedIn.avatarUrl]]);
    setUser(signedIn);
  };
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const logoutPending = useRef(false);
  // Read synchronously so the first paint already has the saved width (no layout shift).
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sms_sidebar_collapsed') === 'true'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('sms_sidebar_collapsed', String(sidebarCollapsed)); } catch {}
  }, [sidebarCollapsed]);
  // Below md (768px) the sidebar is replaced by an accordion card under the top bar (MobileNav). Its open state lives here, and it closes on
  // navigation, on Esc and when the screen grows back to desktop.
  const narrow = useMediaQuery(NARROW_QUERY);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => { if (!narrow) setMobileNavOpen(false); }, [narrow]);
  useEffect(() => {
    if (!narrow || !mobileNavOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMobileNavOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [narrow, mobileNavOpen]);
  // The open tab survives a reload (kept per browser tab). The builder is left out because it needs the syllabus being edited, which is not saved.
  const PAGE_KEY = 'scms.page';
  const [page, setPage] = useState(() => {
    try { const saved = window.sessionStorage.getItem(PAGE_KEY); return navItems.some(([id]) => id === saved) && saved !== 'builder' ? saved : 'dashboard'; } catch { return 'dashboard'; }
  });
  useEffect(() => { try { window.sessionStorage.setItem(PAGE_KEY, page); } catch { /* private window: the tab simply is not remembered */ } }, [page]);
  // A saved tab this account may not open (another role signed in on this browser tab) falls back to the dashboard.
  useEffect(() => { if (user && page !== 'ai' && !navItems.some(([id, , , r]) => id === page && (!r || r === user.role)) && page !== 'builder') setPage('dashboard'); }, [user, page]);
  // The compliance check moved into step 7 of the builder: an old 'ai' link sends faculty there, and only admins have the overview.
  useEffect(() => { if (user && user.role !== 'admin' && page === 'ai') setPage(user.role === 'faculty' ? 'builder' : 'dashboard'); }, [user, page]);
  const [toast, setToast] = useState('');
  const [syllabi, setSyllabi] = useState([]);
  const [logs, setLogs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [partners, setPartners] = useState({}); // syllabus id -> who the conversation is with (the server's answer)
  const [editing, setEditing] = useState(null);
  const [chatCode, setChatCode] = useState(null);
  const [histCode, setHistCode] = useState(null);
  const [facultyFocus, setFacultyFocus] = useState(''); // a faculty name picked in the top bar search: the Compliance page then shows only that person
  const [viewCode, setViewCode] = useState(null); // the syllabus open in the reviewer's window
  const [commentCode, setCommentCode] = useState(null); // the syllabus whose reviewer comments a faculty member is reading
  const [commentCounts, setCommentCounts] = useState({}); // { [syllabusId]: { total, unread } } for a faculty member's syllabi
  const [confirm, setConfirm] = useState(null);
  const [msgDrop, setMsgDrop] = useState(false);
  const [notifications, setNotifications] = useState({ items: [], unreadCount: 0 });

  const notify = (m) => { setToast(tr(m)); window.clearTimeout(window.__scmsToast); window.__scmsToast = window.setTimeout(() => setToast(''), 2400); };

  const formatUser = (u) => ({
    ...u,
    name: `${u.firstName} ${u.lastName}`,
    initials: `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`,
  });

  // A new or removed photo is recorded for everyone who shows it (topbar, tables, chat headers), not only in the signed-in user.
  const handleAvatarChange = (avatarUrl) => {
    if (user && !logoutPending.current) recordAvatar(user.id, avatarUrl);
    setUser(u => u && !logoutPending.current ? { ...u, avatarUrl } : u);
  };
  const handleProfileChange = (profile) => setUser(current => current && current.id === profile.id && !logoutPending.current ? formatUser({ ...profile, preferredLanguage: current.preferredLanguage }) : current);

  useEffect(() => {
    onPasswordChangeRequired(() => setUser(u => (u && !u.mustChangePassword ? { ...u, mustChangePassword: true } : u))); // a call was refused: show the screen
    auth.me().then(data => {
      acceptUser(data.user);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const fetchSyllabi = useCallback(async () => {
    try {
      const startedAt = Date.now();
      const data = await syllabiApi.list();
      seedAvatars(data.map(s => [s.userId, s.ownerAvatarUrl]), startedAt);
      setSyllabi(data);
    } catch (err) { console.error('Failed to fetch syllabi:', err); }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await logsApi.list();
      setLogs(data);
    } catch (err) { console.error('Failed to fetch logs:', err); }
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const startedAt = Date.now();
      const [list, who] = await Promise.all([messagesApi.listMine(), messagesApi.partners().catch(() => ({ partners: {} }))]); // the profile read is optional: chat works without it
      seedAvatars([...Object.values(who.partners || {}).map(p => [p.id, p.avatarUrl]), ...list.map(m => [m.senderId, m.senderAvatarUrl])], startedAt);
      setMessages(list);
      setPartners(who.partners || {});
    } catch (err) { console.error('Failed to fetch messages:', err); }
  }, []);

  const fetchCommentCounts = useCallback(async () => {
    try {
      const r = await syllabiApi.commentSummary();
      setCommentCounts(r.counts || {});
    } catch (err) { console.error('Failed to fetch comment counts:', err); }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationsApi.list();
      setNotifications({ items: data.notifications, unreadCount: data.unreadCount });
    } catch (err) { console.error('Failed to fetch notifications:', err); }
  }, []);

  useEffect(() => {
    if (user && user.role !== 'student' && !user.mustChangePassword) {
      fetchSyllabi();
      fetchLogs();
      fetchMessages();
      fetchNotifications();
      if (user.role === 'faculty') fetchCommentCounts();
    }
  }, [user, fetchSyllabi, fetchLogs, fetchMessages, fetchNotifications, fetchCommentCounts]);

  // Keep messages and notifications fresh without a reload (only polls while the tab is visible).
  // A draft created in the builder is not in this list yet: refresh when the faculty opens My Syllabi.
  // Your own activity (Recent Activity) is read again whenever the dashboard is opened, so what you just did is there.
  useEffect(() => { if (user && page === 'dashboard' && user.role !== 'student' && !user.mustChangePassword) fetchLogs(); }, [user, page, fetchLogs]);
  // The list says which submissions the administrator has checked: read it again when they open Review & Approval, so a check just made shows.
  useEffect(() => { if (user && user.role === 'admin' && (page === 'review' || page === 'ai')) fetchSyllabi(); }, [user, page, fetchSyllabi]);
  useEffect(() => { if (user && page === 'my-syllabi') { fetchSyllabi(); if (user.role === 'faculty') fetchCommentCounts(); } }, [user, page, fetchSyllabi, fetchCommentCounts]);

  // Other people's new profile pictures arrive with the syllabus list and the message partners: read both again now and then, and when the tab comes back.
  usePeriodicRefresh(!!user && user.role !== 'student' && !user.mustChangePassword && !loggingOut, () => { fetchSyllabi(); fetchMessages(); });
  // Time in the system: a heartbeat while the tab is visible and the person is active (students have no dashboard and the server closes this to them).
  useActiveTime(!!user && user.role !== 'student' && !user.mustChangePassword && !loggingOut);
  useNotificationPolling(!!user && !user.mustChangePassword && !loggingOut, () => { fetchMessages(); fetchNotifications(); fetchSyllabi(); if (user.role === 'faculty') fetchCommentCounts(); });

  const handleLogin = async (email, pass, remember) => {
    try {
      const data = await auth.login(email, pass, remember);
      acceptUser(data.user);
      setPage('dashboard');
      return null;
    } catch (err) {
      return err.message || 'Invalid email or password.';
    }
  };

  const handleGoogleLogin = async (idToken) => {
    try {
      const data = await auth.google(idToken);
      acceptUser(data.user);
      setPage('dashboard');
      return null;
    } catch (err) {
      return err.message || 'Google sign-in failed.';
    }
  };

  const handleLogout = async () => {
    if (logoutPending.current) return;
    logoutPending.current = true;
    setLoggingOut(true);
    try { await auth.logout(); } catch {
      // Preserve local sign-out if the server cannot be reached; auth.logout clears the access token.
    } finally {
      languageRequest.current++; languageInFlight.current = false; setLanguageBusy(false);
      preferenceRef.current.reset(null);
      setUser(null);
      setSyllabi([]);
      setLogs([]);
      setMessages([]);
      setPartners({});
      setNotifications({ items: [], unreadCount: 0 });
      setCommentCounts({});
      setPage('dashboard');
      setEditing(null);
      setChatCode(null);
      setHistCode(null);
      setViewCode(null);
      setCommentCode(null);
      setConfirm(null);
      setMsgDrop(false);
      window.clearTimeout(window.__scmsToast);
      setToast('');
      logoutPending.current = false;
      setLoggingOut(false);
    }
  };

  const unread = useMemo(() => messages.filter(m => m.receiverId === user?.id && !m.isRead).length, [messages, user]);

  const threads = useMemo(() => {
    if (!user) return [];
    const map = {};
    messages.forEach(m => {
      if (m.senderId !== user.id && m.receiverId !== user.id) return;
      const code = String(m.syllabusId);
      if (!map[code]) map[code] = { code: m.syllabusId, msgs: [] };
      map[code].msgs.push(m);
    });
    return Object.values(map).map(t => {
      t.msgs.sort((a, b) => new Date(a.time) - new Date(b.time));
      const last = t.msgs[t.msgs.length - 1];
      t.lastMsg = last.text;
      t.lastTime = last.time;
      t.unread = t.msgs.filter(m => m.receiverId === user.id && !m.isRead).length;
      const syl = syllabi.find(s => s.id === t.code);
      if (syl && !canChat(syl, user)) return null; // messages about a draft are not shown until it is submitted
      t.partner = partnerOf({ partner: partners[t.code], messages: t.msgs, user, syl });
      t.title = threadTitle(syl, t.code);
      return t;
    }).filter(Boolean).sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
  }, [messages, partners, user, syllabi]);

  const markRead = async (syllabusId) => {
    try { await messagesApi.markRead(syllabusId); } catch {}
    setMessages(ms => ms.map(m => m.syllabusId === syllabusId && m.receiverId === user?.id ? { ...m, isRead: true } : m));
  };

  const markNotificationRead = async (id) => {
    setNotifications(n => {
      const target = n.items.find(i => i.id === id);
      if (!target || target.isRead) return n;
      return { items: n.items.map(i => i.id === id ? { ...i, isRead: true } : i), unreadCount: Math.max(0, n.unreadCount - 1) };
    });
    try { await notificationsApi.markRead(id); } catch {}
  };

  const markAllNotificationsRead = async () => {
    setNotifications(n => ({ items: n.items.map(i => ({ ...i, isRead: true })), unreadCount: 0 }));
    try { await notificationsApi.readAll(); } catch {}
  };

  // Clicking a notification marks it read, then opens its chat or the page where the syllabus lives.
  const openNotification = (n) => {
    markNotificationRead(n.id);
    const target = notificationTarget(n, user.role);
    if (target.kind === 'chat') { setChatCode(target.id); markRead(target.id); return; }
    if (target.kind === 'comments') { setCommentCode(target.id); return; }
    setPage(target.page);
  };

  // Reading a syllabus's comments clears its badge now, and settles the bell's notifications about them.
  const clearCommentBadge = (id) => {
    setCommentCounts((c) => (c[id] && c[id].unread ? { ...c, [id]: { ...c[id], unread: 0 } } : c));
    commentNotificationIds(notifications.items, id).forEach((nid) => markNotificationRead(nid));
  };

  const deleteThread = (code) => setMessages(ms => ms.filter(m => m.syllabusId !== Number(code)));

  const sendMsg = async (syllabusId, text) => {
    try {
      await messagesApi.send(syllabusId, text);
      const msgs = await messagesApi.list(syllabusId);
      setMessages(ms => [...ms.filter(m => m.syllabusId !== syllabusId), ...msgs]);
    } catch (err) { console.error('Send failed:', err); }
  };

  const submitSyllabus = async (draft) => {
    try {
      const formData = new FormData();
      if (draft.file) formData.append('file', draft.file);
      formData.append('title', draft.title);
      formData.append('courseCode', draft.code);
      formData.append('curriculumId', draft.curriculumId || '');

      // Editing a syllabus (or re-entering the code of one of mine) saves a new version; the server picks the label.
      const existing = syllabi.find(s => s.id === draft.syllabusId) || syllabi.find(s => s.courseCode === draft.code && s.userId === user.id);
      if (existing) {
        if (!canEditSyllabus(user, existing)) { notify(editBlockedReason(existing) + '.'); return; }
        if (draft.note) formData.append('note', draft.note);
        const res = await syllabiApi.edit(existing.id, formData);
        notify(translateUI("ui.syllabus_saved_as_p0_60fc5d", { p0: (res.version) }));
      } else {
        await syllabiApi.create(formData);
        notify(translateUI("ui.syllabus_submitted_for_review_f317be"));
      }
      setEditing(null);
      await fetchSyllabi();
      setPage(user.role === 'faculty' ? 'my-syllabi' : 'repository');
    } catch (err) { notify(translateUI("ui.submit_failed_adb15a") + err.message); }
  };

  // The new builder has already saved the content and stored the version; this only refreshes and navigates.
  const handleBuilderSubmitted = async (res, wasExisting) => {
    notify(res.status === 'approved' ? translateUI('publication.published') : wasExisting ? translateUI("ui.syllabus_saved_as_p0_60fc5d", { p0: (res.version) }) : translateUI("ui.syllabus_submitted_for_review_f317be"));
    setEditing(null);
    await fetchSyllabi();
    setPage('my-syllabi');
  };

  const handleStatus = async (id, status, comment) => {
    try {
      const statusMap = { Approved: 'approved', 'For Revision': 'for_revision', Rejected: 'rejected', Submitted: 'submitted' };
      await syllabiApi.update(id, { status: statusMap[status] || status, adminComment: comment || '' });
      await fetchSyllabi();
      await fetchLogs();
      notify(translateUI("ui.syllabus_p0_bf213e", { p0: (tr(status)) }));
      return true;
    } catch (err) { notify(translateUI("ui.update_failed_f7b7c9") + err.message); return false; }
  };

  const handleDelete = async (id) => {
    const syllabus = syllabi.find(item => item.id === id);
    if (!syllabus || !canDeleteSyllabus(user, syllabus)) { notify(translateUI("ui.only_draft_syllabi_can_be_deleted_by_faculty_832244")); return; }
    try {
      await syllabiApi.remove(id);
      await fetchSyllabi();
      await fetchLogs();
      notify(translateUI("ui.syllabus_deleted_638a8c"));
    } catch (err) { notify(translateUI("ui.delete_failed_c834e9") + err.message); }
  };

  const clearLogs = () => { setLogs([]); notify(translateUI("ui.your_activity_list_was_cleared_642fa2")); };

  const isStudent = user?.role === 'student';
  const studentPage = isStudent ? (page === 'student-syllabi' ? page : 'student-dashboard') : page;
  const nav = navItems.filter(([, , , r]) => isStudent ? r === 'student' : !r || r === user?.role);

  if (loggingOut) return <div className="loading-screen" role="status" aria-live="polite" aria-busy="true"><div className="spinner" aria-hidden="true" /><p>{translateUI("ui.logging_out_3df779")}</p></div>;
  if (loading) return <div className="loading-screen"><div className="spinner" /><p>{translateUI("ui.loading_b04ba4")}</p></div>;
  if (!user) return <Login onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} />;
  if (user.mustChangePassword) return <ChangePassword user={user} onDone={() => setUser((u) => ({ ...u, mustChangePassword: false }))} onLogout={handleLogout} />;

  return (
    <div ref={languageShell} className="app-shell" data-sidebar-collapsed={sidebarCollapsed ? 'true' : 'false'}>
      {!narrow && <Sidebar page={studentPage} setPage={(p) => { if (NEW_BUILDER && p === 'builder') setEditing(null); setPage(p); }} nav={nav} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />}
      <main className="workspace">
        <Topbar page={studentPage} readOnly={isStudent} onLogout={handleLogout} user={user} syllabi={syllabi} onSearchSyllabus={(id) => { if (user.role === 'faculty') setPage('my-syllabi'); else setViewCode(id); }} onSearchFaculty={(name) => { setFacultyFocus(name); setPage('compliance'); }} onSearchSubject={() => setPage('courses')} unread={unread} threads={threads} msgDrop={msgDrop} setMsgDrop={setMsgDrop} setChatCode={setChatCode} markRead={markRead} notify={notify} onAvatarChange={handleAvatarChange} notifications={notifications} onOpenNotification={openNotification} onMarkAllNotificationsRead={markAllNotificationsRead} />
        {narrow && <MobileNav page={studentPage} setPage={(p) => { if (NEW_BUILDER && p === 'builder') setEditing(null); setPage(p); setMobileNavOpen(false); }} nav={nav} open={mobileNavOpen} onToggle={() => setMobileNavOpen(o => !o)} />}
        <div className="page-wrap">
          {isStudent && studentPage === 'student-dashboard' && <StudentDashboard user={user} setPage={setPage} setViewCode={setViewCode} />}
          {isStudent && studentPage === 'student-syllabi' && <StudentSyllabi setViewCode={setViewCode} />}
          {!isStudent && page === 'dashboard' && <Dashboard setPage={setPage} user={user} syllabi={syllabi} logs={logs} clearLogs={clearLogs} setConfirm={setConfirm} />}
          {page === 'builder' && ((NEW_BUILDER || user.role === 'admin')
            ? <SyllabusBuilderV2 key={editing ? editing.syllabusId : 'new'} editing={editing} user={user} notify={notify} setPage={setPage} onSubmitted={handleBuilderSubmitted} />
            : <SyllabusBuilder notify={notify} onSubmit={submitSyllabus} editing={editing} setEditing={setEditing} />)}
          {page === 'my-syllabi' && <MySyllabi syllabi={syllabi} user={user} messages={messages} commentCounts={commentCounts} setCommentCode={setCommentCode} setEditing={setEditing} setPage={setPage} setHistCode={setHistCode} setChatCode={setChatCode} handleDelete={handleDelete} setConfirm={setConfirm} notify={notify} />}
          {page === 'ai' && user.role === 'admin' && <AIChecker user={user} notify={notify} onApproved={async () => { await fetchSyllabi(); await fetchLogs(); notify(translateUI('publication.approvedRepository')); setEditing(null); setPage('repository'); }} onEditDraft={async id => { await syllabiApi.resumeDraft(id); setEditing({ syllabusId: id, status: 'draft' }); setPage('builder'); }} />}
          {page === 'review' && <ReviewApproval syllabi={syllabi} setViewCode={setViewCode} setPage={setPage} />}
          {page === 'repository' && <Repository syllabi={syllabi} user={user} notify={notify} setChatCode={setChatCode} setHistCode={setHistCode} />}
          {page === 'compliance' && <Compliance syllabi={syllabi} focus={facultyFocus} onClearFocus={() => setFacultyFocus('')} />}
          {page === 'analytics' && <Analytics syllabi={syllabi} user={user} notify={notify} setPage={setPage} />}
          {page === 'reports' && <Reports syllabi={syllabi} user={user} notify={notify} />}
          {page === 'users' && <UsersRoles notify={notify} onManageSubjects={() => setPage('courses')} />}
          {page === 'courses' && user.role === 'admin' && <CourseOutcomes notify={notify} onCatalogChanged={() => { fetchSyllabi(); fetchLogs(); fetchMessages(); fetchNotifications(); }} />}
          {page === 'settings' && <Settings user={user} notify={notify} onAvatarChange={handleAvatarChange} onProfileChange={handleProfileChange} language={language} languageBusy={languageBusy} onLanguageChange={changeLanguage} />}
        </div>
      </main>
      {toast && <div className="toast">{tr(toast)}</div>}
      {chatCode && <ChatModal code={chatCode} syllabi={syllabi} user={user} messages={messages} partner={partners[chatCode]} sendMsg={sendMsg} markRead={markRead} deleteThread={deleteThread} onClose={() => setChatCode(null)} />}
      {histCode && <VersionHistoryModal syllabus={syllabi.find(s => s.id === histCode)} onClose={() => setHistCode(null)} />}
      {commentCode && (
        <SyllabusCommentsModal syllabus={syllabi.find((s) => s.id === commentCode)} viewerId={user.id} onClose={() => setCommentCode(null)}
          onRead={(id) => { clearCommentBadge(id); }} onReply={(id) => { setCommentCode(null); setChatCode(id); markRead(id); }} />
      )}
      {viewCode && (() => {
        const open = syllabi.find((s) => s.id === viewCode);
        return (
          <SyllabusViewModal key={viewCode} syllabusId={viewCode} avatarUrl={open ? open.ownerAvatarUrl : null} onClose={() => setViewCode(null)}
            aside={open ? <ReviewPanel key={viewCode} syllabus={open} user={user} messages={messages} handleStatus={handleStatus} sendMsg={sendMsg} markRead={markRead} onDecided={() => setViewCode(null)} onHistory={() => setHistCode(viewCode)} onOpenChecker={() => { setViewCode(null); setPage('ai'); }} /> : null} />
        );
      })()}
      {confirm && <ConfirmModal {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}
