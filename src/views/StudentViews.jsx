import StableButton from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useMemo, useRef, useState } from 'react';
import { students } from '../lib/api';
import { phShortDate } from '../lib/phTime';
import { Card, Field, PageHead } from '../components/ui';
import Select from '../components/Select';
import ReviewDocument from './ReviewDocument';

// The student's pages, inside the same shell as everyone else's. Students only read: nothing here changes a syllabus, and the server answers
// only for approved syllabi of the student's own subjects (routes/students.js).
const initialsOf = (name) => String(name || '?').split(/[\s,]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// The syllabus paper is a 640px-wide form. On a phone it is scaled down to fit the screen width (never below 55%, so text stays legible; below that it scrolls sideways).
function FitPaper({ children }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => setScale(Math.min(1, el.clientWidth / 660));
    fit();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <div ref={ref} className="student-fit-paper" style={{ overflowX: 'hidden', width: '100%' }}><div style={{ zoom: scale }}>{children}</div></div>;
}

function useStudentData() {
  const [data, setData] = useState(null);
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    students.me().then((d) => { if (live) setData(d); }).catch((e) => { if (live) setError(e.message); });
    students.syllabi().then((r) => { if (live) setList(r.syllabi || []); }).catch(() => { if (live) setList([]); });
    return () => { live = false; };
  }, []);
  // Each enrolled subject with its approved syllabus, when there is one.
  const rows = useMemo(() => {
    const byCourse = new Map((list || []).map((s) => [s.courseId, s]));
    const byCode = new Map((list || []).map((s) => [norm(s.courseCode), s]));
    return ((data && data.subjects) || []).map((s) => ({ code: s.subject_code, title: s.subject_title, section: s.section, syllabus: byCourse.get(s.course_id) || byCode.get(norm(s.subject_code)) || null }));
  }, [data, list]);
  return { data, list, rows, error };
}

// The student's verified profile and the subjects read from their COR.
export function StudentDashboard({ user, setPage }) {
  const { data, list, rows, error } = useStudentData();
  const p = data && data.profile;
  const available = rows.filter((r) => r.syllabus).length;
  return (
    <>
      <PageHead title={translateUI("ui.welcome_a2513b") + user.firstName} subtitle={translateUI('studentView.dashSubtitle')} />
      {error && <div className="info-banner warning" role="alert">{tr(error)}</div>}
      {!data && !error && <div className="empty">{translateUI("ui.loading_your_profile_f1468e")}</div>}
      {p && (
        <div className="student-grid">
          <Card title={translateUI('studentView.profile')}>
            <div className="student-id-head">
              <span className="student-initials" aria-hidden="true">{initialsOf(p.student_name || (user.firstName + ' ' + user.lastName))}</span>
              <div>
                <strong>{p.student_name || [user.firstName, user.lastName].filter(Boolean).join(' ')}</strong>
                <small>{p.student_id}</small>
              </div>
              {p.verification_status === 'verified' && <span className="status approved">{translateUI('studentView.verified')}</span>}
            </div>
            <dl className="student-facts">
              {[[translateUI('studentView.program'), p.program, true], [translateUI('studentView.yearLevel'), p.year_level], [translateUI('studentView.section'), p.section], [translateUI('studentView.term'), [p.term, p.school_year && 'AY ' + p.school_year].filter(Boolean).join(' · '), true]].map(([k, v, wide]) => (
                <div key={k} className={wide ? 'wide' : ''}><dt>{k}</dt><dd>{v || '—'}</dd></div>
              ))}
            </dl>
          </Card>
          <Card title={translateUI("ui.enrolled_subjects_0ea329")}>
            {rows.length === 0 && <p className="muted">{translateUI('studentView.noSubjects')}</p>}
            {rows.length > 0 && <>
              <p className="muted student-count">{translateUI('studentView.available', { available, total: rows.length })}</p>
              <ul className="student-subjects">{rows.map((r) => (
                <li key={r.code + r.title}>
                  <span className="student-code">{r.code}</span>
                  <span className="student-title">{r.title}</span>
                  {r.syllabus
                    ? <span className="status approved">{translateUI('studentView.hasSyllabus')}</span>
                    : <span className="status draft">{translateUI(list === null ? 'studentView.loading' : 'studentView.none')}</span>}
                </li>
              ))}</ul>
              {list !== null && <StableButton className="btn outline" type="button" onClick={() => setPage('student-syllabi')}>{translateUI('studentView.openSyllabi')}</StableButton>}
            </>}
          </Card>
        </div>
      )}
    </>
  );
}

// The approved syllabus of each enrolled subject, opened read-only.
export function StudentSyllabi() {
  const { list, error } = useStudentData();
  const [openId, setOpenId] = useState(null);
  const [doc, setDoc] = useState({ loading: false, error: '', value: null });
  const [q, setQ] = useState('');
  useEffect(() => {
    if (openId === null) return undefined;
    let live = true;
    setDoc({ loading: true, error: '', value: null });
    students.syllabus(openId)
      .then((value) => { if (live) setDoc({ loading: false, error: '', value }); })
      .catch((e) => { if (live) setDoc({ loading: false, error: e.message, value: null }); });
    return () => { live = false; };
  }, [openId]);

  const [program, setProgram] = useState('All');
  const [year, setYear] = useState('All');
  const years = useMemo(() => [...new Set((list || []).map((x) => x.academicYear).filter(Boolean))].sort().reverse(), [list]); // newest first; none until syllabi carry a year
  const programs = useMemo(() => [...new Set((list || []).map((x) => x.program).filter(Boolean))].sort(), [list]);
  // Every approved syllabus; the student's own subjects first.
  const shown = useMemo(() => (list || [])
    .filter((x) => (program === 'All' || x.program === program) && (year === 'All' || x.academicYear === year) && [x.courseCode, x.title, x.faculty].join(' ').toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => Number(b.enrolled) - Number(a.enrolled) || String(a.courseCode).localeCompare(String(b.courseCode))), [list, program, year, q]);
  const open = doc.value;
  const pdfUrl = open && open.file && open.file.path ? open.file.path : null;

  if (openId !== null) {
    return (
      <>
        <PageHead title={open ? open.syllabus.courseCode : translateUI('studentView.syllabus')} subtitle={open ? open.syllabus.title : ''} actions={<StableButton className="btn ghost" type="button" onClick={() => setOpenId(null)}>{translateUI('studentView.back')}</StableButton>} />
        {doc.loading && <div className="empty">{translateUI('studentView.loadingSyllabus')}</div>}
        {doc.error && <div className="info-banner warning" role="alert">{tr(doc.error)}</div>}
        {open && open.content && <FitPaper><ReviewDocument content={open.content} facultyName={open.syllabus.faculty} /></FitPaper>}
        {open && !open.content && pdfUrl && <iframe title={open.syllabus.courseCode} src={pdfUrl} style={{ width: '100%', height: '80vh', border: 0 }} />}
        {open && !open.content && !pdfUrl && <div className="empty">{translateUI('studentView.empty')}</div>}
      </>
    );
  }
  return (
    <>
      <PageHead title={translateUI('studentView.syllabiTitle')} subtitle={translateUI('studentView.syllabiSubtitle')} />
      <div className={'filter-card repository-filters' + (years.length > 0 ? ' student-filters-ay' : '')}>
        <Field label={translateUI("ui.program_9d6800")}><Select value={program} onChange={(e) => setProgram(e.target.value)}><option value="All">{translateUI("ui.all_6a7208")}</option>{programs.map((x) => <option key={x} value={x}>{x}</option>)}</Select></Field>
        {years.length > 0 && <Field label={translateUI('studentView.ay')}><Select value={year} onChange={(e) => setYear(e.target.value)}><option value="All">{translateUI('studentView.allYears')}</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}</Select></Field>}
        <label className="field"><span>{translateUI("ui.search_bce064")}</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={translateUI('studentView.searchHint')} /></label>
        <StableButton className="btn ghost reset" onClick={() => { setProgram('All'); setYear('All'); setQ(''); }}>{translateUI("ui.reset_44c57a")}</StableButton>
      </div>
      {error && <div className="info-banner warning" role="alert">{tr(error)}</div>}
      <div className="table-card repository-table student-table">
        <table>
          <thead><tr><th scope="col">{translateUI('studentView.subject')}</th><th scope="col">{translateUI("ui.program_9d6800")}</th>{years.length > 0 && <th scope="col" className="student-ay" title={translateUI('term.academicYear')}>{translateUI('studentView.ay')}</th>}<th scope="col">{translateUI('studentView.faculty')}</th><th scope="col">{translateUI('studentView.version')}</th><th scope="col">{translateUI("ui.updated_f2f857")}</th><th scope="col"><span className="sr-only">{translateUI('studentView.syllabus')}</span></th></tr></thead>
          <tbody>{shown.map((s) => (
            <tr key={s.id}>
              <td><strong>{s.courseCode}</strong><small>{s.title}</small>{s.enrolled && <span className="status approved student-mine">{translateUI('studentView.mine')}</span>}</td>
              <td>{s.program || '—'}</td>
              {years.length > 0 && <td className="student-ay">{s.academicYear || '—'}</td>}
              <td>{s.faculty}</td>
              <td>{s.version}</td>
              <td>{phShortDate(s.updatedAt)}</td>
              <td><StableButton className="btn outline student-view-btn" type="button" onClick={() => setOpenId(s.id)}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg><span>{translateUI('studentView.view')}</span></StableButton></td>
            </tr>
          ))}</tbody>
        </table>
        {shown.length === 0 && <div className="empty">{list === null ? translateUI('studentView.loading') : translateUI('studentView.noSyllabi')}</div>}
      </div>
    </>
  );
}
