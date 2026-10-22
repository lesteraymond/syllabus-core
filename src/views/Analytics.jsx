import StableButton from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useMemo, useState } from 'react';
import { ChartCard, Donut, Insight, Legend, PageHead, Progress } from '../components/ui';
import { BRAND } from '../data/initialData';
import Select from '../components/Select';
import { buildAnalytics } from '../lib/analyticsView';
import { useComplianceRows } from '../lib/useComplianceRows';
import { buildReport } from '../lib/reportView';

function LineChart({ data }) {
  const [tip, setTip] = useState(null); // { left, top, text } in the chart's own box, set from the dot that is hovered
  if (!data.length) return <div className="empty">{translateUI("ui.no_program_data_yet_c5b890")}</div>;
  const step = data.length > 1 ? 275 / (data.length - 1) : 0;
  const pts = data.map((p, i) => [data.length > 1 ? 10 + i * step : 150, 110 - Math.max(0, Math.min(100, p.value))]);
  const show = (e, i) => {
    const box = e.currentTarget.ownerSVGElement.parentElement.getBoundingClientRect();
    const dot = e.currentTarget.getBoundingClientRect();
    setTip({ left: dot.left + dot.width / 2 - box.left, top: dot.top - box.top, text: data[i].label + ': ' + data[i].value + '%' });
  };
  return <div className="line-wrap" onMouseLeave={() => setTip(null)}><svg className="line-chart" viewBox="0 0 300 120"><g className="grid-lines">{[20, 50, 80, 110].map(y => <line key={y} x1="0" y1={y} x2="300" y2={y} />)}</g><polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={BRAND.blue} strokeWidth="3" />{pts.map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="4" fill="white" stroke={BRAND.blue} strokeWidth="3" /><circle className="line-hit" cx={x} cy={y} r="11" fill="transparent" onMouseEnter={(e) => show(e, i)} onFocus={(e) => show(e, i)} onMouseLeave={() => setTip(null)} /></g>)}</svg>{tip && <div className="line-tip" style={{ left: tip.left, top: tip.top }} role="tooltip">{tip.text}</div>}<div className="axis-labels">{data.map((p, i) => <span key={i}>{p.label}</span>)}</div></div>;
}

// A donut of the three score bands. Clicking a colour (the ring or its legend row) selects it: the centre and the tooltip above the ring
// then describe that band, and clicking it again goes back to the average. `parts` is [{ key, color, label, pct, tip }].
function BandDonut({ average, averageText, averageTip, parts }) {
  const [picked, setPicked] = useState(null);
  const [hot, setHot] = useState(null); // the colour under the pointer: its tooltip shows at once (an SVG <title> waits a moment)
  const sel = parts.find((x) => x.key === picked) || null;
  const shownTip = parts.find((x) => x.key === (hot || picked)) || null;
  const R = 45;
  let at = 0;
  const arcs = parts.map((x) => { const arc = { ...x, from: at }; at += x.pct; return arc; });
  const pick = (key) => setPicked((k) => (k === key ? null : key));
  const tip = shownTip ? shownTip.tip : averageTip;
  return (
    <div className="donut-panel analytics">
      <div className={'band-donut' + (shownTip ? ' picked' : '')} data-tip={shownTip ? tip : undefined}>
        <svg viewBox="0 0 120 120" role="img" aria-label={tip}>
          <circle cx="60" cy="60" r={R} fill="none" stroke="#e3e7ea" strokeWidth="18" />
          {average !== null && arcs.filter((x) => x.pct > 0).map((x) => (
            <circle key={x.key} cx="60" cy="60" r={R} fill="none" stroke={x.color} strokeWidth={picked === x.key ? 22 : 18} pathLength="100"
              strokeDasharray={x.pct + ' ' + (100 - x.pct)} strokeDashoffset={-x.from} transform="rotate(-90 60 60)"
              className={'band-arc' + (picked && picked !== x.key ? ' dim' : '')} onClick={() => pick(x.key)} onMouseEnter={() => setHot(x.key)} onMouseLeave={() => setHot(null)} style={{ cursor: 'pointer' }} />
          ))}
        </svg>
        <div className="band-center"><strong>{sel ? sel.pct + '%' : averageText}</strong><small>{sel ? sel.label.replace(/\s*\(.*\)\s*$/, '') : tr('Average')}</small></div>
      </div>
      <div className="legend">
        {parts.map((x) => (
          <button type="button" key={x.key} onMouseEnter={() => setHot(x.key)} onMouseLeave={() => setHot(null)} className={'legend-pick' + (picked === x.key ? ' on' : '')} onClick={() => pick(x.key)} aria-pressed={picked === x.key}>
            <Legend color={x.color} text={x.label} value={x.pct + '%'} />
          </button>
        ))}
      </div>
    </div>
  );
}

const bandParts = ({ high, med, low }, what) => [
  { key: 'high', color: 'var(--blue)', label: translateUI("ui.high_80_100_234a35"), pct: high, tip: `${high}% ${what} scored 80% or more` },
  { key: 'med', color: 'var(--gold)', label: translateUI("ui.medium_50_79_d47c66"), pct: med, tip: `${med}% ${what} scored from 50% to 79%` },
  { key: 'low', color: 'var(--red)', label: translateUI("ui.low_50_979304"), pct: low, tip: `${low}% ${what} scored under 50%` },
];

function DonutBreakdown({ value, high, med, low, scored }) {
  return <BandDonut average={scored ? value : null} averageText={`${value}%`} averageTip={`Average compliance score: ${value}%`} parts={bandParts({ high, med, low }, 'of checked syllabi')} />;
}

function BarChart({ data }) {
  if (!data.length) return <div className="empty">{translateUI("ui.no_program_data_yet_c5b890")}</div>;
  return <div className="bars">{data.map(([x, v]) => <div className="bar-col" key={x} data-tip={`${x}: ${v}% compliance`}><span>{v}%</span><i style={{ height: `${v}%` }} /><small>{x}</small></div>)}</div>;
}

function ReferenceChart({ data }) {
  return <BandDonut average={data.value} averageText={data.value === null ? '—' : `${data.value}%`} averageTip={data.value === null ? 'No reference scores yet' : `Average Reference Currency score: ${data.value}%`} parts={bandParts(data, 'of syllabi on references')} />;
}

function RadarLike({ data }) {
  return <div className="radar-like">{data.map(([l, v]) => <Progress key={l} label={tr(l)} value={v === null ? 0 : v} tip={v === null ? `${l}: not scored yet` : `${l}: ${v}% average`} />)}</div>;
}

export default function Analytics({ syllabi, user, notify = () => {}, setPage = () => {} }) {
  const isFaculty = user.role === 'faculty';
  const { rows } = useComplianceRows();
  const a = useMemo(() => buildAnalytics(rows, { isFaculty }), [rows, isFaculty]);
  const [saving, setSaving] = useState(false);
  const download = async () => {
    setSaving(true);
    try {
      const { downloadReport } = await import('../lib/reportPdf');
      await downloadReport(buildReport(rows, { user }));
      notify(translateUI('report.saved'));
    } catch (err) {
      console.error('Report download failed', err);
      notify(translateUI('report.failed') + ' (' + String(err && err.message ? err.message : err).slice(0, 80) + ')');
    } finally { setSaving(false); }
  };
  const total = a.count;
  const compliance = a.average === null ? 0 : a.average;
  const donutData = { value: compliance, scored: a.scoredCount > 0, ...a.bands };
  const barData = a.bars;
  const refData = a.references;
  const radarData = a.areas;
  const lineData = a.trend;

  // Observations worked out from the stored checks (the numbers above), in plain sentences.
  const insights = useMemo(() => {
    const i = a.insights;
    const check = isFaculty ? 'my-syllabi' : 'ai';
    const checkGo = isFaculty ? 'analytics.go_mine' : 'analytics.go_ai';
    if (!a.scoredCount) return [{ page: check, go: checkGo, n: '01', title: 'No scored checks yet', text: isFaculty ? 'Run the compliance check in step 7 of the builder to see your scores here.' : 'Check a submitted syllabus in the AI Checker to see scores here.' }];
    const out = [{ page: check, go: checkGo, n: '01', title: isFaculty ? 'Your compliance score' : 'Average compliance', text: `${a.average}% average across ${a.scoredCount} checked ${a.scoredCount === 1 ? 'syllabus' : 'syllabi'}.` }];
    if (i.lowest) out.push({ page: check, go: checkGo, n: '02', title: `${i.lowest[0]} needs attention`, text: `It is the weakest area, at ${i.lowest[1]}% on average.` });
    out.push({ page: check, go: checkGo, n: '03', title: 'Below the pass line', text: i.belowPass ? `${i.belowPass} ${i.belowPass === 1 ? 'syllabus is' : 'syllabi are'} under the 79% pass line.` : 'Every checked syllabus meets the pass line.' });
    out.push(isFaculty
      ? { page: 'my-syllabi', go: 'analytics.go_mine', n: '04', title: 'Pending and returned', text: `${i.waiting} awaiting review, ${i.returned} returned or rejected, ${i.unchecked} not checked yet.` }
      : { page: 'review', go: 'analytics.go_review', n: '04', title: 'Review backlog', text: `${i.waiting} awaiting a decision, ${i.unchecked} not checked yet${i.best ? `; ${i.best[0]} has the highest average (${i.best[1]}%).` : '.'}` });
    return out;
  }, [a, isFaculty]);

  return (
    <>
      <PageHead title={isFaculty ? translateUI("ui.my_analytics_1ab328") : translateUI("ui.analytics_quality_dashboard_b85172")} subtitle={isFaculty ? translateUI("ui.track_your_personal_compliance_scores_and_submission_performance_b66964") : translateUI("ui.monitor_compliance_curriculum_coverage_submission_performance_and_78b463")} actions={<><Select><option value="AY 2026–2027">{translateUI("ui.ay_2026_2027_830f3e")}</option><option value="AY 2025–2026">{translateUI("ui.ay_2025_2026_8b00a8")}</option></Select><StableButton className="btn outline" disabled={saving || !rows.length} onClick={download}>{translateUI("ui.download_report_9f36e2")}</StableButton></>} />
      <div className="analytics-grid">
        <ChartCard title={translateUI("ui.compliance_trend_2fa4a1")} subtitle={isFaculty ? translateUI("ui.your_ai_compliance_score_over_time_f2f70b") : translateUI("ui.average_ai_compliance_score_603cf2")}><LineChart data={lineData} /></ChartCard>
        <ChartCard title={translateUI("ui.outcome_coverage_5788ff")} subtitle={isFaculty ? translateUI("ui.your_syllabus_coverage_b60846") : translateUI("ui.coverage_across_approved_syllabi_923a95")}><DonutBreakdown {...donutData} /></ChartCard>
        <ChartCard title={translateUI("analytics.bar_title")} subtitle={isFaculty ? translateUI("analytics.bar_by_subject") : translateUI("ui.by_program_11a420")}><BarChart data={barData} /></ChartCard>
        <ChartCard title={translateUI("ui.reference_currency_7c7576")} subtitle={translateUI("ui.age_of_cited_learning_resources_2711b5")}><ReferenceChart data={refData} /></ChartCard>
      </div>
      <div className="analytics-grid two">
        <ChartCard title={translateUI("ui.quality_dimensions_41c80b")} subtitle={isFaculty ? translateUI("ui.your_quality_scores_8f5d5e") : translateUI("ui.average_percentage_scores_by_program_3c980a")}><RadarLike data={radarData} /></ChartCard>
        <ChartCard title={translateUI("ui.actionable_insights_9816fd")} subtitle={isFaculty ? translateUI("ui.tips_for_your_submissions_76ea2a") : translateUI("analytics.insights_sub")}><div className="insights">{insights.map(({ page, go, ...i }) => <Insight key={i.n} {...i} title={tr(i.title)} text={tr(i.text)} go={translateUI(go)} onClick={() => setPage(page)} />)}</div></ChartCard>
      </div>
    </>
  );
}
