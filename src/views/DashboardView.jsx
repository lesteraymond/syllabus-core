import StableButton, { StableLabel } from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useMemo, useState } from 'react';
import { PageHead, Card, Icon, Legend, Progress, QualityMini, Deadline, Donut } from '../components/ui';
import { afterCleared, describeActivity, groupByDay, readClearedAt, writeClearedAt } from '../lib/activityView';
import TypewriterText from '../components/TypewriterText';

// Stat card icon per label (Phosphor names, see Icon in ui.jsx)
const STAT_ICONS = {
  'My Submissions': 'notebook',
  'Approved': 'sealCheck',
  'Pending Review': 'hourglassMedium',
  'For Revision': 'notePencil',
  'AI Compliance Score': 'shieldCheck',
  'Total Courses': 'graduationCap',
  'Submitted Syllabi': 'paperPlaneTilt',
};

export default function Dashboard({ setPage, user, syllabi, logs, clearLogs, setConfirm }) {
  const my = useMemo(() => syllabi.filter(s => s.userId === user.id), [syllabi, user]);
  const isFac = user.role === 'faculty';
  const data = isFac ? my : syllabi;

  const approved = data.filter(s => s.status === 'approved').length;
  const submitted = data.filter(s => s.status === 'submitted').length;
  const underReview = data.filter(s => s.status === 'under_review').length;
  const forRevision = data.filter(s => s.status === 'for_revision').length;
  const total = data.length;
  const compliance = total ? Math.round((approved / total) * 100) : 0;

  const stats = isFac
    ? [['My Submissions', String(total), 'Total uploaded', 'blue'], ['Approved', String(approved), 'Accepted syllabi', 'green'], ['Pending Review', String(submitted + underReview), 'Awaiting decision', 'gold'], ['For Revision', String(forRevision), 'Needs changes', 'teal'], ['AI Compliance Score', `${compliance}%`, 'Your compliance rate', 'purple']]
    : [['Total Courses', String(total), 'All syllabi', 'blue'], ['Submitted Syllabi', String(submitted), 'Awaiting review', 'teal'], ['Pending Review', String(underReview), 'Under review', 'gold'], ['Approved', String(approved), 'Accepted syllabi', 'green'], ['AI Compliance Score', `${compliance}%`, 'Institutional average', 'purple'], ['For Revision', String(forRevision), 'Needs changes', 'red']];

  // Recent Activity as sentences under Today / Yesterday / a date (see lib/activityView.js); times are Philippine time.
  // Each account sees only its own activity: the server sends only that (GET /api/logs), and "Clear Logs" hides it up to now, per account.
  const [cleared, setCleared] = useState(() => readClearedAt(user.id));
  const activityGroups = useMemo(() => {
    const mine = afterCleared(logs.filter(l => l.userId === user.id), cleared);
    return groupByDay(mine.map((l, i) => describeActivity(l, i, user.id)));
  }, [logs, user, cleared]);

  const statusData = useMemo(() => {
    const g = Math.max(1, Math.round(approved / Math.max(total, 1) * 100));
    return { total, approved, submitted, underReview, forRevision, g };
  }, [total, approved, submitted, underReview, forRevision]);

  const programs = useMemo(() => {
    const map = {};
    syllabi.forEach(s => {
      if (!s.program) return;
      if (!map[s.program]) map[s.program] = { total: 0, approved: 0 };
      map[s.program].total++;
      if (s.status === 'approved') map[s.program].approved++;
    });
    return Object.entries(map).map(([p, d]) => [p, d.total ? Math.round((d.approved / d.total) * 100) : 0]).sort((a, b) => b[1] - a[1]);
  }, [syllabi]);

  return (
    <>
      <PageHead title={<TypewriterText text={translateUI("ui.welcome_back_1c5b34")} />} subtitle={translateUI("ui.here_s_what_is_happening_with_your_undergraduate_syllabi_834d17")} actions={<><select><option value="AY 2026–2027">{translateUI("ui.ay_2026_2027_830f3e")}</option><option value="AY 2025–2026">{translateUI("ui.ay_2025_2026_8b00a8")}</option></select>{!isFac && <StableButton className="btn primary" onClick={() => setPage('builder')}>{translateUI("ui.new_syllabus_c4c7a9")}</StableButton>}</>} />
      <section className="stat-grid">{stats.map(([a, b, c, d]) => <div className="stat-card" key={a}><div className={`stat-icon ${d}`}><Icon weight="regular" name={STAT_ICONS[a]} size={20} /></div><span>{tr(a)}</span><strong>{b}</strong><small>{tr(c)}</small></div>)}</section>
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
        <Card title={translateUI("ui.submission_status_12db71")} action={tr("View report")}>
          <div className="donut-panel">
            <Donut value={statusData.g} centerTop={String(total)} centerBottom={tr("Total")} />
            <div className="legend"><Legend color="var(--green)" text={translateUI("ui.approved_41b81e")} value={String(approved)} /><Legend color="var(--blue)" text={translateUI("ui.submitted_2e0035")} value={String(submitted)} /><Legend color="var(--gold)" text={translateUI("ui.under_review_18afed")} value={String(underReview)} /><Legend color="var(--red)" text={translateUI("ui.for_revision_d7500c")} value={String(forRevision)} /></div>
          </div>
        </Card>
        <Card title={translateUI("ui.quick_actions_c40810")} hideScrollbar>
          <div className="quick-actions">
            <button onClick={() => setPage(isFac ? 'builder' : 'ai')}><b><Icon weight="regular" name="sparkle" size={20} /></b><span><StableLabel>{isFac ? translateUI("ui.check_a_syllabus_f9c218") : translateUI("ui.compliance_overview_f4109d")}</StableLabel><small><StableLabel>{isFac ? translateUI("ui.run_the_compliance_check_in_step_7_of_the_builder_d861f3") : translateUI("ui.read_the_stored_check_of_each_submitted_syllabus_921a70")}</StableLabel></small></span><Icon weight="regular" name="caretRight" size={16} /></button>
            {isFac ? <button onClick={() => setPage('my-syllabi')}><b><Icon weight="regular" name="notebook" size={20} /></b><span><StableLabel>{translateUI("ui.my_syllabi_3da1e8")}</StableLabel><small>{total}<StableLabel>{translateUI("ui.syllabi_in_your_account_732cf8")}</StableLabel></small></span><Icon weight="regular" name="caretRight" size={16} /></button> : <button onClick={() => setPage('review')}><b><Icon weight="regular" name="sealCheck" size={20} /></b><span><StableLabel>{translateUI("ui.review_pending_syllabi_bf50c2")}</StableLabel><small>{submitted + underReview}<StableLabel>{translateUI("ui.submissions_awaiting_review_31080a")}</StableLabel></small></span><Icon weight="regular" name="caretRight" size={16} /></button>}
            <button onClick={() => setPage('mapping')}><b><Icon weight="regular" name="gridFour" size={20} /></b><span><StableLabel>{translateUI("ui.curriculum_mapping_7eb16d")}</StableLabel><small><StableLabel>{translateUI("ui.inspect_co_po_coverage_matrix_d6700c")}</StableLabel></small></span><Icon weight="regular" name="caretRight" size={16} /></button>
          </div>
        </Card>
      </section>
      <section className="dashboard-grid lower">
        <Card title={translateUI("ui.program_compliance_943fac")} action={tr("View analytics")}>
          {programs.length > 0
            ? programs.map(([p, v]) => <Progress key={p} label={p} value={v} />)
            : <div className="empty">{translateUI("ui.no_program_data_yet_c5b890")}</div>
          }
        </Card>
        <Card title={translateUI("ui.ai_quality_snapshot_c296aa")}><QualityMini label={translateUI("ui.format_041a5d")} value={compliance || 0} /><QualityMini label={translateUI("ui.completeness_778184")} value={compliance || 0} /><QualityMini label={translateUI("ui.co_po_9c8106")} value={compliance || 0} /><QualityMini label={translateUI("ui.assessment_ef136f")} value={compliance || 0} /></Card>
        <Card title={translateUI("ui.upcoming_deadlines_b56518")} hideScrollbar><Deadline day="05" mon={tr("SEP")} title={translateUI("ui.department_syllabus_submission_e11d1e")} note={translateUI("ui.5_days_remaining_8ac5f5")} /><Deadline day="12" mon={tr("SEP")} title={translateUI("ui.program_chair_review_deadline_31a12f")} note={translateUI("ui.12_days_remaining_650a54")} /><Deadline day="18" mon={tr("SEP")} title={translateUI("ui.dean_approval_deadline_addb1a")} note={translateUI("ui.18_days_remaining_fdeccb")} /></Card>
      </section>
    </>
  );
}
