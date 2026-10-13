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
          <div className="grp" key={key}>
            <div className="grp-h">
              <h3>{title}<span className="mono" style={{ marginLeft: 8, fontWeight: 500 }}>{grp.items.filter((x) => x.t.trim()).length}</span></h3>
              <label className="na"><input type="checkbox" checked={grp.na} onChange={(e) => { const v = e.target.checked; apply((x) => { x.refs[key].na = v; return x; }); }} />Not applicable</label>
            </div>
            {grp.na ? <div className="hint" style={{ padding: '8px 0' }}>Marked not applicable for this course.</div> : (
              <div>
                {grp.items.map((r, i) => {
                  const a = model.refAge(r.t);
                  return (
                    <div className="item" style={{ gridTemplateColumns: '8px minmax(0,1fr) auto 28px' }} key={r.id}>
                      <span />
                      <Auto value={r.t} fid={r.id} placeholder="Reference" label={title + ' reference ' + (i + 1)}
                        onChange={(v) => apply((x) => { x.refs[key].items[i].t = v; return x; })}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const n = { id: newId(), t: '' }; apply((x) => { x.refs[key].items.splice(i + 1, 0, n); return x; }); focusId(n.id); } }} />
                      {a && a.age > 10 ? <span className="age" title={'More than 10 years older than school year ' + CURRENT_SCHOOL_YEAR.label}>{a.year + ' · ' + a.age + ' yrs'}</span> : <span />}
                      <button type="button" className="ib del" aria-label="Remove reference" onClick={() => apply((x) => { x.refs[key].items.splice(i, 1); return x; })}><Ic n="x" /></button>
                    </div>
                  );
                })}
                <button type="button" className="link" onClick={() => { const n = { id: newId(), t: '' }; apply((x) => { x.refs[key].items.push(n); return x; }); focusId(n.id); }}>+ Add reference</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
