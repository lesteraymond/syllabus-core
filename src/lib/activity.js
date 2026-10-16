// When does a person count as "here"? Pure rules, kept apart from the hook that listens to the browser (useActiveTime.js).
//   IDLE_MS  how long without input before the person counts as away. A tab left open overnight stops counting five minutes after the last click.
//   BEAT_MS  how often a heartbeat is sent while active.
export const IDLE_MS = 5 * 60 * 1000;
export const BEAT_MS = 30 * 1000;

export const isActive = ({ now, lastInputAt, visible, idleMs = IDLE_MS }) => !!visible && now - lastInputAt <= idleMs;
