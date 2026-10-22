// Development-only visual fixture. APIs are replaced in memory; no real account is changed.
import React, { useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import Settings from '../src/views/Settings';
import Sidebar from '../src/components/Sidebar';
import Topbar from '../src/components/Topbar';
import Dashboard from '../src/views/DashboardView';
import { adminSettings } from '../src/lib/api';
import { navItems } from '../src/data/initialData';
import { createLanguagePreference } from '../src/i18n/preference';
import { getLanguage, subscribeLanguage, setLanguage } from '../src/i18n';
import '../src/tailwind.css'; // styles.css uses @apply, so it is loaded through the entry that defines the utilities
const config = { template: 'Undergraduate Syllabus v4', academicYear: '2026–2027', department: 'College of Information Technology and Engineering', aiChecking: true, strictValidation: false, emailNotifications: true };
adminSettings.get = async () => ({ settings: config });
adminSettings.save = async settings => ({ settings });
function Preview() {
  const [role, setRole] = useState('faculty');
  const [page, setPage] = useState('settings');
  const [width, setWidth] = useState('wide');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const failed = useRef(false);
  const language = useSyncExternalStore(subscribeLanguage, getLanguage);
  const controller = useRef(null);
  if (!controller.current) {
    controller.current = createLanguagePreference({ apply: setLanguage, persist: async preferredLanguage => {
      if (failed.current) { failed.current = false; throw new Error('Could not save your language preference. Please try again.'); }
      return { preferredLanguage };
    }, onSaved: () => {} });
    controller.current.reset(1, 'en');
  }
  const user = { id: 1, role, email: 'preview@example.invalid', firstName: 'Preview', lastName: 'User', name: 'Preview User', initials: 'PU' };
  return <>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12, background: '#fff', borderBottom: '1px solid #ddd' }}>
      <button type="button" onClick={() => setRole(value => value === 'faculty' ? 'admin' : 'faculty')}>Preview role: {role}</button>
      <button type="button" onClick={() => setWidth(value => value === 'wide' ? 'narrow' : 'wide')}>Preview width: {width}</button>
      <button type="button" onClick={() => { failed.current = true; }}>Fail next preference save</button>
    </div>
    <div style={{ width: width === 'narrow' ? 390 : '100%', maxWidth: '100%', margin: '0 auto' }}>
      <div className="app-shell" data-sidebar-collapsed="false" style={width === 'narrow' ? { display: 'block' } : undefined}>
        {width === 'wide' && <Sidebar page={page} setPage={setPage} nav={navItems.filter(([, , , r]) => !r || r === role)} collapsed={false} onToggle={() => {}} />}
        <main className="workspace" style={width === 'narrow' ? { marginLeft: 0, width: '100%' } : undefined}>
          {width === 'wide' && <Topbar page={page} user={user} onLogout={() => {}} unread={0} threads={[]} msgDrop={false} setMsgDrop={() => {}} setChatCode={() => {}} markRead={() => {}} notify={setToast} onAvatarChange={() => {}} notifications={{ items: [], unreadCount: 0 }} />}
          <div className="page-wrap" style={width === 'narrow' ? { padding: 16 } : undefined}>
            {page === 'settings' ? <Settings user={user} notify={setToast} onAvatarChange={() => {}} onProfileChange={() => {}} language={language} languageBusy={busy} onLanguageChange={async next => { setBusy(true); try { await controller.current.change(next); } finally { setBusy(false); } }} /> : <Dashboard user={user} syllabi={[]} logs={[]} setPage={setPage} clearLogs={() => {}} setConfirm={() => {}} />}
          </div>
        </main>
      </div>
    </div>
    {toast && <div className="toast">{toast}</div>}
  </>;
}
createRoot(document.getElementById('root')).render(<Preview />);
