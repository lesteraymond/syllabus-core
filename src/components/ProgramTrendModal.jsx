import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n/index.js';
import { useModalLayer } from './useModalLayer';
import { compliance as complianceApi } from '../lib/api';
import { phDate } from '../lib/phTime';
import { programTrend, SERIES_COLORS } from '../lib/programTrend';

// "View analytics" on the dashboard's Program Compliance (reviewers): each program's share of subjects with an approved syllabus over time, by day, week
// or month. Summary tiles (overall compliance and its change, approved subjects, programs fully compliant), a line chart (a step line by day, since a
// subject counts from the day it is approved), a legend that hides, shows and highlights a program, a crosshair tooltip (hover or arrow keys), and a
// table view. The lines use the fixed reference palette (lib/programTrend.js SERIES_COLORS); text never wears a line colour. The modal is rendered on
// document.body so no transformed ancestor can move it; TrendSummary, TrendChart and TrendTable are its parts (tested on their own).
//   programs, subjects  the catalog of the year on screen (the dashboard already has them)    year  the academic year asked for (undefined: the current one)
// The chart is drawn at the size of its box (measured), so the whole window fits the screen without scrolling and the text stays at its own size.
// FALLBACK is the size before the box is measured (and on the server). M: room for the axes and the end labels.
const FALLBACK = { w: 980, h: 340 }, M = { top: 12, right: 170, bottom: 28, left: 44 };
// The y-axis reaches the smallest of these that holds the highest share shown, so shares near 0% are still readable: [top, step], in percent.
const SCALES = [[5, 1], [10, 2], [20, 5], [25, 5], [50, 10], [100, 25]];
const scaleOf = (highest) => SCALES.find(([top]) => highest <= top) || SCALES[SCALES.length - 1];
const MAX_LINES = SERIES_COLORS.length;
const GRAINS = [['day', 'trend.daily'], ['week', 'trend.weekly'], ['month', 'trend.monthly']];

export default function ProgramTrendModal({ programs, subjects, year, onClose }) {
  const dialog = useRef(null);
  useModalLayer(dialog, onClose); // Esc closes, focus stays inside and returns to the button that opened it
  const [state, setState] = useState({ status: 'loading', approvals: [] });
  const [view, setView] = useState('chart');
  const [granularity, setGranularity] = useState('week');

  useEffect(() => {
    let live = true;
    complianceApi.programApprovals(year)
      .then((r) => { if (live) setState({ status: 'ready', approvals: (r && r.approvals) || [] }); })
      .catch(() => { if (live) setState({ status: 'error', approvals: [] }); });
    return () => { live = false; };
  }, [year]);

  const trend = useMemo(() => programTrend({ programs, subjects, approvals: state.approvals, granularity }), [programs, subjects, state.approvals, granularity]);
  const ready = state.status === 'ready' && trend.series.length > 0;

  return createPortal(<div className="overlay" onClick={onClose}>
    <section className="modal trend-modal" role="dialog" aria-modal="true" aria-labelledby="trend-title" tabIndex={-1} ref={dialog} onClick={(e) => e.stopPropagation()}>
      <header className="trend-head">
        <div>
          <span className="trend-eyebrow">{t('trend.eyebrow')}</span>
          <h3 id="trend-title">{t('trend.title')}</h3>
          <p className="trend-definition">{t('trend.definition')}</p>
        </div>
        <button type="button" className="trend-close" aria-label={t('trend.close')} onClick={onClose}>×</button>
      </header>
      {state.status === 'loading' && <p className="usage-note" role="status">{t('trend.loading')}</p>}
      {state.status === 'error' && <p className="form-error" role="alert">{t('trend.error')}</p>}
      {state.status === 'ready' && !trend.series.length && <p className="usage-note">{t('trend.noSubjects')}</p>}
      {ready && <>
        <TrendSummary trend={trend} />
        <div className="trend-controls">
          <div className="trend-seg" role="radiogroup" aria-label={t('trend.granularity')}>
            {GRAINS.map(([key, label]) => <button key={key} type="button" role="radio" aria-checked={granularity === key} className={granularity === key ? 'active' : ''} onClick={() => setGranularity(key)}>{t(label)}</button>)}
          </div>
          <div className="trend-seg" role="tablist" aria-label={t('trend.viewLabel')}>
            <button type="button" role="tab" aria-selected={view === 'chart'} className={view === 'chart' ? 'active' : ''} onClick={() => setView('chart')}>{t('trend.chart')}</button>
            <button type="button" role="tab" aria-selected={view === 'table'} className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>{t('trend.table')}</button>
          </div>
        </div>
        {view === 'chart' ? <TrendChart trend={trend} /> : <div className="trend-table-wrap"><TrendTable trend={trend} /></div>}
      </>}
    </section>
  </div>, document.body);
}

// Three summary tiles: the overall compliance (all programs' subjects together) with its change since the first point shown, the approved subjects,
// and the programs where every subject has an approved syllabus. The change is said in words and with an arrow, never by colour alone.
export function TrendSummary({ trend }) {
  const o = trend.overall;
  const since = phDate(trend.dates[0]);
  const change = o.change > 0 ? t('trend.changeUp', { n: o.change, date: since }) : o.change < 0 ? t('trend.changeDown', { n: -o.change, date: since }) : t('trend.changeNone', { date: since });
  return <div className="trend-kpis">
    <div className="trend-kpi"><span>{t('trend.kpiOverall')}</span><strong>{o.percent}%</strong><small className={'trend-delta ' + (o.change > 0 ? 'up' : o.change < 0 ? 'down' : 'flat')}>{o.change > 0 ? '▲ ' : o.change < 0 ? '▼ ' : ''}{change}</small></div>
    <div className="trend-kpi"><span>{t('trend.kpiApproved')}</span><strong>{o.approved}<em> / {o.total}</em></strong><small>{t('trend.kpiApprovedNote')}</small></div>
    <div className="trend-kpi"><span>{t('trend.kpiComplete')}</span><strong>{o.complete}<em> / {trend.series.length}</em></strong><small>{t('trend.kpiCompleteNote')}</small></div>
  </div>;
}

// The x-axis label of a point: the day ("Oct 14") or the month ("Oct"), with the year where it changes.
const labelOf = (iso, granularity, previous) => {
  const full = phDate(iso); // 'Oct 14, 2026'
  if (granularity !== 'month') return full.replace(/, \d{4}$/, '');
  const month = full.split(' ')[0], year = full.slice(-4);
  return previous && phDate(previous).slice(-4) === year ? month : month + ' ' + year;
};

// The line chart. Recessive grid and axes; one 2px line per program (a step line by day: a subject counts from the day of its approval); a dot with a
// white ring on each line at the hovered point or at today; direct labels at the line ends for up to four programs; a legend that hides or shows a program
// (click) and highlights it (hover: its line gets a soft fill, the others fade); a crosshair with a tooltip, sorted by value (pointer or arrow keys).
export function TrendChart({ trend }) {
  const [hover, setHover] = useState(null);   // the index of the point under the pointer (or the keyboard)
  const [hidden, setHidden] = useState(() => new Set());
  const [focus, setFocus] = useState(null);   // the program whose legend entry is hovered
  const box = useRef(null);
  const [size, setSize] = useState(FALLBACK); // the chart box in CSS pixels
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    // clientWidth/Height: the box's own size, not changed by the window's opening animation (a transform)
    const measure = () => { if (el.clientWidth > 0 && el.clientHeight > 0) setSize((now) => (now.w === el.clientWidth && now.h === el.clientHeight ? now : { w: el.clientWidth, h: el.clientHeight })); };
    measure(); // at once, so the first frame is drawn at the right size
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure); }
    const watch = new ResizeObserver(measure); // then whenever the window (and so the box) changes size
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  // a narrow chart (a phone) keeps no room for end labels: the legend and the tooltip name the lines, and the plot gets the width
  const wide = size.w >= 560;
  const W = size.w, H = size.h, PLOT_W = Math.max(40, W - M.left - (wide ? M.right : 12)), PLOT_H = Math.max(40, H - M.top - M.bottom);
  const all = trend.series.slice(0, MAX_LINES);
  const lines = all.filter((s) => !hidden.has(s.program));
  const n = trend.dates.length;
  const [top, stepBy] = scaleOf(Math.max(0, ...lines.flatMap((s) => s.points)));
  const levels = []; for (let v = 0; v <= top; v += stepBy) levels.push(v);
  const x = (i) => M.left + (n > 1 ? (i / (n - 1)) * PLOT_W : PLOT_W);
  const y = (pct) => M.top + PLOT_H - (pct / top) * PLOT_H;
  const step = trend.granularity === 'day';
  // Monotone cubic Hermite spline (Fritsch-Carlson) for smooth series lines that never overshoot 0% or the scale ceiling.
  const monotonePath = (pts) => {
    const coords = pts.map((v, i) => [x(i), y(v)]);
    if (coords.length < 2) return coords.length ? `M${coords[0][0]},${coords[0][1]}` : '';
    if (coords.length === 2) return `M${coords[0][0]},${coords[0][1]}L${coords[1][0]},${coords[1][1]}`;
    const k = coords.length;
    const dx = [], dy = [], m = [];
    for (let i = 0; i < k - 1; i++) { dx[i] = coords[i + 1][0] - coords[i][0]; dy[i] = coords[i + 1][1] - coords[i][1]; m[i] = dx[i] ? dy[i] / dx[i] : 0; }
    const t = [m[0]];
    for (let i = 1; i < k - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    t[k - 1] = m[k - 2];
    for (let i = 0; i < k - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / m[i], b = t[i + 1] / m[i], s = Math.hypot(a, b);
      if (s > 3) { t[i] = (3 / s) * a * m[i]; t[i + 1] = (3 / s) * b * m[i]; }
    }
    let d = `M${coords[0][0]},${coords[0][1]}`;
    for (let i = 0; i < k - 1; i++) {
      const h = dx[i] / 3;
      d += `C${coords[i][0] + h},${coords[i][1] + t[i] * h} ${coords[i + 1][0] - h},${coords[i + 1][1] - t[i + 1] * h} ${coords[i + 1][0]},${coords[i + 1][1]}`;
    }
    return d;
  };
  const pathOf = (pts) => (step
    ? pts.map((v, i) => (i === 0 ? `M${x(0)},${y(v)}` : `H${x(i)}V${y(v)}`)).join('')
    : monotonePath(pts));
  const areaOf = (pts) => pathOf(pts) + `V${y(0)}H${x(0)}Z`;
  const maxTicks = 7;
  const every = Math.max(1, Math.ceil(n / maxTicks));
  const ticks = []; for (let i = 0; i < n; i += every) ticks.push(i); if (ticks[ticks.length - 1] !== n - 1) { if (n - 1 - ticks[ticks.length - 1] < every / 2) ticks.pop(); ticks.push(n - 1); }
  const endLabels = !wide || lines.length > 4 ? [] : lines.map((s) => ({ s, y: y(s.points[n - 1]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < endLabels.length; i++) if (endLabels[i].y - endLabels[i - 1].y < 15) endLabels[i].y = endLabels[i - 1].y + 15;
  // labels pushed past the baseline (several programs at 0%) move back up as a stack, so they never run into the dates under the plot
  const floor = M.top + PLOT_H;
  if (endLabels.length && endLabels[endLabels.length - 1].y > floor) {
    endLabels[endLabels.length - 1].y = floor;
    for (let i = endLabels.length - 2; i >= 0; i--) if (endLabels[i + 1].y - endLabels[i].y < 15) endLabels[i].y = endLabels[i + 1].y - 15;
  }
  const pick = (event) => {
    const svg = event.currentTarget.ownerSVGElement || event.currentTarget;
    const box = svg.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - M.left) / PLOT_W) * (n - 1)))));
  };
  const keys = (event) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); setHover((h) => Math.min(n - 1, h === null ? n - 1 : h + 1)); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); setHover((h) => Math.max(0, h === null ? n - 1 : h - 1)); }
  };
  const toggle = (program) => setHidden((now) => { const next = new Set(now); if (next.has(program)) next.delete(program); else if (next.size < all.length - 1) next.add(program); return next; });
  const at = hover === null ? n - 1 : hover;
  const faded = (program) => focus !== null && focus !== program;
  const tipRows = hover === null ? [] : [...lines].sort((a, b) => b.points[hover] - a.points[hover] || a.program.localeCompare(b.program));
  return <div className="trend-panel">
    {all.length > 1 && <ul className="trend-legend" aria-label={t('trend.legend')}>
      {all.map((s) => <li key={s.program}><button type="button" aria-pressed={!hidden.has(s.program)} className={(hidden.has(s.program) ? 'off' : '') + (focus === s.program ? ' is-focus' : '')} title={(s.name ? s.name + ' · ' : '') + t('trend.toggle', { program: s.program })}
        onClick={() => toggle(s.program)} onMouseEnter={() => setFocus(s.program)} onMouseLeave={() => setFocus(null)} onFocus={() => setFocus(s.program)} onBlur={() => setFocus(null)}>
        <i style={{ background: hidden.has(s.program) ? 'transparent' : SERIES_COLORS[s.slot], borderColor: SERIES_COLORS[s.slot] }} aria-hidden="true" /><span>{s.program}</span><small>{s.points[at]}%</small>
      </button></li>)}
    </ul>}
    <div className="trend-chart" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('trend.chartLabel')} tabIndex={0} onKeyDown={keys} onBlur={() => setHover(null)}>
        <defs>{lines.map((s) => <linearGradient key={s.program} id={'trend-fill-' + s.slot} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={SERIES_COLORS[s.slot]} stopOpacity={focus === s.program ? '0.2' : '0.1'} /><stop offset="100%" stopColor={SERIES_COLORS[s.slot]} stopOpacity="0" />
        </linearGradient>)}</defs>
        {levels.map((v) => <g key={v}>
          <line x1={M.left} x2={M.left + PLOT_W} y1={y(v)} y2={y(v)} className={v === 0 ? 'trend-baseline' : 'trend-grid'} />
          <text x={M.left - 10} y={y(v)} className="trend-axis" textAnchor="end" dominantBaseline="middle">{v}%</text>
        </g>)}
        {ticks.map((i, k) => <text key={i} x={x(i)} y={H - 8} className="trend-axis" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{labelOf(trend.dates[i], trend.granularity, k > 0 ? trend.dates[ticks[k - 1]] : null)}</text>)}
        {lines.filter((s) => s.points.some((v) => v > 0) && (focus === null || s.program === focus)).map((s) => <path key={'a' + s.program} d={areaOf(s.points)} fill={`url(#trend-fill-${s.slot})`} className="trend-area" opacity={faded(s.program) ? 0.15 : 1} />)}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + PLOT_H} className="trend-crosshair" />}
        {lines.map((s) => <path key={s.program} className="trend-line" d={pathOf(s.points)} fill="none" stroke={SERIES_COLORS[s.slot]} strokeWidth={focus === s.program ? 2.75 : 2} strokeLinejoin="round" strokeLinecap="round" opacity={faded(s.program) ? 0.2 : 1} />)}
        {n <= 14 && lines.map((s) => s.points.map((v, i) => i === at ? null : (
          <circle key={`${s.program}-pt-${i}`} cx={x(i)} cy={y(v)} r="2.25" fill={SERIES_COLORS[s.slot]} stroke="var(--card)" strokeWidth="1.25" opacity={faded(s.program) ? 0.15 : 0.7} />
        )))}
        {lines.map((s) => <g key={s.program + '-dot'} opacity={faded(s.program) ? 0.2 : 1}>
          <circle cx={x(at)} cy={y(s.points[at])} r="9" fill={SERIES_COLORS[s.slot]} fillOpacity={hover !== null || focus === s.program ? 0.18 : 0.12} />
          <circle cx={x(at)} cy={y(s.points[at])} r="4" fill={SERIES_COLORS[s.slot]} stroke="var(--card)" strokeWidth="2" />
        </g>)}
        {endLabels.map(({ s, y: ly }) => <g key={s.program} opacity={faded(s.program) ? 0.35 : 1}>
          {Math.abs(ly - y(s.points[n - 1])) > 0.5 && <line x1={x(n - 1) + 7} x2={x(n - 1) + 15} y1={y(s.points[n - 1])} y2={ly} className="trend-leader" />}
          <text x={x(n - 1) + 19} y={ly} className="trend-end" dominantBaseline="middle">{s.program} <tspan className="trend-end-value">{s.points[n - 1]}%</tspan></text>
        </g>)}
        <rect x={M.left} y={M.top} width={PLOT_W} height={PLOT_H} fill="transparent" onMouseMove={pick} onMouseLeave={() => setHover(null)} />
      </svg>
      {hover !== null && <div className={'trend-tip' + (x(hover) / W > 0.62 ? ' left' : '')} style={{ left: (x(hover) / W) * 100 + '%' }} role="status">
        <b>{phDate(trend.dates[hover])}</b>
        {tipRows.map((s) => <span key={s.program}><i style={{ background: SERIES_COLORS[s.slot] }} aria-hidden="true" />{s.program}<em>{s.points[hover]}%</em><small>{s.counts[hover]}/{s.total}</small></span>)}
      </div>}
    </div>
    <p className="trend-note">{t(trend.granularity === 'day' ? 'trend.noteDay' : trend.granularity === 'month' ? 'trend.noteMonth' : 'trend.note')}{trend.series.length > MAX_LINES ? ' ' + t('trend.moreInTable', { count: trend.series.length - MAX_LINES }) : ''}</p>
  </div>;
}

// The same numbers as a table: every program with its approved subjects out of its subjects today, and the programs with no subjects yet.
export function TrendTable({ trend }) {
  return <table className="trend-table">
    <thead><tr><th>{t('trend.program')}</th><th>{t('trend.approved')}</th><th>{t('trend.compliance')}</th></tr></thead>
    <tbody>
      {trend.series.map((s) => <tr key={s.program}><td><span className="trend-key" style={{ background: SERIES_COLORS[s.slot] }} aria-hidden="true" /><b>{s.program}</b>{s.name ? <small>{s.name}</small> : null}</td><td>{t('trend.ofSubjects', { approved: s.approved, total: s.total })}</td>
        <td><span className="trend-bar"><i style={{ width: s.percent + '%', background: SERIES_COLORS[s.slot] }} /></span>{s.percent}%</td></tr>)}
      {trend.empty.map((p) => <tr key={p.program}><td><b>{p.program}</b>{p.name ? <small>{p.name}</small> : null}</td><td colSpan={2}>{t('trend.noSubjectsYet')}</td></tr>)}
    </tbody>
  </table>;
}
