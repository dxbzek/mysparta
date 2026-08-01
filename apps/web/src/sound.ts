/**
 * Synthesized SFX — no audio assets, just Web Audio oscillators and noise.
 * Everything is fire-and-forget and safe to call before user interaction
 * (silently does nothing until the browser allows an AudioContext).
 */

const KEY = "agoge.muted";

let muted = false;
try {
  muted = localStorage.getItem(KEY) === "1";
} catch {
  /* storage may be unavailable */
}

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  from: number,
  to: number,
  dur: number,
  type: OscillatorType,
  gain: number,
  when = 0,
) {
  const c = ac();
  if (!c) return;
  try {
    const t0 = c.currentTime + when;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, from), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    /* never let audio break the game */
  }
}

function noise(dur: number, cutoff: number, gain: number, when = 0) {
  const c = ac();
  if (!c) return;
  try {
    const t0 = c.currentTime + when;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(g).connect(c.destination);
    src.start(t0);
  } catch {
    /* ignore */
  }
}

export const sound = {
  isMuted: () => muted,
  setMuted(m: boolean) {
    muted = m;
    try {
      localStorage.setItem(KEY, m ? "1" : "0");
    } catch {
      /* ignore */
    }
  },

  hit(crit: boolean) {
    if (muted) return;
    noise(0.09, 900, 0.28);
    tone(150, 55, 0.13, "sine", 0.4);
    if (crit) {
      noise(0.16, 2400, 0.3, 0.02);
      tone(220, 60, 0.22, "square", 0.16, 0.02);
    }
  },
  block() {
    if (muted) return;
    tone(720, 480, 0.12, "square", 0.14);
    noise(0.05, 4000, 0.12);
  },
  whoosh() {
    if (muted) return;
    noise(0.18, 1400, 0.1);
  },
  throwSpear() {
    if (muted) return;
    noise(0.24, 2000, 0.12);
    tone(900, 300, 0.2, "sine", 0.05);
  },
  beast() {
    if (muted) return;
    tone(130, 60, 0.3, "sawtooth", 0.2);
    noise(0.2, 500, 0.12, 0.04);
  },
  power() {
    if (muted) return;
    tone(180, 640, 0.32, "sawtooth", 0.14);
    tone(90, 320, 0.32, "triangle", 0.14);
  },
  heal() {
    if (muted) return;
    tone(460, 760, 0.22, "sine", 0.1);
  },
  drum() {
    if (muted) return;
    tone(110, 55, 0.18, "sine", 0.4);
    tone(110, 55, 0.18, "sine", 0.4, 0.24);
    noise(0.05, 600, 0.15, 0.24);
  },
  fanfare(won: boolean) {
    if (muted) return;
    if (won) {
      [392, 523, 659, 784].forEach((f, i) => tone(f, f, 0.24, "triangle", 0.2, i * 0.15));
      noise(0.5, 3000, 0.05, 0.45);
    } else {
      [330, 262, 196].forEach((f, i) => tone(f, f * 0.98, 0.34, "triangle", 0.16, i * 0.24));
    }
  },
  levelUp() {
    if (muted) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.2, "triangle", 0.18, i * 0.11));
  },
};
