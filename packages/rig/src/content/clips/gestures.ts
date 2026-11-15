/**
 * The Moves' own gestures and reactions (owner, 16 Nov 2026: "The effects aren't there"). Each is
 * a real body doing a real thing, so a viewer can tell the Move from the body alone:
 *
 *   ears      the Air Horn's target: hunched, both hands clamped over the ears, head ducked and
 *             shaking, wincing (a 600 ms loop).
 *   rub-eyes  the target of Sand in the Eyes: bent over, the front fist grinding at the eyes, the
 *             back hand groping blind in front (a 560 ms loop).
 *   taunt     the Taunt: chest out, chin up, the front fist thrown up and pumping over the head and the back
 *             hand beckoning the enemy in ("come on"), shouting (1300 ms).
 *   angry     the Taunt's target: it leans in, both fists up and shaking, chin down, teeth gritted
 *             (a 480 ms loop).
 *
 * The stage asks for them by name (the content pack's `variants`, like the footwork clips).
 */
import { clip, BOTH_FEET, STANCE } from "../../gate/clips/kit";
import type { Spec } from "../../gate/clips/kit";

const EARS_A: Spec = { root: [-1.5, 6], pelvis: -2, torso: 16, head: 14, held: 0, legF: { at: 10 }, legB: { at: -12 },
  F: { at: [0.5, -68.5], hand: -63 }, B: { at: [-1.5, -70.5], hand: -67 }, face: "grit" };
export const EARS = clip(600, true, [], [
  [0, EARS_A],
  [150, { root: [-0.5, 6.8], torso: 20, head: 20, F: { at: [1.5, -66.5], hand: -61 }, B: { at: [-0.5, -68.5], hand: -65 }, face: "dazed", ease: "inOut" }],
  [300, { root: [-2, 5.6], torso: 14, head: 8, F: { at: [0, -69.5], hand: -65 }, B: { at: [-2, -71.5], hand: -69 }, face: "grit", ease: "inOut" }],
  [450, { root: [-0.8, 6.6], torso: 19, head: 18, F: { at: [1.2, -67], hand: -61 }, B: { at: [-0.8, -69], hand: -65 }, face: "dazed", ease: "inOut" }],
  [600, { ...EARS_A, ease: "inOut" }],
], { plant: BOTH_FEET, lag: { head: 30 } });

const RUB_A: Spec = { root: [-0.5, 7], pelvis: -2, torso: 26, head: 18, held: 0, legF: { at: 11 }, legB: { at: -13 },
  F: { at: [12, -63], hand: -60 }, B: { at: [24, -46], hand: 6 }, face: "grit" };
export const RUB_EYES = clip(560, true, [], [
  [0, RUB_A],
  [140, { root: [0.5, 7.4], torso: 28, head: 22, F: { at: [13.5, -60.5], hand: -50 }, B: { at: [27, -42], hand: 14 }, face: "dazed", ease: "inOut" }],
  [280, { root: [-1, 6.6], torso: 24, head: 14, F: { at: [11, -65], hand: -66 }, B: { at: [22, -49], hand: -4 }, face: "grit", ease: "inOut" }],
  [420, { root: [0, 7.2], torso: 27, head: 20, F: { at: [13, -61.5], hand: -54 }, B: { at: [26, -44], hand: 10 }, face: "dazed", ease: "inOut" }],
  [560, { ...RUB_A, ease: "inOut" }],
], { plant: BOTH_FEET, lag: { head: 40, "armB.up": 50, "armB.lo": 50 } });

const PUMP_UP: Spec = { root: [-0.5, 1.6], pelvis: 0, torso: -8, head: -16, legF: { at: 12 }, legB: { at: -13 },
  F: { dir: -96, reach: 0.97, hand: 0 }, B: { at: [21, -55], hand: -62 }, face: "shout" };
/** The pump: the fist comes down to just over the head (a short pump keeps a forearm under a real
 *  arm's speed, even with the back hand on a two-hand shaft). */
const PUMP_DOWN: Spec = { root: [0.2, 2.6], torso: -5, head: -13, F: { dir: -98, reach: 0.84, hand: -4 }, B: { at: [19.5, -54.5], hand: 10 }, face: "shout" };
export const TAUNT = clip(1300, false, [], [
  [0, STANCE],
  [400, { ...PUMP_UP, ease: "inOut" }],
  [620, { ...PUMP_DOWN, ease: "inOut" }],
  [840, { ...PUMP_UP, B: { at: [22, -56], hand: -64 }, ease: "inOut" }],
  [1300, { ...STANCE, ease: "inOut" }],
], { plant: BOTH_FEET, lag: { head: 50, "armB.up": 40, "armB.lo": 40, handB: 60 } });

const ANGRY_A: Spec = { root: [2, 5.5], pelvis: 3, torso: 20, head: 2, legF: { at: 14 }, legB: { at: -13 },
  F: { at: [20, -50], hand: -40 }, B: { at: [14, -53], hand: -30 }, face: "grit" };
export const ANGRY = clip(480, true, [], [
  [0, ANGRY_A],
  [120, { root: [2.8, 6], torso: 23, head: 4, F: { at: [21.5, -52], hand: -46 }, B: { at: [15.5, -55], hand: -36 }, face: "shout", ease: "inOut" }],
  [240, { root: [1.6, 5.2], torso: 18, head: 0, F: { at: [19.5, -49], hand: -36 }, B: { at: [13.5, -51.5], hand: -26 }, face: "grit", ease: "inOut" }],
  [360, { root: [2.6, 5.9], torso: 22, head: 4, F: { at: [21, -51.5], hand: -44 }, B: { at: [15, -54.5], hand: -34 }, face: "shout", ease: "inOut" }],
  [480, { ...ANGRY_A, ease: "inOut" }],
], { plant: BOTH_FEET, lag: { head: 30 } });

export const GESTURES = { ears: EARS, "rub-eyes": RUB_EYES, taunt: TAUNT, angry: ANGRY } as const;
export type Gesture = keyof typeof GESTURES;
