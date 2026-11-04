import StableButton from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useMemo, useState } from 'react';
import { PageHead, Card, Icon } from '../components/ui';
import { students, syllabi as syllabiApi } from '../lib/api';

// A student's own data from the COR and the subjects they are enrolled in, each with a way to its approved syllabus.
// A COR prints titles in capitals; read them as words ("Quantitative Methods (Including Modeling and Simulation)"), keeping the small joining words down.
const SMALL = new Set(['and', 'of', 'the', 'in', 'for', 'to', 'a', 'an', 'on']);
const titleCase = (t) => String(t || '').toLowerCase().replace(/[a-z0-9][a-z0-9'’]*/g, (w, i) => (i > 0 && SMALL.has(w) ? w : w[0].toUpperCase() + w.slice(1)));

export default function StudentDashboard({ user, setPage, setViewCode }) {
  const [data, setData] = useState(null);
  const [approved, setApproved] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    students.me().then(d => { if (live) setData(d); }).catch(e => { if (live) setError(e.message); });
    syllabiApi.repository().then(rows => { if (live) setApproved(rows); }).catch(() => {});
    return () => { live = false; };
  }, []);
  const p = data && data.profile;
  // A subject finds its approved syllabus through the catalog subject it is linked to; a subject the catalog does not have yet falls back to the code.
  const byCourse = useMemo(() => new Map(approved.filter(s => s.courseId).map(s => [s.courseId, s])), [approved]);
  const byCode = useMemo(() => new Map(approved.map(s => [String(s.courseCode || '').replace(/[^a-z0-9]/gi, '').toLowerCase(), s])), [approved]);
  const term = p ? [p.term, p.school_year && translateUI('student.ay', { year: p.school_year })].filter(Boolean).join(', ') : '';
  const stats = p ? [
    ['graduationCap', 'blue', translateUI('student.studentId'), p.student_id, p.program],
    ['program', 'green', translateUI('student.yearSection'), [p.year_level && translateUI('student.year', { n: p.year_level }), p.section].filter(Boolean).join(' · ') || '—', translateUI('student.fromCor')],
    ['notebook', 'gold', translateUI('student.term'), term || '—', translateUI('student.currentTerm')],
    ['subject', 'teal', translateUI('student.subjects'), String(data.subjects.length), translateUI('student.enrolled')],
  ] : [];
  return (
    <>
      <PageHead title={translateUI("ui.welcome_a2513b") + (user.firstName || '')} subtitle={translateUI('student.dashSubtitle')} />
      {error && <div className="info-banner warning" role="alert">{tr(error)}</div>}
      {!data && !error && <div className="empty">{translateUI("ui.loading_your_profile_f1468e")}</div>}
      {p && (
        <>
          <section className="stat-grid student-stats">{stats.map(([icon, tone, label, value, note]) => <div className="stat-card" key={label}><div className={`stat-icon ${tone}`}><Icon weight="regular" name={icon} size={20} /></div><span>{label}</span><strong>{value || '—'}</strong><small>{note}</small></div>)}</section>
          <Card title={translateUI("ui.enrolled_subjects_0ea329")}>
            {data.subjects.length === 0 && <div className="empty">{translateUI('student.noSubjects')}</div>}
            <ul className="stu-subjects">
              {data.subjects.map((s, i) => {
                const syl = (s.courseId && byCourse.get(s.courseId)) || byCode.get(String(s.code || s.subject_code || '').replace(/[^a-z0-9]/gi, '').toLowerCase());
                return <li key={i}>
                  <div className="stu-subject-main">
                    <strong>{s.code || s.subject_code}</strong>
                    <small>{s.title || titleCase(s.subject_title)}</small>
                    {s.section && <span className="stu-section">{String(s.section).split('/')[0]}</span>}
                    {(s.program || s.faculty) && <span className="stu-meta">{s.program && <span className="chip quiet">{s.program}</span>}{s.faculty && <span>{s.faculty}</span>}</span>}
                  </div>
                  {syl
                    ? <StableButton className="btn outline" onClick={() => setViewCode(syl.id)}>{translateUI('student.viewSyllabus')}</StableButton>
                    : <small className="muted">{translateUI('student.noSyllabus')}</small>}
                </li>;
              })}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
