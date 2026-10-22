import { t as translateUI } from "../i18n/index.js";
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './ui';
import { searchAll } from '../lib/searchView';
import { syllabi as syllabiApi } from '../lib/api';

// The search box in the top bar. It looks in the syllabi the app already holds (a student's approved repository is read on first use) and
// a pick takes the reader to the result: onSyllabus(id), onFaculty(name), onSubject(code). Arrow keys move, Enter opens, Escape closes.
export default function GlobalSearch({ role, syllabi, onSyllabus, onFaculty, onSubject }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [repo, setRepo] = useState(null);
  const box = useRef(null);

  useEffect(() => {
    if (role !== 'student' || !open || repo) return undefined;
    let live = true;
    syllabiApi.repository().then((rows) => { if (live) setRepo(Array.isArray(rows) ? rows : []); }, () => { if (live) setRepo([]); });
    return () => { live = false; };
  }, [role, open, repo]);
  useEffect(() => {
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const found = useMemo(() => searchAll(q, role === 'student' ? (repo || []) : syllabi, { role }), [q, role, repo, syllabi]);
  const items = useMemo(() => [
    ...found.syllabi.map((x) => ({ key: 's' + x.id, group: 'syllabi', x })),
    ...found.faculty.map((x) => ({ key: 'f' + (x.userId ?? x.name), group: 'faculty', x })),
    ...found.subjects.map((x) => ({ key: 'c' + x.code, group: 'subjects', x })),
  ], [found]);
  useEffect(() => { setActive(0); }, [q]);

  const pick = (item) => {
    if (!item) return;
    if (item.group === 'syllabi') onSyllabus(item.x.id);
    else if (item.group === 'faculty') onFaculty(item.x.name);
    else onSubject(item.x.code);
    setQ(''); setOpen(false);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { setOpen(false); e.currentTarget.blur(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(items[active]); }
  };

  const label = (group, x) => (group === 'syllabi'
    ? <><strong>{x.code}</strong><span>{x.title}</span>{x.faculty && <small>{x.faculty}</small>}</>
    : group === 'faculty'
      ? <><strong>{x.name}</strong><small>{translateUI("search.syllabi_count", { p0: x.count })}</small></>
      : <><strong>{x.code}</strong><span>{x.title}</span></>);
  const groups = [['syllabi', "search.syllabi"], ['faculty', "search.faculty"], ['subjects', "search.subjects"]];
  const trimmed = q.trim();

  return (
    <div className="search" ref={box}>
      <Icon name="magnifyingGlass" size={18} />
      <input
        value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
        placeholder={translateUI("ui.search_syllabus_course_faculty_67a24a")} role="combobox" aria-expanded={open && !!trimmed} aria-controls="global-search-list" aria-autocomplete="list" />
      {open && trimmed && (
        <div className="search-pop" id="global-search-list" role="listbox">
          {items.length === 0 && <p className="search-none">{translateUI("search.none", { p0: trimmed })}</p>}
          {groups.map(([group, key]) => {
            const rows = items.filter((i) => i.group === group);
            return rows.length ? (
              <div key={group}>
                <p className="search-group">{translateUI(key)}</p>
                {rows.map((i) => (
                  <button type="button" key={i.key} role="option" aria-selected={items[active] === i} className="search-opt" onMouseEnter={() => setActive(items.indexOf(i))} onClick={() => pick(i)}>{label(group, i.x)}</button>
                ))}
              </div>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
