'use strict';
// Read-only comparison of the CURRENT working tree against a frozen source manifest (docs/e2e-stability-2026-11-05/tested-source.json): which source/test/config
// files were added, removed or changed since the snapshot, classified by the area they affect. Writes nothing except the optional --json output.
//   node scripts/release/source-compare.cjs [--manifest path] [--json out.json]
// Also prints a deterministic SHA-256 of the current file set ("release-candidate hash") so a later run can prove the tree did not move.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../..');
const arg = (name, dflt) => { const i = process.argv.indexOf('--' + name); return i >= 0 ? process.argv[i + 1] : dflt; };
const manifestPath = path.resolve(ROOT, arg('manifest', 'docs/e2e-stability-2026-11-05/tested-source.json')), jsonOut = arg('json', '');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const TOP = /^(package-lock\.json|package\.json|vite\.config\.js|public\/|scripts\/|server\/|shared\/|src\/|tests\/)/;
function current() {
  const listed = cp.execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString().split('\0');
  const files = [...new Set(listed.filter((f) => f && TOP.test(f) && !/^tmp\//.test(f) && !/^scripts\/release\//.test(f) && !/^server\/(uploads|private|sample_cor)\//.test(f) && !/(^|\/)\.env(?:\.(?!example$)|$)/.test(f) && !/(^|\/)node_modules\//.test(f) && fs.existsSync(path.join(ROOT, f)) && fs.statSync(path.join(ROOT, f)).isFile()))].sort();
  return new Map(files.map((f) => [f, sha(fs.readFileSync(path.join(ROOT, f)))]));
}
const AREAS = [
  ['AI Checker services', /^server\/lib\/(syllabuscheck|compliance)\/(?!.*\.test\.)|^server\/routes\/syllabusCheck/],
  ['Academic Policy V2', /academicPolicyV2|academicV2|cloClassification|vpaa/i],
  ['Cost optimizations', /costPlan|optimization|budgetReport|anthropicClient|scripts\/optimization/],
  ['Program Outcomes / curriculum', /programPoReferences|programOutcome|programMasters|officialProgramOutcomes|curriculum|po-controlled|lcup-po|programs\.js|programEgas/i],
  ['Subject management / academic year', /subject|academicYear|AcademicYear|CourseOutcomes|SubjectSetup|catalog/i],
  ['Database schema / migrations', /server\/db\//],
  ['Saved reports', /repository\.js|report/i],
  ['Faculty/Admin workflows (UI, routes)', /^src\/(views|components)\/|^server\/routes\//],
  ['Localization', /^src\/i18n\//],
  ['E2E / test infrastructure', /^scripts\/e2e\/|^scripts\/po-controlled|^tests\/|\.test\.|stability/],
];
const areaOf = (file) => AREAS.filter(([, re]) => re.test(file)).map(([name]) => name);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const tested = new Map(manifest.files.map((f) => [f.file, f.sha256]));
const now = current();
const added = [], removed = [], changed = [];
for (const [f, h] of now) { if (!tested.has(f)) added.push(f); else if (tested.get(f) !== h) changed.push(f); }
for (const f of tested.keys()) if (!now.has(f)) removed.push(f);
const releaseCandidateHash = sha(JSON.stringify([...now.entries()]));
const group = (list) => { const out = {}; for (const f of list) for (const a of (areaOf(f).length ? areaOf(f) : ['other'])) (out[a] ||= []).push(f); return out; };
const result = { comparedAt: new Date().toISOString(), head: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim(), testedSourceHash: manifest.sourceHash, testedFiles: tested.size, currentFiles: now.size,
  unchanged: now.size - added.length - changed.length, added, removed, changed, byArea: { added: group(added), changed: group(changed), removed: group(removed) }, releaseCandidateHash, matchesSnapshot: !added.length && !removed.length && !changed.length };
console.log(JSON.stringify({ testedFiles: result.testedFiles, currentFiles: result.currentFiles, unchanged: result.unchanged, added: added.length, changed: changed.length, removed: removed.length, matchesSnapshot: result.matchesSnapshot, releaseCandidateHash }, null, 1));
for (const [kind, groups] of Object.entries(result.byArea)) for (const [area, list] of Object.entries(groups)) console.log(kind.padEnd(8), area.padEnd(40), list.length, list.slice(0, 6).join(', ') + (list.length > 6 ? ', ...' : ''));
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2));
