'use strict';
// Stage S7, offline tests only (anthropic-harness.test.js): `node --require <this file> scripts/eval-alignment.cjs --provider anthropic --confirm-paid ...`
// answers every Anthropic request of that process from the offline replay (anthropicReplay.js over the Phase 3 oracle, which answers ALIGNED with quotes
// from each relationship's own texts), so a paid-mode evaluation runs end to end with nothing sent. It replaces the global fetch, which the script keeps
// as the guard's transport and then blocks, so every request still goes through the guard, the adapter and the SDK; the replay refuses any other
// address. SYLLABUS_CHECK_REPLAY_FAULTS may hold a JSON object of faults by request number ({"2": {"status": 529}}, anthropicReplay.js);
// SYLLABUS_CHECK_REPLAY_THINKING the thinking mode (reported, the default; zero, unreported or absent); SYLLABUS_CHECK_REPLAY_MODEL the model every answer
// names (by default the one asked for). Every answer carries a request id req_replay_N. It loads only when SYLLABUS_CHECK_OFFLINE_REPLAY=test, so it is
// never picked up by accident.
if (process.env.SYLLABUS_CHECK_OFFLINE_REPLAY !== 'test') throw Error('anthropicReplayPreload.js is for offline tests only (SYLLABUS_CHECK_OFFLINE_REPLAY=test)');
const { createOracle } = require('./phase3/oracle');
const { createAnthropicReplay } = require('./anthropicReplay');

const faults = JSON.parse(process.env.SYLLABUS_CHECK_REPLAY_FAULTS || '{}');
const replay = createAnthropicReplay(createOracle({}), { thinking: process.env.SYLLABUS_CHECK_REPLAY_THINKING || 'reported', model: process.env.SYLLABUS_CHECK_REPLAY_MODEL || null, fault: n => faults[n] || null });
globalThis.fetch = replay.transport;
