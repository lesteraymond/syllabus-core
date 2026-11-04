import StableButton, { StableLabel } from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useMemo, useState } from 'react';
import { PageHead, Card, Icon, Progress, QualityMini } from '../components/ui';
import UpcomingDeadlines from '../components/UpcomingDeadlines';
import TimeUsageCard from '../components/TimeUsageCard';
import { afterCleared, describeActivity, groupByDay, readClearedAt, writeClearedAt } from '../lib/activityView';
import TypewriterText from '../components/TypewriterText';
import { compliance as complianceApi, courses as coursesApi, outcomes as outcomesApi } from '../lib/api';
import { adminStatCards } from '../lib/adminDashboardStats';
import { isReviewer, roleAllows } from '../lib/roles';
import { aiAverage, approval, areaAverages, programScores } from '../lib/complianceStats';
import { sentenceCase } from '../lib/sentenceCase';
import { dayPeriod } from '../lib/phTime';
import Select from '../components/Select';
import CustomizeQuickActionsModal from '../components/CustomizeQuickActionsModal';
import { navItems } from '../data/initialData';

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


const QA_SUB_KEYS = {
  builder: 'dashboard.quickActions.sub.builder',
  'my-syllabi': 'dashboard.quickActions.sub.mySyllabi',
  ai: 'dashboard.quickActions.sub.ai',
  review: 'dashboard.quickActions.sub.review',
  courses: 'dashboard.quickActions.sub.courses',
  repository: 'dashboard.quickActions.sub.repository',
  compliance: 'dashboard.quickActions.sub.compliance',
  analytics: 'dashboard.quickActions.sub.analytics',
  reports: 'dashboard.quickActions.sub.reports',
  users: 'dashboard.quickActions.sub.users',
  settings: 'dashboard.quickActions.sub.settings',
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
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const defaultKeys = useMemo(() => isFac ? ['builder', 'my-syllabi'] : ['ai', 'review'], [isFac]);
  const storageKey = `lcup_qa_${user?.id || 'guest'}`;

  const availableNav = useMemo(() => {
    return navItems
      .filter(([k, , , r]) => k !== 'dashboard' && roleAllows(r, user?.role))
      .map(([k, icon, label]) => ({
        key: k,
        icon,
        label,
        subKey: QA_SUB_KEYS[k] || 'dashboard.quickActions.dialogHint',
      }));
  }, [user?.role]);

  const [customKeys, setCustomKeys] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey));
      if (Array.isArray(stored) && stored.length > 0) {
        const valid = stored.filter(k => availableNav.some(n => n.key === k));
        if (valid.length > 0) return valid.slice(0, 3);
      }
    } catch {}
    return defaultKeys;
  });

  const handleSaveQuickActions = (newKeys) => {
    setCustomKeys(newKeys);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newKeys));
    } catch {}
  };

  const data = isFac ? my : syllabi;

  const approved = data.filter(s => s.status === 'approved').length;
  const submitted = data.filter(s => s.status === 'submitted').length;
  const underReview = data.filter(s => s.status === 'under_review').length;
  const forRevision = data.filter(s => s.status === 'for_revision').length;
  const total = data.length;
  // The AI checks behind the compliance numbers: the latest stored check of each syllabus (an administrator: every submitted syllabus;
  // a faculty member: their own). Read once when the dashboard opens. If it cannot be read, the approval numbers still show and the
  // AI score is a dash. The AI score and the approval share are different things and are never mixed.
  const [checks, setChecks] = useState(null);
  useEffect(() => {
    let live = true;
    complianceApi.list('all').then(res => { if (live) setChecks(res && res.installed !== false ? res : null); }, () => {});
    return () => { live = false; };
  }, []);
  const rows = checks && Array.isArray(checks.syllabi) ? checks.syllabi : null;
  const aiScore = aiAverage(rows);
  const share = approval(data);

  // Admin summary cards also count the catalog. Read once when the dashboard opens; a failed read shows a dash, never breaks the page.
  const [catalogCounts, setCatalogCounts] = useState({ programs: null, subjects: null });
  useEffect(() => {
    if (!isReviewer(user.role)) return undefined;
    let live = true;
    const count = request => request.then(rows => (Array.isArray(rows) ? rows.length : null), () => null);
    Promise.all([count(outcomesApi.programs()), count(coursesApi.list())]).then(([programs, subjects]) => { if (live) setCatalogCounts({ programs, subjects }); });
    return () => { live = false; };
  }, [user.role]);

  const stats = isFac
    ? [['My Submissions', String(total), 'Total uploaded', 'blue'], ['Approved', String(approved), translateUI('dashboard.stats.approvedHint', { pct: share.percent }), 'green'], ['Pending Review', String(submitted + underReview), 'Awaiting decision', 'gold'], ['For Revision', String(forRevision), 'Needs changes', 'teal'], ['AI Compliance Score', aiScore === null ? '—' : `${aiScore}%`, translateUI(aiScore === null ? 'dashboard.stats.noChecks' : 'dashboard.stats.avgHint'), 'purple']]
    : adminStatCards({ programs: catalogCounts.programs, subjects: catalogCounts.subjects, syllabi });

  // Recent Activity as sentences under Today / Yesterday / a date (see lib/activityView.js); times are Philippine time.
  // Each account sees only its own activity: the server sends only that (GET /api/logs), and "Clear Logs" hides it up to now, per account.
  const [cleared, setCleared] = useState(() => readClearedAt(user.id));
  const activityGroups = useMemo(() => {
    const mine = afterCleared(logs.filter(l => l.userId === user.id), cleared);
    return groupByDay(mine.map((l, i) => describeActivity(l, i, user.id)));
  }, [logs, user, cleared]);

  // Per program: the average AI score of its checked syllabi (the bar) and, separately, how many were approved. Until the checks have been
  // read, the plain syllabus list gives the approval numbers and the bars show a dash.
  const programs = useMemo(() => programScores(rows || syllabi), [rows, syllabi]);
  const SNAPSHOT_LABELS = { template: 'ui.format_041a5d', completeness: 'ui.completeness_778184', co_po: 'ui.co_po_9c8106', assessment: 'ui.assessment_ef136f' };
  const snapshot = useMemo(() => areaAverages(checks && checks.summary), [checks]);

  return (
    <div className="dashboard-view">
      <PageHead title={<TypewriterText text={greeting} />} subtitle={translateUI("ui.here_s_what_is_happening_with_your_undergraduate_syllabi_834d17")} actions={<>{!isFac && <StableButton className="btn primary" onClick={() => setPage('builder')}>{translateUI("ui.new_syllabus_c4c7a9")}</StableButton>}</>} />
      <section className="stat-grid">{stats.map(([a, b, c, d]) => <div className="stat-card" key={a}><div className={`stat-icon ${d}`}><Icon weight="regular" name={STAT_ICONS[a]} size={20} /></div><span>{sentenceCase(tr(a))}</span><strong>{b}</strong><small>{tr(c)}</small></div>)}</section>
      <div className="dashboard-grids-wrap">
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
        <Card
          title={translateUI("ui.quick_actions_c40810")}
          action={
            <StableButton
              className="btn ghost"
              style={{ padding: '4px 8px', fontSize: '12px' }}
              onClick={() => setCustomizeOpen(true)}
            >
              <StableLabel>{translateUI("dashboard.quickActions.customize")}</StableLabel>
            </StableButton>
          }
        >
          <div className="quick-actions">
            {customKeys.map((k) => {
              const item = availableNav.find(n => n.key === k);
              if (!item) return null;

              let title = tr(item.label);
              let subtitle = translateUI(item.subKey);

              if (k === 'builder') {
                title = isFac ? translateUI("ui.check_a_syllabus_f9c218") : translateUI("ui.new_syllabus_c4c7a9");
                subtitle = isFac ? translateUI("ui.run_the_compliance_check_in_step_7_of_the_builder_d861f3") : translateUI(item.subKey);
              } else if (k === 'my-syllabi') {
                title = translateUI("ui.my_syllabi_3da1e8");
                subtitle = sentenceCase(translateUI("ui.syllabi_in_your_account_732cf8").trim());
              } else if (k === 'ai') {
                title = translateUI("ui.compliance_overview_f4109d");
                subtitle = translateUI("ui.read_the_stored_check_of_each_submitted_syllabus_921a70");
              } else if (k === 'review') {
                title = translateUI("ui.review_pending_syllabi_bf50c2");
                subtitle = <>{submitted + underReview}{' '}<StableLabel>{translateUI("ui.submissions_awaiting_review_31080a")}</StableLabel></>;
              }

              return (
                <button key={k} onClick={() => setPage(k)}>
                  <b><Icon weight="regular" name={item.icon} size={20} /></b>
                  <span>
                    <StableLabel>{title}</StableLabel>
                    {subtitle ? <small><StableLabel>{subtitle}</StableLabel></small> : null}
                  </span>
                  <Icon weight="regular" name="caretRight" size={16} />
                </button>
              );
            })}
          </div>
        </Card>
      </section>
      <section className="dashboard-grid lower">
        <Card title={translateUI("ui.program_compliance_943fac")} action={tr("View analytics")} onAction={() => setPage('analytics')}>
          {programs.length > 0
            ? programs.map(p => <Progress key={p.program} label={p.program} value={p.average} note={translateUI(p.checked ? 'dashboard.stats.programChecked' : 'dashboard.stats.programNone', { checked: p.checked, total: p.total, approved: p.approved, pct: p.approvedPercent })} />)
            : <div className="empty">{translateUI("ui.no_program_data_yet_c5b890")}</div>
          }
        </Card>
        <Card title={translateUI("ui.ai_quality_snapshot_c296aa")}>{snapshot.map(a => <QualityMini key={a.key} label={translateUI(SNAPSHOT_LABELS[a.key])} value={a.average} />)}<p className="cmp-small">{translateUI(snapshot.some(a => a.average !== null) ? "dashboard.stats.snapshotNote" : "dashboard.stats.noScore")}</p></Card>
        {(isFac || user.role === 'admin') && <Card title={translateUI("ui.upcoming_deadlines_b56518")} hideScrollbar><UpcomingDeadlines role={user.role} onOpen={() => setPage(isFac ? 'my-syllabi' : 'courses')} /></Card>}
      </section>
      </div>
      {customizeOpen && (
        <CustomizeQuickActionsModal
          availableItems={availableNav}
          selectedKeys={customKeys}
          defaultKeys={defaultKeys}
          onSave={handleSaveQuickActions}
          onClose={() => setCustomizeOpen(false)}
        />
      )}
    </div>
  );
}
