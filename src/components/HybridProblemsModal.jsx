import { useRef } from 'react';
import CatalogModalPortal from './CatalogModalPortal';
import { useModalLayer } from './useModalLayer';
import HybridProblem from './HybridProblem';
import { groupBySeverity } from '../lib/hybridView';
import { t } from '../i18n';

// The problems that have no draft recommendation to accept (a course code outside the curriculum, a broken link, a grading total),
// grouped by how serious they are; the ones a recommendation fixes are shown on that recommendation. It only displays: the problems are
// shaped by lib/hybridView.js from the stored run. Esc, focus, stacking and scroll lock come from useModalLayer, so it also works
// when the panel is itself inside another dialog (the administrator's compliance modal).
export default function HybridProblemsModal({ problems, onClose }) {
  const dialog = useRef(null);
  useModalLayer(dialog, onClose);
  return (
    <CatalogModalPortal>
      <div className="overlay" onClick={onClose}>
        <div className="modal hy-modal" role="dialog" aria-modal="true" aria-labelledby="hy-modal-title" tabIndex={-1} ref={dialog} onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h3 id="hy-modal-title">{t('hybrid.noDraftTitle', { count: problems.length })}</h3>
          </div>
          <div className="modal-body hy hy-modal-body">
            {groupBySeverity(problems).map(g => <div key={g.key} className={'hy-group ' + g.key}>
              <h5>{t(`hybrid.sev.${g.key}`)}</h5>
              <ul>{g.items.map(p => <HybridProblem key={p.id} p={p} />)}</ul>
            </div>)}
          </div>
          <div className="modal-foot">
            <button type="button" className="btn outline" onClick={onClose}>{t('hybrid.closeProblems')}</button>
          </div>
        </div>
      </div>
    </CatalogModalPortal>
  );
}
