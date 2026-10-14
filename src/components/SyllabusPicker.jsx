import { useId, useMemo, useState } from 'react';
import { actionLabel, isLocked, when } from '../lib/complianceView';

const STATUS_LABELS = { draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review', for_revision: 'For Revision', approved: 'Approved', rejected: 'Rejected' };

// The admin's way to choose one syllabus: Faculty, then Program, then Subject. Each select waits for the one before it, and changing a
// parent clears the ones below it. It only chooses; the page runs the check and opens the result.
//   groups    from groupByFacultyProgram(rows)      loading   true while the list loads
//   busy      true while the chosen syllabus is being checked (the button waits)
//   onCheck(row)   called with the chosen row when "Check compliance" is pressed
export default function SyllabusPicker({ groups, loading = false, busy = false, onCheck }) {
  const uid = useId();
  const [facultyKey, setFacultyKey] = useState('');
  const [programKey, setProgramKey] = useState('');
  const [syllabusId, setSyllabusId] = useState('');

  const faculty = useMemo(() => groups.find((f) => f.key === facultyKey) || null, [groups, facultyKey]);
  const program = faculty ? faculty.programs.find((p) => p.key === programKey) || null : null;
  const row = program ? program.rows.find((r) => String(r.syllabusId) === syllabusId) || null : null; // read from the live list, so a new check shows at once

  const pickFaculty = (v) => { setFacultyKey(v); setProgramKey(''); setSyllabusId(''); };
  const pickProgram = (v) => { setProgramKey(v); setSyllabusId(''); };

  const locked = isLocked(row); // approved: final, only its stored check can be viewed
  const label = !row ? null : locked ? (row.run ? 'View check' : null) : actionLabel(row);
  const checked = row && row.run ? when(row.run.createdAt) : '';

  return (
    <section className="card pick-card" aria-label="Choose a syllabus to check">
      <div className="pick-head">
        <h3>Choose a syllabus</h3>
        <p>Pick the faculty member, then the program, then the subject.</p>
      </div>
      <div className="pick-grid">
        <div className="pick-field">
          <label htmlFor={uid + '-f'}>Faculty</label>
          <select id={uid + '-f'} value={facultyKey} disabled={loading || groups.length === 0} onChange={(e) => pickFaculty(e.target.value)}>
            <option value="">{loading ? 'Loading…' : groups.length ? 'Choose a faculty member' : 'No syllabus submitted yet'}</option>
            {groups.map((f) => <option key={f.key} value={f.key}>{f.facultyName + ' (' + f.count + ')'}</option>)}
          </select>
        </div>
        <div className="pick-field">
          <label htmlFor={uid + '-p'}>Program</label>
          <select id={uid + '-p'} value={programKey} disabled={!faculty} onChange={(e) => pickProgram(e.target.value)}>
            <option value="">Choose a program</option>
            {faculty && faculty.programs.map((p) => <option key={p.key} value={p.key}>{p.code ? p.code + (p.name ? ' · ' + p.name : '') : 'No program'}</option>)}
          </select>
        </div>
        <div className="pick-field">
          <label htmlFor={uid + '-s'}>Subject</label>
          <select id={uid + '-s'} value={syllabusId} disabled={!program} onChange={(e) => setSyllabusId(e.target.value)}>
            <option value="">Choose a subject</option>
            {program && program.rows.map((r) => <option key={r.syllabusId} value={String(r.syllabusId)}>{r.courseCode + ' — ' + (r.courseTitle || r.title)}</option>)}
          </select>
        </div>
      </div>

      <div className="pick-foot">
        <div className="pick-info" aria-live="polite">
          {row ? (
            <>
              <span className={'status ' + row.status}>{STATUS_LABELS[row.status] || row.status}</span>
              <span className="pick-meta">{busy ? (locked ? 'Opening…' : 'Checking…') : (row.version ? row.version + ' · ' : '') + (checked ? 'Last checked ' + checked : 'Not checked yet')}</span>
              {locked && <span className="pick-note">{'Approved syllabi are locked and cannot be checked again.' + (row.run ? '' : ' No check is stored for this approved syllabus.')}</span>}
              {!row.checkable && <span className="pick-note">This syllabus was submitted as an uploaded file, so there is no builder form to check.</span>}
            </>
          ) : <span className="pick-meta">{loading ? 'Loading syllabi…' : 'Nothing chosen yet.'}</span>}
        </div>
        <button type="button" className="btn primary" disabled={!row || !label || busy} onClick={() => onCheck(row)}>{busy ? (locked ? 'Opening…' : 'Checking…') : locked ? 'View check' : 'Check compliance'}</button>
      </div>
    </section>
  );
}
