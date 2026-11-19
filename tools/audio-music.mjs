/**
 * The placeholder music, synthesised (plan 13.17). Made for this game by this script and given to
 * the public domain (CC0), so a clone of the public repo has music with no paid file. The owner's
 * licensed tracks replace any slot through the private pipeline (tools/audio-private.mjs).
 *
 * Style: a dirty street groove, not an orchestra. Boom-bap drums (a pitched-down kick, a gritty
 * snare, swung hats), an overdriven bass, a dusty electric piano on the menu, overdriven power-
 * chord stabs and a busier kit in the intense fight layer.
 *
 *   menu           88 BPM, 8 bars (21.8 s), E minor: Em C Am B7, laid back
 *   fight-calm    100 BPM, 8 bars (19.2 s): drums, bass ostinato, a low drone
 *   fight-intense the same 8 bars with 16th hats, extra kicks, guitar stabs, crashes and a fill.
 *                 Same tempo and length as fight-calm: the player crossfades the two in sync.
 *   ko, win, lose, level-up: one-shot stings.
 *
 * Every loop is rendered into a circular buffer: a note that rings past the loop end wraps to the
 * start, so the loop has no seam. Deterministic (seeded noise): the same file on every build.
 */
export const MUSIC_RATE = 44100;
const R = MUSIC_RATE;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

/** A one-pole low-pass state machine over a sample stream. */
const lp = (cut) => { const k = 1 - Math.exp((-2 * Math.PI * cut) / R); let y = 0; return (x) => (y += k * (x - y)); };
const hp = (cut) => { const f = lp(cut); return (x) => x - f(x); };

/** A canvas of samples; `loop` true wraps writes past the end to the start. */
function canvas(seconds, loop) {
  const n = Math.round(seconds * R);
  const buf = new Float32Array(n);
  return {
    n, buf,
    add(atSec, samples, gain = 1) {
      const at = Math.round(atSec * R);
      for (let i = 0; i < samples.length; i++) {
        const j = at + i;
        if (loop) buf[((j % n) + n) % n] += gain * samples[i];
        else if (j < n) buf[j] += gain * samples[i];
      }
    },
  };
}

// ---- instruments: each returns mono samples
function kick(seed = 1) {
  const len = Math.round(0.42 * R);
  const out = new Float32Array(len);
  const rand = rng(seed);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / R;
    const f = 44 + 90 * Math.exp(-t / 0.035);
    ph += (2 * Math.PI * f) / R;
    const click = t < 0.004 ? (rand() * 2 - 1) * (1 - t / 0.004) * 0.5 : 0;
    out[i] = Math.tanh(1.8 * Math.sin(ph) * Math.exp(-t / 0.2)) + click;
  }
  return out;
}
function snare(seed = 2, tight = 1) {
  const len = Math.round(0.32 * R);
  const out = new Float32Array(len);
  const rand = rng(seed);
  const band = hp(1400);
  const soft = lp(7000);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / R;
    ph += (2 * Math.PI * (185 + 40 * Math.exp(-t / 0.02))) / R;
    const noise = soft(band(rand() * 2 - 1)) * Math.exp(-t / (0.13 * tight));
    const body = Math.sin(ph) * Math.exp(-t / 0.05);
    out[i] = Math.tanh(1.6 * (0.9 * noise + 0.6 * body));
  }
  return out;
}
function hat(seed = 3, open = false) {
  const len = Math.round((open ? 0.35 : 0.07) * R);
  const out = new Float32Array(len);
  const rand = rng(seed);
  const f = hp(7500);
  for (let i = 0; i < len; i++) out[i] = f(rand() * 2 - 1) * Math.exp(-(i / R) / (open ? 0.14 : 0.022));
  return out;
}
function crash(seed = 4) {
  const len = Math.round(1.8 * R);
  const out = new Float32Array(len);
  const rand = rng(seed);
  const f = hp(3200);
  for (let i = 0; i < len; i++) out[i] = f(rand() * 2 - 1) * Math.exp(-(i / R) / 0.6) * Math.min(1, i / 60);
  return out;
}
/** An overdriven bass note: a band-limited saw, low-passed, through a soft clip. */
function bass(midi, seconds, drive = 2.2) {
  const len = Math.round((seconds + 0.06) * R);
  const out = new Float32Array(len);
  const f = hz(midi);
  const filt = lp(900);
  for (let i = 0; i < len; i++) {
    const t = i / R;
    let v = 0;
    for (let k = 1; k <= 10; k++) v += Math.sin(2 * Math.PI * f * k * t) / k;
    const env = Math.min(1, t / 0.006) * (t < seconds ? Math.exp(-t / 0.9) : Math.exp(-seconds / 0.9) * Math.exp(-(t - seconds) / 0.02));
    out[i] = Math.tanh(drive * filt(v) * env);
  }
  return out;
}
/** A dusty electric piano chord: sines with a bell partial, a slow decay and a tremolo. */
function epiano(midis, seconds) {
  const len = Math.round((seconds + 0.3) * R);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / R;
    const env = Math.min(1, t / 0.01) * Math.exp(-t / 1.6) * (t < seconds ? 1 : Math.exp(-(t - seconds) / 0.12));
    const trem = 0.82 + 0.18 * Math.sin(2 * Math.PI * 4.6 * t);
    let v = 0;
    for (const m of midis) {
      const f = hz(m);
      v += Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * f * 2 * t) * Math.exp(-t / 0.25) + 0.08 * Math.sin(2 * Math.PI * f * 7.1 * t) * Math.exp(-t / 0.05);
    }
    out[i] = (v / midis.length) * env * trem;
  }
  return out;
}
/** An overdriven power-chord stab: detuned saws (root, fifth, octave) into a hard clip. */
function stab(midi, seconds, seed = 5) {
  const len = Math.round((seconds + 0.08) * R);
  const out = new Float32Array(len);
  const notes = [midi, midi + 7, midi + 12];
  const filt = lp(2600);
  const rand = rng(seed);
  const det = notes.map(() => 1 + (rand() - 0.5) * 0.006);
  for (let i = 0; i < len; i++) {
    const t = i / R;
    let v = 0;
    notes.forEach((m, j) => {
      const f = hz(m) * det[j];
      for (let k = 1; k <= 12; k++) v += Math.sin(2 * Math.PI * f * k * t) / k;
    });
    const env = Math.min(1, t / 0.004) * (t < seconds ? Math.exp(-t / 0.5) : Math.exp(-seconds / 0.5) * Math.exp(-(t - seconds) / 0.03));
    out[i] = Math.tanh(4 * filt(v / 3)) * env;
  }
  return out;
}
/** A brass-like stab for the win sting: saws with a filter that opens on the attack. */
function brass(midi, seconds) {
  const len = Math.round((seconds + 0.1) * R);
  const out = new Float32Array(len);
  const f = hz(midi);
  let y = 0;
  for (let i = 0; i < len; i++) {
    const t = i / R;
    let v = 0;
    for (let k = 1; k <= 14; k++) v += Math.sin(2 * Math.PI * f * k * t * (1 + 0.002 * Math.sin(2 * Math.PI * 5 * t))) / k;
    const cut = 600 + 3400 * Math.exp(-t / 0.12);
    const kk = 1 - Math.exp((-2 * Math.PI * cut) / R);
    y += kk * (v - y);
    const env = Math.min(1, t / 0.02) * (t < seconds ? 0.85 + 0.15 * Math.exp(-t / 0.1) : Math.exp(-(t - seconds) / 0.06));
    out[i] = Math.tanh(1.5 * y) * env;
  }
  return out;
}
function drone(midi, seconds) {
  const len = Math.round(seconds * R);
  const out = new Float32Array(len);
  const f = hz(midi);
  const filt = lp(260);
  for (let i = 0; i < len; i++) {
    const t = i / R;
    let v = 0;
    for (let k = 1; k <= 6; k++) v += Math.sin(2 * Math.PI * f * k * t + k) / k;
    out[i] = filt(v) * (0.7 + 0.3 * Math.sin((2 * Math.PI * t) / seconds));
  }
  return out;
}

/** Step times with swing: 16 steps per bar, every second 16th pushed late. */
const stepper = (bpm, swing) => {
  const s16 = 60 / bpm / 4;
  return (bar, step) => bar * 16 * s16 + step * s16 + (step % 2 === 1 ? (swing - 0.5) * 2 * s16 : 0);
};

/** The menu groove. */
function menu() {
  const bpm = 88; const bars = 8; const at = stepper(bpm, 0.6);
  const c = canvas((bars * 4 * 60) / bpm, true);
  const K = kick(11); const S = snare(12); const H = hat(13); const HO = hat(14, true);
  const s16 = 60 / bpm / 4;
  // Em C Am B7, two bars each
  const chords = [[52, 55, 59, 64], [48, 52, 55, 64], [45, 52, 57, 60], [47, 51, 54, 57]];
  const roots = [28, 24, 33, 35];
  for (let bar = 0; bar < bars; bar++) {
    for (const st of [0, 10, 11]) c.add(at(bar, st), K, st === 0 ? 0.9 : 0.6);
    for (const st of [4, 12]) c.add(at(bar, st), S, 0.55);
    for (let st = 0; st < 16; st += 2) c.add(at(bar, st), st === 14 && bar % 2 === 1 ? HO : H, st % 4 === 0 ? 0.22 : 0.14);
    const ch = Math.floor(bar / 2);
    const r = roots[ch];
    // bass: root on 1, octave pop on the "a" of 2, fifth on 3, walk-up into the next bar
    c.add(at(bar, 0), bass(r, 5 * s16), 0.5);
    c.add(at(bar, 7), bass(r + 12, s16), 0.32);
    c.add(at(bar, 8), bass(r + 7, 3 * s16), 0.42);
    c.add(at(bar, 14), bass(r + (bar % 2 === 1 ? 10 : 3), 2 * s16), 0.36);
    if (bar % 2 === 0) c.add(at(bar, 0), epiano(chords[ch], 14 * s16), 0.3);
    else c.add(at(bar, 6), epiano(chords[ch].map((m) => m + 12), 6 * s16), 0.18);
  }
  return c.buf;
}

/** The fight groove; `intense` adds the busier layer on top of the same bars. */
function fight(intense) {
  const bpm = 100; const bars = 8; const at = stepper(bpm, 0.56);
  const c = canvas((bars * 4 * 60) / bpm, true);
  const K = kick(21); const S = snare(22, 0.8); const H = hat(23); const HO = hat(24, true); const CR = crash(25);
  const s16 = 60 / bpm / 4;
  // E minor riff on the bass, the 6th bar up a fourth
  const riff = [[0, 28, 2], [3, 28, 1], [4, 31, 2], [7, 28, 1], [8, 33, 2], [11, 31, 1], [12, 30, 2], [14, 28, 2]];
  c.add(0, drone(16, (bars * 4 * 60) / bpm), 0.22);
  for (let bar = 0; bar < bars; bar++) {
    const lift = bar === 5 || bar === 6 ? 5 : 0;
    for (const st of [0, 7, 10]) c.add(at(bar, st), K, st === 0 ? 0.95 : 0.7);
    for (const st of [4, 12]) c.add(at(bar, st), S, 0.6);
    for (let st = 0; st < 16; st += 2) c.add(at(bar, st), H, st % 4 === 2 ? 0.2 : 0.13);
    for (const [st, m, len] of riff) c.add(at(bar, st), bass(m + lift, len * s16 * 0.9, 2.6), 0.42);
    if (intense) {
      for (let st = 1; st < 16; st += 2) c.add(at(bar, st), H, 0.1);
      c.add(at(bar, 14), HO, 0.16);
      for (const st of [3, 8, 13]) c.add(at(bar, st), K, 0.55);
      c.add(at(bar, 0), stab(40 + lift, 3 * s16), 0.3);
      c.add(at(bar, 6), stab(40 + lift, 2 * s16), 0.24);
      c.add(at(bar, 10), stab(43 + lift, 2 * s16), 0.24);
      if (bar % 4 === 0) c.add(at(bar, 0), CR, 0.28);
      if (bar === bars - 1) for (const st of [12, 13, 14, 15]) c.add(at(bar, st), S, 0.35 + (st - 12) * 0.08);
    }
  }
  return c.buf;
}

function ko() {
  const c = canvas(1.9, false);
  c.add(0, kick(31), 1);
  c.add(0, snare(32), 0.7);
  c.add(0, crash(33), 0.5);
  c.add(0, stab(28, 0.9), 0.55);
  c.add(0.02, bass(16, 1.2, 3), 0.6);
  return c.buf;
}
function win() {
  const c = canvas(2.6, false);
  const s16 = 60 / 120 / 4;
  const notes = [52, 55, 57, 59, 62, 64];
  notes.forEach((m, i) => c.add(i * s16, brass(m, s16 * 0.9), 0.35));
  c.add(6 * s16, brass(64, 1.1), 0.3);
  c.add(6 * s16, brass(68, 1.1), 0.22);
  c.add(6 * s16, brass(71, 1.1), 0.2);
  c.add(0, kick(41), 0.7);
  c.add(6 * s16, kick(42), 0.8);
  c.add(6 * s16, snare(43), 0.5);
  c.add(6 * s16, crash(44), 0.35);
  c.add(6 * s16, bass(28, 1.1), 0.4);
  return c.buf;
}
function lose() {
  const c = canvas(2.6, false);
  [[59, 0], [58, 0.55], [57, 1.1]].forEach(([m, t]) => {
    c.add(t, epiano([m - 12, m - 5, m], 0.5), 0.35);
    c.add(t, bass(m - 36, 0.5, 1.6), 0.35);
  });
  c.add(1.65, epiano([40, 47, 52, 55], 0.8), 0.4);
  c.add(1.65, bass(28, 0.8, 1.4), 0.4);
  c.add(1.65, kick(51), 0.6);
  return c.buf;
}
function levelUp() {
  const c = canvas(1.8, false);
  const s16 = 60 / 132 / 4;
  [52, 56, 59, 64, 68].forEach((m, i) => { c.add(i * s16, epiano([m], s16 * 1.5), 0.45); c.add(i * s16, hat(60 + i), 0.15); });
  c.add(5 * s16, brass(64, 0.7), 0.3);
  c.add(5 * s16, brass(71, 0.7), 0.2);
  c.add(5 * s16, crash(61), 0.3);
  c.add(5 * s16, kick(62), 0.7);
  return c.buf;
}

/** Every synthesised slot: a function giving mono samples at MUSIC_RATE, and whether it loops. */
export const MUSIC_SYNTH = {
  menu: { make: menu, loop: true },
  "fight-calm": { make: () => fight(false), loop: true },
  "fight-intense": { make: () => fight(true), loop: true },
  ko: { make: ko, loop: false },
  win: { make: win, loop: false },
  lose: { make: lose, loop: false },
  "level-up": { make: levelUp, loop: false },
};
