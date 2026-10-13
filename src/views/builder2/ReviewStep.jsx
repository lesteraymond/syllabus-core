import { STEPS } from '../../lib/syllabusModel';
import FormPaper from './FormPaper';

// Step 7: Review. Read-only rendering of the finished form, the status of steps 1 to 6 (each links back),
// and the sign-off block. Faculty fill in no revision date and no modifications list.
export default function ReviewStep({ d, model, go, preparedBy, existing, note, setNote }) {
  return (
    <div className="rv">
      <div>
        <span className="lbl">Step status</span>
        <div className="chk">
          {STEPS.slice(0, 6).map((s, i) => {
            const is = model.issues(d, s.key);
            return (
              <button type="button" key={s.key} onClick={() => go(i)}>
                <span className={'chkdot' + (is.length ? ' w' : '')}>{is.length ? '!' : '✓'}</span>
                <span>
                  <b style={{ fontWeight: 600 }}>{s.title}</b>
                  {is.slice(0, 2).map((x, k) => <div className="iss" key={k}>{x.text}</div>)}
                  {is.length > 2 && <div className="iss">{'and ' + (is.length - 2) + ' more'}</div>}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 18 }}>
          <span className="lbl">Sign-off</span>
          <div className="sig">
            <div>Prepared by<b>{preparedBy}, from your account</b></div>
            <div>Checked and reviewed by<b>Added by the system on review</b></div>
            <div>Approved by<b>Added by the system on approval</b></div>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>The other names and the revision date are added by the system when the syllabus is reviewed and approved. You do not fill them in.</p>
        </div>
        {existing && (
          <label className="field" style={{ marginTop: 18 }}>
            <span>What changed? (optional)</span>
            <textarea rows="3" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Saved with this version in the history, e.g. Updated the grading components" />
          </label>
        )}
      </div>
      <div className="scroll"><FormPaper d={d} model={model} preparedBy={preparedBy} /></div>
    </div>
  );
}
