import StableButton from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useMemo, useState } from 'react';
import { syllabi as syllabiApi } from '../lib/api';
import { fmt } from '../lib/utils';
import { canChat } from '../lib/chatPartner';
import { Avatar, PageHead, Field } from '../components/ui';
import Select from '../components/Select';

// Builder syllabi use the catalog program; older uploads may only have a curriculum program.
export const repositoryProgram = syllabus => syllabus.programCode?.trim() || syllabus.programName?.trim() || syllabus.program?.trim() || 'No program';

export default function Repository({ syllabi, user, notify, setChatCode, setHistCode }) {
  const isFaculty = user.role === 'faculty';
  const [repository, setRepository] = useState({ ownerId: null, rows: [], loading: true, error: '' });
  // Read on entry and after the shared list refreshes (including notification polling after approval).
  useEffect(() => {
    if (!isFaculty) return;
    let active = true;
    setRepository(current => ({ ...current, loading: true, error: '' }));
    syllabiApi.repository().then(rows => {
      if (active) setRepository({ ownerId: user.id, rows, loading: false, error: '' });
    }).catch(error => {
      if (active) setRepository({ ownerId: user.id, rows: [], loading: false, error: error.message });
    });
    return () => { active = false; };
  }, [isFaculty, user.id, syllabi]);
  // Approved syllabi archived when their subject went to another faculty member: shown only on request, read-only.
  const [archivedRows, setArchivedRows] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  useEffect(() => {
    let live = true;
    syllabiApi.archived('repository').then((rows) => { if (live) setArchivedRows(rows.filter(s => s.status === 'approved' && (!isFaculty || s.userId === user.id))); }).catch(() => {});
    return () => { live = false; };
  }, [isFaculty, user.id, syllabi]);
  const mySyllabi = useMemo(() => [...(isFaculty
    ? (repository.ownerId === user.id ? repository.rows.filter(s => s.userId === user.id && s.status === 'approved') : [])
    : syllabi.filter(s => s.status === 'approved')), ...(showArchived ? archivedRows : [])], [isFaculty, repository, syllabi, user.id, showArchived, archivedRows]);
  const [filters, setFilters] = useState({ program: 'All', q: '' });
  const programs = useMemo(() => [...new Set(mySyllabi.map(repositoryProgram))].sort((a, b) => a.localeCompare(b)), [mySyllabi]);
  useEffect(() => {
    if (isFaculty && (repository.loading || repository.error || repository.ownerId !== user.id)) return;
    setFilters(current => current.program !== 'All' && !programs.includes(current.program)
      ? { ...current, program: 'All' } : current);
  }, [isFaculty, programs, repository.loading, repository.error, repository.ownerId, user.id]);
  const rows = useMemo(() => mySyllabi.filter(x => (filters.program === 'All' || repositoryProgram(x) === filters.program) && (`${x.courseCode} ${x.title} ${x.faculty}`.toLowerCase().includes(filters.q.trim().toLowerCase()))), [mySyllabi, filters]);
  return (
    <>
      <PageHead title={translateUI("ui.syllabus_repository_95d8eb")} subtitle={isFaculty ? translateUI("ui.search_and_access_your_syllabi_approved_by_an_administrator_112b87") : translateUI("repository.approvedSubtitle")} actions={<><StableButton className="btn outline" onClick={() => notify(translateUI("ui.repository_export_prepared_demo_02ceb3"))}>{translateUI("ui.export_list_b039ae")}</StableButton></>} />
      <div className="filter-card repository-filters">
        <Field label={translateUI("ui.program_9d6800")}><Select value={filters.program} onChange={e => setFilters({ ...filters, program: e.target.value })}><option value="All">{translateUI("ui.all_6a7208")}</option>{programs.map(program => <option key={program} value={program}>{program === 'No program' ? translateUI("ui.no_program_d8600a") : program}</option>)}</Select></Field>
        <Field label={translateUI("ui.search_bce064")}><input value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })} placeholder={translateUI("ui.course_code_title_or_faculty_1878e5")} /></Field>
        <StableButton className="btn ghost reset" onClick={() => setFilters({ program: 'All', q: '' })}>{translateUI("ui.reset_44c57a")}</StableButton>
      </div>
      {archivedRows.length > 0 && <label className="syl-archive-toggle"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />{translateUI("syllabi.showArchived", { count: archivedRows.length })}</label>}
      <div className="repo-stats"><span>{translateUI("ui.approved_afd61f")}<b>{rows.length}</b></span></div>
      <div className="table-card repository-table">
        <table>
          <colgroup>
            <col className="repo-course" /><col className="repo-program" /><col className="repo-faculty" />
            <col className="repo-status" /><col className="repo-updated" /><col className="repo-actions" />
          </colgroup>
          <thead><tr><th scope="col">{translateUI("ui.course_d82b56")}</th><th scope="col">{translateUI("ui.program_9d6800")}</th><th scope="col">{translateUI("ui.faculty_9ae050")}</th><th scope="col">{translateUI("ui.status_bae7d5")}</th><th scope="col">{translateUI("ui.updated_f2f857")}</th><th scope="col">{translateUI("ui.actions_c3cd63")}</th></tr></thead>
          <tbody>{rows.map(x => <tr key={x.id}>
            <td><strong>{x.courseCode}</strong><small>{x.title}</small></td>
            <td>{repositoryProgram(x) === 'No program' ? translateUI("ui.no_program_d8600a") : repositoryProgram(x)}</td>
            <td><span className="user-cell"><Avatar userId={x.userId} src={x.ownerAvatarUrl} name={x.faculty} /><span>{x.faculty}</span></span></td>
            <td><span className="syl-tags"><span className={`status ${x.status}`}>{translateUI("ui.approved_afd61f")}</span>{x.archived && <span className="status archived">{translateUI("syllabi.archivedTag")}</span>}</span></td>
            <td>{fmt(x.updatedAt)}</td>
            <td><div className="repository-actions">{canChat(x, user) && !x.archived && <button className="table-action" aria-label={translateUI("ui.open_chat_for_p0_633dd9", { p0: (x.courseCode) })} onClick={() => setChatCode(x.id)}>✉</button>}<button className="table-action" aria-label={translateUI("ui.view_history_for_p0_46396f", { p0: (x.courseCode) })} onClick={() => setHistCode(x.id)}>◷</button></div></td>
          </tr>)}</tbody>
        </table>
        {isFaculty && repository.error && <div className="empty" role="alert">{translateUI("ui.unable_to_load_approved_syllabi_cd0cc5")}{tr(repository.error)}</div>}
        {rows.length === 0 && !(isFaculty && repository.error) && <div className="empty">{isFaculty && repository.loading ? translateUI("ui.loading_approved_syllabi_3ad229") : isFaculty && mySyllabi.length === 0 ? translateUI("ui.no_approved_syllabi_yet_your_syllabus_will_appear_here_once_an_ad_b167c3") : translateUI("ui.no_syllabi_match_your_filters_e09598")}</div>}
      </div>
    </>
  );
}
