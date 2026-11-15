'use strict';
// Re-planned AI Checker: where answers are kept, so a re-check of unchanged text gives the same answer (judge.js reuses an answer by its key).
//
//   memoryStore()          a bounded in-process Map (lost on restart)
//   dbAnswerStore(db)      the table replan_answers (db/replan-answers-ddl.js; npm run migrate-replan-answers): survives restarts
//   layeredStore(a, b)     memory in front of the database: reads memory first, writes both
//
// A store has get(key), set(key, answer, meta), and optionally getMany(keys) / setMany(entries) for one round trip per check. The database store
// never breaks a check: if its table is missing or a query fails, it answers "not stored" and records why (status()), and the check simply asks
// the AI again. Only what judge.js stores is kept: verified answers (items, quote, explanation), never INSUFFICIENT_EVIDENCE.

const CHUNK = 500;

function memoryStore(max = 20000) {
  const map = new Map();
  return {
    kind: 'memory',
    get: key => map.get(key),
    set: (key, value) => { map.delete(key); map.set(key, value); while (map.size > max) map.delete(map.keys().next().value); },
    async getMany(keys) { const out = new Map(); for (const k of keys) if (map.has(k)) out.set(k, map.get(k)); return out; },
    async setMany(entries) { for (const e of entries) this.set(e.key, e.answer); },
    status: () => ({ kind: 'memory', entries: map.size }),
    get size() { return map.size; },
  };
}

function dbAnswerStore(db) {
  const state = { kind: 'database', available: true, problem: null, reads: 0, hits: 0, writes: 0 };
  const fail = error => {
    state.available = false;
    state.problem = error && error.code === 'ER_NO_SUCH_TABLE' ? 'the table replan_answers is missing: run npm run migrate-replan-answers' : 'database error: ' + String((error && (error.code || error.message)) || error).slice(0, 120);
  };
  const parse = text => { try { const a = JSON.parse(text); return a && typeof a === 'object' && a.items ? a : undefined; } catch { return undefined; } };
  return {
    kind: 'database',
    async getMany(keys) {
      const out = new Map();
      if (!state.available || !keys.length) return out;
      try {
        for (let i = 0; i < keys.length; i += CHUNK) {
          const part = keys.slice(i, i + CHUNK);
          const [rows] = await db.query('SELECT answer_key, answer_json FROM replan_answers WHERE answer_key IN (?)', [part]);
          state.reads += part.length;
          for (const row of rows) { const a = parse(row.answer_json); if (a) { out.set(row.answer_key, a); state.hits += 1; } }
        }
      } catch (error) { fail(error); }
      return out;
    },
    async get(key) { return (await this.getMany([key])).get(key); },
    async setMany(entries) {
      if (!state.available || !entries.length) return;
      try {
        for (let i = 0; i < entries.length; i += CHUNK) {
          const rows = entries.slice(i, i + CHUNK).map(e => [e.key, String(e.meta?.relationship || '').slice(0, 40), String(e.meta?.model || '').slice(0, 120), String(e.meta?.promptVersion || '').slice(0, 40), String(e.meta?.rulesVersion || '').slice(0, 40), JSON.stringify(e.answer)]);
          await db.query('INSERT INTO replan_answers (answer_key, relationship, model, prompt_version, rules_version, answer_json) VALUES ? ON DUPLICATE KEY UPDATE answer_json = VALUES(answer_json)', [rows]);
          state.writes += rows.length;
        }
      } catch (error) { fail(error); }
    },
    async set(key, answer, meta) { await this.setMany([{ key, answer, meta }]); },
    status: () => ({ ...state }),
  };
}

function layeredStore(front, back) {
  return {
    kind: 'layered',
    async getMany(keys) {
      const out = await front.getMany(keys);
      const missing = keys.filter(k => !out.has(k));
      if (missing.length) {
        const found = await back.getMany(missing);
        for (const [k, v] of found) { out.set(k, v); front.set(k, v); }
      }
      return out;
    },
    async get(key) { return (await this.getMany([key])).get(key); },
    async setMany(entries) { await front.setMany(entries); await back.setMany(entries); },
    async set(key, answer, meta) { await this.setMany([{ key, answer, meta }]); },
    status: () => ({ kind: 'layered', front: front.status ? front.status() : null, back: back.status ? back.status() : null }),
  };
}

// Delete answers not written for `days` days (default 180). Returns the number deleted. Run by hand or by a scheduled job; never automatic.
async function pruneUnused(db, days = 180) {
  if (!(Number.isInteger(days) && days >= 1)) throw Error('days must be a whole number of 1 or more');
  const [result] = await db.query('DELETE FROM replan_answers WHERE updated_at < (NOW() - INTERVAL ? DAY)', [days]);
  return result.affectedRows || 0;
}

module.exports = { memoryStore, dbAnswerStore, layeredStore, pruneUnused };
