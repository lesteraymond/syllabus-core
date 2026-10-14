import { useCallback, useEffect, useMemo, useState } from 'react';
import ChatModal from './components/ChatModal';
import ConfirmModal from './components/ConfirmModal';
import ChangePassword from './components/ChangePassword';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import SyllabusCommentsModal from './components/SyllabusCommentsModal';
import SyllabusViewModal from './components/SyllabusViewModal';
import Topbar from './components/Topbar';
import VersionHistoryModal from './components/VersionHistoryModal';
import ReviewPanel from './views/ReviewPanel';
import { navItems } from './data/initialData';
import { auth, logs as logsApi, messages as messagesApi, notifications as notificationsApi, syllabi as syllabiApi, onPasswordChangeRequired } from './lib/api';
import { commentNotificationIds, notificationTarget } from './lib/notificationRoute';
import { canEditSyllabus, editBlockedReason } from './lib/syllabusRules';
import { useNotificationPolling } from './lib/usePolling';
import AIChecker from './views/AIChecker';
import Analytics from './views/Analytics';
import COPOMapping from './views/COPOMapping';
import Compliance from './views/Compliance';
import CourseOutcomes from './views/CourseOutcomes';
import Dashboard from './views/DashboardView';
import MySyllabi from './views/MySyllabi';
import Reports from './views/Reports';
import Repository from './views/Repository';
import ReviewApproval from './views/ReviewApproval';
import Settings from './views/Settings';
import StudentHome from './views/StudentHome';
import SyllabusBuilder from './views/SyllabusBuilder';
import UsersRoles from './views/UsersRoles';
import SyllabusBuilderV2 from './views/builder2';

// The rebuilt syllabus builder (src/views/builder2) is behind a flag until it is approved: the current builder stays
// the default. Set VITE_NEW_BUILDER=true in .env to use the rebuilt one.
const NEW_BUILDER = import.meta.env.VITE_NEW_BUILDER === 'true';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Read synchronously so the first paint already has the saved width (no layout shift).
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sms_sidebar_collapsed') === 'true'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('sms_sidebar_collapsed', String(sidebarCollapsed)); } catch {}
  }, [sidebarCollapsed]);
  const [page, setPage] = useState('dashboard');
  // The compliance check moved into step 7 of the builder: an old 'ai' link sends faculty there, and only admins have the overview.
  useEffect(() => { if (user && user.role !== 'admin' && page === 'ai') setPage(user.role === 'faculty' ? 'builder' : 'dashboard'); }, [user, page]);
  const [toast, setToast] = useState('');
  const [syllabi, setSyllabi] = useState([]);
  const [logs, setLogs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [editing, setEditing] = useState(null);
  const [chatCode, setChatCode] = useState(null);
  const [histCode, setHistCode] = useState(null);
  const [viewCode, setViewCode] = useState(null); // the syllabus open in the reviewer's window
  const [commentCode, setCommentCode] = useState(null); // the syllabus whose reviewer comments a faculty member is reading
  const [commentCounts, setCommentCounts] = useState({}); // { [syllabusId]: { total, unread } } for a faculty member's syllabi
  const [confirm, setConfirm] = useState(null);
  const [msgDrop, setMsgDrop] = useState(false);
  const [notifications, setNotifications] = useState({ items: [], unreadCount: 0 });

  const notify = (m) => { setToast(m); window.clearTimeout(window.__scmsToast); window.__scmsToast = window.setTimeout(() => setToast(''), 2400); };

  const formatUser = (u) => ({
    ...u,
    name: `${u.firstName} ${u.lastName}`,
    initials: `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`,
    dept: 'CITE',
  });

  const handleAvatarChange = (avatarUrl) => setUser(u => ({ ...u, avatarUrl }));

  useEffect(() => {
    onPasswordChangeRequired(() => setUser(u => (u && !u.mustChangePassword ? { ...u, mustChangePassword: true } : u))); // a call was refused: show the screen
    auth.me().then(data => {
      setUser(formatUser(data.user));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const fetchSyllabi = useCallback(async () => {
    try {
      const data = await syllabiApi.list();
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
      setMessages(await messagesApi.listMine());
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
  useEffect(() => { if (user && page === 'my-syllabi') { fetchSyllabi(); if (user.role === 'faculty') fetchCommentCounts(); } }, [user, page, fetchSyllabi, fetchCommentCounts]);

  useNotificationPolling(!!user && !user.mustChangePassword, () => { fetchMessages(); fetchNotifications(); fetchSyllabi(); if (user.role === 'faculty') fetchCommentCounts(); });

  const handleLogin = async (email, pass, remember) => {
    try {
      const data = await auth.login(email, pass, remember);
      setUser(formatUser(data.user));
      setPage('dashboard');
      return null;
    } catch (err) {
      return err.message || 'Invalid email or password.';
    }
  };

  const handleGoogleLogin = async (idToken) => {
    try {
      const data = await auth.google(idToken);
      setUser(formatUser(data.user));
      setPage('dashboard');
      return null;
    } catch (err) {
      return err.message || 'Google sign-in failed.';
    }
  };

  const handleLogout = async () => {
    try { await auth.logout(); } catch {}
    setUser(null);
    setSyllabi([]);
    setLogs([]);
    setMessages([]);
    setNotifications({ items: [], unreadCount: 0 });
    setPage('dashboard');
    setEditing(null);
    setChatCode(null);
    setMsgDrop(false);
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
      const other = t.msgs.find(m => m.senderId !== user.id);
      const initialsOf = (n) => n?.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
      t.partner = other
        ? { name: other.sender, initials: initialsOf(other.sender), avatarUrl: other.senderAvatarUrl }
        : (user.role === 'admin' && syl ? { name: syl.faculty, initials: initialsOf(syl.faculty), avatarUrl: syl.ownerAvatarUrl } : null);
      t.title = syl ? `${syl.courseCode} • ${syl.title}` : `Syllabus #${t.code}`;
      return t;
    }).sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
  }, [messages, user, syllabi]);

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
        notify(`Syllabus saved as ${res.version}.`);
      } else {
        await syllabiApi.create(formData);
        notify('Syllabus submitted for review.');
      }
      setEditing(null);
      await fetchSyllabi();
      setPage(user.role === 'faculty' ? 'my-syllabi' : 'repository');
    } catch (err) { notify('Submit failed: ' + err.message); }
  };

  // The new builder has already saved the content and stored the version; this only refreshes and navigates.
  const handleBuilderSubmitted = async (res, wasExisting) => {
    notify(wasExisting ? `Syllabus saved as ${res.version}.` : 'Syllabus submitted for review.');
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
      notify(`Syllabus ${status.toLowerCase()}.`);
      return true;
    } catch (err) { notify('Update failed: ' + err.message); return false; }
  };

  const handleDelete = async (id) => {
    try {
      await syllabiApi.remove(id);
      await fetchSyllabi();
      await fetchLogs();
      notify('Syllabus deleted.');
    } catch (err) { notify('Delete failed: ' + err.message); }
  };

  const clearLogs = () => { setLogs([]); notify('Activity logs cleared.'); };

  const nav = navItems.filter(([, , , r]) => !r || r === user?.role);

  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading...</p></div>;
  if (!user) return <Login onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} />;
  if (user.mustChangePassword) return <ChangePassword user={user} onDone={() => setUser((u) => ({ ...u, mustChangePassword: false }))} onLogout={handleLogout} />;
  if (user.role === 'student') return <StudentHome user={user} onLogout={handleLogout} />;

  return (
    <div className="app-shell" data-sidebar-collapsed={sidebarCollapsed ? 'true' : 'false'}>
      <Sidebar page={page} setPage={(p) => { if (NEW_BUILDER && p === 'builder') setEditing(null); setPage(p); }} nav={nav} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />
      <main className="workspace">
        <Topbar page={page} onLogout={handleLogout} user={user} unread={unread} threads={threads} msgDrop={msgDrop} setMsgDrop={setMsgDrop} setChatCode={setChatCode} markRead={markRead} notify={notify} onAvatarChange={handleAvatarChange} notifications={notifications} onOpenNotification={openNotification} onMarkAllNotificationsRead={markAllNotificationsRead} />
        <div className="page-wrap">
          {page === 'dashboard' && <Dashboard setPage={setPage} user={user} syllabi={syllabi} logs={logs} clearLogs={clearLogs} setConfirm={setConfirm} />}
          {page === 'builder' && (NEW_BUILDER
            ? <SyllabusBuilderV2 key={editing ? editing.syllabusId : 'new'} editing={editing} user={user} notify={notify} setPage={setPage} onSubmitted={handleBuilderSubmitted} />
            : <SyllabusBuilder notify={notify} onSubmit={submitSyllabus} editing={editing} setEditing={setEditing} />)}
          {page === 'my-syllabi' && <MySyllabi syllabi={syllabi} user={user} messages={messages} commentCounts={commentCounts} setCommentCode={setCommentCode} setEditing={setEditing} setPage={setPage} setHistCode={setHistCode} setChatCode={setChatCode} handleDelete={handleDelete} setConfirm={setConfirm} notify={notify} />}
          {page === 'ai' && user.role === 'admin' && <AIChecker user={user} notify={notify} />}
          {page === 'mapping' && <COPOMapping notify={notify} />}
          {page === 'review' && <ReviewApproval syllabi={syllabi} setViewCode={setViewCode} />}
          {page === 'repository' && <Repository syllabi={syllabi} user={user} notify={notify} setChatCode={setChatCode} setHistCode={setHistCode} />}
          {page === 'compliance' && <Compliance syllabi={syllabi} />}
          {page === 'analytics' && <Analytics syllabi={syllabi} user={user} />}
          {page === 'reports' && <Reports syllabi={syllabi} user={user} notify={notify} />}
          {page === 'users' && <UsersRoles notify={notify} onManageSubjects={() => setPage('courses')} />}
          {page === 'courses' && <CourseOutcomes notify={notify} />}
          {page === 'settings' && <Settings notify={notify} />}
        </div>
      </main>
      {toast && <div className="toast">{toast}</div>}
      {chatCode && <ChatModal code={chatCode} syllabi={syllabi} user={user} messages={messages} sendMsg={sendMsg} markRead={markRead} deleteThread={deleteThread} onClose={() => setChatCode(null)} />}
      {histCode && <VersionHistoryModal syllabus={syllabi.find(s => s.id === histCode)} onClose={() => setHistCode(null)} />}
      {commentCode && (
        <SyllabusCommentsModal syllabus={syllabi.find((s) => s.id === commentCode)} viewerId={user.id} onClose={() => setCommentCode(null)}
          onRead={(id) => { clearCommentBadge(id); }} onReply={(id) => { setCommentCode(null); setChatCode(id); markRead(id); }} />
      )}
      {viewCode && (() => {
        const open = syllabi.find((s) => s.id === viewCode);
        return (
          <SyllabusViewModal key={viewCode} syllabusId={viewCode} avatarUrl={open ? open.ownerAvatarUrl : null} onClose={() => setViewCode(null)}
            aside={open ? <ReviewPanel key={viewCode} syllabus={open} user={user} messages={messages} handleStatus={handleStatus} sendMsg={sendMsg} markRead={markRead} onDecided={() => setViewCode(null)} onHistory={() => setHistCode(viewCode)} /> : null} />
        );
      })()}
      {confirm && <ConfirmModal {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}
