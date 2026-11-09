import { useActionExit, useCatalogMotion, useSurfaceMotion } from '../lib/catalogMotion';
import ProgramManagement from '../components/ProgramManagement';
import StableButton from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHead } from '../components/ui';
import { academicYears as yearsApi, courses as coursesApi, deadlines as deadlinesApi, outcomes as outcomesApi, syllabusCheck as syllabusCheckApi } from '../lib/api';
import SubjectTermFields from '../components/SubjectTermFields';
import CurriculumYearField from '../components/CurriculumYearField';
import { useYearScope } from '../components/AcademicYearScope';
import { emptyTerm, filterSubjects, noFilters, filtersActive, SEMESTER_OPTIONS, YEAR_LEVELS, termBody, termComplete, termLine, termSet, CURRICULUM_NONE, curriculumYearOptions, normalizeCurriculumYear, semesterKey } from '../lib/subjectTerm';
import { SubjectDialog, SubjectRowActions } from '../components/SubjectActions';
import { DeadlineChip, DeadlineDialog } from '../components/DeadlineDialog';
import { currentDeadline, groupByCourse } from '../lib/deadlineView';
import Select from '../components/Select';
import AcademicYearControl from '../components/AcademicYearControl';
import AddProgramForm from '../components/AddProgramForm';
import { programsNeedingSetup } from '../lib/outcomesSetup';

// Administrators manage program/subject identity and deadlines here. Learning-outcome authoring lives in builder Step 2.
export default function CourseOutcomes({ notify, onCatalogChanged }) {
  // The catalog (programs and subjects) belongs to an academic year. This screen shows ONE year: the selected one, the current year by default. A past year is shown for
  // reference only (the server refuses changes to it), and a new academic year starts with nothing.
  const yearScope = useYearScope();
  const selected = yearScope ? yearScope.selection('data') : '';
  const currentLabel = yearScope && yearScope.current ? yearScope.current.label : '';
  const year = selected === '' || selected === 'all' ? undefined : selected;
  const shownYear = year || currentLabel;
  const readOnly = !!year && !!currentLabel && year !== currentLabel;
  const [list, setList] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [deadlineState, setDeadlineState] = useState({ enabled: false, list: [] });   // enabled turns true once the deadline tables exist
  const [deadlineFor, setDeadlineFor] = useState(null);   // the subject whose deadline dialog is open
  const [target, setTarget] = useState(null);       // { subject, mode: 'edit' | 'delete' }: the dialog opened from a row
  const [adding, setAdding] = useState(false);
  const [addingProgram, setAddingProgram] = useState(false);   // the Add program form (components/AddProgramForm.jsx)
  const [form, setForm] = useState({ program: '', code: '', title: '', curriculumYear: '', ...emptyTerm() });
  const [years, setYears] = useState([]);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');   // the program filter
  const [curriculumFilter, setCurriculumFilter] = useState('');   // the curriculum year filter ('' all, CURRICULUM_NONE the subjects without one)
  const [references, setReferences] = useState([]);   // the approved curriculum references, for the curriculum year suggestions and hint (none when they cannot be read)
  const [termFilter, setTermFilter] = useState({ academicYear: '', semester: '', yearLevel: '' });   // academic year, semester and year level filters (all combine with the program)
  const filters = { ...noFilters(), program: filter, curriculumYear: curriculumFilter, ...termFilter };
  const formRef = useRef(null);
  const tableRef = useRef(null);
  const formMotion = useActionExit(formRef);
  useCatalogMotion(tableRef, JSON.stringify([filter, curriculumFilter, termFilter, list.map(({ id, code, title, program, cloCount, term, curriculumYear }) => [id, code, title, program, cloCount, term, curriculumYear])]));

  const loadDeadlines = () => deadlinesApi.list().then((r) => setDeadlineState({ enabled: r.enabled !== false, list: r.deadlines || [] })).catch(() => {});
  const deadlinesByCourse = useMemo(() => groupByCourse(deadlineState.list), [deadlineState.list]);
  const refresh = () => coursesApi.list(undefined, undefined, year).then(setList).catch((e) => notify(translateUI("ui.could_not_load_subjects_16ddd6") + e.message));
  const refreshCatalog = async () => {
    const [subjects, records, academicYears] = await Promise.all([coursesApi.list(undefined, undefined, year), outcomesApi.programs(year), yearsApi.list().catch(() => [])]);
    setList(subjects); setPrograms(records); setYears(academicYears);
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
  useEffect(() => { refreshCatalog().catch(error => notify(tr(error.message))); loadDeadlines(); }, [year]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { syllabusCheckApi.references().then((rows) => setReferences(Array.isArray(rows) ? rows : [])).catch(() => {}); }, []);   // suggestions only: the page works without them
  useEffect(() => { if (yearScope) yearScope.reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- years added elsewhere (another administrator, another tab) show up when this screen opens

  // The program is chosen from the programs that exist (a new program is made with the Add program button).
  const programCode = form.program;
  const chosen = programs.find((p) => p.code === programCode) || null;
  useSurfaceMotion(formRef, JSON.stringify([adding, formError, programs.length]), true);
  const canAdd = !busy && !!chosen && form.code.trim() && form.title.trim() && !readOnly && termComplete({ ...form, academicYear: currentLabel }) && !!normalizeCurriculumYear(form.curriculumYear);
  const blank = { program: '', code: '', title: '', curriculumYear: '', ...emptyTerm() };
  const curriculumOptions = useMemo(() => curriculumYearOptions(list, references.filter((r) => r.status === 'approved').map((r) => r.curriculumYear)), [list, references]);

  const addCourse = async () => {
    if (busy || formMotion.isClosing()) return;
    setBusy(true); setFormError('');
    try {
      await coursesApi.create({ program: programCode, code: form.code, title: form.title, curriculumYear: normalizeCurriculumYear(form.curriculumYear), ...termBody({ ...form, academicYear: currentLabel }) });
      await refreshCatalog();
      await formMotion.dismiss(() => { setAdding(false); setForm(blank); });
      notify(translateUI('outcomes.subjectCreated'));
    } catch (e) { setFormError(e.message); } finally { setBusy(false); }
  };

  const shown = useMemo(() => filterSubjects(list, filters), [list, filter, curriculumFilter, termFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  const needSetup = useMemo(() => programsNeedingSetup(programs), [programs]);   // programs of this year still without EGAs or Program Outcomes
  // adding an academic year (from the Current academic year block): create it and reload
  const addYear = async (startYear) => { const made = await yearsApi.create(startYear); await refreshCatalog(); if (yearScope) await yearScope.reload(); notify(translateUI('years.added')); return made.label; };   // the header dropdown reads the application-wide year list
  const clearFilters = () => { setFilter(''); setCurriculumFilter(''); setTermFilter({ academicYear: '', semester: '', yearLevel: '' }); };

  return (
    <div className="bld2 catalog-page">
      <PageHead title={translateUI("ui.program_subjects_904de5")} subtitle={translateUI("outcomes.subjectSubtitle")} actions={<><StableButton className="btn outline" disabled={addingProgram || busy || readOnly} onClick={() => { setAdding(false); setAddingProgram(true); }}>{translateUI("programs.addButton")}</StableButton><StableButton className="btn primary" disabled={adding || busy || readOnly} onClick={() => { setAddingProgram(false); setAdding(true); }}>{translateUI("ui.add_subject_cf1347")}</StableButton></>} />
      {/* the academic year controls sit in their own row: the buttons that come and go with the year being viewed (Make current, Delete year, Copy from) must not push the Add buttons around */}
      <div className="year-row"><AcademicYearControl years={years} onChanged={refreshCatalog} onAddYear={addYear} notify={notify} /></div>
      {readOnly && <div className="info-banner" role="status">{translateUI('catalog.pastYear', { year })}</div>}
      {!readOnly && needSetup.length > 0 && <div className="info-banner warning" role="status">{translateUI('outcomes.setupBanner', { year: shownYear, list: needSetup.map((p) => p.code).join(', ') })}</div>}
      {addingProgram && !readOnly && <AddProgramForm year={shownYear} notify={notify} onCancel={() => setAddingProgram(false)} onCreated={async (made) => { await refreshCatalog(); setForm((current) => ({ ...current, program: made.code })); }} />}
      {adding && (
        <div ref={formRef} inert={formMotion.closing || undefined} className="card ac-form catalog-surface">
          <div className="form-grid">
            <label className="field"><span>{translateUI("ui.program_2f03bb")}</span>
              <Select value={form.program} disabled={busy || !programs.length} onChange={(e) => { setForm({ ...form, program: e.target.value }); setFormError(''); }} aria-label={translateUI("ui.program_9d6800")}>
                <option value="">{programs.length ? translateUI("subjects.chooseProgram") : translateUI("subjects.noProgramsYet")}</option>
                {programs.map((p) => <option key={p.code} value={p.code}>{p.code + ' – ' + p.name}</option>)}
              </Select>
              {!programs.length && <span className="ac-hint">{translateUI("subjects.addProgramFirst")}{' '}<button type="button" className="link" onClick={() => { setAdding(false); setAddingProgram(true); }}>{translateUI("programs.addButton")}</button></span>}
            </label>
            <label className="field"><span>{translateUI("ui.subject_code_8e42db")} *</span><input value={form.code} maxLength={50} placeholder={translateUI("ui.e_g_it_204_a373a7")} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
            <label className="field full"><span>{translateUI("ui.subject_title_dce28f")} *</span><input value={form.title} maxLength={255} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <CurriculumYearField value={form.curriculumYear} onChange={(v) => { setForm({ ...form, curriculumYear: v }); setFormError(''); }} options={curriculumOptions} references={references} program={form.program} required disabled={busy} />
            <SubjectTermFields value={form} onChange={(next) => { setForm({ ...form, ...next }); setFormError(''); }} fixedYear={currentLabel} disabled={busy} />
          </div>
          {formError && <div className="info-banner warning" role="alert" style={{ marginTop: 10 }}>{formError}</div>}
          <div className="ac-actions"><StableButton className="btn outline" disabled={busy || formMotion.closing} onClick={() => formMotion.dismiss(() => { setAdding(false); setForm(blank); setFormError(''); })}>{translateUI("ui.cancel_77dfd2")}</StableButton><StableButton className="btn primary" disabled={!canAdd || formMotion.closing} onClick={addCourse}>{busy ? translateUI("ui.adding_ffb2e6") : translateUI("ui.add_subject_f3ceb3")}</StableButton></div>
        </div>
      )}
      <ProgramManagement programs={programs} onChanged={refreshCatalog} notify={notify} readOnly={readOnly} year={shownYear} />
      <div className="card table-card">
        <div className="sm-toolbar">
          <div className="sm-filters">
            <label className="field"><span>{translateUI("subjects.byProgram")}</span>
              <Select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={translateUI("ui.filter_by_program_133f8f")}><option value="">{translateUI("ui.all_programs_982d52")}</option>{programs.map((p) => <option key={p.code} value={p.code}>{p.code}</option>)}</Select>
            </label>
            <label className="field"><span>{translateUI("curriculumYear.label")}</span>
              <Select value={curriculumFilter} onChange={(e) => setCurriculumFilter(e.target.value)} aria-label={translateUI("curriculumYear.label")}><option value="">{translateUI("curriculumYear.all")}</option>{curriculumYearOptions(list).map((y) => <option key={y} value={y}>{y}</option>)}{list.some((c) => !c.curriculumYear) && <option value={CURRICULUM_NONE}>{translateUI("curriculumYear.notSetOption")}</option>}</Select>
            </label>
            <label className="field"><span>{translateUI("term.semester")}</span>
              <Select value={termFilter.semester} onChange={(e) => setTermFilter({ ...termFilter, semester: e.target.value })} aria-label={translateUI("term.semester")}><option value="">{translateUI("subjects.allSemesters")}</option>{SEMESTER_OPTIONS.map((s) => <option key={s.value} value={s.value}>{translateUI(s.key)}</option>)}</Select>
            </label>
            <label className="field"><span>{translateUI("term.yearLevel")}</span>
              <Select value={termFilter.yearLevel} onChange={(e) => setTermFilter({ ...termFilter, yearLevel: e.target.value })} aria-label={translateUI("term.yearLevel")}><option value="">{translateUI("subjects.allLevels")}</option>{YEAR_LEVELS.map((n) => <option key={n} value={String(n)}>{translateUI("term.yearOption", { n })}</option>)}</Select>
            </label>
          </div>
          <span className="sm-count"><span className="hint">{tr(shown.length + (shown.length === 1 ? ' subject' : ' subjects'))}</span>{filtersActive(filters) && <StableButton type="button" className="btn outline" onClick={clearFilters}>{translateUI("subjects.clearFilters")}</StableButton>}</span>
        </div>
        <div ref={tableRef} className="table-wrap">
          <table>
            <thead><tr><th>{translateUI("ui.code_adac69")}</th><th>{translateUI("ui.title_768e0c")}</th><th>{translateUI("ui.program_9d6800")}</th><th>{translateUI("curriculumYear.column")}</th><th>{translateUI("term.column")}</th><th>{translateUI("term.prerequisite")}</th>{deadlineState.enabled && <th>{translateUI("deadline.column")}</th>}<th className="col-actions">{translateUI("ui.actions_c3cd63")}</th></tr></thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} data-catalog-row={'subject-' + c.id}>
                  <td className="mono">{c.code}</td><td>{c.title}</td><td>{c.program}</td><td className="mono">{c.curriculumYear || <span className="hint">{translateUI('term.notSet')}</span>}</td><td>{termLine(c.term, translateUI, (s) => (semesterKey(s) ? translateUI(semesterKey(s)) : s)) || <span className="hint">{translateUI('term.notSet')}</span>}{c.curriculumNote && <span className="term-warning" role="note">{translateUI('term.curriculumWarning', { year: c.curriculumNote.differences[0].curriculumYear, details: c.curriculumNote.differences.map((d) => translateUI(d.field === 'prerequisite' ? 'term.diff.prerequisite' : 'term.diff.yearLevel', { value: d.curriculum })).join(', ') })}</span>}</td><td>{c.term && c.term.prerequisite ? c.term.prerequisite : termSet(c.term) ? <span className="hint">{translateUI('term.none')}</span> : <span className="hint">{translateUI('term.notSet')}</span>}</td>{deadlineState.enabled && <td><DeadlineChip subject={c} deadline={currentDeadline(deadlinesByCourse.get(c.id))} onOpen={() => setDeadlineFor(c)} /></td>}<td className="col-actions"><SubjectRowActions subject={c} readOnly={readOnly} onEdit={() => setTarget({ subject: c, mode: 'edit' })} onDelete={() => setTarget({ subject: c, mode: 'delete' })} /></td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={deadlineState.enabled ? 8 : 7} style={{ color: 'var(--muted)', padding: 18 }}>{list.length && (curriculumFilter || termFilter.semester || termFilter.yearLevel) ? translateUI("subjects.noMatch") : filter ? translateUI("ui.no_subjects_in_p0_yet_4d9c7b", { p0: (filter) }) : !programs.length ? translateUI("catalog.emptyYear", { year: shownYear }) : translateUI("ui.no_subjects_yet_add_one_to_start_c6c29e")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {deadlineFor && <DeadlineDialog key={deadlineFor.id} subject={deadlineFor} deadlines={deadlinesByCourse.get(deadlineFor.id) || []} onClose={() => setDeadlineFor(null)} onReminded={notify}
        onChanged={(kind, notices) => { setDeadlineFor(null); loadDeadlines(); const told = notices && notices.notified ? notices.notified : 0;
          notify(told ? translateUI(kind === 'saved' ? 'deadline.savedNotified' : 'deadline.cancelledNotified', { count: told }) : translateUI(kind === 'saved' ? 'deadline.saved' : 'deadline.cancelled')); }} />}
      {target && <SubjectDialog key={target.subject.id + target.mode} {...target} curriculumOptions={curriculumOptions} references={references} onClose={() => setTarget(null)} onComplete={(mode) => { setTarget(null); refresh(); onCatalogChanged?.(); notify(translateUI(mode === 'edit' ? 'ui.subject_saved_9c680c' : 'ui.subject_deleted_688bd2')); }} />}
    </div>
  );
}
