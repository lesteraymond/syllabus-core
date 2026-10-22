import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { courses as coursesApi } from '../../lib/api';
import { t as translateUI } from '../../i18n/index.js';
import { parsePrereq, composePrereq, labelOf } from '../../lib/prereqText';

// Pre-requisite (IV) as a dropdown with checkboxes: "None", the year standings, and every subject of the chosen program. Several can be
// picked. The syllabus keeps plain text ("IT 202 – Computer Programming 1; 3rd Yr"), the way the form prints it, so anything the author wrote earlier that is not in
// the list stays selected under "As already written" until they untick it. The subjects come from GET /api/courses/:id (programSubjects).
const STANDINGS = ['2nd Yr', '3rd Yr', '4th Yr'];
const NONE = 'None';
const seen = new Map(); // subject id -> its program's other subjects

const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const isNone = (x) => same(x, NONE);

export default function PrereqPicker({ value, onChange, courseId }) {
  const [subjects, setSubjects] = useState(() => (courseId && seen.get(courseId)) || null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [box, setBox] = useState(null);
  const trigger = useRef(null);
  const panel = useRef(null);

  useEffect(() => {
    if (!courseId) { setSubjects(null); return undefined; }
    if (seen.has(courseId)) { setSubjects(seen.get(courseId)); return undefined; }
    let live = true;
    coursesApi.get(courseId).then((c) => { const list = Array.isArray(c.programSubjects) ? c.programSubjects : []; seen.set(courseId, list); if (live) setSubjects(list); }, () => { if (live) setSubjects([]); });
    return () => { live = false; };
  }, [courseId]);

  const tokens = useMemo(() => parsePrereq(value, subjects || []), [value, subjects]);
  const picked = tokens.filter((x) => !isNone(x));
  const isSubject = (x, s) => same(x, labelOf(s)) || same(x, s.code); // the full "code – name", or the bare code an older text used
  const chosen = (v) => picked.some((x) => same(x, v));
  const subjectChosen = (s) => picked.some((x) => isSubject(x, s));
  const none = tokens.some(isNone) && !picked.length;
  const known = (x) => STANDINGS.some((y) => same(x, y)) || (subjects || []).some((s) => isSubject(x, s));
  const written = picked.filter((x) => !known(x));

  const commit = (list) => onChange(composePrereq(list));
  const toggle = (v) => commit(chosen(v) ? picked.filter((x) => !same(x, v)) : [...picked, v]);
  const toggleSubject = (s) => commit(subjectChosen(s) ? picked.filter((x) => !isSubject(x, s)) : [...picked, labelOf(s)]);
  const pickNone = () => onChange(NONE);

  const place = () => {
    const r = trigger.current && trigger.current.getBoundingClientRect();
    if (r) setBox({ left: r.left, top: r.bottom + 4, width: r.width, above: window.innerHeight - r.bottom < 260 && r.top > 300, bottom: window.innerHeight - r.top + 4 });
  };
  useLayoutEffect(() => { if (open) place(); }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!panel.current?.contains(e.target) && !trigger.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    window.addEventListener('resize', close);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); window.removeEventListener('resize', close); };
  }, [open]);

  const word = q.trim().toLowerCase();
  const shown = (subjects || []).filter((s) => !word || (s.code + ' ' + s.title).toLowerCase().includes(word));
  const standings = STANDINGS.filter((x) => !word || x.toLowerCase().includes(word));
  const label = none ? NONE : String(value || '').trim();

  const row = (key, v, text) => (
    <label className="prereq-opt" key={key}><input type="checkbox" checked={chosen(v)} onChange={() => toggle(v)} /><span><strong>{text}</strong></span></label>
  );
  const subjectRow = (s) => (
    <label className="prereq-opt" key={'s' + s.id}><input type="checkbox" checked={subjectChosen(s)} onChange={() => toggleSubject(s)} /><span><strong>{s.code}</strong><small>{s.title}</small></span></label>
  );

  return (
    <>
      <button type="button" ref={trigger} className="prereq-trigger" disabled={!courseId} aria-haspopup="true" aria-expanded={open} onClick={() => { setQ(''); setOpen((o) => !o); }}>
        <span className={label ? '' : 'muted'}>{courseId ? (label || translateUI('prereq.placeholder')) : translateUI('prereq.need_subject')}</span>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && box && createPortal(
        <div className="prereq-pop" ref={panel} role="group" aria-label={translateUI('ui.pre_requisite_d4ec8c')} style={{ left: box.left, width: Math.max(box.width, 280), ...(box.above ? { bottom: box.bottom } : { top: box.top }) }}>
          <input className="prereq-search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={translateUI('prereq.search')} aria-label={translateUI('prereq.search')} />
          <div className="prereq-list">
            {!word && <label className="prereq-opt"><input type="checkbox" checked={none} onChange={pickNone} /><span><strong>{translateUI('prereq.none')}</strong></span></label>}
            {written.length > 0 && !word && <><p className="prereq-group">{translateUI('prereq.written')}</p>{written.map((x) => row('w' + x, x, x))}</>}
            {standings.length > 0 && <><p className="prereq-group">{translateUI('prereq.standing')}</p>{standings.map((x) => row('y' + x, x, x))}</>}
            <p className="prereq-group">{translateUI('prereq.subjects')}</p>
            {subjects === null && <p className="prereq-note">{translateUI('prereq.loading')}</p>}
            {subjects !== null && shown.length === 0 && <p className="prereq-note">{translateUI('prereq.no_match')}</p>}
            {shown.map(subjectRow)}
          </div>
        </div>, document.body)}
    </>
  );
}
