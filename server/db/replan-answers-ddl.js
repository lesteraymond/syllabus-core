// The re-planned AI Checker's stored answers (server/lib/syllabuscheck/pipeline/answerStore.js). One row per checklist question, keyed by a
// SHA-256 of the rules version, prompt version, model, course and the exact texts on both sides, so a re-check of unchanged text reuses the same
// answer even after a server restart, and any change of text, model, prompt or rules asks again. Not linked to a syllabus: the same texts give the
// same answer wherever they appear. An answer holds the AI's short quote and explanation, so rows unused for a long time can be pruned
// (answerStore.js pruneUnused). Additive: the live checker and the official score never read it.
// Used by migrate-replan-answers.js; server/db/schema.sql carries the same definition for fresh installs (answerStore.test.js checks that the two agree).
module.exports = [
  `CREATE TABLE IF NOT EXISTS replan_answers (
    answer_key CHAR(64) NOT NULL PRIMARY KEY,
    relationship VARCHAR(40) NOT NULL,
    model VARCHAR(120) NOT NULL,
    prompt_version VARCHAR(40) NOT NULL,
    rules_version VARCHAR(40) NOT NULL,
    answer_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_replan_answers_updated (updated_at)
  )`,
];
