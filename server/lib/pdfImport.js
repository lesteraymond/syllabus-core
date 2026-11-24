const { Worker } = require('node:worker_threads');
const path = require('node:path');
const { httpError } = require('./http');
const MAX_BYTES = 10 * 1024 * 1024;
function validatePdf(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw httpError(400, 'pdfImport.chooseFile');
  if (buffer.length > MAX_BYTES) throw httpError(413, 'pdfImport.tooLarge');
  if (!buffer.subarray(0, 1024).includes(Buffer.from('%PDF-')) || !buffer.subarray(-4096).includes(Buffer.from('%%EOF'))) throw httpError(422, 'pdfImport.invalid');
}
// The longest a whole import may take (a 30-page scan is OCR'd page by page) ...
const MAX_MS = 9 * 60 * 1000;
// ... and the longest one page may take: the worker reports each page it starts, so a scan that keeps
// moving is never cut off at a fixed time, while a stuck page is.
const PAGE_MS = 120 * 1000;
// Isolate PDF parsing/OCR from Express. A timed-out import is terminated rather
// than continuing expensive work after its request has already failed.
function extractPdf(buffer, { timeoutMs = PAGE_MS, maxMs = MAX_MS, WorkerClass = Worker } = {}) {
  validatePdf(buffer);
  return new Promise((resolve, reject) => {
    const worker = new WorkerClass(path.join(__dirname, 'pdfImport.worker.js'), { workerData: { bytes: new Uint8Array(buffer) }, resourceLimits: { maxOldGenerationSizeMb: 256 } });
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer); clearTimeout(limit);
      worker.terminate().catch(() => {});
      if (error) reject(error); else resolve(value);
    };
    const expire = () => finish(httpError(422, 'pdfImport.timeout'));
    let timer = setTimeout(expire, timeoutMs);
    const limit = setTimeout(expire, maxMs);
    // Under `node --watch` (npm run dev) Node posts its own { 'watch:require': [...] } / { 'watch:import': [...] } messages from the worker; skip them.
    const isWatchNotice = message => !!message && typeof message === 'object' && Object.keys(message).some(key => key.startsWith('watch:'));
    worker.on('message', message => {
      if (isWatchNotice(message)) return;
      if (message?.progress) { clearTimeout(timer); timer = setTimeout(expire, timeoutMs); return; }
      message.error ? finish(httpError(422, message.error)) : finish(null, message);
    });
    worker.once('error', () => finish(httpError(422, 'pdfImport.unreadable')));
    worker.once('exit', () => { if (!settled) finish(httpError(422, 'pdfImport.unreadable')); });
  });
}
module.exports = { MAX_BYTES, MAX_MS, validatePdf, extractPdf };
