/** Evade: a hop back out of the swing. The stage carries the hop (22 back, a 14-unit arc); the
 *  clip is the push off, the lean away in the air with the legs tucked and the weapon up across
 *  the body, the legs reaching for the floor and the landing at 320. */
import { clip, STANCE } from "./kit";

export const EVADE = clip(320, false, [{ t: 320, name: "land" }], [
  [0, STANCE],
  [60, { root: [-1, 9], torso: 18, head: -8, legF: { at: 12 }, legB: { at: -12 }, F: { at: [11, -46], aim: -82 }, B: { up: 4, lo: -136, hand: 0 }, face: "grit", ease: "out" }],
  [160, { root: [-3, -8], torso: -12, head: -12, legF: { up: -62, lo: 95, foot: 15 }, legB: { up: -10, lo: 100, foot: 30 },
    F: { at: [10, -64], aim: -108 }, B: { up: -28, lo: -112, hand: 5 }, face: "grin", ease: "out" }],
  [260, { root: [-1, -2], torso: -4, head: -8, legF: { up: -32, lo: 30, foot: 0 }, legB: { up: 12, lo: 40, foot: 10 },
    F: { at: [11, -56], aim: -96 }, B: { up: -6, lo: -128, hand: 0 }, ease: "inOut" }],
  [320, { ...STANCE, root: [-1, 5], face: "grit", ease: "in" }],
], { lag: { head: 40, "armB.up": 50, "armB.lo": 50 } });
