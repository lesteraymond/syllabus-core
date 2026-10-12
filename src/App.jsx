import { useEffect, useMemo, useState, useCallback } from 'react';
import ChatModal from './components/ChatModal';
import ConfirmModal from './components/ConfirmModal';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import VersionHistoryModal from './components/VersionHistoryModal';
import { navItems } from './data/initialData';
import { auth, syllabi as syllabiApi, logs as logsApi, messages as messagesApi } from './lib/api';
import { bumpVer, fmt } from './lib/utils';
import AIChecker from './views/AIChecker';
import Analytics from './views/Analytics';
import COPOMapping from './views/COPOMapping';
import Compliance from './views/Compliance';
import Dashboard from './views/DashboardView';
import MySyllabi from './views/MySyllabi';
import Reports from './views/Reports';
import Repository from './views/Repository';
import ReviewApproval from './views/ReviewApproval';
import Settings from './views/Settings';
import SyllabusBuilder from './views/SyllabusBuilder';
import UsersRoles from './views/UsersRoles';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
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

  const notify = (m) => { setToast(m); window.clearTimeout(window.__scmsToast); window.__scmsToast = window.setTimeout(() => setToast(''), 2400); };

  const formatUser = (u) => ({
    ...u,
    name: `${u.firstName} ${u.lastName}`,
    initials: `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`,
    dept: 'CITE',
  });

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
      const all = [];
      for (const s of syllabi) {
        try {
          const msgs = await messagesApi.list(s.id);
          all.push(...msgs);
        } catch {}
      }
      setMessages(all);
    } catch (err) { console.error('Failed to fetch messages:', err); }
  }, [syllabi]);

  useEffect(() => {
    if (user) {
      fetchSyllabi();
      fetchLogs();
    }
  }, [user, fetchSyllabi, fetchLogs]);

  useEffect(() => {
    if (user && syllabi.length > 0) fetchMessages();
  }, [user, syllabi, fetchMessages]);

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

  const handleLogout = async () => {
    try { await auth.logout(); } catch {}
    setUser(null);
    setSyllabi([]);
    setLogs([]);
    setMessages([]);
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
      t.title = syl ? `${syl.courseCode} • ${syl.title}` : `Syllabus #${t.code}`;
      return t;
    }).sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
  }, [messages, user, syllabi]);

  const markRead = async (syllabusId) => {
    try { await messagesApi.markRead(syllabusId); } catch {}
    setMessages(ms => ms.map(m => m.syllabusId === syllabusId && m.receiverId === user?.id ? { ...m, isRead: true } : m));
  };

  const deleteThread = (code) => setMessages(ms => ms.filter(m => m.syllabusId !== Number(code)));

  const sendMsg = async (syllabusId, text) => {
    const syl = syllabi.find(s => s.id === syllabusId);
    const receiverId = user.role === 'admin' ? (syl?.userId || 2) : 1;
    try {
      await messagesApi.send(syllabusId, receiverId, text);
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

      const existing = syllabi.find(s => s.courseCode === draft.code && s.userId === user.id);
      if (existing) {
        await syllabiApi.update(existing.id, { title: draft.title, courseCode: draft.code, status: 'submitted', version: bumpVer(existing.version) });
        notify('Syllabus resubmitted for review.');
      } else {
        await syllabiApi.create(formData);
        notify('Syllabus submitted for review.');
      }
      await fetchSyllabi();
      setPage(user.role === 'faculty' ? 'my-syllabi' : 'repository');
    } catch (err) { notify('Submit failed: ' + err.message); }
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
  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} nav={nav} user={user} onLogout={handleLogout} />
      <main className="workspace">
        <Topbar page={page} onLogout={handleLogout} user={user} unread={unread} threads={threads} msgDrop={msgDrop} setMsgDrop={setMsgDrop} setChatCode={setChatCode} markRead={markRead} />
        <div className="page-wrap">
          {page === 'dashboard' && <Dashboard setPage={setPage} user={user} syllabi={syllabi} logs={logs} clearLogs={clearLogs} setConfirm={setConfirm} />}
          {page === 'builder' && <SyllabusBuilder notify={notify} onSubmit={submitSyllabus} editing={editing} setEditing={setEditing} />}
          {page === 'my-syllabi' && <MySyllabi syllabi={syllabi} user={user} messages={messages} setEditing={setEditing} setPage={setPage} setHistCode={setHistCode} setChatCode={setChatCode} handleDelete={handleDelete} setConfirm={setConfirm} notify={notify} />}
          {page === 'ai' && <AIChecker syllabi={syllabi} user={user} notify={notify} />}
          {page === 'mapping' && <COPOMapping notify={notify} />}
          {page === 'review' && <ReviewApproval syllabi={syllabi} handleStatus={handleStatus} user={user} messages={messages} setChatCode={setChatCode} markRead={markRead} setHistCode={setHistCode} />}
          {page === 'repository' && <Repository syllabi={syllabi} user={user} notify={notify} setChatCode={setChatCode} setHistCode={setHistCode} />}
          {page === 'compliance' && <Compliance syllabi={syllabi} />}
          {page === 'analytics' && <Analytics syllabi={syllabi} user={user} />}
          {page === 'reports' && <Reports syllabi={syllabi} user={user} notify={notify} />}
          {page === 'users' && <UsersRoles notify={notify} />}
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
