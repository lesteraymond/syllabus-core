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
// The server's stages, in order (generate.js onProgress). The step list on screen follows them.
const STAGES = ['clos', 'outline', 'weeks1', 'weeks2', 'admin', 'references', 'check'];
const mmss = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };

// "AI Syllabus Generator": writes a first draft of the CLOs, the 18-week plan, requirements and grading for the chosen subject (server/lib/syllabuscheck/pipeline/generate.js).
// It takes several minutes, so the server runs it as a background job: this panel starts it, shows its progress, and applies the result when it is done. The author can leave
// the page and come back (the panel finds the running or finished job again). The server saves nothing: the sections go through onSections into the author's syllabus, where the
// author reviews, edits and saves them as usual, and "Undo" puts back what was there before. It shows only when the server says the generator is on (GET /syllabus-check/status),
// the author can edit, and a subject is chosen. beforeRun (optional) runs first: it saves the author's open edits, or, for a subject with no draft yet (syllabusId null), creates the draft
// and answers its id (a whole number), which the panel then uses; showCost shows the run's estimated cost.
export default function GeneratePanel({ draft, editable, syllabusId, beforeRun, onSections, onOpenBuilder, showCost = false }) {
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
  const [elapsed, setElapsed] = useState(0);
  const busyNow = phase === 'starting' || phase === 'working';
  useEffect(() => {
    if (!busyNow) { setElapsed(0); return undefined; }
    const began = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - began), 1000);
    return () => clearInterval(timer);
  }, [busyNow]);

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

  // Another syllabus chosen: start from a clean panel. (A subject with no draft getting its draft, id none -> a number, is the same run: nothing is reset.)
  const lastId = useRef(id);
  useEffect(() => {
    const before = lastId.current;
    lastId.current = id;
    if (before === null || before === undefined) return;
    setPhase('idle'); setOut(null); setMessage(''); setProgress(null); previous.current = null;
  }, [id]);
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
      const made = beforeRun ? await beforeRun() : true; // the server writes from the SAVED draft; a subject with no draft gets one here and the id comes back
      const target = Number.isInteger(made) ? made : id;
      if (made === false || !target) throw new Error(translateUI('generate.notSaved'));
      const job = await syllabusCheck.generate(target, notes);
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
  // The score the AI Checker would give this draft (its no-AI rules and the alignment, server pipeline/generate.js expectedScore). An older run has none.
  const expected = check && check.expected && Number.isFinite(check.expected.provisionalScore) ? check.expected : null;
  const expectedText = !expected ? null
    : expected.score !== null && expected.score !== undefined ? translateUI('generate.expected', { score: expected.score, band: tr(expected.band || ''), pass: expected.passMark })
    : expected.blocking > 0 ? translateUI('generate.expectedBlocked', { score: expected.provisionalScore, count: expected.blocking, first: tr((expected.blockingMessages || [])[0] || '') })
    : translateUI('generate.expectedPartial', { score: expected.provisionalScore });
  const cost = out && out.usage && Number.isFinite(out.usage.estimatedUsd) ? out.usage.estimatedUsd.toFixed(2) : null;
  const stageIndex = progress && progress.stage ? STAGES.indexOf(progress.stage) : -1;
  const total = (progress && progress.steps) || STAGES.length;
  const percent = phase === 'starting' || !progress ? 3 : Math.min(97, Math.max(6, Math.round(((stageIndex < 0 ? progress.step || 0 : stageIndex) / total) * 100) + 4));
  const showForm = !busy && phase !== 'done';
  // The step list sits in the right-hand column. Before a run it only lists what the AI writes (numbered); during a run it follows the server's stage; after it, every step is done.
  const stepState = (n) => (phase === 'done' ? 'done' : !busy ? 'idle' : stageIndex < 0 ? 'todo' : n < stageIndex ? 'done' : n === stageIndex ? 'now' : 'todo');
  return (
    <div className="gen-layout">
    <section className={'sm-card gen-card' + (busy ? ' is-working' : '')} aria-label={translateUI('generate.title')} aria-busy={busy || undefined}>
      <div className="sm-card-b">
        {showForm && (
          <>
            <label className="field gen-notes">
              <span>{translateUI('generate.notesLabel')}</span>
              <textarea className="in" rows={7} maxLength={1500} value={notes} aria-label={translateUI('generate.notesLabel')} onChange={(e) => setNotes(e.target.value)} />
              <span className="hint gen-notes-hint"><span>{translateUI('generate.notesHint')}</span><span className="gen-count" aria-hidden="true">{notes.length} / 1500</span></span>
            </label>
          </>
        )}
        {phase === 'confirm' && <div className="info-banner warning" role="alert">{translateUI('generate.replaceNote')}</div>}
        {busy && (
          <div className="gen-run" role="status">
            <div className="gen-run-top">
              <span className="gen-orb" aria-hidden="true"><i /></span>
              <div className="gen-run-text">
                <strong>{translateUI('generate.workingTitle')}</strong>
                <span>{progress && progress.stage ? translateUI('generate.stage.' + progress.stage) : translateUI('generate.preparing')}</span>
              </div>
              <span className="gen-time">{translateUI('generate.elapsed', { time: mmss(elapsed) })}</span>
            </div>
            <div className="gen-bar" role="progressbar" aria-label={translateUI('generate.title')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><i style={{ width: percent + '%' }} /></div>
            <p className="hint">{translateUI('generate.leaveNote')}</p>
          </div>
        )}
        {phase === 'error' && <div className="info-banner warning" role="alert">{translateUI('generate.failed', { reason: tr(message) })}</div>}
        {phase === 'undone' && <div className="info-banner" role="status">{translateUI('generate.undone')}</div>}
        {phase === 'done' && out && (
          <div className="gen-done" role="status">
            <span className="gen-check" aria-hidden="true">✓</span>
            <div className="gen-done-text">
              <strong>{translateUI('generate.doneTitle')}</strong>
              <span>{translateUI(away ? 'generate.resumed' : 'generate.done')}</span>
              {check && check.status === 'clean' && <span>{translateUI('generate.clean')}</span>}
              {check && check.status === 'needs_review' && <span>{translateUI('generate.review', { count: (check.misalignmentsAfter || 0) + (check.notApplied || []).length })}</span>}
              {check && check.status === 'not_checked' && <span>{translateUI('generate.notChecked')}</span>}
              {expectedText && <span className="gen-expected">{expectedText} {translateUI('generate.expectedNote')}</span>}
              {(out.warnings || []).map((w) => <span key={w}>{tr(w)}</span>)}
              {showCost && cost && <span>{translateUI('generate.cost', { cost })}</span>}
            </div>
          </div>
        )}
        <div className="confirm-actions gen-actions">
          {phase === 'confirm' && <>
            <StableButton type="button" className="btn primary" onClick={run}>{translateUI('generate.replace')}</StableButton>
            <StableButton type="button" className="btn outline" onClick={() => setPhase('idle')}>{translateUI('ui.cancel_77dfd2')}</StableButton>
          </>}
          {showForm && phase !== 'confirm' && <StableButton type="button" className="btn primary" onClick={start}>{translateUI('generate.button')}</StableButton>}
          {showForm && phase !== 'confirm' && <span className="hint gen-takes">{translateUI('generate.takes')}</span>}
          {phase === 'done' && onOpenBuilder && <StableButton type="button" className="btn primary" onClick={onOpenBuilder}>{translateUI('generate.openBuilder')}</StableButton>}
          {phase === 'done' && previous.current && <StableButton type="button" className="btn outline" onClick={undo}>{translateUI('generate.undo')}</StableButton>}
          {phase === 'done' && <StableButton type="button" className="btn ghost" onClick={() => { setPhase('idle'); setOut(null); }}>{translateUI('generate.again')}</StableButton>}
        </div>
      </div>
    </section>
    <aside className="card gen-rail" aria-label={translateUI(busy || phase === 'done' ? 'generate.stepsLabel' : 'generate.writesLabel')}>
      <h3>{translateUI(busy || phase === 'done' ? 'generate.stepsLabel' : 'generate.writesLabel')}</h3>
      <ol className="gen-steps">
        {STAGES.map((k, n) => {
          const state = stepState(n);
          return <li key={k} className={'gen-step ' + state} aria-current={state === 'now' ? 'step' : undefined}><span className="gen-dot" aria-hidden="true">{state === 'done' ? '✓' : state === 'idle' ? n + 1 : ''}</span>{translateUI('generate.stage.' + k)}</li>;
        })}
      </ol>
    </aside>
    </div>
  );
}
