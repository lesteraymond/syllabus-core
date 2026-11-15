'use strict';
// Re-planned AI Checker (docs/ai-checker-replan.md). Not wired into the running server.
module.exports = { ...require('./rules'), ...require('./check'), ...require('./plan') };
