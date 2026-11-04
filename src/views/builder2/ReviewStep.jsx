import { tr } from "../../i18n/index.js";
import { t as translateUI } from "../../i18n/index.js";
import { STEPS } from '../../lib/syllabusModel';
import { MIN_NOTE } from '../../lib/syllabusRules';
import FormPaper from './FormPaper';
import ComplianceSection from './ComplianceSection';


// Step 7: Review & Check. The compliance controls and a read-only rendering of the finished form.
// `submitFailed` are the rules the server named when it refused a submit.
export default function ReviewStep({ d, model, go, preparedBy, editable, noteRequired, note = '', setNote, syllabusId, saveFirst, canCheck, submitFailed, onRun, onApplyDraft, showCompliance = false }) {
  const openStep = (key) => go(STEPS.findIndex((s) => s.key === key));
  const needNote = noteRequired && note.trim().length < MIN_NOTE;
  return (
    <>
    {submitFailed && submitFailed.length > 0 && (
      <div className="blockers" role="alert">
        <b>{translateUI("ui.the_server_did_not_accept_this_submit_fix_these_first_31d8e3")}</b>
        <ul>{submitFailed.map((c) => <li key={c.id}>{tr(c.message)}</li>)}</ul>
      </div>
    )}
    {showCompliance ? <ComplianceSection syllabusId={syllabusId} saveFirst={saveFirst} canCheck={canCheck} onOpenStep={openStep} onRun={onRun} onApplyDraft={onApplyDraft} /> : <div className="info-banner" role="note">{translateUI('publication.checkInTab')}</div>}
    {noteRequired && editable && (
      <label className="field" style={{ marginBottom: 14 }}>
        <span>{translateUI("ui.what_did_you_change_required_c57040")}</span>
        <textarea rows="3" maxLength={1000} value={note} aria-required="true" onChange={(e) => setNote && setNote(e.target.value)} placeholder={translateUI("ui.saved_with_this_version_in_the_history_e_g_updated_the_grading_co_4d98a9")} />
        {needNote && <small className="hint">{translateUI("ui.write_at_least_a_sentence_so_the_reviewer_knows_what_to_look_at_3f7338")}</small>}
      </label>
    )}
    <div className="rv">
      <div className="scroll"><FormPaper d={d} model={model} preparedBy={preparedBy} /></div>
    </div>
    </>
  );
}
