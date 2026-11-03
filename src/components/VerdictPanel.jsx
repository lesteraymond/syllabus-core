import { t, tr } from '../i18n/index.js';
import { verdictOf, verdictIssues } from '../lib/complianceView';
import {isAcademicV2,isIntegratedAcademicV2} from '../lib/academicEvaluation';
import AcademicEvaluationPanel from './AcademicEvaluationPanel';

// The advisory academic verdict of one run (server verdict.js): completeness, curriculum and alignment kept apart, what could not be
// checked, and the specific findings with their method, evidence and suggested change. Display only: it never changes the official
// score and never applies a suggestion (accepting one stays in the recommendations above). Renders nothing for an older report.
const status = (s) => t(`verdict.status.${s}`);
const tone = (s) => (s === 'PASS' ? 'ok' : s === 'FAIL' ? 'bad' : 'warn');

export default function VerdictPanel({ run }) {
  if(isAcademicV2(run))return <AcademicEvaluationPanel run={run}/>;
  const v = verdictOf(run);
  if (!v) return isIntegratedAcademicV2(run) ? <AcademicEvaluationPanel run={run}/> : null;
  const issues = verdictIssues(v);
  const pct = v.completeness && Number.isFinite(v.completeness.percent) ? `${Math.round(v.completeness.percent)}%` : t('verdict.completenessNone');
  return (
    <section className="vd" aria-label={t('verdict.title')}>
      <h3 className="vd-title">{t('verdict.title')}</h3>
      <p className="vd-note">{t('verdict.note')}</p>
      {run.hybrid.outcomeSource && <p className="vd-note">{t('verdict.outcomeSource', { source: run.hybrid.outcomeSource })}</p>}
      <dl className="vd-grid">
        <div><dt>{t('verdict.completeness')}</dt><dd>{pct}</dd></div>
        <div><dt>{t('verdict.curriculum')}</dt><dd><span className={`hy-pill vd-${tone(v.curriculum)}`}>{status(v.curriculum)}</span></dd></div>
        <div><dt>{t('verdict.alignment')}</dt><dd><span className={`hy-pill vd-${tone(v.alignment)}`}>{status(v.alignment)}</span></dd></div>
        <div><dt>{t('verdict.overall')}</dt><dd><span className={`hy-pill vd-${v.overall === 'COMPLIANT' ? 'ok' : v.overall === 'NOT_COMPLIANT' ? 'bad' : 'warn'}`}>{t(`verdict.overall.${v.overall}`)}</span></dd></div>
      </dl>
      {v.states && (
        <dl className="vd-grid" aria-label={t('verdict.states.title')}>
          {v.states.identity && <div><dt>{t('verdict.states.identity')}</dt><dd><span className={`hy-pill vd-${v.states.identity.status === 'verified' ? 'ok' : 'bad'}`}>{t(`verdict.identity.${v.states.identity.status}`)}</span></dd></div>}
          <div><dt>{t('verdict.states.structure')}</dt><dd><span className={`hy-pill vd-${tone(v.states.structure)}`}>{status(v.states.structure)}</span></dd></div>
          <div><dt>{t('verdict.states.values')}</dt><dd><span className={`hy-pill vd-${tone(v.states.values)}`}>{status(v.states.values)}</span></dd></div>
          {v.states.references && ['format', 'relevance', 'authenticity'].map(k => <div key={k}><dt>{t(`verdict.states.references.${k}`)}</dt><dd><span className={`hy-pill vd-${tone(v.states.references[k])}`}>{status(v.states.references[k])}</span></dd></div>)}
        </dl>
      )}
      {v.states && v.states.identity && v.states.identity.elsewhere.length > 0 && <p className="vd-note">{t('verdict.identity.elsewhere', { where: v.states.identity.elsewhere.map(x => `${x.program} ${x.curriculumYear}`).join(', ') })}</p>}
      {Array.isArray(v.informational) && v.informational.map((i, k) => <p key={k} className="vd-note">{t('verdict.titleFormat', { entered: i.entered, approved: i.approved })}</p>)}
      {v.unverified && v.unverified.length > 0 && <p className="vd-note">{t('verdict.partial', { count: v.unverified.length })}</p>}
      {issues.length > 0 && (
        <details className="vd-issues" open>
          <summary>{t('verdict.issues')} ({issues.length})</summary>
          <ul>
            {issues.map((f, i) => (
              <li key={`${f.ruleId}:${f.path}:${i}`}>
                <div className="vd-row">
                  <strong>{f.ruleId}</strong>
                  <span className={`hy-pill vd-${tone(f.status)}`}>{status(f.status)}</span>
                  <span className="hy-pill">{t(`verdict.method.${f.method}`)}</span>
                  {f.verification && !(f.verification === 'deterministic' && f.method === 'deterministic') && f.verification !== 'provisional_identity' && <span className="hy-pill">{t(`verdict.verification.${f.verification}`)}</span>}
                  {f.week && <span className="hy-pill">{t('verdict.week', { week: f.week })}</span>}
                  {f.responsible && f.status !== 'PASS' && f.status !== 'NOT_CHECKED' && <span className="hy-pill">{t(`verdict.responsible.${f.responsible}`)}</span>}
                  {f.scope === 'course' && f.clo && <span className="hy-pill">{t('verdict.scope.course')}</span>}
                  {f.clo && <span className="hy-pill">{t('verdict.clo', { n: f.clo })}</span>}
                  {f.coverageState && <span className="hy-pill">{t(`verdict.coverage.${f.coverageState}`)}</span>}
                  {f.carriedBy && <span className="hy-pill">{t(`verdict.carriedBy.${f.carriedBy}`)}</span>}
                  {f.authenticity && <span className="hy-pill">{t(`verdict.authenticity.${f.authenticity}`)}</span>}
                  {f.definitions && f.definitions !== 'configured' && <span className="hy-pill">{t(`verdict.definitions.${f.definitions}`)}</span>}
                  {f.identityBasis === 'provisional' && <span className="hy-pill vd-warn">{t('verdict.verification.provisional_identity')}</span>}
                  {f.classification && f.classification.canonicalCoreValue && <span className="hy-pill">{t('verdict.coreValue', { value: f.classification.canonicalCoreValue })}</span>}
                  {f.classification && f.classification.supportingValue && f.classification.supportingValue.length > 0 && <span className="hy-pill">{t('verdict.supportingValue', { values: f.classification.supportingValue.join(', ') })}</span>}
                  {f.responseNote && <span className="hy-pill vd-warn">{t(`verdict.responseNote.${f.responseNote}`)}</span>}
                </div>
                {f.issueMessages && f.issueMessages.length > 1 ? <p>{f.issueMessages.map(m => tr(m)).join(' ')}</p> : f.explanation && <p>{tr(f.explanation)}</p>}
                {f.withheld && <p className="vd-note"><b>{t('verdict.withheldTitle')}:</b> {t(`verdict.withheld.${f.withheld}`)}</p>}
                {[['explanation', 'explanationReview', 'explanation'], ['draft', 'draftReview', 'draft'], ['draftWarning', 'draftWarnings', 'draftWarnings']].map(([kind, field, evidenceKind]) => {
                  const codes = [...new Set(f[field] || [])];
                  if (!codes.length) return null;
                  return <div className="vd-note" key={kind}>
                    <b>{t(`verdict.review.${kind}Title`)}</b>
                    <p>{t(`verdict.review.${kind}Note`)}</p>
                    <ul>{codes.map(code => {
                      const evidence = (f.reviewEvidence?.[evidenceKind] || []).find(r => r.code === code);
                      const key = `verdict.review.code.${code}`, message = t(key);
                      return <li key={code}>{message === key ? t('verdict.review.code.unknown') : message}{evidence?.evidence && <> {t('verdict.review.phrase', { phrase: evidence.evidence })}</>}</li>;
                    })}</ul>
                  </div>;
                })}
                {f.supportingWeeks && (f.supportingWeeks.checked.length > 0 || f.supportingWeeks.cited.length > 0) && <p className="vd-note">{t('verdict.supportingWeeks', { weeks: [...f.supportingWeeks.checked, ...f.supportingWeeks.cited].join(', ') })}</p>}
                {f.gaps && <p className="vd-note"><b>{t('verdict.gap')}:</b> {tr(f.gaps)}</p>}
                {f.actual && <p className="vd-note"><b>{t('verdict.original')}:</b> {f.actual}</p>}
                {f.reference && <p className="vd-note"><b>{t('verdict.reference')}:</b> {f.reference}</p>}
                {!f.withheld && !f.draftReview?.length && f.recommendation && <p className="vd-note"><b>{t('verdict.suggestion')}:</b> {tr(f.recommendation)}</p>}
              </li>
            ))}
          </ul>
          {v.omitted > 0 && <p className="vd-note">{t('verdict.omitted', { count: v.omitted })}</p>}
        </details>
      )}
      {isIntegratedAcademicV2(run) && <AcademicEvaluationPanel run={run} />}
    </section>
  );
}
