'use strict';
// Release-candidate snapshot: freezes the exact working tree so a full regression can run against bytes that other sessions cannot change underneath it.
//   node scripts/release/snapshot.cjs capture <label>   copy the tree to tmp/release-candidate/<label>/, verify every copied byte, and re-hash the working tree afterwards
//   node scripts/release/snapshot.cjs verify  <label>   hash the working tree NOW and say whether it still equals the snapshot (a run is only valid for the tree if it does)
//   node scripts/release/snapshot.cjs clean   <label>   remove the snapshot (removes the two dependency junctions FIRST, without following them, and checks node_modules survived)
// Two hashes: `sourceHash` covers the application source (package files, public, scripts, server, shared, src, tests, vite.config.js) and is the release-candidate hash that is compared
// across runs; `treeHash` covers every copied file (adds docs, reference data and fixtures that tests read). Nothing in the working tree is modified, moved or deleted. .env files,
// uploads, private data, node_modules and tmp/ are never copied.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../..'), OUT = path.join(ROOT, 'docs/release-candidate'), WORK = path.join(ROOT, 'tmp/release-candidate');
const [action, label] = process.argv.slice(2);
if (!['capture', 'verify', 'clean'].includes(action) || !/^[a-z0-9-]+$/.test(label || '')) { console.error('usage: snapshot.cjs capture|verify|clean <label>'); process.exit(2); }
const dest = path.join(WORK, label), record = path.join(OUT, `snapshot-${label}.json`);
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const SOURCE = /^(package-lock\.json|package\.json|vite\.config\.js|public\/|scripts\/|server\/|shared\/|src\/|tests\/)/;
const EXCLUDED = /^tmp\/|^promo-video\/|^server\/(uploads|private|sample_cor)\/|(^|\/)node_modules\/|(^|\/)\.env(?:\.(?!example$)|$)|^docs\/e2e-stability-2026-11-05\/|^docs\/release-candidate\/|^scripts\/release\//;
function listing() {
  const listed = cp.execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 }).toString().split('\0');
  return [...new Set(listed.filter((f) => f && !EXCLUDED.test(f) && fs.existsSync(path.join(ROOT, f)) && fs.statSync(path.join(ROOT, f)).isFile()))].sort();
}
function manifest() {
  const files = listing().map((file) => { const bytes = fs.readFileSync(path.join(ROOT, file)); return { file, bytes: bytes.length, sha256: sha(bytes) }; });
  const source = files.filter((f) => SOURCE.test(f.file));
  return { files, sourceHash: sha(JSON.stringify(source.map((f) => [f.file, f.sha256]))), treeHash: sha(JSON.stringify(files.map((f) => [f.file, f.sha256]))), sourceFiles: source.length };
}
const head = () => cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim();
fs.mkdirSync(OUT, { recursive: true });

if (action === 'capture') {
  if (fs.existsSync(dest)) { console.error('snapshot ' + label + ' already exists; clean it or choose another label'); process.exit(2); }
  const before = manifest();
  for (const f of before.files) { const target = path.join(dest, f.file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(ROOT, f.file), target); if (sha(fs.readFileSync(target)) !== f.sha256) throw Error('copy mismatch: ' + f.file); }
  const after = manifest();
  // A change to documents or evidence files (other sessions write them while they run) does not move the application; only a change to the source set invalidates the capture.
  if (after.sourceHash !== before.sourceHash) { console.error('SOURCE CHANGED DURING CAPTURE: this snapshot is not valid. Clean it and capture again when the tree is quiet.'); fs.writeFileSync(record, JSON.stringify({ label, status: 'INVALID: tree changed during capture', beforeHash: before.treeHash, afterHash: after.treeHash }, null, 2)); process.exit(1); }
  for (const rel of ['node_modules', 'server/node_modules']) fs.symlinkSync(path.join(ROOT, rel), path.join(dest, rel), 'junction');
  fs.writeFileSync(record, JSON.stringify({ label, capturedAt: new Date().toISOString(), head: head(), snapshot: dest, sourceHash: before.sourceHash, treeHash: before.treeHash, sourceFiles: before.sourceFiles, files: before.files.length, dependencyJunctions: ['node_modules', 'server/node_modules'], manifest: before.files.map((f) => ({ file: f.file, sha256: f.sha256 })) }, null, 2));
  console.log(JSON.stringify({ label, snapshot: dest, files: before.files.length, sourceFiles: before.sourceFiles, sourceHash: before.sourceHash, treeHash: before.treeHash }, null, 1));
} else if (action === 'verify') {
  const snap = JSON.parse(fs.readFileSync(record, 'utf8')), now = manifest(), old = new Map(snap.manifest.map((f) => [f.file, f.sha256])), cur = new Map(now.files.map((f) => [f.file, f.sha256]));
  const changed = [...new Set([...old.keys(), ...cur.keys()])].filter((f) => old.get(f) !== cur.get(f));
  const result = { label, checkedAt: new Date().toISOString(), snapshotSourceHash: snap.sourceHash, currentSourceHash: now.sourceHash, sourceUnchanged: snap.sourceHash === now.sourceHash, treeUnchanged: snap.treeHash === now.treeHash, changedSinceSnapshot: changed };
  console.log(JSON.stringify(result, null, 1));
  process.exitCode = result.sourceUnchanged ? 0 : 1;
} else {
  for (const rel of ['node_modules', 'server/node_modules']) {
    const link = path.join(dest, rel);
    if (fs.existsSync(link) && fs.lstatSync(link).isSymbolicLink()) fs.rmdirSync(link); // removes the junction itself, never its target
  }
  for (const rel of ['node_modules', 'server/node_modules']) if (!fs.existsSync(path.join(ROOT, rel))) { console.error('ABORT: ' + rel + ' of the working tree is missing after unlinking; not deleting anything else'); process.exit(1); }
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
  console.log('removed ' + dest);
}
