// Collapse state is owned by the parent layout (App). The sidebar only reflects it
// through `data-collapsed`; every label stays mounted and is hidden with CSS only.
import { Icon } from './ui';

export default function Sidebar({ page, setPage, nav, collapsed, onToggle }) {
  return (
    <aside className="sidebar" data-collapsed={collapsed ? 'true' : 'false'} aria-label="Main navigation">
      <div className="side-brand">
        <button
          type="button"
          className="side-toggle"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {/* Hamburger menu icon (same shape as Lucide's "Menu") */}
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
        <img className="side-logo" src="/cite-logo.png" alt="CICT logo" />
        <strong className="side-title">SMS</strong>
      </div>
      <nav>
        {nav.map(([key, icon, label]) => (
          <button
            key={key}
            className={page === key ? 'active' : ''}
            onClick={() => setPage(key)}
            aria-label={label}
            aria-current={page === key ? 'page' : undefined}
            title={collapsed ? label : undefined}
          >
            <span className="nav-icon" aria-hidden="true"><Icon name={icon} size={22} /></span>
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
