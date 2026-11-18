import { useEffect, useRef, useState } from 'react';
import StableButton from '../../components/StableButton';
import { t as translateUI, tr } from '../../i18n/index.js';
import { syllabusCheck } from '../../lib/api';

const filled = (text) => String(text || '').trim() !== '';
// Has the author already written part of the plan? Generating then replaces it, so the author is asked first (and can undo afterwards).
const hasPlanText = (d) => (d.plan || []).some((r) => filled(r.contents) || filled(r.activities) || filled(r.tasks) || (r.ilos || []).some((il) => filled(il.text)));
// What a section looks like when it is empty, for undoing a generation over a section the author had not started.
const EMPTY = { clos: [], description: [], plan: [], reqs: [], grading: { rows: [], override: { on: false, term: '', final: '' } } };
const MAX_POLL_FAILURES = 10;

// "AI Syllabus Generator": writes a first draft of the CLOs, the 18-week plan, requirements and grading for the chosen subject (server/lib/syllabuscheck/pipeline/generate.js).
// It takes several minutes, so the server runs it as a background job: this panel starts it, shows its progress, and applies the result when it is done. The author can leave
// the page and come back (the panel finds the running or finished job again). The server saves nothing: the sections go through onSections into the author's syllabus, where the
// author reviews, edits and saves them as usual, and "Undo" puts back what was there before. It shows only when the server says the generator is on (GET /syllabus-check/status),
// the author can edit, and a subject is chosen. References are never generated. beforeRun (optional) saves the author's open edits first; showCost shows the run's estimated cost.
export default function GeneratePanel({ draft, editable, syllabusId, beforeRun, onSections, showCost = false }) {
  const id = typeof syllabusId === 'function' ? syllabusId() : syllabusId;
  const [available, setAvailable] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | confirm | starting | working | done | undone | error
  const [progress, setProgress] = useState(null);
  const [notes, setNotes] = useState('');
  const [out, setOut] = useState(null);
  const [away, setAway] = useState(false);
  const [message, setMessage] = useState('');
  const previous = useRef(null);
  const latest = useRef({});
  latest.current = { draft, onSections, id };
  const hasDraft = !!draft;

  useEffect(() => {
    let live = true;
    syllabusCheck.status().then((s) => { if (live) setAvailable(!!(s && s.generator && s.generator.available)); }).catch(() => { if (live) setAvailable(false); });
    return () => { live = false; };
  }, []);

  // Applies a finished result: remember what the sections held (for Undo), hand them to the host, then tell the server the job has been taken.
  const finish = async (result, wasAway) => {
    const { draft: d, onSections: apply, id: syllabus } = latest.current;
    previous.current = Object.fromEntries(Object.keys(result.sections).map((k) => [k, d && d[k] !== undefined ? d[k] : EMPTY[k]]));
    await apply(result.sections);
    await syllabusCheck.generateClear(syllabus).catch(() => {});
    setOut(result); setAway(wasAway); setPhase('done');
  };
  const fail = (text) => { setMessage(text); setPhase('error'); };

  // Another syllabus chosen: start from a clean panel.
  useEffect(() => { setPhase('idle'); setOut(null); setMessage(''); setProgress(null); previous.current = null; }, [id]);
  // A job that is running, or finished while the author was away, is picked up again.
  useEffect(() => {
    if (!available || !editable || !hasDraft || !id) return undefined;
    let live = true;
    syllabusCheck.generateStatus(id).then(async (s) => {
      if (!live || !s) return;
      if (s.status === 'running') { setProgress({ step: s.step, steps: s.steps, stage: s.stage }); setPhase('working'); }
      else if (s.status === 'done') { try { await finish(s.result, true); } catch (e) { if (live) fail(e.message); } }
      else if (s.status === 'failed') { await syllabusCheck.generateClear(id).catch(() => {}); if (live) fail(s.error && s.error.message); }
    }).catch(() => {});
    return () => { live = false; };
  }, [available, editable, hasDraft, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // While a job runs, ask the server for its progress every few seconds.
  useEffect(() => {
    if (phase !== 'working' || !id) return undefined;
    let live = true, timer = null, failures = 0;
    const poll = async () => {
      try {
        const s = await syllabusCheck.generateStatus(id);
        failures = 0;
        if (!live) return;
        if (s.status === 'running') { setProgress({ step: s.step, steps: s.steps, stage: s.stage }); timer = setTimeout(poll, 2500); }
        else if (s.status === 'done') await finish(s.result, false);
        else if (s.status === 'failed') { await syllabusCheck.generateClear(id).catch(() => {}); fail(s.error && s.error.message); }
        else fail('The generation was lost, for example because the server restarted. Nothing was changed. Try again.');
      } catch (e) {
        if (!live) return;
        failures += 1;
        if (failures >= MAX_POLL_FAILURES) fail(e.message); else timer = setTimeout(poll, 4000);
      }
    };
    poll();
    return () => { live = false; clearTimeout(timer); };
  }, [phase, id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!available || !editable || !draft || !draft.meta || !draft.meta.courseId) return null;

  const run = async () => {
    setPhase('starting'); setMessage(''); setProgress(null);
    try {
      if ((beforeRun && (await beforeRun()) === false) || !id) throw new Error(translateUI('generate.notSaved')); // the server writes from the SAVED draft
      const job = await syllabusCheck.generate(id, notes);
      setProgress({ step: job.step, steps: job.steps, stage: job.stage });
      setPhase('working');
    } catch (e) { fail(e.message); }
  };
  const start = () => (hasPlanText(draft) ? setPhase('confirm') : run());
  const undo = async () => {
    try { await onSections(previous.current); previous.current = null; setPhase('undone'); } catch (e) { fail(e.message); }
  };

  const busy = phase === 'starting' || phase === 'working';
  const check = out && out.check;
  const cost = out && out.usage && Number.isFinite(out.usage.estimatedUsd) ? out.usage.estimatedUsd.toFixed(2) : null;
  return (
    <section className="sm-card" aria-label={translateUI('generate.title')} style={{ marginBottom: 16 }}>
      <header className="sm-card-h"><h4>{translateUI('generate.title')}</h4></header>
      <div className="sm-card-b">
        <p className="hint">{translateUI('generate.intro')}</p>
        <label className="field">
          <span>{translateUI('generate.notesLabel')}</span>
          <textarea className="in" rows={3} maxLength={1500} value={notes} disabled={busy} aria-label={translateUI('generate.notesLabel')} onChange={(e) => setNotes(e.target.value)} />
          <span className="hint">{translateUI('generate.notesHint')}</span>
        </label>
        {phase === 'confirm' && <div className="info-banner warning" role="alert">{translateUI('generate.replaceNote')}</div>}
        {busy && (
          <div className="info-banner" role="status"><div>
            <div>{translateUI('generate.working')}</div>
            {progress && progress.stage && <div>{translateUI('generate.progress', { step: progress.step, steps: progress.steps, stage: translateUI('generate.stage.' + progress.stage) })}</div>}
            {progress && progress.steps > 0 && <progress max={progress.steps} value={progress.step || 0} aria-label={translateUI('generate.title')} style={{ width: '100%' }} />}
          </div></div>
        )}
        {phase === 'error' && <div className="info-banner warning" role="alert">{translateUI('generate.failed', { reason: tr(message) })}</div>}
        {phase === 'undone' && <div className="info-banner" role="status">{translateUI('generate.undone')}</div>}
        {phase === 'done' && out && (
          <div className="info-banner" role="status"><div>
            <div>{translateUI(away ? 'generate.resumed' : 'generate.done')}</div>
            {check && check.status === 'clean' && <div>{translateUI('generate.clean')}</div>}
            {check && check.status === 'needs_review' && <div>{translateUI('generate.review', { count: (check.misalignmentsAfter || 0) + (check.notApplied || []).length })}</div>}
            {check && check.status === 'not_checked' && <div>{translateUI('generate.notChecked')}</div>}
            {(out.warnings || []).map((w) => <div key={w}>{tr(w)}</div>)}
            {showCost && cost && <div>{translateUI('generate.cost', { cost })}</div>}
          </div></div>
        )}
        <div className="confirm-actions" style={{ justifyContent: 'flex-start', gap: 8, marginTop: 14 }}>
          {phase === 'confirm'
            ? <>
              <StableButton type="button" className="btn primary" onClick={run}>{translateUI('generate.replace')}</StableButton>
              <StableButton type="button" className="btn outline" onClick={() => setPhase('idle')}>{translateUI('ui.cancel_77dfd2')}</StableButton>
            </>
            : <StableButton type="button" className="btn primary" disabled={busy} onClick={start}>{translateUI('generate.button')}</StableButton>}
          {phase === 'done' && previous.current && <StableButton type="button" className="btn outline" onClick={undo}>{translateUI('generate.undo')}</StableButton>}
        </div>
      </div>
    </section>
  );
}
