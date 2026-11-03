import { t } from '../i18n';

// One problem the checker found: what it is, how serious, what it cost, and the evidence. Used on the recommendation that fixes it
// and in the list of problems that have no draft. It only displays (shaped by lib/hybridView.js).
export default function HybridProblem({ p }) {
  return (
    <li className="hy-problem">
      <div className="hy-problem-head">
        <strong>{p.title}</strong>
        {p.label && <span className={'hy-pill ' + (p.severity === 'high' ? 'bad' : 'warn')}>{t(`hybrid.label.${p.label}`)}</span>}
        {p.advisory && <span className="hy-pill quiet">{t('hybrid.advisory')}</span>}
        {p.points > 0 && <span className="hy-pill bad">{t('hybrid.pts', { points: p.points })}</span>}
        {p.where && <span className="hy-pill quiet">{t('hybrid.where', { where: p.where })}</span>}
      </div>
      {p.detail && <p>{p.detail}</p>}
      {(p.sourceQuote || p.targetQuote) && <div className="hy-quotes">
        {p.sourceQuote && <blockquote><small>{t('hybrid.quoteSource')}</small>{p.sourceQuote}</blockquote>}
        {p.targetQuote && <blockquote><small>{t('hybrid.quoteTarget')}</small>{p.targetQuote}</blockquote>}
      </div>}
    </li>
  );
}
