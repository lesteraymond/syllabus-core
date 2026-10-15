import StableButton from './StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
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
    <section className="card pick-card" aria-label={translateUI("ui.choose_a_syllabus_to_check_b6f6d2")}>
      <div className="pick-head">
        <h3>{translateUI("ui.choose_a_syllabus_cd5a79")}</h3>
        <p>{translateUI("ui.syllabi_waiting_for_their_first_check_once_checked_a_syllabus_mov_d3e75a")}</p>
      </div>
      <div className="pick-grid">
        <div className="pick-field">
          <label htmlFor={uid + '-f'}>{translateUI("ui.faculty_9ae050")}</label>
          <select id={uid + '-f'} value={faculty ? facultyKey : ''} disabled={loading || empty} onChange={(e) => pickFaculty(e.target.value)}>
            <option value="">{loading ? translateUI("ui.loading_33ce41") : empty ? translateUI("ui.nothing_is_waiting_for_a_check_28b41a") : translateUI("ui.choose_a_faculty_member_65ac86")}</option>
            {groups.map((f) => <option key={f.key} value={f.key}>{f.facultyName + ' (' + f.count + ')'}</option>)}
          </select>
        </div>
        <div className="pick-field">
          <label htmlFor={uid + '-p'}>{translateUI("ui.program_9d6800")}</label>
          <select id={uid + '-p'} value={program ? programKey : ''} disabled={!faculty} onChange={(e) => pickProgram(e.target.value)}>
            <option value="">{translateUI("ui.choose_a_program_2d5477")}</option>
            {faculty && faculty.programs.map((p) => <option key={p.key} value={p.key}>{p.code ? p.code + (p.name ? ' · ' + p.name : '') : translateUI("ui.no_program_d8600a")}</option>)}
          </select>
        </div>
        <div className="pick-field">
          <label htmlFor={uid + '-s'}>{translateUI("ui.subject_8d183d")}</label>
          <select id={uid + '-s'} value={row ? syllabusId : ''} disabled={!program} onChange={(e) => setSyllabusId(e.target.value)}>
            <option value="">{translateUI("ui.choose_a_subject_554b9c")}</option>
            {program && program.rows.map((r) => <option key={r.syllabusId} value={String(r.syllabusId)}>{r.courseCode + ' — ' + (r.courseTitle || r.title) + (r.upload ? ' (' + tr('uploaded file') + ')' : '')}</option>)}
          </select>
        </div>
      </div>

      <div className="pick-foot">
        <div className="pick-info" aria-live="polite">
          {row ? (
            <>
              <span className={'status ' + row.status}>{tr(STATUS_LABELS[row.status] || row.status)}</span>
              <span className="pick-meta">{busy ? translateUI("ui.checking_820d60") : (row.version ? row.version + ' · ' : '') + translateUI("ui.not_checked_yet_82bd72")}</span>
              {row.upload && <span className="pick-note">{translateUI("ui.this_syllabus_was_uploaded_as_a_file_so_only_the_file_and_its_cou_b947f8")}</span>}
              {!ready && !row.upload && <span className="pick-note">{translateUI("ui.there_is_nothing_in_this_syllabus_that_can_be_checked_32e258")}</span>}
            </>
          ) : <span className="pick-meta">{loading ? translateUI("ui.loading_syllabi_264639") : empty ? translateUI("ui.every_submitted_syllabus_has_been_checked_see_the_history_below_4c13bf") : translateUI("ui.nothing_chosen_yet_a7c4c2")}</span>}
        </div>
        <StableButton type="button" className="btn primary" disabled={!row || !ready || busy} onClick={() => onCheck(row)}>{busy ? translateUI("ui.checking_820d60") : translateUI("ui.check_compliance_342b8f")}</StableButton>
      </div>
    </section>
  );
}
