import StableButton from '../../components/StableButton';
import { tr } from "../../i18n/index.js";
import { t as translateUI } from "../../i18n/index.js";
import { useEffect, useRef, useState } from 'react';
import { compliance as api } from '../../lib/api';
import { applyOps } from '../../lib/formOps';
import { trial, applyAll, loadRejected, saveRejected } from '../../lib/suggestionView';

// "Suggested changes": when a check finishes, the server works out a fix for everything it found that can be fixed (no AI needed for some, the
// AI writes the words for the rest) and says what the score would be with all of them. The author accepts or rejects each, or accepts all.
// Accepting writes the change into the form (the normal save follows); nothing changes before. A suggestion that no longer fits what is on
// screen is not applied. What no suggestion can fix is listed as still needing the author, with a link to the step.
export default function SuggestionsPanel({ run, d, apply, editable, syllabusId, onOpenStep, onRecheck }) {
  const [data, setData] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | loading | done | error
  const [error, setError] = useState('');
  const [state, setState] = useState({}); // suggestion id -> 'applied' | 'rejected' | 'outdated'
  const [undoOps, setUndoOps] = useState({}); // suggestion id -> the operations that undo it
  const [rejected, setRejected] = useState(() => loadRejected(syllabusId() || 'new'));
  const asked = useRef(null); // the run the suggestions were asked for

  const ready = !!run && run.status === 'scored' && !run.stale && run.aiStatus !== 'pending' && Array.isArray(run.findings) && run.findings.length > 0;
  const load = async () => {
    const id = syllabusId();
    if (!id) return;
    setPhase('loading'); setError('');
    try {
      const res = await api.suggest(id);
      setData(res); setState({}); setUndoOps({}); setPhase('done');
    } catch (e) { setError(e.message); setPhase('error'); }
  };
  // Automatic: each new check that has something to fix asks once.
  useEffect(() => {
    if (!ready || !editable || asked.current === run.id) return;
    asked.current = run.id;
    load();
  }, [ready, editable, run && run.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!run || (!data && phase === 'idle')) return null;

  const stateOf = (s) => state[s.id] || (rejected.has(s.id) ? 'rejected' : 'new');
  const all = data ? data.suggestions : [];
  const open = all.filter((s) => stateOf(s) === 'new');
  const hidden = all.filter((s) => stateOf(s) === 'rejected').length;
  const shown = all.filter((s) => stateOf(s) !== 'rejected');

  const accept = (s) => {
    const t = trial(d, s);
    if (!t.ok) { setState((x) => ({ ...x, [s.id]: 'outdated' })); return; }
    apply((x) => { applyOps(x, s.ops); return x; });
    setState((x) => ({ ...x, [s.id]: 'applied' }));
    setUndoOps((x) => ({ ...x, [s.id]: t.undo }));
  };
  const acceptAll = () => {
    const copy = JSON.parse(JSON.stringify(d));
    const done = applyAll(copy, open);
    apply((x) => { applyAll(x, open); return x; });
    setState((x) => { const n = { ...x }; open.forEach((s) => { n[s.id] = done.some((a) => a.id === s.id) ? 'applied' : 'outdated'; }); return n; });
    setUndoOps((x) => { const n = { ...x }; done.forEach((a) => { n[a.id] = a.undo; }); return n; });
  };
  const undo = (s) => {
    const ops = undoOps[s.id];
    if (!ops || !applyOps(JSON.parse(JSON.stringify(d)), ops)) { setState((x) => ({ ...x, [s.id]: 'outdated' })); return; }
    apply((x) => { applyOps(x, ops); return x; });
    setState((x) => { const n = { ...x }; delete n[s.id]; return n; });
  };
  const reject = (s) => {
    const next = new Set(rejected).add(s.id);
    setRejected(next); saveRejected(syllabusId() || 'new', next);
  };
  const rejectAll = () => {
    const next = new Set(rejected);
    open.forEach((s) => next.add(s.id));
    setRejected(next); saveRejected(syllabusId() || 'new', next);
  };
  const restore = () => { const next = new Set(); setRejected(next); saveRejected(syllabusId() || 'new', next); };

  const appliedCount = all.filter((s) => state[s.id] === 'applied').length;
  const gain = data && data.score && data.score.now !== null && data.score.after !== null ? data.score : null;

  return (
    <section className="sug-card" id="sug-card" aria-labelledby="sug-title" aria-busy={phase === 'loading'}>
      <div className="sug-head">
        <div>
          <h3 id="sug-title">{translateUI('suggest.title')}</h3>
          <p className="cmp-small">{translateUI('suggest.note')}</p>
        </div>
        <div className="sug-actions">
          {open.length > 1 && <StableButton type="button" className="btn primary" disabled={!editable} onClick={acceptAll}>{translateUI('suggest.accept_all', { p0: open.length })}</StableButton>}
          {open.length > 1 && <StableButton type="button" className="btn outline" onClick={rejectAll}>{translateUI('suggest.reject_all')}</StableButton>}
          <StableButton type="button" className="btn outline" disabled={phase === 'loading' || !editable} onClick={load}>{translateUI('suggest.refresh')}</StableButton>
        </div>
      </div>
      {phase === 'loading' && <p className="cmp-status" role="status" aria-live="polite">{translateUI('suggest.busy')}</p>}
      {phase === 'error' && <div className="info-banner warning" role="alert">{tr(error)}</div>}
      {data && gain && gain.after > gain.now && <p className="sug-gain" role="status">{translateUI('suggest.gain', { p0: gain.now, p1: gain.after })}</p>}
      {data && data.ai === 'unavailable' && <div className="info-banner" role="note">{translateUI('suggest.no_ai')}</div>}
      {data && data.ai === 'failed' && <div className="info-banner warning" role="note">{translateUI('suggest.ai_failed')}</div>}
      {appliedCount > 0 && (
        <p className="sug-applied" role="status">{translateUI('suggest.applied_count', { p0: appliedCount })}{onRecheck && <> <button type="button" className="link" onClick={onRecheck}>{translateUI('suggest.recheck')}</button></>}</p>
      )}
      {data && phase === 'done' && shown.length === 0 && <p className="cmp-small" role="status">{translateUI(all.length ? 'suggest.all_rejected' : 'suggest.none')}</p>}
      {shown.length > 0 && (
        <ul className="sug-list">
          {shown.map((s) => {
            const st = stateOf(s);
            return (
              <li key={s.id} className={'sug-item ' + st}>
                <div className="sug-top">
                  <strong>{tr(s.label)}</strong>
                  {(s.rules || []).map((r) => <span key={r} className="chip quiet mono">{r}</span>)}
                  {s.why && <span className="cmp-small">{tr(s.why)}</span>}
                </div>
                {(s.changes || []).map((c, i) => (
                  <div className="sug-diff" key={i}>
                    {c.title && <strong className="sug-col">{tr(c.title)}</strong>}
                    <div className="sug-before"><small>{translateUI('suggest.now')}</small><p>{c.before || translateUI('suggest.empty')}</p></div>
                    <div className="sug-after"><small>{translateUI('suggest.suggested')}</small><p>{c.after}</p></div>
                  </div>
                ))}
                {st === 'new' && (
                  <div className="sug-actions">
                    <StableButton type="button" className="btn primary" disabled={!editable} onClick={() => accept(s)}>{translateUI('suggest.accept')}</StableButton>
                    <StableButton type="button" className="btn outline" onClick={() => reject(s)}>{translateUI('suggest.reject')}</StableButton>
                  </div>
                )}
                {st === 'applied' && <div className="sug-actions"><span role="status">{translateUI('suggest.applied')}</span><StableButton type="button" className="btn outline" onClick={() => undo(s)}>{translateUI('suggest.undo')}</StableButton></div>}
                {st === 'outdated' && <div className="sug-actions"><span role="status">{translateUI('suggest.outdated')}</span></div>}
              </li>
            );
          })}
        </ul>
      )}
      {hidden > 0 && <p className="cmp-small"><button type="button" className="link" onClick={restore}>{translateUI('suggest.restore', { p0: hidden })}</button></p>}
      {data && data.remaining && data.remaining.length > 0 && (
        <div className="sug-left">
          <h4>{translateUI('suggest.left_title')}</h4>
          <p className="cmp-small">{translateUI('suggest.left_note')}</p>
          <ul>
            {data.remaining.map((r) => (
              <li key={r.ruleId}>
                <span className="chip quiet mono">{r.ruleId}</span> {tr(r.message)}{r.count > 1 ? ' ' + translateUI('suggest.more', { p0: r.count - 1 }) : ''}
                {onOpenStep && r.step && <> <button type="button" className="link" onClick={() => onOpenStep(r.step)}>{translateUI('suggest.go')}</button></>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
