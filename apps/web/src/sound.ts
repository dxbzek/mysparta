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

/** What a blow is made of — chosen from the weapon actually in hand. */
export type StrikeKind = "fist" | "kick" | "sword" | "spear" | "axe" | "pierce";

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

  /**
   * Impact. Every strike is built from the material that makes it: knuckle
   * and flesh for a punch, steel and slice for a sword, wood and pierce for a
   * spear. The crit layer stacks on top rather than replacing the weapon.
   */
  strike(kind: StrikeKind, crit = false) {
    if (muted) return;
    switch (kind) {
      case "fist":
        // knuckle snap, then the soft give of a body. No metal anywhere.
        click(0.24);
        noise({ dur: 0.045, type: "bandpass", from: 1900, to: 700, q: 1.1, gain: 0.22, attack: 0.0008 });
        tone({ from: 170, to: 62, dur: 0.07, type: "triangle", gain: 0.28, attack: 0.001 });
        tone({ from: 95, to: 38, dur: 0.11, type: "sine", gain: 0.36, attack: 0.001 });
        break;
      case "kick":
        // more mass behind it: cloth snap, deeper thud, longer tail
        click(0.2);
        noise({ dur: 0.06, type: "lowpass", from: 1100, to: 380, gain: 0.26, attack: 0.001 });
        tone({ from: 130, to: 46, dur: 0.14, type: "triangle", gain: 0.32, attack: 0.001 });
        tone({ from: 78, to: 30, dur: 0.2, type: "sine", gain: 0.5, attack: 0.001 });
        break;
      case "sword":
        // edge rings as it bites, then meets the body
        click(0.28);
        noise({ dur: 0.06, type: "bandpass", from: 4400, to: 1500, q: 2.4, gain: 0.24, attack: 0.0006 });
        metal(2050, 0.11, 0.12, 0.004);
        tone({ from: 190, to: 70, dur: 0.08, type: "triangle", gain: 0.24, attack: 0.001 });
        tone({ from: 112, to: 44, dur: 0.11, type: "sine", gain: 0.32, attack: 0.001 });
        break;
      case "spear":
        // shaft knocks, point punches through — tight and dry
        click(0.26);
        tone({ from: 430, to: 180, dur: 0.05, type: "square", gain: 0.13, attack: 0.001, filter: { type: "lowpass", from: 2300, to: 700 } });
        noise({ dur: 0.035, type: "highpass", from: 5200, gain: 0.2, attack: 0.0005 });
        tone({ from: 145, to: 55, dur: 0.1, type: "sine", gain: 0.34, attack: 0.001 });
        break;
      case "axe":
        // slow mass arriving: chop, crunch, and a sub that outlives both
        click(0.3);
        noise({ dur: 0.1, type: "lowpass", from: 1300, to: 300, gain: 0.3, attack: 0.001 });
        noise({ dur: 0.13, type: "bandpass", from: 950, to: 260, q: 1.4, gain: 0.2, when: 0.012 });
        tone({ from: 150, to: 48, dur: 0.16, type: "triangle", gain: 0.3, attack: 0.001 });
        tone({ from: 82, to: 28, dur: 0.26, type: "sine", gain: 0.52, attack: 0.001 });
        break;
      case "pierce":
        // a thrown point landing: the air stops before the body answers
        click(0.22);
        noise({ dur: 0.045, type: "bandpass", from: 3200, to: 850, q: 1.8, gain: 0.22, attack: 0.0006 });
        tone({ from: 138, to: 52, dur: 0.1, type: "sine", gain: 0.32, attack: 0.001 });
        break;
    }
    if (crit) {
      // the extra weight of a clean hit — shing, low boom, and a room slap
      metal(1150, 0.14, 0.15, 0.008);
      tone({ from: 340, to: 55, dur: 0.2, type: "square", gain: 0.14, when: 0.012, filter: { type: "lowpass", from: 3200, to: 350 } });
      tone({ from: 72, to: 30, dur: 0.28, type: "sine", gain: 0.5, when: 0.016 });
      click(0.12, 0.11);
      noise({ dur: 0.06, type: "bandpass", from: 1600, to: 700, gain: 0.1, when: 0.11 });
    }
  },

  /** The swing before contact — mass and edge decide how the air moves. */
  swing(kind: StrikeKind) {
    if (muted) return;
    switch (kind) {
      case "fist":
        noise({ dur: 0.11, type: "bandpass", from: 800, to: 2700, q: 2.2, gain: 0.11, attack: 0.035 });
        break;
      case "kick":
        noise({ dur: 0.17, type: "bandpass", from: 420, to: 1500, q: 1.6, gain: 0.13, attack: 0.06 });
        break;
      case "sword":
        noise({ dur: 0.17, type: "bandpass", from: 950, to: 4400, q: 2.6, gain: 0.15, attack: 0.05 });
        noise({ dur: 0.08, type: "highpass", from: 5200, gain: 0.05, when: 0.09, attack: 0.02 });
        break;
      case "spear":
        // two beats: the shaft drawn back, then the thrust
        noise({ dur: 0.07, type: "bandpass", from: 500, to: 1400, q: 2, gain: 0.07, attack: 0.03 });
        noise({ dur: 0.1, type: "bandpass", from: 1300, to: 3800, q: 3, gain: 0.13, when: 0.07, attack: 0.02 });
        break;
      case "axe":
        noise({ dur: 0.25, type: "bandpass", from: 300, to: 1300, q: 1.4, gain: 0.17, attack: 0.1 });
        break;
      case "pierce":
        noise({ dur: 0.12, type: "bandpass", from: 1200, to: 3600, q: 2.6, gain: 0.12, attack: 0.03 });
        break;
    }
  },

  /** Nothing connects: cloth, a shifted foot, air closing where a body was. */
  dodge() {
    if (muted) return;
    noise({ dur: 0.13, type: "bandpass", from: 1300, to: 2700, q: 1.2, gain: 0.1, attack: 0.045 });
    noise({ dur: 0.05, type: "lowpass", from: 700, gain: 0.12, when: 0.07, attack: 0.002 });
    tone({ from: 95, to: 55, dur: 0.06, type: "sine", gain: 0.13, when: 0.07, attack: 0.002 });
  },

  /** Caught on a shield (dull wood, ringing rim) or turned on a blade. */
  block(onShield = true) {
    if (muted) return;
    click(0.24);
    if (onShield) {
      tone({ from: 240, to: 95, dur: 0.09, type: "square", gain: 0.26, attack: 0.001, filter: { type: "lowpass", from: 1900, to: 500 } });
      metal(880, 0.22, 0.17, 0.006);
      tone({ from: 130, to: 62, dur: 0.08, type: "sine", gain: 0.24, attack: 0.001 });
    } else {
      metal(1520, 0.3, 0.22);
      metal(2280, 0.2, 0.1, 0.006);
      tone({ from: 180, to: 90, dur: 0.06, type: "sine", gain: 0.18, attack: 0.001 });
    }
  },

  /** Release and flight — the whistle falls away as it crosses the arena. */
  throwSpear() {
    if (muted) return;
    click(0.16);
    noise({ dur: 0.09, type: "bandpass", from: 900, to: 2200, q: 2, gain: 0.12, attack: 0.02, pan: -0.5 });
    noise({ dur: 0.26, type: "bandpass", from: 2600, to: 1000, q: 3.2, gain: 0.13, when: 0.06, attack: 0.03, pan: 0.35 });
    tone({ from: 2300, to: 780, dur: 0.28, type: "sine", gain: 0.05, when: 0.05, attack: 0.03, pan: 0.4 });
  },

  /** Boots crossing the sand as a champion closes the distance. */
  dash() {
    if (muted) return;
    const step = (when: number, g: number) => {
      noise({ dur: 0.05, type: "lowpass", from: 900, to: 300, gain: g, when, attack: 0.001 });
      tone({ from: 110, to: 55, dur: 0.07, type: "sine", gain: g * 0.8, when, attack: 0.001 });
    };
    step(0, 0.16);
    step(0.09, 0.13);
    step(0.17, 0.15);
  },

  /** A piece of gear hitting the ground. */
  drop() {
    if (muted) return;
    click(0.14);
    metal(1750, 0.26, 0.12);
    tone({ from: 160, to: 70, dur: 0.08, type: "sine", gain: 0.16, attack: 0.001 });
    [1568, 2093].forEach((f, i) =>
      tone({ from: f, dur: 0.22, type: "sine", gain: 0.05, when: 0.1 + i * 0.06, attack: 0.006 }),
    );
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
      // Triumph: a fanfare that actually goes somewhere — G, C, E stabs
      // climbing to a held major chord over a crowd swell and a struck bell.
      [392, 523, 659].forEach((f, i) => {
        click(0.1, i * 0.13);
        tone({ from: f, dur: 0.19, type: "square", gain: 0.08, when: i * 0.13, attack: 0.005, filter: { type: "lowpass", from: 3000 } });
        tone({ from: f, dur: 0.19, type: "triangle", gain: 0.14, when: i * 0.13, attack: 0.005 });
        tone({ from: f / 2, dur: 0.2, type: "triangle", gain: 0.09, when: i * 0.13, attack: 0.005 });
      });
      // the arrival — root doubled low so it lands with weight
      [784, 988, 1175].forEach((f) => {
        tone({ from: f, dur: 1, type: "triangle", gain: 0.1, when: 0.42, attack: 0.012 });
        tone({ from: f, dur: 1, type: "sine", gain: 0.06, when: 0.42, attack: 0.012, detune: 8 });
      });
      tone({ from: 196, dur: 1.05, type: "triangle", gain: 0.16, when: 0.42, attack: 0.012 });
      tone({ from: 130, to: 128, dur: 1.1, type: "sine", gain: 0.2, when: 0.42, attack: 0.02 });
      chime(1568, 0.9, 0.09, 0.46);
      // crowd: broad noise swelling in behind the chord, never over it
      noise({ dur: 1.5, type: "bandpass", from: 800, to: 1900, q: 0.5, gain: 0.1, when: 0.28, attack: 0.5 });
      noise({ dur: 0.8, type: "highpass", from: 7000, gain: 0.03, when: 0.5, attack: 0.22 });
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
