import { useCallback, useRef, useState } from 'react';
import { tr } from "../../i18n/index.js";
import { t as translateUI } from "../../i18n/index.js";
import { GROUPS } from '../../lib/syllabusModel';
import { CURRENT_SCHOOL_YEAR } from '../../lib/schoolYear';
import { syllabi as syllabiApi } from '../../lib/api';
import { formatBareLinkAsApa7, isStandaloneLink } from '../../lib/apaFormat';
import { Auto, Ic } from './parts';
import { newId } from './useDraft';

const focusId = (id) => setTimeout(() => { const el = document.querySelector('[data-fid="' + id + '"]'); if (el) el.focus(); }, 30);

// Step 5: References (form section IX). Four groups, each can be "Not applicable".
// A reference is flagged when it is more than 10 years older than the syllabus's school year (not today's date).
// When the user pastes or enters a standalone link (URL or DOI), it is automatically formatted into APA 7th edition.
export default function RefsStep({ d, apply, model }) {
  const [formattingIds, setFormattingIds] = useState(() => ({}));
  const inFlightRef = useRef(new Map());

  const autoFormatLink = useCallback(async (groupKey, itemId, rawValue) => {
    const trimmed = String(rawValue ?? '').trim();
    if (!isStandaloneLink(trimmed)) return;
    if (inFlightRef.current.get(itemId) === trimmed) return;
    inFlightRef.current.set(itemId, trimmed);
    setFormattingIds((prev) => ({ ...prev, [itemId]: true }));
    try {
      let citation = null;
      try {
        const res = await syllabiApi.formatReference(trimmed);
        if (res && typeof res.citation === 'string' && res.citation.trim()) citation = res.citation.trim();
      } catch {
        citation = formatBareLinkAsApa7(trimmed);
      }
      if (citation && citation !== trimmed) {
        apply((x) => {
          const items = x.refs?.[groupKey]?.items;
          if (!Array.isArray(items)) return x;
          const target = items.find((it) => it.id === itemId);
          // Only replace if the user has not edited the field while the lookup was running.
          if (target && target.t.trim() === trimmed) target.t = citation;
          return x;
        });
      }
    } finally {
      if (inFlightRef.current.get(itemId) === trimmed) inFlightRef.current.delete(itemId);
      setFormattingIds((prev) => {
        if (!prev[itemId]) return prev;
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    }
  }, [apply]);

  return (
    <div>
      {GROUPS.map(([key, title]) => {
        const grp = d.refs[key];
        return (
          <div className="grp" key={key}>
            <div className="grp-h">
              <h3>{tr(title)}<span className="mono" style={{ marginLeft: 8, fontWeight: 500 }}>{grp.items.filter((x) => x.t.trim()).length}</span></h3>
              <label className="na"><input type="checkbox" checked={grp.na} onChange={(e) => { const v = e.target.checked; apply((x) => { x.refs[key].na = v; return x; }); }} />{translateUI("ui.not_applicable_67c4d0")}</label>
            </div>
            {grp.na ? <div className="hint" style={{ padding: '8px 0' }}>{translateUI("ui.marked_not_applicable_for_this_course_b1c227")}</div> : (
              <div>
                {grp.items.map((r, i) => {
                  const a = model.refAge(r.t);
                  const isFormatting = !!formattingIds[r.id];
                  return (
                    <div className="item" style={{ gridTemplateColumns: '8px minmax(0,1fr) auto 28px' }} key={r.id}>
                      <span />
                      <Auto value={r.t} fid={r.id} placeholder={translateUI("ui.reference_db1c78")} label={tr(title) + translateUI("ui.reference_523d48") + (i + 1)}
                        onChange={(v) => apply((x) => { x.refs[key].items[i].t = v; return x; })}
                        onPaste={(e) => {
                          const pasted = e.clipboardData?.getData('text') || '';
                          const el = e.currentTarget;
                          const nextVal = r.t.slice(0, el.selectionStart ?? r.t.length) + pasted + r.t.slice(el.selectionEnd ?? r.t.length);
                          if (isStandaloneLink(nextVal)) {
                            setTimeout(() => autoFormatLink(key, r.id, nextVal), 0);
                          }
                        }}
                        onBlur={() => { if (isStandaloneLink(r.t)) autoFormatLink(key, r.id, r.t); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (isStandaloneLink(r.t)) autoFormatLink(key, r.id, r.t);
                            const n = { id: newId(), t: '' };
                            apply((x) => { x.refs[key].items.splice(i + 1, 0, n); return x; });
                            focusId(n.id);
                          }
                        }} />
                      {isFormatting
                        ? <span className="hint" role="status" style={{ alignSelf: 'center', fontSize: 11, whiteSpace: 'nowrap', margin: '0 4px' }}>{translateUI("refs.formattingApa")}</span>
                        : (a && a.age > 10 ? <span className="age" title={translateUI("ui.more_than_10_years_older_than_school_year_0390a8") + CURRENT_SCHOOL_YEAR.label}>{a.year + ' · ' + a.age + translateUI("ui.yrs_a00f7d")}</span> : <span />)}
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
