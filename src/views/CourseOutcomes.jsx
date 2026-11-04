import { useActionExit, useCatalogMotion, useSurfaceMotion } from '../lib/catalogMotion';
import ProgramManagement from '../components/ProgramManagement';
import StableButton from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHead } from '../components/ui';
import { courses as coursesApi, deadlines as deadlinesApi, outcomes as outcomesApi } from '../lib/api';
import { SubjectDialog, SubjectRowActions } from '../components/SubjectActions';
import { DeadlineChip, DeadlineDialog } from '../components/DeadlineDialog';
import { currentDeadline, groupByCourse } from '../lib/deadlineView';
import Select from '../components/Select';

// Administrators manage program/subject identity and deadlines here. Learning-outcome authoring lives in builder Step 2.
export default function CourseOutcomes({ notify, onCatalogChanged }) {
  const [list, setList] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [deadlineState, setDeadlineState] = useState({ enabled: false, list: [] });   // enabled turns true once the deadline tables exist
  const [deadlineFor, setDeadlineFor] = useState(null);   // the subject whose deadline dialog is open
  const [target, setTarget] = useState(null);       // { subject, mode: 'edit' | 'delete' }: the dialog opened from a row
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ program: '', programName: '', code: '', title: '' });
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  const formRef = useRef(null);
  const tableRef = useRef(null);
  const formMotion = useActionExit(formRef);
  useCatalogMotion(tableRef, JSON.stringify([filter, list.map(({ id, code, title, program, cloCount }) => [id, code, title, program, cloCount])]));

  const loadDeadlines = () => deadlinesApi.list().then((r) => setDeadlineState({ enabled: r.enabled !== false, list: r.deadlines || [] })).catch(() => {});
  const deadlinesByCourse = useMemo(() => groupByCourse(deadlineState.list), [deadlineState.list]);
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
  useEffect(() => { refreshCatalog().catch(error => notify(tr(error.message))); loadDeadlines(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      notify(translateUI('outcomes.subjectCreated'));
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
          <label className="field"><span>{translateUI("subjects.byProgram")}</span>
            <Select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={translateUI("ui.filter_by_program_133f8f")}><option value="">{translateUI("ui.all_programs_982d52")}</option>{programs.map((p) => <option key={p.code} value={p.code}>{p.code}</option>)}</Select>
          </label>
          <span className="hint">{tr(shown.length + (shown.length === 1 ? ' subject' : ' subjects'))}</span>
        </div>
        <ul className="sm-cards">
          {shown.map((c) => (
            <li key={c.id}>
              <div className="sm-card-head"><div><strong className="mono">{c.code}</strong><span>{c.title}</span></div><span className="chip quiet">{c.program}</span></div>
              {deadlineState.enabled && <div className="sm-card-deadline"><DeadlineChip subject={c} deadline={currentDeadline(deadlinesByCourse.get(c.id))} onOpen={() => setDeadlineFor(c)} /></div>}
              <div className="sm-card-actions"><SubjectRowActions subject={c} onEdit={() => setTarget({ subject: c, mode: 'edit' })} onDelete={() => setTarget({ subject: c, mode: 'delete' })} /></div>
            </li>
          ))}
          {!shown.length && <li className="sm-card-empty">{filter ? translateUI("ui.no_subjects_in_p0_yet_4d9c7b", { p0: (filter) }) : translateUI("ui.no_subjects_yet_add_one_to_start_c6c29e")}</li>}
        </ul>
        <div ref={tableRef} className="table-wrap sm-table">
          <table>
            <thead><tr><th>{translateUI("ui.code_adac69")}</th><th>{translateUI("ui.title_768e0c")}</th><th>{translateUI("ui.program_9d6800")}</th>{deadlineState.enabled && <th>{translateUI("deadline.column")}</th>}<th className="col-actions">{translateUI("ui.actions_c3cd63")}</th></tr></thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} data-catalog-row={'subject-' + c.id}>
                  <td className="mono">{c.code}</td><td>{c.title}</td><td>{c.program}</td>{deadlineState.enabled && <td><DeadlineChip subject={c} deadline={currentDeadline(deadlinesByCourse.get(c.id))} onOpen={() => setDeadlineFor(c)} /></td>}<td className="col-actions"><SubjectRowActions subject={c} onEdit={() => setTarget({ subject: c, mode: 'edit' })} onDelete={() => setTarget({ subject: c, mode: 'delete' })} /></td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={deadlineState.enabled ? 5 : 4} style={{ color: 'var(--muted)', padding: 18 }}>{filter ? translateUI("ui.no_subjects_in_p0_yet_4d9c7b", { p0: (filter) }) : translateUI("ui.no_subjects_yet_add_one_to_start_c6c29e")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {deadlineFor && <DeadlineDialog key={deadlineFor.id} subject={deadlineFor} deadlines={deadlinesByCourse.get(deadlineFor.id) || []} onClose={() => setDeadlineFor(null)} onReminded={notify}
        onChanged={(kind, notices) => { setDeadlineFor(null); loadDeadlines(); const told = notices && notices.notified ? notices.notified : 0;
          notify(told ? translateUI(kind === 'saved' ? 'deadline.savedNotified' : 'deadline.cancelledNotified', { count: told }) : translateUI(kind === 'saved' ? 'deadline.saved' : 'deadline.cancelled')); }} />}
      {target && <SubjectDialog key={target.subject.id + target.mode} {...target} onClose={() => setTarget(null)} onComplete={(mode) => { setTarget(null); refresh(); onCatalogChanged?.(); notify(translateUI(mode === 'edit' ? 'ui.subject_saved_9c680c' : 'ui.subject_deleted_688bd2')); }} />}
    </div>
  );
}
