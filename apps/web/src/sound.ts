/**
 * Synthesized SFX — no audio assets, just Web Audio oscillators and noise.
 * Everything is fire-and-forget and safe to call before user interaction
 * (silently does nothing until the browser allows an AudioContext).
 *
 * All voices route through a shared compressor bus so layered hits glue
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
      comp.threshold.value = -18;
      comp.knee.value = 24;
      comp.ratio.value = 6;
      comp.attack.value = 0.002;
      comp.release.value = 0.18;
      bus = ctx.createGain();
      bus.gain.value = 0.9;
      bus.connect(comp).connect(ctx.destination);
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
    const attack = o.attack ?? 0.004;
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
    const attack = o.attack ?? 0.003;
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

/** Inharmonic partial stack — the "metal" in sword clangs and armour. */
function metal(base: number, dur: number, gain: number, when = 0) {
  const ratios = [1, 1.51, 2.09, 2.77, 3.41];
  ratios.forEach((r, i) =>
    tone({
      from: base * r,
      to: base * r * 0.99,
      dur: dur * (1 - i * 0.12),
      type: i < 2 ? "triangle" : "sine",
      gain: gain / (1 + i * 1.1),
      when,
      attack: 0.001,
    }),
  );
}

/** A note with a soft echo tail — used by fanfares and level-ups. */
function chime(freq: number, dur: number, gain: number, when: number) {
  tone({ from: freq, dur, type: "triangle", gain, when, attack: 0.008 });
  tone({ from: freq * 2, dur: dur * 0.7, type: "sine", gain: gain * 0.35, when, attack: 0.008 });
  tone({ from: freq, dur: dur * 0.8, type: "triangle", gain: gain * 0.3, when: when + 0.16, attack: 0.01 });
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
    // crack transient + body knock + sub thump
    noise({ dur: 0.04, type: "highpass", from: 5200, gain: 0.22, attack: 0.001 });
    noise({ dur: 0.11, type: "bandpass", from: 1700, to: 700, q: 1.1, gain: 0.3, attack: 0.002 });
    tone({ from: 190, to: 70, dur: 0.12, type: "triangle", gain: 0.3, attack: 0.001 });
    tone({ from: 115, to: 38, dur: 0.16, type: "sine", gain: 0.5, attack: 0.001 });
    if (crit) {
      tone({ from: 320, to: 52, dur: 0.24, type: "square", gain: 0.16, when: 0.015, filter: { type: "lowpass", from: 2400, to: 300 } });
      noise({ dur: 0.22, type: "bandpass", from: 2600, to: 500, gain: 0.26, when: 0.015 });
      tone({ from: 70, to: 30, dur: 0.3, type: "sine", gain: 0.5, when: 0.02 });
      // slapback echo sells the weight
      noise({ dur: 0.09, type: "bandpass", from: 1200, to: 500, gain: 0.1, when: 0.13 });
      tone({ from: 95, to: 40, dur: 0.1, type: "sine", gain: 0.18, when: 0.13 });
    }
  },
  block() {
    if (muted) return;
    metal(560, 0.22, 0.24);
    noise({ dur: 0.05, type: "highpass", from: 4200, gain: 0.14, attack: 0.001 });
    tone({ from: 140, to: 70, dur: 0.09, type: "sine", gain: 0.28, attack: 0.001 });
  },
  whoosh() {
    if (muted) return;
    noise({ dur: 0.26, type: "bandpass", from: 420, to: 2400, q: 1.6, gain: 0.16, attack: 0.09 });
  },
  throwSpear() {
    if (muted) return;
    noise({ dur: 0.3, type: "bandpass", from: 900, to: 3200, q: 2.2, gain: 0.15, attack: 0.06, pan: -0.4 });
    tone({ from: 1500, to: 700, dur: 0.28, type: "sine", gain: 0.05, attack: 0.05, pan: 0.3 });
  },
  beast() {
    if (muted) return;
    // twin detuned saws through a closing lowpass = throat growl
    tone({ from: 96, to: 55, dur: 0.34, type: "sawtooth", gain: 0.2, filter: { type: "lowpass", from: 900, to: 220, q: 2 } });
    tone({ from: 99, to: 57, dur: 0.34, type: "sawtooth", gain: 0.16, detune: 18, filter: { type: "lowpass", from: 700, to: 200, q: 2 } });
    noise({ dur: 0.26, type: "bandpass", from: 350, to: 150, q: 1.2, gain: 0.14, when: 0.04 });
    // snap of jaws
    noise({ dur: 0.05, type: "highpass", from: 3000, gain: 0.12, when: 0.16, attack: 0.001 });
  },
  power() {
    if (muted) return;
    // charging sweep with resonant filter opening, topped with a shimmer
    tone({ from: 130, to: 620, dur: 0.4, type: "sawtooth", gain: 0.14, attack: 0.03, filter: { type: "lowpass", from: 400, to: 3800, q: 6 } });
    tone({ from: 65, to: 310, dur: 0.4, type: "triangle", gain: 0.16, attack: 0.03 });
    [880, 1175, 1568].forEach((f, i) =>
      tone({ from: f, dur: 0.16, type: "sine", gain: 0.07, when: 0.2 + i * 0.06, attack: 0.01 }),
    );
    tone({ from: 90, to: 45, dur: 0.22, type: "sine", gain: 0.3, when: 0.34 });
  },
  heal() {
    if (muted) return;
    tone({ from: 523, dur: 0.3, type: "sine", gain: 0.11, attack: 0.02 });
    tone({ from: 784, dur: 0.34, type: "sine", gain: 0.09, when: 0.09, attack: 0.02 });
    tone({ from: 1047, dur: 0.4, type: "sine", gain: 0.06, when: 0.18, attack: 0.02 });
    noise({ dur: 0.3, type: "highpass", from: 6000, gain: 0.03, when: 0.1, attack: 0.1 });
  },
  drum() {
    if (muted) return;
    const boom = (when: number, g: number) => {
      tone({ from: 160, to: 48, dur: 0.22, type: "sine", gain: g, when, attack: 0.002 });
      noise({ dur: 0.12, type: "lowpass", from: 500, gain: g * 0.35, when });
    };
    boom(0, 0.5);
    boom(0.26, 0.42);
    boom(0.52, 0.55);
    // room rumble under the hits
    noise({ dur: 0.8, type: "lowpass", from: 220, gain: 0.08, attack: 0.2 });
  },
  fanfare(won: boolean) {
    if (muted) return;
    if (won) {
      // rising brass-ish stabs into a held chord + crowd swell
      [392, 523, 659].forEach((f, i) => {
        tone({ from: f, dur: 0.22, type: "square", gain: 0.07, when: i * 0.14, attack: 0.01, filter: { type: "lowpass", from: 2200 } });
        tone({ from: f, dur: 0.22, type: "triangle", gain: 0.14, when: i * 0.14, attack: 0.01 });
      });
      [784, 988, 1175].forEach((f) => {
        tone({ from: f, dur: 0.9, type: "triangle", gain: 0.1, when: 0.44, attack: 0.02 });
        tone({ from: f, dur: 0.9, type: "sine", gain: 0.06, when: 0.44, attack: 0.02, detune: 8 });
      });
      noise({ dur: 1.4, type: "bandpass", from: 800, to: 1600, q: 0.5, gain: 0.09, when: 0.3, attack: 0.5 });
    } else {
      [330, 294, 247, 196].forEach((f, i) =>
        tone({ from: f, to: f * 0.985, dur: 0.36, type: "triangle", gain: 0.14, when: i * 0.22, attack: 0.015 }),
      );
      tone({ from: 98, to: 60, dur: 0.7, type: "sine", gain: 0.2, when: 0.66, attack: 0.02 });
    }
  },
  levelUp() {
    if (muted) return;
    [523, 659, 784, 1047].forEach((f, i) => chime(f, 0.26, 0.15, i * 0.11));
    noise({ dur: 0.4, type: "highpass", from: 7000, gain: 0.04, when: 0.44, attack: 0.15 });
  },
};
