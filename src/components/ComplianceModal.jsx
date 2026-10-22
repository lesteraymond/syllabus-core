import StableButton from './StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useRef } from 'react';
import { useCountUp } from '../lib/useCountUp';
import { useModalLayer } from './useModalLayer';
import ComplianceCard from '../views/ComplianceCard';
import { isLocked, ringAngle, runState, stamp, tone } from '../lib/complianceView';

// One syllabus's stored compliance check, in a dialog: who and what it is, the score ring, the six areas, then the shared
// ComplianceCard (recommendations, blockers, findings). It only displays, and only reads: a syllabus is checked once, from the picker,
// and after that its check is opened from the history. The page loads the run and polls while recommendations are still being written.
//   syllabus  { courseCode, courseTitle, title, facultyName, programCode, programName }     run   the stored run (or null)
//   error     a message to show      isLatest  false when the run is an earlier check opened from the history
// One of the six areas: the bar and its number climb from 0 together, one row after another (like the card's).
function CmArea({ a, at, index }) {
  const delay = 120 + index * 110;
  const shown = useCountUp(a.score === null ? 0 : a.score, { delay, duration: 1100 });
  return (
    <div className={'cm-area ' + at}>
      <span>{tr(a.name)}</span>
      <b>{a.score === null ? '—' : shown + '%'}</b>
      <div className="bar thin" role="img" aria-label={tr(a.name) + ' ' + (a.score === null ? tr('not scored') : a.score + ' ' + tr('percent'))}><i className="area-fill" style={{ width: (a.score === null ? 0 : a.score) + '%', transitionDelay: delay + 'ms' }} /></div>
    </div>
  );
}

export default function ComplianceModal({ syllabus, run, isLatest = true, error = '', onClose, onOpenDraft, onApprove, approvalDisabled = true, approving = false, editing = false }) {
  const dialog = useRef(null);
  useModalLayer(dialog, onClose); // Esc closes, focus stays inside and returns to the button that opened it

  const actionBusy = approving || editing;
  const state = runState(run);
  const shown = useCountUp(state === 'scored' ? run.overall : 0); // the score counts up from 0 when the dialog opens
  const t = state === 'scored' ? tone(run.overall, run.passThreshold) : 'none';
  const program = syllabus.programCode ? syllabus.programCode + (syllabus.programName ? ' · ' + syllabus.programName : '') : (syllabus.programName || 'No program');
  const title = syllabus.courseTitle || syllabus.title;
  const locked = isLocked(syllabus);
  const when = run ? stamp(run.createdAt) : '';

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal cm-modal" role="dialog" aria-modal="true" aria-labelledby="cm-title" aria-busy={actionBusy || undefined} tabIndex={-1} ref={dialog} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head cm-head">
          <div>
            <h3 id="cm-title">{syllabus.courseCode + (title ? ' — ' + title : '')}</h3>
            <small>{(syllabus.facultyName || tr('Unknown faculty')) + ' · ' + program}</small>
            {when && <small className="cm-when">{translateUI("ui.checked_aca936") + when + (run && run.versionLabel ? ' · ' + tr('Version') + ' ' + run.versionLabel : '')}</small>}
          </div>
        </div>

        <div className="modal-body cm-body">
          {error && <div className="info-banner warning" role="alert">{tr(error)}</div>}
          {!isLatest && <div className="info-banner cm-earlier">{translateUI("ui.this_is_an_earlier_check_newer_results_are_in_the_history_32d14b")}</div>}
          {isLatest && locked && <div className="info-banner cm-earlier">{translateUI("ui.this_syllabus_is_approved_so_this_check_is_final_6d57e9")}</div>}

          <div className="cm-score">
            {state === 'scored'
              ? <div className={'big-ring cm-ring ' + t} style={{ '--p': ringAngle(shown) }} role="img" aria-label={translateUI("ui.compliance_score_7a084d") + run.overall + translateUI("ui.percent_c72154") + tr(run.band)}><div><strong>{shown}%</strong><small>{tr(run.band)}</small></div></div>
              : <div className="big-ring cm-ring none" role="img" aria-label={translateUI("ui.no_score_yet_3662ab")}><div><strong>—</strong><small>{state === 'insufficient' ? translateUI("ui.not_enough_content_1c0e67") : translateUI("ui.not_checked_22705e")}</small></div></div>}
            {run && (
              <div className="cm-areas">
                {run.areas.map((a, i) => <CmArea key={a.key} a={a} at={a.score === null ? 'none' : tone(a.score, run.passThreshold)} index={i} />)}
              </div>
            )}
          </div>

          <ComplianceCard run={run} showFindings />
        </div>

        <div className="modal-foot cm-foot">
          {onOpenDraft && <StableButton type="button" className="btn outline" disabled={actionBusy} onClick={onOpenDraft}>{translateUI('publication.editDraft')}</StableButton>}
          {onApprove && <StableButton type="button" className="btn primary" disabled={approvalDisabled || actionBusy} onClick={onApprove}>{translateUI(approving ? 'publication.approving' : 'publication.approve')}</StableButton>}
          <StableButton type="button" className="btn outline" disabled={actionBusy} onClick={onClose}>{translateUI("ui.close_bbfa77")}</StableButton>
        </div>
      </div>
    </div>
  );
}
