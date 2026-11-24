import test from 'node:test';
import assert from 'node:assert/strict';
import { sleepFor, waitForImportJob } from './pdfImportResume.js';

const preview = { fields: { code: 'MA 7' }, pages: [{ page: 1, method: 'text' }] };
const noSleep = async () => {};

test('a running scan is waited for, then its preview is returned without uploading again', async () => {
  const answers = [{ state: 'running', kind: 'extract', file: { name: 'a.pdf', size: 9 } }, { state: 'running', kind: 'extract', file: { name: 'a.pdf', size: 9 } }, { state: 'done', kind: 'extract', file: { name: 'a.pdf', size: 9 }, result: preview }];
  const asked = [], seen = [];
  const found = await waitForImportJob('jabc12345678', { get: async (job) => { asked.push(job); return answers.shift(); }, sleep: noSleep, onStatus: s => seen.push(s.state) });
  assert.deepEqual(found, { kind: 'extract', file: { name: 'a.pdf', size: 9 }, result: preview });
  assert.deepEqual(asked, ['jabc12345678', 'jabc12345678', 'jabc12345678']);
  assert.deepEqual(seen, ['running', 'running', 'done']);
});

test('a failed scan gives the error the upload would have given', async () => {
  const get = async () => ({ state: 'failed', status: 409, error: { error: 'pdfImport.subjectNotFound' } });
  await assert.rejects(waitForImportJob('jabc12345678', { get, sleep: noSleep }), (e) => e.message === 'pdfImport.subjectNotFound' && e.status === 409 && e.data.error === 'pdfImport.subjectNotFound');
});

test('a scan the server no longer has is reported as interrupted; other errors pass through', async () => {
  await assert.rejects(waitForImportJob('jabc12345678', { get: async () => { throw Object.assign(new Error('gone'), { status: 404 }); }, sleep: noSleep }), { message: 'pdfImport.interrupted' });
  await assert.rejects(waitForImportJob('jabc12345678', { get: async () => { throw Object.assign(new Error('Cannot reach the server.'), { status: undefined }); }, sleep: noSleep }), { message: 'Cannot reach the server.' });
});

test('a malformed answer or a done scan without a preview fails instead of showing nothing', async () => {
  await assert.rejects(waitForImportJob('jabc12345678', { get: async () => ({ state: 'done', result: {} }), sleep: noSleep }), { message: 'pdfImport.failed' });
  await assert.rejects(waitForImportJob('jabc12345678', { get: async () => ({}), sleep: noSleep }), { message: 'pdfImport.failed' });
});

test('waiting stops past maxMs and on abort', async () => {
  let t = 0;
  await assert.rejects(waitForImportJob('jabc12345678', { get: async () => ({ state: 'running' }), sleep: async () => { t += 1000; }, now: () => t, maxMs: 2500 }), { message: 'pdfImport.timeout' });
  const controller = new AbortController();
  const waiting = waitForImportJob('jabc12345678', { get: async () => ({ state: 'running' }), signal: controller.signal, intervalMs: 60000 });
  setTimeout(() => controller.abort(), 5);
  await assert.rejects(waiting, { name: 'AbortError' });
});

test('sleepFor resolves after the delay and rejects at once when aborted', async () => {
  await sleepFor(1);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(sleepFor(1000, controller.signal), { name: 'AbortError' });
});
