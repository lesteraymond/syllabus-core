import { useCallback, useEffect, useRef, useState } from 'react';
import { compliance as api } from '../../lib/api';

// The stored compliance run of the syllabus being edited.
//   load()            reads the latest stored run
//   check(force)      explicitly saves and checks the current form (owner only).
// Concurrent clicks share the active check; opening or polling only reads reports.
// While the server is still writing the recommendations (aiStatus 'pending') it reads the run again every few seconds.
export function useCompliance({ syllabusId, saveFirst }) {
  const [run, setRun] = useState(null);
  const [installed, setInstalled] = useState(true);
  const [busy, setBusy] = useState(false);
  // The server is still running a check that this page did not start (the user left the page and came back, or reloaded it).
  const [remote, setRemote] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  const checking = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const apply = (res) => { if (!alive.current) return; setRemote(!!res.checking); setInstalled(res.installed !== false); setRun(res.run || null); setError(''); };

  const load = useCallback(async () => {
    const id = syllabusId();
    if (!id) return;
    try { apply(await api.get(id)); } catch (e) { if (alive.current) setError(e.message); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const check = useCallback(async (force = false) => {
    // A ref closes the gap before React renders the disabled button.
    if (checking.current) return;
    checking.current = true;
    setBusy(true);
    setError('');
    try {
      if (saveFirst && !(await saveFirst())) { setError('Your latest changes could not be saved, so they were not checked.'); return; }
      const id = syllabusId();
      if (!id) { setError('Choose a subject first.'); return; }
      apply(await api.recheck(id, force));
    } catch (e) {
      if (!alive.current) return;
      if (e.status === 503) setInstalled(false);
      else setError(e.message);
    } finally {
      checking.current = false;
      if (alive.current) setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ask again every few seconds until the server says the check it is running has finished; then the new run is shown.
  useEffect(() => {
    if (!remote || busy) return undefined;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [remote, busy, load]);

  const pending = run && run.aiStatus === 'pending';
  useEffect(() => {
    if (!run?.hybrid || busy) return undefined;
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [run?.id, busy, load]);
  useEffect(() => {
    if (!pending) return undefined;
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      try { apply(await api.get(syllabusId())); } catch { /* try again on the next tick */ }
      if (tries >= 24) clearInterval(timer); // 60 s: a little longer than the server's 45 s limit on the AI step
    }, 2500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, run && run.id]);

  return { run, installed, busy: busy || remote, error, load, check };
}
