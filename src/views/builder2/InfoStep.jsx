import { t as translateUI } from "../../i18n/index.js";
import { tr } from "../../i18n/index.js";
import { STATUS_LABELS } from '../../lib/syllabusRules';
import { Field } from '../../components/ui';
import { CURRENT_SCHOOL_YEAR, COLLEGE_NAME } from '../../lib/schoolYear';
import { Auto, Ic } from './parts';
import { newId } from './useDraft';
import Select from '../../components/Select';

// Step 1: Course Information (form sections I-V).
export default function InfoStep({ d, apply, model, programList, courseList, onChooseCourse, onChooseProgram }) {
  const m = d.meta;
  const setM = (k, v) => apply((x) => { x.meta[k] = v; return x; });
  return (
    <div className="form-grid">
      <Field label={translateUI("ui.program_2f03bb")}>
        <Select value={m.program} onChange={(e) => onChooseProgram(e.target.value)} aria-label={translateUI("ui.program_9d6800")}>
          <option value="">{translateUI("ui.choose_a_program_2d5477")}</option>
          {programList.map((p) => <option key={p.code} value={p.code}>{p.code + ' – ' + p.name}</option>)}
        </Select>
        <span className="linkline">
          {translateUI('outcomes.authorInStep2')}
        </span>
      </Field>
      <Field label={translateUI("ui.subject_i_ii_0cd15b")}>
        <Select value={m.courseId || ''} onChange={(e) => onChooseCourse(e.target.value ? Number(e.target.value) : null)} aria-label={translateUI("ui.subject_8d183d")} disabled={!m.program || !courseList.length}>
          <option value="">{!m.program ? translateUI("ui.choose_a_program_first_43fce3") : courseList.length ? translateUI("ui.choose_a_subject_554b9c") : translateUI("ui.no_subjects_yet_1e06ee")}</option>
          {courseList.map((c) => { const taken = c.taken && c.id !== m.courseId ? c.taken : null; return <option key={c.id} value={c.id} disabled={!!taken}>{c.code + ' – ' + c.title + (taken ? ' · ' + (taken.status === 'draft' ? translateUI("builder.subjectHasDraft") : translateUI("builder.subjectTaken", { status: tr(STATUS_LABELS[taken.status] || taken.status) })) : '')}</option>; })}
        </Select>
        <span className="linkline">
          {!m.program ? translateUI("ui.subjects_are_listed_by_program_41c330")
            : !courseList.length ? <span style={{ color: 'var(--warn)' }}>{translateUI("ui.no_subjects_have_been_added_for_679751")}{m.program}{translateUI("ui.yet_an_administrator_adds_them_a9bb24")}</span>
              : translateUI('outcomes.subjectIdentity')}
        </span>
      </Field>
      <Field label={translateUI("ui.credit_units_v_40ba2a")}>
        <span className="units">
          <input className="mono" inputMode="numeric" value={m.lecture} onChange={(e) => setM('lecture', e.target.value)} aria-label={translateUI("ui.lecture_units_de9aaf")} maxLength={4} style={{ width: 74, textAlign: 'center' }} /><span>{translateUI("ui.units_lecture_2a1d2c")}</span>
          <input className="mono" inputMode="numeric" value={m.lab} onChange={(e) => setM('lab', e.target.value)} aria-label={translateUI("ui.laboratory_units_067e02")} maxLength={4} style={{ width: 74, textAlign: 'center' }} /><span>{translateUI("ui.unit_laboratory_60e5a6")}</span>
        </span>
      </Field>
      <Field label={translateUI("ui.pre_requisite_iv_1c46d5")} full><input value={m.prereq} onChange={(e) => setM('prereq', e.target.value)} aria-label={translateUI("ui.pre_requisite_d4ec8c")} maxLength={255} /></Field>
      <div className="field full">
        <span>{translateUI("ui.course_description_iii_db7708")}</span>
        {d.description.map((x, i) => (
          <div key={x.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 28px', gap: 6, marginBottom: 8, alignItems: 'start' }}>
            <Auto className="in" value={x.t} placeholder={translateUI("ui.describe_the_course_in_a_few_sentences_8c883c")} label={translateUI("ui.description_paragraph_207be8") + (i + 1)} onChange={(v) => apply((z) => { z.description[i].t = v; return z; })} />
            <button type="button" className="ib del" aria-label={translateUI("ui.remove_paragraph_4bf624")} disabled={d.description.length < 2} onClick={() => apply((z) => { z.description.splice(i, 1); return z; })}><Ic n="x" /></button>
          </div>
        ))}
        <div><button type="button" className="link" onClick={() => apply((z) => { z.description.push({ id: newId(), t: '' }); return z; })}>{translateUI("ui.add_paragraph_8df913")}</button></div>
      </div>
      <div className="field full">
        <div className="auto"><span>{translateUI("ui.course_code_c3a63c")}<b className="mono">{m.code || '\u2014'}</b></span><span>{translateUI("ui.course_title_b609b8")}<b>{m.title || '\u2014'}</b></span><span>{translateUI("ui.school_year_fa59aa")}<b className="mono">{CURRENT_SCHOOL_YEAR.label}</b></span><span>{translateUI("ui.college_ef33db")}<b>{COLLEGE_NAME}</b></span></div>
      </div>
    </div>
  );
}
