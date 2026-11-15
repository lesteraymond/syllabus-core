import { YearFilter, useYearScope } from '../components/AcademicYearScope';
import StableButton from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useMemo, useState } from 'react';
import { ChartCard, Insight, PageHead, Progress, ViewSwitch } from '../components/ui';
import { compliance as complianceApi } from '../lib/api';
import { aiAverage, programScores, scoreBands } from '../lib/complianceStats';
import Select from '../components/Select';

// Everything on this page is measured: the AI scores come from the latest stored check of each syllabus (an administrator: every submitted
// syllabus; a faculty member: their own), and the counts from the syllabus list. A syllabus that has not been checked has no score and is
// left out of the averages, never counted as zero. Nothing here is estimated or made up.
// The three AI score bands, high to low. They are states (good / middling / needs work), so they wear the status colours; every band is named
// beside its colour and its share is printed, so colour never carries it alone.
const BANDS = [['high', 'var(--green)', 'ui.high_80_100_234a35'], ['medium', 'var(--gold)', 'ui.medium_50_79_d47c66'], ['low', 'var(--red)', 'ui.low_50_979304']];

// How the scored syllabi spread over the bands: the average as the one big number, a thin bar split into the three bands, and a legend with each share.
// The average is the AI-completed average (aiAverage); the shares are of every scored syllabus (scoreBands). Both are computed as before.
function ScoreSpread({ average, bands, view }) {
  const parts = BANDS.map(([key, color, label]) => ({ key, color, label: translateUI(label), value: bands[key] }));
  const of = translateUI(bands.count === 1 ? 'analytics.bandsOfOne' : 'analytics.bandsOf', { count: bands.count });
  if (view === 'table') return <table className="trend-table chart-table" aria-label={of}>
    <thead><tr><th>{translateUI('analytics.band')}</th><th className="num">{translateUI('analytics.share')}</th></tr></thead>
    <tbody>{parts.map((p) => <tr key={p.key}><td><span className="trend-key" style={{ background: p.color }} aria-hidden="true" />{p.label}</td><td className="num">{p.value}%</td></tr>)}</tbody>
  </table>;
  return <div className="spread">
    <div className="spread-hero"><strong>{Number.isFinite(average) ? `${average}%` : '—'}</strong><span>{translateUI('analytics.averageLabel')}</span></div>
    <div className="spread-bar" role="img" aria-label={parts.map((p) => `${p.label}: ${p.value}%`).join(', ')}>
      {parts.filter((p) => p.value > 0).map((p) => <i key={p.key} style={{ flexGrow: p.value, background: p.color }} title={`${p.label}: ${p.value}%`} />)}
    </div>
    <ul className="spread-legend">{parts.map((p) => <li key={p.key}><i style={{ background: p.color }} aria-hidden="true" /><span>{p.label}</span><b>{p.value}%</b></li>)}</ul>
    <small className="spread-note">{of}</small>
  </div>;
}

// The AI score of each program (an administrator) or each syllabus (a faculty member) as horizontal bars, best first as programScores orders them.
// One series, so one colour; the value sits at the tip of each bar, with a light 0-100 scale under them. The table view shows the same numbers.
const TICKS = [0, 25, 50, 75, 100];
function ScoreBars({ data, view, isFaculty, label }) {
  const tip = (d) => (isFaculty ? `${d.label}: ${d.value}%` : translateUI('analytics.barTip', { label: d.label, avg: d.value, count: d.checked }));
  if (view === 'table') return <table className="trend-table chart-table" aria-label={label}>
    <thead><tr><th>{translateUI(isFaculty ? 'analytics.course' : 'analytics.program')}</th>{!isFaculty && <th className="num">{translateUI('analytics.checked')}</th>}<th className="num">{translateUI(isFaculty ? 'analytics.score' : 'analytics.average')}</th></tr></thead>
    <tbody>{data.map((d, i) => <tr key={d.label + i}><td><b>{d.label}</b></td>{!isFaculty && <td className="num">{d.checked}</td>}<td className="num">{d.value}%</td></tr>)}</tbody>
  </table>;
  return <div className="hbars">
    <ol className="hbar-list" aria-label={label}>
      {data.map((d, i) => <li key={d.label + i} title={tip(d)}><span className="hbar-label">{d.label}</span><span className="hbar-plot"><i style={{ width: `${d.value}%` }} /><b>{d.value}%</b></span></li>)}
    </ol>
    <div className="hbar-axis" aria-hidden="true"><span /><span className="hbar-ticks">{TICKS.map((v) => <small key={v} style={{ left: `${v}%` }}>{v}</small>)}</span></div>
  </div>;
}

function Dimensions({ areas }) {
  return <div className="radar-like">{areas.map(a => <Progress key={a.key} label={tr(a.name)} value={a.average} />)}</div>;
}

export default function Analytics({ syllabi, user }) {
  const yearScope = useYearScope(), year = yearScope ? yearScope.param('data') : undefined; // the academic year of this screen (undefined: the current one)
  const isFaculty = user.role === 'faculty';
  const mine = useMemo(() => (isFaculty ? syllabi.filter(s => s.userId === user.id) : syllabi), [syllabi, user, isFaculty]);

  // The stored checks, read once when the page opens. If they cannot be read the page says so instead of showing zeros.
  const [checks, setChecks] = useState(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    complianceApi.list('all', year).then(res => { if (live) { setChecks(res && res.installed !== false ? res : null); setLoaded(true); } }, () => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, [year]);
  const rows = checks && Array.isArray(checks.syllabi) ? checks.syllabi : null;

  const average = aiAverage(rows);
  const bands = scoreBands(rows);
  const bars = useMemo(() => {
    if (!rows) return [];
    if (isFaculty) return rows.filter(r => r.run && Number.isFinite(r.run.overall)).map(r => ({ label: r.courseCode, value: r.run.overall }));
    return programScores(rows).filter(p => p.average !== null).map(p => ({ label: p.program, value: p.average, checked: p.checked }));
  }, [rows, isFaculty]);
  const [spreadView, setSpreadView] = useState('chart');
  const [barsView, setBarsView] = useState('chart');
  const areas = checks && checks.summary && Array.isArray(checks.summary.areas) ? checks.summary.areas : [];

  const insights = useMemo(() => {
    const count = (...statuses) => mine.filter(s => statuses.includes(s.status)).length;
    const pending = count('submitted', 'under_review');
    const out = [];
    const add = (title, text) => out.push({ n: String(out.length + 1).padStart(2, '0'), title: translateUI(title), text });
    if (isFaculty) {
      add('analytics.insight.yourScoreTitle', average === null ? translateUI('analytics.insight.noScoreText') : translateUI('analytics.insight.yourScoreText', { avg: average, count: bands.count }));
      add('analytics.insight.pendingTitle', translateUI('analytics.insight.pendingText', { count: pending }));
      add('analytics.insight.attentionTitle', translateUI('analytics.insight.attentionText', { count: count('for_revision', 'rejected') }));
      add('analytics.insight.tipTitle', translateUI('analytics.insight.tipText'));
      return out;
    }
    const programs = rows ? programScores(rows).filter(p => p.average !== null) : [];
    if (programs.length) add('analytics.insight.topProgramTitle', translateUI('analytics.insight.topProgramText', { program: programs[0].program, avg: programs[0].average, count: programs[0].checked }));
    const scoredAreas = areas.filter(a => Number.isFinite(a.average)).sort((a, b) => a.average - b.average);
    if (scoredAreas.length) add('analytics.insight.weakAreaTitle', translateUI('analytics.insight.weakAreaText', { area: tr(scoredAreas[0].name), avg: scoredAreas[0].average }));
    add('analytics.insight.pendingTitle', translateUI('analytics.insight.pendingText', { count: pending }));
    if (checks && checks.summary) add('analytics.insight.uncheckedTitle', translateUI('analytics.insight.uncheckedText', { count: checks.summary.unchecked }));
    return out;
  }, [mine, rows, areas, checks, average, bands.count, isFaculty]);

  const barsTitle = translateUI(isFaculty ? 'analytics.barsTitleFaculty' : 'analytics.barsTitleAdmin');
  const none = <div className="empty">{translateUI(loaded ? 'analytics.empty' : 'analytics.loading')}</div>;
  return (
    <>
      <PageHead title={isFaculty ? translateUI("ui.my_analytics_1ab328") : translateUI("ui.analytics_quality_dashboard_b85172")} subtitle={isFaculty ? translateUI("ui.track_your_personal_compliance_scores_and_submission_performance_b66964") : translateUI("ui.monitor_compliance_curriculum_coverage_submission_performance_and_78b463")} actions={<><YearFilter group="data" /><StableButton className="btn outline">{translateUI("ui.download_report_9f36e2")}</StableButton></>} />
      <div className="analytics-grid two">
        <ChartCard title={translateUI('analytics.spreadTitle')} subtitle={translateUI(isFaculty ? 'analytics.spreadSubtitleFaculty' : 'analytics.spreadSubtitleAdmin')} action={bands.count ? <ViewSwitch view={spreadView} setView={setSpreadView} /> : null}>
          {bands.count ? <ScoreSpread average={average} bands={bands} view={spreadView} /> : none}
        </ChartCard>
        <ChartCard title={barsTitle} subtitle={translateUI(isFaculty ? 'analytics.barsSubtitleFaculty' : 'analytics.barsSubtitleAdmin')} action={bars.length ? <ViewSwitch view={barsView} setView={setBarsView} /> : null}>
          {bars.length ? <ScoreBars data={bars} view={barsView} isFaculty={isFaculty} label={barsTitle} /> : none}
        </ChartCard>
      </div>
      <div className="analytics-grid two">
        <ChartCard title={translateUI("ui.quality_dimensions_41c80b")} subtitle={isFaculty ? translateUI("ui.your_quality_scores_8f5d5e") : translateUI("ui.average_percentage_scores_by_program_3c980a")}>
          {areas.length ? <Dimensions areas={areas} /> : none}
        </ChartCard>
        <ChartCard title={translateUI("ui.actionable_insights_9816fd")} subtitle={isFaculty ? translateUI("ui.tips_for_your_submissions_76ea2a") : translateUI("ui.ai_generated_quality_observations_82b3fd")}><div className="insights">{insights.map(i => <Insight key={i.n} {...i} />)}</div></ChartCard>
      </div>
    </>
  );
}
