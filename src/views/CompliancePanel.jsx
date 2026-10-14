import { useCallback, useEffect, useState } from 'react';
import { compliance as api } from '../lib/api';
import ComplianceCard from './ComplianceCard';

// The stored compliance check of one submitted syllabus, with Check (none stored yet) or Re-check (a new one) for an administrator.
// The rules run on the submitted version and the result is stored with it. Used in Review & Approval and in the syllabus modal, so
// both read and run the check the same way. `onChanged` is called after a check so a list can refresh its scores.
export default function CompliancePanel({ syllabusId, onChanged }) {
  const [state, setState] = useState({ loading: true, run: null, installed: true, checkable: true });
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await api.list(syllabusId);
    setState({ loading: false, run: res.run || null, installed: res.installed !== false, checkable: !res.syllabus || res.syllabus.checkable !== false });
  }, [syllabusId]);

  useEffect(() => {
    let live = true;
    setError('');
    setState({ loading: true, run: null, installed: true, checkable: true });
    api.list(syllabusId)
      .then((res) => { if (live) setState({ loading: false, run: res.run || null, installed: res.installed !== false, checkable: !res.syllabus || res.syllabus.checkable !== false }); })
      .catch((e) => { if (live) { setError(e.message); setState({ loading: false, run: null, installed: true, checkable: true }); } });
    return () => { live = false; };
  }, [syllabusId]);

  // While recommendations are still being written, look again every few seconds (for a bounded time).
  const pending = state.run && state.run.aiStatus === 'pending';
  useEffect(() => {
    if (!pending) return undefined;
    let tries = 0;
    const t = setInterval(() => { tries += 1; load().catch(() => {}); if (tries >= 15) clearInterval(t); }, 2500);
    return () => clearInterval(t);
  }, [pending, load]);

  const check = async () => {
    setChecking(true);
    setError('');
    try {
      await api.recheck(syllabusId, !!state.run);
      await load();
      if (onChanged) onChanged();
    } catch (e) { setError(e.message); } finally { setChecking(false); }
  };

  return (
    <div className="cmp-review">
      {state.loading && <p className="cmp-small">Loading the stored check…</p>}
      {!state.loading && state.installed && state.checkable && (
        <div className="cmp-one-head">
          <span className="cmp-small">{state.run ? 'The check stored with this version.' : 'No check is stored with this version yet.'}</span>
          <button type="button" className="btn outline" disabled={checking} onClick={check}>{checking ? 'Checking…' : state.run ? 'Re-check' : 'Check'}</button>
        </div>
      )}
      {error && <div className="info-banner warning" role="alert">{error}</div>}
      {!state.loading && !state.installed && <p className="cmp-small">Compliance checks are not set up on this server yet.</p>}
      {!state.loading && state.installed && !state.checkable && <p className="cmp-small">This syllabus was submitted as an uploaded file, so there is no builder form to check.</p>}
      {!state.loading && state.run && <ComplianceCard run={state.run} />}
    </div>
  );
}
