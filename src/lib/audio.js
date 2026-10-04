// SFX + backsound 8-bit, semuanya disintesis di browser (tanpa file audio).
let ctx = null;
let sfxGain = null;
let bgmGain = null;
const state = { sfx: true, bgm: true };
try {
  const s = JSON.parse(localStorage.getItem('tq_audio') || 'null');
  if (s) Object.assign(state, s);
} catch { /* abaikan */ }

const save = () => { try { localStorage.setItem('tq_audio', JSON.stringify(state)); } catch { /* abaikan */ } };

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.5;
    sfxGain.connect(ctx.destination);
    bgmGain = ctx.createGain();
    bgmGain.gain.value = 0.16;
    bgmGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(dest, { f, t = 0, d = 0.08, type = 'square', v = 0.25, to = null }) {
  const c = ctx;
  const o = c.createOscillator();
  const g = c.createGain();
  const t0 = c.currentTime + t;
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + d);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  o.connect(g);
  g.connect(dest);
  o.start(t0);
  o.stop(t0 + d + 0.02);
}

let noiseBuf = null;
function noise(dest, { t = 0, d = 0.05, v = 0.15 }) {
  const c = ctx;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 0.2, c.sampleRate);
    const a = noiseBuf.getChannelData(0);
    for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const g = c.createGain();
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 6000;
  const t0 = c.currentTime + t;
  g.gain.setValueAtTime(v, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  s.connect(hp);
  hp.connect(g);
  g.connect(dest);
  s.start(t0);
  s.stop(t0 + d + 0.02);
}

const play = (fn) => {
  if (!state.sfx) return;
  if (!ensure()) return;
  fn();
};

export const sfx = {
  click: () => play(() => { tone(sfxGain, { f: 520, d: 0.05 }); tone(sfxGain, { f: 780, t: 0.045, d: 0.07 }); }),
  pick: () => play(() => { tone(sfxGain, { f: 392, d: 0.06 }); tone(sfxGain, { f: 587, t: 0.05, d: 0.06 }); tone(sfxGain, { f: 784, t: 0.1, d: 0.09 }); }),
  nav: () => play(() => { [262, 330, 392, 523].forEach((f, i) => tone(sfxGain, { f, t: i * 0.045, d: 0.07 })); }),
  flip: () => play(() => { tone(sfxGain, { f: 300, to: 900, d: 0.14, type: 'triangle', v: 0.3 }); }),
  back: () => play(() => { tone(sfxGain, { f: 523, d: 0.05 }); tone(sfxGain, { f: 330, t: 0.05, d: 0.08 }); }),
  on: () => play(() => { tone(sfxGain, { f: 440, d: 0.06 }); tone(sfxGain, { f: 880, t: 0.06, d: 0.1 }); }),
  off: () => { if (!ensure()) return; tone(sfxGain, { f: 880, d: 0.06 }); tone(sfxGain, { f: 330, t: 0.06, d: 0.1 }); },
  ok: () => play(() => { [523, 659, 784, 1047].forEach((f, i) => tone(sfxGain, { f, t: i * 0.08, d: 0.12 })); tone(sfxGain, { f: 1047, t: 0.34, d: 0.3, v: 0.2 }); }),
  err: () => play(() => { tone(sfxGain, { f: 180, d: 0.18, type: 'sawtooth', v: 0.25 }); tone(sfxGain, { f: 120, t: 0.16, d: 0.24, type: 'sawtooth', v: 0.25 }); }),
  snap: () => play(() => { noise(sfxGain, { d: 0.12, v: 0.4 }); tone(sfxGain, { f: 1200, to: 400, d: 0.1, v: 0.2 }); }),
};

// ---------- BGM: loop chiptune pendek (Am - F - C - G) ----------
const BPM = 104;
const STEP = 60 / BPM / 2; // not delapan
const N = { A2: 110, F2: 87.31, C3: 130.81, G2: 98, A4: 440, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, F4: 349.23, B4: 493.88, D4: 293.66, E4: 329.63, G4: 392 };
const BASS = ['A2', 'F2', 'C3', 'G2'];
const LEAD = [
  ['E5', null, 'A4', 'C5', 'E5', null, 'D5', 'C5'],
  ['C5', null, 'A4', 'F4', 'A4', null, 'C5', 'A4'],
  ['G4', null, 'C5', 'E5', 'G5', null, 'E5', 'C5'],
  ['D5', null, 'B4', 'G4', 'B4', 'D5', 'B4', 'G4'],
  ['E5', 'E5', 'A4', 'C5', 'E5', null, 'G5', 'E5'],
  ['A4', null, 'C5', 'A4', 'F4', null, 'A4', 'C5'],
  ['G5', null, 'E5', 'C5', 'E5', null, 'G4', 'C5'],
  ['D5', 'B4', 'G4', 'B4', 'D5', null, 'D5', null],
];
let timer = null;
let nextT = 0;
let step = 0;

function schedule() {
  while (nextT < ctx.currentTime + 0.25) {
    const bar = Math.floor(step / 8) % LEAD.length;
    const i = step % 8;
    const dt = nextT - ctx.currentTime;
    const note = LEAD[bar][i];
    if (note) tone(bgmGain, { f: N[note], t: dt, d: STEP * 0.85, type: 'square', v: 0.14 });
    if (i % 2 === 0) tone(bgmGain, { f: N[BASS[bar % 4]], t: dt, d: STEP * 1.8, type: 'triangle', v: 0.32 });
    if (i % 2 === 1) noise(bgmGain, { t: dt, d: 0.03, v: 0.12 });
    nextT += STEP;
    step++;
  }
}

function startBgm() {
  if (timer || !state.bgm) return;
  if (!ensure()) return;
  nextT = ctx.currentTime + 0.1;
  timer = setInterval(schedule, 60);
}
function stopBgm() {
  if (timer) clearInterval(timer);
  timer = null;
}

export const audio = {
  get: () => ({ ...state }),
  // panggil dari event klik pertama (browser butuh gesture)
  unlock: () => { if (ensure() && state.bgm) startBgm(); },
  setSfx: (on) => { state.sfx = on; save(); if (on) { ensure(); sfx.on(); } else sfx.off(); },
  setBgm: (on) => {
    state.bgm = on;
    save();
    if (on) { startBgm(); } else stopBgm();
    if (state.sfx) (on ? sfx.on : sfx.off)();
  },
};

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopBgm();
    else if (ctx && state.bgm) startBgm();
  });
}
