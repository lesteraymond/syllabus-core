import { useCallback, useEffect, useRef, useState } from 'react';
import { compliance as api } from '../../lib/api';

// The stored compliance run of the syllabus being edited.
//   load()            reads the latest stored run
//   check(force)      saves what is on screen, then runs the rules on it (owner only). The same content returns the stored run;
//                     force makes a new one (the Re-check button), which also retries the AI step.
// While the server is still writing the recommendations (aiStatus 'pending') it reads the run again every few seconds.
export function useCompliance({ syllabusId, saveFirst }) {
  const [run, setRun] = useState(null);
  const [installed, setInstalled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const apply = (res) => { if (!alive.current) return; setInstalled(res.installed !== false); setRun(res.run || null); setError(''); };

  const load = useCallback(async () => {
    const id = syllabusId();
    if (!id) return;
    try { apply(await api.get(id)); } catch (e) { if (alive.current) setError(e.message); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const check = useCallback(async (force = false) => {
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
      if (alive.current) setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = run && run.aiStatus === 'pending';
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

  return { run, installed, busy, error, load, check };
}
