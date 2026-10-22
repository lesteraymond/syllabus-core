import { useId } from 'react';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
// Collapse state is owned by the parent layout (App). The sidebar only reflects it
// through `data-collapsed`; every label stays mounted and is hidden with CSS only.
import { Icon } from './ui';

export default function Sidebar({ page, setPage, nav, collapsed, onToggle }) {
  const navigationId = useId();
  return (
    <aside className="sidebar" data-collapsed={collapsed ? 'true' : 'false'} aria-label={translateUI("ui.main_navigation_efd197")}>
      <div className="side-brand">
        <button
          type="button"
          className="side-toggle"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-controls={navigationId}
          aria-label={collapsed ? translateUI("ui.expand_sidebar_f462e8") : translateUI("ui.collapse_sidebar_9e6876")}
          title={collapsed ? translateUI("ui.expand_sidebar_f462e8") : translateUI("ui.collapse_sidebar_9e6876")}
        >
          {/* Hamburger menu icon (same shape as Lucide's "Menu") */}
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
        <img className="side-logo" src="/cite-logo.png" alt={translateUI("ui.cict_logo_dee290")} />
        <strong className="side-title">{translateUI("ui.cite_brand_5b2e91")}</strong>
      </div>
      <div className="sidebar-nav-scroll scrollbar-hidden">
      <nav id={navigationId}>
        {nav.map(([key, icon, label]) => (
          <button
            key={key}
            className={page === key ? 'active' : ''}
            onClick={() => setPage(key)}
            aria-label={tr(label)}
            aria-current={page === key ? 'page' : undefined}
            title={tr(label)}
          >
            <span className="nav-icon" aria-hidden="true"><Icon name={icon} size={22} /></span>
            <span className="nav-label" aria-hidden={collapsed}>{tr(label)}</span>
          </button>
        ))}
      </nav>
      </div>
    </aside>
  );
}
