import { tr } from "../../i18n/index.js";
import { t as translateUI } from "../../i18n/index.js";
import { GROUPS } from '../../lib/syllabusModel';
import { CURRENT_SCHOOL_YEAR } from '../../lib/schoolYear';
import { Auto, Ic } from './parts';
import { newId } from './useDraft';

const focusId = (id) => setTimeout(() => { const el = document.querySelector('[data-fid="' + id + '"]'); if (el) el.focus(); }, 30);

// Step 5: References (form section IX). Four groups, each can be "Not applicable".
// A reference is flagged when it is more than 10 years older than the syllabus's school year (not today's date).
export default function RefsStep({ d, apply, model }) {
  return (
    <div>
      {GROUPS.map(([key, title]) => {
        const grp = d.refs[key];
        return (
          <div className="grp" key={key} data-ref-group={key}>
            <div className="grp-h">
              <h3>{tr(title)}<span className="mono" style={{ marginLeft: 8, fontWeight: 500 }}>{grp.items.filter((x) => x.t.trim()).length}</span></h3>
              <label className="na"><input type="checkbox" checked={grp.na} onChange={(e) => { const v = e.target.checked; apply((x) => { x.refs[key].na = v; return x; }); }} />{translateUI("ui.not_applicable_67c4d0")}</label>
            </div>
            {grp.na ? <div className="hint" style={{ padding: '8px 0' }}>{translateUI("ui.marked_not_applicable_for_this_course_b1c227")}</div> : (
              <div>
                {grp.items.map((r, i) => {
                  const a = model.refAge(r.t);
                  return (
                    <div className="item" style={{ gridTemplateColumns: '8px minmax(0,1fr) auto 28px' }} key={r.id} data-ref-item={key + ':' + i}>
                      <span />
                      <Auto value={r.t} fid={r.id} placeholder={translateUI("ui.reference_db1c78")} label={tr(title) + translateUI("ui.reference_523d48") + (i + 1)}
                        onChange={(v) => apply((x) => { x.refs[key].items[i].t = v; return x; })}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const n = { id: newId(), t: '' }; apply((x) => { x.refs[key].items.splice(i + 1, 0, n); return x; }); focusId(n.id); } }} />
                      {a && a.age > 10 ? <span className="age" title={translateUI("ui.more_than_10_years_older_than_school_year_0390a8") + CURRENT_SCHOOL_YEAR.label}>{a.year + ' · ' + a.age + translateUI("ui.yrs_a00f7d")}</span> : <span />}
                      <button type="button" className="ib del" aria-label={translateUI("ui.remove_reference_629558")} onClick={() => apply((x) => { x.refs[key].items.splice(i, 1); return x; })}><Ic n="x" /></button>
                    </div>
                  );
                })}
                <button type="button" className="link" onClick={() => { const n = { id: newId(), t: '' }; apply((x) => { x.refs[key].items.push(n); return x; }); focusId(n.id); }}>{translateUI("ui.add_reference_081ae6")}</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
