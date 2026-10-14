import { useEffect, useMemo, useRef, useState } from 'react';
import { courses as coursesApi, outcomes as outcomesApi, users as usersApi } from '../lib/api';
import { hasUnsaved, mergeCatalog } from '../lib/assignmentSync';

// Admin: choose the programs, then the subjects, a faculty member may create syllabi for. This panel only ASSIGNS what
// already exists; subjects are created, edited and deleted in Program & Subjects.
// Left: the programs (tick = assigned, click = look at its subjects). Right: that program's subjects.
// Unticking a program drops its subjects (the server does the same). A program may have no subjects yet: it still saves,
// and the faculty member waits for subjects to be assigned.
// The programs and subjects are loaded every time the panel opens and again when the browser tab regains focus, so a
// subject added in Program & Subjects shows up here; the admin's unsaved ticks are kept (see lib/assignmentSync.js).
export default function AssignmentsPanel({ person, onClose, notify, onManageSubjects }) {
  const [programs, setPrograms] = useState([]);
  const [courses, setCourses] = useState([]);
  const [progSel, setProgSel] = useState(new Set());
  const [courseSel, setCourseSel] = useState(new Set());
  const [focusId, setFocusId] = useState(null);
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ loading: true, error: '', saving: false });
  const saved = useRef({ progSel: new Set(), courseSel: new Set() }); // what is saved on the server: unsaved ticks are compared with it
  const latest = useRef({ progSel, courseSel, focusId }); // the current selection, for the refresh below
  latest.current = { progSel, courseSel, focusId };

  useEffect(() => {
    let live = true;
    Promise.all([outcomesApi.programs(), coursesApi.list(), usersApi.assignments(person.id)])
      .then(([p, c, a]) => {
        if (!live) return;
        setPrograms(p);
        setCourses(c);
        saved.current = { progSel: new Set(a.programIds), courseSel: new Set(a.courseIds) };
        setProgSel(new Set(a.programIds));
        setCourseSel(new Set(a.courseIds));
        setFocusId((a.programIds[0]) || (p[0] && p[0].id) || null);
        setState({ loading: false, error: '', saving: false });
      })
      .catch((e) => { if (live) setState({ loading: false, error: e.message, saving: false }); });
    return () => { live = false; };
  }, [person.id]);

  // A subject added in Program & Subjects while this panel is open: re-fetch only the programs and subjects when the tab
  // regains focus, and merge them with the admin's current ticks.
  useEffect(() => {
    let live = true;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      Promise.all([outcomesApi.programs(), coursesApi.list()]).then(([p, c]) => {
        if (!live) return;
        const m = mergeCatalog({ programs: p, courses: c }, latest.current);
        setPrograms(m.programs); setCourses(m.courses); setProgSel(m.progSel); setCourseSel(m.courseSel); setFocusId(m.focusId);
      }).catch(() => {}); // offline: the list stays as it is
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => { live = false; document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh); };
  }, []);

  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  const fp = programs.find((p) => p.id === focusId) || null;
  const programOn = !!fp && progSel.has(fp.id);
  const inProgram = (code) => courses.filter((c) => c.program === code);
  const q = query.trim().toLowerCase();
  const rows = useMemo(() => (fp ? courses.filter((c) => c.program === fp.code && (!q || (c.code + ' ' + c.title).toLowerCase().includes(q))) : []), [courses, fp, q]);
  const assignedIn = (code) => courses.filter((c) => c.program === code && courseSel.has(c.id)).length;

  const toggleProgram = (p) => {
    const on = progSel.has(p.id);
    const next = new Set(progSel);
    if (on) next.delete(p.id); else next.add(p.id);
    setProgSel(next);
    if (on) setCourseSel(new Set([...courseSel].filter((id) => { const c = courses.find((x) => x.id === id); return !c || c.program !== p.code; })));
  };
  const toggleCourse = (id) => { const next = new Set(courseSel); if (next.has(id)) next.delete(id); else next.add(id); setCourseSel(next); };
  const setAll = (on) => {
    const next = new Set(courseSel);
    rows.forEach((c) => { if (on) next.add(c.id); else next.delete(c.id); });
    setCourseSel(next);
  };

  const goToSubjects = () => {
    if (hasUnsaved(saved.current, { progSel, courseSel }) && !window.confirm('Leave without saving your assignment changes?')) return;
    onClose();
    onManageSubjects();
  };

  const save = async () => {
    setState((s) => ({ ...s, saving: true }));
    try {
      const saved = await usersApi.saveAssignments(person.id, { programs: [...progSel], courses: [...courseSel] });
      const waiting = saved.courseIds.length === 0 && saved.programIds.length > 0;
      notify(`Assignments saved for ${person.firstName} ${person.lastName}.` + (waiting ? ' No subject is assigned yet, so they cannot start a syllabus until you assign one.' : (saved.emptyPrograms && saved.emptyPrograms.length ? ` ${saved.emptyPrograms.map((p) => p.code).join(', ')} has no subjects yet.` : '')));
      onClose();
    } catch (e) {
      setState((s) => ({ ...s, saving: false }));
      notify('Failed: ' + e.message);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal asg-modal" role="dialog" aria-modal="true" aria-labelledby="asg-title" onClick={(e) => e.stopPropagation()}>
        <header className="asg-head">
          <div>
            <span className="asg-eyebrow">Assignments</span>
            <h3 id="asg-title">{person.firstName} {person.lastName}</h3>
            <small>{person.email}</small>
          </div>
          <button type="button" className="asg-x" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="asg-body">
          {state.loading && <div className="empty">Loading…</div>}
          {state.error && <div className="info-banner warning">Could not load the assignments: {state.error}</div>}
          {!state.loading && !state.error && (
            <div className="asg-grid">
              <section className="asg-card" aria-label="Programs">
                <h4 className="asg-h">Programs <small>{progSel.size} of {programs.length} assigned</small></h4>
                <ul className="asg-list">
                  {programs.map((p) => {
                    const on = progSel.has(p.id);
                    return (
                      <li key={p.id} className={'asg-prog' + (on ? ' on' : '') + (p.id === focusId ? ' focus' : '')}>
                        <input type="checkbox" checked={on} onChange={() => toggleProgram(p)} aria-label={'Assign ' + p.code + ' to ' + person.firstName} />
                        <button type="button" className="asg-prog-main" aria-current={p.id === focusId ? 'true' : undefined} onClick={() => setFocusId(p.id)}>
                          <span className="asg-code">{p.code}</span>
                          <span className="asg-count mono">{assignedIn(p.code)}/{inProgram(p.code).length}</span>
                          <span className="asg-pname">{p.name}</span>
                        </button>
                      </li>
                    );
                  })}
                  {programs.length === 0 && <li className="asg-empty">No programs exist yet.</li>}
                </ul>
                <p className="asg-foot-note">Tick a program to assign it. The count is subjects assigned out of subjects in the catalog.</p>
              </section>

              <section className="asg-card" aria-label={fp ? 'Subjects of ' + fp.code : 'Subjects'}>
                {!fp ? <div className="asg-empty">Choose a program to see its subjects.</div> : <>
                  <div className="asg-subhead">
                    <div><span className="asg-code lg">{fp.code}</span><span className="asg-subname">{fp.name}</span></div>
                    <div className="asg-tools">
                      <span className="asg-meta mono">{assignedIn(fp.code)} of {inProgram(fp.code).length} assigned</span>
                      <button type="button" className="asg-link" disabled={!programOn || !rows.length} onClick={() => setAll(true)}>Select all</button>
                      <button type="button" className="asg-link" disabled={!programOn || !rows.length} onClick={() => setAll(false)}>Clear</button>
                    </div>
                  </div>
                  {!programOn && <p className="asg-note">{fp.code} is not assigned to {person.firstName} yet. Tick it on the left to assign its subjects. You can still add subjects to the catalog in Program & Subjects.</p>}
                  <input className="asg-in asg-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={'Search ' + fp.code + ' subjects'} aria-label="Search subjects" />
                  <div className="asg-scroll">
                    <table className="asg-ledger">
                      <thead><tr><th className="asg-c0"><span className="sr-only">Assigned</span></th><th>Code</th><th>Title</th></tr></thead>
                      <tbody>
                        {rows.map((c) => (
                          <tr key={c.id} className={courseSel.has(c.id) ? 'on' : ''}>
                            <td className="asg-c0"><input type="checkbox" disabled={!programOn} checked={courseSel.has(c.id)} onChange={() => toggleCourse(c.id)} aria-label={'Assign ' + c.code} /></td>
                            <td className="mono asg-codecell">{c.code}</td>
                            <td>{c.title}</td>
                          </tr>
                        ))}
                        {!rows.length && <tr><td colSpan="3" className="asg-empty">{q ? 'No subject matches your search.' : <>No subjects in {fp.code} yet. Add them in Subjects &amp; CLOs, then assign them here.{onManageSubjects && <> <button type="button" className="asg-link" onClick={goToSubjects}>Go to Subjects &amp; CLOs</button></>}</>}</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </>}
              </section>
            </div>
          )}
        </div>

        <footer className="asg-foot">
          <span className="asg-summary mono">{progSel.size} program{progSel.size === 1 ? '' : 's'} · {courseSel.size} subject{courseSel.size === 1 ? '' : 's'}</span>
          <div className="asg-actions">
            <button type="button" className="asg-btn ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="asg-btn primary" disabled={state.loading || !!state.error || state.saving} onClick={save}>{state.saving ? 'Saving…' : 'Save assignments'}</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
