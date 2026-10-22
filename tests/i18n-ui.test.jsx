import Login from '../src/components/Login';
import ReviewStep from '../src/views/builder2/ReviewStep';
import ComplianceModal from '../src/components/ComplianceModal';
import MySyllabi from '../src/views/MySyllabi';
import ClosStep from '../src/views/builder2/ClosStep';
import FormPaper from '../src/views/builder2/FormPaper';
import { createModel, emptyDraft } from '../src/lib/syllabusModel';
import ProgramManagement, { DeletionImpact, ProgramDialog } from '../src/components/ProgramManagement';
import StableButton from '../src/components/StableButton';
import { t } from '../src/i18n';
import { dayPeriod } from '../src/lib/phTime';
import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Settings from '../src/views/Settings';
import AdministrativeSettings from '../src/components/AdministrativeSettings';
import Sidebar from '../src/components/Sidebar';
import { Icon, Avatar } from '../src/components/ui';
import CheckHistory from '../src/components/CheckHistory';
import Compliance from '../src/views/Compliance';
import Select, { readOptions } from '../src/components/Select';
import { SubjectDialog, SubjectRowActions } from '../src/components/SubjectActions';
import { DeadlineChip, DeadlineDialog, DeadlineProgress } from '../src/components/DeadlineDialog';
import UpcomingDeadlines, { DeadlineRows } from '../src/components/UpcomingDeadlines';
import TimeUsageCard, { Ready as TimeUsageReady } from '../src/components/TimeUsageCard';
import { recordAvatar, resetAvatars } from '../src/lib/avatarStore';
import Topbar from '../src/components/Topbar';
import Dashboard from '../src/views/DashboardView';
import Repository, { repositoryProgram } from '../src/views/Repository';
import { navItems } from '../src/data/initialData';
import { setLanguage } from '../src/i18n';
const user = { id: 1, role: 'faculty', email: 'person@example.invalid', firstName: 'Approved', lastName: 'Settings', name: 'Approved Settings', initials: 'AS' };
const noop = () => {};
const props = { user, notify: noop, onAvatarChange: noop, onProfileChange: noop, language: 'en', languageBusy: false, onLanguageChange: noop };
const admin = { template: 'Undergraduate Syllabus v4', academicYear: '2026–2027', department: 'Original English Department', aiChecking: true, strictValidation: false, emailNotifications: true };
test.afterEach(() => setLanguage('en'));
test('faculty settings include profile and language, with no administrative cards or save action', () => {
  const html = renderToStaticMarkup(<Settings {...props} />);
  assert.match(html, /My Profile/); assert.match(html, /Display language/);
  assert.doesNotMatch(html, /Institutional Standard|AI &amp; Notifications|Save Settings|Loading administrator/);
  assert.match(html, /<span class="select-current" lang="en">English<\/span>/);
});
test('administrator settings load only in the administrator branch and keep real setting values', () => {
  const parent = renderToStaticMarkup(<Settings {...props} user={{ ...user, role: 'admin' }} />);
  assert.match(parent, /Loading administrator settings/);
  const html = renderToStaticMarkup(<AdministrativeSettings administration={admin} adminBusy={false} updateAdmin={noop} />);
  assert.match(html, /Institutional Standard/); assert.match(html, /AI &amp; Notifications/);
  assert.match(html, /<output class="static-value">Undergraduate Syllabus v4<\/output>/); assert.match(html, /value="2026–2027"/); assert.doesNotMatch(html, /role="combobox"/);
});
test('Tagalog settings translate labels, keep account names and setting values, and expose saving accessibly', () => {
  setLanguage('tl');
  const html = renderToStaticMarkup(<Settings {...props} language="tl" languageBusy />);
  assert.match(html, /Mga Setting/); assert.match(html, /Aking Profile/); assert.match(html, /Baguhin ang Profile/);
  assert.match(html, /value="Approved"/); assert.match(html, /value="Settings"/);
  assert.match(html, /<span class="select-current" lang="tl">Tagalog<\/span>/); assert.match(html, /Isine-save ang napiling wika/);
  assert.match(html, /aria-live="polite"/);
  const cards = renderToStaticMarkup(<AdministrativeSettings administration={admin} adminBusy={false} updateAdmin={noop} />);
  assert.match(cards, /Pamantayan ng Institusyon/); assert.match(cards, /AI at mga Abiso/);
  assert.match(cards, /Pamantayang ginagamit sa pagsusuri/); assert.match(cards, /<output class="static-value">Undergraduate Syllabus v4<\/output>/);
  assert.match(cards, /Original English Department/);
});
test('navigation, dashboard summaries and roles switch language while account names stay original', () => {
  setLanguage('tl');
  const nav = renderToStaticMarkup(<Sidebar page="settings" setPage={noop} nav={navItems} collapsed={false} onToggle={noop} />);
  assert.match(nav, /Pangkalahatang Tanaw/); assert.match(nav, /Mga Setting/); assert.match(nav, /Tagabuo ng Silabus/);
  const dashboard = renderToStaticMarkup(<Dashboard user={user} syllabi={[]} logs={[]} setPage={noop} clearLogs={noop} setConfirm={noop} />);
  assert.match(dashboard, /Aking mga naipasa/); assert.match(dashboard, /Kabuuang na-upload/);
  const topbar = renderToStaticMarkup(<Topbar user={user} page="settings" unread={0} threads={[]} msgDrop={false} onLogout={noop} setMsgDrop={noop} notifications={{ unreadCount: 0, items: [] }} />);
  assert.match(topbar, /Approved Settings/); assert.match(topbar, /Guro/); assert.match(topbar, /Mag-sign out/);
});
test('dashboard typewriter greetings use the current saved account name for both roles and languages', () => {
  const render = account => renderToStaticMarkup(<Dashboard user={account} syllabi={[]} logs={[]} setPage={noop} clearLogs={noop} setConfirm={noop} />);
  // The greeting depends on the Manila time of day, so the expected words come from the same period.
  const period = dayPeriod();
  const en = { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' }[period];
  const tl = { morning: 'Magandang umaga', afternoon: 'Magandang hapon', evening: 'Magandang gabi' }[period];
  for (const role of ['faculty', 'admin']) {
    setLanguage('en');
    const before = render({ ...user, role });
    assert.ok(before.includes(`class="typewriter-accessible">${en}, Approved!</span>`));
    const renamed = { ...user, role, firstName: 'Ana', lastName: 'Cruz', name: 'Ana Cruz' };
    const after = render(renamed);
    assert.ok(after.includes(`class="typewriter-accessible">${en}, Ana!</span>`));
    assert.doesNotMatch(after, new RegExp(`${en}, Approved!|${en}, Ana Cruz!`));
    setLanguage('tl');
    assert.ok(render({ ...user, role }).includes(`${tl}, Approved!`));
    assert.ok(render(renamed).includes(`${tl}, Ana!`));
    setLanguage('en');
    assert.ok(render({ ...renamed, firstName: '  Ana Maria  ' }).includes(`${en}, Ana Maria!`));
    assert.ok(render({ ...renamed, firstName: undefined }).includes(`class="typewriter-accessible">${en}!</span>`));
    assert.ok(render({ ...user, role, name: '', firstName: '', lastName: '' }).includes(`class="typewriter-accessible">${en}!</span>`));
    assert.ok(render({ ...renamed, firstName: '<Ana & Maria>' }).includes(`${en}, &lt;Ana &amp; Maria&gt;!`));
  }
});

test('the admin dashboard shows its own five summary cards; faculty keeps theirs', () => {
  setLanguage('en');
  const render = role => renderToStaticMarkup(<Dashboard user={{ ...user, role }} syllabi={[{ id: 1, userId: 9, status: 'submitted' }, { id: 2, userId: 9, status: 'approved' }]} logs={[]} setPage={noop} clearLogs={noop} setConfirm={noop} />);
  const admin = render('admin');
  assert.equal((admin.match(/class="stat-card"/g) || []).length, 5);
  for (const label of ['Programs', 'Subjects', 'Under review', 'Approved', 'For revision']) assert.match(admin, new RegExp('<span>' + label + '</span>'));
  assert.doesNotMatch(admin, /AI compliance score|Total courses|Submitted syllabi/i);
  const faculty = render('faculty');
  assert.match(faculty, /My submissions/); assert.match(faculty, /AI compliance score/);
});
test('the brand dashboard icons draw in the theme colour at the requested size and are hidden from screen readers by default', () => {
  for (const name of ['program', 'subject', 'underReview', 'approved', 'revise']) {
    const html = renderToStaticMarkup(<Icon name={name} size={20} weight="regular" />);
    assert.match(html, /width="20" height="20"/, name); assert.match(html, /aria-hidden="true"/, name);
    assert.match(html, /currentColor/, name); assert.doesNotMatch(html, /#000|weight=/, name);
  }
  assert.match(renderToStaticMarkup(<Icon name="approved" label="Approved" />), /role="img" aria-label="Approved"/);
});
test('the check history keeps one button per check, with its spoken label, and still pages', () => {
  setLanguage('en');
  const run = (i, over = {}) => ({ runId: 'r' + i, scored: true, overall: 86, passed: true, courseCode: 'IT 20' + i, versionLabel: 'v2', courseTitle: 'Data Structures', facultyName: 'Ana Cruz', programCode: 'BSIT', createdAt: '2026-10-01T02:00:00Z', status: 'approved', checkedBy: 'admin', ...over });
  const runs = Array.from({ length: 14 }, (_, i) => run(i));
  runs[1] = run(1, { overall: null, scored: false, passed: false });
  const html = renderToStaticMarkup(<CheckHistory runs={runs} onOpen={noop} onApply={noop} onReset={noop} />);
  assert.equal((html.match(/class="hist-item /g) || []).length, 12);
  assert.match(html, /class="hist-item good"/); assert.match(html, /class="hist-item none"/);
  assert.match(html, /aria-label="IT 200, Ana Cruz, 86 percent, Meets the standard/);
  assert.match(html, /Show more/);
});
test('every picture of the same user changes together when a new photo is recorded', () => {
  resetAvatars();
  const row = <><Avatar userId={5} src="/api/users/5/avatar?v=1000" name="Fay" /><Avatar className="chat-av" userId={5} src="/api/users/5/avatar?v=1000" name="Fay" /><Avatar src="/api/users/5/avatar?v=1000" name="Fay" /></>;
  assert.equal((renderToStaticMarkup(row).match(/<img[^>]*avatar\?v=1000/g) || []).length, 3);
  recordAvatar(5, '/api/users/5/avatar?v=2000', 2000);
  const after = renderToStaticMarkup(row);
  assert.equal((after.match(/<img[^>]*avatar\?v=2000/g) || []).length, 3); assert.doesNotMatch(after, /<img[^>]*v=1000/);
  recordAvatar(5, null, 3000);
  assert.doesNotMatch(renderToStaticMarkup(row), /<img/);
  resetAvatars();
});
test('the compliance cards show the own photo of each faculty member, or initials, and never merge two people with the same name', () => {
  resetAvatars(); setLanguage('en');
  const rows = [
    { id: 1, userId: 5, faculty: 'Ana Cruz', ownerAvatarUrl: '/api/users/5/avatar?v=10', status: 'approved' },
    { id: 2, userId: 5, faculty: 'Ana Cruz', ownerAvatarUrl: '/api/users/5/avatar?v=10', status: 'submitted' },
    { id: 3, userId: 6, faculty: 'Ana Cruz', ownerAvatarUrl: null, status: 'approved' },
  ];
  const html = renderToStaticMarkup(<Compliance syllabi={rows} />);
  assert.equal((html.match(/class="comp-card"/g) || []).length, 2);
  assert.equal((html.match(/<img[^>]*class="comp-av"/g) || []).length, 1);
  assert.match(html, /<img[^>]*avatar\?v=10/);
  assert.match(html, /<span class="comp-av">AC<\/span>/);
  recordAvatar(6, '/api/users/6/avatar?v=99', 99);
  assert.equal((renderToStaticMarkup(<Compliance syllabi={rows} />).match(/<img[^>]*class="comp-av"/g) || []).length, 2);
  resetAvatars();
});
test('the time usage card shows today, a bar per day and the averages, in English and Tagalog, and a calm state before any data', () => {
  const day = (n, seconds) => ({ date: '2026-10-' + String(8 + n).padStart(2, '0'), seconds });
  const data = { enabled: true, today: '2026-10-14', days: [day(0, 0), day(1, 3600), day(2, 1800), day(3, 0), day(4, 7200), day(5, 600), day(6, 8040)], todaySeconds: 8040, totalSeconds: 21240, activeDays: 5, avgPerActiveDay: 4248, avgSessionSeconds: 2124, busiest: { date: '2026-10-12', seconds: 7200 }, hasData: true };
  setLanguage('en');
  const en = renderToStaticMarkup(<TimeUsageReady data={data} days={7} onDays={noop} locale="en" />);
  assert.match(en, /2h 14m/); assert.match(en, /Active today/); assert.match(en, /Average session/);
  assert.equal((en.match(/<rect /g) || []).length, 7); assert.match(en, /class="usage-bar today"/);
  assert.equal((en.match(/class="usage-day"/g) || []).length, 7);
  assert.match(en, /aria-label="Fri Oct 9: 1h" aria-describedby=/);
  assert.equal((en.match(/role="tooltip"/g) || []).length, 7);
  assert.match(en, /role="tooltip" class="usage-tooltip"[^>]*>1h<\/span>/);
  assert.match(en, /class="usage-tooltip" data-align="start"/);
  assert.match(en, /class="usage-tooltip" data-align="end"/);
  assert.doesNotMatch(en, /class="usage-detail"/);
  assert.match(en, /5 of 7/); assert.match(en, /aria-pressed="true"[^>]*>7 days/);
  assert.match(en, /role="img" aria-label="Active time per day\. /);
  setLanguage('tl');
  const tl = renderToStaticMarkup(<TimeUsageReady data={data} days={7} onDays={noop} locale="fil" />);
  assert.match(tl, /Aktibo ngayon/); assert.match(tl, /5 sa 7/); assert.match(tl, /7 araw/);
  assert.match(tl, /Itapat ang pointer sa bar upang makita ang kabuuang oras at minuto ng paggamit/);
  setLanguage('en');
  assert.match(renderToStaticMarkup(<TimeUsageReady data={{ ...data, hasData: false, todaySeconds: 0, totalSeconds: 0, activeDays: 0, avgPerActiveDay: 0, avgSessionSeconds: 0, busiest: null, days: data.days.map(d => ({ ...d, seconds: 0 })) }} days={7} onDays={noop} locale="en" />), /Your active time will appear here/);
  assert.match(renderToStaticMarkup(<TimeUsageCard />), /Loading your time usage/);
});
test('the dropdown reads ordinary <option> children: values, text, disabled, lang, fragments and options with no value attribute', () => {
  const options = readOptions(<><option value="">Choose</option><option value="a" lang="tl">Alpha {1}</option><>{[<option key="x" disabled>Plain</option>]}</><option value={7}>Seven</option></>);
  assert.deepEqual(options, [
    { value: '', label: 'Choose', disabled: false, lang: undefined },
    { value: 'a', label: 'Alpha 1', disabled: false, lang: 'tl' },
    { value: 'Plain', label: 'Plain', disabled: true, lang: undefined },
    { value: '7', label: 'Seven', disabled: false, lang: undefined },
  ]);
});
test('the closed dropdown is a labelled combobox button that shows the chosen option and keeps every value', () => {
  const html = renderToStaticMarkup(<Select id="role" className="user-input" aria-label="Role" value="admin" onChange={noop}><option value="faculty">Faculty</option><option value="admin">Administrator</option></Select>);
  assert.doesNotMatch(html, /<select|<option/);
  assert.match(html, /<button type="button" id="role" role="combobox" class="select-trigger user-input"/);
  assert.match(html, /aria-haspopup="listbox" aria-expanded="false"/); assert.match(html, /aria-label="Role"/);
  assert.match(html, /<span class="select-current">Administrator<\/span>/);
  assert.match(html, /<span data-value="faculty">Faculty<\/span><span data-value="admin">Administrator<\/span>/);
  assert.doesNotMatch(html, /select-panel|role="listbox"/);
});
test('an uncontrolled dropdown starts on its first option or its defaultValue, and a disabled one is disabled', () => {
  const two = [<option key="a" value="a">First</option>, <option key="b" value="b">Second</option>];
  assert.match(renderToStaticMarkup(<Select>{two}</Select>), /<span class="select-current">First<\/span>/);
  assert.match(renderToStaticMarkup(<Select defaultValue="b">{two}</Select>), /<span class="select-current">Second<\/span>/);
  assert.match(renderToStaticMarkup(<Select value="zzz" onChange={noop}>{two}</Select>), /<span class="select-current"><\/span>/);
  assert.match(renderToStaticMarkup(<Select disabled value="a" onChange={noop}>{two}</Select>), /<button[^>]*disabled=""/);
  assert.match(renderToStaticMarkup(<Select name="program" value="b" onChange={noop}>{two}</Select>), /<input type="hidden" name="program" value="b"\/>/);
});
test('the subjects table filter is labelled in both languages, and the label is not the program word', () => {
  setLanguage('en'); assert.equal(t('subjects.byProgram'), 'Subjects by program');
  setLanguage('tl'); assert.equal(t('subjects.byProgram'), 'Mga asignatura ayon sa programa');
  setLanguage('en');
});
test('each subject row has an edit and a delete button named after the subject, in both languages', () => {
  const subject = { id: 3, code: 'IT 204', title: 'Data Structures' };
  setLanguage('en');
  const en = renderToStaticMarkup(<SubjectRowActions subject={subject} onEdit={noop} onDelete={noop} />);
  assert.equal((en.match(/<button /g) || []).length, 2);
  assert.match(en, /class="icon-btn"[^>]*aria-label="Edit subject IT 204"/); assert.match(en, /class="icon-btn is-delete"[^>]*aria-label="Delete subject IT 204"/);
  setLanguage('tl');
  assert.match(renderToStaticMarkup(<SubjectRowActions subject={subject} onEdit={noop} onDelete={noop} />), /aria-label="Burahin ang asignaturang IT 204"/);
  setLanguage('en');
});
test('the subject dialogs: edit has the code and title fields, delete is an alert dialog that warns about syllabi', () => {
  const subject = { id: 3, code: 'IT 204', title: 'Data Structures' };
  setLanguage('en');
  const edit = renderToStaticMarkup(<SubjectDialog subject={subject} mode="edit" onClose={noop} onComplete={noop} />);
  assert.match(edit, /role="dialog"/); assert.match(edit, /Edit subject IT 204/);
  assert.match(edit, /value="IT 204"/); assert.match(edit, /value="Data Structures"/); assert.match(edit, /maxLength="50"/); assert.match(edit, /maxLength="255"/);
  assert.match(edit, /class="btn primary"/); assert.doesNotMatch(edit, /class="btn danger"/);
  const del = renderToStaticMarkup(<SubjectDialog subject={subject} mode="delete" onClose={noop} onComplete={noop} />);
  assert.match(del, /role="alertdialog"/); assert.match(del, /Delete subject IT 204/);
  assert.match(del, /Syllabi that use it keep the outcomes they were saved with/); assert.match(del, /class="btn danger"/);
  assert.doesNotMatch(del, /<input/);
  setLanguage('tl');
  assert.match(renderToStaticMarkup(<SubjectDialog subject={subject} mode="delete" onClose={noop} onComplete={noop} />), /Burahin ang asignaturang IT 204/);
  setLanguage('en');
});
const dl = (over = {}, summary = { total: 5, submitted: 2, late: 1, waiting: 2, failed: 0 }) => ({ id: 7, courseId: 3, term: '2026-2027 · 1st Semester', dueAt: '2099-10-30T08:00:00.000Z', opensAt: '2026-10-01T00:00:00.000Z', instructions: '', summary, unassigned: false, ...over });
test('the deadline chip invites setting one, then shows the date and how many have submitted, in both languages', () => {
  const subject = { id: 3, code: 'IT 204', title: 'Data Structures' };
  setLanguage('en');
  const none = renderToStaticMarkup(<DeadlineChip subject={subject} deadline={null} onOpen={noop} />);
  assert.match(none, /class="dl-chip tone-set"/); assert.match(none, /aria-label="Set a deadline for IT 204"/); assert.match(none, />Set deadline</);
  const set = renderToStaticMarkup(<DeadlineChip subject={subject} deadline={dl()} onOpen={noop} />);
  assert.match(set, /class="dl-chip tone-upcoming"/); assert.match(set, /Oct 30, 2099/); assert.match(set, /3 of 5 submitted/);
  assert.match(set, /aria-label="Deadline for IT 204: Oct 30, 2099, 3 of 5 submitted"/);
  assert.match(renderToStaticMarkup(<DeadlineChip subject={subject} deadline={dl({}, { total: 5, submitted: 2, late: 0, waiting: 1, failed: 2 })} onOpen={noop} />), /tone-failed/);
  const settled = renderToStaticMarkup(<DeadlineChip subject={subject} deadline={dl({}, { total: 3, submitted: 2, late: 1, waiting: 0, failed: 0 })} onOpen={noop} />);
  assert.match(settled, /tone-done/); assert.match(settled, /Settled/);
  assert.match(renderToStaticMarkup(<DeadlineChip subject={subject} deadline={dl({}, { total: 2, submitted: 2, late: 0, waiting: 0, failed: 0 })} onOpen={noop} />), /tone-done/);
  assert.match(renderToStaticMarkup(<DeadlineChip subject={subject} deadline={dl({}, { total: 0, submitted: 0, late: 0, waiting: 0, failed: 0 })} onOpen={noop} />), /tone-none[\s\S]*No faculty assigned/);
  setLanguage('tl');
  assert.match(renderToStaticMarkup(<DeadlineChip subject={subject} deadline={dl()} onOpen={noop} />), /3 sa 5 ang nakapagpasa/);
  setLanguage('en');
});
test('the deadline dialog: a new one asks for the term and due time; an existing one adds the term list, cancel, and the faculty progress', () => {
  const subject = { id: 3, code: 'IT 204', title: 'Data Structures' };
  setLanguage('en');
  const fresh = renderToStaticMarkup(<DeadlineDialog subject={subject} deadlines={[]} onClose={noop} onChanged={noop} />);
  assert.match(fresh, /Deadline for IT 204/); assert.match(fresh, /Due date and time \(Philippine Time\)/); assert.match(fresh, /type="datetime-local"/);
  assert.match(fresh, /Save deadline/); assert.match(fresh, /maxLength="1000"/); assert.match(fresh, /Late submissions are still accepted/);
  assert.doesNotMatch(fresh, /Cancel deadline|Faculty progress|dl-term/);
  assert.match(fresh, /data-value="1st Semester"/); assert.match(fresh, /data-value="2nd Semester"/); assert.match(fresh, /data-value="Summer"/);
  assert.match(fresh, /data-value="2026-2027"/);
  const existing = renderToStaticMarkup(<DeadlineDialog subject={subject} deadlines={[dl(), dl({ id: 8, term: '2026-2027 · 2nd Semester' })]} onClose={noop} onChanged={noop} />);
  assert.match(existing, /dl-term/); assert.match(existing, /data-value="new">New term</); assert.match(existing, /Cancel deadline/);
  assert.match(existing, /Faculty progress/); assert.match(existing, /Loading progress/);
  assert.match(existing, /value="2099-10-30T16:00"/, 'the due time is shown in Philippine time');
  setLanguage('tl');
  const tl = renderToStaticMarkup(<DeadlineDialog subject={subject} deadlines={[dl()]} onClose={noop} onChanged={noop} />);
  assert.match(tl, /Takdang petsa para sa IT 204/); assert.match(tl, /Oras sa Pilipinas/); assert.match(tl, /Kanselahin ang takdang petsa/); assert.match(tl, /Pag-usad ng mga guro/);
  setLanguage('en');
});
test('the Upcoming Deadlines card shows a faculty member their own status per subject, most urgent first, in both languages', () => {
  const mineList = [
    { id: 1, term: 'T', dueAt: '2099-10-30T08:00:00.000Z', status: 'submitted', course: { code: 'CS 101', title: 'Algorithms', program: 'BSCS' } },
    { id: 2, term: 'T', dueAt: '2099-11-05T08:00:00.000Z', status: 'failed', course: { code: 'IT 204', title: 'Data Structures', program: 'BSIT' } },
    { id: 3, term: 'T', dueAt: '2099-12-01T08:00:00.000Z', status: 'upcoming', course: { code: 'IT 305', title: 'Networks', program: 'BSIT' } },
  ];
  setLanguage('en');
  const html = renderToStaticMarkup(<DeadlineRows list={mineList} faculty onOpen={noop} />);
  assert.equal((html.match(/class="deadline dl-row/g) || []).length, 3);
  assert.ok(html.indexOf('IT 204') < html.indexOf('IT 305') && html.indexOf('IT 305') < html.indexOf('CS 101'), 'failed, then upcoming, then submitted');
  assert.match(html, /<span class="status dl-failed">Failed to submit<\/span>/); assert.match(html, /<span class="status dl-submitted">Submitted<\/span>/);
  assert.match(html, /Due Oct 30, 2099, 4:00 PM/); assert.match(html, /<b>30<\/b><span>Oct<\/span>/);
  assert.match(html, /deadline dl-row is-failed/);
  setLanguage('tl');
  assert.match(renderToStaticMarkup(<DeadlineRows list={mineList} faculty onOpen={noop} />), /Hindi nakapagpasa/);
  setLanguage('en');
});
test('the Upcoming Deadlines card shows an administrator how many have submitted and how many failed', () => {
  const summary = (failed, waiting, submitted, total) => ({ total, failed, waiting, submitted, late: 0 });
  const list = [
    { id: 1, term: 'T', dueAt: '2099-10-30T08:00:00.000Z', summary: summary(0, 2, 3, 5), course: { code: 'IT 204', title: 'Data Structures', program: 'BSIT' } },
    { id: 2, term: 'T', dueAt: '2099-09-30T08:00:00.000Z', summary: summary(2, 0, 1, 3), course: { code: 'CS 101', title: 'Algorithms', program: 'BSCS' } },
    { id: 3, term: 'T', dueAt: '2099-12-30T08:00:00.000Z', summary: summary(0, 0, 0, 0), course: { code: 'IT 400', title: 'Capstone', program: 'BSIT' } },
  ];
  setLanguage('en');
  const html = renderToStaticMarkup(<DeadlineRows list={list} faculty={false} onOpen={noop} />);
  assert.ok(html.indexOf('CS 101') < html.indexOf('IT 204') && html.indexOf('IT 204') < html.indexOf('IT 400'), 'a missed deadline first, a subject nobody is assigned to last');
  assert.match(html, /1 of 3 submitted/); assert.match(html, /3 of 5 submitted/); assert.match(html, /No faculty assigned/);
  assert.match(html, /<span class="status dl-failed">2 failed<\/span>/);
});
test('the Upcoming Deadlines card says so while loading, instead of showing sample data', () => {
  setLanguage('en');
  const html = renderToStaticMarkup(<UpcomingDeadlines role="faculty" onOpen={noop} />);
  assert.match(html, /Loading progress/); assert.doesNotMatch(html, /Department syllabus submission|5 days remaining/);
});
test('the progress list offers Remind only to faculty who have not submitted, and says when they were last reminded', () => {
  const person = (userId, name, status, extra = {}) => ({ userId, name, status, submittedAt: null, lastNoticeAt: null, ...extra });
  const data = { summary: { total: 4, submitted: 1, late: 1, waiting: 1, failed: 1 }, unassigned: false, people: [
    person(5, 'Fay Cruz', 'failed', { lastNoticeAt: '2026-10-14T07:00:00.000Z' }), person(6, 'Gus Lim', 'upcoming'),
    person(7, 'Hana Reyes', 'submitted', { submittedAt: '2026-10-10T02:00:00.000Z' }), person(8, 'Ivo Santos', 'submitted_late', { submittedAt: '2026-11-01T02:00:00.000Z' }),
  ] };
  setLanguage('en');
  const html = renderToStaticMarkup(<DeadlineProgress state={{ status: 'ready', data }} onRemind={noop} />);
  assert.equal((html.match(/class="icon-btn dl-remind"/g) || []).length, 2, 'only the two who have not submitted');
  assert.match(html, /aria-label="Remind Fay Cruz"/); assert.match(html, /aria-label="Remind Gus Lim"/); assert.doesNotMatch(html, /aria-label="Remind Hana Reyes"/);
  assert.match(html, /Reminded Oct 14, 2026, 3:00 PM/); assert.match(html, /Not submitted yet/); assert.match(html, /Submitted Oct 10, 2026, 10:00 AM/);
  assert.match(html, /Reminder/); assert.doesNotMatch(html, /Reminder[^>]*disabled/);
  assert.match(html, /<span class="status dl-failed">Failed to submit<\/span>/); assert.match(html, /<span class="status dl-submitted_late">Submitted late<\/span>/);
  const allIn = { ...data, people: data.people.filter((p) => p.status.startsWith('submitted')), summary: { total: 2, submitted: 1, late: 1, waiting: 0, failed: 0 } };
  assert.match(renderToStaticMarkup(<DeadlineProgress state={{ status: 'ready', data: allIn }} onRemind={noop} />), /<button type="button" class="btn outline" disabled=""/, 'nothing to remind: the bulk button is off');
  assert.match(renderToStaticMarkup(<DeadlineProgress state={{ status: 'ready', data }} onRemind={noop} reminding message="Reminded 1 by notification and 1 by email." />), /role="status">Reminded 1 by notification/);
  setLanguage('tl');
  const tl = renderToStaticMarkup(<DeadlineProgress state={{ status: 'ready', data }} onRemind={noop} />);
  assert.match(tl, /Paalalahanan si Fay Cruz/); assert.match(tl, /Napaalalahanan noong/); assert.match(tl, /Paalala</);
  setLanguage('en');
});
test('translated repository filters retain canonical option values and original syllabus titles', () => {
  setLanguage('tl');
  const html = renderToStaticMarkup(<Repository user={{ ...user, role: 'admin' }} syllabi={[{ id: 5, userId: 2, status: 'approved', title: 'Settings', courseCode: 'IT 204', faculty: 'Approved', program: 'BSIT', uploadedAt: '2026-01-01' }]} notify={noop} setChatCode={noop} setHistCode={noop} />);
  assert.doesNotMatch(html, /value="approved"|value="submitted"/); assert.match(html, /Aprubado/);
  assert.match(html, /<small>Settings<\/small>/); assert.match(html, /Approved/);
});


test('collapsed navigation keeps every destination accessible in English and Tagalog for both roles', () => {
  for (const language of ['en', 'tl']) {
    setLanguage(language);
    for (const role of ['faculty', 'admin']) {
      const items = navItems.filter(([, , , allowedRole]) => !allowedRole || allowedRole === role);
      for (const collapsed of [false, true]) {
        const html = renderToStaticMarkup(<Sidebar page="settings" setPage={noop} nav={items} collapsed={collapsed} onToggle={noop} />);
        assert.equal((html.match(/<button /g) || []).length, items.length + 1);
        assert.match(html, new RegExp('aria-expanded="' + String(!collapsed) + '"'));
        const target = html.match(/aria-controls="([^"]+)"/)[1];
        assert.ok(html.includes('<nav id="' + target + '">'));
        assert.match(html, language === 'tl' ? /aria-label="Mga Setting"/ : /aria-label="Settings"/);
        assert.match(html, language === 'tl' ? /title="Mga Setting"/ : /title="Settings"/);
        assert.equal((html.match(new RegExp('class="nav-label" aria-hidden="' + String(collapsed) + '"', 'g')) || []).length, items.length);
      }
    }
  }
});

test('shared buttons reserve the same bilingual labels while exposing only the current label', () => {
  const render = language => {
    setLanguage(language);
    return renderToStaticMarkup(<StableButton type="submit" disabled aria-describedby="save-status" className="btn primary">{t('ui.new_syllabus_c4c7a9')}</StableButton>);
  };
  const english = render('en');
  const tagalog = render('tl');
  const reserves = html => [...html.matchAll(/<span class="stable-label-reserve" aria-hidden="true">(.*?)<\/span>/g)].map(match => match[1]);
  assert.deepEqual(reserves(english), reserves(tagalog));
  assert.equal(reserves(english).length, 2);
  assert.match(english, /class="stable-label-current">\+ New Syllabus<\/span>/);
  assert.doesNotMatch(tagalog, /class="stable-label-current">\+ New Syllabus<\/span>/);
  assert.match(tagalog, /<button type="submit" disabled="" aria-describedby="save-status" class="btn primary">/);
});

test('shared buttons preserve unknown text, numeric children and icons', () => {
  const html = renderToStaticMarkup(<StableButton className="btn"><svg aria-hidden="true" />{'Original account content'}{42}</StableButton>);
  assert.match(html, /Original account content/);
  assert.match(html, /42/);
  assert.match(html, /<svg aria-hidden="true">/);
  assert.doesNotMatch(html, /stable-label-reserve/);
});

test('program actions use shared buttons and preserve stored program names in both languages', () => {
  for (const language of ['en', 'tl']) {
    setLanguage(language);
    const html = renderToStaticMarkup(<ProgramManagement programs={[{id:1,code:'BSIT',name:'Original program name'}]} onChanged={noop} notify={noop} />);
    assert.match(html, /Original program name/); assert.match(html, /BSIT/);
    assert.match(html, /class="icon-btn"/); assert.match(html, /class="icon-btn is-delete"/);
    assert.match(html, /aria-label="(Rename program BSIT|Palitan ang pangalan ng programang BSIT)"/);
    assert.match(html, /aria-labelledby="program-management-title"/);
    assert.equal((html.match(/<button /g)||[]).length, 2);
  }
});
test('deletion begins with a non-destructive impact review, never an enabled final submit', () => {
  const html = renderToStaticMarkup(<ProgramDialog program={{id:1,code:'BSIT',name:'Information Technology'}} mode="delete" onClose={noop} onComplete={noop} onReload={noop} />);
  assert.match(html, /role="alertdialog"/); assert.match(html, /aria-describedby="program-dialog-description"/);
  assert.match(html, /Confirmation 1 of 2/); assert.match(html, /Loading affected records/);
  assert.doesNotMatch(html, /type="submit"/); assert.doesNotMatch(html, /Permanently delete program/);
  assert.match(html, /class="btn danger" disabled=""/);
  assert.match(html, /class="stable-label-current">Delete Program<\/span>/);
});
test('impact preview explains the cascade and keeps original syllabus titles in English and Tagalog', () => {
  const preview = {counts:{subjects:1,syllabi:1,versions:2,assignments:1,files:1},subjects:[{id:10,code:'IT101',title:'Approved Settings'}],syllabi:[{id:100,code:'IT101',title:'Original academic content',status:'approved'}]};
  for (const language of ['en','tl']) {
    setLanguage(language);
    const html = renderToStaticMarkup(<DeletionImpact preview={preview} />);
    assert.match(html, /Original academic content/); assert.match(html, /Approved Settings/);
    if (language === 'en') assert.match(html, /all linked syllabi in every status/);
    else assert.match(html, /lahat ng kaugnay na silabus anuman ang katayuan/);
  }
});

test('program editor exposes editable code and name fields with bilingual labels', () => {
  for (const language of ['en','tl']) {
    setLanguage(language);
    const html = renderToStaticMarkup(<ProgramDialog program={{id:1,code:'BSIT',name:'Original institution name'}} mode="rename" onClose={noop} onComplete={noop} onReload={noop} />);
    assert.match(html, /value="BSIT"/); assert.match(html, /value="Original institution name"/);
    assert.match(html, /pattern="\[A-Za-z\]\[A-Za-z0-9-\]\{1,19\}"/);
    assert.doesNotMatch(html, /readOnly|readonly/);
    assert.match(html, /program-edit-fields/);
    if (language === 'en') assert.match(html, /Program codes and names can change/);
    else assert.match(html, /Maaaring baguhin ang kodigo at pangalan ng programa/);
  }
});

test('repository uses current catalog programs for admin cells and dynamic filters in both languages', () => {
  for (const language of ['en', 'tl']) {
    setLanguage(language);
    const html = renderToStaticMarkup(<Repository user={{...user,role:'admin'}} syllabi={[
      {id:1, status:'approved', programCode:'BSNEW', program:'Obsolete curriculum', faculty:'Fay',title:'Original title',courseCode:'NEW101'},
      {id:2, status:'approved', program:'Legacy program',faculty:'Gus',title:'Upload',courseCode:'OLD101'},
      {id:3, status:'approved', programCode:'  ',program:' ',faculty:'Gus',title:'Unlinked upload',courseCode:'OLD102'},
    ]} notify={noop} setChatCode={noop} setHistCode={noop} />);
    assert.match(html, /<td>BSNEW<\/td>/);
    assert.match(html, /<span data-value="BSNEW">BSNEW<\/span>/);
    assert.match(html, /<td>Legacy program<\/td>/);
    assert.match(html, /<span data-value="Legacy program">Legacy program<\/span>/);
    assert.doesNotMatch(html, /Obsolete curriculum|value="Information Technology"|value="Computer Engineering"/);
    assert.ok(html.includes('<td>' + t('ui.no_program_d8600a') + '</td>'));
    assert.ok(html.includes('<span data-value="No program">' + t('ui.no_program_d8600a') + '</span>'));
    assert.match(html, /filter-card repository-filters/);
    assert.doesNotMatch(html, /value="submitted"/);
  }
});
test('repository program lookup prefers the catalog and preserves legacy uploads and missing associations', () => {
  assert.equal(repositoryProgram({programCode:' BSNEW ',programName:'New program',program:'Old curriculum'}),'BSNEW');
  assert.equal(repositoryProgram({programCode:' ',programName:' New program ',program:'Old curriculum'}),'New program');
  assert.equal(repositoryProgram({program:' Legacy upload '}),'Legacy upload');
  assert.equal(repositoryProgram({programCode:' ',program:null}),'No program');
});
test('faculty and admin repository share table and filters without a status selector', () => {
  for (const role of ['faculty','admin']) {
    const html=renderToStaticMarkup(<Repository user={{...user,role}} syllabi={[]} notify={noop} setChatCode={noop} setHistCode={noop} />);
    assert.match(html,/filter-card repository-filters/);
    assert.match(html,/table-card repository-table/);
    assert.equal((html.match(/scope="col"/g)||[]).length,6);
    assert.doesNotMatch(html,/value="submitted"|value="approved"|repository-filters-admin/);
    assert.equal((html.match(/role="combobox"/g)||[]).length,1);
  }
});

test('administrator repository excludes every unapproved status from rows, filters and totals', () => {
  for (const language of ['en','tl']) {
    setLanguage(language);
    const syllabi=['draft','submitted','under_review','for_revision','rejected','approved'].map((status,id)=>({id,status,programCode:'PROGRAM-'+status,courseCode:'SUBJECT-'+status,title:'Title-'+status,faculty:'Faculty'}));
    const html=renderToStaticMarkup(<Repository user={{...user,role:'admin'}} syllabi={syllabi} notify={noop} setChatCode={noop} setHistCode={noop} />);
    assert.match(html, /SUBJECT-approved/);
    for (const status of ['draft','submitted','under_review','for_revision','rejected']) {
      assert.ok(!html.includes('SUBJECT-'+status));
      assert.ok(!html.includes('PROGRAM-'+status));
    }
    assert.match(html, /class="repo-stats"><span>[^<]+<b>1<\/b>/);
    assert.doesNotMatch(html,/value="submitted"|value="approved"/);
  }
});

test('learning outcomes and preview hide catalog text until both program and subject are chosen', () => {
  const institution={vision:'Institution vision sentinel',mission:{lead:'Institution mission sentinel',items:['Mission item']},egas:[{no:1,name:'Default EGA sentinel',short:'Default'}]};
  const model=createModel({institution,programs:{BSIT:{name:'BSIT',egas:[{no:1,name:'Configured EGA sentinel',short:'EGA'}],pos:[{no:1,short:'PO',text:'Configured PO',egas:[1]}]}},year:2026});
  for(const language of ['en','tl']) {
    setLanguage(language);
    for(const meta of [{program:'',courseId:null},{program:'BSIT',courseId:null},{program:'',courseId:10}]) {
      const d=emptyDraft(()=>1);Object.assign(d.meta,meta);
      const html=renderToStaticMarkup(<ClosStep d={d} model={model} />);
      assert.ok(html.includes(t('outcomes.chooseProgramSubject')));
      assert.doesNotMatch(html,/Institution vision sentinel|Institution mission sentinel|Default EGA sentinel|Configured EGA sentinel/);
      const paper=renderToStaticMarkup(<FormPaper d={d} model={model} preparedBy="Faculty" />);
      assert.doesNotMatch(paper,/Institution vision sentinel|Institution mission sentinel|Default EGA sentinel|Configured EGA sentinel/);
    }
    const d=emptyDraft(()=>1);Object.assign(d.meta,{program:'BSIT',courseId:10});
    d.clos=[{id:'c1',title:'CLO',level:'Enabling',statement:'CLO statement',egas:[1],pos:[1]}];
    const html=renderToStaticMarkup(<ClosStep d={d} model={model} />);
    assert.match(html,/Institution vision sentinel/);assert.match(html,/Configured EGA sentinel/);
    assert.doesNotMatch(html,/Default EGA sentinel/);
  }
});

test('admin navigation and My Syllabi expose personal drafts without an AI Checker action',()=>{
  assert.ok(navItems.some(([page,,,role])=>page==='my-syllabi'&&!role));
  const html=renderToStaticMarkup(<MySyllabi user={{...user,role:'admin'}} syllabi={[{id:1,userId:user.id,status:'draft',courseCode:'OWN-DRAFT',title:'Own draft'},{id:2,userId:99,status:'draft',courseCode:'PRIVATE-OTHER',title:'Other draft'}]} messages={[]} setPage={noop} setEditing={noop} setHistCode={noop} setChatCode={noop} setConfirm={noop} handleDelete={noop} />);
  assert.match(html,/OWN-DRAFT/);assert.doesNotMatch(html,/PRIVATE-OTHER/);assert.doesNotMatch(html,/Check in AI Checker/);
});

test('Step 2 exposes all five editors even when empty and previews the syllabus-owned values', () => {
  const d = emptyDraft(() => 'one');
  Object.assign(d.meta, { program: 'BSIT', courseId: 10 });
  d.outcomes = { vision: '', mission: { lead: '', items: [] }, egas: [], pos: [] };
  const model = createModel({ institution: { vision: 'Catalog vision sentinel', mission: { lead: '', items: [] }, egas: [] }, programs: { BSIT: { pos: [], egas: [] } }, year: 2026 });
  for (const language of ['en', 'tl']) {
    setLanguage(language);
    const html = renderToStaticMarkup(<ClosStep d={d} model={model} apply={noop} />);
    for (const key of ['ui.vision_40b090', 'ui.mission_introduction_873ac6', 'ui.add_ega_270a20', 'ui.add_program_outcome_cd9147', 'ui.add_clo_0485ad']) assert.ok(html.includes(t(key)));
    assert.match(html, /<textarea/); assert.doesNotMatch(html, /sm-modal|catalog-surface|Catalog vision sentinel/);
  }
  d.outcomes = { vision: 'Faculty vision sentinel', mission: { lead: 'Faculty mission sentinel', items: ['Purpose'] }, egas: [{ no: 1, name: 'Faculty EGA', short: 'EGA' }], pos: [{ no: 1, text: 'Faculty PO', short: 'PO', egas: [1] }] };
  d.clos = [{ id: 'own1', title: 'Faculty CLO', level: 'Enabling', statement: 'Learn this', egas: [1], pos: [1] }];
  const paper = renderToStaticMarkup(<FormPaper d={d} model={model} preparedBy="Faculty" />);
  assert.match(paper, /Faculty vision sentinel|Faculty mission sentinel/); assert.doesNotMatch(paper, /Catalog vision sentinel/);
  const locked = renderToStaticMarkup(<ClosStep d={d} model={model} apply={noop} editable={false} />);
  assert.match(locked, /Faculty vision sentinel/); assert.doesNotMatch(locked, /<textarea|Add CLO/);
});
test('learning outcomes remain hidden while any subject setup section is incomplete',()=>{
  const d=emptyDraft(()=>1);Object.assign(d.meta,{program:'BSIT',courseId:10});
  const model=createModel({institution:{vision:'Unfinished subject vision',mission:{lead:'',items:[]},egas:[]},programs:{BSIT:{name:'BSIT',egas:[],pos:[]}},year:2026});
  const html=renderToStaticMarkup(<ClosStep d={d} model={model} />);
  assert.ok(html.includes(t('outcomes.subjectIncomplete').replaceAll('&','&amp;')));assert.doesNotMatch(html,/Unfinished subject vision/);
});

test('AI results expose an explicit approval and edit choice with busy and unavailable states in both languages',()=>{
  for(const language of ['en','tl']){
    setLanguage(language);
    const props={syllabus:{syllabusId:10,courseCode:'IT101',title:'Original title',programCode:'BSIT',status:'draft'},run:null,onClose:noop,onOpenDraft:noop,onApprove:noop};
    const ready=renderToStaticMarkup(<ComplianceModal {...props} approvalDisabled={false}/>);
    const unavailable=renderToStaticMarkup(<ComplianceModal {...props} approvalDisabled/>);
    const busy=renderToStaticMarkup(<ComplianceModal {...props} approvalDisabled={false} approving/>);
    assert.ok(ready.includes(t('publication.approve').replaceAll('&','&amp;')));
    assert.ok(ready.includes(t('publication.editDraft')));
    assert.match(unavailable,/<button type="button" class="btn primary" disabled=""/);
    assert.match(busy,/aria-busy="true"/);
    assert.ok(busy.includes(t('publication.approving')));
    const readOnly=renderToStaticMarkup(<ComplianceModal syllabus={props.syllabus} run={null} onClose={noop}/>);
    assert.ok(!readOnly.includes(t('publication.approve').replaceAll('&','&amp;')));
  }
});

test('administrator builder review omits the embedded AI section while faculty keeps it',()=>{
  const d=emptyDraft(()=>1);
  const model=createModel({institution:{vision:'',mission:{lead:'',items:[]},egas:[]},programs:{},year:2026});
  for(const language of ['en','tl']){
    setLanguage(language);
    const props={d,model,go:noop,preparedBy:'Original author',existing:false,note:'',setNote:noop,syllabusId:()=>null,saveFirst:noop,canCheck:false,submitFailed:[]};
    const admin=renderToStaticMarkup(<ReviewStep {...props} showCompliance={false}/>);
    assert.doesNotMatch(admin,/id="cmp-card"/);
    assert.ok(admin.includes(t('publication.checkInTab')));
    assert.match(admin,/Original author/);assert.match(admin,/class="paper"/);
    const faculty=renderToStaticMarkup(<ReviewStep {...props}/>);
    assert.match(faculty,/id="cmp-card"/);
    assert.ok(!faculty.includes(t('publication.checkInTab')));
  }
});

test('My Syllabi keeps faculty communication and hides it for administrators while preserving history',()=>{
  for(const language of ['en','tl']) {
    setLanguage(language);
    for(const role of ['admin','faculty']) {
      const html=renderToStaticMarkup(<MySyllabi user={{...user,role}} syllabi={[{id:45,userId:user.id,status:'under_review',courseCode:'TEST',title:'Original title',adminComment:'Reviewer feedback sentinel'}]} messages={[{syllabusId:45,receiverId:user.id,isRead:false}]} commentCounts={{45:2}} setPage={noop} setEditing={noop} setHistCode={noop} setChatCode={noop} setCommentCode={noop} setConfirm={noop} handleDelete={noop}/>);
      assert.ok(html.includes(t('ui.history_fefbcc')));
      if(role==='admin') {
        assert.doesNotMatch(html,/syl-comments|feedback-banner|syl-unread|Reviewer feedback sentinel/);
        assert.ok(!html.includes(t('ui.message_890761')));
      } else {
        assert.match(html,/syl-comments/);assert.match(html,/feedback-banner/);assert.match(html,/syl-unread/);
        assert.ok(html.includes(t('ui.message_890761')));
      }
    }
    const draft=renderToStaticMarkup(<MySyllabi user={{...user,role:'admin'}} syllabi={[{id:45,userId:user.id,status:'draft',courseCode:'TEST'}]} messages={[]} setPage={noop} setEditing={noop} setHistCode={noop} setChatCode={noop} setConfirm={noop} handleDelete={noop}/>);
    assert.ok(draft.includes(t('ui.history_fefbcc')));
  }
});

test('admin repository hides messaging for owned syllabi and keeps faculty messaging and history',()=>{
  for(const language of ['en','tl']) {
    setLanguage(language);
    const html=renderToStaticMarkup(<Repository user={{...user,role:'admin'}} syllabi={[
      {id:91,userId:user.id,status:'approved',courseCode:'OWN101',title:'Own syllabus'},
      {id:92,userId:999,status:'approved',courseCode:'FAC101',title:'Faculty syllabus'}
    ]} notify={noop} setChatCode={noop} setHistCode={noop}/>);
    assert.ok(!html.includes(t('ui.open_chat_for_p0_633dd9',{p0:'OWN101'})));
    assert.ok(html.includes(t('ui.open_chat_for_p0_633dd9',{p0:'FAC101'})));
    assert.ok(html.includes(t('ui.view_history_for_p0_46396f',{p0:'OWN101'})));
  }
});

test('CO–PO Mapping has no navigation, dashboard shortcut or login feature for either role and language',()=>{
  assert.ok(navItems.every(([page])=>page!=='mapping'));
  for(const language of ['en','tl']) {
    setLanguage(language);
    for(const role of ['faculty','admin']) {
      const account={...user,role};const items=navItems.filter(([, , , allowed])=>!allowed||allowed===role);
      const sidebar=renderToStaticMarkup(<Sidebar page="dashboard" setPage={noop} nav={items} collapsed={false} onToggle={noop}/>);
      const dashboard=renderToStaticMarkup(<Dashboard user={account} syllabi={[]} logs={[]} setPage={noop} clearLogs={noop} setConfirm={noop}/>);
      assert.doesNotMatch(sidebar+dashboard,/CO[–-]PO Mapping|Curriculum Mapping|Pagmamapa ng CO[–-]PO|Pagmamapa ng kurikulum/i);
      assert.ok(items.some(([page])=>page==='builder'));assert.ok(items.some(([page])=>page==='my-syllabi'));
    }
    const login=renderToStaticMarkup(<Login onLogin={noop} onGoogleLogin={noop}/>);
    assert.doesNotMatch(login,/CO[–-]PO Mapping|Pagmamapa ng CO[–-]PO/i);
  }
});
