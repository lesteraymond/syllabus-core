import { useEffect, useRef, useState } from 'react';
import { t, tr } from '../i18n';
import { integratedAcademicV2Of, isAcademicV2Preview } from '../lib/academicEvaluation';
import { syllabusCheck } from '../lib/api';
import { decideSuggestion } from '../lib/hybridCheck';
import { memoryOf } from '../lib/panelMemory';
import { canRefine, suggestionSection } from '../lib/hybridView';

const without = (map, key) => { const next = { ...map }; delete next[key]; return next; };
const status = value => t('academicV2.status.' + value);
function requirementName(r) {
  if (r.id.startsWith('weekly:')) return t('academicV2.week', { week: r.week || r.id.split(':')[1] }) + ' · ' + t('academicV2.type.' + r.id.split(':').at(-1));
  const clo = /^course\.clo(\d+)\.(PO|EGA)$/.exec(r.id);
  if (clo) return t('academicV2.clo' + clo[2], { clo: Number(clo[1]) + 1 });
  if (r.id === 'references.APA7text' || r.id.startsWith('references:')) return t('academicV2.apa');
  return t('academicV2.requirement.' + r.id);
}

function RelationshipEvidence({ relationship: r }) {
  const evidence = r.evidence || {}, classification = r.classificationContext, marked = r.cloClassification, needsReview = r.correction && r.correction.decision !== 'NO_CHANGE';
  return <details key={r.id}>
    <summary><code>{r.id}</code> · {status(r.status)}</summary>
    <dl><dt>{t('academicV2.source')}</dt><dd className="typed-text">{r.sourceText || '—'}</dd>
      <dt>{t('academicV2.target')}</dt><dd className="typed-text">{r.targetText || '—'}</dd>
      <dt>{t('academicV2.explanation')}</dt><dd>{r.reviewRequirements?.includes('clo_classification_missing') ? t('academicV2.cloClassificationMissing', { clo: String(/^clo(\d+)-/.exec(r.id || '')?.[1] ? 'CLO ' + (Number(/^clo(\d+)-/.exec(r.id)[1]) + 1) : '') }) : r.explanation}</dd>
      {(evidence.sourceQuote || evidence.targetQuote) && <><dt>{t('academicV2.quotes')}</dt><dd>{evidence.sourceQuote} / {evidence.targetQuote}</dd></>}
      {classification && <><dt>{t('academicV2.classificationContext')}</dt><dd>
        <p>{classification.clo}: {classification.classification}{marked?.stored ? ` · ${t('academicV2.savedClassification')}: ${marked.stored.level || t('academicV2.missing')} (${marked.stored.status})` : ''}</p>
        {classification.weekContent && <p>{t('academicV2.weekContext', { week: classification.week })}: {classification.weekContent}</p>}
        {classification.cloLessons?.length > 0 && <ul>{classification.cloLessons.map((lesson, i) => <li key={`${lesson.week}:${i}`}>
          {t('academicV2.week', { week: lesson.week })}{lesson.thisLesson ? ` · ${t('academicV2.currentLesson')}` : ''}: {lesson.ilo || '—'}
        </li>)}</ul>}
      </dd></>}
      {needsReview && <><dt>{t('academicV2.correctionTarget')}</dt><dd>{r.correction.field || '—'}{r.correction.path ? ` · ${r.correction.path}` : ''}</dd>
        {r.correction.reason && <><dt>{t('academicV2.correctionReason')}</dt><dd>{r.correction.reason}</dd></>}</>}
      {r.recommendationType && r.recommendationType !== 'NO_CHANGE' && <><dt>{t('academicV2.recommendation')}</dt><dd>{r.recommendationType}</dd></>}
      {r.recommendedCorrection && <><dt>{t('academicV2.draftProposal')}</dt><dd className="typed-text">{r.recommendedCorrection}</dd></>}
      {needsReview && <><dt>{t('academicV2.reviewRequired')}</dt><dd>{t('academicV2.humanReviewOnly')}</dd></>}
      {r.reviewRequirements?.length > 0 && <><dt>{t('academicV2.reviewNotes')}</dt><dd>{r.reviewRequirements.join(', ')}</dd></>}
    </dl>
  </details>;
}

export default function AcademicEvaluationPanel({ run, onApplyDraft }) {
  const preview = isAcademicV2Preview(run), integrated = integratedAcademicV2Of(run);
  if (!preview && !integrated) return null;
  const profile = preview ? run : integrated, academic = profile.academic || {}, compliance = profile.compliance || {};
  const requirements = academic.requirements || [], relationships = academic.relationships || [], actions = academic.remediation?.actions || [];
  const suggestions = academic.suggestions || profile.suggestions || run?.hybrid?.suggestions || [];
  const requiredIds = new Set(requirements.flatMap(r => r.evidenceIds || []));
  const alignmentStatus = profile.alignment?.status;
  const connectionLabel = alignmentStatus === 'not_evaluated' ? status('NOT_CHECKED') : alignmentStatus === 'partially_evaluated' ? status('PARTIALLY_EVALUATED') : alignmentStatus === 'completed' ? status(academic.disposition) : status('NOT_CHECKED');

  const [edits, setEdits] = useState({});
  const [decisions, setDecisions] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [working, setWorking] = useState('');
  const [appliedValue, setAppliedValue] = useState({});
  const [decisionText, setDecisionText] = useState({});
  const [refining, setRefining] = useState('');
  const [refined, setRefined] = useState({});
  const [ready, setReady] = useState(false);
  const decisionLock = useRef(false);

  const keep = (field, set) => update => set(current => {
    const next = typeof update === 'function' ? update(current) : update;
    if (run?.id) memoryOf(run.id)[field] = next;
    return next;
  });
  const setEditsKept = keep('edits', setEdits);

  useEffect(() => {
    let live = true;
    const mem = run?.id ? memoryOf(run.id) : null;
    setDecisions({}); setDecisionText({}); setEdits(mem ? { ...mem.edits } : {}); setAppliedValue({}); setRefined(mem ? { ...mem.refined } : {}); setRefining(''); setError(''); setErrors({});
    if (mem) for (const [id, promise] of mem.running) {
      setRefining(id);
      promise.then(() => { if (live) { setRefined({ ...mem.refined }); setEdits({ ...mem.edits }); setRefining(''); } });
    }
    setReady(!(onApplyDraft && run?.id));
    if (onApplyDraft && run?.id) syllabusCheck.decisions(run.id).then(rows => {
      if (!live) return;
      setDecisions(Object.fromEntries(rows.map(row => [row.suggestionId, row.action])));
      setDecisionText(Object.fromEntries(rows.map(row => [row.suggestionId, row.editedText])));
      setReady(true);
    }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [run?.id, !!onApplyDraft]);

  const isHandled = s => decisions[s.id] === 'accept' || decisions[s.id] === 'edit';
  const isRejected = s => decisions[s.id] === 'reject';

  const decide = async (suggestion, action) => {
    if (decisionLock.current) return;
    decisionLock.current = true;
    setBusy(true); setWorking(suggestion.id); setError('');
    setErrors(current => without(current, suggestion.id));
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
    } finally {
      decisionLock.current = false; setBusy(false); setWorking('');
    }
  };

  const refine = async (suggestion) => {
    if (refining || decisionLock.current) return;
    const id = suggestion.id;
    const draftText = edits[id] ?? suggestion.replacement;
    setRefining(id); setErrors(current => without(current, id)); setRefined(current => without(current, id));
    const mem = run?.id ? memoryOf(run.id) : null;
    const job = syllabusCheck.refine(run.id, id, draftText).then(out => {
      if (mem) mem.refined = { ...mem.refined, [id]: out };
      if (out.status === 'verified' && typeof out.text === 'string') {
        if (mem) mem.edits = { ...mem.edits, [id]: out.text };
      }
      return { out };
    }, e => ({ error: e })).then(done => { if (mem) mem.running.delete(id); return done; });
    if (mem) mem.running.set(id, job);
    const { out, error } = await job;
    if (error) setErrors(current => ({ ...current, [id]: error.message || t('hybrid.refineFailed') }));
    else {
      setRefined(cur => ({ ...cur, [id]: out }));
      if (out.status === 'verified' && typeof out.text === 'string') setEdits(cur => ({ ...cur, [id]: out.text }));
    }
    setRefining('');
  };

  const suggestionMap = new Map(suggestions.map(s => [s.id, s]));

  return <section className="vd" aria-label={t('academicV2.title')} data-policy={profile.evaluationPolicy?.id || profile.version}>
    <h3>{t('academicV2.title')}{run?.stale && <span className="hy-pill warn" role="status" data-testid="stale-chip"> {t('hybrid.staleChip')}</span>}</h3>
    <p className="vd-note">{preview ? t('academicV2.preview') : t('academicV2.integrated')}</p>
    <code>{profile.evaluationPolicy?.id || profile.version}</code>
    {preview ? <dl className="vd-grid">
      <div><dt>{t('academicV2.compliance')}</dt><dd><output>{compliance.score ?? '—'}</output></dd><small>{t('academicV2.threshold', { mark: compliance.passThreshold })}</small></div>
      <div><dt>{t('academicV2.academic')}</dt><dd>{status(academic.disposition)}</dd><small>{t('academicV2.noAcademicScore')}</small></div>
    </dl> : <dl className="vd-grid">
      <div><dt>{t('academicV2.academic')}</dt><dd>{connectionLabel}</dd><small>{t('academicV2.noAcademicScore')}</small></div>
      <div><dt>{t('academicV2.providerStatus')}</dt><dd>{status(alignmentStatus === 'completed' ? 'EVALUATED' : alignmentStatus === 'partially_evaluated' ? 'PARTIALLY_EVALUATED' : 'NOT_CHECKED')}</dd>
        {profile.alignment?.provider && <small>{profile.alignment.provider}{profile.alignment.model ? ` · ${profile.alignment.model}` : ''}</small>}</div>
    </dl>}
    <p>{preview ? t('academicV2.noApproval') : t('academicV2.advisoryOnly')}</p>
    {preview && <p>{t('academicV2.mocked')}</p>}
    {!preview && profile.alignment?.reason && <p className="vd-note">{profile.alignment.reason}</p>}
    {academic.coverage && <p>{t('academicV2.coverage', { supported: academic.coverage.supported, missing: academic.coverage.notEvaluated, total: academic.coverage.required })}</p>}
    {integrated ? <>
      <h4>{t('academicV2.aiRequirements')}</h4>
      <ul>{requirements.filter(r => r.kind === 'ai_academic_alignment').map(r => <li key={r.id}><strong>{requirementName(r)}</strong> — {status(r.status)} <code>{r.id}</code></li>)}</ul>
      <h4>{t('academicV2.deterministicRequirements')}</h4>
      <ul>{requirements.filter(r => r.kind === 'deterministic_compliance').map(r => <li key={r.id}><strong>{requirementName(r)}</strong> — {status(r.status)} <code>{r.id}</code></li>)}</ul>
    </> : <><h4>{t('academicV2.requirements')}</h4>
      <ul>{requirements.map(r => <li key={r.id}><strong>{requirementName(r)}</strong> — {status(r.status)} <code>{r.id}</code></li>)}</ul>
    </>}
    <h4>{t('academicV2.evidence')}</h4>
    {relationships.filter(r => requiredIds.has(r.id)).map(r => <RelationshipEvidence key={r.id} relationship={r} />)}
    <h4>{t('academicV2.actions')}</h4>
    {error && <div role="alert" className="info-banner warning">{error}</div>}
    {actions.length ? (
      !onApplyDraft ? (
        <ul>{actions.map(a => {
          const s = suggestionMap.get(a.id);
          const decided = s ? decisions[s.id] : null;
          return <li key={a.id}>
            {a.field && <strong>{t('academicV2.correctionTarget')}: {a.field}{a.path ? ` · ${a.path}` : ''}. </strong>}
            {a.correction} <small>{(a.relationshipIds || []).join(', ')} · {t('academicV2.humanReviewOnly')}</small>
            {decided && <span className="hy-pill quiet" role="status"> · {t('hybrid.decision.' + decided)}</span>}
          </li>;
        })}</ul>
      ) : (
        <ul className="hy-box" style={{ listStyle: 'none', paddingLeft: 0 }}>{actions.map(a => {
          const s = suggestionMap.get(a.id);
          if (!s) {
            return <li key={a.id} style={{ marginBottom: '1rem' }}>
              {a.field && <strong>{t('academicV2.correctionTarget')}: {a.field}{a.path ? ` · ${a.path}` : ''}. </strong>}
              {a.correction} <small>{(a.relationshipIds || []).join(', ')} · {t('academicV2.humanReviewOnly')}</small>
            </li>;
          }
          if (isRejected(s)) return null;
          const handled = isHandled(s);
          const decided = decisions[s.id];
          const stale = !Object.hasOwn(s, 'originalValue');
          const shown = edits[s.id] ?? s.replacement;
          const hasEdit = typeof edits[s.id] === 'string' && !!edits[s.id].trim() && edits[s.id] !== s.replacement;
          const rw = refined[s.id];
          const currentText = edits[s.id] ?? s.replacement;
          const isVerified = !!rw && rw.status === 'verified' && rw.text === currentText;
          const useRewrite = isVerified && rw.usedRewrite && (edits[s.id] === rw.text);
          const checkable = canRefine(s) && !stale;

          if (handled) {
            return <li key={a.id} className="hy-rec decided">
              <div className="hy-rec-head">
                <strong>{s.title || a.correction}</strong>
                {s.path && <span className="hy-pill">{suggestionSection(s.path, { tr, t })}</span>}
              </div>
              {errors[s.id] && <div className="hy-err" role="alert">{errors[s.id]}</div>}
            </li>;
          }

          return <li key={a.id} className={'hy-rec' + (decided ? ' decided ' + decided : '')}>
            <div className="hy-rec-head">
              <strong>{s.title || a.correction}</strong>
              {s.path && <span className="hy-pill">{suggestionSection(s.path, { tr, t })}</span>}
            </div>
            {a.field && <p><strong>{t('academicV2.correctionTarget')}:</strong> {a.field}{a.path ? ` · ${a.path}` : ''}</p>}
            <p className="hy-why">{s.text || a.correction} <small>{(a.relationshipIds || []).join(', ')} · {t('academicV2.humanReviewOnly')}</small></p>
            {typeof s.replacement === 'string' && (
              <label className="hy-edit">
                <span>{t('hybrid.editText')}</span>
                <textarea aria-label={t('hybrid.editLabel', { id: s.id })} rows={3} maxLength={10000} value={shown} onChange={e => { const text = e.target.value; setEditsKept(cur => ({ ...cur, [s.id]: text })); setRefined(cur => (cur[s.id] && cur[s.id].text !== text ? without(cur, s.id) : cur)); }} />
              </label>
            )}
            {stale && <p className="hy-hint" role="note">{t('hybrid.cardStale')}</p>}
            {!rw && checkable && <p className="hy-hint" role="note">{t('academicV2.verifyFirst')}</p>}
            {errors[s.id] && <div className="hy-err" role="alert">{errors[s.id]}</div>}
            {rw && <div className={'hy-verify ' + rw.status} role="status">
              {rw.reason === 'no_meaningful_change' && <p>{t('hybrid.refineNoChange')}</p>}
              <p>{t(rw.status === 'blocked' ? 'hybrid.refineBlocked' : rw.usedRewrite ? 'hybrid.refineRewritten' : 'hybrid.refineOk', { checked: rw.stats.checked, improved: rw.stats.improved, worse: rw.stats.worse })}</p>
              {rw.status === 'blocked' && rw.blockers?.length > 0 && <details>
                <summary>{t('hybrid.refineBlockers')}</summary>
                <ul>{rw.blockers.map(b => <li key={b.id}><strong>{b.type}</strong> {t('hybrid.label.' + b.from)} → {t('hybrid.label.' + b.to)}{b.why ? ' · ' + b.why : ''}</li>)}</ul>
              </details>}
            </div>}
            <div className="hy-actions">
              <button type="button" className="btn primary" disabled={busy || stale || !ready || refining === s.id || !isVerified} onClick={() => decide(s, (useRewrite || hasEdit) ? 'edit' : 'accept')}>{working === s.id ? t('hybrid.applying') : t(useRewrite ? 'hybrid.applyVerified' : 'hybrid.accept')}</button>
              {checkable && <button type="button" className="btn outline" disabled={busy || !!refining || !ready} onClick={() => refine(s)}>{refining === s.id ? t('hybrid.refining') : t('hybrid.refine')}</button>}
              <button type="button" className="btn ghost" disabled={busy || !ready} onClick={() => decide(s, 'reject')}>{t('hybrid.reject')}</button>
            </div>
          </li>;
        })}</ul>
      )
    ) : <p>{t('academicV2.noActions')}</p>}
    {preview && academic.diagnostics && <details><summary>{t('academicV2.diagnostics')}</summary>{[...(academic.diagnostics.iloAssessment || []), ...(academic.diagnostics.c2 || [])].map(r => <p key={r.id}><code>{r.id}</code> — {status(r.status)}: {r.explanation}</p>)}</details>}
    <h4>{t('academicV2.limitations')}</h4>
    <p>{t('academicV2.scope')}</p>
    {academic.limitations?.map((limitation, i) => <p key={i}>{limitation}</p>)}
    {preview && academic.references?.valueDefinitions?.status !== 'configured' && <p>{t('academicV2.valueApproval')}</p>}
    {academic.remediation?.rootReviews?.length > 0 && <p>{t('academicV2.rootReview')}</p>}
    {academic.references?.issues?.map(issue => <p key={issue.code}>{t('academicV2.reference.' + issue.code)}</p>)}
  </section>;
}
