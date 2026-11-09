'use strict';
// A small STATEFUL in-memory stand-in for the MySQL tables the checking service and the recommendation routes use. It answers exactly the SQL the
// production code issues (matched by shape) and THROWS on any other statement, so a test also proves the code touched nothing else: in
// particular, that nothing ever UPDATEs the faculty's syllabus content. Test support only: it is not a general SQL engine.
function createMemoryDb({ syllabus } = {}) {
  const state = { runs: [], areas: [], findings: [], reports: new Map(), decisions: [], logs: [], syllabus: { syllabus_id: 100, user_id: 26, status: 'draft', content: '{}', ...syllabus }, nextRun: 1, nextDecision: 1, statements: [] };
  const norm = (sql) => sql.replace(/\s+/g, ' ').trim();
  const cols = (sql) => /\(([^)]+)\)\s*VALUES/i.exec(sql)[1].split(',').map((c) => c.trim());
  const byDesc = (rows) => rows.slice().sort((a, b) => b.run_id - a.run_id);
  const db = {
    state,
    async query(sqlRaw, params = []) {
      const sql = norm(sqlRaw);
      state.statements.push(sql.split(' ').slice(0, 4).join(' '));
      let m;
      if (/^SELECT 1 FROM ai_check_runs LIMIT 1/.test(sql)) return [[{ 1: 1 }]];
      if (/^INSERT INTO ai_check_runs/.test(sql)) {
        const row = Object.fromEntries(cols(sql).map((c, i) => [c, params[i] === undefined ? null : params[i]]));
        Object.assign(row, { run_id: state.nextRun++, provider: null, model: null, prompt_version: null, ai_error: null, created_at: new Date() });
        state.runs.push(row); return [{ insertId: row.run_id }];
      }
      if (/^UPDATE ai_check_runs SET provider = \?, model = \?, ai_error = \? WHERE run_id = \?/.test(sql)) { Object.assign(state.runs.find((r) => r.run_id === params[3]), { provider: params[0], model: params[1], ai_error: params[2] }); return [{ affectedRows: 1 }]; }
      if (/^INSERT INTO ai_check_area_scores/.test(sql)) { params[0].forEach(([run_id, area_key, name, weight, score]) => state.areas.push({ run_id, area_key, name, weight, score })); return [{ affectedRows: params[0].length }]; }
      if (/^INSERT INTO ai_findings/.test(sql)) { const c = cols(sql); params[0].forEach((v) => state.findings.push(Object.fromEntries(c.map((k, i) => [k, v[i]])))); return [{ affectedRows: params[0].length }]; }
      if (/^INSERT INTO syllabus_check_reports/.test(sql)) { state.reports.set(params[0], { reference_hash: params[1], report_json: params[2] }); return [{ affectedRows: 1 }]; }
      if (/^SELECT reference_hash, report_json FROM syllabus_check_reports WHERE run_id = \?/.test(sql)) return [state.reports.has(params[0]) ? [state.reports.get(params[0])] : []];
      if (/^SELECT run_id, area_key, name, weight, score FROM ai_check_area_scores WHERE run_id IN/.test(sql)) return [state.areas.filter((a) => params[0].includes(a.run_id))];
      if (/^SELECT \* FROM ai_findings WHERE run_id = \?/.test(sql)) return [state.findings.filter((f) => f.run_id === params[0])];
      if (/^SELECT p\.report_json FROM syllabus_check_reports p JOIN ai_check_runs r/.test(sql)) return [byDesc(state.runs.filter((r) => r.syllabus_id === params[0])).slice(0, params[1]).filter((r) => state.reports.has(r.run_id)).map((r) => ({ report_json: state.reports.get(r.run_id).report_json }))];
      if (/^SELECT r\.run_id, p\.report_json FROM ai_check_runs r JOIN syllabus_check_reports p/.test(sql)) return [byDesc(state.runs.filter((r) => r.syllabus_id === params[0])).slice(0, params[1]).filter((r) => state.reports.has(r.run_id)).map((r) => ({ run_id: r.run_id, report_json: state.reports.get(r.run_id).report_json }))];
      if (/^SELECT run_id, suggestion_id, action FROM syllabus_check_decisions WHERE run_id IN/.test(sql)) return [state.decisions.filter((d) => params[0].includes(d.run_id)).map((d) => ({ run_id: d.run_id, suggestion_id: d.suggestion_id, action: d.action }))];
      if (/^INSERT INTO syllabus_check_decisions/.test(sql)) { const d = { decision_id: state.nextDecision++, run_id: params[0], suggestion_id: params[1], action: params[2], edited_text: params[3], user_id: params[4] }; state.decisions.push(d); return [{ insertId: d.decision_id }]; }
      if (/^SELECT decision_id/.test(sql)) return [state.decisions.filter((d) => d.run_id === params[0]).map((d) => ({ id: d.decision_id, suggestionId: d.suggestion_id, action: d.action, editedText: d.edited_text, userId: d.user_id }))];
      if ((m = /^SELECT \* FROM ai_check_runs WHERE run_id = \?/.exec(sql))) return [state.runs.filter((r) => r.run_id === params[0])];
      if (/^SELECT \* FROM ai_check_runs WHERE syllabus_id = \? AND content_hash = \?/.test(sql)) return [byDesc(state.runs.filter((r) => r.syllabus_id === params[0] && r.content_hash === params[1] && r.standard_version === params[2])).slice(0, 1)];
      if (/^SELECT \* FROM ai_check_runs WHERE syllabus_id = \?/.test(sql)) return [byDesc(state.runs.filter((r) => r.syllabus_id === params[0])).slice(0, 1)];
      if (/^SELECT s\.\*, r\.run_id FROM ai_check_runs r JOIN syllabi s/.test(sql)) return [state.runs.some((r) => r.run_id === params[0]) ? [{ ...state.syllabus, run_id: params[0] }] : []];
      if (/^SELECT user_id FROM users/.test(sql)) return [[{ user_id: params[0] }]];
      if (/^INSERT INTO submission_logs/.test(sql)) { state.logs.push({ syllabusId: params[0], userId: params[1], action: params[2], notes: params[3] }); return [{ insertId: state.logs.length }]; }
      if (/program_po_reference_remediation/.test(sql)) return [[]];
      throw new Error('memdb: unexpected statement: ' + sql);
    },
  };
  return db;
}
module.exports = { createMemoryDb };
