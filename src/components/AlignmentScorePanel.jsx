import { t } from '../i18n';

// AI Alignment Score (server: syllabuscheck/alignmentScore.js): a SHADOW score by Outcome-Based Education area, shown beside the official score
// and never in its place. It never changes the official score, the pass mark or a submission.
const AREAS = ['program', 'lesson', 'activities', 'assessment', 'values'];
const CHECKS = ['week1', 'week2', 'descriptionTitle', 'descriptionPlan', 'planSequence', 'cloSet', 'references'];
const MARK = { ALIGNED: '✓', PARTIALLY_ALIGNED: '◐', NOT_ALIGNED: '✗', NOT_CHECKED: '–' };

export default function AlignmentScorePanel({ run }) {
  const a = run?.hybrid?.alignmentScore;
  if (!a || a.score === null || a.score === undefined) return null;
  const provisional = a.status !== 'shadow';
  return (
    <details className="hy-recs hy-alignment-score" open>
      <summary>
        <h4>
          {t('alignmentScore.title')}: {a.score}/100
          <span className="hy-pill"> {t(provisional ? 'alignmentScore.provisional' : 'alignmentScore.shadow')}</span>
        </h4>
      </summary>
      <div className="hy-box">
        <p className="hy-note">{t('alignmentScore.note')}</p>
        {a.band && <p><strong>{t(`alignmentScore.band.${a.band}`)}</strong></p>}
        {a.bandCapped && <p className="hy-hint" role="note">{t('alignmentScore.bandCapped', { band: t(`alignmentScore.band.${a.uncappedBand}`) })}</p>}
        {Array.isArray(a.seriousProblems) && a.seriousProblems.length > 0 && (
          <>
            <h5>{t('alignmentScore.seriousTitle', { count: a.seriousProblems.length })}</h5>
            <ul>
              {a.seriousProblems.map((p) => (
                <li key={`${p.kind}:${p.item}`}>{t(`alignmentScore.serious.${p.kind}`, { week: p.week ?? '?', ilo: p.ilo ?? 1, clo: p.clo ?? '?' })}</li>
              ))}
            </ul>
          </>
        )}
        <p className="hy-hint">{t('alignmentScore.coverage', { percent: a.coverage.percent, checked: a.coverage.checked, counted: a.coverage.counted })}</p>
        {provisional && <p className="hy-hint" role="note">{t('alignmentScore.provisionalNote', { min: Math.round(a.minCoverage * 100) })}</p>}
        <ul className="hy-areas" style={{ listStyle: 'none', paddingLeft: 0 }}>
          {AREAS.map((area) => {
            const x = a.areas[area];
            if (!x) return null;
            return (
              <li key={area} style={{ margin: '0.35rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span>{t(`alignmentScore.area.${area}`)}</span>
                  <span>{x.points === null ? t('alignmentScore.notReached') : `${x.points}/${x.weight}`}</span>
                </div>
                {x.points !== null && (
                  <div aria-hidden="true" style={{ height: '6px', background: 'var(--line, #e2e8f0)', borderRadius: '3px' }}>
                    <div style={{ width: `${x.percent}%`, height: '6px', borderRadius: '3px', background: x.percent >= 90 ? '#16a34a' : x.percent >= 79 ? '#ca8a04' : '#dc2626' }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {a.areasLeftOut.length > 0 && <p className="hy-hint">{t('alignmentScore.leftOut')}</p>}
        {Object.keys(a.checklist || {}).length > 0 && (
          <>
            <h5>{t('alignmentScore.checklist')}</h5>
            <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
              {CHECKS.filter((key) => a.checklist[key]).map((key) => (
                <li key={key}>{MARK[a.checklist[key]] || '–'} {t(`alignmentScore.check.${key}`)}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </details>
  );
}
