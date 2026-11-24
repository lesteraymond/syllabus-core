// The Repository page as a browser shows it. It reads its rows from the server (GET /syllabi?scope=repository: every approved syllabus, for every role),
// so these tests answer that request and render with effects in happy-dom, instead of rendering the markup once with no data.
import React, { act } from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import Repository from '../src/views/Repository';
import { syllabi } from '../src/lib/api';
import { setLanguage, t as say } from '../src/i18n';

const browser = new Window({ url: 'http://localhost:5173' });
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Event: browser.Event, MouseEvent: browser.MouseEvent, IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import('react-dom/client');

const user = { id: 1, role: 'faculty', email: 'person@example.invalid', firstName: 'Approved', lastName: 'Settings', name: 'Approved Settings', initials: 'AS' };
const noop = () => {};
test.afterEach(() => setLanguage('en'));

// Renders the page for `role` with the server answering `rows` (and `archived` for the archived list), then runs fn({ host, html, notices, asked }).
async function mount(t, { role = 'admin', rows = [], archived = [] }, fn) {
  const asked = [];
  t.mock.method(syllabi, 'repository', async (year) => { asked.push(year); return rows; });
  t.mock.method(syllabi, 'archived', async () => archived);
  const notices = [];
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<Repository user={{ ...user, role }} syllabi={[]} notify={(m) => notices.push(m)} setHistCode={noop} />));
  try { await fn({ host, html: host.innerHTML, notices, asked }); }
  finally { await act(async () => root.unmount()); host.remove(); }
}

test('every role reads the repository from the server and sees every approved syllabus, with history and no message button', async (t) => {
  for (const language of ['en', 'tl']) {
    setLanguage(language);
    for (const role of ['faculty', 'admin', 'asst_vpaa', 'lic_director', 'vpaa']) {
      await mount(t, { role, rows: [
        { id: 91, userId: user.id, status: 'approved', courseCode: 'OWN101', title: 'Own syllabus' },
        { id: 92, userId: 999, status: 'approved', courseCode: 'FAC101', title: 'Faculty syllabus' },
      ] }, async ({ html, asked }) => {
        assert.deepEqual(asked, [undefined], role + ': one request, for the current academic year');
        assert.ok(html.includes('FAC101') && html.includes('OWN101'), role + ': both approved syllabi are listed, not only their own');
        for (const code of ['OWN101', 'FAC101']) {
          assert.ok(!html.includes(say('ui.open_chat_for_p0_633dd9', { p0: code })), role + ' ' + code + ': no message button');
          assert.ok(html.includes(say('ui.view_history_for_p0_46396f', { p0: code })), role + ' ' + code + ': history kept');
        }
        assert.ok(!html.includes('✉'), role + ': no message icon anywhere in the list');
      });
    }
  }
});

test('translated repository filters keep canonical option values and the original syllabus titles', async (t) => {
  setLanguage('tl');
  await mount(t, { rows: [{ id: 5, userId: 2, status: 'approved', title: 'Settings', courseCode: 'IT 204', faculty: 'Approved', program: 'BSIT', uploadedAt: '2026-01-01' }] }, async ({ html }) => {
    assert.doesNotMatch(html, /value="approved"|value="submitted"/); assert.match(html, /Aprubado/);
    assert.match(html, /<small>Settings<\/small>/); assert.match(html, /Approved/);
  });
});

test('repository uses current catalog programs for its cells and dynamic filters in both languages', async (t) => {
  for (const language of ['en', 'tl']) {
    setLanguage(language);
    await mount(t, { rows: [
      { id: 1, status: 'approved', programCode: 'BSNEW', program: 'Obsolete curriculum', faculty: 'Fay', title: 'Original title', courseCode: 'NEW101' },
      { id: 2, status: 'approved', program: 'Legacy program', faculty: 'Gus', title: 'Upload', courseCode: 'OLD101' },
      { id: 3, status: 'approved', programCode: '  ', program: ' ', faculty: 'Gus', title: 'Unlinked upload', courseCode: 'OLD102' },
    ] }, async ({ html }) => {
      assert.match(html, /<td>BSNEW<\/td>/);
      assert.match(html, /<span data-value="BSNEW">BSNEW<\/span>/);
      assert.match(html, /<td>Legacy program<\/td>/);
      assert.match(html, /<span data-value="Legacy program">Legacy program<\/span>/);
      assert.doesNotMatch(html, /Obsolete curriculum|value="Information Technology"|value="Computer Engineering"/);
      assert.ok(html.includes('<td>' + say('ui.no_program_d8600a') + '</td>'));
      assert.ok(html.includes('<span data-value="No program">' + say('ui.no_program_d8600a') + '</span>'));
      assert.match(html, /filter-card repository-filters/);
      assert.doesNotMatch(html, /value="submitted"/);
    });
  }
});

test('the repository shows only approved syllabi in its rows, filters and totals, whatever the answer holds', async (t) => {
  for (const language of ['en', 'tl']) {
    setLanguage(language);
    const rows = ['draft', 'submitted', 'under_review', 'for_revision', 'rejected', 'approved'].map((status, id) => ({ id, status, programCode: 'PROGRAM-' + status, courseCode: 'SUBJECT-' + status, title: 'Title-' + status, faculty: 'Faculty' }));
    await mount(t, { rows }, async ({ html }) => {
      assert.match(html, /SUBJECT-approved/);
      for (const status of ['draft', 'submitted', 'under_review', 'for_revision', 'rejected']) {
        assert.ok(!html.includes('SUBJECT-' + status));
        assert.ok(!html.includes('PROGRAM-' + status));
      }
      assert.match(html, /class="repo-stats"><span>[^<]+<b>1<\/b>/);
      assert.doesNotMatch(html, /value="submitted"|value="approved"/);
    });
  }
});

test('Export list downloads the rows on screen as a CSV, and is off when there is nothing to export', async (t) => {
  const downloads = [];
  t.mock.method(URL, 'createObjectURL', (blob) => { downloads.push({ blob }); return 'blob:repository'; });
  t.mock.method(URL, 'revokeObjectURL', noop);
  t.mock.method(browser.HTMLAnchorElement.prototype, 'click', function click() { downloads[downloads.length - 1].name = this.download; });
  const exportButton = (host) => [...host.querySelectorAll('button')].find((b) => b.textContent.includes(say('ui.export_list_b039ae')));
  await mount(t, { rows: [
    { id: 1, status: 'approved', programCode: 'BSIT', faculty: 'Fay F', title: 'Programming 2', courseCode: 'IT 204', version: 'v1.1', updatedAt: '2026-11-20T00:00:00Z' },
    { id: 2, status: 'approved', program: 'Legacy program', faculty: 'Gus G', title: 'Upload', courseCode: 'OLD101' },
  ] }, async ({ host, notices }) => {
    const button = exportButton(host);
    assert.ok(button && !button.disabled, 'Export list is on when there are rows');
    await act(async () => button.click());
    assert.equal(downloads.length, 1); assert.equal(downloads[0].name, 'syllabus-repository.csv');
    const lines = (await downloads[0].blob.text()).replace(/^﻿/, '').trim().split('\r\n');
    assert.equal(lines[0], 'Course Code,Course Title,Program,Faculty,Academic Year,Version,Status,Archived,Last Updated');
    assert.deepEqual(lines.slice(1).sort(), ['IT 204,Programming 2,BSIT,Fay F,,v1.1,Approved,No,2026-11-20T00:00:00Z', 'OLD101,Upload,Legacy program,Gus G,,,Approved,No,'].sort());
    assert.deepEqual(notices, [say('repository.exported')]);
  });
  await mount(t, { rows: [] }, async ({ host }) => {
    assert.ok(exportButton(host).disabled, 'nothing to export');
  });
});
