import { useMemo } from 'react';
import { ChartCard, Donut, Insight, Legend, PageHead, Progress } from '../components/ui';
import { BRAND } from '../data/initialData';

function LineChart({ data }) {
  return <div><svg className="line-chart" viewBox="0 0 300 120"><g className="grid-lines">{[20, 50, 80, 110].map(y => <line key={y} x1="0" y1={y} x2="300" y2={y} />)}</g><polyline points={data.map(p => p.join(',')).join(' ')} fill="none" stroke={BRAND.blue} strokeWidth="3" />{data.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="white" stroke={BRAND.blue} strokeWidth="3" />)}</svg><div className="axis-labels"><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span></div></div>;
}

function DonutBreakdown({ value, high, med, low }) {
  return <div className="donut-panel analytics"><Donut value={value} centerTop={`${value}%`} centerBottom="Average" /><div className="legend"><Legend color="var(--blue)" text="High (80–100%)" value={`${high}%`} /><Legend color="var(--gold)" text="Medium (50–79%)" value={`${med}%`} /><Legend color="var(--red)" text="Low (<50%)" value={`${low}%`} /></div></div>;
}

function BarChart({ data }) {
  return <div className="bars">{data.map(([x, v]) => <div className="bar-col" key={x}><span>{v}%</span><i style={{ height: `${v}%` }} /><small>{x}</small></div>)}</div>;
}

function ReferenceChart({ data }) {
  return <div className="donut-panel analytics"><div className="donut refs"><div><strong>{data.current}%</strong><small>≤ 10 years</small></div></div><div className="legend"><Legend color="var(--blue)" text="0–5 years" value={`${data.young}%`} /><Legend color="var(--gold)" text="6–10 years" value={`${data.mid}%`} /><Legend color="var(--red)" text=">10 years" value={`${data.old}%`} /></div></div>;
}

function RadarLike({ data }) {
  return <div className="radar-like">{data.map(([l, v]) => <Progress key={l} label={l} value={v} />)}</div>;
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
      <PageHead title={isFaculty ? 'My Analytics' : 'Analytics & Quality Dashboard'} subtitle={isFaculty ? 'Track your personal compliance scores and submission performance.' : 'Monitor compliance, curriculum coverage, submission performance, and syllabus quality trends.'} actions={<><select><option>AY 2026–2027</option><option>AY 2025–2026</option></select><button className="btn outline">⇩ Download Report</button></>} />
      <div className="analytics-grid">
        <ChartCard title="Compliance Trend" subtitle={isFaculty ? 'Your AI compliance score over time' : 'Average AI compliance score'}><LineChart data={lineData} /></ChartCard>
        <ChartCard title="Outcome Coverage" subtitle={isFaculty ? 'Your syllabus coverage' : 'Coverage across approved syllabi'}><DonutBreakdown {...donutData} /></ChartCard>
        <ChartCard title="Submission Completion" subtitle={isFaculty ? 'Your submissions' : 'By program'}><BarChart data={barData} /></ChartCard>
        <ChartCard title="Reference Currency" subtitle="Age of cited learning resources"><ReferenceChart data={refData} /></ChartCard>
      </div>
      <div className="analytics-grid two">
        <ChartCard title="Quality Dimensions" subtitle={isFaculty ? 'Your quality scores' : 'Average percentage scores by program'}><RadarLike data={radarData} /></ChartCard>
        <ChartCard title="Actionable Insights" subtitle={isFaculty ? 'Tips for your submissions' : 'AI-generated quality observations'}><div className="insights">{insights.map(i => <Insight key={i.n} {...i} />)}</div></ChartCard>
      </div>
    </>
  );
}
