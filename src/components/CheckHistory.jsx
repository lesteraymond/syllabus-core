import { useEffect, useId, useState } from 'react';
import { rangeLabel, rangeToInstants, timeOf, when } from '../lib/complianceView';

const STATUS_LABELS = { draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review', for_revision: 'For Revision', approved: 'Approved', rejected: 'Rejected' };
const PAGE = 12;

// The history of checks: one card per check, newest first, each with the day and time it was stored. A card opens that exact check
// in the result dialog. It only displays; the page loads the history and opens the run.
//   runs     the items of GET /api/compliance/history      loading / error   the state of that request
//   opening  the runId being opened (its card waits)       onOpen(run)       called with the item that was pressed
//   range    the applied date filter { from, to } ('YYYY-MM-DD' or '')      onApply(range) / onReset()   change or clear it
// The filter has a draft of its own: nothing is filtered until Apply, and the applied range stays until it is changed or reset.
export default function CheckHistory({ runs, loading = false, error = '', opening = null, onOpen, range = { from: '', to: '' }, onApply, onReset }) {
  const uid = useId();
  const [shown, setShown] = useState(PAGE);
  const [draft, setDraft] = useState(range);
  const list = runs || [];

  useEffect(() => { setDraft(range); setShown(PAGE); }, [range.from, range.to]); // a new applied range: show it, and start from the first page

  const active = !!(range.from || range.to);
  const valid = rangeToInstants(draft.from, draft.to) !== null;
  const changed = draft.from !== range.from || draft.to !== range.to;
  const apply = (e) => { e.preventDefault(); if (valid && changed) onApply(draft); };

  // The score's tone in words as well as colour: "Meets the standard" / "Below the pass line" / "Not scored".
  const toneOf = (r) => (!r.scored || r.overall === null ? 'none' : r.passed ? 'good' : 'warn');
  const toneText = { good: 'Meets the standard', warn: 'Below the pass line', none: 'Not scored' };

  return (
    <section className="card hist-card" aria-label="Check history">
      <div className="hist-head">
        <div>
          <h3>Check history</h3>
          <p>Each checked subject appears once, newest first. Open one to see its scoring.</p>
        </div>
        <form className="hist-filter" onSubmit={apply} aria-label="Filter the history by date">
          <label htmlFor={uid + '-from'}>From</label>
          <input id={uid + '-from'} type="date" value={draft.from} max={draft.to || undefined} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
          <label htmlFor={uid + '-to'}>To</label>
          <input id={uid + '-to'} type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
          <button type="submit" className="btn primary" disabled={!valid || !changed}>Apply</button>
          {active && <button type="button" className="btn outline" onClick={onReset}>Reset</button>}
          {!valid && <span className="hist-filter-error" role="alert">The From date is after the To date.</span>}
        </form>
      </div>

      <div className="hist-summary" aria-live="polite">
        {active && !loading && !error && <><span className="chip">{(range.from && range.to ? 'Showing ' : 'Showing checks ') + rangeLabel(range.from, range.to).replace(/^Since/, 'since').replace(/^Until/, 'until')}</span><span>{list.length + (list.length === 1 ? ' check' : ' checks')}</span></>}
      </div>

      {loading && list.length === 0 && <p className="hist-empty">Loading the history…</p>}
      {!loading && error && <p className="hist-empty" role="alert">{error}</p>}
      {!loading && !error && list.length === 0 && (
        active
          ? <p className="hist-empty" aria-live="polite">No check was stored in this date range. <button type="button" className="hist-reset" onClick={onReset}>Reset</button></p>
          : <p className="hist-empty">No syllabus has been checked yet.</p>
      )}

      {list.length > 0 && (
        <ul className={'hist-grid' + (loading ? ' is-busy' : '')} aria-busy={loading}>
          {list.slice(0, shown).map((r) => {
            const t = toneOf(r);
            const day = when(r.createdAt);
            const time = timeOf(r.createdAt);
            return (
              <li key={r.runId}>
                <button type="button" className={'hist-item ' + t} disabled={opening === r.runId} onClick={() => onOpen(r)}
                  aria-label={r.courseCode + ', ' + (r.facultyName || 'unknown faculty') + ', ' + (r.overall === null ? 'not scored' : r.overall + ' percent, ' + toneText[t]) + ', checked ' + day + ' ' + time}>
                  <span className="hist-score">
                    <b>{r.overall === null ? '—' : r.overall + '%'}</b>
                    <small>{toneText[t]}</small>
                  </span>
                  <span className="hist-main">
                    <strong>{r.courseCode}</strong>
                    <span>{r.courseTitle}</span>
                    <small>{r.facultyName || 'Unknown faculty'}{r.programCode ? ' · ' + r.programCode : ''}</small>
                  </span>
                  <span className="hist-foot">
                    <time dateTime={r.createdAt || undefined}>{day}{time ? ' · ' + time : ''}</time>
                    <span className="hist-tags">
                      <span className={'status ' + r.status}>{STATUS_LABELS[r.status] || r.status}</span>
                      <span className="chip quiet">{r.checkedBy === 'admin' ? 'By administrator' : r.checkedBy === 'author' ? 'On submit' : 'Checked'}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {list.length > shown && <button type="button" className="btn outline hist-more" onClick={() => setShown(shown + PAGE)}>{'Show more (' + (list.length - shown) + ' more)'}</button>}
    </section>
  );
}
