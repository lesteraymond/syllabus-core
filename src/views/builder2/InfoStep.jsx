import { Field } from '../../components/ui';
import { CURRENT_SCHOOL_YEAR, COLLEGE_NAME } from '../../lib/schoolYear';
import { Auto, Ic } from './parts';
import { newId } from './useDraft';

// Step 1: Course Information (form sections I-V).
export default function InfoStep({ d, apply, model, programList, courseList, onChooseCourse, onChooseProgram }) {
  const m = d.meta;
  const setM = (k, v) => apply((x) => { x.meta[k] = v; return x; });
  const loaded = model.poList(d).length;
  return (
    <div className="form-grid">
      <Field label="Program *">
        <select value={m.program} onChange={(e) => onChooseProgram(e.target.value)} aria-label="Program">
          <option value="">Choose a program</option>
          {programList.map((p) => <option key={p.code} value={p.code}>{p.code + ' – ' + p.name}</option>)}
        </select>
        <span className="linkline">
          {!m.program ? 'Choosing a program loads its program outcomes into step 2.'
            : loaded ? <>Loads <b className="mono">{loaded + ' program outcomes'}</b> into step 2.</>
              : <span style={{ color: 'var(--warn)' }}>No program outcomes loaded for {m.program} yet. An administrator adds them.</span>}
        </span>
      </Field>
      <Field label="Subject * (I, II)">
        <select value={m.courseId || ''} onChange={(e) => onChooseCourse(e.target.value ? Number(e.target.value) : null)} aria-label="Subject" disabled={!m.program || !courseList.length}>
          <option value="">{!m.program ? 'Choose a program first' : courseList.length ? 'Choose a subject' : 'No subjects yet'}</option>
          {courseList.map((c) => <option key={c.id} value={c.id}>{c.code + ' \u2013 ' + c.title}</option>)}
        </select>
        <span className="linkline">
          {!m.program ? 'Subjects are listed by program.'
            : !courseList.length ? <span style={{ color: 'var(--warn)' }}>No subjects have been added for {m.program} yet. An administrator adds them.</span>
              : m.courseId ? <>Its code, title and learning outcomes load from the subject.</> : 'The subject sets the code, title and learning outcomes.'}
        </span>
      </Field>
      <Field label="Credit units * (V)">
        <span className="units">
          <input className="mono" inputMode="numeric" value={m.lecture} onChange={(e) => setM('lecture', e.target.value)} aria-label="Lecture units" maxLength={4} style={{ width: 74, textAlign: 'center' }} /><span>units lecture /</span>
          <input className="mono" inputMode="numeric" value={m.lab} onChange={(e) => setM('lab', e.target.value)} aria-label="Laboratory units" maxLength={4} style={{ width: 74, textAlign: 'center' }} /><span>unit laboratory</span>
        </span>
      </Field>
      <Field label="Pre-requisite (IV)" full><input value={m.prereq} onChange={(e) => setM('prereq', e.target.value)} aria-label="Pre-requisite" maxLength={255} /></Field>
      <div className="field full">
        <span>Course description * (III)</span>
        {d.description.map((x, i) => (
          <div key={x.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 28px', gap: 6, marginBottom: 8, alignItems: 'start' }}>
            <Auto className="in" value={x.t} placeholder="Describe the course in a few sentences" label={'Description paragraph ' + (i + 1)} onChange={(v) => apply((z) => { z.description[i].t = v; return z; })} />
            <button type="button" className="ib del" aria-label="Remove paragraph" disabled={d.description.length < 2} onClick={() => apply((z) => { z.description.splice(i, 1); return z; })}><Ic n="x" /></button>
          </div>
        ))}
        <div><button type="button" className="link" onClick={() => apply((z) => { z.description.push({ id: newId(), t: '' }); return z; })}>+ Add paragraph</button></div>
      </div>
      <div className="field full">
        <div className="auto"><span>Course code <b className="mono">{m.code || '\u2014'}</b></span><span>Course title <b>{m.title || '\u2014'}</b></span><span>School year <b className="mono">{CURRENT_SCHOOL_YEAR.label}</b></span><span>College <b>{COLLEGE_NAME}</b></span></div>
      </div>
    </div>
  );
}
