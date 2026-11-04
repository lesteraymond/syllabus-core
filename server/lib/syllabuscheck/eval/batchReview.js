'use strict';
// Evaluation-only operator checkpoint. No model/DB access; only an explicit 'continue' permits the next paid batch.
const readline = require('node:readline');
function decisionOf(line) {
  const value = String(line || '').trim();
  return value.toLowerCase() === 'continue' ? { proceed: true, reason: null }
    : { proceed: false, reason: /^stop\s+(.+)/i.exec(value)?.[1] || 'No explicit continuation after academic batch review.' };
}
function reviewBatch({ input = process.stdin, output = process.stdout } = {}) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input, output, terminal: false });
    let settled = false;
    const finish = line => { if (settled) return; settled = true; resolve(decisionOf(line)); rl.close(); };
    rl.once('close', () => finish('stop Input closed before batch continuation.'));
    rl.question('ACADEMIC CHECKPOINT: type continue, or stop <reason>: ', finish);
  });
}
module.exports = { decisionOf, reviewBatch };
