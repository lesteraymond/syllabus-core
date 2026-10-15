import { useActionExit, useCatalogMotion, useSurfaceMotion } from '../lib/catalogMotion';
import ProgramManagement from '../components/ProgramManagement';
import StableButton from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHead } from '../components/ui';
import { courses as coursesApi, outcomes as outcomesApi } from '../lib/api';
import SubjectModal from './SubjectModal';

// Admin screen: the subject catalog. The list shows every subject; opening one shows everything an administrator manages
// for it in one modal (vision and mission, the program's EGAs and POs, the subject's CLOs and details). Different
// programs and subjects have their own; faculty see them read-only in the syllabus builder.
export default function CourseOutcomes({ notify, onCatalogChanged }) {
  const [list, setList] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ program: '', programName: '', code: '', title: '' });
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  const formRef = useRef(null);
  const tableRef = useRef(null);
  const formMotion = useActionExit(formRef);
  useCatalogMotion(tableRef, JSON.stringify([filter, list.map(({ id, code, title, program, cloCount }) => [id, code, title, program, cloCount])]));

  const refresh = () => coursesApi.list().then(setList).catch((e) => notify(translateUI("ui.could_not_load_subjects_16ddd6") + e.message));
  const refreshCatalog = async () => {
    const [subjects, records] = await Promise.all([coursesApi.list(), outcomesApi.programs()]);
    setList(subjects); setPrograms(records);
    setFilter(current => {
      const previous = programs.find(program => program.code === current);
      return records.find(program => program.id === previous?.id)?.code || (records.some(program => program.code === current) ? current : '');
    });
    setForm(current => {
      const previous = programs.find(program => program.code === current.program);
      const updated = records.find(program => program.id === previous?.id);
      return updated ? { ...current, program: updated.code } : current;
    });
    onCatalogChanged?.();
  };
  useEffect(() => { refreshCatalog().catch(error => notify(tr(error.message))); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The program is typed: its code and its full name. A code that matches an existing program uses it (its name is filled in);
  // any other code is a new program, created together with this first subject (the server does it in one step).
  const programCode = form.program.trim().toUpperCase();
  const existing = programs.find((p) => p.code.toUpperCase() === programCode) || null;
  const isNew = !!programCode && !existing;
  useSurfaceMotion(formRef, JSON.stringify([adding, formError, isNew]), true);
  const canAdd = !busy && !!programCode && form.code.trim() && form.title.trim() && (!isNew || form.programName.trim());
  const blank = { program: '', programName: '', code: '', title: '' };

  const addCourse = async () => {
    if (busy || formMotion.isClosing()) return;
    setBusy(true); setFormError('');
    try {
      const c = await coursesApi.create({ program: programCode, programName: isNew ? form.programName.trim() : undefined, code: form.code, title: form.title });
      await refreshCatalog();
      await formMotion.dismiss(() => { setAdding(false); setForm(blank); });
      setOpenId(c.id);
      notify(c.programCreated ? translateUI("ui.program_p0_created_and_subject_added_add_its_outcomes_below_a9b6e2", { p0: (c.program.code) }) : translateUI("ui.subject_added_add_its_learning_outcomes_below_ad8a1c"));
    } catch (e) { setFormError(e.message); } finally { setBusy(false); }
  };

  const shown = useMemo(() => list.filter((c) => !filter || c.program === filter), [list, filter]);

  return (
    <div className="bld2 catalog-page">
      <PageHead title={translateUI("ui.program_subjects_904de5")} subtitle={translateUI("outcomes.subjectSubtitle")} actions={<StableButton className="btn primary" disabled={adding || busy} onClick={() => setAdding(true)}>{translateUI("ui.add_subject_cf1347")}</StableButton>} />
      {adding && (
        <div ref={formRef} inert={formMotion.closing || undefined} className="card ac-form catalog-surface">
          <div className="form-grid">
            <label className="field"><span>{translateUI("ui.program_code_18ae83")}</span>
              <input value={form.program} maxLength={20} list="ac-programs" placeholder={translateUI("ui.e_g_bsit_a78cbf")} autoComplete="off" onChange={(e) => { setForm({ ...form, program: e.target.value.toUpperCase() }); setFormError(''); }} />
              <datalist id="ac-programs">{programs.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</datalist>
              {existing && <span className="ac-hint">{translateUI("ui.existing_program_fa9fac")}</span>}
              {isNew && <span className="ac-hint ac-new">{programCode}{translateUI("ui.is_a_new_program_and_will_be_created_with_this_subject_d5fa10")}</span>}
            </label>
            <label className="field"><span>{translateUI("ui.program_name_699413")}</span>
              <input value={existing ? existing.name : form.programName} readOnly={!!existing} maxLength={255} placeholder={translateUI("ui.e_g_bs_information_technology_898182")} onChange={(e) => { setForm({ ...form, programName: e.target.value }); setFormError(''); }} />
            </label>
            <label className="field"><span>{translateUI("ui.subject_code_8e42db")}</span><input value={form.code} maxLength={50} placeholder={translateUI("ui.e_g_it_204_a373a7")} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
            <label className="field full"><span>{translateUI("ui.subject_title_dce28f")}</span><input value={form.title} maxLength={255} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          </div>
          {formError && <div className="info-banner warning" role="alert" style={{ marginTop: 10 }}>{formError}</div>}
          <div className="ac-actions"><StableButton className="btn outline" disabled={busy || formMotion.closing} onClick={() => formMotion.dismiss(() => { setAdding(false); setForm(blank); setFormError(''); })}>{translateUI("ui.cancel_77dfd2")}</StableButton><StableButton className="btn primary" disabled={!canAdd || formMotion.closing} onClick={addCourse}>{busy ? translateUI("ui.adding_ffb2e6") : translateUI("ui.add_subject_f3ceb3")}</StableButton></div>
        </div>
      )}
      <ProgramManagement programs={programs} onChanged={refreshCatalog} notify={notify} />
      <div className="card table-card">
        <div className="sm-toolbar">
          <label className="field"><span>{translateUI("ui.program_9d6800")}</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={translateUI("ui.filter_by_program_133f8f")}><option value="">{translateUI("ui.all_programs_982d52")}</option>{programs.map((p) => <option key={p.code} value={p.code}>{p.code}</option>)}</select>
          </label>
          <span className="hint">{tr(shown.length + (shown.length === 1 ? ' subject' : ' subjects'))}</span>
        </div>
        <div ref={tableRef} className="table-wrap">
          <table>
            <thead><tr><th>{translateUI("ui.code_adac69")}</th><th>{translateUI("ui.title_768e0c")}</th><th>{translateUI("ui.program_9d6800")}</th><th className="sm-r">{translateUI("ui.clos_a33483")}</th></tr></thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} data-catalog-row={'subject-' + c.id} className="ac-row" onClick={() => setOpenId(c.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(c.id); }}>
                  <td className="mono">{c.code}</td><td>{c.title}{c.gaps && c.gaps.length > 0 && <span className="badge gold sm-gap" title={translateUI("ui.missing_276f5d") + c.gaps.join(', ')}>{translateUI("ui.setup_incomplete_7eeb25")}</span>}</td><td>{c.program}</td><td className="mono sm-r">{c.cloCount}</td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan="4" style={{ color: 'var(--muted)', padding: 18 }}>{filter ? translateUI("ui.no_subjects_in_p0_yet_4d9c7b", { p0: (filter) }) : translateUI("ui.no_subjects_yet_add_one_to_start_c6c29e")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {openId && <SubjectModal key={openId} courseId={openId} notify={notify} onChanged={refresh} onClose={() => setOpenId(null)} />}
    </div>
  );
}
