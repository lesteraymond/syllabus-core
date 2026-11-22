import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from './ui';
import { t as translateUI, tr } from '../i18n/index.js';
import { courses as coursesApi, users as usersApi } from '../lib/api';
import { searchAll, syllabusDestination } from '../lib/globalSearch';
import { isReviewer } from '../lib/roles';

const STATUS_LABELS = { draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review', for_revision: 'For Revision', approved: 'Approved', rejected: 'Rejected' };
const KIND_ICON = { syllabus: 'notebook', course: 'graduationCap', faculty: 'userCircle' };

// The top bar's search box: syllabi, courses (administrator), faculty and the pages of the side menu, with a results list under the box.
// It searches what the app already holds; the administrator's course catalog and user list are read once, the first time the box is used.
export default function GlobalSearch({ user, syllabi, nav, onOpenSyllabus, onGoPage, mobileOpen = false, onMobileClose }) {
  const id = useId();
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [catalog, setCatalog] = useState({ courses: [], users: [] });
  const asked = useRef(false);
  const isAdmin = user.role === 'admin';

  const loadCatalog = () => {
    if (!isAdmin || asked.current) return;
    asked.current = true;
    Promise.all([coursesApi.list().catch(() => []), usersApi.list().catch(() => [])])
      .then(([courses, users]) => setCatalog({ courses: Array.isArray(courses) ? courses : [], users: Array.isArray(users) ? users : [] }));
  };

  // Signing out and in as someone else must not show the previous person's catalog.
  useEffect(() => { asked.current = false; setCatalog({ courses: [], users: [] }); setQ(''); }, [user.id]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pages = useMemo(() => nav.map(([page, icon, label]) => ({ page, icon, label: tr(label) })), [nav]);
  const groups = useMemo(() => searchAll({ query: q, syllabi, courses: catalog.courses, users: catalog.users, pages, isAdmin }), [q, syllabi, catalog, pages, isAdmin]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const typed = q.trim().length > 0;
  const showList = open && typed;
  const current = Math.min(active, Math.max(flat.length - 1, 0));
  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => {
    if (!showList) return;
    document.getElementById(`${id}-opt-${current}`)?.scrollIntoView({ block: 'nearest' });
  }, [showList, current, id]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    loadCatalog();
    const idFocus = window.requestAnimationFrame(() => inputRef.current?.focus());
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target) && !e.target.closest?.('.mobile-search-btn')) onMobileClose?.();
    };
    const onKey = (e) => { if (e.key === 'Escape') onMobileClose?.(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { window.cancelAnimationFrame(idFocus); document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [mobileOpen, onMobileClose]);

  const close = () => { setOpen(false); setQ(''); onMobileClose?.(); };
  const choose = (item) => {
    if (!item) return;
    if (item.kind === 'faculty') { setQ(item.title); setOpen(true); inputRef.current?.focus(); return; } // shows that person's syllabi
    if (item.kind === 'syllabus') {
      const where = syllabusDestination(user, item.record, isReviewer(user.role));
      if (where === 'view') onOpenSyllabus(item.id); else onGoPage(where);
    } else if (item.kind === 'course') onGoPage('courses');
    else onGoPage(item.id);
    close();
    inputRef.current?.blur();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!flat.length) return;
      e.preventDefault();
      setOpen(true);
      setActive((i) => (Math.min(i, flat.length - 1) + (e.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      if (showList && flat.length) { e.preventDefault(); choose(flat[current]); }
    } else if (e.key === 'Escape') {
      if (showList) { e.preventDefault(); setOpen(false); } else if (typed) { e.preventDefault(); setQ(''); }
    }
  };

  let index = -1;
  return (
    <div className={'search global-search' + (mobileOpen ? ' is-mobile-open' : '')} ref={wrapRef} role="search">
      <Icon name="magnifyingGlass" size={18} />
      <input
        ref={inputRef} type="text" value={q} autoComplete="off" spellCheck={false}
        placeholder={translateUI('ui.search_syllabus_course_faculty_67a24a')} aria-label={translateUI('globalSearch.label')}
        role="combobox" aria-autocomplete="list" aria-expanded={showList} aria-controls={`${id}-list`}
        aria-activedescendant={showList && flat.length ? `${id}-opt-${current}` : undefined}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => { loadCatalog(); setOpen(true); }}
        onKeyDown={onKeyDown}
      />
      {typed && <button type="button" className="search-clear" aria-label={translateUI('globalSearch.clear')} title={translateUI('globalSearch.clear')} onClick={() => { setQ(''); inputRef.current?.focus(); }}><Icon name="xCircle" size={18} weight="fill" /></button>}
      {showList && (
        // mousedown must not move focus off the box, or the list would close before the click lands
        <div className="search-drop" id={`${id}-list`} role="listbox" aria-label={translateUI('globalSearch.results')} onMouseDown={(e) => e.preventDefault()}>
          {groups.length === 0 && <div className="search-empty"><strong>{translateUI('globalSearch.empty', { query: q.trim() })}</strong><span>{translateUI('globalSearch.emptyHint')}</span></div>}
          {groups.map((g) => (
            <div key={g.key} className="search-group" role="group" aria-labelledby={`${id}-g-${g.key}`}>
              <h4 id={`${id}-g-${g.key}`}>{translateUI(`globalSearch.group.${g.key}`)}</h4>
              {g.items.map((item) => {
                index += 1;
                const i = index;
                return (
                  <div key={item.key} id={`${id}-opt-${i}`} role="option" aria-selected={i === current} className={'search-item' + (i === current ? ' is-active' : '')} onMouseEnter={() => setActive(i)} onClick={() => choose(item)}>
                    <span className="search-ico" aria-hidden="true"><Icon name={item.kind === 'page' ? item.record.icon : KIND_ICON[item.kind]} size={20} weight="fill" /></span>
                    <span className="search-text">
                      <strong>{item.title}</strong>
                      {item.subtitle && item.kind !== 'page' && <span>{item.subtitle}</span>}
                      {item.meta && <small>{item.meta}</small>}
                      {item.kind === 'faculty' && item.count > 0 && <small>{translateUI('globalSearch.facultySyllabi', { count: item.count })}</small>}
                    </span>
                    {item.kind === 'syllabus' && item.status && <span className={`status ${item.status}`}>{tr(STATUS_LABELS[item.status] || item.status)}</span>}
                  </div>
                );
              })}
              {g.total > g.items.length && <small className="search-more">{translateUI('globalSearch.more', { count: g.total - g.items.length })}</small>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
