// A new notification gets a short chime and, when the app is not in front, a desktop notification (Windows shows it at the bottom right,
// macOS at the top right). Each user can choose On, Do Not Disturb (dnd), or Off in Settings. Nothing here talks to the server.

export const NOTIFICATION_MODES = ['on', 'dnd', 'off'];
const modeKey = (userId) => (userId != null && userId !== '' ? 'notif-mode:' + userId : 'notif-mode');

export function getNotificationMode(userId) {
  try {
    if (typeof localStorage === 'undefined') return 'on';
    const raw = localStorage.getItem(modeKey(userId));
    return NOTIFICATION_MODES.includes(raw) ? raw : 'on';
  } catch {
    return 'on';
  }
}

export function setNotificationMode(mode, userId) {
  const next = NOTIFICATION_MODES.includes(mode) ? mode : 'on';
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(modeKey(userId), next);
  } catch { /* storage unavailable */ }
  return next;
}

export function shouldPlayAlert(userId) {
  return getNotificationMode(userId) === 'on';
}

// The unread notifications that were not there last time. The first list after sign-in only records what exists: old notifications never chime.
export function newArrivals(seen, items) {
  const list = Array.isArray(items) ? items : [];
  if (!seen) return { seen: new Set(list.map((n) => n.id)), fresh: [] };
  const fresh = list.filter((n) => n && !n.isRead && !seen.has(n.id));
  return { seen: new Set([...seen, ...list.map((n) => n.id)]), fresh };
}

let audio = null;
// Two soft tones made in the browser (no sound file). Browsers allow sound only after the person has clicked or typed in the page once.
export function playChime({ force = false, userId } = {}) {
  if (!force && !shouldPlayAlert(userId)) return;
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

// Settings' "Test notification": checks the user's mode first ('dnd' / 'off' stay silent), otherwise plays the chime and shows a desktop popup.
export async function testAlert(userId) {
  const mode = getNotificationMode(userId);
  if (mode !== 'on') return mode;
  unlockSound();
  playChime({ force: true, userId });
  if (!canNotify()) return 'unsupported';
  let permission = Notification.permission;
  if (permission === 'default') { try { permission = await Notification.requestPermission(); } catch { /* old browsers */ } }
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'default';
  try {
    new Notification('Syllabus Repository', { body: 'Test notification: sound and desktop popups are working.', icon: '/lcup-logo.png', tag: 'notif-test' });
    return 'shown';
  } catch { return 'unsupported'; }
}

// The desktop popup, only while the app is in the background and the user's notification mode is On. Clicking it brings the app forward and opens the notification.
export function showDesktop(n, { title, body, onOpen, userId } = {}) {
  if (!shouldPlayAlert(userId)) return null;
  if (!canNotify() || Notification.permission !== 'granted') return null;
  if (document.visibilityState === 'visible' && document.hasFocus()) return null;
  try {
    const popup = new Notification(title || 'Syllabus Repository', { body: body || '', icon: '/lcup-logo.png', tag: 'notif-' + n.id });
    popup.onclick = () => { window.focus(); if (onOpen) onOpen(n); popup.close(); };
    return popup;
  } catch { return null; }
}
