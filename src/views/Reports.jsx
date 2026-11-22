import { YearFilter, useYearScope } from '../components/AcademicYearScope';
import { selectionLabel } from '../lib/academicYearScope';
import StableButton from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { Fragment, useEffect, useMemo, useState } from 'react';
import { PageHead, Icon, Avatar } from '../components/ui';
import Select from '../components/Select';
import { compliance as complianceApi, syllabi as syllabiApi } from '../lib/api';
import { aiAverage } from '../lib/complianceStats';
import { downloadSyllabusDocx } from '../lib/syllabusDocx';
import { buildAllFacultySyllabiCsv, buildFacultySyllabiCsv, downloadCsv } from '../lib/reportCsv';
import { fmt } from '../lib/utils';

const STATUS_LABELS = { draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review', for_revision: 'For Revision', approved: 'Approved', rejected: 'Rejected' };

function countFindings(run) {
  if (!run) return null;
  const rules = Array.isArray(run.findings) ? run.findings.length : 0;
  const deductions = Array.isArray(run.hybrid?.deductions) ? run.hybrid.deductions.length : 0;
  const suggestions = Array.isArray(run.hybrid?.suggestions) ? run.hybrid.suggestions.length : 0;
  const recs = Array.isArray(run.recommendations) ? run.recommendations.length : 0;
  return rules + Math.max(deductions, suggestions, recs);
}

function summarizeFindings(run) {
  if (!run) return '';
  const parts = [
    ...(run.findings || []).map((f) => tr(f.message)),
    ...(run.hybrid?.deductions || []).map((d) => `${d.ruleId || d.area || 'AI'}: ${tr(d.reason || d.message || d.summary || '')}`),
    ...(!(run.hybrid?.deductions || []).length ? (run.recommendations || []).map((r) => `${tr(r.title)}: ${tr(r.text)}`) : []),
  ].filter(Boolean);
  return parts.length ? parts.join(' ; ') : tr('No findings');
}

function FacultyReports({ mySyllabi, year, yearName, user, notify }) {
  const [checks, setChecks] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);
  const [details, setDetails] = useState({}); // id -> { loading, error, run }
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    let live = true;
    complianceApi.list('all', year).then(res => {
      if (live) setChecks(res && res.installed !== false ? res : null);
    }, () => { if (live) setChecks(null); });
    return () => { live = false; };
  }, [year, mySyllabi]);

  const checkById = useMemo(() => {
    const map = new Map();
    for (const row of checks?.syllabi || []) map.set(Number(row.syllabusId), row.run || null);
    return map;
  }, [checks]);

  const totalApproved = mySyllabi.filter(s => s.status === 'approved').length;
  const totalPending = mySyllabi.filter(s => s.status === 'submitted' || s.status === 'under_review').length;
  const avgScore = useMemo(() => aiAverage(checks?.syllabi || null), [checks]);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return mySyllabi.filter(s => {
      if (statusFilter === 'approved' && s.status !== 'approved') return false;
      if (statusFilter === 'pending' && s.status !== 'submitted' && s.status !== 'under_review') return false;
      if (statusFilter === 'revision' && s.status !== 'for_revision' && s.status !== 'rejected') return false;
      if (statusFilter === 'draft' && s.status !== 'draft') return false;
      if (query && !`${s.courseCode || ''} ${s.title || ''} ${s.programCode || s.program || ''}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [mySyllabi, statusFilter, q]);

  const toggleFindings = async (id) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (details[id]?.run || details[id]?.loading) return;
    setDetails(prev => ({ ...prev, [id]: { loading: true, error: '', run: null } }));
    try {
      const res = await complianceApi.get(id);
      setDetails(prev => ({ ...prev, [id]: { loading: false, error: '', run: res?.run || null } }));
    } catch (e) {
      setDetails(prev => ({ ...prev, [id]: { loading: false, error: e.message || 'Could not load findings.', run: null } }));
    }
  };

  const handleDownloadDocx = async (s) => {
    if (s.status !== 'approved' || downloadingId !== null) return;
    setDownloadingId(s.id);
    try {
      const [res, signoffs] = await Promise.all([
        syllabiApi.getContent(s.id),
        syllabiApi.stages(s.id).catch(() => null),
      ]);
      if (!res?.content) {
        notify?.(tr('This approved syllabus has no structured form content to export as DOCX.'));
        return;
      }
      await downloadSyllabusDocx(res.content, {
        courseCode: s.courseCode,
        title: s.title,
        program: s.programCode || s.program,
        academicYear: res.academicYear || s.academicYear,
        version: res.version || s.version,
        faculty: s.faculty || user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        signoffs,
      });
      notify?.(tr(`Downloaded ${s.courseCode || 'syllabus'}.docx`));
    } catch (e) {
      notify?.(tr(e.message || 'Could not export DOCX.'));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleExportCsv = () => {
    const csv = buildFacultySyllabiCsv(rows.map((s) => {
      const run = details[s.id]?.run || checkById.get(Number(s.id)) || null;
      const score = run && Number.isFinite(run.overall) ? run.overall : null;
      const passLine = run?.passThreshold ?? 79;
      return {
        courseCode: s.courseCode || '',
        title: s.title || '',
        program: s.programCode || s.program || '',
        academicYear: s.academicYear || yearName || '',
        version: s.version || '',
        statusLabel: tr(STATUS_LABELS[s.status] || s.status),
        score,
        standing: score === null ? tr('Not checked') : score >= passLine ? tr('Meets standard') : tr('Below pass line'),
        findingsCount: countFindings(run),
        findingsSummary: summarizeFindings(run),
        updatedAt: s.updatedAt ? fmt(s.updatedAt) : '',
      };
    }), { academicYear: yearName });
    downloadCsv(csv, 'my-syllabi-report.csv');
    notify?.(tr('CSV report downloaded.'));
  };

  return (
    <>
      <PageHead
        title={translateUI("ui.reports_88bc3f")}
        subtitle={tr("Track your syllabus status, AI compliance scores, findings, and approved DOCX exports.")}
        actions={<><YearFilter group="data" /><StableButton type="button" className="btn outline" disabled={rows.length === 0} onClick={handleExportCsv}><Icon name="downloadSimple" size={15} />{tr('Export CSV')}</StableButton></>}
      />

      <section className="card fr-kpis" aria-label={tr("Summary metrics")}>
        <div className="fr-kpi"><strong>{mySyllabi.length}</strong><span>{translateUI("ui.total_syllabi_6ef623")}</span></div>
        <div className="fr-kpi"><strong>{totalApproved}</strong><span>{translateUI("ui.approved_41b81e")}</span></div>
        <div className="fr-kpi"><strong>{totalPending}</strong><span>{translateUI("ui.under_review_18afed")}</span></div>
        <div className="fr-kpi"><strong>{Number.isFinite(avgScore) ? `${avgScore}%` : '—'}</strong><span>{translateUI('analytics.averageLabel')}</span></div>
      </section>

      <section className="card fr-card">
        <div className="fr-toolbar">
          <h3>{tr("My Syllabi Report")}</h3>
          <div className="fr-controls">
            <Select aria-label={tr("Filter by status")} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">{tr("All statuses")}</option>
              <option value="approved">{tr("Approved")}</option>
              <option value="pending">{tr("Pending Review")}</option>
              <option value="revision">{tr("For Revision / Rejected")}</option>
              <option value="draft">{tr("Draft")}</option>
            </Select>
            <div className="fr-search">
              <Icon name="magnifyingGlass" size={15} />
              <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={tr("Search course code or title…")} aria-label={tr("Search syllabi")} />
            </div>
          </div>
        </div>

        <div className="fr-table-wrap">
          <table className="fr-table">
            <thead>
              <tr>
                <th scope="col">{translateUI("ui.course_d82b56")}</th>
                <th scope="col">{translateUI("ui.status_bae7d5")}</th>
                <th scope="col">{tr("AI Score")}</th>
                <th scope="col">{tr("Findings")}</th>
                <th scope="col" className="fr-col-export">{tr("Export")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(s => {
                const run = checkById.get(Number(s.id)) || null;
                const score = run && Number.isFinite(run.overall) ? run.overall : null;
                const passLine = run?.passThreshold ?? 79;
                const scoreTone = score === null ? 'none' : score >= passLine ? 'good' : 'warn';
                const totalFindings = countFindings(run);
                const isOpen = openId === s.id;
                const det = details[s.id];
                const fullRun = det?.run || run;
                const ruleFindings = fullRun?.findings || [];
                const aiDeductions = fullRun?.hybrid?.deductions || [];
                const recs = fullRun?.recommendations || [];
                const isApproved = s.status === 'approved';
                return (
                  <Fragment key={s.id}>
                    <tr className={isOpen ? 'is-expanded' : undefined}>
                      <td className="fr-course">
                        <strong>{s.courseCode || '—'}</strong>
                        <small>{s.title || '—'}</small>
                        <span className="fr-submeta">{[s.programCode || s.program, s.version].filter(Boolean).join(' · ')}</span>
                      </td>
                      <td>
                        <span className={`status ${s.status}`}>{tr(STATUS_LABELS[s.status] || s.status)}</span>
                      </td>
                      <td>
                        <div className={`fr-score tone-${scoreTone}`}>
                          <b>{score !== null ? `${score}%` : '—'}</b>
                          <small>{score === null ? tr('Not checked') : score >= passLine ? tr('Meets standard') : tr('Below pass line')}</small>
                        </div>
                      </td>
                      <td>
                        {run ? (
                          <button type="button" className="fr-findings-btn" aria-expanded={isOpen} onClick={() => toggleFindings(s.id)}>
                            <span>{totalFindings === 0 ? tr('0 issues') : tr(`${totalFindings} ${totalFindings === 1 ? 'finding' : 'findings'}`)}</span>
                            <Icon name="caretRight" size={14} className={isOpen ? 'is-open' : undefined} />
                          </button>
                        ) : (
                          <span className="fr-muted">{tr('Not checked')}</span>
                        )}
                      </td>
                      <td className="fr-col-export">
                        {isApproved ? (
                          <StableButton type="button" className="btn outline fr-docx-btn" disabled={downloadingId === s.id} onClick={() => handleDownloadDocx(s)}>
                            <Icon name="downloadSimple" size={14} />
                            <span>{downloadingId === s.id ? tr('Exporting…') : tr('DOCX')}</span>
                          </StableButton>
                        ) : (
                          <span className="fr-muted" title={tr('Available once approved')}>—</span>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="fr-detail-row">
                        <td colSpan={5}>
                          <div className="fr-detail">
                            {det?.loading && <p className="muted">{tr('Loading findings…')}</p>}
                            {det?.error && <p className="form-error" role="alert">{tr(det.error)}</p>}
                            {!det?.loading && !det?.error && (
                              <>
                                {ruleFindings.length === 0 && aiDeductions.length === 0 && recs.length === 0 ? (
                                  <p className="fr-detail-clean">{tr('No findings — every check passed.')}</p>
                                ) : (
                                  <div className="fr-detail-grid">
                                    {ruleFindings.length > 0 && (
                                      <div className="fr-detail-sec">
                                        <h4>{tr('Format & Rule Findings')} ({ruleFindings.length})</h4>
                                        <ul>{ruleFindings.map((f, idx) => <li key={f.id || idx}>{tr(f.message)}</li>)}</ul>
                                      </div>
                                    )}
                                    {aiDeductions.length > 0 && (
                                      <div className="fr-detail-sec">
                                        <h4>{tr('AI Alignment Findings')} ({aiDeductions.length})</h4>
                                        <ul>{aiDeductions.map((dItem, idx) => <li key={dItem.id || idx}><strong>{dItem.ruleId || dItem.area}:</strong> {tr(dItem.reason || dItem.message || dItem.summary)}</li>)}</ul>
                                      </div>
                                    )}
                                    {aiDeductions.length === 0 && recs.length > 0 && (
                                      <div className="fr-detail-sec">
                                        <h4>{tr('Recommendations')} ({recs.length})</h4>
                                        <ul>{recs.map((r, idx) => <li key={idx}><strong>{tr(r.title)}:</strong> {tr(r.text)}</li>)}</ul>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="empty">{mySyllabi.length === 0 ? translateUI("ui.no_syllabi_yet_click_new_syllabus_to_get_started_2e4bc9") : translateUI("ui.no_syllabi_match_your_filters_e09598")}</div>
          )}
        </div>
      </section>
    </>
  );
}

function AdminReports({ syllabi, year, yearName, user, notify }) {
  const [checks, setChecks] = useState(null);
  const [scope, setScope] = useState('all'); // 'all' | 'mine' | 'compliant' | 'attention'
  const [q, setQ] = useState('');
  const [expandedKey, setExpandedKey] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    let live = true;
    complianceApi.list('all', year).then((res) => {
      if (live) setChecks(res && res.installed !== false ? res : null);
    }, () => { if (live) setChecks(null); });
    return () => { live = false; };
  }, [year, syllabi]);

  const checkById = useMemo(() => {
    const map = new Map();
    for (const row of checks?.syllabi || []) map.set(Number(row.syllabusId), row.run || null);
    return map;
  }, [checks]);

  const facultyGroups = useMemo(() => {
    const map = {};
    syllabi.forEach((s) => {
      const key = s.userId != null ? `u:${s.userId}` : `n:${s.faculty || ''}`;
      if (!map[key]) {
        map[key] = {
          key,
          userId: s.userId,
          avatarUrl: s.ownerAvatarUrl,
          name: s.faculty || tr('Unknown faculty'),
          isMe: s.userId != null && Number(s.userId) === Number(user.id),
          total: 0,
          approved: 0,
          pending: 0,
          items: [],
        };
      }
      map[key].total++;
      if (s.status === 'approved') map[key].approved++;
      if (s.status === 'submitted' || s.status === 'under_review') map[key].pending++;
      map[key].items.push(s);
    });
    return Object.values(map)
      .map((f) => {
        const scores = f.items
          .map((s) => checkById.get(Number(s.id))?.overall)
          .filter((v) => Number.isFinite(v));
        const avgAi = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
        return { ...f, rate: f.total ? Math.round((f.approved / f.total) * 100) : 0, avgAi };
      })
      .sort((a, b) => Number(b.isMe) - Number(a.isMe) || a.name.localeCompare(b.name));
  }, [syllabi, user.id, checkById]);

  const hasOwnSyllabi = facultyGroups.some((f) => f.isMe);
  const visibleGroups = useMemo(() => {
    const query = q.trim().toLowerCase();
    return facultyGroups.filter((f) => {
      if (scope === 'mine' && !f.isMe) return false;
      if (scope === 'compliant' && f.rate < 100) return false;
      if (scope === 'attention' && f.rate >= 100) return false;
      if (query) {
        const matchName = f.name.toLowerCase().includes(query);
        const matchCourse = f.items.some((s) => `${s.courseCode || ''} ${s.title || ''} ${s.programCode || s.program || ''}`.toLowerCase().includes(query));
        if (!matchName && !matchCourse) return false;
      }
      return true;
    });
  }, [facultyGroups, scope, q]);

  const totalApproved = syllabi.filter((s) => s.status === 'approved').length;
  const totalPending = syllabi.filter((s) => s.status === 'submitted' || s.status === 'under_review').length;
  const complianceRate = syllabi.length ? Math.round((totalApproved / syllabi.length) * 100) : 0;

  const toCsvRow = (s) => {
    const run = checkById.get(Number(s.id)) || null;
    const score = run && Number.isFinite(run.overall) ? run.overall : null;
    const passLine = run?.passThreshold ?? 79;
    return {
      faculty: s.faculty || '',
      courseCode: s.courseCode || '',
      title: s.title || '',
      program: s.programCode || s.program || '',
      academicYear: s.academicYear || yearName || '',
      version: s.version || '',
      statusLabel: tr(STATUS_LABELS[s.status] || s.status),
      score,
      standing: score === null ? tr('Not checked') : score >= passLine ? tr('Meets standard') : tr('Below pass line'),
      findingsCount: countFindings(run),
      findingsSummary: summarizeFindings(run),
      updatedAt: s.updatedAt ? fmt(s.updatedAt) : '',
    };
  };

  const exportAllCsv = () => {
    const items = visibleGroups.flatMap((f) => f.items.map(toCsvRow));
    const csv = buildAllFacultySyllabiCsv(items, { academicYear: yearName });
    downloadCsv(csv, 'all-faculty-reports.csv');
    notify?.(tr('All faculty CSV report downloaded.'));
  };

  const exportFacultyCsv = (f) => {
    const csv = buildFacultySyllabiCsv(f.items.map(toCsvRow), { academicYear: yearName });
    const slug = String(f.name || 'faculty').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'faculty';
    downloadCsv(csv, `${slug}-report.csv`);
    notify?.(tr(`Downloaded ${f.name} CSV report.`));
  };

  const exportSummaryTxt = () => {
    let txt = `${tr('FACULTY COMPLIANCE REPORT')}\n${yearName ? 'AY ' + yearName : ''}\n${tr('Generated')}: ${fmt(new Date())}\n\n`;
    txt += `${tr('Total Syllabi')}: ${syllabi.length}\n${tr('Approved')}: ${totalApproved}\n${tr('Compliance Rate')}: ${complianceRate}%\n\n`;
    txt += `${tr('FACULTY BREAKDOWN')}\n`;
    facultyGroups.forEach((f) => { txt += `${f.name}: ${tr(`${f.total} total, ${f.approved} approved, ${f.rate}% compliance`)}\n`; });
    const blob = new Blob([txt], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'faculty-compliance-report.txt'; a.click(); URL.revokeObjectURL(a.href);
    notify?.(translateUI("ui.report_downloaded_c0e45e"));
  };

  const handleDownloadDocx = async (s) => {
    if (s.status !== 'approved' || downloadingId !== null) return;
    setDownloadingId(s.id);
    try {
      const [res, signoffs] = await Promise.all([
        syllabiApi.getContent(s.id),
        syllabiApi.stages(s.id).catch(() => null),
      ]);
      if (!res?.content) {
        notify?.(tr('This approved syllabus has no structured form content to export as DOCX.'));
        return;
      }
      await downloadSyllabusDocx(res.content, {
        courseCode: s.courseCode,
        title: s.title,
        program: s.programCode || s.program,
        academicYear: res.academicYear || s.academicYear,
        version: res.version || s.version,
        faculty: s.faculty || '',
        signoffs,
      });
      notify?.(tr(`Downloaded ${s.courseCode || 'syllabus'}.docx`));
    } catch (e) {
      notify?.(tr(e.message || 'Could not export DOCX.'));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <>
      <PageHead
        title={translateUI("ui.reports_88bc3f")}
        subtitle={translateUI("ui.generate_compliance_accreditation_and_historical_reports_for_inst_673ed4")}
        actions={
          <>
            <YearFilter group="data" />
            <StableButton type="button" className="btn outline" disabled={facultyGroups.length === 0} onClick={exportSummaryTxt}>
              <Icon name="filePlus" size={15} />
              <span>{tr('Summary TXT')}</span>
            </StableButton>
            <StableButton type="button" className="btn primary" disabled={visibleGroups.length === 0} onClick={exportAllCsv}>
              <Icon name="downloadSimple" size={15} />
              <span>{tr('Export All CSV')}</span>
            </StableButton>
          </>
        }
      />

      <section className="card fr-kpis" aria-label={translateUI("ui.accreditation_audit_summary_aa0020")}>
        <div className="fr-kpi"><strong>{syllabi.length}</strong><span>{translateUI("ui.total_syllabi_6ef623")}</span></div>
        <div className="fr-kpi"><strong>{totalApproved}</strong><span>{translateUI("ui.approved_41b81e")}</span></div>
        <div className="fr-kpi"><strong>{totalPending}</strong><span>{translateUI("ui.under_review_18afed")}</span></div>
        <div className="fr-kpi"><strong>{complianceRate}%</strong><span>{translateUI("ui.compliance_68f0ae")}</span></div>
      </section>

      <div className="ar-bar">
        <div className="ar-bar-left">
          <h3>{translateUI("ui.faculty_compliance_report_91eba7")}</h3>
          <span className="ar-count">{visibleGroups.length} {visibleGroups.length === 1 ? tr('faculty') : tr('faculty')}</span>
        </div>
        <div className="fr-controls">
          <Select aria-label={tr("Filter faculty reports")} value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="all">{tr("All faculty")}</option>
            {hasOwnSyllabi && <option value="mine">{tr("My own report")}</option>}
            <option value="compliant">{tr("100% compliant")}</option>
            <option value="attention">{tr("Needs attention")}</option>
          </Select>
          <div className="fr-search">
            <Icon name="magnifyingGlass" size={15} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search faculty or course…")} aria-label={tr("Search faculty reports")} />
          </div>
        </div>
      </div>

      <section className="ar-grid" aria-label={tr("Faculty reports grid")}>
        {visibleGroups.map((f) => {
          const isOpen = expandedKey === f.key;
          return (
            <article className={'card ar-card' + (isOpen ? ' is-open' : '')} key={f.key}>
              <div className="ar-card-head">
                <div className="ar-person">
                  <Avatar userId={f.userId} src={f.avatarUrl} name={f.name} />
                  <div className="ar-person-meta">
                    <h4>{f.name}{f.isMe && <span className="ar-you">{tr('You')}</span>}</h4>
                    <small>{f.avgAi !== null ? `${tr('Avg AI')} ${f.avgAi}%` : tr('No AI scores yet')}</small>
                  </div>
                </div>
                <div className="ar-card-actions">
                  <span className={f.rate >= 100 ? 'badge green' : 'badge gold'}>{f.rate}%</span>
                  <StableButton type="button" className="btn outline ar-csv-btn" onClick={() => exportFacultyCsv(f)} title={tr(`Download ${f.name} CSV report`)}>
                    <Icon name="downloadSimple" size={13} />
                    <span>{tr('CSV')}</span>
                  </StableButton>
                </div>
              </div>

              <div className="ar-metrics">
                <div><b>{f.total}</b><small>{tr('Total')}</small></div>
                <div><b>{f.approved}</b><small>{tr('Approved')}</small></div>
                <div><b>{f.pending}</b><small>{tr('Pending')}</small></div>
              </div>

              <div className="ar-bar-track" aria-hidden="true"><i style={{ width: `${f.rate}%` }} /></div>

              <button type="button" className="ar-toggle" aria-expanded={isOpen} onClick={() => setExpandedKey(isOpen ? null : f.key)}>
                <span>{isOpen ? tr('Hide syllabi') : tr(`View ${f.total} ${f.total === 1 ? 'syllabus' : 'syllabi'}`)}</span>
                <Icon name="caretRight" size={14} className={isOpen ? 'is-open' : undefined} />
              </button>

              {isOpen && (
                <ul className="ar-syl-list">
                  {f.items.map((s) => {
                    const run = checkById.get(Number(s.id)) || null;
                    const score = run && Number.isFinite(run.overall) ? `${run.overall}%` : '—';
                    const fCount = countFindings(run);
                    return (
                      <li key={s.id} className="ar-syl-row">
                        <div className="ar-syl-main">
                          <strong>{s.courseCode || '—'}</strong>
                          <small>{s.title || '—'}</small>
                        </div>
                        <div className="ar-syl-meta">
                          <span className={`status ${s.status}`}>{tr(STATUS_LABELS[s.status] || s.status)}</span>
                          <span className="ar-syl-score" title={tr('AI Score')}>{score}</span>
                          {fCount !== null && <span className="ar-syl-find">{fCount === 0 ? tr('0 issues') : `${fCount} ${fCount === 1 ? tr('finding') : tr('findings')}`}</span>}
                          {s.status === 'approved' && (
                            <button type="button" className="ar-mini-docx" disabled={downloadingId === s.id} onClick={() => handleDownloadDocx(s)} title={tr('Download DOCX')}>
                              <Icon name="downloadSimple" size={13} />
                              <span>{tr('DOCX')}</span>
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          );
        })}
        {visibleGroups.length === 0 && (
          <div className="card ar-empty">
            <div className="empty">{syllabi.length === 0 ? translateUI("ui.no_syllabi_yet_click_new_syllabus_to_get_started_2e4bc9") : translateUI("ui.no_syllabi_match_your_filters_e09598")}</div>
          </div>
        )}
      </section>
    </>
  );
}

export default function Reports({ syllabi, user, notify }) {
  const yearScope = useYearScope();
  const year = yearScope ? yearScope.param('data') : undefined;
  // the report says which academic year it covers (the one selected on this screen), not a fixed year
  const yearName = yearScope ? selectionLabel(yearScope.selection('data'), yearScope.years, (key) => translateUI(key)) : '';
  const mySyllabi = useMemo(() => user.role === 'faculty' ? syllabi.filter(s => s.userId === user.id) : syllabi, [syllabi, user]);

  if (user.role === 'faculty') {
    return <FacultyReports mySyllabi={mySyllabi} year={year} yearName={yearName} user={user} notify={notify} />;
  }

  return <AdminReports syllabi={syllabi} year={year} yearName={yearName} user={user} notify={notify} />;
}
