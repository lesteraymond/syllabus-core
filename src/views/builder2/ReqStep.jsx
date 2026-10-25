import { t as translateUI } from "../../i18n/index.js";
import { Auto, Ic } from './parts';
import { newId } from './useDraft';

const focusId = (id) => setTimeout(() => { const el = document.querySelector('[data-fid="' + id + '"]'); if (el) el.focus(); }, 30);

// Step 4: Course Requirements (form section VIII). A numbered list, with suggestions drawn from the assessment tasks in step 3.
export default function ReqStep({ d, apply, model }) {
  const suggestions = model.suggestReqs(d);
  const keys = (i) => (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const n = { id: newId(), t: '' };
      apply((x) => { x.reqs.splice(i + 1, 0, n); return x; });
      focusId(n.id);
    } else if (e.key === 'Backspace' && d.reqs[i].t === '' && d.reqs.length > 1) {
      e.preventDefault();
      const prev = d.reqs[i - 1] || d.reqs[i + 1];
      apply((x) => { x.reqs.splice(i, 1); return x; });
      if (prev) focusId(prev.id);
    }
  };
  return (
    <div>
      {d.reqs.map((r, i) => (
        <div className="item" key={r.id} data-req-row={i}>
          <span className="no">{(i + 1) + '.'}</span>
          <Auto value={r.t} fid={r.id} placeholder={translateUI("ui.requirement_e9c366")} label={translateUI("ui.requirement_15c842") + (i + 1)} onChange={(v) => apply((x) => { x.reqs[i].t = v; return x; })} onKeyDown={keys(i)} />
          <button type="button" className="ib del" aria-label={translateUI("ui.remove_requirement_425573")} onClick={() => apply((x) => { x.reqs.splice(i, 1); return x; })}><Ic n="x" /></button>
        </div>
      ))}
      <div style={{ marginTop: 8 }}>
        <button type="button" className="link" onClick={() => { const n = { id: newId(), t: '' }; apply((x) => { x.reqs.push(n); return x; }); focusId(n.id); }}>{translateUI("ui.add_requirement_a73fac")}</button>
        <span className="hint">{translateUI("ui.enter_adds_the_next_line_10a028")}</span>
      </div>
      {suggestions.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <span className="lbl">{translateUI("ui.from_your_assessment_tasks_in_step_3_860593")}</span>
          <div className="sugg">{suggestions.map((t) => <button type="button" key={t} onClick={() => apply((x) => { x.reqs.push({ id: newId(), t }); return x; })}>{'+ ' + t}</button>)}</div>
        </div>
      )}
    </div>
  );
}
