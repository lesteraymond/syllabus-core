import { YearFilter, useYearScope } from '../components/AcademicYearScope';
import StableButton from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useMemo, useState } from 'react';
import { ChartCard, Donut, Insight, Legend, PageHead, Progress } from '../components/ui';
import { compliance as complianceApi } from '../lib/api';
import { aiAverage, programScores, scoreBands } from '../lib/complianceStats';
import Select from '../components/Select';

// Everything on this page is measured: the AI scores come from the latest stored check of each syllabus (an administrator: every submitted
// syllabus; a faculty member: their own), and the counts from the syllabus list. A syllabus that has not been checked has no score and is
// left out of the averages, never counted as zero. Nothing here is estimated or made up.
function DonutBreakdown({ value, high, med, low, empty }) {
  return <div className="donut-panel analytics"><Donut value={empty ? 0 : value} centerTop={empty ? '—' : `${value}%`} centerBottom={tr("Average")} /><div className="legend"><Legend color="var(--blue)" text={translateUI("ui.high_80_100_234a35")} value={`${high}%`} /><Legend color="var(--gold)" text={translateUI("ui.medium_50_79_d47c66")} value={`${med}%`} /><Legend color="var(--red)" text={translateUI("ui.low_50_979304")} value={`${low}%`} /></div></div>;
}

function BarChart({ data }) {
  return <div className="bars">{data.map(([x, v]) => <div className="bar-col" key={x}><span>{v}%</span><i style={{ height: `${v}%` }} /><small>{x}</small></div>)}</div>;
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
    if (isFaculty) return rows.filter(r => r.run && Number.isFinite(r.run.overall)).map(r => [r.courseCode, r.run.overall]);
    return programScores(rows).filter(p => p.average !== null).map(p => [p.program, p.average]);
  }, [rows, isFaculty]);
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

  const none = <div className="empty">{translateUI(loaded ? 'analytics.empty' : 'analytics.loading')}</div>;
  return (
    <>
      <PageHead title={isFaculty ? translateUI("ui.my_analytics_1ab328") : translateUI("ui.analytics_quality_dashboard_b85172")} subtitle={isFaculty ? translateUI("ui.track_your_personal_compliance_scores_and_submission_performance_b66964") : translateUI("ui.monitor_compliance_curriculum_coverage_submission_performance_and_78b463")} actions={<><YearFilter group="data" /><StableButton className="btn outline">{translateUI("ui.download_report_9f36e2")}</StableButton></>} />
      <div className="analytics-grid two">
        <ChartCard title={translateUI('analytics.spreadTitle')} subtitle={translateUI(isFaculty ? 'analytics.spreadSubtitleFaculty' : 'analytics.spreadSubtitleAdmin')}>
          {bands.count ? <DonutBreakdown value={average} high={bands.high} med={bands.medium} low={bands.low} /> : none}
        </ChartCard>
        <ChartCard title={translateUI(isFaculty ? 'analytics.barsTitleFaculty' : 'analytics.barsTitleAdmin')} subtitle={translateUI(isFaculty ? 'analytics.barsSubtitleFaculty' : 'analytics.barsSubtitleAdmin')}>
          {bars.length ? <BarChart data={bars} /> : none}
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
