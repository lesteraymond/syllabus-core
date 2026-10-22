import StableButton, { StableLabel } from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useMemo, useState } from 'react';
import { PageHead, Card, Icon, Progress, QualityMini } from '../components/ui';
import UpcomingDeadlines from '../components/UpcomingDeadlines';
import TimeUsageCard from '../components/TimeUsageCard';
import { afterCleared, describeActivity, groupByDay, readClearedAt, writeClearedAt } from '../lib/activityView';
import TypewriterText from '../components/TypewriterText';
import { courses as coursesApi, outcomes as outcomesApi } from '../lib/api';
import { adminStatCards } from '../lib/adminDashboardStats';
import { sentenceCase } from '../lib/sentenceCase';
import { dayPeriod } from '../lib/phTime';
import Select from '../components/Select';
import { buildAnalytics } from '../lib/analyticsView';
import { useComplianceRows } from '../lib/useComplianceRows';

// Stat card icon per label (Phosphor names, see Icon in ui.jsx)
const STAT_ICONS = {
  'My Submissions': 'notebook',
  'Approved': 'approved',
  'Pending Review': 'hourglassMedium',
  'For Revision': 'revise',
  'AI Compliance Score': 'shieldCheck',
  'Programs': 'program',
  'Subjects': 'subject',
  'Under Review': 'underReview',
  'Total Courses': 'graduationCap',
  'Submitted Syllabi': 'paperPlaneTilt',
};

export default function Dashboard({ setPage, user, syllabi, logs, clearLogs, setConfirm }) {
  // Settings updates this shared profile after a successful save.
  const name = user.firstName?.trim();
  // Morning, afternoon or evening on the Manila clock (checked again each minute, so a dashboard left open changes at 12:00 and 18:00).
  const [period, setPeriod] = useState(() => dayPeriod());
  useEffect(() => {
    const timer = window.setInterval(() => setPeriod(dayPeriod()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const key = 'dashboard.good' + period[0].toUpperCase() + period.slice(1);
  const greeting = name ? translateUI(key, { name }) : translateUI(key + 'NoName');
  const my = useMemo(() => syllabi.filter(s => s.userId === user.id), [syllabi, user]);
  const isFac = user.role === 'faculty';
  const data = isFac ? my : syllabi;

  const approved = data.filter(s => s.status === 'approved').length;
  const submitted = data.filter(s => s.status === 'submitted').length;
  const underReview = data.filter(s => s.status === 'under_review').length;
  const forRevision = data.filter(s => s.status === 'for_revision').length;
  const total = data.length;
  // The compliance numbers come from the stored AI checks (the average of the latest score of each checked syllabus), not from how many are approved.
  const { rows: checkRows } = useComplianceRows();
  const checks = useMemo(() => buildAnalytics(checkRows, { isFaculty: isFac }), [checkRows, isFac]);
  const compliance = checks.average === null ? 0 : checks.average;
  const areaOf = (label) => { const e = checks.areas.find(([l]) => l === label); return e && e[1] !== null ? e[1] : 0; };

  // Admin summary cards also count the catalog. Read once when the dashboard opens; a failed read shows a dash, never breaks the page.
  const [catalogCounts, setCatalogCounts] = useState({ programs: null, subjects: null });
  useEffect(() => {
    if (user.role !== 'admin') return undefined;
    let live = true;
    const count = request => request.then(rows => (Array.isArray(rows) ? rows.length : null), () => null);
    Promise.all([count(outcomesApi.programs()), count(coursesApi.list())]).then(([programs, subjects]) => { if (live) setCatalogCounts({ programs, subjects }); });
    return () => { live = false; };
  }, [user.role]);

  const stats = isFac
    ? [['My Submissions', String(total), 'Total uploaded', 'blue'], ['Approved', String(approved), 'Accepted syllabi', 'green'], ['Pending Review', String(submitted + underReview), 'Awaiting decision', 'gold'], ['For Revision', String(forRevision), 'Needs changes', 'teal'], ['AI Compliance Score', checks.average === null ? '—' : `${compliance}%`, checks.average === null ? 'Not checked yet' : 'Average of your checks', 'purple']]
    : adminStatCards({ programs: catalogCounts.programs, subjects: catalogCounts.subjects, syllabi });

  // Recent Activity as sentences under Today / Yesterday / a date (see lib/activityView.js); times are Philippine time.
  // Each account sees only its own activity: the server sends only that (GET /api/logs), and "Clear Logs" hides it up to now, per account.
  const [cleared, setCleared] = useState(() => readClearedAt(user.id));
  const activityGroups = useMemo(() => {
    const mine = afterCleared(logs.filter(l => l.userId === user.id), cleared);
    return groupByDay(mine.map((l, i) => describeActivity(l, i, user.id)));
  }, [logs, user, cleared]);

  // Average check score per program, from the stored checks (highest first). A program with no scored syllabus is not listed.
  const programs = useMemo(() => {
    const map = new Map();
    checkRows.forEach(r => {
      if (!r.programCode || !r.run || typeof r.run.overall !== 'number') return;
      map.set(r.programCode, [...(map.get(r.programCode) || []), r.run.overall]);
    });
    return [...map.entries()].map(([p, xs]) => [p, Math.round(xs.reduce((x, y) => x + y, 0) / xs.length)]).sort((x, y) => y[1] - x[1]);
  }, [checkRows]);

  return (
    <>
      <PageHead title={<TypewriterText text={greeting} />} subtitle={translateUI("ui.here_s_what_is_happening_with_your_undergraduate_syllabi_834d17")} actions={<>{!isFac && <StableButton className="btn primary" onClick={() => setPage('builder')}>{translateUI("ui.new_syllabus_c4c7a9")}</StableButton>}</>} />
      <section className="stat-grid">{stats.map(([a, b, c, d]) => <div className="stat-card" key={a}><div className={`stat-icon ${d}`}><Icon weight="regular" name={STAT_ICONS[a]} size={20} /></div><span>{sentenceCase(tr(a))}</span><strong>{b}</strong><small>{tr(c)}</small></div>)}</section>
      <section className="dashboard-grid">
        <Card title={translateUI("ui.recent_activity_8aebf3")} action={<StableButton className="btn ghost" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => setConfirm({ title: translateUI("ui.clear_logs_7c3089"), message: translateUI("ui.clear_your_activity_from_this_list_nothing_is_deleted_it_only_hid_fb5d0d"), label: 'Clear', onConfirm: () => { setCleared(writeClearedAt(user.id)); clearLogs(); } })}>{translateUI("ui.clear_logs_7c3089")}</StableButton>}>
          <div className="feed">
            {activityGroups.map((g) => (
              <section className="feed-day" key={g.label} aria-label={tr(g.label)}>
                <h4 className="feed-date">{tr(g.label)}</h4>
                <ol className="feed-list">
                  {g.items.map((it) => (
                    <li className={'feed-item ' + it.tone} key={it.key}>
                      <span className="feed-ico"><Icon name={it.icon} size={18} weight="regular" /></span>
                      <div className="feed-body">
                        <p><strong>{tr(it.who)}</strong> {tr(it.verb)} <strong>{it.subject}</strong></p>
                        {it.detail && <small>{it.detail}</small>}
                      </div>
                      <time dateTime={it.iso}>{it.time}</time>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
            {activityGroups.length === 0 && <div className="empty">{isFac ? translateUI("ui.nothing_yet_what_you_upload_submit_and_update_appears_here_f8bbff") : translateUI("ui.nothing_yet_your_reviews_and_decisions_appear_here_6bd686")}</div>}
          </div>
        </Card>
        <Card title={translateUI("dashboard.usage.title")}>
          <TimeUsageCard />
        </Card>
        <Card title={translateUI("ui.quick_actions_c40810")} hideScrollbar>
          <div className="quick-actions">
            <button onClick={() => setPage(isFac ? 'builder' : 'ai')}><b><Icon weight="regular" name="sparkle" size={20} /></b><span><StableLabel>{isFac ? translateUI("ui.check_a_syllabus_f9c218") : translateUI("ui.compliance_overview_f4109d")}</StableLabel><small><StableLabel>{isFac ? translateUI("ui.run_the_compliance_check_in_step_7_of_the_builder_d861f3") : translateUI("ui.read_the_stored_check_of_each_submitted_syllabus_921a70")}</StableLabel></small></span><Icon weight="regular" name="caretRight" size={16} /></button>
            {isFac ? <button onClick={() => setPage('my-syllabi')}><b><Icon weight="regular" name="notebook" size={20} /></b><span><StableLabel>{translateUI("ui.my_syllabi_3da1e8")}</StableLabel><small>{total}{' '}<StableLabel>{translateUI("ui.syllabi_in_your_account_732cf8")}</StableLabel></small></span><Icon weight="regular" name="caretRight" size={16} /></button> : <button onClick={() => setPage('review')}><b><Icon weight="regular" name="sealCheck" size={20} /></b><span><StableLabel>{translateUI("ui.review_pending_syllabi_bf50c2")}</StableLabel><small>{submitted + underReview}{' '}<StableLabel>{translateUI("ui.submissions_awaiting_review_31080a")}</StableLabel></small></span><Icon weight="regular" name="caretRight" size={16} /></button>}
          </div>
        </Card>
      </section>
      <section className="dashboard-grid lower">
        <Card title={translateUI("ui.program_compliance_943fac")} action={tr("View analytics")} onAction={() => setPage('analytics')}>
          {programs.length > 0
            ? programs.map(([p, v]) => <Progress key={p} label={p} value={v} />)
            : <div className="empty">{translateUI("ui.no_program_data_yet_c5b890")}</div>
          }
        </Card>
        <Card title={translateUI("ui.ai_quality_snapshot_c296aa")}><QualityMini label={translateUI("ui.format_041a5d")} value={areaOf('Format')} /><QualityMini label={translateUI("ui.completeness_778184")} value={areaOf('Complete')} /><QualityMini label={translateUI("ui.co_po_9c8106")} value={areaOf('CO–PO')} /><QualityMini label={translateUI("ui.assessment_ef136f")} value={areaOf('Assessment')} /></Card>
        <Card title={translateUI("ui.upcoming_deadlines_b56518")} hideScrollbar><UpcomingDeadlines role={user.role} onOpen={() => setPage(isFac ? 'my-syllabi' : 'courses')} /></Card>
      </section>
    </>
  );
}
