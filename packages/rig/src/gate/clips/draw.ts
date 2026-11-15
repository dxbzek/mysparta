/** Draw: the front hand goes down to the back hip for the next weapon, the chest turns over it
 *  and the eyes follow; the hand pulls the weapon out point down, and the forearm brings it up
 *  into the ready, overshooting a little. The hand goes by the side of the hip, not through the
 *  body, and the forearm turns at a real arm's rate. A strong, quick beat: with throws in most
 *  bouts it is seen nearly every bout (owner amendment 13.8). */
import { clip, BOTH_FEET, STANCE } from "./kit";

export const DRAW = clip(200, false, [], [
  [0, STANCE],
  [36, { root: [-2, 4.6], torso: 13, head: 8, pelvis: -2, F: { up: 10, lo: -86, hand: 20 }, B: { up: 2, lo: -138, hand: 0 }, face: "grit" }],
  [76, { root: [-3, 6], torso: 18, head: 16, pelvis: -4, F: { up: 14, lo: -62, hand: 30 }, B: { up: -6, lo: -132, hand: 0 } }],
  [116, { root: [-1.5, 4.8], torso: 12, head: 4, pelvis: -1, F: { up: 12, lo: -84, hand: 30 }, B: { up: -2, lo: -136, hand: 0 } }],
  [160, { root: [0, 3.6], torso: 7, head: -8, pelvis: 0, F: { up: -6, lo: -112, aim: -98 }, B: { up: 6, lo: -140, hand: 0 } }],
  [200, { ...STANCE, ease: "inOut" }],
], { plant: BOTH_FEET, lag: { head: 30, "armB.up": 40, "armB.lo": 40 } });
