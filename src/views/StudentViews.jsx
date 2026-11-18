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


// A typed syllabus has no uploaded file: draw the paper on screen into a landscape Letter PDF (the libraries load only when a student asks for it).
async function savePaperPdf(courseCode) {
  const el = document.querySelector('.svm-paper');
  if (!el) return;
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  // The paper may be wider than the screen (it is clipped and scaled to fit): capture it at its full size, unclipped and unscaled.
  const capture = async (W) => {
  const atoms = [], lines = []; // [top, bottom] of every table row and every block of text, in capture pixels: a page may not end inside one
  const canvas = await html2canvas(el, {
    scale: 2, backgroundColor: '#ffffff', width: W, windowWidth: 1400, scrollX: 0, scrollY: 0,
    onclone: (doc) => {
      const box = doc.querySelector('.student-fit-paper');
      if (box) { box.style.overflow = 'visible'; box.style.width = W + 'px'; const f = box.firstElementChild; if (f) f.style.zoom = '1'; }
      const p = doc.querySelector('.svm-paper');
      if (p) { p.style.width = W + 'px'; p.style.maxWidth = 'none'; p.style.margin = '0'; p.style.overflow = 'visible'; var sheet = p.querySelector('.paper'); if (sheet) { sheet.style.width = '100%'; sheet.style.maxWidth = 'none'; sheet.style.margin = '0'; }
        // no frame around the page: the university's form has none
        [p, sheet, box].forEach((n) => { if (n) { n.style.border = '0'; n.style.boxShadow = 'none'; n.style.borderRadius = '0'; n.style.background = '#ffffff'; } });
      }
      if (p) {
        const top = p.getBoundingClientRect().top;
        p.querySelectorAll('tr, h1, h2, h3, h4, h5, h6, p, li, div, span, td, th').forEach((n) => {
          const isRow = n.tagName === 'TR' && !n.querySelector('tr');
          const isText = n.tagName !== 'TR' && !n.firstElementChild && n.textContent.trim() !== '';
          if (!isRow && !isText) return;
          const r = n.getBoundingClientRect();
          if (r.height > 0) atoms.push([(r.top - top) * 2, (r.bottom - top) * 2, isRow]);
        });
        // every printed line of text (one box per line), for rows too tall for one page
        const walker = doc.createTreeWalker(p, 4);
        for (let t = walker.nextNode(); t; t = walker.nextNode()) {
          if (!t.nodeValue.trim()) continue;
          const range = doc.createRange(); range.selectNodeContents(t);
          Array.from(range.getClientRects()).forEach((r) => { if (r.height > 0) lines.push([(r.top - top) * 2, (r.bottom - top) * 2]); });
        }
      }
    },
  });
  return { canvas, atoms, lines };
  };
  // Page: landscape Letter 792 x 612pt, margins 90pt left/right and 24pt top/bottom. A wider capture means smaller type, so a row that is a little too tall
  // for one page is retried at a wider capture (up to 860px) until every row fits; a row that still does not fit is split between lines.
  const PAGE_W = 792, PAGE_H = 612, MX = 90, MY = 24;
  let shot = null;
  for (const W of [680, 720, 760, 810, 860]) {
    shot = await capture(W);
    const fit = Math.floor(((PAGE_H - MY * 2) * shot.canvas.width) / (PAGE_W - MX * 2));
    if (!shot.atoms.some(([t, b, row]) => row && b - t > fit)) break;
  }
  const { canvas, atoms, lines } = shot;
  const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' }); // landscape Letter (11 x 8.5 in), like the university's own syllabus form
  const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), mx = MX, my = MY;
  const sliceH = Math.floor(((ph - my * 2) * canvas.width) / (pw - mx * 2)); // canvas pixels that fit one page
  let y = 0;
  for (let first = true; y < canvas.height - 1; first = false) {
    let end = Math.min(y + sliceH, canvas.height);
    if (end < canvas.height) {
      const inside = (list, c) => list.some(([t, b]) => t + 1 < c && c < b - 1);
      const floor = y + sliceH * 0.05;
      const edges = atoms.flatMap(([t, b]) => [t, b]).filter((c) => c > floor && c <= end).sort((a, b) => b - a);
      const clean = edges.find((c) => !inside(atoms, c)); // between whole rows and blocks of text
      const tooTall = atoms.some(([t, b, row]) => row && t < end && end < b && b - t > sliceH); // a row that cannot fit even on an empty page
      if (clean && !tooTall) end = Math.round(clean); // a row that fits moves whole to the next page, however much room is left
      else {
        // a row taller than the page: the place near the page end that crosses the fewest printed lines (none, when the columns' lines leave a gap together)
        let best = null;
        for (let c = end; c > y + sliceH * 0.5; c -= 2) {
          const n = lines.reduce((k, [t, b]) => k + (t + 1 < c && c < b - 1 ? 1 : 0), 0);
          if (!best || n < best.n) best = { c, n };
          if (n === 0) break;
        }
        end = best && best.n === 0 ? best.c : clean ? Math.round(clean) : best ? best.c : end;
      }
    }
    const part = document.createElement('canvas');
    part.width = canvas.width; part.height = end - y;
    part.getContext('2d').drawImage(canvas, 0, y, canvas.width, end - y, 0, 0, canvas.width, end - y);
    if (!first) pdf.addPage();
    pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', mx, my, pw - mx * 2, ((end - y) * (pw - mx * 2)) / canvas.width);
    y = end;
  }
  pdf.save(String(courseCode || 'syllabus').replace(/[^A-Za-z0-9._-]+/g, '_') + '.pdf');
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
  const pdfUrl = open && open.file && open.file.path ? `/api/students/syllabi/${openId}/file` : null; // served by the API: /uploads is private

  if (openId !== null) {
    return (
      <>
        <PageHead title={open ? open.syllabus.courseCode : translateUI('studentView.syllabus')} subtitle={open ? open.syllabus.title : ''} actions={<>
          {open && pdfUrl && <a className="btn primary" href={pdfUrl + '?download=1'} download>{translateUI('studentView.downloadPdf')}</a>}
          {open && open.content && <StableButton className="btn primary" type="button" onClick={() => savePaperPdf(open.syllabus.courseCode)}>{translateUI('studentView.downloadPdf')}</StableButton>}
          <StableButton className="btn ghost" type="button" onClick={() => setOpenId(null)}>{translateUI('studentView.back')}</StableButton>
        </>} />
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
