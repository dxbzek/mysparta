/** Draw: the front hand drops to the belt for the next weapon, the chest turns over it and the
 *  eyes follow; the forearm brings the weapon up into the ready, overshooting a little. The hand
 *  stays outside the trunk and the forearm turns at a real arm's rate. A strong, quick beat: with
 *  throws in most bouts it is seen nearly every bout (owner amendment 13.8).
 *  Depth: the hand drops to about 46 units up, not to the hip (about 34). A two-hand weapon keeps
 *  the back hand on `grip2` through the draw (rig lane 13.3), and from the hip the back arm
 *  cannot reach the shaft: 102 to 122% of its length for the content poles, the chair and the
 *  tyre. At belt height it needs 91% or less, inside ANATOMY.reach. */
import { clip, BOTH_FEET, STANCE } from "./kit";

export const DRAW = clip(200, false, [], [
  [0, STANCE],
  [36, { root: [-2, 4.6], torso: 13, head: 8, pelvis: -2, F: { up: 14, lo: -116, hand: 34 }, B: { up: 2, lo: -138, hand: 0 }, face: "grit" }],
  [76, { root: [-3, 6], torso: 18, head: 16, pelvis: -4, F: { up: 22, lo: -120, hand: 40 }, B: { up: -6, lo: -132, hand: 0 } }],
  [116, { root: [-1.5, 4.8], torso: 12, head: 4, pelvis: -1, F: { up: 16, lo: -118, hand: 38 }, B: { up: -2, lo: -136, hand: 0 } }],
  [160, { root: [0, 3.6], torso: 7, head: -8, pelvis: 0, F: { up: -10, lo: -118, aim: -94 }, B: { up: 6, lo: -140, hand: 0 } }],
  [200, { ...STANCE, ease: "inOut" }],
], { plant: BOTH_FEET, lag: { head: 30, "armB.up": 40, "armB.lo": 40 } });
