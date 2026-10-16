import StableButton from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useState, useEffect } from 'react';
import { Avatar, PageHead } from '../components/ui';
import { users as usersApi } from '../lib/api';
import AssignmentsPanel from './AssignmentsPanel';
import { ROLE_LABELS } from '../lib/roles';
import Select from '../components/Select';

const ROLE_PERMISSIONS = {
  admin: 'Full access',
  faculty: 'Create + Submit',
};
// What to tell the admin when an email did not go out (the server sends a short reason, never anything secret).
const MAIL_PROBLEM = {
  not_configured: "Email isn't set up on the server yet: add the SMTP settings to server/.env and restart it.",
  auth: 'The mail server rejected the username or password in server/.env.',
  unreachable: 'The mail server could not be reached. Check SMTP_HOST and SMTP_PORT in server/.env.',
  failed: 'The email could not be sent. See the server log for the reason.',
};
const mailProblem = (reason) => MAIL_PROBLEM[reason] || MAIL_PROBLEM.failed;
const EMPTY_FORM = { email: '', firstName: '', lastName: '', role: 'faculty' };

export default function UsersRoles({ notify, onManageSubjects }) {
  const [people, setPeople] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [assigning, setAssigning] = useState(null); // the faculty member whose assignments are open

  const fetchUsers = () => usersApi.list().then(setPeople).catch(() => {});

  useEffect(() => { fetchUsers(); }, []);

  const addUser = async (e) => {
    e.preventDefault();
    try {
      const made = await usersApi.create(form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      fetchUsers();
      notify(made.emailSent
        ? translateUI("ui.user_created_their_username_and_a_temporary_password_were_sent_to_c6e730") + made.email + '.'
        : translateUI("ui.user_created_but_no_email_was_sent_161a02") + tr(mailProblem(made.emailReason)) + translateUI("ui.use_resend_credentials_once_it_works_7a3632"));
    } catch (err) { notify(translateUI("ui.failed_9500be") + err.message); }
  };

  const resend = async (p) => {
    if (!window.confirm(tr('Send ' + p.firstName + ' ' + p.lastName + ' a new temporary password? It replaces their current password, and they must choose their own at the next sign-in.'))) return;
    try {
      const r = await usersApi.resendCredentials(p.id);
      notify(r.emailSent ? translateUI("ui.new_credentials_sent_to_cca8dd") + r.email + '.' : translateUI("ui.nothing_was_changed_the_email_could_not_be_sent_3b7ba4") + tr(mailProblem(r.emailReason)));
    } catch (err) { notify(translateUI("ui.failed_9500be") + err.message); }
  };

  const removeUser = async (p) => {
    if (!window.confirm(tr('Remove ' + p.firstName + ' ' + p.lastName + '? They will no longer be able to sign in, and their syllabi will be deleted.'))) return;
    try {
      await usersApi.remove(p.id);
      fetchUsers();
      notify(translateUI("ui.user_removed_f2fdb9"));
    } catch (err) { notify(translateUI("ui.failed_9500be") + err.message); }
  };

  return (
    <>
      <PageHead title={translateUI("ui.users_roles_972dae")} subtitle={translateUI("ui.only_users_listed_here_can_sign_in_remove_a_user_to_revoke_their__f115b1")} actions={<StableButton className="btn primary" onClick={() => setShowForm(!showForm)}>{showForm ? translateUI("ui.cancel_77dfd2") : translateUI("ui.pre_register_user_2fa046")}</StableButton>} />
      {showForm && (
        <form onSubmit={addUser} className="user-form-grid">
            <div className="user-field">
              <label htmlFor="user-first-name" className="user-label">{translateUI("ui.first_name_b6ea99")}</label>
              <input id="user-first-name" className="user-input" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder={translateUI("ui.juan_c5652d")} required />
            </div>
            <div className="user-field">
              <label htmlFor="user-last-name" className="user-label">{translateUI("ui.last_name_863cb3")}</label>
              <input id="user-last-name" className="user-input" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} placeholder={translateUI("ui.santos_cdb56f")} required />
            </div>
            <div className="user-field">
              <label htmlFor="user-email" className="user-label">{translateUI("ui.institutional_email_29be78")}</label>
              <input id="user-email" className="user-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder={translateUI("ui.name_email_lcup_edu_ph_2475c2")} pattern=".+@email\.lcup\.edu\.ph" title={translateUI("ui.an_institutional_address_ending_in_email_lcup_edu_ph_6749cb")} required />
            </div>
            <div className="user-field">
              <label htmlFor="user-role" className="user-label">{translateUI("ui.role_c3f104")}</label>
              <Select id="user-role" className="user-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="faculty">{tr(ROLE_LABELS.faculty)}</option><option value="admin">{tr(ROLE_LABELS.admin)}</option></Select>
            </div>
          <div className="user-field user-field-action">
            <button className="user-save-btn" type="submit">{translateUI("ui.save_efc007")}</button>
          </div>
          <p className="pw-note">{translateUI("ui.a_temporary_password_is_generated_and_emailed_to_the_user_with_th_9bb144")}</p>
        </form>
      )}
      <div className="table-card">
        <div className="overflow-x-auto w-full">
          <table><thead><tr><th>{translateUI("ui.user_9f8a23")}</th><th>{translateUI("ui.email_84add5")}</th><th>{translateUI("ui.role_c3f104")}</th><th>{translateUI("ui.permissions_d06d55")}</th><th></th></tr></thead><tbody>{people.map(p => <tr key={p.id}><td><span className="user-cell"><Avatar src={p.avatarUrl} name={`${p.firstName} ${p.lastName}`} /><strong>{p.firstName} {p.lastName}</strong></span></td><td><small>{p.email}</small></td><td>{tr(ROLE_LABELS[p.role] || p.role)}</td><td>{tr(ROLE_PERMISSIONS[p.role] || translateUI("ui.unknown_bc7819"))}</td><td><span className="user-actions">{p.role === 'faculty' && <StableButton className="btn outline" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setAssigning(p)}>{translateUI("ui.assignments_057d58")}</StableButton>}{ROLE_LABELS[p.role] && <StableButton className="btn outline" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => resend(p)}>{translateUI("ui.resend_credentials_1ba6fd")}</StableButton>}<StableButton className="btn danger" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => removeUser(p)}>{translateUI("ui.remove_e96390")}</StableButton></span></td></tr>)}</tbody></table>
        </div>
        {people.length === 0 && <div className="empty">{translateUI("ui.no_users_found_e611ef")}</div>}
      </div>
      {assigning && <AssignmentsPanel person={assigning} notify={notify} onManageSubjects={onManageSubjects} onClose={() => setAssigning(null)} />}
    </>
  );
}
