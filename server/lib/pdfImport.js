const { Worker } = require('node:worker_threads');
const path = require('node:path');
const { httpError } = require('./http');
const MAX_BYTES = 10 * 1024 * 1024;
function validatePdf(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw httpError(400, 'pdfImport.chooseFile');
  if (buffer.length > MAX_BYTES) throw httpError(413, 'pdfImport.tooLarge');
  if (!buffer.subarray(0, 1024).includes(Buffer.from('%PDF-')) || !buffer.subarray(-4096).includes(Buffer.from('%%EOF'))) throw httpError(422, 'pdfImport.invalid');
}
// Isolate PDF parsing/OCR from Express. A timed-out import is terminated rather
// than continuing expensive work after its request has already failed.
function extractPdf(buffer, { timeoutMs = 120000, WorkerClass = Worker } = {}) {
  validatePdf(buffer);
  return new Promise((resolve, reject) => {
    const worker = new WorkerClass(path.join(__dirname, 'pdfImport.worker.js'), { workerData: { bytes: new Uint8Array(buffer) }, resourceLimits: { maxOldGenerationSizeMb: 256 } });
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      worker.terminate().catch(() => {});
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => finish(httpError(422, 'pdfImport.timeout')), timeoutMs);
    worker.once('message', message => message.error ? finish(httpError(422, message.error)) : finish(null, message));
    worker.once('error', () => finish(httpError(422, 'pdfImport.unreadable')));
    worker.once('exit', () => { if (!settled) finish(httpError(422, 'pdfImport.unreadable')); });
  });
}
module.exports = { MAX_BYTES, validatePdf, extractPdf };
