import { useEffect, useMemo, useState, useCallback } from 'react';
import ChatModal from './components/ChatModal';
import ConfirmModal from './components/ConfirmModal';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import VersionHistoryModal from './components/VersionHistoryModal';
import { navItems } from './data/initialData';
import StudentHome from './views/StudentHome';
import { auth, syllabi as syllabiApi, logs as logsApi, messages as messagesApi, notifications as notificationsApi } from './lib/api';
import { useNotificationPolling } from './lib/usePolling';
import { canEditSyllabus, editBlockedReason } from './lib/syllabusRules';
import { fmt } from './lib/utils';
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
import SyllabusBuilder from './views/SyllabusBuilder';
import SyllabusBuilderV2 from './views/builder2';
import UsersRoles from './views/UsersRoles';

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
  const [toast, setToast] = useState('');
  const [syllabi, setSyllabi] = useState([]);
  const [logs, setLogs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [editing, setEditing] = useState(null);
  const [chatCode, setChatCode] = useState(null);
  const [histCode, setHistCode] = useState(null);
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

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationsApi.list();
      setNotifications({ items: data.notifications, unreadCount: data.unreadCount });
    } catch (err) { console.error('Failed to fetch notifications:', err); }
  }, []);

  useEffect(() => {
    if (user && user.role !== 'student') {
      fetchSyllabi();
      fetchLogs();
      fetchMessages();
      fetchNotifications();
    }
  }, [user, fetchSyllabi, fetchLogs, fetchMessages, fetchNotifications]);

  // Keep messages and notifications fresh without a reload (only polls while the tab is visible).
  // A draft created in the builder is not in this list yet: refresh when the faculty opens My Syllabi.
  useEffect(() => { if (user && user.role !== 'student' && page === 'my-syllabi') fetchSyllabi(); }, [user, page, fetchSyllabi]);

  useNotificationPolling(!!user && user.role !== 'student', () => { fetchMessages(); fetchNotifications(); fetchSyllabi(); });

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
    if (n.type === 'message' && n.syllabusId) { setChatCode(n.syllabusId); markRead(n.syllabusId); return; }
    setPage(user.role === 'admin' ? 'review' : 'my-syllabi');
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
    } catch (err) { notify('Update failed: ' + err.message); }
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
          {page === 'my-syllabi' && <MySyllabi syllabi={syllabi} user={user} messages={messages} setEditing={setEditing} setPage={setPage} setHistCode={setHistCode} setChatCode={setChatCode} handleDelete={handleDelete} setConfirm={setConfirm} notify={notify} />}
          {page === 'ai' && <AIChecker syllabi={syllabi} user={user} notify={notify} />}
          {page === 'mapping' && <COPOMapping notify={notify} />}
          {page === 'review' && <ReviewApproval syllabi={syllabi} handleStatus={handleStatus} user={user} messages={messages} setChatCode={setChatCode} markRead={markRead} setHistCode={setHistCode} />}
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
      {confirm && <ConfirmModal {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}
