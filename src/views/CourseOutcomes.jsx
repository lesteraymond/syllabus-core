import { useEffect, useMemo, useState } from 'react';
import { PageHead } from '../components/ui';
import { courses as coursesApi, outcomes as outcomesApi } from '../lib/api';
import SubjectModal from './SubjectModal';

// Admin screen: the subject catalog. The list shows every subject; opening one shows everything an administrator manages
// for it in one modal (vision and mission, the program's EGAs and POs, the subject's CLOs and details). Different
// programs and subjects have their own; faculty see them read-only in the syllabus builder.
export default function CourseOutcomes({ notify }) {
  const [list, setList] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ program: '', programName: '', code: '', title: '' });
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');

  const refresh = () => coursesApi.list().then(setList).catch((e) => notify('Could not load subjects: ' + e.message));
  useEffect(() => { refresh(); outcomesApi.programs().then(setPrograms).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The program is typed: its code and its full name. A code that matches an existing program uses it (its name is filled in);
  // any other code is a new program, created together with this first subject (the server does it in one step).
  const programCode = form.program.trim().toUpperCase();
  const existing = programs.find((p) => p.code.toUpperCase() === programCode) || null;
  const isNew = !!programCode && !existing;
  const canAdd = !busy && !!programCode && form.code.trim() && form.title.trim() && (!isNew || form.programName.trim());
  const blank = { program: '', programName: '', code: '', title: '' };

  const addCourse = async () => {
    setBusy(true); setFormError('');
    try {
      const c = await coursesApi.create({ program: programCode, programName: isNew ? form.programName.trim() : undefined, code: form.code, title: form.title });
      setAdding(false); setForm(blank);
      await refresh(); outcomesApi.programs().then(setPrograms).catch(() => {});
      setOpenId(c.id);
      notify(c.programCreated ? `Program ${c.program.code} created and subject added. Add its outcomes below.` : 'Subject added. Add its learning outcomes below.');
    } catch (e) { setFormError(e.message); } finally { setBusy(false); }
  };

  const shown = useMemo(() => list.filter((c) => !filter || c.program === filter), [list, filter]);

  return (
    <div className="bld2">
      <PageHead title="Subjects & CLOs" subtitle="Open a subject to manage its program's graduate attributes and program outcomes, its course learning outcomes, and the school's vision and mission. Faculty see them read-only in the syllabus builder." actions={<button className="btn primary" onClick={() => setAdding(true)}>+ Add subject</button>} />
      {adding && (
        <div className="card ac-form">
          <div className="form-grid">
            <label className="field"><span>Program code</span>
              <input value={form.program} maxLength={20} list="ac-programs" placeholder="e.g. BSIT" autoComplete="off" onChange={(e) => { setForm({ ...form, program: e.target.value.toUpperCase() }); setFormError(''); }} />
              <datalist id="ac-programs">{programs.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</datalist>
              {existing && <span className="ac-hint">Existing program</span>}
              {isNew && <span className="ac-hint ac-new">{programCode} is a new program and will be created with this subject.</span>}
            </label>
            <label className="field"><span>Program name</span>
              <input value={existing ? existing.name : form.programName} readOnly={!!existing} maxLength={255} placeholder="e.g. BS Information Technology" onChange={(e) => { setForm({ ...form, programName: e.target.value }); setFormError(''); }} />
            </label>
            <label className="field"><span>Subject code</span><input value={form.code} maxLength={50} placeholder="e.g. IT 204" onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
            <label className="field full"><span>Subject title</span><input value={form.title} maxLength={255} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          </div>
          {formError && <div className="info-banner warning" role="alert" style={{ marginTop: 10 }}>{formError}</div>}
          <div className="ac-actions"><button className="btn outline" onClick={() => { setAdding(false); setForm(blank); setFormError(''); }}>Cancel</button><button className="btn primary" disabled={!canAdd} onClick={addCourse}>{busy ? 'Adding…' : 'Add subject'}</button></div>
        </div>
      )}
      <div className="card table-card">
        <div className="sm-toolbar">
          <label className="field"><span>Program</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by program"><option value="">All programs</option>{programs.map((p) => <option key={p.code} value={p.code}>{p.code}</option>)}</select>
          </label>
          <span className="hint">{shown.length} subject{shown.length === 1 ? '' : 's'}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Code</th><th>Title</th><th>Program</th><th className="sm-r">CLOs</th></tr></thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} className="ac-row" onClick={() => setOpenId(c.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(c.id); }}>
                  <td className="mono">{c.code}</td><td>{c.title}{c.gaps && c.gaps.length > 0 && <span className="badge gold sm-gap" title={'Missing: ' + c.gaps.join(', ')}>Setup incomplete</span>}</td><td>{c.program}</td><td className="mono sm-r">{c.cloCount}</td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan="4" style={{ color: 'var(--muted)', padding: 18 }}>{filter ? `No subjects in ${filter} yet.` : 'No subjects yet. Add one to start.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {openId && <SubjectModal key={openId} courseId={openId} notify={notify} onChanged={refresh} onClose={() => setOpenId(null)} />}
    </div>
  );
}
