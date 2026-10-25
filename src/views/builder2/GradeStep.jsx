import { tr } from "../../i18n/index.js";
import { t as translateUI } from "../../i18n/index.js";
import { examRows, gradeTotal } from '../../lib/syllabusModel';
import { Ic } from './parts';
import { newId } from './useDraft';

// Percent is kept as typed text ("12.5") so the field never fights the keyboard; the model reads it with Number().
const PCT = /^\d{0,3}(\.\d{0,2})?$/;

// Step 6: Grading System (form section X). Components must total 100%; the formulas are generated from the
// components and the exam rows in step 3, shown as live equations, with an override.
export default function GradeStep({ d, apply, model }) {
  const g = d.grading;
  const total = gradeTotal(d);
  const f = model.formulas(d);
  const exams = examRows(d).length;
  const upd = (fn) => apply((x) => { fn(x.grading); return x; });
  return (
    <div>
      <div>
        {g.rows.map((r, i) => (
          <div className="gcomp" key={r.id} data-grade-row={i}>
            <div className="grow">
              <span className="mono" style={{ padding: '8px 0 0 6px', color: 'var(--muted)' }}>{(i + 1) + '.'}</span>
              <input className="cell" value={r.label} placeholder={translateUI("ui.component_c92c52")} aria-label={translateUI("ui.component_c92c52")} onChange={(e) => { const v = e.target.value; upd((x) => { x.rows[i].label = v; }); }} />
              <input className="cell mono" value={r.abbr} placeholder={translateUI("ui.abbr_b9bce8")} aria-label={translateUI("ui.abbreviation_cd4378")} maxLength={8} onChange={(e) => { const v = e.target.value.toUpperCase(); upd((x) => { x.rows[i].abbr = v; }); }} />
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input className="cell mono" inputMode="decimal" value={r.pct} aria-label={(r.label || tr('Component')) + translateUI("ui.percent_dff0eb")} onChange={(e) => { const v = e.target.value; if (PCT.test(v)) upd((x) => { x.rows[i].pct = v; }); }} />
                <span className="mono">%</span>
              </span>
              <button type="button" className="ib del" aria-label={translateUI("ui.remove_component_200c43")} onClick={() => upd((x) => { x.rows.splice(i, 1); })}><Ic n="x" /></button>
            </div>
            <input className="cell gparts" value={r.parts || ''} placeholder={translateUI('grade.parts_placeholder')} aria-label={(r.label || tr('Component')) + ': ' + translateUI('grade.parts')} onChange={(e) => { const v = e.target.value; upd((x) => { x.rows[i].parts = v; }); }} />
          </div>
        ))}
      </div>
      <button type="button" className="link" onClick={() => upd((x) => { x.rows.push({ id: newId(), label: '', abbr: '', pct: '', parts: '' }); })}>{translateUI("ui.add_component_2364b5")}</button>
      <div className="gbar" role="img" aria-label={translateUI("ui.weights_cd9b0c") + g.rows.map((r) => (r.label || 'Component') + ' ' + (Number(r.pct) || 0) + '%').join(', ')}>
        {g.rows.map((r) => <i key={r.id} style={{ width: Math.min(100, Number(r.pct) || 0) + '%' }} />)}
      </div>
      <div className={'total' + (total === 100 ? '' : ' bad')}><span>{translateUI("ui.total_b25928")}</span><span className="mono">{total + '%'}</span>{total !== 100 && <span className="hint">{translateUI("ui.should_be_100_655251")}</span>}</div>
      <label className="field gpass"><span>{translateUI('grade.passing')}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input className="cell mono" inputMode="decimal" value={g.passing == null ? '' : g.passing} aria-label={translateUI('grade.passing')} onChange={(e) => { const v = e.target.value; if (PCT.test(v)) upd((x) => { x.passing = v; }); }} />
          <span className="mono">%</span>
        </span>
      </label>
      <div className="eq" aria-live="polite">
        <div>{f.term}</div>
        <div>{f.final}</div>
        <div className="l">{exams < 3 ? translateUI("ui.final_rating_lists_29eda9") + exams + translateUI("ui.of_3_terms_add_the_missing_exam_rows_in_step_3_694862") : translateUI("ui.final_rating_is_built_from_your_496f08") + exams + translateUI("ui.exam_rows_db6139")}</div>
      </div>
      <label className="sw">
        <input type="checkbox" checked={g.override.on} onChange={(e) => {
          const v = e.target.checked;
          upd((x) => {
            x.override.on = v;
            if (v && !x.override.term) { const gen = model.formulas({ grading: { rows: x.rows, override: { on: false } }, plan: d.plan }); x.override.term = gen.genTerm; x.override.final = gen.genFinal; }
          });
        }} />{translateUI("ui.write_the_formulas_myself_8320f5")}</label>
      {g.override.on && (
        <div className="form-grid" style={{ marginTop: 10 }}>
          <label className="field"><span>{translateUI("ui.term_grade_2e36c7")}</span><input className="mono" value={g.override.term} onChange={(e) => { const v = e.target.value; upd((x) => { x.override.term = v; }); }} /></label>
          <label className="field"><span>{translateUI("ui.final_rating_26f0fa")}</span><input className="mono" value={g.override.final} onChange={(e) => { const v = e.target.value; upd((x) => { x.override.final = v; }); }} /></label>
        </div>
      )}
    </div>
  );
}
