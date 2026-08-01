/**
 * Synthesized SFX — no audio assets, just Web Audio oscillators and noise.
 * Everything is fire-and-forget and safe to call before user interaction
 * (silently does nothing until the browser allows an AudioContext).
 *
 * All voices route through a presence shelf + compressor bus: the shelf
 * lifts the top end so hits read crisp, the compressor glues layers
 * together instead of clipping.
 */

const KEY = "agoge.muted";

let muted = false;
try {
  muted = localStorage.getItem(KEY) === "1";
} catch {
  /* storage may be unavailable */
}

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 20;
      comp.ratio.value = 5;
      comp.attack.value = 0.0015;
      comp.release.value = 0.14;
      // presence shelf: the difference between "thud" and "crack"
      const shelf = ctx.createBiquadFilter();
      shelf.type = "highshelf";
      shelf.frequency.value = 3200;
      shelf.gain.value = 4;
      bus = ctx.createGain();
      bus.gain.value = 0.9;
      bus.connect(shelf).connect(comp).connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface ToneOpts {
  from: number;
  to?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  when?: number;
  /** Seconds of linear fade-in before the exponential decay. */
  attack?: number;
  /** Optional filter over the oscillator. */
  filter?: { type: BiquadFilterType; from: number; to?: number; q?: number };
  detune?: number;
  pan?: number;
}

function tone(o: ToneOpts) {
  const c = ac();
  if (!c || !bus) return;
  try {
    const t0 = c.currentTime + (o.when ?? 0);
    const attack = o.attack ?? 0.003;
    const gain = o.gain ?? 0.2;
    const osc = c.createOscillator();
    osc.type = o.type ?? "sine";
    if (o.detune) osc.detune.value = o.detune;
    osc.frequency.setValueAtTime(Math.max(20, o.from), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to ?? o.from), t0 + o.dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + o.dur);
    let head: AudioNode = osc;
    if (o.filter) {
      const f = c.createBiquadFilter();
      f.type = o.filter.type;
      f.frequency.setValueAtTime(o.filter.from, t0);
      if (o.filter.to) f.frequency.exponentialRampToValueAtTime(o.filter.to, t0 + o.dur);
      f.Q.value = o.filter.q ?? 1;
      head.connect(f);
      head = f;
    }
    if (o.pan) {
      const p = c.createStereoPanner();
      p.pan.value = o.pan;
      head.connect(p);
      head = p;
    }
    head.connect(g).connect(bus);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.03);
  } catch {
    /* never let audio break the game */
  }
}

interface NoiseOpts {
  dur: number;
  gain?: number;
  when?: number;
  attack?: number;
  type?: BiquadFilterType;
  /** Filter frequency sweep. */
  from: number;
  to?: number;
  q?: number;
  pan?: number;
}

let noiseBuf: AudioBuffer | null = null;

function noise(o: NoiseOpts) {
  const c = ac();
  if (!c || !bus) return;
  try {
    const t0 = c.currentTime + (o.when ?? 0);
    if (!noiseBuf || noiseBuf.sampleRate !== c.sampleRate) {
      const len = c.sampleRate; // one second, reused and offset for variety
      noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.loopStart = 0;
    src.loopEnd = noiseBuf.duration;
    const f = c.createBiquadFilter();
    f.type = o.type ?? "lowpass";
    f.frequency.setValueAtTime(o.from, t0);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);
    f.Q.value = o.q ?? 0.8;
    const g = c.createGain();
    const attack = o.attack ?? 0.002;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.gain ?? 0.15, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + o.dur);
    let head: AudioNode = f;
    if (o.pan) {
      const p = c.createStereoPanner();
      p.pan.value = o.pan;
      f.connect(p);
      head = p;
    }
    src.connect(f);
    head.connect(g).connect(bus);
    src.start(t0, Math.random());
    src.stop(t0 + o.dur + 0.03);
  } catch {
    /* ignore */
  }
}

/** 1-3ms broadband click — the "edge" on the front of a sound. */
function click(gain = 0.2, when = 0) {
  noise({ dur: 0.012, type: "highpass", from: 6000, gain, when, attack: 0.0005 });
}

/** Inharmonic partial stack — the "metal" in sword clangs and armour. */
function metal(base: number, dur: number, gain: number, when = 0) {
  const ratios = [1, 1.51, 2.09, 2.77, 3.76];
  ratios.forEach((r, i) =>
    tone({
      from: base * r,
      to: base * r * 0.99,
      dur: dur * (1 - i * 0.11),
      type: i < 2 ? "triangle" : "sine",
      gain: gain / (1 + i * 0.9),
      when,
      attack: 0.001,
    }),
  );
}

/** A note with a soft echo tail — used by fanfares and level-ups. */
function chime(freq: number, dur: number, gain: number, when: number) {
  tone({ from: freq, dur, type: "triangle", gain, when, attack: 0.006 });
  tone({ from: freq * 2, dur: dur * 0.7, type: "sine", gain: gain * 0.4, when, attack: 0.006 });
  tone({ from: freq * 4, dur: dur * 0.35, type: "sine", gain: gain * 0.12, when, attack: 0.002 });
  tone({ from: freq, dur: dur * 0.8, type: "triangle", gain: gain * 0.28, when: when + 0.15, attack: 0.01 });
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

  /** Small UI tick for buttons. */
  click() {
    if (muted) return;
    click(0.1);
    tone({ from: 900, to: 660, dur: 0.05, type: "triangle", gain: 0.06, attack: 0.001 });
  },

  hit(crit: boolean) {
    if (muted) return;
    // crack transient + snap + body knock + tight sub
    click(0.32);
    noise({ dur: 0.07, type: "bandpass", from: 2600, to: 900, q: 1.2, gain: 0.3, attack: 0.001 });
    tone({ from: 210, to: 75, dur: 0.09, type: "triangle", gain: 0.3, attack: 0.001 });
    tone({ from: 120, to: 42, dur: 0.12, type: "sine", gain: 0.48, attack: 0.001 });
    if (crit) {
      // metallic shing + zap + boom, then a tight slapback
      metal(1150, 0.14, 0.16, 0.008);
      tone({ from: 340, to: 55, dur: 0.2, type: "square", gain: 0.15, when: 0.012, filter: { type: "lowpass", from: 3200, to: 350 } });
      tone({ from: 72, to: 30, dur: 0.26, type: "sine", gain: 0.5, when: 0.016 });
      click(0.12, 0.11);
      noise({ dur: 0.06, type: "bandpass", from: 1600, to: 700, gain: 0.1, when: 0.11 });
    }
  },
  block() {
    if (muted) return;
    click(0.22);
    metal(640, 0.18, 0.26);
    tone({ from: 150, to: 80, dur: 0.07, type: "sine", gain: 0.26, attack: 0.001 });
  },
  whoosh() {
    if (muted) return;
    noise({ dur: 0.2, type: "bandpass", from: 600, to: 3400, q: 2, gain: 0.17, attack: 0.06 });
    noise({ dur: 0.1, type: "highpass", from: 4500, gain: 0.05, when: 0.08, attack: 0.02 });
  },
  throwSpear() {
    if (muted) return;
    noise({ dur: 0.26, type: "bandpass", from: 1100, to: 4200, q: 2.4, gain: 0.16, attack: 0.04, pan: -0.4 });
    tone({ from: 2100, to: 900, dur: 0.24, type: "sine", gain: 0.05, attack: 0.03, pan: 0.3 });
  },
  beast() {
    if (muted) return;
    // snap of jaws up front, then the throat growl
    click(0.18);
    noise({ dur: 0.045, type: "highpass", from: 3200, gain: 0.14, when: 0.01, attack: 0.001 });
    tone({ from: 96, to: 55, dur: 0.3, type: "sawtooth", gain: 0.2, filter: { type: "lowpass", from: 1100, to: 240, q: 2 } });
    tone({ from: 99, to: 57, dur: 0.3, type: "sawtooth", gain: 0.16, detune: 18, filter: { type: "lowpass", from: 800, to: 220, q: 2 } });
    noise({ dur: 0.22, type: "bandpass", from: 380, to: 160, q: 1.2, gain: 0.13, when: 0.03 });
  },
  power() {
    if (muted) return;
    // charging sweep with resonant filter opening, topped with a shimmer
    tone({ from: 130, to: 660, dur: 0.36, type: "sawtooth", gain: 0.14, attack: 0.02, filter: { type: "lowpass", from: 500, to: 5200, q: 7 } });
    tone({ from: 65, to: 330, dur: 0.36, type: "triangle", gain: 0.15, attack: 0.02 });
    [1047, 1319, 1760].forEach((f, i) =>
      tone({ from: f, dur: 0.14, type: "sine", gain: 0.08, when: 0.18 + i * 0.05, attack: 0.004 }),
    );
    click(0.16, 0.32);
    tone({ from: 90, to: 45, dur: 0.2, type: "sine", gain: 0.3, when: 0.32 });
  },
  heal() {
    if (muted) return;
    tone({ from: 523, dur: 0.26, type: "sine", gain: 0.11, attack: 0.012 });
    tone({ from: 784, dur: 0.3, type: "sine", gain: 0.09, when: 0.08, attack: 0.012 });
    tone({ from: 1047, dur: 0.36, type: "sine", gain: 0.07, when: 0.16, attack: 0.012 });
    tone({ from: 2093, dur: 0.2, type: "sine", gain: 0.03, when: 0.2, attack: 0.004 });
    noise({ dur: 0.26, type: "highpass", from: 6500, gain: 0.035, when: 0.08, attack: 0.08 });
  },
  drum() {
    if (muted) return;
    const boom = (when: number, g: number) => {
      click(g * 0.5, when);
      tone({ from: 165, to: 48, dur: 0.2, type: "sine", gain: g, when, attack: 0.001 });
      noise({ dur: 0.09, type: "lowpass", from: 600, gain: g * 0.3, when });
    };
    boom(0, 0.5);
    boom(0.26, 0.42);
    boom(0.52, 0.55);
    noise({ dur: 0.8, type: "lowpass", from: 240, gain: 0.07, attack: 0.2 });
  },
  fanfare(won: boolean) {
    if (muted) return;
    if (won) {
      // rising brass-ish stabs into a held chord + crowd swell + sparkle
      [392, 523, 659].forEach((f, i) => {
        click(0.1, i * 0.14);
        tone({ from: f, dur: 0.2, type: "square", gain: 0.08, when: i * 0.14, attack: 0.006, filter: { type: "lowpass", from: 3000 } });
        tone({ from: f, dur: 0.2, type: "triangle", gain: 0.14, when: i * 0.14, attack: 0.006 });
      });
      [784, 988, 1175].forEach((f) => {
        tone({ from: f, dur: 0.9, type: "triangle", gain: 0.1, when: 0.44, attack: 0.015 });
        tone({ from: f, dur: 0.9, type: "sine", gain: 0.06, when: 0.44, attack: 0.015, detune: 8 });
      });
      tone({ from: 2349, dur: 0.5, type: "sine", gain: 0.04, when: 0.5, attack: 0.01 });
      noise({ dur: 1.3, type: "bandpass", from: 900, to: 1800, q: 0.5, gain: 0.09, when: 0.3, attack: 0.45 });
      noise({ dur: 0.7, type: "highpass", from: 7000, gain: 0.03, when: 0.5, attack: 0.2 });
    } else {
      [330, 294, 247, 196].forEach((f, i) =>
        tone({ from: f, to: f * 0.985, dur: 0.34, type: "triangle", gain: 0.14, when: i * 0.22, attack: 0.012 }),
      );
      tone({ from: 98, to: 60, dur: 0.7, type: "sine", gain: 0.2, when: 0.66, attack: 0.02 });
    }
  },
  levelUp() {
    if (muted) return;
    [523, 659, 784, 1047].forEach((f, i) => chime(f, 0.24, 0.15, i * 0.1));
    noise({ dur: 0.36, type: "highpass", from: 7500, gain: 0.045, when: 0.4, attack: 0.12 });
  },
};
