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
          <div className="grow" key={r.id}>
            <span className="mono" style={{ padding: '8px 0 0 6px', color: 'var(--muted)' }}>{(i + 1) + '.'}</span>
            <input className="cell" value={r.label} placeholder="Component" aria-label="Component" onChange={(e) => { const v = e.target.value; upd((x) => { x.rows[i].label = v; }); }} />
            <input className="cell mono" value={r.abbr} placeholder="abbr" aria-label="Abbreviation" maxLength={8} onChange={(e) => { const v = e.target.value.toUpperCase(); upd((x) => { x.rows[i].abbr = v; }); }} />
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input className="cell mono" inputMode="decimal" value={r.pct} aria-label={(r.label || 'Component') + ' percent'} onChange={(e) => { const v = e.target.value; if (PCT.test(v)) upd((x) => { x.rows[i].pct = v; }); }} />
              <span className="mono">%</span>
            </span>
            <button type="button" className="ib del" aria-label="Remove component" onClick={() => upd((x) => { x.rows.splice(i, 1); })}><Ic n="x" /></button>
          </div>
        ))}
      </div>
      <button type="button" className="link" onClick={() => upd((x) => { x.rows.push({ id: newId(), label: '', abbr: '', pct: '' }); })}>+ Add component</button>
      <div className="gbar" role="img" aria-label={'Weights: ' + g.rows.map((r) => (r.label || 'Component') + ' ' + (Number(r.pct) || 0) + '%').join(', ')}>
        {g.rows.map((r) => <i key={r.id} style={{ width: Math.min(100, Number(r.pct) || 0) + '%' }} />)}
      </div>
      <div className={'total' + (total === 100 ? '' : ' bad')}><span>Total</span><span className="mono">{total + '%'}</span>{total !== 100 && <span className="hint">should be 100%</span>}</div>
      <div className="eq" aria-live="polite">
        <div>{f.term}</div>
        <div>{f.final}</div>
        <div className="l">{exams < 3 ? 'Final rating lists ' + exams + ' of 3 terms. Add the missing exam rows in step 3.' : 'Final rating is built from your ' + exams + ' exam rows.'}</div>
      </div>
      <label className="sw">
        <input type="checkbox" checked={g.override.on} onChange={(e) => {
          const v = e.target.checked;
          upd((x) => {
            x.override.on = v;
            if (v && !x.override.term) { const gen = model.formulas({ grading: { rows: x.rows, override: { on: false } }, plan: d.plan }); x.override.term = gen.genTerm; x.override.final = gen.genFinal; }
          });
        }} />Write the formulas myself
      </label>
      {g.override.on && (
        <div className="form-grid" style={{ marginTop: 10 }}>
          <label className="field"><span>Term grade</span><input className="mono" value={g.override.term} onChange={(e) => { const v = e.target.value; upd((x) => { x.override.term = v; }); }} /></label>
          <label className="field"><span>Final rating</span><input className="mono" value={g.override.final} onChange={(e) => { const v = e.target.value; upd((x) => { x.override.final = v; }); }} /></label>
        </div>
      )}
    </div>
  );
}
