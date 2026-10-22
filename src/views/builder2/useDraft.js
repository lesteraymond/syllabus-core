import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { phTime } from '../../lib/phTime';
import { syllabi as syllabiApi } from '../../lib/api';
import { saveOnce } from '../../lib/draftSave';
import { SCHEMA_VERSION, clone, emptyDraft, hydrateContent } from '../../lib/syllabusModel';

export const newId = () => 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Top-level sections of the draft that are saved to the server (the server decides `signoff`).
const SECTIONS = ['meta', 'outcomes', 'description', 'clos', 'plan', 'reqs', 'refs', 'grading'];
const DEBOUNCE_MS = 800;

function reducer(state, a) {
  if (a.type === 'PATCH') return a.fn(clone(state));
  if (a.type === 'SET') return a.v;
  return state;
}

const stamp = () => phTime(new Date()); // "Saved 3:44 PM", in Philippine time

// One draft state object with a reducer, plus section-level autosave.
//  - a brand-new syllabus has no server row until the first change; then a draft is created and every section saved;
//  - after that only the sections that changed are sent, debounced, one request at a time;
//  - `editing.syllabusId` opens an existing syllabus (its saved content, upgraded if it is an older schema).
export function useDraft(editing) {
  const [draft, dispatch] = useReducer(reducer, null);
  const [load, setLoad] = useState({ loading: true, error: '', editable: true, status: 'draft', version: 'v1.0' });
  const [save, setSave] = useState({ state: 'saved', time: '' });
  const idRef = useRef(editing && editing.syllabusId ? editing.syllabusId : null);
  const latest = useRef(null);
  const savedJson = useRef({}); // section -> JSON last confirmed on the server
  const touched = useRef(false);
  const timer = useRef(null);
  const running = useRef(false);
  const again = useRef(false);
  const pending = useRef(false); // changes not yet confirmed by the server

  // initial load
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        let content = null;
        let adoptedOutcomes = false;
        let info = { editable: true, status: 'draft', version: 'v1.0' };
        if (idRef.current) {
          const r = await syllabiApi.getContent(idRef.current);
          content = r.content;
          adoptedOutcomes = r.adoptedOutcomes;
          info = { editable: r.editable, status: r.status, version: r.version, lockedReason: r.lockedReason || '', nextVersion: r.nextVersion || '', reviewerNote: r.reviewerNote || '' };
        }
        let d;
        if (content) {
          d = hydrateContent(content, newId);
          // Only sections that exist on the server count as saved; a missing one is saved with the next change.
          SECTIONS.forEach((k) => { if (content[k] !== undefined && !(adoptedOutcomes && ['outcomes', 'clos'].includes(k))) savedJson.current[k] = JSON.stringify(d[k]); });
        } else {
          d = emptyDraft(newId);
          // An older syllabus has no stored content yet: start from what the list already knows.
          if (editing) { d.meta.code = editing.code || ''; d.meta.title = editing.title || ''; }
        }
        if (!live) return;
        latest.current = d;
        dispatch({ type: 'SET', v: d });
        setLoad({ loading: false, error: '', ...info });
      } catch (e) {
        if (live) setLoad({ loading: false, error: e.message, editable: false, status: 'draft', version: '' });
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Saves the changed sections. Resolves true when everything is on the server, false if a save failed.
  // Callers that need the content saved first (submit, Re-check) await it.
  const inflight = useRef(null);
  const flush = useCallback(() => {
    if (running.current) { again.current = true; return inflight.current; }
    running.current = true;
    inflight.current = (async () => {
      try {
        do {
          again.current = false;
          const d = latest.current;
          if (!d || !touched.current) break;
          setSave((s) => ({ ...s, state: 'saving' }));
          // lib/draftSave.js: only changed sections go up; no row exists before a subject is chosen; a refused first save removes its row again
          const result = await saveOnce({ api: syllabiApi, d, idRef, saved: savedJson, sections: SECTIONS, schemaVersion: SCHEMA_VERSION });
          if (result !== 'saved') { pending.current = false; setSave((x) => (x.state === 'pending' || x.state === 'saving' ? { ...x, state: 'saved' } : x)); break; }
          setSave({ state: 'saved', time: stamp() });
          if (!again.current) pending.current = SECTIONS.some((k) => JSON.stringify(latest.current[k]) !== savedJson.current[k]);
        } while (again.current);
        return true;
      } catch (e) {
        setSave((s) => ({ ...s, state: 'error', message: e.message, code: e.data && e.data.code }));
        return false;
      } finally {
        running.current = false;
      }
    })();
    return inflight.current;
  }, []);

  // Any change to the draft after loading schedules a save of the changed sections.
  useEffect(() => {
    if (!draft) return undefined;
    latest.current = draft;
    if (!touched.current) return undefined;
    pending.current = true;
    setSave((s) => (s.state === 'saved' || s.state === 'error' ? { ...s, state: 'pending' } : s));
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, DEBOUNCE_MS);
    return () => clearTimeout(timer.current);
  }, [draft, flush]);

  // Save what is pending when the builder is closed.
  useEffect(() => () => { clearTimeout(timer.current); if (touched.current) flush(); }, [flush]);

  useEffect(() => {
    // Asks before a reload or tab close once anything was typed here (even if autosave has caught up); a save still pending is sent first.
    const warn = (e) => { if (touched.current || pending.current) { if (pending.current) flush(); e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [flush]);

  const apply = useCallback((fn) => { touched.current = true; dispatch({ type: 'PATCH', fn }); }, []);
  const set = useCallback((v) => { touched.current = true; dispatch({ type: 'SET', v }); }, []);
  const saveNow = useCallback(() => { clearTimeout(timer.current); return flush(); }, [flush]);

  return { draft, apply, set, save, saveNow, load, syllabusId: () => idRef.current };
}
