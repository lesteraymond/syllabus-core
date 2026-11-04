import StableButton from '../../components/StableButton';
import { tr } from "../../i18n/index.js";
import { t as translateUI } from "../../i18n/index.js";
import { useEffect, useState } from 'react';
import ComplianceCard from '../ComplianceCard';
import { useCompliance } from './useCompliance';
import { timeOf } from '../../lib/complianceView';

// Opening the review step only loads the saved report. Provider calls start
// exclusively from the single AI CHECK action, including in React Strict Mode.
// `canCheck` is false for a syllabus the viewer cannot re-check: then it only shows the stored run.
// `onRun` tells the builder what the latest run says, so the submit button can say "Submit anyway" when warnings remain.
export default function ComplianceSection({ syllabusId, saveFirst, canCheck, onOpenStep, onRun, onApplyDraft }) {
  const { run, installed, busy, error, load, check } = useCompliance({ syllabusId, saveFirst });
  // True once a recommendation has been applied: the stored result no longer describes the syllabus until it is checked again.
  const [changed, setChanged] = useState(false);
  const apply = onApplyDraft ? async (patch) => { const done = await onApplyDraft(patch); setChanged(true); return done; } : undefined;
  const recheck = () => { setChanged(false); return check(true); };
  // A run saved before suggestions recorded the text they replace cannot be applied safely: it needs a fresh check.
  const legacy = !!(onApplyDraft && run?.hybrid?.suggestions?.some((s) => !Object.hasOwn(s, 'originalValue')));
  // The one check button (header) is the only way to refresh; this just decides whether to say the shown result is out of date.
  const needsCheck = (changed || legacy) && canCheck && installed && !!run;

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (onRun) onRun(busy ? null : run); }, [run, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="cmp-card" id="cmp-card" aria-labelledby="cmp-title" aria-busy={busy}>
      <div className="cmp-card-head">
        <div>
          <h3 id="cmp-title">{translateUI("ui.compliance_check_cf2d1e")}</h3>
          <p className="cmp-small">{translateUI("ui.checked_against_the_undergraduate_syllabus_form_only_a_form_that__68429a")}</p>
        </div>
        {canCheck && installed && <StableButton type="button" className="btn primary" disabled={busy} onClick={recheck}>{busy ? translateUI("ui.checking_820d60") : translateUI(run ? "hybrid.recheckButton" : "hybrid.checkButton")}</StableButton>}
      </div>
      {needsCheck && (
        <div className="hy-stale" role="status">
          <span>{translateUI(legacy && !changed ? 'hybrid.refreshSuggestions' : 'hybrid.recheckBanner')}</span>
        </div>
      )}
      {installed && (busy || run) && (
        <p className="cmp-status" role="status" aria-live="polite">
          {busy ? translateUI('check.status.checking')
            : run.aiStatus === 'pending' ? translateUI('check.status.writing', { time: timeOf(run.createdAt) })
            : run.aiStatus === 'ok' ? translateUI('check.status.ai', { time: timeOf(run.createdAt) })
            : run.aiStatus === 'failed' ? translateUI('check.status.noAi', { time: timeOf(run.createdAt) })
            : translateUI('check.status.rules', { time: timeOf(run.createdAt) })}
        </p>
      )}
      {!installed && <div className="info-banner warning">{translateUI('hybrid.unavailable')}</div>}
      {error && <div className="info-banner warning" role="alert">{tr(error)}</div>}
      {installed && !run && !error && !busy && <p className="cmp-small">{translateUI("ui.not_checked_yet_8ea64e")}</p>}
      {/* `busy` is the same value that disables and relabels the button above, so the ring and the button start and stop together. */}
      {installed && (run || busy) && <ComplianceCard run={run} checking={busy} onOpenStep={onOpenStep} onApplyDraft={apply} />}
    </section>
  );
}
