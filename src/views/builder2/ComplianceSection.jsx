import StableButton from '../../components/StableButton';
import { tr } from "../../i18n/index.js";
import { t as translateUI } from "../../i18n/index.js";
import { useEffect, useRef } from 'react';
import ComplianceCard from '../ComplianceCard';
import { useCompliance } from './useCompliance';
import { timeOf } from '../../lib/complianceView';

// The compliance check inside the Review & Check step. Opening the step runs the rule check on what is saved (an unchanged
// syllabus just shows its stored run); "Re-check" runs it again, in place, and so does the footer's Re-check (it bumps `tick`).
// `canCheck` is false for a syllabus the viewer cannot re-check: then it only shows the stored run.
// `onRun` tells the builder what the latest run says, so the submit button can say "Submit anyway" when warnings remain.
export default function ComplianceSection({ syllabusId, saveFirst, canCheck, tick, onOpenStep, onRun }) {
  const { run, installed, busy, error, load, check } = useCompliance({ syllabusId, saveFirst });

  useEffect(() => { if (canCheck) check(false); else load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (canCheck) check(true);
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (onRun) onRun(run); }, [run]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="cmp-card" id="cmp-card" aria-labelledby="cmp-title" aria-busy={busy}>
      <div className="cmp-card-head">
        <div>
          <h3 id="cmp-title">{translateUI("ui.compliance_check_cf2d1e")}</h3>
          <p className="cmp-small">{translateUI("ui.checked_against_the_undergraduate_syllabus_form_only_a_form_that__68429a")}</p>
        </div>
        {canCheck && installed && <StableButton type="button" className="btn outline" disabled={busy} onClick={() => check(true)}>{busy ? translateUI("ui.checking_820d60") : translateUI("ui.re_check_9cf055")}</StableButton>}
      </div>
      {installed && (busy || run) && (
        <p className="cmp-status" role="status" aria-live="polite">
          {busy ? translateUI('check.status.checking')
            : run.aiStatus === 'pending' ? translateUI('check.status.writing', { time: timeOf(run.createdAt) })
            : run.aiStatus === 'ok' ? translateUI('check.status.ai', { time: timeOf(run.createdAt) })
            : run.aiStatus === 'failed' ? translateUI('check.status.noAi', { time: timeOf(run.createdAt) })
            : translateUI('check.status.rules', { time: timeOf(run.createdAt) })}
        </p>
      )}
      {!installed && <div className="info-banner warning">{translateUI("ui.compliance_checks_are_not_available_on_this_server_yet_you_can_st_d6b109")}</div>}
      {error && <div className="info-banner warning" role="alert">{tr(error)}</div>}
      {installed && !run && !error && <p className="cmp-small">{busy ? translateUI("ui.checking_your_syllabus_1278c5") : translateUI("ui.not_checked_yet_8ea64e")}</p>}
      {installed && (run || busy) && <ComplianceCard run={run} onOpenStep={onOpenStep} checking={busy} />}
    </section>
  );
}
