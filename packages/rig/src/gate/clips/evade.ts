/** Evade: a hop back out of the swing. The stage carries the hop (22 back, a 14-unit arc); the
 *  clip is the push off, the tuck and lean away in the air, and the landing at 320. */
import { clip, STANCE } from "./kit";

export const EVADE = clip(320, false, [{ t: 320, name: "land" }], [
  [0, STANCE],
  [60, { root: [-1, 9], torso: 18, head: -8, legF: { at: 12 }, legB: { at: -12 }, F: { at: [11, -46], aim: -80 }, B: { at: [8, -48] }, face: "grit", ease: "out" }],
  [160, { root: [-3, -8], torso: -18, head: -12, legF: { up: -62, lo: 95, foot: 15 }, legB: { up: -10, lo: 100, foot: 30 },
    F: { up: -95, lo: -70, aim: -110 }, B: { up: 40, lo: -40 }, face: "grin", ease: "out" }],
  [260, { root: [-1, -2], torso: -6, head: -8, legF: { up: -32, lo: 30, foot: 0 }, legB: { up: 12, lo: 40, foot: 10 },
    F: { up: -80, lo: -80, aim: -100 }, B: { up: 4, lo: -115 }, ease: "inOut" }],
  [320, { ...STANCE, root: [-1, 5], face: "grit", ease: "in" }],
], { lag: { head: 40, "armB.up": 50, "armB.lo": 50 } });
