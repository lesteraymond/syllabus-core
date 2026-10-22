import StableButton from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useMemo, useState } from 'react';
import { syllabi as syllabiApi } from '../lib/api';
import { fmt } from '../lib/utils';
import { Avatar, PageHead, Field } from '../components/ui';
import Select from '../components/Select';
import { repositoryProgram } from './Repository';

// What a student sees: the approved syllabi, to search and open. Nothing here changes a syllabus.
export default function StudentSyllabi({ setViewCode }) {
  const [state, setState] = useState({ rows: [], loading: true, error: '' });
  const [filters, setFilters] = useState({ program: 'All', q: '' });
  useEffect(() => {
    let live = true;
    syllabiApi.repository()
      .then(rows => { if (live) setState({ rows, loading: false, error: '' }); })
      .catch(e => { if (live) setState({ rows: [], loading: false, error: e.message }); });
    return () => { live = false; };
  }, []);
  const programs = useMemo(() => [...new Set(state.rows.map(repositoryProgram))].sort((a, b) => a.localeCompare(b)), [state.rows]);
  const rows = useMemo(() => state.rows.filter(x => (filters.program === 'All' || repositoryProgram(x) === filters.program) && (`${x.courseCode} ${x.title} ${x.faculty}`.toLowerCase().includes(filters.q.trim().toLowerCase()))), [state.rows, filters]);
  return (
    <>
      <PageHead title={translateUI("ui.syllabus_repository_95d8eb")} subtitle={translateUI("student.subtitle")} />
      <div className="filter-card repository-filters">
        <Field label={translateUI("ui.program_9d6800")}><Select value={filters.program} onChange={e => setFilters({ ...filters, program: e.target.value })}><option value="All">{translateUI("ui.all_6a7208")}</option>{programs.map(program => <option key={program} value={program}>{program === 'No program' ? translateUI("ui.no_program_d8600a") : program}</option>)}</Select></Field>
        <Field label={translateUI("ui.search_bce064")}><input value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })} placeholder={translateUI("ui.course_code_title_or_faculty_1878e5")} /></Field>
        <StableButton className="btn ghost reset" onClick={() => setFilters({ program: 'All', q: '' })}>{translateUI("ui.reset_44c57a")}</StableButton>
      </div>
      <div className="repo-stats"><span>{translateUI("ui.approved_afd61f")}<b>{rows.length}</b></span></div>
      <div className="table-card repository-table stu-repo">
        <table>
          <thead><tr><th scope="col">{translateUI("ui.course_d82b56")}</th><th scope="col">{translateUI("ui.program_9d6800")}</th><th scope="col">{translateUI("ui.faculty_9ae050")}</th><th scope="col">{translateUI("ui.updated_f2f857")}</th><th scope="col">{translateUI("ui.actions_c3cd63")}</th></tr></thead>
          <tbody>{rows.map(x => <tr key={x.id}>
            <td><strong>{x.courseCode}</strong><small>{x.title}</small></td>
            <td>{repositoryProgram(x) === 'No program' ? translateUI("ui.no_program_d8600a") : repositoryProgram(x)}</td>
            <td><span className="user-cell"><Avatar userId={x.userId} src={x.ownerAvatarUrl} name={x.faculty} /><span>{x.faculty}</span></span></td>
            <td>{fmt(x.updatedAt)}</td>
            <td><div className="repository-actions"><StableButton className="btn outline" onClick={() => setViewCode(x.id)}>{translateUI("student.view")}</StableButton></div></td>
          </tr>)}</tbody>
        </table>
        <ul className="stu-cards">{rows.map(x => <li key={x.id}>
          <div className="stu-card-head"><div><strong>{x.courseCode}</strong><small>{x.title}</small></div><span className="chip quiet">{repositoryProgram(x) === 'No program' ? translateUI("ui.no_program_d8600a") : repositoryProgram(x)}</span></div>
          <div className="stu-card-meta"><span className="user-cell"><Avatar userId={x.userId} src={x.ownerAvatarUrl} name={x.faculty} /><span>{x.faculty}</span></span><small>{fmt(x.updatedAt)}</small></div>
          <StableButton className="btn outline" onClick={() => setViewCode(x.id)}>{translateUI("student.view")}</StableButton>
        </li>)}</ul>
        {state.error && <div className="empty" role="alert">{translateUI("ui.unable_to_load_approved_syllabi_cd0cc5")}{tr(state.error)}</div>}
        {rows.length === 0 && !state.error && <div className="empty">{state.loading ? translateUI("ui.loading_approved_syllabi_3ad229") : translateUI("ui.no_syllabi_match_your_filters_e09598")}</div>}
      </div>
    </>
  );
}
