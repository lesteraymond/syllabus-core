import { tr } from '../i18n/index.js';
import { t as translateUI } from '../i18n/index.js';
import { Icon } from './ui';
import { STAGE_LABELS } from '../lib/roles';
import { progressSteps } from '../lib/reviewView';

// The review progress: the dean, the Asst. VPAA, the LIC Director and the VPAA, in the order they review. Each step shows only where it stands:
// cleared (a reviewer also sees who cleared it), reviewing now, returned for revision, rejected, approved, or waiting. Who returned or approved it is
// not repeated here: the version history and the comments say so. Built from the same stages the server enforces (lib/reviewView.js progressSteps),
// so it moves when a stage clears, when a syllabus is returned and when a resubmission goes back to the reviewer who returned it.
const ICON = { cleared: 'checkCircle', current: 'underReview', returned: 'revise', waiting: 'hourglassMedium' };
const LABELS = { ...STAGE_LABELS, vpaa: 'VPAA' };

function detail(step) {
  if (step.state === 'cleared') return step.key === 'vpaa' ? translateUI('reviewChain.approvedStep') : step.by || translateUI('reviewChain.clearedStep');
  if (step.state === 'current') return translateUI('reviewChain.now');
  if (step.state === 'returned') return translateUI(step.action === 'reject' ? 'reviewChain.rejectedStep' : 'reviewChain.returnedStep');
  return translateUI('reviewChain.waiting');
}

export default function ReviewProgress({ stages, status, decision, approved, className = '' }) {
  const steps = progressSteps(stages, status, decision, approved);
  if (!steps.length) return null;
  return (
    <ol className={'rp-stages ' + className} aria-label={translateUI('reviewChain.stagesLabel')} data-testid="review-progress">
      {steps.map((step) => (
        <li key={step.key} className={step.state} aria-current={step.state === 'current' ? 'step' : undefined} data-step={step.key} data-state={step.state}>
          <Icon name={step.state === 'returned' && step.action === 'reject' ? 'denied' : ICON[step.state]} size={18} />
          <span><strong>{tr(LABELS[step.key])}</strong><small>{detail(step)}</small></span>
        </li>
      ))}
    </ol>
  );
}
