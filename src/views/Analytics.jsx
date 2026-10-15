import StableButton from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useMemo } from 'react';
import { ChartCard, Donut, Insight, Legend, PageHead, Progress } from '../components/ui';
import { BRAND } from '../data/initialData';
import Select from '../components/Select';

function LineChart({ data }) {
  return <div><svg className="line-chart" viewBox="0 0 300 120"><g className="grid-lines">{[20, 50, 80, 110].map(y => <line key={y} x1="0" y1={y} x2="300" y2={y} />)}</g><polyline points={data.map(p => p.join(',')).join(' ')} fill="none" stroke={BRAND.blue} strokeWidth="3" />{data.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="white" stroke={BRAND.blue} strokeWidth="3" />)}</svg><div className="axis-labels"><span>{translateUI("ui.mar_c4ba08")}</span><span>{translateUI("ui.apr_befde5")}</span><span>{translateUI("ui.may_c94f47")}</span><span>{translateUI("ui.jun_6d90df")}</span><span>{translateUI("ui.jul_b73755")}</span><span>{translateUI("ui.aug_75629a")}</span></div></div>;
}

function DonutBreakdown({ value, high, med, low }) {
  return <div className="donut-panel analytics"><Donut value={value} centerTop={`${value}%`} centerBottom={tr("Average")} /><div className="legend"><Legend color="var(--blue)" text={translateUI("ui.high_80_100_234a35")} value={`${high}%`} /><Legend color="var(--gold)" text={translateUI("ui.medium_50_79_d47c66")} value={`${med}%`} /><Legend color="var(--red)" text={translateUI("ui.low_50_979304")} value={`${low}%`} /></div></div>;
}

function BarChart({ data }) {
  return <div className="bars">{data.map(([x, v]) => <div className="bar-col" key={x}><span>{v}%</span><i style={{ height: `${v}%` }} /><small>{x}</small></div>)}</div>;
}

function ReferenceChart({ data }) {
  return <div className="donut-panel analytics"><div className="donut refs"><div><strong>{data.current}%</strong><small>{translateUI("ui.10_years_cf5ed9")}</small></div></div><div className="legend"><Legend color="var(--blue)" text={translateUI("ui.0_5_years_56523b")} value={`${data.young}%`} /><Legend color="var(--gold)" text={translateUI("ui.6_10_years_4da687")} value={`${data.mid}%`} /><Legend color="var(--red)" text={translateUI("ui.10_years_86387f")} value={`${data.old}%`} /></div></div>;
}

function RadarLike({ data }) {
  return <div className="radar-like">{data.map(([l, v]) => <Progress key={l} label={tr(l)} value={v} />)}</div>;
}

export default function Analytics({ syllabi, user }) {
  const mySyllabi = useMemo(() => user.role === 'faculty' ? syllabi.filter(s => s.ownerId === user.id) : syllabi, [syllabi, user]);
  const approved = mySyllabi.filter(s => s.status === 'Approved').length;
  const total = mySyllabi.length;
  const compliance = total ? Math.round((approved / total) * 100) : 0;
  const isFaculty = user.role === 'faculty';

  const lineData = useMemo(() => {
    const base = compliance;
    return [[10, base - 15], [65, base - 10], [120, base - 5], [175, base], [230, base + 2], [285, base + 5]].map(([x, y]) => [x, Math.max(10, Math.min(110, y))]);
  }, [compliance]);

  const donutData = useMemo(() => {
    const high = Math.round(approved / Math.max(total, 1) * 100);
    const med = Math.round(mySyllabi.filter(s => s.status === 'Under Review').length / Math.max(total, 1) * 100);
    const low = 100 - high - med;
    return { value: compliance, high, med, low };
  }, [compliance, approved, total, mySyllabi]);

  const barData = useMemo(() => {
    if (isFaculty) return mySyllabi.map(s => [s.code, s.status === 'Approved' ? 100 : s.status === 'Under Review' ? 60 : 30]);
    const programs = {};
    mySyllabi.forEach(s => { if (!programs[s.program]) programs[s.program] = { total: 0, approved: 0 }; programs[s.program].total++; if (s.status === 'Approved') programs[s.program].approved++; });
    return Object.entries(programs).map(([p, d]) => [p, Math.round((d.approved / d.total) * 100)]);
  }, [mySyllabi, isFaculty]);

  const refData = useMemo(() => {
    const young = Math.round(total * 0.28) || 0;
    const mid = Math.round(total * 0.40) || 0;
    const old = total - young - mid;
    const current = total ? Math.round(((young + mid * 0.5) / total) * 100) : 0;
    return { young, mid, old, current };
  }, [total]);

  const radarData = useMemo(() => {
    if (isFaculty) return [['Format', compliance], ['Complete', compliance], ['CO–PO', compliance], ['Assessment', compliance], ['References', compliance]];
    return [['Format', compliance], ['Complete', compliance], ['CO–PO', compliance], ['Assessment', compliance], ['References', compliance]];
  }, [compliance, isFaculty]);

  const insights = useMemo(() => {
    if (isFaculty) {
      const rev = mySyllabi.filter(s => s.status === 'Under Review').length;
      const low = mySyllabi.filter(s => s.status === 'Returned' || s.status === 'Rejected').length;
      return [
        { n: '01', title: 'Your compliance score', text: `${compliance}% average across ${total} syllabi.` },
        { n: '02', title: 'Pending reviews', text: `${rev} syllabi currently under review.` },
        { n: '03', title: 'Needs attention', text: `${low} syllabi returned or rejected.` },
        { n: '04', title: 'Tip', text: 'Use the compliance check in step 7 of the builder to improve scores before submitting.' },
      ];
    }
    return [
      { n: '01', title: 'BSIT has the highest compliance', text: '93% average compliance; maintain current review cadence.' },
      { n: '02', title: 'Assessment alignment needs attention', text: '21% of reviewed syllabi have incomplete CO-to-assessment mapping.' },
      { n: '03', title: 'References should be refreshed', text: '32% of references are older than ten years across active syllabi.' },
      { n: '04', title: 'Approval backlog is manageable', text: '18 syllabi remain under review; 6 are already overdue.' },
    ];
  }, [isFaculty, compliance, total, mySyllabi]);

  return (
    <>
      <PageHead title={isFaculty ? translateUI("ui.my_analytics_1ab328") : translateUI("ui.analytics_quality_dashboard_b85172")} subtitle={isFaculty ? translateUI("ui.track_your_personal_compliance_scores_and_submission_performance_b66964") : translateUI("ui.monitor_compliance_curriculum_coverage_submission_performance_and_78b463")} actions={<><Select><option value="AY 2026–2027">{translateUI("ui.ay_2026_2027_830f3e")}</option><option value="AY 2025–2026">{translateUI("ui.ay_2025_2026_8b00a8")}</option></Select><StableButton className="btn outline">{translateUI("ui.download_report_9f36e2")}</StableButton></>} />
      <div className="analytics-grid">
        <ChartCard title={translateUI("ui.compliance_trend_2fa4a1")} subtitle={isFaculty ? translateUI("ui.your_ai_compliance_score_over_time_f2f70b") : translateUI("ui.average_ai_compliance_score_603cf2")}><LineChart data={lineData} /></ChartCard>
        <ChartCard title={translateUI("ui.outcome_coverage_5788ff")} subtitle={isFaculty ? translateUI("ui.your_syllabus_coverage_b60846") : translateUI("ui.coverage_across_approved_syllabi_923a95")}><DonutBreakdown {...donutData} /></ChartCard>
        <ChartCard title={translateUI("ui.submission_completion_b3968d")} subtitle={isFaculty ? translateUI("ui.your_submissions_e58b57") : translateUI("ui.by_program_11a420")}><BarChart data={barData} /></ChartCard>
        <ChartCard title={translateUI("ui.reference_currency_7c7576")} subtitle={translateUI("ui.age_of_cited_learning_resources_2711b5")}><ReferenceChart data={refData} /></ChartCard>
      </div>
      <div className="analytics-grid two">
        <ChartCard title={translateUI("ui.quality_dimensions_41c80b")} subtitle={isFaculty ? translateUI("ui.your_quality_scores_8f5d5e") : translateUI("ui.average_percentage_scores_by_program_3c980a")}><RadarLike data={radarData} /></ChartCard>
        <ChartCard title={translateUI("ui.actionable_insights_9816fd")} subtitle={isFaculty ? translateUI("ui.tips_for_your_submissions_76ea2a") : translateUI("ui.ai_generated_quality_observations_82b3fd")}><div className="insights">{insights.map(i => <Insight key={i.n} {...i} title={tr(i.title)} text={tr(i.text)} />)}</div></ChartCard>
      </div>
    </>
  );
}
