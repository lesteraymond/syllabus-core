import { useState } from 'react';
import { timeOf, when } from '../lib/complianceView';

const STATUS_LABELS = { draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review', for_revision: 'For Revision', approved: 'Approved', rejected: 'Rejected' };
const PAGE = 12;

// The history of checks: one card per check, newest first, each with the day and time it was stored. A card opens that exact check
// in the result dialog. It only displays; the page loads the history and opens the run.
//   runs     the items of GET /api/compliance/history      loading / error   the state of that request
//   opening  the runId being opened (its card waits)       onOpen(run)       called with the item that was pressed
export default function CheckHistory({ runs, loading = false, error = '', opening = null, onOpen }) {
  const [shown, setShown] = useState(PAGE);
  const list = runs || [];

  // The score's tone in words as well as colour: "Meets the standard" / "Below the pass line" / "Not scored".
  const toneOf = (r) => (!r.scored || r.overall === null ? 'none' : r.passed ? 'good' : 'warn');
  const toneText = { good: 'Meets the standard', warn: 'Below the pass line', none: 'Not scored' };

  return (
    <section className="card hist-card" aria-label="Check history">
      <div className="hist-head">
        <h3>Check history</h3>
        <p>Every check stored with a submitted syllabus, newest first. Open one to see its scoring.</p>
      </div>

      {loading && <p className="hist-empty">Loading the history…</p>}
      {!loading && error && <p className="hist-empty" role="alert">{error}</p>}
      {!loading && !error && list.length === 0 && <p className="hist-empty">No syllabus has been checked yet.</p>}

      {list.length > 0 && (
        <ul className="hist-grid">
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
