import { useEffect, useRef } from 'react';
import { usage as usageApi } from './api';
import { BEAT_MS, isActive } from './activity';

// Tells the server "this person is here" about every 30 seconds, and only while that is true: the tab is visible and there was input
// (mouse, key, scroll, touch) in the last few minutes (see activity.js). The server turns those beats into active time: server/lib/usage.js.
export function useActiveTime(enabled) {
  const lastInput = useRef(Date.now());

  useEffect(() => {
    if (!enabled) return undefined;
    let stopped = false;
    let timer = null;
    const mark = () => { lastInput.current = Date.now(); };
    const inputs = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'];
    inputs.forEach((name) => window.addEventListener(name, mark, { passive: true, capture: true }));
    mark();

    // closing: the last beat is allowed to go out as the tab hides, as long as the person was active up to then.
    const beat = async (closing = false) => {
      if (stopped) return;
      const visible = closing || document.visibilityState === 'visible';
      if (!isActive({ now: Date.now(), lastInputAt: lastInput.current, visible })) return;
      try {
        const answer = await usageApi.heartbeat(closing ? { keepalive: true } : {});
        if (answer && answer.enabled === false) { stopped = true; clearInterval(timer); }   // tracking is off or not set up: stop asking
      } catch {
        // offline or signed out: the next beat tries again
      }
    };

    beat();
    timer = setInterval(() => beat(), BEAT_MS);
    const onVisibility = () => { if (document.visibilityState === 'hidden') beat(true); else beat(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      clearInterval(timer);
      inputs.forEach((name) => window.removeEventListener(name, mark, { capture: true }));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);
}
