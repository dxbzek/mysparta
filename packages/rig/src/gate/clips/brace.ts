/** Brace: the target sees the dash coming. Knees drop, chin tucks, the weapon comes up across
 *  the face and the free forearm covers the body. Held at its end until the next clip. */
import { clip, BOTH_FEET, STANCE } from "./kit";

export const BRACE = clip(120, false, [], [
  [0, STANCE],
  [120, { root: [-4, 9.5], torso: 4, head: 14, pelvis: -3, F: { up: 2, lo: -120, aim: -100 }, B: { up: -4, lo: -132, hand: 0 }, face: "grit", ease: "out" }],
], { plant: BOTH_FEET, lag: { head: 30, "armB.up": 20, "armB.lo": 20 } });
