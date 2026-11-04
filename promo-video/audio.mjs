// Original synthesized score + sound effects, written from timeline.cjs so every hit lands on a cut. Usage: node audio.mjs
import { createRequire } from 'module'; import fs from 'fs';
const TL = createRequire(import.meta.url)('./timeline.cjs');
const SR = 44100, N = Math.ceil(TL.duration * SR);
const mk = () => [new Float32Array(N), new Float32Array(N)];
const music = mk(), sfx = mk();
let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296 * 2 - 1;
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const add = (bus, t0, dur, fn, g = 1, pan = 0) => { const s = Math.max(0, Math.floor(t0 * SR)), e = Math.min(N, Math.floor((t0 + dur) * SR)); const gl = g * Math.cos((pan + 1) * Math.PI / 4), gr = g * Math.sin((pan + 1) * Math.PI / 4); for (let i = s; i < e; i++) { const v = fn((i - s) / SR, (i - s) / (e - s)); bus[0][i] += v * gl; bus[1][i] += v * gr; } };
const env = (t, a, d) => Math.min(1, t / a) * Math.exp(-t / d);
// one-pole lowpass state helper
const lp = (c) => { let y = 0; return (x) => (y += c * (x - y)); };

// ---------- music: 120 BPM, D major, I–vi–IV–V
const B = 0.5, chords = [[62, 66, 69], [59, 62, 66], [55, 59, 62], [57, 61, 64]]; // D, Bm, G, A
const chordAt = t => t >= 21.5 ? [62, 66, 69] : chords[Math.floor(t / 4) % 4];
for (let t = 0; t < TL.duration; t += 4) {
  const ch = t >= 20 ? [62, 66, 69] : chords[Math.floor(t / 4) % 4], dur = t >= 20 ? 5 : 4.3;
  for (const [k, m] of ch.entries()) for (const det of [-0.12, 0.12]) { const f = hz(m + 12) * Math.pow(2, det / 12); const f2 = lp(0.05); add(music, t, dur, (x) => { const saw = ((x * f) % 1) * 2 - 1; return f2(saw) * Math.min(1, x / 0.6) * Math.min(1, (dur - x) / 0.9) * 0.5; }, 0.07, k - 1);}
}
// bass + kick + hat + clap + arp from the first cut (3.5 s) until the end card
for (let t = 3.5; t < 21.5; t += B / 2) {
  const beat = Math.round((t - 3.5) / (B / 2)); const root = chordAt(t)[0] - 24;
  if (beat % 2 === 0) { const f = hz(root); add(music, t, 0.4, (x) => Math.sin(2 * Math.PI * f * x) * env(x, 0.005, 0.18), 0.32); }
  if (beat % 2 === 1) { add(music, t, 0.05, (x) => rnd() * Math.exp(-x * 90), 0.05, 0.4); }
  if (beat % 4 === 0) add(music, t, 0.25, (x) => Math.sin(2 * Math.PI * (45 + 90 * Math.exp(-x * 30)) * x) * Math.exp(-x * 11), 0.55);
  if (t >= 9.5 && beat % 4 === 2) add(music, t, 0.2, (x) => rnd() * Math.exp(-x * 22), 0.14);
  const ch = chordAt(t), note = ch[(beat >> 1) % 3] + 12 + (((beat >> 1) % 4 === 3) ? 12 : 0); const f = hz(note);
  add(music, t, 0.35, (x) => (Math.sin(2 * Math.PI * f * x) + 0.4 * Math.sin(4 * Math.PI * f * x)) * env(x, 0.003, 0.12), 0.1, (beat % 5 - 2) / 4);
}
// intro (0–3.5): soft sub swell, light pulse
add(music, 0, 3.5, (x, p) => Math.sin(2 * Math.PI * hz(38) * x) * p * 0.6, 0.25);
// end card bell + sparkle
for (const [dt, m] of [[0, 74], [0.25, 78], [0.5, 81], [0.75, 86]]) { const f = hz(m); add(music, 21.6 + dt, 2.2, (x) => (Math.sin(2 * Math.PI * f * x) + 0.3 * Math.sin(2 * Math.PI * f * 2.76 * x)) * Math.exp(-x * 2.2), 0.12, dt - 0.4); }

// ---------- sfx
const K = {
  tick: t => add(sfx, t, 0.04, x => (Math.sin(2 * Math.PI * 2400 * x) + rnd() * 0.5) * Math.exp(-x * 140), 0.35),
  tick2: t => add(sfx, t, 0.12, x => Math.sin(2 * Math.PI * 1300 * x) * Math.exp(-x * 45) + 0.3 * Math.sin(2 * Math.PI * 2600 * x) * Math.exp(-x * 60), 0.35),
  type: t => add(sfx, t, 0.03, x => rnd() * Math.exp(-x * 170), 0.35, rnd() * 0.5),
  click: t => { add(sfx, t, 0.05, x => (rnd() * 0.6 + Math.sin(2 * Math.PI * 900 * x)) * Math.exp(-x * 110), 0.5); },
  snap: t => { add(sfx, t, 0.35, x => Math.sin(2 * Math.PI * (160 * Math.exp(-x * 9) + 50) * x) * Math.exp(-x * 9), 0.8); add(sfx, t, 0.12, x => rnd() * Math.exp(-x * 45), 0.35); },
  pop: t => add(sfx, t, 0.18, x => Math.sin(2 * Math.PI * (500 + 700 * Math.exp(-x * 40)) * x) * Math.exp(-x * 26), 0.4),
  hit: t => { add(sfx, t, 0.9, x => Math.sin(2 * Math.PI * (38 + 70 * Math.exp(-x * 14)) * x) * Math.exp(-x * 4.5), 0.85); add(sfx, t, 0.25, x => rnd() * Math.exp(-x * 18), 0.3); },
  whoosh: t => { const f = lp(0.05); add(sfx, t, 0.6, (x, p) => { const a = lp(0.02 + 0.5 * p * p); return f(rnd()) * 0 + a(rnd()) * Math.sin(Math.PI * p) * 2.2; }, 0.55, 0); },
  whoosh_s: t => { let y = 0; add(sfx, t, 0.4, (x, p) => { y += (0.03 + 0.4 * p) * (rnd() - y); return y * Math.sin(Math.PI * p) * 2; }, 0.4); },
  riser: t => { let y = 0; add(sfx, t, 0.5, (x, p) => { y += (0.02 + 0.6 * p * p) * (rnd() - y); return y * p * 2 + Math.sin(2 * Math.PI * (300 + 1800 * p * p) * x) * p * 0.15; }, 0.55); },
  chime: t => { for (const [m, d] of [[88, 0], [91, 0.07], [95, 0.14]]) { const f = hz(m); add(sfx, t + d, 1.6, x => (Math.sin(2 * Math.PI * f * x) + 0.25 * Math.sin(2 * Math.PI * f * 2.7 * x)) * Math.exp(-x * 3.2), 0.28, (d - .07) * 3); } },
  shimmer: t => { for (let i = 0; i < 8; i++) { const f = hz(86 + [0, 4, 7, 9][i % 4] + 12 * (i > 3 ? 1 : 0)); add(sfx, t + i * 0.06, 0.7, x => Math.sin(2 * Math.PI * f * x) * Math.exp(-x * 6), 0.1, rnd()); } },
};
for (const [t, kind, g] of TL.sfx) { const tmp = sfx[0].slice(), tmp2 = sfx[1].slice(); K[kind](t); /* gain applied below */ if (g !== 1) { const s = Math.floor(t * SR), e = Math.min(N, s + 2 * SR); for (let i = s; i < e; i++) { sfx[0][i] = tmp[i] + (sfx[0][i] - tmp[i]) * g; sfx[1][i] = tmp2[i] + (sfx[1][i] - tmp2[i]) * g; } } }

// ---------- write wavs (music alone, sfx alone, and a 2-bus mix for the no-voice preview)
const fade = (b) => { for (let i = 0; i < N; i++) { const t = i / SR; const f = Math.min(1, t / 0.05) * Math.min(1, (TL.duration - t) / 0.8); b[0][i] *= f; b[1][i] *= f; } };
fade(music); fade(sfx);
const norm = (bufs, peak) => { let m = 0; for (const b of bufs) for (let i = 0; i < N; i++) m = Math.max(m, Math.abs(b[0][i]), Math.abs(b[1][i])); const k = peak / (m || 1); for (const b of bufs) for (let i = 0; i < N; i++) { b[0][i] *= k; b[1][i] *= k; } };
norm([music], 0.7); norm([sfx], 0.8);
const wav = (name, b) => { const buf = Buffer.alloc(44 + N * 4); buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40); for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(b[0][i] * 32767))), 44 + i * 4); buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(b[1][i] * 32767))), 46 + i * 4); } fs.writeFileSync(name, buf); };
fs.mkdirSync('audio', { recursive: true }); wav('audio/music.wav', music); wav('audio/sfx.wav', sfx);
console.log('wrote audio/music.wav and audio/sfx.wav');
