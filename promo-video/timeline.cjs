// One timeline shared by the picture (promo.html) and the sound (audio.mjs). 120 BPM: a beat is 0.5 s, every cut lands on a beat.
const TL = {
  duration: 25, fps: 30, bpm: 120,
  cuts: { hook: 0, build: 3.5, review: 9.5, organize: 15.5, end: 21.5 },
  // sfx: [time s, kind, gain]
  sfx: [
    [0.15, 'tick', 0.5], [0.55, 'tick', 0.5], [0.95, 'tick', 0.5], [1.35, 'tick', 0.5],
    [2.4, 'snap', 0.9],
    [3.2, 'whoosh', 0.8], [3.55, 'hit', 0.9],
    [4.55, 'pop', 0.5], [5.2, 'type', 0.5], [5.55, 'type', 0.5], [5.9, 'type', 0.5],
    [6.5, 'whoosh_s', 0.6], [7.25, 'pop', 0.45], [7.65, 'pop', 0.45], [8.05, 'pop', 0.45],
    [9.2, 'whoosh', 0.8], [9.55, 'hit', 0.9],
    [10.6, 'pop', 0.5], [11.6, 'whoosh_s', 0.6],
    [12.9, 'click', 0.9], [13.1, 'chime', 0.9],
    [15.2, 'whoosh', 0.8], [15.55, 'hit', 0.9],
    [16.6, 'whoosh_s', 0.6], [17.1, 'tick2', 0.7], [17.45, 'tick2', 0.7], [17.8, 'tick2', 0.7], [18.15, 'tick2', 0.7],
    [19.3, 'whoosh_s', 0.6],
    [21.1, 'riser', 0.8], [21.55, 'hit', 1.0], [21.8, 'shimmer', 0.8],
    [22.4, 'pop', 0.5], [22.9, 'pop', 0.5], [23.4, 'pop', 0.6], [23.6, 'chime', 0.6]
  ]
};
if (typeof module !== 'undefined') module.exports = TL; else window.TL = TL;
