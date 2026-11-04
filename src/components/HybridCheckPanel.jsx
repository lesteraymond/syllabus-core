import { useEffect, useRef, useState } from 'react';
import { syllabusCheck } from '../lib/api';
import { decideSuggestion, hardGatesOf } from '../lib/hybridCheck';
import { memoryOf } from '../lib/panelMemory';
import { useAiGate } from '../lib/checkPolicy';
import { canRefine, linkProblems, problemsOf, suggestionSection } from '../lib/hybridView';
import HybridProblem from './HybridProblem';
import { t, tr } from '../i18n';
import {isAcademicV2} from '../lib/academicEvaluation';

const without = (map, key) => { const next = { ...map }; delete next[key]; return next; };

export default function HybridCheckPanel({ run, onApplyDraft }) {
  const aiGate = useAiGate();
  const [edits, setEdits] = useState({});
  const [decisions, setDecisions] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Feedback belongs on the card that was clicked: its own error, and which card is being applied right now.
  const [errors, setErrors] = useState({});
  const [working, setWorking] = useState('');
  const [appliedValue, setAppliedValue] = useState({}); // what this session put into the syllabus, so Undo can check the field still holds it
  const [decisionText, setDecisionText] = useState({}); // the text of a saved "edit" decision, so Undo still works after a reload
  const [refining, setRefining] = useState(''); // the recommendation being checked and improved right now
  const [refined, setRefined] = useState({}); // id -> what the check found: { status, text, usedRewrite, stats, blockers }
  const [ready, setReady] = useState(false); // saved decisions loaded: until then nothing can be applied, so a handled card is never applied twice
  const decisionLock = useRef(false);
  const hybrid = run?.hybrid;
  // Edits and "Check & improve" results are also written to panelMemory, so they are still there when the page is left and opened again.
  const keep = (field, set) => update => set(current => {
    const next = typeof update === 'function' ? update(current) : update;
    if (run?.id) memoryOf(run.id)[field] = next;
    return next;
  });
  const setEditsKept = keep('edits', setEdits);
  const setRefinedKept = keep('refined', setRefined);
  useEffect(() => {
    let live = true;
    const mem = run?.id ? memoryOf(run.id) : null;
    setDecisions({}); setDecisionText({}); setEdits(mem ? { ...mem.edits } : {}); setAppliedValue({}); setRefined(mem ? { ...mem.refined } : {}); setRefining(''); setError(''); setErrors({});
    // A "Check & improve" started before the page was left is still running on the server: show it as running and take its result.
    if (mem) for (const [id, promise] of mem.running) {
      setRefining(id);
      promise.then(() => { if (live) { setRefined({ ...mem.refined }); setEdits({ ...mem.edits }); setRefining(''); } });
    } setReady(!(hybrid && run.id));
    if (!isAcademicV2(run) && hybrid && run.id) syllabusCheck.decisions(run.id).then(rows => {
      if (!live) return;
      setDecisions(Object.fromEntries(rows.map(row => [row.suggestionId, row.action])));
      setDecisionText(Object.fromEntries(rows.map(row => [row.suggestionId, row.editedText])));
      setReady(true);
    }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [run?.id]);
  if (!hybrid || isAcademicV2(run)) return null;
  // Accepted or edited recommendations leave the active list: the saved decision is the single source of truth, so a
  // recommendation cannot be applied twice, even after a reload or from another tab.
  const isHandled = s => decisions[s.id] === 'accept' || decisions[s.id] === 'edit';
  const isRejected = s => decisions[s.id] === 'reject';
  const pending = hybrid.suggestions.filter(s => !isHandled(s) && !isRejected(s));
  const handled = hybrid.suggestions.filter(isHandled);
  const decide = async (suggestion, action) => {
    if (decisionLock.current) return;
    decisionLock.current = true;
    setBusy(true); setWorking(suggestion.id); setError('');
    setErrors(current => { const next = { ...current }; delete next[suggestion.id]; return next; });
    try {
      const recordDecision = body => syllabusCheck.decide(run.id, body);
      const id = suggestion.id;
      const rw = refined[id];
      const textToApply = action === 'edit' ? edits[id] : suggestion.replacement;
      const verificationToken = rw?.status === 'verified' && rw.text === textToApply ? rw.verificationToken : undefined;
      const result = await decideSuggestion({ suggestion, action, editedText: edits[id], verificationToken, applyDraft: onApplyDraft, recordDecision });
      if (result.applied) setAppliedValue(current => ({ ...current, [id]: action === 'edit' ? edits[id] : suggestion.replacement }));
      setDecisionText(current => ({ ...current, [id]: action === 'edit' ? edits[id] : null }));
      setDecisions(current => ({ ...current, [id]: result.decision.action }));
    } catch (e) {
      const message = e.message?.startsWith('hybrid.') ? t(e.message) : e.message;
      const text = e.draftSaved ? t('hybrid.savedDecisionFailed', { message }) : message;
      setErrors(current => ({ ...current, [suggestion.id]: text || t('hybrid.applyFailed') }));
    }
    finally { decisionLock.current = false; setBusy(false); setWorking(''); }
  };
  // Check one recommendation against every relationship its text touches (server: lib/syllabuscheck/refine.js). A rewrite the check had to
  // write itself is put in the text box, so that "Apply verified rewrite" applies exactly what was checked. Nothing is applied here.
  const refine = async (suggestion) => {
    if (refining || decisionLock.current) return;
    const id = suggestion.id;
    const draftText = edits[id] ?? suggestion.replacement;
    setRefining(id); setErrors(current => without(current, id)); setRefinedKept(current => without(current, id));
    // The request is registered in panelMemory so a page that was left and opened again can wait for it. It records its own result there,
    // so the answer is kept even when this component is gone by then; the state below only updates the page that is still showing.
    const mem = memoryOf(run.id);
    const job = syllabusCheck.refine(run.id, id, draftText).then(out => {
      mem.refined = { ...mem.refined, [id]: out };
      if (out.status === 'verified' && typeof out.text === 'string') mem.edits = { ...mem.edits, [id]: out.text };
      return { out };
    }, e => ({ error: e })).then(done => { mem.running.delete(id); return done; });
    mem.running.set(id, job);
    const { out, error } = await job;
    if (error) setErrors(current => ({ ...current, [id]: error.message || t('hybrid.refineFailed') }));
    else {
      setRefined({ ...mem.refined });
      if (out.status === 'verified' && typeof out.text === 'string') setEdits({ ...mem.edits });
    }
    setRefining('');
  };
  const maxAttempts = hybrid.policy?.maxRewriteAttempts ?? 2;
  const problems = problemsOf(hybrid, run);

  const hardGates = hardGatesOf(run);
  const { forSuggestion } = linkProblems(problems, hybrid.suggestions);
  const done = hybrid.alignment.status === 'completed';
  // The lock notices only appear when the API billing is out of credits (OpenRouter answers HTTP 402 "Insufficient credits").
  const outOfCredits = !done && /\b402\b|insufficient credits|more credits|out of credits|credit balance|quota/i.test(hybrid.alignment.reason || '');
  return <section className="hy" aria-label={t('hybrid.label')}>
    <div className="hy-body">
    {outOfCredits && <div className="hy-lock" role="alert"><b>{t('hybrid.incomplete')}</b><span>{hybrid.alignment.reason || t('hybrid.incompleteNote')}</span></div>}
    {aiGate === 'advisory'
      // The AI result is advice: it never locks a submit. Only the coded rules (curriculum, grading total, standard sections) do.
      ? (hardGates.length > 0 && outOfCredits && <div className="hy-lock" role="alert"><b>{t('hybrid.hardGateTitle')}</b><span>{t('hybrid.hardGateText')}</span><ul>{hardGates.map(f => <li key={f.id}>{f.message}</li>)}</ul></div>)
      : !hybrid.ready && outOfCredits && <div className="hy-lock" role="alert"><b>{t('hybrid.lockedTitle')}</b><span>{t('hybrid.locked')}</span></div>}
    {error && <div role="alert" className="info-banner warning">{error}</div>}
    {hybrid.suggestions.length > 0 && <details className="hy-recs" open>
      <summary><h4>{t(pending.length === 1 ? 'hybrid.recommendation' : 'hybrid.recommendations', { count: pending.length })}</h4></summary>
      <div className="hy-box">
      {pending.length > 0 && <p className="hy-note">{onApplyDraft ? t('hybrid.applyNote') : t('hybrid.readOnlyNote')}</p>}
      {pending.length === 0 && <div className="hy-clear" role="status">{t('hybrid.allHandled')}</div>}
      {pending.map(s => {
        const stale = !!onApplyDraft && !Object.hasOwn(s, 'originalValue');
        const decided = decisions[s.id];
        const shown = edits[s.id] ?? s.replacement;
        const hasEdit = typeof edits[s.id] === 'string' && !!edits[s.id].trim() && edits[s.id] !== s.replacement;
        const rw = refined[s.id];
        const useRewrite = !!rw && rw.status === 'verified' && rw.usedRewrite && edits[s.id] === rw.text; // the text box still holds exactly what was checked
        const checkable = !!onApplyDraft && canRefine(s) && !stale;
        return <article key={s.id} className={'hy-rec' + (decided ? ' decided ' + decided : '')}>
          <div className="hy-rec-head">
            <strong>{s.title}</strong>
            {s.path && <span className="hy-pill">{suggestionSection(s.path, { tr, t })}</span>}
          </div>
          {forSuggestion[s.id]?.length > 0 && <details className="hy-fixes" open>
            <summary>{t('hybrid.fixes', { count: forSuggestion[s.id].length })}</summary>
            <ul>{forSuggestion[s.id].map(p => <HybridProblem key={p.id} p={p} />)}</ul>
          </details>}
          {typeof s.replacement !== 'string' && <p className="hy-why">{s.text}</p>}
          {typeof s.replacement === 'string' && (onApplyDraft
            ? <label className="hy-edit">
              <span>{t('hybrid.editText')}</span>
              <textarea aria-label={t('hybrid.editLabel', { id: s.id })} rows={3} maxLength={10000} value={shown} onChange={e => { const text = e.target.value; setEditsKept(current => ({ ...current, [s.id]: text })); setRefinedKept(current => (current[s.id] && current[s.id].text !== text ? without(current, s.id) : current)); }} />
            </label>
            // Read-only for everyone but the author in an editable builder (the administrator, or a locked syllabus): the text to read, nothing to change.
            : <div className="hy-suggested"><span>{t('hybrid.suggestedText')}</span><p>{s.replacement}</p></div>)}
          {stale && <p className="hy-hint" role="note">{t('hybrid.cardStale')}</p>}
          {errors[s.id] && <div className="hy-err" role="alert">{errors[s.id]}</div>}
          {rw && <div className={'hy-verify ' + rw.status} role="status">
            {rw.reason === 'no_meaningful_change' && <p>{t('hybrid.refineNoChange')}</p>}
            <p>{t(rw.status === 'blocked' ? 'hybrid.refineBlocked' : rw.usedRewrite ? 'hybrid.refineRewritten' : 'hybrid.refineOk', { checked: rw.stats.checked, improved: rw.stats.improved, worse: rw.stats.worse })}</p>
            {rw.status === 'blocked' && rw.blockers.length > 0 && <details>
              <summary>{t('hybrid.refineBlockers')}</summary>
              <ul>{rw.blockers.map(b => <li key={b.id}><strong>{b.type}</strong> {t('hybrid.label.' + b.from)} → {t('hybrid.label.' + b.to)}{b.why ? ' · ' + b.why : ''}</li>)}</ul>
            </details>}
          </div>}
          {onApplyDraft && <div className="hy-actions">
            <button type="button" className="btn primary" disabled={busy || stale || !ready || refining === s.id} onClick={() => decide(s, (useRewrite || hasEdit) ? 'edit' : 'accept')}>{working === s.id ? t('hybrid.applying') : t(useRewrite ? 'hybrid.applyVerified' : 'hybrid.accept')}</button>
            {checkable && <button type="button" className="btn outline" disabled={busy || !!refining || !ready} onClick={() => refine(s)}>{refining === s.id ? t('hybrid.refining') : t('hybrid.refine')}</button>}
            <button type="button" className="btn ghost" disabled={busy || !ready} onClick={() => decide(s, 'reject')}>{t('hybrid.reject')}</button>
          </div>}
        </article>;
      })}
      {handled.length > 0 && <details className="hy-handled">
        <summary>{t('hybrid.handled', { count: handled.length })}</summary>
        <ul>{handled.map(s => <li key={s.id}>
          <div className="hy-rec-head">
            <strong>{s.title}</strong>
            {s.path && <span className="hy-pill">{suggestionSection(s.path, { tr, t })}</span>}
          </div>
          {errors[s.id] && <div className="hy-err" role="alert">{errors[s.id]}</div>}
        </li>)}</ul>
      </details>}
      </div>
    </details>}
    </div>
  </section>;
}
