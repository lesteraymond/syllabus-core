import { YearFilter, useYearScope } from '../components/AcademicYearScope';
import StableButton, { StableLabel } from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useMemo, useState } from 'react';
import { PageHead, Card, Icon, Progress, QualityMini } from '../components/ui';
import UpcomingDeadlines from '../components/UpcomingDeadlines';
import ProgramTrendModal from '../components/ProgramTrendModal';
import TimeUsageCard from '../components/TimeUsageCard';
import { describeActivity, groupByDay } from '../lib/activityView';
import TypewriterText from '../components/TypewriterText';
import { compliance as complianceApi, courses as coursesApi, outcomes as outcomesApi, logs as logsApi, users as usersApi } from '../lib/api';
import { adminStatCards } from '../lib/adminDashboardStats';
import { canAuthor, isReviewer, roleAllows } from '../lib/roles';
import { FACULTY_SUBMITTED, aiAverage, approval, programCoverage, snapshotOf } from '../lib/complianceStats';
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

// onNewSyllabus: opens the builder on a NEW syllabus (App clears whatever was being edited, as My Syllabi does); without it the builder simply opens.
export default function Dashboard({ setPage, user, syllabi, logs, onNewSyllabus }) {
  const yearScope = useYearScope(), year = yearScope ? yearScope.param('data') : undefined; // the academic year of this screen (undefined: the current one)
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
    complianceApi.list('all', year).then(res => { if (live) setChecks(res && res.installed !== false ? res : null); }, () => {});
    return () => { live = false; };
  }, [year]);
  const rows = checks && Array.isArray(checks.syllabi) ? checks.syllabi : null;
  const aiScore = aiAverage(rows);
  const share = approval(data);

  // Admin summary cards also count the catalog, and Program Compliance measures each program against its subjects. Read once when the dashboard opens;
  // a failed read shows a dash, never breaks the page.
  const [catalog, setCatalog] = useState({ programs: null, subjects: null });
  useEffect(() => {
    if (!isReviewer(user.role) && !isFac) return undefined; // faculty: the server sends only their assigned programs and subjects
    let live = true;
    const read = request => request.then(rows => (Array.isArray(rows) ? rows : null), () => null);
    // the catalog of the academic year this screen shows (a new academic year starts with none); an administrator's "all years" counts the current one
    const catalogYear = year === 'all' ? undefined : year;
    Promise.all([read(outcomesApi.programs(catalogYear)), read(coursesApi.list(undefined, undefined, catalogYear))]).then(([programs, subjects]) => { if (live) setCatalog({ programs, subjects }); });
    return () => { live = false; };
  }, [user.role, year, isFac]);
  const [trendOpen, setTrendOpen] = useState(false); // "View analytics" on Program Compliance (reviewers): the trend over time
  const catalogCounts = { programs: catalog.programs ? catalog.programs.length : null, subjects: catalog.subjects ? catalog.subjects.length : null };

  const stats = isFac
    ? [['My Submissions', String(total), 'Total uploaded', 'blue'], ['Approved', String(approved), translateUI('dashboard.stats.approvedHint', { pct: share.percent }), 'green'], ['Pending Review', String(submitted + underReview), 'Awaiting decision', 'gold'], ['For Revision', String(forRevision), 'Needs changes', 'teal'], ['AI Compliance Score', aiScore === null ? '—' : `${aiScore}%`, translateUI(aiScore === null ? 'dashboard.stats.noChecks' : 'dashboard.stats.avgHint'), 'purple']]
    : adminStatCards({ programs: catalogCounts.programs, subjects: catalogCounts.subjects, syllabi });

  // Recent Activity as sentences under Today / Yesterday / a date (see lib/activityView.js); times are Philippine time.
  // Each account sees only its own activity: the server sends only that (GET /api/logs): the review (submit, check, approve, ...) and the account's own
  // activity (sign-in and sign-out, password, name, photo, language, drafts, edits, deletions, account management). It is an audit trail kept for
  // transparency, so it cannot be cleared or hidden: there is no "Clear Logs", and a hide remembered in this browser from before is no longer applied.
  // The administrator alone may also read everyone's, or one person's (GET /api/logs?scope=all[&userId=]); the server refuses anyone else.
  const isAdminUser = user.role === 'admin';
  const [activityScope, setActivityScope] = useState('mine'); // 'mine' | 'all' | a user id
  const [people, setPeople] = useState([]);
  const [others, setOthers] = useState({ rows: [], loading: false, error: '' });
  useEffect(() => {
    if (!isAdminUser) return undefined;
    let live = true;
    usersApi.list().then((list) => { if (live) setPeople(Array.isArray(list) ? list.filter((p) => p.role !== 'student') : []); }, () => {});
    return () => { live = false; };
  }, [isAdminUser]);
  useEffect(() => {
    if (!isAdminUser || activityScope === 'mine') return undefined;
    let live = true;
    setOthers((x) => ({ ...x, loading: true, error: '' }));
    logsApi.list({ scope: 'all', userId: activityScope === 'all' ? undefined : activityScope })
      .then((rows) => { if (live) setOthers({ rows: Array.isArray(rows) ? rows : [], loading: false, error: '' }); },
        (e) => { if (live) setOthers({ rows: [], loading: false, error: e.message || '' }); });
    return () => { live = false; };
  }, [isAdminUser, activityScope, logs]); // read again whenever the app refreshes the person's own list
  const viewingOthers = isAdminUser && activityScope !== 'mine';
  const activityGroups = useMemo(() => {
    const source = viewingOthers ? others.rows : logs.filter(l => l.userId === user.id);
    return groupByDay(source.map((l, i) => describeActivity(l, i, user.id)));
  }, [logs, user, viewingOthers, others.rows]);
  const activityPicker = isAdminUser ? (
    <Select aria-label={translateUI('accountActivity.viewLabel')} value={activityScope} onChange={(e) => setActivityScope(e.target.value || 'mine')}>
      <option value="mine">{translateUI('accountActivity.mine')}</option>
      <option value="all">{translateUI('accountActivity.everyone')}</option>
      {people.filter((p) => p.id !== user.id).map((p) => <option key={p.id} value={String(p.id)}>{(p.firstName + ' ' + p.lastName).trim() || p.email}</option>)}
    </Select>
  ) : null;

  // The administrator's side (and the other reviewers): each program's subjects with an approved syllabus, out of all its subjects; AI check or not.
  // 100% when every subject of the program has an approved syllabus (lib/complianceStats.js programCoverage).
  // A faculty member: for each assigned program, their assigned subjects they have submitted a syllabus for (Submitted, Under Review or Approved), out of
  // all their assigned subjects in it; 100% when every assigned subject has been submitted. Their own syllabi only.
  const coverage = useMemo(() => (catalog.programs && catalog.subjects
    ? (isFac ? programCoverage(catalog.programs, catalog.subjects, my, { statuses: FACULTY_SUBMITTED }) : programCoverage(catalog.programs, catalog.subjects, syllabi))
    : null), [isFac, catalog, syllabi, my]);
  const SNAPSHOT_LABELS = { template: 'ui.format_041a5d', completeness: 'ui.completeness_778184', co_po: 'ui.co_po_9c8106', assessment: 'ui.assessment_ef136f' };
  // The final AI check score (the rules' score minus the AI deductions) and the four areas after those deductions, with the lowest named (lib/complianceStats.js)
  const snapshot = useMemo(() => snapshotOf(checks && checks.summary), [checks]);

  return (
    <div className="dashboard-view">
      <PageHead title={<TypewriterText text={greeting} />} subtitle={translateUI("ui.here_s_what_is_happening_with_your_undergraduate_syllabi_834d17")} actions={<><YearFilter group="data" />{canAuthor(user.role) && <StableButton className="btn primary" onClick={() => (onNewSyllabus ? onNewSyllabus() : setPage('builder'))}>{translateUI("ui.new_syllabus_c4c7a9")}</StableButton>}</>} />
      <section className="stat-grid">{stats.map(([a, b, c, d]) => <div className="stat-card" key={a}><div className={`stat-icon ${d}`}><Icon weight="regular" name={STAT_ICONS[a]} size={20} /></div><span>{tr(a)}</span><strong>{b}</strong><small>{tr(c)}</small></div>)}</section>
      <div className="dashboard-grids-wrap">
        <section className="dashboard-grid">
        <Card title={translateUI('accountActivity.title')} action={activityPicker}>
          <div className="feed">
            {viewingOthers && others.error && <div className="info-banner warning" role="alert">{translateUI('accountActivity.unreadable') + tr(others.error)}</div>}
            {activityGroups.map((g) => (
              <section className="feed-day" key={g.label} aria-label={tr(g.label)}>
                <h4 className="feed-date">{tr(g.label)}</h4>
                <ol className="feed-list">
                  {g.items.map((it) => (
                    <li className={'feed-item ' + it.tone} key={it.key}>
                      <span className="feed-ico"><Icon name={it.icon} size={18} weight="regular" /></span>
                      <div className="feed-body">
                        <p><strong>{tr(it.who)}</strong> {tr(it.verb)}{it.subject && <> <strong>{it.subject}</strong></>}</p>
                        {(it.detail || it.note) && <small>{[it.detail, it.note && tr(it.note)].filter(Boolean).join(' · ')}</small>}
                      </div>
                      <time dateTime={it.iso}>{it.time}</time>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
            {activityGroups.length === 0 && viewingOthers && !others.error && <div className="empty">{translateUI(others.loading ? 'accountActivity.loading' : 'accountActivity.none')}</div>}
            {activityGroups.length === 0 && !viewingOthers && <div className="empty">{isFac ? translateUI("ui.nothing_yet_what_you_upload_submit_and_update_appears_here_f8bbff") : translateUI("ui.nothing_yet_your_reviews_and_decisions_appear_here_6bd686")}</div>}
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
                subtitle = <>{submitted + underReview}<StableLabel>{translateUI("ui.submissions_awaiting_review_31080a")}</StableLabel></>;
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
        <Card title={translateUI("ui.program_compliance_943fac")} action={isFac ? tr("View analytics") : <button type="button" className="link-btn card-action-btn" data-testid="view-analytics" disabled={!catalog.programs || !catalog.subjects} onClick={() => setTrendOpen(true)}>{tr("View analytics")}</button>}>
          {coverage && coverage.length > 0
            ? coverage.map(p => <Progress key={p.program} label={p.program} value={p.percent} note={isFac
              ? (p.total ? translateUI('dashboard.stats.programAssigned', { done: p.approved, total: p.total }) : translateUI('dashboard.stats.programNoneAssigned'))
              : (p.total ? translateUI('dashboard.stats.programSubjects', { approved: p.approved, total: p.total }) : translateUI('dashboard.stats.programNoSubjects'))} />)
            : <div className="empty">{translateUI("ui.no_program_data_yet_c5b890")}</div>
          }
        </Card>
        <Card title={translateUI("ui.ai_quality_snapshot_c296aa")}>
          {/* the four rings centered, each area after the AI deductions; the lowest is red and its tooltip names it */}
          <div className="quality-row">{snapshot.areas.map(a => {
            const low = !!snapshot.lowest && snapshot.lowest.key === a.key;
            return <QualityMini key={a.key} label={translateUI(SNAPSHOT_LABELS[a.key])} value={a.score} low={low} title={low ? translateUI('snapshot.lowest', { area: translateUI(SNAPSHOT_LABELS[a.key]), score: a.score }) : undefined} />;
          })}</div>
        </Card>
        {(isFac || user.role === 'admin') && <Card title={translateUI("ui.upcoming_deadlines_b56518")} hideScrollbar><UpcomingDeadlines role={user.role} onOpen={() => setPage(isFac ? 'my-syllabi' : 'courses')} onOpenOwn={() => setPage('my-syllabi')} /></Card>}
      </section>
      </div>
      {trendOpen && <ProgramTrendModal programs={catalog.programs || []} subjects={catalog.subjects || []} year={year === 'all' ? undefined : year} onClose={() => setTrendOpen(false)} />}
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
