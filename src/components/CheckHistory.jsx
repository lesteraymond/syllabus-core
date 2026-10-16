import StableButton from './StableButton';
import DatePicker from './DatePicker';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
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
    <section className="card hist-card" aria-label={translateUI("ui.check_history_087c5b")}>
      <div className="hist-head">
        <div>
          <h3>{translateUI("ui.check_history_087c5b")}</h3>
          <p>{translateUI("ui.each_checked_subject_appears_once_newest_first_open_one_to_see_it_468518")}</p>
        </div>
        <form className="hist-filter" onSubmit={apply} aria-label={translateUI("ui.filter_the_history_by_date_771c36")}>
          <label htmlFor={uid + '-from'}>{translateUI("ui.from_3f6605")}</label>
          <DatePicker id={uid + '-from'} type="date" value={draft.from} max={draft.to || undefined} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
          <label htmlFor={uid + '-to'}>{translateUI("ui.to_ae79ea")}</label>
          <DatePicker id={uid + '-to'} type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
          <StableButton type="submit" className="btn primary" disabled={!valid || !changed}>{translateUI("ui.apply_cfea41")}</StableButton>
          {active && <StableButton type="button" className="btn outline" onClick={onReset}>{translateUI("ui.reset_44c57a")}</StableButton>}
          {!valid && <span className="hist-filter-error" role="alert">{translateUI("ui.the_from_date_is_after_the_to_date_2c84ad")}</span>}
        </form>
      </div>

      <div className="hist-summary" aria-live="polite">
        {active && !loading && !error && <><span className="chip">{tr((range.from && range.to ? 'Showing ' : 'Showing checks ') + tr(rangeLabel(range.from, range.to)))}</span><span>{tr(list.length + (list.length === 1 ? ' check' : ' checks'))}</span></>}
      </div>

      {loading && list.length === 0 && <p className="hist-empty">{translateUI("ui.loading_the_history_8f2942")}</p>}
      {!loading && error && <p className="hist-empty" role="alert">{tr(error)}</p>}
      {!loading && !error && list.length === 0 && (
        active
          ? <p className="hist-empty" aria-live="polite">{translateUI("ui.no_check_was_stored_in_this_date_range_548438")}<button type="button" className="hist-reset" onClick={onReset}>{translateUI("ui.reset_44c57a")}</button></p>
          : <p className="hist-empty">{translateUI("ui.no_syllabus_has_been_checked_yet_ec0425")}</p>
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
                  aria-label={r.courseCode + ', ' + (r.facultyName || tr('unknown faculty')) + ', ' + (r.overall === null ? tr('not scored') : r.overall + ' ' + tr('percent') + ', ' + tr(toneText[t])) + translateUI("ui.checked_d42130") + day + ' ' + time}>
                  <span className="hist-score">
                    <b>{r.overall === null ? '—' : r.overall + '%'}</b>
                    <small>{tr(toneText[t])}</small>
                  </span>
                  <span className="hist-main">
                    <strong>{r.courseCode}{r.versionLabel && <span className="hist-ver">{r.versionLabel}</span>}</strong>
                    <span>{r.courseTitle}</span>
                    <small>{r.facultyName || translateUI("ui.unknown_faculty_753147")}{r.programCode ? ' · ' + r.programCode : ''}</small>
                  </span>
                  <span className="hist-foot">
                    <time dateTime={r.createdAt || undefined}>{day}{time ? ' · ' + time : ''}</time>
                    <span className="hist-tags">
                      <span className={'status ' + r.status}>{tr(STATUS_LABELS[r.status] || r.status)}</span>
                      <span className="chip quiet">{r.checkedBy === 'admin' ? translateUI("ui.by_administrator_c55e2e") : r.checkedBy === 'author' ? translateUI("ui.on_submit_952d52") : translateUI("ui.checked_b2bc0c")}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {list.length > shown && <StableButton type="button" className="btn outline hist-more" onClick={() => setShown(shown + PAGE)}>{translateUI("ui.show_more_ada6d7") + (list.length - shown) + translateUI("ui.more_5ca940")}</StableButton>}
    </section>
  );
}
