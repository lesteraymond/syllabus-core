import { useId } from 'react';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { Icon } from './ui';

// Mobile (< md) replacement for the sidebar: a full-width card showing the current page, which expands inline to the same `nav` list
// the sidebar uses and pushes the content down. Open/closed state is owned by the parent layout (App).
export default function MobileNav({ page, setPage, nav, open, onToggle }) {
  const panelId = useId();
  const current = nav.find(([key]) => key === page) || nav[0];
  return (
    <div className="mnav" data-open={open ? 'true' : 'false'}>
      <button type="button" className="mnav-card" onClick={onToggle} aria-expanded={open} aria-controls={panelId}>
        <span className="mnav-tile" aria-hidden="true"><Icon name={current[1]} size={22} /></span>
        <span className="mnav-heading"><strong className="mnav-title">{tr(current[2])}</strong><small>{translateUI("ui.syllabus_management_system_e49cab")}</small></span>
        <svg className="mnav-chevron" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      <div className="mnav-panel" id={panelId} inert={!open}>
        <nav className="mnav-list" aria-label={translateUI("ui.main_navigation_efd197")}>
          {nav.map(([key, icon, label]) => (
            <button key={key} type="button" className={page === key ? 'active' : ''} onClick={() => setPage(key)} aria-current={page === key ? 'page' : undefined}>
              <span className="nav-icon" aria-hidden="true"><Icon name={icon} size={22} /></span>
              <span>{tr(label)}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
