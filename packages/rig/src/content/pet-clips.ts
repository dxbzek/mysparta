/**
 * The pets in motion (animation pass, 16 Nov 2026; owner: "The pets only have limited
 * animations"). Every pet gets all six companion clips, each true to the animal, on the
 * placeholder timeline (`PLACEHOLDER_COMPANION_CLIPS`: run and flee 240 loops with a step at 0
 * and 120, attack 280 with the contact at 150, hit 300, ko 600 landing at 400), so the stage
 * keeps its times.
 *
 *   Raccoon    scurries on short legs, back humped; a leaping scratch, both forepaws raking
 *   Goose      waddle-runs, body rolling, wings held out; strikes with the neck like a whip
 *   Boar       a heavy charge, head low; drives in and tosses the tusk up through the target
 *   Stray Dog  gallops, ears and tail streaming; lunges, bites and shakes its head
 *   Crow       hops with both feet, wings beating; flies in and pecks, wings braking
 *   Alley Cat  a low sprint, belly near the floor; two quick swipes, one paw then the other
 *
 * A clip is keyed every 30 ms or so from small functions of time (a gait is a sine per leg with
 * its own phase), so legs alternate properly and nothing pops. No clip moves the root sideways
 * (the stage carries the travel); the sampler drops each pose onto the floor, so the feet stand
 * on it, and only a key with root y below 0 lifts the animal off it (a leap, a hop, the crow's
 * flight). Tails and wings trail their bodies through `lag`.
 */
import type { Clip, CompanionClip, Key } from "../contracts";
import { PLACEHOLDER_COMPANION_CLIPS } from "../contracts";

type Rot = Record<string, number>;
const P = PLACEHOLDER_COMPANION_CLIPS;
const TAU = Math.PI * 2;

const add = (rest: Rot, d: Rot): Rot => {
  const out: Rot = { ...rest };
  for (const [k, v] of Object.entries(d)) out[k] = (out[k] ?? 0) + v;
  return out;
};
const key = (t: number, rot: Rot, o: Partial<Key> = {}): Key => ({ t, rot, ...o });

/** One leg in a gait: its bones, phase (share of the cycle), swing (degrees each way at the hip
 *  or shoulder) and how far the lower leg and the foot fold while the leg swings forward. */
export interface GaitLeg { leg: string; foot: "paw" | "foot"; phase: number; swing: number; fold: number; flick: number }
export interface Gait {
  legs: readonly GaitLeg[];
  /** Extra bone offsets over the cycle, u in [0, 1). */
  body?: (u: number) => Rot;
  /** Lift of the whole animal over the cycle (units, up positive): a hop. */
  hop?: (u: number) => number;
  samples?: number;
}

/** A 240 ms loop (run or flee) from a gait. A leg's angle is rest + swing x cos(2 pi (u + phase))
 *  (back at 0, forward at a half); while it comes forward (the swing phase) the lower leg folds
 *  and the foot tucks, so the foot clears the floor; in the stance phase the leg is long and the
 *  foot flat. Steps at 0 and 120 as the placeholder timeline. */
export function gaitClip(rest: Rot, g: Gait, lag: Rot, events = P.run.events): Clip {
  const n = g.samples ?? 8;
  const keys: Key[] = [];
  for (let i = 0; i <= n; i++) {
    const u = (i % n) / n;
    const d: Rot = {};
    for (const l of g.legs) {
      const a = TAU * (u + l.phase);
      const swingPhase = Math.max(0, Math.sin(a));       // moving forward: the foot is up
      d[`${l.leg}.up`] = l.swing * Math.cos(a);
      d[`${l.leg}.lo`] = l.fold * swingPhase;
      d[`${l.leg}.${l.foot}`] = l.flick * swingPhase - 0.3 * l.swing * Math.cos(a);
    }
    const extra = g.body?.(u) ?? {};
    for (const [k, v] of Object.entries(extra)) d[k] = (d[k] ?? 0) + v;
    const lift = g.hop?.(u) ?? 0;
    keys.push(key((i * P.run.durationMs) / n, add(rest, d), { root: [0, -lift] }));
  }
  return { duration: P.run.durationMs, loop: true, events, keys, lag };
}

/** A one-shot clip from timed offsets on the rest pose; `root` y below 0 lifts it. */
export function shotClip(c: CompanionClip, rest: Rot, keys: readonly (readonly [number, Rot, Partial<Key>?])[], lag: Rot = {}): Clip {
  return { duration: P[c].durationMs, loop: false, events: P[c].events,
    keys: keys.map(([t, d, o]) => key(t, add(rest, d), { root: [0, 0], ...(o ?? {}) })), lag };
}

/** The idle loop: rest, a breath in, back. */
export function idleClip(rest: Rot, breath: Rot): Clip {
  return { duration: P.idle.durationMs, loop: true, events: P.idle.events,
    keys: [key(0, rest), key(600, add(rest, breath), { scale: [1, 0.985], ease: "inOut" }), key(1200, rest, { ease: "inOut" })] };
}

const s = (u: number, k = 1, ph = 0): number => Math.sin(TAU * (k * u + ph));
const c = (u: number, k = 1, ph = 0): number => Math.cos(TAU * (k * u + ph));
const quad = (name: string, phase: number, swing: number, fold: number, flick: number): GaitLeg => ({ leg: name, foot: "paw", phase, swing, fold, flick });
const bird = (name: string, phase: number, swing: number, fold: number, flick: number): GaitLeg => ({ leg: name, foot: "foot", phase, swing, fold, flick });

// ------------------------------------------------------------------------------- the six
export function strayDogClips(rest: Rot, breath: Rot): Record<CompanionClip, Clip> {
  // a rotary gallop: the hind pair lands, then the fore pair; the back flexes and stretches
  const gallop = (k: number): Gait => ({
    legs: [quad("hindB", 0, 26 * k, 34 * k, 18 * k), quad("hindF", 0.1, 26 * k, 34 * k, 18 * k),
      quad("foreB", 0.5, 30 * k, -40 * k, -30 * k), quad("foreF", 0.6, 30 * k, -40 * k, -30 * k)],
    body: (u) => ({ body: 5 * s(u), neck: -4 * s(u) - (k > 1 ? 10 : 0), head: 3 * c(u) + (k > 1 ? 14 : 0),
      tail1: (k > 1 ? 28 : -10) + 8 * s(u, 1, 0.25), tail2: (k > 1 ? 10 : -8) + 10 * s(u, 1, 0.1), tail3: 12 * s(u, 1, 0) }),
    hop: (u) => 1.6 * Math.max(0, s(u, 2, 0.15)),
  });
  return {
    idle: idleClip(rest, breath),
    run: gaitClip(rest, gallop(1), { tail1: 30, tail2: 50, tail3: 70, head: 20 }),
    flee: gaitClip(rest, gallop(1.25), { tail2: 40, tail3: 60, head: 20 }, P.flee.events),
    attack: shotClip("attack", rest, [
      [0, {}],
      [70, { body: -6, "hindB.up": 12, "hindF.up": 12, "hindB.lo": 14, "hindF.lo": 14, "foreF.up": -6, neck: -16, head: 10, tail1: -10 }, { root: [0, 2], ease: "out" }],
      [130, { body: 4, "hindB.up": -14, "hindF.up": -14, "foreF.up": -34, "foreB.up": -26, "foreF.lo": -20, neck: 22, head: -10, tail1: -16 }, { root: [0, -3], ease: "in" }],
      [150, { body: 6, "hindB.up": -18, "hindF.up": -18, "foreF.up": -40, "foreB.up": -30, "foreF.lo": -24, neck: 28, head: -2, tail1: -20 }, { root: [0, -2] }],
      [180, { body: 4, "foreF.up": -20, "foreB.up": -16, neck: 22, head: 18, tail1: -6 }, { root: [0, 0] }],
      [205, { body: 3, neck: 22, head: -16, tail1: 6 }],
      [230, { body: 2, neck: 18, head: 14, tail1: -4 }],
      [255, { body: 1, neck: 10, head: -6 }, { ease: "out" }],
      [280, {}, { ease: "inOut" }],
    ], { tail2: 40, tail3: 60 }),
    hit: shotClip("hit", rest, [
      [0, {}],
      [40, { body: -10, neck: -22, head: -24, tail1: 20, "foreF.up": 10, "foreB.up": 8 }, { root: [0, -1.5], ease: "out" }],
      [110, { body: -8, neck: -14, head: -12, tail1: 30, "hindB.up": 10, "hindF.up": 8, "hindB.lo": 12, "hindF.lo": 12 }, { ease: "inOut" }],
      [200, { body: -2, neck: -4, head: -2, tail1: 10 }, { ease: "inOut" }],
      [300, {}, { ease: "inOut" }],
    ], { tail2: 50, tail3: 70, head: 30 }),
    ko: koClip(rest, { neck: 24, head: 30, tail1: -40, tail2: -10, tail3: 0 }),
  };
}

export function alleyCatClips(rest: Rot, breath: Rot): Record<CompanionClip, Clip> {
  // a low sprint: a long reach and gather, the belly near the floor, the tail out straight
  const sprint = (k: number): Gait => ({
    legs: [quad("hindB", 0, 30 * k, 30 * k, 20 * k), quad("hindF", 0.08, 30 * k, 30 * k, 20 * k),
      quad("foreB", 0.5, 32 * k, -38 * k, -30 * k), quad("foreF", 0.58, 32 * k, -38 * k, -30 * k)],
    body: (u) => ({ body: 6 * s(u), "hindB.lo": 8, "hindF.lo": 8, neck: -6 * s(u) + (k > 1 ? -10 : 0), head: 4 * c(u) + (k > 1 ? 14 : 0),
      tail1: (k > 1 ? 40 : 20) + 6 * s(u, 1, 0.3), tail2: (k > 1 ? -20 : -24) + 8 * s(u, 1, 0.15), tail3: (k > 1 ? -30 : -24) + 10 * s(u) }),
    hop: (u) => 1.2 * Math.max(0, s(u, 2, 0.1)),
  });
  return {
    idle: idleClip(rest, breath),
    run: gaitClip(rest, sprint(1), { tail2: 40, tail3: 60 }),
    flee: gaitClip(rest, sprint(1.2), { tail2: 40, tail3: 60 }, P.flee.events),
    attack: shotClip("attack", rest, [
      [0, {}],
      [60, { body: -4, "hindB.lo": 16, "hindF.lo": 16, "hindB.up": 8, "hindF.up": 8, "foreF.up": 10, neck: -10, head: 8, tail1: 10, tail3: 20 }, { root: [0, 1.5], ease: "out" }],
      [120, { body: -10, "foreF.up": -60, "foreF.lo": -60, "foreF.paw": -30, neck: 10, head: -6 }, { ease: "in" }],
      [150, { body: -2, "foreF.up": -72, "foreF.lo": -20, "foreF.paw": -10, neck: 16, head: -4 }],
      [180, { body: -8, "foreF.up": -10, "foreF.lo": -30, "foreB.up": -50, "foreB.lo": -50, "foreB.paw": -24, neck: 12, head: -6 }],
      [210, { body: -10, "foreF.up": 0, "foreB.up": -70, "foreB.lo": -20, "foreB.paw": -10, neck: 14, head: -2 }],
      [245, { body: -4, "foreB.up": -20, "foreB.lo": -20, neck: 6, head: 0 }, { ease: "out" }],
      [280, {}, { ease: "inOut" }],
    ], { tail2: 50, tail3: 80 }),
    hit: shotClip("hit", rest, [
      [0, {}],
      [40, { body: -8, neck: -20, head: -26, tail1: -30, tail2: 30, "foreF.up": 14, "foreB.up": 10 }, { root: [0, -2.5], ease: "out" }],
      [120, { body: -6, neck: -10, head: -10, tail1: -20, tail2: 20, "hindB.lo": 14, "hindF.lo": 14 }, { ease: "inOut" }],
      [210, { body: -2, neck: -2, head: -2, tail1: -6 }, { ease: "inOut" }],
      [300, {}, { ease: "inOut" }],
    ], { tail2: 50, tail3: 70, head: 30 }),
    ko: koClip(rest, { neck: 24, head: 30, tail1: 30, tail2: -40, tail3: -40 }),
  };
}

export function raccoonClips(rest: Rot, breath: Rot): Record<CompanionClip, Clip> {
  // a scurry: quick short steps, diagonal pairs, the humped back bouncing
  const scurry = (k: number): Gait => ({
    legs: [quad("hindB", 0, 22 * k, 30 * k, 16 * k), quad("foreF", 0, 26 * k, -34 * k, -24 * k),
      quad("hindF", 0.5, 22 * k, 30 * k, 16 * k), quad("foreB", 0.5, 26 * k, -34 * k, -24 * k)],
    body: (u) => ({ body: 2 * s(u, 2) + (k > 1 ? -4 : 0), neck: -3 * s(u, 2) + (k > 1 ? -12 : 0), head: 3 * s(u, 2, 0.2) + (k > 1 ? 12 : 0),
      tail1: (k > 1 ? 20 : 4) + 6 * s(u, 2, 0.25), tail2: 8 * s(u, 2, 0.1), tail3: 10 * s(u, 2) }),
    hop: (u) => 0.8 * Math.max(0, s(u, 2, 0.15)),
  });
  return {
    idle: idleClip(rest, breath),
    run: gaitClip(rest, scurry(1), { tail2: 40, tail3: 60 }),
    flee: gaitClip(rest, scurry(1.25), { tail2: 40, tail3: 60 }, P.flee.events),
    attack: shotClip("attack", rest, [
      [0, {}],
      [60, { body: 6, "hindB.lo": 20, "hindF.lo": 20, "foreF.up": 10, "foreB.up": 10, neck: -8, head: 6, tail1: 10 }, { root: [0, 2], ease: "out" }],
      [110, { body: -18, "hindB.up": 20, "hindF.up": 20, "foreF.up": -60, "foreB.up": -50, "foreF.lo": -40, "foreB.lo": -40, neck: -4, head: 10, tail1: 20 }, { root: [0, -8], ease: "out" }],
      [150, { body: 2, "hindB.up": 10, "hindF.up": 10, "foreF.up": -76, "foreB.up": -40, "foreF.lo": -10, "foreB.lo": -50, "foreF.paw": -20, neck: 34, head: -6, tail1: 10 }, { root: [0, -6] }],
      [185, { body: -4, "foreF.up": -20, "foreB.up": -70, "foreB.lo": -10, "foreB.paw": -20, neck: 12, head: 4 }, { root: [0, -2], ease: "in" }],
      [215, { body: 4, "foreF.up": 4, "foreB.up": 0, "hindB.lo": 16, "hindF.lo": 16, neck: 2 }, { root: [0, 1.5], scale: [1.06, 0.94] }],
      [280, {}, { ease: "inOut", scale: [1, 1] }],
    ], { tail1: 20, tail2: 40, tail3: 60 }),
    hit: shotClip("hit", rest, [
      [0, {}],
      [40, { body: -10, neck: -20, head: -20, tail1: 24, "foreF.up": 10, "foreB.up": 10 }, { root: [0, -2], ease: "out" }],
      [120, { body: -6, neck: -10, head: -8, tail1: 30, "hindB.lo": 14, "hindF.lo": 14 }, { ease: "inOut" }],
      [210, { body: -2, neck: -2, head: -2, tail1: 8 }, { ease: "inOut" }],
      [300, {}, { ease: "inOut" }],
    ], { tail2: 50, tail3: 70, head: 30 }),
    ko: koClip(rest, { neck: 24, head: 30, tail1: 40, tail2: 20, tail3: 10 }),
  };
}

export function boarClips(rest: Rot, breath: Rot): Record<CompanionClip, Clip> {
  // a heavy charge: short powerful strides, head low, the weight rocking fore and aft
  const charge = (k: number): Gait => ({
    legs: [quad("hindB", 0, 20 * k, 24 * k, 12 * k), quad("hindF", 0.12, 20 * k, 24 * k, 12 * k),
      quad("foreB", 0.5, 22 * k, -30 * k, -18 * k), quad("foreF", 0.62, 22 * k, -30 * k, -18 * k)],
    body: (u) => ({ body: 3 * s(u), neck: 8 + 3 * c(u) + (k > 1 ? -10 : 0), head: 10 + 3 * s(u, 1, 0.2) + (k > 1 ? -10 : 0),
      tail1: (k > 1 ? -30 : -10) + 8 * s(u, 1, 0.3), tail2: 12 * s(u, 1, 0.15), tail3: 14 * s(u) }),
    hop: (u) => 0.8 * Math.max(0, s(u, 2, 0.2)),
  });
  return {
    idle: idleClip(rest, breath),
    run: gaitClip(rest, charge(1), { tail2: 40, tail3: 60 }),
    flee: gaitClip(rest, charge(1.2), { tail2: 40, tail3: 60 }, P.flee.events),
    attack: shotClip("attack", rest, [
      [0, {}],
      [70, { body: 4, "hindB.up": 10, "hindF.up": 10, "hindB.lo": 10, "hindF.lo": 10, "foreF.up": 8, neck: 20, head: 24, tail1: -16 }, { root: [0, 1.5], ease: "out" }],
      [130, { body: 6, "hindB.up": -14, "hindF.up": -14, "foreF.up": -18, "foreB.up": -10, neck: 24, head: 28, tail1: -24 }, { ease: "in" }],
      [150, { body: 2, "hindB.up": -16, "hindF.up": -16, "foreF.up": -14, neck: 6, head: 2, tail1: -24 }],
      [180, { body: -6, "foreF.up": -24, "foreF.lo": -20, "foreB.up": -6, neck: -18, head: -24, tail1: -10 }, { root: [0, -1.5], ease: "out" }],
      [225, { body: -2, "foreF.up": -6, neck: -6, head: -8 }, { ease: "inOut" }],
      [280, {}, { ease: "inOut" }],
    ], { tail2: 40, tail3: 60 }),
    hit: shotClip("hit", rest, [
      [0, {}],
      [50, { body: -6, neck: -14, head: -16, tail1: 20, "foreF.up": 8, "foreB.up": 6 }, { ease: "out" }],
      [130, { body: -4, neck: -8, head: -8, tail1: 24, "hindB.lo": 10, "hindF.lo": 10 }, { ease: "inOut" }],
      [220, { body: -1, neck: -2, head: -2, tail1: 6 }, { ease: "inOut" }],
      [300, {}, { ease: "inOut" }],
    ], { tail2: 50, tail3: 70, head: 30 }),
    ko: koClip(rest, { neck: 20, head: 24, tail1: 20, tail2: 10, tail3: 0 }),
  };
}

export function gooseClips(rest: Rot, breath: Rot): Record<CompanionClip, Clip> {
  // a waddle-run: the legs alternate, the body rolls over each foot, the wings held out
  const waddle = (k: number): Gait => ({
    legs: [bird("legB", 0, 26 * k, 40 * k, 20 * k), bird("legF", 0.5, 26 * k, 40 * k, 20 * k)],
    body: (u) => ({ body: 6 + 5 * s(u, 2) + (k > 1 ? 6 : 0), neck1: (k > 1 ? 18 : 8) - 4 * s(u, 2), neck2: -6 + 4 * s(u, 2, 0.2), neck3: -4, head: 6 * s(u, 2, 0.4),
      wingB: 34 - 10 * s(u, 2) + (k > 1 ? 6 : 0), wingF: 36 - 12 * s(u, 2) + (k > 1 ? 6 : 0), "wingB.tip": 20 - 10 * s(u, 2, 0.15), "wingF.tip": 24 - 12 * s(u, 2, 0.15),
      tail: 8 * s(u, 2, 0.25) }),
  });
  return {
    idle: idleClip(rest, breath),
    run: gaitClip(rest, waddle(1), { "wingB.tip": 30, "wingF.tip": 30, head: 20 }),
    flee: gaitClip(rest, waddle(1.25), { "wingB.tip": 30, "wingF.tip": 30, head: 20 }, P.flee.events),
    attack: shotClip("attack", rest, [
      [0, {}],
      [70, { body: -8, neck1: -30, neck2: 30, neck3: 24, head: -14, wingB: 40, wingF: 46, "wingB.tip": 24, "wingF.tip": 30, tail: 14 }, { ease: "out" }],
      [120, { body: -4, neck1: -36, neck2: 40, neck3: 28, head: -18, wingB: 46, wingF: 50, "wingB.tip": 30, "wingF.tip": 36 }],
      [136, { body: 2, neck1: 6, neck2: 16, neck3: 8, head: -6, wingB: 40, wingF: 44 }],
      [150, { body: 8, neck1: 44, neck2: -10, neck3: -16, head: 6, wingB: 30, wingF: 34, "wingB.tip": 10, "wingF.tip": 14, "legB.up": -14 }, { ease: "in" }],
      [175, { body: 10, neck1: 48, neck2: -14, neck3: -20, head: 10, wingB: 46, wingF: 50, "wingB.tip": 28, "wingF.tip": 32 }],
      [210, { body: 6, neck1: 28, neck2: -4, neck3: -8, head: 4, wingB: 24, wingF: 28, "wingB.tip": 8, "wingF.tip": 10 }, { ease: "out" }],
      [280, {}, { ease: "inOut" }],
    ], { "wingB.tip": 30, "wingF.tip": 30, tail: 30 }),
    hit: shotClip("hit", rest, [
      [0, {}],
      [40, { body: -12, neck1: -22, neck2: 14, neck3: 12, head: -20, wingB: 46, wingF: 50, "wingB.tip": 30, "wingF.tip": 34, tail: 20 }, { root: [0, -2], ease: "out" }],
      [120, { body: -8, neck1: -12, neck2: 8, head: -8, wingB: 30, wingF: 34, "wingB.tip": 10, "wingF.tip": 12, "legB.lo": 20, "legF.lo": 10 }, { ease: "inOut" }],
      [210, { body: -2, neck1: -2, head: -2, wingB: 6, wingF: 6 }, { ease: "inOut" }],
      [300, {}, { ease: "inOut" }],
    ], { "wingB.tip": 40, "wingF.tip": 40, head: 30, neck3: 20 }),
    ko: birdKo(rest, { neck1: 40, neck2: 30, neck3: 20, head: 30 }),
  };
}

export function crowClips(rest: Rot, breath: Rot): Record<CompanionClip, Clip> {
  // a hop-run: both feet together, two hops a cycle, the wings beating for each one
  const hops = (k: number): Gait => ({
    legs: [bird("legB", 0.02, 10 * k, 30 * k, 16 * k), bird("legF", 0, 10 * k, 30 * k, 16 * k)].map((l) => ({ ...l, phase: l.phase })),
    body: (u) => ({ body: -4 * s(u, 2) + (k > 1 ? 6 : 0), neck: -4 * s(u, 2, 0.1), head: 4 * s(u, 2, 0.3),
      wingB: 10 + 32 * Math.max(0, s(u, 2, 0.1)), wingF: 12 + 36 * Math.max(0, s(u, 2, 0.1)),
      "wingB.tip": 10 - 24 * Math.max(0, s(u, 2, 0.2)), "wingF.tip": 12 - 28 * Math.max(0, s(u, 2, 0.2)), tail: 10 * s(u, 2, 0.25) }),
    hop: (u) => 4 * Math.max(0, s(u, 2)),
    samples: 12,
  });
  // two hops per cycle: the legs tuck twice
  const hopLegs = (g: Gait): Gait => ({ ...g, legs: g.legs.map((l) => ({ ...l, swing: 0 })),
    body: (u) => ({ ...(g.body?.(u) ?? {}), "legB.up": -14 * Math.max(0, s(u, 2)), "legF.up": -16 * Math.max(0, s(u, 2)),
      "legB.lo": 30 * Math.max(0, s(u, 2)), "legF.lo": 33 * Math.max(0, s(u, 2)), "legB.foot": -20 * Math.max(0, s(u, 2)), "legF.foot": -24 * Math.max(0, s(u, 2)) }) });
  return {
    idle: idleClip(rest, breath),
    run: gaitClip(rest, hopLegs(hops(1)), { "wingB.tip": 30, "wingF.tip": 30 }),
    flee: gaitClip(rest, hopLegs(hops(1.2)), { "wingB.tip": 30, "wingF.tip": 30 }, P.flee.events),
    attack: shotClip("attack", rest, [
      [0, {}],
      [40, { body: 8, "legB.lo": 20, "legF.lo": 20, wingB: 44, wingF: 48, "wingB.tip": 30, "wingF.tip": 34 }, { root: [0, 1] }],
      [80, { body: -10, "legB.up": -20, "legF.up": -20, "legB.lo": 40, "legF.lo": 40, wingB: -20, wingF: -20, "wingB.tip": -20, "wingF.tip": -20, neck: -10, head: -10 }, { root: [0, -12], ease: "out" }],
      [115, { body: 4, wingB: 42, wingF: 46, "wingB.tip": 40, "wingF.tip": 44, neck: -16, head: -8, tail: 20 }, { root: [0, -10] }],
      [150, { body: 26, neck: 30, head: 24, wingB: 30, wingF: 34, "wingB.tip": 20, "wingF.tip": 24, "legB.up": 20, "legF.up": 20, tail: 18 }, { root: [0, -5], ease: "in" }],
      [185, { body: 10, neck: 12, head: 6, wingB: 46, wingF: 50, "wingB.tip": 44, "wingF.tip": 48, tail: 10 }, { root: [0, -3] }],
      [225, { body: 2, wingB: 40, wingF: 44, "wingB.tip": 20, "wingF.tip": 22, "legB.lo": 16, "legF.lo": 16 }, { root: [0, 0], ease: "in" }],
      [280, {}, { ease: "inOut" }],
    ], { "wingB.tip": 30, "wingF.tip": 30, tail: 30 }),
    hit: shotClip("hit", rest, [
      [0, {}],
      [40, { body: -14, neck: -24, head: -26, wingB: 44, wingF: 48, "wingB.tip": 36, "wingF.tip": 40, tail: 18 }, { root: [0, -3], ease: "out" }],
      [120, { body: -8, neck: -12, head: -10, wingB: 30, wingF: 34, "wingB.tip": 14, "wingF.tip": 16, "legB.lo": 20, "legF.lo": 20 }, { ease: "inOut" }],
      [210, { body: -2, neck: -2, head: -2, wingB: 6, wingF: 6 }, { ease: "inOut" }],
      [300, {}, { ease: "inOut" }],
    ], { "wingB.tip": 40, "wingF.tip": 40, head: 30 }),
    ko: birdKo(rest, { neck: 40, head: 40 }),
  };
}

/** A four-legged knockout: the legs buckle, the body drops to the floor (land at 400), the head
 *  goes down last and the tail falls limp. */
function koClip(rest: Rot, limp: Rot): Clip {
  // sprawled flat: the hind legs thrown out behind, the forelegs out in front, the belly down
  const legs = (k: number): Rot => ({ "hindB.up": 84 * k, "hindF.up": 92 * k, "hindB.lo": -48 * k, "hindF.lo": -50 * k, "hindB.paw": 24 * k, "hindF.paw": 24 * k,
    "foreB.up": -70 * k, "foreF.up": -76 * k, "foreB.lo": 6 * k, "foreF.lo": 8 * k, "foreB.paw": -16 * k, "foreF.paw": -16 * k });
  return shotClip("ko", rest, [
    [0, {}],
    [80, { body: -10, neck: -20, head: -24, tail1: 20 }, { root: [0, -2], ease: "out" }],
    [220, { ...legs(0.5), body: -2, neck: 6, head: 6, tail1: -10 }, { ease: "in" }],
    [400, { ...legs(1), body: 0, ...limp }, { scale: [1.06, 0.94], ease: "in" }],
    [470, { ...legs(1), body: -2, ...limp, head: (limp.head ?? 0) - 8 }, { root: [0, -1.5], scale: [1, 1], ease: "out" }],
    [600, { ...legs(1), body: 0, ...limp }, { ease: "inOut" }],
  ], { head: 40, tail2: 60, tail3: 80 });
}
/** A bird's knockout: it topples back, the wings flop open, it lands (400) and lies still. */
function birdKo(rest: Rot, limp: Rot): Clip {
  return shotClip("ko", rest, [
    [0, {}],
    [80, { body: -16, wingB: 44, wingF: 48, "wingB.tip": 30, "wingF.tip": 34 }, { root: [0, -2], ease: "out" }],
    [220, { body: -30, "legB.up": -30, "legF.up": -40, "legB.lo": 40, "legF.lo": 50, wingB: 20, wingF: 24 }, { ease: "in" }],
    [400, { body: -50, "legB.up": -50, "legF.up": -60, "legB.lo": 60, "legF.lo": 70, wingB: -10, wingF: -14, "wingB.tip": -20, "wingF.tip": -24, ...limp }, { scale: [1.06, 0.94], ease: "in" }],
    [470, { body: -46, "legB.up": -50, "legF.up": -60, "legB.lo": 60, "legF.lo": 70, wingB: -4, wingF: -6, ...limp }, { root: [0, -1.5], scale: [1, 1], ease: "out" }],
    [600, { body: -50, "legB.up": -50, "legF.up": -60, "legB.lo": 60, "legF.lo": 70, wingB: -10, wingF: -14, "wingB.tip": -20, "wingF.tip": -24, ...limp }, { ease: "inOut" }],
  ], { head: 40 });
}
