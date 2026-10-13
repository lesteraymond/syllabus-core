import { useEffect, useRef } from 'react';
import ComplianceCard from '../ComplianceCard';
import { useCompliance } from './useCompliance';

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
          <h3 id="cmp-title">Compliance check</h3>
          <p className="cmp-small">Checked against the Undergraduate Syllabus form. Only a form that does not follow the template stops you from submitting; the score and the other findings are advice for you and the reviewer.</p>
        </div>
        {canCheck && installed && <button type="button" className="btn outline" disabled={busy} onClick={() => check(true)}>{busy ? 'Checking…' : 'Re-check'}</button>}
      </div>
      {!installed && <div className="info-banner warning">Compliance checks are not available on this server yet. You can still submit.</div>}
      {error && <div className="info-banner warning" role="alert">{error}</div>}
      {installed && !run && !error && <p className="cmp-small">{busy ? 'Checking your syllabus…' : 'Not checked yet.'}</p>}
      {installed && run && <ComplianceCard run={run} onOpenStep={onOpenStep} />}
    </section>
  );
}
