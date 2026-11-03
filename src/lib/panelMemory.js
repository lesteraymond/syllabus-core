// What the recommendation panel holds that the server does not store: the text being edited, what "Check & improve" found, and a
// "Check & improve" that is still running. Kept here (not in the component) so leaving the page and coming back finds it as it was.
// It lasts for the browser session; a reload starts clean, because the server keeps only the saved decisions.
const KEEP = 20; // runs remembered at once
const memory = new Map(); // run id -> { edits, refined, running: Map(suggestion id -> promise that always resolves) }

export function memoryOf(runId) {
  if (!memory.has(runId)) {
    memory.set(runId, { edits: {}, refined: {}, running: new Map() });
    while (memory.size > KEEP) memory.delete(memory.keys().next().value);
  }
  return memory.get(runId);
}

export const forgetMemory = () => memory.clear();
