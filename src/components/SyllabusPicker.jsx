import { useEffect, useId, useMemo, useState } from 'react';
import { canCheckNow } from '../lib/complianceView';

const STATUS_LABELS = { draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review', for_revision: 'For Revision', approved: 'Approved', rejected: 'Rejected' };

// The admin's way to choose the next syllabus to check: Faculty, then Program, then Subject. It offers only what is still waiting for
// its first check (the page filters the list); a checked syllabus is in the history instead. Each select waits for the one before
// it, and changing a parent clears the ones below it. It only chooses; the page runs the check and opens the result.
//   groups    from groupByFacultyProgram(waiting rows)      loading   true while the list loads
//   busy      true while a check runs (the button waits)
//   onCheck(row)   called with the chosen row when "Check compliance" is pressed
export default function SyllabusPicker({ groups, loading = false, busy = false, onCheck }) {
  const uid = useId();
  const [facultyKey, setFacultyKey] = useState('');
  const [programKey, setProgramKey] = useState('');
  const [syllabusId, setSyllabusId] = useState('');

  const faculty = useMemo(() => groups.find((f) => f.key === facultyKey) || null, [groups, facultyKey]);
  const program = faculty ? faculty.programs.find((p) => p.key === programKey) || null : null;
  const row = program ? program.rows.find((r) => String(r.syllabusId) === syllabusId) || null : null;

  // When the chosen syllabus is checked it leaves the list: clear whatever no longer exists so the selects never show a stale choice.
  useEffect(() => {
    if (syllabusId && !row) setSyllabusId('');
    if (programKey && !program) { setProgramKey(''); setSyllabusId(''); }
    if (facultyKey && !faculty) { setFacultyKey(''); setProgramKey(''); setSyllabusId(''); }
  }, [faculty, program, row, facultyKey, programKey, syllabusId]);

  const pickFaculty = (v) => { setFacultyKey(v); setProgramKey(''); setSyllabusId(''); };
  const pickProgram = (v) => { setProgramKey(v); setSyllabusId(''); };

  const empty = !loading && groups.length === 0;
  const ready = canCheckNow(row);

  return (
    <section className="card pick-card" aria-label="Choose a syllabus to check">
      <div className="pick-head">
        <h3>Choose a syllabus</h3>
        <p>Syllabi waiting for their first check. Once checked, a syllabus moves to the history below.</p>
      </div>
      <div className="pick-grid">
        <div className="pick-field">
          <label htmlFor={uid + '-f'}>Faculty</label>
          <select id={uid + '-f'} value={faculty ? facultyKey : ''} disabled={loading || empty} onChange={(e) => pickFaculty(e.target.value)}>
            <option value="">{loading ? 'Loading…' : empty ? 'Nothing is waiting for a check' : 'Choose a faculty member'}</option>
            {groups.map((f) => <option key={f.key} value={f.key}>{f.facultyName + ' (' + f.count + ')'}</option>)}
          </select>
        </div>
        <div className="pick-field">
          <label htmlFor={uid + '-p'}>Program</label>
          <select id={uid + '-p'} value={program ? programKey : ''} disabled={!faculty} onChange={(e) => pickProgram(e.target.value)}>
            <option value="">Choose a program</option>
            {faculty && faculty.programs.map((p) => <option key={p.key} value={p.key}>{p.code ? p.code + (p.name ? ' · ' + p.name : '') : 'No program'}</option>)}
          </select>
        </div>
        <div className="pick-field">
          <label htmlFor={uid + '-s'}>Subject</label>
          <select id={uid + '-s'} value={row ? syllabusId : ''} disabled={!program} onChange={(e) => setSyllabusId(e.target.value)}>
            <option value="">Choose a subject</option>
            {program && program.rows.map((r) => <option key={r.syllabusId} value={String(r.syllabusId)}>{r.courseCode + ' — ' + (r.courseTitle || r.title) + (r.upload ? ' (uploaded file)' : '')}</option>)}
          </select>
        </div>
      </div>

      <div className="pick-foot">
        <div className="pick-info" aria-live="polite">
          {row ? (
            <>
              <span className={'status ' + row.status}>{STATUS_LABELS[row.status] || row.status}</span>
              <span className="pick-meta">{busy ? 'Checking…' : (row.version ? row.version + ' · ' : '') + 'Not checked yet'}</span>
              {row.upload && <span className="pick-note">This syllabus was uploaded as a file, so only the file and its course details are checked. Matching it to the template needs the AI service, which is not switched on yet.</span>}
              {!ready && !row.upload && <span className="pick-note">There is nothing in this syllabus that can be checked.</span>}
            </>
          ) : <span className="pick-meta">{loading ? 'Loading syllabi…' : empty ? 'Every submitted syllabus has been checked. See the history below.' : 'Nothing chosen yet.'}</span>}
        </div>
        <button type="button" className="btn primary" disabled={!row || !ready || busy} onClick={() => onCheck(row)}>{busy ? 'Checking…' : 'Check compliance'}</button>
      </div>
    </section>
  );
}
