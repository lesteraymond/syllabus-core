import { useEffect, useRef } from 'react';
import { notifications as notificationsApi } from './api';

// Polls /notifications/summary while the tab is visible and calls onChange when the counts or the latest
// message time changed since the last poll. Stops when disabled (signed out) or unmounted.
// Calls refresh() every intervalMs while the tab is visible, and once more when the tab becomes visible again, so what changed meanwhile
// (another person's new profile picture, for one) shows without a reload. It does not call on mount: the caller has just loaded.
export function usePeriodicRefresh(enabled, refresh, intervalMs = 60000) {
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; });
  useEffect(() => {
    if (!enabled) return undefined;
    const run = () => { if (document.visibilityState === 'visible') refreshRef.current(); };
    const id = setInterval(run, intervalMs);
    document.addEventListener('visibilitychange', run);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', run); };
  }, [enabled, intervalMs]);
}

export function useNotificationPolling(enabled, onChange, intervalMs = 25000) {
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  useEffect(() => {
    if (!enabled) return undefined;
    let stopped = false;
    let last = null;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return; // hidden tab: no requests
      try {
        const s = await notificationsApi.summary();
        if (stopped) return;
        const key = `${s.unreadMessages}|${s.unreadNotifications}|${s.latestMessageAt}`;
        if (last !== null && last !== key) onChangeRef.current();
        last = key;
      } catch {
        // offline or signed out: try again on the next tick
      }
    };
    tick(); // first call only records the baseline
    const id = setInterval(tick, intervalMs);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, intervalMs]);
}
