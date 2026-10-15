import ReviewStep from '../src/views/builder2/ReviewStep';
import ComplianceModal from '../src/components/ComplianceModal';
import MySyllabi from '../src/views/MySyllabi';
import ClosStep from '../src/views/builder2/ClosStep';
import FormPaper from '../src/views/builder2/FormPaper';
import { createModel, emptyDraft } from '../src/lib/syllabusModel';
import ProgramManagement, { DeletionImpact, ProgramDialog } from '../src/components/ProgramManagement';
import StableButton from '../src/components/StableButton';
import { t } from '../src/i18n';
import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Settings from '../src/views/Settings';
import AdministrativeSettings from '../src/components/AdministrativeSettings';
import Sidebar from '../src/components/Sidebar';
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
  assert.match(html, /value="en" lang="en" selected=""/);
});
test('administrator settings load only in the administrator branch and keep real setting values', () => {
  const parent = renderToStaticMarkup(<Settings {...props} user={{ ...user, role: 'admin' }} />);
  assert.match(parent, /Loading administrator settings/);
  const html = renderToStaticMarkup(<AdministrativeSettings administration={admin} adminBusy={false} updateAdmin={noop} />);
  assert.match(html, /Institutional Standard/); assert.match(html, /AI &amp; Notifications/);
  assert.match(html, /value="Undergraduate Syllabus v4" selected/);
});
test('Tagalog settings translate labels, keep account names and setting values, and expose saving accessibly', () => {
  setLanguage('tl');
  const html = renderToStaticMarkup(<Settings {...props} language="tl" languageBusy />);
  assert.match(html, /Mga Setting/); assert.match(html, /Aking Profile/); assert.match(html, /Baguhin ang Profile/);
  assert.match(html, /value="Approved"/); assert.match(html, /value="Settings"/);
  assert.match(html, /value="tl" lang="tl" selected/); assert.match(html, /Isine-save ang napiling wika/);
  assert.match(html, /aria-live="polite"/);
  const cards = renderToStaticMarkup(<AdministrativeSettings administration={admin} adminBusy={false} updateAdmin={noop} />);
  assert.match(cards, /Pamantayan ng Institusyon/); assert.match(cards, /AI at mga Abiso/);
  assert.match(cards, /value="Undergraduate Syllabus v4" selected/);
  assert.match(cards, /Original English Department/);
});
test('navigation, dashboard summaries and roles switch language while account names stay original', () => {
  setLanguage('tl');
  const nav = renderToStaticMarkup(<Sidebar page="settings" setPage={noop} nav={navItems} collapsed={false} onToggle={noop} />);
  assert.match(nav, /Pangkalahatang Tanaw/); assert.match(nav, /Mga Setting/); assert.match(nav, /Tagabuo ng Silabus/);
  const dashboard = renderToStaticMarkup(<Dashboard user={user} syllabi={[]} logs={[]} setPage={noop} clearLogs={noop} setConfirm={noop} />);
  assert.match(dashboard, /Aking mga Naipasa/); assert.match(dashboard, /Kabuuang na-upload/);
  const topbar = renderToStaticMarkup(<Topbar user={user} page="settings" unread={0} threads={[]} msgDrop={false} onLogout={noop} setMsgDrop={noop} notifications={{ unreadCount: 0, items: [] }} />);
  assert.match(topbar, /Approved Settings/); assert.match(topbar, /Guro/); assert.match(topbar, /Mag-sign out/);
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
    assert.match(html, /class="btn outline"/); assert.match(html, /class="btn danger"/);
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
    assert.match(html, /<option value="BSNEW">BSNEW<\/option>/);
    assert.match(html, /<td>Legacy program<\/td>/);
    assert.match(html, /<option value="Legacy program">Legacy program<\/option>/);
    assert.doesNotMatch(html, /Obsolete curriculum|value="Information Technology"|value="Computer Engineering"/);
    assert.ok(html.includes('<td>' + t('ui.no_program_d8600a') + '</td>'));
    assert.ok(html.includes('<option value="No program">' + t('ui.no_program_d8600a') + '</option>'));
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
    assert.equal((html.match(/<select/g)||[]).length,1);
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
