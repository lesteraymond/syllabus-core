import { t as translateUI, tr } from '../i18n/index.js';

// The four numbers at the top of the administrator's AI Checker: what is waiting for its first check, and how the checks in the history came out.
// It only displays; the page counts them. `waiting` / `faculty` come from the picker's list, `tally` from historyTally(history runs).
//   loading   true until the list and the history have loaded (a dash is shown instead of a number)
const Tile = ({ tone, label, value, hint }) => (
  <div className={'chk-stat' + (tone ? ' ' + tone : '')}>
    <span className="chk-stat-label">{label}</span>
    <b className="chk-stat-value">{value}</b>
    <span className="chk-stat-hint">{hint}</span>
  </div>
);

export default function CheckOverview({ waiting = 0, faculty = 0, tally, loading = false }) {
  const n = (v) => (loading ? '—' : String(v));
  return (
    <section className="chk-stats" aria-label={translateUI('checkOverview.label')} data-testid="check-overview">
      <Tile tone="wait" label={translateUI('checkOverview.waiting')} value={n(waiting)} hint={waiting > 0 ? translateUI('checkOverview.waitingHint', { count: faculty }) : translateUI('checkOverview.waitingNone')} />
      <Tile label={translateUI('checkOverview.checked')} value={n(tally.checked)} hint={translateUI('checkOverview.checkedHint')} />
      <Tile tone="good" label={tr('Meets the standard')} value={n(tally.meets)} hint={translateUI('checkOverview.meetsHint')} />
      <Tile tone="warn" label={tr('Below the pass line')} value={n(tally.below)} hint={translateUI('checkOverview.belowHint')} />
    </section>
  );
}
