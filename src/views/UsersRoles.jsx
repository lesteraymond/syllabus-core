import { useState, useEffect } from 'react';
import { Avatar, PageHead } from '../components/ui';
import { users as usersApi } from '../lib/api';
import AssignmentsPanel from './AssignmentsPanel';

const ROLE_LABELS = { admin: 'Dean / Administrator', faculty: 'Faculty' };
const ROLE_PERMISSIONS = {
  admin: 'Full access',
  faculty: 'Create + Submit',
};
const EMPTY_FORM = { email: '', password: '', firstName: '', lastName: '', role: 'faculty' };

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
      await usersApi.create(form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      fetchUsers();
      notify('User pre-registered. They can now sign in with Google.');
    } catch (err) { notify('Failed: ' + err.message); }
  };

  const removeUser = async (p) => {
    if (!window.confirm('Remove ' + p.firstName + ' ' + p.lastName + '? They will no longer be able to sign in, and their syllabi will be deleted.')) return;
    try {
      await usersApi.remove(p.id);
      fetchUsers();
      notify('User removed.');
    } catch (err) { notify('Failed: ' + err.message); }
  };

  return (
    <>
      <PageHead title="Users & Roles" subtitle="Only users listed here can sign in. Remove a user to revoke their access." actions={<button className="btn primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Pre-register User'}</button>} />
      {showForm && (
        <form onSubmit={addUser} className="user-form-grid">
            <div className="user-field">
              <label htmlFor="user-first-name" className="user-label">First Name</label>
              <input id="user-first-name" className="user-input" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder="Juan" required />
            </div>
            <div className="user-field">
              <label htmlFor="user-last-name" className="user-label">Last Name</label>
              <input id="user-last-name" className="user-input" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} placeholder="Santos" required />
            </div>
            <div className="user-field">
              <label htmlFor="user-email" className="user-label">Institutional Email</label>
              <input id="user-email" className="user-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@email.lcup.edu.ph" required />
            </div>
            <div className="user-field">
              <label htmlFor="user-password" className="user-label">Initial Password</label>
              <input id="user-password" className="user-input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" required />
            </div>
            <div className="user-field">
              <label htmlFor="user-role" className="user-label">Role</label>
              <select id="user-role" className="user-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="faculty">Faculty</option><option value="admin">Dean / Administrator</option></select>
            </div>
          <div className="user-field user-field-action">
            <button className="user-save-btn" type="submit">Save</button>
          </div>
        </form>
      )}
      <div className="table-card">
        <div className="overflow-x-auto w-full">
          <table><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Permissions</th><th></th></tr></thead><tbody>{people.map(p => <tr key={p.id}><td><span className="user-cell"><Avatar src={p.avatarUrl} name={`${p.firstName} ${p.lastName}`} /><strong>{p.firstName} {p.lastName}</strong></span></td><td><small>{p.email}</small></td><td>{ROLE_LABELS[p.role] || p.role}</td><td>{ROLE_PERMISSIONS[p.role] || 'Unknown'}</td><td><span className="user-actions">{p.role === 'faculty' && <button className="btn outline" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setAssigning(p)}>Assignments</button>}<button className="btn danger" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => removeUser(p)}>Remove</button></span></td></tr>)}</tbody></table>
        </div>
        {people.length === 0 && <div className="empty">No users found.</div>}
      </div>
      {assigning && <AssignmentsPanel person={assigning} notify={notify} onManageSubjects={onManageSubjects} onClose={() => setAssigning(null)} />}
    </>
  );
}
