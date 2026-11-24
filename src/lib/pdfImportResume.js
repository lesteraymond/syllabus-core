// Picks up a PDF scan again after a browser refresh. The scan runs on the server under the id the builder gave it
// (server/lib/pdfImportJobs.js); this waits for it to end and answers what the original upload would have answered.

const abortError = () => Object.assign(new Error('aborted'), { name: 'AbortError' });

// Resolves after `ms`, or rejects at once when `signal` aborts.
export const sleepFor = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) { reject(abortError()); return; }
  const timer = setTimeout(() => { signal?.removeEventListener?.('abort', stop); resolve(); }, ms);
  const stop = () => { clearTimeout(timer); reject(abortError()); };
  signal?.addEventListener?.('abort', stop, { once: true });
});

// get(job, { signal }) reads GET /syllabi/pdf-import/job/:job. Resolves { kind, file, result } once the scan is done;
// rejects with the error the upload would have given when it failed, 'pdfImport.interrupted' when the server no longer has it
// (never received, replaced by a newer scan, expired, or the server restarted), 'pdfImport.timeout' past maxMs, and an AbortError on abort.
// onStatus(status) sees every answer, so the caller can show the file's name while the scan still runs.
export async function waitForImportJob(job, { get, signal, onStatus, sleep = sleepFor, intervalMs = 1500, maxMs = 11 * 60 * 1000, now = Date.now } = {}) {
  const started = now();
  for (;;) {
    if (signal?.aborted) throw abortError();
    let status;
    try { status = await get(job, { signal }); }
    catch (error) {
      if (signal?.aborted || error?.name === 'AbortError') throw abortError();
      if (error?.status === 404) throw Object.assign(new Error('pdfImport.interrupted'), { status: 404 });
      throw error;
    }
    if (signal?.aborted) throw abortError();
    try { onStatus?.(status); } catch { /* a display callback never stops the wait */ }
    if (status?.state === 'done') {
      if (!status.result?.fields || !Array.isArray(status.result.pages)) throw new Error('pdfImport.failed');
      return { kind: status.kind, file: status.file || null, result: status.result };
    }
    if (status?.state === 'failed') {
      throw Object.assign(new Error(status.error?.error || 'pdfImport.failed'), { status: status.status, data: status.error || {} });
    }
    if (status?.state !== 'running') throw new Error('pdfImport.failed');
    if (now() - started > maxMs) throw new Error('pdfImport.timeout');
    await sleep(intervalMs, signal);
  }
}
