import { YearFilter, useYearScope } from '../components/AcademicYearScope';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useMemo, useState } from 'react';
import { Avatar, PageHead } from '../components/ui';
import { courses as coursesApi, users as usersApi } from '../lib/api';
import { facultyCompliance } from '../lib/facultyCompliance';

const STATUS_NOTE = { for_revision: 'For Revision', rejected: 'Rejected' };

// The administrator's Compliance tab: one card per faculty member, measured against the subjects the administrator ASSIGNED to them for the academic year
// on screen (lib/facultyCompliance.js), so it can be used as evidence. `data` ({ faculty, holders, subjects }) can be given (tests); otherwise it is read:
// the faculty accounts, who holds each subject, and the year's subjects. The syllabus list comes from the app (a draft is not in it: not submitted).
export default function Compliance({ syllabi = [], data }) {
  const yearScope = useYearScope(), year = yearScope ? yearScope.param('data') : undefined;
  const [loaded, setLoaded] = useState(data ? { ...data, loading: false, error: '' } : { faculty: [], holders: [], subjects: [], loading: true, error: '' });
  useEffect(() => {
    if (data) return undefined;
    let live = true;
    setLoaded((x) => ({ ...x, loading: true, error: '' }));
    const catalogYear = year === 'all' ? undefined : year; // the catalog of the year on screen
    Promise.all([usersApi.list(), usersApi.subjectHolders(), coursesApi.list(undefined, undefined, catalogYear)])
      .then(([users, held, subjects]) => {
        if (!live) return;
        const holders = (held && held.holders) || [];
        // faculty, and an administrator who has been assigned subjects (they write syllabi too, and their assigned subjects are evidence as well)
        const holding = new Set(holders.map((h) => Number(h.userId)));
        const faculty = (Array.isArray(users) ? users : []).filter((u) => !u.disabled && (u.role === 'faculty' || (u.role === 'admin' && holding.has(Number(u.id)))));
        setLoaded({ faculty, holders, subjects: Array.isArray(subjects) ? subjects : [], loading: false, error: '' });
      })
      .catch((e) => { if (live) setLoaded((x) => ({ ...x, loading: false, error: e.message || '' })); });
    return () => { live = false; };
  }, [data, year]);

  const cards = useMemo(() => facultyCompliance({ faculty: loaded.faculty, holders: loaded.holders, subjects: loaded.subjects, syllabi }), [loaded, syllabi]);
  const missingText = (m) => m.code + (m.status ? ' (' + tr(STATUS_NOTE[m.status] || m.status) + ')' : '');

  return (
    <>
      <PageHead title={translateUI("ui.faculty_compliance_monitoring_7b4446")} subtitle={translateUI('facultyCompliance.subtitle')} actions={<YearFilter group="data" />} />
      {loaded.error && <div className="info-banner warning" role="alert">{translateUI('facultyCompliance.unreadable') + tr(loaded.error)}</div>}
      {!loaded.error && loaded.loading && <div className="empty">{translateUI('facultyCompliance.loading')}</div>}
      {!loaded.error && !loaded.loading && cards.length === 0 && <div className="empty">{translateUI('facultyCompliance.noFaculty')}</div>}
      <div className="comp-grid">
        {cards.map(f => <div className="comp-card" key={f.key} data-testid="comp-card">
          <div className="comp-head">
            <Avatar className="comp-av" userId={f.userId} src={f.avatarUrl} name={f.name} />
            <div><h4>{f.name}</h4><small>{(f.programs.length ? f.programs.join(', ') + ' · ' : '') + f.approved + translateUI("ui.approved_4f3fcf") + (f.submitted - f.approved) + translateUI("ui.under_review_bfad2e")}</small></div>
            <span className={`comp-badge ${f.compliant ? 'ok' : 'warn'}`}>{f.total === 0 ? translateUI('facultyCompliance.noneAssigned') : f.compliant ? translateUI("ui.compliant_c584a3") : translateUI("ui.non_compliant_6d126a")}</span>
          </div>
          <div className="progress-row"><div><span>{f.total ? translateUI('facultyCompliance.submitted', { submitted: f.submitted, total: f.total }) : translateUI('facultyCompliance.assignFirst')}</span><b>{f.pct}%</b></div><div className="bar"><i style={{ width: `${f.pct}%` }} /></div></div>
          {f.missing.length > 0 && <div className="comp-warn">{translateUI('facultyCompliance.missing') + f.missing.map(missingText).join(', ')}</div>}
        </div>)}
      </div>
    </>
  );
}
