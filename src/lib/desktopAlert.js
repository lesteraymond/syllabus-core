// A new notification gets a short chime and, when the app is not in front, a desktop notification (Windows shows it at the bottom right,
// macOS at the top right). The browser asks the person once for permission, on their first click in the app; saying no only drops the
// desktop popup, the chime still plays. Nothing here talks to the server.

// The unread notifications that were not there last time. The first list after sign-in only records what exists: old notifications never chime.
export function newArrivals(seen, items) {
  const list = Array.isArray(items) ? items : [];
  if (!seen) return { seen: new Set(list.map((n) => n.id)), fresh: [] };
  const fresh = list.filter((n) => n && !n.isRead && !seen.has(n.id));
  return { seen: new Set([...seen, ...list.map((n) => n.id)]), fresh };
}

let audio = null;
// Two soft tones made in the browser (no sound file). Browsers allow sound only after the person has clicked or typed in the page once.
export function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audio = audio || new Ctx();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    const now = audio.currentTime;
    [[880, 0], [1320, 0.12]].forEach(([freq, at]) => {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.18, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.35);
      osc.connect(gain).connect(audio.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.4);
    });
  } catch { /* no sound is never an error */ }
}

const canNotify = () => typeof window !== 'undefined' && 'Notification' in window;

// Browsers keep a page silent until the person clicks or types in it: the first click also wakes the sound, so later chimes are heard.
function unlockSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audio = audio || new Ctx();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
  } catch { /* no sound is never an error */ }
}

// On the first click or key press: wake the sound, and ask once for desktop notifications (browsers refuse a request the person did not start).
export function askPermissionOnFirstGesture() {
  if (typeof window === 'undefined' || !window.addEventListener) return () => {};
  const ask = () => {
    off();
    unlockSound();
    if (canNotify() && Notification.permission === 'default') { try { Notification.requestPermission().catch(() => {}); } catch { /* old browsers */ } }
  };
  const off = () => { window.removeEventListener('pointerdown', ask); window.removeEventListener('keydown', ask); };
  window.addEventListener('pointerdown', ask, { once: true });
  window.addEventListener('keydown', ask, { once: true });
  return off;
}

// Settings' "Test notification": the chime now, and a desktop popup even with the app in front. Says what stopped the popup, if anything:
// 'shown', 'denied' (blocked for this site: allow it in the browser's site settings), 'default' (not answered yet) or 'unsupported'.
export async function testAlert() {
  unlockSound();
  playChime();
  if (!canNotify()) return 'unsupported';
  let permission = Notification.permission;
  if (permission === 'default') { try { permission = await Notification.requestPermission(); } catch { /* old browsers */ } }
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'default';
  try {
    new Notification('Syllabus Repository', { body: 'Test notification: sound and desktop popups are working.', icon: '/lcup-logo.png', tag: 'notif-test' });
    return 'shown';
  } catch { return 'unsupported'; }
}

// The desktop popup, only while the app is in the background (in front, the bell and the chime already show it). Clicking it brings the
// app forward and opens the notification.
export function showDesktop(n, { title, body, onOpen } = {}) {
  if (!canNotify() || Notification.permission !== 'granted') return null;
  if (document.visibilityState === 'visible' && document.hasFocus()) return null;
  try {
    const popup = new Notification(title || 'Syllabus Repository', { body: body || '', icon: '/lcup-logo.png', tag: 'notif-' + n.id });
    popup.onclick = () => { window.focus(); if (onOpen) onOpen(n); popup.close(); };
    return popup;
  } catch { return null; }
}
