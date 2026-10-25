import { tr } from "../../i18n/index.js";
import { t as translateUI } from "../../i18n/index.js";
import { MIN_NOTE } from '../../lib/syllabusRules';
import { STEPS } from '../../lib/syllabusModel';
import { selectorOf } from '../../lib/complianceView';
import FormPaper from './FormPaper';
import ComplianceSection from './ComplianceSection';


// Step 7: Review & Check. The compliance check (it runs when the step opens), a read-only rendering of the finished form, the status
// of steps 1 to 6 (each links back), and the sign-off block. Faculty fill in no revision date and no modifications list.
// `submitFailed` are the rules the server named when it refused a submit.
export default function ReviewStep({ d, apply, editable, model, go, preparedBy, existing, noteRequired, note, setNote, syllabusId, saveFirst, canCheck, checkTick, submitFailed, onRun, showCompliance = true }) {
  // Every link to a step highlights where it lands: the step in the list at the side, and the step's own card (or, for `target.row`, a
  // plan row, which is also scrolled to once its step is on screen).
  const pulse = (el, cls) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 1800); };
  const openStep = (key, target) => {
    const at = STEPS.findIndex((s) => s.key === key);
    go(at);
    setTimeout(() => {
      pulse(document.querySelectorAll('.bld2 .stepper button')[at], 'step-flash');
      // Only what the link is about: one or more rows, a requirement, a reference, a grading row or the description. The whole card only
      // when the link names nothing smaller (or what it names is not on screen).
      const list = target ? (target.targets || (target.row != null ? [{ row: target.row }] : [])) : [];
      const found = list.map((t) => { const sel = selectorOf(t); return sel ? document.querySelector(sel) : null; }).filter(Boolean);
      if (found.length) {
        found[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        found.forEach((el) => pulse(el, el.tagName === 'TR' ? 'row-flash' : 'target-flash'));
        return;
      }
      pulse(document.querySelector('.bld2 .editor-card'), 'card-flash');
    }, 150);
  };
  return (
    <>
    {submitFailed && submitFailed.length > 0 && (
      <div className="blockers" role="alert">
        <b>{translateUI("ui.the_server_did_not_accept_this_submit_fix_these_first_31d8e3")}</b>
        <ul>{submitFailed.map((c) => <li key={c.id}>{tr(c.message)}</li>)}</ul>
      </div>
    )}
    {showCompliance ? <ComplianceSection syllabusId={syllabusId} saveFirst={saveFirst} canCheck={canCheck} tick={checkTick} onOpenStep={openStep} onRun={onRun} d={d} apply={apply} editable={editable} /> : <div className="info-banner" role="note">{translateUI('publication.checkInTab')}</div>}
    <div className="rv">
      <div>
        <span className="lbl">{translateUI("ui.step_status_dc70c2")}</span>
        <div className="chk">
          {STEPS.slice(0, 6).map((s, i) => {
            const is = model.issues(d, s.key);
            return (
              <button type="button" key={s.key} onClick={() => go(i)}>
                <span className={'chkdot' + (is.length ? ' w' : '')}>{is.length ? '!' : '✓'}</span>
                <span>
                  <b style={{ fontWeight: 600 }}>{tr(s.title)}</b>
                  {is.slice(0, 2).map((x, k) => <div className="iss" key={k}>{tr(x.text)}</div>)}
                  {is.length > 2 && <div className="iss">{translateUI("ui.and_97e211") + (is.length - 2) + translateUI("ui.more_84b30f")}</div>}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 18 }}>
          <span className="lbl">{translateUI("ui.sign_off_91a02d")}</span>
          <div className="sig">
            <div>{translateUI("ui.prepared_by_47b758")}<b>{preparedBy}{translateUI("ui.from_your_account_870e41")}</b></div>
            <div>{translateUI("ui.checked_and_reviewed_by_e4719b")}<b>{translateUI("ui.added_by_the_system_on_review_24a39a")}</b></div>
            <div>{translateUI("ui.approved_by_b95366")}<b>{translateUI("ui.added_by_the_system_on_approval_9614af")}</b></div>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>{translateUI("ui.the_other_names_and_the_revision_date_are_added_by_the_system_whe_0aa097")}</p>
        </div>
        {existing && (
          <label className="field" style={{ marginTop: 18 }}>
            <span>{noteRequired ? translateUI("ui.what_did_you_change_required_c57040") : translateUI("ui.what_changed_optional_8668e0")}</span>
            <textarea rows="3" maxLength={1000} value={note} aria-required={!!noteRequired} onChange={(e) => setNote(e.target.value)} placeholder={translateUI("ui.saved_with_this_version_in_the_history_e_g_updated_the_grading_co_4d98a9")} />
            {noteRequired && note.trim().length < MIN_NOTE && <small className="hint">{translateUI("ui.write_at_least_a_sentence_so_the_reviewer_knows_what_to_look_at_3f7338")}</small>}
          </label>
        )}
      </div>
      <div className="scroll"><FormPaper d={d} model={model} preparedBy={preparedBy} /></div>
    </div>
    </>
  );
}
