import { useEffect, useState } from 'react';
import { syllabusCheck } from './api';

// The server's policy on who has the final say over a submit or an approval (GET /syllabus-check/status):
//   'advisory'  the AI result and its recommendations are advice; the person decides once the coded hard gates are clear
//   'required'  a completed, current AI check is also needed
// Read once per page load and shared. Until it is known, or if it cannot be read, the strict rule applies: a slow or missing answer
// can never allow more than the server would. The server enforces the policy either way and explains any refusal.
let known = null;
export function useAiGate() {
  const [gate, setGate] = useState(known || 'required');
  useEffect(() => {
    if (known) return undefined;
    let live = true;
    syllabusCheck.status().then((s) => {
      known = s && s.aiGate === 'advisory' ? 'advisory' : 'required';
      if (live) setGate(known);
    }).catch(() => { /* keep the strict rule */ });
    return () => { live = false; };
  }, []);
  return gate;
}
