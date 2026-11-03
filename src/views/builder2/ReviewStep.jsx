import { tr } from "../../i18n/index.js";
import { t as translateUI } from "../../i18n/index.js";
import { STEPS } from '../../lib/syllabusModel';
import FormPaper from './FormPaper';
import ComplianceSection from './ComplianceSection';


// Step 7: Review & Check. The compliance controls and a read-only rendering of the finished form.
// `submitFailed` are the rules the server named when it refused a submit.
export default function ReviewStep({ d, model, go, preparedBy, syllabusId, saveFirst, canCheck, submitFailed, onRun, onApplyDraft, showCompliance = true }) {
  const openStep = (key) => go(STEPS.findIndex((s) => s.key === key));
  return (
    <>
    {submitFailed && submitFailed.length > 0 && (
      <div className="blockers" role="alert">
        <b>{translateUI("ui.the_server_did_not_accept_this_submit_fix_these_first_31d8e3")}</b>
        <ul>{submitFailed.map((c) => <li key={c.id}>{tr(c.message)}</li>)}</ul>
      </div>
    )}
    {showCompliance ? <ComplianceSection syllabusId={syllabusId} saveFirst={saveFirst} canCheck={canCheck} onOpenStep={openStep} onRun={onRun} onApplyDraft={onApplyDraft} /> : <div className="info-banner" role="note">{translateUI('publication.checkInTab')}</div>}
    <div className="rv">
      <div className="scroll"><FormPaper d={d} model={model} preparedBy={preparedBy} /></div>
    </div>
    </>
  );
}
