/**
 * Reactions (content clips): the heavy flinch and the two blocks.
 *
 * HIT_HEAVY (300 ms, a crit or a hit of a quarter of the health or more): the blow takes him off
 * balance. The head is thrown back hard, the chest folds back after it and the hips are shoved
 * back so far that the back foot has to step back twice its length to catch him; the arms fly
 * up and open and the weapon hand is knocked high. He sags, then pulls himself back over the
 * front foot into the guard, the back foot sliding home.
 *
 * The blocks (movement pass, 16 Nov 2026; Muybridge, "Animal Locomotion" plates 336 frames 4, 8
 * and 9 and 340 frames 1-3, a forearm raised square into the line of a lead, 1887, public domain).
 * The stage plays a block FROM the moment the blow lands, after the brace has already put the
 * guard up (`GUARD_UP`), and slides the fighter back 6 units over 120 ms (eased out). So t = 0 is
 * the impact: the forearms are driven back toward the face and the trunk rocks back over the
 * back foot, which pushes into the floor; then he comes forward into the guard. The feet take a
 * real step instead of sliding with the stage: the back foot lifts at once and lands again
 * further back on the floor; the front foot keeps its place on the floor while the body is
 * pushed off it (a `move` that cancels the stage's slide) and then steps back after it.
 *
 * BLOCK (220 ms): both forearms up, the weapon fist high in front of the face (a weapon held in
 * it stands across the blow), the free forearm by the cheek, the chin tucked between them.
 *
 * BLOCK_SHIELD (220 ms): the shield on the back arm held square to the blow in front of the face:
 * the back forearm at about -124 degrees, where the shield stands upright (`content/shields.ts`,
 * the grip turn), the upper arm raised forward so its top edge is over the head; the head low
 * behind it and the weapon arm drawn in by the ribs, ready to answer. It takes the blow a little harder: the trunk rocks further back.
 */
import type { Contact } from "../../engine/sample";
import { GUARD_UP } from "../../gate/clips/brace";
import { TOE_B, TOE_F } from "../../gate/clips/idle";
import { clip, onToe, STANCE, TOE } from "../../gate/clips/kit";
import type { LegSpec, Spec } from "../../gate/clips/kit";
import type { Stride } from "../../engine/sample";
import { HIT_LIGHT_KEYS, HIT_LIGHT_LAG } from "../../gate/clips/hit-light";

const HIT_HEAVY_KEYS: readonly (readonly [number, Spec])[] = [
  [0, { ...STANCE, face: "dazed" }],
  [32, { root: [-2, 3.4], pelvis: -2, torso: -4, head: -36, F: { at: [10, -56], aim: -100 }, B: { up: 10, lo: -126, hand: 10 }, face: "dazed" }],
  [82, { root: [-8, 4], pelvis: -8, torso: -22, head: -30, legB: { at: [-22, -7], foot: 18 }, F: { at: [3, -63], aim: -128 }, B: { up: 28, lo: -86, hand: 22 } }],
  [140, { root: [-12, 7], pelvis: -8, torso: -14, head: -16, legB: { at: -26 }, F: { at: [4, -60], aim: -120 }, B: { up: 30, lo: -84, hand: 20 }, ease: "inOut" }],
  [196, { root: [-8, 9], pelvis: -4, torso: 12, head: 6, legB: { at: -22 }, F: { at: [8, -52], aim: -101 }, B: { up: 14, lo: -118, hand: 6 }, face: "grit", ease: "inOut" }],
  [248, { root: [-4, 5.4], pelvis: -2, torso: 10, head: -4, legB: { at: [-16, -5], foot: 10 }, F: { at: [11, -52], aim: -88 }, B: { up: 9, lo: -134, hand: 2 }, ease: "inOut" }],
  [300, { ...STANCE, face: "grit", ease: "inOut" }],
];

/** The stage's block slide (`OUTCOME.blockSlide` 6 units over `blockSlideMs` 120, eased out), as
 *  the figure-space move of a foot that holds its place on the floor while it plays. */
const SLIDE = 6;
const slid = (t: number): number => { const u = Math.min(1, t / 120); return SLIDE * (1 - (1 - u) * (1 - u)); };
/** The footwork of both blocks: the back foot steps back at once, the front foot holds, then steps. */
const FEET: Contact[] = [
  { foot: "footF", from: 0, to: 130, at: TOE, move: [0, 20, 40, 60, 80, 100, 120, 130].map((t) => [t, slid(t)] as const) },
  // the last contacts end a hair before the clip does: the engine (sample.ts `spotOf`) reads a
  // contact that starts at 0 as taking over from one that ends at the clip's length, as in a loop,
  // and would start the back toe off the landing spot instead of where it stands
  { foot: "footF", from: 190, to: 219.9, at: TOE },
  { foot: "footB", from: 0, to: 20, at: TOE, move: [0, 4, 8, 12, 16, 20].map((t) => [t, slid(t)] as const) },
  { foot: "footB", from: 80, to: 219.9, at: TOE, move: [[80, 0], [100, slid(100) - slid(80)], [120, slid(120) - slid(80)]] },
];
/** Leg keys that match the footwork (the front toe carried by the slide until it steps home). */
const BACK = slid(120) - slid(80);
const legs = (t: number, back: LegSpec, front?: LegSpec): Spec => ({ legF: front ?? onToe(TOE_F + slid(t), 4), legB: back });
/** A foot target raised `h` off the floor. */
const above = (l: LegSpec, h: number): LegSpec => ("at" in l && typeof l.at !== "number" ? { at: [l.at[0], l.at[1] - h], foot: l.foot ?? 0 } : l);
/** The feet off the floor in the steps (movement pass 2): each toe goes straight up off its spot
 *  and comes straight down onto the next (they used to hang low and drag along the floor). The
 *  back toe keeps its spot on the stage as it leaves (the body sliding back under it). */
const B_LIFT: LegSpec = above(onToe(TOE_B + slid(40), 30), 6);
const F_LIFT: LegSpec = above(onToe(TOE_F + 3, 4), 6);
/** The back toe just over its landing spot, 8 ms before it lands (the body still sliding back). */
const B_DOWN: LegSpec = above(onToe(TOE_B - BACK - (slid(80) - slid(72)), 26), 1.0);
/** The guard the blocks end in: the idle's feet (heels a little up), so the cut into it is clean. */
const HOME: Spec = { ...STANCE, legF: onToe(TOE_F, 3), legB: onToe(TOE_B, 10), ease: "inOut" };

export const BLOCK = clip(220, false, [], [
  [0, { ...GUARD_UP }],
  [20, { ...legs(20, onToe(TOE_B + slid(20), 34)) }],
  [40, { root: [-4.5, 8.5], pelvis: -4, torso: 6, head: 8, F: { up: -80, lo: -100, hand: 28 }, B: { up: -30, lo: -128, hand: -6 },
    ...legs(40, B_LIFT), ease: "out" }],
  [72, { ...legs(72, B_DOWN), ease: "inOut" }],
  [80, { root: [-5, 8], pelvis: -4, torso: 7, head: 7, F: { up: -82, lo: -98, hand: 28 }, B: { up: -28, lo: -130, hand: -4 },
    ...legs(80, onToe(TOE_B - BACK, 24)), ease: "inOut" }],
  [130, { root: [-3.5, 7], pelvis: -2, torso: 10, head: 2, F: { up: -50, lo: -116, hand: 24 }, B: { up: -12, lo: -134, hand: 0 },
    ...legs(130, onToe(TOE_B - BACK, 18)), ease: "inOut" }],
  [160, { root: [-2.5, 5.5], torso: 10, F: { at: [11.5, -56], aim: -112 }, B: { up: 0, lo: -138, hand: 0 }, ...legs(160, onToe(TOE_B - BACK, 14), F_LIFT) }],
  [190, { root: [-1.5, 4], F: STANCE.F!, B: STANCE.B!, ...legs(190, onToe(TOE_B - BACK, 10), onToe(TOE_F, 6)) }],
  [220, HOME],
], { lag: { head: 24, "armB.up": 16, "armB.lo": 16 }, stride: { speed: 0, contacts: FEET } });

export const BLOCK_SHIELD = clip(220, false, [], [
  [0, { ...GUARD_UP, B: { up: -73, lo: -64, hand: 0 }, F: { up: 10, lo: -130, aim: -76 } }],
  [20, { ...legs(20, onToe(TOE_B + slid(20), 34)) }],
  [40, { root: [-5.5, 9], pelvis: -5, torso: 3, head: 12, B: { up: -64, lo: -68, hand: 0 }, F: { up: 12, lo: -128, aim: -74 },
    ...legs(40, B_LIFT), ease: "out" }],
  [72, { ...legs(72, B_DOWN), ease: "inOut" }],
  [80, { root: [-6, 8.5], pelvis: -5, torso: 4, head: 11, B: { up: -66, lo: -67, hand: 0 }, ...legs(80, onToe(TOE_B - BACK, 26)), ease: "inOut" }],
  [130, { root: [-4, 7], pelvis: -2, torso: 9, head: 6, B: { up: -45, lo: -86, hand: 0 }, F: { up: 8, lo: -130, aim: -80 },
    ...legs(130, onToe(TOE_B - BACK, 18)), ease: "inOut" }],
  [160, { root: [-2.5, 5.5], torso: 10, F: { up: 6, lo: -130, aim: -82 }, B: { up: -18, lo: -112, hand: 0 }, ...legs(160, onToe(TOE_B - BACK, 14), F_LIFT) }],
  [190, { root: [-1.5, 4], F: STANCE.F!, B: STANCE.B!, ...legs(190, onToe(TOE_B - BACK, 10), onToe(TOE_F, 6)) }],
  [220, HOME],
], { lag: { head: 24, "armF.up": 16, "armF.lo": 16 }, stride: { speed: 0, contacts: FEET } });

/**
 * The flinches step back (review finding 17: the stage's knockback slid both planted feet up to 39
 * units over the floor). The stage shoves the fighter back `KNOCK_STEP` units (times his drawn
 * size) over 120 ms, eased out, at the moment of contact, and leaves him there; he shuffles home
 * at his next way home, as after a block. The feet take that shove the way the blocks' feet take
 * theirs: the front toe holds its spot on the floor while the body is pushed off it and then
 * steps back after it; the back foot lifts at once and lands again further back. The upper body
 * is the flinch as keyed (its keys laid over the steps' times, straight between them).
 */
export const KNOCK_STEP = { light: 6, heavy: 10 } as const;

/** The feet of a step back of `d` over a `len` ms clip: their contacts and their leg keys. */
function stepBack(d: number, len: number): { contacts: Contact[]; legs: [number, Spec][] } {
  const sl = (t: number): number => { const u = Math.min(1, t / 120); return d * (1 - (1 - u) * (1 - u)); };
  const back = sl(120) - sl(80);
  const end = len - 0.1;
  const contacts: Contact[] = [
    { foot: "footF", from: 0, to: 130, at: TOE, move: [0, 20, 40, 60, 80, 100, 120, 130].map((t) => [t, sl(t)] as const) },
    { foot: "footF", from: 190, to: end, at: TOE },
    { foot: "footB", from: 0, to: 20, at: TOE, move: [0, 4, 8, 12, 16, 20].map((t) => [t, sl(t)] as const) },
    { foot: "footB", from: 80, to: end, at: TOE, move: [[80, 0], [100, sl(100) - sl(80)], [120, sl(120) - sl(80)]] },
  ];
  const f = (t: number): LegSpec => onToe(TOE_F + sl(t), 4);
  const legs: [number, Spec][] = [
    [20, { legF: f(20), legB: onToe(TOE_B + sl(20), 34) }],
    [40, { legF: f(40), legB: above(onToe(TOE_B + sl(40), 30), 6) }],
    [72, { legF: f(72), legB: above(onToe(TOE_B - back - (sl(80) - sl(72)), 26), 1.0) }],
    [80, { legF: f(80), legB: onToe(TOE_B - back, 24) }],
    [130, { legF: f(130), legB: onToe(TOE_B - back, 18) }],
    [160, { legF: above(onToe(TOE_F + d / 2, 4), 6), legB: onToe(TOE_B - back, 14) }],
    [190, { legF: onToe(TOE_F, 6), legB: onToe(TOE_B - back, 10) }],
    [220, { legF: onToe(TOE_F, 3), legB: onToe(TOE_B, 10) }],
    [len, { legF: STANCE.legF!, legB: STANCE.legB! }],
  ];
  return { contacts, legs };
}

/** A number, a pair or an object of numbers, straight from `a` to `b` (anything else is `b`'s). */
function mix(a: unknown, b: unknown, u: number): unknown {
  if (typeof a === "number" && typeof b === "number") return a + (b - a) * u;
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) return a.map((v, i) => mix(v, b[i], u));
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = Object.keys(a).sort().join();
    if (ka !== Object.keys(b).sort().join()) return b;
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(b)) o[k] = mix((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], u);
    return o;
  }
  return u < 1 ? a ?? b : b;
}

/** A flinch's keys with stepping feet: its upper body at every key time of either, the legs of the step. */
function stepping(keys: readonly (readonly [number, Spec])[], d: number, len: number): { keys: [number, Spec][]; stride: Stride } {
  // the flinch's keys carried forward (a key names only what changes), without its legs
  const full: [number, Spec][] = [];
  let carry: Spec = {};
  for (const [t, s] of keys) {
    carry = { ...carry, ...s };
    const { legF: _f, legB: _b, ease: _e, ...upper } = carry;
    full.push([t, { ...upper, ...(s.ease !== undefined ? { ease: s.ease } : {}) }]);
  }
  const step = stepBack(d, len);
  const at = (list: readonly (readonly [number, Spec])[], t: number): Spec => {
    let i = 0;
    while (i + 1 < list.length && list[i + 1]![0] <= t) i++;
    const [ta, a] = list[i]!;
    const next = list[i + 1];
    if (next === undefined || t <= ta) return a;
    const [tb, b] = next;
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (k === "ease") continue;
      out[k] = mix((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], (t - ta) / (tb - ta));
    }
    return out as Spec;
  };
  const legs0: Spec = { legF: STANCE.legF!, legB: STANCE.legB! };
  const legList: [number, Spec][] = [[0, legs0], ...step.legs];
  const times = [...new Set([...full.map(([t]) => t), ...legList.map(([t]) => t)])].sort((x, y) => x - y);
  const own = new Map(full.map(([t, s]) => [t, s]));
  const out: [number, Spec][] = times.map((t) => {
    const upper = own.get(t) ?? at(full, t);
    const legs = legList.find(([lt]) => lt === t)?.[1] ?? at(legList, t);
    return [t, { ...upper, legF: legs.legF!, legB: legs.legB! }];
  });
  return { keys: out, stride: { speed: 0, contacts: step.contacts } };
}

const heavy = stepping(HIT_HEAVY_KEYS, KNOCK_STEP.heavy, 300);
export const HIT_HEAVY = clip(300, false, [], heavy.keys, { lag: { torso: 30, "armB.up": 30, "armB.lo": 30, handB: 30 }, stride: heavy.stride });
const light = stepping(HIT_LIGHT_KEYS, KNOCK_STEP.light, 300);
/** The light flinch with stepping feet (overrides the gate pack's planted one). */
export const HIT_LIGHT_STEP = clip(300, false, [], light.keys, { lag: HIT_LIGHT_LAG, stride: light.stride });
